// ============================================================
// Testes do gateway Firestore contra o Firestore EMULATOR real.
//
// Só rodam sob `npm run test:firebase`, que executa o preflight externo
// (`scripts/check-firebase-prerequisites.mjs`, exige Java 21) e depois
// `firebase emulators:exec --only firestore --project demo-dnd-refactor`.
// Nunca tocam um projeto Firebase real: há dois guards independentes —
// o preflight externo e o guard interno abaixo, que aborta se
// `FIRESTORE_EMULATOR_HOST` estiver ausente ou se o project id não começar
// por `demo-`.
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
  updateDoc,
  deleteDoc,
  runTransaction,
} from 'firebase/firestore';

import { createLegacyAliasResolver } from '../../site/js/infra/character/legacy-alias-resolver.js';
import { decodeCharacterRecord, encodeCharacterRecord } from '../../site/js/infra/character/character-codec.js';
import {
  createFirestoreCharacterGateway,
  REMOTE_BACKUP_COLLECTION,
} from '../../site/js/infra/firebase/firestore-character-gateway.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const PROJECT_ID = 'demo-dnd-refactor';
const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8085;
const NOW = '2026-07-31T00:00:00.000Z';

// --- Guard interno: nunca falar com um Firebase real -------------------
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'FIRESTORE_EMULATOR_HOST ausente: estes testes só podem rodar sob "firebase emulators:exec" ' +
      '(use `npm run test:firebase`). Abortando para nunca tocar um projeto Firebase real.',
  );
}
if (!PROJECT_ID.startsWith('demo-')) {
  throw new Error(`Project id "${PROJECT_ID}" não começa por "demo-": abortando para nunca tocar um projeto real.`);
}

let app;
let db;
let aliasResolver;
let codec;
let legacyMinimalRaw;
let contador = 0;

/** Id único por teste, para nenhum caso depender da limpeza de outro. */
function novoId(prefixo = 'char') {
  contador += 1;
  return `${prefixo}-${contador}`;
}

/** API do SDK injetada no gateway (nenhum import de SDK dentro do gateway). */
const firestoreApi = { collection, doc, getDoc, getDocs, deleteDoc, runTransaction };

/** Constrói um gateway para o `uid` informado. */
function gatewayFor(uid) {
  return createFirestoreCharacterGateway({ db, uid, api: firestoreApi, codec });
}

/** Personagem canônico editável derivado da fixture legada mínima. */
function personagemCanonico(id, overrides = {}) {
  const decoded = decodeCharacterRecord({ ...legacyMinimalRaw, id, ...overrides }, { aliasResolver, now: NOW });
  assert.equal(decoded.ok, true, 'a fixture legada precisa decodificar');
  assert.equal(decoded.value.mode, 'editable');
  return decoded.value.character;
}

/** Envelope editável (formato que o gateway aceita em upsert). */
function envelopeEditavel(character) {
  return { mode: 'editable', character, warnings: [], localSync: null };
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

  app = initializeApp({ projectId: PROJECT_ID }, `gateway-test-${Date.now()}`);
  db = getFirestore(app);
  // Conexão ao Emulator IMEDIATAMENTE após getFirestore e antes de
  // qualquer leitura/escrita — a variável de ambiente é guard adicional,
  // não o mecanismo de conexão.
  connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORT);
});

after(async () => {
  if (app) await deleteApp(app);
});

describe('firestore-character-gateway — upsert, listagem e remoção', () => {
  test('upsert grava o documento e list() o devolve decodificado', async () => {
    const uid = novoId('uid');
    const id = novoId();
    const gateway = gatewayFor(uid);

    const resultado = await gateway.upsert(envelopeEditavel(personagemCanonico(id)));
    assert.equal(resultado.ok, true, `upsert falhou: ${JSON.stringify(resultado.error ?? null)}`);
    assert.equal(resultado.value.characterId, id);
    assert.equal(resultado.value.remoteBackup, 'not-applicable');

    const listado = await gateway.list();
    assert.equal(listado.ok, true);
    assert.equal(listado.value.length, 1);
    assert.equal(listado.value[0].characterId, id);
    assert.equal(listado.value[0].mode, 'editable');
    assert.equal(listado.value[0].character.identity.id, id);
  });

  test('remove apaga o documento e list() volta vazia', async () => {
    const uid = novoId('uid');
    const id = novoId();
    const gateway = gatewayFor(uid);
    await gateway.upsert(envelopeEditavel(personagemCanonico(id)));

    const removido = await gateway.remove(id);
    assert.equal(removido.ok, true);

    const listado = await gateway.list();
    assert.equal(listado.ok, true);
    assert.deepEqual([...listado.value], []);
  });

  test('list() decodifica um documento v1 remoto pelo migrador v1->v2', async () => {
    const uid = novoId('uid');
    const id = novoId();
    // Escrita DIRETA do registro legado v1, como um cliente antigo faria.
    await setDoc(doc(db, `users/${uid}/personagens`, id), { ...legacyMinimalRaw, id });

    const listado = await gatewayFor(uid).list();
    assert.equal(listado.ok, true);
    assert.equal(listado.value.length, 1);
    assert.equal(listado.value[0].mode, 'editable', 'um documento v1 remoto precisa vir migrado para v2');
    assert.equal(listado.value[0].character.identity.id, id);
  });

  test('documento de schema FUTURO volta somente-leitura, com o bruto preservado', async () => {
    const uid = novoId('uid');
    const id = novoId();
    const futuro = { id, nome: 'Do Futuro', atualizado_em: NOW, _schema: { version: 999 }, campo_novo: 'preservar' };
    await setDoc(doc(db, `users/${uid}/personagens`, id), futuro);

    const listado = await gatewayFor(uid).list();
    assert.equal(listado.ok, true);
    assert.equal(listado.value[0].mode, 'read-only');
    assert.equal(listado.value[0].rawRecord.campo_novo, 'preservar');
  });

  test('upsert de envelope somente-leitura é RECUSADO e não grava nada', async () => {
    const uid = novoId('uid');
    const id = novoId();
    const gateway = gatewayFor(uid);

    const resultado = await gateway.upsert({ mode: 'read-only', rawRecord: { id, _schema: { version: 999 } } });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'REMOTE_UPSERT_READ_ONLY_ENVELOPE');

    const snapshot = await getDoc(doc(db, `users/${uid}/personagens`, id));
    assert.equal(snapshot.exists(), false, 'nada pode ter sido gravado');
  });

  test('documento grande demais vira REMOTE_DOCUMENT_TOO_LARGE (Result, sem lançar)', async () => {
    const uid = novoId('uid');
    const id = novoId();
    const nomeGigante = 'x'.repeat(1_200_000); // acima do limite de ~1 MiB do Firestore
    const character = personagemCanonico(id, { nome: nomeGigante });
    assert.equal(character.identity.name.length, nomeGigante.length, 'a fixture precisa realmente carregar o nome gigante');

    const resultado = await gatewayFor(uid).upsert(envelopeEditavel(character));
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'REMOTE_DOCUMENT_TOO_LARGE');

    const snapshot = await getDoc(doc(db, `users/${uid}/personagens`, id));
    assert.equal(snapshot.exists(), false, 'o registro permanece apenas local');
  });

  test('isolamento: o gateway de um uid nunca enxerga os personagens de outro', async () => {
    const uidA = novoId('uid');
    const uidB = novoId('uid');
    const idA = novoId();
    const idB = novoId();

    await gatewayFor(uidA).upsert(envelopeEditavel(personagemCanonico(idA)));
    await gatewayFor(uidB).upsert(envelopeEditavel(personagemCanonico(idB)));

    const listaA = await gatewayFor(uidA).list();
    assert.deepEqual(listaA.value.map((e) => e.characterId), [idA]);

    const listaB = await gatewayFor(uidB).list();
    assert.deepEqual(listaB.value.map((e) => e.characterId), [idB]);
  });

  test('erro operacional preserva o erro estruturado sem lançar', async () => {
    const uid = novoId('uid');
    // Um id inválido como segmento de caminho é rejeitado ANTES da rede.
    const resultado = await gatewayFor(uid).upsert(
      envelopeEditavel({ identity: { id: 'com/barra' }, metadata: { updatedAt: NOW, createdAt: NOW } }),
    );
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'REMOTE_UPSERT_INVALID_ID');
    assert.equal(resultado.error.name, 'AppError');
  });
});

describe('firestore-character-gateway — backup remoto pré-migração', () => {
  test('primeiro upsert sobre documento remoto EXISTENTE copia os bytes exatos para o backup', async () => {
    const uid = novoId('uid');
    const id = novoId();
    const anterior = { ...legacyMinimalRaw, id, marca_pre_migracao: 'bytes originais' };
    await setDoc(doc(db, `users/${uid}/personagens`, id), anterior);

    const resultado = await gatewayFor(uid).upsert(envelopeEditavel(personagemCanonico(id)));
    assert.equal(resultado.ok, true, `upsert falhou: ${JSON.stringify(resultado.error ?? null)}`);
    assert.equal(resultado.value.remoteBackup, 'created');

    const backup = await getDoc(doc(db, `users/${uid}/${REMOTE_BACKUP_COLLECTION}`, id));
    assert.equal(backup.exists(), true);
    assert.deepEqual(backup.data(), anterior, 'o backup precisa ser VERBATIM, sem decodificar nem migrar');
  });

  test('segundo upsert NÃO recria nem sobrescreve o backup já existente', async () => {
    const uid = novoId('uid');
    const id = novoId();
    const anterior = { ...legacyMinimalRaw, id, marca_pre_migracao: 'primeiro estado' };
    await setDoc(doc(db, `users/${uid}/personagens`, id), anterior);
    const gateway = gatewayFor(uid);

    const primeiro = await gateway.upsert(envelopeEditavel(personagemCanonico(id)));
    assert.equal(primeiro.value.remoteBackup, 'created');

    const segundo = await gateway.upsert(envelopeEditavel(personagemCanonico(id, { nome: 'Outro Nome' })));
    assert.equal(segundo.ok, true);
    assert.equal(segundo.value.remoteBackup, 'already-existed');

    const backup = await getDoc(doc(db, `users/${uid}/${REMOTE_BACKUP_COLLECTION}`, id));
    assert.deepEqual(backup.data(), anterior, 'o backup é criado uma única vez e nunca atualizado');
  });

  test('personagem nunca sincronizado antes não cria backup (not-applicable)', async () => {
    const uid = novoId('uid');
    const id = novoId();

    const resultado = await gatewayFor(uid).upsert(envelopeEditavel(personagemCanonico(id)));
    assert.equal(resultado.value.remoteBackup, 'not-applicable');

    const backup = await getDoc(doc(db, `users/${uid}/${REMOTE_BACKUP_COLLECTION}`, id));
    assert.equal(backup.exists(), false, 'sem dado anterior não há nada a preservar');
  });

  test('ATOMICIDADE: se a escrita do backup falhar, o documento v2 também NÃO é gravado', async () => {
    const uid = novoId('uid');
    // O prefixo `denybackup-` é negado pelas regras de teste no subcaminho
    // de backup — é assim que simulamos a falha da escrita do backup.
    const id = `denybackup-${novoId()}`;
    const anterior = { ...legacyMinimalRaw, id, marca_pre_migracao: 'precisa sobreviver' };
    await setDoc(doc(db, `users/${uid}/personagens`, id), anterior);

    const resultado = await gatewayFor(uid).upsert(envelopeEditavel(personagemCanonico(id)));
    assert.equal(resultado.ok, false, 'upsert precisa falhar inteiro quando o backup falha (fail-closed)');
    assert.equal(resultado.error.code, 'REMOTE_PERMISSION_DENIED');

    const vivo = await getDoc(doc(db, `users/${uid}/personagens`, id));
    assert.deepEqual(vivo.data(), anterior, 'o documento anterior precisa estar intacto: nunca uma gravação parcial');

    const backup = await getDoc(doc(db, `users/${uid}/${REMOTE_BACKUP_COLLECTION}`, id));
    assert.equal(backup.exists(), false);
  });

  test('CORRIDA: dois upserts CONCORRENTES no mesmo personagem nunca sobrescrevem o backup', async () => {
    const uid = novoId('uid');
    const id = novoId();
    const anterior = { ...legacyMinimalRaw, id, marca_pre_migracao: 'bytes originais irrecuperáveis' };
    await setDoc(doc(db, `users/${uid}/personagens`, id), anterior);

    // Duas "abas" independentes (dois gateways) disparadas SEM await entre
    // elas: ambas partem do mesmo estado (documento v1 presente, backup
    // ausente). Com a versão anterior — `getDoc` fora do `WriteBatch` — as
    // duas decidiam "created" e as duas emitiam um `set` no subcaminho de
    // backup; só a regra de segurança barrava a segunda (e regras vivem
    // fora deste repositório). Com `runTransaction`, o perdedor da
    // contenção reexecuta, relê o backup JÁ criado e cai em
    // "already-existed" — nenhuma segunda escrita é sequer tentada.
    const [primeiro, segundo] = await Promise.all([
      gatewayFor(uid).upsert(envelopeEditavel(personagemCanonico(id, { nome: 'Aba A' }))),
      gatewayFor(uid).upsert(envelopeEditavel(personagemCanonico(id, { nome: 'Aba B' }))),
    ]);

    assert.equal(primeiro.ok, true, `aba A falhou: ${JSON.stringify(primeiro.error ?? null)}`);
    assert.equal(segundo.ok, true, `aba B falhou: ${JSON.stringify(segundo.error ?? null)}`);

    // Exatamente UMA das duas pode ter criado o backup; a outra tem de ter
    // OBSERVADO o backup já existente — nunca duas criações.
    const decisoes = [primeiro.value.remoteBackup, segundo.value.remoteBackup].sort();
    assert.deepEqual(decisoes, ['already-existed', 'created'], `decisões inesperadas: ${JSON.stringify(decisoes)}`);

    const backup = await getDoc(doc(db, `users/${uid}/${REMOTE_BACKUP_COLLECTION}`, id));
    assert.equal(backup.exists(), true);
    assert.deepEqual(
      backup.data(),
      anterior,
      'o backup precisa continuar sendo os bytes PRÉ-migração; um documento já-v2 aqui significaria perda irreversível',
    );

    // E o documento vivo ficou com uma das duas escritas inteiras (nunca
    // uma mistura nem uma escrita perdida por conflito).
    const vivo = await getDoc(doc(db, `users/${uid}/personagens`, id));
    assert.equal(vivo.exists(), true);
    assert.ok(['Aba A', 'Aba B'].includes(vivo.data().nome), `nome inesperado no documento vivo: ${vivo.data().nome}`);
  });

  test('CORRIDA: várias escritas concorrentes mantêm UMA única criação de backup', async () => {
    const uid = novoId('uid');
    const id = novoId();
    const anterior = { ...legacyMinimalRaw, id, marca_pre_migracao: 'estado pré-migração' };
    await setDoc(doc(db, `users/${uid}/personagens`, id), anterior);

    const resultados = await Promise.all(
      ['A', 'B', 'C', 'D'].map((marca) =>
        gatewayFor(uid).upsert(envelopeEditavel(personagemCanonico(id, { nome: `Aba ${marca}` }))),
      ),
    );

    for (const resultado of resultados) {
      assert.equal(resultado.ok, true, `um upsert concorrente falhou: ${JSON.stringify(resultado.error ?? null)}`);
    }
    const criados = resultados.filter((r) => r.value.remoteBackup === 'created').length;
    assert.equal(criados, 1, 'o backup só pode ter sido criado uma única vez, por um único vencedor');

    const backup = await getDoc(doc(db, `users/${uid}/${REMOTE_BACKUP_COLLECTION}`, id));
    assert.deepEqual(backup.data(), anterior, 'o backup pré-migração nunca é reescrito, nem sob contenção');
  });
});

describe('firestore.rules — as quatro combinações no subcaminho de backup', () => {
  test('create em documento AUSENTE é permitido', async () => {
    const uid = novoId('uid');
    const id = novoId();
    await setDoc(doc(db, `users/${uid}/${REMOTE_BACKUP_COLLECTION}`, id), { original: true });

    const backup = await getDoc(doc(db, `users/${uid}/${REMOTE_BACKUP_COLLECTION}`, id));
    assert.equal(backup.exists(), true);
  });

  test('create sobre documento JÁ EXISTENTE é negado (o backup nunca é recriado)', async () => {
    const uid = novoId('uid');
    const id = novoId();
    const backupRef = doc(db, `users/${uid}/${REMOTE_BACKUP_COLLECTION}`, id);
    await setDoc(backupRef, { original: true });

    await assert.rejects(() => setDoc(backupRef, { original: false }), /permission|insufficient/i);
    const backup = await getDoc(backupRef);
    assert.deepEqual(backup.data(), { original: true });
  });

  test('update é negado', async () => {
    const uid = novoId('uid');
    const id = novoId();
    const backupRef = doc(db, `users/${uid}/${REMOTE_BACKUP_COLLECTION}`, id);
    await setDoc(backupRef, { original: true });

    await assert.rejects(() => updateDoc(backupRef, { original: false }), /permission|insufficient/i);
    const backup = await getDoc(backupRef);
    assert.deepEqual(backup.data(), { original: true });
  });

  test('delete é negado (nem um bug do client nem o usuário apagam o backup)', async () => {
    const uid = novoId('uid');
    const id = novoId();
    const backupRef = doc(db, `users/${uid}/${REMOTE_BACKUP_COLLECTION}`, id);
    await setDoc(backupRef, { original: true });

    await assert.rejects(() => deleteDoc(backupRef), /permission|insufficient/i);
    const backup = await getDoc(backupRef);
    assert.equal(backup.exists(), true);
  });
});
