// Testes de `domain/spells/concentration.js` e `domain/spells/metamagic.js`
// (Task 18). Concentração: substituição confirmada, ausência de mutação na
// recusa e remoção dos efeitos de concentração anteriores (oráculo
// `command-transitions.json`, caso
// "concentracao-nova-magia-remove-efeitos-da-anterior"). Metamagia: opção
// conhecida, compatibilidade com a magia, custo em Pontos de Feitiçaria e
// pontos disponíveis.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  castSpell,
  endConcentration,
  filtrarEfeitosSemConcentracao,
  setConcentration,
  validateMetamagicUse,
} from '../../../site/js/domain/spells/index.js';
import { SPELL_ENTITIES, makeCharacter, makeRegistry, spellEntry } from '../../helpers/spell-fixtures.js';

const REGISTRY = makeRegistry();
const CONCENTRACAO = 'dnd2024:spell:enfeiticar-pessoa';
const OUTRA_CONCENTRACAO = 'dnd2024:spell:luz';

describe('domain/spells — setConcentration/endConcentration', () => {
  test('inicia concentração quando não há nenhuma', () => {
    const character = makeCharacter();
    const result = setConcentration(character, { spellId: CONCENTRACAO });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.spells.concentration, CONCENTRACAO);
    assert.deepEqual(result.affected, ['state.spells.concentration']);
    assert.equal(character.state.spells.concentration, null);
  });

  test('concentração existente devolve CONCENTRATION_REPLACEMENT_REQUIRED SEM mutação', () => {
    const character = makeCharacter({ state: { spells: { concentration: OUTRA_CONCENTRACAO } } });
    const result = setConcentration(character, { spellId: CONCENTRACAO });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONCENTRATION_REPLACEMENT_REQUIRED');
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
    assert.equal(character.state.spells.concentration, OUTRA_CONCENTRACAO);
  });

  test('somente o request confirmado substitui a concentração', () => {
    const character = makeCharacter({ state: { spells: { concentration: OUTRA_CONCENTRACAO } } });
    const result = setConcentration(character, { spellId: CONCENTRACAO, replaceConcentration: true });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.spells.concentration, CONCENTRACAO);
    assert.equal(result.events[0].previousSpellId, OUTRA_CONCENTRACAO);
  });

  test('reconfirmar a MESMA magia é no-op (sem evento, sem affected)', () => {
    const character = makeCharacter({ state: { spells: { concentration: CONCENTRACAO } } });
    const result = setConcentration(character, { spellId: CONCENTRACAO });
    assert.equal(result.ok, true);
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
    assert.deepEqual(result.events, []);
  });

  test('encerrar sem concentração ativa é erro explícito (simetria com set)', () => {
    const result = endConcentration(makeCharacter(), {});
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONCENTRATION_NOT_ACTIVE');
  });

  test('encerrar limpa a concentração e emite o evento com a magia anterior', () => {
    const character = makeCharacter({ state: { spells: { concentration: CONCENTRACAO } } });
    const result = endConcentration(character, {});
    assert.equal(result.ok, true);
    assert.equal(result.character.state.spells.concentration, null);
    assert.deepEqual(result.events, [{ type: 'concentration-ended', spellId: CONCENTRACAO }]);
  });
});

describe('domain/spells — remoção dos efeitos de concentração anteriores', () => {
  test('state.activeEffects: só os efeitos de concentração caem', () => {
    const character = makeCharacter({
      state: {
        activeEffects: [
          { instanceId: 'a1', sourceInstanceId: null, data: { concentration: false } },
          { instanceId: 'a2', sourceInstanceId: null, data: { concentration: true } },
        ],
      },
    });
    const result = setConcentration(character, { spellId: CONCENTRACAO });
    assert.equal(result.ok, true);
    assert.deepEqual(
      result.character.state.activeEffects.map((entry) => entry.instanceId),
      ['a1'],
    );
    assert.deepEqual(result.affected, ['state.activeEffects', 'state.spells.concentration']);
  });

  test('legacyPassthrough.efeitos_magicos: reproduz o oráculo do baseline', () => {
    // Oráculo: tests/fixtures/expected/command-transitions.json, caso
    // "concentracao-nova-magia-remove-efeitos-da-anterior". Apenas o efeito
    // NÃO-concentração (Armadura Arcana) sobrevive.
    const character = makeCharacter({
      extensions: {
        legacyPassthrough: {
          efeitos_magicos: [
            { nome: 'Armadura Arcana', tipo_efeito: 'base', valor: 13, concentracao: false },
            { nome: 'Bênção', tipo: 'bonus_ataque', concentracao: true },
          ],
        },
      },
    });
    const result = setConcentration(character, { spellId: CONCENTRACAO });
    assert.equal(result.ok, true);
    assert.deepEqual(result.character.extensions.legacyPassthrough.efeitos_magicos, [
      { nome: 'Armadura Arcana', tipo_efeito: 'base', valor: 13, concentracao: false },
    ]);
    assert.ok(result.affected.includes('extensions.legacyPassthrough.efeitos_magicos'));
  });

  test('a primitiva legada `filtrarEfeitosSemConcentracao` é a mesma usada por sheet.js', () => {
    assert.deepEqual(
      filtrarEfeitosSemConcentracao([{ nome: 'A', concentracao: true }, { nome: 'B' }, { nome: 'C', concentracao: false }]),
      [{ nome: 'B' }, { nome: 'C', concentracao: false }],
    );
    assert.deepEqual(filtrarEfeitosSemConcentracao(undefined), []);
  });
});

describe('domain/spells — concentração via castSpell', () => {
  /**
   * Mago com a magia de concentração preparada e um espaço de 1º círculo.
   * @param {object} [state]
   * @returns {object}
   */
  function conjurador(state = {}) {
    return makeCharacter({
      build: { classRef: { id: 'dnd2024:class:mago', packageVersion: '1.0.0' } },
      state: {
        ...state,
        spells: {
          prepared: [
            spellEntry('p1', CONCENTRACAO, 'classe'),
            spellEntry('p2', 'dnd2024:spell:alarme', 'classe'),
          ],
          slots: { 1: { used: 0, extra: 0 } },
          ...(state.spells ?? {}),
        },
      },
    });
  }

  const CONTEXT = Object.freeze({ registry: REGISTRY, spellcasting: { slotMaximums: { 1: 2 } } });

  test('conjurar magia de concentração com outra ativa recusa e NÃO gasta o espaço', () => {
    const character = conjurador({ spells: { concentration: OUTRA_CONCENTRACAO } });
    const result = castSpell(
      character,
      { spellId: CONCENTRACAO, sourceInstanceId: 'classe', slotSource: { kind: 'spell-slot', level: 1 } },
      CONTEXT,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONCENTRATION_REPLACEMENT_REQUIRED');
    assert.equal(result.character, character);
    assert.equal(result.character.state.spells.slots['1'].used, 0);
  });

  test('com replaceConcentration:true o espaço é gasto e a concentração troca', () => {
    const character = conjurador({ spells: { concentration: OUTRA_CONCENTRACAO } });
    const result = castSpell(
      character,
      {
        spellId: CONCENTRACAO,
        sourceInstanceId: 'classe',
        slotSource: { kind: 'spell-slot', level: 1 },
        replaceConcentration: true,
      },
      CONTEXT,
    );
    assert.equal(result.ok, true);
    assert.equal(result.character.state.spells.concentration, CONCENTRACAO);
    assert.equal(result.character.state.spells.slots['1'].used, 1);
  });

  test('magia sem concentração não mexe em state.spells.concentration', () => {
    const character = conjurador({ spells: { concentration: OUTRA_CONCENTRACAO } });
    const result = castSpell(
      character,
      { spellId: 'dnd2024:spell:alarme', sourceInstanceId: 'classe', slotSource: { kind: 'spell-slot', level: 1 } },
      CONTEXT,
    );
    assert.equal(result.ok, true);
    assert.equal(result.character.state.spells.concentration, OUTRA_CONCENTRACAO);
  });
});

describe('domain/spells — validateMetamagicUse', () => {
  const ACELERADA = 'dnd2024:metamagic:magia-acelerada';
  const PERSISTENTE = 'dnd2024:metamagic:magia-persistente';
  const BUSCADORA = 'dnd2024:metamagic:magia-buscadora';
  const POTENCIALIZADA = 'dnd2024:metamagic:magia-potencializada';
  const PONTOS = 'dnd2024:resource:pontos-de-feiticaria';

  const OPTIONS = Object.freeze({
    // Custos e pré-requisitos correspondentes a OPCOES_METAMAGIA
    // (site/js/pages/sheet.js:12311), traduzidos para campos mecânicos.
    [ACELERADA]: { cost: 2, combines: false, requires: [{ kind: 'casting-time', equals: 'Ação' }] },
    [PERSISTENTE]: { cost: 1, combines: false, requires: [{ kind: 'concentration' }] },
    [BUSCADORA]: { cost: 1, combines: true, requires: [] },
    [POTENCIALIZADA]: { cost: 1, combines: true, requires: [] },
  });

  /**
   * Feiticeiro com N Pontos de Feitiçaria em `state.resources`.
   * @param {number} points
   * @returns {object}
   */
  function feiticeiro(points) {
    return makeCharacter({ state: { resources: { [PONTOS]: { current: points, sourceInstanceId: null } } } });
  }

  /**
   * Contexto de metamagia.
   * @param {object} [overrides]
   * @returns {object}
   */
  function metaContext(overrides = {}) {
    return {
      registry: REGISTRY,
      metamagic: {
        knownIds: [ACELERADA, PERSISTENTE, BUSCADORA, POTENCIALIZADA],
        options: OPTIONS,
        pointsResourceId: PONTOS,
        ...overrides,
      },
    };
  }

  test('sem metamagia selecionada o custo é zero e nada é exigido do contexto', () => {
    const result = validateMetamagicUse(feiticeiro(0), { spellEntity: SPELL_ENTITIES[CONCENTRACAO], metamagicIds: [] }, {});
    assert.equal(result.ok, true);
    assert.equal(result.value.totalCost, 0);
  });

  test('pedir metamagia sem context.metamagic falha explicitamente', () => {
    const result = validateMetamagicUse(
      feiticeiro(5),
      { spellEntity: SPELL_ENTITIES[CONCENTRACAO], metamagicIds: [ACELERADA] },
      { registry: REGISTRY },
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'METAMAGIC_CONTEXT_REQUIRED');
  });

  test('opção não conhecida pelo personagem é recusada', () => {
    const result = validateMetamagicUse(
      feiticeiro(5),
      { spellEntity: SPELL_ENTITIES[CONCENTRACAO], metamagicIds: [ACELERADA] },
      metaContext({ knownIds: [PERSISTENTE] }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'METAMAGIC_NOT_KNOWN');
  });

  test('opção conhecida sem descritor mecânico é recusada (nunca custo presumido)', () => {
    const result = validateMetamagicUse(
      feiticeiro(5),
      { spellEntity: SPELL_ENTITIES[CONCENTRACAO], metamagicIds: [ACELERADA] },
      metaContext({ options: {} }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'METAMAGIC_OPTION_UNKNOWN');
  });

  test('compatibilidade: Magia Persistente exige magia de concentração', () => {
    const compativel = validateMetamagicUse(
      feiticeiro(5),
      { spellEntity: SPELL_ENTITIES[CONCENTRACAO], metamagicIds: [PERSISTENTE] },
      metaContext(),
    );
    assert.equal(compativel.ok, true);
    assert.equal(compativel.value.totalCost, 1);

    const incompativel = validateMetamagicUse(
      feiticeiro(5),
      { spellEntity: SPELL_ENTITIES['dnd2024:spell:alarme'], metamagicIds: [PERSISTENTE] },
      metaContext(),
    );
    assert.equal(incompativel.ok, false);
    assert.equal(incompativel.error.code, 'METAMAGIC_INCOMPATIBLE');
  });

  test('compatibilidade: Magia Acelerada exige tempo de conjuração "Ação"', () => {
    const naoAcao = validateMetamagicUse(
      feiticeiro(5),
      { spellEntity: SPELL_ENTITIES['dnd2024:spell:alarme'], metamagicIds: [ACELERADA] },
      metaContext(),
    );
    assert.equal(naoAcao.ok, false);
    assert.equal(naoAcao.error.code, 'METAMAGIC_INCOMPATIBLE');
  });

  test('pré-requisito de "kind" desconhecido é ERRO, nunca requisito satisfeito', () => {
    const result = validateMetamagicUse(
      feiticeiro(5),
      { spellEntity: SPELL_ENTITIES[CONCENTRACAO], metamagicIds: [ACELERADA] },
      metaContext({ options: { [ACELERADA]: { cost: 2, requires: [{ kind: 'duracao-longa' }] } } }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'METAMAGIC_REQUIREMENT_UNKNOWN');
  });

  test('pontos insuficientes são recusados com o saldo no contexto do erro', () => {
    const result = validateMetamagicUse(
      feiticeiro(1),
      { spellEntity: SPELL_ENTITIES[CONCENTRACAO], metamagicIds: [ACELERADA] },
      metaContext(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'METAMAGIC_POINTS_INSUFFICIENT');
    assert.equal(result.error.context.available, 1);
    assert.equal(result.error.context.totalCost, 2);
  });

  test('recurso de pontos ausente é erro explícito, nunca "current" inventado', () => {
    const result = validateMetamagicUse(
      makeCharacter(),
      { spellEntity: SPELL_ENTITIES[CONCENTRACAO], metamagicIds: [PERSISTENTE] },
      metaContext(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'METAMAGIC_POINTS_RESOURCE_MISSING');
  });

  test('limite de uma opção por conjuração (regra base)', () => {
    const result = validateMetamagicUse(
      feiticeiro(5),
      { spellEntity: SPELL_ENTITIES[CONCENTRACAO], metamagicIds: [PERSISTENTE, ACELERADA] },
      metaContext(),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'METAMAGIC_TOO_MANY');
  });

  test('duas opções combináveis (Buscadora + Potencializada) passam do limite base', () => {
    const result = validateMetamagicUse(
      feiticeiro(5),
      { spellEntity: SPELL_ENTITIES[CONCENTRACAO], metamagicIds: [BUSCADORA, POTENCIALIZADA] },
      metaContext(),
    );
    assert.equal(result.ok, true);
    assert.equal(result.value.totalCost, 2);
  });

  test('Feitiçaria Encarnada (maxPerCast:2) permite duas opções não combináveis', () => {
    const result = validateMetamagicUse(
      feiticeiro(5),
      { spellEntity: SPELL_ENTITIES[CONCENTRACAO], metamagicIds: [PERSISTENTE, BUSCADORA] },
      metaContext({ maxPerCast: 2 }),
    );
    assert.equal(result.ok, true);
    assert.equal(result.value.totalCost, 2);
  });

  test('Apoteose Arcana (freeUses:1) zera o custo da primeira opção', () => {
    const result = validateMetamagicUse(
      feiticeiro(0),
      { spellEntity: SPELL_ENTITIES[CONCENTRACAO], metamagicIds: [PERSISTENTE] },
      metaContext({ freeUses: 1 }),
    );
    assert.equal(result.ok, true);
    assert.equal(result.value.totalCost, 0);
    assert.equal(result.value.freeApplied, 1);
  });

  test('a mesma opção duas vezes é recusada', () => {
    const result = validateMetamagicUse(
      feiticeiro(5),
      { spellEntity: SPELL_ENTITIES[CONCENTRACAO], metamagicIds: [BUSCADORA, BUSCADORA] },
      metaContext({ maxPerCast: 2 }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'METAMAGIC_DUPLICATE');
  });

  test('castSpell debita os Pontos de Feitiçaria e registra em affected', () => {
    const character = makeCharacter({
      build: { classRef: { id: 'dnd2024:class:feiticeiro', packageVersion: '1.0.0' } },
      state: {
        resources: { [PONTOS]: { current: 5, sourceInstanceId: null } },
        spells: {
          prepared: [spellEntry('p1', CONCENTRACAO, 'classe')],
          slots: { 1: { used: 0, extra: 0 } },
        },
      },
    });
    const result = castSpell(
      character,
      {
        spellId: CONCENTRACAO,
        sourceInstanceId: 'classe',
        slotSource: { kind: 'spell-slot', level: 1 },
        metamagicIds: [PERSISTENTE],
      },
      { ...metaContext(), spellcasting: { slotMaximums: { 1: 2 } } },
    );
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources[PONTOS].current, 4);
    assert.deepEqual(result.affected, [
      'state.spells.slots',
      'state.resources',
      'state.spells.concentration',
    ]);
    assert.equal(result.events[0].metamagicCost, 1);
    // Recusa não debita nada.
    const semPontos = castSpell(
      makeCharacter({
        build: { classRef: { id: 'dnd2024:class:feiticeiro', packageVersion: '1.0.0' } },
        state: {
          resources: { [PONTOS]: { current: 0, sourceInstanceId: null } },
          spells: { prepared: [spellEntry('p1', CONCENTRACAO, 'classe')], slots: { 1: { used: 0, extra: 0 } } },
        },
      }),
      {
        spellId: CONCENTRACAO,
        sourceInstanceId: 'classe',
        slotSource: { kind: 'spell-slot', level: 1 },
        metamagicIds: [PERSISTENTE],
      },
      { ...metaContext(), spellcasting: { slotMaximums: { 1: 2 } } },
    );
    assert.equal(semPontos.ok, false);
    assert.equal(semPontos.error.code, 'METAMAGIC_POINTS_INSUFFICIENT');
    assert.equal(semPontos.character.state.spells.slots['1'].used, 0);
  });
});
