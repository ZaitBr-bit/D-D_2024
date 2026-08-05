// Módulo `infra/image/character-image-processor`: a porta `imageProcessor` que
// o passo `detalhes` do criador consome (`context.imageProcessor.process(file)`).
//
// ## Por que um adapter, e não a função de utils direto
//
// O passo espera um `Result<string, AppError>` — o mesmo contrato de erro do
// resto do fluxo — e `processarImagemArquivo` (site/js/utils.js) devolve
// `Promise<string|null>`: `null` para "arquivo não é imagem", para "o
// `FileReader` falhou" e para "a imagem não decodificou", todos no mesmo
// valor. Entregar esse `null` ao passo transformaria três falhas distintas
// numa ausência silenciosa.
//
// Este módulo faz UMA coisa: traduz `null` em erro NOMEADO e a data URL em
// `ok(...)`. Nenhuma regra de imagem mora aqui (dimensão máxima, qualidade e
// formato continuam sendo de quem processa), e a validação de segurança da URL
// continua sendo do passo/finalização (`resolveSafeUrl`, `kind:
// 'character-image'`) — este adapter nunca decide que uma imagem é segura.
//
// A função de processamento é INJETADA em vez de importada porque ela vive no
// monólito plano (`utils.js`) e depende de `FileReader`/`canvas`: injetá-la
// mantém este módulo testável sem navegador e mantém a direção de dependência
// de `infra/**` intacta.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';

const SCOPE = 'infra.image.character-image-processor';

/**
 * Cria a porta de processamento de imagem de personagem.
 *
 * @param {{processImageFile: (file: object) => Promise<string|null>}} params
 * @returns {Readonly<{process: (file: object) => Promise<import('../../core/result.js').Result>}>}
 */
export function createCharacterImageProcessor({ processImageFile } = {}) {
  if (typeof processImageFile !== 'function') {
    throw new TypeError('createCharacterImageProcessor: "processImageFile" é obrigatório.');
  }

  return Object.freeze({
    /**
     * Processa o arquivo escolhido pelo jogador e devolve a data URL.
     * @param {object} file - `File` vindo de um `<input type="file">`.
     * @returns {Promise<import('../../core/result.js').Result>} `ok(dataUrl)`
     */
    async process(file) {
      if (file === null || file === undefined) {
        return err(
          createAppError({
            code: 'CHARACTER_IMAGE_FILE_MISSING',
            scope: SCOPE,
            message: 'Nenhum arquivo de imagem foi informado.',
            context: {},
          }),
        );
      }

      let dataUrl;
      try {
        dataUrl = await processImageFile(file);
      } catch (cause) {
        return err(
          createAppError({
            code: 'CHARACTER_IMAGE_PROCESSING_THREW',
            scope: SCOPE,
            message: 'O processamento da imagem lançou uma exceção.',
            context: {},
            cause,
          }),
        );
      }

      if (typeof dataUrl !== 'string' || dataUrl.length === 0) {
        // `null` cobre "não é imagem", "leitura falhou" e "não decodificou".
        // O adapter não tem como distingui-los — mas RECUSAR é honesto, e é o
        // que faz o passo mostrar a falha ao jogador em vez de trocar a imagem
        // por nada.
        return err(
          createAppError({
            code: 'CHARACTER_IMAGE_UNREADABLE',
            scope: SCOPE,
            message: 'O arquivo não pôde ser lido como imagem.',
            context: {},
          }),
        );
      }
      return ok(dataUrl);
    },
  });
}
