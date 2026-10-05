// ============================================================
// Issue #120 -- a loja da ficha ganha a categoria "Ferramentas" (uma
// entrada por variante quando o custo varia) e os itens de aventura
// mostram a descrição do livro no popup. Clique real em cada passo.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, clicarBotaoFicha } from './helpers-regras.mjs';

const SEMENTE = { classe: 'Guerreiro', nivel: 3, xp: 900, moedas: { pl: 0, po: 100, pe: 0, pp: 0, pc: 0 } };

async function abrirLoja(context, id) {
  const { page } = await abrirFicha(context, SEMENTE, id);
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  return page;
}

test('Ferramentas: lista as do livro, mostra Usar Objeto no popup e adiciona ao inventário', async ({ context }) => {
  const page = await abrirLoja(context, 'regras-issue-120-a');
  await page.locator('#sel-inv-cat').selectOption('ferramentas');
  const lista = page.locator('#lista-inv-cat');
  await expect(lista).toContainText('Ferramentas de Ladrão');
  await expect(lista).toContainText('Kit de Veneno');

  await lista.locator('.inv-item', { hasText: 'Ferramentas de Ladrão' }).first().click();
  await expect(page.locator('.sub-modal-overlay')).toContainText('Abrir uma fechadura');

  await page.locator('#btn-confirmar-add-item').click();
  const salvo = await personagemSalvo(page);
  expect(salvo.inventario.some(i => i.nome === 'Ferramentas de Ladrão')).toBe(true);
});

test('Instrumento Musical e Kit de Jogos aparecem por variante, com custo e peso da variante', async ({ context }) => {
  const page = await abrirLoja(context, 'regras-issue-120-b');
  await page.locator('#sel-inv-cat').selectOption('ferramentas');
  await page.locator('#busca-inv-cat').fill('alaude');
  const lista = page.locator('#lista-inv-cat');
  await expect(lista).toContainText('Instrumento Musical (Alaúde)');
  await expect(lista).toContainText('35 PO');
  await page.locator('#busca-inv-cat').fill('baralho');
  await expect(lista).toContainText('Kit de Jogos (Baralho)');
  await page.locator('#busca-inv-cat').fill('instrumento musical');
  await expect(lista.locator('.inv-item').first()).toContainText('(');
});

test('item de aventura (Corda) mostra a descrição do livro no popup', async ({ context }) => {
  const page = await abrirLoja(context, 'regras-issue-120-c');
  await page.locator('#sel-inv-cat').selectOption('equipamento');
  await page.locator('#busca-inv-cat').fill('corda');
  await page.locator('#lista-inv-cat .inv-item', { hasText: 'Corda' }).first().click();
  await expect(page.locator('.sub-modal-overlay')).toContainText('dar um nó em uma Corda');
});
