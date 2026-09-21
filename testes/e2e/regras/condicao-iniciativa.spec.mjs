// ============================================================
// Issue #94, Fase 5 -- marcar Invisível no gerenciador de condições
// (clique real) tem de mostrar "Vantagem" no card de Iniciativa da ficha.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, marcarCondicao } from './helpers-regras.mjs';

const GUERREIRO_5 = {
  classe: 'Guerreiro', subclasse: '', nivel: 5, xp: 6500,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
};

function statBoxIniciativa(page) {
  return page.locator('.stat-box', { hasText: 'Iniciativa' });
}

test('Invisível marcado no gerenciador de condições mostra Vantagem na Iniciativa', async ({ context }) => {
  const id = 'regras-issue94-iniciativa-invisivel';
  const { page, erros } = await abrirFicha(context, GUERREIRO_5, id);

  await expect(statBoxIniciativa(page)).not.toContainText('Vantagem');

  await marcarCondicao(page, 'Invisível');

  await expect(statBoxIniciativa(page),
    'depois de marcar Invisível, o card de Iniciativa precisa mostrar "Vantagem"')
    .toContainText('Vantagem');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Contraste: Amedrontado marcado não muda a Iniciativa', async ({ context }) => {
  const id = 'regras-issue94-iniciativa-amedrontado';
  const { page, erros } = await abrirFicha(context, GUERREIRO_5, id);

  await expect(statBoxIniciativa(page)).not.toContainText('Vantagem');

  await marcarCondicao(page, 'Amedrontado');

  await expect(statBoxIniciativa(page),
    'Amedrontado não dá Vantagem na Iniciativa -- o card tem de continuar sem o rótulo')
    .not.toContainText('Vantagem');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
