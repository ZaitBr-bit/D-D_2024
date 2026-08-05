#!/usr/bin/env node
// Gera `site/js/content/schemas/generated-validators.js`: um módulo ESM
// autocontido (sem importar o pacote `ajv` em runtime) com uma função de
// validação compilada para cada schema de `dados/schemas/v1/*.schema.json`.
//
// Usa o modo "standalone" do Ajv (compila para código-fonte JS puro em vez
// de manter a instância do Ajv em memória) para que o navegador nunca
// precise carregar o motor de compilação de schemas — só as funções de
// validação já compiladas. Only este script (executado em build-time, via
// Node) importa `ajv`/`ajv-formats`; `site/js/**` nunca importa esses
// pacotes.
//
// Detalhe de implementação: o gerador standalone do Ajv 8.20 emite
// `require("ajv/dist/runtime/...")` para alguns helpers de baixo nível
// (`ucs2length`, `equal`) mesmo quando `code.esm` está ativo — só a sintaxe
// de export respeita `esm`, não as referências internas de runtime (ver
// node_modules/ajv/dist/standalone/index.js). Para manter o módulo gerado
// livre de `require()` (inválido em ESM de navegador) e sem depender do
// pacote `ajv` em runtime, este script substitui essas referências por
// imports relativos para versões vendorizadas e sem dependências desses
// dois utilitários em `site/js/content/schemas/vendor/`. Nenhum dos
// schemas atuais usa o keyword `format`, então `ajv-formats` não deixa
// nenhuma referência de runtime no código gerado; ainda assim o
// registramos no Ajv aqui (`addFormats`) para que schemas futuros possam
// usar `format` livremente — se isso acontecer, o `assertNoRemainingRequire`
// abaixo falha alto e cedo em vez de gerar um módulo quebrado, sinalizando
// que este script precisa de um vendor adicional para o helper novo.
//
// Uso:
//   node scripts/generate-schema-validators.mjs --write   # escreve o arquivo
//   node scripts/generate-schema-validators.mjs --check   # gera em memória e
//                                                          # falha se divergir
//                                                          # do arquivo commitado

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone/index.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const schemasDir = path.join(repoRoot, 'dados', 'schemas', 'v1');
const outputPath = path.join(repoRoot, 'site', 'js', 'content', 'schemas', 'generated-validators.js');
const SCHEMA_BASE_URL = 'https://schemas.fichas-de-nimb.dev/v1/';

// Mapa nome-de-export -> arquivo de schema. As chaves são identificadores
// JS válidos (por isso "class.schema.json" vira "characterClass": `class`
// é palavra reservada e não pode ser usado como binding `export const`).
// Esta lista é a fonte da verdade de quais schemas produzem validador
// exportado; `common.schema.json` fica de fora porque só contém `$defs`
// reutilizáveis, sem forma própria validável no nível raiz.
const EXPORT_MAP = {
  manifest: 'manifest.schema.json',
  index: 'index.schema.json',
  collection: 'collection.schema.json',
  choice: 'choice.schema.json',
  effect: 'effect.schema.json',
  ruleset: 'ruleset.schema.json',
  ability: 'ability.schema.json',
  skill: 'skill.schema.json',
  condition: 'condition.schema.json',
  damageType: 'damage-type.schema.json',
  language: 'language.schema.json',
  characterClass: 'class.schema.json',
  subclass: 'subclass.schema.json',
  feature: 'feature.schema.json',
  species: 'species.schema.json',
  background: 'background.schema.json',
  feat: 'feat.schema.json',
  spell: 'spell.schema.json',
  spellList: 'spell-list.schema.json',
  weapon: 'weapon.schema.json',
  armor: 'armor.schema.json',
  equipment: 'equipment.schema.json',
  creature: 'creature.schema.json',
  glossaryEntry: 'glossary-entry.schema.json',
  migrationMap: 'migration-map.schema.json',
  characterCanonicalV2: 'character-canonical-v2.schema.json',
  characterRecordV2: 'character-record-v2.schema.json',
};

// Substituições textuais de `require("ajv/dist/runtime/X").default` (emitido
// pelo gerador standalone do Ajv, ver comentário de topo) por identificadores
// que resolvem para imports ESM vendorizados sem dependências.
const RUNTIME_REQUIRE_SUBSTITUTIONS = [
  {
    pattern: /require\("ajv\/dist\/runtime\/ucs2length"\)\.default/g,
    identifier: '__ucs2length',
    importStatement: "import __ucs2length from './vendor/ucs2length.mjs';",
  },
  {
    pattern: /require\("ajv\/dist\/runtime\/equal"\)\.default/g,
    identifier: '__equal',
    importStatement: "import __equal from './vendor/equal.mjs';",
  },
  {
    // Emitido quando algum schema usa `format: "date-time"` (via
    // common.schema.json#/$defs/isoDateTime). Note a ausência de `.default`
    // aqui — diferente dos dois helpers acima, o valor usado pelo código
    // gerado é `<require(...)>.fullFormats["date-time"]`, então só
    // substituímos a chamada de require em si, preservando o acesso a
    // `.fullFormats["date-time"]` que já vem depois no código gerado.
    pattern: /require\("ajv-formats\/dist\/formats"\)/g,
    identifier: '__ajvFormats',
    importStatement: "import __ajvFormats from './vendor/format-date-time.mjs';",
  },
];

/**
 * Carrega todos os arquivos `*.schema.json` de `dados/schemas/v1` como
 * objetos JS, ordenados por nome de arquivo (determinístico).
 * @returns {Promise<Array<{fileName: string, schema: object}>>}
 */
async function loadSchemas() {
  const fileNames = (await readdir(schemasDir))
    .filter((name) => name.endsWith('.schema.json'))
    .sort();
  const schemas = [];
  for (const fileName of fileNames) {
    const raw = await readFile(path.join(schemasDir, fileName), 'utf8');
    schemas.push({ fileName, schema: JSON.parse(raw) });
  }
  return schemas;
}

/**
 * Falha alto e cedo se algum arquivo `*.schema.json` (exceto
 * `common.schema.json`, que só tem `$defs` reutilizáveis, sem forma própria
 * no nível raiz) não tiver uma entrada correspondente em `EXPORT_MAP`. Sem
 * essa checagem, um schema novo adicionado a `dados/schemas/v1/` mas
 * esquecido em `EXPORT_MAP` produziria um `generated-validators.js`
 * byte-a-byte idêntico ao anterior (o schema esquecido simplesmente não
 * aparece na saída) — `--check` passaria silenciosamente mesmo sem
 * validador nenhum para esse schema.
 * @param {Array<{fileName: string, schema: object}>} schemas
 */
function assertExportMapCoversAllSchemas(schemas) {
  const expectedFileNames = new Set(
    schemas.map(({ fileName }) => fileName).filter((fileName) => fileName !== 'common.schema.json'),
  );
  const coveredFileNames = new Set(Object.values(EXPORT_MAP));

  const missing = [...expectedFileNames].filter((fileName) => !coveredFileNames.has(fileName)).sort();
  const dangling = [...coveredFileNames].filter((fileName) => !expectedFileNames.has(fileName)).sort();

  if (missing.length > 0 || dangling.length > 0) {
    const parts = [];
    if (missing.length > 0) {
      parts.push(`schema(s) sem export em EXPORT_MAP: ${missing.join(', ')}`);
    }
    if (dangling.length > 0) {
      parts.push(`entrada(s) de EXPORT_MAP apontando para schema inexistente: ${dangling.join(', ')}`);
    }
    throw new Error(`generate-schema-validators: EXPORT_MAP desatualizado — ${parts.join('; ')}.`);
  }
}

/**
 * Constrói uma instância Ajv 2020-12 com todos os schemas v1 registrados e
 * `ajv-formats` habilitado (usado por `common.schema.json#/$defs/isoDateTime`,
 * cujo `require()` de runtime é vendorizado — ver
 * RUNTIME_REQUIRE_SUBSTITUTIONS acima).
 * @param {Array<{fileName: string, schema: object}>} schemas
 * @returns {InstanceType<typeof Ajv2020>}
 */
function buildAjv(schemas) {
  const ajv = new Ajv2020({
    code: { source: true, esm: true },
    allErrors: true,
    strict: true,
    allowUnionTypes: true,
  });
  addFormats(ajv);
  for (const { fileName, schema } of schemas) {
    ajv.addSchema(schema, schema.$id);
    void fileName;
  }
  return ajv;
}

/**
 * Gera o código-fonte do módulo standalone (ainda com `require()` cru do
 * Ajv) e o pós-processa: substitui os requires de runtime por imports
 * vendorizados e falha alto se sobrar algum `require()` não tratado (sinal
 * de que um schema novo passou a usar um keyword que aciona um helper de
 * runtime ainda não vendorizado).
 * @param {InstanceType<typeof Ajv2020>} ajv
 * @returns {string}
 */
function generateModuleSource(ajv) {
  const refs = {};
  for (const [exportName, fileName] of Object.entries(EXPORT_MAP)) {
    refs[exportName] = SCHEMA_BASE_URL + fileName;
  }

  let code = standaloneCode(ajv, refs);

  const importStatements = [];
  for (const substitution of RUNTIME_REQUIRE_SUBSTITUTIONS) {
    if (substitution.pattern.test(code)) {
      substitution.pattern.lastIndex = 0;
      code = code.replace(substitution.pattern, substitution.identifier);
      importStatements.push(substitution.importStatement);
    }
  }

  assertNoRemainingRequire(code);

  const header = [
    '// ARQUIVO GERADO — NÃO EDITAR À MÃO.',
    '// Gerado por `node scripts/generate-schema-validators.mjs --write` a partir de',
    '// `dados/schemas/v1/*.schema.json`. Para atualizar, edite os schemas-fonte e',
    '// rode o comando de geração novamente (ver `check:validators`/`generate:validators`',
    '// em package.json).',
    '//',
    '// Módulo ESM autocontido: não importa o pacote `ajv` em runtime, só os dois',
    '// utilitários vendorizados e sem dependências em `./vendor/` (ver comentário',
    '// de topo de scripts/generate-schema-validators.mjs).',
    '"use strict";',
    ...importStatements,
  ].join('\n');

  // O standaloneCode do Ajv já inicia com `"use strict";`; removemos essa
  // ocorrência duplicada antes de prefixar nosso próprio cabeçalho.
  const bodyWithoutLeadingDirective = code.replace(/^"use strict";/, '');

  return `${header}\n${bodyWithoutLeadingDirective}\n`;
}

/**
 * Lança um erro descritivo se o código gerado ainda contiver `require(`,
 * o que indicaria um helper de runtime do Ajv não vendorizado/tratado.
 * @param {string} code
 */
function assertNoRemainingRequire(code) {
  const match = /require\(/.exec(code);
  if (match) {
    const context = code.slice(Math.max(0, match.index - 40), match.index + 80);
    throw new Error(
      `generate-schema-validators: sobrou um require() não tratado no código gerado ` +
        `(um schema novo deve ter acionado um helper de runtime do Ajv ainda não vendorizado). ` +
        `Contexto: ...${context}...`,
    );
  }
}

/**
 * @param {string[]} argv
 * @returns {{mode: 'write' | 'check'}}
 */
function parseArgs(argv) {
  const hasWrite = argv.includes('--write');
  const hasCheck = argv.includes('--check');
  if (hasWrite === hasCheck) {
    throw new Error('Uso: node scripts/generate-schema-validators.mjs (--write | --check)');
  }
  return { mode: hasWrite ? 'write' : 'check' };
}

async function main() {
  const { mode } = parseArgs(process.argv.slice(2));
  const schemas = await loadSchemas();
  assertExportMapCoversAllSchemas(schemas);
  const ajv = buildAjv(schemas);
  const moduleSource = generateModuleSource(ajv);

  if (mode === 'write') {
    await writeFile(outputPath, moduleSource, 'utf8');
    process.stdout.write(`generate-schema-validators: escrito ${path.relative(repoRoot, outputPath)}\n`);
    return;
  }

  // --check: gera em memória e compara com o arquivo commitado, sem escrever.
  let existing;
  try {
    existing = await readFile(outputPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      process.stderr.write(
        `check:validators: ${path.relative(repoRoot, outputPath)} não existe. ` +
          `Rode "node scripts/generate-schema-validators.mjs --write".\n`,
      );
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  if (existing !== moduleSource) {
    process.stderr.write(
      `check:validators: ${path.relative(repoRoot, outputPath)} está desatualizado em relação a ` +
        `dados/schemas/v1/*.schema.json. Rode "node scripts/generate-schema-validators.mjs --write" ` +
        `e commit o resultado.\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write('check:validators: gerado atualizado.\n');
}

main().catch((error) => {
  process.stderr.write(`generate-schema-validators: erro fatal: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
