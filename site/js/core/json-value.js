// Módulo `core/json-value`: validação e clonagem profunda de valores que
// devem ser seguros para serialização JSON (usados como `context` de erros,
// payloads de conteúdo, etc.). Rejeita `undefined`, funções, `Date`, ciclos
// e números não finitos — tudo que `JSON.stringify` normalmente descarta ou
// falha silenciosamente ao lidar com.

import { ok, err } from './result.js';
import { createAppError } from './errors.js';

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * @param {string} reason
 * @param {string} path
 * @returns {Readonly<object>}
 */
function invalidError(reason, path) {
  return createAppError({
    code: 'JSON_VALUE_INVALID',
    scope: 'core.json-value',
    message: `Valor não é um JsonValue válido: ${reason}.`,
    context: { reason, path },
  });
}

/**
 * Percorre `value` recursivamente validando que é um JsonValue válido.
 * Quando `clone` é `true`, também constrói e retorna uma cópia profunda
 * congelada; quando `false`, apenas valida (mais barato, sem alocar cópia).
 * Detecta ciclos rastreando os objetos/arrays já visitados no caminho atual.
 * @param {*} value
 * @param {Set<*>} seen
 * @param {string} path
 * @param {boolean} clone
 * @returns {{ok: true, value: *} | {ok: false, error: Readonly<object>}}
 */
function walk(value, seen, path, clone) {
  if (value === null) {
    return { ok: true, value: null };
  }

  const type = typeof value;

  if (type === 'string' || type === 'boolean') {
    return { ok: true, value };
  }

  if (type === 'number') {
    if (!Number.isFinite(value)) {
      return { ok: false, error: invalidError('número não finito (NaN/Infinity)', path) };
    }
    return { ok: true, value };
  }

  if (type === 'undefined') {
    return { ok: false, error: invalidError('undefined não é permitido', path) };
  }

  if (type === 'function') {
    return { ok: false, error: invalidError('função não é permitida', path) };
  }

  if (value instanceof Date) {
    return { ok: false, error: invalidError('instância de Date não é permitida', path) };
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return { ok: false, error: invalidError('referência cíclica', path) };
    }
    seen.add(value);
    const result = [];
    for (let i = 0; i < value.length; i += 1) {
      const item = walk(value[i], seen, `${path}[${i}]`, clone);
      if (!item.ok) {
        return item;
      }
      result.push(item.value);
    }
    seen.delete(value);
    return { ok: true, value: clone ? Object.freeze(result) : true };
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) {
      return { ok: false, error: invalidError('referência cíclica', path) };
    }
    seen.add(value);
    const result = {};
    for (const key of Object.keys(value)) {
      const item = walk(value[key], seen, `${path}.${key}`, clone);
      if (!item.ok) {
        return item;
      }
      result[key] = item.value;
    }
    seen.delete(value);
    return { ok: true, value: clone ? Object.freeze(result) : true };
  }

  return { ok: false, error: invalidError('tipo não suportado (ex.: Map, Set, classe customizada)', path) };
}

/**
 * Clona profundamente `value`, retornando um Result. Em caso de sucesso, o
 * valor clonado (objetos e arrays) é congelado recursivamente. Rejeita
 * `undefined`, funções, `Date`, ciclos e números não finitos.
 * @param {*} value
 * @returns {import('./result.js').Result}
 */
export function cloneJsonValue(value) {
  const result = walk(value, new Set(), '$', true);
  if (!result.ok) {
    return err(result.error);
  }
  return ok(result.value);
}

/**
 * Verifica se `value` é um JsonValue válido, sem clonar. Usa as mesmas
 * regras de `cloneJsonValue` (incluindo detecção de ciclos).
 * @param {*} value
 * @returns {boolean}
 */
export function isJsonValue(value) {
  return walk(value, new Set(), '$', false).ok;
}
