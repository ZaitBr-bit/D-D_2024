// Testes do comando de edição (Task 17): `domain/commands/edit-character.js`.
// Cobre a allowlist fechada (só "hp.maximum", derivada de
// baseline-field-inventory.json/classificação "override"), bloqueio de
// paths fora da allowlist (incluindo prototype pollution e identidade
// canônica), valores não finitos, e reversão idempotente.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import { editCharacterField, revertCharacterEdit } from '../../../site/js/domain/commands/edit-character.js';

const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

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

function makeCharacter(overrides) {
  const base = createEmptyCharacter({ id: 'char-1', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
  const character = { ...base, ...(overrides ? { overrides } : {}) };
  return deepFreeze(character);
}

describe('domain/commands/edit-character — allowlist', () => {
  test('paths fora da allowlist são recusados, incluindo identidade canônica e prototype pollution', () => {
    const character = makeCharacter();
    for (const path of ['identity.id', 'state.abilities.forca', '__proto__', 'constructor.prototype', 'nome', 'ac']) {
      const result = editCharacterField(character, { path, value: 10 });
      assert.equal(result.ok, false, path);
      assert.equal(result.character, character);
      assert.equal(result.error.code, 'COMMAND_EDIT_PATH_NOT_ALLOWED', path);
    }
  });
});

describe('domain/commands/edit-character — editCharacterField("hp.maximum")', () => {
  test('cria um override novo, preservando o máximo efetivo anterior como "original"', () => {
    const character = makeCharacter();
    const result = editCharacterField(
      character,
      { path: 'hp.maximum', value: 45 },
      { maximumHitPoints: 38, now: '2026-07-31T00:00:00.000Z' },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.character.overrides['hp.maximum'], {
      value: 45,
      original: 38,
      editedAt: '2026-07-31T00:00:00.000Z',
      source: 'manual',
    });
    assert.deepEqual(result.affected, ['hp.maximum']);
    assert.equal(character.overrides['hp.maximum'], undefined); // original intocado
  });

  test('uma segunda edição preserva o "original" da primeira (nunca reescreve com o valor já editado)', () => {
    const character = makeCharacter({
      'hp.maximum': { value: 45, original: 38, editedAt: '2026-07-31T00:00:00.000Z', source: 'manual' },
    });
    const result = editCharacterField(
      character,
      { path: 'hp.maximum', value: 50 },
      { maximumHitPoints: 999, now: '2026-08-01T00:00:00.000Z' },
    );
    assert.equal(result.ok, true);
    assert.equal(result.character.overrides['hp.maximum'].value, 50);
    assert.equal(result.character.overrides['hp.maximum'].original, 38);
  });

  test('valor não finito/fracionário é erro explícito (nunca inventa um valor plausível)', () => {
    const character = makeCharacter();
    for (const value of [NaN, Infinity, -Infinity, 10.5, '40', null, undefined]) {
      const result = editCharacterField(character, { path: 'hp.maximum', value }, { maximumHitPoints: 38 });
      assert.equal(result.ok, false, JSON.stringify(value));
      assert.equal(result.error.code, 'COMMAND_EDIT_VALUE_INVALID');
    }
  });

  test('sem máximo conhecido (nem override, nem context.maximumHitPoints), erro explícito', () => {
    const character = makeCharacter();
    const result = editCharacterField(character, { path: 'hp.maximum', value: 45 }, {});
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_QUERY_HP_MAXIMUM_UNKNOWN');
  });

  test('editar para o mesmo valor já vigente é no-op de sucesso', () => {
    const character = makeCharacter({
      'hp.maximum': { value: 45, original: 38, editedAt: '2026-07-31T00:00:00.000Z', source: 'manual' },
    });
    const result = editCharacterField(character, { path: 'hp.maximum', value: 45 }, { maximumHitPoints: 999 });
    assert.equal(result.ok, true);
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
  });
});

describe('domain/commands/edit-character — revertCharacterEdit', () => {
  test('remove o override existente', () => {
    const character = makeCharacter({
      'hp.maximum': { value: 45, original: 38, editedAt: '2026-07-31T00:00:00.000Z', source: 'manual' },
    });
    const result = revertCharacterEdit(character, { path: 'hp.maximum' });
    assert.equal(result.ok, true);
    assert.equal(Object.hasOwn(result.character.overrides, 'hp.maximum'), false);
    assert.deepEqual(result.affected, ['hp.maximum']);
  });

  test('reverter um path sem edição ativa é idempotente (no-op de sucesso, nunca erro)', () => {
    const character = makeCharacter();
    const result = revertCharacterEdit(character, { path: 'hp.maximum' });
    assert.equal(result.ok, true);
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
  });

  test('path fora da allowlist é recusado', () => {
    const character = makeCharacter();
    const result = revertCharacterEdit(character, { path: 'identity.id' });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'COMMAND_EDIT_PATH_NOT_ALLOWED');
  });
});
