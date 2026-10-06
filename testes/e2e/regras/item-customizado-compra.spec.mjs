// ============================================================
// Rodada 3, pedido 2 (issue #125) -- pagar ao adicionar um item
// personalizado: bloco "Pagar" (valor + moeda) no rodapé do modal de criação.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, clicarBotaoFicha, assentar } from './helpers-regras.mjs';

const BASE = { classe: 'Guerreiro', nivel: 1 };
const RICO = { ...BASE, moedas: { pc: 0, pp: 0, pe: 0, po: 100, pl: 5 } };

/** Abre o modal "Item Customizado" (criação) e preenche o nome. */
async function abrirCriacao(page, nome = 'Adaga de Teste') {
  await clicarBotaoFicha(page, 'btn-add-inv-custom', { esperar: '#btn-add-ic' });
  await page.locator('#ic-nome').fill(nome);
}

/** Preenche o bloco de pagamento (valor e, opcionalmente, moeda). */
async function pagar(page, valor, moeda) {
  await page.locator('#pagar-item-custom-qtd').fill(valor);
  if (moeda) await page.locator('#pagar-item-custom-moeda').selectOption(moeda);
}

/** Moedas e inventário salvos do personagem. */
async function estado(page) {
  await assentar(page).catch(() => {});
  const p = await personagemSalvo(page);
  return { moedas: p.moedas, inventario: p.inventario || [] };
}

test('com valor e PO: cobra, adiciona e não guarda o valor pago', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, RICO, 'regras-r3-compra-a');
  await abrirCriacao(page);
  await pagar(page, '30');
  await page.click('#btn-add-ic');
  await expect(page.locator('#toast-container')).toContainText('Adaga de Teste adicionado por 30 PO!');
  const { moedas, inventario } = await estado(page);
  expect(moedas.po).toBe(70);
  expect(moedas.pl).toBe(5);
  expect(inventario).toHaveLength(1);
  expect(inventario[0].dados).not.toHaveProperty('preco');
  expect(Object.keys(inventario[0]).sort()).toEqual(['dados', 'descricao', 'equipado', 'nome', 'quantidade', 'tipo']);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('moeda diferente (PL) debita platina', async ({ context }) => {
  const { page } = await abrirFicha(context, RICO, 'regras-r3-compra-b');
  await abrirCriacao(page);
  await pagar(page, '2', 'pl');
  await page.click('#btn-add-ic');
  await expect(page.locator('#toast-container')).toContainText('por 2 PL');
  const { moedas, inventario } = await estado(page);
  expect(moedas.pl).toBe(3);
  expect(moedas.po).toBe(100);
  expect(inventario).toHaveLength(1);
});

test('sem valor ou com 0: adiciona sem cobrar', async ({ context }) => {
  const { page } = await abrirFicha(context, RICO, 'regras-r3-compra-c');
  await abrirCriacao(page);
  await page.click('#btn-add-ic');
  await expect(page.locator('#toast-container')).toContainText('Adaga de Teste adicionado!');
  let e = await estado(page);
  expect(e.moedas).toMatchObject({ po: 100, pl: 5 });
  await abrirCriacao(page, 'Outra');
  await pagar(page, '0');
  await page.click('#btn-add-ic');
  await expect(page.locator('#toast-container')).toContainText('Outra adicionado!');
  e = await estado(page);
  expect(e.moedas).toMatchObject({ po: 100, pl: 5 });
  expect(e.inventario).toHaveLength(2);
});

test('saldo insuficiente: avisa, não cobra e não adiciona', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...BASE, moedas: { pc: 0, pp: 0, pe: 0, po: 10, pl: 0 } }, 'regras-r3-compra-d');
  await abrirCriacao(page);
  await pagar(page, '50');
  await page.click('#btn-add-ic');
  await expect(page.locator('#toast-container')).toContainText('Saldo insuficiente para pagar 50 PO por Adaga de Teste!');
  const { moedas, inventario } = await estado(page);
  expect(moedas.po).toBe(10);
  expect(inventario).toHaveLength(0);
});

test('valor malformado ("1-"): erro, nada cobrado nem adicionado', async ({ context }) => {
  const { page } = await abrirFicha(context, RICO, 'regras-r3-compra-e');
  await abrirCriacao(page);
  await page.locator('#pagar-item-custom-qtd').pressSequentially('1-');
  await page.click('#btn-add-ic');
  await expect(page.locator('#toast-container')).toContainText('Informe um valor inteiro maior ou igual a zero.');
  const { moedas, inventario } = await estado(page);
  expect(moedas.po).toBe(100);
  expect(inventario).toHaveLength(0);
});

test('negativo e decimal: erro, nada cobrado nem adicionado', async ({ context }) => {
  const { page } = await abrirFicha(context, RICO, 'regras-r3-compra-f');
  await abrirCriacao(page);
  for (const valor of ['-5', '1.5']) {
    await pagar(page, valor);
    await page.click('#btn-add-ic');
    await expect(page.locator('#toast-container')).toContainText('Informe um valor inteiro maior ou igual a zero.');
  }
  const { moedas, inventario } = await estado(page);
  expect(moedas.po).toBe(100);
  expect(inventario).toHaveLength(0);
});

test('formulário inválido (sem nome): não cobra', async ({ context }) => {
  const { page } = await abrirFicha(context, RICO, 'regras-r3-compra-g');
  await abrirCriacao(page, '');
  await pagar(page, '30');
  await page.click('#btn-add-ic');
  // Verifica que o toast de sucesso não apareceu
  await expect(page.locator('#toast-container')).not.toContainText('adicionado');
  const { moedas, inventario } = await estado(page);
  expect(moedas.po).toBe(100);
  expect(inventario).toHaveLength(0);
});

test('o formulário não tem o campo "Preço" em texto livre e o item novo não grava a chave preco', async ({ context }) => {
  const { page } = await abrirFicha(context, RICO, 'regras-r3-compra-h');
  await abrirCriacao(page);
  await expect(page.locator('#ic-preco')).toHaveCount(0);
  await pagar(page, '40');
  await page.click('#btn-add-ic');
  await expect(page.locator('#toast-container')).toContainText('Adaga de Teste adicionado por 40 PO!');
  const { moedas, inventario } = await estado(page);
  expect(moedas.po).toBe(60);
  expect(inventario[0].dados).not.toHaveProperty('preco');
});

test('o modal de edição não tem o bloco de pagamento', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    ...RICO,
    inventario: [{ tipo: 'customizado', nome: 'Item X', quantidade: 1, equipado: false, descricao: '', dados: {} }],
  }, 'regras-r3-compra-i');
  await page.click('[data-info-inv-sheet="0"]');
  await page.locator('#modal-overlay button, .sub-modal-overlay button', { hasText: /Editar/ }).first().click();
  await expect(page.locator('#ic-nome').first()).toBeVisible();
  await expect(page.locator('#bloco-pagar-item-custom')).toHaveCount(0);
});

test('rodapé com o bloco visível e sem estouro horizontal em 360 px', async ({ context }) => {
  const { page } = await abrirFicha(context, RICO, 'regras-r3-compra-j');
  await page.setViewportSize({ width: 360, height: 740 });
  await abrirCriacao(page);
  await expect(page.locator('#bloco-pagar-item-custom')).toBeVisible();
  await expect(page.locator('#bloco-pagar-item-custom label')).toHaveText('Pagar');
  const sobra = await page.evaluate(() => {
    const raiz = document.documentElement;
    const rodape = document.querySelector('#modal-acoes');
    return { pagina: raiz.scrollWidth - raiz.clientWidth, rodape: rodape ? rodape.scrollWidth - rodape.clientWidth : 0 };
  });
  expect(sobra.pagina).toBeLessThanOrEqual(0);
  expect(sobra.rodape).toBeLessThanOrEqual(0);
  await expect(page.locator('#btn-add-ic')).toBeVisible();
  const caixa = await page.locator('#btn-add-ic').boundingBox();
  expect(caixa.x + caixa.width).toBeLessThanOrEqual(360);
});
