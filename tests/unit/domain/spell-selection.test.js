// Testes de `domain/spells/spell-selection.js` (Task 18): validação de
// seleção de magias por ContentId e campo mecânico do catálogo — lista,
// círculo, ritual, atributo de conjuração, limite, duplicidade POR FONTE e a
// regra do Mago (preparar somente a partir do grimório).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { validateSpellSelection } from '../../../site/js/domain/spells/index.js';
import { makeCharacter, makeRegistry, spellEntry } from '../../helpers/spell-fixtures.js';

const MAGO_REF = Object.freeze({ id: 'dnd2024:class:mago', packageVersion: '1.0.0' });
const REGISTRY = makeRegistry();

/**
 * Contexto padrão: Mago nível 1 (2 espaços de 1º círculo).
 * @param {object} [spellcasting]
 * @returns {object}
 */
function ctx(spellcasting = { slotMaximums: { 1: 2 } }) {
  return { registry: REGISTRY, spellcasting };
}

describe('domain/spells — validateSpellSelection: forma e dependências', () => {
  test('sem registry falha explicitamente', () => {
    const result = validateSpellSelection(makeCharacter({ build: { classRef: MAGO_REF } }), {
      collection: 'known',
      spellIds: [],
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SPELL_SELECTION_REGISTRY_REQUIRED');
  });

  test('coleção fora do vocabulário é recusada', () => {
    const result = validateSpellSelection(makeCharacter(), { collection: 'rituais', spellIds: [] }, ctx());
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SPELL_SELECTION_COLLECTION_INVALID');
  });

  test('sem classRef e sem spellListIds não há lista contra a qual validar', () => {
    const result = validateSpellSelection(
      makeCharacter(),
      { collection: 'known', spellIds: ['dnd2024:spell:luz'] },
      ctx(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SPELL_SELECTION_LIST_UNKNOWN');
  });
});

describe('domain/spells — validateSpellSelection: lista e círculo', () => {
  test('aceita magia da lista implícita da classe', () => {
    const result = validateSpellSelection(
      makeCharacter({ build: { classRef: MAGO_REF } }),
      { collection: 'known', spellIds: ['dnd2024:spell:alarme'] },
      ctx(),
    );
    assert.equal(result.ok, true);
  });

  test('recusa magia fora da lista da classe', () => {
    const character = makeCharacter({ build: { classRef: { id: 'dnd2024:class:bruxo', packageVersion: '1.0.0' } } });
    const result = validateSpellSelection(
      character,
      { collection: 'known', spellIds: ['dnd2024:spell:alarme'] },
      ctx(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SPELL_SELECTION_NOT_IN_LIST');
  });

  test('lista explícita (Iniciado em Magia) substitui a lista da classe', () => {
    const character = makeCharacter({ build: { classRef: MAGO_REF } });
    const dentro = validateSpellSelection(
      character,
      { collection: 'known', spellIds: ['dnd2024:spell:luz'], spellListIds: ['dnd2024:spell-list:clerigo'] },
      ctx(),
    );
    assert.equal(dentro.ok, true);
    const fora = validateSpellSelection(
      character,
      { collection: 'known', spellIds: ['dnd2024:spell:alarme'], spellListIds: ['dnd2024:spell-list:clerigo'] },
      ctx(),
    );
    assert.equal(fora.ok, false);
    assert.equal(fora.error.code, 'SPELL_SELECTION_NOT_IN_LIST');
  });

  test('lista explícita inexistente é erro, nunca "lista vazia"', () => {
    const result = validateSpellSelection(
      makeCharacter({ build: { classRef: MAGO_REF } }),
      { collection: 'known', spellIds: ['dnd2024:spell:luz'], spellListIds: ['dnd2024:spell-list:inexistente'] },
      ctx(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SPELL_SELECTION_UNKNOWN_SPELL_LIST');
  });

  test('magia acima do círculo máximo derivado dos espaços é recusada', () => {
    const result = validateSpellSelection(
      makeCharacter({ build: { classRef: MAGO_REF } }),
      { collection: 'known', spellIds: ['dnd2024:spell:bola-de-fogo'] },
      ctx(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SPELL_SELECTION_LEVEL_TOO_HIGH');
    assert.equal(result.error.context.maxSpellLevel, 1);
  });

  test('sem tabela e sem maxSpellLevel a validação FALHA em vez de assumir um círculo', () => {
    const result = validateSpellSelection(
      makeCharacter({ build: { classRef: MAGO_REF } }),
      { collection: 'known', spellIds: ['dnd2024:spell:alarme'] },
      { registry: REGISTRY },
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SPELL_SELECTION_MAX_LEVEL_UNKNOWN');
  });

  test('truque (círculo 0) passa sem depender da tabela de espaços', () => {
    const result = validateSpellSelection(
      makeCharacter({ build: { classRef: MAGO_REF } }),
      { collection: 'known', spellIds: ['dnd2024:spell:luz'] },
      { registry: REGISTRY },
    );
    assert.equal(result.ok, true);
  });

  test('allowCantrips:false recusa truque', () => {
    const result = validateSpellSelection(
      makeCharacter({ build: { classRef: MAGO_REF } }),
      { collection: 'known', spellIds: ['dnd2024:spell:luz'], allowCantrips: false },
      ctx(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SPELL_SELECTION_CANTRIP_NOT_ALLOWED');
  });

  test('ritualOnly (Conjurador Ritualista) só aceita magias com ritual:true', () => {
    const character = makeCharacter({ build: { classRef: MAGO_REF } });
    const ritual = validateSpellSelection(
      character,
      { collection: 'prepared', spellIds: ['dnd2024:spell:alarme'], ritualOnly: true },
      ctx(),
    );
    assert.equal(ritual.ok, true);
    const naoRitual = validateSpellSelection(
      character,
      { collection: 'prepared', spellIds: ['dnd2024:spell:enfeiticar-pessoa'], ritualOnly: true },
      ctx(),
    );
    assert.equal(naoRitual.ok, false);
    assert.equal(naoRitual.error.code, 'SPELL_SELECTION_NOT_RITUAL');
  });

  test('magia inexistente no catálogo é recusada por ID', () => {
    const result = validateSpellSelection(
      makeCharacter({ build: { classRef: MAGO_REF } }),
      { collection: 'known', spellIds: ['dnd2024:spell:nao-existe'] },
      ctx(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SPELL_SELECTION_UNKNOWN_SPELL');
  });
});

describe('domain/spells — validateSpellSelection: atributo de conjuração', () => {
  test('Iniciado em Magia aceita apenas os três atributos permitidos', () => {
    const character = makeCharacter({ build: { classRef: MAGO_REF } });
    const allowedAbilityIds = [
      'dnd2024:ability:inteligencia',
      'dnd2024:ability:sabedoria',
      'dnd2024:ability:carisma',
    ];
    const bom = validateSpellSelection(
      character,
      { collection: 'known', spellIds: [], abilityId: 'dnd2024:ability:sabedoria', allowedAbilityIds },
      ctx(),
    );
    assert.equal(bom.ok, true);
    const ruim = validateSpellSelection(
      character,
      { collection: 'known', spellIds: [], abilityId: 'dnd2024:ability:forca', allowedAbilityIds },
      ctx(),
    );
    assert.equal(ruim.ok, false);
    assert.equal(ruim.error.code, 'SPELL_SELECTION_ABILITY_NOT_ALLOWED');
  });
});

describe('domain/spells — validateSpellSelection: duplicidade por fonte', () => {
  test('a mesma magia repetida dentro da própria seleção é recusada', () => {
    const result = validateSpellSelection(
      makeCharacter({ build: { classRef: MAGO_REF } }),
      { collection: 'known', spellIds: ['dnd2024:spell:luz', 'dnd2024:spell:luz'] },
      ctx(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SPELL_SELECTION_DUPLICATE_SPELL');
  });

  test('repetir uma magia que a MESMA fonte já concedeu é recusado', () => {
    const character = makeCharacter({
      build: { classRef: MAGO_REF },
      state: { spells: { known: [spellEntry('k1', 'dnd2024:spell:luz', 'iniciado#1')] } },
    });
    const result = validateSpellSelection(
      character,
      { collection: 'known', spellIds: ['dnd2024:spell:luz'], sourceInstanceId: 'iniciado#1' },
      ctx(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SPELL_SELECTION_DUPLICATE_FOR_SOURCE');
  });

  test('a mesma magia por OUTRA instância de Iniciado em Magia é aceita', () => {
    const character = makeCharacter({
      build: { classRef: MAGO_REF },
      state: { spells: { known: [spellEntry('k1', 'dnd2024:spell:luz', 'iniciado#1')] } },
    });
    const result = validateSpellSelection(
      character,
      { collection: 'known', spellIds: ['dnd2024:spell:luz'], sourceInstanceId: 'iniciado#2' },
      ctx(),
    );
    assert.equal(result.ok, true);
  });
});

describe('domain/spells — validateSpellSelection: limites e grimório do Mago', () => {
  test('limite explícito conta as magias já presentes da mesma fonte', () => {
    const character = makeCharacter({
      build: { classRef: MAGO_REF },
      state: { spells: { known: [spellEntry('k1', 'dnd2024:spell:luz', null)] } },
    });
    const result = validateSpellSelection(
      character,
      { collection: 'known', spellIds: ['dnd2024:spell:alarme'], limit: 1 },
      ctx(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SPELL_SELECTION_LIMIT_EXCEEDED');
    assert.equal(result.error.context.total, 2);
  });

  test('limite de preparadas vem de context.spellcasting.preparedLimit quando não explícito', () => {
    const character = makeCharacter({ build: { classRef: MAGO_REF } });
    const result = validateSpellSelection(
      character,
      { collection: 'prepared', spellIds: ['dnd2024:spell:alarme', 'dnd2024:spell:enfeiticar-pessoa'] },
      ctx({ slotMaximums: { 1: 2 }, preparedLimit: 1 }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SPELL_SELECTION_LIMIT_EXCEEDED');
    assert.equal(result.error.context.limit, 1);
  });

  test('sem limite conhecido nada é inventado: a seleção passa', () => {
    const result = validateSpellSelection(
      makeCharacter({ build: { classRef: MAGO_REF } }),
      { collection: 'prepared', spellIds: ['dnd2024:spell:alarme', 'dnd2024:spell:enfeiticar-pessoa'] },
      ctx(),
    );
    assert.equal(result.ok, true);
  });

  test('Mago nível 1: seis magias no grimório e quatro preparadas dentro dele', () => {
    // Grimório com seis magias de 1º círculo (o baseline do Mago nível 1:
    // site/js/pages/creator.js só permite preparar o que está no grimório).
    const grimorio = [
      'dnd2024:spell:alarme',
      'dnd2024:spell:enfeiticar-pessoa',
      'dnd2024:spell:luz',
      'dnd2024:spell:bola-de-fogo',
    ];
    const character = makeCharacter({
      build: { classRef: MAGO_REF },
      state: {
        spells: { spellbook: grimorio.map((id, index) => spellEntry(`g${index}`, id, null)) },
      },
    });
    const dentro = validateSpellSelection(
      character,
      {
        collection: 'prepared',
        spellIds: ['dnd2024:spell:alarme', 'dnd2024:spell:enfeiticar-pessoa'],
        preparedFrom: 'spellbook',
        limit: 4,
      },
      ctx(),
    );
    assert.equal(dentro.ok, true);
  });

  test('preparar magia de 1º círculo fora do grimório é recusado', () => {
    const character = makeCharacter({
      build: { classRef: MAGO_REF },
      state: { spells: { spellbook: [spellEntry('g0', 'dnd2024:spell:alarme', null)] } },
    });
    const result = validateSpellSelection(
      character,
      { collection: 'prepared', spellIds: ['dnd2024:spell:enfeiticar-pessoa'], preparedFrom: 'spellbook' },
      ctx(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SPELL_SELECTION_NOT_IN_SPELLBOOK');
  });

  test('truque não precisa estar no grimório (regra do baseline: só círculo >= 1)', () => {
    const character = makeCharacter({
      build: { classRef: MAGO_REF },
      state: { spells: { spellbook: [] } },
    });
    const result = validateSpellSelection(
      character,
      { collection: 'prepared', spellIds: ['dnd2024:spell:luz'], preparedFrom: 'spellbook' },
      ctx(),
    );
    assert.equal(result.ok, true);
  });
});
