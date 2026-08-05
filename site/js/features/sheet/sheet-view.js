// Módulo `features/sheet/sheet-view`: o SHELL da ficha — o casco estável
// dentro do qual cada seção desenha o seu miolo.
//
// A divisão shell/miolo não é estética: é o que torna o rerender PARCIAL
// possível. O shell é desenhado uma vez (e só é redesenhado quando o
// status/modo/erro muda); cada seção tem um contêiner com identidade estável
// (`[data-sheet-section="<id>"] > [data-sheet-section-body]`), e um
// `dirtySections` repinta apenas esses miolos. Redesenhar o contêiner inteiro
// a cada comando destruiria nós que o usuário está tocando — o defeito que a
// Task 28b caçou no criador (clique engolido entre `mousedown` e `mouseup`).
//
// Todo texto que entra no markup passa por `escapeHtml`/`escapeHtmlAttribute`:
// nome de seção, código de erro e mensagem podem carregar conteúdo de catálogo
// não confiável.

import { escapeHtml, escapeHtmlAttribute } from '../../ui/html.js';
import { SHEET_MODE, SHEET_SECTION_IDS, SHEET_SECTION_LABELS } from './sheet-state.js';

/**
 * Atributo que identifica o contêiner de uma seção.
 * @type {string}
 */
export const SECTION_ATTRIBUTE = 'data-sheet-section';

/**
 * Atributo do MIOLO de uma seção — o único nó reescrito num rerender parcial.
 * @type {string}
 */
export const SECTION_BODY_ATTRIBUTE = 'data-sheet-section-body';

/**
 * Seletor do miolo de uma seção.
 * @param {string} sectionId
 * @returns {string}
 */
export function sectionBodySelector(sectionId) {
  return `[${SECTION_ATTRIBUTE}="${sectionId}"] [${SECTION_BODY_ATTRIBUTE}]`;
}

/**
 * Assinatura do shell: tudo o que `renderSheetShell` desenha FORA dos miolos
 * depende só destes campos. Enquanto ela não muda, nenhum contêiner de seção
 * é destruído.
 * @param {object} snapshot
 * @returns {string}
 */
export function shellKeyOf(snapshot) {
  // `syncState` e `error` NÃO entram: eles mudam a cada comando, e pô-los aqui
  // faria todo comando redesenhar a ficha inteira — matando o rerender
  // parcial e destruindo o nó que o jogador está tocando. Os dois são
  // atualizados NO LUGAR por `updateSheetNotices`.
  return JSON.stringify([
    snapshot.characterId,
    snapshot.status,
    snapshot.mode,
    SHEET_SECTION_IDS.map((id) => snapshot.uiState?.collapsed?.[id] === true),
  ]);
}

/**
 * Atributo do bloco de avisos (estado de sincronização e erro), atualizado no
 * lugar a cada render.
 * @type {string}
 */
export const NOTICES_ATTRIBUTE = 'data-sheet-notices';

/**
 * Markup do bloco de avisos.
 * @param {object} snapshot
 * @returns {string}
 */
export function renderSheetNotices(snapshot) {
  const modo =
    snapshot.mode === SHEET_MODE.readOnly
      ? '<p class="sheet-read-only" data-sheet-read-only="true">Esta ficha foi gravada por uma versão mais nova e está em modo somente leitura.</p>'
      : '';
  const erro =
    snapshot.error !== null && snapshot.error !== undefined
      ? `<p class="sheet-error" data-sheet-error="${escapeHtmlAttribute(snapshot.error.code ?? '')}">${escapeHtml(
          snapshot.error.message ?? '',
        )}</p>`
      : '';
  const pendencias = (snapshot.syncFailures ?? [])
    .map(
      (failure) =>
        `<p class="sheet-sync-failure" data-sheet-failure="${escapeHtmlAttribute(failure.failureId ?? '')}" ` +
        `data-sheet-failure-code="${escapeHtmlAttribute(failure.code ?? '')}">${escapeHtml(failure.message ?? failure.code ?? '')}` +
        `<button type="button" data-sheet-retry="${escapeHtmlAttribute(failure.failureId ?? '')}">tentar novamente</button></p>`,
    )
    .join('');
  return modo + erro + pendencias;
}

/**
 * Atualiza NO LUGAR o que muda a cada comando sem alterar a estrutura: o
 * estado de sincronização (atributo da raiz) e o bloco de avisos.
 * @param {object} root - o contêiner do mount.
 * @param {object} snapshot
 * @returns {void}
 */
export function updateSheetNotices(root, snapshot) {
  const raiz = typeof root.querySelector === 'function' ? root.querySelector('[data-sheet-sync]') : null;
  if (raiz !== null) {
    raiz.setAttribute('data-sheet-sync', snapshot.syncState ?? '');
  }
  const avisos = typeof root.querySelector === 'function' ? root.querySelector(`[${NOTICES_ATTRIBUTE}]`) : null;
  if (avisos !== null) {
    avisos.innerHTML = renderSheetNotices(snapshot);
  }
}

/**
 * Desenha o shell com os miolos já renderizados.
 *
 * @param {object} snapshot - SheetSnapshot.
 * @param {Map<string, string>|Record<string, string>} sectionMarkup - miolo por seção.
 * @param {{moduleName?: string, sectionIds?: ReadonlyArray<string>}} [options]
 * @returns {string}
 */
export function renderSheetShell(snapshot, sectionMarkup, { moduleName = 'features/sheet', sectionIds = SHEET_SECTION_IDS } = {}) {
  /**
   * @param {string} sectionId
   * @returns {string}
   */
  const miolo = (sectionId) => {
    const value = sectionMarkup instanceof Map ? sectionMarkup.get(sectionId) : sectionMarkup?.[sectionId];
    return typeof value === 'string' ? value : '';
  };

  const secoes = sectionIds
    .map((sectionId) => {
      const colapsada = snapshot.uiState?.collapsed?.[sectionId] === true;
      return (
        `<section ${SECTION_ATTRIBUTE}="${escapeHtmlAttribute(sectionId)}" ` +
        `data-collapsed="${colapsada ? 'true' : 'false'}">` +
        `<header class="sheet-section-header">` +
        `<button type="button" data-sheet-toggle="${escapeHtmlAttribute(sectionId)}" aria-expanded="${colapsada ? 'false' : 'true'}">` +
        // O TEXTO é o rótulo do jogador; a IDENTIDADE continua no atributo
        // `data-sheet-toggle`. Uma seção sem rótulo declarado cai no próprio
        // id — visível e feio, que é melhor do que um cabeçalho vazio.
        `${escapeHtml(SHEET_SECTION_LABELS[sectionId] ?? sectionId)}</button>` +
        '</header>' +
        // `hidden` é atributo BOOLEANO: `hidden=""` esconde o elemento tanto
        // quanto `hidden="hidden"`. Ele precisa ESTAR AUSENTE quando a seção
        // está aberta — emiti-lo vazio deixava a ficha inteira invisível.
        `<div ${SECTION_BODY_ATTRIBUTE}${colapsada ? ' hidden' : ''}>${miolo(sectionId)}</div>` +
        '</section>'
      );
    })
    .join('');

  return (
    `<div class="sheet-root" data-sheet-module="${escapeHtmlAttribute(moduleName)}" ` +
    `data-sheet-character="${escapeHtmlAttribute(snapshot.characterId ?? '')}" ` +
    `data-sheet-status="${escapeHtmlAttribute(snapshot.status ?? '')}" ` +
    `data-sheet-mode="${escapeHtmlAttribute(snapshot.mode ?? '')}" ` +
    `data-sheet-sync="${escapeHtmlAttribute(snapshot.syncState ?? '')}">` +
    `<div ${NOTICES_ATTRIBUTE}>${renderSheetNotices(snapshot)}</div>` +
    `<div class="sheet-sections">${secoes}</div>` +
    '</div>'
  );
}
