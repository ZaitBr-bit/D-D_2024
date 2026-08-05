// ============================================================
// Testes de `scripts/check-thin-entrypoints.mjs` (Task 37): as regras que
// mantêm os composition roots públicos finos, exercitadas sobre fontes
// sintéticos (função pura) e sobre os DOIS arquivos reais do worktree.
// ============================================================
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeThinEntrypoint, THIN_ENTRYPOINTS } from '../../../scripts/check-thin-entrypoints.mjs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

/** Fonte mínimo de um entrypoint fino válido. */
const FONTE_FINO = `
import { ok } from '../core/result.js';
export async function renderCreator(container) {
  return ok(() => {});
}
`;

describe('check-thin-entrypoints: regras sobre fonte sintético', () => {
  test('um entrypoint fino não gera violação', () => {
    assert.deepEqual(analyzeThinEntrypoint(FONTE_FINO, { entry: 'renderCreator' }), []);
  });

  test('exportação extra é violação only-entry-export', () => {
    const fonte = FONTE_FINO + '\nexport function ajudante() {}\n';
    const regras = analyzeThinEntrypoint(fonte, { entry: 'renderCreator' }).map((v) => v.rule);
    assert.ok(regras.includes('only-entry-export'));
  });

  test('export default / export const são violação (singleton)', () => {
    const fonte = FONTE_FINO + '\nexport const estado = {};\n';
    const regras = analyzeThinEntrypoint(fonte, { entry: 'renderCreator' }).map((v) => v.rule);
    assert.ok(regras.includes('only-entry-export'));
  });

  test('template literal com tag HTML é violação no-template', () => {
    const fonte = FONTE_FINO.replace('return ok(() => {});', 'const html = `<div>oi</div>`;\n  return ok(() => {});');
    const regras = analyzeThinEntrypoint(fonte, { entry: 'renderCreator' }).map((v) => v.rule);
    assert.ok(regras.includes('no-template'));
  });

  test('innerHTML é violação no-template', () => {
    const fonte = FONTE_FINO.replace('return ok(() => {});', 'container.innerHTML = x;\n  return ok(() => {});');
    const regras = analyzeThinEntrypoint(fonte, { entry: 'renderCreator' }).map((v) => v.rule);
    assert.ok(regras.includes('no-template'));
  });

  test('nome de conteúdo em string é violação no-content-names', () => {
    const fonte = FONTE_FINO.replace('return ok(() => {});', "const c = 'Mago';\n  return ok(() => {});");
    const regras = analyzeThinEntrypoint(fonte, { entry: 'renderCreator' }).map((v) => v.rule);
    assert.ok(regras.includes('no-content-names'));
  });

  test('ContentId literal (dnd2024:) é violação no-content-names', () => {
    const fonte = FONTE_FINO.replace('return ok(() => {});', "const ref = 'dnd2024:class:mago';\n  return ok(() => {});");
    const regras = analyzeThinEntrypoint(fonte, { entry: 'renderCreator' }).map((v) => v.rule);
    assert.ok(regras.includes('no-content-names'));
  });

  test('símbolo de regra do monólito é violação no-game-rules', () => {
    const fonte = FONTE_FINO.replace('return ok(() => {});', 'const pv = calcPVNivel1(1);\n  return ok(() => {});');
    const regras = analyzeThinEntrypoint(fonte, { entry: 'renderCreator' }).map((v) => v.rule);
    assert.ok(regras.includes('no-game-rules'));
  });

  test('`let` no escopo do módulo é violação no-module-state', () => {
    const fonte = 'let cache = null;\n' + FONTE_FINO;
    const regras = analyzeThinEntrypoint(fonte, { entry: 'renderCreator' }).map((v) => v.rule);
    assert.ok(regras.includes('no-module-state'));
  });

  test('comentários mencionando o proibido NÃO são violação', () => {
    const fonte = '// o monólito usava innerHTML e `<div>` e CLASSES_INFO\n' + FONTE_FINO;
    assert.deepEqual(analyzeThinEntrypoint(fonte, { entry: 'renderCreator' }), []);
  });
});

describe('check-thin-entrypoints: os dois entrypoints reais continuam finos', () => {
  for (const { file, entry } of THIN_ENTRYPOINTS) {
    test(`${file} exporta só ${entry} e não tem template/regra/estado`, async () => {
      const source = await readFile(path.join(repoRoot, file), 'utf8');
      assert.deepEqual(analyzeThinEntrypoint(source, { entry }), []);
    });
  }
});
