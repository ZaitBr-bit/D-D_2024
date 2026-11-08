// ============================================================
// Home com personagens: o botão "+ Novo Personagem" fica no cabeçalho, ao lado
// do título "Meus Personagens", pequeno, e não mais embaixo da lista.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, NOVO, abrirFicha, assentar } from './helpers-regras.mjs';

/** Abre a home de um navegador que já tem um personagem salvo. */
async function abrirHomeComPersonagem(context, id) {
  const { page, erros } = await abrirFicha(context, { classe: 'Guerreiro', nivel: 1, atributos: ATRIBUTOS_REGRAS }, id);
  await page.goto(NOVO, { waitUntil: 'domcontentloaded' });
  await assentar(page).catch(() => {});
  await expect(page.locator('.char-card').first()).toBeVisible();
  return { page, erros };
}

for (const largura of [1138, 390]) {
  test(`home ${largura}px: botão pequeno no cabeçalho, acima da lista, e um clique abre o criador`, async ({ context }) => {
    const { page, erros } = await abrirHomeComPersonagem(context, `home-novo-${largura}`);
    await page.setViewportSize({ width: largura, height: 800 });

    const botao = page.locator('#btn-novo-personagem');
    await expect(botao).toBeVisible();
    await expect(botao).toContainText('Novo Personagem');

    // Mesmo cabeçalho do título, acima do primeiro card e sem ocupar a linha inteira.
    const titulo = await page.getByRole('heading', { name: 'Meus Personagens' }).boundingBox();
    const caixa = await botao.boundingBox();
    const card = await page.locator('.char-card').first().boundingBox();
    expect(caixa.y + caixa.height).toBeLessThan(card.y);
    expect(caixa.y).toBeLessThan(titulo.y + titulo.height + 60);
    expect(caixa.height).toBeLessThanOrEqual(40);
    expect(caixa.width).toBeLessThan(largura * 0.6);

    // O botão grande de baixo não existe mais.
    await expect(page.locator('.btn-lg.btn-block', { hasText: 'Novo Personagem' })).toHaveCount(0);

    await botao.click();
    await expect(page).toHaveURL(/#criar$/);
    await expect(page.locator('[data-classe="Guerreiro"]')).toBeVisible();
    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });
}
