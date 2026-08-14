// ============================================================
// Regras de equipamento (site/js/regras-equipamento.js).
//
// Cobre os seis ramos da proficiencia mais o requisito de Forca. Estas
// regras existiam duplicadas ate 2026-08-13; a tabela abaixo e o que
// impede as duas antigas de "voltarem" divergentes.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { equip } = await modulosApp();

const ADAGA = { nome: 'Adaga', categoria: 'Armas Simples Corpo a Corpo', propriedades: 'Acuidade, Leve, Arremesso' };
const ESPADA_LONGA = { nome: 'Espada Longa', categoria: 'Armas Marciais Corpo a Corpo', propriedades: 'Versátil' };
const RAPIEIRA = { nome: 'Rapieira', categoria: 'Armas Marciais Corpo a Corpo', propriedades: 'Acuidade' };
const CIMITARRA = { nome: 'Cimitarra', categoria: 'Armas Marciais Corpo a Corpo', propriedades: 'Acuidade, Leve' };

const CASOS_ARMA = [
  // Guerreiro: Simples + Marcial
  { classe: 'Guerreiro', arma: ADAGA, esperado: true, porque: 'Simples' },
  { classe: 'Guerreiro', arma: ESPADA_LONGA, esperado: true, porque: 'Marcial' },
  // Mago: so Simples
  { classe: 'Mago', arma: ADAGA, esperado: true, porque: 'Simples' },
  { classe: 'Mago', arma: ESPADA_LONGA, esperado: false, porque: 'Marcial sem proficiencia' },
  // Ladino: Marcial SO com Acuidade
  { classe: 'Ladino', arma: RAPIEIRA, esperado: true, porque: 'Marcial com Acuidade' },
  { classe: 'Ladino', arma: ESPADA_LONGA, esperado: false, porque: 'Marcial sem Acuidade' },
  // Monge: Marcial SO com Leve
  { classe: 'Monge', arma: CIMITARRA, esperado: true, porque: 'Marcial com Leve' },
  { classe: 'Monge', arma: ESPADA_LONGA, esperado: false, porque: 'Marcial sem Leve' },
];

for (const { classe, arma, esperado, porque } of CASOS_ARMA) {
  test(`proficiencia de arma: ${classe} + ${arma.nome} (${porque})`, () => {
    assert.equal(equip.temProficienciaArma({ classe }, arma), esperado);
  });
}

test('proficiencia de arma: proficiencias_extra concedem categoria inteira', () => {
  // Clerigo Protetor recebe "Armas Marciais" pela subclasse.
  const semExtra = { classe: 'Clérigo' };
  const comExtra = { classe: 'Clérigo', proficiencias_extra: ['Armas Marciais'] };
  assert.equal(equip.temProficienciaArma(semExtra, ESPADA_LONGA), false);
  assert.equal(equip.temProficienciaArma(comExtra, ESPADA_LONGA), true);
});

test('proficiencia de arma: classe desconhecida nunca e proficiente', () => {
  assert.equal(equip.temProficienciaArma({ classe: 'Inexistente' }, ADAGA), false);
  assert.equal(equip.temProficienciaArma({}, ADAGA), false);
});

const COURO = { nome: 'Couro', categoria: 'Leve' };
const COTA_MALHA = { nome: 'Cota de Malha', categoria: 'Pesada' };
const ESCUDO = { nome: 'Escudo', categoria: 'Escudo' };

test('proficiencia de armadura: Guerreiro veste Leve e Pesada', () => {
  assert.equal(equip.temProficienciaArmadura({ classe: 'Guerreiro' }, COURO), true);
  assert.equal(equip.temProficienciaArmadura({ classe: 'Guerreiro' }, COTA_MALHA), true);
});

test('proficiencia de armadura: Mago nao veste nem a Leve', () => {
  assert.equal(equip.temProficienciaArmadura({ classe: 'Mago' }, COURO), false);
});

test('proficiencia de armadura: Escudo e ramo proprio, nao categoria', () => {
  assert.equal(equip.temProficienciaArmadura({ classe: 'Guerreiro' }, ESCUDO), true);
  assert.equal(equip.temProficienciaArmadura({ classe: 'Mago' }, ESCUDO), false);
  assert.equal(
    equip.temProficienciaArmadura({ classe: 'Mago', proficiencias_extra: ['Escudo'] }, ESCUDO),
    true);
});

test('requisito de Forca: sem requisito passa sempre', () => {
  assert.equal(equip.atendeRequisitoForca({ atributos: { forca: 8 } }, COURO), true);
  assert.equal(equip.atendeRequisitoForca({ atributos: { forca: 8 } }, { requisito_forca: '—' }), true);
});

test('requisito de Forca: compara o numero do campo com a Forca do personagem', () => {
  const armadura = { nome: 'Cota de Malha', categoria: 'Pesada', requisito_forca: 'For. 13' };
  assert.equal(equip.atendeRequisitoForca({ atributos: { forca: 13 } }, armadura), true);
  assert.equal(equip.atendeRequisitoForca({ atributos: { forca: 12 } }, armadura), false);
  // Personagem sem `atributos` conta como Forca 10 (default do original,
  // creator/passo-equipamento.js) -- 10 < 13, entao nao atende.
  assert.equal(equip.atendeRequisitoForca({}, armadura), false);
  // ... mas atende um requisito de 10 ou menos, que e o que distingue o
  // default 10 de um default 0.
  assert.equal(equip.atendeRequisitoForca({}, { requisito_forca: 'For 10' }), true);
});

test('badge de proficiencia usa a variante compacta', () => {
  assert.match(equip.badgeProficiencia(true), /badge-prof-sm/);
  assert.match(equip.badgeProficiencia(false), /badge-no-prof-sm/);
});
