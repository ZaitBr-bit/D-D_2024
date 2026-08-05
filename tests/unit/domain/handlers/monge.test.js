// Testes do handler oficial do Monge (Task 20).
//
// RED esperado antes desta tarefa: o módulo do handler não existia.
//
// Oráculo: `tests/fixtures/expected/class-actions/martial.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { mongeHandler } from '../../../../site/js/domain/rulesets/dnd2024/handlers/monge.js';
import {
  assertProjectionCase,
  assertTransitionCase,
  classFlag,
  classSource,
  makeContext,
  migrateLegacyClassCharacter,
  migrationStageBefore,
  makeMartialCharacter,
  projectionCasesFor,
  subclassFlag,
  transitionCasesFor,
  FOREIGN_TALENT_RESOURCE_ID,
} from '../../../helpers/martial-fixtures.js';

const CLASS_ID = 'dnd2024:class:monge';
const ELEMENTOS = 'dnd2024:subclass:combatente-dos-elementos';
const FOCO = 'dnd2024:resource:pontos-de-foco';

describe('handler class-monge — paridade com martial.json', () => {
  const projections = projectionCasesFor('class-monge');
  const transitions = transitionCasesFor('class-monge');

  test('o fixture cobre projeções e transições do Monge', () => {
    assert.ok(projections.length >= 2, 'esperado >= 2 casos de projeção no fixture');
    assert.ok(transitions.length >= 4, 'esperado >= 4 casos de transição no fixture');
  });

  for (const testCase of projections) {
    test(`projeção: ${testCase.id}`, () => assertProjectionCase(mongeHandler, testCase));
  }
  for (const testCase of transitions) {
    test(`transição: ${testCase.id}`, () => assertTransitionCase(mongeHandler, testCase));
  }
});

describe('handler class-monge — o teto de Pontos de Foco vem do conteúdo, nível a nível', () => {
  for (const level of [2, 5, 11, 20]) {
    test(`nível ${level} projeta max ${level}`, () => {
      const character = makeMartialCharacter({
        classId: CLASS_ID,
        level,
        resources: { [FOCO]: { current: 0, sourceInstanceId: classSource(CLASS_ID) } },
      });
      const result = mongeHandler.project(character, makeContext());
      assert.equal(result.ok, true);
      assert.equal(result.value.resources[FOCO].max, level);
    });
  }

  test('nível 1 não tem Pontos de Foco', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 1 });
    const result = mongeHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    assert.equal(Object.hasOwn(result.value.resources, FOCO), false);
  });
});

describe('handler class-monge — Metabolismo Incomum', () => {
  test('restaura todos os pontos e marca a flag; a segunda vez é recusada', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 11,
      resources: { [FOCO]: { current: 1, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const primeiro = mongeHandler.execute(character, { actionId: 'metabolismo-incomum' }, makeContext());
    assert.equal(primeiro.ok, true);
    assert.equal(primeiro.character.state.resources[FOCO].current, 11);
    assert.equal(primeiro.character.state.usageFlags[classFlag(CLASS_ID, 'metabolismo-incomum-usado')], true);

    const segundo = mongeHandler.execute(primeiro.character, { actionId: 'metabolismo-incomum' }, makeContext());
    assert.equal(segundo.ok, false);
    assert.equal(segundo.error.code, 'HANDLER_ACTION_FLAG_STATE_INVALID');
  });

  test('com o recurso ausente, o Metabolismo FALHA e não queima o uso único', () => {
    // Estado comum de todo personagem migrado (a migração v1->v2 não
    // materializa recurso de classe). Se a ação devolvesse `ok` e marcasse a
    // flag, o uso de descanso longo seria consumido sem restaurar nada —
    // assimétrico com o caminho de gasto, que já falha aqui.
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 11 });
    const result = mongeHandler.execute(character, { actionId: 'metabolismo-incomum' }, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_NOT_INITIALIZED');
    assert.equal(result.character, character, 'a falha devolve o personagem original');
    assert.deepEqual(result.affected, []);
    assert.equal(Object.hasOwn(result.character.state.resources, FOCO), false);
    assert.equal(
      Object.hasOwn(result.character.state.usageFlags, classFlag(CLASS_ID, 'metabolismo-incomum-usado')),
      false,
      'nenhuma flag pode ser escrita quando a restauração falha',
    );
  });

  test('no nível 1 (recurso não concedido) o Metabolismo falha por nível, sem escrever flag', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 1 });
    const result = mongeHandler.execute(character, { actionId: 'metabolismo-incomum' }, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_ACTION_LEVEL_TOO_LOW');
    assert.deepEqual(result.character.state.usageFlags, character.state.usageFlags);
  });

  test('project marca o Metabolismo como indisponível quando o recurso não está materializado', () => {
    const semRecurso = makeMartialCharacter({ classId: CLASS_ID, level: 11 });
    const semResultado = mongeHandler.project(semRecurso, makeContext());
    assert.equal(semResultado.ok, true);
    const semAcao = semResultado.value.actions.find((a) => a.actionId === 'metabolismo-incomum');
    assert.deepEqual(semAcao, {
      actionId: 'metabolismo-incomum',
      // Correção I3 da revisão final: a ação projetada carrega o rótulo
      // pt-BR declarado no handler.
      label: 'Metabolismo Incomum',
      available: false,
      reason: 'HANDLER_RESOURCE_NOT_INITIALIZED',
    });

    const comRecurso = makeMartialCharacter({
      classId: CLASS_ID,
      level: 11,
      resources: { [FOCO]: { current: 0, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const comResultado = mongeHandler.project(comRecurso, makeContext());
    const comAcao = comResultado.value.actions.find((a) => a.actionId === 'metabolismo-incomum');
    assert.deepEqual(comAcao, { actionId: 'metabolismo-incomum', label: 'Metabolismo Incomum', available: true, reason: null });
  });

  test('o descanso longo devolve o Metabolismo Incomum', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 11,
      usageFlags: { [classFlag(CLASS_ID, 'metabolismo-incomum-usado')]: true },
    });
    const result = mongeHandler.onRest(character, { kind: 'long' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.usageFlags[classFlag(CLASS_ID, 'metabolismo-incomum-usado')], false);
  });

  test('o descanso CURTO não devolve o Metabolismo Incomum (sheet.js:4473-4492)', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 11,
      usageFlags: { [classFlag(CLASS_ID, 'metabolismo-incomum-usado')]: true },
    });
    const result = mongeHandler.onRest(character, { kind: 'short' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.usageFlags[classFlag(CLASS_ID, 'metabolismo-incomum-usado')], true);
  });
});

describe('handler class-monge — Pontos de Foco e isolamento', () => {
  test('golpe-atordoante gasta exatamente 1 ponto e preserva a fatia alheia', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 9,
      resources: { [FOCO]: { current: 3, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const before = character.state.resources[FOREIGN_TALENT_RESOURCE_ID];
    const result = mongeHandler.execute(character, { actionId: 'golpe-atordoante' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[FOCO].current, 2);
    assert.equal(result.character.state.resources[FOREIGN_TALENT_RESOURCE_ID], before);
  });

  test('golpe-atordoante ignora payload.amount (custo fixo de 1)', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 9,
      resources: { [FOCO]: { current: 5, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const result = mongeHandler.execute(
      character,
      { actionId: 'golpe-atordoante', payload: { amount: 4 } },
      makeContext(),
    );
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[FOCO].current, 4);
  });

  test('"current" não inteiro é recusado em vez de "consertado"', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 9,
      resources: { [FOCO]: { current: 2.5, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const executed = mongeHandler.execute(character, { actionId: 'golpe-atordoante' }, makeContext());
    assert.equal(executed.ok, false);
    assert.equal(executed.error.code, 'HANDLER_RESOURCE_STATE_INVALID');

    const rested = mongeHandler.onRest(character, { kind: 'short' }, makeContext());
    assert.equal(rested.ok, false);
    assert.equal(rested.error.code, 'HANDLER_RESOURCE_STATE_INVALID');
  });

  test('Combatente dos Elementos: a Sintonia cai nos dois descansos', () => {
    for (const kind of ['short', 'long']) {
      const character = makeMartialCharacter({
        classId: CLASS_ID,
        subclassId: ELEMENTOS,
        level: 9,
        usageFlags: { [subclassFlag(ELEMENTOS, 'sintonia-ativa')]: true },
      });
      const result = mongeHandler.onRest(character, { kind }, makeContext());
      assert.equal(result.ok, true);
      assert.equal(result.character.state.usageFlags[subclassFlag(ELEMENTOS, 'sintonia-ativa')], false, kind);
    }
  });
});


describe('handler class-monge — personagem vindo da MIGRAÇÃO REAL v1 -> v2', () => {
  // `legacy-migration-stages.json` + `legacy-all-classes.json`: o registro v1
  // passa por `migrateV1ToV2` de verdade, não por uma fixture "limpa" escrita
  // à mão. A migração NÃO materializa recursos de classe (só os de talento no
  // formato `{usado: boolean}`), então `state.resources` sai vazio mesmo para
  // um personagem que gastou usos — é exatamente o caso de recurso ausente.
  const estagio = migrationStageBefore('migracao-talento-versatil-humano');

  test('a migração real não materializa o recurso de classe', () => {
    const { character } = migrateLegacyClassCharacter('classe-monge', {
      ...estagio,
      nivel: 9,
      
      recursos: { monge: { pontos_foco_gastos: 4, metabolismo_usado: true } },
    });
    assert.deepEqual(character.state.resources, {});
    // O dado legado continua preservado verbatim, sem palpite de conversão.
    assert.deepEqual(character.extensions.legacyPassthrough.recursos, { monge: { pontos_foco_gastos: 4, metabolismo_usado: true } });
  });

  test('project devolve {current: null, missing: true} — nunca um valor plausível', () => {
    const { character } = migrateLegacyClassCharacter('classe-monge', {
      ...estagio,
      nivel: 9,
      
      recursos: { monge: { pontos_foco_gastos: 4, metabolismo_usado: true } },
    });
    const result = mongeHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    const projected = result.value.resources['dnd2024:resource:pontos-de-foco'];
    assert.equal(projected.current, null);
    assert.equal(projected.missing, true);
    assert.equal(projected.max, 9);
  });

  test('nem execute nem onRest criam a entrada ausente', () => {
    const { character } = migrateLegacyClassCharacter('classe-monge', {
      ...estagio,
      nivel: 9,
      
      recursos: { monge: { pontos_foco_gastos: 4, metabolismo_usado: true } },
    });
    const executed = mongeHandler.execute(character, { actionId: 'golpe-atordoante' }, makeContext());
    assert.equal(executed.ok, false);
    assert.equal(executed.error.code, 'HANDLER_RESOURCE_NOT_INITIALIZED');
    assert.equal(Object.hasOwn(executed.character.state.resources, 'dnd2024:resource:pontos-de-foco'), false);

    for (const kind of ['short', 'long']) {
      const rested = mongeHandler.onRest(character, { kind }, makeContext());
      assert.equal(rested.ok, true, kind);
      assert.equal(Object.hasOwn(rested.character.state.resources, 'dnd2024:resource:pontos-de-foco'), false, kind);
    }
  });
});
