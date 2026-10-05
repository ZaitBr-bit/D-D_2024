// ============================================================
// Issue #103 (b) -- Pergaminho Mágico: magia escolhida (ou "Em branco"),
// troca depois de adicionado, custo 'consome' e consumo ao conjurar.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAIZ } from './harness.mjs';
import * as C from '../../../site/js/itens-magicos-catalogo.js';
import * as P from '../../../site/js/regras-pergaminho.js';
import * as R from '../../../site/js/regras-magias-itens.js';

/** Lê e interpreta um JSON relativo à raiz do repositório. */
const ler = (rel) => JSON.parse(readFileSync(resolve(RAIZ, rel), 'utf-8'));
const ACERVO = ler('dados/livro-do-mestre/capitulo7/itens_magicos.json').itens;
const PHB = ler('dados/equipamento/equipamento_aventura.json').itens;
const PERGAMINHO = ACERVO.find((i) => i.id === 'pergaminho-magico');
/** Variante do Pergaminho Mágico pelo id. */
const variante = (id) => PERGAMINHO.variantes.find((v) => v.id === id);
/** Monta o item de inventário do pergaminho da variante `id` com a magia dada (null = Em branco). */
const montar = (id, magia) => C.montarItemInventario({ item: PERGAMINHO, variante: variante(id), equipamentoPHB: PHB, magia });

test('circuloDoPergaminho lê o círculo do id da variante', () => {
  assert.equal(P.circuloDoPergaminho({ id: 'pergaminho-magico-truque' }), 0);
  assert.equal(P.circuloDoPergaminho({ id: 'pergaminho-magico-1-circulo' }), 1);
  assert.equal(P.circuloDoPergaminho({ id: 'pergaminho-magico-9-circulo' }), 9);
  assert.equal(P.circuloDoPergaminho({ id: 'anel-de-protecao' }), null);
  assert.equal(P.circuloDoPergaminho(null), null);
});

test('TABELA_PERGAMINHO bate com a tabela do Guia do Mestre', () => {
  for (const [rotulo, , cd, atq] of PERGAMINHO.tabelas[0].dados) {
    const circulo = rotulo === 'Truque' ? 0 : Number(rotulo);
    assert.deepEqual(P.TABELA_PERGAMINHO[circulo], { cd: Number(cd), ataque: Number(atq.replace('+', '')) }, `círculo ${circulo}`);
  }
});

test('etapa da magia não feita (undefined): nenhuma variante é montada, nem as de livro_jogador', () => {
  for (const id of ['pergaminho-magico-truque', 'pergaminho-magico-1-circulo', 'pergaminho-magico-3-circulo']) {
    assert.equal(montar(id, undefined), null, id);
  }
});

test('magia de círculo diferente do pergaminho é recusada', () => {
  assert.equal(montar('pergaminho-magico-3-circulo', { nome: 'Mísseis Mágicos', circulo: 1 }), null);
});

test('Em branco (null): item sem magia, com círculo e nome-base guardados', () => {
  const r = montar('pergaminho-magico-3-circulo', null);
  assert.equal(r.nome, 'Pergaminho Mágico (3º Círculo)');
  assert.deepEqual(r.dados.magias, []);
  assert.deepEqual(r.dados.pergaminho, { circulo: 3, nome_base: 'Pergaminho Mágico (3º Círculo)' });
  assert.equal(R.magiasDeItens({ inventario: [r] }).length, 0);
});

test('3º círculo com Bola de Fogo: nome, magia, custo e CD da tabela', () => {
  const r = montar('pergaminho-magico-3-circulo', { nome: 'Bola de Fogo', circulo: 3 });
  assert.equal(r.nome, 'Pergaminho Mágico (3º Círculo): Bola de Fogo');
  assert.deepEqual(r.dados.magias, [{ nome: 'Bola de Fogo', custo: 'consome', conjuracao: { cd: 15, ataque: 7 }, circulo_base: 3 }]);
});

test('truque (variante de livro_jogador) mantém o registro do livro e recebe a magia', () => {
  const r = montar('pergaminho-magico-truque', { nome: 'Raio de Fogo', circulo: 0 });
  assert.equal(r.nome, 'Pergaminho Mágico (Truque): Raio de Fogo');
  assert.equal(r.tipo, 'equipamento');
  assert.equal(r.dados.magias[0].circulo_base, 0);
  assert.equal(r.quantidade, 1);
});

test('equipamento_aventura.json segue com os dois registros do livro (a variante os usa); só a listagem os esconde', () => {
  assert.ok(PHB.some((r) => r.nome === 'Pergaminho Mágico (Truque)'));
  assert.ok(PHB.some((r) => r.nome === 'Pergaminho Mágico (1º Círculo)'));
});

test('outros itens mágicos continuam sem exigir magia', () => {
  const anel = ACERVO.find((i) => i.id === 'anel-de-protecao');
  assert.ok(C.montarItemInventario({ item: anel, equipamentoPHB: PHB }));
});

test('circuloDoItemPergaminho e nomeBaseDoPergaminho: item novo, item antigo comprado como equipamento e item que não é pergaminho', () => {
  const novo = montar('pergaminho-magico-3-circulo', { nome: 'Bola de Fogo', circulo: 3 });
  assert.equal(P.circuloDoItemPergaminho(novo), 3);
  assert.equal(P.nomeBaseDoPergaminho(novo), 'Pergaminho Mágico (3º Círculo)');
  const antigo = { nome: 'Pergaminho Mágico (Truque)', tipo: 'equipamento', quantidade: 1, dados: {} };
  assert.equal(P.circuloDoItemPergaminho(antigo), 0);
  assert.equal(P.nomeBaseDoPergaminho(antigo), 'Pergaminho Mágico (Truque)');
  assert.equal(P.circuloDoItemPergaminho({ nome: 'Pergaminho', dados: {} }), null);
  assert.equal(P.circuloDoItemPergaminho({ nome: 'Estojo, Mapa ou Pergaminho', dados: {} }), null);
});

test('aplicarMagiaNoPergaminho: escolhe, troca e volta a Em branco, renomeando', () => {
  const item = montar('pergaminho-magico-3-circulo', null);
  const p = { inventario: [item] };
  assert.equal(P.aplicarMagiaNoPergaminho(p, item, { nome: 'Bola de Fogo', circulo: 3 }), true);
  assert.equal(item.nome, 'Pergaminho Mágico (3º Círculo): Bola de Fogo');
  assert.equal(item.dados.magias[0].nome, 'Bola de Fogo');
  assert.equal(P.aplicarMagiaNoPergaminho(p, item, { nome: 'Relâmpago', circulo: 3 }), true);
  assert.equal(item.nome, 'Pergaminho Mágico (3º Círculo): Relâmpago');
  assert.equal(P.aplicarMagiaNoPergaminho(p, item, null), true);
  assert.equal(item.nome, 'Pergaminho Mágico (3º Círculo)');
  assert.deepEqual(item.dados.magias, []);
  assert.equal(p.inventario.length, 1);
});

test('aplicarMagiaNoPergaminho funciona em pergaminho antigo (sem dados.pergaminho)', () => {
  const antigo = { nome: 'Pergaminho Mágico (1º Círculo)', tipo: 'equipamento', quantidade: 1, dados: { custo: '50 PO' } };
  const p = { inventario: [antigo] };
  assert.equal(P.aplicarMagiaNoPergaminho(p, antigo, { nome: 'Mísseis Mágicos', circulo: 1 }), true);
  assert.equal(antigo.nome, 'Pergaminho Mágico (1º Círculo): Mísseis Mágicos');
  assert.equal(antigo.dados.custo, '50 PO');
  assert.deepEqual(antigo.dados.pergaminho, { circulo: 1, nome_base: 'Pergaminho Mágico (1º Círculo)' });
});

test('aplicarMagiaNoPergaminho com quantidade 2 separa uma unidade e deixa a outra como estava', () => {
  const item = montar('pergaminho-magico-3-circulo', null);
  item.quantidade = 2;
  const p = { inventario: [item] };
  assert.equal(P.aplicarMagiaNoPergaminho(p, item, { nome: 'Bola de Fogo', circulo: 3 }), true);
  assert.equal(p.inventario.length, 2);
  assert.equal(item.quantidade, 1);
  assert.equal(item.nome, 'Pergaminho Mágico (3º Círculo)');
  assert.equal(p.inventario[1].nome, 'Pergaminho Mágico (3º Círculo): Bola de Fogo');
  assert.equal(p.inventario[1].quantidade, 1);
});

test('aplicarMagiaNoPergaminho recusa círculo errado, item que não é pergaminho e item fora do inventário', () => {
  const item = montar('pergaminho-magico-3-circulo', null);
  const p = { inventario: [item] };
  assert.equal(P.aplicarMagiaNoPergaminho(p, item, { nome: 'Mísseis Mágicos', circulo: 1 }), false);
  assert.equal(item.nome, 'Pergaminho Mágico (3º Círculo)');
  const outro = { nome: 'Corda', quantidade: 1, dados: {} };
  assert.equal(P.aplicarMagiaNoPergaminho({ inventario: [outro] }, outro, null), false);
  assert.equal(P.aplicarMagiaNoPergaminho({ inventario: [] }, item, null), false);
});

test("custo 'consome': opção sem cargas, pronta sem equipar nem sintonizar, rótulo próprio", () => {
  const magia = { nome: 'Bola de Fogo', custo: 'consome', conjuracao: { cd: 15, ataque: 7 }, circulo_base: 3 };
  assert.deepEqual(R.opcoesDeCusto(magia), [{ consome: true, cargas: 0, circulo: 3 }]);
  const item = { nome: 'Pergaminho', quantidade: 1, equipado: false, dados: { magias: [magia] } };
  assert.deepEqual(R.situacaoConjuracao(item, { consome: true, cargas: 0, circulo: 3 }), { ok: true, motivo: '' });
  assert.equal(R.situacaoConjuracao({ ...item, destruido: true }, { consome: true }).ok, false);
  assert.equal(R.rotuloCusto(magia, item), 'consome o pergaminho');
  assert.equal(R.magiasDeItens({ inventario: [item] }).length, 1);
});

test('consumirPergaminho: quantidade 2 vira 1; quantidade 1 remove o item; item fora do inventário devolve false', () => {
  const a = { nome: 'A', quantidade: 2 };
  const b = { nome: 'B', quantidade: 1 };
  const p = { inventario: [a, b] };
  assert.equal(R.consumirPergaminho(p, a), true);
  assert.equal(a.quantidade, 1);
  assert.equal(p.inventario.length, 2);
  assert.equal(R.consumirPergaminho(p, b), true);
  assert.deepEqual(p.inventario, [a]);
  assert.equal(R.consumirPergaminho(p, { nome: 'X', quantidade: 1 }), false);
});
