// A loja mostra o mesmo detalhe do inventário: propriedades expansíveis e maestria.
import { test, expect } from '@playwright/test';
import { abrirFicha, clicarBotaoFicha, personagemSalvo } from './helpers-regras.mjs';

test('detalhe da Adaga na loja traz Propriedades expansíveis e Maestria, e adiciona o item', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Guerreiro', nivel: 3 }, 'regras-loja-detalhe-a');
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#busca-inv-cat').fill('adaga');
  await page.locator('#lista-inv-cat .inv-item', { hasText: 'Adaga' }).first().click();
  const modal = page.locator('.sub-modal-overlay').last();
  await expect(modal).toContainText('Maestria');
  expect(await modal.locator('details').count()).toBeGreaterThanOrEqual(3);
  await expect(modal.locator('#btn-adicionar-contador')).toHaveCount(0);
  await expect(modal.locator('#sel-atributo-item')).toHaveCount(0);
  await modal.locator('#btn-confirmar-add-item').click();
  await expect(page.locator('.toast, [class*="toast"]').last()).toContainText('Adaga');
  const salvo = await personagemSalvo(page);
  expect((salvo?.inventario || []).some(i => i.nome === 'Adaga')).toBe(true);
  expect(erros, `erros: ${erros.join('; ')}`).toEqual([]);
});
