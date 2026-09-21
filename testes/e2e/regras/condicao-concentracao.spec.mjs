// ============================================================
// Issue #94, Fase 4 -- marcar Incapacitado no gerenciador de condições
// (clique real) tem de quebrar a Concentração ativa sozinho ("Concentração
// interrompida", glossário de condições) -- o mesmo efeito que o botão
// manual "Quebrar" já produzia.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, marcarCondicao } from './helpers-regras.mjs';

const GUERREIRO_5_CONCENTRANDO = {
  classe: 'Guerreiro', subclasse: '', nivel: 5, xp: 6500,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
  efeitos_magicos: [{ nome: 'Bênção', concentracao: true, tipo: 'buff_d20', bonus: '+1d4', aplica_em: ['ataque', 'salvaguarda'] }],
};

test('Incapacitado marcado no gerenciador de condições quebra a Concentração ativa sozinho', async ({ context }) => {
  const id = 'regras-issue94-concentracao-incapacitado';
  const { page, erros } = await abrirFicha(context, GUERREIRO_5_CONCENTRANDO, id);

  await expect(page.locator('text=Concentrando:')).toBeVisible();
  await expect(page.locator('[data-quebrar-concentracao]')).toBeVisible();

  await marcarCondicao(page, 'Incapacitado');

  await expect(page.locator('text=Concentrando:'),
    'ao marcar Incapacitado, a faixa de "Concentrando" tem de sumir sozinha')
    .toBeHidden();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Contraste: Amedrontado marcado não quebra a Concentração ativa', async ({ context }) => {
  const id = 'regras-issue94-concentracao-amedrontado';
  const { page, erros } = await abrirFicha(context, GUERREIRO_5_CONCENTRANDO, id);

  await expect(page.locator('text=Concentrando:')).toBeVisible();

  await marcarCondicao(page, 'Amedrontado');

  await expect(page.locator('text=Concentrando:'),
    'Amedrontado não interrompe Concentração -- a faixa tem de continuar visível')
    .toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
