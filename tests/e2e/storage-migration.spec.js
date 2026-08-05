// ============================================================
// Caracterização e2e da Task 13: boot assíncrono
// (site/js/app.js -> store.js#initializeCharacterStorage) sobre o novo
// repositório local (site/js/infra/character/local-storage-character-repository.js).
// Cobre: migração v1->v2 no primeiro boot (com backup de segurança criado),
// idempotência num segundo reload, e o estado recuperável da home quando
// `dnd_personagens` está corrompido.
// ============================================================
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetApp, goHome, expectToast } from './helpers/app.js';
import { readCharacters, STORAGE_KEY } from './helpers/storage.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const LEGACY_MINIMAL = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'tests/fixtures/characters/legacy-minimal.json'), 'utf8'),
).cases[0].personagem;

const PRE_MIGRATION_BACKUP_KEY = 'dnd_personagens_backup_refatoracao_v2';

test.describe('Migração de armazenamento (boot assíncrono)', () => {
  test('registro v1 legado é migrado para v2 no primeiro boot e listado normalmente', async ({ page }) => {
    await resetApp(page, { characters: [{ ...LEGACY_MINIMAL, id: 'e2e-legacy-1', nome: 'Legado E2E' }] });
    await goHome(page);

    await expect(page.locator(`.char-card[data-id="e2e-legacy-1"]`)).toBeVisible();

    const [persisted] = await readCharacters(page);
    expect(persisted._schema.version).toBe(2);

    const backupRaw = await page.evaluate((key) => window.localStorage.getItem(key), PRE_MIGRATION_BACKUP_KEY);
    expect(backupRaw).not.toBeNull();
    const backupParsed = JSON.parse(backupRaw);
    expect(backupParsed[0].id).toBe('e2e-legacy-1');
    expect(backupParsed[0]._schema).toBeUndefined();
  });

  test('reload após migração não regrava desnecessariamente (bytes v2 estáveis)', async ({ page }) => {
    await resetApp(page, { characters: [{ ...LEGACY_MINIMAL, id: 'e2e-legacy-2' }] });
    await goHome(page);
    const bytesAfterFirstBoot = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);

    await page.reload();
    await goHome(page);
    const bytesAfterReload = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(bytesAfterReload).toBe(bytesAfterFirstBoot);
  });

  test('personagem exportado após migração continua reimportável', async ({ page }, testInfo) => {
    await resetApp(page, { characters: [{ ...LEGACY_MINIMAL, id: 'e2e-legacy-3', nome: 'Exportável' }] });
    await goHome(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator(`.char-card[data-id="e2e-legacy-3"] [data-action="exportar-individual"]`).click(),
    ]);
    const exportPath = await download.path();
    const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    expect(exported).toHaveLength(1);
    expect(exported[0]._local_sync).toBeUndefined();

    await resetApp(page, { characters: [] });
    await goHome(page);
    const filePath = testInfo.outputPath('reimportado.json');
    fs.writeFileSync(filePath, JSON.stringify(exported, null, 2));
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#btn-importar').click()]);
    await chooser.setFiles(filePath);
    await expectToast(page, { type: 'success', text: 'importado' });
    await expect(page.locator(`.char-card[data-id="e2e-legacy-3"]`)).toBeVisible();
  });

  test('dnd_personagens corrompido: home mostra estado recuperável, nunca lista vazia enganosa', async ({ page }) => {
    await resetApp(page, { characters: [] });
    await page.evaluate((key) => window.localStorage.setItem(key, '{ isto nao e json'), STORAGE_KEY);
    await page.reload();

    await expect(page.getByText('Não foi possível carregar seus personagens')).toBeVisible();
    await expect(page.locator('#btn-retry-storage')).toBeVisible();
    // Nunca deveria mostrar o CTA normal de "Nenhum personagem criado" (que
    // levaria o usuário a crer, incorretamente, que a lista está vazia).
    await expect(page.getByText('Nenhum personagem criado')).toHaveCount(0);

    const stillCorrupt = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(stillCorrupt).toBe('{ isto nao e json');
  });
});
