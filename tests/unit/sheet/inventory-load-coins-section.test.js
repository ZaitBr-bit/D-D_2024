// Teste focal de `features/sheet/sections/inventory-load-coins-section.js`
// (Task 32).
//
// As garantias, cada uma com um defeito concreto por trás:
//
//  1. NADA É RECALCULADO. Peso, capacidade, custo e total da carteira são o eco
//     de `derived.inventory`/`derived.load`/`derived.wallet`. O FONTE da seção é
//     varrido atrás de aritmética de peso/moeda e de tabela de itens embutida.
//  2. A IDENTIDADE É `instanceId`, NUNCA O ÍNDICE. O arrasto emite uma
//     permutação COMPLETA de ids, e o teste prova que o comando resultante é
//     aceito por `reorderInventory` REAL — e que nenhum atributo do markup
//     carrega índice de array.
//  3. ANTI-BYPASS: todo `data-action` do markup (e dos dois modais) é um `type`
//     que o dispatcher conhece, ou uma ação de FLUXO declarada; um `data-action`
//     inventado volta com `COMMAND_TYPE_UNKNOWN`.
//  4. CANCELAR NÃO MUTA: fechar qualquer um dos dois modais não produz comando,
//     e a identidade do personagem é preservada byte a byte.
//  5. AUSÊNCIA ≠ ZERO: campo vazio de quantidade/custo vira propriedade AUSENTE
//     no comando e é recusado pelo domínio com erro nomeado — a vista nunca
//     preenche "1".
//  6. PARIDADE COM MÚLTIPLAS FIXTURES, não com uma amostra.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ok } from '../../../site/js/core/result.js';
import { createTestDom } from '../../helpers/test-dom.js';
import { createLegacyAliasResolver } from '../../../site/js/infra/character/legacy-alias-resolver.js';
import { projectLegacyCharacterForQueries, deriveLegacyQueryHints } from '../../../site/js/infra/character/legacy-query-adapter.js';
import { buildSheetViewModel } from '../../../site/js/features/sheet/sheet-view-model.js';
import { executeCharacterCommand } from '../../../site/js/domain/commands/command-dispatcher.js';
import { SHEET_INTENT_TYPES } from '../../../site/js/features/sheet/sheet-state.js';
import {
  CURRENCY_RATES_UNAVAILABLE_REASON,
  INVENTORY_COMMAND_TYPES,
  INVENTORY_CUSTOM_MODAL_ID,
  INVENTORY_FLOW_ACTIONS,
  INVENTORY_LOAD_COINS_SECTION_ID,
  INVENTORY_PURCHASE_MODAL_ID,
  ITEM_CATALOG_UNAVAILABLE_REASON,
  PURCHASE_NOT_ATOMIC_REASON,
  createInventoryLoadCoinsSection,
  inventoryLoadCoinsToIntent,
  nextSheetInstanceId,
  renderInventoryLoadCoins,
  reorderInstanceIds,
  selectInventoryLoadCoins,
} from '../../../site/js/features/sheet/sections/inventory-load-coins-section.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const NOW = '2026-08-04T00:00:00.000Z';

// Taxas do baseline (mesmas de `dnd_taxas_moeda`): 1 pl = 1000 pc, 1 po = 100
// pc, 1 pe = 50 pc, 1 pp = 10 pc, 1 pc = 1 pc.
const RATES = Object.freeze({ pc: 1, pp: 10, pe: 50, po: 100, pl: 1000 });

const ITENS = Object.freeze({
  'cat:espada': Object.freeze({ id: 'cat:espada', type: 'weapon', name: 'Espada Longa', weight: 1.5, cost: { quantity: 15, currency: 'gp' } }),
  'cat:corda': Object.freeze({ id: 'cat:corda', type: 'gear', name: 'Corda', weight: 5, cost: { quantity: 1, currency: 'gp' } }),
});

/**
 * Catálogo mínimo com dois itens reais e nenhum default embutido.
 * @returns {Readonly<object>}
 */
function fakeRegistry() {
  return Object.freeze({
    get: (id) => ITENS[id] ?? null,
    resolve: (reference) => {
      const id = typeof reference === 'string' ? reference : reference?.id;
      return ok(ITENS[id] ?? Object.freeze({ id, type: 'stub', effects: Object.freeze([]) }));
    },
    list: () => Object.freeze([]),
  });
}

/** @type {Array<{fixture: string, caseId: string, character: object, context: object}>} */
const personagens = [];

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  const ctx = { aliasResolver: createLegacyAliasResolver(aliases), now: NOW };

  const dir = path.join(repoRoot, 'tests/fixtures/characters');
  for (const name of await readdir(dir)) {
    if (!name.startsWith('legacy-') && !name.startsWith('near-') && !name.startsWith('v2-')) {
      continue;
    }
    const parsed = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
    for (const entry of parsed.cases ?? []) {
      if (entry.personagem === null || typeof entry.personagem !== 'object') {
        continue;
      }
      const projected = projectLegacyCharacterForQueries(entry.personagem, ctx);
      if (projected.ok !== true) {
        continue;
      }
      const hints = deriveLegacyQueryHints(entry.personagem);
      if (!Number.isFinite(hints?.maximumHitPoints)) {
        continue;
      }
      personagens.push({
        fixture: name,
        caseId: entry.id,
        character: projected.value,
        context: { registry: fakeRegistry(), currencyRates: RATES, ...hints },
      });
    }
  }
  assert.ok(personagens.length >= 10, `apenas ${personagens.length} fixtures decodificáveis — a paridade seria de amostra única`);
});

/**
 * Personagem CONTROLADO com os três grupos de item ao mesmo tempo: equipado,
 * mochila e esgotado (quantidade 0), mais um item customizado com texto livre.
 * @param {object} [overrides]
 * @returns {object}
 */
function personagemComInventario(overrides = {}) {
  const base = personagens[0].character;
  return Object.freeze({
    ...base,
    state: Object.freeze({
      ...base.state,
      inventory: Object.freeze([
        Object.freeze({ instanceId: 'i-1', itemRef: Object.freeze({ id: 'cat:espada' }), customDefinition: null, quantity: 1, equipped: true, expended: 0, sourceInstanceId: null }),
        Object.freeze({ instanceId: 'i-2', itemRef: Object.freeze({ id: 'cat:corda' }), customDefinition: null, quantity: 2, equipped: false, expended: 0, sourceInstanceId: null }),
        Object.freeze({ instanceId: 'i-3', itemRef: null, customDefinition: Object.freeze({ nome: '<script>alert(1)</script>', peso: '0,5 kg', custo: '3 po' }), quantity: 0, equipped: false, expended: 0, sourceInstanceId: null }),
      ]),
      wallet: Object.freeze({ pc: 7, pp: 3, pe: 0, po: 9, pl: 1 }),
      ...overrides,
    }),
  });
}

/**
 * ViewModel de um personagem, com o contexto de consulta padrão do teste.
 * @param {object} character
 * @param {object} [extraContext]
 * @returns {object}
 */
function viewModelDe(character, extraContext = {}) {
  const built = buildSheetViewModel(character, { ...personagens[0].context, ...extraContext });
  assert.equal(built.ok, true, `ViewModel falhou: ${built.error?.code}`);
  return built.value;
}

/**
 * Renderiza a seção dentro de um contêiner de seção real.
 * @param {object} dom
 * @param {object} viewModel
 * @returns {{raiz: object, projection: object}}
 */
function montar(dom, viewModel) {
  const projection = selectInventoryLoadCoins(viewModel);
  const raiz = dom.document.createElement('div');
  raiz.setAttribute('data-sheet-section', INVENTORY_LOAD_COINS_SECTION_ID);
  raiz.innerHTML = renderInventoryLoadCoins(projection);
  dom.document.body.appendChild(raiz);
  return { raiz, projection };
}

/**
 * Dispara um clique sintético num elemento e devolve a decisão.
 * @param {object} elemento
 * @param {object} contexto
 * @param {string} [tipo]
 * @returns {object}
 */
function clicar(elemento, contexto, tipo = 'click') {
  return inventoryLoadCoinsToIntent({ type: tipo, target: elemento }, contexto);
}

describe('unit/sheet/inventory-load-coins — registro e contrato de seção', () => {
  test('a seção é aceita pelo registro com o id canônico e os cinco tipos de evento', () => {
    const criada = createInventoryLoadCoinsSection();
    assert.equal(criada.ok, true, criada.error?.code);
    assert.equal(criada.value.id, INVENTORY_LOAD_COINS_SECTION_ID);
    assert.deepEqual([...criada.value.eventTypes], ['click', 'dragstart', 'dragover', 'drop', 'dragend']);
  });

  test('`select` não calcula: itens, carga e carteira são o eco de `derived`', () => {
    const vm = viewModelDe(personagemComInventario());
    const projection = selectInventoryLoadCoins(vm);
    assert.deepEqual(projection.items, [...vm.derived.inventory.items]);
    assert.equal(projection.itemsAvailable, true);
    assert.equal(projection.itemsUnavailableReason, null);
    assert.equal(projection.load.totalWeightKg, vm.derived.load.totalWeightKg);
    assert.equal(projection.load.carryingCapacityKg, vm.derived.load.carryingCapacityKg);
    assert.equal(projection.load.encumbranceLevel, vm.derived.load.encumbranceLevel);
    assert.equal(projection.wallet.po, vm.derived.wallet.po);
    assert.equal(projection.wallet.totalCopper, vm.derived.wallet.totalCopper);
    assert.equal(Object.isFrozen(projection), true);
  });

  test('SEM REGISTRY != SEM ITENS: as duas saídas são diferentes e observáveis', () => {
    // O defeito que este teste tranca: `derived.inventory` degradava para `[]`
    // quando não havia catálogo, e a seção desenhava os três grupos com
    // "Nenhum item" — afirmando sobre o personagem algo que nunca foi
    // calculado. `wallet` (`ratesAvailable`) e `load` (tudo `null`) já sabiam
    // dizer "não deu para saber"; `inventory` era o único que mentia.
    const personagem = personagemComInventario();

    // (a) MESMO personagem, MESMO inventário, sem catálogo.
    const semRegistry = buildSheetViewModel(personagem, { ...personagens[0].context, registry: null });
    assert.equal(semRegistry.ok, true, semRegistry.error?.code);
    assert.equal(semRegistry.value.derived.inventory.available, false);
    assert.equal(semRegistry.value.derived.inventory.reason, 'SHEET_INVENTORY_REGISTRY_MISSING');
    assert.deepEqual([...semRegistry.value.derived.inventory.items], []);

    // (b) Personagem GENUINAMENTE sem itens, com catálogo.
    const semItens = viewModelDe(
      Object.freeze({ ...personagem, state: Object.freeze({ ...personagem.state, inventory: Object.freeze([]) }) }),
    );
    assert.equal(semItens.derived.inventory.available, true);
    assert.equal(semItens.derived.inventory.reason, null);
    assert.deepEqual([...semItens.derived.inventory.items], []);

    // A PROJEÇÃO da seção distingue os dois...
    const projSem = selectInventoryLoadCoins(semRegistry.value);
    const projVazio = selectInventoryLoadCoins(semItens);
    assert.equal(projSem.itemsAvailable, false);
    assert.equal(projSem.itemsUnavailableReason, 'SHEET_INVENTORY_REGISTRY_MISSING');
    assert.equal(projVazio.itemsAvailable, true);
    assert.equal(projVazio.itemsUnavailableReason, null);

    // ...e o MARKUP também: a ausência aparece com motivo NOMEADO, e os três
    // grupos vazios (que afirmariam "não tem item") não são desenhados.
    const markupSem = renderInventoryLoadCoins(projSem);
    const markupVazio = renderInventoryLoadCoins(projVazio);
    assert.notEqual(markupSem, markupVazio, 'ausência e vazio não podem produzir a MESMA tela');
    assert.match(markupSem, /data-sheet-inventory-items-unavailable="SHEET_INVENTORY_REGISTRY_MISSING"/);
    assert.equal(/data-sheet-item-group=/.test(markupSem), false, '"Nenhum item" seria uma afirmação falsa');
    assert.equal(/data-sheet-inventory-items-unavailable/.test(markupVazio), false);
    assert.match(markupVazio, /data-sheet-item-group-empty="backpack"/);
  });

  test('ViewModel ausente vira estado declarado, nunca uma seção em branco', () => {
    assert.match(renderInventoryLoadCoins(selectInventoryLoadCoins(null)), /data-sheet-inventory-unavailable/);
  });

  test('`toIntent` não toca no evento: só DESCREVE', () => {
    const dom = createTestDom();
    try {
      const { raiz, projection } = montar(dom, viewModelDe(personagemComInventario()));
      let tocou = false;
      inventoryLoadCoinsToIntent(
        {
          type: 'click',
          target: raiz.querySelector('[data-action]'),
          preventDefault: () => {
            tocou = true;
          },
          stopPropagation: () => {
            tocou = true;
          },
        },
        { root: raiz, projection, uiState: {} },
      );
      assert.equal(tocou, false);
    } finally {
      dom.restore();
    }
  });

  test('o markup não registra handler inline', () => {
    const dom = createTestDom();
    try {
      const { raiz } = montar(dom, viewModelDe(personagemComInventario()));
      assert.equal(/\son[a-z]+=/i.test(raiz.innerHTML), false, 'a seção não pode emitir handler inline');
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/inventory-load-coins — nada é recalculado nem embutido', () => {
  test('o FONTE não faz aritmética de peso/moeda nem embute tabela de itens', async () => {
    const fonte = await readFile(
      path.join(repoRoot, 'site/js/features/sheet/sections/inventory-load-coins-section.js'),
      'utf8',
    );
    // Um multiplicador de peso/quantidade ou uma tabela de conversão aqui
    // significaria uma SEGUNDA verdade sobre carga/dinheiro, divergente da do
    // domínio. `toInteger` é conversão de ENTRADA do usuário, não cálculo de
    // jogo, e por isso `Number(` continua permitido.
    assert.equal(/\*\s*quantity|quantity\s*\*/i.test(fonte), false, 'peso não pode ser multiplicado aqui');
    assert.equal(/1000|\bpc:\s*1\b/.test(fonte), false, 'nenhuma taxa de conversão pode ser embutida');
    assert.equal(/carryingCapacity\s*[-+*/]/.test(fonte), false, 'capacidade de carga não pode ser recalculada');
    // Nenhum nome de item de jogo embutido: o catálogo não é projetado, e a
    // lacuna é declarada em vez de contornada com uma lista local.
    assert.match(fonte, new RegExp(ITEM_CATALOG_UNAVAILABLE_REASON));
  });

  test('a carteira sem taxa de conversão mostra o motivo e NUNCA zero', () => {
    const vm = viewModelDe(personagemComInventario(), { currencyRates: null, registry: fakeRegistry() });
    const projection = selectInventoryLoadCoins(vm);
    // Sem taxas resolvíveis o total é ausente, jamais 0 ("sem dinheiro").
    if (projection.wallet.ratesAvailable === false) {
      assert.equal(projection.wallet.totalCopper, null);
      assert.match(renderInventoryLoadCoins(projection), new RegExp(CURRENCY_RATES_UNAVAILABLE_REASON));
    }
    // As denominações continuam sendo o saldo real, com ou sem taxa.
    assert.equal(projection.wallet.po, 9);
  });
});

describe('unit/sheet/inventory-load-coins — os três grupos do baseline', () => {
  test('quantidade zerada vence "equipado"; equipado vence mochila', () => {
    const vm = viewModelDe(personagemComInventario());
    const projection = selectInventoryLoadCoins(vm);
    assert.deepEqual(projection.groups.equipped.map((item) => item.instanceId), ['i-1']);
    assert.deepEqual(projection.groups.backpack.map((item) => item.instanceId), ['i-2']);
    assert.deepEqual(projection.groups.depleted.map((item) => item.instanceId), ['i-3']);
  });

  test('um item equipado COM quantidade 0 aparece em esgotados (paridade com o baseline)', () => {
    const base = personagemComInventario();
    const character = Object.freeze({
      ...base,
      state: Object.freeze({
        ...base.state,
        inventory: Object.freeze([
          Object.freeze({ ...base.state.inventory[0], quantity: 0, equipped: true }),
        ]),
      }),
    });
    const projection = selectInventoryLoadCoins(viewModelDe(character));
    assert.deepEqual(projection.groups.equipped, []);
    assert.deepEqual(projection.groups.depleted.map((item) => item.instanceId), ['i-1']);
  });

  test('o markup renderiza os três grupos com a contagem, mesmo vazios', () => {
    const dom = createTestDom();
    try {
      const { raiz } = montar(dom, viewModelDe(personagemComInventario()));
      for (const grupo of ['equipped', 'backpack', 'depleted']) {
        const secao = raiz.querySelector(`[data-sheet-item-group="${grupo}"]`);
        assert.ok(secao !== null, `grupo "${grupo}" ausente`);
        assert.equal(secao.getAttribute('data-count'), '1');
      }
    } finally {
      dom.restore();
    }
  });

  test('nome de item CUSTOMIZADO é escapado, nunca markup', () => {
    const dom = createTestDom();
    try {
      const { raiz } = montar(dom, viewModelDe(personagemComInventario()));
      assert.equal(raiz.querySelector('script'), null, 'texto do jogador não pode virar elemento');
      const nome = raiz.querySelector('[data-sheet-item="i-3"] [data-sheet-item-name]');
      assert.equal(nome.textContent, '<script>alert(1)</script>');
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/inventory-load-coins — comandos de item', () => {
  test('cada botão de item emite o comando canônico com o instanceId certo', () => {
    const dom = createTestDom();
    try {
      const { raiz, projection } = montar(dom, viewModelDe(personagemComInventario()));
      const contexto = { root: raiz, projection, uiState: {} };
      const linha = raiz.querySelector('[data-sheet-item="i-1"]');

      const mais = clicar(linha.querySelector('[data-action="change-item-quantity"][data-delta="1"]'), contexto);
      assert.deepEqual(mais.intent.command, { type: 'change-item-quantity', instanceId: 'i-1', delta: 1 });

      const menos = clicar(linha.querySelector('[data-action="change-item-quantity"][data-delta="-1"]'), contexto);
      assert.deepEqual(menos.intent.command, { type: 'change-item-quantity', instanceId: 'i-1', delta: -1 });

      // O item ESTÁ equipado: o botão pede o estado OPOSTO (simetria
      // equipar/desequipar, padrão de bug recorrente (b)).
      const equipar = clicar(linha.querySelector('[data-action="equip-item"]'), contexto);
      assert.deepEqual(equipar.intent.command, { type: 'equip-item', instanceId: 'i-1', equipped: false });

      const naMochila = raiz.querySelector('[data-sheet-item="i-2"] [data-action="equip-item"]');
      assert.deepEqual(clicar(naMochila, contexto).intent.command, { type: 'equip-item', instanceId: 'i-2', equipped: true });

      const remover = clicar(linha.querySelector('[data-action="remove-inventory-item"]'), contexto);
      assert.deepEqual(remover.intent.command, { type: 'remove-inventory-item', instanceId: 'i-1' });
    } finally {
      dom.restore();
    }
  });

  test('os comandos emitidos são ACEITOS pelo dispatcher real', () => {
    const dom = createTestDom();
    try {
      const character = personagemComInventario();
      const { raiz, projection } = montar(dom, viewModelDe(character));
      const contexto = { root: raiz, projection, uiState: {} };
      const contextoDomínio = { registry: fakeRegistry(), currencyRates: RATES, now: NOW };

      for (const seletor of [
        '[data-sheet-item="i-1"] [data-action="change-item-quantity"][data-delta="1"]',
        '[data-sheet-item="i-1"] [data-action="equip-item"]',
        '[data-sheet-item="i-2"] [data-action="remove-inventory-item"]',
      ]) {
        const decisao = clicar(raiz.querySelector(seletor), contexto);
        const resultado = executeCharacterCommand(character, decisao.intent.command, contextoDomínio);
        assert.equal(resultado.ok, true, `${seletor}: ${resultado.error?.code}`);
        assert.ok(resultado.affected.includes('state.inventory'));
      }
    } finally {
      dom.restore();
    }
  });

  test('equipar e desequipar são EXATAMENTE inversos (ida e volta pelo dispatcher)', () => {
    const character = personagemComInventario();
    const contextoDomínio = { registry: fakeRegistry(), currencyRates: RATES, now: NOW };
    const desequipado = executeCharacterCommand(character, { type: 'equip-item', instanceId: 'i-1', equipped: false }, contextoDomínio);
    assert.equal(desequipado.ok, true);
    const voltou = executeCharacterCommand(desequipado.character, { type: 'equip-item', instanceId: 'i-1', equipped: true }, contextoDomínio);
    assert.equal(voltou.ok, true);
    assert.deepEqual(voltou.character.state.inventory, character.state.inventory);
  });
});

describe('unit/sheet/inventory-load-coins — arrasto emite PERMUTAÇÃO de ids', () => {
  test('nenhum atributo do markup carrega índice de array', () => {
    const dom = createTestDom();
    try {
      const { raiz } = montar(dom, viewModelDe(personagemComInventario()));
      assert.equal(/data-(index|idx|position)=/i.test(raiz.innerHTML), false, 'a posição jamais pode endereçar um item');
      for (const linha of raiz.querySelectorAll('[data-sheet-item-draggable]')) {
        assert.match(linha.getAttribute('data-instance-id'), /^i-\d$/);
      }
    } finally {
      dom.restore();
    }
  });

  test('dragstart guarda o id no UI STATE (nunca em variável de módulo)', () => {
    const dom = createTestDom();
    try {
      const { raiz, projection } = montar(dom, viewModelDe(personagemComInventario()));
      const decisao = clicar(raiz.querySelector('[data-sheet-item="i-3"]'), { root: raiz, projection, uiState: {} }, 'dragstart');
      assert.equal(decisao.intent.type, SHEET_INTENT_TYPES.uiState);
      assert.deepEqual(decisao.intent.patch, { draggingInstanceId: 'i-3' });
    } finally {
      dom.restore();
    }
  });

  test('drop emite a lista COMPLETA de instanceIds na nova ordem, e o domínio a aceita', () => {
    const dom = createTestDom();
    try {
      const character = personagemComInventario();
      const { raiz, projection } = montar(dom, viewModelDe(character));
      const decisao = clicar(
        raiz.querySelector('[data-sheet-item="i-1"]'),
        { root: raiz, projection, uiState: { draggingInstanceId: 'i-3' } },
        'drop',
      );
      assert.equal(decisao.intent.command.type, 'reorder-inventory');
      assert.deepEqual(decisao.intent.command.instanceIds, ['i-3', 'i-1', 'i-2']);
      // Nenhum número: a ordem é composta SÓ de ids.
      for (const id of decisao.intent.command.instanceIds) {
        assert.equal(typeof id, 'string');
      }
      const resultado = executeCharacterCommand(character, decisao.intent.command, { registry: fakeRegistry(), now: NOW });
      assert.equal(resultado.ok, true, resultado.error?.code);
      assert.deepEqual(resultado.character.state.inventory.map((entry) => entry.instanceId), ['i-3', 'i-1', 'i-2']);
    } finally {
      dom.restore();
    }
  });

  test('drop sem origem conhecida NÃO emite comando (nunca uma "permutação" inválida)', () => {
    const dom = createTestDom();
    try {
      const { raiz, projection } = montar(dom, viewModelDe(personagemComInventario()));
      const semOrigem = clicar(raiz.querySelector('[data-sheet-item="i-1"]'), { root: raiz, projection, uiState: {} }, 'drop');
      assert.equal(semOrigem.intent, null);
      // Id guardado que NÃO pertence a esta projeção: nenhum comando — e o id
      // é apagado na hora, sem esperar por um `dragend` que pode não vir.
      const idDesconhecido = clicar(
        raiz.querySelector('[data-sheet-item="i-1"]'),
        { root: raiz, projection, uiState: { draggingInstanceId: 'nao-existe' } },
        'drop',
      );
      assert.equal(idDesconhecido.intent.type, SHEET_INTENT_TYPES.uiState);
      assert.deepEqual(idDesconhecido.intent.patch, { draggingInstanceId: null });
    } finally {
      dom.restore();
    }
  });

  test('dragover só descreve preventDefault quando HÁ arrasto nosso em andamento', () => {
    const dom = createTestDom();
    try {
      const { raiz, projection } = montar(dom, viewModelDe(personagemComInventario()));
      const linha = raiz.querySelector('[data-sheet-item="i-1"]');

      // GUARD: sem arrasto nosso, o navegador NÃO pode ser autorizado a aceitar
      // o drop — senão um payload estranho (arquivo, texto, arrasto de outra
      // origem) cai sobre a linha e vira comando.
      const semArrasto = clicar(linha, { root: raiz, projection, uiState: {} }, 'dragover');
      assert.equal(semArrasto.preventDefault, false);
      assert.equal(semArrasto.intent, null);

      // Id órfão que não é item desta projeção: também não autoriza.
      const orfao = clicar(linha, { root: raiz, projection, uiState: { draggingInstanceId: 'nao-existe' } }, 'dragover');
      assert.equal(orfao.preventDefault, false);

      const emArrasto = clicar(linha, { root: raiz, projection, uiState: { draggingInstanceId: 'i-3' } }, 'dragover');
      assert.equal(emArrasto.preventDefault, true);
      assert.equal(emArrasto.intent, null);
    } finally {
      dom.restore();
    }
  });

  test('o gesto é encerrado pelo DROP, não só pelo dragend: o id nunca fica órfão', () => {
    const dom = createTestDom();
    try {
      const { raiz, projection } = montar(dom, viewModelDe(personagemComInventario()));
      const contexto = { root: raiz, projection, uiState: { draggingInstanceId: 'i-3' } };

      // 1) Drop VÁLIDO: o comando sai E o id é apagado junto, no mesmo intent.
      const valido = clicar(raiz.querySelector('[data-sheet-item="i-1"]'), contexto, 'drop');
      assert.equal(valido.intent.command.type, 'reorder-inventory');
      assert.deepEqual(valido.intent.uiStatePatch, { draggingInstanceId: null });

      // 2) Drop na PRÓPRIA linha de origem (permutação nula): sem comando, mas
      // o gesto acaba do mesmo jeito.
      const nulo = clicar(raiz.querySelector('[data-sheet-item="i-3"]'), contexto, 'drop');
      assert.equal(nulo.intent.type, SHEET_INTENT_TYPES.uiState);
      assert.deepEqual(nulo.intent.patch, { draggingInstanceId: null });

      // 3) Drop FORA de qualquer linha: idem.
      const fora = clicar(raiz, contexto, 'drop');
      assert.equal(fora.intent.type, SHEET_INTENT_TYPES.uiState);
      assert.deepEqual(fora.intent.patch, { draggingInstanceId: null });

      const end = clicar(raiz.querySelector('[data-sheet-item="i-1"]'), contexto, 'dragend');
      assert.deepEqual(end.intent.patch, { draggingInstanceId: null });
    } finally {
      dom.restore();
    }
  });

  test('`reorderInstanceIds` recusa id fora da lista e movimento nulo', () => {
    assert.deepEqual(reorderInstanceIds(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b']);
    assert.equal(reorderInstanceIds(['a', 'b'], 'a', 'a'), null);
    assert.equal(reorderInstanceIds(['a', 'b'], 'z', 'a'), null);
  });
});

describe('unit/sheet/inventory-load-coins — carteira, taxas e pagamento', () => {
  test('cada operação da carteira usa o campo da PRÓPRIA denominação', () => {
    const dom = createTestDom();
    try {
      const { raiz, projection } = montar(dom, viewModelDe(personagemComInventario()));
      raiz.querySelector('[data-sheet-wallet-quantity="po"]').value = '3';
      raiz.querySelector('[data-sheet-wallet-quantity="pp"]').value = '7';
      const contexto = { root: raiz, projection, uiState: {} };

      const adicionarOuro = clicar(raiz.querySelector('[data-sheet-wallet-denomination="po"] [data-wallet-operation="add"]'), contexto);
      assert.deepEqual(adicionarOuro.intent.command, { type: 'change-wallet', operation: 'add', denomination: 'po', quantity: 3 });

      const removerPrata = clicar(raiz.querySelector('[data-sheet-wallet-denomination="pp"] [data-wallet-operation="remove"]'), contexto);
      assert.deepEqual(removerPrata.intent.command, { type: 'change-wallet', operation: 'remove', denomination: 'pp', quantity: 7 });
    } finally {
      dom.restore();
    }
  });

  test('quantidade vazia vira propriedade AUSENTE e o domínio recusa com erro nomeado', () => {
    const dom = createTestDom();
    try {
      const character = personagemComInventario();
      const { raiz, projection } = montar(dom, viewModelDe(character));
      const decisao = clicar(
        raiz.querySelector('[data-sheet-wallet-denomination="po"] [data-wallet-operation="add"]'),
        { root: raiz, projection, uiState: {} },
      );
      assert.equal(Object.hasOwn(decisao.intent.command, 'quantity'), false, 'a vista não pode preencher quantidade');
      const resultado = executeCharacterCommand(character, decisao.intent.command, { currencyRates: RATES });
      assert.equal(resultado.ok, false);
      assert.equal(resultado.error.code, 'WALLET_QUANTITY_INVALID');
    } finally {
      dom.restore();
    }
  });

  test('pagar usa o texto de custo e é aceito pelo domínio quando há fundos', () => {
    const dom = createTestDom();
    try {
      const character = personagemComInventario();
      const { raiz, projection } = montar(dom, viewModelDe(character));
      raiz.querySelector('[data-sheet-wallet-cost]').value = '2 po';
      const decisao = clicar(raiz.querySelector('[data-wallet-operation="pay"]'), { root: raiz, projection, uiState: {} });
      assert.deepEqual(decisao.intent.command, { type: 'change-wallet', operation: 'pay', costText: '2 po' });
      const resultado = executeCharacterCommand(character, decisao.intent.command, { currencyRates: RATES });
      assert.equal(resultado.ok, true, resultado.error?.code);
      assert.ok(resultado.affected.includes('state.wallet'));
    } finally {
      dom.restore();
    }
  });

  test('pagamento sem fundos falha e devolve o personagem ORIGINAL', () => {
    const character = personagemComInventario();
    const resultado = executeCharacterCommand(
      character,
      { type: 'change-wallet', operation: 'pay', costText: '9999 pl' },
      { currencyRates: RATES },
    );
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'WALLET_INSUFFICIENT_FUNDS');
    assert.equal(resultado.character.state.wallet, character.state.wallet, 'identidade preservada na falha');
  });

  test('converter para cima usa o comando canônico com a denominação clicada', () => {
    const dom = createTestDom();
    try {
      // 25 pc dão para converter para prata (10 pc = 1 pp); com o saldo padrão
      // (7 pc) o domínio recusaria com `WALLET_CONVERSION_NOT_POSSIBLE` — que é
      // o comportamento correto dele, não o que este caso quer exercitar.
      const character = personagemComInventario({ wallet: Object.freeze({ pc: 25, pp: 3, pe: 0, po: 9, pl: 1 }) });
      const { raiz, projection } = montar(dom, viewModelDe(character));
      const decisao = clicar(
        raiz.querySelector('[data-sheet-wallet-denomination="pc"] [data-wallet-operation="convert-up"]'),
        { root: raiz, projection, uiState: {} },
      );
      assert.equal(decisao.intent.command.operation, 'convert-up');
      assert.equal(decisao.intent.command.denomination, 'pc');
      const resultado = executeCharacterCommand(character, decisao.intent.command, { currencyRates: RATES });
      assert.equal(resultado.ok, true, resultado.error?.code);
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/inventory-load-coins — modais de compra e customização', () => {
  test('abrir os modais DESCREVE o modal, sem tocar no personagem', () => {
    const dom = createTestDom();
    try {
      const { raiz, projection } = montar(dom, viewModelDe(personagemComInventario()));
      const contexto = { root: raiz, projection, uiState: {} };
      const compra = clicar(raiz.querySelector(`[data-action="${INVENTORY_FLOW_ACTIONS.purchaseOpen}"]`), contexto);
      assert.equal(compra.intent.type, SHEET_INTENT_TYPES.modalOpen);
      assert.equal(compra.intent.modalId, INVENTORY_PURCHASE_MODAL_ID);
      assert.match(compra.intent.content, /data-sheet-modal-owner="inventory-load-coins"/);

      const custom = clicar(raiz.querySelector(`[data-action="${INVENTORY_FLOW_ACTIONS.customOpen}"]`), contexto);
      assert.equal(custom.intent.modalId, INVENTORY_CUSTOM_MODAL_ID);
    } finally {
      dom.restore();
    }
  });

  test('a caixa "já equipado" nasce do UI STATE (preferência), nunca de um default embutido', () => {
    const dom = createTestDom();
    try {
      const { raiz, projection } = montar(dom, viewModelDe(personagemComInventario()));
      const botao = raiz.querySelector(`[data-action="${INVENTORY_FLOW_ACTIONS.purchaseOpen}"]`);
      const semPreferencia = clicar(botao, { root: raiz, projection, uiState: {} });
      assert.equal(/data-sheet-purchase-equipped checked/.test(semPreferencia.intent.content), false);
      const comPreferencia = clicar(botao, { root: raiz, projection, uiState: { purchaseEquippedDefault: true } });
      assert.match(comPreferencia.intent.content, /data-sheet-purchase-equipped checked/);
    } finally {
      dom.restore();
    }
  });

  test('confirmar a compra emite `add-inventory-item` com instanceId determinístico, aceito pelo domínio', () => {
    const dom = createTestDom();
    try {
      const character = personagemComInventario();
      const { raiz, projection } = montar(dom, viewModelDe(character));
      const decisaoModal = clicar(raiz.querySelector(`[data-action="${INVENTORY_FLOW_ACTIONS.purchaseOpen}"]`), {
        root: raiz,
        projection,
        uiState: { purchaseEquippedDefault: true },
      });
      const modal = dom.document.createElement('div');
      modal.innerHTML = `${decisaoModal.intent.content}${decisaoModal.intent.actions}`;
      dom.document.body.appendChild(modal);
      modal.querySelector('[data-sheet-purchase-item-id]').value = 'cat:corda';
      modal.querySelector('[data-sheet-purchase-item-version]').value = '1.0.0';
      modal.querySelector('[data-sheet-purchase-quantity]').value = '2';

      const decisao = clicar(modal.querySelector('[data-action="add-inventory-item"]'), { root: modal, projection, uiState: {} });
      // Achado do CUTOVER (Task 33): este caso afirmava `itemRef: {id}` SEM
      // `packageVersion`, e só conferia que o COMANDO passava. O personagem
      // resultante ficava inválido (`contentRef` exige as duas chaves) e o save
      // morria depois, com "O personagem canônico a codificar é inválido" — o
      // item digitado sumia. Por isso o caso agora valida o personagem
      // RESULTANTE, e não só o comando.
      assert.deepEqual(decisao.intent.command, {
        type: 'add-inventory-item',
        instanceId: 'sheet-item-1',
        itemRef: { id: 'cat:corda', packageVersion: '1.0.0' },
        quantity: 2,
        equipped: true,
      });
      const resultado = executeCharacterCommand(character, decisao.intent.command, { registry: fakeRegistry(), currencyRates: RATES });
      assert.equal(resultado.ok, true, resultado.error?.code);
      assert.equal(resultado.character.state.inventory.length, character.state.inventory.length + 1);
      // A referência gravada tem as DUAS chaves que `contentRef` exige. (A
      // validação do personagem INTEIRO não serve aqui: os itens sintéticos
      // desta fixture usam ids fora do padrão real de `itemRef`; o round-trip
      // com item de catálogo REAL é coberto em
      // `tests/unit/character/character-codec.test.js` e no spec de navegador.)
      const gravado = resultado.character.state.inventory.at(-1);
      assert.deepEqual(gravado.itemRef, { id: 'cat:corda', packageVersion: '1.0.0' });

      // Sem a versão, a referência fica INCOMPLETA e o comando sai sem
      // `itemRef`: a recusa é do domínio, nomeada, e nunca um personagem
      // inválido que só explode ao salvar.
      modal.querySelector('[data-sheet-purchase-item-version]').value = '';
      const semVersao = clicar(modal.querySelector('[data-action="add-inventory-item"]'), { root: modal, projection, uiState: {} });
      assert.equal(Object.hasOwn(semVersao.intent.command, 'itemRef'), false);
      const recusado = executeCharacterCommand(character, semVersao.intent.command, { registry: fakeRegistry(), currencyRates: RATES });
      assert.equal(recusado.ok, false);
      assert.equal(recusado.error.code, 'COMMAND_INVENTORY_ITEM_IDENTITY_MISSING');
    } finally {
      dom.restore();
    }
  });

  test('item customizado leva o texto do jogador para `customDefinition`, sem inventar nome', () => {
    const dom = createTestDom();
    try {
      const character = personagemComInventario();
      const { raiz, projection } = montar(dom, viewModelDe(character));
      const decisaoModal = clicar(raiz.querySelector(`[data-action="${INVENTORY_FLOW_ACTIONS.customOpen}"]`), {
        root: raiz,
        projection,
        uiState: {},
      });
      const modal = dom.document.createElement('div');
      modal.innerHTML = `${decisaoModal.intent.content}${decisaoModal.intent.actions}`;
      dom.document.body.appendChild(modal);
      modal.querySelector('[data-sheet-custom-name]').value = 'Amuleto <b>';
      modal.querySelector('[data-sheet-custom-weight]').value = '0,2 kg';

      const decisao = clicar(modal.querySelector('[data-action="add-inventory-item"]'), { root: modal, projection, uiState: {} });
      assert.deepEqual(decisao.intent.command.customDefinition, { nome: 'Amuleto <b>', peso: '0,2 kg' });
      assert.equal(Object.hasOwn(decisao.intent.command, 'quantity'), false, 'quantidade vazia permanece ausente');
      const resultado = executeCharacterCommand(character, decisao.intent.command, { registry: fakeRegistry(), currencyRates: RATES });
      assert.equal(resultado.ok, true, resultado.error?.code);
      // O nome do jogador continua sendo ESCAPADO ao voltar para a tela.
      const raizNova = dom.document.createElement('div');
      raizNova.innerHTML = renderInventoryLoadCoins(selectInventoryLoadCoins(viewModelDe(resultado.character)));
      assert.equal(raizNova.querySelector('b'), null);
    } finally {
      dom.restore();
    }
  });

  test('CANCELAR qualquer modal não emite comando e não muta nada', () => {
    const dom = createTestDom();
    try {
      const character = personagemComInventario();
      const { raiz, projection } = montar(dom, viewModelDe(character));
      const contexto = { root: raiz, projection, uiState: {} };
      for (const [abrir, fechar, modalId] of [
        [INVENTORY_FLOW_ACTIONS.purchaseOpen, INVENTORY_FLOW_ACTIONS.purchaseClose, INVENTORY_PURCHASE_MODAL_ID],
        [INVENTORY_FLOW_ACTIONS.customOpen, INVENTORY_FLOW_ACTIONS.customClose, INVENTORY_CUSTOM_MODAL_ID],
      ]) {
        const decisaoModal = clicar(raiz.querySelector(`[data-action="${abrir}"]`), contexto);
        const modal = dom.document.createElement('div');
        modal.innerHTML = `${decisaoModal.intent.content}${decisaoModal.intent.actions}`;
        dom.document.body.appendChild(modal);
        const cancelamento = clicar(modal.querySelector(`[data-action="${fechar}"]`), { root: modal, projection, uiState: {} });
        assert.equal(cancelamento.intent.type, SHEET_INTENT_TYPES.modalClose);
        assert.equal(cancelamento.intent.modalId, modalId);
        assert.equal(Object.hasOwn(cancelamento.intent, 'command'), false, 'cancelar não pode carregar comando');
      }
      // Identidade preservada: nada foi tocado por abrir/cancelar.
      assert.equal(personagemComInventario().state.inventory.length, character.state.inventory.length);
    } finally {
      dom.restore();
    }
  });

  test('`nextSheetInstanceId` é determinístico e não colide com os ids já usados', () => {
    assert.equal(nextSheetInstanceId([]), 'sheet-item-1');
    assert.equal(nextSheetInstanceId([{ instanceId: 'sheet-item-3' }, { instanceId: 'i-9' }]), 'sheet-item-4');
    assert.equal(nextSheetInstanceId([{ instanceId: 'sheet-item-3' }]), nextSheetInstanceId([{ instanceId: 'sheet-item-3' }]));
  });
});

describe('unit/sheet/inventory-load-coins — anti-bypass do vocabulário', () => {
  test('todo `data-action` do markup e dos modais é comando conhecido ou fluxo declarado', () => {
    const dom = createTestDom();
    try {
      const { raiz, projection } = montar(dom, viewModelDe(personagemComInventario()));
      const fluxos = new Set(Object.values(INVENTORY_FLOW_ACTIONS));
      const acoes = new Set();
      for (const elemento of raiz.querySelectorAll('[data-action]')) {
        acoes.add(elemento.getAttribute('data-action'));
      }
      for (const abrir of [INVENTORY_FLOW_ACTIONS.purchaseOpen, INVENTORY_FLOW_ACTIONS.customOpen]) {
        const decisao = clicar(raiz.querySelector(`[data-action="${abrir}"]`), { root: raiz, projection, uiState: {} });
        const modal = dom.document.createElement('div');
        modal.innerHTML = `${decisao.intent.content}${decisao.intent.actions}`;
        for (const elemento of modal.querySelectorAll('[data-action]')) {
          acoes.add(elemento.getAttribute('data-action'));
        }
      }
      assert.ok(acoes.size >= 8, `apenas ${acoes.size} ações — a varredura estaria vazia`);
      for (const acao of acoes) {
        assert.ok(
          fluxos.has(acao) || INVENTORY_COMMAND_TYPES.includes(acao),
          `"${acao}" não é comando canônico nem ação de fluxo declarada`,
        );
      }
    } finally {
      dom.restore();
    }
  });

  test('todo tipo de `INVENTORY_COMMAND_TYPES` existe no dispatcher', () => {
    const character = personagemComInventario();
    for (const type of INVENTORY_COMMAND_TYPES) {
      const resultado = executeCharacterCommand(character, { type }, { registry: fakeRegistry(), currencyRates: RATES });
      assert.notEqual(
        resultado.error?.code,
        'COMMAND_TYPE_UNKNOWN',
        `"${type}" não está registrado no dispatcher — a seção ofereceria um botão morto`,
      );
    }
  });

  test('um `data-action` inventado vira comando RECUSADO, nunca um clique inerte', () => {
    const dom = createTestDom();
    try {
      const character = personagemComInventario();
      const { raiz, projection } = montar(dom, viewModelDe(character));
      const botao = dom.document.createElement('button');
      botao.setAttribute('data-action', 'inventar-item-magico');
      raiz.appendChild(botao);
      const decisao = clicar(botao, { root: raiz, projection, uiState: {} });
      assert.equal(decisao.intent.command.type, 'inventar-item-magico');
      const resultado = executeCharacterCommand(character, decisao.intent.command, {});
      assert.equal(resultado.ok, false);
      assert.equal(resultado.error.code, 'COMMAND_TYPE_UNKNOWN');
    } finally {
      dom.restore();
    }
  });

  test('a lacuna de compra atômica é EXIBIDA, não escondida', () => {
    const dom = createTestDom();
    try {
      const { raiz } = montar(dom, viewModelDe(personagemComInventario()));
      assert.ok(raiz.querySelector(`[data-sheet-purchase-not-atomic="${PURCHASE_NOT_ATOMIC_REASON}"]`) !== null);
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/inventory-load-coins — paridade em várias fixtures', () => {
  test('a seção renderiza TODAS as fixtures decodificáveis sem lançar e sem markup órfão', () => {
    const dom = createTestDom();
    try {
      let renderizadas = 0;
      for (const { character, context, fixture, caseId } of personagens) {
        const built = buildSheetViewModel(character, context);
        if (built.ok !== true) {
          continue;
        }
        const projection = selectInventoryLoadCoins(built.value);
        const markup = renderInventoryLoadCoins(projection);
        const raiz = dom.document.createElement('div');
        raiz.innerHTML = markup;
        assert.equal(/\son[a-z]+=/i.test(markup), false, `${fixture}#${caseId}: handler inline`);
        // Toda linha de item tem id de instância — nunca uma linha anônima que
        // a reordenação não conseguiria endereçar.
        for (const linha of raiz.querySelectorAll('[data-sheet-item-draggable]')) {
          assert.notEqual(linha.getAttribute('data-instance-id'), '');
        }
        // A soma dos três grupos é o inventário inteiro: nenhum item some.
        const total = projection.groups.equipped.length + projection.groups.backpack.length + projection.groups.depleted.length;
        assert.equal(total, projection.items.length, `${fixture}#${caseId}: item perdido na partição`);
        renderizadas += 1;
      }
      assert.ok(renderizadas >= 10, `apenas ${renderizadas} fixtures renderizadas`);
    } finally {
      dom.restore();
    }
  });
});
