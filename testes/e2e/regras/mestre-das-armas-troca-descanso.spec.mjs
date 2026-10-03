// ============================================================
// Issue #119 -- Mestre das Armas: "Trocar Arma do Talento" no Descanso
// Longo. Clerigo nao tem Maestria em Arma de classe; antes o passo de
// troca nem aparecia. Clique real em cada botao novo.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, clicarBotaoFicha, personagemSalvo, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const CLERIGO_5_MESTRE = {
  nome: 'Irmã Talita', especie: 'Humano', classe: 'Clérigo', subclasse: '',
  nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  talentos: ['Mestre das Armas'], maestrias_arma: ['Maça'], maestria_talento: 'Maça',
  classes: [{ classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 }],
  schema_versao: 2,
};

async function descansarLongo(context, personagem, id) {
  const { page } = await abrirFicha(context, personagem, id);
  await assentar(page).catch(() => {});
  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  return page;
}

/** Abre a troca do talento, escolhe a arma que entra e confirma. */
async function trocarPara(page, arma) {
  await page.locator('#btn-trocar-maestria-talento-dl').click();
  await assentar(page).catch(() => {});
  await page.locator('[data-troca-um]').click();
  await assentar(page).catch(() => {});
  await page.locator(`#troca-passo-entra .opcao-card[data-opcao="${arma}"]`).click();
  await assentar(page).catch(() => {});
  await page.locator('#btn-confirmar-troca-maestria-talento').click();
  await assentar(page).catch(() => {});
}

test('sem classe de maestria, o Descanso Longo oferece "Trocar Arma do Talento"', async ({ context }) => {
  const page = await descansarLongo(context, CLERIGO_5_MESTRE, 'regras-issue-119-a');
  await expect(page.locator('#btn-trocar-maestria-talento-dl')).toBeVisible();
  await expect(page.locator('#btn-trocar-maestrias-dl')).toHaveCount(0);
});

test('trocar a arma do talento grava a nova arma e a vaga do talento', async ({ context }) => {
  const page = await descansarLongo(context, CLERIGO_5_MESTRE, 'regras-issue-119-b');
  await trocarPara(page, 'Clava');
  const salvo = await personagemSalvo(page);
  expect(salvo.maestrias_arma).toEqual(['Clava']);
  expect(salvo.maestria_talento).toBe('Clava');
});

test('ficha antiga sem maestria_talento ainda troca (oferece as maestrias atuais)', async ({ context }) => {
  const { maestria_talento, ...antigo } = CLERIGO_5_MESTRE;
  const page = await descansarLongo(context, antigo, 'regras-issue-119-c');
  await trocarPara(page, 'Clava');
  const salvo = await personagemSalvo(page);
  expect(salvo.maestrias_arma).toEqual(['Clava']);
  expect(salvo.maestria_talento).toBe('Clava');
});

test('Guerreiro com o talento: trocar a arma do talento preserva as maestrias de classe', async ({ context }) => {
  const GUERREIRO_4 = {
    nome: 'Aldo', especie: 'Humano', classe: 'Guerreiro', subclasse: '',
    nivel: 4, xp: 2700, atributos: ATRIBUTOS_REGRAS,
    talentos: ['Mestre das Armas'],
    maestrias_arma: ['Espada Longa', 'Machado de Batalha', 'Arco Longo', 'Clava'],
    maestria_talento: 'Clava',
    classes: [{ classe: 'Guerreiro', subclasse: '', nivel: 4, ordem: 0 }],
    schema_versao: 2,
  };
  const page = await descansarLongo(context, GUERREIRO_4, 'regras-issue-119-d');
  await trocarPara(page, 'Maça');
  const salvo = await personagemSalvo(page);
  expect(salvo.maestrias_arma).toEqual(['Arco Longo', 'Espada Longa', 'Maça', 'Machado de Batalha']);
  expect(salvo.maestria_talento).toBe('Maça');
});

test('cancelar a troca do talento fecha o modal sem alterar as maestrias', async ({ context }) => {
  const page = await descansarLongo(context, CLERIGO_5_MESTRE, 'regras-issue-119-e');
  await page.locator('#btn-trocar-maestria-talento-dl').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-confirmar-troca-maestria-talento')).toBeVisible();
  await page.locator('#btn-cancelar-troca-maestria-talento').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#modal-titulo')).toBeHidden();
  const salvo = await personagemSalvo(page);
  expect(salvo.maestrias_arma).toEqual(['Maça']);
});
