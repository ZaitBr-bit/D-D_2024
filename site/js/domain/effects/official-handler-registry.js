// Módulo `domain/effects/official-handler-registry`: o LADO EXECUTOR da ponte
// de autorização de handlers oficiais.
//
// ## Modelo de segurança (par com content/official-handler-authorization.js)
//
// O canal de autorização criado pelo composition root devolve `{issue, verify}`
// e entrega os dois a lados OPOSTOS:
//
//   - `issue`  -> `OfficialHandlerInvoker` (criado por `createContentRuntime`).
//                 Só ele decide, consultando por FECHAMENTO o ledger privado
//                 fonte->capacidade do catálogo, se a entidade tem direito de
//                 acionar aquele handler. Quem emite não executa.
//   - `verify` -> este módulo. Ele apenas VERIFICA e CONSOME a autorização e,
//                 se ela vale para o escopo exato, executa o handler
//                 registrado. Quem executa não emite.
//
// Consequências deliberadas do desenho:
//
//   - NÃO EXISTE um `invoke()` público sem autorização. A superfície é
//     exatamente `register` + `invokeAuthorized`, e o objeto é congelado.
//   - A autorização é opaca e comparada por IDENTIDADE de referência dentro do
//     canal emissor: um objeto literal com a "cara" de autorização, uma cópia,
//     ou uma autorização de OUTRO canal são todos recusados.
//   - A autorização é de USO ÚNICO e presa a `{entityId, handlerId, operation}`.
//     Trocar qualquer um dos três invalida.
//   - `verify` é chamado ANTES da busca do handler, de propósito: uma tentativa
//     contra um `handlerId` não registrado QUEIMA a autorização apresentada, em
//     vez de permitir sondar quais handlers existem sem custo.
//   - Namespace, autoria e campos JSON da entidade não participam de nada
//     disso — a decisão de capacidade já foi tomada pelo invoker.
//   - O handler NUNCA recebe a autorização: `invokeAuthorized` monta o
//     request do handler sem essa chave, e nenhum AppError daqui carrega a
//     autorização no `context` (só `cause`, que `serializeAppError` descarta).

import { ok, err, isResult } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';

const SCOPE = 'domain.effects.official-handler-registry';

// `handlerId` segue o mesmo formato localSlug de `officialHandlerEffect.handlerId`.
const HANDLER_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Nomes que nunca podem ser usados como `handlerId` (o mapa é um `Map`, então
// não há risco real de poluição de protótipo; a recusa é defesa em profundidade
// e mantém o vocabulário limpo).
const RESERVED_HANDLER_IDS = new Set([
  'constructor',
  'prototype',
  '__proto__',
  'toString',
  'valueOf',
  'hasOwnProperty',
]);

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {*} [cause]
 * @returns {object}
 */
function handlerError(code, message, context = {}, cause) {
  return createAppError({ code, scope: SCOPE, message, context, cause });
}

/**
 * Cria o registry de handlers oficiais.
 *
 * @param {{verifyAuthorization: Function}} params - `verifyAuthorization` é o
 *   `verify` do canal criado em `site/js/app-context.js`. O `issue`
 *   correspondente NUNCA chega até aqui.
 * @returns {Readonly<{register: Function, invokeAuthorized: Function}>}
 */
export function OfficialHandlerRegistry({ verifyAuthorization } = {}) {
  if (typeof verifyAuthorization !== 'function') {
    throw new TypeError('OfficialHandlerRegistry: "verifyAuthorization" deve ser uma função.');
  }

  // Estado privado: `Map` (não objeto), então nenhuma chave herdada existe.
  const handlers = new Map();

  /**
   * Registra um handler oficial. Sem sobrescrita implícita: registrar duas
   * vezes o mesmo `handlerId` é erro.
   * @param {string} handlerId
   * @param {Function} handler
   * @returns {import('../../core/result.js').Result}
   */
  function register(handlerId, handler) {
    if (typeof handlerId !== 'string' || !HANDLER_ID_PATTERN.test(handlerId) || RESERVED_HANDLER_IDS.has(handlerId)) {
      return err(
        handlerError('OFFICIAL_HANDLER_ID_INVALID', 'O "handlerId" deve ser um slug ASCII minúsculo não reservado.', {
          handlerId: typeof handlerId === 'string' ? handlerId : null,
        }),
      );
    }
    if (typeof handler !== 'function') {
      return err(
        handlerError('OFFICIAL_HANDLER_INVALID', `O handler "${handlerId}" deve ser uma função.`, {
          handlerId,
          receivedType: typeof handler,
        }),
      );
    }
    if (handlers.has(handlerId)) {
      return err(
        handlerError(
          'OFFICIAL_HANDLER_ALREADY_REGISTERED',
          `O handler "${handlerId}" já está registrado; não há sobrescrita implícita.`,
          { handlerId },
        ),
      );
    }
    handlers.set(handlerId, handler);
    return ok(undefined);
  }

  /**
   * Verifica/consome a autorização e, só então, executa o handler.
   * @param {{authorization: *, handlerId: string, entityId: string,
   *   operation: string, payload?: *, context?: *}} request
   * @returns {import('../../core/result.js').Result}
   */
  function invokeAuthorized(request) {
    if (request === null || typeof request !== 'object' || Array.isArray(request)) {
      return err(
        handlerError('OFFICIAL_HANDLER_INVALID_REQUEST', 'A requisição de handler deve ser um objeto.', {
          receivedType: Array.isArray(request) ? 'array' : typeof request,
        }),
      );
    }
    const { authorization, handlerId, entityId, operation, payload, context } = request;
    for (const [name, value] of [
      ['entityId', entityId],
      ['handlerId', handlerId],
      ['operation', operation],
    ]) {
      if (typeof value !== 'string' || value.length === 0) {
        return err(
          handlerError(
            'OFFICIAL_HANDLER_INVALID_REQUEST',
            `A requisição de handler exige "${name}" como string não vazia.`,
            { field: name },
          ),
        );
      }
    }

    // Verificação ANTES da busca do handler: consome a autorização mesmo
    // quando o handler não existe (ver comentário de topo).
    if (verifyAuthorization(authorization, { entityId, handlerId, operation }) !== true) {
      return err(
        handlerError(
          'OFFICIAL_HANDLER_NOT_AUTHORIZED',
          `A autorização apresentada não vale para ${handlerId}/${operation}.`,
          { entityId, handlerId, operation },
        ),
      );
    }

    const handler = handlers.get(handlerId);
    if (handler === undefined) {
      return err(
        handlerError('OFFICIAL_HANDLER_NOT_REGISTERED', `Nenhum handler oficial registrado para "${handlerId}".`, {
          entityId,
          handlerId,
          operation,
        }),
      );
    }

    let result;
    try {
      // O request do handler NÃO contém `authorization`.
      result = handler(Object.freeze({ entityId, handlerId, operation, payload, context }));
    } catch (cause) {
      return err(
        handlerError(
          'OFFICIAL_HANDLER_INVOCATION_FAILED',
          `O handler oficial "${handlerId}" lançou uma exceção.`,
          { entityId, handlerId, operation },
          cause,
        ),
      );
    }
    if (!isResult(result)) {
      return err(
        handlerError('OFFICIAL_HANDLER_INVOCATION_FAILED', `O handler oficial "${handlerId}" não devolveu um Result.`, {
          entityId,
          handlerId,
          operation,
          receivedType: typeof result,
        }),
      );
    }
    return result;
  }

  return Object.freeze({ register, invokeAuthorized });
}
