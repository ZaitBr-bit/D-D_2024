// ============================================================
// Issue #121 -- compra nao converte a carteira quando a pilha cobre.
//
// pagarCusto (site/js/moedas.js) paga um custo na denominacao do preco.
// Se a pilha dessa denominacao cobre o valor, so ela e decrementada; as
// demais denominacoes ficam intactas. So converte quando a pilha nao cobre.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { RAIZ } from './harness.mjs';

const { pagarCusto, totalEmCobre } = await import(
  pathToFileURL(resolve(RAIZ, 'site', 'js', 'moedas.js')).href
);

test('pilha cobre o preco: so a pilha do preco e decrementada, as PP ficam intactas', () => {
  const r = pagarCusto({ pl: 0, po: 5, pe: 0, pp: 30, pc: 0 }, '2 PO');
  assert.equal(r.sucesso, true);
  assert.deepEqual(r.moedas, { pl: 0, po: 3, pe: 0, pp: 30, pc: 0 });
});

test('pilha insuficiente: paga por conversao e o total cai exatamente o custo', () => {
  const antes = { pl: 0, po: 1, pe: 0, pp: 30, pc: 0 };
  const r = pagarCusto(antes, '2 PO');
  assert.equal(r.sucesso, true);
  assert.equal(totalEmCobre(antes) - totalEmCobre(r.moedas), 200);
});

test('carteira sem saldo total: falha e devolve a carteira sem alteracao', () => {
  const antes = { pl: 0, po: 1, pe: 0, pp: 0, pc: 0 };
  const r = pagarCusto(antes, '2 PO');
  assert.equal(r.sucesso, false);
  assert.deepEqual(r.moedas, antes);
});

test('custo zero: sucesso sem alterar a carteira', () => {
  const antes = { pl: 0, po: 5, pe: 0, pp: 30, pc: 0 };
  const r = pagarCusto(antes, '0 PO');
  assert.equal(r.sucesso, true);
  assert.deepEqual(r.moedas, antes);
});
