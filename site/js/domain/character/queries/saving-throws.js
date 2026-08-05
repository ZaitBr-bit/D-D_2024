// Módulo `domain/character/queries/saving-throws`: projeção pura do bônus de
// salvaguarda de uma habilidade.
//
// ## Por que é uma consulta, e não uma soma no ViewModel
//
// Na primeira versão da Task 29 o bônus era montado dentro do ViewModel como
// "modificador + bônus de proficiência", e o comentário afirmava ser "a mesma
// composição de `getSkillProjection`". Não era: faltava a etapa final que
// aquela consulta faz, que é aplicar os efeitos declarados sobre o ALVO
// derivado correspondente.
//
// `save` é um namespace de alvo de PRIMEIRA CLASSE do motor da Task 15
// (`EFFECT_TARGET_NAMESPACES`), exatamente como `skill`. Hoje nenhuma entidade
// do catálogo `dnd2024` declara `save.<chave>`, então a omissão não mudava
// nenhum número — mas o primeiro item mágico com "+1 em salvaguardas" seria
// ignorado em silêncio, que é a forma mais cara de errar: sem erro, sem log,
// só um número menor do que deveria.
//
// Estar aqui, ao lado de `skills.js`, é o que torna a simetria verificável.

import { ok, err } from '../../../core/result.js';
import { getAbilityModifier, getProficiencyBonus } from './abilities.js';
import { isSavingThrowProficient } from './proficiencies.js';
import { ABILITY_KEYS } from './context-variables.js';
import { requireCharacterShape, collectEffectsOptional, applyNumericEffects, queryError } from './internal/shared.js';

/**
 * Consulta a projeção de salvaguarda de uma habilidade.
 *
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {string} abilityKey - chave canônica (`"forca"`).
 * @param {object} [context] - `{registry?, level?, choices?, equippedItemIds?, stateFlags?}`.
 * @returns {import('../../../core/result.js').Result} Result<SavingThrowProjection, AppError>
 *   SavingThrowProjection: `{abilityKey, proficient, bonus}`
 */
export function getSavingThrowProjection(character, abilityKey, context = {}) {
  const shape = requireCharacterShape(character);
  if (!shape.ok) {
    return shape;
  }
  if (typeof abilityKey !== 'string' || !ABILITY_KEYS.includes(abilityKey)) {
    return err(
      queryError('CHARACTER_QUERY_INVALID_ABILITY_ID', '"abilityKey" deve ser uma chave canônica de habilidade.', {
        received: typeof abilityKey === 'string' ? abilityKey : null,
      }),
    );
  }

  const modifier = getAbilityModifier(character, abilityKey, context);
  if (!modifier.ok) {
    return modifier;
  }
  const proficient = isSavingThrowProficient(character, abilityKey);
  if (!proficient.ok) {
    return proficient;
  }
  const proficiencyBonus = getProficiencyBonus(character, context);
  if (!proficiencyBonus.ok) {
    return proficiencyBonus;
  }

  const base = modifier.value + (proficient.value === true ? proficiencyBonus.value : 0);

  const effects = collectEffectsOptional(character, context);
  if (!effects.ok) {
    return effects;
  }
  // A etapa que faltava: mesmo tratamento que `skills.js` dá a `skill.<slug>`.
  const resolved = applyNumericEffects({
    target: `save.${abilityKey}`,
    baseValue: base,
    effects: effects.value,
    context,
  });
  if (!resolved.ok) {
    return resolved;
  }

  return ok(Object.freeze({ abilityKey, proficient: proficient.value, bonus: resolved.value }));
}
