// Módulo `domain/effects/apply-grants`: materializa as CONCESSÕES de efeito no
// personagem canônico v2 e as revoga de novo, sempre pela mesma proveniência
// determinística.
//
// ## O que é materializado e onde
//
//   - `grant-spell` -> `state.spells.known` (+ `state.spells.prepared` quando
//     `alwaysPrepared`), com `sourceInstanceId`;
//   - `grant-item`  -> `state.inventory`, com `sourceInstanceId`;
//   - `resource`    -> `state.resources["<ns>:resource:<slug>"]` e um registro
//     em `state.activeEffects` (o `max` declarado é conteúdo, não estado). O
//     registro anota `createdResourceState`: se o estado do recurso já existia,
//     ele é PRESERVADO (com um `AppWarning`, porque o `max` declarado não foi
//     materializado) e a revogação nunca o apaga — mesma disciplina de
//     `addedToConditions`;
//   - `proficiency`, `language`, `defense`, `condition` -> `state.activeEffects`,
//     o único lugar do schema canônico que carrega proveniência para uma
//     concessão solta. `condition` também entra em `state.conditions` (que não
//     tem proveniência própria) e o registro anota se foi ELA que acrescentou o
//     ID, para que a revogação nunca remova uma condição preexistente.
//
// Efeitos que NÃO são concessão (`modifier`, `choice`, `official-handler`,
// `manual`) são projeções: não tocam o personagem. `manual` tem sua própria
// projeção em `projectManualEffects`.
//
// ## Idempotência e inverso exato
//
// Toda entrada materializada é indexada pelo `effectInstanceId` determinístico
// do efeito. Aplicar duas vezes não duplica nada (`applied` vem vazio na
// segunda vez) e `revokeGrantEffects`, indexado pelos mesmos
// `sourceInstanceId`s, devolve o personagem em deep equality com o estado
// anterior à aplicação.
//
// ## Imutabilidade sem efeito colateral no argumento
//
// Só os objetos CRIADOS aqui são congelados. Subárvores que vieram do
// personagem recebido (identity, build, entradas de inventário preexistentes,
// ...) são reaproveitadas por referência e nunca congeladas por nós — congelar
// o grafo do chamador seria um efeito colateral silencioso.
//
// O resultado é deliberadamente `{character, applied/removed, warnings}` — NÃO
// um `CommandResult`, que só nasce na Task 17; os comandos posteriores adaptam
// esta forma para seus próprios `events`/`affected`.

import { ok, err } from '../../core/result.js';
import { createAppError, createAppWarning } from '../../core/errors.js';
import { hasOwn, validateEffectSemantics, isSerializableEffectValue } from './effect-predicates.js';
import { sortResolvedEffects } from './collect-effects.js';
import { resolveNumericValue } from './resolve-effects.js';

const SCOPE = 'domain.effects.grants';

// Tipos de efeito que materializam algo no personagem.
export const GRANT_TYPES = Object.freeze([
  'proficiency',
  'language',
  'defense',
  'grant-spell',
  'grant-item',
  'resource',
  'condition',
]);
const GRANT_TYPE_SET = new Set(GRANT_TYPES);

// Tipos de efeito que são apenas projeção (não mudam o personagem).
export const PROJECTION_TYPES = Object.freeze(['modifier', 'choice', 'official-handler', 'manual']);
const PROJECTION_TYPE_SET = new Set(PROJECTION_TYPES);

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
function grantError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Congela rasamente cada valor informado (só os objetos criados por este
 * módulo). Nunca desce em subárvores vindas do personagem do chamador.
 * @param {...*} values
 */
function freezeOwn(...values) {
  for (const value of values) {
    if (value !== null && typeof value === 'object') {
      Object.freeze(value);
    }
  }
}

/**
 * Extrai o namespace de um ContentId (`"namespace:type:slug"`), ou `null`.
 * @param {*} id
 * @returns {string | null}
 */
function namespaceOf(id) {
  if (typeof id !== 'string') {
    return null;
  }
  const namespace = id.split(':')[0];
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(namespace) ? namespace : null;
}

/**
 * Monta um GrantChange congelado. `pointer` nomeia a COLEÇÃO afetada (não um
 * índice), para que o registro continue verdadeiro depois de qualquer
 * inserção/remoção posterior.
 * @param {{kind: string, pointer: string, id: string | null, effectInstanceId: string | null,
 *   sourceInstanceId: string, sourceId?: string | null}} params
 * @returns {Readonly<object>}
 */
function grantChange({ kind, pointer, id, effectInstanceId, sourceInstanceId, sourceId = null }) {
  return Object.freeze({ kind, pointer, id, effectInstanceId, sourceInstanceId, sourceId });
}

/**
 * Valida a lista de efeitos recebida por `applyGrantEffects`.
 * @param {*} effects
 * @returns {object | null} AppError, ou `null` quando tudo confere.
 */
function checkEffectList(effects) {
  if (!Array.isArray(effects)) {
    return grantError('EFFECT_LIST_INVALID', '"effects" deve ser um array de ResolvedEffect.', {});
  }
  for (const entry of effects) {
    if (
      entry === null ||
      typeof entry !== 'object' ||
      entry.effect === null ||
      typeof entry.effect !== 'object' ||
      typeof entry.effectInstanceId !== 'string' ||
      typeof entry.sourceInstanceId !== 'string'
    ) {
      return grantError(
        'EFFECT_LIST_INVALID',
        'Cada item de "effects" deve ser um ResolvedEffect com "effect" e proveniência.',
        {},
      );
    }
    const type = entry.effect.type;
    if (!GRANT_TYPE_SET.has(type) && !PROJECTION_TYPE_SET.has(type)) {
      return grantError('EFFECT_TYPE_UNKNOWN', `O tipo de efeito "${String(type)}" não é reconhecido.`, {
        type: typeof type === 'string' ? type : null,
      });
    }
    const validation = validateEffectSemantics(entry.effect, { path: entry.effectInstanceId });
    if (!validation.valid) {
      const first = validation.errors[0];
      return grantError(first.code, first.message, first.context ?? {});
    }
  }
  return null;
}

/**
 * Monta o payload `data` gravado em `state.activeEffects` para as concessões
 * sem casa própria no schema canônico.
 * @param {object} effect
 * @returns {object}
 */
function grantDataFor(effect) {
  switch (effect.type) {
    case 'proficiency':
      // `level` ausente = proficiência simples; `expertise` só quando o
      // conteúdo declara explicitamente.
      return { kind: 'proficiency', id: effect.target, level: hasOwn(effect, 'level') ? effect.level : 'proficient' };
    case 'language':
      return { kind: 'language', id: effect.language };
    case 'defense':
      return { kind: 'defense', id: effect.damageType, mode: effect.mode };
    case 'condition':
      return { kind: 'condition', id: effect.condition };
    default:
      // Inalcançável: só os quatro tipos acima chegam aqui.
      return { kind: effect.type, id: null };
  }
}

/**
 * Devolve a `packageVersion` ativa do namespace de `contentId` segundo
 * `build.contentScopes` do personagem, ou `null` quando o namespace não está no
 * escopo (nunca uma versão inventada).
 * @param {object} character
 * @param {string} contentId
 * @returns {string | null}
 */
function packageVersionFor(character, contentId) {
  const namespace = namespaceOf(contentId);
  const scopes = character?.build?.contentScopes;
  if (namespace === null || !hasOwn(scopes, namespace)) {
    return null;
  }
  const scope = scopes[namespace];
  return typeof scope?.packageVersion === 'string' ? scope.packageVersion : null;
}

/**
 * Aplica as concessões declaradas por `effects` ao personagem.
 *
 * @param {object} character - CanonicalCharacter (Task 12)
 * @param {ReadonlyArray<object>} effects - ResolvedEffects (ver collect-effects)
 * @param {{variables?: object}} [context] - `variables` resolve o `max` de um
 *   recurso expresso por nome (ex.: `"proficiency-bonus"`).
 * @returns {import('../../core/result.js').Result} `ok({character, applied, warnings})`
 */
export function applyGrantEffects(character, effects, context = {}) {
  if (character === null || typeof character !== 'object' || Array.isArray(character)) {
    return err(grantError('EFFECT_CHARACTER_INVALID', 'O personagem deve ser um objeto canônico.', {}));
  }
  const listError = checkEffectList(effects);
  if (listError !== null) {
    return err(listError);
  }

  const state = character.state ?? {};
  const spells = state.spells ?? {};

  // Cópias RASAS mutáveis do que pode mudar; nada do personagem de entrada é
  // tocado (nem por congelamento).
  const activeEffects = [...(Array.isArray(state.activeEffects) ? state.activeEffects : [])];
  const known = [...(Array.isArray(spells.known) ? spells.known : [])];
  const prepared = [...(Array.isArray(spells.prepared) ? spells.prepared : [])];
  const inventory = [...(Array.isArray(state.inventory) ? state.inventory : [])];
  const conditions = [...(Array.isArray(state.conditions) ? state.conditions : [])];
  const resources = { ...(state.resources !== null && typeof state.resources === 'object' ? state.resources : {}) };

  const existingInstanceIds = new Set(
    [...activeEffects, ...known, ...prepared, ...inventory].map((entry) => entry?.instanceId),
  );

  const applied = [];
  const warnings = [];
  // Objetos criados aqui — os únicos que podemos congelar.
  const created = [];

  for (const entry of sortResolvedEffects(effects)) {
    const effect = entry.effect;
    const type = effect.type;
    if (!GRANT_TYPE_SET.has(type) || existingInstanceIds.has(entry.effectInstanceId)) {
      continue;
    }
    const instanceId = entry.effectInstanceId;

    if (type === 'grant-spell') {
      const spellRef = Object.freeze({ id: effect.spell, packageVersion: packageVersionFor(character, effect.spell) });
      const knownEntry = { instanceId, spellRef, customDefinition: null, sourceInstanceId: entry.sourceInstanceId };
      known.push(knownEntry);
      created.push(knownEntry);
      existingInstanceIds.add(instanceId);
      if (effect.alwaysPrepared === true) {
        const preparedEntry = {
          instanceId: `${instanceId}:prepared`,
          spellRef,
          customDefinition: null,
          sourceInstanceId: entry.sourceInstanceId,
        };
        prepared.push(preparedEntry);
        created.push(preparedEntry);
        existingInstanceIds.add(preparedEntry.instanceId);
      }
      applied.push(
        grantChange({
          kind: type,
          pointer: 'state.spells.known',
          id: effect.spell,
          effectInstanceId: instanceId,
          sourceInstanceId: entry.sourceInstanceId,
          sourceId: entry.sourceId ?? null,
        }),
      );
      continue;
    }

    if (type === 'grant-item') {
      const inventoryEntry = {
        instanceId,
        itemRef: Object.freeze({ id: effect.item, packageVersion: packageVersionFor(character, effect.item) }),
        customDefinition: null,
        // `quantity` ausente significa uma unidade (o schema já declara
        // `minimum: 1`); não é um default inventado.
        quantity: hasOwn(effect, 'quantity') ? effect.quantity : 1,
        equipped: false,
        expended: 0,
        sourceInstanceId: entry.sourceInstanceId,
      };
      inventory.push(inventoryEntry);
      created.push(inventoryEntry);
      existingInstanceIds.add(instanceId);
      applied.push(
        grantChange({
          kind: type,
          pointer: 'state.inventory',
          id: effect.item,
          effectInstanceId: instanceId,
          sourceInstanceId: entry.sourceInstanceId,
          sourceId: entry.sourceId ?? null,
        }),
      );
      continue;
    }

    if (type === 'resource') {
      const namespace = namespaceOf(entry.sourceId);
      const resourceId = namespace === null ? null : `${namespace}:resource:${effect.resource}`;
      let currentValue = null;
      if (isSerializableEffectValue(effect.max)) {
        const resolved = resolveNumericValue(effect.max, context);
        if (resolved.ok && Number.isInteger(resolved.value) && resolved.value >= 0) {
          currentValue = resolved.value;
        }
      }
      if (resourceId === null) {
        warnings.push(
          createAppWarning({
            code: 'EFFECT_RESOURCE_NAMESPACE_UNKNOWN',
            scope: SCOPE,
            message: `Não foi possível qualificar o recurso "${effect.resource}": a fonte não tem ContentId.`,
            context: { resource: effect.resource, sourceInstanceId: entry.sourceInstanceId },
          }),
        );
      } else if (currentValue === null) {
        warnings.push(
          createAppWarning({
            code: 'EFFECT_RESOURCE_MAX_NOT_NUMERIC',
            scope: SCOPE,
            message: `O "max" do recurso "${effect.resource}" não é um inteiro resolvível; o estado numérico não foi criado.`,
            context: { resource: effect.resource, resourceId, sourceInstanceId: entry.sourceInstanceId },
          }),
        );
      }
      const resourceStateExists = resourceId !== null && hasOwn(resources, resourceId);
      const createdResourceState = resourceId !== null && currentValue !== null && !resourceStateExists;
      if (createdResourceState) {
        const resourceState = { current: currentValue, sourceInstanceId: entry.sourceInstanceId };
        resources[resourceId] = resourceState;
        created.push(resourceState);
      } else if (resourceStateExists && currentValue !== null) {
        // O `max` declarado é RESOLVÍVEL, mas já existe estado para este
        // `resourceId` (recurso preexistente, ou reaplicação da mesma fonte
        // numa faixa de ladder diferente). Não sobrescrevemos o `current` de
        // ninguém — o estado numérico é do jogador, não do conteúdo — mas a
        // limitação é DOCUMENTADA em vez de mascarada: o `max` efetivo não foi
        // materializado e o chamador precisa saber.
        warnings.push(
          createAppWarning({
            code: 'EFFECT_RESOURCE_STATE_ALREADY_EXISTS',
            scope: SCOPE,
            message:
              `Já existe estado para o recurso "${resourceId}"; o "max" declarado por esta concessão não foi ` +
              'materializado (o estado numérico preexistente foi preservado).',
            context: {
              resource: effect.resource,
              resourceId,
              declaredMax: isSerializableEffectValue(effect.max) ? effect.max : null,
              resolvedMax: currentValue,
              sourceInstanceId: entry.sourceInstanceId,
              effectInstanceId: instanceId,
            },
          }),
        );
      }
      const data = {
        kind: type,
        id: resourceId,
        resource: effect.resource,
        max: effect.max,
        createdResourceState,
      };
      const record = { instanceId, sourceInstanceId: entry.sourceInstanceId, data };
      activeEffects.push(record);
      created.push(record, data);
      existingInstanceIds.add(instanceId);
      applied.push(
        grantChange({
          kind: type,
          pointer: 'state.activeEffects',
          id: resourceId ?? effect.resource,
          effectInstanceId: instanceId,
          sourceInstanceId: entry.sourceInstanceId,
          sourceId: entry.sourceId ?? null,
        }),
      );
      continue;
    }

    // proficiency / language / defense / condition
    const data = grantDataFor(effect);
    if (type === 'condition') {
      data.addedToConditions = !conditions.includes(effect.condition);
      if (data.addedToConditions) {
        conditions.push(effect.condition);
      }
    }
    const record = { instanceId, sourceInstanceId: entry.sourceInstanceId, data };
    activeEffects.push(record);
    created.push(record, data);
    existingInstanceIds.add(instanceId);
    applied.push(
      grantChange({
        kind: type,
        pointer: 'state.activeEffects',
        id: data.id,
        effectInstanceId: instanceId,
        sourceInstanceId: entry.sourceInstanceId,
        sourceId: entry.sourceId ?? null,
      }),
    );
  }

  if (applied.length === 0) {
    return ok(Object.freeze({ character, applied: Object.freeze([]), warnings: Object.freeze(warnings) }));
  }

  const nextSpells = { ...spells, known, prepared };
  const nextState = { ...state, spells: nextSpells, inventory, conditions, resources, activeEffects };
  const next = { ...character, state: nextState };
  freezeOwn(next, nextState, nextSpells, known, prepared, inventory, conditions, resources, activeEffects, ...created);

  return ok(Object.freeze({ character: next, applied: Object.freeze(applied), warnings: Object.freeze(warnings) }));
}

/**
 * Revoga as concessões de um conjunto de fontes. É o inverso EXATO de
 * `applyGrantEffects`: os mesmos `sourceInstanceId`s devolvem o personagem em
 * deep equality com o estado anterior à aplicação.
 *
 * Uma lista VAZIA de fontes não remove nada (nunca "remover tudo").
 *
 * @param {object} character - CanonicalCharacter
 * @param {{sourceInstanceIds: ReadonlyArray<string>}} params
 * @param {object} [context]
 * @returns {import('../../core/result.js').Result} `ok({character, removed, warnings})`
 */
export function revokeGrantEffects(character, params, context = {}) {
  void context;
  if (character === null || typeof character !== 'object' || Array.isArray(character)) {
    return err(grantError('EFFECT_CHARACTER_INVALID', 'O personagem deve ser um objeto canônico.', {}));
  }
  const ids = params === null || typeof params !== 'object' ? undefined : params.sourceInstanceIds;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || id.length === 0)) {
    return err(
      grantError('EFFECT_REVOKE_INVALID_REQUEST', 'A revogação exige { sourceInstanceIds: Array<string não vazia> }.', {}),
    );
  }

  const targets = new Set(ids);
  const state = character.state ?? {};
  const spells = state.spells ?? {};

  /** Diz se uma entrada pertence a uma das fontes revogadas. */
  const isTarget = (entry) => typeof entry?.sourceInstanceId === 'string' && targets.has(entry.sourceInstanceId);

  const previousActive = Array.isArray(state.activeEffects) ? state.activeEffects : [];
  const previousKnown = Array.isArray(spells.known) ? spells.known : [];
  const previousPrepared = Array.isArray(spells.prepared) ? spells.prepared : [];
  const previousSpellbook = Array.isArray(spells.spellbook) ? spells.spellbook : [];
  const previousInventory = Array.isArray(state.inventory) ? state.inventory : [];
  const previousConditions = Array.isArray(state.conditions) ? state.conditions : [];
  const previousResources = state.resources !== null && typeof state.resources === 'object' ? state.resources : {};

  const revokedActive = previousActive.filter(isTarget);
  const activeEffects = previousActive.filter((entry) => !isTarget(entry));

  // IDs de condição que FORAM acrescentados por uma concessão revogada — uma
  // condição preexistente nunca é removida.
  const conditionIdsToDrop = new Set(
    revokedActive
      .filter((entry) => entry?.data?.kind === 'condition' && entry.data.addedToConditions === true)
      .map((entry) => entry.data.id),
  );
  // Recursos já contabilizados pelo registro de activeEffects correspondente.
  const resourceIdsFromActive = new Set(
    revokedActive.filter((entry) => entry?.data?.kind === 'resource').map((entry) => entry.data.id),
  );
  // Recursos que ESTA concessão criou (`data.createdResourceState`), o mesmo
  // contrato que `data.addedToConditions` cumpre para condições: um estado de
  // recurso PREEXISTENTE que a concessão apenas reaproveitou (coincidência de
  // `resourceId`) nunca é apagado pela revogação.
  const resourceIdsToDrop = new Set(
    revokedActive
      .filter((entry) => entry?.data?.kind === 'resource' && entry.data.createdResourceState === true)
      .map((entry) => entry.data.id),
  );

  const known = previousKnown.filter((entry) => !isTarget(entry));
  const prepared = previousPrepared.filter((entry) => !isTarget(entry));
  const spellbook = previousSpellbook.filter((entry) => !isTarget(entry));
  const inventory = previousInventory.filter((entry) => !isTarget(entry));
  const conditions = previousConditions.filter((id) => !conditionIdsToDrop.has(id));

  const removed = [];
  for (const entry of revokedActive) {
    removed.push(
      grantChange({
        kind: typeof entry?.data?.kind === 'string' ? entry.data.kind : 'unknown',
        pointer: 'state.activeEffects',
        id: entry?.data?.id ?? null,
        effectInstanceId: entry.instanceId,
        sourceInstanceId: entry.sourceInstanceId,
      }),
    );
  }
  for (const entry of previousKnown.filter(isTarget)) {
    removed.push(
      grantChange({
        kind: 'grant-spell',
        pointer: 'state.spells.known',
        id: entry?.spellRef?.id ?? null,
        effectInstanceId: entry.instanceId,
        sourceInstanceId: entry.sourceInstanceId,
      }),
    );
  }
  for (const entry of previousInventory.filter(isTarget)) {
    removed.push(
      grantChange({
        kind: 'grant-item',
        pointer: 'state.inventory',
        id: entry?.itemRef?.id ?? null,
        effectInstanceId: entry.instanceId,
        sourceInstanceId: entry.sourceInstanceId,
      }),
    );
  }

  const resources = {};
  for (const [resourceId, resourceState] of Object.entries(previousResources)) {
    if (!isTarget(resourceState)) {
      resources[resourceId] = resourceState;
      continue;
    }
    if (resourceIdsFromActive.has(resourceId)) {
      // Há registro de concessão para este recurso entre as fontes revogadas:
      // só removemos o estado se foi ELA que o criou. Caso contrário o estado
      // era preexistente e a aplicação apenas o reaproveitou — remover seria
      // perda de dado do jogador e quebraria o inverso exato.
      if (resourceIdsToDrop.has(resourceId)) {
        continue;
      }
      resources[resourceId] = resourceState;
      continue;
    }
    // Estado de recurso sem registro de concessão correspondente (ex.: vindo da
    // migração v1->v2): é removido e contabilizado à parte, nunca perdido em
    // silêncio.
    removed.push(
      grantChange({
        kind: 'resource',
        pointer: 'state.resources',
        id: resourceId,
        effectInstanceId: null,
        sourceInstanceId: resourceState.sourceInstanceId,
      }),
    );
  }

  if (removed.length === 0) {
    return ok(Object.freeze({ character, removed: Object.freeze([]), warnings: Object.freeze([]) }));
  }

  const nextSpells = { ...spells, known, prepared, spellbook };
  const nextState = { ...state, spells: nextSpells, inventory, conditions, resources, activeEffects };
  const next = { ...character, state: nextState };
  freezeOwn(next, nextState, nextSpells, known, prepared, spellbook, inventory, conditions, resources, activeEffects);

  return ok(Object.freeze({ character: next, removed: Object.freeze(removed), warnings: Object.freeze([]) }));
}

/**
 * Projeta os efeitos `manual` como texto, sem tocar no personagem. É a
 * "concessão" dos efeitos que só existem para serem LIDOS pelo jogador.
 * @param {ReadonlyArray<object>} effects - ResolvedEffects
 * @returns {ReadonlyArray<Readonly<object>>}
 */
export function projectManualEffects(effects) {
  if (!Array.isArray(effects)) {
    return Object.freeze([]);
  }
  const manual = effects.filter(
    (entry) =>
      entry !== null &&
      typeof entry === 'object' &&
      entry.effect !== null &&
      typeof entry.effect === 'object' &&
      entry.effect.type === 'manual' &&
      typeof entry.effect.text === 'string',
  );
  return Object.freeze(
    sortResolvedEffects(manual).map((entry) =>
      Object.freeze({
        text: entry.effect.text,
        sourceId: entry.sourceId ?? null,
        sourceInstanceId: entry.sourceInstanceId,
        effectInstanceId: entry.effectInstanceId,
      }),
    ),
  );
}
