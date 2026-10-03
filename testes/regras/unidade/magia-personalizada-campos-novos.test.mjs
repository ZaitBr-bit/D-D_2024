// ============================================================
// Issues #98/#111/#123 -- campos novos da magia personalizada:
// `circulo_superior` (texto), `fonte` (texto curto) e `classes` (lista de
// classes conjuradoras). Campo ausente ou invalido = comportamento antigo.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { sheetGrimorio } = await modulosApp();
const magias = await import('../../../site/js/sheet/magias.js');
const norm = (m) => magias.normalizarMagiaPersonalizada({ nome: 'A', ...m }, 0);

test('#98 circulo_superior: texto passa, ausente ou invalido vira ""', () => {
  assert.equal(norm({ circulo_superior: 'Mais 1d6.' }).circulo_superior, 'Mais 1d6.');
  assert.equal(norm({}).circulo_superior, '');
  assert.equal(norm({ circulo_superior: { x: 1 } }).circulo_superior, '');
});

test('#98 o detalhe mostra o upcast no padrao do livro, e nada sem o campo', () => {
  const com = magias.renderDetalhesMagiaPersonalizada(norm({ circulo: 2, circulo_superior: 'Mais 1d6 por circulo.' }));
  assert.match(com, /<strong>Usando um Espaço de Magia de Círculo Superior\.<\/strong>/);
  assert.match(com, /Mais .*1d6/);
  assert.doesNotMatch(magias.renderDetalhesMagiaPersonalizada(norm({ circulo: 2 })), /Usando um Espaço/);
});

test('#111 fonte: texto truncado a 40, ausente ou invalida vira ""', () => {
  assert.equal(norm({ fonte: 'Xanathar' }).fonte, 'Xanathar');
  assert.equal(norm({ fonte: 'x'.repeat(60) }).fonte.length, 40);
  assert.equal(norm({ fonte: 5 }).fonte, '');
  assert.equal(norm({}).fonte, '');
});

test('#111 a grade de preparo carrega a fonte da personalizada "ocupa vaga"', () => {
  const r = sheetGrimorio.personalizadasOcupaVagaParaGrade({
    magias_customizadas: [{ nome: 'Chama', circulo: 1, escola: 'Evocação', sempre_preparada: false, fonte: 'Homebrew' }],
  }, 9, []);
  assert.equal(r[0].fonte, 'Homebrew');
});

test('#123 classes: so nomes de classe conjuradora, sem repeticao; invalido vira []', () => {
  assert.deepEqual(norm({ classes: ['Mago', 'Bárbaro', 7, 'Mago'] }).classes, ['Mago']);
  assert.deepEqual(norm({ classes: 'Mago' }).classes, []);
  assert.deepEqual(norm({}).classes, []);
});

const FICHA = { magias_customizadas: [
  { nome: 'Chama Azul', circulo: 1, escola: 'Evocação', sempre_preparada: false, classes: ['Clérigo'] },
  { nome: 'Raio Vil', circulo: 1, escola: 'Evocação', sempre_preparada: false },
  { nome: 'Selo', circulo: 1, escola: 'Abjuração', sempre_preparada: false, classes: [] },
] };

test('#123 a grade filtra por classe: com classes so nas marcadas; sem classes, em todas', () => {
  const nomes = (c) => sheetGrimorio.personalizadasOcupaVagaParaGrade(FICHA, 9, [], c).map(m => m.nome).sort();
  assert.deepEqual(nomes('Clérigo'), ['Chama Azul', 'Raio Vil', 'Selo']);
  assert.deepEqual(nomes('Druida'), ['Raio Vil', 'Selo']);
  assert.equal(sheetGrimorio.personalizadasOcupaVagaParaGrade(FICHA, 9, []).length, 3, 'sem classeAtiva nao filtra');
});

test('#123 o detalhe mostra "Classes:" quando ha classes', () => {
  const html = magias.renderDetalhesMagiaPersonalizada(norm({ circulo: 1, classes: ['Clérigo', 'Mago'] }));
  assert.match(html, /Classes: Clérigo, Mago/);
  assert.doesNotMatch(magias.renderDetalhesMagiaPersonalizada(norm({ circulo: 1 })), /Classes:/);
});
