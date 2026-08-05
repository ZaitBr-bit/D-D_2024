// ============================================================
// PROTOCOLO DURÁVEL dos comandos da ficha (Task 29) sobre as peças REAIS das
// Tasks 13/14 (repositório transacional + fila de sincronização + mutação
// durável). Só storage, gateway e relógio são dublês.
//
// A ordem observável, idêntica à aprovada na Task 28 para a finalização do
// criador — o que muda é o gatilho (um comando da ficha em vez de "Finalizar"):
//
//   comando -> PREPARAR intent (job NÃO enviável) -> SALVAR local com o
//   mutationId -> ADOTAR -> CONFIRMAR/enfileirar -> renderizar
//
// Os cenários de falha que este arquivo prende:
//
//   1. comando válido + falha LOCAL -> candidato DESCARTADO, estado confirmado
//      mantido, NENHUMA sync, retry disponível;
//   2. save local OK + enqueue durável -> `dispatch()` termina com o estado
//      adotado, SEM esperar a rede; a falha remota assíncrona chega depois pela
//      subscription da fila, não há rollback e o retry continua disponível;
//   3. save local OK + falha de `confirmPrepared` -> `dispatch()` devolve
//      SUCESSO local com `syncState: "reconciliation-needed"`, adota e
//      renderiza, NUNCA alega sincronização concluída e mantém retry. Recriar
//      sessão/fila promove o intent preparado sem duplicar comando.
// ============================================================
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTestDom } from '../helpers/test-dom.js';
import { createMemoryStorage } from '../helpers/memory-storage.js';
import { ok, err } from '../../site/js/core/result.js';
import { createAppError } from '../../site/js/core/errors.js';
import { createLegacyAliasResolver } from '../../site/js/infra/character/legacy-alias-resolver.js';
import { createPreMigrationBackupService } from '../../site/js/infra/character/pre-migration-backup.js';
import { LocalStorageCharacterRepository } from '../../site/js/infra/character/local-storage-character-repository.js';
import { decodeCharacterRecord } from '../../site/js/infra/character/character-codec.js';
import { createSyncQueue, SYNC_QUEUE_KEY } from '../../site/js/infra/sync/sync-queue.js';
import { createDurableCharacterMutation } from '../../site/js/infra/sync/durable-character-mutation.js';
import { createEmptyCharacter } from '../../site/js/domain/character/model.js';
import { createSheetSession } from '../../site/js/features/sheet/sheet-session.js';
import { SHEET_SYNC_STATES } from '../../site/js/features/sheet/sheet-state.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const NOW = '2026-08-03T12:00:00.000Z';
const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });
const CHARACTER_ID = 'ficha-0001-aaaa';

let dom;
let aliasResolver;

beforeEach(async () => {
  dom = createTestDom();
  if (aliasResolver === undefined) {
    const aliases = JSON.parse(await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'));
    aliasResolver = createLegacyAliasResolver(aliases);
  }
});

afterEach(() => {
  dom.restore();
});

/** Gateway falso: registra os envios e pode ser mandado falhar. */
function fakeGateway({ failUpsert = false } = {}) {
  const calls = [];
  return {
    uid: 'uid-teste',
    calls,
    failUpsert,
    /** @returns {Promise<object>} */
    async list() {
      return ok(Object.freeze([]));
    },
    /**
     * @param {object} envelope
     * @returns {Promise<object>}
     */
    async upsert(envelope) {
      calls.push({ op: 'upsert', characterId: envelope?.character?.identity?.id ?? null });
      if (this.failUpsert) {
        return err(createAppError({ code: 'GATEWAY_UPSERT_FAILED', scope: 'teste', message: 'Falha remota simulada.' }));
      }
      return ok(Object.freeze({ characterId: envelope.character.identity.id, updatedAt: NOW, remoteBackup: 'not-applicable' }));
    },
    /** @returns {Promise<object>} */
    async remove() {
      return ok(undefined);
    },
  };
}

/**
 * Personagem canônico já com PV para os comandos deste arquivo.
 * @returns {object}
 */
function personagem() {
  const base = createEmptyCharacter({ id: CHARACTER_ID, now: NOW, rulesetRef: RULESET_REF });
  return Object.freeze({
    ...base,
    identity: Object.freeze({ ...base.identity, name: 'Thalion' }),
    state: Object.freeze({ ...base.state, hitPoints: Object.freeze({ current: 10, temporary: 0 }) }),
    metadata: Object.freeze({ ...base.metadata, createdAt: NOW, updatedAt: NOW }),
  });
}

/**
 * Compõe a pilha REAL de persistência com um personagem JÁ salvo (é uma ficha
 * existente que a sessão abre, não uma criação).
 * @param {{gateway?: object}} [params]
 * @returns {object}
 */
function pilhaReal({ gateway = fakeGateway() } = {}) {
  const storage = createMemoryStorage();
  const clock = { now: () => NOW };
  const repository = LocalStorageCharacterRepository({
    storage,
    aliasResolver,
    backupService: createPreMigrationBackupService({ storage }),
    clock,
  });
  assert.equal(repository.initialize({}).ok, true);

  const semeado = repository.save(personagem(), { expectedRevisionToken: null, reason: 'user' });
  assert.equal(semeado.ok, true, semeado.ok ? '' : semeado.error.code);

  const syncQueue = createSyncQueue({
    storage,
    gateway,
    characterRepository: repository,
    // Sem conectividade nem scheduler automáticos: o flush é DISPARADO pelo
    // teste, para que a assincronia do envio remoto seja observável.
    connectivity: { isOnline: () => true, subscribe: () => () => {} },
    scheduler: { schedule: () => null, cancel: () => {} },
    codec: { decode: (raw) => decodeCharacterRecord(raw, { aliasResolver, now: NOW }) },
    clock,
  });
  assert.equal(syncQueue.initialize().ok, true);
  return { storage, repository, syncQueue, gateway, clock };
}

/**
 * Cria a sessão sobre as portas indicadas.
 * @param {object} portas
 * @returns {object}
 */
function sessao(portas) {
  return createSheetSession({
    characterId: CHARACTER_ID,
    clock: { now: () => NOW },
    projectionContext: () => ({ maximumHitPoints: 20 }),
    ...portas,
  });
}

describe('integration/sheet-persistence — caminho feliz', () => {
  test('prepara, salva local, adota e confirma — sem esperar a rede', async () => {
    const pilha = pilhaReal();
    const durableMutation = createDurableCharacterMutation({ repository: pilha.repository, syncQueue: pilha.syncQueue });
    const session = sessao({ repository: pilha.repository, syncQueue: pilha.syncQueue, durableMutation });
    assert.equal((await session.initialize({})).ok, true);

    const resultado = await session.dispatch({ type: 'apply-damage', amount: 4 });
    assert.equal(resultado.ok, true, resultado.ok ? '' : resultado.error.code);
    assert.equal(resultado.value.snapshot.syncState, SHEET_SYNC_STATES.queued);
    assert.deepEqual([...resultado.value.dirtySections], ['summary-combat']);

    // ADOTADO: o dano está no repositório local.
    const lido = pilha.repository.get(CHARACTER_ID);
    assert.equal(lido.value.character.state.hitPoints.current, 6);

    // ENVIÁVEL: nenhum job preso em `prepared`.
    const fila = pilha.syncQueue.getSnapshot();
    assert.equal(fila.prepared, 0);
    assert.ok(fila.pending >= 1 || pilha.gateway.calls.length >= 1);

    // O dispatch NÃO esperou a rede — o envio acontece no flush explícito.
    session.dispose();
  });

  test('comandos em sequência usam o expectedRevisionToken adotado pelo anterior', async () => {
    const pilha = pilhaReal();
    const durableMutation = createDurableCharacterMutation({ repository: pilha.repository, syncQueue: pilha.syncQueue });
    const session = sessao({ repository: pilha.repository, syncQueue: pilha.syncQueue, durableMutation });
    await session.initialize({});

    // Disparados no MESMO tick: se o token não fosse reeleito por comando, o
    // segundo bateria em CHARACTER_SAVE_REVISION_CONFLICT.
    const [a, b] = await Promise.all([
      session.dispatch({ type: 'apply-damage', amount: 2 }),
      session.dispatch({ type: 'apply-damage', amount: 3 }),
    ]);
    assert.equal(a.ok, true, a.ok ? '' : a.error.code);
    assert.equal(b.ok, true, b.ok ? '' : b.error.code);
    assert.equal(pilha.repository.get(CHARACTER_ID).value.character.state.hitPoints.current, 5);
    session.dispose();
  });
});

describe('integration/sheet-persistence — cenário 1: comando válido + falha LOCAL', () => {
  test('candidato descartado, estado confirmado mantido, nenhuma sync e retry disponível', async () => {
    const pilha = pilhaReal();
    const durableMutation = createDurableCharacterMutation({
      repository: {
        /** @returns {object} */
        save() {
          return err(createAppError({ code: 'CHARACTER_STORAGE_QUOTA', scope: 'teste', message: 'Storage cheio.' }));
        },
        /** @returns {object} */
        remove() {
          return ok(undefined);
        },
      },
      syncQueue: pilha.syncQueue,
    });
    const session = sessao({ repository: pilha.repository, syncQueue: pilha.syncQueue, durableMutation });
    await session.initialize({});
    const antes = session.getSnapshot().viewModel.derived.hitPoints.current;

    const resultado = await session.dispatch({ type: 'apply-damage', amount: 4 });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CHARACTER_STORAGE_QUOTA');

    // CANDIDATO DESCARTADO: nem o estado da sessão nem o registro mudaram.
    assert.equal(session.getSnapshot().viewModel.derived.hitPoints.current, antes);
    assert.equal(pilha.repository.get(CHARACTER_ID).value.character.state.hitPoints.current, 10);

    // NENHUMA sync: o preparo foi abortado, nada ficou enviável nem pendurado.
    const fila = pilha.syncQueue.getSnapshot();
    assert.equal(fila.pending, 0);
    assert.equal(fila.prepared, 0);
    assert.equal(pilha.gateway.calls.length, 0);

    // RETRY disponível, com identificador.
    const failureId = resultado.error.context.failureId;
    assert.equal(typeof failureId, 'string');
    const falhas = session.getSnapshot().syncFailures;
    assert.ok(falhas.some((falha) => falha.failureId === failureId && falha.retryable === true));
    session.dispose();
  });

  test('o retry redispara o comando sobre o estado CONFIRMADO e conclui quando o local volta', async () => {
    const pilha = pilhaReal();
    let podeFalhar = true;
    const durableMutation = createDurableCharacterMutation({
      repository: {
        /**
         * @param {object} character
         * @param {object} options
         * @returns {object}
         */
        save(character, options) {
          if (podeFalhar) {
            return err(createAppError({ code: 'CHARACTER_STORAGE_QUOTA', scope: 'teste', message: 'Storage cheio.' }));
          }
          return pilha.repository.save(character, options);
        },
        /** @returns {object} */
        remove: (id, options) => pilha.repository.remove(id, options),
      },
      syncQueue: pilha.syncQueue,
    });
    const session = sessao({ repository: pilha.repository, syncQueue: pilha.syncQueue, durableMutation });
    await session.initialize({});

    const falhou = await session.dispatch({ type: 'apply-damage', amount: 4 });
    assert.equal(falhou.ok, false);

    podeFalhar = false;
    const retentado = await session.retry(falhou.error.context.failureId);
    assert.equal(retentado.ok, true, retentado.ok ? '' : retentado.error.code);
    // Aplicado UMA vez só: 10 - 4. O retry não duplicou o dano.
    assert.equal(pilha.repository.get(CHARACTER_ID).value.character.state.hitPoints.current, 6);
    assert.equal(session.getSnapshot().syncFailures.length, 0, 'a falha resolvida sai da lista');
    session.dispose();
  });
});

describe('integration/sheet-persistence — cenário 2: enqueue OK + falha REMOTA assíncrona', () => {
  test('sem rollback: o estado local permanece e a falha vira status/retry da fila', async () => {
    const gateway = fakeGateway({ failUpsert: true });
    const pilha = pilhaReal({ gateway });
    const durableMutation = createDurableCharacterMutation({ repository: pilha.repository, syncQueue: pilha.syncQueue });
    const session = sessao({ repository: pilha.repository, syncQueue: pilha.syncQueue, durableMutation });
    await session.initialize({});

    const resultado = await session.dispatch({ type: 'apply-damage', amount: 4 });
    assert.equal(resultado.ok, true, resultado.ok ? '' : resultado.error.code);
    assert.equal(resultado.value.snapshot.syncState, SHEET_SYNC_STATES.queued);

    // A tentativa remota acontece DEPOIS, pela fila.
    await pilha.syncQueue.flush();

    // Nada de rollback: o estado local continua adotado.
    assert.equal(pilha.repository.get(CHARACTER_ID).value.character.state.hitPoints.current, 6);
    assert.equal(session.getSnapshot().viewModel.derived.hitPoints.current, 6);

    // A falha chegou pela SUBSCRIPTION e está no snapshot da sessão, com retry.
    const falhas = session.getSnapshot().syncFailures.filter((falha) => falha.kind === 'sync');
    assert.ok(falhas.length >= 1, 'a falha remota precisa aparecer no snapshot da sessão');
    assert.equal(falhas[0].characterId, CHARACTER_ID);

    // O retry existe e passa pela fila (o gateway é chamado de novo).
    const antesDoRetry = gateway.calls.length;
    gateway.failUpsert = false;
    const retentado = await session.retry(falhas[0].failureId);
    assert.equal(retentado.ok, true, retentado.ok ? '' : retentado.error.code);
    assert.ok(gateway.calls.length > antesDoRetry);
    session.dispose();
  });
});

// ============================================================
// SAVE/RELOAD por FAMÍLIA de comando (Task 33).
//
// O protocolo durável já era coberto acima com uma família só (`apply-damage`).
// O que faltava — e o que a unificação de saída da Task 33 depende — é a prova
// de que CADA família de comando que a ficha despacha sobrevive a um ciclo
// completo pelo repositório REAL: comando -> save -> reload em sessão NOVA -> o
// valor está lá.
//
// O ciclo com sessão nova é o ponto. Um teste que só reler `session.getSnapshot()`
// provaria apenas que a memória mudou; o defeito que este formato pega é o
// campo que o codec não sabe gravar de volta no registro legado — ele passa
// despercebido enquanto ninguém recarrega, e some no primeiro reload do
// jogador. É o mesmo defeito de classe que a Task 28b encontrou no criador
// ("campo nunca persistido").
// ============================================================
describe('integration/sheet-persistence — save/reload por família de comando', () => {
  /**
   * Despacha um comando, recria a sessão sobre o MESMO repositório e devolve o
   * ViewModel relido — o "reload" do jogador.
   * @param {object} command
   * @param {object|null} [preferences] - porta de preferências (taxas de moeda).
   * @returns {Promise<{antes: object, depois: object}>}
   */
  async function ciclo(command, preferences = null) {
    const pilha = pilhaReal();
    const durableMutation = createDurableCharacterMutation({ repository: pilha.repository, syncQueue: pilha.syncQueue });
    const portas = { repository: pilha.repository, syncQueue: pilha.syncQueue, durableMutation, preferences };
    const primeira = sessao(portas);
    assert.equal((await primeira.initialize({})).ok, true);
    const antes = primeira.getSnapshot().viewModel;

    const despachado = await primeira.dispatch(command);
    assert.equal(despachado.ok, true, despachado.ok ? '' : `${command.type}: ${despachado.error.code}`);
    primeira.dispose();

    // SESSÃO NOVA sobre o mesmo repositório: nada vem da memória anterior.
    const segunda = sessao(portas);
    const relida = await segunda.initialize({});
    assert.equal(relida.ok, true, relida.ok ? '' : relida.error.code);
    const depois = segunda.getSnapshot().viewModel;
    segunda.dispose();
    return { antes, depois };
  }

  test('hit-points: apply-damage sobrevive ao reload', async () => {
    const { antes, depois } = await ciclo({ type: 'apply-damage', amount: 4 });
    assert.equal(antes.derived.hitPoints.current, 10);
    assert.equal(depois.derived.hitPoints.current, 6);
  });

  test('hit-points: grant-temporary-hp sobrevive ao reload', async () => {
    const { depois } = await ciclo({ type: 'grant-temporary-hp', amount: 7 });
    assert.equal(depois.derived.hitPoints.temporary, 7);
  });

  test('condições: add-condition sobrevive ao reload', async () => {
    const { depois } = await ciclo({ type: 'add-condition', conditionId: 'dnd2024:condition:enfeiticado' });
    assert.deepEqual([...depois.data.state.conditions], ['dnd2024:condition:enfeiticado']);
  });

  test('edição manual: edit-character-field (hp.maximum) sobrevive ao reload', async () => {
    const { depois } = await ciclo({ type: 'edit-character-field', path: 'hp.maximum', value: 42 });
    assert.equal(depois.derived.hitPoints.maximum, 42);
    assert.equal(depois.data.overrides['hp.maximum'].value, 42);
  });

  test('edição manual: revert-character-edit devolve o PV máximo à dica de contexto', async () => {
    const pilha = pilhaReal();
    const durableMutation = createDurableCharacterMutation({ repository: pilha.repository, syncQueue: pilha.syncQueue });
    const primeira = sessao({ repository: pilha.repository, syncQueue: pilha.syncQueue, durableMutation });
    await primeira.initialize({});
    assert.equal((await primeira.dispatch({ type: 'edit-character-field', path: 'hp.maximum', value: 42 })).ok, true);
    assert.equal((await primeira.dispatch({ type: 'revert-character-edit', path: 'hp.maximum' })).ok, true);
    primeira.dispose();

    const segunda = sessao({ repository: pilha.repository, syncQueue: pilha.syncQueue, durableMutation });
    const relida = await segunda.initialize({});
    assert.equal(relida.ok, true, relida.ok ? '' : relida.error.code);
    assert.equal(relida.value.viewModel.data.overrides['hp.maximum'], undefined, 'o override precisa sumir do registro');
    assert.equal(relida.value.viewModel.derived.hitPoints.maximum, 20, 'sem override, volta a valer a dica de projeção');
    segunda.dispose();
  });

  test('inventário: add-inventory-item sobrevive ao reload', async () => {
    const { depois } = await ciclo({
      type: 'add-inventory-item',
      instanceId: 'inv-corda-0001',
      customDefinition: { nome: 'Corda de Seda', peso: '2 kg' },
      quantity: 1,
    });
    const itens = depois.data.state.inventory;
    assert.equal(itens.length, 1);
    assert.equal(itens[0].customDefinition.nome, 'Corda de Seda');
  });

  test('carteira: change-wallet sobrevive ao reload', async () => {
    // A tabela de conversão vem da PREFERÊNCIA do usuário (`dnd_taxas_moeda`),
    // como em produção. Sem ela o domínio recusa a operação com
    // `WALLET_CURRENCY_RATES_UNAVAILABLE` — nenhuma tabela padrão é embutida.
    const { depois } = await ciclo(
      { type: 'change-wallet', operation: 'add', denomination: 'po', quantity: 5 },
      { getCurrencyRates: () => ok({ value: { pc: 1, pp: 10, pe: 50, po: 100, pl: 1000 }, warnings: [] }) },
    );
    assert.equal(depois.data.state.wallet.po, 5);
  });

  test('descanso longo: long-rest sobrevive ao reload', async () => {
    const pilha = pilhaReal();
    const durableMutation = createDurableCharacterMutation({ repository: pilha.repository, syncQueue: pilha.syncQueue });
    const primeira = sessao({ repository: pilha.repository, syncQueue: pilha.syncQueue, durableMutation });
    await primeira.initialize({});
    assert.equal((await primeira.dispatch({ type: 'apply-damage', amount: 6 })).ok, true);
    const descansado = await primeira.dispatch({ type: 'long-rest' });
    assert.equal(descansado.ok, true, descansado.ok ? '' : descansado.error.code);
    primeira.dispose();

    const segunda = sessao({ repository: pilha.repository, syncQueue: pilha.syncQueue, durableMutation });
    const relida = await segunda.initialize({});
    assert.equal(relida.ok, true, relida.ok ? '' : relida.error.code);
    // O PV volta ao máximo (a dica de projeção deste arquivo é 20).
    assert.equal(relida.value.viewModel.derived.hitPoints.current, 20);
    segunda.dispose();
  });
});

describe('integration/sheet-persistence — cenário 3: save local OK + falha ao CONFIRMAR', () => {
  /**
   * Fila que PREPARA de verdade (job durável no storage) mas recusa confirmar.
   * @param {object} real
   * @param {{falhar: () => boolean}} controle
   * @returns {object}
   */
  function filaComFalhaNoConfirm(real, controle) {
    return {
      prepareMutation: (params) => real.prepareMutation(params),
      /**
       * @param {string} preparationId
       * @returns {object}
       */
      confirmPrepared(preparationId) {
        if (controle.falhar()) {
          return err(createAppError({ code: 'SYNC_QUEUE_CONFIRM_FAILED', scope: 'teste', message: 'Quota ao regravar a fila.' }));
        }
        return real.confirmPrepared(preparationId);
      },
      abortPrepared: (id) => real.abortPrepared(id),
    };
  }

  test('sucesso LOCAL com reconciliation-needed: adota, renderiza, não alega sync e mantém retry', async () => {
    const pilha = pilhaReal();
    let falhar = true;
    const durableMutation = createDurableCharacterMutation({
      repository: pilha.repository,
      syncQueue: filaComFalhaNoConfirm(pilha.syncQueue, { falhar: () => falhar }),
    });
    const session = sessao({ repository: pilha.repository, syncQueue: pilha.syncQueue, durableMutation });
    await session.initialize({});

    const resultado = await session.dispatch({ type: 'apply-damage', amount: 4 });
    // O SAVE deu certo — o comando NÃO é um erro.
    assert.equal(resultado.ok, true, resultado.ok ? '' : resultado.error.code);
    assert.equal(resultado.value.snapshot.syncState, SHEET_SYNC_STATES.reconciliationNeeded);
    assert.notEqual(resultado.value.snapshot.syncState, SHEET_SYNC_STATES.queued, 'nunca alegar sincronização concluída');

    // ADOTADO e RENDERIZÁVEL.
    assert.equal(resultado.value.snapshot.viewModel.derived.hitPoints.current, 6);
    assert.equal(pilha.repository.get(CHARACTER_ID).value.character.state.hitPoints.current, 6);
    assert.deepEqual([...resultado.value.dirtySections], ['summary-combat']);

    // O job PREPARADO continua durável.
    assert.equal(pilha.syncQueue.getSnapshot().prepared, 1);

    // RETRY: reconcilia o intent preparado, sem regravar o personagem.
    const pendencia = session.getSnapshot().syncFailures.find((falha) => falha.kind === 'reconciliation');
    assert.ok(pendencia, 'a pendência de reconciliação precisa estar no snapshot');
    falhar = false;
    const retentado = await session.retry(pendencia.failureId);
    assert.equal(retentado.ok, true, retentado.ok ? '' : retentado.error.code);
    assert.equal(pilha.syncQueue.getSnapshot().prepared, 0, 'o retry precisa liberar o job preparado');
    // O personagem não foi regravado: continua com um único dano aplicado.
    assert.equal(pilha.repository.get(CHARACTER_ID).value.character.state.hitPoints.current, 6);
    session.dispose();
  });

  test('recriar sessão/fila promove o intent preparado sem duplicar comando', async () => {
    const pilha = pilhaReal();
    const durableMutation = createDurableCharacterMutation({
      repository: pilha.repository,
      syncQueue: filaComFalhaNoConfirm(pilha.syncQueue, { falhar: () => true }),
    });
    const primeira = sessao({ repository: pilha.repository, syncQueue: pilha.syncQueue, durableMutation });
    await primeira.initialize({});
    const resultado = await primeira.dispatch({ type: 'apply-damage', amount: 4 });
    assert.equal(resultado.ok, true);
    primeira.dispose();

    // O intent PREPARADO sobreviveu nos bytes do storage.
    assert.match(String(pilha.storage.getItem(SYNC_QUEUE_KEY)), /"prepared"/);

    // "Reload": fila NOVA sobre o MESMO storage.
    const filaNova = createSyncQueue({
      storage: pilha.storage,
      gateway: pilha.gateway,
      characterRepository: pilha.repository,
      connectivity: { isOnline: () => true, subscribe: () => () => {} },
      scheduler: { schedule: () => null, cancel: () => {} },
      codec: { decode: (raw) => decodeCharacterRecord(raw, { aliasResolver, now: NOW }) },
      clock: pilha.clock,
    });
    assert.equal(filaNova.initialize().ok, true);
    assert.equal(filaNova.reconcilePrepared().ok, true);
    const depois = filaNova.getSnapshot();
    assert.equal(depois.prepared, 0, 'nenhum job pode ficar preso em "prepared" após reconciliar');
    assert.ok(depois.pending >= 1 || pilha.gateway.calls.length >= 1);

    // E o comando não foi duplicado: um único dano no registro.
    const segunda = sessao({ repository: pilha.repository, syncQueue: filaNova, durableMutation });
    const reaberta = await segunda.initialize({});
    assert.equal(reaberta.ok, true);
    assert.equal(reaberta.value.viewModel.derived.hitPoints.current, 6);
    segunda.dispose();
    filaNova.dispose();
  });
});
