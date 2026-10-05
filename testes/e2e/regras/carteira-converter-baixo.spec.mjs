// ============================================================
// Issue #133 -- botão "↓" na Carteira: converte a pilha na moeda abaixo.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const BASE = { classe: 'Guerreiro', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS };

/** Abre o editor da carteira (botão de moedas) e espera os controles de adicionar. */
async function abrirCarteira(page) {
  await clicarSeletorFicha(page, '#btn-edit-po', { esperar: '[data-moeda-add="pl"]' });
}

test('↓ PO converte 3 PL em 30 PO e grava a carteira', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...BASE, moedas: { pl: 3, po: 5, pe: 0, pp: 0, pc: 0 } }, 'regras-issue-133-a');
  await abrirCarteira(page);
  await page.locator('[data-moeda-conv-baixo="pl"]').click();
  await assentar(page).catch(() => {});
  const salvo = await personagemSalvo(page);
  expect(salvo.moedas).toEqual({ pl: 0, po: 35, pe: 0, pp: 0, pc: 0 });
  await expect(page.locator('[data-moeda-conv-baixo="pl"]')).toBeHidden();
});

test('sem moeda na pilha o botão ↓ fica invisível; cobre nunca tem ↓', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...BASE, moedas: { pl: 0, po: 4, pe: 0, pp: 0, pc: 6 } }, 'regras-issue-133-b');
  await abrirCarteira(page);
  await expect(page.locator('[data-moeda-conv-baixo="pl"]')).toBeHidden();
  await expect(page.locator('[data-moeda-conv-baixo="po"]')).toBeVisible();
  await expect(page.locator('[data-moeda-conv-baixo="pc"]')).toBeHidden();
});

test('ida e volta: ↓ PO e depois ↑ PL devolve a platina', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...BASE, moedas: { pl: 2, po: 0, pe: 0, pp: 0, pc: 0 } }, 'regras-issue-133-c');
  await abrirCarteira(page);
  await page.locator('[data-moeda-conv-baixo="pl"]').click();
  await assentar(page).catch(() => {});
  await page.locator('[data-moeda-conv="po"]').click();
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).moedas).toEqual({ pl: 2, po: 0, pe: 0, pp: 0, pc: 0 });
});

for (const largura of [360, 320]) {
  test(`em ${largura} px a carteira cabe inteira: sem rolagem, nome sem corte e botões dentro do modal`, async ({ context }) => {
    const { page } = await abrirFicha(context, { ...BASE, moedas: { pl: 1, po: 16723, pe: 1, pp: 1, pc: 1 } }, `regras-issue-133-d-${largura}`);
    await page.setViewportSize({ width: largura, height: 800 });
    await abrirCarteira(page);
    const corpo = page.locator('#modal-corpo');
    const estouro = await corpo.evaluate(el => el.scrollWidth - el.clientWidth);
    expect(estouro, 'o corpo do modal da carteira transborda na horizontal').toBeLessThanOrEqual(1);
    // Nome da moeda inteiro, sem reticências: a primeira linha de cada moeda não pode ser cortada.
    const cortados = await corpo.locator('span[title*="("]').evaluateAll(els => els.filter(e => e.scrollWidth > e.clientWidth + 1).length);
    expect(cortados, 'nome de moeda cortado').toBe(0);
    // Campo e botões visíveis ficam dentro da largura do modal.
    const caixaCorpo = await corpo.boundingBox();
    for (const tipo of ['pl', 'po', 'pe', 'pp', 'pc']) {
      for (const seletor of [`#edit-moeda-${tipo}`, `[data-moeda-add="${tipo}"]`, `[data-moeda-sub="${tipo}"]`]) {
        const caixa = await page.locator(seletor).boundingBox();
        expect(caixa.x, seletor).toBeGreaterThanOrEqual(caixaCorpo.x - 1);
        expect(caixa.x + caixa.width, seletor).toBeLessThanOrEqual(caixaCorpo.x + caixaCorpo.width + 1);
      }
    }
    const baixoPo = await page.locator('[data-moeda-conv-baixo="po"]').boundingBox();
    expect(baixoPo.x + baixoPo.width).toBeLessThanOrEqual(caixaCorpo.x + caixaCorpo.width + 1);
    // Campos e botões +/- alinhados na mesma coluna em todas as moedas.
    const xs = [];
    for (const tipo of ['pl', 'po', 'pe', 'pp', 'pc']) xs.push(Math.round((await page.locator(`[data-moeda-add="${tipo}"]`).boundingBox()).x));
    expect(new Set(xs).size, `colunas do "+" desalinhadas: ${xs}`).toBe(1);
  });
}
