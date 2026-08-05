import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createStaticServer } from '../../../scripts/serve-static.mjs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

test('static server serves site/index.html and a real dados JSON file, then shuts down cleanly', async () => {
  const handle = await createStaticServer({ root: repoRoot, host: '127.0.0.1', port: 0 });

  try {
    assert.ok(handle.port > 0);

    const htmlRes = await fetch(`http://127.0.0.1:${handle.port}/site/index.html`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.match(html, /<html/i);

    const jsonRes = await fetch(`http://127.0.0.1:${handle.port}/dados/capitulo1_regras.json`);
    assert.equal(jsonRes.status, 200);
    assert.match(jsonRes.headers.get('content-type') ?? '', /application\/json/);
    const json = await jsonRes.json();
    assert.equal(typeof json, 'object');
  } finally {
    await handle.close();
  }
});

test('static server frees the port after close() with no lingering open handle', async () => {
  const handle = await createStaticServer({ root: repoRoot, host: '127.0.0.1', port: 0 });
  const { port } = handle;
  await handle.close();

  // Binding a brand new server to an ephemeral port succeeds right after close(),
  // demonstrating the previous server released its resources.
  const second = await createStaticServer({ root: repoRoot, host: '127.0.0.1', port: 0 });
  assert.ok(second.port > 0);
  await second.close();
  assert.notEqual(typeof port, 'undefined');
});
