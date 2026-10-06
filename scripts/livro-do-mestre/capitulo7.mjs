// ============================================================
// Livro do Mestre (2024), capítulo 7 (Tesouros): montagem e verificação.
//
// Os lotes em dados/livro-do-mestre/capitulo7/_lotes/ são a fonte editável
// (transcrição visual das páginas + tradução). Este módulo junta os lotes
// nos arquivos finais e confere tudo contra três oráculos independentes da
// tradução: a camada OCR do PDF (linhas de tipo, dados, CDs por página), o
// catálogo do Livro do Jogador (duplicatas) e as tabelas aleatórias do
// próprio capítulo (completude).
//
//   node scripts/livro-do-mestre/capitulo7.mjs verificar [--lote NN]
//   node scripts/livro-do-mestre/capitulo7.mjs montar
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIR_CAP7 = path.join(RAIZ, 'dados', 'livro-do-mestre', 'capitulo7');
export const DIR_LOTES = path.join(DIR_CAP7, '_lotes');
const DIR_SCRIPTS = path.join(RAIZ, 'scripts', 'livro-do-mestre');
const FONTE = 'Livro do Mestre (2024), capítulo 7: Tesouros';

// Página do PDF menos 4 = página impressa (PDF 240 = pág. 236).
export const OFFSET_PAGINA = 4;
// Páginas do PDF com cabeçalho de item da seção "Itens Mágicos de A a Z".
export const FAIXA_AZ = [231, 329];
export const FAIXA_CAPITULO = [217, 335];
// Ficha "Magic Item Tracker": formulário, sem texto de regra.
const PAGINAS_SEM_TEXTO = [225];
export const TIPOS = ['Anel', 'Arma', 'Armadura', 'Bastão', 'Cajado', 'Item Maravilhoso', 'Pergaminho', 'Poção', 'Varinha'];
// As seis raridades do formulário de item do site (site/js/sheet/item-customizado-form.js).
export const RARIDADES = ['Comum', 'Incomum', 'Rara', 'Muito Rara', 'Lendária', 'Artefato'];
export const TEMAS = ['Arcano', 'Armamentos', 'Implementos', 'Relíquias'];
// Itens do Livro do Jogador que o capítulo 7 repete, por nome_en da variante.
export const EQUIVALENTES_PHB = [
  { nome_en: 'Potion of Healing', arquivo: 'equipamento_aventura', nome: 'Poção de Cura' },
  { nome_en: 'Spell Scroll (Cantrip)', arquivo: 'equipamento_aventura', nome: 'Pergaminho Mágico (Truque)' },
  { nome_en: 'Spell Scroll (Level 1)', arquivo: 'equipamento_aventura', nome: 'Pergaminho Mágico (1º Círculo)' },
];
// Itens mágicos que o texto do Livro do Jogador já cita pelo nome (Equipamento.md, "Itens Mágicos").
export const NOMES_CITADOS_PHB = ['Anel de Proteção', 'Anel de Queda Suave', 'Anel de Natação'];

// Tipo de item da ficha (TIPOS_ITEM do formulário do site) por tipo do livro.
const TIPO_ITEM_FICHA = { 'Poção': 'Consumível', 'Pergaminho': 'Consumível', 'Armadura': 'Armadura' };

// Palavra inteira delimitada por letra/dígito Unicode: o \b do JS trata letra acentuada como não-palavra ("heróis" casaria "is").
const RE_INGLES = /(?<![\p{L}\p{N}])(feet|foot|pounds?|miles?|the|you|your|with|which|while|DC|GP|SP|CP|EP|saving throw|Hit Points?|Advantage|Disadvantage|of|and|to|is|Action|Rest|Attunement|attack)(?![\p{L}\p{N}])/iu;
const RE_UNIDADE = /\d\s*(pés|pé|ft\.?|libras?|lb\.?|milhas?|polegadas?|galões?|°F)(?![\p{L}])/iu;
// Formas que mdParaHtml (site/js/utils.js) NÃO converte e apareceriam literais na tela.
const RE_MD_PROIBIDO = [/^\s*>/m, /^\s*-{3,}\s*$/m, /(^|\s)_[^_\s][^_\n]*_(?=\s|[.,;:]|$)/m, /^\s*\|/m, /<[a-z/][^>]*>/i];

/** Lê um JSON do disco. */
function lerJson(arq) {
  return JSON.parse(fs.readFileSync(arq, 'utf-8'));
}

/** Forma de comparação de nomes: minúsculas, sem acento, espaços simples. */
export function normalizar(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Identificador estável derivado do nome em português ("Arma +1" -> "arma-mais-1"). */
export function slug(s) {
  return normalizar(s).replace(/\+/g, ' mais ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Termos em itálico simples (*X*) de um texto, ignorando ***run-in*** e **negrito**. */
export function italicos(texto) {
  const limpo = String(texto ?? '').replace(/\*\*\*[^*]+\*\*\*/g, ' ').replace(/\*\*[^*]+\*\*/g, ' ');
  return [...limpo.matchAll(/\*([^*\n]+)\*/g)].map((m) => m[1].trim().replace(/[.,;:]+$/, ''));
}

/** Todo objeto com `nome` dos arquivos de equipamento do Livro do Jogador. */
export function carregarCatalogoPHB() {
  const out = [];
  const dir = path.join(RAIZ, 'dados', 'equipamento');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const arquivo = f.replace(/\.json$/, '');
    const visitar = (o) => {
      if (Array.isArray(o)) o.forEach(visitar);
      else if (o && typeof o === 'object') {
        if (typeof o.nome === 'string') out.push({ arquivo, nome: o.nome });
        Object.values(o).forEach(visitar);
      }
    };
    visitar(lerJson(path.join(dir, f)));
  }
  return out;
}

/** Contexto dos oráculos: catálogo do Livro do Jogador, magias, OCR, exceções e itálicos permitidos. */
export function carregarContexto() {
  const ler = (nome, padrao) => {
    const arq = path.join(DIR_SCRIPTS, nome);
    return fs.existsSync(arq) ? lerJson(arq) : padrao;
  };
  return {
    phb: carregarCatalogoPHB(),
    magias: lerJson(path.join(RAIZ, 'dados', 'magias', '_indice.json')).magias.map((m) => m.nome),
    oraculo: ler('oraculo_ocr_capitulo7.json', { paginas: {} }),
    excecoes: ler('excecoes_oraculo.json', { tipo: {}, dados: {}, cd: {} }),
    italicos: ler('termos_italicos.json', {}),
  };
}

/** Lotes lote-NN.json em ordem, cada um com `_arquivo`. */
export function carregarLotes(dir = DIR_LOTES) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^lote-\d{2}\.json$/.test(f)).sort()
    .map((f) => ({ ...lerJson(path.join(dir, f)), _arquivo: f }));
}

/** Texto traduzido de um item: linha de tipo, descrição, tabelas e variantes. */
function textoDoItem(i) {
  const t = [i.linha_tipo, i.descricao, i.subtipo, i.requisito_sintonizacao];
  for (const tab of i.tabelas || []) t.push(tab.titulo, ...(tab.cabecalhos || []), ...(tab.dados || []).flat());
  for (const v of i.variantes || []) t.push(v.nome);
  return t.filter((x) => typeof x === 'string').join('\n');
}

/** Texto traduzido de uma seção de regras: título, texto e tabelas. */
function textoDaSecao(s) {
  const t = [s.titulo, s.texto];
  for (const tab of s.tabelas || []) t.push(tab.titulo, ...(tab.cabecalhos || []), ...(tab.dados || []).flat());
  return t.filter((x) => typeof x === 'string').join('\n');
}

/** Texto traduzido de um tesouro comum (gema, obra de arte, barra). */
function textoDoTesouro(t) {
  return [t.nome, t.categoria, t.valor, t.descricao].filter((x) => typeof x === 'string').join('\n');
}

/** Texto traduzido de uma tabela aleatória: o campo texto de cada entrada. */
function textoDaTabelaAleatoria(t) {
  return (t.entradas || []).map((x) => x.texto).filter((x) => typeof x === 'string').join('\n');
}

/** Erros de texto: inglês residual, unidade imperial e marcação que o site não renderiza. */
export function verificarTexto(t, onde) {
  const e = [];
  const ing = t.match(RE_INGLES);
  if (ing) e.push(`${onde}: resíduo em inglês "${ing[0]}"`);
  const uni = t.match(RE_UNIDADE);
  if (uni) e.push(`${onde}: unidade imperial "${uni[0]}"`);
  for (const re of RE_MD_PROIBIDO) {
    const m = t.match(re);
    if (m) e.push(`${onde}: marcação que o site não renderiza "${m[0].trim()}"`);
  }
  return e;
}

/** Erros de estrutura de uma tabela {titulo, cabecalhos, dados}. */
function verificarTabela(tab, onde) {
  if (!Array.isArray(tab?.cabecalhos) || !Array.isArray(tab?.dados)) return [`${onde}: tabela sem cabecalhos/dados`];
  return tab.dados.flatMap((linha, k) => (Array.isArray(linha) && linha.length === tab.cabecalhos.length
    ? [] : [`${onde}: linha ${k + 1} da tabela "${tab.titulo}" não tem ${tab.cabecalhos.length} colunas`]));
}

/** Erros de esquema e de texto de um item do acervo. */
export function verificarItem(i, onde) {
  const e = [];
  for (const c of ['nome', 'nome_en', 'tipo', 'raridade', 'linha_tipo', 'descricao']) {
    if (typeof i[c] !== 'string' || !i[c].trim()) e.push(`${onde}: campo "${c}" vazio`);
  }
  if (!TIPOS.includes(i.tipo)) e.push(`${onde}: tipo "${i.tipo}" fora de ${TIPOS.join('/')}`);
  if (![...RARIDADES, 'Varia'].includes(i.raridade)) e.push(`${onde}: raridade "${i.raridade}" inválida`);
  for (const c of ['requer_sintonizacao', 'amaldicoado']) {
    if (typeof i[c] !== 'boolean') e.push(`${onde}: "${c}" tem de ser true/false`);
  }
  if (!Number.isInteger(i.pagina_pdf) || !Number.isInteger(i.pagina_pdf_fim) || i.pagina_pdf_fim < i.pagina_pdf) {
    e.push(`${onde}: pagina_pdf/pagina_pdf_fim inválidas`);
  }
  if (i.raridade === 'Varia' && !(i.variantes || []).length) e.push(`${onde}: raridade "Varia" sem variantes`);
  for (const v of i.variantes || []) {
    if (!v?.nome || !v?.nome_en) e.push(`${onde}: variante sem nome/nome_en`);
    if (!RARIDADES.includes(v?.raridade)) e.push(`${onde}: variante "${v?.nome}" com raridade "${v?.raridade}"`);
  }
  for (const tab of i.tabelas || []) e.push(...verificarTabela(tab, onde));
  e.push(...verificarTexto(textoDoItem(i), onde));
  return e;
}

/** Registros com faixa de páginas e texto, para os oráculos por página. */
function registros(lotes) {
  const r = [];
  for (const l of lotes) {
    for (const i of l.itens || []) r.push({ pagina_pdf: i.pagina_pdf, pagina_pdf_fim: i.pagina_pdf_fim, texto: textoDoItem(i), item: true });
    for (const s of l.secoes || []) r.push({ pagina_pdf: s.pagina_pdf, pagina_pdf_fim: s.pagina_pdf_fim, texto: textoDaSecao(s), item: false });
    for (const t of l.tesouros || []) r.push({ pagina_pdf: t.pagina_pdf, pagina_pdf_fim: t.pagina_pdf_fim, texto: textoDoTesouro(t), item: false });
    if (l.tipo === 'tabelas') {
      const texto = (l.tabelas_aleatorias || []).flatMap((t) => [t.dado, ...(t.entradas || []).map((x) => x.texto)]).join('\n');
      r.push({ pagina_pdf: l.paginas_pdf[0], pagina_pdf_fim: l.paginas_pdf[1], texto, item: false });
    }
  }
  return r;
}

/** Confere, página a página, linhas de tipo, dados e CDs do OCR contra o texto traduzido. */
function verificarOraculo(regs, ctx, paginas, paginasBranda) {
  const erros = [];
  const avisos = [];
  for (const p of paginas) {
    const o = ctx.oraculo.paginas?.[String(p)];
    if (!o) { erros.push(`pág. PDF ${p}: sem entrada no oráculo OCR`); continue; }
    const texto = regs.filter((r) => r.pagina_pdf <= p && p <= r.pagina_pdf_fim).map((r) => r.texto).join('\n');
    const destino = paginasBranda.has(p) ? avisos : erros;
    const dadosPT = new Set([...texto.matchAll(/\b(\d+)d(\d+)\b/g)].map((m) => `${m[1]}d${m[2]}`));
    for (const d of o.dados) {
      if (!dadosPT.has(d) && !ctx.excecoes.dados?.[`${p}:${d}`]) destino.push(`pág. PDF ${p}: o OCR tem ${d} e nenhum texto traduzido da página tem`);
    }
    const cdsPT = new Set([...texto.matchAll(/\bCD (\d+)\b/g)].map((m) => Number(m[1])));
    for (const c of o.cds) {
      if (!cdsPT.has(c) && !ctx.excecoes.cd?.[`${p}:${c}`]) destino.push(`pág. PDF ${p}: o OCR tem DC ${c} e nenhum texto traduzido da página tem CD ${c}`);
    }
    if (FAIXA_AZ[0] <= p && p <= FAIXA_AZ[1]) {
      const n = regs.filter((r) => r.item && r.pagina_pdf === p).length;
      const ocr = o.linhas_tipo.length;
      const exc = ctx.excecoes.tipo?.[String(p)];
      if (n !== ocr && !(exc && exc.acervo === n && exc.ocr === ocr)) {
        erros.push(`pág. PDF ${p}: ${n} item(ns) começam nela no acervo, o OCR achou ${ocr} linha(s) de tipo`);
      }
    }
  }
  return { erros, avisos };
}

/** Erros das tabelas aleatórias: 20 tabelas, d100 sem buraco, ligação e raridade, cobertura do acervo. */
export function verificarTabelas(tabelas, fora, itens) {
  const e = [];
  const porNome = new Map(itens.map((i) => [normalizar(i.nome), i]));
  if (tabelas.length !== 20) e.push(`tabelas aleatórias: ${tabelas.length}, esperado 20 (4 temas x 5 raridades)`);
  const pares = new Set();
  const usados = new Set();
  for (const t of tabelas) {
    const onde = `tabela ${t.tema}/${t.raridade}`;
    if (!TEMAS.includes(t.tema)) e.push(`${onde}: tema fora de ${TEMAS.join('/')}`);
    if (!RARIDADES.slice(0, 5).includes(t.raridade)) e.push(`${onde}: raridade inválida`);
    if (pares.has(`${t.tema}|${t.raridade}`)) e.push(`${onde}: repetida`);
    pares.add(`${t.tema}|${t.raridade}`);
    const ent = [...(t.entradas || [])].sort((a, b) => a.min - b.min);
    let esperado = 1;
    for (const x of ent) {
      if (x.min !== esperado || x.max < x.min) e.push(`${onde}: faixa ${x.min}-${x.max} não cobre a partir de ${esperado}`);
      esperado = x.max + 1;
      const item = porNome.get(normalizar(x.item));
      if (!item) { e.push(`${onde}: "${x.item}" não existe no acervo`); continue; }
      usados.add(normalizar(item.nome));
      const vars = (x.variantes || []).map((nv) => (item.variantes || []).find((v) => normalizar(v.nome) === normalizar(nv)));
      if (vars.some((v) => !v)) e.push(`${onde}: "${x.item}" sem a variante ${JSON.stringify(x.variantes)}`);
      const raridades = vars.length ? vars.filter(Boolean).map((v) => v.raridade) : [item.raridade];
      if (raridades.some((r) => r !== t.raridade)) e.push(`${onde}: "${x.item}" ${JSON.stringify(x.variantes || [])} tem raridade ${raridades.join('/')}`);
    }
    if (esperado !== 101) e.push(`${onde}: termina em ${esperado - 1}, não em 100`);
  }
  const nomesFora = new Set((fora || []).map((f) => normalizar(f.item)));
  for (const i of itens) {
    const n = normalizar(i.nome);
    if (!usados.has(n) && !nomesFora.has(n)) e.push(`"${i.nome}" não aparece em nenhuma tabela aleatória nem em itens_fora_das_tabelas`);
    if (usados.has(n) && nomesFora.has(n)) e.push(`"${i.nome}" está numa tabela e também em itens_fora_das_tabelas`);
  }
  for (const f of fora || []) if (!f.motivo) e.push(`itens_fora_das_tabelas: "${f.item}" sem motivo`);
  return e;
}

/** Erros de duplicata com o Livro do Jogador: nome igual exige livro_jogador; equivalências fixas. */
function verificarPHB(itens, tesouros, phb) {
  const e = [];
  const phbPorNome = new Map(phb.map((r) => [normalizar(r.nome), r]));
  const conferir = (reg, onde) => {
    const igual = phbPorNome.get(normalizar(reg.nome));
    if (igual && !reg.livro_jogador) e.push(`${onde}: "${reg.nome}" já existe no Livro do Jogador (${igual.arquivo}) e não traz livro_jogador`);
    if (reg.livro_jogador) {
      const alvo = phb.find((r) => r.arquivo === reg.livro_jogador.arquivo && r.nome === reg.livro_jogador.nome);
      if (!alvo) e.push(`${onde}: livro_jogador ${JSON.stringify(reg.livro_jogador)} não existe no Livro do Jogador`);
      else if (alvo.nome !== reg.nome) e.push(`${onde}: "${reg.nome}" aponta para "${alvo.nome}" do Livro do Jogador com outro nome`);
    }
  };
  for (const i of itens) {
    conferir(i, `item "${i.nome}"`);
    for (const v of i.variantes || []) conferir(v, `variante "${v.nome}"`);
  }
  for (const t of tesouros) conferir(t, `tesouro "${t.nome}"`);
  const todos = itens.flatMap((i) => [i, ...(i.variantes || [])]);
  for (const eq of EQUIVALENTES_PHB) {
    const r = todos.find((x) => x.nome_en === eq.nome_en);
    if (!r) e.push(`equivalência com o Livro do Jogador: nenhum registro com nome_en "${eq.nome_en}"`);
    else if (r.nome !== eq.nome || r.livro_jogador?.arquivo !== eq.arquivo) e.push(`equivalência: "${eq.nome_en}" tem de se chamar "${eq.nome}" e apontar para ${eq.arquivo}`);
  }
  for (const nome of NOMES_CITADOS_PHB) {
    if (!itens.some((i) => i.nome === nome)) e.push(`o Livro do Jogador cita "${nome}" e o acervo não tem item com esse nome`);
  }
  return e;
}

/**
 * Confere os lotes. completo=false pula as checagens que só fazem sentido com
 * todos os lotes (cobertura, tabelas, Livro do Jogador); italicoEstrito=false
 * rebaixa itálico não resolvido a aviso (item de outro lote ainda não traduzido);
 * soLote limita o oráculo às páginas desse lote e rebaixa dados/CD da primeira
 * página (dividida com o lote anterior).
 */
export function verificar(lotes, ctx, { completo = true, italicoEstrito = true, soLote = null } = {}) {
  const erros = [];
  const avisos = [];
  const alvo = soLote ? lotes.filter((l) => l.lote === soLote) : lotes;
  if (soLote && !alvo.length) return { erros: [`lote ${soLote} não encontrado`], avisos };
  const itens = lotes.flatMap((l) => l.itens || []);

  for (const l of alvo) {
    const [ini, fim] = l.paginas_pdf || [];
    for (const i of l.itens || []) {
      const onde = `${l._arquivo || l.lote} item "${i.nome}"`;
      erros.push(...verificarItem(i, onde));
      if (!(ini <= i.pagina_pdf && i.pagina_pdf <= fim)) erros.push(`${onde}: cabeçalho na pág. ${i.pagina_pdf}, fora da faixa ${ini}-${fim} do lote`);
    }
    for (const s of l.secoes || []) {
      const onde = `${l._arquivo || l.lote} seção "${s.titulo}"`;
      if (!s.titulo || !s.titulo_en || typeof s.texto !== 'string') erros.push(`${onde}: titulo/titulo_en/texto ausente`);
      for (const tab of s.tabelas || []) erros.push(...verificarTabela(tab, onde));
      erros.push(...verificarTexto(textoDaSecao(s), onde));
    }
    for (const t of l.tesouros || []) {
      const onde = `${l._arquivo || l.lote} tesouro "${t.nome}"`;
      if (!t.nome || !t.nome_en || !t.categoria || !t.valor) erros.push(`${onde}: nome/nome_en/categoria/valor ausente`);
      erros.push(...verificarTexto(textoDoTesouro(t), onde));
    }
    for (const t of l.tabelas_aleatorias || []) {
      erros.push(...verificarTexto(textoDaTabelaAleatoria(t), `${l._arquivo || l.lote} tabela aleatória ${t.tema}/${t.raridade}`));
    }
    for (const f of l.itens_fora_das_tabelas || []) {
      erros.push(...verificarTexto(typeof f.motivo === 'string' ? f.motivo : '', `${l._arquivo || l.lote} item fora das tabelas "${f.item}"`));
    }
  }

  // Unicidade de nome, nome_en e id entre itens e variantes, sem exceção para variante e item pai.
  const registrosUnicos = itens.flatMap((i) => [
    { reg: i, pai: null, rotulo: `pág. ${i.pagina_pdf}` },
    ...(i.variantes || []).map((v) => ({ reg: v, pai: i, rotulo: `variante de "${i.nome}"` })),
  ]);
  for (const [campo, f] of [['nome', (r) => normalizar(r.nome)], ['nome_en', (r) => normalizar(r.nome_en)], ['id', (r) => slug(r.nome)]]) {
    const vistos = new Map();
    for (const e of registrosUnicos) {
      const k = f(e.reg);
      const antes = vistos.get(k);
      if (!antes) { vistos.set(k, e); continue; }
      erros.push(`${campo} repetido: "${e.reg.nome}" (${antes.rotulo} e ${e.rotulo})`);
    }
  }

  // Itálicos: magia do Livro do Jogador, item/variante do acervo, item do Livro do Jogador ou termo declarado.
  const conhecidos = new Set([
    ...ctx.magias, ...ctx.phb.map((r) => r.nome), ...Object.keys(ctx.italicos || {}),
    ...itens.flatMap((i) => [i.nome, ...(i.variantes || []).map((v) => v.nome)]),
  ].map(normalizar));
  for (const l of alvo) {
    const textos = [
      ...(l.itens || []).map((i) => [`item "${i.nome}"`, textoDoItem(i)]),
      ...(l.secoes || []).map((s) => [`seção "${s.titulo}"`, textoDaSecao(s)]),
      ...(l.tesouros || []).map((t) => [`tesouro "${t.nome}"`, textoDoTesouro(t)]),
      ...(l.tabelas_aleatorias || []).map((t) => [`tabela aleatória ${t.tema}/${t.raridade}`, textoDaTabelaAleatoria(t)]),
      ...(l.itens_fora_das_tabelas || []).map((f) => [`item fora das tabelas "${f.item}"`, typeof f.motivo === 'string' ? f.motivo : '']),
    ];
    for (const [onde, t] of textos) {
      for (const termo of italicos(t)) {
        if (!conhecidos.has(normalizar(termo))) {
          (italicoEstrito ? erros : avisos).push(`${l._arquivo || l.lote} ${onde}: itálico "*${termo}*" não é magia nem item conhecido`);
        }
      }
    }
  }

  // Oráculo OCR por página.
  let paginas;
  const branda = new Set();
  if (soLote) {
    const [ini, fim] = alvo[0].paginas_pdf;
    paginas = [];
    for (let p = ini; p <= fim; p++) if (!PAGINAS_SEM_TEXTO.includes(p)) paginas.push(p);
    if (alvo[0].tipo === 'itens') branda.add(ini);
  } else if (completo) {
    paginas = [];
    for (let p = FAIXA_CAPITULO[0]; p <= FAIXA_CAPITULO[1]; p++) if (!PAGINAS_SEM_TEXTO.includes(p)) paginas.push(p);
  } else {
    paginas = [...new Set(alvo.flatMap((l) => (l.itens || []).map((i) => i.pagina_pdf)))];
  }
  const o = verificarOraculo(registros(lotes), ctx, paginas, branda);
  erros.push(...o.erros);
  avisos.push(...o.avisos);

  if (completo && !soLote) {
    // Lotes de itens cobrem FAIXA_AZ sem buraco nem sobreposição.
    const faixas = lotes.filter((l) => l.tipo === 'itens').map((l) => l.paginas_pdf).sort((a, b) => a[0] - b[0]);
    let prox = FAIXA_AZ[0];
    for (const [ini, fim] of faixas) {
      if (ini !== prox) erros.push(`lotes de itens: faixa ${ini}-${fim} não começa em ${prox}`);
      prox = fim + 1;
    }
    if (prox !== FAIXA_AZ[1] + 1) erros.push(`lotes de itens terminam em ${prox - 1}, não em ${FAIXA_AZ[1]}`);
    if (!lotes.some((l) => l.tipo === 'regras')) erros.push('falta o lote de regras');
    const tabs = lotes.filter((l) => l.tipo === 'tabelas');
    if (tabs.length !== 1) erros.push(`esperado 1 lote de tabelas, há ${tabs.length}`);
    else erros.push(...verificarTabelas(tabs[0].tabelas_aleatorias || [], tabs[0].itens_fora_das_tabelas || [], itens));
    erros.push(...verificarPHB(itens, lotes.flatMap((l) => l.tesouros || []), ctx.phb));
  }
  return { erros, avisos };
}

/** Campos do item no formato `item.dados` do inventário do site. */
function dadosFicha(item, raridade) {
  return {
    tipo_item: TIPO_ITEM_FICHA[item.tipo] || 'Item Mágico',
    raridade: raridade === 'Varia' ? '' : raridade,
    requer_sintonizacao: !!item.requer_sintonizacao,
  };
}

/**
 * Converte pagina_pdf/pagina_pdf_fim em página impressa do livro. Os campos
 * opcionais pagina/pagina_fim (inteiros) têm precedência sobre a fórmula
 * "PDF - 4", pois as páginas 217-231 do PDF estão fora da ordem impressa.
 */
function paginas({ pagina_pdf, pagina_pdf_fim, pagina, pagina_fim }) {
  return {
    pagina: Number.isInteger(pagina) ? pagina : pagina_pdf - OFFSET_PAGINA,
    pagina_fim: Number.isInteger(pagina_fim) ? pagina_fim : pagina_pdf_fim - OFFSET_PAGINA,
  };
}

/** Magias da mecânica com o círculo do índice do Livro do Jogador; null quando não há. */
function magiasComCirculo(magias, circulos) {
  if (!magias) return null;
  return magias.map((m) => ({ ...m, circulo_base: circulos.get(m.nome) ?? null }));
}

/**
 * Junta os lotes nos quatro arquivos finais (sem gravar). `mecanica` é o
 * índice por id de mecanica.mjs (indiceMecanica(...).porId): todo item e
 * variante sai com `efeitos` (lista vazia quando não há entrada) e o item
 * sai com `base` quando a entrada tem. `circulos` é o mapa nome -> círculo das
 * magias do Livro do Jogador: item e variante saem com `magias` (cada uma com
 * `circulo_base`) ou `null` quando a entrada não tem. Item e variante saem
 * também com `aumento_permanente` (aumento de atributo até um máximo) ou `null`.
 */
export function montar(lotes, mecanica = {}, circulos = new Map()) {
  const itensLote = lotes.flatMap((l) => l.itens || []);
  const porNome = new Map(itensLote.map((i) => [normalizar(i.nome), i]));
  const itens = itensLote.map((i) => {
    const { pagina_pdf, pagina_pdf_fim, pagina, pagina_fim, variantes = [], ...resto } = i;
    return {
      id: slug(i.nome), ...resto, ...paginas({ pagina_pdf, pagina_pdf_fim, pagina, pagina_fim }),
      variantes: variantes.map((v) => ({
        id: slug(v.nome), ...v, dados_ficha: dadosFicha(i, v.raridade),
        efeitos: mecanica[slug(v.nome)]?.efeitos ?? [],
        recursos: mecanica[slug(v.nome)]?.recursos ?? null,
        magias: magiasComCirculo(mecanica[slug(v.nome)]?.magias, circulos),
        aumento_permanente: mecanica[slug(v.nome)]?.aumento_permanente ?? null,
      })),
      dados_ficha: dadosFicha(i, i.raridade),
      efeitos: mecanica[slug(i.nome)]?.efeitos ?? [],
      recursos: mecanica[slug(i.nome)]?.recursos ?? null,
      magias: magiasComCirculo(mecanica[slug(i.nome)]?.magias, circulos),
      aumento_permanente: mecanica[slug(i.nome)]?.aumento_permanente ?? null,
      ...(mecanica[slug(i.nome)]?.base ? { base: mecanica[slug(i.nome)].base } : {}),
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const secoes = lotes.flatMap((l) => l.secoes || []).map(({ pagina_pdf, pagina_pdf_fim, pagina, pagina_fim, ...s }) => ({ ...s, ...paginas({ pagina_pdf, pagina_pdf_fim, pagina, pagina_fim }) }));
  const tesouros = lotes.flatMap((l) => l.tesouros || []).map(({ pagina_pdf, pagina_pdf_fim, pagina, pagina_fim, ...t }) => ({ id: slug(t.nome), ...t, ...paginas({ pagina_pdf, pagina_pdf_fim, pagina, pagina_fim }) }));
  const loteTab = lotes.find((l) => l.tipo === 'tabelas') || {};
  const idDe = (nome) => slug(porNome.get(normalizar(nome))?.nome ?? nome);
  const tabelas = (loteTab.tabelas_aleatorias || []).map((t) => ({
    ...t,
    entradas: (t.entradas || []).map((x) => ({ min: x.min, max: x.max, item_id: idDe(x.item), variantes: (x.variantes || []).map(slug), texto: x.texto })),
  }));
  return {
    regras: { fonte: FONTE, capitulo: 7, titulo: 'Tesouros', total_secoes: secoes.length, secoes },
    itens_magicos: {
      fonte: FONTE, total_itens: itens.length,
      total_variantes: itens.reduce((n, i) => n + i.variantes.length, 0), itens,
    },
    tesouros: { fonte: FONTE, total: tesouros.length, itens: tesouros },
    tabelas_itens_aleatorios: {
      fonte: FONTE, total_tabelas: tabelas.length, tabelas,
      itens_fora_das_tabelas: (loteTab.itens_fora_das_tabelas || []).map((f) => ({ item_id: idDe(f.item), motivo: f.motivo })),
    },
  };
}

/** Grava os quatro arquivos finais em dados/livro-do-mestre/capitulo7/. */
export function gravar(montado) {
  for (const [nome, conteudo] of Object.entries(montado)) {
    fs.writeFileSync(path.join(DIR_CAP7, `${nome}.json`), `${JSON.stringify(conteudo, null, 2)}\n`, 'utf-8');
  }
}

/** CLI: verificar [--lote NN] | montar. Comando desconhecido ou montar com --lote: uso e código 2. */
async function principal(args) {
  const uso = 'uso: capitulo7.mjs verificar [--lote NN] | montar';
  const comando = args[0];
  if (comando !== 'verificar' && comando !== 'montar') { console.log(uso); return 2; }
  const k = args.indexOf('--lote');
  if (comando === 'montar' && k >= 0) { console.log(`montar sempre verifica tudo e não aceita --lote\n${uso}`); return 2; }
  const soLote = k >= 0 ? args[k + 1] : null;
  const lotes = carregarLotes();
  const ctx = carregarContexto();
  const r = soLote ? verificar(lotes, ctx, { completo: false, italicoEstrito: false, soLote }) : verificar(lotes, ctx);
  for (const a of r.avisos) console.log(`aviso: ${a}`);
  for (const e of r.erros) console.log(`ERRO: ${e}`);
  console.log(`${r.erros.length} erro(s), ${r.avisos.length} aviso(s), ${lotes.length} lote(s)`);
  if (comando === 'montar') {
    if (r.erros.length) { console.log('montar recusado: há erros'); return 1; }
    const { carregarMecanica, carregarCatalogos, indiceMecanica, verificarMecanica } = await import('./mecanica.mjs');
    const mec = carregarMecanica();
    const errosMec = verificarMecanica(mec, lotes, carregarCatalogos());
    for (const e of errosMec) console.log(`ERRO mecânica: ${e}`);
    if (errosMec.length) { console.log('montar recusado: há erros na mecânica'); return 1; }
    gravar(montar(lotes, indiceMecanica(mec).porId, carregarCatalogos().magias));
    console.log(`gravado em ${DIR_CAP7}`);
  }
  return r.erros.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal(process.argv.slice(2)).then((codigo) => { process.exitCode = codigo; });
}
