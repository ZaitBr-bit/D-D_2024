// ============================================================
// Issue #99 -- rótulos da ficha e do formulário de item personalizado com
// acento e Ç (antes: "Percepcao", "Condicoes", "Descricao", "Bonus CA"...).
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, clicarSeletorFicha, ATRIBUTOS_REGRAS, abrirSecoesItemCustom } from './helpers-regras.mjs';

const GUERREIRO_5 = {
  nome: 'Aldo', especie: 'Anão', classe: 'Guerreiro', subclasse: '',
  nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  classes: [{ classe: 'Guerreiro', subclasse: '', nivel: 5, ordem: 0 }],
  schema_versao: 2,
};

test('ficha: percepção, intuição, investigação e visão no escuro com acento', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO_5, 'regras-issue-99-a');
  await assentar(page).catch(() => {});
  const texto = await page.evaluate(() => document.body.innerText);
  for (const certo of ['Percepção', 'Intuição', 'Investigação']) {
    expect(texto, `${certo} precisa aparecer com acento`).toContain(certo);
  }
  for (const errado of ['Percepcao', 'Intuicao', 'Investigacao']) {
    expect(texto, `${errado} não pode aparecer`).not.toContain(errado);
  }
});

// O campo de valor do rodapé se chama "Pagar" desde a 3.1.3 (antes "Preço"); o rótulo fica no #modal-acoes.
test('formulário de item personalizado: Descrição e Bônus CA com acento e o campo Pagar no rodapé', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO_5, 'regras-issue-99-b');
  await assentar(page).catch(() => {});
  await clicarSeletorFicha(page, '#btn-add-inv-custom', { esperar: '#ic-desc' });
  await abrirSecoesItemCustom(page);
  const corpo = await page.locator('#modal-corpo').innerText();
  const norm = corpo.toLowerCase();
  expect(norm).toContain('descrição');
  expect(norm).toContain('bônus ca');
  await expect(page.locator('#modal-acoes label[for="pagar-item-custom-qtd"]')).toHaveText('Pagar');
  expect(norm).not.toContain('descricao');
  expect(norm).not.toContain('bonus ca');
});
