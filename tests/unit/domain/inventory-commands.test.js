// Testes dos comandos de inventário (Task 19):
// `site/js/domain/inventory/inventory-commands.js`. Cobre ID próprio por
// instância, quantidade inteira não negativa, reorder como permutação exata,
// simetria add/remove (com read-back) e o registro no dispatcher.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import {
  addInventoryItem,
  removeInventoryItem,
  changeItemQuantity,
  equipItem,
  reorderInventory,
} from '../../../site/js/domain/inventory/inventory-commands.js';
import { executeCharacterCommand } from '../../../site/js/domain/commands/command-dispatcher.js';

const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

/**
 * Entrada de inventário no formato EXATO que
 * `infra/character/migrations/v1-to-v2.js` produz para um item legado:
 * `customDefinition` com o item bruto (menos instanceId/quantidade/equipado),
 * `expended: 0` e `sourceInstanceId: null`.
 * @param {{instanceId: string, nome: string, itemRef?: object|null, quantity?: number, equipped?: boolean, dados?: object}} params
 * @returns {object}
 */
function migratedEntry({ instanceId, nome, itemRef = null, quantity = 1, equipped = false, dados = {} }) {
  return Object.freeze({
    instanceId,
    itemRef,
    customDefinition: { nome, tipo: 'equipamento', dados },
    quantity,
    equipped,
    expended: 0,
    sourceInstanceId: null,
  });
}

/**
 * Personagem canônico com o inventário informado.
 * @param {ReadonlyArray<object>} inventory
 * @returns {object}
 */
function makeCharacter(inventory = []) {
  const base = createEmptyCharacter({ id: 'char-inv', now: '2026-08-02T00:00:00.000Z', rulesetRef: RULESET_REF });
  return Object.freeze({
    ...base,
    state: Object.freeze({ ...base.state, inventory: Object.freeze([...inventory]) }),
  });
}

describe('domain/inventory/inventory-commands — addInventoryItem', () => {
  test('exige instanceId próprio e o preserva na entrada criada', () => {
    const character = makeCharacter();
    const result = addInventoryItem(character, {
      instanceId: 'item-1',
      customDefinition: { nome: 'Corda de Cânhamo', dados: { peso: '5 kg' } },
    });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.inventory.length, 1);
    assert.equal(result.character.state.inventory[0].instanceId, 'item-1');
    assert.deepEqual(result.affected, ['state.inventory']);
    assert.deepEqual(character.state.inventory, []); // original intocado
  });

  test('sem instanceId é erro (o domínio nunca gera id — Math.random/crypto proibidos)', () => {
    const result = addInventoryItem(makeCharacter(), { customDefinition: { nome: 'X' } });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'COMMAND_INVENTORY_INSTANCE_ID_INVALID');
  });

  test('instanceId duplicado é erro explícito, nunca sobrescrita silenciosa', () => {
    const character = makeCharacter([migratedEntry({ instanceId: 'item-1', nome: 'Corda' })]);
    const result = addInventoryItem(character, { instanceId: 'item-1', customDefinition: { nome: 'Outra Corda' } });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'COMMAND_INVENTORY_INSTANCE_ID_DUPLICATE');
    assert.equal(result.character, character);
  });

  test('exige itemRef e/ou customDefinition (entrada sem identidade não é representável)', () => {
    const result = addInventoryItem(makeCharacter(), { instanceId: 'item-1' });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'COMMAND_INVENTORY_ITEM_IDENTITY_MISSING');
  });

  test('aceita sourceInstanceId NULL explícito — é o valor que a migração real grava', () => {
    const result = addInventoryItem(makeCharacter(), {
      instanceId: 'item-1',
      customDefinition: { nome: 'Tocha' },
      sourceInstanceId: null,
    });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.inventory[0].sourceInstanceId, null);
  });

  test('aceita item de catálogo + customDefinition juntos (formato da migração v1->v2)', () => {
    const itemRef = { id: 'dnd2024:armor:cota-de-malha', packageVersion: '1.0.0' };
    const result = addInventoryItem(makeCharacter(), {
      instanceId: 'item-1',
      itemRef,
      customDefinition: { nome: 'Cota de Malha', tipo: 'armadura', dados: { peso: '20 kg' } },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.character.state.inventory[0].itemRef, itemRef);
    assert.equal(result.character.state.inventory[0].customDefinition.dados.peso, '20 kg');
  });

  test('quantidade negativa é recusada', () => {
    const result = addInventoryItem(makeCharacter(), {
      instanceId: 'item-1',
      customDefinition: { nome: 'X' },
      quantity: -1,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'COMMAND_INVENTORY_QUANTITY_INVALID');
  });

  test('atIndex insere na posição pedida (a ordem do inventário é significativa)', () => {
    const character = makeCharacter([
      migratedEntry({ instanceId: 'a', nome: 'A' }),
      migratedEntry({ instanceId: 'b', nome: 'B' }),
    ]);
    const result = addInventoryItem(character, {
      instanceId: 'c',
      customDefinition: { nome: 'C' },
      atIndex: 1,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(
      result.character.state.inventory.map((entry) => entry.instanceId),
      ['a', 'c', 'b'],
    );
  });
});

describe('domain/inventory/inventory-commands — simetria add/remove com read-back', () => {
  test('remover o item adicionado devolve EXATAMENTE o inventário original', () => {
    const original = makeCharacter([migratedEntry({ instanceId: 'a', nome: 'A', dados: { peso: '1 kg' } })]);
    const added = addInventoryItem(original, {
      instanceId: 'b',
      customDefinition: { nome: 'B', tipo: 'equipamento', dados: { peso: '2 kg' } },
    });
    assert.equal(added.ok, true);
    // read-back: o item realmente está lá com os campos que foram pedidos.
    assert.equal(added.character.state.inventory[1].customDefinition.dados.peso, '2 kg');

    const removed = removeInventoryItem(added.character, { instanceId: 'b' });
    assert.equal(removed.ok, true);
    assert.deepEqual(removed.character.state.inventory, original.state.inventory);
  });

  test('remover id inexistente é erro explícito (nunca no-op silencioso)', () => {
    const character = makeCharacter([migratedEntry({ instanceId: 'a', nome: 'A' })]);
    const result = removeInventoryItem(character, { instanceId: 'zzz' });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'COMMAND_INVENTORY_ITEM_NOT_FOUND');
    assert.equal(result.character, character);
  });
});

describe('domain/inventory/inventory-commands — changeItemQuantity', () => {
  test('quantidade absoluta e incremento (+/-) chegam ao mesmo resultado', () => {
    const character = makeCharacter([migratedEntry({ instanceId: 'a', nome: 'Ração', quantity: 2 })]);
    const absoluto = changeItemQuantity(character, { instanceId: 'a', quantity: 3 });
    const incremento = changeItemQuantity(character, { instanceId: 'a', delta: 1 });
    assert.equal(absoluto.ok, true);
    assert.equal(incremento.ok, true);
    assert.equal(absoluto.character.state.inventory[0].quantity, 3);
    assert.equal(incremento.character.state.inventory[0].quantity, 3);
  });

  test('quantidade é sempre inteiro NÃO NEGATIVO', () => {
    const character = makeCharacter([migratedEntry({ instanceId: 'a', nome: 'Ração', quantity: 1 })]);
    const negativa = changeItemQuantity(character, { instanceId: 'a', quantity: -1 });
    assert.equal(negativa.ok, false);
    assert.equal(negativa.error.code, 'COMMAND_INVENTORY_QUANTITY_INVALID');

    const fracionaria = changeItemQuantity(character, { instanceId: 'a', quantity: 1.5 });
    assert.equal(fracionaria.ok, false);
    assert.equal(fracionaria.error.code, 'COMMAND_INVENTORY_QUANTITY_INVALID');

    const deltaNegativo = changeItemQuantity(character, { instanceId: 'a', delta: -5 });
    assert.equal(deltaNegativo.ok, false);
    assert.equal(deltaNegativo.error.code, 'COMMAND_INVENTORY_QUANTITY_NEGATIVE');
    assert.equal(deltaNegativo.character, character);
  });

  test('quantidade 0 é válida e NÃO remove o item (remover é ação separada)', () => {
    const character = makeCharacter([migratedEntry({ instanceId: 'a', nome: 'Ração', quantity: 1 })]);
    const result = changeItemQuantity(character, { instanceId: 'a', quantity: 0 });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.inventory.length, 1);
    assert.equal(result.character.state.inventory[0].quantity, 0);
  });

  test('exige exatamente um entre quantity e delta', () => {
    const character = makeCharacter([migratedEntry({ instanceId: 'a', nome: 'X' })]);
    const ambos = changeItemQuantity(character, { instanceId: 'a', quantity: 2, delta: 1 });
    assert.equal(ambos.ok, false);
    assert.equal(ambos.error.code, 'COMMAND_INVENTORY_QUANTITY_REQUEST_INVALID');
    const nenhum = changeItemQuantity(character, { instanceId: 'a' });
    assert.equal(nenhum.ok, false);
    assert.equal(nenhum.error.code, 'COMMAND_INVENTORY_QUANTITY_REQUEST_INVALID');
  });
});

describe('domain/inventory/inventory-commands — equipItem', () => {
  test('equipar/desequipar é simétrico e volta ao estado original', () => {
    const character = makeCharacter([migratedEntry({ instanceId: 'a', nome: 'Escudo', equipped: false })]);
    const equipado = equipItem(character, { instanceId: 'a', equipped: true });
    assert.equal(equipado.ok, true);
    assert.equal(equipado.character.state.inventory[0].equipped, true);

    const desequipado = equipItem(equipado.character, { instanceId: 'a', equipped: false });
    assert.equal(desequipado.ok, true);
    assert.deepEqual(desequipado.character.state.inventory, character.state.inventory);
  });

  test('NÃO desequipa outras armaduras (paridade com o baseline: toggle não exclusivo)', () => {
    const character = makeCharacter([
      migratedEntry({ instanceId: 'a', nome: 'Gibão de Couro', equipped: true }),
      migratedEntry({ instanceId: 'b', nome: 'Cota de Malha', equipped: false }),
    ]);
    const result = equipItem(character, { instanceId: 'b', equipped: true });
    assert.equal(result.ok, true);
    assert.deepEqual(
      result.character.state.inventory.map((entry) => entry.equipped),
      [true, true],
    );
  });

  test('equipar um item já equipado é no-op com affected vazio', () => {
    const character = makeCharacter([migratedEntry({ instanceId: 'a', nome: 'Escudo', equipped: true })]);
    const result = equipItem(character, { instanceId: 'a', equipped: true });
    assert.equal(result.ok, true);
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
  });
});

describe('domain/inventory/inventory-commands — reorderInventory (permutação exata)', () => {
  const character = makeCharacter([
    migratedEntry({ instanceId: 'a', nome: 'A' }),
    migratedEntry({ instanceId: 'b', nome: 'B' }),
    migratedEntry({ instanceId: 'c', nome: 'C' }),
  ]);

  test('reordena preservando as MESMAS entradas (identidade por referência)', () => {
    const result = reorderInventory(character, { instanceIds: ['c', 'a', 'b'] });
    assert.equal(result.ok, true);
    assert.deepEqual(
      result.character.state.inventory.map((entry) => entry.instanceId),
      ['c', 'a', 'b'],
    );
    assert.equal(result.character.state.inventory[0], character.state.inventory[2]);
  });

  test('id faltando, sobrando, repetido ou estranho é recusado', () => {
    for (const instanceIds of [['a', 'b'], ['a', 'b', 'c', 'd'], ['a', 'a', 'b'], ['a', 'b', 'z']]) {
      const result = reorderInventory(character, { instanceIds });
      assert.equal(result.ok, false, `deveria recusar ${JSON.stringify(instanceIds)}`);
      assert.equal(result.error.code, 'COMMAND_INVENTORY_REORDER_NOT_PERMUTATION');
      assert.equal(result.character, character);
    }
  });

  test('inventário com instanceIds duplicados recusa reordenar (ambíguo)', () => {
    const corrompido = makeCharacter([
      migratedEntry({ instanceId: 'a', nome: 'A' }),
      migratedEntry({ instanceId: 'a', nome: 'A duplicado' }),
    ]);
    const result = reorderInventory(corrompido, { instanceIds: ['a', 'a'] });
    assert.equal(result.ok, false);
    assert.ok(
      ['COMMAND_INVENTORY_REORDER_NOT_PERMUTATION', 'COMMAND_INVENTORY_INSTANCE_IDS_NOT_UNIQUE'].includes(
        result.error.code,
      ),
    );
  });

  test('a mesma ordem é no-op com affected vazio', () => {
    const result = reorderInventory(character, { instanceIds: ['a', 'b', 'c'] });
    assert.equal(result.ok, true);
    assert.deepEqual(result.affected, []);
  });
});

describe('domain/inventory — registro no dispatcher de comandos (Task 17)', () => {
  const character = makeCharacter([migratedEntry({ instanceId: 'a', nome: 'Escudo' })]);

  test('todos os seis comandos da Task 19 são roteáveis por executeCharacterCommand', () => {
    const roteados = [
      ['add-inventory-item', { instanceId: 'novo', customDefinition: { nome: 'Tocha' } }],
      ['remove-inventory-item', { instanceId: 'a' }],
      ['change-item-quantity', { instanceId: 'a', quantity: 4 }],
      ['equip-item', { instanceId: 'a', equipped: true }],
      ['reorder-inventory', { instanceIds: ['a'] }],
      ['change-wallet', { operation: 'add', denomination: 'po', quantity: 1 }],
    ];
    for (const [type, params] of roteados) {
      const result = executeCharacterCommand(
        character,
        { type, ...params },
        { currencyRates: { pc: 1, pp: 10, pe: 50, po: 100, pl: 1000 } },
      );
      assert.notEqual(result.error?.code, 'COMMAND_TYPE_UNKNOWN', `"${type}" não está registrado no dispatcher`);
      assert.ok(Array.isArray(result.affected), `"${type}" deve devolver affected como array`);
    }
  });

  test('change-wallet pelo dispatcher usa o context.currencyRates injetado pela camada de fora', () => {
    const comMoedas = makeCharacter();
    const semTaxas = executeCharacterCommand(comMoedas, {
      type: 'change-wallet',
      operation: 'pay',
      costText: '1 PO',
    });
    assert.equal(semTaxas.ok, false);
    assert.equal(semTaxas.error.code, 'WALLET_CURRENCY_RATES_UNAVAILABLE');
  });
});
