// ============================================================
// Recuperação Arcana: escolher os espaços a recuperar com botões − e + (sem digitar), respeitando
// o orçamento de círculos combinados e os espaços realmente gastos.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirBlocosRecursos, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

// Mago 5: recupera até 3 de círculos combinados. Gastos: 2 de 1º, 1 de 2º, 1 de 3º.
const MAGO = {
  classe: 'Mago', nivel: 5, xp: 6500, atributos: { ...ATRIBUTOS_REGRAS, inteligencia: 16 },
  espacos_magia: { conjuracao: { 1: 2, 2: 1, 3: 1 } },
};
const mais = (c) => `[data-recuperar-passo="mais"][data-circulo="${c}"]`;
const menos = (c) => `[data-recuperar-passo="menos"][data-circulo="${c}"]`;

test('Recuperação Arcana: + e − respeitam o orçamento e os espaços gastos, e o botão só vale com algo escolhido', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO, 'recuperacao-botoes');
  await assentar(page).catch(() => {});
  await abrirBlocosRecursos(page);
  await clicarSeletorFicha(page, '#painel-recursos-mago [data-mago-acao="recuperacao-arcana"]', { esperar: '#btn-recuperar-confirmar' });

  await expect(page.locator('#recuperar-total')).toContainText('Total: 0 / 3');
  await expect(page.locator('#btn-recuperar-confirmar'), 'sem nada escolhido não confirma').toBeDisabled();
  await expect(page.locator(menos(1))).toBeDisabled();

  await page.locator(mais(1)).click();
  await page.locator(mais(1)).click();
  await expect(page.locator('.recuperar-slot[data-circulo="1"]')).toHaveValue('2');
  await expect(page.locator(mais(1)), 'só há 2 espaços de 1º gastos').toBeDisabled();
  await expect(page.locator('#recuperar-total')).toContainText('Total: 2 / 3');
  await expect(page.locator(mais(2)), '2 + 2 passaria do orçamento de 3').toBeDisabled();
  await expect(page.locator(mais(3))).toBeDisabled();

  await page.locator(menos(1)).click();
  await expect(page.locator('#recuperar-total')).toContainText('Total: 1 / 3');
  await expect(page.locator(mais(2)), 'agora cabe o de 2º').toBeEnabled();
  await page.locator(mais(2)).click();
  await expect(page.locator('#recuperar-total')).toContainText('Total: 3 / 3');
  await expect(page.locator(mais(1)), 'orçamento esgotado').toBeDisabled();

  await page.locator('#btn-recuperar-confirmar').click();
  await assentar(page).catch(() => {});
  const salvo = await personagemSalvo(page);
  expect(salvo.espacos_magia.conjuracao[1], '1 de 1º recuperado').toBe(1);
  expect(salvo.espacos_magia.conjuracao[2], '1 de 2º recuperado').toBe(0);
  expect(salvo.espacos_magia.conjuracao[3], 'o de 3º continua gasto').toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
