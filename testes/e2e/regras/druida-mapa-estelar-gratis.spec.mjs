// ============================================================
// Issue #76 -- Mapa Estelar (Círculo das Estrelas, nível 3) migrou do
// bookkeeping dedicado (botão "Conjurar Raio Guia (grátis)",
// char.recursos.druida.subclasses.estrelas.mapa_estelar_usos_gastos) para
// o adaptador de recurso dedicado (regras-usos-gratis-magia.js) por trás
// do botão "Grátis" da lista principal de Magias.
//
// Diferente de Destruição do Paladino/Manto de Majestade (1 uso), Raio
// Guia tem USOS MÚLTIPLOS (modificador de Sabedoria) -- este spec clica
// duas vezes seguidas para provar que não é um toggle de 1 uso só.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar } from './helpers-regras.mjs';

test('ficha antiga: Raio Guia (Mapa Estelar) ganha o botão Grátis com usos múltiplos, e o botão dedicado antigo some', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Druida', subclasse: 'Círculo das Estrelas', nivel: 3, xp: 900,
    atributos: { forca: 10, destreza: 14, constituicao: 14, inteligencia: 10, sabedoria: 16, carisma: 10 },
    magias_preparadas: [{ nome: 'Raio Guia', circulo: 1, origem: 'sempre' }],
  }, 'regras-druida-mapa-estelar-gratis');

  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  await assentar(page).catch(() => {});

  await expect(page.locator('[data-druida-subclasse-acao="mapa_estelar"]')).toHaveCount(0);

  const cardo = page.locator('[data-magia-nome="Raio Guia"]').first();
  const botaoGratis = cardo.locator('[data-conjurar-gratis="Raio Guia"]');
  await expect(botaoGratis).toBeVisible();

  // Sabedoria 16 = modificador +3 -> pelo menos 2 usos seguidos disponíveis.
  await botaoGratis.click();
  await assentar(page).catch(() => {});
  await expect(page.locator('[data-magia-nome="Raio Guia"]').first()
    .locator('[data-conjurar-gratis="Raio Guia"]')).toBeVisible();

  await page.locator('[data-magia-nome="Raio Guia"]').first()
    .locator('[data-conjurar-gratis="Raio Guia"]').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('[data-magia-nome="Raio Guia"]').first()
    .locator('[data-conjurar-gratis="Raio Guia"]')).toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
