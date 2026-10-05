// ============================================================
// Mecânica dos itens mágicos do capítulo 7 (Livro do Mestre 2024).
//
// Fonte editável: dados/livro-do-mestre/capitulo7/_mecanica/lote-NN.json,
// um por lote de itens (01..12). Cada arquivo diz, para cada registro do
// lote (item ou variante), os efeitos que a ficha automatiza ou que ele
// não tem efeito automático. `montar` (capitulo7.mjs) mescla isso em
// itens_magicos.json. Regras de curadoria: GUIA-MECANICA.md.
//
//   node scripts/livro-do-mestre/mecanica.mjs verificar [--lote NN]
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarLotes, slug, DIR_CAP7 } from './capitulo7.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIR_MECANICA = path.join(DIR_CAP7, '_mecanica');

// Alvos de efeito passivo de defesa, deslocamento, sentido e vantagem (verificarPassivo).
const ALVOS_PASSIVOS = ['resistencia', 'imunidade', 'imunidade_condicao', 'deslocamento', 'deslocamento_minimo', 'sentido', 'vantagem'];
// Alvos de aumento de atributo até um máximo (verificarAumentoEfeito).
const ALVOS_AUMENTO = ['atributo_bonus', 'atributo_minimo_bonus'];
export const ALVOS = ['ca', 'ca_base', 'ataque_arma', 'dano_arma', 'ataque_magia', 'cd_magia', 'salvaguarda', 'atributo', ...ALVOS_PASSIVOS, ...ALVOS_AUMENTO];
// Condições de equipamento do efeito (campo "condicao" dos alvos de CA/salvaguarda).
export const CONDICOES_ARMADURA = ['sem_armadura', 'sem_escudo', 'sem_armadura_nem_escudo'];
export const TIPOS_DANO = ['Ácido', 'Contundente', 'Cortante', 'Elétrico', 'Energético', 'Gélido', 'Ígneo', 'Necrótico', 'Perfurante', 'Psíquico', 'Radiante', 'Trovejante', 'Venenoso'];
// Condições do glossário da ficha (chaves de CONDICOES_DESCRICAO em site/js/sheet/condicoes.js).
export const CONDICOES = ['Amedrontado', 'Atordoado', 'Caído', 'Cego', 'Contido', 'Enfeitiçado', 'Envenenado', 'Exaustão', 'Imobilizado', 'Incapacitado', 'Inconsciente', 'Invisível', 'Paralisado', 'Petrificado', 'Surdo'];
const MODOS_DESLOCAMENTO = { voo: 'Voo', natacao: 'Natação', escalada: 'Escalada' };
const SENTIDOS = { visao_no_escuro: 'Visão no Escuro', visao_verdadeira: 'Visão Verdadeira', visao_as_cegas: 'Visão às Cegas' };
// Perícias da ficha (PERICIAS de site/js/dados-classes.js) e atributos por extenso.
export const PERICIAS = ['Acrobacia', 'Lidar com Animais', 'Arcanismo', 'Atletismo', 'Atuação', 'Enganação', 'Furtividade', 'História', 'Intimidação', 'Intuição', 'Investigação', 'Medicina', 'Natureza', 'Percepção', 'Persuasão', 'Prestidigitação', 'Religião', 'Sobrevivência'];
const ATRIBUTOS_EXTENSO = ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'];
const EM_VANTAGEM = ['pericia', 'salvaguarda', 'iniciativa'];
// Frases do texto que indicam efeito passivo de defesa, deslocamento, sentido ou vantagem (completude).
// "Vantagem" exige que a palavra não seja precedida de letra, para não casar dentro de "Desvantagem".
export const RE_PASSIVO = /tem Resistência a (todo )?dano|Resistência a um (tipo de dano|dos seguintes tipos)|Imunidade (à|às|a) (condição|condições|dano)|tem (um )?Deslocamento de (Voo|Natação|Escalada)|Deslocamento de (Voo|Natação|Escalada)( e Deslocamento de (Voo|Natação|Escalada))? igua|tem Visão no Escuro com alcance|Visão Verdadeira com alcance|Visão às Cegas com alcance|Deslocamento se torna|(?<![A-Za-zÀ-ÿ])Vantagem (em|nas?|nos) (qualquer |todos os |todas as )?(testes?|jogadas?|salvaguardas?)|(?<![A-Za-zÀ-ÿ])Vantagem em [^.]*Iniciativa/i;

/** Se "N metros" aparece com N isolado no texto (18 não casa dentro de 118 nem 5 em "1,5 metros"). */
function metrosNoTexto(n, texto) {
  return new RegExp(`(?<![\\d,])${n} metros`).test(texto);
}

/** Escapa os metacaracteres de RegExp de um trecho literal. */
function escaparRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Se `termo` aparece em `texto` como palavra inteira (sem letra antes nem depois): "Cego" não casa em "Cegos". */
function palavraNoTexto(termo, texto) {
  return new RegExp(`(?<![\\p{L}])${escaparRegExp(termo)}(?![\\p{L}])`, 'u').test(texto);
}
export const ATRIBUTOS = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];
const TIPOS_BASE = ['arma', 'armadura', 'escudo'];
const CATEGORIAS_ARMADURA = ['Leve', 'Média', 'Pesada'];
const ALVOS_DA_ARMA = ['ataque_arma', 'dano_arma'];
// Faixas plausíveis: bônus de item do livro vai de +1 a +3; CA base de item
// fica entre 10 e 25; atributo definido por item vai de 19 a 30.
const FAIXA_VALOR = { padrao: [1, 5], ca_base: [10, 25] };
const FAIXA_MINIMO = [19, 30];
// Recuperação de usos de propriedade (recursos.usos[].recupera) e dado de recuperação de cargas.
export const RECUPERA_USO = ['amanhecer', 'descanso_longo', 'descanso_curto'];
const RE_DADO_RECUPERA = /^\d+d\d+(\+\d+)?$/;

/** Lê um JSON do disco. */
function lerJson(arq) {
  return JSON.parse(fs.readFileSync(arq, 'utf-8'));
}

/** Arquivos lote-NN.json da mecânica, em ordem, cada um com `_arquivo`. */
export function carregarMecanica(dir = DIR_MECANICA) {
  if (!fs.existsSync(dir)) return { arquivos: [] };
  const arquivos = fs.readdirSync(dir).filter((f) => /^lote-\d{2}\.json$/.test(f)).sort()
    .map((f) => ({ itens: {}, sem_efeito_automatico: [], sem_cargas: {}, sem_magias: {}, sem_passivos: {}, sem_aumento: {}, pendencias: [], ...lerJson(path.join(dir, f)), _arquivo: f }));
  return { arquivos };
}

/** Armas, armaduras ({nome, categoria}) e índice de magias (nome -> círculo) do Livro do Jogador. */
export function carregarCatalogos() {
  const armas = lerJson(path.join(RAIZ, 'dados', 'equipamento', 'armas.json')).armas;
  const armaduras = lerJson(path.join(RAIZ, 'dados', 'equipamento', 'armaduras.json')).armaduras;
  const indice = lerJson(path.join(RAIZ, 'dados', 'magias', '_indice.json')).magias;
  return {
    armas: armas.map((a) => ({ nome: a.nome, categoria: a.categoria })),
    armaduras: armaduras.map((a) => ({ nome: a.nome, categoria: a.categoria })),
    // Nome da magia -> círculo, do índice do Livro do Jogador.
    magias: new Map(indice.map((m) => [m.nome, m.circulo])),
  };
}

/** Texto traduzido de um item do lote: linha de tipo, descrição e células das tabelas. */
function textoDoItem(item) {
  const t = [item.linha_tipo, item.descricao];
  for (const tab of item.tabelas || []) t.push(tab.titulo, ...(tab.cabecalhos || []), ...(tab.dados || []).flat());
  return t.filter((x) => typeof x === 'string').join('\n');
}

/**
 * Registros (itens e variantes) dos lotes de itens, com id, lote, texto e id do pai.
 * O texto da variante é o do item-pai mais o nome da variante: todo número, tipo, condição e
 * perícia declarados numa variante são conferidos contra o texto do pai (limitação conhecida:
 * a validação não distingue qual variante o trecho descreve; essa conferência é da curadoria).
 */
export function registrosDosLotes(lotes) {
  const out = [];
  for (const l of lotes.filter((x) => x.tipo === 'itens')) {
    for (const item of l.itens || []) {
      const texto = textoDoItem(item);
      const id = slug(item.nome);
      // `descricao` e `celulas` separam o corpo do item das tabelas (usados na regra de custo livre).
      const partes = { descricao: typeof item.descricao === 'string' ? item.descricao : '', celulas: (item.tabelas || []).flatMap((t) => [t.titulo, ...(t.cabecalhos || []), ...(t.dados || []).flat()]).filter((x) => typeof x === 'string').join('\n') };
      out.push({ id, lote: l.lote, texto, pai: null, ...partes });
      for (const v of item.variantes || []) out.push({ id: slug(v.nome), lote: l.lote, texto: `${texto}\n${v.nome}`, pai: id, ...partes });
    }
  }
  return out;
}

/** Índice da mecânica: entrada por id e conjunto dos ids sem efeito automático. */
export function indiceMecanica(mec) {
  const porId = {};
  const sem = new Set();
  for (const a of mec.arquivos) {
    for (const [id, entrada] of Object.entries(a.itens || {})) porId[id] = entrada;
    for (const id of a.sem_efeito_automatico || []) sem.add(id);
  }
  return { porId, sem };
}

/**
 * Se o número `n` aparece como número real isolado no texto: não precedido de dígito ou vírgula
 * (118, "1,5" pela parte decimal) nem seguido de dígito, vírgula+dígito ou "d"+dígito ("1,5", "2d6"),
 * nem logo depois de "d" precedido de dígito (6 em "1d6").
 */
function numeroNoTexto(n, texto) {
  return new RegExp(`(?<![\\d,])(?<!\\dd)${Math.abs(n)}(?!\\d|,\\d|d\\d)`).test(texto);
}

/** Texto sem espaços, para casar "1d6 + 1" com "1d6+1". */
function semEspacos(s) {
  return String(s).replace(/\s+/g, '');
}

/** Erros de chaves de `obj` que não estão em `permitidas`. */
function chavesDesconhecidas(obj, permitidas, onde) {
  return Object.keys(obj).filter((k) => !permitidas.includes(k)).map((k) => `${onde}: chave desconhecida "${k}"`);
}

// Efeitos que um uso diário pode disparar na ficha (hoje só a recuperação de espaço de magia).
export const EFEITOS_DE_USO = ['recuperar_espaco_magia'];

// Qualquer menção a círculo no texto: "Nº círculo" (algarismo), "círculo N" e círculo por extenso.
const RE_LIMITE_DE_CIRCULO = /\d+º\s+círculo|círculo\s+\d|\b(?:primeiro|segundo|terceiro|quarto|quinto|sexto|sétimo|oitavo|nono)\s+círculo/i;

/**
 * Erros do `efeito` opcional de um uso: valor na lista fechada, `circulo_max`
 * só com `efeito`, e `circulo_max` opcional com `efeito`: ausente = sem limite
 * de círculo (o texto não pode citar "de/do Nº círculo"); presente = inteiro
 * 1..9 citado no texto como "Nº círculo".
 */
function verificarEfeitoDoUso(uso, onde, texto) {
  const e = [];
  const ref = `${onde}: uso "${uso?.nome}"`;
  if (uso.efeito === undefined) {
    if (uso.circulo_max !== undefined) e.push(`${ref} tem circulo_max sem efeito`);
    return e;
  }
  if (!EFEITOS_DE_USO.includes(uso.efeito)) {
    e.push(`${ref} com efeito "${uso.efeito}" fora de ${EFEITOS_DE_USO.join('/')}`);
    return e;
  }
  const c = uso.circulo_max;
  if (c === undefined) {
    if (RE_LIMITE_DE_CIRCULO.test(texto)) e.push(`${ref} com efeito sem circulo_max, mas o texto cita limite de círculo: informe circulo_max`);
    return e;
  }
  if (!Number.isInteger(c) || c < 1 || c > 9) e.push(`${ref} com efeito exige circulo_max inteiro de 1 a 9 (veio ${JSON.stringify(c)})`);
  else if (!new RegExp(`(?<!\\d)${c}º círculo`).test(texto)) e.push(`${ref} circulo_max ${c} não aparece no texto como "${c}º círculo"`);
  return e;
}

/** Erros dos recursos (cargas e usos) de um registro, conferidos contra o texto dele. */
function verificarRecursos(rec, onde, texto) {
  const e = [];
  if (rec === null) return e;
  if (typeof rec !== 'object' || Array.isArray(rec)) return [`${onde}: recursos tem de ser objeto ou null`];
  if (rec.cargas === undefined && rec.usos === undefined) e.push(`${onde}: recursos precisa de cargas ou usos`);
  e.push(...chavesDesconhecidas(rec, ['cargas', 'usos'], `${onde}: recursos`));
  const c = rec.cargas;
  if (c !== undefined) {
    if (c === null || typeof c !== 'object' || Array.isArray(c)) return [...e, `${onde}: cargas tem de ser objeto`];
    e.push(...chavesDesconhecidas(c, ['max', 'recupera', 'ultima_carga'], `${onde}: cargas`));
    if (!Number.isInteger(c?.max) || c.max < 1) e.push(`${onde}: cargas.max ${c?.max} inválido`);
    else if (!numeroNoTexto(c.max, texto)) e.push(`${onde}: cargas.max ${c.max} não aparece no texto do item`);
    const r = c?.recupera;
    if (typeof r === 'string' && r !== 'todas') {
      if (!RE_DADO_RECUPERA.test(r)) e.push(`${onde}: cargas.recupera "${r}" inválido`);
      else if (!semEspacos(texto).includes(r)) e.push(`${onde}: cargas.recupera "${r}" não aparece no texto do item`);
    } else if (r !== null && r !== 'todas' && !(Number.isInteger(r) && r >= 1)) {
      e.push(`${onde}: cargas.recupera ${JSON.stringify(r)} inválido`);
    } else if (Number.isInteger(r) && !numeroNoTexto(r, texto)) {
      e.push(`${onde}: cargas.recupera ${r} não aparece no texto do item`);
    }
    const u = c?.ultima_carga;
    if (u !== null && u !== undefined) {
      if (typeof u !== 'object' || Array.isArray(u)) return [...e, `${onde}: ultima_carga tem de ser objeto ou null`];
      e.push(...chavesDesconhecidas(u, ['efeito_com_1', 'texto'], `${onde}: ultima_carga`));
      if (!/última carga/i.test(texto)) e.push(`${onde}: ultima_carga sem a regra da última carga no texto`);
      if (u.efeito_com_1 === 'destroi') {
        // Aceita "destruído", "destruída", "destruir" e "destrói".
        if (!/destr[uó]/i.test(texto)) e.push(`${onde}: ultima_carga "destroi" sem "destruíd" no texto`);
        // "destroi" significa jogar o d20 e, com 1, destruir; exige a rolagem no texto.
        if (!/1d20/.test(texto)) e.push(`${onde}: ultima_carga "destroi" exige a rolagem 1d20 no texto`);
      } else if (u.efeito_com_1 === 'outro') {
        if (typeof u.texto !== 'string' || !texto.includes(u.texto)) e.push(`${onde}: texto da última carga não aparece literalmente no texto do item`);
      } else {
        e.push(`${onde}: ultima_carga.efeito_com_1 "${u.efeito_com_1}" fora de destroi/outro`);
      }
    }
  }
  if (rec.usos !== undefined) {
    if (!Array.isArray(rec.usos)) return [...e, `${onde}: usos tem de ser lista`];
    const nomes = new Set();
    for (const uso of rec.usos) {
      if (uso === null || typeof uso !== 'object' || Array.isArray(uso)) { e.push(`${onde}: uso tem de ser objeto`); continue; }
      e.push(...chavesDesconhecidas(uso, ['nome', 'max', 'recupera', 'efeito', 'circulo_max'], `${onde}: uso "${uso.nome}"`));
      e.push(...verificarEfeitoDoUso(uso, onde, texto));
      if (!uso?.nome) e.push(`${onde}: uso sem nome`);
      else if (nomes.has(uso.nome)) e.push(`${onde}: uso "${uso.nome}" repetido`);
      else nomes.add(uso.nome);
      if (!Number.isInteger(uso?.max) || uso.max < 1) e.push(`${onde}: uso "${uso?.nome}" com max ${uso?.max} inválido`);
      if (!RECUPERA_USO.includes(uso?.recupera)) e.push(`${onde}: uso "${uso?.nome}" com recupera "${uso?.recupera}" fora de ${RECUPERA_USO.join('/')}`);
      else if (uso.recupera === 'amanhecer' && !/amanhecer/i.test(texto)) e.push(`${onde}: uso "${uso.nome}" amanhecer exige "amanhecer" no texto`);
      else if (uso.recupera === 'descanso_curto' && !/Descanso Curto/i.test(texto)) e.push(`${onde}: uso "${uso.nome}" descanso_curto exige "Descanso Curto" no texto`);
      else if (uso.recupera === 'descanso_longo' && !/Descanso Longo/i.test(texto)) e.push(`${onde}: uso "${uso.nome}" descanso_longo exige "Descanso Longo" no texto`);
    }
  }
  return e;
}

// Frases de magia que o texto não nomeia (a ficha não tem a magia para listar): "Magia Desconhecida",
// "magia ... vinculada a este item", "magia à sua escolha" e "magia escolhida".
export const RE_MAGIA_NAO_NOMEADA = /Magia Desconhecida|magias? [^.]*vinculadas? a|magias? à sua escolha|magias? escolhidas?/i;

// Frases que autorizam conjuracao "sua" (CD/ataque/modificador do personagem).
const RE_CONJURACAO_SUA = /CD para evitar suas magias|sua CD|seu modificador de atributo de conjuração|seu bônus de ataque de magia/i;

/** Nomes de magia do índice que aparecem em itálico simples (*Nome*) no texto. */
function magiasEmItalico(texto, indice) {
  const out = new Set();
  for (const m of texto.matchAll(/(?<!\*)\*([^*\n]+)\*(?!\*)/g)) if (indice.has(m[1].trim())) out.add(m[1].trim());
  return out;
}

/** Erros das magias de um registro, conferidas contra o texto, o índice e os recursos efetivos (próprios ou do pai). */
function verificarMagias(magias, onde, texto, recursos, indice, partes = {}) {
  if (!Array.isArray(magias)) return [`${onde}: magias tem de ser lista`];
  const e = [];
  const italicos = magiasEmItalico(texto, indice);
  const nomes = new Set();
  for (const m of magias) {
    if (m === null || typeof m !== 'object' || Array.isArray(m)) { e.push(`${onde}: magia tem de ser objeto`); continue; }
    const om = `${onde}: magia "${m.nome}"`;
    e.push(...chavesDesconhecidas(m, ['nome', 'custo', 'conjuracao'], om));
    if (nomes.has(m.nome)) e.push(`${om} repetida`); else nomes.add(m.nome);
    if (!indice.has(m.nome)) { e.push(`${om} não existe no índice de magias`); continue; }
    if (!italicos.has(m.nome)) e.push(`${om}: "${m.nome}" não aparece em itálico no texto do item`);
    e.push(...verificarCusto(m.custo, om, texto, recursos, indice.get(m.nome), m.nome, partes));
    e.push(...verificarConjuracao(m.conjuracao, om, texto));
  }
  return e;
}

/**
 * Se a magia não tem custo em cargas pelo texto: há ao menos uma frase da descrição que a cita em
 * itálico (*Nome*), nenhuma dessas frases menciona "carga", nada antes da primeira citação da magia
 * menciona "carga" (o custo de uma frase anterior valeria para a lista que a segue) e a magia não
 * aparece em nenhuma célula de tabela do item (tabela de custo). Células de tabela nunca contam como frase.
 */
function frasesDaMagiaSemCarga(nome, { descricao = '', celulas = '' } = {}) {
  const marca = `*${nome}*`;
  if (celulas.includes(marca)) return false;
  const antes = descricao.slice(0, Math.max(descricao.indexOf(marca), 0));
  if (/carga/i.test(antes)) return false;
  const frases = descricao.split(/(?<=[.!?])\s+|\n+/).filter((f) => f.includes(marca));
  return frases.length > 0 && frases.every((f) => !/carga/i.test(f));
}

/** Erros do custo de uma magia de item. */
function verificarCusto(c, om, texto, recursos, circuloMagia, nome, partes = {}) {
  const e = [];
  if (c === 'livre') {
    if (recursos?.cargas && !/0 carga|sem gastar/i.test(texto) && !frasesDaMagiaSemCarga(nome, partes)) e.push(`${om}: custo "livre" em item com cargas sem "0 carga"/"sem gastar" no texto`);
    return e;
  }
  if (c === null || typeof c !== 'object' || Array.isArray(c)) return [`${om}: custo inválido`];
  if ('uso' in c) {
    e.push(...chavesDesconhecidas(c, ['uso', 'circulo'], `${om}: custo`));
    if (!(recursos?.usos || []).some((u) => u.nome === c.uso)) e.push(`${om}: uso "${c.uso}" não existe em recursos.usos`);
    if (c.circulo !== undefined) e.push(...verificarCirculo(c.circulo, om, texto, circuloMagia));
    return e;
  }
  e.push(...chavesDesconhecidas(c, ['cargas', 'cargas_max', 'circulo'], `${om}: custo`));
  if (!Number.isInteger(c.cargas) || c.cargas < 0) return [...e, `${om}: custo inválido`];
  if (!recursos?.cargas) return [...e, `${om}: custo em cargas sem recursos.cargas no item`];
  const max = recursos.cargas.max;
  for (const [campo, n] of [['cargas', c.cargas], ['cargas_max', c.cargas_max]]) {
    if (n === undefined) continue;
    if (n > max) e.push(`${om}: ${campo} ${n} acima do máximo ${max}`);
    else if (!numeroNoTexto(n, texto)) e.push(`${om}: ${campo} ${n} não aparece no texto do item`);
  }
  if (c.cargas_max !== undefined) {
    if (!Number.isInteger(c.cargas_max) || c.cargas_max <= c.cargas) e.push(`${om}: cargas_max ${c.cargas_max} tem de ser maior que cargas ${c.cargas}`);
    if (c.circulo !== undefined) e.push(`${om}: cargas_max e circulo não combinam`);
  }
  if (c.circulo !== undefined) e.push(...verificarCirculo(c.circulo, om, texto, circuloMagia));
  return e;
}

/** Erros do círculo de conjuração (custo em cargas ou em uso): inteiro >= círculo da magia e "Kº círculo" no texto. */
function verificarCirculo(circulo, om, texto, circuloMagia) {
  if (!Number.isInteger(circulo) || circulo < circuloMagia) return [`${om}: circulo ${circulo} menor que o da magia (${circuloMagia})`];
  if (!texto.includes(`${circulo}º círculo`)) return [`${om}: circulo ${circulo} não aparece como "${circulo}º círculo" no texto`];
  return [];
}

/** Erros da conjuração (CD/ataque) de uma magia de item. */
function verificarConjuracao(cj, om, texto) {
  if (cj === null) return [];
  if (cj === 'sua') return RE_CONJURACAO_SUA.test(texto) ? [] : [`${om}: conjuracao "sua" sem a frase da CD/modificador do personagem no texto`];
  if (typeof cj !== 'object' || Array.isArray(cj)) return [`${om}: conjuracao inválida`];
  const e = chavesDesconhecidas(cj, ['cd', 'ataque'], `${om}: conjuracao`);
  if (cj.cd === undefined && cj.ataque === undefined) e.push(`${om}: conjuracao precisa de cd ou ataque`);
  if (cj.cd !== undefined && !(Number.isInteger(cj.cd) && new RegExp(`(?<!\\d)CD ${cj.cd}(?!\\d)`).test(texto)))e.push(`${om}: cd ${cj.cd} não aparece como "CD ${cj.cd}" no texto`);
  if (cj.ataque !== undefined && !(Number.isInteger(cj.ataque) && new RegExp(`(?<!\\d)\\+${cj.ataque}(?!\\d)`).test(texto)))e.push(`${om}: ataque ${cj.ataque} não aparece como "+${cj.ataque}" no texto`);
  return e;
}

// Chaves aceitas por alvo passivo; qualquer outra (inclusive opcional digitada errado) é erro.
const CHAVES_PASSIVO = {
  resistencia: ['alvo', 'tipo_dano', 'escolha'],
  imunidade: ['alvo', 'tipo_dano'],
  imunidade_condicao: ['alvo', 'condicao'],
  deslocamento: ['alvo', 'modo', 'metros', 'igual_deslocamento', 'pairar'],
  deslocamento_minimo: ['alvo', 'metros'],
  sentido: ['alvo', 'sentido', 'metros', 'soma_se_tiver'],
  vantagem: ['alvo', 'em', 'pericia', 'atributo', 'contexto'],
};

/** Erros de um efeito passivo (defesa, deslocamento, sentido ou vantagem) conferido contra o texto. */
function verificarPassivo(ef, onde, texto) {
  const e = chavesDesconhecidas(ef, CHAVES_PASSIVO[ef.alvo] || [], onde);
  // imunidade_condicao usa "condicao" como campo próprio; nenhum alvo novo aceita "valor".
  for (const k of ['valor', 'condicao']) if (k in ef && !(k === 'condicao' && ef.alvo === 'imunidade_condicao')) e.push(`${onde}: ${ef.alvo} não aceita "${k}"`);
  const conferirTipo = (t, campo) => {
    if (!TIPOS_DANO.includes(t)) e.push(`${onde}: ${campo} "${t}" fora de ${TIPOS_DANO.join('/')}`);
    else if (!palavraNoTexto(t, texto)) e.push(`${onde}: ${campo} "${t}" não aparece no texto do item`);
  };
  if (ef.alvo === 'resistencia' || ef.alvo === 'imunidade') {
    const temEscolha = ef.escolha !== undefined;
    if (ef.alvo === 'imunidade' && temEscolha) e.push(`${onde}: imunidade não aceita escolha`);
    if ((ef.tipo_dano !== undefined) === temEscolha) e.push(`${onde}: ${ef.alvo} precisa de exatamente um entre tipo_dano e escolha`);
    if (ef.tipo_dano !== undefined) conferirTipo(ef.tipo_dano, 'tipo_dano');
    if (temEscolha) {
      if (!Array.isArray(ef.escolha) || ef.escolha.length < 2) e.push(`${onde}: escolha precisa de pelo menos 2 tipos`);
      else for (const t of ef.escolha) { if (!TIPOS_DANO.includes(t)) e.push(`${onde}: escolha "${t}" fora de ${TIPOS_DANO.join('/')}`); else if (!palavraNoTexto(t, texto)) e.push(`${onde}: escolha "${t}" não aparece no texto do item`); }
    }
  } else if (ef.alvo === 'imunidade_condicao') {
    if (!CONDICOES.includes(ef.condicao)) e.push(`${onde}: condicao "${ef.condicao}" fora de ${CONDICOES.join('/')}`);
    else if (!palavraNoTexto(ef.condicao, texto)) e.push(`${onde}: condicao "${ef.condicao}" não aparece no texto do item`);
  } else if (ef.alvo === 'deslocamento') {
    const nome = MODOS_DESLOCAMENTO[ef.modo];
    if (!nome) e.push(`${onde}: modo "${ef.modo}" fora de ${Object.keys(MODOS_DESLOCAMENTO).join('/')}`);
    else if (!texto.includes(`Deslocamento de ${nome}`)) e.push(`${onde}: "Deslocamento de ${nome}" não aparece no texto do item`);
    if ((ef.metros !== undefined) === (ef.igual_deslocamento === true)) e.push(`${onde}: deslocamento precisa de exatamente um entre metros e igual_deslocamento`);
    if (ef.igual_deslocamento === true && !/igua(l|is) ao seu Deslocamento/.test(texto)) e.push(`${onde}: igual_deslocamento sem "igual ao seu Deslocamento" no texto`);
    if (ef.pairar !== undefined && !(ef.pairar === true && /pairar/i.test(texto))) e.push(`${onde}: pairar sem "pairar" no texto`);
  } else if (ef.alvo === 'deslocamento_minimo') {
    if (!/a menos que seu Deslocamento seja maior/.test(texto)) e.push(`${onde}: deslocamento_minimo sem "a menos que seu Deslocamento seja maior" no texto`);
  } else if (ef.alvo === 'sentido') {
    const nome = SENTIDOS[ef.sentido];
    if (!nome) e.push(`${onde}: sentido "${ef.sentido}" fora de ${Object.keys(SENTIDOS).join('/')}`);
    else if (!palavraNoTexto(nome, texto)) e.push(`${onde}: "${nome}" não aparece no texto do item`);
    if (ef.soma_se_tiver !== undefined) {
      if (ef.sentido !== 'visao_no_escuro') e.push(`${onde}: soma_se_tiver só vale em visao_no_escuro`);
      else if (!/Se você já tiver Visão no Escuro/.test(texto)) e.push(`${onde}: soma_se_tiver sem "Se você já tiver Visão no Escuro" no texto`);
      else if (!metrosNoTexto(ef.soma_se_tiver, texto)) e.push(`${onde}: soma_se_tiver ${ef.soma_se_tiver} não aparece como "${ef.soma_se_tiver} metros"`);
    }
  }
  if (ef.alvo === 'vantagem') {
    if (!EM_VANTAGEM.includes(ef.em)) e.push(`${onde}: em "${ef.em}" fora de ${EM_VANTAGEM.join('/')}`);
    if (!/Vantagem/.test(texto)) e.push(`${onde}: vantagem sem "Vantagem" no texto`);
    if (ef.em === 'pericia') {
      if (ef.pericia === undefined) e.push(`${onde}: vantagem em pericia exige "pericia"`);
      else if (!PERICIAS.includes(ef.pericia)) e.push(`${onde}: pericia "${ef.pericia}" fora de ${PERICIAS.join('/')}`);
      else if (!palavraNoTexto(ef.pericia, texto)) e.push(`${onde}: pericia "${ef.pericia}" não aparece no texto do item`);
    } else if (ef.pericia !== undefined) e.push(`${onde}: "pericia" só vale em em="pericia"`);
    if (ef.atributo !== undefined) {
      if (ef.em !== 'salvaguarda') e.push(`${onde}: "atributo" só vale em em="salvaguarda"`);
      else if (!ATRIBUTOS_EXTENSO.includes(ef.atributo)) e.push(`${onde}: atributo "${ef.atributo}" fora de ${ATRIBUTOS_EXTENSO.join('/')}`);
      else if (!palavraNoTexto(ef.atributo, texto)) e.push(`${onde}: atributo "${ef.atributo}" não aparece no texto do item`);
    }
    if (ef.em === 'iniciativa' && !/Iniciativa/.test(texto)) e.push(`${onde}: vantagem em iniciativa sem "Iniciativa" no texto`);
    if (ef.em === 'salvaguarda' && !/salvaguarda/i.test(texto)) e.push(`${onde}: vantagem em salvaguarda sem "salvaguarda" no texto`);
    if (ef.contexto !== undefined && !(typeof ef.contexto === 'string' && ef.contexto && texto.replace(/\*/g, '').includes(ef.contexto))) e.push(`${onde}: contexto "${ef.contexto}" não aparece literalmente no texto do item`);
  }
  // metros: deslocamento (quando fixo), deslocamento_minimo e sentido; vantagem não usa metros.
  if (ef.alvo !== 'vantagem' && ef.metros !== undefined || ['deslocamento_minimo', 'sentido'].includes(ef.alvo)) {
    if (!Number.isInteger(ef.metros) || ef.metros < 1) e.push(`${onde}: metros ${ef.metros} inválido`);
    else if (!metrosNoTexto(ef.metros, texto)) e.push(`${onde}: metros ${ef.metros} não aparece como "${ef.metros} metros" no texto`);
  }
  return e;
}

// Nome por extenso de cada chave de atributo (o texto do livro usa o extenso), derivado de ATRIBUTOS/ATRIBUTOS_EXTENSO.
const ATRIBUTO_EXTENSO = Object.fromEntries(ATRIBUTOS.map((k, i) => [k, ATRIBUTOS_EXTENSO[i]]));
// Frase de aumento com teto, para a completude: "aumenta em N, até um máximo de M".
// "valor de …" cobre "Um valor de atributo à sua escolha" e "O valor de Força concedido pelo seu Cinturão…".
// A segunda forma cobre "Você pode aumentar um dos seus valores de atributo em N, até um máximo de M" e "Aumente um dos seus valores de atributo em N, …".
export const RE_AUMENTO_TETO =/(Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma|valor de [^.]*?) aumenta em \d+, até (um|o) máximo de \d+|[Aa]ument(ar|e) [^.]*?valores? de atributo em \d+, até (um|o) máximo de \d+/;

/** Erros comuns de atributo/valor/máximo de um aumento conferidos contra o texto. */
function verificarAumentoBase(obj, onde, texto, { permiteEscolha }) {
  const e = [];
  if (obj.atributo === 'escolha') {
    if (!permiteEscolha) e.push(`${onde}: "escolha" só vale em aumento_permanente`);
    else if (!/à sua escolha/.test(texto)) e.push(`${onde}: escolha sem "à sua escolha" no texto`);
  } else if (!ATRIBUTO_EXTENSO[obj.atributo]) {
    e.push(`${onde}: atributo "${obj.atributo}" fora de ${Object.keys(ATRIBUTO_EXTENSO).join('/')}`);
  } else if (!palavraNoTexto(ATRIBUTO_EXTENSO[obj.atributo], texto)) {
    e.push(`${onde}: atributo "${obj.atributo}" (${ATRIBUTO_EXTENSO[obj.atributo]}) não aparece no texto do item`);
  }
  if (!Number.isInteger(obj.valor) || obj.valor < 1 || obj.valor > 4) e.push(`${onde}: valor ${obj.valor} fora de 1..4`);
  else if (!new RegExp(`aumenta em ${obj.valor}(?!\\d)`).test(texto)) e.push(`${onde}: "aumenta em ${obj.valor}" não aparece no texto do item`);
  if (!Number.isInteger(obj.maximo) || obj.maximo < 20 || obj.maximo > 30) e.push(`${onde}: maximo ${obj.maximo} fora de 20..30`);
  else if (!new RegExp(`máximo de ${obj.maximo}(?!\\d)`).test(texto)) e.push(`${onde}: "máximo de ${obj.maximo}" não aparece no texto do item`);
  return e;
}

/** Erros de um efeito atributo_bonus / atributo_minimo_bonus. */
function verificarAumentoEfeito(ef, onde, texto) {
  const e = chavesDesconhecidas(ef, ['alvo', 'atributo', 'valor', 'maximo'], onde);
  e.push(...verificarAumentoBase(ef, onde, texto, { permiteEscolha: false }));
  if (ef.alvo === 'atributo_minimo_bonus' && !/Cinturão de Força do Gigante|Manoplas de Poder do Ogro/.test(texto)) {
    e.push(`${onde}: atributo_minimo_bonus exige "Cinturão de Força do Gigante" ou "Manoplas de Poder do Ogro" no texto`);
  }
  return e;
}

/** Erros do campo aumento_permanente de um registro. */
function verificarAumentoPermanente(ap, onde, texto) {
  if (ap === null) return [];
  if (typeof ap !== 'object' || Array.isArray(ap)) return [`${onde}: aumento_permanente tem de ser objeto ou null`];
  const o = `${onde}: aumento_permanente`;
  const e = chavesDesconhecidas(ap, ['atributo', 'valor', 'maximo', 'reducao'], o);
  e.push(...verificarAumentoBase(ap, o, texto, { permiteEscolha: true }));
  if (ap.reducao !== undefined) {
    const r = ap.reducao;
    if (r === null || typeof r !== 'object') return [...e, `${o}: reducao tem de ser objeto`];
    e.push(...chavesDesconhecidas(r, ['valor', 'minimo'], `${o}.reducao`));
    if (!Number.isInteger(r.valor) || r.valor < 1 || r.valor > 4) e.push(`${o}: reducao.valor ${r.valor} fora de 1..4`);
    else if (!new RegExp(`diminui em ${r.valor}(?!\\d)`).test(texto)) e.push(`${o}: reducao sem "diminui em ${r.valor}" no texto`);
    if (!Number.isInteger(r.minimo) || r.minimo < 1 || r.minimo > 10) e.push(`${o}: reducao.minimo ${r.minimo} fora de 1..10`);
    else if (!new RegExp(`mínimo de ${r.minimo}(?!\\d)`).test(texto)) e.push(`${o}: "mínimo de ${r.minimo}" não aparece no texto do item`);
  }
  return e;
}

/** Erros de um efeito: alvo, forma, faixa, condição e presença do número no texto do registro. */
function verificarEfeito(ef, onde, texto, baseTipo) {
  const e = [];
  if (!ALVOS.includes(ef?.alvo)) return [`${onde}: alvo "${ef?.alvo}" fora de ${ALVOS.join('/')}`];
  if (ALVOS_AUMENTO.includes(ef.alvo)) return verificarAumentoEfeito(ef, onde, texto);
  if (ALVOS_PASSIVOS.includes(ef.alvo)) return verificarPassivo(ef, onde, texto);
  if (ef.condicao !== undefined && !CONDICOES_ARMADURA.includes(ef.condicao)) e.push(`${onde}: condição "${ef.condicao}" fora de ${CONDICOES_ARMADURA.join('/')}`);
  if (ef.condicao !== undefined && ALVOS_DA_ARMA.includes(ef.alvo)) e.push(`${onde}: ${ef.alvo} não aceita condição`);
  if (ALVOS_DA_ARMA.includes(ef.alvo) && baseTipo !== 'arma') e.push(`${onde}: ${ef.alvo} exige base.tipo "arma" no item`);
  if (ef.alvo === 'atributo') {
    if (!ATRIBUTOS.includes(ef.atributo)) e.push(`${onde}: atributo "${ef.atributo}" fora de ${ATRIBUTOS.join('/')}`);
    if (!Number.isInteger(ef.minimo) || ef.minimo < FAIXA_MINIMO[0] || ef.minimo > FAIXA_MINIMO[1]) e.push(`${onde}: minimo ${ef.minimo} fora de ${FAIXA_MINIMO.join('..')}`);
    else if (!numeroNoTexto(ef.minimo, texto)) e.push(`${onde}: minimo ${ef.minimo} não aparece no texto do item`);
    if (ef.valor !== undefined) e.push(`${onde}: atributo usa "minimo", não "valor"`);
    return e;
  }
  const [min, max] = FAIXA_VALOR[ef.alvo] || FAIXA_VALOR.padrao;
  if (!Number.isInteger(ef.valor) || ef.valor < min || ef.valor > max) e.push(`${onde}: valor ${ef.valor} fora de ${min}..${max}`);
  else if (!numeroNoTexto(ef.valor, texto)) e.push(`${onde}: valor ${ef.valor} não aparece no texto do item`);
  return e;
}

/** Erros da base (arma/armadura/escudo escolhida no catálogo ao adicionar o item). */
function verificarBase(base, onde, catalogos) {
  const e = [];
  if (!TIPOS_BASE.includes(base?.tipo)) return [`${onde}: base.tipo "${base?.tipo}" fora de ${TIPOS_BASE.join('/')}`];
  // sem_penalidades: opcional, booleano, só para armadura (zera Furtividade e requisito de Força do item montado).
  if (base.sem_penalidades !== undefined && (typeof base.sem_penalidades !== 'boolean' || base.tipo !== 'armadura')) e.push(`${onde}: base.sem_penalidades só vale como booleano em base.tipo "armadura"`);
  if (base.tipo === 'escudo') {
    if (base.opcoes || base.categorias || base.excluir) e.push(`${onde}: base escudo não leva opcoes/categorias/excluir`);
    return e;
  }
  const lista = base.tipo === 'arma' ? catalogos.armas : catalogos.armaduras.filter((a) => a.categoria !== 'Escudo');
  const nomes = new Set(lista.map((a) => a.nome));
  const categoriasValidas = base.tipo === 'arma' ? [...new Set(catalogos.armas.map((a) => a.categoria))] : CATEGORIAS_ARMADURA;
  const temOpcoes = Array.isArray(base.opcoes) && base.opcoes.length > 0;
  const temCategorias = Array.isArray(base.categorias) && base.categorias.length > 0;
  if (temOpcoes === temCategorias) e.push(`${onde}: base precisa de exatamente um entre opcoes e categorias`);
  for (const n of base.opcoes || []) if (!nomes.has(n)) e.push(`${onde}: opção "${n}" não existe no catálogo de ${base.tipo}s`);
  for (const c of base.categorias || []) if (!categoriasValidas.includes(c)) e.push(`${onde}: categoria "${c}" fora de ${categoriasValidas.join('/')}`);
  for (const n of base.excluir || []) if (!nomes.has(n)) e.push(`${onde}: excluir "${n}" não existe no catálogo de ${base.tipo}s`);
  return e;
}

/**
 * Confere a mecânica contra os lotes e o catálogo. completo=true exige que
 * todo registro dos lotes considerados esteja classificado; soLote limita a
 * checagem a um lote (e ativa a completude dele).
 */
export function verificarMecanica(mec, lotes, catalogos, { completo = false, soLote = null } = {}) {
  const erros = [];
  const registros = registrosDosLotes(lotes);
  const porId = new Map(registros.map((r) => [r.id, r]));
  const vistos = new Map();
  const arquivos = soLote ? mec.arquivos.filter((a) => a.lote === soLote) : mec.arquivos;
  if (soLote && !arquivos.length) return [`_mecanica/lote-${soLote}.json não existe`];

  for (const a of arquivos) {
    const esperado = `lote-${a.lote}.json`;
    if (a._arquivo && a._arquivo !== esperado) erros.push(`${a._arquivo}: campo lote "${a.lote}" não bate com o nome do arquivo`);
    const marcar = (id, onde) => {
      if (vistos.has(id)) erros.push(`${onde}: "${id}" duplicado (já em ${vistos.get(id)})`);
      else vistos.set(id, onde);
      const r = porId.get(id);
      if (!r) erros.push(`${onde}: "${id}" não é registro de nenhum lote`);
      else if (r.lote !== a.lote) erros.push(`${onde}: "${id}" não é registro do lote ${a.lote} (é do ${r.lote})`);
      return r;
    };
    for (const [id, entrada] of Object.entries(a.itens || {})) {
      const onde = `${a._arquivo} itens["${id}"]`;
      const r = marcar(id, onde);
      if (!Array.isArray(entrada?.efeitos)) { erros.push(`${onde}: "efeitos" tem de ser uma lista`); continue; }
      if (entrada.base !== undefined) {
        if (r?.pai) erros.push(`${onde}: base fica no item "${r.pai}", não na variante`);
        erros.push(...verificarBase(entrada.base, onde, catalogos));
      }
      if (entrada.recursos !== undefined) erros.push(...verificarRecursos(entrada.recursos, onde, r?.texto || ''));
      if (entrada.magias !== undefined) erros.push(...verificarMagias(entrada.magias, onde, r?.texto || '', entrada.recursos ?? (r?.pai ? a.itens?.[r.pai]?.recursos : undefined), catalogos.magias ?? new Map(), r));
      if (entrada.aumento_permanente !== undefined) erros.push(...verificarAumentoPermanente(entrada.aumento_permanente, onde, r?.texto || ''));
      if (!entrada.efeitos.length && entrada.base === undefined && !entrada.recursos && !entrada.magias?.length && !entrada.aumento_permanente) erros.push(`${onde}: sem efeitos, sem base, sem recursos e sem magias -- use sem_efeito_automatico`);
      const baseTipo = entrada.base?.tipo ?? (r?.pai ? (a.itens?.[r.pai]?.base?.tipo) : undefined);
      entrada.efeitos.forEach((ef, k) => erros.push(...verificarEfeito(ef, `${onde}.efeitos[${k}]`, r?.texto || '', baseTipo)));
    }
    for (const id of a.sem_efeito_automatico || []) marcar(id, `${a._arquivo} sem_efeito_automatico`);
    for (const [id, motivo] of Object.entries(a.sem_cargas || {})) {
      const onde = `${a._arquivo} sem_cargas["${id}"]`;
      if (!motivo) erros.push(`${onde}: sem motivo`);
      const r = porId.get(id);
      if (!r) erros.push(`${onde}: "${id}" não é registro de nenhum lote`);
      else if (r.lote !== a.lote) erros.push(`${onde}: "${id}" não é registro do lote ${a.lote} (é do ${r.lote})`);
    }
    for (const [id, motivo] of Object.entries(a.sem_magias || {})) {
      const onde = `${a._arquivo} sem_magias["${id}"]`;
      if (!motivo) erros.push(`${onde}: sem motivo`);
      const r = porId.get(id);
      if (!r) erros.push(`${onde}: "${id}" não é registro de nenhum lote`);
      else if (r.lote !== a.lote) erros.push(`${onde}: "${id}" não é registro do lote ${a.lote} (é do ${r.lote})`);
    }
    for (const [id, motivo] of Object.entries(a.sem_passivos || {})) {
      const onde = `${a._arquivo} sem_passivos["${id}"]`;
      if (!motivo) erros.push(`${onde}: sem motivo`);
      const r = porId.get(id);
      if (!r) erros.push(`${onde}: "${id}" não é registro de nenhum lote`);
      else if (r.lote !== a.lote) erros.push(`${onde}: "${id}" não é registro do lote ${a.lote} (é do ${r.lote})`);
    }
    for (const [id, motivo] of Object.entries(a.sem_aumento || {})) {
      const onde = `${a._arquivo} sem_aumento["${id}"]`;
      if (!motivo) erros.push(`${onde}: sem motivo`);
      const r = porId.get(id);
      if (!r) erros.push(`${onde}: "${id}" não é registro de nenhum lote`);
      else if (r.lote !== a.lote) erros.push(`${onde}: "${id}" não é registro do lote ${a.lote} (é do ${r.lote})`);
    }
  }

  if (completo || soLote) {
    const lotesAlvo = new Set(soLote ? [soLote] : registros.map((r) => r.lote));
    for (const r of registros) {
      if (lotesAlvo.has(r.lote) && !vistos.has(r.id)) erros.push(`"${r.id}" (lote ${r.lote}) sem classificação: falta em itens e em sem_efeito_automatico`);
    }
    // Completude de cargas: registro que cita "cargas" tem recursos.cargas ou sem_cargas com motivo (o item-pai vale para a variante).
    const comCargas = new Set();
    for (const a of mec.arquivos) {
      for (const [id, entrada] of Object.entries(a.itens || {})) if (entrada?.recursos?.cargas) comCargas.add(id);
      for (const id of Object.keys(a.sem_cargas || {})) comCargas.add(id);
    }
    for (const r of registros) {
      if (!lotesAlvo.has(r.lote) || !/\bcargas?\b/i.test(r.texto)) continue;
      if (comCargas.has(r.id) || (r.pai && comCargas.has(r.pai))) continue;
      erros.push(`"${r.id}" (lote ${r.lote}) cita "cargas" e não tem recursos.cargas nem sem_cargas`);
    }
    // Completude de magias: registro que conjura magia do índice (em itálico) tem magias ou sem_magias (o pai vale para a variante).
    const indice = catalogos.magias ?? new Map();
    const comMagias = new Set();
    const semMagias = new Set();
    for (const a of mec.arquivos) {
      for (const [id, entrada] of Object.entries(a.itens || {})) if (entrada?.magias?.length) comMagias.add(id);
      for (const id of Object.keys(a.sem_magias || {})) { comMagias.add(id); semMagias.add(id); }
    }
    for (const r of registros) {
      if (!lotesAlvo.has(r.lote) || !/conjur/i.test(r.texto) || !magiasEmItalico(r.texto, indice).size) continue;
      if (comMagias.has(r.id) || (r.pai && comMagias.has(r.pai))) continue;
      erros.push(`"${r.id}" (lote ${r.lote}) conjura magia do Livro do Jogador e não tem magias nem sem_magias`);
    }
    // Magia não nomeada ("Magia Desconhecida", magia vinculada, à sua escolha): não cabe em `magias`; exige sem_magias com motivo (o pai vale para a variante).
    for (const r of registros) {
      if (!lotesAlvo.has(r.lote) || !RE_MAGIA_NAO_NOMEADA.test(r.texto)) continue;
      if (semMagias.has(r.id) || (r.pai && semMagias.has(r.pai))) continue;
      erros.push(`"${r.id}" (lote ${r.lote}) cita magia não nomeada e não tem sem_magias (Magia Desconhecida, vinculada ou à sua escolha)`);
    }
    // Completude de passivos: registro com frase de defesa/deslocamento/sentido/vantagem tem efeito passivo ou sem_passivos (o pai vale para a variante).
    const comPassivos = new Set();
    for (const a of mec.arquivos) {
      for (const [id, entrada] of Object.entries(a.itens || {})) if ((Array.isArray(entrada?.efeitos) ? entrada.efeitos : []).some((ef) => ALVOS_PASSIVOS.includes(ef?.alvo))) comPassivos.add(id);
      for (const id of Object.keys(a.sem_passivos || {})) comPassivos.add(id);
    }
    for (const r of registros) {
      if (!lotesAlvo.has(r.lote) || !RE_PASSIVO.test(r.texto)) continue;
      if (comPassivos.has(r.id) || (r.pai && comPassivos.has(r.pai))) continue;
      erros.push(`"${r.id}" (lote ${r.lote}) tem efeito passivo de defesa, deslocamento, sentido ou vantagem e não tem efeito nem sem_passivos`);
    }
    // Completude de aumentos: registro com "aumenta em N, até um máximo de M" tem efeito de aumento, aumento_permanente ou sem_aumento (o pai vale para a variante).
    const comAumento = new Set();
    for (const a of mec.arquivos) {
      for (const [id, entrada] of Object.entries(a.itens || {})) if (entrada?.aumento_permanente || (Array.isArray(entrada?.efeitos) ? entrada.efeitos : []).some((ef) => ALVOS_AUMENTO.includes(ef?.alvo))) comAumento.add(id);
      for (const id of Object.keys(a.sem_aumento || {})) comAumento.add(id);
    }
    for (const r of registros) {
      if (!lotesAlvo.has(r.lote) || !RE_AUMENTO_TETO.test(r.texto)) continue;
      if (comAumento.has(r.id) || (r.pai && comAumento.has(r.pai))) continue;
      erros.push(`"${r.id}" (lote ${r.lote}) aumenta um atributo até um máximo e não tem atributo_bonus, atributo_minimo_bonus, aumento_permanente nem sem_aumento`);
    }
  }
  return erros;
}

/** Contagem de efeitos por alvo e de registros classificados, para o relatório da curadoria. */
function censo(mec) {
  const porAlvo = {};
  let comEfeito = 0; let comBase = 0; let sem = 0;
  for (const a of mec.arquivos) {
    for (const entrada of Object.values(a.itens || {})) {
      if (entrada.efeitos?.length) comEfeito++;
      if (entrada.base) comBase++;
      for (const ef of entrada.efeitos || []) porAlvo[ef.alvo] = (porAlvo[ef.alvo] || 0) + 1;
    }
    sem += (a.sem_efeito_automatico || []).length;
  }
  return { comEfeito, comBase, sem, porAlvo };
}

/** CLI: verificar [--lote NN]. Sem --lote, exige a classificação completa. */
function principal(args) {
  if (args[0] !== 'verificar') { console.log('uso: node scripts/livro-do-mestre/mecanica.mjs verificar [--lote NN]'); return 2; }
  const k = args.indexOf('--lote');
  const soLote = k >= 0 ? args[k + 1] : null;
  if (k >= 0 && !/^\d{2}$/.test(soLote || '')) { console.log('--lote exige dois dígitos (ex.: --lote 01)'); return 2; }
  const mec = carregarMecanica();
  const erros = verificarMecanica(mec, carregarLotes(), carregarCatalogos(), { completo: !soLote, soLote });
  for (const e of erros) console.log(`ERRO: ${e}`);
  console.log(JSON.stringify(censo(mec)));
  console.log(`${erros.length} erro(s), ${mec.arquivos.length} arquivo(s) de mecânica`);
  return erros.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = principal(process.argv.slice(2));
}
