// ============================================================
// Regras puras de distância: conversão de metros em quadrados (1,5 m = 1 q).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { metrosParaQuadrados, comQuadrados, deslocamentoComQuadrados, textoComQuadrados } from '../../../site/js/regras-distancia.js';

test('metrosParaQuadrados converte e trata entrada inválida', () => {
  assert.equal(metrosParaQuadrados(9), 6);
  assert.equal(metrosParaQuadrados(4.5), 3);
  assert.equal(metrosParaQuadrados(1.5), 1);
  assert.equal(metrosParaQuadrados(10.5), 7);
  assert.equal(metrosParaQuadrados(0), 0);
  assert.equal(metrosParaQuadrados(-3), 0);
  assert.equal(metrosParaQuadrados(NaN), 0);
});

test('comQuadrados anota distâncias e é idempotente', () => {
  assert.equal(comQuadrados('18 metros'), '18 m (12 q)');
  assert.equal(comQuadrados('1,5 metro'), '1,5 m (1 q)');
  assert.equal(comQuadrados('Toque'), 'Toque');
  assert.equal(comQuadrados('Pessoal'), 'Pessoal');
  assert.equal(comQuadrados(''), '');
  assert.equal(comQuadrados(undefined), '');
  assert.equal(comQuadrados('9 m (6 q)'), '9 m (6 q)');
  assert.equal(comQuadrados('9 m; Voo 12 m'), '9 m (6 q); Voo 12 m (8 q)');
});

test('deslocamentoComQuadrados separa o valor base dos extras', () => {
  assert.equal(deslocamentoComQuadrados('9 metros'), '9 m (6 q)');
  assert.equal(
    deslocamentoComQuadrados('9 metros (Voo 12m, Escalada 9m)'),
    '9 m (6 q) · Voo 12 m (8 q), Escalada 9 m (6 q)'
  );
  assert.equal(deslocamentoComQuadrados('0 metros'), '0 m (0 q)');
});

test('velocidade com "(pairar)" recebe quadrados e mantém o sufixo', () => {
  assert.equal(comQuadrados('Voo 12m (pairar)'), 'Voo 12 m (8 q) (pairar)');
  assert.equal(
    deslocamentoComQuadrados('9 metros (Voo 12m (pairar), Escalada 9m)'),
    '9 m (6 q) · Voo 12 m (8 q) (pairar), Escalada 9 m (6 q)'
  );
  assert.equal(comQuadrados('9 m (6 q)'), '9 m (6 q)');
});

test('palavras iniciadas por "m" não são convertidas e "metros" por extenso é', () => {
  assert.equal(comQuadrados('2 mãos'), '2 mãos');
  assert.equal(comQuadrados('2 mês'), '2 mês');
  assert.equal(comQuadrados('2 mágico'), '2 mágico');
  assert.equal(comQuadrados('45 metros'), '45 m (30 q)');
  assert.equal(comQuadrados('Voo 12m (pairar)'), 'Voo 12 m (8 q) (pairar)');
});

test('deslocamentoComQuadrados é idempotente', () => {
  assert.equal(deslocamentoComQuadrados('9 m (6 q)'), '9 m (6 q)');
  for (const entrada of ['9 m (6 q) · Voo 12 m (8 q)', '9 m; Voo 12 m', '9 metros (Voo 12m, Escalada 9m)',
    '9 metros (Voo 12m (pairar), Escalada 9m)', '9 metros']) {
    const uma = deslocamentoComQuadrados(entrada);
    assert.equal(deslocamentoComQuadrados(uma), uma, entrada);
  }
  assert.equal(deslocamentoComQuadrados('9 m (6 q) · Voo 12 m (8 q)'), '9 m (6 q) · Voo 12 m (8 q)');
});

test('textoComQuadrados anota só múltiplos de 1,5 m e mantém a unidade escrita', () => {
  const t = textoComQuadrados;
  assert.equal(t('4,5 metros'), '4,5 metros (3 q)');
  assert.equal(t('1,5 metro'), '1,5 metro (1 q)');
  assert.equal(t('3 metros de distância'), '3 metros (2 q) de distância');
  assert.equal(t('Cubo de 4,5 m'), 'Cubo de 4,5 m (3 q)');
  assert.equal(t('de 1,5 a 6 metros'), 'de 1,5 a 6 metros (4 q)');
  assert.equal(t(undefined), '');
});

test('textoComQuadrados ignora valores fora da grade, unidades compostas e outras palavras', () => {
  for (const s of ['1 metro', '2 metros', '2,5 metros', '800 metros', '3.700 metros quadrados',
    '9 metros cúbicos', '2,5 centímetros', '2 mãos', '2 mês', '0 metros']) {
    assert.equal(textoComQuadrados(s), s, s);
  }
});

test('textoComQuadrados é idempotente e preserva o markdown', () => {
  const uma = textoComQuadrados('Cubo de 4,5 metros e **18 metros** | 3 m |');
  assert.equal(uma, 'Cubo de 4,5 metros (3 q) e **18 metros (12 q)** | 3 m (2 q) |');
  assert.equal(textoComQuadrados(uma), uma);
});
