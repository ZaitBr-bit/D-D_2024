// ============================================================
// Ilusões Aprimoradas (Mago, Ilusionista, nível 3) na TELA.
//
// PHB 2024, Classes.md:5074: "Você também conhece o truque *Ilusão Menor*.
// Se já o conhece, você aprende um truque de Mago diferente à sua escolha.
// O truque não conta para o seu número de truques conhecidos."
//
// A issue #30 relatou o silêncio: quem chegava ao nível 3 já conhecendo
// Ilusão Menor não ganhava truque nenhum, e a subclasse não gravava nada --
// então trocar depois a Ilusão Menor da outra fonte deixava o personagem sem
// ela por completo. A segunda frase da regra nunca existiu no código.
//
// O motor de unidade (testes/regras/unidade/ilusionista-truque-substituto.
// test.mjs) já confronta a tabela, a gravação e `subirDeNivel`. O que só o
// navegador prova é o encadeamento da TELA: o card nasce reativo à subclasse
// escolhida NESTA sessão, a lista de truques de Mago chega DEPOIS (por
// promessa, dentro de um seletor que já está na página), e o que se escolhe
// nele tem de chegar ao personagem salvo e à ficha.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar, personagemSalvo } from './helpers-regras.mjs';

// Mago nível 2 que JÁ conhece Ilusão Menor -- e a conhece pela via mais
// difícil de detectar: escolhida como truque de classe, SEM ORIGEM NENHUMA
// (é assim que levelup-ui.js e sheet/grimorio.js gravam um truque escolhido
// da tabela). Um predicado escrito sobre `origem` deixaria este caso passar.
// A subclasse é escolhida NESTA sessão: o nível 3 é onde ela nasce.
//
// `Luz` e `Mãos Mágicas` completam os 3 truques que a tabela do Mago dá até
// o nível 3 -- estão aqui para o seletor do substituto ter de excluir mais
// de um nome, e não só a Ilusão Menor.
const MAGO_NIVEL_2 = {
  classe: 'Mago', nivel: 2, xp: 355000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
  magias_conhecidas: [
    { nome: 'Ilusão Menor', circulo: 0 },
    { nome: 'Luz', circulo: 0 },
    { nome: 'Mãos Mágicas', circulo: 0 },
  ],
};

// Sondas conferidas contra dados/classes/magias_mago.json.
const TRUQUE_DA_CARACTERISTICA = 'Ilusão Menor';   // o que a subclasse concederia
const SUBSTITUTO = 'Talho Mental';                 // truque de Mago que ele NÃO conhece
const TRUQUE_JA_CONHECIDO = 'Luz';                 // truque de Mago que ele já tem
const TRUQUE_FORA_DA_LISTA_DE_MAGO = 'Arte Druídica'; // truque de Druida, fora da lista

/** Clica em "Próximo" e espera o modal reagir. Devolve false se o botão sumiu. */
async function proximo(page) {
  const botao = page.locator('#btn-step-proximo');
  if (!await botao.count()) return false;
  await botao.click();
  await assentar(page).catch(() => {});
  return true;
}

/**
 * Escolhe `quantidade` itens no grid de seleção de magias que o botão
 * `idBotao` abre. O grupo do círculo nasce FECHADO (só truques abrem
 * sozinhos -- ver abrirGridSelecao, levelup-ui.js), então o `<details>`
 * precisa ser aberto antes, como o jogador faria.
 */
async function escolherNoGrid(page, idBotao, quantidade) {
  await page.locator(`#${idBotao}`).click();
  await assentar(page).catch(() => {});
  const grupos = page.locator('#grid-magias details[data-grid-circulo] summary');
  const total = await grupos.count();
  for (let i = 0; i < total; i++) await grupos.nth(i).click();
  await assentar(page).catch(() => {});
  const candidatas = page.locator('#grid-magias [data-grid-nome]');
  await expect(candidatas.first()).toBeVisible();
  const nomes = (await candidatas.evaluateAll((els) => els.map((el) => el.dataset.gridNome)))
    .slice(0, quantidade);
  expect(nomes.length, `o grid de ${idBotao} não ofereceu ${quantidade} opção(ões)`)
    .toBe(quantidade);
  for (const nome of nomes) {
    await page.locator(`#grid-magias [data-grid-check="${nome}"]`).click();
  }
  await page.locator('.sub-modal-overlay button', { hasText: 'Confirmar Seleção' }).click();
  await assentar(page).catch(() => {});
  return nomes;
}

test('level-up: o Ilusionista que já conhece Ilusão Menor escolhe um truque de Mago substituto, e ele fica gravado', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_NIVEL_2, 'regras-ilusionista-substituto');
  expect(await abrirModalLevelUp(page)).toBe(true);

  // Ganhos do nível -> subclasse. O card do truque substituto só pode
  // aparecer depois desta escolha: no nível 3 a subclasse está sendo
  // escolhida NESTA sessão e ainda não existe no personagem salvo.
  await proximo(page);
  const cardSubclasse = page.locator('[data-subclasse="Ilusionista"]');
  await expect(cardSubclasse).toBeVisible();
  await cardSubclasse.click();
  await assentar(page).catch(() => {});

  const seletor = page.locator('[data-subclasse-escolha="subclasse_truque_substituto"]');
  for (let i = 0; i < 4 && !(await seletor.count()); i++) {
    if (!await proximo(page)) break;
  }
  await expect(seletor,
    'quem já conhece Ilusão Menor tem de ganhar o seletor do truque substituto -- ' +
    'sem ele o nível termina sem truque nenhum, que é a issue #30')
    .toHaveCount(1);
  await expect(page.locator('.levelup-card-header', { hasText: 'Ilusões Aprimoradas' }))
    .toBeVisible();

  // A lista chega por promessa depois do HTML: espera a opção real, não um
  // timeout fixo. Sem o carregamento assíncrono o seletor fica para sempre
  // com a única linha "Carregando…".
  await expect(seletor.locator(`option[value="${SUBSTITUTO}"]`),
    `${SUBSTITUTO} é truque de Mago e o personagem não o conhece -- deveria estar na lista`)
    .toHaveCount(1);

  // As duas fronteiras da regra, medidas na TELA: "um truque de MAGO" e
  // "DIFERENTE" (nem o que a característica concederia, nem outro que ele
  // já tenha -- escolhê-los gastaria a característica sem conceder nada).
  await expect(seletor.locator(`option[value="${TRUQUE_FORA_DA_LISTA_DE_MAGO}"]`),
    `${TRUQUE_FORA_DA_LISTA_DE_MAGO} não está na lista de Mago`)
    .toHaveCount(0);
  await expect(seletor.locator(`option[value="${TRUQUE_DA_CARACTERISTICA}"]`),
    `${TRUQUE_DA_CARACTERISTICA} é justamente o truque que ele já conhece -- o livro manda ` +
    'aprender um DIFERENTE')
    .toHaveCount(0);
  await expect(seletor.locator(`option[value="${TRUQUE_JA_CONHECIDO}"]`),
    `${TRUQUE_JA_CONHECIDO} já está em magias_conhecidas e continuou sendo oferecido`)
    .toHaveCount(0);

  // O gesto do jogador num <select> nativo (um clique cru não seleciona
  // opção em <select> no Chromium): dispara o mesmo evento `change` que o
  // bind de levelup-ui.js escuta.
  await seletor.selectOption(SUBSTITUTO);
  await assentar(page).catch(() => {});

  // O nível 3 do Mago também exige o Grimório (+2) e as 2 magias de Ilusão
  // de "Versado em Ilusão": passos obrigatórios, e sem eles a recusa da
  // confirmação seria por outro motivo.
  await proximo(page);
  await expect(page.locator('#btn-lvlup-grimorio')).toBeVisible();
  await escolherNoGrid(page, 'btn-lvlup-grimorio', 2);
  await expect(page.locator('#lvlup-grimorio-resumo')).toContainText('2/2');
  await escolherNoGrid(page, 'btn-lvlup-subclasse-arcana', 2);
  await expect(page.locator('#lvlup-subclasse-arcana-resumo')).toContainText('2/2');

  // Revisão e confirmação.
  for (let i = 0; i < 4; i++) {
    if (await page.locator('#btn-confirmar-levelup').count()) break;
    if (!await proximo(page)) break;
  }
  await expect(page.locator('#btn-confirmar-levelup')).toBeVisible();
  await page.locator('#btn-confirmar-levelup').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-confirmar-levelup'),
    'a subida não concluiu mesmo com o truque substituto escolhido')
    .toHaveCount(0);

  const salvo = await personagemSalvo(page);
  expect(salvo.nivel, 'o nível deveria ter subido para 3').toBe(3);

  const conhecidos = new Map((salvo.magias_conhecidas || []).map((m) => [m.nome, m]));
  // O truque escolhido é o ganho da característica: entra em
  // magias_conhecidas com a MESMA origem da concessão automática, que é a
  // que regras-origens-magia.js isenta do limite de truques da classe --
  // "O truque não conta para o seu número de truques conhecidos".
  expect(conhecidos.get(SUBSTITUTO),
    `${SUBSTITUTO} foi escolhido na tela e não chegou ao personagem salvo`)
    .toMatchObject({ circulo: 0, origem: 'subclasse_automatica' });
  // E a Ilusão Menor que ele já tinha continua intacta, com a origem dela.
  expect(conhecidos.get(TRUQUE_DA_CARACTERISTICA),
    `${TRUQUE_DA_CARACTERISTICA} não pode ter sido tocada pela subclasse`)
    .toMatchObject({ circulo: 0 });

  // Na FICHA montada do ZERO a partir do personagem salvo -- o que o jogador
  // vê ao voltar, e não um resto de render que sobrou do modal.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar(page).catch(() => {});
  await expect(page.locator(`[data-lancar-truque="${SUBSTITUTO}"]`),
    `${SUBSTITUTO} deveria aparecer na seção de Truques da ficha`)
    .toHaveCount(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('level-up: o Ilusionista que NÃO conhece Ilusão Menor não recebe seletor nenhum, e ganha o truque de graça', async ({ context }) => {
  // O converso: o livro só manda escolher a quem JÁ conhece o truque.
  // Perguntar aos demais cobraria uma decisão que o livro não prevê.
  const semIlusaoMenor = {
    ...MAGO_NIVEL_2,
    magias_conhecidas: [
      { nome: 'Luz', circulo: 0 },
      { nome: 'Mãos Mágicas', circulo: 0 },
      { nome: 'Trovão', circulo: 0 },
    ],
  };
  const { page, erros } = await abrirFicha(context, semIlusaoMenor, 'regras-ilusionista-automatico');
  expect(await abrirModalLevelUp(page)).toBe(true);

  await proximo(page);
  await page.locator('[data-subclasse="Ilusionista"]').click();
  await assentar(page).catch(() => {});

  // Vai até o passo de magias, passando pelo passo das escolhas de
  // classe/subclasse -- e ali o seletor do substituto não pode existir.
  for (let i = 0; i < 4; i++) {
    await expect(page.locator('[data-subclasse-escolha="subclasse_truque_substituto"]'),
      'o seletor apareceu para quem ainda não conhece Ilusão Menor')
      .toHaveCount(0);
    if (await page.locator('#btn-lvlup-grimorio').count()) break;
    if (!await proximo(page)) break;
  }

  await escolherNoGrid(page, 'btn-lvlup-grimorio', 2);
  await escolherNoGrid(page, 'btn-lvlup-subclasse-arcana', 2);

  for (let i = 0; i < 4; i++) {
    if (await page.locator('#btn-confirmar-levelup').count()) break;
    if (!await proximo(page)) break;
  }
  await page.locator('#btn-confirmar-levelup').click();
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo.nivel).toBe(3);
  const conhecidos = new Map((salvo.magias_conhecidas || []).map((m) => [m.nome, m]));
  expect(conhecidos.get(TRUQUE_DA_CARACTERISTICA),
    'a primeira frase da regra continua valendo: o truque é concedido sem perguntar')
    .toMatchObject({ circulo: 0, origem: 'subclasse_automatica' });

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
