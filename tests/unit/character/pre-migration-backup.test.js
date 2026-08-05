import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  createPreMigrationBackupService,
  PRE_MIGRATION_BACKUP_KEY,
} from '../../../site/js/infra/character/pre-migration-backup.js';

/**
 * Storage em memória compatível com o subconjunto do contrato Web Storage
 * usado pelo serviço (getItem/setItem), com um `setItem` opcionalmente
 * "quebrável" (simula quota) via `failOn`.
 */
function createMemoryStorage({ failOn = new Set() } = {}) {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      if (failOn.has(key)) {
        throw new Error('QuotaExceededError');
      }
      store.set(key, value);
    },
    _store: store,
  };
}

describe('infra/character/pre-migration-backup — chave e criação', () => {
  test('PRE_MIGRATION_BACKUP_KEY é exatamente a chave documentada', () => {
    assert.equal(PRE_MIGRATION_BACKUP_KEY, 'dnd_personagens_backup_refatoracao_v2');
  });

  test('ensure() cria o backup na primeira chamada', () => {
    const storage = createMemoryStorage();
    const service = createPreMigrationBackupService({ storage });
    const result = service.ensure('[1,2,3]');
    assert.deepEqual(result, { ok: true, value: { created: true } });
    assert.equal(storage.getItem(PRE_MIGRATION_BACKUP_KEY), '[1,2,3]');
  });

  test('ensure() nunca sobrescreve um backup já existente', () => {
    const storage = createMemoryStorage();
    const service = createPreMigrationBackupService({ storage });
    service.ensure('[1]');
    const second = service.ensure('[2,2,2]');
    assert.deepEqual(second, { ok: true, value: { created: false } });
    assert.equal(storage.getItem(PRE_MIGRATION_BACKUP_KEY), '[1]');
  });

  test('ensure() rejeita entrada que não é JSON válido', () => {
    const storage = createMemoryStorage();
    const service = createPreMigrationBackupService({ storage });
    const result = service.ensure('{ nao é json');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_BACKUP_INVALID_JSON');
  });

  test('ensure() bloqueia a migração quando setItem falha por quota (sem autorização)', () => {
    const storage = createMemoryStorage({ failOn: new Set([PRE_MIGRATION_BACKUP_KEY]) });
    const service = createPreMigrationBackupService({ storage });
    const result = service.ensure('[1]');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_BACKUP_WRITE_FAILED');
  });
});

describe('infra/character/pre-migration-backup — validate/export', () => {
  test('validate() reporta erro quando não há backup', () => {
    const storage = createMemoryStorage();
    const service = createPreMigrationBackupService({ storage });
    assert.equal(service.validate().valid, false);
  });

  test('validate() aceita um backup JSON válido armazenado', () => {
    const storage = createMemoryStorage();
    const service = createPreMigrationBackupService({ storage });
    service.ensure('[1,2]');
    assert.equal(service.validate().valid, true);
  });

  test('export() devolve o texto bruto do backup armazenado', () => {
    const storage = createMemoryStorage();
    const service = createPreMigrationBackupService({ storage });
    service.ensure('[1,2]');
    const result = service.export();
    assert.deepEqual(result, { ok: true, value: '[1,2]' });
  });

  test('export() falha quando não há backup', () => {
    const storage = createMemoryStorage();
    const service = createPreMigrationBackupService({ storage });
    assert.equal(service.export().ok, false);
  });
});

describe('infra/character/pre-migration-backup — restore()', () => {
  function setupRestoreScenario() {
    const storage = createMemoryStorage();
    const service = createPreMigrationBackupService({ storage });
    service.ensure('[1,2,3]');
    storage.setItem('dnd_personagens', '[1,2,3]');
    return { storage, service };
  }

  test('inspectRestore() devolve token + characterCount + byteLength', () => {
    const { service } = setupRestoreScenario();
    const result = service.inspectRestore();
    assert.equal(result.ok, true);
    assert.equal(result.value.characterCount, 3);
    assert.equal(result.value.byteLength, 7);
    assert.equal(typeof result.value.confirmationToken, 'string');
  });

  test('restore() rejeita sem confirmed:true', () => {
    const { service } = setupRestoreScenario();
    const { value } = service.inspectRestore();
    const result = service.restore({ confirmationToken: value.confirmationToken, confirmed: false });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_BACKUP_RESTORE_NOT_CONFIRMED');
  });

  test('restore() rejeita token desconhecido', () => {
    const { service } = setupRestoreScenario();
    service.inspectRestore();
    const result = service.restore({ confirmationToken: 'token-inventado', confirmed: true });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_BACKUP_RESTORE_TOKEN_INVALID');
  });

  test('restore() rejeita token já consumido (uso único)', () => {
    const { service } = setupRestoreScenario();
    const { value } = service.inspectRestore();
    const first = service.restore({ confirmationToken: value.confirmationToken, confirmed: true });
    assert.equal(first.ok, true);
    const second = service.restore({ confirmationToken: value.confirmationToken, confirmed: true });
    assert.equal(second.ok, false);
    assert.equal(second.error.code, 'CHARACTER_BACKUP_RESTORE_TOKEN_INVALID');
  });

  test('restore() rejeita quando o backup foi alterado depois de inspectRestore()', () => {
    const { storage, service } = setupRestoreScenario();
    const { value } = service.inspectRestore();
    storage.setItem(PRE_MIGRATION_BACKUP_KEY, '[9,9,9,9]');
    const result = service.restore({ confirmationToken: value.confirmationToken, confirmed: true });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_BACKUP_RESTORE_BACKUP_CHANGED');
  });

  test('restore() rejeita quando dnd_personagens foi alterado por outra aba depois de inspectRestore()', () => {
    const { storage, service } = setupRestoreScenario();
    const { value } = service.inspectRestore();
    storage.setItem('dnd_personagens', '[1,2,3,4,5]');
    const result = service.restore({ confirmationToken: value.confirmationToken, confirmed: true });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_BACKUP_RESTORE_DESTINATION_CHANGED');
  });

  test('confirmação válida com destination revision ainda atual substitui dnd_personagens', () => {
    const { storage, service } = setupRestoreScenario();
    storage.setItem(PRE_MIGRATION_BACKUP_KEY, '[1,2,3]');
    const { value } = service.inspectRestore();
    storage.setItem('dnd_personagens', '[0]'); // corrompido pela migração, por exemplo
    // sem nova inspeção, o token antigo não reflete mais o destino: deve falhar.
    const stale = service.restore({ confirmationToken: value.confirmationToken, confirmed: true });
    assert.equal(stale.ok, false);
  });

  test('nova inspectRestore() invalida o token anterior', () => {
    const { service } = setupRestoreScenario();
    const first = service.inspectRestore();
    service.inspectRestore();
    const result = service.restore({ confirmationToken: first.value.confirmationToken, confirmed: true });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_BACKUP_RESTORE_TOKEN_INVALID');
  });
});

describe('infra/character/pre-migration-backup — via alternativa sem espaço (safety export)', () => {
  test('prepareSafetyExport() gera o texto para download mesmo sem backup armazenado', () => {
    const storage = createMemoryStorage({ failOn: new Set([PRE_MIGRATION_BACKUP_KEY]) });
    const service = createPreMigrationBackupService({ storage });
    const result = service.prepareSafetyExport('[1,2]');
    assert.equal(result.ok, true);
    assert.equal(result.value.jsonText, '[1,2]');
    assert.equal(result.value.characterCount, 2);
  });

  test('authorizeMigrationAfterSafetyExport() rejeita sem confirmed:true', () => {
    const storage = createMemoryStorage();
    const service = createPreMigrationBackupService({ storage });
    const prep = service.prepareSafetyExport('[1]');
    const result = service.authorizeMigrationAfterSafetyExport({
      rawCharactersJson: '[1]',
      confirmationToken: prep.value.confirmationToken,
      confirmed: false,
    });
    assert.equal(result.ok, false);
  });

  test('authorizeMigrationAfterSafetyExport() rejeita bytes diferentes dos preparados', () => {
    const storage = createMemoryStorage();
    const service = createPreMigrationBackupService({ storage });
    const prep = service.prepareSafetyExport('[1]');
    const result = service.authorizeMigrationAfterSafetyExport({
      rawCharactersJson: '[1,2]', // bytes diferentes
      confirmationToken: prep.value.confirmationToken,
      confirmed: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_SAFETY_EXPORT_TOKEN_INVALID');
  });

  test('um objeto forjado (mesma forma, nunca emitido pelo serviço) nunca autoriza ensure() — validade é por identidade, não por forma', () => {
    // Achado do review independente: a validação anterior checava só
    // `authorization.kind === 'SafetyExportAuthorization'` (duck-typing),
    // então qualquer objeto literal com essa forma passava — inclusive um
    // revivido de JSON. Isso contradiz o brief ("não é serializada nem
    // reutilizável"): a autoridade real precisa vir de identidade de
    // objeto (um WeakMap privado só populado por
    // authorizeMigrationAfterSafetyExport), não do formato do objeto.
    const storage = createMemoryStorage({ failOn: new Set([PRE_MIGRATION_BACKUP_KEY]) });
    const service = createPreMigrationBackupService({ storage });
    const raw = '[1,2,3]';
    const forged = { kind: 'SafetyExportAuthorization' };
    const result = service.ensure(raw, { safetyExportAuthorization: forged });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_BACKUP_WRITE_FAILED');
  });

  test('uma autorização emitida para uma exportação não autoriza persistir bytes DIFERENTES (vinculada aos bytes)', () => {
    const storage = createMemoryStorage({ failOn: new Set([PRE_MIGRATION_BACKUP_KEY]) });
    const service = createPreMigrationBackupService({ storage });
    const original = '[1,2,3]';
    const prep = service.prepareSafetyExport(original);
    const auth = service.authorizeMigrationAfterSafetyExport({
      rawCharactersJson: original,
      confirmationToken: prep.value.confirmationToken,
      confirmed: true,
    });
    assert.equal(auth.ok, true);

    const differentBytes = '[9,9,9]';
    const result = service.ensure(differentBytes, { safetyExportAuthorization: auth.value });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_BACKUP_WRITE_FAILED');
  });

  test('autorização válida permite uma única tentativa de persistência migrada (ensure com autorização)', () => {
    const storage = createMemoryStorage({ failOn: new Set([PRE_MIGRATION_BACKUP_KEY]) });
    const service = createPreMigrationBackupService({ storage });
    const raw = '[1,2,3]';
    const prep = service.prepareSafetyExport(raw);
    const auth = service.authorizeMigrationAfterSafetyExport({
      rawCharactersJson: raw,
      confirmationToken: prep.value.confirmationToken,
      confirmed: true,
    });
    assert.equal(auth.ok, true);

    const firstEnsure = service.ensure(raw, { safetyExportAuthorization: auth.value });
    assert.equal(firstEnsure.ok, true);

    // reuso da mesma autorização (segunda tentativa) deve ser recusado —
    // uma nova exportação/confirmação é exigida.
    const secondEnsure = service.ensure(raw, { safetyExportAuthorization: auth.value });
    assert.equal(secondEnsure.ok, false);
  });

  test('se a escrita v2 falhar mesmo com autorização, os bytes brutos continuam intactos (nada é apagado)', () => {
    const storage = createMemoryStorage({ failOn: new Set([PRE_MIGRATION_BACKUP_KEY]) });
    const service = createPreMigrationBackupService({ storage });
    const raw = '[1,2,3]';
    const prep = service.prepareSafetyExport(raw);
    const auth = service.authorizeMigrationAfterSafetyExport({
      rawCharactersJson: raw,
      confirmationToken: prep.value.confirmationToken,
      confirmed: true,
    });
    service.ensure(raw, { safetyExportAuthorization: auth.value });
    // Nada foi escrito no storage do backup (setItem continua falhando) —
    // o serviço nunca apagou/alterou dnd_personagens por conta própria.
    assert.equal(storage.getItem('dnd_personagens'), null);
    assert.equal(storage.getItem(PRE_MIGRATION_BACKUP_KEY), null);
  });
});
