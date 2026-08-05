// Módulo `domain/character/queries/hit-points`: projeção pura de PV (atual,
// máximo, temporário) e dados de vida restantes. Extraído da leitura direta
// de `char.pv_atual`/`char.pv_max`/`char.pv_temporario`/
// `char.nivel - char.dados_vida_usados` espalhada em screen/print/PDF
// (`site/js/pages/sheet.js`) — inclusive o bug de campo divergente
// documentado em `tests/fixtures/expected/derived-values.json` (print/PDF
// liam `char.pv_temp`/`char.dados_vida_disponiveis`, campos nunca escritos).
//
// O modelo canônico v2 NÃO guarda `state.hitPoints.maximum` (ver comentário
// de `dados/schemas/v1/character-canonical-v2.schema.json#/$defs/state`: PV
// máximo é "recalculado do ruleset+conteúdo; um ajuste manual vai em
// overrides") — esta tarefa não implementa o motor de derivação de PV máximo
// por dado de vida/nível/Constituição (isso é trabalho de uma tarefa futura
// de progressão). Por isso `getHitPointProjection` aceita
// `context.maximumHitPoints` como o valor já calculado (o adapter legado
// repassa o `pv_max` bruto do registro plano), com
// `character.overrides['hp.maximum']` tendo sempre precedência quando
// presente (mesmo contrato de `infra/character/character-codec.js`; a chave
// usa o vocabulário fechado de alvos derivados da Task 15, o mesmo aceito por
// `domain/effects/effect-predicates.js#isAllowedTargetPath`).

import { ok, err } from '../../../core/result.js';
import { requireCharacterShape, collectEffectsOptional, applyNumericEffects, queryError } from './internal/shared.js';

const HP_MAXIMUM_OVERRIDE_KEY = 'hp.maximum';

/**
 * Consulta a projeção de Pontos de Vida do personagem: atual, temporário,
 * máximo e dados de vida restantes. Consulta pura — nunca ajusta PV, nunca
 * inicializa recursos.
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {{maximumHitPoints?: number, registry?: object}} [context] -
 *   `maximumHitPoints` é obrigatório quando o personagem não tem override
 *   manual de PV máximo (`overrides["hp.maximum"]`).
 * @returns {import('../../../core/result.js').Result} Result<HitPointProjection, AppError>
 *   HitPointProjection: `{current, temporary, maximum, hitDiceTotal, hitDiceUsed, hitDiceRemaining}`
 */
export function getHitPointProjection(character, context = {}) {
  const shape = requireCharacterShape(character);
  if (!shape.ok) {
    return shape;
  }

  const { current, temporary } = character.state.hitPoints ?? {};
  if (!Number.isInteger(current)) {
    return err(queryError('CHARACTER_QUERY_HP_CURRENT_INVALID', '"state.hitPoints.current" deve ser um inteiro.', {}));
  }
  if (!Number.isInteger(temporary)) {
    return err(
      queryError('CHARACTER_QUERY_HP_TEMPORARY_INVALID', '"state.hitPoints.temporary" deve ser um inteiro.', {}),
    );
  }

  const hitDiceUsed = character.state.hitDice?.used;
  if (!Number.isInteger(hitDiceUsed)) {
    return err(queryError('CHARACTER_QUERY_HIT_DICE_USED_INVALID', '"state.hitDice.used" deve ser um inteiro.', {}));
  }
  const level = character.state.level;
  if (!Number.isInteger(level) || level < 1) {
    return err(queryError('CHARACTER_QUERY_LEVEL_INVALID', '"state.level" deve ser um inteiro >= 1.', { level }));
  }
  // Um dado de vida por nível é a regra de personagem de classe única (o
  // baseline nunca modelou multiclasse com dados de vida de tamanhos
  // diferentes por classe) — ver concern no relatório da Task 16 sobre
  // multiclasse.
  const hitDiceTotal = level;
  const hitDiceRemaining = Math.max(0, hitDiceTotal - hitDiceUsed);

  const override = character.overrides?.[HP_MAXIMUM_OVERRIDE_KEY];
  let baseMaximum;
  if (override && typeof override === 'object' && typeof override.value === 'number') {
    baseMaximum = override.value;
  } else if (typeof context.maximumHitPoints === 'number' && Number.isFinite(context.maximumHitPoints)) {
    baseMaximum = context.maximumHitPoints;
  } else {
    return err(
      queryError(
        'CHARACTER_QUERY_HP_MAXIMUM_UNKNOWN',
        'PV máximo não tem override manual nem "context.maximumHitPoints" — a derivação por ruleset ainda não existe (ver concern da Task 16).',
        {},
      ),
    );
  }

  const effectsResult = collectEffectsOptional(character, context);
  if (!effectsResult.ok) {
    return effectsResult;
  }
  const maximumResolved = applyNumericEffects({
    target: 'hp.maximum',
    baseValue: baseMaximum,
    effects: effectsResult.value,
    context,
  });
  if (!maximumResolved.ok) {
    return maximumResolved;
  }

  return ok(
    Object.freeze({
      current,
      temporary,
      maximum: maximumResolved.value,
      hitDiceTotal,
      hitDiceUsed,
      hitDiceRemaining,
    }),
  );
}
