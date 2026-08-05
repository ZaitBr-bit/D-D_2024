#!/usr/bin/env node
// ============================================================
// test:e2e:compat (Task 37) — orquestra o round-trip de compatibilidade
// contra o baseline `e43c5ea`:
//
//   1. materializa o baseline em `.tmp/baseline-e43c5ea/`
//      (scripts/materialize-baseline.mjs — recusa se o diretório já existir,
//      para nunca apagar conteúdo preexistente do usuário);
//   2. roda `playwright test --config=playwright.compat.config.js` (dois
//      webServers: app novo em 4173, baseline em 4175; só Chromium desktop);
//   3. remove APENAS a materialização validada: o diretório só é apagado se
//      contiver o marcador `.materialized-from` com o SHA do baseline — se o
//      marcador não bater, o diretório fica intacto e o script reporta.
//
// O exit code é o do Playwright (falha de teste => falha do comando), e a
// limpeza acontece em sucesso E em falha (o diretório é reproduzível a
// qualquer momento a partir do object store do git).
// ============================================================

import { readFile, rm, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { materializeBaseline, BASELINE_DIR, BASELINE_MARKER } from './materialize-baseline.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/**
 * Remove o diretório da materialização SOMENTE se o marcador
 * `.materialized-from` existir e registrar o SHA esperado. Devolve `true`
 * quando removeu.
 * @param {string} expectedSha - SHA completo gravado pela materialização.
 * @returns {Promise<boolean>}
 */
async function removerMaterializacaoValidada(expectedSha) {
  const markerPath = path.join(BASELINE_DIR, BASELINE_MARKER);
  let recorded;
  try {
    recorded = (await readFile(markerPath, 'utf8')).trim();
  } catch {
    console.error(`run-baseline-roundtrip: ${BASELINE_DIR} não tem o marcador ${BASELINE_MARKER}; NÃO será removido.`);
    return false;
  }
  if (recorded !== expectedSha) {
    console.error(`run-baseline-roundtrip: marcador de ${BASELINE_DIR} registra "${recorded}", esperado "${expectedSha}"; NÃO será removido.`);
    return false;
  }
  await rm(BASELINE_DIR, { recursive: true, force: true });
  return true;
}

/**
 * Ponto de entrada: materializa, executa o Playwright compat e limpa.
 * @returns {Promise<number>}
 */
async function main() {
  // Pré-checagem amigável: se restou uma materialização de execução anterior
  // VALIDÁVEL pelo marcador, remove antes (é descartável por construção);
  // qualquer outra coisa com o mesmo nome interrompe com instrução manual.
  let jaExiste = false;
  try {
    await access(BASELINE_DIR);
    jaExiste = true;
  } catch {
    // não existe: seguirá para a materialização.
  }
  if (jaExiste) {
    const marker = path.join(BASELINE_DIR, BASELINE_MARKER);
    let recorded = null;
    try {
      recorded = (await readFile(marker, 'utf8')).trim();
    } catch {
      // sem marcador: não é uma materialização nossa.
    }
    if (recorded === null) {
      console.error(`run-baseline-roundtrip: ${BASELINE_DIR} existe e NÃO é uma materialização (sem ${BASELINE_MARKER}). Remova manualmente e rode de novo.`);
      return 1;
    }
    console.log(`run-baseline-roundtrip: removendo materialização anterior (${recorded}).`);
    await rm(BASELINE_DIR, { recursive: true, force: true });
  }

  const materialized = await materializeBaseline();
  if (materialized.ok !== true) {
    console.error(`run-baseline-roundtrip: materialização recusada (${materialized.reason}): ${materialized.message}`);
    return 1;
  }
  console.log(`run-baseline-roundtrip: baseline ${materialized.sha} materializado (${materialized.files} arquivos).`);

  let exitCode = 1;
  try {
    // Invoca o CLI do Playwright por caminho direto (sem `npx`/shell): o
    // diretório deste repositório contém `&` no nome, que quebra o
    // roteamento via cmd.exe no Windows (mesmo padrão já usado por
    // scripts/run-dom-baseline.mjs).
    const playwrightCli = path.join(repoRoot, 'node_modules', '@playwright', 'test', 'cli.js');
    const result = spawnSync(
      process.execPath,
      [playwrightCli, 'test', '--config=playwright.compat.config.js'],
      { cwd: repoRoot, stdio: 'inherit' },
    );
    exitCode = result.status ?? 1;
  } finally {
    const removed = await removerMaterializacaoValidada(materialized.sha);
    if (removed) {
      console.log('run-baseline-roundtrip: materialização removida.');
    }
  }
  return exitCode;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error('run-baseline-roundtrip: falha inesperada.', error);
      process.exit(1);
    },
  );
}
