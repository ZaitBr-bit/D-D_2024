// ============================================================
// Layout do bloco "Magias de Itens": mesmas linhas das magias preparadas
// (nome, origem e botão Conjurar alinhado à direita) dentro de um bloco
// recolhível que nasce fechado.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, clicarBotaoFicha, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const BARDO = { classe: 'Bardo', nivel: 1, atributos: ATRIBUTOS_REGRAS };
const BLOCO = 'details[data-details-id="magias-de-itens"]';

/** Fecha todos os modais abertos pela API da própria página. */
async function fecharTudo(page) {
  await page.evaluate(() => window.fecharModalTodos());
  await expect(page.locator('#modal-overlay')).toBeHidden();
}

/** Adiciona o Instrumento dos Bardos (variante Fochlucan), equipa e sintoniza. */
async function adicionarInstrumento(page) {
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption('magicos');
  await page.locator('#busca-inv-cat').fill('Instrumento dos Bardos');
  await page.locator('[data-item-magico]', { hasText: 'Instrumento dos Bardos' }).first().click();
  await page.locator('label:has-text("Fochlucan") input[name="variante-magica"]').check();
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('adicionado');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  const linha = page.locator('.inv-item[data-idx]', { hasText: 'Fochlucan' });
  await linha.locator('[data-sheet-equip]').check();
  await assentar(page).catch(() => {});
  const caixa = linha.locator('[data-sintonizar]');
  const mesmoAssim = page.locator('#btn-sintonizar-mesmo-assim');
  await caixa.click();
  await expect.poll(async () => (await mesmoAssim.isVisible()) || (await caixa.isChecked())).toBe(true);
  if (await mesmoAssim.isVisible()) await mesmoAssim.click();
  await expect(caixa).toBeChecked();
  await assentar(page).catch(() => {});
}

/** Abre o bloco "Magias de Itens" clicando no resumo, se ainda estiver fechado. */
async function abrirBloco(page) {
  const bloco = page.locator(BLOCO);
  if (!(await bloco.evaluate((d) => d.open))) await bloco.locator('summary').click();
  await expect(bloco).toHaveJSProperty('open', true);
}

/** Confere alinhamento das linhas: botão a no máximo 16 px da borda e mesmo x em todas. */
async function conferirAlinhamento(page) {
  const linhas = page.locator('.magias-de-itens .magia-item');
  const n = await linhas.count();
  expect(n).toBeGreaterThan(0);
  const xs = [];
  for (let i = 0; i < n; i++) {
    const linha = await linhas.nth(i).boundingBox();
    const botao = await linhas.nth(i).locator('[data-conjurar-item]').boundingBox();
    const folga = linha.x + linha.width - (botao.x + botao.width);
    expect(folga, `folga à direita da linha ${i}`).toBeLessThanOrEqual(16);
    xs.push(botao.x);
  }
  for (const x of xs) expect(Math.abs(x - xs[0])).toBeLessThanOrEqual(2);
}

test('Magias de Itens: bloco nasce fechado, linhas no layout das preparadas e botão alinhado', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BARDO, 'regras-magias-itens-layout-1');
  await adicionarInstrumento(page);

  // Bloco recolhível: nasce fechado, resumo com a contagem de linhas.
  const bloco = page.locator(BLOCO);
  await expect(bloco).toHaveCount(1);
  expect(await bloco.evaluate((d) => d.open)).toBe(false);
  await expect(bloco.locator('.magia-item').first()).toBeHidden();
  await abrirBloco(page);
  const linhas = page.locator('.magias-de-itens .magia-item');
  const total = await linhas.count();
  expect(total).toBeGreaterThan(0);
  await expect(bloco.locator('summary')).toContainText(`Magias de Itens (${total})`);

  // Re-render da ficha mantém o bloco aberto.
  await page.evaluate(async () => {
    const ficha = await import(new URL('./js/sheet/ficha.js', location.href).href);
    ficha.renderFichaCompleta();
  });
  await assentar(page).catch(() => {});
  expect(await page.locator(BLOCO).evaluate((d) => d.open)).toBe(true);

  // Cada linha: nome da magia, item e uso diário.
  for (let i = 0; i < total; i++) {
    const linha = linhas.nth(i);
    await expect(linha.locator('.magia-nome')).not.toHaveText('');
    await expect(linha).toContainText('Instrumento dos Bardos');
    await expect(linha).toContainText('1/amanhecer');
    // Selos de escola, tempo, duração e alcance, como nas magias comuns.
    expect(await linha.locator('.magia-tag').count()).toBeGreaterThanOrEqual(3);
    await expect(linha.locator('.magia-tag.tag-escola')).toHaveCount(1);
  }

  // Alinhamento em celular e em tela larga.
  for (const largura of [390, 960]) {
    await page.setViewportSize({ width: largura, height: 844 });
    await conferirAlinhamento(page);
  }

  // O botão continua disparando a conjuração.
  await linhas.filter({ hasText: 'Falar com Animais' }).locator('[data-conjurar-item]').click();
  await expect(page.locator('#toast-container')).toContainText('conjurada com');
  expect((await personagemSalvo(page)).inventario.length).toBeGreaterThan(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
