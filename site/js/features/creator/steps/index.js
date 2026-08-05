// Módulo `features/creator/steps/index`: ponto de montagem dos passos REAIS
// do criador.
//
// Na Task 26 os três primeiros passos ficaram reais (`classe`, `especie`,
// `antecedente`); a Task 27 acrescentou `atributos` e `equipamento`, e a
// Task 28 fechou os SETE com `magias` e `detalhes`. `createDefaultStepRegistry()`
// continua exigindo os sete: um registro incompleto falha com
// `CREATOR_STEP_REGISTRY_INCOMPLETE` — uma falha ALTA e nomeada, não um wizard
// que silenciosamente pula etapas.
//
// Os passos-placeholder que preenchem os sete IDs vivem EXCLUSIVAMENTE no
// harness de teste (`tests/e2e/harness/placeholder-creator-step.js`), fora de
// `site/`, e nunca são publicados no artifact do Pages: um placeholder no
// runtime público seria um passo que aceita avançar sem validar nada.

import { ok } from '../../../core/result.js';
import { createStepRegistry } from './step-registry.js';
import { createClassStep } from './class-step.js';
import { createSpeciesStep } from './species-step.js';
import { createBackgroundStep } from './background-step.js';
import { createAbilitiesStep } from './abilities-step.js';
import { createEquipmentStep } from './equipment-step.js';
import { createSpellsStep } from './spells-step.js';
import { createDetailsStep } from './details-step.js';

export { createCreatorStep, createStepBinding, assertDeclarativeBinding, stepError } from './creator-step.js';
export { createStepRegistry } from './step-registry.js';
export { CREATOR_STEP_IDS } from '../creator-state.js';
export { createClassStep } from './class-step.js';
export { createSpeciesStep } from './species-step.js';
export { createBackgroundStep } from './background-step.js';
export { createAbilitiesStep, ABILITIES_INTENT_TYPES, ABILITY_METHODS, ENABLED_ABILITY_METHODS } from './abilities-step.js';
export { createEquipmentStep, EQUIPMENT_INTENT_TYPES } from './equipment-step.js';
export { createSpellsStep, SPELLS_INTENT_TYPES, SPELLBOOK_PREPARERS } from './spells-step.js';
export { createDetailsStep, DETAILS_INTENT_TYPES, ALIGNMENTS, DETAILS_TEXT_FIELDS } from './details-step.js';

/**
 * Constrói os passos reais já migrados, na ordem do wizard.
 *
 * A construção pode FALHAR (é `createCreatorStep` quem valida o contrato,
 * inclusive o binding declarativo), então o resultado é um `Result` — nunca
 * uma lista parcial silenciosa.
 * @returns {import('../../../core/result.js').Result} `ok(ReadonlyArray<object>)`
 */
export function buildRealCreatorSteps() {
  const built = [];
  for (const factory of [
    createClassStep,
    createSpeciesStep,
    createBackgroundStep,
    createAbilitiesStep,
    createEquipmentStep,
    createSpellsStep,
    createDetailsStep,
  ]) {
    const created = factory();
    if (created.ok !== true) {
      return created;
    }
    built.push(created.value);
  }
  return ok(Object.freeze(built));
}

/**
 * Monta o registro de produção a partir dos passos reais já migrados.
 * @returns {import('../../../core/result.js').Result}
 */
export function createDefaultStepRegistry() {
  const steps = buildRealCreatorSteps();
  if (steps.ok !== true) {
    return steps;
  }
  return createStepRegistry([...steps.value]);
}
