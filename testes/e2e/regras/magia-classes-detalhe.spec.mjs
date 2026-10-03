// ============================================================
// Issue #118 -- o detalhe da magia mostra as classes com acesso a ela.
// Clique real no cartão da magia na seção Magias da ficha.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const CLERIGO_5 = {
  nome: 'Devoto', especie: 'Humano', classe: 'Clérigo', subclasse: '',
  nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  magias_preparadas: [{ nome: 'Escudo da Fé', circulo: 1, classe: 'Clérigo' }],
  classes: [{ classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 }],
  schema_versao: 2,
};

test('cartão expandido da seção Magias mostra as classes com acesso', async ({ context }) => {
  const { page } = await abrirFicha(context, CLERIGO_5, 'regras-issue-118');
  await assentar(page).catch(() => {});
  await page.locator('summary', { hasText: /1º Círculo/ }).first().click().catch(() => {});
  const linha = page.locator('.magia-item[data-magia-nome="Escudo da Fé"]').first();
  await linha.locator('.magia-nome').click();
  await assentar(page).catch(() => {});
  await expect(linha.locator('.magia-desc')).toContainText('Classes:');
  await expect(linha.locator('.magia-desc')).toContainText('Clérigo');
});
