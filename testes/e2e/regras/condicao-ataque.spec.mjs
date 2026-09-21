// ============================================================
// Issue #94, Fase 6 -- marcar Cego no gerenciador de condições (clique
// real) tem de mostrar o badge "Desvantagem (Cego)" no ataque da arma
// equipada, na seção de Inventário.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, marcarCondicao } from './helpers-regras.mjs';

const GUERREIRO_5_COM_ARMA = {
  classe: 'Guerreiro', subclasse: '', nivel: 5, xp: 6500,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
  inventario: [
    { nome: 'Espada Longa', tipo: 'arma', quantidade: 1, equipado: true,
      dados: { peso: '1,5 kg', dano: '1d8', tipo_dano: 'cortante', categoria: 'Marcial corpo a corpo' } },
  ],
};

function itemArma(page) {
  return page.locator('.inv-item', { hasText: 'Espada Longa' });
}

test('Cego marcado no gerenciador de condições mostra Desvantagem no ataque da arma equipada', async ({ context }) => {
  const id = 'regras-issue94-ataque-cego';
  const { page, erros } = await abrirFicha(context, GUERREIRO_5_COM_ARMA, id);

  await expect(itemArma(page)).not.toContainText('Desvantagem');

  await marcarCondicao(page, 'Cego');

  await expect(itemArma(page),
    'depois de marcar Cego, a arma equipada precisa mostrar o badge de Desvantagem no ataque')
    .toContainText('Desvantagem (Cego)');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Contraste: Amedrontado marcado também mostra Desvantagem (mesma fonte de condição)', async ({ context }) => {
  const id = 'regras-issue94-ataque-amedrontado';
  const { page, erros } = await abrirFicha(context, GUERREIRO_5_COM_ARMA, id);

  await expect(itemArma(page)).not.toContainText('Desvantagem');

  await marcarCondicao(page, 'Amedrontado');

  await expect(itemArma(page)).toContainText('Desvantagem (Amedrontado)');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Contraste: Enfeitiçado (não afeta ataque) não muda o badge da arma', async ({ context }) => {
  const id = 'regras-issue94-ataque-enfeiticado';
  const { page, erros } = await abrirFicha(context, GUERREIRO_5_COM_ARMA, id);

  await expect(itemArma(page)).not.toContainText('Desvantagem');

  await marcarCondicao(page, 'Enfeitiçado');

  await expect(itemArma(page),
    'Enfeitiçado não dá desvantagem de ataque -- não pode aparecer o badge')
    .not.toContainText('Desvantagem');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
