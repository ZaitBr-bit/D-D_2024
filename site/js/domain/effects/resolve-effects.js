// Módulo `domain/effects/resolve-effects`: resolve o VALOR final de um alvo
// derivado a partir das contribuições de efeito, de forma determinística.
//
// ## Alvos numéricos (`resolveNumericTarget`)
//
// A ordem é FIXA e não depende da ordem do array de entrada:
//
//   1. ordenar por grupo de precedência, depois `priority` crescente, depois
//      `effectInstanceId` (desempate estável);
//   2. filtrar por `stackKey` (só a contribuição de maior precedência de cada
//      `stackKey` com `stackable: false` sobrevive);
//   3. resolver o `set` vencedor (o último na ordem) — DOIS `set` com valores
//      diferentes no mesmo grupo e mesma `priority` é ERRO, não escolha
//      implícita pela posição no array;
//   4. somar TODOS os `add`;
//   5. só então aplicar TODOS os `multiply`, na ordem estável;
//   6. por fim aplicar o MAIOR limite inferior (`min`) e o MENOR limite
//      superior (`max`) — o limite mais restritivo vence. `min > max` é ERRO.
//
// ## Alvos de conjunto (`resolveSetTarget`)
//
// Três operações, não apenas união: `add-ids`, `remove-ids` e `replace-ids`.
// `replace-ids` substitui o conjunto inteiro na precedência em que ocorre.
// Dentro do MESMO grupo e MESMA `priority`, um `remove-ids` e um `add-ids` do
// mesmo ID é ERRO (ambíguo) — nunca resolvido implicitamente pela ordem do
// array.
//
// Nada aqui usa `eval`/`Function`, acesso livre a path ou mutação dos
// argumentos recebidos.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import {
  hasOwn,
  isAllowedTargetPath,
  isKnownSetTarget,
  isKnownSetOperation,
  SET_TARGETS,
  SET_OPERATIONS,
} from './effect-predicates.js';
import { sortResolvedEffects, filterByStackKey } from './collect-effects.js';

export { SET_TARGETS, SET_OPERATIONS };

const SCOPE = 'domain.effects.resolve';

// Literal numérico serializado (aceita a vírgula decimal do pt-BR).
const NUMERIC_LITERAL_PATTERN = /^[+-]?(?:\d+)(?:[.,]\d+)?$/;

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
function resolveError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Resolve o valor numérico de uma contribuição. Aceita:
 *   - `number` finito, usado como está;
 *   - `string` que seja o NOME de uma variável presente como propriedade
 *     PRÓPRIA de `context.variables` (ex.: `"proficiency-bonus"`);
 *   - `string` que seja um literal numérico (`"2"`, `"-1"`, `"+4,5"`).
 *
 * Qualquer outra coisa (dado de dano como `"1d6"`, valor com unidade como
 * `"+3 m"`) é ERRO EXPLÍCITO: são alvos de expressão, resolvidos pela camada
 * de valores derivados, não somas numéricas.
 *
 * @param {*} value
 * @param {object} context
 * @returns {{ok: true, value: number} | {ok: false, error: object}}
 */
export function resolveNumericValue(value, context = {}) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { ok: true, value };
  }
  if (typeof value === 'string') {
    const variables = context?.variables;
    if (hasOwn(variables, value)) {
      const resolved = variables[value];
      if (typeof resolved === 'number' && Number.isFinite(resolved)) {
        return { ok: true, value: resolved };
      }
    } else if (NUMERIC_LITERAL_PATTERN.test(value)) {
      return { ok: true, value: Number.parseFloat(value.replace(',', '.')) };
    }
  }
  return {
    ok: false,
    error: resolveError('EFFECT_VALUE_NOT_NUMERIC', 'O valor do efeito não é resolvível como número.', {
      value: typeof value === 'string' || typeof value === 'number' ? value : null,
      valueType: typeof value,
    }),
  };
}

/**
 * Resolve o valor numérico final de um alvo derivado.
 *
 * @param {{target: string, baseValue?: number, effects?: ReadonlyArray<object>,
 *   context?: object}} params
 * @returns {import('../../core/result.js').Result} `ok(number)`
 */
export function resolveNumericTarget({ target, baseValue, effects = [], context = {} } = {}) {
  if (!isAllowedTargetPath(target)) {
    return err(
      resolveError('EFFECT_TARGET_NOT_ALLOWED', 'O alvo derivado não pertence ao vocabulário fechado.', {
        target: typeof target === 'string' ? target : null,
      }),
    );
  }
  if (!Array.isArray(effects)) {
    return err(resolveError('EFFECT_LIST_INVALID', '"effects" deve ser um array de ResolvedEffect.', { target }));
  }

  const relevant = effects.filter(
    (entry) =>
      entry !== null &&
      typeof entry === 'object' &&
      entry.effect !== null &&
      typeof entry.effect === 'object' &&
      entry.effect.type === 'modifier' &&
      entry.effect.target === target,
  );
  const ordered = filterByStackKey(sortResolvedEffects(relevant));

  const buckets = { set: [], add: [], multiply: [], min: [], max: [] };
  for (const entry of ordered) {
    const operation = entry.effect.operation;
    if (!hasOwn(buckets, operation)) {
      return err(
        resolveError('EFFECT_OPERATION_UNKNOWN', `A operação "${String(operation)}" não pertence ao enum fechado.`, {
          target,
          effectInstanceId: entry.effectInstanceId,
        }),
      );
    }
    const resolved = resolveNumericValue(entry.effect.value, context);
    if (!resolved.ok) {
      return err(
        resolveError(resolved.error.code, resolved.error.message, {
          target,
          effectInstanceId: entry.effectInstanceId,
          ...resolved.error.context,
        }),
      );
    }
    buckets[operation].push({ entry, value: resolved.value });
  }

  // --- 3. `set` vencedor ---------------------------------------------------
  //
  // O conflito é conferido em TODOS os pares (grupo, priority), não só no do
  // vencedor: dois `set` contraditórios na mesma prioridade são um defeito do
  // conteúdo mesmo quando um grupo posterior os sobrescreveria — deixar passar
  // esconderia o bug até o dia em que o override desaparecesse.
  let value;
  if (buckets.set.length > 0) {
    const byBucket = new Map();
    for (const candidate of buckets.set) {
      const key = `${candidate.entry.groupIndex}:${candidate.entry.priority}`;
      const previous = byBucket.get(key);
      if (previous !== undefined && previous.value !== candidate.value) {
        return err(
          resolveError(
            'EFFECT_SET_CONFLICT',
            `Dois efeitos "set" com valores diferentes disputam "${target}" no mesmo grupo e mesma priority.`,
            {
              target,
              group: candidate.entry.group,
              priority: candidate.entry.priority,
              effectInstanceIds: [previous.entry.effectInstanceId, candidate.entry.effectInstanceId],
            },
          ),
        );
      }
      byBucket.set(key, candidate);
    }
    value = buckets.set[buckets.set.length - 1].value;
  } else if (typeof baseValue === 'number' && Number.isFinite(baseValue)) {
    value = baseValue;
  } else if (baseValue === undefined || baseValue === null) {
    return err(
      resolveError('EFFECT_BASE_VALUE_MISSING', `Não há "baseValue" nem efeito "set" que defina "${target}".`, {
        target,
      }),
    );
  } else {
    return err(
      resolveError('EFFECT_BASE_VALUE_INVALID', `O "baseValue" de "${target}" não é um número finito.`, {
        target,
        valueType: typeof baseValue,
      }),
    );
  }

  // --- 4. todos os `add` --------------------------------------------------
  for (const contribution of buckets.add) {
    value += contribution.value;
  }

  // --- 5. só depois todos os `multiply`, na ordem estável -----------------
  for (const contribution of buckets.multiply) {
    value *= contribution.value;
  }

  // --- 6. limites: o mais restritivo vence -------------------------------
  const lowerBound = buckets.min.length > 0 ? Math.max(...buckets.min.map((entry) => entry.value)) : null;
  const upperBound = buckets.max.length > 0 ? Math.min(...buckets.max.map((entry) => entry.value)) : null;
  if (lowerBound !== null && upperBound !== null && lowerBound > upperBound) {
    return err(
      resolveError('EFFECT_BOUNDS_CONFLICT', `Os limites de "${target}" são contraditórios (min > max).`, {
        target,
        min: lowerBound,
        max: upperBound,
      }),
    );
  }
  if (lowerBound !== null) {
    value = Math.max(value, lowerBound);
  }
  if (upperBound !== null) {
    value = Math.min(value, upperBound);
  }

  return ok(value);
}

/**
 * Resolve o conjunto final de IDs de um alvo de conjunto.
 *
 * @param {{target: string, baseIds?: Iterable<string>,
 *   effects?: ReadonlyArray<object>, context?: object}} params
 * @returns {import('../../core/result.js').Result} `ok(ReadonlySet<string>)`
 */
export function resolveSetTarget({ target, baseIds, effects = [], context = {} } = {}) {
  void context;
  if (!isKnownSetTarget(target)) {
    return err(
      resolveError('EFFECT_SET_TARGET_UNKNOWN', 'O alvo de conjunto não pertence ao vocabulário fechado.', {
        target: typeof target === 'string' ? target : null,
      }),
    );
  }
  if (!Array.isArray(effects)) {
    return err(resolveError('EFFECT_LIST_INVALID', '"effects" deve ser um array de ResolvedEffect.', { target }));
  }
  if (baseIds !== undefined && baseIds !== null && typeof baseIds[Symbol.iterator] !== 'function') {
    return err(resolveError('EFFECT_SET_BASE_INVALID', '"baseIds" deve ser iterável quando presente.', { target }));
  }

  const relevant = effects.filter(
    (entry) => entry !== null && typeof entry === 'object' && entry.setTarget === target && Array.isArray(entry.ids),
  );
  const ordered = filterByStackKey(sortResolvedEffects(relevant));

  for (const entry of ordered) {
    if (!isKnownSetOperation(entry.setOperation)) {
      return err(
        resolveError('EFFECT_SET_OPERATION_UNKNOWN', `A operação de conjunto "${String(entry.setOperation)}" é desconhecida.`, {
          target,
          effectInstanceId: entry.effectInstanceId,
        }),
      );
    }
  }

  // Ambiguidade: no MESMO grupo e MESMA priority, add e remove do mesmo ID.
  const buckets = new Map();
  for (const entry of ordered) {
    const key = `${entry.groupIndex}:${entry.priority}`;
    if (!buckets.has(key)) {
      buckets.set(key, { added: new Set(), removed: new Set() });
    }
    const bucket = buckets.get(key);
    if (entry.setOperation === 'add-ids' || entry.setOperation === 'replace-ids') {
      for (const id of entry.ids) {
        bucket.added.add(id);
      }
    } else {
      for (const id of entry.ids) {
        bucket.removed.add(id);
      }
    }
  }
  for (const [key, bucket] of buckets) {
    for (const id of bucket.removed) {
      if (bucket.added.has(id)) {
        const [groupIndex, priority] = key.split(':');
        return err(
          resolveError(
            'EFFECT_SET_AMBIGUOUS',
            `O ID "${id}" é acrescentado e removido de "${target}" no mesmo grupo e mesma priority.`,
            { target, id, groupIndex: Number(groupIndex), priority: Number(priority) },
          ),
        );
      }
    }
  }

  let current = new Set(baseIds === undefined || baseIds === null ? [] : baseIds);
  for (const entry of ordered) {
    switch (entry.setOperation) {
      case 'replace-ids':
        current = new Set(entry.ids);
        break;
      case 'add-ids':
        for (const id of entry.ids) {
          current.add(id);
        }
        break;
      case 'remove-ids':
        for (const id of entry.ids) {
          current.delete(id);
        }
        break;
      default:
        // Inalcançável: as operações já foram conferidas acima.
        break;
    }
  }

  return ok(freezeSet(current));
}

/**
 * Torna um `Set` somente leitura. `Object.freeze` sozinho NÃO impede
 * `add`/`delete`/`clear` num Set (os dados ficam num slot interno), então os
 * mutadores são substituídos por lançadores na própria instância.
 * @param {Set<string>} set
 * @returns {ReadonlySet<string>}
 */
function freezeSet(set) {
  for (const method of ['add', 'delete', 'clear']) {
    Object.defineProperty(set, method, {
      value: () => {
        throw new TypeError('O conjunto resolvido por resolveSetTarget é somente leitura.');
      },
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }
  return Object.freeze(set);
}
