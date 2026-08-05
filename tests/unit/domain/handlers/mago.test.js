// Testes do handler oficial do Mago (Task 22a).
//
// RED esperado antes desta tarefa: o módulo do handler não existia.
//
// Oráculo: `tests/fixtures/expected/class-actions/arcane.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { magoHandler } from '../../../../site/js/domain/rulesets/dnd2024/handlers/mago.js';
import { validateSpellSelection } from '../../../../site/js/domain/spells/index.js';
import {
  makeCharacter as makeSpellCharacter,
  makeRegistry as makeSpellRegistry,
  spellEntry,
} from '../../../helpers/spell-fixtures.js';
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
  transitionCasesFor,
  FOREIGN_USAGE_FLAG_KEY,
} from '../../../helpers/martial-fixtures.js';

const CLASS_ID = 'dnd2024:class:mago';
const ABJURADOR = 'dnd2024:subclass:abjurador';
const ADIVINHADOR = 'dnd2024:subclass:adivinhador';
const ILUSIONISTA = 'dnd2024:subclass:ilusionista';

describe('handler class-mago — paridade com arcane.json', () => {
  const projections = projectionCasesFor('class-mago');
  const transitions = transitionCasesFor('class-mago');

  test('o fixture cobre projeções e transições do Mago', () => {
    assert.ok(projections.length >= 2, 'esperado >= 2 casos de projeção no fixture');
    assert.ok(transitions.length >= 7, 'esperado >= 7 casos de transição no fixture');
  });

  for (const testCase of projections) {
    test(`projeção: ${testCase.id}`, () => assertProjectionCase(magoHandler, testCase));
  }
  for (const testCase of transitions) {
    test(`transição: ${testCase.id}`, () => assertTransitionCase(magoHandler, testCase));
  }
});

describe('handler class-mago — conjuração e grimório NÃO passam pelo handler', () => {
  test('o handler não declara recurso nenhum de conjuração', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 12, abilities: { inteligencia: 20 } });
    const result = magoHandler.project(character, makeContextFor(character));
    assert.equal(result.ok, true, result.error?.code);
    assert.deepEqual(result.value.resources, {}, 'o Mago não tem reserva contável própria');
  });

  test('"preparado do grimório" é decidido por `validateSpellSelection`, não pelo handler', () => {
    // Prova executável nos DOIS ramos: a mesma seleção passa quando a magia
    // está no grimório e é recusada com `SPELL_SELECTION_NOT_IN_SPELLBOOK`
    // quando não está — a regra vive no domínio de magias (Task 18), com o
    // mesmo vocabulário declarativo decidido para o Clérigo na Task 21.
    const contexto = Object.freeze({ registry: makeSpellRegistry(), spellcasting: { slotMaximums: { 1: 2 } } });
    const comGrimorio = makeSpellCharacter({
      build: { classRef: { id: CLASS_ID, packageVersion: '1.0.0' } },
      state: { spells: { spellbook: [spellEntry('g0', 'dnd2024:spell:alarme', null)] } },
    });
    const dentro = validateSpellSelection(
      comGrimorio,
      { collection: 'prepared', spellIds: ['dnd2024:spell:alarme'], preparedFrom: 'spellbook', limit: 4 },
      contexto,
    );
    assert.equal(dentro.ok, true, `esperado sucesso; veio ${dentro.error?.code}`);

    const semGrimorio = makeSpellCharacter({
      build: { classRef: { id: CLASS_ID, packageVersion: '1.0.0' } },
      state: { spells: { spellbook: [] } },
    });
    const fora = validateSpellSelection(
      semGrimorio,
      { collection: 'prepared', spellIds: ['dnd2024:spell:alarme'], preparedFrom: 'spellbook', limit: 4 },
      contexto,
    );
    assert.equal(fora.ok, false);
    assert.equal(fora.error.code, 'SPELL_SELECTION_NOT_IN_SPELLBOOK');

    // E o handler de classe não acrescenta NADA a esse caminho.
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 5, abilities: { inteligencia: 18 } });
    const contributed = magoHandler.contributeEffects(character, makeContextFor(character));
    assert.equal(contributed.ok, true);
    assert.deepEqual(contributed.value, [], 'o handler não contribui nenhuma magia preparada');
  });

  test('Recuperação Arcana só queima o uso único; nenhum espaço de magia é tocado', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 10, abilities: { inteligencia: 18 } });
    const result = magoHandler.execute(character, { actionId: 'usar-recuperacao-arcana' }, makeContextFor(character));
    assert.equal(result.ok, true, result.error?.code);
    assert.deepEqual(result.affected, ['state.usageFlags']);
    assert.deepEqual(result.character.state.spells, character.state.spells);
  });
});

describe('handler class-mago — Assinatura Mágica (nível 20, recarrega em descanso curto)', () => {
  test('as duas assinaturas são independentes', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 20, abilities: { inteligencia: 20 } });
    const primeira = magoHandler.execute(character, { actionId: 'usar-assinatura-magica-1' }, makeContextFor(character));
    assert.equal(primeira.ok, true, primeira.error?.code);
    assert.equal(primeira.character.state.usageFlags[`${classSource(CLASS_ID)}:assinatura-magica-1-usada`], true);
    assert.equal(
      Object.hasOwn(primeira.character.state.usageFlags, `${classSource(CLASS_ID)}:assinatura-magica-2-usada`),
      false,
      'a segunda assinatura não é marcada junto',
    );

    const segunda = magoHandler.execute(
      primeira.character,
      { actionId: 'usar-assinatura-magica-2' },
      makeContextFor(primeira.character),
    );
    assert.equal(segunda.ok, true, segunda.error?.code);
  });

  test('o descanso CURTO de nível 20 devolve as assinaturas mas não a Recuperação Arcana', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 20,
      abilities: { inteligencia: 20 },
      usageFlags: {
        [`${classSource(CLASS_ID)}:assinatura-magica-1-usada`]: true,
        [`${classSource(CLASS_ID)}:recuperacao-arcana-usada`]: true,
      },
    });
    const result = magoHandler.onRest(character, { kind: 'short' }, makeContextFor(character));
    assert.equal(result.ok, true, result.error?.code);
    assert.equal(result.character.state.usageFlags[`${classSource(CLASS_ID)}:assinatura-magica-1-usada`], false);
    assert.equal(result.character.state.usageFlags[`${classSource(CLASS_ID)}:recuperacao-arcana-usada`], true);
    assert.equal(result.character.state.usageFlags[FOREIGN_USAGE_FLAG_KEY], true);
  });

  test('o descanso CURTO abaixo do nível 20 não mexe nas assinaturas', () => {
    // Guarda direta contra a extensão `rest[].minLevel`: sem ela, um Mago de
    // nível 19 teria a flag reescrita numa recarga que o baseline não faz.
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      level: 19,
      abilities: { inteligencia: 20 },
      usageFlags: { [`${classSource(CLASS_ID)}:assinatura-magica-1-usada`]: true },
    });
    const result = magoHandler.onRest(character, { kind: 'short' }, makeContextFor(character));
    assert.equal(result.ok, true);
    assert.deepEqual(result.affected, []);
    assert.equal(result.character.state.usageFlags[`${classSource(CLASS_ID)}:assinatura-magica-1-usada`], true);
  });
});

describe('handler class-mago — flags de subclasse por proveniência', () => {
  const CASOS = Object.freeze([
    { subclassId: ABJURADOR, level: 3, actionId: 'abjurador-criar-protecao-arcana', flag: 'protecao-arcana-criada' },
    { subclassId: ADIVINHADOR, level: 10, actionId: 'adivinhador-terceiro-olho', flag: 'terceiro-olho-usado' },
    { subclassId: ILUSIONISTA, level: 10, actionId: 'ilusionista-autoimagem-ilusoria', flag: 'autoimagem-ilusoria-usada' },
  ]);

  for (const caso of CASOS) {
    test(`${caso.actionId} grava a flag com a proveniência da SUBCLASSE`, () => {
      const character = makeMartialCharacter({
        classId: CLASS_ID,
        subclassId: caso.subclassId,
        level: caso.level,
        abilities: { inteligencia: 18 },
      });
      const result = magoHandler.execute(character, { actionId: caso.actionId }, makeContextFor(character));
      assert.equal(result.ok, true, result.error?.code);
      assert.equal(result.character.state.usageFlags[subclassFlag(caso.subclassId, caso.flag)], true);
      assert.equal(
        Object.hasOwn(result.character.state.usageFlags, `${classSource(CLASS_ID)}:${caso.flag}`),
        false,
        'a flag não pode ser gravada com a proveniência da classe',
      );
    });

    test(`${caso.actionId} é recusada na subclasse errada`, () => {
      const outra = caso.subclassId === ILUSIONISTA ? ABJURADOR : ILUSIONISTA;
      const character = makeMartialCharacter({
        classId: CLASS_ID,
        subclassId: outra,
        level: caso.level,
        abilities: { inteligencia: 18 },
      });
      const result = magoHandler.execute(character, { actionId: caso.actionId }, makeContextFor(character));
      assert.equal(result.ok, false);
      assert.equal(result.error.code, 'HANDLER_ACTION_SUBCLASS_REQUIRED');
    });
  }

  test('a Autoimagem Ilusória volta no descanso CURTO (sheet.js:4523-4525)', () => {
    // A revisão da Task 22a pegou esta recarga faltando: o bloco de descanso
    // curto do baseline vai até a linha 4527 e restaura `autoimagem_usada` do
    // Ilusionista. NÃO é divergência — é paridade, e este teste a trava.
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: ILUSIONISTA,
      level: 10,
      abilities: { inteligencia: 18 },
      usageFlags: {
        [subclassFlag(ILUSIONISTA, 'autoimagem-ilusoria-usada')]: true,
        [subclassFlag(ILUSIONISTA, 'criaturas-espectrais-fera-usada')]: true,
      },
    });
    const curto = magoHandler.onRest(character, { kind: 'short' }, makeContextFor(character));
    assert.equal(curto.ok, true, curto.error?.code);
    assert.equal(curto.character.state.usageFlags[subclassFlag(ILUSIONISTA, 'autoimagem-ilusoria-usada')], false);
    assert.equal(
      curto.character.state.usageFlags[subclassFlag(ILUSIONISTA, 'criaturas-espectrais-fera-usada')],
      true,
      'Criaturas Espectrais só volta no descanso longo',
    );
  });

  test('O Terceiro Olho volta no descanso curto; a Proteção Arcana só no longo', () => {
    const adivinhador = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: ADIVINHADOR,
      level: 10,
      abilities: { inteligencia: 18 },
      usageFlags: { [subclassFlag(ADIVINHADOR, 'terceiro-olho-usado')]: true },
    });
    const curtoAdivinhador = magoHandler.onRest(adivinhador, { kind: 'short' }, makeContextFor(adivinhador));
    assert.equal(curtoAdivinhador.ok, true);
    assert.equal(curtoAdivinhador.character.state.usageFlags[subclassFlag(ADIVINHADOR, 'terceiro-olho-usado')], false);

    const abjurador = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: ABJURADOR,
      level: 10,
      abilities: { inteligencia: 18 },
      usageFlags: { [subclassFlag(ABJURADOR, 'protecao-arcana-criada')]: true },
    });
    const curtoAbjurador = magoHandler.onRest(abjurador, { kind: 'short' }, makeContextFor(abjurador));
    assert.equal(curtoAbjurador.ok, true);
    assert.deepEqual(curtoAbjurador.affected, []);
    const longoAbjurador = magoHandler.onRest(abjurador, { kind: 'long' }, makeContextFor(abjurador));
    assert.equal(longoAbjurador.ok, true);
    assert.equal(longoAbjurador.character.state.usageFlags[subclassFlag(ABJURADOR, 'protecao-arcana-criada')], false);
  });
});

describe('handler class-mago — o descanso não materializa flag ausente', () => {
  test('personagem que nunca usou nada sai do descanso sem chave nova', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: ILUSIONISTA,
      level: 20,
      abilities: { inteligencia: 20 },
    });
    for (const kind of ['short', 'long']) {
      const result = magoHandler.onRest(character, { kind }, makeContextFor(character));
      assert.equal(result.ok, true, kind);
      assert.deepEqual(result.affected, [], kind);
      assert.deepEqual(Object.keys(result.character.state.usageFlags), [FOREIGN_USAGE_FLAG_KEY], kind);
    }
  });
});

describe('handler class-mago — personagem vindo da MIGRAÇÃO REAL v1 -> v2', () => {
  const estagio = migrationStageBefore('migracao-escolhas-classe-legadas');

  test('a migração real não materializa as flags de uso do Mago', () => {
    const { character } = migrateLegacyClassCharacter('classe-mago', {
      ...estagio,
      nivel: 10,
      recursos: { mago: { recuperacao_arcana_usada: true } },
    });
    const projected = magoHandler.project(character, makeContextFor(character));
    assert.equal(projected.ok, true, projected.error?.code);
    assert.equal(projected.value.flags[`${classSource(CLASS_ID)}:recuperacao-arcana-usada`], false);
  });

  test('a ação continua disponível depois da migração (nada foi inventado)', () => {
    const { character } = migrateLegacyClassCharacter('classe-mago', { ...estagio, nivel: 10 });
    const result = magoHandler.execute(character, { actionId: 'usar-recuperacao-arcana' }, makeContextFor(character));
    assert.equal(result.ok, true, result.error?.code);
  });
});
