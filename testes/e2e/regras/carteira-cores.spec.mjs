// ============================================================
// Rodada 3, pedido 3 -- cada denominação com a sua cor no cabeçalho do
// inventário e no saldo do modal da Carteira.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha } from './helpers-regras.mjs';

const CINCO_MOEDAS = { classe: 'Guerreiro', nivel: 1, moedas: { pl: 1672, po: 2, pe: 1, pp: 17, pc: 4 } };

test('cabeçalho do inventário: 5 spans com 5 cores computadas distintas; clique abre a Carteira', async ({ context }) => {
  const { page } = await abrirFicha(context, CINCO_MOEDAS, 'regras-r3-cores-a');
  const spans = page.locator('#btn-edit-po span');
  await expect(spans).toHaveCount(5);
  await expect(page.locator('#btn-edit-po')).toHaveText('1672 PL, 2 PO, 1 PE, 17 PP, 4 PC');
  const cores = await spans.evaluateAll(els => els.map(e => getComputedStyle(e).color));
  expect(new Set(cores).size).toBe(5);
  await expect(page.locator('#btn-edit-po')).toHaveAttribute('title', 'Editar Carteira');
  await page.locator('#btn-edit-po').click();
  await expect(page.locator('#modal-overlay')).toContainText('Saldo atual');
});

test('modal da Carteira: o saldo grande também usa uma cor por moeda', async ({ context }) => {
  const { page } = await abrirFicha(context, CINCO_MOEDAS, 'regras-r3-cores-b');
  await page.locator('#btn-edit-po').click();
  const spans = page.locator('#modal-corpo span[style*="color:#"]', { hasText: /^\d+ P[LOEPC]$/ });
  await expect(spans).toHaveCount(5);
  const cores = await spans.evaluateAll(els => els.map(e => getComputedStyle(e).color));
  expect(new Set(cores).size).toBe(5);
});

test('carteira vazia: cabeçalho mostra "0 PO"', async ({ context }) => {
  const { page } = await abrirFicha(context, { classe: 'Guerreiro', nivel: 1, moedas: { pl: 0, po: 0, pe: 0, pp: 0, pc: 0 } }, 'regras-r3-cores-c');
  await expect(page.locator('#btn-edit-po')).toHaveText('0 PO');
});
