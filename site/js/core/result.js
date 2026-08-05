// Módulo `core/result`: implementa o padrão Result (sucesso/falha) usado em
// toda a aplicação para representar operações que podem falhar sem recorrer
// a exceções. Exceções ficam reservadas para defeitos genuinamente
// inesperados (erros de programação), não para falhas esperadas do domínio.

/**
 * Cria um Result de sucesso contendo `value`. O envelope retornado é
 * congelado (raso) para impedir mutação acidental do resultado após criado.
 * @param {*} value - valor de sucesso da operação.
 * @returns {{ok: true, value: *}}
 */
export function ok(value) {
  return Object.freeze({ ok: true, value });
}

/**
 * Cria um Result de falha contendo `error`. O envelope retornado é
 * congelado (raso) para impedir mutação acidental do resultado após criado.
 * @param {*} error - descrição do erro (tipicamente um AppError).
 * @returns {{ok: false, error: *}}
 */
export function err(error) {
  return Object.freeze({ ok: false, error });
}

/**
 * Verifica se `value` tem o formato de um Result (`{ok, value}` ou
 * `{ok, error}`), sem exigir que tenha sido criado por `ok`/`err`.
 * @param {*} value
 * @returns {boolean}
 */
export function isResult(value) {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (typeof value.ok !== 'boolean') {
    return false;
  }
  return value.ok ? 'value' in value : 'error' in value;
}
