// ============================================================
// Issue #133 -- converter moedas para a denominação logo abaixo
// (platina -> ouro), espelho de converterParaMaior.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { RAIZ } from './harness.mjs';

const M = await import(pathToFileURL(resolve(RAIZ, 'site', 'js', 'moedas.js')).href);

test('proximaDenominacaoMenor: cadeia pl > po > pe > pp > pc; pc não tem menor', () => {
  assert.deepEqual(M.proximaDenominacaoMenor('pl'), { tipoDestino: 'po', taxa: 10 });
  assert.deepEqual(M.proximaDenominacaoMenor('po'), { tipoDestino: 'pe', taxa: 2 });
  assert.deepEqual(M.proximaDenominacaoMenor('pe'), { tipoDestino: 'pp', taxa: 5 });
  assert.deepEqual(M.proximaDenominacaoMenor('pp'), { tipoDestino: 'pc', taxa: 10 });
  assert.equal(M.proximaDenominacaoMenor('pc'), null);
  assert.equal(M.proximaDenominacaoMenor('xx'), null);
});

test('converterParaMenor: 3 PL viram 30 PO e a pilha de PL zera', () => {
  const r = M.converterParaMenor({ pl: 3, po: 5, pe: 0, pp: 0, pc: 0 }, 'pl');
  assert.equal(r.sucesso, true);
  assert.deepEqual(r.moedas, { pl: 0, po: 35, pe: 0, pp: 0, pc: 0 });
});

test('converterParaMenor preserva o valor total em cobre', () => {
  const antes = { pl: 2, po: 1, pe: 1, pp: 7, pc: 3 };
  for (const tipo of ['pl', 'po', 'pe', 'pp']) {
    const r = M.converterParaMenor(antes, tipo);
    assert.equal(r.sucesso, true, tipo);
    assert.equal(M.totalEmCobre(r.moedas), M.totalEmCobre(antes), `total mudou ao converter ${tipo}`);
  }
});

test('converterParaMenor falha sem moeda na pilha e para cobre', () => {
  assert.equal(M.converterParaMenor({ pl: 0, po: 2, pe: 0, pp: 0, pc: 0 }, 'pl').sucesso, false);
  assert.equal(M.converterParaMenor({ pl: 0, po: 0, pe: 0, pp: 0, pc: 9 }, 'pc').sucesso, false);
});

test('com taxas customizadas (1 PL = 20 PO) a conversão usa a taxa atual', () => {
  try {
    assert.equal(M.definirTaxas({ pp: 10, pe: 50, po: 100, pl: 2000 }).sucesso, true);
    assert.deepEqual(M.proximaDenominacaoMenor('pl'), { tipoDestino: 'po', taxa: 20 });
    const r = M.converterParaMenor({ pl: 2, po: 0, pe: 0, pp: 0, pc: 0 }, 'pl');
    assert.equal(r.moedas.po, 40);
  } finally {
    M.resetarTaxas();
  }
});

test('converterParaMenor não altera o objeto recebido', () => {
  const original = { pl: 1, po: 0, pe: 0, pp: 0, pc: 0 };
  M.converterParaMenor(original, 'pl');
  assert.deepEqual(original, { pl: 1, po: 0, pe: 0, pp: 0, pc: 0 });
});
