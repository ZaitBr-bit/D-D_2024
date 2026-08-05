// ============================================================
// Integração das DUAS seções da Task 31 — magias/grimório/concentração e
// condições/defesas/sentidos — montadas junto das três da Task 30, sobre o
// controller REAL, a sessão REAL e o catálogo REAL (`dados/pacotes/dnd2024/**`).
//
// Os testes focais provam cada seção em isolamento. O que só aparece com o
// controller de verdade no meio, e é o que este arquivo cobre:
//
//  1. as cinco seções reais convivem no MESMO registro (as duas restantes
//     continuam placeholders até a Task 32);
//  2. o ROTEAMENTO de `AFFECTED_PATH_SECTIONS` acontece de verdade: uma
//     condição suja `conditions-defenses-senses` E `summary-combat`; um espaço
//     de magia suja só `spells-spellbook`; a concentração suja as DUAS seções
//     desta task — e nenhuma outra;
//  3. a TRANSAÇÃO DE MODAL pelo caminho real: cancelar a substituição de
//     concentração deixa o personagem byte a byte como estava (nenhuma escrita
//     no repositório), e confirmar dispara EXATAMENTE UM comando;
//  4. a REABERTURA de um modal com o mesmo `modalId` (semântica que a Task 30
//     introduziu em `sheet-controller.js#openModal`) não vaza estado de
//     formulário entre duas magias — esta é a primeira seção com formulário em
//     modal, e é o cenário que a revisão da Task 30 previu;
//  5. um clique numa seção não derruba os handlers da outra: o listener é um
//     só, delegado na raiz.
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
import { createSpellsSpellbookSection, SPELL_CAST_MODAL_ID, SPELL_FLOW_ACTIONS } from '../../site/js/features/sheet/sections/spells-spellbook-section.js';
import { createConditionsDefensesSensesSection } from '../../site/js/features/sheet/sections/conditions-defenses-senses-section.js';
import { createPlaceholderSection } from '../e2e/harness/placeholder-sheet-section.js';

const NOW = '2026-08-04T12:00:00.000Z';
const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });
const CHARACTER_ID = 'spel-cond-0001';
const MAGO = 'dnd2024:class:mago';
// Duas magias REAIS do catálogo oficial: uma sem concentração e uma COM.
const MISSEIS = 'dnd2024:spell:misseis-magicos';
const TEIA = 'dnd2024:spell:teia';

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

  // Âncora: as duas magias existem no catálogo REAL e têm a mecânica que este
  // arquivo assume. Sem isto, um teste "verde" poderia estar exercitando um id
  // que não resolve — e todo o resto passaria por vacuidade.
  const misseis = registry.get(MISSEIS);
  const teia = registry.get(TEIA);
  assert.equal(misseis?.type, 'spell', `"${MISSEIS}" não está no catálogo`);
  assert.equal(teia?.type, 'spell', `"${TEIA}" não está no catálogo`);
  assert.equal(teia.concentration, true, 'a magia de concentração do teste deixou de ser de concentração');
  assert.equal(misseis.concentration, false, 'a magia sem concentração do teste passou a ser de concentração');
});

beforeEach(() => {
  dom = createTestDom();
});

afterEach(() => {
  dom.restore();
});

/**
 * Mago de nível 5 com duas magias conhecidas e espaços materializados.
 * @param {{concentration?: string|null, conditions?: ReadonlyArray<string>}} [config]
 * @returns {object}
 */
function mago({ concentration = null, conditions = [] } = {}) {
  const base = createEmptyCharacter({ id: CHARACTER_ID, now: NOW, rulesetRef: RULESET_REF });
  return Object.freeze({
    ...base,
    identity: Object.freeze({ ...base.identity, name: 'Elmion' }),
    build: Object.freeze({ ...base.build, classRef: Object.freeze({ id: MAGO, packageVersion: '1.0.0' }) }),
    state: Object.freeze({
      ...base.state,
      level: 5,
      hitPoints: Object.freeze({ current: 20, temporary: 0 }),
      conditions: Object.freeze([...conditions]),
      spells: Object.freeze({
        ...base.state.spells,
        known: Object.freeze([
          Object.freeze({ instanceId: 'sp-1', spellRef: Object.freeze({ id: MISSEIS, packageVersion: '1.0.0' }), customDefinition: null, sourceInstanceId: null }),
          Object.freeze({ instanceId: 'sp-2', spellRef: Object.freeze({ id: TEIA, packageVersion: '1.0.0' }), customDefinition: null, sourceInstanceId: null }),
        ]),
        slots: Object.freeze({ 1: Object.freeze({ used: 0, extra: 0 }), 2: Object.freeze({ used: 0, extra: 0 }) }),
        pactSlots: Object.freeze({ used: 0 }),
        concentration,
      }),
    }),
    metadata: Object.freeze({ ...base.metadata, createdAt: NOW, updatedAt: NOW }),
  });
}

/**
 * Repositório + mutação durável em memória, contando as escritas (é assim que
 * "cancelar não deixa resíduo" é provado: nenhuma escrita acontece).
 * @param {object} character
 * @returns {object}
 */
function persistencia(character) {
  let atual = Object.freeze({ mode: 'editable', character, revisionToken: 'rev-0', warnings: [], rawRecord: {} });
  let revisao = 0;
  const escritas = [];
  return {
    escritas,
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
      escritas.push(revisao);
      atual = Object.freeze({ ...atual, character: proximo, revisionToken: `rev-${revisao}` });
      return ok(Object.freeze({ envelope: atual, syncState: 'queued' }));
    },
  };
}

/**
 * Serviço de modal mínimo com a mesma superfície que o controller consome.
 * Guarda o histórico de aberturas para que a REABERTURA seja observável.
 * @returns {object}
 */
function modalService() {
  const overlay = dom.document.createElement('div');
  overlay.setAttribute('data-modal-overlay', 'true');
  dom.document.body.appendChild(overlay);
  const aberturas = [];
  return {
    overlay,
    aberturas,
    /**
     * @param {{title: string, content: *, actions: *}} params
     * @returns {object}
     */
    open({ title, content, actions }) {
      aberturas.push(String(title ?? ''));
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
 * Monta as sete seções (cinco reais, duas placeholders) sobre o controller real.
 * @param {{character?: object, modal?: object|null}} [params]
 * @returns {Promise<object>}
 */
async function montar({ character = mago(), modal = null } = {}) {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);

  const reais = {
    'summary-combat': createSummaryCombatSection,
    'resources-features': createResourcesFeaturesSection,
    'feats-progression': createFeatsProgressionSection,
    'spells-spellbook': createSpellsSpellbookSection,
    'conditions-defenses-senses': createConditionsDefensesSensesSection,
  };
  const sections = SHEET_SECTION_IDS.map((id) => {
    const criada = reais[id] === undefined ? createPlaceholderSection(id) : reais[id]();
    assert.equal(criada.ok, true, `seção "${id}" inválida: ${criada.error?.code}`);
    return criada.value;
  });
  const registro = createSectionRegistry(sections);
  assert.equal(registro.ok, true, registro.error?.code);

  const store = persistencia(character);
  const prefs = {
    getCurrencyRates: () => ok({ value: null, warnings: [] }),
    getPurchaseEquippedDefault: () => ok({ value: false, warnings: [] }),
    getLevelUpFlowV2: () => ok({ value: false, warnings: [] }),
    setLevelUpFlowV2: () => ok(undefined),
    getSheetCollapse: () => ok({ value: null, warnings: [] }),
    setSheetCollapse: () => ok(undefined),
  };
  const session = createSheetSession({
    characterId: CHARACTER_ID,
    registry,
    officialHandlerInvoker,
    repository: store,
    durableMutation: store,
    preferences: prefs,
    clock: { now: () => NOW },
    // `projectionContext` só carrega DICAS que o composition root conhece.
    // `spellcasting` entra aqui pela mesma razão que `maximumHitPoints`: a
    // tabela de progressão por classe/nível ainda vive no DB legado
    // (`site/js/utils.js#getEspacosMagia`) e não tem produtor na arquitetura
    // nova — ver o achado registrado no relatório da Task 31. Sem ela,
    // `derived.spellSlots.byLevel[n].maximum` é `null` e conjurar por espaço é
    // recusado com `CAST_SPELL_SLOT_MAXIMUM_UNKNOWN`, que é o comportamento
    // CORRETO do domínio (ausência é ausência) e não um defeito desta seção.
    projectionContext: () => ({
      maximumHitPoints: 30,
      spellcasting: { slotMaximums: { 1: 4, 2: 3 }, cantripsKnown: 4, preparedLimit: 6 },
    }),
  });

  const montado = await mountSheet({ container, session, sectionRegistry: registro.value, modal, moduleName: 'features/sheet (integração 31)' });
  assert.equal(montado.ok, true, `mount falhou: ${JSON.stringify(montado.error ?? null)}`);
  return { container, session, store, dispose: montado.value };
}

/**
 * Dispara um clique real no elemento e deixa o microtask do controller rodar.
 * @param {object} element
 * @returns {Promise<void>}
 */
async function clicar(element) {
  assert.ok(element, 'elemento de clique inexistente');
  element.dispatchEvent(new dom.window.Event('click', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('integration/sheet-spells-conditions — as cinco seções reais convivem', () => {
  test('as sete seções são desenhadas, e as duas desta task usam o vocabulário real', async () => {
    const { container, dispose } = await montar();
    try {
      assert.equal(container.querySelectorAll('[data-sheet-section]').length, 7);
      assert.ok(container.querySelector('[data-sheet-section="spells-spellbook"] [data-sheet-spells-spellbook]'));
      assert.ok(container.querySelector('[data-sheet-section="conditions-defenses-senses"] [data-sheet-conditions-defenses-senses]'));
      assert.equal(container.querySelectorAll('.sheet-root').length, 1);
      assert.equal(/\son[a-z]+\s*=/i.test(container.innerHTML), false, 'handler inline no markup');
    } finally {
      dispose();
    }
  });

  test('as magias do personagem chegam à tela com os espaços projetados', async () => {
    const { container, dispose } = await montar();
    try {
      const secao = container.querySelector('[data-sheet-section="spells-spellbook"]');
      assert.ok(secao.querySelector(`[data-sheet-spell="${MISSEIS}"][data-collection="known"]`));
      assert.ok(secao.querySelector(`[data-sheet-spell="${TEIA}"][data-collection="known"]`));
      // Os máximos vêm da dica de projeção, e o disponível é derivado.
      assert.equal(secao.querySelector('[data-sheet-slot-level="1"] [data-sheet-slot-maximum]').textContent, '4');
      assert.equal(secao.querySelector('[data-sheet-slot-level="1"] [data-sheet-slot-available]').textContent, '4');
      assert.equal(secao.querySelector('[data-sheet-cantrips-known]').textContent, '4');
      // CD e ataque de magia vêm de `derived.defenses`, resolvidos pelo
      // catálogo REAL (Inteligência do Mago) — não recalculados na seção.
      assert.notEqual(secao.querySelector('[data-sheet-spell-save-dc]').textContent, '—');
    } finally {
      dispose();
    }
  });
});

describe('integration/sheet-spells-conditions — roteamento real de `AFFECTED_PATH_SECTIONS`', () => {
  test('adicionar condição suja condições E resumo, e só essas', async () => {
    const { container, session, dispose } = await montar();
    try {
      for (const body of container.querySelectorAll('[data-sheet-section-body]')) {
        body.setAttribute('data-marca', 'antes');
      }
      const secao = container.querySelector('[data-sheet-section="conditions-defenses-senses"]');
      secao.querySelector('[data-sheet-condition-input]').value = 'enfeiticado';
      await clicar(secao.querySelector('[data-action="add-condition"]'));

      const snapshot = session.getSnapshot();
      assert.deepEqual([...snapshot.dirtySections], ['summary-combat', 'conditions-defenses-senses']);
      assert.equal(container.querySelectorAll('[data-sheet-section-body][data-marca="antes"]').length, 7);
      assert.deepEqual([...snapshot.viewModel.data.state.conditions], ['enfeiticado']);
      // E o novo markup traz o botão de remover, com o MESMO id — a simetria
      // sobrevive ao rerender parcial.
      assert.ok(
        container.querySelector('[data-action="remove-condition"][data-condition-id="enfeiticado"]'),
        'a condição adicionada precisa ficar removível',
      );
    } finally {
      dispose();
    }
  });

  test('remover a condição desfaz exatamente, pelo caminho real', async () => {
    const { container, session, dispose } = await montar({ character: mago({ conditions: ['caido'] }) });
    try {
      await clicar(container.querySelector('[data-action="remove-condition"][data-condition-id="caido"]'));
      assert.deepEqual([...session.getSnapshot().viewModel.data.state.conditions], []);
      assert.ok(container.querySelector('[data-sheet-conditions-empty]'), 'faltou o estado vazio depois da remoção');
    } finally {
      dispose();
    }
  });

  test('encerrar a concentração suja magias E condições — as duas seções desta task', async () => {
    // `state.spells.concentration` -> `[SPELLS, CONDITIONS]` em
    // `AFFECTED_PATH_SECTIONS`. É a única entrada do mapa que liga as duas
    // seções desta task, e é exercitada aqui pelo caminho real.
    const { container, session, dispose } = await montar({ character: mago({ concentration: TEIA }) });
    try {
      assert.ok(container.querySelector(`[data-sheet-concentration="${TEIA}"]`));
      await clicar(container.querySelector('[data-action="end-concentration"]'));
      const snapshot = session.getSnapshot();
      assert.deepEqual([...snapshot.dirtySections], ['spells-spellbook', 'conditions-defenses-senses']);
      assert.equal(snapshot.viewModel.data.state.spells.concentration, null);
      assert.ok(container.querySelector('[data-sheet-concentration-empty]'));
    } finally {
      dispose();
    }
  });

  test('conjurar por espaço suja SÓ a seção de magias', async () => {
    const { container, session, dispose } = await montar({ modal: modalService() });
    try {
      const secao = container.querySelector('[data-sheet-section="spells-spellbook"]');
      await clicar(secao.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.castOpen}"][data-spell-id="${MISSEIS}"]`));
      const modalRoot = dom.document.querySelector('[data-modal-root]');
      assert.ok(modalRoot, 'o modal de conjuração não abriu');
      for (const radio of modalRoot.querySelectorAll('[data-sheet-cast-slot-source]')) {
        radio.checked = radio.getAttribute('value') === 'spell-slot:1';
      }
      await clicar(modalRoot.querySelector('[data-action="cast-spell"]'));

      const snapshot = session.getSnapshot();
      assert.deepEqual([...snapshot.dirtySections], ['spells-spellbook']);
      assert.equal(snapshot.viewModel.data.state.spells.slots['1'].used, 1);
      assert.equal(
        container.querySelector('[data-sheet-slot-level="1"] [data-sheet-slot-available]').textContent,
        '3',
        'a tela não refletiu o espaço gasto',
      );
    } finally {
      dispose();
    }
  });
});

describe('integration/sheet-spells-conditions — transação de modal pelo caminho real', () => {
  test('CANCELAR a substituição de concentração não escreve nada', async () => {
    const modal = modalService();
    const { container, session, store, dispose } = await montar({ character: mago({ concentration: MISSEIS }), modal });
    try {
      const antes = store.atualCharacter();
      assert.equal(store.escritas.length, 0);

      await clicar(container.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.concentrationOpen}"][data-spell-id="${TEIA}"]`));
      const modalRoot = dom.document.querySelector('[data-modal-root]');
      assert.ok(modalRoot, 'o modal de concentração não abriu');
      assert.equal(modalRoot.querySelector('[data-sheet-concentration-current]').textContent, MISSEIS);

      await clicar(modalRoot.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.concentrationClose}"]`));

      // Nenhuma escrita, nenhuma mudança, e o modal fechado.
      assert.equal(store.escritas.length, 0, 'cancelar gravou algo');
      assert.equal(store.atualCharacter(), antes, 'cancelar trocou o personagem confirmado');
      assert.equal(session.getSnapshot().viewModel.data.state.spells.concentration, MISSEIS);
      assert.equal(dom.document.querySelector('[data-modal-root]'), null, 'o modal não fechou');
    } finally {
      dispose();
    }
  });

  test('CONFIRMAR a substituição dispara EXATAMENTE UM comando', async () => {
    const modal = modalService();
    const { container, session, store, dispose } = await montar({ character: mago({ concentration: MISSEIS }), modal });
    try {
      assert.equal(store.escritas.length, 0);

      await clicar(container.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.concentrationOpen}"][data-spell-id="${TEIA}"]`));
      const modalRoot = dom.document.querySelector('[data-modal-root]');
      await clicar(modalRoot.querySelector('[data-action="set-concentration"]'));

      // A CONTAGEM DE ESCRITAS é a prova de "um comando": a sessão grava uma vez
      // por comando bem-sucedido, então a sequência "encerrar a antiga + começar
      // a nova" produziria DUAS escritas e dois estados intermediários
      // persistidos — incluindo um em que o personagem não está concentrado em
      // nada. Uma só escrita é a evidência de que a troca é atômica.
      assert.equal(store.escritas.length, 1, 'a substituição precisa ser UMA escrita só');
      assert.equal(session.getSnapshot().viewModel.data.state.spells.concentration, TEIA);
      // E o estado final é o da troca completa, não o de um passo intermediário.
      assert.notEqual(session.getSnapshot().viewModel.data.state.spells.concentration, null);
    } finally {
      dispose();
    }
  });

  test('REABRIR o modal de conjuração para outra magia não vaza o formulário', async () => {
    // Cenário previsto pela revisão da Task 30 para quando aparecesse o segundo
    // produtor de modal: `openModal` REABRE (fecha e redesenha) com o mesmo
    // `modalId`. Aqui a reabertura é feita pelo controller REAL.
    const modal = modalService();
    const { container, dispose } = await montar({ modal });
    try {
      const secao = container.querySelector('[data-sheet-section="spells-spellbook"]');

      await clicar(secao.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.castOpen}"][data-spell-id="${MISSEIS}"]`));
      let modalRoot = dom.document.querySelector('[data-modal-root]');
      assert.equal(modalRoot.querySelector('[data-sheet-cast-form]').getAttribute('data-spell-id'), MISSEIS);
      // O jogador escolhe o 2º círculo para a PRIMEIRA magia.
      for (const radio of modalRoot.querySelectorAll('[data-sheet-cast-slot-source]')) {
        radio.checked = radio.getAttribute('value') === 'spell-slot:2';
      }

      // Sem fechar, pede o modal da OUTRA magia — mesmo `modalId`.
      await clicar(secao.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.castOpen}"][data-spell-id="${TEIA}"]`));
      assert.equal(modal.aberturas.length, 2, 'o controller precisa REABRIR, não ignorar o segundo pedido');
      assert.equal(dom.document.querySelectorAll('[data-modal-root]').length, 1, 'sobrou um modal antigo aberto');

      modalRoot = dom.document.querySelector('[data-modal-root]');
      // 1) o formulário é o da magia NOVA;
      assert.equal(modalRoot.querySelector('[data-sheet-cast-form]').getAttribute('data-spell-id'), TEIA);
      // 2) a escolha da magia anterior não sobreviveu — e o formulário novo
      // nasce VIRGEM, sem nenhuma fonte de espaço pré-escolhida pela vista;
      const marcados = [...modalRoot.querySelectorAll('[data-sheet-cast-slot-source]')].filter(
        (no) => no.checked === true || no.hasAttribute('checked'),
      );
      assert.equal(marcados.length, 0, 'o formulário reaberto não pode trazer nenhuma opção marcada');
    } finally {
      dispose();
    }
  });
});

describe('integration/sheet-spells-conditions — um listener só, delegado na raiz', () => {
  test('um clique em magias não derruba os handlers de condições (e vice-versa)', async () => {
    const { container, session, dispose } = await montar({ character: mago({ concentration: TEIA }) });
    try {
      // 1) Age em MAGIAS (redesenha magias e condições).
      await clicar(container.querySelector('[data-action="end-concentration"]'));
      // 2) A seção de CONDIÇÕES, recém-redesenhada, continua respondendo.
      const secao = container.querySelector('[data-sheet-section="conditions-defenses-senses"]');
      secao.querySelector('[data-sheet-condition-input]').value = 'atordoado';
      await clicar(secao.querySelector('[data-action="add-condition"]'));
      assert.deepEqual([...session.getSnapshot().viewModel.data.state.conditions], ['atordoado']);

      // 3) E MAGIAS continua respondendo depois disso.
      await clicar(container.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.concentrationOpen}"][data-spell-id="${TEIA}"]`));
      assert.equal(session.getSnapshot().viewModel.data.state.spells.concentration, TEIA);
    } finally {
      dispose();
    }
  });

  test('o disposer não deixa listener vivo em nenhuma das duas seções', async () => {
    const { container, session, dispose } = await montar();
    try {
      dispose();
      const secao = container.querySelector('[data-sheet-section="conditions-defenses-senses"]');
      if (secao !== null) {
        const campo = secao.querySelector('[data-sheet-condition-input]');
        if (campo !== null) {
          campo.value = 'depois-do-dispose';
        }
        const botao = secao.querySelector('[data-action="add-condition"]');
        if (botao !== null) {
          await clicar(botao);
        }
      }
      assert.deepEqual([...session.getSnapshot().viewModel.data.state.conditions], []);
    } finally {
      // `dispose` é idempotente.
      dispose();
    }
  });

  test('o modal de conjuração declara o dono para que o clique volte à seção certa', async () => {
    const modal = modalService();
    const { container, dispose } = await montar({ modal });
    try {
      await clicar(container.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.castOpen}"][data-spell-id="${MISSEIS}"]`));
      const modalRoot = dom.document.querySelector('[data-modal-root]');
      const donos = [...modalRoot.querySelectorAll('[data-sheet-modal-owner]')].map((no) => no.getAttribute('data-sheet-modal-owner'));
      assert.ok(donos.length >= 2, 'conteúdo e ações precisam declarar o dono');
      assert.deepEqual([...new Set(donos)], ['spells-spellbook']);
      assert.equal(SPELL_CAST_MODAL_ID, 'sheet-spell-cast');
    } finally {
      dispose();
    }
  });
});
