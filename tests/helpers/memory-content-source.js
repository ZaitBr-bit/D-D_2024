// Helper de testes: uma `ContentSource` em memória que implementa exatamente
// o contrato `{ loadManifest, loadIndex, loadEntity }` com
// `Promise<Result<T, AppError>>` nos três métodos, além de um adaptador de
// validação construído sobre os validadores reais da Task 5.
//
// A fonte em memória não tem nenhum privilégio: ela é apenas dados. Toda
// capacidade (namespace concedido e o token opaco `officialHandlers`) vem do
// composition root via `registerSource(source, capabilities)`, nunca do que
// o manifesto/entidades afirmam sobre si mesmos.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ok, err } from '../../site/js/core/result.js';
import { createAppError } from '../../site/js/core/errors.js';
import {
  validateManifest,
  validateIndex,
  validateEntity,
  validateReferences,
} from '../../site/js/content/validation.js';

/**
 * Carrega e faz o parse do pacote de amostra customizado usado pelos testes
 * de contrato. Devolve sempre uma cópia nova (JSON.parse a cada chamada),
 * para que um teste que congele/mute o resultado não contamine outro.
 * @returns {{manifest: object, index: object, entities: Array<object>}}
 */
export function loadCustomSamplePackage() {
  const fixturePath = fileURLToPath(new URL('../fixtures/content/custom-sample-package.json', import.meta.url));
  const parsed = JSON.parse(readFileSync(fixturePath, 'utf8'));
  return { manifest: parsed.manifest, index: parsed.index, entities: parsed.entities };
}

/**
 * Monta um `index` mínimo (`{schemaVersion, entries}`) a partir de uma lista
 * de entidades, derivando `path` do id. Útil para os testes que só se
 * importam com o comportamento do registry, não com o layout de arquivos.
 * @param {ReadonlyArray<object>} entities
 * @param {string} [schemaVersion]
 * @returns {{schemaVersion: string, entries: Array<object>}}
 */
export function buildIndexFromEntities(entities, schemaVersion = '1.0.0') {
  return {
    schemaVersion,
    entries: entities.map((entity) => ({
      id: entity.id,
      type: entity.type,
      path: `${String(entity.id).split(':').join('/')}.json`,
    })),
  };
}

/**
 * Cria uma `ContentSource` em memória.
 *
 * `failures` permite simular falhas de carregamento e violações de contrato:
 *   - `failures.manifest` / `failures.index`: AppError devolvido em `err(...)`.
 *   - `failures.entities[id]`: AppError devolvido ao carregar aquele id.
 *   - `failures.nonResult`: `'manifest' | 'index' | 'entity'` faz o método
 *     devolver um valor cru (não-Result), simulando uma fonte malcomportada.
 *
 * @param {{manifest: *, index: *, entities?: ReadonlyArray<object>, failures?: object}} params
 * @returns {{loadManifest: Function, loadIndex: Function, loadEntity: Function}}
 */
export function createMemoryContentSource({ manifest, index, entities = [], failures = {} }) {
  const entitiesById = new Map(entities.map((entity) => [entity && entity.id, entity]));

  /** Carrega o manifesto do pacote. */
  async function loadManifest() {
    if (failures.nonResult === 'manifest') {
      return manifest;
    }
    if (failures.manifest) {
      return err(failures.manifest);
    }
    return ok(manifest);
  }

  /** Carrega o índice do pacote. */
  async function loadIndex() {
    if (failures.nonResult === 'index') {
      return index;
    }
    if (failures.index) {
      return err(failures.index);
    }
    return ok(index);
  }

  /**
   * Carrega uma entidade pelo ContentId declarado no índice.
   * @param {string} id
   */
  async function loadEntity(id) {
    if (failures.nonResult === 'entity') {
      return entitiesById.get(id) ?? null;
    }
    if (failures.entities && failures.entities[id]) {
      return err(failures.entities[id]);
    }
    if (!entitiesById.has(id)) {
      return err(
        createAppError({
          code: 'MEMORY_SOURCE_ENTITY_NOT_FOUND',
          scope: 'tests.memory-content-source',
          message: `A fonte em memória não tem a entidade "${id}".`,
          context: { id },
        }),
      );
    }
    return ok(entitiesById.get(id));
  }

  // O objeto devolvido oferece exatamente os três métodos do contrato.
  return Object.freeze({ loadManifest, loadIndex, loadEntity });
}

/**
 * Adaptador que expõe os validadores reais da Task 5
 * (`site/js/content/validation.js`) no formato de porta esperado pelo
 * `ContentRegistry`: `{ validateManifest, validateIndex, validateEntity,
 * validateReferences }`.
 *
 * O manifesto é delegado sem os campos de runtime `status` e
 * `referenceMigrations`: `dados/schemas/v1/manifest.schema.json` (Task 5)
 * ainda não declara esses campos e usa `additionalProperties: false`, mas o
 * registry desta tarefa exige `status === "ready"` e a Task 7 já especifica
 * `status`/`referenceMigrations` no manifesto oficial. A Task 7 deve
 * acrescentá-los ao schema; até lá, este adaptador isola a lacuna nos testes
 * em vez de enfraquecer o schema ou o registry.
 * @returns {{validateManifest: Function, validateIndex: Function, validateEntity: Function, validateReferences: Function}}
 */
export function createSchemaContentValidator() {
  return Object.freeze({
    validateManifest(value) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return validateManifest(value);
      }
      const { status, referenceMigrations, ...schemaFields } = value;
      void status;
      void referenceMigrations;
      return validateManifest(schemaFields);
    },
    validateIndex,
    validateEntity,
    validateReferences,
  });
}

/**
 * Validador permissivo para os testes que não estão exercitando os schemas
 * (ex.: testes de handshake de capacidade). Sempre aprova.
 * @returns {{validateManifest: Function, validateIndex: Function, validateEntity: Function, validateReferences: Function}}
 */
export function createPermissiveContentValidator() {
  const valid = Object.freeze({ valid: true, errors: Object.freeze([]), warnings: Object.freeze([]) });
  return Object.freeze({
    validateManifest: () => valid,
    validateIndex: () => valid,
    validateEntity: () => valid,
    validateReferences: () => valid,
  });
}
