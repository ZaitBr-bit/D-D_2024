// Módulo `features/sheet/pdf/pdf-lib-backend`: o backend REAL de desenho, o
// único ponto do fluxo de PDF que conhece a biblioteca `pdf-lib`.
//
// O contrato `PdfDrawingBackend` é minúsculo de propósito:
//
//     .render(operations): Promise<Result<Uint8Array, AppError>>
//
// Ele é implementado por este módulo (bytes de verdade) e por
// `tests/helpers/recording-pdf-backend.js` (que só GRAVA as operações). Os dois
// passam pelo mesmo teste de contrato compartilhado — é o que garante que
// gravar e desenhar significam a mesma coisa, e por isso o teste de paridade
// pode confiar no gravador.
//
// Uma operação de tipo DESCONHECIDO é recusada com erro nomeado, nunca
// ignorada: um plano com uma operação que o backend não sabe executar produz
// um PDF com um pedaço faltando — o bypass silencioso de sempre.

import { ok, err } from '../../../core/result.js';
import { createAppError } from '../../../core/errors.js';
import { PDF_FONTS, PDF_OPERATIONS } from './pdf-drawing-plan.js';

const SCOPE = 'features.sheet.pdf.backend';

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {*} [cause]
 * @returns {object}
 */
function backendError(code, message, context = {}, cause = undefined) {
  return createAppError({ code, scope: SCOPE, message, context, cause });
}

/**
 * Cria o backend de desenho sobre o namespace `PDFLib`.
 *
 * @param {object} PDFLib - namespace UMD (`{PDFDocument, StandardFonts, rgb}`).
 * @param {{fonts?: {regular?: string, bold?: string}, assets?: object}} [options]
 *   `fonts` permite trocar as duas fontes padrão (o default são as Helvetica
 *   embutidas no PDF, que não exigem arquivo); `assets` é reservado para
 *   imagens embutidas e hoje só é validado.
 * @returns {import('../../../core/result.js').Result} Result<PdfDrawingBackend, AppError>
 */
export function createPdfLibBackend(PDFLib, { fonts = {}, assets = null } = {}) {
  if (PDFLib === null || typeof PDFLib !== 'object' || typeof PDFLib.PDFDocument?.create !== 'function' || typeof PDFLib.rgb !== 'function') {
    return err(backendError('PDF_BACKEND_NAMESPACE_INVALID', 'O backend exige o namespace PDFLib com "PDFDocument" e "rgb".', {}));
  }
  if (assets !== null && typeof assets !== 'object') {
    return err(backendError('PDF_BACKEND_ASSETS_INVALID', '"assets" deve ser um objeto quando informado.', {}));
  }

  const nomeRegular = fonts.regular ?? PDFLib.StandardFonts?.Helvetica ?? 'Helvetica';
  const nomeBold = fonts.bold ?? PDFLib.StandardFonts?.HelveticaBold ?? 'Helvetica-Bold';

  return ok(
    Object.freeze({
      /**
       * Executa o plano e devolve os bytes do PDF.
       * @param {ReadonlyArray<object>} operations
       * @returns {Promise<import('../../../core/result.js').Result>}
       */
      async render(operations) {
        if (!Array.isArray(operations)) {
          return err(backendError('PDF_BACKEND_OPERATIONS_INVALID', '"operations" precisa ser um array de operações de desenho.', {}));
        }
        try {
          const doc = await PDFLib.PDFDocument.create();
          const fontes = {
            [PDF_FONTS.regular]: await doc.embedFont(nomeRegular),
            [PDF_FONTS.bold]: await doc.embedFont(nomeBold),
          };
          let page = null;

          for (const [indice, operacao] of operations.entries()) {
            switch (operacao?.op) {
              case PDF_OPERATIONS.addPage:
                page = doc.addPage([operacao.width, operacao.height]);
                break;
              case PDF_OPERATIONS.drawRectangle: {
                if (page === null) {
                  return err(paginaAusente(indice, operacao.op));
                }
                page.drawRectangle({
                  x: operacao.x,
                  y: operacao.y,
                  width: operacao.width,
                  height: operacao.height,
                  ...(operacao.color === undefined ? {} : { color: cor(PDFLib, operacao.color) }),
                  ...(operacao.borderColor === undefined ? {} : { borderColor: cor(PDFLib, operacao.borderColor) }),
                  ...(operacao.borderWidth === undefined ? {} : { borderWidth: operacao.borderWidth }),
                });
                break;
              }
              case PDF_OPERATIONS.drawText: {
                if (page === null) {
                  return err(paginaAusente(indice, operacao.op));
                }
                page.drawText(operacao.text, {
                  x: operacao.x,
                  y: operacao.y,
                  size: operacao.size,
                  font: fontes[operacao.font] ?? fontes[PDF_FONTS.regular],
                  color: cor(PDFLib, operacao.color),
                });
                break;
              }
              default:
                return err(
                  backendError('PDF_BACKEND_OPERATION_UNKNOWN', `Operação de desenho desconhecida: "${String(operacao?.op)}".`, {
                    index: indice,
                    op: operacao?.op ?? null,
                  }),
                );
            }
          }

          const bytes = await doc.save();
          return ok(bytes);
        } catch (cause) {
          return err(backendError('PDF_BACKEND_RENDER_THREW', 'A geração do PDF lançou uma exceção.', {}, cause));
        }
      },
    }),
  );
}

/**
 * Erro de operação de desenho antes da primeira página.
 * @param {number} index
 * @param {string} op
 * @returns {object}
 */
function paginaAusente(index, op) {
  return backendError('PDF_BACKEND_PAGE_MISSING', `A operação "${op}" veio antes de qualquer "add-page".`, { index, op });
}

/**
 * Converte a cor do plano (`{r,g,b}` puro, sem dependência de biblioteca) para
 * o objeto de cor de `pdf-lib`.
 * @param {object} PDFLib
 * @param {object} valor
 * @returns {object}
 */
function cor(PDFLib, valor) {
  if (valor === null || valor === undefined) {
    return PDFLib.rgb(0, 0, 0);
  }
  return PDFLib.rgb(valor.r, valor.g, valor.b);
}
