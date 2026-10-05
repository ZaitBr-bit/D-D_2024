// ============================================================
// Prova por navegador da categoria "Itens Mágicos" do modal Adicionar
// Item (site/js/itens-magicos-ui.js): adicionar, equipar, sintonizar e ver
// o número da ficha mudar; variante + arma-base; escolha obrigatória.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, clicarBotaoFicha, assentar } from './helpers-regras.mjs';

const GUERREIRO = { classe: 'Guerreiro', nivel: 1 };

/** Valor exibido no stat-box de rótulo exato. */
async function statBox(page, rotulo) {
  return page.locator('.stat-box').filter({ has: page.locator('.stat-label', { hasText: new RegExp(`^${rotulo}$`) }) }).locator('.stat-value').first().innerText();
}

/** Abre o modal Adicionar Item na categoria Itens Mágicos e busca pelo texto. */
async function abrirCategoriaMagicos(page, busca) {
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption('magicos');
  await expect(page.locator('#filtro-tipo-magico')).toBeVisible();
  await page.locator('#busca-inv-cat').fill(busca);
}

/** Fecha o modal principal "Adicionar Item" (fica aberto depois de adicionar) para acessar a ficha. */
async function fecharModalPrincipal(page) {
  await page.locator('#modal-header .modal-fechar').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
}

test('Anel de Proteção: adicionar, equipar e sintonizar soma +1 na CA', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-itens-magicos-1');
  const caAntes = Number(await statBox(page, 'CA'));

  await abrirCategoriaMagicos(page, 'Anel de Proteção');
  await page.locator('[data-item-magico]', { hasText: 'Anel de Proteção' }).first().click();
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('adicionado');
  await assentar(page).catch(() => {});
  await fecharModalPrincipal(page);

  const linha = page.locator('.inv-item[data-idx]', { hasText: 'Anel de Proteção' });
  await expect(linha).toContainText('Rara');
  await linha.locator('[data-sheet-equip]').check();
  await assentar(page).catch(() => {});
  await expect.poll(() => statBox(page, 'CA'), { message: 'sem sintonizar, a CA não muda' }).toBe(String(caAntes));

  await page.locator('.inv-item[data-idx]', { hasText: 'Anel de Proteção' }).locator('[data-sintonizar]').check();
  await assentar(page).catch(() => {});
  await expect.poll(() => statBox(page, 'CA'), { message: 'sintonizado, a CA sobe 1' }).toBe(String(caAntes + 1));

  const p = await personagemSalvo(page);
  const anel = p.inventario.find((i) => i.nome === 'Anel de Proteção');
  expect(anel.tipo).toBe('magico');
  expect(anel.dados.efeitos).toEqual([{ alvo: 'ca', valor: 1 }, { alvo: 'salvaguarda', valor: 1 }]);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Arma +1: sem variante avisa e não grava; com variante e Rapieira grava a arma mágica', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-itens-magicos-2');
  await abrirCategoriaMagicos(page, 'Arma +1');
  await page.locator('[data-item-magico]', { hasText: 'Arma +1, +2 ou +3' }).first().click();

  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('Escolha a variante');
  expect((await personagemSalvo(page)).inventario.some((i) => (i.nome || '').startsWith('Arma +'))).toBe(false);

  await page.locator('input[name="variante-magica"][value="arma-mais-1"]').check();
  // Com variante e sem arma-base: avisa e não grava.
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('Escolha a arma-base');
  expect((await personagemSalvo(page)).inventario.some((i) => (i.nome || '').startsWith('Arma +'))).toBe(false);

  await page.selectOption('#base-item-magico', 'Rapieira');
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('Arma +1 (Rapieira) adicionado');
  await assentar(page).catch(() => {});

  const p = await personagemSalvo(page);
  const arma = p.inventario.find((i) => i.nome === 'Arma +1 (Rapieira)');
  expect(arma.tipo).toBe('arma');
  expect(arma.dados.nome_base).toBe('Rapieira');
  expect(arma.dados.efeitos).toEqual([{ alvo: 'ataque_arma', valor: 1 }, { alvo: 'dano_arma', valor: 1 }]);
  await expect(page.locator('.inv-item[data-idx]', { hasText: 'Arma +1 (Rapieira)' })).toContainText(/Atq \+\d/);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Escudo +1: entra como escudo e soma 2 + 1 na CA ao equipar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-itens-magicos-3');
  const caAntes = Number(await statBox(page, 'CA'));
  await abrirCategoriaMagicos(page, 'Escudo +1');
  await page.locator('[data-item-magico]', { hasText: 'Escudo +1, +2 ou +3' }).first().click();
  await page.locator('input[name="variante-magica"][value="escudo-mais-1"]').check();
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('Escudo +1 adicionado');
  await assentar(page).catch(() => {});
  await fecharModalPrincipal(page);

  await page.locator('.inv-item[data-idx]', { hasText: 'Escudo +1' }).locator('[data-sheet-equip]').check();
  await assentar(page).catch(() => {});
  await expect.poll(() => statBox(page, 'CA'), { message: 'Escudo (+2) +1 mágico' }).toBe(String(caAntes + 3));
  expect((await personagemSalvo(page)).inventario.find((i) => i.nome === 'Escudo +1').tipo).toBe('escudo');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('filtros de raridade e tipo estreitam a lista e voltam ao padrão ao reabrir o modal', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-itens-magicos-5');
  const itens = page.locator('#lista-inv-cat [data-item-magico]');
  await abrirCategoriaMagicos(page, '');
  await expect(itens.first()).toBeVisible();
  const total = await itens.count();

  await page.locator('[data-filtro-raridade="Comum"]').click();
  await page.locator('#filtro-tipo-magico').selectOption('Poção');
  await expect(page.locator('[data-filtro-raridade="Comum"]')).toHaveClass(/active/);
  await expect(page.locator('#lista-inv-cat')).toContainText('Poções de Cura');
  const filtrado = await itens.count();
  expect(filtrado, 'raridade + tipo devem estreitar a lista').toBeGreaterThan(0);
  expect(filtrado).toBeLessThan(total);

  await fecharModalPrincipal(page);
  await abrirCategoriaMagicos(page, '');
  await expect(page.locator('[data-filtro-raridade=""]')).toHaveClass(/active/);
  await expect(page.locator('#filtro-tipo-magico')).toHaveValue('');
  await expect(itens).toHaveCount(total);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Poção de Cura comum pela categoria mágica soma na mesma linha da mochila', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-itens-magicos-4');
  for (let n = 0; n < 2; n++) {
    await abrirCategoriaMagicos(page, 'Poção de Cura');
    await page.locator('[data-item-magico]', { hasText: 'Poções de Cura' }).first().click();
    await page.locator('input[name="variante-magica"][value="pocao-de-cura"]').check();
    await page.click('#btn-confirmar-item-magico');
    await expect(page.locator('#toast-container')).toContainText('Poção de Cura adicionado');
    await assentar(page).catch(() => {});
    await fecharModalPrincipal(page);
  }
  const pocoes = (await personagemSalvo(page)).inventario.filter((i) => i.nome === 'Poção de Cura');
  expect(pocoes.length, 'uma linha só').toBe(1);
  expect(pocoes[0].tipo).toBe('equipamento');
  expect(pocoes[0].quantidade).toBeGreaterThanOrEqual(2);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('seletor de itens mágicos: resposta atrasada da 1ª abertura não sobrescreve a busca e a lista não pisca', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-itens-magicos-busca');
  // 1ª requisição do acervo demora; as seguintes respondem na hora (chegam fora de ordem).
  let chamadas = 0;
  await page.route('**/itens_magicos.json', async (rota) => {
    chamadas += 1;
    if (chamadas === 1) await new Promise((r) => setTimeout(r, 1500));
    await rota.continue();
  });
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption('magicos');
  await page.locator('#busca-inv-cat').fill('Anel de Proteção');
  const itens = page.locator('[data-item-magico]');
  await expect(itens.first()).toContainText('Anel de Proteção');
  const filtrado = await itens.count();
  // Passa o tempo da resposta atrasada (busca sem texto): a lista filtrada tem de continuar.
  await page.waitForTimeout(2000);
  expect(chamadas, 'a 1ª abertura disparou mais de uma requisição').toBeGreaterThan(1);
  await expect(itens).toHaveCount(filtrado);
  await expect(itens.first()).toContainText('Anel de Proteção');

  // Com a lista na tela, digitar de novo não passa por "Carregando…".
  await page.evaluate(() => {
    window.__piscou = false;
    new MutationObserver(() => {
      if (document.getElementById('lista-inv-cat')?.textContent.includes('Carregando')) window.__piscou = true;
    }).observe(document.getElementById('lista-inv-cat'), { childList: true, subtree: true, characterData: true });
  });
  await page.locator('#busca-inv-cat').fill('Anel');
  await page.locator('#busca-inv-cat').fill('Anel de');
  await expect(itens.first()).toContainText('Anel');
  expect(await page.evaluate(() => window.__piscou), 'a lista não pode voltar a "Carregando…" ao digitar').toBe(false);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
