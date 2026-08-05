// Módulo `domain/inventory/equipment-rules`: adaptador ÚNICO entre uma
// entrada de inventário canônica (`state.inventory[i]`) e os números que as
// regras precisam (peso em kg, custo em cobre, categoria, requisito de Força,
// proficiência).
//
// ## Onde mora o parsing textual
//
// Só AQUI, e só para o item LEGADO/CUSTOMIZADO. A entidade oficial do
// catálogo já é estruturada (`weight: number` e `cost: {amount, currency}` —
// ver `dados/schemas/v1/{equipment,armor,weapon}.schema.json`), então nunca
// passa por regex. O item legado, ao contrário, chega da migração v1->v2 com
// os campos originais em texto dentro de `customDefinition.dados`
// (`peso: "20 kg"`, `custo: "50 PO"`, `requisito_forca: "For. 13"`), porque
// `infra/character/migrations/v1-to-v2.js#stripKnownItemFields` preserva o
// item bruto inteiro.
//
// ## Numérico e texto andam juntos
//
// Um `customDefinition` editado pelo domínio passa a carregar TAMBÉM os campos
// numéricos (`dados.weightKg`, `dados.costCopper`) e tem a projeção textual
// (`dados.peso`, `dados.custo`) REGERADA a partir deles — nunca fica com o
// texto legado congelado enquanto o número muda. Na leitura, o numérico tem
// precedência sobre o texto exatamente por isso.
//
// ## Precedência de leitura (peso/custo)
//
//   1. numérico do próprio item (`dados.weightKg` / `dados.costCopper`);
//   2. texto legado do próprio item (`dados.peso` / `dados.custo`, ou `peso`/
//      `custo` no topo — o baseline lê `item.dados?.peso ?? item.peso`);
//   3. entidade oficial do catálogo (`weight` / `cost`);
//   4. ausência: peso 0 (o baseline soma 0 para item sem peso), custo `null`
//      (custo desconhecido NÃO vira 0 — 0 significaria "de graça").
//
// O item do jogador vence o catálogo de propósito: é o dado que o baseline
// exibia e somava (`site/js/utils.js#getPesoTotalInventario` nunca consultou
// `dados/equipamentos/*`), e trocá-lo pelo valor de catálogo mudaria o peso
// total de fichas existentes (ex.: "Cota de Malha" tem `20 kg` gravados na
// ficha e `27` no catálogo).

import { createAppError } from '../../core/errors.js';
import { parseCostText, formatCostText, RULESET_CURRENCY_CODE_TO_DENOMINATION } from './wallet.js';

export const EQUIPMENT_SCOPE = 'domain.inventory.equipment-rules';

// Categorias estruturadas de armadura (`armor.schema.json#/armorCategory`).
export const ARMOR_CATEGORIES = Object.freeze(['light', 'medium', 'heavy', 'shield']);

// Categorias estruturadas de arma (`weapon.schema.json#/weaponCategory`).
export const WEAPON_CATEGORIES = Object.freeze(['simple', 'martial']);

// Categoria legada (`item.dados.categoria`, em português) -> slug estruturado.
// Tradução de nomenclatura, não regra de jogo.
const LEGACY_ARMOR_CATEGORY_TO_SLUG = Object.freeze({
  leve: 'light',
  media: 'medium',
  média: 'medium',
  pesada: 'heavy',
  escudo: 'shield',
});

// Tipo legado do item (`item.tipo`) -> tipo de entidade do catálogo.
const LEGACY_ITEM_TYPE_TO_ENTITY_TYPE = Object.freeze({
  arma: 'weapon',
  armadura: 'armor',
  escudo: 'armor',
  equipamento: 'equipment',
});

/**
 * Cria um AppError do escopo de regras de equipamento.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {Readonly<object>}
 */
export function equipmentError(code, message, context = {}) {
  return createAppError({ code, scope: EQUIPMENT_SCOPE, message, context });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Converte texto de peso em kg. Réplica EXATA de
 * `site/js/utils.js#parsePeso` (commit e43c5ea), incluindo o tratamento de
 * "—"/"-"/"varia" e a prioridade de "kg" sobre "g".
 * @param {*} text
 * @returns {number}
 */
export function parseWeightText(text) {
  if (text === null || text === undefined) {
    return 0;
  }
  const raw = String(text).trim();
  if (raw === '' || raw === '—' || raw === '-' || /varia/i.test(raw)) {
    return 0;
  }
  const kilograms = raw.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (kilograms) {
    return Number.parseFloat(kilograms[1].replace(',', '.'));
  }
  const grams = raw.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (grams) {
    return Number.parseFloat(grams[1].replace(',', '.')) / 1000;
  }
  const bare = raw.match(/(\d+(?:[.,]\d+)?)/);
  return bare ? Number.parseFloat(bare[1].replace(',', '.')) : 0;
}

/**
 * Formata kg com vírgula decimal, como `site/js/utils.js#fmtPeso`
 * (arredondamento em 2 casas).
 * @param {*} kilograms
 * @returns {string}
 */
export function formatWeightNumber(kilograms) {
  const rounded = Math.round((Number(kilograms) || 0) * 100) / 100;
  return rounded.toString().replace('.', ',');
}

/**
 * Projeção textual determinística de um peso, no MESMO formato que o criador
 * do baseline grava em item customizado (`site/js/pages/creator.js:3444`:
 * `` `${fmtPeso(n)} kg` ``). É o inverso de `parseWeightText` para os valores
 * que ele produz, o que torna `parse -> editar -> formatar -> parse` estável.
 * @param {*} kilograms
 * @returns {string}
 */
export function formatWeightText(kilograms) {
  return `${formatWeightNumber(kilograms)} kg`;
}

/**
 * Converte o custo estruturado de uma entidade de catálogo
 * (`{amount, currency}` com moeda em cp/sp/gp/pp) para cobre, usando as taxas
 * resolvidas. `null` quando a moeda não tem taxa conhecida — nunca um valor
 * chutado.
 * @param {*} cost
 * @param {Record<string, number>} rates
 * @returns {number | null}
 */
export function catalogCostToCopper(cost, rates) {
  if (!isPlainObject(cost) || typeof cost.amount !== 'number' || !Number.isFinite(cost.amount)) {
    return null;
  }
  const denomination = RULESET_CURRENCY_CODE_TO_DENOMINATION[cost.currency];
  const rate = denomination === undefined ? undefined : rates?.[denomination];
  if (!Number.isInteger(rate)) {
    return null;
  }
  return cost.amount * rate;
}

/**
 * Lê o bloco `dados` de um `customDefinition` legado (ou o próprio objeto,
 * quando o item não tem `dados`).
 * @param {*} customDefinition
 * @returns {object}
 */
function readCustomData(customDefinition) {
  if (!isPlainObject(customDefinition)) {
    return {};
  }
  return isPlainObject(customDefinition.dados) ? customDefinition.dados : {};
}

/**
 * Extrai o requisito de Força estruturado. Prefere o campo numérico do
 * catálogo (`strengthRequirement`); no item legado, parseia o texto
 * `requisito_forca` com a MESMA regex do baseline
 * (`site/js/pages/creator.js#atendeRequisitoForca`: `/For\.?\s*(\d+)/i`,
 * com "—" significando "sem requisito").
 * @param {*} entity
 * @param {object} data
 * @returns {number | null}
 */
function readStrengthRequirement(entity, data) {
  if (Number.isInteger(data?.strengthRequirement)) {
    return data.strengthRequirement;
  }
  const legacy = data?.requisito_forca;
  if (typeof legacy === 'string' && legacy.trim() !== '' && legacy.trim() !== '—') {
    const match = legacy.match(/For\.?\s*(\d+)/i);
    if (match) {
      return Number.parseInt(match[1], 10);
    }
    return null;
  }
  if (Number.isInteger(entity?.strengthRequirement)) {
    return entity.strengthRequirement;
  }
  return null;
}

/**
 * Resolve a categoria estruturada (slug) do item: `armorCategory`/
 * `weaponCategory`/`category` do catálogo, ou tradução do `dados.categoria`
 * legado em português.
 * @param {*} entity
 * @param {object} data
 * @param {*} customDefinition
 * @returns {{kind: string|null, slug: string|null, legacyLabel: string|null}}
 */
function readCategory(entity, data, customDefinition) {
  if (typeof entity?.armorCategory === 'string') {
    return { kind: 'armor', slug: entity.armorCategory, legacyLabel: null };
  }
  if (typeof entity?.weaponCategory === 'string') {
    return { kind: 'weapon', slug: entity.weaponCategory, legacyLabel: null };
  }
  if (typeof entity?.category === 'string') {
    return { kind: 'equipment', slug: null, legacyLabel: entity.category };
  }

  const legacyType = typeof customDefinition?.tipo === 'string' ? customDefinition.tipo.toLowerCase() : null;
  const entityType = legacyType === null ? null : (LEGACY_ITEM_TYPE_TO_ENTITY_TYPE[legacyType] ?? null);
  const legacyLabel = typeof data?.categoria === 'string' ? data.categoria : null;

  if (entityType === 'armor') {
    const normalized = legacyLabel === null ? null : legacyLabel.trim().toLowerCase();
    const slug =
      legacyType === 'escudo' ? 'shield' : (normalized === null ? null : (LEGACY_ARMOR_CATEGORY_TO_SLUG[normalized] ?? null));
    return { kind: 'armor', slug, legacyLabel };
  }
  if (entityType === 'weapon') {
    const normalized = legacyLabel === null ? null : legacyLabel.trim().toLowerCase();
    const slug = normalized === 'simples' ? 'simple' : normalized === 'marcial' ? 'martial' : null;
    return { kind: 'weapon', slug, legacyLabel };
  }
  return { kind: entityType, slug: null, legacyLabel };
}

/**
 * Resolve a definição efetiva de uma entrada de inventário: nome, categoria,
 * peso unitário em kg, custo unitário em cobre e os campos textuais legados
 * preservados. Não valida nada do personagem — é pura leitura de dados de
 * item (ver a precedência documentada no topo do módulo).
 * @param {object} entry - `state.inventory[i]` canônico.
 * @param {{registry?: object, rates?: Record<string, number>}} [options] - `rates`
 *   são as taxas JÁ resolvidas por `wallet.js#resolveCurrencyRates`; sem elas
 *   o custo em cobre fica `null` (nunca é chutado).
 * @returns {Readonly<object>} ItemDefinition
 */
export function resolveItemDefinition(entry, options = {}) {
  const registry = options?.registry;
  const rates = options?.rates ?? {};
  const itemRefId = typeof entry?.itemRef?.id === 'string' ? entry.itemRef.id : null;
  const entity =
    itemRefId !== null && registry !== null && registry !== undefined && typeof registry.get === 'function'
      ? registry.get(itemRefId)
      : null;

  const customDefinition = isPlainObject(entry?.customDefinition) ? entry.customDefinition : null;
  const data = readCustomData(customDefinition);

  // --- Peso ---------------------------------------------------------------
  const legacyWeightText =
    typeof data.peso === 'string' || typeof data.peso === 'number'
      ? data.peso
      : typeof customDefinition?.peso === 'string' || typeof customDefinition?.peso === 'number'
        ? customDefinition.peso
        : null;

  let weightKg = null;
  let weightSource = 'none';
  if (typeof data.weightKg === 'number' && Number.isFinite(data.weightKg)) {
    weightKg = data.weightKg;
    weightSource = 'custom-numeric';
  } else if (legacyWeightText !== null) {
    weightKg = parseWeightText(legacyWeightText);
    weightSource = 'custom-text';
  } else if (typeof entity?.weight === 'number' && Number.isFinite(entity.weight)) {
    weightKg = entity.weight;
    weightSource = 'catalog';
  }

  // --- Custo --------------------------------------------------------------
  const legacyCostText = typeof data.custo === 'string' ? data.custo : typeof customDefinition?.custo === 'string' ? customDefinition.custo : null;

  let costCopper = null;
  let costSource = 'none';
  if (typeof data.costCopper === 'number' && Number.isFinite(data.costCopper)) {
    costCopper = data.costCopper;
    costSource = 'custom-numeric';
  } else if (legacyCostText !== null) {
    const parsed = parseCostText(legacyCostText, rates);
    if (parsed !== null && parsed.copper !== null) {
      costCopper = parsed.copper;
      costSource = 'custom-text';
    } else {
      costSource = 'custom-text-unparseable';
    }
  } else if (entity?.cost !== undefined) {
    const converted = catalogCostToCopper(entity.cost, rates);
    if (converted !== null) {
      costCopper = converted;
      costSource = 'catalog';
    }
  }

  const category = readCategory(entity, data, customDefinition);

  return Object.freeze({
    instanceId: entry?.instanceId ?? null,
    itemRefId,
    name:
      typeof customDefinition?.nome === 'string' && customDefinition.nome !== ''
        ? customDefinition.nome
        : (typeof entity?.name === 'string' ? entity.name : null),
    origin: itemRefId !== null && customDefinition !== null ? 'both' : itemRefId !== null ? 'catalog' : 'custom',
    isCustom: entity === null || entity === undefined,
    categoryKind: category.kind,
    categorySlug: category.slug,
    categoryLabel: category.legacyLabel,
    // `weightKg === null` significa "sem informação de peso"; quem soma trata
    // como 0 (igual ao baseline), mas a projeção distingue os dois casos.
    weightKg,
    weightSource,
    costCopper,
    costSource,
    strengthRequirement: readStrengthRequirement(entity, data),
    // Campos textuais legados preservados VERBATIM, para que a UI/impressão
    // continuem exibindo exatamente o que o baseline exibia.
    legacyWeightText: legacyWeightText === null ? null : String(legacyWeightText),
    legacyCostText,
  });
}

/**
 * Avalia proficiência e requisito de Força de um item para um personagem.
 *
 * IMPORTANTE (paridade com o baseline): NADA aqui bloqueia equipar. No
 * monólito, o toggle "equipado" apenas grava `equipado = checked`
 * (`site/js/pages/sheet.js:15707`); proficiência e requisito de Força são
 * INFORMATIVOS (badge no criador, `site/js/pages/creator.js#badgeProficiencia`/
 * `#atendeRequisitoForca`). Por isso o retorno traz `advisories`, e não um
 * `canEquip` que o `equipItem` fosse consultar.
 *
 * `proficient` é `null` (DESCONHECIDO) quando o chamador não informa as
 * proficiências: o modelo canônico ainda não tem campo estruturado de
 * proficiência em armadura/arma (nem as entidades de classe do pacote
 * `dnd2024` declaram isso), então inferir "não proficiente" seria inventar um
 * default. Quem sabe (a camada de features, a partir de
 * `site/js/regras-cobertura.js`) injeta `context.armorProficiencies` /
 * `context.weaponProficiencies` como listas de slugs estruturados.
 * @param {object} character - CanonicalCharacter
 * @param {Readonly<object>} definition - saída de `resolveItemDefinition`
 * @param {{armorProficiencies?: ReadonlyArray<string>, weaponProficiencies?: ReadonlyArray<string>}} [context]
 * @returns {Readonly<{proficient: boolean|null, strengthRequirement: number|null, meetsStrengthRequirement: boolean|null, advisories: ReadonlyArray<string>}>}
 */
export function evaluateEquipRequirements(character, definition, context = {}) {
  const strengthRequirement = definition?.strengthRequirement ?? null;
  const strengthScore = character?.state?.abilities?.forca;
  const meetsStrengthRequirement =
    strengthRequirement === null
      ? null
      : typeof strengthScore === 'number' && Number.isFinite(strengthScore)
        ? strengthScore >= strengthRequirement
        : null;

  let proficient = null;
  const slug = definition?.categorySlug ?? null;
  if (slug !== null) {
    const declared =
      definition.categoryKind === 'armor'
        ? context?.armorProficiencies
        : definition.categoryKind === 'weapon'
          ? context?.weaponProficiencies
          : undefined;
    if (Array.isArray(declared)) {
      proficient = declared.includes(slug);
    }
  }

  const advisories = [];
  if (meetsStrengthRequirement === false) {
    advisories.push('strength-requirement-not-met');
  }
  if (proficient === false) {
    advisories.push('not-proficient');
  }

  return Object.freeze({
    proficient,
    strengthRequirement,
    meetsStrengthRequirement,
    advisories: Object.freeze(advisories),
  });
}

/**
 * Aplica uma edição numérica a um `customDefinition` de item legado/customizado
 * e REGERA a projeção textual correspondente. Nunca deixa `dados.peso` /
 * `dados.custo` congelados apontando para o valor antigo: quando o número
 * muda, o texto é reescrito no mesmo formato determinístico que o baseline
 * produz.
 *
 * Campos não citados em `changes` ficam intactos (inclusive `bonus_ca`,
 * `descricao` e qualquer outro campo livre que o v1 gravou).
 * @param {*} customDefinition
 * @param {{weightKg?: number, costCopper?: number}} changes
 * @param {Record<string, number>} rates - taxas resolvidas (para o texto de custo).
 * @returns {import('../../core/result.js').Result | {ok: true, value: object}} Result<object, AppError>
 */
export function editCustomDefinitionNumbers(customDefinition, changes = {}, rates = {}) {
  if (!isPlainObject(customDefinition)) {
    return { ok: false, error: equipmentError('EQUIPMENT_CUSTOM_DEFINITION_INVALID', '"customDefinition" deve ser um objeto.', {}) };
  }
  const hasWeight = Object.hasOwn(changes ?? {}, 'weightKg');
  const hasCost = Object.hasOwn(changes ?? {}, 'costCopper');
  if (!hasWeight && !hasCost) {
    return { ok: false, error: equipmentError('EQUIPMENT_EDIT_EMPTY', 'Nenhum campo numérico foi informado para edição.', {}) };
  }
  if (hasWeight && (typeof changes.weightKg !== 'number' || !Number.isFinite(changes.weightKg) || changes.weightKg < 0)) {
    return { ok: false, error: equipmentError('EQUIPMENT_WEIGHT_INVALID', '"weightKg" deve ser um número >= 0.', { weightKg: changes.weightKg }) };
  }
  if (hasCost && (!Number.isInteger(changes.costCopper) || changes.costCopper < 0)) {
    return { ok: false, error: equipmentError('EQUIPMENT_COST_INVALID', '"costCopper" deve ser um inteiro >= 0.', { costCopper: changes.costCopper }) };
  }

  const nextData = { ...readCustomData(customDefinition) };
  if (hasWeight) {
    nextData.weightKg = changes.weightKg;
    nextData.peso = formatWeightText(changes.weightKg);
  }
  if (hasCost) {
    const text = formatCostText(changes.costCopper, rates);
    if (text === null) {
      return {
        ok: false,
        error: equipmentError(
          'EQUIPMENT_COST_NOT_REPRESENTABLE',
          'Não há denominação com taxa conhecida capaz de representar esse custo exatamente.',
          { costCopper: changes.costCopper },
        ),
      };
    }
    nextData.costCopper = changes.costCopper;
    nextData.custo = text;
  }

  return { ok: true, value: { ...customDefinition, dados: nextData } };
}
