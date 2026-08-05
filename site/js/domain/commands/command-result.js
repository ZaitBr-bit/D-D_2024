// Módulo `domain/commands/command-result`: contrato único de retorno de todo
// comando de mutação de personagem (Task 17+). Não é o `Result` genérico de
// `core/result.js` (que só tem `{ok, value}`/`{ok, error}`) — é um envelope
// mais rico, porque um comando de personagem precisa devolver SEMPRE o
// personagem (o novo em sucesso, o original inalterado em falha) mais os
// efeitos colaterais observáveis (`events`) e os pontos do modelo que
// mudaram (`affected`), para que a camada de UI (Task 29) saiba o que
// redesenhar sem comparar o personagem inteiro.
//
// ## Contrato (ver brief da Task 17)
//
//   sucesso: { ok: true,  character: next,     events: [...], affected: [...] }
//   falha:   { ok: false, character: original, events: [],    affected: [], error }
//
// `affected` está SEMPRE presente como array (nunca `undefined`) nos dois
// ramos — vazio na falha, por definição (nada mudou). Cada elemento é um
// path do MESMO vocabulário usado pelo motor de efeitos da Task 15
// (`domain/effects/effect-predicates.js#EFFECT_TARGET_NAMESPACES`, ex.:
// `"hp.current"`) quando o campo pertence a esse vocabulário fechado, ou o
// path pontilhado do campo real do schema canônico (ex.: `"state.conditions"`)
// quando não pertence (`state.*` não é um alvo derivado de efeito — é
// simplesmente onde o campo mora no personagem). A Task 29 mapeia cada path
// possível para `dirtySections` da UI.

import { createAppError } from '../../core/errors.js';

const SCOPE = 'domain.commands';

/**
 * Cria um AppError do escopo de comandos de personagem. Reexportado para que
 * cada módulo de comando (`hit-points.js`, `rest.js`, ...) use o mesmo
 * `scope`, sem duplicar a constante.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {Readonly<object>}
 */
export function commandError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Congela rasamente um array de strings (paths de `affected`/lista de
 * `events`), sem exigir que já seja um array congelado.
 * @param {ReadonlyArray<*>} list
 * @returns {ReadonlyArray<*>}
 */
function freezeList(list) {
  return Object.freeze([...(Array.isArray(list) ? list : [])]);
}

/**
 * Constrói o envelope de SUCESSO de um comando de personagem.
 * @param {{character: object, events?: ReadonlyArray<object>, affected?: ReadonlyArray<string>}} params
 * @returns {Readonly<{ok: true, character: object, events: ReadonlyArray<object>, affected: ReadonlyArray<string>}>}
 */
export function commandOk({ character, events = [], affected = [] }) {
  return Object.freeze({
    ok: true,
    character,
    events: freezeList(events),
    affected: freezeList(affected),
  });
}

/**
 * Constrói o envelope de FALHA de um comando de personagem. `character` é
 * SEMPRE o personagem ORIGINAL (recebido antes da tentativa) — nunca uma
 * versão parcialmente mutada — e `affected` é sempre `[]`, por definição
 * (nada mudou quando o comando falha).
 * @param {{character: object, error: object}} params
 * @returns {Readonly<{ok: false, character: object, events: ReadonlyArray<object>, affected: ReadonlyArray<string>, error: object}>}
 */
export function commandErr({ character, error }) {
  return Object.freeze({
    ok: false,
    character,
    events: Object.freeze([]),
    affected: Object.freeze([]),
    error,
  });
}

/**
 * Diz se `value` tem a forma de um CommandResult (`{ok, character, events,
 * affected}`, mais `error` quando `ok === false`). Usada por
 * `command-dispatcher.js` para validar o que um handler de comando devolveu,
 * sem confiar cegamente nele.
 * @param {*} value
 * @returns {boolean}
 */
export function isCommandResult(value) {
  if (value === null || typeof value !== 'object' || typeof value.ok !== 'boolean') {
    return false;
  }
  if (!Array.isArray(value.events) || !Array.isArray(value.affected)) {
    return false;
  }
  if (!('character' in value)) {
    return false;
  }
  return value.ok ? true : 'error' in value;
}
