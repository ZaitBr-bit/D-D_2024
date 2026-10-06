// ============================================================
// Tag de origem: o chip existe para o Artífice e suas subclasses, abre o
// popover com o nome do livro e não seleciona o card/radio por baixo.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirSite, abrirFicha, assentar, abrirModalLevelUp } from './helpers-regras.mjs';

const NOME_LIVRO = "Tasha's Cauldron of Everything";
const ATRIBUTOS = { forca: 8, destreza: 13, constituicao: 14, inteligencia: 16, sabedoria: 12, carisma: 10 };

/** Clica no chip e confere o popover; fecha com Esc. */
async function conferirChip(page, chip) {
  await expect(chip).toBeVisible();
  await chip.click();
  const pop = page.locator('.popover-fonte[data-popover-fonte="tasha"]');
  await expect(pop).toBeVisible();
  await expect(pop).toContainText(NOME_LIVRO);
  await page.keyboard.press('Escape');
  await expect(pop).toHaveCount(0);
}

test('criador: chip no card do Artífice não abre o popup da classe', async ({ context }) => {
  const { page, erros } = await abrirSite(context, '#criar');
  const card = page.locator('[data-classe="Artífice"]');
  await expect(card).toBeVisible();
  await conferirChip(page, card.locator('.selo-fonte[data-fonte="tasha"]'));
  await expect(page.locator('#modal-overlay')).not.toBeVisible();
  await expect(page.locator('[data-classe="Bárbaro"] .selo-fonte')).toHaveCount(0);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('ficha: chip no cabeçalho e no título da subclasse', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Artífice', subclasse: 'Alquimista', nivel: 3, xp: 900, atributos: ATRIBUTOS,
  }, 'regras-fonte-tag-ficha');
  await assentar(page).catch(() => {});
  const chips = page.locator('#app-content .selo-fonte[data-fonte="tasha"]');
  await expect(chips).toHaveCount(2);
  await conferirChip(page, chips.nth(0));
  await conferirChip(page, chips.nth(1));
  expect(erros, erros.join('; ')).toEqual([]);
});

test('subida de nível: chip no card de subclasse não seleciona a subclasse', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Artífice', nivel: 2, xp: 900, atributos: ATRIBUTOS,
  }, 'regras-fonte-tag-subclasse');
  expect(await abrirModalLevelUp(page)).toBe(true);
  for (let i = 0; i < 8 && !(await page.locator('#levelup-subclasses-lista').isVisible()); i++) {
    await page.locator('#btn-step-proximo').click();
    await assentar(page).catch(() => {});
  }
  const card = page.locator('#levelup-subclasses-lista [data-subclasse="Alquimista"]');
  await conferirChip(page, card.locator('.selo-fonte'));
  await expect(card).not.toHaveClass(/selecionada/);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('multiclasse: chip na opção de classe nova não marca o radio', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', nivel: 1, xp: 300, atributos: ATRIBUTOS,
  }, 'regras-fonte-tag-multiclasse');
  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false })).toBe(true);
  const radio = page.locator('input[name="classe-que-sobe"][data-classe="Artífice"]');
  await conferirChip(page, radio.locator('xpath=..').locator('.selo-fonte'));
  await expect(radio).not.toBeChecked();
  expect(erros, erros.join('; ')).toEqual([]);
});

test('criador: chip no popup da classe e no select de subclasse', async ({ context }) => {
  const { page, erros } = await abrirSite(context, '#criar');
  // O criador não tem campo de nível: o nível do rascunho é ajustado no módulo do wizard.
  await page.evaluate(async () => {
    const wizard = await import('./js/creator/wizard.js');
    wizard.personagem.nivel = 3;
  });
  // Clique fora do chip abre o popup da classe.
  await page.locator('[data-classe="Artífice"] .opcao-resumo').first().click();
  const corpo = page.locator('#modal-corpo');
  await expect(corpo.locator('#sel-subclasse')).toBeVisible();
  await conferirChip(page, corpo.locator('.selo-fonte[data-fonte="tasha"]').first());
  // Subclasse sem escolha: sem chip ao lado do select; ao escolher, o chip aparece.
  await expect(page.locator('#sel-subclasse-fonte .selo-fonte')).toHaveCount(0);
  await page.selectOption('#sel-subclasse', 'Alquimista');
  await conferirChip(page, page.locator('#sel-subclasse-fonte .selo-fonte[data-fonte="tasha"]'));
  await expect(page.locator('#sel-subclasse')).toHaveValue('Alquimista');
  await page.selectOption('#sel-subclasse', '');
  await expect(page.locator('#sel-subclasse-fonte .selo-fonte')).toHaveCount(0);
  expect(erros, erros.join('; ')).toEqual([]);
});
