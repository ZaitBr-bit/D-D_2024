import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyzeDirectory } from '../../../scripts/check-architecture.mjs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

/** Cria um diretório temporário com a estrutura `site/js` fornecida e retorna seu caminho. */
function makeFakeSiteJs(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-check-'));
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return dir;
}

describe('scripts/check-architecture: analyzeDirectory', () => {
  const tempDirs = [];
  after(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('não acusa violação quando apenas site/js/core existe (estado atual do repo)', async () => {
    const dir = makeFakeSiteJs({
      'core/result.js': "export function ok(v) { return v; }\n",
      'core/errors.js': "import { ok } from './result.js';\nexport { ok };\n",
    });
    tempDirs.push(dir);
    const violations = await analyzeDirectory(dir);
    assert.deepEqual(violations, []);
  });

  test('não acusa violação para arquivos monolíticos fora de qualquer camada conhecida', async () => {
    const dir = makeFakeSiteJs({
      'app.js': "import './store.js';\nwindow.alert('x');\n",
      'store.js': "export const x = 1;\n",
    });
    tempDirs.push(dir);
    const violations = await analyzeDirectory(dir);
    assert.deepEqual(violations, []);
  });

  test('proíbe domain/** de importar de infra/ui/features/pages via import estático', async () => {
    const dir = makeFakeSiteJs({
      'domain/regra.js': "import { algo } from '../ui/tela.js';\nexport { algo };\n",
      'ui/tela.js': "export const algo = 1;\n",
    });
    tempDirs.push(dir);
    const violations = await analyzeDirectory(dir);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].rule, 'domain-forbidden-layer-import');
    assert.match(violations[0].file, /domain[\\/]regra\.js$/);
    assert.match(violations[0].detail, /ui/);
  });

  test('proíbe domain/** de importar de infra/ui/features/pages via import dinâmico', async () => {
    const dir = makeFakeSiteJs({
      'domain/regra.js': "export async function carregar() {\n  return import('../infra/db.js');\n}\n",
      'infra/db.js': "export const db = {};\n",
    });
    tempDirs.push(dir);
    const violations = await analyzeDirectory(dir);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].rule, 'domain-forbidden-layer-import');
    assert.match(violations[0].detail, /infra/);
  });

  test('proíbe domain/** de importar de infra/ui/features/pages via import dinâmico com template literal (crase)', async () => {
    const dir = makeFakeSiteJs({
      // eslint-disable-next-line no-template-curly-in-string -- specifier de teste, não interpolação real
      'domain/regra.js': "export async function carregar() {\n  return import(`../infra/db.js`);\n}\n",
      'infra/db.js': "export const db = {};\n",
    });
    tempDirs.push(dir);
    const violations = await analyzeDirectory(dir);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].rule, 'domain-forbidden-layer-import');
    assert.match(violations[0].detail, /infra/);
  });

  test('reporta como violação um import dinâmico com interpolação de template literal (alvo não resolvível estaticamente)', async () => {
    const dir = makeFakeSiteJs({
      'domain/regra.js':
        "export async function carregar(nome) {\n  return import(`../infra/${nome}.js`);\n}\n",
      'infra/db.js': "export const db = {};\n",
    });
    tempDirs.push(dir);
    const violations = await analyzeDirectory(dir);
    // Desde a Task 6, um import dinâmico não resolvível também viola a regra
    // fechada de capacidade oficial (o alvo pode ser um módulo restrito), então
    // a asserção é por regra em vez de por contagem total.
    const naoResolviveis = violations.filter((v) => v.rule === 'dynamic-import-unresolvable');
    assert.equal(naoResolviveis.length, 1);
    assert.match(naoResolviveis[0].file, /domain[\\/]regra\.js$/);
  });

  test('proíbe domain/** de referenciar globais de navegador (window, document, localStorage, fetch, firebase)', async () => {
    const dir = makeFakeSiteJs({
      'domain/regra1.js': "export function f() { return window.innerWidth; }\n",
      'domain/regra2.js': "export function f() { return document.title; }\n",
      'domain/regra3.js': "export function f() { return localStorage.getItem('x'); }\n",
      'domain/regra4.js': "export async function f() { return fetch('/x'); }\n",
      'domain/regra5.js': "import firebase from 'firebase/app';\nexport { firebase };\n",
    });
    tempDirs.push(dir);
    const violations = await analyzeDirectory(dir);
    const rules = violations.map((v) => v.rule);
    // window, document, localStorage, fetch e o identificador "firebase" (que
    // aparece tanto na importação quanto no specifier "firebase/app").
    assert.equal(rules.filter((r) => r === 'domain-forbidden-global').length, 5);
    // a referência ao pacote firebase é pega tanto como global quanto como import de camada externa
    assert.ok(violations.some((v) => /regra5\.js$/.test(v.file) && v.rule === 'domain-forbidden-global'));
    assert.ok(violations.some((v) => /regra5\.js$/.test(v.file) && v.rule === 'domain-forbidden-layer-import'));
  });

  test('não confunde identificadores que contêm as palavras proibidas como substring (ex: documentoAtual)', async () => {
    const dir = makeFakeSiteJs({
      'domain/regra.js': "export function f(documentoAtual, windowSize) { return documentoAtual + windowSize; }\n",
    });
    tempDirs.push(dir);
    const violations = await analyzeDirectory(dir);
    assert.deepEqual(violations, []);
  });

  test('cada violação relatada contém arquivo, import/global proibido e regra violada', async () => {
    const dir = makeFakeSiteJs({
      'domain/regra.js': "import { x } from '../pages/home.js';\nexport { x };\n",
      'pages/home.js': "export const x = 1;\n",
    });
    tempDirs.push(dir);
    const [violation] = await analyzeDirectory(dir);
    assert.ok(violation.file);
    assert.ok(violation.detail);
    assert.ok(violation.rule);
  });

  test('permite domain/** importar de core/** e content/**', async () => {
    const dir = makeFakeSiteJs({
      'domain/regra.js': "import { ok } from '../core/result.js';\nimport { algo } from '../content/glossario.js';\nexport { ok, algo };\n",
      'core/result.js': "export const ok = 1;\n",
      'content/glossario.js': "export const algo = 1;\n",
    });
    tempDirs.push(dir);
    const violations = await analyzeDirectory(dir);
    assert.deepEqual(violations, []);
  });
});

describe('scripts/check-architecture: CLI', () => {
  test('roda contra o repositório real e passa (apenas site/js/core existe hoje)', () => {
    const result = spawnSync(process.execPath, ['scripts/check-architecture.mjs'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`);
  });
});
