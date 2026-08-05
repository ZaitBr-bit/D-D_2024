// Módulo `features/sheet/sheet-state`: o VOCABULÁRIO de estado da ficha —
// IDs de seção, status, modo de edição, UI state e o snapshot congelado que a
// sessão publica.
//
// ## Por que os IDs de seção moram aqui (e não no registro)
//
// O registro (`sections/section-registry.js`) diz QUAIS seções estão
// montadas agora; a lista canônica diz quais seções a ficha TEM. São coisas
// diferentes, e confundi-las é o que permitiria a um `dirtySections` apontar
// para uma seção que ninguém registrou — o "bypass silencioso" que
// `sheet-command-map.js` existe para impedir. A lista fechada vive na camada
// de estado, e tanto o mapa de comandos quanto o registro derivam dela.
//
// ## `state.hitPoints.temporary` é o único nome de PV temporário
//
// Os nomes legados (`pv_temp`, `pv_temporario`) são resolvidos ANTES desta
// camada, pelos adapters de `infra/character/**` (Task 16). Nenhum módulo de
// `features/sheet/**` conhece esses nomes — se algum conhecesse, o alias
// legado voltaria a vazar para a tela e para o PDF.

import { createAppError } from '../../core/errors.js';

const SCOPE = 'features.sheet.state';

/**
 * IDs canônicos das seções da ficha, na ORDEM de apresentação.
 *
 * Cada um corresponde a um arquivo de `sections/` criado pelas Tasks 30-32:
 * resumo/combate, recursos/características, talentos/progressão,
 * magias/grimório, condições/defesas/sentidos, inventário/carga/moedas e
 * detalhes pessoais.
 * @type {ReadonlyArray<string>}
 */
export const SHEET_SECTION_IDS = Object.freeze([
  'summary-combat',
  'resources-features',
  'feats-progression',
  'spells-spellbook',
  'conditions-defenses-senses',
  'inventory-load-coins',
  'personal-details',
]);

/**
 * Rótulo de cada seção, na língua do jogador.
 *
 * Existe desde o cutover público (Task 33): enquanto a ficha nova só rodava no
 * harness, o cabeçalho desenhava o PRÓPRIO id (`conditions-defenses-senses`),
 * o que é aceitável num laboratório e é uma regressão visível numa ficha real.
 * O rótulo é APRESENTAÇÃO — nenhuma regra o consulta, e o id continua sendo a
 * identidade usada por `dirtySections`, pelo colapso persistido e pela
 * delegação de eventos.
 * @type {Readonly<Record<string, string>>}
 */
export const SHEET_SECTION_LABELS = Object.freeze({
  'summary-combat': 'Resumo e Combate',
  'resources-features': 'Recursos e Características',
  'feats-progression': 'Talentos e Progressão',
  'spells-spellbook': 'Magias e Grimório',
  'conditions-defenses-senses': 'Condições, Defesas e Sentidos',
  'inventory-load-coins': 'Inventário, Carga e Moedas',
  'personal-details': 'Detalhes Pessoais',
});

/**
 * Status do ciclo de vida da sessão da ficha.
 * @type {Readonly<Record<string, string>>}
 */
export const SHEET_STATUS = Object.freeze({
  idle: 'idle',
  loading: 'loading',
  ready: 'ready',
  error: 'error',
});

/**
 * Modo de edição da ficha. `read-only` é o modo de um registro que o
 * repositório não conseguiu decodificar como canônico — tipicamente um
 * `schemaVersion` FUTURO. Ele é exibível, nunca editável: aceitar comandos
 * ali reescreveria com um schema antigo um registro gravado por uma versão
 * mais nova do aplicativo.
 * @type {Readonly<Record<string, string>>}
 */
export const SHEET_MODE = Object.freeze({
  editable: 'editable',
  readOnly: 'read-only',
});

/**
 * Estados de sincronização que a sessão sabe distinguir depois do save local.
 * São exatamente os dois que `createDurableCharacterMutation` devolve, mais o
 * `none` de "nenhuma escrita ainda aconteceu nesta sessão".
 * @type {Readonly<Record<string, string>>}
 */
export const SHEET_SYNC_STATES = Object.freeze({
  none: 'none',
  queued: 'queued',
  reconciliationNeeded: 'reconciliation-needed',
});

/**
 * Vocabulário FECHADO de intenções da ficha.
 *
 * Uma seção nunca despacha um comando de domínio direto nem abre um modal: ela
 * DESCREVE o que o clique significa, e o controller decide o efeito. Os cinco
 * tipos cobrem tudo o que uma seção pode pedir:
 *
 *   - `command`    — executar um comando canônico (`domain/commands/**`);
 *   - `ui-state`   — mexer no estado de tela (colapso, foco, filtro);
 *   - `modal-open` / `modal-close` — pedir um modal, DESCREVENDO-o;
 *   - `retry`      — retentar uma falha registrada pela sessão.
 * @type {Readonly<Record<string, string>>}
 */
export const SHEET_INTENT_TYPES = Object.freeze({
  command: 'sheet/command',
  uiState: 'sheet/ui-state',
  modalOpen: 'sheet/modal-open',
  modalClose: 'sheet/modal-close',
  retry: 'sheet/retry',
});

const SHEET_INTENT_TYPE_SET = new Set(Object.values(SHEET_INTENT_TYPES));

/**
 * Diz se `value` é uma `SheetIntent` do vocabulário fechado.
 * @param {*} value
 * @returns {boolean}
 */
export function isSheetIntent(value) {
  return value !== null && typeof value === 'object' && SHEET_INTENT_TYPE_SET.has(value.type);
}

/**
 * Cria uma `SheetIntent` congelada.
 * @param {string} type
 * @param {object} [payload]
 * @returns {Readonly<object>}
 */
export function createSheetIntent(type, payload = {}) {
  if (!SHEET_INTENT_TYPE_SET.has(type)) {
    throw new TypeError(`createSheetIntent: tipo desconhecido "${String(type)}".`);
  }
  return Object.freeze({ ...payload, type });
}

/**
 * Cria um AppError do escopo de estado da ficha.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {*} [cause]
 * @returns {object}
 */
export function sheetStateError(code, message, context = {}, cause = undefined) {
  return createAppError({ code, scope: SCOPE, message, context, cause });
}

/**
 * Diz se `id` é um ID de seção canônico da ficha.
 * @param {*} id
 * @returns {boolean}
 */
export function isSheetSectionId(id) {
  return typeof id === 'string' && SHEET_SECTION_IDS.includes(id);
}

/**
 * Congela `value` em profundidade, tolerando ciclos.
 *
 * Existe aqui (e não importado de `features/creator`) porque congelar o
 * ViewModel é uma garantia da FICHA: `buildSheetViewModel` promete que nada
 * do que devolve pode ser mutado por uma seção, e essa promessa não pode
 * depender de um módulo de outra feature continuar exportando o utilitário.
 * @param {*} value
 * @param {WeakSet} [seen]
 * @returns {*} o próprio `value`, congelado.
 */
export function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return value;
  }
  if (seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) {
      deepFreeze(descriptor.value, seen);
    }
  }
  return Object.freeze(value);
}

/**
 * Diz se `value` é um objeto simples (nunca array/null/instância exótica).
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Estado de UI inicial da ficha: nada colapsado, nenhum modal aberto,
 * nenhuma seção em foco.
 *
 * NÃO contém default de jogo nenhum — só posições de tela. As preferências
 * persistidas (colapso, taxas de câmbio, "compra equipada", flag de level-up)
 * entram por `createSheetUiState` a partir do repositório de preferências, e
 * nunca são inventadas aqui.
 * @returns {Readonly<object>}
 */
export function createEmptySheetUiState() {
  return deepFreeze({ collapsed: {}, focusedSectionId: null, openModalId: null });
}

/**
 * Aplica um patch RASO ao UI state, devolvendo um estado novo e congelado.
 *
 * Raso de propósito: cada chave de primeiro nível é substituída inteira
 * (exceto `collapsed`, que é um mapa por seção e por isso funde). Um merge
 * profundo genérico tornaria impossível REMOVER uma chave, e o UI state é
 * exatamente o lugar onde "voltar ao estado sem filtro" precisa ser
 * expressável.
 * @param {object} uiState
 * @param {object} patch
 * @returns {import('../../core/result.js').Result} Result<uiState, AppError>
 */
export function mergeSheetUiState(uiState, patch) {
  if (!isPlainObject(patch)) {
    return {
      ok: false,
      error: sheetStateError('SHEET_UI_STATE_PATCH_INVALID', 'O patch de UI state deve ser um objeto simples.', {
        received: Array.isArray(patch) ? 'array' : typeof patch,
      }),
    };
  }
  const base = isPlainObject(uiState) ? uiState : createEmptySheetUiState();
  const next = { ...base, ...patch };
  if (Object.hasOwn(patch, 'collapsed')) {
    if (!isPlainObject(patch.collapsed)) {
      return {
        ok: false,
        error: sheetStateError('SHEET_UI_STATE_COLLAPSED_INVALID', '"collapsed" deve ser um objeto de sectionId -> boolean.', {}),
      };
    }
    for (const sectionId of Object.keys(patch.collapsed)) {
      if (!isSheetSectionId(sectionId)) {
        return {
          ok: false,
          error: sheetStateError('SHEET_UI_STATE_COLLAPSED_UNKNOWN_SECTION', `"${sectionId}" não é uma seção da ficha.`, {
            sectionId,
          }),
        };
      }
    }
    next.collapsed = { ...(base.collapsed ?? {}), ...patch.collapsed };
  }
  return { ok: true, value: deepFreeze(next) };
}

/**
 * Monta o snapshot CONGELADO publicado pela sessão da ficha.
 *
 * @param {{
 *   characterId: string,
 *   status: string,
 *   mode: string,
 *   viewModel: object|null,
 *   uiState: object,
 *   preferences: object,
 *   dirtySections: ReadonlyArray<string>,
 *   syncState: string,
 *   syncFailures: ReadonlyArray<object>,
 *   revisionToken: string|null,
 *   generation: number,
 *   error: object|null,
 *   warnings?: ReadonlyArray<object>
 * }} params
 * @returns {Readonly<object>}
 */
export function createSheetSnapshot(params) {
  const {
    characterId,
    status,
    mode,
    viewModel,
    uiState,
    preferences,
    dirtySections,
    syncState,
    syncFailures,
    revisionToken,
    generation,
    error,
    warnings = [],
  } = params;

  return Object.freeze({
    characterId,
    status,
    mode,
    // O ViewModel já vem congelado em profundidade de `buildSheetViewModel`.
    viewModel,
    uiState,
    preferences,
    dirtySections: Object.freeze([...dirtySections]),
    syncState,
    syncFailures: Object.freeze([...syncFailures]),
    revisionToken,
    generation,
    error,
    warnings: Object.freeze([...warnings]),
  });
}
