// Módulo `core/validation`: define o `ValidationResult`, um agregado
// imutável de erros e avisos produzido por validadores em camadas
// superiores (content, domain, ...), e a função para combinar vários
// ValidationResults em um só, de forma determinística.

/**
 * @param {ReadonlyArray<*>} list
 * @returns {ReadonlyArray<*>}
 */
function freezeList(list) {
  return Object.freeze([...list]);
}

/**
 * Cria um ValidationResult imutável a partir de listas de erros e avisos.
 * `valid` é derivado (`true` somente quando não há erros — avisos não
 * invalidam o resultado).
 * @param {{errors?: ReadonlyArray<*>, warnings?: ReadonlyArray<*>}} params
 * @returns {Readonly<{valid: boolean, errors: ReadonlyArray<*>, warnings: ReadonlyArray<*>}>}
 */
export function createValidationResult({ errors = [], warnings = [] } = {}) {
  if (!Array.isArray(errors) || !Array.isArray(warnings)) {
    throw new TypeError('createValidationResult: "errors" e "warnings" devem ser arrays.');
  }

  const frozenErrors = freezeList(errors);
  const frozenWarnings = freezeList(warnings);

  return Object.freeze({
    valid: frozenErrors.length === 0,
    errors: frozenErrors,
    warnings: frozenWarnings,
  });
}

/**
 * Combina uma lista de ValidationResults em um único ValidationResult,
 * concatenando erros e avisos na ordem de entrada (determinístico: a mesma
 * lista de entrada sempre produz a mesma saída, na mesma ordem).
 * @param {ReadonlyArray<{errors: ReadonlyArray<*>, warnings: ReadonlyArray<*>}>} results
 * @returns {Readonly<{valid: boolean, errors: ReadonlyArray<*>, warnings: ReadonlyArray<*>}>}
 */
export function mergeValidationResults(results) {
  if (!Array.isArray(results)) {
    throw new TypeError('mergeValidationResults: "results" deve ser um array.');
  }

  const errors = [];
  const warnings = [];
  for (const result of results) {
    if (result == null || !Array.isArray(result.errors) || !Array.isArray(result.warnings)) {
      throw new TypeError('mergeValidationResults: cada item deve ser um ValidationResult válido.');
    }
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return createValidationResult({ errors, warnings });
}
