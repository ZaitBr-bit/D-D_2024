// Ordenação das perícias na ficha: padrão, por atributo, maior bônus e A-Z.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PERICIAS } from '../../../site/js/dados-classes.js';
import {
  ORDEM_PERICIAS_PADRAO, MODOS_ORDEM_PERICIAS, ordenarPericias,
} from '../../../site/js/regras-ordem-pericias.js';

// Bônus fixos por perícia usados nos casos de teste.
const BONUS = { 'Atuação': 11, 'Persuasão': 11, 'Enganação': 8 };

// Monta a lista de entrada com as 18 perícias e os bônus fixos.
function entrada() {
  return PERICIAS.map(p => ({ nome: p.nome, atributo: p.atributo, bonus: BONUS[p.nome] ?? 0 }));
}

const nomes = lista => lista.map(p => p.nome);

test('padrao segue ORDEM_PERICIAS_PADRAO; modo desconhecido ou ausente = padrao', () => {
  assert.equal(ORDEM_PERICIAS_PADRAO.length, 18);
  assert.deepEqual(nomes(ordenarPericias(entrada(), 'padrao')), ORDEM_PERICIAS_PADRAO);
  assert.deepEqual(nomes(ordenarPericias(entrada(), 'xyz')), ORDEM_PERICIAS_PADRAO);
  assert.deepEqual(nomes(ordenarPericias(entrada(), undefined)), ORDEM_PERICIAS_PADRAO);
});

test('atributo agrupa Força, Destreza, Inteligência, Sabedoria, Carisma', () => {
  const r = nomes(ordenarPericias(entrada(), 'atributo'));
  assert.equal(r[0], 'Atletismo');
  assert.deepEqual(r.slice(1, 4), ['Acrobacia', 'Furtividade', 'Prestidigitação']);
  assert.deepEqual(r.slice(-4), ['Atuação', 'Enganação', 'Intimidação', 'Persuasão']);
});

test('bonus ordena do maior para o menor, empate em ordem alfabética', () => {
  const r = nomes(ordenarPericias(entrada(), 'bonus'));
  assert.deepEqual(r.slice(0, 3), ['Atuação', 'Persuasão', 'Enganação']);
});

test('alfabetica ordena A-Z em pt-BR', () => {
  const r = nomes(ordenarPericias(entrada(), 'alfabetica'));
  assert.deepEqual(r.slice(0, 4), ['Acrobacia', 'Arcanismo', 'Atletismo', 'Atuação']);
  assert.equal(r[r.length - 1], 'Sobrevivência');
});

test('não muta a lista de entrada e MODOS_ORDEM_PERICIAS lista os 4 modos', () => {
  const lista = entrada();
  const antes = nomes(lista);
  ordenarPericias(lista, 'alfabetica');
  assert.deepEqual(nomes(lista), antes);
  assert.deepEqual(MODOS_ORDEM_PERICIAS.map(m => m.valor), ['padrao', 'atributo', 'bonus', 'alfabetica']);
  assert.deepEqual(MODOS_ORDEM_PERICIAS.map(m => m.rotulo), ['Padrão', 'Atributo', 'Maior bônus', 'A–Z']);
});
