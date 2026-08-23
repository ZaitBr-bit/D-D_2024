// ============================================================
// Controles de PV da ficha: Dano, Cura e PV Temporário.
//
// Os três botões de aplicação (`#btn-aplicar-dano`, `#btn-aplicar-cura`,
// `#btn-aplicar-temp`, em site/js/sheet/hp-descanso.js) só existem dentro
// do modal que `#hp-minus`/`#hp-plus`/`#hp-temp` abrem -- nenhum teste de
// unidade os executa, e nenhum spec clicava neles. Aqui cada um é clicado
// de verdade, com o valor digitado no campo manual do seletor numérico,
// como um jogador faria.
//
// PHB 2024, Pontos de Vida (Regras de Jogo): "Quando você sofre dano,
// subtraia-o dos seus Pontos de Vida atuais (...) seus Pontos de Vida
// nunca ficam abaixo de 0"; e "Cura (...) não pode elevar os Pontos de
// Vida de uma criatura acima de seus Pontos de Vida máximos".
//
// PHB 2024, Pontos de Vida Temporários: "Pontos de Vida Temporários NÃO
// são Pontos de Vida de verdade; são um amortecedor (...) Quando você
// sofre dano enquanto tem Pontos de Vida Temporários, o dano é subtraído
// primeiro deles". É a regra mais fácil de implementar errado (somar ao PV
// atual), por isso ela tem dois testes: um que prova que NÃO soma, e outro
// que prova que o dano os consome primeiro.
// ============================================================
import { expect, test } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha, personagemSalvo } from './helpers-regras.mjs';

// Guerreiro nível 3 é a semente marcial mais simples do repositório: sem
// magias, sem escolha pendente, sem painel de recursos que re-renderize a
// ficha por conta própria. Os PV são fixados na semente para que os
// números deste spec não dependam da rolagem de dado de vida.
const PV_MAX = 30;
const SEMENTE = {
  classe: 'Guerreiro', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'Percepção'],
  pv_max: PV_MAX, pv_atual: PV_MAX, pv_temporario: 0,
};

/**
 * Abre um dos modais de PV da ficha (`hp-minus`, `hp-plus`, `hp-temp`),
 * digita o valor no campo manual do seletor numérico e clica no botão de
 * aplicar.
 *
 * O valor NÃO é escolhido rolando a roleta: `numberPickerHtml` monta um
 * `<input type="number" id="<id>-manual">` justamente como caminho
 * alternativo, e o `change` dele grava no `<input type="hidden"
 * id="<id>-val">` que o handler do botão lê. Preencher o campo manual é o
 * caminho de teclado do jogador e o único determinístico -- arrastar a
 * roleta depende de scroll e de `requestAnimationFrame`.
 *
 * A conferência do hidden antes de aplicar existe porque o `scroll` que a
 * roleta dispara também escreve nesse campo: se um dia a ordem mudar, o
 * teste falha AQUI, apontando o seletor, em vez de acusar o botão de dano
 * de ter aplicado o número errado.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} botaoAbre id do botão da ficha que abre o modal
 * @param {string} campo prefixo dos ids do seletor (`input-dano`, ...)
 * @param {string} botaoAplica id do botão de aplicar dentro do modal
 * @param {number} valor valor a digitar
 */
async function aplicarValorPV(page, botaoAbre, campo, botaoAplica, valor) {
  await clicarBotaoFicha(page, botaoAbre, { esperar: `#${botaoAplica}` });
  await page.locator(`#${campo}-manual`).fill(String(valor));
  await page.locator(`#${campo}-manual`).dispatchEvent('change');
  await expect(page.locator(`#${campo}-val`),
    `o seletor numérico deveria ter registrado ${valor}`).toHaveValue(String(valor));
  await page.locator(`#${botaoAplica}`).click();
  await expect(page.locator('#modal-overlay'),
    'o modal deveria fechar depois de aplicar').toBeHidden();
  await assentar(page).catch(() => {});
}

/** Texto do bloco "Pontos de Vida" da ficha ("23 / 30"), sem espaços. */
async function pvNaTela(page) {
  return (await page.locator('.hp-pv-value').first().innerText()).replace(/\s+/g, '');
}

/** Número mostrado no quadro "PV Temporário" da ficha. */
async function tempNaTela(page) {
  return Number((await page.locator('.hp-temp-box .hp-sub-value').innerText()).trim());
}

test('dano: o PV atual cai pelo valor digitado', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, SEMENTE, 'regras-pv-dano');

  expect(await pvNaTela(page), 'a ficha deveria começar com os PV cheios').toBe(`${PV_MAX}/${PV_MAX}`);

  await aplicarValorPV(page, 'hp-minus', 'input-dano', 'btn-aplicar-dano', 7);

  expect((await personagemSalvo(page)).pv_atual,
    'o dano deveria ter sido subtraído do PV atual gravado').toBe(PV_MAX - 7);
  expect(await pvNaTela(page), 'a ficha deveria exibir o PV já reduzido').toBe(`${PV_MAX - 7}/${PV_MAX}`);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('dano: o PV atual não passa de 0, por maior que seja o dano', async ({ context }) => {
  const { page, erros } = await abrirFicha(
    context, { ...SEMENTE, pv_atual: 5 }, 'regras-pv-dano-piso');

  await aplicarValorPV(page, 'hp-minus', 'input-dano', 'btn-aplicar-dano', 40);

  expect((await personagemSalvo(page)).pv_atual,
    'PV atual nunca fica negativo (PHB 2024, Pontos de Vida)').toBe(0);
  expect(await pvNaTela(page), 'a ficha deveria exibir 0, não um número negativo')
    .toBe(`0/${PV_MAX}`);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('cura: o PV atual sobe pelo valor digitado', async ({ context }) => {
  const { page, erros } = await abrirFicha(
    context, { ...SEMENTE, pv_atual: 10 }, 'regras-pv-cura');

  await aplicarValorPV(page, 'hp-plus', 'input-cura', 'btn-aplicar-cura', 8);

  expect((await personagemSalvo(page)).pv_atual,
    'a cura deveria ter sido somada ao PV atual gravado').toBe(18);
  expect(await pvNaTela(page), 'a ficha deveria exibir o PV já curado').toBe(`18/${PV_MAX}`);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('cura: o PV atual não passa do máximo', async ({ context }) => {
  const { page, erros } = await abrirFicha(
    context, { ...SEMENTE, pv_atual: 25 }, 'regras-pv-cura-teto');

  // 25 + 20 = 45, bem acima do máximo de 30.
  await aplicarValorPV(page, 'hp-plus', 'input-cura', 'btn-aplicar-cura', 20);

  expect((await personagemSalvo(page)).pv_atual,
    'cura não eleva o PV acima do máximo (PHB 2024, Cura)').toBe(PV_MAX);
  expect(await pvNaTela(page), 'a ficha deveria exibir o PV no teto')
    .toBe(`${PV_MAX}/${PV_MAX}`);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('PV temporário: é gravado e NÃO soma ao PV atual', async ({ context }) => {
  const { page, erros } = await abrirFicha(
    context, { ...SEMENTE, pv_atual: 20 }, 'regras-pv-temp');

  await aplicarValorPV(page, 'hp-temp', 'input-temp', 'btn-aplicar-temp', 8);

  const salvo = await personagemSalvo(page);
  expect(salvo.pv_temporario, 'os 8 PV temporários deveriam ter sido gravados').toBe(8);
  expect(salvo.pv_atual,
    'PV temporário é amortecedor, não PV de verdade: o PV atual não muda').toBe(20);
  expect(await pvNaTela(page), 'a ficha não deveria somar o temporário ao PV atual')
    .toBe(`20/${PV_MAX}`);
  expect(await tempNaTela(page), 'o quadro de PV Temporário deveria mostrar 8').toBe(8);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('PV temporário: o dano consome o temporário antes do PV atual', async ({ context }) => {
  const { page, erros } = await abrirFicha(
    context, { ...SEMENTE, pv_atual: 20, pv_temporario: 8 }, 'regras-pv-temp-dano');

  expect(await tempNaTela(page), 'a fixture precisa começar com 8 PV temporários').toBe(8);

  // Dano MENOR que o amortecedor: sai inteiro do temporário.
  await aplicarValorPV(page, 'hp-minus', 'input-dano', 'btn-aplicar-dano', 5);
  let salvo = await personagemSalvo(page);
  expect(salvo.pv_temporario, '5 de dano deveriam sair dos 8 temporários').toBe(3);
  expect(salvo.pv_atual, 'com temporário sobrando, o PV atual fica intacto').toBe(20);

  // Dano MAIOR que o resto do amortecedor: zera o temporário e o excedente
  // (6 - 3 = 3) desce para o PV atual.
  await aplicarValorPV(page, 'hp-minus', 'input-dano', 'btn-aplicar-dano', 6);
  salvo = await personagemSalvo(page);
  expect(salvo.pv_temporario, 'o amortecedor deveria ter sido esgotado').toBe(0);
  expect(salvo.pv_atual, 'só o excedente do dano atinge o PV atual').toBe(17);
  expect(await pvNaTela(page), 'a ficha deveria exibir 17 / 30').toBe(`17/${PV_MAX}`);
  expect(await tempNaTela(page), 'o quadro de PV Temporário deveria mostrar 0').toBe(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
