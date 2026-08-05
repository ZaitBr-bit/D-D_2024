// ============================================================
// Garante que o repositório está em um estado seguro para capturar/atualizar
// os oráculos de compatibilidade (tests/fixtures/**): HEAD precisa conter o
// commit-baseline `e43c5ea` como ancestral, `site` e `dados` não podem ter
// nenhuma alteração (committed depois do baseline, staged ou unstaged) e não
// pode haver arquivos untracked dentro de `site` ou `dados`. Mudanças em
// outros diretórios (docs, tests, scripts) são permitidas.
// ============================================================
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_BASELINE_REF = 'e43c5ea';
export const DEFAULT_GUARDED_PATHS = ['site', 'dados'];

/** Executa um comando git e retorna { code, stdout, stderr }. Nunca lança. */
function runGit(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return {
    code: result.status ?? (result.error ? 1 : 0),
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    error: result.error || null
  };
}

/**
 * Verifica se o estado atual do repositório em `cwd` permite capturar/atualizar
 * os oráculos de compatibilidade em relação a `baselineRef`, olhando apenas
 * para `guardedPaths`.
 *
 * @param {object} [options]
 * @param {string} [options.cwd] - diretório do repositório git (default: process.cwd()).
 * @param {string} [options.baselineRef] - commit-ish do baseline (default: 'e43c5ea').
 * @param {string[]} [options.guardedPaths] - caminhos protegidos (default: ['site', 'dados']).
 * @returns {{ ok: boolean, reason?: string, message?: string, details?: object }}
 */
export function assertBaselineCommit(options = {}) {
  const cwd = options.cwd || process.cwd();
  const baselineRef = options.baselineRef || DEFAULT_BASELINE_REF;
  const guardedPaths = options.guardedPaths || DEFAULT_GUARDED_PATHS;

  const ancestor = runGit(['merge-base', '--is-ancestor', baselineRef, 'HEAD'], cwd);
  if (ancestor.error) {
    return { ok: false, reason: 'git-unavailable', message: `Não foi possível executar git: ${ancestor.error.message}` };
  }
  if (ancestor.code !== 0) {
    return {
      ok: false,
      reason: 'ancestor-missing',
      message: `O commit-baseline ${baselineRef} não é ancestral de HEAD em ${cwd}.`
    };
  }

  const diff = runGit(['diff', '--quiet', baselineRef, '--', ...guardedPaths], cwd);
  if (diff.code !== 0) {
    return {
      ok: false,
      reason: 'tracked-diff',
      message: `Há alterações (committed após o baseline, staged ou unstaged) em ${guardedPaths.join(', ')} em relação a ${baselineRef}.`
    };
  }

  const status = runGit(['status', '--porcelain', '--untracked-files=all', '--', ...guardedPaths], cwd);
  if (status.stdout) {
    return {
      ok: false,
      reason: 'untracked-files',
      message: `Há arquivos untracked em ${guardedPaths.join(', ')}.`,
      details: { status: status.stdout }
    };
  }

  return { ok: true };
}

function main() {
  const result = assertBaselineCommit();
  if (result.ok) {
    console.log(`[assert-baseline-commit] OK — baseline ${DEFAULT_BASELINE_REF} íntegro em ${DEFAULT_GUARDED_PATHS.join(', ')}.`);
    process.exitCode = 0;
  } else {
    console.error(`[assert-baseline-commit] FALHOU (${result.reason}): ${result.message}`);
    if (result.details?.status) console.error(result.details.status);
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) main();
