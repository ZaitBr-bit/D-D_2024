// ============================================================
// Issue #76 -- Destruição do Paladino (nível 2) sempre concedeu "Destruição
// Divina" sempre preparada (origem: 'sempre'), mas nunca marcava
// `gratis_usado`, o campo que o botão "Grátis" da lista principal já lê
// (issue #68). Sem ele, a cláusula "pode conjurá-la sem gastar um espaço de
// magia" da própria característica não tinha jeito nenhum de usar na tela.
//
// Este spec semeia uma ficha ANTIGA -- 'sempre' já gravado, sem
// `gratis_usado` -- para provar o caminho de MIGRAÇÃO na abertura
// (migrarMagiasSemprePreparadas, sheet/migracoes.js), não só a concessão
// nova em subirDeNivel (essa já tem cobertura de unidade em
// magia-concessao-gratis-classe.test.mjs).
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar } from './helpers-regras.mjs';

test('ficha antiga: Destruição Divina (Destruição do Paladino) ganha o botão Grátis na lista principal ao reabrir', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Paladino', nivel: 2, xp: 900, atributos: ATRIBUTOS_REGRAS,
    magias_preparadas: [{ nome: 'Destruição Divina', circulo: 1, origem: 'sempre' }],
  }, 'regras-paladino-destruicao-gratis');

  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  await assentar(page).catch(() => {});

  // O botão dedicado antigo tinha DOIS lugares: o card de Características
  // de Classe (habilidades.js) e a barra "Recursos do Paladino" no topo da
  // ficha (ficha.js) -- os dois precisam ter sumido, não só um.
  await expect(page.locator('[data-paladino-acao="destruicao-gratuita"]')).toHaveCount(0);

  const cardo = page.locator('[data-magia-nome="Destruição Divina"]').first();
  const botaoGratis = cardo.locator('[data-conjurar-gratis="Destruição Divina"]');
  await expect(botaoGratis).toBeVisible();

  await botaoGratis.click();
  await assentar(page).catch(() => {});

  // Destruição do Paladino é 1x/Descanso Longo (não à vontade): o botão
  // desaparece depois de usado, ao contrário da Maestria de Magias do Mago.
  await expect(page.locator('[data-magia-nome="Destruição Divina"]').first()
    .locator('[data-conjurar-gratis="Destruição Divina"]')).toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
