// Módulo `features/sheet/pdf/download-pdf`: a ENTREGA do PDF ao jogador.
//
// Carrega o vendor, monta o backend real, renderiza e entrega por Blob + link
// de download — o mesmo caminho do baseline (`sheet.js#baixarPdfFicha`), e pela
// mesma razão: no iOS instalado (WKWebView em standalone) `window.print()` e
// `navigator.share` são bloqueados, mas um link `download` abre o visor nativo
// de PDF, que tem o botão de compartilhar.
//
// ## O nome do arquivo é o do baseline, caractere a caractere
//
// `Ficha <nome>.pdf`, com os caracteres proibidos em nome de arquivo trocados
// por `-`. Não é um detalhe estético: `tests/e2e/print-pdf.spec.js` afirma esse
// nome exato, e um jogador que já tem uma pasta de fichas espera continuar
// achando as dele. Sem nome, o fallback é `personagem` (o mesmo do baseline).
//
// ## Toda porta ausente é RECUSA nomeada
//
// `documentRef`, `blobFactory` e `urlFactory` não têm degradação possível: sem
// elas não há arquivo. O erro sobe como `Result`, e quem chamou mostra o toast.
// Nenhum caminho daqui termina em "não aconteceu nada".

import { ok, err } from '../../../core/result.js';
import { createAppError } from '../../../core/errors.js';
import { loadPdfLib } from './pdf-lib-loader.js';
import { createPdfLibBackend } from './pdf-lib-backend.js';
import { renderPdf } from './pdf-renderer.js';

const SCOPE = 'features.sheet.pdf.download';

/**
 * Caracteres proibidos em nome de arquivo (Windows é o mais restritivo).
 * @type {RegExp}
 */
const CARACTERES_PROIBIDOS = /[\\/:*?"<>|]/g;

/**
 * Milissegundos até revogar a object URL. O mesmo do baseline: revogar cedo
 * demais cancela um download que ainda não começou em conexões lentas.
 * @type {number}
 */
export const OBJECT_URL_TTL_MS = 60000;

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {*} [cause]
 * @returns {object}
 */
function downloadError(code, message, context = {}, cause = undefined) {
  return createAppError({ code, scope: SCOPE, message, context, cause });
}

/**
 * Nome do arquivo de download da ficha.
 * @param {object} viewModel
 * @returns {string}
 */
export function pdfFileName(viewModel) {
  const nome = viewModel?.data?.identity?.name;
  const base = typeof nome === 'string' && nome.trim().length > 0 ? nome : 'personagem';
  return `Ficha ${base}.pdf`.replace(CARACTERES_PROIBIDOS, '-');
}

/**
 * Gera e entrega o PDF da ficha.
 *
 * @param {object} viewModel - `SheetViewModel`.
 * @param {{
 *   documentRef?: object,
 *   globalRef?: object,
 *   scriptUrl?: string,
 *   loader?: Function,
 *   backendFactory?: Function,
 *   blobFactory?: Function,
 *   urlFactory?: {createObjectURL: Function, revokeObjectURL: Function},
 *   scheduler?: {schedule: Function}
 * }} [ports]
 * @returns {Promise<import('../../../core/result.js').Result>} Result<void, AppError>
 */
export async function downloadPdf(viewModel, ports = {}) {
  const {
    documentRef = typeof document === 'undefined' ? null : document,
    globalRef = globalThis,
    scriptUrl = undefined,
    loader = loadPdfLib,
    backendFactory = createPdfLibBackend,
    blobFactory = typeof Blob === 'undefined' ? null : (partes, opcoes) => new Blob(partes, opcoes),
    urlFactory = typeof URL === 'undefined' ? null : URL,
    scheduler = { schedule: (fn, ms) => setTimeout(fn, ms) },
  } = ports ?? {};

  if (documentRef === null || typeof documentRef.createElement !== 'function') {
    return err(downloadError('PDF_DOWNLOAD_DOCUMENT_UNAVAILABLE', 'Baixar o PDF exige um documento.', {}));
  }
  if (typeof blobFactory !== 'function' || urlFactory === null || typeof urlFactory.createObjectURL !== 'function') {
    return err(downloadError('PDF_DOWNLOAD_BLOB_UNAVAILABLE', 'Este ambiente não oferece Blob/URL para entregar o arquivo.', {}));
  }

  const carregado = await loader({ documentRef, globalRef, ...(scriptUrl === undefined ? {} : { scriptUrl }) });
  if (carregado.ok !== true) {
    return carregado;
  }

  const backend = backendFactory(carregado.value, {});
  if (backend.ok !== true) {
    return backend;
  }

  const bytes = await renderPdf(viewModel, { backend: backend.value });
  if (bytes.ok !== true) {
    return bytes;
  }

  let url;
  try {
    const blob = blobFactory([bytes.value], { type: 'application/pdf' });
    url = urlFactory.createObjectURL(blob);
    const ancora = documentRef.createElement('a');
    ancora.href = url;
    ancora.download = pdfFileName(viewModel);
    ancora.rel = 'noopener';
    const corpo = documentRef.body ?? documentRef.documentElement;
    corpo.appendChild(ancora);
    ancora.click();
    ancora.remove();
  } catch (cause) {
    if (url !== undefined && typeof urlFactory.revokeObjectURL === 'function') {
      // A URL criada antes da falha é revogada AGORA: deixá-la viva vaza o
      // blob inteiro na memória da aba até o reload.
      urlFactory.revokeObjectURL(url);
    }
    return err(downloadError('PDF_DOWNLOAD_DELIVERY_FAILED', 'O arquivo foi gerado mas não pôde ser entregue.', {}, cause));
  }

  if (typeof urlFactory.revokeObjectURL === 'function' && typeof scheduler?.schedule === 'function') {
    scheduler.schedule(() => urlFactory.revokeObjectURL(url), OBJECT_URL_TTL_MS);
  }
  return ok(undefined);
}
