// ============================================================
// Passo `detalhes` (Task 28).
//
// Os pontos que importam aqui:
//
//   - o TAMANHO só é oferecido quando o catálogo declara opções estruturadas
//     (nenhuma espécie declara hoje), e por isso `details.size` fica `null` —
//     o que a finalização traduz para `identity.size: ""`;
//   - a IMAGEM passa pela porta injetada e pelo sink seguro `resolveSafeUrl`,
//     e uma recusa é ERRO, nunca descarte silencioso;
//   - o `bind` é genuinamente declarativo (garantido por `createCreatorStep`)
//     e usa `change`, não `input`.
// ============================================================
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALIGNMENTS,
  DETAILS_INTENT_TYPES,
  DETAILS_TEXT_FIELDS,
  createDetailsStep,
  describeSizeChoice,
  readDetails,
} from '../../../site/js/features/creator/steps/details-step.js';
import { finalizeCharacter } from '../../../site/js/features/creator/finalize-character.js';
import { clearedSlicesOf } from '../../../site/js/features/creator/creator-invalidation.js';
import { officialRegistry, draftWithCharacter, stepContext } from '../../helpers/creator-steps.js';

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let registry;
let step;

before(async () => {
  registry = await officialRegistry();
  const created = createDetailsStep();
  assert.equal(created.ok, true, created.ok ? '' : created.error.code);
  step = created.value;
});

/**
 * Contexto do passo com a espécie indicada já escolhida.
 * @param {{speciesId?: string|null, details?: object, imageProcessor?: object|null}} [params]
 * @returns {object}
 */
function contexto({ speciesId = null, details = undefined, imageProcessor = null } = {}) {
  const slices = {};
  if (speciesId !== null) {
    slices.speciesSelection = { contentId: speciesId, packageVersion: '1.0.0' };
  }
  if (details !== undefined) {
    slices.details = details;
  }
  const draft = draftWithCharacter({ slices });
  return { ...stepContext({ stepId: 'detalhes', draft, registry }), imageProcessor };
}

describe('passo detalhes: tamanho', () => {
  test('nenhuma espécie do pacote oficial declara escolha estruturada de tamanho', async () => {
    for (const especie of registry.list('species')) {
      const ctx = contexto({ speciesId: especie.id });
      const info = describeSizeChoice(ctx);
      assert.deepEqual([...info.options], [], `"${especie.id}" passou a declarar sizeOptions — a UI precisa oferecer a escolha`);
      assert.equal(typeof info.speciesSize, 'string', `"${especie.id}" precisa declarar um "size"`);
    }
  });

  test('o step data DECLARA a ausência de escolha em vez de escondê-la', async () => {
    const ctx = contexto({ speciesId: 'dnd2024:species:golias' });
    const loaded = await step.load(ctx);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.value.sizeChoiceAvailable, false);
    assert.equal(loaded.value.size.speciesSize, 'medium');
  });

  test('o render mostra o tamanho DERIVADO da espécie, sem gravá-lo no personagem', async () => {
    const ctx = contexto({ speciesId: 'dnd2024:species:pequenino', details: { name: 'Bilbo' } });
    const loaded = await step.load(ctx);
    const markup = step.render({ ...ctx, data: loaded.value });
    assert.match(markup, /data-det-size-derivado="small"/);
    assert.equal(readDetails(ctx.draft).size, null, 'nada de tamanho é escrito na fatia');
  });

  test('um tamanho não oferecido é RECUSADO pelo reduce e pelo validate', async () => {
    const ctx = contexto({ speciesId: 'dnd2024:species:golias', details: { name: 'Kaga' } });
    const recusado = await step.reduce(ctx, { type: DETAILS_INTENT_TYPES.size, size: 'medium' });
    assert.equal(recusado.ok, false);
    assert.equal(recusado.error.code, 'CREATOR_DETAILS_SIZE_NOT_OFFERED');

    const forjado = contexto({ speciesId: 'dnd2024:species:golias', details: { name: 'Kaga', size: 'medium' } });
    const validado = step.validate(forjado);
    assert.equal(validado.valid, false);
    assert.ok(validado.errors.some((entry) => entry.code === 'CREATOR_DETAILS_SIZE_NOT_OFFERED'));
  });

  test('o personagem finalizado a partir deste passo tem identity.size === ""', async () => {
    for (const speciesId of ['dnd2024:species:golias', 'dnd2024:species:pequenino', 'dnd2024:species:gnomo']) {
      const ctx = contexto({ speciesId });
      const reduzido = await step.reduce(ctx, { type: DETAILS_INTENT_TYPES.field, field: 'name', value: 'Nome' });
      assert.equal(reduzido.ok, true, reduzido.ok ? '' : reduzido.error.code);
      const finalizado = finalizeCharacter(reduzido.value.draft, { now: '2026-08-03T00:00:00.000Z' });
      assert.equal(finalizado.ok, true, finalizado.ok ? '' : finalizado.error.code);
      assert.equal(finalizado.value.identity.size, '', `${speciesId} injetou tamanho na finalização`);
    }
  });
});

describe('passo detalhes: campos e validação', () => {
  test('cada campo de texto declarado é escrito na fatia e chega à identidade', async () => {
    let ctx = contexto({});
    for (const entry of DETAILS_TEXT_FIELDS) {
      const reduzido = await step.reduce(ctx, { type: DETAILS_INTENT_TYPES.field, field: entry.field, value: `v-${entry.field}` });
      assert.equal(reduzido.ok, true, reduzido.ok ? '' : reduzido.error.code);
      ctx = { ...ctx, draft: reduzido.value.draft };
    }
    const finalizado = finalizeCharacter(ctx.draft, { now: '2026-08-03T00:00:00.000Z' });
    assert.equal(finalizado.ok, true, finalizado.ok ? '' : finalizado.error.code);
    for (const entry of DETAILS_TEXT_FIELDS) {
      assert.equal(finalizado.value.identity[entry.field], `v-${entry.field}`);
    }
  });

  test('um campo fora da lista fechada é recusado', async () => {
    const recusado = await step.reduce(contexto({}), { type: DETAILS_INTENT_TYPES.field, field: 'id', value: 'hacked' });
    assert.equal(recusado.ok, false);
    assert.equal(recusado.error.code, 'CREATOR_DETAILS_FIELD_UNKNOWN');
  });

  test('alinhamento: só os nove códigos conhecidos', async () => {
    const ok = await step.reduce(contexto({}), { type: DETAILS_INTENT_TYPES.alignment, alignment: 'CB' });
    assert.equal(ok.ok, true);
    assert.equal(readDetails(ok.value.draft).alignment, 'CB');
    const nao = await step.reduce(contexto({}), { type: DETAILS_INTENT_TYPES.alignment, alignment: 'ZZ' });
    assert.equal(nao.ok, false);
    assert.equal(nao.error.code, 'CREATOR_DETAILS_ALIGNMENT_UNKNOWN');
    assert.equal(ALIGNMENTS.length, 9);
  });

  test('sem nome o passo é inválido; com nome é válido', () => {
    assert.equal(step.validate(contexto({})).valid, false);
    assert.equal(step.validate(contexto({ details: { name: 'Thalion' } })).valid, true);
  });

  test('o passo detalhes NÃO invalida fatia nenhuma', () => {
    const patch = step.invalidate(contexto({ details: { name: 'X' } }));
    assert.equal(patch.ok, true);
    assert.deepEqual([...clearedSlicesOf(patch.value)], []);
    assert.deepEqual([...patch.value.clearedStepIds], []);
    assert.deepEqual([...patch.value.revokedProvenanceIds], []);
  });
});

describe('passo detalhes: imagem pela porta injetada', () => {
  test('sem a porta, a intenção falha com erro nomeado (nada de FileReader)', async () => {
    const recusado = await step.reduce(contexto({}), { type: DETAILS_INTENT_TYPES.image, file: {} });
    assert.equal(recusado.ok, false);
    assert.equal(recusado.error.code, 'CREATOR_DETAILS_IMAGE_PROCESSOR_MISSING');
  });

  test('a porta é chamada com o arquivo e a data URL resultante é gravada', async () => {
    const chamadas = [];
    const imageProcessor = {
      /**
       * @param {object} file
       * @returns {Promise<object>}
       */
      async process(file) {
        chamadas.push(file);
        return { ok: true, value: PNG_1X1 };
      },
    };
    const arquivo = { name: 'foto.png' };
    const reduzido = await step.reduce(contexto({ imageProcessor }), { type: DETAILS_INTENT_TYPES.image, file: arquivo });
    assert.equal(reduzido.ok, true, reduzido.ok ? '' : reduzido.error.code);
    assert.deepEqual(chamadas, [arquivo]);
    assert.equal(readDetails(reduzido.value.draft).image, PNG_1X1);
  });

  test('uma data URL que não passa no sink seguro é RECUSADA (SVG não vira imagem de personagem)', async () => {
    const imageProcessor = {
      /** @returns {Promise<object>} */
      async process() {
        return { ok: true, value: 'data:image/svg+xml;base64,PHN2Zy8+' };
      },
    };
    const recusado = await step.reduce(contexto({ imageProcessor }), { type: DETAILS_INTENT_TYPES.image, file: {} });
    assert.equal(recusado.ok, false);
    assert.equal(recusado.error.code, 'CREATOR_DETAILS_IMAGE_REJECTED');
  });

  test('uma porta que falha propaga o erro em vez de gravar imagem vazia', async () => {
    const imageProcessor = {
      /** @returns {Promise<object>} */
      async process() {
        return { ok: false, error: { code: 'IMG_BOOM' } };
      },
    };
    const recusado = await step.reduce(contexto({ imageProcessor }), { type: DETAILS_INTENT_TYPES.image, file: {} });
    assert.equal(recusado.ok, false);
    assert.equal(recusado.error.code, 'IMG_BOOM');
  });

  test('remover a imagem é o inverso exato de adicioná-la', async () => {
    const imageProcessor = {
      /** @returns {Promise<object>} */
      async process() {
        return { ok: true, value: PNG_1X1 };
      },
    };
    const ctx = contexto({ imageProcessor });
    const comImagem = await step.reduce(ctx, { type: DETAILS_INTENT_TYPES.image, file: {} });
    const semImagem = await step.reduce({ ...ctx, draft: comImagem.value.draft }, { type: DETAILS_INTENT_TYPES.removeImage });
    assert.equal(semImagem.ok, true);
    assert.equal(readDetails(semImagem.value.draft).image, '');
  });

  test('uma imagem gravada que não passa no validador BLOQUEIA o passo', () => {
    const validado = step.validate(contexto({ details: { name: 'X', image: 'data:text/html;base64,PHNjcmlwdD4=' } }));
    assert.equal(validado.valid, false);
    assert.ok(validado.errors.some((entry) => entry.code === 'CREATOR_DETAILS_IMAGE_REJECTED'));
  });
});

describe('passo detalhes: binding declarativo', () => {
  test('escuta click e change — nunca input (re-render por tecla destruiria o foco)', () => {
    const binding = step.bind(contexto({}));
    assert.deepEqual([...binding.eventTypes].sort(), ['change', 'click']);
    assert.ok(Object.isFrozen(binding));
  });

  test('change num campo vira intenção de campo; click num alinhamento vira intenção de alinhamento', () => {
    const binding = step.bind(contexto({}));
    /**
     * Alvo mínimo que responde a `closest`.
     * @param {Record<string, string>} attrs
     * @param {string} [value]
     * @returns {object}
     */
    const alvo = (attrs, value = '') => ({
      value,
      /**
       * @param {string} selector
       * @returns {object|null}
       */
      closest(selector) {
        const nome = selector.slice(1, -1);
        return Object.hasOwn(attrs, nome) ? { getAttribute: (key) => attrs[key] ?? null } : null;
      },
    });

    const campo = binding.toIntent({ type: 'change', target: alvo({ 'data-det-field': 'name' }, 'Elowen') });
    assert.equal(campo.intent.type, DETAILS_INTENT_TYPES.field);
    assert.equal(campo.intent.field, 'name');
    assert.equal(campo.intent.value, 'Elowen');

    const alinhamento = binding.toIntent({ type: 'click', target: alvo({ 'data-det-alignment': 'CB' }) });
    assert.equal(alinhamento.intent.type, DETAILS_INTENT_TYPES.alignment);
    assert.equal(alinhamento.intent.alignment, 'CB');

    const nada = binding.toIntent({ type: 'click', target: alvo({}) });
    assert.equal(nada.intent, null);
  });
});
