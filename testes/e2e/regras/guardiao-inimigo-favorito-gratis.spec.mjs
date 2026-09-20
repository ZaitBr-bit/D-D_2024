// ============================================================
// Issue #76, Fase C -- Inimigo Favorito (Guardião, nível 1) concede Marca
// do Caçador sempre preparada com 2 usos grátis (sem gastar espaço de
// magia), restaurados no Descanso Longo. É uso MÚLTIPLO -- não cabe no
// booleano `gratis_usado` -- por isso lê o adaptador de recurso dedicado
// (regras-usos-gratis-magia.js), que por sua vez lê o MESMO
// `char.recursos.guardiao.inimigo_favorito_usos_gastos` que o painel de
// recursos do Guardião usa.
//
// Este spec clica o botão "Grátis" de verdade, duas vezes, e confirma que
// o botão só desaparece depois do 2º clique -- prova visual de que o
// mecanismo é um CONTADOR, não um toggle de 1 uso.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar } from './helpers-regras.mjs';

test('lista principal: botão Grátis de Marca do Caçador (Inimigo Favorito) tem 2 usos, não 1', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guardião', nivel: 1, xp: 0, atributos: ATRIBUTOS_REGRAS,
    magias_preparadas: [{ nome: 'Marca do Caçador', circulo: 1, origem: 'sempre' }],
  }, 'regras-guardiao-inimigo-favorito-gratis');

  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  await assentar(page).catch(() => {});

  const cardo = page.locator('[data-magia-nome="Marca do Caçador"]').first();
  const botaoGratis = cardo.locator('[data-conjurar-gratis="Marca do Caçador"]');
  await expect(botaoGratis).toBeVisible();

  await botaoGratis.click();
  await assentar(page).catch(() => {});

  // 1º uso gasto: o botão CONTINUA visível -- Inimigo Favorito no nível 1
  // dá 2 usos, e um toggle de 1 uso só (o bug que este mecanismo evita)
  // já teria escondido o botão aqui.
  await expect(page.locator('[data-magia-nome="Marca do Caçador"]').first()
    .locator('[data-conjurar-gratis="Marca do Caçador"]')).toBeVisible();

  await page.locator('[data-magia-nome="Marca do Caçador"]').first()
    .locator('[data-conjurar-gratis="Marca do Caçador"]').click();
  await assentar(page).catch(() => {});

  // 2º uso gasto: agora sim esgotou.
  await expect(page.locator('[data-magia-nome="Marca do Caçador"]').first()
    .locator('[data-conjurar-gratis="Marca do Caçador"]')).toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
