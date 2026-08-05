import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';

import {
  parseServerArgs,
  resolveRequestPath,
  createStaticServer,
} from '../../../scripts/serve-static.mjs';

async function makeFixtureRoot() {
  const dir = await mkdtemp(path.join(tmpdir(), 'serve-static-'));
  await writeFile(path.join(dir, 'index.html'), '<html>root</html>');
  await mkdir(path.join(dir, 'site'), { recursive: true });
  await writeFile(path.join(dir, 'site', 'index.html'), '<html>site</html>');
  await mkdir(path.join(dir, 'js'), { recursive: true });
  await writeFile(path.join(dir, 'js', 'app.js'), 'export const x = 1;');
  await mkdir(path.join(dir, 'data'), { recursive: true });
  await writeFile(path.join(dir, 'data', 'file.json'), '{"ok":true}');
  return dir;
}

test('parseServerArgs parses --root, --host and --port', () => {
  const args = parseServerArgs(['--root', '.', '--host', '127.0.0.1', '--port', '4173']);
  assert.deepEqual(args, { root: '.', host: '127.0.0.1', port: 4173 });
});

test('parseServerArgs applies sane defaults when flags are omitted', () => {
  const args = parseServerArgs([]);
  assert.equal(typeof args.root, 'string');
  assert.equal(typeof args.host, 'string');
  assert.equal(typeof args.port, 'number');
});

test('resolveRequestPath resolves "/" under the given root', () => {
  const result = resolveRequestPath('/repo-root', '/');
  assert.equal(result.ok, true);
  assert.equal(path.resolve(result.value), path.resolve('/repo-root'));
});

test('resolveRequestPath resolves a nested path under the given root', () => {
  const result = resolveRequestPath('/repo-root', '/site/index.html');
  assert.equal(result.ok, true);
  assert.equal(
    path.resolve(result.value),
    path.resolve(path.join('/repo-root', 'site', 'index.html')),
  );
});

test('resolveRequestPath strips query strings before resolving the path', () => {
  const result = resolveRequestPath('/repo-root', '/site/index.html?v=123&x=y');
  assert.equal(result.ok, true);
  assert.equal(
    path.resolve(result.value),
    path.resolve(path.join('/repo-root', 'site', 'index.html')),
  );
});

test('resolveRequestPath blocks ".." path traversal attempts', () => {
  const result = resolveRequestPath('/repo-root', '/../../etc/passwd');
  assert.equal(result.ok, false);
  assert.equal(typeof result.code, 'string');
  assert.equal(typeof result.message, 'string');
});

test('resolveRequestPath blocks encoded ".." path traversal attempts', () => {
  const result = resolveRequestPath('/repo-root', '/%2e%2e/%2e%2e/etc/passwd');
  assert.equal(result.ok, false);
});

test('resolveRequestPath blocks backslash-encoded ".." path traversal attempts (Windows separator smuggling)', () => {
  // On win32, path.join()/path.resolve() treat "\" as a separator just like
  // "/". A decoded segment like "\..\..\..\Windows\System32" (from a request
  // such as "/foo/%5C..%5C..%5C..%5CWindows%5CSystem32") would slip past a
  // "/"-only split as one opaque token, then be re-interpreted as multiple
  // ".." hops once handed to path.join, escaping the root entirely.
  const result = resolveRequestPath(
    '/repo-root',
    '/foo/%5C..%5C..%5C..%5CWindows%5CSystem32',
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'FORBIDDEN');
});

test('resolveRequestPath never returns a value outside root, even for deeply mixed traversal attempts', () => {
  const attempts = [
    '/../../../../../../etc/passwd',
    '/%2e%2e/%2e%2e/%2e%2e/etc/passwd',
    '/foo/%5C..%5C..%5C..%5CWindows%5CSystem32',
    '/..%5c..%5c..%5cWindows%5cSystem32',
  ];
  const absoluteRoot = path.resolve('/repo-root');
  for (const attempt of attempts) {
    const result = resolveRequestPath('/repo-root', attempt);
    if (result.ok) {
      const relative = path.relative(absoluteRoot, path.resolve(result.value));
      assert.ok(
        !relative.startsWith('..') && !path.isAbsolute(relative),
        `attempt "${attempt}" escaped root: ${result.value}`,
      );
    }
  }
});

test('createStaticServer serves the root index.html for "/"', async () => {
  const root = await makeFixtureRoot();
  const handle = await createStaticServer({ root, host: '127.0.0.1', port: 0 });
  try {
    const res = await fetch(`http://127.0.0.1:${handle.port}/`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /root/);
    assert.match(res.headers.get('content-type') ?? '', /text\/html/);
  } finally {
    await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('createStaticServer serves "/site/" resolving to site/index.html', async () => {
  const root = await makeFixtureRoot();
  const handle = await createStaticServer({ root, host: '127.0.0.1', port: 0 });
  try {
    const res = await fetch(`http://127.0.0.1:${handle.port}/site/`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /site/);
  } finally {
    await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('createStaticServer serves .js files with a javascript MIME type', async () => {
  const root = await makeFixtureRoot();
  const handle = await createStaticServer({ root, host: '127.0.0.1', port: 0 });
  try {
    const res = await fetch(`http://127.0.0.1:${handle.port}/js/app.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /javascript/);
  } finally {
    await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('createStaticServer serves .json files with an application/json MIME type', async () => {
  const root = await makeFixtureRoot();
  const handle = await createStaticServer({ root, host: '127.0.0.1', port: 0 });
  try {
    const res = await fetch(`http://127.0.0.1:${handle.port}/data/file.json`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /application\/json/);
    const body = await res.json();
    assert.deepEqual(body, { ok: true });
  } finally {
    await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('createStaticServer ignores query strings when resolving the requested file', async () => {
  const root = await makeFixtureRoot();
  const handle = await createStaticServer({ root, host: '127.0.0.1', port: 0 });
  try {
    const res = await fetch(`http://127.0.0.1:${handle.port}/js/app.js?v=42`);
    assert.equal(res.status, 200);
  } finally {
    await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('createStaticServer responds 404 for a missing file', async () => {
  const root = await makeFixtureRoot();
  const handle = await createStaticServer({ root, host: '127.0.0.1', port: 0 });
  try {
    const res = await fetch(`http://127.0.0.1:${handle.port}/does/not/exist.txt`);
    assert.equal(res.status, 404);
  } finally {
    await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});

function rawGet(port, rawPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: rawPath, method: 'GET' },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

test('createStaticServer blocks ".." path traversal with a 403 or 400', async () => {
  const root = await makeFixtureRoot();
  const handle = await createStaticServer({ root, host: '127.0.0.1', port: 0 });
  try {
    const status = await rawGet(handle.port, '/../package.json');
    assert.ok(status === 403 || status === 400, `expected 403/400, got ${status}`);
  } finally {
    await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('createStaticServer close() releases the port', async () => {
  const root = await makeFixtureRoot();
  const handle = await createStaticServer({ root, host: '127.0.0.1', port: 0 });
  await handle.close();
  await rm(root, { recursive: true, force: true });
  // A second server should be able to bind to an ephemeral port without issue,
  // confirming no lingering handle prevents the process from a clean shutdown.
  const secondRoot = await makeFixtureRoot();
  const secondHandle = await createStaticServer({ root: secondRoot, host: '127.0.0.1', port: 0 });
  await secondHandle.close();
  await rm(secondRoot, { recursive: true, force: true });
});
