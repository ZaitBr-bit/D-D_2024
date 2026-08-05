#!/usr/bin/env node
// `scripts/content/content-id-map.mjs`: utilitário de mapeamento de nomes
// legados/canônicos para ContentIds v1 (`namespace:type:slug`), e validador
// do inventário de IDs pré-reservados em
// `tests/fixtures/content/dnd2024-id-inventory.json`.
//
// Contexto: a Task 7 só constrói o ruleset central do pacote `dnd2024`
// (abilities/skills/conditions/damage-types/languages/migration-map). As
// Tasks 8-10 adicionam classes, subclasses, espécies, antecedentes, talentos,
// magias e equipamento — mas o ESQUEMA DE NOMES dos ids que elas vão usar
// precisa ser fixado agora, para que nenhuma tarefa futura invente um slug
// diferente para a mesma entidade (o que quebraria referências cruzadas e
// exigiria uma migração). Este módulo é a fonte única de verdade de como um
// nome (legado ou não) vira um slug de ContentId, e valida que o inventário
// pré-registrado é internamente consistente com essa regra.
//
// Uso como CLI:
//   node scripts/content/content-id-map.mjs --check
//     Valida tests/fixtures/content/dnd2024-id-inventory.json e sai com
//     código de saída diferente de zero se houver qualquer inconsistência.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parseContentId, formatContentId } from '../../site/js/core/content-id.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const defaultInventoryPath = path.join(
  repoRoot,
  'tests',
  'fixtures',
  'content',
  'dnd2024-id-inventory.json',
);

// Mapa de substituição de acentuação ASCII, na mesma linha do restante do
// pacote dnd2024 (nomes em português com diacríticos -> slug ASCII).
const DIACRITIC_MAP = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n', ý: 'y',
};

/**
 * Remove diacríticos de uma string, caractere a caractere, usando
 * `DIACRITIC_MAP` (evita depender de `String.normalize` + regex Unicode para
 * manter o comportamento explícito e fácil de auditar).
 * @param {string} value
 * @returns {string}
 */
function stripDiacritics(value) {
  return value
    .split('')
    .map((char) => DIACRITIC_MAP[char.toLowerCase()] ?? char)
    .join('');
}

/**
 * Converte um nome (tipicamente em português, com acentos e maiúsculas) no
 * slug ASCII kebab-case canônico usado no segmento final de um ContentId.
 * Determinístico: o mesmo nome sempre produz o mesmo slug, e é a MESMA regra
 * usada para gerar os slugs commitados nos arquivos de conteúdo desta tarefa
 * e no inventário de IDs reservados — `validateIdInventory` confere que o
 * inventário respeita esta regra, para que uma tarefa futura não possa
 * reservar um slug divergente do que este módulo produziria para o mesmo
 * nome.
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError('slugify: "name" deve ser uma string não vazia.');
  }
  return stripDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * Monta o ContentId `namespace:type:slug` canônico para um nome de entidade.
 * @param {string} namespace
 * @param {string} type
 * @param {string} name
 * @returns {string}
 */
export function buildContentId(namespace, type, name) {
  return formatContentId({ namespace, type, slug: slugify(name) });
}

/**
 * Carrega e faz o parse do inventário de IDs reservados.
 * @param {string} [inventoryPath]
 * @returns {Promise<*>}
 */
export async function loadIdInventory(inventoryPath = defaultInventoryPath) {
  const raw = await readFile(inventoryPath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Valida a consistência interna do inventário de IDs reservados:
 *   - `namespace` é uma string não vazia;
 *   - `reserved` é um objeto cujas chaves são tipos de entidade e cujos
 *     valores são arrays de `{id, name}`;
 *   - cada `id` é um ContentId bem formado, com `namespace` igual ao
 *     declarado no topo e segmento de tipo igual à chave que o contém;
 *   - o slug de cada `id` é exatamente `slugify(name)` (nenhum slug
 *     divergente da regra canônica);
 *   - não há `id` duplicado, nem dentro do mesmo tipo nem entre tipos.
 * Nunca lança para entrada malformada — sempre devolve `{valid, errors}`.
 * @param {*} inventory
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateIdInventory(inventory) {
  const errors = [];

  if (inventory === null || typeof inventory !== 'object' || Array.isArray(inventory)) {
    return { valid: false, errors: ['O inventário deve ser um objeto.'] };
  }

  const { namespace, reserved } = inventory;
  if (typeof namespace !== 'string' || namespace.length === 0) {
    errors.push('"namespace" deve ser uma string não vazia.');
  }
  if (reserved === null || typeof reserved !== 'object' || Array.isArray(reserved)) {
    errors.push('"reserved" deve ser um objeto mapeando tipo de entidade -> array de {id, name}.');
    return { valid: errors.length === 0, errors };
  }

  const seenIds = new Set();
  for (const [type, entries] of Object.entries(reserved)) {
    if (!Array.isArray(entries)) {
      errors.push(`reserved["${type}"] deve ser um array.`);
      continue;
    }
    const seenSlugsForType = new Set();
    for (const [i, entry] of entries.entries()) {
      const entryLabel = `reserved["${type}"][${i}]`;
      if (entry === null || typeof entry !== 'object') {
        errors.push(`${entryLabel} deve ser um objeto {id, name}.`);
        continue;
      }
      const { id, name } = entry;
      if (typeof name !== 'string' || name.length === 0) {
        errors.push(`${entryLabel}.name deve ser uma string não vazia.`);
        continue;
      }
      const parsed = parseContentId(id);
      if (!parsed.ok) {
        errors.push(`${entryLabel}.id ("${id}") não é um ContentId válido: ${parsed.error.message}`);
        continue;
      }
      if (parsed.value.namespace !== namespace) {
        errors.push(`${entryLabel}.id ("${id}") tem namespace "${parsed.value.namespace}", esperado "${namespace}".`);
      }
      if (parsed.value.type !== type) {
        errors.push(`${entryLabel}.id ("${id}") tem tipo "${parsed.value.type}", esperado "${type}" (a chave que o contém).`);
      }
      const expectedSlug = slugify(name);
      if (parsed.value.slug !== expectedSlug) {
        errors.push(
          `${entryLabel}.id ("${id}") tem slug "${parsed.value.slug}", mas slugify("${name}") produz "${expectedSlug}".`,
        );
      }
      if (seenSlugsForType.has(parsed.value.slug)) {
        errors.push(`${entryLabel}: slug "${parsed.value.slug}" duplicado dentro do tipo "${type}".`);
      }
      seenSlugsForType.add(parsed.value.slug);
      if (seenIds.has(id)) {
        errors.push(`${entryLabel}: id "${id}" duplicado no inventário.`);
      }
      seenIds.add(id);
    }
  }

  return { valid: errors.length === 0, errors };
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.includes('--check')) {
    process.stderr.write('Uso: node scripts/content/content-id-map.mjs --check [caminho-do-inventario]\n');
    process.exitCode = 1;
    return;
  }
  const explicitPath = args.find((arg) => !arg.startsWith('--'));
  const inventoryPath = explicitPath ? path.resolve(process.cwd(), explicitPath) : defaultInventoryPath;

  const inventory = await loadIdInventory(inventoryPath);
  const { valid, errors } = validateIdInventory(inventory);

  if (valid) {
    const total = Object.values(inventory.reserved).reduce((sum, entries) => sum + entries.length, 0);
    process.stdout.write(`content-id-map: OK (${total} id(s) reservado(s) em ${path.relative(repoRoot, inventoryPath)}).\n`);
    return;
  }

  process.stderr.write(`content-id-map: ${errors.length} erro(s) em ${path.relative(repoRoot, inventoryPath)}:\n`);
  for (const error of errors) {
    process.stderr.write(`  - ${error}\n`);
  }
  process.exitCode = 1;
}

// Só executa como CLI quando chamado diretamente (não quando importado pelos
// testes, que usam `slugify`/`validateIdInventory` diretamente, nem quando
// avaliado via `node -e`/`--input-type=module`, onde `process.argv[1]` não é
// o caminho deste arquivo). Compara caminhos já normalizados via
// `fileURLToPath`/`path.resolve` em vez de manipular strings de URL à mão,
// para não depender de detalhes de formatação de URL de arquivo no Windows.
const isDirectCliInvocation =
  typeof process.argv[1] === 'string' &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isDirectCliInvocation) {
  main().catch((error) => {
    process.stderr.write(`content-id-map: erro fatal: ${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
