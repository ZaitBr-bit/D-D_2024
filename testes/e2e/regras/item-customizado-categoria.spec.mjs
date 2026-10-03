// ============================================================
// Issue #100 -- categorias que nao sao arma no item personalizado
// (Armadura, Consumivel, Municao, Equipamento, Item Magico, Ferramenta),
// gravadas em `dados.tipo_item` sem tocar em `dados.categoria` (que decide
// proficiencia de arma). Clique real no formulario.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo, abrirSecoesItemCustom } from './helpers-regras.mjs';

const GUERREIRO = { classe: 'Guerreiro', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS };

async function criarItem(page, nome, categoria) {
  await clicarSeletorFicha(page, '#btn-add-inv-custom', { esperar: '#ic-nome' });
  await abrirSecoesItemCustom(page);
  await page.fill('#ic-nome', nome);
  await page.selectOption('#ic-categoria', categoria);
  await page.click('#btn-add-ic');
  await assentar(page).catch(() => {});
}

test('categoria "Ferramenta" grava tipo_item e nao vira categoria de arma', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-100-a');
  await criarItem(page, 'Kit de Pesca', 'Ferramenta');
  const item = (await personagemSalvo(page)).inventario.find(i => i.nome === 'Kit de Pesca');
  expect(item.dados.tipo_item).toBe('Ferramenta');
  expect(item.dados.categoria).toBe('');
  // Sem categoria de arma: nenhum badge de proficiência de arma na linha.
  await expect(page.locator('.inv-item', { hasText: 'Kit de Pesca' })).not.toContainText('Prof');
  await expect(page.locator('.inv-item', { hasText: 'Kit de Pesca' })).toContainText('Ferramenta');
});

test('categoria de arma continua em categoria e nao grava tipo_item', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-100-b');
  await criarItem(page, 'Espada Estranha', 'Armas Simples à Distância');
  const item = (await personagemSalvo(page)).inventario.find(i => i.nome === 'Espada Estranha');
  expect(item.dados.categoria).toBe('Armas Simples à Distância');
  expect(item.dados.tipo_item).toBe('');
});

test('o detalhe do item mostra a categoria nova e a edição a seleciona', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-100-c');
  await criarItem(page, 'Poção Estranha', 'Consumível');
  await page.click('[data-info-inv-sheet="0"]');
  await expect(page.locator('.sub-modal-overlay, #modal-corpo').last()).toContainText('Consumível');
  await page.click('#btn-editar-item-custom');
  await page.waitForSelector('#ic-categoria', { state: 'visible' });
  expect(await page.locator('#ic-categoria').inputValue()).toBe('Consumível');
});
