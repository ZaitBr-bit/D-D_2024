import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMemoryStorage } from '../../helpers/memory-storage.js';
import { createLegacyAliasResolver } from '../../../site/js/infra/character/legacy-alias-resolver.js';
import { createPreMigrationBackupService, PRE_MIGRATION_BACKUP_KEY } from '../../../site/js/infra/character/pre-migration-backup.js';
import { decodeCharacterRecord } from '../../../site/js/infra/character/character-codec.js';
import {
  LocalStorageCharacterRepository,
  CHARACTER_STORAGE_KEY,
} from '../../../site/js/infra/character/local-storage-character-repository.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const fixturesDir = path.join(repoRoot, 'tests/fixtures/characters');
const NOW = '2026-07-30T00:00:00.000Z';

let aliasResolver;
let legacyMinimalRaw;

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  aliasResolver = createLegacyAliasResolver(aliases);
  const fixture = JSON.parse(await readFile(path.join(fixturesDir, 'legacy-minimal.json'), 'utf8'));
  legacyMinimalRaw = fixture.cases[0].personagem;
});

/**
 * Monta um repositório novo sobre um storage novo, com relógio controlável.
 * @param {{initial?: object, tickStart?: number}} [params]
 */
function buildRepository({ initial, tickStart = 0 } = {}) {
  const storage = createMemoryStorage(initial);
  const backupService = createPreMigrationBackupService({ storage, tokenFactory: () => `tok-${Math.random()}` });
  let tick = tickStart;
  const clock = { now: () => { tick += 1; return `2026-07-30T00:00:${String(tick).padStart(2, '0')}.000Z`; } };
  const repository = LocalStorageCharacterRepository({ storage, aliasResolver, backupService, clock });
  return { storage, repository, backupService, clock };
}

/** Decodifica a fixture legada mínima para um personagem canônico editável. */
function decodeMinimalCharacter(idSuffix = '') {
  const raw = { ...legacyMinimalRaw, id: `char-${idSuffix || 'a'}` };
  const decoded = decodeCharacterRecord(raw, { aliasResolver, now: NOW });
  assert.equal(decoded.ok, true);
  return decoded.value.character;
}

describe('local-storage-character-repository — initialize()', () => {
  test('storage ausente: lista vazia, nenhuma escrita', () => {
    const { repository, storage } = buildRepository();
    const result = repository.initialize();
    assert.equal(result.ok, true);
    assert.equal(result.value.charactersCount, 0);
    assert.equal(storage.getItem(CHARACTER_STORAGE_KEY), null);
  });

  test('registro v1 legado é migrado, backup criado, e storage regravado uma única vez', () => {
    const raw = [{ ...legacyMinimalRaw, id: 'char-1' }];
    const { repository, storage } = buildRepository({ initial: { [CHARACTER_STORAGE_KEY]: JSON.stringify(raw) } });
    const result = repository.initialize();
    assert.equal(result.ok, true);
    assert.equal(result.value.migratedCount, 1);
    assert.equal(result.value.readOnlyCount, 0);

    const persisted = JSON.parse(storage.getItem(CHARACTER_STORAGE_KEY));
    assert.equal(persisted[0]._schema.version, 2);
    assert.equal(storage.getItem(PRE_MIGRATION_BACKUP_KEY), JSON.stringify(raw));
  });

  test('registro já v2: nenhuma escrita implícita (bytes originais preservados)', () => {
    const character = decodeMinimalCharacter('v2');
    const { repository: setupRepo, storage: setupStorage } = buildRepository();
    const saveResult = setupRepo.save(character, { expectedRevisionToken: null, reason: 'user' });
    assert.equal(saveResult.ok, true);
    const bytesBeforeInit = setupStorage.getItem(CHARACTER_STORAGE_KEY);

    const backupService = createPreMigrationBackupService({ storage: setupStorage });
    const repository2 = LocalStorageCharacterRepository({ storage: setupStorage, aliasResolver, backupService, clock: { now: () => NOW } });
    const initResult = repository2.initialize();
    assert.equal(initResult.ok, true);
    assert.equal(initResult.value.migratedCount, 0);
    assert.equal(setupStorage.getItem(CHARACTER_STORAGE_KEY), bytesBeforeInit, 'não deveria regravar quando nada precisa migrar');
  });

  test('JSON corrompido: initialize() falha e não apaga/mexe nos bytes', () => {
    const { repository, storage } = buildRepository({ initial: { [CHARACTER_STORAGE_KEY]: '{ nao e json' } });
    const result = repository.initialize();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'LOCAL_STORAGE_CORRUPT_JSON');
    assert.equal(storage.getItem(CHARACTER_STORAGE_KEY), '{ nao e json', 'bytes corrompidos continuam intactos/exportáveis');
  });

  test('backup falha por quota: initialize() bloqueia migração e não escreve nada', () => {
    const raw = [{ ...legacyMinimalRaw, id: 'char-1' }];
    const { repository, storage } = buildRepository({ initial: { [CHARACTER_STORAGE_KEY]: JSON.stringify(raw) } });
    storage.setQuotaExceeded(true);
    const result = repository.initialize();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_BACKUP_WRITE_FAILED');
    storage.setQuotaExceeded(false);
    assert.equal(storage.getItem(CHARACTER_STORAGE_KEY), JSON.stringify(raw), 'nenhuma adoção parcial: bytes originais intactos');
  });
});

describe('local-storage-character-repository — list()/get() nunca escrevem', () => {
  test('list() em storage vazio devolve lista vazia sem tocar storage', () => {
    const { repository, storage } = buildRepository();
    const before = storage.getItem(CHARACTER_STORAGE_KEY);
    const result = repository.list();
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.characters, []);
    assert.equal(storage.getItem(CHARACTER_STORAGE_KEY), before);
  });

  test('list()/get() com registro v2 válido não alteram os bytes', () => {
    const character = decodeMinimalCharacter('ro');
    const { repository, storage } = buildRepository();
    repository.save(character, { expectedRevisionToken: null, reason: 'user' });
    const bytesBefore = storage.getItem(CHARACTER_STORAGE_KEY);

    repository.list();
    repository.list();
    repository.get(character.identity.id);
    assert.equal(storage.getItem(CHARACTER_STORAGE_KEY), bytesBefore);
  });

  test('get() de id inexistente devolve null (não erro)', () => {
    const { repository } = buildRepository();
    const result = repository.get('nao-existe');
    assert.equal(result.ok, true);
    assert.equal(result.value, null);
  });

  test('JSON corrompido: list()/get() retornam erro, nunca lista vazia', () => {
    const { repository } = buildRepository({ initial: { [CHARACTER_STORAGE_KEY]: '[ nao fecha' } });
    const listResult = repository.list();
    assert.equal(listResult.ok, false);
    assert.equal(listResult.error.code, 'LOCAL_STORAGE_CORRUPT_JSON');

    const getResult = repository.get('qualquer');
    assert.equal(getResult.ok, false);
    assert.equal(getResult.error.code, 'LOCAL_STORAGE_CORRUPT_JSON');
  });

  test('um registro individual corrompido/inválido fica read-only com erro anexado, sem derrubar os demais', () => {
    const good = { ...legacyMinimalRaw, id: 'char-good' };
    // pericias_proficientes com valor não-array força uma falha real de decode
    // (cada caractere da string é tratado como um alias inexistente).
    const bad = { _schema: { version: 2 }, id: 'char-bad', pericias_proficientes: 'nao-e-array' };
    const { repository } = buildRepository({ initial: { [CHARACTER_STORAGE_KEY]: JSON.stringify([good, bad]) } });
    const result = repository.list();
    assert.equal(result.ok, true);
    assert.equal(result.value.characters.length, 2);
    const badEnvelope = result.value.characters.find((c) => c.mode === 'read-only');
    assert.ok(badEnvelope, 'registro inválido deveria virar envelope read-only');
    assert.equal(badEnvelope.rawRecord.id, 'char-bad');
    assert.ok(badEnvelope.decodeError, 'erro de decode deveria estar anexado');
  });
});

describe('local-storage-character-repository — save() criação/atualização/conflito', () => {
  test('criação exige expectedRevisionToken: null e falha se já existe', () => {
    const character = decodeMinimalCharacter('c1');
    const { repository } = buildRepository();
    const first = repository.save(character, { expectedRevisionToken: null, reason: 'user' });
    assert.equal(first.ok, true);
    assert.equal(first.value.mode, 'editable');
    assert.equal(typeof first.value.revisionToken, 'string');

    const second = repository.save(character, { expectedRevisionToken: null, reason: 'user' });
    assert.equal(second.ok, false);
    assert.equal(second.error.code, 'CHARACTER_SAVE_ALREADY_EXISTS');
  });

  test('atualização exige o token retornado por get/list; token stale é recusado', () => {
    const character = decodeMinimalCharacter('c2');
    const { repository } = buildRepository();
    const created = repository.save(character, { expectedRevisionToken: null, reason: 'user' });
    const staleToken = created.value.revisionToken;

    const renamed = { ...created.value.character, identity: { ...created.value.character.identity, name: 'Novo Nome' } };
    const updated = repository.save(renamed, { expectedRevisionToken: staleToken, reason: 'user' });
    assert.equal(updated.ok, true);
    assert.notEqual(updated.value.revisionToken, staleToken, 'fingerprint deveria mudar após a escrita');

    // Segunda tentativa com o MESMO token antigo (já consumido) deve ser conflito.
    const conflicting = repository.save(renamed, { expectedRevisionToken: staleToken, reason: 'user' });
    assert.equal(conflicting.ok, false);
    assert.equal(conflicting.error.code, 'CHARACTER_SAVE_REVISION_CONFLICT');
  });

  test('duas escritas no mesmo milissegundo: token da primeira leitura conflita depois da primeira escrita mesmo com atualizado_em igual', () => {
    const character = decodeMinimalCharacter('c3');
    // Relógio fixo (mesmo "milissegundo" em todas as chamadas).
    const storage = createMemoryStorage();
    const backupService = createPreMigrationBackupService({ storage });
    const repository = LocalStorageCharacterRepository({ storage, aliasResolver, backupService, clock: { now: () => NOW } });

    const created = repository.save(character, { expectedRevisionToken: null, reason: 'user' });
    const readToken = created.value.revisionToken;

    const editA = { ...created.value.character, identity: { ...created.value.character.identity, name: 'Aba A' } };
    const editB = { ...created.value.character, identity: { ...created.value.character.identity, name: 'Aba B' } };

    const writeA = repository.save(editA, { expectedRevisionToken: readToken, reason: 'user' });
    assert.equal(writeA.ok, true);
    // atualizado_em é o MESMO relógio congelado — mas o conteúdo (nome) mudou, logo o fingerprint mudou.
    assert.equal(writeA.value.character.metadata.updatedAt, NOW);

    const writeB = repository.save(editB, { expectedRevisionToken: readToken, reason: 'user' });
    assert.equal(writeB.ok, false);
    assert.equal(writeB.error.code, 'CHARACTER_SAVE_REVISION_CONFLICT', 'aba B deveria ser recusada mesmo com atualizado_em idêntico ao da aba A');
  });

  test('revisionToken nunca é persistido nem exportado; recordFingerprint muda com qualquer byte', () => {
    const character = decodeMinimalCharacter('c4');
    const { repository, storage } = buildRepository();
    const created = repository.save(character, { expectedRevisionToken: null, reason: 'user' });
    const persistedText = storage.getItem(CHARACTER_STORAGE_KEY);
    assert.equal(persistedText.includes(created.value.revisionToken), false);

    const renamed = { ...created.value.character, identity: { ...created.value.character.identity, name: 'X' } };
    const updated = repository.save(renamed, { expectedRevisionToken: created.value.revisionToken, reason: 'user' });
    assert.notEqual(updated.value.recordFingerprint, created.value.recordFingerprint);
  });

  test('revisionToken e recordFingerprint são derivados com separação de domínio: nunca são o mesmo valor, e o fingerprint (mesmo copiado para fora) nunca autoriza uma escrita', () => {
    const character = decodeMinimalCharacter('c4b');
    const { repository } = buildRepository();
    const created = repository.save(character, { expectedRevisionToken: null, reason: 'user' });
    assert.notEqual(created.value.revisionToken, created.value.recordFingerprint, 'revisionToken e recordFingerprint deveriam divergir mesmo para o mesmo registro');

    // Um fingerprint "vazado" para o outbox não pode ser reaproveitado como
    // expectedRevisionToken — precisa ser recusado como qualquer outro token
    // desconhecido (nunca autoriza escrita).
    const renamed = { ...created.value.character, identity: { ...created.value.character.identity, name: 'Y' } };
    const forged = repository.save(renamed, { expectedRevisionToken: created.value.recordFingerprint, reason: 'user' });
    assert.equal(forged.ok, false);
    assert.equal(forged.error.code, 'CHARACTER_SAVE_REVISION_CONFLICT');
  });

  test('reason "user" atualiza atualizado_em; reason "migration" preserva', () => {
    const character = decodeMinimalCharacter('c5');
    const { repository } = buildRepository();
    const created = repository.save(character, { expectedRevisionToken: null, reason: 'migration' });
    assert.equal(created.value.character.metadata.updatedAt, character.metadata.updatedAt, 'migration não deveria tocar atualizado_em');

    const untouched = repository.save(created.value.character, { expectedRevisionToken: created.value.revisionToken, reason: 'user' });
    assert.notEqual(untouched.value.character.metadata.updatedAt, character.metadata.updatedAt, 'user deveria atualizar atualizado_em');
  });

  test('localSyncMutationId é validado, gravado em _local_sync.lastMutationId e devolvido só como metadado do envelope', () => {
    const character = decodeMinimalCharacter('c6');
    const { repository, storage } = buildRepository();
    const created = repository.save(character, { expectedRevisionToken: null, reason: 'sync', localSyncMutationId: 'mut-1' });
    assert.equal(created.ok, true);
    assert.equal(created.value.localSync.lastMutationId, 'mut-1');
    assert.equal('_local_sync' in created.value.character, false, 'nunca entra no canônico');

    const persisted = JSON.parse(storage.getItem(CHARACTER_STORAGE_KEY))[0];
    assert.equal(persisted._local_sync.lastMutationId, 'mut-1');
  });

  test('quota excedida: save() falha classificado como LOCAL_STORAGE_QUOTA_EXCEEDED e mantém bytes anteriores', () => {
    const character = decodeMinimalCharacter('c7');
    const { repository, storage } = buildRepository();
    const created = repository.save(character, { expectedRevisionToken: null, reason: 'user' });
    const bytesBefore = storage.getItem(CHARACTER_STORAGE_KEY);

    storage.setQuotaExceeded(true);
    const renamed = { ...created.value.character, identity: { ...created.value.character.identity, name: 'Y' } };
    const failed = repository.save(renamed, { expectedRevisionToken: created.value.revisionToken, reason: 'user' });
    assert.equal(failed.ok, false);
    assert.equal(failed.error.code, 'LOCAL_STORAGE_QUOTA_EXCEEDED');
    storage.setQuotaExceeded(false);
    assert.equal(storage.getItem(CHARACTER_STORAGE_KEY), bytesBefore, 'save falho mantém exatamente os bytes anteriores');
  });
});

describe('local-storage-character-repository — remove()', () => {
  test('remove exige expectedRevisionToken válido; token stale é recusado', () => {
    const character = decodeMinimalCharacter('r1');
    const { repository } = buildRepository();
    const created = repository.save(character, { expectedRevisionToken: null, reason: 'user' });

    const staleAttempt = repository.remove(character.identity.id, { expectedRevisionToken: 'token-invalido' });
    assert.equal(staleAttempt.ok, false);
    assert.equal(staleAttempt.error.code, 'CHARACTER_REMOVE_REVISION_CONFLICT');

    const removed = repository.remove(character.identity.id, { expectedRevisionToken: created.value.revisionToken });
    assert.equal(removed.ok, true);

    const getAfter = repository.get(character.identity.id);
    assert.equal(getAfter.value, null);
  });

  test('remove() de registro read-only (schema futuro) não decodifica/reencode: exclui os bytes tal como estão', () => {
    const rawFuture = { _schema: { version: 999 }, id: 'future-1', anything: 'preserved-exactly' };
    const { repository } = buildRepository({ initial: { [CHARACTER_STORAGE_KEY]: JSON.stringify([rawFuture]) } });
    const listResult = repository.list();
    const envelope = listResult.value.characters[0];
    assert.equal(envelope.mode, 'read-only');

    const removed = repository.remove('future-1', { expectedRevisionToken: envelope.revisionToken });
    assert.equal(removed.ok, true);
    const after = repository.list();
    assert.equal(after.value.characters.length, 0);
  });

  test('remoção concorrente: segunda aba com token stale recebe conflito', () => {
    const character = decodeMinimalCharacter('r2');
    const { repository } = buildRepository();
    const created = repository.save(character, { expectedRevisionToken: null, reason: 'user' });
    const tabAToken = created.value.revisionToken;
    const tabBToken = created.value.revisionToken;

    const removeA = repository.remove(character.identity.id, { expectedRevisionToken: tabAToken });
    assert.equal(removeA.ok, true);

    const removeB = repository.remove(character.identity.id, { expectedRevisionToken: tabBToken });
    assert.equal(removeB.ok, false);
    assert.equal(removeB.error.code, 'CHARACTER_REMOVE_NOT_FOUND');
  });
});

describe('local-storage-character-repository — replaceAll()', () => {
  test('exige expectedStorageRevisionToken e detecta conflito', () => {
    const { repository } = buildRepository();
    const listResult = repository.list();
    const token = listResult.value.storageRevisionToken;

    const character = decodeMinimalCharacter('ra1');
    repository.save(character, { expectedRevisionToken: null, reason: 'user' }); // muda o storage por fora

    const stale = repository.replaceAll([], { expectedStorageRevisionToken: token, reason: 'sync' });
    assert.equal(stale.ok, false);
    assert.equal(stale.error.code, 'CHARACTER_REPLACE_ALL_REVISION_CONFLICT');
  });

  test('mistura de editável v2 e read-only (raw futuro) preservado byte a byte numa única escrita', () => {
    const { repository, storage } = buildRepository();
    const token = repository.list().value.storageRevisionToken;
    const character = decodeMinimalCharacter('ra2');
    const rawFuture = { _schema: { version: 999 }, id: 'future-2', field: [1, 2, { nested: true }] };

    const result = repository.replaceAll(
      [
        { mode: 'editable', character },
        { mode: 'read-only', rawRecord: rawFuture },
      ],
      { expectedStorageRevisionToken: token, reason: 'sync' },
    );
    assert.equal(result.ok, true);

    const persisted = JSON.parse(storage.getItem(CHARACTER_STORAGE_KEY));
    assert.equal(persisted.length, 2);
    const futureEntry = persisted.find((p) => p.id === 'future-2');
    assert.deepEqual(futureEntry, rawFuture, 'read-only deveria ser reemitido byte a byte, sem encode/downgrade');
  });
});
