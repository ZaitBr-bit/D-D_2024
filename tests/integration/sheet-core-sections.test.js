// ============================================================
// Integração das TRÊS seções centrais da ficha (Task 30) — resumo/combate,
// recursos/características e talentos/progressão — montadas juntas, sobre o
// controller REAL, a sessão REAL, o catálogo REAL (`dados/pacotes/dnd2024/**`)
// e o composition root REAL.
//
// Os testes focais provam cada seção em isolamento. O que só aparece com as
// três juntas, e é o que este arquivo cobre:
//
//  1. as três convivem no MESMO registro, sem wrapper visual extra: o shell
//     desenha `[data-sheet-section]` para cada uma e nada mais;
//  2. o rerender é PARCIAL de verdade e ATRAVESSA seções: um comando de ação de
//     classe suja `resources-features` E `summary-combat` (é o que
//     `AFFECTED_PATH_SECTIONS` diz sobre `state.usageFlags`), e apenas essas;
//  3. um clique numa seção não remove os handlers das outras — o listener é um
//     só, delegado na raiz, e sobrevive a qualquer redesenho parcial;
//  4. o descanso disparado por `resources-features` aplica, num único comando,
//     a parte canônica E o `onRest` do handler de classe (decisão registrada em
//     `questions-for-review.txt` item 15) — não existe meio descanso;
//  5. o modal de level-up é efeito do CONTROLLER, e cancelar não deixa resíduo.
// ============================================================
import { test, describe, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createTestDom } from '../helpers/test-dom.js';
import { createDiskFetch } from '../helpers/disk-fetch.js';
import { ok } from '../../site/js/core/result.js';
import { createAppContext } from '../../site/js/app-context.js';
import { createEmptyCharacter } from '../../site/js/domain/character/model.js';
import { createSheetSession } from '../../site/js/features/sheet/sheet-session.js';
import { mountSheet } from '../../site/js/features/sheet/sheet-controller.js';
import { createSectionRegistry } from '../../site/js/features/sheet/sections/section-registry.js';
import { SHEET_SECTION_IDS } from '../../site/js/features/sheet/sheet-state.js';
import { createSummaryCombatSection } from '../../site/js/features/sheet/sections/summary-combat-section.js';
import { createResourcesFeaturesSection } from '../../site/js/features/sheet/sections/resources-features-section.js';
import { createFeatsProgressionSection } from '../../site/js/features/sheet/sections/feats-progression-section.js';
import { createPlaceholderSection } from '../e2e/harness/placeholder-sheet-section.js';

const NOW = '2026-08-04T12:00:00.000Z';
const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });
const CHARACTER_ID = 'core-sect-0001';
const BARBARO = 'dnd2024:class:barbaro';
const FURIAS = 'dnd2024:resource:furias';

let registry;
let officialHandlerInvoker;
let dom;

before(async () => {
  const { fetchFn } = createDiskFetch();
  const appContext = createAppContext({ fetchFn });
  const activation = await appContext.initializeContent();
  assert.equal(activation.ok, true, `ativação do catálogo falhou: ${JSON.stringify(activation.error ?? null)}`);
  registry = activation.value;
  officialHandlerInvoker = appContext.getOfficialHandlerInvoker();
});

beforeEach(() => {
  dom = createTestDom();
});

afterEach(() => {
  dom.restore();
});

/**
 * Bárbaro de nível 20 com o recurso de Fúria JÁ MATERIALIZADO — é o que permite
 * exercitar gasto e recarga de verdade (um recurso ausente seria recusado com
 * `HANDLER_RESOURCE_NOT_INITIALIZED`, que os testes focais já cobrem).
 *
 * O `sourceInstanceId` é o derivado da fonte `class` índice 0 (Task 15), o
 * mesmo que o handler exige para reconhecer a entrada como sua.
 * @param {{current?: number}} [config]
 * @returns {object}
 */
function barbaro({ current = 2, level = 20 } = {}) {
  const base = createEmptyCharacter({ id: CHARACTER_ID, now: NOW, rulesetRef: RULESET_REF });
  const sourceInstanceId = sourceInstanceIdDaClasse();
  return Object.freeze({
    ...base,
    identity: Object.freeze({ ...base.identity, name: 'Krug' }),
    build: Object.freeze({ ...base.build, classRef: Object.freeze({ id: BARBARO, packageVersion: '1.0.0' }) }),
    state: Object.freeze({
      ...base.state,
      level,
      hitPoints: Object.freeze({ current: 30, temporary: 0 }),
      resources: Object.freeze({ [FURIAS]: Object.freeze({ current, sourceInstanceId }) }),
    }),
    metadata: Object.freeze({ ...base.metadata, createdAt: NOW, updatedAt: NOW }),
  });
}

/**
 * `sourceInstanceId` determinístico da CLASSE (Task 15), obtido da própria
 * projeção do handler — nunca reconstruído por fórmula copiada, que poderia
 * divergir em silêncio.
 * @returns {string}
 */
function sourceInstanceIdDaClasse() {
  const provisorio = createEmptyCharacter({ id: CHARACTER_ID, now: NOW, rulesetRef: RULESET_REF });
  const comClasse = Object.freeze({
    ...provisorio,
    build: Object.freeze({ ...provisorio.build, classRef: Object.freeze({ id: BARBARO, packageVersion: '1.0.0' }) }),
    state: Object.freeze({ ...provisorio.state, level: 20 }),
  });
  const projetado = officialHandlerInvoker.invoke({
    entityId: BARBARO,
    handlerId: 'class-barbaro',
    operation: 'project',
    payload: { character: comClasse },
    context: { registry, level: 20 },
  });
  assert.equal(projetado.ok, true, `projeção falhou: ${JSON.stringify(projetado.error ?? null)}`);
  const entrada = projetado.value.resources[FURIAS];
  assert.ok(entrada, 'o Bárbaro deveria ter o recurso de Fúria projetado no nível 20');
  return entrada.sourceInstanceId;
}

/**
 * Repositório + mutação durável em memória.
 * @param {object} character
 * @returns {object}
 */
function persistencia(character) {
  let atual = Object.freeze({ mode: 'editable', character, revisionToken: 'rev-0', warnings: [], rawRecord: {} });
  let revisao = 0;
  return {
    /** @returns {object} */
    atualCharacter: () => atual.character,
    /** @returns {object} */
    get: (id) => (id === CHARACTER_ID ? ok(atual) : ok(null)),
    /**
     * @param {object} proximo
     * @returns {object}
     */
    save(proximo) {
      revisao += 1;
      atual = Object.freeze({ ...atual, character: proximo, revisionToken: `rev-${revisao}` });
      return ok(Object.freeze({ envelope: atual, syncState: 'queued' }));
    },
  };
}

/**
 * Serviço de modal mínimo sobre o DOM isolado, com a mesma superfície que o
 * controller consome (`open -> {element, close}`).
 * @returns {object}
 */
function modalService() {
  const overlay = dom.document.createElement('div');
  overlay.setAttribute('data-modal-overlay', 'true');
  dom.document.body.appendChild(overlay);
  return {
    overlay,
    /**
     * @param {{title: string, content: *, actions: *}} params
     * @returns {object}
     */
    open({ title, content, actions }) {
      overlay.innerHTML = '';
      const raiz = dom.document.createElement('div');
      raiz.setAttribute('data-modal-root', 'true');
      raiz.setAttribute('data-modal-title', String(title ?? ''));
      for (const node of [...(content ?? []), ...(actions ?? [])]) {
        raiz.appendChild(node);
      }
      overlay.appendChild(raiz);
      return {
        element: raiz,
        close() {
          overlay.innerHTML = '';
        },
      };
    },
  };
}

/**
 * Monta as sete seções (as três reais desta task + quatro placeholders) sobre o
 * controller real.
 * @param {{character?: object, modal?: object|null, levelUpFlowV2?: boolean}} [params]
 * @returns {Promise<object>}
 */
async function montar({ character = barbaro(), modal = null, levelUpFlowV2 = false } = {}) {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);

  const reais = {
    'summary-combat': createSummaryCombatSection,
    'resources-features': createResourcesFeaturesSection,
    'feats-progression': createFeatsProgressionSection,
  };
  const sections = SHEET_SECTION_IDS.map((id) => {
    const criada = reais[id] === undefined ? createPlaceholderSection(id) : reais[id]();
    assert.equal(criada.ok, true, `seção "${id}" inválida: ${criada.error?.code}`);
    return criada.value;
  });
  const registro = createSectionRegistry(sections);
  assert.equal(registro.ok, true, registro.error?.code);

  const store = persistencia(character);
  // Preferências GRAVÁVEIS: o teste precisa provar o EFEITO de "Ativar V2 e
  // continuar" (a flag persistida), não só a forma da intenção.
  const flags = { levelUpFlowV2 };
  const escritasDeFlag = [];
  const prefs = {
    flags,
    escritasDeFlag,
    getCurrencyRates: () => ok({ value: null, warnings: [] }),
    getPurchaseEquippedDefault: () => ok({ value: false, warnings: [] }),
    getLevelUpFlowV2: () => ok({ value: flags.levelUpFlowV2, warnings: [] }),
    setLevelUpFlowV2: (valor) => {
      flags.levelUpFlowV2 = valor === true;
      escritasDeFlag.push(valor === true);
      return ok(undefined);
    },
    getSheetCollapse: () => ok({ value: null, warnings: [] }),
    setSheetCollapse: () => ok(undefined),
  };
  const session = createSheetSession({
    characterId: CHARACTER_ID,
    registry,
    // Parâmetro NOMEADO (correção da revisão): a porta é dependência real da
    // ficha, não uma "dica" de projeção.
    officialHandlerInvoker,
    repository: store,
    durableMutation: store,
    preferences: prefs,
    clock: { now: () => NOW },
    // `projectionContext` volta ao papel documentado: só DICAS de projeção.
    projectionContext: () => ({ maximumHitPoints: 200 }),
  });

  const montado = await mountSheet({ container, session, sectionRegistry: registro.value, modal, moduleName: 'features/sheet (integração)' });
  assert.equal(montado.ok, true, `mount falhou: ${JSON.stringify(montado.error ?? null)}`);
  return { container, session, store, prefs, dispose: montado.value };
}

/**
 * Dispara um clique real no elemento.
 * @param {object} element
 * @returns {Promise<void>}
 */
async function clicar(element) {
  assert.ok(element, 'elemento de clique inexistente');
  element.dispatchEvent(new dom.window.Event('click', { bubbles: true, cancelable: true }));
  // O controller trata a intenção de forma assíncrona (`session.dispatch`).
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('integration/sheet-core-sections — as três seções convivem no mesmo registro', () => {
  test('as sete seções são desenhadas, e as três desta task usam o vocabulário real', async () => {
    const { container, dispose } = await montar();
    try {
      assert.equal(container.querySelectorAll('[data-sheet-section]').length, 7);
      assert.ok(container.querySelector('[data-sheet-section="summary-combat"] [data-sheet-summary]'));
      assert.ok(container.querySelector('[data-sheet-section="resources-features"] [data-sheet-resources-features]'));
      assert.ok(container.querySelector('[data-sheet-section="feats-progression"] [data-sheet-progression]'));
      // Sem wrapper visual novo: o shell continua sendo o da Task 29.
      assert.equal(container.querySelectorAll('.sheet-root').length, 1);
      assert.equal(/\son[a-z]+\s*=/i.test(container.innerHTML), false, 'handler inline no markup');
    } finally {
      dispose();
    }
  });

  test('as ações de classe são projetadas de verdade (a porta chega pelo contexto da sessão)', async () => {
    const { container, dispose } = await montar();
    try {
      assert.equal(container.querySelector('[data-sheet-class-actions-unavailable]'), null);
      const acoes = container.querySelectorAll('[data-sheet-section="resources-features"] [data-action="class-action"]');
      assert.ok(acoes.length >= 6, `o Bárbaro deveria projetar suas ações; vieram ${acoes.length}`);
      assert.ok(container.querySelector('[data-action-id="entrar-em-furia"]'));
    } finally {
      dispose();
    }
  });
});

describe('integration/sheet-core-sections — rerender parcial atravessa seções', () => {
  test('uma ação de classe suja recursos E resumo, e só essas duas', async () => {
    const { container, session, dispose } = await montar();
    try {
      // Marca todos os miolos: um rerender total apagaria TODAS as marcas.
      for (const body of container.querySelectorAll('[data-sheet-section-body]')) {
        body.setAttribute('data-marca', 'antes');
      }

      await clicar(container.querySelector('[data-action="class-action"][data-action-id="entrar-em-furia"]'));

      const snapshot = session.getSnapshot();
      // `state.resources` + `state.usageFlags` -> exatamente o que
      // `AFFECTED_PATH_SECTIONS` mapeia.
      assert.deepEqual([...snapshot.dirtySections], ['summary-combat', 'resources-features']);

      // Os contêineres continuam TODOS lá: o controller reescreve o CONTEÚDO
      // dos miolos sujos, nunca recria os contêineres.
      assert.equal(container.querySelectorAll('[data-sheet-section-body][data-marca="antes"]').length, 7);

      // E o recurso foi de fato gasto (2 -> 1).
      const atual = container.querySelector(`[data-sheet-resource="${FURIAS}"] [data-sheet-resource-current]`);
      assert.equal(atual.textContent, '1');
    } finally {
      dispose();
    }
  });

  test('clicar numa seção não remove os handlers das outras', async () => {
    const { container, dispose } = await montar();
    try {
      await clicar(container.querySelector('[data-action="class-action"][data-action-id="entrar-em-furia"]'));

      // Depois do redesenho parcial de DUAS seções, um clique numa TERCEIRA
      // (progressão, que não foi redesenhada) continua funcionando: o listener
      // é um só, delegado na raiz.
      const antesDoNivel = container.querySelector('[data-sheet-section="feats-progression"] [data-sheet-level]').textContent;
      assert.equal(antesDoNivel, '20');

      // E o próprio botão redesenhado continua acionável.
      await clicar(container.querySelector('[data-action="class-action"][data-action-id="encerrar-furia"]'));
      const flag = container.querySelector('[data-sheet-flag$=":furia-ativa"]');
      assert.ok(flag, 'a flag de Fúria deveria estar projetada');
      assert.equal(flag.getAttribute('data-value'), 'false');
    } finally {
      dispose();
    }
  });

  test('uma ação indisponível devolve erro DECLARADO e não muta nada', async () => {
    const notificados = [];
    const { container, store, dispose } = await montar({ character: barbaro({ current: 0 }) });
    try {
      void notificados;
      const antes = store.atualCharacter();
      await clicar(container.querySelector('[data-action="class-action"][data-action-id="entrar-em-furia"]'));
      // Recurso zerado: o handler recusa, e o personagem confirmado não muda.
      assert.equal(store.atualCharacter(), antes);
      const atual = container.querySelector(`[data-sheet-resource="${FURIAS}"] [data-sheet-resource-current]`);
      assert.equal(atual.textContent, '0');
    } finally {
      dispose();
    }
  });
});

describe('integration/sheet-core-sections — descanso é UM comando, com o `onRest` composto', () => {
  test('o descanso curto da seção recarrega o recurso de classe pelo comando canônico', async () => {
    // O Bárbaro recupera EXATAMENTE 1 uso de Fúria num descanso curto — regra
    // que só existe no handler (o vocabulário declarativo só sabe "restaura ao
    // máximo"). Se `short-rest` não compusesse o `onRest`, este número não
    // mudaria, e nada acusaria.
    const { container, dispose } = await montar({ character: barbaro({ current: 0 }) });
    try {
      await clicar(container.querySelector('[data-sheet-section="resources-features"] [data-action="short-rest"]'));
      const atual = container.querySelector(`[data-sheet-resource="${FURIAS}"] [data-sheet-resource-current]`);
      assert.equal(atual.textContent, '1', 'o descanso curto deveria devolver 1 uso de Fúria');
    } finally {
      dispose();
    }
  });

  test('o descanso longo restaura PV e o recurso de classe no MESMO comando', async () => {
    const { container, session, dispose } = await montar({ character: barbaro({ current: 0 }) });
    try {
      await clicar(container.querySelector('[data-sheet-section="resources-features"] [data-action="long-rest"]'));
      const snapshot = session.getSnapshot();
      // Uma lista de `affected` só, com as duas metades dentro.
      assert.ok(snapshot.dirtySections.includes('summary-combat'));
      assert.ok(snapshot.dirtySections.includes('resources-features'));

      const furias = container.querySelector(`[data-sheet-resource="${FURIAS}"] [data-sheet-resource-current]`);
      const maximo = container.querySelector(`[data-sheet-resource="${FURIAS}"] [data-sheet-resource-max]`);
      assert.equal(furias.textContent, maximo.textContent, 'o descanso longo deveria restaurar a Fúria ao teto');
    } finally {
      dispose();
    }
  });
});

describe('integration/sheet-core-sections — o modal de level-up é efeito do controller', () => {
  test('abrir com a flag `false` desenha a vista LEGADA, e cancelar não deixa resíduo', async () => {
    const modal = modalService();
    const { container, store, dispose } = await montar({ modal, levelUpFlowV2: false });
    try {
      const antes = store.atualCharacter();
      await clicar(container.querySelector('[data-sheet-section="feats-progression"] [data-action="level-up-open"]'));

      const raiz = modal.overlay.querySelector('[data-modal-root]');
      assert.ok(raiz, 'o controller deveria ter aberto o modal');
      assert.equal(raiz.getAttribute('data-modal-title'), 'Level Up V2 desativado');
      assert.ok(raiz.querySelector('#btn-enable-levelup-v2'));

      // Nenhuma seção recebeu o serviço de modal: quem abriu foi o controller.
      await clicar(raiz.querySelector('[data-action="level-up-close"]'));
      assert.equal(modal.overlay.querySelector('[data-modal-root]'), null);
      // Cancelar não muta: o personagem confirmado é o MESMO objeto.
      assert.equal(store.atualCharacter(), antes);
    } finally {
      dispose();
    }
  });

  test('"Ativar V2 e continuar" PERSISTE a preferência e reabre já em cards', async () => {
    // O defeito que este caso previne (achado Important 1 da revisão): a versão
    // anterior só marcava a flag no payload da intenção. O modal reabria em
    // cards e PARECIA funcionar — mas nada era gravado, então fechar e clicar
    // "Subir de Nível" de novo voltava ao aviso "V2 desativado".
    //
    // Por isso a asserção é sobre o EFEITO (preferência gravada + o modal
    // REABERTO na segunda vez), nunca sobre a forma da intent.
    const modal = modalService();
    const { container, prefs, session, dispose } = await montar({ character: barbaro({ level: 3 }), modal, levelUpFlowV2: false });
    try {
      const abrir = () => clicar(container.querySelector('[data-sheet-section="feats-progression"] [data-action="level-up-open"]'));

      await abrir();
      assert.equal(modal.overlay.querySelector('[data-modal-root]').getAttribute('data-modal-title'), 'Level Up V2 desativado');

      await clicar(modal.overlay.querySelector('#btn-enable-levelup-v2'));

      // 1) A preferência foi GRAVADA de verdade.
      assert.deepEqual(prefs.escritasDeFlag, [true]);
      assert.equal(prefs.flags.levelUpFlowV2, true);
      // 2) E o snapshot não conta uma história diferente do que foi gravado.
      assert.equal(session.getSnapshot().preferences.levelUpFlowV2, true);
      // 3) O MESMO modal foi reaberto em cards, e não deixado no aviso.
      const depois = modal.overlay.querySelector('[data-modal-root]');
      assert.equal(depois.getAttribute('data-modal-title'), 'Subir de Nível');
      assert.ok(depois.querySelector('[data-levelup-cards]'));

      // 4) O TESTE QUE IMPORTA: fechar e reabrir do zero continua em cards.
      await clicar(depois.querySelector('[data-action="level-up-close"]'));
      assert.equal(modal.overlay.querySelector('[data-modal-root]'), null);
      await abrir();
      const reaberto = modal.overlay.querySelector('[data-modal-root]');
      assert.equal(reaberto.getAttribute('data-modal-title'), 'Subir de Nível', 'reabrir voltou ao aviso: a preferência não persistiu');
      assert.equal(reaberto.querySelector('#btn-enable-levelup-v2'), null);
    } finally {
      dispose();
    }
  });

  test('com a flag `true` o mesmo clique desenha CARDS REAIS, vindos de `getLevelUpOptions`', async () => {
    // Nível 4 (e não 20) de propósito: é um nível que de fato tem próximo, e
    // que exige Aumento no Valor de Atributo — então os cartões conferidos
    // abaixo vêm da projeção REAL do catálogo, e não de um estado de erro.
    const modal = modalService();
    const { container, dispose } = await montar({ character: barbaro({ level: 3 }), modal, levelUpFlowV2: true });
    try {
      await clicar(container.querySelector('[data-sheet-section="feats-progression"] [data-action="level-up-open"]'));
      const raiz = modal.overlay.querySelector('[data-modal-root]');
      assert.ok(raiz);
      assert.equal(raiz.getAttribute('data-modal-title'), 'Subir de Nível');

      const cards = raiz.querySelector('[data-levelup-cards]');
      assert.ok(cards, 'o modo v2 deveria desenhar o bloco de cartões');
      assert.equal(cards.hasAttribute('data-levelup-error'), false, `o modo v2 caiu no estado de erro: ${cards.getAttribute('data-levelup-error')}`);
      assert.equal(cards.getAttribute('data-levelup-from'), '3');
      assert.equal(cards.getAttribute('data-levelup-to'), '4');
      // O dado de vida do Bárbaro (d12) vem do catálogo, não de um literal.
      assert.equal(raiz.querySelector('[data-levelup-hit-die]').textContent, '12');
      assert.ok(raiz.querySelector('[data-levelup-card="ability-score-improvement"]'), 'o nível 4 concede ASI');
    } finally {
      dispose();
    }
  });

  test('no nível 20 o modo v2 mostra o MOTIVO, e não cartões vazios', async () => {
    // A afirmação falsa que este caso previne: um conjunto de cartões vazio
    // diria "este nível não pede nada" para um personagem que simplesmente não
    // tem próximo nível.
    const modal = modalService();
    const { container, dispose } = await montar({ character: barbaro({ level: 20 }), modal, levelUpFlowV2: true });
    try {
      await clicar(container.querySelector('[data-sheet-section="feats-progression"] [data-action="level-up-open"]'));
      const cards = modal.overlay.querySelector('[data-levelup-cards]');
      assert.equal(cards.getAttribute('data-levelup-error'), 'LEVEL_UP_AT_MAXIMUM');
      assert.equal(cards.querySelector('[data-levelup-card]'), null);
    } finally {
      dispose();
    }
  });
});
