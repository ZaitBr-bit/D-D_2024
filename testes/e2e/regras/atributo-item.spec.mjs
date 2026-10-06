// Atributo do modificador por arma e armadura: o seletor traz o padrão e o Atq muda ao escolher outro.
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

const PERSONAGEM = {
  classe: 'Guerreiro', nivel: 3, xp: 900,
  atributos: { ...ATRIBUTOS_REGRAS, forca: 16, destreza: 10, inteligencia: 18 },
  inventario: [
    { nome: 'Espada Longa', tipo: 'arma', quantidade: 1, equipado: true, descricao: '',
      dados: { categoria: 'Armas Marciais Corpo a Corpo', dano: '1d8 Cortante', propriedades: 'Versátil (1d10)', maestria: 'Drenar', peso: '1,5 kg', custo: '15 PO' } },
    { nome: 'Couro', tipo: 'armadura', quantidade: 1, equipado: false, descricao: '',
      dados: { categoria: 'Leve', ca: '11', peso: '5 kg', custo: '10 PO' } },
  ],
};

/** Abre o detalhe do item pelo nome na linha do inventário (clique na área com data-info-inv-sheet). */
async function abrirDetalhe(page, nome) {
  await page.locator('.inv-item', { hasText: nome }).first().locator('[data-info-inv-sheet]').first().click();
}

test('arma: o seletor traz o padrão (Força) e escolher Inteligência muda o Atq e grava dados.atributo', async ({ context }) => {
  const { page } = await abrirFicha(context, PERSONAGEM, 'regras-atributo-item-a');
  await assentar(page).catch(() => {});
  await expect(page.locator('.inv-item', { hasText: 'Espada Longa' }).first()).toContainText('Atq +5');
  await expect(page.locator('.inv-item', { hasText: 'Espada Longa' }).first().locator('[data-selo-atributo="forca"]')).toHaveText('FOR');
  await abrirDetalhe(page, 'Espada Longa');
  await page.waitForSelector('#sel-atributo-item', { timeout: 10_000 });
  await expect(page.locator('#sel-atributo-item option').first()).toContainText('Padrão (FOR)');
  await page.selectOption('#sel-atributo-item', 'inteligencia');
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).inventario[0].dados.atributo).toBe('inteligencia');
  await expect(page.locator('.inv-item', { hasText: 'Espada Longa' }).first()).toContainText('Atq +6');
  await expect(page.locator('.inv-item', { hasText: 'Espada Longa' }).first().locator('[data-selo-atributo="inteligencia"]')).toHaveText('INT');
  await abrirDetalhe(page, 'Espada Longa');
  await page.waitForSelector('#sel-atributo-item', { timeout: 10_000 });
  await page.selectOption('#sel-atributo-item', '');
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).inventario[0].dados.atributo).toBeUndefined();
});

test('armadura que soma modificador: o seletor existe e o padrão mostra Destreza; Média traz ", máx. 2"; Pesada e Escudo não têm seletor', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    ...PERSONAGEM,
    inventario: [...PERSONAGEM.inventario,
      { nome: 'Cota de Malha', tipo: 'armadura', quantidade: 1, equipado: false, descricao: '',
        dados: { categoria: 'Pesada', ca: '16', peso: '27 kg', custo: '75 PO' } },
      { nome: 'Peitoral', tipo: 'armadura', quantidade: 1, equipado: false, descricao: '',
        dados: { categoria: 'Média', ca: '14', peso: '20 kg', custo: '400 PO' } },
      { nome: 'Escudo', tipo: 'escudo', quantidade: 1, equipado: false, descricao: '',
        dados: { categoria: 'Escudo', ca: '+2', peso: '3 kg', custo: '10 PO' } }],
  }, 'regras-atributo-item-b');
  await assentar(page).catch(() => {});
  await abrirDetalhe(page, 'Couro');
  await page.waitForSelector('#sel-atributo-item', { timeout: 10_000 });
  await expect(page.locator('#sel-atributo-item option').first()).toContainText('Padrão (DES)');
  await page.evaluate(() => window.fecharModal());
  await abrirDetalhe(page, 'Peitoral');
  await page.waitForSelector('#sel-atributo-item', { timeout: 10_000 });
  await expect(page.locator('#sel-atributo-item option').first()).toContainText('Padrão (DES, máx. 2)');
  await page.evaluate(() => window.fecharModal());
  // Sem seletor: antes de afirmar a ausência, prova que o modal do item abriu.
  for (const nome of ['Cota de Malha', 'Escudo']) {
    await abrirDetalhe(page, nome);
    await expect(page.locator('#modal-overlay')).toBeVisible();
    await expect(page.locator('#modal-titulo')).toContainText(nome);
    await expect(page.locator('#modal-overlay')).toContainText('Categoria:');
    await expect(page.locator('#sel-atributo-item')).toHaveCount(0);
    await page.evaluate(() => window.fecharModal());
  }
});

test('armadura: o texto da CA no inventário e no detalhe acompanha o atributo escolhido', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    ...PERSONAGEM,
    inventario: [{ nome: 'Couro Batido', tipo: 'armadura', quantidade: 1, equipado: false, descricao: '',
      dados: { categoria: 'Leve', ca: '12 + modificador de Des', peso: '6,5 kg', custo: '45 PO' } }],
  }, 'regras-atributo-item-c');
  await assentar(page).catch(() => {});
  const linha = page.locator('.inv-item', { hasText: 'Couro Batido' }).first();
  await expect(linha).toContainText('12 + modificador de Des');
  await abrirDetalhe(page, 'Couro Batido');
  await page.waitForSelector('#sel-atributo-item', { timeout: 10_000 });
  await page.selectOption('#sel-atributo-item', 'inteligencia');
  await assentar(page).catch(() => {});
  await expect(linha).toContainText('12 + modificador de Int');
  await expect(linha).not.toContainText('modificador de Des');
  await abrirDetalhe(page, 'Couro Batido');
  await expect(page.locator('#modal-overlay')).toContainText('12 + modificador de Int');
});
