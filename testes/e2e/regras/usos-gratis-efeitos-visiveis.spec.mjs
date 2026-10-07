// ============================================================
// Uso grátis da magia de Linhagem Élfica, lugar do efeito de Passos Largos
// na ficha, condições com nome clicável e contador dos usos grátis do
// Cartógrafo (Magia de Mapeamento).
//
// Relatos do dono:
//  1. Elfo Silvestre: Passos Largos não oferece o uso grátis (PHB 2024:
//     "pode conjurar uma vez sem gastar espaço de magia; recupera no
//     Descanso Longo").
//  2. O efeito de Passos Largos (+3 m) aparecia no campo da CA, não no do
//     Deslocamento.
//  3. Em Condições o efeito aparecia como "+3m de deslocamento"; o certo é o
//     nome, e clicar nele explica o que faz.
//  4. Cartografia Iluminada (Fogo das Fadas grátis, Int vezes, mín. 1,
//     Descanso Longo) não mostra contador.
//
// Todos CLICAM: o que o jogador usa é o botão e o clique no selo.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const ELFO_SILVESTRE = {
  classe: 'Guerreiro', nivel: 3, xp: 900, especie: 'Elfo', tracos_escolhidos: ['Elfo Silvestre'],
  atributos: ATRIBUTOS_REGRAS, pericias_proficientes: ['Atletismo', 'História'],
};

/** Abre todos os <details> (a ficha nasce com os blocos recolhidos). */
async function abrirTudo(page) {
  await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); });
}

test('Elfo Silvestre 3: Passos Largos tem o uso grátis, gasta e volta no Descanso Longo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, ELFO_SILVESTRE, 'gratis-linhagem-elfo');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  const gratis = page.locator('[data-conjurar-gratis="Passos Largos"]');
  await expect(gratis, 'a magia da Linhagem Élfica precisa do botão Grátis').toBeVisible();

  await gratis.click();
  await page.locator('#alvo-self').click();
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  const entrada = (await personagemSalvo(page)).magias_preparadas.find((m) => m.nome === 'Passos Largos');
  expect(entrada.gratis_usado, 'o uso grátis precisa ser gasto').toBe(true);
  await expect(page.locator('[data-conjurar-gratis="Passos Largos"]')).toHaveCount(0);

  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  if (await page.locator('#btn-pular-troca-dl').isVisible().catch(() => false)) await page.locator('#btn-pular-troca-dl').click();
  await assentar(page).catch(() => {});
  const depois = (await personagemSalvo(page)).magias_preparadas.find((m) => m.nome === 'Passos Largos');
  expect(depois.gratis_usado, 'o Descanso Longo devolve o uso').toBe(false);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Passos Largos: o efeito aparece no campo do Deslocamento, não no da CA', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...ELFO_SILVESTRE,
    efeitos_magicos: [{ nome: 'Passos Largos', tipo: 'deslocamento', tipo_velocidade: 'base_bonus', valor_metros: 3, circulo: 1, rotulo: '+3m deslocamento', concentracao: false }],
  }, 'gratis-passos-largos-lugar');
  await assentar(page).catch(() => {});

  const caixaCA = page.locator('.stat-box', { has: page.locator('.stat-label', { hasText: /^CA$/ }) });
  const caixaDeslocamento = page.locator('.stat-box', { has: page.locator('.stat-label', { hasText: 'Deslocamento' }) });
  await expect(caixaDeslocamento.locator('[data-remover-efeito="Passos Largos"]'),
    'o selo precisa estar na caixa do Deslocamento').toBeVisible();
  await expect(caixaCA.locator('[data-remover-efeito="Passos Largos"]'),
    'e não na da CA').toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Condições: o efeito mostra o nome e o clique explica o que ele faz', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...ELFO_SILVESTRE,
    efeitos_magicos: [{ nome: 'Passos Largos', tipo: 'deslocamento', tipo_velocidade: 'base_bonus', valor_metros: 3, circulo: 1, rotulo: '+3m deslocamento', concentracao: false }],
  }, 'gratis-condicoes-nome');
  await assentar(page).catch(() => {});

  const selo = page.locator('[data-efeito-info="Passos Largos"]');
  await expect(selo).toBeVisible();
  await expect(selo, 'o selo mostra o nome, não o efeito').toHaveText(/^Passos Largos/);
  await expect(selo).not.toContainText('deslocamento');

  await selo.click();
  await expect(page.locator('#modal-titulo')).toContainText('Passos Largos');
  await expect(page.locator('#modal-corpo'), 'o popup explica o efeito').toContainText('+3m deslocamento');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Cartógrafo 3: Fogo das Fadas grátis mostra o contador e desconta ao usar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Artífice', subclasse: 'Cartógrafo', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
    magias_preparadas: [{ nome: 'Fogo das Fadas', circulo: 1, origem: 'sempre', classe: 'Artífice' }],
  }, 'gratis-cartografo-contador');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  const gratis = page.locator('[data-conjurar-gratis="Fogo das Fadas"]');
  await expect(gratis).toBeVisible();
  // Int 13 = +1: um uso por Descanso Longo.
  await expect(gratis, 'o botão informa quantos usos restam').toContainText('1/1');

  const card = page.locator('details', { has: page.locator('summary', { hasText: 'Magia de Mapeamento' }) }).first();
  await expect(card, 'a característica mostra o contador e a recarga').toContainText('1/1');
  await expect(card).toContainText('Descanso Longo');

  await gratis.click();
  await assentar(page).catch(() => {});
  await abrirTudo(page);
  await expect(page.locator('[data-conjurar-gratis="Fogo das Fadas"]'), 'esgotado o único uso, o botão some').toHaveCount(0);
  await expect(card, 'o contador da característica acompanha o gasto').toContainText('0/1');

  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  if (await page.locator('#btn-pular-troca-dl').isVisible().catch(() => false)) await page.locator('#btn-pular-troca-dl').click();
  await assentar(page).catch(() => {});
  await abrirTudo(page);
  await expect(page.locator('[data-conjurar-gratis="Fogo das Fadas"]'), 'o Descanso Longo devolve o uso').toContainText('1/1');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
