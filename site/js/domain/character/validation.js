// Módulo `domain/character/validation`: valida um personagem canônico v2
// contra o schema JSON (fronteira estrutural, ver
// dados/schemas/v1/character-canonical-v2.schema.json) e contra os
// invariantes semânticos que JSON Schema puro não expressa: todo
// `ContentId` do personagem tem uma versão de pacote definida (explícita
// num `ContentRef` ou herdada do namespace via `build.contentScopes`), sem
// namespace ausente/duplicado nem divergência entre uma versão explícita e
// o scope do namespace.

import { createAppError } from '../../core/errors.js';
import { createValidationResult, mergeValidationResults } from '../../core/validation.js';
import { parseContentId } from '../../core/content-id.js';
import { validateCanonicalCharacterV2 } from '../../content/validation.js';
import { visitCharacterContentReferences } from './model.js';

const SCOPE = 'domain.character.validation';

/**
 * Confere que cada namespace usado por uma referência de conteúdo do
 * personagem está declarado (uma única vez, por construção de objeto JS)
 * em `build.contentScopes`, e que uma versão explícita (`ContentRef.
 * packageVersion`) nunca diverge da versão declarada para o namespace.
 * @param {object} character
 * @returns {ReadonlyArray<object>} lista de AppError
 */
function validateContentScopeConsistency(character) {
  const errors = [];
  const contentScopes = character?.build?.contentScopes ?? {};

  const references = visitCharacterContentReferences(character);
  for (const reference of references) {
    const parsed = parseContentId(reference.id);
    if (!parsed.ok) {
      // Formato de ContentId já é responsabilidade do schema; não duplica erro aqui.
      continue;
    }
    const namespace = parsed.value.namespace;
    const scope = contentScopes[namespace];
    if (scope === undefined || typeof scope.packageVersion !== 'string') {
      errors.push(
        createAppError({
          code: 'CHARACTER_CONTENT_SCOPE_MISSING',
          scope: SCOPE,
          message: `A referência "${reference.pointer}" (id "${reference.id}") usa o namespace "${namespace}", que não está declarado em build.contentScopes.`,
          context: { pointer: reference.pointer, id: reference.id, namespace },
        }),
      );
      continue;
    }
    if (reference.packageVersion !== null && reference.packageVersion !== scope.packageVersion) {
      errors.push(
        createAppError({
          code: 'CHARACTER_CONTENT_REFERENCE_CONFLICT',
          scope: SCOPE,
          message: `A referência "${reference.pointer}" (id "${reference.id}") declara packageVersion "${reference.packageVersion}", divergente da versão ativa do namespace "${namespace}" (${scope.packageVersion}).`,
          context: {
            pointer: reference.pointer,
            id: reference.id,
            namespace,
            explicitVersion: reference.packageVersion,
            scopeVersion: scope.packageVersion,
          },
        }),
      );
    }
  }

  return errors;
}

/**
 * Valida um personagem canônico v2: forma estrutural (schema) mais
 * invariantes semânticos de referência de conteúdo. `context` é reservado
 * para uso futuro (ex.: passar o catálogo de conteúdo ativo para validar
 * que toda referência resolve); não altera o resultado hoje.
 * @param {*} character
 * @param {*} [context]
 * @returns {import('../../core/validation.js').ValidationResult}
 */
export function validateCanonicalCharacter(character, context) {
  void context;
  const schemaResult = validateCanonicalCharacterV2(character);
  if (!schemaResult.valid) {
    return schemaResult;
  }
  const scopeErrors = validateContentScopeConsistency(character);
  return mergeValidationResults([schemaResult, createValidationResult({ errors: scopeErrors })]);
}
