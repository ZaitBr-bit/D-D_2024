// Módulo `features/sheet/sheet-output-actions`: os dois CONTROLES de saída da
// ficha — "Gerar PDF" e "Imprimir" — montados no host que o composition root
// indicar (em produção, `#header-acoes` do shell da aplicação).
//
// ## Por que eles NÃO são uma seção
//
// Uma seção da ficha descreve intenções (`SheetIntent`) e o controller as
// converte em comando/modal/UI state. Gerar PDF e imprimir não são nenhuma
// dessas coisas: não mutam o personagem, não abrem modal e não mexem no estado
// de tela. Enfiá-las no vocabulário de intenções obrigaria a inventar um sexto
// tipo de intenção para acomodar dois botões — e o `SheetIntent` fechado é
// justamente o que impede uma seção de fazer efeito por fora do controller.
// Elas são SAÍDA: leem o ViewModel corrente e escrevem fora da ficha (um
// arquivo, uma folha de papel).
//
// ## Por que o botão de PDF continua sendo `#btn-print`
//
// É o id que o baseline usa e que `tests/e2e/print-pdf.spec.js` afirma. O
// cutover troca o produtor do PDF, não o contrato observável do botão.
//
// ## `window.print()` é SÍNCRONO dentro do gesto
//
// iOS Safari e Android Chrome bloqueiam, sem aviso nenhum, um `print()` que
// chegue depois de um `await`. `renderPrintHtml` é PURA justamente para que o
// caminho do clique até `print()` não tenha uma única espera — a nota está no
// baseline (`sheet.js#imprimirFicha`) e continua valendo.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { renderPrintHtml, PRINT_OVERLAY_ID } from './print/print-view.js';
import { downloadPdf } from './pdf/download-pdf.js';

const SCOPE = 'features.sheet.output-actions';

/** Id do botão que gera o PDF — o MESMO do baseline. */
export const PDF_BUTTON_ID = 'btn-print';

/** Id do botão que imprime. */
export const PRINT_BUTTON_ID = 'btn-imprimir';

/**
 * Milissegundos até o fallback de limpeza do overlay de impressão, quando
 * `afterprint` não dispara (o mesmo do baseline).
 * @type {number}
 */
export const PRINT_CLEANUP_FALLBACK_MS = 5000;

/**
 * Cria um AppError deste módulo.
 * @param {string} code - código do erro.
 * @param {string} message - explicação.
 * @param {object} [context] - dados de diagnóstico.
 * @returns {object}
 */
function actionsError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Monta os controles de saída da ficha.
 *
 * @param {{
 *   host: object,
 *   getViewModel: () => (object|null),
 *   documentRef?: object,
 *   windowRef?: object,
 *   notifier?: object|null,
 *   downloadPdfImpl?: Function,
 *   renderPrintHtmlImpl?: Function
 * }} ports - `host` é onde os botões são inseridos; `getViewModel` lê o
 *   ViewModel CORRENTE da sessão (nunca uma cópia congelada no mount, que
 *   imprimiria o estado de quando a ficha abriu).
 * @returns {import('../../core/result.js').Result} `ok(dispose)`
 */
export function mountSheetOutputActions(ports = {}) {
  const {
    host,
    getViewModel,
    documentRef = typeof document === 'undefined' ? null : document,
    windowRef = typeof window === 'undefined' ? null : window,
    notifier = null,
    downloadPdfImpl = downloadPdf,
    renderPrintHtmlImpl = renderPrintHtml,
  } = ports;

  if (!host || typeof host.appendChild !== 'function') {
    return err(actionsError('SHEET_OUTPUT_ACTIONS_HOST_INVALID', '"host" precisa ser um nó DOM.'));
  }
  if (typeof getViewModel !== 'function') {
    return err(actionsError('SHEET_OUTPUT_ACTIONS_VIEW_MODEL_PORT_MISSING', '"getViewModel" é obrigatório.'));
  }
  if (documentRef === null || typeof documentRef.createElement !== 'function') {
    return err(actionsError('SHEET_OUTPUT_ACTIONS_DOCUMENT_UNAVAILABLE', 'Os controles de saída exigem um documento.'));
  }

  let disposed = false;
  /** @type {Array<Function>} */
  const teardown = [];

  /**
   * Notifica, quando há notificador. Um notificador quebrado nunca derruba a
   * ação que já aconteceu.
   * @param {string} level - `error` | `info` | `success`.
   * @param {string} message - texto para o jogador.
   * @returns {void}
   */
  function notify(level, message) {
    const handler = notifier?.[level];
    if (typeof handler === 'function') {
      try {
        handler(message);
      } catch {
        // Silenciar aqui é correto: o efeito já ocorreu.
      }
    }
  }

  /**
   * Cria um botão do shell com o mesmo vocabulário de classes do baseline.
   * @param {string} id - id do elemento.
   * @param {string} label - texto do botão.
   * @param {string} className - classes CSS.
   * @returns {object}
   */
  function criarBotao(id, label, className) {
    const botao = documentRef.createElement('button');
    botao.id = id;
    botao.type = 'button';
    botao.className = className;
    // `textContent`, nunca `innerHTML`: o rótulo é constante, e usar a API
    // segura mantém este módulo fora de qualquer caminho de markup.
    botao.textContent = label;
    host.appendChild(botao);
    return botao;
  }

  /**
   * Lê o ViewModel corrente, recusando quando ainda não há projeção (ficha
   * carregando, em erro, ou em modo somente-leitura sem canônico).
   * @returns {object|null}
   */
  function viewModelCorrente() {
    const viewModel = getViewModel();
    if (viewModel === null || viewModel === undefined) {
      notify('error', 'A ficha ainda não terminou de carregar; não há o que gerar.');
      return null;
    }
    return viewModel;
  }

  // --- PDF ------------------------------------------------------------------
  const botaoPdf = criarBotao(PDF_BUTTON_ID, 'Gerar PDF', 'btn btn-sm btn-primary');
  /**
   * @returns {Promise<void>}
   */
  const aoClicarPdf = async () => {
    if (disposed) {
      return;
    }
    const viewModel = viewModelCorrente();
    if (viewModel === null) {
      return;
    }
    botaoPdf.disabled = true;
    try {
      const resultado = await downloadPdfImpl(viewModel, { documentRef, globalRef: windowRef ?? globalThis });
      if (resultado.ok !== true) {
        // RECUSA VISÍVEL. O baseline falhava em silêncio quando o vendor não
        // carregava; aqui o jogador vê o código do erro.
        notify('error', `Não foi possível gerar o PDF (${resultado.error.code}).`);
      }
    } finally {
      if (!disposed) {
        botaoPdf.disabled = false;
      }
    }
  };
  botaoPdf.addEventListener('click', aoClicarPdf);
  teardown.push(() => botaoPdf.removeEventListener('click', aoClicarPdf));

  // --- Impressão ------------------------------------------------------------
  const botaoPrint = criarBotao(PRINT_BUTTON_ID, 'Imprimir', 'btn btn-sm btn-secondary');

  /**
   * Remove o overlay de impressão, se houver. Idempotente.
   * @returns {void}
   */
  function limparOverlay() {
    const existente = documentRef.getElementById?.(PRINT_OVERLAY_ID) ?? null;
    if (existente !== null && typeof existente.remove === 'function') {
      existente.remove();
    }
  }

  /**
   * @returns {void}
   */
  const aoClicarPrint = () => {
    if (disposed) {
      return;
    }
    const viewModel = viewModelCorrente();
    if (viewModel === null) {
      return;
    }
    // Um overlay preso de uma impressão anterior é removido ANTES, nunca
    // empilhado: dois overlays imprimiriam a ficha duas vezes.
    limparOverlay();

    let markup;
    try {
      markup = renderPrintHtmlImpl(viewModel);
    } catch (cause) {
      console.error('features/sheet/output-actions: a impressão não pôde ser montada:', cause);
      notify('error', 'Não foi possível montar a impressão.');
      return;
    }

    const overlay = documentRef.createElement('div');
    overlay.id = PRINT_OVERLAY_ID;
    // Único ponto de markup do módulo, e ele é a SAÍDA JÁ ESCAPADA de
    // `renderPrintHtml` (que passa todo texto de jogador por `escapeHtml`).
    // Nenhuma string é interpolada aqui.
    overlay.innerHTML = markup;
    (documentRef.body ?? documentRef.documentElement).appendChild(overlay);

    if (windowRef === null || typeof windowRef.print !== 'function') {
      // Ambiente sem impressão (WKWebView instalado, jsdom): o overlay é
      // desfeito e o jogador ouve o motivo, em vez de ficar com uma ficha
      // fantasma na tela.
      limparOverlay();
      notify('error', 'Este ambiente não permite imprimir; use "Gerar PDF".');
      return;
    }

    /**
     * @returns {void}
     */
    const aoTerminar = () => {
      limparOverlay();
      windowRef.removeEventListener?.('afterprint', aoTerminar);
    };
    // Registrado ANTES de `print()`: em alguns navegadores `afterprint`
    // dispara de forma síncrona.
    windowRef.addEventListener?.('afterprint', aoTerminar);
    windowRef.print();
    // Fallback: `afterprint` não é garantido em todo navegador.
    if (typeof windowRef.setTimeout === 'function') {
      windowRef.setTimeout(aoTerminar, PRINT_CLEANUP_FALLBACK_MS);
    }
  };
  botaoPrint.addEventListener('click', aoClicarPrint);
  teardown.push(() => botaoPrint.removeEventListener('click', aoClicarPrint));

  teardown.push(() => {
    botaoPdf.remove();
    botaoPrint.remove();
    limparOverlay();
  });

  /**
   * Disposer idempotente.
   * @returns {void}
   */
  function dispose() {
    if (disposed) {
      return;
    }
    disposed = true;
    for (const desfazer of teardown.splice(0)) {
      desfazer();
    }
  }

  return ok(dispose);
}
