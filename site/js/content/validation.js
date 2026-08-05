// Módulo `content/validation`: API pública de validação de conteúdo. Cada
// função aceita um valor não confiável (mesmo quando vindo do pacote oficial
// — ver docs/superpowers/plans, "conteúdo vindo de JSON deve ser tratado
// como não confiável") e devolve exatamente um `ValidationResult`
// (`{valid, errors, warnings}`, ver site/js/core/validation.js). Nenhuma
// função aqui lança para entrada inválida — isso é sempre reportado como
// erro no ValidationResult, nunca como exceção.
//
// `validateEntity` despacha para o schema concreto do tipo de entidade
// (ability, spell, ...) a partir de `value.type`; os demais validadores
// (manifest, index, effect, os dois formatos de personagem v2) mapeiam
// diretamente para um schema fixo. `validateReferences` é a única função
// desta lista que não corresponde a um único schema JSON: ela expressa
// invariantes semânticos entre manifest/index/entities que JSON Schema puro
// não consegue expressar (ex.: o mesmo `id` aparecendo duas vezes em
// `index.entries` com `path`/`pointer` diferentes).

import { parseContentId } from '../core/content-id.js';
import { createAppError } from '../core/errors.js';
import { createValidationResult, mergeValidationResults } from '../core/validation.js';
import { runGeneratedValidator } from './schemas/runtime-validators.js';

// Mesmo enum fechado de common.schema.json#/$defs/entityType, mapeado para
// a chave de export correspondente em generated-validators.js (gerada por
// scripts/generate-schema-validators.mjs a partir de EXPORT_MAP — mantido
// em sincronia manualmente porque um lado é JSON de schema e o outro é o
// dicionário de despacho em runtime; ambos são cobertos por
// tests/unit/content/runtime-validation.test.js).
const ENTITY_TYPE_TO_SCHEMA_NAME = Object.freeze({
  ruleset: 'ruleset',
  ability: 'ability',
  skill: 'skill',
  condition: 'condition',
  'damage-type': 'damageType',
  language: 'language',
  class: 'characterClass',
  subclass: 'subclass',
  feature: 'feature',
  species: 'species',
  background: 'background',
  feat: 'feat',
  spell: 'spell',
  'spell-list': 'spellList',
  weapon: 'weapon',
  armor: 'armor',
  equipment: 'equipment',
  creature: 'creature',
  'glossary-entry': 'glossaryEntry',
  'migration-map': 'migrationMap',
});

/**
 * Valida que `value` é um ContentId qualificado bem formado, usando o
 * parser canônico de site/js/core/content-id.js (fonte única da verdade
 * para o formato "namespace:type:slug" — os schemas JSON só espelham o
 * mesmo padrão em regex para poder rodar no Ajv).
 * @param {*} value
 * @param {string} fieldPath - caminho legível do campo, para a mensagem de erro.
 * @param {string} scope
 * @returns {import('../core/validation.js').ValidationResult}
 */
function validateContentIdField(value, fieldPath, scope) {
  const parsed = parseContentId(value);
  if (parsed.ok) {
    return createValidationResult();
  }
  return createValidationResult({
    errors: [
      createAppError({
        code: 'CONTENT_ID_FIELD_INVALID',
        scope,
        message: `Campo "${fieldPath}" não é um ContentId válido: ${parsed.error.message}`,
        context: { fieldPath, value },
      }),
    ],
  });
}

/**
 * Confere que o segmento `type` de um ContentId já validado como bem
 * formado corresponde a `expectedType` (ex.: o `id` de uma entidade
 * `type:"ability"` deve ser algo como "ns:ability:slug", nunca
 * "ns:spell:slug"). Só reporta esse erro quando o ContentId já é
 * sintaticamente válido — quando não é, `validateContentIdField` já cobre o
 * problema, e duplicar o erro aqui só adicionaria ruído.
 * @param {string} id
 * @param {string} expectedType
 * @param {string} fieldPath
 * @param {string} scope
 * @returns {import('../core/validation.js').ValidationResult}
 */
function validateContentIdTypeSegment(id, expectedType, fieldPath, scope) {
  const parsed = parseContentId(id);
  if (!parsed.ok || parsed.value.type === expectedType) {
    return createValidationResult();
  }
  return createValidationResult({
    errors: [
      createAppError({
        code: 'CONTENT_ID_TYPE_SEGMENT_MISMATCH',
        scope,
        message: `Campo "${fieldPath}": o segmento de tipo do ContentId ("${parsed.value.type}") não corresponde ao tipo esperado ("${expectedType}").`,
        context: { fieldPath, id, idType: parsed.value.type, expectedType },
      }),
    ],
  });
}

/**
 * Valida um manifesto de pacote de conteúdo.
 * @param {*} value
 * @returns {import('../core/validation.js').ValidationResult}
 */
export function validateManifest(value) {
  const schemaResult = runGeneratedValidator('manifest', value);
  if (value == null || typeof value !== 'object' || typeof value.ruleset === 'undefined') {
    return schemaResult;
  }
  const idResult = validateContentIdField(value.ruleset, 'manifest.ruleset', 'content.validation.manifest');
  return mergeValidationResults([schemaResult, idResult]);
}

/**
 * Valida um índice de pacote de conteúdo (`{schemaVersion, entries}`).
 * @param {*} value
 * @returns {import('../core/validation.js').ValidationResult}
 */
export function validateIndex(value) {
  const schemaResult = runGeneratedValidator('index', value);
  if (value == null || typeof value !== 'object' || !Array.isArray(value.entries)) {
    return schemaResult;
  }
  const idResults = [];
  const typeMatchResults = [];
  value.entries.forEach((entry, i) => {
    if (!entry || typeof entry.id === 'undefined') {
      return;
    }
    const fieldPath = `index.entries[${i}].id`;
    idResults.push(validateContentIdField(entry.id, fieldPath, 'content.validation.index'));
    // O segmento de tipo do id (ex.: "ns:ability:slug") deve corresponder ao
    // campo `type` da própria entrada — uma entrada `{id:"ns:spell:x",
    // type:"ability", ...}` é uma inconsistência que uniqueItems/pattern não
    // pegam sozinhos.
    if (typeof entry.type === 'string') {
      typeMatchResults.push(validateContentIdTypeSegment(entry.id, entry.type, fieldPath, 'content.validation.index'));
    }
  });
  return mergeValidationResults([schemaResult, ...idResults, ...typeMatchResults]);
}

/**
 * Valida uma entidade de conteúdo, despachando para o schema concreto do
 * tipo declarado em `value.type`. Um `type` fora do enum fechado é reportado
 * como erro (nunca lança).
 * @param {*} value
 * @returns {import('../core/validation.js').ValidationResult}
 */
export function validateEntity(value) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return createValidationResult({
      errors: [
        createAppError({
          code: 'ENTITY_NOT_OBJECT',
          scope: 'content.validation.entity',
          message: 'Entidade deve ser um objeto.',
          context: { receivedType: typeof value },
        }),
      ],
    });
  }

  const schemaName = ENTITY_TYPE_TO_SCHEMA_NAME[value.type];
  if (!schemaName) {
    return createValidationResult({
      errors: [
        createAppError({
          code: 'ENTITY_UNKNOWN_TYPE',
          scope: 'content.validation.entity',
          message: `Tipo de entidade desconhecido: ${JSON.stringify(value.type)}.`,
          context: { type: value.type, allowedTypes: Object.keys(ENTITY_TYPE_TO_SCHEMA_NAME) },
        }),
      ],
    });
  }

  const schemaResult = runGeneratedValidator(schemaName, value);
  if (typeof value.id === 'undefined') {
    return schemaResult;
  }
  const idResult = validateContentIdField(value.id, 'entity.id', 'content.validation.entity');
  // O segmento de tipo do próprio id (ex.: "ns:ability:slug") deve
  // corresponder ao campo `type` da entidade — uma entidade com
  // `id:"ns:spell:foo"` mas `type:"ability"` validaria contra o schema de
  // "ability" (que não sabe nada sobre o id) sem essa checagem cruzada.
  const typeMatchResult = validateContentIdTypeSegment(value.id, value.type, 'entity.id', 'content.validation.entity');
  return mergeValidationResults([schemaResult, idResult, typeMatchResult]);
}

/**
 * Valida um efeito isolado (vocabulário fechado de effect.schema.json).
 * @param {*} value
 * @returns {import('../core/validation.js').ValidationResult}
 */
export function validateEffect(value) {
  return runGeneratedValidator('effect', value);
}

/**
 * Valida o modelo interno canônico (aninhado) de um personagem v2.
 * @param {*} value
 * @returns {import('../core/validation.js').ValidationResult}
 */
export function validateCanonicalCharacterV2(value) {
  return runGeneratedValidator('characterCanonicalV2', value);
}

/**
 * Valida o registro plano persistido (localStorage/Firestore) de um
 * personagem v2.
 * @param {*} value
 * @returns {import('../core/validation.js').ValidationResult}
 */
export function validatePersistedCharacterRecordV2(value) {
  return runGeneratedValidator('characterRecordV2', value);
}

/**
 * Constrói uma chave composta `type::id` para comparar entradas de índice
 * com entidades carregadas sem ambiguidade (ContentIds nunca contêm "::",
 * já que cada segmento é `[a-z0-9]+(-[a-z0-9]+)*`).
 * @param {string} type
 * @param {string} id
 * @returns {string}
 */
function entityKey(type, id) {
  return `${type}::${id}`;
}

/**
 * Valida invariantes semânticos entre manifest, index e as entidades
 * carregadas que JSON Schema puro não consegue expressar:
 *
 * 1. Nenhum `id` aparece duas vezes em `index.entries`, mesmo quando
 *    `path`/`pointer` diferem (uniqueItems do schema só rejeita entradas
 *    integralmente idênticas).
 * 2. Todo `type` usado em `index.entries` está declarado em
 *    `manifest.entities`.
 * 3. Toda entidade em `entities` tem uma entrada correspondente em
 *    `index.entries` (mesmo `id` e `type`) e vice-versa.
 *
 * @param {{manifest: *, index: *, entities: ReadonlyArray<*>}} params
 * @returns {import('../core/validation.js').ValidationResult}
 */
export function validateReferences({ manifest, index, entities } = {}) {
  const errors = [];

  if (manifest == null || typeof manifest !== 'object') {
    errors.push(
      createAppError({
        code: 'REFERENCES_MANIFEST_INVALID',
        scope: 'content.validation.references',
        message: 'manifest ausente ou não é um objeto.',
        context: { receivedType: typeof manifest },
      }),
    );
  }
  if (index == null || typeof index !== 'object' || !Array.isArray(index.entries)) {
    errors.push(
      createAppError({
        code: 'REFERENCES_INDEX_ENTRIES_INVALID',
        scope: 'content.validation.references',
        message: 'index.entries ausente ou não é um array.',
        context: { receivedType: typeof index },
      }),
    );
  }
  if (!Array.isArray(entities)) {
    errors.push(
      createAppError({
        code: 'REFERENCES_ENTITIES_NOT_ARRAY',
        scope: 'content.validation.references',
        message: 'entities deve ser um array de entidades já carregadas.',
        context: { receivedType: typeof entities },
      }),
    );
  }
  if (errors.length > 0) {
    return createValidationResult({ errors });
  }

  const entries = index.entries;

  // 1. Duplicidade semântica de id em index.entries.
  const firstEntryIndexById = new Map();
  entries.forEach((entry, i) => {
    if (!entry || typeof entry.id !== 'string') {
      return;
    }
    if (firstEntryIndexById.has(entry.id)) {
      const firstIndex = firstEntryIndexById.get(entry.id);
      errors.push(
        createAppError({
          code: 'REFERENCES_DUPLICATE_ENTRY_ID',
          scope: 'content.validation.references',
          message: `O id "${entry.id}" aparece mais de uma vez em index.entries (posições ${firstIndex} e ${i}).`,
          context: { id: entry.id, firstIndex, duplicateIndex: i },
        }),
      );
    } else {
      firstEntryIndexById.set(entry.id, i);
    }
  });

  // 2. Todo type usado em index.entries está declarado em manifest.entities.
  const declaredTypes = new Set(Array.isArray(manifest.entities) ? manifest.entities : []);
  entries.forEach((entry, i) => {
    if (!entry || typeof entry.type !== 'string') {
      return;
    }
    if (!declaredTypes.has(entry.type)) {
      errors.push(
        createAppError({
          code: 'REFERENCES_UNDECLARED_ENTITY_TYPE',
          scope: 'content.validation.references',
          message: `A entrada de índice na posição ${i} (id "${entry.id}") tem type "${entry.type}", não declarado em manifest.entities.`,
          context: { index: i, id: entry.id, type: entry.type },
        }),
      );
    }
  });

  // 3. Correspondência entities[] <-> index.entries.
  const indexedKeys = new Set(
    entries
      .filter((entry) => entry && typeof entry.id === 'string' && typeof entry.type === 'string')
      .map((entry) => entityKey(entry.type, entry.id)),
  );
  const loadedKeys = new Set();
  entities.forEach((entity, i) => {
    if (!entity || typeof entity.id !== 'string' || typeof entity.type !== 'string') {
      errors.push(
        createAppError({
          code: 'REFERENCES_ENTITY_MISSING_ID_OR_TYPE',
          scope: 'content.validation.references',
          message: `A entidade na posição ${i} de entities não tem "id"/"type" válidos.`,
          context: { index: i },
        }),
      );
      return;
    }
    const key = entityKey(entity.type, entity.id);
    loadedKeys.add(key);
    if (!indexedKeys.has(key)) {
      errors.push(
        createAppError({
          code: 'REFERENCES_ENTITY_NOT_INDEXED',
          scope: 'content.validation.references',
          message: `A entidade "${entity.id}" (${entity.type}) não tem entrada correspondente em index.entries.`,
          context: { id: entity.id, type: entity.type },
        }),
      );
    }
  });
  indexedKeys.forEach((key) => {
    if (!loadedKeys.has(key)) {
      const separatorIndex = key.indexOf('::');
      const type = key.slice(0, separatorIndex);
      const id = key.slice(separatorIndex + 2);
      errors.push(
        createAppError({
          code: 'REFERENCES_INDEX_ENTRY_MISSING_ENTITY',
          scope: 'content.validation.references',
          message: `A entrada de índice "${id}" (${type}) não tem entidade carregada correspondente em entities.`,
          context: { id, type },
        }),
      );
    }
  });

  return createValidationResult({ errors });
}
