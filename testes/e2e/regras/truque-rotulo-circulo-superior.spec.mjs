// ============================================================
// Issue #97 -- a descrição de "Aprimoramento de Truque" (Chama Sagrada,
// truque de Clérigo) vinha com o rótulo fixo "Em círculos superiores"
// antes dela, o mesmo rótulo que magia de círculo 1+ usa pra upcast --
// contraditório pra truque, que não sobe de círculo. Clique real na
// linha do truque, na ficha, pra revelar a descrição carregada.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar } from './helpers-regras.mjs';

test('ficha: descrição de truque (Chama Sagrada) não mostra "Em círculos superiores"', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Religião', 'Medicina'],
    magias_conhecidas: [{ nome: 'Chama Sagrada', circulo: 0 }],
  }, 'regras-issue97-truque-rotulo');
  await assentar(page).catch(() => {});

  // A seção de Truques nasce minimizada (<details id="details-truques">
  // sem `open`) -- clique real no cabeçalho pra revelar a lista.
  await page.locator('#details-truques summary').click();

  const linha = page.locator('.magia-item[data-magia-nome="Chama Sagrada"][data-magia-circ="0"]');
  await expect(linha, 'o truque precisa aparecer na ficha').toHaveCount(1);

  const descricao = linha.locator('.magia-desc');
  await expect(descricao, 'a descrição não pode estar visível antes do clique').toBeHidden();

  // Clique real na linha -- dispara o fetch e preenche a descrição.
  await linha.locator('.magia-nome').click();
  await expect(descricao, 'clicar na linha tem de revelar a descrição').toBeVisible();

  await expect(descricao, 'o texto de Aprimoramento de Truque precisa aparecer')
    .toContainText('Aprimoramento de Truque');
  await expect(descricao, 'truque não sobe de círculo -- o rótulo de upcast de magia normal não pode aparecer')
    .not.toContainText('Em círculos superiores');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: magia de círculo 1+ mostra a frase do PHB 2024 uma vez, e não o rótulo antigo (issue #102)', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
    classes: [{ classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 }],
    magias_preparadas: [{ nome: 'Mísseis Mágicos', circulo: 1 }],
    grimorio: [{ nome: 'Mísseis Mágicos', circulo: 1 }],
    schema_versao: 2,
  }, 'regras-issue102-rotulo');
  await assentar(page).catch(() => {});

  await page.locator('summary', { hasText: /1º Círculo/ }).first().click().catch(() => {});
  const linha = page.locator('.magia-item[data-magia-nome="Mísseis Mágicos"]').first();
  await linha.locator('.magia-nome').click();
  const descricao = linha.locator('.magia-desc');
  await expect(descricao).toBeVisible();

  await expect(descricao.locator('strong', { hasText: 'Usando um Espaço de Magia de Círculo Superior.' })).toHaveCount(1);
  await expect(descricao).not.toContainText('Em círculos superiores');
  expect((await descricao.innerText()).match(/Usando um Espaço de Magia de Círculo Superior/g)).toHaveLength(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
