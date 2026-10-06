// Armadura personalizada: o formulário oferece atributo opcional na CA e a ficha recalcula.
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo, abrirSecoesItemCustom } from './helpers-regras.mjs';

const P = { classe: 'Guerreiro', nivel: 3, xp: 900, atributos: { ...ATRIBUTOS_REGRAS, destreza: 16 }, inventario: [] };

/** CA calculada pelo próprio app para o personagem salvo. */
async function caDoApp(page) {
  return page.evaluate(async () => {
    const store = await import(new URL('./js/store.js', location.href).href);
    const utils = await import(new URL('./js/utils.js', location.href).href);
    return utils.calcCA(store.listarPersonagens()[0]);
  });
}

/** Abre o formulário de item personalizado com as seções expandidas. */
async function abrirFormulario(page) {
  await clicarSeletorFicha(page, '#btn-add-inv-custom', { esperar: '#ic-nome' });
  await abrirSecoesItemCustom(page);
}

/** Cria a armadura personalizada Leve com CA Base 12 e o atributo informado ('' = nenhum), e a equipa. */
async function criarArmadura(page, atributo) {
  await abrirFormulario(page);
  await page.fill('#ic-nome', 'Couraça da Mesa');
  await page.selectOption('#ic-categoria', 'Armadura');
  await page.selectOption('#ic-tipo-armadura', 'Leve');
  await page.fill('#ic-ca-base', '12');
  if (atributo) await page.selectOption('#ic-atributo-ca', atributo);
  await page.click('#btn-add-ic');
  await assentar(page).catch(() => {});
  await page.locator('.inv-item', { hasText: 'Couraça da Mesa' }).first().locator('[data-sheet-equip]').check();
  await assentar(page).catch(() => {});
}

test('sem atributo a CA Base é fixa (piso)', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-arm-pers-a');
  await assentar(page).catch(() => {});
  await criarArmadura(page, '');
  expect((await personagemSalvo(page)).inventario[0].dados.atributo).toBe('');
  expect(await caDoApp(page)).toBe(13); // piso 12 não passa de 10 + DES(+3)
});

test('com Destreza a CA soma o modificador', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-arm-pers-b');
  await assentar(page).catch(() => {});
  await criarArmadura(page, 'destreza');
  expect((await personagemSalvo(page)).inventario[0].dados.atributo).toBe('destreza');
  expect(await caDoApp(page)).toBe(15);
});

test('escolher Escudo esconde os campos de atributo', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-arm-pers-c');
  await assentar(page).catch(() => {});
  await abrirFormulario(page);
  await page.selectOption('#ic-categoria', 'Armadura');
  await expect(page.locator('#ic-atributo-ca-campos')).toBeVisible();
  await page.selectOption('#ic-tipo-armadura', 'Escudo');
  await expect(page.locator('#ic-atributo-ca-campos')).toBeHidden();
  await page.selectOption('#ic-tipo-armadura', 'Leve');
  await expect(page.locator('#ic-atributo-ca-campos')).toBeVisible();
});

test('os campos de atributo na CA ficam na seção Atributos, junto da CA Base', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-arm-pers-secao');
  await assentar(page).catch(() => {});
  await abrirFormulario(page);
  const atributos = page.locator('details[data-ic-secao="atributos"]');
  await expect(atributos.locator('#ic-ca-base')).toHaveCount(1);
  await expect(atributos.locator('#ic-atributo-ca')).toHaveCount(1);
  await expect(atributos.locator('#ic-limite-atributo')).toHaveCount(1);
  await expect(page.locator('details[data-ic-secao="categoria"] #ic-atributo-ca')).toHaveCount(0);
  await expect(page.locator('details[data-ic-secao="categoria"] #ic-limite-atributo')).toHaveCount(0);
  // Como a CA Base, aparecem sem categoria escolhida; só Armadura grava o valor.
  await expect(page.locator('#ic-atributo-ca')).toBeVisible();
  await page.fill('#ic-nome', 'Colar');
  await page.selectOption('#ic-atributo-ca', 'destreza');
  await page.click('#btn-add-ic');
  await assentar(page).catch(() => {});
  expect('atributo' in (await personagemSalvo(page)).inventario[0].dados).toBe(false);
});
