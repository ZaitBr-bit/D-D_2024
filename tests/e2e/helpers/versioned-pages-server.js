// ============================================================
// Servidor HTTP estático usado pelos specs `pwa-precache`, `pwa-offline` e
// `pwa-update` (Task 36): serve artifacts de deploy REAIS (gerados via
// `scripts/prepare-pages.mjs`, o mesmo pipeline usado em produção) sob
// `/D-D_2024/site/` e `/D-D_2024/dados/`, replicando o subpath do GitHub
// Pages. Mantém três versões pré-construídas — `test-v1`, `test-v2` e
// `test-broken` — e permite trocar qual delas está "no ar" em runtime, para
// os cenários de atualização v1→v2 e de instalação corrompida.
// ============================================================
import http from 'node:http';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { readFileSync as readFileSyncNode } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

// `scripts/prepare-pages.mjs` é executado em PROCESSO FILHO (não importado
// diretamente aqui) de propósito: importar o módulo dispara `linkedom` (via
// `scripts/lib/precache-manifest.mjs`), que sob o loader de módulos do
// Playwright neste ambiente colide com o registro interno de módulos do
// Node ("Unexpected module status 3") quando carregado dentro do processo
// de teste. Rodar como subprocesso isola completamente esse carregamento.
function buildArtifactViaSubprocess(outDir, version) {
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, 'scripts', 'prepare-pages.mjs'), '--out', outDir, '--version', version],
    { cwd: repoRoot, encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(`prepare-pages falhou para ${version}: ${result.stderr || result.stdout}`);
  }
}
const SCOPE_PREFIX = '/D-D_2024';

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * Constrói os três artifacts de teste (`test-v1`, `test-v2`, `test-broken`)
 * num diretório temporário, usando o pipeline real de build (Task 35). O
 * artifact `test-broken` é uma cópia de `test-v2` com um byte adulterado num
 * asset estático DEPOIS do manifesto ter sido calculado — simula corrupção
 * em trânsito sem invalidar o hash já publicado no manifesto.
 * @returns {Promise<{dirs: Record<string,string>}>}
 */
async function buildFixtureArtifacts() {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'dnd-pwa-fixtures-'));
  const dirs = {};

  for (const version of ['test-v1', 'test-v2', 'test-broken']) {
    const outDir = path.join(tmpRoot, version);
    buildArtifactViaSubprocess(outDir, version);
    dirs[version] = outDir;
  }

  // Adultera um asset estático de test-broken DEPOIS do build (o manifesto já
  // foi calculado com o hash ORIGINAL) — install deve detectar
  // PWA_ASSET_INTEGRITY_MISMATCH ao recalcular o hash dos bytes servidos.
  const alvo = path.join(dirs['test-broken'], 'site', 'js', 'utils.js');
  const original = await readFile(alvo, 'utf8');
  await writeFile(alvo, `${original}\n// bytes adulterados pelo fixture de teste (Task 36)\n`, 'utf8');

  return { dirs };
}

/**
 * Sobe o servidor de artifacts versionados na porta 4174, servindo a versão
 * "ativa" (mutável via `setActiveVersion`) sob `/D-D_2024/site/` e
 * `/D-D_2024/dados/`. Cada resposta inclui `Cache-Control: max-age=3600`
 * deliberadamente — os specs provam que o worker ignora o HTTP cache do
 * navegador (usa sempre `fetch(..., {cache:'no-store'})`).
 * @param {{port?: number}} [opts]
 * @returns {Promise<{
 *   url: string,
 *   setActiveVersion: (version: string) => void,
 *   getActiveVersion: () => string,
 *   readFileSync: (version: string, relPath: string) => string,
 *   close: () => Promise<void>
 * }>}
 */
export async function startVersionedPagesServer(opts = {}) {
  const port = opts.port ?? 4174;
  const { dirs } = await buildFixtureArtifacts();
  let active = 'test-v1';

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      let pathname = decodeURIComponent(url.pathname);
      if (!pathname.startsWith(SCOPE_PREFIX)) {
        res.writeHead(404).end('not found');
        return;
      }
      pathname = pathname.slice(SCOPE_PREFIX.length) || '/';
      if (pathname === '/site/' || pathname === '/site') pathname = '/site/index.html';

      const baseDir = dirs[active];
      const relFsPath = pathname.replace(/^\//, '');
      const absPath = path.join(baseDir, ...relFsPath.split('/'));
      if (!absPath.startsWith(baseDir)) {
        res.writeHead(403).end('forbidden');
        return;
      }

      const bytes = await readFile(absPath);
      const ext = path.extname(absPath);
      res.writeHead(200, {
        'Content-Type': MIME_BY_EXT[ext] || 'application/octet-stream',
        'Cache-Control': 'max-age=3600',
      });
      res.end(bytes);
    } catch (cause) {
      res.writeHead(404).end('not found');
    }
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

  return {
    url: `http://127.0.0.1:${port}${SCOPE_PREFIX}/site/`,
    setActiveVersion: (version) => {
      if (!dirs[version]) throw new Error(`versão de fixture desconhecida: ${version}`);
      active = version;
    },
    getActiveVersion: () => active,
    // Lê um arquivo do artifact JÁ CONSTRUÍDO diretamente do disco (fonte de
    // verdade fora do navegador/worker inteiramente) — usado por specs que
    // precisam comparar o que um client observou via fetch contra o que o
    // build realmente produziu para aquela versão, sem depender do mesmo
    // cache/worker que está sob teste (evita asserções tautológicas).
    readFileSync: (version, relPath) => {
      if (!dirs[version]) throw new Error(`versão de fixture desconhecida: ${version}`);
      return readFileSyncNode(path.join(dirs[version], ...relPath.split('/')), 'utf8');
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
