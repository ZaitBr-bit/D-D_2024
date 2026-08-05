// Harness da ficha NOVA: monta `mountSheet` + `SheetSession` numa página
// própria servida só de `tests/e2e/harness`.
//
// Por que um harness em vez de montar na rota real: até a Task 33 a ficha
// pública continua sendo o monólito legado (`site/js/pages/sheet.js`), que a
// Task 29 não toca. O harness dá um navegador REAL para exercitar a
// arquitetura nova — delegação de evento, rerender parcial por
// `dirtySections`, protocolo durável, isolamento entre duas fichas — sem
// cutover, e some quando o cutover acontecer.
//
// As seções são PLACEHOLDERS (as reais chegam nas Tasks 30-32): o objeto aqui
// é o MECANISMO, não o conteúdo. Repositório e fila são em memória; nenhum
// byte de `localStorage` do usuário é tocado.

import { ok, err } from '../../../site/js/core/result.js';
import { createAppContext } from '../../../site/js/app-context.js';
import { createAppError } from '../../../site/js/core/errors.js';
import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import { deriveSourceInstanceId } from '../../../site/js/domain/effects/index.js';
import { createSheetSession } from '../../../site/js/features/sheet/sheet-session.js';
import { mountSheet } from '../../../site/js/features/sheet/sheet-controller.js';
import { createSectionRegistry } from '../../../site/js/features/sheet/sections/section-registry.js';
import { SHEET_SECTION_IDS } from '../../../site/js/features/sheet/sheet-state.js';
import { createModalService } from '../../../site/js/ui/modal.js';
import { createPlaceholderSection } from './placeholder-sheet-section.js';
import { createSummaryCombatSection } from '../../../site/js/features/sheet/sections/summary-combat-section.js';
import { createResourcesFeaturesSection } from '../../../site/js/features/sheet/sections/resources-features-section.js';
import { createFeatsProgressionSection } from '../../../site/js/features/sheet/sections/feats-progression-section.js';
import { createSpellsSpellbookSection } from '../../../site/js/features/sheet/sections/spells-spellbook-section.js';
import { createConditionsDefensesSensesSection } from '../../../site/js/features/sheet/sections/conditions-defenses-senses-section.js';
import { createInventoryLoadCoinsSection } from '../../../site/js/features/sheet/sections/inventory-load-coins-section.js';
import { createPersonalDetailsSection } from '../../../site/js/features/sheet/sections/personal-details-section.js';

/**
 * Seções REAIS já migradas (Tasks 30, 31 e 32). Com as duas últimas
 * (inventário/carga/moedas e detalhes pessoais), o registro do harness passa a
 * ser composto SÓ de seções reais — nenhum placeholder sobra, e
 * `createPlaceholderSection` continua no harness apenas como rede de segurança
 * para um id que porventura fique sem fábrica.
 * @type {Readonly<Record<string, Function>>}
 */
const SECOES_REAIS = Object.freeze({
  'summary-combat': createSummaryCombatSection,
  'resources-features': createResourcesFeaturesSection,
  'feats-progression': createFeatsProgressionSection,
  'spells-spellbook': createSpellsSpellbookSection,
  'conditions-defenses-senses': createConditionsDefensesSensesSection,
  'inventory-load-coins': createInventoryLoadCoinsSection,
  'personal-details': createPersonalDetailsSection,
});

const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });
const NOW = '2026-01-01T00:00:00.000Z';
const BARBARO = 'dnd2024:class:barbaro';
const FURIAS = 'dnd2024:resource:furias';
// `sourceInstanceId` determinístico da fonte `class` índice 0 (Task 15) — o
// mesmo que o handler exige para reconhecer a entrada de recurso como sua.
const FURIAS_SOURCE = deriveSourceInstanceId({ collection: 'class', index: 0, key: BARBARO });
// Magias REAIS do catálogo oficial, para que a seção da Task 31 seja exercitada
// com dado de verdade num navegador: uma SEM concentração e uma COM.
const MISSEIS = 'dnd2024:spell:misseis-magicos';
const TEIA = 'dnd2024:spell:teia';
// Itens REAIS do catálogo oficial, para que a seção da Task 32 seja exercitada
// com peso/custo/categoria de verdade num navegador: um equipado, um na mochila
// e um ESGOTADO (quantidade 0), que é o terceiro grupo do baseline e o único
// que some da tela quando a partição está errada.
const ADAGA = 'dnd2024:weapon:adaga';
const COURO = 'dnd2024:armor:couro';

/**
 * Opções do harness, sobrescrevíveis por `window.__harnessOptions`.
 * @returns {object}
 */
function harnessOptions() {
  const provided = globalThis.__harnessOptions;
  return provided !== null && typeof provided === 'object' ? provided : {};
}

/**
 * Personagem canônico do harness.
 * @param {string} id
 * @param {string} name
 * @param {number} current
 * @returns {object}
 */
function buildCharacter(id, name, current) {
  const base = createEmptyCharacter({ id, now: NOW, rulesetRef: RULESET_REF });
  return Object.freeze({
    ...base,
    // Task 32: detalhes pessoais preenchidos (a seção de detalhes ficaria só no
    // estado vazio sem eles) e um campo com HTML CRU, para que o navegador real
    // prove que o texto do jogador é escapado e não vira markup.
    //
    // O payload NÃO usa `on*=` de propósito: o spec `nenhum handler inline`
    // varre o `innerHTML` cru atrás de ` on...=`, e um `onerror` ESCAPADO no
    // texto o faria falhar por um falso positivo. A prova do payload com
    // handler continua existindo no spec `conteúdo hostil no nome`, que injeta
    // `<img src=x onerror=...>` pelo nome e verifica que nada executa.
    identity: Object.freeze({
      ...base.identity,
      name,
      alignment: 'Caótico Neutro',
      appearance: '<b>markup</b> & "aspas"',
      notes: 'Anotações do harness',
    }),
    // Task 30 (correção da revisão): o personagem do harness passou a ter
    // CLASSE. Antes ele não tinha nenhuma, então `derived.classActions` só
    // podia projetar o estado "indisponível" — e a única cobertura em navegador
    // real da seção mais arriscada desta task era justamente o caminho em que
    // nada aparece. Com um Bárbaro de nível 20 e o recurso de Fúria
    // materializado, as ações de classe são exercitadas de verdade num browser.
    build: Object.freeze({ ...base.build, classRef: Object.freeze({ id: BARBARO, packageVersion: '1.0.0' }) }),
    state: Object.freeze({
      ...base.state,
      level: 20,
      hitPoints: Object.freeze({ current, temporary: 0 }),
      resources: Object.freeze({ [FURIAS]: Object.freeze({ current: 2, sourceInstanceId: FURIAS_SOURCE }) }),
      // Task 31: uma condição ativa e duas magias conhecidas com espaços
      // materializados. Sem isso, a única cobertura em navegador real das duas
      // seções novas seria o estado VAZIO — exatamente o buraco que a revisão
      // da Task 30 apontou para as ações de classe.
      conditions: Object.freeze(['enfeiticado']),
      // Task 32: inventário e carteira REAIS. Os três estados de item existem
      // ao mesmo tempo (equipado, mochila, esgotado) e há um item CUSTOMIZADO
      // com texto livre — o caminho não confiável do renderizador.
      inventory: Object.freeze([
        Object.freeze({
          instanceId: 'inv-1',
          itemRef: Object.freeze({ id: ADAGA, packageVersion: '1.0.0' }),
          customDefinition: null,
          quantity: 2,
          equipped: true,
          expended: 0,
          sourceInstanceId: null,
        }),
        Object.freeze({
          instanceId: 'inv-2',
          itemRef: Object.freeze({ id: COURO, packageVersion: '1.0.0' }),
          customDefinition: null,
          quantity: 1,
          equipped: false,
          expended: 0,
          sourceInstanceId: null,
        }),
        Object.freeze({
          instanceId: 'inv-3',
          itemRef: null,
          customDefinition: Object.freeze({ nome: 'Poção <script>', peso: '0,5 kg', custo: '50 po' }),
          quantity: 0,
          equipped: false,
          expended: 0,
          sourceInstanceId: null,
        }),
      ]),
      wallet: Object.freeze({ pc: 5, pp: 4, pe: 0, po: 12, pl: 1 }),
      spells: Object.freeze({
        ...base.state.spells,
        known: Object.freeze([
          Object.freeze({ instanceId: 'sp-1', spellRef: Object.freeze({ id: MISSEIS, packageVersion: '1.0.0' }), customDefinition: null, sourceInstanceId: null }),
          Object.freeze({ instanceId: 'sp-2', spellRef: Object.freeze({ id: TEIA, packageVersion: '1.0.0' }), customDefinition: null, sourceInstanceId: null }),
        ]),
        slots: Object.freeze({ 1: Object.freeze({ used: 0, extra: 0 }), 2: Object.freeze({ used: 0, extra: 0 }) }),
        pactSlots: Object.freeze({ used: 0 }),
        concentration: null,
      }),
    }),
    metadata: Object.freeze({ ...base.metadata, createdAt: NOW, updatedAt: NOW }),
  });
}

/** @type {Promise<object>|null} */
let runtimePromise = null;

/**
 * Ativa o catálogo oficial UMA vez por página, pelo composition root REAL, e
 * devolve o registro MAIS a porta de invocação de handlers oficiais.
 *
 * A porta é o ponto da correção: `createSheetSession` a recebe como parâmetro
 * NOMEADO (ao lado de `registry`), e não espremida dentro de
 * `projectionContext` — que é canal de "dica" de projeção, não de dependência.
 * @returns {Promise<{registry: object, officialHandlerInvoker: object}>}
 */
async function officialRuntime() {
  if (runtimePromise === null) {
    const appContext = createAppContext();
    runtimePromise = appContext.initializeContent().then((resultado) => {
      if (resultado.ok !== true) {
        throw new Error(`harness: catálogo não ativou: ${resultado.error.code}`);
      }
      return { registry: resultado.value, officialHandlerInvoker: appContext.getOfficialHandlerInvoker() };
    });
  }
  return runtimePromise;
}

/**
 * Repositório + mutação durável EM MEMÓRIA, com token de revisão que muda a
 * cada escrita (é o que torna o `expectedRevisionToken` observável do lado do
 * navegador).
 * @param {object} config
 * @returns {object}
 */
function createMemoryStore(config) {
  const envelopes = new Map();
  let contador = 0;
  /** @type {Array<object>} */
  const escritas = [];
  let falharSave = false;

  /**
   * @param {string} id
   * @param {string} name
   * @param {number} current
   * @returns {void}
   */
  function semear(id, name, current) {
    envelopes.set(
      id,
      Object.freeze({ mode: 'editable', character: buildCharacter(id, name, current), revisionToken: `${id}-0`, warnings: [], rawRecord: {} }),
    );
  }
  semear(config.idA, config.nameA, config.hpA);
  semear(config.idB, config.nameB, config.hpB);

  return {
    escritas,
    /**
     * @param {boolean} valor
     * @returns {void}
     */
    setFalharSave(valor) {
      falharSave = valor;
    },
    /**
     * @param {string} id
     * @returns {object}
     */
    get(id) {
      return ok(envelopes.get(id) ?? null);
    },
    /**
     * @param {object} character
     * @param {{expectedRevisionToken: string|null}} options
     * @returns {object}
     */
    save(character, options) {
      const id = character.identity.id;
      escritas.push({ id, expectedRevisionToken: options?.expectedRevisionToken ?? null });
      if (falharSave) {
        return err(createAppError({ code: 'HARNESS_SAVE_FAILED', scope: 'harness', message: 'Falha local simulada.' }));
      }
      const atual = envelopes.get(id);
      if (atual === undefined || atual.revisionToken !== (options?.expectedRevisionToken ?? null)) {
        return err(createAppError({ code: 'CHARACTER_SAVE_REVISION_CONFLICT', scope: 'harness', message: 'Conflito de revisão.' }));
      }
      contador += 1;
      const proximo = Object.freeze({ ...atual, character, revisionToken: `${id}-${contador}` });
      envelopes.set(id, proximo);
      return ok(Object.freeze({ envelope: proximo, syncState: config.syncState ?? 'queued' }));
    },
  };
}

/**
 * Preferências EM MEMÓRIA com a mesma forma do repositório real
 * (`Result<{value, warnings}>`), com colapso por ficha.
 * @returns {object}
 */
function createMemoryPreferences() {
  const porFicha = new Map();
  // Preferência GRAVÁVEL: o botão "Ativar V2 e continuar" precisa persistir de
  // verdade (o baseline grava no localStorage). Um stub somente-leitura faria o
  // spec passar sobre um botão que parece funcionar e volta atrás no próximo
  // clique — foi assim que o defeito passou pela primeira rodada.
  // `purchaseEquippedDefault` entra aqui pela MESMA razão que `levelUpFlowV2`
  // (Task 32): a caixa "já equipado" do modal de compra é preferência gravável,
  // e um stub somente-leitura provaria um controle que volta atrás no próximo
  // clique.
  const flags = { levelUpFlowV2: false, purchaseEquippedDefault: false };
  return {
    porFicha,
    flags,
    getCurrencyRates: () => ok({ value: null, warnings: [] }),
    getPurchaseEquippedDefault: () => ok({ value: flags.purchaseEquippedDefault, warnings: [] }),
    /**
     * @param {boolean} valor
     * @returns {object}
     */
    setPurchaseEquippedDefault: (valor) => {
      flags.purchaseEquippedDefault = valor === true;
      return ok(undefined);
    },
    getLevelUpFlowV2: () => ok({ value: flags.levelUpFlowV2, warnings: [] }),
    /**
     * @param {boolean} valor
     * @returns {object}
     */
    setLevelUpFlowV2: (valor) => {
      flags.levelUpFlowV2 = valor === true;
      return ok(undefined);
    },
    /**
     * @param {string} id
     * @returns {object}
     */
    getSheetCollapse: (id) => ok({ value: porFicha.get(id) ?? null, warnings: [] }),
    /**
     * @param {string} id
     * @param {object} value
     * @returns {object}
     */
    setSheetCollapse: (id, value) => {
      porFicha.set(id, { ...value });
      return ok(undefined);
    },
  };
}

/**
 * Monta o serviço de modal sobre o markup da página do harness.
 * @returns {object}
 */
function buildModalService() {
  return createModalService({
    documentRef: document,
    overlay: document.getElementById('modal-overlay'),
    container: document.getElementById('modal-container'),
    titleElement: document.getElementById('modal-titulo'),
    bodyElement: document.getElementById('modal-corpo'),
    actionsElement: document.getElementById('modal-acoes'),
    closeButton: document.getElementById('modal-fechar'),
  });
}

/**
 * Monta uma ficha no container indicado.
 * @param {{container: object, characterId: string, store: object, preferences: object}} params
 * @returns {Promise<object>}
 */
export async function mountHarness({ container, characterId, store, preferences, runtime }) {
  const sections = SHEET_SECTION_IDS.map((id) => {
    const fabricaReal = SECOES_REAIS[id];
    const created = fabricaReal === undefined ? createPlaceholderSection(id) : fabricaReal();
    if (created.ok !== true) {
      throw new Error(`harness: seção "${id}" inválida: ${created.error.code}`);
    }
    return created.value;
  });
  const registry = createSectionRegistry(sections);
  if (registry.ok !== true) {
    throw new Error(`harness: registro inválido: ${registry.error.code}`);
  }

  const session = createSheetSession({
    characterId,
    // As duas dependências REAIS da ficha viajam como parâmetros nomeados.
    registry: runtime.registry,
    officialHandlerInvoker: runtime.officialHandlerInvoker,
    repository: store,
    durableMutation: store,
    preferences,
    clock: { now: () => NOW },
    // `projectionContext` volta ao seu papel: só DICAS de projeção.
    // `spellcasting` entra pelo MESMO canal de dicas que `maximumHitPoints`: a
    // tabela de progressão por classe/nível ainda vive no DB legado e não tem
    // produtor na arquitetura nova (achado registrado no relatório da Task 31).
    projectionContext: () => ({
      maximumHitPoints: 30,
      spellcasting: { slotMaximums: { 1: 4, 2: 3 }, cantripsKnown: 4, preparedLimit: 6 },
    }),
  });

  const mounted = await mountSheet({
    container,
    session,
    sectionRegistry: registry.value,
    modal: buildModalService(),
    moduleName: 'features/sheet (harness)',
  });
  if (mounted.ok !== true) {
    throw new Error(`harness: mount falhou: ${mounted.error.code}`);
  }
  return { session, dispose: mounted.value };
}

// --- API exposta ao Playwright -------------------------------------------
//
// Duas montagens SIMULTÂNEAS, em containers distintos, para que o spec possa
// provar no navegador real o que os testes de nó provam em memória: nada vaza
// entre fichas.
globalThis.__sheetHarness = {
  /** @type {Array<{session: object, dispose: Function}>} */
  mounted: [],
  /** @type {object|null} */
  store: null,
  /** @type {object|null} */
  preferences: null,
  /**
   * Monta as duas fichas do harness.
   * @param {object} [options]
   * @returns {Promise<void>}
   */
  async start(options = {}) {
    const config = {
      idA: 'harn-essa-0001',
      idB: 'harn-essb-0002',
      nameA: 'Alfa',
      nameB: 'Beta',
      hpA: 10,
      hpB: 20,
      ...harnessOptions(),
      ...options,
    };
    const runtime = await officialRuntime();
    const store = createMemoryStore(config);
    const preferences = createMemoryPreferences();
    globalThis.__sheetHarness.store = store;
    globalThis.__sheetHarness.preferences = preferences;

    for (const [containerId, characterId] of [
      ['sheet-a', config.idA],
      ['sheet-b', config.idB],
    ]) {
      const mounted = await mountHarness({
        container: document.getElementById(containerId),
        characterId,
        store,
        preferences,
        runtime,
      });
      globalThis.__sheetHarness.mounted.push(mounted);
    }
    document.body.setAttribute('data-harness-ready', 'true');
  },
  /**
   * Snapshot serializável de uma das fichas.
   * @param {number} indice
   * @returns {object}
   */
  snapshot(indice) {
    const snapshot = globalThis.__sheetHarness.mounted[indice].session.getSnapshot();
    return {
      characterId: snapshot.characterId,
      status: snapshot.status,
      mode: snapshot.mode,
      syncState: snapshot.syncState,
      dirtySections: [...snapshot.dirtySections],
      collapsed: { ...snapshot.uiState.collapsed },
      hitPointsCurrent: snapshot.viewModel?.derived?.hitPoints?.current ?? null,
      name: snapshot.viewModel?.data?.identity?.name ?? null,
      failures: snapshot.syncFailures.map((falha) => ({ failureId: falha.failureId, kind: falha.kind, code: falha.code })),
    };
  },
  /**
   * Ordem exata dos `expectedRevisionToken` usados nas escritas — é assim que
   * o spec prova a serialização no navegador real.
   * @returns {Array<object>}
   */
  writes() {
    return globalThis.__sheetHarness.store.escritas.map((entrada) => ({ ...entrada }));
  },
  /**
   * Despacha um comando canônico direto na sessão (sem passar pelo DOM), para
   * o spec conseguir disparar DOIS comandos no mesmo tick.
   * @param {number} indice
   * @param {object} command
   * @returns {Promise<object>}
   */
  async dispatch(indice, command) {
    const resultado = await globalThis.__sheetHarness.mounted[indice].session.dispatch(command);
    return resultado.ok === true
      ? { ok: true, dirtySections: [...resultado.value.dirtySections] }
      : { ok: false, code: resultado.error.code, failureId: resultado.error.context?.failureId ?? null };
  },
  /**
   * Dispara dois comandos no MESMO tick (sem await entre eles).
   * @param {number} indice
   * @param {object} a
   * @param {object} b
   * @returns {Promise<Array<object>>}
   */
  async dispatchConcurrent(indice, a, b) {
    const session = globalThis.__sheetHarness.mounted[indice].session;
    const resultados = await Promise.all([session.dispatch(a), session.dispatch(b)]);
    return resultados.map((resultado) => (resultado.ok === true ? { ok: true } : { ok: false, code: resultado.error.code }));
  },
  /**
   * Liga/desliga a falha de save local do repositório em memória.
   * @param {boolean} valor
   * @returns {void}
   */
  setFalharSave(valor) {
    globalThis.__sheetHarness.store.setFalharSave(valor);
  },
  /**
   * Retenta uma falha registrada pela sessão.
   * @param {number} indice
   * @param {string} failureId
   * @returns {Promise<object>}
   */
  async retry(indice, failureId) {
    const resultado = await globalThis.__sheetHarness.mounted[indice].session.retry(failureId);
    return resultado.ok === true ? { ok: true } : { ok: false, code: resultado.error.code };
  },
  /**
   * Aplica um patch de UI state numa das fichas (é por aqui que o spec liga a
   * preferência "comprar já equipado" sem depender de um botão que a seção não
   * desenha).
   * @param {number} indice
   * @param {object} patch
   * @returns {object}
   */
  setUiState(indice, patch) {
    const resultado = globalThis.__sheetHarness.mounted[indice].session.setUiState(patch);
    return resultado.ok === true ? { ok: true } : { ok: false, code: resultado.error.code };
  },
  /**
   * REMONTA as duas fichas reusando o MESMO store e as MESMAS preferências.
   *
   * É o análogo em navegador do "reload" das preferências legadas: sessões
   * novas, `loadPreferences()` de novo, e o que estiver gravado precisa voltar.
   * Recarregar a página não serviria — store e preferências do harness são em
   * memória e morreriam junto.
   * @returns {Promise<void>}
   */
  async remount() {
    const store = globalThis.__sheetHarness.store;
    const preferences = globalThis.__sheetHarness.preferences;
    const runtime = await officialRuntime();
    for (const mounted of globalThis.__sheetHarness.mounted.splice(0)) {
      mounted.dispose();
    }
    for (const [containerId, characterId] of [
      ['sheet-a', 'harn-essa-0001'],
      ['sheet-b', 'harn-essb-0002'],
    ]) {
      const mounted = await mountHarness({
        container: document.getElementById(containerId),
        characterId,
        store,
        preferences,
        runtime,
      });
      globalThis.__sheetHarness.mounted.push(mounted);
    }
    document.body.setAttribute('data-harness-remounted', 'true');
  },
  /**
   * Preferências VISÍVEIS do lado do navegador, para o spec afirmar o reload.
   * @returns {object}
   */
  preferenceSnapshot() {
    const preferences = globalThis.__sheetHarness.preferences;
    return {
      levelUpFlowV2: preferences.flags.levelUpFlowV2,
      purchaseEquippedDefault: preferences.flags.purchaseEquippedDefault,
      currencyRates: preferences.getCurrencyRates().value.value,
      collapse: {
        a: preferences.porFicha.get('harn-essa-0001') ?? null,
        b: preferences.porFicha.get('harn-essb-0002') ?? null,
      },
    };
  },
  /**
   * Descarta tudo (para testar o disposer).
   * @returns {void}
   */
  disposeAll() {
    for (const mounted of globalThis.__sheetHarness.mounted.splice(0)) {
      mounted.dispose();
    }
    document.body.setAttribute('data-harness-disposed', 'true');
  },
};
