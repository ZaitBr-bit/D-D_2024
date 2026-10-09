// ============================================================
// Espécie Renascido (Ravenloft: Horrors Within, PDF p. 73).
//
// O PDF é só imagem: não há texto para confrontar por máquina. O catálogo
// abaixo transcreve o bloco "Reborn" da p. 73 (nomes em inglês, tamanho,
// deslocamento, resistências à escolha) e este arquivo confronta o dado de
// dados/ravenloft/ e os detectores da ficha com ele.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { modulosApp, RAIZ } from './harness.mjs';

const { utils, db, criador } = await modulosApp();
const importar = (rel) => import(pathToFileURL(resolve(RAIZ, rel)).href);
const { resistenciasDaEspecie } = await importar('site/js/regras-resistencias-especie.js');
const { ESPECIES: ESPECIES_SINTONIZACAO } = await importar('site/js/regras-sintonizacao-restrita.js');

const lerJson = (...partes) => JSON.parse(readFileSync(join(RAIZ, ...partes), 'utf-8'));

// Transcrição da p. 73: nome em inglês -> nome no app.
const TRACOS_DO_LIVRO = {
  'Escaped Death': 'Escapou da Morte',
  'Everlasting': 'Perpétuo',
  'Knowledge from a Past Life': 'Conhecimento de uma Vida Passada',
  'Strange Endurance': 'Resistência Estranha',
};
const RESISTENCIAS_DO_LIVRO = ['Gélido', 'Necrótico', 'Venenoso'];

/** Registro do Renascido carregado por db.getEspecies(). */
async function renascido() {
  const dados = await db.getEspecies();
  return dados.especies.find((e) => e.nome === 'Renascido');
}

test('fontes.json registra o Ravenloft com a sigla do chip', () => {
  const fonte = lerJson('dados', 'fontes.json').fontes.find((f) => f.id === 'ravenloft');
  assert.ok(fonte, 'dados/fontes.json sem a entrada "ravenloft"');
  assert.equal(fonte.sigla, 'Sup. 2');
  assert.equal(fonte.nome, 'Suplemento 2');
});

test('getEspecies junta as do Livro do Jogador e as do Ravenloft, nessa ordem', async () => {
  const phb = lerJson('dados', 'origens', 'especies.json').especies.map((e) => e.nome);
  const nomes = (await db.getEspecies()).especies.map((e) => e.nome);
  assert.deepEqual(nomes.slice(0, phb.length), phb, 'as espécies do Livro do Jogador vêm primeiro e inalteradas');
  assert.deepEqual(nomes.slice(phb.length), ['Renascido']);
});

test('Renascido traz fonte, nome em inglês e os quatro traços da p. 73', async () => {
  const esp = await renascido();
  assert.ok(esp, 'Renascido não carregou');
  assert.equal(esp.fonte, 'ravenloft');
  assert.equal(esp.nome_en, 'Reborn');
  assert.deepEqual(esp.tracos.map((t) => t.nome_en), Object.keys(TRACOS_DO_LIVRO));
  assert.deepEqual(esp.tracos.map((t) => t.nome), Object.values(TRACOS_DO_LIVRO));
});

test('cabeçalho: Médio ou Pequeno à escolha e Deslocamento de 9 metros', async () => {
  const esp = await renascido();
  assert.equal(utils.getTamanho(esp.texto_completo), 'Médio ou Pequeno');
  assert.equal(utils.getDeslocamento(esp.texto_completo), '9 metros');
  assert.match(esp.descricao, /\*\*Tipo de Criatura:\*\* Humanoide/);
});

test('Vida Passada: recarga no Descanso Longo, ativa, usos pelo Bônus de Proficiência', async () => {
  const t = (await renascido()).tracos.find((x) => x.nome === 'Conhecimento de uma Vida Passada');
  assert.equal(utils.detectarRecarga(t.descricao), 'longo');
  assert.equal(utils.ehHabilidadeAtiva(t.descricao), true);
  // Sem número escrito: a ficha cai no Bônus de Proficiência.
  const { detectarUsosMaximos } = await importar('site/js/sheet/habilidades.js');
  assert.equal(detectarUsosMaximos(t.descricao), null);
  assert.match(t.descricao, /teste de atributo/);
  assert.match(t.descricao, /1d6/);
});

test('Perpétuo é passivo: o Descanso Longo de 4 horas não vira contador de uso', async () => {
  const t = (await renascido()).tracos.find((x) => x.nome === 'Perpétuo');
  assert.equal(utils.detectarRecarga(t.descricao), null);
  assert.equal(utils.ehHabilidadeAtiva(t.descricao), false);
  assert.match(t.descricao, /4 horas/);
});

test('Resistência Estranha oferece Gélido, Necrótico e Venenoso no criador', () => {
  const cfg = criador.ESPECIES_TRACOS_ESCOLHA['Renascido'];
  assert.ok(cfg, 'ESPECIES_TRACOS_ESCOLHA sem o Renascido');
  assert.equal(cfg.maxEscolhas, 1);
  assert.deepEqual(cfg.opcoes.map((o) => o.nome), RESISTENCIAS_DO_LIVRO);
});

test('resistenciasDaEspecie: Renascido recebe só o tipo escolhido', () => {
  for (const tipo of RESISTENCIAS_DO_LIVRO) {
    assert.deepEqual(resistenciasDaEspecie('Renascido', [tipo]), [tipo]);
  }
  assert.deepEqual(resistenciasDaEspecie('Renascido', []), []);
  assert.deepEqual(resistenciasDaEspecie('Renascido', ['Ígneo']), [], 'tipo fora da lista do livro não vale');
});

test('resistenciasDaEspecie mantém as espécies do Livro do Jogador', () => {
  assert.deepEqual(resistenciasDaEspecie('Aasimar', []), ['Necrótico', 'Radiante']);
  assert.deepEqual(resistenciasDaEspecie('Anão', []), ['Venenoso']);
  assert.deepEqual(resistenciasDaEspecie('Draconato', ['Prata']), ['Gélido']);
  assert.deepEqual(resistenciasDaEspecie('Tiferino', ['Ctônico']), ['Necrótico']);
  assert.deepEqual(resistenciasDaEspecie('Humano', []), []);
});

test('sintonização restrita reconhece o Renascido como espécie', () => {
  assert.ok(ESPECIES_SINTONIZACAO.includes('Renascido'));
});
