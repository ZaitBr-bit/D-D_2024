// Módulo `features/sheet/pdf/pdf-lib-loader`: carrega o vendor `pdf-lib`.
//
// ## Por que `<script>` e não `import()`
//
// `site/js/vendor/pdf-lib.min.js` é um bundle UMD: ele não tem `export`
// nenhum. `import()` sobre ele NÃO devolve a biblioteca — devolve um namespace
// vazio, e o erro só aparece na primeira chamada a `PDFDocument.create`. A
// única forma de consumi-lo é injetar um `<script>` e ler `window.PDFLib`, que
// é o que o baseline faz (`sheet.js#carregarPdfLib`) e o que este módulo
// preserva.
//
// ## Por que `new URL(..., import.meta.url)` e não `'js/vendor/pdf-lib.min.js'`
//
// O baseline usa um caminho relativo ao DOCUMENTO. Isso só funciona enquanto a
// página estiver exatamente um nível acima de `js/` — qualquer rota servida de
// subdiretório, ou qualquer harness servido de outro caminho, carrega um 404 e
// o botão de PDF simplesmente para de funcionar. `new URL('../../../vendor/…',
// import.meta.url)` resolve contra o MÓDULO, que é o único endereço estável.
//
// **Nota entre tarefas (Task 35 — precache do PWA):** esta URL é injetada em
// tempo de execução via `<script>`. Ela NÃO é um import estático nem uma
// referência de HTML/CSS, então o grafo de completude do precache não a
// alcança. A Task 35 já foi instruída a incluir o diretório do vendor
// explicitamente no manifesto; se aquela task rodar antes desta, é preciso
// conferir manualmente que `pdf-lib.min.js` está no manifesto. O diretório
// REAL é `site/js/vendor/` (não `site/vendor/`) — ver o comentário do relatório
// desta task.
//
// ## Três garantias que o baseline não tinha por inteiro
//
//   1. INJEÇÃO ÚNICA: duas chamadas simultâneas compartilham a MESMA promise e
//      um único `<script>` (o baseline já fazia isso);
//   2. RETRY APÓS ERRO: a promise em voo é DESCARTADA quando falha. No
//      baseline, `_pdfLibPromise` guardava a promise rejeitada para sempre —
//      uma falha de rede transitória deixava o botão de PDF quebrado até o
//      reload da página;
//   3. `Result` em vez de exceção: quem chama decide o que mostrar.

import { ok, err } from '../../../core/result.js';
import { createAppError } from '../../../core/errors.js';

const SCOPE = 'features.sheet.pdf.loader';

/**
 * URL PADRÃO do vendor, resolvida contra ESTE módulo.
 * @type {string}
 */
export const DEFAULT_PDF_LIB_URL = new URL('../../../vendor/pdf-lib.min.js', import.meta.url).href;

/**
 * Atributo que marca o `<script>` injetado, para que uma segunda chamada
 * reconheça a injeção anterior mesmo vinda de outra instância do módulo.
 * @type {string}
 */
export const PDF_LIB_SCRIPT_ATTRIBUTE = 'data-pdf-lib-loader';

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {*} [cause]
 * @returns {object}
 */
function loaderError(code, message, context = {}, cause = undefined) {
  return createAppError({ code, scope: SCOPE, message, context, cause });
}

/**
 * Promise da injeção EM VOO, compartilhada entre chamadas concorrentes.
 *
 * É estado de MÓDULO por necessidade: o `<script>` é um recurso do documento,
 * e duas chamadas simultâneas precisam convergir para a mesma injeção. Ele é
 * limpo em toda falha (garantia 2 acima) e por `resetPdfLibLoader()` nos
 * testes.
 * @type {Promise<object>|null}
 */
let injecaoEmVoo = null;

/**
 * Descarta a injeção em voo. Existe para os testes: sem ela, um caso que
 * falhou contaminaria o seguinte.
 * @returns {void}
 */
export function resetPdfLibLoader() {
  injecaoEmVoo = null;
}

/**
 * Carrega `pdf-lib` e devolve o namespace `PDFLib`.
 *
 * @param {{documentRef?: object, globalRef?: object, scriptUrl?: string}} [ports]
 * @returns {Promise<import('../../../core/result.js').Result>} Result<PDFLibNamespace, AppError>
 */
export async function loadPdfLib(ports = {}) {
  const {
    documentRef = typeof document === 'undefined' ? null : document,
    globalRef = globalThis,
    scriptUrl = DEFAULT_PDF_LIB_URL,
  } = ports ?? {};

  // JÁ CARREGADO: nem promise nem `<script>` novo.
  if (globalRef !== null && globalRef !== undefined && globalRef.PDFLib) {
    return ok(globalRef.PDFLib);
  }

  if (documentRef === null || typeof documentRef.createElement !== 'function') {
    return err(
      loaderError('PDF_LIB_DOCUMENT_UNAVAILABLE', 'Carregar o vendor de PDF exige um documento; não há como injetar o script.', {
        scriptUrl,
      }),
    );
  }

  if (injecaoEmVoo === null) {
    injecaoEmVoo = injetar(documentRef, globalRef, scriptUrl);
  }

  try {
    const namespace = await injecaoEmVoo;
    return ok(namespace);
  } catch (cause) {
    // A promise REJEITADA não fica guardada: a próxima chamada tenta de novo.
    injecaoEmVoo = null;
    return err(
      cause !== null && typeof cause === 'object' && typeof cause.code === 'string'
        ? cause
        : loaderError('PDF_LIB_LOAD_FAILED', 'O vendor de PDF não pôde ser carregado.', { scriptUrl }, cause),
    );
  }
}

/**
 * Injeta o `<script>` UMA vez e resolve com `globalRef.PDFLib`.
 * @param {object} documentRef
 * @param {object} globalRef
 * @param {string} scriptUrl
 * @returns {Promise<object>}
 */
function injetar(documentRef, globalRef, scriptUrl) {
  return new Promise((resolve, reject) => {
    const script = documentRef.createElement('script');
    script.src = scriptUrl;
    script.setAttribute(PDF_LIB_SCRIPT_ATTRIBUTE, 'true');
    script.onload = () => {
      if (globalRef?.PDFLib) {
        resolve(globalRef.PDFLib);
        return;
      }
      // Script carregou e NÃO publicou o global: é um arquivo errado, não uma
      // falha de rede. O código distingue os dois casos.
      reject(loaderError('PDF_LIB_GLOBAL_MISSING', 'O script do vendor carregou mas não publicou "window.PDFLib".', { scriptUrl }));
    };
    script.onerror = () => {
      reject(loaderError('PDF_LIB_SCRIPT_ERROR', 'O script do vendor de PDF não pôde ser buscado.', { scriptUrl }));
    };
    const destino = documentRef.head ?? documentRef.body ?? documentRef.documentElement;
    destino.appendChild(script);
  });
}
