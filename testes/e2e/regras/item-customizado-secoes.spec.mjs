// ============================================================
// Issue #101 -- o formulario do item personalizado vem em secoes
// recolhiveis (Categoria, Atributos, Raridade e sintonizacao); Nome,
// Descricao ficam fora (o preco em texto livre foi removido). Criacao nasce fechada; edicao abre a
// secao que tem dado. Clique real no summary.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const GUERREIRO = { classe: 'Guerreiro', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS };

test('criação: as três seções nascem recolhidas; clicar no summary abre e mostra os campos', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-101-a');
  await clicarSeletorFicha(page, '#btn-add-inv-custom', { esperar: '#ic-nome' });
  const secoes = page.locator('details.ic-secao');
  await expect(secoes).toHaveCount(3);
  for (let i = 0; i < 3; i++) expect(await secoes.nth(i).evaluate(el => el.open)).toBe(false);
  // Nome e Descrição ficam sempre à vista; o preço em texto livre não existe mais.
  await expect(page.locator('#ic-nome')).toBeVisible();
  await expect(page.locator('#ic-desc')).toBeVisible();
  await expect(page.locator('#ic-preco')).toHaveCount(0);
  await expect(page.locator('#ic-ca')).toBeHidden();

  await page.locator('details[data-ic-secao="atributos"] > summary').click();
  await expect(page.locator('#ic-ca')).toBeVisible();
  await expect(page.locator('#ic-peso')).toBeVisible();
  await expect(page.locator('#ic-categoria')).toBeHidden();
});

test('edição: abre só a seção que tem dado', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    ...GUERREIRO,
    inventario: [{ nome: 'Escudo Mágico', tipo: 'customizado', quantidade: 1, equipado: false, descricao: '',
      dados: { bonus_ca: '2', bonus_ataque: '0', peso: '' } }],
  }, 'regras-issue-101-b');
  await assentar(page).catch(() => {});
  await page.click('[data-info-inv-sheet="0"]');
  await page.click('#btn-editar-item-custom');
  await page.waitForSelector('#ic-nome', { state: 'visible' });
  expect(await page.locator('details[data-ic-secao="atributos"]').evaluate(el => el.open)).toBe(true);
  expect(await page.locator('details[data-ic-secao="categoria"]').evaluate(el => el.open)).toBe(false);
  expect(await page.locator('details[data-ic-secao="raridade"]').evaluate(el => el.open)).toBe(false);
  await expect(page.locator('#ic-ca')).toHaveValue('2');
});

test('salvar sem abrir seção grava os valores padrão; dano inválido abre a seção Atributos', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-101-c');
  await clicarSeletorFicha(page, '#btn-add-inv-custom', { esperar: '#ic-nome' });
  await page.fill('#ic-nome', 'Pedra Simples');
  await page.click('#btn-add-ic');
  await assentar(page).catch(() => {});
  const item = (await personagemSalvo(page)).inventario.find(i => i.nome === 'Pedra Simples');
  expect(item.dados.bonus_ca).toBe('0');

  await clicarSeletorFicha(page, '#btn-add-inv-custom', { esperar: '#ic-nome' });
  await page.fill('#ic-nome', 'Faca Torta');
  await page.locator('details[data-ic-secao="atributos"] > summary').click();
  await page.fill('#ic-dano', 'abc');
  await page.locator('details[data-ic-secao="atributos"] > summary').click(); // recolhe de volta
  expect(await page.locator('details[data-ic-secao="atributos"]').evaluate(el => el.open)).toBe(false);
  await page.click('#btn-add-ic');
  await expect(page.locator('#ic-erros')).toContainText('Dano deve seguir');
  expect(await page.locator('details[data-ic-secao="atributos"]').evaluate(el => el.open),
    'o erro abre a seção do campo com problema').toBe(true);
});
