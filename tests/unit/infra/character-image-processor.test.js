// Adapter `infra/image/character-image-processor` (Task 28b): traduz o
// `Promise<string|null>` de `processarImagemArquivo` no `Result` que o passo
// `detalhes` do criador consome.
//
// O caso que justifica o módulo é o `null`: sem tradução, "arquivo não é
// imagem", "leitura falhou" e "não decodificou" chegariam ao passo como a
// mesma ausência silenciosa, e a imagem simplesmente não apareceria sem que
// ninguém dissesse por quê.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createCharacterImageProcessor } from '../../../site/js/infra/image/character-image-processor.js';

const ARQUIVO = { name: 'retrato.png', type: 'image/png' };
const DATA_URL = 'data:image/jpeg;base64,AAAA';

describe('createCharacterImageProcessor', () => {
  test('exige a função de processamento (nunca inventa uma)', () => {
    assert.throws(() => createCharacterImageProcessor(), TypeError);
    assert.throws(() => createCharacterImageProcessor({ processImageFile: null }), TypeError);
  });

  test('devolve ok(dataUrl) quando o processamento produz uma data URL', async () => {
    const processor = createCharacterImageProcessor({ processImageFile: async () => DATA_URL });
    const resultado = await processor.process(ARQUIVO);
    assert.equal(resultado.ok, true);
    assert.equal(resultado.value, DATA_URL);
  });

  test('repassa o arquivo INTACTO para o processador', async () => {
    const recebidos = [];
    const processor = createCharacterImageProcessor({
      /**
       * @param {object} file
       * @returns {Promise<string>}
       */
      processImageFile: async (file) => {
        recebidos.push(file);
        return DATA_URL;
      },
    });
    await processor.process(ARQUIVO);
    assert.deepEqual(recebidos, [ARQUIVO]);
    assert.equal(recebidos[0], ARQUIVO, 'o mesmo objeto, não uma cópia');
  });

  test('`null` vira RECUSA nomeada, não ausência silenciosa', async () => {
    const processor = createCharacterImageProcessor({ processImageFile: async () => null });
    const resultado = await processor.process(ARQUIVO);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CHARACTER_IMAGE_UNREADABLE');
  });

  test('string vazia também é recusa (uma data URL vazia não é imagem)', async () => {
    const processor = createCharacterImageProcessor({ processImageFile: async () => '' });
    const resultado = await processor.process(ARQUIVO);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CHARACTER_IMAGE_UNREADABLE');
  });

  test('arquivo ausente é recusado ANTES de chamar o processador', async () => {
    let chamadas = 0;
    const processor = createCharacterImageProcessor({
      /** @returns {Promise<string>} */
      processImageFile: async () => {
        chamadas += 1;
        return DATA_URL;
      },
    });
    for (const entrada of [null, undefined]) {
      const resultado = await processor.process(entrada);
      assert.equal(resultado.ok, false);
      assert.equal(resultado.error.code, 'CHARACTER_IMAGE_FILE_MISSING');
    }
    assert.equal(chamadas, 0);
  });

  test('exceção do processador vira Result de erro (nunca escapa para o passo)', async () => {
    const causa = new Error('canvas indisponível');
    const processor = createCharacterImageProcessor({
      /** @returns {Promise<string>} */
      processImageFile: async () => {
        throw causa;
      },
    });
    const resultado = await processor.process(ARQUIVO);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CHARACTER_IMAGE_PROCESSING_THREW');
    assert.equal(resultado.error.cause, causa);
  });
});
