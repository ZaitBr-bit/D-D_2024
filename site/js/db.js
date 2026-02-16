// ============================================================
// Carregador de dados JSON (acessa ../dados/)
// Cache em memória para evitar re-fetch
// ============================================================

const BASE_PATH = '../dados';
const cache = {};

/** Busca um JSON com cache em memória */
async function fetchJSON(caminho) {
  if (cache[caminho]) return cache[caminho];
  try {
    const resp = await fetch(`${BASE_PATH}/${caminho}`);
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

// --- Magias ---

/** Carrega índice de todas as magias (resumido) */
export async function getIndiceMagias() {
  return fetchJSON('magias/_indice.json');
}

/** Carrega magias de um círculo específico (com descrição completa) */
export async function getMagiasPorCirculo(circulo) {
  const nome = circulo === 0 ? 'truques' : `circulo_${circulo}`;
  return fetchJSON(`magias/${nome}.json`);
}

/** Carrega magias de uma classe (lista resumida: nome, circulo, escola) */
export async function getMagiasPorClasseLista(nomeClasse) {
  const nomeArq = nomeClasse.toLowerCase()
    .replace(/á/g, 'a').replace(/ã/g, 'a').replace(/é/g, 'e')
    .replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u');
  return fetchJSON(`magias/por_classe/${nomeArq}.json`);
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
