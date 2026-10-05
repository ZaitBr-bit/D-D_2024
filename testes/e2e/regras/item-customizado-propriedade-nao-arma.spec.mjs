// ============================================================
// Issue #135 -- propriedade personalizada só aparecia no detalhe de item
// que é arma (categoria de arma). Item mágico/Outros com propriedade
// ficava sem a seção "Propriedades". Clique real no formulário e no
// botão de informações do item.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo, abrirSecoesItemCustom } from './helpers-regras.mjs';

const GUERREIRO = { classe: 'Guerreiro', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS };

/** Cria um item personalizado com a categoria dada e uma propriedade personalizada. */
async function criarItemComPropriedade(page, nome, categoria) {
  await clicarSeletorFicha(page, '#btn-add-inv-custom', { esperar: '#ic-nome' });
  await abrirSecoesItemCustom(page);
  await page.fill('#ic-nome', nome);
  if (categoria) await page.selectOption('#ic-categoria', categoria);
  await page.click('#ic-prop-add');
  await page.selectOption('#ic-prop-select', '__personalizada__');
  await page.fill('#ic-prop-nome', 'Ressonante');
  await page.fill('#ic-prop-desc', 'Vibra quando há magia por perto.');
  await page.click('#ic-prop-confirmar');
  await page.click('#btn-add-ic');
  await assentar(page).catch(() => {});
}

test('item sem categoria mostra a propriedade personalizada e a descrição no detalhe', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-135-a');
  await criarItemComPropriedade(page, 'Amuleto Vibrante', '');
  const item = (await personagemSalvo(page)).inventario.find(i => i.nome === 'Amuleto Vibrante');
  expect(item.dados.propriedades).toBe('Ressonante');

  await page.click('[data-info-inv-sheet="0"]');
  const modal = page.locator('#modal-corpo, .sub-modal-overlay').last();
  await expect(modal).toContainText('Ressonante');
  await page.locator('summary', { hasText: 'Ressonante' }).click();
  await expect(modal).toContainText('Vibra quando há magia por perto.');
});

test('item de categoria que não é arma (Item Mágico) também mostra a propriedade', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-135-b');
  await criarItemComPropriedade(page, 'Anel Vibrante', 'Item Mágico');
  const item = (await personagemSalvo(page)).inventario.find(i => i.nome === 'Anel Vibrante');
  expect(item.dados.tipo_item).toBe('Item Mágico');

  await page.click('[data-info-inv-sheet="0"]');
  const modal = page.locator('#modal-corpo, .sub-modal-overlay').last();
  await expect(modal).toContainText('Ressonante');
});
