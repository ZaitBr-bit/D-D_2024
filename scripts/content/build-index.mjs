#!/usr/bin/env node
// `scripts/content/build-index.mjs`: gera `index.json` de um pacote de
// conteúdo (`dados/pacotes/<nome>/`) a partir dos arquivos de entidade
// realmente presentes no disco, considerando SOMENTE os tipos declarados
// ativos em `manifest.entities` — um pacote `status: "building"` (como o
// `dnd2024` desta tarefa) pode ter, no futuro, arquivos de tipos ainda não
// prontos (classes, magias, ...); este script nunca os indexa antes que o
// manifesto declare esses tipos como ativos, para que o índice nunca aponte
// para conteúdo que a própria tarefa staging ainda não valida.
//
// `index.entries` é montado como um array ORDENADO de forma determinística
// (por caminho relativo do arquivo, depois por posição dentro do arquivo
// para arquivos-coleção) — nunca convertido para mapa por id antes da
// checagem de duplicidade, seguindo a mesma regra de
// `dados/schemas/v1/index.schema.json` (ver seu comentário de topo).
//
// Uso:
//   node scripts/content/build-index.mjs --write [--package <nome>]
//     Escreve dados/pacotes/<nome>/index.json.
//   node scripts/content/build-index.mjs --check [--package <nome>]
//     Gera em memória e compara byte a byte com o index.json committed;
//     sai com código de saída diferente de zero se divergir ou se houver
//     qualquer inconsistência (ex.: id duplicado).

import { readFile, readdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const packagesDir = path.join(repoRoot, 'dados', 'pacotes');

/**
 * Converte um caminho de sistema de arquivos (potencialmente com `\` no
 * Windows) para a forma POSIX usada em `index.entries[].path` — os pacotes
 * de conteúdo são consumidos por `fetch`/import estático no navegador, que
 * sempre espera `/`, nunca `\`.
 * @param {string} value
 * @returns {string}
 */
function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

/**
 * Lista recursivamente todos os arquivos `.json` sob `dir`, devolvendo
 * caminhos relativos a `dir` em ordem lexicográfica ASCII estável (a mesma
 * ordem em qualquer sistema operacional, já que comparamos a forma POSIX).
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {Promise<string[]>}
 */
export async function listJsonFilesRecursively(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = [];
  for (const dirent of entries) {
    const relPath = prefix ? `${prefix}/${dirent.name}` : dirent.name;
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      found.push(...(await listJsonFilesRecursively(fullPath, relPath)));
    } else if (dirent.isFile() && dirent.name.endsWith('.json')) {
      found.push(relPath);
    }
  }
  return found.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Constrói, em memória, o índice ordenado de um pacote: lê `manifest.json`
 * para saber os tipos ativos, varre todos os `.json` do pacote (exceto
 * `manifest.json`/`index.json`) e, para cada um que seja uma entidade de
 * tipo ativo (arquivo único) ou uma coleção (`collection.schema.json`,
 * `items: [...]`) de tipo ativo, gera as entradas correspondentes.
 * Lança `Error` (nunca devolve índice parcial) se encontrar um id
 * duplicado — falha alta e cedo é preferível a um índice ambíguo.
 * @param {string} packageDir
 * @returns {Promise<{schemaVersion: string, entries: Array<object>, warnings: string[]}>}
 */
export async function buildIndexForPackage(packageDir) {
  const manifest = JSON.parse(await readFile(path.join(packageDir, 'manifest.json'), 'utf8'));
  const activeTypes = new Set(Array.isArray(manifest.entities) ? manifest.entities : []);

  const jsonFiles = (await listJsonFilesRecursively(packageDir)).filter(
    (relPath) => relPath !== 'manifest.json' && relPath !== 'index.json',
  );

  const entries = [];
  const warnings = [];
  const seenIds = new Map();

  for (const relPath of jsonFiles) {
    const absPath = path.join(packageDir, relPath);
    const posixPath = toPosixPath(relPath);
    let content;
    try {
      content = JSON.parse(await readFile(absPath, 'utf8'));
    } catch (error) {
      throw new Error(`build-index: não foi possível ler/parsear "${posixPath}": ${error.message}`);
    }

    if (content && typeof content === 'object' && Array.isArray(content.items) && typeof content.type === 'string') {
      // Arquivo-coleção (collection.schema.json): uma entrada por item, com
      // `pointer` apontando a posição dentro de `items`. O tipo declarado no
      // ENVELOPE (`content.type`) é só o portão de ativação do ARQUIVO — um
      // arquivo-coleção pode legitimamente misturar tipos (ex.:
      // `classes/*.json` tem envelope "class" mas mistura itens "class",
      // "subclass" e "feature", cada característica de nível decomposta como
      // sua própria entidade `feature`; ver `scripts/content/migrate-classes.mjs`).
      // Cada ENTRADA de índice usa o tipo do PRÓPRIO item (`item.type`), não
      // o do envelope — do contrário toda característica de uma classe seria
      // indexada como se fosse uma entidade "class", nunca "feature"/
      // "subclass" (bug latente nunca exercitado antes da Task 10, primeira
      // vez em que um pacote com arquivos-coleção de tipo misto é ativado).
      // Um item só é indexado se o SEU tipo estiver ativo (não basta o
      // envelope estar) — mesma regra de tipo-ativo aplicada uniformemente.
      if (!activeTypes.has(content.type)) {
        continue;
      }
      content.items.forEach((item, i) => {
        if (!item || typeof item.id !== 'string') {
          warnings.push(`"${posixPath}" items[${i}] não tem "id" string; ignorado.`);
          return;
        }
        const itemType = typeof item.type === 'string' ? item.type : content.type;
        if (!activeTypes.has(itemType)) {
          return;
        }
        registerEntry(entries, seenIds, { id: item.id, type: itemType, path: posixPath, pointer: `/items/${i}` });
      });
      continue;
    }

    if (content && typeof content === 'object' && typeof content.id === 'string' && typeof content.type === 'string') {
      // Arquivo de entidade única: sem `pointer`.
      if (!activeTypes.has(content.type)) {
        continue;
      }
      registerEntry(entries, seenIds, { id: content.id, type: content.type, path: posixPath });
      continue;
    }

    warnings.push(`"${posixPath}" não é uma entidade nem uma coleção reconhecível; ignorado.`);
  }

  // Ordem final determinística: por path e, dentro do mesmo path, pela
  // ordem de aparição no array `items` (já garantida por `registerEntry`
  // preservar a ordem de inserção) — `jsonFiles` já está ordenado, então
  // basta manter a ordem de construção.
  return { schemaVersion: '1.0.0', entries, warnings };
}

/**
 * Adiciona uma entrada ao array de entries em construção, lançando se o id
 * já tiver sido registrado por outra entrada (arquivo/posição diferentes).
 * @param {Array<object>} entries
 * @param {Map<string, string>} seenIds
 * @param {{id: string, type: string, path: string, pointer?: string}} entry
 */
function registerEntry(entries, seenIds, entry) {
  if (seenIds.has(entry.id)) {
    throw new Error(
      `build-index: id duplicado "${entry.id}" — já registrado em "${seenIds.get(entry.id)}", ` +
        `encontrado de novo em "${entry.path}${entry.pointer ? entry.pointer : ''}".`,
    );
  }
  seenIds.set(entry.id, `${entry.path}${entry.pointer ? entry.pointer : ''}`);
  entries.push(entry);
}

/**
 * Serializa o índice para o mesmo formato usado no arquivo committed:
 * JSON com indentação de 2 espaços e uma quebra de linha final.
 * @param {{schemaVersion: string, entries: Array<object>}} index
 * @returns {string}
 */
function serializeIndex(index) {
  return `${JSON.stringify({ schemaVersion: index.schemaVersion, entries: index.entries }, null, 2)}\n`;
}

/**
 * @param {string[]} argv
 * @returns {{mode: 'write' | 'check', packageName: string}}
 */
function parseArgs(argv) {
  const hasWrite = argv.includes('--write');
  const hasCheck = argv.includes('--check');
  if (hasWrite === hasCheck) {
    throw new Error('Uso: node scripts/content/build-index.mjs (--write | --check) [--package <nome>]');
  }
  const packageFlagIndex = argv.indexOf('--package');
  const packageName = packageFlagIndex !== -1 ? argv[packageFlagIndex + 1] : 'dnd2024';
  if (!packageName) {
    throw new Error('--package exige um nome de pacote.');
  }
  return { mode: hasWrite ? 'write' : 'check', packageName };
}

async function main() {
  const { mode, packageName } = parseArgs(process.argv.slice(2));
  const packageDir = path.join(packagesDir, packageName);

  try {
    await stat(packageDir);
  } catch {
    throw new Error(`build-index: pacote "${packageName}" não encontrado em ${path.relative(repoRoot, packageDir)}.`);
  }

  const { schemaVersion, entries, warnings } = await buildIndexForPackage(packageDir);
  for (const warning of warnings) {
    process.stderr.write(`build-index: aviso: ${warning}\n`);
  }
  const serialized = serializeIndex({ schemaVersion, entries });
  const indexPath = path.join(packageDir, 'index.json');

  if (mode === 'write') {
    await writeFile(indexPath, serialized, 'utf8');
    process.stdout.write(`build-index: escrito ${path.relative(repoRoot, indexPath)} (${entries.length} entrada(s)).\n`);
    return;
  }

  let existing;
  try {
    existing = await readFile(indexPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      process.stderr.write(
        `build-index: ${path.relative(repoRoot, indexPath)} não existe. Rode com --write primeiro.\n`,
      );
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  if (existing !== serialized) {
    process.stderr.write(
      `build-index: ${path.relative(repoRoot, indexPath)} está desatualizado em relação aos arquivos de entidade do pacote. ` +
        `Rode "node scripts/content/build-index.mjs --write --package ${packageName}" e commit o resultado.\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`build-index: ${path.relative(repoRoot, indexPath)} está atualizado (${entries.length} entrada(s)).\n`);
}

const isDirectCliInvocation =
  typeof process.argv[1] === 'string' &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isDirectCliInvocation) {
  main().catch((error) => {
    process.stderr.write(`build-index: erro fatal: ${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
