// ============================================================
// Issue #80 -- locais customizados no inventario (ex.: Bolsa de
// Armazenamento): itens guardados num local "sem peso" nao entram no peso
// total; sem locais, o peso e o de sempre.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { utils } = await modulosApp();
const inv = [
  { nome: 'Bolsa', quantidade: 1, dados: { peso: '2,3 kg' } },
  { nome: 'Corda', quantidade: 2, dados: { peso: '5 kg' }, local: 'bolsa' },
  { nome: 'Barra', quantidade: 1, dados: { peso: '4 kg' }, local: 'mochila2' },
  { nome: 'Pedra', quantidade: 1, dados: { peso: '1 kg' }, local: 'apagado' },
];
const locais = [
  { id: 'bolsa', nome: 'Bolsa de Armazenamento', conta_peso: false },
  { id: 'mochila2', nome: 'Mochila 2', conta_peso: true },
];

test('item em local sem peso nao conta; local com peso conta; local inexistente conta como mochila', () => {
  assert.equal(utils.getPesoTotalInventario(inv, locais), 2.3 + 4 + 1);
});

test('sem locais, o peso e o de sempre (compatibilidade)', () => {
  assert.equal(utils.getPesoTotalInventario(inv), 2.3 + 10 + 4 + 1);
  assert.equal(utils.getPesoTotalInventario(inv, []), 2.3 + 10 + 4 + 1);
});

test('item esgotado (quantidade 0) nunca conta, esteja onde estiver', () => {
  const esgotado = [{ nome: 'x', quantidade: 0, dados: { peso: '9 kg' }, local: 'mochila2' }];
  assert.equal(utils.getPesoTotalInventario(esgotado, locais), 0);
});

test('localDoItem resolve o local ou devolve null', () => {
  assert.equal(utils.localDoItem(inv[1], locais).id, 'bolsa');
  assert.equal(utils.localDoItem(inv[0], locais), null);
  assert.equal(utils.localDoItem(inv[3], locais), null);
  assert.equal(utils.localDoItem(inv[1], undefined), null);
});
