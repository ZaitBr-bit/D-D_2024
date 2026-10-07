// ============================================================
// Loja: categoria "Componentes de Magia" com os componentes materiais que as magias
// exigem com custo em PO (dados/equipamento/componentes_materiais.json).
// ============================================================
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { abrirFicha, personagemSalvo, clicarBotaoFicha } from './helpers-regras.mjs';

const MATERIAIS = JSON.parse(readFileSync(new URL('../../../dados/equipamento/componentes_materiais.json', import.meta.url), 'utf-8')).itens;
const SEMENTE = { classe: 'Clérigo', nivel: 5, xp: 6500, moedas: { pl: 0, po: 400, pe: 0, pp: 0, pc: 0 } };

async function abrirLoja(context, id) {
  const { page, erros } = await abrirFicha(context, SEMENTE, id);
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  return { page, erros };
}

test('Componentes de Magia: lista todos os materiais com custo e as magias que os usam', async ({ context }) => {
  const { page, erros } = await abrirLoja(context, 'loja-componentes-lista');
  await page.locator('#sel-inv-cat').selectOption('componentes');
  const lista = page.locator('#lista-inv-cat');
  await expect(lista.locator('[data-add-cat]')).toHaveCount(MATERIAIS.length);
  const diamante = lista.locator('[data-add-cat]', { hasText: 'Diamante (300 PO)' });
  await expect(diamante).toContainText('Revivificar');
  await expect(diamante).toContainText('Consumido');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Componentes de Magia: comprar o Diamante de 300 PO desconta as moedas e o detalhe cita a magia', async ({ context }) => {
  const { page, erros } = await abrirLoja(context, 'loja-componentes-compra');
  const comprar = page.locator('#toggle-comprar-item');
  if (await comprar.count() && !(await comprar.isChecked())) await comprar.check();
  await page.locator('#sel-inv-cat').selectOption('componentes');
  await page.locator('#lista-inv-cat [data-add-cat]', { hasText: 'Diamante (300 PO)' }).click();
  await expect(page.locator('.sub-modal-overlay')).toContainText('Revivificar (3º círculo, consumido)');
  await page.locator('#btn-confirmar-add-item').click();
  const salvo = await personagemSalvo(page);
  expect(salvo.inventario.some((i) => i.nome === 'Diamante (300 PO)')).toBe(true);
  expect(salvo.moedas.po, '400 - 300 PO').toBe(100);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Todos: a busca acha o material com o rótulo da categoria', async ({ context }) => {
  const { page, erros } = await abrirLoja(context, 'loja-componentes-todos');
  await page.locator('#sel-inv-cat').selectOption('todos');
  await page.locator('#busca-inv-cat').fill('cranio dourado');
  const linha = page.locator('#lista-inv-cat [data-add-cat]', { hasText: 'Crânio dourado' });
  await expect(linha).toContainText('Componentes de Magia');
  await expect(linha).toContainText('Invocar Morto-Vivo');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
