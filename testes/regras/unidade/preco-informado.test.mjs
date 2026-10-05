// ============================================================
// Preço informado ao adicionar item mágico: interpretação do campo.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { RAIZ } from './harness.mjs';

const M = await import(pathToFileURL(resolve(RAIZ, 'site', 'js', 'moedas.js')).href);

test('vazio, espaços e zero não cobram nada', () => {
  for (const v of ['', '   ', '0', '00', undefined, null]) {
    assert.deepEqual(M.interpretarPrecoInformado(v, 'po'), { ok: true, custo: null, erro: '' }, JSON.stringify(v));
  }
});

test('inteiro positivo vira string de custo aceita por parseCusto', () => {
  const r = M.interpretarPrecoInformado('50', 'po');
  assert.deepEqual(r, { ok: true, custo: '50 PO', erro: '' });
  assert.deepEqual(M.parseCusto(r.custo), { tipo: 'po', qtd: 50, cobre: 5000 });
  assert.equal(M.interpretarPrecoInformado(' 3 ', 'pl').custo, '3 PL');
  assert.equal(M.interpretarPrecoInformado('7', 'pc').custo, '7 PC');
});

test('negativo, decimal, texto e NaN são recusados com a mensagem do valor', () => {
  for (const v of ['-1', '1.5', '1,5', '12abc', 'abc', 'NaN', '1e3']) {
    const r = M.interpretarPrecoInformado(v, 'po');
    assert.equal(r.ok, false, v);
    assert.equal(r.custo, null, v);
    assert.equal(r.erro, 'Informe um valor inteiro maior ou igual a zero.', v);
  }
});

test('moeda inválida é recusada quando há valor; sem valor a moeda não importa', () => {
  assert.deepEqual(M.interpretarPrecoInformado('5', 'xx'), { ok: false, custo: null, erro: 'Escolha a moeda do preço.' });
  assert.deepEqual(M.interpretarPrecoInformado('', 'xx'), { ok: true, custo: null, erro: '' });
});

test('o preço informado cobre com o mesmo caminho de pagarCusto (pilha cobre: só ela cai)', () => {
  const r = M.interpretarPrecoInformado('30', 'po');
  const carteira = { pl: 0, po: 100, pe: 0, pp: 40, pc: 0 };
  assert.equal(M.podePagarCusto(carteira, r.custo), true);
  assert.deepEqual(M.pagarCusto(carteira, r.custo).moedas, { pl: 0, po: 70, pe: 0, pp: 40, pc: 0 });
  assert.equal(M.podePagarCusto({ pl: 0, po: 10, pe: 0, pp: 0, pc: 0 }, r.custo), false);
});
