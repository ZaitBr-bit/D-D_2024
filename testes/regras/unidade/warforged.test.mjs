// ============================================================
// Espécie Warforged (Eberron: Forge of the Artificer, PDF p. 46).
// Confere o dado de dados/eberron/ contra os nomes e o cabeçalho do livro.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { modulosApp, personagemMulticlasse, RAIZ } from './harness.mjs';

const { utils, db } = await modulosApp();
const importar = (rel) => import(pathToFileURL(resolve(RAIZ, rel)).href);
const { ESPECIES: ESPECIES_SINTONIZACAO } = await importar('site/js/regras-sintonizacao-restrita.js');

const lerJson = (...partes) => JSON.parse(readFileSync(join(RAIZ, ...partes), 'utf-8'));

// Transcrição da p. 46: nome em inglês -> nome no app.
const TRACOS_DO_LIVRO = {
  'Construct Resilience': 'Resiliência de Construto',
  'Integrated Protection': 'Proteção Integrada',
  "Sentry's Rest": 'Descanso do Sentinela',
  'Specialized Design': 'Projeto Especializado',
  'Tireless': 'Incansável',
};

/** Registro do Warforged carregado por db.getEspecies(). */
async function warforged() {
  const dados = await db.getEspecies();
  return dados.especies.find((e) => e.nome === 'Warforged');
}

test('fontes.json registra o Eberron com a sigla do chip', () => {
  const fonte = lerJson('dados', 'fontes.json').fontes.find((f) => f.id === 'eberron');
  assert.deepEqual(fonte, { id: 'eberron', nome: 'Suplemento 5', sigla: 'Sup. 5' });
});

test('getEspecies junta as do Livro do Jogador, depois Renascido e Warforged', async () => {
  const phb = lerJson('dados', 'origens', 'especies.json').especies.map((e) => e.nome);
  const nomes = (await db.getEspecies()).especies.map((e) => e.nome);
  assert.deepEqual(nomes.slice(0, phb.length), phb);
  assert.deepEqual(nomes.slice(phb.length), ['Renascido', 'Warforged']);
});

test('Warforged traz fonte, nome em inglês, página e os cinco traços da p. 46', async () => {
  const esp = await warforged();
  assert.ok(esp, 'Warforged não carregou');
  assert.equal(esp.fonte, 'eberron');
  assert.equal(esp.nome_en, 'Warforged');
  assert.equal(esp.pagina_pdf, 46);
  assert.deepEqual(esp.tracos.map((t) => t.nome_en), Object.keys(TRACOS_DO_LIVRO));
  assert.deepEqual(esp.tracos.map((t) => t.nome), Object.values(TRACOS_DO_LIVRO));
});

test('cabeçalho: Construto, Médio ou Pequeno à escolha e Deslocamento de 9 metros', async () => {
  const esp = await warforged();
  assert.equal(utils.getTamanho(esp.texto_completo), 'Médio ou Pequeno');
  assert.equal(utils.getDeslocamento(esp.texto_completo), '9 metros');
  assert.match(esp.descricao, /\*\*Tipo de Criatura:\*\* Construto/);
});

test('sintonização restrita reconhece o Warforged como espécie', () => {
  assert.ok(ESPECIES_SINTONIZACAO.includes('Warforged'));
});

// Efeitos mecânicos: Proteção Integrada (+1 CA), Resiliência de Construto
// (Resistência a Veneno e Vantagem contra Envenenado).
const { sheetEstado } = await modulosApp();
const { bonusCADaEspecie, aplicarFerramentaDaEspecie } = await importar('site/js/regras-bonus-especie.js');
const { resistenciasDaEspecie } = await importar('site/js/regras-resistencias-especie.js');
const combate = await import('../../../site/js/sheet/combate.js');

/** Personagem da classe e espécie indicadas, já no estado da ficha. */
async function personagemDe(classe, especie) {
  const p = await personagemMulticlasse([{ classe, nivel: 1 }]);
  p.especie = especie;
  sheetEstado.definirChar(p);
  return p;
}

const armaduraEquipada = {
  nome: 'Couraça da Mesa', tipo: 'customizado', quantidade: 1, equipado: true, descricao: '',
  dados: { tipo_item: 'Armadura', tipo_armadura: 'Leve', ca_base: '14', bonus_ca: '0' },
};

test('bonusCADaEspecie: +1 só para o Warforged', () => {
  assert.equal(bonusCADaEspecie('Warforged'), 1);
  assert.equal(bonusCADaEspecie('Humano'), 0);
  assert.equal(bonusCADaEspecie(undefined), 0);
});

test('Proteção Integrada: CA do Warforged é 1 a mais que a do Humano (sem armadura)', async () => {
  const w = await personagemDe('Guerreiro', 'Warforged');
  const h = await personagemDe('Guerreiro', 'Humano');
  assert.equal(utils.calcCA(w), utils.calcCA(h) + 1);
});

test('Proteção Integrada: +1 também com armadura equipada', async () => {
  const w = await personagemDe('Guerreiro', 'Warforged');
  const h = await personagemDe('Guerreiro', 'Humano');
  w.inventario = [structuredClone(armaduraEquipada)];
  h.inventario = [structuredClone(armaduraEquipada)];
  assert.equal(utils.calcCA(w), utils.calcCA(h) + 1);
});

test('Proteção Integrada: +1 no Bárbaro 1 (Defesa sem Armadura)', async () => {
  const w = await personagemDe('Bárbaro', 'Warforged');
  const h = await personagemDe('Bárbaro', 'Humano');
  assert.equal(utils.calcCA(w), utils.calcCA(h) + 1);
});

test('Resiliência de Construto: Resistência a dano Venenoso', () => {
  assert.deepEqual(resistenciasDaEspecie('Warforged', []), ['Venenoso']);
});

test('Resiliência de Construto: Vantagem em salvaguarda só do Warforged Envenenado', async () => {
  const w = await personagemDe('Guerreiro', 'Warforged');
  assert.ok(!combate.calcVantagemDesvantagemSalvaguarda('Constituição').vantagens.includes('Resiliência de Construto'));
  w.condicoes = ['Envenenado'];
  assert.ok(combate.calcVantagemDesvantagemSalvaguarda('Constituição').vantagens.includes('Resiliência de Construto'));

  const h = await personagemDe('Guerreiro', 'Humano');
  h.condicoes = ['Envenenado'];
  assert.ok(!combate.calcVantagemDesvantagemSalvaguarda('Constituição').vantagens.includes('Resiliência de Construto'));
});

// Projeto Especializado: a ferramenta escolhida entra nas proficiências.
test('Projeto Especializado: ferramenta vai para proficiencias_ferramentas', () => {
  const p = { ferramenta_especie: 'Ferramentas de Ladrão' };
  aplicarFerramentaDaEspecie(p);
  assert.deepEqual(p.proficiencias_ferramentas, ['Ferramentas de Ladrão']);
  assert.equal(p.proficiencias_instrumentos, undefined);
});

test('Projeto Especializado: instrumento vai para proficiencias_instrumentos', () => {
  const p = { ferramenta_especie: 'Flauta' };
  aplicarFerramentaDaEspecie(p);
  assert.deepEqual(p.proficiencias_instrumentos, ['Flauta']);
  assert.equal(p.proficiencias_ferramentas, undefined);
});

test('Projeto Especializado: não duplica em chamadas repetidas nem com a do antecedente', () => {
  const p = { ferramenta_especie: 'Ferramentas de Ladrão', proficiencias_ferramentas: ['Ferramentas de Ladrão'] };
  aplicarFerramentaDaEspecie(p);
  aplicarFerramentaDaEspecie(p);
  assert.deepEqual(p.proficiencias_ferramentas, ['Ferramentas de Ladrão']);
  const q = { ferramenta_especie: 'Lira' };
  aplicarFerramentaDaEspecie(q);
  aplicarFerramentaDaEspecie(q);
  assert.deepEqual(q.proficiencias_instrumentos, ['Lira']);
});

test('Projeto Especializado: sem ferramenta_especie nada muda', () => {
  const p = { proficiencias_ferramentas: ['Kit de Veneno'] };
  aplicarFerramentaDaEspecie(p);
  assert.deepEqual(p, { proficiencias_ferramentas: ['Kit de Veneno'] });
});
