// ============================================================
// Subir para o nível 3 escolhendo uma subclasse conjuradora, na tela.
//
// O motor de unidade (testes/regras/unidade/subclasse-conjuradora.test.mjs)
// já confronta as tabelas e o estado gravado; o que só o navegador prova é
// o encadeamento da TELA: escolher a subclasse no passo anterior e o passo
// de magias aparecer com a lista de Mago carregada -- a lista é buscada
// depois da escolha, num await no meio da navegação entre passos.
//
// PHB 2024, Conjuração de Trapaceiro Arcano: nível 3 = 3 truques (um deles
// Mãos Mágicas, fixa), 3 magias preparadas de 1º círculo e 2 espaços de 1º.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar, personagemSalvo } from './helpers-regras.mjs';

const LADINO_NIVEL_2 = {
  classe: 'Ladino', nivel: 2, xp: 355000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
};

/** Clica em "Próximo" e espera o modal reagir. */
async function proximo(page) {
  const botao = page.locator('#btn-step-proximo');
  if (!await botao.count()) return false;
  await botao.click();
  await assentar(page).catch(() => {});
  return true;
}

test('level-up: Ladino que escolhe Trapaceiro Arcano recebe a tela de magias e os espaços', async ({ context }) => {
  const { page } = await abrirFicha(context, LADINO_NIVEL_2, 'regras-trapaceiro-1');
  expect(await abrirModalLevelUp(page)).toBe(true);

  // Passo 1 (ganhos) -> passo 2 (subclasse)
  await proximo(page);
  const cardSubclasse = page.locator('[data-subclasse="Trapaceiro Arcano"]');
  await expect(cardSubclasse).toBeVisible();
  await cardSubclasse.click();
  await proximo(page);

  // O passo de magias tem de existir, pedir 2 truques (Mãos Mágicas é
  // concedida) e 3 magias conhecidas.
  await expect(page.locator('#btn-lvlup-truques')).toBeVisible();
  await expect(page.locator('#lvlup-truques-resumo')).toContainText('Selecione 2');
  await expect(page.locator('#lvlup-magias-resumo')).toContainText('Selecione 3');
  await expect(page.locator('.levelup-card-header', { hasText: 'Truque da Subclasse' })).toBeVisible();

  // A lista oferecida tem de ser a de Mago -- sem o recarregamento após a
  // escolha da subclasse, ela vem vazia (não existe magias_ladino.json).
  await page.click('#btn-lvlup-truques');
  await assentar(page).catch(() => {});
  const opcoesTruque = page.locator('#grid-magias [data-grid-nome]');
  await expect(opcoesTruque.first()).toBeVisible();
  expect(await opcoesTruque.count()).toBeGreaterThan(5);
  await expect(page.locator('#grid-magias [data-grid-nome="Ilusão Menor"]')).toBeVisible();
});

test('level-up: os espaços de magia do Trapaceiro Arcano ficam gravados ao confirmar o nível', async ({ context }) => {
  const { page } = await abrirFicha(context, LADINO_NIVEL_2, 'regras-trapaceiro-2');
  expect(await abrirModalLevelUp(page)).toBe(true);

  await proximo(page);
  await page.locator('[data-subclasse="Trapaceiro Arcano"]').click();

  // Vai até o fim do fluxo confirmando o que der; a seleção de magias é
  // obrigatória, então este teste confirma direto pelo motor de subida --
  // o que ele afirma é o estado final gravado, não a navegação (coberta
  // pelo teste acima).
  await page.evaluate(async () => {
    const store = await import(new URL('./js/store.js', location.href).href);
    const levelup = await import(new URL('./js/levelup.js', location.href).href);
    const personagem = store.listarPersonagens()[0];
    await levelup.subirDeNivel(personagem, { subclasse: 'Trapaceiro Arcano', ignorar_xp: true });
    store.salvarPersonagem(personagem);
  });

  const salvo = await personagemSalvo(page);
  expect(salvo.nivel).toBe(3);
  expect(salvo.espacos_magia['1'].total).toBe(2);
  expect(salvo.magias_conhecidas.map(m => m.nome)).toContain('Mãos Mágicas');
});
