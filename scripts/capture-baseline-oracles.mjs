// ============================================================
// Captura de verdade os oráculos de compatibilidade em tests/fixtures/**.
// Delega toda a derivação de valores para scripts/generate-baseline-fixtures.mjs,
// que EXECUTA o código real de site/js/** (moedas.js, ficha-edicoes.js,
// store.js, dados-classes.js) para produzir o conteúdo das fixtures — este
// script não inventa/hand-edita nenhum valor, apenas orquestra quando é
// seguro escrever.
//
// Por padrão roda somente leitura: recomputa o conteúdo real (via
// buildAllFixtures) e VALIDA que bate byte a byte (exceto `generatedAt`)
// com o que está em disco — isto é uma checagem de regressão de verdade,
// não apenas uma checagem de metadado, exatamente para pegar o tipo de bug
// que um valor divergente hand-typed introduziria.
//
// Só escreve (recomputa e regrava o conteúdo completo, com `generatedAt`
// atualizado) quando chamado com `--update`, e nesse caso:
//   1. Executa e aguarda assert-baseline-commit.mjs antes de qualquer
//      escrita. Se o baseline não estiver íntegro, aborta sem tocar em
//      nenhum arquivo.
//   2. Recusa atualizar qualquer fixture cujo compatibilityBaseline ATUAL
//      em disco não seja exatamente o esperado (não sobrescreve fixtures
//      que foram deliberadamente deixadas noutra baseline para revisão).
// ============================================================
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_BASELINE_REF } from './assert-baseline-commit.mjs';
import { buildAllFixtures } from './generate-baseline-fixtures.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const FIXTURES_ROOT = path.join(repoRoot, 'tests', 'fixtures');

/** Lista recursivamente todos os arquivos .json sob `dir` (ordem estável). */
export function listFixtureFiles(dir = FIXTURES_ROOT) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFixtureFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Executa assert-baseline-commit.mjs como processo filho e retorna true se
 * ele saiu com código 0 (baseline íntegro), imprimindo sua saída.
 */
export function runAssertBaselineCommit({ cwd = repoRoot } = {}) {
  const scriptPath = path.join(repoRoot, 'scripts', 'assert-baseline-commit.mjs');
  const result = spawnSync(process.execPath, [scriptPath], { cwd, encoding: 'utf8', stdio: 'pipe' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return (result.status ?? 1) === 0;
}

function stripGeneratedAt(jsonText) {
  if (jsonText == null) return jsonText;
  return jsonText.replace(/"generatedAt":\s*"[^"]*"/, '"generatedAt":""');
}

function readOnDisk(relPath) {
  const full = path.join(repoRoot, relPath);
  if (!fs.existsSync(full)) return { exists: false, raw: null, parsed: null };
  const raw = fs.readFileSync(full, 'utf8');
  try {
    return { exists: true, raw, parsed: JSON.parse(raw) };
  } catch (err) {
    return { exists: true, raw, parsed: null, parseError: err.message };
  }
}

/**
 * Modo somente leitura: recomputa o conteúdo real de cada fixture (execução
 * de site/js/**) e compara com o que está em disco (ignorando apenas
 * `generatedAt`). Retorna um relatório { total, mismatched, missing }.
 */
export async function readOnlyReport(expectedBaseline = DEFAULT_BASELINE_REF) {
  const built = await buildAllFixtures();
  const mismatched = [];
  const missing = [];
  for (const { relPath, content } of built) {
    const rel = path.relative(repoRoot, relPath);
    const onDisk = readOnDisk(rel);
    if (!onDisk.exists) {
      missing.push({ file: rel, reason: 'arquivo ausente em disco' });
      continue;
    }
    if (onDisk.parseError) {
      mismatched.push({ file: rel, reason: `json-parse-error: ${onDisk.parseError}` });
      continue;
    }
    if (onDisk.parsed.compatibilityBaseline !== expectedBaseline) {
      mismatched.push({ file: rel, reason: `compatibilityBaseline=${onDisk.parsed.compatibilityBaseline ?? '(ausente)'}` });
      continue;
    }
    if (stripGeneratedAt(onDisk.raw) !== stripGeneratedAt(content)) {
      mismatched.push({ file: rel, reason: 'conteúdo em disco diverge do que site/js/** produz agora (fixture desatualizada ou editada à mão incorretamente)' });
    }
  }
  return { total: built.length, mismatched, missing };
}

/**
 * Modo de escrita: recomputa e regrava o conteúdo completo de cada fixture
 * cujo compatibilityBaseline ATUAL em disco já seja o esperado. Fixtures
 * cujo compatibilityBaseline em disco for diferente (ou que não existem
 * ainda) são recusadas e reportadas, sem serem escritas — preserva a
 * intenção de não sobrescrever silenciosamente uma fixture deixada
 * deliberadamente noutra baseline para revisão.
 */
export async function updateFixtures(expectedBaseline = DEFAULT_BASELINE_REF) {
  const built = await buildAllFixtures();
  const updated = [];
  const refused = [];
  for (const { relPath, content } of built) {
    const rel = path.relative(repoRoot, relPath);
    const onDisk = readOnDisk(rel);
    if (onDisk.exists && !onDisk.parseError && onDisk.parsed.compatibilityBaseline !== undefined
      && onDisk.parsed.compatibilityBaseline !== expectedBaseline) {
      refused.push({ file: rel, reason: `compatibilityBaseline em disco=${onDisk.parsed.compatibilityBaseline}` });
      continue;
    }
    fs.mkdirSync(path.dirname(relPath), { recursive: true });
    fs.writeFileSync(relPath, content);
    updated.push(rel);
  }
  return { updated, refused };
}

function parseArgs(argv) {
  const update = argv.includes('--update');
  return { update };
}

async function main() {
  const { update } = parseArgs(process.argv.slice(2));

  if (!update) {
    const report = await readOnlyReport(DEFAULT_BASELINE_REF);
    console.log(`[capture-baseline-oracles] modo leitura: ${report.total} fixture(s) recomputada(s) e comparada(s) com o disco.`);
    if (report.missing.length) {
      console.error(`[capture-baseline-oracles] ${report.missing.length} fixture(s) ausente(s):`);
      for (const m of report.missing) console.error(`  - ${m.file}: ${m.reason}`);
    }
    if (report.mismatched.length) {
      console.error(`[capture-baseline-oracles] ${report.mismatched.length} fixture(s) DIVERGENTE(S) do que site/js/** produz agora:`);
      for (const m of report.mismatched) console.error(`  - ${m.file}: ${m.reason}`);
    }
    if (report.missing.length || report.mismatched.length) {
      process.exitCode = 1;
      return;
    }
    console.log('[capture-baseline-oracles] todas as fixtures batem exatamente com o que site/js/** produziria agora.');
    process.exitCode = 0;
    return;
  }

  console.log('[capture-baseline-oracles] modo --update: validando baseline antes de escrever...');
  const baselineOk = runAssertBaselineCommit();
  if (!baselineOk) {
    console.error('[capture-baseline-oracles] ABORTADO: assert-baseline-commit.mjs falhou. Nenhuma fixture foi escrita.');
    process.exitCode = 1;
    return;
  }

  const { updated, refused } = await updateFixtures(DEFAULT_BASELINE_REF);
  console.log(`[capture-baseline-oracles] ${updated.length} fixture(s) recapturada(s) de verdade a partir de site/js/**.`);
  if (refused.length) {
    console.warn(`[capture-baseline-oracles] ${refused.length} fixture(s) recusada(s) (compatibilityBaseline em disco incompatível):`);
    for (const r of refused) console.warn(`  - ${r.file}: ${r.reason}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch(err => {
    console.error('[capture-baseline-oracles] ERRO:', err);
    process.exitCode = 1;
  });
}
