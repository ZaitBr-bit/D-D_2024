// ============================================================
// DUAS fichas abertas ao mesmo tempo (Task 29).
//
// O `sheet.js` legado guarda o personagem, o cache e o container em variáveis
// de MÓDULO — um singleton. Duas montagens na mesma página (o caso real: abrir
// uma ficha, voltar para a home, abrir outra; ou o harness com duas colunas)
// compartilham tudo, e qualquer callback assíncrono pendente da montagem
// anterior escreve na nova.
//
// Este arquivo prova que a arquitetura nova não tem esse acoplamento. As duas
// sessões usam o MESMO repositório, a MESMA fila e o MESMO repositório de
// preferências — porque é assim no aplicativo real — e ainda assim não
// compartilham personagem, ViewModel, UI state, listeners nem preferências de
// ficha.
// ============================================================
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createTestDom } from '../helpers/test-dom.js';
import { ok } from '../../site/js/core/result.js';
import { createEmptyCharacter } from '../../site/js/domain/character/model.js';
import { createSheetSession } from '../../site/js/features/sheet/sheet-session.js';
import { mountSheet } from '../../site/js/features/sheet/sheet-controller.js';
import { createSectionRegistry } from '../../site/js/features/sheet/sections/section-registry.js';
import { SHEET_SECTION_IDS } from '../../site/js/features/sheet/sheet-state.js';
import { SECTION_ATTRIBUTE } from '../../site/js/features/sheet/sheet-view.js';
import { createPlaceholderSection } from '../e2e/harness/placeholder-sheet-section.js';

const NOW = '2026-08-03T12:00:00.000Z';
const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });
const ID_A = 'ficha-aaaa-0001';
const ID_B = 'ficha-bbbb-0002';

let dom;

beforeEach(() => {
  dom = createTestDom();
});

afterEach(() => {
  dom.restore();
});

/**
 * Personagem canônico com nome e PV próprios.
 * @param {string} id
 * @param {string} name
 * @param {number} current
 * @returns {object}
 */
function personagem(id, name, current) {
  const base = createEmptyCharacter({ id, now: NOW, rulesetRef: RULESET_REF });
  return Object.freeze({
    ...base,
    identity: Object.freeze({ ...base.identity, name }),
    state: Object.freeze({ ...base.state, hitPoints: Object.freeze({ current, temporary: 0 }) }),
    metadata: Object.freeze({ ...base.metadata, createdAt: NOW, updatedAt: NOW }),
  });
}

/**
 * Repositório COMPARTILHADO pelas duas sessões, com dois personagens.
 * @returns {object}
 */
function repositorioCompartilhado() {
  const envelopes = new Map([
    [ID_A, { mode: 'editable', character: personagem(ID_A, 'Alfa', 10), revisionToken: 'a-0', warnings: [], rawRecord: {} }],
    [ID_B, { mode: 'editable', character: personagem(ID_B, 'Beta', 20), revisionToken: 'b-0', warnings: [], rawRecord: {} }],
  ]);
  let contador = 0;
  return {
    envelopes,
    /**
     * @param {string} id
     * @returns {object}
     */
    get(id) {
      return ok(envelopes.get(id) ?? null);
    },
    /**
     * @param {object} character
     * @returns {object}
     */
    save(character) {
      contador += 1;
      const id = character.identity.id;
      const proximo = Object.freeze({ ...envelopes.get(id), character, revisionToken: `${id}-${contador}` });
      envelopes.set(id, proximo);
      return ok(Object.freeze({ envelope: proximo, syncState: 'queued' }));
    },
  };
}

/**
 * Repositório de preferências COMPARTILHADO, com colapso por ficha.
 * @returns {object}
 */
function preferenciasCompartilhadas() {
  const porFicha = new Map();
  return {
    porFicha,
    getCurrencyRates: () => ok({ value: null, warnings: [] }),
    getPurchaseEquippedDefault: () => ok({ value: false, warnings: [] }),
    getLevelUpFlowV2: () => ok({ value: false, warnings: [] }),
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
 * Monta duas fichas na MESMA página, sobre as MESMAS portas.
 * @returns {Promise<object>}
 */
async function montarDuas() {
  const store = repositorioCompartilhado();
  const preferences = preferenciasCompartilhadas();

  /**
   * @param {string} characterId
   * @returns {Promise<object>}
   */
  async function montar(characterId) {
    const container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    const sectionRegistry = createSectionRegistry(SHEET_SECTION_IDS.map((id) => createPlaceholderSection(id).value));
    assert.equal(sectionRegistry.ok, true);
    const session = createSheetSession({
      characterId,
      repository: store,
      durableMutation: store,
      preferences,
      clock: { now: () => NOW },
      projectionContext: () => ({ maximumHitPoints: 30 }),
    });
    const mounted = await mountSheet({ container, session, sectionRegistry: sectionRegistry.value });
    assert.equal(mounted.ok, true, mounted.ok ? '' : mounted.error.code);
    return { container, session, dispose: mounted.value };
  }

  return { store, preferences, a: await montar(ID_A), b: await montar(ID_B) };
}

/**
 * Dispara um clique real.
 * @param {object} element
 * @returns {object}
 */
function clicar(element) {
  const event = new dom.window.Event('click', { bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

/**
 * @returns {Promise<void>}
 */
async function assentar() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('integration/sheet-session-isolation — duas fichas ao mesmo tempo', () => {
  test('cada sessão carrega o SEU personagem', async () => {
    const { a, b } = await montarDuas();
    assert.equal(a.session.getSnapshot().viewModel.data.identity.name, 'Alfa');
    assert.equal(b.session.getSnapshot().viewModel.data.identity.name, 'Beta');
    assert.equal(a.session.getSnapshot().viewModel.derived.hitPoints.current, 10);
    assert.equal(b.session.getSnapshot().viewModel.derived.hitPoints.current, 20);
    assert.equal(a.container.querySelector('[data-placeholder-name]').textContent, 'Alfa');
    assert.equal(b.container.querySelector('[data-placeholder-name]').textContent, 'Beta');
    a.dispose();
    b.dispose();
  });

  test('um comando numa ficha NÃO altera o estado nem o DOM da outra', async () => {
    const { a, b } = await montarDuas();
    const resultado = await a.session.dispatch({ type: 'apply-damage', amount: 4 });
    assert.equal(resultado.ok, true, resultado.ok ? '' : resultado.error.code);
    await assentar();

    assert.equal(a.session.getSnapshot().viewModel.derived.hitPoints.current, 6);
    assert.equal(b.session.getSnapshot().viewModel.derived.hitPoints.current, 20, 'a outra ficha não pode ter mudado');
    assert.equal(a.container.querySelector('[data-placeholder-hp]').textContent, '6');
    assert.equal(b.container.querySelector('[data-placeholder-hp]').textContent, '20');
    a.dispose();
    b.dispose();
  });

  test('o UI state (colapso/foco) é próprio de cada sessão', async () => {
    const { a, b } = await montarDuas();
    clicar(a.container.querySelector('[data-sheet-toggle="spells-spellbook"]'));
    await assentar();

    assert.equal(a.session.getSnapshot().uiState.collapsed['spells-spellbook'], true);
    assert.equal(b.session.getSnapshot().uiState.collapsed['spells-spellbook'], undefined);
    assert.equal(a.container.querySelector(`[${SECTION_ATTRIBUTE}="spells-spellbook"]`).getAttribute('data-collapsed'), 'true');
    assert.equal(b.container.querySelector(`[${SECTION_ATTRIBUTE}="spells-spellbook"]`).getAttribute('data-collapsed'), 'false');
    a.dispose();
    b.dispose();
  });

  test('as preferências de colapso ficam em chaves separadas por ficha', async () => {
    const { a, b, preferences } = await montarDuas();
    a.session.setUiState({ collapsed: { 'inventory-load-coins': true } });
    b.session.setUiState({ collapsed: { 'personal-details': true } });
    assert.deepEqual(preferences.porFicha.get(ID_A), { 'inventory-load-coins': true });
    assert.deepEqual(preferences.porFicha.get(ID_B), { 'personal-details': true });
    a.dispose();
    b.dispose();
  });

  test('os LISTENERS são próprios: um clique numa raiz não alcança a outra', async () => {
    const { a, b } = await montarDuas();
    clicar(a.container.querySelector('[data-placeholder-damage]'));
    await assentar();
    assert.equal(a.session.getSnapshot().viewModel.derived.hitPoints.current, 9);
    assert.equal(b.session.getSnapshot().viewModel.derived.hitPoints.current, 20);
    a.dispose();
    b.dispose();
  });

  test('as ASSINATURAS são próprias: notify de uma sessão não chega à outra', async () => {
    const { a, b } = await montarDuas();
    const vistosA = [];
    const vistosB = [];
    a.session.subscribe(() => vistosA.push(1));
    b.session.subscribe(() => vistosB.push(1));
    await a.session.dispatch({ type: 'apply-damage', amount: 1 });
    assert.equal(vistosA.length, 1);
    assert.equal(vistosB.length, 0);
    a.dispose();
    b.dispose();
  });

  test('descartar UMA sessão não derruba a outra', async () => {
    const { a, b } = await montarDuas();
    a.dispose();
    assert.equal(a.session.isDisposed(), true);
    assert.equal(b.session.isDisposed(), false);

    const resultado = await b.session.dispatch({ type: 'apply-damage', amount: 5 });
    assert.equal(resultado.ok, true, resultado.ok ? '' : resultado.error.code);
    await assentar();
    assert.equal(b.container.querySelector('[data-placeholder-hp]').textContent, '15');

    // E a sessão descartada continua recusando tudo.
    assert.equal((await a.session.dispatch({ type: 'apply-damage', amount: 1 })).error.code, 'SHEET_SESSION_DISPOSED');
    b.dispose();
  });

  test('um carregamento LENTO da ficha A não escreve na ficha B', async () => {
    // O defeito do singleton legado, em forma mínima: A demora, B chega
    // primeiro, e a resposta de A não pode aparecer em lugar nenhum de B.
    const store = repositorioCompartilhado();
    /**
     * @param {string} id
     * @param {number} atraso
     * @returns {object}
     */
    const lento = (id, atraso) => ({
      /**
       * @returns {Promise<object>}
       */
      get() {
        return new Promise((resolve) => setTimeout(() => resolve(store.get(id)), atraso));
      },
      save: (character) => store.save(character),
    });

    const sessionA = createSheetSession({
      characterId: ID_A,
      repository: lento(ID_A, 20),
      durableMutation: store,
      clock: { now: () => NOW },
      projectionContext: () => ({ maximumHitPoints: 30 }),
    });
    const sessionB = createSheetSession({
      characterId: ID_B,
      repository: lento(ID_B, 0),
      durableMutation: store,
      clock: { now: () => NOW },
      projectionContext: () => ({ maximumHitPoints: 30 }),
    });

    const promessaA = sessionA.initialize({});
    const b = await sessionB.initialize({});
    assert.equal(b.ok, true);
    assert.equal(sessionB.getSnapshot().viewModel.data.identity.name, 'Beta');

    const a = await promessaA;
    assert.equal(a.ok, true);
    assert.equal(sessionA.getSnapshot().viewModel.data.identity.name, 'Alfa');
    // B continua sendo B depois de A chegar.
    assert.equal(sessionB.getSnapshot().viewModel.data.identity.name, 'Beta');
    sessionA.dispose();
    sessionB.dispose();
  });
});
