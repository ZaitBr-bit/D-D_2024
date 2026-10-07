// ============================================================
// Issue #68 -- as magias de Maestria de Magias e Assinatura Mágica já
// aparecem na lista PRINCIPAL de Preparadas (com o selo de origem), mas
// só o painel de recursos do Mago, lá em cima da ficha, tinha o botão
// para conjurá-las de graça. Este spec prova o clique de verdade no
// botão "Grátis" DENTRO da lista principal, e confirma que o painel de
// cima (outro lugar, mesmo estado) enxerga o mesmo uso.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha } from './helpers-regras.mjs';

/** Abre todos os <details> da página (as seções de círculo da lista de
 *  Preparadas nascem recolhidas) -- copiado do mesmo helper local já usado
 *  em magia-customizada-preparar.spec.mjs/magia-customizada-conhecidas.spec.mjs. */
async function abrirTudo(page) {
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  await assentar(page).catch(() => {});
}

const GRIMORIO = [
  { nome: 'Mísseis Mágicos', circulo: 1 },
  { nome: 'Despedaçar', circulo: 2 },
  { nome: 'Bola de Fogo', circulo: 3 },
  { nome: 'Contramagia', circulo: 3 },
];

test('lista principal: botão Grátis da Maestria de Magias conjura sem gastar espaço', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', nivel: 18, xp: 300000, atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Arcanismo', 'História'], grimorio: GRIMORIO,
  }, 'regras-mago-gratis-maestria');

  await clicarSeletorFicha(page, '[data-mago-acao="definir-maestria-magias"]',
    { esperar: '#btn-salvar-magias-fixas' });
  await assentar(page).catch(() => {});
  await page.locator('#magia-fixa-c1 [data-opcao="Mísseis Mágicos"] .opcao-check').click();
  await page.locator('#magia-fixa-c2 [data-opcao="Despedaçar"] .opcao-check').click();
  await page.click('#btn-salvar-magias-fixas');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  // O botão Grátis mora JUNTO da magia na lista principal, não só lá em cima.
  const cardoMissil = page.locator('[data-magia-nome="Mísseis Mágicos"]').first();
  await expect(cardoMissil.locator('[data-conjurar-gratis="Mísseis Mágicos"]')).toBeVisible();

  await cardoMissil.locator('[data-conjurar-gratis="Mísseis Mágicos"]').click();
  await assentar(page).catch(() => {});

  // Maestria de Magias é "à vontade": o botão continua disponível depois de usado.
  await expect(cardoMissil.locator('[data-conjurar-gratis="Mísseis Mágicos"]')).toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('lista principal: botão Grátis da Assinatura Mágica esgota a vaga e some -- o painel de cima também vê', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', nivel: 20, xp: 355000, atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Arcanismo', 'História'], grimorio: GRIMORIO,
  }, 'regras-mago-gratis-assinatura');

  await clicarSeletorFicha(page, '[data-mago-acao="definir-assinaturas"]',
    { esperar: '#btn-salvar-magias-fixas' });
  await assentar(page).catch(() => {});
  await page.locator('#modal-overlay [data-opcao="Bola de Fogo"] .opcao-check').first().click();
  await page.click('#btn-salvar-magias-fixas');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  const cardoBolaDeFogo = page.locator('[data-magia-nome="Bola de Fogo"]').first();
  await expect(cardoBolaDeFogo.locator('[data-conjurar-gratis="Bola de Fogo"]')).toBeVisible();
  await cardoBolaDeFogo.locator('[data-conjurar-gratis="Bola de Fogo"]').click();
  await assentar(page).catch(() => {});

  // Usada pela lista principal: o botão da própria lista some...
  await expect(page.locator('[data-magia-nome="Bola de Fogo"]').first().locator('[data-conjurar-gratis="Bola de Fogo"]'))
    .toHaveCount(0);
  // ...e o botão DEDICADO do painel de recursos do Mago (outro lugar da
  // tela, mesmo estado -- char.recursos.mago.assinatura_magia_1_usada)
  // também desabilita, sem precisar fechar e reabrir a ficha.
  await expect(page.locator('#painel-recursos-mago [data-mago-acao="assinatura-1"]')).toBeDisabled();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
