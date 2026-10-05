// ============================================================
// Tela de resultado do level-up com ASI de Constituição e Amuleto da Saúde
// equipado: o máximo sobe 10 e o PV atual sobe 8 (o bônus de PV do item cai
// de 10 para 6 porque a Constituição-base subiu). A tela mostrava "+4 HP" e
// "máximo +4, PV atual +8".
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, abrirModalLevelUp, personagemSalvo, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const AMULETO = { nome: 'Amuleto da Saúde', tipo: 'magico', equipado: true, sintonizado: true,
  dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'constituicao', minimo: 19 }] } };

test('level-up com ASI de Constituição e Amuleto: a tela mostra máximo +10 e PV atual +8', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', nivel: 5, xp: 355000, atributos: ATRIBUTOS_REGRAS, talentos: [],
    pv_max: 44, pv_atual: 44, inventario: [structuredClone(AMULETO)],
  }, 'regras-levelup-resultado-pv-amuleto');
  // A ficha reaplica o bônus do Amuleto no render: o máximo sobe 10 e o PV atual fica como estava.
  await expect.poll(async () => (await personagemSalvo(page)).pv_max).toBe(54);
  const antes = await personagemSalvo(page);

  expect(await abrirModalLevelUp(page)).toBe(true);
  for (let i = 0; i < 10 && !(await page.locator('#levelup-asi-atributos').count()); i++) {
    await page.locator('#btn-step-proximo').click();
    await page.waitForTimeout(400);
  }
  await page.check('input[name="levelup-asi-modo"][value="atributo"]');
  await page.selectOption('#levelup-attr-constituicao', '2');
  for (let i = 0; i < 6 && !(await page.locator('#btn-confirmar-levelup').count()); i++) {
    await page.locator('#btn-step-proximo').click();
    await page.waitForTimeout(400);
  }
  await page.locator('#btn-confirmar-levelup').click();
  await expect(page.locator('text=/Total: \\d+ PV/').first()).toBeVisible();

  const corpo = await page.locator('#modal-corpo').innerText();
  expect(corpo).toContain('+10 HP');
  expect(corpo).toContain('máximo +10, PV atual +8');
  const depois = await personagemSalvo(page);
  expect(depois.pv_max - antes.pv_max).toBe(10);
  expect(depois.pv_atual - antes.pv_atual).toBe(8);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
