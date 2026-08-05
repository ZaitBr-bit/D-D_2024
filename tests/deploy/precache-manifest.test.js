// ============================================================
// Task 35 — testes do resolvedor de grafo de assets (`scripts/lib/precache-manifest.mjs`).
//
// O primeiro teste é o RED documentado pelo brief: prova, contra a lista
// manual `STATIC_ASSETS` do `site/sw.js` ANTERIOR a esta task (capturada
// aqui como snapshot literal — o arquivo real já foi reescrito pela mesma
// task para consumir o manifesto dinamicamente), que aquela lista estava
// incompleta (faltam assets alcançáveis reais) e não carregava hash algum.
// Fica como regressão permanente: se algum dia voltarmos a uma lista
// manual, este teste denuncia de novo.
// ============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveStaticAssetRelativePaths,
  resolveDataAssetRelativePaths,
  validateAssetUrl,
  assertManifestIntegrity,
  buildPrecacheManifest,
  isSafeRelativeEntryPath,
} from '../../scripts/lib/precache-manifest.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const siteDir = path.join(repoRoot, 'site');
const dadosDir = path.join(repoRoot, 'dados');

// Snapshot literal do array `STATIC_ASSETS` do `site/sw.js` de ANTES da
// Task 35 (ver histórico do arquivo) — apenas caminhos, nenhum hash.
const LEGACY_STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/store.js',
  './js/sync.js',
  './js/utils.js',
  './js/dados-classes.js',
  './js/levelup.js',
  './js/pages/home.js',
  './js/pages/creator.js',
  './js/pages/sheet.js',
  './js/auth.js',
  './js/vendor/pdf-lib.min.js',
];

test('RED documentado: a lista manual legada do worker era incompleta e não carregava hash', async () => {
  const reachable = await resolveStaticAssetRelativePaths(siteDir);
  const reachableSet = new Set(reachable);

  // A lista legada não tem NENHUM campo de hash — só strings.
  for (const entry of LEGACY_STATIC_ASSETS) {
    assert.equal(typeof entry, 'string', 'a lista legada era um array de strings, sem sha256');
  }

  // Assets hoje REALMENTE alcançáveis (favicon, manifest do PWA, ícone só
  // referenciado via manifest.json, módulos de UI/domínio/infra que não
  // existiam na lista legada) que a lista legada NÃO continha.
  const ausentesNaListaLegada = [
    './favicon.ico',
    './img/icon-512.png', // só alcançável via manifest.json > icons, nunca listado
    './js/core/result.js',
    './js/ui/modal.js',
  ];
  const legacySet = new Set(LEGACY_STATIC_ASSETS);
  for (const url of ausentesNaListaLegada) {
    assert.ok(reachableSet.has(url), `pré-condição do teste: ${url} deveria ser alcançável hoje`);
    assert.ok(!legacySet.has(url), `RED: ${url} é alcançável mas a lista manual legada não o continha`);
  }
});

test('resolveStaticAssetRelativePaths inclui manifest, ícones, favicon e vendor/pdf-lib explicitamente', async () => {
  const urls = await resolveStaticAssetRelativePaths(siteDir);
  for (const esperado of [
    './index.html',
    './manifest.json',
    './favicon.ico',
    './img/icon-192.png',
    './img/icon-512.png',
    './css/app.css',
    './js/app.js',
    './js/pages/home.js', // alcançado via import() dinâmico literal em app.js
    './js/vendor/pdf-lib.min.js', // inclusão explícita (Task 33 injeta via <script>, fora do grafo)
  ]) {
    assert.ok(urls.includes(esperado), `esperava ${esperado} no conjunto resolvido`);
  }
  // Ordenado e sem duplicatas.
  assert.deepEqual(urls, [...new Set(urls)].sort());
});

test('resolveDataAssetRelativePaths inclui schemas e todo JSON alcançável pelo índice do pacote oficial', async () => {
  const urls = await resolveDataAssetRelativePaths(dadosDir);
  for (const esperado of [
    '../dados/schemas/v1/manifest.schema.json',
    '../dados/pacotes/dnd2024/manifest.json',
    '../dados/pacotes/dnd2024/index.json',
    '../dados/pacotes/dnd2024/spells/index.json',
    '../dados/pacotes/dnd2024/migrations/character-v1-aliases.json',
  ]) {
    assert.ok(urls.includes(esperado), `esperava ${esperado} no conjunto resolvido`);
  }
  assert.deepEqual(urls, [...new Set(urls)].sort());
});

test('remover o <link rel="manifest"> do grafo faz manifest.json e seus ícones exclusivos deixarem de ser resolvidos', async () => {
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'precache-fixture-'));
  try {
    await cp(siteDir, tmpDir, { recursive: true });
    const indexPath = path.join(tmpDir, 'index.html');
    const original = await readFile(indexPath, 'utf8');
    const semManifestLink = original.replace(/<link rel="manifest"[^>]*>\n?/, '');
    assert.notEqual(semManifestLink, original, 'pré-condição: o link deveria existir no fixture');
    await writeFile(indexPath, semManifestLink, 'utf8');

    const urls = await resolveStaticAssetRelativePaths(tmpDir);
    assert.ok(!urls.includes('./manifest.json'), 'manifest.json não deveria mais ser alcançável');
    assert.ok(!urls.includes('./img/icon-512.png'), 'ícone só referenciado via manifest.json deveria sumir junto');
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('validateAssetUrl rejeita URL externa, query, fragment, path absoluto e travessia', () => {
  assert.throws(() => validateAssetUrl('https://evil.example/x.js', 'static'));
  assert.throws(() => validateAssetUrl('//evil.example/x.js', 'static'));
  assert.throws(() => validateAssetUrl('./x.js?v=1', 'static'));
  assert.throws(() => validateAssetUrl('./x.js#frag', 'static'));
  assert.throws(() => validateAssetUrl('/etc/passwd', 'static'));
  assert.throws(() => validateAssetUrl('./../../etc/passwd', 'static'));
  assert.throws(() => validateAssetUrl('../dados/../../etc/passwd', 'data'));
  assert.throws(() => validateAssetUrl('./data/x.json', 'data'), 'dados devem começar com ../dados/');
  assert.doesNotThrow(() => validateAssetUrl('./js/app.js', 'static'));
  assert.doesNotThrow(() => validateAssetUrl('../dados/pacotes/dnd2024/manifest.json', 'data'));
});

test('assertManifestIntegrity rejeita duplicata e autoenumeração de precache-manifest.json', () => {
  assert.throws(
    () =>
      assertManifestIntegrity({
        staticAssets: [
          { url: './index.html', sha256: 'a'.repeat(64) },
          { url: './index.html', sha256: 'a'.repeat(64) },
        ],
        dataAssets: [],
      }),
    /duplicada/,
  );
  assert.throws(
    () =>
      assertManifestIntegrity({
        staticAssets: [{ url: './precache-manifest.json', sha256: 'a'.repeat(64) }],
        dataAssets: [],
      }),
    /autoenumerar/,
  );
  assert.doesNotThrow(() =>
    assertManifestIntegrity({
      staticAssets: [{ url: './index.html', sha256: 'a'.repeat(64) }],
      dataAssets: [{ url: '../dados/pacotes/dnd2024/manifest.json', sha256: 'b'.repeat(64) }],
    }),
  );
});

// ============================================================
// Fix round 1 — travessia via `\` (path.join trata como separador no
// Windows) e ordem de validação em buildPrecacheManifest (achados
// "Important" da revisão independente).
// ============================================================

test('isSafeRelativeEntryPath rejeita "\\" e travessia "\.." mesmo após normalização', () => {
  assert.equal(isSafeRelativeEntryPath('..\\..\\secret.txt'), false, 'backslash deve ser rejeitado mesmo sem "/../"');
  assert.equal(isSafeRelativeEntryPath('classes/../../secret.json'), false, 'travessia que só aparece após colapsar segmentos');
  assert.equal(isSafeRelativeEntryPath('../secret.json'), false);
  assert.equal(isSafeRelativeEntryPath('/etc/passwd'), false);
  assert.equal(isSafeRelativeEntryPath('classes/barbaro.json'), true);
});

test('resolveDataAssetRelativePaths ignora entry.path de index.json com "\\..\\" — não vira asset, arquivo nunca é lido', async () => {
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'precache-traversal-'));
  try {
    const pacoteDir = path.join(tmpDir, 'pacotes', 'malicioso');
    await mkdir(pacoteDir, { recursive: true });
    await mkdir(path.join(tmpDir, 'schemas'), { recursive: true });
    await writeFile(path.join(pacoteDir, 'manifest.json'), '{}', 'utf8');
    await writeFile(
      path.join(pacoteDir, 'index.json'),
      JSON.stringify({
        entries: [
          { id: 'x', type: 'ability', path: 'ok.json' },
          // Ataque relatado pela revisão: sobrevive a um filtro que só olha "/".
          { id: 'evil', type: 'ability', path: '..\\..\\secret.txt' },
        ],
      }),
      'utf8',
    );
    await writeFile(path.join(pacoteDir, 'ok.json'), '{}', 'utf8');
    // Arquivo "secreto" FORA do pacote — se a travessia funcionasse, seria lido.
    await writeFile(path.join(tmpDir, 'secret.txt'), 'segredo', 'utf8');

    const urls = await resolveDataAssetRelativePaths(tmpDir);
    assert.ok(urls.includes('../dados/pacotes/malicioso/ok.json'), 'entrada segura deveria ser incluída');
    assert.ok(
      !urls.some((u) => u.includes('secret')),
      'entrada com "\\.." não pode virar URL — nenhuma leitura do arquivo fora do pacote deveria ocorrer',
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('validateAssetUrl rejeita "\\" (separador não-POSIX) tanto para static quanto para data', () => {
  assert.throws(() => validateAssetUrl('.\\js\\app.js', 'static'), /não-POSIX/);
  assert.throws(() => validateAssetUrl('../dados/pacotes/dnd2024/..\\..\\secret.txt', 'data'), /não-POSIX/);
});

test('validateAssetUrl rejeita travessia com segmento ".." explícito (via filtro de segmento OU via normalização — defesa em profundidade)', () => {
  // O filtro `split('/').includes('..')` já pega qualquer segmento ".."
  // literal; a checagem por `path.posix.normalize` logo em seguida é
  // redundante PARA ESTES CASOS por construção (normalize só produz ".."
  // residual a partir de ".." já presente na entrada — não é alcançável
  // isoladamente sem antes passar pelo filtro de segmento), mas fica como
  // segunda camada caso o filtro de segmento seja alterado no futuro. O que
  // importa aqui é que a URL É rejeitada, por qualquer uma das duas regras.
  assert.throws(() => validateAssetUrl('./a/../../b', 'static'), /travessia|normalização|escapar/);
  assert.throws(() => validateAssetUrl('../dados/pacotes/x/../../../secret.json', 'data'), /travessia|normalização|escapar/);
});

test('buildPrecacheManifest valida ANTES de tocar o filesystem: URL hostil falha com erro de validação, não ENOENT, e nenhum arquivo é lido', async () => {
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'precache-build-validate-'));
  try {
    // Diretórios de destino propositalmente VAZIOS: se `hashUrls` rodasse
    // antes da validação para QUALQUER URL da lista, o erro seria um ENOENT
    // de leitura de arquivo — não o erro de validação esperado.
    await mkdir(path.join(tmpDir, 'site'), { recursive: true });
    await mkdir(path.join(tmpDir, 'dados'), { recursive: true });

    await assert.rejects(
      () =>
        buildPrecacheManifest({
          deployVersion: 'x',
          siteDistDir: path.join(tmpDir, 'site'),
          dadosDistDir: path.join(tmpDir, 'dados'),
          staticUrls: ['./index.html', '.\\js\\app.js'],
          dataUrls: [],
        }),
      (error) => {
        assert.ok(!/ENOENT/.test(error.message), `esperava erro de validação, não ENOENT: ${error.message}`);
        assert.match(error.message, /não-POSIX/);
        return true;
      },
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
