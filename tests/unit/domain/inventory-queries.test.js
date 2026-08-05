// Testes da projeção de inventário (Task 19):
// `site/js/domain/inventory/inventory-queries.js` +
// `site/js/domain/inventory/equipment-rules.js`. Cobre peso, capacidade de
// carga, sobrecarga, categoria/requisito estruturados, proficiência,
// preservação dos campos legados e o CONTRATO com `getMovement` (Task 16),
// que consome `context.encumbranceLevel` produzido aqui.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ok } from '../../../site/js/core/result.js';
import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import { getMovement } from '../../../site/js/domain/character/queries/index.js';
import { getInventoryProjection, ENCUMBRANCE_LEVELS } from '../../../site/js/domain/inventory/inventory-queries.js';
import {
  parseWeightText,
  formatWeightText,
  resolveItemDefinition,
  evaluateEquipRequirements,
  editCustomDefinitionNumbers,
} from '../../../site/js/domain/inventory/equipment-rules.js';

const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });
const TAXAS_BASELINE = Object.freeze({ pc: 1, pp: 10, pe: 50, po: 100, pl: 1000 });

// Entidades reais (recortadas) de `dados/pacotes/dnd2024/equipment/armor.json`.
const COTA_DE_MALHA = Object.freeze({
  id: 'dnd2024:armor:cota-de-malha',
  type: 'armor',
  name: 'Cota de Malha',
  armorCategory: 'heavy',
  baseArmorClass: 16,
  addDexModifier: false,
  strengthRequirement: 13,
  stealthDisadvantage: true,
  weight: 27,
  cost: Object.freeze({ amount: 75, currency: 'gp' }),
  effects: Object.freeze([]),
});
const ESCUDO = Object.freeze({
  id: 'dnd2024:armor:escudo',
  type: 'armor',
  name: 'Escudo',
  armorCategory: 'shield',
  armorClassBonus: 2,
  addDexModifier: false,
  weight: 3,
  cost: Object.freeze({ amount: 10, currency: 'gp' }),
  effects: Object.freeze([]),
});

/**
 * Registry de teste com o mesmo formato do real (`get`/`resolve`/`list`).
 * @param {Record<string, object>} entities
 * @returns {Readonly<object>}
 */
function makeFakeRegistry(entities = {}) {
  return Object.freeze({
    get(id) {
      return entities[id] ?? null;
    },
    resolve(reference) {
      const id = typeof reference === 'string' ? reference : reference?.id;
      return ok(entities[id] ?? Object.freeze({ id, type: 'stub', effects: Object.freeze([]) }));
    },
    list() {
      return Object.freeze([]);
    },
  });
}

const REGISTRY = makeFakeRegistry({
  'dnd2024:ruleset:core': Object.freeze({ id: 'dnd2024:ruleset:core', type: 'ruleset', effects: Object.freeze([]) }),
  'dnd2024:armor:cota-de-malha': COTA_DE_MALHA,
  'dnd2024:armor:escudo': ESCUDO,
});

/**
 * Entrada de inventário no formato EXATO produzido pela migração real
 * (`infra/character/migrations/v1-to-v2.js`): `customDefinition` com o item
 * bruto, `expended: 0`, `sourceInstanceId: null`.
 * @param {object} params
 * @returns {object}
 */
function migratedEntry({ instanceId, nome, tipo = 'equipamento', itemRef = null, quantity = 1, equipped = false, dados }) {
  return Object.freeze({
    instanceId,
    itemRef,
    customDefinition: Object.freeze({ nome, tipo, ...(dados === undefined ? {} : { dados: Object.freeze({ ...dados }) }) }),
    quantity,
    equipped,
    expended: 0,
    sourceInstanceId: null,
  });
}

/**
 * @param {{inventory?: ReadonlyArray<object>, abilities?: object, options?: object, overrides?: object}} params
 * @returns {object}
 */
function makeCharacter({ inventory = [], abilities = {}, options = {}, overrides } = {}) {
  const base = createEmptyCharacter({ id: 'char-inv', now: '2026-08-02T00:00:00.000Z', rulesetRef: RULESET_REF });
  return Object.freeze({
    ...base,
    build: Object.freeze({
      ...base.build,
      options: Object.freeze({ ...base.build.options, ...options }),
    }),
    state: Object.freeze({
      ...base.state,
      abilities: Object.freeze({ ...base.state.abilities, ...abilities }),
      inventory: Object.freeze([...inventory]),
    }),
    ...(overrides ? { overrides: Object.freeze(overrides) } : {}),
  });
}

describe('domain/inventory/equipment-rules — parsing textual do item legado (só aqui)', () => {
  test('parsePeso replica o baseline (kg, g, "—", "Varia", vírgula decimal)', () => {
    assert.equal(parseWeightText('20 kg'), 20);
    assert.equal(parseWeightText('0,5 kg'), 0.5);
    assert.equal(parseWeightText('500 g'), 0.5);
    assert.equal(parseWeightText('—'), 0);
    assert.equal(parseWeightText('Varia'), 0);
    assert.equal(parseWeightText(''), 0);
    assert.equal(parseWeightText(null), 0);
    assert.equal(parseWeightText('3'), 3);
  });

  test('ciclo parse -> editar -> formatar -> parse é estável (idempotente)', () => {
    for (const texto of ['0 kg', '20 kg', '0,5 kg', '1,25 kg']) {
      const numero = parseWeightText(texto);
      const reformatado = formatWeightText(numero);
      assert.equal(parseWeightText(reformatado), numero, `ciclo instável para "${texto}"`);
      // Segunda volta: formatar o valor reparseado dá exatamente o mesmo texto.
      assert.equal(formatWeightText(parseWeightText(reformatado)), reformatado);
    }
  });

  test('editar o número REGERA o texto (nunca deixa o texto legado congelado)', () => {
    const custom = { nome: 'Anel de Proteção Caseiro', tipo: 'anel', dados: { bonus_ca: 1, peso: '0 kg' } };
    const editado = editCustomDefinitionNumbers(custom, { weightKg: 2.5, costCopper: 5000 }, TAXAS_BASELINE);
    assert.equal(editado.ok, true);
    assert.equal(editado.value.dados.weightKg, 2.5);
    assert.equal(editado.value.dados.peso, '2,5 kg');
    assert.equal(editado.value.dados.costCopper, 5000);
    assert.equal(editado.value.dados.custo, '5 PL');
    // Campos livres do v1 preservados.
    assert.equal(editado.value.dados.bonus_ca, 1);
    assert.equal(editado.value.tipo, 'anel');
    // E o numérico volta a bater com o texto ao ser relido.
    assert.equal(parseWeightText(editado.value.dados.peso), editado.value.dados.weightKg);
  });
});

describe('domain/inventory/equipment-rules — precedência item do jogador > catálogo', () => {
  test('o peso gravado na ficha vence o peso do catálogo (paridade com o baseline)', () => {
    const entry = migratedEntry({
      instanceId: 'a',
      nome: 'Cota de Malha',
      tipo: 'armadura',
      itemRef: { id: 'dnd2024:armor:cota-de-malha', packageVersion: '1.0.0' },
      dados: { ca: '16', categoria: 'Pesada', peso: '20 kg' },
    });
    const definition = resolveItemDefinition(entry, { registry: REGISTRY, rates: TAXAS_BASELINE });
    assert.equal(definition.weightKg, 20, 'o catálogo diz 27 kg, mas a ficha diz 20 kg');
    assert.equal(definition.weightSource, 'custom-text');
    assert.equal(definition.legacyWeightText, '20 kg');
    // ...mas o dado ESTRUTURADO que o v1 não tinha vem do catálogo.
    assert.equal(definition.categorySlug, 'heavy');
    assert.equal(definition.strengthRequirement, 13);
  });

  test('sem nenhuma informação de peso na ficha, o catálogo é consultado', () => {
    const entry = migratedEntry({
      instanceId: 'a',
      nome: 'Escudo',
      tipo: 'escudo',
      itemRef: { id: 'dnd2024:armor:escudo', packageVersion: '1.0.0' },
    });
    const definition = resolveItemDefinition(entry, { registry: REGISTRY, rates: TAXAS_BASELINE });
    assert.equal(definition.weightKg, 3);
    assert.equal(definition.weightSource, 'catalog');
    assert.equal(definition.costCopper, 1000); // 10 gp = 1000 cobre
    assert.equal(definition.costSource, 'catalog');
  });

  test('sem taxas de moeda, o custo fica null (nunca 0, que significaria "de graça")', () => {
    const entry = migratedEntry({
      instanceId: 'a',
      nome: 'Escudo',
      itemRef: { id: 'dnd2024:armor:escudo', packageVersion: '1.0.0' },
    });
    const definition = resolveItemDefinition(entry, { registry: REGISTRY });
    assert.equal(definition.costCopper, null);
  });

  test('item 100% customizado (sem itemRef) é permitido e preserva os campos legados', () => {
    const entry = migratedEntry({
      instanceId: 'a',
      nome: 'Anel de Proteção Caseiro',
      tipo: 'anel',
      dados: { bonus_ca: 1, peso: '0 kg' },
    });
    const definition = resolveItemDefinition(entry, { registry: REGISTRY, rates: TAXAS_BASELINE });
    assert.equal(definition.isCustom, true);
    assert.equal(definition.origin, 'custom');
    assert.equal(definition.name, 'Anel de Proteção Caseiro');
    assert.equal(definition.weightKg, 0);
    assert.equal(definition.legacyWeightText, '0 kg');
    assert.equal(definition.strengthRequirement, null);
  });

  test('categoria legada em português vira slug estruturado', () => {
    const armadura = resolveItemDefinition(
      migratedEntry({ instanceId: 'a', nome: 'Armadura Caseira', tipo: 'armadura', dados: { categoria: 'Média' } }),
      {},
    );
    assert.equal(armadura.categoryKind, 'armor');
    assert.equal(armadura.categorySlug, 'medium');
    assert.equal(armadura.categoryLabel, 'Média');

    const escudo = resolveItemDefinition(migratedEntry({ instanceId: 'b', nome: 'Escudo Extra', tipo: 'escudo' }), {});
    assert.equal(escudo.categorySlug, 'shield');
  });

  test('requisito de Força legado ("For. 13") é parseado com a regex do baseline', () => {
    const definition = resolveItemDefinition(
      migratedEntry({
        instanceId: 'a',
        nome: 'Placas Caseiras',
        tipo: 'armadura',
        dados: { categoria: 'Pesada', requisito_forca: 'For. 15' },
      }),
      {},
    );
    assert.equal(definition.strengthRequirement, 15);

    const semRequisito = resolveItemDefinition(
      migratedEntry({ instanceId: 'b', nome: 'Couro', tipo: 'armadura', dados: { requisito_forca: '—' } }),
      {},
    );
    assert.equal(semRequisito.strengthRequirement, null);
  });
});

describe('domain/inventory/equipment-rules — proficiência e requisito (informativos, nunca bloqueantes)', () => {
  const definition = resolveItemDefinition(
    migratedEntry({
      instanceId: 'a',
      nome: 'Cota de Malha',
      tipo: 'armadura',
      itemRef: { id: 'dnd2024:armor:cota-de-malha', packageVersion: '1.0.0' },
      dados: { peso: '20 kg' },
    }),
    { registry: REGISTRY },
  );

  test('proficiência é null (DESCONHECIDA) quando o chamador não informa — nunca "false" inventado', () => {
    const evaluated = evaluateEquipRequirements(makeCharacter(), definition, {});
    assert.equal(evaluated.proficient, null);
    assert.deepEqual([...evaluated.advisories], ['strength-requirement-not-met']); // Força 10 < 13
  });

  test('com as proficiências injetadas, o slug estruturado decide', () => {
    const character = makeCharacter({ abilities: { forca: 16 } });
    const proficiente = evaluateEquipRequirements(character, definition, { armorProficiencies: ['heavy', 'shield'] });
    assert.equal(proficiente.proficient, true);
    assert.deepEqual([...proficiente.advisories], []);

    const semProficiencia = evaluateEquipRequirements(character, definition, { armorProficiencies: ['light'] });
    assert.equal(semProficiencia.proficient, false);
    assert.deepEqual([...semProficiencia.advisories], ['not-proficient']);
  });

  test('requisito de Força atendido/não atendido é reportado, não bloqueia', () => {
    const fraco = evaluateEquipRequirements(makeCharacter({ abilities: { forca: 12 } }), definition, {});
    assert.equal(fraco.meetsStrengthRequirement, false);
    const forte = evaluateEquipRequirements(makeCharacter({ abilities: { forca: 13 } }), definition, {});
    assert.equal(forte.meetsStrengthRequirement, true);
  });
});

describe('domain/inventory/inventory-queries — peso, capacidade e sobrecarga', () => {
  test('peso total = peso × quantidade de TODOS os itens (equipados ou não)', () => {
    const character = makeCharacter({
      inventory: [
        migratedEntry({ instanceId: 'a', nome: 'Cota de Malha', tipo: 'armadura', equipped: true, dados: { peso: '20 kg' } }),
        migratedEntry({ instanceId: 'b', nome: 'Escudo', tipo: 'escudo', equipped: true, dados: { peso: '3 kg' } }),
        migratedEntry({ instanceId: 'c', nome: 'Mochila', dados: { peso: '5 kg' } }),
      ],
      abilities: { forca: 12 },
    });
    const result = getInventoryProjection(character);
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.equal(result.value.totalWeightKg, 28);
    assert.equal(result.value.carryingCapacityKg, 84); // Força 12 × 7 (médio)
    assert.equal(result.value.encumbranceLevel, 'none');
  });

  test('quantidade multiplica o peso; quantidade <= 0 não soma nada (guarda do baseline)', () => {
    const character = makeCharacter({
      inventory: [
        migratedEntry({ instanceId: 'a', nome: 'Ração', quantity: 3, dados: { peso: '1 kg' } }),
        migratedEntry({ instanceId: 'b', nome: 'Pedra', quantity: 0, dados: { peso: '100 kg' } }),
      ],
    });
    const result = getInventoryProjection(character);
    assert.equal(result.ok, true);
    assert.equal(result.value.totalWeightKg, 3);
  });

  test('sobrecarga: peso acima da capacidade vira encumbranceLevel "overloaded"', () => {
    const character = makeCharacter({
      inventory: [migratedEntry({ instanceId: 'a', nome: 'Bigorna', dados: { peso: '200 kg' } })],
      abilities: { forca: 10 },
    });
    const result = getInventoryProjection(character);
    assert.equal(result.ok, true);
    assert.equal(result.value.carryingCapacityKg, 70);
    assert.equal(result.value.overloaded, true);
    assert.equal(result.value.encumbranceLevel, 'overloaded');
    assert.ok(ENCUMBRANCE_LEVELS.includes(result.value.encumbranceLevel));
  });

  test('peso exatamente igual à capacidade NÃO é sobrecarga (estritamente maior, como o baseline)', () => {
    const character = makeCharacter({
      inventory: [migratedEntry({ instanceId: 'a', nome: 'Fardo', dados: { peso: '70 kg' } })],
      abilities: { forca: 10 },
    });
    const result = getInventoryProjection(character);
    assert.equal(result.ok, true);
    assert.equal(result.value.encumbranceLevel, 'none');
  });

  test('a capacidade REUSA o motor de efeitos (alvo derivado "carrying-capacity"), sem fórmula duplicada', () => {
    const character = makeCharacter({
      inventory: [migratedEntry({ instanceId: 'a', nome: 'Bigorna', dados: { peso: '200 kg' } })],
      abilities: { forca: 10 },
      overrides: { 'carrying-capacity': { value: 1000, source: 'manual' } },
    });
    const result = getInventoryProjection(character);
    assert.equal(result.ok, true);
    assert.equal(result.value.carryingCapacityKg, 1000, 'o efeito precisa chegar aqui via getMovement');
    assert.equal(result.value.encumbranceLevel, 'none', '200 kg cabe em 1000 kg de capacidade');
  });

  test('capacidade 0 nunca sobrecarrega (réplica de sheet.js#getEstadoCarga)', () => {
    const character = makeCharacter({
      inventory: [migratedEntry({ instanceId: 'a', nome: 'Fardo', dados: { peso: '5 kg' } })],
      abilities: { forca: 0 },
    });
    const result = getInventoryProjection(character);
    assert.equal(result.ok, true);
    assert.equal(result.value.carryingCapacityKg, 0);
    assert.equal(result.value.overloaded, false);
  });

  test('personagem inválido devolve erro estruturado, nunca exceção', () => {
    const result = getInventoryProjection(null);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'INVENTORY_QUERY_INVALID_CHARACTER');
  });
});

describe('domain/inventory/inventory-queries — CONTRATO com getMovement (Task 16)', () => {
  // `movement.js` documenta que `context.encumbranceLevel` é responsabilidade
  // desta projeção. Estes testes fecham o contrato ponta a ponta.
  const sobrecarregado = makeCharacter({
    inventory: [migratedEntry({ instanceId: 'a', nome: 'Bigorna', dados: { peso: '200 kg' } })],
    abilities: { forca: 10 },
    options: { encumbranceAffectsMovement: true },
  });

  test('encumbranceLevel da projeção alimenta getMovement e reduz o deslocamento a 1,5 m', () => {
    const projection = getInventoryProjection(sobrecarregado);
    assert.equal(projection.ok, true);

    const semSobrecarga = getMovement(sobrecarregado);
    assert.equal(semSobrecarga.ok, true);
    assert.equal(semSobrecarga.value.effective, 9);

    const comSobrecarga = getMovement(sobrecarregado, { encumbranceLevel: projection.value.encumbranceLevel });
    assert.equal(comSobrecarga.ok, true);
    assert.equal(comSobrecarga.value.effective, 1.5);
    assert.equal(comSobrecarga.value.encumbranceLevel, 'overloaded');
  });

  test('todo valor produzido pela projeção é aceito por getMovement (vocabulário compatível)', () => {
    for (const level of ENCUMBRANCE_LEVELS) {
      const movement = getMovement(sobrecarregado, { encumbranceLevel: level });
      assert.equal(movement.ok, true);
      assert.equal(movement.value.encumbranceLevel, level);
    }
  });

  test('com a opção desligada, a sobrecarga NÃO reduz o deslocamento (regra opcional do baseline)', () => {
    const semOpcao = makeCharacter({
      inventory: [migratedEntry({ instanceId: 'a', nome: 'Bigorna', dados: { peso: '200 kg' } })],
      abilities: { forca: 10 },
    });
    const projection = getInventoryProjection(semOpcao);
    assert.equal(projection.value.encumbranceAffectsMovement, false);
    const movement = getMovement(semOpcao, { encumbranceLevel: projection.value.encumbranceLevel });
    assert.equal(movement.value.effective, 9);
  });
});

describe('domain/inventory/inventory-queries — itens projetados', () => {
  test('cada item projeta identidade, quantidade, equipado, pesos e avisos', () => {
    const character = makeCharacter({
      inventory: [
        migratedEntry({
          instanceId: 'inst-cota',
          nome: 'Cota de Malha',
          tipo: 'armadura',
          itemRef: { id: 'dnd2024:armor:cota-de-malha', packageVersion: '1.0.0' },
          equipped: true,
          quantity: 2,
          dados: { peso: '20 kg' },
        }),
      ],
      abilities: { forca: 10 },
    });
    const result = getInventoryProjection(character, { registry: REGISTRY, currencyRates: TAXAS_BASELINE });
    assert.equal(result.ok, true);
    const [item] = result.value.items;
    assert.equal(item.instanceId, 'inst-cota');
    assert.equal(item.name, 'Cota de Malha');
    assert.equal(item.origin, 'both');
    assert.equal(item.quantity, 2);
    assert.equal(item.equipped, true);
    assert.equal(item.unitWeightKg, 20);
    assert.equal(item.stackWeightKg, 40);
    assert.equal(item.categorySlug, 'heavy');
    assert.equal(item.strengthRequirement, 13);
    assert.equal(item.meetsStrengthRequirement, false);
    assert.equal(item.proficient, null);
    assert.equal(item.unitCostCopper, 7500); // 75 gp
    assert.equal(item.sourceInstanceId, null);
    assert.equal(result.value.totalWeightKg, 40);
  });

  test('a projeção não muta o personagem nem o inventário original', () => {
    const inventory = [migratedEntry({ instanceId: 'a', nome: 'X', dados: { peso: '1 kg' } })];
    const character = makeCharacter({ inventory });
    const snapshot = JSON.stringify(character);
    getInventoryProjection(character, { registry: REGISTRY, currencyRates: TAXAS_BASELINE });
    assert.equal(JSON.stringify(character), snapshot);
  });
});
