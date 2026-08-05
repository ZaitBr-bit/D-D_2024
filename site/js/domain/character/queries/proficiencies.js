// Módulo `domain/character/queries/proficiencies`: consultas puras de
// proficiência/expertise em perícia e salvaguarda, e o mapeamento
// perícia -> habilidade do ruleset dnd2024. Extraído da checagem repetida
// `(personagem.pericias_proficientes || []).includes(nomePericia)` de
// `site/js/utils.js#calcBonusPericia`/`#calcPercepcaoPassiva`, agora sobre
// `build.legacyGrants.skillProficiencyIds`/`skillExpertiseIds` (ContentIds,
// já normalizados pelo codec da Task 12 — nunca mais o nome de exibição em
// português solto).
//
// `SKILL_ABILITY_TABLE` espelha `dados/pacotes/dnd2024/rulesets/skills.json`
// (perícia -> habilidade) e existe só como fallback determinístico quando a
// consulta é chamada sem `context.registry` (ex.: testes unitários
// focados). Quando `context.registry` está presente, a entidade REAL do
// catálogo (`registry.get(skillId).ability`) é a fonte de verdade — a
// tabela local nunca a sobrepõe.

import { ok, err } from '../../../core/result.js';
import { requireCharacterShape, resolveAbilityKey, queryError } from './internal/shared.js';

// Perícia -> habilidade, mesmo vocabulário de IDs de
// dados/pacotes/dnd2024/rulesets/skills.json (fallback; ver comentário acima).
const SKILL_ABILITY_TABLE = Object.freeze({
  'dnd2024:skill:acrobacia': 'destreza',
  'dnd2024:skill:arcanismo': 'inteligencia',
  'dnd2024:skill:atletismo': 'forca',
  'dnd2024:skill:atuacao': 'carisma',
  'dnd2024:skill:enganacao': 'carisma',
  'dnd2024:skill:furtividade': 'destreza',
  'dnd2024:skill:historia': 'inteligencia',
  'dnd2024:skill:intimidacao': 'carisma',
  'dnd2024:skill:intuicao': 'sabedoria',
  'dnd2024:skill:investigacao': 'inteligencia',
  'dnd2024:skill:lidar-com-animais': 'sabedoria',
  'dnd2024:skill:medicina': 'sabedoria',
  'dnd2024:skill:natureza': 'inteligencia',
  'dnd2024:skill:percepcao': 'sabedoria',
  'dnd2024:skill:persuasao': 'carisma',
  'dnd2024:skill:prestidigitacao': 'destreza',
  'dnd2024:skill:religiao': 'inteligencia',
  'dnd2024:skill:sobrevivencia': 'sabedoria',
});

/**
 * Resolve a habilidade associada a uma perícia: prioriza a entidade real do
 * catálogo (`context.registry`), cai para a tabela local determinística
 * quando o catálogo não foi informado ou não conhece o id.
 * @param {string} skillId - ContentId de perícia (`"dnd2024:skill:..."`).
 * @param {object} [context]
 * @returns {import('../../../core/result.js').Result} Result<string, AppError> (chave canônica de habilidade)
 */
export function resolveSkillAbilityKey(skillId, context = {}) {
  if (typeof skillId !== 'string' || skillId.length === 0) {
    return err(queryError('CHARACTER_QUERY_INVALID_SKILL_ID', '"skillId" deve ser uma string não vazia.', {}));
  }
  const registry = context?.registry;
  if (registry && typeof registry.get === 'function') {
    const entity = registry.get(skillId);
    if (entity && typeof entity.ability === 'string') {
      return resolveAbilityKey(entity.ability);
    }
  }
  const fallbackAbilityId = SKILL_ABILITY_TABLE[skillId];
  if (typeof fallbackAbilityId === 'string') {
    return ok(fallbackAbilityId);
  }
  return err(
    queryError('CHARACTER_QUERY_SKILL_ID_UNKNOWN', `A perícia "${skillId}" não foi encontrada no catálogo nem na tabela de fallback.`, {
      skillId,
    }),
  );
}

/**
 * Diz se o personagem é proficiente numa perícia (`skillId` é um ContentId).
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {string} skillId
 * @returns {import('../../../core/result.js').Result} Result<boolean, AppError>
 */
export function isSkillProficient(character, skillId) {
  const shape = requireCharacterShape(character);
  if (!shape.ok) {
    return shape;
  }
  const list = character.build?.legacyGrants?.skillProficiencyIds;
  if (!Array.isArray(list)) {
    return err(queryError('CHARACTER_QUERY_LEGACY_GRANTS_INVALID', '"build.legacyGrants.skillProficiencyIds" deve ser um array.', {}));
  }
  return ok(list.includes(skillId));
}

/**
 * Diz se o personagem tem expertise numa perícia (`skillId` é um ContentId).
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {string} skillId
 * @returns {import('../../../core/result.js').Result} Result<boolean, AppError>
 */
export function isSkillExpert(character, skillId) {
  const shape = requireCharacterShape(character);
  if (!shape.ok) {
    return shape;
  }
  const list = character.build?.legacyGrants?.skillExpertiseIds;
  if (!Array.isArray(list)) {
    return err(queryError('CHARACTER_QUERY_LEGACY_GRANTS_INVALID', '"build.legacyGrants.skillExpertiseIds" deve ser um array.', {}));
  }
  return ok(list.includes(skillId));
}

/**
 * Diz se o personagem é proficiente numa salvaguarda de habilidade.
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {string} abilityId - chave canônica (`"forca"`) ou ContentId de habilidade.
 * @returns {import('../../../core/result.js').Result} Result<boolean, AppError>
 */
export function isSavingThrowProficient(character, abilityId) {
  const shape = requireCharacterShape(character);
  if (!shape.ok) {
    return shape;
  }
  const keyResult = resolveAbilityKey(abilityId);
  if (!keyResult.ok) {
    return keyResult;
  }
  const list = character.build?.legacyGrants?.savingThrowProficiencyIds;
  if (!Array.isArray(list)) {
    return err(
      queryError('CHARACTER_QUERY_LEGACY_GRANTS_INVALID', '"build.legacyGrants.savingThrowProficiencyIds" deve ser um array.', {}),
    );
  }
  return ok(list.some((id) => typeof id === 'string' && id.endsWith(`:${keyResult.value}`)));
}
