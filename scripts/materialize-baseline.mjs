#!/usr/bin/env node
// ============================================================
// materialize-baseline (Task 37) — reconstrói a aplicação LEGADA COMPLETA do
// commit-baseline `e43c5ea` (o último antes da refatoração) em
// `.tmp/baseline-e43c5ea/`, usando SOMENTE `git ls-tree` + `git cat-file`
// (leitura do object store): nenhum `checkout`/`reset`/`stash`, o worktree
// do usuário nunca é tocado.
//
// Segurança contra perda de dados: se o diretório de destino JÁ EXISTIR, o
// script RECUSA a execução (exit 1) em vez de apagar/regravar — o conteúdo
// preexistente pode ser do usuário. Quem materializa é responsável por
// remover o diretório depois (`scripts/run-baseline-roundtrip.mjs` remove
// apenas um diretório que ele próprio validou como materialização).
//
// O marcador `.materialized-from` (com o SHA completo do baseline) é gravado
// no destino ao final — é ele que o runner usa para provar que o diretório é
// uma materialização descartável e não outra coisa com o mesmo nome.
// ============================================================

import { mkdir, writeFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { DEFAULT_BASELINE_REF } from './assert-baseline-commit.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** Ref do baseline e destino padrão da materialização. */
export const BASELINE_REF = DEFAULT_BASELINE_REF; // 'e43c5ea'
export const BASELINE_DIR = path.join(repoRoot, '.tmp', `baseline-${BASELINE_REF}`);
export const BASELINE_MARKER = '.materialized-from';

/**
 * Executa um comando git e devolve `{code, stdout, stderr}`; com
 * `binary: true`, `stdout` é um Buffer (necessário para blobs de imagem).
 * Nunca lança.
 * @param {string[]} args
 * @param {{binary?: boolean}} [options]
 * @returns {{code: number, stdout: string|Buffer, stderr: string}}
 */
function runGit(args, { binary = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: binary ? 'buffer' : 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    code: result.status ?? (result.error ? 1 : 0),
    stdout: result.stdout ?? (binary ? Buffer.alloc(0) : ''),
    stderr: String(result.stderr ?? ''),
  };
}

/**
 * Materializa o baseline em `targetDir`. Recusa (`{ok:false}`) quando o
 * diretório já existe, quando o ref não é resolvível (ex.: clone raso sem o
 * commit) ou quando qualquer blob falha.
 * @param {{targetDir?: string, ref?: string}} [options]
 * @returns {Promise<{ok: true, files: number, sha: string} | {ok: false, reason: string, message: string}>}
 */
export async function materializeBaseline({ targetDir = BASELINE_DIR, ref = BASELINE_REF } = {}) {
  // 1. Recusa se o destino já existe (NUNCA apagar conteúdo preexistente).
  try {
    await access(targetDir);
    return {
      ok: false,
      reason: 'target-exists',
      message: `${targetDir} já existe; remova-o manualmente (ou deixe o runner remover uma materialização anterior validada) antes de materializar de novo.`,
    };
  } catch {
    // não existe: prossegue.
  }

  // 2. Resolve o SHA completo (também prova que o commit está disponível —
  //    em CI isso exige checkout com fetch-depth: 0).
  const revParse = runGit(['rev-parse', `${ref}^{commit}`]);
  if (revParse.code !== 0) {
    return {
      ok: false,
      reason: 'ref-unresolvable',
      message: `git não resolve "${ref}" (clone raso? use fetch-depth: 0): ${revParse.stderr}`,
    };
  }
  const sha = String(revParse.stdout).trim();

  // 3. Lista todos os blobs do commit.
  const lsTree = runGit(['ls-tree', '-r', '--name-only', '-z', sha]);
  if (lsTree.code !== 0) {
    return { ok: false, reason: 'ls-tree-failed', message: lsTree.stderr };
  }
  const paths = String(lsTree.stdout).split('\0').filter((p) => p.length > 0);
  if (paths.length === 0) {
    return { ok: false, reason: 'empty-tree', message: `nenhum arquivo em ${ref}` };
  }

  // 4. Escreve cada blob (binário-seguro) preservando a árvore.
  for (const relPath of paths) {
    const blob = runGit(['cat-file', 'blob', `${sha}:${relPath}`], { binary: true });
    if (blob.code !== 0) {
      return { ok: false, reason: 'blob-failed', message: `${relPath}: ${blob.stderr}` };
    }
    const destination = path.join(targetDir, ...relPath.split('/'));
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, blob.stdout);
  }

  // 5. Marcador de materialização (prova de descartabilidade para o runner).
  await writeFile(path.join(targetDir, BASELINE_MARKER), `${sha}\n`, 'utf8');

  return { ok: true, files: paths.length, sha };
}

/**
 * Ponto de entrada de linha de comando.
 * @returns {Promise<number>}
 */
async function main() {
  const result = await materializeBaseline();
  if (result.ok !== true) {
    console.error(`materialize-baseline: RECUSADO (${result.reason}): ${result.message}`);
    return 1;
  }
  console.log(`materialize-baseline: ${result.files} arquivo(s) de ${result.sha} em ${BASELINE_DIR}`);
  return 0;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error('materialize-baseline: falha inesperada.', error);
      process.exit(1);
    },
  );
}
