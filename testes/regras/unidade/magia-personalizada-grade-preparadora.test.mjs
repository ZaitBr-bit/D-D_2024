// ============================================================
// Issue #124 -- magia personalizada "ocupa vaga" tem cartao na grade de
// Preparar Magias das classes preparadoras de lista completa.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { sheetGrimorio } = await modulosApp();

const FICHA = {
  magias_customizadas: [
    { nome: 'Chama Azul', circulo: 1, escola: 'Evocação', sempre_preparada: false },
    { nome: 'Selo Eterno', circulo: 1, escola: 'Abjuração' },                 // sempre preparada (padrao)
    { nome: 'Raio Vil', circulo: 3, escola: 'Evocação', sempre_preparada: false },
    { nome: 'Luz Fria', circulo: 0, escola: 'Evocação', sempre_preparada: false }, // truque: fora
    { nome: 'Bênção', circulo: 1, escola: 'Encantamento', sempre_preparada: false }, // homonima do livro
  ],
};

test('so entra a personalizada "ocupa vaga" de circulo 1+ dentro do maior circulo conjuravel', () => {
  const r = sheetGrimorio.personalizadasOcupaVagaParaGrade(FICHA, 2, ['Bênção']);
  assert.deepEqual(r.map(m => m.nome), ['Chama Azul']);
  assert.equal(r[0].personalizada, true);
});

test('homonima de magia da lista da classe nao duplica o cartao do livro', () => {
  const r = sheetGrimorio.personalizadasOcupaVagaParaGrade(FICHA, 9, ['Bênção']);
  assert.ok(!r.some(m => m.nome === 'Bênção'));
});

test('ficha sem magias_customizadas devolve lista vazia', () => {
  assert.deepEqual(sheetGrimorio.personalizadasOcupaVagaParaGrade({}, 9, []), []);
});
