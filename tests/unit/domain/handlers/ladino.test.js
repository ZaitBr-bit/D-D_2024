// Testes do handler oficial do Ladino (Task 20).
//
// RED esperado antes desta tarefa: o módulo do handler não existia.
//
// Oráculo: `tests/fixtures/expected/class-actions/martial.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ladinoHandler } from '../../../../site/js/domain/rulesets/dnd2024/handlers/ladino.js';
import {
  assertProjectionCase,
  assertTransitionCase,
  classSource,
  makeContext,
  migrateLegacyClassCharacter,
  migrationStageBefore,
  makeMartialCharacter,
  projectionCasesFor,
  subclassFlag,
  subclassSource,
  transitionCasesFor,
  FOREIGN_TALENT_RESOURCE_ID,
  FOREIGN_USAGE_FLAG_KEY,
} from '../../../helpers/martial-fixtures.js';

const CLASS_ID = 'dnd2024:class:ladino';
const ADAGA = 'dnd2024:subclass:adaga-espiritual';
const GOLPE_SORTE = 'dnd2024:resource:golpe-de-sorte';
const PSIONICOS = 'dnd2024:resource:dados-psionicos';

describe('handler class-ladino — paridade com martial.json', () => {
  const projections = projectionCasesFor('class-ladino');
  const transitions = transitionCasesFor('class-ladino');

  test('o fixture cobre projeções e transições do Ladino', () => {
    assert.ok(projections.length >= 2, 'esperado >= 2 casos de projeção no fixture');
    assert.ok(transitions.length >= 2, 'esperado >= 2 casos de transição no fixture');
  });

  for (const testCase of projections) {
    test(`projeção: ${testCase.id}`, () => assertProjectionCase(ladinoHandler, testCase));
  }
  for (const testCase of transitions) {
    test(`transição: ${testCase.id}`, () => assertTransitionCase(ladinoHandler, testCase));
  }
});

describe('handler class-ladino — Golpe de Sorte só existe no nível 20', () => {
  test('nível 19: o recurso não é concedido nem projetado', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 19 });
    const result = ladinoHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    assert.equal(Object.hasOwn(result.value.resources, GOLPE_SORTE), false);
  });

  test('nível 20 sem entrada materializada: {current: null, missing: true}', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 20 });
    const result = ladinoHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.resources[GOLPE_SORTE], {
      current: null,
      missing: true,
      max: 1,
      sourceInstanceId: classSource(CLASS_ID),
      // Correção I3 da revisão final: rótulo pt-BR declarado no handler.
      label: 'Golpe de Sorte',
    });
  });

  test('o descanso não materializa o Golpe de Sorte ausente', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 20 });
    for (const kind of ['short', 'long']) {
      const result = ladinoHandler.onRest(character, { kind }, makeContext());
      assert.equal(result.ok, true);
      assert.equal(Object.hasOwn(result.character.state.resources, GOLPE_SORTE), false, `descanso ${kind}`);
      assert.deepEqual(result.affected, []);
    }
  });
});

describe('handler class-ladino — Adaga Espiritual', () => {
  test('descanso curto devolve exatamente 1 dado psiônico', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: ADAGA,
      level: 17,
      resources: { [PSIONICOS]: { current: 4, sourceInstanceId: subclassSource(ADAGA) } },
    });
    const result = ladinoHandler.onRest(character, { kind: 'short' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[PSIONICOS].current, 5);
  });

  test('descanso curto não passa do teto declarado no conteúdo', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: ADAGA,
      level: 3,
      resources: { [PSIONICOS]: { current: 4, sourceInstanceId: subclassSource(ADAGA) } },
    });
    const result = ladinoHandler.onRest(character, { kind: 'short' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[PSIONICOS].current, 4);
    assert.deepEqual(result.affected, []);
  });

  test('flags de uso da subclasse não colidem com a flag de talento migrada', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: ADAGA,
      level: 17,
      usageFlags: { [subclassFlag(ADAGA, 'veu-psiquico-usado')]: true },
    });
    const result = ladinoHandler.onRest(character, { kind: 'long' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.usageFlags[subclassFlag(ADAGA, 'veu-psiquico-usado')], false);
    assert.equal(result.character.state.usageFlags[FOREIGN_USAGE_FLAG_KEY], true);
    assert.equal(Object.keys(result.character.state.usageFlags).length, 2);
  });

  test('o recurso de talento sobrevive por referência a uma ação da subclasse', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: ADAGA,
      level: 13,
      resources: { [PSIONICOS]: { current: 6, sourceInstanceId: subclassSource(ADAGA) } },
    });
    const before = character.state.resources[FOREIGN_TALENT_RESOURCE_ID];
    const result = ladinoHandler.execute(
      character,
      { actionId: 'gastar-dado-psionico', payload: { amount: 2 } },
      makeContext(),
    );
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[PSIONICOS].current, 4);
    assert.equal(result.character.state.resources[FOREIGN_TALENT_RESOURCE_ID], before);
  });

  test('ação de subclasse é recusada quando a subclasse é outra', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, subclassId: 'dnd2024:subclass:assassino', level: 13 });
    const result = ladinoHandler.execute(character, { actionId: 'veu-psiquico' }, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_ACTION_SUBCLASS_REQUIRED');
  });
});


describe('handler class-ladino — personagem vindo da MIGRAÇÃO REAL v1 -> v2', () => {
  // `legacy-migration-stages.json` + `legacy-all-classes.json`: o registro v1
  // passa por `migrateV1ToV2` de verdade, não por uma fixture "limpa" escrita
  // à mão. A migração NÃO materializa recursos de classe (só os de talento no
  // formato `{usado: boolean}`), então `state.resources` sai vazio mesmo para
  // um personagem que gastou usos — é exatamente o caso de recurso ausente.
  const estagio = migrationStageBefore('migracao-escolhas-classe-legadas');

  test('a migração real não materializa o recurso de classe', () => {
    const { character } = migrateLegacyClassCharacter('classe-ladino', {
      ...estagio,
      nivel: 20,
      
      recursos: { ladino: { golpe_sorte_usado: true } },
    });
    assert.deepEqual(character.state.resources, {});
    // O dado legado continua preservado verbatim, sem palpite de conversão.
    assert.deepEqual(character.extensions.legacyPassthrough.recursos, { ladino: { golpe_sorte_usado: true } });
  });

  test('project devolve {current: null, missing: true} — nunca um valor plausível', () => {
    const { character } = migrateLegacyClassCharacter('classe-ladino', {
      ...estagio,
      nivel: 20,
      
      recursos: { ladino: { golpe_sorte_usado: true } },
    });
    const result = ladinoHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    const projected = result.value.resources['dnd2024:resource:golpe-de-sorte'];
    assert.equal(projected.current, null);
    assert.equal(projected.missing, true);
    assert.equal(projected.max, 1);
  });

  test('nem execute nem onRest criam a entrada ausente', () => {
    const { character } = migrateLegacyClassCharacter('classe-ladino', {
      ...estagio,
      nivel: 20,
      
      recursos: { ladino: { golpe_sorte_usado: true } },
    });
    const executed = ladinoHandler.execute(character, { actionId: 'usar-golpe-de-sorte' }, makeContext());
    assert.equal(executed.ok, false);
    assert.equal(executed.error.code, 'HANDLER_RESOURCE_NOT_INITIALIZED');
    assert.equal(Object.hasOwn(executed.character.state.resources, 'dnd2024:resource:golpe-de-sorte'), false);

    for (const kind of ['short', 'long']) {
      const rested = ladinoHandler.onRest(character, { kind }, makeContext());
      assert.equal(rested.ok, true, kind);
      assert.equal(Object.hasOwn(rested.character.state.resources, 'dnd2024:resource:golpe-de-sorte'), false, kind);
    }
  });
});
