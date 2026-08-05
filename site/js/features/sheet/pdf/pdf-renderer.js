// Módulo `features/sheet/pdf/pdf-renderer`: a junção das duas metades —
// plano PURO (`pdf-drawing-plan.js`) + backend (`pdf-lib-backend.js` em
// produção, `RecordingPdfBackend` em teste).
//
// É deliberadamente magro: ele não desenha nada e não conhece `pdf-lib`. A
// razão de existir é ter UM ponto onde "ViewModel vira bytes", para que o
// download (`download-pdf.js`) não precise saber que existe um plano, e para
// que trocar o backend seja um parâmetro em vez de uma reescrita.

import { err } from '../../../core/result.js';
import { createAppError } from '../../../core/errors.js';
import { createPdfDrawingPlan } from './pdf-drawing-plan.js';

const SCOPE = 'features.sheet.pdf.renderer';

/**
 * Gera os bytes do PDF da ficha.
 *
 * @param {object} viewModel - `SheetViewModel`.
 * @param {{backend: {render: Function}, plan?: Function}} ports - `backend` é
 *   obrigatório; `plan` permite injetar outro planejador (só os testes usam).
 * @returns {Promise<import('../../../core/result.js').Result>} Result<Uint8Array, AppError>
 */
export async function renderPdf(viewModel, ports = {}) {
  const { backend = null, plan = createPdfDrawingPlan } = ports ?? {};
  if (backend === null || typeof backend.render !== 'function') {
    // Sem backend não há PDF. Recusar é obrigatório: devolver bytes vazios
    // entregaria ao jogador um arquivo que o leitor de PDF recusa a abrir, sem
    // nenhuma pista do motivo.
    return err(
      createAppError({
        code: 'PDF_RENDER_BACKEND_REQUIRED',
        scope: SCOPE,
        message: 'A geração de PDF exige um PdfDrawingBackend com "render".',
        context: {},
      }),
    );
  }
  const operations = plan(viewModel);
  return backend.render(operations);
}
