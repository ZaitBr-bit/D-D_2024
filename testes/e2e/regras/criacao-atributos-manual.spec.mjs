// ============================================================
// O criador oferece o modo Manual de atributos (issue #13).
//
// O jogador que abriu a issue precisou remover o `disabled` do rádio pelo
// inspetor do navegador para ajustar atributos de uma mesa presencial, onde os
// dados são rolados fisicamente. `renderManual` (creator/passo-atributos.js)
// sempre existiu inteira -- o que faltava era o rádio aceitar clique.
//
// O teto de cada campo é 20 MENOS o bônus de antecedente daquele atributo: é o
// que mantém o invariante do livro (nenhum atributo passa de 20) sem herdar o
// piso 3, que só fazia sentido para 4d6 e barrava justamente os sistemas de
// geração externos que a issue cita.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirSite, assentar, confirmarModal, satisfazerPasso, personagemEmCriacao } from './helpers-regras.mjs';

/** Leva o criador até o passo de Atributos, escolhendo Guerreiro como classe. */
async function irAtePassoAtributos(page) {
  await assentar(page).catch(() => {});
  await page.click('[data-classe="Guerreiro"]');
  await confirmarModal(page, 'popup-confirmar-classe').catch(() => {});
  for (let i = 0; i < 10; i++) {
    if (await page.locator('[name="attr-mode"]').count()) return true;
    if (!await satisfazerPasso(page)) return false;
    await assentar(page).catch(() => {});
  }
  return (await page.locator('[name="attr-mode"]').count()) > 0;
}

test('criador: o modo Manual aceita clique e grava os valores digitados', async ({ context }) => {
  const { page, erros } = await abrirSite(context, '#criar');
  expect(await irAtePassoAtributos(page), 'o criador deveria chegar ao passo de Atributos').toBe(true);

  const manual = page.locator('[name="attr-mode"][value="manual"]');
  await expect(manual, 'o rádio Manual deveria existir na tela').toHaveCount(1);
  expect(await manual.isDisabled(), 'o rádio Manual não pode estar desabilitado (issue #13)').toBe(false);

  await manual.check();
  await assentar(page).catch(() => {});

  const campos = page.locator('[data-manual-key]');
  await expect(campos.first(), 'escolher Manual deveria montar os seis campos numéricos').toBeVisible();
  expect(await campos.count(), 'seis atributos, seis campos').toBe(6);

  const valores = { forca: 17, destreza: 15, constituicao: 14, inteligencia: 9, sabedoria: 12, carisma: 8 };
  for (const [chave, valor] of Object.entries(valores)) {
    await page.fill(`[data-manual-key="${chave}"]`, String(valor));
    await page.locator(`[data-manual-key="${chave}"]`).dispatchEvent('blur');
    await assentar(page).catch(() => {});
  }

  const emCriacao = await personagemEmCriacao(page);
  for (const [chave, valor] of Object.entries(valores)) {
    expect(emCriacao?.atributos_base?.[chave],
      `o valor digitado em ${chave} deveria ter chegado ao personagem em criação`).toBe(valor);
  }

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('criador: o campo Manual respeita o teto de 20 e o piso de 1', async ({ context }) => {
  const { page, erros } = await abrirSite(context, '#criar');
  expect(await irAtePassoAtributos(page), 'o criador deveria chegar ao passo de Atributos').toBe(true);

  await page.locator('[name="attr-mode"][value="manual"]').check();
  await assentar(page).catch(() => {});

  await page.fill('[data-manual-key="forca"]', '99');
  await page.locator('[data-manual-key="forca"]').dispatchEvent('blur');
  await assentar(page).catch(() => {});
  const emCriacao = await personagemEmCriacao(page);
  const bonusForca = emCriacao?.bonus_antecedente?.forca || 0;
  expect(emCriacao?.atributos_base?.forca,
    'o teto é 20 menos o bônus de antecedente daquele atributo').toBe(20 - bonusForca);

  await page.fill('[data-manual-key="carisma"]', '0');
  await page.locator('[data-manual-key="carisma"]').dispatchEvent('blur');
  await assentar(page).catch(() => {});
  const depois = await personagemEmCriacao(page);
  expect(depois?.atributos_base?.carisma, 'o piso é 1, não 3 (a issue cita sistemas externos)').toBe(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
