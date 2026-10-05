// ============================================================
// Prova por navegador do atributo até o teto (4D): Pedra Ioun de
// Fortitude (aumento passivo e PV), aumento permanente por botão (Manual do
// Exercício Proveitoso e Livro da Escuridão Vil) e sintonização restrita
// (Chapéu de Mago para Guerreiro e para Mago).
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, clicarBotaoFicha, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

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

/** Linha do inventário do item com o trecho de nome dado. */
function linhaDe(page, trecho) {
  return page.locator('.inv-item[data-idx]', { hasText: trecho });
}

/** Item do personagem salvo cujo nome contém o trecho dado. */
async function itemSalvo(page, trecho) {
  return (await personagemSalvo(page)).inventario.find((i) => i.nome.includes(trecho));
}

/** Equipa a linha do inventário e espera a ficha assentar. */
async function equipar(page, trecho) {
  await linhaDe(page, trecho).locator('[data-sheet-equip]').check();
  await assentar(page).catch(() => {});
}

/** Abre o detalhe do item e espera o modal ficar visível (o detalhe é assíncrono). */
async function abrirDetalhe(page, trecho) {
  await linhaDe(page, trecho).locator('[data-info-inv-sheet]').first().click();
  await expect(page.locator('#modal-overlay')).toBeVisible();
}

/** Fecha todos os modais abertos pela API da própria página. */
async function fecharTudo(page) {
  await page.evaluate(() => window.fecharModalTodos());
  await expect(page.locator('#modal-overlay')).toBeHidden();
}

/** Equipa e sintoniza a linha do inventário (item sem requisito de classe), esperando a ficha assentar. */
async function equiparESintonizar(page, trecho) {
  await equipar(page, trecho);
  await linhaDe(page, trecho).locator('[data-sintonizar]').check();
  await assentar(page).catch(() => {});
}

/** Valor do atributo exibido no card da ficha, como número. */
async function atributoExibido(page, rotulo) {
  const txt = await page.locator('.atributo-box', { hasText: rotulo }).locator('.atributo-valor').innerText();
  return Number(txt);
}

/** PV máximo exibido no card de PV ("atual / máximo"). */
async function pvMaximoExibido(page) {
  const txt = await page.locator('.hp-pv-value').first().innerText();
  return Number(txt.split('/')[1]);
}

test('Pedra Ioun de Fortitude: Constituição 14 → 16 e PV máximo sobe; desequipar devolve', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Guerreiro', nivel: 5, atributos: ATRIBUTOS_REGRAS }, 'regras-teto-1');
  const conAntes = await atributoExibido(page, 'Constituição');
  const pvAntes = await pvMaximoExibido(page);
  expect(conAntes).toBe(14);
  await adicionarItemMagico(page, 'Pedra Ioun', 'Pedra Ioun', 'pedra-ioun-fortitude');
  await equipar(page, 'Pedra Ioun (fortitude)');
  await linhaDe(page, 'Pedra Ioun (fortitude)').locator('[data-sintonizar]').check();
  await assentar(page).catch(() => {});
  await expect.poll(() => atributoExibido(page, 'Constituição')).toBe(16);
  await expect.poll(() => pvMaximoExibido(page), { message: 'mod +2 → +3, 5 níveis: +5' }).toBe(pvAntes + 5);
  expect((await personagemSalvo(page)).atributos.constituicao, 'o valor-base não muda').toBe(14);

  await linhaDe(page, 'Pedra Ioun (fortitude)').locator('[data-sheet-equip]').uncheck();
  await assentar(page).catch(() => {});
  await expect.poll(() => atributoExibido(page, 'Constituição')).toBe(14);
  await expect.poll(() => pvMaximoExibido(page)).toBe(pvAntes);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Manual do Exercício Proveitoso: aplica Força +2 uma vez e depois mostra "Aumento aplicado."', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { ...GUERREIRO, atributos: { ...ATRIBUTOS_REGRAS, forca: 16 } }, 'regras-teto-2');
  await adicionarItemMagico(page, 'Manual do Exercício', 'Manual do Exercício Proveitoso');
  await abrirDetalhe(page, 'Manual do Exercício Proveitoso');
  await expect(page.locator('#bloco-aumento-permanente')).toContainText('Força +2, até 30');
  await page.locator('#btn-aplicar-aumento-permanente').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(async () => (await personagemSalvo(page)).atributos.forca).toBe(18);
  expect((await itemSalvo(page, 'Manual do Exercício Proveitoso')).aumento_aplicado).toBe(true);
  await expect.poll(() => atributoExibido(page, 'Força')).toBe(18);

  await abrirDetalhe(page, 'Manual do Exercício Proveitoso');
  await expect(page.locator('#btn-aplicar-aumento-permanente')).toHaveCount(0);
  await expect(page.locator('#modal-corpo')).toContainText('Aumento aplicado.');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Livro da Escuridão Vil: escolhe Carisma +2 e Força −2 e grava os dois', async ({ context }) => {
  const atributos = { ...ATRIBUTOS_REGRAS, carisma: 15, forca: 10 };
  const { page, erros } = await abrirFicha(context, { ...GUERREIRO, atributos }, 'regras-teto-3');
  await adicionarItemMagico(page, 'Livro da Escuridão', 'Livro da Escuridão Vil');
  // Exige sintonização: sem ela o botão fica desabilitado e a dica aparece.
  await abrirDetalhe(page, 'Livro da Escuridão Vil');
  await expect(page.locator('#dica-aumento-sintonia')).toContainText('Sintonize o item para estudar.');
  await expect(page.locator('#btn-aplicar-aumento-permanente')).toBeDisabled();
  await fecharTudo(page);
  await equiparESintonizar(page, 'Livro da Escuridão Vil');
  await abrirDetalhe(page, 'Livro da Escuridão Vil');
  await expect(page.locator('#dica-aumento-sintonia')).toHaveCount(0);
  await page.locator('#btn-aplicar-aumento-permanente').click();
  await expect(page.locator('#sel-aumento-atributo')).toBeVisible();
  await page.selectOption('#sel-aumento-atributo', 'carisma');
  // M1: o atributo escolhido para aumentar não pode ser o reduzido.
  await expect(page.locator('#sel-reducao-atributo option[value="carisma"]')).toBeDisabled();
  await page.selectOption('#sel-reducao-atributo', 'forca');
  await page.locator('#btn-confirmar-aumento-permanente').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(async () => (await personagemSalvo(page)).atributos.carisma).toBe(17);
  const salvo = await personagemSalvo(page);
  expect(salvo.atributos.forca).toBe(8);
  expect((await itemSalvo(page, 'Livro da Escuridão Vil')).aumento_aplicado).toBe(true);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Chapéu de Mago para Guerreiro: modal de requisito; Cancelar não grava e "mesmo assim" sintoniza', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-teto-4');
  await adicionarItemMagico(page, 'Chapéu de Mago', 'Chapéu de Mago');
  await equipar(page, 'Chapéu de Mago');
  await expect(linhaDe(page, 'Chapéu de Mago').locator('.inv-sintonia-requisito')).toContainText('por um Mago');

  await linhaDe(page, 'Chapéu de Mago').locator('[data-sintonizar]').click();
  await expect(page.locator('#modal-overlay')).toBeVisible();
  await expect(page.locator('#modal-corpo')).toContainText('requer sintonização por um Mago');
  await page.locator('#btn-sintonizar-cancelar').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect(linhaDe(page, 'Chapéu de Mago').locator('[data-sintonizar]')).not.toBeChecked();
  expect((await itemSalvo(page, 'Chapéu de Mago')).sintonizado).not.toBe(true);

  await linhaDe(page, 'Chapéu de Mago').locator('[data-sintonizar]').click();
  await expect(page.locator('#modal-overlay')).toBeVisible();
  await page.locator('#btn-sintonizar-mesmo-assim').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(async () => (await itemSalvo(page, 'Chapéu de Mago')).sintonizado).toBe(true);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Chapéu de Mago para Mago: sintoniza sem modal e sem aviso de requisito', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Mago', nivel: 1, atributos: ATRIBUTOS_REGRAS }, 'regras-teto-5');
  await adicionarItemMagico(page, 'Chapéu de Mago', 'Chapéu de Mago');
  await equipar(page, 'Chapéu de Mago');
  await expect(linhaDe(page, 'Chapéu de Mago').locator('.inv-sintonia-requisito')).toHaveCount(0);
  await linhaDe(page, 'Chapéu de Mago').locator('[data-sintonizar]').check();
  await assentar(page).catch(() => {});
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(async () => (await itemSalvo(page, 'Chapéu de Mago')).sintonizado).toBe(true);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

const GUERREIRO_5 = { classe: 'Guerreiro', nivel: 5, atributos: ATRIBUTOS_REGRAS };

test('Manual da Saúde Corporal: Constituição-base 14 → 16 sobe o PV máximo em 5', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO_5, 'regras-teto-6');
  const pvAntes = await pvMaximoExibido(page);
  await adicionarItemMagico(page, 'Manual da Saúde', 'Manual da Saúde Corporal');
  await abrirDetalhe(page, 'Manual da Saúde Corporal');
  await page.locator('#btn-aplicar-aumento-permanente').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(() => atributoExibido(page, 'Constituição')).toBe(16);
  await expect.poll(() => pvMaximoExibido(page), { message: 'mod +2 → +3, 5 níveis' }).toBe(pvAntes + 5);
  expect((await personagemSalvo(page)).pv_max).toBe(pvAntes + 5);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Manual da Saúde Corporal com Amuleto da Saúde sintonizado: PV não cai e o ganho aparece ao desequipar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO_5, 'regras-teto-7');
  const pvSem = await pvMaximoExibido(page);
  await adicionarItemMagico(page, 'Amuleto da Saúde', 'Amuleto da Saúde');
  await equiparESintonizar(page, 'Amuleto da Saúde');
  await expect.poll(() => atributoExibido(page, 'Constituição')).toBe(19);
  await expect.poll(() => pvMaximoExibido(page)).toBe(pvSem + 10);
  await adicionarItemMagico(page, 'Manual da Saúde', 'Manual da Saúde Corporal');
  await abrirDetalhe(page, 'Manual da Saúde Corporal');
  await page.locator('#btn-aplicar-aumento-permanente').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(async () => (await personagemSalvo(page)).atributos.constituicao).toBe(16);
  expect(await atributoExibido(page, 'Constituição'), 'o Amuleto continua definindo 19').toBe(19);
  expect(await pvMaximoExibido(page), 'sem ganho nem perda com o Amuleto ativo').toBe(pvSem + 10);
  await linhaDe(page, 'Amuleto da Saúde').locator('[data-sheet-equip]').uncheck();
  await assentar(page).catch(() => {});
  await expect.poll(() => atributoExibido(page, 'Constituição')).toBe(16);
  await expect.poll(() => pvMaximoExibido(page)).toBe(pvSem + 5);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

/** Aplica dano pelo botão "Dano" da ficha e espera o modal fechar. */
async function aplicarDano(page, valor) {
  await clicarBotaoFicha(page, 'hp-minus', { esperar: '#btn-aplicar-dano' });
  await page.locator('#input-dano-manual').fill(String(valor));
  await page.locator('#input-dano-manual').dispatchEvent('change');
  await expect(page.locator('#input-dano-val')).toHaveValue(String(valor));
  await page.locator('#btn-aplicar-dano').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await assentar(page).catch(() => {});
}

/** Guerreiro 5 com o Amuleto da Saúde sintonizado e 7 de dano: devolve o PV salvo (atual abaixo do máximo). */
async function guerreiro5ComAmuletoFerido(context, id) {
  const lado = await abrirFicha(context, GUERREIRO_5, id);
  await adicionarItemMagico(lado.page, 'Amuleto da Saúde', 'Amuleto da Saúde');
  await equiparESintonizar(lado.page, 'Amuleto da Saúde');
  await expect.poll(() => atributoExibido(lado.page, 'Constituição')).toBe(19);
  await aplicarDano(lado.page, 7);
  const salvo = await personagemSalvo(lado.page);
  // Equipar o Amuleto sobe só o máximo; o atual fica abaixo dele (e mais 7 de dano).
  expect(salvo.pv_atual).toBeLessThan(salvo.pv_max - 7);
  return { ...lado, pv: { atual: salvo.pv_atual, max: salvo.pv_max } };
}

test('Manual da Saúde com o Amuleto e PV não cheio: PV atual e máximo não mudam', async ({ context }) => {
  const { page, erros, pv } = await guerreiro5ComAmuletoFerido(context, 'regras-teto-pv-1');
  await adicionarItemMagico(page, 'Manual da Saúde', 'Manual da Saúde Corporal');
  await abrirDetalhe(page, 'Manual da Saúde Corporal');
  await page.locator('#btn-aplicar-aumento-permanente').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(async () => (await personagemSalvo(page)).atributos.constituicao).toBe(16);
  const depois = await personagemSalvo(page);
  expect(depois.pv_max, 'a Con em jogo continua 19').toBe(pv.max);
  expect(depois.pv_atual, 'o aumento da base não cura com o Amuleto').toBe(pv.atual);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('editar a Constituição-base 14 → 16 com o Amuleto: PV atual e máximo não mudam', async ({ context }) => {
  const { page, erros, pv } = await guerreiro5ComAmuletoFerido(context, 'regras-teto-pv-2');
  await clicarBotaoFicha(page, 'btn-editar-ficha', { esperar: '#btn-edicao-modo-manual' });
  await page.click('#btn-edicao-modo-manual');
  await assentar(page).catch(() => {});
  await page.fill('[data-edicao-manual-atributo="constituicao"]', '16');
  await page.locator('[data-edicao-manual-atributo="constituicao"]').dispatchEvent('change');
  await assentar(page).catch(() => {});
  await page.click('#btn-salvar-edicao-ficha');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(async () => (await personagemSalvo(page)).atributos.constituicao).toBe(16);
  const depois = await personagemSalvo(page);
  expect(depois.pv_max).toBe(pv.max);
  expect(depois.pv_atual, 'a edição manual da base não cura com o Amuleto').toBe(pv.atual);
  expect(await atributoExibido(page, 'Constituição'), 'o Amuleto continua definindo 19').toBe(19);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Amuleto com PV cheio: editar a Constituição-base para cima e clicar em Reverter mantém 54/54', async ({ context }) => {
  const { page, erros } = await guerreiro5ComAmuletoFerido(context, 'regras-teto-pv-3');
  await clicarBotaoFicha(page, 'hp-plus', { esperar: '#btn-aplicar-cura' });
  await page.locator('#input-cura-manual').fill('50');
  await page.locator('#input-cura-manual').dispatchEvent('change');
  await expect(page.locator('#input-cura-val')).toHaveValue('50');
  await page.locator('#btn-aplicar-cura').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await assentar(page).catch(() => {});
  const cheio = await personagemSalvo(page);
  expect(cheio.pv_atual).toBe(cheio.pv_max);

  await clicarBotaoFicha(page, 'btn-editar-ficha', { esperar: '#btn-edicao-modo-manual' });
  await page.click('#btn-edicao-modo-manual');
  await page.fill('[data-edicao-manual-atributo="constituicao"]', '16');
  await page.locator('[data-edicao-manual-atributo="constituicao"]').dispatchEvent('change');
  await page.click('#btn-salvar-edicao-ficha');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(async () => (await personagemSalvo(page)).atributos.constituicao).toBe(16);
  const editado = await personagemSalvo(page);
  expect([editado.pv_atual, editado.pv_max]).toEqual([cheio.pv_max, cheio.pv_max]);

  await clicarBotaoFicha(page, 'btn-editar-ficha', { esperar: '[data-reverter-atributos]' });
  await page.locator('[data-reverter-atributos]').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(async () => (await personagemSalvo(page)).atributos.constituicao).toBe(14);
  const revertido = await personagemSalvo(page);
  expect([revertido.pv_atual, revertido.pv_max], 'reverter com o Amuleto não tira PV').toEqual([cheio.pv_max, cheio.pv_max]);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Manual destruído não oferece o botão "Aplicar aumento"', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-teto-destruido');
  await adicionarItemMagico(page, 'Manual do Exercício', 'Manual do Exercício Proveitoso');
  await page.evaluate(async () => {
    const store = await import(new URL('./js/store.js', location.href).href);
    const p = store.listarPersonagens()[0];
    p.inventario.find((i) => i.nome === 'Manual do Exercício Proveitoso').destruido = true;
    store.salvarPersonagem(p);
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar(page).catch(() => {});
  await expect(page.locator('.inv-item-destruido')).toContainText('Destruído');
  await abrirDetalhe(page, 'Manual do Exercício Proveitoso');
  await expect(page.locator('#modal-corpo')).toContainText('Item Maravilhoso');
  await expect(page.locator('#bloco-aumento-permanente')).toHaveCount(0);
  await expect(page.locator('#btn-aplicar-aumento-permanente')).toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Pedra Ioun de Fortitude: a dica do atributo diz "Aumentado por", não "Definido por"', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO_5, 'regras-teto-dica');
  await adicionarItemMagico(page, 'Pedra Ioun', 'Pedra Ioun', 'pedra-ioun-fortitude');
  await equiparESintonizar(page, 'Pedra Ioun (fortitude)');
  await expect(page.locator('[data-atributo-item="constituicao"]')).toHaveAttribute('title', /^Aumentado por Pedra Ioun \(fortitude\); valor-base 14$/);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Manual com a Força já no teto: toast de erro, nada salvo e o botão continua', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { ...GUERREIRO, atributos: { ...ATRIBUTOS_REGRAS, forca: 30 } }, 'regras-teto-8');
  await adicionarItemMagico(page, 'Manual do Exercício', 'Manual do Exercício Proveitoso');
  await abrirDetalhe(page, 'Manual do Exercício Proveitoso');
  await page.locator('#btn-aplicar-aumento-permanente').click();
  await expect(page.locator('#toast-container')).toContainText('máximo');
  await expect(page.locator('#modal-overlay')).toBeVisible();
  await expect(page.locator('#btn-aplicar-aumento-permanente')).toBeEnabled();
  expect((await personagemSalvo(page)).atributos.forca).toBe(30);
  expect((await itemSalvo(page, 'Manual do Exercício Proveitoso')).aumento_aplicado).not.toBe(true);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Livro da Escuridão Vil com redução igual ao aumento: recusado sem salvar', async ({ context }) => {
  const atributos = { ...ATRIBUTOS_REGRAS, carisma: 15, forca: 10 };
  const { page, erros } = await abrirFicha(context, { ...GUERREIRO, atributos }, 'regras-teto-9');
  await adicionarItemMagico(page, 'Livro da Escuridão', 'Livro da Escuridão Vil');
  await equiparESintonizar(page, 'Livro da Escuridão Vil');
  await abrirDetalhe(page, 'Livro da Escuridão Vil');
  await page.locator('#btn-aplicar-aumento-permanente').click();
  await page.selectOption('#sel-aumento-atributo', 'carisma');
  // Força o valor igual pela página (a opção está desabilitada na tela): a regra também recusa.
  await expect(page.locator('#sel-reducao-atributo option[value="carisma"]')).toBeDisabled();
  await page.evaluate(() => { document.getElementById('sel-reducao-atributo').value = 'carisma'; });
  await page.locator('#btn-confirmar-aumento-permanente').click();
  await expect(page.locator('#toast-container')).toContainText('outro atributo');
  await expect(page.locator('#modal-overlay')).toBeVisible();
  const salvo = await personagemSalvo(page);
  expect(salvo.atributos.carisma).toBe(15);
  expect(salvo.atributos.forca).toBe(10);
  expect((await itemSalvo(page, 'Livro da Escuridão Vil')).aumento_aplicado).not.toBe(true);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('fechar o modal pelo X no meio da escolha não grava nada e o botão continua', async ({ context }) => {
  const atributos = { ...ATRIBUTOS_REGRAS, carisma: 15, forca: 10 };
  const { page, erros } = await abrirFicha(context, { ...GUERREIRO, atributos }, 'regras-teto-10');
  await adicionarItemMagico(page, 'Livro da Escuridão', 'Livro da Escuridão Vil');
  await equiparESintonizar(page, 'Livro da Escuridão Vil');
  await abrirDetalhe(page, 'Livro da Escuridão Vil');
  await page.locator('#btn-aplicar-aumento-permanente').click();
  await page.selectOption('#sel-aumento-atributo', 'carisma');
  await page.selectOption('#sel-reducao-atributo', 'forca');
  await page.locator('#modal-header .modal-fechar').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  const salvo = await personagemSalvo(page);
  expect(salvo.atributos.carisma).toBe(15);
  expect(salvo.atributos.forca).toBe(10);
  expect((await itemSalvo(page, 'Livro da Escuridão Vil')).aumento_aplicado).not.toBe(true);
  await abrirDetalhe(page, 'Livro da Escuridão Vil');
  await expect(page.locator('#btn-aplicar-aumento-permanente')).toBeEnabled();
  // Reabre e confirma: o aumento é aplicado uma única vez e o personagem salvo reflete.
  await page.locator('#btn-aplicar-aumento-permanente').click();
  await expect(page.locator('#sel-aumento-atributo')).toBeVisible();
  await page.selectOption('#sel-aumento-atributo', 'carisma');
  await page.selectOption('#sel-reducao-atributo', 'forca');
  await page.locator('#btn-confirmar-aumento-permanente').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect.poll(async () => (await personagemSalvo(page)).atributos.carisma).toBe(17);
  const aplicado = await personagemSalvo(page);
  expect(aplicado.atributos.forca).toBe(8);
  expect((await itemSalvo(page, 'Livro da Escuridão Vil')).aumento_aplicado).toBe(true);
  await abrirDetalhe(page, 'Livro da Escuridão Vil');
  await expect(page.locator('#btn-aplicar-aumento-permanente')).toHaveCount(0);
  await expect(page.locator('#modal-corpo')).toContainText('Aumento aplicado.');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('"Sintonizar mesmo assim" persiste depois de recarregar a página', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-teto-11');
  await adicionarItemMagico(page, 'Chapéu de Mago', 'Chapéu de Mago');
  await equipar(page, 'Chapéu de Mago');
  await linhaDe(page, 'Chapéu de Mago').locator('[data-sintonizar]').click();
  await expect(page.locator('#modal-overlay')).toBeVisible();
  await page.locator('#btn-sintonizar-mesmo-assim').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar(page).catch(() => {});
  await expect(linhaDe(page, 'Chapéu de Mago').locator('[data-sintonizar]')).toBeChecked();
  expect((await itemSalvo(page, 'Chapéu de Mago')).sintonizado).toBe(true);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
