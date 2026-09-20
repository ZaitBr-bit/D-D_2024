// ============================================================
// Issue #76 -- Manto de Majestade (Bardo, Colégio do Glamour, nível 6)
// migrou do bookkeeping dedicado (botão "Ativar Manto de Majestade",
// char.recursos.bardo.subclasses.glamour.manto_majestade_usado) para o
// botão "Grátis" único da lista principal de Magias (gratis_usado).
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar } from './helpers-regras.mjs';

test('ficha antiga: Comando (Manto de Majestade) ganha o botão Grátis na lista principal, e o botão dedicado antigo some', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Bardo', subclasse: 'Colégio do Glamour', nivel: 6, xp: 14000, atributos: ATRIBUTOS_REGRAS,
    magias_preparadas: [{ nome: 'Comando', circulo: 1, origem: 'sempre' }],
  }, 'regras-bardo-manto-majestade-gratis');

  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  await assentar(page).catch(() => {});

  await expect(page.locator('[data-bardo-subclasse-acao="glamour_manto_majestade"]')).toHaveCount(0);

  const cardo = page.locator('[data-magia-nome="Comando"]').first();
  const botaoGratis = cardo.locator('[data-conjurar-gratis="Comando"]');
  await expect(botaoGratis).toBeVisible();
  await botaoGratis.click();
  await assentar(page).catch(() => {});

  await expect(page.locator('[data-magia-nome="Comando"]').first()
    .locator('[data-conjurar-gratis="Comando"]')).toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
