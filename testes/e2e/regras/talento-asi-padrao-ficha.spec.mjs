// ============================================================
// Issue #67 -- o botão "+ Talento" da FICHA (fora do level-up), ao
// adicionar "Aumento no Valor de Atributo", tinha de exigir a
// distribuição do livro (+2 num atributo, ou +1 em dois) -- a tela
// mostrava o distribuidor de 2 pontos (renderEscolhasTalento,
// levelup-ui.js) mas o clique em "Adicionar" lia um select genérico de
// "+1" diferente (o mesmo usado por Resiliente etc.), concedendo só a
// metade do que o talento dá e ignorando em silêncio o que a pessoa
// preencheu no distribuidor.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, ATRIBUTOS_REGRAS, personagemSalvo } from './helpers-regras.mjs';

test('ficha: + Talento "Aumento no Valor de Atributo" exige e aplica os 2 pontos (split 1/1)', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    classe: 'Guerreiro', nivel: 4, xp: 2700,
    atributos: ATRIBUTOS_REGRAS, talentos: [],
  }, 'regras-asi-padrao-ficha-1');
  await assentar(page).catch(() => {});

  await page.click('#btn-add-talento');
  await page.waitForSelector('#add-talento-lista', { state: 'visible', timeout: 5000 });
  const card = page.locator('#add-talento-lista .opcao-card[data-opcao="Aumento no Valor de Atributo"]');
  await card.waitFor({ state: 'visible', timeout: 5000 });
  await card.locator('.opcao-check').click();
  await page.click('#btn-confirmar-add-talento');
  await page.waitForSelector('#levelup-talento-attr-forca', { state: 'visible', timeout: 5000 });

  // O select genérico de "+1" (usado por Resiliente etc.) não deve mais
  // aparecer para este talento -- duplicaria o controle sem que nada o leia.
  await expect(page.locator('select#levelup-talento-asi')).toHaveCount(0);

  await page.selectOption('#levelup-talento-attr-forca', '1');
  await page.selectOption('#levelup-talento-attr-destreza', '1');
  await page.click('#btn-confirmar-add-talento-asi');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo?.atributos?.forca, 'Força deveria ter subido +1').toBe(ATRIBUTOS_REGRAS.forca + 1);
  expect(salvo?.atributos?.destreza, 'Destreza deveria ter subido +1').toBe(ATRIBUTOS_REGRAS.destreza + 1);
  expect((salvo?.talentos || []).some(t => (typeof t === 'string' ? t : t.nome) === 'Aumento no Valor de Atributo'))
    .toBe(true);
});

test('ficha: + Talento "Aumento no Valor de Atributo" recusa confirmar com só 1 ponto distribuído', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    classe: 'Guerreiro', nivel: 4, xp: 2700,
    atributos: ATRIBUTOS_REGRAS, talentos: [],
  }, 'regras-asi-padrao-ficha-2');
  await assentar(page).catch(() => {});

  await page.click('#btn-add-talento');
  await page.waitForSelector('#add-talento-lista', { state: 'visible', timeout: 5000 });
  const card = page.locator('#add-talento-lista .opcao-card[data-opcao="Aumento no Valor de Atributo"]');
  await card.waitFor({ state: 'visible', timeout: 5000 });
  await card.locator('.opcao-check').click();
  await page.click('#btn-confirmar-add-talento');
  await page.waitForSelector('#levelup-talento-attr-forca', { state: 'visible', timeout: 5000 });

  await page.selectOption('#levelup-talento-attr-forca', '1');
  await page.click('#btn-confirmar-add-talento-asi');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo?.atributos?.forca, 'sem os 2 pontos distribuídos, não deveria persistir').toBe(ATRIBUTOS_REGRAS.forca);
  expect((salvo?.talentos || []).some(t => (typeof t === 'string' ? t : t.nome) === 'Aumento no Valor de Atributo'))
    .toBe(false);
});
