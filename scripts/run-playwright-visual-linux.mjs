#!/usr/bin/env node
// ============================================================
// Wrapper protegido para a suíte visual (tests/e2e/visual.spec.js).
// Screenshots só são geradas/comparadas na imagem Linux
// mcr.microsoft.com/playwright:v1.62.0-noble (fontes/anti-aliasing variam
// entre SOs) — este script recusa rodar em qualquer plataforma que não seja
// Linux, mesmo dentro de Docker/CI.
//
// Por padrão roda apenas `tests/e2e/visual.spec.js` nos projetos
// `chromium-desktop` e `chromium-mobile` (os dois definidos no
// playwright.config.js para a suíte visual/@critical). Encaminha somente
// opções explicitamente permitidas — qualquer outra flag é rejeitada, para
// que o wrapper não vire uma porta dos fundos para rodar specs/projetos
// fora do que a suíte visual deveria cobrir.
//
// Com `--update-snapshots`, executa e aguarda assert-baseline-commit.mjs
// ANTES de abrir o Playwright — atualizar baselines exige o repositório no
// commit-baseline com site/dados intactos. Sem essa flag (comparação
// normal), o guard não é chamado: comparar screenshots existentes contra o
// código atual é justamente como a suíte detecta mudanças em site/dados.
// ============================================================
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertBaselineCommit } from './assert-baseline-commit.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const SPEC = 'tests/e2e/visual.spec.js';
const PROJECTS = ['chromium-desktop', 'chromium-mobile'];

const ALLOWED_BOOLEAN_FLAGS = new Set(['--update-snapshots']);
const ALLOWED_VALUE_PREFIXES = ['--reporter='];

/**
 * Valida os argumentos recebidos, permitindo apenas `--update-snapshots` e
 * `--reporter=<valor>`. Qualquer outra flag (ex.: `--project`, `--grep`,
 * `--headed`) é rejeitada explicitamente — o wrapper decide sozinho spec e
 * projetos, e não deve ser possível contorná-los por linha de comando.
 *
 * @param {string[]} argv
 * @returns {{ ok: true, updateSnapshots: boolean, passthrough: string[] } | { ok: false, message: string }}
 */
export function parseArgs(argv) {
  let updateSnapshots = false;
  const passthrough = [];

  for (const arg of argv) {
    if (ALLOWED_BOOLEAN_FLAGS.has(arg)) {
      if (arg === '--update-snapshots') updateSnapshots = true;
      continue;
    }
    if (ALLOWED_VALUE_PREFIXES.some((prefix) => arg.startsWith(prefix))) {
      passthrough.push(arg);
      continue;
    }
    return { ok: false, message: `Opção não permitida: "${arg}". Permitidas: --update-snapshots, --reporter=<valor>.` };
  }

  return { ok: true, updateSnapshots, passthrough };
}

function isLinux() {
  return process.platform === 'linux';
}

function runPlaywright(extraArgs) {
  const playwrightCli = path.join(repoRoot, 'node_modules', '@playwright', 'test', 'cli.js');
  const args = [playwrightCli, 'test', SPEC, ...PROJECTS.map((p) => `--project=${p}`), ...extraArgs];
  const result = spawnSync(process.execPath, args, { cwd: repoRoot, stdio: 'inherit' });
  return result.status ?? 1;
}

function main() {
  if (!isLinux()) {
    console.error(
      `[run-playwright-visual-linux] Recusado: este script só roda em Linux (plataforma atual: "${process.platform}"). ` +
        'Screenshots são geradas/comparadas exclusivamente na imagem mcr.microsoft.com/playwright:v1.62.0-noble.'
    );
    process.exitCode = 1;
    return;
  }

  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(`[run-playwright-visual-linux] ${parsed.message}`);
    process.exitCode = 1;
    return;
  }

  if (parsed.updateSnapshots) {
    const guard = assertBaselineCommit();
    if (!guard.ok) {
      console.error(`[run-playwright-visual-linux] Atualização recusada (${guard.reason}): ${guard.message}`);
      if (guard.details?.status) console.error(guard.details.status);
      process.exitCode = 1;
      return;
    }
    console.log('[run-playwright-visual-linux] Guard OK — atualizando screenshots (--update-snapshots)...');
  } else {
    console.log('[run-playwright-visual-linux] Comparando screenshots existentes com o app atual...');
  }

  const playwrightArgs = [...parsed.passthrough];
  if (parsed.updateSnapshots) playwrightArgs.push('--update-snapshots');

  process.exitCode = runPlaywright(playwrightArgs);
}

const isMainModule =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) main();
