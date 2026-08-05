import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertBaselineCommit } from '../../../scripts/assert-baseline-commit.mjs';

/** Executa git de forma síncrona num repo temporário, falhando o teste se o comando falhar. */
function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return (result.stdout || '').trim();
}

function initRepo(dir) {
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'test@example.invalid']);
  git(dir, ['config', 'user.name', 'Test Runner']);
}

function writeFile(dir, relPath, content) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function commitAll(dir, message) {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
  return git(dir, ['rev-parse', 'HEAD']);
}

describe('assertBaselineCommit', () => {
  let repoDir;

  before(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-commit-'));
    initRepo(repoDir);
  });

  after(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  test('accepts a repo where HEAD is exactly the baseline and site/dados are clean', () => {
    writeFile(repoDir, 'site/js/store.js', 'export const x = 1;\n');
    writeFile(repoDir, 'dados/glossario.json', '{}\n');
    writeFile(repoDir, 'README.md', '# repo\n');
    const baseline = commitAll(repoDir, 'baseline');

    const result = assertBaselineCommit({ cwd: repoDir, baselineRef: baseline });
    assert.equal(result.ok, true);
  });

  test('rejects when the baseline ref does not exist at all (bad object)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-commit-orphan-'));
    try {
      initRepo(dir);
      writeFile(dir, 'site/js/store.js', 'export const x = 1;\n');
      commitAll(dir, 'unrelated commit');
      const fakeBaseline = '0'.repeat(40);

      const result = assertBaselineCommit({ cwd: dir, baselineRef: fakeBaseline });
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'ancestor-missing');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects when the baseline ref is a real, existing commit that diverged onto another branch (not an ancestor of HEAD)', () => {
    // Exercita o caminho de divergência real de `git merge-base --is-ancestor`
    // (exit code 1, "não é ancestral") em vez do caminho de objeto
    // inexistente (exit code 128, coberto pelo teste acima) — são dois
    // motivos de falha distintos internamente ao git, e a asserção da
    // função só teria sido comprovada contra o segundo sem este caso.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-commit-diverged-'));
    try {
      initRepo(dir);
      writeFile(dir, 'site/js/store.js', 'export const x = 1;\n');
      const initialBranch = git(dir, ['branch', '--show-current']);
      commitAll(dir, 'common ancestor');

      git(dir, ['checkout', '-b', 'baseline-branch']);
      writeFile(dir, 'site/js/other.js', 'export const y = 1;\n');
      commitAll(dir, 'commit that only exists on baseline-branch');
      const diveredBaselineCommitSha = git(dir, ['rev-parse', 'HEAD']);

      git(dir, ['checkout', initialBranch]);
      writeFile(dir, 'site/js/store.js', 'export const x = 2;\n');
      commitAll(dir, 'diverged commit on the original branch');

      const result = assertBaselineCommit({ cwd: dir, baselineRef: diveredBaselineCommitSha });
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'ancestor-missing');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects a tracked change committed after the baseline inside a guarded path', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-commit-committed-'));
    try {
      initRepo(dir);
      writeFile(dir, 'site/js/store.js', 'export const x = 1;\n');
      writeFile(dir, 'dados/glossario.json', '{}\n');
      const baseline = commitAll(dir, 'baseline');

      writeFile(dir, 'site/js/store.js', 'export const x = 2;\n');
      commitAll(dir, 'later change to site');

      const result = assertBaselineCommit({ cwd: dir, baselineRef: baseline });
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'tracked-diff');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects a staged (not yet committed) change in a guarded path', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-commit-staged-'));
    try {
      initRepo(dir);
      writeFile(dir, 'site/js/store.js', 'export const x = 1;\n');
      const baseline = commitAll(dir, 'baseline');

      writeFile(dir, 'site/js/store.js', 'export const x = 3;\n');
      git(dir, ['add', 'site/js/store.js']);

      const result = assertBaselineCommit({ cwd: dir, baselineRef: baseline });
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'tracked-diff');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects an unstaged (working-tree only) change in a guarded path', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-commit-unstaged-'));
    try {
      initRepo(dir);
      writeFile(dir, 'dados/glossario.json', '{}\n');
      const baseline = commitAll(dir, 'baseline');

      writeFile(dir, 'dados/glossario.json', '{"alterado":true}\n');

      const result = assertBaselineCommit({ cwd: dir, baselineRef: baseline });
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'tracked-diff');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects an untracked file inside site/', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-commit-untracked-site-'));
    try {
      initRepo(dir);
      writeFile(dir, 'site/js/store.js', 'export const x = 1;\n');
      const baseline = commitAll(dir, 'baseline');

      writeFile(dir, 'site/js/novo-arquivo-runtime.js', 'export const y = 1;\n');

      const result = assertBaselineCommit({ cwd: dir, baselineRef: baseline });
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'untracked-files');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects an untracked file inside dados/', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-commit-untracked-dados-'));
    try {
      initRepo(dir);
      writeFile(dir, 'dados/glossario.json', '{}\n');
      const baseline = commitAll(dir, 'baseline');

      writeFile(dir, 'dados/novo_arquivo.json', '{}\n');

      const result = assertBaselineCommit({ cwd: dir, baselineRef: baseline });
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'untracked-files');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('accepts changes that only touch docs/tests outside the guarded paths', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-commit-docs-only-'));
    try {
      initRepo(dir);
      writeFile(dir, 'site/js/store.js', 'export const x = 1;\n');
      writeFile(dir, 'dados/glossario.json', '{}\n');
      const baseline = commitAll(dir, 'baseline');

      writeFile(dir, 'tests/contract/novo.test.js', '// novo teste\n');
      writeFile(dir, 'docs/notas.md', '# notas\n');
      commitAll(dir, 'docs and tests only');

      const result = assertBaselineCommit({ cwd: dir, baselineRef: baseline });
      assert.equal(result.ok, true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
