// ============================================================
// Passo `classe` (Task 26).
//
// O foco destes casos é o que o passo DECIDE, e por qual campo:
//   - os textos dos cards saem de campo estruturado do catálogo, para as DOZE
//     classes (não uma amostra);
//   - a disponibilidade da subclasse sai do `when` do próprio efeito, não de
//     uma tabela `NIVEL_SUBCLASSE`;
//   - `validate` exige as escolhas que o CATÁLOGO declara obrigatórias;
//   - `invalidate` devolve o patch da matriz oficial, com as fatias do jogador
//     sempre preservadas.
// ============================================================
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { createClassStep } from '../../../site/js/features/creator/steps/class-step.js';
import { activeChoiceEffects, draftLevel } from '../../../site/js/features/creator/steps/catalog-selection-step.js';
import { PLAYER_OWNED_SLICES } from '../../../site/js/features/creator/creator-state.js';
import { clearedSlicesOf } from '../../../site/js/features/creator/creator-invalidation.js';
import { officialRegistry, draftWithCharacter, stepContext, qualifiedPicks } from '../../helpers/creator-steps.js';

/** Textos esperados no card de cada uma das doze classes (oráculo do baseline). */
const CARDS_ESPERADOS = Object.freeze({
  'dnd2024:class:barbaro': ['d12 · Força', 'Marcial'],
  'dnd2024:class:bardo': ['d8 · Carisma', 'Conjurador'],
  'dnd2024:class:bruxo': ['d8 · Carisma', 'Conjurador'],
  'dnd2024:class:clerigo': ['d8 · Sabedoria', 'Conjurador'],
  'dnd2024:class:druida': ['d8 · Sabedoria', 'Conjurador'],
  'dnd2024:class:feiticeiro': ['d6 · Carisma', 'Conjurador'],
  'dnd2024:class:guardiao': ['d10 · Destreza e Sabedoria', 'Conjurador'],
  'dnd2024:class:guerreiro': ['d10 · Força ou Destreza', 'Marcial'],
  'dnd2024:class:ladino': ['d8 · Destreza', 'Marcial'],
  'dnd2024:class:mago': ['d6 · Inteligência', 'Conjurador'],
  'dnd2024:class:monge': ['d8 · Destreza e Sabedoria', 'Marcial'],
  'dnd2024:class:paladino': ['d10 · Força e Carisma', 'Conjurador'],
});

let registry;
let step;

before(async () => {
  registry = await officialRegistry();
  const created = createClassStep();
  assert.equal(created.ok, true, created.ok ? '' : created.error.code);
  step = created.value;
});

/**
 * Carrega o step data com um rascunho de nível `level`.
 * @param {number} level
 * @returns {Promise<object>}
 */
async function carregar(level = 1) {
  const draft = draftWithCharacter({ level });
  const loaded = await step.load(stepContext({ stepId: 'classe', draft, registry }));
  assert.equal(loaded.ok, true, loaded.ok ? '' : loaded.error.code);
  return { draft, data: loaded.value };
}

describe('passo classe: carga e cards', () => {
  test('load FALHA com erro nomeado quando não há registry — nunca devolve lista vazia', async () => {
    const draft = draftWithCharacter();
    const semRegistry = await step.load(stepContext({ stepId: 'classe', draft, registry: null }));
    assert.equal(semRegistry.ok, false);
    assert.equal(semRegistry.error.code, 'CREATOR_STEP_REGISTRY_MISSING');
  });

  test('as DOZE classes viram card, na ordem do catálogo', async () => {
    const { data } = await carregar();
    assert.equal(data.cards.length, 12);
    assert.deepEqual(
      data.cards.map((card) => card.id),
      Object.keys(CARDS_ESPERADOS),
    );
  });

  test('os textos de cada card saem de campo estruturado, para todas as classes', async () => {
    const { data } = await carregar();
    for (const card of data.cards) {
      assert.deepEqual([...card.details], CARDS_ESPERADOS[card.id], `textos do card de ${card.id}`);
    }
  });

  test('"Conjurador"/"Marcial" segue a presença de `spellcasting`, não uma lista de nomes', async () => {
    const { data } = await carregar();
    for (const card of data.cards) {
      const entidade = data.entitiesById[card.id];
      const esperado = entidade.spellcasting === undefined ? 'Marcial' : 'Conjurador';
      assert.equal(card.details[1], esperado, `${card.id} deveria ser ${esperado}`);
    }
  });
});

describe('passo classe: escolhas vêm do catálogo, não de tabela por nome', () => {
  test('a subclasse só é oferecida a partir do nível declarado no `when` do efeito', async () => {
    const nivel1 = await carregar(1);
    const nivel3 = await carregar(3);
    const barbaro1 = activeChoiceEffects(nivel1.data.entitiesById['dnd2024:class:barbaro'], draftLevel(nivel1.draft));
    const barbaro3 = activeChoiceEffects(nivel3.data.entitiesById['dnd2024:class:barbaro'], draftLevel(nivel3.draft));

    assert.equal(
      barbaro1.some((effect) => effect.choice.id === 'subclasse'),
      false,
      'no nível 1 a subclasse não está disponível',
    );
    assert.equal(
      barbaro3.some((effect) => effect.choice.id === 'subclasse'),
      true,
      'no nível 3 a subclasse está disponível',
    );
    // E o nível vem do EFEITO, não de uma constante do passo.
    const subclasse = nivel3.data.entitiesById['dnd2024:class:barbaro'].effects.find((effect) => effect.choice?.id === 'subclasse');
    assert.deepEqual(subclasse.when, { kind: 'level', min: 3 });
  });

  test('sem personagem no rascunho, nenhuma escolha gated por nível é oferecida (não se presume nível 1)', async () => {
    const { data } = await carregar();
    const semPersonagem = { character: null, slices: {}, provenance: {} };
    const ativos = activeChoiceEffects(data.entitiesById['dnd2024:class:barbaro'], draftLevel(semPersonagem));
    assert.equal(draftLevel(semPersonagem), null);
    assert.equal(
      ativos.some((effect) => effect.when !== undefined),
      false,
    );
  });

  test('todas as doze classes declaram as escolhas de perícia e de equipamento no catálogo', async () => {
    const { data, draft } = await carregar(3);
    for (const card of data.cards) {
      const ids = activeChoiceEffects(data.entitiesById[card.id], draftLevel(draft)).map((effect) => effect.choice.id);
      assert.ok(ids.includes('equipamento-inicial'), `${card.id} sem escolha de equipamento inicial`);
      assert.ok(ids.includes('subclasse'), `${card.id} sem escolha de subclasse no nível 3`);
    }
  });
});

describe('passo classe: validate', () => {
  test('sem seleção o passo é inválido, com código nomeado', async () => {
    const { draft, data } = await carregar();
    const resultado = step.validate(stepContext({ stepId: 'classe', draft, data, registry }));
    assert.equal(resultado.valid, false);
    assert.equal(resultado.errors[0].code, 'CREATOR_SELECTION_REQUIRED');
  });

  test('com seleção mas sem as escolhas obrigatórias o passo continua inválido', async () => {
    const { data } = await carregar();
    const draft = draftWithCharacter({
      slices: { classSelection: { contentId: 'dnd2024:class:barbaro', packageVersion: '1.0.0' } },
    });
    const resultado = step.validate(stepContext({ stepId: 'classe', draft, data, registry }));
    assert.equal(resultado.valid, false);
    const codigos = resultado.errors.map((erro) => erro.code);
    assert.ok(codigos.includes('CREATOR_CHOICE_INCOMPLETE'));
  });

  test('com as escolhas do catálogo satisfeitas o passo fica válido', async () => {
    const { data } = await carregar();
    const draft = draftWithCharacter({
      slices: {
        classSelection: { contentId: 'dnd2024:class:barbaro', packageVersion: '1.0.0' },
        classSkills: qualifiedPicks('class', 'dnd2024:class:barbaro', { 'pericias-de-classe': ['atletismo', 'intimidacao'] }),
        classChoices: qualifiedPicks('class', 'dnd2024:class:barbaro', { 'equipamento-inicial': ['opcao-a'] }),
      },
    });
    const resultado = step.validate(stepContext({ stepId: 'classe', draft, data, registry }));
    assert.deepEqual(resultado.errors, []);
    assert.equal(resultado.valid, true);
  });

  test('escolher MENOS perícias do que o catálogo exige mantém o passo inválido', async () => {
    const { data } = await carregar();
    const draft = draftWithCharacter({
      slices: {
        classSelection: { contentId: 'dnd2024:class:barbaro', packageVersion: '1.0.0' },
        classSkills: qualifiedPicks('class', 'dnd2024:class:barbaro', { 'pericias-de-classe': ['atletismo'] }),
        classChoices: qualifiedPicks('class', 'dnd2024:class:barbaro', { 'equipamento-inicial': ['opcao-a'] }),
      },
    });
    const resultado = step.validate(stepContext({ stepId: 'classe', draft, data, registry }));
    assert.equal(resultado.valid, false);
    const erro = resultado.errors.find((entrada) => entrada.choiceId === 'pericias-de-classe');
    assert.equal(erro.required, 2);
    assert.equal(erro.chosen, 1);
  });

  test('escolha feita para OUTRA classe não conta como escolha desta', async () => {
    // O `choiceId` é o mesmo nas 12 classes; a fatia é chaveada pela FONTE.
    // Sem isso, trocar de classe sem reabrir o modal fazia o passo passar por
    // válido com zero perícias de fato concedidas.
    const { data } = await carregar();
    const draft = draftWithCharacter({
      slices: {
        classSelection: { contentId: 'dnd2024:class:mago', packageVersion: '1.0.0' },
        classSkills: qualifiedPicks('class', 'dnd2024:class:barbaro', { 'pericias-de-classe': ['atletismo', 'intimidacao'] }),
        classChoices: qualifiedPicks('class', 'dnd2024:class:barbaro', { 'equipamento-inicial': ['opcao-a'] }),
      },
    });
    const resultado = step.validate(stepContext({ stepId: 'classe', draft, data, registry }));
    assert.equal(resultado.valid, false);
    assert.deepEqual(
      resultado.errors.map((erro) => erro.choiceId).sort(),
      ['equipamento-inicial', 'pericias-de-classe'],
    );
  });
});

describe('passo classe: invalidate', () => {
  test('devolve o patch da matriz oficial e NUNCA limpa fatias do jogador', async () => {
    const draft = draftWithCharacter({
      slices: { classSelection: { contentId: 'dnd2024:class:mago', packageVersion: '1.0.0' } },
      provenance: { classSelection: ['source:class:0000:dnd2024-class-mago'] },
    });
    const patch = step.invalidate(stepContext({ stepId: 'classe', draft, registry }));
    assert.equal(patch.ok, true);
    assert.deepEqual([...patch.value.clearedStepIds], ['atributos', 'equipamento', 'magias']);
    assert.deepEqual([...patch.value.revokedProvenanceIds], ['source:class:0000:dnd2024-class-mago']);
    for (const slice of PLAYER_OWNED_SLICES) {
      assert.ok(patch.value.preservedSlices.includes(slice), `${slice} precisa estar preservada`);
    }
    const limpas = clearedSlicesOf(patch.value);
    for (const slice of PLAYER_OWNED_SLICES) {
      assert.equal(limpas.includes(slice), false);
    }
    assert.ok(limpas.includes('startingEquipmentSelection'));
    assert.ok(limpas.includes('startingCurrencyGrant'));
  });
});
