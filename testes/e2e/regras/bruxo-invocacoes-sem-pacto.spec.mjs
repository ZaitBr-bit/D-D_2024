// ============================================================
// Invocações Místicas que concedem magia valem SEM Pacto.
//
// PHB 2024: o Pacto é uma invocação como as outras (nível 1, sem
// pré-requisito); nenhuma invocação de magia exige Pacto. Armadura de
// Sombras ("Você pode conjurar Armadura Arcana em si sem gastar um espaço
// de magia") não pede nada além de ser escolhida.
//
// Defeito (relato do dono): a seção que lista "Magias via Invocações",
// "Truques Modificados" e "Talentos via Invocações" saía vazia quando o
// Bruxo não tinha Pacto, então a magia grátis da invocação não aparecia.
// Os specs de bruxo-invocacoes-magia sempre semeavam um Pacto junto, e por
// isso nunca viram o caso.
//
// Clica de verdade: o que o jogador precisa é do botão de conjurar.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

const BRUXO = {
  classe: 'Bruxo', nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'Enganação'],
};

/** Abre a ficha de um Bruxo 5 com as invocações dadas e abre todos os <details>. */
async function bruxoCom(context, nomes, id) {
  const lado = await abrirFicha(context, {
    ...BRUXO, recursos: { bruxo: { invocacoes: nomes.map((nome) => ({ nome })) } },
  }, id);
  await assentar(lado.page).catch(() => {});
  await lado.page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  return lado;
}

test('Armadura de Sombras sem Pacto: a magia grátis aparece e conjura', async ({ context }) => {
  const { page, erros } = await bruxoCom(context, ['Armadura de Sombras'], 'bruxo-sem-pacto-1');

  const botao = page.locator('[data-conjurar-pacto="Armadura Arcana"]');
  await expect(botao, 'a magia da invocação precisa ter botão de conjurar mesmo sem Pacto')
    .toHaveCount(1);
  await botao.click();
  await page.locator('#alvo-self').click();
  await assentar(page).catch(() => {});

  const p = await personagemSalvo(page);
  expect((p.efeitos_magicos || []).some((e) => e.nome === 'Armadura Arcana'),
    'a conjuração precisa gravar o efeito de Armadura Arcana').toBe(true);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('sem Pacto e sem invocação de magia: nenhuma seção de Dádivas aparece', async ({ context }) => {
  const { page, erros } = await bruxoCom(context, ['Mente Mística'], 'bruxo-sem-pacto-2');
  await expect(page.locator('[data-pacto-dadivas]')).toHaveCount(0);
  await expect(page.getByText('Dadivas do Pacto')).toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
