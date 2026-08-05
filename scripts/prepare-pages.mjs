#!/usr/bin/env node
// ============================================================
// Task 35 — gera o artifact de deploy do GitHub Pages de forma
// determinística: `_dist/index.html` (redirect), `_dist/site/**` e
// `_dist/dados/**`, mais `_dist/site/precache-manifest.json` com o SHA-256
// de cada asset já materializado.
//
// NUNCA altera os arquivos-fonte do repositório: tudo é escrito em
// `--out` (padrão `_dist`, git-ignorado). A única transformação de
// conteúdo é a substituição do marcador único `__DEPLOY_VERSION__` (sem
// `sed`, sem Python inline) nas CÓPIAS de `site/index.html` e `site/sw.js`.
//
// Uso:
//   node scripts/prepare-pages.mjs --out _dist --version <versão>
// ============================================================
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  buildPrecacheManifest,
  computeExpectedAssetUrls,
  serializeManifest,
} from './lib/precache-manifest.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** Marcador único e auditável, substituído nas cópias (nunca nos fontes). */
export const DEPLOY_VERSION_MARKER = '__DEPLOY_VERSION__';

/**
 * Faz o parse mínimo de `--out <dir>` e `--version <versão>` a partir de
 * `argv`. Ambos são obrigatórios.
 * @param {string[]} argv - ex.: `process.argv.slice(2)`.
 * @returns {{out: string, version: string}}
 */
export function parseArgs(argv) {
  let out;
  let version;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') {
      out = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--version') {
      version = argv[i + 1];
      i += 1;
    }
  }
  if (!out) throw new Error('prepare-pages: faltando --out <diretório>');
  if (!version) throw new Error('prepare-pages: faltando --version <versão>');
  return { out, version };
}

/**
 * Substitui TODAS as ocorrências do marcador de versão pelo valor real,
 * exigindo pelo menos uma ocorrência (marcador "exato", auditável — se
 * sumir do fonte, o build deve falhar alto e claro, não silenciosamente
 * publicar `__DEPLOY_VERSION__` literal em produção).
 * @param {string} absPath - caminho absoluto do arquivo já COPIADO (nunca o fonte).
 * @param {string} deployVersion
 * @returns {Promise<void>}
 */
async function injectVersionMarker(absPath, deployVersion) {
  const original = await readFile(absPath, 'utf8');
  if (!original.includes(DEPLOY_VERSION_MARKER)) {
    throw new Error(`prepare-pages: marcador ${DEPLOY_VERSION_MARKER} ausente em ${absPath}`);
  }
  const replaced = original.split(DEPLOY_VERSION_MARKER).join(deployVersion);
  await writeFile(absPath, replaced, 'utf8');
}

/**
 * Monta o artifact completo em `outDir`: limpa/recria o diretório, copia
 * `index.html` (raiz, redirect), `site/` e `dados/` byte-a-byte, injeta a
 * versão nas cópias de `site/index.html`/`site/sw.js` e escreve
 * `site/precache-manifest.json` com o SHA-256 real de cada asset.
 * @param {{outDir: string, deployVersion: string}} args
 * @returns {Promise<{outDir: string, manifest: object}>}
 */
export async function preparePagesArtifact({ outDir, deployVersion }) {
  const absOut = path.isAbsolute(outDir) ? outDir : path.join(repoRoot, outDir);

  await rm(absOut, { recursive: true, force: true });
  await mkdir(absOut, { recursive: true });

  await cp(path.join(repoRoot, 'index.html'), path.join(absOut, 'index.html'));
  await cp(path.join(repoRoot, 'site'), path.join(absOut, 'site'), { recursive: true });
  await cp(path.join(repoRoot, 'dados'), path.join(absOut, 'dados'), { recursive: true });

  await injectVersionMarker(path.join(absOut, 'site', 'index.html'), deployVersion);
  await injectVersionMarker(path.join(absOut, 'site', 'sw.js'), deployVersion);

  // A definição de "completo" é recalculada contra a CÓPIA recém-criada em
  // `outDir` (não contra o fonte): assim o manifesto reflete exatamente o
  // que será servido, e build/verify sempre concordam (mesma função).
  const { staticUrls, dataUrls } = await computeExpectedAssetUrls({
    siteDir: path.join(absOut, 'site'),
    dadosDir: path.join(absOut, 'dados'),
  });

  const manifest = await buildPrecacheManifest({
    deployVersion,
    siteDistDir: path.join(absOut, 'site'),
    dadosDistDir: path.join(absOut, 'dados'),
    staticUrls,
    dataUrls,
  });

  await writeFile(path.join(absOut, 'site', 'precache-manifest.json'), serializeManifest(manifest), 'utf8');

  return { outDir: absOut, manifest };
}

/**
 * Lista, apenas para o resumo impresso no terminal, quantos arquivos
 * ficaram sob `dir` (contagem simples, não usada pela lógica de build).
 * @param {string} dir
 * @returns {Promise<number>}
 */
async function countFilesRecursive(dir) {
  let total = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) total += await countFilesRecursive(path.join(dir, entry.name));
    else total += 1;
  }
  return total;
}

async function main() {
  const { out, version } = parseArgs(process.argv.slice(2));
  const { outDir, manifest } = await preparePagesArtifact({ outDir: out, deployVersion: version });
  const fileCount = await countFilesRecursive(outDir);
  process.stdout.write(
    `[prepare-pages] artifact gerado em ${outDir} (${fileCount} arquivo(s); ` +
      `${manifest.staticAssets.length} asset(s) estático(s), ${manifest.dataAssets.length} asset(s) de dados; ` +
      `versão ${manifest.deployVersion}).\n`,
  );
}

const isMainModule =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  main().catch((error) => {
    console.error(`[prepare-pages] ${error.message}`);
    process.exitCode = 1;
  });
}
