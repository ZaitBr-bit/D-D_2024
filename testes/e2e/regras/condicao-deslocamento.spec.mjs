// ============================================================
// Issue #94, Fase 1 -- marcar uma condição que zera o Deslocamento
// (Paralisado) no gerenciador de condições da ficha (clique real) tem de
// zerar o número mostrado no card "Deslocamento". Contraste: Amedrontado
// (que não zera Deslocamento) não muda o número.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, marcarCondicao } from './helpers-regras.mjs';

const GUERREIRO_5 = {
  classe: 'Guerreiro', subclasse: '', nivel: 5, xp: 6500,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
};

function statBoxDeslocamento(page) {
  return page.locator('.stat-box', { hasText: 'Deslocamento' });
}

test('Paralisado marcado no gerenciador de condições zera o Deslocamento mostrado na ficha', async ({ context }) => {
  const id = 'regras-issue94-deslocamento-paralisado';
  const { page, erros } = await abrirFicha(context, GUERREIRO_5, id);

  await expect(statBoxDeslocamento(page).locator('.stat-value')).toHaveText('9metros');

  await marcarCondicao(page, 'Paralisado');

  await expect(statBoxDeslocamento(page).locator('.stat-value'),
    'depois de marcar Paralisado no gerenciador, o Deslocamento mostrado tem de zerar')
    .toHaveText('0metros');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Contraste: Amedrontado marcado não muda o Deslocamento mostrado', async ({ context }) => {
  const id = 'regras-issue94-deslocamento-amedrontado';
  const { page, erros } = await abrirFicha(context, GUERREIRO_5, id);

  await expect(statBoxDeslocamento(page).locator('.stat-value')).toHaveText('9metros');

  await marcarCondicao(page, 'Amedrontado');

  await expect(statBoxDeslocamento(page).locator('.stat-value'),
    'Amedrontado não está entre as condições que zeram Deslocamento -- o número não pode mudar')
    .toHaveText('9metros');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
