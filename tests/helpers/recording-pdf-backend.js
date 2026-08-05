// Helper de teste: `RecordingPdfBackend` — um `PdfDrawingBackend` que GRAVA as
// operações em vez de desenhá-las.
//
// É o instrumento que torna o teste de paridade possível SEM fazer parsing dos
// bytes de um PDF. O plano de desenho carrega, em cada operação de texto que
// leva um valor de ficha, o par (`semantic`, `value`); gravando as operações,
// o teste consegue afirmar "o PDF emitiu PV temporário 6" com a mesma
// literalidade com que afirma o mesmo sobre a tela — em vez de procurar o
// caractere "6" dentro de um stream comprimido.
//
// Ele implementa o MESMO contrato do backend real (`render` devolvendo
// `Promise<Result<Uint8Array, AppError>>`) e passa pelo mesmo teste de
// contrato compartilhado. Os bytes que devolve são um cabeçalho `%PDF-` mínimo:
// não é um PDF útil, e nenhum teste finge que seja — quem prova bytes válidos é
// o teste do backend real.

import { ok, err } from '../../site/js/core/result.js';
import { createAppError } from '../../site/js/core/errors.js';
import { PDF_OPERATIONS } from '../../site/js/features/sheet/pdf/pdf-drawing-plan.js';

/** Bytes devolvidos pelo gravador: só a assinatura de arquivo PDF. */
const ASSINATURA = Object.freeze([0x25, 0x50, 0x44, 0x46, 0x2d]);

/**
 * Cria um backend gravador.
 *
 * @param {{failWith?: object|null}} [options] - `failWith` faz `render`
 *   devolver esse `AppError` (para exercitar o caminho de falha de quem chama).
 * @returns {Readonly<object>}
 */
export function createRecordingPdfBackend({ failWith = null } = {}) {
  /** @type {Array<object>} */
  let operacoes = [];

  return Object.freeze({
    /**
     * @param {ReadonlyArray<object>} operations
     * @returns {Promise<object>} Result<Uint8Array, AppError>
     */
    async render(operations) {
      if (!Array.isArray(operations)) {
        return err(
          createAppError({
            code: 'PDF_BACKEND_OPERATIONS_INVALID',
            scope: 'tests.recording-pdf-backend',
            message: '"operations" precisa ser um array de operações de desenho.',
            context: {},
          }),
        );
      }
      // A recusa de operação desconhecida é a MESMA do backend real: se o
      // gravador aceitasse qualquer coisa, ele deixaria passar um plano que o
      // backend real recusaria, e o teste de paridade seria mais frouxo do que
      // a produção.
      const conhecidas = new Set(Object.values(PDF_OPERATIONS));
      for (const [index, operacao] of operations.entries()) {
        if (!conhecidas.has(operacao?.op)) {
          return err(
            createAppError({
              code: 'PDF_BACKEND_OPERATION_UNKNOWN',
              scope: 'tests.recording-pdf-backend',
              message: `Operação de desenho desconhecida: "${String(operacao?.op)}".`,
              context: { index, op: operacao?.op ?? null },
            }),
          );
        }
      }
      operacoes = operations.map((operacao) => Object.freeze({ ...operacao }));
      if (failWith !== null) {
        return err(failWith);
      }
      return ok(Uint8Array.from(ASSINATURA));
    },
    /**
     * @returns {ReadonlyArray<object>} as operações da última renderização.
     */
    getOperations() {
      return Object.freeze([...operacoes]);
    },
    /**
     * Índice `semantic -> value` das operações de texto que carregam valor.
     * É a leitura que o teste de paridade usa.
     * @returns {Readonly<Record<string, *>>}
     */
    getSemanticValues() {
      /** @type {Record<string, *>} */
      const indice = {};
      for (const operacao of operacoes) {
        if (operacao.op === PDF_OPERATIONS.drawText && typeof operacao.semantic === 'string') {
          indice[operacao.semantic] = operacao.value;
        }
      }
      return Object.freeze(indice);
    },
  });
}
