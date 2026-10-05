// ============================================================
// Inventário com cargas e usos: contador, chips, destruído, pendência.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modulosApp, personagemMulticlasse, RAIZ } from './harness.mjs';
import * as C from '../../../site/js/itens-magicos-catalogo.js';
import * as R from '../../../site/js/regras-recursos-itens.js';

const { sheetEstado } = await modulosApp();
const inventario = await import('../../../site/js/sheet/inventario.js');
const ler = (rel) => JSON.parse(readFileSync(resolve(RAIZ, rel), 'utf-8'));
const ACERVO = ler('dados/livro-do-mestre/capitulo7/itens_magicos.json').itens;
const CATALOGOS = { armas: ler('dados/equipamento/armas.json').armas, armaduras: ler('dados/equipamento/armaduras.json').armaduras };
const PHB = ler('dados/equipamento/equipamento_aventura.json').itens;
const porId = (id) => ACERVO.find((i) => i.id === id);

/** Varinha de Bolas de Fogo nova (7 cargas). */
const varinha = () => C.montarItemInventario({ item: porId('varinha-de-bolas-de-fogo'), equipamentoPHB: PHB });

/** HTML do inventário para um Guerreiro 1 com os itens dados. */
async function html(itens) {
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 1 }]);
  p.inventario = itens;
  sheetEstado.definirChar(p);
  return inventario.renderSecaoInventario();
}

test('varinha: contador "⚡ 7/7" com − e +', async () => {
  const h = await html([varinha()]);
  assert.ok(/data-cargas-valor="0"[^>]*>⚡ 7\/7</.test(h), 'contador');
  assert.ok(h.includes('data-cargas-menos="0"') && h.includes('data-cargas-mais="0"'));
});

test('exige sintonização e não sintonizado: contador apagado com a dica', async () => {
  const v = varinha();
  const h = await html([v]);
  assert.equal(v.dados.requer_sintonizacao, true);
  assert.ok(h.includes('requer sintonização para usar'));
});

test('botão do amanhecer: contagem e contêiner estável para o refresh', async () => {
  const v = varinha();
  R.ajustarCarga(v, -3);
  R.aplicarDescansoRecursos({ inventario: [v] }, 'longo');
  const h = await html([v]);
  assert.ok(h.includes('id="sheet-recuperar-itens"'));
  assert.ok(inventario.htmlBotaoRecuperarItens().includes('(1)'));
  R.ajustarCarga(v, +3);
  assert.equal(inventario.htmlBotaoRecuperarItens(), '');
  assert.ok((await html([varinha()])).includes('id="sheet-recuperar-itens"'));
});

test('uso diário vira chip com o nome e gastos/máximo', async () => {
  const item = porId('azagaia-do-relampago');
  const base = C.opcoesDeBase(item.base, CATALOGOS).find((a) => a.nome === 'Azagaia');
  const montado = C.montarItemInventario({ item, base, equipamentoPHB: PHB });
  const uso = montado.dados.recursos.usos[0];
  const h = await html([montado]);
  assert.ok(h.includes(`data-uso-nome="${uso.nome}"`));
  assert.ok(h.includes(`${uso.nome} ${uso.max}/${uso.max}`));
});

test('destruído: linha riscada, sem contador, com Restaurar', async () => {
  const v = varinha();
  R.marcarDestruido(v);
  const h = await html([v]);
  assert.ok(h.includes('inv-item-destruido'));
  assert.ok(h.includes('data-restaurar-item="0"'));
  assert.ok(!h.includes('data-cargas-menos="0"'));
  assert.ok(!h.includes('data-sheet-equip="0"'));
});

test('pendência de recuperação mostra o botão do amanhecer', async () => {
  const v = varinha();
  R.ajustarCarga(v, -3);
  R.aplicarDescansoRecursos({ inventario: [v] }, 'longo');
  const h = await html([v]);
  assert.ok(/id="btn-recuperar-itens"[^>]*>[^<]*\(1\)/.test(h));
});

test('sem pendência não há botão do amanhecer', async () => {
  const h = await html([varinha()]);
  assert.ok(!h.includes('btn-recuperar-itens'));
});

test('item sem recursos não ganha contador', async () => {
  const h = await html([C.montarItemInventario({ item: porId('anel-de-protecao'), equipamentoPHB: PHB })]);
  assert.ok(!h.includes('data-cargas-valor'));
  assert.ok(!h.includes('data-uso-item'));
});

test('hp-descanso.js exporta abrirModalRecuperacao e carrega junto do inventário', async () => {
  const m = await import('../../../site/js/sheet/hp-descanso.js');
  assert.equal(typeof m.abrirModalRecuperacao, 'function');
});
