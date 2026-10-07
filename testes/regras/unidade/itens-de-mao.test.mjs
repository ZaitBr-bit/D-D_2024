// ============================================================
// Itens mágicos de mão (varinha, bastão, cajado e itens do livro que valem
// "enquanto o segura"): ocupam 1 mão quando equipados; sem mão livre equipam e avisam.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RAIZ, modulosApp } from './harness.mjs';

await modulosApp();
const A = await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-ataque.js')).href);
const acervo = JSON.parse(readFileSync(resolve(RAIZ, 'dados/livro-do-mestre/capitulo7/itens_magicos.json'), 'utf-8')).itens;

/** Item de inventário mágico com os campos que o catálogo grava em `dados`. */
const magico = (nome, dados = {}) => ({ nome, tipo: 'magico', quantidade: 1, equipado: true, dados: { ...dados } });
const espada = { nome: 'Espada Curta', tipo: 'arma', quantidade: 1, equipado: true, dados: { dano: '1d6', categoria: 'Marcial Corpo a Corpo', propriedades: 'Acuidade, Leve' } };
const escudo = { nome: 'Escudo', tipo: 'escudo', quantidade: 1, equipado: true, dados: {} };

test('varinha, bastão e cajado (pela linha de tipo) e os itens revisados são de mão', () => {
  assert.equal(A.ehItemDeMao(magico('Varinha de Mísseis Mágicos', { linha_tipo: 'Varinha, Incomum' })), true);
  assert.equal(A.ehItemDeMao(magico('Bastão da Segurança', { linha_tipo: 'Bastão, Lendário' })), true);
  assert.equal(A.ehItemDeMao(magico('Cajado da Serpente', { linha_tipo: 'Cajado, Incomum' })), true);
  assert.equal(A.ehItemDeMao(magico('Orbe do Tempo', { magico_id: 'orbe-do-tempo', linha_tipo: 'Item Maravilhoso, Raro' })), true);
  assert.equal(A.ehItemDeMao(magico('Chapéu de Muitas Magias', { magico_id: 'chapeu-de-muitas-magias', linha_tipo: 'Item Maravilhoso, Muito Raro' })), true, 'é Foco de Conjuração, segurado');
  assert.equal(A.ehItemDeMao(magico('Chapéu de Pragas', { magico_id: 'chapeu-de-pragas', linha_tipo: 'Item Maravilhoso, Comum' })), false, 'uso eventual, fica no corpo');
  assert.equal(A.ehItemDeMao(magico('Bolsa de Temperos Prática de Heward', { magico_id: 'bolsa-de-temperos-pratica-de-heward', linha_tipo: 'Item Maravilhoso, Comum' })), false, 'bolsa de cinto, uso eventual');
  assert.equal(A.ehItemDeMao(magico('Anel de Proteção', { linha_tipo: 'Anel, Raro' })), false);
  assert.equal(A.ehItemDeMao(magico('Buraco Portátil', { magico_id: 'buraco-portatil', linha_tipo: 'Item Maravilhoso, Raro' })), false, 'cita segurar só de passagem');
  assert.equal(A.ehItemDeMao(espada), false, 'arma tem a regra própria');
  assert.equal(A.ehItemDeMao(escudo), false, 'escudo tem a regra própria');
});

test('todos os ids revisados existem no acervo e nenhum é varinha, bastão ou cajado (esses entram pelo tipo)', () => {
  for (const id of A.IDS_ITENS_MAGICOS_DE_MAO) {
    const item = acervo.find((i) => i.id === id);
    assert.ok(item, `id ${id} não existe no acervo`);
    assert.ok(!/^(Varinha|Bastão|Cajado)/.test(item.tipo), `${id} já é de mão pelo tipo`);
  }
});

test('equipado ocupa 1 mão; guardado não; entra na conta de mãos em uso', () => {
  const varinha = magico('Varinha', { linha_tipo: 'Varinha, Rara' });
  assert.equal(A.maosOcupadas(varinha), 1);
  const p = { inventario: [espada, varinha] };
  assert.equal(A.maosEmUso(p), 2);
  varinha.equipado = false;
  assert.equal(A.maosEmUso(p), 1);
});

test('sem mão livre o item de mão equipa e avisa; a arma continua sendo recusada', () => {
  const varinha = magico('Varinha', { linha_tipo: 'Varinha, Rara', ...{} });
  varinha.equipado = false;
  const cheio = { inventario: [espada, escudo, varinha] };
  const v = A.equiparComAjusteDeMaos(cheio, varinha);
  assert.equal(v.ok, true, 'não bloqueia');
  assert.match(v.aviso, /Mãos excedidas \(3 de 2\)/);
  const livre = { inventario: [espada, varinha] };
  assert.equal(A.equiparComAjusteDeMaos(livre, varinha).aviso, undefined, 'com mão livre não há aviso');
  const outra = { ...espada, nome: 'Adaga', equipado: false };
  assert.equal(A.equiparComAjusteDeMaos({ inventario: [espada, escudo, outra] }, outra).ok, false, 'arma sem mão é recusada como antes');
});

test('bastão e cajado são versáteis: 2 mãos quando empunhados com duas; varinha e outros itens de mão nunca', () => {
  const cajado = magico('Cajado da Serpente', { linha_tipo: 'Cajado, Incomum' });
  const bastao = magico('Bastão da Segurança', { linha_tipo: 'Bastão, Lendário' });
  const varinha = magico('Varinha de Mísseis Mágicos', { linha_tipo: 'Varinha, Incomum' });
  const orbe = magico('Orbe do Tempo', { magico_id: 'orbe-do-tempo', linha_tipo: 'Item Maravilhoso, Raro' });
  assert.equal(A.ehItemVersatilDeMao(cajado), true);
  assert.equal(A.ehItemVersatilDeMao(bastao), true);
  assert.equal(A.ehItemVersatilDeMao(varinha), false);
  assert.equal(A.ehItemVersatilDeMao(orbe), false);
  assert.equal(A.maosOcupadas(cajado), 1);
  cajado.dados.empunhadura = 'duas';
  assert.equal(A.maosOcupadas(cajado), 2);
  varinha.dados.empunhadura = 'duas';
  assert.equal(A.maosOcupadas(varinha), 1, 'varinha não tem empunhadura de duas mãos');
});

test('equipar um escudo com o cajado em duas mãos devolve o cajado para uma mão', () => {
  const cajado = magico('Cajado da Serpente', { linha_tipo: 'Cajado, Incomum', empunhadura: 'duas' });
  const escudoNovo = { ...escudo, equipado: false };
  const p = { inventario: [cajado, escudoNovo] };
  const v = A.equiparComAjusteDeMaos(p, escudoNovo);
  assert.equal(v.ok, true);
  assert.deepEqual(v.ajustados, ['Cajado da Serpente']);
  assert.equal(cajado.dados.empunhadura, undefined);
});
