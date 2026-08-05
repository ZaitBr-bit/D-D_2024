// Módulo `domain/rulesets/dnd2024/handlers/register-martial-handlers`: a
// ponte entre os quatro handlers marciais (contrato de 4 métodos) e o
// `OfficialHandlerRegistry` (que registra UMA função por `handlerId`).
//
// ## Por que existe um adapter
//
// O registry executa `handler({entityId, handlerId, operation, payload,
// context})` e exige um `Result` de volta. O contrato de handler de classe
// tem quatro métodos. O adapter traduz `operation` -> método:
//
//   'project'            -> project(character, context)            : Result
//   'contribute-effects' -> contributeEffects(character, context)  : Result
//   'execute'            -> execute(character, {actionId, payload}, context) : CommandResult
//   'rest'               -> onRest(character, {kind}, context)     : CommandResult
//
// `execute`/`onRest` devolvem CommandResult (não `Result`), então o adapter
// os embrulha em `ok(commandResult)` — o CommandResult inteiro, com `ok`
// próprio, `character`, `events` e `affected`, chega intacto a quem chamou.
//
// ## Autorização e declaração no conteúdo
//
// O adapter NÃO decide capacidade: quando ele roda, a autorização opaca de
// uso único já foi verificada e consumida por
// `domain/effects/official-handler-registry.js#invokeAuthorized`, e o
// `OfficialHandlerInvoker` (`content/registry.js#invoke`) já provou que a
// entidade `entityId` DECLARA aquele `handlerId` num efeito
// `official-handler`. O adapter acrescenta só a checagem de escopo que o
// invoker não pode fazer: que `entityId` é exatamente a entidade de classe
// dona daquele handler (um efeito `official-handler` com
// `handlerId: "class-barbaro"` colado noutra entidade é recusado aqui).
//
// `verifyMartialHandlerDeclarations(contentRegistry)` fecha o outro lado:
// prova, contra o catálogo REAL, que cada handler registrado é declarado
// pela sua entidade de classe. É o "rejeitar IDs não declarados no conteúdo"
// do brief, executável em teste e no boot — e não pode rodar no construtor
// do app-context, porque lá o catálogo ainda nem foi buscado
// (`createAppContext` monta o registry antes de `initializeContent()`).

import { ok, err } from '../../../../core/result.js';
import { createAppError } from '../../../../core/errors.js';
import { withEffectContextVariables } from '../../../character/queries/context-variables.js';
import { HANDLER_OPERATIONS, REST_KINDS } from './class-handler.js';
import { barbaroHandler } from './barbaro.js';
import { guerreiroHandler } from './guerreiro.js';
import { ladinoHandler } from './ladino.js';
import { mongeHandler } from './monge.js';

const SCOPE = 'domain.rulesets.dnd2024.handlers.register';

// Os quatro handlers marciais desta tarefa, na ordem canônica do brief.
export const MARTIAL_CLASS_HANDLERS = Object.freeze([
  barbaroHandler,
  guerreiroHandler,
  ladinoHandler,
  mongeHandler,
]);

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {Readonly<object>}
 */
function registerError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Cria a função adapter registrada no `OfficialHandlerRegistry` para um
 * handler de classe.
 * @param {object} handler - handler de classe (contrato de 4 métodos)
 * @returns {Function}
 */
export function createHandlerAdapter(handler) {
  /**
   * Ponto de entrada chamado por `invokeAuthorized` (já autorizado).
   * @param {{entityId: string, handlerId: string, operation: string, payload?: *, context?: *}} request
   * @returns {import('../../../../core/result.js').Result}
   */
  return function invokeClassHandler(request) {
    const { entityId, operation, payload, context } = request;
    if (entityId !== handler.classId) {
      return err(
        registerError(
          'MARTIAL_HANDLER_ENTITY_MISMATCH',
          `O handler "${handler.id}" só atende a entidade "${handler.classId}".`,
          { handlerId: handler.id, expectedEntityId: handler.classId, entityId },
        ),
      );
    }
    if (!HANDLER_OPERATIONS.includes(operation)) {
      return err(
        registerError('MARTIAL_HANDLER_OPERATION_UNKNOWN', `Operação "${operation}" não pertence ao contrato.`, {
          handlerId: handler.id,
          operation,
          knownOperations: [...HANDLER_OPERATIONS],
        }),
      );
    }
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return err(
        registerError('MARTIAL_HANDLER_PAYLOAD_INVALID', 'O payload deve ser um objeto {character, ...}.', {
          handlerId: handler.id,
          operation,
        }),
      );
    }
    const { character } = payload;
    if (character === null || typeof character !== 'object' || Array.isArray(character)) {
      return err(
        registerError('MARTIAL_HANDLER_PAYLOAD_INVALID', 'O payload deve trazer "character".', {
          handlerId: handler.id,
          operation,
        }),
      );
    }
    const rawContext = context === null || typeof context !== 'object' ? {} : context;

    // --- `context.variables` (Task 22a) ------------------------------------
    //
    // Este adapter é o ÚNICO ponto de entrada de produção dos handlers de
    // classe (o registry só chega aqui depois de autorizar a invocação), então
    // é aqui que as variáveis numéricas do personagem são resolvidas UMA vez e
    // entregues a `project`/`contributeEffects`/`execute`/`onRest`. Sem isso,
    // um `max` declarado como `"carismaModifierMin1"` (Inspiração de Bardo)
    // cairia em `EFFECT_VALUE_NOT_NUMERIC`.
    //
    // Falha de resolução é ERRO EXPLÍCITO, nunca "segue sem variáveis": um
    // handler chamado com contexto incompleto projetaria "recurso não
    // concedido" para um recurso que o personagem TEM — o bypass silencioso de
    // dependência ausente que as revisões anteriores já pegaram.
    const enriched = withEffectContextVariables(character, rawContext);
    if (enriched.ok !== true) {
      return enriched;
    }
    const handlerContext = enriched.value;

    if (operation === 'project') {
      return handler.project(character, handlerContext);
    }
    if (operation === 'contribute-effects') {
      return handler.contributeEffects(character, handlerContext);
    }
    if (operation === 'execute') {
      return ok(
        handler.execute(character, { actionId: payload.actionId, payload: payload.actionPayload }, handlerContext),
      );
    }
    // operation === 'rest'
    if (!REST_KINDS.includes(payload.kind)) {
      return err(
        registerError('MARTIAL_HANDLER_PAYLOAD_INVALID', 'O descanso exige payload.kind: "short" | "long".', {
          handlerId: handler.id,
          kind: typeof payload.kind === 'string' ? payload.kind : null,
        }),
      );
    }
    return ok(handler.onRest(character, { kind: payload.kind }, handlerContext));
  };
}

/**
 * Monta as entradas `{handlerId, handler}` que o composition root
 * (`site/js/app-context.js`) passa para `createOfficialHandlerRegistry`.
 * Este é o ÚNICO ponto de registro: nenhum manifesto ou entidade JSON
 * escolhe o que é registrado (Global Constraint de `officialHandlers`).
 * @returns {ReadonlyArray<{handlerId: string, handler: Function}>}
 */
export function createMartialHandlerRegistrations() {
  return Object.freeze(
    MARTIAL_CLASS_HANDLERS.map((handler) =>
      Object.freeze({ handlerId: handler.id, handler: createHandlerAdapter(handler) }),
    ),
  );
}

/**
 * Diz se `entity` declara `handlerId` num efeito `official-handler`. Mesma
 * regra de `content/registry.js#declaresHandler`, reimplementada aqui porque
 * `domain/**` não pode importar de `content/registry.js` sem inverter a
 * dependência do runtime de conteúdo.
 * @param {*} entity
 * @param {string} handlerId
 * @returns {boolean}
 */
function declaresHandler(entity, handlerId) {
  return (
    entity !== null &&
    typeof entity === 'object' &&
    Array.isArray(entity.effects) &&
    entity.effects.some(
      (effect) =>
        effect !== null &&
        typeof effect === 'object' &&
        effect.type === 'official-handler' &&
        effect.handlerId === handlerId,
    )
  );
}

/**
 * Prova, contra o catálogo real, que cada handler marcial é declarado pela
 * sua entidade de classe. Um handler registrado sem declaração no conteúdo é
 * código inalcançável (o invoker o recusaria em runtime) — melhor descobrir
 * aqui do que no primeiro clique do usuário.
 * @param {{resolve: Function}} contentRegistry
 * @returns {import('../../../../core/result.js').Result} `ok(ReadonlyArray<string>)` com os IDs verificados
 */
export function verifyMartialHandlerDeclarations(contentRegistry) {
  return verifyHandlerDeclarations(MARTIAL_CLASS_HANDLERS, contentRegistry);
}

/**
 * Forma genérica de `verifyMartialHandlerDeclarations`, compartilhada com
 * `register-divine-primal-handlers.js` (Task 21) para que a regra "todo
 * handler registrado é declarado pela sua entidade de classe" exista em UM
 * lugar só. Os códigos de erro seguem com o prefixo `MARTIAL_HANDLER_` por
 * compatibilidade com o contrato já revisado da Task 20 — ver a concern de
 * nomenclatura no relatório da Task 21.
 * @param {ReadonlyArray<{id: string, classId: string}>} handlers
 * @param {{resolve: Function}} contentRegistry
 * @returns {import('../../../../core/result.js').Result} `ok(ReadonlyArray<string>)`
 */
export function verifyHandlerDeclarations(handlers, contentRegistry) {
  if (contentRegistry === null || typeof contentRegistry !== 'object' || typeof contentRegistry.resolve !== 'function') {
    return err(
      registerError('MARTIAL_HANDLER_REGISTRY_INVALID', 'A verificação exige um catálogo com resolve().', {}),
    );
  }
  const undeclared = [];
  const verified = [];
  for (const handler of handlers) {
    const resolved = contentRegistry.resolve(handler.classId);
    if (!resolved || resolved.ok !== true || !declaresHandler(resolved.value, handler.id)) {
      undeclared.push({ handlerId: handler.id, classId: handler.classId });
      continue;
    }
    verified.push(handler.id);
  }
  if (undeclared.length > 0) {
    return err(
      registerError(
        'MARTIAL_HANDLER_NOT_DECLARED',
        'Há handler de classe registrado que nenhuma entidade de classe declara no conteúdo.',
        { undeclared },
      ),
    );
  }
  return ok(Object.freeze(verified));
}
