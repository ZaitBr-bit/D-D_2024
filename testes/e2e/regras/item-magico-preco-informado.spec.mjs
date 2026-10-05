// ============================================================
// Preço informado ao adicionar item mágico: cobra sempre que há valor,
// com ou sem o flag "Comprar"; saldo insuficiente não adiciona nem cobra;
// o valor não fica guardado. Clique real.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, clicarBotaoFicha, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const BASE = { classe: 'Guerreiro', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS };
const CARTEIRA = { pl: 0, po: 100, pe: 0, pp: 40, pc: 0 };

/** Fecha todos os modais abertos e espera o overlay sumir. */
async function fecharTudo(page) {
  await page.evaluate(() => window.fecharModalTodos());
  await expect(page.locator('#modal-overlay')).toBeHidden();
}

/** Abre o modal do item mágico encontrado pela busca, com o flag Comprar no estado pedido. */
async function abrirItem(page, busca, linha, { comprar }) {
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#toggle-comprar-item').setChecked(comprar);
  await page.locator('#sel-inv-cat').selectOption('magicos');
  await page.locator('#busca-inv-cat').fill(busca);
  await page.locator('[data-item-magico]', { hasText: linha }).first().click();
}

/** Preenche o campo de preço e escolhe a moeda no modal do item mágico. */
async function informarPreco(page, qtd, moeda = 'po') {
  await page.fill('#preco-item-magico-qtd', String(qtd));
  await page.selectOption('#preco-item-magico-moeda', moeda);
}

test('o rodapé do modal tem o campo de preço à esquerda dos botões, vazio e com PO como moeda padrão', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...BASE, moedas: CARTEIRA }, 'regras-preco-magico-a');
  await abrirItem(page, 'Anel de Proteção', 'Anel de Proteção', { comprar: false });
  const bloco = await page.locator('#bloco-preco-item-magico').boundingBox();
  const voltar = await page.locator('.modal-acoes button', { hasText: 'Voltar' }).boundingBox();
  expect(bloco.x).toBeLessThan(voltar.x);
  await expect(page.locator('#preco-item-magico-qtd')).toHaveValue('');
  await expect(page.locator('#preco-item-magico-moeda')).toHaveValue('po');
});

test('com preço e Comprar DESMARCADO: cobra e adiciona', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...BASE, moedas: CARTEIRA }, 'regras-preco-magico-b');
  await abrirItem(page, 'Anel de Proteção', 'Anel de Proteção', { comprar: false });
  await informarPreco(page, 30);
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('por 30 PO');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  const salvo = await personagemSalvo(page);
  expect(salvo.moedas).toEqual({ pl: 0, po: 70, pe: 0, pp: 40, pc: 0 });
  expect(salvo.inventario.some(i => i.nome.includes('Anel de Proteção'))).toBe(true);
});

test('com preço e Comprar MARCADO: cobra uma vez só (não cobra em dobro)', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...BASE, moedas: CARTEIRA }, 'regras-preco-magico-c');
  await abrirItem(page, 'Anel de Proteção', 'Anel de Proteção', { comprar: true });
  await informarPreco(page, 30);
  await page.click('#btn-confirmar-item-magico');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).moedas.po).toBe(70);
});

test('sem preço, mesmo com Comprar marcado, nada é cobrado', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...BASE, moedas: CARTEIRA }, 'regras-preco-magico-d');
  await abrirItem(page, 'Anel de Proteção', 'Anel de Proteção', { comprar: true });
  await page.click('#btn-confirmar-item-magico');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).moedas).toEqual(CARTEIRA);
});

test('moeda escolhida: 1 PL desconta da platina', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...BASE, moedas: { pl: 2, po: 0, pe: 0, pp: 0, pc: 0 } }, 'regras-preco-magico-e');
  await abrirItem(page, 'Anel de Proteção', 'Anel de Proteção', { comprar: false });
  await informarPreco(page, 1, 'pl');
  await page.click('#btn-confirmar-item-magico');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).moedas.pl).toBe(1);
});

test('saldo insuficiente: toast de erro, nada cobrado e nada adicionado; o modal continua aberto', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...BASE, moedas: { pl: 0, po: 10, pe: 0, pp: 0, pc: 0 } }, 'regras-preco-magico-f');
  await abrirItem(page, 'Anel de Proteção', 'Anel de Proteção', { comprar: false });
  await informarPreco(page, 30);
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('Saldo insuficiente');
  await expect(page.locator('#btn-confirmar-item-magico')).toBeVisible();
  const salvo = await personagemSalvo(page);
  expect(salvo.moedas.po).toBe(10);
  expect(salvo.inventario || []).toHaveLength(0);
});

test('valor negativo ou decimal: erro e nada acontece', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...BASE, moedas: CARTEIRA }, 'regras-preco-magico-g');
  await abrirItem(page, 'Anel de Proteção', 'Anel de Proteção', { comprar: false });
  for (const invalido of ['-5', '1.5']) {
    await page.fill('#preco-item-magico-qtd', invalido);
    await page.click('#btn-confirmar-item-magico');
    await expect(page.locator('#toast-container')).toContainText('inteiro maior ou igual a zero');
    await expect(page.locator('#btn-confirmar-item-magico')).toBeVisible();
    const salvo = await personagemSalvo(page);
    expect(salvo.moedas, `valor ${invalido}`).toEqual(CARTEIRA);
    expect(salvo.inventario || [], `valor ${invalido}`).toHaveLength(0);
    await page.evaluate(() => { document.getElementById('toast-container').innerHTML = ''; });
  }
});

test('texto malformado digitado no campo (ex.: "1-") dá erro e nada é cobrado nem adicionado', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...BASE, moedas: CARTEIRA }, 'regras-preco-magico-m');
  await abrirItem(page, 'Anel de Proteção', 'Anel de Proteção', { comprar: false });
  await page.locator('#preco-item-magico-qtd').pressSequentially('1-');
  expect(await page.locator('#preco-item-magico-qtd').evaluate(el => el.validity.badInput)).toBe(true);
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('inteiro maior ou igual a zero');
  await expect(page.locator('#btn-confirmar-item-magico')).toBeVisible();
  const salvo = await personagemSalvo(page);
  expect(salvo.moedas).toEqual(CARTEIRA);
  expect(salvo.inventario || []).toHaveLength(0);
});

test('o valor não fica guardado: o item não ganha preço e o modal reabre com o campo vazio', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...BASE, moedas: CARTEIRA }, 'regras-preco-magico-h');
  await abrirItem(page, 'Anel de Proteção', 'Anel de Proteção', { comprar: false });
  /** Pares [chave, valor] de todo o localStorage da página. */
  const lerStorage = () => page.evaluate(() => Object.entries(localStorage).map(([k, v]) => [k, v]));
  const antes = (await lerStorage()).map(([k]) => k).sort();
  await informarPreco(page, 30);
  await page.click('#btn-confirmar-item-magico');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  const item = (await personagemSalvo(page)).inventario.find(i => i.nome.includes('Anel de Proteção'));
  expect(JSON.stringify(item)).not.toMatch(/preco|preço/i);
  // Nenhuma chave nova no localStorage e nenhum valor guardando o preço informado.
  const depois = await lerStorage();
  expect(depois.map(([k]) => k).sort()).toEqual(antes);
  expect(depois.filter(([k]) => /preco|preço/i.test(k))).toEqual([]);
  expect(depois.filter(([, v]) => /"preco"|"preço"|preco-item-magico/i.test(v))).toEqual([]);

  await abrirItem(page, 'Anel de Proteção', 'Anel de Proteção', { comprar: false });
  await expect(page.locator('#preco-item-magico-qtd')).toHaveValue('');
  await expect(page.locator('#preco-item-magico-moeda')).toHaveValue('po');
});

test('pergaminho: escolha incompleta não cobra; completa cobra e adiciona', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...BASE, moedas: CARTEIRA }, 'regras-preco-magico-i');
  await abrirItem(page, 'Pergaminho Mágico', 'Pergaminho Mágico', { comprar: false });
  await informarPreco(page, 50);
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('Escolha a variante');
  expect((await personagemSalvo(page)).moedas).toEqual(CARTEIRA);

  await page.locator('label', { hasText: 'Pergaminho Mágico (1º Círculo)' }).locator('input').check();
  await page.click('#btn-confirmar-item-magico');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  const salvo = await personagemSalvo(page);
  expect(salvo.moedas.po).toBe(50);
  expect(salvo.inventario[0].nome).toBe('Pergaminho Mágico (1º Círculo)');
});

test('em 360 px o campo de preço fica visível e o rodapé não gera rolagem horizontal', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...BASE, moedas: CARTEIRA }, 'regras-preco-magico-j');
  await page.setViewportSize({ width: 360, height: 800 });
  await abrirItem(page, 'Anel de Proteção', 'Anel de Proteção', { comprar: false });
  await expect(page.locator('#preco-item-magico-qtd')).toBeVisible();
  const estouro = await page.locator('.modal-acoes:has(#bloco-preco-item-magico)').evaluate(el => el.scrollWidth - el.clientWidth);
  expect(estouro).toBeLessThanOrEqual(1);
});

test('duplo clique rápido na linha do item não empilha dois modais nem cobra em dobro', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...BASE, moedas: CARTEIRA }, 'regras-preco-magico-k');
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption('magicos');
  await page.locator('#busca-inv-cat').fill('Pergaminho Mágico');
  // O pergaminho abre de forma assíncrona (aguarda o índice de magias): o duplo clique chega antes do modal.
  // Dois cliques despachados no mesmo instante (dblclick real fecha o modal recém-aberto no 2º clique).
  await page.locator('[data-item-magico]', { hasText: 'Pergaminho Mágico' }).first()
    .evaluate(el => { el.click(); el.click(); });
  await expect(page.locator('#btn-confirmar-item-magico').first()).toBeVisible();
  expect(await page.locator('#btn-confirmar-item-magico').count()).toBe(1);
  await informarPreco(page, 30);
  await page.locator('label', { hasText: 'Pergaminho Mágico (1º Círculo)' }).locator('input').check();
  await page.click('#btn-confirmar-item-magico');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  const salvo = await personagemSalvo(page);
  expect(salvo.moedas.po).toBe(70);
  expect(salvo.inventario.filter(i => i.nome.includes('Pergaminho Mágico'))).toHaveLength(1);
});
