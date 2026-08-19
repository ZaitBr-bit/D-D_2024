// ============================================================
// Item customizado: campo "CA Base" -- o item que DEFINE a CA.
//
// O campo "Bônus CA" sempre SOMOU (utils.js), e é isso que ele deve fazer.
// Mas o item que a mesa inventa costuma vir escrito como a armadura do livro
// vem: "Armadura Negra de Hades /Lendária /CA 20" -- um número que SUBSTITUI
// a CA, não que se soma a ela. Digitado no campo de bônus, isso virava
// 12 + 20 = 32.
//
// Semântica escolhida (2026-08-19), e o motivo de cada metade:
//
//   - PISO, e não substituição cega: "esta armadura dá CA 20" nunca quer
//     dizer "e piora a sua CA se ela já for maior". Um item de CA base
//     menor que a CA atual não abaixa nada.
//   - NÃO soma Destreza: o número digitado é a CA, como nas armaduras
//     Pesadas do livro. Quem quiser Destreza tem o campo de bônus.
//   - Escudo, Estilo de Luta Defensivo, bônus de itens e efeitos mágicos
//     continuam somando POR CIMA, exatamente como somam sobre a armadura
//     do livro.
//   - O app NÃO assume que o item é armadura: não desliga a Defesa sem
//     Armadura do Bárbaro/Monge nem liga o Defensivo. Item customizado não
//     tem tipo -- "CA 20" tanto pode ser peitoral quanto amuleto -- e o
//     piso já dá o número certo nos dois casos.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

// Guerreiro sem armadura: CA = 10 + Destreza (14 → +2) = 12.
const CA_SEM_NADA = 12;
const CA_BASE_ITEM = 20;

const GUERREIRO = {
  classe: 'Guerreiro', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
};

/** Monta um item customizado com os campos que o formulário grava. */
function itemCustom(dados, { equipado = true, nome = 'Armadura Negra de Hades' } = {}) {
  return {
    nome, tipo: 'customizado', quantidade: 1, equipado, descricao: 'Lendária',
    dados: { bonus_ca: '0', ca_base: '', dano: '', bonus_ataque: '0', peso: '', ...dados },
  };
}

/** CA exibida no card da ficha. */
async function caExibida(page) {
  return page.evaluate(() => {
    const rotulo = [...document.querySelectorAll('.stat-label')]
      .find(el => el.textContent.trim() === 'CA');
    const valor = rotulo?.parentElement?.querySelector('.stat-value')?.textContent;
    return valor ? Number(valor.trim()) : null;
  });
}

test('item customizado: o campo CA Base é gravado pelo formulário da ficha', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-item-ca-base-form');
  await assentar(page).catch(() => {});

  await page.click('#btn-add-inv-custom');
  await page.waitForSelector('#ic-nome', { state: 'visible', timeout: 20_000 });

  // GUARDA CONTRA VACUIDADE: o campo tem de existir na tela antes de
  // qualquer afirmação sobre o que ele grava.
  await expect(page.locator('#ic-ca-base'),
    'o formulário de item customizado precisa oferecer onde declarar a CA que o item DEFINE, '
    + 'separada do bônus que ele SOMA')
    .toBeVisible();

  await page.fill('#ic-nome', 'Armadura Negra de Hades');
  await page.fill('#ic-ca-base', String(CA_BASE_ITEM));
  await page.click('#btn-add-ic');

  await expect(page.locator('#toast-container'), 'o item precisa ter sido adicionado')
    .toContainText('adicionado');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  const item = (salvo?.inventario || []).find(i => i.nome === 'Armadura Negra de Hades');
  expect(item, 'o item precisa estar no personagem salvo').toBeTruthy();
  expect(String(item.dados?.ca_base), 'a CA base digitada tem de ser gravada em campo próprio')
    .toBe(String(CA_BASE_ITEM));
  expect(parseInt(item.dados?.bonus_ca) || 0,
    'declarar CA base não pode contaminar o campo de bônus -- são coisas diferentes')
    .toBe(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('CA Base equipada DEFINE a CA, em vez de somar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...GUERREIRO, inventario: [itemCustom({ ca_base: String(CA_BASE_ITEM) })],
  }, 'regras-item-ca-base-define');
  await assentar(page).catch(() => {});

  await expect.poll(() => caExibida(page), {
    message: `"CA 20" quer dizer CA 20 -- não ${CA_SEM_NADA} + ${CA_BASE_ITEM}, que é o que `
      + 'aconteceria se o número tivesse ido para o campo de bônus',
  }).toBe(CA_BASE_ITEM);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('CA Base não engole o que soma por cima: escudo e bônus continuam valendo', async ({ context }) => {
  // O contraste que separa "piso" de "valor final": se a CA base fosse a
  // palavra final, escudo e bônus deixariam de contar e ninguém entenderia
  // por que o escudo parou de fazer efeito.
  const { page, erros } = await abrirFicha(context, {
    ...GUERREIRO,
    inventario: [
      itemCustom({ ca_base: String(CA_BASE_ITEM), bonus_ca: '1' }),
      { nome: 'Escudo', tipo: 'escudo', quantidade: 1, equipado: true, dados: { ca: '+2' } },
    ],
  }, 'regras-item-ca-base-soma-por-cima');
  await assentar(page).catch(() => {});

  await expect.poll(() => caExibida(page), {
    message: 'CA base 20, mais o escudo (+2) e o bônus do próprio item (+1) = 23',
  }).toBe(CA_BASE_ITEM + 3);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('CA Base menor que a CA atual não abaixa a CA', async ({ context }) => {
  // Cota de Malha dá CA 16 fixa. Um item de CA base 12 equipado junto não
  // pode PIORAR a defesa: "este item dá CA 12" não é "você agora tem 12".
  const { page, erros } = await abrirFicha(context, {
    ...GUERREIRO,
    inventario: [
      { nome: 'Cota de Malha', tipo: 'armadura', quantidade: 1, equipado: true,
        dados: { ca: '16', categoria: 'Pesada' } },
      itemCustom({ ca_base: '12' }, { nome: 'Amuleto de Hades' }),
    ],
  }, 'regras-item-ca-base-piso');
  await assentar(page).catch(() => {});

  await expect.poll(() => caExibida(page), {
    message: 'a CA base do item é um PISO, não uma substituição cega -- 16 continua sendo 16',
  }).toBe(16);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('CA Base na mochila não vale nada -- o contraste', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...GUERREIRO,
    inventario: [itemCustom({ ca_base: String(CA_BASE_ITEM) }, { equipado: false })],
  }, 'regras-item-ca-base-nao-equipado');
  await assentar(page).catch(() => {});

  await expect.poll(() => caExibida(page), {
    message: 'armadura guardada não protege ninguém: sem equipar, a CA base não vale',
  }).toBe(CA_SEM_NADA);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
