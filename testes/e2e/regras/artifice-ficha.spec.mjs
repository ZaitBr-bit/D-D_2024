// ============================================================
// Artífice na ficha: Magia de Funileiro (criar item temporário que some no
// Descanso Longo), Lampejo de Genialidade, Item de Armazenar Magia e a
// ausência de contador/toggle genérico nas características passivas.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, clicarBotaoFicha, clicarSeletorFicha } from './helpers-regras.mjs';

const ATR = { forca: 8, destreza: 13, constituicao: 14, inteligencia: 16, sabedoria: 12, carisma: 10 };

/** Abre todos os <details> da ficha para os botões ficarem visíveis. */
async function abrirTudo(page) {
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  await assentar(page).catch(() => {});
}

/** Lê o primeiro personagem salvo. */
function lerPersonagem(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('dnd_personagens'))[0]);
}

test('Magia de Funileiro cria item temporário e o Descanso Longo o remove', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Artífice', nivel: 1, xp: 0, atributos: ATR }, 'regras-artifice-funileiro');
  await abrirTudo(page);
  // Clique por DOM: sob carga a ficha re-renderiza e fecha os <details> depois de abrirTudo.
  await clicarSeletorFicha(page, '[data-artifice-acao="funileiro"]', { esperar: '#funileiro-item' });
  // Card com peso/custo e descrição do equipamento; a busca filtra a lista de 31 itens.
  await page.locator('#funileiro-item .opcao-busca').fill('corda');
  await expect(page.locator('#funileiro-item [data-opcao="Corda"]')).toContainText('kg');
  await page.locator('#funileiro-item [data-opcao="Corda"]').click();
  await page.locator('#btn-funileiro-criar').click();
  await assentar(page).catch(() => {});
  const temCorda = async () => (await lerPersonagem(page)).inventario
    .some((i) => i.nome === 'Corda' && i.origem?.expira === 'descanso_longo');
  expect(await temCorda()).toBe(true);
  // Selo de origem no inventário.
  await expect(page.locator('.inv-item-badges', { hasText: 'Temporário' })).toHaveCount(1);
  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  if (await page.locator('#btn-pular-troca-dl').isVisible().catch(() => false)) await page.locator('#btn-pular-troca-dl').click();
  await assentar(page).catch(() => {});
  expect(await temCorda()).toBe(false);
  expect((await lerPersonagem(page)).recursos.artifice.funileiro_gastos).toBe(0);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('Lampejo de Genialidade gasta um uso', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Artífice', nivel: 7, xp: 23000, atributos: ATR }, 'regras-artifice-lampejo');
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-artifice-acao="lampejo"]');
  await assentar(page).catch(() => {});
  expect((await lerPersonagem(page)).recursos.artifice.lampejo_gastos).toBe(1);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('Item de Armazenar Magia: armazenar e usar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Artífice', nivel: 11, xp: 85000, atributos: ATR }, 'regras-artifice-armazenar');
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-artifice-acao="armazenar-definir"]', { esperar: '#armazenar-objeto' });
  await page.locator('#armazenar-objeto').fill('Adaga');
  // Card da magia com círculo, escola e conjuração; sem escolher, o botão recusa.
  await page.locator('#btn-armazenar-confirmar').click();
  expect((await lerPersonagem(page)).recursos?.artifice?.armazenar ?? null).toBeNull();
  await page.locator('#armazenar-magia [data-opcao]').first().click();
  await page.locator('#btn-armazenar-confirmar').click();
  await assentar(page).catch(() => {});
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-artifice-acao="armazenar-usar"]');
  await assentar(page).catch(() => {});
  const a = (await lerPersonagem(page)).recursos.artifice.armazenar;
  expect(a.objeto).toBe('Adaga');
  expect(a.magia).toBeTruthy();
  expect(a.usos_gastos).toBe(1);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('características passivas do Artífice não ganham contador nem toggle genérico', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Artífice', nivel: 20, xp: 355000, atributos: ATR }, 'regras-artifice-passivas');
  await abrirTudo(page);
  for (const nome of ['Alma do Artífice', 'Funileiro de Item Mágico', 'Artifício Avançado']) {
    const card = page.locator('details', { has: page.locator('summary', { hasText: nome }) }).first();
    await expect(card, nome).toBeVisible();
    await expect(card.locator('[data-toggle-uso], [data-usar-habilidade]'), nome).toHaveCount(0);
  }
  expect(erros, erros.join('; ')).toEqual([]);
});
