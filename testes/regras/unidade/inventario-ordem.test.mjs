// Ordem do inventário: item novo e item equipado vão para o início do array.
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';
const { utils } = await modulosApp();

test('inserirNoInicio põe o item na posição 0', () => {
  const inv = [{ nome: 'A' }, { nome: 'B' }];
  utils.inserirNoInicio(inv, { nome: 'C' });
  assert.deepEqual(inv.map(i => i.nome), ['C', 'A', 'B']);
});
test('moverParaInicio leva o item existente ao 0 sem duplicar', () => {
  const inv = [{ nome: 'A' }, { nome: 'B' }, { nome: 'C' }];
  utils.moverParaInicio(inv, inv[2]);
  assert.deepEqual(inv.map(i => i.nome), ['C', 'A', 'B']);
  utils.moverParaInicio(inv, inv[0]);
  assert.deepEqual(inv.map(i => i.nome), ['C', 'A', 'B']);
});
test('adicionarAoInventario (acervo mágico) coloca o item novo no início e soma consumível sem mover', async () => {
  const { adicionarAoInventario } = await import('../../../site/js/itens-magicos-ui.js');
  const p = { inventario: [{ nome: 'Poção', tipo: 'magico', quantidade: 1, dados: { tipo_item: 'Consumível' } }, { nome: 'Anel', tipo: 'magico', dados: {} }] };
  adicionarAoInventario(p, { nome: 'Capa', tipo: 'magico', dados: {} });
  assert.equal(p.inventario[0].nome, 'Capa');
  adicionarAoInventario(p, { nome: 'Poção', tipo: 'magico', quantidade: 1, dados: { tipo_item: 'Consumível' } });
  assert.equal(p.inventario[1].nome, 'Poção');
  assert.equal(p.inventario[1].quantidade, 2);
});
