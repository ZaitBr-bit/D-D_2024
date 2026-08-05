// Módulo `domain/rulesets/dnd2024/handlers/register-arcane-handlers`: o mesmo
// papel que `register-martial-handlers.js` (Task 20) e
// `register-divine-primal-handlers.js` (Task 21) cumprem para as suas tarefas,
// agora para os quatro handlers arcanos da Task 22a (Bardo, Bruxo, Feiticeiro,
// Mago).
//
// O adapter `operation -> método`, a checagem de escopo de entidade e a
// verificação de declaração no conteúdo são REUTILIZADOS
// (`createHandlerAdapter`, `verifyHandlerDeclarations`), nunca copiados: o que
// muda é só a LISTA de handlers, e manter uma lista por tarefa preserva a
// rastreabilidade tarefa->handler que o plano pede.
//
// `verifyArcaneHandlerDeclarations(contentRegistry)` prova, contra o catálogo
// REAL, que cada handler registrado aqui é declarado por um efeito
// `official-handler` na própria entidade de classe
// (`dados/pacotes/dnd2024/classes/{bardo,bruxo,feiticeiro,mago}.json`, efeito
// `handler-de-classe`, emitido por
// `scripts/content/migrate-classes.mjs#HANDLER_DE_CLASSE_POR_SLUG`).

import { createHandlerAdapter, verifyHandlerDeclarations } from './register-martial-handlers.js';
import { bardoHandler } from './bardo.js';
import { bruxoHandler } from './bruxo.js';
import { feiticeiroHandler } from './feiticeiro.js';
import { magoHandler } from './mago.js';

// Os quatro handlers desta tarefa, na ordem canônica do brief.
export const ARCANE_CLASS_HANDLERS = Object.freeze([
  bardoHandler,
  bruxoHandler,
  feiticeiroHandler,
  magoHandler,
]);

/**
 * Monta as entradas `{handlerId, handler}` dos handlers arcanos.
 * @returns {ReadonlyArray<{handlerId: string, handler: Function}>}
 */
export function createArcaneHandlerRegistrations() {
  return Object.freeze(
    ARCANE_CLASS_HANDLERS.map((handler) =>
      Object.freeze({ handlerId: handler.id, handler: createHandlerAdapter(handler) }),
    ),
  );
}

/**
 * Prova, contra o catálogo real, que cada handler arcano é declarado pela sua
 * entidade de classe.
 * @param {{resolve: Function}} contentRegistry
 * @returns {import('../../../../core/result.js').Result} `ok(ReadonlyArray<string>)`
 */
export function verifyArcaneHandlerDeclarations(contentRegistry) {
  return verifyHandlerDeclarations(ARCANE_CLASS_HANDLERS, contentRegistry);
}
