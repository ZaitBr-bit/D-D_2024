// Módulo `infra/preferences/local-storage-preferences-repository`: acesso a
// preferências do usuário (taxas de moeda, toggle "comprar equipado" padrão,
// colapso de seções da ficha, feature flag de level-up v2) sobre as MESMAS
// chaves/formatos que o monólito legado já usa em `localStorage` — nenhuma
// migração de nome/formato é feita aqui; este módulo só formaliza o acesso
// numa porta única (`PreferenceRead<T> = {value, warnings}`), sem nunca
// regravar silenciosamente um valor corrompido.
//
// ## `sheet_collapse_<id>`: shape aberto por tipo (Task 29)
//
// Esta é a única chave escrita por DUAS telas ao mesmo tempo durante a
// migração: o monólito (`equipados`/`mochila`/`esgotados`/`detalhes`/
// `truques`) e a ficha nova (`features/sheet`, que usa IDs de seção). O
// repositório garante os padrões dos cinco nomes legados e preserva qualquer
// outra chave BOOLEANA, na leitura e na escrita; quem valida o vocabulário de
// seções é a feature que o possui, não esta porta.

import { ok, err } from '../../core/result.js';
import { createAppError, createAppWarning } from '../../core/errors.js';

const SCOPE = 'infra.preferences.local-storage-preferences-repository';

export const CURRENCY_RATES_KEY = 'dnd_taxas_moeda';
export const PURCHASE_EQUIPPED_DEFAULT_KEY = 'dnd_comprar_ativo_padrao';
export const LEVELUP_FLOW_V2_KEY = 'feature.levelup.flow.v2';

/**
 * Padrões LEGADOS do colapso de ficha — as cinco seções que o monólito
 * (`site/js/pages/sheet.js`) conhece, com os mesmos valores iniciais.
 * @returns {Readonly<{equipados:boolean, mochila:boolean, esgotados:boolean, detalhes:boolean, truques:boolean}>}
 */
function defaultSheetCollapse() {
  return Object.freeze({ equipados: false, mochila: false, esgotados: false, detalhes: false, truques: true });
}

/**
 * @param {string} characterId
 * @returns {string}
 */
export function sheetCollapseKey(characterId) {
  return `sheet_collapse_${characterId || 'default'}`;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Interpreta um texto de booleano "tolerante" (aceito tanto da feature flag
 * global quanto do storage), sem distinguir caixa/espaços:
 * `1|true|on|sim` -> true, `0|false|off|nao|não` -> false. Qualquer outro
 * texto é inválido (`null`).
 * @param {*} value
 * @returns {boolean | null}
 */
function parseLenientBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'on', 'sim'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'off', 'nao', 'não'].includes(normalized)) {
    return false;
  }
  return null;
}

/**
 * Classifica a causa de uma falha de `storage.setItem` como estouro de quota
 * ou falha genérica — mesma heurística de `local-storage-character-repository.js`.
 * @param {*} cause
 * @returns {string}
 */
function classifyWriteFailure(cause) {
  const name = cause?.name;
  const code = cause?.code;
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014) {
    return 'LOCAL_STORAGE_QUOTA_EXCEEDED';
  }
  return 'LOCAL_STORAGE_WRITE_FAILED';
}

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {*} [cause]
 * @returns {object}
 */
function preferenceError(code, message, context = {}, cause) {
  return createAppError({ code, scope: SCOPE, message, context, cause });
}

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
function preferenceWarning(code, message, context = {}) {
  return createAppWarning({ code, scope: SCOPE, message, context });
}

/**
 * Cria o repositório de preferências.
 * @param {{storage: Storage}} params
 * @returns {Readonly<object>}
 */
export function LocalStoragePreferencesRepository({ storage } = {}) {
  if (storage === null || typeof storage !== 'object' || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new TypeError('LocalStoragePreferencesRepository: "storage" deve implementar getItem/setItem.');
  }

  /**
   * @param {string} key
   * @param {string} text
   * @returns {import('../../core/result.js').Result} Result<void, AppError>
   */
  function writeRaw(key, text) {
    try {
      storage.setItem(key, text);
    } catch (cause) {
      return err(preferenceError(classifyWriteFailure(cause), `Falha ao gravar a preferência "${key}".`, { key }, cause));
    }
    return ok(undefined);
  }

  /**
   * @returns {import('../../core/result.js').Result} Result<PreferenceRead<object|null>, AppError>
   */
  function getCurrencyRates() {
    const raw = storage.getItem(CURRENCY_RATES_KEY);
    if (raw === null || raw === undefined) {
      return ok(Object.freeze({ value: null, warnings: Object.freeze([]) }));
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      return ok(Object.freeze({
        value: null,
        warnings: Object.freeze([preferenceWarning('PREFERENCE_CURRENCY_RATES_CORRUPT', `"${CURRENCY_RATES_KEY}" não é JSON válido; usando o padrão.`, { raw }, cause)]),
      }));
    }
    if (!isPlainObject(parsed)) {
      return ok(Object.freeze({
        value: null,
        warnings: Object.freeze([preferenceWarning('PREFERENCE_CURRENCY_RATES_CORRUPT', `"${CURRENCY_RATES_KEY}" deveria ser um objeto; usando o padrão.`, {})]),
      }));
    }
    return ok(Object.freeze({ value: Object.freeze({ ...parsed }), warnings: Object.freeze([]) }));
  }

  /**
   * @param {object} rates
   * @returns {import('../../core/result.js').Result} Result<void, AppError>
   */
  function setCurrencyRates(rates) {
    if (!isPlainObject(rates)) {
      return err(preferenceError('PREFERENCE_CURRENCY_RATES_INVALID_INPUT', '"rates" deve ser um objeto.', {}));
    }
    return writeRaw(CURRENCY_RATES_KEY, JSON.stringify(rates));
  }

  /**
   * @returns {import('../../core/result.js').Result} Result<void, AppError>
   */
  function resetCurrencyRates() {
    try {
      storage.removeItem(CURRENCY_RATES_KEY);
    } catch (cause) {
      return err(preferenceError(classifyWriteFailure(cause), `Falha ao remover a preferência "${CURRENCY_RATES_KEY}".`, {}, cause));
    }
    return ok(undefined);
  }

  /**
   * @returns {import('../../core/result.js').Result} Result<PreferenceRead<boolean>, AppError>
   */
  function getPurchaseEquippedDefault() {
    const raw = storage.getItem(PURCHASE_EQUIPPED_DEFAULT_KEY);
    if (raw === null || raw === undefined) {
      return ok(Object.freeze({ value: false, warnings: Object.freeze([]) }));
    }
    if (raw !== '1' && raw !== '0') {
      return ok(Object.freeze({
        value: false,
        warnings: Object.freeze([preferenceWarning('PREFERENCE_PURCHASE_EQUIPPED_CORRUPT', `"${PURCHASE_EQUIPPED_DEFAULT_KEY}" deveria ser "1" ou "0"; usando o padrão.`, { raw })]),
      }));
    }
    return ok(Object.freeze({ value: raw === '1', warnings: Object.freeze([]) }));
  }

  /**
   * @param {boolean} value
   * @returns {import('../../core/result.js').Result} Result<void, AppError>
   */
  function setPurchaseEquippedDefault(value) {
    return writeRaw(PURCHASE_EQUIPPED_DEFAULT_KEY, value ? '1' : '0');
  }

  /**
   * @param {string} characterId
   * @returns {import('../../core/result.js').Result} Result<PreferenceRead<object>, AppError>
   */
  function getSheetCollapse(characterId) {
    const key = sheetCollapseKey(characterId);
    const raw = storage.getItem(key);
    const defaults = defaultSheetCollapse();
    if (raw === null || raw === undefined) {
      return ok(Object.freeze({ value: defaults, warnings: Object.freeze([]) }));
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      return ok(Object.freeze({
        value: defaults,
        warnings: Object.freeze([preferenceWarning('PREFERENCE_SHEET_COLLAPSE_CORRUPT', `"${key}" não é JSON válido; usando o padrão.`, { key }, cause)]),
      }));
    }
    if (!isPlainObject(parsed)) {
      return ok(Object.freeze({
        value: defaults,
        warnings: Object.freeze([preferenceWarning('PREFERENCE_SHEET_COLLAPSE_CORRUPT', `"${key}" deveria ser um objeto; usando o padrão.`, { key })]),
      }));
    }
    // --- Leitura ABERTA a chaves novas (fix da revisão da Task 29) ---------
    //
    // A versão original mesclava SOMENTE os cinco campos legados e descartava
    // todo o resto. Isso tornava o colapso da ficha nova impossível de
    // persistir: `features/sheet` grava IDs de seção próprios
    // (`summary-combat`, `spells-spellbook`, ...), a escrita ia para o
    // `localStorage` e a leitura seguinte os jogava fora — `collapsed` voltava
    // vazio SEMPRE, sem erro e sem aviso.
    //
    // O repositório é a PORTA de armazenamento; quem é dono do vocabulário de
    // seções é a feature (`SHEET_SECTION_IDS`), que já filtra o que não
    // reconhece ao carregar. Aqui a regra passa a ser de TIPO, não de nome:
    // os cinco legados garantem seu padrão, e qualquer outra chave sobrevive
    // desde que o valor seja estritamente booleano — um valor corrompido
    // continua sendo descartado, como antes.
    const merged = { ...defaults };
    for (const [field, value] of Object.entries(parsed)) {
      if (typeof value === 'boolean') {
        merged[field] = value;
      }
    }
    return ok(Object.freeze({ value: Object.freeze(merged), warnings: Object.freeze([]) }));
  }

  /**
   * @param {string} characterId
   * @param {object} value
   * @returns {import('../../core/result.js').Result} Result<void, AppError>
   */
  function setSheetCollapse(characterId, value) {
    if (!isPlainObject(value)) {
      return err(preferenceError('PREFERENCE_SHEET_COLLAPSE_INVALID_INPUT', '"value" deve ser um objeto.', {}));
    }
    // Escrita PARCIAL, não substituição (fix da revisão da Task 29).
    //
    // Duas telas gravam nesta mesma chave enquanto o cutover da ficha não
    // acontece: o monólito legado (cinco nomes) e `features/sheet` (IDs de
    // seção). Substituir o objeto inteiro faria cada uma APAGAR o colapso da
    // outra a cada clique — um bug invisível, porque nada falha: o painel do
    // outro lado simplesmente volta ao padrão.
    //
    // Mesclar com o que já está gravado mantém as duas convivendo, e continua
    // sendo o chamador quem decide o valor de cada chave que ele conhece.
    const atual = getSheetCollapse(characterId);
    const base = atual.ok ? atual.value.value : {};
    return writeRaw(sheetCollapseKey(characterId), JSON.stringify({ ...base, ...value }));
  }

  /**
   * @returns {import('../../core/result.js').Result} Result<PreferenceRead<boolean>, AppError>
   */
  function getLevelUpFlowV2() {
    const raw = storage.getItem(LEVELUP_FLOW_V2_KEY);
    if (raw === null || raw === undefined) {
      return ok(Object.freeze({ value: true, warnings: Object.freeze([]) }));
    }
    const parsed = parseLenientBoolean(raw);
    if (parsed === null) {
      return ok(Object.freeze({
        value: true,
        warnings: Object.freeze([preferenceWarning('PREFERENCE_LEVELUP_FLOW_V2_CORRUPT', `"${LEVELUP_FLOW_V2_KEY}" tem valor inválido "${raw}"; usando o padrão.`, { raw })]),
      }));
    }
    return ok(Object.freeze({ value: parsed, warnings: Object.freeze([]) }));
  }

  /**
   * @param {boolean} value
   * @returns {import('../../core/result.js').Result} Result<void, AppError>
   */
  function setLevelUpFlowV2(value) {
    return writeRaw(LEVELUP_FLOW_V2_KEY, value ? 'true' : 'false');
  }

  return Object.freeze({
    getCurrencyRates,
    setCurrencyRates,
    resetCurrencyRates,
    getPurchaseEquippedDefault,
    setPurchaseEquippedDefault,
    getSheetCollapse,
    setSheetCollapse,
    getLevelUpFlowV2,
    setLevelUpFlowV2,
  });
}

/**
 * Resolve a flag de level-up v2 com precedência: feature flag global
 * (`globalFeatureFlags.LEVELUP_FLOW_V2`, tolerante ao mesmo parsing
 * "frouxo") quando válida > preferência de storage > default (`true`).
 * Nunca regrava nada — só leitura combinada.
 * @param {{globalFeatureFlags?: object, preferences: object}} params
 * @returns {import('../../core/result.js').Result} Result<PreferenceRead<boolean>, AppError>
 */
export function resolveLevelUpFlowV2({ globalFeatureFlags, preferences } = {}) {
  if (preferences === null || typeof preferences !== 'object' || typeof preferences.getLevelUpFlowV2 !== 'function') {
    return err(preferenceError('PREFERENCE_LEVELUP_FLOW_V2_INVALID_INPUT', '"preferences" deve ser um LocalStoragePreferencesRepository.', {}));
  }

  const globalRaw = globalFeatureFlags?.LEVELUP_FLOW_V2;
  if (globalRaw !== undefined && globalRaw !== null) {
    const parsedGlobal = parseLenientBoolean(globalRaw);
    if (parsedGlobal !== null) {
      return ok(Object.freeze({ value: parsedGlobal, warnings: Object.freeze([]) }));
    }
    // Flag global presente mas com valor que não parseia nem como
    // verdadeiro nem como falso: nunca cai silenciosamente para o storage
    // sem avisar — o valor inválido é reportado, e a precedência segue
    // (storage > default), com o warning global PREPOSTO aos warnings que a
    // leitura de storage produzir (achado do review independente da Task 13:
    // faltava esse aviso).
    const fromStorage = preferences.getLevelUpFlowV2();
    if (!fromStorage.ok) {
      return fromStorage;
    }
    const globalWarning = preferenceWarning(
      'PREFERENCE_LEVELUP_FLOW_V2_GLOBAL_FLAG_CORRUPT',
      `window.__FEATURE_FLAGS__.LEVELUP_FLOW_V2 tem valor inválido "${globalRaw}"; ignorada em favor do storage/default.`,
      { raw: globalRaw },
    );
    return ok(Object.freeze({
      value: fromStorage.value.value,
      warnings: Object.freeze([globalWarning, ...fromStorage.value.warnings]),
    }));
  }

  return preferences.getLevelUpFlowV2();
}
