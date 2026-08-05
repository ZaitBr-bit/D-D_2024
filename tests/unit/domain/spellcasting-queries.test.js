// Testes de `domain/spells/spellcasting-queries.js` (Task 18): a projeção
// pura de conjuração — habilidade/CD/ataque (delegados à Task 16), espaços de
// magia por círculo, pool SEPARADO de Magia de Pacto, e as magias do
// personagem resolvidas contra o catálogo (círculo, ritual, concentração,
// listas de classe) com proveniência preservada.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { getSpellcastingProjection, readSpellcastingTable } from '../../../site/js/domain/spells/index.js';
import { makeCharacter, makeRegistry, spellEntry } from '../../helpers/spell-fixtures.js';

describe('domain/spells — readSpellcastingTable', () => {
  test('ausência de canal vira null (desconhecido), nunca 0', () => {
    const table = readSpellcastingTable({});
    assert.deepEqual(table.slotMaximums, {});
    assert.equal(table.pactSlots.maximum, null);
    assert.equal(table.pactSlots.level, null);
    assert.equal(table.cantripsKnown, null);
    assert.equal(table.preparedLimit, null);
  });

  test('descarta círculos fora de 1..9 e valores não inteiros', () => {
    const table = readSpellcastingTable({
      spellcasting: { slotMaximums: { 0: 3, 1: 4, 9: 1, 10: 2, 2: 'dois', 3: -1 } },
    });
    assert.deepEqual(table.slotMaximums, { 1: 4, 9: 1 });
  });
});

describe('domain/spells — getSpellcastingProjection', () => {
  test('sem context.registry falha explicitamente (nunca projeção degradada)', () => {
    const result = getSpellcastingProjection(makeCharacter(), {});
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SPELLCASTING_REGISTRY_REQUIRED');
  });

  test('personagem inválido falha com SPELLCASTING_CHARACTER_INVALID', () => {
    const result = getSpellcastingProjection({ identity: {} }, { registry: makeRegistry() });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SPELLCASTING_CHARACTER_INVALID');
  });

  test('habilidade/CD/ataque vêm da consulta da Task 16 (não recalculados aqui)', () => {
    const character = makeCharacter({
      build: { classRef: { id: 'dnd2024:class:mago', packageVersion: '1.0.0' } },
      state: { level: 5, abilities: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 16, sabedoria: 10, carisma: 10 } },
    });
    const result = getSpellcastingProjection(character, { registry: makeRegistry() });
    assert.equal(result.ok, true);
    assert.equal(result.value.ability, 'dnd2024:ability:inteligencia');
    assert.equal(result.value.progression, 'full');
    // Bônus de proficiência nível 5 = +3; mod INT 16 = +3 -> CD 8+3+3 = 14.
    assert.equal(result.value.saveDC, 14);
    assert.equal(result.value.attackBonus, 6);
  });

  test('espaços por círculo combinam estado (used/extra) e máximo da tabela', () => {
    const character = makeCharacter({
      build: { classRef: { id: 'dnd2024:class:mago', packageVersion: '1.0.0' } },
      state: { spells: { slots: { 1: { used: 1, extra: 0 }, 2: { used: 0, extra: 1 } } } },
    });
    const result = getSpellcastingProjection(character, {
      registry: makeRegistry(),
      spellcasting: { slotMaximums: { 1: 4, 2: 3 } },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(
      result.value.slots.map((slot) => [slot.level, slot.used, slot.extra, slot.maximum, slot.available]),
      [
        [1, 1, 0, 4, 3],
        // `extra` (concessão registrada, ex.: Fonte de Magia) soma ao máximo
        // da tabela — mesma regra de site/js/pages/sheet.js:2740.
        [2, 0, 1, 4, 4],
      ],
    );
  });

  test('sem tabela informada o máximo é null (desconhecido), nunca 0', () => {
    const character = makeCharacter({ state: { spells: { slots: { 1: { used: 2, extra: 0 } } } } });
    const result = getSpellcastingProjection(character, { registry: makeRegistry() });
    assert.equal(result.ok, true);
    assert.equal(result.value.slots[0].maximum, null);
    assert.equal(result.value.slots[0].available, null);
    assert.equal(result.value.slots[0].used, 2);
  });

  test('pool de Magia de Pacto é projetado separado dos espaços comuns', () => {
    const character = makeCharacter({
      build: { classRef: { id: 'dnd2024:class:bruxo', packageVersion: '1.0.0' } },
      state: { spells: { slots: { 1: { used: 0, extra: 0 } }, pactSlots: { used: 1 } } },
    });
    const result = getSpellcastingProjection(character, {
      registry: makeRegistry(),
      spellcasting: { slotMaximums: { 1: 2 }, pactSlots: { maximum: 2, level: 3 } },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.slots.map((s) => [s.level, s.used, s.available]), [[1, 0, 2]]);
    assert.deepEqual(result.value.pactSlots, { used: 1, maximum: 2, level: 3, available: 1 });
  });

  test('projeta conhecida/preparada/grimório com círculo, ritual e concentração do catálogo', () => {
    const character = makeCharacter({
      build: { classRef: { id: 'dnd2024:class:mago', packageVersion: '1.0.0' } },
      state: {
        spells: {
          known: [spellEntry('k1', 'dnd2024:spell:luz')],
          prepared: [spellEntry('p1', 'dnd2024:spell:enfeiticar-pessoa')],
          spellbook: [spellEntry('g1', 'dnd2024:spell:alarme')],
        },
      },
    });
    const result = getSpellcastingProjection(character, { registry: makeRegistry() });
    assert.equal(result.ok, true);
    const byId = Object.fromEntries(result.value.spells.map((spell) => [spell.spellId, spell]));
    assert.equal(byId['dnd2024:spell:luz'].collection, 'known');
    assert.equal(byId['dnd2024:spell:luz'].level, 0);
    assert.equal(byId['dnd2024:spell:alarme'].collection, 'spellbook');
    assert.equal(byId['dnd2024:spell:alarme'].ritual, true);
    assert.equal(byId['dnd2024:spell:enfeiticar-pessoa'].concentration, true);
    assert.deepEqual(byId['dnd2024:spell:enfeiticar-pessoa'].classIds, [
      'dnd2024:class:mago',
      'dnd2024:class:bruxo',
    ]);
  });

  test('magia customizada (sem spellRef) fica resolved:false, sem campos chutados', () => {
    const character = makeCharacter({
      state: {
        spells: { known: [{ instanceId: 'k1', customDefinition: { nome: 'Magia da Casa' }, sourceInstanceId: null }] },
      },
    });
    const result = getSpellcastingProjection(character, { registry: makeRegistry() });
    assert.equal(result.ok, true);
    const [spell] = result.value.spells;
    assert.equal(spell.resolved, false);
    assert.equal(spell.spellId, null);
    assert.equal(spell.level, null);
    assert.equal(spell.ritual, null);
    assert.equal(spell.concentration, null);
  });

  test('duas instâncias de Iniciado em Magia com a MESMA magia não são duplicata', () => {
    const character = makeCharacter({
      state: {
        spells: {
          known: [
            spellEntry('k1', 'dnd2024:spell:luz', 'legacy:spell-origin:iniciado-em-magia#1'),
            spellEntry('k2', 'dnd2024:spell:luz', 'legacy:spell-origin:iniciado-em-magia#2'),
          ],
        },
      },
    });
    const result = getSpellcastingProjection(character, { registry: makeRegistry() });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.duplicates, []);
    assert.equal(result.value.sources.length, 2);
  });

  test('a mesma magia repetida pela MESMA fonte na mesma coleção é duplicata', () => {
    const character = makeCharacter({
      state: {
        spells: {
          known: [
            spellEntry('k1', 'dnd2024:spell:luz', 'legacy:spell-origin:iniciado-em-magia#1'),
            spellEntry('k2', 'dnd2024:spell:luz', 'legacy:spell-origin:iniciado-em-magia#1'),
          ],
        },
      },
    });
    const result = getSpellcastingProjection(character, { registry: makeRegistry() });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.duplicates, [
      {
        spellId: 'dnd2024:spell:luz',
        collection: 'known',
        sourceInstanceId: 'legacy:spell-origin:iniciado-em-magia#1',
      },
    ]);
  });

  test('a mesma magia em known E prepared pela mesma fonte NÃO é duplicata (formato do baseline)', () => {
    const character = makeCharacter({
      state: {
        spells: {
          known: [spellEntry('k1', 'dnd2024:spell:luz', 'src')],
          prepared: [spellEntry('p1', 'dnd2024:spell:luz', 'src')],
        },
      },
    });
    const result = getSpellcastingProjection(character, { registry: makeRegistry() });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.duplicates, []);
  });
});
