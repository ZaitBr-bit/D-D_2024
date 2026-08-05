// Script pontual (não faz parte da lista de arquivos do brief da Task 12,
// mas é a ferramenta usada para produzir
// dados/pacotes/dnd2024/migrations/character-v1-aliases.json de forma
// mecânica e verificável): lê o índice do pacote dnd2024 e, para cada
// entidade de um dos tipos referenciáveis por uma ficha legada (ruleset,
// class, subclass, species, background, feat, spell, weapon, armor,
// equipment), extrai o par exato `{ from: entity.name, to: entity.id }` e
// mescla no arquivo de aliases existente (que já tinha as entradas de
// ability/skill/condition/damage-type/language extraídas manualmente do
// código legado pela Task 7).
//
// Não há normalização aproximada aqui: o `from` é copiado literalmente do
// campo `name` da própria entidade de conteúdo (que a Task 7 já traduziu a
// partir do mesmo nome em português usado pelo app legado) — é extração
// mecânica de dado já existente, não inferência.
//
// Uso: node scripts/extend-character-v1-aliases.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PACKAGE_DIR = path.join(ROOT, 'dados/pacotes/dnd2024');
const ALIASES_PATH = path.join(PACKAGE_DIR, 'migrations/character-v1-aliases.json');

const REFERENCEABLE_TYPES = new Set([
  'ruleset',
  'class',
  'subclass',
  'species',
  'background',
  'feat',
  'spell',
  'weapon',
  'armor',
  'equipment',
]);

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(PACKAGE_DIR, relativePath), 'utf8'));
}

function resolvePointer(document, pointer) {
  if (pointer === undefined || pointer === '' || pointer === '/') {
    return document;
  }
  const segments = pointer.split('/').slice(1).map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
  let current = document;
  for (const segment of segments) {
    current = Array.isArray(current) ? current[Number(segment)] : current[segment];
  }
  return current;
}

function main() {
  const index = readJson('index.json');
  const fileCache = new Map();
  const seenFrom = new Map();

  for (const entry of index.entries) {
    if (!REFERENCEABLE_TYPES.has(entry.type)) {
      continue;
    }
    if (!fileCache.has(entry.path)) {
      fileCache.set(entry.path, readJson(entry.path));
    }
    const fileContent = fileCache.get(entry.path);
    const entity = resolvePointer(fileContent, entry.pointer);
    if (!entity || typeof entity.name !== 'string' || entity.name.length === 0) {
      throw new Error(`Entidade sem "name" resolvível: ${entry.id} (${entry.path}${entry.pointer})`);
    }
    seenFrom.has(entity.name) ? seenFrom.get(entity.name).push(entity.id) : seenFrom.set(entity.name, [entity.id]);
  }

  // Dois conteúdos diferentes com o mesmo nome em português são ambíguos:
  // não é seguro gerar alias automático para NENHUMA das ocorrências (nem a
  // primeira) — quem migrar vai cair no caminho de reparo ambíguo (override
  // explícito) em vez de escolher silenciosamente. `seenFrom` acumula TODAS
  // as ocorrências de cada nome antes de decidir, então a checagem cobre a
  // primeira ocorrência também (não só a partir da segunda).
  const generated = [];
  for (const [name, ids] of seenFrom) {
    if (new Set(ids).size === 1) {
      generated.push({ from: name, to: ids[0] });
    }
  }

  const current = JSON.parse(readFileSync(ALIASES_PATH, 'utf8'));
  const existingFrom = new Set(current.mappings.map((m) => m.from));
  const additions = generated.filter((m) => !existingFrom.has(m.from));

  current.mappings.push(...additions);
  writeFileSync(ALIASES_PATH, `${JSON.stringify(current, null, 2)}\n`, 'utf8');

  console.log(`character-v1-aliases: +${additions.length} mapeamento(s) (total ${current.mappings.length}).`);
}

main();
