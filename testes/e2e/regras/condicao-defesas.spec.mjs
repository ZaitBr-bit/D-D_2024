// ============================================================
// Issue #94, Fase 3 -- marcar Petrificado no gerenciador de condições
// (clique real) tem de fazer a seção Defesas mostrar Resistência a todo
// dano e Imunidade a Envenenado, mesmo num personagem sem nenhuma defesa
// fixa configurada.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, marcarCondicao } from './helpers-regras.mjs';

const GUERREIRO_5 = {
  classe: 'Guerreiro', subclasse: '', nivel: 5, xp: 6500,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
};

function cardDefesas(page) {
  return page.locator('.card', { has: page.locator('h2', { hasText: 'Defesas' }) });
}

test('Petrificado marcado no gerenciador de condições dá Resistência a todo dano e Imunidade a Envenenado', async ({ context }) => {
  const id = 'regras-issue94-defesas-petrificado';
  const { page, erros } = await abrirFicha(context, GUERREIRO_5, id);

  await expect(cardDefesas(page)).toContainText('Nenhuma defesa configurada');

  await marcarCondicao(page, 'Petrificado');

  await expect(cardDefesas(page)).toContainText('Ácido');
  await expect(cardDefesas(page)).toContainText('Venenoso');
  await expect(cardDefesas(page)).toContainText('(Petrificado)');
  await expect(cardDefesas(page)).toContainText('Envenenado');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Contraste: Amedrontado marcado não altera a seção Defesas', async ({ context }) => {
  const id = 'regras-issue94-defesas-amedrontado';
  const { page, erros } = await abrirFicha(context, GUERREIRO_5, id);

  await expect(cardDefesas(page)).toContainText('Nenhuma defesa configurada');

  await marcarCondicao(page, 'Amedrontado');

  await expect(cardDefesas(page), 'Amedrontado não dá resistência/imunidade nenhuma -- o card tem de continuar vazio')
    .toContainText('Nenhuma defesa configurada');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
