// ============================================================
// `SheetSession` (Task 29) — contrato de estado, ciclo de vida e fila SERIAL.
//
// As portas de persistência são dublês aqui de propósito: este arquivo prende
// o CONTRATO da sessão (o que ela aceita, o que ela recusa, em que ordem e o
// que publica). O protocolo durável sobre as peças REAIS das Tasks 13/14 —
// preparo, save local, confirmação e os três cenários de falha — está em
// `tests/integration/sheet-persistence.test.js`.
//
// Os casos que este arquivo existe para prender:
//
//   - init editável / ficha ausente / schema FUTURO somente leitura /
//     referência quebrada do catálogo;
//   - dispose e CANCELAMENTO: um carregamento de geração anterior que chega
//     atrasado é descartado, nunca adotado (o defeito real: entrar na ficha A,
//     voltar, entrar na B, e ver os dados de A aparecerem);
//   - fila SERIAL: dois comandos disparados no mesmo milissegundo executam em
//     ordem, cada um lendo o `expectedRevisionToken` do estado adotado pelo
//     anterior;
//   - path canônico sem seção registrada: falha explícita ANTES de qualquer
//     escrita, nunca `dirtySections` vazio com o personagem salvo.
// ============================================================
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ok, err } from '../../../site/js/core/result.js';
import { createAppError } from '../../../site/js/core/errors.js';
import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import { createSheetSession } from '../../../site/js/features/sheet/sheet-session.js';
import { SHEET_MODE, SHEET_STATUS, SHEET_SYNC_STATES } from '../../../site/js/features/sheet/sheet-state.js';
import {
  LocalStoragePreferencesRepository,
  sheetCollapseKey,
} from '../../../site/js/infra/preferences/local-storage-preferences-repository.js';
import { createMemoryStorage } from '../../helpers/memory-storage.js';

const NOW = '2026-08-03T12:00:00.000Z';
const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });
const CHARACTER_ID = 'ficha-0001-aaaa';

/**
 * Personagem canônico mínimo, com PV suficiente para os comandos do arquivo.
 * @param {string} [id]
 * @param {number} [current]
 * @returns {object}
 */
function personagem(id = CHARACTER_ID, current = 10) {
  const base = createEmptyCharacter({ id, now: NOW, rulesetRef: RULESET_REF });
  return Object.freeze({
    ...base,
    state: Object.freeze({ ...base.state, hitPoints: Object.freeze({ current, temporary: 0 }) }),
    metadata: Object.freeze({ ...base.metadata, createdAt: NOW, updatedAt: NOW }),
  });
}

/**
 * Repositório em memória: um registro, com token de revisão que muda a cada
 * escrita (é o que torna o `expectedRevisionToken` observável).
 * @param {{envelope?: object|null, getResult?: object|null, delay?: number}} [config]
 * @returns {object}
 */
function repositorioFalso({ envelope = null, getResult = null, delay = 0 } = {}) {
  let atual =
    envelope ??
    Object.freeze({ mode: SHEET_MODE.editable, character: personagem(), revisionToken: 'rev-0', warnings: [], rawRecord: { id: CHARACTER_ID } });
  const chamadas = [];
  return {
    chamadas,
    /** @returns {object} */
    get snapshot() {
      return atual;
    },
    /**
     * @param {string} id
     * @returns {object|Promise<object>}
     */
    get(id) {
      chamadas.push({ op: 'get', id });
      const resultado = getResult !== null ? getResult : ok(atual);
      if (delay > 0) {
        return new Promise((resolve) => setTimeout(() => resolve(resultado), delay));
      }
      return resultado;
    },
    /**
     * @param {object} character
     * @param {{expectedRevisionToken: string|null}} options
     * @returns {object}
     */
    save(character, { expectedRevisionToken }) {
      chamadas.push({ op: 'save', expectedRevisionToken, hp: character.state.hitPoints.current });
      if (expectedRevisionToken !== atual.revisionToken) {
        return err(createAppError({ code: 'CHARACTER_SAVE_REVISION_CONFLICT', scope: 'teste', message: 'conflito' }));
      }
      const proximo = Number(atual.revisionToken.split('-')[1]) + 1;
      atual = Object.freeze({ ...atual, character, revisionToken: `rev-${proximo}` });
      return ok(atual);
    },
  };
}

/**
 * Mutação durável falsa: encaminha para o repositório e devolve o `syncState`
 * pedido, sem rede nenhuma.
 * @param {object} repository
 * @param {{syncState?: string, fail?: object|null}} [config]
 * @returns {object}
 */
function mutacaoFalsa(repository, { syncState = SHEET_SYNC_STATES.queued, fail = null } = {}) {
  return {
    /**
     * @param {object} character
     * @param {object} options
     * @returns {object}
     */
    save(character, options) {
      if (fail !== null) {
        return err(fail);
      }
      const saved = repository.save(character, options);
      if (!saved.ok) {
        return saved;
      }
      return ok(Object.freeze({ envelope: saved.value, syncState }));
    },
  };
}

/**
 * Monta uma sessão com as portas indicadas.
 * @param {object} [portas]
 * @returns {object}
 */
function sessao(portas = {}) {
  const repository = portas.repository ?? repositorioFalso();
  return createSheetSession({
    characterId: portas.characterId ?? CHARACTER_ID,
    repository,
    durableMutation: portas.durableMutation ?? mutacaoFalsa(repository),
    clock: { now: () => NOW },
    // PV máximo é dica do composition root (a derivação por ruleset ainda não
    // existe — concern da Task 16); sem ela a projeção falha de propósito, em
    // vez de chutar um valor.
    projectionContext: () => ({ maximumHitPoints: 20 }),
    // `portas` vem por último para poder sobrescrever qualquer default acima;
    // `repository` já foi resolvido no topo justamente para ser o MESMO objeto
    // usado pela mutação durável.
    ...portas,
  });
}

describe('unit/sheet/sheet-session — inicialização', () => {
  test('ficha editável: status ready, modo editable e ViewModel pronto', async () => {
    const session = sessao();
    const iniciada = await session.initialize({});
    assert.equal(iniciada.ok, true, iniciada.ok ? '' : iniciada.error.code);
    const snapshot = iniciada.value;
    assert.equal(snapshot.status, SHEET_STATUS.ready);
    assert.equal(snapshot.mode, SHEET_MODE.editable);
    assert.equal(snapshot.characterId, CHARACTER_ID);
    assert.equal(snapshot.viewModel.derived.hitPoints.current, 10);
    assert.equal(snapshot.revisionToken, 'rev-0');
    assert.equal(snapshot.syncState, SHEET_SYNC_STATES.none);
    assert.deepEqual([...snapshot.dirtySections], []);
    assert.ok(Object.isFrozen(snapshot));
  });

  test('ficha AUSENTE: erro nomeado, status error, nenhum ViewModel', async () => {
    const session = sessao({ repository: repositorioFalso({ getResult: ok(null) }) });
    const iniciada = await session.initialize({});
    assert.equal(iniciada.ok, false);
    assert.equal(iniciada.error.code, 'SHEET_CHARACTER_NOT_FOUND');
    assert.equal(session.getSnapshot().status, SHEET_STATUS.error);
    assert.equal(session.getSnapshot().viewModel, null);
  });

  test('schema FUTURO: abre em somente leitura, com o registro cru e sem ViewModel', async () => {
    const readOnly = Object.freeze({
      mode: 'read-only',
      rawRecord: Object.freeze({ id: CHARACTER_ID, schemaVersion: 3, nome: 'Do Futuro' }),
      detectedVersion: 3,
      revisionToken: 'rev-futuro',
      warnings: [],
    });
    const session = sessao({ repository: repositorioFalso({ envelope: readOnly }) });
    const iniciada = await session.initialize({});
    assert.equal(iniciada.ok, true, iniciada.ok ? '' : iniciada.error.code);
    assert.equal(iniciada.value.mode, SHEET_MODE.readOnly);
    assert.equal(iniciada.value.status, SHEET_STATUS.ready);
    assert.equal(iniciada.value.viewModel, null);
    assert.equal(iniciada.value.readOnlyRecord.nome, 'Do Futuro');
  });

  test('somente leitura RECUSA qualquer comando (nunca reescreve com schema antigo)', async () => {
    const readOnly = Object.freeze({ mode: 'read-only', rawRecord: { id: CHARACTER_ID }, revisionToken: 'rev-futuro', warnings: [] });
    const repository = repositorioFalso({ envelope: readOnly });
    const session = sessao({ repository });
    await session.initialize({});
    const resultado = await session.dispatch({ type: 'apply-damage', amount: 1 });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SHEET_READ_ONLY');
    assert.equal(repository.chamadas.filter((c) => c.op === 'save').length, 0);
  });

  test('referência QUEBRADA do catálogo: erro estruturado, nunca um ViewModel parcial', async () => {
    const session = sessao({
      projectSheet: () => err(createAppError({ code: 'CONTENT_REFERENCE_NOT_FOUND', scope: 'teste', message: 'classe inexistente' })),
    });
    const iniciada = await session.initialize({});
    assert.equal(iniciada.ok, false);
    assert.equal(iniciada.error.code, 'CONTENT_REFERENCE_NOT_FOUND');
    assert.equal(session.getSnapshot().status, SHEET_STATUS.error);
    assert.equal(session.getSnapshot().viewModel, null);
  });

  test('erro de LEITURA do repositório é propagado como está', async () => {
    const problema = createAppError({ code: 'CHARACTER_STORAGE_UNREADABLE', scope: 'teste', message: 'storage ilegível' });
    const session = sessao({ repository: repositorioFalso({ getResult: err(problema) }) });
    const iniciada = await session.initialize({});
    assert.equal(iniciada.ok, false);
    assert.equal(iniciada.error.code, 'CHARACTER_STORAGE_UNREADABLE');
  });
});

describe('unit/sheet/sheet-session — dispose e cancelamento', () => {
  test('resposta de GERAÇÃO ANTERIOR é descartada, nunca adotada', async () => {
    // O caso real: entrar na ficha, sair e entrar de novo. O primeiro `get`
    // resolve DEPOIS do segundo e não pode sobrescrever nada.
    const repository = repositorioFalso({ delay: 20 });
    const session = sessao({ repository });
    const primeira = session.initialize({});
    // Segunda entrada, ainda com a primeira em voo.
    const segunda = session.initialize({});
    const [a, b] = await Promise.all([primeira, segunda]);
    assert.equal(a.ok, false);
    assert.equal(a.error.code, 'SHEET_INIT_STALE');
    assert.equal(b.ok, true);
    assert.equal(session.getSnapshot().status, SHEET_STATUS.ready);
  });

  test('dispose durante o carregamento descarta o resultado que chega depois', async () => {
    const session = sessao({ repository: repositorioFalso({ delay: 20 }) });
    const emVoo = session.initialize({});
    session.dispose();
    const resultado = await emVoo;
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SHEET_INIT_STALE');
    assert.equal(session.getSnapshot().status, SHEET_STATUS.loading);
  });

  test('dispose é idempotente e recusa tudo depois', async () => {
    const session = sessao();
    await session.initialize({});
    session.dispose();
    session.dispose();
    assert.equal(session.isDisposed(), true);
    assert.equal((await session.dispatch({ type: 'apply-damage', amount: 1 })).error.code, 'SHEET_SESSION_DISPOSED');
    assert.equal((await session.initialize({})).error.code, 'SHEET_SESSION_DISPOSED');
    assert.equal(session.setUiState({}).error.code, 'SHEET_SESSION_DISPOSED');
    assert.equal((await session.retry('x')).error.code, 'SHEET_SESSION_DISPOSED');
  });

  test('dispose solta os listeners: nenhum notify posterior alcança quem se inscreveu', async () => {
    const session = sessao();
    const recebidos = [];
    session.subscribe((snapshot) => recebidos.push(snapshot.status));
    await session.initialize({});
    const antes = recebidos.length;
    session.dispose();
    session.setUiState({ focusedSectionId: 'summary-combat' });
    assert.equal(recebidos.length, antes);
  });

  test('AbortSignal externo aborta o carregamento em voo', async () => {
    const controller = new AbortController();
    const session = sessao({ repository: repositorioFalso({ delay: 20 }) });
    const emVoo = session.initialize({ signal: controller.signal });
    controller.abort();
    // O sinal externo aborta o trabalho; a GERAÇÃO é o que garante a correção,
    // então o resultado ainda precisa ser observável como sucesso ou stale —
    // nunca como adoção silenciosa depois do abort.
    const resultado = await emVoo;
    assert.ok(resultado.ok === true || resultado.error.code === 'SHEET_INIT_STALE');
  });
});

describe('unit/sheet/sheet-session — comandos e fila serial', () => {
  test('comando bem-sucedido adota o estado e devolve dirtySections do mapa', async () => {
    const repository = repositorioFalso();
    const session = sessao({ repository });
    await session.initialize({});
    const resultado = await session.dispatch({ type: 'apply-damage', amount: 3 });
    assert.equal(resultado.ok, true, resultado.ok ? '' : resultado.error.code);
    assert.deepEqual([...resultado.value.dirtySections], ['summary-combat']);
    assert.equal(resultado.value.snapshot.viewModel.derived.hitPoints.current, 7);
    assert.equal(resultado.value.snapshot.revisionToken, 'rev-1');
    assert.equal(resultado.value.snapshot.syncState, SHEET_SYNC_STATES.queued);
  });

  test('DOIS comandos no mesmo milissegundo serializam e cada um usa o token adotado pelo anterior', async () => {
    const repository = repositorioFalso();
    const session = sessao({ repository });
    await session.initialize({});

    // Disparados no MESMO tick, sem await entre eles — é a corrida real.
    const [a, b] = await Promise.all([
      session.dispatch({ type: 'apply-damage', amount: 2 }),
      session.dispatch({ type: 'apply-damage', amount: 3 }),
    ]);

    assert.equal(a.ok, true, a.ok ? '' : a.error.code);
    assert.equal(b.ok, true, b.ok ? '' : b.error.code);
    const saves = repository.chamadas.filter((c) => c.op === 'save');
    assert.deepEqual(
      saves.map((c) => c.expectedRevisionToken),
      ['rev-0', 'rev-1'],
      'o segundo save precisa usar o token adotado pelo primeiro — senão é corrida',
    );
    // Os dois danos foram aplicados: nenhum sobrescreveu o outro.
    assert.equal(session.getSnapshot().viewModel.derived.hitPoints.current, 5);
  });

  test('uma falha no meio da fila não envenena os comandos seguintes', async () => {
    const repository = repositorioFalso();
    const session = sessao({ repository });
    await session.initialize({});
    const [invalido, valido] = await Promise.all([
      session.dispatch({ type: 'comando-inexistente' }),
      session.dispatch({ type: 'apply-damage', amount: 1 }),
    ]);
    assert.equal(invalido.ok, false);
    assert.equal(valido.ok, true, valido.ok ? '' : valido.error.code);
    assert.equal(session.getSnapshot().viewModel.derived.hitPoints.current, 9);
  });

  test('comando INVÁLIDO descarta o candidato: nada salvo, estado confirmado intacto', async () => {
    const repository = repositorioFalso();
    const session = sessao({ repository });
    await session.initialize({});
    const resultado = await session.dispatch({ type: 'comando-inexistente' });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'COMMAND_TYPE_UNKNOWN');
    assert.equal(repository.chamadas.filter((c) => c.op === 'save').length, 0);
    assert.equal(session.getSnapshot().viewModel.derived.hitPoints.current, 10);
  });

  test('path canônico SEM seção registrada falha ANTES de salvar (nunca dirtySections vazio)', async () => {
    const repository = repositorioFalso();
    const session = sessao({
      repository,
      commandDispatcher: (character) => ({
        ok: true,
        character,
        events: [],
        affected: ['state.campoQueNinguemMapeou'],
      }),
    });
    await session.initialize({});
    const resultado = await session.dispatch({ type: 'qualquer' });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SHEET_AFFECTED_PATH_UNMAPPED');
    assert.equal(repository.chamadas.filter((c) => c.op === 'save').length, 0);
  });

  test('affected VAZIO é sucesso sem escrita (no-op idempotente)', async () => {
    const repository = repositorioFalso();
    const session = sessao({ repository });
    await session.initialize({});
    const resultado = await session.dispatch({ type: 'revert-character-edit', path: 'hp.maximum' });
    assert.equal(resultado.ok, true, resultado.ok ? '' : resultado.error.code);
    assert.deepEqual([...resultado.value.dirtySections], []);
    assert.equal(repository.chamadas.filter((c) => c.op === 'save').length, 0);
  });

  test('sem protocolo durável nenhum comando é aceito (nada é salvo às cegas)', async () => {
    const session = createSheetSession({
      characterId: CHARACTER_ID,
      repository: repositorioFalso(),
      durableMutation: null,
      clock: { now: () => NOW },
    });
    await session.initialize({});
    const resultado = await session.dispatch({ type: 'apply-damage', amount: 1 });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SHEET_PERSISTENCE_UNAVAILABLE');
  });
});

describe('unit/sheet/sheet-session — UI state e preferências', () => {
  /**
   * Repositório de preferências em memória, com a MESMA forma do real
   * (`Result<{value, warnings}>`).
   * @returns {object}
   */
  function preferenciasFalsas() {
    const colapsoPorFicha = new Map();
    const escritas = [];
    return {
      escritas,
      colapsoPorFicha,
      /** @returns {object} */
      getCurrencyRates: () => ok({ value: { po: 1 }, warnings: [] }),
      /** @returns {object} */
      getPurchaseEquippedDefault: () => ok({ value: true, warnings: [] }),
      /** @returns {object} */
      getLevelUpFlowV2: () => ok({ value: true, warnings: [] }),
      /**
       * @param {string} id
       * @returns {object}
       */
      getSheetCollapse: (id) => ok({ value: colapsoPorFicha.get(id) ?? null, warnings: [] }),
      /**
       * @param {string} id
       * @param {object} value
       * @returns {object}
       */
      setSheetCollapse: (id, value) => {
        escritas.push({ id, value });
        colapsoPorFicha.set(id, { ...value });
        return ok(undefined);
      },
    };
  }

  test('preferências entram no snapshot sem se misturar ao personagem', async () => {
    const session = sessao({ preferences: preferenciasFalsas() });
    const iniciada = await session.initialize({});
    assert.equal(iniciada.ok, true);
    assert.deepEqual(iniciada.value.preferences.currencyRates, { po: 1 });
    assert.equal(iniciada.value.preferences.purchaseEquippedDefault, true);
    assert.equal(iniciada.value.preferences.levelUpFlowV2, true);
    // Nenhuma preferência encostou no personagem canônico.
    assert.equal(JSON.stringify(iniciada.value.viewModel.data).includes('purchaseEquipped'), false);
  });

  test('colapso é PERSISTIDO como preferência da ficha e recarregado numa sessão nova', async () => {
    const preferences = preferenciasFalsas();
    const primeira = sessao({ preferences });
    await primeira.initialize({});
    const aplicado = primeira.setUiState({ collapsed: { 'spells-spellbook': true } });
    assert.equal(aplicado.ok, true);
    assert.equal(aplicado.value.uiState.collapsed['spells-spellbook'], true);
    assert.deepEqual(preferences.escritas.at(-1), { id: CHARACTER_ID, value: { 'spells-spellbook': true } });

    const segunda = sessao({ preferences });
    const recarregada = await segunda.initialize({});
    assert.equal(recarregada.value.uiState.collapsed['spells-spellbook'], true);
  });

  test('o colapso de UMA ficha não vaza para OUTRA (chave sheet_collapse_<id>)', async () => {
    const preferences = preferenciasFalsas();
    const a = sessao({ preferences, characterId: 'ficha-aaaa-0001' });
    await a.initialize({});
    a.setUiState({ collapsed: { 'inventory-load-coins': true } });

    const b = sessao({ preferences, characterId: 'ficha-bbbb-0002' });
    const iniciada = await b.initialize({});
    assert.deepEqual(iniciada.value.uiState.collapsed, {});
  });

  test('seção desconhecida no patch de colapso é recusada', async () => {
    const session = sessao();
    await session.initialize({});
    const resultado = session.setUiState({ collapsed: { 'secao-inventada': true } });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SHEET_UI_STATE_COLLAPSED_UNKNOWN_SECTION');
  });

  test('setUiState não toca o personagem nem dispara escrita de personagem', async () => {
    const repository = repositorioFalso();
    const session = sessao({ repository, preferences: preferenciasFalsas() });
    await session.initialize({});
    const antes = session.getSnapshot().viewModel;
    session.setUiState({ focusedSectionId: 'summary-combat' });
    assert.equal(session.getSnapshot().viewModel, antes, 'o ViewModel não é reprojetado por mudança de tela');
    assert.equal(repository.chamadas.filter((c) => c.op === 'save').length, 0);
  });

  test('patch que não é objeto simples é recusado', async () => {
    const session = sessao();
    await session.initialize({});
    assert.equal(session.setUiState(['x']).error.code, 'SHEET_UI_STATE_PATCH_INVALID');
    assert.equal(session.setUiState(null).error.code, 'SHEET_UI_STATE_PATCH_INVALID');
  });
});

describe('unit/sheet/sheet-session — assinatura', () => {
  test('um listener que lança não derruba a sessão nem os outros', async () => {
    const session = sessao();
    const vistos = [];
    session.subscribe(() => {
      throw new Error('listener quebrado');
    });
    session.subscribe((snapshot) => vistos.push(snapshot.status));
    const iniciada = await session.initialize({});
    assert.equal(iniciada.ok, true);
    assert.ok(vistos.includes(SHEET_STATUS.ready));
  });

  test('o disposer da assinatura é idempotente', async () => {
    const session = sessao();
    const vistos = [];
    const unsubscribe = session.subscribe(() => vistos.push(1));
    unsubscribe();
    unsubscribe();
    await session.initialize({});
    assert.equal(vistos.length, 0);
  });
});


describe('unit/sheet/sheet-session — preferências sobre o repositório REAL', () => {
  // Os casos acima usam um dublê de preferências, que é suficiente para o
  // CONTRATO da sessão. Ele não é suficiente para a PERSISTÊNCIA: o dublê ecoa
  // qualquer chave, e o repositório real tem shape próprio. A revisão da Task
  // 29 encontrou exatamente aí um defeito Critical — o colapso das seções novas
  // era gravado e descartado na leitura seguinte, e `collapsed` voltava `{}`
  // sempre, sem erro e sem aviso. Estes casos falam com o repositório REAL.

  /**
   * @param {object} storage
   * @returns {object}
   */
  function repoReal(storage) {
    return LocalStoragePreferencesRepository({ storage });
  }

  test('o colapso de uma seção NOVA sobrevive ao reload (repositório real)', async () => {
    const storage = createMemoryStorage();
    const preferences = repoReal(storage);

    const primeira = sessao({ preferences });
    await primeira.initialize({});
    const aplicado = primeira.setUiState({ collapsed: { 'spells-spellbook': true, 'inventory-load-coins': true } });
    assert.equal(aplicado.ok, true, aplicado.ok ? '' : aplicado.error.code);
    primeira.dispose();

    // "Reload": sessão NOVA sobre um repositório NOVO, os mesmos bytes.
    const segunda = sessao({ preferences: repoReal(storage) });
    const recarregada = await segunda.initialize({});
    assert.equal(recarregada.ok, true, recarregada.ok ? '' : recarregada.error.code);
    assert.equal(recarregada.value.uiState.collapsed['spells-spellbook'], true);
    assert.equal(recarregada.value.uiState.collapsed['inventory-load-coins'], true);
    // Seção não colapsada não vira `true` por tabela de padrão nenhuma.
    assert.notEqual(recarregada.value.uiState.collapsed['summary-combat'], true);
    segunda.dispose();
  });

  test('os bytes gravados carregam os IDs de seção, na chave por ficha', async () => {
    const storage = createMemoryStorage();
    const session = sessao({ preferences: repoReal(storage) });
    await session.initialize({});
    session.setUiState({ collapsed: { 'personal-details': true } });

    const bruto = JSON.parse(storage.getItem(sheetCollapseKey(CHARACTER_ID)));
    assert.equal(bruto['personal-details'], true);
    session.dispose();
  });

  test('gravar o colapso da ficha NOVA não apaga o colapso do monólito legado', async () => {
    // As duas telas escrevem na MESMA chave enquanto o cutover não acontece.
    // Uma substituição completa faria cada lado zerar o painel do outro.
    const storage = createMemoryStorage();
    const preferences = repoReal(storage);
    const legado = preferences.setSheetCollapse(CHARACTER_ID, { mochila: true, truques: false });
    assert.equal(legado.ok, true);

    const session = sessao({ preferences });
    await session.initialize({});
    session.setUiState({ collapsed: { 'spells-spellbook': true } });
    session.dispose();

    const depois = preferences.getSheetCollapse(CHARACTER_ID);
    assert.equal(depois.value.value.mochila, true, 'a chave legada precisa sobreviver');
    assert.equal(depois.value.value.truques, false);
    assert.equal(depois.value.value['spells-spellbook'], true);
  });

  test('as chaves LEGADAS não vazam para o uiState da ficha nova', async () => {
    // O vocabulário de seções é da feature: o que o repositório devolve e ela
    // não reconhece é descartado na entrada, nunca vira uma seção fantasma.
    const storage = createMemoryStorage();
    const preferences = repoReal(storage);
    preferences.setSheetCollapse(CHARACTER_ID, { mochila: true });

    const session = sessao({ preferences });
    const iniciada = await session.initialize({});
    assert.equal(Object.hasOwn(iniciada.value.uiState.collapsed, 'mochila'), false);
    session.dispose();
  });

  test('o colapso continua isolado por ficha com o repositório real', async () => {
    const storage = createMemoryStorage();
    const preferences = repoReal(storage);

    const a = sessao({ preferences, characterId: 'ficha-aaaa-0001' });
    await a.initialize({});
    a.setUiState({ collapsed: { 'inventory-load-coins': true } });
    a.dispose();

    const b = sessao({ preferences, characterId: 'ficha-bbbb-0002' });
    const iniciada = await b.initialize({});
    assert.deepEqual(iniciada.value.uiState.collapsed, {});
    b.dispose();
  });
});

describe('unit/sheet/sheet-session — produtor de spellcasting ausente (Fix round 1)', () => {
  // Achado da revisão independente: `spellcastingTable` era um parâmetro
  // OPCIONAL com default `null`, e a ausência total da porta (nenhuma dica de
  // `projectionContext` também) degradava em SILÊNCIO — os espaços de magia
  // viravam "desconhecidos" sem nada no snapshot avisando o motivo. Estes
  // casos prendem o `AppError` nomeado (`SHEET_SPELLCASTING_PRODUCER_MISSING`)
  // e as três formas de evitá-lo: porta wireada, dica de `projectionContext`,
  // ou personagem sem classe conjuradora (onde o warning NÃO deve aparecer —
  // omissão legítima, ver A.7/C do relatório).
  const CLASS_ID = 'teste:class:conjurador-de-mentira';
  const registryComConjuracao = {
    /** @param {string} id */
    get: (id) => (id === CLASS_ID ? { spellcasting: { ability: 'sabedoria', progression: 'completa' } } : null),
  };

  /**
   * `projectSheet` mínimo: isola o teste da projeção real, que exige um
   * catálogo completo. O que este bloco prende é o comportamento da SESSÃO
   * (`buildContext`/`warnMissingSpellcastingProducer`), não a projeção do
   * ViewModel.
   * @returns {object}
   */
  function projetorMinimo() {
    return ok(Object.freeze({ data: Object.freeze({}), derived: Object.freeze({}) }));
  }

  /**
   * Personagem com classRef apontando para uma classe CONJURADORA (segundo
   * `registryComConjuracao`).
   * @returns {object}
   */
  function personagemConjurador() {
    const base = personagem();
    return Object.freeze({ ...base, build: Object.freeze({ ...base.build, classRef: Object.freeze({ id: CLASS_ID, packageVersion: '1.0.0' }) }) });
  }

  /**
   * @param {object} character
   * @returns {object} repositório falso já com o personagem indicado.
   */
  function repositorioCom(character) {
    return repositorioFalso({
      envelope: Object.freeze({ mode: SHEET_MODE.editable, character, revisionToken: 'rev-0', warnings: [], rawRecord: { id: CHARACTER_ID } }),
    });
  }

  test('classe CONJURADORA sem porta nem dica: warning nomeado, sem crash', async () => {
    const session = sessao({
      repository: repositorioCom(personagemConjurador()),
      registry: registryComConjuracao,
      projectSheet: projetorMinimo,
    });
    const iniciada = await session.initialize({});
    assert.equal(iniciada.ok, true, iniciada.ok ? '' : iniciada.error.code);
    assert.ok(iniciada.value.warnings.some((aviso) => aviso.code === 'SHEET_SPELLCASTING_PRODUCER_MISSING'));
  });

  test('personagem SEM classe conjuradora: nenhum warning (omissão legítima)', async () => {
    const session = sessao({
      repository: repositorioCom(personagem()),
      registry: registryComConjuracao,
      projectSheet: projetorMinimo,
    });
    const iniciada = await session.initialize({});
    assert.equal(iniciada.ok, true, iniciada.ok ? '' : iniciada.error.code);
    assert.equal(
      iniciada.value.warnings.some((aviso) => aviso.code === 'SHEET_SPELLCASTING_PRODUCER_MISSING'),
      false,
    );
  });

  test('dica de projectionContext supre o produtor: nenhum warning', async () => {
    const session = sessao({
      repository: repositorioCom(personagemConjurador()),
      registry: registryComConjuracao,
      projectSheet: projetorMinimo,
      projectionContext: () => ({ maximumHitPoints: 20, spellcasting: { slotMaximums: { 1: 4 } } }),
    });
    const iniciada = await session.initialize({});
    assert.equal(iniciada.ok, true, iniciada.ok ? '' : iniciada.error.code);
    assert.equal(
      iniciada.value.warnings.some((aviso) => aviso.code === 'SHEET_SPELLCASTING_PRODUCER_MISSING'),
      false,
    );
  });

  test('porta spellcastingTable wireada: nenhum warning', async () => {
    const session = sessao({
      repository: repositorioCom(personagemConjurador()),
      registry: registryComConjuracao,
      projectSheet: projetorMinimo,
      spellcastingTable: () =>
        ok({ slotMaximums: { 1: 4 }, cantripsKnown: null, preparedLimit: null, pactSlots: { maximum: null, level: null } }),
    });
    const iniciada = await session.initialize({});
    assert.equal(iniciada.ok, true, iniciada.ok ? '' : iniciada.error.code);
    assert.equal(
      iniciada.value.warnings.some((aviso) => aviso.code === 'SHEET_SPELLCASTING_PRODUCER_MISSING'),
      false,
    );
  });
});
