// ============================================================
// Regras da Forma Selvagem (Druida, PHB 2024): tabela Formas de Feras,
// formas elegíveis, PV temporários, duração, Círculo da Lua e estado.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RAIZ } from './harness.mjs';

const R = await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-forma-selvagem.js')).href);
const criaturas = JSON.parse(readFileSync(resolve(RAIZ, 'dados/apendices/criaturas.json'), 'utf-8')).criaturas;
const por = (nome) => criaturas.find((c) => c.nome === nome);
const nomes = (nivel, sub = '') => R.formasElegiveis(criaturas, nivel, sub).map((c) => c.nome);

test('tabela Formas de Feras: conhecidas, ND máximo e voo por nível', () => {
  assert.equal(R.limitesFormas(1), null, 'nível 1 não tem Forma Selvagem');
  assert.deepEqual(R.limitesFormas(2), { conhecidas: 4, nd: 0.25, voo: false });
  assert.deepEqual(R.limitesFormas(3), { conhecidas: 4, nd: 0.25, voo: false });
  assert.deepEqual(R.limitesFormas(4), { conhecidas: 6, nd: 0.5, voo: false });
  assert.deepEqual(R.limitesFormas(8), { conhecidas: 8, nd: 1, voo: true });
  assert.deepEqual(R.limitesFormas(20), { conhecidas: 8, nd: 1, voo: true });
});

test('ND do apêndice vira número', () => {
  assert.equal(R.ndNumero('0 (XP 10; BP +2)'), 0);
  assert.equal(R.ndNumero('1/4 (XP 50; BP +2)'), 0.25);
  assert.equal(R.ndNumero('1/2 (XP 100; BP +2)'), 0.5);
  assert.equal(R.ndNumero('4 (XP 1.100; BP +2)'), 4);
});

test('nível 2: Feras de ND até 1/4 sem voo, e só Feras', () => {
  const n = nomes(2);
  for (const forma of R.FORMAS_RECOMENDADAS) assert.ok(n.includes(forma), `${forma} é recomendada pelo livro`);
  assert.ok(!n.includes('Coruja'), 'Coruja voa');
  assert.ok(!n.includes('Lobo Atroz'), 'ND 1 passa do limite');
  assert.ok(!n.includes('Esqueleto') && !n.includes('Zumbi'), 'não são Feras');
  assert.ok(!n.includes('Urso Negro'), 'ND 1/2 passa do limite do nível 2');
});

test('nível 4 sobe o ND; nível 8 libera voo', () => {
  assert.ok(nomes(4).includes('Urso Negro'));
  assert.ok(!nomes(4).includes('Lobo Atroz'));
  assert.ok(nomes(8).includes('Lobo Atroz'));
  assert.ok(nomes(8).includes('Coruja'), 'a partir do 8 pode ter Deslocamento de Voo');
});

test('Círculo da Lua: ND = nível ÷ 3, PV temporários triplos e CA mínima 13 + Sab', () => {
  assert.equal(R.limitesFormas(6, R.SUBCLASSE_LUA).nd, 2);
  assert.equal(R.limitesFormas(3, R.SUBCLASSE_LUA).nd, 1);
  assert.ok(nomes(6, R.SUBCLASSE_LUA).includes('Urso Pardo'), 'ND 1 no nível 3 em diante');
  assert.equal(R.pvTemporariosDaForma(5), 5);
  assert.equal(R.pvTemporariosDaForma(5, R.SUBCLASSE_LUA), 15);
  assert.equal(R.caNaForma(por('Lobo'), R.SUBCLASSE_LUA, 3), 16, '13 + 3 supera a CA do Lobo');
  assert.equal(R.caNaForma(por('Lobo'), '', 3), parseInt(por('Lobo').ca, 10));
});

test('duração e PV temporários', () => {
  assert.equal(R.duracaoHoras(2), 1);
  assert.equal(R.duracaoHoras(7), 3);
  assert.equal(R.duracaoHoras(20), 10);
  assert.equal(R.pvTemporariosDaForma(2), 2);
});

test('assumir a forma: grava, soma PV temporários sem acumular e permite sair', () => {
  const p = { pv_temporario: 3, recursos: { druida: {} } };
  const r = R.assumirForma(p, por('Lobo'), { nivel: 5 });
  assert.deepEqual([r.forma, r.pvTemporarios, r.horas], ['Lobo', 5, 2]);
  assert.equal(p.pv_temporario, 5, 'vale o maior, não a soma');
  assert.equal(R.estadoFormaSelvagem(p).forma, 'Lobo');
  assert.equal(p.recursos.druida.forma_selvagem_ativa, true);
  p.pv_temporario = 9;
  R.assumirForma(p, por('Aranha'), { nivel: 5 });
  assert.equal(p.pv_temporario, 9, 'não reduz PV temporários maiores');
  assert.equal(R.sairDaForma(p), true);
  assert.equal(R.estadoFormaSelvagem(p), null);
  assert.equal(p.recursos.druida.forma_selvagem_ativa, false);
  assert.equal(R.sairDaForma(p), false);
});

test('conjuração: bloqueada na forma, salvo Círculo da Lua', () => {
  const p = { recursos: { druida: {} } };
  assert.equal(R.podeConjurarEmForma(p, ''), true, 'fora da forma conjura');
  R.assumirForma(p, por('Lobo'), { nivel: 5 });
  assert.equal(R.podeConjurarEmForma(p, ''), false);
  assert.equal(R.podeConjurarEmForma(p, R.SUBCLASSE_LUA), true);
});

test('formas conhecidas: únicas e limitadas ao máximo', () => {
  const p = {};
  assert.deepEqual(R.definirFormasConhecidas(p, ['Lobo', 'Lobo', 'Rato', 'Aranha', 'Gato', 'Cabra'], 4), ['Lobo', 'Rato', 'Aranha', 'Gato']);
  assert.deepEqual(R.formasConhecidas(p, 2), ['Lobo', 'Rato']);
  assert.deepEqual(R.formasConhecidas({}), []);
});
