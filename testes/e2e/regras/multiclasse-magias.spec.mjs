// ============================================================
// Tarefa 7 (sub-projeto 4): o seletor de reserva "De qual reserva?" ao
// conjurar -- a única superfície de tela NOVA deste sub-projeto (os
// espaços em si já eram derivados da regra desde a Tarefa 1; esta tarefa
// só liga o botão "Conjurar" a um clique de verdade quando há DUAS
// reservas disputando o mesmo círculo).
//
// livro:2116 diz "pode usar" -- permissão, não ordem de gasto (uma
// varredura por termos de ordem no livro e em Classes.md não retorna
// nada). E a escolha não é neutra: o pacto volta no Descanso Curto
// (Classes.md:898) e a Conjuração só no Longo, então gastar o pacto
// primeiro é quase sempre a jogada ótima -- MAS há invocações que
// CONSOMEM espaço de pacto para outra coisa (Classes.md:1342, :1473),
// então o jogador pode querer guardá-lo. Uma ordem automática jogaria
// pelo jogador; por isso o app pergunta, com um seletor que só aparece
// quando as DUAS fontes tem espaço -- mesmo precedente do seletor de
// dado de vida (3e) e do de CA (3d).
//
// Segue a estrutura de multiclasse-descansos.spec.mjs (helper de montar
// personagem multiclasse + abrir a ficha, leitura de estado salvo no
// store, `clicarSeletorFicha`) -- mesmo mecanismo, duplicado aqui porque
// aquele arquivo não os exporta.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha } from './helpers-regras.mjs';

// XP coerente com o nível TOTAL de cada fixture -- não muda regra
// nenhuma que este spec meça, mas evita avisos de XP incoerente que só
// atrapalhariam a leitura de um trace.
const XP_POR_NIVEL_TOTAL = { 10: 64000 };

/**
 * Semeia um personagem MULTICLASSE direto no store e abre a ficha dele.
 * Mesmo mecanismo de `abrirFichaMulticlasse` (multiclasse-descansos.spec.mjs):
 * os espelhos (`classe`, `subclasse`, `nivel`) são preenchidos com o que
 * `sincronizarEspelhos()` produziria -- a classe INICIAL e o nível TOTAL.
 *
 * @param {import('@playwright/test').BrowserContext} context
 * @param {Array<{classe:string,subclasse:string,nivel:number,ordem:number}>} classes
 * @param {object} extras Campos extras do personagem (ex.: `magias_preparadas`).
 * @param {string} id Id do personagem no store (único por teste).
 * @returns {Promise<{page: import('@playwright/test').Page, erros: string[]}>}
 */
async function abrirFichaMulticlasse(context, classes, extras, id) {
  const inicial = classes.find((c) => c.ordem === 0) || classes[0];
  const nivelTotal = classes.reduce((soma, c) => soma + c.nivel, 0);
  const lado = await abrirFicha(context, {
    classe: inicial.classe,
    subclasse: inicial.subclasse,
    nivel: nivelTotal,
    xp: XP_POR_NIVEL_TOTAL[nivelTotal] || 0,
    especie: 'Humano',
    atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Arcanismo', 'Religião'],
    classes,
    schema_versao: 2,
    ...extras,
  }, id);
  await assentar(lado.page).catch(() => {});
  await lado.page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  return lado;
}

/**
 * Lê `espacos_magia` do personagem SALVO no store, pelo id -- dado CRU
 * gravado, não uma reconstrução de `reservasDeEspacos()`, para o clique
 * provar que persistiu (não só que a tela mudou). Mesmo mecanismo de
 * `recursosSalvos` em multiclasse-descansos.spec.mjs.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 * @returns {Promise<object>}
 */
async function espacosMagiaSalvos(page, id) {
  return page.evaluate(async (alvo) => {
    const store = await import(new URL('./js/store.js', location.href).href);
    const p = store.listarPersonagens().find((x) => x.id === alvo);
    return (p && p.espacos_magia) || {};
  }, id);
}

/**
 * GUARDA CONTRA VACUIDADE: exige que o elemento exista no DOM antes de
 * qualquer afirmação sobre ele. Sem isso, um widget que simplesmente não
 * renderiza faria "ele não apareceu" passar por AUSÊNCIA desde o início,
 * e não por efeito do clique -- mesma disciplina de
 * multiclasse-descansos.spec.mjs.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} seletor Seletor CSS do elemento.
 * @param {string} mensagem Por que ele precisa estar lá.
 */
async function exigirNoDom(page, seletor, mensagem) {
  await expect.poll(() => page.locator(seletor).count(), { message: mensagem })
    .toBeGreaterThan(0);
}

// Bruxo em ORDEM 0, Mago em ORDEM 1 -- não muda a regra que este spec
// mede (a resolução de fonte não depende de ordem), mas mantém o
// personagem coerente com o cabeçalho da ficha mostrando o Bruxo como
// classe inicial.
const BRUXO5_MAGO5 = [
  { classe: 'Bruxo', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Mago', subclasse: '', nivel: 5, ordem: 1 },
];

// Bola de Fogo, preparada no 3º círculo: o único círculo onde as reservas
// de Bruxo 5 (Magia de Pacto, Classes.md:898 -- inteira no 3º círculo,
// 2 espaços) e Mago 5 (Conjuração, tabela própria porque o Bruxo fica de
// fora da tabela unificada -- livro:2118 -- {1:4, 2:3, 3:2}) se
// sobrepõem. O 1º e o 2º círculo só existem do lado de Conjuração.
const MAGIA_PREPARADA_3_CIRCULO = [{ nome: 'Bola de Fogo', circulo: 3 }];

const SELETOR_MODAL_FONTE = '#select-fonte-magia';
const BOTAO_CONFIRMAR_FONTE = '#btn-confirmar-fonte-magia';
// Escopado na seção "Magias Preparadas" (não no Grimório do Mago), NOS
// DOIS cenários (não só no controle de classe única) -- achado da revisão:
// um Mago com uma magia preparada tem essa MESMA magia normalizada para
// dentro do grimório também (store.js, normalizarGrimorioMago), e o
// Grimório emite o PRÓPRIO botão "Conjurar" para magias preparadas
// (magias.js, mesmo atributo `data-conjurar`). O cenário Bruxo/Mago passa
// HOJE sem escopo só porque `char.classe` espelha Bruxo (a seção do
// Grimório do Mago não renderiza para classe inicial não-Mago) -- um
// acidente de fixture, não uma garantia; quebraria assim que o render de
// grimório para multiclasse existisse. Escopar nos dois cenários custa
// nada e não depende desse acidente.
const BOTAO_CONJURAR_PREPARADA = '[data-details-id="magias-circulo-3"] [data-conjurar="Bola de Fogo"]';

test('Bruxo 5/Mago 5: conjurar no 3º círculo mostra o seletor de reserva, e escolher pacto debita só o pacto', async ({ context }) => {
  const id = 'regras-4-t7-seletor-fonte-magia';
  const { page, erros } = await abrirFichaMulticlasse(
    context, BRUXO5_MAGO5, { magias_preparadas: MAGIA_PREPARADA_3_CIRCULO }, id);

  // Passo 2: o botão "Conjurar" da magia preparada está na tela.
  await exigirNoDom(page, BOTAO_CONJURAR_PREPARADA, 'o botão "Conjurar" de Bola de Fogo precisa estar no DOM');
  await expect(page.locator(BOTAO_CONJURAR_PREPARADA), 'o botão "Conjurar" precisa estar visível').toBeVisible();

  // Controle: nenhuma das duas reservas foi tocada antes do clique.
  const antes = await espacosMagiaSalvos(page, id);
  expect(antes?.conjuracao?.['3'] ?? 0, 'antes do clique, a Conjuração do 3º círculo está intacta').toBe(0);
  expect(antes?.pacto?.['3'] ?? 0, 'antes do clique, o Pacto do 3º círculo está intacto').toBe(0);

  // Passo 2 (clique): conjurar.
  await clicarSeletorFicha(page, BOTAO_CONJURAR_PREPARADA, { esperar: SELETOR_MODAL_FONTE });

  // Passo 3: o seletor de reserva aparece, com as duas opções rotuladas
  // de um jeito que o jogador entende qual é qual.
  await exigirNoDom(page, SELETOR_MODAL_FONTE, 'o seletor "De qual reserva?" precisa estar no DOM');
  await expect(page.locator(SELETOR_MODAL_FONTE), 'o seletor precisa estar visível').toBeVisible();
  const textoSeletor = await page.locator(SELETOR_MODAL_FONTE).innerText();
  expect(textoSeletor, 'a opção de Conjuração tem de estar rotulada, com a contagem certa (2 de 2)')
    .toMatch(/Conjuração.*2 de 2 dispon[ií]veis/);
  expect(textoSeletor, 'a opção de Magia de Pacto tem de estar rotulada, com a contagem certa (2 de 2)')
    .toMatch(/Magia de Pacto.*2 de 2 dispon[ií]veis/);

  // Ainda nenhum gasto -- abrir o seletor não debita nada por conta própria.
  const duranteSeletor = await espacosMagiaSalvos(page, id);
  expect(duranteSeletor?.conjuracao?.['3'] ?? 0, 'com o seletor aberto e nada confirmado, a Conjuração continua intacta').toBe(0);
  expect(duranteSeletor?.pacto?.['3'] ?? 0, 'com o seletor aberto e nada confirmado, o Pacto continua intacto').toBe(0);

  // Passo 4: escolher pacto e confirmar.
  await page.selectOption(SELETOR_MODAL_FONTE, 'pacto');
  await clicarSeletorFicha(page, BOTAO_CONFIRMAR_FONTE);
  await assentar(page).catch(() => {});

  // Passo 5: a reserva de pacto caiu em 1, e a de Conjuração NÃO mudou --
  // lendo o estado ARMAZENADO no store, não só o DOM (um clique que não
  // muda o estado salvo não prova nada).
  const depois = await espacosMagiaSalvos(page, id);
  expect(depois?.pacto?.['3'], 'escolher "pacto" tem de debitar 1 espaço do Pacto (3º círculo)').toBe(1);
  expect(depois?.conjuracao?.['3'] ?? 0, 'a Conjuração (3º círculo) não pode ter mudado -- só o pacto foi escolhido').toBe(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// Achado da revisão: o cenário acima (e o espelho da magia personalizada,
// abaixo) sempre escolhiam "pacto" -- nenhum cenário e2e escolhia
// "Conjuração", então uma implementação que ignorasse o `<select>` e
// sempre devolvesse "pacto" passaria verde na suíte inteira. Este
// cenário é o espelho invertido: mesmo fixture, escolhe "Conjuração".
test('Bruxo 5/Mago 5: conjurar no 3º círculo, escolher CONJURAÇÃO debita só a Conjuração', async ({ context }) => {
  const id = 'regras-4-t7-seletor-fonte-magia-conjuracao';
  const { page, erros } = await abrirFichaMulticlasse(
    context, BRUXO5_MAGO5, { magias_preparadas: MAGIA_PREPARADA_3_CIRCULO }, id);

  await exigirNoDom(page, BOTAO_CONJURAR_PREPARADA, 'o botão "Conjurar" de Bola de Fogo precisa estar no DOM');
  await clicarSeletorFicha(page, BOTAO_CONJURAR_PREPARADA, { esperar: SELETOR_MODAL_FONTE });
  await exigirNoDom(page, SELETOR_MODAL_FONTE, 'o seletor "De qual reserva?" precisa estar no DOM');

  await page.selectOption(SELETOR_MODAL_FONTE, 'conjuracao');
  await clicarSeletorFicha(page, BOTAO_CONFIRMAR_FONTE);
  await assentar(page).catch(() => {});

  const depois = await espacosMagiaSalvos(page, id);
  expect(depois?.conjuracao?.['3'], 'escolher "Conjuração" tem de debitar 1 espaço da Conjuração (3º círculo)').toBe(1);
  expect(depois?.pacto?.['3'] ?? 0, 'o Pacto (3º círculo) não pode ter mudado -- só a Conjuração foi escolhida').toBe(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// Passo 6 -- CONTROLE de classe única: um Mago 10 conjurando a mesma
// magia não pode ver o seletor -- a tela é a de sempre (Mago solo não
// tem Magia de Pacto nenhuma; a única reserva do 3º círculo é
// Conjuração, e o clique gasta dela direto, sem perguntar nada).
// ============================================================
test('CONTROLE -- Mago 10 de classe única: conjurar no 3º círculo não mostra seletor nenhum', async ({ context }) => {
  const id = 'regras-4-t7-seletor-fonte-magia-classe-unica';
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago',
    subclasse: '',
    nivel: 10,
    xp: 64000,
    especie: 'Humano',
    atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Arcanismo', 'História'],
    magias_preparadas: MAGIA_PREPARADA_3_CIRCULO,
  }, id);
  await assentar(page).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });

  await exigirNoDom(page, BOTAO_CONJURAR_PREPARADA, 'o botão "Conjurar" de Bola de Fogo precisa estar no DOM');
  await expect(page.locator(BOTAO_CONJURAR_PREPARADA), 'o botão "Conjurar" precisa estar visível').toBeVisible();

  const antes = await espacosMagiaSalvos(page, id);
  expect(antes?.conjuracao?.['3'] ?? 0, 'antes do clique, a Conjuração do 3º círculo está intacta').toBe(0);

  await clicarSeletorFicha(page, BOTAO_CONJURAR_PREPARADA);
  await assentar(page).catch(() => {});

  // O seletor NUNCA aparece -- classe única não pode mudar de
  // comportamento. Sem esta asserção, uma implementação que sempre
  // mostrasse o seletor (mesmo com uma reserva só) passaria no cenário
  // principal sozinho.
  await expect(page.locator(SELETOR_MODAL_FONTE), 'classe única não pode ver o seletor de reserva').toHaveCount(0);

  // O gasto foi direto para a única fonte -- tela de sempre.
  const depois = await espacosMagiaSalvos(page, id);
  expect(depois?.conjuracao?.['3'], 'o clique gastou direto da Conjuração, sem seletor').toBe(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// RULING do controlador sobre a Tarefa 7: o seletor se estende à magia
// PERSONALIZADA -- a mesma pergunta ("de qual reserva sai o espaço?")
// vale para qualquer gasto, não só o de magia preparada; antes deste
// ruling, o botão "Conjurar" de magia personalizada continuava
// resolvendo a fonte só por precedência automática (conjuração vence),
// mesmo com as duas reservas disponíveis -- um seletor que aparece numa
// magia e não na outra é pior que seletor nenhum, porque o jogador não
// consegue formar um modelo do que o app faz.
//
// Espelha os dois cenários acima, trocando o botão "Conjurar" de magia
// preparada (`[data-conjurar]`) pelo de magia personalizada
// (`[data-conjurar-magia-custom]`).
//
// A magia personalizada só ganha o botão "Conjurar" quando TAMBÉM está
// em `magias_preparadas` (casando por nome+círculo, com
// `personalizada: true`) -- sem isso, `renderLinhaMagiaPersonalizada`
// mostra só "Não preparada", sem nenhum botão de conjurar. Por isso o
// fixture semeia os dois campos.
// ============================================================
const MAGIA_PERSONALIZADA_3_CIRCULO = { nome: 'Toque Sombrio Multiclasse', circulo: 3 };
const BOTAO_CONJURAR_CUSTOM = '[data-conjurar-magia-custom="0"]';

test('Bruxo 5/Mago 5: conjurar magia PERSONALIZADA no 3º círculo também mostra o seletor, e escolher pacto debita só o pacto', async ({ context }) => {
  const id = 'regras-4-t7-seletor-fonte-magia-custom';
  const { page, erros } = await abrirFichaMulticlasse(
    context, BRUXO5_MAGO5,
    {
      magias_customizadas: [MAGIA_PERSONALIZADA_3_CIRCULO],
      magias_preparadas: [{ ...MAGIA_PERSONALIZADA_3_CIRCULO, personalizada: true }],
    },
    id);

  await exigirNoDom(page, BOTAO_CONJURAR_CUSTOM, 'o botão "Conjurar" da magia personalizada precisa estar no DOM');
  await expect(page.locator(BOTAO_CONJURAR_CUSTOM), 'o botão "Conjurar" precisa estar visível').toBeVisible();

  // Controle: nenhuma das duas reservas foi tocada antes do clique.
  const antes = await espacosMagiaSalvos(page, id);
  expect(antes?.conjuracao?.['3'] ?? 0, 'antes do clique, a Conjuração do 3º círculo está intacta').toBe(0);
  expect(antes?.pacto?.['3'] ?? 0, 'antes do clique, o Pacto do 3º círculo está intacto').toBe(0);

  await clicarSeletorFicha(page, BOTAO_CONJURAR_CUSTOM, { esperar: SELETOR_MODAL_FONTE });

  // O seletor aparece, com as duas opções rotuladas -- mesma verificação
  // do cenário de magia preparada.
  await exigirNoDom(page, SELETOR_MODAL_FONTE, 'o seletor "De qual reserva?" precisa estar no DOM (magia personalizada)');
  await expect(page.locator(SELETOR_MODAL_FONTE), 'o seletor precisa estar visível').toBeVisible();
  const textoSeletor = await page.locator(SELETOR_MODAL_FONTE).innerText();
  expect(textoSeletor, 'a opção de Conjuração tem de estar rotulada, com a contagem certa (2 de 2)')
    .toMatch(/Conjuração.*2 de 2 dispon[ií]veis/);
  expect(textoSeletor, 'a opção de Magia de Pacto tem de estar rotulada, com a contagem certa (2 de 2)')
    .toMatch(/Magia de Pacto.*2 de 2 dispon[ií]veis/);

  // Ainda nenhum gasto -- abrir o seletor não debita nada por conta própria.
  const duranteSeletor = await espacosMagiaSalvos(page, id);
  expect(duranteSeletor?.conjuracao?.['3'] ?? 0, 'com o seletor aberto e nada confirmado, a Conjuração continua intacta').toBe(0);
  expect(duranteSeletor?.pacto?.['3'] ?? 0, 'com o seletor aberto e nada confirmado, o Pacto continua intacto').toBe(0);

  await page.selectOption(SELETOR_MODAL_FONTE, 'pacto');
  await clicarSeletorFicha(page, BOTAO_CONFIRMAR_FONTE);
  await assentar(page).catch(() => {});

  // A reserva de pacto caiu em 1, e a de Conjuração NÃO mudou -- lendo o
  // estado ARMAZENADO no store, não só o DOM.
  const depois = await espacosMagiaSalvos(page, id);
  expect(depois?.pacto?.['3'], 'escolher "pacto" tem de debitar 1 espaço do Pacto (magia personalizada, 3º círculo)').toBe(1);
  expect(depois?.conjuracao?.['3'] ?? 0, 'a Conjuração (3º círculo) não pode ter mudado -- só o pacto foi escolhido').toBe(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// Espelho do cenário de magia preparada acima ("escolher CONJURAÇÃO"),
// para a magia personalizada -- mesmo achado da revisão: sem este
// cenário, o alcance de "escolhe Conjuração" ficaria coberto só pela
// preparada, e os dois caminhos (preparada/personalizada) precisam do
// mesmo par (pacto/conjuração), não só um deles.
// Achado da revisão de branch (Important 3): antes desta correção, esgotar
// as DUAS reservas de Conjuração de um círculo colidido deixava o botão
// "Conjurar" DESABILITADO em HTML (renderSecaoMagias calculava
// "esgotado" só a partir da fonte prioritária, `espacos[c]`) -- um beco
// sem saída real, não só teórico: um clique de VERDADE do Playwright
// (`.click()`, que respeita `disabled`, ao contrário de um `.click()` via
// `page.evaluate`) estourava em timeout. A correção mexeu em DOIS lugares
// que precisam concordar: o cálculo de "esgotado" que desenha o `disabled`
// (`circulosComEspacoDisponivel`, em renderSecaoMagias) e a resolução de
// fonte que decide o que gastar (`decidirFonteEContinuar` +  o gate de
// `setupEventosEspacosMagia`). Este oráculo exercita os DOIS com cliques
// reais: sem qualquer um dos dois, ele falha (confirmado por mutação --
// ver o fix report desta rodada).
test('Bruxo 5/Mago 5: esgotar a Conjuração do círculo não estranca o Pacto colidido -- o botão continua clicável e debita o Pacto', async ({ context }) => {
  const id = 'regras-4-i3-pacto-nao-estranca';
  const { page, erros } = await abrirFichaMulticlasse(
    context, BRUXO5_MAGO5, { magias_preparadas: MAGIA_PREPARADA_3_CIRCULO }, id);

  await exigirNoDom(page, BOTAO_CONJURAR_PREPARADA, 'o botão "Conjurar" de Bola de Fogo precisa estar no DOM');

  // Passos 1 e 2: gasta os DOIS espaços de Conjuração (2 de 2), sempre
  // escolhendo "Conjuração" no seletor -- a Magia de Pacto (também 2 de 2
  // neste círculo) fica intocada.
  for (let i = 0; i < 2; i++) {
    await clicarSeletorFicha(page, BOTAO_CONJURAR_PREPARADA, { esperar: SELETOR_MODAL_FONTE });
    await page.selectOption(SELETOR_MODAL_FONTE, 'conjuracao');
    await clicarSeletorFicha(page, BOTAO_CONFIRMAR_FONTE);
    await assentar(page).catch(() => {});
  }
  const apósEsgotarConjuracao = await espacosMagiaSalvos(page, id);
  expect(apósEsgotarConjuracao?.conjuracao?.['3'], 'a Conjuração precisa estar esgotada (2 de 2) antes do passo decisivo').toBe(2);
  expect(apósEsgotarConjuracao?.pacto?.['3'] ?? 0, 'o Pacto ainda não foi tocado').toBe(0);

  // Passo 3 (decisivo): com a Conjuração esgotada e só o Pacto de pé, o
  // botão precisa continuar CLICÁVEL de verdade -- `disabled` travaria um
  // clique real do Playwright em timeout, o que já aconteceu antes desta
  // correção (ver comentário acima).
  await expect(page.locator(BOTAO_CONJURAR_PREPARADA), 'o botão "Conjurar" precisa continuar habilitado com o Pacto ainda de pé').toBeEnabled();
  await page.locator(BOTAO_CONJURAR_PREPARADA).click();
  await assentar(page).catch(() => {});

  // Com UMA reserva só disponível (Pacto), o seletor NÃO aparece -- mesma
  // regra de sempre ("quem tem só uma reserva não vê nada de novo") --
  // mas o gasto precisa ter ido para o Pacto, não para a Conjuração (que
  // já estava em 2 de 2 e não pode passar de 2).
  //
  // `.not.toBeVisible()`, não `.toHaveCount(0)`: `fecharModal()`
  // (utils.js) só troca `display` do overlay para `none`, não remove
  // `#select-fonte-magia` do DOM -- o elemento das DUAS aberturas
  // anteriores (loop acima) continua presente, só oculto. Um teste que
  // checasse CONTAGEM aqui teria um falso positivo pré-existente nesta
  // suíte (não uma regressão desta correção).
  await expect(page.locator(SELETOR_MODAL_FONTE), 'com só o Pacto disponível, o seletor não deve estar visível').not.toBeVisible();
  const depois = await espacosMagiaSalvos(page, id);
  expect(depois?.pacto?.['3'], 'o 3º clique precisa debitar o Pacto colidido, que era o único com espaço').toBe(1);
  expect(depois?.conjuracao?.['3'], 'a Conjuração não pode passar de 2 (já estava esgotada)').toBe(2);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Bruxo 5/Mago 5: conjurar magia PERSONALIZADA no 3º círculo, escolher CONJURAÇÃO debita só a Conjuração', async ({ context }) => {
  const id = 'regras-4-t7-seletor-fonte-magia-custom-conjuracao';
  const { page, erros } = await abrirFichaMulticlasse(
    context, BRUXO5_MAGO5,
    {
      magias_customizadas: [MAGIA_PERSONALIZADA_3_CIRCULO],
      magias_preparadas: [{ ...MAGIA_PERSONALIZADA_3_CIRCULO, personalizada: true }],
    },
    id);

  await exigirNoDom(page, BOTAO_CONJURAR_CUSTOM, 'o botão "Conjurar" da magia personalizada precisa estar no DOM');
  await clicarSeletorFicha(page, BOTAO_CONJURAR_CUSTOM, { esperar: SELETOR_MODAL_FONTE });
  await exigirNoDom(page, SELETOR_MODAL_FONTE, 'o seletor "De qual reserva?" precisa estar no DOM (magia personalizada)');

  await page.selectOption(SELETOR_MODAL_FONTE, 'conjuracao');
  await clicarSeletorFicha(page, BOTAO_CONFIRMAR_FONTE);
  await assentar(page).catch(() => {});

  const depois = await espacosMagiaSalvos(page, id);
  expect(depois?.conjuracao?.['3'], 'escolher "Conjuração" tem de debitar 1 espaço da Conjuração (magia personalizada, 3º círculo)').toBe(1);
  expect(depois?.pacto?.['3'] ?? 0, 'o Pacto (3º círculo) não pode ter mudado -- só a Conjuração foi escolhida (magia personalizada)').toBe(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// CONTROLE de classe única, espelhando o de magia preparada: um Mago 10
// conjurando a MESMA magia personalizada não pode ver o seletor -- a
// única reserva do 3º círculo é Conjuração, e o clique gasta dela direto.
test('CONTROLE -- Mago 10 de classe única: conjurar magia PERSONALIZADA no 3º círculo não mostra seletor nenhum', async ({ context }) => {
  const id = 'regras-4-t7-seletor-fonte-magia-custom-classe-unica';
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago',
    subclasse: '',
    nivel: 10,
    xp: 64000,
    especie: 'Humano',
    atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Arcanismo', 'História'],
    magias_customizadas: [MAGIA_PERSONALIZADA_3_CIRCULO],
    magias_preparadas: [{ ...MAGIA_PERSONALIZADA_3_CIRCULO, personalizada: true }],
  }, id);
  await assentar(page).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });

  await exigirNoDom(page, BOTAO_CONJURAR_CUSTOM, 'o botão "Conjurar" da magia personalizada precisa estar no DOM');
  await expect(page.locator(BOTAO_CONJURAR_CUSTOM), 'o botão "Conjurar" precisa estar visível').toBeVisible();

  const antes = await espacosMagiaSalvos(page, id);
  expect(antes?.conjuracao?.['3'] ?? 0, 'antes do clique, a Conjuração do 3º círculo está intacta').toBe(0);

  await clicarSeletorFicha(page, BOTAO_CONJURAR_CUSTOM);
  await assentar(page).catch(() => {});

  // O seletor NUNCA aparece -- classe única não pode mudar de
  // comportamento, nem para a magia personalizada.
  await expect(page.locator(SELETOR_MODAL_FONTE), 'classe única não pode ver o seletor de reserva (magia personalizada)').toHaveCount(0);

  const depois = await espacosMagiaSalvos(page, id);
  expect(depois?.conjuracao?.['3'], 'o clique gastou direto da Conjuração, sem seletor (magia personalizada)').toBe(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
