// Módulo `domain/spells`: porta pública do domínio de magias, concentração e
// metamagia (Task 18). Consumidores (criador, ficha, level-up e o dispatcher
// de comandos) importam daqui, nunca dos arquivos internos.

export {
  SPELLS_SCOPE,
  SPELL_COLLECTIONS,
  MIN_SLOT_LEVEL,
  MAX_SLOT_LEVEL,
  getSpellcastingProjection,
  readSpellcastingTable,
  readSpellState,
  requireSpellCharacterShape,
  requireRegistry,
  spellError,
  spellIdOf,
} from './spellcasting-queries.js';

export { validateSpellSelection } from './spell-selection.js';

// Correção C1 da revisão final: preparar/despreparar e edição de grimório.
export {
  prepareSpell,
  unprepareSpell,
  addSpellbookSpell,
  removeSpellbookSpell,
  AFFECTED_PREPARED_SPELLS,
  AFFECTED_SPELLBOOK,
} from './spell-preparation.js';

export { castSpell, AFFECTED_SLOTS, AFFECTED_PACT_SLOTS, AFFECTED_RESOURCES } from './cast-spell.js';

export {
  setConcentration,
  endConcentration,
  withConcentration,
  dropConcentrationEffects,
  filtrarEfeitosSemConcentracao,
  checkConcentrationReplacement,
  AFFECTED_CONCENTRATION,
  AFFECTED_ACTIVE_EFFECTS,
  AFFECTED_LEGACY_MAGIC_EFFECTS,
} from './concentration.js';

export {
  METAMAGIC_REQUIREMENT_KINDS,
  readMetamagicContext,
  validateMetamagicUse,
  debitMetamagicPoints,
} from './metamagic.js';

export {
  SPELL_EFFECT_GROUP,
  describeSpellAutomation,
  applySpellGrants,
  revokeSpellGrants,
  deriveSpellCastSourceInstanceId,
} from './spell-effects.js';
