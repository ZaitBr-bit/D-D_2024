// ============================================================
// Issues #98/#111/#123 -- campos "Círculo superior", "Fonte" e "Classes
// com acesso" no formulário de magia personalizada. Clique real no
// formulário, na linha da ficha e na grade de Preparar Magias.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, personagemSalvo, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const MAGO_5 = {
  nome: 'Aluno', especie: 'Humano', classe: 'Mago', subclasse: '',
  nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  classes: [{ classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 }], schema_versao: 2,
};

const CLERIGO_5 = {
  nome: 'Devoto', especie: 'Humano', classe: 'Clérigo', subclasse: '',
  nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  classes: [{ classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 }],
  magias_customizadas: [{
    nome: 'Chama Azul', circulo: 1, escola: 'Evocação', tempo_conjuracao: 'Ação', alcance: '18 metros',
    componentes: 'V', duracao: 'Instantânea', sempre_preparada: false, fonte: 'Homebrew',
  }],
  schema_versao: 2,
};

const CLERIGO_3_DRUIDA_3 = {
  nome: 'Sábio', especie: 'Humano', classe: 'Clérigo', subclasse: '',
  nivel: 6, xp: 14000, atributos: ATRIBUTOS_REGRAS,
  classes: [
    { classe: 'Clérigo', subclasse: '', nivel: 3, ordem: 0 },
    { classe: 'Druida', subclasse: '', nivel: 3, ordem: 1 },
  ],
  magias_customizadas: [{
    nome: 'Chama Azul', circulo: 1, escola: 'Evocação', tempo_conjuracao: 'Ação', alcance: '18 metros',
    componentes: 'V', duracao: 'Instantânea', sempre_preparada: false, classes: ['Druida'],
  }],
  schema_versao: 2,
};

/** Preenche os campos obrigatórios do formulário de magia personalizada (círculo 1). */
async function preencherBasico(page, nome) {
  await page.locator('#mc-nome').fill(nome);
  await page.locator('#mc-circulo').selectOption('1');
  await page.locator('#mc-escola').selectOption('__personalizado__');
  await page.locator('#mc-escola-personalizada').fill('Evocação');
  await page.locator('#mc-tempo').selectOption('Ação');
  await page.locator('#mc-alcance').fill('18 metros');
  await page.locator('#mc-comp-v').check();
  await page.locator('#mc-duracao').selectOption('__personalizado__');
  await page.locator('#mc-duracao-texto').fill('Instantânea');
}

/** Abre "Preparar Magias" na aba do 1º círculo. */
async function abrirGrade1(page) {
  await page.locator('#btn-add-magia').click();
  await assentar(page).catch(() => {});
  await page.locator('[data-tab-mg="1"]').click();
  await assentar(page).catch(() => {});
}

test('#98 criar com "Círculo superior": grava e mostra o padrão do livro no detalhe', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-issue-98');
  await assentar(page).catch(() => {});
  await page.locator('#btn-add-magia-custom').click();
  await assentar(page).catch(() => {});
  await preencherBasico(page, 'Chama Azul');
  await page.locator('#mc-circulo-superior').fill('O dano aumenta em 1d6 por círculo.');
  await page.locator('#btn-salvar-mc').click();
  await assentar(page).catch(() => {});

  expect((await personagemSalvo(page)).magias_customizadas[0].circulo_superior)
    .toBe('O dano aumenta em 1d6 por círculo.');

  await page.locator('summary', { hasText: /1º Círculo/ }).first().click().catch(() => {});
  await page.locator('.magia-item[data-magia-custom-index="0"]').first().locator('.magia-nome').click();
  const desc = page.locator('.magia-item.expandida .magia-desc');
  await expect(desc).toContainText('Usando um Espaço de Magia de Círculo Superior.');
  await expect(desc).toContainText('por círculo.');
});

test('#111 a fonte aparece como badge na grade e a busca por ela encontra a magia', async ({ context }) => {
  const { page } = await abrirFicha(context, CLERIGO_5, 'regras-issue-111');
  await assentar(page).catch(() => {});
  await abrirGrade1(page);
  await expect(page.locator('#resultado-magias')).toContainText('Homebrew');
  await page.locator('#busca-magia-add').fill('homebrew');
  await assentar(page).catch(() => {});
  await expect(page.locator('#resultado-magias')).toContainText('Chama Azul');
  await page.locator('#busca-magia-add').fill('xanathar');
  await assentar(page).catch(() => {});
  await expect(page.locator('#resultado-magias')).not.toContainText('Chama Azul');
});

test('#111 o formulário grava a fonte', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-issue-111-b');
  await assentar(page).catch(() => {});
  await page.locator('#btn-add-magia-custom').click();
  await assentar(page).catch(() => {});
  await preencherBasico(page, 'Selo');
  await page.locator('#mc-fonte').fill('Xanathar');
  await page.locator('#btn-salvar-mc').click();
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).magias_customizadas[0].fonte).toBe('Xanathar');
});

test('#123 magia marcada só para Druida aparece na grade do Druida e não na do Clérigo', async ({ context }) => {
  const { page } = await abrirFicha(context, CLERIGO_3_DRUIDA_3, 'regras-issue-123');
  await assentar(page).catch(() => {});
  // Superfície inicial: Clérigo (classe inicial).
  await abrirGrade1(page);
  await expect(page.locator('#resultado-magias')).not.toContainText('Chama Azul');
  await page.evaluate(() => window.fecharModal());
  await assentar(page).catch(() => {});
  // Troca a superfície na seção Magias da ficha e abre a grade de novo.
  await page.locator('[data-tab-superficie="Druida"]').click();
  await assentar(page).catch(() => {});
  await abrirGrade1(page);
  await expect(page.locator('#resultado-magias')).toContainText('Chama Azul');
});

test('#123 o formulário grava as classes e a magia nova de multiclasse nasce com as classes dele marcadas', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...CLERIGO_3_DRUIDA_3, magias_customizadas: [] }, 'regras-issue-123-b');
  await assentar(page).catch(() => {});
  await page.locator('#btn-add-magia-custom').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('[data-mc-classe="Clérigo"]')).toBeChecked();
  await expect(page.locator('[data-mc-classe="Druida"]')).toBeChecked();
  await expect(page.locator('[data-mc-classe="Mago"]')).not.toBeChecked();
  await preencherBasico(page, 'Selo');
  await page.locator('[data-mc-classe="Druida"]').uncheck();
  await page.locator('#btn-salvar-mc').click();
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).magias_customizadas[0].classes).toEqual(['Clérigo']);
});
