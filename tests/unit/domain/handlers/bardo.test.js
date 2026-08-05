// Testes do handler oficial do Bardo (Task 22a).
//
// RED esperado antes desta tarefa: o módulo do handler não existia e, mesmo se
// existisse, o teto de Inspiração (`carismaModifierMin1`) não era resolvível —
// `resolveNumericValue` devolvia `EFFECT_VALUE_NOT_NUMERIC` porque nada em
// produção populava `context.variables`.
//
// Oráculo: `tests/fixtures/expected/class-actions/arcane.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { bardoHandler } from '../../../../site/js/domain/rulesets/dnd2024/handlers/bardo.js';
import {
  assertProjectionCase,
  assertTransitionCase,
  classSource,
  makeContext,
  makeContextFor,
  makeMartialCharacter,
  migrateLegacyClassCharacter,
  migrationStageBefore,
  projectionCasesFor,
  subclassFlag,
  transitionCasesFor,
  FOREIGN_TALENT_RESOURCE_ID,
  FOREIGN_USAGE_FLAG_KEY,
} from '../../../helpers/martial-fixtures.js';

const CLASS_ID = 'dnd2024:class:bardo';
const GLAMOUR = 'dnd2024:subclass:colegio-do-glamour';
const INSPIRACAO = 'dnd2024:resource:inspiracao-de-bardo';

describe('handler class-bardo — paridade com arcane.json', () => {
  const projections = projectionCasesFor('class-bardo');
  const transitions = transitionCasesFor('class-bardo');

  test('o fixture cobre projeções e transições do Bardo', () => {
    assert.ok(projections.length >= 5, 'esperado >= 5 casos de projeção no fixture');
    assert.ok(transitions.length >= 10, 'esperado >= 10 casos de transição no fixture');
  });

  for (const testCase of projections) {
    test(`projeção: ${testCase.id}`, () => assertProjectionCase(bardoHandler, testCase));
  }
  for (const testCase of transitions) {
    test(`transição: ${testCase.id}`, () => assertTransitionCase(bardoHandler, testCase));
  }
});

describe('handler class-bardo — o teto de Inspiração vem do modificador REAL de Carisma', () => {
  // O valor esperado é `max(1, floor((carisma - 10) / 2))` calculado sobre a
  // pontuação de verdade do personagem, resolvido pela consulta pura da Task 16
  // e entregue ao motor de efeitos por `context.variables`. Nenhum número está
  // codificado no handler.
  for (const [carisma, esperado] of [[6, 1], [10, 1], [12, 1], [14, 2], [17, 3], [18, 4], [20, 5]]) {
    test(`Carisma ${carisma} => ${esperado} uso(s)`, () => {
      const character = makeMartialCharacter({ classId: CLASS_ID, level: 5, abilities: { carisma } });
      const result = bardoHandler.project(character, makeContextFor(character));
      assert.equal(result.ok, true, `project falhou (${result.error?.code})`);
      assert.equal(result.value.resources[INSPIRACAO].max, esperado);
    });
  }

  test('sem `context.variables`, o teto NÃO é chutado: o handler falha explicitamente', () => {
    // Guarda contra o padrão de bug "default de jogo inventado". Um contexto
    // sem variáveis é uma dependência ausente, e a resposta correta é erro.
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 5, abilities: { carisma: 18 } });
    const result = bardoHandler.project(character, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_MAX_UNRESOLVED');
  });

  test('o DADO de Inspiração (D6..D12) não é tratado como reserva gastável', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 10, abilities: { carisma: 18 } });
    const result = bardoHandler.project(character, makeContextFor(character));
    assert.equal(result.ok, true);
    assert.equal(
      Object.hasOwn(result.value.resources, 'dnd2024:resource:dados-de-inspiracao'),
      false,
      '`dados-de-inspiracao` é o tamanho do dado, não uma reserva de usos',
    );
  });
});

describe('handler class-bardo — Inspiração Superior exige o recurso zerado (divergência deliberada)', () => {
  // `site/js/pages/sheet.js:6035-6043` (commit e43c5ea) completa a reserva até
  // 2 mesmo com 1 uso restante; o PHB 2024 só concede a recarga com a reserva
  // ZERADA. Esta é a divergência registrada no comentário de topo de
  // `bardo.js` e no campo `divergencia` do caso
  // `bardo-inspiracao-superior-com-um-uso-restante` do fixture.
  const base = { classId: CLASS_ID, level: 18, abilities: { carisma: 18 } };

  test('com a reserva zerada, o resultado é IDÊNTICO ao do baseline (min(teto, 2))', () => {
    const character = makeMartialCharacter({
      ...base,
      resources: { [INSPIRACAO]: { current: 0, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const result = bardoHandler.execute(character, { actionId: 'inspiracao-superior-iniciativa' }, makeContextFor(character));
    assert.equal(result.ok, true, result.error?.code);
    assert.equal(result.character.state.resources[INSPIRACAO].current, 2);
  });

  test('com teto 1 (Carisma baixo), a recarga respeita o teto declarado', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 18,
      abilities: { carisma: 8 },
      resources: { [INSPIRACAO]: { current: 0, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const result = bardoHandler.execute(character, { actionId: 'inspiracao-superior-iniciativa' }, makeContextFor(character));
    assert.equal(result.ok, true, result.error?.code);
    assert.equal(result.character.state.resources[INSPIRACAO].current, 1);
  });

  test('com 1 uso restante, o handler RECUSA (o baseline completaria até 2)', () => {
    const character = makeMartialCharacter({
      ...base,
      resources: { [INSPIRACAO]: { current: 1, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const result = bardoHandler.execute(character, { actionId: 'inspiracao-superior-iniciativa' }, makeContextFor(character));
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_NOT_EXHAUSTED');
    assert.equal(result.character, character, 'a recusa não muda nada');
  });
});

describe('handler class-bardo — as cinco ações de subclasse que consomem Inspiração', () => {
  const ACOES = Object.freeze([
    { actionId: 'danca-gingado-coordenado', subclassId: 'dnd2024:subclass:colegio-da-danca', level: 6 },
    { actionId: 'danca-movimento-inspirador', subclassId: 'dnd2024:subclass:colegio-da-danca', level: 6 },
    { actionId: 'conhecimento-palavras-de-interrupcao', subclassId: 'dnd2024:subclass:colegio-do-conhecimento', level: 3 },
    { actionId: 'conhecimento-pericia-inigualavel', subclassId: 'dnd2024:subclass:colegio-do-conhecimento', level: 14 },
    { actionId: 'glamour-manto-de-inspiracao', subclassId: GLAMOUR, level: 3 },
  ]);

  for (const acao of ACOES) {
    test(`${acao.actionId} gasta exatamente 1 uso`, () => {
      const character = makeMartialCharacter({
        classId: CLASS_ID,
        subclassId: acao.subclassId,
        level: acao.level,
        abilities: { carisma: 18 },
        resources: { [INSPIRACAO]: { current: 4, sourceInstanceId: classSource(CLASS_ID) } },
      });
      const result = bardoHandler.execute(character, { actionId: acao.actionId }, makeContextFor(character));
      assert.equal(result.ok, true, result.error?.code);
      assert.equal(result.character.state.resources[INSPIRACAO].current, 3);
    });

    test(`${acao.actionId} recusa sem usos, sem gravar nada`, () => {
      const character = makeMartialCharacter({
        classId: CLASS_ID,
        subclassId: acao.subclassId,
        level: acao.level,
        abilities: { carisma: 18 },
        resources: { [INSPIRACAO]: { current: 0, sourceInstanceId: classSource(CLASS_ID) } },
      });
      const result = bardoHandler.execute(character, { actionId: acao.actionId }, makeContextFor(character));
      assert.equal(result.ok, false);
      assert.equal(result.error.code, 'HANDLER_RESOURCE_INSUFFICIENT');
      assert.equal(result.character, character);
    });
  }
});

describe('handler class-bardo — isolamento de proveniência', () => {
  test('a Inspiração de OUTRA instância não é lida nem escrita', () => {
    // Mesma chave de recurso, `sourceInstanceId` de outra fonte: o handler
    // precisa recusar em vez de gastar o recurso alheio.
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 5,
      abilities: { carisma: 18 },
      resources: { [INSPIRACAO]: { current: 4, sourceInstanceId: 'source:class:0000:dnd2024-class-clerigo' } },
    });
    const result = bardoHandler.execute(character, { actionId: 'usar-inspiracao' }, makeContextFor(character));
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_FOREIGN_PROVENANCE');
    assert.equal(result.character.state.resources[INSPIRACAO].current, 4, 'o recurso alheio ficou intacto');

    const projected = bardoHandler.project(character, makeContextFor(character));
    assert.equal(projected.ok, true);
    assert.equal(projected.value.resources[INSPIRACAO].current, null);
    assert.equal(projected.value.resources[INSPIRACAO].foreign, true);
  });

  test('as flags do Glamour pertencem à SUBCLASSE, não à classe', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: GLAMOUR,
      level: 6,
      abilities: { carisma: 16 },
    });
    const result = bardoHandler.execute(character, { actionId: 'glamour-manto-de-majestade' }, makeContextFor(character));
    assert.equal(result.ok, true, result.error?.code);
    assert.equal(result.character.state.usageFlags[subclassFlag(GLAMOUR, 'manto-de-majestade-usado')], true);
    assert.equal(
      Object.hasOwn(result.character.state.usageFlags, `${classSource(CLASS_ID)}:manto-de-majestade-usado`),
      false,
    );
  });

  test('a fatia de outra proveniência sobrevive por REFERÊNCIA ao descanso longo', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 5,
      abilities: { carisma: 18 },
      resources: { [INSPIRACAO]: { current: 0, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const before = character.state.resources[FOREIGN_TALENT_RESOURCE_ID];
    const result = bardoHandler.onRest(character, { kind: 'long' }, makeContextFor(character));
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[INSPIRACAO].current, 4);
    assert.equal(result.character.state.resources[FOREIGN_TALENT_RESOURCE_ID], before);
    assert.equal(result.character.state.usageFlags[FOREIGN_USAGE_FLAG_KEY], true);
  });
});

describe('handler class-bardo — conjuração NÃO passa pelo handler', () => {
  test('os recursos de conjuração da entidade de classe ficam fora da projeção', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 9, abilities: { carisma: 18 } });
    const result = bardoHandler.project(character, makeContextFor(character));
    assert.equal(result.ok, true);
    for (const resourceId of [
      'dnd2024:resource:spell-slot-1',
      'dnd2024:resource:spell-slot-5',
      'dnd2024:resource:magias-preparadas',
      'dnd2024:resource:truques',
    ]) {
      assert.equal(Object.hasOwn(result.value.resources, resourceId), false, resourceId);
    }
  });

  test('contributeEffects é vazio e congelado', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 9, abilities: { carisma: 18 } });
    const result = bardoHandler.contributeEffects(character, makeContextFor(character));
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, []);
    assert.equal(Object.isFrozen(result.value), true);
  });
});

describe('handler class-bardo — personagem vindo da MIGRAÇÃO REAL v1 -> v2', () => {
  const estagio = migrationStageBefore('migracao-escolhas-classe-legadas');

  test('a migração real não materializa a Inspiração de Bardo', () => {
    const { character } = migrateLegacyClassCharacter('classe-bardo', {
      ...estagio,
      nivel: 5,
      recursos: { inspiracao_bardo_usos_gastos: 2 },
    });
    assert.deepEqual(character.state.resources, {});
  });

  test('project devolve {current: null, missing: true} — nunca o máximo', () => {
    const { character } = migrateLegacyClassCharacter('classe-bardo', {
      ...estagio,
      nivel: 5,
      recursos: { inspiracao_bardo_usos_gastos: 2 },
    });
    const result = bardoHandler.project(character, makeContextFor(character));
    assert.equal(result.ok, true, result.error?.code);
    assert.equal(result.value.resources[INSPIRACAO].current, null);
    assert.equal(result.value.resources[INSPIRACAO].missing, true);
  });

  test('nem execute nem onRest criam a entrada ausente', () => {
    const { character } = migrateLegacyClassCharacter('classe-bardo', { ...estagio, nivel: 5 });
    const executed = bardoHandler.execute(character, { actionId: 'usar-inspiracao' }, makeContextFor(character));
    assert.equal(executed.ok, false);
    assert.equal(executed.error.code, 'HANDLER_RESOURCE_NOT_INITIALIZED');

    for (const kind of ['short', 'long']) {
      const rested = bardoHandler.onRest(character, { kind }, makeContextFor(character));
      assert.equal(rested.ok, true, kind);
      assert.equal(Object.hasOwn(rested.character.state.resources, INSPIRACAO), false, kind);
    }
  });
});
