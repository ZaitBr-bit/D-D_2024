// ============================================================
// Issue #134 -- armadura personalizada com tipo (selo de proficiência),
// requisito de Força, Furtividade e resumo no detalhe. Clique real.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo, abrirSecoesItemCustom } from './helpers-regras.mjs';

const GUERREIRO = { classe: 'Guerreiro', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS };
const MAGO = { classe: 'Mago', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS };

/** Abre o formulário de item personalizado com as seções avançadas expandidas. */
async function abrirFormulario(page) {
  await clicarSeletorFicha(page, '#btn-add-inv-custom', { esperar: '#ic-nome' });
  await abrirSecoesItemCustom(page);
}

/** Cria uma armadura personalizada completa (requisito, furtividade, CA, peso) com o tipo dado. */
async function criarArmadura(page, nome, tipo) {
  await abrirFormulario(page);
  await page.fill('#ic-nome', nome);
  await page.selectOption('#ic-categoria', 'Armadura');
  await expect(page.locator('#ic-armadura-campos')).toBeVisible();
  if (tipo) await page.selectOption('#ic-tipo-armadura', tipo);
  await page.fill('#ic-req-forca', '15');
  await page.check('#ic-desv-furtividade');
  await page.fill('#ic-ca-base', '18');
  await page.fill('#ic-peso', '32');
  await page.click('#btn-add-ic');
  await assentar(page).catch(() => {});
}

test('campos de armadura só aparecem com a categoria Armadura', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-134-a');
  await abrirFormulario(page);
  await expect(page.locator('#ic-armadura-campos')).toBeHidden();
  await page.selectOption('#ic-categoria', 'Armadura');
  await expect(page.locator('#ic-armadura-campos')).toBeVisible();
  await page.selectOption('#ic-categoria', 'Consumível');
  await expect(page.locator('#ic-armadura-campos')).toBeHidden();
});

test('armadura Pesada grava os campos, mostra selo de proficiência e o resumo no detalhe', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-134-b');
  await criarArmadura(page, 'Placas do Mestre', 'Pesada');
  const item = (await personagemSalvo(page)).inventario.find(i => i.nome === 'Placas do Mestre');
  expect(item.dados).toMatchObject({ tipo_item: 'Armadura', tipo_armadura: 'Pesada', requisito_forca: 'For 15', furtividade: 'Desvantagem' });
  expect(item.dados).not.toHaveProperty('preco');

  const linha = page.locator('.inv-item[data-idx]', { hasText: 'Placas do Mestre' });
  await expect(linha.locator('.badge-prof-sm')).toBeVisible();

  await page.click('[data-info-inv-sheet="0"]');
  const modal = page.locator('#modal-corpo').last();
  for (const trecho of ['Pesada', 'CA base', '18', 'For 15', 'Desvantagem', '32 kg']) {
    await expect(modal).toContainText(trecho);
  }
});

test('Mago sem proficiência em armadura pesada vê o selo "sem proficiência" (contraste)', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO, 'regras-issue-134-c');
  await criarArmadura(page, 'Placas do Mestre', 'Pesada');
  const linha = page.locator('.inv-item[data-idx]', { hasText: 'Placas do Mestre' });
  await expect(linha).toContainText('Sem Prof');
});

test('editar: trocar a categoria de Armadura para Consumível limpa tipo, requisito e furtividade', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-134-d');
  await criarArmadura(page, 'Placas do Mestre', 'Pesada');
  await page.click('[data-info-inv-sheet="0"]');
  await page.click('#btn-editar-item-custom');
  await abrirSecoesItemCustom(page);
  await page.selectOption('#ic-categoria', 'Consumível');
  await page.click('#btn-salvar-ic');
  await assentar(page).catch(() => {});
  const item = (await personagemSalvo(page)).inventario.find(i => i.nome === 'Placas do Mestre');
  expect(item.dados.tipo_armadura).toBe('');
  expect(item.dados.requisito_forca).toBe('');
  expect(item.dados.furtividade).toBe('');
});

test('editar item antigo com dados.preco: o preço gravado sobrevive e continua no detalhe', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...GUERREIRO,
    inventario: [{ tipo: 'customizado', nome: 'Capa Velha', quantidade: 1, equipado: false, descricao: 'Uma capa.', dados: { preco: '2 PO' } }],
  }, 'regras-preco-antigo-edicao');
  await page.click('[data-info-inv-sheet="0"]');
  await page.click('#btn-editar-item-custom');
  await expect(page.locator('#ic-preco')).toHaveCount(0);
  await page.fill('#ic-nome', 'Capa Nova');
  await page.click('#btn-salvar-ic');
  await assentar(page).catch(() => {});
  const item = (await personagemSalvo(page)).inventario.find(i => i.nome === 'Capa Nova');
  expect(item.dados.preco).toBe('2 PO');
  await page.click('[data-info-inv-sheet="0"]');
  await expect(page.locator('#modal-corpo').last()).toContainText('2 PO');
  expect(erros).toEqual([]);
});

test('item personalizado antigo (sem campos de armadura) abre o detalhe sem erro', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...GUERREIRO,
    inventario: [{ tipo: 'customizado', nome: 'Capa Velha', quantidade: 1, equipado: false, descricao: 'Uma capa.', dados: { tipo_item: 'Armadura', preco: '2 PO' } }],
  }, 'regras-issue-134-e');
  await page.click('[data-info-inv-sheet="0"]');
  await expect(page.locator('#modal-corpo').last()).toContainText('2 PO');
  expect(erros).toEqual([]);
  // Sem tipo de armadura gravado, a linha não mostra selo de proficiência.
  await page.evaluate(() => window.fecharModalTodos());
  await expect(page.locator('.inv-item[data-idx]', { hasText: 'Capa Velha' }).locator('.badge-prof-sm')).toHaveCount(0);
});
