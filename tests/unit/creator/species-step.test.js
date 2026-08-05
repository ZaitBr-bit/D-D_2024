// ============================================================
// Passo `especie` (Task 26).
//
// O caso caro aqui é o Draconato: a Herança Dracônica é uma LINHAGEM com
// escolha, cujas opções concedem resistência a dano, e a espécie ainda tem
// traços gated por nível (Voo Dracônico, nível 5). Nada disso é caso especial
// codificado por nome: é `choice` + `grants` + `when` do catálogo, e é assim
// que este passo o trata.
// ============================================================
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { createSpeciesStep } from '../../../site/js/features/creator/steps/species-step.js';
import { activeChoiceEffects, draftLevel, isEffectActiveForLevel } from '../../../site/js/features/creator/steps/catalog-selection-step.js';
import { PLAYER_OWNED_SLICES } from '../../../site/js/features/creator/creator-state.js';
import { clearedSlicesOf } from '../../../site/js/features/creator/creator-invalidation.js';
import { officialRegistry, draftWithCharacter, stepContext, qualifiedPicks } from '../../helpers/creator-steps.js';

const DRACONATO = 'dnd2024:species:draconato';

/** Contagem de traços esperada de cada espécie (oráculo do baseline). */
const TRACOS_ESPERADOS = Object.freeze({
  'dnd2024:species:aasimar': '8 tracos',
  'dnd2024:species:anao': '4 tracos',
  'dnd2024:species:draconato': '5 tracos',
  'dnd2024:species:elfo': '5 tracos',
  'dnd2024:species:gnomo': '5 tracos',
  'dnd2024:species:golias': '9 tracos',
  'dnd2024:species:humano': '3 tracos',
  'dnd2024:species:orc': '3 tracos',
  'dnd2024:species:pequenino': '4 tracos',
  'dnd2024:species:tiferino': '3 tracos',
  'dnd2024:species:kenku': '3 tracos',
});

let registry;
let step;

before(async () => {
  registry = await officialRegistry();
  const created = createSpeciesStep();
  assert.equal(created.ok, true, created.ok ? '' : created.error.code);
  step = created.value;
});

/**
 * @param {number} level
 * @returns {Promise<object>}
 */
async function carregar(level = 1) {
  const draft = draftWithCharacter({ level });
  const loaded = await step.load(stepContext({ stepId: 'especie', draft, registry }));
  assert.equal(loaded.ok, true, loaded.ok ? '' : loaded.error.code);
  return { draft, data: loaded.value };
}

describe('passo especie: carga e cards', () => {
  test('load sem registry falha com erro nomeado', async () => {
    const resultado = await step.load(stepContext({ stepId: 'especie', draft: draftWithCharacter(), registry: null }));
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_STEP_REGISTRY_MISSING');
  });

  test('as ONZE espécies viram card, na ordem do catálogo e com a contagem de traços do baseline', async () => {
    const { data } = await carregar();
    assert.equal(data.cards.length, 11);
    assert.deepEqual(
      data.cards.map((card) => card.id),
      Object.keys(TRACOS_ESPERADOS),
    );
    for (const card of data.cards) {
      assert.deepEqual([...card.details], [TRACOS_ESPERADOS[card.id]], `card de ${card.id}`);
    }
  });
});

describe('passo especie: Draconato — linhagem com escolha e traço gated por nível', () => {
  test('a Herança Dracônica é oferecida como escolha do catálogo, com as dez linhagens', async () => {
    const { data, draft } = await carregar();
    const escolhas = activeChoiceEffects(data.entitiesById[DRACONATO], draftLevel(draft));
    assert.equal(escolhas.length, 1);
    const heranca = escolhas[0].choice;
    assert.equal(heranca.id, 'heranca-draconica');
    assert.equal(heranca.min, 1);
    assert.equal(heranca.max, 1);
    assert.equal(heranca.options.length, 10);
    // Cada opção concede resistência — o passo não precisa saber disso, mas o
    // teste fixa que a mecânica está no CONTEÚDO, não no código.
    for (const option of heranca.options) {
      assert.equal(option.grants[0].type, 'defense');
      assert.equal(option.grants[0].mode, 'resistance');
    }
  });

  test('o Voo Dracônico é gated por nível pelo campo `when`, e o passo respeita isso', async () => {
    const { data } = await carregar();
    const voo = data.entitiesById[DRACONATO].effects.find((effect) => effect.id === 'voo-draconico');
    assert.deepEqual(voo.when, { kind: 'level', min: 5 });
    assert.equal(isEffectActiveForLevel(voo, 1), false);
    assert.equal(isEffectActiveForLevel(voo, 5), true);
    assert.equal(isEffectActiveForLevel(voo, null), false, 'sem nível conhecido nada gated é ativado');
  });

  test('a linhagem é obrigatória para o Draconato; uma espécie sem escolha no catálogo valida direto', async () => {
    const { data } = await carregar();
    // Anão não declara nenhum efeito `choice` — quem decide isso é o catálogo,
    // e o passo simplesmente não tem o que exigir.
    assert.deepEqual(activeChoiceEffects(data.entitiesById['dnd2024:species:anao'], 1), []);
    const semEscolha = draftWithCharacter({
      slices: { speciesSelection: { contentId: 'dnd2024:species:anao', packageVersion: '1.0.0' } },
    });
    const comEscolhaPendente = draftWithCharacter({
      slices: { speciesSelection: { contentId: DRACONATO, packageVersion: '1.0.0' } },
    });
    const comEscolhaFeita = draftWithCharacter({
      slices: {
        speciesSelection: { contentId: DRACONATO, packageVersion: '1.0.0' },
        speciesChoices: qualifiedPicks('species', DRACONATO, { 'heranca-draconica': ['ouro'] }),
      },
    });

    assert.equal(step.validate(stepContext({ stepId: 'especie', draft: semEscolha, data, registry })).valid, true);
    assert.equal(step.validate(stepContext({ stepId: 'especie', draft: comEscolhaPendente, data, registry })).valid, false);
    assert.equal(step.validate(stepContext({ stepId: 'especie', draft: comEscolhaFeita, data, registry })).valid, true);
  });

  test('o `tamanho`, declarado por 4 espécies com o mesmo choiceId, não vaza entre elas', async () => {
    const { data } = await carregar();
    // Humano e Tiferino declaram ambos `tamanho`. Uma escolha feita para o
    // Humano não pode satisfazer a do Tiferino.
    const draft = draftWithCharacter({
      slices: {
        speciesSelection: { contentId: 'dnd2024:species:tiferino', packageVersion: '1.0.0' },
        speciesChoices: qualifiedPicks('species', 'dnd2024:species:humano', { tamanho: ['medio'], habil: ['atletismo'] }),
      },
    });
    const resultado = step.validate(stepContext({ stepId: 'especie', draft, data, registry }));
    assert.equal(resultado.valid, false);
    assert.ok(resultado.errors.some((erro) => erro.choiceId === 'tamanho'));
  });
});

describe('passo especie: invalidate', () => {
  test('invalida SÓ as próprias concessões: nenhum step data e nenhuma fatia de outro passo', async () => {
    const draft = draftWithCharacter({
      slices: { speciesSelection: { contentId: DRACONATO, packageVersion: '1.0.0' } },
      provenance: { speciesSelection: ['source:species:0000:dnd2024-species-draconato'] },
    });
    const patch = step.invalidate(stepContext({ stepId: 'especie', draft, registry }));
    assert.equal(patch.ok, true);
    assert.deepEqual([...patch.value.clearedStepIds], []);
    assert.deepEqual([...patch.value.revokedProvenanceIds], ['source:species:0000:dnd2024-species-draconato']);
    assert.deepEqual([...clearedSlicesOf(patch.value)], ['speciesSelection', 'speciesChoices']);
    for (const slice of PLAYER_OWNED_SLICES) {
      assert.ok(patch.value.preservedSlices.includes(slice));
    }
  });
});
