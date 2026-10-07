// ============================================================
// Issue #58 -- prova de tela: adicionar e remover idioma pelo modal
// "Editar ficha", aba "Idiomas". O oráculo de unidade
// (edicao-idiomas.test.mjs) já mede o comportamento com um documento
// falso; este spec prova o clique de verdade, no navegador, incluindo a
// linha de idiomas do cabeçalho refletindo a mudança.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, abrirIdentidade, assentar } from './helpers-regras.mjs';

const MAGO_5 = {
  nome: 'Aluno de Magia', especie: 'Humano', classe: 'Mago', subclasse: '',
  nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  idiomas: ['Comum', 'Anão'],
  schema_versao: 2,
};

test('remover um idioma pela aba Idiomas some da linha do cabeçalho', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-idiomas-1');
  await assentar(page).catch(() => {});

  await expect(page.locator('#card-identidade')).toContainText('Anão');

  await abrirIdentidade(page);

  await page.locator('#btn-editar-ficha').click();
  await assentar(page).catch(() => {});
  await page.locator('button[data-edicao-secao="idiomas"]').click();
  await assentar(page).catch(() => {});
  await page.locator('input[data-edicao-idioma-toggle="Anão"]').uncheck();
  await page.locator('#btn-salvar-edicao-ficha').click();
  await assentar(page).catch(() => {});

  await expect(page.locator('#card-identidade')).not.toContainText('Anão');
});

test('adicionar um idioma por texto livre aparece na linha do cabeçalho', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-idiomas-2');
  await assentar(page).catch(() => {});

  await abrirIdentidade(page);

  await page.locator('#btn-editar-ficha').click();
  await assentar(page).catch(() => {});
  await page.locator('button[data-edicao-secao="idiomas"]').click();
  await assentar(page).catch(() => {});
  await page.locator('#edicao-idioma-novo').fill('Dialeto da Guilda');
  await page.locator('#btn-edicao-idioma-add').click();
  await page.locator('#btn-salvar-edicao-ficha').click();
  await assentar(page).catch(() => {});

  await expect(page.locator('#card-identidade')).toContainText('Dialeto da Guilda');
});
