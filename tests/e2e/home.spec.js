// ============================================================
// Caracterização da Home (site/js/pages/home.js): estado vazio, estado
// preenchido (lista de personagens), e as ações de card (excluir com
// confirmação, duplicar, exportar individual/todos, importar).
// ============================================================
import { test, expect } from '@playwright/test';
import { resetApp, goHome, expectToast } from './helpers/app.js';
import { readCharacters } from './helpers/storage.js';

function personagemMinimo(overrides = {}) {
  return {
    id: 'home-char-0001',
    nome: 'Aria Ventoperene',
    nivel: 3,
    classe: 'Guerreiro',
    subclasse: '',
    especie: 'Humano',
    dado_vida: 10,
    atributos: { forca: 15, destreza: 12, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 8 },
    pv_max: 28,
    pv_atual: 28,
    ...overrides
  };
}

test.describe('Home', () => {
  test('estado vazio mostra CTA de criação e botão de importar', { tag: '@critical' }, async ({ page }) => {
    await resetApp(page, { characters: [] });
    await goHome(page);

    await expect(page.locator('.empty-state h2')).toHaveText('Nenhum personagem criado');
    await expect(page.locator('.empty-state button.btn-primary')).toHaveText('+ Novo Personagem');
    await expect(page.locator('#btn-importar')).toBeVisible();
    await expect(page.locator('.char-card')).toHaveCount(0);
    // Sem personagens, não há botão de exportar todos.
    await expect(page.locator('#btn-exportar')).toHaveCount(0);
  });

  test('estado preenchido lista os personagens com nome, classe/espécie e nível', async ({ page }) => {
    const p = personagemMinimo();
    await resetApp(page, { characters: [p] });
    await goHome(page);

    const card = page.locator(`.char-card[data-id="${p.id}"]`);
    await expect(card).toBeVisible();
    await expect(card.locator('.char-nome')).toHaveText(p.nome);
    await expect(card.locator('.char-nivel')).toHaveText('Nv. 3');
    await expect(card.locator('.char-detalhe')).toContainText('Humano');
    await expect(card.locator('.char-detalhe')).toContainText('Guerreiro');
    await expect(page.locator('#btn-exportar')).toBeVisible();
  });

  test('clicar no card navega para a ficha do personagem', async ({ page }) => {
    const p = personagemMinimo();
    await resetApp(page, { characters: [p] });
    await goHome(page);

    await page.locator(`.char-card[data-id="${p.id}"] .char-info`).click();
    await page.waitForURL(new RegExp(`#ficha/${p.id}`));
  });

  test('excluir personagem exige confirmação no modal e remove o card', async ({ page }) => {
    const p = personagemMinimo();
    await resetApp(page, { characters: [p] });
    await goHome(page);

    const card = page.locator(`.char-card[data-id="${p.id}"]`);
    await card.locator('[data-action="excluir"]').click();

    await expect(page.locator('#modal-overlay')).toHaveCSS('display', 'flex');
    await expect(page.locator('#modal-titulo')).toHaveText('Excluir Personagem');

    // Cancelar mantém o personagem.
    await page.locator('#modal-acoes button', { hasText: 'Cancelar' }).click();
    await expect(page.locator('#modal-overlay')).toHaveCSS('display', 'none');
    await expect(card).toBeVisible();

    // Confirmar remove o personagem e mostra toast de erro (tipo 'error' no código atual).
    await card.locator('[data-action="excluir"]').click();
    await page.locator('#btn-confirmar-excluir').click();
    await expectToast(page, { type: 'error', text: 'excluído' });
    await expect(page.locator(`.char-card[data-id="${p.id}"]`)).toHaveCount(0);

    const restantes = await readCharacters(page);
    expect(restantes).toHaveLength(0);
  });

  test('duplicar personagem cria uma cópia com sufixo "(cópia)" e sem confirmação', async ({ page }) => {
    const p = personagemMinimo();
    await resetApp(page, { characters: [p] });
    await goHome(page);

    await page.locator(`.char-card[data-id="${p.id}"] [data-action="duplicar"]`).click();
    await expectToast(page, { type: 'success', text: 'duplicado' });
    await expect(page.locator('.char-card')).toHaveCount(2);
    await expect(page.locator('.char-card .char-nome', { hasText: '(cópia)' })).toHaveText(`${p.nome} (cópia)`);

    const lista = await readCharacters(page);
    expect(lista).toHaveLength(2);
    expect(lista.find((c) => c.id !== p.id).id).not.toBe(p.id);
  });

  test('exportar todos dispara download de um arquivo .json não vazio', async ({ page }) => {
    const p = personagemMinimo();
    await resetApp(page, { characters: [p] });
    await goHome(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#btn-exportar').click()
    ]);
    await expectToast(page, { type: 'success', text: 'Exportados' });

    expect(download.suggestedFilename()).toMatch(/^dnd_personagens_.*\.json$/);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const fs = await import('node:fs/promises');
    const conteudo = JSON.parse(await fs.readFile(filePath, 'utf8'));
    expect(Array.isArray(conteudo)).toBe(true);
    expect(conteudo.find((c) => c.id === p.id)?.nome).toBe(p.nome);
  });

  test('exportar personagem individual dispara download nomeado com o personagem', async ({ page }) => {
    const p = personagemMinimo();
    await resetApp(page, { characters: [p] });
    await goHome(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator(`.char-card[data-id="${p.id}"] [data-action="exportar-individual"]`).click()
    ]);
    await expectToast(page, { type: 'success', text: 'exportado' });
    expect(download.suggestedFilename()).toMatch(/^dnd_personagem_.*\.json$/);
  });

  test('importar arquivo válido adiciona personagem(ns) e mostra toast de sucesso', async ({ page }, testInfo) => {
    await resetApp(page, { characters: [] });
    await goHome(page);

    const novo = personagemMinimo({ id: 'home-import-0001', nome: 'Personagem Importado' });
    const filePath = testInfo.outputPath('importar.json');
    const fs = await import('node:fs/promises');
    await fs.writeFile(filePath, JSON.stringify([novo], null, 2));

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('#btn-importar').click()
    ]);
    await chooser.setFiles(filePath);

    await expectToast(page, { type: 'success', text: 'importado' });
    await expect(page.locator(`.char-card[data-id="${novo.id}"]`)).toBeVisible();
  });

  test('importar arquivo inválido mostra toast de erro e não altera a lista', async ({ page }, testInfo) => {
    await resetApp(page, { characters: [] });
    await goHome(page);

    const filePath = testInfo.outputPath('invalido.json');
    const fs = await import('node:fs/promises');
    await fs.writeFile(filePath, '{ isto nao e json valido');

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('#btn-importar').click()
    ]);
    await chooser.setFiles(filePath);

    await expectToast(page, { type: 'error', text: 'Erro ao importar' });
    await expect(page.locator('.char-card')).toHaveCount(0);
  });
});
