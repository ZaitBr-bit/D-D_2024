// Módulo `core/errors`: define os formatos estruturados de erro (`AppError`)
// e aviso (`AppWarning`) usados em toda a aplicação, além das funções de
// serialização usadas para logs/telemetria. Este módulo não importa nada de
// outros módulos `core` para permanecer como uma folha na árvore de
// dependências (evita ciclos com `json-value.js`, que depende dele).

const APP_ERROR_NAME = 'AppError';
const APP_WARNING_NAME = 'AppWarning';

/**
 * Faz uma cópia profunda de `value` (objetos simples e arrays; qualquer
 * outro tipo — primitivos, funções, `Date`, etc. — é copiado por
 * referência/valor como está). Usada para nunca congelar o objeto do
 * próprio chamador (ver `copyAndFreezeDeep`), só a cópia interna.
 * Ciclos são cortados: uma referência já visitada no caminho atual vira
 * `null` na cópia, em vez de recursão infinita.
 * @param {*} value
 * @param {WeakSet<object>} seen - objetos já visitados no caminho atual.
 * @returns {*}
 */
function deepCopy(value, seen) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return null;
  }
  seen.add(value);
  const copy = Array.isArray(value) ? value.map((item) => deepCopy(item, seen)) : {};
  if (!Array.isArray(value)) {
    for (const key of Object.keys(value)) {
      copy[key] = deepCopy(value[key], seen);
    }
  }
  seen.delete(value);
  return copy;
}

/**
 * Congela `value` recursivamente (objetos simples e arrays), sempre
 * descendo aos filhos mesmo que `value` já esteja congelado ao chegar aqui
 * (um objeto pai pode já estar `Object.freeze`d pelo chamador sem que seus
 * filhos estejam) — por isso a proteção contra ciclos usa um `WeakSet` de
 * "em progresso no caminho atual", não `Object.isFrozen` como sinal de
 * "já processado".
 * @param {*} value
 * @param {WeakSet<object>} seen - objetos já visitados no caminho atual.
 * @returns {*}
 */
function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return value;
  }
  seen.add(value);
  Object.freeze(value);
  for (const key of Object.keys(value)) {
    deepFreeze(value[key], seen);
  }
  seen.delete(value);
  return value;
}

/**
 * Copia `value` profundamente e depois congela a cópia profundamente.
 * Garante que (a) o objeto original do chamador nunca é mutado/congelado
 * como efeito colateral, e (b) o resultado armazenado no diagnóstico é
 * imutável em todos os níveis, mesmo que o chamador tenha passado um objeto
 * parcialmente congelado (ex.: raiz congelada, filho não congelado).
 * @param {*} value
 * @returns {*}
 */
function copyAndFreezeDeep(value) {
  return deepFreeze(deepCopy(value, new WeakSet()));
}

/**
 * Tenta produzir uma cópia de `context` segura para JSON (sem funções,
 * `undefined`, ciclos etc.). Se não for possível, retorna `null` em vez de
 * lançar — serialização nunca deve quebrar por causa de um context malformado.
 * @param {*} context
 * @returns {*}
 */
function sanitizeContextForSerialization(context) {
  if (context === undefined || context === null) {
    return null;
  }
  try {
    return JSON.parse(JSON.stringify(context));
  } catch {
    return null;
  }
}

/**
 * Constrói um diagnóstico estruturado (AppError ou AppWarning) congelado.
 * Lança `TypeError` quando `code`, `scope` ou `message` estão ausentes ou
 * vazios — isso é considerado um defeito de programação do chamador, não
 * uma falha esperada de domínio.
 * @param {string} name - 'AppError' ou 'AppWarning'.
 * @param {{code: string, scope: string, message: string, context?: *, cause?: *}} params
 * @returns {Readonly<object>}
 */
function buildDiagnostic(name, { code, scope, message, context, cause } = {}) {
  if (typeof code !== 'string' || code.length === 0) {
    throw new TypeError(`${name}: "code" deve ser uma string não vazia.`);
  }
  if (typeof scope !== 'string' || scope.length === 0) {
    throw new TypeError(`${name}: "scope" deve ser uma string não vazia.`);
  }
  if (typeof message !== 'string' || message.length === 0) {
    throw new TypeError(`${name}: "message" deve ser uma string não vazia.`);
  }

  const diagnostic = {
    name,
    code,
    scope,
    message,
    context: copyAndFreezeDeep(context === undefined ? null : context),
    cause,
  };
  return Object.freeze(diagnostic);
}

/**
 * Cria um AppError estruturado e imutável.
 * @param {{code: string, scope: string, message: string, context?: *, cause?: *}} params
 * @returns {Readonly<object>}
 */
export function createAppError(params) {
  return buildDiagnostic(APP_ERROR_NAME, params);
}

/**
 * Cria um AppWarning estruturado e imutável.
 * @param {{code: string, scope: string, message: string, context?: *, cause?: *}} params
 * @returns {Readonly<object>}
 */
export function createAppWarning(params) {
  return buildDiagnostic(APP_WARNING_NAME, params);
}

/**
 * Serializa um diagnóstico (AppError/AppWarning) para um objeto JSON puro,
 * excluindo explicitamente `cause` (que pode conter stacks, referências a
 * objetos internos ou dados sensíveis) e sem assumir nenhum formato
 * específico para `context` (em particular, nunca exige um "personagem
 * completo").
 * @param {object} diagnostic
 * @returns {Readonly<object>}
 */
function serialize(diagnostic) {
  return Object.freeze({
    name: diagnostic.name,
    code: diagnostic.code,
    scope: diagnostic.scope,
    message: diagnostic.message,
    context: sanitizeContextForSerialization(diagnostic.context),
  });
}

/**
 * Serializa um AppError para JSON, sem a chave `cause`.
 * @param {object} error
 * @returns {Readonly<object>}
 */
export function serializeAppError(error) {
  return serialize(error);
}

/**
 * Serializa um AppWarning para JSON, sem a chave `cause`.
 * @param {object} warning
 * @returns {Readonly<object>}
 */
export function serializeAppWarning(warning) {
  return serialize(warning);
}
