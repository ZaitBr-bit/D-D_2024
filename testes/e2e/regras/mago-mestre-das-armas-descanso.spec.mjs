// ============================================================
// Issue #129 -- Mago com o talento Mestre das Armas perdia o botão
// "Trocar Magias" no modal do Descanso Longo e ficava só com "Trocar
// Arma do Talento" e "Trocar Truque". Clique real em cada botão.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, clicarBotaoFicha, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const MAGO_5_MESTRE = {
  nome: 'Aluno', especie: 'Humano', classe: 'Mago', subclasse: '',
  nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  talentos: ['Mestre das Armas'], maestrias_arma: ['Maça'], maestria_talento: 'Maça',
  grimorio: [{ nome: 'Mísseis Mágicos', circulo: 1 }, { nome: 'Escudo Arcano', circulo: 1 }, { nome: 'Bola de Fogo', circulo: 3 }],
  magias_preparadas: [
    { nome: 'Mísseis Mágicos', circulo: 1, classe: 'Mago' },
    { nome: 'Bola de Fogo', circulo: 3, classe: 'Mago' },
  ],
  magias_conhecidas: [{ nome: 'Raio de Fogo', circulo: 0, classe: 'Mago' }, { nome: 'Prestidigitação', circulo: 0, classe: 'Mago' },
    { nome: 'Luz', circulo: 0, classe: 'Mago' }, { nome: 'Mãos Mágicas', circulo: 0, classe: 'Mago' }],
  classes: [{ classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 }],
  schema_versao: 2,
};

test('Mago com Mestre das Armas vê os três botões de troca no Descanso Longo', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5_MESTRE, 'regras-issue-129-a');
  await assentar(page).catch(() => {});
  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-trocar-maestria-talento-dl')).toBeVisible();
  await expect(page.locator('#btn-trocar-magias-dl')).toBeVisible();
  await expect(page.locator('#btn-trocar-truque-dl')).toBeVisible();
});

test('Mago sem o talento (contraste) vê Trocar Magias e Trocar Truque', async ({ context }) => {
  const { talentos, maestrias_arma, maestria_talento, ...semTalento } = MAGO_5_MESTRE;
  const { page } = await abrirFicha(context, semTalento, 'regras-issue-129-b');
  await assentar(page).catch(() => {});
  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-trocar-magias-dl')).toBeVisible();
  await expect(page.locator('#btn-trocar-truque-dl')).toBeVisible();
});

test('Trocar Magias, clicado com o talento, abre a troca de magia do Mago', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5_MESTRE, 'regras-issue-129-c');
  await assentar(page).catch(() => {});
  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  await page.locator('#btn-trocar-magias-dl').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#modal-corpo, #modal-overlay').last()).toContainText('Mísseis Mágicos');
});
