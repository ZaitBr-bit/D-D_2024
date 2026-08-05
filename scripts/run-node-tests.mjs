#!/usr/bin/env node
// Minimal, dependency-free Node test runner wrapper.
// Discovers `*.test.js` files under the given roots (files or directories)
// and runs them via `node --test`, propagating the resulting exit code.

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const TEST_FILE_SUFFIX = '.test.js';

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function walkDirectory(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const found = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await walkDirectory(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(TEST_FILE_SUFFIX)) {
      found.push(fullPath);
    }
  }
  return found;
}

/**
 * Discovers test files across the given roots. Each root may be a file or a
 * directory. Directories are walked recursively, collecting only files that
 * end with `.test.js`. Files passed explicitly are always included as-is.
 * Roots and resulting files are deduplicated. The result is sorted
 * deterministically (lexicographically by absolute path).
 *
 * @param {ReadonlyArray<string>} roots
 * @returns {Promise<ReadonlyArray<string>>}
 */
export async function discoverTestFiles(roots) {
  if (!roots || roots.length === 0) {
    return [];
  }

  const uniqueRoots = [...new Set(roots.map((root) => path.resolve(root)))];
  const results = new Set();

  for (const root of uniqueRoots) {
    let stats;
    try {
      stats = await stat(root);
    } catch {
      throw new Error(`Test root not found: ${root}`);
    }

    if (stats.isFile()) {
      results.add(root);
    } else if (stats.isDirectory()) {
      const files = await walkDirectory(root);
      for (const file of files) {
        results.add(file);
      }
    } else {
      throw new Error(`Test root is neither a file nor a directory: ${root}`);
    }
  }

  return [...results].sort((a, b) => a.localeCompare(b));
}

/**
 * Runs `node --test` against the given files, inheriting stdio, and resolves
 * with the child process exit code (falling back to 1 if it was killed by a
 * signal).
 *
 * @param {ReadonlyArray<string>} files
 * @returns {Promise<number>}
 */
function runNodeTest(files) {
  return new Promise((resolve, reject) => {
    // Strip NODE_TEST_CONTEXT: when this script itself runs as a child of
    // `node --test` (e.g. this very file's own test suite spawning it),
    // Node sets that variable to signal the process is a test-runner child
    // expecting V8-serialized IPC reporting instead of normal TAP on
    // stdout. Without stripping it, the nested `node --test` we spawn here
    // would silently swap to that protocol and appear to produce no output.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;

    const child = spawn(process.execPath, ['--test', ...files], { stdio: 'inherit', env });
    child.on('error', reject);
    child.on('exit', (code) => {
      resolve(code ?? 1);
    });
  });
}

async function main() {
  const roots = process.argv.slice(2);

  let files;
  try {
    files = await discoverTestFiles(roots);
  } catch (error) {
    console.error(`[run-node-tests] ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (files.length === 0) {
    console.error(
      `[run-node-tests] No test files found for roots: ${roots.length ? roots.join(', ') : '(none given)'}`,
    );
    process.exitCode = 1;
    return;
  }

  const exitCode = await runNodeTest(files);
  process.exitCode = exitCode;
}

const isMainModule =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  main();
}
