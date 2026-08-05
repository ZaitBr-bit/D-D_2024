// Módulo `domain/character/queries/movement`: projeção pura de deslocamento
// e capacidade de carga. Extraído de `site/js/utils.js#getDeslocamento`
// (deslocamento base da espécie, hoje parseado por regex de um bloco de
// texto markdown — aqui lido do campo estruturado `speed` da entidade de
// espécie no catálogo) e `#getCapacidadeCarga`/`#getMultiplicadorCarga`/
// `#getPesoTotalInventario` (capacidade de carga = Força × multiplicador de
// tamanho).
//
// `context.encumbranceLevel` é responsabilidade da Task 19
// (`getInventoryProjection`, ainda não implementada) — esta consulta NUNCA
// soma peso de inventário/capacidade de carga por conta própria além do
// necessário para expor `carryingCapacity` (que é só Força × multiplicador,
// sem depender do inventário). Sem `context.encumbranceLevel`, o
// deslocamento não sofre nenhuma penalidade (`encumbranceLevel: 'none'`).
//
// Talentos que ainda não são efeitos declarativos (Velocista, Dádiva da
// Velocidade) entram via `context.talentPassives.speedBonus` (fix round 1,
// C2). Os alvos derivados `size`/`carrying-capacity` do motor da Task 15
// (fix round 1, I6) são aplicados aqui: `size` desloca o tamanho numa escala
// ordinal fechada (tiny=0..gargantuan=5, `set`/`add` de efeito de conteúdo),
// `carrying-capacity` soma/multiplica por cima do resultado de
// Força × multiplicador de tamanho.

import { ok, err } from '../../../core/result.js';
import { getAbilityModifier } from './abilities.js';
import {
  requireCharacterShape,
  collectEffectsOptional,
  applyNumericEffects,
  readTalentPassives,
  queryError,
} from './internal/shared.js';

const DEFAULT_SPEED_METERS = 9;
const DEFAULT_SIZE_SLUG = 'medium';
const OVERLOADED_SPEED_METERS = 1.5;
const EXHAUSTION_SPEED_PENALTY_METERS = 1.5;

// Escala ordinal fechada de tamanho — o alvo derivado `size` (Task 15) opera
// sobre este índice, não sobre o slug diretamente (um `modifier`/`set`/`add`
// só sabe mexer em número).
const SIZE_ORDER = Object.freeze(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']);

// Multiplicador de capacidade de carga por tamanho (chave em inglês, mesmo
// slug estruturado usado por `dados/pacotes/dnd2024/species/catalog.json`).
const CARRYING_CAPACITY_MULTIPLIER_BY_SIZE = Object.freeze({
  tiny: 3.5,
  small: 7,
  medium: 7,
  large: 13.5,
  huge: 27,
  gargantuan: 54.5,
});

// Tamanhos em português (valor legado de `identity.size`, preservado
// verbatim pelo codec — Task 12/13) mapeados para o mesmo slug em inglês.
const PORTUGUESE_SIZE_TO_SLUG = Object.freeze({
  'Minúsculo': 'tiny',
  'Pequeno': 'small',
  'Médio': 'medium',
  'Grande': 'large',
  'Enorme': 'huge',
  'Colossal': 'gargantuan',
});

/**
 * Normaliza um valor de tamanho (português legado OU slug em inglês do
 * ruleset) para o slug fechado usado pela tabela de multiplicadores.
 * `null`/string vazia/desconhecido devolve `null` — nunca inventa
 * "medium" aqui (isso é decidido explicitamente pelo chamador como regra de
 * jogo, não como reconstrução de dado ausente).
 * @param {*} size
 * @returns {string | null}
 */
function normalizeSizeSlug(size) {
  if (typeof size !== 'string' || size.length === 0) {
    return null;
  }
  if (Object.hasOwn(CARRYING_CAPACITY_MULTIPLIER_BY_SIZE, size)) {
    return size;
  }
  return PORTUGUESE_SIZE_TO_SLUG[size] ?? null;
}

// Exportada só para que `site/js/utils.js#getMultiplicadorCarga` delegue
// aqui em vez de manter uma segunda cópia da tabela (fix round 1, C1) — as
// consultas de domínio nunca leem esta constante fora de
// `resolveCarryingCapacityMultiplier`.
export { CARRYING_CAPACITY_MULTIPLIER_BY_SIZE };

/**
 * Resolve o multiplicador de capacidade de carga a partir de um texto de
 * tamanho em português (incluindo formas compostas legadas como "Médio ou
 * Pequeno") ou do slug em inglês do ruleset. Único ponto de verdade da
 * tabela de multiplicadores — `getMovement` e `site/js/utils.js` (fix
 * round 1, C1) delegam aqui em vez de manter cópias próprias.
 * @param {*} tamanho
 * @returns {number}
 */
export function resolveCarryingCapacityMultiplier(tamanho) {
  const text = String(tamanho ?? 'Médio').trim();
  const direct = normalizeSizeSlug(text);
  if (direct !== null) {
    return CARRYING_CAPACITY_MULTIPLIER_BY_SIZE[direct];
  }
  if (/Grande/i.test(text)) {
    return CARRYING_CAPACITY_MULTIPLIER_BY_SIZE.large;
  }
  return CARRYING_CAPACITY_MULTIPLIER_BY_SIZE.medium;
}

/**
 * Consulta o deslocamento e a capacidade de carga do personagem.
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {{registry?: object, encumbranceLevel?: 'none'|'encumbered'|'heavily-encumbered'|'overloaded', talentPassives?: object}} [context]
 * @returns {import('../../../core/result.js').Result} Result<MovementProjection, AppError>
 *   MovementProjection: `{base, effective, encumbranceLevel, exhaustionLevel, carryingCapacity, sizeSlug}`
 */
export function getMovement(character, context = {}) {
  const shape = requireCharacterShape(character);
  if (!shape.ok) {
    return shape;
  }

  const registry = context?.registry;
  const speciesRef = character.build?.speciesRef;
  let baseSpeed = DEFAULT_SPEED_METERS;
  let speciesSizeSlug = null;
  if (speciesRef && typeof speciesRef.id === 'string' && registry && typeof registry.get === 'function') {
    const speciesEntity = registry.get(speciesRef.id);
    if (typeof speciesEntity?.speed === 'number' && Number.isFinite(speciesEntity.speed)) {
      baseSpeed = speciesEntity.speed;
    }
    if (typeof speciesEntity?.size === 'string') {
      speciesSizeSlug = normalizeSizeSlug(speciesEntity.size);
    }
  }

  // Regra de jogo (não reconstrução de dado ausente): tamanho Médio é o
  // padrão do 5e quando nem `identity.size` (edição manual) nem a espécie
  // no catálogo informam um tamanho — mesmo fallback de
  // `site/js/utils.js#getTamanho`/`#getMultiplicadorCarga`.
  const baseSizeSlug = normalizeSizeSlug(character.identity?.size) ?? speciesSizeSlug ?? DEFAULT_SIZE_SLUG;
  const baseSizeOrdinal = SIZE_ORDER.indexOf(baseSizeSlug);

  const strengthResult = getAbilityModifier(character, 'forca', context);
  if (!strengthResult.ok) {
    return strengthResult;
  }
  const strengthScore = character.state?.abilities?.forca;
  if (typeof strengthScore !== 'number') {
    return err(queryError('CHARACTER_QUERY_ABILITY_SCORE_MISSING', '"state.abilities.forca" não é um número.', {}));
  }

  const talentPassives = readTalentPassives(context);

  const effectsResult = collectEffectsOptional(character, context);
  if (!effectsResult.ok) {
    return effectsResult;
  }
  const effects = effectsResult.value;

  // Alvo derivado `size` (Task 15): desloca o índice ordinal, nunca o slug
  // direto. Arredondado e limitado à escala fechada antes de reconverter.
  const sizeOrdinalResolved = applyNumericEffects({ target: 'size', baseValue: baseSizeOrdinal, effects, context });
  if (!sizeOrdinalResolved.ok) {
    return sizeOrdinalResolved;
  }
  const clampedOrdinal = Math.min(SIZE_ORDER.length - 1, Math.max(0, Math.round(sizeOrdinalResolved.value)));
  const sizeSlug = SIZE_ORDER[clampedOrdinal];

  const baseCarryingCapacity = strengthScore * CARRYING_CAPACITY_MULTIPLIER_BY_SIZE[sizeSlug];
  const carryingCapacityResolved = applyNumericEffects({
    target: 'carrying-capacity',
    baseValue: baseCarryingCapacity,
    effects,
    context,
  });
  if (!carryingCapacityResolved.ok) {
    return carryingCapacityResolved;
  }

  const baseResolved = applyNumericEffects({
    target: 'speed',
    baseValue: baseSpeed + talentPassives.speedBonus,
    effects,
    context,
  });
  if (!baseResolved.ok) {
    return baseResolved;
  }

  // Exaustão (regra 2024): cada nível reduz o deslocamento em 1,5m, sem
  // ficar negativo. `state.exhaustion` é o contador canônico (0-6).
  const exhaustionLevel = Number.isInteger(character.state?.exhaustion) ? character.state.exhaustion : 0;
  const afterExhaustion = Math.max(0, baseResolved.value - exhaustionLevel * EXHAUSTION_SPEED_PENALTY_METERS);

  const affectsMovement = character.build?.options?.encumbranceAffectsMovement === true;
  const encumbranceLevel = typeof context.encumbranceLevel === 'string' ? context.encumbranceLevel : 'none';
  const effective =
    affectsMovement && encumbranceLevel === 'overloaded'
      ? Math.min(afterExhaustion, OVERLOADED_SPEED_METERS)
      : afterExhaustion;

  return ok(
    Object.freeze({
      base: baseResolved.value,
      effective,
      encumbranceLevel,
      exhaustionLevel,
      carryingCapacity: carryingCapacityResolved.value,
      sizeSlug,
    }),
  );
}
