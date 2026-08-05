// Módulo `domain/character/queries/skills`: projeção pura de bônus de
// perícia (total e passivo). Extraído de
// `site/js/utils.js#calcBonusPericia`/`#calcPercepcaoPassiva`/
// `#calcIntuicaoPassiva`/`#calcInvestigacaoPassiva` — as quatro funções
// convergem no mesmo padrão (10 + bônus da perícia para o valor passivo),
// unificado aqui numa única consulta parametrizada por `skillId`.
//
// Bônus de subclasse dependentes de campos ainda não estruturados no modelo
// canônico (Ordem Divina do Clérigo, Ordem Primal do Druida — Task 12 não
// migrou `ordem_divina`/`ordem_primal` para `build.choices`, ver
// `site/js/infra/character/migrations/v1-to-v2.js`) NÃO são reproduzidos
// aqui; ver concern no relatório da Task 16.

import { ok, err } from '../../../core/result.js';
import { getAbilityModifier, getProficiencyBonus } from './abilities.js';
import { isSkillProficient, isSkillExpert, resolveSkillAbilityKey } from './proficiencies.js';
import { requireCharacterShape, refSlug, collectEffectsOptional, applyNumericEffects, queryError } from './internal/shared.js';

// Slug estável (ContentId) da classe Bardo — usado para a regra "Pau pra
// Toda Obra" (metade do bônus de proficiência em perícias sem proficiência),
// nunca o nome de exibição "Bardo" solto.
const BARD_CLASS_SLUG = 'bardo';
const JACK_OF_ALL_TRADES_MIN_LEVEL = 2;

/**
 * Consulta a projeção de uma perícia do personagem: bônus total e valor
 * passivo (10 + bônus).
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {string} skillId - ContentId de perícia (`"dnd2024:skill:percepcao"`).
 * @param {object} [context] - `{registry?, level?, choices?, equippedItemIds?, stateFlags?}`.
 * @returns {import('../../../core/result.js').Result} Result<SkillProjection, AppError>
 *   SkillProjection: `{abilityKey, proficient, expert, bonus, passive}`
 */
export function getSkillProjection(character, skillId, context = {}) {
  const shape = requireCharacterShape(character);
  if (!shape.ok) {
    return shape;
  }
  if (typeof skillId !== 'string' || skillId.length === 0) {
    return err(queryError('CHARACTER_QUERY_INVALID_SKILL_ID', '"skillId" deve ser uma string não vazia.', {}));
  }

  const abilityKeyResult = resolveSkillAbilityKey(skillId, context);
  if (!abilityKeyResult.ok) {
    return abilityKeyResult;
  }
  const abilityKey = abilityKeyResult.value;

  const modResult = getAbilityModifier(character, abilityKey, context);
  if (!modResult.ok) {
    return modResult;
  }
  const proficientResult = isSkillProficient(character, skillId);
  if (!proficientResult.ok) {
    return proficientResult;
  }
  const expertResult = isSkillExpert(character, skillId);
  if (!expertResult.ok) {
    return expertResult;
  }
  const proficiencyBonusResult = getProficiencyBonus(character, context);
  if (!proficiencyBonusResult.ok) {
    return proficiencyBonusResult;
  }

  const proficient = proficientResult.value;
  const expert = expertResult.value;
  const proficiencyBonus = proficiencyBonusResult.value;

  let bonus = modResult.value;
  if (proficient) {
    bonus += proficiencyBonus;
  }
  if (expert) {
    bonus += proficiencyBonus;
  }

  // Bardo: "Pau pra Toda Obra" — metade do bônus de proficiência em
  // perícias sem proficiência nem expertise, a partir do nível 2.
  const classSlug = refSlug(character.build?.classRef);
  const level = character.state?.level;
  if (classSlug === BARD_CLASS_SLUG && Number.isInteger(level) && level >= JACK_OF_ALL_TRADES_MIN_LEVEL && !proficient && !expert) {
    bonus += Math.floor(proficiencyBonus / 2);
  }

  const effectsResult = collectEffectsOptional(character, context);
  if (!effectsResult.ok) {
    return effectsResult;
  }
  const bonusResolved = applyNumericEffects({
    target: `skill.${skillId.split(':').pop()}`,
    baseValue: bonus,
    effects: effectsResult.value,
    context,
  });
  if (!bonusResolved.ok) {
    return bonusResolved;
  }

  return ok(
    Object.freeze({
      abilityKey,
      proficient,
      expert,
      bonus: bonusResolved.value,
      passive: 10 + bonusResolved.value,
    }),
  );
}
