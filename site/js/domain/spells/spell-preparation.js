// Módulo `domain/spells/spell-preparation`: comandos canônicos de PREPARAR/
// DESPREPARAR magia e de EDIÇÃO DE GRIMÓRIO (correção C1 da revisão final de
// branch). Fecha a lacuna declarada da Task 31
// (`SHEET_SPELL_SELECTION_NO_CANONICAL_COMMAND`): até aqui NENHUM comando do
// vocabulário fechado escrevia `state.spells.known/prepared/spellbook`, e o
// loop central de 4 das 12 classes (Clérigo/Druida/Paladino/Mago preparam
// magias após o descanso longo) não tinha caminho canônico.
//
// ## Nenhuma regra nova: a validação é `validateSpellSelection` (Task 18)
//
// Limite de preparadas (`context.spellcasting.preparedLimit`), círculo máximo
// (derivado de `context.spellcasting.slotMaximums`), pertencimento à lista da
// classe (campo `classes` da entidade de magia), duplicidade POR FONTE e a
// regra "Mago prepara a partir do grimório" (`preparedFrom: 'spellbook'`)
// JÁ EXISTEM em `spell-selection.js` — estes comandos as REUSAM, nunca as
// reimplementam. Um limite desconhecido não vira número inventado: a
// validação falha explicitamente (`SPELL_SELECTION_MAX_LEVEL_UNKNOWN` etc.).
//
// ## Oráculo do baseline (tests/helpers/legacy-sheet-source.js)
//
//   - preparar do grimório: linhas 13639-13662 (`data-preparar-grimorio`) —
//     recusa quando o limite de preparadas foi atingido;
//   - despreparar: linhas 13664-13674 — remove de `magias_preparadas` e
//     MANTÉM no grimório;
//   - remover do grimório: linhas 13676-13695 — remove do grimório E da lista
//     de preparadas ("A magia também deixará sua lista de magias preparadas").
//
// ## O que os comandos NÃO fazem
//
//   - Magias SEMPRE PREPARADAS (`grant-spell` com `alwaysPrepared: true`, cujo
//     `instanceId` termina no marcador `:prepared` do motor de efeitos — o
//     MESMO marcador que `character-codec.js` usa para emitir `origem:
//     'sempre'`) não são despreparáveis: o baseline as exclui do limite e não
//     as remove (`magiaContaNoLimite`). A recusa é NOMEADA
//     (`UNPREPARE_SPELL_ALWAYS_PREPARED`), nunca silenciosa.
//   - Nenhum comando cria versão de pacote do nada: o `spellRef` de uma
//     entrada nova copia a referência JÁ RESOLVIDA de outra coleção do próprio
//     personagem, ou deriva a versão de `build.contentScopes` (mesma regra de
//     `domain/effects/apply-grants.js#packageVersionFor`); sem nenhuma das
//     duas, o comando FALHA com erro nomeado em vez de gravar uma referência
//     malformada.

import { commandOk, commandErr } from '../commands/command-result.js';
import {
  readSpellState,
  requireSpellCharacterShape,
  spellError,
  spellIdOf,
  SPELL_COLLECTIONS,
} from './spellcasting-queries.js';
import { validateSpellSelection } from './spell-selection.js';

// Paths canônicos emitidos em `affected` por estes comandos (mapeados em
// `features/sheet/sheet-command-map.js`; um path órfão é falha de teste lá).
export const AFFECTED_PREPARED_SPELLS = 'state.spells.prepared';
export const AFFECTED_SPELLBOOK = 'state.spells.spellbook';

// Sufixo de `instanceId` que o motor de efeitos usa para a cópia "sempre
// preparada" de um `grant-spell` (`domain/effects/apply-grants.js`).
const ALWAYS_PREPARED_INSTANCE_SUFFIX = ':prepared';

/**
 * Normaliza o request comum destes comandos: `spellId` obrigatório e
 * `sourceInstanceId` PRESENTE (mesma disciplina de `cast-spell.js` — `null`
 * significa "fonte base/classe", e a ausência da chave nunca vira `null` por
 * acidente de digitação).
 * @param {*} request
 * @param {string} scopeCode - prefixo dos códigos de erro (ex.: 'PREPARE_SPELL').
 * @returns {{ok: true, value: {spellId: string, sourceInstanceId: string|null}} | {ok: false, error: object}}
 */
function normalizeSpellRequest(request, scopeCode) {
  if (request === null || typeof request !== 'object' || Array.isArray(request)) {
    return { ok: false, error: spellError(`${scopeCode}_REQUEST_INVALID`, 'O request deve ser um objeto.', {}) };
  }
  const { spellId, sourceInstanceId } = request;
  if (typeof spellId !== 'string' || spellId.length === 0) {
    return { ok: false, error: spellError(`${scopeCode}_SPELL_ID_INVALID`, '"spellId" deve ser um ContentId não vazio.', {}) };
  }
  if (!Object.hasOwn(request, 'sourceInstanceId')) {
    return {
      ok: false,
      error: spellError(
        `${scopeCode}_SOURCE_INVALID`,
        '"sourceInstanceId" é obrigatório no request (use `null` para a fonte base/classe).',
        { spellId },
      ),
    };
  }
  if (sourceInstanceId !== null && (typeof sourceInstanceId !== 'string' || sourceInstanceId.length === 0)) {
    return {
      ok: false,
      error: spellError(`${scopeCode}_SOURCE_INVALID`, '"sourceInstanceId" deve ser uma string não vazia ou `null`.', {
        spellId,
      }),
    };
  }
  return { ok: true, value: { spellId, sourceInstanceId } };
}

/**
 * Normaliza a fonte de uma entrada de `state.spells.*` para comparação:
 * qualquer coisa que não seja string vira `null` (fonte base/classe) — mesma
 * normalização de `cast-spell.js#findSpellEntry`.
 * @param {object} entry
 * @returns {string|null}
 */
function entrySourceOf(entry) {
  return typeof entry?.sourceInstanceId === 'string' ? entry.sourceInstanceId : null;
}

/**
 * Localiza, nas coleções do personagem, uma entrada JÁ EXISTENTE da magia —
 * preferindo a da mesma fonte — para copiar `spellRef` (referência já
 * resolvida, que sobrevive a migração de versão de pacote) e
 * `customDefinition` (a apresentação legada `{nome, circulo}`).
 * @param {object} character
 * @param {string} spellId
 * @param {string|null} sourceInstanceId
 * @param {ReadonlyArray<string>} collections - coleções onde procurar, em ordem de preferência.
 * @returns {object|null}
 */
function findTemplateEntry(character, spellId, sourceInstanceId, collections) {
  const state = readSpellState(character);
  let fallback = null;
  for (const collection of collections) {
    for (const entry of state[collection]) {
      if (spellIdOf(entry) !== spellId) {
        continue;
      }
      if (entrySourceOf(entry) === sourceInstanceId) {
        return entry;
      }
      if (fallback === null) {
        fallback = entry;
      }
    }
  }
  return fallback;
}

/**
 * Devolve a `packageVersion` ativa do namespace de `contentId` segundo
 * `build.contentScopes` — a MESMA regra de `apply-grants.js#packageVersionFor`.
 * `null` quando o namespace não está no escopo (nunca uma versão inventada).
 * @param {object} character
 * @param {string} contentId
 * @returns {string|null}
 */
function packageVersionFor(character, contentId) {
  const namespace = typeof contentId === 'string' && contentId.includes(':') ? contentId.split(':')[0] : null;
  const scopes = character?.build?.contentScopes;
  if (namespace === null || scopes === null || typeof scopes !== 'object' || !Object.hasOwn(scopes, namespace)) {
    return null;
  }
  const scope = scopes[namespace];
  return typeof scope?.packageVersion === 'string' ? scope.packageVersion : null;
}

/**
 * Constrói a entrada nova de `state.spells.<coleção>` para `spellId`,
 * copiando `spellRef`/`customDefinition` de uma entrada existente quando há
 * uma, ou derivando a versão de pacote de `build.contentScopes`. Falha
 * NOMEADA quando não há como resolver a versão — o comando nunca grava uma
 * referência sem `packageVersion`.
 * @param {object} character
 * @param {string} spellId
 * @param {string|null} sourceInstanceId
 * @param {string} collection - coleção de destino ('prepared'|'spellbook').
 * @param {string} scopeCode - prefixo dos códigos de erro.
 * @returns {{ok: true, value: object} | {ok: false, error: object}}
 */
function buildSpellEntry(character, spellId, sourceInstanceId, collection, scopeCode) {
  const template = findTemplateEntry(character, spellId, sourceInstanceId, SPELL_COLLECTIONS);
  let spellRef;
  if (template !== null && typeof template.spellRef?.packageVersion === 'string') {
    spellRef = Object.freeze({ id: spellId, packageVersion: template.spellRef.packageVersion });
  } else {
    const packageVersion = packageVersionFor(character, spellId);
    if (packageVersion === null) {
      return {
        ok: false,
        error: spellError(
          `${scopeCode}_PACKAGE_VERSION_UNKNOWN`,
          `Não há como resolver a versão de pacote de "${spellId}" (nem entrada existente, nem "build.contentScopes").`,
          { spellId },
        ),
      };
    }
    spellRef = Object.freeze({ id: spellId, packageVersion });
  }
  const customDefinition =
    template !== null && template.customDefinition !== null && typeof template.customDefinition === 'object'
      ? Object.freeze({ ...template.customDefinition })
      : null;
  return {
    ok: true,
    value: Object.freeze({
      // Determinístico: repetir o mesmo comando reconstrói o mesmo id (a
      // duplicidade em si é recusada por `validateSpellSelection`).
      instanceId: `sheet:${collection}:${sourceInstanceId ?? 'base'}:${spellId}`,
      spellRef,
      customDefinition,
      sourceInstanceId,
    }),
  };
}

/**
 * Monta o personagem novo trocando UMA coleção de `state.spells` (imutável:
 * novo objeto em cada nível tocado, nada do personagem de entrada é mutado).
 * @param {object} character
 * @param {string} collection
 * @param {ReadonlyArray<object>} entries
 * @returns {object}
 */
function withSpellCollection(character, collection, entries) {
  return Object.freeze({
    ...character,
    state: Object.freeze({
      ...character.state,
      spells: Object.freeze({ ...character.state.spells, [collection]: Object.freeze([...entries]) }),
    }),
  });
}

/**
 * Comando `prepare-spell`: adiciona `spellId` a `state.spells.prepared`.
 *
 * `preparedFrom: 'spellbook'` (o pedido EXPLÍCITO do Mago — ver o cabeçalho de
 * `spell-selection.js` sobre por que isso nunca é inferido da classe) exige a
 * magia no grimório; sem ele, a magia é validada contra a lista da classe.
 * O limite de preparadas vem de `context.spellcasting.preparedLimit`
 * (produtor real: `features/sheet/spellcasting-table.js`, Task 33).
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {{spellId: string, sourceInstanceId: string|null, preparedFrom?: 'spellbook'|null}} request
 * @param {object} [context] - `{registry (obrigatório), spellcasting?}`.
 * @returns {import('../commands/command-result.js').CommandResult}
 */
export function prepareSpell(character, request, context = {}) {
  const shape = requireSpellCharacterShape(character);
  if (!shape.ok) {
    return commandErr({ character, error: shape.error });
  }
  const normalized = normalizeSpellRequest(request, 'PREPARE_SPELL');
  if (!normalized.ok) {
    return commandErr({ character, error: normalized.error });
  }
  const { spellId, sourceInstanceId } = normalized.value;
  const preparedFrom = request.preparedFrom ?? null;
  if (preparedFrom !== null && preparedFrom !== 'spellbook') {
    return commandErr({
      character,
      error: spellError('PREPARE_SPELL_PREPARED_FROM_INVALID', '"preparedFrom" deve ser "spellbook" ou nulo.', {
        spellId,
        received: String(preparedFrom),
      }),
    });
  }

  // Toda a regra mora aqui — Task 18, reusada, nunca duplicada.
  const validated = validateSpellSelection(
    character,
    { collection: 'prepared', spellIds: [spellId], sourceInstanceId, preparedFrom },
    context,
  );
  if (!validated.ok) {
    return commandErr({ character, error: validated.error });
  }

  const entry = buildSpellEntry(character, spellId, sourceInstanceId, 'prepared', 'PREPARE_SPELL');
  if (!entry.ok) {
    return commandErr({ character, error: entry.error });
  }

  const state = readSpellState(character);
  const next = withSpellCollection(character, 'prepared', [...state.prepared, entry.value]);
  return commandOk({
    character: next,
    events: [{ type: 'spell-prepared', spellId, sourceInstanceId, preparedFrom }],
    affected: [AFFECTED_PREPARED_SPELLS],
  });
}

/**
 * Comando `unprepare-spell`: remove `spellId` de `state.spells.prepared`
 * (a magia PERMANECE em conhecidas/grimório — baseline linha 13672:
 * "despreparada (permanece no grimório)").
 *
 * Recusas nomeadas: magia não preparada por aquela fonte
 * (`UNPREPARE_SPELL_NOT_PREPARED`) e magia sempre preparada por concessão de
 * efeito (`UNPREPARE_SPELL_ALWAYS_PREPARED` — ver cabeçalho).
 * @param {object} character
 * @param {{spellId: string, sourceInstanceId: string|null}} request
 * @returns {import('../commands/command-result.js').CommandResult}
 */
export function unprepareSpell(character, request) {
  const shape = requireSpellCharacterShape(character);
  if (!shape.ok) {
    return commandErr({ character, error: shape.error });
  }
  const normalized = normalizeSpellRequest(request, 'UNPREPARE_SPELL');
  if (!normalized.ok) {
    return commandErr({ character, error: normalized.error });
  }
  const { spellId, sourceInstanceId } = normalized.value;

  const state = readSpellState(character);
  const target = state.prepared.find(
    (entry) => spellIdOf(entry) === spellId && entrySourceOf(entry) === sourceInstanceId,
  );
  if (target === undefined) {
    return commandErr({
      character,
      error: spellError(
        'UNPREPARE_SPELL_NOT_PREPARED',
        `A magia "${spellId}" não está preparada pela fonte ${sourceInstanceId === null ? 'base/classe' : `"${sourceInstanceId}"`}.`,
        { spellId, sourceInstanceId },
      ),
    });
  }
  if (typeof target.instanceId === 'string' && target.instanceId.endsWith(ALWAYS_PREPARED_INSTANCE_SUFFIX)) {
    return commandErr({
      character,
      error: spellError(
        'UNPREPARE_SPELL_ALWAYS_PREPARED',
        `A magia "${spellId}" é sempre preparada (concedida por efeito) e não pode ser despreparada.`,
        { spellId, sourceInstanceId, instanceId: target.instanceId },
      ),
    });
  }

  const remaining = state.prepared.filter((entry) => entry !== target);
  const next = withSpellCollection(character, 'prepared', remaining);
  return commandOk({
    character: next,
    events: [{ type: 'spell-unprepared', spellId, sourceInstanceId }],
    affected: [AFFECTED_PREPARED_SPELLS],
  });
}

/**
 * Comando `add-spellbook-spell`: adiciona `spellId` ao grimório
 * (`state.spells.spellbook`). Validação delegada a `validateSpellSelection`
 * (coleção 'spellbook'): magia existente no catálogo, círculo dentro do
 * alcançável (`context.spellcasting.slotMaximums`), lista da classe e
 * duplicidade por fonte.
 * @param {object} character
 * @param {{spellId: string, sourceInstanceId: string|null}} request
 * @param {object} [context] - `{registry (obrigatório), spellcasting?}`.
 * @returns {import('../commands/command-result.js').CommandResult}
 */
export function addSpellbookSpell(character, request, context = {}) {
  const shape = requireSpellCharacterShape(character);
  if (!shape.ok) {
    return commandErr({ character, error: shape.error });
  }
  const normalized = normalizeSpellRequest(request, 'ADD_SPELLBOOK_SPELL');
  if (!normalized.ok) {
    return commandErr({ character, error: normalized.error });
  }
  const { spellId, sourceInstanceId } = normalized.value;

  const validated = validateSpellSelection(
    character,
    { collection: 'spellbook', spellIds: [spellId], sourceInstanceId },
    context,
  );
  if (!validated.ok) {
    return commandErr({ character, error: validated.error });
  }

  const entry = buildSpellEntry(character, spellId, sourceInstanceId, 'spellbook', 'ADD_SPELLBOOK_SPELL');
  if (!entry.ok) {
    return commandErr({ character, error: entry.error });
  }

  const state = readSpellState(character);
  const next = withSpellCollection(character, 'spellbook', [...state.spellbook, entry.value]);
  return commandOk({
    character: next,
    events: [{ type: 'spellbook-spell-added', spellId, sourceInstanceId }],
    affected: [AFFECTED_SPELLBOOK],
  });
}

/**
 * Comando `remove-spellbook-spell`: remove `spellId` do grimório E da lista de
 * preparadas (baseline linhas 13686-13688: "A magia também deixará sua lista
 * de magias preparadas"). Entradas de preparadas SEMPRE PREPARADAS por
 * concessão de efeito (`:prepared`) são preservadas — elas pertencem ao motor
 * de efeitos, que as re-materializaria de qualquer forma; a divergência do
 * baseline (que filtra por nome, cegamente) é deliberada e testada.
 * @param {object} character
 * @param {{spellId: string, sourceInstanceId: string|null}} request
 * @returns {import('../commands/command-result.js').CommandResult}
 */
export function removeSpellbookSpell(character, request) {
  const shape = requireSpellCharacterShape(character);
  if (!shape.ok) {
    return commandErr({ character, error: shape.error });
  }
  const normalized = normalizeSpellRequest(request, 'REMOVE_SPELLBOOK_SPELL');
  if (!normalized.ok) {
    return commandErr({ character, error: normalized.error });
  }
  const { spellId, sourceInstanceId } = normalized.value;

  const state = readSpellState(character);
  const target = state.spellbook.find(
    (entry) => spellIdOf(entry) === spellId && entrySourceOf(entry) === sourceInstanceId,
  );
  if (target === undefined) {
    return commandErr({
      character,
      error: spellError(
        'REMOVE_SPELLBOOK_SPELL_NOT_FOUND',
        `A magia "${spellId}" não está no grimório pela fonte ${sourceInstanceId === null ? 'base/classe' : `"${sourceInstanceId}"`}.`,
        { spellId, sourceInstanceId },
      ),
    });
  }

  const remainingSpellbook = state.spellbook.filter((entry) => entry !== target);
  const remainingPrepared = state.prepared.filter(
    (entry) =>
      spellIdOf(entry) !== spellId ||
      (typeof entry.instanceId === 'string' && entry.instanceId.endsWith(ALWAYS_PREPARED_INSTANCE_SUFFIX)),
  );

  const affected = [AFFECTED_SPELLBOOK];
  let next = withSpellCollection(character, 'spellbook', remainingSpellbook);
  if (remainingPrepared.length !== state.prepared.length) {
    next = withSpellCollection(next, 'prepared', remainingPrepared);
    affected.push(AFFECTED_PREPARED_SPELLS);
  }
  return commandOk({
    character: next,
    events: [{ type: 'spellbook-spell-removed', spellId, sourceInstanceId }],
    affected,
  });
}
