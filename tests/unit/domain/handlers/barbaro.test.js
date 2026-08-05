// Testes do handler oficial do Bárbaro (Task 20).
//
// RED esperado antes desta tarefa:
// `site/js/domain/rulesets/dnd2024/handlers/barbaro.js` não existia — todo
// import abaixo falhava.
//
// O oráculo dos valores é `tests/fixtures/expected/class-actions/martial.json`,
// escrito a partir de `site/js/pages/sheet.js` no commit e43c5ea (cada caso
// cita a linha), NÃO capturado desta implementação.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { barbaroHandler } from '../../../../site/js/domain/rulesets/dnd2024/handlers/barbaro.js';
import {
  assertProjectionCase,
  assertTransitionCase,
  characterForCase,
  classFlag,
  classSource,
  makeContext,
  migrateLegacyClassCharacter,
  migrationStageBefore,
  makeMartialCharacter,
  projectionCasesFor,
  transitionCasesFor,
  FOREIGN_TALENT_RESOURCE_ID,
} from '../../../helpers/martial-fixtures.js';

const CLASS_ID = 'dnd2024:class:barbaro';
const FURIAS = 'dnd2024:resource:furias';

describe('handler class-barbaro — paridade com martial.json', () => {
  const projections = projectionCasesFor('class-barbaro');
  const transitions = transitionCasesFor('class-barbaro');

  test('o fixture cobre projeções e transições do Bárbaro', () => {
    assert.ok(projections.length >= 2, 'esperado >= 2 casos de projeção no fixture');
    assert.ok(transitions.length >= 9, 'esperado >= 9 casos de transição no fixture');
  });

  for (const testCase of projections) {
    test(`projeção: ${testCase.id}`, () => assertProjectionCase(barbaroHandler, testCase));
  }
  for (const testCase of transitions) {
    test(`transição: ${testCase.id}`, () => assertTransitionCase(barbaroHandler, testCase));
  }
});

describe('handler class-barbaro — validações de execução', () => {
  test('recusa personagem de outra classe', () => {
    const character = makeMartialCharacter({ classId: 'dnd2024:class:monge', level: 5 });
    const result = barbaroHandler.execute(character, { actionId: 'entrar-em-furia' }, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_CLASS_MISMATCH');
    assert.deepEqual(result.affected, []);
  });

  test('recusa ação desconhecida', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 5 });
    const result = barbaroHandler.execute(character, { actionId: 'virar-dragao' }, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_ACTION_UNKNOWN');
  });

  test('recusa payload que não é objeto', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 5 });
    const result = barbaroHandler.execute(character, { actionId: 'entrar-em-furia', payload: 3 }, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_PAYLOAD_INVALID');
  });

  test('recusa ação de subclasse quando a subclasse não é a exigida', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: 'dnd2024:subclass:trilha-do-berserker',
      level: 14,
    });
    const result = barbaroHandler.execute(character, { actionId: 'presenca-zelosa' }, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_ACTION_SUBCLASS_REQUIRED');
  });

  test('recusa ação de subclasse abaixo do nível mínimo', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: 'dnd2024:subclass:trilha-do-fanatico',
      level: 9,
    });
    const result = barbaroHandler.execute(character, { actionId: 'presenca-zelosa' }, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_ACTION_LEVEL_TOO_LOW');
  });

  test('sem context.registry o handler falha em vez de assumir "sem recursos"', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 5,
      resources: { [FURIAS]: { current: 2, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const projected = barbaroHandler.project(character, {});
    assert.equal(projected.ok, false);
    assert.equal(projected.error.code, 'HANDLER_REGISTRY_REQUIRED');

    const executed = barbaroHandler.execute(character, { actionId: 'entrar-em-furia' }, {});
    assert.equal(executed.ok, false);
    assert.equal(executed.error.code, 'HANDLER_REGISTRY_REQUIRED');
  });
});

describe('handler class-barbaro — isolamento de proveniência', () => {
  test('não sobrescreve uma entrada de "furias" que pertence a outra fonte', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 5,
      resources: { [FURIAS]: { current: 3, sourceInstanceId: 'source:feat:0000:algum-talento' } },
    });
    const result = barbaroHandler.execute(character, { actionId: 'entrar-em-furia' }, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_FOREIGN_PROVENANCE');
    assert.equal(result.character.state.resources[FURIAS].current, 3);
  });

  test('entrada sem sourceInstanceId NÃO é adotada como própria', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 5, resources: { [FURIAS]: { current: 3 } } });
    const result = barbaroHandler.onRest(character, { kind: 'long' }, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_FOREIGN_PROVENANCE');
  });

  test('o descanso longo preserva o recurso de talento por referência', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 5,
      resources: { [FURIAS]: { current: 0, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const before = character.state.resources[FOREIGN_TALENT_RESOURCE_ID];
    const result = barbaroHandler.onRest(character, { kind: 'long' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[FOREIGN_TALENT_RESOURCE_ID], before);
    assert.equal(result.character.state.resources[FURIAS].current, 3);
  });
});

describe('handler class-barbaro — project/contributeEffects não criam estado', () => {
  test('project não materializa a entrada ausente de "furias"', () => {
    const testCase = projectionCasesFor('class-barbaro').find((entry) => entry.id === 'barbaro-nv5-recurso-ausente');
    const character = characterForCase(testCase);
    const result = barbaroHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.resources[FURIAS], {
      current: null,
      missing: true,
      max: 3,
      sourceInstanceId: classSource(CLASS_ID),
      // Correção I3 da revisão final: recurso projetado carrega o rótulo
      // pt-BR declarado no handler (fonte: monólito congelado).
      label: 'Fúrias',
    });
    assert.equal(Object.hasOwn(character.state.resources, FURIAS), false);
  });

  test('contributeEffects devolve lista vazia congelada e não toca em state', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 5 });
    const snapshot = JSON.stringify(character);
    const result = barbaroHandler.contributeEffects(character, makeContext());
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, []);
    assert.equal(Object.isFrozen(result.value), true);
    assert.equal(JSON.stringify(character), snapshot);
  });
});

describe('handler class-barbaro — flags de Fúria', () => {
  test('não é possível entrar em Fúria já enfurecido', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 5,
      resources: { [FURIAS]: { current: 3, sourceInstanceId: classSource(CLASS_ID) } },
      usageFlags: { [classFlag(CLASS_ID, 'furia-ativa')]: true },
    });
    const result = barbaroHandler.execute(character, { actionId: 'entrar-em-furia' }, makeContext());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_ACTION_FLAG_STATE_INVALID');
  });

  test('encerrar a Fúria não devolve o uso gasto', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 5,
      resources: { [FURIAS]: { current: 2, sourceInstanceId: classSource(CLASS_ID) } },
      usageFlags: { [classFlag(CLASS_ID, 'furia-ativa')]: true },
    });
    const result = barbaroHandler.execute(character, { actionId: 'encerrar-furia' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[FURIAS].current, 2);
    assert.equal(result.character.state.usageFlags[classFlag(CLASS_ID, 'furia-ativa')], false);
    assert.deepEqual(result.affected, ['state.usageFlags']);
  });

  test('o descanso longo não CRIA flags que o personagem nunca teve', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 5,
      resources: { [FURIAS]: { current: 0, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const result = barbaroHandler.onRest(character, { kind: 'long' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(Object.hasOwn(result.character.state.usageFlags, classFlag(CLASS_ID, 'furia-ativa')), false);
    assert.deepEqual(result.affected, ['state.resources']);
  });
});

describe('handler class-barbaro — Fúria Persistente (nv15, sheet.js:7299-7312)', () => {
  const NIVEL_15 = 15;

  test('usar, esgotar de novo e descansar longo devolve o uso da Fúria Persistente', () => {
    const inicial = makeMartialCharacter({
      classId: CLASS_ID,
      level: NIVEL_15,
      resources: { [FURIAS]: { current: 0, sourceInstanceId: classSource(CLASS_ID) } },
    });

    const usada = barbaroHandler.execute(inicial, { actionId: 'restaurar-furias-persistente' }, makeContext());
    assert.equal(usada.ok, true);
    assert.equal(usada.character.state.resources[FURIAS].current, 5, 'nv15 concede 5 Fúrias');
    assert.equal(usada.character.state.usageFlags[classFlag(CLASS_ID, 'furia-persistente-usada')], true);

    const segunda = barbaroHandler.execute(usada.character, { actionId: 'restaurar-furias-persistente' }, makeContext());
    assert.equal(segunda.ok, false);
    assert.equal(segunda.error.code, 'HANDLER_ACTION_FLAG_STATE_INVALID');

    const descansado = barbaroHandler.onRest(usada.character, { kind: 'long' }, makeContext());
    assert.equal(descansado.ok, true);
    assert.equal(descansado.character.state.usageFlags[classFlag(CLASS_ID, 'furia-persistente-usada')], false);

    const terceira = barbaroHandler.execute(
      { ...descansado.character, state: { ...descansado.character.state, resources: { ...descansado.character.state.resources, [FURIAS]: { current: 2, sourceInstanceId: classSource(CLASS_ID) } } } },
      { actionId: 'restaurar-furias-persistente' },
      makeContext(),
    );
    assert.equal(terceira.ok, true, 'depois do descanso longo a ação volta a estar disponível');
    assert.equal(terceira.character.state.resources[FURIAS].current, 5);
  });

  test('o descanso CURTO não devolve a Fúria Persistente (sheet.js:4355-4359)', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: NIVEL_15,
      resources: { [FURIAS]: { current: 5, sourceInstanceId: classSource(CLASS_ID) } },
      usageFlags: { [classFlag(CLASS_ID, 'furia-persistente-usada')]: true },
    });
    const result = barbaroHandler.onRest(character, { kind: 'short' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.usageFlags[classFlag(CLASS_ID, 'furia-persistente-usada')], true);
  });

  test('a fatia de outra proveniência sobrevive por referência à Fúria Persistente', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: NIVEL_15,
      resources: { [FURIAS]: { current: 0, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const before = character.state.resources[FOREIGN_TALENT_RESOURCE_ID];
    const result = barbaroHandler.execute(character, { actionId: 'restaurar-furias-persistente' }, makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[FOREIGN_TALENT_RESOURCE_ID], before);
  });
});

describe('handler class-barbaro — kind de descanso', () => {
  for (const kind of ['curto', 'longo', 'descanso-curto', 'SHORT', '', null]) {
    test(`recusa kind ${JSON.stringify(kind)} (só "short"/"long")`, () => {
      const character = makeMartialCharacter({ classId: CLASS_ID, level: 5 });
      const result = barbaroHandler.onRest(character, { kind }, makeContext());
      assert.equal(result.ok, false);
      assert.equal(result.error.code, 'HANDLER_REST_KIND_INVALID');
    });
  }
});


describe('handler class-barbaro — personagem vindo da MIGRAÇÃO REAL v1 -> v2', () => {
  // `legacy-migration-stages.json` + `legacy-all-classes.json`: o registro v1
  // passa por `migrateV1ToV2` de verdade, não por uma fixture "limpa" escrita
  // à mão. A migração NÃO materializa recursos de classe (só os de talento no
  // formato `{usado: boolean}`), então `state.resources` sai vazio mesmo para
  // um personagem que gastou usos — é exatamente o caso de recurso ausente.
  const estagio = migrationStageBefore('migracao-talento-versatil-humano');

  test('a migração real não materializa o recurso de classe', () => {
    const { character } = migrateLegacyClassCharacter('classe-barbaro', {
      ...estagio,
      nivel: 5,
      
      recursos: { furia_usos_gastos: 2, furia_ativa: true },
    });
    assert.deepEqual(character.state.resources, {});
    // O dado legado continua preservado verbatim, sem palpite de conversão.
    assert.deepEqual(character.extensions.legacyPassthrough.recursos, { furia_usos_gastos: 2, furia_ativa: true });
  });

  test('project devolve {current: null, missing: true} — nunca um valor plausível', () => {
    const { character } = migrateLegacyClassCharacter('classe-barbaro', {
      ...estagio,
      nivel: 5,
      
      recursos: { furia_usos_gastos: 2, furia_ativa: true },
    });
    const result = barbaroHandler.project(character, makeContext());
    assert.equal(result.ok, true);
    const projected = result.value.resources['dnd2024:resource:furias'];
    assert.equal(projected.current, null);
    assert.equal(projected.missing, true);
    assert.equal(projected.max, 3);
  });

  test('nem execute nem onRest criam a entrada ausente', () => {
    const { character } = migrateLegacyClassCharacter('classe-barbaro', {
      ...estagio,
      nivel: 5,
      
      recursos: { furia_usos_gastos: 2, furia_ativa: true },
    });
    const executed = barbaroHandler.execute(character, { actionId: 'entrar-em-furia' }, makeContext());
    assert.equal(executed.ok, false);
    assert.equal(executed.error.code, 'HANDLER_RESOURCE_NOT_INITIALIZED');
    assert.equal(Object.hasOwn(executed.character.state.resources, 'dnd2024:resource:furias'), false);

    for (const kind of ['short', 'long']) {
      const rested = barbaroHandler.onRest(character, { kind }, makeContext());
      assert.equal(rested.ok, true, kind);
      assert.equal(Object.hasOwn(rested.character.state.resources, 'dnd2024:resource:furias'), false, kind);
    }
  });
});
