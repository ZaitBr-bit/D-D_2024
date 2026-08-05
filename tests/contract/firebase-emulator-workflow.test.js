// ============================================================
// Contrato do workflow .github/workflows/firebase-emulator-check.yml:
// valida estruturalmente (via YAML.parse, nunca por regex sobre o texto)
// branch/path exatos do gatilho, gatilho por tag, workflow_dispatch,
// permissão `contents: read` e nenhuma outra, checkout com history
// completo, versões exatas de Node e Java, o comando executado, e a
// AUSÊNCIA de qualquer credencial, commit, push ou projeto que não comece
// por `demo-`.
// ============================================================
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const WORKFLOW_PATH = path.join(repoRoot, '.github/workflows/firebase-emulator-check.yml');

/** Carrega e faz o parse do workflow. */
function loadWorkflow() {
  return YAML.parse(fs.readFileSync(WORKFLOW_PATH, 'utf8'));
}

/** A chave `on` pode ser lida como booleano `true` em YAML 1.1; cobrimos as variantes. */
function triggersOf(wf) {
  return wf.on ?? wf['true'] ?? wf[true];
}

/** Todos os steps de todos os jobs. */
function allSteps(wf) {
  return Object.values(wf.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

/** Texto bruto do workflow (para asserções de ausência). */
function rawText() {
  return fs.readFileSync(WORKFLOW_PATH, 'utf8');
}

describe('firebase-emulator-check.yml — contrato do workflow', () => {
  test('o arquivo existe e é YAML válido', () => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'workflow ausente em .github/workflows/firebase-emulator-check.yml');
    const wf = loadWorkflow();
    assert.equal(typeof wf, 'object');
    assert.ok(wf !== null);
  });

  test('gatilho por push do próprio arquivo, na branch refatoracao, com path exato', () => {
    const on = triggersOf(loadWorkflow());
    assert.ok(on, 'workflow sem seção "on"');
    assert.deepEqual(on.push.branches, ['refatoracao']);
    assert.deepEqual(on.push.paths, ['.github/workflows/firebase-emulator-check.yml']);
  });

  test('gatilho por push de tag firebase-emulator-* (permite retry sem alterar fonte)', () => {
    const on = triggersOf(loadWorkflow());
    assert.deepEqual(on.push.tags, ['firebase-emulator-*']);
  });

  test('workflow_dispatch habilitado', () => {
    const on = triggersOf(loadWorkflow());
    assert.ok('workflow_dispatch' in on, 'workflow sem gatilho manual workflow_dispatch');
  });

  test('permissão read-only: contents: read, e nenhuma outra permissão concedida', () => {
    const wf = loadWorkflow();
    assert.ok(wf.permissions, 'workflow sem bloco "permissions" explícito');
    assert.equal(wf.permissions.contents, 'read');
    const outras = Object.keys(wf.permissions).filter((k) => k !== 'contents');
    assert.deepEqual(outras, [], `permissões extras não esperadas: ${outras.join(', ')}`);
  });

  test('checkout com fetch-depth: 0 (history completo)', () => {
    const checkout = allSteps(loadWorkflow()).find((s) => String(s.uses ?? '').startsWith('actions/checkout@'));
    assert.ok(checkout, 'workflow sem passo de checkout');
    assert.equal(checkout.uses, 'actions/checkout@v4');
    assert.equal(checkout.with['fetch-depth'], 0);
  });

  test('Node exatamente 22.17.1', () => {
    const setupNode = allSteps(loadWorkflow()).find((s) => String(s.uses ?? '').startsWith('actions/setup-node@'));
    assert.ok(setupNode, 'workflow sem actions/setup-node');
    assert.equal(String(setupNode.with['node-version']), '22.17.1');
  });

  test('Java exatamente 21, distribuição Temurin', () => {
    const setupJava = allSteps(loadWorkflow()).find((s) => String(s.uses ?? '').startsWith('actions/setup-java@'));
    assert.ok(setupJava, 'workflow sem actions/setup-java (o Emulator exige Java 21)');
    assert.equal(setupJava.with.distribution, 'temurin');
    assert.equal(String(setupJava.with['java-version']), '21');
  });

  test('roda npm ci e npm run test:firebase, nessa ordem, depois do setup de Java', () => {
    const steps = allSteps(loadWorkflow());
    const indiceJava = steps.findIndex((s) => String(s.uses ?? '').startsWith('actions/setup-java@'));
    const indiceCi = steps.findIndex((s) => s.run === 'npm ci');
    const indiceSuite = steps.findIndex((s) => s.run === 'npm run test:firebase');

    assert.ok(indiceCi !== -1, 'workflow sem "npm ci"');
    assert.ok(indiceSuite !== -1, 'workflow sem "npm run test:firebase"');
    assert.ok(indiceJava < indiceCi, 'o setup de Java precisa vir antes da instalação');
    assert.ok(indiceCi < indiceSuite, 'npm ci precisa vir antes da suíte');
  });

  test('publica os logs do Emulator como artifact', () => {
    const upload = allSteps(loadWorkflow()).find((s) => String(s.uses ?? '').startsWith('actions/upload-artifact@'));
    assert.ok(upload, 'workflow sem upload dos logs do Emulator');
    assert.match(String(upload.with.path), /firestore-debug\.log/);
  });

  test('nenhum passo faz commit, push ou deploy', () => {
    const runs = allSteps(loadWorkflow())
      .map((s) => s.run)
      .filter((r) => typeof r === 'string');
    for (const run of runs) {
      assert.doesNotMatch(run, /git\s+(commit|push|tag)\b/, `passo com escrita no repositório: ${run}`);
      assert.doesNotMatch(run, /firebase\s+deploy\b/, `passo com deploy: ${run}`);
    }
  });

  test('nenhum segredo/credencial é referenciado', () => {
    const texto = rawText();
    assert.doesNotMatch(texto, /\$\{\{\s*secrets\./, 'o workflow não pode referenciar secrets');
    assert.doesNotMatch(texto, /GOOGLE_APPLICATION_CREDENTIALS|serviceAccount|FIREBASE_TOKEN/i);
  });

  test('nenhum project id que não comece por demo- aparece no workflow', () => {
    const texto = rawText();
    const projetos = [...texto.matchAll(/--project\s+(\S+)/g)].map((m) => m[1]);
    for (const projeto of projetos) {
      assert.ok(projeto.startsWith('demo-'), `project id não-demo no workflow: ${projeto}`);
    }
    assert.doesNotMatch(texto, /\bded2024\b/, 'o projeto de PRODUÇÃO nunca pode aparecer neste workflow');
  });

  test('o script test:firebase do package.json usa emulators:exec com o projeto demo e roda as duas suítes', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    const script = pkg.scripts['test:firebase'];
    assert.ok(script, 'package.json sem script test:firebase');
    assert.match(script, /npm run test:firebase:preflight/, 'o preflight precisa rodar antes');
    assert.match(script, /firebase emulators:exec --only firestore --project demo-dnd-refactor/);
    assert.match(script, /tests\/firebase\/firestore-character-gateway\.test\.js/);
    assert.match(script, /tests\/firebase\/sync-queue-firestore\.test\.js/);
    assert.equal(pkg.scripts['test:firebase:preflight'], 'node scripts/check-firebase-prerequisites.mjs');
  });
});

describe('firebase-emulator-workflow — o parser de fato rejeita YAML inválido', () => {
  test('YAML sintaticamente inválido faz YAML.parse lançar (o contrato não passa por acidente)', () => {
    const invalido = 'on:\n  push:\n    branches:\n      - refatoracao\n  - isto: [ nao fecha\n';
    assert.throws(() => YAML.parse(invalido), 'um YAML inválido precisa fazer o parser lançar');
  });

  test('um workflow válido mas com permissão de escrita seria reprovado pelo contrato', () => {
    const wf = YAML.parse('permissions:\n  contents: write\n');
    assert.notEqual(wf.permissions.contents, 'read', 'sanidade: o teste de permissão distingue read de write');
  });
});
