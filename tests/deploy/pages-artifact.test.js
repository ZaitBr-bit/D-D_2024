// ============================================================
// Task 35 — testes de integração do gerador (`scripts/prepare-pages.mjs`) e
// do verificador (`scripts/verify-pages-artifact.mjs`) do artifact Pages.
// ============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparePagesArtifact, DEPLOY_VERSION_MARKER } from '../../scripts/prepare-pages.mjs';
import { verifyPagesArtifact } from '../../scripts/verify-pages-artifact.mjs';
import { sha256Hex } from '../../scripts/lib/sha256.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Cria um diretório temporário isolado para um build de teste e devolve o
 * caminho já resolvido, junto com uma função de limpeza.
 * @returns {Promise<{dir: string, cleanup: () => Promise<void>}>}
 */
async function makeTmpOutDir() {
  const dir = await mkdtemp(path.join(tmpdir(), 'pages-artifact-'));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('preparePagesArtifact produz o layout esperado e o artifact passa em verifyPagesArtifact', async () => {
  const { dir, cleanup } = await makeTmpOutDir();
  try {
    const { manifest } = await preparePagesArtifact({ outDir: dir, deployVersion: 'test-1' });

    for (const rel of ['index.html', 'site/index.html', 'site/sw.js', 'site/precache-manifest.json', 'dados/pacotes/dnd2024/manifest.json']) {
      const s = await stat(path.join(dir, ...rel.split('/')));
      assert.ok(s.isFile(), `esperava arquivo em ${rel}`);
    }

    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.deployVersion, 'test-1');
    assert.ok(manifest.staticAssets.length > 0);
    assert.ok(manifest.dataAssets.length > 0);
    for (const entry of [...manifest.staticAssets, ...manifest.dataAssets]) {
      assert.match(entry.sha256, /^[0-9a-f]{64}$/, `sha256 malformado em ${entry.url}`);
    }

    const result = await verifyPagesArtifact({ dir });
    assert.deepEqual(result.problems, []);
    assert.equal(result.ok, true);
  } finally {
    await cleanup();
  }
});

test('a versão é injetada por marcador exato no header e no sw.js copiados, sem sobrar nas cópias', async () => {
  const { dir, cleanup } = await makeTmpOutDir();
  try {
    await preparePagesArtifact({ outDir: dir, deployVersion: 'v-marker-1' });
    const header = await readFile(path.join(dir, 'site', 'index.html'), 'utf8');
    const sw = await readFile(path.join(dir, 'site', 'sw.js'), 'utf8');
    assert.ok(header.includes('v-marker-1'), 'header deveria conter a versão injetada');
    assert.ok(sw.includes("DEPLOY_VERSION = 'v-marker-1'"), 'sw.js deveria conter a versão injetada');
    assert.ok(!header.includes(DEPLOY_VERSION_MARKER), 'marcador não pode sobrar no header');
    assert.ok(!sw.includes(DEPLOY_VERSION_MARKER), 'marcador não pode sobrar no sw.js');
  } finally {
    await cleanup();
  }
});

test('preparePagesArtifact nunca altera os arquivos-fonte do repositório', async () => {
  const { dir, cleanup } = await makeTmpOutDir();
  try {
    const swSourcePath = path.join(repoRoot, 'site', 'sw.js');
    const indexSourcePath = path.join(repoRoot, 'site', 'index.html');
    const swBefore = await readFile(swSourcePath, 'utf8');
    const indexBefore = await readFile(indexSourcePath, 'utf8');

    await preparePagesArtifact({ outDir: dir, deployVersion: 'no-source-mutation' });

    const swAfter = await readFile(swSourcePath, 'utf8');
    const indexAfter = await readFile(indexSourcePath, 'utf8');
    assert.equal(swAfter, swBefore, 'site/sw.js fonte não pode mudar');
    assert.equal(indexAfter, indexBefore, 'site/index.html fonte não pode mudar');
    assert.ok(swBefore.includes(DEPLOY_VERSION_MARKER), 'o fonte deve conter o marcador (não a versão já resolvida)');
  } finally {
    await cleanup();
  }
});

test('duas execuções com mesmos inputs/versão geram precache-manifest.json byte-idêntico', async () => {
  const first = await makeTmpOutDir();
  const second = await makeTmpOutDir();
  try {
    await preparePagesArtifact({ outDir: first.dir, deployVersion: 'determinismo-1' });
    await preparePagesArtifact({ outDir: second.dir, deployVersion: 'determinismo-1' });

    const manifestFirst = await readFile(path.join(first.dir, 'site', 'precache-manifest.json'));
    const manifestSecond = await readFile(path.join(second.dir, 'site', 'precache-manifest.json'));
    assert.equal(sha256Hex(manifestFirst), sha256Hex(manifestSecond));
    assert.deepEqual(manifestFirst.equals(manifestSecond), true);
  } finally {
    await first.cleanup();
    await second.cleanup();
  }
});

test('verifyPagesArtifact detecta asset REMOVIDO (arquivo ausente listado no manifesto)', async () => {
  const { dir, cleanup } = await makeTmpOutDir();
  try {
    await preparePagesArtifact({ outDir: dir, deployVersion: 'tamper-remove' });
    await unlink(path.join(dir, 'site', 'css', 'app.css'));

    const result = await verifyPagesArtifact({ dir });
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((p) => p.includes('app.css')));
  } finally {
    await cleanup();
  }
});

test('verifyPagesArtifact detecta asset ADULTERADO — recalcular só tamanho/data não engana', async () => {
  const { dir, cleanup } = await makeTmpOutDir();
  try {
    await preparePagesArtifact({ outDir: dir, deployVersion: 'tamper-mutate' });
    const cssPath = path.join(dir, 'site', 'css', 'app.css');
    const original = await readFile(cssPath, 'utf8');
    // Mesmo TAMANHO em bytes que o original (substitui por caracteres do
    // mesmo tamanho), só para provar que o verificador nunca confia em
    // tamanho/data — só no SHA-256 real do conteúdo.
    const adulterado = original.length > 0 ? 'x'.repeat(original.length) : 'x';
    await writeFile(cssPath, adulterado, 'utf8');

    const result = await verifyPagesArtifact({ dir });
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((p) => p.includes('SHA-256 divergente') && p.includes('app.css')));
  } finally {
    await cleanup();
  }
});

test('verifyPagesArtifact detecta asset ADICIONADO/alcançável não listado no manifesto', async () => {
  const { dir, cleanup } = await makeTmpOutDir();
  try {
    await preparePagesArtifact({ outDir: dir, deployVersion: 'tamper-add' });
    // Torna um novo módulo alcançável a partir de app.js sem regenerar o
    // manifesto: o grafo recalculado no verify vai enxergá-lo, mas o
    // manifesto (já escrito) não o lista.
    const novoModuloPath = path.join(dir, 'site', 'js', 'modulo-novo-nao-listado.js');
    await writeFile(novoModuloPath, 'export const x = 1;\n', 'utf8');
    const appJsPath = path.join(dir, 'site', 'js', 'app.js');
    const appJs = await readFile(appJsPath, 'utf8');
    await writeFile(appJsPath, `import './modulo-novo-nao-listado.js';\n${appJs}`, 'utf8');

    const result = await verifyPagesArtifact({ dir });
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((p) => p.includes('modulo-novo-nao-listado.js')));
  } finally {
    await cleanup();
  }
});

test('verifyPagesArtifact falha se site/manifest.json for omitido do artifact', async () => {
  const { dir, cleanup } = await makeTmpOutDir();
  try {
    await preparePagesArtifact({ outDir: dir, deployVersion: 'omit-manifest' });
    await unlink(path.join(dir, 'site', 'manifest.json'));

    const result = await verifyPagesArtifact({ dir });
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((p) => p.includes('./manifest.json')));
  } finally {
    await cleanup();
  }
});

test('verifyPagesArtifact falha se site/js/vendor/pdf-lib.min.js for omitido do artifact', async () => {
  const { dir, cleanup } = await makeTmpOutDir();
  try {
    await preparePagesArtifact({ outDir: dir, deployVersion: 'omit-vendor' });
    await unlink(path.join(dir, 'site', 'js', 'vendor', 'pdf-lib.min.js'));

    const result = await verifyPagesArtifact({ dir });
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((p) => p.includes('pdf-lib.min.js')));
  } finally {
    await cleanup();
  }
});

test('verifyPagesArtifact falha se um ícone referenciado em manifest.json for omitido', async () => {
  const { dir, cleanup } = await makeTmpOutDir();
  try {
    await preparePagesArtifact({ outDir: dir, deployVersion: 'omit-icon' });
    await unlink(path.join(dir, 'site', 'img', 'icon-512.png'));

    const result = await verifyPagesArtifact({ dir });
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((p) => p.includes('icon-512.png')));
  } finally {
    await cleanup();
  }
});

test('verifyPagesArtifact falha se o <link rel="manifest"> for removido do grafo (index.html do artifact)', async () => {
  const { dir, cleanup } = await makeTmpOutDir();
  try {
    await preparePagesArtifact({ outDir: dir, deployVersion: 'omit-manifest-link' });
    const indexPath = path.join(dir, 'site', 'index.html');
    const original = await readFile(indexPath, 'utf8');
    const semLink = original.replace(/<link rel="manifest"[^>]*>\n?/, '');
    assert.notEqual(semLink, original, 'pré-condição: o link deveria existir no artifact gerado');
    await writeFile(indexPath, semLink, 'utf8');

    const result = await verifyPagesArtifact({ dir });
    assert.equal(result.ok, false);
    // manifest.json e o ícone exclusivo dele deixam de ser "esperados" pelo
    // grafo recalculado, mas continuam listados no manifesto já gerado —
    // ou seja, aparecem como "inalcançável" (sobra do lado do manifesto).
    assert.ok(result.problems.some((p) => p.includes('inalcançável') && p.includes('manifest.json')));
  } finally {
    await cleanup();
  }
});
