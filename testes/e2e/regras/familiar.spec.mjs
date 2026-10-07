// ============================================================
// Convocar Familiar: ao conjurar (espaço, Ritual ou Pacto da Corrente) abre
// a tela de escolha da forma, com as informações de cada uma; escolhida a
// forma, a ficha ganha o card "Familiar" acima das magias, com PV,
// descartar, reaparecer e dispensar.
//
// Todos CLICAM: o que o dono pediu é o fluxo de conjurar e controlar.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const MAGO = {
  classe: 'Mago', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
  grimorio: [{ nome: 'Convocar Familiar', circulo: 1 }],
  magias_preparadas: [{ nome: 'Convocar Familiar', circulo: 1, classe: 'Mago' }],
};

/** Abre todos os <details> (a ficha nasce com os blocos recolhidos). */
async function abrirTudo(page) {
  await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); });
}

/** Abre a ficha do Mago com a magia na lista e os blocos abertos. */
async function fichaDoMago(context, id) {
  const lado = await abrirFicha(context, MAGO, id);
  await assentar(lado.page).catch(() => {});
  await abrirTudo(lado.page);
  return lado;
}

/** Espaços de 1º círculo gastos, na reserva de conjuração. */
async function gastos1(page) {
  const p = await personagemSalvo(page);
  return Number(p.espacos_magia?.conjuracao?.[1] || 0);
}

test('espaço: a tela de escolha mostra as formas e as informações, e o familiar aparece acima das magias', async ({ context }) => {
  const { page, erros } = await fichaDoMago(context, 'familiar-espaco');
  const antes = await gastos1(page);

  await clicarSeletorFicha(page, '[data-conjurar="Convocar Familiar"]', { esperar: '#btn-confirmar-familiar' });
  const confirmar = page.locator('#btn-confirmar-familiar');
  await expect(confirmar, 'sem forma escolhida não dá para conjurar').toBeDisabled();
  await expect(page.locator('[data-familiar-card]')).not.toHaveCount(0);
  await expect(page.locator('[data-familiar-card="Gato"]')).toBeVisible();
  await expect(page.locator('[data-familiar-card="Diabrete"]'), 'as formas do Pacto não aparecem fora do Pacto').toHaveCount(0);

  // Clicar no nome abre as informações da forma.
  await page.locator('[data-familiar-info="Gato"]').click();
  const popup = page.locator('#familiar-popup-sobreposicao');
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('Gato');
  await expect(popup, 'a ficha técnica traz as ações da criatura').toContainText('Arranhar');
  await page.locator('#btn-fechar-familiar-popup').click();
  await expect(popup, 'fechar o popup mantém a tela de escolha aberta').toHaveCount(0);
  await expect(confirmar).toBeVisible();
  await page.locator('[data-familiar-info="Gato"]').click();
  await page.locator('#btn-escolher-familiar-popup').click();

  await expect(confirmar).toBeEnabled();
  await page.locator('[data-familiar-tipo="Celestial"]').click();
  await confirmar.click();
  await assentar(page).catch(() => {});

  const card = page.locator('#card-familiar');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Gato');
  await expect(card).toContainText('Celestial');
  const posicaoCard = await card.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  const posicaoMagias = await page.locator('.card', { has: page.locator('h2', { hasText: /^Magias$/ }) }).first()
    .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  expect(posicaoCard, 'o card do familiar fica acima das magias').toBeLessThan(posicaoMagias);

  expect(await gastos1(page), 'conjurar pelo espaço gasta um espaço').toBe(antes + 1);
  expect((await personagemSalvo(page)).recursos.familiar).toMatchObject({ forma: 'Gato', tipo: 'Celestial', pv_atual: 2, situacao: 'ativo' });

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('cancelar a escolha não gasta espaço nem cria familiar', async ({ context }) => {
  const { page, erros } = await fichaDoMago(context, 'familiar-cancelar');
  const antes = await gastos1(page);

  await clicarSeletorFicha(page, '[data-conjurar="Convocar Familiar"]', { esperar: '#btn-confirmar-familiar' });
  await page.locator('#modal-acoes').getByRole('button', { name: 'Cancelar' }).click();
  await assentar(page).catch(() => {});

  expect(await gastos1(page)).toBe(antes);
  await expect(page.locator('#card-familiar')).toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Ritual: escolhe a forma e conjura sem gastar espaço', async ({ context }) => {
  const { page, erros } = await fichaDoMago(context, 'familiar-ritual');
  const antes = await gastos1(page);

  await clicarSeletorFicha(page, '[data-conjurar-ritual="Convocar Familiar"]', { esperar: '#btn-confirmar-familiar' });
  await page.locator('[data-familiar-toggle="Coruja"]').click();
  await page.locator('#btn-confirmar-familiar').click();
  await assentar(page).catch(() => {});

  await expect(page.locator('#card-familiar')).toContainText('Coruja');
  expect(await gastos1(page), 'Ritual não gasta espaço').toBe(antes);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

/** Aplica dano ou cura ao familiar pelo modal (o mesmo do personagem). */
async function aplicarPV(page, tipo, valor) {
  await page.locator(`[data-familiar-acao="${tipo}"]`).click();
  const campo = page.locator(`#input-criatura-${tipo}-manual`);
  await campo.fill(valor);
  await campo.blur();
  await page.locator(tipo === 'dano' ? '#btn-aplicar-dano-criatura' : '#btn-aplicar-cura-criatura').click();
}

test('controle: PV, descartar, reaparecer, desaparecer a 0 PV e dispensar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    recursos: { familiar: { forma: 'Gato', tipo: 'Feérico', especial: false, pv_max: 2, pv_atual: 2, situacao: 'ativo' } },
  }, 'familiar-controle');
  await assentar(page).catch(() => {});

  const card = page.locator('#card-familiar');
  await expect(card).toContainText('Gato');

  await aplicarPV(page, 'dano', '1');
  await expect(card).toContainText('PV 1/2');
  await aplicarPV(page, 'cura', '9');
  await expect(card, 'cura limitada ao máximo').toContainText('PV 2/2');
  await aplicarPV(page, 'dano', '1');
  await expect(card).toContainText('PV 1/2');

  await page.locator('[data-familiar-acao="descartar"]').click();
  await expect(card).toContainText('Na mini dimensão');
  await expect(page.locator('[data-familiar-acao="dano"]'), 'na mini dimensão não leva dano').toHaveCount(0);
  await page.locator('[data-familiar-acao="reaparecer"]').click();
  await expect(card).toContainText('Em campo');
  await expect(card, 'os PV se mantêm').toContainText('PV 1/2');

  await aplicarPV(page, 'dano', '5');
  await expect(card).toContainText('Desapareceu');
  await expect(card).toContainText('PV 0/2');

  await page.locator('[data-familiar-acao="dispensar"]').click();
  await page.locator('#btn-confirmar-dispensar-familiar').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#card-familiar')).toHaveCount(0);
  expect((await personagemSalvo(page)).recursos?.familiar).toBeUndefined();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('conjurar de novo troca a forma do familiar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    recursos: { familiar: { forma: 'Gato', tipo: 'Feérico', especial: false, pv_max: 2, pv_atual: 1, situacao: 'ativo' } },
  }, 'familiar-trocar');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  await clicarSeletorFicha(page, '[data-conjurar-ritual="Convocar Familiar"]', { esperar: '#btn-confirmar-familiar' });
  await expect(page.locator('#familiar-selecao')).toContainText('Você já tem um familiar (Gato)');
  await page.locator('[data-familiar-toggle="Morcego"]').click();
  await page.locator('#btn-confirmar-familiar').click();
  await assentar(page).catch(() => {});

  await expect(page.locator('#card-familiar')).toContainText('Morcego');
  await expect(page.locator('#card-familiar'), 'a nova forma nasce com PV cheios').toContainText(/PV 1\/1/);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Pacto da Corrente: as formas especiais aparecem e o tipo é o da própria criatura', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Bruxo', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS, pericias_proficientes: ['Arcanismo', 'Enganação'],
    recursos: { bruxo: { invocacoes: [{ nome: 'Pacto da Corrente' }] } },
  }, 'familiar-pacto');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  await clicarSeletorFicha(page, '[data-conjurar-pacto="Convocar Familiar"]', { esperar: '#btn-confirmar-familiar' });
  await expect(page.locator('[data-familiar-card="Diabrete"]')).toBeVisible();
  await page.locator('[data-familiar-toggle="Diabrete"]').click();
  await expect(page.locator('[data-familiar-tipo]'), 'forma especial não escolhe tipo').toHaveCount(0);
  await page.locator('#btn-confirmar-familiar').click();
  await assentar(page).catch(() => {});

  const card = page.locator('#card-familiar');
  await expect(card).toContainText('Diabrete');
  await expect(card).toContainText('Ínfero');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
