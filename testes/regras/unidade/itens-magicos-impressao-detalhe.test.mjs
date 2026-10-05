// ============================================================
// Itens mágicos: impressão (efeito inativo, cargas/usos, destruído, Magias
// de Itens, Atq/Dano parcial), HTML do detalhe do item, nome gravado com
// base, guarda de requisição do seletor e filtro de precache do deploy.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modulosApp, personagemMulticlasse, RAIZ } from './harness.mjs';
import * as C from '../../../site/js/itens-magicos-catalogo.js';

const { sheetEstado, utils } = await modulosApp();
const inventario = await import('../../../site/js/sheet/inventario.js');
const ui = await import('../../../site/js/itens-magicos-ui.js');
const recursos = await import('../../../site/js/regras-recursos-itens.js');
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

/** HTML de impressão de um Guerreiro 1 com o inventário dado. */
async function imprimir(itens) {
  const impr = await import('../../../site/js/sheet/impressao.js');
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 1 }]);
  p.inventario = itens;
  sheetEstado.definirChar(p);
  const h = await impr.gerarHtmlImpressao();
  assert.ok(!h.includes('undefined') && !h.includes('[object'), 'sem undefined/[object no HTML impresso');
  return h;
}

/** Texto do span `classe` da linha do item `nome` no HTML de impressão ('' sem o span). */
function span(h, classe, nome) {
  const ini = h.indexOf(`>${utils.escHtml(nome)}</span>`);
  assert.ok(ini !== -1, `item ${nome} na impressão`);
  const m = new RegExp(`<span class="${classe}">([^<]*)</span>`).exec(h.slice(ini));
  return m ? m[1] : '';
}

// ---------- 5.1 efeito inativo ----------

test('5.1 impressão: item guardado ou sem sintonização não lista o bônus de efeito', async () => {
  const guardado = { ...montar('anel-de-protecao'), equipado: false, sintonizado: true };
  let h = await imprimir([guardado]);
  assert.ok(!span(h, 'print-inv-effect', guardado.nome).includes('CA +1'), 'guardado não lista CA +1');

  const semSintonia = { ...montar('anel-de-protecao'), equipado: true, sintonizado: false };
  h = await imprimir([semSintonia]);
  assert.ok(!span(h, 'print-equip-effect', semSintonia.nome).includes('CA +1'), 'sem sintonização não lista CA +1');

  const ativo = { ...montar('anel-de-protecao'), equipado: true, sintonizado: true };
  h = await imprimir([ativo]);
  assert.ok(span(h, 'print-equip-effect', ativo.nome).includes('CA +1'), 'equipado e sintonizado lista CA +1');
});

test('5.1 impressão: arma mágica guardada não soma Atq/Dano', async () => {
  const arma = { ...montar('arma-mais-1-mais-2-ou-mais-3', 'arma-mais-1', 'Rapieira'), equipado: false };
  const h = await imprimir([arma]);
  assert.ok(!span(h, 'print-inv-effect', arma.nome).includes('Atq'), span(h, 'print-inv-effect', arma.nome));
});

// ---------- 5.2 cargas, usos e destruído ----------

test('5.2 impressão: mochila mostra cargas e usos dos itens com recursos', async () => {
  const cajado = { ...montar('cajado-da-cura'), equipado: false };
  const cajadoGasto = { ...cajado, estado_recursos: { cargas: 4, usos: {} } };
  const manto = { ...montar('manto-aracnideo'), equipado: false };
  const mantoGasto = { ...manto, estado_recursos: { usos: { Teia: 1 } } };
  const h = await imprimir([cajadoGasto, mantoGasto]);
  assert.ok(span(h, 'print-inv-effect', cajado.nome).includes('cargas 4/10'), span(h, 'print-inv-effect', cajado.nome));
  assert.ok(span(h, 'print-inv-effect', manto.nome).includes('Teia 0/1'), span(h, 'print-inv-effect', manto.nome));
  // Sem estado gravado, o item conta como cheio.
  const h2 = await imprimir([cajado]);
  assert.ok(span(h2, 'print-inv-effect', cajado.nome).includes('cargas 10/10'));
});

test('5.2 impressão: item destruído sai com "(destruído)" e sem contador', async () => {
  const cajado = montar('cajado-da-cura');
  recursos.marcarDestruido(cajado);
  const h = await imprimir([cajado]);
  assert.ok(h.includes(`${utils.escHtml(cajado.nome)} (destruído)</span>`), 'nome com (destruído)');
  assert.ok(!h.includes('cargas 10/10'), 'item destruído não imprime contador');
});

// ---------- 5.3 Magias de Itens ----------

test('5.3 impressão: Magias de Itens lista magia, item, custo e CD, sem botões', async () => {
  const manto = { ...montar('manto-aracnideo'), equipado: true, sintonizado: true };
  const h = await imprimir([manto]);
  const ini = h.indexOf('Magias de Itens</div>');
  assert.ok(ini !== -1, 'seção Magias de Itens presente');
  const secao = h.slice(ini, h.indexOf('</div>\n  </div>', ini) + 20);
  assert.ok(secao.includes('Teia'), 'nome da magia');
  assert.ok(secao.includes(utils.escHtml(manto.nome)), 'nome do item');
  assert.ok(/uso: Teia/.test(secao), 'custo');
  assert.ok(secao.includes('CD 13'), 'CD');
  assert.ok(!secao.includes('<button'), 'sem botões');
});

test('5.3 impressão: item sem sintonização ou guardado não entra em Magias de Itens', async () => {
  const semSintonia = { ...montar('manto-aracnideo'), equipado: true, sintonizado: false };
  const guardado = { ...montar('manto-aracnideo'), equipado: false, sintonizado: true };
  assert.ok(!(await imprimir([semSintonia])).includes('Magias de Itens'));
  assert.ok(!(await imprimir([guardado])).includes('Magias de Itens'));
});

// ---------- 5.4 Atq/Dano parcial ----------

test('5.4 impressão: bônus de arma com só uma parte não imprime a parte zero', async () => {
  const base = { ...montar('arma-mais-1-mais-2-ou-mais-3', 'arma-mais-1', 'Rapieira'), equipado: true };
  const soAtq = { ...base, nome: 'Rapieira Afiada', dados: { ...base.dados, efeitos: [{ alvo: 'ataque_arma', valor: 1 }] } };
  const soDano = { ...base, nome: 'Rapieira Brutal', dados: { ...base.dados, efeitos: [{ alvo: 'dano_arma', valor: 2 }] } };
  const h = await imprimir([soAtq, soDano]);
  const efAtq = span(h, 'print-equip-effect', soAtq.nome);
  const efDano = span(h, 'print-equip-effect', soDano.nome);
  assert.ok(efAtq.includes('+1 Atq') && !efAtq.includes('Dano') && !efAtq.includes('+0'), efAtq);
  assert.ok(efDano.includes('+2 Dano') && !efDano.includes('Atq') && !efDano.includes('+0'), efDano);
});

// ---------- 5.5 HTML do detalhe ----------

test('5.5 htmlDetalheItem: item mágico com descrição, tabelas e botão de contador manual', () => {
  const cint = montar('cinturao-de-forca-do-gigante', 'cinturao-de-forca-do-gigante-das-colinas');
  const h = inventario.htmlDetalheItem(cint, []);
  assert.ok(h.includes(utils.escHtml(cint.dados.linha_tipo)), 'linha de tipo');
  assert.ok(h.includes('<table'), 'tabela');
  assert.ok(h.includes('id="btn-adicionar-contador"'), 'sem recursos: oferece contador manual');
  assert.ok(!h.includes('id="btn-marcar-destruido"'), 'sem recursos: não oferece destruir');
});

test('5.5 htmlDetalheItem: bloco de aumento permanente, pendente e aplicado', () => {
  const manual = montar('manual-da-saude-corporal');
  let h = inventario.htmlDetalheItem(manual, []);
  assert.ok(h.includes('id="bloco-aumento-permanente"') && h.includes('id="btn-aplicar-aumento-permanente"'), 'pendente');
  assert.ok(h.includes('Constituição +2, até 30'), 'texto do aumento');
  h = inventario.htmlDetalheItem({ ...manual, aumento_aplicado: true }, []);
  assert.ok(h.includes('Aumento aplicado.') && !h.includes('btn-aplicar-aumento-permanente'), 'aplicado');
});

test('5.5 htmlDetalheItem: contador manual traz editar e remover; destruído não traz botões', () => {
  const comum = { nome: 'Corda', tipo: 'equipamento', quantidade: 1, dados: { custo: '1 PO', peso: '2,5 kg', recursos: { cargas: { max: 3 } }, recursos_manual: true } };
  const h = inventario.htmlDetalheItem(comum, []);
  assert.ok(h.includes('id="btn-editar-contador"') && h.includes('id="btn-remover-contador"'), 'editar e remover');
  assert.ok(h.includes('<strong>Custo:</strong> 1 PO'), 'custo do equipamento');
  const destruido = inventario.htmlDetalheItem({ ...comum, destruido: true }, []);
  assert.ok(!destruido.includes('btn-editar-contador') && !destruido.includes('btn-adicionar-contador'), 'destruído sem botões de contador');
});

test('5.5 htmlDetalheItem: escapa a descrição do item customizado e cai no aviso sem dados', () => {
  const vazio = inventario.htmlDetalheItem({ nome: 'Pedra', tipo: 'equipamento', dados: {} }, []);
  assert.ok(vazio.includes('Sem informações adicionais disponíveis.'));
  const custom = inventario.htmlDetalheItem({ nome: 'X', tipo: 'customizado', descricao: '<img src=x onerror=1>', dados: { tipo_item: '<b>Cat</b>' } }, []);
  assert.ok(!custom.includes('<img src=x') && !custom.includes('<b>Cat</b>'), 'sem HTML cru do usuário');
});

// ---------- 5.6 guarda de requisição do seletor ----------

test('5.6 aplicarSeVigente: resposta atrasada de busca antiga é ignorada (fora de ordem)', async () => {
  const guarda = ui.criarGuardaRequisicao();
  const aplicados = [];
  const adiada = () => { let resolver; const p = new Promise((r) => { resolver = r; }); return { p, resolver }; };
  const a = adiada();
  const b = adiada();
  ui.aplicarSeVigente(guarda, a.p, (v) => aplicados.push(v), () => aplicados.push('erro'));
  ui.aplicarSeVigente(guarda, b.p, (v) => aplicados.push(v), () => aplicados.push('erro'));
  b.resolver('segunda');
  await b.p;
  a.resolver('primeira');
  await a.p;
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(aplicados, ['segunda']);
});

test('5.6 aplicarSeVigente: erro de busca antiga também é ignorado; a vigente aplica', async () => {
  const guarda = ui.criarGuardaRequisicao();
  const aplicados = [];
  let rejeitar;
  const falha = new Promise((_, rej) => { rejeitar = rej; });
  ui.aplicarSeVigente(guarda, falha, () => aplicados.push('ok-antiga'), () => aplicados.push('erro-antigo'));
  ui.aplicarSeVigente(guarda, Promise.resolve('nova'), (v) => aplicados.push(v), () => aplicados.push('erro-nova'));
  rejeitar(new Error('x'));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(aplicados, ['nova']);
});

test('5.6 o seletor não limpa a lista de itens mágicos antes do novo resultado', () => {
  const src = readFileSync(resolve(RAIZ, 'site/js/itens-seletor.js'), 'utf-8');
  assert.ok(/if \(!listaEl\.querySelector\('#filtro-tipo-magico'\)\)\s*\{\s*listaEl\.innerHTML = '[^']*Carregando/.test(src),
    '"Carregando…" só quando a lista ainda não está na tela');
});

// ---------- 5.7 nome gravado com base ----------

test('5.7 nomeDoItemComBase: sufixo só quando o nome não contém a base como palavra', () => {
  assert.equal(C.nomeDoItemComBase('Arma +1', 'Rapieira', 'arma'), 'Arma +1 (Rapieira)');
  assert.equal(C.nomeDoItemComBase('Espada Longa +1', 'Espada Longa', 'arma'), 'Espada Longa +1');
  assert.equal(C.nomeDoItemComBase('Cota de Malha Élfica', 'Cota de Malha', 'armadura'), 'Cota de Malha Élfica');
  assert.equal(C.nomeDoItemComBase('Escudo +1', 'Escudo', 'escudo'), 'Escudo +1');
  assert.equal(C.nomeDoItemComBase('Escudo Animado', 'Escudo', 'escudo'), 'Escudo Animado');
  // Palavra parcial não conta: "Lança" dentro de "Lançador" não é a base.
  assert.equal(C.nomeDoItemComBase('Lançador Arcano', 'Lança', 'arma'), 'Lançador Arcano (Lança)');
  assert.equal(C.nomeDoItemComBase('Arma +1', '', 'arma'), 'Arma +1');
});

test('5.7 acervo: todos os itens com base mantêm o nome que o formato antigo gravava', () => {
  const antigo = (nome, base, tipo) => (tipo === 'escudo' || nome.includes(base.nome) ? nome : `${nome} (${base.nome})`);
  let n = 0;
  for (const item of ACERVO.filter((i) => i.base)) {
    const tipo = item.base.tipo === 'arma' ? 'arma' : (item.base.tipo === 'escudo' ? 'escudo' : 'armadura');
    for (const reg of [item, ...(item.variantes || [])]) {
      for (const base of C.opcoesDeBase(item.base, CATALOGOS)) {
        assert.equal(C.nomeDoItemComBase(reg.nome, base.nome, tipo), antigo(reg.nome, base, tipo), `${reg.nome} + ${base.nome}`);
        n++;
      }
    }
  }
  assert.ok(n > 100, `combinações conferidas: ${n}`);
});

test('5.7 montarItemInventario usa o helper: Arma +1 com Rapieira e Escudo +1', () => {
  assert.equal(montar('arma-mais-1-mais-2-ou-mais-3', 'arma-mais-1', 'Rapieira').nome, 'Arma +1 (Rapieira)');
  assert.equal(montar('escudo-mais-1-mais-2-ou-mais-3', 'escudo-mais-1', 'Escudo').nome, 'Escudo +1');
});

// ---------- 5.8 filtro de precache do deploy ----------

/**
 * Confere o filtro de precache de `dados/livro-do-mestre` no texto do
 * workflow: poda as pastas-fonte e só deixa passar o acervo lido pelo site.
 * Lança AssertionError quando o filtro não está como esperado.
 */
function conferirFiltroPrecache(yml, arquivoDoApp) {
  assert.ok(/dirs\[:\] = \[d for d in dirs if d not in \('_lotes', '_mecanica'\)\]/.test(yml), 'poda de _lotes e _mecanica');
  const m = /if '\/livro-do-mestre\/' in p and not p\.endswith\('([^']+)'\):\s*\n\s*continue/.exec(yml);
  assert.ok(m, 'filtro que descarta tudo de livro-do-mestre, exceto uma exceção');
  assert.equal(m[1], `/${arquivoDoApp}`, 'a única exceção é o arquivo que o app lê');
}

test('5.8 deploy.yml: o filtro do precache exclui os arquivos grandes do capítulo 7 e inclui itens_magicos.json', () => {
  const yml = readFileSync(resolve(RAIZ, '.github/workflows/deploy.yml'), 'utf-8');
  const db = readFileSync(resolve(RAIZ, 'site/js/db.js'), 'utf-8');
  const arquivoDoApp = /fetchJSON\('(livro-do-mestre\/[^']+)'\)/.exec(db)?.[1];
  assert.equal(arquivoDoApp, 'livro-do-mestre/capitulo7/itens_magicos.json', 'arquivo que o app lê');
  conferirFiltroPrecache(yml, arquivoDoApp);
  // Os demais JSON da pasta existem e não são a exceção.
  for (const grande of ['regras.json', 'tesouros.json', 'tabelas_itens_aleatorios.json']) {
    assert.ok(readFileSync(resolve(RAIZ, 'dados/livro-do-mestre/capitulo7', grande)).length > 1000, `${grande} existe`);
    assert.ok(!yml.includes(grande), `${grande} fora do precache (nenhuma exceção o cita)`);
  }
  // O app só lê um arquivo de livro-do-mestre: se passar a ler outro, o filtro precisa incluí-lo.
  const lidos = [...db.matchAll(/fetchJSON\(['`]livro-do-mestre\/[^'`]+['`]\)/g)];
  assert.equal(lidos.length, 1, 'db.js lê um único arquivo de livro-do-mestre');
});

test('5.8 o conferidor do filtro reprova workflow sem a poda ou com exceção errada', () => {
  const arq = 'livro-do-mestre/capitulo7/itens_magicos.json';
  const ok = "dirs[:] = [d for d in dirs if d not in ('_lotes', '_mecanica')]\n if '/livro-do-mestre/' in p and not p.endswith('/livro-do-mestre/capitulo7/itens_magicos.json'):\n     continue";
  conferirFiltroPrecache(ok, arq);
  assert.throws(() => conferirFiltroPrecache('os.walk(x)', arq), 'sem filtro');
  assert.throws(() => conferirFiltroPrecache(ok.replace('itens_magicos.json', 'regras.json'), arq), 'exceção errada');
  assert.throws(() => conferirFiltroPrecache(ok.replace("'_mecanica'", "'x'"), arq), 'sem a poda de _mecanica');
});

// ---------- Fix round 1 ----------

test('5.7 escudo cujo nome não contém a base não ganha sufixo (exceção de escudo)', () => {
  assert.equal(C.nomeDoItemComBase('Égide Antiga', 'Escudo', 'escudo'), 'Égide Antiga');
  const item = { id: 'egide-antiga', nome: 'Égide Antiga', tipo: 'Armadura', raridade: 'Rara', base: { tipo: 'escudo' } };
  const base = { nome: 'Escudo', ca: '+2', categoria: 'Escudo' };
  const montado = C.montarItemInventario({ item, base, equipamentoPHB: PHB });
  assert.equal(montado.nome, 'Égide Antiga');
  // Mesmo nome em armadura (não escudo) recebe o sufixo.
  assert.equal(C.nomeDoItemComBase('Égide Antiga', 'Escudo', 'armadura'), 'Égide Antiga (Escudo)');
});

test('5.3 impressão: nome da magia de item é escapado (sem injetar HTML)', async () => {
  const hostil = '<img src=x onerror=alert(1)> "aspas"';
  const base = montar('manto-aracnideo');
  const manto = {
    ...base, equipado: true, sintonizado: true,
    dados: { ...base.dados, magias: [{ nome: hostil, custo: 'livre', conjuracao: null, circulo_base: 1 }] },
  };
  const h = await imprimir([manto]);
  const ini = h.indexOf('Magias de Itens</div>');
  assert.ok(ini !== -1, 'seção presente');
  const secao = h.slice(ini, ini + 600);
  assert.ok(!secao.includes('<img src=x'), 'sem tag injetada');
  assert.ok(secao.includes('&lt;img src=x onerror=alert(1)&gt;'), 'texto escapado');
});
