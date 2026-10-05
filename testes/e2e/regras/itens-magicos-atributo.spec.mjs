// ============================================================
// Prova por navegador do atributo definido por item: o Cinturão de Força
// do Gigante faz a Força valer 21 no card e na salvaguarda; o Amuleto da
// Saúde sobe o PV máximo e o devolve ao ser desequipado.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, clicarBotaoFicha, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

// Atributos semeados explícitos: Força 15 e Constituição 14.
const GUERREIRO = { classe: 'Guerreiro', nivel: 1, atributos: ATRIBUTOS_REGRAS };

/** Fecha o modal principal "Adicionar Item" (fica aberto depois de adicionar) para acessar a ficha. */
async function fecharModalPrincipal(page) {
  await page.locator('#modal-header .modal-fechar').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
}

/** Adiciona um item mágico pela categoria Itens Mágicos, escolhendo a variante quando dada. */
async function adicionarItemMagico(page, busca, linha, varianteId = null) {
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption('magicos');
  await expect(page.locator('#filtro-tipo-magico')).toBeVisible();
  await page.locator('#busca-inv-cat').fill(busca);
  await page.locator('[data-item-magico]', { hasText: linha }).first().click();
  if (varianteId) await page.locator(`input[name="variante-magica"][value="${varianteId}"]`).check();
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('adicionado');
  await assentar(page).catch(() => {});
  await fecharModalPrincipal(page);
}

/** Equipa e sintoniza a linha do inventário com o nome dado. */
async function equiparESintonizar(page, nome) {
  const linha = page.locator('.inv-item[data-idx]', { hasText: nome });
  await linha.locator('[data-sheet-equip]').check();
  await assentar(page).catch(() => {});
  await page.locator('.inv-item[data-idx]', { hasText: nome }).locator('[data-sintonizar]').check();
  await assentar(page).catch(() => {});
}

/** Bônus de salvaguarda de Força exibido no card, como número. */
async function salvaguardaForca(page) {
  const txt = await page.locator('.salva-item', { hasText: 'Força' }).locator('.pericia-bonus').innerText();
  return Number(txt.replace('−', '-'));
}

test('Cinturão das colinas: Força vale 21 no card, na salvaguarda, com a marca do valor-base', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-atributo-item-1');
  const salvAntes = await salvaguardaForca(page);
  await adicionarItemMagico(page, 'Cinturão de Força', 'Cinturão de Força do Gigante', 'cinturao-de-forca-do-gigante-das-colinas');
  await equiparESintonizar(page, 'Cinturão de Força do Gigante (das colinas)');
  await expect(page.locator('[data-atributo-item="forca"]')).toContainText('base 15');
  await expect(page.locator('[data-atributo-item="forca"]')).toHaveAttribute('title', /^Definido por Cinturão de Força do Gigante \(das colinas\); valor-base 15$/);
  await expect(page.locator('.atributo-box', { has: page.locator('[data-atributo-item="forca"]') }).locator('.atributo-valor')).toHaveText('21');
  expect(await salvaguardaForca(page), 'mod +5 contra +2 do base: +3').toBe(salvAntes + 3);
  const p = await personagemSalvo(page);
  expect(p.atributos.forca, 'o valor-base gravado não muda').toBe(15);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Cinturão equipado mas não sintonizado: sem marca e Força continua 15', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-atributo-item-3');
  await adicionarItemMagico(page, 'Cinturão de Força', 'Cinturão de Força do Gigante', 'cinturao-de-forca-do-gigante-das-colinas');
  await page.locator('.inv-item[data-idx]', { hasText: 'Cinturão de Força do Gigante (das colinas)' }).locator('[data-sheet-equip]').check();
  await assentar(page).catch(() => {});
  await expect(page.locator('[data-atributo-item]')).toHaveCount(0);
  await expect(page.locator('.atributo-box', { hasText: 'Força' }).locator('.atributo-valor')).toHaveText('15');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Amuleto da Saúde: PV máximo sobe ao sintonizar e volta ao desequipar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-atributo-item-2');
  const maxAntes = (await personagemSalvo(page)).pv_max;
  await adicionarItemMagico(page, 'Amuleto da Saúde', 'Amuleto da Saúde');
  await equiparESintonizar(page, 'Amuleto da Saúde');
  await expect.poll(async () => (await personagemSalvo(page)).pv_max, { message: 'Con 14 → 19: mod +2 → +4, nível 1' }).toBe(maxAntes + 2);
  await page.locator('.inv-item[data-idx]', { hasText: 'Amuleto da Saúde' }).locator('[data-sheet-equip]').uncheck();
  await assentar(page).catch(() => {});
  await expect.poll(async () => (await personagemSalvo(page)).pv_max, { message: 'desequipado, volta' }).toBe(maxAntes);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
