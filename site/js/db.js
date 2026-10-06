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

/** Carrega dados de uma classe específica (Livro do Jogador ou expansão, pela fonte). */
export async function getClasse(nome) {
  const pasta = pastaDaExpansao(nome);
  if (pasta) return fetchJSON(`${pasta}/classe.json`);
  const nomeArq = nome.toLowerCase()
    .replace(/á/g, 'a').replace(/ã/g, 'a').replace(/é/g, 'e')
    .replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u');
  const dados = await fetchJSON(`classes/${nomeArq}.json`);
  if (!dados) return null;

  return dados;
}

/** Carrega lista de magias de uma classe conjuradora (Livro do Jogador ou expansão). */
export async function getMagiasClasse(nomeClasse) {
  const pasta = pastaDaExpansao(nomeClasse);
  if (pasta) return fetchJSON(`${pasta}/magias_classe.json`);
  const nomeArq = nomeClasse.toLowerCase()
    .replace(/á/g, 'a').replace(/ã/g, 'a').replace(/é/g, 'e')
    .replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u');
  return fetchJSON(`classes/magias_${nomeArq}.json`);
}

// --- Origens ---

/** Carrega todos os antecedentes */
export async function getAntecedentes() {
  return fetchJSON('origens/antecedentes.json');
}

/** Carrega todas as espécies */
export async function getEspecies() {
  return fetchJSON('origens/especies.json');
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
        for (const m of Object.values(lista?.lista_magias || {}).flat()) {
          if (!classesPorMagia.has(m.nome)) classesPorMagia.set(m.nome, new Set());
          classesPorMagia.get(m.nome).add(classe);
        }
      }
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
  const { nome, circulo, escola, classes, tempo_conjuracao, alcance, componentes, duracao } = m;
  return { nome, circulo, escola, classes, tempo_conjuracao, alcance, componentes, duracao };
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
    const dados = await fetchJSON(`${pasta}/magias_classe.json`);
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
  return fetchJSON(`magias/por_classe/${nomeArq}.json`);
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

/** Carrega criaturas */
export async function getCriaturas() {
  return fetchJSON('apendices/criaturas.json');
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
