// Módulo `domain/commands/conditions`: comandos de condições ativas e de
// recarga estruturada de recursos. Reflete
// `tests/fixtures/expected/command-transitions.json` (categorias
// "condicoes" e "recursos", commit e43c5ea): `state.conditions` é um array
// de strings (sem estrutura adicional no baseline atual) e recursos
// estruturados vivem em `state.resources[resourceId] = {current, ...}`
// (Task 12/15 — `current` é o único estado numérico; `max` é conteúdo, nunca
// gravado aqui, replicando a mesma disciplina de `apply-grants.js`).
//
// Também expõe `toggleLegacyTalentResource`, que opera sobre
// `extensions.legacyPassthrough.recursos.talentos[slug][campo]` — o formato
// legado de recurso de talento que NÃO tem forma estruturada canônica
// própria (ver CONCERN do relatório da Task 17: só o formato uniforme
// `{usado: boolean}` é modelado como `state.resources` por
// `infra/character/migrations/v1-to-v2.js`; formatos com outros nomes de
// campo, ex. `usado_no_turno`, ou múltiplos campos heterogêneos, continuam
// só em `legacyPassthrough`). O comando recebe o slug/campo já resolvidos
// pelo chamador (nunca deriva comportamento de jogo a partir do nome — só
// endereça uma posição de dado, como `useResource` endereça um `resourceId`).

import { commandOk, commandErr, commandError } from './command-result.js';

const SCOPE_CONDITIONS = 'state.conditions';
const SCOPE_RESOURCES = 'state.resources';
const SCOPE_LEGACY_RESOURCES = 'extensions.legacyPassthrough.recursos';

/**
 * Adiciona uma condição por ID/texto ao personagem. Erro explícito (não
 * no-op silencioso) quando a condição já está ativa — evita duplicidade
 * silenciosa no array e mantém `addCondition`/`removeCondition` simétricos
 * (um `add` bem-sucedido sempre pode ser desfeito por exatamente um
 * `remove`).
 * @param {object} character
 * @param {{conditionId: string}} params
 * @returns {import('./command-result.js').CommandResult}
 */
export function addCondition(character, params = {}) {
  const conditionId = params?.conditionId;
  if (typeof conditionId !== 'string' || conditionId.length === 0) {
    return commandErr({
      character,
      error: commandError('COMMAND_CONDITION_ID_INVALID', '"conditionId" deve ser uma string não vazia.', {
        received: conditionId,
      }),
    });
  }

  const conditions = character.state.conditions;
  if (conditions.includes(conditionId)) {
    return commandErr({
      character,
      error: commandError('COMMAND_CONDITION_ALREADY_ACTIVE', `A condição "${conditionId}" já está ativa.`, {
        conditionId,
      }),
    });
  }

  const nextConditions = Object.freeze([...conditions, conditionId]);
  const nextCharacter = Object.freeze({
    ...character,
    state: Object.freeze({ ...character.state, conditions: nextConditions }),
  });

  return commandOk({
    character: nextCharacter,
    events: [{ type: 'condition-added', conditionId }],
    affected: [SCOPE_CONDITIONS],
  });
}

/**
 * Remove UMA ocorrência de uma condição por ID/texto. Erro explícito quando
 * a condição não está ativa.
 * @param {object} character
 * @param {{conditionId: string}} params
 * @returns {import('./command-result.js').CommandResult}
 */
export function removeCondition(character, params = {}) {
  const conditionId = params?.conditionId;
  if (typeof conditionId !== 'string' || conditionId.length === 0) {
    return commandErr({
      character,
      error: commandError('COMMAND_CONDITION_ID_INVALID', '"conditionId" deve ser uma string não vazia.', {
        received: conditionId,
      }),
    });
  }

  const conditions = character.state.conditions;
  const index = conditions.indexOf(conditionId);
  if (index === -1) {
    return commandErr({
      character,
      error: commandError('COMMAND_CONDITION_NOT_ACTIVE', `A condição "${conditionId}" não está ativa.`, {
        conditionId,
      }),
    });
  }

  const nextConditions = Object.freeze([...conditions.slice(0, index), ...conditions.slice(index + 1)]);
  const nextCharacter = Object.freeze({
    ...character,
    state: Object.freeze({ ...character.state, conditions: nextConditions }),
  });

  return commandOk({
    character: nextCharacter,
    events: [{ type: 'condition-removed', conditionId }],
    affected: [SCOPE_CONDITIONS],
  });
}

/**
 * Consome `amount` (padrão 1) de um recurso estruturado
 * (`state.resources[resourceId].current`). Erro explícito quando o recurso
 * não existe ou quando `current` é insuficiente (nunca satura em 0 por
 * engano — o chamador precisa saber que o uso foi recusado).
 * @param {object} character
 * @param {{resourceId: string, amount?: number}} params
 * @returns {import('./command-result.js').CommandResult}
 */
export function useResource(character, params = {}) {
  const resourceId = params?.resourceId;
  const amount = params?.amount ?? 1;
  if (typeof resourceId !== 'string' || resourceId.length === 0) {
    return commandErr({
      character,
      error: commandError('COMMAND_RESOURCE_ID_INVALID', '"resourceId" deve ser uma string não vazia.', {
        received: resourceId,
      }),
    });
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return commandErr({
      character,
      error: commandError('COMMAND_RESOURCE_AMOUNT_INVALID', '"amount" deve ser um inteiro > 0.', {
        received: amount,
      }),
    });
  }

  const resources = character.state.resources ?? {};
  const entry = resources[resourceId];
  if (entry === undefined) {
    return commandErr({
      character,
      error: commandError('COMMAND_RESOURCE_NOT_FOUND', `O recurso "${resourceId}" não existe neste personagem.`, {
        resourceId,
      }),
    });
  }
  if (typeof entry.current !== 'number' || entry.current < amount) {
    return commandErr({
      character,
      error: commandError(
        'COMMAND_RESOURCE_INSUFFICIENT',
        `O recurso "${resourceId}" não tem uso suficiente disponível.`,
        { resourceId, current: entry.current, amount },
      ),
    });
  }

  const nextResources = Object.freeze({ ...resources, [resourceId]: { ...entry, current: entry.current - amount } });
  const nextCharacter = Object.freeze({
    ...character,
    state: Object.freeze({ ...character.state, resources: nextResources }),
  });

  return commandOk({
    character: nextCharacter,
    events: [{ type: 'resource-used', resourceId, amount }],
    affected: [SCOPE_RESOURCES],
  });
}

/**
 * Restaura `amount` de um recurso estruturado. Quando `context.maximum` é
 * informado, o resultado é limitado a esse teto (nunca ultrapassa); sem
 * teto informado, o incremento é aplicado sem limite — decisão explícita,
 * documentada, não um limite inventado silenciosamente.
 * @param {object} character
 * @param {{resourceId: string, amount: number}} params
 * @param {{maximum?: number}} [context]
 * @returns {import('./command-result.js').CommandResult}
 */
export function rechargeResource(character, params = {}, context = {}) {
  const resourceId = params?.resourceId;
  const amount = params?.amount;
  if (typeof resourceId !== 'string' || resourceId.length === 0) {
    return commandErr({
      character,
      error: commandError('COMMAND_RESOURCE_ID_INVALID', '"resourceId" deve ser uma string não vazia.', {
        received: resourceId,
      }),
    });
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return commandErr({
      character,
      error: commandError('COMMAND_RESOURCE_AMOUNT_INVALID', '"amount" deve ser um inteiro > 0.', {
        received: amount,
      }),
    });
  }

  const resources = character.state.resources ?? {};
  const entry = resources[resourceId];
  if (entry === undefined) {
    return commandErr({
      character,
      error: commandError('COMMAND_RESOURCE_NOT_FOUND', `O recurso "${resourceId}" não existe neste personagem.`, {
        resourceId,
      }),
    });
  }
  // Espelha a validação de `useResource` (fix round 1, achado I4): sem isto,
  // um `entry.current` inválido (ex.: `undefined`) produzia `NaN` em
  // silêncio, que serializa como `null` e viola o schema `resourceState`
  // (`current` é `integer` obrigatório) sem que o comando sinalizasse nada.
  if (!Number.isInteger(entry.current)) {
    return commandErr({
      character,
      error: commandError(
        'COMMAND_RESOURCE_STATE_INVALID',
        `O recurso "${resourceId}" tem "current" que não é um inteiro; a recarga foi recusada.`,
        { resourceId, current: entry.current },
      ),
    });
  }

  const maximum = typeof context?.maximum === 'number' && Number.isFinite(context.maximum) ? context.maximum : Infinity;
  const nextCurrent = Math.min(maximum, entry.current + amount);
  if (nextCurrent === entry.current) {
    return commandOk({ character, events: [], affected: [] });
  }

  const nextResources = Object.freeze({ ...resources, [resourceId]: { ...entry, current: nextCurrent } });
  const nextCharacter = Object.freeze({
    ...character,
    state: Object.freeze({ ...character.state, resources: nextResources }),
  });

  return commandOk({
    character: nextCharacter,
    events: [{ type: 'resource-recharged', resourceId, appliedAmount: nextCurrent - entry.current }],
    affected: [SCOPE_RESOURCES],
  });
}

/**
 * Alterna um campo booleano dentro de
 * `extensions.legacyPassthrough.recursos.talentos[talentSlug][field]` (ver
 * comentário do módulo). `talentSlug`/`field` são endereços de dado
 * fornecidos pelo chamador (ex.: a UI, que já sabe qual talento/instância
 * está sendo alternado) — nunca derivados de nome de talento por este
 * comando.
 * @param {object} character
 * @param {{talentSlug: string, field: string, used: boolean}} params
 * @returns {import('./command-result.js').CommandResult}
 */
export function toggleLegacyTalentResource(character, params = {}) {
  const { talentSlug, field, used } = params ?? {};
  if (typeof talentSlug !== 'string' || talentSlug.length === 0) {
    return commandErr({
      character,
      error: commandError('COMMAND_LEGACY_RESOURCE_SLUG_INVALID', '"talentSlug" deve ser uma string não vazia.', {
        received: talentSlug,
      }),
    });
  }
  if (typeof field !== 'string' || field.length === 0) {
    return commandErr({
      character,
      error: commandError('COMMAND_LEGACY_RESOURCE_FIELD_INVALID', '"field" deve ser uma string não vazia.', {
        received: field,
      }),
    });
  }
  if (typeof used !== 'boolean') {
    return commandErr({
      character,
      error: commandError('COMMAND_LEGACY_RESOURCE_VALUE_INVALID', '"used" deve ser um booleano.', { received: used }),
    });
  }

  const legacyPassthrough = character.extensions?.legacyPassthrough ?? {};
  const previousRecursos = legacyPassthrough.recursos ?? {};
  const previousTalentos = previousRecursos.talentos ?? {};
  const previousEntry = previousTalentos[talentSlug] ?? {};

  if (previousEntry[field] === used) {
    return commandOk({ character, events: [], affected: [] });
  }

  const nextTalentos = { ...previousTalentos, [talentSlug]: { ...previousEntry, [field]: used } };
  const nextRecursos = { ...previousRecursos, talentos: nextTalentos };
  const nextLegacyPassthrough = { ...legacyPassthrough, recursos: nextRecursos };

  const nextCharacter = Object.freeze({
    ...character,
    extensions: Object.freeze({ ...character.extensions, legacyPassthrough: Object.freeze(nextLegacyPassthrough) }),
  });

  return commandOk({
    character: nextCharacter,
    events: [{ type: 'legacy-talent-resource-toggled', talentSlug, field, used }],
    affected: [SCOPE_LEGACY_RESOURCES],
  });
}
