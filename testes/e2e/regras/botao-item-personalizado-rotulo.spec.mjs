// ============================================================
// Issue #84 -- o botão de item customizado do inventário dizia "+ Custom",
// um rótulo confuso (jargão de dev, não vocabulário do jogador). Passa a
// dizer "+ Item Personalizado" -- clareza de rótulo, sem lógica nova.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar } from './helpers-regras.mjs';

test('inventário: o botão de item customizado diz "+ Item Personalizado" e continua abrindo o modal', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Atletismo', 'História'],
  }, 'regras-item-personalizado-rotulo');
  await assentar(page).catch(() => {});

  const botao = page.locator('#btn-add-inv-custom');
  await expect(botao).toHaveText('+ Item Personalizado');
  await expect(page.locator('text=+ Custom')).toHaveCount(0);

  // Clique real: o botão continua abrindo o mesmo modal de sempre.
  await botao.click();
  await expect(page.locator('#ic-nome')).toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
