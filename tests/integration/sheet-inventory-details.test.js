// ============================================================
// Integração das DUAS seções da Task 32 — inventário/carga/moedas e detalhes
// pessoais — montadas junto das CINCO das Tasks 30/31, sobre o controller REAL,
// a sessão REAL e o catálogo REAL (`dados/pacotes/dnd2024/**`). Com estas duas,
// as SETE seções da ficha passam a ser reais: nenhum placeholder sobra.
//
// Os testes focais provam cada seção em isolamento. O que só aparece com o
// controller de verdade no meio, e é o que este arquivo cobre:
//
//  1. as SETE seções reais convivem no mesmo registro, e o registro é aceito
//     com `requireAll` (nenhuma seção faltando);
//  2. o ROTEAMENTO de `AFFECTED_PATH_SECTIONS` acontece de verdade: um comando
//     de inventário suja `inventory-load-coins` E `summary-combat` (equipar
//     muda CA/ataques); um comando de carteira suja SÓ o inventário;
//  3. o ARRASTO ponta a ponta: `dragstart` grava o id no UI state pela sessão,
//     `drop` emite a permutação e o inventário é reordenado no repositório —
//     por IDs, nunca por índice;
//  4. a TRANSAÇÃO DE MODAL pelo caminho real: cancelar a compra, a customização
//     e a edição de detalhes não escreve NADA (identidade preservada);
//  5. a FALHA LOCAL não adota o candidato: com o save falhando, o personagem
//     confirmado continua o anterior;
//  6. as QUATRO PREFERÊNCIAS LEGADAS sobrevivem a um "reload" (sessão nova
//     sobre o MESMO storage) — com o repositório REAL
//     (`LocalStoragePreferencesRepository`), não um dublê: um dublê que ecoa
//     qualquer chave esconderia o shape fechado do repositório (foi exatamente
//     o Critical da revisão da Task 29);
//  7. o CAMINHO DE FALHA do processador de imagem (`infra/image/
//     character-image-processor.js`): a falha é um erro NOMEADO e nenhum
//     candidato de imagem é adotado.
// ============================================================
import { test, describe, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createTestDom } from '../helpers/test-dom.js';
import { createDiskFetch } from '../helpers/disk-fetch.js';
import { createMemoryStorage } from '../helpers/memory-storage.js';
import { ok, err } from '../../site/js/core/result.js';
import { createAppError } from '../../site/js/core/errors.js';
import { createAppContext } from '../../site/js/app-context.js';
import { createEmptyCharacter } from '../../site/js/domain/character/model.js';
import { createSheetSession } from '../../site/js/features/sheet/sheet-session.js';
import { mountSheet } from '../../site/js/features/sheet/sheet-controller.js';
import { createSectionRegistry } from '../../site/js/features/sheet/sections/section-registry.js';
import { SHEET_SECTION_IDS } from '../../site/js/features/sheet/sheet-state.js';
import {
  LocalStoragePreferencesRepository,
  CURRENCY_RATES_KEY,
  PURCHASE_EQUIPPED_DEFAULT_KEY,
  LEVELUP_FLOW_V2_KEY,
  sheetCollapseKey,
} from '../../site/js/infra/preferences/local-storage-preferences-repository.js';
import { createCharacterImageProcessor } from '../../site/js/infra/image/character-image-processor.js';
import { createSummaryCombatSection } from '../../site/js/features/sheet/sections/summary-combat-section.js';
import { createResourcesFeaturesSection } from '../../site/js/features/sheet/sections/resources-features-section.js';
import { createFeatsProgressionSection } from '../../site/js/features/sheet/sections/feats-progression-section.js';
import { createSpellsSpellbookSection } from '../../site/js/features/sheet/sections/spells-spellbook-section.js';
import { createConditionsDefensesSensesSection } from '../../site/js/features/sheet/sections/conditions-defenses-senses-section.js';
import {
  INVENTORY_CUSTOM_MODAL_ID,
  INVENTORY_FLOW_ACTIONS,
  INVENTORY_PURCHASE_MODAL_ID,
  createInventoryLoadCoinsSection,
} from '../../site/js/features/sheet/sections/inventory-load-coins-section.js';
import {
  PERSONAL_DETAILS_FLOW_ACTIONS,
  createPersonalDetailsSection,
} from '../../site/js/features/sheet/sections/personal-details-section.js';

const NOW = '2026-08-04T12:00:00.000Z';
const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });
const CHARACTER_ID = 'inve-deta-0001';
const GUERREIRO = 'dnd2024:class:guerreiro';
// Itens REAIS do catálogo oficial.
const ADAGA = 'dnd2024:weapon:adaga';
const COURO = 'dnd2024:armor:couro';

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

  // Âncora: os itens existem no catálogo REAL. Sem isto um teste "verde"
  // poderia estar exercitando ids que não resolvem, e todo o resto passaria por
  // vacuidade.
  assert.equal(registry.get(ADAGA)?.type, 'weapon', `"${ADAGA}" não está no catálogo`);
  assert.equal(registry.get(COURO)?.type, 'armor', `"${COURO}" não está no catálogo`);
});

beforeEach(() => {
  dom = createTestDom();
});

afterEach(() => {
  dom.restore();
});

/**
 * Guerreiro com os três estados de item (equipado, mochila, esgotado) e uma
 * carteira com as cinco denominações.
 * @param {object} [overrides]
 * @returns {object}
 */
function guerreiro(overrides = {}) {
  const base = createEmptyCharacter({ id: CHARACTER_ID, now: NOW, rulesetRef: RULESET_REF });
  return Object.freeze({
    ...base,
    identity: Object.freeze({
      ...base.identity,
      name: 'Bruna',
      alignment: 'Leal e Bom',
      notes: '<b>anotação</b>',
      ...(overrides.identity ?? {}),
    }),
    build: Object.freeze({ ...base.build, classRef: Object.freeze({ id: GUERREIRO, packageVersion: '1.0.0' }) }),
    state: Object.freeze({
      ...base.state,
      level: 5,
      hitPoints: Object.freeze({ current: 30, temporary: 0 }),
      inventory: Object.freeze([
        Object.freeze({ instanceId: 'inv-1', itemRef: Object.freeze({ id: ADAGA, packageVersion: '1.0.0' }), customDefinition: null, quantity: 2, equipped: true, expended: 0, sourceInstanceId: null }),
        Object.freeze({ instanceId: 'inv-2', itemRef: Object.freeze({ id: COURO, packageVersion: '1.0.0' }), customDefinition: null, quantity: 1, equipped: false, expended: 0, sourceInstanceId: null }),
        Object.freeze({ instanceId: 'inv-3', itemRef: null, customDefinition: Object.freeze({ nome: 'Tocha', peso: '0,5 kg', custo: '1 pc' }), quantity: 0, equipped: false, expended: 0, sourceInstanceId: null }),
      ]),
      wallet: Object.freeze({ pc: 20, pp: 5, pe: 0, po: 10, pl: 1 }),
      ...(overrides.state ?? {}),
    }),
    metadata: Object.freeze({ ...base.metadata, createdAt: NOW, updatedAt: NOW }),
  });
}

/**
 * Repositório + mutação durável em memória, contando as escritas.
 * @param {object} character
 * @param {{falharSave?: boolean}} [config]
 * @returns {object}
 */
function persistencia(character, { falharSave = false } = {}) {
  let atual = Object.freeze({ mode: 'editable', character, revisionToken: 'rev-0', warnings: [], rawRecord: {} });
  let revisao = 0;
  const escritas = [];
  return {
    escritas,
    /** @returns {object} */
    atualCharacter: () => atual.character,
    /**
     * @param {string} id
     * @returns {object}
     */
    get: (id) => (id === CHARACTER_ID ? ok(atual) : ok(null)),
    /**
     * @param {object} proximo
     * @returns {object}
     */
    save(proximo) {
      escritas.push(revisao + 1);
      if (falharSave) {
        return err(createAppError({ code: 'TESTE_SAVE_FALHOU', scope: 'teste', message: 'Falha local simulada.' }));
      }
      revisao += 1;
      atual = Object.freeze({ ...atual, character: proximo, revisionToken: `rev-${revisao}` });
      return ok(Object.freeze({ envelope: atual, syncState: 'queued' }));
    },
  };
}

/**
 * Serviço de modal mínimo com a mesma superfície que o controller consome.
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
 * As SETE seções reais, na ordem canônica.
 * @returns {object} Result do registro
 */
function registroCompleto() {
  const fabricas = {
    'summary-combat': createSummaryCombatSection,
    'resources-features': createResourcesFeaturesSection,
    'feats-progression': createFeatsProgressionSection,
    'spells-spellbook': createSpellsSpellbookSection,
    'conditions-defenses-senses': createConditionsDefensesSensesSection,
    'inventory-load-coins': createInventoryLoadCoinsSection,
    'personal-details': createPersonalDetailsSection,
  };
  const sections = SHEET_SECTION_IDS.map((id) => {
    assert.ok(fabricas[id] !== undefined, `a seção "${id}" não tem fábrica real — nenhum placeholder deveria sobrar`);
    const criada = fabricas[id]();
    assert.equal(criada.ok, true, `seção "${id}" inválida: ${criada.error?.code}`);
    return criada.value;
  });
  return createSectionRegistry(sections);
}

/**
 * Monta as sete seções reais sobre o controller real.
 * @param {{character?: object, modal?: object|null, storage?: object, falharSave?: boolean}} [params]
 * @returns {Promise<object>}
 */
async function montar({ character = guerreiro(), modal = null, storage = null, falharSave = false, erros = null } = {}) {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);

  const registro = registroCompleto();
  assert.equal(registro.ok, true, registro.error?.code);

  const store = persistencia(character, { falharSave });
  // Repositório REAL de preferências sobre storage em memória (ver o item 6 do
  // cabeçalho): um dublê esconderia o shape fechado.
  const memoria = storage ?? createMemoryStorage();
  const preferences = LocalStoragePreferencesRepository({ storage: memoria });

  const session = createSheetSession({
    characterId: CHARACTER_ID,
    registry,
    officialHandlerInvoker,
    repository: store,
    durableMutation: store,
    preferences,
    clock: { now: () => NOW },
    projectionContext: () => ({ maximumHitPoints: 40 }),
  });

  const montado = await mountSheet({
    container,
    session,
    sectionRegistry: registro.value,
    modal,
    // Notificador opcional: é por ele que o controller entrega o AppError de um
    // comando recusado. Sem capturá-lo, "nada foi escrito" seria indistinguível
    // de "o clique não fez nada" — a vacuidade que o teste da lacuna precisa
    // afastar.
    notifier: erros === null ? null : { error: (falha) => erros.push(falha) },
    moduleName: 'features/sheet (integração 32)',
  });
  assert.equal(montado.ok, true, `mount falhou: ${JSON.stringify(montado.error ?? null)}`);
  return { container, session, store, storage: memoria, preferences, dispose: montado.value };
}

/**
 * Dispara um evento real no elemento e deixa o microtask do controller rodar.
 * @param {object} element
 * @param {string} [tipo]
 * @returns {Promise<void>}
 */
async function disparar(element, tipo = 'click') {
  assert.ok(element, `elemento de evento inexistente (${tipo})`);
  element.dispatchEvent(new dom.window.Event(tipo, { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('integration/sheet-inventory-details — as SETE seções reais convivem', () => {
  test('nenhum placeholder sobra: o registro completo é composto só de seções reais', async () => {
    const { container, dispose } = await montar();
    try {
      assert.equal(container.querySelectorAll('[data-sheet-section]').length, 7);
      assert.ok(container.querySelector('[data-sheet-section="inventory-load-coins"] [data-sheet-inventory-load-coins]'));
      assert.ok(container.querySelector('[data-sheet-section="personal-details"] [data-sheet-personal-details]'));
      assert.equal(container.querySelectorAll('.sheet-root').length, 1);
      assert.equal(/\son[a-z]+\s*=/i.test(container.innerHTML), false, 'handler inline no markup');
    } finally {
      dispose();
    }
  });

  test('o inventário real aparece nos três grupos, com item de catálogo resolvido', async () => {
    const { container, dispose } = await montar();
    try {
      const secao = container.querySelector('[data-sheet-section="inventory-load-coins"]');
      assert.equal(secao.querySelector('[data-sheet-item-group="equipped"]').getAttribute('data-count'), '1');
      assert.equal(secao.querySelector('[data-sheet-item-group="backpack"]').getAttribute('data-count'), '1');
      assert.equal(secao.querySelector('[data-sheet-item-group="depleted"]').getAttribute('data-count'), '1');
      // O nome vem do CATÁLOGO real, não do id cru.
      const nome = secao.querySelector('[data-sheet-item="inv-1"] [data-sheet-item-name]').textContent;
      assert.notEqual(nome, ADAGA);
      assert.ok(nome.length > 0);
    } finally {
      dispose();
    }
  });

  test('os detalhes pessoais escapam o texto do jogador ponta a ponta', async () => {
    const { container, dispose } = await montar();
    try {
      const secao = container.querySelector('[data-sheet-section="personal-details"]');
      assert.equal(secao.querySelector('b'), null, 'markup do jogador não pode virar elemento');
      assert.equal(secao.querySelector('[data-sheet-detail-field="notes"] [data-sheet-detail-value]').textContent, '<b>anotação</b>');
      assert.equal(secao.querySelector('[data-sheet-detail-field="name"] [data-sheet-detail-value]').textContent, 'Bruna');
    } finally {
      dispose();
    }
  });
});

describe('integration/sheet-inventory-details — roteamento de `dirtySections`', () => {
  test('equipar suja inventário E resumo; a carteira suja SÓ o inventário', async () => {
    const { container, session, dispose } = await montar();
    try {
      const equipar = container.querySelector('[data-sheet-item="inv-2"] [data-action="equip-item"]');
      await disparar(equipar);
      assert.deepEqual([...session.getSnapshot().dirtySections], ['summary-combat', 'inventory-load-coins']);

      const campo = container.querySelector('[data-sheet-wallet-quantity="po"]');
      campo.value = '2';
      await disparar(container.querySelector('[data-sheet-wallet-denomination="po"] [data-wallet-operation="add"]'));
      assert.deepEqual([...session.getSnapshot().dirtySections], ['inventory-load-coins']);
    } finally {
      dispose();
    }
  });

  test('o comando chega ao repositório: quantidade e carteira mudam de verdade', async () => {
    const { container, store, dispose } = await montar();
    try {
      await disparar(container.querySelector('[data-sheet-item="inv-1"] [data-action="change-item-quantity"][data-delta="1"]'));
      const entrada = store.atualCharacter().state.inventory.find((item) => item.instanceId === 'inv-1');
      assert.equal(entrada.quantity, 3);

      container.querySelector('[data-sheet-wallet-quantity="po"]').value = '2';
      await disparar(container.querySelector('[data-sheet-wallet-denomination="po"] [data-wallet-operation="add"]'));
      assert.equal(store.atualCharacter().state.wallet.po, 12);
    } finally {
      dispose();
    }
  });

  test('remover um item o tira do repositório e da tela', async () => {
    const { container, store, dispose } = await montar();
    try {
      await disparar(container.querySelector('[data-sheet-item="inv-3"] [data-action="remove-inventory-item"]'));
      assert.equal(store.atualCharacter().state.inventory.length, 2);
      assert.equal(container.querySelector('[data-sheet-item="inv-3"]'), null);
    } finally {
      dispose();
    }
  });
});

describe('integration/sheet-inventory-details — arrasto ponta a ponta', () => {
  test('dragstart -> drop reordena por IDs no repositório, nunca por índice', async () => {
    const { container, session, store, dispose } = await montar();
    try {
      const origem = container.querySelector('[data-sheet-item="inv-3"]');
      await disparar(origem, 'dragstart');
      assert.equal(session.getSnapshot().uiState.draggingInstanceId, 'inv-3');

      const destino = container.querySelector('[data-sheet-item="inv-1"]');
      await disparar(destino, 'drop');

      assert.deepEqual(
        store.atualCharacter().state.inventory.map((item) => item.instanceId),
        ['inv-3', 'inv-1', 'inv-2'],
      );

      await disparar(container.querySelector('[data-sheet-item="inv-1"]'), 'dragend');
      assert.equal(session.getSnapshot().uiState.draggingInstanceId, null);
    } finally {
      dispose();
    }
  });

  test('drop sem dragstart não escreve nada', async () => {
    const { container, store, dispose } = await montar();
    try {
      await disparar(container.querySelector('[data-sheet-item="inv-1"]'), 'drop');
      assert.equal(store.escritas.length, 0, 'um drop sem origem não pode gerar escrita');
    } finally {
      dispose();
    }
  });

  test('um repaint NO MEIO do arrasto não deixa o id órfão, e um drop estranho depois não reordena', async () => {
    // O CENÁRIO REAL, que o teste "drop sem dragstart" mascarava por rodar numa
    // ficha recém-montada (`dirtySections` vazio, `draggingInstanceId` nunca
    // setado):
    //
    //   1. um comando ANTERIOR deixa `dirtySections` = [...] no snapshot;
    //   2. `dragstart` emite `sheet/ui-state`, e a sessão republica aquela MESMA
    //      lista suja -> o controller repinta o corpo do inventário NO MEIO do
    //      gesto e a linha arrastada vira um nó desmontado;
    //   3. `dragend` dispara nesse nó desmontado e nunca chega à delegação da
    //      raiz -> `draggingInstanceId` fica ÓRFÃO;
    //   4. um drop de payload NÃO RELACIONADO (arquivo, texto selecionado,
    //      arrasto vindo de fora) cai sobre uma linha e vira um
    //      `reorder-inventory` real e errado.
    const { container, session, store, dispose } = await montar();
    try {
      // (1) comando anterior: `dirtySections` fica não-vazio.
      await disparar(container.querySelector('[data-sheet-item="inv-1"] [data-action="change-item-quantity"][data-delta="1"]'));
      assert.equal(store.escritas.length, 1);
      assert.ok(session.getSnapshot().dirtySections.length > 0, 'o comando precisa ter sujado alguma seção');

      // (2) dragstart. Guardamos o NÓ, como o navegador faz: se um repaint o
      // desmontar, o `dragend` dispara nele mesmo assim.
      const noArrastado = container.querySelector('[data-sheet-item="inv-3"]');
      await disparar(noArrastado, 'dragstart');
      assert.equal(session.getSnapshot().uiState.draggingInstanceId, 'inv-3');
      // O GUARD: uma mudança de UI state não pode republicar a lista suja do
      // comando anterior — é ela que provocava o repaint no meio do gesto.
      assert.deepEqual([...session.getSnapshot().dirtySections], [], 'ui-state não pode carregar `dirtySections` de um comando anterior');

      // (3) dragend no nó original.
      await disparar(noArrastado, 'dragend');
      assert.equal(session.getSnapshot().uiState.draggingInstanceId, null, 'o id do arrasto ficou ÓRFÃO');

      // (4) o drop estranho.
      const ordemAntes = store.atualCharacter().state.inventory.map((item) => item.instanceId);
      await disparar(container.querySelector('[data-sheet-item="inv-1"]'), 'drop');
      assert.equal(store.escritas.length, 1, 'um drop estranho não pode gerar escrita nenhuma');
      assert.deepEqual(store.atualCharacter().state.inventory.map((item) => item.instanceId), ordemAntes);
    } finally {
      dispose();
    }
  });

  test('o DROP encerra o gesto: um segundo drop, sem novo dragstart, não reordena de novo', async () => {
    // Sem esta garantia o `draggingInstanceId` sobrevivia ao drop bem-sucedido
    // (só o `dragend` o apagava) e qualquer drop seguinte — inclusive de um
    // payload que não é nosso — reordenava outra vez.
    const { container, session, store, dispose } = await montar();
    try {
      await disparar(container.querySelector('[data-sheet-item="inv-3"]'), 'dragstart');
      await disparar(container.querySelector('[data-sheet-item="inv-1"]'), 'drop');
      assert.deepEqual(store.atualCharacter().state.inventory.map((item) => item.instanceId), ['inv-3', 'inv-1', 'inv-2']);
      assert.equal(store.escritas.length, 1);
      assert.equal(session.getSnapshot().uiState.draggingInstanceId, null, 'o drop precisa encerrar o gesto sozinho');

      // Segundo drop, sem dragstart nenhum.
      await disparar(container.querySelector('[data-sheet-item="inv-2"]'), 'drop');
      assert.equal(store.escritas.length, 1, 'o segundo drop não pode reordenar de novo');
      assert.deepEqual(store.atualCharacter().state.inventory.map((item) => item.instanceId), ['inv-3', 'inv-1', 'inv-2']);
    } finally {
      dispose();
    }
  });
});

describe('integration/sheet-inventory-details — transação de modal', () => {
  test('cancelar a COMPRA não escreve nada e preserva a identidade do personagem', async () => {
    const modal = modalService();
    const { container, store, dispose } = await montar({ modal });
    try {
      const antes = store.atualCharacter();
      await disparar(container.querySelector(`[data-action="${INVENTORY_FLOW_ACTIONS.purchaseOpen}"]`));
      assert.deepEqual(modal.aberturas, ['Comprar item']);
      modal.overlay.querySelector('[data-sheet-purchase-item-id]').value = ADAGA;
      await disparar(modal.overlay.querySelector(`[data-action="${INVENTORY_FLOW_ACTIONS.purchaseClose}"]`));
      assert.equal(store.escritas.length, 0);
      assert.equal(store.atualCharacter(), antes, 'identidade de objeto preservada');
      assert.equal(modal.overlay.querySelector('[data-modal-root]'), null, 'o modal deveria ter fechado');
    } finally {
      dispose();
    }
  });

  test('confirmar a compra adiciona UM item, com o instanceId determinístico', async () => {
    const modal = modalService();
    const { container, store, dispose } = await montar({ modal });
    try {
      await disparar(container.querySelector(`[data-action="${INVENTORY_FLOW_ACTIONS.purchaseOpen}"]`));
      modal.overlay.querySelector('[data-sheet-purchase-item-id]').value = ADAGA;
      // A versão do pacote passou a ser campo do formulário (Task 33): sem ela
      // a referência fica incompleta e o comando é recusado com
      // `COMMAND_INVENTORY_ITEM_IDENTITY_MISSING`, em vez de gravar um
      // personagem inválido que só explodiria ao salvar.
      modal.overlay.querySelector('[data-sheet-purchase-item-version]').value = '1.0.0';
      modal.overlay.querySelector('[data-sheet-purchase-quantity]').value = '3';
      await disparar(modal.overlay.querySelector('[data-action="add-inventory-item"]'));

      const inventario = store.atualCharacter().state.inventory;
      assert.equal(inventario.length, 4);
      const novo = inventario[inventario.length - 1];
      assert.equal(novo.instanceId, 'sheet-item-1');
      assert.equal(novo.quantity, 3);
      assert.deepEqual(novo.itemRef, { id: ADAGA, packageVersion: '1.0.0' });
      assert.equal(store.escritas.length, 1, 'uma compra é UMA escrita');
    } finally {
      dispose();
    }
  });

  test('cancelar a CUSTOMIZAÇÃO e a EDIÇÃO DE DETALHES também não muta nada', async () => {
    const modal = modalService();
    const { container, store, dispose } = await montar({ modal });
    try {
      const antes = store.atualCharacter();

      await disparar(container.querySelector(`[data-action="${INVENTORY_FLOW_ACTIONS.customOpen}"]`));
      modal.overlay.querySelector('[data-sheet-custom-name]').value = 'Item que não será criado';
      await disparar(modal.overlay.querySelector(`[data-action="${INVENTORY_FLOW_ACTIONS.customClose}"]`));

      await disparar(container.querySelector(`[data-action="${PERSONAL_DETAILS_FLOW_ACTIONS.editOpen}"]`));
      modal.overlay.querySelector('[data-sheet-detail-input="name"]').value = 'Nome que não será gravado';
      await disparar(modal.overlay.querySelector(`[data-action="${PERSONAL_DETAILS_FLOW_ACTIONS.editClose}"]`));

      assert.equal(store.escritas.length, 0);
      assert.equal(store.atualCharacter(), antes, 'identidade de objeto preservada');
      assert.deepEqual(modal.aberturas, ['Item customizado', 'Editar detalhes']);
    } finally {
      dispose();
    }
  });

  test('reabrir o MESMO modal redesenha o formulário sem resíduo do anterior', async () => {
    const modal = modalService();
    const { container, dispose } = await montar({ modal });
    try {
      await disparar(container.querySelector(`[data-action="${INVENTORY_FLOW_ACTIONS.purchaseOpen}"]`));
      modal.overlay.querySelector('[data-sheet-purchase-item-id]').value = 'lixo-de-tentativa-anterior';
      await disparar(container.querySelector(`[data-action="${INVENTORY_FLOW_ACTIONS.purchaseOpen}"]`));
      assert.deepEqual(modal.aberturas, ['Comprar item', 'Comprar item']);
      assert.equal(modal.overlay.querySelectorAll('[data-sheet-purchase-item-id]').length, 1);
      assert.equal(modal.overlay.querySelector('[data-sheet-purchase-item-id]').value, '');
    } finally {
      dispose();
    }
  });

  // ATUALIZAÇÃO CONSCIENTE (correção I2 da revisão final): este teste travava
  // a RECUSA (`COMMAND_EDIT_PATH_NOT_ALLOWED`) da edição de identidade. A
  // allowlist do domínio agora cobre `identity.*`, então o MESMO clique
  // precisa produzir o EFEITO persistido — manter o teste antigo congelaria o
  // defeito que a revisão mandou corrigir.
  test('gravar um detalhe pessoal PRODUZ o efeito persistido, sem erro notificado', async () => {
    const modal = modalService();
    const erros = [];
    const { container, store, session, dispose } = await montar({ modal, erros });
    try {
      const antes = store.atualCharacter();
      await disparar(container.querySelector(`[data-action="${PERSONAL_DETAILS_FLOW_ACTIONS.editOpen}"]`));
      modal.overlay.querySelector('[data-sheet-detail-input="alignment"]').value = 'Caótico e Bom';
      await disparar(modal.overlay.querySelector('[data-action="edit-character-field"][data-path="identity.alignment"]'));

      // Efeito completo pelo caminho REAL: nenhum erro, UMA escrita no store,
      // personagem confirmado novo (imutável) e a tela refletindo o valor.
      assert.deepEqual(erros, [], 'a edição permitida não pode gerar recusa');
      assert.equal(store.escritas.length, 1, 'a edição precisa ser persistida');
      assert.notEqual(store.atualCharacter(), antes);
      assert.equal(store.atualCharacter().identity.alignment, 'Caótico e Bom');
      assert.equal(session.getSnapshot().viewModel.data.identity.alignment, 'Caótico e Bom');
      // O override de reversão guarda o original para revert-character-edit.
      assert.equal(store.atualCharacter().overrides['identity.alignment'].original, 'Leal e Bom');
      // A nota de lacuna de identidade SAIU do markup (a de imagem fica).
      assert.equal(container.querySelector('[data-sheet-identity-edit-unavailable]'), null);
      assert.ok(container.querySelector('[data-sheet-image-edit-unavailable]') !== null);
    } finally {
      dispose();
    }
  });
});

describe('integration/sheet-inventory-details — falha local não adota o candidato', () => {
  test('com o save falhando, o personagem confirmado continua o anterior', async () => {
    const { container, session, store, dispose } = await montar({ falharSave: true });
    try {
      const antes = store.atualCharacter();
      await disparar(container.querySelector('[data-sheet-item="inv-1"] [data-action="change-item-quantity"][data-delta="1"]'));
      assert.equal(store.escritas.length, 1, 'a escrita foi tentada');
      assert.equal(store.atualCharacter(), antes, 'o candidato NÃO pode ser adotado');
      // A tela também não pode mostrar o valor que não foi gravado.
      const projetado = session.getSnapshot().viewModel.data.state.inventory.find((item) => item.instanceId === 'inv-1');
      assert.equal(projetado.quantity, 2);
      assert.equal(container.querySelector('[data-sheet-item="inv-1"] [data-sheet-item-quantity]').textContent, '2');
    } finally {
      dispose();
    }
  });
});

describe('integration/sheet-inventory-details — as QUATRO preferências legadas sobrevivem ao reload', () => {
  test('taxas de moeda, compra equipada, colapso e flag de level-up voltam com o repositório REAL', async () => {
    const storage = createMemoryStorage();
    const primeira = await montar({ storage });
    try {
      // As quatro preferências do repositório real, gravadas pelos caminhos
      // REAIS: duas pela sessão (UI state) e duas pela própria porta (não há
      // controle de tela para elas nesta task — e inventar um seria pior do
      // que gravar pelo repositório que o baseline também usa).
      primeira.preferences.setCurrencyRates({ pc: 1, pp: 10, pe: 50, po: 100, pl: 1000 });
      assert.equal(primeira.session.setUiState({ purchaseEquippedDefault: true }).ok, true);
      assert.equal(primeira.session.setUiState({ collapsed: { 'inventory-load-coins': true, 'personal-details': true } }).ok, true);
      assert.equal(primeira.session.setUiState({ levelUpFlowV2: true }).ok, true);
    } finally {
      primeira.dispose();
    }

    // As quatro chaves LEGADAS estão no storage, com os nomes do baseline.
    assert.notEqual(storage.getItem(CURRENCY_RATES_KEY), null);
    assert.equal(storage.getItem(PURCHASE_EQUIPPED_DEFAULT_KEY), '1');
    assert.equal(storage.getItem(LEVELUP_FLOW_V2_KEY), 'true');
    assert.notEqual(storage.getItem(sheetCollapseKey(CHARACTER_ID)), null);

    // "Reload": sessão NOVA sobre o MESMO storage.
    const segunda = await montar({ storage });
    try {
      const snapshot = segunda.session.getSnapshot();
      assert.deepEqual(snapshot.preferences.currencyRates, { pc: 1, pp: 10, pe: 50, po: 100, pl: 1000 });
      assert.equal(snapshot.preferences.purchaseEquippedDefault, true);
      assert.equal(snapshot.preferences.levelUpFlowV2, true);
      assert.equal(snapshot.uiState.collapsed['inventory-load-coins'], true);
      assert.equal(snapshot.uiState.collapsed['personal-details'], true);
      // A preferência de compra volta ao UI state, que é o que a seção enxerga.
      assert.equal(snapshot.uiState.purchaseEquippedDefault, true);
      // E o total da carteira passa a ser calculável com as taxas gravadas.
      assert.equal(typeof snapshot.viewModel.derived.wallet.totalCopper, 'number');
    } finally {
      segunda.dispose();
    }
  });

  test('os cinco nomes LEGADOS de colapso continuam intactos depois de a ficha nova gravar', async () => {
    // Duas telas escrevem na MESMA chave durante a migração: o monólito (cinco
    // nomes) e a ficha nova (ids de seção). Substituir o objeto faria uma
    // apagar o colapso da outra — o defeito que a Task 29 corrigiu e que esta
    // task, sendo a dona dos blocos `equipados`/`mochila`/`esgotados`/
    // `detalhes`, não pode reintroduzir.
    const storage = createMemoryStorage();
    storage.corrupt(
      sheetCollapseKey(CHARACTER_ID),
      JSON.stringify({ equipados: true, mochila: true, esgotados: true, detalhes: true, truques: false }),
    );
    const montado = await montar({ storage });
    try {
      assert.equal(montado.session.setUiState({ collapsed: { 'inventory-load-coins': true } }).ok, true);
    } finally {
      montado.dispose();
    }
    const gravado = JSON.parse(storage.getItem(sheetCollapseKey(CHARACTER_ID)));
    for (const legado of ['equipados', 'mochila', 'esgotados', 'detalhes']) {
      assert.equal(gravado[legado], true, `o colapso legado "${legado}" foi apagado pela ficha nova`);
    }
    assert.equal(gravado.truques, false);
    assert.equal(gravado['inventory-load-coins'], true);
  });
});

describe('integration/sheet-inventory-details — falha do processador de imagem', () => {
  test('processamento que devolve `null` vira erro NOMEADO, e nenhum candidato é adotado', async () => {
    const processor = createCharacterImageProcessor({ processImageFile: async () => null });
    const resultado = await processor.process({ name: 'retrato.png' });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CHARACTER_IMAGE_UNREADABLE');
  });

  test('processamento que LANÇA vira erro nomeado com a causa preservada', async () => {
    const causa = new Error('canvas indisponível');
    const processor = createCharacterImageProcessor({
      processImageFile: async () => {
        throw causa;
      },
    });
    const resultado = await processor.process({ name: 'retrato.png' });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CHARACTER_IMAGE_PROCESSING_THREW');
    assert.equal(resultado.error.cause, causa);
  });

  test('arquivo ausente é recusado antes de qualquer processamento', async () => {
    let chamou = false;
    const processor = createCharacterImageProcessor({
      processImageFile: async () => {
        chamou = true;
        return 'data:image/png;base64,AAAA';
      },
    });
    const resultado = await processor.process(null);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CHARACTER_IMAGE_FILE_MISSING');
    assert.equal(chamou, false, 'nenhum processamento pode acontecer sem arquivo');
  });

  test('uma imagem gravada que NÃO passa na porta de segurança não vira `src` na ficha montada', async () => {
    // Registro com imagem hostil (é o que um JSON importado pode trazer).
    const character = guerreiro({ identity: { image: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' } });
    const { container, dispose } = await montar({ character });
    try {
      const secao = container.querySelector('[data-sheet-section="personal-details"]');
      assert.equal(secao.querySelector('[data-sheet-character-image]'), null);
      assert.ok(secao.querySelector('[data-sheet-image-rejected]') !== null, 'o motivo da recusa precisa aparecer');
      assert.equal(container.innerHTML.includes('svg+xml'), false, 'a URL recusada não pode vazar para o markup');
    } finally {
      dispose();
    }
  });
});
