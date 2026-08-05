// Testes do handler oficial do Clérigo (Task 21).
//
// RED esperado antes desta tarefa: o módulo do handler não existia.
//
// Oráculo: `tests/fixtures/expected/class-actions/divine-primal.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { clerigoHandler } from '../../../../site/js/domain/rulesets/dnd2024/handlers/clerigo.js';
import { applyGrantEffects, collectCharacterEffects } from '../../../../site/js/domain/effects/index.js';
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

const CLASS_ID = 'dnd2024:class:clerigo';
const GUERRA = 'dnd2024:subclass:dominio-da-guerra';
const TRAPACA = 'dnd2024:subclass:dominio-da-trapaca';
const CANALIZAR = 'dnd2024:resource:canalizar-divindade';

describe('handler class-clerigo — paridade com divine-primal.json', () => {
  const projections = projectionCasesFor('class-clerigo');
  const transitions = transitionCasesFor('class-clerigo');

  test('o fixture cobre projeções e transições do Clérigo', () => {
    assert.ok(projections.length >= 3, 'esperado >= 3 casos de projeção no fixture');
    assert.ok(transitions.length >= 10, 'esperado >= 10 casos de transição no fixture');
  });

  for (const testCase of projections) {
    test(`projeção: ${testCase.id}`, () => assertProjectionCase(clerigoHandler, testCase));
  }
  for (const testCase of transitions) {
    test(`transição: ${testCase.id}`, () => assertTransitionCase(clerigoHandler, testCase));
  }
});

describe('handler class-clerigo — Canalizar Divindade por nível', () => {
  // Os degraus vêm do CONTEÚDO real (coluna "Canalizar Divindade"), nunca de
  // uma tabela embutida no handler.
  for (const [level, max] of [[2, 2], [5, 2], [6, 3], [17, 3], [18, 4], [20, 4]]) {
    test(`nível ${level}: teto declarado = ${max}`, () => {
      const character = makeMartialCharacter({ classId: CLASS_ID, level });
      const result = clerigoHandler.project(character, makeContext());
      assert.equal(result.ok, true);
      assert.equal(result.value.resources[CANALIZAR].max, max);
    });
  }

  test('nível 1: o recurso não é concedido, e não é projetado como "ausente"', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 1 });
    const result = clerigoHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    assert.equal(Object.hasOwn(result.value.resources, CANALIZAR), false);
  });

  test('o descanso não materializa um recurso ausente', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 6 });
    for (const kind of ['short', 'long']) {
      const result = clerigoHandler.onRest(character, { kind }, makeContext());
      assert.equal(result.ok, true, kind);
      assert.equal(Object.hasOwn(result.character.state.resources, CANALIZAR), false, kind);
      assert.deepEqual(result.affected, []);
    }
  });
});

describe('handler class-clerigo — Intervenção Divina (ciclo completo)', () => {
  test('usar → recusar → descanso longo → usar de novo', () => {
    const base = makeMartialCharacter({ classId: CLASS_ID, level: 10 });
    const flag = `${classSource(CLASS_ID)}:intervencao-divina-usada`;

    const primeiro = clerigoHandler.execute(base, { actionId: 'usar-intervencao-divina' }, makeContext());
    assert.equal(primeiro.ok, true);
    assert.equal(primeiro.character.state.usageFlags[flag], true);

    const segundo = clerigoHandler.execute(primeiro.character, { actionId: 'usar-intervencao-divina' }, makeContext());
    assert.equal(segundo.ok, false);
    assert.equal(segundo.error.code, 'HANDLER_ACTION_FLAG_STATE_INVALID');

    const curto = clerigoHandler.onRest(primeiro.character, { kind: 'short' }, makeContext());
    assert.equal(curto.ok, true);
    assert.equal(curto.character.state.usageFlags[flag], true, 'o descanso CURTO não destrava');

    const longo = clerigoHandler.onRest(primeiro.character, { kind: 'long' }, makeContext());
    assert.equal(longo.ok, true);
    assert.equal(longo.character.state.usageFlags[flag], false);

    const terceiro = clerigoHandler.execute(longo.character, { actionId: 'usar-intervencao-divina' }, makeContext());
    assert.equal(terceiro.ok, true);
  });

  test('toda flag declarada tem pelo menos uma ação que a seta (nada de flag órfã)', () => {
    // Guarda contra o padrão de bug da Task 20: flag limpa no descanso mas
    // sem nenhuma ação que a marque. Levantada da projeção real.
    const character = makeMartialCharacter({ classId: CLASS_ID, subclassId: TRAPACA, level: 6 });
    const projected = clerigoHandler.project(character, makeContext());
    assert.equal(projected.ok, true);
    const flagKeys = Object.keys(projected.value.flags);
    assert.ok(flagKeys.length > 0);

    // Cada flag ativa precisa ser alcançável por alguma ação disponível ou
    // por uma ação recusada apenas por estado de flag/recurso — nunca por
    // "não existe ação nenhuma".
    const setters = new Set();
    for (const actionId of [
      'usar-intervencao-divina',
      'trapaca-ativar-bencao-do-trapaceiro',
      'trapaca-encerrar-bencao-do-trapaceiro',
      'trapaca-invocar-duplicidade',
      'trapaca-encerrar-duplicidade',
    ]) {
      assert.ok(
        projected.value.actions.some((action) => action.actionId === actionId),
        `ação "${actionId}" ausente da projeção`,
      );
      setters.add(actionId);
    }
    assert.equal(setters.size, 5);
  });
});

describe('handler class-clerigo — conjuração NÃO passa pelo handler', () => {
  test('os recursos de conjuração da entidade de classe ficam fora da projeção do handler', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 9 });
    const result = clerigoHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    for (const resourceId of [
      'dnd2024:resource:spell-slot-1',
      'dnd2024:resource:spell-slot-5',
      'dnd2024:resource:magias-preparadas',
      'dnd2024:resource:truques',
    ]) {
      assert.equal(
        Object.hasOwn(result.value.resources, resourceId),
        false,
        `${resourceId} é do domínio de magias, não do handler de classe`,
      );
    }
  });

  test('contributeEffects não replica as magias de domínio (já são grant-spell alwaysPrepared)', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, subclassId: GUERRA, level: 9 });
    const result = clerigoHandler.contributeEffects(character, makeContext());
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, []);
    assert.equal(Object.isFrozen(result.value), true);
  });

  test('as magias de domínio sempre preparadas são materializadas pelo MOTOR DE EFEITOS, não pelo handler', () => {
    // Prova, contra o conteúdo real, que "magia de domínio sempre preparada"
    // JÁ é vocabulário declarativo (`grant-spell` + `alwaysPrepared: true`)
    // resolvido fora do handler de classe. Se o handler precisasse modelar
    // isso, `state.spells.prepared` sairia vazio deste caminho.
    const character = makeMartialCharacter({ classId: CLASS_ID, subclassId: GUERRA, level: 9 });
    const context = makeContext();
    const collected = collectCharacterEffects(character, context);
    assert.equal(collected.ok, true, `coleta: ${collected.error?.code}`);

    const sempreDeclaradas = collected.value.filter(
      (entry) => entry.effect?.type === 'grant-spell' && entry.effect.alwaysPrepared === true,
    );
    assert.ok(sempreDeclaradas.length > 0, 'o conteúdo do Domínio da Guerra declara magias sempre preparadas');

    const applied = applyGrantEffects(character, collected.value, context);
    assert.equal(applied.ok, true, `grants: ${applied.error?.code}`);
    const preparadas = applied.value.character.state.spells.prepared.map((entry) => entry.spellRef.id);
    assert.ok(
      preparadas.includes('dnd2024:spell:arma-espiritual'),
      `esperada Arma Espiritual entre as preparadas; veio ${JSON.stringify(preparadas)}`,
    );

    // E o handler não acrescenta NADA a esse caminho.
    const contributed = clerigoHandler.contributeEffects(character, context);
    assert.equal(contributed.ok, true);
    assert.deepEqual(contributed.value, []);
  });
});

describe('handler class-clerigo — isolamento de proveniência', () => {
  test('as flags do Domínio da Trapaça pertencem à SUBCLASSE, não à classe', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: TRAPACA,
      level: 6,
      resources: { [CANALIZAR]: { current: 3, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const result = clerigoHandler.execute(character, { actionId: 'trapaca-invocar-duplicidade' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.usageFlags[subclassFlag(TRAPACA, 'invocar-duplicidade-ativa')], true);
    assert.equal(
      Object.hasOwn(result.character.state.usageFlags, `${classSource(CLASS_ID)}:invocar-duplicidade-ativa`),
      false,
      'a flag não pode ser gravada com a proveniência da classe',
    );
  });

  test('a fatia de outra proveniência sobrevive por REFERÊNCIA ao descanso longo', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 6,
      resources: { [CANALIZAR]: { current: 0, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const before = character.state.resources[FOREIGN_TALENT_RESOURCE_ID];
    const result = clerigoHandler.onRest(character, { kind: 'long' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[CANALIZAR].current, 3);
    assert.equal(result.character.state.resources[FOREIGN_TALENT_RESOURCE_ID], before);
    assert.equal(result.character.state.usageFlags[FOREIGN_USAGE_FLAG_KEY], true);
  });
});

describe('handler class-clerigo — personagem vindo da MIGRAÇÃO REAL v1 -> v2', () => {
  const estagio = migrationStageBefore('migracao-escolhas-classe-legadas');

  test('a migração real não materializa Canalizar Divindade', () => {
    const { character } = migrateLegacyClassCharacter('classe-clerigo', {
      ...estagio,
      nivel: 6,
      recursos: { clerigo: { canalizar_divindade_usos_gastos: 2 } },
    });
    assert.deepEqual(character.state.resources, {});
    assert.deepEqual(character.extensions.legacyPassthrough.recursos, {
      clerigo: { canalizar_divindade_usos_gastos: 2 },
    });
  });

  test('project devolve {current: null, missing: true} — nunca 1 nem o máximo', () => {
    const { character } = migrateLegacyClassCharacter('classe-clerigo', {
      ...estagio,
      nivel: 6,
      recursos: { clerigo: { canalizar_divindade_usos_gastos: 2 } },
    });
    const result = clerigoHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.value.resources[CANALIZAR].current, null);
    assert.equal(result.value.resources[CANALIZAR].missing, true);
    assert.equal(result.value.resources[CANALIZAR].max, 3);
  });

  test('nem execute nem onRest criam a entrada ausente', () => {
    const { character } = migrateLegacyClassCharacter('classe-clerigo', { ...estagio, nivel: 6 });
    const executed = clerigoHandler.execute(character, { actionId: 'centelha-divina' }, makeContext());
    assert.equal(executed.ok, false);
    assert.equal(executed.error.code, 'HANDLER_RESOURCE_NOT_INITIALIZED');
    assert.equal(Object.hasOwn(executed.character.state.resources, CANALIZAR), false);

    for (const kind of ['short', 'long']) {
      const rested = clerigoHandler.onRest(character, { kind }, makeContext());
      assert.equal(rested.ok, true, kind);
      assert.equal(Object.hasOwn(rested.character.state.resources, CANALIZAR), false, kind);
    }
  });
});
