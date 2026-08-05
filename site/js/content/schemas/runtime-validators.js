// Módulo `content/schemas/runtime-validators`: wrapper fino sobre as funções
// de validação compiladas em `generated-validators.js` (saída do Ajv
// standalone). Converte os erros no formato do Ajv para `AppError`
// (site/js/core/errors.js) e agrega tudo em um `ValidationResult`
// determinístico (site/js/core/validation.js) — mesma ordem de erro sempre
// para a mesma entrada, e sempre com o JSON Pointer (`instancePath`) do Ajv
// preservado no `context` de cada erro.
//
// Este módulo não sabe nada sobre qual schema corresponde a qual conceito de
// domínio (manifest, entidade, efeito...) — isso é responsabilidade de
// `content/validation.js`, que é quem decide qual chave de
// `generated-validators.js` chamar para cada caso de uso público.

import * as generatedValidators from './generated-validators.js';
import { createAppError } from '../../core/errors.js';
import { createValidationResult } from '../../core/validation.js';

/**
 * Compara dois erros do Ajv já convertidos para ordenação determinística:
 * primeiro por `instancePath` (JSON Pointer do valor), depois por
 * `keyword`, depois por `message` — desempate estável para que a mesma
 * entrada inválida sempre produza a mesma lista de erros, na mesma ordem,
 * independente da ordem interna de avaliação do Ajv (que pode variar entre
 * ramos de `oneOf`/`allOf`).
 * @param {{instancePath: string, keyword: string, message: string}} a
 * @param {{instancePath: string, keyword: string, message: string}} b
 * @returns {number}
 */
function compareAjvErrorsDeterministically(a, b) {
  if (a.instancePath !== b.instancePath) {
    return a.instancePath < b.instancePath ? -1 : 1;
  }
  if (a.keyword !== b.keyword) {
    return a.keyword < b.keyword ? -1 : 1;
  }
  if (a.message !== b.message) {
    return a.message < b.message ? -1 : 1;
  }
  return 0;
}

/**
 * Converte um erro bruto do Ajv em um AppError estruturado, preservando o
 * JSON Pointer (`instancePath`)/`schemaPath` originais no `context` para que
 * chamadores possam localizar exatamente onde a validação falhou.
 * @param {string} schemaName - chave usada em generated-validators.js (ex.: "manifest").
 * @param {object} ajvError
 * @returns {Readonly<object>}
 */
function ajvErrorToAppError(schemaName, ajvError) {
  return createAppError({
    code: `SCHEMA_${schemaName.toUpperCase()}_${ajvError.keyword.toUpperCase().replace(/-/g, '_')}`,
    scope: `content.schema.${schemaName}`,
    message: ajvError.message || 'Falha de validação de schema.',
    context: {
      schemaName,
      instancePath: ajvError.instancePath,
      schemaPath: ajvError.schemaPath,
      keyword: ajvError.keyword,
      params: ajvError.params,
    },
  });
}

/**
 * Executa o validador gerado identificado por `schemaName` contra `value` e
 * devolve um ValidationResult. Lança `TypeError` se `schemaName` não
 * corresponder a nenhum export de `generated-validators.js` — isso é um
 * defeito de programação do chamador (uso de uma chave de schema
 * inexistente), não uma falha esperada de dados.
 * @param {string} schemaName
 * @param {*} value
 * @returns {import('../../core/validation.js').ValidationResult}
 */
export function runGeneratedValidator(schemaName, value) {
  const validateFn = generatedValidators[schemaName];
  if (typeof validateFn !== 'function') {
    throw new TypeError(`runGeneratedValidator: schema desconhecido "${schemaName}".`);
  }

  const valid = validateFn(value);
  if (valid) {
    return createValidationResult();
  }

  const rawErrors = Array.isArray(validateFn.errors) ? validateFn.errors : [];
  const errors = rawErrors
    .map((ajvError) => ajvErrorToAppError(schemaName, ajvError))
    .sort(compareAjvErrorsDeterministically);

  return createValidationResult({ errors });
}

/**
 * Lista os nomes de schema disponíveis em generated-validators.js (útil
 * para validação defensiva de chamadores e para testes).
 * @returns {ReadonlyArray<string>}
 */
export function listAvailableSchemaNames() {
  return Object.freeze(
    Object.keys(generatedValidators).filter((key) => typeof generatedValidators[key] === 'function'),
  );
}
