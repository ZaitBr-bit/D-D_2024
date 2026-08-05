// Módulo `domain/spells/spellcasting-queries`: consultas PURAS de conjuração
// (Task 18). Projeta, a partir do personagem canônico v2 (Task 12) e do
// catálogo de conteúdo (`context.registry`), tudo o que o criador/ficha/
// level-up hoje recalculam por conta própria a partir de nomes em português
// e de tabelas em prosa:
//
//   - habilidade de conjuração, CD de magia e bônus de ataque de magia
//     (DELEGADOS a `domain/character/queries/defenses.js#getDefenses`, Task 16
//     — nunca recalculados aqui);
//   - espaços de magia por círculo (`state.spells.slots`) e o pool SEPARADO
//     de Magia de Pacto (`state.spells.pactSlots`);
//   - as magias do personagem (conhecidas/preparadas/grimório) já resolvidas
//     contra o catálogo: círculo, escola, ritual, concentração e listas de
//     classe — por ID, nunca por nome de exibição;
//   - proveniência (`sourceInstanceId`), que é o que distingue duas
//     instâncias independentes de "Iniciado em Magia" e o que permite
//     detectar duplicidade DENTRO de uma mesma fonte sem confundi-la com a
//     mesma magia legitimamente concedida por duas fontes diferentes.
//
// ## Dependências explícitas (nunca degradação silenciosa)
//
// `context.registry` é OBRIGATÓRIO: sem catálogo não há círculo, escola,
// ritual nem concentração de magia nenhuma, e devolver uma projeção "quase
// certa" (tudo `null`) mascararia o problema — a consulta falha com
// `SPELLCASTING_REGISTRY_REQUIRED`. Este é o oposto do que
// `queries/internal/shared.js#collectEffectsOptional` faz para efeitos
// (onde a ausência de catálogo ainda permite aplicar `character.overrides`);
// aqui não existe nada de útil a computar sem catálogo.
//
// Os MÁXIMOS de espaços de magia, o limite de magias preparadas e o número
// de truques NÃO estão no catálogo: a entidade `class` do pacote `dnd2024`
// (dados/schemas/v1/class.schema.json) só declara `spellcasting.ability` e
// `spellcasting.progression` — a tabela de progressão por nível continua
// vindo de `classeData.tabela_caracteristicas` (o DB legado, lido por
// `site/js/utils.js#getEspacosMagia`/`#getTruquesConhecidos`/
// `#getMagiaPreparadas`). Por isso esses números entram por
// `context.spellcasting`, exatamente como `context.talentPassives` na Task 16:
// o domínio recebe os NÚMEROS já resolvidos e nunca reimplementa a leitura da
// tabela. Um número ausente vira `null` ("desconhecido") e NUNCA `0` — zero
// significaria "não tem espaço", uma afirmação de jogo que este módulo não
// tem base para fazer.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { getDefenses } from '../character/queries/index.js';

export const SPELLS_SCOPE = 'domain.spells';

// Coleções de magia do personagem canônico (mesma lista de
// `domain/character/model.js#SPELL_COLLECTION_FIELDS`, repetida aqui como
// ORDEM de projeção; a fonte da verdade estrutural continua sendo o model).
export const SPELL_COLLECTIONS = Object.freeze(['known', 'prepared', 'spellbook']);

// Círculos possíveis de espaço de magia (`state.spells.slots` usa chaves
// "1".."9", ver dados/schemas/v1/character-canonical-v2.schema.json).
export const MIN_SLOT_LEVEL = 1;
export const MAX_SLOT_LEVEL = 9;

/**
 * Cria um AppError padronizado do escopo de magias.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {Readonly<object>}
 */
export function spellError(code, message, context = {}) {
  return createAppError({ code, scope: SPELLS_SCOPE, message, context });
}

/**
 * Confere a forma mínima de um CanonicalCharacter (identity/build/state como
 * objetos), o mesmo mínimo exigido por
 * `domain/character/queries/internal/shared.js#requireCharacterShape` e por
 * `domain/commands/command-dispatcher.js#hasCharacterShape`. É reimplementado
 * aqui (em vez de importado) porque aquele módulo é declaradamente INTERNO às
 * consultas de personagem; os demais arquivos de `domain/spells/**` importam
 * esta função daqui, então a checagem continua existindo em um único lugar
 * dentro desta pasta.
 * @param {*} character
 * @returns {import('../../core/result.js').Result} Result<true, AppError>
 */
export function requireSpellCharacterShape(character) {
  if (
    character === null ||
    typeof character !== 'object' ||
    character.identity === null ||
    typeof character.identity !== 'object' ||
    character.build === null ||
    typeof character.build !== 'object' ||
    character.state === null ||
    typeof character.state !== 'object'
  ) {
    return err(
      spellError(
        'SPELLCASTING_CHARACTER_INVALID',
        'A consulta/comando de magia exige um CanonicalCharacter com identity/build/state.',
        {},
      ),
    );
  }
  return ok(true);
}

/**
 * Exige `context.registry` com os métodos usados por este domínio (`get`).
 * Falha EXPLÍCITA quando ausente — nunca devolve uma projeção degradada.
 * @param {object} context
 * @param {string} [code] - código do AppError (varia por operação).
 * @returns {import('../../core/result.js').Result} Result<object, AppError>
 */
export function requireRegistry(context, code = 'SPELLCASTING_REGISTRY_REQUIRED') {
  const registry = context?.registry;
  if (registry === null || registry === undefined || typeof registry.get !== 'function') {
    return err(
      spellError(
        code,
        'As regras de magia exigem "context.registry" (catálogo de conteúdo) para resolver círculo/escola/ritual/concentração das magias.',
        {},
      ),
    );
  }
  return ok(registry);
}

/**
 * Lê um inteiro >= 0 de um canal de contexto, devolvendo `null` (desconhecido)
 * para qualquer coisa que não seja um inteiro não negativo. NUNCA converte
 * ausência em `0`.
 * @param {*} value
 * @returns {number | null}
 */
function optionalCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Normaliza o canal `context.spellcasting` (ver comentário do módulo): os
 * números da tabela de progressão da classe, já resolvidos pelo chamador a
 * partir de `site/js/utils.js#getEspacosMagia`/`#getTruquesConhecidos`/
 * `#getMagiaPreparadas`. Tudo é opcional e ausência vira `null`, nunca `0`.
 * @param {object} [context]
 * @returns {Readonly<{slotMaximums: Readonly<object>, pactSlots: Readonly<{maximum: number|null, level: number|null}>, cantripsKnown: number|null, preparedLimit: number|null}>}
 */
export function readSpellcastingTable(context = {}) {
  const table = context?.spellcasting;
  const rawSlots = table?.slotMaximums;
  const slotMaximums = {};
  if (rawSlots !== null && typeof rawSlots === 'object' && !Array.isArray(rawSlots)) {
    for (let level = MIN_SLOT_LEVEL; level <= MAX_SLOT_LEVEL; level += 1) {
      const key = String(level);
      if (!Object.hasOwn(rawSlots, key)) {
        continue;
      }
      const maximum = optionalCount(rawSlots[key]);
      if (maximum !== null) {
        slotMaximums[key] = maximum;
      }
    }
  }
  return Object.freeze({
    slotMaximums: Object.freeze(slotMaximums),
    pactSlots: Object.freeze({
      maximum: optionalCount(table?.pactSlots?.maximum),
      level: optionalCount(table?.pactSlots?.level),
    }),
    cantripsKnown: optionalCount(table?.cantripsKnown),
    preparedLimit: optionalCount(table?.preparedLimit),
  });
}

/**
 * Lê `state.spells` de forma tolerante à ausência dos ramos opcionais, sem
 * inventar conteúdo de jogo (listas ausentes viram vazio; `used`/`extra`
 * não inteiros viram `null`, sinalizando estado inválido em vez de `0`).
 * @param {object} character
 * @returns {{known: Array, prepared: Array, spellbook: Array, slots: object, pactSlotsUsed: number|null, concentration: string|null, freeKnownSlots: number|null}}
 */
export function readSpellState(character) {
  const spells = character?.state?.spells ?? {};
  const list = (field) => (Array.isArray(spells[field]) ? spells[field] : []);
  const slots = spells.slots !== null && typeof spells.slots === 'object' && !Array.isArray(spells.slots) ? spells.slots : {};
  return {
    known: list('known'),
    prepared: list('prepared'),
    spellbook: list('spellbook'),
    slots,
    pactSlotsUsed: Number.isInteger(spells?.pactSlots?.used) ? spells.pactSlots.used : null,
    concentration: typeof spells.concentration === 'string' ? spells.concentration : null,
    freeKnownSlots: optionalCount(spells.freeKnownSlots),
  };
}

/**
 * Extrai o ContentId de magia de uma entrada de `state.spells.*`. Entradas
 * com `customDefinition` e sem `spellRef` (magia customizada do jogador, que
 * não existe no catálogo) devolvem `null` — não são erro, são explicitamente
 * não modeladas mecanicamente.
 * @param {object} entry
 * @returns {string | null}
 */
export function spellIdOf(entry) {
  const id = entry?.spellRef?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Projeta UMA entrada de magia do personagem contra o catálogo. Campos
 * mecânicos vêm SEMPRE da entidade `spell` (dados/schemas/v1/spell.schema.json),
 * nunca de `customDefinition` (dado legado bruto, texto livre).
 * @param {object} entry - entrada de `state.spells.<collection>`.
 * @param {string} collection - 'known' | 'prepared' | 'spellbook'.
 * @param {object} registry
 * @returns {Readonly<object>}
 */
function projectSpellEntry(entry, collection, registry) {
  const spellId = spellIdOf(entry);
  const entity = spellId === null ? null : registry.get(spellId);
  const resolved = entity !== null && entity !== undefined && entity.type === 'spell';
  return Object.freeze({
    instanceId: typeof entry?.instanceId === 'string' ? entry.instanceId : null,
    collection,
    spellId,
    sourceInstanceId: typeof entry?.sourceInstanceId === 'string' ? entry.sourceInstanceId : null,
    // `resolved: false` marca a entrada como NÃO modelada mecanicamente
    // (magia customizada ou ID fora do catálogo ativo). Nenhum campo abaixo
    // é chutado nesse caso.
    resolved,
    level: resolved && Number.isInteger(entity.level) ? entity.level : null,
    school: resolved && typeof entity.school === 'string' ? entity.school : null,
    ritual: resolved ? entity.ritual === true : null,
    concentration: resolved ? entity.concentration === true : null,
    classIds: Object.freeze(resolved && Array.isArray(entity.classes) ? [...entity.classes] : []),
  });
}

/**
 * Projeta os espaços de magia por círculo, combinando o ESTADO
 * (`state.spells.slots[c] = {used, extra}` — fonte no canônico) com o MÁXIMO
 * da tabela da classe (`context.spellcasting.slotMaximums`, ver comentário do
 * módulo). O máximo efetivo replica a regra do baseline
 * (`site/js/pages/sheet.js:2740` — `total = baseTotal + extraTotal`).
 * @param {object} slotsState
 * @param {Readonly<object>} slotMaximums
 * @returns {ReadonlyArray<Readonly<object>>}
 */
function projectSlots(slotsState, slotMaximums) {
  const levels = new Set();
  for (const key of Object.keys(slotsState)) {
    levels.add(key);
  }
  for (const key of Object.keys(slotMaximums)) {
    levels.add(key);
  }
  const projected = [...levels]
    .map((key) => Number(key))
    .filter((level) => Number.isInteger(level) && level >= MIN_SLOT_LEVEL && level <= MAX_SLOT_LEVEL)
    .sort((a, b) => a - b)
    .map((level) => {
      const key = String(level);
      const entry = slotsState[key];
      const used = Number.isInteger(entry?.used) ? entry.used : 0;
      const extra = Number.isInteger(entry?.extra) ? entry.extra : 0;
      const base = Object.hasOwn(slotMaximums, key) ? slotMaximums[key] : null;
      const maximum = base === null ? null : base + extra;
      return Object.freeze({
        level,
        used,
        extra,
        maximum,
        available: maximum === null ? null : Math.max(0, maximum - used),
      });
    });
  return Object.freeze(projected);
}

/**
 * Agrupa as magias projetadas por `sourceInstanceId` e aponta duplicidade
 * DENTRO de uma mesma fonte (a mesma magia concedida duas vezes pela mesma
 * instância de talento é um defeito de dado; a mesma magia vinda de duas
 * instâncias diferentes de "Iniciado em Magia" é legítima e NÃO é duplicata).
 * @param {ReadonlyArray<object>} spells
 * @returns {{sources: ReadonlyArray<Readonly<object>>, duplicates: ReadonlyArray<Readonly<object>>}}
 */
function projectSources(spells) {
  /** @type {Map<string, {sourceInstanceId: string|null, spellIds: string[], collections: Set<string>}>} */
  const bySource = new Map();
  const duplicates = [];
  for (const spell of spells) {
    // A chave de agrupamento inclui a coleção: a mesma magia aparecendo em
    // `known` E em `prepared` pela mesma fonte é o formato NORMAL do baseline
    // (site/js/regras-cobertura.js empurra para as duas listas), não duplicata.
    const sourceKey = `${spell.sourceInstanceId ?? ''} ${spell.collection}`;
    let bucket = bySource.get(sourceKey);
    if (bucket === undefined) {
      bucket = { sourceInstanceId: spell.sourceInstanceId, collection: spell.collection, spellIds: [] };
      bySource.set(sourceKey, bucket);
    }
    if (spell.spellId !== null) {
      if (bucket.spellIds.includes(spell.spellId)) {
        duplicates.push(
          Object.freeze({
            spellId: spell.spellId,
            collection: spell.collection,
            sourceInstanceId: spell.sourceInstanceId,
          }),
        );
      } else {
        bucket.spellIds.push(spell.spellId);
      }
    }
  }
  const sources = [...bySource.values()].map((bucket) =>
    Object.freeze({
      sourceInstanceId: bucket.sourceInstanceId,
      collection: bucket.collection,
      spellIds: Object.freeze([...bucket.spellIds]),
    }),
  );
  return { sources: Object.freeze(sources), duplicates: Object.freeze(duplicates) };
}

/**
 * Consulta a projeção completa de conjuração do personagem.
 *
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {object} [context] - `{registry (obrigatório), spellcasting?, ...}`;
 *   o restante é repassado a `getDefenses` (Task 16), que resolve
 *   `saveDC`/`attackBonus`.
 * @returns {import('../../core/result.js').Result} Result<SpellcastingProjection, AppError>
 *   SpellcastingProjection: `{ability, saveDC, attackBonus, progression,
 *   slots, pactSlots, cantripsKnown, preparedLimit, freeKnownSlots,
 *   concentration, spells, sources, duplicates}`.
 */
export function getSpellcastingProjection(character, context = {}) {
  const shape = requireSpellCharacterShape(character);
  if (!shape.ok) {
    return shape;
  }
  const registryResult = requireRegistry(context);
  if (!registryResult.ok) {
    return registryResult;
  }
  const registry = registryResult.value;

  // CD/ataque de magia e a habilidade de conjuração vêm da consulta da
  // Task 16 — NÃO são recalculados aqui (o brief desta task é explícito).
  const defensesResult = getDefenses(character, context);
  if (!defensesResult.ok) {
    return defensesResult;
  }

  const classRef = character.build?.classRef;
  const classEntity = typeof classRef?.id === 'string' ? registry.get(classRef.id) : null;
  const spellcasting = classEntity?.spellcasting ?? null;
  const ability = typeof spellcasting?.ability === 'string' ? spellcasting.ability : null;
  const progression = typeof spellcasting?.progression === 'string' ? spellcasting.progression : null;

  const state = readSpellState(character);
  const table = readSpellcastingTable(context);

  const spells = [];
  for (const collection of SPELL_COLLECTIONS) {
    for (const entry of state[collection]) {
      spells.push(projectSpellEntry(entry, collection, registry));
    }
  }
  const frozenSpells = Object.freeze(spells);
  const { sources, duplicates } = projectSources(frozenSpells);

  const pactMaximum = table.pactSlots.maximum;
  const pactUsed = state.pactSlotsUsed;

  return ok(
    Object.freeze({
      ability,
      progression,
      saveDC: defensesResult.value.spellSaveDC,
      attackBonus: defensesResult.value.spellAttackBonus,
      slots: projectSlots(state.slots, table.slotMaximums),
      pactSlots: Object.freeze({
        used: pactUsed,
        maximum: pactMaximum,
        level: table.pactSlots.level,
        available: pactMaximum === null || pactUsed === null ? null : Math.max(0, pactMaximum - pactUsed),
      }),
      cantripsKnown: table.cantripsKnown,
      preparedLimit: table.preparedLimit,
      freeKnownSlots: state.freeKnownSlots,
      concentration: state.concentration,
      spells: frozenSpells,
      sources,
      duplicates,
    }),
  );
}
