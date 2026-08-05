// Módulo `content/source`: define o contrato mínimo de uma `ContentSource`.
//
// Uma fonte concreta (pacote oficial servido por HTTP, pacote em memória nos
// testes, um pacote customizado futuro) deve oferecer exatamente três
// métodos, todos devolvendo `Promise<Result<T, AppError>>`:
//
//   - `loadManifest()`  -> metadados do pacote
//   - `loadIndex()`     -> índice ordenado de entidades
//   - `loadEntity(id)`  -> uma entidade, pelo ContentId declarado no índice
//
// Uma fonte é apenas um provedor de dados: ela NÃO carrega privilégio
// nenhum. Namespace concedido e o token opaco `officialHandlers` vêm sempre
// do composition root, via `registry.registerSource(source, capabilities)`.
// Nada que o manifesto ou as entidades afirmem sobre si mesmos participa
// dessa decisão (ver docs/superpowers/plans, "Global Constraints").

import { createAppError, createAppWarning } from '../core/errors.js';
import { createValidationResult } from '../core/validation.js';

// Os três — e somente os três — métodos do contrato.
const REQUIRED_METHODS = Object.freeze(['loadManifest', 'loadIndex', 'loadEntity']);

const SCOPE = 'content.source';

/**
 * Verifica se `value` implementa o contrato `ContentSource`.
 *
 * Métodos ausentes ou que não são função são erros (a fonte é inutilizável).
 * Métodos extras são apenas aviso: o contrato define o que o registry usa, e
 * rejeitar uma implementação legítima que exponha, por exemplo, um `dispose`
 * não traria ganho de segurança — a fonte é código injetado pelo composition
 * root, não JSON não confiável.
 *
 * @param {*} value
 * @returns {import('../core/validation.js').ValidationResult}
 */
export function assertContentSource(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return createValidationResult({
      errors: [
        createAppError({
          code: 'CONTENT_SOURCE_NOT_OBJECT',
          scope: SCOPE,
          message: 'Uma ContentSource deve ser um objeto com loadManifest, loadIndex e loadEntity.',
          context: { receivedType: Array.isArray(value) ? 'array' : typeof value },
        }),
      ],
    });
  }

  const errors = [];
  for (const method of REQUIRED_METHODS) {
    if (typeof value[method] !== 'function') {
      errors.push(
        createAppError({
          code: 'CONTENT_SOURCE_METHOD_MISSING',
          scope: SCOPE,
          message: `A ContentSource não implementa o método obrigatório "${method}".`,
          context: { method, receivedType: typeof value[method] },
        }),
      );
    }
  }

  const warnings = [];
  for (const key of Object.keys(value)) {
    if (typeof value[key] === 'function' && !REQUIRED_METHODS.includes(key)) {
      warnings.push(
        createAppWarning({
          code: 'CONTENT_SOURCE_UNEXPECTED_METHOD',
          scope: SCOPE,
          message: `A ContentSource expõe o método "${key}", fora dos três métodos do contrato.`,
          context: { method: key, contract: REQUIRED_METHODS },
        }),
      );
    }
  }

  return createValidationResult({ errors, warnings });
}
