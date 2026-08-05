// Seção-PLACEHOLDER da ficha, usada só pelo harness e pelos testes da Task 29.
//
// Ela existe para provar que a SESSÃO, o mapa de comandos, o registro de
// seções e o controller funcionam com o SHAPE PINADO antes de qualquer seção
// real existir (as reais chegam nas Tasks 30-32, substituindo estas uma a
// uma). Deliberadamente:
//
//   - vive FORA de `site/`, logo nunca entra no artifact do Pages;
//   - NÃO calcula regra de jogo: só lê `viewModel.derived`/`viewModel.data`;
//   - `toIntent` é declarativo — devolve `UiEventDecision`, nunca chama
//     `preventDefault` nem `addEventListener`;
//   - `render` escapa TUDO que vem de conteúdo (nome do personagem inclusive),
//     porque é markup produzido a partir de dado não confiável.

import { escapeHtml, escapeHtmlAttribute } from '../../../site/js/ui/html.js';
import { createUiEventDecision, NO_UI_EVENT_DECISION } from '../../../site/js/ui/event-delegation.js';
import { createSheetSection } from '../../../site/js/features/sheet/sections/section-registry.js';
import { createSheetIntent, SHEET_INTENT_TYPES } from '../../../site/js/features/sheet/sheet-state.js';

/**
 * Cria uma seção-placeholder para `sectionId`.
 *
 * @param {string} sectionId
 * @param {{
 *   commandFor?: (element: object) => object|null,
 *   renderCalls?: Array<string>,
 *   eventTypes?: ReadonlyArray<string>
 * }} [config]
 * @returns {import('../../../site/js/core/result.js').Result}
 */
export function createPlaceholderSection(sectionId, config = {}) {
  const { commandFor = null, renderCalls = null, eventTypes = ['click'] } = config;

  return createSheetSection({
    id: sectionId,
    eventTypes,

    /**
     * Recorte do ViewModel. Nada além de leitura.
     * @param {object|null} viewModel
     * @returns {object|null}
     */
    select(viewModel) {
      if (viewModel === null || viewModel === undefined) {
        return null;
      }
      return {
        name: viewModel.data?.identity?.name ?? '',
        hitPoints: viewModel.derived?.hitPoints ?? null,
        armorClass: viewModel.derived?.armorClass ?? null,
        conditions: viewModel.data?.state?.conditions ?? [],
        wallet: viewModel.data?.state?.wallet ?? null,
      };
    },

    /**
     * @param {object|null} projection
     * @param {object} uiState
     * @returns {string}
     */
    render(projection, uiState) {
      if (Array.isArray(renderCalls)) {
        renderCalls.push(sectionId);
      }
      if (projection === null) {
        return `<p data-placeholder-empty="${escapeHtmlAttribute(sectionId)}">sem projeção</p>`;
      }
      return (
        `<div data-placeholder-section="${escapeHtmlAttribute(sectionId)}" ` +
        `data-placeholder-focused="${escapeHtmlAttribute(uiState?.focusedSectionId ?? '')}">` +
        `<span data-placeholder-name>${escapeHtml(projection.name)}</span>` +
        `<span data-placeholder-hp>${escapeHtml(String(projection.hitPoints?.current ?? ''))}</span>` +
        `<span data-placeholder-temp>${escapeHtml(String(projection.hitPoints?.temporary ?? ''))}</span>` +
        `<span data-placeholder-ac>${escapeHtml(String(projection.armorClass ?? ''))}</span>` +
        `<span data-placeholder-conditions>${escapeHtml(projection.conditions.join(','))}</span>` +
        `<button type="button" data-placeholder-damage="1">dano</button>` +
        `<button type="button" data-placeholder-modal="1">modal</button>` +
        '</div>'
      );
    },

    /**
     * DECLARATIVO: descreve o significado do evento e devolve a decisão.
     * @param {object} event
     * @returns {Readonly<object>}
     */
    toIntent(event) {
      const target = event.target;
      const element = target && typeof target.closest === 'function' ? target : (target?.parentElement ?? null);
      if (element === null || typeof element.closest !== 'function') {
        return NO_UI_EVENT_DECISION;
      }

      const modalButton = element.closest('[data-placeholder-modal]');
      if (modalButton !== null) {
        return createUiEventDecision({
          intent: createSheetIntent(SHEET_INTENT_TYPES.modalOpen, {
            modalId: `placeholder-${sectionId}`,
            title: 'Placeholder',
            content: `<button type="button" data-sheet-modal-owner="${escapeHtmlAttribute(sectionId)}" data-placeholder-modal-confirm="1">confirmar</button>`,
          }),
          preventDefault: true,
        });
      }

      const damageButton = element.closest('[data-placeholder-damage]');
      const confirmButton = element.closest('[data-placeholder-modal-confirm]');
      if (damageButton === null && confirmButton === null) {
        return NO_UI_EVENT_DECISION;
      }

      const command =
        commandFor !== null ? commandFor(damageButton ?? confirmButton) : { type: 'apply-damage', amount: 1 };
      if (command === null) {
        return NO_UI_EVENT_DECISION;
      }
      return createUiEventDecision({
        intent: createSheetIntent(SHEET_INTENT_TYPES.command, { command }),
        preventDefault: true,
      });
    },
  });
}
