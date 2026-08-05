// Módulo `features/creator/steps/step-registry`: o registro ordenado dos
// passos do criador.
//
// O registro é FECHADO por construção: só aceita os sete IDs conhecidos, um
// por ID, e sempre expõe os passos na ordem canônica do wizard — nunca na
// ordem em que foram registrados. Assim a navegação (`next`/`previous`) não
// depende de ordem de import, e um passo faltando é um erro explícito em vez
// de um wizard que simplesmente pula uma etapa.

import { ok, err } from '../../../core/result.js';
import { createAppError } from '../../../core/errors.js';
import { CREATOR_STEP_IDS, isCreatorStepId } from '../creator-state.js';

const SCOPE = 'features.creator.step-registry';

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
 * Cria um registro de passos.
 *
 * @param {ReadonlyArray<object>} steps - passos já validados por
 *   `createCreatorStep`.
 * @param {{requireAll?: boolean}} [options] - `requireAll` (padrão `true`)
 *   exige que os sete passos estejam presentes.
 * @returns {import('../../../core/result.js').Result} `ok(registry)`
 */
export function createStepRegistry(steps, { requireAll = true } = {}) {
  if (!Array.isArray(steps)) {
    return err(registryError('CREATOR_STEP_REGISTRY_INVALID', '"steps" deve ser um array de passos.'));
  }

  /** @type {Map<string, object>} */
  const byId = new Map();
  for (const step of steps) {
    if (step === null || typeof step !== 'object' || !isCreatorStepId(step.id)) {
      return err(registryError('CREATOR_STEP_REGISTRY_ENTRY_INVALID', 'Cada entrada do registro deve ser um passo com id conhecido.'));
    }
    if (byId.has(step.id)) {
      return err(
        registryError('CREATOR_STEP_REGISTRY_DUPLICATE', `O passo "${step.id}" foi registrado mais de uma vez.`, { stepId: step.id }),
      );
    }
    byId.set(step.id, step);
  }

  if (requireAll) {
    const missing = CREATOR_STEP_IDS.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      return err(
        registryError('CREATOR_STEP_REGISTRY_INCOMPLETE', `O registro não cobre todos os passos: ${missing.join(', ')}.`, {
          missing,
        }),
      );
    }
  }

  // Ordem canônica do wizard, independente da ordem de registro.
  const ordered = Object.freeze(CREATOR_STEP_IDS.filter((id) => byId.has(id)));

  return ok(
    Object.freeze({
      /**
       * @param {string} id
       * @returns {object|null} o passo, ou `null` quando não registrado.
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
      stepIds() {
        return ordered;
      },
      /**
       * @returns {ReadonlyArray<object>} passos na ordem canônica.
       */
      list() {
        return Object.freeze(ordered.map((id) => byId.get(id)));
      },
    }),
  );
}
