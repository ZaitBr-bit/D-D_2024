// Testes do handler oficial do Feiticeiro (Task 22a).
//
// RED esperado antes desta tarefa: o módulo do handler não existia e a
// Restauração Feiticeira (`floor(nível / 2)` pontos) não tinha como expressar a
// quantidade recuperada sem `context.variables`.
//
// Oráculo: `tests/fixtures/expected/class-actions/arcane.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { feiticeiroHandler } from '../../../../site/js/domain/rulesets/dnd2024/handlers/feiticeiro.js';
import {
  assertProjectionCase,
  assertTransitionCase,
  classSource,
  makeContextFor,
  makeMartialCharacter,
  migrateLegacyClassCharacter,
  migrationStageBefore,
  projectionCasesFor,
  subclassFlag,
  subclassSource,
  transitionCasesFor,
  FOREIGN_TALENT_RESOURCE_ID,
} from '../../../helpers/martial-fixtures.js';

const CLASS_ID = 'dnd2024:class:feiticeiro';
const ABERRANTE = 'dnd2024:subclass:feiticaria-aberrante';
const DRACONICA = 'dnd2024:subclass:feiticaria-draconica';
const MECANICA = 'dnd2024:subclass:feiticaria-mecanica';
const SELVAGEM = 'dnd2024:subclass:feiticaria-selvagem';
const PONTOS = 'dnd2024:resource:pontos-de-feiticaria';
const INATA = 'dnd2024:resource:feiticaria-inata';
const EQUILIBRIO = 'dnd2024:resource:restaurar-equilibrio';

describe('handler class-feiticeiro — paridade com arcane.json', () => {
  const projections = projectionCasesFor('class-feiticeiro');
  const transitions = transitionCasesFor('class-feiticeiro');

  test('o fixture cobre projeções e transições do Feiticeiro', () => {
    assert.ok(projections.length >= 2, 'esperado >= 2 casos de projeção no fixture');
    assert.ok(transitions.length >= 8, 'esperado >= 8 casos de transição no fixture');
  });

  for (const testCase of projections) {
    test(`projeção: ${testCase.id}`, () => assertProjectionCase(feiticeiroHandler, testCase));
  }
  for (const testCase of transitions) {
    test(`transição: ${testCase.id}`, () => assertTransitionCase(feiticeiroHandler, testCase));
  }
});

describe('handler class-feiticeiro — Pontos de Feitiçaria por nível vêm do CONTEÚDO', () => {
  for (const [level, max] of [[2, 2], [5, 5], [10, 10], [20, 20]]) {
    test(`nível ${level}: teto declarado = ${max}`, () => {
      const character = makeMartialCharacter({ classId: CLASS_ID, level, abilities: { carisma: 18 } });
      const result = feiticeiroHandler.project(character, makeContextFor(character));
      assert.equal(result.ok, true, result.error?.code);
      assert.equal(result.value.resources[PONTOS].max, max);
    });
  }

  test('nível 1: a reserva não é concedida, e não é projetada como "ausente"', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 1, abilities: { carisma: 18 } });
    const result = feiticeiroHandler.project(character, makeContextFor(character));
    assert.equal(result.ok, true);
    assert.equal(Object.hasOwn(result.value.resources, PONTOS), false);
    assert.equal(result.value.resources[INATA].max, 2, 'Feitiçaria Inata já existe no nível 1');
  });
});

describe('handler class-feiticeiro — Restauração Feiticeira recupera floor(nível/2)', () => {
  // A quantidade é `context.variables.levelHalfDown`, derivada do nível REAL
  // do personagem — nunca um literal no handler.
  for (const [level, esperado] of [[5, 2], [10, 5], [19, 9], [20, 10]]) {
    test(`nível ${level}: recupera ${esperado} pontos`, () => {
      const character = makeMartialCharacter({
        classId: CLASS_ID,
        level,
        abilities: { carisma: 18 },
        resources: { [PONTOS]: { current: 0, sourceInstanceId: classSource(CLASS_ID) } },
      });
      const result = feiticeiroHandler.execute(character, { actionId: 'restauracao-feiticeira' }, makeContextFor(character));
      assert.equal(result.ok, true, result.error?.code);
      assert.equal(result.character.state.resources[PONTOS].current, esperado);
      assert.equal(
        result.character.state.usageFlags[`${classSource(CLASS_ID)}:restauracao-feiticeira-usada`],
        true,
      );
    });
  }

  test('a recuperação nunca ultrapassa o teto declarado', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 20,
      abilities: { carisma: 18 },
      resources: { [PONTOS]: { current: 15, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const result = feiticeiroHandler.execute(character, { actionId: 'restauracao-feiticeira' }, makeContextFor(character));
    assert.equal(result.ok, true, result.error?.code);
    assert.equal(result.character.state.resources[PONTOS].current, 20);
  });

  test('com a reserva cheia, o uso único NÃO é queimado', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 10,
      abilities: { carisma: 18 },
      resources: { [PONTOS]: { current: 10, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const result = feiticeiroHandler.execute(character, { actionId: 'restauracao-feiticeira' }, makeContextFor(character));
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_ALREADY_FULL');
    assert.equal(
      Object.hasOwn(result.character.state.usageFlags, `${classSource(CLASS_ID)}:restauracao-feiticeira-usada`),
      false,
      'a flag não pode ser marcada quando a recarga falhou',
    );
  });

  test('com a reserva NÃO materializada, o uso único também não é queimado', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 10, abilities: { carisma: 18 } });
    const result = feiticeiroHandler.execute(character, { actionId: 'restauracao-feiticeira' }, makeContextFor(character));
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_NOT_INITIALIZED');
    assert.equal(result.character, character);
  });

  test('só uma vez por descanso longo', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 10,
      abilities: { carisma: 18 },
      resources: { [PONTOS]: { current: 0, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const primeiro = feiticeiroHandler.execute(character, { actionId: 'restauracao-feiticeira' }, makeContextFor(character));
    assert.equal(primeiro.ok, true);
    const segundo = feiticeiroHandler.execute(
      primeiro.character,
      { actionId: 'restauracao-feiticeira' },
      makeContextFor(primeiro.character),
    );
    assert.equal(segundo.ok, false);
    assert.equal(segundo.error.code, 'HANDLER_ACTION_FLAG_STATE_INVALID');

    const longo = feiticeiroHandler.onRest(primeiro.character, { kind: 'long' }, makeContextFor(primeiro.character));
    assert.equal(longo.ok, true);
    const terceiro = feiticeiroHandler.execute(
      longo.character,
      { actionId: 'restauracao-feiticeira' },
      makeContextFor(longo.character),
    );
    // Depois do descanso longo a reserva volta ao teto, então a recarga é
    // recusada por "já cheia" — e não por flag: a flag foi de fato limpa.
    assert.equal(terceiro.ok, false);
    assert.equal(terceiro.error.code, 'HANDLER_RESOURCE_ALREADY_FULL');
  });
});

describe('handler class-feiticeiro — gasto de pontos com quantidade do payload', () => {
  test('gasta exatamente o que o payload pede', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 10,
      abilities: { carisma: 18 },
      resources: { [PONTOS]: { current: 10, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const result = feiticeiroHandler.execute(
      character,
      { actionId: 'gastar-pontos-de-feiticaria', payload: { amount: 5 } },
      makeContextFor(character),
    );
    assert.equal(result.ok, true, result.error?.code);
    assert.equal(result.character.state.resources[PONTOS].current, 5);
  });

  test('payload inválido é erro, nunca um valor arredondado', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 10,
      abilities: { carisma: 18 },
      resources: { [PONTOS]: { current: 10, sourceInstanceId: classSource(CLASS_ID) } },
    });
    for (const amount of [0, -3, 1.5]) {
      const result = feiticeiroHandler.execute(
        character,
        { actionId: 'gastar-pontos-de-feiticaria', payload: { amount } },
        makeContextFor(character),
      );
      assert.equal(result.ok, false, String(amount));
      assert.equal(result.error.code, 'HANDLER_PAYLOAD_INVALID', String(amount));
    }
  });
});

describe('handler class-feiticeiro — Feitiçaria Inata e Feitiçaria Encarnada', () => {
  test('o ramo normal gasta 1 uso; o encarnado gasta 2 PF', () => {
    const comUsos = makeMartialCharacter({
      classId: CLASS_ID,
      level: 7,
      abilities: { carisma: 18 },
      resources: {
        [INATA]: { current: 2, sourceInstanceId: classSource(CLASS_ID) },
        [PONTOS]: { current: 7, sourceInstanceId: classSource(CLASS_ID) },
      },
    });
    const normal = feiticeiroHandler.execute(comUsos, { actionId: 'ativar-feiticaria-inata' }, makeContextFor(comUsos));
    assert.equal(normal.ok, true, normal.error?.code);
    assert.equal(normal.character.state.resources[INATA].current, 1);
    assert.equal(normal.character.state.resources[PONTOS].current, 7, 'o ramo normal não toca os PF');

    const semUsos = makeMartialCharacter({
      classId: CLASS_ID,
      level: 7,
      abilities: { carisma: 18 },
      resources: {
        [INATA]: { current: 0, sourceInstanceId: classSource(CLASS_ID) },
        [PONTOS]: { current: 7, sourceInstanceId: classSource(CLASS_ID) },
      },
    });
    const encarnada = feiticeiroHandler.execute(
      semUsos,
      { actionId: 'ativar-feiticaria-inata-encarnada' },
      makeContextFor(semUsos),
    );
    assert.equal(encarnada.ok, true, encarnada.error?.code);
    assert.equal(encarnada.character.state.resources[PONTOS].current, 5);
    assert.equal(encarnada.character.state.resources[INATA].current, 0, 'o ramo encarnado não toca os usos');
  });

  test('Feitiçaria Encarnada só existe do nível 7 em diante', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 6,
      abilities: { carisma: 18 },
      resources: { [PONTOS]: { current: 6, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const result = feiticeiroHandler.execute(
      character,
      { actionId: 'ativar-feiticaria-inata-encarnada' },
      makeContextFor(character),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_ACTION_LEVEL_TOO_LOW');
  });

  test('ativar e encerrar são o inverso EXATO um do outro', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 5,
      abilities: { carisma: 18 },
      resources: { [INATA]: { current: 2, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const ativa = feiticeiroHandler.execute(character, { actionId: 'ativar-feiticaria-inata' }, makeContextFor(character));
    assert.equal(ativa.ok, true);
    const encerra = feiticeiroHandler.execute(
      ativa.character,
      { actionId: 'encerrar-feiticaria-inata' },
      makeContextFor(ativa.character),
    );
    assert.equal(encerra.ok, true);
    assert.equal(encerra.character.state.usageFlags[`${classSource(CLASS_ID)}:feiticaria-inata-ativa`], false);
    // O uso gasto NÃO volta ao encerrar — só o descanso longo devolve.
    assert.equal(encerra.character.state.resources[INATA].current, 1);
  });
});

describe('handler class-feiticeiro — metamagia e conversão de espaços não passam pelo handler', () => {
  test('o handler não conhece nenhuma ação de metamagia nem de conversão de espaço', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 10, abilities: { carisma: 18 } });
    for (const actionId of ['metamagia-config', 'converter-slot-ponto', 'converter-ponto-slot']) {
      const result = feiticeiroHandler.execute(character, { actionId }, makeContextFor(character));
      assert.equal(result.ok, false, actionId);
      assert.equal(result.error.code, 'HANDLER_ACTION_UNKNOWN', actionId);
    }
  });

  test('nenhum recurso de conjuração entra na projeção', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 10, abilities: { carisma: 18 } });
    const result = feiticeiroHandler.project(character, makeContextFor(character));
    assert.equal(result.ok, true);
    for (const resourceId of [
      'dnd2024:resource:spell-slot-1',
      'dnd2024:resource:magias-preparadas',
      'dnd2024:resource:truques',
    ]) {
      assert.equal(Object.hasOwn(result.value.resources, resourceId), false, resourceId);
    }
  });
});

describe('handler class-feiticeiro — isolamento de proveniência', () => {
  test('Restaurar Equilíbrio é da SUBCLASSE e recusa entrada de outra fonte', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: MECANICA,
      level: 5,
      abilities: { carisma: 16 },
      resources: { [EQUILIBRIO]: { current: 3, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const result = feiticeiroHandler.execute(
      character,
      { actionId: 'mecanica-restaurar-equilibrio' },
      makeContextFor(character),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_FOREIGN_PROVENANCE');
    assert.equal(result.character.state.resources[EQUILIBRIO].current, 3);
  });

  test('a fatia alheia sobrevive por referência ao descanso longo', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: MECANICA,
      level: 10,
      abilities: { carisma: 16 },
      resources: {
        [PONTOS]: { current: 0, sourceInstanceId: classSource(CLASS_ID) },
        [EQUILIBRIO]: { current: 0, sourceInstanceId: subclassSource(MECANICA) },
      },
    });
    const before = character.state.resources[FOREIGN_TALENT_RESOURCE_ID];
    const result = feiticeiroHandler.onRest(character, { kind: 'long' }, makeContextFor(character));
    assert.equal(result.ok, true, result.error?.code);
    assert.equal(result.character.state.resources[PONTOS].current, 10);
    assert.equal(result.character.state.resources[EQUILIBRIO].current, 3);
    assert.equal(result.character.state.resources[FOREIGN_TALENT_RESOURCE_ID], before);
  });
});

describe('handler class-feiticeiro — personagem vindo da MIGRAÇÃO REAL v1 -> v2', () => {
  const estagio = migrationStageBefore('migracao-escolhas-classe-legadas');

  test('a migração real não materializa Pontos de Feitiçaria', () => {
    const { character } = migrateLegacyClassCharacter('classe-feiticeiro', {
      ...estagio,
      nivel: 10,
      recursos: { feiticeiro: { pontos_feiticaria_gastos: 4 } },
    });
    assert.deepEqual(character.state.resources, {});
  });

  test('project reporta {current: null, missing: true} e execute recusa', () => {
    const { character } = migrateLegacyClassCharacter('classe-feiticeiro', { ...estagio, nivel: 10 });
    const projected = feiticeiroHandler.project(character, makeContextFor(character));
    assert.equal(projected.ok, true, projected.error?.code);
    assert.equal(projected.value.resources[PONTOS].current, null);
    assert.equal(projected.value.resources[PONTOS].missing, true);

    const executed = feiticeiroHandler.execute(
      character,
      { actionId: 'gastar-pontos-de-feiticaria', payload: { amount: 2 } },
      makeContextFor(character),
    );
    assert.equal(executed.ok, false);
    assert.equal(executed.error.code, 'HANDLER_RESOURCE_NOT_INITIALIZED');
  });
});

describe('handler class-feiticeiro — nenhuma flag declarada é órfã', () => {
  // Guarda contra o padrão de bug "flag limpa no descanso mas sem nenhuma ação
  // que a marque" (achado Important 2 da revisão da Task 22a). Para CADA flag
  // que a projeção enxerga existe uma ação que a coloca no valor não-neutro, e
  // o último teste do bloco prova que a tabela abaixo cobre a projeção inteira.
  const SETTERS = Object.freeze([
    {
      flag: 'feiticaria-inata-ativa',
      owner: 'class',
      actionId: 'ativar-feiticaria-inata',
      level: 3,
      subclassId: null,
      resources: { [INATA]: { current: 2, sourceInstanceId: classSource(CLASS_ID) } },
    },
    {
      flag: 'restauracao-feiticeira-usada',
      owner: 'class',
      actionId: 'restauracao-feiticeira',
      level: 5,
      subclassId: null,
      resources: { [PONTOS]: { current: 0, sourceInstanceId: classSource(CLASS_ID) } },
    },
    {
      flag: 'apoteose-arcana-gratuito-usado',
      owner: 'class',
      actionId: 'apoteose-arcana-usar-metamagia-gratuita',
      level: 20,
      subclassId: null,
      resources: {},
    },
    {
      flag: 'telepatia-ativa',
      owner: 'subclass',
      actionId: 'aberrante-fala-telepatica',
      level: 3,
      subclassId: ABERRANTE,
      resources: {},
    },
    {
      flag: 'revelacao-em-carne-ativa',
      owner: 'subclass',
      actionId: 'aberrante-revelacao-em-carne',
      level: 14,
      subclassId: ABERRANTE,
      resources: { [PONTOS]: { current: 14, sourceInstanceId: classSource(CLASS_ID) } },
    },
    {
      flag: 'asas-de-dragao-ativas',
      owner: 'subclass',
      actionId: 'draconica-abrir-asas-de-dragao',
      level: 14,
      subclassId: DRACONICA,
      resources: {},
    },
    {
      flag: 'asas-de-dragao-usadas-desde-o-descanso',
      owner: 'subclass',
      actionId: 'draconica-abrir-asas-de-dragao',
      level: 14,
      subclassId: DRACONICA,
      resources: {},
    },
    {
      flag: 'companheiro-draconico-usado',
      owner: 'subclass',
      actionId: 'draconica-companheiro-draconico',
      level: 18,
      subclassId: DRACONICA,
      resources: {},
    },
    {
      flag: 'transe-da-ordem-ativo',
      owner: 'subclass',
      actionId: 'mecanica-ativar-transe-da-ordem',
      level: 14,
      subclassId: MECANICA,
      resources: {},
    },
    {
      flag: 'transe-da-ordem-usado-desde-o-descanso',
      owner: 'subclass',
      actionId: 'mecanica-ativar-transe-da-ordem',
      level: 14,
      subclassId: MECANICA,
      resources: {},
    },
    {
      flag: 'mares-do-caos-usado',
      owner: 'subclass',
      actionId: 'selvagem-mares-do-caos',
      level: 3,
      subclassId: SELVAGEM,
      resources: {},
    },
    {
      flag: 'surto-controlado-usado',
      owner: 'subclass',
      actionId: 'selvagem-surto-controlado',
      level: 18,
      subclassId: SELVAGEM,
      resources: {},
    },
  ]);

  for (const setter of SETTERS) {
    test(`"${setter.flag}" é ligada pela ação "${setter.actionId}"`, () => {
      const character = makeMartialCharacter({
        classId: CLASS_ID,
        subclassId: setter.subclassId,
        level: setter.level,
        abilities: { carisma: 18 },
        resources: setter.resources,
      });
      const result = feiticeiroHandler.execute(
        character,
        { actionId: setter.actionId, payload: { amount: 1 } },
        makeContextFor(character),
      );
      assert.equal(result.ok, true, `${setter.actionId}: ${result.error?.code}`);
      const chave =
        setter.owner === 'class'
          ? `${classSource(CLASS_ID)}:${setter.flag}`
          : `${subclassSource(setter.subclassId)}:${setter.flag}`;
      assert.equal(result.character.state.usageFlags[chave], true);
    });
  }

  test('toda flag projetada tem um setter na tabela acima', () => {
    const comSetter = new Set(SETTERS.map((setter) => setter.flag));
    const semSetter = new Set();
    for (const [subclassId, level] of [
      [ABERRANTE, 14],
      [DRACONICA, 18],
      [MECANICA, 14],
      [SELVAGEM, 18],
    ]) {
      const character = makeMartialCharacter({ classId: CLASS_ID, subclassId, level, abilities: { carisma: 18 } });
      const projected = feiticeiroHandler.project(character, makeContextFor(character));
      assert.equal(projected.ok, true, projected.error?.code);
      const prefixos = [`${classSource(CLASS_ID)}:`, `${subclassSource(subclassId)}:`];
      for (const chave of Object.keys(projected.value.flags)) {
        const prefixo = prefixos.find((candidato) => chave.startsWith(candidato));
        assert.ok(prefixo !== undefined, `flag com proveniência inesperada: ${chave}`);
        const flag = chave.slice(prefixo.length);
        if (!comSetter.has(flag)) {
          semSetter.add(flag);
        }
      }
    }
    assert.deepEqual([...semSetter].sort(), [], 'flag declarada e limpa no descanso, mas sem ação que a ligue');
  });
});

describe('handler class-feiticeiro — "usado desde o descanso" das Asas e do Transe', () => {
  test('o primeiro uso das Asas é grátis; a reabertura custa 3 PF', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: DRACONICA,
      level: 14,
      abilities: { carisma: 18 },
      resources: { [PONTOS]: { current: 14, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const abrir = feiticeiroHandler.execute(
      character,
      { actionId: 'draconica-abrir-asas-de-dragao' },
      makeContextFor(character),
    );
    assert.equal(abrir.ok, true, abrir.error?.code);
    assert.equal(abrir.character.state.resources[PONTOS].current, 14, 'o primeiro uso não custa PF');

    const recolher = feiticeiroHandler.execute(
      abrir.character,
      { actionId: 'draconica-recolher-asas-de-dragao' },
      makeContextFor(abrir.character),
    );
    assert.equal(recolher.ok, true, recolher.error?.code);

    const denovo = feiticeiroHandler.execute(
      recolher.character,
      { actionId: 'draconica-abrir-asas-de-dragao' },
      makeContextFor(recolher.character),
    );
    assert.equal(denovo.ok, false, 'o uso gratuito já foi consumido');
    assert.equal(denovo.error.code, 'HANDLER_ACTION_FLAG_STATE_INVALID');

    const reabrir = feiticeiroHandler.execute(
      recolher.character,
      { actionId: 'draconica-reabrir-asas-de-dragao' },
      makeContextFor(recolher.character),
    );
    assert.equal(reabrir.ok, true, reabrir.error?.code);
    assert.equal(reabrir.character.state.resources[PONTOS].current, 11);
  });

  test('o descanso CURTO recolhe as Asas mas NÃO devolve o uso gratuito', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: DRACONICA,
      level: 14,
      abilities: { carisma: 18 },
      usageFlags: {
        [subclassFlag(DRACONICA, 'asas-de-dragao-ativas')]: true,
        [subclassFlag(DRACONICA, 'asas-de-dragao-usadas-desde-o-descanso')]: true,
      },
    });
    const curto = feiticeiroHandler.onRest(character, { kind: 'short' }, makeContextFor(character));
    assert.equal(curto.ok, true, curto.error?.code);
    assert.equal(curto.character.state.usageFlags[subclassFlag(DRACONICA, 'asas-de-dragao-ativas')], false);
    assert.equal(
      curto.character.state.usageFlags[subclassFlag(DRACONICA, 'asas-de-dragao-usadas-desde-o-descanso')],
      true,
      'o uso gratuito só volta no descanso LONGO',
    );

    const longo = feiticeiroHandler.onRest(character, { kind: 'long' }, makeContextFor(character));
    assert.equal(longo.ok, true, longo.error?.code);
    assert.equal(
      longo.character.state.usageFlags[subclassFlag(DRACONICA, 'asas-de-dragao-usadas-desde-o-descanso')],
      false,
    );
  });

  test('o Transe da Ordem segue exatamente a mesma forma, com 5 PF', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: MECANICA,
      level: 14,
      abilities: { carisma: 18 },
      resources: { [PONTOS]: { current: 14, sourceInstanceId: classSource(CLASS_ID) } },
      usageFlags: { [subclassFlag(MECANICA, 'transe-da-ordem-usado-desde-o-descanso')]: true },
    });
    const reativar = feiticeiroHandler.execute(
      character,
      { actionId: 'mecanica-reativar-transe-da-ordem' },
      makeContextFor(character),
    );
    assert.equal(reativar.ok, true, reativar.error?.code);
    assert.equal(reativar.character.state.resources[PONTOS].current, 9);
    assert.equal(reativar.character.state.usageFlags[subclassFlag(MECANICA, 'transe-da-ordem-ativo')], true);
  });

  test('Marés do Caos: usar bloqueia até o descanso longo', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: SELVAGEM,
      level: 3,
      abilities: { carisma: 18 },
    });
    const usar = feiticeiroHandler.execute(character, { actionId: 'selvagem-mares-do-caos' }, makeContextFor(character));
    assert.equal(usar.ok, true, usar.error?.code);

    const denovo = feiticeiroHandler.execute(
      usar.character,
      { actionId: 'selvagem-mares-do-caos' },
      makeContextFor(usar.character),
    );
    assert.equal(denovo.ok, false);
    assert.equal(denovo.error.code, 'HANDLER_ACTION_FLAG_STATE_INVALID');

    const longo = feiticeiroHandler.onRest(usar.character, { kind: 'long' }, makeContextFor(usar.character));
    assert.equal(longo.ok, true);
    assert.equal(longo.character.state.usageFlags[subclassFlag(SELVAGEM, 'mares-do-caos-usado')], false);
  });

  test('Revelação em Carne com PF insuficiente NÃO liga a flag', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: ABERRANTE,
      level: 14,
      abilities: { carisma: 18 },
      resources: { [PONTOS]: { current: 1, sourceInstanceId: classSource(CLASS_ID) } },
    });
    const result = feiticeiroHandler.execute(
      character,
      { actionId: 'aberrante-revelacao-em-carne', payload: { amount: 5 } },
      makeContextFor(character),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_INSUFFICIENT');
    assert.equal(
      Object.hasOwn(result.character.state.usageFlags, subclassFlag(ABERRANTE, 'revelacao-em-carne-ativa')),
      false,
    );
  });

  test('a Apoteose Arcana volta nos DOIS descansos (sheet.js:4453 e :4813)', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 20,
      abilities: { carisma: 20 },
      usageFlags: { [`${classSource(CLASS_ID)}:apoteose-arcana-gratuito-usado`]: true },
    });
    for (const kind of ['short', 'long']) {
      const result = feiticeiroHandler.onRest(character, { kind }, makeContextFor(character));
      assert.equal(result.ok, true, kind);
      assert.equal(
        result.character.state.usageFlags[`${classSource(CLASS_ID)}:apoteose-arcana-gratuito-usado`],
        false,
        kind,
      );
    }
  });
});
