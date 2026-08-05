// Módulo `infra/character/pre-migration-backup`: serviço de backup de
// segurança que roda ANTES da migração v1->v2 tocar em `dnd_personagens`.
// Grava uma cópia bruta e íntegra em `dnd_personagens_backup_refatoracao_v2`
// (chave fixa, nunca sobrescrita depois de criada) e oferece a via de
// restauração/exportação/confirmação descrita no brief da Task 12.
//
// Modelo de token: `inspectRestore()` captura, num único objeto opaco (o
// "confirmationToken"), tanto um hash dos bytes do backup quanto um hash
// dos bytes ATUAIS do destino (`dnd_personagens`) — a "revision" do
// destino no momento da inspeção. `restore()` só substitui o destino
// quando os dois ainda coincidem: nem o backup nem o destino podem ter
// mudado entre a inspeção e a confirmação (outra aba escrevendo em
// `dnd_personagens`, ou uma segunda `inspectRestore()`/tentativa de
// restore/migração, invalida o token anterior). Não há TTL nem relógio
// oculto — a invalidação é inteiramente por identidade de bytes, não por
// tempo.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { createValidationResult } from '../../core/validation.js';

const SCOPE = 'infra.character.pre-migration-backup';

export const PRE_MIGRATION_BACKUP_KEY = 'dnd_personagens_backup_refatoracao_v2';

/**
 * Hash não criptográfico determinístico (FNV-1a de 32 bits) usado só para
 * comparar identidade de bytes entre duas leituras — não para segurança
 * (tokens já são opacos e de uso único por construção do serviço, não por
 * força do hash).
 * @param {string} text
 * @returns {string}
 */
function fingerprint(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0') + ':' + text.length;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
function backupError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isParsableJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Cria o serviço de backup pré-migração.
 * @param {{storage: Storage, tokenFactory?: () => string}} params - `storage`
 *   segue o contrato mínimo do Web Storage (`getItem`/`setItem`/`removeItem`);
 *   `tokenFactory` gera o identificador opaco do token (padrão:
 *   `crypto.randomUUID` quando disponível, senão um contador interno — só
 *   precisa ser único por processo, a validade real vem da comparação de
 *   fingerprint, não do valor do token em si).
 * @returns {object}
 */
export function createPreMigrationBackupService({ storage, tokenFactory } = {}) {
  if (
    storage === null ||
    typeof storage !== 'object' ||
    typeof storage.getItem !== 'function' ||
    typeof storage.setItem !== 'function'
  ) {
    throw new TypeError('createPreMigrationBackupService: "storage" deve implementar getItem/setItem.');
  }

  let tokenCounter = 0;
  const makeToken =
    tokenFactory ??
    (() => {
      tokenCounter += 1;
      return `backup-token-${Date.now()}-${tokenCounter}`;
    });

  // Estado do último `inspectRestore()`: os únicos tokens/autorizações
  // válidos até a próxima inspeção, mudança de bytes, ou tentativa de uso.
  let activeInspection = null; // {token, backupFingerprint, destinationFingerprint}

  /**
   * Invalida qualquer inspeção pendente — chamado sempre que o serviço
   * observa (ou realiza) uma mudança nos bytes do backup ou do destino, ou
   * quando um token é consumido (uso único).
   */
  function invalidateInspection() {
    activeInspection = null;
  }

  /**
   * Cria o backup uma única vez; nunca sobrescreve um backup já existente.
   * @param {string} rawCharactersJson
   * @param {{safetyExportAuthorization?: object}} [options]
   * @returns {import('../../core/result.js').Result} Result<{created: boolean}, AppError>
   */
  function ensure(rawCharactersJson, { safetyExportAuthorization } = {}) {
    if (typeof rawCharactersJson !== 'string') {
      return err(backupError('CHARACTER_BACKUP_INVALID_INPUT', 'rawCharactersJson deve ser uma string.'));
    }
    if (!isParsableJson(rawCharactersJson)) {
      return err(backupError('CHARACTER_BACKUP_INVALID_JSON', 'rawCharactersJson não é JSON válido.'));
    }

    const existing = storage.getItem(PRE_MIGRATION_BACKUP_KEY);
    if (existing !== null && existing !== undefined) {
      return ok(Object.freeze({ created: false }));
    }

    try {
      storage.setItem(PRE_MIGRATION_BACKUP_KEY, rawCharactersJson);
    } catch (cause) {
      // Autorização de segurança (via a via alternativa sem espaço,
      // prepareSafetyExport + authorizeMigrationAfterSafetyExport) permite
      // que a migração prossiga MESMO sem backup, quando setItem falhou
      // por quota e o usuário já confirmou ter baixado a exportação bruta.
      if (isValidSafetyExportAuthorization(safetyExportAuthorization, rawCharactersJson)) {
        return ok(Object.freeze({ created: false, safetyExportUsed: true }));
      }
      return err(
        createAppError({
          code: 'CHARACTER_BACKUP_WRITE_FAILED',
          scope: SCOPE,
          message:
            'Não foi possível criar o backup (setItem falhou, provavelmente por quota); migração bloqueada até haver autorização de segurança explícita.',
          context: { causeMessage: String(cause?.message ?? cause) },
          cause,
        }),
      );
    }

    invalidateInspection();
    return ok(Object.freeze({ created: true }));
  }

  /**
   * Valida que o backup atualmente armazenado é JSON válido.
   * @returns {import('../../core/validation.js').ValidationResult}
   */
  function validate() {
    const raw = storage.getItem(PRE_MIGRATION_BACKUP_KEY);
    if (raw === null || raw === undefined) {
      return createValidationResult({
        errors: [backupError('CHARACTER_BACKUP_NOT_FOUND', 'Não há backup armazenado.')],
      });
    }
    if (!isParsableJson(raw)) {
      return createValidationResult({
        errors: [backupError('CHARACTER_BACKUP_INVALID_JSON', 'O backup armazenado não é JSON válido.')],
      });
    }
    return createValidationResult();
  }

  /**
   * Exporta o backup armazenado como texto (para download pelo usuário).
   * @returns {import('../../core/result.js').Result} Result<string, AppError>
   */
  function exportBackup() {
    const raw = storage.getItem(PRE_MIGRATION_BACKUP_KEY);
    if (raw === null || raw === undefined) {
      return err(backupError('CHARACTER_BACKUP_NOT_FOUND', 'Não há backup armazenado para exportar.'));
    }
    return ok(raw);
  }

  /**
   * Captura os bytes atuais do backup e do destino (`dnd_personagens`) e
   * emite um token opaco vinculado a essa dupla exata de bytes.
   * @returns {import('../../core/result.js').Result} Result<{confirmationToken, characterCount, byteLength}, AppError>
   */
  function inspectRestore() {
    const backupRaw = storage.getItem(PRE_MIGRATION_BACKUP_KEY);
    if (backupRaw === null || backupRaw === undefined) {
      return err(backupError('CHARACTER_BACKUP_NOT_FOUND', 'Não há backup armazenado para inspecionar.'));
    }
    if (!isParsableJson(backupRaw)) {
      return err(backupError('CHARACTER_BACKUP_INVALID_JSON', 'O backup armazenado não é JSON válido.'));
    }
    const parsed = JSON.parse(backupRaw);
    const characterCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed ?? {}).length;

    const destinationRaw = storage.getItem('dnd_personagens') ?? '';
    const token = makeToken();
    activeInspection = {
      token,
      backupFingerprint: fingerprint(backupRaw),
      destinationFingerprint: fingerprint(destinationRaw),
    };

    return ok(
      Object.freeze({
        confirmationToken: token,
        characterCount,
        byteLength: backupRaw.length,
      }),
    );
  }

  /**
   * Restaura o backup para `dnd_personagens`, substituindo-o, apenas se
   * `confirmed === true` e o token ainda corresponde exatamente à dupla de
   * bytes (backup, destino) capturada por `inspectRestore()`.
   * @param {{confirmationToken: *, confirmed: boolean}} params
   * @returns {import('../../core/result.js').Result} Result<void, AppError>
   */
  function restore({ confirmationToken, confirmed } = {}) {
    if (confirmed !== true) {
      return err(
        backupError('CHARACTER_BACKUP_RESTORE_NOT_CONFIRMED', 'restore() exige confirmed:true explícito.'),
      );
    }
    if (activeInspection === null || activeInspection.token !== confirmationToken) {
      return err(
        backupError(
          'CHARACTER_BACKUP_RESTORE_TOKEN_INVALID',
          'O token de confirmação é desconhecido, já foi consumido, ou expirou por mudança nos bytes.',
        ),
      );
    }

    const backupRaw = storage.getItem(PRE_MIGRATION_BACKUP_KEY);
    if (backupRaw === null || backupRaw === undefined || fingerprint(backupRaw) !== activeInspection.backupFingerprint) {
      invalidateInspection();
      return err(
        backupError(
          'CHARACTER_BACKUP_RESTORE_BACKUP_CHANGED',
          'O backup foi alterado depois de inspectRestore(); repita a inspeção antes de restaurar.',
        ),
      );
    }

    const destinationRaw = storage.getItem('dnd_personagens') ?? '';
    if (fingerprint(destinationRaw) !== activeInspection.destinationFingerprint) {
      invalidateInspection();
      return err(
        backupError(
          'CHARACTER_BACKUP_RESTORE_DESTINATION_CHANGED',
          'dnd_personagens foi alterado por outra instância/aba depois de inspectRestore(); repita a inspeção antes de restaurar.',
        ),
      );
    }

    if (!isParsableJson(backupRaw)) {
      invalidateInspection();
      return err(backupError('CHARACTER_BACKUP_INVALID_JSON', 'O backup armazenado não é JSON válido.'));
    }

    storage.setItem('dnd_personagens', backupRaw);
    invalidateInspection();
    return ok(undefined);
  }

  // --- Via alternativa "sem espaço": exportação bruta + autorização -----
  //
  // Usada quando `ensure()` não conseguiu criar o backup (setItem falhou
  // por quota). `prepareSafetyExport` gera o texto para download mesmo sem
  // nada armazenado; `authorizeMigrationAfterSafetyExport` emite uma
  // autorização de uso único, NÃO serializável (é um objeto vivo com
  // WeakMap de identidade, nunca uma string/JSON), válida só para a
  // tentativa de persistência migrada imediatamente seguinte. Se essa
  // escrita também falhar, os bytes brutos originais continuam intactos
  // (nada foi apagado) e uma nova exportação/confirmação é exigida — a
  // autorização já foi consumida e não pode ser reaproveitada.

  // Autoridade real da autorização: um WeakMap privado deste fechamento,
  // populado SÓ por `authorizeMigrationAfterSafetyExport` (nunca por dado
  // externo). Um objeto que não passou por lá — mesmo com o mesmo formato
  // `{kind:'SafetyExportAuthorization'}`, ex.: revivido de JSON — nunca
  // está nas chaves deste WeakMap, então `isValidSafetyExportAuthorization`
  // o rejeita por identidade, não por forma (duck-typing). O valor
  // guardado é o fingerprint dos bytes exportados no momento da emissão;
  // `ensure()` só aceita a autorização se os bytes recebidos AGORA
  // baterem com esse fingerprint — uma autorização emitida para uma
  // exportação não autoriza persistir bytes diferentes.
  const issuedAuthorizations = new WeakMap();

  /**
   * @param {string} rawCharactersJson
   * @returns {import('../../core/result.js').Result} Result<{jsonText, confirmationToken, characterCount, byteLength}, AppError>
   */
  function prepareSafetyExport(rawCharactersJson) {
    if (typeof rawCharactersJson !== 'string' || !isParsableJson(rawCharactersJson)) {
      return err(backupError('CHARACTER_BACKUP_INVALID_JSON', 'rawCharactersJson deve ser uma string JSON válida.'));
    }
    const parsed = JSON.parse(rawCharactersJson);
    const characterCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed ?? {}).length;
    const token = makeToken();
    safetyExportState = { token, fingerprint: fingerprint(rawCharactersJson) };
    return ok(
      Object.freeze({
        jsonText: rawCharactersJson,
        confirmationToken: token,
        characterCount,
        byteLength: rawCharactersJson.length,
      }),
    );
  }

  let safetyExportState = null;

  /**
   * Emite a autorização de uso único que permite `ensure()` aceitar a
   * migração mesmo sem backup, quando o usuário confirmou explicitamente
   * ter baixado a exportação bruta preparada por `prepareSafetyExport`.
   * @param {{rawCharactersJson: string, confirmationToken: *, confirmed: boolean}} params
   * @returns {import('../../core/result.js').Result} Result<SafetyExportAuthorization, AppError>
   */
  function authorizeMigrationAfterSafetyExport({ rawCharactersJson, confirmationToken, confirmed } = {}) {
    if (confirmed !== true) {
      return err(
        backupError(
          'CHARACTER_SAFETY_EXPORT_NOT_CONFIRMED',
          'authorizeMigrationAfterSafetyExport() exige confirmed:true explícito.',
        ),
      );
    }
    if (
      safetyExportState === null ||
      safetyExportState.token !== confirmationToken ||
      typeof rawCharactersJson !== 'string' ||
      fingerprint(rawCharactersJson) !== safetyExportState.fingerprint
    ) {
      return err(
        backupError(
          'CHARACTER_SAFETY_EXPORT_TOKEN_INVALID',
          'Token de confirmação desconhecido/consumido, ou os bytes não coincidem exatamente com a exportação preparada.',
        ),
      );
    }

    const issuedFingerprint = safetyExportState.fingerprint;
    safetyExportState = null; // uso único: a próxima tentativa exige nova preparação.
    const authorization = Object.freeze({
      kind: 'SafetyExportAuthorization',
      // Identidade de objeto é o mecanismo de validade real — nunca
      // serializado, nunca reconstruível a partir de dados planos. A
      // authenticity de fato vem de `issuedAuthorizations.has(authorization)`
      // (só populado aqui), não deste campo `kind` (que é só cosmético/
      // depuração — um objeto forjado com o mesmo `kind` continua rejeitado
      // porque nunca esteve no WeakMap).
    });
    issuedAuthorizations.set(authorization, issuedFingerprint);
    return ok(authorization);
  }

  /**
   * @param {*} authorization
   * @param {string} rawCharactersJson
   * @returns {boolean}
   */
  function isValidSafetyExportAuthorization(authorization, rawCharactersJson) {
    if (
      authorization === null ||
      authorization === undefined ||
      typeof authorization !== 'object' ||
      !issuedAuthorizations.has(authorization) ||
      typeof rawCharactersJson !== 'string'
    ) {
      return false;
    }
    const boundFingerprint = issuedAuthorizations.get(authorization);
    issuedAuthorizations.delete(authorization); // uso único, mesmo se os bytes não baterem.
    return boundFingerprint === fingerprint(rawCharactersJson);
  }

  return Object.freeze({
    ensure,
    validate,
    export: exportBackup,
    inspectRestore,
    restore,
    prepareSafetyExport,
    authorizeMigrationAfterSafetyExport,
  });
}
