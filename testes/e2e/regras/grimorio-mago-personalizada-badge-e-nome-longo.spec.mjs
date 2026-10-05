// ============================================================
// Issue #131 -- magia personalizada do Mago não mostrava o selo
// "Personalizada" na grade de Preparar Magias (a lista do Mago vem de
// `char.grimorio`, que guarda só {nome, circulo}).
// Issue #130 -- nome de magia grande ficava cortado pelo check de
// seleção do cartão.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const NOME_LONGO = 'Cerimônia asdasddsasdasdc';

const MAGO_5 = {
  nome: 'Aluno', especie: 'Humano', classe: 'Mago', subclasse: '',
  nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  classes: [{ classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 }],
  grimorio: [{ nome: 'Mísseis Mágicos', circulo: 1 }, { nome: 'Chama Azul', circulo: 1 }, { nome: NOME_LONGO, circulo: 1 }],
  magias_customizadas: [
    { nome: 'Chama Azul', circulo: 1, escola: 'Evocação', tempo_conjuracao: 'Ação', alcance: '18 metros',
      componentes: 'V', duracao: 'Instantânea', sempre_preparada: false, fonte: 'Homebrew' },
    { nome: NOME_LONGO, circulo: 1, escola: 'Abjuração', tempo_conjuracao: 'Ação', alcance: '18 metros',
      componentes: 'V', duracao: 'Instantânea', sempre_preparada: false },
  ],
  schema_versao: 2,
};

async function abrirGrade1(context, id) {
  const { page } = await abrirFicha(context, MAGO_5, id);
  await assentar(page).catch(() => {});
  await page.locator('#btn-add-magia').click();
  await assentar(page).catch(() => {});
  await page.locator('[data-tab-mg="1"]').click();
  await assentar(page).catch(() => {});
  return page;
}

test('#131 Mago: a magia personalizada tem o selo e a fonte; a do livro não', async ({ context }) => {
  const page = await abrirGrade1(context, 'regras-issue-131-a');
  const personalizada = page.locator('.opcao-card:has-text("Chama Azul")');
  await expect(personalizada).toContainText('Personalizada');
  await expect(personalizada).toContainText('Homebrew');
  await expect(personalizada).toContainText('Evocação');
  await expect(page.locator('.opcao-card:has-text("Mísseis Mágicos")')).not.toContainText('Personalizada');
});

/** Confere que o texto do nome não passa por baixo do check nem sai do cartão. */
async function conferirNomeSemCorte(page) {
  const cartao = page.locator('.opcao-card', { hasText: NOME_LONGO });
  const nome = cartao.locator('.opcao-nome');
  const caixaCheck = await cartao.locator('.opcao-check').boundingBox();
  const caixaCartao = await cartao.boundingBox();
  // Borda direita do texto renderizado (as linhas do nome), não da caixa.
  const direitaTexto = await nome.evaluate(el => {
    const faixa = document.createRange();
    faixa.selectNodeContents(el);
    return Math.max(...[...faixa.getClientRects()].map(r => r.right));
  });
  const topoTexto = await nome.evaluate(el => el.getBoundingClientRect().top);
  const sobrepoeVerticalmente = topoTexto < caixaCheck.y + caixaCheck.height;
  if (sobrepoeVerticalmente) {
    expect(direitaTexto, 'o texto do nome não pode invadir a área do check').toBeLessThanOrEqual(caixaCheck.x + 1);
  }
  expect(direitaTexto, 'o texto do nome não pode sair do cartão').toBeLessThanOrEqual(caixaCartao.x + caixaCartao.width);
}

test('#130 nome longo não passa por baixo do check de seleção', async ({ context }) => {
  const page = await abrirGrade1(context, 'regras-issue-130-a');
  await conferirNomeSemCorte(page);
});

test('#130 nome longo em celular (360 px) também não é cortado', async ({ context }) => {
  const page = await abrirGrade1(context, 'regras-issue-130-b');
  await page.setViewportSize({ width: 360, height: 800 });
  await assentar(page).catch(() => {});
  await conferirNomeSemCorte(page);
});
