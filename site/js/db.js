// ============================================================
// FACHADA DE COMPATIBILIDADE sobre o catálogo oficial (Task 22b — cutover).
//
// ## O que mudou
//
// Até a Task 22b este módulo era um carregador de JSON: cada export buscava um
// arquivo de `dados/**` (formato legado monolítico) com `fetch` e cache em
// memória. A partir daqui ele NÃO lê mais nenhum JSON legado: cada export
// delega para `infra/content/legacy-db-projection.js`, que projeta o mesmo
// shape a partir do catálogo oficial (`dados/pacotes/dnd2024/**`) já ativo no
// `ContentRegistry` do composition root (`app-context.js`).
//
// A implementação original virou ORÁCULO DE TESTE em
// `tests/helpers/legacy-db-source.js` (ver o cabeçalho de lá): ela e os JSON
// legados continuam no repositório porque são o que
// `tests/contract/legacy-db-projection.test.js` e
// `tests/e2e/legacy-db-shadow.spec.js` usam para PROVAR que esta fachada
// devolve o mesmo que o legado devolvia. Nenhum dos dois é publicado nem
// requisitado pelo app.
//
// ## Por que a fachada continua existindo (Task 37)
//
// Nenhum módulo de PRODUÇÃO importa mais estes nomes: as Tasks 25-33
// reescreveram criador/ficha sobre o domínio e a Task 37 apagou o cluster
// `levelup-*`/`manobras-ui` depois de prová-lo inalcançável. A fachada
// permanece como SUPERFÍCIE DE COMPATIBILIDADE PÚBLICA fina e coberta por
// teste (decisão da Task 37, prevista no plano para candidatos com
// compatibilidade necessária): `tests/contract/legacy-db-projection.test.js`
// e `tests/e2e/legacy-db-shadow.spec.js` a comparam campo a campo com o
// oráculo legado (`tests/helpers/legacy-db-source.js`) — é essa comparação
// que prova que o catálogo oficial projeta o mesmo shape que o legado
// servia. Não há regra nem estado próprios aqui: só delegação à projeção.
//
// ## Divergências visíveis que este cutover introduz
//
// A projeção NÃO reproduz `db.js` byte a byte: ela CORRIGE cinco famílias de
// erro do legado, todas declaradas e contadas em
// `LEGACY_INTENTIONAL_DIVERGENCES` (ordem da lista de 2º Círculo do Paladino,
// "De Carne para Pedra" no 6º Círculo do Druida, caixa de "modificador de
// Des", dois typos de tabela de arma, sete marcas da coluna `especial`).
// São mudanças de comportamento deliberadas, não regressões.
//
// ## Cache
//
// O cache abaixo é o análogo direto do `cache` por caminho de arquivo do
// módulo original: guarda o resultado das operações que correspondiam 1:1 a um
// JSON legado cacheado, e NÃO guarda as que o legado derivava a cada chamada
// (`getMagia`, `buscarMagias`, `precarregarDadosCriacao`). Isso preserva
// também a IDENTIDADE de referência entre chamadas repetidas, que o legado
// tinha por consequência do cache de `fetchJSON`.
// ============================================================

import { appContext } from './app-context.js';
import {
  createLegacyDbProjection,
  assertLegacyProjectionReadyForCutover,
} from './infra/content/legacy-db-projection.js';

// GUARDA DE CUTOVER, avaliada no carregamento do módulo. Não depende de dados
// nem de rede: lê as constantes congeladas de `legacy-db-projection.js`. Se
// alguém reabrir uma lacuna numa das operações que o runtime público chama
// (`PUBLIC_RUNTIME_LEGACY_OPERATIONS`), esta fachada deixa de carregar em vez
// de servir silenciosamente dados incompletos.
assertLegacyProjectionReadyForCutover();

/**
 * Projeção memoizada sobre o catálogo ativo, ou `null` enquanto o catálogo não
 * foi ativado com sucesso.
 * @type {Readonly<object> | null}
 */
let projecao = null;

/** Cache de resultados por operação+argumentos (ver nota de Cache acima). */
const cache = new Map();

/**
 * Garante o catálogo ativo e devolve a projeção legada sobre ele.
 *
 * Devolve `null` (em vez de lançar) quando a ativação do catálogo falha, para
 * espelhar o comportamento do módulo legado, cujo `fetchJSON` registrava o
 * erro no console e devolvia `null` — os seis consumidores atuais tratam
 * `null`, e trocar isso por uma exceção seria uma mudança de comportamento
 * fora do escopo de uma fachada de compatibilidade.
 *
 * @returns {Promise<Readonly<object> | null>}
 */
async function obterProjecao() {
  if (projecao !== null) return projecao;
  let resultado;
  try {
    resultado = await appContext.initializeContent();
  } catch (cause) {
    console.error('db.js: a ativação do catálogo oficial lançou uma exceção:', cause);
    return null;
  }
  if (!resultado || resultado.ok !== true) {
    console.error('db.js: a ativação do catálogo oficial falhou:', resultado?.error);
    return null;
  }
  projecao = createLegacyDbProjection({ registry: resultado.value });
  return projecao;
}

/**
 * Executa uma operação da projeção com memoização por argumentos, devolvendo
 * `padraoSemCatalogo` quando o catálogo não pôde ser ativado.
 *
 * @param {string} operacao - nome do export da projeção.
 * @param {ReadonlyArray<*>} args
 * @param {*} padraoSemCatalogo - valor que o módulo legado devolvia quando o
 *   `fetch` correspondente falhava.
 * @returns {Promise<*>}
 */
async function comCache(operacao, args, padraoSemCatalogo) {
  const chave = `${operacao}(${JSON.stringify(args)})`;
  if (cache.has(chave)) return cache.get(chave);
  const atual = await obterProjecao();
  if (atual === null) return padraoSemCatalogo;
  const valor = await atual[operacao](...args);
  cache.set(chave, valor);
  return valor;
}

/**
 * Executa uma operação da projeção SEM memoização (as que o legado derivava a
 * cada chamada a partir de um JSON já cacheado).
 *
 * @param {string} operacao
 * @param {ReadonlyArray<*>} args
 * @param {*} padraoSemCatalogo
 * @returns {Promise<*>}
 */
async function semCache(operacao, args, padraoSemCatalogo) {
  const atual = await obterProjecao();
  if (atual === null) return padraoSemCatalogo;
  return atual[operacao](...args);
}

// --- Classes ---

/** Carrega dados de uma classe específica */
export async function getClasse(nome) {
  return comCache('getClasse', [nome], null);
}

/** Carrega lista de magias de uma classe conjuradora */
export async function getMagiasClasse(nomeClasse) {
  return comCache('getMagiasClasse', [nomeClasse], null);
}

// --- Origens ---

/** Carrega todos os antecedentes */
export async function getAntecedentes() {
  return comCache('getAntecedentes', [], null);
}

/** Carrega todas as espécies */
export async function getEspecies() {
  return comCache('getEspecies', [], null);
}

// --- Talentos ---

/** Carrega todos os talentos */
export async function getTalentos() {
  return comCache('getTalentos', [], null);
}

// --- Equipamento ---

/** Carrega armas */
export async function getArmas() {
  return comCache('getArmas', [], null);
}

/** Carrega armaduras */
export async function getArmaduras() {
  return comCache('getArmaduras', [], null);
}

/** Carrega equipamento de aventura */
export async function getEquipamentoAventura() {
  return comCache('getEquipamentoAventura', [], null);
}

/** Carrega ferramentas */
export async function getFerramentas() {
  return comCache('getFerramentas', [], null);
}

// --- Magias ---

/** Carrega índice de todas as magias (resumido) */
export async function getIndiceMagias() {
  return comCache('getIndiceMagias', [], null);
}

/** Carrega magias de um círculo específico (com descrição completa) */
export async function getMagiasPorCirculo(circulo) {
  return comCache('getMagiasPorCirculo', [circulo], null);
}

/** Carrega magias de uma classe (lista resumida: nome, circulo, escola) */
export async function getMagiasPorClasseLista(nomeClasse) {
  return comCache('getMagiasPorClasseLista', [nomeClasse], null);
}

/** Busca uma magia específica pelo nome (carrega o círculo inteiro) */
export async function getMagia(nome, circulo) {
  return semCache('getMagia', [nome, circulo], null);
}

/** Busca magias por nome (busca no índice, retorna matches) */
export async function buscarMagias(termo) {
  // O legado devolvia `[]` — não `null` — quando o índice não carregava.
  return semCache('buscarMagias', [termo], []);
}

// --- Apêndices ---

/** Carrega criaturas */
export async function getCriaturas() {
  return comCache('getCriaturas', [], null);
}

/** Carrega glossário */
export async function getGlossario() {
  return comCache('getGlossario', [], null);
}

// --- Pré-carregamento ---

/** Pré-carrega dados essenciais para criação de personagem */
export async function precarregarDadosCriacao() {
  // Preserva o comportamento do legado: dispara as mesmas seis operações (que
  // aqui aquecem o cache acima) e resolve sem valor.
  await Promise.all([
    getAntecedentes(),
    getEspecies(),
    getTalentos(),
    getArmas(),
    getArmaduras(),
    getIndiceMagias(),
  ]);
}
