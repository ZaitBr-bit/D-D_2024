// Módulo `domain/character/queries/combat`: consultas puras de Classe de
// Armadura e Iniciativa. Extraído de `site/js/utils.js#calcCA` e
// `site/js/pages/sheet.js#getModIniciativa` — a mesma fórmula chamada de
// forma idêntica em screen/print/PDF (ver `tests/fixtures/expected/derived-values.json`,
// casos "ca-convergente"/"iniciativa-convergente").
//
// Regras de classe/subclasse (Defesa sem Armadura do Bárbaro/Monge, CA sem
// armadura do Colégio da Dança/Feitiçaria Dracônica) são decididas por ID
// ESTÁVEL do ruleset (`build.classRef.id`/`build.subclassRef.id`), nunca
// pelo nome de exibição em português (`personagem.classe === "Bárbaro"` do
// código legado) — ver `internal/shared.js#refSlug`.
//
// Talentos que ainda não são efeitos declarativos do motor da Task 15
// (Mestre em Armaduras Médias, bônus genérico de CA, Alerta) entram via
// `context.talentPassives` (fix round 1, C2) — ver `internal/shared.js#readTalentPassives`.

import { ok, err } from '../../../core/result.js';
import { getAbilityModifier } from './abilities.js';
import {
  requireCharacterShape,
  refSlug,
  collectEffectsOptional,
  applyNumericEffects,
  readTalentPassives,
  queryError,
} from './internal/shared.js';

// Slugs estáveis (ContentId) usados pelas regras de Defesa sem Armadura.
const BARBARIAN_CLASS_SLUG = 'barbaro';
const MONK_CLASS_SLUG = 'monge';
const BARD_CLASS_SLUG = 'bardo';
const BARD_DANCE_SUBCLASS_SLUG = 'colegio-da-danca';
const SORCERER_CLASS_SLUG = 'feiticeiro';
const DRACONIC_SORCERY_SUBCLASS_SLUG = 'feiticaria-draconica';
const SUBCLASS_UNARMORED_MIN_LEVEL = 3;

const SHIELD_BONUS = 2;
const MEDIUM_ARMOR_DEFAULT_MAX_DEX = 2;

/**
 * Diz se uma entrada de inventário está equipada e é a peça de armadura
 * corporal (nunca o escudo, que é um slot separado). Lê `customDefinition`
 * — o item bruto preservado pelo codec (Task 12) — porque itens legados
 * quase nunca resolvem a um `itemRef` de catálogo.
 * @param {object} entry - inventoryEntry (Task 12).
 * @returns {boolean}
 */
function isEquippedBodyArmor(entry) {
  const def = entry?.customDefinition;
  return entry?.equipped === true && def?.tipo === 'armadura' && def?.nome !== 'Escudo';
}

/**
 * Diz se uma entrada de inventário está equipada e é um escudo.
 * @param {object} entry - inventoryEntry (Task 12).
 * @returns {boolean}
 */
function isEquippedShield(entry) {
  const def = entry?.customDefinition;
  return entry?.equipped === true && (def?.nome === 'Escudo' || def?.tipo === 'escudo');
}

/**
 * Resolve o valor NUMÉRICO base de `customDefinition.dados.ca`, aceitando
 * tanto um número (item vindo de JSON estruturado — ex.: `{ca: 16}`) quanto
 * uma string com um inteiro no início (formato livre legado — ex.:
 * `"16"`/`"14 + modificador de Des (máx. 2)"`), igual ao legado
 * `parseInt(armadura.dados?.ca || '')`. `undefined`/`null`/string vazia ou
 * sem dígito inicial (item sem esse campo preenchido, ou com um texto livre
 * tipo "Varia" — fix round 2, achado NEW-2: `""` NÃO é mais erro, é tratado
 * como "sem base numérica conhecida") devolvem `0`, mesmo default do
 * legado. Só um valor de tipo fundamentalmente incompatível (booleano,
 * objeto, array, `NaN`) é ERRO EXPLÍCITO: conteúdo vindo de JSON é não
 * confiável, e silenciosamente zerar uma CA por causa de um TIPO inesperado
 * produziria um valor de jogo errado sem aviso (fix round 1, achado C3) —
 * mas um campo simplesmente não preenchido não é dado corrompido.
 * @param {*} caValue
 * @returns {{ok: true, value: number} | {ok: false}}
 */
function coerceArmorBaseAC(caValue) {
  if (caValue === undefined || caValue === null) {
    return { ok: true, value: 0 };
  }
  if (typeof caValue === 'number' && Number.isFinite(caValue)) {
    return { ok: true, value: Math.trunc(caValue) };
  }
  if (typeof caValue === 'string') {
    const match = caValue.match(/^\s*([+-]?\d+)/);
    return { ok: true, value: match ? Number.parseInt(match[1], 10) : 0 };
  }
  return { ok: false };
}

/**
 * Calcula a CA fornecida por uma peça de armadura equipada a partir dos
 * campos legados preservados em `customDefinition.dados` (`ca`, `categoria`)
 * — mesma leitura de `site/js/utils.js#calcCA`, só que sobre o personagem
 * canônico em vez do registro plano.
 * @param {object} armorEntry - inventoryEntry (Task 12), já confirmado como armadura equipada.
 * @param {number} modDex
 * @param {number | null} mediumArmorMaxDexOverride - talento (Mestre em Armaduras Médias); `null` usa o padrão (+2).
 * @returns {import('../../../core/result.js').Result} Result<number, AppError>
 */
function armorClassFromEquippedArmor(armorEntry, modDex, mediumArmorMaxDexOverride) {
  const dados = armorEntry.customDefinition?.dados ?? {};
  const coerced = coerceArmorBaseAC(dados.ca);
  if (!coerced.ok) {
    return err(
      queryError(
        'CHARACTER_QUERY_ARMOR_CA_INVALID',
        `O campo "dados.ca" da armadura equipada ("${armorEntry.customDefinition?.nome ?? '?'}") não é um número nem uma string coercível para número.`,
        { nome: armorEntry.customDefinition?.nome ?? null, ca: typeof dados.ca === 'object' ? null : (dados.ca ?? null) },
      ),
    );
  }
  const caBase = coerced.value;
  const caText = dados.ca === undefined || dados.ca === null ? '' : String(dados.ca);
  const mediumArmorMaxDex = mediumArmorMaxDexOverride ?? MEDIUM_ARMOR_DEFAULT_MAX_DEX;

  if (dados.categoria === 'Leve') {
    return ok(caBase + modDex);
  }
  if (dados.categoria === 'Média') {
    return ok(caBase + Math.min(modDex, mediumArmorMaxDex));
  }
  if (dados.categoria === 'Pesada') {
    return ok(caBase);
  }
  // Formato livre ("XX + modificador de Des", "XX (máx. 2)") de itens
  // customizados sem categoria estruturada — mesmo fallback do legado.
  const match = caText.match(/^(\d+)/);
  if (!match) {
    // fix round 2, achado NEW-2: armadura equipada SEM categoria
    // reconhecida E sem número inicial reconhecível (`dados.ca` ausente,
    // vazio, ou um texto livre tipo "Varia") não tem base de CA conhecida —
    // cai para a CA desarmada (10 + mod Des), nunca para `caBase` (que
    // seria 0 aqui, zerando a CA em silêncio). Replica o comportamento do
    // legado: nesse ramo, o código antigo simplesmente NÃO reatribuía `ca`,
    // deixando o valor inicial "10 + mod Des" intacto.
    return ok(10 + modDex);
  }
  if (/m[aá]x\.?\s*2/i.test(caText)) {
    return ok(caBase + Math.min(modDex, 2));
  }
  if (/Des/.test(caText)) {
    return ok(caBase + modDex);
  }
  return ok(caBase);
}

/**
 * Consulta a Classe de Armadura do personagem.
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {object} [context] - `{registry?, level?, choices?, equippedItemIds?, stateFlags?, talentPassives?}`.
 * @returns {import('../../../core/result.js').Result} Result<number, AppError>
 */
export function getArmorClass(character, context = {}) {
  const shape = requireCharacterShape(character);
  if (!shape.ok) {
    return shape;
  }

  const modDexResult = getAbilityModifier(character, 'destreza', context);
  const modConResult = getAbilityModifier(character, 'constituicao', context);
  const modSabResult = getAbilityModifier(character, 'sabedoria', context);
  const modCarResult = getAbilityModifier(character, 'carisma', context);
  for (const result of [modDexResult, modConResult, modSabResult, modCarResult]) {
    if (!result.ok) {
      return result;
    }
  }
  const modDex = modDexResult.value;
  const modCon = modConResult.value;
  const modSab = modSabResult.value;
  const modCar = modCarResult.value;

  const inventory = Array.isArray(character.state.inventory) ? character.state.inventory : [];
  const armorEntry = inventory.find(isEquippedBodyArmor) ?? null;
  const shieldEntry = inventory.find(isEquippedShield) ?? null;

  const level = Number.isInteger(character.state.level) ? character.state.level : 1;
  const classSlug = refSlug(character.build?.classRef);
  const subclassSlug = refSlug(character.build?.subclassRef);
  const talentPassives = readTalentPassives(context);

  let ca = 10 + modDex;
  if (classSlug === BARBARIAN_CLASS_SLUG && armorEntry === null) {
    ca = 10 + modDex + modCon;
  }
  if (classSlug === MONK_CLASS_SLUG && armorEntry === null) {
    ca = 10 + modDex + modSab;
  }
  if (
    classSlug === BARD_CLASS_SLUG &&
    subclassSlug === BARD_DANCE_SUBCLASS_SLUG &&
    level >= SUBCLASS_UNARMORED_MIN_LEVEL &&
    armorEntry === null &&
    shieldEntry === null
  ) {
    ca = 10 + modDex + modCar;
  }
  if (
    classSlug === SORCERER_CLASS_SLUG &&
    subclassSlug === DRACONIC_SORCERY_SUBCLASS_SLUG &&
    level >= SUBCLASS_UNARMORED_MIN_LEVEL &&
    armorEntry === null
  ) {
    ca = 10 + modDex + modCar;
  }

  if (armorEntry !== null) {
    const armorResult = armorClassFromEquippedArmor(armorEntry, modDex, talentPassives.mediumArmorMaxDexBonus);
    if (!armorResult.ok) {
      return armorResult;
    }
    ca = armorResult.value;
  }
  if (shieldEntry !== null) {
    ca += SHIELD_BONUS;
  }

  // Estilo de Luta: Defensivo (+1 CA enquanto usa armadura).
  const estiloLuta = character.build?.choices?.['classe:estilo_luta'];
  if (Array.isArray(estiloLuta) && estiloLuta.includes('Defensivo') && armorEntry !== null) {
    ca += 1;
  }

  // Bônus de CA de itens equipados customizados (`dados.bonus_ca`).
  for (const entry of inventory) {
    if (entry?.equipped !== true) {
      continue;
    }
    const bonusCa = entry.customDefinition?.dados?.bonus_ca;
    if (bonusCa !== undefined) {
      ca += Number.parseInt(bonusCa, 10) || 0;
    }
  }

  // Bônus genérico de CA de talentos (ex.: itens/dádivas com bônus fixo).
  ca += talentPassives.armorClassBonus;

  const effectsResult = collectEffectsOptional(character, context);
  if (!effectsResult.ok) {
    return effectsResult;
  }
  return applyNumericEffects({ target: 'ac', baseValue: ca, effects: effectsResult.value, context });
}

/**
 * Consulta a Iniciativa do personagem (modificador de Destreza + bônus de
 * talento — ex.: Alerta, via `context.talentPassives.initiativeBonus` —
 * com efeitos declarativos de alvo `initiative` aplicados por cima).
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {object} [context]
 * @returns {import('../../../core/result.js').Result} Result<number, AppError>
 */
export function getInitiative(character, context = {}) {
  const shape = requireCharacterShape(character);
  if (!shape.ok) {
    return shape;
  }
  const modDexResult = getAbilityModifier(character, 'destreza', context);
  if (!modDexResult.ok) {
    return modDexResult;
  }
  const talentPassives = readTalentPassives(context);
  const effectsResult = collectEffectsOptional(character, context);
  if (!effectsResult.ok) {
    return effectsResult;
  }
  return applyNumericEffects({
    target: 'initiative',
    baseValue: modDexResult.value + talentPassives.initiativeBonus,
    effects: effectsResult.value,
    context,
  });
}
