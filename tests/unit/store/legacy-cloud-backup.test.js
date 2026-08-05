// Testa separadamente `backupPersonagensLocais()`/`restaurarPersonagensLocais()`
// (site/js/store.js) — o backup "pré-login" legado, sob `LEGACY_CLOUD_BACKUP_KEY`
// ("dnd_personagens_backup"), inteiramente distinto do backup de segurança
// pré-migração da Task 12 (`PRE_MIGRATION_BACKUP_KEY`,
// "dnd_personagens_backup_refatoracao_v2"). Achado do review independente da
// Task 13: não havia nenhum teste automatizado destas duas funções nem da
// coexistência das duas chaves de backup.
//
// Roda em Node puro via os shims mínimos de `scripts/lib/browser-shims.mjs`
// (o mesmo mecanismo usado por `scripts/generate-baseline-fixtures.mjs` para
// importar `site/js/store.js` fora do navegador) — `backupPersonagensLocais`/
// `restaurarPersonagensLocais` só tocam `localStorage` diretamente, sem
// depender de `initializeCharacterStorage()`.

import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { installBrowserShims, resetFakeLocalStorage } from '../../../scripts/lib/browser-shims.mjs';

installBrowserShims();

const { backupPersonagensLocais, restaurarPersonagensLocais } = await import('../../../site/js/store.js');
const { LEGACY_CLOUD_BACKUP_KEY, CHARACTER_STORAGE_KEY } = await import(
  '../../../site/js/infra/character/local-storage-character-repository.js'
);
const { PRE_MIGRATION_BACKUP_KEY } = await import('../../../site/js/infra/character/pre-migration-backup.js');

beforeEach(() => {
  resetFakeLocalStorage();
});

describe('store.js — backupPersonagensLocais/restaurarPersonagensLocais (LEGACY_CLOUD_BACKUP_KEY)', () => {
  test('LEGACY_CLOUD_BACKUP_KEY e PRE_MIGRATION_BACKUP_KEY são chaves distintas', () => {
    assert.equal(LEGACY_CLOUD_BACKUP_KEY, 'dnd_personagens_backup');
    assert.equal(PRE_MIGRATION_BACKUP_KEY, 'dnd_personagens_backup_refatoracao_v2');
    assert.notEqual(LEGACY_CLOUD_BACKUP_KEY, PRE_MIGRATION_BACKUP_KEY);
  });

  test('backupPersonagensLocais() cria a cópia a partir de dnd_personagens quando a chave de backup está ausente', () => {
    localStorage.setItem(CHARACTER_STORAGE_KEY, '[{"id":"a"}]');
    backupPersonagensLocais();
    assert.equal(localStorage.getItem(LEGACY_CLOUD_BACKUP_KEY), '[{"id":"a"}]');
  });

  test('backupPersonagensLocais() usa "[]" quando dnd_personagens está ausente', () => {
    backupPersonagensLocais();
    assert.equal(localStorage.getItem(LEGACY_CLOUD_BACKUP_KEY), '[]');
  });

  test('backupPersonagensLocais() NUNCA sobrescreve um backup já existente', () => {
    localStorage.setItem(LEGACY_CLOUD_BACKUP_KEY, '[{"id":"original"}]');
    localStorage.setItem(CHARACTER_STORAGE_KEY, '[{"id":"mudou-depois"}]');
    backupPersonagensLocais();
    assert.equal(localStorage.getItem(LEGACY_CLOUD_BACKUP_KEY), '[{"id":"original"}]');
  });

  test('restaurarPersonagensLocais() restaura os bytes do backup em dnd_personagens e remove a chave de backup', () => {
    localStorage.setItem(LEGACY_CLOUD_BACKUP_KEY, '[{"id":"pre-login"}]');
    localStorage.setItem(CHARACTER_STORAGE_KEY, '[{"id":"pos-login-nuvem"}]');
    restaurarPersonagensLocais();
    assert.equal(localStorage.getItem(CHARACTER_STORAGE_KEY), '[{"id":"pre-login"}]');
    assert.equal(localStorage.getItem(LEGACY_CLOUD_BACKUP_KEY), null);
  });

  test('restaurarPersonagensLocais() sem backup existente não mexe em dnd_personagens', () => {
    localStorage.setItem(CHARACTER_STORAGE_KEY, '[{"id":"intacto"}]');
    restaurarPersonagensLocais();
    assert.equal(localStorage.getItem(CHARACTER_STORAGE_KEY), '[{"id":"intacto"}]');
    assert.equal(localStorage.getItem(LEGACY_CLOUD_BACKUP_KEY), null);
  });

  test('ciclo completo backup -> restore preserva os personagens originais', () => {
    localStorage.setItem(CHARACTER_STORAGE_KEY, '[{"id":"x"},{"id":"y"}]');
    backupPersonagensLocais();
    localStorage.setItem(CHARACTER_STORAGE_KEY, '[{"id":"vindo-da-nuvem"}]');
    restaurarPersonagensLocais();
    assert.equal(localStorage.getItem(CHARACTER_STORAGE_KEY), '[{"id":"x"},{"id":"y"}]');
  });

  test('coexistência: o fluxo backup/restore legado nunca lê, sobrescreve ou remove PRE_MIGRATION_BACKUP_KEY, e vice-versa', () => {
    localStorage.setItem(PRE_MIGRATION_BACKUP_KEY, '[{"id":"backup-seguranca-migracao"}]');
    localStorage.setItem(CHARACTER_STORAGE_KEY, '[{"id":"atual"}]');

    backupPersonagensLocais();
    assert.equal(localStorage.getItem(PRE_MIGRATION_BACKUP_KEY), '[{"id":"backup-seguranca-migracao"}]', 'backupPersonagensLocais não deveria tocar o backup de segurança pré-migração');

    localStorage.setItem(CHARACTER_STORAGE_KEY, '[{"id":"outro"}]');
    restaurarPersonagensLocais();
    assert.equal(localStorage.getItem(PRE_MIGRATION_BACKUP_KEY), '[{"id":"backup-seguranca-migracao"}]', 'restaurarPersonagensLocais não deveria tocar o backup de segurança pré-migração');
    // As duas chaves de backup coexistem sem colisão: uma populada (segurança
    // pré-migração), a outra já consumida (legado pré-login, removida após restore).
    assert.equal(localStorage.getItem(LEGACY_CLOUD_BACKUP_KEY), null);
  });
});
