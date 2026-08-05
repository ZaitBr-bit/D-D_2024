// ============================================================
// `finalizeCharacter` (Task 28).
//
// Dois eixos:
//
//   1. PUREZA/IDEMPOTÊNCIA — a entrada pode chegar congelada, não é mutada, e
//      duas chamadas com a mesma entrada produzem objetos em deep equality.
//   2. `identity.size` — um personagem finalizado SEM escolha explícita de
//      tamanho sai com `""`, NUNCA `"medium"`. É a mesma classe do defeito
//      Critical da Task 13 (default hardcoded plausível numa migração), e o
//      ponto de reincidência mais provável é justamente aqui: o personagem do
//      rascunho vem de `createEmptyCharacter`, que nasce com
//      `identity.size: 'medium'`.
// ============================================================
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  UNCHOSEN_SIZE,
  finalizeCharacter,
  resolveFinalizedSize,
} from '../../../site/js/features/creator/finalize-character.js';
import { createCreatorDraft, deepFreezeValue } from '../../../site/js/features/creator/creator-state.js';
import { getMovement } from '../../../site/js/domain/character/queries/index.js';
import { officialRegistry, emptyCharacter } from '../../helpers/creator-steps.js';

const NOW = '2026-08-03T12:00:00.000Z';

// PNG 1x1 real (magic bytes corretos) — o validador de `resolveSafeUrl` só
// aceita data URL com assinatura coerente com o MIME declarado.
const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let registry;

before(async () => {
  registry = await officialRegistry();
});

/**
 * Rascunho pronto para finalizar, com a fatia `details` informada.
 * @param {object} [details]
 * @param {object} [extraCharacter] - campos a sobrepor no personagem.
 * @returns {object} draft congelado
 */
function draftPronto(details = { name: 'Thalion' }, extraCharacter = {}) {
  const base = emptyCharacter({ id: 'test-test-test' });
  const character = { ...base, ...extraCharacter };
  const created = createCreatorDraft({ character, slices: { details } });
  assert.equal(created.ok, true);
  // CONGELAMENTO PROFUNDO da entrada: se `finalizeCharacter` tentar mutar
  // qualquer coisa do rascunho, o teste explode em vez de passar em silêncio.
  return deepFreezeValue(created.value);
}

describe('finalizeCharacter: identity.size nunca é "medium"', () => {
  test('a ORIGEM não inventa tamanho: createEmptyCharacter nasce com ""', () => {
    // Guarda da correção de C5. `createEmptyCharacter` carregava
    // `size: 'medium'` — o mesmo literal que a Task 13 já teve de arrancar de
    // `migrations/v1-to-v2.js`, onde corrompia o `tamanho` persistido. A
    // origem agora nasce vazia, e este caso impede a terceira recaída.
    const draft = draftPronto({ name: 'Thalion' });
    assert.equal(draft.character.identity.size, '', 'createEmptyCharacter voltou a chutar um tamanho');
    assert.notEqual(draft.character.identity.size, 'medium');

    const finalizado = finalizeCharacter(draft, { now: NOW });
    assert.equal(finalizado.ok, true, finalizado.ok ? '' : finalizado.error.code);
    assert.equal(finalizado.value.identity.size, '');
    assert.equal(finalizado.value.identity.size, UNCHOSEN_SIZE);
  });

  test('a NORMALIZAÇÃO é real: um personagem que JÁ carregue "medium" finaliza com ""', () => {
    // Defesa em profundidade, e é o que impede o caso acima de virar
    // tautologia: com a origem corrigida, um teste que só olhasse o caminho
    // feliz passaria mesmo se `finalizeCharacter` deixasse de normalizar.
    // Aqui a entrada carrega o valor errado de propósito — como carregaria um
    // rascunho vindo de um registro legado ou de outro construtor.
    const base = emptyCharacter({ id: 'test-test-test' });
    const draft = draftPronto({ name: 'Thalion' }, { identity: { ...base.identity, size: 'medium' } });
    assert.equal(draft.character.identity.size, 'medium', 'a entrada precisa carregar o valor errado');

    const finalizado = finalizeCharacter(draft, { now: NOW });
    assert.equal(finalizado.ok, true, finalizado.ok ? '' : finalizado.error.code);
    assert.equal(finalizado.value.identity.size, '', 'a finalização precisa normalizar, não herdar');
  });

  test('a constante de "não escolhido" é a string vazia', () => {
    assert.equal(UNCHOSEN_SIZE, '');
    assert.equal(resolveFinalizedSize({}), '');
    assert.equal(resolveFinalizedSize({ size: null }), '');
    assert.equal(resolveFinalizedSize({ size: '' }), '');
    assert.equal(resolveFinalizedSize({ size: 'small' }), 'small');
  });

  for (const [rotulo, speciesId, esperado] of [
    ['Golias', 'dnd2024:species:golias', 'medium'],
    ['Pequenino (Halfling)', 'dnd2024:species:pequenino', 'small'],
    ['Gnomo', 'dnd2024:species:gnomo', 'small'],
  ]) {
    test(`${rotulo}: identity.size finalizado continua "", e o tamanho vem da PROJEÇÃO da espécie`, () => {
      const base = emptyCharacter({ id: 'test-test-test' });
      const draft = draftPronto(
        { name: rotulo },
        {
          build: { ...base.build, speciesRef: { id: speciesId, packageVersion: '1.0.0' } },
        },
      );

      const finalizado = finalizeCharacter(draft, { now: NOW });
      assert.equal(finalizado.ok, true, finalizado.ok ? '' : finalizado.error.code);
      // O personagem NÃO carrega tamanho nenhum congelado.
      assert.equal(finalizado.value.identity.size, '');

      // E o tamanho EXIBIDO é derivado da espécie (Task 16), não do personagem.
      const movimento = getMovement(finalizado.value, { registry });
      assert.equal(movimento.ok, true, movimento.ok ? '' : movimento.error.code);
      assert.equal(movimento.value.sizeSlug, esperado);
    });
  }

  test('uma escolha EXPLÍCITA de tamanho é respeitada', () => {
    const finalizado = finalizeCharacter(draftPronto({ name: 'Anão', size: 'small' }), { now: NOW });
    assert.equal(finalizado.ok, true);
    assert.equal(finalizado.value.identity.size, 'small');
  });
});

describe('finalizeCharacter: pureza e idempotência', () => {
  test('não muta a entrada congelada e devolve resultados em deep equality', () => {
    const draft = draftPronto({ name: 'Elowen', alignment: 'NB', backstory: 'História.' });
    const antes = JSON.parse(JSON.stringify(draft));

    const primeiro = finalizeCharacter(draft, { now: NOW });
    const segundo = finalizeCharacter(draft, { now: NOW });
    assert.equal(primeiro.ok, true);
    assert.equal(segundo.ok, true);

    assert.deepEqual(primeiro.value, segundo.value);
    // Objetos DIFERENTES com o mesmo conteúdo: nenhuma memoização escondida.
    assert.notEqual(primeiro.value, segundo.value);
    // A entrada continua exatamente como era.
    assert.deepEqual(JSON.parse(JSON.stringify(draft)), antes);
  });

  test('re-finalizar o resultado é estável (idempotente)', () => {
    const draft = draftPronto({ name: 'Elowen' });
    const primeiro = finalizeCharacter(draft, { now: NOW });
    const redraft = createCreatorDraft({ character: primeiro.value, slices: { details: { name: 'Elowen' } } });
    const segundo = finalizeCharacter(deepFreezeValue(redraft.value), { now: NOW });
    assert.equal(segundo.ok, true);
    assert.deepEqual(segundo.value.identity, primeiro.value.identity);
    assert.equal(segundo.value.metadata.createdAt, primeiro.value.metadata.createdAt);
  });

  test('não lê relógio próprio: sem context.now falha com erro nomeado', () => {
    const resultado = finalizeCharacter(draftPronto(), {});
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_FINALIZE_NOW_REQUIRED');
  });

  test('createdAt existente é preservado; updatedAt é sempre o "now" recebido', () => {
    const base = emptyCharacter({ id: 'test-test-test' });
    const draft = draftPronto(
      { name: 'Elowen' },
      { metadata: { ...base.metadata, createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' } },
    );
    const finalizado = finalizeCharacter(draft, { now: NOW });
    assert.equal(finalizado.value.metadata.createdAt, '2020-01-01T00:00:00.000Z');
    assert.equal(finalizado.value.metadata.updatedAt, NOW);
  });
});

describe('finalizeCharacter: campos pessoais', () => {
  test('todos os campos de identidade saem do passo detalhes', () => {
    const details = {
      name: '  Elowen Grimório  ',
      alignment: 'CB',
      appearance: 'Alta.',
      personality: 'Curiosa.',
      ideals: 'Conhecimento.',
      bonds: 'A torre.',
      flaws: 'Impaciente.',
      backstory: 'Nasceu longe.',
      notes: 'Anotações.',
    };
    const finalizado = finalizeCharacter(draftPronto(details), { now: NOW });
    assert.equal(finalizado.ok, true);
    const identity = finalizado.value.identity;
    assert.equal(identity.name, 'Elowen Grimório', 'o nome é aparado');
    assert.equal(identity.alignment, 'CB');
    assert.equal(identity.appearance, 'Alta.');
    assert.equal(identity.personality, 'Curiosa.');
    assert.equal(identity.ideals, 'Conhecimento.');
    assert.equal(identity.bonds, 'A torre.');
    assert.equal(identity.flaws, 'Impaciente.');
    assert.equal(identity.backstory, 'Nasceu longe.');
    assert.equal(identity.notes, 'Anotações.');
    assert.equal(identity.id, 'test-test-test', 'o id nunca vem do formulário');
  });

  test('sem nome, a finalização FALHA (não inventa um nome)', () => {
    const resultado = finalizeCharacter(draftPronto({ name: '   ' }), { now: NOW });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_FINALIZE_NAME_REQUIRED');
  });

  test('imagem válida atravessa o sink seguro; imagem inválida é RECUSADA, nunca descartada em silêncio', () => {
    const comImagem = finalizeCharacter(draftPronto({ name: 'Elowen', image: PNG_1X1 }), { now: NOW });
    assert.equal(comImagem.ok, true, comImagem.ok ? '' : comImagem.error.code);
    assert.equal(comImagem.value.identity.image, PNG_1X1);

    const hostil = finalizeCharacter(
      draftPronto({ name: 'Elowen', image: 'data:image/svg+xml;base64,PHN2Zy8+' }),
      { now: NOW },
    );
    assert.equal(hostil.ok, false);
    assert.equal(hostil.error.code, 'CREATOR_FINALIZE_IMAGE_REJECTED');

    const semImagem = finalizeCharacter(draftPronto({ name: 'Elowen' }), { now: NOW });
    assert.equal(semImagem.ok, true);
    assert.equal(semImagem.value.identity.image, '');
  });
});

describe('finalizeCharacter: guardas de entrada', () => {
  test('rascunho sem personagem canônico falha com erro nomeado', () => {
    const vazio = createCreatorDraft({ slices: { details: { name: 'X' } } });
    const resultado = finalizeCharacter(vazio.value, { now: NOW });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_FINALIZE_CHARACTER_INVALID');
  });

  test('entrada não-objeto falha com erro nomeado', () => {
    assert.equal(finalizeCharacter(null, { now: NOW }).error.code, 'CREATOR_FINALIZE_DRAFT_INVALID');
  });
});
