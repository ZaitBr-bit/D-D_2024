// Módulo `domain/commands/hit-points`: comandos puros de PV (dano, cura, PV
// temporário e dados de vida). Cada comando recebe o personagem canônico v2
// (Task 12) e devolve o Command contract da Task 17 (`command-result.js`) —
// nunca muta o personagem recebido, nunca persiste.
//
// Reflete o comportamento do baseline (`tests/fixtures/expected/
// command-transitions.json`, commit e43c5ea):
//   - dano é absorvido primeiro pelo PV temporário; o excedente reduz PV
//     atual; PV atual nunca fica negativo (mínimo 0); dano NUNCA reseta as
//     salvaguardas contra morte (sheet.js:4085 só faz `Math.max(0, ...)`).
//   - cura incrementa PV atual sem ultrapassar o máximo; quando eleva PV
//     atual de 0 para um valor positivo, as salvaguardas contra morte são
//     resetadas a 0 (sheet.js:4106-4109).
//   - conceder PV temporário NÃO acumula: usa o maior valor entre o atual e
//     o novo (sheet.js: `Math.max(char.pv_temporario || 0, temp)`).
//   - gastar um dado de vida (descanso curto) incrementa
//     `state.hitDice.used` (nunca além do total) e cura pelo valor já
//     rolado externamente (este módulo não rola dados — rolagem é UI/RNG).

import { getHitPointProjection } from '../character/queries/hit-points.js';
import { commandOk, commandErr, commandError } from './command-result.js';

const SCOPE_HP_CURRENT = 'hp.current';
const SCOPE_HP_TEMPORARY = 'hp.temporary';
const SCOPE_DEATH_SAVES = 'state.deathSaves';
const SCOPE_HIT_DICE = 'state.hitDice.used';

/**
 * Aplica um delta a um valor inteiro, sempre dentro de `[0, ceiling]`, e
 * devolve tanto o próximo valor quanto o delta EFETIVAMENTE aplicado (que
 * pode ser menor que `delta` por causa do clamp). Núcleo puro compartilhado
 * com `site/js/ficha-edicoes.js#aplicarDeltaSistema` (que delega este
 * cálculo ao invés de reimplementá-lo) — mesma matemática do baseline
 * (`Math.max(0, Math.min(teto, atual + delta)) - atual`).
 * @param {number} current
 * @param {number} delta
 * @param {number} [ceiling]
 * @returns {{next: number, applied: number}}
 */
export function applyClampedDelta(current, delta, ceiling = Infinity) {
  const applied = Math.max(0, Math.min(ceiling, current + delta)) - current;
  return { next: current + applied, applied };
}

/**
 * Valida que `amount` é um inteiro finito >= 0 (dano/cura/PV temp/cura de
 * dado de vida nunca aceitam fração, negativo, NaN ou Infinity — nunca um
 * default inventado quando ausente/inválido).
 * @param {*} amount
 * @param {string} field
 * @returns {object | null} AppError, ou `null` quando válido.
 */
function invalidAmountError(amount, field) {
  if (Number.isInteger(amount) && amount >= 0) {
    return null;
  }
  return commandError('COMMAND_HP_AMOUNT_INVALID', `"${field}" deve ser um inteiro >= 0.`, {
    field,
    received: amount,
  });
}

/**
 * Aplica dano: primeiro absorvido pelo PV temporário, o excedente reduz o PV
 * atual (nunca abaixo de 0). Nunca reseta salvaguardas contra morte.
 * @param {object} character - CanonicalCharacter
 * @param {{amount: number}} params
 * @returns {import('./command-result.js').CommandResult}
 */
export function applyDamage(character, params = {}) {
  const amount = params?.amount;
  const invalid = invalidAmountError(amount, 'amount');
  if (invalid !== null) {
    return commandErr({ character, error: invalid });
  }

  const hitPoints = character.state.hitPoints;
  const temporaryAbsorbed = Math.min(hitPoints.temporary, amount);
  const remainingDamage = amount - temporaryAbsorbed;
  const nextTemporary = hitPoints.temporary - temporaryAbsorbed;
  const nextCurrent = Math.max(0, hitPoints.current - remainingDamage);

  if (nextTemporary === hitPoints.temporary && nextCurrent === hitPoints.current) {
    return commandOk({ character, events: [], affected: [] });
  }

  const affected = [];
  if (nextTemporary !== hitPoints.temporary) {
    affected.push(SCOPE_HP_TEMPORARY);
  }
  if (nextCurrent !== hitPoints.current) {
    affected.push(SCOPE_HP_CURRENT);
  }

  const nextCharacter = {
    ...character,
    state: { ...character.state, hitPoints: Object.freeze({ current: nextCurrent, temporary: nextTemporary }) },
  };
  Object.freeze(nextCharacter.state);
  Object.freeze(nextCharacter);

  return commandOk({
    character: nextCharacter,
    events: [{ type: 'damage-applied', amount, temporaryAbsorbed, currentReduced: remainingDamage }],
    affected,
  });
}

/**
 * Aplica cura: incrementa o PV atual sem ultrapassar o PV máximo (via
 * `getHitPointProjection` — a mesma fonte de verdade de "máximo efetivo" que
 * as consultas usam, override manual incluso). Quando a cura eleva o PV
 * atual de 0 para um valor positivo, zera as salvaguardas contra morte.
 * @param {object} character
 * @param {{amount: number}} params
 * @param {{maximumHitPoints?: number, registry?: object}} [context] - repassado a `getHitPointProjection`.
 * @returns {import('./command-result.js').CommandResult}
 */
export function applyHealing(character, params = {}, context = {}) {
  const amount = params?.amount;
  const invalid = invalidAmountError(amount, 'amount');
  if (invalid !== null) {
    return commandErr({ character, error: invalid });
  }

  const projection = getHitPointProjection(character, context);
  if (!projection.ok) {
    return commandErr({ character, error: projection.error });
  }

  const hitPoints = character.state.hitPoints;
  const { next: nextCurrent, applied } = applyClampedDelta(hitPoints.current, amount, projection.value.maximum);

  const wasAtZero = hitPoints.current === 0;
  const revivedFromZero = wasAtZero && nextCurrent > 0;

  if (applied === 0 && !revivedFromZero) {
    return commandOk({ character, events: [], affected: [] });
  }

  const deathSaves = character.state.deathSaves;
  const nextDeathSaves = revivedFromZero ? Object.freeze({ successes: 0, failures: 0 }) : deathSaves;

  const affected = [];
  if (applied !== 0) {
    affected.push(SCOPE_HP_CURRENT);
  }
  if (revivedFromZero) {
    affected.push(SCOPE_DEATH_SAVES);
  }

  const nextCharacter = {
    ...character,
    state: {
      ...character.state,
      hitPoints: Object.freeze({ current: nextCurrent, temporary: hitPoints.temporary }),
      deathSaves: nextDeathSaves,
    },
  };
  Object.freeze(nextCharacter.state);
  Object.freeze(nextCharacter);

  return commandOk({
    character: nextCharacter,
    events: [{ type: 'healing-applied', amount, appliedAmount: applied, revivedFromZero }],
    affected,
  });
}

/**
 * Concede PV temporário: NÃO acumula com o existente — usa o maior valor
 * entre o atual e o novo (mesma regra do baseline, replicada em múltiplos
 * pontos de sheet.js).
 * @param {object} character
 * @param {{amount: number}} params
 * @returns {import('./command-result.js').CommandResult}
 */
export function grantTemporaryHitPoints(character, params = {}) {
  const amount = params?.amount;
  const invalid = invalidAmountError(amount, 'amount');
  if (invalid !== null) {
    return commandErr({ character, error: invalid });
  }

  const hitPoints = character.state.hitPoints;
  const nextTemporary = Math.max(hitPoints.temporary, amount);
  if (nextTemporary === hitPoints.temporary) {
    return commandOk({ character, events: [], affected: [] });
  }

  const nextCharacter = {
    ...character,
    state: { ...character.state, hitPoints: Object.freeze({ current: hitPoints.current, temporary: nextTemporary }) },
  };
  Object.freeze(nextCharacter.state);
  Object.freeze(nextCharacter);

  return commandOk({
    character: nextCharacter,
    events: [{ type: 'temporary-hp-granted', amount, appliedTemporary: nextTemporary }],
    affected: [SCOPE_HP_TEMPORARY],
  });
}

/**
 * Gasta um dado de vida (tipicamente num descanso curto): incrementa
 * `state.hitDice.used` em 1 (nunca além do total de dados de vida, que é
 * `state.level` — ver `getHitPointProjection`) e cura pelo valor já rolado
 * externamente (`params.healAmount` — este comando não rola dados; rolagem é
 * responsabilidade de UI/RNG). Erro explícito quando não há dado de vida
 * disponível, em vez de gastar silenciosamente um dado inexistente.
 * @param {object} character
 * @param {{healAmount: number}} params
 * @param {{maximumHitPoints?: number, registry?: object}} [context]
 * @returns {import('./command-result.js').CommandResult}
 */
export function spendHitDie(character, params = {}, context = {}) {
  const healAmount = params?.healAmount;
  const invalid = invalidAmountError(healAmount, 'healAmount');
  if (invalid !== null) {
    return commandErr({ character, error: invalid });
  }

  const projection = getHitPointProjection(character, context);
  if (!projection.ok) {
    return commandErr({ character, error: projection.error });
  }
  if (projection.value.hitDiceRemaining <= 0) {
    return commandErr({
      character,
      error: commandError('COMMAND_HP_NO_HIT_DICE_REMAINING', 'Não há dados de vida disponíveis para gastar.', {}),
    });
  }

  const hitPoints = character.state.hitPoints;
  const { next: nextCurrent, applied } = applyClampedDelta(hitPoints.current, healAmount, projection.value.maximum);
  const wasAtZero = hitPoints.current === 0;
  const revivedFromZero = wasAtZero && nextCurrent > 0;

  const nextHitDiceUsed = character.state.hitDice.used + 1;
  const deathSaves = character.state.deathSaves;
  const nextDeathSaves = revivedFromZero ? Object.freeze({ successes: 0, failures: 0 }) : deathSaves;

  const affected = [SCOPE_HIT_DICE];
  if (applied !== 0) {
    affected.push(SCOPE_HP_CURRENT);
  }
  if (revivedFromZero) {
    affected.push(SCOPE_DEATH_SAVES);
  }

  const nextCharacter = {
    ...character,
    state: {
      ...character.state,
      hitPoints: Object.freeze({ current: nextCurrent, temporary: hitPoints.temporary }),
      hitDice: Object.freeze({ used: nextHitDiceUsed }),
      deathSaves: nextDeathSaves,
    },
  };
  Object.freeze(nextCharacter.state);
  Object.freeze(nextCharacter);

  return commandOk({
    character: nextCharacter,
    events: [{ type: 'hit-die-spent', healAmount, appliedAmount: applied, hitDiceUsed: nextHitDiceUsed }],
    affected,
  });
}
