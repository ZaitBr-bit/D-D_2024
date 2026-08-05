// Módulo `features/sheet/print/print-view`: a IMPRESSÃO da ficha.
//
// ## Uma projeção, três saídas
//
// Tela (`sections/**`), impressão (aqui) e PDF (`../pdf/pdf-drawing-plan.js`)
// consomem o MESMO `SheetViewModel`, e impressão e PDF consomem além disso o
// mesmo `buildSheetOutputModel` (`../output-model.js`). A diferença entre esta
// saída e o PDF é de LAYOUT — quais blocos cabem em qual página, que fonte,
// que cor —, nunca de VALOR. É o que o teste de contrato
// `tests/contract/sheet-output-parity.test.js` prende.
//
// No baseline (`sheet.js#gerarHtmlImpressao`) não era assim: a impressão lia
// `char.pv_temp` e `char.dados_vida_disponiveis`, campos que não existem no
// registro, e por isso mostrava `0` e um número errado de dados de vida — as
// duas divergências registradas em `baselineDifferences` de
// `tests/fixtures/expected/derived-values.json`. Aqui não há uma segunda
// leitura do personagem para errar: só existe a do ViewModel.
//
// ## Sem DOM e sem regra
//
// A função é PURA: devolve string, não toca `document`, não faz `fetch` e não
// calcula nada de jogo. Quem materializa o overlay e chama `window.print()` é
// o composition root — e é ele quem precisa fazê-lo SINCRONAMENTE dentro do
// gesto de clique (iOS Safari e Android Chrome bloqueiam um `print()` que
// chegue depois de um `await`; a nota está no baseline e continua valendo).
//
// ## Escape
//
// Todo texto passa por `escapeHtml`/`escapeHtmlAttribute`: nome, anotações e
// nomes de item vêm de `localStorage`, de JSON importado e do Firestore.

import { escapeHtml, escapeHtmlAttribute } from '../../../ui/html.js';
import { buildSheetOutputModel } from '../output-model.js';

/**
 * Atributo que identifica a raiz do documento impresso.
 * @type {string}
 */
export const PRINT_ROOT_ATTRIBUTE = 'data-sheet-print';

/**
 * Id do overlay de impressão. É o MESMO do baseline (`#print-overlay`), de
 * propósito: o bloco `@media print` de `site/css/app.css` já esconde
 * `#app-content` e revela este id. Trocar o nome exigiria reescrever a folha
 * de estilo por nada.
 * @type {string}
 */
export const PRINT_OVERLAY_ID = 'print-overlay';

/**
 * Blocos que compõem a PRIMEIRA página (o resumo que cabe numa folha). Os
 * demais fluem nas páginas seguintes, na ordem do modelo de saída.
 * @type {ReadonlyArray<string>}
 */
export const FIRST_PAGE_BLOCK_IDS = Object.freeze(['combat', 'abilities', 'saving-throws', 'skills', 'senses', 'defenses']);

/**
 * Regras `@media print` PRÓPRIAS desta saída.
 *
 * `site/css/app.css` já traz o grosso (esconder o app, revelar `#print-overlay`,
 * quebra de página, tipografia). O que vai aqui é só o que os blocos NOVOS
 * precisam e a folha antiga não conhece — e vai embutido para que a impressão
 * funcione mesmo se o overlay for montado num documento sem a folha do app
 * (é o caso do teste focal, que renderiza a string isolada).
 * @type {string}
 */
export const PRINT_STYLES = [
  '@media print{',
  `#${PRINT_OVERLAY_ID}{display:block!important}`,
  '.print-page{page-break-after:always}',
  '.print-page:last-child{page-break-after:auto}',
  '.sheet-print-entries{display:flex;flex-wrap:wrap;gap:2mm}',
  '.sheet-print-entry{border:1px solid #999;border-radius:2px;padding:1mm 2mm;min-width:16mm}',
  '.sheet-print-entry-label{font-size:5.5pt;text-transform:uppercase;color:#666}',
  '.sheet-print-entry-value{font-size:9pt;font-weight:700}',
  '.sheet-print-unavailable{font-size:7pt;color:#900}',
  '}',
].join('');

/**
 * Markup de UMA entrada.
 * @param {object} entrada
 * @returns {string}
 */
function renderEntry(entrada) {
  return (
    `<div class="sheet-print-entry" data-print-semantic="${escapeHtmlAttribute(entrada.semantic)}">` +
    `<div class="sheet-print-entry-label">${escapeHtml(entrada.label)}</div>` +
    `<div class="sheet-print-entry-value">${escapeHtml(entrada.text)}</div>` +
    '</div>'
  );
}

/**
 * Markup de UM bloco (uma seção da folha).
 *
 * Um bloco INDISPONÍVEL (hoje só o inventário, quando não há catálogo para
 * resolver item nenhum) imprime o MOTIVO. Imprimir uma seção vazia diria ao
 * jogador que ele não tem itens — que é falso, e é o bypass silencioso que
 * esta arquitetura persegue.
 * @param {object} bloco
 * @returns {string}
 */
function renderBlock(bloco) {
  const indisponivel =
    typeof bloco.unavailableReason === 'string' && bloco.unavailableReason.length > 0
      ? `<p class="sheet-print-unavailable" data-print-unavailable="${escapeHtmlAttribute(bloco.unavailableReason)}">` +
        `Esta seção não pôde ser calculada (${escapeHtml(bloco.unavailableReason)}).</p>`
      : '';
  return (
    `<div class="print-section" data-print-block="${escapeHtmlAttribute(bloco.id)}">` +
    `<div class="print-section-title">${escapeHtml(bloco.title)}</div>` +
    indisponivel +
    `<div class="sheet-print-entries">${bloco.entries.map(renderEntry).join('')}</div>` +
    '</div>'
  );
}

/**
 * Renderiza o HTML de impressão da ficha.
 *
 * @param {object} viewModel - `SheetViewModel`.
 * @param {{includeStyles?: boolean, moduleName?: string}} [ports] - `includeStyles`
 *   embute `PRINT_STYLES` (padrão `true`); `moduleName` identifica a origem do
 *   markup no atributo da raiz, como em `sheet-view.js`.
 * @returns {string}
 */
export function renderPrintHtml(viewModel, ports = {}) {
  const { includeStyles = true, moduleName = 'features/sheet/print' } = ports ?? {};

  const modelo = buildSheetOutputModel(viewModel);
  if (modelo.ok !== true) {
    // RECUSA VISÍVEL. Uma string vazia produziria uma folha em branco sem
    // explicação — o jogador imprimiria papel e não saberia por quê.
    return (
      `<div ${PRINT_ROOT_ATTRIBUTE}="error" data-print-error="${escapeHtmlAttribute(modelo.error.code)}">` +
      `<div class="print-page"><p>Não foi possível preparar a impressão: ${escapeHtml(modelo.error.message)}</p></div>` +
      '</div>'
    );
  }

  const { headline, blocks } = modelo.value;
  const primeira = blocks.filter((bloco) => FIRST_PAGE_BLOCK_IDS.includes(bloco.id));
  const demais = blocks.filter((bloco) => !FIRST_PAGE_BLOCK_IDS.includes(bloco.id));

  const cabecalho =
    '<div class="print-char-header">' +
    `<div class="print-char-name">${escapeHtml(headline.name)}</div>` +
    `<div class="print-char-sub">${escapeHtml(headline.subtitle)}</div>` +
    '</div>';

  const paginaUm = `<div class="print-page">${cabecalho}${primeira.map(renderBlock).join('')}</div>`;
  const paginasSeguintes = demais.length === 0 ? '' : `<div class="print-page">${demais.map(renderBlock).join('')}</div>`;

  return (
    `<div ${PRINT_ROOT_ATTRIBUTE}="ready" data-print-module="${escapeHtmlAttribute(moduleName)}" ` +
    `data-print-character="${escapeHtmlAttribute(modelo.value.characterId ?? '')}">` +
    (includeStyles ? `<style>${PRINT_STYLES}</style>` : '') +
    paginaUm +
    paginasSeguintes +
    '</div>'
  );
}
