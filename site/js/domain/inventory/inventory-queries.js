// Módulo `domain/inventory/inventory-queries`: projeção pura do inventário
// (Task 19). Substitui `site/js/utils.js#getPesoTotalInventario` +
// `site/js/pages/sheet.js#getEstadoCarga` (commit e43c5ea).
//
// ## Contrato com `getMovement` (Task 16)
//
// `domain/character/queries/movement.js` NÃO soma peso de inventário: ele
// espera receber `context.encumbranceLevel` já calculado. Esta projeção é a
// única fonte desse valor. Quem monta o `context` de `getMovement` faz:
//
//   const inv = getInventoryProjection(character, ctx);
//   getMovement(character, { ...ctx, encumbranceLevel: inv.value.encumbranceLevel });
//
// A capacidade de carga NÃO é recalculada aqui: é lida de `getMovement`, que
// já aplica o alvo derivado `carrying-capacity` do motor de efeitos da
// Task 15 (`collectCharacterEffects`/`resolveNumericTarget`). Duplicar a
// fórmula Força × multiplicador de tamanho aqui criaria uma segunda verdade
// que ignoraria efeitos declarativos.
//
// ## Níveis de sobrecarga produzidos
//
// O baseline conhece UM único estado: sobrecarregado quando
// `capacidade > 0 && pesoAtual > capacidade` (`sheet.js#getEstadoCarga`).
// Portanto esta projeção só emite `'none'` ou `'overloaded'`. Os outros dois
// valores do vocabulário de `getMovement` (`'encumbered'`,
// `'heavily-encumbered'`, da regra opcional do PHB) NÃO são inventados aqui:
// o baseline não tem essas faixas, e criá-las mudaria o deslocamento de
// fichas existentes.

import { ok } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { getMovement } from '../character/queries/index.js';
import { resolveCurrencyRates } from './wallet.js';
import { resolveItemDefinition, evaluateEquipRequirements } from './equipment-rules.js';

export const INVENTORY_QUERIES_SCOPE = 'domain.inventory.queries';

// Vocabulário de sobrecarga efetivamente produzido por esta projeção (subset
// do vocabulário aceito por `getMovement`).
export const ENCUMBRANCE_LEVELS = Object.freeze(['none', 'overloaded']);

/**
 * Cria um AppError do escopo das consultas de inventário.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {Readonly<object>}
 */
export function inventoryQueryError(code, message, context = {}) {
  return createAppError({ code, scope: INVENTORY_QUERIES_SCOPE, message, context });
}

/**
 * Confere a forma mínima de um CanonicalCharacter, igual às demais consultas
 * (`domain/character/queries/internal/shared.js#requireCharacterShape`).
 * @param {*} character
 * @returns {boolean}
 */
function hasCharacterShape(character) {
  return (
    character !== null &&
    typeof character === 'object' &&
    character.identity !== null &&
    typeof character.identity === 'object' &&
    character.build !== null &&
    typeof character.build === 'object' &&
    character.state !== null &&
    typeof character.state === 'object'
  );
}

/**
 * Projeta o inventário do personagem: itens resolvidos (nome, categoria,
 * peso, custo, requisitos), peso total, capacidade de carga e nível de
 * sobrecarga.
 *
 * Peso total replica `site/js/utils.js#getPesoTotalInventario`: soma
 * `peso × quantidade` de TODOS os itens (equipados ou não), ignorando itens
 * com quantidade <= 0, e tratando item sem informação de peso como 0.
 *
 * @param {object} character - CanonicalCharacter (Task 12)
 * @param {{registry?: object, currencyRates?: object|null, ruleset?: object, armorProficiencies?: ReadonlyArray<string>, weaponProficiencies?: ReadonlyArray<string>}} [context]
 * @returns {import('../../core/result.js').Result} Result<InventoryProjection, AppError>
 */
export function getInventoryProjection(character, context = {}) {
  if (!hasCharacterShape(character)) {
    return {
      ok: false,
      error: inventoryQueryError(
        'INVENTORY_QUERY_INVALID_CHARACTER',
        'A consulta exige um CanonicalCharacter com identity/build/state.',
        {},
      ),
    };
  }

  const safeContext = context !== null && typeof context === 'object' ? context : {};

  // Capacidade de carga vem de `getMovement` (única fonte, com efeitos
  // aplicados). `encumbranceLevel` NÃO é repassado — seria circular: é
  // justamente o que esta projeção produz.
  const { encumbranceLevel: _ignoredEncumbrance, ...movementContext } = safeContext;
  const movement = getMovement(character, movementContext);
  if (!movement.ok) {
    return movement;
  }
  const carryingCapacityKg = movement.value.carryingCapacity;

  // Taxas de moeda são OPCIONAIS para o inventário: só afetam `costCopper`.
  // Sem elas a projeção continua válida (peso/sobrecarga não dependem de
  // moeda) e os custos ficam `null` — nunca 0, que significaria "de graça".
  const ratesResult = resolveCurrencyRates(safeContext, character);
  const rates = ratesResult.ok ? ratesResult.value : {};
  const currencyWarning = ratesResult.ok ? null : ratesResult.error;

  const entries = Array.isArray(character.state.inventory) ? character.state.inventory : [];
  const items = [];
  let totalWeightKg = 0;

  entries.forEach((entry, index) => {
    const definition = resolveItemDefinition(entry, { registry: safeContext.registry, rates });
    const requirements = evaluateEquipRequirements(character, definition, safeContext);
    const quantity = Number.isInteger(entry?.quantity) ? entry.quantity : 1;
    const unitWeightKg = definition.weightKg ?? 0;
    // Mesma guarda do baseline: quantidade <= 0 não soma peso.
    const stackWeightKg = quantity > 0 ? unitWeightKg * quantity : 0;
    totalWeightKg += stackWeightKg;

    items.push(
      Object.freeze({
        index,
        instanceId: entry?.instanceId ?? null,
        itemRef: entry?.itemRef ?? null,
        name: definition.name,
        origin: definition.origin,
        isCustom: definition.isCustom,
        categoryKind: definition.categoryKind,
        categorySlug: definition.categorySlug,
        categoryLabel: definition.categoryLabel,
        quantity,
        equipped: entry?.equipped === true,
        expended: Number.isInteger(entry?.expended) ? entry.expended : 0,
        sourceInstanceId: entry?.sourceInstanceId ?? null,
        unitWeightKg,
        stackWeightKg,
        weightSource: definition.weightSource,
        unitCostCopper: definition.costCopper,
        costSource: definition.costSource,
        legacyWeightText: definition.legacyWeightText,
        legacyCostText: definition.legacyCostText,
        strengthRequirement: requirements.strengthRequirement,
        meetsStrengthRequirement: requirements.meetsStrengthRequirement,
        proficient: requirements.proficient,
        advisories: requirements.advisories,
      }),
    );
  });

  // Réplica de `sheet.js#getEstadoCarga`: capacidade 0 nunca sobrecarrega
  // (evita marcar sobrecarga em ficha sem Força definida).
  const overloaded = carryingCapacityKg > 0 && totalWeightKg > carryingCapacityKg;

  return ok(
    Object.freeze({
      items: Object.freeze(items),
      totalWeightKg,
      carryingCapacityKg,
      encumbranceLevel: overloaded ? 'overloaded' : 'none',
      overloaded,
      // Só quando esta opção está ligada é que a sobrecarga afeta o
      // deslocamento (`getMovement` faz a mesma leitura); exposto aqui para a
      // UI decidir se mostra o aviso, como o baseline faz.
      encumbranceAffectsMovement: character.build?.options?.encumbranceAffectsMovement === true,
      currencyRatesAvailable: ratesResult.ok,
      currencyRatesError: currencyWarning,
    }),
  );
}
