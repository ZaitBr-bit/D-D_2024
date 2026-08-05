// Módulo `infra/firebase/firestore-character-gateway`: a única porta de
// saída para o Firestore. Recebe a API do SDK POR INJEÇÃO (`api`), nunca
// importa o SDK nem uma URL de CDN — é isso que permite testá-lo contra o
// Firestore Emulator (ver `tests/firebase/`) e manter a fila de sync
// (`infra/sync/sync-queue.js`) completamente livre de Firebase.
//
// CAMINHOS (sempre sob o `uid` autenticado, nunca montados a partir de
// dado vindo do documento):
//   users/{uid}/personagens/{charId}             — o registro vivo
//   users/{uid}/personagens_backup_v1/{charId}   — o backup pré-migração
//
// BACKUP REMOTO PRÉ-MIGRAÇÃO
// Mesma motivação e o mesmo desenho do `PreMigrationBackupService` local
// (Task 12), que fecha a assimetria: o `localStorage` já tinha rede de
// segurança antes de uma gravação v2 sobrescrever o dado anterior, o
// documento remoto não tinha. Antes do PRIMEIRO upsert v2 de cada
// personagem, se já existir um documento remoto (isto é, há algo a perder)
// e ainda não existir backup, o documento anterior é copiado VERBATIM — sem
// decodificar, migrar ou normalizar — para o subcaminho de backup, na MESMA
// escrita atômica que grava o v2. As duas escritas têm sucesso juntas ou
// nenhuma acontece: se o backup falhar (por exemplo, negado pelas regras de
// segurança), o upsert falha inteiro e o v2 NÃO é gravado — fail-closed,
// nunca uma gravação parcial. Uma vez criado, o backup jamais é sobrescrito
// ou atualizado (mesma semântica "criado uma única vez" do backup local; as
// regras do Firestore negam `update`/`delete` no subcaminho justamente para
// que nem um bug do client nem o próprio usuário consigam destruí-lo
// depois).
//
// POR QUE `runTransaction` E NÃO `writeBatch`
// A decisão "já existe backup?" e a escrita do backup precisam ser
// ATÔMICAS ENTRE SI. Com um `WriteBatch` a leitura ficava FORA da escrita:
// duas abas/dispositivos podiam ambos observar "sem backup" no mesmo
// instante e o segundo `set` sobrescreveria o backup pré-migração com um
// documento JÁ migrado para v2 — destruindo exatamente o que o backup
// existe para preservar. O SDK Web não oferece precondição create-only
// (`.create()` só existe no Admin SDK), então a única garantia do lado do
// cliente é a transação: as leituras do documento vivo e do backup
// acontecem DENTRO dela e, se qualquer um dos dois for tocado por outra
// escrita antes do commit, o Firestore aborta e reexecuta a função inteira
// — na reexecução o backup já existe e cai no ramo `already-existed`, que
// não escreve nada no subcaminho. As regras de segurança continuam sendo a
// segunda barreira (defesa em profundidade), não a única.
//
// A restauração deste backup é deliberadamente um caminho manual/
// operacional (leitura direta pelo console do Firebase ou por um script
// futuro), não uma função de UI: o objetivo aqui é garantir que o dado
// pré-migração remoto sempre exista em algum lugar recuperável.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';

const SCOPE = 'infra.firebase.firestore-character-gateway';

export const CHARACTER_COLLECTION = 'personagens';
export const REMOTE_BACKUP_COLLECTION = 'personagens_backup_v1';

// Métodos do SDK Firestore exigidos por injeção. `runTransaction` é
// obrigatório porque a atomicidade leitura-do-backup + escrita é um
// requisito de segurança, não um detalhe de implementação: sem ele o
// gateway não pode operar.
const REQUIRED_API_METHODS = ['collection', 'doc', 'getDocs', 'deleteDoc', 'runTransaction'];

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {*} [cause]
 * @returns {object}
 */
function gatewayError(code, message, context = {}, cause = undefined) {
  return createAppError({ code, scope: SCOPE, message, context, cause });
}

/**
 * Classifica uma exceção do SDK num código estruturado estável. O limite de
 * tamanho do documento tem código próprio (`REMOTE_DOCUMENT_TOO_LARGE`)
 * porque a fila o trata de forma distinta: o registro permanece local e o
 * erro fica retido como sincronizável (uma nova tentativa pode passar
 * depois de o usuário reduzir o personagem).
 * @param {*} cause
 * @param {string} fallbackCode
 * @returns {string}
 */
function classifyRemoteFailure(cause, fallbackCode) {
  const message = String(cause?.message ?? '');
  const code = String(cause?.code ?? '');

  if (/maximum allowed size|exceeds the maximum|longer than \d+ bytes|too large/i.test(message)) {
    return 'REMOTE_DOCUMENT_TOO_LARGE';
  }
  if (code === 'permission-denied' || /permission[- ]denied|insufficient permissions/i.test(message)) {
    return 'REMOTE_PERMISSION_DENIED';
  }
  if (code === 'unavailable' || /unavailable|network|offline/i.test(message)) {
    return 'REMOTE_UNAVAILABLE';
  }
  return fallbackCode;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Valida um segmento de caminho do Firestore. Um id com `/` (ou vazio)
 * escaparia do escopo do usuário — nunca é aceito, mesmo vindo de um
 * documento já persistido.
 * @param {*} segment
 * @returns {boolean}
 */
function isValidPathSegment(segment) {
  return typeof segment === 'string' && segment.length > 0 && !segment.includes('/') && segment !== '.' && segment !== '..';
}

/**
 * Cria o gateway Firestore de personagens.
 * @param {{
 *   db: object,
 *   uid: string,
 *   api: {collection: Function, doc: Function, getDocs: Function, deleteDoc: Function, runTransaction: Function},
 *   codec: {decode: Function, encode: Function},
 * }} params
 * @returns {Readonly<object>}
 */
export function createFirestoreCharacterGateway({ db, uid, api, codec } = {}) {
  if (db === null || db === undefined) {
    throw new TypeError('createFirestoreCharacterGateway: "db" é obrigatório.');
  }
  if (!isValidPathSegment(uid)) {
    throw new TypeError('createFirestoreCharacterGateway: "uid" deve ser um segmento de caminho válido e não vazio.');
  }
  if (!isPlainObject(api)) {
    throw new TypeError('createFirestoreCharacterGateway: "api" (funções do SDK Firestore) é obrigatório.');
  }
  for (const method of REQUIRED_API_METHODS) {
    if (typeof api[method] !== 'function') {
      throw new TypeError(`createFirestoreCharacterGateway: "api.${method}" é obrigatório.`);
    }
  }
  if (!isPlainObject(codec) || typeof codec.decode !== 'function' || typeof codec.encode !== 'function') {
    throw new TypeError('createFirestoreCharacterGateway: "codec" com decode/encode é obrigatório.');
  }

  const charactersPath = `users/${uid}/${CHARACTER_COLLECTION}`;
  const backupPath = `users/${uid}/${REMOTE_BACKUP_COLLECTION}`;

  /**
   * Lista os personagens do usuário, decodificando cada documento pelo
   * codec ANTES de devolvê-lo (documentos v1 remotos são migrados para v2
   * em memória pelo mesmo migrador da Task 12). Um documento que não
   * decodifica não é descartado: volta como envelope somente-leitura com o
   * bruto preservado e o erro anexado.
   * @returns {Promise<import('../../core/result.js').Result>} Promise<Result<ReadonlyArray<RemoteCharacterEnvelope>, AppError>>
   */
  async function list() {
    let snapshot;
    try {
      snapshot = await api.getDocs(api.collection(db, charactersPath));
    } catch (cause) {
      return err(
        gatewayError(classifyRemoteFailure(cause, 'REMOTE_LIST_FAILED'), 'Falha ao listar personagens remotos.', { path: charactersPath }, cause),
      );
    }

    const envelopes = [];
    for (const document of snapshot.docs) {
      const characterId = document.id;
      const data = document.data();

      let decoded;
      try {
        decoded = codec.decode(data);
      } catch (cause) {
        decoded = err(gatewayError('CHARACTER_DECODE_FAILED', 'O codec lançou ao decodificar o documento remoto.', { characterId }, cause));
      }

      if (!decoded.ok) {
        envelopes.push(
          Object.freeze({
            characterId,
            mode: 'read-only',
            rawRecord: data,
            warnings: Object.freeze([]),
            decodeError: decoded.error,
          }),
        );
        continue;
      }

      if (decoded.value.mode !== 'editable') {
        envelopes.push(
          Object.freeze({
            characterId,
            mode: 'read-only',
            rawRecord: decoded.value.rawRecord ?? data,
            detectedVersion: decoded.value.detectedVersion ?? null,
            warnings: Object.freeze([...(decoded.value.warnings ?? [])]),
            decodeError: null,
          }),
        );
        continue;
      }

      envelopes.push(
        Object.freeze({
          characterId,
          mode: 'editable',
          character: decoded.value.character,
          rawRecord: data,
          warnings: Object.freeze([...(decoded.value.warnings ?? [])]),
          decodeError: null,
        }),
      );
    }

    return ok(Object.freeze(envelopes));
  }

  /**
   * Grava (cria ou atualiza) o personagem remoto, criando o backup
   * pré-migração na MESMA escrita atômica quando for o primeiro upsert v2
   * sobre um documento remoto já existente.
   * @param {object} characterEnvelope - envelope EDITÁVEL do repositório.
   * @returns {Promise<import('../../core/result.js').Result>} Promise<Result<{characterId, updatedAt, remoteBackup}, AppError>>
   */
  async function upsert(characterEnvelope) {
    if (!isPlainObject(characterEnvelope) || characterEnvelope.mode !== 'editable') {
      return err(
        gatewayError(
          'REMOTE_UPSERT_READ_ONLY_ENVELOPE',
          'Somente um envelope editável pode ser enviado: gravar um envelope somente-leitura reduziria um schema futuro que este código não entende.',
          { mode: characterEnvelope?.mode ?? null },
        ),
      );
    }

    const characterId = characterEnvelope.character?.identity?.id;
    if (!isValidPathSegment(characterId)) {
      return err(gatewayError('REMOTE_UPSERT_INVALID_ID', 'O personagem a enviar precisa de um identity.id válido como segmento de caminho.'));
    }

    let encoded;
    try {
      encoded = codec.encode(characterEnvelope.character);
    } catch (cause) {
      return err(gatewayError('REMOTE_UPSERT_ENCODE_FAILED', 'O codec lançou ao codificar o personagem para envio.', { characterId }, cause));
    }
    if (!encoded.ok) {
      return err(
        gatewayError('REMOTE_UPSERT_ENCODE_FAILED', 'O personagem não pôde ser codificado para envio; nada foi gravado.', { characterId }, encoded.error),
      );
    }
    const record = encoded.value;

    const documentRef = api.doc(db, charactersPath, characterId);
    const backupRef = api.doc(db, backupPath, characterId);

    // `remoteBackup` é decidido DENTRO da transação (e reatribuído a cada
    // reexecução dela): usar um valor calculado numa tentativa anterior
    // reportaria "created" quando o commit vencedor viu o backup já criado
    // por outra aba.
    let remoteBackup = 'not-applicable';
    try {
      remoteBackup = await api.runTransaction(db, async (transaction) => {
        // TODAS as leituras antes de qualquer escrita — exigência do
        // Firestore e, aqui, também a janela que estamos fechando: o
        // documento vivo e o backup passam a fazer parte do conjunto de
        // leitura da transação, então qualquer escrita concorrente sobre
        // eles aborta e reexecuta esta função.
        const existingSnapshot = await transaction.get(documentRef);
        const backupSnapshot = await transaction.get(backupRef);

        let decisao;
        if (backupSnapshot.exists()) {
          // Criado uma única vez: nunca sobrescrever nem atualizar.
          decisao = 'already-existed';
        } else if (existingSnapshot.exists()) {
          decisao = 'created';
        } else {
          // Personagem nunca sincronizado: não há dado anterior a perder.
          decisao = 'not-applicable';
        }

        if (decisao === 'created') {
          // VERBATIM: os bytes exatos do documento anterior, sem decodificar,
          // migrar ou normalizar — é justamente o estado pré-migração que
          // precisa sobreviver.
          transaction.set(backupRef, existingSnapshot.data());
        }
        transaction.set(documentRef, record);
        return decisao;
      });
    } catch (cause) {
      // Fail-closed: qualquer falha (inclusive do backup, inclusive
      // contenção que esgotou as retentativas do SDK) aborta a transação
      // inteira — o documento v2 NÃO é gravado.
      return err(
        gatewayError(
          classifyRemoteFailure(cause, 'REMOTE_UPSERT_FAILED'),
          'Falha ao gravar o personagem remoto; a escrita atômica (backup + documento v2) foi inteiramente revertida.',
          { characterId },
          cause,
        ),
      );
    }

    return ok(
      Object.freeze({
        characterId,
        // Preserva a ausência: um registro sem `atualizado_em` devolve
        // `null`, nunca um instante plausível inventado aqui.
        updatedAt: typeof record.atualizado_em === 'string' ? record.atualizado_em : null,
        remoteBackup,
      }),
    );
  }

  /**
   * Remove o personagem remoto. NUNCA toca no backup: a remoção do registro
   * vivo não pode destruir a rede de segurança pré-migração.
   * @param {string} characterId
   * @returns {Promise<import('../../core/result.js').Result>} Promise<Result<void, AppError>>
   */
  async function remove(characterId) {
    if (!isValidPathSegment(characterId)) {
      return err(gatewayError('REMOTE_REMOVE_INVALID_ID', '"characterId" deve ser um segmento de caminho válido.'));
    }
    try {
      await api.deleteDoc(api.doc(db, charactersPath, characterId));
    } catch (cause) {
      return err(
        gatewayError(classifyRemoteFailure(cause, 'REMOTE_REMOVE_FAILED'), 'Falha ao remover o personagem remoto.', { characterId }, cause),
      );
    }
    return ok(undefined);
  }

  return Object.freeze({ uid, charactersPath, backupPath, list, upsert, remove });
}
