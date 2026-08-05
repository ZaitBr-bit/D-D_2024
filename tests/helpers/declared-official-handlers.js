// Helper compartilhado: a varredura do catálogo REAL
// (`dados/pacotes/dnd2024/**`) atrás de todo efeito `official-handler`
// declarado.
//
// ## Por que isto virou um helper (Task 30)
//
// Ele nasceu dentro de `tests/contract/official-handler-coverage.test.js`
// (Task 22a), onde responde "todo `handlerId` declarado tem handler
// registrado?". A Task 30 precisa responder uma pergunta IRMÃ — "toda ação
// desses handlers tem um elemento na interface, e clicá-lo devolve `ok` ou um
// erro declarado?" — e o brief é explícito: as duas listas têm de sair da
// MESMA fonte, para que não possam divergir.
//
// Duas cópias da varredura divergiriam no primeiro dia em que alguém
// acrescentasse um `official-handler` num lugar novo do JSON: a cobertura de
// handler continuaria verde (porque a cópia dela veria o id) e a cobertura de
// interface ficaria cega para a ação nova — que é precisamente o "clique que
// não faz nada" que a Task 30 existe para tornar impossível.
//
// A varredura é RECURSIVA sobre o item inteiro, e não só sobre `item.effects`:
// o vocabulário permite um `official-handler` dentro de
// `choice.options[].grants[]` (é assim que "Iniciado em Magia" declara
// `choose-cantrips-from-class-list`). Olhar só o primeiro nível deixaria esses
// ids invisíveis.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = new URL('../../', import.meta.url);

/** Raiz do pacote oficial varrido. */
export const PACKAGE_ROOT = fileURLToPath(new URL('dados/pacotes/dnd2024', repoRoot));

/** Prefixo dos `handlerId` de ESCOPO DE CLASSE. */
export const CLASS_HANDLER_ID_PREFIX = 'class-';

/**
 * Lista, recursivamente, todo arquivo com a extensão pedida sob `dir`.
 * @param {string} dir
 * @param {string} extension
 * @returns {Array<string>} caminhos absolutos
 */
export function listFiles(dir, extension) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full, extension));
    } else if (entry.endsWith(extension)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Lista, recursivamente, todo arquivo `.json` de `dir`.
 * @param {string} dir
 * @returns {Array<string>}
 */
export function listJsonFiles(dir) {
  return listFiles(dir, '.json');
}

/**
 * Coleta todo efeito `official-handler` do pacote, com o arquivo e a entidade
 * que o declara.
 * @param {ReadonlyArray<string>|null} [onlyRelative] - restringe a estes
 *   caminhos relativos à raiz do pacote.
 * @returns {Array<{handlerId: string, entityId: string, file: string}>}
 */
export function collectDeclaredHandlers(onlyRelative = null) {
  const files =
    onlyRelative === null ? listJsonFiles(PACKAGE_ROOT) : onlyRelative.map((relative) => path.join(PACKAGE_ROOT, relative));
  const found = [];
  for (const file of files) {
    let doc;
    try {
      doc = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    const items = Array.isArray(doc?.items) ? doc.items : [];
    const relative = path.relative(PACKAGE_ROOT, file).replaceAll('\\', '/');
    for (const item of items) {
      const stack = [item];
      while (stack.length > 0) {
        const node = stack.pop();
        if (node === null || typeof node !== 'object') {
          continue;
        }
        if (!Array.isArray(node) && node.type === 'official-handler' && typeof node.handlerId === 'string') {
          found.push({ handlerId: node.handlerId, entityId: item.id, file: relative });
        }
        stack.push(...Object.values(node).filter((value) => value !== null && typeof value === 'object'));
      }
    }
  }
  return found;
}

/**
 * Os `handlerId` de escopo de CLASSE declarados no catálogo, com a entidade que
 * os declara — a fonte única das DUAS coberturas (handler registrado e
 * interface).
 * @returns {Array<{handlerId: string, entityId: string, file: string}>}
 */
export function collectDeclaredClassHandlers() {
  const porId = new Map();
  for (const entry of collectDeclaredHandlers()) {
    if (entry.handlerId.startsWith(CLASS_HANDLER_ID_PREFIX) && !porId.has(entry.handlerId)) {
      porId.set(entry.handlerId, entry);
    }
  }
  return [...porId.values()].sort((a, b) => a.handlerId.localeCompare(b.handlerId));
}

/**
 * Remove as linhas de comentário de um fonte JS. As varreduras de "quem lê
 * este id" precisam ignorar comentários, que PODEM citar os ids (e citam).
 * @param {string} source
 * @returns {string}
 */
export function stripLineComments(source) {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
}
