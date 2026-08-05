// Testes do handler oficial do Guerreiro (Task 20).
//
// RED esperado antes desta tarefa: o módulo do handler não existia.
//
// Oráculo: `tests/fixtures/expected/class-actions/martial.json`, escrito a
// partir de `site/js/pages/sheet.js` (e43c5ea).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { guerreiroHandler } from '../../../../site/js/domain/rulesets/dnd2024/handlers/guerreiro.js';
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
} from '../../../helpers/martial-fixtures.js';

const CLASS_ID = 'dnd2024:class:guerreiro';
const MESTRE = 'dnd2024:subclass:mestre-da-batalha';
const PSIQUICO = 'dnd2024:subclass:combatente-psiquico';
const FOLEGO = 'dnd2024:resource:recuperar-folego';
const SUPERIORIDADE = 'dnd2024:resource:dados-de-superioridade';
const PSIONICOS = 'dnd2024:resource:dados-psionicos';

describe('handler class-guerreiro — paridade com martial.json', () => {
  const projections = projectionCasesFor('class-guerreiro');
  const transitions = transitionCasesFor('class-guerreiro');

  test('o fixture cobre projeções e transições do Guerreiro', () => {
    assert.ok(projections.length >= 4, 'esperado >= 4 casos de projeção no fixture');
    assert.ok(transitions.length >= 4, 'esperado >= 4 casos de transição no fixture');
  });

  for (const testCase of projections) {
    test(`projeção: ${testCase.id}`, () => assertProjectionCase(guerreiroHandler, testCase));
  }
  for (const testCase of transitions) {
    test(`transição: ${testCase.id}`, () => assertTransitionCase(guerreiroHandler, testCase));
  }
});

describe('handler class-guerreiro — recursos de subclasse têm proveniência de SUBCLASSE', () => {
  test('os Dados de Superioridade pertencem a "source:subclass:...", não à classe', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: MESTRE,
      level: 7,
      resources: { [SUPERIORIDADE]: { current: 5, sourceInstanceId: subclassSource(MESTRE) } },
    });
    const result = guerreiroHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.value.resources[SUPERIORIDADE].sourceInstanceId, subclassSource(MESTRE));
    assert.notEqual(result.value.resources[SUPERIORIDADE].sourceInstanceId, classSource(CLASS_ID));
  });

  test('uma entrada de Dados de Superioridade marcada como da CLASSE é recusada', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: MESTRE,
      level: 7,
      resources: { [SUPERIORIDADE]: { current: 5, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const result = guerreiroHandler.execute(character, { actionId: 'usar-dado-de-superioridade' }, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_FOREIGN_PROVENANCE');
  });

  test('sem a subclasse escolhida, o recurso da subclasse não é concedido', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 7 });
    const result = guerreiroHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    assert.equal(Object.hasOwn(result.value.resources, SUPERIORIDADE), false);
    assert.equal(Object.hasOwn(result.value.resources, PSIONICOS), false);
  });

  test('trocar de subclasse não deixa o handler enxergar o recurso da outra', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: PSIQUICO,
      level: 7,
      resources: { [SUPERIORIDADE]: { current: 5, sourceInstanceId: subclassSource(MESTRE) } },
    });
    const before = character.state.resources[SUPERIORIDADE];
    const result = guerreiroHandler.onRest(character, { kind: 'long' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[SUPERIORIDADE], before);
  });
});

describe('handler class-guerreiro — validações de execução', () => {
  test('gastar-dado-psionico aceita payload.amount e recusa amount inválido', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: PSIQUICO,
      level: 9,
      resources: { [PSIONICOS]: { current: 8, sourceInstanceId: subclassSource(PSIQUICO) } },
    });
    const ok = guerreiroHandler.execute(
      character,
      { actionId: 'gastar-dado-psionico', payload: { amount: 3 } },
      makeContext(),
    );
    assert.equal(ok.ok, true);
    assert.equal(ok.character.state.resources[PSIONICOS].current, 5);

    for (const amount of [0, -1, 1.5, 13]) {
      const bad = guerreiroHandler.execute(
        character,
        { actionId: 'gastar-dado-psionico', payload: { amount } },
        makeContext(),
      );
      assert.equal(bad.ok, false, `amount ${amount} deveria ser recusado`);
      assert.equal(bad.error.code, 'HANDLER_PAYLOAD_INVALID');
    }
  });

  test('gastar mais dados do que existem é recusado', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: PSIQUICO,
      level: 9,
      resources: { [PSIONICOS]: { current: 2, sourceInstanceId: subclassSource(PSIQUICO) } },
    });
    const result = guerreiroHandler.execute(
      character,
      { actionId: 'gastar-dado-psionico', payload: { amount: 3 } },
      makeContext(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_INSUFFICIENT');
  });

  test('usar-surto-de-acao antes do nível 2 é recusado por nível', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 1 });
    const result = guerreiroHandler.execute(character, { actionId: 'usar-surto-de-acao' }, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_ACTION_LEVEL_TOO_LOW');
  });

  test('usar-indomavel no nível 9 sem entrada materializada não inventa o recurso', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 9 });
    const result = guerreiroHandler.execute(character, { actionId: 'usar-indomavel' }, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_NOT_INITIALIZED');
    assert.equal(Object.hasOwn(result.character.state.resources, 'dnd2024:resource:indomavel'), false);
  });
});

describe('handler class-guerreiro — descanso', () => {
  test('descanso curto preserva a fatia de talento por referência', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: MESTRE,
      level: 7,
      resources: {
        [FOLEGO]: { current: 0, sourceInstanceId: classSource(CLASS_ID) },
        [SUPERIORIDADE]: { current: 0, sourceInstanceId: subclassSource(MESTRE) },
      },
    });
    const before = character.state.resources[FOREIGN_TALENT_RESOURCE_ID];
    const result = guerreiroHandler.onRest(character, { kind: 'short' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[FOREIGN_TALENT_RESOURCE_ID], before);
    assert.equal(result.character.state.resources[FOLEGO].current, 1);
    assert.equal(result.character.state.resources[SUPERIORIDADE].current, 5);
  });

  test('descanso longo limpa "conheca-seu-inimigo-usado" mas não cria a flag quando ausente', () => {
    const comFlag = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: MESTRE,
      level: 7,
      usageFlags: { [subclassFlag(MESTRE, 'conheca-seu-inimigo-usado')]: true },
    });
    const comResultado = guerreiroHandler.onRest(comFlag, { kind: 'long' }, makeContext());
    assert.equal(comResultado.character.state.usageFlags[subclassFlag(MESTRE, 'conheca-seu-inimigo-usado')], false);

    const semFlag = makeMartialCharacter({ classId: CLASS_ID, subclassId: MESTRE, level: 7 });
    const semResultado = guerreiroHandler.onRest(semFlag, { kind: 'long' }, makeContext());
    assert.equal(
      Object.hasOwn(semResultado.character.state.usageFlags, subclassFlag(MESTRE, 'conheca-seu-inimigo-usado')),
      false,
    );
  });

  test('handler de outra classe não participa do descanso e devolve o personagem intacto', () => {
    const character = makeMartialCharacter({ classId: 'dnd2024:class:monge', level: 5 });
    const result = guerreiroHandler.onRest(character, { kind: 'long' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
  });
});


describe('handler class-guerreiro — personagem vindo da MIGRAÇÃO REAL v1 -> v2', () => {
  // `legacy-migration-stages.json` + `legacy-all-classes.json`: o registro v1
  // passa por `migrateV1ToV2` de verdade, não por uma fixture "limpa" escrita
  // à mão. A migração NÃO materializa recursos de classe (só os de talento no
  // formato `{usado: boolean}`), então `state.resources` sai vazio mesmo para
  // um personagem que gastou usos — é exatamente o caso de recurso ausente.
  const estagio = migrationStageBefore('migracao-escolhas-classe-legadas');

  test('a migração real não materializa o recurso de classe', () => {
    const { character } = migrateLegacyClassCharacter('classe-guerreiro', {
      ...estagio,
      nivel: 10,
      
      recursos: { guerreiro: { recuperar_folego_usos_gastos: 2, surto_acao_usos_gastos: 1 } },
    });
    assert.deepEqual(character.state.resources, {});
    // O dado legado continua preservado verbatim, sem palpite de conversão.
    assert.deepEqual(character.extensions.legacyPassthrough.recursos, { guerreiro: { recuperar_folego_usos_gastos: 2, surto_acao_usos_gastos: 1 } });
  });

  test('project devolve {current: null, missing: true} — nunca um valor plausível', () => {
    const { character } = migrateLegacyClassCharacter('classe-guerreiro', {
      ...estagio,
      nivel: 10,
      
      recursos: { guerreiro: { recuperar_folego_usos_gastos: 2, surto_acao_usos_gastos: 1 } },
    });
    const result = guerreiroHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    const projected = result.value.resources['dnd2024:resource:recuperar-folego'];
    assert.equal(projected.current, null);
    assert.equal(projected.missing, true);
    assert.equal(projected.max, 4);
  });

  test('nem execute nem onRest criam a entrada ausente', () => {
    const { character } = migrateLegacyClassCharacter('classe-guerreiro', {
      ...estagio,
      nivel: 10,
      
      recursos: { guerreiro: { recuperar_folego_usos_gastos: 2, surto_acao_usos_gastos: 1 } },
    });
    const executed = guerreiroHandler.execute(character, { actionId: 'usar-recuperar-folego' }, makeContext());
    assert.equal(executed.ok, false);
    assert.equal(executed.error.code, 'HANDLER_RESOURCE_NOT_INITIALIZED');
    assert.equal(Object.hasOwn(executed.character.state.resources, 'dnd2024:resource:recuperar-folego'), false);

    for (const kind of ['short', 'long']) {
      const rested = guerreiroHandler.onRest(character, { kind }, makeContext());
      assert.equal(rested.ok, true, kind);
      assert.equal(Object.hasOwn(rested.character.state.resources, 'dnd2024:resource:recuperar-folego'), false, kind);
    }
  });
});
