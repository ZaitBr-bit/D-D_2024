// ============================================================
// Quadro de Perícias recolhível: nasce aberto e o título recolhe/expande.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar } from './helpers-regras.mjs';

test('Perícias nasce aberto e o título recolhe e expande o quadro', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Guerreiro', nivel: 1, atributos: ATRIBUTOS_REGRAS }, 'pericias-recolhivel');
  await assentar(page).catch(() => {});
  const quadro = page.locator('details[data-details-id="pericias"]');
  await expect(quadro).toHaveAttribute('open', '');
  await expect(quadro.locator('.pericia-item').first()).toBeVisible();

  await quadro.locator('summary').click();
  await expect(quadro).not.toHaveAttribute('open', '');
  await expect(quadro.locator('.pericia-item').first()).toBeHidden();

  await quadro.locator('summary').click();
  await expect(quadro.locator('.pericia-item').first()).toBeVisible();
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
