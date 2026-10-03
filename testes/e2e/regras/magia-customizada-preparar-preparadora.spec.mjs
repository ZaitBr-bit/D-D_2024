// ============================================================
// Issue #124 -- Clerigo: magia personalizada "ocupa vaga" aparece na grade
// de Preparar Magias, com badge, e o clique prepara/desprepara.
// "Sempre preparada" continua fora da grade (nao regride).
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, ATRIBUTOS_REGRAS, personagemSalvo } from './helpers-regras.mjs';

const CLERIGO_5 = {
  nome: 'Devoto de Nimb', especie: 'Humano', classe: 'Clérigo', subclasse: '',
  nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  classes: [{ classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 }],
  magias_customizadas: [
    { nome: 'Chama Azul', circulo: 1, escola: 'Evocação', tempo_conjuracao: 'Ação', alcance: '18 metros',
      componentes: { v: true, s: false, m: false }, duracao: 'Instantânea', sempre_preparada: false },
    { nome: 'Selo Eterno', circulo: 1, escola: 'Abjuração', tempo_conjuracao: 'Ação', alcance: 'Pessoal',
      componentes: { v: true, s: false, m: false }, duracao: 'Instantânea' },
  ],
  schema_versao: 2,
};

async function abrirGrade1(context, id) {
  const { page } = await abrirFicha(context, CLERIGO_5, id);
  await assentar(page).catch(() => {});
  await page.locator('#btn-add-magia').click();
  await assentar(page).catch(() => {});
  await page.locator('[data-tab-mg="1"]').click();
  await assentar(page).catch(() => {});
  return page;
}

test('"ocupa vaga" aparece na grade do Clérigo com badge, "sempre preparada" não', async ({ context }) => {
  const page = await abrirGrade1(context, 'regras-issue-124-a');
  const grade = page.locator('#resultado-magias');
  await expect(grade).toContainText('Chama Azul');
  await expect(grade).toContainText('Personalizada');
  await expect(grade).not.toContainText('Selo Eterno');
});

test('clicar no check do cartão prepara e depois desprepara a personalizada', async ({ context }) => {
  const page = await abrirGrade1(context, 'regras-issue-124-b');
  await page.locator('.opcao-card:has-text("Chama Azul") [data-circ-check]').click();
  await assentar(page).catch(() => {});
  let salvo = await personagemSalvo(page);
  expect(salvo.magias_preparadas.some(m => m.nome === 'Chama Azul' && m.classe === 'Clérigo')).toBe(true);

  await page.locator('.opcao-card:has-text("Chama Azul") [data-circ-check]').click();
  await assentar(page).catch(() => {});
  salvo = await personagemSalvo(page);
  expect(salvo.magias_preparadas.some(m => m.nome === 'Chama Azul')).toBe(false);
});
