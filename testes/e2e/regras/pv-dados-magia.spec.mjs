// ============================================================
// Vitalidade Vazia (2d4 + 4) e Banquete de Heróis (2d10 PV máx.): a conjuração pergunta se usa a
// média ou a soma dos dados que o jogador rolou, em vez de aplicar sempre a média.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const MAGO = {
  classe: 'Mago', nivel: 5, xp: 6500, atributos: { ...ATRIBUTOS_REGRAS, inteligencia: 16 },
  grimorio: [{ nome: 'Vitalidade Vazia', circulo: 1 }],
  magias_preparadas: [{ nome: 'Vitalidade Vazia', circulo: 1, classe: 'Mago' }],
};

test('Vitalidade Vazia: usar a média dá 9 PV temporários e a conjuração só acontece depois da escolha', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO, 'pv-dados-media');
  await assentar(page).catch(() => {});
  await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); });
  await clicarSeletorFicha(page, '[data-conjurar="Vitalidade Vazia"]', { esperar: '#btn-pv-media' });
  expect((await personagemSalvo(page)).pv_temporario || 0, 'nada muda antes da escolha').toBe(0);
  await expect(page.locator('#btn-pv-media')).toContainText('média (9)');
  await page.locator('#btn-pv-media').click();
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).pv_temporario).toBe(9);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Vitalidade Vazia: informar os dados soma o +4; valor fora de 2 a 8 é recusado', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO, 'pv-dados-rolado');
  await assentar(page).catch(() => {});
  await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); });
  await clicarSeletorFicha(page, '[data-conjurar="Vitalidade Vazia"]', { esperar: '#btn-pv-dados' });
  await page.locator('#pv-soma-dados').fill('12');
  await page.locator('#btn-pv-dados').click();
  await expect(page.locator('#toast-container')).toContainText('de 2 a 8');
  await expect(page.locator('#btn-pv-dados'), 'o modal continua aberto').toBeVisible();
  await page.locator('#pv-soma-dados').fill('7');
  await page.locator('#btn-pv-dados').click();
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).pv_temporario, '7 + 4').toBe(11);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Banquete de Heróis: os dados informados viram PV máximos', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo', nivel: 11, xp: 85000, atributos: { ...ATRIBUTOS_REGRAS, sabedoria: 16 }, pv_max: 90, pv_atual: 90,
    magias_preparadas: [{ nome: 'Banquete de Heróis', circulo: 6, classe: 'Clérigo' }],
  }, 'pv-dados-banquete');
  await assentar(page).catch(() => {});
  await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); });
  await clicarSeletorFicha(page, '[data-conjurar="Banquete de Heróis"]', { esperar: '#alvo-self' });
  await page.locator('#alvo-self').click();
  await expect(page.locator('#btn-pv-media')).toContainText('média (11)');
  await page.locator('#pv-soma-dados').fill('15');
  await page.locator('#btn-pv-dados').click();
  await assentar(page).catch(() => {});
  const salvo = await personagemSalvo(page);
  expect(salvo.pv_max_override, '90 + 15').toBe(105);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
