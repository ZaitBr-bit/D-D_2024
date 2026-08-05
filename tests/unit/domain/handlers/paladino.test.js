// Testes do handler oficial do Paladino (Task 21).
//
// RED esperado antes desta tarefa: o módulo do handler não existia.
//
// Oráculo: `tests/fixtures/expected/class-actions/divine-primal.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { paladinoHandler } from '../../../../site/js/domain/rulesets/dnd2024/handlers/paladino.js';
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

const CLASS_ID = 'dnd2024:class:paladino';
const DEVOCAO = 'dnd2024:subclass:juramento-da-devocao';
const GLORIA = 'dnd2024:subclass:juramento-da-gloria';
const VINGANCA = 'dnd2024:subclass:juramento-da-vinganca';
const ANCIOES = 'dnd2024:subclass:juramento-dos-ancioes';
const MAOS = 'dnd2024:resource:maos-consagradas';
const CANALIZAR = 'dnd2024:resource:canalizar-divindade';

describe('handler class-paladino — paridade com divine-primal.json', () => {
  const projections = projectionCasesFor('class-paladino');
  const transitions = transitionCasesFor('class-paladino');

  test('o fixture cobre projeções e transições do Paladino', () => {
    assert.ok(projections.length >= 3, 'esperado >= 3 casos de projeção no fixture');
    assert.ok(transitions.length >= 10, 'esperado >= 10 casos de transição no fixture');
  });

  for (const testCase of projections) {
    test(`projeção: ${testCase.id}`, () => assertProjectionCase(paladinoHandler, testCase));
  }
  for (const testCase of transitions) {
    test(`transição: ${testCase.id}`, () => assertTransitionCase(paladinoHandler, testCase));
  }
});

describe('handler class-paladino — Mãos Consagradas = 5 × nível, vindo do CONTEÚDO', () => {
  // O baseline calcula `5 * nivel` em código (sheet.js:1984); esta tarefa
  // trouxe a escada para o conteúdo. O teste percorre os 20 níveis para que
  // um degrau errado no gerador não passe despercebido.
  for (let level = 1; level <= 20; level += 1) {
    test(`nível ${level}: teto declarado = ${5 * level}`, () => {
      const character = makeMartialCharacter({ classId: CLASS_ID, level });
      const result = paladinoHandler.project(character, makeContext());
      assert.equal(result.ok, true);
      assert.equal(result.value.resources[MAOS].max, 5 * level);
    });
  }

  test('Canalizar Divindade só existe a partir do nível 3', () => {
    for (const [level, max] of [[1, null], [2, null], [3, 2], [10, 2], [11, 3], [20, 3]]) {
      const character = makeMartialCharacter({ classId: CLASS_ID, level });
      const result = paladinoHandler.project(character, makeContext());
      assert.equal(result.ok, true);
      if (max === null) {
        assert.equal(Object.hasOwn(result.value.resources, CANALIZAR), false, `nível ${level}`);
      } else {
        assert.equal(result.value.resources[CANALIZAR].max, max, `nível ${level}`);
      }
    }
  });
});

describe('handler class-paladino — os dois recursos são independentes', () => {
  const source = classSource(CLASS_ID);

  test('gastar Mãos Consagradas não toca Canalizar Divindade', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 11,
      resources: {
        [MAOS]: { current: 30, sourceInstanceId: source },
        [CANALIZAR]: { current: 2, sourceInstanceId: source },
      },
    });
    const result = paladinoHandler.execute(
      character,
      { actionId: 'usar-maos-consagradas', payload: { amount: 12 } },
      makeContext(),
    );
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[MAOS].current, 18);
    assert.equal(result.character.state.resources[CANALIZAR], character.state.resources[CANALIZAR]);
  });

  test('o descanso curto devolve 1 Canalizar e NÃO restaura Mãos Consagradas', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 11,
      resources: {
        [MAOS]: { current: 1, sourceInstanceId: source },
        [CANALIZAR]: { current: 0, sourceInstanceId: source },
      },
    });
    const result = paladinoHandler.onRest(character, { kind: 'short' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[MAOS].current, 1);
    assert.equal(result.character.state.resources[CANALIZAR].current, 1);
  });

  test('o descanso longo restaura os dois aos tetos declarados', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 11,
      resources: {
        [MAOS]: { current: 1, sourceInstanceId: source },
        [CANALIZAR]: { current: 0, sourceInstanceId: source },
      },
    });
    const result = paladinoHandler.onRest(character, { kind: 'long' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[MAOS].current, 55);
    assert.equal(result.character.state.resources[CANALIZAR].current, 3);
  });
});

describe('handler class-paladino — auras e Juramentos', () => {
  test('cada juramento só executa as próprias ações', () => {
    const casos = [
      { subclassId: GLORIA, proprio: 'gloria-atleta-inigualavel', alheio: 'vinganca-voto-de-inimizade' },
      { subclassId: VINGANCA, proprio: 'vinganca-voto-de-inimizade', alheio: 'ancioes-ira-da-natureza' },
      { subclassId: ANCIOES, proprio: 'ancioes-ira-da-natureza', alheio: 'devocao-arma-sagrada' },
      { subclassId: DEVOCAO, proprio: 'devocao-arma-sagrada', alheio: 'gloria-atleta-inigualavel' },
    ];
    for (const caso of casos) {
      const character = makeMartialCharacter({
        classId: CLASS_ID,
        subclassId: caso.subclassId,
        level: 11,
        resources: { [CANALIZAR]: { current: 3, sourceInstanceId: classSource(CLASS_ID) } },
      });
      const proprio = paladinoHandler.execute(character, { actionId: caso.proprio }, makeContext());
      assert.equal(proprio.ok, true, `${caso.subclassId}: ${caso.proprio} — ${proprio.error?.code}`);
      assert.equal(proprio.character.state.resources[CANALIZAR].current, 2);

      const alheio = paladinoHandler.execute(character, { actionId: caso.alheio }, makeContext());
      assert.equal(alheio.ok, false, `${caso.subclassId}: ${caso.alheio} deveria ser recusada`);
      assert.equal(alheio.error.code, 'HANDLER_ACTION_SUBCLASS_REQUIRED');
    }
  });

  test('as habilidades 1×/descanso longo dos quatro juramentos voltam no descanso longo', () => {
    // DIVERGÊNCIA DELIBERADA do baseline (concern C1 do relatório): em
    // `sheet.js:4826/4831/4840` a comparação é com "Juramento DE ...", nome
    // que nunca existe, e as flags de Glória, Vingança e Devoção jamais são
    // limpas. Aqui as quatro voltam.
    const casos = [
      { subclassId: GLORIA, flag: 'lenda-viva-usada', actionId: 'gloria-lenda-viva', level: 20 },
      { subclassId: VINGANCA, flag: 'anjo-vingador-usado', actionId: 'vinganca-anjo-vingador', level: 20 },
      { subclassId: ANCIOES, flag: 'sentinela-imortal-usada', actionId: 'ancioes-sentinela-imortal', level: 15 },
      { subclassId: ANCIOES, flag: 'campeao-ancestral-usado', actionId: 'ancioes-campeao-ancestral', level: 20 },
      {
        subclassId: DEVOCAO,
        flag: 'resplendor-sagrado-usado',
        actionId: 'devocao-ativar-resplendor-sagrado',
        level: 20,
      },
    ];
    for (const caso of casos) {
      const base = makeMartialCharacter({ classId: CLASS_ID, subclassId: caso.subclassId, level: caso.level });
      const key = subclassFlag(caso.subclassId, caso.flag);

      const usado = paladinoHandler.execute(base, { actionId: caso.actionId }, makeContext());
      assert.equal(usado.ok, true, `${caso.actionId}: ${usado.error?.code}`);
      assert.equal(usado.character.state.usageFlags[key], true);

      const repetido = paladinoHandler.execute(usado.character, { actionId: caso.actionId }, makeContext());
      assert.equal(repetido.ok, false, `${caso.actionId} deveria recusar a repetição`);
      assert.equal(repetido.error.code, 'HANDLER_ACTION_FLAG_STATE_INVALID');

      const longo = paladinoHandler.onRest(usado.character, { kind: 'long' }, makeContext());
      assert.equal(longo.ok, true);
      assert.equal(longo.character.state.usageFlags[key], false, `${caso.flag} deveria voltar no descanso longo`);
    }
  });

  test('Arma Sagrada expira no descanso curto, mas o USO do Resplendor não', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: DEVOCAO,
      level: 20,
      usageFlags: {
        [subclassFlag(DEVOCAO, 'arma-sagrada-ativa')]: true,
        [subclassFlag(DEVOCAO, 'resplendor-sagrado-usado')]: true,
        [subclassFlag(DEVOCAO, 'resplendor-sagrado-ativo')]: true,
      },
    });
    const result = paladinoHandler.onRest(character, { kind: 'short' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.usageFlags[subclassFlag(DEVOCAO, 'arma-sagrada-ativa')], false);
    assert.equal(result.character.state.usageFlags[subclassFlag(DEVOCAO, 'resplendor-sagrado-ativo')], false);
    assert.equal(
      result.character.state.usageFlags[subclassFlag(DEVOCAO, 'resplendor-sagrado-usado')],
      true,
      'sheet.js:4470-4473 só apaga os efeitos temporários no curto',
    );
  });

  test('o descanso curto de outro juramento não toca as flags da Devoção', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: GLORIA,
      level: 20,
      usageFlags: { [subclassFlag(DEVOCAO, 'arma-sagrada-ativa')]: true },
    });
    const result = paladinoHandler.onRest(character, { kind: 'short' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.usageFlags[subclassFlag(DEVOCAO, 'arma-sagrada-ativa')], true);
  });
});

describe('handler class-paladino — conjuração NÃO passa pelo handler', () => {
  test('os recursos de conjuração ficam fora da projeção do handler', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 17 });
    const result = paladinoHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    assert.deepEqual(Object.keys(result.value.resources).sort(), [CANALIZAR, MAOS].sort());
  });
});

describe('handler class-paladino — isolamento de proveniência', () => {
  test('a fatia de outra proveniência sobrevive por REFERÊNCIA ao descanso longo', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 11,
      resources: {
        [MAOS]: { current: 0, sourceInstanceId: classSource(CLASS_ID) },
        [CANALIZAR]: { current: 0, sourceInstanceId: classSource(CLASS_ID) },
      },
    });
    const before = character.state.resources[FOREIGN_TALENT_RESOURCE_ID];
    const result = paladinoHandler.onRest(character, { kind: 'long' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[FOREIGN_TALENT_RESOURCE_ID], before);
    assert.equal(result.character.state.usageFlags[FOREIGN_USAGE_FLAG_KEY], true);
  });

  test('entrada de Mãos Consagradas de outra proveniência não é sobrescrita', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: DEVOCAO,
      level: 11,
      resources: { [MAOS]: { current: 30, sourceInstanceId: subclassSource(DEVOCAO) } },
    });
    const result = paladinoHandler.execute(
      character,
      { actionId: 'usar-maos-consagradas', payload: { amount: 5 } },
      makeContext(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_FOREIGN_PROVENANCE');
  });
});

describe('handler class-paladino — personagem vindo da MIGRAÇÃO REAL v1 -> v2', () => {
  const estagio = migrationStageBefore('migracao-escolhas-classe-legadas');

  test('a migração real não materializa nenhum dos dois recursos', () => {
    const { character } = migrateLegacyClassCharacter('classe-paladino', {
      ...estagio,
      nivel: 11,
      recursos: { paladino: { maos_consagradas_gastos: 20, canalizar_divindade_usos_gastos: 1 } },
    });
    assert.deepEqual(character.state.resources, {});
    assert.deepEqual(character.extensions.legacyPassthrough.recursos, {
      paladino: { maos_consagradas_gastos: 20, canalizar_divindade_usos_gastos: 1 },
    });
  });

  test('project reporta os dois como ausentes, nunca 55/3 nem 0', () => {
    const { character } = migrateLegacyClassCharacter('classe-paladino', { ...estagio, nivel: 11 });
    const result = paladinoHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    assert.deepEqual(
      { current: result.value.resources[MAOS].current, missing: result.value.resources[MAOS].missing },
      { current: null, missing: true },
    );
    assert.deepEqual(
      { current: result.value.resources[CANALIZAR].current, missing: result.value.resources[CANALIZAR].missing },
      { current: null, missing: true },
    );
  });

  test('nem execute nem onRest criam as entradas ausentes', () => {
    const { character } = migrateLegacyClassCharacter('classe-paladino', { ...estagio, nivel: 11 });
    const executed = paladinoHandler.execute(character, { actionId: 'remover-envenenado' }, makeContext());
    assert.equal(executed.ok, false);
    assert.equal(executed.error.code, 'HANDLER_RESOURCE_NOT_INITIALIZED');

    for (const kind of ['short', 'long']) {
      const rested = paladinoHandler.onRest(character, { kind }, makeContext());
      assert.equal(rested.ok, true, kind);
      assert.equal(Object.hasOwn(rested.character.state.resources, MAOS), false, kind);
      assert.equal(Object.hasOwn(rested.character.state.resources, CANALIZAR), false, kind);
    }
  });
});
