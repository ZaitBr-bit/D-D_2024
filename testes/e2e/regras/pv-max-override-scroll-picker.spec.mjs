// ============================================================
// Issue #86 -- o modal "Sobrescrever PV Máximo" (botão "⚙ PV Max") usa o
// scroll-picker genérico (numberPickerHtml/setupNumberPicker, sheet/
// hp-descanso.js), que só RENDERIZA itens até `min+49` por performance
// (ex.: min=1 -> item máximo visível é 50). O posicionamento inicial do
// scroll (para mostrar o item certo destacado) disparava o listener de
// 'scroll' de forma assíncrona, e esse listener recalculava o valor a
// partir do ÍNDICE DO ITEM RENDERIZADO -- sobrescrevendo silenciosamente
// um PV real de 225 por 50, ANTES de qualquer interação do jogador.
//
// Este spec abre o modal com PV máximo real de 225 (> 50) e clica
// "Aplicar" SEM tocar em nada -- o valor persistido tem de continuar 225.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

test('PV Max: abrir o modal com PV real acima de 50 e aplicar sem tocar não derruba o valor (issue #86)', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Bárbaro', nivel: 20, atributos: ATRIBUTOS_REGRAS,
    pv_max: 225, pv_atual: 225,
  }, 'regras-pv-max-scroll-picker');

  await page.click('#hp-max-override');
  await page.waitForSelector('#modal-overlay', { state: 'visible' });
  // Dá tempo para o posicionamento inicial do scroll (e o listener
  // assíncrono que ele dispara) rodar por completo antes do clique --
  // exatamente a janela onde o bug sobrescrevia o valor.
  await page.waitForTimeout(300);

  expect(await page.inputValue('#input-pv-max-manual'),
    'o campo "ou digite" deveria continuar com o PV real -- o bug sobrescrevia com o teto do picker (50)').toBe('225');

  await page.click('#btn-aplicar-pv-max');
  await page.waitForTimeout(300);

  const salvo = await personagemSalvo(page);
  expect(salvo?.pv_max, 'PV máximo base não pode ter mudado').toBe(225);
  expect(salvo?.pv_max_override, 'aplicar sem editar nada não deveria criar override nenhum').toBeUndefined();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('PV Max: digitar um valor acima de 50 com PV real também acima de 50 aplica o valor digitado, não o teto do picker', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Bárbaro', nivel: 20, atributos: ATRIBUTOS_REGRAS,
    pv_max: 225, pv_atual: 225,
  }, 'regras-pv-max-scroll-picker-2');

  await page.click('#hp-max-override');
  await page.waitForSelector('#modal-overlay', { state: 'visible' });
  await page.waitForTimeout(300);

  await page.fill('#input-pv-max-manual', '260');
  await page.locator('#input-pv-max-manual').dispatchEvent('change');
  await assentar(page).catch(() => {});
  await page.click('#btn-aplicar-pv-max');
  await page.waitForTimeout(300);

  const salvo = await personagemSalvo(page);
  expect(salvo?.pv_max_override, 'o valor digitado (260) tem de ser o aplicado, não o teto do picker (50)').toBe(260);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
