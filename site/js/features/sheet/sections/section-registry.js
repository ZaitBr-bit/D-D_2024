// Módulo `features/sheet/sections/section-registry`: o SHAPE de uma seção da
// ficha e o registro ordenado delas.
//
// ## O contrato de seção (brief da Task 29)
//
//     { id, select(viewModel), render(projection, uiState), toIntent(event, ctx) }
//
// As quatro peças são deliberadamente pobres:
//
//   - `select(viewModel)` recorta do ViewModel a PROJEÇÃO daquela seção. É
//     puro, e é o único ponto em que a seção decide o que a interessa;
//   - `render(projection, uiState)` devolve MARKUP (string). Não recebe o
//     personagem, não recebe o repositório, não recebe o serviço de modal;
//   - `toIntent(event, {root, projection, uiState})` devolve uma
//     `UiEventDecision` — DESCREVE o que o evento significa. A seção nunca
//     chama `preventDefault`, nunca registra listener, nunca abre modal.
//     Quem faz tudo isso é o controller, uma vez só, na raiz;
//   - `eventTypes` (opcional, padrão `['click']`) declara os tipos de evento
//     que a seção quer ouvir. O controller calcula a união UMA vez no mount:
//     o conjunto de listeners é estável e auditável, não algo que cresce a
//     cada rerender.
//
// ## Por que o registro é fechado
//
// `SHEET_SECTION_IDS` (`../sheet-state.js`) é a lista canônica; o registro só
// aceita esses IDs, um por ID, e sempre lista na ordem canônica. Assim
// `dirtySections` (produzido por `sheet-command-map.js` sobre a MESMA lista)
// nunca aponta para uma seção que não existe, e uma seção faltando é um erro
// explícito em vez de um pedaço de ficha que some sem aviso.

import { ok, err } from '../../../core/result.js';
import { createAppError } from '../../../core/errors.js';
import { NO_UI_EVENT_DECISION, isUiEventDecision } from '../../../ui/event-delegation.js';
import { SHEET_SECTION_IDS, isSheetSectionId } from '../sheet-state.js';

const SCOPE = 'features.sheet.section-registry';

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
function registryError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Valida e congela uma seção da ficha.
 *
 * @param {{
 *   id: string,
 *   select: (viewModel: object) => *,
 *   render: (projection: *, uiState: object) => string,
 *   toIntent?: (event: object, context: object) => object,
 *   eventTypes?: ReadonlyArray<string>
 * }} definition
 * @returns {import('../../../core/result.js').Result} Result<Section, AppError>
 */
export function createSheetSection(definition = {}) {
  const { id, select, render, toIntent = null, eventTypes = ['click'] } = definition;

  if (!isSheetSectionId(id)) {
    return err(registryError('SHEET_SECTION_ID_UNKNOWN', `"${String(id)}" não é uma seção da ficha.`, { id: String(id) }));
  }
  for (const [name, fn] of [
    ['select', select],
    ['render', render],
  ]) {
    if (typeof fn !== 'function') {
      return err(registryError('SHEET_SECTION_SHAPE_INVALID', `A seção "${id}" precisa de "${name}" (função).`, { id, name }));
    }
  }
  if (toIntent !== null && typeof toIntent !== 'function') {
    return err(registryError('SHEET_SECTION_SHAPE_INVALID', `"toIntent" da seção "${id}" deve ser uma função.`, { id }));
  }
  if (!Array.isArray(eventTypes) || eventTypes.some((type) => typeof type !== 'string' || type.length === 0)) {
    return err(registryError('SHEET_SECTION_EVENT_TYPES_INVALID', `"eventTypes" da seção "${id}" deve ser um array de strings.`, { id }));
  }

  return ok(
    Object.freeze({
      id,
      select,
      render,
      /**
       * Envelope de `toIntent` que garante o contrato de retorno: uma seção
       * sem `toIntent` (ou que devolva algo que não é `UiEventDecision`) vira
       * a decisão NEUTRA, nunca um valor solto que o controller aplicaria ao
       * evento sem saber o que é.
       * @param {object} event
       * @param {object} context
       * @returns {Readonly<object>} UiEventDecision
       */
      toIntent(event, context) {
        if (toIntent === null) {
          return NO_UI_EVENT_DECISION;
        }
        const decision = toIntent(event, context);
        return isUiEventDecision(decision) ? decision : NO_UI_EVENT_DECISION;
      },
      eventTypes: Object.freeze([...eventTypes]),
    }),
  );
}

/**
 * Cria o registro ordenado de seções.
 *
 * @param {ReadonlyArray<object>} sections - seções já validadas por
 *   `createSheetSection`.
 * @param {{requireAll?: boolean}} [options] - `requireAll` (padrão `true`)
 *   exige que as sete seções canônicas estejam presentes.
 * @returns {import('../../../core/result.js').Result} Result<SectionRegistry, AppError>
 */
export function createSectionRegistry(sections, { requireAll = true } = {}) {
  if (!Array.isArray(sections)) {
    return err(registryError('SHEET_SECTION_REGISTRY_INVALID', '"sections" deve ser um array de seções.'));
  }

  /** @type {Map<string, object>} */
  const byId = new Map();
  for (const section of sections) {
    if (section === null || typeof section !== 'object' || !isSheetSectionId(section.id)) {
      return err(registryError('SHEET_SECTION_REGISTRY_ENTRY_INVALID', 'Cada entrada do registro deve ser uma seção com id conhecido.'));
    }
    if (byId.has(section.id)) {
      return err(
        registryError('SHEET_SECTION_REGISTRY_DUPLICATE', `A seção "${section.id}" foi registrada mais de uma vez.`, {
          sectionId: section.id,
        }),
      );
    }
    byId.set(section.id, section);
  }

  if (requireAll) {
    const missing = SHEET_SECTION_IDS.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      return err(
        registryError('SHEET_SECTION_REGISTRY_INCOMPLETE', `O registro não cobre todas as seções: ${missing.join(', ')}.`, {
          missing,
        }),
      );
    }
  }

  const ordered = Object.freeze(SHEET_SECTION_IDS.filter((id) => byId.has(id)));

  return ok(
    Object.freeze({
      /**
       * @param {string} id
       * @returns {object|null}
       */
      get(id) {
        return byId.get(id) ?? null;
      },
      /**
       * @param {string} id
       * @returns {boolean}
       */
      has(id) {
        return byId.has(id);
      },
      /**
       * @returns {ReadonlyArray<string>} IDs na ordem canônica.
       */
      sectionIds() {
        return ordered;
      },
      /**
       * @returns {ReadonlyArray<object>} seções na ordem canônica.
       */
      list() {
        return Object.freeze(ordered.map((id) => byId.get(id)));
      },
      /**
       * União ordenada dos `eventTypes` declarados. O controller registra
       * exatamente estes listeners, uma vez.
       * @returns {ReadonlyArray<string>}
       */
      eventTypes() {
        const types = new Set();
        for (const id of ordered) {
          for (const type of byId.get(id).eventTypes ?? []) {
            types.add(type);
          }
        }
        return Object.freeze([...types]);
      },
    }),
  );
}
