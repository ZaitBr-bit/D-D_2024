// Módulo `domain/commands/edit-character`: comando genérico de edição manual
// reversível, restrito à allowlist de paths classificados como
// `"override"` em `tests/fixtures/characters/baseline-field-inventory.json`
// (Task 2) — hoje, na prática, apenas o override de PV máximo
// (`campo-81-pv_max_override`; o outro campo classificado `"override"`,
// `campo-21-edicoes`, é o CONTAINER genérico de edição do baseline, não um
// path de alvo derivado por si só). O path usa o vocabulário fechado de
// alvos derivados da Task 15 (`hp.maximum`, não `state.hitPoints.maximum` —
// ver ADR resolvido no relatório desta task, que também corrigiu
// `infra/character/character-codec.js`/`domain/character/queries/hit-points.js`
// para a mesma chave).
//
// O write-back para o campo plano legado (`pv_max`/`pv_max_override`/
// `edicoes.campos.pv_max`) já é feito por
// `infra/character/character-codec.js#encodeCharacterRecord` — este módulo só
// precisa produzir o override no formato que o encoder espera
// (`{value, original, editedAt, source}`).
//
// Qualquer outro path (incluindo campos de identidade canônica como
// `identity.id`, que nunca deveriam ser editáveis por este mecanismo
// genérico) é recusado explicitamente — nunca aceito "por engano" porque a
// allowlist é uma WHITELIST fechada (`ALLOWED_EDIT_PATHS`), não uma
// blacklist.

import { getHitPointProjection } from '../character/queries/hit-points.js';
import { commandOk, commandErr, commandError } from './command-result.js';

// Paths de IDENTIDADE editáveis (correção I2 da revisão final): exatamente os
// campos que a seção `personal-details` emite (`PERSONAL_DETAIL_FIELDS` em
// `features/sheet/sections/personal-details-section.js`) — texto do jogador,
// sem valor de jogo derivado. `identity.image` fica DE FORA deliberadamente
// (ship-as-debt decidido: trocar imagem exige a porta de processamento
// `infra/image/character-image-processor.js` e continua recusa explícita) e
// `identity.id` nunca entra (identidade do registro). Cada literal abaixo é o
// path que o comando emite em `affected` no sucesso.
const IDENTITY_EDIT_PATHS = Object.freeze(['identity.name', 'identity.alignment', 'identity.size', 'identity.appearance', 'identity.personality', 'identity.ideals', 'identity.bonds', 'identity.flaws', 'identity.backstory', 'identity.notes']);

// Allowlist fechada de paths editáveis por este comando (é a WHITELIST que
// fecha prototype pollution: um path fora dela — `__proto__.x`,
// `identity.image`, `identity.id` — é recusado por nome, nunca aplicado).
// `hp.maximum` deriva do vocabulário fechado de alvos derivados da Task 15,
// restrito ao subconjunto `"override"` de `baseline-field-inventory.json`;
// os paths de identidade vêm da correção I2 (acima).
const ALLOWED_EDIT_PATHS = Object.freeze(new Set(['hp.maximum', ...IDENTITY_EDIT_PATHS]));

// Prefixo comum dos paths de identidade (o campo canônico é o sufixo).
const IDENTITY_PATH_PREFIX = 'identity.';

/**
 * Valida que `value` é um inteiro finito (nunca NaN/Infinity/fração) — o
 * único formato aceito para o override de PV máximo.
 * @param {*} value
 * @returns {boolean}
 */
function isFiniteInteger(value) {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * Edita um campo do personagem restrito à allowlist de overrides
 * (`ALLOWED_EDIT_PATHS`). Cria/atualiza `character.overrides[path]` no
 * formato `{value, original, editedAt, source: 'manual'}`. `original` é
 * preservado do override existente (se houver) — uma segunda edição do
 * MESMO path nunca perde o valor original pré-edição, mesma disciplina de
 * `site/js/ficha-edicoes.js#aplicarEdicao`.
 * @param {object} character
 * @param {{path: string, value: *}} params
 * @param {{maximumHitPoints?: number, registry?: object, now?: string}} [context]
 * @returns {import('./command-result.js').CommandResult}
 */
export function editCharacterField(character, params = {}, context = {}) {
  const { path, value } = params ?? {};
  if (typeof path !== 'string' || !ALLOWED_EDIT_PATHS.has(path)) {
    return commandErr({
      character,
      error: commandError(
        'COMMAND_EDIT_PATH_NOT_ALLOWED',
        `O path "${String(path)}" não está na allowlist de edição (ver baseline-field-inventory.json, classificação "override").`,
        { path: typeof path === 'string' ? path : null },
      ),
    });
  }

  // Cada família de path tem sua própria validação de valor e derivação de
  // `original`: PV máximo (override numérico sobre valor derivado) e campos
  // de identidade (texto do jogador, escrito direto em `identity.*` com
  // override de reversão — correção I2 da revisão final).
  if (path === 'hp.maximum') {
    return editHitPointsMaximum(character, value, context);
  }
  if (path.startsWith(IDENTITY_PATH_PREFIX)) {
    return editIdentityField(character, path, value, context);
  }

  // Inalcançável enquanto ALLOWED_EDIT_PATHS só tiver as famílias acima.
  return commandErr({
    character,
    error: commandError('COMMAND_EDIT_PATH_NOT_IMPLEMENTED', `O path "${path}" está na allowlist mas não tem handler.`, {
      path,
    }),
  });
}

/**
 * Implementação de `editCharacterField` para os paths `identity.*` da
 * allowlist (correção I2). Diferente de `hp.maximum` (override sobre valor
 * DERIVADO), um campo de identidade é fonte direta: o comando escreve o valor
 * novo em `character.identity[campo]` E guarda o override
 * `{value, original, editedAt, source: 'manual'}` — `original` preservado da
 * primeira edição, o que torna `revert-character-edit` do MESMO path o
 * inverso exato (mesma disciplina de `ficha-edicoes.js#aplicarEdicao`).
 * @param {object} character
 * @param {string} path - path já validado pela allowlist (`identity.<campo>`).
 * @param {*} value
 * @param {{now?: string}} context
 * @returns {import('./command-result.js').CommandResult}
 */
function editIdentityField(character, path, value, context) {
  // Texto do jogador: string, e SÓ string (inclusive vazia — apagar um campo
  // é uma edição legítima, diferente de ausência). Nunca coerção.
  if (typeof value !== 'string') {
    return commandErr({
      character,
      error: commandError('COMMAND_EDIT_VALUE_INVALID', `"value" de "${path}" deve ser uma string.`, {
        path,
        receivedType: typeof value,
      }),
    });
  }
  const field = path.slice(IDENTITY_PATH_PREFIX.length);
  const current = typeof character.identity[field] === 'string' ? character.identity[field] : '';
  if (current === value) {
    // No-op idempotente: nada muda, nada é marcado como afetado.
    return commandOk({ character, events: [], affected: [] });
  }

  // `original` da PRIMEIRA edição sobrevive a edições subsequentes.
  const existingOverride = character.overrides?.[path];
  const original =
    existingOverride && typeof existingOverride === 'object' && typeof existingOverride.original === 'string'
      ? existingOverride.original
      : current;

  const editedAt = typeof context?.now === 'string' && context.now.length > 0 ? context.now : new Date().toISOString();
  const nextOverride = Object.freeze({ value, original, editedAt, source: 'manual' });
  const nextCharacter = Object.freeze({
    ...character,
    identity: Object.freeze({ ...character.identity, [field]: value }),
    overrides: Object.freeze({ ...character.overrides, [path]: nextOverride }),
  });

  return commandOk({
    character: nextCharacter,
    events: [{ type: 'character-field-edited', path, value, original, editedAt }],
    affected: [`identity.${field}`],
  });
}

/**
 * Implementação de `editCharacterField` para `path === "hp.maximum"`.
 * @param {object} character
 * @param {*} value
 * @param {object} context
 * @returns {import('./command-result.js').CommandResult}
 */
function editHitPointsMaximum(character, value, context) {
  if (!isFiniteInteger(value)) {
    return commandErr({
      character,
      error: commandError('COMMAND_EDIT_VALUE_INVALID', '"value" de "hp.maximum" deve ser um inteiro finito.', {
        received: value,
      }),
    });
  }

  const existingOverride = character.overrides?.['hp.maximum'];
  let original;
  if (existingOverride && typeof existingOverride === 'object' && typeof existingOverride.value === 'number') {
    original = existingOverride.original;
  } else {
    const projection = getHitPointProjection(character, context);
    if (!projection.ok) {
      return commandErr({ character, error: projection.error });
    }
    original = projection.value.maximum;
  }

  if (existingOverride && existingOverride.value === value) {
    return commandOk({ character, events: [], affected: [] });
  }

  const editedAt = typeof context?.now === 'string' && context.now.length > 0 ? context.now : new Date().toISOString();
  const nextOverride = Object.freeze({ value, original, editedAt, source: 'manual' });
  const nextOverrides = Object.freeze({ ...character.overrides, 'hp.maximum': nextOverride });
  const nextCharacter = Object.freeze({ ...character, overrides: nextOverrides });

  return commandOk({
    character: nextCharacter,
    events: [{ type: 'character-field-edited', path: 'hp.maximum', value, original, editedAt }],
    affected: ['hp.maximum'],
  });
}

/**
 * Reverte uma edição manual (remove `character.overrides[path]`). Idempotente:
 * reverter um path sem edição ativa é um no-op de sucesso (`affected: []`),
 * nunca um erro — mesmo contrato de `site/js/ficha-edicoes.js#reverterEdicao`
 * (que devolve `false`, não lança).
 * @param {object} character
 * @param {{path: string}} params
 * @returns {import('./command-result.js').CommandResult}
 */
export function revertCharacterEdit(character, params = {}) {
  const path = params?.path;
  if (typeof path !== 'string' || !ALLOWED_EDIT_PATHS.has(path)) {
    return commandErr({
      character,
      error: commandError(
        'COMMAND_EDIT_PATH_NOT_ALLOWED',
        `O path "${String(path)}" não está na allowlist de edição.`,
        { path: typeof path === 'string' ? path : null },
      ),
    });
  }

  if (!Object.hasOwn(character.overrides ?? {}, path)) {
    return commandOk({ character, events: [], affected: [] });
  }

  const nextOverrides = { ...character.overrides };
  const removedOverride = nextOverrides[path];
  delete nextOverrides[path];
  let nextCharacter = Object.freeze({ ...character, overrides: Object.freeze(nextOverrides) });

  // Paths `identity.*` (correção I2): o campo é fonte DIRETA (não derivado),
  // então reverter também restaura o valor `original` guardado pelo override
  // — remover só o override deixaria o texto editado no lugar.
  if (path.startsWith(IDENTITY_PATH_PREFIX) && typeof removedOverride?.original === 'string') {
    const field = path.slice(IDENTITY_PATH_PREFIX.length);
    nextCharacter = Object.freeze({
      ...nextCharacter,
      identity: Object.freeze({ ...nextCharacter.identity, [field]: removedOverride.original }),
    });
  }

  return commandOk({
    character: nextCharacter,
    events: [{ type: 'character-edit-reverted', path }],
    affected: [path],
  });
}
