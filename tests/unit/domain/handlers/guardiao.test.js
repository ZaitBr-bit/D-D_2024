// Testes do handler oficial do Guardião (Task 21).
//
// RED esperado antes desta tarefa: o módulo do handler não existia.
//
// Oráculo: `tests/fixtures/expected/class-actions/divine-primal.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { guardiaoHandler } from '../../../../site/js/domain/rulesets/dnd2024/handlers/guardiao.js';
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
  transitionCasesFor,
  FOREIGN_TALENT_RESOURCE_ID,
  FOREIGN_USAGE_FLAG_KEY,
} from '../../../helpers/martial-fixtures.js';

const CLASS_ID = 'dnd2024:class:guardiao';
const ANDARILHO = 'dnd2024:subclass:andarilho-feerico';
const CACADOR = 'dnd2024:subclass:cacador';
const INIMIGO = 'dnd2024:resource:inimigo-favorito';

describe('handler class-guardiao — paridade com divine-primal.json', () => {
  const projections = projectionCasesFor('class-guardiao');
  const transitions = transitionCasesFor('class-guardiao');

  test('o fixture cobre projeções e transições do Guardião', () => {
    assert.ok(projections.length >= 2, 'esperado >= 2 casos de projeção no fixture');
    assert.ok(transitions.length >= 6, 'esperado >= 6 casos de transição no fixture');
  });

  for (const testCase of projections) {
    test(`projeção: ${testCase.id}`, () => assertProjectionCase(guardiaoHandler, testCase));
  }
  for (const testCase of transitions) {
    test(`transição: ${testCase.id}`, () => assertTransitionCase(guardiaoHandler, testCase));
  }
});

describe('handler class-guardiao — Inimigo Favorito por nível (tetos do conteúdo)', () => {
  for (const [level, max] of [[1, 2], [4, 2], [5, 3], [9, 4], [13, 5], [17, 6], [20, 6]]) {
    test(`nível ${level}: teto declarado = ${max}`, () => {
      const character = makeMartialCharacter({ classId: CLASS_ID, level });
      const result = guardiaoHandler.project(character, makeContext());
      assert.equal(result.ok, true);
      assert.equal(result.value.resources[INIMIGO].max, max);
    });
  }
});

describe('handler class-guardiao — descanso curto é vazio POR VERIFICAÇÃO', () => {
  // `site/js/pages/sheet.js` não tem bloco de Guardião na função de descanso
  // curto (só no longo, linha 4765). Este teste trava essa ausência: se
  // alguém acrescentar uma recarga de curto sem base no baseline, ele quebra.
  test('nenhum recurso ou flag muda no descanso curto', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: ANDARILHO,
      level: 13,
      resources: { [INIMIGO]: { current: 1, sourceInstanceId: classSource(CLASS_ID) } },
      usageFlags: {
        [`${classSource(CLASS_ID)}:marca-predador-ativa`]: true,
        [subclassFlag(ANDARILHO, 'reforcos-feericos-usado')]: true,
      },
    });
    const result = guardiaoHandler.onRest(character, { kind: 'short' }, makeContext());
    assert.equal(result.ok, true);
    assert.deepEqual(result.affected, []);
    assert.equal(result.character, character, 'sem mudança, o descanso devolve o mesmo objeto');
  });

  test('o descanso longo, esse sim, restaura e limpa', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: ANDARILHO,
      level: 13,
      resources: { [INIMIGO]: { current: 1, sourceInstanceId: classSource(CLASS_ID) } },
      usageFlags: {
        [`${classSource(CLASS_ID)}:marca-predador-ativa`]: true,
        [subclassFlag(ANDARILHO, 'reforcos-feericos-usado')]: true,
      },
    });
    const result = guardiaoHandler.onRest(character, { kind: 'long' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[INIMIGO].current, 5);
    assert.equal(result.character.state.usageFlags[`${classSource(CLASS_ID)}:marca-predador-ativa`], false);
    assert.equal(result.character.state.usageFlags[subclassFlag(ANDARILHO, 'reforcos-feericos-usado')], false);
  });
});

describe('handler class-guardiao — Marca do Caçador', () => {
  test('sem usos, a ação é recusada e a flag NÃO é escrita', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 13,
      resources: { [INIMIGO]: { current: 0, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const result = guardiaoHandler.execute(character, { actionId: 'usar-marca-do-cacador' }, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_INSUFFICIENT');
    assert.equal(
      Object.hasOwn(result.character.state.usageFlags, `${classSource(CLASS_ID)}:marca-predador-ativa`),
      false,
    );
  });

  test('encerrar a marca não devolve o uso', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 13,
      resources: { [INIMIGO]: { current: 2, sourceInstanceId: classSource(CLASS_ID) } },
      usageFlags: { [`${classSource(CLASS_ID)}:marca-predador-ativa`]: true },
    });
    const result = guardiaoHandler.execute(character, { actionId: 'encerrar-marca-do-cacador' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[INIMIGO].current, 2);
    assert.equal(result.character.state.usageFlags[`${classSource(CLASS_ID)}:marca-predador-ativa`], false);
  });
});

describe('handler class-guardiao — subclasses', () => {
  test('Caçador e Senhor das Feras não têm flag de uso (só escolhas persistentes)', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, subclassId: CACADOR, level: 11 });
    const result = guardiaoHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    assert.deepEqual(Object.keys(result.value.flags), [`${classSource(CLASS_ID)}:marca-predador-ativa`]);
  });

  test('Reforços Feéricos: usar → recusar → descanso longo → usar de novo', () => {
    const base = makeMartialCharacter({ classId: CLASS_ID, subclassId: ANDARILHO, level: 13 });
    const key = subclassFlag(ANDARILHO, 'reforcos-feericos-usado');

    const primeiro = guardiaoHandler.execute(base, { actionId: 'andarilho-reforcos-feericos' }, makeContext());
    assert.equal(primeiro.ok, true);
    assert.equal(primeiro.character.state.usageFlags[key], true);

    const segundo = guardiaoHandler.execute(
      primeiro.character,
      { actionId: 'andarilho-reforcos-feericos' },
      makeContext(),
    );
    assert.equal(segundo.ok, false);
    assert.equal(segundo.error.code, 'HANDLER_ACTION_FLAG_STATE_INVALID');

    const longo = guardiaoHandler.onRest(primeiro.character, { kind: 'long' }, makeContext());
    assert.equal(longo.ok, true);
    assert.equal(longo.character.state.usageFlags[key], false);
  });
});

describe('handler class-guardiao — conjuração NÃO passa pelo handler', () => {
  test('o meio-conjurador não projeta espaço nem magia preparada aqui', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 17 });
    const result = guardiaoHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    assert.deepEqual(Object.keys(result.value.resources), [INIMIGO]);
  });
});

describe('handler class-guardiao — isolamento de proveniência', () => {
  test('a fatia de outra proveniência sobrevive por REFERÊNCIA à ação e ao descanso', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 13,
      resources: { [INIMIGO]: { current: 3, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const before = character.state.resources[FOREIGN_TALENT_RESOURCE_ID];

    const executed = guardiaoHandler.execute(character, { actionId: 'usar-marca-do-cacador' }, makeContext());
    assert.equal(executed.ok, true);
    assert.equal(executed.character.state.resources[FOREIGN_TALENT_RESOURCE_ID], before);
    assert.equal(executed.character.state.usageFlags[FOREIGN_USAGE_FLAG_KEY], true);

    const rested = guardiaoHandler.onRest(executed.character, { kind: 'long' }, makeContext());
    assert.equal(rested.ok, true);
    assert.equal(rested.character.state.resources[FOREIGN_TALENT_RESOURCE_ID], before);
  });
});

describe('handler class-guardiao — personagem vindo da MIGRAÇÃO REAL v1 -> v2', () => {
  const estagio = migrationStageBefore('migracao-escolhas-classe-legadas');

  test('a migração real não materializa Inimigo Favorito', () => {
    const { character } = migrateLegacyClassCharacter('classe-guardiao', {
      ...estagio,
      nivel: 13,
      recursos: { guardiao: { inimigo_favorito_usos_gastos: 3 } },
    });
    assert.deepEqual(character.state.resources, {});
    assert.deepEqual(character.extensions.legacyPassthrough.recursos, {
      guardiao: { inimigo_favorito_usos_gastos: 3 },
    });
  });

  test('project reporta ausente e execute/onRest não criam a entrada', () => {
    const { character } = migrateLegacyClassCharacter('classe-guardiao', { ...estagio, nivel: 13 });
    const projected = guardiaoHandler.project(character, makeContext());
    assert.equal(projected.ok, true);
    assert.equal(projected.value.resources[INIMIGO].current, null);
    assert.equal(projected.value.resources[INIMIGO].missing, true);
    assert.equal(projected.value.resources[INIMIGO].max, 5);

    const executed = guardiaoHandler.execute(character, { actionId: 'usar-marca-do-cacador' }, makeContext());
    assert.equal(executed.ok, false);
    assert.equal(executed.error.code, 'HANDLER_RESOURCE_NOT_INITIALIZED');

    for (const kind of ['short', 'long']) {
      const rested = guardiaoHandler.onRest(character, { kind }, makeContext());
      assert.equal(rested.ok, true, kind);
      assert.equal(Object.hasOwn(rested.character.state.resources, INIMIGO), false, kind);
    }
  });
});
