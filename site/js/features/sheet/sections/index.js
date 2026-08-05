// Módulo `features/sheet/sections/index`: o registro PADRÃO das sete seções
// REAIS da ficha — o análogo de `features/creator/steps/index.js#createDefaultStepRegistry`.
//
// Existe a partir do cutover público (Task 33) e pelo mesmo motivo que o do
// criador: o composition root de produção não pode montar a lista de seções à
// mão. Se pudesse, "esquecer" uma seção seria uma linha a menos, e o jogador
// abriria a ficha sem inventário sem que nada falhasse. Aqui a lista é ÚNICA,
// derivada de `SHEET_SECTION_IDS`, e `createSectionRegistry` recusa (com
// `SHEET_SECTION_REGISTRY_INCOMPLETE`) se alguma faltar.
//
// Nenhum PLACEHOLDER é alcançável daqui. O placeholder existe só no harness de
// teste (`tests/e2e/harness/placeholder-sheet-section.js`), e o teste estático
// de composition root (`tests/unit/architecture/sheet-composition-root.test.js`)
// prova que nenhum módulo de produção o importa.

import { ok } from '../../../core/result.js';
import { SHEET_SECTION_IDS } from '../sheet-state.js';
import { createSectionRegistry } from './section-registry.js';
import { createSummaryCombatSection } from './summary-combat-section.js';
import { createResourcesFeaturesSection } from './resources-features-section.js';
import { createFeatsProgressionSection } from './feats-progression-section.js';
import { createSpellsSpellbookSection } from './spells-spellbook-section.js';
import { createConditionsDefensesSensesSection } from './conditions-defenses-senses-section.js';
import { createInventoryLoadCoinsSection } from './inventory-load-coins-section.js';
import { createPersonalDetailsSection } from './personal-details-section.js';

/**
 * Fábrica REAL de cada seção canônica, por id.
 *
 * A chave é o id canônico; o teste estático confere que o conjunto de chaves é
 * EXATAMENTE `SHEET_SECTION_IDS`, para que uma seção nova não possa nascer sem
 * fábrica nem uma fábrica sobrar apontando para um id que não existe mais.
 * @type {Readonly<Record<string, Function>>}
 */
export const SECTION_FACTORIES = Object.freeze({
  'summary-combat': createSummaryCombatSection,
  'resources-features': createResourcesFeaturesSection,
  'feats-progression': createFeatsProgressionSection,
  'spells-spellbook': createSpellsSpellbookSection,
  'conditions-defenses-senses': createConditionsDefensesSensesSection,
  'inventory-load-coins': createInventoryLoadCoinsSection,
  'personal-details': createPersonalDetailsSection,
});

/**
 * Cria o registro com as SETE seções reais, na ordem canônica.
 *
 * Uma seção que falhe ao ser construída interrompe a montagem com o `AppError`
 * dela — nunca é substituída por um miolo vazio.
 * @returns {import('../../../core/result.js').Result} Result<SectionRegistry, AppError>
 */
export function createDefaultSectionRegistry() {
  const sections = [];
  for (const sectionId of SHEET_SECTION_IDS) {
    const created = SECTION_FACTORIES[sectionId]();
    if (created.ok !== true) {
      return created;
    }
    sections.push(created.value);
  }
  const registry = createSectionRegistry(sections);
  return registry.ok === true ? ok(registry.value) : registry;
}
