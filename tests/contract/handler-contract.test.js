// Contrato COMPARTILHADO de handler de classe (criado na Task 20, reexecutado
// nas Tasks 21 e 22).
//
// Prova, para TODO handler registrado, que ele satisfaz literalmente o
// contrato do brief:
//
//   {
//     id: string,
//     project(character, context): Result<HandlerProjection, AppError>,
//     contributeEffects(character, context): Result<ReadonlyArray<Effect>, AppError>,
//     execute(character, { actionId, payload }, context): CommandResult,
//     onRest(character, { kind: "short" | "long" }, context): CommandResult
//   }
//
// incluindo os TIPOS DE RETORNO nos dois ramos (sucesso e falha) e o fato de
// `kind` ser exatamente `"short"`/`"long"` — nunca `"curto"`/`"longo"`.
//
// A Task 21 acrescentou `DIVINE_PRIMAL_CLASS_HANDLERS`
// (`register-divine-primal-handlers.js`) à lista `HANDLERS` abaixo: a tabela
// de casos é derivada da lista, não escrita à mão, então os oito handlers
// passaram a ser cobertos pelos mesmos testes.
//
// Task 22a: os quatro handlers arcanos entraram pela mesma porta
// (`ARCANE_CLASS_HANDLERS`), e as duas listas passaram a ser derivadas do
// composition root único (`register-all.js#ALL_CLASS_HANDLERS` /
// `#createAllClassHandlerRegistrations`) — assim uma tarefa futura não
// consegue registrar um handler sem que ele caia sob este contrato.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { isResult } from '../../site/js/core/result.js';
import { isCommandResult } from '../../site/js/domain/commands/command-result.js';
import { createOfficialHandlerAuthorizationChannel } from '../../site/js/content/official-handler-authorization.js';
import { OfficialHandlerRegistry } from '../../site/js/domain/effects/official-handler-registry.js';
import { REST_KINDS, HANDLER_OPERATIONS } from '../../site/js/domain/rulesets/dnd2024/handlers/class-handler.js';
import {
  MARTIAL_CLASS_HANDLERS,
  createMartialHandlerRegistrations,
  verifyMartialHandlerDeclarations,
} from '../../site/js/domain/rulesets/dnd2024/handlers/register-martial-handlers.js';
import {
  DIVINE_PRIMAL_CLASS_HANDLERS,
  createDivinePrimalHandlerRegistrations,
  verifyDivinePrimalHandlerDeclarations,
} from '../../site/js/domain/rulesets/dnd2024/handlers/register-divine-primal-handlers.js';
import {
  ARCANE_CLASS_HANDLERS,
  verifyArcaneHandlerDeclarations,
} from '../../site/js/domain/rulesets/dnd2024/handlers/register-arcane-handlers.js';
import {
  ALL_CLASS_HANDLERS,
  createAllClassHandlerRegistrations,
  verifyAllClassHandlerDeclarations,
} from '../../site/js/domain/rulesets/dnd2024/handlers/register-all.js';
import {
  classSource,
  createMartialContentRegistry,
  makeContext,
  makeContextFor,
  makeMartialCharacter,
} from '../helpers/martial-fixtures.js';

// Todos os handlers sob contrato: a MESMA lista que o composition root
// registra, para que nenhum handler novo escape deste contrato.
const HANDLERS = ALL_CLASS_HANDLERS;

/**
 * Todas as entradas `{handlerId, handler}` registradas pelo composition root.
 * @returns {ReadonlyArray<{handlerId: string, handler: Function}>}
 */
function allRegistrations() {
  return createAllClassHandlerRegistrations();
}

/**
 * Verifica, de uma vez, a declaração no conteúdo dos DOZE handlers do
 * composition root (Task 22a). As verificações por tarefa
 * (`verifyMartialHandlerDeclarations` etc.) continuam exercitadas abaixo, no
 * teste que prova que a regra não é decorativa.
 * @param {object} contentRegistry
 * @returns {{ok: true, value: ReadonlyArray<string>} | {ok: false, error: object}}
 */
function verifyAllDeclarations(contentRegistry) {
  return verifyAllClassHandlerDeclarations(contentRegistry);
}

describe('contrato de handler — superfície e tipos de retorno', () => {
  test('há pelo menos um handler registrado sob contrato', () => {
    assert.ok(HANDLERS.length > 0);
  });

  for (const handler of HANDLERS) {
    describe(`handler "${handler.id}"`, () => {
      const character = makeMartialCharacter({ classId: handler.classId, level: 5 });
      // Personagem de OUTRA classe: desde a Task 22a as doze classes têm
      // handler, então o "outro" precisa ser escolhido em relação ao handler
      // sob teste — um literal fixo faria o próprio handler dessa classe
      // testar o ramo de sucesso duas vezes.
      const outroCharacter = makeMartialCharacter({
        classId: handler.classId === 'dnd2024:class:mago' ? 'dnd2024:class:bardo' : 'dnd2024:class:mago',
        level: 5,
      });
      // `context.variables` resolvidas do personagem real: desde a Task 22a há
      // handler cujo teto declarado é um nome de variável, e um contexto sem
      // variáveis é dependência ausente (erro), não "sem recurso".
      const contexto = () => makeContextFor(character);
      const contextoOutro = () => makeContextFor(outroCharacter);

      test('id é um slug ASCII minúsculo e o objeto é congelado', () => {
        assert.equal(typeof handler.id, 'string');
        assert.match(handler.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        assert.equal(Object.isFrozen(handler), true);
      });

      test('os quatro métodos existem com a aridade declarada', () => {
        assert.equal(typeof handler.project, 'function');
        assert.equal(typeof handler.contributeEffects, 'function');
        assert.equal(typeof handler.execute, 'function');
        assert.equal(typeof handler.onRest, 'function');
        // `context` tem default, então não conta na aridade declarada.
        assert.equal(handler.project.length, 1, 'project(character, context)');
        assert.equal(handler.contributeEffects.length, 1, 'contributeEffects(character, context)');
        assert.equal(handler.execute.length, 2, 'execute(character, command, context)');
        assert.equal(handler.onRest.length, 2, 'onRest(character, params, context)');
      });

      test('project devolve Result nos dois ramos', () => {
        const sucesso = handler.project(character, contexto());
        assert.equal(isResult(sucesso), true);
        assert.equal(sucesso.ok, true);
        assert.equal(typeof sucesso.value, 'object');

        const falha = handler.project(outroCharacter, contextoOutro());
        assert.equal(isResult(falha), true);
        assert.equal(falha.ok, false);
        assert.equal(typeof falha.error.code, 'string');
        assert.equal(typeof falha.error.scope, 'string');
      });

      test('toda ação e recurso projetados carregam `label` pt-BR (correção I3 — nunca o slug cru)', () => {
        // Projeção da própria classe: `project` lista TODAS as ações
        // declaradas (inclusive as de subclasse, indisponíveis), então uma
        // única projeção cobre o catálogo completo do handler.
        const sucesso = handler.project(character, contexto());
        assert.equal(sucesso.ok, true, sucesso.ok ? '' : sucesso.error.code);
        for (const action of sucesso.value.actions) {
          assert.equal(typeof action.label, 'string', `ação "${action.actionId}" sem label declarado`);
          assert.ok(action.label.length > 0, `ação "${action.actionId}" com label vazio`);
          assert.notEqual(action.label, action.actionId, `ação "${action.actionId}" usa o próprio slug como label`);
        }
        for (const [resourceId, entry] of Object.entries(sucesso.value.resources)) {
          assert.equal(typeof entry.label, 'string', `recurso "${resourceId}" sem label declarado`);
          assert.ok(entry.label.length > 0, `recurso "${resourceId}" com label vazio`);
        }
      });

      test('contributeEffects devolve Result de array congelado', () => {
        const resultado = handler.contributeEffects(character, contexto());
        assert.equal(isResult(resultado), true);
        assert.equal(resultado.ok, true);
        assert.equal(Array.isArray(resultado.value), true);
        assert.equal(Object.isFrozen(resultado.value), true);

        const falha = handler.contributeEffects(outroCharacter, contextoOutro());
        assert.equal(isResult(falha), true);
        assert.equal(falha.ok, false);
      });

      test('execute devolve CommandResult nos dois ramos, com affected sempre array', () => {
        const falha = handler.execute(character, { actionId: 'acao-que-nao-existe' }, contexto());
        assert.equal(isCommandResult(falha), true);
        assert.equal(falha.ok, false);
        assert.equal(Array.isArray(falha.affected), true);
        assert.deepEqual(falha.affected, []);
        assert.equal(falha.character, character, 'a falha devolve o personagem original');
        assert.equal(Array.isArray(falha.events), true);
        assert.deepEqual(falha.events, []);
      });

      test(`onRest só aceita ${REST_KINDS.map((k) => JSON.stringify(k)).join('/')} e devolve CommandResult`, () => {
        for (const kind of REST_KINDS) {
          const resultado = handler.onRest(character, { kind }, contexto());
          assert.equal(isCommandResult(resultado), true, `kind ${kind}`);
          assert.equal(resultado.ok, true, `kind ${kind}`);
          assert.equal(Array.isArray(resultado.affected), true);
        }
        for (const kind of ['curto', 'longo', 'descanso-curto', 'descanso-longo', 'Short', 'Long', undefined]) {
          const resultado = handler.onRest(character, { kind }, contexto());
          assert.equal(isCommandResult(resultado), true, `kind ${String(kind)}`);
          assert.equal(resultado.ok, false, `kind ${String(kind)} deveria ser recusado`);
          assert.equal(resultado.error.code, 'HANDLER_REST_KIND_INVALID');
          assert.deepEqual(resultado.affected, []);
        }
      });

      test('nenhum método muta o personagem recebido', () => {
        const snapshot = JSON.stringify(character);
        handler.project(character, contexto());
        handler.contributeEffects(character, contexto());
        handler.execute(character, { actionId: 'x' }, contexto());
        for (const kind of REST_KINDS) {
          handler.onRest(character, { kind }, contexto());
        }
        assert.equal(JSON.stringify(character), snapshot);
      });
    });
  }
});

describe('contrato de handler — registro e declaração no conteúdo', () => {
  test('todo handler registrado é DECLARADO por sua entidade de classe no conteúdo real', () => {
    const resultado = verifyAllDeclarations(createMartialContentRegistry());
    assert.equal(resultado.ok, true, `handlers não declarados: ${JSON.stringify(resultado.error?.context)}`);
    assert.deepEqual([...resultado.value].sort(), HANDLERS.map((h) => h.id).sort());
  });

  test('um catálogo sem a declaração faz a verificação FALHAR (a regra não é decorativa)', () => {
    const vazio = Object.freeze({ resolve: () => ({ ok: false, error: { code: 'CONTENT_NOT_FOUND' } }) });
    const resultado = verifyMartialHandlerDeclarations(vazio);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'MARTIAL_HANDLER_NOT_DECLARED');
    assert.equal(resultado.error.context.undeclared.length, MARTIAL_CLASS_HANDLERS.length);

    const divino = verifyDivinePrimalHandlerDeclarations(vazio);
    assert.equal(divino.ok, false);
    assert.equal(divino.error.code, 'MARTIAL_HANDLER_NOT_DECLARED');
    assert.equal(divino.error.context.undeclared.length, DIVINE_PRIMAL_CLASS_HANDLERS.length);

    const arcano = verifyArcaneHandlerDeclarations(vazio);
    assert.equal(arcano.ok, false);
    assert.equal(arcano.error.code, 'MARTIAL_HANDLER_NOT_DECLARED');
    assert.equal(arcano.error.context.undeclared.length, ARCANE_CLASS_HANDLERS.length);
  });

  test('o composition root registra EXATAMENTE estes handlers no default de produção', async () => {
    // `site/js/app-context.js` avalia `createAppContext()` no carregamento do
    // módulo, e `createClassHandler` LANÇA em configuração malformada — logo,
    // uma configuração ruim quebraria toda carga de página. Este teste é o
    // guarda disso: usa o default REAL de `officialHandlers`, sem injeção.
    const { createAppContext } = await import('../../site/js/app-context.js');
    let recebidos = null;
    createAppContext({
      createHandlerRegistry: (verify, officialHandlers) => {
        void verify;
        recebidos = officialHandlers;
        return Object.freeze({ register: () => ({ ok: true }), invokeAuthorized: () => ({ ok: true }) });
      },
    });
    assert.ok(Array.isArray(recebidos), 'o default de officialHandlers deve ser uma lista');
    assert.deepEqual(
      recebidos.map((entry) => entry.handlerId).sort(),
      HANDLERS.map((handler) => handler.id).sort(),
    );
  });

  test('os IDs registrados são únicos e batem com os IDs dos handlers', () => {
    const registrations = allRegistrations();
    const ids = registrations.map((entry) => entry.handlerId);
    assert.deepEqual([...new Set(ids)].sort(), ids.slice().sort());
    assert.deepEqual(ids.slice().sort(), HANDLERS.map((h) => h.id).sort());
    for (const entry of registrations) {
      assert.equal(typeof entry.handler, 'function');
    }
  });
});

describe('contrato de handler — só roda pelo caminho autorizado', () => {
  /**
   * Monta um registry real com o canal de autorização real e os quatro
   * handlers registrados, devolvendo também o `issue` (que em produção NUNCA
   * chega ao lado executor — aqui é o teste que faz o papel do invoker).
   * @returns {{registry: object, issue: Function}}
   */
  function buildRegistry() {
    const { issue, verify } = createOfficialHandlerAuthorizationChannel();
    const registry = OfficialHandlerRegistry({ verifyAuthorization: verify });
    for (const entry of allRegistrations()) {
      const registered = registry.register(entry.handlerId, entry.handler);
      assert.equal(registered.ok, true, `registro de ${entry.handlerId}`);
    }
    return { registry, issue };
  }

  test('sem autorização válida o handler não roda', () => {
    const { registry } = buildRegistry();
    const handler = HANDLERS[0];
    const resultado = registry.invokeAuthorized({
      authorization: Object.freeze({}),
      entityId: handler.classId,
      handlerId: handler.id,
      operation: 'project',
      payload: { character: makeMartialCharacter({ classId: handler.classId, level: 5 }) },
      context: makeContext(),
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'OFFICIAL_HANDLER_NOT_AUTHORIZED');
  });

  for (const operation of HANDLER_OPERATIONS) {
    test(`operação "${operation}" roda pelo caminho autorizado`, () => {
      const { registry, issue } = buildRegistry();
      const handler = HANDLERS[0];
      const character = makeMartialCharacter({ classId: handler.classId, level: 5 });
      const payload = { character };
      if (operation === 'execute') {
        payload.actionId = 'acao-que-nao-existe';
      }
      if (operation === 'rest') {
        payload.kind = 'long';
      }
      const resultado = registry.invokeAuthorized({
        authorization: issue({ entityId: handler.classId, handlerId: handler.id, operation }),
        entityId: handler.classId,
        handlerId: handler.id,
        operation,
        payload,
        context: makeContext(),
      });
      assert.equal(isResult(resultado), true);
      assert.equal(resultado.ok, true, `operação ${operation}: ${resultado.error?.code}`);
      if (operation === 'execute' || operation === 'rest') {
        assert.equal(isCommandResult(resultado.value), true);
      }
    });
  }

  test('operação fora do contrato é recusada', () => {
    const { registry, issue } = buildRegistry();
    const handler = HANDLERS[0];
    const resultado = registry.invokeAuthorized({
      authorization: issue({ entityId: handler.classId, handlerId: handler.id, operation: 'apagar-tudo' }),
      entityId: handler.classId,
      handlerId: handler.id,
      operation: 'apagar-tudo',
      payload: { character: makeMartialCharacter({ classId: handler.classId, level: 5 }) },
      context: makeContext(),
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'MARTIAL_HANDLER_OPERATION_UNKNOWN');
  });

  test('um efeito official-handler colado noutra entidade não aciona o handler', () => {
    const { registry, issue } = buildRegistry();
    const handler = HANDLERS[0];
    const entityId = 'dnd2024:feat:um-talento-qualquer';
    const resultado = registry.invokeAuthorized({
      authorization: issue({ entityId, handlerId: handler.id, operation: 'project' }),
      entityId,
      handlerId: handler.id,
      operation: 'project',
      payload: { character: makeMartialCharacter({ classId: handler.classId, level: 5 }) },
      context: makeContext(),
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'MARTIAL_HANDLER_ENTITY_MISMATCH');
  });

  test('payload sem "character" é recusado antes de qualquer método do handler', () => {
    const { registry, issue } = buildRegistry();
    const handler = HANDLERS[0];
    const resultado = registry.invokeAuthorized({
      authorization: issue({ entityId: handler.classId, handlerId: handler.id, operation: 'project' }),
      entityId: handler.classId,
      handlerId: handler.id,
      operation: 'project',
      payload: {},
      context: makeContext(),
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'MARTIAL_HANDLER_PAYLOAD_INVALID');
  });

  test('descanso pelo caminho autorizado exige kind "short"/"long"', () => {
    const { registry, issue } = buildRegistry();
    const handler = HANDLERS[0];
    const resultado = registry.invokeAuthorized({
      authorization: issue({ entityId: handler.classId, handlerId: handler.id, operation: 'rest' }),
      entityId: handler.classId,
      handlerId: handler.id,
      operation: 'rest',
      payload: { character: makeMartialCharacter({ classId: handler.classId, level: 5 }), kind: 'longo' },
      context: makeContext(),
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'MARTIAL_HANDLER_PAYLOAD_INVALID');
  });
});

describe('contrato de handler — o adapter REAL resolve context.variables', () => {
  // Achado Important 5 da revisão da Task 22a: até aqui, o caminho
  // `invokeAuthorized -> createHandlerAdapter -> withEffectContextVariables ->
  // project` só era exercitado com um handler cujo `max` é literal, e os testes
  // do Bardo passavam o contexto já enriquecido pelo helper de teste. Ou seja:
  // a plumbing de produção nunca era provada com um handler que DEPENDE dela.
  //
  // Este bloco fecha isso com `class-bardo`, cujo teto de Inspiração é o nome
  // de variável `carismaModifierMin1`. O contexto entregue ao registry é
  // deliberadamente CRU (`makeContext()`, sem `variables`): se o adapter
  // deixasse de resolvê-las, `project` cairia em
  // `HANDLER_RESOURCE_MAX_UNRESOLVED` e estes testes falhariam.

  const BARDO_ID = 'dnd2024:class:bardo';
  const INSPIRACAO = 'dnd2024:resource:inspiracao-de-bardo';

  /**
   * Registry com todos os handlers de produção e o emissor de autorização.
   * @returns {{registry: object, issue: Function}}
   */
  function buildRegistry() {
    const { issue, verify } = createOfficialHandlerAuthorizationChannel();
    const registry = OfficialHandlerRegistry({ verifyAuthorization: verify });
    for (const entry of allRegistrations()) {
      const registered = registry.register(entry.handlerId, entry.handler);
      assert.equal(registered.ok, true, `registro de ${entry.handlerId}`);
    }
    return { registry, issue };
  }

  /**
   * Invoca uma operação do handler do Bardo pelo caminho autorizado real.
   * @param {string} operation
   * @param {object} character
   * @param {object} [extraPayload]
   * @returns {import('../../site/js/core/result.js').Result}
   */
  function invocarBardo(operation, character, extraPayload = {}) {
    const { registry, issue } = buildRegistry();
    return registry.invokeAuthorized({
      authorization: issue({ entityId: BARDO_ID, handlerId: 'class-bardo', operation }),
      entityId: BARDO_ID,
      handlerId: 'class-bardo',
      operation,
      payload: { character, ...extraPayload },
      // CRU de propósito: sem `variables`.
      context: makeContext(),
    });
  }

  for (const [carisma, esperado] of [[8, 1], [14, 2], [18, 4]]) {
    test(`project pelo adapter resolve o teto real de Carisma ${carisma} (=> ${esperado})`, () => {
      const character = makeMartialCharacter({ classId: BARDO_ID, level: 5, abilities: { carisma } });
      const resultado = invocarBardo('project', character);
      assert.equal(isResult(resultado), true);
      assert.equal(resultado.ok, true, `project falhou: ${resultado.error?.code}`);
      assert.equal(resultado.value.resources[INSPIRACAO].max, esperado);
    });
  }

  test('execute pelo adapter gasta o recurso cujo teto veio de context.variables', () => {
    const character = makeMartialCharacter({
      classId: BARDO_ID,
      level: 5,
      abilities: { carisma: 18 },
      resources: {
        [INSPIRACAO]: { current: 4, sourceInstanceId: classSource(BARDO_ID) },
      },
    });
    const resultado = invocarBardo('execute', character, { actionId: 'usar-inspiracao' });
    assert.equal(resultado.ok, true, resultado.error?.code);
    assert.equal(isCommandResult(resultado.value), true);
    assert.equal(resultado.value.ok, true, resultado.value.error?.code);
    assert.equal(resultado.value.character.state.resources[INSPIRACAO].current, 3);
  });

  test('rest pelo adapter restaura ao teto derivado do personagem, não a um número fixo', () => {
    const character = makeMartialCharacter({
      classId: BARDO_ID,
      level: 5,
      abilities: { carisma: 14 },
      resources: {
        [INSPIRACAO]: { current: 0, sourceInstanceId: classSource(BARDO_ID) },
      },
    });
    const resultado = invocarBardo('rest', character, { kind: 'short' });
    assert.equal(resultado.ok, true, resultado.error?.code);
    assert.equal(resultado.value.ok, true, resultado.value.error?.code);
    // Carisma 14 => modificador 2 => teto 2. Um teto fixo (ou não resolvido)
    // daria outro número aqui.
    assert.equal(resultado.value.character.state.resources[INSPIRACAO].current, 2);
  });

  test('personagem sem pontuação de atributo faz o adapter FALHAR, nunca inventar', () => {
    // O outro lado da regra: dependência que não dá para resolver é erro
    // explícito, não um modificador 0 de conveniência.
    const base = makeMartialCharacter({ classId: BARDO_ID, level: 5 });
    const semAtributos = Object.freeze({
      ...base,
      state: Object.freeze({ ...base.state, abilities: Object.freeze({ ...base.state.abilities, carisma: null }) }),
    });
    const resultado = invocarBardo('project', semAtributos);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CHARACTER_QUERY_ABILITY_SCORE_MISSING');
  });

  test('variáveis já presentes no contexto do chamador VENCEM as resolvidas', () => {
    const { registry, issue } = buildRegistry();
    const character = makeMartialCharacter({ classId: BARDO_ID, level: 5, abilities: { carisma: 18 } });
    const resultado = registry.invokeAuthorized({
      authorization: issue({ entityId: BARDO_ID, handlerId: 'class-bardo', operation: 'project' }),
      entityId: BARDO_ID,
      handlerId: 'class-bardo',
      operation: 'project',
      payload: { character },
      context: { ...makeContext(), variables: { carismaModifierMin1: 7 } },
    });
    assert.equal(resultado.ok, true, resultado.error?.code);
    assert.equal(resultado.value.resources[INSPIRACAO].max, 7);
  });
});
