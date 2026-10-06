// CA com o atributo escolhido na armadura de catálogo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';
const { utils } = await modulosApp();

const base = (inv, atrib = {}) => ({
  classe: 'Guerreiro', nivel: 3,
  atributos: { forca: 10, destreza: 16, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10, ...atrib },
  inventario: inv,
});
const armadura = (nome, categoria, ca, extra = {}) =>
  ({ nome, tipo: 'armadura', quantidade: 1, equipado: true, dados: { categoria, ca, ...extra } });

test('sem atributo escolhido a CA é a de sempre (Leve, Média com teto, Pesada)', () => {
  assert.equal(utils.calcCA(base([armadura('Couro', 'Leve', '11')])), 14);
  assert.equal(utils.calcCA(base([armadura('Peitoral', 'Média', '14')])), 16);
  assert.equal(utils.calcCA(base([armadura('Cota de Malha', 'Pesada', '16')])), 16);
});

test('atributo escolhido troca o DES: Leve soma o modificador escolhido', () => {
  assert.equal(utils.calcCA(base([armadura('Couro', 'Leve', '11', { atributo: 'sabedoria' })], { sabedoria: 14 })), 13);
});

test('Média mantém o teto de +2 com o atributo escolhido', () => {
  assert.equal(utils.calcCA(base([armadura('Peitoral', 'Média', '14', { atributo: 'constituicao' })], { constituicao: 20 })), 16);
});

test('Média: o atributo escolhido entra no lugar do DES, com teto de +2 e modificador negativo sem teto', () => {
  // DES -1, CON +5 escolhida: usa CON limitado a +2 (ignorar a escolha daria 13).
  assert.equal(utils.calcCA(base([armadura('Peitoral', 'Média', '14', { atributo: 'constituicao' })], { destreza: 8, constituicao: 20 })), 16);
  // DES +3, SAB -1 escolhida: usa SAB (sem a mudança daria 16).
  assert.equal(utils.calcCA(base([armadura('Peitoral', 'Média', '14', { atributo: 'sabedoria' })], { sabedoria: 8 })), 13);
  // Atributo inválido em Média cai no DES com teto.
  assert.equal(utils.calcCA(base([armadura('Peitoral', 'Média', '14', { atributo: 'xyz' })])), 16);
});

test('Leve com modificador negativo no atributo escolhido', () => {
  assert.equal(utils.calcCA(base([armadura('Couro', 'Leve', '11', { atributo: 'carisma' })], { carisma: 8 })), 10);
});

test('Pesada ignora o atributo gravado (não soma modificador); valor inválido em Leve cai no DES', () => {
  assert.equal(utils.calcCA(base([armadura('Cota de Malha', 'Pesada', '16', { atributo: 'carisma' })], { carisma: 14 })), 16);
  assert.equal(utils.calcCA(base([armadura('Couro', 'Leve', '11 + modificador de Des', { atributo: 'xyz' })])), 14);
});

test('armadura sem categoria válida com "modificador de Des": usa o atributo escolhido; inválido ou ausente cai no DES', () => {
  const semCat = (extra) => armadura('Gibão', '', '12 + modificador de Des', extra);
  assert.equal(utils.calcCA(base([semCat({ atributo: 'sabedoria' })], { sabedoria: 14 })), 14);
  assert.equal(utils.calcCA(base([semCat({ atributo: 'xyz' })])), 15);
  assert.equal(utils.calcCA(base([semCat({})])), 15);
  const semCatMax = armadura('Gibão', '', '13 + modificador de Des (máx. 2)', { atributo: 'constituicao' });
  assert.equal(utils.calcCA(base([semCatMax], { constituicao: 20 })), 15);
  assert.equal(utils.calcCA(base([armadura('Cota', 'Pesada', '16 + modificador de Des', { atributo: 'sabedoria' })], { sabedoria: 20 })), 16);
});
