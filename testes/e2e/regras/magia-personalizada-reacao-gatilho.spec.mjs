// ============================================================
// Issue #138 -- magia personalizada com tempo "Reação" era recusada
// ("Informe um tempo de conjuração válido") quando o gatilho digitado
// continha palavras como "arma" ou "ataque desarmado". Clique real no
// formulário e no botão Adicionar.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, personagemSalvo, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const MAGO_5 = {
  nome: 'Aluno', especie: 'Humano', classe: 'Mago', subclasse: '',
  nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  classes: [{ classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 }], schema_versao: 2,
};

/** Abre o formulário e preenche os campos obrigatórios com tempo Reação. */
async function abrirFormularioReacao(page, nome) {
  await page.locator('#btn-add-magia-custom').click();
  await assentar(page).catch(() => {});
  await page.locator('#mc-nome').fill(nome);
  await page.locator('#mc-circulo').selectOption('2');
  await page.locator('#mc-escola').selectOption('__personalizado__');
  await page.locator('#mc-escola-personalizada').fill('Transmutação');
  await page.locator('#mc-tempo').selectOption('Reação');
  await page.locator('#mc-alcance').fill('18 metros');
  await page.locator('#mc-comp-v').check();
  await page.locator('#mc-duracao').selectOption('__personalizado__');
  await page.locator('#mc-duracao-texto').fill('Instantânea');
}

test('Reação com gatilho que cita "arma" é aceita e grava o tempo completo', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-issue-138-a');
  await assentar(page).catch(() => {});
  await abrirFormularioReacao(page, 'Travar Arma');
  await page.locator('#mc-gatilho-reacao').fill('Quando uma criatura à sua vista faz um ataque com uma arma');
  await page.locator('#btn-salvar-mc').click();
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  const magia = salvo.magias_customizadas.find(m => m.nome === 'Travar Arma');
  expect(magia, 'a magia deveria ter sido gravada').toBeTruthy();
  expect(magia.tempo_conjuracao).toBe('Reação, Quando uma criatura à sua vista faz um ataque com uma arma');
});

test('Reação sem gatilho continua aceita', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-issue-138-b');
  await assentar(page).catch(() => {});
  await abrirFormularioReacao(page, 'Escudo Simples');
  await page.locator('#btn-salvar-mc').click();
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo.magias_customizadas.find(m => m.nome === 'Escudo Simples')?.tempo_conjuracao).toBe('Reação');
});

test('tempo personalizado inválido continua recusado (contraste)', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-issue-138-c');
  await assentar(page).catch(() => {});
  await abrirFormularioReacao(page, 'Tempo Ruim');
  await page.locator('#mc-tempo').selectOption('__personalizado__');
  await page.locator('#mc-tempo-personalizado').fill('Quando eu quiser');
  await page.locator('#btn-salvar-mc').click();
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect((salvo.magias_customizadas || []).some(m => m.nome === 'Tempo Ruim')).toBe(false);
});
