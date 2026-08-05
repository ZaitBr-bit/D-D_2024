// Módulo `core/content-id`: define o `ContentId`, identificador canônico de
// conteúdo de regras no formato `namespace:type:slug`, sempre em ASCII
// minúsculo. Usado para referenciar magias, talentos, classes etc. de forma
// estável entre fontes de conteúdo (livro básico, homebrew, etc.).

import { ok, err } from './result.js';
import { createAppError } from './errors.js';

// Cada segmento aceita letras ASCII minúsculas, dígitos e hífens internos
// (kebab-case), sem começar/terminar com hífen e sem hífens duplicados.
const SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @param {*} segment
 * @returns {boolean}
 */
function isValidSegment(segment) {
  return typeof segment === 'string' && SEGMENT_PATTERN.test(segment);
}

/**
 * Faz o parse de uma string no formato `namespace:type:slug` para um
 * ContentId estruturado. Retorna um Result — nunca lança para entradas
 * inválidas, pois isso é uma falha esperada (conteúdo malformado).
 * @param {*} value
 * @returns {import('./result.js').Result}
 */
export function parseContentId(value) {
  if (typeof value !== 'string') {
    return err(
      createAppError({
        code: 'CONTENT_ID_INVALID_TYPE',
        scope: 'core.content-id',
        message: 'ContentId deve ser uma string.',
        context: { receivedType: typeof value },
      }),
    );
  }

  const parts = value.split(':');
  if (parts.length !== 3) {
    return err(
      createAppError({
        code: 'CONTENT_ID_INVALID_FORMAT',
        scope: 'core.content-id',
        message: 'ContentId deve seguir o formato "namespace:type:slug".',
        context: { value },
      }),
    );
  }

  const [namespace, type, slug] = parts;
  if (!isValidSegment(namespace) || !isValidSegment(type) || !isValidSegment(slug)) {
    return err(
      createAppError({
        code: 'CONTENT_ID_INVALID_SEGMENT',
        scope: 'core.content-id',
        message:
          'Cada segmento do ContentId deve conter apenas ASCII minúsculo, dígitos e hífens internos.',
        context: { value },
      }),
    );
  }

  return ok(Object.freeze({ namespace, type, slug }));
}

/**
 * Monta a string canônica `namespace:type:slug` a partir das partes de um
 * ContentId. Assume que as partes já são válidas (tipicamente originadas de
 * `parseContentId`); receber partes inválidas é considerado um defeito de
 * programação do chamador, por isso lança em vez de retornar Result.
 * @param {{namespace: string, type: string, slug: string}} parts
 * @returns {string}
 */
export function formatContentId({ namespace, type, slug } = {}) {
  if (!isValidSegment(namespace) || !isValidSegment(type) || !isValidSegment(slug)) {
    throw new TypeError(
      'formatContentId: "namespace", "type" e "slug" devem ser segmentos ASCII minúsculos válidos.',
    );
  }
  return `${namespace}:${type}:${slug}`;
}
