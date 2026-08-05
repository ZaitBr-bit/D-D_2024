// ============================================================
// Contrato do workflow .github/workflows/visual-baseline.yml: valida
// sintaxe/estrutura via YAML.parse — branch/path exatos do gatilho por
// push do próprio arquivo, gatilho por tag, workflow_dispatch, permissão
// read-only, imagem/Node exatos, checkout com history completo, o guard
// rodando antes dos dois passos de atualização (DOM baseline + visual), as
// comparações normais (sem update) depois, a publicação como artifact e a
// ausência de qualquer permissão/passo de escrita no repositório
// (commit/push).
// ============================================================
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const WORKFLOW_PATH = path.join(repoRoot, '.github/workflows/visual-baseline.yml');

function loadWorkflow() {
  const raw = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  return YAML.parse(raw);
}

/** Índice do primeiro step cujo `run` contenha `agulha` (substring), ou -1. */
function indiceDoStepComRun(steps, agulha) {
  return steps.findIndex((s) => typeof s.run === 'string' && s.run.includes(agulha));
}

describe('visual-baseline.yml — contrato do workflow', () => {
  test('o arquivo existe e é YAML válido', () => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'workflow ausente em .github/workflows/visual-baseline.yml');
    const wf = loadWorkflow();
    assert.equal(typeof wf, 'object');
    assert.ok(wf !== null);
  });

  test('gatilho por push do próprio arquivo, na branch refatoracao, com path exato', () => {
    const wf = loadWorkflow();
    // A chave YAML `on` é lida pelo parser como booleano `true` (YAML 1.1) a
    // menos que o arquivo a escreva como string — o parser `yaml` moderno
    // (YAML 1.2, core schema) preserva `on` como string-chave normalmente,
    // mas cobrimos as duas variantes por robustez.
    const on = wf.on ?? wf['true'] ?? wf[true];
    assert.ok(on, 'workflow sem seção "on"');
    assert.ok(on.push, 'workflow sem gatilho "push"');
    assert.deepEqual(on.push.branches, ['refatoracao']);
    assert.deepEqual(on.push.paths, ['.github/workflows/visual-baseline.yml']);
  });

  test('gatilho por push de tag visual-baseline-* (path filters não se aplicam a tags)', () => {
    const wf = loadWorkflow();
    const on = wf.on ?? wf['true'] ?? wf[true];
    assert.deepEqual(on.push.tags, ['visual-baseline-*']);
  });

  test('workflow_dispatch habilitado', () => {
    const wf = loadWorkflow();
    const on = wf.on ?? wf['true'] ?? wf[true];
    assert.ok('workflow_dispatch' in on, 'workflow sem gatilho manual workflow_dispatch');
  });

  test('permissão read-only: contents: read, e nenhuma outra permissão concedida', () => {
    const wf = loadWorkflow();
    assert.ok(wf.permissions, 'workflow sem bloco "permissions" explícito');
    assert.equal(wf.permissions.contents, 'read');
    const outrasPermissoes = Object.keys(wf.permissions).filter((k) => k !== 'contents');
    assert.deepEqual(outrasPermissoes, [], `permissões extras não esperadas: ${outrasPermissoes.join(', ')}`);
  });

  test('roda em container com a imagem Linux pinada exata', () => {
    const wf = loadWorkflow();
    const jobs = Object.values(wf.jobs || {});
    assert.ok(jobs.length >= 1, 'workflow sem jobs');
    const job = jobs[0];
    assert.equal(job.container?.image, 'mcr.microsoft.com/playwright:v1.62.0-noble');
  });

  test('checkout com fetch-depth: 0 (history completo) e Node 22.17.1', () => {
    const wf = loadWorkflow();
    const job = Object.values(wf.jobs)[0];
    const steps = job.steps;

    const checkout = steps.find((s) => (s.uses || '').startsWith('actions/checkout@'));
    assert.ok(checkout, 'nenhum step de checkout encontrado');
    assert.equal(checkout.with?.['fetch-depth'], 0);

    const setupNode = steps.find((s) => (s.uses || '').startsWith('actions/setup-node@'));
    assert.ok(setupNode, 'nenhum step de setup-node encontrado');
    assert.equal(setupNode.with?.['node-version'], '22.17.1');
  });

  test('guard (assert-baseline-commit) roda antes dos dois passos de atualização', () => {
    const wf = loadWorkflow();
    const steps = Object.values(wf.jobs)[0].steps;

    const guardIdx = indiceDoStepComRun(steps, 'assert-baseline-commit.mjs');
    const updateDomIdx = indiceDoStepComRun(steps, 'test:e2e:update-dom');
    const updateSnapshotsIdx = indiceDoStepComRun(steps, 'test:e2e:update-snapshots');

    assert.notEqual(guardIdx, -1, 'nenhum step chama scripts/assert-baseline-commit.mjs');
    assert.notEqual(updateDomIdx, -1, 'nenhum step roda test:e2e:update-dom');
    assert.notEqual(updateSnapshotsIdx, -1, 'nenhum step roda test:e2e:update-snapshots');

    assert.ok(guardIdx < updateDomIdx, 'guard precisa rodar antes de test:e2e:update-dom');
    assert.ok(guardIdx < updateSnapshotsIdx, 'guard precisa rodar antes de test:e2e:update-snapshots');
  });

  test('comparações normais (sem update) de DOM e visual rodam depois das capturas, na mesma imagem', () => {
    const wf = loadWorkflow();
    const steps = Object.values(wf.jobs)[0].steps;

    const updateDomIdx = indiceDoStepComRun(steps, 'test:e2e:update-dom');
    const updateSnapshotsIdx = indiceDoStepComRun(steps, 'test:e2e:update-snapshots');

    // "test:e2e:dom" e "test:e2e:visual" sem sufixo -update-/-snapshots.
    const normalDomIdx = steps.findIndex(
      (s) => typeof s.run === 'string' && /\btest:e2e:dom\b/.test(s.run) && !s.run.includes('update')
    );
    const normalVisualIdx = steps.findIndex(
      (s) => typeof s.run === 'string' && /\btest:e2e:visual\b/.test(s.run) && !s.run.includes('update')
    );

    assert.notEqual(normalDomIdx, -1, 'nenhum step roda a comparação normal test:e2e:dom');
    assert.notEqual(normalVisualIdx, -1, 'nenhum step roda a comparação normal test:e2e:visual');
    assert.ok(normalDomIdx > updateDomIdx, 'test:e2e:dom (normal) deve rodar depois de test:e2e:update-dom');
    assert.ok(
      normalVisualIdx > updateSnapshotsIdx,
      'test:e2e:visual (normal) deve rodar depois de test:e2e:update-snapshots'
    );

    // Mesmo job == mesma imagem Linux (não há um segundo job/matrix trocando de runner).
    assert.equal(Object.keys(wf.jobs).length, 1, 'esperado um único job (mesma imagem Linux para tudo)');
  });

  test('publica os dois oráculos e os screenshots como artifact', () => {
    const wf = loadWorkflow();
    const steps = Object.values(wf.jobs)[0].steps;
    const upload = steps.find((s) => (s.uses || '').startsWith('actions/upload-artifact@'));
    assert.ok(upload, 'nenhum step de upload-artifact encontrado');

    const pathsRaw = upload.with?.path;
    assert.ok(pathsRaw, 'step de upload-artifact sem "path"');
    const paths = Array.isArray(pathsRaw) ? pathsRaw : String(pathsRaw).split('\n').map((s) => s.trim()).filter(Boolean);

    assert.ok(paths.some((p) => p.includes('tests/fixtures/dom-baseline')), 'artifact não inclui os oráculos de DOM baseline');
    assert.ok(paths.some((p) => p.includes('tests/e2e/__screenshots__')), 'artifact não inclui os screenshots');
  });

  test('nenhum step de commit/push — o workflow nunca escreve no repositório', () => {
    const wf = loadWorkflow();
    const steps = Object.values(wf.jobs)[0].steps;

    for (const step of steps) {
      const run = typeof step.run === 'string' ? step.run : '';
      assert.ok(!/git\s+commit/.test(run), `step "${step.name}" executa git commit`);
      assert.ok(!/git\s+push/.test(run), `step "${step.name}" executa git push`);
      const uses = step.uses || '';
      assert.ok(
        !uses.toLowerCase().includes('git-auto-commit') && !uses.toLowerCase().includes('create-pull-request'),
        `step "${step.name}" usa uma action de escrita no repositório (${uses})`
      );
    }
  });
});
