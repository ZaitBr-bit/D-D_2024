#!/usr/bin/env node
// `npm run validate:data`: valida, com Ajv 2020-12, todos os schemas de
// `dados/schemas/v1/*.schema.json` e, se existirem, todos os pacotes de
// conteúdo em `dados/pacotes/*/` (cada um com `manifest.json` +
// `index.json` + os arquivos de entidade referenciados pelo índice).
//
// Nesta tarefa ainda não existe nenhum pacote oficial em `dados/pacotes/`
// (isso é conteúdo de tarefas futuras) — o script não falha por causa
// disso: ele sempre valida (a) que todos os schemas compilam no Ajv, e (b)
// que as fixtures de teste em `tests/fixtures/content/invalid-entities.json`
// são de fato rejeitadas pelos validadores gerados, como uma checagem de
// fumaça de ponta a ponta do pipeline schemas -> gerador -> validate.mjs.
// Se `dados/pacotes/` existir no futuro, cada pacote encontrado também é
// validado.
//
// Para cada pacote: `manifest.json`/`index.json` são validados contra seus
// schemas, cada entidade referenciada por `index.entries` é carregada do
// `path` (+ `pointer` opcional, para arquivos-coleção) e validada com
// `validateEntity`, e só então — com o array de entries preservado, nunca
// convertido para mapa por id antes dessa checagem (para não mascarar
// duplicatas semânticas) — `validateReferences` roda sobre
// `{ manifest, index, entities }`. Sai com código diferente de zero se
// qualquer validação falhar.
//
// Task 7 acrescenta um segundo nível de checagem, ramificado por
// `manifest.status`, para cada pacote encontrado sob `dados/pacotes/*/`
// (detecção automática — nenhuma allowlist de nomes de pacote):
//
//   - `status: "building"` (pacote em staging, ex.: `dnd2024` nesta tarefa):
//     só valida entries/tipos ATIVOS (já garantido por `index.entries` só
//     conter os tipos de `manifest.entities` — ver
//     `scripts/content/build-index.mjs`); compara as contagens ativas por
//     tipo com `tests/fixtures/content/<pacote>-inventory.json` (`active`),
//     quando esse fixture existir; e confirma, chamando o `ContentRegistry`
//     REAL (não um dublê), que o pacote nunca é ativado em runtime —
//     `status !== "ready"` deve sempre produzir `CONTENT_PACKAGE_NOT_READY`.
//   - `status: "ready"`: exige que a MESMA fixture de inventário (quando
//     presente) tenha `finalTarget` inteiramente cumprido pelas contagens
//     reais (campos `null` em `finalTarget` são pulados: contagem ainda não
//     auditável), que todo arquivo `.json` canônico do pacote (exceto
//     `manifest.json`/`index.json`) apareça em `index.entries[].path`
//     (nenhum arquivo órfão fora do índice) e, por reaproveitar
//     `validateReferences`, zero referência quebrada entre `index`/`entities`.

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import {
  validateManifest,
  validateIndex,
  validateEntity,
  validateEffect,
  validateReferences,
} from '../site/js/content/validation.js';
import { runGeneratedValidator } from '../site/js/content/schemas/runtime-validators.js';
import { mergeValidationResults, createValidationResult } from '../site/js/core/validation.js';
import { createAppError, serializeAppError } from '../site/js/core/errors.js';
import { ContentRegistry } from '../site/js/content/registry.js';
import { createSourceCapabilities, createOfficialSourceCapabilities } from '../site/js/content/capabilities.js';
import { ok } from '../site/js/core/result.js';
import { listJsonFilesRecursively } from './content/build-index.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const schemasDir = path.join(repoRoot, 'dados', 'schemas', 'v1');
const packagesDir = path.join(repoRoot, 'dados', 'pacotes');
const invalidFixturesPath = path.join(repoRoot, 'tests', 'fixtures', 'content', 'invalid-entities.json');
const fixturesContentDir = path.join(repoRoot, 'tests', 'fixtures', 'content');

/**
 * @param {string} dirPath
 * @returns {Promise<boolean>}
 */
async function directoryExists(dirPath) {
  try {
    const stats = await stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Carrega todos os schemas v1 e confirma que cada um compila no Ajv 2020-12
 * sem lançar (checagem de sanidade do próprio schema, independente de
 * qualquer conteúdo).
 * @returns {Promise<import('../site/js/core/validation.js').ValidationResult>}
 */
async function checkSchemasCompile() {
  const fileNames = (await readdir(schemasDir)).filter((name) => name.endsWith('.schema.json')).sort();
  const ajv = new Ajv2020({ strict: true, allowUnionTypes: true });
  addFormats(ajv);

  const schemas = [];
  for (const fileName of fileNames) {
    const raw = await readFile(path.join(schemasDir, fileName), 'utf8');
    const schema = JSON.parse(raw);
    schemas.push({ fileName, schema });
    ajv.addSchema(schema, schema.$id);
  }

  const errors = [];
  for (const { fileName, schema } of schemas) {
    try {
      ajv.getSchema(schema.$id);
    } catch (error) {
      errors.push(
        createAppError({
          code: 'SCHEMA_COMPILE_FAILED',
          scope: 'scripts.validate-content',
          message: `Falha ao compilar ${fileName}: ${error.message}`,
          context: { fileName },
        }),
      );
    }
  }

  process.stdout.write(`validate-content: ${schemas.length} schema(s) carregado(s) de dados/schemas/v1.\n`);
  return createValidationResult({ errors });
}

/**
 * Roda os validadores runtime gerados contra as fixtures de entidades
 * inválidas conhecidas, como checagem de fumaça de ponta a ponta. Cada
 * fixture DEVE ser rejeitada; se alguma for aceita como válida, isso é um
 * erro (regressão no gerador/schemas).
 * @returns {Promise<import('../site/js/core/validation.js').ValidationResult>}
 */
async function checkInvalidFixturesAreRejected() {
  let raw;
  try {
    raw = await readFile(invalidFixturesPath, 'utf8');
  } catch {
    process.stdout.write('validate-content: nenhuma fixture de conteúdo inválido encontrada, pulando checagem.\n');
    return createValidationResult();
  }

  const fixtures = JSON.parse(raw);
  const errors = [];
  for (const fixture of fixtures) {
    const result = fixture.validator === 'effect' ? validateEffect(fixture.value) : validateEntity(fixture.value);
    if (result.valid) {
      errors.push(
        createAppError({
          code: 'FIXTURE_UNEXPECTEDLY_VALID',
          scope: 'scripts.validate-content',
          message: `Fixture "${fixture.name}" deveria ser inválida, mas validateEntity() a aceitou.`,
          context: { name: fixture.name },
        }),
      );
    }
  }

  process.stdout.write(
    `validate-content: ${fixtures.length} fixture(s) de conteúdo inválido conferida(s) em tests/fixtures/content/invalid-entities.json.\n`,
  );
  return createValidationResult({ errors });
}

/**
 * Resolve um JSON Pointer (RFC 6901) simples dentro de `document`.
 * @param {*} document
 * @param {string} pointer
 * @returns {*}
 */
function resolveJsonPointer(document, pointer) {
  if (!pointer || pointer === '') {
    return document;
  }
  const segments = pointer.split('/').slice(1).map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
  let current = document;
  for (const segment of segments) {
    if (current == null) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

/**
 * Carrega `tests/fixtures/content/<packageName>-inventory.json`, se existir.
 * Ausência do fixture não é erro (pacotes sem fixture de inventário só não
 * passam pela checagem de contagens) — devolve `null` nesse caso.
 * @param {string} packageName
 * @returns {Promise<*>}
 */
async function loadInventoryFixture(packageName) {
  const fixturePath = path.join(fixturesContentDir, `${packageName}-inventory.json`);
  try {
    return JSON.parse(await readFile(fixturePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Agrupa `index.entries` por `type`, contando quantas entradas cada tipo tem.
 * @param {*} index
 * @returns {Record<string, number>}
 */
function countEntriesByType(index) {
  const counts = {};
  for (const entry of Array.isArray(index?.entries) ? index.entries : []) {
    if (entry && typeof entry.type === 'string') {
      counts[entry.type] = (counts[entry.type] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Compara as contagens reais de `index.entries` por tipo contra um mapa
 * `expectedCounts` (tipo -> contagem esperada). Entradas com valor `null`
 * em `expectedCounts` são puladas (contagem deliberadamente não auditável
 * ainda — ver comentário de `finalTarget.feature` no fixture de inventário).
 * @param {string} packageName
 * @param {Record<string, number>} actualCounts
 * @param {Record<string, number | null>} expectedCounts
 * @param {string} label - "ativas" ou "finais", só para a mensagem de erro.
 * @returns {import('../site/js/core/validation.js').ValidationResult}
 */
function compareCounts(packageName, actualCounts, expectedCounts, label) {
  const errors = [];
  for (const [type, expected] of Object.entries(expectedCounts)) {
    if (expected === null) {
      continue;
    }
    const actual = actualCounts[type] ?? 0;
    if (actual !== expected) {
      errors.push(
        createAppError({
          code: 'PACKAGE_INVENTORY_COUNT_MISMATCH',
          scope: 'scripts.validate-content',
          message: `Pacote "${packageName}": contagem ${label} de "${type}" é ${actual}, esperado ${expected} (tests/fixtures/content/${packageName}-inventory.json).`,
          context: { packageName, type, actual, expected, label },
        }),
      );
    }
  }
  // Também sinaliza o inverso: um tipo indexado que nem aparece no mapa de
  // contagens esperadas — sem isso, um tipo novo/inesperado em index.entries
  // passaria batido só porque nenhuma entrada em `expectedCounts` "bateu"
  // errado (não havia entrada nenhuma para comparar).
  for (const type of Object.keys(actualCounts)) {
    if (!(type in expectedCounts)) {
      errors.push(
        createAppError({
          code: 'PACKAGE_INVENTORY_UNEXPECTED_TYPE',
          scope: 'scripts.validate-content',
          message: `Pacote "${packageName}": index.entries contém entidades do tipo "${type}" (${actualCounts[type]}), que não aparece em nenhuma contagem ${label} esperada (tests/fixtures/content/${packageName}-inventory.json).`,
          context: { packageName, type, actual: actualCounts[type], label },
        }),
      );
    }
  }
  return createValidationResult({ errors });
}

/**
 * Cria as capacidades de fonte apropriadas para `namespace`: oficiais
 * (`createOfficialSourceCapabilities`) quando o namespace é o reservado, ou
 * comuns (`createSourceCapabilities`) para qualquer outro. Evita depender de
 * uma constante `OFFICIAL_NAMESPACE` exportada (não existe uma) tentando a
 * via comum primeiro e caindo para a oficial só se ela recusar o namespace —
 * a mesma checagem que `site/js/content/capabilities.js` já faz
 * internamente, só espelhada aqui para escolher qual fábrica chamar.
 * @param {string} namespace
 * @returns {Readonly<object>}
 */
function capabilitiesForNamespace(namespace) {
  try {
    return createSourceCapabilities({ namespace });
  } catch {
    return createOfficialSourceCapabilities();
  }
}

/**
 * Confirma, chamando o `ContentRegistry` real (não um dublê), que um pacote
 * cujo manifesto não está `status: "ready"` nunca é ativado em runtime —
 * mesma regra que `site/js/content/registry.js` aplica a qualquer fonte
 * registrada, exercitada aqui ponta a ponta com o manifesto/índice/entidades
 * reais do pacote em staging (não apenas testada genericamente com fixtures
 * sintéticas, como em tests/unit/content/registry.test.js).
 * @param {string} packageName
 * @param {*} manifest
 * @param {*} index
 * @param {Array<*>} entities
 * @returns {Promise<import('../site/js/core/validation.js').ValidationResult>}
 */
async function checkStagingPackageNeverActivates(packageName, manifest, index, entities) {
  if (manifest.status === 'ready') {
    return createValidationResult();
  }

  const entitiesById = new Map(entities.map((entity) => [entity && entity.id, entity]));
  const source = Object.freeze({
    async loadManifest() {
      return ok(manifest);
    },
    async loadIndex() {
      return ok(index);
    },
    async loadEntity(id) {
      return ok(entitiesById.get(id));
    },
  });

  const registry = ContentRegistry({
    validator: { validateManifest, validateIndex, validateEntity, validateReferences },
  });
  // `createSourceCapabilities` recusa de propósito o namespace oficial
  // reservado (`dnd2024`) — só `createOfficialSourceCapabilities()` pode
  // concedê-lo. Este script de staging local/CI (fora de `site/js`, não
  // sujeito à allowlist de `scripts/check-architecture.mjs`) precisa
  // ativar o REGISTRY REAL contra o pacote oficial de verdade para provar
  // que `status !== "ready"` bloqueia a ativação também nesse namespace,
  // não só em namespaces de teste sintéticos.
  const capabilities = capabilitiesForNamespace(manifest.id);
  registry.registerSource(source, capabilities);
  const result = await registry.initialize();

  if (result.ok) {
    return createValidationResult({
      errors: [
        createAppError({
          code: 'PACKAGE_STAGING_UNEXPECTEDLY_ACTIVATED',
          scope: 'scripts.validate-content',
          message: `Pacote "${packageName}" tem status "${String(manifest.status)}" (não "ready"), mas o ContentRegistry ATIVOU o pacote mesmo assim — regressão crítica na porta de ativação.`,
          context: { packageName, status: manifest.status },
        }),
      ],
    });
  }
  if (result.error.code !== 'CONTENT_PACKAGE_NOT_READY') {
    return createValidationResult({
      errors: [
        createAppError({
          code: 'PACKAGE_STAGING_UNEXPECTED_REJECTION_REASON',
          scope: 'scripts.validate-content',
          message: `Pacote "${packageName}" (status "${String(manifest.status)}") foi rejeitado pelo ContentRegistry, mas por um motivo inesperado ("${result.error.code}") em vez de "CONTENT_PACKAGE_NOT_READY".`,
          context: { packageName, status: manifest.status, actualErrorCode: result.error.code },
        }),
      ],
    });
  }
  return createValidationResult();
}

/**
 * Confirma que todo arquivo `.json` canônico do pacote (qualquer arquivo sob
 * `packageDir`, exceto `manifest.json`/`index.json`) tem pelo menos uma
 * entrada correspondente em `index.entries[].path` — nenhum arquivo de
 * conteúdo "esquecido" fora do índice. Só é exigido para pacotes
 * `status: "ready"` (um pacote `"building"` pode legitimamente ter arquivos
 * de tipos ainda não ativos no disco, aguardando as próximas tarefas).
 * @param {string} packageDir
 * @param {string} packageName
 * @param {*} index
 * @returns {Promise<import('../site/js/core/validation.js').ValidationResult>}
 */
async function checkAllCanonicalFilesIndexed(packageDir, packageName, index) {
  const allJsonFiles = (await listJsonFilesRecursively(packageDir)).filter(
    (relPath) => relPath !== 'manifest.json' && relPath !== 'index.json',
  );
  const indexedPaths = new Set(
    (Array.isArray(index?.entries) ? index.entries : [])
      .map((entry) => entry && entry.path)
      .filter((value) => typeof value === 'string'),
  );
  const errors = [];
  for (const relPath of allJsonFiles) {
    const posixPath = relPath.split(path.sep).join('/');
    if (!indexedPaths.has(posixPath)) {
      errors.push(
        createAppError({
          code: 'PACKAGE_CANONICAL_FILE_NOT_INDEXED',
          scope: 'scripts.validate-content',
          message: `Pacote "${packageName}": o arquivo "${posixPath}" existe no disco mas não está referenciado por nenhuma entrada de index.entries.`,
          context: { packageName, path: posixPath },
        }),
      );
    }
  }
  return createValidationResult({ errors });
}

/**
 * Valida um único pacote de conteúdo (diretório com manifest.json +
 * index.json + entidades referenciadas pelo índice).
 * @param {string} packageDir
 * @param {string} packageName
 * @returns {Promise<import('../site/js/core/validation.js').ValidationResult>}
 */
async function validatePackage(packageDir, packageName) {
  const manifestRaw = await readFile(path.join(packageDir, 'manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const manifestResult = validateManifest(manifest);

  const indexRaw = await readFile(path.join(packageDir, 'index.json'), 'utf8');
  const index = JSON.parse(indexRaw);
  const indexResult = validateIndex(index);

  const entities = [];
  const entityErrors = [];
  // Cache por path: quando várias entries de índice apontam (via `pointer`)
  // para o mesmo arquivo-coleção, o envelope (schema `collection`) só
  // precisa ser validado uma vez, não uma vez por entry.
  const collectionEnvelopeErrorsByPath = new Map();
  if (Array.isArray(index.entries)) {
    for (const entry of index.entries) {
      if (!entry || typeof entry.path !== 'string') {
        continue;
      }
      let fileContent;
      try {
        fileContent = JSON.parse(await readFile(path.join(packageDir, entry.path), 'utf8'));
      } catch (error) {
        entityErrors.push(
          createAppError({
            code: 'PACKAGE_ENTITY_FILE_UNREADABLE',
            scope: 'scripts.validate-content',
            message: `Não foi possível ler/parsear "${entry.path}" (id "${entry.id}"): ${error.message}`,
            context: { path: entry.path, id: entry.id },
          }),
        );
        continue;
      }

      // Quando a entry usa `pointer`, o arquivo apontado por `path` é um
      // arquivo-coleção (collection.schema.json), não a entidade em si —
      // valida o envelope antes de tentar resolver o pointer dentro dele.
      if (entry.pointer && !collectionEnvelopeErrorsByPath.has(entry.path)) {
        collectionEnvelopeErrorsByPath.set(entry.path, runGeneratedValidator('collection', fileContent).errors);
      }
      if (entry.pointer) {
        entityErrors.push(...collectionEnvelopeErrorsByPath.get(entry.path));
      }

      const entity = entry.pointer ? resolveJsonPointer(fileContent, entry.pointer) : fileContent;
      if (entity === undefined) {
        entityErrors.push(
          createAppError({
            code: 'PACKAGE_ENTITY_POINTER_UNRESOLVED',
            scope: 'scripts.validate-content',
            message: `O pointer "${entry.pointer}" não resolveu nenhum valor em "${entry.path}" (id "${entry.id}").`,
            context: { path: entry.path, pointer: entry.pointer, id: entry.id },
          }),
        );
        continue;
      }
      entities.push(entity);
      entityErrors.push(...validateEntity(entity).errors);
    }
  }

  const referencesResult = validateReferences({ manifest, index, entities });

  // Checagens ramificadas por `manifest.status` (ver comentário de topo do
  // arquivo): "building" só confere contagens ativas e a não-ativação em
  // runtime; "ready" exige contagens finais, zero arquivo canônico órfão, e
  // (via `referencesResult`, já calculado acima) zero referência quebrada.
  const inventoryFixture = await loadInventoryFixture(packageName);
  const actualCounts = countEntriesByType(index);
  const stagingResults = [];

  if (manifest.status === 'building') {
    if (inventoryFixture && inventoryFixture.active) {
      stagingResults.push(compareCounts(packageName, actualCounts, inventoryFixture.active, 'ativa'));
    }
    stagingResults.push(await checkStagingPackageNeverActivates(packageName, manifest, index, entities));
  } else if (manifest.status === 'ready') {
    if (inventoryFixture && inventoryFixture.finalTarget) {
      stagingResults.push(compareCounts(packageName, actualCounts, inventoryFixture.finalTarget, 'final'));
    }
    stagingResults.push(await checkAllCanonicalFilesIndexed(packageDir, packageName, index));
    // Sem chamada a `checkStagingPackageNeverActivates` aqui de propósito: a
    // própria função faz `if (manifest.status === 'ready') return
    // createValidationResult()` como primeira linha — chamá-la neste ramo
    // seria sempre um no-op morto. A checagem de não-ativação só faz sentido
    // (e só é chamada) no ramo "building" acima.
  } else {
    stagingResults.push(
      createValidationResult({
        errors: [
          createAppError({
            code: 'PACKAGE_STATUS_UNKNOWN',
            scope: 'scripts.validate-content',
            message: `Pacote "${packageName}": manifest.status ("${String(manifest.status)}") não é "building" nem "ready" — o pipeline de staging não sabe como validá-lo.`,
            context: { packageName, status: manifest.status },
          }),
        ],
      }),
    );
  }

  return mergeValidationResults([
    manifestResult,
    indexResult,
    createValidationResult({ errors: entityErrors }),
    referencesResult,
    ...stagingResults,
  ]);
}

async function main() {
  const results = [];
  results.push(await checkSchemasCompile());
  results.push(await checkInvalidFixturesAreRejected());

  if (await directoryExists(packagesDir)) {
    const packageNames = (await readdir(packagesDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const packageName of packageNames) {
      process.stdout.write(`validate-content: validando pacote "${packageName}"...\n`);
      results.push(await validatePackage(path.join(packagesDir, packageName), packageName));
    }
  } else {
    process.stdout.write('validate-content: dados/pacotes/ ainda não existe, nenhum pacote para validar.\n');
  }

  const combined = mergeValidationResults(results);

  if (combined.valid) {
    process.stdout.write(`validate-content: OK (${combined.warnings.length} aviso(s)).\n`);
    return;
  }

  process.stderr.write(`validate-content: ${combined.errors.length} erro(s):\n`);
  for (const error of combined.errors) {
    process.stderr.write(`  - ${JSON.stringify(serializeAppError(error))}\n`);
  }
  process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`validate-content: erro fatal: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
