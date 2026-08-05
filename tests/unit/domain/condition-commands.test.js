// Testes dos comandos de condições e recursos estruturados (Task 17):
// `domain/commands/conditions.js`. Cobre adicionar/remover condição por ID,
// simetria add/remove, uso/recarga de recurso estruturado, e o toggle de
// recurso de talento em formato legado (`extensions.legacyPassthrough`).
// Reflete `tests/fixtures/expected/command-transitions.json` (categorias
// "condicoes" e "recursos").

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import {
  addCondition,
  removeCondition,
  useResource,
  rechargeResource,
  toggleLegacyTalentResource,
} from '../../../site/js/domain/commands/conditions.js';

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

function makeCharacter({ state = {}, extensions } = {}) {
  const base = createEmptyCharacter({ id: 'char-1', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
  const character = {
    ...base,
    state: { ...base.state, ...state },
    ...(extensions ? { extensions } : {}),
  };
  return deepFreeze(character);
}

describe('domain/commands/conditions — addCondition/removeCondition', () => {
  test('adiciona uma condição por ID/texto livre', () => {
    const character = makeCharacter();
    const result = addCondition(character, { conditionId: 'Enjoo (leve)' });
    assert.equal(result.ok, true);
    assert.deepEqual(result.character.state.conditions, ['Enjoo (leve)']);
    assert.deepEqual(result.affected, ['state.conditions']);
    assert.deepEqual(character.state.conditions, []); // original intocado
  });

  test('adicionar uma condição já ativa é erro explícito (nunca duplica em silêncio)', () => {
    const character = makeCharacter({ state: { conditions: ['Enjoo (leve)'] } });
    const result = addCondition(character, { conditionId: 'Enjoo (leve)' });
    assert.equal(result.ok, false);
    assert.equal(result.character, character);
    assert.equal(result.error.code, 'COMMAND_CONDITION_ALREADY_ACTIVE');
  });

  test('remove uma condição ativa', () => {
    const character = makeCharacter({ state: { conditions: ['Enjoo (leve)'] } });
    const result = removeCondition(character, { conditionId: 'Enjoo (leve)' });
    assert.equal(result.ok, true);
    assert.deepEqual(result.character.state.conditions, []);
    assert.deepEqual(result.affected, ['state.conditions']);
  });

  test('remover uma condição ausente é erro explícito', () => {
    const character = makeCharacter();
    const result = removeCondition(character, { conditionId: 'Enjoo (leve)' });
    assert.equal(result.ok, false);
    assert.equal(result.character, character);
    assert.equal(result.error.code, 'COMMAND_CONDITION_NOT_ACTIVE');
  });

  test('add depois remove é simétrico (deep equality com o estado original)', () => {
    const character = makeCharacter();
    const added = addCondition(character, { conditionId: 'Enjoo (leve)' });
    const removed = removeCondition(added.character, { conditionId: 'Enjoo (leve)' });
    assert.equal(removed.ok, true);
    assert.deepEqual(removed.character.state.conditions, character.state.conditions);
  });

  test('conditionId inválido (vazio/não-string) é erro', () => {
    const character = makeCharacter();
    for (const conditionId of ['', null, undefined, 42]) {
      const result = addCondition(character, { conditionId });
      assert.equal(result.ok, false, JSON.stringify(conditionId));
      assert.equal(result.error.code, 'COMMAND_CONDITION_ID_INVALID');
    }
  });
});

describe('domain/commands/conditions — useResource/rechargeResource', () => {
  test('consome um recurso estruturado existente', () => {
    const character = makeCharacter({
      state: { resources: { 'dnd2024:resource:furia': { current: 3, sourceInstanceId: 'src-1' } } },
    });
    const result = useResource(character, { resourceId: 'dnd2024:resource:furia' });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources['dnd2024:resource:furia'].current, 2);
    assert.deepEqual(result.affected, ['state.resources']);
  });

  test('recurso inexistente é erro explícito', () => {
    const character = makeCharacter();
    const result = useResource(character, { resourceId: 'dnd2024:resource:furia' });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'COMMAND_RESOURCE_NOT_FOUND');
  });

  test('uso insuficiente (current < amount) é erro explícito, nunca satura em 0 silenciosamente', () => {
    const character = makeCharacter({
      state: { resources: { 'dnd2024:resource:furia': { current: 1, sourceInstanceId: 'src-1' } } },
    });
    const result = useResource(character, { resourceId: 'dnd2024:resource:furia', amount: 2 });
    assert.equal(result.ok, false);
    assert.equal(result.character, character);
    assert.equal(result.error.code, 'COMMAND_RESOURCE_INSUFFICIENT');
  });

  test('recarrega um recurso respeitando context.maximum quando informado', () => {
    const character = makeCharacter({
      state: { resources: { 'dnd2024:resource:furia': { current: 1, sourceInstanceId: 'src-1' } } },
    });
    const result = rechargeResource(character, { resourceId: 'dnd2024:resource:furia', amount: 5 }, { maximum: 3 });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources['dnd2024:resource:furia'].current, 3);
  });

  test('uso e recarga são simétricos (deep equality com o estado original)', () => {
    const character = makeCharacter({
      state: { resources: { 'dnd2024:resource:furia': { current: 3, sourceInstanceId: 'src-1' } } },
    });
    const used = useResource(character, { resourceId: 'dnd2024:resource:furia' });
    const recharged = rechargeResource(used.character, { resourceId: 'dnd2024:resource:furia', amount: 1 });
    assert.equal(recharged.ok, true);
    assert.deepEqual(recharged.character.state.resources, character.state.resources);
  });

  test('"current" corrompido (não inteiro) é erro explícito, nunca grava NaN em silêncio (fix round 1, achado I4)', () => {
    const character = makeCharacter({
      state: { resources: { 'dnd2024:resource:furia': { current: undefined, sourceInstanceId: 'src-1' } } },
    });
    const result = rechargeResource(character, { resourceId: 'dnd2024:resource:furia', amount: 1 });
    assert.equal(result.ok, false);
    assert.equal(result.character, character);
    assert.equal(result.error.code, 'COMMAND_RESOURCE_STATE_INVALID');
    // Nunca produz NaN em "current".
    assert.notEqual(Number.isNaN(result.character.state.resources['dnd2024:resource:furia'].current), true);
  });
});

describe('domain/commands/conditions — toggleLegacyTalentResource', () => {
  test('alterna um campo booleano em extensions.legacyPassthrough.recursos.talentos', () => {
    const character = makeCharacter({
      extensions: {
        legacyPassthrough: {
          recursos: { talentos: { dadiva_proeza_combate: { usado_no_turno: false } } },
        },
      },
    });
    const result = toggleLegacyTalentResource(character, {
      talentSlug: 'dadiva_proeza_combate',
      field: 'usado_no_turno',
      used: true,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.character.extensions.legacyPassthrough.recursos.talentos.dadiva_proeza_combate, {
      usado_no_turno: true,
    });
    assert.deepEqual(result.affected, ['extensions.legacyPassthrough.recursos']);
    // Original intocado.
    assert.deepEqual(character.extensions.legacyPassthrough.recursos.talentos.dadiva_proeza_combate, {
      usado_no_turno: false,
    });
  });

  test('restauração (usado: false depois de usado: true) é simétrica', () => {
    const character = makeCharacter({
      extensions: { legacyPassthrough: { recursos: { talentos: {} } } },
    });
    const used = toggleLegacyTalentResource(character, {
      talentSlug: 'dadiva_destino',
      field: 'usado',
      used: true,
    });
    const restored = toggleLegacyTalentResource(used.character, {
      talentSlug: 'dadiva_destino',
      field: 'usado',
      used: false,
    });
    assert.equal(restored.ok, true);
    assert.equal(restored.character.extensions.legacyPassthrough.recursos.talentos.dadiva_destino.usado, false);
  });

  test('valor idêntico ao já gravado é no-op de sucesso', () => {
    const character = makeCharacter({
      extensions: { legacyPassthrough: { recursos: { talentos: { x: { usado: true } } } } },
    });
    const result = toggleLegacyTalentResource(character, { talentSlug: 'x', field: 'usado', used: true });
    assert.equal(result.ok, true);
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
  });

  test('parâmetros inválidos são erro explícito', () => {
    const character = makeCharacter();
    assert.equal(
      toggleLegacyTalentResource(character, { talentSlug: '', field: 'usado', used: true }).error.code,
      'COMMAND_LEGACY_RESOURCE_SLUG_INVALID',
    );
    assert.equal(
      toggleLegacyTalentResource(character, { talentSlug: 'x', field: '', used: true }).error.code,
      'COMMAND_LEGACY_RESOURCE_FIELD_INVALID',
    );
    assert.equal(
      toggleLegacyTalentResource(character, { talentSlug: 'x', field: 'usado', used: 'sim' }).error.code,
      'COMMAND_LEGACY_RESOURCE_VALUE_INVALID',
    );
  });
});
