// Passo-PLACEHOLDER do criador, usado só pelo harness de teste.
//
// Ele existe para provar que o dispatcher, o registro de passos, o controller
// e a matriz de invalidação funcionam com o SHAPE PINADO antes de qualquer
// passo real existir (os reais chegam nas Tasks 26-28, substituindo estes um a
// um). Deliberadamente:
//
//   - vive FORA de `site/`, logo nunca entra no artifact do Pages;
//   - NÃO finaliza personagem: `validate` só fica válido depois que o passo
//     recebeu uma escolha, e a escolha é sempre um valor de teste — nunca um
//     default de jogo;
//   - devolve o `InvalidationPatch` vindo da matriz oficial
//     (`buildInvalidationPatch`), não um shape ad hoc;
//   - `bind` é declarativo: devolve o descritor congelado de
//     `createStepBinding` e nunca chama `addEventListener`;
//   - `render` escapa TUDO que vem de conteúdo (nome/descrição das opções),
//     inclusive as fixtures maliciosas usadas por security-content.spec.js.

import { ok } from '../../../site/js/core/result.js';
import { escapeHtml, escapeHtmlAttribute } from '../../../site/js/ui/html.js';
import { createUiEventDecision, NO_UI_EVENT_DECISION } from '../../../site/js/ui/event-delegation.js';
import { createCreatorStep, createStepBinding } from '../../../site/js/features/creator/steps/creator-step.js';
import { buildInvalidationPatch } from '../../../site/js/features/creator/creator-invalidation.js';
import { STEP_IDENTITY_SLICE } from '../../../site/js/features/creator/creator-invalidation.js';
import { withDraftSlices } from '../../../site/js/features/creator/creator-state.js';

/**
 * Cria um passo-placeholder para `stepId`.
 *
 * @param {string} stepId
 * @param {{
 *   options?: ReadonlyArray<{id: string, name: string, description?: string}>,
 *   requireSelection?: boolean,
 *   loadDelay?: number,
 *   loadCalls?: Array<string>,
 *   provenanceFor?: (optionId: string) => ReadonlyArray<string>
 * }} [config]
 * @returns {import('../../../site/js/core/result.js').Result}
 */
export function createPlaceholderStep(stepId, config = {}) {
  const {
    options = [],
    requireSelection = true,
    loadDelay = 0,
    loadCalls = null,
    provenanceFor = null,
  } = config;
  const identitySlice = STEP_IDENTITY_SLICE[stepId];

  return createCreatorStep({
    id: stepId,

    /**
     * Carrega as "opções" do passo. Respeita `signal`: um abort antes do fim
     * do atraso encerra a carga em vez de continuar trabalhando.
     * @param {object} context
     * @returns {Promise<object>}
     */
    async load(context) {
      if (Array.isArray(loadCalls)) {
        loadCalls.push(stepId);
      }
      if (loadDelay > 0) {
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, loadDelay);
          if (context.signal && typeof context.signal.addEventListener === 'function') {
            context.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                resolve(undefined);
              },
              { once: true },
            );
          }
        });
      }
      return ok(Object.freeze({ stepId, options: Object.freeze([...options]) }));
    },

    /**
     * Markup do passo. TODO valor de conteúdo passa por escape — nunca
     * interpolação crua, nem "só desta vez".
     * @param {object} context
     * @returns {string}
     */
    render(context) {
      const data = context.data;
      const selected = identitySlice ? context.draft.slices[identitySlice] : null;
      const items = (data?.options ?? [])
        .map(
          (option) =>
            `<button type="button" class="placeholder-option" data-placeholder-option="${escapeHtmlAttribute(option.id)}">` +
            `<span class="placeholder-option-name">${escapeHtml(option.name)}</span>` +
            `<span class="placeholder-option-desc" title="${escapeHtmlAttribute(option.description ?? '')}">${escapeHtml(
              option.description ?? '',
            )}</span>` +
            '</button>',
        )
        .join('');
      return (
        `<section data-placeholder-step="${escapeHtmlAttribute(stepId)}" ` +
        `data-placeholder-selected="${escapeHtmlAttribute(selected === null || selected === undefined ? '' : String(selected))}">` +
        `<h2>${escapeHtml(stepId)}</h2>` +
        `<div class="placeholder-options">${items}</div>` +
        '</section>'
      );
    },

    /**
     * Descritor DECLARATIVO. Nenhum `addEventListener` aqui.
     * @returns {Readonly<object>}
     */
    bind() {
      return createStepBinding({
        eventTypes: ['click'],
        /**
         * @param {object} event
         * @returns {Readonly<object>}
         */
        toIntent(event) {
          const target = event.target;
          const element =
            target && typeof target.closest === 'function' ? target.closest('[data-placeholder-option]') : null;
          if (!element) {
            return NO_UI_EVENT_DECISION;
          }
          return createUiEventDecision({
            intent: { type: 'placeholder/select', stepId, optionId: element.getAttribute('data-placeholder-option') },
            preventDefault: true,
            stopPropagation: false,
          });
        },
      });
    },

    /**
     * @param {object} context
     * @returns {object} ValidationResult
     */
    validate(context) {
      if (!requireSelection || !identitySlice) {
        return { valid: true, errors: [] };
      }
      const selected = context.draft.slices[identitySlice];
      return selected === null || selected === undefined
        ? { valid: false, errors: [{ code: 'PLACEHOLDER_SELECTION_REQUIRED', stepId }] }
        : { valid: true, errors: [] };
    },

    /**
     * Delega para a matriz OFICIAL — nenhum shape ad hoc.
     * @param {object} context
     * @returns {object} Result<InvalidationPatch>
     */
    invalidate(context) {
      return buildInvalidationPatch(stepId, { draft: context.draft });
    },

    /**
     * Ponto de extensão: aplica a seleção ao rascunho, registrando a
     * proveniência com os MESMOS `sourceInstanceId`s que uma aplicação real
     * de concessão usaria.
     * @param {object} context
     * @param {object} intent
     * @returns {object} Result
     */
    reduce(context, intent) {
      if (intent.type !== 'placeholder/select' || !identitySlice) {
        return ok(Object.freeze({ draft: context.draft }));
      }
      const provenance = provenanceFor
        ? provenanceFor(intent.optionId)
        : [`${stepId}#${intent.optionId}`];
      const next = withDraftSlices(context.draft, {
        slices: { [identitySlice]: intent.optionId },
        provenance: { [identitySlice]: [...provenance] },
      });
      if (next.ok !== true) {
        return next;
      }
      return ok(Object.freeze({ draft: next.value }));
    },
  });
}
