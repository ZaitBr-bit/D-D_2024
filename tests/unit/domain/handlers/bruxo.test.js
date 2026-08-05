// Testes do handler oficial do Bruxo (Task 22a).
//
// RED esperado antes desta tarefa: o módulo do handler não existia.
//
// Oráculo: `tests/fixtures/expected/class-actions/arcane.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { bruxoHandler } from '../../../../site/js/domain/rulesets/dnd2024/handlers/bruxo.js';
import { castSpell } from '../../../../site/js/domain/spells/index.js';
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
  subclassSource,
  transitionCasesFor,
  FOREIGN_TALENT_RESOURCE_ID,
} from '../../../helpers/martial-fixtures.js';

const CLASS_ID = 'dnd2024:class:bruxo';
const ARQUIFADA = 'dnd2024:subclass:patrono-arquifada';
const CELESTIAL = 'dnd2024:subclass:patrono-celestial';
const INFERO = 'dnd2024:subclass:patrono-infero';
const PASSOS = 'dnd2024:resource:passos-feericos';
const LUZ = 'dnd2024:resource:luz-medicinal';

describe('handler class-bruxo — paridade com arcane.json', () => {
  const projections = projectionCasesFor('class-bruxo');
  const transitions = transitionCasesFor('class-bruxo');

  test('o fixture cobre projeções e transições do Bruxo', () => {
    assert.ok(projections.length >= 3, 'esperado >= 3 casos de projeção no fixture');
    assert.ok(transitions.length >= 8, 'esperado >= 8 casos de transição no fixture');
  });

  for (const testCase of projections) {
    test(`projeção: ${testCase.id}`, () => assertProjectionCase(bruxoHandler, testCase));
  }
  for (const testCase of transitions) {
    test(`transição: ${testCase.id}`, () => assertTransitionCase(bruxoHandler, testCase));
  }
});

describe('handler class-bruxo — Magia de Pacto é do domínio de magias', () => {
  test('o handler não declara NENHUM recurso de conjuração (nem de pacto)', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 11, abilities: { carisma: 18 } });
    const result = bruxoHandler.project(character, makeContextFor(character));
    assert.equal(result.ok, true, result.error?.code);
    for (const resourceId of [
      'dnd2024:resource:spell-slot-1',
      'dnd2024:resource:spell-slot-5',
      'dnd2024:resource:magias-preparadas',
      'dnd2024:resource:truques',
      'dnd2024:resource:invocacoes',
    ]) {
      assert.equal(Object.hasOwn(result.value.resources, resourceId), false, resourceId);
    }
  });

  test('Astúcia Mágica só queima o uso único; o espaço de pacto é do domínio de magias', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 2, abilities: { carisma: 16 } });
    const result = bruxoHandler.execute(character, { actionId: 'usar-astucia-magica' }, makeContextFor(character));
    assert.equal(result.ok, true, result.error?.code);
    assert.deepEqual(result.affected, ['state.usageFlags'], 'o handler não toca state.spells');
    assert.deepEqual(result.character.state.spells, character.state.spells);
  });

  test('quem gasta espaço de PACTO é `castSpell` — e o handler de classe NÃO o faz', () => {
    // Prova executável em dois lados, com uma conjuração que de fato SUCEDE:
    //   1. `castSpell` com `{kind:'pact-slot'}` debita `state.spells.pactSlots`
    //      e reporta isso em `affected` (se a delegação sumir, isto falha);
    //   2. o descanso curto do handler — que no baseline é justamente onde os
    //      espaços de pacto voltam — NÃO toca `state.spells`, provando que a
    //      metade de conjuração está mesmo fora do handler.
    const character = makeSpellCharacter({
      build: { classRef: { id: CLASS_ID, packageVersion: '1.0.0' } },
      state: {
        level: 5,
        spells: {
          prepared: [spellEntry('p1', 'dnd2024:spell:enfeiticar-pessoa', null)],
          pactSlots: { used: 0 },
          slots: { 1: { used: 0, extra: 0 } },
        },
      },
    });
    const context = Object.freeze({
      registry: makeSpellRegistry(),
      spellcasting: { slotMaximums: { 1: 1 }, pactSlots: { maximum: 2, level: 1 } },
    });

    const conjurada = castSpell(
      character,
      { spellId: 'dnd2024:spell:enfeiticar-pessoa', sourceInstanceId: null, slotSource: { kind: 'pact-slot' } },
      context,
    );
    assert.equal(conjurada.ok, true, `castSpell falhou: ${conjurada.error?.code}`);
    assert.ok(
      conjurada.affected.includes('state.spells.pactSlots'),
      `esperado "state.spells.pactSlots" em affected; veio ${JSON.stringify(conjurada.affected)}`,
    );
    assert.equal(conjurada.character.state.spells.pactSlots.used, 1);
    assert.equal(conjurada.character.state.spells.slots['1'].used, 0, 'a pool comum não é tocada');

    // E o handler, no descanso onde o baseline devolve os espaços de pacto,
    // deixa `state.spells` byte-idêntico e por REFERÊNCIA.
    const descansado = bruxoHandler.onRest(conjurada.character, { kind: 'short' }, makeContextFor(conjurada.character));
    assert.equal(descansado.ok, true, descansado.error?.code);
    assert.equal(descansado.character.state.spells, conjurada.character.state.spells);
    assert.equal(descansado.character.state.spells.pactSlots.used, 1);
  });
});

describe('handler class-bruxo — Arcana Mística (um uso por círculo)', () => {
  for (const [circulo, minLevel] of [[6, 11], [7, 13], [8, 15], [9, 17]]) {
    test(`círculo ${circulo}: destravado no nível ${minLevel}, recusado abaixo dele`, () => {
      const abaixo = makeMartialCharacter({ classId: CLASS_ID, level: minLevel - 1, abilities: { carisma: 18 } });
      const recusado = bruxoHandler.execute(
        abaixo,
        { actionId: `arcana-mistica-${circulo}-marcar-uso` },
        makeContextFor(abaixo),
      );
      assert.equal(recusado.ok, false);
      assert.equal(recusado.error.code, 'HANDLER_ACTION_LEVEL_TOO_LOW');

      const acima = makeMartialCharacter({ classId: CLASS_ID, level: minLevel, abilities: { carisma: 18 } });
      const marcado = bruxoHandler.execute(
        acima,
        { actionId: `arcana-mistica-${circulo}-marcar-uso` },
        makeContextFor(acima),
      );
      assert.equal(marcado.ok, true, marcado.error?.code);
      assert.equal(
        marcado.character.state.usageFlags[`${classSource(CLASS_ID)}:arcana-mistica-${circulo}-usada`],
        true,
      );
    });
  }

  test('marcar e restaurar são o inverso EXATO um do outro', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, level: 17, abilities: { carisma: 18 } });
    const marcado = bruxoHandler.execute(character, { actionId: 'arcana-mistica-6-marcar-uso' }, makeContextFor(character));
    assert.equal(marcado.ok, true);
    const restaurado = bruxoHandler.execute(
      marcado.character,
      { actionId: 'arcana-mistica-6-restaurar' },
      makeContextFor(marcado.character),
    );
    assert.equal(restaurado.ok, true);
    assert.equal(
      restaurado.character.state.usageFlags[`${classSource(CLASS_ID)}:arcana-mistica-6-usada`],
      false,
    );
  });
});

describe('handler class-bruxo — tetos de subclasse vindos do conteúdo', () => {
  test('Passos Feéricos usa o modificador REAL de Carisma (mínimo 1)', () => {
    for (const [carisma, esperado] of [[8, 1], [14, 2], [20, 5]]) {
      const character = makeMartialCharacter({
        classId: CLASS_ID,
        subclassId: ARQUIFADA,
        level: 3,
        abilities: { carisma },
      });
      const result = bruxoHandler.project(character, makeContextFor(character));
      assert.equal(result.ok, true, result.error?.code);
      assert.equal(result.value.resources[PASSOS].max, esperado, `carisma ${carisma}`);
    }
  });

  test('Luz Medicinal é `1 + nível`, degrau a degrau', () => {
    for (const [level, esperado] of [[3, 4], [10, 11], [20, 21]]) {
      const character = makeMartialCharacter({ classId: CLASS_ID, subclassId: CELESTIAL, level, abilities: { carisma: 16 } });
      const result = bruxoHandler.project(character, makeContextFor(character));
      assert.equal(result.ok, true, result.error?.code);
      assert.equal(result.value.resources[LUZ].max, esperado, `nível ${level}`);
    }
  });

  test('Luz Medicinal gasta a quantidade do payload (vários dados de uma vez)', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: CELESTIAL,
      level: 5,
      abilities: { carisma: 16 },
      resources: { [LUZ]: { current: 6, sourceInstanceId: subclassSource(CELESTIAL) } },
    });
    const result = bruxoHandler.execute(
      character,
      { actionId: 'celestial-luz-medicinal', payload: { amount: 4 } },
      makeContextFor(character),
    );
    assert.equal(result.ok, true, result.error?.code);
    assert.equal(result.character.state.resources[LUZ].current, 2);
  });

  test('a subclasse errada não enxerga o recurso da outra', () => {
    const character = makeMartialCharacter({ classId: CLASS_ID, subclassId: INFERO, level: 10, abilities: { carisma: 18 } });
    const result = bruxoHandler.project(character, makeContextFor(character));
    assert.equal(result.ok, true);
    assert.equal(Object.hasOwn(result.value.resources, PASSOS), false);
    assert.equal(Object.hasOwn(result.value.resources, LUZ), false);
  });
});

describe('handler class-bruxo — isolamento de proveniência', () => {
  test('Passos Feéricos com `sourceInstanceId` de outra fonte é recusado', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: ARQUIFADA,
      level: 10,
      abilities: { carisma: 18 },
      resources: { [PASSOS]: { current: 3, sourceInstanceId: subclassSource(CELESTIAL) } },
    });
    const result = bruxoHandler.execute(character, { actionId: 'arquifada-passos-feericos' }, makeContextFor(character));
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'HANDLER_RESOURCE_FOREIGN_PROVENANCE');
    assert.equal(result.character.state.resources[PASSOS].current, 3);
  });

  test('a flag do patrono é da SUBCLASSE, e a fatia alheia sobrevive por referência', () => {
    const character = makeMartialCharacter({
      classId: CLASS_ID,
      subclassId: INFERO,
      level: 14,
      abilities: { carisma: 18 },
    });
    const before = character.state.resources[FOREIGN_TALENT_RESOURCE_ID];
    const result = bruxoHandler.execute(character, { actionId: 'infero-lancar-no-inferno' }, makeContextFor(character));
    assert.equal(result.ok, true, result.error?.code);
    assert.equal(result.character.state.usageFlags[subclassFlag(INFERO, 'lancar-no-inferno-usado')], true);
    assert.equal(result.character.state.resources[FOREIGN_TALENT_RESOURCE_ID], before);
  });
});

describe('handler class-bruxo — personagem vindo da MIGRAÇÃO REAL v1 -> v2', () => {
  const estagio = migrationStageBefore('migracao-escolhas-classe-legadas');

  test('a migração real não materializa recurso de subclasse', () => {
    const { character } = migrateLegacyClassCharacter('classe-bruxo', {
      ...estagio,
      nivel: 10,
      recursos: { bruxo: { astucia_usada: true } },
    });
    assert.deepEqual(character.state.resources, {});
  });

  test('o descanso não materializa o recurso ausente nem a flag ausente', () => {
    const { character } = migrateLegacyClassCharacter('classe-bruxo', { ...estagio, nivel: 10 });
    for (const kind of ['short', 'long']) {
      const rested = bruxoHandler.onRest(character, { kind }, makeContextFor(character));
      assert.equal(rested.ok, true, kind);
      assert.deepEqual(rested.affected, [], kind);
      assert.equal(
        Object.hasOwn(rested.character.state.usageFlags, `${classSource(CLASS_ID)}:astucia-magica-usada`),
        false,
        kind,
      );
    }
  });
});
