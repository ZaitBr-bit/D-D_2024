// Módulo `features/sheet/sheet-view-model`: `buildSheetViewModel` — a projeção
// ÚNICA que tela, impressão e PDF (Task 33) consomem.
//
// ## Duas metades, e por que a separação importa
//
// `viewModel.derived` contém EXCLUSIVAMENTE valores CALCULADOS. Seu conjunto
// de chaves é fechado e corresponde, uma a uma, a
// `tests/fixtures/expected/sheet-view-model-keys.json`. Um valor derivado "que
// faltou" NÃO é inventado aqui: ou ele já tem consulta, ou a lista é estendida
// COM justificativa, origem e teste — nunca contornado lendo o personagem cru
// depois. É o que impede que a Task 33 (ou uma seção das Tasks 30-32) volte a
// calcular regra de jogo dentro do renderizador, que é exatamente o defeito do
// `sheet.js` legado.
//
// As fontes de `derived` são três, todas fora desta camada:
//
//   - `domain/character/queries/**` (Task 16) — atributos, PV, CA, iniciativa,
//     movimento, defesas, sentidos, perícias e a proficiência de salvaguarda;
//   - `domain/spells` (Task 18) e `domain/inventory` (Task 19) — espaços de
//     magia, carga e a projeção de inventário de onde saem os ataques;
//   - `domain/effects` (Task 15) — o teto declarado de cada recurso e os
//     modificadores nos alvos `attack`/`damage`.
//
// As seis últimas famílias (salvaguardas, espaços de magia, recursos, ataques,
// carga transportada e dados imprimíveis) foram ACRESCENTADAS à lista da Task
// 16 pela Task 29, sob `task29Extensions` na fixture — decisão registrada em
// `questions-for-review.txt` item 14. Deixá-las de fora faria cada seção das
// Tasks 30-32 recalcular o mesmo valor por conta própria, que é precisamente o
// que a lista fechada existe para impedir.
//
// `viewModel.data` é ECO LITERAL do `CanonicalCharacter`: identidade, build,
// estado, overrides, extensões e metadata, sem uma única conta. É a metade dos
// CAMPOS (o que o jogador digitou e escolheu), não a dos valores. Ler
// `identity.name` não deriva nada; qualquer NÚMERO de jogo tem de vir de
// `derived`. A separação torna a diferença auditável.
//
// ## PV temporário
//
// A única chave de PV temporário é `derived.hitPoints.temporary`, vinda de
// `getHitPointProjection`. Os nomes legados (`pv_temp`/`pv_temporario`) são
// resolvidos por `infra/character/legacy-query-adapter.js` ANTES desta camada
// e não têm representação aqui.
//
// ## Pureza
//
// A função não lê relógio, não toca storage, não muta o personagem e devolve
// tudo congelado em profundidade. É testada com igualdade profunda contra uma
// cópia da entrada e com a entrada previamente congelada.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import {
  ABILITY_KEYS,
  getAbilityModifier,
  getProficiencyBonus,
  getHitPointProjection,
  getArmorClass,
  getInitiative,
  getMovement,
  getDefenses,
  getSenses,
  getSkillProjection,
  getSavingThrowProjection,
  getResourceProjection,
} from '../../domain/character/queries/index.js';
import { getSpellcastingProjection } from '../../domain/spells/index.js';
import {
  getInventoryProjection,
  normalizeWallet,
  resolveCurrencyRates,
  walletTotalInCopper,
  WALLET_DENOMINATIONS,
} from '../../domain/inventory/index.js';
import { collectCharacterEffects, resolveNumericTarget } from '../../domain/effects/index.js';
import { projectClassHandlers } from '../../domain/commands/class-actions.js';
import { getLevelUpOptions } from '../../domain/progression/index.js';
import { deepFreeze } from './sheet-state.js';

const SCOPE = 'features.sheet.view-model';

/**
 * Chaves de `HitPointProjection` (Task 16), na ordem da fixture.
 * @type {ReadonlyArray<string>}
 */
export const HIT_POINT_KEYS = Object.freeze([
  'current',
  'temporary',
  'maximum',
  'hitDiceTotal',
  'hitDiceUsed',
  'hitDiceRemaining',
]);

/** @type {ReadonlyArray<string>} */
export const MOVEMENT_KEYS = Object.freeze([
  'base',
  'effective',
  'encumbranceLevel',
  'exhaustionLevel',
  'carryingCapacity',
  'sizeSlug',
]);

/** @type {ReadonlyArray<string>} */
export const DEFENSE_KEYS = Object.freeze([
  'resistances',
  'vulnerabilities',
  'immunities',
  'spellSaveDC',
  'spellAttackBonus',
]);

/**
 * Chaves de NOME DE EXIBIÇÃO das três listas de defesa (extensão da Task 33,
 * declarada em `task33Extensions` de `sheet-view-model-keys.json`).
 *
 * `getDefenses` devolve ContentIds (`dnd2024:damage-type:fogo`) — é o
 * vocabulário certo para o domínio, e é por ID que a mecânica compara. Mas até
 * a Task 33 NENHUMA chave do ViewModel carregava o nome resolvido, então a
 * tela, a impressão e o PDF mostravam o identificador técnico ao jogador. O
 * ID continua sendo a fonte da verdade (as três chaves originais não mudam); o
 * rótulo viaja ao lado, resolvido pelo MESMO mecanismo que `printable` já usa
 * (`resolveDisplayName`), nunca por um segundo caminho de resolução.
 *
 * Cada chave é a lista de rótulos NA MESMA ORDEM da lista de ids irmã.
 * @type {Readonly<Record<string, string>>}
 */
export const DEFENSE_LABEL_KEYS = Object.freeze({
  resistances: 'resistanceLabels',
  vulnerabilities: 'vulnerabilityLabels',
  immunities: 'immunityLabels',
});

/** @type {ReadonlyArray<string>} */
export const SENSES_KEYS = Object.freeze(['passivePerception', 'passiveInsight', 'passiveInvestigation', 'darkvision']);

/** @type {ReadonlyArray<string>} */
export const SKILL_KEYS = Object.freeze(['abilityKey', 'proficient', 'expert', 'bonus', 'passive']);

/** @type {ReadonlyArray<string>} */
export const SAVING_THROW_KEYS = Object.freeze(['abilityKey', 'proficient', 'bonus']);

/** @type {ReadonlyArray<string>} */
export const SPELL_SLOT_KEYS = Object.freeze(['level', 'used', 'extra', 'maximum', 'available']);

/** @type {ReadonlyArray<string>} */
export const RESOURCE_KEYS = Object.freeze(['current', 'maximum', 'available', 'spent', 'recovery']);

/** @type {ReadonlyArray<string>} */
export const ATTACK_KEYS = Object.freeze([
  'instanceId',
  'itemId',
  'name',
  'equipped',
  'abilityKey',
  'proficient',
  'attackBonus',
  'damageDice',
  'damageBonus',
  'damageType',
  'rangeCategory',
  'properties',
]);

/** @type {ReadonlyArray<string>} */
export const LOAD_KEYS = Object.freeze([
  'totalWeightKg',
  'carryingCapacityKg',
  'encumbranceLevel',
  'overloaded',
  'encumbranceAffectsMovement',
]);

/**
 * Motivo NOMEADO de `derived.inventory` estar indisponível: sem `registry` não
 * existe catálogo para resolver item nenhum, e a projeção de inventário sequer
 * é calculada. Ele viaja em `derived.inventory.reason` para que a tela consiga
 * distinguir "não deu para saber" de "o personagem não tem itens".
 * @type {string}
 */
export const INVENTORY_UNAVAILABLE_REASON = 'SHEET_INVENTORY_REGISTRY_MISSING';

/**
 * Chaves de CADA item de `derived.inventory.items` (extensão da Task 32).
 *
 * É um RECORTE de `getInventoryProjection().items` (Task 19), não uma projeção
 * nova: nenhum peso, custo, categoria ou aviso de proficiência é recalculado
 * aqui. Ficam de fora da lista os campos que a seção não pode usar sem
 * reintroduzir o defeito que a arquitetura combate — `index` (posição no array,
 * que jamais pode virar endereço de reordenação; a identidade é `instanceId`)
 * e os textos legados brutos de peso/custo (`legacyWeightText`/
 * `legacyCostText`), que são prosa do registro antigo.
 * @type {ReadonlyArray<string>}
 */
export const INVENTORY_ITEM_KEYS = Object.freeze([
  'instanceId',
  'name',
  'origin',
  'isCustom',
  'categoryKind',
  'categorySlug',
  'categoryLabel',
  'quantity',
  'equipped',
  'expended',
  'unitWeightKg',
  'stackWeightKg',
  'unitCostCopper',
  'strengthRequirement',
  'meetsStrengthRequirement',
  'proficient',
  'advisories',
]);

/**
 * Chaves de `derived.wallet` (extensão da Task 32): as cinco denominações
 * NORMALIZADAS mais o total convertido e o estado da tabela de conversão.
 * @type {ReadonlyArray<string>}
 */
export const WALLET_KEYS = Object.freeze([...WALLET_DENOMINATIONS, 'totalCopper', 'ratesAvailable']);

/**
 * Coleções de `derived` cujas CHAVES são dinâmicas (um id de perícia, de
 * recurso, um nível de espaço, um índice de ataque). O contrato delas não é
 * "estas chaves existem", é "toda entrada tem exatamente estas chaves" — e é
 * assim que o teste as verifica.
 * @type {Readonly<Record<string, ReadonlyArray<string>>>}
 */
export const DERIVED_COLLECTIONS = Object.freeze({
  skills: SKILL_KEYS,
  savingThrows: SAVING_THROW_KEYS,
  'spellSlots.byLevel': SPELL_SLOT_KEYS,
  resources: RESOURCE_KEYS,
  attacks: ATTACK_KEYS,
  // A LISTA de itens vive dentro do envelope `derived.inventory`
  // (`available`/`reason`/`items`); a coleção dinâmica é, portanto,
  // `inventory.items` — os dois irmãos são estruturais e entram no outro lado
  // do contrato.
  'inventory.items': INVENTORY_ITEM_KEYS,
});

/**
 * Chaves de primeiro nível de `viewModel.derived`. Fechado: o teste
 * `sheet-view-model.test.js` compara este conjunto (expandido) com
 * `sheet-view-model-keys.json`.
 * @type {ReadonlyArray<string>}
 */
export const DERIVED_TOP_LEVEL_KEYS = Object.freeze([
  'abilities',
  'proficiencyBonus',
  'hitPoints',
  'armorClass',
  'initiative',
  'movement',
  'defenses',
  'senses',
  'skills',
  'savingThrows',
  'spellSlots',
  'resources',
  'attacks',
  'load',
  // Extensões da Task 32 (`task32Extensions` na fixture): a LISTA de itens e a
  // CARTEIRA convertida. Ver o comentário na composição de `derived`.
  'inventory',
  'wallet',
  'printable',
  // Extensão da Task 30 (`task30Extensions` na fixture, decisão registrada em
  // `questions-for-review.txt` item 15): a projeção dos handlers de classe.
  // Sem ela, a seção de recursos/características não teria como saber QUAIS
  // ações a classe oferece nem se cada uma está disponível — e recalcular isso
  // dentro do renderizador é exatamente o que a lista fechada existe para
  // impedir.
  'classActions',
  // Segunda entrada de `task30Extensions`: a projeção do PRÓXIMO nível. Sem
  // ela o modo `v2` de `sections/level-up-flow-view.js` nunca desenha um card
  // de verdade — ele fica preso no seu estado de erro declarado —, e o
  // checklist do brief da Task 30 ("flag v2 `true` renderiza o fluxo em cards")
  // seria impossível de satisfazer. Ver a nota da fixture: é uma ADIÇÃO ao
  // escopo literal da Decisão A, registrada como tal no relatório.
  'levelUp',
]);

/**
 * Chaves de `viewModel.data` — eco literal do personagem canônico.
 * @type {ReadonlyArray<string>}
 */
export const DATA_KEYS = Object.freeze([
  'schemaVersion',
  'identity',
  'build',
  'state',
  'overrides',
  'extensions',
  'metadata',
]);

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
function viewModelError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Lista os ContentIds de perícia a projetar. Vem de `context.skillIds`
 * (injeção explícita, usada pelos testes e pelo harness) ou do catálogo. Um
 * catálogo ausente produz `{}` — nunca uma lista de perícias embutida no
 * código, que seria um default de jogo inventado nesta camada.
 * @param {object} context
 * @returns {ReadonlyArray<string>}
 */
function resolveSkillIds(context) {
  if (Array.isArray(context?.skillIds)) {
    return Object.freeze(context.skillIds.filter((id) => typeof id === 'string' && id.length > 0));
  }
  const registry = context?.registry ?? null;
  if (registry === null || typeof registry.list !== 'function') {
    return Object.freeze([]);
  }
  let entities;
  try {
    entities = registry.list('skill');
  } catch {
    return Object.freeze([]);
  }
  if (!Array.isArray(entities)) {
    return Object.freeze([]);
  }
  return Object.freeze(entities.map((entity) => entity?.id).filter((id) => typeof id === 'string' && id.length > 0));
}

/**
 * Constrói o `SheetViewModel` de `character`.
 *
 * Função PURA: nenhuma escrita, nenhum efeito, saída congelada em
 * profundidade. Uma consulta que falha derruba a projeção inteira com o
 * `AppError` original — nunca um ViewModel "quase certo" com um campo
 * silenciosamente ausente ou zerado.
 *
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {{
 *   registry?: object,
 *   skillIds?: ReadonlyArray<string>,
 *   maximumHitPoints?: number|null,
 *   encumbranceLevel?: string,
 *   level?: number,
 *   choices?: object,
 *   equippedItemIds?: ReadonlyArray<string>,
 *   stateFlags?: object,
 *   talentPassives?: object
 * }} [context]
 * @returns {import('../../core/result.js').Result} Result<SheetViewModel, AppError>
 */
export function buildSheetViewModel(character, context = {}) {
  if (character === null || typeof character !== 'object') {
    return err(viewModelError('SHEET_VIEW_MODEL_CHARACTER_INVALID', 'O ViewModel exige um CanonicalCharacter.', {}));
  }
  const characterId = character?.identity?.id;
  if (typeof characterId !== 'string' || characterId.length === 0) {
    return err(viewModelError('SHEET_VIEW_MODEL_CHARACTER_INVALID', 'O personagem precisa de identity.id.', {}));
  }

  const queryContext = context ?? {};

  // --- Atributos e bônus de proficiência ----------------------------------
  /** @type {Record<string, {modifier: number}>} */
  const abilities = {};
  for (const abilityKey of ABILITY_KEYS) {
    const modifier = getAbilityModifier(character, abilityKey, queryContext);
    if (!modifier.ok) {
      return modifier;
    }
    abilities[abilityKey] = { modifier: modifier.value };
  }

  const proficiencyBonus = getProficiencyBonus(character, queryContext);
  if (!proficiencyBonus.ok) {
    return proficiencyBonus;
  }

  // --- Inventário: precisa vir ANTES do deslocamento -----------------------
  //
  // `getInventoryProjection` é quem CALCULA `encumbranceLevel` (a partir do
  // peso transportado contra a capacidade), e `getMovement` é quem aplica a
  // penalidade de sobrecarga — mas só quando recebe esse nível pelo contexto
  // (`inventory-queries.js` documenta a composição obrigatória; ele próprio
  // remove `encumbranceLevel` do contexto ao chamar `getMovement`, para não
  // ser circular).
  //
  // Chamar `getMovement` com o contexto cru, como a primeira versão desta
  // função fazia, produzia um ViewModel que se CONTRADIZ: `load.overloaded`
  // dizia `true` e `movement.effective` vinha sem penalidade nenhuma — e o
  // PDF imprimia o deslocamento errado (achado Important 1 da revisão).
  //
  // As proficiências de ARMA entram AQUI, no contexto do inventário: é
  // `evaluateEquipRequirements` (dentro de `getInventoryProjection`) quem
  // resolve `item.proficient`, e sem elas todo ataque sairia com
  // `proficient: null` e sem bônus de proficiência (achado Important 2 da
  // revisão).
  const weaponProficiencies = resolveWeaponProficiencies(character, queryContext);
  const inventoryContext =
    weaponProficiencies === null ? queryContext : Object.freeze({ ...queryContext, weaponProficiencies });
  const inventory = queryContext.registry ? getInventoryProjection(character, inventoryContext) : null;
  if (inventory !== null && !inventory.ok) {
    return inventory;
  }
  const movementContext =
    inventory === null ? queryContext : Object.freeze({ ...queryContext, encumbranceLevel: inventory.value.encumbranceLevel });

  // --- Combate / PV -------------------------------------------------------
  const hitPoints = getHitPointProjection(character, queryContext);
  if (!hitPoints.ok) {
    return hitPoints;
  }
  const armorClass = getArmorClass(character, queryContext);
  if (!armorClass.ok) {
    return armorClass;
  }
  const initiative = getInitiative(character, queryContext);
  if (!initiative.ok) {
    return initiative;
  }
  const movement = getMovement(character, movementContext);
  if (!movement.ok) {
    return movement;
  }
  const defenses = getDefenses(character, queryContext);
  if (!defenses.ok) {
    return defenses;
  }
  const senses = getSenses(character, queryContext);
  if (!senses.ok) {
    return senses;
  }

  // --- Perícias -----------------------------------------------------------
  /** @type {Record<string, object>} */
  const skills = {};
  for (const skillId of resolveSkillIds(queryContext)) {
    const projection = getSkillProjection(character, skillId, queryContext);
    if (!projection.ok) {
      return projection;
    }
    skills[skillId] = pick(projection.value, SKILL_KEYS);
  }

  // --- Salvaguardas -------------------------------------------------------
  //
  // Delegado a `getSavingThrowProjection` (consulta de domínio), que faz a
  // composição COMPLETA: modificador + proficiência + efeitos declarados sobre
  // o alvo `save.<chave>`. A primeira versão desta função somava modificador e
  // proficiência aqui e parava — o alvo `save` é de primeira classe no motor
  // da Task 15 e estava sendo ignorado (achado Important 4 da revisão).
  const savingThrows = {};
  for (const abilityKey of ABILITY_KEYS) {
    const projection = getSavingThrowProjection(character, abilityKey, queryContext);
    if (!projection.ok) {
      return projection;
    }
    savingThrows[abilityKey] = pick(projection.value, SAVING_THROW_KEYS);
  }

  // --- Espaços de magia ---------------------------------------------------
  const spellcasting = projectSpellcasting(character, queryContext);
  if (!spellcasting.ok) {
    return spellcasting;
  }

  // --- Recursos (atual/máximo) --------------------------------------------
  //
  // Delegado a `getResourceProjection`, a leitura ÚNICA compartilhada com
  // `domain/commands/rest.js` (antes eram duas cópias que discordavam no dado
  // inválido — achado Important 6 da revisão).
  const resources = getResourceProjection(character, queryContext);
  if (!resources.ok) {
    return resources;
  }

  // --- Carga transportada -------------------------------------------------
  const load = inventory === null ? pick({}, LOAD_KEYS) : pick(inventory.value, LOAD_KEYS);

  // --- Itens e carteira (extensão da Task 32) ------------------------------
  //
  // `load` só traz TOTAIS. A seção `inventory-load-coins` precisa da LISTA de
  // itens resolvidos (nome, categoria, peso, custo, avisos de proficiência) e
  // do saldo convertido — e uma seção só recebe `viewModel`/`uiState`, nunca o
  // personagem canônico, o catálogo ou as taxas de câmbio. Sem estas duas
  // chaves a única saída seria reimplementar `resolveItemDefinition` e
  // `walletTotalInCopper` dentro do renderizador, que é exatamente o defeito
  // que a lista fechada existe para impedir. Nada é recalculado aqui: os itens
  // são recorte de `getInventoryProjection` e o total vem de
  // `walletTotalInCopper` (Task 19).
  //
  // AUSÊNCIA != VAZIO. Sem `registry` não há como resolver item nenhum, e a
  // primeira versão desta chave devolvia `[]` — indistinguível de "personagem
  // sem itens". `wallet` já resolvia isso (`ratesAvailable: false`) e `load` já
  // degrada para todos os campos `null`; `inventory` era o único que MENTIA.
  // Por isso a lista viaja dentro de um envelope com `available`/`reason`: um
  // consumidor consegue exibir a ausência (o mesmo espírito das lacunas
  // declaradas da Task 31) em vez de desenhar "Nenhum item" sobre uma projeção
  // que nunca foi calculada. É o padrão de bug "bypass silencioso quando a
  // porta está ausente" que este projeto já pegou repetidas vezes.
  const inventoryProjection = Object.freeze({
    available: inventory !== null,
    reason: inventory === null ? INVENTORY_UNAVAILABLE_REASON : null,
    items: Object.freeze((inventory === null ? [] : inventory.value.items).map((item) => pick(item, INVENTORY_ITEM_KEYS))),
  });
  const wallet = projectWallet(character, queryContext);

  const attacks = projectAttacks(character, queryContext, {
    inventory: inventory === null ? null : inventory.value,
    abilities,
    proficiencyBonus: proficiencyBonus.value,
  });
  if (!attacks.ok) {
    return attacks;
  }

  const derived = {
    abilities,
    proficiencyBonus: proficiencyBonus.value,
    hitPoints: pick(hitPoints.value, HIT_POINT_KEYS),
    armorClass: armorClass.value,
    initiative: initiative.value,
    movement: pick(movement.value, MOVEMENT_KEYS),
    defenses: withDefenseLabels(pick(defenses.value, DEFENSE_KEYS), queryContext),
    senses: pick(senses.value, SENSES_KEYS),
    skills,
    savingThrows,
    spellSlots: spellcasting.value,
    resources: resources.value,
    attacks: attacks.value,
    load,
    inventory: inventoryProjection,
    wallet,
    printable: null,
    classActions: projectClassActions(character, queryContext),
    levelUp: projectNextLevel(character, queryContext),
  };
  derived.printable = projectPrintable(character, queryContext, derived);

  const viewModel = {
    characterId,
    derived,
    // ECO dos CAMPOS do registro canônico: identidade, notas, escolhas e
    // estado como o jogador os gravou. Nenhuma conta, nenhuma renomeação,
    // nenhum default — todo valor CALCULADO mora em `derived`, e é de lá que
    // tela, impressão e PDF (Task 33) leem.
    data: pick(character, DATA_KEYS),
  };

  return ok(deepFreeze(viewModel));
}

/**
 * Projeta espaços de magia, espaços de pacto e os tetos de truques/preparadas.
 *
 * Delega a `getSpellcastingProjection` (Task 18) — a fonte única desses
 * números — e recorta dela só o que é ESPAÇO. CD e bônus de ataque de magia
 * NÃO são repetidos aqui: já vivem em `derived.defenses`, e duplicá-los
 * criaria dois lugares onde o mesmo valor pode divergir.
 *
 * Sem catálogo não há tabela de progressão para consultar, e a projeção sai
 * estruturalmente vazia (`byLevel: {}`, tetos `null`) — nunca uma tabela
 * embutida nesta camada, que seria um default de jogo inventado.
 * @param {object} character
 * @param {object} context
 * @returns {import('../../core/result.js').Result}
 */
function projectSpellcasting(character, context) {
  if (!context.registry) {
    return ok({ byLevel: {}, pact: { used: null, maximum: null, level: null, available: null }, cantripsKnown: null, preparedLimit: null });
  }
  const projection = getSpellcastingProjection(character, context);
  if (!projection.ok) {
    return projection;
  }
  const byLevel = {};
  for (const slot of projection.value.slots ?? []) {
    byLevel[String(slot.level)] = pick(slot, SPELL_SLOT_KEYS);
  }
  return ok({
    byLevel,
    pact: {
      used: projection.value.pactSlots.used,
      maximum: projection.value.pactSlots.maximum,
      level: projection.value.pactSlots.level,
      available: projection.value.pactSlots.available,
    },
    cantripsKnown: projection.value.cantripsKnown,
    preparedLimit: projection.value.preparedLimit,
  });
}

/**
 * Rótulos legados de proficiência de arma, exatamente como o baseline os
 * escreve em `proficiencias_extra` (hoje `build.legacyGrants.otherProficiencies`).
 * @type {Readonly<Record<string, string>>}
 */
const LEGACY_WEAPON_PROFICIENCY_LABELS = Object.freeze({
  'armas simples': 'simple',
  'armas marciais': 'martial',
});

/**
 * Resolve as proficiências de ARMA do personagem, em slugs de categoria.
 *
 * ## O que dá para derivar hoje, e o que não dá
 *
 * O baseline (`sheet.js#sheetTemProfArma`) junta DUAS fontes: as proficiências
 * concedidas pela CLASSE (`CLASSES_INFO[classe].armas`) e as extras do
 * personagem (`char.proficiencias_extra`).
 *
 * A segunda fonte sobreviveu à migração como uma lista explícita
 * (`build.legacyGrants.otherProficiencies`) e é reproduzida aqui por
 * comparação exata do rótulo — nunca por busca em texto livre.
 *
 * A PRIMEIRA não tem equivalente estruturado: no pacote `dnd2024` a
 * proficiência de arma da classe existe apenas como PROSA, dentro de
 * `legacyPresentation.tracos_basicos["Proficiências com Armas"]` (ex.: "Armas
 * Simples e Marciais"). Não há campo declarativo nem efeito correspondente.
 * Extrair isso por regex seria exatamente o anti-padrão que esta refatoração
 * existe para eliminar.
 *
 * Por isso, quando nada é derivável, a função devolve `null` — e não `[]`.
 * A diferença importa: `[]` faria `evaluateEquipRequirements` responder
 * `proficient: false` ("sabidamente NÃO proficiente"), afirmando algo falso
 * sobre um Guerreiro; `null` deixa a proficiência DESCONHECIDA, e o bônus não
 * é somado nem negado. É dívida de CONTEÚDO, registrada como concern no
 * relatório da Task 29 — não um default de jogo inventado aqui.
 *
 * `context.weaponProficiencies` (injetado pelo chamador) sempre vence.
 * @param {object} character
 * @param {object} context
 * @returns {ReadonlyArray<string>|null}
 */
function resolveWeaponProficiencies(character, context) {
  if (Array.isArray(context?.weaponProficiencies)) {
    return context.weaponProficiencies;
  }
  const extras = character?.build?.legacyGrants?.otherProficiencies;
  if (!Array.isArray(extras)) {
    return null;
  }
  const slugs = [];
  for (const entrada of extras) {
    if (typeof entrada !== 'string') {
      continue;
    }
    const slug = LEGACY_WEAPON_PROFICIENCY_LABELS[entrada.trim().toLowerCase()];
    if (slug !== undefined && !slugs.includes(slug)) {
      slugs.push(slug);
    }
  }
  return slugs.length > 0 ? Object.freeze(slugs) : null;
}

/**
 * Projeta a CARTEIRA (extensão da Task 32).
 *
 * As cinco denominações são o eco NORMALIZADO de `state.wallet`
 * (`normalizeWallet`, Task 19 — a mesma leitura que `changeWallet` usa, para
 * que tela e comando nunca discordem sobre o saldo atual).
 *
 * `totalCopper` só existe quando há tabela de conversão (preferência
 * `dnd_taxas_moeda` ou o ruleset do catálogo). Sem ela o valor é `null`, NUNCA
 * `0`: zero afirmaria "o personagem não tem dinheiro", que é falso — é o mesmo
 * cuidado que `getInventoryProjection` já tem com `costCopper`. `ratesAvailable`
 * torna a ausência LEGÍVEL para a seção, em vez de silenciosa.
 * @param {object} character
 * @param {object} context
 * @returns {Readonly<object>}
 */
function projectWallet(character, context) {
  const normalized = normalizeWallet(character?.state?.wallet);
  const rates = resolveCurrencyRates(context, character);
  const total = rates.ok ? walletTotalInCopper(normalized, rates.value) : null;
  return Object.freeze({
    ...pick(normalized, WALLET_DENOMINATIONS),
    totalCopper: total !== null && total.ok ? total.value : null,
    ratesAvailable: rates.ok,
  });
}

/**
 * Projeta um ataque para cada ARMA do inventário.
 *
 * ## Equipada ou não
 *
 * O oráculo desta migração (`sheet.js` ~15540-15600) calcula Atq/Dano para
 * TODO item de tipo arma do inventário, equipado ou não — a primeira versão
 * desta função filtrava por `equipped`, o que fazia sumir da ficha o ataque de
 * uma arma guardada na mochila (achado Important 3 da revisão). A paridade foi
 * restaurada: toda arma vira uma entrada, e `equipped` viaja no projeção para
 * a seção decidir como apresentá-las.
 *
 * ## A composição
 *
 *   - habilidade: `finesse` usa o MAIOR entre Força e Destreza; arma à
 *     distância usa Destreza; o resto usa Força;
 *   - `attackBonus` = modificador + bônus de proficiência (só quando a
 *     proficiência é CONHECIDA e verdadeira) + efeitos no alvo `attack`;
 *   - `damageBonus` = modificador + efeitos no alvo `damage`;
 *   - `damageDice`/`damageType`/`rangeCategory`/`properties` vêm do catálogo,
 *     nunca de regex sobre a descrição.
 *
 * `proficient: null` significa proficiência DESCONHECIDA (ver
 * `resolveWeaponProficiencies`): nesse caso o bônus de proficiência não é
 * somado — ausência é tratada como ausência, jamais como "provavelmente sim".
 * @param {object} character
 * @param {object} context
 * @param {{inventory: object|null, abilities: object, proficiencyBonus: number}} params
 * @returns {import('../../core/result.js').Result}
 */
function projectAttacks(character, context, { inventory, abilities, proficiencyBonus }) {
  if (inventory === null || !context.registry) {
    return ok([]);
  }

  const efeitos = collectCharacterEffects(character, context);
  if (!efeitos.ok) {
    return efeitos;
  }

  const ataques = [];
  for (const item of inventory.items) {
    const itemId = typeof item.itemRef === 'string' ? item.itemRef : (item.itemRef?.id ?? null);
    const entity = itemId === null ? null : context.registry.get(itemId);
    const damageDice = entity?.damage?.dice ?? null;
    if (entity === null || entity === undefined || damageDice === null) {
      // Não é arma (ou é item customizado sem mecânica declarada): não vira
      // ataque. Um item sem dado de dano não tem ataque a projetar.
      continue;
    }

    const properties = Array.isArray(entity.properties) ? [...entity.properties] : [];
    const rangeCategory = typeof entity.rangeCategory === 'string' ? entity.rangeCategory : null;
    let abilityKey;
    if (properties.includes('finesse')) {
      abilityKey = abilities.forca.modifier >= abilities.destreza.modifier ? 'forca' : 'destreza';
    } else if (rangeCategory === 'ranged') {
      abilityKey = 'destreza';
    } else {
      abilityKey = 'forca';
    }
    const modifier = abilities[abilityKey].modifier;

    const ataqueBase = modifier + (item.proficient === true ? proficiencyBonus : 0);
    const ataqueResolvido = resolveNumericTarget({ target: 'attack', baseValue: ataqueBase, effects: efeitos.value, context });
    if (!ataqueResolvido.ok) {
      return ataqueResolvido;
    }
    const danoResolvido = resolveNumericTarget({ target: 'damage', baseValue: modifier, effects: efeitos.value, context });
    if (!danoResolvido.ok) {
      return danoResolvido;
    }

    ataques.push({
      instanceId: item.instanceId,
      itemId,
      name: item.name,
      equipped: item.equipped === true,
      abilityKey,
      proficient: item.proficient,
      attackBonus: ataqueResolvido.value,
      damageDice,
      damageBonus: danoResolvido.value,
      damageType: entity?.damage?.type ?? null,
      rangeCategory,
      properties,
    });
  }
  return ok(ataques);
}

/**
 * Projeta o estado dos handlers de CLASSE (Task 30).
 *
 * Delega inteiramente a `domain/commands/class-actions.js#projectClassHandlers`,
 * que por sua vez chama `handler.project()` pela porta autorizada. Nenhuma
 * mecânica de classe é recalculada aqui: recursos (com o `{current: null,
 * missing: true}` de recurso não materializado), flags e a disponibilidade de
 * cada ação vêm prontos do handler, que é a MESMA condição que `execute`
 * aplica — por isso a ficha nunca oferece um botão que o comando recusaria.
 *
 * ## Ausência é DECLARADA, e não derruba a ficha
 *
 * Sem a porta (`context.officialHandlerInvoker`), sem catálogo, ou quando um
 * handler falha ao projetar, o resultado é `{available: false,
 * unavailableReason: <código>, handlers: []}` — e a seção RENDERIZA esse
 * motivo. Não é o bypass silencioso: o jogador vê por que a lista de ações não
 * pôde ser montada, em vez de uma seção vazia que pareceria "sua classe não
 * tem nada".
 *
 * Diferentemente das demais consultas desta função, uma falha aqui NÃO aborta
 * o ViewModel inteiro: impressão, PDF e as outras seis seções não dependem das
 * ações de classe, e deixar a ficha inteira sem abrir por causa delas seria
 * desproporcional.
 * @param {object} character
 * @param {object} context
 * @returns {object}
 */
function projectClassActions(character, context) {
  const projected = projectClassHandlers(character, context);
  if (!projected.ok) {
    return {
      available: false,
      unavailableReason: projected.error?.code ?? 'CLASS_ACTIONS_UNAVAILABLE',
      handlers: [],
    };
  }
  return { available: true, unavailableReason: null, handlers: projected.value };
}

/**
 * Projeta o que o PRÓXIMO nível exige e concede (Task 30).
 *
 * Delega inteiramente a `getLevelUpOptions` (Task 23) — nenhuma tabela de
 * progressão, nenhum dado de vida e nenhum nível de subclasse são recalculados
 * aqui.
 *
 * Como em `projectClassActions`, a ausência é DECLARADA e não derruba a ficha:
 * personagem no nível 20 (`LEVEL_UP_AT_MAXIMUM`) e catálogo ausente
 * (`LEVEL_UP_REGISTRY_REQUIRED`) são respostas legítimas que a vista de
 * level-up mostra como motivo, em vez de um conjunto de cartões vazio.
 * @param {object} character
 * @param {object} context
 * @returns {object}
 */
function projectNextLevel(character, context) {
  const projected = getLevelUpOptions(character, context);
  if (!projected.ok) {
    return { available: false, unavailableReason: projected.error?.code ?? 'LEVEL_UP_UNAVAILABLE', options: null };
  }
  return { available: true, unavailableReason: null, options: projected.value };
}

/**
 * Monta os DADOS IMPRIMÍVEIS: o cabeçalho e as caixas de estatística que
 * impressão e PDF emitem.
 *
 * Não recalcula NADA — só recorta e nomeia o que já está em `derived`, mais os
 * nomes de exibição resolvidos do catálogo (que são, esses sim, uma derivação:
 * uma referência de conteúdo vira um nome). É por isso que isto mora aqui e
 * não em `data`: a Task 33 precisa de uma lista fechada do que é seguro
 * imprimir, e não de permissão para caçar campos crus.
 * @param {object} character
 * @param {object} context
 * @param {object} derived
 * @returns {object}
 */
function projectPrintable(character, context, derived) {
  /**
   * @param {*} reference - referência de conteúdo.
   * @returns {string|null}
   */
  const nomeDe = (reference) => resolveDisplayName(reference, context);

  return {
    headline: {
      name: character.identity?.name ?? '',
      level: character.state?.level ?? null,
      className: nomeDe(character.build?.classRef),
      subclassName: nomeDe(character.build?.subclassRef),
      speciesName: nomeDe(character.build?.speciesRef),
      backgroundName: nomeDe(character.build?.backgroundRef),
      alignment: character.identity?.alignment ?? '',
    },
    statBoxes: {
      armorClass: derived.armorClass,
      initiative: derived.initiative,
      speed: derived.movement.effective,
      hitPointsCurrent: derived.hitPoints.current,
      hitPointsMaximum: derived.hitPoints.maximum,
      hitPointsTemporary: derived.hitPoints.temporary,
      proficiencyBonus: derived.proficiencyBonus,
      spellSaveDC: derived.defenses.spellSaveDC,
      spellAttackBonus: derived.defenses.spellAttackBonus,
      passivePerception: derived.senses.passivePerception,
    },
  };
}

/**
 * Nome de exibição de uma referência de conteúdo, resolvido no catálogo.
 *
 * É o MECANISMO ÚNICO de "ContentId -> nome" desta camada: `printable`
 * (cabeçalho impresso) e `defenses.*Labels` usam exatamente esta função. Um id
 * que o catálogo não conhece — ou um catálogo ausente — devolve `null`; quem
 * chama decide o que fazer com a ausência, e nenhum nome é inventado aqui.
 * @param {*} reference - ContentId (string) ou `{id}`.
 * @param {object} context - contexto de consulta (`registry`).
 * @returns {string|null}
 */
function resolveDisplayName(reference, context) {
  const id = typeof reference === 'string' ? reference : (reference?.id ?? null);
  if (id === null || !context?.registry || typeof context.registry.get !== 'function') {
    return null;
  }
  const entity = context.registry.get(id);
  return typeof entity?.name === 'string' ? entity.name : null;
}

/**
 * Acrescenta a `defenses` os RÓTULOS das três listas de defesa.
 *
 * ## Por que o rótulo viaja ao lado do id, e não no lugar dele
 *
 * O id é o que a mecânica compara (`build.legacyGrants.resistanceIds`); o
 * rótulo é o que o jogador lê. Substituir um pelo outro faria a tela e o
 * domínio falarem línguas diferentes sobre o MESMO dado, e é assim que se
 * volta a comparar regra por nome traduzido — exatamente o que as Tasks 26/27
 * removeram do criador.
 *
 * ## Ausência: o id é preservado, e isso é deliberado
 *
 * Um id que o catálogo não resolve (pacote de terceiro, entrada removida)
 * mantém o PRÓPRIO id como rótulo. É feio, mas é a única alternativa que não
 * perde informação: um `—` esconderia do jogador que ele TEM aquela
 * resistência, e um rótulo inventado afirmaria um tipo de dano que ninguém
 * declarou.
 * @param {object} defenses - recorte de `getDefenses` (DEFENSE_KEYS).
 * @param {object} context - contexto de consulta (`registry`).
 * @returns {object} o mesmo objeto, com as três chaves de rótulo acrescentadas.
 */
function withDefenseLabels(defenses, context) {
  for (const [idsKey, labelsKey] of Object.entries(DEFENSE_LABEL_KEYS)) {
    const ids = Array.isArray(defenses[idsKey]) ? defenses[idsKey] : [];
    defenses[labelsKey] = Object.freeze(ids.map((id) => resolveDisplayName(id, context) ?? String(id)));
  }
  return defenses;
}

/**
 * Copia de `source` exatamente as chaves de `keys` (ausentes viram `null`,
 * nunca um valor plausível inventado).
 * @param {object} source
 * @param {ReadonlyArray<string>} keys
 * @returns {object}
 */
function pick(source, keys) {
  /** @type {Record<string, *>} */
  const target = {};
  for (const key of keys) {
    target[key] = source?.[key] ?? null;
  }
  return target;
}
