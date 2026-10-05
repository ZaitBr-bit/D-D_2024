// ============================================================
// Sintonização restrita (site/js/regras-sintonizacao-restrita.js): leitura
// do texto `requisito_sintonizacao` do acervo e verificação contra a ficha.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { personagemMulticlasse, RAIZ } from './harness.mjs';
import { lerRequisito, atendeRequisito } from '../../../site/js/regras-sintonizacao-restrita.js';

const vazio = { classes: [], especies: [], conjurador: false, itens: [], verificavel: true };
const req = (extra) => ({ ...vazio, ...extra });

test('lerRequisito: uma classe', () => {
  assert.deepEqual(lerRequisito('por um Mago'), req({ classes: ['Mago'] }));
  assert.deepEqual(lerRequisito('por um Bruxo'), req({ classes: ['Bruxo'] }));
  assert.deepEqual(lerRequisito('por um Druida'), req({ classes: ['Druida'] }));
  assert.deepEqual(lerRequisito('por um Bardo'), req({ classes: ['Bardo'] }));
  assert.deepEqual(lerRequisito('por um Paladino'), req({ classes: ['Paladino'] }));
});

test('lerRequisito: lista de classes com vírgula e "ou"', () => {
  assert.deepEqual(lerRequisito('por um Bardo, Clérigo ou Druida'), req({ classes: ['Bardo', 'Clérigo', 'Druida'] }));
  assert.deepEqual(lerRequisito('por um Feiticeiro, Bruxo ou Mago'), req({ classes: ['Feiticeiro', 'Bruxo', 'Mago'] }));
  assert.deepEqual(lerRequisito('por um Bardo, Clérigo, Druida, Feiticeiro, Bruxo ou Mago'), req({ classes: ['Bardo', 'Clérigo', 'Druida', 'Feiticeiro', 'Bruxo', 'Mago'] }));
  assert.deepEqual(lerRequisito('por um Druida, Feiticeiro, Bruxo ou Mago'), req({ classes: ['Druida', 'Feiticeiro', 'Bruxo', 'Mago'] }));
  assert.deepEqual(lerRequisito('por um Druida ou Bruxo'), req({ classes: ['Druida', 'Bruxo'] }));
  assert.deepEqual(lerRequisito('por um Druida ou Guardião'), req({ classes: ['Druida', 'Guardião'] }));
  assert.deepEqual(lerRequisito('por um Clérigo, Druida ou Paladino'), req({ classes: ['Clérigo', 'Druida', 'Paladino'] }));
  assert.deepEqual(lerRequisito('por um Clérigo ou Paladino'), req({ classes: ['Clérigo', 'Paladino'] }));
});

test('lerRequisito: Conjurador, espécie com item e criatura escolhida pela arma', () => {
  assert.deepEqual(lerRequisito('por um Conjurador'), req({ conjurador: true }));
  assert.deepEqual(lerRequisito('por um Anão ou por uma Criatura Sintonizada com um Cinturão dos Anões'), req({ especies: ['Anão'], itens: ['Cinturão dos Anões'] }));
  assert.deepEqual(lerRequisito('por uma Criatura Escolhida pela Arma'), req({ verificavel: false }));
});

test('lerRequisito: texto vazio ou ausente não é verificável', () => {
  assert.deepEqual(lerRequisito(''), req({ verificavel: false }));
  assert.deepEqual(lerRequisito(undefined), req({ verificavel: false }));
});

test('lerRequisito cobre todos os textos reais do acervo como verificáveis, exceto a Arma Senciente', () => {
  const acervo = JSON.parse(readFileSync(resolve(RAIZ, 'dados/livro-do-mestre/capitulo7/itens_magicos.json'), 'utf-8')).itens;
  const textos = [...new Set(acervo.map((i) => i.requisito_sintonizacao).filter(Boolean))];
  assert.ok(textos.length >= 16);
  for (const t of textos) {
    const r = lerRequisito(t);
    assert.equal(r.verificavel, t !== 'por uma Criatura Escolhida pela Arma', t);
  }
});

test('atendeRequisito: Guerreiro 5 / Mago 1 atende "por um Mago"; Guerreiro puro não', async () => {
  const multi = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }, { classe: 'Mago', nivel: 1 }]);
  const puro = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  assert.equal(atendeRequisito(multi, lerRequisito('por um Mago')), true);
  assert.equal(atendeRequisito(puro, lerRequisito('por um Mago')), false);
});

test('atendeRequisito: espécie e item sintonizado do Anão', async () => {
  const anao = lerRequisito('por um Anão ou por uma Criatura Sintonizada com um Cinturão dos Anões');
  const g = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  assert.equal(atendeRequisito(g, anao), false);
  g.especie = 'Anão';
  assert.equal(atendeRequisito(g, anao), true);
  g.especie = 'Elfo';
  g.inventario = [{ nome: 'Cinturão dos Anões', tipo: 'magico', equipado: true, sintonizado: true, dados: {} }];
  assert.equal(atendeRequisito(g, anao), true);
  g.inventario[0].sintonizado = false;
  assert.equal(atendeRequisito(g, anao), false);
});

test('atendeRequisito: Cinturão dos Anões renomeado é reconhecido pelo magico_id', async () => {
  const anao = lerRequisito('por um Anão ou por uma Criatura Sintonizada com um Cinturão dos Anões');
  const g = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  g.especie = 'Elfo';
  g.inventario = [{ nome: 'Meu cinto de anão', tipo: 'magico', equipado: true, sintonizado: true, dados: { magico_id: 'cinturao-dos-anoes' } }];
  assert.equal(atendeRequisito(g, anao), true);
  // Outro item com o mesmo nome do requisito, mas de outro magico_id, não vale.
  g.inventario = [{ nome: 'Cinturão dos Anões', tipo: 'magico', equipado: true, sintonizado: true, dados: { magico_id: 'outro-cinto' } }];
  assert.equal(atendeRequisito(g, anao), false);
  // Sem magico_id (item manual), o nome continua valendo.
  g.inventario = [{ nome: 'Cinturão dos Anões', tipo: 'magico', equipado: true, sintonizado: true, dados: {} }];
  assert.equal(atendeRequisito(g, anao), true);
});

test('as listas de classes e espécies reconhecidas vêm das fontes da ficha', async () => {
  const { CLASSES_INFO } = await import('../../../site/js/dados-classes.js');
  const { ESPECIES } = await import('../../../site/js/regras-sintonizacao-restrita.js');
  const json = JSON.parse(readFileSync(resolve(RAIZ, 'dados/origens/especies.json'), 'utf-8'));
  assert.deepEqual([...ESPECIES].sort(), json.especies.map((e) => e.nome).sort());
  for (const classe of Object.keys(CLASSES_INFO)) assert.deepEqual(lerRequisito(`por um ${classe}`).classes, [classe]);
});

test('atendeRequisito: Conjurador pela conjuração de classe; Guerreiro puro não', async () => {
  const bruxo = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 3 }]);
  const guerreiro = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 3 }]);
  assert.equal(atendeRequisito(bruxo, lerRequisito('por um Conjurador')), true);
  assert.equal(atendeRequisito(guerreiro, lerRequisito('por um Conjurador')), false);
});

test('atendeRequisito: não verificável atende', async () => {
  const g = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 1 }]);
  assert.equal(atendeRequisito(g, lerRequisito('por uma Criatura Escolhida pela Arma')), true);
  assert.equal(atendeRequisito(g, lerRequisito('')), true);
});
