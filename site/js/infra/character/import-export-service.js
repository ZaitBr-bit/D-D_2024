// Módulo `infra/character/import-export-service`: importação/exportação de
// personagens em lote (arquivo JSON com um array), sobre o mesmo repositório
// transacional de `local-storage-character-repository.js`.
//
// Semântica de importação preservada do baseline (`site/js/store.js#importarPersonagens`):
// JSON/forma de arquivo inválido falha inteiro, sem escrever nada; dentro de
// um array válido, cada elemento é aceito/rejeitado INDIVIDUALMENTE — um
// elemento ruim nunca derruba os demais. A primeira ocorrência de um ID
// (dentro do próprio arquivo OU já existente no storage) vence; ocorrências
// posteriores do mesmo ID entram em `duplicates`, nunca são descartadas
// silenciosamente. O merge final (registros aceitos + o que já existia) é
// persistido numa ÚNICA escrita atômica via `repository.replaceAll()` — uma
// falha de escrita preserva os bytes anteriores inteiros.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { decodeCharacterRecord, encodeCharacterRecord } from './character-codec.js';

const SCOPE = 'infra.character.import-export-service';

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
 * Checagem estrutural rasa — o MESMO critério do `_validarPersonagem` do
 * `store.js` pré-Task 13 (id/nome não vazios, nivel inteiro 1-20, atributos
 * objeto). Usada para decidir REJECTED (a forma nem parece um personagem)
 * versus READ-ONLY (parece um personagem, mas o codec não conseguiu
 * decodificá-lo — ex.: nome de subclasse sem alias na tabela de migração,
 * o mesmo caso que `initialize()`/`list()` já preservam como read-only em
 * vez de perder o dado). Sem esta distinção, importar de novo um arquivo
 * exportado por este mesmo app (que já preserva bytes read-only) rejeitaria
 * silenciosamente um personagem válido que só não pôde migrar por completo.
 * @param {*} value
 * @returns {boolean}
 */
function looksLikeCharacterRecord(value) {
  if (!isPlainObject(value)) {
    return false;
  }
  if (typeof value.id !== 'string' || value.id.trim().length === 0) {
    return false;
  }
  if (typeof value.nome !== 'string' || value.nome.trim().length === 0) {
    return false;
  }
  if (typeof value.nivel !== 'number' || !Number.isFinite(value.nivel) || value.nivel < 1 || value.nivel > 20) {
    return false;
  }
  if (!isPlainObject(value.atributos)) {
    return false;
  }
  return true;
}

/**
 * Remove `_local_sync` de um registro plano bruto, sem tocar em mais nada —
 * usado para exportação/payload remoto (o marcador de sincronização é local
 * a este dispositivo, nunca deve viajar num arquivo de export nem para a
 * nuvem).
 * @param {*} rawRecord
 * @returns {*}
 */
export function stripLocalSync(rawRecord) {
  if (!isPlainObject(rawRecord) || !Object.hasOwn(rawRecord, '_local_sync')) {
    return rawRecord;
  }
  const { _local_sync, ...rest } = rawRecord;
  void _local_sync;
  return rest;
}

/**
 * Importa um lote de personagens de `jsonText` (array JSON), mesclando com o
 * que já existe no repositório numa única escrita atômica.
 * @param {string} jsonText
 * @param {{repository: object, aliasResolver: object, now: string}} context
 * @returns {import('../../core/result.js').Result} Result<CharacterImportReport, AppError>
 */
export function importCharacterRecords(jsonText, context = {}) {
  const { repository, aliasResolver, now } = context;
  if (repository === null || typeof repository !== 'object' || typeof repository.list !== 'function') {
    throw new TypeError('importCharacterRecords: context.repository é obrigatório.');
  }

  if (typeof jsonText !== 'string') {
    return err(createAppError({ code: 'CHARACTER_IMPORT_INVALID_INPUT', scope: SCOPE, message: 'O conteúdo a importar deve ser uma string.' }));
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (cause) {
    return err(createAppError({ code: 'CHARACTER_IMPORT_INVALID_JSON', scope: SCOPE, message: 'O arquivo não é JSON válido.', cause }));
  }
  if (!Array.isArray(parsed)) {
    return err(createAppError({ code: 'CHARACTER_IMPORT_INVALID_SHAPE', scope: SCOPE, message: 'O arquivo deveria conter um array de personagens.', context: { receivedType: typeof parsed } }));
  }

  const listResult = repository.list();
  if (!listResult.ok) {
    return listResult;
  }
  const { characters: existingEnvelopes, storageRevisionToken } = listResult.value;
  const existingIds = new Set(existingEnvelopes.map((envelope) => (envelope.mode === 'editable' ? envelope.character.identity.id : envelope.rawRecord?.id)).filter((id) => typeof id === 'string'));

  const imported = [];
  const duplicates = [];
  const readOnly = [];
  const rejected = [];
  const warnings = [];
  const acceptedRecords = [];
  const seenIdsInPayload = new Map(); // id -> firstIndex

  for (let index = 0; index < parsed.length; index += 1) {
    const element = parsed[index];
    const id = extractId(element);

    if (id !== null && existingIds.has(id)) {
      duplicates.push({ index, id, kind: 'existing' });
      continue;
    }
    if (id !== null && seenIdsInPayload.has(id)) {
      duplicates.push({ index, id, kind: 'payload', firstIndex: seenIdsInPayload.get(id) });
      continue;
    }

    const decodeContext = { aliasResolver, now };
    let decoded;
    let decodeThrew = null;
    try {
      decoded = decodeCharacterRecord(element, decodeContext);
    } catch (cause) {
      decodeThrew = cause;
      decoded = null;
    }

    if (decoded === null || !decoded.ok) {
      const errorInfo = decodeThrew
        ? { code: 'CHARACTER_IMPORT_DECODE_THREW', message: String(decodeThrew?.message ?? decodeThrew) }
        : { code: decoded.error.code, message: decoded.error.message };
      if (looksLikeCharacterRecord(element)) {
        // Forma plausível de personagem que não pôde ser migrada/decodificada
        // por completo (ex.: alias ausente) — preservado como read-only em
        // vez de rejeitado, pelo mesmo motivo que `initialize()`/`list()`
        // nunca perdem um registro assim.
        if (id !== null) {
          seenIdsInPayload.set(id, index);
        }
        readOnly.push({ index, id });
        acceptedRecords.push({ mode: 'read-only', rawRecord: element });
        warnings.push({ code: errorInfo.code, message: errorInfo.message, scope: 'infra.character.import-export-service', context: { index, id } });
      } else {
        rejected.push({ index, id, errors: [errorInfo] });
      }
      continue;
    }

    if (id !== null) {
      seenIdsInPayload.set(id, index);
    }

    if (decoded.value.mode === 'read-only') {
      readOnly.push({ index, id: decoded.value.rawRecord?.id ?? id });
      acceptedRecords.push({ mode: 'read-only', rawRecord: decoded.value.rawRecord });
      continue;
    }

    imported.push({ index, id: decoded.value.character.identity.id });
    acceptedRecords.push({ mode: 'editable', character: decoded.value.character, localSync: decoded.value.localSync });
    warnings.push(...(decoded.value.warnings ?? []));
  }

  if (acceptedRecords.length === 0) {
    return ok(Object.freeze({ imported: [], duplicates: Object.freeze(duplicates), readOnly: Object.freeze(readOnly), rejected: Object.freeze(rejected), warnings: Object.freeze(warnings) }));
  }

  // Merge atômico: todo registro PRÉ-EXISTENTE (editável ou read-only) é
  // reemitido byte a byte via `rawRecord`, sem passar pelo encoder v2 —
  // importar um personagem nunca pode reescrever os bytes de outro
  // personagem não relacionado já armazenado (achado do review independente
  // da Task 13: mapear pré-existentes de volta para `{mode:'editable',
  // character}` fazia `replaceAll` reencodá-los TODOS a cada import,
  // amplificando qualquer defeito do encoder — ex. `tamanho` — a todo o
  // armazenamento numa operação que deveria só tocar o que foi de fato
  // importado). Só os registros ACEITOS nesta importação (`acceptedRecords`)
  // passam pelo encoder, quando editáveis.
  const mergedRecords = [
    ...existingEnvelopes.map((envelope) => ({ mode: 'read-only', rawRecord: envelope.rawRecord })),
    ...acceptedRecords,
  ];

  const replaceResult = repository.replaceAll(mergedRecords, { expectedStorageRevisionToken: storageRevisionToken, reason: 'sync' });
  if (!replaceResult.ok) {
    return replaceResult;
  }

  return ok(Object.freeze({
    imported: Object.freeze(imported),
    duplicates: Object.freeze(duplicates),
    readOnly: Object.freeze(readOnly),
    rejected: Object.freeze(rejected),
    warnings: Object.freeze(warnings),
  }));
}

/**
 * Exporta uma lista de envelopes de personagem (editáveis e/ou read-only)
 * como texto JSON (array), no mesmo formato aceito por `importCharacterRecords`.
 * Remove `_local_sync` apenas de registros editáveis (o marcador do codec v2
 * desta app, que nunca deve viajar num arquivo de export). Registros
 * `read-only` são reemitidos byte a byte, SEM stripping — se um schema
 * futuro/passthrough legitimamente possui uma chave `_local_sync` própria,
 * ela sobrevive ao export intacta (ver `stripLocalSync`/braço `read-only`
 * abaixo).
 * @param {ReadonlyArray<object>} characters - CharacterEnvelope[]
 * @param {{aliasResolver: object}} context
 * @returns {import('../../core/result.js').Result} Result<string, AppError>
 */
export function exportCharacterRecords(characters, context = {}) {
  const { aliasResolver } = context;
  if (!Array.isArray(characters)) {
    return err(createAppError({ code: 'CHARACTER_EXPORT_INVALID_INPUT', scope: SCOPE, message: '"characters" deve ser um array de envelopes.' }));
  }

  const records = [];
  for (const envelope of characters) {
    if (!isPlainObject(envelope)) {
      return err(createAppError({ code: 'CHARACTER_EXPORT_INVALID_INPUT', scope: SCOPE, message: 'Cada item deve ser um CharacterEnvelope.' }));
    }
    if (envelope.mode === 'editable') {
      const encoded = encodeCharacterRecord(envelope.character, { aliasResolver });
      if (!encoded.ok) {
        return encoded;
      }
      // `_local_sync` só é removido no braço editável: é um marcador do
      // codec v2 (Task 12), nunca aparece num read-only (schema
      // futuro/passthrough) a não ser que o PRÓPRIO dono desse schema o
      // tenha colocado ali de propósito — nesse caso é dado dele, não do
      // nosso outbox, e precisa sobreviver export/import/replace intacto
      // (ver brief: "leitura/save local preservam o marcador validado" fala
      // do marcador DESTE codec, não de um campo homônimo de outro schema).
      records.push(stripLocalSync(encoded.value));
    } else if (envelope.mode === 'read-only') {
      records.push(envelope.rawRecord);
    } else {
      return err(createAppError({ code: 'CHARACTER_EXPORT_INVALID_INPUT', scope: SCOPE, message: `"mode" desconhecido: "${envelope.mode}".` }));
    }
  }

  return ok(JSON.stringify(records, null, 2));
}
