// ============================================================
// Issue #76 -- Criaturas Espectrais (Ilusionista, nível 6) migrou do
// bookkeeping dedicado (botões "Convocar Feérico (Grátis)"/"Invocar Fera
// (Grátis)" no painel de recursos do Mago, char.recursos.mago.subclasses.
// ilusionista.feerica_usada/fera_usada) para o botão "Grátis" único da
// lista principal de Magias (gratis_usado).
//
// Este spec prova as DUAS metades da migração: o botão novo funciona de
// verdade (clique real), e o botão antigo NÃO está mais na tela -- sem a
// segunda parte, um personagem antigo (ficha salva antes da migração)
// ainda veria os dois controles ao mesmo tempo.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar } from './helpers-regras.mjs';

test('ficha antiga: Convocar Feérico e Invocar Fera (Criaturas Espectrais) ganham o botão Grátis na lista principal, e o botão dedicado antigo some', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', subclasse: 'Ilusionista', nivel: 6, xp: 14000, atributos: ATRIBUTOS_REGRAS,
    magias_preparadas: [
      { nome: 'Convocar Feérico', circulo: 3, origem: 'sempre' },
      { nome: 'Invocar Fera', circulo: 2, origem: 'sempre' },
    ],
  }, 'regras-ilusionista-espectrais-gratis');

  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  await assentar(page).catch(() => {});

  // O botão dedicado antigo (painel de Características de Classe) não
  // pode mais existir na tela -- migração de verdade, não coexistência.
  await expect(page.locator('[data-mago-subclasse-acao="espectrais_feerica"]')).toHaveCount(0);
  await expect(page.locator('[data-mago-subclasse-acao="espectrais_fera"]')).toHaveCount(0);

  // O botão novo, na lista principal, conjura de verdade.
  const cardoFeerico = page.locator('[data-magia-nome="Convocar Feérico"]').first();
  await expect(cardoFeerico.locator('[data-conjurar-gratis="Convocar Feérico"]')).toBeVisible();
  await cardoFeerico.locator('[data-conjurar-gratis="Convocar Feérico"]').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('[data-magia-nome="Convocar Feérico"]').first()
    .locator('[data-conjurar-gratis="Convocar Feérico"]')).toHaveCount(0);

  // A segunda magia da mesma característica é um uso INDEPENDENTE -- ainda
  // disponível depois de gastar a primeira.
  const cardoFera = page.locator('[data-magia-nome="Invocar Fera"]').first();
  await expect(cardoFera.locator('[data-conjurar-gratis="Invocar Fera"]')).toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
