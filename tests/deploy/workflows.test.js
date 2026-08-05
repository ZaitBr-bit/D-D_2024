// ============================================================
// Task 36 — validação estrutural dos workflows do GitHub Actions
// (.github/workflows/*.yml), usando YAML.parse (nunca regex isolada) para
// asserir triggers, permissões, jobs/uses/needs, checkout fetch-depth: 0,
// versões exatas de toolchain, a matriz obrigatória de ci.yml e a proibição
// de preparação por `cp`/Python inline/`sed` (mecanismo antigo que este
// workflow substitui pelo build:pages/verify:pages determinístico).
// ============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const workflowsDir = path.join(repoRoot, '.github', 'workflows');

/**
 * Lê e faz o parse de um workflow YAML pelo nome do arquivo.
 * @param {string} filename
 * @returns {Promise<object>}
 */
async function loadWorkflow(filename) {
  const raw = await readFile(path.join(workflowsDir, filename), 'utf8');
  return YAML.parse(raw);
}

test('YAML.parse falha (fixture textual) para YAML inválido — prova que a validação usa parser real, não regex', () => {
  const invalido = 'jobs:\n  foo:\n  - a\n  bar: [1, 2\n'; // colchete não fechado
  assert.throws(() => YAML.parse(invalido));
});

test('todo .github/workflows/*.yml tem YAML válido e um campo "name"', async () => {
  const entries = (await readdir(workflowsDir, { withFileTypes: true }))
    .filter((e) => e.isFile() && /\.ya?ml$/.test(e.name));
  assert.ok(entries.length > 0, 'esperava pelo menos um workflow em .github/workflows');

  for (const entry of entries) {
    const raw = await readFile(path.join(workflowsDir, entry.name), 'utf8');
    let parsed;
    assert.doesNotThrow(() => { parsed = YAML.parse(raw); }, `${entry.name} deveria ser YAML válido`);
    assert.equal(typeof parsed.name, 'string', `${entry.name} deveria ter "name"`);
    assert.ok(parsed.name.length > 0, `${entry.name}: "name" não pode ser vazio`);
  }
});

test('ci.yml: workflow_call reutilizável, também acionado em push/pull_request, com a matriz de jobs exigida', async () => {
  const wf = await loadWorkflow('ci.yml');

  // `on:` é lido como chave `true` pelo parser YAML 1.1 (palavra reservada) —
  // YAML.parse (yaml@2) preserva a chave literal 'on', então acessamos direto.
  const on = wf.on;
  assert.ok(on, 'ci.yml precisa de "on"');
  assert.ok('push' in on, 'ci.yml precisa disparar em push');
  assert.ok('pull_request' in on, 'ci.yml precisa disparar em pull_request');
  assert.ok('workflow_call' in on, 'ci.yml precisa ser reutilizável (workflow_call)');

  assert.equal(wf.env?.NODE_VERSION, '22.17.1', 'Node exato 22.17.1');
  assert.equal(wf.env?.PYTHON_VERSION, '3.12', 'Python exato 3.12 (contrato do extrator)');
  assert.equal(wf.env?.JAVA_VERSION, '21', 'Java 21 (Firestore Emulator)');

  const jobs = wf.jobs;
  assert.ok(jobs, 'ci.yml precisa de "jobs"');

  // Matriz obrigatória: Node/dados/deploy, Firestore Emulator (Java) e browser (Playwright).
  const jobNames = Object.keys(jobs);
  assert.ok(jobNames.some((n) => /node|data|deploy/i.test(n)), 'esperava um job Node/data/deploy');
  assert.ok(jobNames.some((n) => /firestore|firebase/i.test(n)), 'esperava um job de Firestore Emulator');
  assert.ok(jobNames.some((n) => /browser/i.test(n)), 'esperava um job browser');

  for (const [jobName, job] of Object.entries(jobs)) {
    const steps = job.steps ?? [];
    const checkoutStep = steps.find((s) => typeof s.uses === 'string' && s.uses.startsWith('actions/checkout'));
    assert.ok(checkoutStep, `${jobName}: precisa de um step actions/checkout`);
    assert.equal(checkoutStep.with?.['fetch-depth'], 0, `${jobName}: checkout precisa de fetch-depth: 0`);
  }

  // Job Firestore Emulator usa Java 21.
  const firestoreJob = jobs[jobNames.find((n) => /firestore|firebase/i.test(n))];
  const javaStep = firestoreJob.steps.find((s) => typeof s.uses === 'string' && s.uses.startsWith('actions/setup-java'));
  assert.ok(javaStep, 'job Firestore Emulator precisa de actions/setup-java');
  // O YAML referencia `${{ env.JAVA_VERSION }}` (expressão), não o valor
  // literal — o parser YAML não resolve expressões do GitHub Actions.
  assert.match(String(javaStep.with?.['java-version']), /JAVA_VERSION/);

  // Job browser usa a imagem oficial do Playwright pinada, roda funcional +
  // visual + PWA, e nunca atualiza screenshots.
  const browserJob = jobs[jobNames.find((n) => /browser/i.test(n))];
  assert.equal(browserJob.container?.image, 'mcr.microsoft.com/playwright:v1.62.0-noble');
  const runCommands = (browserJob.steps ?? []).map((s) => s.run).filter(Boolean).join('\n');
  assert.match(runCommands, /test:e2e\b/);
  assert.match(runCommands, /test:e2e:visual/);
  assert.match(runCommands, /test:e2e:pwa/);
  // Task 37: o round-trip de compatibilidade com o baseline e43c5ea roda no
  // job browser; `materialize-baseline.mjs` depende de `git show e43c5ea`,
  // o que o fetch-depth: 0 (já exigido acima para todos os jobs) garante.
  assert.match(runCommands, /test:e2e:compat/);
  assert.doesNotMatch(runCommands, /--update-snapshots/, 'screenshots nunca são atualizados no CI');

  // Task 37: os dois checks novos rodam no job Node reutilizável.
  const nodeJob = jobs[jobNames.find((n) => /node|data|deploy/i.test(n))];
  const nodeRuns = (nodeJob.steps ?? []).map((s) => s.run).filter(Boolean).join('\n');
  assert.match(nodeRuns, /check:entrypoints/);
  assert.match(nodeRuns, /check:inline-handlers/);

  // Preparação legada proibida em qualquer step de qualquer job.
  const todoORun = Object.values(jobs).flatMap((j) => j.steps ?? []).map((s) => s.run).filter(Boolean).join('\n');
  assert.doesNotMatch(todoORun, /\bcp\s+-r\b/, 'proibido "cp -r" (mecanismo antigo)');
  assert.doesNotMatch(todoORun, /python3\s*-\s*<</, 'proibido Python inline (mecanismo antigo)');
  assert.doesNotMatch(todoORun, /\bsed\s+-i\b/, 'proibido "sed -i" (mecanismo antigo)');
  assert.match(todoORun, /build:pages/, 'precisa usar o pipeline determinístico build:pages');
  assert.match(todoORun, /verify:pages/, 'precisa usar o pipeline determinístico verify:pages');
});

test('deploy.yml: job "deploy" depende do workflow reutilizável (needs: verify) e usa build:pages/verify:pages', async () => {
  const wf = await loadWorkflow('deploy.yml');

  assert.ok('push' in wf.on, 'deploy.yml precisa disparar em push');
  assert.deepEqual(wf.on.push.branches, ['main'], 'deploy só em push para main');

  const jobs = wf.jobs;
  assert.ok(jobs.verify, 'deploy.yml precisa de um job "verify"');
  assert.equal(jobs.verify.uses, './.github/workflows/ci.yml', 'job verify precisa chamar o workflow reutilizável');

  assert.ok(jobs.deploy, 'deploy.yml precisa de um job "deploy"');
  const needs = Array.isArray(jobs.deploy.needs) ? jobs.deploy.needs : [jobs.deploy.needs];
  assert.ok(needs.includes('verify'), 'job deploy precisa de needs: verify — nunca publica se a verificação falhar');

  const deploySteps = jobs.deploy.steps ?? [];
  const checkoutStep = deploySteps.find((s) => typeof s.uses === 'string' && s.uses.startsWith('actions/checkout'));
  assert.ok(checkoutStep, 'job deploy precisa de checkout');
  assert.equal(checkoutStep.with?.['fetch-depth'], 0);

  const nodeStep = deploySteps.find((s) => typeof s.uses === 'string' && s.uses.startsWith('actions/setup-node'));
  assert.equal(nodeStep?.with?.['node-version'], '22.17.1');

  const runCommands = deploySteps.map((s) => s.run).filter(Boolean).join('\n');
  assert.match(runCommands, /npm ci/);
  assert.match(runCommands, /npm run build:pages -- --out _dist --version/);
  assert.match(runCommands, /npm run verify:pages -- --dir _dist/);
  assert.doesNotMatch(runCommands, /\bcp\s+-r\b/, 'proibido "cp -r" (mecanismo antigo)');
  assert.doesNotMatch(runCommands, /python3\s*-\s*<</, 'proibido Python inline (mecanismo antigo)');
  assert.doesNotMatch(runCommands, /\bsed\s+-i\b/, 'proibido "sed -i" (mecanismo antigo)');

  // Upload/deploy só acontecem no job "deploy" (que só roda em push para main
  // por causa do gatilho de topo — não há filtro condicional de branch
  // adicional necessário porque `on.push.branches` já restringe a main).
  const usesList = deploySteps.map((s) => s.uses).filter(Boolean);
  assert.ok(usesList.some((u) => u.startsWith('actions/upload-pages-artifact')));
  assert.ok(usesList.some((u) => u.startsWith('actions/deploy-pages')));

  assert.deepEqual(wf.permissions, { contents: 'read', pages: 'write', 'id-token': 'write' });
});
