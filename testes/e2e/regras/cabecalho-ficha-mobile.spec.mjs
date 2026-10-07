// ============================================================
// Cabeçalho da ficha no celular (390 px): nome e botões ficam sempre à vista,
// os detalhes do personagem moram num bloco que nasce fechado e a tela não
// ganha rolagem horizontal mesmo com muita informação (multiclasse, selos,
// idiomas).
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar } from './helpers-regras.mjs';

test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });

const MUITA_INFO = {
  classe: 'Mago', subclasse: '', nivel: 3, xp: 0, especie: 'Renascido', antecedente: 'Acólito', alinhamento: 'CB',
  idiomas: ['Comum', 'Dracônico', 'Élfico', 'Anão', 'Gnômico', 'Orc'],
  atributos: ATRIBUTOS_REGRAS, pericias_proficientes: ['Arcanismo', 'História'],
  classes: [{ classe: 'Mago', subclasse: '', nivel: 2, ordem: 0 }, { classe: 'Bruxo', subclasse: '', nivel: 1, ordem: 1 }],
  schema_versao: 2,
};

test('celular: detalhes do personagem nascem fechados, botões à vista e sem estouro horizontal', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MUITA_INFO, 'cabecalho-mobile');
  await assentar(page).catch(() => {});
  const bloco = page.locator('#card-identidade details[data-details-id="ficha-identidade"]');
  await expect(bloco, 'nasce fechado').not.toHaveAttribute('open', '');
  await expect(page.locator('#char-nome-display')).toBeVisible();
  await expect(page.locator('#btn-editar-ficha'), 'Editar ficha mora nos detalhes').toBeHidden();
  await expect(page.locator('#btn-levelup')).toBeVisible();
  await expect(page.locator('#card-identidade').getByText('Antecedente:')).toBeHidden();

  // Os botões não ficam numa coluna espremida ao lado do nome.
  const nome = await page.locator('#char-nome-display').boundingBox();
  const botao = await page.locator('#btn-levelup').boundingBox();
  expect(botao.width, 'o botão de subir de nível tem largura útil').toBeGreaterThan(200);
  expect(botao.y, 'os botões vão para baixo do nome quando não cabem ao lado').toBeGreaterThanOrEqual(nome.y);

  await bloco.locator('summary').click();
  await expect(page.locator('#btn-editar-ficha')).toBeVisible();
  await expect(page.locator('#btn-print')).toBeVisible();
  await expect(page.locator('#card-identidade').getByText('Antecedente:')).toBeVisible();
  await expect(page.locator('#xp-display')).toBeVisible();
  const estouro = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(estouro, 'sem rolagem horizontal').toBeLessThanOrEqual(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
