// ============================================================
// Carregador de dados JSON (acessa ../dados/)
// Cache em memória para evitar re-fetch
// ============================================================

// Caminho base para os arquivos de dados.
// No deploy (GitHub Pages), o workflow substitui '../dados' por './dados' via sed.
const BASE_PATH = '../dados';
const cache = {};

import { CLASSES_INFO } from './dados-classes.js';

/** Nome de arquivo sem acento, no padrão dos outros carregadores ("Artífice" -> "artifice"). */
function semAcentoArquivo(nome) {
  return String(nome).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Pasta dos dados de uma classe de expansão ("tasha/artifice"), ou null para as do Livro do Jogador. */
function pastaDaExpansao(nomeClasse) {
  const fonte = CLASSES_INFO[nomeClasse]?.fonte;
  return fonte ? `${fonte}/${semAcentoArquivo(nomeClasse)}` : null;
}

/** Classes de expansão conhecidas, com a pasta de cada uma. */
function classesDeExpansao() {
  return Object.keys(CLASSES_INFO).filter((c) => CLASSES_INFO[c].fonte).map((c) => ({ classe: c, pasta: pastaDaExpansao(c) }));
}

/**
 * Busca um JSON com cache em memória. Guarda a promessa em andamento:
 * chamadas sobrepostas recebem o mesmo objeto. Falha (null) sai do cache.
 */
function fetchJSON(caminho) {
  if (cache[caminho]) return cache[caminho];
  const promessa = carregarJSON(caminho).then((dados) => {
    if (dados === null && cache[caminho] === promessa) delete cache[caminho];
    return dados;
  });
  cache[caminho] = promessa;
  return promessa;
}

/** Faz o fetch de um JSON de dados/; devolve null em caso de erro. */
async function carregarJSON(caminho) {
  try {
    const resp = await fetch(`${BASE_PATH}/${caminho}`, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`Erro ${resp.status}: ${caminho}`);
    return await resp.json();
  } catch (err) {
    console.error(`Erro ao carregar ${caminho}:`, err);
    return null;
  }
}

// --- Classes ---

// Subclasses de livros de expansão que entram numa classe do Livro do Jogador,
// juntadas depois das subclasses dela (cada subclasse traz o campo `fonte`).
const SUBCLASSES_DE_EXPANSAO = { 'Mago': ['arcana-unleashed/subclasses_mago.json'] };
const _classesComExpansao = {};

/**
 * Devolve os dados da classe com as subclasses de expansão somadas, sem
 * mutar o JSON em cache. Expansão que falha deixa a classe do jeito que veio
 * e não entra em cache, para nova tentativa na próxima chamada.
 * @param {string} nome Nome da classe.
 * @param {object} dados Dados da classe no Livro do Jogador.
 * @returns {Promise<object>} Dados da classe com as subclasses de expansão.
 */
async function juntarSubclassesDeExpansao(nome, dados) {
  const arquivos = SUBCLASSES_DE_EXPANSAO[nome];
  if (!arquivos) return dados;
  if (_classesComExpansao[nome]?.base === dados) return _classesComExpansao[nome].junto;
  const expansoes = await Promise.all(arquivos.map(fetchJSON));
  if (expansoes.some((e) => !e)) return dados;
  const junto = { ...dados, subclasses: [...(dados.subclasses || []), ...expansoes.flatMap((e) => e.subclasses || [])] };
  _classesComExpansao[nome] = { base: dados, junto };
  return junto;
}

/** Carrega dados de uma classe específica (Livro do Jogador ou expansão, pela fonte). */
export async function getClasse(nome) {
  const pasta = pastaDaExpansao(nome);
  if (pasta) return fetchJSON(`${pasta}/classe.json`);
  const nomeArq = nome.toLowerCase()
    .replace(/á/g, 'a').replace(/ã/g, 'a').replace(/é/g, 'e')
    .replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u');
  const dados = await fetchJSON(`classes/${nomeArq}.json`);
  if (!dados) return null;
  return juntarSubclassesDeExpansao(nome, dados);
}

/** Carrega lista de magias de uma classe conjuradora (Livro do Jogador ou expansão). */
export async function getMagiasClasse(nomeClasse) {
  const pasta = pastaDaExpansao(nomeClasse);
  if (pasta) return juntarMagiasDeLivroNaLista(nomeClasse, await fetchJSON(`${pasta}/magias_classe.json`));
  const nomeArq = nomeClasse.toLowerCase()
    .replace(/á/g, 'a').replace(/ã/g, 'a').replace(/é/g, 'e')
    .replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u');
  return juntarMagiasDeLivroNaLista(nomeClasse, await fetchJSON(`classes/magias_${nomeArq}.json`));
}

// --- Origens ---

/** Carrega todos os antecedentes */
export async function getAntecedentes() {
  return fetchJSON('origens/antecedentes.json');
}

// Espécies de livros de expansão, juntadas depois das do Livro do Jogador.
const ESPECIES_DE_EXPANSAO = ['ravenloft/especies.json'];
let _especies = null;

/**
 * Carrega todas as espécies: as do Livro do Jogador seguidas das de
 * expansão (com campo `fonte`). Expansão que falha fica de fora e a
 * lista combinada não entra em cache, para nova tentativa na próxima chamada.
 */
export async function getEspecies() {
  if (!_especies) {
    const carga = Promise.all([fetchJSON('origens/especies.json'), ...ESPECIES_DE_EXPANSAO.map(fetchJSON)])
      .then(([livro, ...expansoes]) => {
        if (!livro || expansoes.some((e) => !e)) { if (_especies === carga) _especies = null; }
        if (!livro) return null;
        const especies = [...(livro.especies || []), ...expansoes.flatMap((e) => e?.especies || [])];
        return { ...livro, total: especies.length, especies };
      });
    _especies = carga;
  }
  return _especies;
}

// --- Talentos ---

/** Carrega todos os talentos */
export async function getTalentos() {
  return fetchJSON('talentos/talentos.json');
}

// --- Equipamento ---

/** Carrega armas */
export async function getArmas() {
  return fetchJSON('equipamento/armas.json');
}

/** Carrega armaduras */
export async function getArmaduras() {
  return fetchJSON('equipamento/armaduras.json');
}

/** Carrega equipamento de aventura */
export async function getEquipamentoAventura() {
  return fetchJSON('equipamento/equipamento_aventura.json');
}

/** Carrega ferramentas */
export async function getFerramentas() {
  return fetchJSON('equipamento/ferramentas.json');
}

let _acervoMesclado = null;

/** Carrega o acervo de itens mágicos (Livro do Mestre, cap. 7) com os itens das expansões. */
export async function getItensMagicos() {
  if (!_acervoMesclado) {
    _acervoMesclado = (async () => {
      const base = await fetchJSON('livro-do-mestre/capitulo7/itens_magicos.json');
      if (!base) return null;
      const extras = [];
      for (const { pasta } of classesDeExpansao()) {
        const d = await fetchJSON(`${pasta}/itens_magicos.json`);
        if (!d) return null;
        for (const i of d?.itens || []) if (!base.itens.some((x) => x.id === i.id)) extras.push(i);
      }
      const itens = [...base.itens, ...extras].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      return { ...base, total_itens: itens.length, itens };
    })().then((r) => {
      if (!r) _acervoMesclado = null;
      return r;
    });
  }
  return _acervoMesclado;
}

/** Planos de Item Mágico do Artífice (por nível mínimo). */
export async function getPlanosArtifice() {
  return fetchJSON('tasha/artifice/planos.json');
}

/** Criaturas do Artífice (Defensor de Aço, Canhão Místico, Servo Homúnculo). */
export async function getCriaturasArtifice() {
  return fetchJSON('tasha/artifice/criaturas.json');
}

/** Carrega o registro de livros de origem (dados/fontes.json). */
export async function getFontes() {
  return fetchJSON('fontes.json');
}

// --- Magias ---

let _expansaoMagias = null;

// Magias de livros de expansão que não pertencem a uma classe de expansão (a lista
// de classes vem no campo `classes` de cada magia).
const MAGIAS_DE_LIVRO = ['arcana-unleashed/magias.json'];

/** Fonte (livro de origem) das magias de expansão já carregadas, por nome. */
const _fonteDasMagias = new Map();

/**
 * Fonte da magia de expansão (ex.: 'arcana-unleashed'), ou undefined para as do
 * Livro do Jogador. Só conhece as magias de expansão que o catálogo já carregou.
 * @param {string} nome Nome da magia.
 */
export function fonteDaMagia(nome) {
  return _fonteDasMagias.get(nome);
}

/** Guarda a fonte de cada magia de expansão carregada. */
function registrarFontesDasMagias(magias) {
  for (const m of magias) if (m.fonte) _fonteDasMagias.set(m.nome, m.fonte);
}

/** Magias de MAGIAS_DE_LIVRO, ou null se algum arquivo falhar. */
async function carregarMagiasDeLivro() {
  const arquivos = await Promise.all(MAGIAS_DE_LIVRO.map(fetchJSON));
  if (arquivos.some((a) => !a)) return null;
  const magias = arquivos.flatMap((a) => a.magias || []);
  registrarFontesDasMagias(magias);
  return magias;
}

/** Listas de classe (formato de getMagiasClasse) que já receberam as magias de livro. */
const _listasComLivro = new WeakSet();

/**
 * Acrescenta à lista de magias da classe (`lista_magias`) as magias de livro de
 * expansão que a classe usa, em ordem alfabética dentro do círculo. A lista é
 * alterada uma vez só; se o livro falhar, devolve a lista como veio e tenta de novo na próxima chamada.
 * @param {string} nomeClasse Nome da classe.
 * @param {object|null} dados Resultado do JSON da lista da classe.
 * @returns {object|null} A mesma lista, com as magias de livro.
 */
async function juntarMagiasDeLivroNaLista(nomeClasse, dados) {
  if (!(dados?.lista_magias || Array.isArray(dados?.magias)) || _listasComLivro.has(dados)) return dados;
  const magias = await carregarMagiasDeLivro();
  if (!magias || _listasComLivro.has(dados)) return dados;
  _listasComLivro.add(dados);
  const dela = magias.filter((x) => (x.classes || []).includes(nomeClasse));
  if (!dados.lista_magias) {
    for (const m of dela) if (!dados.magias.some((x) => x.nome === m.nome)) dados.magias.push({ nome: m.nome, circulo: m.circulo, escola: m.escola, fonte: m.fonte });
    dados.magias.sort((a, b) => a.circulo - b.circulo || a.nome.localeCompare(b.nome, 'pt-BR'));
    dados.total_magias = dados.magias.length;
    return dados;
  }
  for (const m of dela) {
    const chave = m.circulo === 0 ? 'Truques' : `${m.circulo}º Círculo`;
    const lista = dados.lista_magias[chave] || (dados.lista_magias[chave] = []);
    if (lista.some((x) => x.nome === m.nome)) continue;
    lista.push({ nome: m.nome, escola: m.escola, especial: /concentra/i.test(m.duracao) ? 'C' : '—', fonte: m.fonte });
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  return dados;
}

/**
 * Carrega, uma vez, o que as classes de expansão acrescentam ao catálogo
 * de magias: magias novas (magias.json) e o nome da classe para as magias
 * da lista dela (magias_classe.json). Devolve { novas, classesPorMagia }, ou null se algum
 * arquivo falhar (a próxima chamada tenta de novo).
 */
function expansaoMagias() {
  if (!_expansaoMagias) {
    _expansaoMagias = (async () => {
      const novas = [];
      const classesPorMagia = new Map();
      for (const { classe, pasta } of classesDeExpansao()) {
        const [mag, lista] = await Promise.all([fetchJSON(`${pasta}/magias.json`), fetchJSON(`${pasta}/magias_classe.json`)]);
        if (!mag || !lista) return null;
        for (const m of mag?.magias || []) novas.push(m);
        registrarFontesDasMagias(mag?.magias || []);
        for (const m of Object.values(lista?.lista_magias || {}).flat()) {
          if (!classesPorMagia.has(m.nome)) classesPorMagia.set(m.nome, new Set());
          classesPorMagia.get(m.nome).add(classe);
        }
      }
      const deLivro = await carregarMagiasDeLivro();
      if (!deLivro) return null;
      novas.push(...deLivro);
      return { novas, classesPorMagia };
    })().then((r) => {
      if (!r) _expansaoMagias = null;
      return r;
    });
  }
  return _expansaoMagias;
}

/** Acrescenta (sem repetir) as classes de expansão ao campo `classes` de cada magia da lista. */
function acrescentarClasses(magias, classesPorMagia) {
  for (const m of magias) {
    const extras = classesPorMagia.get(m.nome);
    if (!extras) continue;
    m.classes = [...new Set([...(m.classes || []), ...extras])];
  }
}

/** Resumo de magia no formato de _indice.json. */
function resumoMagia(m) {
  const { nome, circulo, escola, classes, tempo_conjuracao, alcance, componentes, duracao, fonte } = m;
  return { nome, circulo, escola, classes, tempo_conjuracao, alcance, componentes, duracao, ...(fonte ? { fonte } : {}) };
}

/** Objetos de dados (índice ou círculo) que já receberam a mescla de expansão. */
const _mesclados = new WeakSet();

/** Carrega índice de todas as magias (resumido), com as magias e classes de expansão mescladas uma vez. */
export async function getIndiceMagias() {
  const dados = await fetchJSON('magias/_indice.json');
  if (!dados || _mesclados.has(dados)) return dados;
  const exp = await expansaoMagias();
  if (!exp || _mesclados.has(dados)) return dados;
  _mesclados.add(dados);
  for (const m of exp.novas) if (!dados.magias.some((x) => x.nome === m.nome)) dados.magias.push(resumoMagia(m));
  acrescentarClasses(dados.magias, exp.classesPorMagia);
  dados.total_magias = dados.magias.length;
  return dados;
}

/** Carrega magias de um círculo específico (com descrição completa), com a expansão mesclada uma vez. */
export async function getMagiasPorCirculo(circulo) {
  const nome = circulo === 0 ? 'truques' : `circulo_${circulo}`;
  const dados = await fetchJSON(`magias/${nome}.json`);
  if (!dados || _mesclados.has(dados)) return dados;
  const exp = await expansaoMagias();
  if (!exp || _mesclados.has(dados)) return dados;
  _mesclados.add(dados);
  for (const m of exp.novas.filter((x) => x.circulo === circulo)) {
    if (!dados.magias.some((x) => x.nome === m.nome)) dados.magias.push(structuredClone(m));
  }
  acrescentarClasses(dados.magias, exp.classesPorMagia);
  dados.total_magias = dados.magias.length;
  return dados;
}

/** Carrega magias de uma classe (lista resumida: nome, circulo, escola). */
export async function getMagiasPorClasseLista(nomeClasse) {
  const pasta = pastaDaExpansao(nomeClasse);
  if (pasta) {
    const dados = await getMagiasClasse(nomeClasse);
    if (!dados) return null;
    const magias = Object.entries(dados.lista_magias || {}).flatMap(([chave, lista]) => {
      const circulo = chave === 'Truques' ? 0 : parseInt(chave, 10);
      return lista.map((m) => ({ nome: m.nome, circulo, escola: m.escola }));
    });
    return { classe: nomeClasse, total_magias: magias.length, magias };
  }
  const nomeArq = nomeClasse.toLowerCase()
    .replace(/á/g, 'a').replace(/ã/g, 'a').replace(/é/g, 'e')
    .replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u');
  return juntarMagiasDeLivroNaLista(nomeClasse, await fetchJSON(`magias/por_classe/${nomeArq}.json`));
}

/**
 * Devolve as magias de um círculo que têm o marcador Ritual, com a magia
 * inteira (descrição, alcance, componentes, duração).
 *
 * O marcador vem de `tempo_conjuracao` -- "1 minuto ou Ritual",
 * "1 ação ou Ritual" etc. É o mesmo critério que o Pacto do Tomo do Bruxo
 * (sheet/classes/bruxo.js) já usava, e é a leitura certa: o campo `ritual`
 * booleano que o Conjurador Ritualista procurava NÃO existe em lugar nenhum
 * do acervo, e por isso a lista dele nascia vazia.
 *
 * A outra fonte possível seria o campo `especial` de
 * `classes/magias_<classe>.json` ('R', e também os combinados 'R, M' e
 * 'C, R'). Conferido: para o 1º círculo as duas fontes dão exatamente as
 * mesmas 11 magias. Esta é preferível por ser um arquivo só, em vez da união
 * das oito listas de classe, e por já trazer a descrição -- os cards mostram
 * "ver detalhes" sem uma segunda busca.
 */
export async function getMagiasRituais(circulo) {
  const dados = await getMagiasPorCirculo(circulo);
  return (dados?.magias || [])
    .filter(m => (m.tempo_conjuracao || '').toLowerCase().includes('ritual'))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Busca uma magia específica pelo nome (carrega o círculo inteiro) */
export async function getMagia(nome, circulo) {
  const dados = await getMagiasPorCirculo(circulo);
  if (!dados) return null;
  return dados.magias.find(m => m.nome === nome) || null;
}

/** Busca magias por nome (busca no índice, retorna matches) */
export async function buscarMagias(termo) {
  const indice = await getIndiceMagias();
  if (!indice) return [];
  const termoNorm = termo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return indice.magias.filter(m => {
    const nomeNorm = m.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return nomeNorm.includes(termoNorm);
  });
}

// --- Apêndices ---

// Criaturas de livros de expansão, juntadas depois das do apêndice do Livro do Jogador.
const CRIATURAS_DE_EXPANSAO = ['monstros/criaturas.json'];
let _criaturas = null;

/**
 * Carrega as criaturas: as do apêndice do Livro do Jogador seguidas das de
 * expansão (com campo `fonte`). Expansão que falha fica de fora e a lista
 * combinada não entra em cache, para nova tentativa na próxima chamada.
 */
export async function getCriaturas() {
  if (!_criaturas) {
    const carga = Promise.all([fetchJSON('apendices/criaturas.json'), ...CRIATURAS_DE_EXPANSAO.map(fetchJSON)])
      .then(([livro, ...expansoes]) => {
        if (!livro || expansoes.some((e) => !e)) { if (_criaturas === carga) _criaturas = null; }
        if (!livro) return null;
        const criaturas = [...(livro.criaturas || []), ...expansoes.flatMap((e) => e?.criaturas || [])];
        return { ...livro, total: criaturas.length, criaturas };
      });
    _criaturas = carga;
  }
  return _criaturas;
}

/** Carrega glossário */
export async function getGlossario() {
  return fetchJSON('apendices/glossario.json');
}

// --- Pré-carregamento ---

/** Pré-carrega dados essenciais para criação de personagem */
export async function precarregarDadosCriacao() {
  await Promise.all([
    getAntecedentes(),
    getEspecies(),
    getTalentos(),
    getArmas(),
    getArmaduras(),
    getIndiceMagias()
  ]);
}
