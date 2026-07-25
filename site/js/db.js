// ============================================================
// Carregador de dados JSON (acessa ../dados/)
// Cache em memória para evitar re-fetch
// ============================================================

// Caminho base para os arquivos de dados.
// No deploy (GitHub Pages), o workflow substitui '../dados' por './dados' via sed.
const BASE_PATH = '../dados';
const cache = {};

/** Busca um JSON com cache em memória */
async function fetchJSON(caminho) {
  if (cache[caminho]) return cache[caminho];
  try {
    const resp = await fetch(`${BASE_PATH}/${caminho}`, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`Erro ${resp.status}: ${caminho}`);
    const dados = await resp.json();
    cache[caminho] = dados;
    return dados;
  } catch (err) {
    console.error(`Erro ao carregar ${caminho}:`, err);
    return null;
  }
}

// --- Classes ---

/** Carrega dados de uma classe específica */
export async function getClasse(nome) {
  const nomeArq = nome.toLowerCase()
    .replace(/á/g, 'a').replace(/ã/g, 'a').replace(/é/g, 'e')
    .replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u');
  const dados = await fetchJSON(`classes/${nomeArq}.json`);
  if (!dados) return null;

  return dados;
}

/** Carrega lista de magias de uma classe conjuradora */
export async function getMagiasClasse(nomeClasse) {
  const nomeArq = nomeClasse.toLowerCase()
    .replace(/á/g, 'a').replace(/ã/g, 'a').replace(/é/g, 'e')
    .replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u');
  const [base, frhof] = await Promise.all([
    fetchJSON(`classes/magias_${nomeArq}.json`),
    getMagiasFRHOF()
  ]);

  const listaMagias = { ...(base?.lista_magias || {}) };
  for (const magia of frhof?.magias || []) {
    if (!magia.classes?.includes(nomeClasse)) continue;
    const chave = magia.circulo === 0 ? 'Truques' : `${magia.circulo}º Círculo`;
    if (!Array.isArray(listaMagias[chave])) listaMagias[chave] = [];
    const jaExiste = listaMagias[chave].some(item => (typeof item === 'string' ? item : item.nome) === magia.nome);
    if (jaExiste) continue;
    const especial = [
      magia.concentracao ? 'C' : '',
      typeof magia.componentes === 'string' && magia.componentes.includes('M') ? 'M' : ''
    ].filter(Boolean).join(', ') || '—';
    listaMagias[chave].push({
      nome: magia.nome,
      nome_original: magia.nome_original,
      circulo: magia.circulo,
      escola: magia.escola,
      especial,
      fonte: magia.fonte
    });
  }

  return {
    ...(base || { classe: nomeClasse }),
    lista_magias: listaMagias
  };
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

// --- Fontes ---

export async function getFontes() {
  return fetchJSON('fontes.json');
}

export async function getFonte(id) {
  const dados = await getFontes();
  return dados?.fontes?.find(fonte => fonte.id === id) || null;
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

export async function getEquipamentosRegionaisFRHOF() {
  return fetchJSON('equipamento/equipamentos_regionais_frhof.json');
}

/** Carrega itens mágicos de Forgotten Realms: Heroes of Faerûn */
export async function getItensMagicosFRHOF() {
  return fetchJSON('equipamento/itens_magicos_frhof.json');
}

/** Carrega equipamento de aventura */
export async function getEquipamentoAventura() {
  const [base, regional] = await Promise.all([
    fetchJSON('equipamento/equipamento_aventura.json'),
    getEquipamentosRegionaisFRHOF()
  ]);

  const itensBase = base?.itens || [];
  const itensRegionais = regional?.itens || [];
  return {
    ...(base || {}),
    total_itens: itensBase.length + itensRegionais.length,
    itens: [...itensBase, ...itensRegionais]
  };
}

/** Carrega ferramentas */
export async function getFerramentas() {
  return fetchJSON('equipamento/ferramentas.json');
}

// --- Magias ---

function resumirMagia(magia) {
  return {
    nome: magia.nome,
    nome_original: magia.nome_original,
    circulo: magia.circulo,
    escola: magia.escola,
    classes: magia.classes,
    tempo_conjuracao: magia.tempo_conjuracao,
    alcance: magia.alcance,
    componentes: magia.componentes,
    duracao: magia.duracao,
    fonte: magia.fonte
  };
}

function dedupeMagiasPorNome(magias) {
  const vistos = new Set();
  return magias.filter(magia => {
    const chave = (magia.nome_original || magia.nome || '').toLowerCase();
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

/** Carrega magias de Forgotten Realms: Heroes of Faerun */
export async function getMagiasFRHOF() {
  return fetchJSON('magias/magias_frhof.json');
}

/** Carrega índice de todas as magias (resumido) */
export async function getIndiceMagias() {
  const [base, frhof] = await Promise.all([
    fetchJSON('magias/_indice.json'),
    getMagiasFRHOF()
  ]);
  const magiasBase = base?.magias || [];
  const magiasFRHOF = (frhof?.magias || []).map(resumirMagia);
  const magias = dedupeMagiasPorNome([...magiasBase, ...magiasFRHOF]);
  return { ...(base || {}), total_magias: magias.length, magias };
}

/** Carrega magias de um círculo específico (com descrição completa) */
export async function getMagiasPorCirculo(circulo) {
  const nome = circulo === 0 ? 'truques' : `circulo_${circulo}`;
  const [base, frhof] = await Promise.all([
    fetchJSON(`magias/${nome}.json`),
    getMagiasFRHOF()
  ]);
  const circuloNum = Number(circulo);
  const magiasBase = base?.magias || [];
  const magiasFRHOF = (frhof?.magias || []).filter(magia => magia.circulo === circuloNum);
  const magias = dedupeMagiasPorNome([...magiasBase, ...magiasFRHOF]);
  return { ...(base || {}), total_magias: magias.length, magias };
}

/** Carrega magias de uma classe (lista resumida: nome, circulo, escola) */
export async function getMagiasPorClasseLista(nomeClasse) {
  const nomeArq = nomeClasse.toLowerCase()
    .replace(/á/g, 'a').replace(/ã/g, 'a').replace(/é/g, 'e')
    .replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u');
  const [base, frhof] = await Promise.all([
    fetchJSON(`magias/por_classe/${nomeArq}.json`),
    getMagiasFRHOF()
  ]);
  const magiasBase = base?.magias || [];
  const magiasFRHOF = (frhof?.magias || [])
    .filter(magia => magia.classes?.includes(nomeClasse))
    .map(resumirMagia);
  const magias = dedupeMagiasPorNome([...magiasBase, ...magiasFRHOF]);
  return { ...(base || {}), total_magias: magias.length, magias };
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
