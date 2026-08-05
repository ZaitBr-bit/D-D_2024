// Helper de testes: `fetchFn` que serve arquivos do disco, para exercitar o
// caminho de leitura real (`HttpContentSource` -> `ContentRegistry`) sem rede.
//
// Nenhum teste deve usar `fetch` global de verdade. Este módulo oferece:
//   - `createDiskFetch()`   -> `fetchFn` injetável (recebe URL absoluta `file:`);
//   - `installLegacyDbFetch()` -> instala um `globalThis.fetch` de teste que
//     serve os JSON legados de `dados/**` como a página em `site/` os pediria,
//     usado só para rodar o `site/js/db.js` legado como oráculo;
//   - `installFetchTrap()`  -> instala um `globalThis.fetch` que EXPLODE, para
//     provar que o código sob teste nunca usa o global.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = new URL('../../', import.meta.url);

/**
 * Monta uma resposta de teste com a mesma superfície que a fonte HTTP usa
 * (`ok`, `status`, `statusText`, `json()`).
 * @param {URL} alvo
 * @returns {object}
 */
function responderArquivo(alvo) {
  let texto;
  try {
    texto = readFileSync(fileURLToPath(alvo), 'utf8');
  } catch {
    return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) };
  }
  return { ok: true, status: 200, statusText: 'OK', json: async () => JSON.parse(texto) };
}

/**
 * Cria um `fetchFn` injetável que resolve URLs absolutas para arquivos do
 * disco e registra cada caminho pedido.
 *
 * @param {{onRequest?: (url: string) => void}} [params]
 * @returns {{fetchFn: Function, requests: string[]}}
 */
export function createDiskFetch({ onRequest } = {}) {
  const requests = [];
  /**
   * `fetchFn` de teste.
   * @param {*} url
   * @param {*} init
   * @returns {Promise<object>}
   */
  async function fetchFn(url, init) {
    requests.push(String(url));
    if (typeof onRequest === 'function') {
      onRequest(String(url));
    }
    if (init && init.signal && init.signal.aborted) {
      throw new Error('AbortError: a requisição foi abortada antes de começar.');
    }
    return responderArquivo(new URL(String(url)));
  }
  return { fetchFn, requests };
}

/**
 * Instala um `globalThis.fetch` que serve os JSON legados de `dados/**`.
 *
 * Usado APENAS para executar o carregador legado congelado
 * (`tests/helpers/legacy-db-source.js`, que era `site/js/db.js` até o cutover
 * da Task 22b) como oráculo de comparação: ele pede `"../dados/<algo>"`
 * relativo à página em `site/`.
 *
 * @param {{onRequest?: (caminho: string) => void}} [params] - observador
 *   opcional dos caminhos pedidos, usado para PROVAR que o oráculo continua
 *   lendo os JSON legados (e não a projeção nova).
 * @returns {() => void} função que restaura o `fetch` anterior.
 */
export function installLegacyDbFetch({ onRequest } = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async function fetchLegado(caminho) {
    if (typeof onRequest === 'function') {
      onRequest(String(caminho));
    }
    return responderArquivo(new URL(String(caminho), new URL('site/', repoRoot)));
  };
  return () => {
    globalThis.fetch = original;
  };
}

/**
 * Instala um `globalThis.fetch` que lança ao ser chamado, para provar que o
 * código sob teste só usa o `fetchFn` injetado.
 *
 * @param {string} [mensagem]
 * @returns {{restore: () => void, count: () => number}}
 */
export function installFetchTrap(mensagem = 'fetch global foi chamado: use somente o fetchFn injetado.') {
  const original = globalThis.fetch;
  let chamadas = 0;
  globalThis.fetch = () => {
    chamadas += 1;
    throw new Error(mensagem);
  };
  return {
    restore: () => {
      globalThis.fetch = original;
    },
    count: () => chamadas,
  };
}
