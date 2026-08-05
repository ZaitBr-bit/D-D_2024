// Módulo `domain/effects`: porta pública do motor determinístico de efeitos
// declarativos. Consumidores (Tasks 16/17 e o app-context) importam daqui, não
// dos arquivos internos, para que a superfície do motor fique explícita.

export {
  EFFECT_TYPES,
  MODIFIER_OPERATIONS,
  EFFECT_TARGET_NAMESPACES,
  RESERVED_PATH_SEGMENTS,
  CONDITION_KINDS,
  STATE_FLAGS,
  MAX_CONDITION_DEPTH,
  SET_TARGETS,
  SET_OPERATIONS,
  isAllowedTargetPath,
  isSerializableEffectValue,
  isKnownSetTarget,
  isKnownSetOperation,
  setContributionForEffect,
  validateEffectSemantics,
  evaluateEffectCondition,
  effectPriority,
  effectStackKey,
  effectStackable,
} from './effect-predicates.js';

export {
  PRECEDENCE_GROUPS,
  collectCharacterEffects,
  createResolvedEffect,
  createSetContribution,
  compareResolvedEffects,
  sortResolvedEffects,
  filterByStackKey,
  deriveSourceInstanceId,
  deriveEffectInstanceId,
  qualifiedChoiceKey,
} from './collect-effects.js';

export { resolveNumericTarget, resolveSetTarget, resolveNumericValue } from './resolve-effects.js';

export {
  GRANT_TYPES,
  PROJECTION_TYPES,
  applyGrantEffects,
  revokeGrantEffects,
  projectManualEffects,
} from './apply-grants.js';

export { OfficialHandlerRegistry } from './official-handler-registry.js';
