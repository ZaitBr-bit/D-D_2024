// Módulo `domain/character/queries`: porta pública das consultas puras de
// valores derivados de personagem (Task 16). Consumidores (criador, ficha,
// impressão, PDF, e as Tasks 29/33 que constroem o view-model da ficha)
// importam daqui, não dos arquivos internos.

export { getAbilityModifier, getProficiencyBonus } from './abilities.js';
export { getHitPointProjection } from './hit-points.js';
export { getArmorClass, getInitiative } from './combat.js';
export {
  isSkillProficient,
  isSkillExpert,
  isSavingThrowProficient,
  resolveSkillAbilityKey,
} from './proficiencies.js';
export { getMovement } from './movement.js';
export { getDefenses } from './defenses.js';
export { getSenses } from './senses.js';
export { getSkillProjection } from './skills.js';
export { getSavingThrowProjection } from './saving-throws.js';
export { collectDeclaredResourceMaxima, getResourceProjection } from './resources.js';
export {
  ABILITY_KEYS,
  abilityModifierVariable,
  abilityModifierMin1Variable,
  buildEffectContextVariables,
  withEffectContextVariables,
} from './context-variables.js';
