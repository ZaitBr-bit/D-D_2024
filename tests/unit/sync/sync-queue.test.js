// ============================================================
// Testes de `infra/sync/sync-queue`: fila persistente de sincronização
// (localStorage -> Firestore) separada do módulo legado `sync.js`.
//
// Cobre: migração in-place da fila legada `{id, dados, tentativas}`,
// escopo por `uid` (quarentena, nunca descarte nem envio cruzado),
// protocolo de preparo/confirmação/reconciliação, contrato operacional
// (idempotência, durabilidade antes do retorno, subscription ordenada,
// snapshot congelado, failureId estável, flush concorrente coalescido,
// retry, scheduler cancelado, dispose) e a adoção de merge remoto pelo
// repositório com `expectedStorageRevisionToken`.
// ============================================================
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMemoryStorage } from '../../helpers/memory-storage.js';
import { createLegacyAliasResolver } from '../../../site/js/infra/character/legacy-alias-resolver.js';
import { decodeCharacterRecord } from '../../../site/js/infra/character/character-codec.js';
import { ok, err } from '../../../site/js/core/result.js';
import { createAppError } from '../../../site/js/core/errors.js';
import { createSyncQueue, SYNC_QUEUE_KEY } from '../../../site/js/infra/sync/sync-queue.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const UID = 'uid-alice';
const OUTRO_UID = 'uid-bob';

let aliasResolver;
let legacyMinimalRaw;

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  aliasResolver = createLegacyAliasResolver(aliases);
  const fixture = JSON.parse(
    await readFile(path.join(repoRoot, 'tests/fixtures/characters/legacy-minimal.json'), 'utf8'),
  );
  legacyMinimalRaw = fixture.cases[0].personagem;
});

// --- Dublês -----------------------------------------------------------

/** Gateway falso: registra chamadas e permite programar falhas por id. */
function createFakeGateway({ uid = UID } = {}) {
  const calls = [];
  const failures = new Map(); // characterId -> AppError
  return {
    uid,
    calls,
    /** Programa uma falha para o próximo envio de `characterId`. */
    failOn(characterId, error) {
      failures.set(characterId, error);
    },
    /** Remove a falha programada de `characterId`. */
    healOn(characterId) {
      failures.delete(characterId);
    },
    async list() {
      calls.push({ op: 'list' });
      return ok(Object.freeze([]));
    },
    async upsert(envelope) {
      const id = envelope?.character?.identity?.id ?? envelope?.rawRecord?.id;
      calls.push({ op: 'upsert', characterId: id, envelope });
      if (failures.has(id)) return err(failures.get(id));
      return ok(Object.freeze({ characterId: id, updatedAt: '2026-07-31T00:00:00.000Z', remoteBackup: 'not-applicable' }));
    },
    async remove(characterId) {
      calls.push({ op: 'remove', characterId });
      if (failures.has(characterId)) return err(failures.get(characterId));
      return ok(undefined);
    },
  };
}

/** Repositório falso: mapa id -> envelope, com contagem de replaceAll. */
function createFakeRepository(initial = {}) {
  const map = new Map(Object.entries(initial));
  const replaceAllCalls = [];
  return {
    map,
    replaceAllCalls,
    list() {
      return ok(Object.freeze({ characters: Object.freeze([...map.values()]), storageRevisionToken: `srt-${map.size}` }));
    },
    get(id) {
      return ok(map.has(id) ? map.get(id) : null);
    },
    replaceAll(records, options) {
      replaceAllCalls.push({ records, options });
      return ok(Object.freeze({ storageRevisionToken: 'srt-novo' }));
    },
  };
}

/** Scheduler falso, controlável manualmente (sem timers reais). */
function createFakeScheduler() {
  const pending = new Map();
  let seq = 0;
  return {
    pending,
    schedule(fn, delay) {
      seq += 1;
      pending.set(seq, { fn, delay });
      return seq;
    },
    cancel(handle) {
      pending.delete(handle);
    },
    /** Executa (e remove) todas as callbacks agendadas. */
    async runAll() {
      const atuais = [...pending.entries()];
      pending.clear();
      for (const [, entry] of atuais) await entry.fn();
    },
  };
}

/** Codec falso: repassa o registro bruto como envelope editável. */
function createFakeCodec() {
  const decoded = [];
  return {
    decoded,
    decode(rawRecord) {
      decoded.push(rawRecord);
      if (rawRecord && rawRecord.__indecodificavel) {
        return err(createAppError({ code: 'CHARACTER_DECODE_FAILED', scope: 'test', message: 'falha simulada' }));
      }
      if (rawRecord && rawRecord.__futuro) {
        return ok(Object.freeze({ mode: 'read-only', rawRecord, detectedVersion: 99 }));
      }
      return ok(
        Object.freeze({
          mode: 'editable',
          character: { identity: { id: rawRecord.id }, metadata: { updatedAt: rawRecord.atualizado_em ?? null } },
          rawRecord,
          warnings: [],
          localSync: null,
        }),
      );
    },
  };
}

/** Envelope editável mínimo (formato do repositório). */
function envelope(id, { updatedAt = '2026-01-01T00:00:00.000Z', mutationId = null, revisionToken = `tok-${id}` } = {}) {
  return Object.freeze({
    mode: 'editable',
    character: { identity: { id }, metadata: { updatedAt } },
    rawRecord: { id, atualizado_em: updatedAt },
    warnings: [],
    localSync: mutationId ? { lastMutationId: mutationId } : null,
    revisionToken,
    recordFingerprint: `fp-${id}`,
  });
}

/** Monta uma fila com todos os dublês, permitindo sobrescrever cada um. */
function buildQueue(overrides = {}) {
  const storage = overrides.storage ?? createMemoryStorage();
  const gateway = overrides.gateway ?? createFakeGateway();
  const characterRepository = overrides.characterRepository ?? createFakeRepository();
  const scheduler = overrides.scheduler ?? createFakeScheduler();
  const codec = overrides.codec ?? createFakeCodec();
  let online = overrides.online ?? true;
  const connectivity = overrides.connectivity ?? {
    isOnline: () => online,
    setOnline(value) {
      online = value;
    },
  };
  const clock = overrides.clock ?? { now: () => '2026-07-31T12:00:00.000Z' };
  const queue = createSyncQueue({ storage, gateway, characterRepository, connectivity, scheduler, codec, clock });
  return { queue, storage, gateway, characterRepository, scheduler, codec, connectivity };
}

/** Lê a fila persistida bruta. */
function lerPersistido(storage) {
  const raw = storage.getItem(SYNC_QUEUE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

// --- Testes -----------------------------------------------------------

describe('sync-queue — chave e migração da fila legada', () => {
  test('SYNC_QUEUE_KEY é exatamente a chave legada', () => {
    assert.equal(SYNC_QUEUE_KEY, 'dnd_sync_queue');
  });

  test('fila legada é migrada in-place, na MESMA chave, sem criar segunda chave', () => {
    const storage = createMemoryStorage({
      dnd_sync_queue: JSON.stringify([
        { id: 'c1', dados: { id: 'c1', nome: 'Alfa', atualizado_em: '2026-01-01T00:00:00.000Z' }, tentativas: 2 },
        { id: 'c2', acao: 'remover', tentativas: 1 },
      ]),
    });
    const { queue } = buildQueue({ storage });

    const antes = Object.keys(storage.dump());
    const resultado = queue.initialize();
    assert.equal(resultado.ok, true);
    assert.equal(resultado.value.pending, 2, 'nenhuma pendência pode ser perdida na migração');

    const depois = Object.keys(storage.dump());
    assert.deepEqual(depois, antes, 'a migração não pode criar uma segunda chave');

    const persistido = lerPersistido(storage);
    assert.equal(persistido.version, 2);
    assert.equal(persistido.jobs.length, 2);
    assert.deepEqual(persistido.jobs.map((j) => j.operation), ['upsert', 'remove']);
  });

  test('job legado migrado nasce ready (nunca prepared), com mutationId e expectedRevisionToken nulos', () => {
    const storage = createMemoryStorage({
      dnd_sync_queue: JSON.stringify([{ id: 'c1', dados: { id: 'c1' }, tentativas: 0 }]),
    });
    const { queue } = buildQueue({ storage });
    queue.initialize();

    const [job] = lerPersistido(storage).jobs;
    assert.equal(job.state, 'ready');
    assert.equal(job.mutationId, null);
    assert.equal(job.expectedRevisionToken, null);
    assert.equal(queue.getSnapshot().prepared, 0);
  });

  test('reconcilePrepared PULA jobs legados (mutationId null) — nunca os classifica como conflito', () => {
    const storage = createMemoryStorage({
      dnd_sync_queue: JSON.stringify([{ id: 'c1', dados: { id: 'c1' }, tentativas: 0 }]),
    });
    const { queue } = buildQueue({ storage });
    queue.initialize();

    const resultado = queue.reconcilePrepared();
    assert.equal(resultado.ok, true);
    assert.deepEqual([...resultado.value.failures], [], 'job legado não pode virar conflito');
    assert.equal(resultado.value.pending, 1, 'job legado continua enviável');
  });

  test('a remoção legada `{acao:"remover"}` sobrevive à migração e continua pendente de remoção', () => {
    const storage = createMemoryStorage({
      dnd_sync_queue: JSON.stringify([{ id: 'c9', acao: 'remover', tentativas: 3 }]),
    });
    const { queue } = buildQueue({ storage });
    queue.initialize();

    assert.deepEqual([...queue.getPendingRemovalIds()], ['c9']);
  });

  test('fila corrompida NÃO é limpa: erro estruturado e bytes originais preservados', () => {
    const storage = createMemoryStorage();
    storage.corrupt(SYNC_QUEUE_KEY, '{isto não é json');
    const { queue } = buildQueue({ storage });

    const resultado = queue.initialize();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SYNC_QUEUE_CORRUPT_JSON');
    assert.equal(storage.getItem(SYNC_QUEUE_KEY), '{isto não é json', 'nunca limpar antes de persistência válida');
  });

  test('formato desconhecido (objeto sem jobs) é erro, não fila vazia silenciosa', () => {
    const storage = createMemoryStorage({ dnd_sync_queue: JSON.stringify({ version: 999, coisas: [] }) });
    const { queue } = buildQueue({ storage });

    const resultado = queue.initialize();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SYNC_QUEUE_UNKNOWN_SHAPE');
  });

  test('entrada legada sem id é retida como diagnóstico, nunca descartada em silêncio', () => {
    const storage = createMemoryStorage({
      dnd_sync_queue: JSON.stringify([{ dados: { nome: 'sem id' }, tentativas: 0 }, { id: 'ok1', dados: { id: 'ok1' } }]),
    });
    const { queue } = buildQueue({ storage });
    const resultado = queue.initialize();

    assert.equal(resultado.ok, true);
    assert.equal(resultado.value.pending, 1);
    const diags = queue.getDiagnostics();
    assert.equal(diags.filter((d) => d.code === 'SYNC_QUEUE_LEGACY_ENTRY_WITHOUT_ID').length, 1);
  });

  test('initialize é idempotente: segunda chamada não duplica nem re-migra', () => {
    const storage = createMemoryStorage({
      dnd_sync_queue: JSON.stringify([{ id: 'c1', dados: { id: 'c1' }, tentativas: 0 }]),
    });
    const { queue } = buildQueue({ storage });

    const primeira = queue.initialize();
    const bytesApos1 = storage.getItem(SYNC_QUEUE_KEY);
    const segunda = queue.initialize();

    assert.equal(primeira.value.pending, 1);
    assert.equal(segunda.value.pending, 1);
    assert.equal(storage.getItem(SYNC_QUEUE_KEY), bytesApos1, 'segunda initialize não altera os bytes');
  });
});

describe('sync-queue — escopo por uid (nunca enviar job de outro usuário)', () => {
  test('job de outro uid é posto em quarentena: não é enviado nem descartado', async () => {
    const storage = createMemoryStorage();
    const alice = buildQueue({ storage, gateway: createFakeGateway({ uid: UID }) });
    alice.queue.initialize();
    alice.queue.enqueueUpsert(envelope('secreto'));
    assert.equal(lerPersistido(storage).jobs[0].uid, UID);

    // Logout + login como outro usuário: MESMO storage, gateway com outro uid.
    const bobGateway = createFakeGateway({ uid: OUTRO_UID });
    const bob = buildQueue({ storage, gateway: bobGateway });
    const init = bob.queue.initialize();

    assert.equal(init.ok, true);
    assert.equal(init.value.pending, 0, 'job alheio nunca é pendência do usuário atual');
    assert.equal(init.value.failures.length, 1);
    assert.equal(init.value.failures[0].code, 'SYNC_JOB_FOREIGN_UID');
    assert.equal(init.value.failures[0].retryable, false);

    await bob.queue.flush();
    assert.deepEqual(bobGateway.calls, [], 'nenhuma chamada remota pode ocorrer com job de outro uid');
    assert.equal(lerPersistido(storage).jobs.length, 1, 'o job do usuário anterior não pode ser descartado');
    assert.equal(lerPersistido(storage).jobs[0].uid, UID, 'o uid original é preservado');
  });

  test('retry de um job em quarentena é recusado (não vira envio cruzado)', async () => {
    const storage = createMemoryStorage();
    const alice = buildQueue({ storage, gateway: createFakeGateway({ uid: UID }) });
    alice.queue.initialize();
    const { jobId } = alice.queue.enqueueUpsert(envelope('secreto')).value;

    const bobGateway = createFakeGateway({ uid: OUTRO_UID });
    const bob = buildQueue({ storage, gateway: bobGateway });
    bob.queue.initialize();

    const resultado = await bob.queue.retry(jobId);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SYNC_JOB_FOREIGN_UID');
    assert.deepEqual(bobGateway.calls, []);
  });

  test('o dono original volta e seus jobs voltam a ser enviáveis', async () => {
    const storage = createMemoryStorage();
    const alice1 = buildQueue({ storage, gateway: createFakeGateway({ uid: UID }) });
    alice1.queue.initialize();
    alice1.queue.enqueueUpsert(envelope('c1'));

    const bob = buildQueue({ storage, gateway: createFakeGateway({ uid: OUTRO_UID }) });
    bob.queue.initialize();
    await bob.queue.flush();

    const aliceGateway = createFakeGateway({ uid: UID });
    const alice2 = buildQueue({ storage, gateway: aliceGateway });
    alice2.queue.initialize();
    const snap = await alice2.queue.flush();

    assert.equal(snap.ok, true);
    assert.equal(aliceGateway.calls.length, 1);
    assert.equal(aliceGateway.calls[0].characterId, 'c1');
    assert.equal(snap.value.pending, 0);
  });

  test('job persistido SEM uid cai na MESMA quarentena (uid ausente nunca é "meu")', async () => {
    // Job de procedência desconhecida: chegou à chave sem registrar quem o
    // originou (fila adulterada, bug de terceiro, formato parcial). Tratá-lo
    // como do usuário atual seria fail-OPEN — o personagem de alguém iria
    // parar em `users/{uid-alice}/personagens`.
    const storage = createMemoryStorage({
      dnd_sync_queue: JSON.stringify({
        version: 2,
        jobs: [
          {
            jobId: 'job:sem-dono',
            operation: 'upsert',
            characterId: 'sem-dono',
            record: { id: 'sem-dono', atualizado_em: '2026-01-01T00:00:00.000Z' },
            state: 'ready',
          },
        ],
        conflicts: [],
      }),
    });
    const gateway = createFakeGateway({ uid: UID });
    const { queue } = buildQueue({ storage, gateway });

    const init = queue.initialize();
    assert.equal(init.ok, true);
    assert.equal(lerPersistido(storage).jobs[0].uid, null, 'a ausência de uid é preservada, nunca "consertada"');
    assert.equal(init.value.pending, 0, 'um job sem origem não conta como pendência do usuário atual');
    assert.equal(init.value.failures.length, 1);
    assert.equal(init.value.failures[0].code, 'SYNC_JOB_FOREIGN_UID');
    assert.equal(init.value.failures[0].retryable, false);
    assert.equal(init.value.status, 'erro');

    await queue.flush();
    assert.deepEqual(gateway.calls, [], 'um job sem uid JAMAIS pode ser enviado');
    assert.equal(lerPersistido(storage).jobs.length, 1, 'e também nunca é descartado');

    const tentativa = await queue.retry('job:sem-dono');
    assert.equal(tentativa.ok, false);
    assert.equal(tentativa.error.code, 'SYNC_JOB_FOREIGN_UID');
    assert.deepEqual(gateway.calls, []);
  });

  test('job com uid inválido (não-string/vazio) recebe o mesmo tratamento de ausência', async () => {
    const storage = createMemoryStorage({
      dnd_sync_queue: JSON.stringify({
        version: 2,
        jobs: [
          { jobId: 'job:a', uid: '', operation: 'remove', characterId: 'a', state: 'ready' },
          { jobId: 'job:b', uid: 42, operation: 'remove', characterId: 'b', state: 'ready' },
        ],
        conflicts: [],
      }),
    });
    const gateway = createFakeGateway({ uid: UID });
    const { queue } = buildQueue({ storage, gateway });

    const init = queue.initialize();
    assert.equal(init.value.pending, 0);
    assert.deepEqual(
      init.value.failures.map((f) => f.code),
      ['SYNC_JOB_FOREIGN_UID', 'SYNC_JOB_FOREIGN_UID'],
    );

    await queue.flush();
    assert.deepEqual(gateway.calls, []);
    // E não são oferecidos como remoção pendente da home: um job sem dono
    // não pode influenciar a reconciliação local do usuário atual.
    assert.deepEqual([...queue.getPendingRemovalIds()], []);
  });

  test('sem usuário autenticado nenhum job vira falha fantasma', () => {
    const storage = createMemoryStorage({
      dnd_sync_queue: JSON.stringify({
        version: 2,
        jobs: [{ jobId: 'job:c1', uid: UID, operation: 'upsert', characterId: 'c1', record: { id: 'c1' }, state: 'ready' }],
        conflicts: [],
      }),
    });
    const { queue } = buildQueue({ storage, gateway: createFakeGateway({ uid: null }) });

    const init = queue.initialize();
    assert.equal(init.ok, true);
    assert.deepEqual([...init.value.failures], [], 'sem uid atual não há contra quem comparar');
  });
});

describe('sync-queue — enqueue durável e coalescência', () => {
  test('enqueueUpsert só retorna sucesso depois de persistir a fila', () => {
    const { queue, storage } = buildQueue();
    queue.initialize();
    const resultado = queue.enqueueUpsert(envelope('c1'));

    assert.equal(resultado.ok, true);
    assert.equal(lerPersistido(storage).jobs.length, 1, 'já persistido no momento do retorno');
    assert.equal(resultado.value.snapshot.pending, 1);
  });

  test('falha de persistência (quota) NÃO retorna sucesso e não deixa o job só em memória', () => {
    const storage = createMemoryStorage();
    const { queue } = buildQueue({ storage });
    queue.initialize();
    storage.setQuotaExceeded(true);

    const resultado = queue.enqueueUpsert(envelope('c1'));
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SYNC_QUEUE_WRITE_FAILED');

    storage.setQuotaExceeded(false);
    assert.equal(queue.getSnapshot().pending, 0, 'o job não pode ficar pendente em memória após falha de escrita');
  });

  test('dois upserts do mesmo personagem coalescem em um único job', () => {
    const { queue, storage } = buildQueue();
    queue.initialize();
    queue.enqueueUpsert(envelope('c1', { updatedAt: '2026-01-01T00:00:00.000Z' }));
    queue.enqueueUpsert(envelope('c1', { updatedAt: '2026-02-02T00:00:00.000Z' }));

    assert.equal(lerPersistido(storage).jobs.length, 1);
    assert.equal(lerPersistido(storage).jobs[0].record.atualizado_em, '2026-02-02T00:00:00.000Z');
  });

  test('enqueueRemoval cancela o upsert pendente do mesmo personagem', () => {
    const { queue, storage } = buildQueue();
    queue.initialize();
    queue.enqueueUpsert(envelope('c1'));
    queue.enqueueRemoval({ characterId: 'c1', updatedAt: '2026-02-01T00:00:00.000Z' });

    const jobs = lerPersistido(storage).jobs;
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].operation, 'remove');
    assert.deepEqual([...queue.getPendingRemovalIds()], ['c1']);
  });

  test('envelope read-only (schema futuro) é recusado no enqueue, com erro estruturado', () => {
    const { queue, storage } = buildQueue();
    queue.initialize();
    const resultado = queue.enqueueUpsert({ mode: 'read-only', rawRecord: { id: 'f', _schema: { version: 99 } } });

    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SYNC_UPSERT_READ_ONLY_ENVELOPE');
    assert.equal(lerPersistido(storage), null, 'nada é persistido para um envelope não enviável');
  });
});

describe('sync-queue — flush, falhas, retry e offline', () => {
  test('flush envia upsert e remove o job depois do sucesso', async () => {
    const { queue, storage, gateway } = buildQueue();
    queue.initialize();
    queue.enqueueUpsert(envelope('c1'));

    const resultado = await queue.flush();
    assert.equal(resultado.ok, true);
    assert.equal(gateway.calls.length, 1);
    assert.equal(gateway.calls[0].op, 'upsert');
    assert.equal(lerPersistido(storage).jobs.length, 0);
    assert.equal(resultado.value.status, 'ok');
    assert.equal(resultado.value.lastSyncedAt, '2026-07-31T12:00:00.000Z');
  });

  test('flush envia remoção e limpa a pendência de remoção', async () => {
    const { queue, gateway } = buildQueue();
    queue.initialize();
    queue.enqueueRemoval({ characterId: 'c9', updatedAt: '2026-01-01T00:00:00.000Z' });

    await queue.flush();
    assert.deepEqual(gateway.calls, [{ op: 'remove', characterId: 'c9' }]);
    assert.deepEqual([...queue.getPendingRemovalIds()], []);
  });

  test('offline: nenhuma chamada remota, status offline, job intacto', async () => {
    const { queue, gateway, connectivity, storage } = buildQueue();
    queue.initialize();
    queue.enqueueUpsert(envelope('c1'));
    connectivity.setOnline(false);

    const resultado = await queue.flush();
    assert.equal(resultado.value.status, 'offline');
    assert.deepEqual(gateway.calls, []);
    assert.equal(lerPersistido(storage).jobs.length, 1);
  });

  test('erro remoto vira failure com failureId estável, e o job permanece na fila', async () => {
    const { queue, gateway, storage } = buildQueue();
    queue.initialize();
    queue.enqueueUpsert(envelope('c1'));
    gateway.failOn('c1', createAppError({ code: 'REMOTE_UPSERT_FAILED', scope: 'test', message: 'rede caiu' }));

    const resultado = await queue.flush();
    assert.equal(resultado.value.status, 'erro');
    assert.equal(resultado.value.failures.length, 1);
    const failure = resultado.value.failures[0];
    assert.equal(failure.characterId, 'c1');
    assert.equal(failure.operation, 'upsert');
    assert.equal(failure.code, 'REMOTE_UPSERT_FAILED');
    assert.equal(failure.retryable, true);
    assert.equal(failure.occurredAt, '2026-07-31T12:00:00.000Z');
    assert.equal(lerPersistido(storage).jobs.length, 1);
  });

  test('failureId sobrevive a reload (derivado da identidade persistida do job)', async () => {
    const storage = createMemoryStorage();
    const primeira = buildQueue({ storage });
    primeira.queue.initialize();
    primeira.queue.enqueueUpsert(envelope('c1'));
    primeira.gateway.failOn('c1', createAppError({ code: 'REMOTE_UPSERT_FAILED', scope: 'test', message: 'x' }));
    const antes = (await primeira.queue.flush()).value.failures[0].failureId;

    // Reload: nova instância sobre o mesmo storage.
    const segunda = buildQueue({ storage });
    const depois = segunda.queue.initialize().value.failures[0].failureId;

    assert.equal(depois, antes, 'failureId não pode ser um contador em memória');
  });

  test('retry(failureId) depois de reload reenvia e limpa a falha', async () => {
    const storage = createMemoryStorage();
    const primeira = buildQueue({ storage });
    primeira.queue.initialize();
    primeira.queue.enqueueUpsert(envelope('c1'));
    primeira.gateway.failOn('c1', createAppError({ code: 'REMOTE_UPSERT_FAILED', scope: 'test', message: 'x' }));
    const failureId = (await primeira.queue.flush()).value.failures[0].failureId;

    const segunda = buildQueue({ storage });
    segunda.queue.initialize();
    const resultado = await segunda.queue.retry(failureId);

    assert.equal(resultado.ok, true);
    assert.equal(resultado.value.failures.length, 0);
    assert.equal(resultado.value.status, 'ok');
    assert.equal(segunda.gateway.calls.length, 1);
  });

  test('retry de failureId desconhecido é erro explícito', async () => {
    const { queue } = buildQueue();
    queue.initialize();
    const resultado = await queue.retry('nao-existe');
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SYNC_FAILURE_NOT_FOUND');
  });

  test('documento remoto grande demais: erro sincronizável retido, registro permanece local', async () => {
    const repo = createFakeRepository({ c1: envelope('c1') });
    const { queue, gateway } = buildQueue({ characterRepository: repo });
    queue.initialize();
    queue.enqueueUpsert(envelope('c1'));
    gateway.failOn(
      'c1',
      createAppError({ code: 'REMOTE_DOCUMENT_TOO_LARGE', scope: 'test', message: 'documento excede o limite' }),
    );

    const resultado = await queue.flush();
    assert.equal(resultado.value.failures[0].code, 'REMOTE_DOCUMENT_TOO_LARGE');
    assert.equal(resultado.value.failures[0].retryable, true, 'permanece sincronizável após o usuário reduzir o registro');
    assert.equal(repo.map.has('c1'), true, 'o registro nunca é removido localmente por falha remota');
    assert.deepEqual(repo.replaceAllCalls, [], 'falha remota não pode reescrever o storage local');
  });

  test('permissão negada é falha NÃO retryable e retry é recusado', async () => {
    const { queue, gateway } = buildQueue();
    queue.initialize();
    queue.enqueueUpsert(envelope('c1'));
    gateway.failOn('c1', createAppError({ code: 'REMOTE_PERMISSION_DENIED', scope: 'test', message: 'negado' }));

    const snap = await queue.flush();
    assert.equal(snap.value.failures[0].retryable, false);
    const resultado = await queue.retry(snap.value.failures[0].failureId);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SYNC_RETRY_NOT_RETRYABLE');
  });

  test('job cujo payload não decodifica é classificado e retido, nunca enviado nem descartado', async () => {
    const { queue, gateway, storage } = buildQueue();
    queue.initialize();
    queue.enqueueUpsert({
      mode: 'editable',
      character: { identity: { id: 'cx' }, metadata: { updatedAt: '2026-01-01T00:00:00.000Z' } },
      rawRecord: { id: 'cx', __indecodificavel: true },
    });

    const resultado = await queue.flush();
    assert.deepEqual(gateway.calls, [], 'payload indecodificável nunca vai para a rede');
    assert.equal(resultado.value.failures[0].code, 'SYNC_JOB_UNSENDABLE_SCHEMA');
    assert.equal(resultado.value.failures[0].retryable, false);
    assert.equal(lerPersistido(storage).jobs.length, 1, 'o job é retido para inspeção, não descartado');
  });

  test('flush concorrente é coalescido em uma única passada de rede', async () => {
    const { queue, gateway } = buildQueue();
    queue.initialize();
    queue.enqueueUpsert(envelope('c1'));

    const [a, b] = await Promise.all([queue.flush(), queue.flush()]);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(gateway.calls.length, 1, 'duas chamadas simultâneas não podem enviar o job duas vezes');
  });

  test('falha retryable agenda nova tentativa; dispose cancela o agendamento', async () => {
    const { queue, gateway, scheduler } = buildQueue();
    queue.initialize();
    queue.enqueueUpsert(envelope('c1'));
    gateway.failOn('c1', createAppError({ code: 'REMOTE_UPSERT_FAILED', scope: 'test', message: 'x' }));
    await queue.flush();

    assert.equal(scheduler.pending.size, 1, 'falha retryable deve agendar retry');
    queue.dispose();
    assert.equal(scheduler.pending.size, 0, 'dispose cancela o agendamento pendente');

    const chamadasAntes = gateway.calls.length;
    await scheduler.runAll();
    assert.equal(gateway.calls.length, chamadasAntes, 'nada roda depois do dispose');
  });

  test('flush depois de dispose é recusado e não toca a rede', async () => {
    const { queue, gateway } = buildQueue();
    queue.initialize();
    queue.enqueueUpsert(envelope('c1'));
    queue.dispose();

    const resultado = await queue.flush();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SYNC_QUEUE_DISPOSED');
    assert.deepEqual(gateway.calls, []);
  });
});

describe('sync-queue — snapshot, status e subscription', () => {
  test('mapeamento determinístico de status: failures dominam pending === 0', async () => {
    const { queue, gateway } = buildQueue();
    queue.initialize();
    queue.enqueueRemoval({ characterId: 'c1', updatedAt: null });
    gateway.failOn('c1', createAppError({ code: 'REMOTE_REMOVE_FAILED', scope: 'test', message: 'x' }));
    await queue.flush();

    const snap = queue.getSnapshot();
    assert.ok(snap.failures.length > 0);
    assert.equal(snap.status, 'erro');
  });

  test('sem conectividade e sem falhas: status offline', () => {
    const { queue, connectivity } = buildQueue();
    queue.initialize();
    queue.enqueueUpsert(envelope('c1'));
    connectivity.setOnline(false);
    assert.equal(queue.getSnapshot().status, 'offline');
  });

  test('pendência com conectividade e sem falhas: status sincronizando', () => {
    const { queue } = buildQueue();
    queue.initialize();
    queue.enqueueUpsert(envelope('c1'));
    assert.equal(queue.getSnapshot().status, 'sincronizando');
  });

  test('job prepared também produz sincronizando', () => {
    const { queue } = buildQueue();
    queue.initialize();
    queue.prepareMutation({ mutationId: 'm1', operation: 'upsert', characterId: 'c1', expectedRevisionToken: null });
    const snap = queue.getSnapshot();
    assert.equal(snap.prepared, 1);
    assert.equal(snap.pending, 0);
    assert.equal(snap.status, 'sincronizando');
  });

  test('status é idle antes de initialize()', () => {
    const { queue } = buildQueue();
    assert.equal(queue.getSnapshot().status, 'idle');
  });

  test('snapshot é congelado, inclusive failures e cada failure', async () => {
    const { queue, gateway } = buildQueue();
    queue.initialize();
    queue.enqueueUpsert(envelope('c1'));
    gateway.failOn('c1', createAppError({ code: 'REMOTE_UPSERT_FAILED', scope: 'test', message: 'x' }));
    await queue.flush();

    const snap = queue.getSnapshot();
    assert.ok(Object.isFrozen(snap));
    assert.ok(Object.isFrozen(snap.failures));
    assert.ok(Object.isFrozen(snap.failures[0]));
  });

  test('subscribers são notificados na ordem de registro e cancelam individualmente', () => {
    const { queue } = buildQueue();
    queue.initialize();
    const ordem = [];
    const un1 = queue.subscribe(() => ordem.push('a'));
    queue.subscribe(() => ordem.push('b'));

    queue.enqueueUpsert(envelope('c1'));
    assert.deepEqual(ordem, ['a', 'b']);

    un1();
    ordem.length = 0;
    queue.enqueueUpsert(envelope('c2'));
    assert.deepEqual(ordem, ['b']);
  });

  test('dispose remove subscribers: nenhuma notificação posterior', () => {
    const { queue } = buildQueue();
    queue.initialize();
    let chamadas = 0;
    queue.subscribe(() => { chamadas += 1; });
    queue.dispose();
    queue.enqueueUpsert(envelope('c1'));
    assert.equal(chamadas, 0);
  });
});

describe('sync-queue — protocolo preparado (prepare/confirm/reconcile)', () => {
  test('prepareMutation cria job prepared não enviável', async () => {
    const { queue, gateway, storage } = buildQueue();
    queue.initialize();
    const resultado = queue.prepareMutation({
      mutationId: 'm1', operation: 'upsert', characterId: 'c1', expectedRevisionToken: null,
    });

    assert.equal(resultado.ok, true);
    assert.equal(lerPersistido(storage).jobs[0].state, 'prepared');
    await queue.flush();
    assert.deepEqual(gateway.calls, [], 'job prepared nunca vai à rede');
  });

  test('confirmPrepared torna o job enviável', async () => {
    const repo = createFakeRepository({ c1: envelope('c1', { mutationId: 'm1' }) });
    const { queue, gateway } = buildQueue({ characterRepository: repo });
    queue.initialize();
    const { preparationId } = queue.prepareMutation({
      mutationId: 'm1', operation: 'upsert', characterId: 'c1', expectedRevisionToken: null,
    }).value;

    const confirmado = queue.confirmPrepared(preparationId);
    assert.equal(confirmado.ok, true);
    assert.equal(confirmado.value.snapshot.pending, 1);

    await queue.flush();
    assert.equal(gateway.calls.length, 1);
    assert.equal(gateway.calls[0].characterId, 'c1');
  });

  test('falha de persistência no prepare impede a preparação (e portanto a escrita local)', () => {
    const storage = createMemoryStorage();
    const { queue } = buildQueue({ storage });
    queue.initialize();
    storage.setQuotaExceeded(true);

    const resultado = queue.prepareMutation({
      mutationId: 'm1', operation: 'upsert', characterId: 'c1', expectedRevisionToken: null,
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SYNC_QUEUE_WRITE_FAILED');
  });

  test('confirmPrepared de preparationId desconhecido é erro', () => {
    const { queue } = buildQueue();
    queue.initialize();
    const resultado = queue.confirmPrepared('inexistente');
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SYNC_PREPARATION_NOT_FOUND');
  });

  test('abortPrepared RESTAURA o job ready que o preparo havia deslocado', async () => {
    // Cenário do achado: um upsert já confirmado está pendente offline; um
    // novo save prepara por cima e a escrita local falha. Sem o aborto, o job
    // confirmado viraria um `prepared` órfão — contado como "sincronizando",
    // sem falha visível, e nunca enviado.
    const repo = createFakeRepository({ c1: envelope('c1') });
    const { queue, gateway, connectivity, storage } = buildQueue({ characterRepository: repo, online: false });
    queue.initialize();
    queue.enqueueUpsert(envelope('c1'));
    assert.equal(queue.getSnapshot().pending, 1, 'há um upsert confirmado pendente');

    const { preparationId } = queue.prepareMutation({
      mutationId: 'm1', operation: 'upsert', characterId: 'c1', expectedRevisionToken: null,
    }).value;
    assert.equal(queue.getSnapshot().prepared, 1);

    const abortado = queue.abortPrepared(preparationId);
    assert.equal(abortado.ok, true);
    assert.equal(abortado.value.snapshot.prepared, 0, 'nenhum preparo órfão fica para trás');
    assert.equal(abortado.value.snapshot.pending, 1, 'o job confirmado NÃO foi perdido');
    assert.equal(lerPersistido(storage).jobs[0].state, 'ready', 'e a restauração está em disco, não só em memória');

    // E ele continua sendo enviado quando a conexão volta — sem reload.
    connectivity.setOnline(true);
    await queue.flush();
    assert.deepEqual(gateway.calls.map((c) => c.characterId), ['c1']);
  });

  test('abortPrepared REMOVE o job quando não havia nenhum antes do preparo', () => {
    const { queue, storage } = buildQueue({ online: false });
    queue.initialize();
    const { preparationId } = queue.prepareMutation({
      mutationId: 'm1', operation: 'upsert', characterId: 'c1', expectedRevisionToken: null,
    }).value;

    const abortado = queue.abortPrepared(preparationId);
    assert.equal(abortado.ok, true);
    assert.equal(abortado.value.snapshot.prepared, 0);
    assert.equal(abortado.value.snapshot.pending, 0);
    assert.deepEqual(lerPersistido(storage).jobs, [], 'a fila volta exatamente ao estado anterior ao preparo');
  });

  test('o status observável muda IMEDIATAMENTE no aborto (nada espera um reload)', () => {
    const { queue, connectivity } = buildQueue({ online: true });
    queue.initialize();
    const vistos = [];
    queue.subscribe((snapshot) => vistos.push(snapshot.status));

    const { preparationId } = queue.prepareMutation({
      mutationId: 'm1', operation: 'upsert', characterId: 'c1', expectedRevisionToken: null,
    }).value;
    assert.equal(queue.getSnapshot().status, 'sincronizando', 'durante o preparo o status é "sincronizando"');

    queue.abortPrepared(preparationId);
    assert.equal(queue.getSnapshot().status, 'ok', 'e volta a "ok" na hora, sem spinner permanente');
    assert.deepEqual(vistos, ['sincronizando', 'ok'], 'os assinantes foram notificados das duas transições');
    assert.ok(connectivity.isOnline());
  });

  test('aborto que não consegue persistir sinaliza ERRO na hora (nunca "sincronizando" mudo)', () => {
    const storage = createMemoryStorage();
    const { queue } = buildQueue({ storage, online: true });
    queue.initialize();
    const { preparationId } = queue.prepareMutation({
      mutationId: 'm1', operation: 'upsert', characterId: 'c1', expectedRevisionToken: null,
    }).value;

    const vistos = [];
    queue.subscribe((snapshot) => vistos.push(snapshot.status));
    storage.setQuotaExceeded(true);

    const abortado = queue.abortPrepared(preparationId);
    assert.equal(abortado.ok, false);
    assert.equal(abortado.error.code, 'SYNC_QUEUE_WRITE_FAILED');

    const snapshot = queue.getSnapshot();
    assert.equal(snapshot.status, 'erro', 'a falha é visível AGORA, não só depois de um reload');
    assert.equal(snapshot.failures.length, 1);
    assert.equal(snapshot.failures[0].code, 'SYNC_PREPARED_ABORT_UNPERSISTED');
    assert.equal(snapshot.failures[0].retryable, false);
    assert.deepEqual(vistos, ['erro'], 'os assinantes viram a transição imediatamente');
  });

  test('abortPrepared de preparationId desconhecido é erro', () => {
    const { queue } = buildQueue();
    queue.initialize();
    const resultado = queue.abortPrepared('inexistente');
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SYNC_PREPARATION_NOT_FOUND');
  });

  test('abortar um preparo que coalesceu sobre OUTRO preparo não ressuscita um prepared órfão', () => {
    const { queue } = buildQueue({ online: false });
    queue.initialize();
    queue.enqueueUpsert(envelope('c1'));

    queue.prepareMutation({ mutationId: 'm1', operation: 'upsert', characterId: 'c1', expectedRevisionToken: null });
    const { preparationId } = queue.prepareMutation({
      mutationId: 'm2', operation: 'upsert', characterId: 'c1', expectedRevisionToken: null,
    }).value;

    const abortado = queue.abortPrepared(preparationId);
    assert.equal(abortado.ok, true);
    assert.equal(abortado.value.snapshot.prepared, 0, 'o preparo intermediário não volta como órfão');
    assert.equal(abortado.value.snapshot.pending, 1, 'o alvo do rollback é o job ready original');
  });

  test('abortPrepared não pode desfazer um preparo já confirmado', () => {
    const repo = createFakeRepository({ c1: envelope('c1', { mutationId: 'm1' }) });
    const { queue } = buildQueue({ characterRepository: repo, online: false });
    queue.initialize();
    const { preparationId } = queue.prepareMutation({
      mutationId: 'm1', operation: 'upsert', characterId: 'c1', expectedRevisionToken: null,
    }).value;
    queue.confirmPrepared(preparationId);

    const abortado = queue.abortPrepared(preparationId);
    assert.equal(abortado.ok, false);
    assert.equal(abortado.error.code, 'SYNC_PREPARATION_NOT_FOUND');
    assert.equal(queue.getSnapshot().pending, 1, 'o job confirmado permanece intacto');
  });

  test('reconcilePrepared PROMOVE upsert cujo marker bate com o registro salvo', () => {
    const storage = createMemoryStorage();
    const primeira = buildQueue({ storage });
    primeira.queue.initialize();
    primeira.queue.prepareMutation({ mutationId: 'm1', operation: 'upsert', characterId: 'c1', expectedRevisionToken: null });

    // Reload: o save local aconteceu (marker gravado), mas confirmPrepared não.
    const repo = createFakeRepository({ c1: envelope('c1', { mutationId: 'm1' }) });
    const segunda = buildQueue({ storage, characterRepository: repo });
    const snap = segunda.queue.initialize();

    assert.equal(snap.value.prepared, 0, 'o job preparado foi promovido');
    assert.equal(snap.value.pending, 1);
    assert.deepEqual([...snap.value.failures], []);
  });

  test('reconcilePrepared DESCARTA upsert cujo save local nunca aconteceu (com diagnóstico)', () => {
    const storage = createMemoryStorage();
    const primeira = buildQueue({ storage });
    primeira.queue.initialize();
    primeira.queue.prepareMutation({ mutationId: 'm1', operation: 'upsert', characterId: 'c1', expectedRevisionToken: null });

    const segunda = buildQueue({ storage, characterRepository: createFakeRepository({}) });
    const snap = segunda.queue.initialize();

    assert.equal(snap.value.prepared, 0);
    assert.equal(snap.value.pending, 0, 'sem registro local, não há o que enviar');
    const diags = segunda.queue.getDiagnostics();
    assert.equal(diags.filter((d) => d.code === 'SYNC_PREPARED_DISCARDED_NO_LOCAL_EFFECT').length, 1);
  });

  test('mutação concorrente com OUTRO marker vira conflito explícito, nunca envio nem descarte', async () => {
    const storage = createMemoryStorage();
    const primeira = buildQueue({ storage });
    primeira.queue.initialize();
    primeira.queue.prepareMutation({ mutationId: 'm1', operation: 'upsert', characterId: 'c1', expectedRevisionToken: null });

    const repo = createFakeRepository({ c1: envelope('c1', { mutationId: 'OUTRO' }) });
    const segunda = buildQueue({ storage, characterRepository: repo });
    const snap = segunda.queue.initialize();

    assert.equal(snap.value.failures.length, 1);
    assert.equal(snap.value.failures[0].code, 'SYNC_PREPARED_MUTATION_CONFLICT');
    assert.equal(snap.value.failures[0].retryable, false);

    await segunda.queue.flush();
    assert.deepEqual(segunda.gateway.calls, [], 'conflito nunca é enviado');
    assert.equal(lerPersistido(storage).jobs.length, 1, 'conflito nunca é descartado');
  });

  test('remoção preparada é promovida pela AUSÊNCIA do registro com o token esperado', () => {
    const storage = createMemoryStorage();
    const primeira = buildQueue({ storage });
    primeira.queue.initialize();
    primeira.queue.prepareMutation({
      mutationId: 'm2', operation: 'remove', characterId: 'c1', expectedRevisionToken: 'tok-c1',
    });

    const segunda = buildQueue({ storage, characterRepository: createFakeRepository({}) });
    const snap = segunda.queue.initialize();

    assert.equal(snap.value.pending, 1, 'a remoção local aconteceu; a remoção remota deve seguir');
    assert.deepEqual([...segunda.queue.getPendingRemovalIds()], ['c1']);
  });

  test('remoção preparada cujo registro continua lá com o MESMO token é descartada (não aconteceu)', () => {
    const storage = createMemoryStorage();
    const primeira = buildQueue({ storage });
    primeira.queue.initialize();
    primeira.queue.prepareMutation({
      mutationId: 'm2', operation: 'remove', characterId: 'c1', expectedRevisionToken: 'tok-c1',
    });

    const repo = createFakeRepository({ c1: envelope('c1', { revisionToken: 'tok-c1' }) });
    const segunda = buildQueue({ storage, characterRepository: repo });
    const snap = segunda.queue.initialize();

    assert.equal(snap.value.pending, 0, 'nunca remover na nuvem um registro que continua local e intacto');
    assert.deepEqual([...segunda.queue.getPendingRemovalIds()], []);
  });

  test('remoção preparada cujo registro foi REESCRITO por outra aba vira conflito', () => {
    const storage = createMemoryStorage();
    const primeira = buildQueue({ storage });
    primeira.queue.initialize();
    primeira.queue.prepareMutation({
      mutationId: 'm2', operation: 'remove', characterId: 'c1', expectedRevisionToken: 'tok-antigo',
    });

    const repo = createFakeRepository({ c1: envelope('c1', { revisionToken: 'tok-novo' }) });
    const segunda = buildQueue({ storage, characterRepository: repo });
    const snap = segunda.queue.initialize();

    assert.equal(snap.value.failures.length, 1);
    assert.equal(snap.value.failures[0].code, 'SYNC_PREPARED_MUTATION_CONFLICT');
  });

  test('duas preparações offline consecutivas do mesmo personagem coalescem (sem conflito espúrio no reload)', () => {
    const storage = createMemoryStorage();
    const primeira = buildQueue({ storage });
    primeira.queue.initialize();
    primeira.queue.prepareMutation({ mutationId: 'm1', operation: 'upsert', characterId: 'c1', expectedRevisionToken: null });
    primeira.queue.prepareMutation({ mutationId: 'm2', operation: 'upsert', characterId: 'c1', expectedRevisionToken: 'tok-c1' });

    assert.equal(lerPersistido(storage).jobs.length, 1, 'no máximo um job prepared por characterId');
    assert.equal(lerPersistido(storage).jobs[0].mutationId, 'm2', 'a preparação mais recente vence');

    const repo = createFakeRepository({ c1: envelope('c1', { mutationId: 'm2' }) });
    const segunda = buildQueue({ storage, characterRepository: repo });
    const snap = segunda.queue.initialize();

    assert.deepEqual([...snap.value.failures], [], 'duas gravações offline não podem virar conflito espúrio');
    assert.equal(snap.value.pending, 1);
  });
});

describe('sync-queue — adoção do merge remoto pelo repositório', () => {
  test('adotarRemoto usa replaceAll com expectedStorageRevisionToken e reason "sync"', async () => {
    const repo = createFakeRepository({ c1: envelope('c1', { updatedAt: '2026-01-01T00:00:00.000Z' }) });
    const gateway = createFakeGateway();
    gateway.list = async () =>
      ok(
        Object.freeze([
          Object.freeze({
            characterId: 'c1',
            mode: 'editable',
            character: { identity: { id: 'c1' }, metadata: { updatedAt: '2026-09-09T00:00:00.000Z' } },
            rawRecord: { id: 'c1', atualizado_em: '2026-09-09T00:00:00.000Z' },
          }),
        ]),
      );
    const { queue } = buildQueue({ characterRepository: repo, gateway });
    queue.initialize();

    const resultado = await queue.adoptRemoteMerge();
    assert.equal(resultado.ok, true);
    assert.equal(repo.replaceAllCalls.length, 1);
    assert.equal(repo.replaceAllCalls[0].options.reason, 'sync');
    assert.equal(repo.replaceAllCalls[0].options.expectedStorageRevisionToken, 'srt-1');
  });

  test('local mais novo é adotado E reenfileirado (nunca só adotado)', async () => {
    const repo = createFakeRepository({ c1: envelope('c1', { updatedAt: '2026-12-01T00:00:00.000Z' }) });
    const gateway = createFakeGateway();
    gateway.list = async () =>
      ok(
        Object.freeze([
          Object.freeze({
            characterId: 'c1',
            mode: 'editable',
            character: { identity: { id: 'c1' }, metadata: { updatedAt: '2026-01-01T00:00:00.000Z' } },
            rawRecord: { id: 'c1', atualizado_em: '2026-01-01T00:00:00.000Z' },
          }),
        ]),
      );
    const { queue } = buildQueue({ characterRepository: repo, gateway });
    queue.initialize();

    const resultado = await queue.adoptRemoteMerge();
    assert.equal(resultado.ok, true);
    assert.equal(resultado.value.pending, 1, 'o vencedor local precisa ser reenviado, não só adotado');
  });

  test('conflito de revisão no replaceAll permanece como falha retryable, sem escrita direta no storage', async () => {
    const repo = createFakeRepository({ c1: envelope('c1') });
    repo.replaceAll = (records, options) => {
      repo.replaceAllCalls.push({ records, options });
      return err(createAppError({ code: 'CHARACTER_REPLACE_ALL_REVISION_CONFLICT', scope: 'test', message: 'conflito' }));
    };
    const gateway = createFakeGateway();
    gateway.list = async () =>
      ok(
        Object.freeze([
          Object.freeze({
            characterId: 'c1',
            mode: 'editable',
            character: { identity: { id: 'c1' }, metadata: { updatedAt: '2026-09-09T00:00:00.000Z' } },
            rawRecord: { id: 'c1', atualizado_em: '2026-09-09T00:00:00.000Z' },
          }),
        ]),
      );
    const { queue, storage } = buildQueue({ characterRepository: repo, gateway });
    queue.initialize();

    const resultado = await queue.adoptRemoteMerge();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CHARACTER_REPLACE_ALL_REVISION_CONFLICT');
    assert.equal(storage.getItem('dnd_personagens'), null, 'nenhuma escrita local direta contornando o token');
  });

  test('conflito de timestamp no merge vira falha retryable retida, sem adotar nenhum lado', async () => {
    const repo = createFakeRepository({ c1: envelope('c1', { updatedAt: '' }) });
    const gateway = createFakeGateway();
    gateway.list = async () =>
      ok(
        Object.freeze([
          Object.freeze({
            characterId: 'c1',
            mode: 'editable',
            character: { identity: { id: 'c1' }, metadata: { updatedAt: '2026-09-09T00:00:00.000Z' } },
            rawRecord: { id: 'c1', atualizado_em: '2026-09-09T00:00:00.000Z' },
          }),
        ]),
      );
    const { queue } = buildQueue({ characterRepository: repo, gateway });
    queue.initialize();

    const resultado = await queue.adoptRemoteMerge();
    assert.equal(resultado.ok, true);
    const failure = resultado.value.failures.find((f) => f.code === 'SYNC_MERGE_TIMESTAMP_UNCOMPARABLE');
    assert.ok(failure, 'o conflito de timestamp precisa aparecer como falha retryable');
    assert.equal(failure.retryable, true);
  });

  test('remoções pendentes não reaparecem depois da adoção remota', async () => {
    const repo = createFakeRepository({});
    const gateway = createFakeGateway();
    gateway.list = async () =>
      ok(
        Object.freeze([
          Object.freeze({
            characterId: 'apagado',
            mode: 'editable',
            character: { identity: { id: 'apagado' }, metadata: { updatedAt: '2026-09-09T00:00:00.000Z' } },
            rawRecord: { id: 'apagado', atualizado_em: '2026-09-09T00:00:00.000Z' },
          }),
        ]),
      );
    const { queue } = buildQueue({ characterRepository: repo, gateway });
    queue.initialize();
    queue.enqueueRemoval({ characterId: 'apagado', updatedAt: '2026-09-10T00:00:00.000Z' });

    await queue.adoptRemoteMerge();
    const adotados = repo.replaceAllCalls[0].records.map((r) => r.character?.identity?.id ?? r.rawRecord?.id);
    assert.deepEqual(adotados, [], 'um personagem com remoção pendente não pode ressuscitar');
  });
});

describe('sync-queue — codec v1->v2 real antes do envio', () => {
  test('payload legado v1 na fila é migrado pelo codec real antes de ir ao gateway', async () => {
    const storage = createMemoryStorage({
      dnd_sync_queue: JSON.stringify([{ id: legacyMinimalRaw.id, dados: legacyMinimalRaw, tentativas: 0 }]),
    });
    const codecReal = {
      decode: (raw) => decodeCharacterRecord(raw, { aliasResolver, now: '2026-07-31T00:00:00.000Z' }),
    };
    const { queue, gateway } = buildQueue({ storage, codec: codecReal });
    queue.initialize();

    const resultado = await queue.flush();
    assert.equal(resultado.ok, true, `flush falhou: ${JSON.stringify(resultado.error ?? null)}`);
    assert.equal(gateway.calls.length, 1);
    const enviado = gateway.calls[0].envelope;
    assert.equal(enviado.mode, 'editable', 'o gateway recebe um envelope editável já migrado');
    assert.ok(enviado.character?.identity?.id, 'o envelope enviado carrega o personagem canônico v2');
    assert.equal(enviado.character.identity.id, legacyMinimalRaw.id);
  });

  test('migração pelo codec é idempotente: reenviar o mesmo payload produz o mesmo canônico', async () => {
    const codecReal = {
      decode: (raw) => decodeCharacterRecord(raw, { aliasResolver, now: '2026-07-31T00:00:00.000Z' }),
    };
    const primeiro = decodeCharacterRecord(legacyMinimalRaw, { aliasResolver, now: '2026-07-31T00:00:00.000Z' });
    assert.equal(primeiro.ok, true);

    const storage = createMemoryStorage({
      dnd_sync_queue: JSON.stringify([{ id: legacyMinimalRaw.id, dados: legacyMinimalRaw, tentativas: 0 }]),
    });
    const { queue, gateway } = buildQueue({ storage, codec: codecReal });
    queue.initialize();
    await queue.flush();

    assert.deepEqual(gateway.calls[0].envelope.character, primeiro.value.character);
  });
});
