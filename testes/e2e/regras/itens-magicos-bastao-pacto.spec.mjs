// ============================================================
// Prova por navegador do Bastão do Guardião do Pacto (Plano 10, Task 1): o
// uso "Recuperar espaço de magia" valida os espaços gastos e pergunta qual
// restaurar, SEM limite de círculo (inclusive o espaço de Pacto). Cobre:
// nenhum espaço gasto (toast de erro), escolha no modal, espaços de círculos
// diferentes, cancelar, devolver o uso e a regressão do teto da Pérola do Poder.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, clicarBotaoFicha, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const NOME_USO = 'Recuperar espaço de magia';
const VARIANTE_MAIS_1 = 'bastao-do-guardiao-do-pacto-mais-1';

/** Bruxo nível 5 (2 espaços de Pacto de 3º círculo) com os gastos de Pacto pedidos ({círculo: usados}). */
const bruxo = (pacto) => ({
  nome: 'Bruxo T', especie: 'Humano', classe: 'Bruxo', subclasse: 'Corruptor',
  nivel: 5, atributos: ATRIBUTOS_REGRAS,
  classes: [{ classe: 'Bruxo', subclasse: 'Corruptor', nivel: 5, ordem: 0 }],
  schema_versao: 2,
  espacos_magia: { conjuracao: {}, pacto },
});

/** Mago nível 7 (4/3/3/1 espaços de 1º a 4º) com os gastos de conjuração pedidos. */
const mago = (gastos) => ({
  classe: 'Mago', nivel: 7, atributos: ATRIBUTOS_REGRAS,
  espacos_magia: { conjuracao: gastos, pacto: {} },
});

/** Bruxo 5 / Mago 7 (Pacto de 3º círculo e conjuração até o 4º) com os gastos pedidos. */
const bruxoMago = (conjuracao, pacto) => ({
  nome: 'Bruxo Mago T', especie: 'Humano', classe: 'Bruxo', subclasse: 'Corruptor',
  nivel: 12, atributos: ATRIBUTOS_REGRAS,
  classes: [
    { classe: 'Bruxo', subclasse: 'Corruptor', nivel: 5, ordem: 0 },
    { classe: 'Mago', subclasse: 'Evocador', nivel: 7, ordem: 1 },
  ],
  schema_versao: 2,
  espacos_magia: { conjuracao, pacto },
});

/** Fecha todos os modais abertos (principal e sub-modais) pela API da própria página. */
async function fecharTudo(page) {
  await page.evaluate(() => window.fecharModalTodos());
  await expect(page.locator('#modal-overlay')).toBeHidden();
}

/** Adiciona um item mágico pela categoria Itens Mágicos (escolhendo a variante, se dada) e fecha os modais. */
async function adicionarItem(page, busca, varianteId = null) {
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption('magicos');
  await page.locator('#busca-inv-cat').fill(busca);
  await page.locator('[data-item-magico]', { hasText: busca }).first().click();
  if (varianteId) await page.locator(`input[name="variante-magica"][value="${varianteId}"]`).check();
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('adicionado');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
}

/** Linha do inventário do item cujo nome contém `nome`. */
function linhaDe(page, nome) {
  return page.locator('.inv-item[data-idx]', { hasText: nome });
}

/** Chip do uso diário do item. */
function chipDe(page, nome) {
  return linhaDe(page, nome).locator('[data-uso-item]');
}

/** Abre a ficha, adiciona o item e o equipa e sintoniza. */
async function prepararItem(context, campos, id, busca, varianteId = null) {
  const { page, erros } = await abrirFicha(context, campos, id);
  await adicionarItem(page, busca, varianteId);
  await linhaDe(page, busca).locator('[data-sheet-equip]').check();
  await assentar(page).catch(() => {});
  await linhaDe(page, busca).locator('[data-sintonizar]').check();
  await assentar(page).catch(() => {});
  expect((await itemSalvo(page, busca)).sintonizado).toBe(true);
  return { page, erros };
}

/** Item do personagem salvo cujo nome contém `nome`. */
async function itemSalvo(page, nome) {
  return (await personagemSalvo(page)).inventario.find((i) => i.nome.includes(nome));
}

/** Usos gastos do item no personagem salvo. */
async function usosGastos(page, nome) {
  return (await itemSalvo(page, nome)).estado_recursos?.usos?.[NOME_USO] || 0;
}

/** Espaços gastos de uma fonte e círculo, no personagem salvo. */
async function gastosDe(page, fonte, circulo) {
  return (await personagemSalvo(page)).espacos_magia?.[fonte]?.[circulo] || 0;
}

/** Clica no chip do item e espera a ficha assentar. */
async function clicarChip(page, nome) {
  await chipDe(page, nome).click();
  await assentar(page).catch(() => {});
}

const BASTAO = 'Guardião do Pacto';

test('Bastão: sem espaço gasto mostra toast de erro sem citar círculo e o uso continua disponível', async ({ context }) => {
  const { page, erros } = await prepararItem(context, bruxo({}), 'bastao-1', BASTAO, VARIANTE_MAIS_1);
  await expect(chipDe(page, BASTAO)).toContainText(`${NOME_USO} 1/1`);
  await clicarChip(page, BASTAO);
  const toast = page.locator('#toast-container .toast.error');
  await expect(toast).toHaveText('Nenhum espaço de magia gasto');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  expect(await usosGastos(page, BASTAO)).toBe(0);
  await expect(chipDe(page, BASTAO)).toContainText(`${NOME_USO} 1/1`);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Bastão: espaço de Pacto de 3º círculo gasto aparece com rótulo único e é restaurado', async ({ context }) => {
  const { page, erros } = await prepararItem(context, bruxo({ 3: 1 }), 'bastao-2', BASTAO, VARIANTE_MAIS_1);
  await clicarChip(page, BASTAO);
  await expect(page.locator('#modal-overlay')).toBeVisible();
  await expect(page.locator('#modal-titulo')).toContainText('Recuperar espaço de magia');
  const opcoes = page.locator('.btn-espaco-opcao');
  await expect(opcoes).toHaveCount(1);
  await expect(opcoes.first()).toHaveText('3º círculo, Pacto (gasto 1 de 2)');
  // Nada muda enquanto o jogador não escolhe.
  expect(await usosGastos(page, BASTAO)).toBe(0);
  await opcoes.first().click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect(page.locator('#toast-container')).toContainText('Espaço de 3º círculo recuperado');
  await expect.poll(() => gastosDe(page, 'pacto', 3)).toBe(0);
  expect(await usosGastos(page, BASTAO)).toBe(1);
  await expect(chipDe(page, BASTAO)).toContainText(`${NOME_USO} 0/1`);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Bastão: espaços de círculos diferentes (conjuração e Pacto) aparecem sem limite; cancelar não muda nada', async ({ context }) => {
  const { page, erros } = await prepararItem(context, bruxoMago({ 1: 1, 4: 1 }, { 3: 1 }), 'bastao-3', BASTAO, VARIANTE_MAIS_1);
  await clicarChip(page, BASTAO);
  await expect(page.locator('#modal-overlay')).toBeVisible();
  const opcoes = page.locator('.btn-espaco-opcao');
  await expect(opcoes).toHaveCount(3);
  await expect(opcoes.nth(0)).toHaveText('1º círculo (gasto 1 de 4)');
  await expect(opcoes.nth(1)).toHaveText('3º círculo, Pacto (gasto 1 de 2)');
  await expect(opcoes.nth(2)).toHaveText('4º círculo (gasto 1 de 1)');
  await page.click('#btn-espaco-cancelar');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  expect(await usosGastos(page, BASTAO)).toBe(0);
  expect(await gastosDe(page, 'conjuracao', 1)).toBe(1);
  expect(await gastosDe(page, 'conjuracao', 4)).toBe(1);
  expect(await gastosDe(page, 'pacto', 3)).toBe(1);
  // De novo: escolhe o de 4º círculo (acima do teto da Pérola) e só ele volta.
  await clicarChip(page, BASTAO);
  await expect(page.locator('.btn-espaco-opcao')).toHaveCount(3);
  await page.locator('.btn-espaco-opcao[data-espaco-fonte="conjuracao"][data-espaco-circulo="4"]').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(() => gastosDe(page, 'conjuracao', 4)).toBe(0);
  expect(await gastosDe(page, 'conjuracao', 1)).toBe(1);
  expect(await gastosDe(page, 'pacto', 3)).toBe(1);
  expect(await usosGastos(page, BASTAO)).toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Bastão: clicar no uso já gasto só devolve o uso, sem modal nem espaço', async ({ context }) => {
  const { page, erros } = await prepararItem(context, bruxoMago({ 1: 1, 4: 1 }, {}), 'bastao-4', BASTAO, VARIANTE_MAIS_1);
  await clicarChip(page, BASTAO);
  await page.locator('.btn-espaco-opcao[data-espaco-circulo="4"]').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(() => usosGastos(page, BASTAO)).toBe(1);
  await clicarChip(page, BASTAO);
  await expect(page.locator('#modal-overlay')).toBeHidden();
  expect(await usosGastos(page, BASTAO)).toBe(0);
  expect(await gastosDe(page, 'conjuracao', 1)).toBe(1);
  expect(await gastosDe(page, 'conjuracao', 4)).toBe(0);
  await expect(chipDe(page, BASTAO)).toContainText(`${NOME_USO} 1/1`);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Bastão: espaço de 9º círculo gasto aparece (Bruxo 5 / Mago 17) e é restaurado, gastando o uso', async ({ context }) => {
  const campos = { ...bruxoMago({ 9: 1 }, {}), nivel: 22 };
  campos.classes = [
    { classe: 'Bruxo', subclasse: 'Corruptor', nivel: 5, ordem: 0 },
    { classe: 'Mago', subclasse: 'Evocador', nivel: 17, ordem: 1 },
  ];
  const { page, erros } = await prepararItem(context, campos, 'bastao-7', BASTAO, VARIANTE_MAIS_1);
  await clicarChip(page, BASTAO);
  await expect(page.locator('#modal-overlay')).toBeVisible();
  const opcoes = page.locator('.btn-espaco-opcao');
  await expect(opcoes).toHaveCount(1);
  await expect(opcoes.first()).toHaveText('9º círculo (gasto 1 de 1)');
  await opcoes.first().click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect(page.locator('#toast-container')).toContainText('Espaço de 9º círculo recuperado');
  await expect.poll(() => gastosDe(page, 'conjuracao', 9)).toBe(0);
  expect(await usosGastos(page, BASTAO)).toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Bastão: espaço de Pacto de 5º círculo (Bruxo 17) aparece e é restaurado, gastando o uso', async ({ context }) => {
  const campos = { ...bruxo({ 5: 1 }), nivel: 17 };
  campos.classes = [{ classe: 'Bruxo', subclasse: 'Corruptor', nivel: 17, ordem: 0 }];
  const { page, erros } = await prepararItem(context, campos, 'bastao-8', BASTAO, VARIANTE_MAIS_1);
  await clicarChip(page, BASTAO);
  await expect(page.locator('#modal-overlay')).toBeVisible();
  const opcoes = page.locator('.btn-espaco-opcao');
  await expect(opcoes).toHaveCount(1);
  await expect(opcoes.first()).toHaveText('5º círculo, Pacto (gasto 1 de 4)');
  await opcoes.first().click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(() => gastosDe(page, 'pacto', 5)).toBe(0);
  expect(await usosGastos(page, BASTAO)).toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Pérola: continua limitada ao 3º círculo (espaço de 4º não é listado) e o aviso é toast de erro', async ({ context }) => {
  const { page, erros } = await prepararItem(context, mago({ 4: 1 }), 'bastao-5', 'Pérola do Poder');
  await clicarChip(page, 'Pérola do Poder');
  await expect(page.locator('#toast-container .toast.error')).toHaveText('Nenhum espaço de magia gasto de 3º círculo ou inferior');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  expect(await usosGastos(page, 'Pérola do Poder')).toBe(0);
  expect(await gastosDe(page, 'conjuracao', 4)).toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Pérola: com espaços de 1º e 4º gastos lista só o de 1º círculo', async ({ context }) => {
  const { page, erros } = await prepararItem(context, mago({ 1: 1, 4: 1 }), 'bastao-6', 'Pérola do Poder');
  await clicarChip(page, 'Pérola do Poder');
  await expect(page.locator('#modal-overlay')).toBeVisible();
  const opcoes = page.locator('.btn-espaco-opcao');
  await expect(opcoes).toHaveCount(1);
  await expect(opcoes.first()).toHaveText('1º círculo (gasto 1 de 4)');
  await page.click('#btn-espaco-cancelar');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  expect(await gastosDe(page, 'conjuracao', 4)).toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
