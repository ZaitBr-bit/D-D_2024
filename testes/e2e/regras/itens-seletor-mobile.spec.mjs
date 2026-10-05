// ============================================================
// Modal "Adicionar Item" no celular (site/js/itens-seletor.js):
//   - topo compacto: categoria num dropdown, lista com altura útil;
//   - teclado aberto (visualViewport menor que a janela): o modal cabe na
//     área visível e a lista continua visível e clicável;
//   - categoria "Todos": não lista nada sem busca; com busca varre todas as
//     categorias (inclusive Itens Mágicos), ignorando os filtros.
//
// O teclado virtual não existe no Chromium de desktop; o spec substitui
// window.visualViewport por um EventTarget com altura controlada. A prova no
// aparelho real (iOS/Android) continua manual.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, clicarBotaoFicha, personagemSalvo } from './helpers-regras.mjs';

const GUERREIRO = { classe: 'Guerreiro', nivel: 1 };
const VIEWPORT = { width: 390, height: 700 };

test.use({ viewport: VIEWPORT, hasTouch: true, isMobile: true });

/** Abre o modal Adicionar Item da ficha. */
async function abrirSeletor(context, id) {
  const { page, erros } = await abrirFicha(context, GUERREIRO, id);
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  // Medidas de geometria só valem depois do slideUp do modal.
  await page.evaluate(() => Promise.all(
    document.getAnimations().filter(a => a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished)));
  return { page, erros };
}

/**
 * Troca window.visualViewport por um falso em toda página do contexto (antes
 * de o app carregar) e expõe window.__definirAlturaVisivel(h) para simular o teclado.
 */
async function instalarVisualViewportFalso(context) {
  await context.addInitScript((alturaInicial) => {
    const falso = new EventTarget();
    Object.assign(falso, { height: alturaInicial, width: 390, offsetTop: 0, offsetLeft: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: falso });
    window.__definirAlturaVisivel = (h) => { falso.height = h; falso.dispatchEvent(new Event('resize')); };
  }, VIEWPORT.height);
}

test('celular: categorias numa linha só e lista com altura útil', async ({ context }) => {
  const { page, erros } = await abrirSeletor(context, 'regras-seletor-mobile-1');

  const seletor = await page.locator('#sel-inv-cat').boundingBox();
  expect(seletor.height, 'o dropdown de categoria ocupa uma linha só').toBeLessThan(60);

  const lista = await page.locator('#lista-inv-cat').boundingBox();
  expect(lista.height, 'a lista deveria ter pelo menos 40% da altura da tela').toBeGreaterThanOrEqual(VIEWPORT.height * 0.4);
  expect(lista.y + lista.height, 'a lista deveria terminar dentro da tela').toBeLessThanOrEqual(VIEWPORT.height + 1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('celular: com teclado aberto o modal cabe na área visível e a lista fica clicável', async ({ context }) => {
  await instalarVisualViewportFalso(context);
  const { page, erros } = await abrirSeletor(context, 'regras-seletor-mobile-2');

  await page.locator('#busca-inv-cat').fill('a');
  await page.evaluate(() => window.__definirAlturaVisivel(380));

  const container = await page.locator('#modal-container').boundingBox();
  expect(container.y + container.height, 'o modal deveria terminar acima do teclado').toBeLessThanOrEqual(381);

  const primeiro = page.locator('#lista-inv-cat .inv-item').first();
  await expect(primeiro).toBeVisible();
  const caixa = await primeiro.boundingBox();
  expect(caixa.y + caixa.height, 'o primeiro resultado deveria ficar acima do teclado').toBeLessThanOrEqual(381);
  await expect(page.locator('#sel-inv-cat'), 'com o teclado aberto o dropdown recolhe').toBeHidden();

  await page.evaluate(() => window.__definirAlturaVisivel(700));
  await expect(page.locator('#sel-inv-cat'), 'sem teclado o dropdown volta').toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Itens Mágicos: o botão de raridade ativo tem estilo diferente dos inativos', async ({ context }) => {
  const { page, erros } = await abrirSeletor(context, 'regras-seletor-mobile-5');
  await page.locator('#sel-inv-cat').selectOption('magicos');
  await page.locator('[data-filtro-raridade="Rara"]').click();

  await page.locator('#busca-inv-cat').click(); // tira o :hover (toque emulado) do botão clicado
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  const fundo = (seletor) => page.locator(seletor).evaluate(el => getComputedStyle(el).backgroundColor);
  const ativo = await fundo('[data-filtro-raridade="Rara"]');
  expect(ativo, 'o botão da raridade escolhida deveria destacar').not.toBe(await fundo('[data-filtro-raridade="Comum"]'));

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Todos: sem busca não lista nada; com busca varre as categorias e ignora filtros', async ({ context }) => {
  const { page, erros } = await abrirSeletor(context, 'regras-seletor-mobile-3');
  const lista = page.locator('#lista-inv-cat');

  // Filtro "Marcial" ativo em Armas não pode afetar a busca em Todos.
  await page.locator('[data-filtro-arma="marcial"]').click();

  await page.locator('#sel-inv-cat').selectOption('todos');
  await expect(page.locator('#sel-inv-cat')).toHaveValue('todos');
  await expect(lista.locator('.inv-item'), 'Todos não carrega itens antes da busca').toHaveCount(0);
  await expect(lista).toContainText('Digite');

  await page.locator('#busca-inv-cat').fill('adaga');
  await expect(lista.locator('.inv-item', { hasText: 'Adaga' }).first(), 'Adaga (arma Simples) aparece mesmo com o filtro Marcial').toBeVisible();

  await page.locator('#busca-inv-cat').fill('Anel de Proteção');
  await expect(lista.locator('[data-item-magico]', { hasText: 'Anel de Proteção' }).first(), 'item mágico entra na busca de Todos').toBeVisible();

  await page.locator('#busca-inv-cat').fill('Escudo');
  await expect(lista.locator('[data-add-cat]', { hasText: 'Escudo' }).first(), 'armadura entra na busca de Todos').toBeVisible();

  await page.locator('#busca-inv-cat').fill('zzz-nada-assim');
  await expect(lista).toContainText('Nenhum item encontrado');

  await page.locator('#busca-inv-cat').fill('a');
  expect(await lista.locator('.inv-item').count(), 'busca curta não renderiza a lista inteira').toBeLessThanOrEqual(80);
  await expect(lista).toContainText('refine');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Todos: item comum e item mágico encontrados na busca são adicionáveis', async ({ context }) => {
  const { page, erros } = await abrirSeletor(context, 'regras-seletor-mobile-4');
  await page.locator('#sel-inv-cat').selectOption('todos');

  await page.locator('#busca-inv-cat').fill('adaga');
  await page.locator('#lista-inv-cat [data-add-cat]', { hasText: 'Adaga' }).first().click();
  await page.locator('#btn-confirmar-add-item').click();
  await expect(page.locator('.toast, [class*="toast"]').last()).toContainText('Adaga');

  await page.locator('#busca-inv-cat').fill('Anel de Proteção');
  await page.locator('#lista-inv-cat [data-item-magico]', { hasText: 'Anel de Proteção' }).first().click();
  await page.locator('#btn-confirmar-item-magico').click();
  await expect(page.locator('#toast-container')).toContainText('Anel de Proteção');

  const salvo = await personagemSalvo(page);
  const nomes = (salvo?.inventario || []).map(i => i.nome);
  expect(nomes, 'Adaga e Anel de Proteção deveriam estar no inventário salvo').toEqual(
    expect.arrayContaining(['Adaga', 'Anel de Proteção']));

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
