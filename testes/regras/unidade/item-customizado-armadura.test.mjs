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

test('editar item que não é Armadura: "Soma de atributo na CA" e limite não vêm preenchidos com atributo de arma', () => {
  const html = itemCustomForm.htmlFormularioItemCustomizado({ nome: 'Espada', dados: { categoria: 'Armas Marciais Corpo a Corpo', atributo: 'inteligencia', limite_atributo: '3' } });
  assert.ok(!/<option value="inteligencia" selected/.test(html), 'atributo da arma não pode virar Soma na CA');
  assert.ok(/<option value="" selected>Nenhum \(CA fixa\)/.test(html));
  assert.ok(!/id="ic-limite-atributo"[^>]*value="3"/.test(html));
  const arm = itemCustomForm.htmlFormularioItemCustomizado({ nome: 'Gibão', dados: { tipo_item: 'Armadura', tipo_armadura: 'Leve', atributo: 'destreza', limite_atributo: '2' } });
  assert.ok(/<option value="destreza" selected/.test(arm));
  assert.ok(/id="ic-limite-atributo"[^>]*value="2"/.test(arm));
});

test('mesclarDadosItemCustomizado: ao deixar de ser Armadura apaga atributo e limite; arma que nunca foi armadura mantém o atributo', () => {
  const deArmadura = { tipo_item: 'Armadura', tipo_armadura: 'Leve', atributo: 'destreza', limite_atributo: '2', outro: 'x' };
  const virouArma = itemCustomForm.mesclarDadosItemCustomizado(deArmadura, { tipo_item: '', categoria: 'Armas Simples Corpo a Corpo' });
  assert.ok(!('atributo' in virouArma) && !('limite_atributo' in virouArma));
  assert.equal(virouArma.outro, 'x');
  const continua = itemCustomForm.mesclarDadosItemCustomizado(deArmadura, { tipo_item: 'Armadura', atributo: 'forca', limite_atributo: '' });
  assert.equal(continua.atributo, 'forca');
  const arma = itemCustomForm.mesclarDadosItemCustomizado({ categoria: 'Armas Simples Corpo a Corpo', atributo: 'inteligencia' }, { categoria: 'Armas Marciais Corpo a Corpo', tipo_item: '' });
  assert.equal(arma.atributo, 'inteligencia');
});
