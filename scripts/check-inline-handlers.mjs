#!/usr/bin/env node
// ============================================================
// check:inline-handlers (Task 37) — dois gates complementares sobre `site/`:
//
//   1. NENHUM handler inline (`onclick=`, `onchange=`, `oninput=`, ...) em
//      HTML ou em template/string de JS. Handler inline exige
//      `'unsafe-inline'` em `script-src` na CSP; toda interação passa por
//      event delegation (`site/js/ui/event-delegation.js`).
//
//   2. NENHUMA atribuição `window.<nome> = ...` fora da allowlist TEMPORÁRIA
//      abaixo. Globais de janela são a "cola" legada entre módulos; a
//      allowlist congela os quatro que a Task 34 ainda precisa (navegação e
//      modal do shell) e qualquer global novo falha aqui em vez de crescer
//      em silêncio.
//
// `site/js/vendor/**` (pdf-lib minificado, terceiro) fica fora das duas
// varreduras: não é código nosso e não gera markup do app.
// ============================================================

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// Allowlist TEMPORÁRIA (Task 34) de globais de janela ainda necessários:
//   - `navegar`/`definirTituloHeader` (site/js/app.js): navegação e título do
//     shell, usados por páginas que não podem importar app.js (ciclo).
//   - `fecharModal`/`fecharModalTodos` (site/js/utils.js): fechamento de
//     modal a partir de conteúdo desenhado dinamicamente.
// Remover um item daqui exige migrar os consumidores para imports/portas.
export const WINDOW_GLOBAL_ALLOWLIST = Object.freeze([
  'navegar',
  'definirTituloHeader',
  'fecharModal',
  'fecharModalTodos',
]);

// Propriedades de `window` que NÃO são registro de global do app (estado do
// próprio navegador) e por isso não passam pela allowlist.
const WINDOW_BUILTIN_TARGETS = Object.freeze(['location', 'onerror', 'onunhandledrejection', 'name']);

// Atributos de handler inline: `on` + letras, seguido de `=` e aspas.
// Exige um separador de atributo antes (espaço) para não casar, por exemplo,
// `confirmation=` ou identificadores contendo "on...".
const INLINE_HANDLER_PATTERN = /\son[a-z]+\s*=\s*["'`]/gi;

// Atribuição a `window.<nome>` (excluindo comparações `==`/`===`).
const WINDOW_ASSIGN_PATTERN = /\bwindow\.([A-Za-z_$][\w$]*)\s*=(?!=)/g;

/**
 * Remove comentários de linha e de bloco de um fonte JS, para as varreduras
 * não casarem com prosa (vários módulos documentam exatamente o padrão
 * proibido, ex.: "antes era onclick=\"fecharModal()\"").
 * @param {string} source
 * @returns {string}
 */
function semComentarios(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Remove comentários HTML (`<!-- ... -->`) de um fonte HTML.
 * @param {string} source
 * @returns {string}
 */
function semComentariosHtml(source) {
  return source.replace(/<!--[\s\S]*?-->/g, ' ');
}

/**
 * Lista recursivamente os arquivos sob `dir` com as extensões dadas,
 * pulando `site/js/vendor/**`.
 * @param {string} dir
 * @param {Set<string>} extensions
 * @returns {Promise<string[]>}
 */
async function walk(dir, extensions) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const found = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const rel = path.relative(repoRoot, fullPath).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (rel === 'site/js/vendor') continue;
      found.push(...(await walk(fullPath, extensions)));
    } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      found.push(fullPath);
    }
  }
  return found;
}

/**
 * Avalia um fonte (HTML ou JS) e devolve as violações `{rule, line, detail}`.
 * Pura sobre o texto, para ser testável sem tocar o disco.
 * @param {string} source - conteúdo do arquivo.
 * @param {{kind: 'html'|'js', allowlist?: ReadonlyArray<string>}} options
 * @returns {Array<{rule: string, line: number, detail: string}>}
 */
export function analyzeInlineHandlers(source, { kind, allowlist = WINDOW_GLOBAL_ALLOWLIST }) {
  const code = kind === 'html' ? semComentariosHtml(source) : semComentarios(source);
  const violations = [];

  /**
   * Converte um índice de caractere na linha (1-indexada) correspondente.
   * @param {number} index
   * @returns {number}
   */
  const lineOf = (index) => code.slice(0, index).split('\n').length;

  INLINE_HANDLER_PATTERN.lastIndex = 0;
  let match = INLINE_HANDLER_PATTERN.exec(code);
  while (match) {
    violations.push({
      rule: 'inline-handler',
      line: lineOf(match.index),
      detail: `handler inline "${match[0].trim()}" — migre para event delegation (data-action)`,
    });
    match = INLINE_HANDLER_PATTERN.exec(code);
  }

  if (kind === 'js') {
    WINDOW_ASSIGN_PATTERN.lastIndex = 0;
    let assign = WINDOW_ASSIGN_PATTERN.exec(code);
    while (assign) {
      const name = assign[1];
      if (!allowlist.includes(name) && !WINDOW_BUILTIN_TARGETS.includes(name)) {
        violations.push({
          rule: 'window-global',
          line: lineOf(assign.index),
          detail: `atribuição "window.${name} = ..." fora da allowlist [${allowlist.join(', ')}]`,
        });
      }
      assign = WINDOW_ASSIGN_PATTERN.exec(code);
    }
  }

  return violations;
}

/**
 * Ponto de entrada de linha de comando: varre `site/**` (HTML e JS, exceto
 * vendor) e sai com código 1 listando cada violação, ou 0 quando limpo.
 * @returns {Promise<number>}
 */
async function main() {
  const files = await walk(path.join(repoRoot, 'site'), new Set(['.html', '.js', '.mjs']));
  let total = 0;
  for (const file of files) {
    const rel = path.relative(repoRoot, file).split(path.sep).join('/');
    const source = await readFile(file, 'utf8');
    const kind = path.extname(file) === '.html' ? 'html' : 'js';
    for (const violation of analyzeInlineHandlers(source, { kind })) {
      total += 1;
      console.error(`  - ${rel}:${violation.line} [${violation.rule}] ${violation.detail}`);
    }
  }
  if (total > 0) {
    console.error(`check:inline-handlers: ${total} violação(ões).`);
    return 1;
  }
  console.log(`check:inline-handlers: OK (${files.length} arquivos varridos, allowlist window.*: ${WINDOW_GLOBAL_ALLOWLIST.join(', ')}).`);
  return 0;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error('check:inline-handlers: falha inesperada.', error);
      process.exit(1);
    },
  );
}
