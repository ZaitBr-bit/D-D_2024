// Módulo `content/capabilities`: define as capacidades concedidas a uma
// fonte de conteúdo pelo composition root.
//
// ## Modelo de segurança
//
// A única capacidade privilegiada do sistema é `officialHandlers`: ela
// autoriza que uma entidade acione um handler oficial — código executável de
// verdade (por exemplo, a mecânica de Fúria do Bárbaro). Conteúdo vindo de
// JSON é sempre não confiável, mesmo dentro do pacote oficial; portanto
// nenhum campo de manifesto ou de entidade (`namespace`, `authors`,
// `"official": true`, `"officialHandlers": true`, ...) pode conceder essa
// capacidade. Só o composition root pode, chamando
// `createOfficialSourceCapabilities()`.
//
// Por isso o token:
//   1. é um `Symbol` sem descrição criado UMA vez no fechamento deste módulo
//      e nunca exportado — não há como obtê-lo importando este módulo;
//   2. some de qualquer serialização: `JSON.stringify` ignora valores
//      `symbol`, então o token nunca entra em log, contexto de erro ou JSON;
//   3. não basta possuí-lo. `hasOfficialHandlersCapability` também exige que
//      o PRÓPRIO objeto de capacidades tenha sido criado por este módulo
//      (`WeakSet` de identidade). Copiar o token para outro objeto
//      (`{...capacidadesOficiais}`) não transfere a capacidade.
//
// Quem pode chamar `createOfficialSourceCapabilities()` é verificado
// estaticamente por `scripts/check-architecture.mjs` (regra
// `official-capability-restricted-reference`): somente
// `site/js/app-context.js`.

import { createAppError } from '../core/errors.js';

// Token opaco de capacidade. Vive apenas neste fechamento de módulo.
// `Symbol()` sem descrição: nada de útil vaza nem em `String(token)`.
const OFFICIAL_HANDLERS_TOKEN = Symbol();

// Namespace reservado ao pacote oficial. Só `createOfficialSourceCapabilities`
// pode concedê-lo; `createSourceCapabilities` o recusa explicitamente.
const OFFICIAL_NAMESPACE = 'dnd2024';

// Identidade dos objetos de capacidades realmente criados por este módulo com
// a capacidade oficial. `WeakSet` para não impedir a coleta de lixo.
const officialCapabilityObjects = new WeakSet();

// Mesmo formato de segmento de `core/content-id.js`: ASCII minúsculo,
// dígitos e hífens internos.
const NAMESPACE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Valida o namespace concedido. Namespace inválido é defeito de programação
 * do composition root (não é dado de conteúdo), por isso lança.
 * @param {*} namespace
 * @returns {string}
 */
function requireValidNamespace(namespace) {
  if (typeof namespace !== 'string' || !NAMESPACE_PATTERN.test(namespace)) {
    throw new TypeError(
      'createSourceCapabilities: "namespace" deve ser um segmento ASCII minúsculo válido (kebab-case).',
    );
  }
  return namespace;
}

/**
 * Cria as capacidades da fonte oficial: o namespace reservado `dnd2024` e o
 * token opaco `officialHandlers`.
 *
 * RESTRITO AO COMPOSITION ROOT (`site/js/app-context.js`). Qualquer outro
 * módulo de produção que importe ou mencione esta função é reprovado por
 * `npm run check:architecture`.
 *
 * @returns {Readonly<{namespace: string, officialHandlers: symbol}>}
 */
export function createOfficialSourceCapabilities() {
  const capabilities = Object.freeze({
    namespace: OFFICIAL_NAMESPACE,
    officialHandlers: OFFICIAL_HANDLERS_TOKEN,
  });
  officialCapabilityObjects.add(capabilities);
  return capabilities;
}

/**
 * Cria capacidades comuns (sem nenhum privilégio) para uma fonte não
 * oficial: apenas o namespace concedido pelo composition root. O objeto
 * devolvido nunca tem `officialHandlers`, e por ser congelado também não
 * pode receber a chave depois.
 *
 * O namespace oficial é recusado aqui de propósito: ele só pode ser
 * concedido por `createOfficialSourceCapabilities()`.
 *
 * @param {{namespace: string}} params
 * @returns {Readonly<{namespace: string}>}
 */
export function createSourceCapabilities({ namespace } = {}) {
  const validNamespace = requireValidNamespace(namespace);
  if (validNamespace === OFFICIAL_NAMESPACE) {
    throw new TypeError(
      `createSourceCapabilities: o namespace "${OFFICIAL_NAMESPACE}" é reservado ao pacote oficial.`,
    );
  }
  return Object.freeze({ namespace: validNamespace });
}

/**
 * Diz se `capabilities` concede a capacidade `officialHandlers`.
 *
 * Exige as duas coisas ao mesmo tempo: que o objeto tenha sido criado por
 * `createOfficialSourceCapabilities()` (identidade, via WeakSet) e que
 * carregue o token do fechamento deste módulo (identidade de referência).
 * Qualquer objeto literal, cópia por spread ou `Symbol` fabricado por
 * terceiros devolve `false`.
 *
 * @param {*} capabilities
 * @returns {boolean}
 */
export function hasOfficialHandlersCapability(capabilities) {
  if (capabilities === null || typeof capabilities !== 'object') {
    return false;
  }
  return (
    officialCapabilityObjects.has(capabilities) &&
    capabilities.officialHandlers === OFFICIAL_HANDLERS_TOKEN
  );
}

/**
 * Valida um objeto de capacidades vindo do composition root, devolvendo o
 * namespace concedido ou um AppError. Usado pelo `ContentRegistry` em
 * `registerSource`; nunca inspeciona nem confia em `officialHandlers` — essa
 * pergunta é respondida só por `hasOfficialHandlersCapability`.
 * @param {*} capabilities
 * @returns {{ok: true, namespace: string} | {ok: false, error: object}}
 */
export function describeCapabilities(capabilities) {
  if (capabilities === null || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
    return {
      ok: false,
      error: createAppError({
        code: 'CONTENT_CAPABILITIES_INVALID',
        scope: 'content.capabilities',
        message: 'As capacidades da fonte devem ser um objeto com um namespace concedido.',
        context: { receivedType: Array.isArray(capabilities) ? 'array' : typeof capabilities },
      }),
    };
  }
  if (typeof capabilities.namespace !== 'string' || !NAMESPACE_PATTERN.test(capabilities.namespace)) {
    return {
      ok: false,
      error: createAppError({
        code: 'CONTENT_CAPABILITIES_INVALID',
        scope: 'content.capabilities',
        message: 'As capacidades da fonte devem conceder um namespace ASCII minúsculo válido.',
        context: { namespace: typeof capabilities.namespace === 'string' ? capabilities.namespace : null },
      }),
    };
  }
  // O namespace oficial só pode ser reivindicado por capacidades realmente
  // criadas por `createOfficialSourceCapabilities()`. Sem esta checagem, um
  // objeto forjado `{namespace: "dnd2024"}` não ganharia privilégio nenhum
  // (`hasOfficialHandlersCapability` continua `false`), mas conseguiria
  // OCUPAR o namespace no registry e fazer a fonte oficial legítima falhar
  // depois com CONTENT_NAMESPACE_ALREADY_REGISTERED — negação de serviço.
  if (capabilities.namespace === OFFICIAL_NAMESPACE && !hasOfficialHandlersCapability(capabilities)) {
    return {
      ok: false,
      error: createAppError({
        code: 'CONTENT_CAPABILITIES_INVALID',
        scope: 'content.capabilities',
        message: `O namespace "${OFFICIAL_NAMESPACE}" é reservado ao pacote oficial e não pode ser concedido por capacidades avulsas.`,
        context: { namespace: capabilities.namespace },
      }),
    };
  }

  return { ok: true, namespace: capabilities.namespace };
}
