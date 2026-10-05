// ============================================================
// Item mágico no inventário da ficha: selos (raridade, sintonização,
// efeitos com estado), proficiência/Maestria pelo nome da base, detalhe com
// tabelas, impressão, e o loader do acervo.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modulosApp, personagemMulticlasse, RAIZ } from './harness.mjs';
import * as C from '../../../site/js/itens-magicos-catalogo.js';

const { sheetEstado, db, utils } = await modulosApp();
const inventario = await import('../../../site/js/sheet/inventario.js');
const ui = await import('../../../site/js/itens-magicos-ui.js');
const ler = (rel) => JSON.parse(readFileSync(resolve(RAIZ, rel), 'utf-8'));
const ACERVO = ler('dados/livro-do-mestre/capitulo7/itens_magicos.json').itens;
const CATALOGOS = { armas: ler('dados/equipamento/armas.json').armas, armaduras: ler('dados/equipamento/armaduras.json').armaduras };
const PHB = ler('dados/equipamento/equipamento_aventura.json').itens;
const porId = (id) => ACERVO.find((i) => i.id === id);

/** Item de inventário montado a partir do acervo real. */
function montar(id, varianteId = null, nomeBase = null) {
  const item = porId(id);
  const variante = varianteId ? item.variantes.find((v) => v.id === varianteId) : null;
  const base = nomeBase ? C.opcoesDeBase(item.base, CATALOGOS).find((a) => a.nome === nomeBase) : null;
  return C.montarItemInventario({ item, variante, base, equipamentoPHB: PHB });
}

/** HTML do inventário para um Guerreiro 1 com o inventário dado. */
async function html(inventarioItens, extra = {}) {
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 1 }]);
  p.inventario = inventarioItens;
  Object.assign(p, extra);
  sheetEstado.definirChar(p);
  return inventario.renderSecaoInventario();
}

test('getItensMagicos carrega o acervo do Livro do Mestre', async () => {
  const acervo = await db.getItensMagicos();
  assert.equal(acervo.itens.length, ACERVO.length);
});

test('Anel de Proteção: selos de raridade, sintonização e efeitos inativos sem sintonizar', async () => {
  const anel = { ...montar('anel-de-protecao'), equipado: true, sintonizado: false };
  const h = await html([anel]);
  assert.ok(h.includes('Rara'), 'selo de raridade');
  assert.ok(h.includes('Sintonização'), 'selo de sintonização');
  assert.ok(/data-selo-efeito="inativo"[^>]*title="requer sintonização"[^>]*>CA \+1</.test(h), 'CA +1 inativo com o motivo');
});

test('Anel de Proteção sintonizado: selos de efeito ativos', async () => {
  const anel = { ...montar('anel-de-protecao'), equipado: true, sintonizado: true };
  const h = await html([anel]);
  assert.ok(/data-selo-efeito="ativo"[^>]*>CA \+1</.test(h));
  assert.ok(/data-selo-efeito="ativo"[^>]*>Salv \+1</.test(h));
});

test('Escudo +1: selo de proficiência pelo nome da base (Guerreiro é proficiente em Escudo)', async () => {
  const h = await html([montar('escudo-mais-1-mais-2-ou-mais-3', 'escudo-mais-1', 'Escudo')]);
  const linha = h.slice(h.indexOf('Escudo +1'));
  assert.ok(linha.indexOf('badge-prof-sm') !== -1 && (linha.indexOf('badge-no-prof-sm') === -1 || linha.indexOf('badge-prof-sm') < linha.indexOf('badge-no-prof-sm')),
    'o Escudo +1 tem de mostrar "Prof", como o Escudo comum');
});

test('Arma +1 (Rapieira): Maestria aparece quando o personagem escolheu Rapieira', async () => {
  const h = await html([montar('arma-mais-1-mais-2-ou-mais-3', 'arma-mais-1', 'Rapieira')], { maestrias_arma: ['Rapieira'] });
  assert.ok(h.includes('Maestria: '), 'selo de Maestria da Rapieira');
});

test('htmlTabelasItemMagico: cabeçalhos e linhas como <table>, com escape', () => {
  const h = ui.htmlTabelasItemMagico([{ titulo: 'Tabela <x>', cabecalhos: ['1d4', 'Efeito'], dados: [['1', 'a & b'], ['2–4', 'c']] }]);
  assert.ok(h.includes('<table'));
  assert.ok(h.includes('<th>1d4</th>') && h.includes('<th>Efeito</th>'));
  assert.ok(h.includes('<td>a &amp; b</td>'));
  assert.ok(h.includes('Tabela &lt;x&gt;'));
});

test('htmlCorpoItemMagico: linha de tipo, descrição em markdown e tabelas', () => {
  const cint = montar('cinturao-de-forca-do-gigante', 'cinturao-de-forca-do-gigante-das-colinas');
  const h = ui.htmlCorpoItemMagico(cint.dados);
  assert.ok(h.includes(utils.escHtml(cint.dados.linha_tipo)));
  assert.ok(h.includes('<table'), 'a tabela de gigantes do Cinturão aparece');
});

/** HTML de impressão de um Guerreiro 1 com os itens (equipados) dados; devolve o texto dos spans da linha do item. */
async function imprimir(itens) {
  const impr = await import('../../../site/js/sheet/impressao.js');
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 1 }]);
  p.inventario = itens;
  sheetEstado.definirChar(p);
  const h = await impr.gerarHtmlImpressao();
  assert.ok(!h.includes('undefined') && !h.includes('[object'), 'sem undefined/[object no HTML impresso');
  const span = (classe, nome) => {
    const ini = h.indexOf(`>${utils.escHtml(nome)}</span>`);
    assert.ok(ini !== -1, `item ${nome} na impressão`);
    const re = new RegExp(`<span class="${classe}">([^<]*)</span>`);
    const m = re.exec(h.slice(ini));
    return m ? m[1] : '';
  };
  return { h, efeito: (n) => span('print-equip-effect', n), detalhe: (n) => span('print-equip-detail', n) };
}

test('impressão: Anel de Proteção mostra efeitos, tipo, raridade e sintonização', async () => {
  const anel = { ...montar('anel-de-protecao'), equipado: true, sintonizado: true };
  const r = await imprimir([anel]);
  const ef = r.efeito(anel.nome);
  assert.ok(ef.includes('CA +1') && ef.includes('Salv +1'), ef);
  assert.ok(ef.includes(utils.escHtml(anel.dados.linha_tipo)), 'linha de tipo');
  assert.equal(r.detalhe(anel.nome), 'Rara | Requer Sintonizacao');
});

test('impressão: Escudo +1 e Arma +1 (Rapieira) mostram o +N e a raridade antes do detalhe', async () => {
  const escudo = { ...montar('escudo-mais-1-mais-2-ou-mais-3', 'escudo-mais-1', 'Escudo'), equipado: true };
  const arma = { ...montar('arma-mais-1-mais-2-ou-mais-3', 'arma-mais-1', 'Rapieira'), equipado: true };
  const r = await imprimir([escudo, arma]);
  assert.ok(r.detalhe(escudo.nome).startsWith('Incomum'), r.detalhe(escudo.nome));
  assert.ok(r.efeito(escudo.nome).includes('+1'), r.efeito(escudo.nome));
  assert.ok(r.detalhe(arma.nome).startsWith('Incomum'), r.detalhe(arma.nome));
  assert.ok(r.efeito(arma.nome).includes('+1 Atq/Dano'), r.efeito(arma.nome));
});
