// Módulo `domain/character/queries/defenses`: projeção pura de defesas
// (resistências/vulnerabilidades/imunidades a dano) e dos dois números de
// conjuração que dependem da MESMA habilidade de conjuração da classe — CD
// de Magia e Bônus de Ataque de Magia. Extraído de
// `site/js/utils.js#calcCDMagia`/`#calcAtaqueMagia`, que hoje resolvem a
// habilidade de conjuração por um `CLASSES_INFO[personagem.classe]` indexado
// por nome de exibição em português; aqui a habilidade vem da entidade REAL
// da classe no catálogo (`registry.get(classRef.id).spellcasting.ability`) —
// só disponível quando `context.registry` é informado (ver concern no
// relatório da Task 16: sem catálogo, `spellSaveDC`/`spellAttackBonus` são
// `null`, nunca um `0` mascarado como "não conjurador").

import { ok, err } from '../../../core/result.js';
import { getAbilityModifier, getProficiencyBonus } from './abilities.js';
import { requireCharacterShape, resolveAbilityKey, collectEffectsOptional, queryError } from './internal/shared.js';
import { resolveSetTarget } from '../../effects/index.js';

const SPELL_SAVE_DC_BASE = 8;

/**
 * Resolve a chave de habilidade de conjuração da classe do personagem via
 * catálogo. Devolve `null` (não erro) quando não há classe, não há
 * catálogo, ou a classe não é conjuradora (`spellcasting` ausente).
 * @param {object} character
 * @param {object} context
 * @returns {import('../../../core/result.js').Result} Result<string | null, AppError>
 */
function resolveSpellcastingAbilityKey(character, context) {
  const classRef = character.build?.classRef;
  const registry = context?.registry;
  if (!classRef || typeof classRef.id !== 'string' || !registry || typeof registry.get !== 'function') {
    return ok(null);
  }
  const classEntity = registry.get(classRef.id);
  const abilityId = classEntity?.spellcasting?.ability;
  if (typeof abilityId !== 'string') {
    return ok(null);
  }
  const keyResult = resolveAbilityKey(abilityId);
  return keyResult.ok ? ok(keyResult.value) : keyResult;
}

/**
 * Congela uma lista de IDs a partir de um Set/array, ordenada
 * deterministicamente (para nunca depender da ordem de inserção do motor de
 * efeitos).
 * @param {Iterable<string>} ids
 * @returns {ReadonlyArray<string>}
 */
function frozenSortedList(ids) {
  return Object.freeze([...ids].sort());
}

/**
 * Resolve um conjunto de defesa (resistência/vulnerabilidade/imunidade):
 * aplica o motor de efeitos por cima da base legada quando há catálogo,
 * senão devolve a base tal como está.
 * @param {string} setTarget
 * @param {ReadonlyArray<string>} baseIds
 * @param {ReadonlyArray<object>} effects
 * @param {object} context
 * @returns {import('../../../core/result.js').Result} Result<ReadonlyArray<string>, AppError>
 */
function resolveDefenseSet(setTarget, baseIds, effects, context) {
  if (effects.length === 0) {
    return ok(frozenSortedList(baseIds));
  }
  const resolved = resolveSetTarget({ target: setTarget, baseIds, effects, context });
  if (!resolved.ok) {
    return resolved;
  }
  return ok(frozenSortedList(resolved.value));
}

/**
 * Consulta as defesas do personagem: resistências/vulnerabilidades/
 * imunidades a dano, CD de Magia e Bônus de Ataque de Magia.
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {object} [context] - `{registry?, level?, choices?, equippedItemIds?, stateFlags?}`.
 * @returns {import('../../../core/result.js').Result} Result<DefenseProjection, AppError>
 *   DefenseProjection: `{resistances, vulnerabilities, immunities, spellSaveDC, spellAttackBonus}`
 */
export function getDefenses(character, context = {}) {
  const shape = requireCharacterShape(character);
  if (!shape.ok) {
    return shape;
  }
  const grants = character.build?.legacyGrants;
  if (
    grants === null ||
    typeof grants !== 'object' ||
    !Array.isArray(grants.resistanceIds) ||
    !Array.isArray(grants.vulnerabilityIds) ||
    !Array.isArray(grants.immunityIds)
  ) {
    return err(queryError('CHARACTER_QUERY_LEGACY_GRANTS_INVALID', '"build.legacyGrants" de defesas deve ter três arrays.', {}));
  }

  const effectsResult = collectEffectsOptional(character, context);
  if (!effectsResult.ok) {
    return effectsResult;
  }
  const effects = effectsResult.value;

  const resistancesResult = resolveDefenseSet('defense.resistance', grants.resistanceIds, effects, context);
  if (!resistancesResult.ok) {
    return resistancesResult;
  }
  const vulnerabilitiesResult = resolveDefenseSet('defense.vulnerability', grants.vulnerabilityIds, effects, context);
  if (!vulnerabilitiesResult.ok) {
    return vulnerabilitiesResult;
  }
  const immunitiesResult = resolveDefenseSet('defense.immunity', grants.immunityIds, effects, context);
  if (!immunitiesResult.ok) {
    return immunitiesResult;
  }

  const abilityKeyResult = resolveSpellcastingAbilityKey(character, context);
  if (!abilityKeyResult.ok) {
    return abilityKeyResult;
  }
  const abilityKey = abilityKeyResult.value;

  let spellSaveDC = null;
  let spellAttackBonus = null;
  if (abilityKey !== null) {
    const modResult = getAbilityModifier(character, abilityKey, context);
    if (!modResult.ok) {
      return modResult;
    }
    const proficiencyBonusResult = getProficiencyBonus(character, context);
    if (!proficiencyBonusResult.ok) {
      return proficiencyBonusResult;
    }
    spellSaveDC = SPELL_SAVE_DC_BASE + proficiencyBonusResult.value + modResult.value;
    spellAttackBonus = proficiencyBonusResult.value + modResult.value;
  }

  return ok(
    Object.freeze({
      resistances: resistancesResult.value,
      vulnerabilities: vulnerabilitiesResult.value,
      immunities: immunitiesResult.value,
      spellSaveDC,
      spellAttackBonus,
    }),
  );
}
