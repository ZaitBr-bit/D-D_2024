// Testes do handler oficial do Druida (Task 21).
//
// RED esperado antes desta tarefa: o módulo do handler não existia.
//
// Oráculo: `tests/fixtures/expected/class-actions/divine-primal.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { druidaHandler } from '../../../../site/js/domain/rulesets/dnd2024/handlers/druida.js';
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

const CLASS_ID = 'dnd2024:class:druida';
const TERRA = 'dnd2024:subclass:circulo-da-terra';
const ESTRELAS = 'dnd2024:subclass:circulo-das-estrelas';
const MAR = 'dnd2024:subclass:circulo-do-mar';
const FORMA = 'dnd2024:resource:forma-selvagem';

describe('handler class-druida — paridade com divine-primal.json', () => {
  const projections = projectionCasesFor('class-druida');
  const transitions = transitionCasesFor('class-druida');

  test('o fixture cobre projeções e transições do Druida', () => {
    assert.ok(projections.length >= 3, 'esperado >= 3 casos de projeção no fixture');
    assert.ok(transitions.length >= 10, 'esperado >= 10 casos de transição no fixture');
  });

  for (const testCase of projections) {
    test(`projeção: ${testCase.id}`, () => assertProjectionCase(druidaHandler, testCase));
  }
  for (const testCase of transitions) {
    test(`transição: ${testCase.id}`, () => assertTransitionCase(druidaHandler, testCase));
  }
});

describe('handler class-druida — Forma Selvagem por nível (tetos do conteúdo)', () => {
  for (const [level, max] of [[2, 2], [5, 2], [6, 3], [16, 3], [17, 4], [20, 4]]) {
    test(`nível ${level}: teto declarado = ${max}`, () => {
      const character = makeMartialCharacter({ classId: CLASS_ID, level });
      const result = druidaHandler.project(character, makeContext());
      assert.equal(result.ok, true);
      assert.equal(result.value.resources[FORMA].max, max);
    });
  }

  test('nível 1: o recurso não é concedido', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 1 });
    const result = druidaHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    assert.equal(Object.hasOwn(result.value.resources, FORMA), false);
  });
});

describe('handler class-druida — Arquidruida (nv20, recarga parcial condicionada)', () => {
  const source = classSource(CLASS_ID);

  test('recupera exatamente 1 uso, nunca o máximo', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 20,
      resources: { [FORMA]: { current: 0, sourceInstanceId: source } },
    });
    const result = druidaHandler.execute(
      character,
      { actionId: 'arquidruida-recuperar-forma-selvagem' },
      makeContext(),
    );
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[FORMA].current, 1, 'o teto é 4; a recarga é de 1');
  });

  test('com uso restante, RECUSA — e não escreve nada', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 20,
      resources: { [FORMA]: { current: 3, sourceInstanceId: source } },
    });
    const result = druidaHandler.execute(
      character,
      { actionId: 'arquidruida-recuperar-forma-selvagem' },
      makeContext(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_NOT_EXHAUSTED');
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
  });

  test('com o recurso AUSENTE, falha explicitamente em vez de inventar valor', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 20 });
    const result = druidaHandler.execute(
      character,
      { actionId: 'arquidruida-recuperar-forma-selvagem' },
      makeContext(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_NOT_INITIALIZED');
    assert.equal(Object.hasOwn(result.character.state.resources, FORMA), false);
  });

  test('entrada de outra proveniência não é sobrescrita', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: TERRA,
      level: 20,
      resources: { [FORMA]: { current: 0, sourceInstanceId: subclassSource(TERRA) } },
    });
    const result = druidaHandler.execute(
      character,
      { actionId: 'arquidruida-recuperar-forma-selvagem' },
      makeContext(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_FOREIGN_PROVENANCE');
  });

  test('antes do nível 20 a ação é recusada por nível', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 19,
      resources: { [FORMA]: { current: 0, sourceInstanceId: source } },
    });
    const result = druidaHandler.execute(
      character,
      { actionId: 'arquidruida-recuperar-forma-selvagem' },
      makeContext(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_ACTION_LEVEL_TOO_LOW');
  });
});

describe('handler class-druida — subclasses', () => {
  test('Círculo do Mar não tem recurso nem flag (ausência declarada, não esquecida)', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, subclassId: MAR, level: 14 });
    const result = druidaHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    // As únicas flags projetadas são as da CLASSE; nenhuma de subclasse.
    assert.deepEqual(Object.keys(result.value.flags).sort(), [
      `${classSource(CLASS_ID)}:companheiro-selvagem-ativo`,
      `${classSource(CLASS_ID)}:forma-selvagem-ativa`,
    ]);
  });

  test('ação do Círculo da Terra é recusada noutro círculo', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, subclassId: ESTRELAS, level: 6 });
    const result = druidaHandler.execute(character, { actionId: 'terra-recuperacao-natural-magia' }, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_ACTION_SUBCLASS_REQUIRED');
  });

  test('as duas metades da Recuperação Natural são independentes', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, subclassId: TERRA, level: 6 });
    const magia = druidaHandler.execute(character, { actionId: 'terra-recuperacao-natural-magia' }, makeContext());
    assert.equal(magia.ok, true);
    const slots = druidaHandler.execute(
      magia.character,
      { actionId: 'terra-recuperacao-natural-slots' },
      makeContext(),
    );
    assert.equal(slots.ok, true, 'gastar a metade "magia" não pode travar a metade "slots"');
    assert.equal(slots.character.state.usageFlags[subclassFlag(TERRA, 'recuperacao-natural-magia-usada')], true);
    assert.equal(slots.character.state.usageFlags[subclassFlag(TERRA, 'recuperacao-natural-slots-usada')], true);
  });

  test('a Forma Estelar não é destravada por descanso nenhum (escolha persistente do baseline)', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: ESTRELAS,
      level: 6,
      usageFlags: { [subclassFlag(ESTRELAS, 'forma-estrelada-ativa')]: true },
    });
    for (const kind of ['short', 'long']) {
      const result = druidaHandler.onRest(character, { kind }, makeContext());
      assert.equal(result.ok, true, kind);
      assert.equal(
        result.character.state.usageFlags[subclassFlag(ESTRELAS, 'forma-estrelada-ativa')],
        true,
        `descanso ${kind} não deve limpar a constelação ativa`,
      );
    }
  });
});

describe('handler class-druida — conjuração NÃO passa pelo handler', () => {
  test('os recursos de conjuração ficam fora da projeção do handler', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 9 });
    const result = druidaHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    assert.deepEqual(Object.keys(result.value.resources), [FORMA]);
  });
});

describe('handler class-druida — isolamento de proveniência', () => {
  test('a fatia de outra proveniência sobrevive por REFERÊNCIA ao descanso longo', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 6,
      resources: { [FORMA]: { current: 0, sourceInstanceId: classSource(CLASS_ID) } },
      usageFlags: { [`${classSource(CLASS_ID)}:forma-selvagem-ativa`]: true },
    });
    const before = character.state.resources[FOREIGN_TALENT_RESOURCE_ID];
    const result = druidaHandler.onRest(character, { kind: 'long' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[FOREIGN_TALENT_RESOURCE_ID], before);
    assert.equal(result.character.state.usageFlags[FOREIGN_USAGE_FLAG_KEY], true);
  });
});

describe('handler class-druida — personagem vindo da MIGRAÇÃO REAL v1 -> v2', () => {
  const estagio = migrationStageBefore('migracao-escolhas-classe-legadas');

  test('a migração real não materializa Forma Selvagem', () => {
    const { character } = migrateLegacyClassCharacter('classe-druida', {
      ...estagio,
      nivel: 6,
      recursos: { druida: { forma_selvagem_usos_gastos: 2, forma_selvagem_ativa: true } },
    });
    assert.deepEqual(character.state.resources, {});
    assert.deepEqual(character.extensions.legacyPassthrough.recursos, {
      druida: { forma_selvagem_usos_gastos: 2, forma_selvagem_ativa: true },
    });
  });

  test('project reporta ausente e execute/onRest não criam a entrada', () => {
    const { character } = migrateLegacyClassCharacter('classe-druida', { ...estagio, nivel: 6 });
    const projected = druidaHandler.project(character, makeContext());
    assert.equal(projected.ok, true);
    assert.equal(projected.value.resources[FORMA].current, null);
    assert.equal(projected.value.resources[FORMA].missing, true);

    const executed = druidaHandler.execute(character, { actionId: 'ativar-forma-selvagem' }, makeContext());
    assert.equal(executed.ok, false);
    assert.equal(executed.error.code, 'HANDLER_RESOURCE_NOT_INITIALIZED');
    assert.equal(
      Object.keys(executed.character.state.usageFlags).length,
      0,
      'a falha de recurso não pode escrever a flag de forma ativa',
    );

    for (const kind of ['short', 'long']) {
      const rested = druidaHandler.onRest(character, { kind }, makeContext());
      assert.equal(rested.ok, true, kind);
      assert.equal(Object.hasOwn(rested.character.state.resources, FORMA), false, kind);
    }
  });
});
