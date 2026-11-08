// ============================================================
// Patrono Lâmina Maldita (Bruxo, Xanathar's): fonte, dados, carga em db.js,
// magias sempre preparadas e proficiências do Guerreiro Maldito.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAIZ, modulosApp } from './harness.mjs';

const { db, levelup, regrasSubclasseEscolhas, equip } = await modulosApp();
const lerJson = (rel) => JSON.parse(readFileSync(resolve(RAIZ, rel), 'utf-8'));

const NOME = 'Patrono Lâmina Maldita';
const CARACTERISTICAS = [
  ['Magia de Pacto da Lâmina Maldita', 3], ['Maldição da Lâmina Maldita', 3], ['Guerreiro Maldito', 3],
  ['Espectro Amaldiçoado', 6], ['Armadura de Maldições', 10], ['Mestre das Maldições', 14],
];

/** Magias sempre preparadas concedidas no nível novo, ordenadas para comparar como conjunto. */
async function magiasNoNivel(subclasse, nivel) {
  const magias = await levelup.obterMagiasSemprePreparadasNivel('Bruxo', subclasse, nivel);
  return magias.map((m) => m.nome).sort();
}

test('fontes.json registra o Xanathar como Suplemento 6', () => {
  const fonte = lerJson('dados/fontes.json').fontes.find((f) => f.id === 'xanathar');
  assert.ok(fonte, 'dados/fontes.json sem a entrada "xanathar"');
  assert.equal(fonte.nome, 'Suplemento 6');
  assert.equal(fonte.sigla, 'Sup. 6');
});

test('Bruxo junta o Patrono Lâmina Maldita depois das quatro subclasses do Livro do Jogador', async () => {
  const bruxo = await db.getClasse('Bruxo');
  const nomes = bruxo.subclasses.map((s) => s.nome);
  assert.equal(nomes.length, 5);
  assert.equal(nomes[4], NOME);
  const sub = bruxo.subclasses[4];
  assert.equal(sub.fonte, 'xanathar');
  assert.equal(sub.nome_en, 'The Hexblade');
  assert.deepEqual(sub.caracteristicas.map((c) => [c.nome, c.nivel]), CARACTERISTICAS);
  for (const s of bruxo.subclasses.slice(0, 4)) assert.equal(s.fonte, undefined, `${s.nome} não deve ter fonte`);
});

test('magias sempre preparadas por nível seguem o formato do Celestial', async () => {
  assert.deepEqual(await magiasNoNivel('Patrono Celestial', 5), ['Luz do Dia', 'Revivificar']);
  assert.deepEqual(await magiasNoNivel(NOME, 3), ['Destruição Colérica', 'Destruição Radiante', 'Escudo Arcano', 'Turvar']);
  assert.deepEqual(await magiasNoNivel(NOME, 5), ['Arma Elemental', 'Piscar']);
  assert.deepEqual(await magiasNoNivel(NOME, 7), ['Assassino Fantasmagórico', 'Destruição Atordoante']);
  // No nível 9 a característica de classe Contato com o Patrono acrescenta Contato Extraplanar a qualquer patrono.
  const celestial9 = await magiasNoNivel('Patrono Celestial', 9);
  assert.ok(celestial9.includes('Contato Extraplanar'));
  assert.deepEqual(await magiasNoNivel(NOME, 9), ['Cone de Frio', 'Contato Extraplanar', 'Destruição Banidora']);
});

test('Guerreiro Maldito concede armadura Média, Escudo e armas Marciais', () => {
  const linha = regrasSubclasseEscolhas.ESCOLHAS_SUBCLASSE_APP.find((l) => l.subclasse === NOME && l.caracteristica === 'Guerreiro Maldito');
  assert.ok(linha, 'linha de concessão ausente');
  assert.equal(linha.nivel, 3);
  assert.equal(linha.livro, 'dados/xanathar/bruxo/subclasses_bruxo.json');
  const p = { proficiencias_extra: [] };
  regrasSubclasseEscolhas.aplicarConcessaoAutomatica(p, linha, { classe: 'Bruxo' });
  for (const extra of ['Armadura Média', 'Escudo', 'Armas Marciais']) assert.ok(p.proficiencias_extra.includes(extra), extra);
  assert.equal(equip.temProficienciaArmadura(p, { nome: 'Cota de Malha Parcial', categoria: 'Média' }), true);
  assert.equal(equip.temProficienciaArmadura(p, { nome: 'Escudo', categoria: 'Escudo' }), true);
  assert.equal(equip.temProficienciaArmadura(p, { nome: 'Cota de Malha', categoria: 'Pesada' }), false);
  assert.equal(equip.temProficienciaArma(p, { nome: 'Espada Longa', categoria: 'Armas Marciais Corpo a Corpo' }), true);
  assert.equal(equip.temProficienciaArma(p, { nome: 'Adaga', categoria: 'Armas Simples Corpo a Corpo' }), false);
});

test('Bruxo Lâmina Maldita aberto em nível 3+ recebe as proficiências uma vez, salvando a ficha', async () => {
  const { sheetMigracoes, sheetEstado } = await modulosApp();
  const ficha = (sub, nivel) => ({
    classes: [{ classe: 'Bruxo', subclasse: sub, nivel, ordem: 0 }], classe: 'Bruxo', subclasse: sub, nivel,
    resistencias: [], grimorio: [], proficiencias_extra: [], recursos: {},
  });
  sheetEstado.definirChar(ficha(NOME, 5));
  sheetMigracoes.migrarConcessoesSubclasseMago();
  sheetMigracoes.migrarConcessoesSubclasseMago();
  const p = sheetEstado.char;
  assert.deepEqual(p.proficiencias_extra, ['Armadura Média', 'Escudo', 'Armas Marciais']);
  assert.equal(equip.temProficienciaArmadura(p, { nome: 'Cota de Malha Parcial', categoria: 'Média' }), true);
  assert.equal(equip.temProficienciaArmadura(p, { nome: 'Escudo', categoria: 'Escudo' }), true);
  assert.equal(equip.temProficienciaArma(p, { nome: 'Espada Longa', categoria: 'Armas Marciais Corpo a Corpo' }), true);
  sheetEstado.definirChar(ficha('Patrono Celestial', 5));
  sheetMigracoes.migrarConcessoesSubclasseMago();
  assert.deepEqual(sheetEstado.char.proficiencias_extra, []);
});
