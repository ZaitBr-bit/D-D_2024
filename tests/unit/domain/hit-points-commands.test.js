// Testes dos comandos de PV (Task 17): `domain/commands/hit-points.js`.
// Cobre absorção de dano por PV temporário, cura com teto de máximo, reset
// de salvaguardas contra morte ao curar a partir de 0, PV temporário "usa o
// maior valor" (não acumula), gasto de dado de vida, e não-mutação/
// referência lógica original em toda falha — conforme
// `tests/fixtures/expected/command-transitions.json` (categorias "dano",
// "cura", "pv_temporario").

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import {
  applyDamage,
  applyHealing,
  grantTemporaryHitPoints,
  spendHitDie,
  applyClampedDelta,
} from '../../../site/js/domain/commands/hit-points.js';
import { executeCharacterCommand } from '../../../site/js/domain/commands/command-dispatcher.js';

const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

/**
 * Congela `value` recursivamente (mesma disciplina de
 * tests/unit/domain/character-queries.test.js) para que qualquer mutação
 * indevida de um comando exploda com TypeError em vez de passar em silêncio.
 * @param {*} value
 * @param {WeakSet<object>} [seen]
 * @returns {*}
 */
function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return value;
  }
  seen.add(value);
  Object.freeze(value);
  for (const key of Object.keys(value)) {
    deepFreeze(value[key], seen);
  }
  return value;
}

/**
 * Monta um personagem canônico v2 de teste com `state` sobreposto (nível,
 * PV, dados de vida, salvaguardas contra morte), sempre congelado.
 * @param {object} [stateOverrides]
 * @returns {object}
 */
function makeCharacter(stateOverrides = {}) {
  const base = createEmptyCharacter({ id: 'char-1', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
  const character = { ...base, state: { ...base.state, ...stateOverrides } };
  return deepFreeze(character);
}

describe('domain/commands/hit-points — applyClampedDelta (núcleo compartilhado com ficha-edicoes.js)', () => {
  test('cura respeita o teto', () => {
    assert.deepEqual(applyClampedDelta(30, 15, 38), { next: 38, applied: 8 });
  });
  test('dano nunca fica abaixo de 0', () => {
    assert.deepEqual(applyClampedDelta(5, -10, 100), { next: 0, applied: -5 });
  });
  test('sem teto, aplica o delta integralmente (ainda com piso 0)', () => {
    assert.deepEqual(applyClampedDelta(10, 5), { next: 15, applied: 5 });
  });
});

describe('domain/commands/hit-points — applyDamage', () => {
  test('dano é absorvido primeiro pelo PV temporário; excedente reduz PV atual', () => {
    const character = makeCharacter({ hitPoints: { current: 20, temporary: 5 } });
    const result = applyDamage(character, { amount: 8 });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.hitPoints.temporary, 0);
    assert.equal(result.character.state.hitPoints.current, 17);
    assert.deepEqual([...result.affected].sort(), ['hp.current', 'hp.temporary']);
    // Não muta o personagem original.
    assert.equal(character.state.hitPoints.current, 20);
    assert.equal(character.state.hitPoints.temporary, 5);
  });

  test('dano até PV atual chegar a 0 nunca fica negativo; NÃO reseta salvaguardas contra morte', () => {
    const character = makeCharacter({
      hitPoints: { current: 5, temporary: 0 },
      deathSaves: { successes: 1, failures: 2 },
    });
    const result = applyDamage(character, { amount: 10 });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.hitPoints.current, 0);
    assert.deepEqual(result.character.state.deathSaves, { successes: 1, failures: 2 });
    assert.deepEqual(result.affected, ['hp.current']);
  });

  test('dano de valor 0 é um no-op de sucesso (affected vazio)', () => {
    const character = makeCharacter({ hitPoints: { current: 20, temporary: 0 } });
    const result = applyDamage(character, { amount: 0 });
    assert.equal(result.ok, true);
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
  });

  test('amount inválido (negativo/fração/NaN) é erro explícito; personagem original preservado por referência', () => {
    const character = makeCharacter({ hitPoints: { current: 20, temporary: 0 } });
    for (const amount of [-1, 1.5, NaN, Infinity, '8', null, undefined]) {
      const result = applyDamage(character, { amount });
      assert.equal(result.ok, false, JSON.stringify(amount));
      assert.equal(result.character, character);
      assert.deepEqual(result.affected, []);
      assert.equal(result.error.code, 'COMMAND_HP_AMOUNT_INVALID');
    }
  });
});

describe('domain/commands/hit-points — applyHealing', () => {
  test('cura incrementa PV atual sem ultrapassar o máximo', () => {
    const character = makeCharacter({ hitPoints: { current: 30, temporary: 0 } });
    const result = applyHealing(character, { amount: 15 }, { maximumHitPoints: 38 });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.hitPoints.current, 38);
    assert.deepEqual(result.affected, ['hp.current']);
  });

  test('cura que eleva PV atual de 0 para positivo reseta salvaguardas contra morte', () => {
    const character = makeCharacter({
      hitPoints: { current: 0, temporary: 0 },
      deathSaves: { successes: 2, failures: 1 },
    });
    const result = applyHealing(character, { amount: 8 }, { maximumHitPoints: 38 });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.hitPoints.current, 8);
    assert.deepEqual(result.character.state.deathSaves, { successes: 0, failures: 0 });
    assert.deepEqual([...result.affected].sort(), ['hp.current', 'state.deathSaves']);
  });

  test('sem override e sem context.maximumHitPoints, devolve erro explícito (nunca inventa o máximo)', () => {
    const character = makeCharacter({ hitPoints: { current: 10, temporary: 0 } });
    const result = applyHealing(character, { amount: 5 }, {});
    assert.equal(result.ok, false);
    assert.equal(result.character, character);
    assert.equal(result.error.code, 'CHARACTER_QUERY_HP_MAXIMUM_UNKNOWN');
  });

  test('override manual de hp.maximum tem precedência sobre context.maximumHitPoints', () => {
    const base = makeCharacter({ hitPoints: { current: 10, temporary: 0 } });
    const character = { ...base, overrides: { 'hp.maximum': { value: 12, source: 'manual' } } };
    const result = applyHealing(character, { amount: 20 }, { maximumHitPoints: 999 });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.hitPoints.current, 12);
  });
});

describe('domain/commands/hit-points — grantTemporaryHitPoints', () => {
  test('não acumula: usa o maior valor entre o atual e o novo', () => {
    const character = makeCharacter({ hitPoints: { current: 0, temporary: 8 } });
    const result = grantTemporaryHitPoints(character, { amount: 5 });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.hitPoints.temporary, 8);
    // Nada mudou de fato (8 já era maior) -> no-op de sucesso.
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
  });

  test('novo valor maior substitui o existente', () => {
    const character = makeCharacter({ hitPoints: { current: 0, temporary: 3 } });
    const result = grantTemporaryHitPoints(character, { amount: 10 });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.hitPoints.temporary, 10);
    assert.deepEqual(result.affected, ['hp.temporary']);
  });
});

describe('domain/commands/hit-points — spendHitDie', () => {
  test('gasta um dado de vida, incrementa hitDice.used e cura pelo valor informado', () => {
    const character = makeCharacter({
      level: 5,
      hitPoints: { current: 10, temporary: 0 },
      hitDice: { used: 1 },
    });
    const result = spendHitDie(character, { healAmount: 7 }, { maximumHitPoints: 38 });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.hitDice.used, 2);
    assert.equal(result.character.state.hitPoints.current, 17);
    assert.deepEqual([...result.affected].sort(), ['hp.current', 'state.hitDice.used']);
  });

  test('sem dados de vida restantes, é erro explícito (nunca gasta um dado inexistente)', () => {
    const character = makeCharacter({
      level: 3,
      hitPoints: { current: 10, temporary: 0 },
      hitDice: { used: 3 },
    });
    const result = spendHitDie(character, { healAmount: 7 }, { maximumHitPoints: 38 });
    assert.equal(result.ok, false);
    assert.equal(result.character, character);
    assert.equal(result.error.code, 'COMMAND_HP_NO_HIT_DICE_REMAINING');
  });
});

describe('domain/commands/command-dispatcher — executeCharacterCommand', () => {
  test('roteia "apply-damage" para o handler de dano', () => {
    const character = makeCharacter({ hitPoints: { current: 20, temporary: 0 } });
    const result = executeCharacterCommand(character, { type: 'apply-damage', amount: 5 }, {});
    assert.equal(result.ok, true);
    assert.equal(result.character.state.hitPoints.current, 15);
  });

  test('tipo de comando desconhecido é erro explícito; affected sempre presente e vazio', () => {
    const character = makeCharacter();
    const result = executeCharacterCommand(character, { type: 'voar' }, {});
    assert.equal(result.ok, false);
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
    assert.deepEqual(result.events, []);
    assert.equal(result.error.code, 'COMMAND_TYPE_UNKNOWN');
  });

  test('personagem inválido (sem identity/build/state) é erro explícito, nunca lança', () => {
    const result = executeCharacterCommand({}, { type: 'apply-damage', amount: 1 }, {});
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'COMMAND_CHARACTER_INVALID');
  });

  test('comando sem "type" string é erro explícito', () => {
    const character = makeCharacter();
    for (const command of [null, undefined, 42, [], { amount: 1 }]) {
      const result = executeCharacterCommand(character, command, {});
      assert.equal(result.ok, false, JSON.stringify(command));
      assert.equal(result.error.code, 'COMMAND_TYPE_INVALID');
    }
  });

  test('todo resultado (sucesso ou falha) tem "affected" como array', () => {
    const character = makeCharacter({ hitPoints: { current: 20, temporary: 0 } });
    const ok = executeCharacterCommand(character, { type: 'apply-damage', amount: 0 }, {});
    const err = executeCharacterCommand(character, { type: 'apply-damage', amount: -1 }, {});
    assert.ok(Array.isArray(ok.affected));
    assert.ok(Array.isArray(err.affected));
  });
});
