// Módulo `infra/character/migration-runner`: detecta a versão de um
// registro de personagem persistido e orquestra a transição para o modelo
// canônico v2 — v1 legado via `migrations/v1-to-v2.js`, v2 atual mantido
// como está, schema futuro devolvido somente leitura. Também aplica, por
// escopo de namespace e de forma atômica, a migração de VERSÃO DE PACOTE
// (não de schema de personagem) usando a cadeia resolvida por
// `content/reference-migrations.js` (Task 6) — só quando o chamador informa
// `context.contentManifests`; sem isso, nenhum escopo é considerado
// desatualizado (Task 12 não conecta a um ContentRegistry vivo — ver
// concern no relatório).

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { findReferenceMigrationPath, migrateContentReference } from '../../content/reference-migrations.js';
import { parseContentId } from '../../core/content-id.js';
import { CHARACTER_SCHEMA_VERSION, visitCharacterContentReferences } from '../../domain/character/model.js';
import { validateCanonicalCharacter } from '../../domain/character/validation.js';
import { migrateV1ToV2 } from './migrations/v1-to-v2.js';

const SCOPE = 'infra.character.migration-runner';

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Detecta a versão de um registro de personagem bruto (persistido), sem
 * normalizar nada. Registros sem `_schema` reconhecível são tratados como
 * v1 legado (o app monolítico nunca escreveu esse campo).
 * @param {*} rawRecord
 * @returns {import('../../core/result.js').Result} Result<{kind: 'legacy'|'current'|'future', version: number}, AppError>
 */
export function detectCharacterRecordVersion(rawRecord) {
  if (!isPlainObject(rawRecord)) {
    return err(
      createAppError({
        code: 'CHARACTER_RECORD_INVALID',
        scope: SCOPE,
        message: 'O registro de personagem deve ser um objeto.',
        context: { receivedType: typeof rawRecord },
      }),
    );
  }

  const schemaMarker = rawRecord._schema;
  if (schemaMarker === undefined) {
    return ok(Object.freeze({ kind: 'legacy', version: 1 }));
  }
  if (!isPlainObject(schemaMarker) || typeof schemaMarker.version !== 'number') {
    return err(
      createAppError({
        code: 'CHARACTER_RECORD_SCHEMA_MARKER_INVALID',
        scope: SCOPE,
        message: '"_schema" está presente mas não é {version: number}.',
        context: { schemaMarker },
      }),
    );
  }

  const version = schemaMarker.version;
  if (version === CHARACTER_SCHEMA_VERSION) {
    return ok(Object.freeze({ kind: 'current', version }));
  }
  if (version > CHARACTER_SCHEMA_VERSION) {
    return ok(Object.freeze({ kind: 'future', version }));
  }
  return err(
    createAppError({
      code: 'CHARACTER_RECORD_SCHEMA_VERSION_UNSUPPORTED',
      scope: SCOPE,
      message: `_schema.version ${version} é menor que a versão atual (${CHARACTER_SCHEMA_VERSION}) e não é um formato v1 reconhecido (sem "_schema").`,
      context: { version, current: CHARACTER_SCHEMA_VERSION },
    }),
  );
}

/**
 * Aplica, para um único namespace, a cadeia de migração de versão de
 * pacote a toda ocorrência de referência de conteúdo devolvida por
 * `visitCharacterContentReferences`, reconstruindo um personagem novo só
 * se TODAS as ocorrências migrarem com sucesso e sem colisão — atômico por
 * construção (nunca muta o personagem recebido).
 * @param {object} character
 * @param {string} namespace
 * @param {ReadonlyArray<object>} migrationPath
 * @returns {import('../../core/result.js').Result} Result<object, AppError>
 */
function migrateNamespaceReferences(character, namespace, migrationPath) {
  const references = visitCharacterContentReferences(character).filter(
    (reference) => parseContentId(reference.id).ok && parseContentId(reference.id).value.namespace === namespace,
  );

  const migratedByPointer = new Map();
  for (const reference of references) {
    const migrated = migrateContentReference(reference.id, [], migrationPath);
    if (!migrated.ok) {
      return migrated;
    }
    migratedByPointer.set(reference.pointer, migrated.value.id);
  }

  // Deep clone simples (o personagem é JSON-safe por construção/validação).
  const next = JSON.parse(JSON.stringify(character));

  // Referências diretas (ContentRef / ContentId nu em campos fixos). Só
  // escreve quando o pointer de fato foi migrado (está em
  // `migratedByPointer`) — uma referência de OUTRO namespace (ex.:
  // `speciesRef` de um pacote B enquanto migramos o namespace A) nunca
  // entra em `references`/`migratedByPointer`, e sobrescrevê-la mesmo
  // assim substituiria seu `id` por `undefined`, corrompendo um escopo que
  // não deveria ter sido tocado (achado do reviewer independente).
  const setIfPresent = (obj, key, pointer) => {
    if (obj === null || obj === undefined || !migratedByPointer.has(pointer)) {
      return;
    }
    if (obj[key] && typeof obj[key] === 'object' && typeof obj[key].id === 'string') {
      obj[key] = { id: migratedByPointer.get(pointer), packageVersion: migrationPath[migrationPath.length - 1].to };
    }
  };
  setIfPresent(next.build, 'rulesetRef', 'build.rulesetRef');
  setIfPresent(next.build, 'classRef', 'build.classRef');
  setIfPresent(next.build, 'subclassRef', 'build.subclassRef');
  setIfPresent(next.build, 'speciesRef', 'build.speciesRef');
  setIfPresent(next.build, 'backgroundRef', 'build.backgroundRef');

  for (const listField of ['featRefs', 'weaponMasteryRefs', 'maneuverRefs']) {
    next.build[listField] = (next.build[listField] ?? []).map((refItem, index) => {
      const newId = migratedByPointer.get(`build.${listField}[${index}]`);
      return newId ? { id: newId, packageVersion: migrationPath[migrationPath.length - 1].to } : refItem;
    });
  }

  for (const grantField of Object.keys(next.build.legacyGrants ?? {})) {
    next.build.legacyGrants[grantField] = (next.build.legacyGrants[grantField] ?? []).map((value, index) => {
      const pointer = `build.legacyGrants.${grantField}[${index}]`;
      return migratedByPointer.has(pointer) ? migratedByPointer.get(pointer) : value;
    });
  }

  // Choices: chaves e valores migrados; colisão de chave pós-migração é
  // recusada (nunca sobrescreve uma escolha do jogador).
  const newChoices = {};
  for (const [key, values] of Object.entries(next.build.choices ?? {})) {
    const newKey = migratedByPointer.has(`build.choices{${key}}`) ? migratedByPointer.get(`build.choices{${key}}`) : key;
    if (Object.hasOwn(newChoices, newKey)) {
      return err(
        createAppError({
          code: 'CHARACTER_CONTENT_REFERENCE_MIGRATION_COLLISION',
          scope: SCOPE,
          message: `A migração de versão do namespace "${namespace}" faria duas chaves de build.choices colidirem em "${newKey}".`,
          context: { namespace, newKey },
        }),
      );
    }
    newChoices[newKey] = values.map((value, index) => {
      const pointer = `build.choices{${key}}[${index}]`;
      return migratedByPointer.has(pointer) ? migratedByPointer.get(pointer) : value;
    });
  }
  next.build.choices = newChoices;

  // Resources: mesma checagem de colisão de chave.
  const newResources = {};
  for (const [key, value] of Object.entries(next.state.resources ?? {})) {
    const newKey = migratedByPointer.has(`state.resources{${key}}`) ? migratedByPointer.get(`state.resources{${key}}`) : key;
    if (Object.hasOwn(newResources, newKey)) {
      return err(
        createAppError({
          code: 'CHARACTER_CONTENT_REFERENCE_MIGRATION_COLLISION',
          scope: SCOPE,
          message: `A migração de versão do namespace "${namespace}" faria duas chaves de state.resources colidirem em "${newKey}".`,
          context: { namespace, newKey },
        }),
      );
    }
    newResources[newKey] = value;
  }
  next.state.resources = newResources;

  for (const spellField of ['known', 'prepared', 'spellbook']) {
    next.state.spells[spellField] = (next.state.spells[spellField] ?? []).map((entry, index) => {
      const pointer = `state.spells.${spellField}[${index}].spellRef`;
      if (migratedByPointer.has(pointer) && entry.spellRef) {
        return { ...entry, spellRef: { id: migratedByPointer.get(pointer), packageVersion: migrationPath[migrationPath.length - 1].to } };
      }
      return entry;
    });
  }

  next.state.inventory = (next.state.inventory ?? []).map((entry, index) => {
    const pointer = `state.inventory[${index}].itemRef`;
    if (migratedByPointer.has(pointer) && entry.itemRef) {
      return { ...entry, itemRef: { id: migratedByPointer.get(pointer), packageVersion: migrationPath[migrationPath.length - 1].to } };
    }
    return entry;
  });

  next.state.conditions = (next.state.conditions ?? []).map((value, index) => {
    const pointer = `state.conditions[${index}]`;
    return migratedByPointer.has(pointer) ? migratedByPointer.get(pointer) : value;
  });

  next.build.contentScopes[namespace] = { packageVersion: migrationPath[migrationPath.length - 1].to };

  return ok(next);
}

/**
 * Aplica migração de versão de pacote a todo namespace de
 * `character.build.contentScopes` cuja versão diverge da versão-alvo
 * declarada em `contentManifests[namespace]`. Cada namespace é migrado de
 * forma atômica e independente; qualquer falha interrompe e devolve erro
 * (o personagem original nunca é retornado parcialmente migrado). Exportado
 * (além de usado internamente por `migrateCharacterRecord`) para permitir
 * teste focal direto da lógica de migração por escopo — ver
 * tests/unit/character/migration-runner-content-versions.test.js.
 * @param {object} character
 * @param {Record<string, {manifest: object, targetVersion: string}>} contentManifests
 * @returns {import('../../core/result.js').Result} Result<object, AppError>
 */
export function migrateContentVersions(character, contentManifests) {
  if (!contentManifests) {
    return ok(character);
  }

  let current = character;
  for (const [namespace, scope] of Object.entries(current.build.contentScopes ?? {})) {
    const entry = contentManifests[namespace];
    if (!entry) {
      continue;
    }
    const targetVersion = entry.targetVersion ?? entry.manifest?.version;
    if (targetVersion === scope.packageVersion) {
      continue;
    }
    const pathResult = findReferenceMigrationPath(entry.manifest, scope.packageVersion, targetVersion);
    if (!pathResult.ok) {
      return pathResult;
    }
    if (pathResult.value.length === 0) {
      continue;
    }
    const migrated = migrateNamespaceReferences(current, namespace, pathResult.value);
    if (!migrated.ok) {
      return migrated;
    }
    const revalidation = validateCanonicalCharacter(migrated.value);
    if (!revalidation.valid) {
      return err(
        createAppError({
          code: 'CHARACTER_CONTENT_VERSION_MIGRATION_INVALID_RESULT',
          scope: SCOPE,
          message: `A migração de versão do namespace "${namespace}" produziu um personagem inválido.`,
          context: { namespace, errors: revalidation.errors.map((e) => ({ code: e.code, message: e.message })) },
        }),
      );
    }
    current = migrated.value;
  }
  return ok(current);
}

/**
 * Migra um registro de personagem bruto para o modelo canônico v2 atual,
 * detectando a versão e delegando para o migrador v1->v2 quando
 * necessário. Schema futuro nunca é normalizado/salvo/reduzido de versão —
 * devolve `{mode: 'read-only', rawRecord, detectedVersion}`.
 * @param {*} rawRecord
 * @param {{aliasResolver: object, now: string, contentManifests?: object}} context
 * @returns {import('../../core/result.js').Result} Result<CharacterMigrationResult, AppError>
 */
export function migrateCharacterRecord(rawRecord, context = {}) {
  const detection = detectCharacterRecordVersion(rawRecord);
  if (!detection.ok) {
    return detection;
  }

  if (detection.value.kind === 'future') {
    return ok(
      Object.freeze({ mode: 'read-only', rawRecord, detectedVersion: detection.value.version }),
    );
  }

  if (detection.value.kind === 'legacy') {
    const migrated = migrateV1ToV2(rawRecord, { aliasResolver: context.aliasResolver, now: context.now });
    if (!migrated.ok) {
      return migrated;
    }
    const versionMigrated = migrateContentVersions(migrated.value.character, context.contentManifests);
    if (!versionMigrated.ok) {
      return ok(
        Object.freeze({
          mode: 'read-only',
          rawRecord,
          detectedVersion: 1,
          contentVersionError: { code: versionMigrated.error.code, message: versionMigrated.error.message },
        }),
      );
    }
    return ok(
      Object.freeze({
        mode: 'migrated',
        character: versionMigrated.value,
        warnings: Object.freeze(migrated.value.warnings),
      }),
    );
  }

  // kind === 'current': o registro já está no schema atual; o chamador
  // (character-codec.js) é responsável por decodificar o registro plano
  // v2 para o modelo canônico. Aqui só sinalizamos que nenhuma transição de
  // *schema* é necessária.
  return ok(Object.freeze({ mode: 'up-to-date', rawRecord, detectedVersion: 2 }));
}
