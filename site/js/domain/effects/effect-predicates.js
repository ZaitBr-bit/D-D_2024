// Módulo `domain/effects/effect-predicates`: os predicados FECHADOS do motor
// de efeitos declarativos.
//
// Duas responsabilidades, ambas puras e determinísticas:
//
//   1. `validateEffectSemantics(effect, context)` — valida a SEMÂNTICA de um
//      efeito já carregado (o schema JSON valida a sintaxe; aqui validamos o
//      que o schema não consegue expressar: paths permitidos, valores
//      serializáveis, coerência de `stackKey`/`stackable`, chaves próprias
//      reservadas).
//   2. `evaluateEffectCondition(condition, context)` — avalia a expressão de
//      gating `when`, com vocabulário fechado de sete `kind`s.
//
// ## Modelo de segurança
//
// Efeitos vêm de JSON NÃO CONFIÁVEL, mesmo dentro do pacote oficial. Por isso:
//
//   - nada de `eval`/`new Function`/template de código: as condições são um
//     vocabulário de dados, nunca expressões executáveis;
//   - `target` é uma WHITELIST de namespaces (não uma blacklist), com
//     bloqueio adicional de segmentos de prototype-pollution em qualquer
//     posição — a mesma defesa em profundidade do `pattern` de
//     `modifierEffect.target` em dados/schemas/v1/effect.schema.json;
//   - toda leitura de mapa vindo de dados usa `Object.prototype.hasOwnProperty`
//     explicitamente, para que `toString`, `constructor` etc. nunca sejam
//     confundidos com uma escolha/flag/variável real;
//   - as próprias chaves do objeto de efeito são conferidas contra a mesma
//     lista de segmentos reservados, para que um `{"__proto__": ...}` vindo de
//     `JSON.parse` (que cria uma propriedade PRÓPRIA com esse nome) seja
//     recusado em vez de circular pelo motor.
//
// O vocabulário aqui é a fonte única em runtime; `tests/unit/domain/effect-predicates.test.js`
// compara essas listas com `dados/schemas/v1/effect.schema.json` para que as
// duas nunca divirjam em silêncio.

import { createAppError } from '../../core/errors.js';
import { createValidationResult } from '../../core/validation.js';
import { ok, err } from '../../core/result.js';

const SCOPE = 'domain.effects.predicates';

// Os 11 tipos fechados de `effect.schema.json#/$defs/effectType`.
export const EFFECT_TYPES = Object.freeze([
  'modifier',
  'proficiency',
  'language',
  'defense',
  'grant-spell',
  'grant-item',
  'resource',
  'choice',
  'condition',
  'official-handler',
  'manual',
]);

// Operações fechadas de `modifierEffect.operation`.
export const MODIFIER_OPERATIONS = Object.freeze(['set', 'add', 'multiply', 'min', 'max']);

// Primeiro segmento permitido de um path de alvo derivado. É o VOCABULÁRIO
// ÚNICO de "alvos derivados" do projeto: o mesmo usado por
// `modifierEffect.target`, por `overrides` do personagem canônico (Task 12) e
// pela allowlist de edição da Task 17 — que deriva desta lista em vez de
// duplicá-la.
export const EFFECT_TARGET_NAMESPACES = Object.freeze([
  'ability',
  'skill',
  'save',
  'ac',
  'speed',
  'hp',
  'initiative',
  'attack',
  'damage',
  'proficiency-bonus',
  'resource',
  'spell-slot',
  'senses',
  'size',
  'passive-perception',
  'carrying-capacity',
]);

// Segmentos que nunca podem aparecer num path de alvo nem como chave própria
// de um efeito. Mesma lista do `pattern` do schema.
export const RESERVED_PATH_SEGMENTS = Object.freeze([
  'constructor',
  'prototype',
  '__proto__',
  'toString',
  'valueOf',
  'hasOwnProperty',
  '__defineGetter__',
  '__defineSetter__',
]);

// As sete `kind`s fechadas de `conditionExpr`.
export const CONDITION_KINDS = Object.freeze(['level', 'choice', 'equipped', 'state-flag', 'all', 'any', 'not']);

// Flags de estado reconhecidas (enum fechado de `conditionStateFlag.flag`).
export const STATE_FLAGS = Object.freeze([
  'raging',
  'concentrating',
  'surprised',
  'hidden',
  'prone',
  'unconscious',
  'dead',
  'inspired',
  'bloodied',
]);

// Profundidade máxima de aninhamento de `all`/`any`/`not`. Um limite explícito
// evita que conteúdo malicioso derrube a pilha com aninhamento profundo.
export const MAX_CONDITION_DEPTH = 16;

// Formato de `common.schema.json#/$defs/localSlug`.
const LOCAL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Formato de um segmento de path (igual ao do schema: minúsculo, kebab-case).
const PATH_SEGMENT_PATTERN = /^[a-z][a-z0-9-]*$/;
// ContentId qualificado `namespace:type:slug`.
const CONTENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RESERVED_SEGMENT_SET = new Set(RESERVED_PATH_SEGMENTS);
const EFFECT_TYPE_SET = new Set(EFFECT_TYPES);
const MODIFIER_OPERATION_SET = new Set(MODIFIER_OPERATIONS);
const TARGET_NAMESPACE_SET = new Set(EFFECT_TARGET_NAMESPACES);
const CONDITION_KIND_SET = new Set(CONDITION_KINDS);
const STATE_FLAG_SET = new Set(STATE_FLAGS);

// Chaves aceitas por TODOS os tipos de efeito.
const COMMON_KEYS = Object.freeze(['id', 'type', 'when', 'priority']);
// Chaves de empilhamento, aceitas pelos tipos de conjunto/concessão.
const STACK_KEYS = Object.freeze(['stackKey', 'stackable']);

/**
 * Especificação fechada por tipo de efeito: chaves obrigatórias, chaves
 * opcionais e se o tipo participa do vocabulário de empilhamento
 * (`stackKey`/`stackable`). Espelha `dados/schemas/v1/effect.schema.json`.
 */
const EFFECT_SPECS = Object.freeze({
  modifier: Object.freeze({ required: ['target', 'operation', 'value'], optional: [], stacking: true }),
  proficiency: Object.freeze({ required: ['target'], optional: ['level'], stacking: true }),
  language: Object.freeze({ required: ['language'], optional: [], stacking: true }),
  defense: Object.freeze({ required: ['damageType', 'mode'], optional: [], stacking: true }),
  'grant-spell': Object.freeze({ required: ['spell'], optional: ['alwaysPrepared'], stacking: true }),
  'grant-item': Object.freeze({ required: ['item'], optional: ['quantity'], stacking: true }),
  resource: Object.freeze({ required: ['resource', 'max'], optional: ['recovery'], stacking: true }),
  choice: Object.freeze({ required: ['choice'], optional: [], stacking: false }),
  condition: Object.freeze({ required: ['condition'], optional: ['duration'], stacking: true }),
  'official-handler': Object.freeze({ required: ['handlerId'], optional: ['params'], stacking: false }),
  manual: Object.freeze({ required: ['text'], optional: [], stacking: false }),
});

/**
 * Diz se `object` tem `key` como propriedade PRÓPRIA. Nunca usa o operador
 * `in` nem acesso direto, para que nada herdado do protótipo (`toString`,
 * `constructor`, ...) passe por dado de conteúdo.
 * @param {*} object
 * @param {string} key
 * @returns {boolean}
 */
export function hasOwn(object, key) {
  return object !== null && typeof object === 'object' && Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * Diz se `value` é um objeto simples (nem null, nem array).
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
function predicateError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Diz se `path` é um alvo derivado permitido: primeiro segmento na whitelist
 * fechada de namespaces, demais segmentos em kebab-case e NENHUM segmento
 * (em nenhuma posição) na lista de reservados de prototype-pollution.
 * @param {*} path
 * @returns {boolean}
 */
export function isAllowedTargetPath(path) {
  if (typeof path !== 'string' || path.length === 0) {
    return false;
  }
  const segments = path.split('.');
  if (!TARGET_NAMESPACE_SET.has(segments[0])) {
    return false;
  }
  for (const [position, segment] of segments.entries()) {
    if (RESERVED_SEGMENT_SET.has(segment)) {
      return false;
    }
    if (position > 0 && !PATH_SEGMENT_PATTERN.test(segment)) {
      return false;
    }
  }
  return true;
}

/**
 * Diz se `value` pode ser gravado num efeito/estado e sobreviver a
 * `JSON.stringify` sem virar `null`/desaparecer: apenas number finito ou
 * string. Booleans/objetos/arrays/funções/símbolos/NaN/Infinity ficam fora do
 * vocabulário de `modifier.value` (que o schema declara como
 * `["number","string"]`).
 * @param {*} value
 * @returns {boolean}
 */
export function isSerializableEffectValue(value) {
  if (typeof value === 'string') {
    return true;
  }
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Valida a forma de uma expressão de condição, recursivamente, sem avaliar
 * nada. Devolve uma lista (possivelmente vazia) de AppErrors.
 * @param {*} condition
 * @param {string} path - localização textual usada no contexto do erro.
 * @param {number} depth
 * @returns {Array<object>}
 */
function collectConditionErrors(condition, path, depth) {
  if (depth > MAX_CONDITION_DEPTH) {
    return [
      predicateError('EFFECT_CONDITION_TOO_DEEP', `A condição em ${path} excede a profundidade máxima permitida.`, {
        path,
        maxDepth: MAX_CONDITION_DEPTH,
      }),
    ];
  }
  if (!isPlainObject(condition)) {
    return [
      predicateError('EFFECT_CONDITION_INVALID', `A condição em ${path} deve ser um objeto.`, { path }),
    ];
  }
  const kind = condition.kind;
  if (typeof kind !== 'string' || !CONDITION_KIND_SET.has(kind)) {
    return [
      predicateError('EFFECT_CONDITION_UNKNOWN_KIND', `A condição em ${path} usa uma "kind" fora do vocabulário fechado.`, {
        path,
        kind: typeof kind === 'string' ? kind : null,
      }),
    ];
  }

  /** Atalho para montar o erro padrão de condição inválida. */
  const invalid = (message, extra = {}) => [
    predicateError('EFFECT_CONDITION_INVALID', message, { path, kind, ...extra }),
  ];

  switch (kind) {
    case 'level': {
      if (!Number.isInteger(condition.min) || condition.min < 1 || condition.min > 20) {
        return invalid(`A condição de nível em ${path} exige "min" inteiro entre 1 e 20.`);
      }
      if (hasOwn(condition, 'max')) {
        if (!Number.isInteger(condition.max) || condition.max < condition.min || condition.max > 20) {
          return invalid(`A condição de nível em ${path} tem "max" inválido ou menor que "min".`);
        }
      }
      if (hasOwn(condition, 'class') && !CONTENT_ID_PATTERN.test(String(condition.class))) {
        return invalid(`A condição de nível em ${path} tem "class" que não é um ContentId.`);
      }
      return [];
    }
    case 'choice': {
      if (!LOCAL_SLUG_PATTERN.test(String(condition.choiceId)) || RESERVED_SEGMENT_SET.has(String(condition.choiceId))) {
        return invalid(`A condição de escolha em ${path} tem "choiceId" fora do formato localSlug.`);
      }
      if (!LOCAL_SLUG_PATTERN.test(String(condition.equals))) {
        return invalid(`A condição de escolha em ${path} tem "equals" fora do formato localSlug.`);
      }
      return [];
    }
    case 'equipped': {
      if (!CONTENT_ID_PATTERN.test(String(condition.item))) {
        return invalid(`A condição de item equipado em ${path} tem "item" que não é um ContentId.`);
      }
      return [];
    }
    case 'state-flag': {
      if (typeof condition.flag !== 'string' || !STATE_FLAG_SET.has(condition.flag)) {
        return invalid(`A condição de flag em ${path} usa uma flag fora do enum fechado.`, {
          flag: typeof condition.flag === 'string' ? condition.flag : null,
        });
      }
      if (hasOwn(condition, 'equals') && typeof condition.equals !== 'boolean') {
        return invalid(`A condição de flag em ${path} exige "equals" boolean quando presente.`);
      }
      return [];
    }
    case 'all':
    case 'any': {
      if (!Array.isArray(condition.conditions) || condition.conditions.length === 0) {
        return invalid(`A condição composta em ${path} exige "conditions" com pelo menos um item.`);
      }
      return condition.conditions.flatMap((child, index) =>
        collectConditionErrors(child, `${path}.conditions[${index}]`, depth + 1),
      );
    }
    case 'not': {
      return collectConditionErrors(condition.condition, `${path}.condition`, depth + 1);
    }
    default:
      // Inalcançável: `kind` já foi conferida contra CONDITION_KIND_SET.
      return invalid(`A condição em ${path} não pôde ser interpretada.`);
  }
}

/**
 * Valida a semântica de um efeito. O resultado é um `ValidationResult` de
 * `core/validation.js` (agregado de erros/avisos), nunca uma exceção: efeito
 * inválido é conteúdo ruim, não defeito de programação.
 * @param {*} effect
 * @param {{path?: string}} [context] - `path` é usado só para localizar o
 *   efeito nas mensagens/contextos de erro.
 * @returns {Readonly<{valid: boolean, errors: ReadonlyArray<object>, warnings: ReadonlyArray<object>}>}
 */
export function validateEffectSemantics(effect, context = {}) {
  const path = typeof context?.path === 'string' && context.path.length > 0 ? context.path : 'effect';
  const errors = [];

  if (!isPlainObject(effect)) {
    errors.push(
      predicateError('EFFECT_INVALID', `O efeito em ${path} deve ser um objeto simples.`, {
        path,
        receivedType: Array.isArray(effect) ? 'array' : typeof effect,
      }),
    );
    return createValidationResult({ errors });
  }

  // Chaves próprias reservadas: `JSON.parse('{"__proto__":{}}')` cria uma
  // propriedade PRÓPRIA "__proto__" que não polui nada por si só, mas nunca
  // deve circular pelo motor como se fosse campo de efeito.
  for (const key of Object.getOwnPropertyNames(effect)) {
    if (RESERVED_SEGMENT_SET.has(key)) {
      errors.push(
        predicateError('EFFECT_KEY_RESERVED', `O efeito em ${path} declara a chave reservada "${key}".`, { path, key }),
      );
    }
  }

  const type = effect.type;
  if (typeof type !== 'string' || !EFFECT_TYPE_SET.has(type)) {
    errors.push(
      predicateError('EFFECT_TYPE_UNKNOWN', `O efeito em ${path} usa um "type" fora do vocabulário fechado.`, {
        path,
        type: typeof type === 'string' ? type : null,
      }),
    );
    return createValidationResult({ errors });
  }

  const spec = EFFECT_SPECS[type];
  const allowedKeys = new Set([
    ...COMMON_KEYS,
    ...spec.required,
    ...spec.optional,
    ...(spec.stacking ? STACK_KEYS : []),
  ]);

  for (const key of Object.keys(effect)) {
    if (!allowedKeys.has(key) && !RESERVED_SEGMENT_SET.has(key)) {
      errors.push(
        predicateError('EFFECT_PROPERTY_UNKNOWN', `O efeito "${type}" em ${path} declara a chave desconhecida "${key}".`, {
          path,
          type,
          key,
        }),
      );
    }
  }
  for (const key of spec.required) {
    if (!hasOwn(effect, key) || effect[key] === undefined || effect[key] === null) {
      errors.push(
        predicateError('EFFECT_PROPERTY_MISSING', `O efeito "${type}" em ${path} exige a chave "${key}".`, {
          path,
          type,
          key,
        }),
      );
    }
  }

  if (hasOwn(effect, 'id') && !LOCAL_SLUG_PATTERN.test(String(effect.id))) {
    errors.push(
      predicateError('EFFECT_ID_INVALID', `O efeito em ${path} tem "id" fora do formato localSlug.`, { path, type }),
    );
  }

  // `priority`: ausência equivale a 0; presente, deve ser inteiro seguro.
  if (hasOwn(effect, 'priority') && !Number.isSafeInteger(effect.priority)) {
    errors.push(
      predicateError('EFFECT_PRIORITY_INVALID', `O efeito em ${path} exige "priority" inteiro quando presente.`, {
        path,
        type,
      }),
    );
  }

  // `stackKey`/`stackable`: ausência de `stackKey` significa "sempre acumula".
  if (hasOwn(effect, 'stackKey')) {
    const stackKey = effect.stackKey;
    if (typeof stackKey !== 'string' || !LOCAL_SLUG_PATTERN.test(stackKey) || RESERVED_SEGMENT_SET.has(stackKey)) {
      errors.push(
        predicateError('EFFECT_STACK_KEY_INVALID', `O efeito em ${path} tem "stackKey" fora do formato localSlug.`, {
          path,
          type,
        }),
      );
    }
  }
  if (hasOwn(effect, 'stackable')) {
    if (typeof effect.stackable !== 'boolean') {
      errors.push(
        predicateError('EFFECT_STACKABLE_INVALID', `O efeito em ${path} exige "stackable" boolean quando presente.`, {
          path,
          type,
        }),
      );
    } else if (effect.stackable === false && !hasOwn(effect, 'stackKey')) {
      errors.push(
        predicateError(
          'EFFECT_STACKABLE_WITHOUT_STACK_KEY',
          `O efeito em ${path} declara "stackable": false sem "stackKey"; não haveria por onde deduplicar.`,
          { path, type },
        ),
      );
    }
  }

  if (type === 'modifier') {
    if (!isAllowedTargetPath(effect.target)) {
      errors.push(
        predicateError('EFFECT_TARGET_NOT_ALLOWED', `O efeito em ${path} aponta para um alvo derivado não permitido.`, {
          path,
          target: typeof effect.target === 'string' ? effect.target : null,
        }),
      );
    }
    if (typeof effect.operation !== 'string' || !MODIFIER_OPERATION_SET.has(effect.operation)) {
      errors.push(
        predicateError('EFFECT_OPERATION_UNKNOWN', `O efeito em ${path} usa uma operação fora do enum fechado.`, {
          path,
          operation: typeof effect.operation === 'string' ? effect.operation : null,
        }),
      );
    }
    if (hasOwn(effect, 'value') && !isSerializableEffectValue(effect.value)) {
      errors.push(
        predicateError('EFFECT_VALUE_NOT_SERIALIZABLE', `O efeito em ${path} tem "value" não serializável.`, {
          path,
          valueType: typeof effect.value,
        }),
      );
    }
  }

  // Enums fechados dos tipos de concessão. Sem estes checks, um `mode`
  // forjado viraria um alvo de conjunto inexistente (`defense.<lixo>`).
  const CLOSED_ENUMS = Object.freeze({
    defense: Object.freeze({ mode: ['resistance', 'immunity', 'vulnerability'] }),
    proficiency: Object.freeze({ level: ['proficient', 'expertise'] }),
    resource: Object.freeze({ recovery: ['short-rest', 'long-rest', 'dawn', 'none'] }),
  });
  const enums = CLOSED_ENUMS[type];
  if (enums !== undefined) {
    for (const [key, allowed] of Object.entries(enums)) {
      if (hasOwn(effect, key) && !allowed.includes(effect[key])) {
        errors.push(
          predicateError('EFFECT_ENUM_INVALID', `O efeito "${type}" em ${path} tem "${key}" fora do enum fechado.`, {
            path,
            type,
            key,
          }),
        );
      }
    }
  }
  if (type === 'grant-item' && hasOwn(effect, 'quantity') && (!Number.isSafeInteger(effect.quantity) || effect.quantity < 1)) {
    errors.push(
      predicateError('EFFECT_ENUM_INVALID', `O efeito "grant-item" em ${path} exige "quantity" inteiro >= 1.`, {
        path,
        type,
        key: 'quantity',
      }),
    );
  }
  if (type === 'grant-spell' && hasOwn(effect, 'alwaysPrepared') && typeof effect.alwaysPrepared !== 'boolean') {
    errors.push(
      predicateError('EFFECT_ENUM_INVALID', `O efeito "grant-spell" em ${path} exige "alwaysPrepared" boolean.`, {
        path,
        type,
        key: 'alwaysPrepared',
      }),
    );
  }

  if (type === 'resource' && hasOwn(effect, 'max') && !isSerializableEffectValue(effect.max)) {
    errors.push(
      predicateError('EFFECT_VALUE_NOT_SERIALIZABLE', `O efeito em ${path} tem "max" não serializável.`, {
        path,
        valueType: typeof effect.max,
      }),
    );
  }

  if (hasOwn(effect, 'when') && effect.when !== undefined && effect.when !== null) {
    errors.push(...collectConditionErrors(effect.when, `${path}.when`, 1));
  }

  return createValidationResult({ errors });
}

/**
 * Lê o nível relevante para uma condição `level`: o nível da classe indicada,
 * quando `condition.class` está presente, ou o nível geral do personagem.
 * Devolve `{ok:true, level}` (level pode ser `null` = o personagem não tem
 * aquela classe) ou `{ok:false, error}`.
 * @param {object} condition
 * @param {object} context
 * @returns {{ok: true, level: number | null} | {ok: false, error: object}}
 */
function readConditionLevel(condition, context) {
  if (hasOwn(condition, 'class')) {
    if (!isPlainObject(context?.classLevels)) {
      return {
        ok: false,
        error: predicateError(
          'EFFECT_CONDITION_CONTEXT_MISSING',
          'A condição de nível por classe exige "classLevels" no contexto.',
          { kind: 'level', class: String(condition.class) },
        ),
      };
    }
    const classLevel = hasOwn(context.classLevels, condition.class) ? context.classLevels[condition.class] : null;
    if (classLevel === null || classLevel === undefined) {
      // O personagem simplesmente não tem essa classe: condição falsa.
      return { ok: true, level: null };
    }
    if (!Number.isInteger(classLevel) || classLevel < 0) {
      return {
        ok: false,
        error: predicateError('EFFECT_CONDITION_CONTEXT_MISSING', 'O nível da classe no contexto não é um inteiro.', {
          kind: 'level',
          class: String(condition.class),
        }),
      };
    }
    return { ok: true, level: classLevel };
  }

  if (!Number.isInteger(context?.level) || context.level < 1) {
    return {
      ok: false,
      error: predicateError('EFFECT_CONDITION_CONTEXT_MISSING', 'A condição de nível exige "level" inteiro no contexto.', {
        kind: 'level',
      }),
    };
  }
  return { ok: true, level: context.level };
}

/**
 * Avalia uma expressão de condição fechada contra o contexto do personagem.
 * `undefined`/`null` significa "sem gating" e devolve `true`.
 *
 * O contexto é lido sempre por propriedade PRÓPRIA:
 *   - `level` (inteiro) e `classLevels` (mapa ContentId -> nível);
 *   - `choices` (mapa choiceId -> string | array de strings);
 *   - `equippedItemIds` (array ou Set de ContentIds);
 *   - `stateFlags` (mapa flag -> boolean).
 *
 * @param {*} condition
 * @param {object} context
 * @param {number} [depth] - uso interno na recursão.
 * @returns {import('../../core/result.js').Result}
 */
export function evaluateEffectCondition(condition, context = {}, depth = 1) {
  if (condition === undefined || condition === null) {
    return ok(true);
  }
  if (depth > MAX_CONDITION_DEPTH) {
    return err(
      predicateError('EFFECT_CONDITION_TOO_DEEP', 'A condição excede a profundidade máxima de aninhamento.', {
        maxDepth: MAX_CONDITION_DEPTH,
      }),
    );
  }

  // Reaproveita a validação de forma: uma condição malformada nunca é
  // "avaliada como false" em silêncio.
  const shapeErrors = collectConditionErrors(condition, 'condition', depth);
  if (shapeErrors.length > 0) {
    return err(shapeErrors[0]);
  }

  switch (condition.kind) {
    case 'level': {
      const read = readConditionLevel(condition, context);
      if (!read.ok) {
        return err(read.error);
      }
      if (read.level === null) {
        return ok(false);
      }
      if (read.level < condition.min) {
        return ok(false);
      }
      if (hasOwn(condition, 'max') && read.level > condition.max) {
        return ok(false);
      }
      return ok(true);
    }
    case 'choice': {
      if (!isPlainObject(context?.choices)) {
        return err(
          predicateError('EFFECT_CONDITION_CONTEXT_MISSING', 'A condição de escolha exige "choices" no contexto.', {
            kind: 'choice',
            choiceId: String(condition.choiceId),
          }),
        );
      }
      if (!hasOwn(context.choices, condition.choiceId)) {
        return ok(false);
      }
      const selected = context.choices[condition.choiceId];
      if (typeof selected === 'string') {
        return ok(selected === condition.equals);
      }
      if (Array.isArray(selected)) {
        return ok(selected.includes(condition.equals));
      }
      return ok(false);
    }
    case 'equipped': {
      const equipped = context?.equippedItemIds;
      if (equipped instanceof Set) {
        return ok(equipped.has(condition.item));
      }
      if (Array.isArray(equipped)) {
        return ok(equipped.includes(condition.item));
      }
      return err(
        predicateError(
          'EFFECT_CONDITION_CONTEXT_MISSING',
          'A condição de item equipado exige "equippedItemIds" (array ou Set) no contexto.',
          { kind: 'equipped', item: String(condition.item) },
        ),
      );
    }
    case 'state-flag': {
      // `equals` ausente equivale a `true` — é o `default` declarado pelo
      // próprio schema, não um default inventado aqui.
      const expected = hasOwn(condition, 'equals') ? condition.equals : true;
      const flags = context?.stateFlags;
      const actual = hasOwn(flags, condition.flag) && flags[condition.flag] === true;
      return ok(actual === expected);
    }
    case 'all': {
      for (const [index, child] of condition.conditions.entries()) {
        void index;
        const result = evaluateEffectCondition(child, context, depth + 1);
        if (!result.ok) {
          return result;
        }
        if (result.value === false) {
          return ok(false);
        }
      }
      return ok(true);
    }
    case 'any': {
      let anyTrue = false;
      for (const child of condition.conditions) {
        const result = evaluateEffectCondition(child, context, depth + 1);
        if (!result.ok) {
          return result;
        }
        if (result.value === true) {
          anyTrue = true;
        }
      }
      return ok(anyTrue);
    }
    case 'not': {
      const result = evaluateEffectCondition(condition.condition, context, depth + 1);
      return result.ok ? ok(result.value === false) : result;
    }
    default:
      // Inalcançável: a forma já foi validada acima.
      return err(predicateError('EFFECT_CONDITION_UNKNOWN_KIND', 'Condição não interpretável.', {}));
  }
}

// Vocabulário FECHADO de alvos de conjunto (concessões). É o análogo, para
// conjuntos de IDs, do vocabulário de paths de `EFFECT_TARGET_NAMESPACES`:
// nenhum alvo de conjunto pode ser inventado por conteúdo.
export const SET_TARGETS = Object.freeze([
  'proficiency',
  'expertise',
  'language',
  'defense.resistance',
  'defense.immunity',
  'defense.vulnerability',
  'spell.granted',
  'spell.always-prepared',
  'item.granted',
  'resource.granted',
  'condition',
]);

const SET_TARGET_SET = new Set(SET_TARGETS);

// Operações fechadas de conjunto.
export const SET_OPERATIONS = Object.freeze(['add-ids', 'remove-ids', 'replace-ids']);
const SET_OPERATION_SET = new Set(SET_OPERATIONS);

/**
 * Diz se `target` é um alvo de conjunto conhecido.
 * @param {*} target
 * @returns {boolean}
 */
export function isKnownSetTarget(target) {
  return typeof target === 'string' && SET_TARGET_SET.has(target);
}

/**
 * Diz se `operation` é uma operação de conjunto conhecida.
 * @param {*} operation
 * @returns {boolean}
 */
export function isKnownSetOperation(operation) {
  return typeof operation === 'string' && SET_OPERATION_SET.has(operation);
}

/**
 * Deriva, de um efeito de concessão, o alvo de conjunto e os IDs que ele
 * acrescenta. Efeitos que não concedem conjunto (modifier, choice,
 * official-handler, manual) devolvem `null`.
 *
 * A ausência de `level` num efeito de proficiência significa proficiência
 * simples: `expertise` SÓ existe quando declarada explicitamente.
 *
 * @param {*} effect
 * @returns {{setTarget: string, ids: ReadonlyArray<string>} | null}
 */
export function setContributionForEffect(effect) {
  if (!isPlainObject(effect) || typeof effect.type !== 'string') {
    return null;
  }
  switch (effect.type) {
    case 'proficiency':
      return {
        setTarget: effect.level === 'expertise' ? 'expertise' : 'proficiency',
        ids: Object.freeze([String(effect.target)]),
      };
    case 'language':
      return { setTarget: 'language', ids: Object.freeze([String(effect.language)]) };
    case 'defense':
      return { setTarget: `defense.${String(effect.mode)}`, ids: Object.freeze([String(effect.damageType)]) };
    case 'grant-spell':
      return {
        setTarget: effect.alwaysPrepared === true ? 'spell.always-prepared' : 'spell.granted',
        ids: Object.freeze([String(effect.spell)]),
      };
    case 'grant-item':
      return { setTarget: 'item.granted', ids: Object.freeze([String(effect.item)]) };
    case 'resource':
      return { setTarget: 'resource.granted', ids: Object.freeze([String(effect.resource)]) };
    case 'condition':
      return { setTarget: 'condition', ids: Object.freeze([String(effect.condition)]) };
    default:
      return null;
  }
}

/**
 * Devolve a `priority` efetiva de um efeito: o inteiro declarado, ou 0 quando
 * ausente (a ausência EQUIVALE a 0 por contrato do schema).
 * @param {*} effect
 * @returns {number}
 */
export function effectPriority(effect) {
  return hasOwn(effect, 'priority') && Number.isSafeInteger(effect.priority) ? effect.priority : 0;
}

/**
 * Devolve a `stackKey` de um efeito, ou `null` quando ausente (ausência =
 * sempre acumula, nunca deduplica).
 * @param {*} effect
 * @returns {string | null}
 */
export function effectStackKey(effect) {
  return hasOwn(effect, 'stackKey') && typeof effect.stackKey === 'string' ? effect.stackKey : null;
}

/**
 * Devolve se um efeito é acumulável: `stackable` declarado, ou `true` quando
 * ausente (default do schema).
 * @param {*} effect
 * @returns {boolean}
 */
export function effectStackable(effect) {
  return hasOwn(effect, 'stackable') && typeof effect.stackable === 'boolean' ? effect.stackable : true;
}
