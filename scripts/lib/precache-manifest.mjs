// ============================================================
// Task 35 — núcleo determinístico do manifesto de precache do artifact
// Pages: descobre, a partir do GRAFO real de HTML/CSS/JS de `site/` e dos
// manifestos/índices do pacote oficial de `dados/`, exatamente quais
// arquivos precisam ser cacheados para uso offline, e calcula o SHA-256 de
// cada um já materializado no artifact final.
//
// Este módulo é usado tanto por `scripts/prepare-pages.mjs` (para GERAR o
// manifesto) quanto por `scripts/verify-pages-artifact.mjs` (para
// RECALCULAR o mesmo grafo contra o artifact já construído e comparar) — a
// mesma função de resolução de URLs é a única fonte de verdade sobre o que
// "completo" significa, então build e verify nunca podem divergir sobre a
// definição de completude.
//
// Conteúdo de JSON (inclusive do pacote oficial) é tratado como não
// confiável: os manifestos/índices são parseados apenas para coletar
// CAMINHOS de arquivo, nunca interpretados como dados de jogo.
// ============================================================
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { sha256Hex } from './sha256.mjs';

// Regex para imports/exports ESTÁTICOS com especificador literal
// (`import … from '…'`, `import '…'`, `export … from '…'`) e para
// `import('…')` DINÂMICO com especificador literal. Limitação conhecida e
// aceitável (mesmo padrão documentado em scripts/check-architecture.mjs):
// baseada em regex, não em AST — não há parser JS como dependência do
// projeto. Um `//`/`/*` ou string contendo a palavra "import" dentro de um
// literal poderia, em teoria, confundir o scanner; não é um caso real no
// código-fonte de primeira parte deste repositório.
const STATIC_SPECIFIER_RE = /\b(?:import|export)\s+(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_SPECIFIER_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// `url(...)` de CSS, exceto `data:` (embutido, não é um asset separado).
const CSS_URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

const LINK_RELS_RELEVANTES = new Set([
  'manifest',
  'icon',
  'shortcut',
  'apple-touch-icon',
  'apple-touch-icon-precomposed',
  'stylesheet',
]);

/**
 * Verifica se uma referência de HTML/CSS/JSON é LOCAL (não externa e não
 * `data:`), condição para ser candidata a entrar no precache.
 * @param {string} ref
 * @returns {boolean}
 */
function isLocalReference(ref) {
  if (typeof ref !== 'string' || ref.length === 0) return false;
  if (ref.startsWith('data:')) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(ref)) return false; // esquema://
  if (ref.startsWith('//')) return false; // protocol-relative
  return true;
}

/**
 * Normaliza um caminho relativo POSIX (sempre com `/`, sem `./` inicial
 * redundante), resolvendo `..`/`.` dentro do próprio pacote de assets.
 * @param {string} baseDirPosix - diretório do arquivo que contém a referência.
 * @param {string} ref - referência (relativa) encontrada no arquivo.
 * @returns {string}
 */
function resolveRelative(baseDirPosix, ref) {
  return path.posix.normalize(path.posix.join(baseDirPosix, ref));
}

/**
 * Lista recursivamente todos os arquivos de um diretório, devolvendo
 * caminhos POSIX relativos a `baseDir`. Diretório ausente devolve `[]`
 * (o chamador decide se isso é um erro de completude).
 * @param {string} dir - diretório absoluto a percorrer.
 * @param {string} baseDir - diretório absoluto usado como base dos relativos.
 * @returns {Promise<string[]>}
 */
export async function listFilesRecursive(dir, baseDir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const found = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await listFilesRecursive(full, baseDir)));
    } else if (entry.isFile()) {
      found.push(path.relative(baseDir, full).split(path.sep).join('/'));
    }
  }
  return found;
}

/**
 * Coleta, a partir de um conjunto de arquivos JS de entrada, todo o grafo de
 * imports ESTÁTICOS e `import()` DINÂMICOS com especificador literal
 * relativo (`./…`/`../…`), recursivamente. Especificadores não-relativos
 * (bare specifiers) são ignorados — o projeto não usa nenhum.
 * @param {string[]} entryRelPaths - caminhos POSIX relativos a `siteDir`.
 * @param {string} siteDir - diretório absoluto de `site/`.
 * @returns {Promise<Set<string>>} conjunto de caminhos POSIX relativos a `siteDir`.
 */
async function collectJsGraph(entryRelPaths, siteDir) {
  const visited = new Set();
  const queue = [...entryRelPaths];
  while (queue.length > 0) {
    const rel = queue.shift();
    if (visited.has(rel)) continue;
    visited.add(rel);
    let content;
    try {
      content = await readFile(path.join(siteDir, ...rel.split('/')), 'utf8');
    } catch {
      continue; // arquivo referenciado mas ausente: completude falha depois, na comparação de bytes
    }
    const specifiers = [
      ...[...content.matchAll(STATIC_SPECIFIER_RE)].map((m) => m[1]),
      ...[...content.matchAll(DYNAMIC_SPECIFIER_RE)].map((m) => m[1]),
    ];
    const baseDir = path.posix.dirname(rel);
    for (const spec of specifiers) {
      if (!spec.startsWith('.')) continue; // apenas especificadores relativos
      const resolved = resolveRelative(baseDir, spec);
      if (!visited.has(resolved)) queue.push(resolved);
    }
  }
  return visited;
}

/**
 * Coleta os assets locais referenciados via `url(...)` dentro de um arquivo
 * CSS (ex.: fontes, imagens de fundo). `data:` é ignorado por ser embutido.
 * @param {string} cssRelPath - caminho POSIX relativo a `siteDir`.
 * @param {string} siteDir - diretório absoluto de `site/`.
 * @returns {Promise<string[]>}
 */
async function collectCssUrlAssets(cssRelPath, siteDir) {
  let content;
  try {
    content = await readFile(path.join(siteDir, ...cssRelPath.split('/')), 'utf8');
  } catch {
    return [];
  }
  const baseDir = path.posix.dirname(cssRelPath);
  const found = [];
  for (const match of content.matchAll(CSS_URL_RE)) {
    const ref = match[2];
    if (!isLocalReference(ref)) continue;
    found.push(resolveRelative(baseDir, ref));
  }
  return found;
}

/**
 * Resolve o conjunto COMPLETO de assets estáticos publicáveis de `site/`
 * alcançáveis a partir de `index.html` (links, `<script>`, grafo de imports
 * JS estático + `import()` dinâmico, `url()` de CSS, ícones declarados em
 * `manifest.json`), mais a inclusão EXPLÍCITA de `site/js/vendor/**`
 * inteiro — carregado em runtime via `<script>` injetado dinamicamente com
 * `new URL(...)` (Task 33), portanto inalcançável pelo grafo de
 * imports/HTML/CSS e sem substituto implícito possível.
 * @param {string} siteDir - diretório absoluto de `site/` (fonte OU cópia no artifact).
 * @returns {Promise<string[]>} URLs no formato `./caminho`, ordenadas.
 */
export async function resolveStaticAssetRelativePaths(siteDir) {
  const indexHtml = await readFile(path.join(siteDir, 'index.html'), 'utf8');
  const { document } = parseHTML(indexHtml);
  const relPaths = new Set(['index.html']);
  const scriptEntryPoints = [];

  for (const link of document.querySelectorAll('link')) {
    const rel = (link.getAttribute('rel') || '').toLowerCase();
    const href = link.getAttribute('href');
    if (!href || !isLocalReference(href)) continue;
    const relevante = rel.split(/\s+/).some((r) => LINK_RELS_RELEVANTES.has(r));
    if (relevante) relPaths.add(resolveRelative('.', href));
  }

  for (const script of document.querySelectorAll('script[src]')) {
    const src = script.getAttribute('src');
    if (!src || !isLocalReference(src)) continue;
    const rel = resolveRelative('.', src);
    relPaths.add(rel);
    scriptEntryPoints.push(rel);
  }

  const jsGraph = await collectJsGraph(scriptEntryPoints, siteDir);
  for (const rel of jsGraph) relPaths.add(rel);

  for (const rel of [...relPaths]) {
    if (rel.endsWith('.css')) {
      for (const assetRel of await collectCssUrlAssets(rel, siteDir)) relPaths.add(assetRel);
    }
  }

  if (relPaths.has('manifest.json')) {
    try {
      const manifestRaw = await readFile(path.join(siteDir, 'manifest.json'), 'utf8');
      const manifestJson = JSON.parse(manifestRaw);
      for (const icon of manifestJson.icons ?? []) {
        if (icon && typeof icon.src === 'string' && isLocalReference(icon.src)) {
          relPaths.add(resolveRelative('.', icon.src));
        }
      }
    } catch {
      // manifest.json inválido/ilegível: completude falha depois, na comparação de bytes/URLs.
    }
  }

  // Regra de inclusão EXPLÍCITA (não implícita): ver docstring da função.
  for (const rel of await listFilesRecursive(path.join(siteDir, 'js', 'vendor'), siteDir)) {
    relPaths.add(rel);
  }

  return [...relPaths].map((rel) => `./${rel}`).sort();
}

/**
 * Confere se um `path` de entrada de `index.json` (JSON do pacote, NÃO
 * confiável mesmo no pacote oficial) é seguro para virar caminho de
 * arquivo: sem `\` (que `path.join`/`path.posix.join` do Windows trata como
 * separador — `"..\\..\\secret.txt"` sobreviveria a um filtro que só olha
 * `/`) e, depois de `path.posix.normalize`, sem nenhum segmento `..`
 * restante (cobre `"a/../../b"`, que colapsa para `"../b"`).
 * @param {string} rawPath - valor bruto de `entry.path` no `index.json`.
 * @returns {boolean}
 */
export function isSafeRelativeEntryPath(rawPath) {
  if (typeof rawPath !== 'string' || rawPath.length === 0) return false;
  if (rawPath.includes('\\')) return false;
  if (rawPath.startsWith('/')) return false;
  const normalized = path.posix.normalize(rawPath);
  if (normalized === '..' || normalized.startsWith('../') || normalized.startsWith('/')) return false;
  return true;
}

/**
 * Resolve o conjunto COMPLETO de JSON de dados a precachear: todos os
 * schemas (`dados/schemas/**`, requisito explícito independente de
 * alcançabilidade) mais, para cada pacote oficial em `dados/pacotes/*`, o
 * próprio `manifest.json`, o `index.json` e todo `path` referenciado pelas
 * entradas do índice (JSON alcançável pelo manifesto/índice do pacote).
 * @param {string} dadosDir - diretório absoluto de `dados/` (fonte OU cópia no artifact).
 * @returns {Promise<string[]>} URLs no formato `../dados/caminho`, ordenadas.
 */
export async function resolveDataAssetRelativePaths(dadosDir) {
  const relPaths = new Set();

  for (const rel of await listFilesRecursive(path.join(dadosDir, 'schemas'), dadosDir)) {
    if (rel.endsWith('.json')) relPaths.add(rel);
  }

  const pacotesDir = path.join(dadosDir, 'pacotes');
  let pacoteEntries;
  try {
    pacoteEntries = (await readdir(pacotesDir, { withFileTypes: true })).filter((e) => e.isDirectory());
  } catch {
    pacoteEntries = [];
  }
  pacoteEntries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of pacoteEntries) {
    const nome = entry.name;
    const pacoteDirRel = `pacotes/${nome}`;
    relPaths.add(`${pacoteDirRel}/manifest.json`);
    relPaths.add(`${pacoteDirRel}/index.json`);
    try {
      const indexRaw = await readFile(path.join(dadosDir, pacoteDirRel, 'index.json'), 'utf8');
      const indexJson = JSON.parse(indexRaw);
      for (const item of indexJson.entries ?? []) {
        if (item && typeof item.path === 'string' && isSafeRelativeEntryPath(item.path)) {
          relPaths.add(`${pacoteDirRel}/${item.path}`);
        }
      }
    } catch {
      // index.json ausente/inválido: completude falha depois, na comparação de bytes/URLs.
    }
  }

  return [...relPaths].map((rel) => `../dados/${rel}`).sort();
}

/**
 * Recalcula, a partir do artifact/fonte de `site/` e `dados/`, o par de
 * listas de URLs esperadas — a MESMA definição usada tanto para gerar
 * quanto para verificar o manifesto, garantindo que as duas etapas nunca
 * divirjam sobre o que "completo" significa.
 * @param {{siteDir: string, dadosDir: string}} args
 * @returns {Promise<{staticUrls: string[], dataUrls: string[]}>}
 */
export async function computeExpectedAssetUrls({ siteDir, dadosDir }) {
  const [staticUrls, dataUrls] = await Promise.all([
    resolveStaticAssetRelativePaths(siteDir),
    resolveDataAssetRelativePaths(dadosDir),
  ]);
  return { staticUrls, dataUrls };
}

/**
 * Valida a forma de uma URL de asset do manifesto: proíbe URL externa,
 * `?`/`#`, path absoluto e travessia para fora do escopo permitido
 * (`./…` para estáticos; `../dados/…`, sem `..` depois, para dados).
 * @param {string} url
 * @param {'static'|'data'} kind
 * @returns {string} a própria URL, se válida.
 */
export function validateAssetUrl(url, kind) {
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error(`URL de asset inválida: ${JSON.stringify(url)}`);
  }
  // `\` nunca é válido numa URL de asset. Rejeitado ANTES de qualquer outra
  // checagem: em Windows, `path.join`/`path.posix.join(...rel.split('/'))`
  // trata `\` como separador de diretório, então um valor como
  // `"..\\..\\secret.txt"` — vindo de JSON de pacote NÃO confiável — passaria
  // ileso por um filtro que só enxerga segmentos separados por `/` e
  // escaparia do escopo permitido durante a leitura real do arquivo.
  if (url.includes('\\')) {
    throw new Error(`URL de asset não pode conter "\\" (separador não-POSIX): ${url}`);
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url) || url.startsWith('//')) {
    throw new Error(`URL de asset não pode ser externa: ${url}`);
  }
  if (url.includes('?')) throw new Error(`URL de asset não pode ter query string: ${url}`);
  if (url.includes('#')) throw new Error(`URL de asset não pode ter fragment: ${url}`);
  if (url.startsWith('/')) throw new Error(`URL de asset não pode ser path absoluto: ${url}`);

  if (kind === 'static') {
    if (!url.startsWith('./')) throw new Error(`URL de asset estático deve começar com "./": ${url}`);
    const rest = url.slice(2);
    if (rest.split('/').includes('..')) {
      throw new Error(`URL de asset estático não pode conter travessia "..": ${url}`);
    }
    // Defesa adicional: normaliza (`path.posix.normalize`) para pegar
    // travessia que só aparece DEPOIS de colapsar segmentos (ex.: `a/../../b`).
    const normalizedRest = path.posix.normalize(rest);
    if (normalizedRest === '..' || normalizedRest.startsWith('../')) {
      throw new Error(`URL de asset estático escapa do escopo após normalização: ${url}`);
    }
  } else if (kind === 'data') {
    if (!url.startsWith('../dados/')) {
      throw new Error(`URL de asset de dados deve começar com "../dados/": ${url}`);
    }
    const rest = url.slice('../dados/'.length);
    if (rest.split('/').includes('..')) {
      throw new Error(`URL de asset de dados não pode escapar de "../dados": ${url}`);
    }
    const normalizedRest = path.posix.normalize(rest);
    if (normalizedRest === '..' || normalizedRest.startsWith('../')) {
      throw new Error(`URL de asset de dados escapa de "../dados" após normalização: ${url}`);
    }
  } else {
    throw new Error(`kind de asset desconhecido: ${kind}`);
  }
  return url;
}

/**
 * Valida a integridade estrutural de um manifesto já construído: cada URL é
 * segura (ver `validateAssetUrl`), não há duplicatas entre as duas listas, e
 * o próprio `precache-manifest.json` nunca se autoenumera.
 * @param {{staticAssets: Array<{url:string}>, dataAssets: Array<{url:string}>}} manifest
 * @returns {object} o próprio manifesto, se válido.
 */
export function assertManifestIntegrity(manifest) {
  const seen = new Set();
  for (const kind of ['static', 'data']) {
    const lista = kind === 'static' ? manifest.staticAssets : manifest.dataAssets;
    for (const entry of lista) {
      validateAssetUrl(entry.url, kind);
      if (entry.url === './precache-manifest.json') {
        throw new Error('precache-manifest.json não pode se autoenumerar no manifesto.');
      }
      if (seen.has(entry.url)) {
        throw new Error(`URL duplicada no manifesto: ${entry.url}`);
      }
      seen.add(entry.url);
    }
  }
  return manifest;
}

/**
 * Calcula o SHA-256 de cada URL de uma lista, lendo os bytes finais já
 * materializados no artifact (`baseDistDir` + o caminho após o prefixo).
 * @param {string[]} urls - já ordenadas, no formato `prefix + caminho`.
 * @param {string} prefix - `'./'` para estáticos, `'../dados/'` para dados.
 * @param {string} baseDistDir - diretório absoluto correspondente ao prefixo.
 * @returns {Promise<Array<{url: string, sha256: string}>>}
 */
async function hashUrls(urls, prefix, baseDistDir) {
  const out = [];
  for (const url of urls) {
    const rel = url.slice(prefix.length);
    const bytes = await readFile(path.join(baseDistDir, ...rel.split('/')));
    out.push({ url, sha256: sha256Hex(bytes) });
  }
  return out;
}

/**
 * Constrói o manifesto de precache final: para cada URL esperada, lê os
 * bytes JÁ MATERIALIZADOS no artifact (`siteDistDir`/`dadosDistDir`, depois
 * de qualquer transformação — ex.: substituição do marcador de versão) e
 * calcula o SHA-256 real. Valida a integridade estrutural antes de devolver.
 * @param {{deployVersion: string, siteDistDir: string, dadosDistDir: string, staticUrls: string[], dataUrls: string[]}} args
 * @returns {Promise<object>} `{schemaVersion, deployVersion, staticAssets, dataAssets}`
 */
export async function buildPrecacheManifest({ deployVersion, siteDistDir, dadosDistDir, staticUrls, dataUrls }) {
  // Validação ANTES de qualquer acesso a filesystem: uma URL hostil/malformada
  // é rejeitada aqui, nunca chega a `hashUrls` (que abriria o arquivo). Sem
  // isso, o modo de falha de uma URL inválida seria um ENOENT genérico em vez
  // do erro de validação documentado — e, pior, o arquivo já teria sido lido.
  for (const url of staticUrls) validateAssetUrl(url, 'static');
  for (const url of dataUrls) validateAssetUrl(url, 'data');

  const staticAssets = await hashUrls(staticUrls, './', siteDistDir);
  const dataAssets = await hashUrls(dataUrls, '../dados/', dadosDistDir);
  const manifest = {
    schemaVersion: 1,
    deployVersion,
    staticAssets,
    dataAssets,
  };
  return assertManifestIntegrity(manifest);
}

/**
 * Serializa o manifesto em JSON determinístico (2 espaços, `\n` final) —
 * mesmos bytes para as mesmas entradas, execução após execução.
 * @param {object} manifest
 * @returns {string}
 */
export function serializeManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Confere se um caminho existe e é arquivo regular (usado pelos scripts de
 * build/verify para checagens rápidas de layout).
 * @param {string} absPath
 * @returns {Promise<boolean>}
 */
export async function isRegularFile(absPath) {
  try {
    const s = await stat(absPath);
    return s.isFile();
  } catch {
    return false;
  }
}
