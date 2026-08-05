import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ContentRegistry, createContentRuntime } from '../../../site/js/content/registry.js';
import {
  createOfficialSourceCapabilities,
  createSourceCapabilities,
  hasOfficialHandlersCapability,
} from '../../../site/js/content/capabilities.js';
import { createOfficialHandlerAuthorizationChannel } from '../../../site/js/content/official-handler-authorization.js';
import { createAppError } from '../../../site/js/core/errors.js';
import { ok, err, isResult } from '../../../site/js/core/result.js';
import {
  createMemoryContentSource,
  createPermissiveContentValidator,
  createSchemaContentValidator,
  buildIndexFromEntities,
} from '../../helpers/memory-content-source.js';

const OFFICIAL_NAMESPACE = 'dnd2024';

/**
 * Monta um manifesto mínimo pronto para ativação (`status: "ready"`).
 * @param {{namespace?: string, version?: string, entities?: Array<string>, extra?: object}} params
 */
function makeManifest({ namespace = 'custom-pack', version = '1.0.0', entities = ['ability'], extra = {} } = {}) {
  return {
    schemaVersion: '1.0.0',
    id: namespace,
    name: `Pacote ${namespace}`,
    version,
    status: 'ready',
    ruleset: `${namespace}:ruleset:core`,
    entities,
    referenceMigrations: [],
    ...extra,
  };
}

/**
 * Monta uma entidade `ability` mínima e válida no namespace informado.
 * @param {string} namespace
 * @param {string} slug
 * @param {object} [extra]
 */
function makeAbility(namespace, slug, extra = {}) {
  return {
    id: `${namespace}:ability:${slug}`,
    type: 'ability',
    schemaVersion: '1.0.0',
    name: slug,
    abbreviation: 'FOR',
    ...extra,
  };
}

/**
 * Monta uma entidade `feature` que declara um handler oficial.
 * @param {string} namespace
 * @param {string} slug
 * @param {string} handlerId
 */
function makeFeatureWithHandler(namespace, slug, handlerId) {
  return {
    id: `${namespace}:feature:${slug}`,
    type: 'feature',
    schemaVersion: '1.0.0',
    name: slug,
    effects: [{ type: 'official-handler', handlerId, params: {} }],
  };
}

/**
 * Registra uma fonte em memória com um pacote pronto e devolve o registry.
 * @param {{entities: Array<object>, capabilities: object, manifest?: object, validator?: object}} params
 */
function registryWith({ entities, capabilities, manifest, validator = createPermissiveContentValidator() }) {
  const registry = ContentRegistry({ validator });
  const source = createMemoryContentSource({
    manifest: manifest ?? makeManifest({ namespace: capabilities.namespace }),
    index: buildIndexFromEntities(entities),
    entities,
  });
  const registered = registry.registerSource(source, capabilities);
  assert.equal(registered.ok, true, JSON.stringify(registered.error ?? null));
  return registry;
}

describe('ContentRegistry: superfície pública', () => {
  test('expõe exatamente os sete métodos aprovados', () => {
    const registry = ContentRegistry({ validator: createPermissiveContentValidator() });
    const methods = Object.keys(registry).sort();
    assert.deepEqual(methods, [
      'get',
      'initialize',
      'list',
      'registerSource',
      'resolve',
      'validateEntity',
      'validatePackage',
    ]);
  });

  test('o registry é congelado e não aceita métodos adicionais', () => {
    const registry = ContentRegistry({ validator: createPermissiveContentValidator() });
    assert.equal(Object.isFrozen(registry), true);
    assert.throws(() => {
      registry.invokeHandler = () => {};
    }, TypeError);
  });

  test('rejeita construção sem um validador completo', () => {
    assert.throws(() => ContentRegistry({}), TypeError);
    assert.throws(() => ContentRegistry({ validator: { validateEntity: () => {} } }), TypeError);
  });
});

describe('ContentRegistry: registro de fontes', () => {
  test('registra uma fonte válida com capacidades e devolve ok', () => {
    const registry = ContentRegistry({ validator: createPermissiveContentValidator() });
    const source = createMemoryContentSource({ manifest: makeManifest(), index: { schemaVersion: '1.0.0', entries: [] } });
    const result = registry.registerSource(source, createSourceCapabilities({ namespace: 'custom-pack' }));
    assert.equal(result.ok, true);
    assert.equal(result.value, undefined);
  });

  test('rejeita uma fonte que não implementa o contrato de três métodos', () => {
    const registry = ContentRegistry({ validator: createPermissiveContentValidator() });
    const result = registry.registerSource(
      { loadManifest: async () => ok({}), loadIndex: async () => ok({}) },
      createSourceCapabilities({ namespace: 'custom-pack' }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_SOURCE_INVALID');
  });

  test('rejeita capacidades ausentes ou sem namespace válido', () => {
    const registry = ContentRegistry({ validator: createPermissiveContentValidator() });
    const source = createMemoryContentSource({ manifest: makeManifest(), index: { schemaVersion: '1.0.0', entries: [] } });
    assert.equal(registry.registerSource(source, null).error.code, 'CONTENT_CAPABILITIES_INVALID');
    assert.equal(registry.registerSource(source, { namespace: 'MAIÚSCULO' }).error.code, 'CONTENT_CAPABILITIES_INVALID');
  });

  test('proíbe duas fontes reivindicando o mesmo namespace (sem sobrescrita implícita)', () => {
    const registry = ContentRegistry({ validator: createPermissiveContentValidator() });
    const makeSource = () =>
      createMemoryContentSource({ manifest: makeManifest(), index: { schemaVersion: '1.0.0', entries: [] } });
    assert.equal(registry.registerSource(makeSource(), createSourceCapabilities({ namespace: 'custom-pack' })).ok, true);
    const second = registry.registerSource(makeSource(), createSourceCapabilities({ namespace: 'custom-pack' }));
    assert.equal(second.ok, false);
    assert.equal(second.error.code, 'CONTENT_NAMESPACE_ALREADY_REGISTERED');
  });

  test('proíbe registrar fonte depois de initialize()', async () => {
    const entities = [makeAbility('custom-pack', 'forca')];
    const registry = registryWith({ entities, capabilities: createSourceCapabilities({ namespace: 'custom-pack' }) });
    assert.equal((await registry.initialize()).ok, true);
    const late = registry.registerSource(
      createMemoryContentSource({ manifest: makeManifest({ namespace: 'outro' }), index: { schemaVersion: '1.0.0', entries: [] } }),
      createSourceCapabilities({ namespace: 'outro' }),
    );
    assert.equal(late.ok, false);
    assert.equal(late.error.code, 'CONTENT_REGISTRY_ALREADY_INITIALIZED');
  });
});

describe('ContentRegistry: initialize()', () => {
  test('ativa o pacote e devolve ok', async () => {
    const entities = [makeAbility('custom-pack', 'forca'), makeAbility('custom-pack', 'destreza')];
    const registry = registryWith({ entities, capabilities: createSourceCapabilities({ namespace: 'custom-pack' }) });
    const result = await registry.initialize();
    assert.equal(result.ok, true);
    assert.equal(registry.list('ability').length, 2);
  });

  test('recusa initialize() duas vezes', async () => {
    const entities = [makeAbility('custom-pack', 'forca')];
    const registry = registryWith({ entities, capabilities: createSourceCapabilities({ namespace: 'custom-pack' }) });
    assert.equal((await registry.initialize()).ok, true);
    const second = await registry.initialize();
    assert.equal(second.ok, false);
    assert.equal(second.error.code, 'CONTENT_REGISTRY_ALREADY_INITIALIZED');
  });

  test('recusa initialize() sem nenhuma fonte registrada', async () => {
    const registry = ContentRegistry({ validator: createPermissiveContentValidator() });
    const result = await registry.initialize();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_REGISTRY_NO_SOURCES');
  });

  test('exige manifest.status === "ready": um pacote "building" nunca é ativado', async () => {
    const entities = [makeAbility('custom-pack', 'forca')];
    const registry = registryWith({
      entities,
      capabilities: createSourceCapabilities({ namespace: 'custom-pack' }),
      manifest: makeManifest({ namespace: 'custom-pack', extra: { status: 'building' } }),
    });
    const result = await registry.initialize();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_PACKAGE_NOT_READY');
    assert.deepEqual(registry.list('ability'), []);
    assert.equal(registry.get('custom-pack:ability:forca'), null);
  });

  test('rejeita manifesto sem status', async () => {
    const entities = [makeAbility('custom-pack', 'forca')];
    const manifest = makeManifest({ namespace: 'custom-pack' });
    delete manifest.status;
    const registry = registryWith({ entities, capabilities: createSourceCapabilities({ namespace: 'custom-pack' }), manifest });
    const result = await registry.initialize();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_PACKAGE_NOT_READY');
  });

  test('propaga a falha de carregamento da fonte sem ativar nada', async () => {
    const registry = ContentRegistry({ validator: createPermissiveContentValidator() });
    const source = createMemoryContentSource({
      manifest: makeManifest(),
      index: { schemaVersion: '1.0.0', entries: [] },
      failures: { manifest: createAppError({ code: 'REDE_INDISPONIVEL', scope: 'teste', message: 'offline' }) },
    });
    registry.registerSource(source, createSourceCapabilities({ namespace: 'custom-pack' }));
    const result = await registry.initialize();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'REDE_INDISPONIVEL');
  });

  test('rejeita fonte que não devolve Result (violação de contrato)', async () => {
    const registry = ContentRegistry({ validator: createPermissiveContentValidator() });
    const source = createMemoryContentSource({
      manifest: makeManifest(),
      index: { schemaVersion: '1.0.0', entries: [] },
      failures: { nonResult: 'manifest' },
    });
    registry.registerSource(source, createSourceCapabilities({ namespace: 'custom-pack' }));
    const result = await registry.initialize();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_SOURCE_CONTRACT_VIOLATION');
  });
});

describe('ContentRegistry: atomicidade de initialize()', () => {
  test('entidade inválida não deixa nenhuma entidade daquela fonte ativa', async () => {
    const boa = makeAbility('custom-pack', 'forca');
    const ruim = { id: 'custom-pack:ability:destreza', type: 'ability', schemaVersion: '1.0.0', name: 'Destreza' };
    const registry = registryWith({
      entities: [boa, ruim],
      capabilities: createSourceCapabilities({ namespace: 'custom-pack' }),
      validator: createSchemaContentValidator(),
    });
    const result = await registry.initialize();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_PACKAGE_INVALID');
    assert.deepEqual(registry.list('ability'), []);
    assert.equal(registry.get('custom-pack:ability:forca'), null);
  });

  test('referência quebrada (entidade fora do índice) aborta a ativação inteira', async () => {
    const entities = [makeAbility('custom-pack', 'forca'), makeAbility('custom-pack', 'destreza')];
    const index = buildIndexFromEntities(entities);
    // A fonte devolve, para a segunda entrada do índice, uma entidade com id
    // diferente do que foi pedido: o índice e as entidades deixam de casar.
    const source = Object.freeze({
      loadManifest: async () => ok(makeManifest({ namespace: 'custom-pack' })),
      loadIndex: async () => ok(index),
      loadEntity: async (id) =>
        ok(id === 'custom-pack:ability:destreza' ? makeAbility('custom-pack', 'intrusa') : entities[0]),
    });
    const registry = ContentRegistry({ validator: createSchemaContentValidator() });
    registry.registerSource(source, createSourceCapabilities({ namespace: 'custom-pack' }));
    const result = await registry.initialize();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_PACKAGE_INVALID');
    assert.equal(
      result.error.context.errors.some((error) => error.code === 'REFERENCES_ENTITY_NOT_INDEXED'),
      true,
    );
    assert.equal(registry.get('custom-pack:ability:forca'), null);
  });

  test('ID duplicado dentro do mesmo pacote aborta a ativação inteira', async () => {
    const entities = [makeAbility('custom-pack', 'forca'), makeAbility('custom-pack', 'forca')];
    const index = {
      schemaVersion: '1.0.0',
      entries: [
        { id: 'custom-pack:ability:forca', type: 'ability', path: 'a.json' },
        { id: 'custom-pack:ability:forca', type: 'ability', path: 'b.json' },
      ],
    };
    const registry = ContentRegistry({ validator: createPermissiveContentValidator() });
    const source = createMemoryContentSource({ manifest: makeManifest({ namespace: 'custom-pack' }), index, entities });
    registry.registerSource(source, createSourceCapabilities({ namespace: 'custom-pack' }));
    const result = await registry.initialize();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_ENTITY_DUPLICATE_ID');
    assert.equal(registry.get('custom-pack:ability:forca'), null);
  });

  test('falha em uma fonte não deixa nenhuma entidade de nenhuma fonte ativa', async () => {
    const registry = ContentRegistry({ validator: createPermissiveContentValidator() });
    const boas = [makeAbility('pacote-a', 'forca')];
    registry.registerSource(
      createMemoryContentSource({
        manifest: makeManifest({ namespace: 'pacote-a' }),
        index: buildIndexFromEntities(boas),
        entities: boas,
      }),
      createSourceCapabilities({ namespace: 'pacote-a' }),
    );
    const ruins = [makeAbility('pacote-b', 'destreza')];
    registry.registerSource(
      createMemoryContentSource({
        manifest: makeManifest({ namespace: 'pacote-b', extra: { status: 'building' } }),
        index: buildIndexFromEntities(ruins),
        entities: ruins,
      }),
      createSourceCapabilities({ namespace: 'pacote-b' }),
    );
    const result = await registry.initialize();
    assert.equal(result.ok, false);
    assert.equal(registry.get('pacote-a:ability:forca'), null, 'nenhuma fonte pode ficar parcialmente ativa');
    assert.deepEqual(registry.list('ability'), []);
  });

  test('depois de uma falha, initialize() pode ser tentado de novo', async () => {
    const registry = ContentRegistry({ validator: createPermissiveContentValidator() });
    let status = 'building';
    const entities = [makeAbility('custom-pack', 'forca')];
    const index = buildIndexFromEntities(entities);
    const source = Object.freeze({
      loadManifest: async () => ok({ ...makeManifest({ namespace: 'custom-pack' }), status }),
      loadIndex: async () => ok(index),
      loadEntity: async (id) => ok(entities.find((entity) => entity.id === id)),
    });
    registry.registerSource(source, createSourceCapabilities({ namespace: 'custom-pack' }));
    assert.equal((await registry.initialize()).ok, false);
    status = 'ready';
    assert.equal((await registry.initialize()).ok, true);
    assert.equal(registry.get('custom-pack:ability:forca').id, 'custom-pack:ability:forca');
  });

  test('ID duplicado entre fontes distintas é rejeitado (sem sobrescrita implícita)', async () => {
    const registry = ContentRegistry({ validator: createPermissiveContentValidator() });
    // Duas fontes com namespaces distintos, mas a segunda tenta publicar um id
    // do namespace da primeira: o guarda de namespace pega antes do merge.
    const primeiras = [makeAbility('pacote-a', 'forca')];
    registry.registerSource(
      createMemoryContentSource({
        manifest: makeManifest({ namespace: 'pacote-a' }),
        index: buildIndexFromEntities(primeiras),
        entities: primeiras,
      }),
      createSourceCapabilities({ namespace: 'pacote-a' }),
    );
    const invasoras = [makeAbility('pacote-a', 'forca')];
    registry.registerSource(
      createMemoryContentSource({
        manifest: makeManifest({ namespace: 'pacote-b' }),
        index: buildIndexFromEntities(invasoras),
        entities: invasoras,
      }),
      createSourceCapabilities({ namespace: 'pacote-b' }),
    );
    const result = await registry.initialize();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_NAMESPACE_NOT_GRANTED');
  });
});

describe('ContentRegistry: namespace concedido pelo composition root', () => {
  test('rejeita manifesto que reivindica namespace alheio no ruleset', async () => {
    const entities = [makeAbility('custom-pack', 'forca')];
    const manifest = makeManifest({ namespace: 'custom-pack' });
    manifest.ruleset = 'dnd2024:ruleset:core';
    const registry = registryWith({ entities, capabilities: createSourceCapabilities({ namespace: 'custom-pack' }), manifest });
    const result = await registry.initialize();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_NAMESPACE_NOT_GRANTED');
  });

  test('rejeita entidade cujo id está fora do namespace concedido', async () => {
    const entities = [makeAbility('dnd2024', 'forca')];
    const registry = registryWith({ entities, capabilities: createSourceCapabilities({ namespace: 'custom-pack' }) });
    const result = await registry.initialize();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_NAMESPACE_NOT_GRANTED');
  });

  test('createSourceCapabilities não pode conceder o namespace oficial', () => {
    assert.throws(() => createSourceCapabilities({ namespace: OFFICIAL_NAMESPACE }), TypeError);
  });

  test('capacidades forjadas não podem OCUPAR o namespace oficial no registerSource', () => {
    // Sem esta barreira, um objeto forjado não ganharia privilégio, mas
    // reservaria "dnd2024" e faria a fonte oficial legítima falhar depois com
    // CONTENT_NAMESPACE_ALREADY_REGISTERED.
    const registry = ContentRegistry({ validator: createPermissiveContentValidator() });
    const source = createMemoryContentSource({
      manifest: makeManifest({ namespace: OFFICIAL_NAMESPACE }),
      index: { schemaVersion: '1.0.0', entries: [] },
    });
    for (const forjadas of [
      { namespace: OFFICIAL_NAMESPACE },
      { namespace: OFFICIAL_NAMESPACE, officialHandlers: true },
      { namespace: OFFICIAL_NAMESPACE, officialHandlers: Symbol('officialHandlers') },
      { ...createOfficialSourceCapabilities() },
    ]) {
      const result = registry.registerSource(source, forjadas);
      assert.equal(result.ok, false, `capacidade forjada aceita: ${JSON.stringify(forjadas)}`);
      assert.equal(result.error.code, 'CONTENT_CAPABILITIES_INVALID');
    }
    // A fonte oficial legítima continua conseguindo registrar o namespace.
    assert.equal(registry.registerSource(source, createOfficialSourceCapabilities()).ok, true);
  });
});

describe('ContentRegistry: consultas', () => {
  const capabilities = createSourceCapabilities({ namespace: 'custom-pack' });
  const entities = [makeAbility('custom-pack', 'forca'), makeAbility('custom-pack', 'destreza')];

  /** Registry já inicializado usado pelos testes de consulta. */
  async function activated() {
    const registry = registryWith({ entities, capabilities });
    assert.equal((await registry.initialize()).ok, true);
    return registry;
  }

  test('list(type) devolve um array congelado e somente leitura', async () => {
    const registry = await activated();
    const lista = registry.list('ability');
    assert.equal(Object.isFrozen(lista), true);
    assert.throws(() => lista.push({}), TypeError);
    assert.equal(lista.length, 2);
  });

  test('list(type) devolve [] para tipo sem entidades e para registry não inicializado', async () => {
    const registry = await activated();
    assert.deepEqual(registry.list('spell'), []);
    const novo = registryWith({ entities, capabilities: createSourceCapabilities({ namespace: 'outro' }) });
    assert.deepEqual(novo.list('ability'), []);
  });

  test('as entidades publicadas são congeladas em profundidade', async () => {
    const registry = await activated();
    const entidade = registry.get('custom-pack:ability:forca');
    assert.equal(Object.isFrozen(entidade), true);
    assert.throws(() => {
      entidade.name = 'outro';
    }, TypeError);
  });

  test('get(id) devolve a entidade e null para id ausente ou malformado', async () => {
    const registry = await activated();
    assert.equal(registry.get('custom-pack:ability:forca').type, 'ability');
    assert.equal(registry.get('custom-pack:ability:inexistente'), null);
    assert.equal(registry.get('não é um id'), null);
    assert.equal(registry.get(null), null);
  });

  test('resolve() devolve a entidade para uma referência válida', async () => {
    const registry = await activated();
    const result = registry.resolve('custom-pack:ability:forca', 'ability');
    assert.equal(result.ok, true);
    assert.equal(result.value.id, 'custom-pack:ability:forca');
  });

  test('resolve() rejeita tipo incorreto', async () => {
    const registry = await activated();
    const result = registry.resolve('custom-pack:ability:forca', 'spell');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_REFERENCE_TYPE_MISMATCH');
  });

  test('resolve() rejeita referência ausente', async () => {
    const registry = await activated();
    const result = registry.resolve('custom-pack:ability:inexistente', 'ability');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_REFERENCE_NOT_FOUND');
  });

  test('resolve() rejeita referência malformada', async () => {
    const registry = await activated();
    assert.equal(registry.resolve('nao-e-id', 'ability').error.code, 'CONTENT_REFERENCE_INVALID');
    assert.equal(registry.resolve(42, 'ability').error.code, 'CONTENT_REFERENCE_INVALID');
  });

  test('resolve() antes de initialize() falha com CONTENT_REGISTRY_NOT_INITIALIZED', () => {
    const registry = registryWith({ entities, capabilities: createSourceCapabilities({ namespace: 'ainda-nao' }) });
    const result = registry.resolve('custom-pack:ability:forca', 'ability');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_REGISTRY_NOT_INITIALIZED');
  });

  test('resolve() com ContentRef de versão divergente devolve CONTENT_VERSION_MIGRATION_REQUIRED', async () => {
    const registry = await activated();
    const result = registry.resolve({ id: 'custom-pack:ability:forca', packageVersion: '0.9.0' }, 'ability');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_VERSION_MIGRATION_REQUIRED');
    assert.equal(result.error.context.activeVersion, '1.0.0');
    assert.equal(result.error.context.requestedVersion, '0.9.0');
  });

  test('resolve() com ContentRef da versão ativa funciona (uma única versão ativa por namespace)', async () => {
    const registry = await activated();
    const result = registry.resolve({ id: 'custom-pack:ability:forca', packageVersion: '1.0.0' }, 'ability');
    assert.equal(result.ok, true);
  });

  test('validateEntity/validatePackage delegam ao validador injetado', () => {
    let chamadas = 0;
    const validator = {
      validateManifest: () => ({ valid: true, errors: [], warnings: [] }),
      validateIndex: () => ({ valid: true, errors: [], warnings: [] }),
      validateEntity: () => {
        chamadas += 1;
        return { valid: true, errors: [], warnings: [] };
      },
      validateReferences: () => ({ valid: true, errors: [], warnings: [] }),
    };
    const registry = ContentRegistry({ validator });
    assert.equal(registry.validateEntity({ type: 'ability' }).valid, true);
    assert.equal(chamadas, 1);
    const pacote = registry.validatePackage(makeManifest(), buildIndexFromEntities([]), []);
    assert.equal(pacote.valid, true);
  });
});

describe('createContentRuntime: fiação de capacidade e handlers', () => {
  /**
   * Monta um runtime completo com canal de autorização real e um handler
   * registry fake que recebe SOMENTE `verify`.
   * @param {{capabilities: object, entities?: Array<object>, manifest?: object}} params
   */
  function makeRuntime({ capabilities, entities, manifest }) {
    const channel = createOfficialHandlerAuthorizationChannel();
    const recebidas = [];
    const handlerRegistry = {
      // O fake é o único a receber `verify`; ele nunca vê `issue`.
      invokeAuthorized({ authorization, entityId, handlerId, operation, payload }) {
        recebidas.push({ authorization, entityId, handlerId, operation, payload });
        if (!channel.verify(authorization, { entityId, handlerId, operation })) {
          return err(
            createAppError({
              code: 'OFFICIAL_HANDLER_AUTHORIZATION_REJECTED',
              scope: 'teste.handler-registry',
              message: 'Autorização inválida, reutilizada ou fora de escopo.',
            }),
          );
        }
        return ok({ handlerId, entityId, operation, applied: true });
      },
    };
    const runtime = createContentRuntime({
      validator: createPermissiveContentValidator(),
      handlerRegistry,
      issueOfficialHandlerAuthorization: channel.issue,
    });
    const lista = entities ?? [makeFeatureWithHandler(capabilities.namespace, 'furia', 'furia')];
    const source = createMemoryContentSource({
      manifest: manifest ?? makeManifest({ namespace: capabilities.namespace, entities: ['feature'] }),
      index: buildIndexFromEntities(lista),
      entities: lista,
    });
    const registrado = runtime.registry.registerSource(source, capabilities);
    assert.equal(registrado.ok, true, JSON.stringify(registrado.error ?? null));
    return { ...runtime, channel, handlerRegistry, recebidas };
  }

  test('devolve registry e officialHandlerInvoker como portas distintas e congeladas', () => {
    const runtime = makeRuntime({ capabilities: createOfficialSourceCapabilities() });
    assert.deepEqual(Object.keys(runtime.officialHandlerInvoker), ['invoke']);
    assert.equal(Object.isFrozen(runtime.officialHandlerInvoker), true);
    assert.equal(typeof runtime.registry.registerSource, 'function');
    assert.equal(runtime.registry.invoke, undefined);
  });

  test('fonte oficial que declara o handler: a invocação é autorizada', async () => {
    const runtime = makeRuntime({ capabilities: createOfficialSourceCapabilities() });
    assert.equal((await runtime.registry.initialize()).ok, true);
    const result = runtime.officialHandlerInvoker.invoke({
      entityId: `${OFFICIAL_NAMESPACE}:feature:furia`,
      handlerId: 'furia',
      operation: 'activate',
    });
    assert.equal(isResult(result), true);
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.equal(result.value.applied, true);
  });

  test('a autorização é de uso único: reutilizá-la é rejeitado', async () => {
    const runtime = makeRuntime({ capabilities: createOfficialSourceCapabilities() });
    assert.equal((await runtime.registry.initialize()).ok, true);
    const request = { entityId: `${OFFICIAL_NAMESPACE}:feature:furia`, handlerId: 'furia', operation: 'activate' };
    assert.equal(runtime.officialHandlerInvoker.invoke(request).ok, true);
    const autorizacaoUsada = runtime.recebidas[0].authorization;
    const reuso = runtime.handlerRegistry.invokeAuthorized({ ...request, authorization: autorizacaoUsada });
    assert.equal(reuso.ok, false);
    assert.equal(reuso.error.code, 'OFFICIAL_HANDLER_AUTHORIZATION_REJECTED');
  });

  test('objeto literal com cara de autorização é rejeitado (opacidade, não formato)', async () => {
    const runtime = makeRuntime({ capabilities: createOfficialSourceCapabilities() });
    assert.equal((await runtime.registry.initialize()).ok, true);
    const request = { entityId: `${OFFICIAL_NAMESPACE}:feature:furia`, handlerId: 'furia', operation: 'activate' };
    for (const forjada of [
      {},
      { entityId: request.entityId, handlerId: 'furia', operation: 'activate' },
      { valid: true, granted: true },
      Object.freeze({ entityId: request.entityId, handlerId: 'furia', operation: 'activate', signature: 'ok' }),
      'autorizado',
      null,
      undefined,
    ]) {
      const resultado = runtime.handlerRegistry.invokeAuthorized({ ...request, authorization: forjada });
      assert.equal(resultado.ok, false, `autorização forjada aceita: ${JSON.stringify(forjada)}`);
      assert.equal(resultado.error.code, 'OFFICIAL_HANDLER_AUTHORIZATION_REJECTED');
    }
  });

  test('chamada direta ao handler registry sem passar pelo invoker é rejeitada', async () => {
    const runtime = makeRuntime({ capabilities: createOfficialSourceCapabilities() });
    assert.equal((await runtime.registry.initialize()).ok, true);
    const direta = runtime.handlerRegistry.invokeAuthorized({
      entityId: `${OFFICIAL_NAMESPACE}:feature:furia`,
      handlerId: 'furia',
      operation: 'activate',
    });
    assert.equal(direta.ok, false);
    assert.equal(direta.error.code, 'OFFICIAL_HANDLER_AUTHORIZATION_REJECTED');
  });

  test('autorização emitida para uma entidade não vale para outra nem para outro handler/operação', async () => {
    const entities = [
      makeFeatureWithHandler(OFFICIAL_NAMESPACE, 'furia', 'furia'),
      makeFeatureWithHandler(OFFICIAL_NAMESPACE, 'esquiva', 'esquiva'),
    ];
    const runtime = makeRuntime({
      capabilities: createOfficialSourceCapabilities(),
      entities,
      manifest: makeManifest({ namespace: OFFICIAL_NAMESPACE, entities: ['feature'] }),
    });
    assert.equal((await runtime.registry.initialize()).ok, true);
    // Emite uma autorização legítima para furia/activate...
    assert.equal(
      runtime.officialHandlerInvoker.invoke({
        entityId: `${OFFICIAL_NAMESPACE}:feature:furia`,
        handlerId: 'furia',
        operation: 'activate',
      }).ok,
      true,
    );
    const autorizacao = runtime.recebidas[0].authorization;
    // ...e tenta reaproveitá-la trocando entidade, handler e operação.
    for (const trocado of [
      { entityId: `${OFFICIAL_NAMESPACE}:feature:esquiva`, handlerId: 'furia', operation: 'activate' },
      { entityId: `${OFFICIAL_NAMESPACE}:feature:furia`, handlerId: 'esquiva', operation: 'activate' },
      { entityId: `${OFFICIAL_NAMESPACE}:feature:furia`, handlerId: 'furia', operation: 'deactivate' },
    ]) {
      const resultado = runtime.handlerRegistry.invokeAuthorized({ ...trocado, authorization: autorizacao });
      assert.equal(resultado.ok, false, `escopo trocado aceito: ${JSON.stringify(trocado)}`);
    }
  });

  test('a autorização não é emitida quando a entidade não declara aquele handler', async () => {
    const runtime = makeRuntime({ capabilities: createOfficialSourceCapabilities() });
    assert.equal((await runtime.registry.initialize()).ok, true);
    const result = runtime.officialHandlerInvoker.invoke({
      entityId: `${OFFICIAL_NAMESPACE}:feature:furia`,
      handlerId: 'outro-handler',
      operation: 'activate',
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'OFFICIAL_HANDLER_NOT_DECLARED');
    assert.equal(runtime.recebidas.length, 0, 'o handler registry nem chega a ser chamado');
  });

  test('a autorização não é emitida para entidade inexistente ou inativa', async () => {
    const runtime = makeRuntime({ capabilities: createOfficialSourceCapabilities() });
    const antes = runtime.officialHandlerInvoker.invoke({
      entityId: `${OFFICIAL_NAMESPACE}:feature:furia`,
      handlerId: 'furia',
      operation: 'activate',
    });
    assert.equal(antes.ok, false);
    assert.equal(antes.error.code, 'OFFICIAL_HANDLER_ENTITY_NOT_FOUND');
    assert.equal((await runtime.registry.initialize()).ok, true);
    const inexistente = runtime.officialHandlerInvoker.invoke({
      entityId: `${OFFICIAL_NAMESPACE}:feature:fantasma`,
      handlerId: 'furia',
      operation: 'activate',
    });
    assert.equal(inexistente.error.code, 'OFFICIAL_HANDLER_ENTITY_NOT_FOUND');
    assert.equal(runtime.recebidas.length, 0);
  });

  test('request malformado é rejeitado antes de qualquer emissão', async () => {
    const runtime = makeRuntime({ capabilities: createOfficialSourceCapabilities() });
    assert.equal((await runtime.registry.initialize()).ok, true);
    for (const request of [
      null,
      'furia',
      {},
      { entityId: `${OFFICIAL_NAMESPACE}:feature:furia`, handlerId: 'furia' },
      { entityId: `${OFFICIAL_NAMESPACE}:feature:furia`, handlerId: '', operation: 'activate' },
      { entityId: 42, handlerId: 'furia', operation: 'activate' },
    ]) {
      const resultado = runtime.officialHandlerInvoker.invoke(request);
      assert.equal(resultado.ok, false);
      assert.equal(resultado.error.code, 'OFFICIAL_HANDLER_INVALID_REQUEST');
    }
    assert.equal(runtime.recebidas.length, 0);
  });

  test('createContentRuntime exige issue e handlerRegistry.invokeAuthorized', () => {
    assert.throws(
      () =>
        createContentRuntime({
          validator: createPermissiveContentValidator(),
          handlerRegistry: {},
          issueOfficialHandlerAuthorization: () => {},
        }),
      TypeError,
    );
    assert.throws(
      () =>
        createContentRuntime({
          validator: createPermissiveContentValidator(),
          handlerRegistry: { invokeAuthorized: () => {} },
          issueOfficialHandlerAuthorization: null,
        }),
      TypeError,
    );
  });
});

describe('Segurança: nenhum dado JSON concede a capacidade officialHandlers', () => {
  const manifestoMalicioso = makeManifest({
    namespace: 'custom-pack',
    entities: ['feature'],
    extra: {
      // Tudo abaixo é JSON não confiável e deve ser ignorado por completo.
      authors: [{ name: 'Wizards of the Coast', role: 'official' }],
      official: true,
      trusted: true,
      officialHandlers: true,
      capabilities: { officialHandlers: true, namespace: 'dnd2024' },
    },
  });

  test('um manifesto que se declara oficial não obtém a capacidade', async () => {
    const channel = createOfficialHandlerAuthorizationChannel();
    const handlerRegistry = {
      invokeAuthorized: ({ authorization, entityId, handlerId, operation }) =>
        channel.verify(authorization, { entityId, handlerId, operation })
          ? ok({ applied: true })
          : err(createAppError({ code: 'OFFICIAL_HANDLER_AUTHORIZATION_REJECTED', scope: 'teste', message: 'negado' })),
    };
    const runtime = createContentRuntime({
      validator: createPermissiveContentValidator(),
      handlerRegistry,
      issueOfficialHandlerAuthorization: channel.issue,
    });
    const entities = [makeFeatureWithHandler('custom-pack', 'furia', 'furia')];
    runtime.registry.registerSource(
      createMemoryContentSource({ manifest: manifestoMalicioso, index: buildIndexFromEntities(entities), entities }),
      createSourceCapabilities({ namespace: 'custom-pack' }),
    );
    assert.equal((await runtime.registry.initialize()).ok, true, 'o pacote é conteúdo válido, só não é privilegiado');
    const result = runtime.officialHandlerInvoker.invoke({
      entityId: 'custom-pack:feature:furia',
      handlerId: 'furia',
      operation: 'activate',
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'OFFICIAL_HANDLER_NOT_AUTHORIZED');
  });

  test('um manifesto customizado que reivindica o namespace dnd2024 nem chega a ser ativado', async () => {
    const registry = ContentRegistry({ validator: createPermissiveContentValidator() });
    const entities = [makeFeatureWithHandler('dnd2024', 'furia', 'furia')];
    const manifest = { ...manifestoMalicioso, id: 'dnd2024', ruleset: 'dnd2024:ruleset:core' };
    registry.registerSource(
      createMemoryContentSource({ manifest, index: buildIndexFromEntities(entities), entities }),
      createSourceCapabilities({ namespace: 'custom-pack' }),
    );
    const result = await registry.initialize();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_NAMESPACE_NOT_GRANTED');
  });

  test('capacidades forjadas por objeto literal não passam por hasOfficialHandlersCapability', () => {
    assert.equal(hasOfficialHandlersCapability({ namespace: 'dnd2024', officialHandlers: true }), false);
    assert.equal(hasOfficialHandlersCapability({ namespace: 'dnd2024', officialHandlers: 'sim' }), false);
    assert.equal(hasOfficialHandlersCapability({ namespace: 'dnd2024', officialHandlers: Symbol('officialHandlers') }), false);
    assert.equal(hasOfficialHandlersCapability(null), false);
    assert.equal(hasOfficialHandlersCapability(undefined), false);
    assert.equal(hasOfficialHandlersCapability(createSourceCapabilities({ namespace: 'custom-pack' })), false);
    assert.equal(hasOfficialHandlersCapability(createOfficialSourceCapabilities()), true);
  });

  test('copiar o token de capacidades oficiais para outro objeto não transfere a capacidade', () => {
    const oficiais = createOfficialSourceCapabilities();
    const copia = { ...oficiais };
    assert.equal(hasOfficialHandlersCapability(copia), false);
    assert.equal(hasOfficialHandlersCapability(Object.freeze({ ...oficiais })), false);
  });

  test('o token de capacidade nunca aparece em JSON', () => {
    const oficiais = createOfficialSourceCapabilities();
    assert.equal(JSON.stringify(oficiais), '{"namespace":"dnd2024"}');
    assert.equal(JSON.stringify({ capabilities: oficiais }).includes('officialHandlers'), false);
  });

  test('capacidades forjadas não autorizam a invocação mesmo com entidade ativa', async () => {
    const channel = createOfficialHandlerAuthorizationChannel();
    let emitidas = 0;
    const runtime = createContentRuntime({
      validator: createPermissiveContentValidator(),
      handlerRegistry: { invokeAuthorized: () => ok({ applied: true }) },
      issueOfficialHandlerAuthorization: (scope) => {
        emitidas += 1;
        return channel.issue(scope);
      },
    });
    const entities = [makeFeatureWithHandler('custom-pack', 'furia', 'furia')];
    // Capacidade forjada: parece oficial em todos os aspectos observáveis.
    const forjadas = Object.freeze({ namespace: 'custom-pack', officialHandlers: Symbol('officialHandlers') });
    runtime.registry.registerSource(
      createMemoryContentSource({
        manifest: makeManifest({ namespace: 'custom-pack', entities: ['feature'] }),
        index: buildIndexFromEntities(entities),
        entities,
      }),
      forjadas,
    );
    assert.equal((await runtime.registry.initialize()).ok, true);
    const result = runtime.officialHandlerInvoker.invoke({
      entityId: 'custom-pack:feature:furia',
      handlerId: 'furia',
      operation: 'activate',
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'OFFICIAL_HANDLER_NOT_AUTHORIZED');
    assert.equal(emitidas, 0, 'nenhuma autorização pode ser emitida para uma fonte não oficial');
  });

  test('nenhum AppError do invoker carrega a autorização ou o token', async () => {
    const channel = createOfficialHandlerAuthorizationChannel();
    const runtime = createContentRuntime({
      validator: createPermissiveContentValidator(),
      handlerRegistry: {
        invokeAuthorized: () => err(createAppError({ code: 'HANDLER_FALHOU', scope: 'teste', message: 'falhou' })),
      },
      issueOfficialHandlerAuthorization: channel.issue,
    });
    const entities = [makeFeatureWithHandler(OFFICIAL_NAMESPACE, 'furia', 'furia')];
    runtime.registry.registerSource(
      createMemoryContentSource({
        manifest: makeManifest({ namespace: OFFICIAL_NAMESPACE, entities: ['feature'] }),
        index: buildIndexFromEntities(entities),
        entities,
      }),
      createOfficialSourceCapabilities(),
    );
    assert.equal((await runtime.registry.initialize()).ok, true);
    const result = runtime.officialHandlerInvoker.invoke({
      entityId: `${OFFICIAL_NAMESPACE}:feature:furia`,
      handlerId: 'furia',
      operation: 'activate',
    });
    assert.equal(result.ok, false);
    const serializado = JSON.stringify(result);
    assert.equal(serializado.includes('authorization'), false);
    assert.equal(serializado.includes('officialHandlers'), false);
  });
});

describe('createOfficialHandlerAuthorizationChannel', () => {
  test('devolve exatamente issue e verify', () => {
    const channel = createOfficialHandlerAuthorizationChannel();
    assert.deepEqual(Object.keys(channel).sort(), ['issue', 'verify']);
    assert.equal(Object.isFrozen(channel), true);
  });

  test('a autorização é opaca: sem dados inspecionáveis nem serializáveis', () => {
    const channel = createOfficialHandlerAuthorizationChannel();
    const autorizacao = channel.issue({ entityId: 'dnd2024:feature:furia', handlerId: 'furia', operation: 'activate' });
    assert.deepEqual(Object.keys(autorizacao), []);
    assert.deepEqual(Object.getOwnPropertyNames(autorizacao), []);
    assert.deepEqual(Object.getOwnPropertySymbols(autorizacao), []);
    assert.equal(JSON.stringify(autorizacao), '{}');
    assert.equal(Object.isFrozen(autorizacao), true);
  });

  test('cada emissão produz um valor distinto', () => {
    const channel = createOfficialHandlerAuthorizationChannel();
    const escopo = { entityId: 'dnd2024:feature:furia', handlerId: 'furia', operation: 'activate' };
    assert.notEqual(channel.issue(escopo), channel.issue(escopo));
  });

  test('verify aceita uma vez e recusa na segunda', () => {
    const channel = createOfficialHandlerAuthorizationChannel();
    const escopo = { entityId: 'dnd2024:feature:furia', handlerId: 'furia', operation: 'activate' };
    const autorizacao = channel.issue(escopo);
    assert.equal(channel.verify(autorizacao, escopo), true);
    assert.equal(channel.verify(autorizacao, escopo), false);
  });

  test('uma autorização de outro canal nunca é aceita', () => {
    const escopo = { entityId: 'dnd2024:feature:furia', handlerId: 'furia', operation: 'activate' };
    const canalA = createOfficialHandlerAuthorizationChannel();
    const canalB = createOfficialHandlerAuthorizationChannel();
    assert.equal(canalB.verify(canalA.issue(escopo), escopo), false);
  });

  test('verify recusa escopo divergente e consome a autorização mesmo assim', () => {
    const channel = createOfficialHandlerAuthorizationChannel();
    const escopo = { entityId: 'dnd2024:feature:furia', handlerId: 'furia', operation: 'activate' };
    const autorizacao = channel.issue(escopo);
    assert.equal(channel.verify(autorizacao, { ...escopo, operation: 'deactivate' }), false);
    assert.equal(channel.verify(autorizacao, escopo), false, 'a tentativa falha consome a autorização');
  });

  test('issue rejeita escopo malformado', () => {
    const channel = createOfficialHandlerAuthorizationChannel();
    assert.throws(() => channel.issue(null), TypeError);
    assert.throws(() => channel.issue({ entityId: 'x', handlerId: 'y' }), TypeError);
    assert.throws(() => channel.issue({ entityId: '', handlerId: 'y', operation: 'z' }), TypeError);
  });
});
