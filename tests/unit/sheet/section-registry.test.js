// ============================================================
// Registro de seções da ficha + `sheet-command-map` (Task 29).
//
// O teste central deste arquivo é o de PATH ÓRFÃO: ele varre as FONTES de
// `site/js/domain/**` atrás de todo path canônico que algum comando emite em
// `CommandResult.affected` e exige que cada um resolva para pelo menos uma
// seção REGISTRADA. Um path sem seção é falha explícita aqui — nunca um
// `dirtySections` vazio em produção, que salvaria a mudança e deixaria a tela
// mentindo (o padrão "bypass silencioso").
//
// A varredura é sobre o código-fonte de propósito: uma lista de paths escrita
// à mão no teste envelheceria junto com o mapa, e os dois estariam errados
// juntos sem ninguém perceber.
// ============================================================
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AFFECTED_PATH_PATTERNS,
  AFFECTED_PATH_SECTIONS,
  knownAffectedPaths,
  resolveDirtySections,
  sectionsForAffectedPath,
  validateCommandMap,
} from '../../../site/js/features/sheet/sheet-command-map.js';
import { createSectionRegistry, createSheetSection } from '../../../site/js/features/sheet/sections/section-registry.js';
import { SHEET_SECTION_IDS } from '../../../site/js/features/sheet/sheet-state.js';
import { NO_UI_EVENT_DECISION } from '../../../site/js/ui/event-delegation.js';
import { createPlaceholderSection } from '../../e2e/harness/placeholder-sheet-section.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const domainRoot = path.join(repoRoot, 'site/js/domain');

// Forma de um path canônico: dois ou mais segmentos pontilhados, começando em
// minúscula. É o que separa `'state.usageFlags'` de um código de erro ou de um
// tipo de evento que apareça na mesma linha.
const PATH_SHAPE = /^[a-z][A-Za-z0-9_*]*(\.[A-Za-z0-9_*]+)+$/;

/**
 * Lista recursivamente os arquivos `.js` de um diretório.
 * @param {string} dir
 * @returns {Promise<Array<string>>}
 */
async function listJsFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listJsFiles(full)));
    } else if (entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Extrai de `site/js/domain/**` todo path canônico emitido em `affected`.
 *
 * Três fontes, porque o código usa as três formas: literais escritos na própria
 * linha (`affected: ['hp.maximum']`), templates
 * (`` affected.push(`ability.${chave}.score`) ``, cujo segmento interpolado
 * vira `*`) e CONSTANTES nomeadas.
 *
 * A varredura de constantes é por FORMA, não por convenção de nome. A primeira
 * versão deste teste só reconhecia os prefixos `SCOPE_`/`AFFECTED_`, e por isso
 * deixava passar `PATH_USAGE_FLAGS` (`rulesets/dnd2024/handlers/class-handler.js`),
 * que emite `state.usageFlags` em `affected` — o guardião que deveria pegar um
 * path órfão automaticamente tinha um ponto cego exatamente na família de
 * comandos que as Tasks 30/31 vão ligar. Agora QUALQUER `const X = '...'` com
 * forma de path é candidata, e o que decide é o identificador aparecer numa
 * linha de `affected`.
 * @returns {Promise<ReadonlyArray<string>>}
 */
async function scanAffectedPaths() {
  const files = await listJsFiles(domainRoot);
  /** @type {Map<string, string>} */
  const constants = new Map();
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*'([^']+)'/g)) {
      if (PATH_SHAPE.test(match[2])) {
        constants.set(match[1], match[2]);
      }
    }
  }

  /** @type {Set<string>} */
  const found = new Set();
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const rawLine of source.split(/\r?\n/)) {
      const line = rawLine.trim();
      // Comentários citam paths em prosa (e com aspas duplas); só o código
      // interessa.
      if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) {
        continue;
      }
      if (!line.includes('affected')) {
        continue;
      }
      for (const match of line.matchAll(/'([^']*)'/g)) {
        found.add(match[1]);
      }
      for (const match of line.matchAll(/`([^`]*)`/g)) {
        found.add(match[1].replace(/\$\{[^}]*\}/g, '*'));
      }
      for (const match of line.matchAll(/\b([A-Z][A-Z0-9_]*)\b/g)) {
        if (constants.has(match[1])) {
          found.add(constants.get(match[1]));
        }
      }
    }
  }

  // Só o que TEM FORMA de path canônico (dois ou mais segmentos pontilhados).
  // Códigos de erro e tipos de evento que aparecem na mesma linha ficam de
  // fora por não casarem com esta forma.
  return Object.freeze([...found].filter((value) => PATH_SHAPE.test(value)).sort());
}

let affectedPaths;

before(async () => {
  affectedPaths = await scanAffectedPaths();
});

/**
 * Instancia um path parametrizado com um slug real.
 * @param {string} value
 * @returns {string}
 */
function instantiate(value) {
  return value.replace(/\*/g, 'forca');
}

describe('unit/sheet/section-registry — mapa de comandos sem path órfão', () => {
  test('a varredura encontra de fato os paths canônicos (o teste não é vazio)', () => {
    assert.ok(affectedPaths.length >= 20, `varredura encontrou só ${affectedPaths.length} paths — a extração quebrou`);
    // Âncoras conhecidas das Tasks 17/18/19/23: se qualquer uma sumir, a
    // varredura deixou de enxergar aquela família de comandos.
    for (const esperado of [
      'hp.current',
      'state.conditions',
      'state.spells.slots',
      'state.wallet',
      'build.featRefs',
      'ability.*.score',
      // Emitido por `PATH_USAGE_FLAGS` nos handlers de ação de classe — a
      // constante que a varredura original não enxergava.
      'state.usageFlags',
    ]) {
      assert.ok(affectedPaths.includes(esperado), `varredura não encontrou "${esperado}"`);
    }
  });

  test('TODO path canônico emitido em affected mapeia para pelo menos uma seção', () => {
    const orfaos = affectedPaths.filter((value) => {
      const sections = sectionsForAffectedPath(instantiate(value));
      return sections === null || sections.length === 0;
    });
    assert.deepEqual(
      orfaos,
      [],
      `paths canônicos sem seção registrada em sheet-command-map.js: ${orfaos.join(', ')}. ` +
        'Um path órfão precisa virar entrada no mapa — nunca um dirtySections vazio silencioso.',
    );
  });

  test('nenhuma entrada do mapa cita seção inexistente', () => {
    const validated = validateCommandMap();
    assert.equal(validated.ok, true, validated.ok ? '' : validated.error.message);
    for (const value of knownAffectedPaths()) {
      for (const sectionId of sectionsForAffectedPath(value)) {
        assert.ok(SHEET_SECTION_IDS.includes(sectionId), `${value} -> ${sectionId}`);
      }
    }
  });

  test('o mapa não guarda entrada MORTA (path que nenhum comando emite)', () => {
    // A direção oposta do teste de órfão. Uma entrada que sobrou de um comando
    // removido daria a impressão de cobertura sem cobrir nada.
    const instanciados = new Set(affectedPaths.map(instantiate));
    const mortas = Object.keys(AFFECTED_PATH_SECTIONS).filter((value) => !instanciados.has(value));
    assert.deepEqual(mortas, [], `entradas do mapa sem comando correspondente: ${mortas.join(', ')}`);
    for (const entry of AFFECTED_PATH_PATTERNS) {
      assert.ok(instanciados.has(entry.sample), `padrão sem comando correspondente: ${entry.sample}`);
    }
  });

  test('resolveDirtySections recusa path desconhecido em vez de devolver vazio', () => {
    const resultado = resolveDirtySections(['state.conditions', 'state.inventado']);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SHEET_AFFECTED_PATH_UNMAPPED');
    assert.deepEqual(resultado.error.context.unmapped, ['state.inventado']);
  });

  test('affected vazio é sucesso com dirtySections vazio (no-op idempotente)', () => {
    const resultado = resolveDirtySections([]);
    assert.equal(resultado.ok, true);
    assert.deepEqual(resultado.value, []);
  });

  test('dirtySections sai deduplicado e na ordem canônica de apresentação', () => {
    const resultado = resolveDirtySections(['state.wallet', 'hp.current', 'state.inventory']);
    assert.equal(resultado.ok, true);
    assert.deepEqual(resultado.value, ['summary-combat', 'inventory-load-coins']);
  });
});

describe('unit/sheet/section-registry — registro', () => {
  /**
   * @param {ReadonlyArray<string>} ids
   * @returns {Array<object>}
   */
  function placeholders(ids) {
    return ids.map((id) => {
      const created = createPlaceholderSection(id);
      assert.equal(created.ok, true, id);
      return created.value;
    });
  }

  test('registro completo lista na ordem canônica, não na ordem de registro', () => {
    const registry = createSectionRegistry(placeholders([...SHEET_SECTION_IDS].reverse()));
    assert.equal(registry.ok, true, registry.ok ? '' : registry.error.message);
    assert.deepEqual([...registry.value.sectionIds()], [...SHEET_SECTION_IDS]);
  });

  test('registro incompleto é erro explícito quando requireAll', () => {
    const registry = createSectionRegistry(placeholders(['summary-combat']));
    assert.equal(registry.ok, false);
    assert.equal(registry.error.code, 'SHEET_SECTION_REGISTRY_INCOMPLETE');
    assert.equal(registry.error.context.missing.length, SHEET_SECTION_IDS.length - 1);
  });

  test('registro parcial é permitido só com requireAll: false', () => {
    const registry = createSectionRegistry(placeholders(['summary-combat']), { requireAll: false });
    assert.equal(registry.ok, true);
    assert.equal(registry.value.get('summary-combat').id, 'summary-combat');
    assert.equal(registry.value.get('personal-details'), null);
  });

  test('id duplicado é recusado', () => {
    const registry = createSectionRegistry(placeholders(['summary-combat', 'summary-combat']), { requireAll: false });
    assert.equal(registry.ok, false);
    assert.equal(registry.error.code, 'SHEET_SECTION_REGISTRY_DUPLICATE');
  });

  test('id fora da lista canônica é recusado na criação da seção', () => {
    const created = createSheetSection({ id: 'inventada', select: () => null, render: () => '' });
    assert.equal(created.ok, false);
    assert.equal(created.error.code, 'SHEET_SECTION_ID_UNKNOWN');
  });

  test('toIntent que devolve lixo vira decisão NEUTRA (nunca aplicada ao evento)', () => {
    const created = createSheetSection({
      id: 'summary-combat',
      select: () => null,
      render: () => '',
      toIntent: () => ({ qualquer: 'coisa' }),
    });
    assert.equal(created.ok, true);
    assert.deepEqual(created.value.toIntent({}, {}), NO_UI_EVENT_DECISION);
  });

  test('seção sem toIntent é válida e nunca produz intenção', () => {
    const created = createSheetSection({ id: 'personal-details', select: () => null, render: () => '' });
    assert.equal(created.ok, true);
    assert.equal(created.value.toIntent({}, {}).intent, null);
  });

  test('eventTypes é a união declarada pelas seções (mais o click da raiz)', () => {
    const sections = [
      createPlaceholderSection('summary-combat', { eventTypes: ['click'] }).value,
      createPlaceholderSection('inventory-load-coins', { eventTypes: ['change', 'click'] }).value,
    ];
    const registry = createSectionRegistry(sections, { requireAll: false });
    assert.equal(registry.ok, true);
    assert.deepEqual([...registry.value.eventTypes()].sort(), ['change', 'click']);
  });
});
