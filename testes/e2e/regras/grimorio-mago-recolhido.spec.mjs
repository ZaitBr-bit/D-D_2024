// ============================================================
// Issue #110 -- o Grimório do Mago abre com os círculos recolhidos;
// clicar no <summary> de um círculo abre só ele.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const MAGO_5 = {
  nome: 'Aluno de Magia', especie: 'Humano', classe: 'Mago', subclasse: '',
  nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  classes: [{ classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 }],
  grimorio: [{ nome: 'Mísseis Mágicos', circulo: 1 }, { nome: 'Bola de Fogo', circulo: 3 }],
  schema_versao: 2,
};

test('círculos do grimório nascem recolhidos e abrem pelo clique no summary', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-issue-110');
  await assentar(page).catch(() => {});
  await page.locator('details[data-details-id="grimorio-mago"] > summary').click();
  const circ1 = page.locator('details[data-details-id="grimorio-mago-circulo-1"]');
  const circ3 = page.locator('details[data-details-id="grimorio-mago-circulo-3"]');
  await expect(circ1).toHaveCount(1);
  expect(await circ1.evaluate(el => el.open), 'círculo 1 deve nascer recolhido').toBe(false);
  expect(await circ3.evaluate(el => el.open), 'círculo 3 deve nascer recolhido').toBe(false);

  await circ1.locator('> summary').click();
  expect(await circ1.evaluate(el => el.open)).toBe(true);
  expect(await circ3.evaluate(el => el.open), 'abrir um círculo não abre os outros').toBe(false);
});
