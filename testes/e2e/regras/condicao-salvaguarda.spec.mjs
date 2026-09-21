// ============================================================
// Issue #94, Fase 2 -- marcar Paralisado no gerenciador de condições
// (clique real) tem de mostrar o badge "Falha automática" (F) na
// salvaguarda de Força, na ficha. Contraste: Amedrontado (que não força
// falha automática) mantém o badge de Desvantagem que já existia.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, marcarCondicao } from './helpers-regras.mjs';

const GUERREIRO_5 = {
  classe: 'Guerreiro', subclasse: '', nivel: 5, xp: 6500,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
};

function salvaItemForca(page) {
  return page.locator('.salva-item', { hasText: 'Força' });
}

test('Paralisado marcado no gerenciador de condições mostra "Falha automática" na salvaguarda de Força', async ({ context }) => {
  const id = 'regras-issue94-salvaguarda-paralisado';
  const { page, erros } = await abrirFicha(context, GUERREIRO_5, id);

  await expect(salvaItemForca(page).locator('.pericia-vd-badge')).toHaveCount(0);

  await marcarCondicao(page, 'Paralisado');

  const badge = salvaItemForca(page).locator('.pericia-vd-badge');
  await expect(badge, 'depois de marcar Paralisado, a salvaguarda de Força precisa mostrar o badge de falha automática')
    .toHaveText('F');
  await expect(badge).toHaveClass(/falha-automatica/);
  await expect(badge).toHaveAttribute('data-vd-info', /Falha automática: Paralisado/);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Contraste: Amedrontado marcado não muda a salvaguarda de Força (não é fonte de nada em For)', async ({ context }) => {
  const id = 'regras-issue94-salvaguarda-amedrontado';
  const { page, erros } = await abrirFicha(context, GUERREIRO_5, id);

  await expect(salvaItemForca(page).locator('.pericia-vd-badge')).toHaveCount(0);

  await marcarCondicao(page, 'Amedrontado');

  await expect(salvaItemForca(page).locator('.pericia-vd-badge'),
    'Amedrontado não altera salvaguarda de nenhum atributo -- não pode aparecer badge em Força')
    .toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
