#!/usr/bin/env node
// `scripts/content/audit-spells-equipment.mjs`: auditoria de cobertura das
// 391 magias / 38 armas / 13 armaduras / 824 entidades de equipamento e
// apêndices migradas por `migrate-spells-equipment.mjs` (Task 10), no mesmo
// padrão de `scripts/content/audit-classes.mjs` (Task 8) e
// `scripts/content/audit-origins-feats.mjs` (Task 9).
//
// Diferente de `npm run validate:data` (que valida schema + referência de
// TODO o pacote, já ativo em "ready" a partir desta tarefa), este script
// varre toda referência de classe emitida por `spell.classes` e confere que
// resolve contra o ruleset já ativo, confere as contagens exatas exigidas
// pelo brief, confere que os ids reservados em
// `tests/fixtures/content/dnd2024-id-inventory.json` batem com os gerados
// (1:1 para spell/weapon/armor/creature/glossary-entry — tipos onde TODO
// item legado tinha id pré-reservado; subconjunto para equipment, que
// também inclui ferramentas/serviços/montarias-veículos sem id reservado
// por ninguém ter precisado referenciá-los antes desta tarefa) e confere
// drift entre os catálogos commitados e o que o conversor produz agora.
//
// Uso:
//   node scripts/content/audit-spells-equipment.mjs
//     Sai com código 0 e imprime um resumo se tudo estiver ok; código
//     diferente de zero e a lista de problemas, caso contrário.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { construirCatalogos, verificarDrift } from './migrate-spells-equipment.mjs';
import { validateEntity } from '../../site/js/content/validation.js';
import { parseContentId } from '../../site/js/core/content-id.js';
import { loadIdInventory } from './content-id-map.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const rulesetsDir = path.join(repoRoot, 'dados', 'pacotes', 'dnd2024', 'rulesets');
const classesDir = path.join(repoRoot, 'dados', 'pacotes', 'dnd2024', 'classes');

/**
 * Coleta recursivamente toda string que "parece" um ContentId dentro de um
 * valor arbitrário, para conferência de referência. Mesma função de
 * `audit-classes.mjs`/`audit-origins-feats.mjs`.
 * @param {*} valor
 * @param {Set<string>} destino
 */
function coletarPossiveisRefs(valor, destino) {
  if (typeof valor === 'string') {
    if (/^[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+$/.test(valor)) destino.add(valor);
    return;
  }
  if (Array.isArray(valor)) {
    for (const item of valor) coletarPossiveisRefs(item, destino);
    return;
  }
  if (valor && typeof valor === 'object') {
    for (const v of Object.values(valor)) coletarPossiveisRefs(v, destino);
  }
}

/**
 * Carrega os ids já ativos que `spell`/`weapon`/`armor` desta tarefa podem
 * referenciar: as 12 classes reais migradas pela Task 8
 * (`dados/pacotes/dnd2024/classes/*.json`, `spell.classes`) e o ruleset
 * central (`weapon.damage.type` -> `damage-type`).
 * @returns {Promise<Set<string>>}
 */
async function carregarIdsAtivos() {
  const ativos = new Set();
  const { readdir } = await import('node:fs/promises');
  const arquivos = await readdir(classesDir);
  for (const arquivo of arquivos) {
    const conteudo = JSON.parse(await readFile(path.join(classesDir, arquivo), 'utf8'));
    for (const item of conteudo.items) {
      if (item.type === 'class') ativos.add(item.id);
    }
  }
  for (const arquivo of ['abilities.json', 'skills.json', 'conditions.json', 'damage-types.json', 'languages.json']) {
    const conteudo = JSON.parse(await readFile(path.join(rulesetsDir, arquivo), 'utf8'));
    for (const item of conteudo.items) ativos.add(item.id);
  }
  return ativos;
}

async function main() {
  const problemas = [];

  const idInventory = await loadIdInventory();
  const idsReservados = new Set();
  for (const entries of Object.values(idInventory.reserved)) {
    for (const { id } of entries) idsReservados.add(id);
  }
  const idsClasseAtivos = await carregarIdsAtivos();

  const catalogos = await construirCatalogos();
  const { arquivos } = catalogos;

  // 1) Contagens exatas exigidas pelo brief.
  const porTipo = new Map();
  for (const { colecao } of arquivos) {
    for (const item of colecao.items) porTipo.set(item.type, (porTipo.get(item.type) ?? 0) + 1);
  }
  const CONTAGENS_ESPERADAS = { spell: 391, weapon: 38, armor: 13, creature: 51, 'glossary-entry': 154, 'spell-list': 9 };
  for (const [tipo, esperado] of Object.entries(CONTAGENS_ESPERADAS)) {
    const atual = porTipo.get(tipo) ?? 0;
    if (atual !== esperado) problemas.push(`esperava ${esperado} entidade(s) "${tipo}", encontrado ${atual}`);
  }
  if ((porTipo.get('equipment') ?? 0) < 82) {
    problemas.push(`esperava pelo menos 82 entidades "equipment" (itens de aventura reservados), encontrado ${porTipo.get('equipment') ?? 0}`);
  }

  // 2) Schema: toda entidade deve validar contra seu schema concreto, ter
  //    name e (exceto spell-list mestre, que tem description própria)
  //    description não-vazia.
  const idsDeStaging = new Set();
  for (const { relPath, colecao } of arquivos) {
    for (const item of colecao.items) {
      if (idsDeStaging.has(item.id)) problemas.push(`id duplicado "${item.id}" (em "${relPath}")`);
      idsDeStaging.add(item.id);
      const resultado = validateEntity(item);
      if (!resultado.valid) {
        problemas.push(`"${relPath}": entidade "${item.id}" falhou validateEntity: ${resultado.errors.map((e) => e.message).join('; ')}`);
      }
      if (typeof item.name !== 'string' || item.name.length === 0) {
        problemas.push(`"${relPath}": entidade "${item.id}" sem name`);
      }
    }
  }

  // 3) Todo efeito `manual` de magia tem `text` não-vazio (o texto legado
  //    completo, nunca um placeholder) — a garantia de que "converter o
  //    restante para manual" realmente carrega o conteúdo, não só o tipo.
  for (const { colecao } of arquivos) {
    if (colecao.type !== 'spell') continue;
    for (const spell of colecao.items) {
      const efeitoDescricao = spell.effects.find((e) => e.id === 'descricao');
      if (!efeitoDescricao || efeitoDescricao.type !== 'manual' || typeof efeitoDescricao.text !== 'string' || efeitoDescricao.text.length === 0) {
        problemas.push(`spell "${spell.id}": efeito manual "descricao" ausente ou vazio`);
      }
    }
  }

  // 4) Toda referência de conteúdo emitida (spell.classes, weapon.damage.type,
  //    ...) deve resolver: ativa (ruleset/classes já migradas) ou reservada.
  const refsEncontradas = new Set();
  for (const { colecao } of arquivos) {
    for (const item of colecao.items) coletarPossiveisRefs(item, refsEncontradas);
  }
  for (const ref of refsEncontradas) {
    const parsed = parseContentId(ref);
    if (!parsed.ok) continue;
    if (parsed.value.namespace !== 'dnd2024') continue;
    const existe = idsClasseAtivos.has(ref) || idsReservados.has(ref) || idsDeStaging.has(ref);
    if (!existe) {
      problemas.push(`referência "${ref}" não existe nas classes ativas, no inventário reservado nem no staging desta migração`);
    }
  }

  // 5) Ids reservados batem com os gerados: 1:1 para spell/weapon/armor/
  //    creature/glossary-entry (todo item legado desses tipos tinha id
  //    pré-reservado); subconjunto (reservado ⊆ gerado) para equipment
  //    (ferramentas/serviços/montarias-veículos são ids novos, sem reserva
  //    prévia — ver comentário de topo).
  const geradosPorTipo = new Map();
  for (const { colecao } of arquivos) {
    for (const item of colecao.items) {
      if (!geradosPorTipo.has(item.type)) geradosPorTipo.set(item.type, new Set());
      geradosPorTipo.get(item.type).add(item.id);
    }
  }
  for (const tipo of ['spell', 'weapon', 'armor', 'creature', 'glossary-entry']) {
    const reservado = new Set((idInventory.reserved[tipo] ?? []).map((e) => e.id));
    const gerado = geradosPorTipo.get(tipo) ?? new Set();
    for (const id of reservado) if (!gerado.has(id)) problemas.push(`id reservado "${id}" (${tipo}) não foi gerado`);
    for (const id of gerado) if (!reservado.has(id)) problemas.push(`id gerado "${id}" (${tipo}) não está no inventário reservado`);
  }
  const reservadoEquipment = new Set((idInventory.reserved.equipment ?? []).map((e) => e.id));
  const geradoEquipment = geradosPorTipo.get('equipment') ?? new Set();
  for (const id of reservadoEquipment) {
    if (!geradoEquipment.has(id)) problemas.push(`id reservado "${id}" (equipment) não foi gerado`);
  }

  // 6) Toda magia referenciada por uma lista de classe (spells/by-class/*.json
  //    e o índice mestre) existe entre as 391 magias geradas.
  const idsDeMagia = geradosPorTipo.get('spell') ?? new Set();
  for (const { relPath, colecao } of arquivos) {
    if (colecao.type !== 'spell-list') continue;
    for (const lista of colecao.items) {
      for (const spellRef of lista.spells) {
        if (!idsDeMagia.has(spellRef)) problemas.push(`"${relPath}": lista "${lista.id}" referencia magia inexistente "${spellRef}"`);
      }
    }
  }

  // 7) Drift: catálogos + fragmento de índice commitados devem refletir
  //    exatamente o que o conversor produz agora.
  const drift = await verificarDrift(catalogos);
  if (!drift.ok) {
    for (const diff of drift.diffs) problemas.push(`drift: ${diff}`);
  }

  if (problemas.length > 0) {
    process.stderr.write(`audit-spells-equipment: ${problemas.length} problema(s):\n`);
    for (const problema of problemas) process.stderr.write(`  - ${problema}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `audit-spells-equipment: OK — 391 magias, 38 armas, 13 armaduras, ${porTipo.get('equipment')} itens de equipamento, 51 criaturas, 154 termos de glossário, todas as referências resolvidas, drift zero.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`audit-spells-equipment: erro fatal: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
