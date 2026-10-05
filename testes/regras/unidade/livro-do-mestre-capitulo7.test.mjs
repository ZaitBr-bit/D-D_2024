// ============================================================
// Livro do Mestre, capítulo 7 (Tesouros): portão dos dados traduzidos.
//
// 1. Mutações sobre um lote mínimo: cada regra do verificador tem de
//    avermelhar o defeito que ela existe para pegar (o controle passa).
// 2. Os lotes reais passam no portão completo.
// 3. Os arquivos finais em dados/livro-do-mestre/capitulo7/ estão em dia
//    com os lotes (montar(lotes) === disco).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  carregarLotes, carregarContexto, verificar, verificarTabelas, montar, slug, DIR_CAP7,
} from '../../../scripts/livro-do-mestre/capitulo7.mjs';

/** Contexto falso: uma página (240) com uma linha de tipo, 2d6 e DC 15. */
function ctxFalso() {
  return {
    phb: [{ arquivo: 'equipamento_aventura', nome: 'Poção de Cura' }],
    magias: ['Bola de Fogo'],
    oraculo: { paginas: { 240: { linhas_tipo: ['Wondrous Item, Rare'], dados: ['2d6'], cds: [15] } } },
    excecoes: { tipo: {}, dados: {}, cd: {} },
    italicos: {},
  };
}

/** Lote mínimo válido com um item na pág. 240; `mudar` altera o item. */
function loteCom(mudar = (i) => i) {
  const item = {
    nome: 'Manto de Teste', nome_en: 'Cloak of Testing', pagina_pdf: 240, pagina_pdf_fim: 240,
    tipo: 'Item Maravilhoso', subtipo: '', raridade: 'Rara', requer_sintonizacao: false,
    requisito_sintonizacao: '', linha_tipo: 'Item Maravilhoso, Raro', amaldicoado: false,
    descricao: 'Você conjura *Bola de Fogo*. Cada criatura a até 9 metros faz uma salvaguarda de Destreza CD 15 e sofre 2d6 de dano Ígneo.',
    tabelas: [], variantes: [],
  };
  return [{ lote: '99', tipo: 'itens', paginas_pdf: [240, 240], itens: [mudar(item)] }];
}

/** Erros do verificador sobre o lote mínimo, sem as checagens globais. */
function erros(mudar) {
  return verificar(loteCom(mudar), ctxFalso(), { completo: false, italicoEstrito: true }).erros;
}

test('controle: o lote mínimo passa', () => {
  assert.deepEqual(erros(), []);
});

const MUTACOES = [
  ['b unidade imperial', (i) => ({ ...i, descricao: `${i.descricao} Alcance de 30 pés.` }), /unidade imperial/],
  ['c inglês residual', (i) => ({ ...i, descricao: `${i.descricao} the` }), /inglês/],
  ['d magia com nome errado', (i) => ({ ...i, descricao: i.descricao.replace('Bola de Fogo', 'Bola de Fogos') }), /itálico/],
  ['e dado perdido', (i) => ({ ...i, descricao: i.descricao.replace('2d6', '2d8') }), /2d6/],
  ['f CD trocada', (i) => ({ ...i, descricao: i.descricao.replace('CD 15', 'CD 14') }), /DC 15/],
  ['i Varia sem variantes', (i) => ({ ...i, raridade: 'Varia' }), /Varia/],
  ['j marcação não renderizada', (i) => ({ ...i, descricao: `${i.descricao}\n> nota` }), /marcação/],
  ['raridade fora da lista', (i) => ({ ...i, raridade: 'Raro' }), /raridade/],
  ['tipo fora da lista', (i) => ({ ...i, tipo: 'Wondrous Item' }), /tipo/],
];
for (const [nome, mudar, re] of MUTACOES) {
  test(`mutação ${nome} avermelha`, () => {
    assert.ok(erros(mudar).some((e) => re.test(e)), `nenhum erro casou ${re}: ${JSON.stringify(erros(mudar))}`);
  });
}

test('mutação g: item a mais na página avermelha o oráculo de linhas de tipo', () => {
  const lotes = loteCom();
  lotes[0].itens.push({ ...lotes[0].itens[0], nome: 'Outro', nome_en: 'Other' });
  const r = verificar(lotes, ctxFalso(), { completo: false });
  assert.ok(r.erros.some((e) => /linha\(s\) de tipo/.test(e)), JSON.stringify(r.erros));
});

test('mutação k: nome_en repetido avermelha', () => {
  const lotes = loteCom();
  lotes[0].itens.push({ ...lotes[0].itens[0], nome: 'Outro' });
  const r = verificar(lotes, ctxFalso(), { completo: false });
  assert.ok(r.erros.some((e) => /nome_en repetido/.test(e)), JSON.stringify(r.erros));
});

test('mutação h: item com nome do Livro do Jogador sem livro_jogador avermelha', () => {
  const lotes = loteCom((i) => ({ ...i, nome: 'Poção de Cura' }));
  const r = verificar(lotes, ctxFalso(), { completo: true });
  assert.ok(r.erros.some((e) => /já existe no Livro do Jogador/.test(e)), JSON.stringify(r.erros));
});

test('mutação l: tabela aleatória com buraco e raridade errada avermelha', () => {
  const itens = [{ nome: 'Manto de Teste', raridade: 'Rara', variantes: [] }];
  const tab = { tema: 'Arcano', raridade: 'Incomum', entradas: [{ min: 1, max: 50, item: 'Manto de Teste' }, { min: 52, max: 100, item: 'Manto de Teste' }] };
  const e = verificarTabelas([tab], [], itens);
  assert.ok(e.some((x) => /não cobre a partir de 51/.test(x)), JSON.stringify(e));
  assert.ok(e.some((x) => /raridade Rara/.test(x)), JSON.stringify(e));
  assert.ok(e.some((x) => /esperado 20/.test(x)), JSON.stringify(e));
});

test('slug é estável e sem acento', () => {
  assert.equal(slug('Poção de Cura (suprema)'), 'pocao-de-cura-suprema');
  assert.equal(slug('Arma +1'), 'arma-mais-1');
});

test('montar prefere pagina/pagina_fim explícitas à fórmula PDF - 4', () => {
  const lote = {
    lote: '99', tipo: 'regras', paginas_pdf: [223, 223],
    secoes: [
      { titulo: 'Obras de Arte', titulo_en: 'Art Objects', nivel: 1, pagina_pdf: 223, pagina_pdf_fim: 223, pagina: 215, pagina_fim: 215, texto: 'Texto.', tabelas: [] },
      { titulo: 'Sem Campo', titulo_en: 'No Field', nivel: 1, pagina_pdf: 217, pagina_pdf_fim: 217, texto: 'Texto.', tabelas: [] },
    ],
    tesouros: [],
  };
  const { secoes } = montar([lote]).regras;
  assert.equal(secoes[0].pagina, 215);
  assert.equal(secoes[0].pagina_fim, 215);
  assert.equal(secoes[1].pagina, 213);
  assert.equal(secoes[1].pagina_fim, 213);
  assert.equal('pagina_pdf' in secoes[0], false);
});

const lotes = carregarLotes();

test('o conjunto de lotes reais é exatamente lote-00..lote-13', () => {
  const esperado = Array.from({ length: 14 }, (_, n) => String(n).padStart(2, '0'));
  assert.deepEqual(lotes.map((l) => l.lote).sort(), esperado);
  assert.deepEqual(lotes.map((l) => l._arquivo).sort(), esperado.map((n) => `lote-${n}.json`));
});

test('os 14 lotes reais passam no portão completo', () => {
  const r = verificar(lotes, carregarContexto());
  assert.deepEqual(r.erros, []);
});

test('mutação: "the" e unidade imperial em texto de entrada de tabela aleatória e em motivo avermelham', () => {
  const l = loteCom();
  l[0].tabelas_aleatorias = [{ tema: 'Arcano', raridade: 'Rara', entradas: [{ min: 1, max: 100, item: 'Manto de Teste', texto: 'Alcance de 30 pés the' }] }];
  l[0].itens_fora_das_tabelas = [{ item: 'Outro', motivo: 'the' }];
  const r = verificar(l, ctxFalso(), { completo: false });
  assert.ok(r.erros.some((e) => /tabela aleatória Arcano\/Rara.*(inglês|imperial)/.test(e)), JSON.stringify(r.erros));
  assert.ok(r.erros.some((e) => /item fora das tabelas "Outro".*inglês/.test(e)), JSON.stringify(r.erros));
});

test('arquivos finais em dia com os lotes', async () => {
  const { carregarMecanica, indiceMecanica, carregarCatalogos } = await import('../../../scripts/livro-do-mestre/mecanica.mjs');
  const montado = montar(lotes, indiceMecanica(carregarMecanica()).porId, carregarCatalogos().magias);
  for (const [nome, conteudo] of Object.entries(montado)) {
    const disco = JSON.parse(fs.readFileSync(path.join(DIR_CAP7, `${nome}.json`), 'utf-8'));
    assert.deepEqual(disco, conteudo, `${nome}.json desatualizado: rode capitulo7.mjs montar`);
  }
});

test('controle: parágrafo português legítimo não gera falso positivo de inglês/unidade', () => {
  const texto = 'Você pode usar uma Ação Bônus para ativar o item e, depois de um Descanso Curto, recuperar o efeito. '
    + 'Ao fazer uma jogada de ataque, a Sintonização de você e dos pés do portador não muda; o item é leve.';
  assert.deepEqual(erros((i) => ({ ...i, descricao: `${i.descricao} ${texto}` })), []);
});

test('mutação: duas variantes com o mesmo nome em itens diferentes avermelha', () => {
  const lotes = loteCom((i) => ({ ...i, raridade: 'Varia', variantes: [{ nome: 'Grau X', nome_en: 'Grade X', raridade: 'Rara' }] }));
  lotes[0].itens.push({ ...lotes[0].itens[0], nome: 'Outro', nome_en: 'Other' });
  const r = verificar(lotes, ctxFalso(), { completo: false });
  assert.ok(r.erros.some((e) => /nome repetido: "Grau X"/.test(e)), JSON.stringify(r.erros));
});

test('mutação: variante com o mesmo nome do próprio item pai avermelha (id e nome repetidos)', () => {
  const lotes = loteCom((i) => ({ ...i, raridade: 'Varia', variantes: [{ nome: i.nome, nome_en: i.nome_en, raridade: 'Rara' }] }));
  const r = verificar(lotes, ctxFalso(), { completo: false });
  assert.ok(r.erros.some((e) => /^nome repetido/.test(e)), JSON.stringify(r.erros));
  assert.ok(r.erros.some((e) => /^id repetido/.test(e)), JSON.stringify(r.erros));
});

test('controle: palavras portuguesas acentuadas não casam como inglês', () => {
  const texto = 'Os heróis dos países vizinhos, você é um dos três que, após o descanso, usam o item.';
  assert.deepEqual(erros((i) => ({ ...i, descricao: `${i.descricao} ${texto}` })), []);
});

test('mutação: "the" e "Bonus Action" soltos continuam avermelhando', () => {
  assert.ok(erros((i) => ({ ...i, descricao: `${i.descricao} the` })).some((e) => /inglês/.test(e)));
  assert.ok(erros((i) => ({ ...i, descricao: `${i.descricao} Use uma Bonus Action.` })).some((e) => /inglês "Action"/.test(e)));
});
