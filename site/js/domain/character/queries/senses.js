// Módulo `domain/character/queries/senses`: projeção pura de sentidos —
// percepção/intuição/investigação passivas e visão no escuro. Extraído de
// `site/js/utils.js#calcPercepcaoPassiva`/`#calcIntuicaoPassiva`/
// `#calcInvestigacaoPassiva` (as três reduzem a `10 + calcBonusPericia(...)`,
// reaproveitado aqui via `getSkillProjection` em vez de duplicar a soma).
// Visão no escuro não tinha helper compartilhado no baseline — vem apenas do
// motor de efeitos (`senses.darkvision`, ex.: o efeito da espécie Aasimar em
// `dados/pacotes/dnd2024/species/catalog.json`), `null` quando não há
// catálogo ou nenhum efeito concede visão no escuro.

import { ok } from '../../../core/result.js';
import { getSkillProjection } from './skills.js';
import { requireCharacterShape, collectEffectsOptional, applyNumericEffects } from './internal/shared.js';

const PERCEPTION_SKILL_ID = 'dnd2024:skill:percepcao';
const INSIGHT_SKILL_ID = 'dnd2024:skill:intuicao';
const INVESTIGATION_SKILL_ID = 'dnd2024:skill:investigacao';

/**
 * Consulta os sentidos do personagem: percepção/intuição/investigação
 * passivas e visão no escuro (em metros, `null` quando o personagem não tem).
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {object} [context] - `{registry?, level?, choices?, equippedItemIds?, stateFlags?}`.
 * @returns {import('../../../core/result.js').Result} Result<SensesProjection, AppError>
 *   SensesProjection: `{passivePerception, passiveInsight, passiveInvestigation, darkvision}`
 */
export function getSenses(character, context = {}) {
  const shape = requireCharacterShape(character);
  if (!shape.ok) {
    return shape;
  }

  const perceptionResult = getSkillProjection(character, PERCEPTION_SKILL_ID, context);
  if (!perceptionResult.ok) {
    return perceptionResult;
  }
  const insightResult = getSkillProjection(character, INSIGHT_SKILL_ID, context);
  if (!insightResult.ok) {
    return insightResult;
  }
  const investigationResult = getSkillProjection(character, INVESTIGATION_SKILL_ID, context);
  if (!investigationResult.ok) {
    return investigationResult;
  }

  const effectsResult = collectEffectsOptional(character, context);
  if (!effectsResult.ok) {
    return effectsResult;
  }
  const darkvisionResult = applyNumericEffects({
    target: 'senses.darkvision',
    baseValue: 0,
    effects: effectsResult.value,
    context,
  });
  if (!darkvisionResult.ok) {
    return darkvisionResult;
  }

  // Alvo derivado `passive-perception` (Task 15, fix round 1 achado I6): um
  // efeito de conteúdo pode ajustar a Percepção Passiva por cima da soma de
  // perícia (ex.: um item que concede +5 fixo) — `getSkillProjection` já
  // aplica `skill.percepcao`; este é um segundo alvo, mais específico, sobre
  // o valor PASSIVO final.
  const passivePerceptionResult = applyNumericEffects({
    target: 'passive-perception',
    baseValue: perceptionResult.value.passive,
    effects: effectsResult.value,
    context,
  });
  if (!passivePerceptionResult.ok) {
    return passivePerceptionResult;
  }

  return ok(
    Object.freeze({
      passivePerception: passivePerceptionResult.value,
      passiveInsight: insightResult.value.passive,
      passiveInvestigation: investigationResult.value.passive,
      darkvision: darkvisionResult.value > 0 ? darkvisionResult.value : null,
    }),
  );
}
