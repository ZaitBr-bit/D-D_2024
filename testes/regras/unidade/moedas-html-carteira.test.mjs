// ============================================================
// htmlCarteira / COR_MOEDA: cabeçalho do inventário com uma cor por moeda.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { COR_MOEDA, DENOMINACOES, formatarCarteira, htmlCarteira } from '../../../site/js/moedas.js';

/** Luminância relativa WCAG de uma cor "#rrggbb". */
function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG entre a cor e o branco. */
function contrasteContraBranco(hex) {
  return 1.05 / (luminancia(hex) + 0.05);
}

/** Remove as tags e devolve só o texto; repete até estabilizar para não deixar `<script` reaparecer. */
function semTags(html) {
  let atual = html;
  let anterior;
  do {
    anterior = atual;
    atual = atual.replace(/<[^>]*>/g, '');
  } while (atual !== anterior);
  return atual;
}

test('COR_MOEDA: uma cor hex distinta por denominação', () => {
  assert.deepEqual(Object.keys(COR_MOEDA).sort(), [...DENOMINACOES].sort());
  for (const cor of Object.values(COR_MOEDA)) assert.match(cor, /^#[0-9a-f]{6}$/i);
  assert.equal(new Set(Object.values(COR_MOEDA)).size, DENOMINACOES.length);
});

test('COR_MOEDA: cada cor tem contraste >= 4.5 contra branco', () => {
  for (const [tipo, cor] of Object.entries(COR_MOEDA)) {
    assert.ok(contrasteContraBranco(cor) >= 4.5, `${tipo} ${cor}: ${contrasteContraBranco(cor).toFixed(2)}`);
  }
});

test('htmlCarteira: cada denominação com saldo vira um span com a sua cor, na ordem PL→PC', () => {
  const html = htmlCarteira({ pl: 1672, po: 2, pe: 1, pp: 17, pc: 3 });
  const spans = [...html.matchAll(/<span style="color:([^"]+)">([^<]*)<\/span>/g)];
  assert.deepEqual(spans.map(m => m[2]), ['1672 PL', '2 PO', '1 PE', '17 PP', '3 PC']);
  assert.deepEqual(spans.map(m => m[1]), DENOMINACOES.map(t => COR_MOEDA[t]));
  assert.equal(semTags(html), '1672 PL, 2 PO, 1 PE, 17 PP, 3 PC');
});

test('htmlCarteira: zeros omitidos e texto igual ao de formatarCarteira', () => {
  const moedas = { pl: 0, po: 5, pe: 0, pp: 0, pc: 9 };
  const html = htmlCarteira(moedas);
  assert.equal((html.match(/<span/g) || []).length, 2);
  assert.equal(semTags(html), formatarCarteira(moedas));
  assert.ok(html.includes(`color:${COR_MOEDA.po}`) && html.includes(`color:${COR_MOEDA.pc}`));
});

test('htmlCarteira: carteira vazia ou inválida cai em "0 PO" na cor do ouro', () => {
  for (const entrada of [{}, undefined, null, { po: 0 }, { po: 'x' }]) {
    const html = htmlCarteira(entrada);
    assert.equal(semTags(html), '0 PO');
    assert.ok(html.includes(`color:${COR_MOEDA.po}`));
  }
});
