// Módulo `domain/progression`: porta pública da progressão de personagem
// (matriz 1-20, PV por nível, level-up e talentos) — Task 23.
//
// Consumidores (as fachadas legadas `site/js/levelup*.js`, o dispatcher de
// comandos e a camada de UI) importam DAQUI, nunca dos arquivos internos, para
// que a superfície do domínio de progressão fique explícita.

export {
  MIN_LEVEL,
  MAX_LEVEL,
  progressionError,
  getProgressionMatrix,
  getProgressionRow,
  requireHitPointRolls,
  getMaximumHitPoints,
} from './progression-queries.js';

export { HIT_POINT_METHODS, getLevelUpOptions, validateLevelUp, applyLevelUp } from './level-up.js';

export { ABILITY_SCORE_MAXIMUM, validateFeatChoice, applyFeatChoice } from './feat-choices.js';
