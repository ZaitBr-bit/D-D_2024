// Testes de segurança do `OfficialHandlerRegistry` (Task 15) e da ponte de
// autorização de ponta a ponta: `issue` fica só no invoker do runtime de
// conteúdo (Task 6) e `verify` só no registry que executa handlers.
//
// Este arquivo é um dos poucos autorizados a importar
// `createOfficialSourceCapabilities`/`createOfficialHandlerAuthorizationChannel`
// (teste de segurança fora de `site/js`, ver scripts/check-architecture.mjs).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createContentRuntime } from '../../../site/js/content/registry.js';
import {
  createOfficialSourceCapabilities,
  createSourceCapabilities,
} from '../../../site/js/content/capabilities.js';
import { createOfficialHandlerAuthorizationChannel } from '../../../site/js/content/official-handler-authorization.js';
import { OfficialHandlerRegistry } from '../../../site/js/domain/effects/official-handler-registry.js';
import { ok, err } from '../../../site/js/core/result.js';
import { createAppError } from '../../../site/js/core/errors.js';
import {
  createMemoryContentSource,
  createPermissiveContentValidator,
  buildIndexFromEntities,
} from '../../helpers/memory-content-source.js';

const OFFICIAL_NAMESPACE = 'dnd2024';
const HANDLER_ID = 'furia';

/** Manifesto mínimo pronto para ativação. */
function makeManifest(namespace) {
  return {
    schemaVersion: '1.0.0',
    id: namespace,
    name: `Pacote ${namespace}`,
    version: '1.0.0',
    status: 'ready',
    ruleset: `${namespace}:ruleset:core`,
    entities: ['feature'],
    referenceMigrations: [],
  };
}

/** Feature que declara um handler oficial. */
function makeFeature(namespace, slug, handlerId) {
  return {
    id: `${namespace}:feature:${slug}`,
    type: 'feature',
    schemaVersion: '1.0.0',
    name: slug,
    effects: [{ type: 'official-handler', handlerId, params: {} }],
  };
}

/**
 * Monta o wiring REAL da aplicação: canal de autorização com `issue` só para
 * o runtime de conteúdo e `verify` só para o registry de handlers.
 * @param {{namespace?: string, capabilities?: object, entities?: Array<object>, manifest?: object}} [params]
 */
async function buildWiring({ namespace = OFFICIAL_NAMESPACE, capabilities, entities, manifest } = {}) {
  const { issue, verify } = createOfficialHandlerAuthorizationChannel();
  const handlerRegistry = OfficialHandlerRegistry({ verifyAuthorization: verify });

  const calls = [];
  const registered = handlerRegistry.register(HANDLER_ID, (request) => {
    calls.push(request);
    return ok({ handled: true, operation: request.operation });
  });
  assert.strictEqual(registered.ok, true, JSON.stringify(registered.error ?? null));

  const grantedCapabilities = capabilities ?? createOfficialSourceCapabilities();
  const packageEntities = entities ?? [makeFeature(namespace, 'barbaro-furia', HANDLER_ID)];
  const runtime = createContentRuntime({
    validator: createPermissiveContentValidator(),
    handlerRegistry,
    issueOfficialHandlerAuthorization: issue,
  });
  const source = createMemoryContentSource({
    manifest: manifest ?? makeManifest(namespace),
    index: buildIndexFromEntities(packageEntities),
    entities: packageEntities,
  });
  assert.strictEqual(runtime.registry.registerSource(source, grantedCapabilities).ok, true);
  const initialized = await runtime.registry.initialize();
  assert.strictEqual(initialized.ok, true, JSON.stringify(initialized.error ?? null));

  return { runtime, handlerRegistry, verify, issue, calls, entityId: packageEntities[0].id };
}

describe('OfficialHandlerRegistry: superfície', () => {
  test('expõe apenas register e invokeAuthorized (não existe invoke sem autorização)', () => {
    const registry = OfficialHandlerRegistry({ verifyAuthorization: () => true });
    assert.deepStrictEqual(Object.keys(registry).sort(), ['invokeAuthorized', 'register']);
    assert.strictEqual(registry.invoke, undefined);
    assert.ok(Object.isFrozen(registry));
    assert.throws(() => {
      registry.invoke = () => {};
    }, TypeError);
  });

  test('exige verifyAuthorization como função', () => {
    assert.throws(() => OfficialHandlerRegistry({}), /verifyAuthorization/);
    assert.throws(() => OfficialHandlerRegistry({ verifyAuthorization: true }), /verifyAuthorization/);
    assert.throws(() => OfficialHandlerRegistry(), /verifyAuthorization/);
  });

  test('register recusa handlerId fora do formato, handler não função e registro duplicado', () => {
    const registry = OfficialHandlerRegistry({ verifyAuthorization: () => true });
    assert.strictEqual(registry.register('Furia Total', () => ok(1)).error.code, 'OFFICIAL_HANDLER_ID_INVALID');
    assert.strictEqual(registry.register('__proto__', () => ok(1)).error.code, 'OFFICIAL_HANDLER_ID_INVALID');
    assert.strictEqual(registry.register('furia', 'nope').error.code, 'OFFICIAL_HANDLER_INVALID');
    assert.strictEqual(registry.register('furia', () => ok(1)).ok, true);
    assert.strictEqual(registry.register('furia', () => ok(2)).error.code, 'OFFICIAL_HANDLER_ALREADY_REGISTERED');
  });
});

describe('wiring real issue -> invoker, verify -> registry', () => {
  test('handler oficial válido é executado e devolve o Result do handler', async () => {
    const { runtime, calls, entityId } = await buildWiring();
    const result = runtime.officialHandlerInvoker.invoke({
      entityId,
      handlerId: HANDLER_ID,
      operation: 'enter-rage',
      payload: { rounds: 1 },
    });
    assert.strictEqual(result.ok, true, JSON.stringify(result.error ?? null));
    assert.deepStrictEqual(result.value, { handled: true, operation: 'enter-rage' });
    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(calls[0].payload, { rounds: 1 });
    // O handler NUNCA recebe a autorização: ela para no registry.
    assert.strictEqual('authorization' in calls[0], false);
  });

  test('a mesma autorização não serve duas vezes (uso único)', async () => {
    const { handlerRegistry, issue, entityId } = await buildWiring();
    const scope = { entityId, handlerId: HANDLER_ID, operation: 'enter-rage' };
    const authorization = issue(scope);
    const first = handlerRegistry.invokeAuthorized({ authorization, ...scope, payload: {} });
    assert.strictEqual(first.ok, true);
    const second = handlerRegistry.invokeAuthorized({ authorization, ...scope, payload: {} });
    assert.strictEqual(second.ok, false);
    assert.strictEqual(second.error.code, 'OFFICIAL_HANDLER_NOT_AUTHORIZED');
  });

  test('autorização presa a outra operação é recusada', async () => {
    const { handlerRegistry, issue, entityId } = await buildWiring();
    const authorization = issue({ entityId, handlerId: HANDLER_ID, operation: 'enter-rage' });
    const result = handlerRegistry.invokeAuthorized({
      authorization,
      entityId,
      handlerId: HANDLER_ID,
      operation: 'end-rage',
      payload: {},
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'OFFICIAL_HANDLER_NOT_AUTHORIZED');
  });

  test('autorização presa a outra entidade é recusada', async () => {
    const { handlerRegistry, issue, entityId } = await buildWiring();
    const authorization = issue({ entityId, handlerId: HANDLER_ID, operation: 'enter-rage' });
    const result = handlerRegistry.invokeAuthorized({
      authorization,
      entityId: `${OFFICIAL_NAMESPACE}:feature:outra-coisa`,
      handlerId: HANDLER_ID,
      operation: 'enter-rage',
      payload: {},
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'OFFICIAL_HANDLER_NOT_AUTHORIZED');
  });

  test('autorização forjada (objeto literal com a mesma cara) é recusada', async () => {
    const { handlerRegistry, entityId } = await buildWiring();
    const scope = { entityId, handlerId: HANDLER_ID, operation: 'enter-rage' };
    for (const forjada of [
      {},
      Object.freeze(Object.create(null)),
      Object.freeze({ entityId, handlerId: HANDLER_ID, operation: 'enter-rage' }),
      Object.freeze({ valid: true }),
      null,
      undefined,
      'autorizado',
      Symbol('autorizado'),
    ]) {
      const result = handlerRegistry.invokeAuthorized({ authorization: forjada, ...scope, payload: {} });
      assert.strictEqual(result.ok, false, String(typeof forjada));
      assert.strictEqual(result.error.code, 'OFFICIAL_HANDLER_NOT_AUTHORIZED');
    }
  });

  test('autorização de OUTRO canal é recusada (presa ao canal emissor)', async () => {
    const { handlerRegistry, entityId } = await buildWiring();
    const outroCanal = createOfficialHandlerAuthorizationChannel();
    const authorization = outroCanal.issue({ entityId, handlerId: HANDLER_ID, operation: 'enter-rage' });
    const result = handlerRegistry.invokeAuthorized({
      authorization,
      entityId,
      handlerId: HANDLER_ID,
      operation: 'enter-rage',
      payload: {},
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'OFFICIAL_HANDLER_NOT_AUTHORIZED');
  });

  test('handlerId não registrado é recusado E consome a autorização apresentada', async () => {
    const { handlerRegistry, issue, entityId } = await buildWiring();
    const scope = { entityId, handlerId: 'inexistente', operation: 'enter-rage' };
    const authorization = issue(scope);
    const first = handlerRegistry.invokeAuthorized({ authorization, ...scope, payload: {} });
    assert.strictEqual(first.ok, false);
    assert.strictEqual(first.error.code, 'OFFICIAL_HANDLER_NOT_REGISTERED');
    // A autorização foi queimada: não pode ser reaproveitada num escopo válido.
    const retry = handlerRegistry.invokeAuthorized({
      authorization,
      entityId,
      handlerId: 'inexistente',
      operation: 'enter-rage',
      payload: {},
    });
    assert.strictEqual(retry.error.code, 'OFFICIAL_HANDLER_NOT_AUTHORIZED');
  });

  test('fonte sem a capacidade officialHandlers nunca chega ao registry', async () => {
    const namespace = 'homebrew';
    const { runtime, calls, entityId } = await buildWiring({
      namespace,
      capabilities: createSourceCapabilities({ namespace }),
      entities: [makeFeature(namespace, 'furia-falsa', HANDLER_ID)],
      manifest: makeManifest(namespace),
    });
    const result = runtime.officialHandlerInvoker.invoke({
      entityId,
      handlerId: HANDLER_ID,
      operation: 'enter-rage',
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'OFFICIAL_HANDLER_NOT_AUTHORIZED');
    assert.strictEqual(calls.length, 0);
  });

  test('manifesto falsificado com campos de "oficial" não concede capacidade', async () => {
    const namespace = 'homebrew';
    const manifest = {
      ...makeManifest(namespace),
      // Campos JSON que TENTAM se declarar oficiais. Nada disso participa da
      // decisão de capacidade.
      description: 'Pacote oficial',
      authors: ['Wizards of the Coast'],
    };
    const { runtime, calls, entityId } = await buildWiring({
      namespace,
      capabilities: createSourceCapabilities({ namespace }),
      entities: [makeFeature(namespace, 'furia-falsa', HANDLER_ID)],
      manifest,
    });
    const result = runtime.officialHandlerInvoker.invoke({
      entityId,
      handlerId: HANDLER_ID,
      operation: 'enter-rage',
    });
    assert.strictEqual(result.error.code, 'OFFICIAL_HANDLER_NOT_AUTHORIZED');
    assert.strictEqual(calls.length, 0);
  });

  test('capacidade copiada por spread não transfere privilégio nem chega a registrar a fonte', () => {
    // O `Symbol` do token sobrevive ao spread, mas a IDENTIDADE do objeto de
    // capacidades não — e o registry recusa a cópia já em registerSource, para
    // que ela nem ocupe o namespace oficial.
    const forjada = Object.freeze({ ...createOfficialSourceCapabilities() });
    const { issue, verify } = createOfficialHandlerAuthorizationChannel();
    const runtime = createContentRuntime({
      validator: createPermissiveContentValidator(),
      handlerRegistry: OfficialHandlerRegistry({ verifyAuthorization: verify }),
      issueOfficialHandlerAuthorization: issue,
    });
    const entities = [makeFeature(OFFICIAL_NAMESPACE, 'barbaro-furia', HANDLER_ID)];
    const source = createMemoryContentSource({
      manifest: makeManifest(OFFICIAL_NAMESPACE),
      index: buildIndexFromEntities(entities),
      entities,
    });
    const registered = runtime.registry.registerSource(source, forjada);
    assert.strictEqual(registered.ok, false);
    assert.strictEqual(registered.error.code, 'CONTENT_CAPABILITIES_INVALID');
  });

  test('entity ID alheio (entidade que não declara o handler) é recusado', async () => {
    const entities = [
      makeFeature(OFFICIAL_NAMESPACE, 'barbaro-furia', HANDLER_ID),
      { ...makeFeature(OFFICIAL_NAMESPACE, 'sem-handler', 'outro'), effects: [] },
    ];
    const { runtime, calls } = await buildWiring({ entities });
    const result = runtime.officialHandlerInvoker.invoke({
      entityId: `${OFFICIAL_NAMESPACE}:feature:sem-handler`,
      handlerId: HANDLER_ID,
      operation: 'enter-rage',
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'OFFICIAL_HANDLER_NOT_DECLARED');
    assert.strictEqual(calls.length, 0);
  });

  test('entidade inexistente no catálogo é recusada', async () => {
    const { runtime, calls } = await buildWiring();
    const result = runtime.officialHandlerInvoker.invoke({
      entityId: `${OFFICIAL_NAMESPACE}:feature:fantasma`,
      handlerId: HANDLER_ID,
      operation: 'enter-rage',
    });
    assert.strictEqual(result.error.code, 'OFFICIAL_HANDLER_ENTITY_NOT_FOUND');
    assert.strictEqual(calls.length, 0);
  });
});

describe('OfficialHandlerRegistry: contrato do handler', () => {
  test('handler que lança vira Result de erro, sem vazar a autorização', () => {
    const { issue, verify } = createOfficialHandlerAuthorizationChannel();
    const registry = OfficialHandlerRegistry({ verifyAuthorization: verify });
    registry.register('furia', () => {
      throw new Error('boom');
    });
    const scope = { entityId: 'dnd2024:feature:x', handlerId: 'furia', operation: 'op' };
    const result = registry.invokeAuthorized({ authorization: issue(scope), ...scope, payload: {} });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'OFFICIAL_HANDLER_INVOCATION_FAILED');
    assert.strictEqual(JSON.stringify(result.error.context).includes('authorization'), false);
  });

  test('handler que não devolve Result vira Result de erro', () => {
    const { issue, verify } = createOfficialHandlerAuthorizationChannel();
    const registry = OfficialHandlerRegistry({ verifyAuthorization: verify });
    registry.register('furia', () => ({ nope: true }));
    const scope = { entityId: 'dnd2024:feature:x', handlerId: 'furia', operation: 'op' };
    const result = registry.invokeAuthorized({ authorization: issue(scope), ...scope, payload: {} });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'OFFICIAL_HANDLER_INVOCATION_FAILED');
  });

  test('Result de erro do handler é repassado como está', () => {
    const { issue, verify } = createOfficialHandlerAuthorizationChannel();
    const registry = OfficialHandlerRegistry({ verifyAuthorization: verify });
    const handlerError = createAppError({ code: 'RAGE_ALREADY_ACTIVE', scope: 'handler.furia', message: 'Já em fúria.' });
    registry.register('furia', () => err(handlerError));
    const scope = { entityId: 'dnd2024:feature:x', handlerId: 'furia', operation: 'op' };
    const result = registry.invokeAuthorized({ authorization: issue(scope), ...scope, payload: {} });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, handlerError);
  });

  test('verifyAuthorization que devolve algo diferente de `true` não autoriza', () => {
    for (const retorno of ['true', 1, {}, [], 'ok']) {
      const registry = OfficialHandlerRegistry({ verifyAuthorization: () => retorno });
      registry.register('furia', () => ok('executou'));
      const result = registry.invokeAuthorized({
        authorization: {},
        entityId: 'dnd2024:feature:x',
        handlerId: 'furia',
        operation: 'op',
        payload: {},
      });
      assert.strictEqual(result.ok, false, JSON.stringify(retorno));
      assert.strictEqual(result.error.code, 'OFFICIAL_HANDLER_NOT_AUTHORIZED');
    }
  });

  test('requisição malformada é recusada antes de qualquer verificação', () => {
    let verifyCalls = 0;
    const registry = OfficialHandlerRegistry({
      verifyAuthorization: () => {
        verifyCalls += 1;
        return true;
      },
    });
    registry.register('furia', () => ok(1));
    for (const request of [undefined, null, 'x', [], { handlerId: 'furia' }, { entityId: 'a', handlerId: 'furia' }]) {
      const result = registry.invokeAuthorized(request);
      assert.strictEqual(result.ok, false, JSON.stringify(request ?? null));
      assert.strictEqual(result.error.code, 'OFFICIAL_HANDLER_INVALID_REQUEST');
    }
    assert.strictEqual(verifyCalls, 0);
  });
});
