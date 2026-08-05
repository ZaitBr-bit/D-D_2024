// ============================================================
// Controller da ficha (Task 29) sobre um DOM isolado (LinkeDOM).
//
// O que só se prova com DOM:
//
//  - UM único conjunto de listeners DELEGADOS na raiz, que não se multiplica a
//    cada rerender (o defeito clássico do `sheet.js` legado, que reatribui
//    handlers a cada redesenho);
//  - RERENDER PARCIAL de verdade: um comando que suja uma seção reescreve
//    APENAS o miolo dela; os contêineres das outras seções preservam
//    identidade de nó;
//  - `preventDefault`/`stopPropagation` aplicados pelo CONTROLLER a partir da
//    `UiEventDecision` — a seção nunca toca no evento;
//  - nenhuma seção registra listener próprio nem recebe o serviço de modal;
//  - o modal é efeito do controller, com delegação própria (o overlay é irmão
//    do container, não descendente — sem isso o corpo do modal seria markup
//    morto);
//  - o disposer é idempotente e não deixa listener vivo;
//  - `render` de conteúdo HOSTIL nunca devolve o payload cru.
// ============================================================
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createTestDom } from '../helpers/test-dom.js';
import { ok, err } from '../../site/js/core/result.js';
import { createAppError } from '../../site/js/core/errors.js';
import { createEmptyCharacter } from '../../site/js/domain/character/model.js';
import { createSheetSession } from '../../site/js/features/sheet/sheet-session.js';
import { mountSheet } from '../../site/js/features/sheet/sheet-controller.js';
import { createSectionRegistry, createSheetSection } from '../../site/js/features/sheet/sections/section-registry.js';
import { SHEET_INTENT_TYPES, SHEET_SECTION_IDS } from '../../site/js/features/sheet/sheet-state.js';
import { SECTION_ATTRIBUTE } from '../../site/js/features/sheet/sheet-view.js';
import { createUiEventDecision } from '../../site/js/ui/event-delegation.js';
import { createPlaceholderSection } from '../e2e/harness/placeholder-sheet-section.js';

const NOW = '2026-08-03T12:00:00.000Z';
const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });
const CHARACTER_ID = 'ficha-0001-aaaa';

let dom;

beforeEach(() => {
  dom = createTestDom();
});

afterEach(() => {
  dom.restore();
});

/**
 * Personagem canônico mínimo.
 * @param {{name?: string, current?: number}} [config]
 * @returns {object}
 */
function personagem({ name = 'Thalion', current = 10 } = {}) {
  const base = createEmptyCharacter({ id: CHARACTER_ID, now: NOW, rulesetRef: RULESET_REF });
  return Object.freeze({
    ...base,
    identity: Object.freeze({ ...base.identity, name }),
    state: Object.freeze({ ...base.state, hitPoints: Object.freeze({ current, temporary: 0 }) }),
    metadata: Object.freeze({ ...base.metadata, createdAt: NOW, updatedAt: NOW }),
  });
}

/**
 * Repositório + mutação durável em memória.
 * @param {object} [config]
 * @returns {object}
 */
function persistencia(config = {}) {
  let atual = Object.freeze({
    mode: 'editable',
    character: personagem(config),
    revisionToken: 'rev-0',
    warnings: [],
    rawRecord: { id: CHARACTER_ID },
  });
  let revisao = 0;
  return {
    /** @returns {object} */
    get(id) {
      return id === CHARACTER_ID ? ok(atual) : ok(null);
    },
    /**
     * @param {object} character
     * @returns {object}
     */
    save(character) {
      revisao += 1;
      atual = Object.freeze({ ...atual, character, revisionToken: `rev-${revisao}` });
      return ok(Object.freeze({ envelope: atual, syncState: 'queued' }));
    },
  };
}

/**
 * Monta sessão + controller num container novo.
 * @param {{sections?: Array<object>, modal?: object|null, notifier?: object|null, renderCalls?: Array<string>}} [params]
 * @returns {Promise<object>}
 */
async function montar({ sections = null, modal = null, notifier = null, renderCalls = null } = {}) {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);

  const lista =
    sections ??
    SHEET_SECTION_IDS.map((id) => {
      const created = createPlaceholderSection(id, { renderCalls });
      assert.equal(created.ok, true, id);
      return created.value;
    });
  const sectionRegistry = createSectionRegistry(lista);
  assert.equal(sectionRegistry.ok, true, sectionRegistry.ok ? '' : sectionRegistry.error.message);

  const store = persistencia();
  const session = createSheetSession({
    characterId: CHARACTER_ID,
    repository: store,
    durableMutation: store,
    clock: { now: () => NOW },
    projectionContext: () => ({ maximumHitPoints: 20 }),
  });
  const mounted = await mountSheet({ container, session, sectionRegistry: sectionRegistry.value, modal, notifier });
  assert.equal(mounted.ok, true, mounted.ok ? '' : mounted.error.code);
  return { container, session, sectionRegistry: sectionRegistry.value, dispose: mounted.value };
}

/**
 * Dispara um clique real no elemento.
 * @param {object} element
 * @returns {object} o evento disparado.
 */
function clicar(element) {
  const event = new dom.window.Event('click', { bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

/**
 * Aguarda o ciclo de microtasks do despacho.
 * @returns {Promise<void>}
 */
async function assentar() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('integration/sheet-controller — montagem e render', () => {
  test('desenha o shell com um contêiner por seção, na ordem canônica', async () => {
    const { container, dispose } = await montar();
    const secoes = [...container.querySelectorAll(`[${SECTION_ATTRIBUTE}]`)].map((node) => node.getAttribute(SECTION_ATTRIBUTE));
    assert.deepEqual(secoes, [...SHEET_SECTION_IDS]);
    assert.equal(container.querySelector('[data-sheet-mode]').getAttribute('data-sheet-mode'), 'editable');
    dispose();
  });

  test('cada seção recebe a projeção do ViewModel (nunca o personagem cru)', async () => {
    const recebidos = [];
    const section = createSheetSection({
      id: 'summary-combat',
      /**
       * @param {object} viewModel
       * @returns {object}
       */
      select(viewModel) {
        recebidos.push(viewModel);
        return { hp: viewModel.derived.hitPoints.current };
      },
      /**
       * @param {object} projection
       * @returns {string}
       */
      render(projection) {
        return `<b data-hp>${projection.hp}</b>`;
      },
    });
    assert.equal(section.ok, true);
    const outras = SHEET_SECTION_IDS.filter((id) => id !== 'summary-combat').map((id) => createPlaceholderSection(id).value);
    const { container, dispose } = await montar({ sections: [section.value, ...outras] });
    assert.equal(container.querySelector('[data-hp]').textContent, '10');
    // O que chega é o ViewModel — com `derived`/`data`, não `identity` solto.
    assert.ok(Object.hasOwn(recebidos.at(-1), 'derived'));
    assert.ok(Object.hasOwn(recebidos.at(-1), 'data'));
    dispose();
  });

  test('um mount que falha na inicialização não deixa listener vivo', async () => {
    const container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    const registrados = [];
    const original = container.addEventListener.bind(container);
    container.addEventListener = (type, listener, options) => {
      registrados.push(type);
      original(type, listener, options);
    };
    const removidos = [];
    const originalRemove = container.removeEventListener.bind(container);
    container.removeEventListener = (type, listener, options) => {
      removidos.push(type);
      originalRemove(type, listener, options);
    };

    const sectionRegistry = createSectionRegistry(SHEET_SECTION_IDS.map((id) => createPlaceholderSection(id).value));
    const session = createSheetSession({
      characterId: 'inexistente-0000',
      repository: { get: () => ok(null) },
      clock: { now: () => NOW },
    });
    const mounted = await mountSheet({ container, session, sectionRegistry: sectionRegistry.value });
    assert.equal(mounted.ok, false);
    assert.equal(mounted.error.code, 'SHEET_CHARACTER_NOT_FOUND');
    assert.deepEqual(removidos.sort(), registrados.sort(), 'todo listener registrado precisa ter sido removido');
    assert.equal(session.isDisposed(), true);
  });

  test('portas inválidas são recusadas com erro nomeado', async () => {
    assert.equal((await mountSheet({})).error.code, 'SHEET_MOUNT_CONTAINER_INVALID');
    const container = dom.document.createElement('div');
    assert.equal((await mountSheet({ container })).error.code, 'SHEET_MOUNT_SESSION_INVALID');
  });
});

describe('integration/sheet-controller — listeners delegados', () => {
  test('registra UM conjunto de listeners na raiz e não o multiplica a cada rerender', async () => {
    const container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    const registrados = [];
    const original = container.addEventListener.bind(container);
    container.addEventListener = (type, listener, options) => {
      registrados.push(type);
      original(type, listener, options);
    };

    const sectionRegistry = createSectionRegistry(
      SHEET_SECTION_IDS.map((id) => createPlaceholderSection(id, { eventTypes: id === 'inventory-load-coins' ? ['click', 'change'] : ['click'] }).value),
    );
    const store = persistencia();
    const session = createSheetSession({
      characterId: CHARACTER_ID,
      repository: store,
      durableMutation: store,
      clock: { now: () => NOW },
      projectionContext: () => ({ maximumHitPoints: 20 }),
    });
    const mounted = await mountSheet({ container, session, sectionRegistry: sectionRegistry.value });
    assert.equal(mounted.ok, true);

    const depoisDoMount = [...registrados];
    assert.deepEqual(depoisDoMount.sort(), ['change', 'click']);

    // Vários comandos, vários rerenders: o conjunto de listeners não muda.
    for (let i = 0; i < 3; i += 1) {
      const resultado = await session.dispatch({ type: 'apply-damage', amount: 1 });
      assert.equal(resultado.ok, true, resultado.ok ? '' : resultado.error.code);
    }
    assert.deepEqual([...registrados].sort(), depoisDoMount.sort());
    mounted.value();
  });

  test('NENHUMA seção registra listener próprio (sonda em addEventListener do container)', async () => {
    const chamadasDeSecao = [];
    const section = createSheetSection({
      id: 'summary-combat',
      select: () => null,
      /**
       * Uma seção "mal comportada" só teria como registrar listener se
       * recebesse um nó — e ela recebe apenas projeção e uiState.
       * @param {*} projection
       * @param {object} uiState
       * @returns {string}
       */
      render(projection, uiState) {
        chamadasDeSecao.push({ argumentos: [projection, uiState] });
        return '<i></i>';
      },
    });
    const outras = SHEET_SECTION_IDS.filter((id) => id !== 'summary-combat').map((id) => createPlaceholderSection(id).value);
    const { dispose } = await montar({ sections: [section.value, ...outras] });
    for (const chamada of chamadasDeSecao) {
      for (const argumento of chamada.argumentos) {
        assert.equal(typeof argumento?.addEventListener, 'undefined', 'render de seção não pode receber nó DOM');
      }
    }
    dispose();
  });

  test('preventDefault vem da decisão da seção, aplicada pelo CONTROLLER', async () => {
    const { container, dispose } = await montar();
    const botao = container.querySelector('[data-placeholder-damage]');
    const evento = clicar(botao);
    await assentar();
    assert.equal(evento.defaultPrevented, true);
    dispose();
  });

  test('clique sem significado para a seção não vira intenção nem toca o evento', async () => {
    const { container, session, dispose } = await montar();
    const antes = session.getSnapshot().viewModel.derived.hitPoints.current;
    const evento = clicar(container.querySelector('[data-placeholder-name]'));
    await assentar();
    assert.equal(evento.defaultPrevented, false);
    assert.equal(session.getSnapshot().viewModel.derived.hitPoints.current, antes);
    dispose();
  });

  test('clique numa seção despacha o comando e a ficha adota o resultado', async () => {
    const { container, session, dispose } = await montar();
    clicar(container.querySelector('[data-placeholder-damage]'));
    await assentar();
    assert.equal(session.getSnapshot().viewModel.derived.hitPoints.current, 9);
    dispose();
  });

  test('erro de comando vai para o notifier, nunca some em silêncio', async () => {
    const erros = [];
    const section = createSheetSection({
      id: 'summary-combat',
      select: () => null,
      render: () => '<button type="button" data-quebrado="1">x</button>',
      /**
       * @param {object} event
       * @returns {object}
       */
      toIntent(event) {
        return event.target?.closest?.('[data-quebrado]')
          ? createUiEventDecision({ intent: { type: SHEET_INTENT_TYPES.command, command: { type: 'inexistente' } } })
          : createUiEventDecision();
      },
    });
    const outras = SHEET_SECTION_IDS.filter((id) => id !== 'summary-combat').map((id) => createPlaceholderSection(id).value);
    const { container, dispose } = await montar({
      sections: [section.value, ...outras],
      notifier: { error: (problem) => erros.push(problem.code) },
    });
    clicar(container.querySelector('[data-quebrado]'));
    await assentar();
    assert.deepEqual(erros, ['COMMAND_TYPE_UNKNOWN']);
    dispose();
  });
});

describe('integration/sheet-controller — rerender parcial', () => {
  test('um comando reescreve SÓ os miolos sujos e preserva os demais nós', async () => {
    const renderCalls = [];
    const { container, dispose } = await montar({ renderCalls });

    const antes = new Map(
      SHEET_SECTION_IDS.map((id) => [id, container.querySelector(`[${SECTION_ATTRIBUTE}="${id}"] [data-sheet-section-body]`)]),
    );
    renderCalls.length = 0;

    clicar(container.querySelector('[data-placeholder-damage]'));
    await assentar();

    // `apply-damage` -> `hp.current` -> só `summary-combat` está suja.
    assert.deepEqual(renderCalls, ['summary-combat']);
    for (const id of SHEET_SECTION_IDS) {
      const agora = container.querySelector(`[${SECTION_ATTRIBUTE}="${id}"] [data-sheet-section-body]`);
      assert.equal(agora, antes.get(id), `o contêiner de "${id}" não pode ser recriado por um rerender parcial`);
    }
    assert.equal(container.querySelector('[data-placeholder-hp]').textContent, '9');
    dispose();
  });

  test('colapsar uma seção é efeito do CONTROLLER e atualiza o shell', async () => {
    const { container, session, dispose } = await montar();
    clicar(container.querySelector('[data-sheet-toggle="spells-spellbook"]'));
    await assentar();
    assert.equal(session.getSnapshot().uiState.collapsed['spells-spellbook'], true);
    assert.equal(container.querySelector(`[${SECTION_ATTRIBUTE}="spells-spellbook"]`).getAttribute('data-collapsed'), 'true');
    dispose();
  });
});

describe('integration/sheet-controller — modal', () => {
  /**
   * Serviço de modal falso, com um nó raiz próprio FORA do container da ficha
   * (é assim que o overlay real vive).
   * @returns {object}
   */
  function modalFalso() {
    const abertos = [];
    return {
      abertos,
      /**
       * @param {object} spec
       * @returns {object}
       */
      open(spec) {
        const element = dom.document.createElement('div');
        // O controller entrega NÓS (o `ModalService` real recusa string de
        // HTML por contrato); o dublê precisa aceitar a mesma coisa.
        for (const node of Array.isArray(spec.content) ? spec.content : []) {
          element.appendChild(node);
        }
        dom.document.body.appendChild(element);
        const handle = {
          element,
          /** @returns {void} */
          close() {
            element.remove();
            abertos.splice(abertos.indexOf(handle), 1);
          },
        };
        abertos.push(handle);
        return handle;
      },
    };
  }

  test('a seção PEDE o modal; quem abre é o controller (a seção não recebe o serviço)', async () => {
    const modal = modalFalso();
    const recebidos = [];
    const section = createSheetSection({
      id: 'summary-combat',
      /**
       * @param {object} viewModel
       * @returns {object}
       */
      select(viewModel) {
        return { nome: viewModel.data.identity.name };
      },
      render: () => '<button type="button" data-placeholder-modal="1">modal</button>',
      /**
       * @param {object} event
       * @param {object} context
       * @returns {object}
       */
      toIntent(event, context) {
        recebidos.push(Object.keys(context).sort());
        return event.target?.closest?.('[data-placeholder-modal]')
          ? createUiEventDecision({
              intent: { type: SHEET_INTENT_TYPES.modalOpen, modalId: 'm1', title: 't', content: '<button data-sheet-modal-owner="summary-combat" data-confirmar="1">ok</button>' },
              preventDefault: true,
            })
          : createUiEventDecision();
      },
    });
    const outras = SHEET_SECTION_IDS.filter((id) => id !== 'summary-combat').map((id) => createPlaceholderSection(id).value);
    const { container, dispose } = await montar({ sections: [section.value, ...outras], modal });

    clicar(container.querySelector('[data-placeholder-modal]'));
    await assentar();
    assert.equal(modal.abertos.length, 1);
    // O contexto do `toIntent` traz só projeção/uiState/root — nunca o modal.
    assert.deepEqual(recebidos[0], ['projection', 'root', 'uiState']);
    dispose();
    assert.equal(modal.abertos.length, 0, 'o disposer precisa fechar os modais que ele mesmo abriu');
  });

  test('cliques DENTRO do modal chegam ao toIntent da seção dona', async () => {
    const modal = modalFalso();
    const { container, session, dispose } = await montar({ modal });
    clicar(container.querySelector(`[${SECTION_ATTRIBUTE}="summary-combat"] [data-placeholder-modal]`));
    await assentar();
    assert.equal(modal.abertos.length, 1);

    const confirmar = modal.abertos[0].element.querySelector('[data-placeholder-modal-confirm]');
    assert.ok(confirmar, 'o corpo do modal precisa ter chegado ao DOM');
    clicar(confirmar);
    await assentar();
    assert.equal(session.getSnapshot().viewModel.derived.hitPoints.current, 9, 'o clique no modal precisa ter virado comando');
    dispose();
  });
});

describe('integration/sheet-controller — disposer', () => {
  test('é idempotente, remove todos os listeners e descarta a sessão', async () => {
    const container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    const registrados = [];
    const removidos = [];
    const original = container.addEventListener.bind(container);
    const originalRemove = container.removeEventListener.bind(container);
    container.addEventListener = (type, listener, options) => {
      registrados.push(type);
      original(type, listener, options);
    };
    container.removeEventListener = (type, listener, options) => {
      removidos.push(type);
      originalRemove(type, listener, options);
    };

    const sectionRegistry = createSectionRegistry(SHEET_SECTION_IDS.map((id) => createPlaceholderSection(id).value));
    const store = persistencia();
    const session = createSheetSession({
      characterId: CHARACTER_ID,
      repository: store,
      durableMutation: store,
      clock: { now: () => NOW },
      projectionContext: () => ({ maximumHitPoints: 20 }),
    });
    const mounted = await mountSheet({ container, session, sectionRegistry: sectionRegistry.value });
    assert.equal(mounted.ok, true);

    mounted.value();
    mounted.value();
    assert.deepEqual(removidos.sort(), registrados.sort());
    assert.equal(session.isDisposed(), true);

    // Depois do dispose, um clique remanescente não faz nada.
    const botao = container.querySelector('[data-placeholder-damage]');
    if (botao !== null) {
      clicar(botao);
      await assentar();
    }
  });
});

describe('integration/sheet-controller — conteúdo hostil', () => {
  test('nome de personagem malicioso nunca chega cru ao markup', async () => {
    const payload = '<img src=x onerror="window.__xis=1">';
    const container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    const sectionRegistry = createSectionRegistry(SHEET_SECTION_IDS.map((id) => createPlaceholderSection(id).value));

    let atual = Object.freeze({
      mode: 'editable',
      character: personagem({ name: payload }),
      revisionToken: 'rev-0',
      warnings: [],
      rawRecord: {},
    });
    const session = createSheetSession({
      characterId: CHARACTER_ID,
      repository: { get: () => ok(atual) },
      durableMutation: { save: () => err(createAppError({ code: 'X', scope: 't', message: 'x' })) },
      clock: { now: () => NOW },
      projectionContext: () => ({ maximumHitPoints: 20 }),
    });
    const mounted = await mountSheet({ container, session, sectionRegistry: sectionRegistry.value });
    assert.equal(mounted.ok, true);

    assert.ok(!container.innerHTML.includes('<img'), 'o payload não pode entrar cru no markup');
    assert.equal(container.querySelector('[data-placeholder-name]').textContent, payload);
    assert.equal(container.querySelector('img'), null);
    mounted.value();
  });
});
