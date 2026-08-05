#!/usr/bin/env node
// Dependency-free syntax check: discovers every .js/.mjs file under the
// directories that matter for this repo (site/js, scripts, tests), always
// includes site/sw.js and any playwright*.config.js at the repo root, then
// runs `node --check` against each file in a stable order, stopping at the
// first failure.

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIRS = ['site/js', 'scripts', 'tests'];
const EXTENSIONS = new Set(['.js', '.mjs']);

async function walkDirectory(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const found = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await walkDirectory(fullPath)));
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      found.push(fullPath);
    }
  }
  return found;
}

async function findRootPlaywrightConfigs() {
  const entries = await readdir(repoRoot, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /^playwright.*\.config\.js$/.test(entry.name),
    )
    .map((entry) => path.join(repoRoot, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Discovers every file that should be syntax-checked, in a stable order.
 * @returns {Promise<string[]>}
 */
export async function discoverFilesToCheck() {
  const files = new Set();

  for (const dir of SCAN_DIRS) {
    const absoluteDir = path.join(repoRoot, dir);
    for (const file of await walkDirectory(absoluteDir)) {
      files.add(file);
    }
  }

  const swPath = path.join(repoRoot, 'site', 'sw.js');
  try {
    await stat(swPath);
    files.add(swPath);
  } catch {
    // site/sw.js not present; nothing to add.
  }

  for (const config of await findRootPlaywrightConfigs()) {
    files.add(config);
  }

  return [...files].sort((a, b) => a.localeCompare(b));
}

function checkSyntax(file) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  return result.status ?? 1;
}

async function main() {
  const files = await discoverFilesToCheck();

  if (files.length === 0) {
    console.error('[check-syntax] No files found to check.');
    process.exitCode = 1;
    return;
  }

  for (const file of files) {
    const exitCode = checkSyntax(file);
    if (exitCode !== 0) {
      console.error(`[check-syntax] Syntax error in ${file}`);
      process.exitCode = exitCode;
      return;
    }
  }

  console.log(`[check-syntax] OK (${files.length} files checked)`);
  process.exitCode = 0;
}

const isMainModule =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  main();
}
