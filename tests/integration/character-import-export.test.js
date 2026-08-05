import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMemoryStorage } from '../helpers/memory-storage.js';
import { createLegacyAliasResolver } from '../../site/js/infra/character/legacy-alias-resolver.js';
import { createPreMigrationBackupService } from '../../site/js/infra/character/pre-migration-backup.js';
import { LocalStorageCharacterRepository, CHARACTER_STORAGE_KEY } from '../../site/js/infra/character/local-storage-character-repository.js';
import { importCharacterRecords, exportCharacterRecords } from '../../site/js/infra/character/import-export-service.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
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

function buildRepository() {
  const storage = createMemoryStorage();
  const backupService = createPreMigrationBackupService({ storage });
  const repository = LocalStorageCharacterRepository({ storage, aliasResolver, backupService, clock: { now: () => NOW } });
  return { storage, repository };
}

describe('character-import-export — importação', () => {
  test('array legado (v1) é migrado e importado com sucesso', () => {
    const { repository } = buildRepository();
    const payload = JSON.stringify([{ ...legacyMinimalRaw, id: 'imp-legacy-1' }]);
    const result = importCharacterRecords(payload, { repository, aliasResolver, now: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.value.imported.length, 1);
    assert.equal(result.value.imported[0].id, 'imp-legacy-1');
    assert.deepEqual(result.value.rejected, []);

    const listed = repository.list();
    assert.equal(listed.value.characters.length, 1);
  });

  test('registro v2 já codificado é importado', () => {
    const { repository } = buildRepository();
    // Codifica um v2 real usando um repositório auxiliar (save+read).
    const setup = buildRepository();
    const decodedTemplate = importCharacterRecords(JSON.stringify([{ ...legacyMinimalRaw, id: 'seed' }]), { repository: setup.repository, aliasResolver, now: NOW });
    assert.equal(decodedTemplate.ok, true);
    const v2Raw = JSON.parse(setup.storage.getItem(CHARACTER_STORAGE_KEY))[0];
    v2Raw.id = 'imp-v2-1';

    const result = importCharacterRecords(JSON.stringify([v2Raw]), { repository, aliasResolver, now: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.value.imported.length, 1);
    assert.equal(result.value.imported[0].id, 'imp-v2-1');
  });

  test('duplicado já existente no repositório: reportado em duplicates(kind:"existing"), primeira ocorrência vence', () => {
    const { repository } = buildRepository();
    importCharacterRecords(JSON.stringify([{ ...legacyMinimalRaw, id: 'dup-1' }]), { repository, aliasResolver, now: NOW });

    const result = importCharacterRecords(JSON.stringify([{ ...legacyMinimalRaw, id: 'dup-1', nome: 'Tentativa 2' }]), { repository, aliasResolver, now: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.value.imported.length, 0);
    assert.equal(result.value.duplicates.length, 1);
    assert.equal(result.value.duplicates[0].kind, 'existing');
    assert.equal(result.value.duplicates[0].id, 'dup-1');
  });

  test('duplicado dentro do próprio payload: primeira ocorrência importada, segunda em duplicates(kind:"payload",firstIndex)', () => {
    const { repository } = buildRepository();
    const payload = JSON.stringify([
      { ...legacyMinimalRaw, id: 'dup-2', nome: 'Primeira' },
      { ...legacyMinimalRaw, id: 'dup-2', nome: 'Segunda' },
    ]);
    const result = importCharacterRecords(payload, { repository, aliasResolver, now: NOW });
    assert.equal(result.value.imported.length, 1);
    assert.equal(result.value.imported[0].index, 0);
    assert.equal(result.value.duplicates.length, 1);
    assert.deepEqual(result.value.duplicates[0], { index: 1, id: 'dup-2', kind: 'payload', firstIndex: 0 });

    const listed = repository.list();
    const nome = listed.value.characters[0].character.identity.name;
    assert.equal(nome, 'Primeira', 'a primeira ocorrência válida do id deveria vencer');
  });

  test('inválido: registro individual é rejeitado com erros, sem afetar os demais do mesmo payload', () => {
    const { repository } = buildRepository();
    const payload = JSON.stringify([
      { ...legacyMinimalRaw, id: 'ok-1' },
      { _schema: { version: 2 }, id: 'bad-1', pericias_proficientes: 'nao-e-array' },
    ]);
    const result = importCharacterRecords(payload, { repository, aliasResolver, now: NOW });
    assert.equal(result.value.imported.length, 1);
    assert.equal(result.value.imported[0].id, 'ok-1');
    assert.equal(result.value.rejected.length, 1);
    assert.equal(result.value.rejected[0].id, 'bad-1');
    assert.ok(result.value.rejected[0].errors.length > 0);
  });

  test('JSON/shape de arquivo inválido falha inteiro, sem escrever nada', () => {
    const { repository, storage } = buildRepository();
    const before = storage.getItem(CHARACTER_STORAGE_KEY);

    const invalidJson = importCharacterRecords('{ nao fecha', { repository, aliasResolver, now: NOW });
    assert.equal(invalidJson.ok, false);
    assert.equal(invalidJson.error.code, 'CHARACTER_IMPORT_INVALID_JSON');

    const notArray = importCharacterRecords(JSON.stringify({ nao: 'e array' }), { repository, aliasResolver, now: NOW });
    assert.equal(notArray.ok, false);
    assert.equal(notArray.error.code, 'CHARACTER_IMPORT_INVALID_SHAPE');

    assert.equal(storage.getItem(CHARACTER_STORAGE_KEY), before);
  });

  test('schema futuro (passthrough): importado em modo read-only, reportado em readOnly[]', () => {
    const { repository } = buildRepository();
    const rawFuture = { _schema: { version: 999 }, id: 'future-imp-1', anything: [1, 2, 3] };
    const result = importCharacterRecords(JSON.stringify([rawFuture]), { repository, aliasResolver, now: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.value.readOnly.length, 1);
    assert.equal(result.value.readOnly[0].id, 'future-imp-1');

    const listed = repository.list();
    const envelope = listed.value.characters.find((c) => c.rawRecord?.id === 'future-imp-1');
    assert.equal(envelope.mode, 'read-only');
    assert.deepEqual(envelope.rawRecord, rawFuture, 'preservado byte a byte');
  });

  test('colisão de campo reservado v2 (conflito reservado): fica read-only, nunca sobrescrito silenciosamente', () => {
    const { repository } = buildRepository();
    const rawReserved = { id: 'reserved-1', nome: 'Alguem', nivel: 1, atributos: {}, overrides: { foo: 'bar' } };
    const result = importCharacterRecords(JSON.stringify([rawReserved]), { repository, aliasResolver, now: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.value.readOnly.length, 1);
  });

  test('importar um personagem novo não reescreve os bytes de um personagem pré-existente não relacionado', () => {
    const { repository, storage } = buildRepository();
    const seeded = importCharacterRecords(JSON.stringify([{ ...legacyMinimalRaw, id: 'unrelated-1' }]), { repository, aliasResolver, now: NOW });
    assert.equal(seeded.ok, true);
    const bytesBeforeSecondImport = JSON.parse(storage.getItem(CHARACTER_STORAGE_KEY)).find((r) => r.id === 'unrelated-1');

    const result = importCharacterRecords(JSON.stringify([{ ...legacyMinimalRaw, id: 'new-1' }]), { repository, aliasResolver, now: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.value.imported.length, 1);

    const bytesAfterSecondImport = JSON.parse(storage.getItem(CHARACTER_STORAGE_KEY)).find((r) => r.id === 'unrelated-1');
    assert.deepEqual(bytesAfterSecondImport, bytesBeforeSecondImport, 'o registro pré-existente não relacionado deveria ficar byte a byte idêntico');
  });

  test('payload grande (muitos personagens) é importado numa única escrita atômica', () => {
    const { repository } = buildRepository();
    const many = Array.from({ length: 50 }, (_, i) => ({ ...legacyMinimalRaw, id: `bulk-${i}` }));
    const result = importCharacterRecords(JSON.stringify(many), { repository, aliasResolver, now: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.value.imported.length, 50);
    assert.equal(repository.list().value.characters.length, 50);
  });

  test('merge de editáveis + raw read-only aceitos numa única escrita; falha de escrita preserva bytes anteriores', () => {
    const { repository, storage } = buildRepository();
    importCharacterRecords(JSON.stringify([{ ...legacyMinimalRaw, id: 'pre-existing' }]), { repository, aliasResolver, now: NOW });
    const before = storage.getItem(CHARACTER_STORAGE_KEY);

    storage.setQuotaExceeded(true);
    const result = importCharacterRecords(JSON.stringify([{ ...legacyMinimalRaw, id: 'novo-1' }]), { repository, aliasResolver, now: NOW });
    assert.equal(result.ok, false);
    storage.setQuotaExceeded(false);
    assert.equal(storage.getItem(CHARACTER_STORAGE_KEY), before, 'nenhuma escrita parcial deveria ter ocorrido');
  });
});

describe('character-import-export — exportação', () => {
  test('exportação remove _local_sync, preservando o resto do registro', () => {
    const { repository } = buildRepository();
    const saveResult = repository.save(
      (() => {
        const imported = importCharacterRecords(JSON.stringify([{ ...legacyMinimalRaw, id: 'sync-1' }]), { repository, aliasResolver, now: NOW });
        assert.equal(imported.ok, true);
        return repository.get('sync-1').value.character;
      })(),
      { expectedRevisionToken: repository.get('sync-1').value.revisionToken, reason: 'sync', localSyncMutationId: 'mut-x' },
    );
    assert.equal(saveResult.ok, true);
    assert.equal(saveResult.value.localSync.lastMutationId, 'mut-x');

    const listed = repository.list();
    const exported = exportCharacterRecords(listed.value.characters, { aliasResolver });
    assert.equal(exported.ok, true);
    const parsed = JSON.parse(exported.value);
    assert.equal(parsed[0].id, 'sync-1');
    assert.equal('_local_sync' in parsed[0], false, 'export nunca deveria carregar _local_sync');
  });

  test('exportação preserva read-only byte a byte, sem passar pelo encoder v2', () => {
    const { repository } = buildRepository();
    const rawFuture = { _schema: { version: 999 }, id: 'future-exp-1', weird: { nested: [1, 2] } };
    importCharacterRecords(JSON.stringify([rawFuture]), { repository, aliasResolver, now: NOW });
    const listed = repository.list();
    const exported = exportCharacterRecords(listed.value.characters, { aliasResolver });
    const parsed = JSON.parse(exported.value);
    assert.deepEqual(parsed.find((p) => p.id === 'future-exp-1'), rawFuture);
  });

  test('exportação NÃO remove _local_sync de um registro read-only que legitimamente o possui (só o braço editável é afetado)', () => {
    const { repository } = buildRepository();
    // `_local_sync` aqui pertence ao schema futuro em si (não é o marcador
    // do codec v2 desta app) — precisa sobreviver export/import/replace com
    // TODAS as propriedades intactas, sem downgrade.
    const rawFuture = { _schema: { version: 999 }, id: 'future-exp-2', _local_sync: { lastMutationId: 'de-outro-schema' } };
    importCharacterRecords(JSON.stringify([rawFuture]), { repository, aliasResolver, now: NOW });
    const listed = repository.list();
    const exported = exportCharacterRecords(listed.value.characters, { aliasResolver });
    const parsed = JSON.parse(exported.value);
    assert.deepEqual(parsed.find((p) => p.id === 'future-exp-2'), rawFuture, '_local_sync de um read-only não deveria ser removido no export');
  });

  test('import -> export -> import (mesmo repositório vazio) preserva os dados', () => {
    const { repository } = buildRepository();
    importCharacterRecords(JSON.stringify([{ ...legacyMinimalRaw, id: 'roundtrip-1' }]), { repository, aliasResolver, now: NOW });
    const exported = exportCharacterRecords(repository.list().value.characters, { aliasResolver });

    const { repository: repository2 } = buildRepository();
    const reimported = importCharacterRecords(exported.value, { repository: repository2, aliasResolver, now: NOW });
    assert.equal(reimported.ok, true);
    assert.equal(reimported.value.imported.length, 1);
  });
});
