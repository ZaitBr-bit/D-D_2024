// CA de armadura personalizada: o atributo somado é opcional e o item antigo não muda.
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';
import { efeitosDeCustomizado } from '../../../site/js/regras-itens-magicos.js';
const { utils } = await modulosApp();

const base = (inv, atrib = {}) => ({
  classe: 'Guerreiro', nivel: 3,
  atributos: { forca: 10, destreza: 16, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10, ...atrib },
  inventario: inv,
});
const custom = (dados, extra = {}) => ({
  nome: 'Couraça da Mesa', tipo: 'customizado', quantidade: 1, equipado: true, descricao: '',
  dados: { tipo_item: 'Armadura', tipo_armadura: 'Leve', ca_base: '12', bonus_ca: '0', ...dados }, ...extra,
});

test('sem atributo: a CA Base continua sendo o piso fixo (item já salvo não muda)', () => {
  assert.equal(utils.calcCA(base([custom({})])), 13); // piso 12 < 10 + DES(+3) sem armadura = 13
  assert.equal(utils.calcCA(base([custom({ ca_base: '20' })])), 20);
});

test('com atributo: CA = base + modificador escolhido', () => {
  assert.equal(utils.calcCA(base([custom({ ca_base: '12', atributo: 'destreza' })])), 15);
  assert.equal(utils.calcCA(base([custom({ ca_base: '12', atributo: 'sabedoria' })], { sabedoria: 14 })), 14);
});

test('limite do modificador (como a Média "máx. 2")', () => {
  assert.equal(utils.calcCA(base([custom({ ca_base: '12', atributo: 'destreza', limite_atributo: '2' })])), 14);
  assert.equal(utils.calcCA(base([custom({ ca_base: '12', atributo: 'destreza', limite_atributo: '' })])), 15);
});

test('modificador negativo reduz a CA em vez de ficar preso na base', () => {
  assert.equal(utils.calcCA(base([custom({ ca_base: '12', atributo: 'carisma' })], { carisma: 8, destreza: 8 })), 11);
});

test('Escudo, item desequipado e atributo inválido ignoram o atributo', () => {
  // ca_base 20 domina o piso sem armadura: sem a guarda de atributo inválido o resultado mudaria.
  assert.equal(utils.calcCA(base([custom({ ca_base: '20', atributo: 'xyz' })])), 20);
  assert.equal(utils.calcCA(base([custom({ tipo_armadura: 'Escudo', ca_base: '12', atributo: 'destreza' })])),
    utils.calcCA(base([custom({ tipo_armadura: 'Escudo', ca_base: '12' })])));
  assert.equal(utils.calcCA(base([custom({ ca_base: '12', atributo: 'destreza' }, { equipado: false })])), 13);
});

test('limite 0 zera só o modificador positivo: DES 16 = base 14; CAR 8 (negativo) segue reduzindo para 11', () => {
  assert.equal(utils.calcCA(base([custom({ ca_base: '14', atributo: 'destreza', limite_atributo: '0' })])), 14);
  assert.equal(utils.calcCA(base([custom({ ca_base: '12', atributo: 'carisma', limite_atributo: '0' })], { carisma: 8, destreza: 8 })), 11);
});

test('efeitosDeCustomizado: armadura com atributo não gera o efeito ca_base (a CA vem do calcCA)', () => {
  const ef = efeitosDeCustomizado({ dados: { tipo_item: 'Armadura', tipo_armadura: 'Leve', ca_base: '12', atributo: 'carisma' } });
  assert.equal(ef.some(e => e.alvo === 'ca_base'), false);
  const sem = efeitosDeCustomizado({ dados: { tipo_item: 'Armadura', tipo_armadura: 'Leve', ca_base: '12' } });
  assert.equal(sem.some(e => e.alvo === 'ca_base'), true);
});

test('sintonização exigida e não feita: o item não conta', () => {
  assert.equal(utils.calcCA(base([custom({ ca_base: '12', atributo: 'destreza', requer_sintonizacao: true })])), 13);
});
