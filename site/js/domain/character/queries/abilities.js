// Módulo `domain/character/queries/abilities`: consultas puras de
// modificador de habilidade e bônus de proficiência — a base de quase todo
// outro cálculo derivado (CA, perícias, salvaguardas, CD de magia). Extraído
// de `site/js/utils.js#calcMod`/`#bonusProficiencia`, hoje duplicados
// implicitamente em cada tela (screen/print/PDF) que os chama. Consulta pura:
// nunca muta `character`/`context`, nunca lê `window`/`fetch`/Firebase (ver
// scripts/check-architecture.mjs).

import { ok, err } from '../../../core/result.js';
import {
  requireCharacterShape,
  resolveAbilityKey,
  collectEffectsOptional,
  applyNumericEffects,
  queryError,
} from './internal/shared.js';

/**
 * Calcula o modificador de um valor de habilidade (regra padrão do 5e:
 * `floor((valor - 10) / 2)`).
 * @param {number} score
 * @returns {number}
 */
function abilityModifierFromScore(score) {
  return Math.floor((score - 10) / 2);
}

/**
 * Consulta o modificador de uma habilidade do personagem. `abilityId` aceita
 * a chave canônica (`"forca"`) ou um ContentId de habilidade do ruleset
 * (`"dnd2024:ability:forca"`) — nunca um nome de exibição em português solto.
 * Quando `context.registry` está presente, aplica efeitos declarativos com
 * alvo `ability.<chave>` (ex.: um item mágico que FIXA a pontuação de
 * Força) sobre a pontuação antes de derivar o modificador.
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {string} abilityId
 * @param {object} [context] - `{registry?, level?, choices?, equippedItemIds?, stateFlags?}`.
 * @returns {import('../../../core/result.js').Result} Result<number, AppError>
 */
export function getAbilityModifier(character, abilityId, context = {}) {
  const shape = requireCharacterShape(character);
  if (!shape.ok) {
    return shape;
  }
  const keyResult = resolveAbilityKey(abilityId);
  if (!keyResult.ok) {
    return keyResult;
  }
  const key = keyResult.value;
  const baseScore = character.state.abilities?.[key];
  if (typeof baseScore !== 'number' || !Number.isFinite(baseScore)) {
    return err(
      queryError('CHARACTER_QUERY_ABILITY_SCORE_MISSING', `"state.abilities.${key}" não é um número.`, { key }),
    );
  }

  const effectsResult = collectEffectsOptional(character, context);
  if (!effectsResult.ok) {
    return effectsResult;
  }

  const resolved = applyNumericEffects({
    target: `ability.${key}`,
    baseValue: baseScore,
    effects: effectsResult.value,
    context,
  });
  if (!resolved.ok) {
    return resolved;
  }

  return ok(abilityModifierFromScore(resolved.value));
}

/**
 * Consulta o bônus de proficiência do personagem pelo nível
 * (`ceil(nivel / 4) + 1`, regra padrão do 5e), com efeitos declarativos de
 * alvo `proficiency-bonus` aplicados por cima quando `context.registry`
 * estiver presente.
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {object} [context]
 * @returns {import('../../../core/result.js').Result} Result<number, AppError>
 */
export function getProficiencyBonus(character, context = {}) {
  const shape = requireCharacterShape(character);
  if (!shape.ok) {
    return shape;
  }
  const level = character.state.level;
  if (!Number.isInteger(level) || level < 1) {
    return err(
      queryError('CHARACTER_QUERY_LEVEL_INVALID', '"state.level" deve ser um inteiro >= 1.', { level }),
    );
  }

  const effectsResult = collectEffectsOptional(character, context);
  if (!effectsResult.ok) {
    return effectsResult;
  }

  return applyNumericEffects({
    target: 'proficiency-bonus',
    baseValue: Math.ceil(level / 4) + 1,
    effects: effectsResult.value,
    context,
  });
}
