// Módulo `domain/rulesets/dnd2024/handlers/register-all` (Task 22a): o ÚNICO
// ponto de composição dos handlers de classe do ruleset dnd2024.
//
// Até a Task 21, `site/js/app-context.js` espalhava a composição na própria
// assinatura (`[...createMartialHandlerRegistrations(),
// ...createDivinePrimalHandlerRegistrations()]`), o que obrigava o composition
// root a ser editado a cada tarefa de handler e tornava fácil registrar um
// handler novo sem a verificação de declaração correspondente. Aqui as duas
// listas — registros e verificação — nascem da MESMA fonte
// (`ALL_CLASS_HANDLERS`), então não há como uma crescer sem a outra.
//
// Nenhum manifesto ou entidade JSON escolhe o que é registrado (Global
// Constraint de `officialHandlers`): o conteúdo só DECLARA, via efeito
// `official-handler`, que quer acionar um handler.

import { MARTIAL_CLASS_HANDLERS, createHandlerAdapter, verifyHandlerDeclarations } from './register-martial-handlers.js';
import { DIVINE_PRIMAL_CLASS_HANDLERS } from './register-divine-primal-handlers.js';
import { ARCANE_CLASS_HANDLERS } from './register-arcane-handlers.js';

/**
 * Os doze handlers de classe com implementação oficial, na ordem das tarefas
 * que os introduziram (20 -> 21 -> 22a).
 * @type {ReadonlyArray<{id: string, classId: string}>}
 */
export const ALL_CLASS_HANDLERS = Object.freeze([
  ...MARTIAL_CLASS_HANDLERS,
  ...DIVINE_PRIMAL_CLASS_HANDLERS,
  ...ARCANE_CLASS_HANDLERS,
]);

/**
 * Monta TODAS as entradas `{handlerId, handler}` que o composition root
 * (`site/js/app-context.js`) passa para `createOfficialHandlerRegistry`.
 * @returns {ReadonlyArray<{handlerId: string, handler: Function}>}
 */
export function createAllClassHandlerRegistrations() {
  return Object.freeze(
    ALL_CLASS_HANDLERS.map((handler) =>
      Object.freeze({ handlerId: handler.id, handler: createHandlerAdapter(handler) }),
    ),
  );
}

/**
 * Prova, contra o catálogo real, que cada um dos doze handlers registrados é
 * declarado pela sua entidade de classe. Precisa do catálogo já ativo, por isso
 * vive nos testes/boot e não no construtor do app-context.
 * @param {{resolve: Function}} contentRegistry
 * @returns {import('../../../../core/result.js').Result} `ok(ReadonlyArray<string>)`
 */
export function verifyAllClassHandlerDeclarations(contentRegistry) {
  return verifyHandlerDeclarations(ALL_CLASS_HANDLERS, contentRegistry);
}
