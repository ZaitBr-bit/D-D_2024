// ============================================================
// Selo de origem (livro) nas telas de SELEÇÃO de magias e itens de expansão, e
// não na ficha. Magia de Arcana Unleashed e item de Tasha's levam o chip; o
// conteúdo do Livro do Jogador não leva.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar, clicarBotaoFicha, clicarSeletorFicha } from './helpers-regras.mjs';

const MAGO_9 = {
  classe: 'Mago', subclasse: 'Necromante', nivel: 9, xp: 64000,
  atributos: { ...ATRIBUTOS_REGRAS, inteligencia: 16 },
  grimorio: [{ nome: 'Raio Nauseante', circulo: 1 }, { nome: 'Enervação', circulo: 5 }],
  magias_preparadas: [{ nome: 'Raio Nauseante', circulo: 1, classe: 'Mago' }, { nome: 'Enervação', circulo: 5, classe: 'Mago' }],
};

test('Preparar Magias: a magia de Arcana tem o selo e a do Livro do Jogador não', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_9, 'selos-magias');
  await assentar(page).catch(() => {});
  await clicarSeletorFicha(page, '#btn-add-magia', { esperar: '[data-tab-mg="5"]' });
  await page.locator('[data-tab-mg="5"]').click();
  const enervacao = page.locator('#modal-corpo .opcao-card', { hasText: 'Enervação' });
  await expect(enervacao.locator('.selo-fonte')).toHaveText('Sup. 3');
  await page.locator('[data-tab-mg="1"]').click();
  const raio = page.locator('#modal-corpo .opcao-card', { hasText: 'Raio Nauseante' });
  await expect(raio).toBeVisible();
  await expect(raio.locator('.selo-fonte')).toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: a magia de expansão não leva o selo na linha da magia', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_9, 'selos-ficha');
  await assentar(page).catch(() => {});
  await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); });
  await page.waitForSelector('[data-conjurar="Enervação"]', { state: 'attached' });
  const cardMagias = page.locator('.card', { has: page.locator('[data-conjurar="Enervação"]') }).last();
  await expect(cardMagias.locator('.selo-fonte'), 'a linha da magia na ficha não leva selo').toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Adicionar Item: o item de Tasha tem o selo, o do Livro do Mestre não, e o selo abre a origem sem abrir o item', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Guerreiro', nivel: 1 }, 'selos-itens');
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption('magicos');
  const tasha = page.locator('[data-item-magico]', { hasText: 'Botas do Caminho Sinuoso' });
  await expect(tasha.locator('.selo-fonte')).toHaveText('Sup. 1');
  const semSelo = await page.locator('[data-item-magico]').evaluateAll((els) => els.filter((e) => !e.querySelector('.selo-fonte')).length);
  expect(semSelo, 'itens do Livro do Mestre ficam sem selo').toBeGreaterThan(10);

  await tasha.locator('.selo-fonte').click();
  await expect(page.locator('.popover-fonte')).toContainText('Suplemento 1');
  await expect(page.locator('#modal-titulo'), 'o clique no selo não abre o item').not.toContainText('Botas do Caminho Sinuoso');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('subida de nível: o grid de "Necromancia: +2 Magia(s)" mostra o selo na magia de Arcana', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', nivel: 2, xp: 355000, atributos: ATRIBUTOS_REGRAS, pericias_proficientes: ['Arcanismo', 'História'],
    magias_conhecidas: [{ nome: 'Luz', circulo: 0 }, { nome: 'Mãos Mágicas', circulo: 0 }, { nome: 'Ilusão Menor', circulo: 0 }],
  }, 'selos-levelup');
  expect(await abrirModalLevelUp(page)).toBe(true);
  const proximo = async () => {
    if (!await page.locator('#btn-step-proximo').count()) return false;
    await page.locator('#btn-step-proximo').click();
    await assentar(page).catch(() => {});
    return true;
  };
  await proximo();
  await page.locator('[data-subclasse="Necromante"]').click();
  await assentar(page).catch(() => {});
  for (let i = 0; i < 5 && !(await page.locator('#btn-lvlup-subclasse-arcana').count()); i++) {
    if (!await proximo()) break;
  }
  await page.locator('#btn-lvlup-subclasse-arcana').click();
  await assentar(page).catch(() => {});
  const grupos = page.locator('#grid-magias details[data-grid-circulo] summary');
  for (let i = 0; i < await grupos.count(); i++) await grupos.nth(i).click();
  const murchar = page.locator('#grid-magias [data-grid-nome="Murchar e Florescer"]');
  await expect(murchar.locator('.selo-fonte')).toHaveText('Sup. 3');
  const enfraquecimento = page.locator('#grid-magias [data-grid-nome="Raio do Enfraquecimento"]');
  await expect(enfraquecimento).toBeVisible();
  await expect(enfraquecimento.locator('.selo-fonte')).toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
