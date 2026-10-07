// ============================================================
// Busca no modal "Adicionar Item": palavras em qualquer ordem, "de/da/do"
// ignorados, nome em português primeiro e os achados só pelo nome em inglês
// atrás de uma divisória; variante que casou aparece com a própria raridade.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, clicarBotaoFicha } from './helpers-regras.mjs';

async function abrirBusca(context, id) {
  const { page, erros } = await abrirFicha(context, { classe: 'Guerreiro', nivel: 1 }, id);
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption('todos');
  return { page, erros };
}

/** Linha de item mágico pelo nome exato. */
const linha = (page, nome) => page.locator('[data-item-magico]').filter({ has: page.locator('.inv-item-nome', { hasText: new RegExp(`^${nome}`) }) });

test('Todos: palavras soltas e "da" no lugar de "de" acham o Manto de Proteção', async ({ context }) => {
  const { page, erros } = await abrirBusca(context, 'busca-itens-palavras');
  for (const texto of ['manto protecao', 'protecao manto', 'Manto da Proteção']) {
    await page.locator('#busca-inv-cat').fill(texto);
    await expect(linha(page, 'Manto de Proteção'), `"${texto}" deveria achar o Manto de Proteção`).toBeVisible();
    await expect(page.locator('#divisoria-busca-ingles')).toHaveCount(0);
  }
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Todos: nome em inglês aparece atrás da divisória, com o nome em inglês na linha', async ({ context }) => {
  const { page, erros } = await abrirBusca(context, 'busca-itens-ingles');
  await page.locator('#busca-inv-cat').fill('cloak of protection');
  await expect(page.locator('#divisoria-busca-ingles')).toContainText('inglês');
  const manto = linha(page, 'Manto de Proteção');
  await expect(manto).toContainText('Em inglês: Cloak of Protection');
  await expect(manto, 'o nome em português continua sendo o título').toBeVisible();
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Itens Mágicos: busca por variante mostra a variante e só a raridade dela', async ({ context }) => {
  const { page, erros } = await abrirBusca(context, 'busca-itens-variante');
  await page.locator('#sel-inv-cat').selectOption('magicos');
  await page.locator('#busca-inv-cat').fill('protecao');
  const pedra = linha(page, 'Pedra Ioun');
  await expect(pedra).toContainText('Variante: Pedra Ioun (proteção)');
  await expect(pedra).toContainText('Rara');
  await expect(pedra, 'só a raridade da variante que casou').not.toContainText('Lendária');
  const nomes = await page.locator('[data-item-magico] .inv-item-nome').allTextContents();
  const posAnel = nomes.findIndex((n) => n.startsWith('Anel de Proteção'));
  const posPedra = nomes.findIndex((n) => n.startsWith('Pedra Ioun'));
  expect(posAnel, 'o item cujo nome casa vem antes do que casou só por variante').toBeLessThan(posPedra);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
