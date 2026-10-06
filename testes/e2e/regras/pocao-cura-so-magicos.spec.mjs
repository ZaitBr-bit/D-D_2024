// ============================================================
// Rodada 3, pedido 1 -- Poção de Cura só em Itens Mágicos na ficha.
// A listagem de Equipamento da ficha esconde todo registro que o acervo
// mágico reaproveita via `livro_jogador`; o criador continua listando tudo.
// Ficha antiga com a poção comum continua utilizável e soma com a nova.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, abrirSite, irAtePassoEquipamento, personagemSalvo, clicarBotaoFicha, assentar } from './helpers-regras.mjs';

const GUERREIRO = { classe: 'Guerreiro', nivel: 1 };
const POCAO_ANTIGA = { nome: 'Poção de Cura', tipo: 'equipamento', quantidade: 2, equipado: false, descricao: '', dados: { custo: '50 PO', peso: '0,5 kg' } };

/** Abre o Adicionar Item na categoria dada e preenche a busca. */
async function buscarNaCategoria(page, categoria, texto) {
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption(categoria);
  await page.locator('#busca-inv-cat').fill(texto);
}

test('ficha: Equipamento não lista Poção de Cura nem Pergaminho Mágico; Itens Mágicos lista a poção', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-r3-pocao-a');
  await buscarNaCategoria(page, 'equipamento', 'Poção');
  await expect(page.locator('#lista-inv-cat')).toContainText('Nenhum item encontrado');
  await page.locator('#busca-inv-cat').fill('Pergaminho Mágico');
  await expect(page.locator('#lista-inv-cat')).toContainText('Nenhum item encontrado');
  await page.locator('#sel-inv-cat').selectOption('magicos');
  await page.locator('#busca-inv-cat').fill('Poção de Cura');
  await expect(page.locator('[data-item-magico]', { hasText: 'Poções de Cura' }).first()).toBeVisible();
});

test('ficha: busca "Poção de Cura" em Todos não traz linha comum de Equipamento (só a do acervo)', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-r3-pocao-b');
  await buscarNaCategoria(page, 'todos', 'Poção de Cura');
  await expect(page.locator('[data-item-magico]', { hasText: 'Poções de Cura' }).first()).toBeVisible();
  await expect(page.locator('#lista-inv-cat .inv-item:not([data-item-magico])', { hasText: 'Poção de Cura' })).toHaveCount(0);
});

test('ficha: se o acervo mágico falha ao carregar, Equipamento continua listando tudo e o modal não quebra', async ({ context }) => {
  await context.route('**/itens_magicos.json*', rota => rota.abort());
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-r3-pocao-c');
  await buscarNaCategoria(page, 'equipamento', 'Poção');
  await expect(page.locator('#lista-inv-cat')).toContainText('Poção de Cura');
});

test('criador: Equipamento ainda lista Poção de Cura e Pergaminho Mágico', async ({ context }) => {
  const { page } = await abrirSite(context, '#criar');
  expect(await irAtePassoEquipamento(page, 'Guardião'), 'não chegou ao passo de equipamento').toBe(true);
  await clicarBotaoFicha(page, 'btn-add-item', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption('equipamento');
  await page.locator('#busca-inv-cat').fill('Poção de Cura');
  await expect(page.locator('#lista-inv-cat')).toContainText('Poção de Cura');
  await page.locator('#busca-inv-cat').fill('Pergaminho Mágico');
  await expect(page.locator('#lista-inv-cat')).toContainText('Pergaminho Mágico (Truque)');
});

test('ficha antiga com Poção de Cura: abre o detalhe e adicionar pelo Itens Mágicos soma na mesma linha', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { ...GUERREIRO, inventario: [POCAO_ANTIGA] }, 'regras-r3-pocao-d');
  await page.click('[data-info-inv-sheet="0"]');
  await expect(page.locator('#modal-overlay')).toContainText('Poção de Cura');
  await page.evaluate(() => window.fecharModalTodos());
  await expect(page.locator('#modal-overlay')).toBeHidden();

  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption('magicos');
  await page.locator('#busca-inv-cat').fill('Poção de Cura');
  await page.locator('[data-item-magico]', { hasText: 'Poções de Cura' }).first().click();
  await page.locator('input[name="variante-magica"][value="pocao-de-cura"]').check();
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('Poção de Cura adicionado');
  await assentar(page).catch(() => {});

  const pocoes = (await personagemSalvo(page)).inventario.filter(i => i.nome === 'Poção de Cura');
  expect(pocoes, 'uma linha só').toHaveLength(1);
  expect(pocoes[0].tipo).toBe('equipamento');
  expect(pocoes[0].quantidade).toBe(3);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
