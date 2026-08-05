// Módulo `infra/character/local-storage-character-repository`: repositório
// transacional de personagens sobre `localStorage` (ou qualquer objeto que
// implemente o contrato mínimo Web Storage — ver `tests/helpers/memory-storage.js`).
//
// Modelo de concorrência: cada registro bruto (o elemento exato do array
// persistido em `dnd_personagens`) tem um `revisionToken`/`recordFingerprint`
// derivados de SHA-256 dos seus bytes serializados (`JSON.stringify`) — mas
// com SEPARAÇÃO DE DOMÍNIO entre os dois (ver `REVISION_TOKEN_DOMAIN_PREFIX`):
// `recordFingerprint` é o hash puro dos bytes; `revisionToken` é o hash dos
// mesmos bytes com um prefixo fixo preposto, então os dois NUNCA coincidem
// para o mesmo registro — um `recordFingerprint` copiado para o outbox
// interno (permitido pelo contrato) não pode ser reaproveitado como
// `expectedRevisionToken` para forjar uma escrita. Como o hash depende só do
// CONTEÚDO (nunca de relógio/contador), duas abas que leram o mesmo registro
// sempre apresentam o mesmo `revisionToken`; a primeira escrita muda os
// bytes (logo o hash), e a segunda aba é recusada por conflito de revisão
// mesmo que as duas tentativas tenham ocorrido no mesmo milissegundo. Nenhum
// token é persistido: ele nunca aparece dentro do registro gravado nem em
// qualquer exportação — é recalculado a cada leitura.
//
// `list()`/`get()` nunca escrevem em `storage` (releem e decodificam a cada
// chamada, sem normalização implícita). Toda escrita (`save`/`remove`/
// `replaceAll`/`initialize`) relê os bytes atuais antes de gravar, então uma
// mudança concorrente entre a leitura do chamador e a escrita é sempre
// detectada por divergência de fingerprint — nunca por comparação de
// `atualizado_em`.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { decodeCharacterRecord, encodeCharacterRecord } from './character-codec.js';
import { detectCharacterRecordVersion } from './migration-runner.js';

const SCOPE = 'infra.character.local-storage-character-repository';

export const CHARACTER_STORAGE_KEY = 'dnd_personagens';
// Chave do backup "pré-login" legado (nuvem), sem relação com o backup de
// segurança pré-migração da Task 12 (`PRE_MIGRATION_BACKUP_KEY`,
// `dnd_personagens_backup_refatoracao_v2`) — os dois nunca podem ser
// confundidos (ver `pre-migration-backup.js`).
export const LEGACY_CLOUD_BACKUP_KEY = 'dnd_personagens_backup';

const VALID_REASONS = new Set(['user', 'migration', 'sync']);

// --- SHA-256 puro (sem dependências externas), síncrono -------------------
// Necessário porque `crypto.subtle.digest` é assíncrono e este repositório é
// inteiramente síncrono (contrato `Result`, não `Promise`). Implementação
// padrão (FIPS 180-4) operando sobre a codificação UTF-8 do texto.

const SHA256_K = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/**
 * @param {number} x
 * @param {number} n
 * @returns {number}
 */
function rotr(x, n) {
  return (x >>> n) | (x << (32 - n));
}

/**
 * Calcula o SHA-256 de `text` (codificado em UTF-8) e devolve o hex de 64
 * caracteres. Primitiva de hash pura usada por `fingerprintOf` (bytes
 * exatos de um registro, sem prefixo) e por `revisionTokenOf` (mesmos bytes,
 * mas com `REVISION_TOKEN_DOMAIN_PREFIX` prepostos) — os dois hashes SEMPRE
 * divergem para a mesma entrada, por construção (ver comentário do módulo e
 * de `REVISION_TOKEN_DOMAIN_PREFIX`).
 * @param {string} text
 * @returns {string}
 */
function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;

  const withOne = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  withOne.set(bytes);
  withOne[bytes.length] = 0x80;
  const view = new DataView(withOne.buffer);
  view.setUint32(withOne.length - 4, bitLength >>> 0, false);
  // bitLength cabe em 32 bits para qualquer entrada realista deste app
  // (personagens/listas nunca chegam perto de 512MB de texto).
  view.setUint32(withOne.length - 8, 0, false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Int32Array(64);
  for (let offset = 0; offset < withOne.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getInt32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_K[i] + w[i]) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => (word >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {*} [cause]
 * @returns {object}
 */
function repositoryError(code, message, context = {}, cause) {
  return createAppError({ code, scope: SCOPE, message, context, cause });
}

/**
 * @param {*} rawElement
 * @returns {string | null}
 */
function extractId(rawElement) {
  return isPlainObject(rawElement) && typeof rawElement.id === 'string' && rawElement.id.length > 0
    ? rawElement.id
    : null;
}

/**
 * `recordFingerprint`: SHA-256 dos bytes exatos do registro (ou da lista
 * inteira, para `storageRevisionToken`'s contraparte de leitura) — não
 * autorizador, pode ser copiado para o outbox interno (ver comentário do
 * módulo).
 * @param {*} value
 * @returns {string}
 */
function fingerprintOf(value) {
  return sha256Hex(JSON.stringify(value));
}

// Separador de domínio: um prefixo fixo, nunca produzido por
// `JSON.stringify`, que garante que `revisionTokenOf(x)` e `fingerprintOf(x)`
// sejam SEMPRE valores distintos para o mesmo `x` — mesmo que alguém copie um
// `recordFingerprint` (explicitamente autorizado a viajar até o outbox
// interno, ver contrato do módulo) para tentar usá-lo como precondição de
// escrita, o hash não bate porque o domínio de entrada é diferente. Achado
// do review independente da Task 13: colapsar os dois na mesma string
// tornaria qualquer coisa com acesso ao fingerprint capaz de forjar um
// revisionToken válido.
const REVISION_TOKEN_DOMAIN_PREFIX = 'local-storage-character-repository:revision-token:';

/**
 * `revisionToken`: precondição opaca de escrita, nunca persistida/exportada
 * — derivada dos MESMOS bytes que `fingerprintOf`, mas com separação de
 * domínio (ver `REVISION_TOKEN_DOMAIN_PREFIX`) para que os dois nunca sejam
 * intercambiáveis por acidente ou por má-fé.
 * @param {*} value
 * @returns {string}
 */
function revisionTokenOf(value) {
  return sha256Hex(REVISION_TOKEN_DOMAIN_PREFIX + JSON.stringify(value));
}

/**
 * Classifica a causa de uma falha de `storage.setItem` como estouro de quota
 * (`LOCAL_STORAGE_QUOTA_EXCEEDED`) ou falha genérica de escrita.
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
 * Cria o repositório local de personagens.
 * @param {{
 *   storage: Storage,
 *   codec?: {decode: Function, encode: Function},
 *   aliasResolver: object,
 *   backupService: object,
 *   clock?: {now: () => string},
 *   contentManifests?: object,
 * }} params
 * @returns {Readonly<object>}
 */
export function LocalStorageCharacterRepository({
  storage,
  aliasResolver,
  backupService,
  clock,
  contentManifests,
  // Porta OPCIONAL do codec (Task 28b): dá ao `encodeCharacterRecord` o
  // círculo de uma magia referenciada só por ContentId (magia concedida por
  // efeito nasce sem `customDefinition`). Ausente, o campo simplesmente não é
  // escrito — nada é chutado.
  spellLevelOf,
} = {}) {
  if (storage === null || typeof storage !== 'object' || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new TypeError('LocalStorageCharacterRepository: "storage" deve implementar getItem/setItem.');
  }
  if (aliasResolver === null || typeof aliasResolver !== 'object' || typeof aliasResolver.reverseResolve !== 'function') {
    throw new TypeError('LocalStorageCharacterRepository: "aliasResolver" é obrigatório.');
  }
  if (backupService === null || typeof backupService !== 'object' || typeof backupService.ensure !== 'function') {
    throw new TypeError('LocalStorageCharacterRepository: "backupService" é obrigatório.');
  }
  const now = typeof clock?.now === 'function' ? clock.now : () => new Date().toISOString();

  const decodeContext = { aliasResolver, get now() { return now(); }, contentManifests };

  /**
   * Lê e decodifica (JSON.parse) o array bruto atual de `storage`. Nunca
   * escreve. Corrupção (JSON inválido ou não-array) é sempre um erro — nunca
   * é tratada como lista vazia.
   * @returns {import('../../core/result.js').Result} Result<{raw: string|null, list: Array}, AppError>
   */
  function readRawArray() {
    const raw = storage.getItem(CHARACTER_STORAGE_KEY);
    if (raw === null || raw === undefined) {
      return ok({ raw: null, list: [] });
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      return err(repositoryError('LOCAL_STORAGE_CORRUPT_JSON', `"${CHARACTER_STORAGE_KEY}" não é JSON válido.`, {}, cause));
    }
    if (!Array.isArray(parsed)) {
      return err(repositoryError('LOCAL_STORAGE_CORRUPT_SHAPE', `"${CHARACTER_STORAGE_KEY}" deveria ser um array.`, { receivedType: typeof parsed }));
    }
    return ok({ raw, list: parsed });
  }

  /**
   * Serializa e grava `list` em `storage`, classificando falha de escrita.
   * @param {Array} list
   * @returns {import('../../core/result.js').Result} Result<void, AppError>
   */
  function writeArray(list) {
    const text = JSON.stringify(list);
    try {
      storage.setItem(CHARACTER_STORAGE_KEY, text);
    } catch (cause) {
      return err(repositoryError(classifyWriteFailure(cause), 'Falha ao gravar personagens em armazenamento local.', {}, cause));
    }
    return ok(undefined);
  }

  /**
   * Decodifica um único elemento bruto, nunca lançando: uma falha de decode
   * (não a mesma coisa que "schema futuro", que já vem `ok` em modo
   * read-only) vira um envelope read-only com o registro bruto preservado e
   * o erro anexado como aviso — nenhum dado é perdido silenciosamente.
   * @param {*} rawElement
   * @returns {{mode: string, character?: object, rawRecord?: *, detectedVersion?: number|null, warnings: Array, localSync?: object|null, decodeError?: object}}
   */
  function decodeElementSafely(rawElement) {
    let result;
    try {
      result = decodeCharacterRecord(rawElement, decodeContext);
    } catch (cause) {
      return { mode: 'read-only', rawRecord: rawElement, detectedVersion: null, warnings: [], decodeError: cause };
    }
    if (!result.ok) {
      return { mode: 'read-only', rawRecord: rawElement, detectedVersion: null, warnings: [], decodeError: result.error };
    }
    return result.value;
  }

  /**
   * @param {*} rawElement
   * @param {object} decoded
   * @returns {Readonly<object>} CharacterEnvelope
   */
  function buildEnvelope(rawElement, decoded) {
    const token = revisionTokenOf(rawElement);
    const fingerprint = fingerprintOf(rawElement);
    if (decoded.mode === 'editable') {
      return Object.freeze({
        mode: 'editable',
        character: decoded.character,
        // `rawRecord`: campo interno (não descrito na prosa do contrato,
        // mas coerente com ele — ver comentário do módulo) que carrega o
        // registro plano exato já persistido, usado por
        // `legacy-character-projection.js` para montar a projeção legada
        // sem precisar reencode/aliasResolver a cada leitura.
        rawRecord: rawElement,
        warnings: Object.freeze([...(decoded.warnings ?? [])]),
        localSync: decoded.localSync ? Object.freeze({ ...decoded.localSync }) : null,
        revisionToken: token,
        recordFingerprint: fingerprint,
      });
    }
    return Object.freeze({
      mode: 'read-only',
      rawRecord: decoded.rawRecord ?? rawElement,
      detectedVersion: decoded.detectedVersion ?? null,
      warnings: Object.freeze([...(decoded.warnings ?? [])]),
      decodeError: decoded.decodeError ?? null,
      revisionToken: token,
      recordFingerprint: fingerprint,
    });
  }

  /**
   * Lê os bytes brutos, faz a migração/normalização de todo elemento legado
   * (v1) em memória, cria/confere o backup de segurança ANTES de qualquer
   * primeira persistência v2, e grava uma única vez — só quando algo de fato
   * mudou. Sem isto, `list()`/`get()` nunca fazem mutação implícita.
   * @param {{safetyExportAuthorization?: object}} [params]
   * @returns {import('../../core/result.js').Result} Result<{storageRevisionToken, charactersCount, migratedCount, readOnlyCount, warnings}, AppError>
   */
  function initialize({ safetyExportAuthorization } = {}) {
    const raw = storage.getItem(CHARACTER_STORAGE_KEY);
    if (raw === null || raw === undefined) {
      return ok(Object.freeze({ storageRevisionToken: revisionTokenOf([]), charactersCount: 0, migratedCount: 0, readOnlyCount: 0, warnings: Object.freeze([]) }));
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      return err(repositoryError('LOCAL_STORAGE_CORRUPT_JSON', `"${CHARACTER_STORAGE_KEY}" não é JSON válido; nada foi migrado.`, {}, cause));
    }
    if (!Array.isArray(parsed)) {
      return err(repositoryError('LOCAL_STORAGE_CORRUPT_SHAPE', `"${CHARACTER_STORAGE_KEY}" deveria ser um array; nada foi migrado.`, { receivedType: typeof parsed }));
    }

    let needsWrite = false;
    let migratedCount = 0;
    let readOnlyCount = 0;
    const warnings = [];
    const nextRaw = [];

    for (const el of parsed) {
      const detection = detectCharacterRecordVersion(el);
      const decoded = decodeElementSafely(el);
      if (decoded.mode === 'editable') {
        if (detection.ok && detection.value.kind === 'legacy') {
          migratedCount += 1;
          needsWrite = true;
          const encoded = encodeCharacterRecord(decoded.character, { aliasResolver, localSync: decoded.localSync, spellLevelOf });
          if (!encoded.ok) {
            return err(repositoryError('CHARACTER_INITIALIZE_MIGRATION_FAILED', 'Falha ao codificar um personagem migrado de v1 para v2; nenhuma escrita foi realizada.', { id: extractId(el) }, encoded.error));
          }
          nextRaw.push(encoded.value);
          warnings.push(...(decoded.warnings ?? []));
        } else {
          // Já está no schema atual: reemitido byte a byte, sem re-encode.
          nextRaw.push(el);
        }
      } else {
        readOnlyCount += 1;
        nextRaw.push(decoded.rawRecord ?? el);
      }
    }

    if (needsWrite) {
      const backupResult = backupService.ensure(raw, { safetyExportAuthorization });
      if (!backupResult.ok) {
        return backupResult;
      }
      const writeResult = writeArray(nextRaw);
      if (!writeResult.ok) {
        return writeResult;
      }
    }

    const finalRaw = needsWrite ? nextRaw : parsed;
    return ok(Object.freeze({
      storageRevisionToken: revisionTokenOf(finalRaw),
      charactersCount: finalRaw.length,
      migratedCount,
      readOnlyCount,
      warnings: Object.freeze(warnings),
    }));
  }

  /**
   * @returns {import('../../core/result.js').Result} Result<{characters, storageRevisionToken}, AppError>
   */
  function list() {
    const listResult = readRawArray();
    if (!listResult.ok) {
      return listResult;
    }
    const { list: rawList } = listResult.value;
    const characters = rawList.map((el) => buildEnvelope(el, decodeElementSafely(el)));
    return ok(Object.freeze({
      characters: Object.freeze(characters),
      storageRevisionToken: revisionTokenOf(rawList),
    }));
  }

  /**
   * @param {string} id
   * @returns {import('../../core/result.js').Result} Result<CharacterEnvelope|null, AppError>
   */
  function get(id) {
    const listResult = readRawArray();
    if (!listResult.ok) {
      return listResult;
    }
    const { list: rawList } = listResult.value;
    const el = rawList.find((item) => extractId(item) === id);
    if (el === undefined) {
      return ok(null);
    }
    return ok(buildEnvelope(el, decodeElementSafely(el)));
  }

  /**
   * @param {object} character - CanonicalCharacter
   * @param {{expectedRevisionToken: string|null, reason: string, localSyncMutationId?: string}} params
   * @returns {import('../../core/result.js').Result} Result<CharacterEnvelope, AppError>
   */
  function save(character, { expectedRevisionToken, reason, localSyncMutationId } = {}) {
    if (!VALID_REASONS.has(reason)) {
      return err(repositoryError('CHARACTER_SAVE_INVALID_REASON', '"reason" deve ser "user", "migration" ou "sync".', { reason }));
    }
    const id = character?.identity?.id;
    if (typeof id !== 'string' || id.length === 0) {
      return err(repositoryError('CHARACTER_SAVE_INVALID_INPUT', 'O personagem a salvar precisa de identity.id.', {}));
    }
    if (!isPlainObject(character?.metadata)) {
      return err(repositoryError('CHARACTER_SAVE_INVALID_INPUT', 'O personagem a salvar precisa de "metadata" (createdAt/updatedAt).', { id }));
    }
    if (expectedRevisionToken !== null && typeof expectedRevisionToken !== 'string') {
      return err(repositoryError('CHARACTER_SAVE_INVALID_INPUT', '"expectedRevisionToken" deve ser string (atualização) ou null (criação).', {}));
    }

    const listResult = readRawArray();
    if (!listResult.ok) {
      return listResult;
    }
    const { list: rawList } = listResult.value;
    const index = rawList.findIndex((el) => extractId(el) === id);
    const exists = index !== -1;

    if (expectedRevisionToken === null) {
      if (exists) {
        return err(repositoryError('CHARACTER_SAVE_ALREADY_EXISTS', `Já existe um personagem com id "${id}"; criação exige um id inédito.`, { id }));
      }
    } else {
      if (!exists) {
        return err(repositoryError('CHARACTER_SAVE_NOT_FOUND', `Não há personagem com id "${id}" para atualizar.`, { id }));
      }
      const currentToken = revisionTokenOf(rawList[index]);
      if (currentToken !== expectedRevisionToken) {
        return err(repositoryError('CHARACTER_SAVE_REVISION_CONFLICT', 'O registro foi alterado por outra escrita desde a última leitura; releia antes de salvar.', { id }));
      }
    }

    let localSync = null;
    if (localSyncMutationId !== undefined) {
      if (typeof localSyncMutationId !== 'string' || localSyncMutationId.length === 0) {
        return err(repositoryError('CHARACTER_SAVE_INVALID_INPUT', '"localSyncMutationId" deve ser uma string não vazia quando informado.', {}));
      }
      localSync = { lastMutationId: localSyncMutationId };
    } else if (exists) {
      const existingDecoded = decodeElementSafely(rawList[index]);
      if (existingDecoded.mode === 'editable' && existingDecoded.localSync) {
        localSync = existingDecoded.localSync;
      }
    }

    const nowVal = now();
    const updatedAt = reason === 'user' ? nowVal : character.metadata.updatedAt;
    const createdAt = exists ? character.metadata.createdAt : (character.metadata.createdAt ?? nowVal);
    const nextCharacter = { ...character, metadata: { ...character.metadata, createdAt, updatedAt } };

    const encoded = encodeCharacterRecord(nextCharacter, { aliasResolver, localSync, spellLevelOf });
    if (!encoded.ok) {
      return encoded;
    }

    const nextRawList = [...rawList];
    if (exists) {
      nextRawList[index] = encoded.value;
    } else {
      nextRawList.push(encoded.value);
    }

    const writeResult = writeArray(nextRawList);
    if (!writeResult.ok) {
      return writeResult;
    }

    const newToken = revisionTokenOf(encoded.value);
    const newFingerprint = fingerprintOf(encoded.value);
    return ok(Object.freeze({
      mode: 'editable',
      character: nextCharacter,
      rawRecord: encoded.value,
      warnings: Object.freeze([]),
      localSync: localSync ? Object.freeze({ ...localSync }) : null,
      revisionToken: newToken,
      recordFingerprint: newFingerprint,
    }));
  }

  /**
   * @param {string} id
   * @param {{expectedRevisionToken: string}} params
   * @returns {import('../../core/result.js').Result} Result<void, AppError>
   */
  function remove(id, { expectedRevisionToken } = {}) {
    if (typeof expectedRevisionToken !== 'string' || expectedRevisionToken.length === 0) {
      return err(repositoryError('CHARACTER_REMOVE_INVALID_INPUT', '"expectedRevisionToken" é obrigatório para remover.', {}));
    }
    const listResult = readRawArray();
    if (!listResult.ok) {
      return listResult;
    }
    const { list: rawList } = listResult.value;
    const index = rawList.findIndex((el) => extractId(el) === id);
    if (index === -1) {
      return err(repositoryError('CHARACTER_REMOVE_NOT_FOUND', `Não há personagem com id "${id}" para remover.`, { id }));
    }
    const currentToken = revisionTokenOf(rawList[index]);
    if (currentToken !== expectedRevisionToken) {
      return err(repositoryError('CHARACTER_REMOVE_REVISION_CONFLICT', 'O registro foi alterado por outra escrita desde a última leitura; releia antes de remover.', { id }));
    }
    // Remoção nunca decodifica/reencode: o elemento bruto (editável ou
    // read-only) é excluído tal como está, sem tocar seus bytes.
    const nextRawList = rawList.filter((_el, i) => i !== index);
    return writeArray(nextRawList);
  }

  /**
   * Substitui todo o array persistido por `records` numa única escrita
   * atômica. Cada registro `mode: 'read-only'` é reemitido byte a byte (nunca
   * passa pelo encoder v2); cada `mode: 'editable'` é codificado normalmente.
   * @param {ReadonlyArray<object>} records - StorableCharacter[]
   * @param {{expectedStorageRevisionToken: string, reason: string}} params
   * @returns {import('../../core/result.js').Result} Result<{storageRevisionToken: string}, AppError>
   */
  function replaceAll(records, { expectedStorageRevisionToken, reason } = {}) {
    if (!VALID_REASONS.has(reason)) {
      return err(repositoryError('CHARACTER_REPLACE_ALL_INVALID_REASON', '"reason" deve ser "user", "migration" ou "sync".', { reason }));
    }
    if (typeof expectedStorageRevisionToken !== 'string' || expectedStorageRevisionToken.length === 0) {
      return err(repositoryError('CHARACTER_REPLACE_ALL_INVALID_INPUT', '"expectedStorageRevisionToken" é obrigatório.', {}));
    }
    if (!Array.isArray(records)) {
      return err(repositoryError('CHARACTER_REPLACE_ALL_INVALID_INPUT', '"records" deve ser um array.', {}));
    }

    const listResult = readRawArray();
    if (!listResult.ok) {
      return listResult;
    }
    const { list: rawList } = listResult.value;
    const currentToken = revisionTokenOf(rawList);
    if (currentToken !== expectedStorageRevisionToken) {
      return err(repositoryError('CHARACTER_REPLACE_ALL_REVISION_CONFLICT', 'O storage foi alterado por outra escrita desde a última leitura; releia antes de substituir.', {}));
    }

    const nowVal = now();
    const nextRaw = [];
    for (const record of records) {
      if (!isPlainObject(record)) {
        return err(repositoryError('CHARACTER_REPLACE_ALL_INVALID_INPUT', 'Cada registro deve ser {mode, ...}.', {}));
      }
      if (record.mode === 'editable') {
        const character = record.character;
        const updatedAt = reason === 'user' ? nowVal : character.metadata.updatedAt;
        const createdAt = character.metadata.createdAt ?? nowVal;
        const nextCharacter = { ...character, metadata: { ...character.metadata, createdAt, updatedAt } };
        const encoded = encodeCharacterRecord(nextCharacter, { aliasResolver, localSync: record.localSync ?? null, spellLevelOf });
        if (!encoded.ok) {
          return encoded;
        }
        nextRaw.push(encoded.value);
      } else if (record.mode === 'read-only') {
        if (!isPlainObject(record.rawRecord)) {
          return err(repositoryError('CHARACTER_REPLACE_ALL_INVALID_INPUT', 'Registro "read-only" precisa de "rawRecord" (objeto).', {}));
        }
        nextRaw.push(record.rawRecord);
      } else {
        return err(repositoryError('CHARACTER_REPLACE_ALL_INVALID_INPUT', `"mode" desconhecido: "${record.mode}".`, {}));
      }
    }

    const writeResult = writeArray(nextRaw);
    if (!writeResult.ok) {
      return writeResult;
    }
    return ok(Object.freeze({ storageRevisionToken: revisionTokenOf(nextRaw) }));
  }

  return Object.freeze({ initialize, list, get, save, remove, replaceAll });
}

// Exportado para reuso por `import-export-service.js` (mesma noção de
// identidade de bytes) e pelos testes — evita duas implementações de SHA-256
// divergentes no mesmo módulo lógico.
export { sha256Hex };
