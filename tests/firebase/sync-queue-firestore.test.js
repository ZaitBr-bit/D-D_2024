// ============================================================
// Integração de ponta a ponta da fila de sync com o Firestore EMULATOR
// real: `SyncQueue` + repositório transacional (sobre storage em memória)
// + gateway real. Prova a migração da fila legada seguida de upsert
// efetivo, a remoção pendente que não ressuscita e as DUAS direções do
// conflito por `atualizado_em`.
//
// Só roda sob `npm run test:firebase` (ver o guard interno abaixo).
// ============================================================
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  runTransaction,
} from 'firebase/firestore';

import { createMemoryStorage } from '../helpers/memory-storage.js';
import { createLegacyAliasResolver } from '../../site/js/infra/character/legacy-alias-resolver.js';
import { createPreMigrationBackupService } from '../../site/js/infra/character/pre-migration-backup.js';
import { decodeCharacterRecord, encodeCharacterRecord } from '../../site/js/infra/character/character-codec.js';
import {
  LocalStorageCharacterRepository,
  CHARACTER_STORAGE_KEY,
} from '../../site/js/infra/character/local-storage-character-repository.js';
import { createFirestoreCharacterGateway } from '../../site/js/infra/firebase/firestore-character-gateway.js';
import { createSyncQueue, SYNC_QUEUE_KEY } from '../../site/js/infra/sync/sync-queue.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const PROJECT_ID = 'demo-dnd-refactor';
const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8085;
const NOW = '2026-07-31T00:00:00.000Z';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'FIRESTORE_EMULATOR_HOST ausente: estes testes só podem rodar sob "firebase emulators:exec" (use `npm run test:firebase`).',
  );
}
if (!PROJECT_ID.startsWith('demo-')) {
  throw new Error(`Project id "${PROJECT_ID}" não começa por "demo-": abortando.`);
}

let app;
let db;
let aliasResolver;
let codec;
let legacyMinimalRaw;
let contador = 0;

/** Id único por teste. */
function novoId(prefixo = 'char') {
  contador += 1;
  return `${prefixo}-${contador}`;
}

const firestoreApi = { collection, doc, getDoc, getDocs, deleteDoc, runTransaction };

/**
 * Monta o conjunto completo (storage em memória + repositório real +
 * gateway real do Emulator + fila) para um `uid`.
 * @param {{uid: string, initialStorage?: object}} params
 */
function buildStack({ uid, initialStorage = {} }) {
  const storage = createMemoryStorage(initialStorage);
  const backupService = createPreMigrationBackupService({ storage });
  const repository = LocalStorageCharacterRepository({
    storage,
    aliasResolver,
    backupService,
    clock: { now: () => NOW },
  });
  const gateway = createFirestoreCharacterGateway({ db, uid, api: firestoreApi, codec });
  const scheduler = { schedule: () => null, cancel: () => {} };
  const queue = createSyncQueue({
    storage,
    gateway,
    characterRepository: repository,
    connectivity: { isOnline: () => true },
    scheduler,
    codec: { decode: codec.decode },
    clock: { now: () => NOW },
  });
  return { storage, repository, gateway, queue };
}

/** Registro legado v1 com id e `atualizado_em` controlados. */
function registroLegado(id, atualizadoEm) {
  return { ...legacyMinimalRaw, id, atualizado_em: atualizadoEm };
}

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  aliasResolver = createLegacyAliasResolver(aliases);
  const fixture = JSON.parse(
    await readFile(path.join(repoRoot, 'tests/fixtures/characters/legacy-minimal.json'), 'utf8'),
  );
  legacyMinimalRaw = fixture.cases[0].personagem;

  codec = {
    decode: (raw) => decodeCharacterRecord(raw, { aliasResolver, now: NOW }),
    encode: (character) => encodeCharacterRecord(character, { aliasResolver, localSync: null }),
  };

  app = initializeApp({ projectId: PROJECT_ID }, `queue-test-${Date.now()}`);
  db = getFirestore(app);
  connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORT);
});

after(async () => {
  if (app) await deleteApp(app);
});

describe('sync-queue + Firestore Emulator — fila legada', () => {
  test('fila legada semeada em dnd_sync_queue é migrada e o upsert chega ao Firestore', async () => {
    const uid = novoId('uid');
    const id = novoId();
    const legado = registroLegado(id, '2026-01-01T00:00:00.000Z');

    const { queue, storage } = buildStack({
      uid,
      initialStorage: {
        // Shape legado EXATO: array de {id, dados, tentativas}.
        [SYNC_QUEUE_KEY]: JSON.stringify([{ id, dados: legado, tentativas: 1 }]),
      },
    });

    const inicializada = queue.initialize();
    assert.equal(inicializada.ok, true);
    assert.equal(inicializada.value.pending, 1, 'a pendência legada não pode ser perdida');

    const resultado = await queue.flush();
    assert.equal(resultado.ok, true);
    assert.deepEqual([...resultado.value.failures], [], 'nenhuma falha esperada');
    assert.equal(resultado.value.pending, 0, 'o job deve sair da fila após o sucesso');

    // O documento remoto existe e está migrado para v2 (o codec rodou antes do envio).
    const remoto = await getDoc(doc(db, `users/${uid}/personagens`, id));
    assert.equal(remoto.exists(), true);
    assert.equal(remoto.data().id, id);
    assert.ok(remoto.data()._schema, 'o documento enviado precisa carregar o marcador de schema v2');

    // A chave da fila continua sendo a única (migração in-place).
    assert.ok(SYNC_QUEUE_KEY in storage.dump());
  });

  test('remoção legada pendente é propagada e o personagem não reaparece no merge', async () => {
    const uid = novoId('uid');
    const id = novoId();
    // O personagem existe no servidor...
    await setDoc(doc(db, `users/${uid}/personagens`, id), registroLegado(id, '2026-01-01T00:00:00.000Z'));

    // ...e a fila legada carrega a remoção feita offline.
    const { queue, repository, storage } = buildStack({
      uid,
      initialStorage: { [SYNC_QUEUE_KEY]: JSON.stringify([{ id, acao: 'remover', tentativas: 0 }]) },
    });
    repository.initialize();
    queue.initialize();

    assert.deepEqual([...queue.getPendingRemovalIds()], [id]);

    // Antes do flush, uma adoção remota NÃO pode ressuscitar o personagem.
    const adotado = await queue.adoptRemoteMerge();
    assert.equal(adotado.ok, true, `adoptRemoteMerge falhou: ${JSON.stringify(adotado.error ?? null)}`);
    const locais = repository.list();
    assert.deepEqual(
      locais.value.characters.map((e) => e.character?.identity?.id ?? e.rawRecord?.id),
      [],
      'um personagem com remoção pendente nunca ressuscita localmente',
    );

    const resultado = await queue.flush();
    assert.equal(resultado.ok, true);
    const remoto = await getDoc(doc(db, `users/${uid}/personagens`, id));
    assert.equal(remoto.exists(), false, 'a remoção precisa ter chegado ao servidor');
    assert.deepEqual([...queue.getPendingRemovalIds()], [], 'a pendência de remoção some após o sucesso');
    assert.equal(repository.list().value.characters.length, 0, 'o personagem removido não pode voltar ao storage local');
    assert.ok(SYNC_QUEUE_KEY in storage.dump(), 'a fila continua na chave legada única');
  });
});

describe('sync-queue + Firestore Emulator — as duas direções do conflito por atualizado_em', () => {
  test('LOCAL mais novo vence, é adotado E reenviado ao servidor', async () => {
    const uid = novoId('uid');
    const id = novoId();
    const remotoAntigo = registroLegado(id, '2026-01-01T00:00:00.000Z');
    await setDoc(doc(db, `users/${uid}/personagens`, id), remotoAntigo);

    const { queue, repository } = buildStack({
      uid,
      initialStorage: { [CHARACTER_STORAGE_KEY]: JSON.stringify([registroLegado(id, '2026-12-31T00:00:00.000Z')]) },
    });
    repository.initialize();
    queue.initialize();

    const adotado = await queue.adoptRemoteMerge();
    assert.equal(adotado.ok, true, `adoptRemoteMerge falhou: ${JSON.stringify(adotado.error ?? null)}`);
    assert.equal(adotado.value.pending, 1, 'o vencedor local precisa ser reenfileirado, não só adotado');

    const local = repository.list().value.characters[0];
    assert.equal(local.character.metadata.updatedAt, '2026-12-31T00:00:00.000Z', 'o local mais novo permanece local');

    await queue.flush();
    const remoto = await getDoc(doc(db, `users/${uid}/personagens`, id));
    assert.equal(remoto.data().atualizado_em, '2026-12-31T00:00:00.000Z', 'o vencedor local precisa chegar ao servidor');
  });

  test('REMOTO mais novo vence e é adotado localmente, sem reenvio', async () => {
    const uid = novoId('uid');
    const id = novoId();
    await setDoc(doc(db, `users/${uid}/personagens`, id), registroLegado(id, '2026-12-31T00:00:00.000Z'));

    const { queue, repository } = buildStack({
      uid,
      initialStorage: { [CHARACTER_STORAGE_KEY]: JSON.stringify([registroLegado(id, '2026-01-01T00:00:00.000Z')]) },
    });
    repository.initialize();
    queue.initialize();

    const adotado = await queue.adoptRemoteMerge();
    assert.equal(adotado.ok, true, `adoptRemoteMerge falhou: ${JSON.stringify(adotado.error ?? null)}`);
    assert.equal(adotado.value.pending, 0, 'nada a reenviar quando o remoto vence');

    const local = repository.list().value.characters[0];
    assert.equal(local.character.metadata.updatedAt, '2026-12-31T00:00:00.000Z', 'o remoto mais novo precisa ser adotado localmente');
  });

  test('atualizado_em não comparável de um dos lados vira conflito retido, sem vencedor', async () => {
    const uid = novoId('uid');
    const id = novoId();
    await setDoc(doc(db, `users/${uid}/personagens`, id), registroLegado(id, 'data invalida'));

    const { queue, repository } = buildStack({
      uid,
      initialStorage: { [CHARACTER_STORAGE_KEY]: JSON.stringify([registroLegado(id, '2026-01-01T00:00:00.000Z')]) },
    });
    repository.initialize();
    queue.initialize();

    const adotado = await queue.adoptRemoteMerge();
    assert.equal(adotado.ok, true);
    const conflito = adotado.value.failures.find((f) => f.code === 'SYNC_MERGE_TIMESTAMP_UNCOMPARABLE');
    assert.ok(conflito, 'o conflito precisa ficar visível como falha');
    assert.equal(conflito.retryable, true);

    const local = repository.list().value.characters[0];
    assert.equal(local.character.metadata.updatedAt, '2026-01-01T00:00:00.000Z', 'o baseline local não pode ser sobrescrito por um conflito');
  });
});

describe('sync-queue + Firestore Emulator — escopo por uid', () => {
  test('job de outro usuário nunca é enviado para o caminho do usuário atual', async () => {
    const uidAlice = novoId('uid');
    const uidBob = novoId('uid');
    const id = novoId();

    const storageCompartilhado = createMemoryStorage({
      [SYNC_QUEUE_KEY]: JSON.stringify({
        version: 2,
        jobs: [
          {
            jobId: `job:${id}`,
            uid: uidAlice,
            operation: 'upsert',
            characterId: id,
            record: registroLegado(id, '2026-01-01T00:00:00.000Z'),
            updatedAt: '2026-01-01T00:00:00.000Z',
            mutationId: null,
            expectedRevisionToken: null,
            state: 'ready',
            attempts: 0,
            lastError: null,
          },
        ],
        conflicts: [],
      }),
    });

    const backupService = createPreMigrationBackupService({ storage: storageCompartilhado });
    const repository = LocalStorageCharacterRepository({
      storage: storageCompartilhado,
      aliasResolver,
      backupService,
      clock: { now: () => NOW },
    });
    const queueBob = createSyncQueue({
      storage: storageCompartilhado,
      gateway: createFirestoreCharacterGateway({ db, uid: uidBob, api: firestoreApi, codec }),
      characterRepository: repository,
      connectivity: { isOnline: () => true },
      scheduler: { schedule: () => null, cancel: () => {} },
      codec: { decode: codec.decode },
      clock: { now: () => NOW },
    });

    const inicializada = queueBob.initialize();
    assert.equal(inicializada.value.failures[0].code, 'SYNC_JOB_FOREIGN_UID');
    await queueBob.flush();

    const noCaminhoDoBob = await getDoc(doc(db, `users/${uidBob}/personagens`, id));
    assert.equal(noCaminhoDoBob.exists(), false, 'o personagem de Alice jamais pode aparecer no caminho de Bob');
    const noCaminhoDaAlice = await getDoc(doc(db, `users/${uidAlice}/personagens`, id));
    assert.equal(noCaminhoDaAlice.exists(), false, 'o job em quarentena também não é enviado ao dono sem ele autenticar');
  });
});
