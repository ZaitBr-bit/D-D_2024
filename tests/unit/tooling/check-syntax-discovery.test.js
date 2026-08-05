// ============================================================
// Task 37: `scripts/check-syntax.mjs` precisa DESCOBRIR e validar o config
// do round-trip de compatibilidade (`playwright.compat.config.js`), junto
// com os demais `playwright*.config.js` da raiz — um config com erro de
// sintaxe reprovaria só na hora de rodar a suíte, tarde demais.
// ============================================================
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { discoverFilesToCheck } from '../../../scripts/check-syntax.mjs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

describe('check-syntax: descoberta dos configs Playwright da raiz', () => {
  test('descobre os TRÊS configs, incluindo playwright.compat.config.js', async () => {
    const files = await discoverFilesToCheck();
    const basenames = files.map((file) => path.basename(file));
    for (const config of ['playwright.config.js', 'playwright.pwa.config.js', 'playwright.compat.config.js']) {
      assert.ok(basenames.includes(config), `${config} não foi descoberto por check-syntax`);
    }
  });

  test('playwright.compat.config.js passa no `node --check` (o mesmo usado pelo script)', () => {
    const result = spawnSync(process.execPath, ['--check', path.join(repoRoot, 'playwright.compat.config.js')], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
  });
});
