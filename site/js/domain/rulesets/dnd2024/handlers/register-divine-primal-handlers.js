// Módulo `domain/rulesets/dnd2024/handlers/register-divine-primal-handlers`:
// o mesmo papel que `register-martial-handlers.js` cumpre para a Task 20,
// agora para os quatro handlers divinos/primitivos da Task 21 (Clérigo,
// Druida, Guardião, Paladino).
//
// ## Por que um módulo separado, e não uma lista maior no arquivo da Task 20
//
// O adapter `operation -> método`, a checagem de escopo de entidade e a
// verificação de declaração no conteúdo são EXATAMENTE os mesmos — por isso
// eles são REUTILIZADOS daqui (`createHandlerAdapter`,
// `verifyHandlerDeclarations`), e não copiados. O que muda é só a LISTA de
// handlers. Manter as duas listas em módulos distintos preserva a
// rastreabilidade tarefa->handler que o plano pede, sem duplicar algoritmo.
//
// ## Rejeitar IDs não declarados no conteúdo
//
// `verifyDivinePrimalHandlerDeclarations(contentRegistry)` prova, contra o
// catálogo REAL, que cada handler registrado aqui é declarado por um efeito
// `official-handler` na própria entidade de classe
// (`dados/pacotes/dnd2024/classes/{clerigo,druida,guardiao,paladino}.json`,
// efeito `handler-de-classe`, emitido por
// `scripts/content/migrate-classes.mjs#HANDLER_DE_CLASSE_POR_SLUG`). Um
// handler registrado sem declaração é código inalcançável — o
// `OfficialHandlerInvoker` o recusaria em runtime.

import { createHandlerAdapter, verifyHandlerDeclarations } from './register-martial-handlers.js';
import { clerigoHandler } from './clerigo.js';
import { druidaHandler } from './druida.js';
import { guardiaoHandler } from './guardiao.js';
import { paladinoHandler } from './paladino.js';

// Os quatro handlers desta tarefa, na ordem canônica do brief.
export const DIVINE_PRIMAL_CLASS_HANDLERS = Object.freeze([
  clerigoHandler,
  druidaHandler,
  guardiaoHandler,
  paladinoHandler,
]);

/**
 * Monta as entradas `{handlerId, handler}` que o composition root
 * (`site/js/app-context.js`) acrescenta às da Task 20 ao chamar
 * `createOfficialHandlerRegistry`. Este e o módulo marcial são os ÚNICOS
 * pontos de registro: nenhum manifesto ou entidade JSON escolhe o que é
 * registrado (Global Constraint de `officialHandlers`).
 * @returns {ReadonlyArray<{handlerId: string, handler: Function}>}
 */
export function createDivinePrimalHandlerRegistrations() {
  return Object.freeze(
    DIVINE_PRIMAL_CLASS_HANDLERS.map((handler) =>
      Object.freeze({ handlerId: handler.id, handler: createHandlerAdapter(handler) }),
    ),
  );
}

/**
 * Prova, contra o catálogo real, que cada handler divino/primitivo é
 * declarado pela sua entidade de classe.
 * @param {{resolve: Function}} contentRegistry
 * @returns {import('../../../../core/result.js').Result} `ok(ReadonlyArray<string>)`
 */
export function verifyDivinePrimalHandlerDeclarations(contentRegistry) {
  return verifyHandlerDeclarations(DIVINE_PRIMAL_CLASS_HANDLERS, contentRegistry);
}
