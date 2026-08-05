// Matriz de invalidação do criador (Task 25).
//
// A matriz é o coração desta task: é ela que decide o que sobrevive a uma
// troca de passo. O teste que mais importa aqui é o negativo — que NENHUM
// passo, em NENHUMA circunstância, apaga os itens e as moedas que o jogador
// acrescentou à mão.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CREATOR_STEP_IDS,
  CREATOR_DRAFT_SLICES,
  PLAYER_OWNED_SLICES,
  createCreatorDraft,
} from '../../../site/js/features/creator/creator-state.js';
import {
  CREATOR_INVALIDATION_MATRIX,
  assertInvalidationMatrixIsTotal,
  buildInvalidationPatch,
  applyInvalidationPatch,
  createInvalidationPatch,
  isInvalidationPatch,
  clearedSlicesOf,
} from '../../../site/js/features/creator/creator-invalidation.js';
import { applyGrantEffects } from '../../../site/js/domain/effects/apply-grants.js';

/**
 * Rascunho de teste com fatias e proveniência preenchidas.
 * @param {object} [overrides]
 * @returns {object}
 */
function rascunho(overrides = {}) {
  const base = {
    character: null,
    slices: Object.fromEntries(CREATOR_DRAFT_SLICES.map((slice) => [slice, `valor:${slice}`])),
    provenance: Object.fromEntries(CREATOR_DRAFT_SLICES.map((slice) => [slice, [`origem:${slice}`]])),
  };
  const result = createCreatorDraft({ ...base, ...overrides });
  assert.equal(result.ok, true);
  return result.value;
}

describe('matriz de invalidação: invariantes estruturais', () => {
  test('classifica TODAS as fatias, sem interseção, para os sete passos', () => {
    assert.doesNotThrow(() => assertInvalidationMatrixIsTotal());
    assert.equal(Object.keys(CREATOR_INVALIDATION_MATRIX).length, 7);
    for (const stepId of CREATOR_STEP_IDS) {
      const entry = CREATOR_INVALIDATION_MATRIX[stepId];
      const todas = new Set([...entry.clearedSlices, ...entry.preservedSlices]);
      assert.equal(todas.size, CREATOR_DRAFT_SLICES.length, `passo ${stepId}: cobertura incompleta`);
      for (const slice of entry.clearedSlices) {
        assert.ok(!entry.preservedSlices.includes(slice), `${stepId}: ${slice} nos dois lados`);
      }
    }
  });

  test('preservedSlices é decisão POSITIVA: nunca vazio, sempre nomeando o que fica', () => {
    for (const stepId of CREATOR_STEP_IDS) {
      assert.ok(
        CREATOR_INVALIDATION_MATRIX[stepId].preservedSlices.length > 0,
        `${stepId} precisa declarar explicitamente o que preserva`,
      );
    }
  });
});

describe('matriz de invalidação: o que cada passo limpa', () => {
  test('classe limpa escolhas/perícias/progressão/recursos e o equipamento+moedas INICIAIS', () => {
    const entry = CREATOR_INVALIDATION_MATRIX.classe;
    for (const slice of [
      'classChoices',
      'classSkills',
      'classResources',
      'progression',
      'startingEquipmentSelection',
      'startingCurrencyGrant',
    ]) {
      assert.ok(entry.clearedSlices.includes(slice), `classe deveria limpar ${slice}`);
    }
    assert.deepEqual([...entry.clearedStepIds], ['atributos', 'equipamento', 'magias']);
  });

  test('classe NUNCA limpa os atributos distribuídos pelo jogador', () => {
    assert.ok(CREATOR_INVALIDATION_MATRIX.classe.preservedSlices.includes('abilityScores'));
  });

  test('espécie invalida só as próprias concessões', () => {
    const entry = CREATOR_INVALIDATION_MATRIX.especie;
    assert.deepEqual([...entry.clearedSlices], ['speciesSelection', 'speciesChoices']);
    assert.deepEqual([...entry.clearedStepIds], []);
  });

  test('antecedente invalida bônus, perícias, ferramenta, talento e equipamento', () => {
    const entry = CREATOR_INVALIDATION_MATRIX.antecedente;
    for (const slice of [
      'backgroundAbilityBonus',
      'backgroundSkills',
      'backgroundToolProficiency',
      'backgroundFeat',
      'backgroundEquipmentSelection',
    ]) {
      assert.ok(entry.clearedSlices.includes(slice), `antecedente deveria limpar ${slice}`);
    }
  });

  test('atributos invalidam os derivados (e nada mais)', () => {
    assert.deepEqual([...CREATOR_INVALIDATION_MATRIX.atributos.clearedSlices], ['derivedStats']);
  });

  test('equipamento e magias invalidam somente a própria proveniência', () => {
    assert.deepEqual(
      [...CREATOR_INVALIDATION_MATRIX.equipamento.clearedSlices],
      ['startingEquipmentSelection', 'startingCurrencyGrant'],
    );
    assert.deepEqual([...CREATOR_INVALIDATION_MATRIX.magias.clearedSlices], ['spellSelection']);
  });

  test('detalhes não invalida nada', () => {
    assert.deepEqual([...CREATOR_INVALIDATION_MATRIX.detalhes.clearedSlices], []);
    assert.deepEqual([...CREATOR_INVALIDATION_MATRIX.detalhes.clearedStepIds], []);
    assert.equal(CREATOR_INVALIDATION_MATRIX.detalhes.preservedSlices.length, CREATOR_DRAFT_SLICES.length);
  });
});

describe('matriz de invalidação: as fatias do JOGADOR são intocáveis', () => {
  test('nenhum dos sete passos lista manualInventoryChanges/walletChanges em clearedSlices', () => {
    for (const stepId of CREATOR_STEP_IDS) {
      for (const slice of PLAYER_OWNED_SLICES) {
        assert.ok(
          !CREATOR_INVALIDATION_MATRIX[stepId].clearedSlices.includes(slice),
          `${stepId} não pode limpar ${slice}`,
        );
        assert.ok(
          CREATOR_INVALIDATION_MATRIX[stepId].preservedSlices.includes(slice),
          `${stepId} precisa preservar ${slice} explicitamente`,
        );
      }
    }
  });

  test('troca COMPLETA de classe preserva itens e moedas manuais do jogador', () => {
    const draft = rascunho({
      slices: {
        classSelection: 'dnd2024:class:barbaro',
        startingEquipmentSelection: 'opcao-a',
        startingCurrencyGrant: { po: 50 },
        manualInventoryChanges: [{ id: 'espada-comprada', quantidade: 1 }],
        walletChanges: { po: 137 },
      },
      provenance: { startingEquipmentSelection: ['classe#barbaro'], startingCurrencyGrant: ['classe#barbaro'] },
    });

    const patch = buildInvalidationPatch('classe', { draft });
    assert.equal(patch.ok, true);
    const applied = applyInvalidationPatch(draft, patch.value);
    assert.equal(applied.ok, true);

    assert.equal(applied.value.draft.slices.startingEquipmentSelection, null);
    assert.equal(applied.value.draft.slices.startingCurrencyGrant, null);
    assert.deepEqual(applied.value.draft.slices.manualInventoryChanges, [{ id: 'espada-comprada', quantidade: 1 }]);
    assert.deepEqual(applied.value.draft.slices.walletChanges, { po: 137 });
  });

  test('TODOS os sete passos preservam as fatias do jogador na aplicação real do patch', () => {
    for (const stepId of CREATOR_STEP_IDS) {
      const draft = rascunho();
      const patch = buildInvalidationPatch(stepId, { draft });
      assert.equal(patch.ok, true, stepId);
      const applied = applyInvalidationPatch(draft, patch.value);
      assert.equal(applied.ok, true, stepId);
      for (const slice of PLAYER_OWNED_SLICES) {
        assert.equal(applied.value.draft.slices[slice], `valor:${slice}`, `${stepId} apagou ${slice}`);
        assert.deepEqual([...applied.value.draft.provenance[slice]], [`origem:${slice}`], `${stepId} apagou proveniência de ${slice}`);
      }
    }
  });
});

describe('matriz de invalidação: proveniência e inverso exato', () => {
  test('revokedProvenanceIds vem da proveniência do rascunho, sem inventar formato', () => {
    const draft = rascunho({
      provenance: {
        classChoices: ['dnd2024:class:mago#instancia-1'],
        progression: ['dnd2024:class:mago#instancia-1', 'dnd2024:class:mago#instancia-2'],
      },
    });
    const patch = buildInvalidationPatch('classe', { draft });
    assert.equal(patch.ok, true);
    assert.deepEqual(
      [...patch.value.revokedProvenanceIds],
      ['dnd2024:class:mago#instancia-1', 'dnd2024:class:mago#instancia-2'],
      'os IDs precisam ser exatamente os sourceInstanceIds registrados, deduplicados',
    );
  });

  test('revogar os IDs do patch é o inverso EXATO de applyGrantEffects', () => {
    const personagemBase = Object.freeze({
      build: { contentScopes: { dnd2024: { packageVersion: '1.0.0' } } },
      state: { spells: { known: [], prepared: [] }, inventory: [], conditions: [], resources: {}, activeEffects: [] },
    });
    const fonte = 'dnd2024:class:mago#instancia-1';
    const efeitos = [
      {
        effect: { type: 'grant-item', item: 'dnd2024:item:cajado' },
        effectInstanceId: 'efeito-1',
        sourceInstanceId: fonte,
        sourceId: 'dnd2024:class:mago',
      },
      {
        effect: { type: 'grant-spell', spell: 'dnd2024:spell:misseis-magicos' },
        effectInstanceId: 'efeito-2',
        sourceInstanceId: fonte,
        sourceId: 'dnd2024:class:mago',
      },
    ];
    const aplicado = applyGrantEffects(personagemBase, efeitos);
    assert.equal(aplicado.ok, true);
    assert.equal(aplicado.value.applied.length, 2);

    // A proveniência do rascunho guarda EXATAMENTE o sourceInstanceId usado.
    const draft = rascunho({
      character: aplicado.value.character,
      provenance: { classChoices: [fonte] },
    });
    const patch = buildInvalidationPatch('classe', { draft });
    assert.equal(patch.ok, true);
    assert.deepEqual([...patch.value.revokedProvenanceIds], [fonte]);

    const revogado = applyInvalidationPatch(draft, patch.value);
    assert.equal(revogado.ok, true);
    assert.deepEqual(
      revogado.value.draft.character.state.inventory,
      personagemBase.state.inventory,
      'o inventário precisa voltar ao estado anterior à concessão',
    );
    assert.deepEqual(revogado.value.draft.character.state.spells.known, personagemBase.state.spells.known);
    assert.equal(revogado.value.removed.length, 2);
  });

  test('proveniência das fatias limpas é zerada; a das preservadas fica intacta', () => {
    const draft = rascunho();
    const patch = buildInvalidationPatch('especie', { draft });
    assert.equal(patch.ok, true);
    const applied = applyInvalidationPatch(draft, patch.value);
    assert.equal(applied.ok, true);
    assert.deepEqual([...applied.value.draft.provenance.speciesChoices], []);
    assert.deepEqual([...applied.value.draft.provenance.classChoices], ['origem:classChoices']);
  });
});

describe('matriz de invalidação: shape pinado do InvalidationPatch', () => {
  test('os sete passos devolvem o MESMO shape, nunca um ad hoc', () => {
    for (const stepId of CREATOR_STEP_IDS) {
      const patch = buildInvalidationPatch(stepId, { draft: rascunho() });
      assert.equal(patch.ok, true, stepId);
      assert.ok(isInvalidationPatch(patch.value), stepId);
      // EXATAMENTE as três chaves do contrato do brief. Uma quarta chave
      // interna (`clearedSlices`) seria a segunda fonte do mesmo fato: um
      // passo escrito a partir do contrato de três chaves passaria na
      // validação e não limparia fatia nenhuma. A limpeza é DERIVADA de
      // `preservedSlices`.
      assert.deepEqual(
        Object.keys(patch.value).sort(),
        ['clearedStepIds', 'preservedSlices', 'revokedProvenanceIds'],
        stepId,
      );
      assert.ok(Object.isFrozen(patch.value), `${stepId}: patch precisa ser congelado`);
      assert.ok(Object.isFrozen(patch.value.clearedStepIds), stepId);
      assert.ok(Object.isFrozen(patch.value.revokedProvenanceIds), stepId);
      assert.ok(Object.isFrozen(patch.value.preservedSlices), stepId);
    }
  });

  test('a limpeza é DERIVADA de preservedSlices, nunca declarada em paralelo', () => {
    const patch = createInvalidationPatch({ preservedSlices: CREATOR_DRAFT_SLICES.filter((s) => s !== 'spellSelection') });
    assert.equal(patch.clearedSlices, undefined, 'não pode existir uma quarta chave');
    assert.deepEqual([...clearedSlicesOf(patch)], ['spellSelection']);

    const draft = rascunho();
    const applied = applyInvalidationPatch(draft, patch);
    assert.equal(applied.ok, true);
    assert.equal(applied.value.draft.slices.spellSelection, null);
    assert.equal(applied.value.draft.slices.classSelection, 'valor:classSelection');
  });

  test('um patch que OMITE as fatias do jogador de preservedSlices é RECUSADO', () => {
    // O caminho perigoso: um passo futuro que devolva o shape de três chaves
    // sem citar `manualInventoryChanges`/`walletChanges` em `preservedSlices`
    // estaria pedindo para apagá-las. A rede de segurança recusa.
    const patch = createInvalidationPatch({ preservedSlices: ['classSelection'] });
    const applied = applyInvalidationPatch(rascunho(), patch);
    assert.equal(applied.ok, false);
    assert.equal(applied.error.code, 'CREATOR_INVALIDATION_PATCH_CLEARS_PLAYER_SLICE');
    assert.deepEqual([...applied.error.context.slices], [...PLAYER_OWNED_SLICES]);
  });

  test('um patch com preservedSlices citando fatia desconhecida é recusado', () => {
    const patch = createInvalidationPatch({ preservedSlices: ['fatiaInventada'] });
    assert.equal(isInvalidationPatch(patch), false);
    const applied = applyInvalidationPatch(rascunho(), patch);
    assert.equal(applied.ok, false);
    assert.equal(applied.error.code, 'CREATOR_INVALIDATION_PATCH_INVALID');
  });

  test('um stepId desconhecido é recusado em vez de virar um patch vazio', () => {
    const patch = buildInvalidationPatch('inexistente', { draft: rascunho() });
    assert.equal(patch.ok, false);
    assert.equal(patch.error.code, 'CREATOR_INVALIDATION_STEP_UNKNOWN');
  });
});
