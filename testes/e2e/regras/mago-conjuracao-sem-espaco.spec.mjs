// ============================================================
// Maestria de Magias (nível 18) e Assinatura Mágica (nível 20): conjurar
// SEM gastar espaço continua sendo CONJURAR.
//
// PHB 2024, Classes.md -- Maestria de Magias: "você pode conjurar essas
// magias no círculo mais baixo, sem gastar um espaço de magia"; Assinatura
// Mágica: "você pode conjurar cada uma delas uma vez sem gastar um espaço
// de magia". O que a regra dispensa é o ESPAÇO -- nada mais.
//
// O defeito relatado (2026-08-19): clicar em "Armadura Arcana" na Maestria
// de Magias só emitia o toast "conjurada no 1º círculo sem gastar espaço" e
// a CA da ficha não mudava. Os dois botões nunca passavam pelo motor de
// efeitos (`aplicarEfeitoMagico`) que a conjuração normal usa -- valia para
// qualquer magia com efeito mecânico (Armadura Arcana, Escudo Arcano,
// Invisibilidade, ...), não só a que o jogador testou.
//
// O par de testes mede as duas metades da regra ao mesmo tempo: o efeito
// PRECISA acontecer, e o espaço NÃO pode ser gasto. Sem a segunda metade,
// "chamar a conjuração normal" passaria no teste e cobraria o espaço que o
// livro dispensa.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

// Armadura Arcana: MAGIAS_EFEITO diz `CA = 13 + Des`. Com Destreza 14 (+2)
// e sem armadura, a CA sai de 12 (10 + Des) para 15.
const CA_SEM_MAGIA = 12;
const CA_COM_ARMADURA_ARCANA = 15;

const MAGO_18 = {
  classe: 'Mago', nivel: 18, xp: 265000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
  recursos: { mago: { maestria_magias: { c1: 'Armadura Arcana', c2: 'Invisibilidade' } } },
};

const MAGO_20 = {
  classe: 'Mago', nivel: 20, xp: 355000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
  recursos: { mago: { assinaturas: { m1: 'Armadura Arcana', m2: 'Dissipar Magia' } } },
};

/** CA exibida no card da ficha. */
async function caExibida(page) {
  return page.evaluate(() => {
    const card = [...document.querySelectorAll('.stat-card, .card, div')]
      .find(el => el.children?.length && /^CA$/i.test(el.querySelector('div,span')?.textContent?.trim() || ''));
    return card ? Number(card.textContent.replace(/[^\d]/g, '')) : null;
  });
}

/** Soma dos espaços de magia gastos, de todos os círculos, no personagem salvo. */
async function espacosGastos(page) {
  const p = await personagemSalvo(page);
  return Object.values(p?.espacos_magia || {}).reduce((total, e) => total + (e?.usados || 0), 0);
}

/** Abre os `<details>` e devolve o texto da ficha -- reaberto a cada leitura. */
function textoDaFichaAberta(page) {
  return page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
    return document.body.innerText;
  });
}

test('Maestria de Magias: Armadura Arcana conjurada de graça altera a CA', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_18, 'regras-mago-maestria-ca');
  await assentar(page).catch(() => {});

  // GUARDA CONTRA VACUIDADE: sem o botão da Maestria não há o que clicar, e
  // "a CA não mudou" acusaria a regra errada.
  const botao = page.locator('[data-mago-acao="maestria-1"]').first();
  await expect(botao, 'o Mago de nível 18 precisa ter o botão da Maestria de Magias')
    .toBeVisible();

  expect(await caExibida(page), 'a CA de partida precisa ser a do Mago sem magia nenhuma')
    .toBe(CA_SEM_MAGIA);
  const gastosAntes = await espacosGastos(page);

  await botao.click();
  // Armadura Arcana pode ser lançada em si ou em outra criatura -- a mesma
  // pergunta que a conjuração normal faz.
  await page.locator('#alvo-self').click();

  await expect(page.locator('#toast-container'),
    'a conjuração precisa ter acontecido antes de medir a CA')
    .toContainText('sem gastar espaço');
  await assentar(page).catch(() => {});

  await expect.poll(() => caExibida(page), {
    message: 'Armadura Arcana dá CA = 13 + Destreza; conjurá-la pela Maestria de Magias tem de '
      + 'mexer na CA exatamente como a conjuração normal mexe',
  }).toBe(CA_COM_ARMADURA_ARCANA);

  expect(await espacosGastos(page),
    'a Maestria de Magias dispensa o ESPAÇO -- se o número subiu, a correção passou a cobrar '
    + 'o que o livro isenta')
    .toBe(gastosAntes);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Assinatura Mágica: a conjuração de graça aplica o efeito e queima o uso', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_20, 'regras-mago-assinatura-ca');
  await assentar(page).catch(() => {});

  const botao = page.locator('[data-mago-acao="assinatura-1"]').first();
  await expect(botao, 'o Mago de nível 20 precisa ter o botão da Assinatura Mágica')
    .toBeVisible();

  expect(await caExibida(page), 'a CA de partida precisa ser a do Mago sem magia nenhuma')
    .toBe(CA_SEM_MAGIA);
  const gastosAntes = await espacosGastos(page);

  await botao.click();
  await page.locator('#alvo-self').click();

  await expect(page.locator('#toast-container'),
    'a conjuração precisa ter acontecido antes de medir a CA')
    .toContainText('sem gastar espaço');
  await assentar(page).catch(() => {});

  await expect.poll(() => caExibida(page), {
    message: 'a Assinatura Mágica também é conjuração: o efeito da magia tem de valer',
  }).toBe(CA_COM_ARMADURA_ARCANA);

  expect(await espacosGastos(page), 'a Assinatura Mágica não gasta espaço de magia')
    .toBe(gastosAntes);

  // O uso é 1x por descanso: sem queimá-lo, o "de graça" seria ilimitado.
  const salvo = await personagemSalvo(page);
  expect(salvo?.recursos?.mago?.assinatura_magia_1_usada,
    'a Assinatura Mágica vale uma vez por descanso -- o uso tem de ficar gravado como gasto')
    .toBe(true);
  await expect.poll(() => textoDaFichaAberta(page), {
    message: 'e a ficha precisa mostrar a assinatura como usada',
  }).toContain('(usada)');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
