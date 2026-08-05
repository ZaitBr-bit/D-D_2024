// ============================================================
// Caracterização de importação/exportação de personagens
// (site/js/pages/home.js + site/js/store.js): os downloads gerados pela
// própria UI precisam ser reimportáveis e preservar os campos das fixtures
// de compatibilidade (tests/fixtures/characters/**, congeladas na Task 2).
// ============================================================
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetApp, goHome, expectToast } from './helpers/app.js';
import { readCharacters } from './helpers/storage.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const ALL_FIELDS = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'tests/fixtures/characters/legacy-all-fields.json'), 'utf8')
).cases[0].personagem;

async function importarArquivo(page, testInfo, dados, nomeArquivo = 'importar.json') {
  const filePath = testInfo.outputPath(nomeArquivo);
  await fsp.writeFile(filePath, JSON.stringify(dados, null, 2));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#btn-importar').click()]);
  await chooser.setFiles(filePath);
  return filePath;
}

test.describe('Importação e exportação', () => {
  test('exportar um personagem rico e reimportá-lo em uma sessão limpa preserva os campos da fixture', async ({
    page
  }, testInfo) => {
    await resetApp(page, { characters: [ALL_FIELDS] });
    await goHome(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator(`.char-card[data-id="${ALL_FIELDS.id}"] [data-action="exportar-individual"]`).click()
    ]);
    const exportPath = await download.path();
    const exportado = JSON.parse(await fsp.readFile(exportPath, 'utf8'));
    expect(Array.isArray(exportado)).toBe(true);
    expect(exportado).toHaveLength(1);

    // Sessão nova, sem personagens: reimporta o arquivo exportado.
    await resetApp(page, { characters: [] });
    await goHome(page);
    await importarArquivo(page, testInfo, exportado, 'reimportado.json');
    await expectToast(page, { type: 'success', text: 'importado' });

    const [reimportado] = await readCharacters(page);
    expect(reimportado.id).toBe(ALL_FIELDS.id);
    expect(reimportado.nome).toBe(ALL_FIELDS.nome);
    expect(reimportado.nivel).toBe(ALL_FIELDS.nivel);
    expect(reimportado.classe).toBe(ALL_FIELDS.classe);
    expect(reimportado.moedas).toEqual(ALL_FIELDS.moedas);
    expect(reimportado.inventario).toHaveLength(ALL_FIELDS.inventario.length);
    expect(reimportado.talentos).toEqual(ALL_FIELDS.talentos);
  });

  test('exportar todos gera um arquivo com todos os personagens, reimportável', async ({ page }, testInfo) => {
    const segundo = { ...ALL_FIELDS, id: 'segundo-personagem-01', nome: 'Segundo Personagem' };
    await resetApp(page, { characters: [ALL_FIELDS, segundo] });
    await goHome(page);

    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#btn-exportar').click()]);
    const exportado = JSON.parse(await fsp.readFile(await download.path(), 'utf8'));
    expect(exportado).toHaveLength(2);

    await resetApp(page, { characters: [] });
    await goHome(page);
    await importarArquivo(page, testInfo, exportado);
    await expectToast(page, { type: 'success', text: 'importado' });

    const lista = await readCharacters(page);
    expect(lista.map((p) => p.id).sort()).toEqual([ALL_FIELDS.id, segundo.id].sort());
  });

  test('importar um arquivo cujo id já existe não duplica o personagem', async ({ page }, testInfo) => {
    await resetApp(page, { characters: [ALL_FIELDS] });
    await goHome(page);

    await importarArquivo(page, testInfo, [ALL_FIELDS]);
    // 0 personagens novos importados: o app não sobrescreve o existente.
    await expectToast(page, { type: 'success', text: '0 personagem(ns) importado(s)!' });

    const lista = await readCharacters(page);
    expect(lista).toHaveLength(1);
  });

  test('importar múltiplos personagens de uma fixture de classes soma corretamente', async ({ page }, testInfo) => {
    const classes = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'tests/fixtures/characters/legacy-all-classes.json'), 'utf8')
    );
    const personagens = classes.cases.slice(0, 3).map((c) => c.personagem);

    await resetApp(page, { characters: [] });
    await goHome(page);
    await importarArquivo(page, testInfo, personagens);
    await expectToast(page, { type: 'success', text: `${personagens.length} personagem(ns) importado(s)!` });

    const lista = await readCharacters(page);
    expect(lista).toHaveLength(personagens.length);
  });
});
