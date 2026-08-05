// Módulo `domain/commands/class-actions` (Task 30): a PONTE entre o vocabulário
// de comandos canônicos e os handlers de classe das Tasks 20/21/22a.
//
// ## Por que este módulo precisou existir
//
// Os doze handlers de classe (`domain/rulesets/dnd2024/handlers/**`) foram
// escritos, revisados e cobertos por contrato — e ficaram INALCANÇÁVEIS a
// partir de qualquer interface: o dispatcher da Task 17 tinha um vocabulário
// fechado de comandos e nenhum deles invocava
// `officialHandlerInvoker.invoke({operation: 'execute'})`, e `rest.js` não
// chamava `onRest` de handler nenhum. As ~110 ações declaradas no catálogo
// existiam como código morto do ponto de vista do jogador. Este módulo fecha
// essa lacuna (decisão aprovada, `questions-for-review.txt` item 15).
//
// ## A porta: `context.officialHandlerInvoker`
//
// `domain/**` não pode importar `content/**` (o `check:architecture` reprova, e
// com razão: inverteria a dependência do runtime de conteúdo). O invoker chega,
// então, como PORTA INJETADA no contexto — a mesma instância que
// `app-context.js#getOfficialHandlerInvoker()` publica, e a mesma que a sessão
// da ficha repassa em `buildContext()`.
//
// A ausência da porta é ERRO NOMEADO (`COMMAND_CLASS_HANDLER_INVOKER_REQUIRED`),
// nunca "então não há ação de classe nenhuma". A diferença é a de sempre neste
// projeto: um `[]` devolvido por dependência ausente faria a ficha de um
// Bárbaro mostrar zero ações e o jogador concluir que a Fúria sumiu — sem erro,
// sem log, sem teste vermelho.
//
// ## Quem é "o handler desta classe" — derivado do CONTEÚDO, nunca de um mapa
//
// A resolução parte da entidade de classe do personagem e lê os efeitos
// `official-handler` que ELA declara, ficando com os de escopo de classe (o
// prefixo `class-`). É exatamente o critério que
// `tests/contract/official-handler-coverage.test.js` usa desde a Task 22a, e é
// o que impede este módulo de virar uma segunda tabela "classe -> handler" que
// pudesse divergir do catálogo. Nenhum literal de classe aparece aqui.
//
// ## O que este módulo NÃO decide
//
// Nada de mecânica. Disponibilidade de ação, proveniência de recurso, teto
// declarado, recarga parcial e recusa por nível/subclasse são todos do handler
// (`class-handler.js`). Aqui há só resolução, invocação e composição de
// `CommandResult`.

import { ok, err } from '../../core/result.js';
import { commandOk, commandErr, commandError, isCommandResult } from './command-result.js';

/** Prefixo dos `handlerId` de escopo de CLASSE (mesmo critério da Task 22a). */
export const CLASS_HANDLER_ID_PREFIX = 'class-';

/** Operações do contrato de handler usadas por este módulo. */
const OPERATION_PROJECT = 'project';
const OPERATION_EXECUTE = 'execute';
const OPERATION_REST = 'rest';

const PATH_RESOURCES = 'state.resources';
const PATH_USAGE_FLAGS = 'state.usageFlags';

/**
 * Extrai o `id` de um ContentRef (`{id, packageVersion}`) ou de um ContentId
 * cru; `null` quando ausente/malformado.
 * @param {*} reference
 * @returns {string|null}
 */
function refId(reference) {
  if (typeof reference === 'string' && reference.length > 0) {
    return reference;
  }
  if (reference !== null && typeof reference === 'object' && typeof reference.id === 'string') {
    return reference.id;
  }
  return null;
}

/**
 * Confere que a porta de invocação de handlers oficiais está presente.
 * @param {*} context
 * @returns {import('../../core/result.js').Result} `ok(invoker)`
 */
export function requireOfficialHandlerInvoker(context) {
  const invoker = context?.officialHandlerInvoker ?? null;
  if (invoker === null || typeof invoker !== 'object' || typeof invoker.invoke !== 'function') {
    return err(
      commandError(
        'COMMAND_CLASS_HANDLER_INVOKER_REQUIRED',
        'As ações de classe exigem "context.officialHandlerInvoker"; sem a porta nada é invocado e nada é presumido.',
        {},
      ),
    );
  }
  return ok(invoker);
}

/**
 * Resolve, a partir do CONTEÚDO, quais handlers de classe o personagem
 * declara.
 *
 * Devolve `ok([])` quando o personagem simplesmente não tem classe (rascunho,
 * ficha em construção) — isso é ausência legítima, não falha. Já um
 * `context.registry` ausente, ou uma `classRef` que o catálogo não resolve,
 * são ERRO: significa que não dá para SABER quais handlers existem, e responder
 * "nenhum" seria afirmar algo falso.
 *
 * @param {object} character
 * @param {{registry?: object}} context
 * @returns {import('../../core/result.js').Result} `ok(ReadonlyArray<{handlerId, entityId}>)`
 */
export function resolveDeclaredClassHandlers(character, context = {}) {
  const classId = refId(character?.build?.classRef);
  if (classId === null) {
    return ok(Object.freeze([]));
  }

  const registry = context?.registry ?? null;
  if (registry === null || typeof registry !== 'object' || typeof registry.get !== 'function') {
    return err(
      commandError(
        'COMMAND_CLASS_HANDLER_REGISTRY_REQUIRED',
        'Descobrir os handlers de classe declarados exige "context.registry"; a lista não é presumida.',
        { classId },
      ),
    );
  }

  const entity = registry.get(classId);
  if (entity === null || entity === undefined) {
    return err(
      commandError(
        'COMMAND_CLASS_HANDLER_CLASS_NOT_FOUND',
        `A classe "${classId}" não está no catálogo ativo; os handlers dela não podem ser resolvidos.`,
        { classId },
      ),
    );
  }

  const effects = Array.isArray(entity.effects) ? entity.effects : [];
  const encontrados = [];
  for (const effect of effects) {
    if (
      effect !== null &&
      typeof effect === 'object' &&
      effect.type === 'official-handler' &&
      typeof effect.handlerId === 'string' &&
      effect.handlerId.startsWith(CLASS_HANDLER_ID_PREFIX) &&
      !encontrados.some((entry) => entry.handlerId === effect.handlerId)
    ) {
      encontrados.push(Object.freeze({ handlerId: effect.handlerId, entityId: classId }));
    }
  }
  return ok(Object.freeze(encontrados));
}

/**
 * Invoca UMA operação de handler pela porta, normalizando a resposta.
 * @param {object} invoker
 * @param {{handlerId: string, entityId: string}} handler
 * @param {string} operation
 * @param {object} payload
 * @param {object} context
 * @returns {import('../../core/result.js').Result}
 */
function invokeHandler(invoker, handler, operation, payload, context) {
  const resultado = invoker.invoke({
    entityId: handler.entityId,
    handlerId: handler.handlerId,
    operation,
    payload,
    // O contexto segue INTEIRO: é dele que `withEffectContextVariables`
    // (no adapter) tira `registry`, `level` e as variáveis numéricas do
    // personagem. Podar aqui reintroduziria o `EFFECT_VALUE_NOT_NUMERIC` que a
    // Task 22a fechou.
    context,
  });
  if (!resultado || typeof resultado.ok !== 'boolean') {
    return err(
      commandError(
        'COMMAND_CLASS_HANDLER_CONTRACT_VIOLATION',
        `A invocação de "${handler.handlerId}" (${operation}) não devolveu um Result.`,
        { handlerId: handler.handlerId, operation },
      ),
    );
  }
  return resultado;
}

/**
 * Projeta o estado observável de TODOS os handlers de classe do personagem.
 *
 * É a leitura que alimenta `derived.classActions` no ViewModel da ficha: para
 * cada handler, `{handlerId, entityId, projection}` com recursos (inclusive o
 * `{current: null, missing: true}` de recurso não materializado), flags e a
 * disponibilidade de CADA ação — que é a mesma condição que `execute` aplica,
 * para que a interface nunca ofereça um botão que o comando recusaria.
 *
 * @param {object} character
 * @param {object} context
 * @returns {import('../../core/result.js').Result} `ok(ReadonlyArray<object>)`
 */
export function projectClassHandlers(character, context = {}) {
  const invoker = requireOfficialHandlerInvoker(context);
  if (!invoker.ok) {
    return invoker;
  }
  const handlers = resolveDeclaredClassHandlers(character, context);
  if (!handlers.ok) {
    return handlers;
  }

  const projecoes = [];
  for (const handler of handlers.value) {
    const resultado = invokeHandler(invoker.value, handler, OPERATION_PROJECT, { character }, context);
    if (!resultado.ok) {
      // Uma projeção que falha derruba a leitura inteira, com o erro original.
      // Um "handler que não projetou" escondido atrás de um `continue` faria a
      // ficha mostrar menos ações do que o personagem tem.
      return resultado;
    }
    projecoes.push(
      Object.freeze({ handlerId: handler.handlerId, entityId: handler.entityId, projection: resultado.value }),
    );
  }
  return ok(Object.freeze(projecoes));
}

/**
 * Executa UMA ação de classe.
 *
 * `handlerId`/`entityId` viajam no comando (a seção os lê da projeção), e são
 * CONFERIDOS contra o que o conteúdo declara: um comando que peça um handler
 * que a classe do personagem não declara é recusado com
 * `COMMAND_CLASS_ACTION_HANDLER_NOT_DECLARED`. Sem essa conferência, um
 * `data-action` forjado poderia pedir a execução do handler de outra classe — e
 * o invoker o recusaria, mas com um erro de autorização difícil de ler em vez
 * do erro de domínio correto.
 *
 * Toda recusa do handler (nível insuficiente, subclasse errada, flag em estado
 * inválido, recurso não concedido / não materializado / de outra proveniência /
 * insuficiente) chega aqui como `CommandResult` com `ok: false` e código
 * próprio, e é devolvida INTACTA. É isso que garante que um clique numa ação
 * indisponível produza um erro DECLARADO e nunca um no-op silencioso.
 *
 * @param {object} character
 * @param {{handlerId: string, entityId?: string, actionId: string, actionPayload?: object}} params
 * @param {object} context
 * @returns {import('./command-result.js').CommandResult}
 */
export function executeClassAction(character, params = {}, context = {}) {
  const { handlerId, entityId, actionId, actionPayload } = params ?? {};

  if (typeof handlerId !== 'string' || handlerId.length === 0) {
    return commandErr({
      character,
      error: commandError('COMMAND_CLASS_ACTION_HANDLER_ID_INVALID', 'A ação de classe exige "handlerId" (string não vazia).', {
        handlerId: typeof handlerId === 'string' ? handlerId : null,
      }),
    });
  }
  if (typeof actionId !== 'string' || actionId.length === 0) {
    return commandErr({
      character,
      error: commandError('COMMAND_CLASS_ACTION_ACTION_ID_INVALID', 'A ação de classe exige "actionId" (string não vazia).', {
        handlerId,
        actionId: typeof actionId === 'string' ? actionId : null,
      }),
    });
  }

  const invoker = requireOfficialHandlerInvoker(context);
  if (!invoker.ok) {
    return commandErr({ character, error: invoker.error });
  }
  const declarados = resolveDeclaredClassHandlers(character, context);
  if (!declarados.ok) {
    return commandErr({ character, error: declarados.error });
  }

  const handler = declarados.value.find((entry) => entry.handlerId === handlerId);
  if (handler === undefined) {
    return commandErr({
      character,
      error: commandError(
        'COMMAND_CLASS_ACTION_HANDLER_NOT_DECLARED',
        `A classe deste personagem não declara o handler "${handlerId}".`,
        { handlerId, declaredHandlerIds: declarados.value.map((entry) => entry.handlerId) },
      ),
    });
  }
  if (typeof entityId === 'string' && entityId.length > 0 && entityId !== handler.entityId) {
    return commandErr({
      character,
      error: commandError(
        'COMMAND_CLASS_ACTION_ENTITY_MISMATCH',
        `O handler "${handlerId}" pertence a "${handler.entityId}", não a "${entityId}".`,
        { handlerId, expectedEntityId: handler.entityId, entityId },
      ),
    });
  }

  const resultado = invokeHandler(
    invoker.value,
    handler,
    OPERATION_EXECUTE,
    { character, actionId, actionPayload },
    context,
  );
  if (!resultado.ok) {
    return commandErr({ character, error: resultado.error });
  }
  if (!isCommandResult(resultado.value)) {
    return commandErr({
      character,
      error: commandError(
        'COMMAND_CLASS_HANDLER_CONTRACT_VIOLATION',
        `A execução de "${handlerId}" não devolveu um CommandResult.`,
        { handlerId, actionId },
      ),
    });
  }
  // O `CommandResult` do handler passa INTACTO: `character`, `events` e
  // `affected` (`state.resources`/`state.usageFlags`, ambos já mapeados em
  // `features/sheet/sheet-command-map.js`) são exatamente o que a sessão
  // precisa para persistir e redesenhar.
  return resultado.value;
}

/**
 * Aplica o `onRest` de TODOS os handlers de classe do personagem, encadeando os
 * resultados sobre o personagem que o descanso canônico já produziu.
 *
 * Chamado por `shortRest`/`longRest` (`rest.js`) DENTRO do mesmo comando — não
 * existe um comando `class-rest` separado, por decisão registrada em
 * `questions-for-review.txt` item 15: `onRest` é gancho de ciclo de vida do
 * descanso, e dois comandos separados permitiriam à interface disparar só um
 * deles, deixando o personagem num estado parcial sem erro nenhum.
 *
 * A falha de um handler ABORTA o descanso inteiro (o chamador devolve
 * `commandErr` com o personagem ORIGINAL): meio descanso aplicado é pior do que
 * nenhum, e é indetectável depois.
 *
 * @param {object} character - personagem JÁ processado pela parte canônica.
 * @param {{kind: 'short'|'long'}} params
 * @param {object} context
 * @returns {import('../../core/result.js').Result} `ok({character, events, affected})`
 */
export function applyClassRest(character, params = {}, context = {}) {
  const kind = params?.kind;
  const invoker = requireOfficialHandlerInvoker(context);
  if (!invoker.ok) {
    return invoker;
  }
  const handlers = resolveDeclaredClassHandlers(character, context);
  if (!handlers.ok) {
    return handlers;
  }

  let atual = character;
  const events = [];
  const affected = new Set();

  for (const handler of handlers.value) {
    const resultado = invokeHandler(invoker.value, handler, OPERATION_REST, { character: atual, kind }, context);
    if (!resultado.ok) {
      return resultado;
    }
    if (!isCommandResult(resultado.value)) {
      return err(
        commandError(
          'COMMAND_CLASS_HANDLER_CONTRACT_VIOLATION',
          `O descanso de "${handler.handlerId}" não devolveu um CommandResult.`,
          { handlerId: handler.handlerId, kind: typeof kind === 'string' ? kind : null },
        ),
      );
    }
    if (resultado.value.ok !== true) {
      return err(resultado.value.error);
    }
    atual = resultado.value.character;
    events.push(...(resultado.value.events ?? []));
    for (const path of resultado.value.affected ?? []) {
      affected.add(path);
    }
  }

  return ok(
    Object.freeze({
      character: atual,
      events: Object.freeze(events),
      // Ordem estável: os dois únicos paths que um handler de classe emite.
      affected: Object.freeze([PATH_RESOURCES, PATH_USAGE_FLAGS].filter((path) => affected.has(path))),
    }),
  );
}

/**
 * Adaptador do dispatcher para o tipo de comando `class-action`.
 * @param {object} character
 * @param {object} command
 * @param {object} context
 * @returns {import('./command-result.js').CommandResult}
 */
export function classActionCommand(character, command, context) {
  return executeClassAction(
    character,
    {
      handlerId: command?.handlerId,
      entityId: command?.entityId,
      actionId: command?.actionId,
      actionPayload: command?.actionPayload,
    },
    context,
  );
}

/**
 * Reexporta `commandOk` para os testes que precisam montar um resultado
 * equivalente ao deste módulo sem duplicar a fábrica.
 */
export { commandOk };
