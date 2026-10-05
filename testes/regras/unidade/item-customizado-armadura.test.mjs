// ============================================================
// Issue #134 -- armadura personalizada: tipo (para a proficiência),
// requisito de Força, Furtividade e resumo no detalhe.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { itemCustomForm } = await modulosApp();
const inventario = await import('../../../site/js/sheet/inventario.js');

test('TIPOS_ARMADURA lista os quatro tipos do livro', () => {
  assert.deepEqual(itemCustomForm.TIPOS_ARMADURA, ['Leve', 'Média', 'Pesada', 'Escudo']);
});

test('htmlResumoItemCustomizado: armadura completa mostra tipo, CA, requisito, furtividade, custo e peso', () => {
  const html = inventario.htmlResumoItemCustomizado({
    tipo_item: 'Armadura', tipo_armadura: 'Pesada', ca_base: '18', requisito_forca: 'For 15',
    furtividade: 'Desvantagem', preco: '1.500 PO', peso: '32 kg',
  });
  for (const trecho of ['Pesada', 'CA base', '18', 'For 15', 'Desvantagem', '1.500 PO', '32 kg']) {
    assert.ok(html.includes(trecho), `faltou "${trecho}" em: ${html}`);
  }
});

test('htmlResumoItemCustomizado: item antigo sem os campos novos não quebra e só mostra o que existe', () => {
  assert.equal(inventario.htmlResumoItemCustomizado({}), '');
  const html = inventario.htmlResumoItemCustomizado({ preco: '5 PO' });
  assert.ok(html.includes('5 PO'));
  assert.ok(!html.includes('Requisito'));
  assert.ok(!html.includes('undefined'));
});

test('htmlResumoItemCustomizado escapa texto livre', () => {
  const html = inventario.htmlResumoItemCustomizado({ preco: '<img src=x onerror=alert(1)> PO' });
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
});
