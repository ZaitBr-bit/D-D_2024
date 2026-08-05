// Módulo `domain/spells/spell-selection`: validação PURA de uma seleção de
// magias (Task 18). É a regra que hoje está duplicada em três lugares do
// monólito — `site/js/pages/creator.js` (escolha inicial),
// `site/js/levelup-ui.js`/`site/js/levelup.js` (subida de nível) e
// `site/js/regras-cobertura.js` (talentos que concedem magia, ex.: Iniciado
// em Magia, Conjurador Ritualista) — cada uma comparando NOMES em português
// ("Mago", "Clérigo", "Iniciado em Magia") e recontando limites à mão.
//
// Aqui tudo é por ContentId e por campo mecânico do catálogo
// (dados/schemas/v1/spell.schema.json: `level`, `ritual`, `classes`;
// dados/schemas/v1/spell-list.schema.json: `spells`).
//
// ## Duplicidade POR FONTE, não global
//
// A mesma magia concedida por DUAS instâncias diferentes de "Iniciado em
// Magia" é legítima (o baseline mantém uma entrada por instância —
// `site/js/regras-cobertura.js#aplicarEfeitoTalento` só deduplica dentro da
// mesma lista/instância, e `site/js/levelup.js:1505` recusa repetir a MESMA
// lista). Por isso a checagem de duplicidade é sempre relativa ao
// `sourceInstanceId` da seleção, nunca ao personagem inteiro.
//
// ## O que NÃO é inferido
//
// - O limite (`limit`) e o círculo máximo (`maxSpellLevel`) vêm do chamador
//   ou da tabela de progressão em `context.spellcasting` (ver
//   `spellcasting-queries.js`); ausentes, a validação FALHA explicitamente em
//   vez de assumir um número plausível.
// - "Mago prepara a partir do grimório" é pedido explicitamente por
//   `selection.preparedFrom === 'spellbook'`. O catálogo não tem hoje nenhum
//   campo mecânico dizendo que uma classe prepara do grimório (a entidade
//   `class` só declara `spellcasting.ability`/`spellcasting.progression`), e
//   inferir isso do ID da classe seria voltar a decidir regra por identidade
//   de conteúdo dentro do domínio.

import { ok, err } from '../../core/result.js';
import {
  MAX_SLOT_LEVEL,
  MIN_SLOT_LEVEL,
  readSpellcastingTable,
  readSpellState,
  requireRegistry,
  requireSpellCharacterShape,
  spellError,
  spellIdOf,
  SPELL_COLLECTIONS,
} from './spellcasting-queries.js';

const COLLECTION_SET = new Set(SPELL_COLLECTIONS);

/**
 * Resolve o conjunto de IDs de magia permitidos por uma lista de
 * `spell-list` do catálogo. Uma lista informada que não resolve é ERRO (não
 * "lista vazia") — silenciar transformaria um ID errado em "nenhuma magia
 * permitida", que é indistinguível de uma lista legitimamente vazia.
 * @param {ReadonlyArray<string>} spellListIds
 * @param {object} registry
 * @returns {import('../../core/result.js').Result} Result<Set<string>, AppError>
 */
function resolveAllowedSpellIds(spellListIds, registry) {
  const allowed = new Set();
  for (const listId of spellListIds) {
    const entity = typeof listId === 'string' ? registry.get(listId) : null;
    if (entity === null || entity === undefined || entity.type !== 'spell-list' || !Array.isArray(entity.spells)) {
      return err(
        spellError('SPELL_SELECTION_UNKNOWN_SPELL_LIST', `A lista de magias "${String(listId)}" não existe no catálogo ativo.`, {
          spellListId: typeof listId === 'string' ? listId : null,
        }),
      );
    }
    for (const spellId of entity.spells) {
      if (typeof spellId === 'string') {
        allowed.add(spellId);
      }
    }
  }
  return ok(allowed);
}

/**
 * Deriva o círculo máximo selecionável a partir dos espaços de magia
 * conhecidos (`context.spellcasting.slotMaximums`): o maior círculo com
 * máximo > 0. Devolve `null` quando a tabela não foi informada — quem chama
 * decide se isso é erro.
 * @param {Readonly<object>} slotMaximums
 * @returns {number | null}
 */
function deriveMaxSpellLevel(slotMaximums) {
  let max = null;
  for (let level = MIN_SLOT_LEVEL; level <= MAX_SLOT_LEVEL; level += 1) {
    const key = String(level);
    if (Object.hasOwn(slotMaximums, key) && slotMaximums[key] > 0) {
      max = level;
    }
  }
  return max;
}

/**
 * Valida uma seleção de magias contra o personagem e o catálogo.
 *
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {{
 *   collection: 'known'|'prepared'|'spellbook',
 *   spellIds: ReadonlyArray<string>,
 *   sourceInstanceId?: string|null,
 *   spellListIds?: ReadonlyArray<string>,
 *   limit?: number,
 *   maxSpellLevel?: number,
 *   allowCantrips?: boolean,
 *   ritualOnly?: boolean,
 *   preparedFrom?: 'spellbook'|null,
 *   abilityId?: string,
 *   allowedAbilityIds?: ReadonlyArray<string>
 * }} selection
 * @param {object} [context] - `{registry (obrigatório), spellcasting?}`.
 * @returns {import('../../core/result.js').Result} Result<void, AppError>
 */
export function validateSpellSelection(character, selection, context = {}) {
  const shape = requireSpellCharacterShape(character);
  if (!shape.ok) {
    return shape;
  }
  if (selection === null || typeof selection !== 'object' || Array.isArray(selection)) {
    return err(spellError('SPELL_SELECTION_INVALID', 'A seleção deve ser um objeto.', {}));
  }
  const collection = selection.collection;
  if (!COLLECTION_SET.has(collection)) {
    return err(
      spellError('SPELL_SELECTION_COLLECTION_INVALID', '"collection" deve ser "known", "prepared" ou "spellbook".', {
        received: typeof collection === 'string' ? collection : null,
      }),
    );
  }
  const spellIds = selection.spellIds;
  if (!Array.isArray(spellIds) || spellIds.some((id) => typeof id !== 'string' || id.length === 0)) {
    return err(spellError('SPELL_SELECTION_SPELL_IDS_INVALID', '"spellIds" deve ser um array de ContentId não vazios.', {}));
  }
  const registryResult = requireRegistry(context, 'SPELL_SELECTION_REGISTRY_REQUIRED');
  if (!registryResult.ok) {
    return registryResult;
  }
  const registry = registryResult.value;

  const sourceInstanceId = typeof selection.sourceInstanceId === 'string' ? selection.sourceInstanceId : null;

  // --- Atributo de conjuração (Iniciado em Magia escolhe lista E atributo) --
  if (Array.isArray(selection.allowedAbilityIds) && selection.allowedAbilityIds.length > 0) {
    if (!selection.allowedAbilityIds.includes(selection.abilityId)) {
      return err(
        spellError('SPELL_SELECTION_ABILITY_NOT_ALLOWED', 'O atributo de conjuração escolhido não está entre os permitidos.', {
          abilityId: typeof selection.abilityId === 'string' ? selection.abilityId : null,
          allowedAbilityIds: [...selection.allowedAbilityIds],
        }),
      );
    }
  }

  // --- Lista permitida ------------------------------------------------
  // Ou a seleção declara listas explícitas (`spellListIds`, o caso de
  // Iniciado em Magia), ou a lista implícita é a da classe do personagem
  // (campo `classes` da entidade de magia). Sem nenhuma das duas não há como
  // validar pertencimento — falha explícita, nunca "passa tudo".
  const explicitLists = Array.isArray(selection.spellListIds) ? selection.spellListIds : null;
  let allowedSpellIds = null;
  let classId = null;
  if (explicitLists !== null && explicitLists.length > 0) {
    const allowedResult = resolveAllowedSpellIds(explicitLists, registry);
    if (!allowedResult.ok) {
      return allowedResult;
    }
    allowedSpellIds = allowedResult.value;
  } else {
    classId = typeof character.build?.classRef?.id === 'string' ? character.build.classRef.id : null;
    if (classId === null) {
      return err(
        spellError(
          'SPELL_SELECTION_LIST_UNKNOWN',
          'Sem "selection.spellListIds" e sem "build.classRef", não há lista de magias contra a qual validar a seleção.',
          {},
        ),
      );
    }
  }

  // --- Círculo máximo --------------------------------------------------
  const table = readSpellcastingTable(context);
  const maxSpellLevel = Number.isInteger(selection.maxSpellLevel)
    ? selection.maxSpellLevel
    : deriveMaxSpellLevel(table.slotMaximums);
  const allowCantrips = selection.allowCantrips !== false;

  // --- Estado atual da coleção, por fonte ------------------------------
  const state = readSpellState(character);
  const currentForSource = state[collection].filter(
    (entry) => (typeof entry?.sourceInstanceId === 'string' ? entry.sourceInstanceId : null) === sourceInstanceId,
  );
  const currentIdsForSource = new Set(currentForSource.map(spellIdOf).filter((id) => id !== null));
  const spellbookIds = new Set(state.spellbook.map(spellIdOf).filter((id) => id !== null));

  const seen = new Set();
  for (const spellId of spellIds) {
    if (seen.has(spellId)) {
      return err(
        spellError('SPELL_SELECTION_DUPLICATE_SPELL', `A magia "${spellId}" aparece mais de uma vez na mesma seleção.`, {
          spellId,
        }),
      );
    }
    seen.add(spellId);

    if (currentIdsForSource.has(spellId)) {
      return err(
        spellError(
          'SPELL_SELECTION_DUPLICATE_FOR_SOURCE',
          `A magia "${spellId}" já foi concedida por esta mesma fonte nesta coleção.`,
          { spellId, collection, sourceInstanceId },
        ),
      );
    }

    const entity = registry.get(spellId);
    if (entity === null || entity === undefined || entity.type !== 'spell') {
      return err(
        spellError('SPELL_SELECTION_UNKNOWN_SPELL', `A magia "${spellId}" não existe no catálogo ativo.`, { spellId }),
      );
    }

    if (!Number.isInteger(entity.level)) {
      return err(
        spellError('SPELL_SELECTION_SPELL_LEVEL_INVALID', `A magia "${spellId}" não declara um círculo inteiro.`, {
          spellId,
        }),
      );
    }
    if (entity.level === 0 && !allowCantrips) {
      return err(
        spellError('SPELL_SELECTION_CANTRIP_NOT_ALLOWED', `"${spellId}" é um truque e esta seleção não aceita truques.`, {
          spellId,
        }),
      );
    }
    if (entity.level > 0) {
      if (maxSpellLevel === null) {
        return err(
          spellError(
            'SPELL_SELECTION_MAX_LEVEL_UNKNOWN',
            'Não há como validar o círculo da magia: informe "selection.maxSpellLevel" ou "context.spellcasting.slotMaximums".',
            { spellId, level: entity.level },
          ),
        );
      }
      if (entity.level > maxSpellLevel) {
        return err(
          spellError(
            'SPELL_SELECTION_LEVEL_TOO_HIGH',
            `A magia "${spellId}" é de ${entity.level}º círculo, acima do máximo selecionável (${maxSpellLevel}º).`,
            { spellId, level: entity.level, maxSpellLevel },
          ),
        );
      }
    }

    if (selection.ritualOnly === true && entity.ritual !== true) {
      return err(
        spellError('SPELL_SELECTION_NOT_RITUAL', `A magia "${spellId}" não é ritual.`, { spellId }),
      );
    }

    const inList =
      allowedSpellIds !== null
        ? allowedSpellIds.has(spellId)
        : Array.isArray(entity.classes) && entity.classes.includes(classId);
    if (!inList) {
      return err(
        spellError('SPELL_SELECTION_NOT_IN_LIST', `A magia "${spellId}" não pertence à lista de magias permitida.`, {
          spellId,
          spellListIds: explicitLists === null ? null : [...explicitLists],
          classId,
        }),
      );
    }

    if (selection.preparedFrom === 'spellbook' && entity.level > 0 && !spellbookIds.has(spellId)) {
      return err(
        spellError(
          'SPELL_SELECTION_NOT_IN_SPELLBOOK',
          `A magia "${spellId}" precisa estar no grimório para ser preparada.`,
          { spellId },
        ),
      );
    }
  }

  // --- Limite ----------------------------------------------------------
  // `limit` explícito vence; para `prepared`, o padrão é o limite da tabela
  // da classe (`context.spellcasting.preparedLimit`). Ausente nos dois, não
  // há limite a conferir — e isso é declarado, não presumido: a seleção
  // passa, mas nenhum número foi inventado.
  const limit = Number.isInteger(selection.limit)
    ? selection.limit
    : collection === 'prepared'
      ? table.preparedLimit
      : null;
  if (limit !== null) {
    const total = currentIdsForSource.size + spellIds.length;
    if (total > limit) {
      return err(
        spellError(
          'SPELL_SELECTION_LIMIT_EXCEEDED',
          `A seleção resultaria em ${total} magia(s) em "${collection}", acima do limite de ${limit}.`,
          { collection, total, limit, sourceInstanceId },
        ),
      );
    }
  }

  return ok(undefined);
}
