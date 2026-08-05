import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { assertContentSource } from '../../site/js/content/source.js';
import { ContentRegistry } from '../../site/js/content/registry.js';
import { createSourceCapabilities } from '../../site/js/content/capabilities.js';
import { ok } from '../../site/js/core/result.js';
import {
  createMemoryContentSource,
  createSchemaContentValidator,
  loadCustomSamplePackage,
} from '../helpers/memory-content-source.js';

const ALL_ENTITY_TYPES = Object.freeze([
  'ruleset',
  'ability',
  'skill',
  'condition',
  'damage-type',
  'language',
  'class',
  'subclass',
  'feature',
  'species',
  'background',
  'feat',
  'spell',
  'spell-list',
  'weapon',
  'armor',
  'equipment',
  'creature',
  'glossary-entry',
  'migration-map',
]);

describe('assertContentSource: contrato da fonte de conteúdo', () => {
  test('aceita uma fonte com exatamente loadManifest, loadIndex e loadEntity', () => {
    const source = createMemoryContentSource({ manifest: {}, index: { schemaVersion: '1.0.0', entries: [] } });
    const result = assertContentSource(source);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  test('recusa valores que não são objetos', () => {
    for (const value of [null, undefined, 42, 'fonte', [], () => {}]) {
      const result = assertContentSource(value);
      assert.equal(result.valid, false, `aceitou ${String(value)}`);
      assert.equal(result.errors[0].code, 'CONTENT_SOURCE_NOT_OBJECT');
    }
  });

  test('recusa fonte sem algum dos três métodos e nomeia o que falta', () => {
    const result = assertContentSource({ loadManifest: async () => ok({}) });
    assert.equal(result.valid, false);
    const faltando = result.errors.map((error) => error.context.method).sort();
    assert.deepEqual(faltando, ['loadEntity', 'loadIndex']);
    for (const error of result.errors) {
      assert.equal(error.code, 'CONTENT_SOURCE_METHOD_MISSING');
    }
  });

  test('recusa quando um dos três não é função', () => {
    const result = assertContentSource({ loadManifest: 'x', loadIndex: async () => ok({}), loadEntity: async () => ok({}) });
    assert.equal(result.valid, false);
    assert.equal(result.errors[0].code, 'CONTENT_SOURCE_METHOD_MISSING');
  });

  test('avisa (sem invalidar) sobre métodos extras além dos três do contrato', () => {
    const result = assertContentSource({
      loadManifest: async () => ok({}),
      loadIndex: async () => ok({}),
      loadEntity: async () => ok({}),
      loadTudoDeUmaVez: async () => ok({}),
    });
    assert.equal(result.valid, true);
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].code, 'CONTENT_SOURCE_UNEXPECTED_METHOD');
  });
});

describe('Pacote de amostra customizado: todos os tipos pela mesma interface', () => {
  test('a fixture cobre exatamente os 20 tipos do enum fechado', () => {
    const { entities, index, manifest } = loadCustomSamplePackage();
    assert.deepEqual([...entities.map((entity) => entity.type)].sort(), [...ALL_ENTITY_TYPES].sort());
    assert.deepEqual([...index.entries.map((entry) => entry.type)].sort(), [...ALL_ENTITY_TYPES].sort());
    assert.deepEqual([...manifest.entities].sort(), [...ALL_ENTITY_TYPES].sort());
  });

  test('todo o pacote é validado pelos validadores reais dos schemas', () => {
    const { manifest, index, entities } = loadCustomSamplePackage();
    const validator = createSchemaContentValidator();
    const registry = ContentRegistry({ validator });
    const resultado = registry.validatePackage(manifest, index, entities);
    assert.equal(resultado.valid, true, JSON.stringify(resultado.errors, null, 2));
  });

  test('cada entidade isolada passa por registry.validateEntity', () => {
    const { entities } = loadCustomSamplePackage();
    const registry = ContentRegistry({ validator: createSchemaContentValidator() });
    for (const entity of entities) {
      const resultado = registry.validateEntity(entity);
      assert.equal(resultado.valid, true, `${entity.id}: ${JSON.stringify(resultado.errors, null, 2)}`);
    }
  });

  test('uma fonte customizada ativa os 20 tipos sem existir importador nem UI', async () => {
    const { manifest, index, entities } = loadCustomSamplePackage();
    const registry = ContentRegistry({ validator: createSchemaContentValidator() });
    const source = createMemoryContentSource({ manifest, index, entities });
    assert.equal(registry.registerSource(source, createSourceCapabilities({ namespace: 'custom-sample' })).ok, true);
    const result = await registry.initialize();
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null, null, 2));

    for (const type of ALL_ENTITY_TYPES) {
      const lista = registry.list(type);
      assert.equal(lista.length, 1, `tipo sem entidade ativa: ${type}`);
      assert.equal(Object.isFrozen(lista), true);
      assert.equal(registry.resolve(lista[0].id, type).ok, true);
    }
    assert.equal(registry.get('custom-sample:ruleset:core').edition, 'Amostra 1');
  });

  test('o pacote de amostra não recebe nenhuma capacidade só por existir', async () => {
    const { manifest, index, entities } = loadCustomSamplePackage();
    const registry = ContentRegistry({ validator: createSchemaContentValidator() });
    const capabilities = createSourceCapabilities({ namespace: 'custom-sample' });
    assert.equal('officialHandlers' in capabilities, false);
    registry.registerSource(createMemoryContentSource({ manifest, index, entities }), capabilities);
    assert.equal((await registry.initialize()).ok, true);
    // A feature declara um `official-handler`, mas o ContentRegistry não tem
    // nenhum método capaz de invocá-lo: a porta de invocação é separada.
    const feature = registry.get('custom-sample:feature:ataque-extra');
    assert.equal(feature.effects[0].type, 'official-handler');
    assert.equal(Object.keys(registry).includes('invoke'), false);
  });

  test('o mesmo pacote com status "building" nunca é ativado', async () => {
    const { manifest, index, entities } = loadCustomSamplePackage();
    const registry = ContentRegistry({ validator: createSchemaContentValidator() });
    const source = createMemoryContentSource({ manifest: { ...manifest, status: 'building' }, index, entities });
    registry.registerSource(source, createSourceCapabilities({ namespace: 'custom-sample' }));
    const result = await registry.initialize();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_PACKAGE_NOT_READY');
    for (const type of ALL_ENTITY_TYPES) {
      assert.deepEqual(registry.list(type), []);
    }
  });
});
