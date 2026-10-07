// ============================================================
// Espaços do inventário: ordem escolhida pelo jogador (Equipados sempre no topo),
// escolha do espaço ao adicionar pela loja, item mágico e item personalizado, e a
// categoria "Componente de Magia" no item personalizado.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const LOCAIS = [{ id: 'l1', nome: 'Bolsa', conta_peso: true }, { id: 'l2', nome: 'Cofre', conta_peso: false }];
const GUERREIRO = {
  classe: 'Guerreiro', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS, moedas: { pl: 0, po: 500, pe: 0, pp: 0, pc: 0 },
  inventario_locais: LOCAIS,
  inventario: [
    { nome: 'Adaga', tipo: 'arma', quantidade: 1, equipado: true, dados: { dano: '1d4 Perfurante', categoria: 'Simples Corpo a Corpo', propriedades: 'Acuidade, Leve, Arremesso' } },
    { nome: 'Corda de Seda', tipo: 'generico', quantidade: 1, equipado: false, dados: { peso: '5 kg' } },
    { nome: 'Pederneira', tipo: 'generico', quantidade: 1, equipado: false, local: 'l1', dados: {} },
  ],
};

/** Chaves das seções do inventário na ordem da tela. */
const ordemNaTela = (page) => page.locator('#sheet-inventario [data-inv-secao]')
  .evaluateAll((els) => els.map((e) => e.dataset.invSecao));

/** Arrasta o espaço `de` pela alça ☰ e solta sobre o título do espaço `para` (mouse). */
async function arrastarEspaco(page, de, para) {
  await page.locator(`[data-espaco-chave="${de}"] [data-espaco-handle]`)
    .dragTo(page.locator(`[data-espaco-chave="${para}"]`));
  await assentar(page).catch(() => {});
}

test('ordem dos espaços: arrastar pela alça muda a ordem, Equipados fica em primeiro e a ordem sobrevive ao F5', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'espacos-ordem');
  await assentar(page).catch(() => {});
  expect(await ordemNaTela(page)).toEqual(['equipados', 'mochila', 'local_l1', 'local_l2']);
  await expect(page.locator('[data-inv-espaco-acao]'), 'sem setas de mover').toHaveCount(0);
  await expect(page.locator('[data-inv-secao="equipados"] [data-espaco-handle]'), 'Equipados não arrasta').toHaveCount(0);

  await arrastarEspaco(page, 'l2', 'l1');
  expect(await ordemNaTela(page)).toEqual(['equipados', 'mochila', 'local_l2', 'local_l1']);
  await arrastarEspaco(page, 'mochila', 'l2');
  expect(await ordemNaTela(page), 'Equipados continua em primeiro').toEqual(['equipados', 'local_l2', 'mochila', 'local_l1']);
  expect((await personagemSalvo(page)).inventario_ordem_espacos).toEqual(['l2', 'mochila', 'l1']);
  // A alça não recolhe nem expande o espaço.
  const antes = await page.locator('[data-inv-secao="mochila"]').getAttribute('class');
  await page.locator('[data-espaco-chave="mochila"] [data-espaco-handle]').click();
  expect(await page.locator('[data-inv-secao="mochila"]').getAttribute('class')).toBe(antes);

  await page.reload();
  await assentar(page).catch(() => {});
  expect(await ordemNaTela(page)).toEqual(['equipados', 'local_l2', 'mochila', 'local_l1']);
  // O seletor "mover para" de cada item segue a mesma ordem.
  const opcoes = await page.locator('[data-mover-inv]').first().locator('option').allTextContents();
  expect(opcoes.map((o) => o.trim())).toEqual(['Cofre', 'Mochila', 'Bolsa']);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('loja e item mágico: "Guardar em" põe o item novo no espaço escolhido', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'espacos-loja');
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption('equipamento');
  await page.locator('#busca-inv-cat').fill('corda');
  await page.locator('#lista-inv-cat [data-add-cat]', { hasText: 'Corda' }).first().click();
  await page.locator('#destino-item').selectOption('l1');
  await page.locator('#btn-confirmar-add-item').click();
  let salvo = await personagemSalvo(page);
  expect(salvo.inventario.find((i) => i.nome === 'Corda')?.local).toBe('l1');

  // O modal "Adicionar Item" continua aberto para adicionar outro.
  await page.locator('#sel-inv-cat').selectOption('magicos');
  await page.locator('#busca-inv-cat').fill('manto de protecao');
  await page.locator('[data-item-magico]', { hasText: 'Manto de Proteção' }).first().click();
  await page.locator('#destino-item-magico').selectOption('l2');
  await page.locator('#btn-confirmar-item-magico').click();
  await assentar(page).catch(() => {});
  salvo = await personagemSalvo(page);
  expect(salvo.inventario.find((i) => i.nome === 'Manto de Proteção')?.local).toBe('l2');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('item personalizado: escolhe o espaço e a categoria Componente de Magia', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'espacos-custom');
  await clicarSeletorFicha(page, '#btn-add-inv-custom', { esperar: '#btn-add-ic' });
  await page.locator('#destino-item-custom').selectOption('l2');
  await page.fill('#ic-nome', 'Diamante da família');
  await page.evaluate(() => { document.querySelectorAll('#modal-corpo details').forEach((d) => { d.open = true; }); });
  await expect(page.locator('#ic-categoria option[value="Componente de Magia"]')).toHaveCount(1);
  await page.locator('#ic-categoria').selectOption('Componente de Magia');
  await page.locator('#btn-add-ic').click();
  await assentar(page).catch(() => {});
  const item = (await personagemSalvo(page)).inventario.find((i) => i.nome === 'Diamante da família');
  expect(item?.local).toBe('l2');
  expect(item?.dados?.tipo_item).toBe('Componente de Magia');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('sem espaços criados o campo "Guardar em" não aparece', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { ...GUERREIRO, inventario_locais: [] }, 'espacos-sem-locais');
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption('equipamento');
  await page.locator('#busca-inv-cat').fill('corda');
  await page.locator('#lista-inv-cat [data-add-cat]', { hasText: 'Corda' }).first().click();
  await expect(page.locator('#btn-confirmar-add-item')).toBeVisible();
  await expect(page.locator('#destino-item')).toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });

  test('arrastar o espaço pelo toque na alça também reordena', async ({ context }) => {
    const { page, erros } = await abrirFicha(context, GUERREIRO, 'espacos-ordem-toque');
    await assentar(page).catch(() => {});
    await page.waitForSelector('[data-espaco-chave="l2"] [data-espaco-handle]', { state: 'attached' });
    // Toque: touchstart na alça, touchmove até o alvo, touchend sobre ele.
    await page.evaluate(() => {
      const alca = document.querySelector('[data-espaco-chave="l2"] [data-espaco-handle]');
      const alvo = document.querySelector('[data-espaco-chave="mochila"]');
      alvo.scrollIntoView({ block: 'center' });
      const a = alca.getBoundingClientRect();
      const b = alvo.getBoundingClientRect();
      const toque = (el, x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      const ini = toque(alca, a.left + 4, a.top + 4);
      const fim = toque(alvo, b.left + b.width / 2, b.top + b.height / 2);
      alca.dispatchEvent(new TouchEvent('touchstart', { touches: [ini], changedTouches: [ini], bubbles: true }));
      alca.dispatchEvent(new TouchEvent('touchmove', { touches: [fim], changedTouches: [fim], bubbles: true, cancelable: true }));
      alca.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [fim], bubbles: true }));
    });
    await assentar(page).catch(() => {});
    expect(await ordemNaTela(page)).toEqual(['equipados', 'local_l2', 'mochila', 'local_l1']);
    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });
});
