#!/usr/bin/env node
// ============================================================
// Wrapper protegido para capturar/comparar os oráculos de DOM baseline
// (tests/fixtures/dom-baseline/{creator-steps,sheet-sections}.json),
// definindo UPDATE_DOM_BASELINE=1 de forma cross-platform (via `env` do
// processo filho, nunca `VAR=1 cmd`, que não funciona no PowerShell/cmd.exe)
// apenas quando `--update` é passado.
//
// Modo update (--update): chama primeiro assert-baseline-commit.mjs; se o
// repositório não estiver no commit-baseline com site/dados intactos, o
// update é recusado. Só então roda tests/e2e/dom-baseline.spec.js com
// UPDATE_DOM_BASELINE=1, que grava o oráculo da FICHA (ainda legada).
//
// Modo update do criador novo (--update-creator, Task 28b): grava
// tests/fixtures/dom-baseline/creator-steps-v2.json, o oráculo do criador
// depois do cutover. Ele NÃO passa pelo guard de commit-baseline — e não
// poderia: a arquitetura nova do criador só existe FORA do commit-baseline,
// então exigir o guard tornaria a captura impossível por construção. O oráculo
// LEGADO (creator-steps.json) continua congelado no repositório e nunca é
// regravado por nenhum destes modos.
//
// Modo normal (padrão): falha claramente se qualquer um dos dois oráculos
// estiver ausente (nada de rodar uma comparação sem baseline para comparar).
// Caso ambos existam, roda o mesmo spec sem a env var, que recaptura o DOM e
// compara byte a byte com os arquivos gravados.
// ============================================================
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertBaselineCommit } from './assert-baseline-commit.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const SPEC = 'tests/e2e/dom-baseline.spec.js';
const ORACLES = [
  // Congelado (Task 28b): registro do DOM do criador legado, sem produtor.
  path.join(repoRoot, 'tests/fixtures/dom-baseline/creator-steps.json'),
  // Oráculo VIVO do criador novo.
  path.join(repoRoot, 'tests/fixtures/dom-baseline/creator-steps-v2.json'),
  // Congelado (Task 33): registro do DOM da ficha legada, sem produtor.
  path.join(repoRoot, 'tests/fixtures/dom-baseline/sheet-sections.json'),
  // Oráculo VIVO da ficha nova.
  path.join(repoRoot, 'tests/fixtures/dom-baseline/sheet-sections-v2.json')
];

function runPlaywright(extraEnv) {
  const playwrightCli = path.join(repoRoot, 'node_modules', '@playwright', 'test', 'cli.js');
  const result = spawnSync(
    process.execPath,
    [playwrightCli, 'test', SPEC, '--project=chromium-desktop', '--reporter=line'],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, ...extraEnv }
    }
  );
  return result.status ?? 1;
}

function main() {
  const args = process.argv.slice(2);
  const isUpdate = args.includes('--update');
  const isUpdateCreator = args.includes('--update-creator');
  // Task 33: mesmo flag separado do criador, e pela mesma razão — o guard de
  // commit-baseline é impossível de satisfazer para um artefato que só existe
  // DEPOIS do cutover.
  const isUpdateSheet = args.includes('--update-sheet');

  if (isUpdateCreator) {
    console.log('[run-dom-baseline] Capturando o oráculo do criador NOVO (UPDATE_CREATOR_DOM_BASELINE=1)...');
    process.exitCode = runPlaywright({ UPDATE_CREATOR_DOM_BASELINE: '1' });
    return;
  }

  if (isUpdateSheet) {
    console.log('[run-dom-baseline] Capturando o oráculo da FICHA NOVA (UPDATE_SHEET_DOM_BASELINE=1)...');
    process.exitCode = runPlaywright({ UPDATE_SHEET_DOM_BASELINE: '1' });
    return;
  }

  if (isUpdate) {
    const guard = assertBaselineCommit();
    if (!guard.ok) {
      console.error(`[run-dom-baseline] Atualização recusada (${guard.reason}): ${guard.message}`);
      if (guard.details?.status) console.error(guard.details.status);
      process.exitCode = 1;
      return;
    }
    console.log('[run-dom-baseline] Guard OK — capturando oráculos de DOM baseline (UPDATE_DOM_BASELINE=1)...');
    process.exitCode = runPlaywright({ UPDATE_DOM_BASELINE: '1' });
    return;
  }

  const faltando = ORACLES.filter((f) => !fs.existsSync(f));
  if (faltando.length > 0) {
    console.error('[run-dom-baseline] Oráculo(s) de DOM baseline ausente(s):');
    for (const f of faltando) console.error(`  - ${path.relative(repoRoot, f)}`);
    console.error('Rode "npm run test:e2e:update-dom" primeiro (exige o commit-baseline íntegro).');
    process.exitCode = 1;
    return;
  }

  console.log('[run-dom-baseline] Comparando DOM atual com os oráculos gravados...');
  process.exitCode = runPlaywright({ UPDATE_DOM_BASELINE: '0', UPDATE_CREATOR_DOM_BASELINE: '0', UPDATE_SHEET_DOM_BASELINE: '0' });
}

const isMainModule =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) main();
