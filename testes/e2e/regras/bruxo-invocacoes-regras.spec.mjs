// ============================================================
// Invocações Místicas com regra própria: uso limitado, condição, PV
// temporários máximos, truque modificado com números e as ações das
// invocações do Pacto da Lâmina e do Pacto do Tomo.
//
// Todos CLICAM: o que o dono pediu é poder usar cada invocação na ficha, e
// só o clique mede isso.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const BRUXO_5 = {
  classe: 'Bruxo', nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'Enganação'],
};
const BRUXO_9 = { ...BRUXO_5, nivel: 9, xp: 48000 };

/** Abre a ficha do Bruxo com as invocações dadas e abre todos os <details>. */
async function bruxoCom(context, base, invocacoes, id) {
  const lado = await abrirFicha(context, {
    ...base, recursos: { bruxo: { invocacoes } },
  }, id);
  await assentar(lado.page).catch(() => {});
  await lado.page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  return lado;
}

test('Presente das Profundezas: o uso grátis de Respirar na Água é 1 por Descanso Longo', async ({ context }) => {
  const { page, erros } = await bruxoCom(context, BRUXO_5, [{ nome: 'Presente das Profundezas' }], 'inv-regra-profundezas');

  const botao = page.locator('[data-conjurar-pacto="Respirar na Água"]');
  await expect(botao, 'a magia da invocação precisa ter botão').toHaveCount(1);
  await expect(botao).toBeEnabled();
  await botao.click();
  await assentar(page).catch(() => {});

  const depois = page.locator('[data-conjurar-pacto="Respirar na Água"]');
  await expect(depois, 'depois do uso grátis o botão precisa ficar desabilitado').toBeDisabled();
  expect((await personagemSalvo(page)).recursos.bruxo.invocacoes_usos.presente_profundezas).toBe(true);

  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  if (await page.locator('#btn-pular-troca-dl').isVisible().catch(() => false)) await page.locator('#btn-pular-troca-dl').click();
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).recursos.bruxo.invocacoes_usos.presente_profundezas,
    'o Descanso Longo devolve o uso').toBe(false);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Vigor Ínfero: a Vitalidade Vazia dá o máximo do dado (12 PV temporários)', async ({ context }) => {
  const { page, erros } = await bruxoCom(context, BRUXO_5, [{ nome: 'Vigor Ínfero' }], 'inv-regra-vigor');

  await page.locator('[data-conjurar-pacto="Vitalidade Vazia"]').click();
  await assentar(page).catch(() => {});

  expect((await personagemSalvo(page)).pv_temporario,
    '2d4+4 no máximo = 12, e não a média 9').toBe(12);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Uno com as Sombras: pede a confirmação de Meia-luz/Escuridão antes de conjurar', async ({ context }) => {
  const { page, erros } = await bruxoCom(context, BRUXO_5, [{ nome: 'Uno com as Sombras' }], 'inv-regra-uno');

  await page.locator('[data-conjurar-pacto="Invisibilidade"]').click();
  await expect(page.locator('#btn-confirmar-condicao-invocacao'),
    'a condição de luz precisa ser confirmada').toBeVisible();
  expect(((await personagemSalvo(page)).efeitos_magicos || []).some((e) => e.nome === 'Invisibilidade'),
    'sem confirmar, nada é conjurado').toBe(false);

  await page.locator('#btn-confirmar-condicao-invocacao').click();
  await page.locator('#alvo-self').click();
  await assentar(page).catch(() => {});
  expect(((await personagemSalvo(page)).efeitos_magicos || []).some((e) => e.nome === 'Invisibilidade'),
    'confirmada a condição, a magia é conjurada').toBe(true);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Explosão Agonizante e Lança Mística: a marca do truque traz os números do personagem', async ({ context }) => {
  const { page, erros } = await bruxoCom(context, BRUXO_5, [
    { nome: 'Explosão Agonizante', truque: 'Raio Místico' },
    { nome: 'Lança Mística', truque: 'Raio Místico' },
  ], 'inv-regra-truques');

  const corpo = page.locator('body');
  await expect(corpo).toContainText(/[+−]\d+ ao dano \(modificador de Carisma\)/);
  await expect(corpo, 'alcance base + 9 m por nível de Bruxo (nível 5 = +45 m)')
    .toContainText('Alcance 36 m → 81 m');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Punição Mística: gasta um espaço de Pacto e rola o dano', async ({ context }) => {
  const { page, erros } = await bruxoCom(context, BRUXO_5, [
    { nome: 'Pacto da Lâmina' }, { nome: 'Punição Mística' },
  ], 'inv-regra-punicao');

  const gastos = async () => Object.values((await personagemSalvo(page)).espacos_magia?.pacto || {})
    .reduce((s, n) => s + (Number(n) || 0), 0);
  const antes = await gastos();

  await clicarSeletorFicha(page, '[data-bruxo-invocacao-acao="punicao-mistica"]', { esperar: '#btn-confirmar-punicao-mistica' });
  await clicarSeletorFicha(page, '#btn-confirmar-punicao-mistica');
  await assentar(page).catch(() => {});

  await expect(page.locator('#modal-corpo')).toContainText('de dano Energético');
  expect(await gastos(), 'um espaço de Pacto precisa ser gasto').toBe(antes + 1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Sorvedouro de Vida: rola o dano e gasta um Dado de Vida para curar', async ({ context }) => {
  const { page, erros } = await bruxoCom(context, BRUXO_9, [
    { nome: 'Pacto da Lâmina' }, { nome: 'Sorvedouro de Vida' },
  ], 'inv-regra-sorvedouro');

  await clicarSeletorFicha(page, '[data-bruxo-invocacao-acao="sorvedouro-vida"]', { esperar: '#btn-confirmar-sorvedouro' });
  await page.locator('#sorvedouro-curar').check();
  await clicarSeletorFicha(page, '#btn-confirmar-sorvedouro');
  await assentar(page).catch(() => {});

  const corpo = page.locator('#modal-corpo');
  await expect(corpo).toContainText('de dano');
  await expect(corpo, 'gastar o Dado de Vida precisa curar').toContainText('Cura:');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Presente dos Protetores: escreve nomes até o limite e marca o disparo', async ({ context }) => {
  const { page, erros } = await bruxoCom(context, BRUXO_9, [
    { nome: 'Pacto do Tomo' }, { nome: 'Presente dos Protetores' },
  ], 'inv-regra-protetores');

  await clicarSeletorFicha(page, '[data-bruxo-invocacao-acao="protetores-nomes"]', { esperar: '#btn-protetores-adicionar' });
  await page.locator('#protetores-novo').fill('Aldric');
  await page.locator('#btn-protetores-adicionar').click();
  await expect(page.locator('#protetores-corpo')).toContainText('Aldric');
  await page.locator('#btn-fechar-protetores').click();
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).recursos.bruxo.protetores_nomes).toEqual(['Aldric']);

  await clicarSeletorFicha(page, '[data-bruxo-invocacao-acao="protetores-disparo"]');
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).recursos.bruxo.invocacoes_usos.protetores).toBe(true);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
