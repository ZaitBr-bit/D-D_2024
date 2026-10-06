// ============================================================
// Artífice (Tasha's; texto extraído do PDF Eberron: Forge of the Artificer):
// montagem e verificação dos lotes de dados/tasha/artifice/_lotes/.
//
//   node scripts/tasha/artifice.mjs verificar [--parcial]
//   node scripts/tasha/artifice.mjs montar
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizar, slug, italicos, verificarTexto, verificarItem } from '../livro-do-mestre/capitulo7.mjs';
import { ALVOS, RECUPERA_USO } from '../livro-do-mestre/mecanica.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIR_ARTIFICE = path.join(RAIZ, 'dados', 'tasha', 'artifice');
export const DIR_LOTES = path.join(DIR_ARTIFICE, '_lotes');
const DIR_SCRIPTS = path.join(RAIZ, 'scripts', 'tasha');
export const FONTE_ID = 'tasha';
const CIRCULOS = ['Truques', '1º Círculo', '2º Círculo', '3º Círculo', '4º Círculo', '5º Círculo'];
const COLUNAS = ['Nível', 'Bônus de Proficiência', 'Características', 'Planos Conhecidos', 'Itens Mágicos', 'Truques', 'Magias Preparadas', '1', '2', '3', '4', '5'];
const NIVEIS_PLANO = [2, 6, 10, 14];
const SINTONIZACAO = { Yes: true, No: false, Varies: null };
const SUBCLASSES_EN = { 'Alquimista': 'Alchemist', 'Armeiro': 'Armorer', 'Artilheiro': 'Artillerist', 'Ferreiro de Batalha': 'Battle Smith', 'Cartógrafo': 'Cartographer' };

/** Lê um JSON do disco. */
function lerJson(arq) {
  return JSON.parse(fs.readFileSync(arq, 'utf-8'));
}

/** Lotes lote-NN.json em ordem, cada um com `_arquivo`. */
export function carregarLotes(dir = DIR_LOTES) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^lote-\d{2}\.json$/.test(f)).sort()
    .map((f) => ({ ...lerJson(path.join(dir, f)), _arquivo: f }));
}

/** Contexto dos oráculos: PDF, glossário, índice de magias, acervo do Livro do Mestre e fontes. */
export function carregarContexto() {
  const acervo = lerJson(path.join(RAIZ, 'dados', 'livro-do-mestre', 'capitulo7', 'itens_magicos.json')).itens;
  const arqFontes = path.join(RAIZ, 'dados', 'fontes.json');
  const indiceMagias = lerJson(path.join(RAIZ, 'dados', 'magias', '_indice.json')).magias;
  return {
    oraculo: lerJson(path.join(DIR_SCRIPTS, 'oraculo_artifice.json')),
    glossario: lerJson(path.join(DIR_SCRIPTS, 'magias_en_pt.json')),
    magias: indiceMagias.map((m) => m.nome),
    escolas: [...new Set(indiceMagias.map((m) => m.escola))],
    acervo,
    fontes: fs.existsSync(arqFontes) ? lerJson(arqFontes).fontes.map((f) => f.id) : [FONTE_ID],
  };
}

/** Texto de classe/subclasse: o portão do Livro do Mestre, aceitando tabela markdown (o site a renderiza em característica). */
function verificarTextoClasse(t, onde) {
  return verificarTexto(t, onde).filter((e) => !/marcação que o site não renderiza "\|/.test(e));
}

/** Termos em itálico, separando por vírgula (convenção `*Magia A, Magia B*` num itálico só). */
export function italicosSeparados(texto) {
  return italicos(texto).flatMap((x) => x.split(',')).map((n) => n.trim()).filter(Boolean);
}

/** Linhas {nivel, magias} da tabela markdown de magias de subclasse ("| 3 | *A, B* |"). */
export function magiasDaTabelaSubclasse(descricao) {
  const out = [];
  for (const linha of String(descricao || '').split('\n')) {
    const m = linha.match(/^\|\s*\**(\d+)\**\s*\|\s*(.+?)\s*\|\s*$/);
    if (!m) continue;
    const nomes = [...m[2].matchAll(/\*([^*]+)\*/g)].flatMap((x) => x[1].split(',')).map((n) => n.trim()).filter(Boolean);
    out.push({ nivel: Number(m[1]), magias: nomes });
  }
  return out;
}

/** Nomes PT válidos de magia: índice do site mais as magias novas dos lotes. */
function nomesDeMagia(ctx, lotes) {
  return new Set([...ctx.magias, ...lotes.flatMap((l) => (l.magias || []).map((m) => m.nome))]);
}

/** Erros da tabela da classe contra o oráculo (colunas, 20 níveis, cada número). */
function verificarTabela(tabela, oraculo) {
  const e = [];
  if (!Array.isArray(tabela) || tabela.length !== 20) return [`tabela da classe: ${tabela?.length} linhas, esperado 20`];
  const num = (v) => (v === '—' ? null : Number(String(v).replace('+', '')));
  tabela.forEach((linha, i) => {
    const o = oraculo.tabela_classe[i];
    const onde = `tabela nível ${i + 1}`;
    const faltam = COLUNAS.filter((c) => !(c in linha));
    if (faltam.length) e.push(`${onde}: sem colunas ${faltam.join(', ')}`);
    const pares = [['Nível', o.nivel], ['Bônus de Proficiência', o.pb], ['Planos Conhecidos', o.planos], ['Itens Mágicos', o.itens],
      ['Truques', o.truques], ['Magias Preparadas', o.preparadas], ...o.espacos.map((v, k) => [String(k + 1), v])];
    for (const [col, esperado] of pares) {
      if (num(linha[col]) !== esperado) e.push(`${onde}: tabela diverge em "${col}" (${linha[col]} vs PDF ${esperado ?? '—'})`);
    }
  });
  return e;
}

/** Erros da lista de magias da classe: mesma lista do oráculo, nome pelo glossário, nome existente. */
function verificarListaMagias(lista, ctx, validos) {
  const e = [];
  CIRCULOS.forEach((chave, c) => {
    const esperado = (ctx.oraculo.magias_en[String(c)] || []).map((m) => m.nome).sort();
    const atual = (lista?.[chave] || []).map((m) => m.nome_en).sort();
    if (JSON.stringify(esperado) !== JSON.stringify(atual)) e.push(`lista diverge do oráculo em ${chave}: ${JSON.stringify(atual)} vs ${JSON.stringify(esperado)}`);
    for (const m of lista?.[chave] || []) {
      const pt = ctx.glossario[m.nome_en];
      if (!pt) e.push(`${chave}: "${m.nome_en}" sem entrada no glossário`);
      else if (!validos.has(pt)) e.push(`${chave}: magia fora do índice "${pt}"`);
    }
  });
  return e;
}

/** Erros das tabelas de magias de subclasse: nomes válidos e iguais aos do oráculo, pelo glossário. */
function verificarMagiasSubclasse(sub, ctx, validos) {
  const e = [];
  const en = SUBCLASSES_EN[sub.nome];
  const feat = (sub.caracteristicas || []).find((f) => /^Magias de /.test(f.nome));
  if (!feat) return [`subclasse "${sub.nome}": sem característica "Magias de ..."`];
  const linhas = magiasDaTabelaSubclasse(feat.descricao);
  const oraculo = ctx.oraculo.magias_subclasse_en[en] || {};
  if (linhas.length !== 5) e.push(`subclasse "${sub.nome}": tabela de magias com ${linhas.length} linhas, esperado 5`);
  for (const { nivel, magias } of linhas) {
    const esperado = (oraculo[String(nivel)] || []).map((n) => ctx.glossario[n]);
    if (JSON.stringify([...magias].sort()) !== JSON.stringify([...esperado].sort())) {
      e.push(`subclasse "${sub.nome}" nível ${nivel}: ${JSON.stringify(magias)} vs PDF ${JSON.stringify(esperado)}`);
    }
    for (const m of magias) if (!validos.has(m)) e.push(`subclasse "${sub.nome}": magia fora do índice "${m}"`);
  }
  return e;
}

/** Registro do acervo do Livro do Mestre ou do lote de itens que o plano aponta (item ou variante). */
function alvoDoPlano(p, ctx, itensLote) {
  const base = p.livro === FONTE_ID ? itensLote : ctx.acervo;
  const item = base.find((i) => (i.id || slug(i.nome)) === p.item_id);
  if (!item) return null;
  if (!p.variante_id) return { item, reg: item };
  const v = (item.variantes || []).find((x) => (x.id || slug(x.nome)) === p.variante_id);
  return v ? { item, reg: v } : null;
}

/** Erros dos planos: contagem e sintonização por nível contra o oráculo; item resolvido; genérico bem formado. */
function verificarPlanos(planos, ctx, itensLote) {
  const e = [];
  for (const n of NIVEIS_PLANO) {
    const doNivel = planos.filter((p) => p.nivel_minimo === n);
    const oraculo = ctx.oraculo.planos[String(n)] || [];
    if (doNivel.length !== oraculo.length) e.push(`planos nível ${n}+: ${doNivel.length}, PDF tem ${oraculo.length}`);
    oraculo.forEach((o, k) => {
      const p = doNivel[k];
      if (p && p.requer_sintonizacao !== SINTONIZACAO[o.sintonizacao]) e.push(`planos nível ${n}+ linha ${k + 1} ("${p.nome_en}"): sintonização diverge do PDF (${o.sintonizacao})`);
    });
  }
  for (const p of planos) {
    const onde = `plano "${p.nome_en}"`;
    if (p.generico) {
      if (p.item_id) e.push(`${onde}: genérico não tem item_id`);
      if (!p.nome) e.push(`${onde}: genérico sem nome em PT-BR`);
      if (!Array.isArray(p.generico.raridades) || !p.generico.raridades.length) e.push(`${onde}: genérico sem raridades`);
      continue;
    }
    const alvo = alvoDoPlano(p, ctx, itensLote);
    if (!alvo) { e.push(`${onde}: plano sem item (${p.livro || 'livro-do-mestre'}/${p.item_id}/${p.variante_id || ''})`); continue; }
    if (!!alvo.item.requer_sintonizacao !== p.requer_sintonizacao) e.push(`${onde}: sintonização diverge do item "${alvo.reg.nome}"`);
  }
  const ids = planos.map((p) => p.id);
  if (new Set(ids).size !== ids.length) e.push('planos: id repetido');
  return e;
}

/** Erros de mecânica de item do Apêndice: alvos e recuperações conhecidos pelo site. */
function verificarMecanicaItem(i, onde) {
  const e = [];
  for (const ef of i.efeitos || []) if (!ALVOS.includes(ef.alvo)) e.push(`${onde}: efeito com alvo desconhecido "${ef.alvo}"`);
  for (const u of i.recursos?.usos || []) if (!RECUPERA_USO.includes(u.recupera)) e.push(`${onde}: uso "${u.nome}" com recupera "${u.recupera}"`);
  if (i.recursos?.cargas && !(Number.isInteger(i.recursos.cargas.max) && i.recursos.cargas.max >= 1)) e.push(`${onde}: cargas.max inválido`);
  return e;
}

/** Erros de esquema de criatura: nome, tipo, CA/PV em fórmula, atributos, ações. */
function verificarCriatura(c, onde) {
  const e = [];
  for (const campo of ['id', 'nome', 'nome_en', 'tipo']) if (!c[campo]) e.push(`${onde}: campo "${campo}" vazio`);
  if (!c.ca || !Number.isInteger(c.ca.base)) e.push(`${onde}: ca.base ausente`);
  if (!c.pv || !Number.isInteger(c.pv.base)) e.push(`${onde}: pv.base ausente`);
  const atr = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];
  if (!c.atributos || atr.some((a) => !Number.isInteger(c.atributos[a]))) e.push(`${onde}: atributos incompletos`);
  if (!Array.isArray(c.acoes) || !c.acoes.length) e.push(`${onde}: sem ações`);
  return e;
}

/**
 * Confere os lotes. completo=false (CLI --parcial) pula as checagens que exigem
 * todos os lotes (planos do Apêndice, 5 subclasses, magia nova).
 */
export function verificar(lotes, ctx, { completo = true } = {}) {
  const erros = [];
  const avisos = [];
  const validos = nomesDeMagia(ctx, lotes);
  const itensLote = lotes.flatMap((l) => l.itens || []);
  const loteClasse = lotes.find((l) => l.tipo === 'classe');
  if (loteClasse) {
    const c = loteClasse.classe;
    erros.push(...verificarTabela(c.tabela_caracteristicas, ctx.oraculo));
    erros.push(...verificarListaMagias(c.lista_magias, ctx, validos));
    for (const [chave, itens] of Object.entries(c.lista_magias || {})) {
      for (const m of itens) {
        if (!(ctx.escolas || []).includes(ESCOLAS[m.escola])) erros.push(`lista ${chave}: escola "${m.escola}" de "${m.nome_en}" fora do catálogo do site`);
      }
    }
    for (const f of c.caracteristicas || []) {
      erros.push(...verificarTextoClasse([f.nome, f.descricao].join('\n'), `característica "${f.nome}"`));
      for (const termo of italicosSeparados(f.descricao)) {
        if (!validos.has(termo) && !itensLote.some((i) => i.nome === termo) && !ctx.acervo.some((i) => i.nome === termo)) {
          erros.push(`característica "${f.nome}": itálico "*${termo}*" não é magia nem item conhecido`);
        }
      }
    }
    erros.push(...verificarTextoClasse(Object.values(c.tracos_basicos || {}).join('\n'), 'traços básicos'));
    if (completo) erros.push(...verificarPlanos(loteClasse.planos || [], ctx, itensLote));
  } else if (completo) erros.push('falta o lote da classe');

  const subclasses = lotes.flatMap((l) => l.subclasses || []);
  for (const s of subclasses) {
    if (!SUBCLASSES_EN[s.nome]) erros.push(`subclasse desconhecida "${s.nome}"`);
    erros.push(...verificarMagiasSubclasse(s, ctx, validos));
    for (const f of s.caracteristicas || []) {
      erros.push(...verificarTextoClasse([f.nome, f.descricao].join('\n'), `${s.nome} — "${f.nome}"`));
      for (const termo of italicosSeparados(f.descricao)) {
        if (!validos.has(termo)) erros.push(`${s.nome} — "${f.nome}": itálico "*${termo}*" não é magia conhecida`);
      }
    }
  }
  if (completo && subclasses.length !== 5) erros.push(`subclasses: ${subclasses.length}, esperado 5`);

  const escolasSite = new Set(ctx.escolas || []);
  for (const m of lotes.flatMap((l) => l.magias || [])) {
    if (!escolasSite.has(m.escola)) erros.push(`magia "${m.nome}": escola "${m.escola}" fora do catálogo do site`);
    erros.push(...verificarTextoClasse([m.nome, m.descricao, m.circulo_superior || '', m.alcance, m.duracao].join('\n'), `magia "${m.nome}"`));
    if (ctx.magias.includes(m.nome)) erros.push(`magia "${m.nome}" já existe no índice do site`);
  }
  if (completo && !lotes.some((l) => (l.magias || []).some((m) => m.nome === 'Servo Homúnculo'))) erros.push('falta a magia Servo Homúnculo');

  for (const c of lotes.flatMap((l) => l.criaturas || [])) erros.push(...verificarCriatura(c, `criatura "${c.nome}"`));

  for (const i of itensLote) {
    const onde = `item "${i.nome}"`;
    erros.push(...verificarItem(i, onde));
    erros.push(...verificarMecanicaItem(i, onde));
    if (ctx.acervo.some((a) => normalizar(a.nome) === normalizar(i.nome))) erros.push(`${onde}: nome já existe no acervo do Livro do Mestre`);
  }
  if (completo && itensLote.length !== 9) erros.push(`itens do Apêndice: ${itensLote.length}, esperado 9`);

  if (!ctx.fontes.includes(FONTE_ID)) erros.push(`fonte "${FONTE_ID}" não existe em dados/fontes.json`);
  return { erros, avisos };
}

/** Escolas de magia (EN do PDF -> PT do catálogo do site; Conjuration é "Invocação" no site). */
const ESCOLAS = { Abjuration: 'Abjuração', Conjuration: 'Invocação', Divination: 'Adivinhação', Enchantment: 'Encantamento', Evocation: 'Evocação', Illusion: 'Ilusão', Necromancy: 'Necromancia', Transmutation: 'Transmutação' };

/** Magias de uma lista no formato de dados/classes/magias_<classe>.json (nome PT, escola PT, especial). */
function listaComNomesPT(lista, ctx) {
  return Object.fromEntries(CIRCULOS.map((chave) => [chave, (lista?.[chave] || [])
    .map((m) => ({ nome: ctx.glossario[m.nome_en], escola: ESCOLAS[m.escola] || m.escola, especial: (m.especial || '—').replace(/,\s*/g, ', ') }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))]));
}

/** Junta os lotes nos seis arquivos finais (sem gravar). */
export function montar(lotes, ctx) {
  const lc = lotes.find((l) => l.tipo === 'classe');
  const c = lc.classe;
  const subclasses = lotes.flatMap((l) => l.subclasses || []).map((s) => ({
    nome: s.nome, fonte: FONTE_ID, descricao: s.descricao,
    caracteristicas: s.caracteristicas.map(({ nivel, nome, descricao }) => ({ nivel, nome, descricao })),
  }));
  const caracteristicas = c.caracteristicas.map(({ nivel, nome, descricao }) => ({ nivel, nome, descricao }));
  const texto_completo = [`# ${c.nome}`, ...caracteristicas.map((f) => `### Nível ${f.nivel}: ${f.nome}\n${f.descricao}`)].join('\n\n');
  const lista_magias = listaComNomesPT(c.lista_magias, ctx);
  const magias = lotes.flatMap((l) => l.magias || []).map(({ nome_en, pagina_pdf, ...m }) => ({ ...m, classes: ['Artífice'], fonte: FONTE_ID }));
  const itens = lotes.flatMap((l) => l.itens || []).map(({ pagina_pdf, pagina_pdf_fim, ...i }) => ({
    id: slug(i.nome), ...i, fonte: FONTE_ID,
    dados_ficha: { tipo_item: i.tipo === 'Armadura' ? 'Armadura' : 'Item Mágico', raridade: i.raridade, requer_sintonizacao: !!i.requer_sintonizacao },
    efeitos: i.efeitos || [], recursos: i.recursos ?? null, magias: null, aumento_permanente: null,
  }));
  const planos = (lc.planos || []).map((p) => ({ ...p, id: p.id || slug(p.nome_en) }));
  return {
    classe: { nome: c.nome, fonte: FONTE_ID, tracos_basicos: c.tracos_basicos, tabela_caracteristicas: c.tabela_caracteristicas, caracteristicas, subclasses, lista_magias, texto_completo },
    magias_classe: { classe: c.nome, fonte: FONTE_ID, lista_magias },
    magias: { fonte: FONTE_ID, magias },
    planos: { fonte: FONTE_ID, niveis: NIVEIS_PLANO, planos },
    itens_magicos: { fonte: FONTE_ID, total_itens: itens.length, itens },
    criaturas: { fonte: FONTE_ID, criaturas: lotes.flatMap((l) => l.criaturas || []) },
  };
}

/** Grava os seis arquivos finais em dados/tasha/artifice/. */
export function gravar(montado) {
  for (const [nome, conteudo] of Object.entries(montado)) {
    fs.writeFileSync(path.join(DIR_ARTIFICE, `${nome}.json`), `${JSON.stringify(conteudo, null, 2)}\n`, 'utf-8');
  }
}

/** CLI: verificar [--parcial] | montar. Comando desconhecido: uso e código 2. */
function principal(args) {
  const uso = 'uso: artifice.mjs verificar [--parcial] | montar';
  const comando = args[0];
  if (comando !== 'verificar' && comando !== 'montar') { console.log(uso); return 2; }
  const lotes = carregarLotes();
  const ctx = carregarContexto();
  const r = verificar(lotes, ctx, { completo: comando === 'montar' || !args.includes('--parcial') });
  for (const a of r.avisos) console.log(`aviso: ${a}`);
  for (const e of r.erros) console.log(`ERRO: ${e}`);
  console.log(`${r.erros.length} erro(s), ${r.avisos.length} aviso(s), ${lotes.length} lote(s)`);
  if (comando === 'montar') {
    if (r.erros.length) { console.log('montar recusado: há erros'); return 1; }
    gravar(montar(lotes, ctx));
    console.log(`gravado em ${DIR_ARTIFICE}`);
  }
  return r.erros.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = principal(process.argv.slice(2));
}
