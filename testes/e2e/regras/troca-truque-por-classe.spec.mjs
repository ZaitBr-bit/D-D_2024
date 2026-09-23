// ============================================================
// Achado Important 1 da revisão final (#105/#61): a troca de truque do
// Descanso Longo (mostrarTrocaTruque, sheet/grimorio.js) oferecia como
// SAÍDA os truques trocáveis do personagem INTEIRO, sem filtro de classe, e
// o substituto herdava a `classe` do truque que SAIU -- não da classe da
// troca. Num Mago/Clérigo isso deixava o truque do Mago aparecer no
// seletor "remover" da troca aberta na aba do Clérigo, e trocá-lo gravava o
// substituto como `classe: 'Mago'` (o truque do Clérigo teria virado dono
// do orçamento errado). Este arquivo prova as duas metades do conserto:
// a lista de SAÍDA passa a vir de `truquesPorClasse(char, sup.classe)`
// (`desta` ∪ `semClasse`, nunca `deOutra`), e o carimbo do substituto passa
// a ser `sup.classe` -- a classe da superfície ativa (a troca de truque do
// Descanso Longo nunca recebe `opcoes.classe`, ver troca-descanso-por-
// classe.spec.mjs), não mais herdado da entrada removida.
//
// Nomes medidos em dados/classes/magias_clerigo.json (2026-09-22): "Chama
// Sagrada" e "Orientação" são truques do Clérigo; "Raio de Fogo" é truque
// do Mago (magias_mago.json) e NÃO está na lista do Clérigo.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar, clicarBotaoFicha, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const MAGO_3_CLERIGO_3 = {
  classe: 'Mago', subclasse: '', nivel: 6, xp: 14000,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'Religião'],
  classes: [
    { classe: 'Mago', subclasse: '', nivel: 3, ordem: 0 },
    { classe: 'Clérigo', subclasse: 'Domínio da Vida', nivel: 3, ordem: 1 },
  ],
  schema_versao: 2,
};

/** Troca a superfície ativa da seção Magias da ficha (mesmo helper de preparar-magias-por-classe.spec.mjs). */
async function ativarClasse(page, classe) {
  await clicarSeletorFicha(page, `[data-tab-superficie="${classe}"]`,
    { esperar: `[data-tab-superficie="${classe}"].active` });
  await assentar(page).catch(() => {});
}

test('Mago 3/Clérigo 3: Trocar Truque na aba do Clérigo não oferece o truque do Mago, e o substituto grava classe Clérigo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...MAGO_3_CLERIGO_3,
    magias_conhecidas: [
      { nome: 'Raio de Fogo', circulo: 0, classe: 'Mago' },
      { nome: 'Chama Sagrada', circulo: 0, classe: 'Clérigo' },
    ],
  }, 'regras-troca-truque-classe-1');

  // Ativa a superfície do Clérigo -- a troca de truque do Descanso Longo
  // nunca recebe opcoes.classe (decisão registrada), então quem decide a
  // classe da troca é a superfície ATIVA (superficieAtivaDaFicha).
  await ativarClasse(page, 'Clérigo');

  await clicarBotaoFicha(page, 'btn-descanso-longo', { esperar: '#modal-overlay' });
  await assentar(page).catch(() => {});

  const botaoTruque = page.locator('#btn-trocar-truque-dl');
  await expect(botaoTruque, 'a troca de truque não foi oferecida').toBeVisible();
  await botaoTruque.click();
  await assentar(page).catch(() => {});

  // ACHADO CENTRAL: "Raio de Fogo" (Mago) não pode aparecer no seletor
  // "remover" de uma troca aberta com o Clérigo ativo -- moveria um truque
  // do orçamento do Mago para o do Clérigo em silêncio.
  await expect(page.locator('#troca-truque-remover-lista .opcao-card[data-opcao="Raio de Fogo"]'),
    '"Raio de Fogo" (Mago) não pode aparecer como candidato a sair na troca do Clérigo')
    .toHaveCount(0);
  const cardSaindo = page.locator('#troca-truque-remover-lista .opcao-card[data-opcao="Chama Sagrada"]');
  await expect(cardSaindo, '"Chama Sagrada" (Clérigo) tem de aparecer como candidata a sair').toBeVisible({ timeout: 5000 });
  await cardSaindo.click();
  await assentar(page).catch(() => {});

  const cardEntrando = page.locator('#troca-truque-adicionar-lista .opcao-card[data-opcao="Orientação"]');
  await cardEntrando.waitFor({ state: 'visible', timeout: 5000 });
  await cardEntrando.click();
  await clicarBotaoFicha(page, 'btn-confirmar-troca-truque');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  const truques = salvo?.magias_conhecidas || [];
  const orientacao = truques.find((m) => m.nome === 'Orientação');
  const raioDeFogo = truques.find((m) => m.nome === 'Raio de Fogo');
  expect(orientacao, 'a troca não foi gravada').toBeTruthy();
  expect(orientacao?.classe, 'o substituto tem de gravar a classe DA TROCA (Clérigo), não a herdada do truque que saiu')
    .toBe('Clérigo');
  expect(raioDeFogo?.classe, 'o truque do Mago não pode ter sido tocado pela troca do Clérigo').toBe('Mago');
  expect(truques.some((m) => m.nome === 'Chama Sagrada'), 'Chama Sagrada tinha de sair na troca').toBe(false);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// A MESMA CORREÇÃO, do lado da SUBIDA DE NÍVEL (levelup-ui.js/
// levelup-cards.js/levelup-flow.js): as opções de "Qual truque sai?" do
// card "Trocar Truques (Opcional)" tinham a mesma falta de filtro por
// classe -- liam `ctx.char.magias_conhecidas` inteiro. O carimbo do
// substituto já usava `ctx.classeQueSobe` (levelup-ui.js:2256) mesmo antes
// deste conserto; o defeito era só a lista de SAÍDA oferecer o truque da
// OUTRA classe.
// ============================================================
const CARD_CLASSE = '#levelup-escolha-classe';

/** Radio de uma classe no step de escolha de classe do assistente (mesmo helper de issue105-multiclasse-truques.spec.mjs). */
function radioClasse(page, nome) {
  return page.locator(`${CARD_CLASSE} input[name="classe-que-sobe"][data-classe="${nome}"]`);
}

/** Avança o assistente clicando "Próximo" até um seletor aparecer, ou desiste depois de N tentativas. */
async function avancarAte(page, seletor, tentativas = 12) {
  for (let i = 0; i < tentativas; i++) {
    if (await page.locator(seletor).count()) return true;
    const proximo = page.locator('#btn-step-proximo');
    if (!await proximo.count()) return false;
    await proximo.click();
    await page.waitForTimeout(400);
  }
  return await page.locator(seletor).count() > 0;
}

// Clérigo 4 (não 3): nível 4 concede Aumento no Valor de Atributo (ASI) em
// quase toda classe -- exigiria satisfazer aquele passo obrigatório antes
// de "Confirmar", o que este cenário não mede. Nível 4 -> 5 não tem ASI
// nenhum (mesmo motivo de CLERIGO usar 5 -> 6 em levelup-trocas-
// multiplas.spec.mjs). Subclasse já escolhida (Domínio da Vida, nível 1)
// evita o passo extra "Ordem Divina/Primal".
const MAGO_3_CLERIGO_4 = {
  classe: 'Mago', subclasse: '', nivel: 7, xp: 23000,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'Religião'],
  classes: [
    { classe: 'Mago', subclasse: '', nivel: 3, ordem: 0 },
    { classe: 'Clérigo', subclasse: 'Domínio da Vida', nivel: 4, ordem: 1 },
  ],
  schema_versao: 2,
};

test('Mago 3/Clérigo 4 sobe de nível no Clérigo: o card "Trocar Truques" não oferece o truque do Mago', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...MAGO_3_CLERIGO_4,
    // DUAS candidatas do Clérigo (Chama Sagrada e Taumaturgia) de propósito:
    // com uma só, montarTroca (ui-opcoes.js) entra no caminho `umSo`, que
    // renderiza a opção como card de apresentação SEM `data-opcao` (mesmo
    // achado documentado em trocas-conjurador.spec.mjs) -- o teste mediria
    // outra coisa. "Luz" (Mago) de propósito, NÃO "Raio de Fogo": Luz está
    // nas DUAS listas (medido em magias_mago.json/magias_clerigo.json, ver
    // cabeçalho de preparar-magias-por-classe.spec.mjs) -- é o caso que
    // prova o filtro de verdade. A exibição do card (`truquesAtuaisCompletos
    // = listaMagiasClasse.filter(...)`, levelup-ui.js) já intersecta com a
    // lista do Clérigo por NOME: um truque do Mago com nome que NÃO existe
    // na lista do Clérigo (ex.: "Raio de Fogo") some do card mesmo sem o
    // filtro por classe (`truquesPorClasse`) -- não prova nada. "Luz"
    // aparece nas duas listas, então só o carimbo `classe` (não o nome)
    // pode excluí-la aqui.
    magias_conhecidas: [
      { nome: 'Luz', circulo: 0, classe: 'Mago' },
      { nome: 'Chama Sagrada', circulo: 0, classe: 'Clérigo' },
      { nome: 'Taumaturgia', circulo: 0, classe: 'Clérigo' },
    ],
  }, 'regras-troca-truque-classe-levelup');

  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false }), 'o assistente não abriu').toBe(true);
  await radioClasse(page, 'Clérigo').click();
  await expect(page.locator(CARD_CLASSE)).toHaveAttribute('data-classe-ctx', 'Clérigo');
  await assentar(page).catch(() => {});

  // O card "Trocar Truques (Opcional)" vive dentro do step "Seleção de
  // Magias" (levelup-flow.js, id 'selecao_magias'); avança até ele existir.
  await avancarAte(page, '#levelup-troca-truque');
  const cardTroca = page.locator('#levelup-troca-truque');
  await expect(cardTroca, 'o card de troca de truque não apareceu para o Clérigo').toHaveCount(1, { timeout: 5000 });
  // Issue #90: o card nasce dentro de um <details> minimizado -- clique real
  // no <summary> para revelar o conteúdo antes de medir visibilidade.
  await page.locator('details:has(#levelup-troca-truque) > summary').click();
  await assentar(page).catch(() => {});
  await expect(cardTroca, 'o card de troca de truque não ficou visível após expandir').toBeVisible({ timeout: 5000 });

  // ACHADO CENTRAL: "Luz" (Mago, mas presente nas duas listas) não pode ser
  // oferecida para SAIR numa subida que está entrando no Clérigo -- moveria
  // o truque do orçamento do Mago para o do Clérigo em silêncio.
  await expect(cardTroca.locator('.opcao-card[data-opcao="Luz"]'),
    '"Luz" (Mago) não pode aparecer como candidata a sair na subida do Clérigo, mesmo estando ' +
    'também na lista do Clérigo')
    .toHaveCount(0);
  const cardSaindo = cardTroca.locator('.opcao-card[data-opcao="Chama Sagrada"]');
  await expect(cardSaindo, '"Chama Sagrada" (Clérigo) tem de aparecer como candidata a sair').toBeVisible({ timeout: 5000 });
  await cardSaindo.click();
  await assentar(page).catch(() => {});
  await cardTroca.locator('.opcao-card[data-opcao="Orientação"]').click();
  await assentar(page).catch(() => {});

  // Conclui a subida de nível -- mesma disciplina de levelup-trocas-multiplas.spec.mjs.
  for (let i = 0; i < 12; i++) {
    const confirmar = page.locator('#btn-confirmar-levelup');
    if (await confirmar.count()) { await confirmar.click(); break; }
    const proximo = page.locator('#btn-step-proximo');
    if (!await proximo.count()) break;
    await proximo.click();
    await page.waitForTimeout(400);
  }
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  const truques = salvo?.magias_conhecidas || [];
  const orientacao = truques.find((m) => m.nome === 'Orientação');
  const luz = truques.find((m) => m.nome === 'Luz');
  expect(orientacao, 'a troca não foi aplicada').toBeTruthy();
  expect(orientacao?.classe, 'o substituto tem de gravar ctx.classeQueSobe (Clérigo)').toBe('Clérigo');
  expect(luz?.classe, 'o truque do Mago não pode ter sido tocado pela subida do Clérigo').toBe('Mago');
  expect(truques.some((m) => m.nome === 'Chama Sagrada'), 'Chama Sagrada tinha de sair na troca').toBe(false);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
