// Módulo `infra/sync/sync-queue`: a fila persistente de sincronização
// (localStorage -> Firestore), extraída do módulo legado `sync.js`.
//
// Ela não conhece Firebase: recebe um `gateway` já construído (ver
// `infra/firebase/firestore-character-gateway.js`), um `characterRepository`
// transacional, um `codec` já vinculado ao contexto de decodificação, e as
// portas `connectivity`/`scheduler`/`clock`. Isso a torna inteiramente
// testável em `node --test` sem rede, sem DOM e sem SDK.
//
// FORMATO PERSISTIDO (chave `dnd_sync_queue`, a MESMA da fila legada):
//
//   { "version": 2, "jobs": [ Job ], "conflicts": [ Conflict ] }
//
// A fila legada era um ARRAY puro de `{id, dados, tentativas}` (upsert) ou
// `{id, acao: "remover", tentativas}` (remoção). `initialize()` a migra
// in-place, atomicamente, na mesma chave — nunca cria uma segunda chave e
// nunca limpa os bytes antigos antes de uma escrita válida do formato novo.
// Um job legado migrado nasce JÁ CONFIRMADO (`state: "ready"`), com
// `mutationId: null` e `expectedRevisionToken: null`, porque ele nunca
// passou pelo protocolo de preparo desta tarefa; `reconcilePrepared()`
// portanto o ignora em vez de classificá-lo como conflito.
//
// IDENTIDADE DO JOB: existe no máximo UM job por `characterId` (qualquer
// operação) — a mesma semântica de coalescência da fila legada, onde
// enfileirar de novo substituía a entrada anterior do mesmo id. Disso
// decorre que `jobId` é derivado do `characterId` persistido, e não de um
// contador em memória: o `failureId` exposto no snapshot sobrevive a um
// reload da página, que é o que permite `retry(failureId)` depois de
// recarregar.
//
// ESCOPO POR `uid`: cada job registra o `uid` que o originou. Um job cujo
// `uid` divirja do usuário autenticado agora (`gateway.uid`) — OU que não
// registre uid nenhum — é posto em QUARENTENA: não é enviado (jamais para o
// `users/{uid}/personagens` do novo usuário) e não é descartado (o dono
// original pode voltar a logar e recuperá-lo). Ele aparece no snapshot como
// falha não-retryable. Ausência de uid é tratada como procedência
// desconhecida, nunca como "meu" (ver `belongsToCurrentUser`).

import { ok, err } from '../../core/result.js';
import { createAppError, createAppWarning } from '../../core/errors.js';
import { mergeCharacterRecords } from './merge-character-records.js';

const SCOPE = 'infra.sync.sync-queue';

export const SYNC_QUEUE_KEY = 'dnd_sync_queue';

const QUEUE_FORMAT_VERSION = 2;
const RETRY_DELAY_MS = 5000;

// Códigos de falha que NUNCA se resolvem sozinhos numa nova tentativa
// idêntica: exigem uma ação externa (outro login, corrigir o registro,
// revisar permissões). Marcá-los como retryable produziria um laço de
// retentativa infinito e inútil.
const NON_RETRYABLE_CODES = new Set([
  'SYNC_JOB_FOREIGN_UID',
  'SYNC_JOB_UNSENDABLE_SCHEMA',
  'SYNC_UPSERT_SOURCE_MISSING',
  'SYNC_PREPARED_MUTATION_CONFLICT',
  'SYNC_PREPARED_ABORT_UNPERSISTED',
  'REMOTE_PERMISSION_DENIED',
]);

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {*} [cause]
 * @returns {object}
 */
function queueError(code, message, context = {}, cause = undefined) {
  return createAppError({ code, scope: SCOPE, message, context, cause });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deriva o `jobId`/`failureId` a partir da identidade PERSISTIDA do job (o
 * `characterId`), nunca de um contador em memória — é isso que faz o
 * `failureId` sobreviver a um reload.
 * @param {string} characterId
 * @returns {string}
 */
function jobIdFor(characterId) {
  return `job:${characterId}`;
}

/**
 * Extrai o id do personagem de um envelope, sem inventar valor.
 * @param {*} envelope
 * @returns {string|null}
 */
function envelopeCharacterId(envelope) {
  const candidates = [envelope?.character?.identity?.id, envelope?.rawRecord?.id, envelope?.characterId];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return null;
}

/**
 * Extrai `atualizado_em` de um envelope PRESERVANDO a ausência (`null`
 * explícito, nunca um default plausível como "agora" ou a época).
 * @param {*} envelope
 * @returns {string|null}
 */
function envelopeUpdatedAt(envelope) {
  const canonical = envelope?.character?.metadata?.updatedAt;
  if (typeof canonical === 'string') {
    return canonical;
  }
  const flat = envelope?.rawRecord?.atualizado_em;
  return typeof flat === 'string' ? flat : null;
}

/**
 * Cria a fila de sincronização.
 * @param {{
 *   storage: Storage,
 *   gateway: {uid: string, list: Function, upsert: Function, remove: Function},
 *   characterRepository: {list: Function, get: Function, replaceAll: Function},
 *   connectivity: {isOnline: () => boolean},
 *   scheduler: {schedule: Function, cancel: Function},
 *   codec: {decode: (rawRecord: *) => object},
 *   clock?: {now: () => string},
 * }} params
 * @returns {Readonly<object>}
 */
export function createSyncQueue({ storage, gateway, characterRepository, connectivity, scheduler, codec, clock } = {}) {
  if (!isPlainObject(storage) || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new TypeError('createSyncQueue: "storage" deve implementar getItem/setItem.');
  }
  if (gateway === null || typeof gateway !== 'object' || typeof gateway.upsert !== 'function') {
    throw new TypeError('createSyncQueue: "gateway" é obrigatório.');
  }
  if (characterRepository === null || typeof characterRepository !== 'object' || typeof characterRepository.get !== 'function') {
    throw new TypeError('createSyncQueue: "characterRepository" é obrigatório.');
  }
  if (connectivity === null || typeof connectivity !== 'object' || typeof connectivity.isOnline !== 'function') {
    throw new TypeError('createSyncQueue: "connectivity" é obrigatório.');
  }
  if (scheduler === null || typeof scheduler !== 'object' || typeof scheduler.schedule !== 'function') {
    throw new TypeError('createSyncQueue: "scheduler" é obrigatório.');
  }
  if (codec === null || typeof codec !== 'object' || typeof codec.decode !== 'function') {
    throw new TypeError('createSyncQueue: "codec" é obrigatório.');
  }

  const now = typeof clock?.now === 'function' ? clock.now : () => new Date().toISOString();

  /** @type {Array<object>} jobs em memória (espelho do que foi persistido) */
  let jobs = [];
  /** @type {Array<object>} conflitos de merge retidos (não são jobs) */
  let conflicts = [];
  /** @type {Array<object>} diagnósticos da última initialize/reconciliação */
  let diagnostics = [];
  let listeners = [];
  let initialized = false;
  let disposed = false;
  let lastSyncedAt = null;
  let inFlightFlush = null;
  let retryHandle = null;
  /**
   * Estado que cada preparo DESLOCOU da fila, para que `abortPrepared` possa
   * devolvê-lo intacto (`Map<preparationId, jobAnterior|null>`). É memória de
   * sessão de propósito: um preparo que não chega a ser abortado porque a aba
   * morreu no meio é justamente o caso que `reconcilePrepared()` resolve no
   * próximo boot, lendo o repositório. Persistir o rollback só criaria uma
   * segunda fonte de verdade sobre o mesmo fato.
   * @type {Map<string, object|null>}
   */
  const preparoDeslocou = new Map();

  /**
   * O `uid` do usuário autenticado AGORA. Toda decisão de envio/quarentena
   * é tomada contra este valor, lido no momento do uso (nunca capturado no
   * construtor), para que um gateway trocado após login não deixe um valor
   * obsoleto para trás.
   * @returns {string|null}
   */
  function currentUid() {
    return typeof gateway.uid === 'string' && gateway.uid.length > 0 ? gateway.uid : null;
  }

  // --- Persistência ------------------------------------------------------

  /**
   * Serializa o estado atual da fila no formato persistido v2.
   * @param {Array<object>} nextJobs
   * @param {Array<object>} nextConflicts
   * @returns {string}
   */
  function serialize(nextJobs, nextConflicts) {
    return JSON.stringify({ version: QUEUE_FORMAT_VERSION, jobs: nextJobs, conflicts: nextConflicts });
  }

  /**
   * Persiste `nextJobs`/`nextConflicts` e SÓ ENTÃO adota o novo estado em
   * memória. Se a escrita falhar (ex.: quota), nada muda — nem em disco nem
   * em memória —, de modo que um `enqueue` que retornou erro nunca deixa uma
   * pendência fantasma que o snapshot mostraria como enfileirada.
   * @param {Array<object>} nextJobs
   * @param {Array<object>} [nextConflicts]
   * @returns {import('../../core/result.js').Result} Result<void, AppError>
   */
  function commit(nextJobs, nextConflicts = conflicts) {
    const text = serialize(nextJobs, nextConflicts);
    const stored = storage.getItem(SYNC_QUEUE_KEY);
    // Uma fila vazia não deixa rastro: se a chave ainda não existe e não há
    // nada a persistir, `initialize()` não a cria. Isso preserva o
    // comportamento legado (a chave só aparece quando há pendência real) e
    // evita que uma operação recusada — que não persistiu nada — pareça ter
    // escrito na fila.
    const nadaAPersistir = nextJobs.length === 0 && nextConflicts.length === 0;
    const chaveAusente = stored === null || stored === undefined || stored === '';
    if (nadaAPersistir && chaveAusente) {
      jobs = nextJobs;
      conflicts = nextConflicts;
      notify();
      return ok(undefined);
    }
    if (text !== stored) {
      try {
        storage.setItem(SYNC_QUEUE_KEY, text);
      } catch (cause) {
        return err(
          queueError(
            'SYNC_QUEUE_WRITE_FAILED',
            'Não foi possível persistir a fila de sincronização; a operação foi abortada sem efeito.',
            { causeMessage: String(cause?.message ?? cause) },
            cause,
          ),
        );
      }
    }
    jobs = nextJobs;
    conflicts = nextConflicts;
    notify();
    return ok(undefined);
  }

  // --- Snapshot ----------------------------------------------------------

  /**
   * Monta a lista de falhas atual: quarentena por `uid` divergente, erros
   * retidos nos jobs e conflitos de merge. Nenhuma dessas categorias é
   * descartada em silêncio — todas viram uma entrada visível no snapshot.
   * @returns {Array<object>}
   */
  function buildFailures() {
    const failures = [];

    for (const job of jobs) {
      if (!belongsToCurrentUser(job)) {
        failures.push(
          Object.freeze({
            failureId: job.jobId,
            characterId: job.characterId,
            operation: job.operation,
            code: 'SYNC_JOB_FOREIGN_UID',
            retryable: false,
            occurredAt: job.lastError?.occurredAt ?? null,
          }),
        );
        continue;
      }
      if (job.lastError) {
        failures.push(
          Object.freeze({
            failureId: job.jobId,
            characterId: job.characterId,
            operation: job.operation,
            code: job.lastError.code,
            retryable: job.lastError.retryable,
            occurredAt: job.lastError.occurredAt,
          }),
        );
      }
    }

    for (const conflict of conflicts) {
      failures.push(
        Object.freeze({
          failureId: conflict.failureId,
          characterId: conflict.characterId,
          operation: 'merge',
          code: conflict.code,
          retryable: true,
          occurredAt: conflict.occurredAt,
        }),
      );
    }

    return failures;
  }

  /**
   * Um job só é candidato a envio se estiver confirmado (`ready`) e
   * pertencer ao usuário autenticado agora.
   * @param {object} job
   * @returns {boolean}
   */
  function isSendable(job) {
    if (job.state !== 'ready') {
      return false;
    }
    return belongsToCurrentUser(job);
  }

  /**
   * ÚNICO ponto de decisão do escopo por `uid` (envio, contagem do snapshot,
   * quarentena e `retry` passam todos por aqui).
   *
   * FAIL-CLOSED em `job.uid === null`: um job sem origem registrada NÃO é
   * tratado como do usuário atual. O brief exige que cada job persistido
   * registre o uid que o originou; um job que chega sem esse campo (ou com
   * um valor inválido — ver `normalizeStoredJob`) é um job de PROCEDÊNCIA
   * DESCONHECIDA, e enviá-lo significaria empurrar o personagem de alguém
   * para `users/{uid}/personagens` do usuário logado agora. Ele cai na
   * MESMA quarentena de um uid divergente: nunca enviado, nunca descartado,
   * sempre visível no snapshot como falha não-retryable.
   *
   * A única exceção é não haver usuário autenticado (`currentUid() ===
   * null`): aí não existe "usuário atual" contra quem comparar, nada vai à
   * rede de qualquer forma (o gateway não tem uid), e classificar tudo como
   * alheio só produziria falhas fantasmas no snapshot.
   * @param {object} job
   * @returns {boolean}
   */
  function belongsToCurrentUser(job) {
    const uid = currentUid();
    if (uid === null) {
      return true;
    }
    return job.uid === uid;
  }

  /**
   * Constrói o snapshot congelado, com o mapeamento determinístico de
   * status descrito no brief: falhas dominam; senão offline; senão
   * pendência/preparo; senão ok.
   * @returns {Readonly<object>}
   */
  function buildSnapshot() {
    const failures = buildFailures();
    const pending = jobs.filter((job) => job.state === 'ready' && belongsToCurrentUser(job)).length;
    const prepared = jobs.filter((job) => job.state === 'prepared' && belongsToCurrentUser(job)).length;

    let status;
    if (!initialized) {
      status = 'idle';
    } else if (failures.length > 0) {
      status = 'erro';
    } else if (!connectivity.isOnline()) {
      status = 'offline';
    } else if (pending > 0 || prepared > 0) {
      status = 'sincronizando';
    } else {
      status = 'ok';
    }

    return Object.freeze({
      status,
      pending,
      prepared,
      failures: Object.freeze(failures),
      lastSyncedAt,
    });
  }

  /** Notifica os assinantes na ordem exata de registro. */
  function notify() {
    const snapshot = buildSnapshot();
    for (const listener of [...listeners]) {
      try {
        listener(snapshot);
      } catch (cause) {
        // Um assinante que lança (bug de UI) não pode derrubar a fila nem
        // impedir os assinantes seguintes de receberem o snapshot.
        console.warn('[sync-queue] assinante lançou durante a notificação:', cause?.message ?? cause);
      }
    }
  }

  /**
   * Registra um diagnóstico (nunca um descarte silencioso) da fase atual.
   * @param {'migration'|'reconcile'} phase
   * @param {string} code
   * @param {string} message
   * @param {object} context
   */
  function addDiagnostic(phase, code, message, context) {
    const warning = createAppWarning({ code, scope: SCOPE, message, context });
    diagnostics.push(Object.freeze({ phase, ...warning, code, message }));
  }

  // --- Carga e migração --------------------------------------------------

  /**
   * Converte uma entrada da fila LEGADA (`{id, dados, tentativas}` ou
   * `{id, acao: "remover"}`) num job v2 já confirmado.
   * @param {*} entry
   * @returns {object|null} job, ou null se a entrada não tiver id.
   */
  function migrateLegacyEntry(entry) {
    const id = entry?.id;
    if (typeof id !== 'string' || id.length === 0) {
      return null;
    }
    const isRemoval = entry?.acao === 'remover';
    return {
      jobId: jobIdFor(id),
      // A fila legada não registrava o `uid` de origem — não existe
      // informação para fazer melhor do que atribuir o usuário autenticado
      // no momento da migração (o `enfileirarSync` legado só enfileirava
      // com alguém logado). O fato é registrado como diagnóstico, nunca
      // presumido em silêncio.
      uid: currentUid(),
      operation: isRemoval ? 'remove' : 'upsert',
      characterId: id,
      record: isRemoval ? null : (isPlainObject(entry?.dados) ? entry.dados : null),
      updatedAt: typeof entry?.dados?.atualizado_em === 'string' ? entry.dados.atualizado_em : null,
      mutationId: null,
      expectedRevisionToken: null,
      state: 'ready',
      attempts: Number.isInteger(entry?.tentativas) ? entry.tentativas : 0,
      legacyAdopted: true,
      lastError: null,
    };
  }

  /**
   * Normaliza um job já no formato v2 lido do storage, rejeitando formas
   * impossíveis em vez de silenciosamente "consertá-las".
   * @param {*} raw
   * @returns {object|null}
   */
  function normalizeStoredJob(raw) {
    if (!isPlainObject(raw)) {
      return null;
    }
    const characterId = raw.characterId;
    if (typeof characterId !== 'string' || characterId.length === 0) {
      return null;
    }
    if (raw.operation !== 'upsert' && raw.operation !== 'remove') {
      return null;
    }
    return {
      jobId: typeof raw.jobId === 'string' && raw.jobId.length > 0 ? raw.jobId : jobIdFor(characterId),
      uid: typeof raw.uid === 'string' && raw.uid.length > 0 ? raw.uid : null,
      operation: raw.operation,
      characterId,
      record: isPlainObject(raw.record) ? raw.record : null,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
      mutationId: typeof raw.mutationId === 'string' && raw.mutationId.length > 0 ? raw.mutationId : null,
      expectedRevisionToken:
        typeof raw.expectedRevisionToken === 'string' && raw.expectedRevisionToken.length > 0
          ? raw.expectedRevisionToken
          : null,
      state: raw.state === 'prepared' ? 'prepared' : 'ready',
      attempts: Number.isInteger(raw.attempts) ? raw.attempts : 0,
      legacyAdopted: raw.legacyAdopted === true,
      lastError: isPlainObject(raw.lastError) ? raw.lastError : null,
    };
  }

  /**
   * Lê e interpreta os bytes atuais da chave. Corrupção NUNCA é tratada
   * como fila vazia (isso apagaria pendências reais do usuário) — é sempre
   * um erro, e os bytes originais ficam intactos.
   * @returns {import('../../core/result.js').Result} Result<{jobs, conflicts, migrated}, AppError>
   */
  function loadFromStorage() {
    const raw = storage.getItem(SYNC_QUEUE_KEY);
    if (raw === null || raw === undefined || raw === '') {
      return ok({ jobs: [], conflicts: [], migrated: false });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      return err(
        queueError(
          'SYNC_QUEUE_CORRUPT_JSON',
          `"${SYNC_QUEUE_KEY}" não é JSON válido; a fila não foi carregada e os bytes originais foram preservados.`,
          {},
          cause,
        ),
      );
    }

    if (Array.isArray(parsed)) {
      const migratedJobs = [];
      for (const entry of parsed) {
        const job = migrateLegacyEntry(entry);
        if (job === null) {
          addDiagnostic(
            'migration',
            'SYNC_QUEUE_LEGACY_ENTRY_WITHOUT_ID',
            'Entrada da fila legada sem "id" utilizável; não foi possível migrá-la para um job.',
            { entry: isPlainObject(entry) ? Object.keys(entry) : typeof entry },
          );
          continue;
        }
        // Coalescência por characterId, igual à fila legada (uma entrada
        // por id): a última entrada do array legado vence.
        const existing = migratedJobs.findIndex((candidate) => candidate.characterId === job.characterId);
        if (existing === -1) {
          migratedJobs.push(job);
        } else {
          migratedJobs[existing] = job;
        }
      }
      if (migratedJobs.length > 0) {
        addDiagnostic(
          'migration',
          'SYNC_QUEUE_LEGACY_MIGRATED',
          'Fila legada migrada para o formato v2; os jobs herdaram o uid do usuário autenticado no momento da migração (a fila legada não registrava origem).',
          { count: migratedJobs.length, uid: currentUid() },
        );
      }
      return ok({ jobs: migratedJobs, conflicts: [], migrated: true });
    }

    if (!isPlainObject(parsed) || parsed.version !== QUEUE_FORMAT_VERSION || !Array.isArray(parsed.jobs)) {
      return err(
        queueError(
          'SYNC_QUEUE_UNKNOWN_SHAPE',
          `"${SYNC_QUEUE_KEY}" não está no formato legado (array) nem no formato v2 ({version, jobs}); nada foi carregado nem apagado.`,
          { receivedVersion: isPlainObject(parsed) ? parsed.version ?? null : null },
        ),
      );
    }

    const loaded = [];
    for (const raw2 of parsed.jobs) {
      const job = normalizeStoredJob(raw2);
      if (job === null) {
        addDiagnostic('migration', 'SYNC_QUEUE_JOB_UNREADABLE', 'Job persistido em formato irreconhecível; ignorado nesta sessão.', {
          shape: isPlainObject(raw2) ? Object.keys(raw2) : typeof raw2,
        });
        continue;
      }
      loaded.push(job);
    }

    const loadedConflicts = Array.isArray(parsed.conflicts)
      ? parsed.conflicts.filter((c) => isPlainObject(c) && typeof c.failureId === 'string')
      : [];

    return ok({ jobs: loaded, conflicts: loadedConflicts, migrated: false });
  }

  // --- API pública -------------------------------------------------------

  /**
   * Carrega/migra a fila persistida e reconcilia os jobs preparados.
   * Idempotente: chamar duas vezes não duplica jobs nem reescreve os bytes.
   * @returns {import('../../core/result.js').Result} Result<SyncSnapshot, AppError>
   */
  function initialize() {
    if (disposed) {
      return err(queueError('SYNC_QUEUE_DISPOSED', 'A fila já foi descartada.'));
    }
    diagnostics = [];

    const loaded = loadFromStorage();
    if (!loaded.ok) {
      return loaded;
    }

    jobs = loaded.value.jobs;
    conflicts = loaded.value.conflicts;
    initialized = true;

    const reconciled = reconcileInternal();
    if (!reconciled.ok) {
      return reconciled;
    }

    // Persiste só se a forma canônica divergir dos bytes atuais (migração
    // legada, normalização ou promoção/descarte de preparados). Sem isso,
    // um `initialize()` repetido reescreveria o storage sem necessidade.
    const commitResult = commit(jobs, conflicts);
    if (!commitResult.ok) {
      return commitResult;
    }

    return ok(buildSnapshot());
  }

  /**
   * Enfileira (ou coalesce) um upsert a partir de um envelope do
   * repositório. Só retorna sucesso DEPOIS de a fila estar persistida.
   * @param {object} characterEnvelope
   * @returns {import('../../core/result.js').Result} Result<{jobId, snapshot}, AppError>
   */
  function enqueueUpsert(characterEnvelope) {
    if (disposed) {
      return err(queueError('SYNC_QUEUE_DISPOSED', 'A fila já foi descartada.'));
    }
    if (characterEnvelope?.mode === 'read-only') {
      return err(
        queueError(
          'SYNC_UPSERT_READ_ONLY_ENVELOPE',
          'Um envelope somente-leitura (schema futuro ou falha de decode) nunca pode ser enviado: o encoder reduziria um schema que não entende.',
          { characterId: envelopeCharacterId(characterEnvelope) },
        ),
      );
    }
    const characterId = envelopeCharacterId(characterEnvelope);
    if (characterId === null) {
      return err(queueError('SYNC_UPSERT_INVALID_ENVELOPE', 'O envelope a enfileirar precisa de um id de personagem.'));
    }

    return upsertJob({
      jobId: jobIdFor(characterId),
      uid: currentUid(),
      operation: 'upsert',
      characterId,
      record: isPlainObject(characterEnvelope?.rawRecord) ? characterEnvelope.rawRecord : null,
      updatedAt: envelopeUpdatedAt(characterEnvelope),
      mutationId: null,
      expectedRevisionToken: null,
      state: 'ready',
      attempts: 0,
      legacyAdopted: false,
      lastError: null,
    });
  }

  /**
   * Enfileira a remoção remota de um personagem, cancelando qualquer upsert
   * pendente do mesmo id (a remoção é sempre a intenção mais recente).
   * @param {{characterId: string, updatedAt?: string|null}} params
   * @returns {import('../../core/result.js').Result} Result<{jobId, snapshot}, AppError>
   */
  function enqueueRemoval({ characterId, updatedAt = null } = {}) {
    if (disposed) {
      return err(queueError('SYNC_QUEUE_DISPOSED', 'A fila já foi descartada.'));
    }
    if (typeof characterId !== 'string' || characterId.length === 0) {
      return err(queueError('SYNC_REMOVAL_INVALID_INPUT', '"characterId" é obrigatório para enfileirar uma remoção.'));
    }

    return upsertJob({
      jobId: jobIdFor(characterId),
      uid: currentUid(),
      operation: 'remove',
      characterId,
      record: null,
      updatedAt: typeof updatedAt === 'string' ? updatedAt : null,
      mutationId: null,
      expectedRevisionToken: null,
      state: 'ready',
      attempts: 0,
      legacyAdopted: false,
      lastError: null,
    });
  }

  /**
   * Insere ou substitui o job do `characterId` (no máximo um por
   * personagem) e persiste antes de retornar.
   * @param {object} job
   * @returns {import('../../core/result.js').Result} Result<{jobId, snapshot}, AppError>
   */
  function upsertJob(job) {
    const nextJobs = [...jobs];
    const index = nextJobs.findIndex((candidate) => candidate.characterId === job.characterId);
    if (index === -1) {
      nextJobs.push(job);
    } else {
      nextJobs[index] = job;
    }

    const commitResult = commit(nextJobs);
    if (!commitResult.ok) {
      return commitResult;
    }
    return ok(Object.freeze({ jobId: job.jobId, snapshot: buildSnapshot() }));
  }

  /**
   * Grava um job `prepared` (não enviável) ANTES de a mutação local ser
   * tentada. No máximo um preparo por `characterId`: uma segunda preparação
   * coalesce sobre a existente em vez de criar um job irmão (duas gravações
   * offline seguidas do mesmo personagem não podem virar conflito espúrio).
   * @param {{mutationId: string, operation: string, character?: object, characterId: string, expectedRevisionToken: string|null}} params
   * @returns {import('../../core/result.js').Result} Result<{preparationId, snapshot}, AppError>
   */
  function prepareMutation({ mutationId, operation, character, characterId, expectedRevisionToken = null } = {}) {
    if (disposed) {
      return err(queueError('SYNC_QUEUE_DISPOSED', 'A fila já foi descartada.'));
    }
    if (typeof mutationId !== 'string' || mutationId.length === 0) {
      return err(queueError('SYNC_PREPARE_INVALID_INPUT', '"mutationId" é obrigatório.'));
    }
    if (operation !== 'upsert' && operation !== 'remove') {
      return err(queueError('SYNC_PREPARE_INVALID_INPUT', '"operation" deve ser "upsert" ou "remove".', { operation }));
    }
    const id = typeof characterId === 'string' && characterId.length > 0 ? characterId : character?.identity?.id;
    if (typeof id !== 'string' || id.length === 0) {
      return err(queueError('SYNC_PREPARE_INVALID_INPUT', '"characterId" é obrigatório.'));
    }

    const nextJobs = [...jobs];
    const index = nextJobs.findIndex((candidate) => candidate.characterId === id);
    const job = {
      jobId: jobIdFor(id),
      uid: currentUid(),
      operation,
      characterId: id,
      // Um job do protocolo preparado NÃO guarda uma cópia do registro: no
      // `flush` ele relê o estado atual do repositório, que é a fonte de
      // verdade adotada. Assim nunca se envia um instantâneo obsoleto.
      record: null,
      updatedAt: typeof character?.metadata?.updatedAt === 'string' ? character.metadata.updatedAt : null,
      mutationId,
      expectedRevisionToken: typeof expectedRevisionToken === 'string' ? expectedRevisionToken : null,
      state: 'prepared',
      attempts: 0,
      legacyAdopted: false,
      lastError: null,
    };
    const deslocado = index === -1 ? null : nextJobs[index];
    if (index === -1) {
      nextJobs.push(job);
    } else {
      nextJobs[index] = job;
    }

    const commitResult = commit(nextJobs);
    if (!commitResult.ok) {
      return commitResult;
    }
    // Registra o que este preparo deslocou, para um `abortPrepared` fiel.
    // Um preparo que coalesce sobre OUTRO preparo não pode virar o alvo do
    // rollback (restaurá-lo devolveria um job `prepared` órfão): nesse caso
    // preserva-se o alvo registrado pelo preparo anterior.
    if (!(deslocado !== null && deslocado.state === 'prepared' && preparoDeslocou.has(job.jobId))) {
      preparoDeslocou.set(job.jobId, deslocado !== null && deslocado.state === 'prepared' ? null : deslocado);
    }
    return ok(Object.freeze({ preparationId: job.jobId, snapshot: buildSnapshot() }));
  }

  /**
   * DESFAZ um preparo cuja mutação local não aconteceu, restaurando
   * exatamente o job que ele deslocou (um `ready` já confirmado, por
   * exemplo) ou removendo o job quando não havia nenhum.
   *
   * Existe porque a alternativa — deixar o `prepared` órfão na fila até o
   * próximo boot — REBAIXA silenciosamente um job já confirmado: o snapshot
   * o contaria como `prepared`, o que mapeia para o status "sincronizando",
   * e o usuário veria um spinner permanente sem falha visível pelo resto da
   * sessão, enquanto o envio já confirmado deixaria de acontecer.
   * @param {string} preparationId
   * @returns {import('../../core/result.js').Result} Result<{jobId, snapshot}, AppError>
   */
  function abortPrepared(preparationId) {
    if (disposed) {
      return err(queueError('SYNC_QUEUE_DISPOSED', 'A fila já foi descartada.'));
    }
    const index = jobs.findIndex((job) => job.jobId === preparationId && job.state === 'prepared');
    if (index === -1) {
      return err(
        queueError('SYNC_PREPARATION_NOT_FOUND', 'Não há preparação pendente com este identificador.', { preparationId }),
      );
    }

    const anterior = preparoDeslocou.get(preparationId) ?? null;
    const nextJobs = [...jobs];
    if (anterior === null) {
      nextJobs.splice(index, 1);
    } else {
      nextJobs[index] = anterior;
    }

    const commitResult = commit(nextJobs);
    if (!commitResult.ok) {
      // Não deu para persistir o rollback (ex.: quota). O preparo órfão
      // continua em disco e será reclassificado no próximo boot — mas ele
      // NÃO pode ficar invisível até lá: marca-se a falha em memória agora,
      // para que o snapshot vire "erro" imediatamente em vez de
      // "sincronizando" para sempre. Não-retryable de propósito: repetir o
      // envio não conserta um preparo que nunca teve efeito local.
      jobs = jobs.map((job) =>
        job.jobId === preparationId
          ? {
              ...job,
              lastError: {
                code: 'SYNC_PREPARED_ABORT_UNPERSISTED',
                message:
                  'A mutação local falhou e o cancelamento do preparo não pôde ser persistido; este item não será enviado até ser reconciliado.',
                retryable: false,
                occurredAt: now(),
              },
            }
          : job,
      );
      notify();
      return commitResult;
    }

    preparoDeslocou.delete(preparationId);
    return ok(Object.freeze({ jobId: preparationId, snapshot: buildSnapshot() }));
  }

  /**
   * Confirma um job preparado, tornando-o enviável. Chamado apenas DEPOIS
   * de a mutação local ter sido adotada com sucesso.
   * @param {string} preparationId
   * @returns {import('../../core/result.js').Result} Result<{jobId, snapshot}, AppError>
   */
  function confirmPrepared(preparationId) {
    if (disposed) {
      return err(queueError('SYNC_QUEUE_DISPOSED', 'A fila já foi descartada.'));
    }
    const index = jobs.findIndex((job) => job.jobId === preparationId && job.state === 'prepared');
    if (index === -1) {
      return err(
        queueError('SYNC_PREPARATION_NOT_FOUND', 'Não há preparação pendente com este identificador.', { preparationId }),
      );
    }

    const nextJobs = [...jobs];
    nextJobs[index] = { ...nextJobs[index], state: 'ready' };
    const commitResult = commit(nextJobs);
    if (!commitResult.ok) {
      return commitResult;
    }
    // Confirmado: não há mais o que desfazer deste preparo.
    preparoDeslocou.delete(preparationId);
    return ok(Object.freeze({ jobId: preparationId, snapshot: buildSnapshot() }));
  }

  /**
   * Decide o destino de cada job `prepared` comparando o intent registrado
   * com o estado REAL do repositório: promove (a mutação local aconteceu),
   * descarta (não aconteceu — nada a enviar) ou classifica como conflito
   * (outra mutação passou por cima). Jobs legados (`mutationId === null`)
   * são pulados: eles nunca passaram por este protocolo.
   * @returns {import('../../core/result.js').Result} Result<void, AppError>
   */
  function reconcileInternal() {
    diagnostics = diagnostics.filter((d) => d.phase !== 'reconcile');
    const nextJobs = [];

    for (const job of jobs) {
      if (job.state !== 'prepared' || job.mutationId === null) {
        nextJobs.push(job);
        continue;
      }

      const current = characterRepository.get(job.characterId);
      if (!current.ok) {
        // Sem conseguir ler o repositório não há como decidir: o job
        // permanece preparado (não enviável) para uma tentativa futura.
        addDiagnostic('reconcile', 'SYNC_PREPARED_UNDECIDABLE', 'Não foi possível ler o repositório para reconciliar o job preparado.', {
          characterId: job.characterId,
          cause: current.error?.code ?? null,
        });
        nextJobs.push(job);
        continue;
      }

      const envelope = current.value;

      if (job.operation === 'upsert') {
        if (envelope === null) {
          // O save local nunca aconteceu: não há estado adotado a
          // propagar. Descartar é a decisão correta e completa — e fica
          // registrada como diagnóstico, nunca como um `continue` mudo.
          addDiagnostic('reconcile', 'SYNC_PREPARED_DISCARDED_NO_LOCAL_EFFECT', 'Preparo de upsert descartado: o personagem não existe localmente, então o save nunca foi adotado.', {
            characterId: job.characterId,
            mutationId: job.mutationId,
          });
          continue;
        }
        if (envelope.localSync?.lastMutationId === job.mutationId) {
          nextJobs.push({ ...job, state: 'ready' });
          continue;
        }
        nextJobs.push({
          ...job,
          state: 'prepared',
          lastError: {
            code: 'SYNC_PREPARED_MUTATION_CONFLICT',
            message: 'O registro local carrega outro marcador de mutação: houve uma gravação concorrente depois deste preparo.',
            retryable: false,
            occurredAt: now(),
          },
        });
        continue;
      }

      // operation === 'remove': a confirmação é a AUSÊNCIA do registro que
      // possuía o revision token esperado.
      if (envelope === null) {
        nextJobs.push({ ...job, state: 'ready' });
        continue;
      }
      if (envelope.revisionToken === job.expectedRevisionToken) {
        addDiagnostic('reconcile', 'SYNC_PREPARED_DISCARDED_NO_LOCAL_EFFECT', 'Preparo de remoção descartado: o registro continua local e intacto, então a remoção nunca foi adotada.', {
          characterId: job.characterId,
          mutationId: job.mutationId,
        });
        continue;
      }
      nextJobs.push({
        ...job,
        state: 'prepared',
        lastError: {
          code: 'SYNC_PREPARED_MUTATION_CONFLICT',
          message: 'O registro local foi reescrito por outra gravação depois deste preparo de remoção.',
          retryable: false,
          occurredAt: now(),
        },
      });
    }

    jobs = nextJobs;
    return ok(undefined);
  }

  /**
   * Reconcilia os jobs preparados e persiste o resultado.
   * @returns {import('../../core/result.js').Result} Result<SyncSnapshot, AppError>
   */
  function reconcilePrepared() {
    if (disposed) {
      return err(queueError('SYNC_QUEUE_DISPOSED', 'A fila já foi descartada.'));
    }
    const reconciled = reconcileInternal();
    if (!reconciled.ok) {
      return reconciled;
    }
    const commitResult = commit(jobs, conflicts);
    if (!commitResult.ok) {
      return commitResult;
    }
    return ok(buildSnapshot());
  }

  /**
   * Resolve o envelope a enviar para um job de upsert. Jobs do protocolo
   * preparado releem o repositório (fonte de verdade); jobs legados/diretos
   * passam o registro persistido pelo codec, migrando v1->v2 antes do envio.
   * @param {object} job
   * @returns {import('../../core/result.js').Result} Result<object, AppError>
   */
  function resolveUpsertEnvelope(job) {
    if (job.record !== null) {
      const decoded = codec.decode(job.record);
      if (!decoded.ok) {
        return err(
          queueError(
            'SYNC_JOB_UNSENDABLE_SCHEMA',
            'O registro guardado neste job não pôde ser decodificado; ele fica retido para inspeção e nunca é enviado.',
            { characterId: job.characterId, cause: decoded.error?.code ?? null },
          ),
        );
      }
      if (decoded.value.mode !== 'editable') {
        return err(
          queueError(
            'SYNC_JOB_UNSENDABLE_SCHEMA',
            'O registro guardado neste job é somente-leitura (schema futuro); enviá-lo reduziria um schema desconhecido.',
            { characterId: job.characterId },
          ),
        );
      }
      return ok(decoded.value);
    }

    const current = characterRepository.get(job.characterId);
    if (!current.ok) {
      return err(
        queueError('SYNC_UPSERT_SOURCE_MISSING', 'Não foi possível ler o personagem a enviar no repositório local.', {
          characterId: job.characterId,
          cause: current.error?.code ?? null,
        }),
      );
    }
    if (current.value === null) {
      return err(
        queueError(
          'SYNC_UPSERT_SOURCE_MISSING',
          'O personagem deste job não existe mais localmente; o job fica retido para inspeção em vez de ser descartado.',
          { characterId: job.characterId },
        ),
      );
    }
    if (current.value.mode !== 'editable') {
      return err(
        queueError('SYNC_JOB_UNSENDABLE_SCHEMA', 'O personagem local está em modo somente-leitura e não pode ser enviado.', {
          characterId: job.characterId,
        }),
      );
    }
    return ok(current.value);
  }

  /**
   * Converte um AppError em `lastError` persistível, classificando a
   * retentabilidade por código (nunca por adivinhação de mensagem).
   * @param {object} error
   * @returns {object}
   */
  function toLastError(error) {
    const code = typeof error?.code === 'string' ? error.code : 'SYNC_UNKNOWN_ERROR';
    return {
      code,
      message: typeof error?.message === 'string' ? error.message : 'Falha desconhecida na sincronização.',
      retryable: !NON_RETRYABLE_CODES.has(code),
      occurredAt: now(),
    };
  }

  /**
   * Envia todos os jobs confirmados do usuário atual, um a um, persistindo
   * o resultado de cada um. Chamadas concorrentes são coalescidas numa
   * única passada de rede.
   * @returns {Promise<import('../../core/result.js').Result>} Promise<Result<SyncSnapshot, AppError>>
   */
  function flush() {
    if (disposed) {
      return Promise.resolve(err(queueError('SYNC_QUEUE_DISPOSED', 'A fila já foi descartada.')));
    }
    if (inFlightFlush !== null) {
      return inFlightFlush;
    }
    inFlightFlush = runFlush().finally(() => {
      inFlightFlush = null;
    });
    return inFlightFlush;
  }

  /**
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  async function runFlush() {
    if (!connectivity.isOnline()) {
      // Offline não é falha: nada vai à rede e nenhum job é alterado.
      return ok(buildSnapshot());
    }

    const sendable = jobs.filter(isSendable);
    let houveSucesso = false;

    for (const job of sendable) {
      if (disposed) {
        break;
      }
      // Relê o job do estado atual: uma escrita anterior deste mesmo laço
      // pode tê-lo removido ou substituído.
      const currentJob = jobs.find((candidate) => candidate.jobId === job.jobId);
      if (currentJob === undefined || !isSendable(currentJob)) {
        continue;
      }

      let outcome;
      if (currentJob.operation === 'upsert') {
        const envelope = resolveUpsertEnvelope(currentJob);
        outcome = envelope.ok ? await gateway.upsert(envelope.value) : envelope;
      } else {
        outcome = await gateway.remove(currentJob.characterId);
      }

      if (outcome.ok) {
        houveSucesso = true;
        commit(jobs.filter((candidate) => candidate.jobId !== currentJob.jobId));
        continue;
      }

      const lastError = toLastError(outcome.error);
      commit(
        jobs.map((candidate) =>
          candidate.jobId === currentJob.jobId
            ? { ...candidate, attempts: candidate.attempts + 1, lastError }
            : candidate,
        ),
      );
    }

    if (houveSucesso) {
      lastSyncedAt = now();
    }

    scheduleRetryIfNeeded();
    notify();
    return ok(buildSnapshot());
  }

  /**
   * Agenda uma nova passada quando (e só quando) resta alguma falha
   * retryable. Um agendamento anterior é sempre cancelado antes, para nunca
   * acumular timers.
   */
  function scheduleRetryIfNeeded() {
    if (retryHandle !== null) {
      scheduler.cancel(retryHandle);
      retryHandle = null;
    }
    if (disposed || !connectivity.isOnline()) {
      return;
    }
    const temRetryable = jobs.some((job) => isSendable(job) && job.lastError?.retryable === true);
    if (!temRetryable) {
      return;
    }
    retryHandle = scheduler.schedule(() => {
      retryHandle = null;
      if (disposed) {
        return undefined;
      }
      return flush();
    }, RETRY_DELAY_MS);
  }

  /**
   * Limpa a falha indicada e reexecuta o envio. Um job em quarentena por
   * `uid` alheio ou uma falha não-retryable são recusados explicitamente —
   * jamais convertidos num envio.
   * @param {string} failureId
   * @returns {Promise<import('../../core/result.js').Result>} Promise<Result<SyncSnapshot, AppError>>
   */
  async function retry(failureId) {
    if (disposed) {
      return err(queueError('SYNC_QUEUE_DISPOSED', 'A fila já foi descartada.'));
    }

    const conflictIndex = conflicts.findIndex((conflict) => conflict.failureId === failureId);
    if (conflictIndex !== -1) {
      const nextConflicts = conflicts.filter((_c, i) => i !== conflictIndex);
      const commitResult = commit(jobs, nextConflicts);
      if (!commitResult.ok) {
        return commitResult;
      }
      return adoptRemoteMerge();
    }

    const job = jobs.find((candidate) => candidate.jobId === failureId);
    if (job === undefined) {
      return err(queueError('SYNC_FAILURE_NOT_FOUND', 'Não há falha com este identificador.', { failureId }));
    }
    if (!belongsToCurrentUser(job)) {
      return err(
        queueError(
          'SYNC_JOB_FOREIGN_UID',
          'Este job pertence a outro usuário (ou não registra origem); ele fica em quarentena até o dono original autenticar novamente.',
          { failureId },
        ),
      );
    }
    if (job.lastError !== null && job.lastError.retryable === false) {
      return err(
        queueError('SYNC_RETRY_NOT_RETRYABLE', 'Esta falha não se resolve com uma nova tentativa idêntica.', {
          failureId,
          code: job.lastError.code,
        }),
      );
    }

    const cleared = commit(
      jobs.map((candidate) => (candidate.jobId === failureId ? { ...candidate, lastError: null } : candidate)),
    );
    if (!cleared.ok) {
      return cleared;
    }
    return flush();
  }

  /**
   * Busca a lista remota, faz o merge por `atualizado_em` e adota o
   * resultado no repositório com `expectedStorageRevisionToken`/`reason:
   * "sync"` — nunca por escrita direta no storage. Os vencedores locais são
   * reenfileirados; conflitos de timestamp viram falhas retryable retidas.
   * @returns {Promise<import('../../core/result.js').Result>} Promise<Result<SyncSnapshot, AppError>>
   */
  async function adoptRemoteMerge() {
    if (disposed) {
      return err(queueError('SYNC_QUEUE_DISPOSED', 'A fila já foi descartada.'));
    }

    const remote = await gateway.list();
    if (!remote.ok) {
      return remote;
    }
    const local = characterRepository.list();
    if (!local.ok) {
      return local;
    }

    const mergeResult = mergeCharacterRecords({
      localRecords: [...local.value.characters],
      remoteRecords: [...remote.value],
      pendingDeletionIds: getPendingRemovalIds(),
    });

    // `origin` é metadado de diagnóstico do merge, não parte do contrato do
    // repositório: é removido antes da adoção.
    const records = mergeResult.merged.map((record) => {
      const { origin, ...storable } = record;
      return storable;
    });

    const replaced = characterRepository.replaceAll(records, {
      expectedStorageRevisionToken: local.value.storageRevisionToken,
      reason: 'sync',
    });
    if (!replaced.ok) {
      return replaced;
    }

    // Vencedores locais precisam VOLTAR ao servidor; adotá-los localmente e
    // parar aqui deixaria o registro mais novo do usuário preso no
    // dispositivo. `record: null` faz o flush reler o repositório, que
    // acabou de ser reescrito com o vencedor.
    let nextJobs = [...jobs];
    for (const characterId of mergeResult.toUpsert) {
      const job = {
        jobId: jobIdFor(characterId),
        uid: currentUid(),
        operation: 'upsert',
        characterId,
        record: null,
        updatedAt: null,
        mutationId: null,
        expectedRevisionToken: null,
        state: 'ready',
        attempts: 0,
        legacyAdopted: false,
        lastError: null,
      };
      const index = nextJobs.findIndex((candidate) => candidate.characterId === characterId);
      if (index === -1) {
        nextJobs.push(job);
      } else {
        nextJobs[index] = job;
      }
    }

    // Conflitos de comparação viram falhas retryable retidas — jamais um
    // vencedor silencioso de qualquer um dos lados.
    const nextConflicts = [...conflicts];
    for (const warning of mergeResult.warnings) {
      if (warning.code !== 'SYNC_MERGE_TIMESTAMP_UNCOMPARABLE') {
        continue;
      }
      const failureId = `merge:${warning.context.characterId}`;
      if (nextConflicts.some((conflict) => conflict.failureId === failureId)) {
        continue;
      }
      nextConflicts.push({
        failureId,
        characterId: warning.context.characterId,
        code: warning.code,
        message: warning.message,
        occurredAt: now(),
      });
    }

    const commitResult = commit(nextJobs, nextConflicts);
    if (!commitResult.ok) {
      return commitResult;
    }
    return ok(buildSnapshot());
  }

  /**
   * Ids com remoção pendente na fila — usados pela reconciliação da home
   * para não readicionar localmente um personagem apagado offline.
   * @returns {ReadonlyArray<string>}
   */
  function getPendingRemovalIds() {
    return Object.freeze(
      jobs.filter((job) => job.operation === 'remove' && job.state === 'ready' && belongsToCurrentUser(job)).map((job) => job.characterId),
    );
  }

  /**
   * Diagnósticos da última carga/reconciliação (entradas legadas sem id,
   * preparos descartados, jobs ilegíveis). Existe para que nada seja
   * descartado sem deixar rastro observável.
   * @returns {ReadonlyArray<object>}
   */
  function getDiagnostics() {
    return Object.freeze([...diagnostics]);
  }

  /**
   * @param {Function} listener
   * @returns {() => void}
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('syncQueue.subscribe: "listener" deve ser uma função.');
    }
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((candidate) => candidate !== listener);
    };
  }

  /** Cancela agendamentos e assinaturas: depois disto nada mais executa. */
  function dispose() {
    disposed = true;
    if (retryHandle !== null) {
      scheduler.cancel(retryHandle);
      retryHandle = null;
    }
    listeners = [];
  }

  return Object.freeze({
    initialize,
    enqueueUpsert,
    enqueueRemoval,
    prepareMutation,
    confirmPrepared,
    abortPrepared,
    reconcilePrepared,
    getSnapshot: buildSnapshot,
    flush,
    retry,
    adoptRemoteMerge,
    getPendingRemovalIds,
    getDiagnostics,
    subscribe,
    dispose,
  });
}
