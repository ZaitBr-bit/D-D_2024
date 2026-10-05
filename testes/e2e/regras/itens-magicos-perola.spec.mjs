// ============================================================
// Prova por navegador da Pérola do Poder (Plano 9, Task 2): o uso diário
// valida os espaços de magia gastos e pergunta qual restaurar. Cobre: nenhum
// espaço gasto, escolha no modal, cancelar, devolver o uso, espaço acima do
// teto, espaço de Pacto do Bruxo e item sem sintonização.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, clicarBotaoFicha, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const NOME_USO = 'Recuperar espaço de magia';

/** Mago com os espaços de conjuração já gastos pedidos ({círculo: usados}). */
const mago = (nivel, gastos) => ({
  classe: 'Mago', nivel, atributos: ATRIBUTOS_REGRAS,
  espacos_magia: { conjuracao: gastos, pacto: {} },
});

/** Fecha todos os modais abertos (principal e sub-modais) pela API da própria página. */
async function fecharTudo(page) {
  await page.evaluate(() => window.fecharModalTodos());
  await expect(page.locator('#modal-overlay')).toBeHidden();
}

/** Adiciona a Pérola do Poder pela categoria Itens Mágicos e fecha os modais. */
async function adicionarPerola(page) {
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption('magicos');
  await page.locator('#busca-inv-cat').fill('Pérola do Poder');
  await page.locator('[data-item-magico]', { hasText: 'Pérola do Poder' }).first().click();
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('adicionado');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
}

/** Linha do inventário da Pérola. */
function linhaPerola(page) {
  return page.locator('.inv-item[data-idx]', { hasText: 'Pérola do Poder' });
}

/** Chip do uso diário da Pérola. */
function chipPerola(page) {
  return linhaPerola(page).locator('[data-uso-item]');
}

/** Abre a ficha, adiciona a Pérola e a equipa (e sintoniza, se pedido). */
async function prepararPerola(context, campos, id, { sintonizar = true } = {}) {
  const { page, erros } = await abrirFicha(context, campos, id);
  await adicionarPerola(page);
  await linhaPerola(page).locator('[data-sheet-equip]').check();
  await assentar(page).catch(() => {});
  if (sintonizar) {
    await linhaPerola(page).locator('[data-sintonizar]').check();
    await assentar(page).catch(() => {});
    expect((await perolaSalva(page)).sintonizado).toBe(true);
  }
  return { page, erros };
}

/** Pérola do personagem salvo. */
async function perolaSalva(page) {
  return (await personagemSalvo(page)).inventario.find((i) => i.nome.includes('Pérola do Poder'));
}

/** Usos gastos da Pérola no personagem salvo. */
async function usosGastos(page) {
  return (await perolaSalva(page)).estado_recursos?.usos?.[NOME_USO] || 0;
}

/** Espaços gastos de uma fonte e círculo, no personagem salvo. */
async function gastosDe(page, fonte, circulo) {
  return (await personagemSalvo(page)).espacos_magia?.[fonte]?.[circulo] || 0;
}

/** Clica no chip e espera a ficha assentar (o chip redesenha a ficha). */
async function clicarChip(page) {
  await chipPerola(page).click();
  await assentar(page).catch(() => {});
}

test('Pérola: sem espaço gasto mostra aviso e o uso continua disponível', async ({ context }) => {
  const { page, erros } = await prepararPerola(context, mago(5, {}), 'perola-1');
  await expect(chipPerola(page)).toContainText(`${NOME_USO} 1/1`);
  await clicarChip(page);
  await expect(page.locator('#toast-container .toast.error')).toContainText('Nenhum espaço de magia gasto de 3º círculo ou inferior');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  expect(await usosGastos(page)).toBe(0);
  await expect(chipPerola(page)).toContainText(`${NOME_USO} 1/1`);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Pérola: escolhe o espaço de 3º círculo, restaura só ele e gasta o uso', async ({ context }) => {
  const { page, erros } = await prepararPerola(context, mago(5, { 1: 1, 3: 1 }), 'perola-2');
  await clicarChip(page);
  await expect(page.locator('#modal-overlay')).toBeVisible();
  await expect(page.locator('#modal-titulo')).toContainText('Recuperar espaço de magia');
  const opcoes = page.locator('.btn-espaco-opcao');
  await expect(opcoes).toHaveCount(2);
  await expect(opcoes.nth(0)).toContainText('1º círculo (gasto 1 de 4)');
  await expect(opcoes.nth(1)).toContainText('3º círculo (gasto 1 de 2)');
  // Nada muda enquanto o jogador não escolhe.
  expect(await usosGastos(page)).toBe(0);
  await page.locator('.btn-espaco-opcao[data-espaco-circulo="3"]').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect(page.locator('#toast-container')).toContainText('Espaço de 3º círculo recuperado');
  await expect.poll(() => gastosDe(page, 'conjuracao', 3)).toBe(0);
  expect(await gastosDe(page, 'conjuracao', 1)).toBe(1);
  expect(await usosGastos(page)).toBe(1);
  await expect(chipPerola(page)).toContainText(`${NOME_USO} 0/1`);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Pérola: cancelar o modal não muda espaços nem uso', async ({ context }) => {
  const { page, erros } = await prepararPerola(context, mago(5, { 1: 1, 3: 1 }), 'perola-3');
  await clicarChip(page);
  await expect(page.locator('#modal-overlay')).toBeVisible();
  await expect(page.locator('.btn-espaco-opcao')).toHaveCount(2);
  await page.click('#btn-espaco-cancelar');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  expect(await usosGastos(page)).toBe(0);
  expect(await gastosDe(page, 'conjuracao', 1)).toBe(1);
  expect(await gastosDe(page, 'conjuracao', 3)).toBe(1);
  await expect(chipPerola(page)).toContainText(`${NOME_USO} 1/1`);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Pérola: clicar no uso já gasto só devolve o uso, sem modal nem espaço', async ({ context }) => {
  const { page, erros } = await prepararPerola(context, mago(5, { 1: 1, 3: 1 }), 'perola-4');
  await clicarChip(page);
  await page.locator('.btn-espaco-opcao[data-espaco-circulo="3"]').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(() => usosGastos(page)).toBe(1);
  // Segundo clique, com o uso gasto e o espaço de 1º ainda elegível: devolve o uso.
  await clicarChip(page);
  await expect(page.locator('#modal-overlay')).toBeHidden();
  expect(await usosGastos(page)).toBe(0);
  expect(await gastosDe(page, 'conjuracao', 1)).toBe(1);
  expect(await gastosDe(page, 'conjuracao', 3)).toBe(0);
  await expect(chipPerola(page)).toContainText(`${NOME_USO} 1/1`);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Pérola: só espaço de 4º círculo gasto fica acima do teto e mostra aviso', async ({ context }) => {
  const { page, erros } = await prepararPerola(context, mago(7, { 4: 1 }), 'perola-5');
  await clicarChip(page);
  await expect(page.locator('#toast-container')).toContainText('Nenhum espaço de magia gasto de 3º círculo ou inferior');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  expect(await usosGastos(page)).toBe(0);
  expect(await gastosDe(page, 'conjuracao', 4)).toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Pérola: espaço de Pacto do Bruxo aparece rotulado e pode ser restaurado', async ({ context }) => {
  const { page, erros } = await prepararPerola(context, {
    nome: 'Bruxo T', especie: 'Humano', classe: 'Bruxo', subclasse: 'Corruptor',
    nivel: 3, atributos: ATRIBUTOS_REGRAS,
    classes: [{ classe: 'Bruxo', subclasse: 'Corruptor', nivel: 3, ordem: 0 }],
    schema_versao: 2,
    espacos_magia: { conjuracao: {}, pacto: { 2: 1 } },
  }, 'perola-6');
  await clicarChip(page);
  await expect(page.locator('#modal-overlay')).toBeVisible();
  const opcoes = page.locator('.btn-espaco-opcao');
  await expect(opcoes).toHaveCount(1);
  await expect(opcoes.first()).toHaveText('2º círculo, Pacto (gasto 1 de 2)');
  await opcoes.first().click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(() => gastosDe(page, 'pacto', 2)).toBe(0);
  expect(await usosGastos(page)).toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Pérola: sem sintonização mostra aviso e nada muda', async ({ context }) => {
  const { page, erros } = await prepararPerola(context, mago(5, { 1: 1 }), 'perola-7', { sintonizar: false });
  expect((await perolaSalva(page)).sintonizado).not.toBe(true);
  await clicarChip(page);
  await expect(page.locator('#toast-container .toast.error')).toContainText('Equipe e sintonize Pérola do Poder para usar');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  expect(await usosGastos(page)).toBe(0);
  expect(await gastosDe(page, 'conjuracao', 1)).toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Pérola: clique duplo na opção restaura um só espaço, gasta um só uso e mostra um só toast', async ({ context }) => {
  const { page, erros } = await prepararPerola(context, mago(5, { 1: 2, 3: 1 }), 'perola-8');
  await clicarChip(page);
  await expect(page.locator('.btn-espaco-opcao')).toHaveCount(2);
  // Dois cliques no mesmo tick, antes de a ficha redesenhar.
  await page.evaluate(() => {
    const b = document.querySelector('.btn-espaco-opcao[data-espaco-circulo="1"]');
    b.click();
    b.click();
  });
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(() => usosGastos(page)).toBe(1);
  expect(await gastosDe(page, 'conjuracao', 1)).toBe(1);
  expect(await gastosDe(page, 'conjuracao', 3)).toBe(1);
  const toasts = page.locator('#toast-container .toast');
  await expect(toasts).toHaveCount(1);
  await expect(toasts.first()).toContainText('Espaço de 1º círculo recuperado');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Pérola: fechar o modal pelo X não muda nada e o chip continua funcionando', async ({ context }) => {
  const { page, erros } = await prepararPerola(context, mago(5, { 1: 1, 3: 1 }), 'perola-9');
  await clicarChip(page);
  await expect(page.locator('#modal-overlay')).toBeVisible();
  await expect(page.locator('.btn-espaco-opcao')).toHaveCount(2);
  await page.locator('#modal-header .modal-fechar').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  expect(await usosGastos(page)).toBe(0);
  expect(await gastosDe(page, 'conjuracao', 1)).toBe(1);
  expect(await gastosDe(page, 'conjuracao', 3)).toBe(1);
  // O chip abre o modal de novo e o fluxo completa.
  await clicarChip(page);
  await expect(page.locator('.btn-espaco-opcao')).toHaveCount(2);
  await page.locator('.btn-espaco-opcao[data-espaco-circulo="1"]').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(() => usosGastos(page)).toBe(1);
  expect(await gastosDe(page, 'conjuracao', 1)).toBe(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
