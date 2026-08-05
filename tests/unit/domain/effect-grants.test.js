// Testes das concessões declarativas (Task 15): `applyGrantEffects` é
// idempotente e sempre carimba proveniência determinística;
// `revokeGrantEffects` é o inverso EXATO (deep equality com o estado
// anterior) e nunca alcança concessões de outra fonte. `manual` é projeção
// sem mutação e tipo desconhecido é erro.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createResolvedEffect } from '../../../site/js/domain/effects/collect-effects.js';
import {
  applyGrantEffects,
  revokeGrantEffects,
  projectManualEffects,
} from '../../../site/js/domain/effects/apply-grants.js';
import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';

const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });
const CLASS_SOURCE = 'source:class:0000:dnd2024-class-barbaro';
const SPECIES_SOURCE = 'source:species:0000:dnd2024-species-anao';

/** Personagem canônico v2 vazio, usado como estado anterior de todos os testes. */
function baseCharacter() {
  return createEmptyCharacter({ id: 'char-1', now: '2026-07-31T00:00:00.000Z', rulesetRef: RULESET_REF });
}

/**
 * Monta um ResolvedEffect de concessão com proveniência explícita.
 * @param {object} effect
 * @param {{sourceInstanceId?: string, sourceId?: string, index?: number}} [provenance]
 */
function grant(effect, { sourceInstanceId = CLASS_SOURCE, sourceId = 'dnd2024:class:barbaro', index = 0 } = {}) {
  return createResolvedEffect({
    effect,
    group: 'progression',
    sourceId,
    sourceInstanceId,
    effectInstanceId: `effect:${sourceInstanceId}:${String(index).padStart(4, '0')}:${effect.id ?? effect.type}`,
    orderIndex: index,
  });
}

const PROFICIENCIA = { id: 'atletismo', type: 'proficiency', target: 'dnd2024:skill:atletismo', level: 'proficient' };
const IDIOMA = { id: 'anao', type: 'language', language: 'dnd2024:language:anao' };
const RESISTENCIA = { id: 'veneno', type: 'defense', damageType: 'dnd2024:damage-type:veneno', mode: 'resistance' };
const MAGIA = { id: 'luz', type: 'grant-spell', spell: 'dnd2024:spell:luz', alwaysPrepared: true };
const ITEM = { id: 'machado', type: 'grant-item', item: 'dnd2024:weapon:machado-grande', quantity: 1 };
const RECURSO = { id: 'furias', type: 'resource', resource: 'furias', max: 2, recovery: 'long-rest' };

const TODAS = [PROFICIENCIA, IDIOMA, RESISTENCIA, MAGIA, ITEM, RECURSO];

describe('applyGrantEffects', () => {
  test('concede proficiência, idioma, resistência, magia, item e recurso com proveniência', () => {
    const character = baseCharacter();
    const effects = TODAS.map((effect, index) => grant(effect, { index }));
    const result = applyGrantEffects(character, effects, {});
    assert.strictEqual(result.ok, true, JSON.stringify(result.error ?? null));

    const { character: next, applied, warnings } = result.value;
    assert.deepStrictEqual(warnings.map((warning) => warning.code), []);
    assert.strictEqual(applied.length, TODAS.length);
    for (const change of applied) {
      assert.strictEqual(change.sourceInstanceId, CLASS_SOURCE);
      assert.ok(change.effectInstanceId.startsWith(`effect:${CLASS_SOURCE}:`));
      assert.ok(Object.isFrozen(change));
    }

    // Proficiência/idioma/resistência ficam em state.activeEffects, o único
    // lugar do schema canônico que carrega proveniência para concessão solta.
    const kinds = next.state.activeEffects.map((entry) => entry.data.kind).sort();
    assert.deepStrictEqual(kinds, ['defense', 'language', 'proficiency', 'resource']);

    assert.deepStrictEqual(
      next.state.spells.known.map((entry) => entry.spellRef.id),
      ['dnd2024:spell:luz'],
    );
    assert.deepStrictEqual(
      next.state.spells.prepared.map((entry) => entry.spellRef.id),
      ['dnd2024:spell:luz'],
    );
    assert.deepStrictEqual(
      next.state.inventory.map((entry) => [entry.itemRef.id, entry.quantity, entry.sourceInstanceId]),
      [['dnd2024:weapon:machado-grande', 1, CLASS_SOURCE]],
    );
    assert.deepStrictEqual(next.state.resources, {
      'dnd2024:resource:furias': { current: 2, sourceInstanceId: CLASS_SOURCE },
    });
  });

  test('não muta o personagem nem os efeitos recebidos', () => {
    const character = baseCharacter();
    const snapshot = JSON.parse(JSON.stringify(character));
    const effects = TODAS.map((effect, index) => grant(effect, { index }));
    applyGrantEffects(character, effects, {});
    assert.deepStrictEqual(JSON.parse(JSON.stringify(character)), snapshot);
  });

  test('aplicar duas vezes é idempotente: nada duplica e o segundo `applied` é vazio', () => {
    const effects = TODAS.map((effect, index) => grant(effect, { index }));
    const first = applyGrantEffects(baseCharacter(), effects, {});
    const second = applyGrantEffects(first.value.character, effects, {});
    assert.strictEqual(second.ok, true);
    assert.deepStrictEqual(second.value.applied, []);
    assert.deepStrictEqual(second.value.character, first.value.character);
  });

  test('os IDs de instância são determinísticos (mesmo input, mesmo ID)', () => {
    const effects = TODAS.map((effect, index) => grant(effect, { index }));
    const a = applyGrantEffects(baseCharacter(), effects, {});
    const b = applyGrantEffects(baseCharacter(), effects, {});
    assert.deepStrictEqual(a.value.character, b.value.character);
    assert.deepStrictEqual(
      a.value.applied.map((change) => change.effectInstanceId),
      b.value.applied.map((change) => change.effectInstanceId),
    );
  });

  test('condição concedida entra em state.conditions e registra que foi ela que acrescentou', () => {
    const effect = { id: 'enfeiticado', type: 'condition', condition: 'dnd2024:condition:enfeiticado' };
    const result = applyGrantEffects(baseCharacter(), [grant(effect)], {});
    assert.deepStrictEqual(result.value.character.state.conditions, ['dnd2024:condition:enfeiticado']);
    const record = result.value.character.state.activeEffects[0];
    assert.strictEqual(record.data.addedToConditions, true);
  });

  test('condição já presente antes da aplicação não é reivindicada pela concessão', () => {
    const before = baseCharacter();
    const character = { ...before, state: { ...before.state, conditions: ['dnd2024:condition:enfeiticado'] } };
    const effect = { id: 'enfeiticado', type: 'condition', condition: 'dnd2024:condition:enfeiticado' };
    const result = applyGrantEffects(character, [grant(effect)], {});
    assert.deepStrictEqual(result.value.character.state.conditions, ['dnd2024:condition:enfeiticado']);
    assert.strictEqual(result.value.character.state.activeEffects[0].data.addedToConditions, false);
  });

  test('recurso com `max` não numérico avisa e não inventa um `current`', () => {
    const effect = { id: 'maos-curativas', type: 'resource', resource: 'maos-curativas', max: 'proficiency-bonus' };
    const result = applyGrantEffects(baseCharacter(), [grant(effect, { sourceId: 'dnd2024:species:aasimar' })], {});
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.value.character.state.resources, {});
    assert.deepStrictEqual(
      result.value.warnings.map((warning) => warning.code),
      ['EFFECT_RESOURCE_MAX_NOT_NUMERIC'],
    );
    // A concessão em si continua registrada (com proveniência), só o estado
    // numérico é que não foi inventado.
    assert.strictEqual(result.value.character.state.activeEffects.length, 1);
  });

  test('recurso com `max` por variável resolve pelo contexto', () => {
    const effect = { id: 'maos-curativas', type: 'resource', resource: 'maos-curativas', max: 'proficiency-bonus' };
    const result = applyGrantEffects(baseCharacter(), [grant(effect, { sourceId: 'dnd2024:species:aasimar' })], {
      variables: { 'proficiency-bonus': 3 },
    });
    assert.deepStrictEqual(result.value.warnings, []);
    assert.strictEqual(result.value.character.state.resources['dnd2024:resource:maos-curativas'].current, 3);
  });

  test('efeitos que não são concessão (modifier/choice/official-handler/manual) não mudam o personagem', () => {
    const character = baseCharacter();
    const effects = [
      grant({ id: 'ca', type: 'modifier', target: 'ac', operation: 'add', value: 1 }, { index: 0 }),
      grant({ id: 'nota', type: 'manual', text: 'Nota de regra.' }, { index: 1 }),
      grant({ id: 'furia', type: 'official-handler', handlerId: 'furia', params: {} }, { index: 2 }),
    ];
    const result = applyGrantEffects(character, effects, {});
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.value.applied, []);
    assert.deepStrictEqual(result.value.character, character);
  });

  test('tipo de efeito desconhecido é erro', () => {
    const result = applyGrantEffects(baseCharacter(), [grant({ id: 'x', type: 'grant-superpower' })], {});
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_TYPE_UNKNOWN');
  });

  test('o personagem devolvido é congelado', () => {
    const result = applyGrantEffects(baseCharacter(), [grant(PROFICIENCIA)], {});
    assert.ok(Object.isFrozen(result.value.character));
    assert.ok(Object.isFrozen(result.value.character.state));
    assert.ok(Object.isFrozen(result.value.applied));
    assert.ok(Object.isFrozen(result.value.warnings));
  });
});

describe('revokeGrantEffects', () => {
  test('é o inverso exato de applyGrantEffects (deep equality com o estado anterior)', () => {
    const before = baseCharacter();
    const effects = TODAS.map((effect, index) => grant(effect, { index }));
    const applied = applyGrantEffects(before, effects, {});
    assert.notDeepStrictEqual(applied.value.character, before);

    const revoked = revokeGrantEffects(applied.value.character, { sourceInstanceIds: [CLASS_SOURCE] }, {});
    assert.strictEqual(revoked.ok, true, JSON.stringify(revoked.error ?? null));
    assert.deepStrictEqual(revoked.value.character, before);
    assert.strictEqual(revoked.value.removed.length, applied.value.applied.length);
  });

  test('revogar concessões de uma fonte não afeta as de outra fonte', () => {
    const before = baseCharacter();
    const daClasse = [grant(PROFICIENCIA, { index: 0 }), grant(RECURSO, { index: 1 })];
    const daEspecie = [
      grant(IDIOMA, { sourceInstanceId: SPECIES_SOURCE, sourceId: 'dnd2024:species:anao', index: 0 }),
      grant(RESISTENCIA, { sourceInstanceId: SPECIES_SOURCE, sourceId: 'dnd2024:species:anao', index: 1 }),
    ];

    const comClasse = applyGrantEffects(before, daClasse, {}).value.character;
    const comAmbas = applyGrantEffects(comClasse, daEspecie, {}).value.character;

    const semClasse = revokeGrantEffects(comAmbas, { sourceInstanceIds: [CLASS_SOURCE] }, {});
    assert.strictEqual(semClasse.ok, true);
    // Sobram exatamente as duas concessões da espécie, intactas.
    const restantes = semClasse.value.character.state.activeEffects;
    assert.deepStrictEqual(
      restantes.map((entry) => entry.sourceInstanceId),
      [SPECIES_SOURCE, SPECIES_SOURCE],
    );
    assert.deepStrictEqual(semClasse.value.character.state.resources, {});
    // E a mesma revogação aplicada ao estado só-espécie é idempotente.
    const soEspecie = applyGrantEffects(before, daEspecie, {}).value.character;
    assert.deepStrictEqual(semClasse.value.character, soEspecie);
  });

  test('revogar duas vezes é idempotente e o segundo `removed` é vazio', () => {
    const effects = TODAS.map((effect, index) => grant(effect, { index }));
    const comGrants = applyGrantEffects(baseCharacter(), effects, {}).value.character;
    const first = revokeGrantEffects(comGrants, { sourceInstanceIds: [CLASS_SOURCE] }, {});
    const second = revokeGrantEffects(first.value.character, { sourceInstanceIds: [CLASS_SOURCE] }, {});
    assert.deepStrictEqual(second.value.removed, []);
    assert.deepStrictEqual(second.value.character, first.value.character);
  });

  test('não remove condição que já existia antes da concessão', () => {
    const before = baseCharacter();
    const character = { ...before, state: { ...before.state, conditions: ['dnd2024:condition:enfeiticado'] } };
    const effect = { id: 'enfeiticado', type: 'condition', condition: 'dnd2024:condition:enfeiticado' };
    const comGrant = applyGrantEffects(character, [grant(effect)], {}).value.character;
    const revoked = revokeGrantEffects(comGrant, { sourceInstanceIds: [CLASS_SOURCE] }, {});
    assert.deepStrictEqual(revoked.value.character, character);
    assert.deepStrictEqual(revoked.value.character.state.conditions, ['dnd2024:condition:enfeiticado']);
  });

  test('não muta o personagem recebido', () => {
    const comGrants = applyGrantEffects(baseCharacter(), [grant(PROFICIENCIA)], {}).value.character;
    const snapshot = JSON.parse(JSON.stringify(comGrants));
    revokeGrantEffects(comGrants, { sourceInstanceIds: [CLASS_SOURCE] }, {});
    assert.deepStrictEqual(JSON.parse(JSON.stringify(comGrants)), snapshot);
  });

  test('lista de fontes ausente ou malformada é erro', () => {
    const character = baseCharacter();
    for (const params of [undefined, {}, { sourceInstanceIds: 'x' }, { sourceInstanceIds: [''] }, { sourceInstanceIds: [null] }]) {
      const result = revokeGrantEffects(character, params, {});
      assert.strictEqual(result.ok, false, JSON.stringify(params ?? null));
      assert.strictEqual(result.error.code, 'EFFECT_REVOKE_INVALID_REQUEST');
    }
  });

  test('lista vazia de fontes não remove nada (nunca "remover tudo")', () => {
    const comGrants = applyGrantEffects(baseCharacter(), [grant(PROFICIENCIA)], {}).value.character;
    const result = revokeGrantEffects(comGrants, { sourceInstanceIds: [] }, {});
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.value.removed, []);
    assert.deepStrictEqual(result.value.character, comGrants);
  });
});

describe('projectManualEffects', () => {
  test('projeta o texto dos efeitos manuais sem tocar no personagem', () => {
    const effects = [
      grant({ id: 'nota-a', type: 'manual', text: 'Primeira nota.' }, { index: 0 }),
      grant({ id: 'nota-b', type: 'manual', text: 'Segunda nota.' }, { index: 1 }),
      grant(PROFICIENCIA, { index: 2 }),
    ];
    const projection = projectManualEffects(effects);
    assert.deepStrictEqual(
      projection.map((entry) => entry.text),
      ['Primeira nota.', 'Segunda nota.'],
    );
    for (const entry of projection) {
      assert.strictEqual(entry.sourceInstanceId, CLASS_SOURCE);
      assert.ok(Object.isFrozen(entry));
    }
    assert.ok(Object.isFrozen(projection));
  });

  test('nenhum efeito manual devolve lista vazia, não null', () => {
    assert.deepStrictEqual(projectManualEffects([grant(PROFICIENCIA)]), []);
  });
});

// --- Recurso PREEXISTENTE: simetria com `addedToConditions` ----------------
//
// `apply` só cria `state.resources[resourceId]` quando ainda não existe estado
// para ele, e anota isso em `data.createdResourceState`. A revogação precisa
// LER essa anotação: um estado preexistente que a concessão apenas reaproveitou
// (coincidência de `resourceId`) não pode ser apagado — do contrário
// `revokeGrantEffects` deixaria de ser o inverso exato fora do caso em que o
// personagem começa sem recursos.

/**
 * Personagem canônico v2 com um estado de recurso PREEXISTENTE, cujo
 * `sourceInstanceId` é o mesmo que a concessão vai usar (o pior caso: a
 * revogação por fonte, sozinha, não consegue distinguir os dois).
 * @param {string} resourceId
 * @param {number} current
 * @param {string} sourceInstanceId
 * @returns {object}
 */
function characterComRecurso(resourceId, current, sourceInstanceId) {
  const base = baseCharacter();
  return {
    ...base,
    state: { ...base.state, resources: { [resourceId]: { current, sourceInstanceId } } },
  };
}

describe('recurso preexistente reaproveitado por coincidência de resourceId', () => {
  test('apply NÃO sobrescreve o estado preexistente e anota createdResourceState: false', () => {
    const character = characterComRecurso('dnd2024:resource:furias', 1, CLASS_SOURCE);
    const result = applyGrantEffects(character, [grant(RECURSO)], {});
    assert.strictEqual(result.ok, true, JSON.stringify(result.error ?? null));

    const { character: next } = result.value;
    // `current` do jogador preservado (1, não o `max` 2 do conteúdo).
    assert.deepStrictEqual(next.state.resources, {
      'dnd2024:resource:furias': { current: 1, sourceInstanceId: CLASS_SOURCE },
    });
    const registro = next.state.activeEffects.find((entry) => entry.data.kind === 'resource');
    assert.strictEqual(registro.data.createdResourceState, false);
  });

  test('apply emite AppWarning quando o `max` declarado não pôde ser materializado', () => {
    const character = characterComRecurso('dnd2024:resource:furias', 1, CLASS_SOURCE);
    const result = applyGrantEffects(character, [grant(RECURSO)], {});
    assert.strictEqual(result.ok, true);

    const codigos = result.value.warnings.map((warning) => warning.code);
    assert.deepStrictEqual(codigos, ['EFFECT_RESOURCE_STATE_ALREADY_EXISTS']);
    const aviso = result.value.warnings[0];
    assert.strictEqual(aviso.context.resourceId, 'dnd2024:resource:furias');
    assert.strictEqual(aviso.context.declaredMax, 2);
    assert.strictEqual(aviso.context.resolvedMax, 2);
  });

  test('reaplicar a MESMA fonte com um `max` diferente (level-up) avisa em vez de mascarar', () => {
    // Faixa de ladder seguinte: mesmo `resourceId`, `max` maior, outro
    // `effectInstanceId`. O `max` efetivo continua não materializado — mas o
    // chamador é avisado, não enganado.
    const character = characterComRecurso('dnd2024:resource:furias', 2, CLASS_SOURCE);
    const nivel5 = { id: 'furias-5', type: 'resource', resource: 'furias', max: 3, recovery: 'long-rest' };
    const result = applyGrantEffects(character, [grant(nivel5, { index: 1 })], {});
    assert.strictEqual(result.ok, true);

    assert.deepStrictEqual(
      result.value.warnings.map((warning) => warning.code),
      ['EFFECT_RESOURCE_STATE_ALREADY_EXISTS'],
    );
    assert.strictEqual(result.value.warnings[0].context.resolvedMax, 3);
    assert.strictEqual(result.value.character.state.resources['dnd2024:resource:furias'].current, 2);
  });

  test('revogar a concessão NÃO apaga o recurso preexistente (inverso exato)', () => {
    const character = characterComRecurso('dnd2024:resource:furias', 1, CLASS_SOURCE);
    const aplicado = applyGrantEffects(character, [grant(RECURSO)], {});
    assert.strictEqual(aplicado.ok, true);

    const revogado = revokeGrantEffects(aplicado.value.character, { sourceInstanceIds: [CLASS_SOURCE] }, {});
    assert.strictEqual(revogado.ok, true, JSON.stringify(revogado.error ?? null));

    // Deep equality com o estado ANTERIOR à aplicação: o recurso continua lá.
    assert.deepStrictEqual(revogado.value.character.state.resources, {
      'dnd2024:resource:furias': { current: 1, sourceInstanceId: CLASS_SOURCE },
    });
    assert.deepStrictEqual(revogado.value.character.state.activeEffects, []);
  });

  test('quando a concessão FOI quem criou o recurso, a revogação continua removendo', () => {
    const aplicado = applyGrantEffects(baseCharacter(), [grant(RECURSO)], {});
    assert.strictEqual(aplicado.ok, true);
    assert.strictEqual(
      aplicado.value.character.state.activeEffects.find((entry) => entry.data.kind === 'resource').data
        .createdResourceState,
      true,
    );

    const revogado = revokeGrantEffects(aplicado.value.character, { sourceInstanceIds: [CLASS_SOURCE] }, {});
    assert.strictEqual(revogado.ok, true);
    assert.deepStrictEqual(revogado.value.character.state.resources, {});
  });
});
