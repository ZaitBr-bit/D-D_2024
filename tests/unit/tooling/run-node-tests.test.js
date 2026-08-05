import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { discoverTestFiles } from '../../../scripts/run-node-tests.mjs';

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(new URL('../../../scripts/run-node-tests.mjs', import.meta.url));

async function makeFixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'run-node-tests-'));
  await mkdir(path.join(dir, 'nested', 'deeper'), { recursive: true });
  await writeFile(path.join(dir, 'a.test.js'), '// a');
  await writeFile(path.join(dir, 'b.test.js'), '// b');
  await writeFile(path.join(dir, 'not-a-test.js'), '// ignored');
  await writeFile(path.join(dir, 'nested', 'c.test.js'), '// c');
  await writeFile(path.join(dir, 'nested', 'deeper', 'd.test.js'), '// d');
  await writeFile(path.join(dir, 'nested', 'deeper', 'notes.md'), '# ignored');
  return dir;
}

test('discoverTestFiles recursively finds only *.test.js files under a directory root, sorted', async () => {
  const dir = await makeFixture();
  try {
    const files = await discoverTestFiles([dir]);
    assert.deepEqual(files, [...files].sort(), 'result must already be sorted');
    assert.equal(files.length, 4);
    for (const f of files) {
      assert.match(f, /\.test\.js$/);
    }
    assert.ok(files.some((f) => f.endsWith(path.join('nested', 'deeper', 'd.test.js'))));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('discoverTestFiles accepts a single file path directly, even without .test.js suffix filtering applied to explicit files', async () => {
  const dir = await makeFixture();
  try {
    // `not-a-test.js` does NOT end in `.test.js`, so it would never be
    // picked up by the recursive directory walk. Passing it explicitly must
    // still include it, proving explicit files skip suffix filtering.
    const explicitFile = path.join(dir, 'not-a-test.js');
    const files = await discoverTestFiles([explicitFile]);
    assert.deepEqual(files, [path.resolve(explicitFile)]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('discoverTestFiles deduplicates repeated roots and repeated files discovered via overlapping roots', async () => {
  const dir = await makeFixture();
  try {
    const explicitFile = path.join(dir, 'a.test.js');
    const files = await discoverTestFiles([dir, dir, explicitFile]);
    const occurrences = files.filter((f) => f === path.resolve(explicitFile));
    assert.equal(occurrences.length, 1);
    assert.equal(files.length, 4);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('discoverTestFiles combines multiple distinct roots deterministically', async () => {
  const dirA = await mkdtemp(path.join(tmpdir(), 'run-node-tests-a-'));
  const dirB = await mkdtemp(path.join(tmpdir(), 'run-node-tests-b-'));
  try {
    await writeFile(path.join(dirA, 'z.test.js'), '// z');
    await writeFile(path.join(dirB, 'a.test.js'), '// a');
    const filesOrder1 = await discoverTestFiles([dirA, dirB]);
    const filesOrder2 = await discoverTestFiles([dirB, dirA]);
    assert.deepEqual(filesOrder1, filesOrder2);
    assert.equal(filesOrder1.length, 2);
  } finally {
    await rm(dirA, { recursive: true, force: true });
    await rm(dirB, { recursive: true, force: true });
  }
});

test('discoverTestFiles rejects a root that does not exist', async () => {
  const missing = path.join(tmpdir(), 'run-node-tests-does-not-exist-xyz');
  await assert.rejects(() => discoverTestFiles([missing]));
});

test('discoverTestFiles returns an empty array when given no roots', async () => {
  const files = await discoverTestFiles([]);
  assert.deepEqual(files, []);
});

test('CLI explicitly refuses (non-zero exit) when discovery produces zero files', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'run-node-tests-empty-'));
  try {
    await assert.rejects(() => execFileAsync(process.execPath, [scriptPath, dir]));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('CLI propagates a zero exit code when all discovered tests pass', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'run-node-tests-pass-'));
  try {
    await writeFile(
      path.join(dir, 'ok.test.js'),
      "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('ok', () => { assert.equal(1, 1); });\n",
    );
    const { stdout } = await execFileAsync(process.execPath, [scriptPath, dir]);
    assert.match(stdout, /pass 1/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('CLI propagates a non-zero exit code when a discovered test fails', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'run-node-tests-fail-'));
  try {
    await writeFile(
      path.join(dir, 'bad.test.js'),
      "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('bad', () => { assert.equal(1, 2); });\n",
    );
    await assert.rejects(() => execFileAsync(process.execPath, [scriptPath, dir]));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
