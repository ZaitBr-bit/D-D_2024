// ============================================================
// Issue #148: o Golias conta como um tamanho maior na capacidade de carga
// (Porte Poderoso). Força 17 -> 17 x 13,5 = 229,5 kg, não 119 kg (Médio).
// O spec clica no peso do inventário, que abre o popup do cálculo.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, marcarCondicao } from './helpers-regras.mjs';

/** Guerreiro 1 Força 17 da espécie indicada, com uma carga de 150 kg. */
function guerreiro(especie) {
  return {
    classe: 'Guerreiro', nivel: 1, xp: 0, especie, tamanho: 'Médio',
    atributos: { ...ATRIBUTOS_REGRAS, forca: 17 },
    pericias_proficientes: ['Atletismo', 'História'],
    inventario: [{ nome: 'Fardo', tipo: 'equipamento', quantidade: 1, equipado: false, dados: { peso: '150 kg' } }],
  };
}

/** Clica no peso do inventário e devolve o texto do popup "Capacidade de Carga". */
async function textoDoPopupDeCarga(page) {
  await page.click('#sheet-peso-valor');
  const modal = page.locator('.modal-container', { hasText: 'Cálculo do peso máximo' });
  await expect(modal).toBeVisible();
  return modal.innerText();
}

test('Golias Força 17: popup mostra 229,5 kg como Grande e cita Porte Poderoso', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, guerreiro('Golias'), 'regras-carga-golias');
  await assentar(page).catch(() => {});

  const texto = await textoDoPopupDeCarga(page);
  expect(texto).toContain('Força 17 × 13,5 (Médio, conta como Grande) = 229,5 kg');
  expect(texto).toContain('Porte Poderoso');
  expect(texto, '150 kg cabem nos 229,5 kg').toContain('Disponível: 79,5 kg');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// Porte Poderoso, 1ª metade: Vantagem no teste para escapar de Imobilizado
// (Atletismo ou Acrobacia). Situacional, então aparece como selo V*.
const NOTA_PORTE = 'Porte Poderoso: Vantagem para encerrar a condição Imobilizado';

test('Golias: selo V* de Porte Poderoso só aparece ao marcar Imobilizado; clicar mostra o texto', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, guerreiro('Golias'), 'regras-porte-golias');
  await assentar(page).catch(() => {});

  await expect(page.locator('[data-vd-info*="Porte Poderoso"]'), 'sem Imobilizado, sem selo').toHaveCount(0);
  await marcarCondicao(page, 'Imobilizado');

  for (const pericia of ['Atletismo', 'Acrobacia']) {
    const linha = page.locator('.pericia-item', { hasText: pericia });
    await expect(linha.locator('.vantagem-nota')).toHaveAttribute('data-vd-info', NOTA_PORTE);
    await expect(linha.locator('.pericia-vd-badge.vantagem'), `${pericia}: não é Vantagem fixa`).toHaveCount(0);
  }
  await page.locator('.pericia-item', { hasText: 'Atletismo' }).locator('.vantagem-nota').click();
  await expect(page.locator('#toast-container')).toContainText(NOTA_PORTE);
  await expect(page.locator('.pericia-item', { hasText: 'Furtividade' }).locator('.vantagem-nota')).toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Humano Força 17: popup segue 119 kg e sobrecarregado -- o contraste', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, guerreiro('Humano'), 'regras-carga-humano');
  await assentar(page).catch(() => {});
  await marcarCondicao(page, 'Imobilizado');
  await expect(page.locator('[data-vd-info*="Porte Poderoso"]')).toHaveCount(0);

  const texto = await textoDoPopupDeCarga(page);
  expect(texto).toContain('Força 17 × 7 (Médio) = 119 kg');
  expect(texto).not.toContain('Porte Poderoso');
  expect(texto).toContain('Excede em 31 kg');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
