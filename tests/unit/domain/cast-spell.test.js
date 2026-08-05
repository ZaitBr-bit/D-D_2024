// Testes de `domain/spells/cast-spell.js` (Task 18): o comando `castSpell`.
// Cobre o contrato CommandResult (Task 17), os defaults do request, a
// discriminação explícita entre `state.spells.slots` e `state.spells.pactSlots`
// e a recusa de conjurar sem espaço — nunca decrementando um valor inexistente.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  applySpellGrants,
  castSpell,
  deriveSpellCastSourceInstanceId,
  describeSpellAutomation,
  revokeSpellGrants,
} from '../../../site/js/domain/spells/index.js';
import { executeCharacterCommand } from '../../../site/js/domain/commands/command-dispatcher.js';
import { SPELL_ENTITIES, makeCharacter, makeRegistry, spellEntry } from '../../helpers/spell-fixtures.js';

const REGISTRY = makeRegistry();
const MAGO_REF = Object.freeze({ id: 'dnd2024:class:mago', packageVersion: '1.0.0' });
const BRUXO_REF = Object.freeze({ id: 'dnd2024:class:bruxo', packageVersion: '1.0.0' });

/**
 * Mago com Alarme (1º círculo, ritual) preparado e espaços de 1º/2º círculo.
 * @param {object} [spells] - sobreposição de `state.spells`.
 * @returns {object}
 */
function mago(spells = {}) {
  return makeCharacter({
    build: { classRef: MAGO_REF },
    state: {
      spells: {
        prepared: [
          spellEntry('p1', 'dnd2024:spell:alarme', 'classe'),
          spellEntry('p2', 'dnd2024:spell:enfeiticar-pessoa', 'classe'),
          spellEntry('p3', 'dnd2024:spell:luz', 'classe'),
        ],
        slots: { 1: { used: 0, extra: 0 }, 2: { used: 0, extra: 0 } },
        ...spells,
      },
    },
  });
}

const MAGO_CONTEXT = Object.freeze({
  registry: REGISTRY,
  spellcasting: { slotMaximums: { 1: 2, 2: 1 } },
});

describe('domain/spells — castSpell: forma do request', () => {
  test('request sem slotSource é recusado (slotSource é obrigatório)', () => {
    const character = mago();
    const result = castSpell(character, { spellId: 'dnd2024:spell:alarme', sourceInstanceId: 'classe' }, MAGO_CONTEXT);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CAST_SPELL_SLOT_SOURCE_INVALID');
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
    assert.deepEqual(result.events, []);
  });

  test('slotSource com kind desconhecido é recusado', () => {
    const result = castSpell(
      mago(),
      { spellId: 'dnd2024:spell:alarme', sourceInstanceId: 'classe', slotSource: { kind: 'slot' } },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CAST_SPELL_SLOT_SOURCE_INVALID');
  });

  test('metamagicIds/targets ausentes têm default [] e replaceConcentration default false', () => {
    const result = castSpell(
      mago(),
      { spellId: 'dnd2024:spell:alarme', sourceInstanceId: 'classe', slotSource: { kind: 'spell-slot', level: 1 } },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.events[0].metamagicIds, []);
    assert.deepEqual(result.events[0].targets, []);
    assert.equal(result.events[0].metamagicCost, 0);
  });

  test('sem registry falha explicitamente', () => {
    const result = castSpell(
      mago(),
      { spellId: 'dnd2024:spell:alarme', sourceInstanceId: 'classe', slotSource: { kind: 'at-will' } },
      {},
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CAST_SPELL_REGISTRY_REQUIRED');
  });

  test('sourceInstanceId ausente é recusado (não vira "fonte de classe" por acidente)', () => {
    const result = castSpell(
      mago(),
      { spellId: 'dnd2024:spell:alarme', slotSource: { kind: 'at-will' } },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CAST_SPELL_SOURCE_INVALID');
  });

  test('sourceInstanceId de tipo inválido é recusado', () => {
    const result = castSpell(
      mago(),
      { spellId: 'dnd2024:spell:alarme', sourceInstanceId: 7, slotSource: { kind: 'at-will' } },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CAST_SPELL_SOURCE_INVALID');
  });

  test('magia que o personagem não tem por aquela fonte é recusada', () => {
    const result = castSpell(
      mago(),
      { spellId: 'dnd2024:spell:alarme', sourceInstanceId: 'outra-fonte', slotSource: { kind: 'at-will' } },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CAST_SPELL_NOT_AVAILABLE');
  });
});

describe('domain/spells — castSpell: fonte base/classe (sourceInstanceId null)', () => {
  // Formato DOMINANTE produzido por `infra/character/migrations/v1-to-v2.js:505`:
  // toda magia sem `origem` legada (isto é, a lista de magias de classe
  // inteira de qualquer personagem migrado) chega com `sourceInstanceId: null`.
  /**
   * Mago migrado: uma magia de classe (fonte null) e uma de talento (fonte string).
   * @returns {object}
   */
  function magoMigrado() {
    return makeCharacter({
      build: { classRef: MAGO_REF },
      state: {
        spells: {
          prepared: [
            { instanceId: 'p1', spellRef: { id: 'dnd2024:spell:alarme', packageVersion: '1.0.0' }, customDefinition: { nome: 'Alarme', circulo: 1 }, sourceInstanceId: null },
            spellEntry('p2', 'dnd2024:spell:enfeiticar-pessoa', 'legacy:spell-origin:iniciado-em-magia'),
          ],
          slots: { 1: { used: 0, extra: 0 } },
        },
      },
    });
  }

  test('magia de classe migrada (fonte null) é conjurável com sourceInstanceId: null', () => {
    const result = castSpell(
      magoMigrado(),
      { spellId: 'dnd2024:spell:alarme', sourceInstanceId: null, slotSource: { kind: 'spell-slot', level: 1 } },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.equal(result.character.state.spells.slots['1'].used, 1);
    assert.equal(result.events[0].sourceInstanceId, null);
    assert.equal(result.events[0].collection, 'prepared');
  });

  test('fonte null NÃO casa com uma entrada concedida por talento', () => {
    const result = castSpell(
      magoMigrado(),
      {
        spellId: 'dnd2024:spell:enfeiticar-pessoa',
        sourceInstanceId: null,
        slotSource: { kind: 'spell-slot', level: 1 },
      },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CAST_SPELL_NOT_AVAILABLE');
  });

  test('fonte de talento NÃO casa com uma entrada de fonte null', () => {
    const result = castSpell(
      magoMigrado(),
      {
        spellId: 'dnd2024:spell:alarme',
        sourceInstanceId: 'legacy:spell-origin:iniciado-em-magia',
        slotSource: { kind: 'spell-slot', level: 1 },
      },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CAST_SPELL_NOT_AVAILABLE');
  });

  test('entrada sem a chave sourceInstanceId é tratada como fonte base/classe', () => {
    const character = makeCharacter({
      build: { classRef: MAGO_REF },
      state: {
        spells: {
          prepared: [
            { instanceId: 'p1', spellRef: { id: 'dnd2024:spell:alarme', packageVersion: '1.0.0' }, customDefinition: null },
          ],
          slots: { 1: { used: 0, extra: 0 } },
        },
      },
    });
    const result = castSpell(
      character,
      { spellId: 'dnd2024:spell:alarme', sourceInstanceId: null, slotSource: { kind: 'spell-slot', level: 1 } },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
  });
});

describe('domain/spells — castSpell: espaços de magia comuns', () => {
  test('conjurar consome exatamente um espaço do círculo escolhido', () => {
    const character = mago();
    const result = castSpell(
      character,
      { spellId: 'dnd2024:spell:alarme', sourceInstanceId: 'classe', slotSource: { kind: 'spell-slot', level: 1 } },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, true);
    assert.equal(result.character.state.spells.slots['1'].used, 1);
    assert.equal(result.character.state.spells.slots['2'].used, 0);
    assert.deepEqual(result.affected, ['state.spells.slots']);
    // Original intocado.
    assert.equal(character.state.spells.slots['1'].used, 0);
  });

  test('conjurar em círculo superior é permitido (upcast) e consome o superior', () => {
    const result = castSpell(
      mago(),
      { spellId: 'dnd2024:spell:alarme', sourceInstanceId: 'classe', slotSource: { kind: 'spell-slot', level: 2 } },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, true);
    assert.equal(result.character.state.spells.slots['2'].used, 1);
    assert.equal(result.character.state.spells.slots['1'].used, 0);
  });

  test('espaço de círculo inferior ao da magia é recusado', () => {
    const character = makeCharacter({
      build: { classRef: MAGO_REF },
      state: {
        spells: {
          prepared: [spellEntry('p1', 'dnd2024:spell:bola-de-fogo', 'classe')],
          slots: { 1: { used: 0, extra: 0 } },
        },
      },
    });
    const result = castSpell(
      character,
      { spellId: 'dnd2024:spell:bola-de-fogo', sourceInstanceId: 'classe', slotSource: { kind: 'spell-slot', level: 1 } },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CAST_SPELL_SLOT_LEVEL_TOO_LOW');
  });

  test('círculo sem entrada em state.spells.slots é erro explícito, nunca decremento para negativo', () => {
    const character = mago({ slots: { 1: { used: 0, extra: 0 } } });
    const result = castSpell(
      character,
      { spellId: 'dnd2024:spell:alarme', sourceInstanceId: 'classe', slotSource: { kind: 'spell-slot', level: 2 } },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CAST_SPELL_SLOT_NOT_AVAILABLE');
    assert.equal(result.character, character);
    assert.equal(Object.hasOwn(result.character.state.spells.slots, '2'), false);
  });

  test('espaços esgotados são erro explícito e `used` nunca passa do máximo', () => {
    const character = mago({ slots: { 1: { used: 2, extra: 0 }, 2: { used: 0, extra: 0 } } });
    const result = castSpell(
      character,
      { spellId: 'dnd2024:spell:alarme', sourceInstanceId: 'classe', slotSource: { kind: 'spell-slot', level: 1 } },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CAST_SPELL_SLOT_EXHAUSTED');
    assert.equal(result.character.state.spells.slots['1'].used, 2);
  });

  test('`extra` (Fonte de Magia) aumenta o máximo efetivo do círculo', () => {
    const character = mago({ slots: { 1: { used: 2, extra: 1 }, 2: { used: 0, extra: 0 } } });
    const result = castSpell(
      character,
      { spellId: 'dnd2024:spell:alarme', sourceInstanceId: 'classe', slotSource: { kind: 'spell-slot', level: 1 } },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, true);
    assert.equal(result.character.state.spells.slots['1'].used, 3);
  });

  test('máximo desconhecido (sem tabela) recusa a conjuração em vez de gastar às cegas', () => {
    const result = castSpell(
      mago(),
      { spellId: 'dnd2024:spell:alarme', sourceInstanceId: 'classe', slotSource: { kind: 'spell-slot', level: 1 } },
      { registry: REGISTRY },
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CAST_SPELL_SLOT_MAXIMUM_UNKNOWN');
  });

  test('at-will não consome espaço nenhum', () => {
    const character = mago();
    const result = castSpell(
      character,
      { spellId: 'dnd2024:spell:luz', sourceInstanceId: 'classe', slotSource: { kind: 'at-will' } },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.affected, []);
    assert.equal(result.character.state.spells.slots['1'].used, 0);
  });
});

describe('domain/spells — castSpell: pool separado de Magia de Pacto', () => {
  /**
   * Bruxo com os DOIS pools ao mesmo tempo e níveis numéricos coincidentes.
   * @param {object} [spells]
   * @returns {object}
   */
  function bruxo(spells = {}) {
    return makeCharacter({
      build: { classRef: BRUXO_REF },
      state: {
        spells: {
          prepared: [spellEntry('p1', 'dnd2024:spell:enfeiticar-pessoa', 'classe')],
          slots: { 1: { used: 0, extra: 0 } },
          pactSlots: { used: 0 },
          ...spells,
        },
      },
    });
  }

  const BRUXO_CONTEXT = Object.freeze({
    registry: REGISTRY,
    // Nível numérico do espaço de pacto COINCIDE com o círculo do pool comum.
    spellcasting: { slotMaximums: { 1: 1 }, pactSlots: { maximum: 2, level: 1 } },
  });

  test('pact-slot consome SOMENTE pactSlots, mesmo com nível numérico coincidente', () => {
    const result = castSpell(
      bruxo(),
      {
        spellId: 'dnd2024:spell:enfeiticar-pessoa',
        sourceInstanceId: 'classe',
        slotSource: { kind: 'pact-slot' },
      },
      BRUXO_CONTEXT,
    );
    assert.equal(result.ok, true);
    assert.equal(result.character.state.spells.pactSlots.used, 1);
    assert.equal(result.character.state.spells.slots['1'].used, 0);
    assert.deepEqual(result.affected, ['state.spells.pactSlots', 'state.spells.concentration']);
  });

  test('spell-slot consome SOMENTE slots, nunca o pool de pacto', () => {
    const result = castSpell(
      bruxo(),
      {
        spellId: 'dnd2024:spell:enfeiticar-pessoa',
        sourceInstanceId: 'classe',
        slotSource: { kind: 'spell-slot', level: 1 },
      },
      BRUXO_CONTEXT,
    );
    assert.equal(result.ok, true);
    assert.equal(result.character.state.spells.slots['1'].used, 1);
    assert.equal(result.character.state.spells.pactSlots.used, 0);
  });

  test('pact-slot esgotado não cai no pool comum: erro explícito', () => {
    const character = bruxo({ pactSlots: { used: 2 } });
    const result = castSpell(
      character,
      {
        spellId: 'dnd2024:spell:enfeiticar-pessoa',
        sourceInstanceId: 'classe',
        slotSource: { kind: 'pact-slot' },
      },
      BRUXO_CONTEXT,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CAST_SPELL_PACT_SLOT_EXHAUSTED');
    assert.equal(result.character.state.spells.slots['1'].used, 0);
    assert.equal(result.character.state.spells.pactSlots.used, 2);
  });

  test('magia acima do nível do espaço de pacto é recusada', () => {
    const character = makeCharacter({
      build: { classRef: BRUXO_REF },
      state: {
        spells: {
          prepared: [spellEntry('p1', 'dnd2024:spell:bola-de-fogo', 'classe')],
          pactSlots: { used: 0 },
        },
      },
    });
    const result = castSpell(
      character,
      { spellId: 'dnd2024:spell:bola-de-fogo', sourceInstanceId: 'classe', slotSource: { kind: 'pact-slot' } },
      BRUXO_CONTEXT,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CAST_SPELL_SLOT_LEVEL_TOO_LOW');
  });

  test('máximo de espaços de pacto desconhecido recusa a conjuração', () => {
    const result = castSpell(
      bruxo(),
      {
        spellId: 'dnd2024:spell:enfeiticar-pessoa',
        sourceInstanceId: 'classe',
        slotSource: { kind: 'pact-slot' },
      },
      { registry: REGISTRY },
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CAST_SPELL_PACT_MAXIMUM_UNKNOWN');
  });
});

describe('domain/spells — spell-effects: classificação e simetria apply/revoke', () => {
  test('magia só com efeitos `manual` é classificada como não automatizada', () => {
    const described = describeSpellAutomation(SPELL_ENTITIES['dnd2024:spell:alarme']);
    assert.equal(described.ok, true);
    assert.equal(described.value.automated, false);
    assert.deepEqual(described.value.grants, []);
    assert.equal(described.value.manual.length, 1);
  });

  test('entidade que não é magia é recusada', () => {
    const described = describeSpellAutomation({ id: 'x', type: 'class' });
    assert.equal(described.ok, false);
    assert.equal(described.error.code, 'SPELL_EFFECTS_ENTITY_INVALID');
  });

  test('tipo de efeito desconhecido é erro, nunca ignorado', () => {
    const described = describeSpellAutomation({
      id: 'dnd2024:spell:x',
      type: 'spell',
      effects: [{ id: 'e', type: 'teleporte-magico' }],
    });
    assert.equal(described.ok, false);
    assert.equal(described.error.code, 'SPELL_EFFECTS_TYPE_UNKNOWN');
  });

  test('magia sem concessões não altera o personagem (mesma referência)', () => {
    const character = mago();
    const applied = applySpellGrants(
      character,
      SPELL_ENTITIES['dnd2024:spell:alarme'],
      { sourceInstanceId: 'classe' },
    );
    assert.equal(applied.ok, true);
    assert.equal(applied.value.character, character);
    assert.deepEqual(applied.value.applied, []);
  });

  test('concessão aplicada é revogada exatamente pelo mesmo sourceInstanceId', () => {
    const spellEntity = {
      id: 'dnd2024:spell:convocar-familiar',
      type: 'spell',
      level: 1,
      school: 'conjuration',
      castingTime: 'Ação',
      range: 'Toque',
      components: { verbal: true, somatic: true, material: false },
      duration: 'Instantânea',
      concentration: false,
      ritual: true,
      classes: ['dnd2024:class:mago'],
      effects: [
        { id: 'condicao', type: 'condition', condition: 'dnd2024:condition:enfeiticado' },
        { id: 'descricao', type: 'manual', text: 'Convoca.' },
      ],
    };
    const character = mago();
    const applied = applySpellGrants(character, spellEntity, { sourceInstanceId: 'classe' });
    assert.equal(applied.ok, true, JSON.stringify(applied.error ?? null));
    assert.equal(applied.value.applied.length, 1);
    assert.deepEqual(applied.value.character.state.conditions, ['dnd2024:condition:enfeiticado']);

    const revoked = revokeSpellGrants(applied.value.character, {
      spellId: spellEntity.id,
      sourceInstanceId: 'classe',
    });
    assert.equal(revoked.ok, true, JSON.stringify(revoked.error ?? null));
    assert.deepEqual(revoked.value.character.state.conditions, []);
    assert.deepEqual(revoked.value.character.state.spells, character.state.spells);
  });

  test('fonte base/classe (null) deriva o MESMO id em apply e revoke', () => {
    assert.equal(
      deriveSpellCastSourceInstanceId('dnd2024:spell:alarme', null),
      'spell-cast:base:dnd2024:spell:alarme',
    );
    const spellEntity = {
      id: 'dnd2024:spell:heroismo',
      type: 'spell',
      level: 1,
      school: 'enchantment',
      castingTime: 'Ação',
      range: 'Toque',
      components: { verbal: true, somatic: true, material: false },
      duration: 'Concentração, até 1 minuto',
      concentration: true,
      ritual: false,
      classes: ['dnd2024:class:mago'],
      effects: [{ id: 'condicao', type: 'condition', condition: 'dnd2024:condition:enfeiticado' }],
    };
    const character = mago();
    const applied = applySpellGrants(character, spellEntity, { sourceInstanceId: null });
    assert.equal(applied.ok, true, JSON.stringify(applied.error ?? null));
    assert.deepEqual(applied.value.character.state.conditions, ['dnd2024:condition:enfeiticado']);

    const revoked = revokeSpellGrants(applied.value.character, { spellId: spellEntity.id, sourceInstanceId: null });
    assert.equal(revoked.ok, true, JSON.stringify(revoked.error ?? null));
    assert.deepEqual(revoked.value.character.state.conditions, []);
  });
});

describe('domain/spells — castSpell: registro no dispatcher', () => {
  test('executeCharacterCommand roteia "cast-spell"', () => {
    const result = executeCharacterCommand(
      mago(),
      {
        type: 'cast-spell',
        spellId: 'dnd2024:spell:alarme',
        sourceInstanceId: 'classe',
        slotSource: { kind: 'spell-slot', level: 1 },
      },
      MAGO_CONTEXT,
    );
    assert.equal(result.ok, true);
    assert.equal(result.character.state.spells.slots['1'].used, 1);
    assert.equal(result.events[0].type, 'spell-cast');
    assert.equal(result.events[0].ritual, true);
  });

  test('executeCharacterCommand roteia "set-concentration" e "end-concentration"', () => {
    const started = executeCharacterCommand(mago(), {
      type: 'set-concentration',
      spellId: 'dnd2024:spell:enfeiticar-pessoa',
    });
    assert.equal(started.ok, true);
    assert.equal(started.character.state.spells.concentration, 'dnd2024:spell:enfeiticar-pessoa');
    const ended = executeCharacterCommand(started.character, { type: 'end-concentration' });
    assert.equal(ended.ok, true);
    assert.equal(ended.character.state.spells.concentration, null);
  });
});
