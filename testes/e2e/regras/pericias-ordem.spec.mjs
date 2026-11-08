// ============================================================
// Ordem das Perícias: dropdown no card grava o modo e reordena a lista.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

const ORDEM_PADRAO = ['Percepção', 'Intuição', 'Investigação'];

// Lê os nomes das perícias na ordem exibida.
async function nomes(page) {
  return page.locator('details[data-details-id="pericias"] .pericia-nome').allTextContents();
}

test('select de ordem reordena as Perícias, grava o modo e sobrevive ao reload', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Guerreiro', nivel: 1, atributos: ATRIBUTOS_REGRAS }, 'pericias-ordem');
  const quadro = page.locator('details[data-details-id="pericias"]');
  const select = page.locator('#sel-ordem-pericias');

  await expect(select).toHaveValue('padrao');
  expect((await nomes(page)).slice(0, 3)).toEqual(ORDEM_PADRAO);

  await select.selectOption('alfabetica');
  const esperado = [...(await nomes(page))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  expect(await nomes(page)).toEqual(esperado);
  await expect(quadro).toHaveAttribute('open', '');

  await page.selectOption('#sel-ordem-pericias', 'bonus');
  const bonus = (await quadro.locator('.pericia-bonus').allTextContents())
    .map((t) => parseInt(t.replace('−', '-'), 10));
  for (let i = 1; i < bonus.length; i++) expect(bonus[i]).toBeLessThanOrEqual(bonus[i - 1]);

  await page.selectOption('#sel-ordem-pericias', 'atributo');
  const tags = await quadro.locator('.pericia-atributo-tag').allTextContents();
  const grupos = tags.filter((t, i) => i === 0 || t !== tags[i - 1]);
  expect(grupos).toEqual(['FOR', 'DES', 'INT', 'SAB', 'CAR']);

  expect((await personagemSalvo(page)).ordem_pericias).toBe('atributo');
  const ordemAtributo = await nomes(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar(page);
  await expect(page.locator('#sel-ordem-pericias')).toHaveValue('atributo');
  expect(await nomes(page)).toEqual(ordemAtributo);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('valor inválido em ordem_pericias cai no padrão', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', nivel: 1, atributos: ATRIBUTOS_REGRAS, ordem_pericias: 'xyz'
  }, 'pericias-ordem-invalida');
  await expect(page.locator('#sel-ordem-pericias')).toHaveValue('padrao');
  expect((await nomes(page)).slice(0, 3)).toEqual(ORDEM_PADRAO);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
