#!/usr/bin/env node
// ============================================================
// Task 35 — verifica um artifact de deploy já gerado (por
// `scripts/prepare-pages.mjs`) recalculando, do zero e a partir do MESMO
// resolvedor de grafo usado na geração, tudo que deveria estar no
// precache-manifest.json — e comparando byte a byte.
//
// Isso cobre as três formas de adulteração exigidas: um asset REMOVIDO
// (arquivo ausente), um asset ADICIONADO/alcançável mas não listado
// (conjunto de URLs esperado != conjunto do manifesto) e um asset
// ADULTERADO (SHA-256 recalculado sobre os bytes reais nunca bate com o
// gravado — reescrever apenas tamanho/data do arquivo não engana isto,
// porque nunca olhamos metadado de arquivo, só bytes).
//
// Uso:
//   node scripts/verify-pages-artifact.mjs --dir _dist
// ============================================================
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { sha256Hex } from './lib/sha256.mjs';
import {
  assertManifestIntegrity,
  computeExpectedAssetUrls,
  isRegularFile,
} from './lib/precache-manifest.mjs';
import { DEPLOY_VERSION_MARKER } from './prepare-pages.mjs';

/**
 * Faz o parse mínimo de `--dir <diretório>` a partir de `argv`.
 * @param {string[]} argv
 * @returns {{dir: string}}
 */
export function parseArgs(argv) {
  let dir;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir') {
      dir = argv[i + 1];
      i += 1;
    }
  }
  if (!dir) throw new Error('verify-pages-artifact: faltando --dir <diretório>');
  return { dir };
}

/**
 * Confere que um par de listas de URLs é EXATAMENTE igual (mesmo conjunto),
 * devolvendo o que sobra de cada lado para uma mensagem de erro útil.
 * @param {string[]} expected
 * @param {string[]} actual
 * @returns {{onlyExpected: string[], onlyActual: string[]}}
 */
function diffUrlSets(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    onlyExpected: expected.filter((u) => !actualSet.has(u)),
    onlyActual: actual.filter((u) => !expectedSet.has(u)),
  };
}

/**
 * Verifica o artifact completo em `dir`: layout, ausência do marcador de
 * versão não-substituído, completude do manifesto (URLs esperadas ==
 * URLs listadas) e integridade de cada asset (SHA-256 real == gravado).
 * @param {{dir: string}} args
 * @returns {Promise<{ok: boolean, problems: string[]}>}
 */
export async function verifyPagesArtifact({ dir }) {
  const absDir = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  const problems = [];

  const rootIndex = path.join(absDir, 'index.html');
  const siteDir = path.join(absDir, 'site');
  const dadosDir = path.join(absDir, 'dados');
  const manifestPath = path.join(siteDir, 'precache-manifest.json');

  if (!(await isRegularFile(rootIndex))) problems.push(`layout: ausente ${rootIndex}`);
  if (!(await isRegularFile(path.join(siteDir, 'index.html')))) problems.push(`layout: ausente ${siteDir}/index.html`);
  if (!(await isRegularFile(path.join(siteDir, 'sw.js')))) problems.push(`layout: ausente ${siteDir}/sw.js`);
  if (!(await isRegularFile(manifestPath))) problems.push(`layout: ausente ${manifestPath}`);
  if (problems.length > 0) return { ok: false, problems };

  // O marcador de versão nunca pode sobreviver nas cópias publicadas.
  for (const marcadoPath of [path.join(siteDir, 'index.html'), path.join(siteDir, 'sw.js')]) {
    const content = await readFile(marcadoPath, 'utf8');
    if (content.includes(DEPLOY_VERSION_MARKER)) {
      problems.push(`versão: marcador ${DEPLOY_VERSION_MARKER} não substituído em ${marcadoPath}`);
    }
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    return { ok: false, problems: [`manifesto: JSON inválido (${error.message})`] };
  }

  if (manifest.schemaVersion !== 1) problems.push(`manifesto: schemaVersion inesperado: ${manifest.schemaVersion}`);
  if (typeof manifest.deployVersion !== 'string' || manifest.deployVersion.length === 0) {
    problems.push('manifesto: deployVersion ausente/inválida');
  }
  if (!Array.isArray(manifest.staticAssets) || !Array.isArray(manifest.dataAssets)) {
    return { ok: false, problems: [...problems, 'manifesto: staticAssets/dataAssets ausentes'] };
  }

  try {
    assertManifestIntegrity(manifest);
  } catch (error) {
    problems.push(`manifesto: ${error.message}`);
  }

  // Recalcula, do ZERO, o mesmo grafo usado na geração — contra o próprio
  // artifact (não contra o repositório-fonte) — para detectar tanto
  // remoção quanto adição de asset alcançável.
  const { staticUrls: expectedStatic, dataUrls: expectedData } = await computeExpectedAssetUrls({
    siteDir,
    dadosDir,
  });

  const actualStatic = manifest.staticAssets.map((e) => e.url).sort();
  const actualData = manifest.dataAssets.map((e) => e.url).sort();

  const diffStatic = diffUrlSets(expectedStatic, actualStatic);
  const diffData = diffUrlSets(expectedData, actualData);
  for (const url of diffStatic.onlyExpected) problems.push(`completude: asset estático alcançável ausente do manifesto: ${url}`);
  for (const url of diffStatic.onlyActual) problems.push(`completude: manifesto lista asset estático inalcançável: ${url}`);
  for (const url of diffData.onlyExpected) problems.push(`completude: asset de dados alcançável ausente do manifesto: ${url}`);
  for (const url of diffData.onlyActual) problems.push(`completude: manifesto lista asset de dados inalcançável: ${url}`);

  // Integridade byte a byte: NUNCA confia em tamanho/data do arquivo, só no
  // SHA-256 real recalculado — a única forma de detectar adulteração.
  for (const [entries, prefix, baseDir] of [
    [manifest.staticAssets, './', siteDir],
    [manifest.dataAssets, '../dados/', dadosDir],
  ]) {
    for (const entry of entries) {
      if (!entry.url.startsWith(prefix)) continue; // já reportado acima como URL inválida
      const rel = entry.url.slice(prefix.length);
      const absAssetPath = path.join(baseDir, ...rel.split('/'));
      if (!(await isRegularFile(absAssetPath))) {
        problems.push(`integridade: arquivo ausente para ${entry.url}`);
        continue;
      }
      const bytes = await readFile(absAssetPath);
      const realHash = sha256Hex(bytes);
      if (realHash !== entry.sha256) {
        problems.push(`integridade: SHA-256 divergente em ${entry.url} (manifesto=${entry.sha256}, real=${realHash})`);
      }
    }
  }

  return { ok: problems.length === 0, problems };
}

async function main() {
  const { dir } = parseArgs(process.argv.slice(2));
  const { ok, problems } = await verifyPagesArtifact({ dir });
  if (ok) {
    process.stdout.write(`[verify-pages] OK: ${dir} é um artifact válido e completo.\n`);
    return;
  }
  console.error(`[verify-pages] FALHOU: ${problems.length} problema(s) em ${dir}:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
}

const isMainModule =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  main().catch((error) => {
    console.error(`[verify-pages] ${error.message}`);
    process.exitCode = 1;
  });
}
