// ============================================================
// ORÁCULO LEGADO — cópia CONGELADA do que era `site/js/db.js` até a Task 22b.
//
// ## O que este arquivo é (e o que NÃO é)
//
// Este É o `site/js/db.js` original, byte a byte, apenas movido de lugar pela
// Task 22b (cutover). Ele NÃO é mais código de produção: nenhum módulo de
// `site/js/**` o importa, ele não é publicado no deploy (o workflow copia
// `site/` e `dados/`, nunca `tests/`), e o app vivo passou a ler conteúdo
// exclusivamente do catálogo oficial (`dados/pacotes/dnd2024/**`) através da
// fachada `site/js/db.js` -> `infra/content/legacy-db-projection.js`.
//
// ## Por que ele continua existindo
//
// Porque ele é o ORÁCULO da suíte de proteção construída nas Tasks 11/23/23b:
//
//   - `tests/contract/legacy-db-projection.test.js` compara, campo a campo, o
//     resultado de CADA export daqui com a projeção equivalente do catálogo, e
//     exige que as divergências sejam exatamente as declaradas em
//     `LEGACY_PROJECTION_GAPS` + `LEGACY_INTENTIONAL_DIVERGENCES`.
//   - `tests/e2e/legacy-db-shadow.spec.js` faz o mesmo NO NAVEGADOR, em modo
//     sombra sobre os fluxos reais de criação de personagem e de abertura de
//     ficha.
//
// Sem este arquivo — e sem os JSON legados de `dados/classes/**`,
// `dados/equipamento/**`, `dados/magias/**`, `dados/origens/**`,
// `dados/talentos/**` e `dados/apendices/**` que ele lê — as duas suítes
// passariam a comparar a projeção consigo mesma e ficariam verdes sem provar
// nada. Por isso:
//
//   NÃO APAGUE ESTE ARQUIVO NEM OS JSON LEGADOS DE `dados/**` (fora de
//   `dados/pacotes/`) enquanto essas suítes existirem. Eles são fixture de
//   teste, não conteúdo de produção.
//
// ## Regra de manutenção
//
// Este arquivo é CONGELADO: não corrija bugs, não modernize, não reformate.
// Um oráculo que muda deixa de ser oráculo. Se algo aqui está errado, o lugar
// de registrar isso é `LEGACY_INTENTIONAL_DIVERGENCES` (a projeção corrige, o
// oráculo mantém o defeito para que a correção continue medida).
//
// Nota de resolução de caminho: `fetch('../dados/...')` resolve contra a URL
// do DOCUMENTO, não contra a do módulo — por isso mover o arquivo para
// `tests/helpers/` não mudou nada. No navegador, a página é servida em
// `/site/`, então `../dados` continua caindo em `/dados`; em Node, quem
// resolve é `tests/helpers/disk-fetch.js#installLegacyDbFetch`.
// ============================================================
//
// --- Cabeçalho original (preservado) ---
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
