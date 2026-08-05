// Módulo `infra/sync/merge-character-records`: função pura que decide, para
// cada personagem, qual lado (local ou remoto) prevalece, sem tocar em
// storage, rede ou relógio.
//
// Regras (todas deliberadamente explícitas, nenhuma "resolução por default"):
//
// 1. Comparação SEMPRE por `atualizado_em` via `Date.parse` + guarda
//    `Number.isFinite`. Um lado com timestamp ausente, vazio, nulo ou
//    não-ISO NUNCA é tratado como mais antigo nem como mais novo: a
//    comparação é impossível, então nada é adotado — o baseline LOCAL fica
//    como está, o registro NÃO é reenviado, e o caso vira um `AppWarning`
//    `SYNC_MERGE_TIMESTAMP_UNCOMPARABLE` que a fila converte em falha
//    retryable. Um vencedor silencioso aqui sobrescreveria o trabalho do
//    usuário em um dos dois lados.
// 2. Local estritamente mais novo vence E entra em `toUpsert` — adotar
//    localmente sem reenviar deixaria o registro mais novo do usuário preso
//    no dispositivo, invisível para os outros. Empate ou remoto mais novo:
//    o remoto vence, preservando o baseline compartilhado.
// 3. Um id com remoção pendente na fila nunca ressuscita a partir do
//    remoto (o `flush` ainda vai propagar a remoção); se ele ainda existir
//    localmente, sai de `merged` e é reportado em `toRemoveLocally`.
// 4. Registros `read-only` (schema futuro / falha de decode) são
//    preservados byte a byte e nunca reenviados — o encoder v2 reduziria um
//    schema que ele não entende. O caso é reportado como aviso, não
//    descartado em silêncio.
// 5. Um registro sem id identificável permanece em `merged` (nada é
//    perdido do storage local) e é reportado como aviso.

import { createAppWarning } from '../../core/errors.js';

const SCOPE = 'infra.sync.merge-character-records';

/**
 * Extrai o id do personagem de um registro local ou remoto, sem inventar
 * valor: se não houver id em nenhuma das posições conhecidas, devolve null.
 * @param {*} record
 * @returns {string|null}
 */
function extractCharacterId(record) {
  const candidates = [record?.characterId, record?.character?.identity?.id, record?.rawRecord?.id];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return null;
}

/**
 * Extrai o `atualizado_em` bruto de um registro, PRESERVANDO a ausência:
 * um campo ausente devolve `undefined`, nunca um default plausível (`0`,
 * época, "agora"). Quem compara é que decide o que fazer com a ausência.
 * @param {*} record
 * @returns {*}
 */
function extractRawUpdatedAt(record) {
  const fromCanonical = record?.character?.metadata?.updatedAt;
  if (fromCanonical !== undefined) {
    return fromCanonical;
  }
  return record?.rawRecord?.atualizado_em;
}

/**
 * Converte um `atualizado_em` bruto em milissegundos comparáveis, ou `null`
 * quando o valor é ausente/vazio/não parseável. `Date.parse` sozinho não
 * basta: ele devolve `NaN` para lixo, e `NaN` em comparação é sempre falso,
 * o que faria o outro lado "vencer" por acidente — daí a guarda explícita
 * com `Number.isFinite` e o retorno `null` tratado como incomparável.
 * @param {*} rawValue
 * @returns {number|null}
 */
function toComparableTimestamp(rawValue) {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Normaliza um registro local para o formato `StorableCharacter` aceito por
 * `repository.replaceAll`, anotando a origem para diagnóstico/teste.
 * @param {*} record
 * @param {'local'|'remote'} origin
 * @param {object|null} localSync - marcador local a preservar na adoção remota.
 * @returns {Readonly<object>}
 */
function toStorable(record, origin, localSync) {
  if (record?.mode === 'editable') {
    return Object.freeze({
      mode: 'editable',
      character: record.character,
      localSync: localSync ?? record.localSync ?? null,
      origin,
    });
  }
  return Object.freeze({
    mode: 'read-only',
    rawRecord: record?.rawRecord ?? record,
    origin,
  });
}

/**
 * Faz o merge entre a lista local e a lista remota de personagens.
 * @param {{
 *   localRecords: ReadonlyArray<object>,
 *   remoteRecords: ReadonlyArray<object>,
 *   pendingDeletionIds: Iterable<string>,
 * }} params
 * @returns {Readonly<{merged: ReadonlyArray<object>, toUpsert: ReadonlyArray<string>, toRemoveLocally: ReadonlyArray<string>, warnings: ReadonlyArray<object>}>}
 */
export function mergeCharacterRecords({ localRecords, remoteRecords, pendingDeletionIds = [] } = {}) {
  if (!Array.isArray(localRecords) || !Array.isArray(remoteRecords)) {
    throw new TypeError('mergeCharacterRecords: "localRecords" e "remoteRecords" devem ser arrays.');
  }

  const pendingDeletions = new Set(pendingDeletionIds);
  const merged = [];
  const toUpsert = [];
  const toRemoveLocally = [];
  const warnings = [];

  // Índice dos remotos por id. Um remoto sem id não pode ser pareado nem
  // adotado com segurança (não há como saber o que ele substituiria) — é
  // reportado e ignorado para o storage local, que é a única lista que
  // este merge tem autoridade para reescrever.
  const remoteById = new Map();
  for (const remoteRecord of remoteRecords) {
    const id = extractCharacterId(remoteRecord);
    if (id === null) {
      warnings.push(
        createAppWarning({
          code: 'SYNC_MERGE_RECORD_WITHOUT_ID',
          scope: SCOPE,
          message: 'Registro remoto sem id identificável; não foi possível pareá-lo com nenhum registro local.',
          context: { side: 'remote' },
        }),
      );
      continue;
    }
    remoteById.set(id, remoteRecord);
  }

  const consumedRemoteIds = new Set();

  for (const localRecord of localRecords) {
    const id = extractCharacterId(localRecord);

    if (id === null) {
      // Sem id não há como comparar nem remover com segurança: fica no
      // storage exatamente como está, e o caso é reportado.
      merged.push(toStorable(localRecord, 'local', null));
      warnings.push(
        createAppWarning({
          code: 'SYNC_MERGE_RECORD_WITHOUT_ID',
          scope: SCOPE,
          message: 'Registro local sem id identificável; preservado como está, fora do merge.',
          context: { side: 'local' },
        }),
      );
      continue;
    }

    if (pendingDeletions.has(id)) {
      // O usuário apagou este personagem (possivelmente offline). Ele sai
      // da lista local e a remoção remota continua pendente na fila.
      consumedRemoteIds.add(id);
      toRemoveLocally.push(id);
      continue;
    }

    const remoteRecord = remoteById.get(id);
    if (remoteRecord === undefined) {
      // Só local: mantém e reenvia (o servidor ainda não o conhece).
      merged.push(toStorable(localRecord, 'local', null));
      if (localRecord?.mode === 'editable') {
        toUpsert.push(id);
      } else {
        warnings.push(
          createAppWarning({
            code: 'SYNC_MERGE_READ_ONLY_NOT_SENDABLE',
            scope: SCOPE,
            message: 'Registro local somente-leitura (schema futuro) preservado, mas não pode ser enviado ao servidor.',
            context: { characterId: id },
          }),
        );
      }
      continue;
    }

    consumedRemoteIds.add(id);

    const localTimestamp = toComparableTimestamp(extractRawUpdatedAt(localRecord));
    const remoteTimestamp = toComparableTimestamp(extractRawUpdatedAt(remoteRecord));

    if (localTimestamp === null || remoteTimestamp === null) {
      // Conflito não resolvível: nenhum lado é adotado, nada é reenviado, o
      // baseline local permanece exatamente como está e o caso vira uma
      // falha retryable na fila.
      const side = localTimestamp === null && remoteTimestamp === null ? 'both' : (localTimestamp === null ? 'local' : 'remote');
      merged.push(toStorable(localRecord, 'local', null));
      warnings.push(
        createAppWarning({
          code: 'SYNC_MERGE_TIMESTAMP_UNCOMPARABLE',
          scope: SCOPE,
          message: 'Não foi possível comparar "atualizado_em" (ausente, vazio ou não-ISO); nenhum lado foi adotado.',
          context: {
            characterId: id,
            side,
            localUpdatedAt: extractRawUpdatedAt(localRecord) ?? null,
            remoteUpdatedAt: extractRawUpdatedAt(remoteRecord) ?? null,
          },
        }),
      );
      continue;
    }

    if (localTimestamp > remoteTimestamp) {
      // Local estritamente mais novo: vence E precisa ser reenviado.
      merged.push(toStorable(localRecord, 'local', null));
      if (localRecord?.mode === 'editable') {
        toUpsert.push(id);
      } else {
        warnings.push(
          createAppWarning({
            code: 'SYNC_MERGE_READ_ONLY_NOT_SENDABLE',
            scope: SCOPE,
            message: 'Registro local somente-leitura venceu por timestamp, mas não pode ser enviado ao servidor.',
            context: { characterId: id },
          }),
        );
      }
      continue;
    }

    // Empate ou remoto mais novo: o remoto vence, preservando o baseline
    // compartilhado. O marcador `_local_sync` é local por definição e nunca
    // vem do servidor, então é carregado do lado local para não se perder.
    merged.push(toStorable(remoteRecord, 'remote', localRecord?.localSync ?? null));
  }

  // Remotos que não existiam localmente.
  for (const [id, remoteRecord] of remoteById) {
    if (consumedRemoteIds.has(id)) {
      continue;
    }
    if (pendingDeletions.has(id)) {
      // Apagado neste dispositivo: não ressuscitar. Como não estava na
      // lista local, também não há remoção local a fazer.
      continue;
    }
    merged.push(toStorable(remoteRecord, 'remote', null));
  }

  return Object.freeze({
    merged: Object.freeze(merged),
    toUpsert: Object.freeze(toUpsert),
    toRemoveLocally: Object.freeze(toRemoveLocally),
    warnings: Object.freeze(warnings),
  });
}
