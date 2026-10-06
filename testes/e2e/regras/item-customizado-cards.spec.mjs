// Propriedade e Maestria do item personalizado são cards com a descrição de cada opção.
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const P = { classe: 'Guerreiro', nivel: 3, xp: 900, atributos: { ...ATRIBUTOS_REGRAS }, inventario: [] };

/** Abre o formulário de item personalizado com a seção Categoria aberta. */
async function abrirFormulario(page, nome) {
  await clicarSeletorFicha(page, '#btn-add-inv-custom', { esperar: '#ic-nome' });
  await page.fill('#ic-nome', nome);
  await page.evaluate(() => document.querySelector('[data-ic-secao="categoria"]')?.setAttribute('open', ''));
}

test('cards de propriedade e maestria mostram a descrição e gravam a escolha', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-cards-custom-a');
  await assentar(page).catch(() => {});
  await abrirFormulario(page, 'Lança da Mesa');
  await page.selectOption('#ic-categoria', 'Armas Simples Corpo a Corpo');

  // Os cards só existem dentro do popup: nada inline antes do clique no botão.
  await expect(page.locator('#ic-prop-cards')).toHaveCount(0);
  await expect(page.locator('#ic-maestria-cards')).toHaveCount(0);
  await expect(page.locator('#ic-maestria-atual')).toHaveText('Nenhuma');

  await page.click('#ic-prop-add');
  await expect(page.locator('.sub-modal-overlay #ic-prop-cards [data-opcao]')).toHaveCount(11);
  await expect(page.locator('#ic-prop-cards [data-opcao="Versátil"]')).toContainText('duas mãos');
  await page.click('#ic-prop-cards [data-opcao="Versátil"]');
  await page.click('#ic-prop-confirmar');
  await expect(page.locator('#ic-props-lista [data-ic-prop]')).toHaveCount(1);
  // Confirmar fecha o popup; ao reabrir, os cards voltam sem marcação.
  await expect(page.locator('.sub-modal-overlay')).toHaveCount(0);
  await page.click('#ic-prop-add');
  await expect(page.locator('#ic-prop-cards [data-opcao].selecionada')).toHaveCount(0);
  await page.click('.sub-modal-overlay [data-fechar-sub]');
  await expect(page.locator('.sub-modal-overlay')).toHaveCount(0);

  await page.click('#ic-maestria-btn');
  await expect(page.locator('.sub-modal-overlay #ic-maestria-cards [data-opcao]')).toHaveCount(9);
  await expect(page.locator('#ic-maestria-cards [data-opcao="Derrubar"]')).toContainText(/\S+/);
  await page.click('#ic-maestria-cards [data-opcao="Trespassar"]');
  // Escolher fecha o popup, atualiza o botão e o campo oculto.
  await expect(page.locator('.sub-modal-overlay')).toHaveCount(0);
  await expect(page.locator('#ic-maestria-atual')).toHaveText('Trespassar');
  await expect(page.locator('#ic-maestria')).toHaveValue('Trespassar');
  await page.click('#btn-add-ic');
  await assentar(page).catch(() => {});
  const dados = (await personagemSalvo(page)).inventario[0].dados;
  expect(dados.propriedades).toBe('Versátil');
  expect(dados.maestria).toBe('Trespassar');
});

test('card marcado de novo desmarca: maestria volta a vazio; propriedade sem card dá erro', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-cards-custom-b');
  await assentar(page).catch(() => {});
  await abrirFormulario(page, 'Espada X');
  await page.selectOption('#ic-categoria', 'Armas Marciais Corpo a Corpo');
  await page.click('#ic-maestria-btn');
  await page.click('#ic-maestria-cards [data-opcao="Ágil"]');
  await expect(page.locator('#ic-maestria-atual')).toHaveText('Ágil');
  // Reabre com Ágil marcada; clicar de novo desmarca e volta para Nenhuma.
  await page.click('#ic-maestria-btn');
  await expect(page.locator('#ic-maestria-cards [data-opcao="Ágil"]')).toHaveClass(/selecionada/);
  await page.click('#ic-maestria-cards [data-opcao="Ágil"]');
  await expect(page.locator('#ic-maestria-atual')).toHaveText('Nenhuma');
  await expect(page.locator('#ic-maestria')).toHaveValue('');
  await page.click('#ic-prop-add');
  await page.click('#ic-prop-confirmar');
  await expect(page.locator('#ic-erros')).toContainText('Escolha uma propriedade');
  // O erro também aparece dentro do popup, que continua aberto.
  await expect(page.locator('.sub-modal-overlay #ic-prop-erro')).toContainText('Escolha uma propriedade');
  await page.click('.sub-modal-overlay [data-fechar-sub]');
  await page.click('#btn-add-ic');
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).inventario[0].dados.maestria).toBe('');
});

test('Armadura esconde propriedades e maestria', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-cards-custom-c');
  await assentar(page).catch(() => {});
  await abrirFormulario(page, 'Couraça X');
  await page.selectOption('#ic-categoria', 'Armadura');
  await expect(page.locator('#ic-props-maestria-campos')).toBeHidden();
  await expect(page.locator('#ic-prop-add')).toBeHidden();
  await expect(page.locator('#ic-maestria-btn')).toBeHidden();
});

test('item que não é arma mostra só o card Personalizada e esconde a maestria', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-cards-custom-d');
  await assentar(page).catch(() => {});
  await abrirFormulario(page, 'Poção X');
  await page.selectOption('#ic-categoria', 'Consumível');
  await page.click('#ic-prop-add');
  await expect(page.locator('#ic-prop-cards [data-opcao]')).toHaveCount(1);
  await expect(page.locator('#ic-prop-cards [data-opcao="__personalizada__"]')).toBeVisible();
  await page.click('.sub-modal-overlay [data-fechar-sub]');
  await expect(page.locator('#ic-maestria-col')).toBeHidden();
});

test('categoria de arma mostra 11 cards de propriedade e a maestria', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-cards-custom-e');
  await assentar(page).catch(() => {});
  await abrirFormulario(page, 'Arco X');
  await page.selectOption('#ic-categoria', 'Armas Marciais à Distância');
  await page.click('#ic-prop-add');
  await expect(page.locator('#ic-prop-cards [data-opcao]')).toHaveCount(11);
  await page.click('.sub-modal-overlay [data-fechar-sub]');
  await expect(page.locator('#ic-maestria-col')).toBeVisible();
});

test('maestria escolhida e depois a categoria trocada para Equipamento grava maestria vazia', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-cards-custom-f');
  await assentar(page).catch(() => {});
  await abrirFormulario(page, 'Adaga X');
  await page.selectOption('#ic-categoria', 'Armas Simples Corpo a Corpo');
  await page.click('#ic-maestria-btn');
  await page.click('#ic-maestria-cards [data-opcao="Afligir"]');
  await page.selectOption('#ic-categoria', 'Equipamento');
  await page.click('#btn-add-ic');
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).inventario[0].dados.maestria).toBe('');
});

test('trocar a categoria mantém o card marcado quando a opção continua válida e o descarta quando não existe', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-cards-custom-manter');
  await assentar(page).catch(() => {});
  await abrirFormulario(page, 'Item da Mesa');
  await page.selectOption('#ic-categoria', 'Armas Simples Corpo a Corpo');
  const fecharPopup = async () => {
    await page.click('.sub-modal-overlay [data-fechar-sub]');
    await expect(page.locator('.sub-modal-overlay')).toHaveCount(0);
  };
  await page.click('#ic-prop-add');
  await page.click('#ic-prop-cards [data-opcao="Personalizada…"], #ic-prop-cards [data-opcao="__personalizada__"]');
  await expect(page.locator('#ic-prop-cards [data-opcao="__personalizada__"]')).toHaveClass(/selecionada/);
  await fecharPopup();
  // "Personalizada" existe em toda categoria: continua marcada e mantém o painel de nome e descrição.
  await page.selectOption('#ic-categoria', 'Equipamento');
  await page.click('#ic-prop-add');
  await expect(page.locator('#ic-prop-cards [data-opcao="__personalizada__"]')).toHaveClass(/selecionada/);
  await expect(page.locator('#ic-prop-custom')).toBeVisible();
  await fecharPopup();
  // Propriedade do livro (só arma) some ao trocar para categoria que não é arma.
  await page.selectOption('#ic-categoria', 'Armas Simples Corpo a Corpo');
  await page.click('#ic-prop-add');
  await page.click('#ic-prop-cards [data-opcao="Versátil"]');
  await expect(page.locator('#ic-prop-cards [data-opcao="Versátil"]')).toHaveClass(/selecionada/);
  await fecharPopup();
  await page.selectOption('#ic-categoria', 'Armas Marciais Corpo a Corpo');
  await page.click('#ic-prop-add');
  await expect(page.locator('#ic-prop-cards [data-opcao="Versátil"]')).toHaveClass(/selecionada/);
  await fecharPopup();
  await page.selectOption('#ic-categoria', 'Consumível');
  await expect(page.locator('#ic-prop-select')).toHaveValue('');
  await page.click('#ic-prop-add');
  await expect(page.locator('#ic-prop-cards [data-opcao].selecionada')).toHaveCount(0);
  await fecharPopup();
});

test('fechar o popup pelo X ou fora dele não perde o estado do formulário de edição', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-cards-custom-estado');
  await assentar(page).catch(() => {});
  await abrirFormulario(page, 'Maça da Mesa');
  await page.selectOption('#ic-categoria', 'Armas Simples Corpo a Corpo');
  await page.click('#ic-maestria-btn');
  await page.click('.sub-modal-overlay .modal-fechar');
  await expect(page.locator('.sub-modal-overlay')).toHaveCount(0);
  // O modal do formulário continua aberto, com o que já foi digitado.
  await expect(page.locator('#ic-nome')).toHaveValue('Maça da Mesa');
  await expect(page.locator('#ic-categoria')).toHaveValue('Armas Simples Corpo a Corpo');
  // Clique no fundo (overlay) também fecha só o popup.
  await page.click('#ic-prop-add');
  await page.locator('.sub-modal-overlay').click({ position: { x: 3, y: 3 } });
  await expect(page.locator('.sub-modal-overlay')).toHaveCount(0);
  await expect(page.locator('#ic-nome')).toHaveValue('Maça da Mesa');
  await page.click('#btn-add-ic');
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).inventario[0].nome).toBe('Maça da Mesa');
});
