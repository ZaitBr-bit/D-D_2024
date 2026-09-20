// ============================================================
// Issue #90 -- os cards "Trocar Magias (Opcional)" e "Trocar Truques
// (Opcional)" do assistente de level-up apareciam sempre abertos, mesmo
// quando o jogador não tinha intenção de trocar nada -- poluição visual.
// Passam a nascer minimizados (mesmo padrão de <details> sem `open` já
// usado na ficha, sheet/magias.js), com um clique real revelando o
// conteúdo.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp } from './helpers-regras.mjs';

const CLERIGO = {
  classe: 'Clérigo', nivel: 5, xp: 14000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['História', 'Religião'],
  magias_preparadas: [{ nome: 'Curar Ferimentos', circulo: 1 }],
};

/** Avança o assistente até o card de troca de magia existir no DOM. */
async function irAteCardExistir(page) {
  const card = page.locator('#levelup-troca-magia');
  for (let i = 0; i < 10; i++) {
    if (await card.count()) return card;
    const proximo = page.locator('#btn-step-proximo');
    if (await proximo.count()) await proximo.click();
    await page.waitForTimeout(500);
  }
  return card;
}

test('level-up: o card "Trocar Magias" nasce minimizado, e um clique no cabeçalho revela o conteúdo', async ({ context }) => {
  const { page } = await abrirFicha(context, CLERIGO, 'regras-levelup-troca-minimizada');
  await abrirModalLevelUp(page);

  const card = await irAteCardExistir(page);
  await expect(card.locator('..'), 'sanity: o card precisa estar no DOM antes de medir o estado inicial').toHaveCount(1);

  // Antes do clique: o conteúdo do card (o próprio placeholder da troca)
  // não pode estar visível -- é exatamente isso que "nascer minimizado" quer dizer.
  await expect(card, 'o card não pode nascer visível -- issue #90 pede minimizado por padrão').not.toBeVisible();

  // Clique real no <summary> -- só então o conteúdo aparece.
  await page.locator('details:has(#levelup-troca-magia) > summary').click();
  await expect(card).toBeVisible();
});
