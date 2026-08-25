// ============================================================
// Handlers de clique por classe: o botao de uma classe SECUNDARIA tem de
// responder, e tem de gastar o recurso DAQUELA classe, no nivel DAQUELA
// classe.
//
// Defeito que este spec mede (sub-projeto 3c): `setupEventosHabilidades`
// (site/js/sheet/habilidades.js) abre quase todo handler com uma guarda
// escrita sobre o ESPELHO da classe inicial --
//
//     if (char.classe !== 'Clérigo') return;
//     if (char.classe !== 'Bárbaro' || char.nivel < 15) return;
//
// -- e `char.classe` e sempre a classe de ORDEM 0. Num Paladino 5/Clerigo 5
// o botao de Canalizar Divindade do Clerigo E RENDERIZADO (o sub-projeto 3b
// consertou o render) mas o clique cai na guarda e some sem efeito e sem
// aviso: botao morto. O mesmo vale para o nivel -- `char.nivel` e o TOTAL,
// nao o nivel NA classe, entao a Furia Persistente do Barbaro responde no
// personagem errado.
//
// Por que e2e e nao unidade: nenhum teste de unidade deste projeto aciona
// `setupEventosHabilidades`, e o harness de unidade monta um `document` de
// mentira (testes/unidade/harness.mjs) sem `addEventListener` de verdade --
// nao ha onde um listener ser exercitado fora do navegador.
//
// ORDEM DO FIXTURE: o Paladino/Guerreiro vem em `ordem: 0` de proposito.
// Invertendo, `char.classe` ja seria a classe medida, a guarda passaria, e
// os oraculos nasceriam verdes medindo nada.
//
// ESTE ARQUIVO E A SUPERFICIE DE TESTE DE HANDLERS DO PROJETO. As Tarefas 3
// e 4 acrescentam testes AQUI e reusam os helpers do bloco abaixo -- nao
// reescreva o setup em cada teste.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha } from './helpers-regras.mjs';

// ============================================================
// Helpers compartilhados (Tarefas 3 e 4: acrescentem aqui)
// ============================================================

// XP coerente com o nivel TOTAL de cada fixture. Nao muda regra nenhuma
// que este spec meça, mas uma ficha com XP incoerente exibe avisos que
// so atrapalhariam a leitura de um trace.
const XP_POR_NIVEL_TOTAL = { 9: 48000, 10: 64000, 15: 165000, 16: 195000, 17: 225000 };

/**
 * Semeia um personagem MULTICLASSE direto no store e abre a ficha dele.
 *
 * Nenhum fluxo do app cria multiclasse hoje (so o sub-projeto 5 vai
 * permitir), entao o estado e forjado -- mesma tecnica de
 * `multiclasse-recursos-por-classe.spec.mjs`. `schema_versao: 2` evita que
 * a migracao preguicosa trate a ficha como legada e a achate em uma classe
 * so; os espelhos (`classe`, `subclasse`, `nivel`) sao preenchidos com o
 * que `sincronizarEspelhos()` produziria, que e exatamente o que a guarda
 * defeituosa le.
 *
 * Abre todos os `<details>` no fim: os botoes de caracteristica vivem
 * dentro deles. O innerHTML ja os traz mesmo fechados, mas abrir mantem o
 * spec legivel para quem for depurar com trace.
 *
 * @param {import('@playwright/test').BrowserContext} context
 * @param {Array<{classe:string,subclasse:string,nivel:number,ordem:number}>} classes
 * @param {object} extras Campos extras do personagem (ex.: `recursos`).
 * @param {string} id Id do personagem no store (unico por teste).
 * @returns {Promise<{page: import('@playwright/test').Page, erros: string[]}>}
 */
async function abrirFichaMulticlasse(context, classes, extras, id) {
  const inicial = classes.find((c) => c.ordem === 0) || classes[0];
  const nivelTotal = classes.reduce((soma, c) => soma + c.nivel, 0);
  const lado = await abrirFicha(context, {
    // Espelhos: apontam para a classe INICIAL e para o nivel TOTAL.
    classe: inicial.classe,
    subclasse: inicial.subclasse,
    nivel: nivelTotal,
    xp: XP_POR_NIVEL_TOTAL[nivelTotal] || 0,
    especie: 'Humano',
    atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Atletismo', 'Religião'],
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
 * GUARDA CONTRA VACUIDADE: exige que o widget exista no DOM antes de
 * qualquer afirmacao sobre ele. Sem isso, um bloco que simplesmente nao
 * renderiza faria todo "o recurso nao mudou" passar por AUSENCIA, e nao
 * por acerto -- e um teste de handler que nunca acha o botao e um teste
 * que nunca clica.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} seletor Seletor CSS do widget.
 * @param {string} mensagem Por que ele precisa estar la.
 */
async function exigirNoDom(page, seletor, mensagem) {
  await expect.poll(() => page.locator(seletor).count(), { message: mensagem })
    .toBeGreaterThan(0);
}

/**
 * Le o objeto `recursos` do personagem SALVO no store, pelo id.
 *
 * De proposito le o dado CRU gravado, e nao o resultado de
 * `getEstadoRecursosClerigo()` e companhia: aquelas funcoes sao as mesmas
 * que a implementacao usa, e afirmar sobre elas seria medir a formula com
 * a propria formula. Os campos aqui sao numeros gravados -- `salvar()` e
 * parte do contrato do handler, entao ler do store tambem prova que o
 * clique persistiu.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id Id do personagem.
 * @returns {Promise<object>} `recursos` (objeto vazio se ainda nao existe).
 */
async function recursosSalvos(page, id) {
  return page.evaluate(async (alvo) => {
    const store = await import(new URL('./js/store.js', location.href).href);
    const p = store.listarPersonagens().find((x) => x.id === alvo);
    return (p && p.recursos) || {};
  }, id);
}

/**
 * Le o contador "disponiveis/max" do `<details>` que contem o seletor.
 *
 * O texto vem do DOM renderizado, nao de uma funcao de producao -- e a
 * unica leitura do TOTAL de usos que nao recalcula o esperado com a
 * formula que esta sendo julgada.
 *
 * Varre TODAS as ocorrencias do seletor, e nao so a primeira: alguns
 * botoes sao emitidos duas vezes, uma no card de caracteristica (dentro do
 * `<details>`, com o resumo "x/y") e outra na caixa de resumo do topo da
 * ficha (`data-paladino-acao="canalizar"` em site/js/sheet/ficha.js, fora
 * de qualquer `<details>`). A primeira em ordem de documento e a do topo, e
 * um `querySelector` simples devolvia sempre `null` aqui.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} seletor Seletor de um botao dentro do widget.
 * @returns {Promise<{disponiveis:number,max:number}|null>}
 */
async function contadorDoWidget(page, seletor) {
  return page.evaluate((alvo) => {
    for (const btn of document.querySelectorAll(alvo)) {
      const resumo = btn.closest('details')?.querySelector('summary');
      const m = resumo && /(\d+)\s*\/\s*(\d+)/.exec(resumo.textContent || '');
      if (m) return { disponiveis: Number(m[1]), max: Number(m[2]) };
    }
    return null;
  }, seletor);
}

/**
 * Clica um botao da ficha TOLERANDO a ausencia dele, e diz se clicou.
 *
 * Existe para o lado negativo dos pares ("este personagem NAO responde"):
 * a implementacao correta pode nem renderizar o botao, e nesse caso "nao
 * respondeu" tambem e verdade. Um `clicarSeletorFicha` normal estouraria
 * em timeout e acusaria o produto por acertar.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} seletor
 * @returns {Promise<boolean>} true se havia botao e ele foi clicado.
 */
async function tentarClicarFicha(page, seletor) {
  if (!await page.locator(seletor).count()) return false;
  await page.evaluate((alvo) => document.querySelector(alvo)?.click(), seletor);
  return true;
}

// ---------- Helpers da Tarefa 3: o seletor generico `data-config-maestrias` ----------

/**
 * Le o `data-classe` carimbado em cada elemento que casa com o seletor, em
 * ordem de documento (null quando o elemento nao tem carimbo).
 *
 * Existe para o UNICO seletor de handler que nao codifica a classe no
 * proprio nome: `data-config-maestrias` sai de cinco ramos de classe e o
 * handler faz um `querySelectorAll` so. A classe de cada botao so pode vir
 * do carimbo que `renderFeatureItem` emite -- entao, antes de afirmar
 * qualquer coisa sobre o clique, e preciso provar que o carimbo esta la.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} seletor
 * @returns {Promise<Array<string|null>>}
 */
async function classesCarimbadas(page, seletor) {
  return page.evaluate((alvo) => [...document.querySelectorAll(alvo)]
    .map((el) => el.dataset.classe ?? null), seletor);
}

/**
 * Le o modal de maestrias que estiver aberto: o titulo e o teto declarado.
 *
 * O teto sai do texto "Regra: voce conhece N maestria(s) neste nivel." do
 * proprio modal -- e o numero que o modal DECLARA, nao o que uma funcao de
 * producao recalcularia.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{titulo:string,teto:number|null,caixas:number}>}
 */
async function lerModalMaestrias(page) {
  return page.evaluate(() => {
    const titulo = document.getElementById('modal-titulo')?.textContent || '';
    const corpo = document.getElementById('modal-corpo')?.textContent || '';
    const m = /conhece\s+(\d+)\s+maestria/i.exec(corpo);
    return {
      titulo,
      teto: m ? Number(m[1]) : null,
      caixas: document.querySelectorAll('[data-maestria-nome]').length,
    };
  });
}

/**
 * Tenta marcar as `quantas` primeiras caixas do modal de maestrias e devolve
 * quantas ficaram marcadas DE FATO.
 *
 * E a medida COMPORTAMENTAL do teto: o modal desmarca a caixa excedente
 * sozinho quando o limite estoura. Ler so o rotulo "N maestria(s)" seria
 * satisfeito por um modal que exibisse o numero certo e aceitasse qualquer
 * quantidade.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} quantas
 * @returns {Promise<number>} quantas caixas continuam marcadas.
 */
async function marcarMaestrias(page, quantas) {
  return page.evaluate((limite) => {
    const caixas = [...document.querySelectorAll('[data-maestria-nome]')];
    for (const cb of caixas.slice(0, limite)) {
      if (cb.checked) continue;
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return [...document.querySelectorAll('[data-maestria-nome]')]
      .filter((cb) => cb.checked).length;
  }, quantas);
}

/**
 * Fecha o modal aberto SEM salvar, para o proximo clique abrir um modal
 * novo em vez de um sub-modal empilhado (`abrirModal` empilha quando o
 * overlay ja esta visivel -- utils.js:759).
 *
 * @param {import('@playwright/test').Page} page
 */
async function fecharModalAberto(page) {
  await page.evaluate(() => window.fecharModal?.());
  await page.waitForSelector('#btn-salvar-maestrias', { state: 'detached', timeout: 10_000 })
    .catch(() => {});
}

/**
 * Le a lista `maestrias_arma` do personagem SALVO no store, pelo id.
 *
 * Mesma disciplina de `recursosSalvos`: dado cru gravado, nao o resultado de
 * uma funcao de producao. `maestrias_arma` e uma lista UNICA do personagem
 * (nao ha uma por classe), entao ela prova que o clique persistiu, mas quem
 * distingue a classe e o TETO com que o modal abriu.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 * @returns {Promise<string[]>}
 */
async function maestriasSalvas(page, id) {
  return page.evaluate(async (alvo) => {
    const store = await import(new URL('./js/store.js', location.href).href);
    const p = store.listarPersonagens().find((x) => x.id === alvo);
    return (p && p.maestrias_arma) || [];
  }, id);
}

// Fixture canonico do 3c: Paladino de ORDEM 0 (o espelho `char.classe`
// vira 'Paladino'), Clerigo de ordem 1 -- o caso que hoje falha.
const PALADINO5_CLERIGO5 = [
  { classe: 'Paladino', subclasse: 'Juramento da Devoção', nivel: 5, ordem: 0 },
  { classe: 'Clérigo', subclasse: 'Domínio da Vida', nivel: 5, ordem: 1 },
];

// Recursos semeados. O Paladino comeca com UM uso ja gasto de proposito:
// Paladino 5 e Clerigo 5 tem AMBOS max 2 de Canalizar Divindade, entao com
// os dois zerados os dois pools ficariam indistinguiveis na tela -- o ponto
// exato onde o certo e o errado coincidem. Com 1 gasto no Paladino, o
// widget do Clerigo mostra 2/2 e o do Paladino 1/2.
const RECURSOS_SEMEADOS = {
  clerigo: { canalizar_divindade_usos_gastos: 0 },
  paladino: {
    maos_consagradas_gastos: 0,
    canalizar_divindade_usos_gastos: 1,
    destruicao_gratuita_usada: false,
  },
};

const BOTAO_CD_CLERIGO = '[data-clerigo-cd-acao="centelha"]';

// ============================================================
// Oraculo 1 -- o clique nao pode ser engolido
// ============================================================
//
// Mata: a guarda `char.classe !== 'Clérigo'`, e qualquer variante dela que
// continue lendo o espelho da classe inicial (`char.subclasse`,
// `classeData`). Hoje o botao existe, esta habilitado, e clicar nele nao
// faz absolutamente nada -- nem toast de erro.
test('Oraculo 1 -- Paladino 5/Clerigo 5: clicar em Canalizar Divindade do Clerigo consome um uso', async ({ context }) => {
  const id = 'regras-3c-oraculo-1';
  const { page, erros } = await abrirFichaMulticlasse(
    context, PALADINO5_CLERIGO5, { recursos: structuredClone(RECURSOS_SEMEADOS) }, id);

  await exigirNoDom(page, BOTAO_CD_CLERIGO,
    'o botao de Canalizar Divindade do Clerigo precisa estar no DOM -- sem ele nao ha clique para medir');

  const antes = await contadorDoWidget(page, BOTAO_CD_CLERIGO);
  expect(antes, 'o widget do Clerigo mostra o contador de usos').not.toBeNull();
  expect(antes, 'Clerigo 5 comeca com 2 de 2 usos').toEqual({ disponiveis: 2, max: 2 });

  await clicarSeletorFicha(page, BOTAO_CD_CLERIGO);

  const recursos = await recursosSalvos(page, id);
  expect(recursos.clerigo?.canalizar_divindade_usos_gastos,
    'o clique no botao do Clerigo tem de gastar 1 uso e GRAVAR').toBe(1);

  const depois = await contadorDoWidget(page, BOTAO_CD_CLERIGO);
  expect(depois, 'a tela tem de refletir o gasto: 1 de 2').toEqual({ disponiveis: 1, max: 2 });

  expect(erros, 'nenhum erro de console').toEqual([]);
});

// ============================================================
// Oraculo 2 -- o PAR: consumiu o pool do Clerigo, nao o do Paladino
// ============================================================
//
// Sozinho, "o Clerigo consumiu um uso" e satisfeito por uma implementacao
// que troca a guarda por `temClasse(char, 'Clérigo')` mas continua gastando
// o pool errado, ou que decide o pool pela classe do PRIMEIRO bloco
// renderizado (o Paladino, aqui). O lado oposto -- o recurso do Paladino
// INTACTO -- e o que fecha.
//
// O Paladino entra com 1 uso ja gasto justamente para os dois pools nao
// serem o mesmo numero: se ambos estivessem em 2/2, "gastou um" nao
// distinguiria qual deles foi.
test('Oraculo 2 -- Paladino 5/Clerigo 5: o clique do Clerigo nao toca no Canalizar Divindade do Paladino', async ({ context }) => {
  const id = 'regras-3c-oraculo-2';
  const { page, erros } = await abrirFichaMulticlasse(
    context, PALADINO5_CLERIGO5, { recursos: structuredClone(RECURSOS_SEMEADOS) }, id);

  await exigirNoDom(page, BOTAO_CD_CLERIGO,
    'o botao de Canalizar Divindade do Clerigo precisa estar no DOM');
  // A outra metade da guarda: o widget do Paladino tambem tem de existir,
  // ou "o Paladino ficou intacto" passaria por ausencia.
  // `details [data-paladino-acao=...]` e nao so o atributo: a caixa de
  // resumo do topo da ficha emite o MESMO atributo fora de qualquer
  // `<details>`, e um seletor solto seria satisfeito por ela mesmo que o
  // card de caracteristica do Paladino nao existisse.
  await exigirNoDom(page, 'details [data-paladino-acao="canalizar"]',
    'o widget de Canalizar Divindade do Paladino precisa estar no DOM');

  const paladinoAntes = await contadorDoWidget(page, '[data-paladino-acao="canalizar"]');
  expect(paladinoAntes, 'Paladino 5 comeca com 1 de 2 (um uso semeado como gasto)')
    .toEqual({ disponiveis: 1, max: 2 });

  await clicarSeletorFicha(page, BOTAO_CD_CLERIGO);

  const recursos = await recursosSalvos(page, id);

  // Direcao 1: o pool CERTO andou.
  expect(recursos.clerigo?.canalizar_divindade_usos_gastos,
    'o pool do Clerigo tem de ir de 0 para 1').toBe(1);

  // Direcao 2 (a que importa): o pool ERRADO nao andou.
  expect(recursos.paladino?.canalizar_divindade_usos_gastos,
    'o pool do Paladino tem de continuar exatamente onde estava (1 gasto)').toBe(1);

  const paladinoDepois = await contadorDoWidget(page, '[data-paladino-acao="canalizar"]');
  expect(paladinoDepois, 'a tela do Paladino nao pode mudar por causa de um clique do Clerigo')
    .toEqual({ disponiveis: 1, max: 2 });

  expect(erros, 'nenhum erro de console').toEqual([]);
});

// ============================================================
// Oraculo 3 -- o teto e o de Clerigo 5, nao o de nivel 10
// ============================================================
//
// Clerigo 5 tem 2 usos de Canalizar Divindade; Clerigo 10 tem 3
// (dados/classes/clerigo.json). O personagem tem nivel TOTAL 10.
//
// Medir o teto pelo numero na tela sozinho nao serve: `getProgressaoClerigo`
// ja usa `nivelNa` desde o 3b, entao o "2" do resumo ja esta certo hoje. O
// teto so e medido DE VERDADE pelo comportamento do handler -- quantas
// vezes o botao aceita ser clicado antes de esgotar. Uma implementacao que
// troque a guarda por `char.nivel` (10) aceitaria 3 cliques.
test('Oraculo 3 -- Paladino 5/Clerigo 5: o botao do Clerigo esgota em 2 usos (Clerigo 5), nao em 3 (nivel 10)', async ({ context }) => {
  const id = 'regras-3c-oraculo-3';
  const { page, erros } = await abrirFichaMulticlasse(
    context, PALADINO5_CLERIGO5, { recursos: structuredClone(RECURSOS_SEMEADOS) }, id);

  await exigirNoDom(page, BOTAO_CD_CLERIGO,
    'o botao de Canalizar Divindade do Clerigo precisa estar no DOM');

  // Tres tentativas: se o teto fosse o de nivel 10, a terceira passaria.
  // `tentarClicarFicha` tolera o botao ter virado `disabled` (nesse caso o
  // browser nem dispara o evento) -- que e justamente o comportamento
  // esperado da terceira.
  for (let i = 0; i < 3; i++) {
    await tentarClicarFicha(page, BOTAO_CD_CLERIGO);
  }

  const recursos = await recursosSalvos(page, id);
  expect(recursos.clerigo?.canalizar_divindade_usos_gastos,
    'tres cliques em um pool de Clerigo 5 gastam 2, nunca 3').toBe(2);

  const contador = await contadorDoWidget(page, BOTAO_CD_CLERIGO);
  expect(contador, 'o resumo tem de mostrar 0 de 2 -- teto de Clerigo 5')
    .toEqual({ disponiveis: 0, max: 2 });

  expect(erros, 'nenhum erro de console').toEqual([]);
});

// ============================================================
// Oraculo 4 -- Furia Persistente: o nivel que conta e o do Barbaro
// ============================================================
//
// Furia Persistente e caracteristica de Barbaro 15. A guarda de hoje e
// `char.classe !== 'Bárbaro' || char.nivel < 15`, e as DUAS metades estao
// erradas para multiclasse: a classe e o espelho da inicial, e `char.nivel`
// e o total.
//
// O par:
//  - Guerreiro 1/Barbaro 15 (total 16) TEM de responder -- hoje nao
//    responde, porque `char.classe` e 'Guerreiro';
//  - Guerreiro 10/Barbaro 5 (total 15) NAO pode responder -- e o caso que
//    mata a correcao preguicosa `temClasse(char, 'Bárbaro') && char.nivel >= 15`,
//    que passaria a aceitar um Barbaro de nivel 5.
//
// Os dois personagens comecam com 2 furias gastas, para "recuperou" ser
// observavel nos dois sentidos.
//
// ORDEM DAS METADES, DE PROPOSITO: a NEGATIVA roda primeiro. As duas metades
// falham por motivos opostos, e hoje so a positiva esta quebrada -- com a
// negativa antes, o proprio relatorio de falha prova que ela nao e vacua:
// para a saida acusar a metade positiva, a negativa teve de rodar inteira e
// passar. Invertendo, o teste morreria na primeira afirmacao e ninguem
// saberia se o lado negativo sequer chega a semear e clicar.
test('Oraculo 4 -- Furia Persistente responde no Guerreiro 1/Barbaro 15 e nao no Guerreiro 10/Barbaro 5', async ({ context }) => {
  // ---------- Metade negativa: Barbaro 5, total 15 ----------
  const idNao = 'regras-3c-oraculo-4-nao';
  const ladoNao = await abrirFichaMulticlasse(context, [
    { classe: 'Guerreiro', subclasse: 'Campeão', nivel: 10, ordem: 0 },
    { classe: 'Bárbaro', subclasse: 'Trilha do Berserker', nivel: 5, ordem: 1 },
  ], { recursos: { furia_usos_gastos: 2, furia_persistente_usada: false } }, idNao);

  // Guarda contra vacuidade do lado negativo: o bloco de Furia TEM de estar
  // renderizado. Sem ele, "nada mudou" seria verdade porque a ficha inteira
  // do Barbaro nao apareceu.
  await exigirNoDom(ladoNao.page, '[data-furia-toggle]',
    'o bloco de Furia do Barbaro precisa estar no DOM mesmo com Barbaro 5');

  // O botao pode ate nao existir na implementacao correta (se o render
  // passar a olhar o nivel NA classe) -- e isso tambem e "nao responde".
  await tentarClicarFicha(ladoNao.page, '[data-furia-iniciativa]');

  const recursosNao = await recursosSalvos(ladoNao.page, idNao);
  expect(recursosNao.furia_usos_gastos,
    'Guerreiro 10/Barbaro 5 nao tem Furia Persistente: as furias gastas nao podem ser zeradas').toBe(2);
  expect(recursosNao.furia_persistente_usada,
    'Guerreiro 10/Barbaro 5: nada de marcar uso de uma caracteristica que ele nao tem').toBe(false);

  expect(ladoNao.erros, 'nenhum erro de console (Guerreiro 10/Barbaro 5)').toEqual([]);

  // ---------- Metade positiva: Barbaro 15 de verdade ----------
  const idSim = 'regras-3c-oraculo-4-sim';
  const ladoSim = await abrirFichaMulticlasse(context, [
    { classe: 'Guerreiro', subclasse: '', nivel: 1, ordem: 0 },
    { classe: 'Bárbaro', subclasse: 'Trilha do Berserker', nivel: 15, ordem: 1 },
  ], { recursos: { furia_usos_gastos: 2, furia_persistente_usada: false } }, idSim);

  await exigirNoDom(ladoSim.page, '[data-furia-iniciativa]',
    'Barbaro 15 tem Furia Persistente: o botao de rolar iniciativa precisa estar no DOM');

  await clicarSeletorFicha(ladoSim.page, '[data-furia-iniciativa]');

  const recursosSim = await recursosSalvos(ladoSim.page, idSim);
  expect(recursosSim.furia_usos_gastos,
    'Guerreiro 1/Barbaro 15: a Furia Persistente tem de zerar as furias gastas').toBe(0);
  expect(recursosSim.furia_persistente_usada,
    'Guerreiro 1/Barbaro 15: o uso da Furia Persistente tem de ficar marcado').toBe(true);

  expect(ladoSim.erros, 'nenhum erro de console (Guerreiro 1/Barbaro 15)').toEqual([]);
});

// ============================================================
// Oraculo 5 -- CANARIO: classe unica continua funcionando
// ============================================================
//
// Nasce VERDE de proposito. E a rede que impede a Tarefa 2 de "consertar"
// o multiclasse quebrando o caso comum: se a nova guarda passar a exigir
// `char.classes`, ou ler o nivel de um lugar que a ficha legada nao tem,
// este teste cai junto.
test('Oraculo 5 (canario, nasce verde) -- Clerigo 5 de classe unica continua gastando Canalizar Divindade', async ({ context }) => {
  const id = 'regras-3c-oraculo-5';
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo',
    subclasse: 'Domínio da Vida',
    nivel: 5,
    xp: 14000,
    especie: 'Humano',
    atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Medicina', 'Religião'],
    recursos: { clerigo: { canalizar_divindade_usos_gastos: 0 } },
  }, id);
  await assentar(page).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });

  await exigirNoDom(page, BOTAO_CD_CLERIGO,
    'o botao de Canalizar Divindade precisa estar no DOM na ficha de classe unica');

  const antes = await contadorDoWidget(page, BOTAO_CD_CLERIGO);
  expect(antes, 'Clerigo 5 de classe unica comeca com 2 de 2').toEqual({ disponiveis: 2, max: 2 });

  await clicarSeletorFicha(page, BOTAO_CD_CLERIGO);

  const recursos = await recursosSalvos(page, id);
  expect(recursos.clerigo?.canalizar_divindade_usos_gastos,
    'classe unica: o clique continua gastando 1 uso').toBe(1);

  const depois = await contadorDoWidget(page, BOTAO_CD_CLERIGO);
  expect(depois, 'classe unica: a tela reflete 1 de 2').toEqual({ disponiveis: 1, max: 2 });

  expect(erros, 'nenhum erro de console').toEqual([]);
});

// ============================================================
// Tarefa 3 -- `data-config-maestrias`, o seletor generico
// ============================================================
//
// Fixture proprio: Barbaro 5 de ORDEM 0 (o espelho `char.classe` vira
// 'Barbaro') e Guerreiro 5 de ordem 1. As duas classes tem Maestria em
// Arma, entao a ficha renderiza DOIS botoes `data-config-maestrias`
// identicos no atributo -- so o carimbo `data-classe` os distingue.
//
// PONTO ONDE CERTO E ERRADO DIVERGEM: nivel 5 foi escolhido a dedo.
// dados/classes/barbaro.json da 3 maestrias no nivel 5 e
// dados/classes/guerreiro.json da 4 -- numeros DIFERENTES. Nos niveis 1-3
// os dois valores tambem divergem (2 contra 3), mas em nenhum nivel eles
// coincidem, entao qualquer nivel serviria; 5 mantem o fixture parecido
// com o resto do arquivo.
//
// ATUALIZADO PELA TAREFA 5 DO SUB-PROJETO 3d: o teto deixou de ser POR
// CLASSE. Desde a decisao de 2026-08-22 (docs/PERGUNTAS-PENDENTES.txt,
// PERGUNTA 2) ele e do PERSONAGEM -- o MAIOR entre as classes que concedem,
// nao a soma -- entao neste fixture os DOIS modais declaram 4, o teto do
// Guerreiro 5. A divergencia de 3 contra 4 continua sendo o que da valor ao
// fixture, mas agora do outro lado: e ela que prova que o modal do Barbaro
// NAO usa o numero da propria classe. Quem distingue os dois botoes passou a
// ser o TITULO do modal -- ver o Oraculo 7.
const BARBARO5_GUERREIRO5 = [
  { classe: 'Bárbaro', subclasse: 'Trilha do Berserker', nivel: 5, ordem: 0 },
  { classe: 'Guerreiro', subclasse: 'Campeão', nivel: 5, ordem: 1 },
];

const BOTAO_MAESTRIAS = '[data-config-maestrias]';

// ============================================================
// Oraculo 6 -- GUARDA CONTRA VACUIDADE do par de botoes
// ============================================================
//
// Nao mede o handler: mede a premissa dele. Se a ficha renderizar um botao
// so (ou nenhum, ou dois sem carimbo), o Oraculo 7 estaria clicando no
// vazio e passaria por AUSENCIA. Exige EXATAMENTE 2 -- nem 1, nem 3 --
// porque "pelo menos um" seria satisfeito pela ficha de classe unica.
test('Oraculo 6 -- Barbaro 5/Guerreiro 5: existem exatamente 2 botoes de maestria, carimbados com classes DIFERENTES', async ({ context }) => {
  const id = 'regras-3c-oraculo-6';
  const { page, erros } = await abrirFichaMulticlasse(
    context, BARBARO5_GUERREIRO5, {}, id);

  await exigirNoDom(page, BOTAO_MAESTRIAS,
    'a ficha precisa renderizar o botao de Definir Maestrias -- sem ele nao ha clique para medir');

  await expect.poll(() => page.locator(BOTAO_MAESTRIAS).count(),
    { message: 'Barbaro e Guerreiro tem AMBOS Maestria em Arma: a ficha tem de emitir os DOIS botoes' })
    .toBe(2);

  const classes = await classesCarimbadas(page, BOTAO_MAESTRIAS);
  expect([...classes].sort(),
    'cada botao tem de carregar o carimbo `data-classe` do bloco que o emitiu -- e a UNICA informacao de classe que o handler tem')
    .toEqual(['Bárbaro', 'Guerreiro']);

  expect(erros, 'nenhum erro de console').toEqual([]);
});

// ============================================================
// Oraculo 7 -- cada botao abre o modal DAQUELA classe
// ============================================================
//
// Mata: o handler que ignora o carimbo e deixa `abrirModalMaestrias()`
// decidir tudo por `char.classe`. Num Barbaro 5/Guerreiro 5 o espelho e
// 'Barbaro', entao os DOIS botoes abririam o modal ROTULADO como Barbaro.
//
// Mata tambem a correcao preguicosa que so acrescenta a guarda
// `temClasse(char, btn.dataset.classe)` sem PASSAR a classe adiante: a
// guarda passaria nos dois botoes (o personagem tem as duas classes) e os
// dois modais continuariam se anunciando como Barbaro.
//
// O QUE MUDOU NA TAREFA 5 DO 3d: o TETO deixou de distinguir os dois botoes
// -- ele agora e do PERSONAGEM (4, o maior entre Barbaro 5 = 3 e Guerreiro
// 5 = 4), e nao da classe do botao. Quem distingue passou a ser o TITULO,
// que continua saindo do parametro `classe` que o handler entrega. As duas
// metades exigem titulos DIFERENTES e teto IGUAL, e as duas coisas juntas
// sao o que prende o comportamento: teto igual sem titulo diferente
// significaria o carimbo perdido; titulo diferente com tetos diferentes
// significaria o teto agregado perdido.
//
// A metade do BARBARO e, ainda, um oraculo de Tarefa 5 por si: o modal do
// Barbaro 5 tem de deixar marcar 4, nao as 3 da tabela do Barbaro.
//
// ORDEM DAS METADES, DE PROPOSITO: o GUERREIRO vem primeiro, e sem salvar.
// Salvando na primeira metade, o modal seguinte abriria com N maestrias ja
// escolhidas e o teto deixaria de ser observavel pela contagem de caixas
// que "grudam". A metade do Barbaro, que fecha, e a que salva -- persistir
// tambem e contrato do handler.
test('Oraculo 7 -- Barbaro 5/Guerreiro 5: o botao de cada classe abre o modal de maestrias DAQUELA classe', async ({ context }) => {
  const id = 'regras-3c-oraculo-7';
  const { page, erros } = await abrirFichaMulticlasse(
    context, BARBARO5_GUERREIRO5, {}, id);

  // Guarda contra vacuidade, repetida aqui: sem os dois botoes carimbados
  // os seletores abaixo nao achariam nada e o teste morreria em timeout,
  // acusando o produto por um defeito de render.
  await exigirNoDom(page, BOTAO_MAESTRIAS, 'o botao de Definir Maestrias precisa estar no DOM');
  await expect.poll(() => page.locator(BOTAO_MAESTRIAS).count(),
    { message: 'os DOIS botoes de maestria precisam existir antes de qualquer clique' })
    .toBe(2);

  // ---------- Metade do Guerreiro: teto 4 (Guerreiro 5) ----------
  await clicarSeletorFicha(page, '[data-config-maestrias][data-classe="Guerreiro"]',
    { esperar: '#btn-salvar-maestrias' });

  const modalGuerreiro = await lerModalMaestrias(page);
  expect(modalGuerreiro.titulo,
    'o botao do Guerreiro tem de abrir o modal do GUERREIRO, nao o da classe inicial')
    .toContain('Guerreiro');
  expect(modalGuerreiro.teto,
    'o teto e do PERSONAGEM: 4, o maior entre Barbaro 5 (3) e Guerreiro 5 (4)')
    .toBe(4);
  expect(modalGuerreiro.caixas,
    'o modal precisa listar armas suficientes para o teto ser medido por comportamento')
    .toBeGreaterThan(6);

  const grudaramGuerreiro = await marcarMaestrias(page, 6);
  expect(grudaramGuerreiro,
    'seis tentativas num teto de Guerreiro 5 deixam 4 marcadas, nunca 3').toBe(4);

  await fecharModalAberto(page);

  // ---------- Metade do Barbaro: MESMO teto 4, titulo diferente ----------
  await clicarSeletorFicha(page, '[data-config-maestrias][data-classe="Bárbaro"]',
    { esperar: '#btn-salvar-maestrias' });

  const modalBarbaro = await lerModalMaestrias(page);
  expect(modalBarbaro.titulo,
    'o botao do Barbaro tem de abrir o modal do BARBARO').toContain('Bárbaro');
  expect(modalBarbaro.titulo,
    'os dois botoes nao podem abrir o MESMO modal -- o do Barbaro nao se anuncia como Guerreiro')
    .not.toContain('Guerreiro');
  // Tarefa 5 do 3d: 4, nao as 3 da tabela do Barbaro. O teto e do
  // personagem, e o botao clicado nao muda o numero.
  expect(modalBarbaro.teto,
    'o teto e o mesmo do outro botao: 4, o maior entre Barbaro 5 (3) e Guerreiro 5 (4)')
    .toBe(4);

  const grudaramBarbaro = await marcarMaestrias(page, 6);
  expect(grudaramBarbaro,
    'seis tentativas no modal do Barbaro deixam 4 marcadas -- o teto do personagem, nao as 3 da classe')
    .toBe(4);

  // O cancelamento da metade anterior nao pode ter gravado nada.
  await clicarSeletorFicha(page, '#btn-salvar-maestrias');
  const salvas = await maestriasSalvas(page, id);
  expect(salvas.length,
    'o clique em Salvar grava exatamente as 4 maestrias do teto do personagem').toBe(4);

  expect(erros, 'nenhum erro de console').toEqual([]);
});

// ============================================================
// Tarefa 4 -- helpers: ler o que so sai por toast() ou por modal
// ============================================================
//
// As duas dividas que esta tarefa quita tem a MESMA forma: o numero que
// carrega a regra (a CD de Presenca Intimidante, a contagem de d4s de Maos
// Curativas) e calculado DENTRO de um listener de clique e sai so como
// texto efemero -- nao ha fachada publica de modulo que o exponha, e foi
// exatamente por isso que o sub-projeto 3b nao conseguiu cobri-los.

/**
 * Instala um observador que GUARDA o texto de todo toast que nascer daqui
 * em diante, em `window.__toastsTarefa4`.
 *
 * `toast()` (utils.js:723) remove o elemento depois de 3 segundos, e o
 * handler ainda chama `renderFichaCompleta()` logo em seguida -- ler o
 * `#toast-container` "logo apos a acao" e uma corrida que sob carga
 * paralela perde. Observar `document.body` inteiro (childList + subtree)
 * captura o texto no instante em que ele e inserido, entao a leitura
 * depois nao depende mais do relogio.
 *
 * @param {import('@playwright/test').Page} page
 */
async function capturarToasts(page) {
  await page.evaluate(() => {
    window.__toastsTarefa4 = [];
    window.__obsToastsTarefa4?.disconnect();
    const obs = new MutationObserver((mutacoes) => {
      for (const m of mutacoes) {
        for (const no of m.addedNodes) {
          if (no.nodeType !== 1) continue;
          if (no.classList?.contains('toast')) window.__toastsTarefa4.push(no.textContent || '');
          no.querySelectorAll?.('.toast')
            .forEach((t) => window.__toastsTarefa4.push(t.textContent || ''));
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    window.__obsToastsTarefa4 = obs;
  });
}

/**
 * Devolve os textos de toast capturados desde `capturarToasts`.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
async function toastsCapturados(page) {
  return page.evaluate(() => window.__toastsTarefa4 || []);
}

/**
 * Espera pelo primeiro toast que casar com `regex` e devolve o texto dele.
 *
 * Falha o teste (via expect.poll) se nenhum toast casar -- assim "o numero
 * certo nao apareceu" nunca passa por AUSENCIA de toast.
 *
 * @param {import('@playwright/test').Page} page
 * @param {RegExp} regex
 * @param {string} mensagem Por que esse toast tem de existir.
 * @returns {Promise<string>}
 */
async function esperarToast(page, regex, mensagem) {
  await expect.poll(async () => (await toastsCapturados(page)).filter((t) => regex.test(t)).length,
    { message: mensagem }).toBeGreaterThan(0);
  return (await toastsCapturados(page)).find((t) => regex.test(t));
}

/**
 * Le o corpo do modal aberto (texto puro).
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
async function corpoDoModal(page) {
  return page.evaluate(() => document.getElementById('modal-corpo')?.textContent || '');
}

/**
 * Le o mapa `usos_habilidades` do personagem SALVO no store, pelo id.
 *
 * Mesma disciplina de `recursosSalvos`: dado CRU gravado, nao o resultado
 * de uma funcao de producao. Tracos de especie nao vivem em `recursos` --
 * eles gravam em `usos_habilidades`, com chave `especie_<nome>`.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 * @returns {Promise<object>}
 */
async function usosHabilidadesSalvos(page, id) {
  return page.evaluate(async (alvo) => {
    const store = await import(new URL('./js/store.js', location.href).href);
    const p = store.listarPersonagens().find((x) => x.id === alvo);
    return (p && p.usos_habilidades) || {};
  }, id);
}

// ============================================================
// Oraculo 8 -- a CD de Presenca Intimidante (divida do 3b)
// ============================================================
//
// `docs/PERGUNTAS-PENDENTES.txt` registrava: a CD de Presenca Intimidante
// (site/js/sheet/classes/barbaro.js) nao tinha oraculo nenhum -- mutada,
// a suite inteira de ~3450 testes passava. Ela vive dentro do listener de
// `[data-berserker-acao]` e so sai como texto de `toast()`; cobri-la no 3b
// exigiria expor uma fachada publica nova nos 12 modulos de classe, o que
// aquela tarefa proibia. Este arquivo E a superficie de handler que
// faltava.
//
// A REGRA: "CD 8 + seu modificador de Forca + seu Bonus de Proficiencia"
// (Trilha do Berserker, nivel 14). O Bonus de Proficiencia vem do nivel
// TOTAL de personagem, "nao do nivel de uma classe especifica"
// (PHB.md:2047) -- e essa e a unica leitura de nivel neste calculo que NAO
// pode virar `nivelNa`.
//
// FIXTURE, e por que este: Presenca Intimidante e caracteristica de
// Berserker NIVEL 14 (dados/classes/barbaro.json), entao o Barbaro 3 que o
// brief sugeria nem renderiza o botao. Barbaro 14 e o minimo possivel, e
// com ele o maior nivel total disponivel (17-20) e a unica faixa de Bonus
// de Proficiencia diferente:
//
//   nivel TOTAL 17 (Guerreiro 3 + Barbaro 14) -> Bonus de Proficiencia +6
//   nivel NA CLASSE 14 (so o Barbaro)         -> Bonus de Proficiencia +5
//
// FORCA 18, DE PROPOSITO -- a armadilha que ja mordeu este projeto: na
// Tarefa 3 do 3b um oraculo de CD passou lendo o ATRIBUTO errado porque o
// fixture padrao tem Forca 15 e Carisma 15 (mesmo modificador), e certo e
// errado coincidiam. `ATRIBUTOS_REGRAS` e forca 15 (+2), destreza 14 (+2),
// constituicao 14 (+2), inteligencia/sabedoria/carisma 13 (+1) -- a Forca
// empata com DOIS outros atributos. Com Forca 18 o modificador vira +4,
// UNICO na ficha: nenhum outro atributo produz a CD 18, entao o oraculo
// so passa somando a Forca de verdade.
//
//   CD certa  (nivel TOTAL 17):    8 + 4 + 6 = 18
//   CD errada (nivel de classe 14): 8 + 4 + 5 = 17
//   CD por atributo errado:        8 + 2 + 6 = 16  (DES/CON)
//                                  8 + 1 + 6 = 15  (INT/SAB/CAR)
//
// Par em direcoes opostas: a CD certa APARECE no toast e a errada NAO.
const BARBARO14_GUERREIRO3 = [
  { classe: 'Guerreiro', subclasse: 'Campeão', nivel: 3, ordem: 0 },
  { classe: 'Bárbaro', subclasse: 'Trilha do Berserker', nivel: 14, ordem: 1 },
];

// Forca com modificador que nao coincide com o de nenhum outro atributo.
const ATRIBUTOS_FORCA_DISTINTA = { ...ATRIBUTOS_REGRAS, forca: 18 };

const BOTAO_PRESENCA = '[data-berserker-acao="presenca-intimidante"]';

test('Oraculo 8 -- Guerreiro 3/Barbaro 14: a CD de Presenca Intimidante usa o Bonus de Proficiencia do nivel TOTAL', async ({ context }) => {
  const id = 'regras-3c-oraculo-8';
  const { page, erros } = await abrirFichaMulticlasse(
    context, BARBARO14_GUERREIRO3, {
      atributos: ATRIBUTOS_FORCA_DISTINTA,
      recursos: { presenca_intimidante_usada: false, furia_usos_gastos: 0 },
    }, id);

  // GUARDA CONTRA VACUIDADE: sem o botao no DOM nao ha clique, nao ha
  // toast, e "a CD errada nao apareceu" seria verdade por ausencia.
  await exigirNoDom(page, BOTAO_PRESENCA,
    'Barbaro 14 da Trilha do Berserker tem Presenca Intimidante: o botao precisa estar no DOM');

  await capturarToasts(page);
  await clicarSeletorFicha(page, BOTAO_PRESENCA);

  const texto = await esperarToast(page, /Presença Intimidante ativada/,
    'o clique tem de produzir o toast de ativacao -- e dele que a CD sai');

  const cd = Number(/CD\s+(\d+)/.exec(texto)?.[1]);

  // Direcao 1: a CD certa aparece.
  expect(cd, 'CD = 8 + modFor (+4, Forca 18) + Bonus de Proficiencia do nivel TOTAL 17 (+6)')
    .toBe(18);

  // Direcao 2 (a que mata a mutacao): a CD do nivel NA CLASSE nao aparece.
  expect(texto, 'a CD nao pode sair do nivel de Barbaro (14 -> +5, CD 17): o Bonus de ' +
    'Proficiencia vem do nivel total de personagem (PHB.md:2047)')
    .not.toContain('CD 17');

  // O handler tem de ter mesmo rodado ate o fim, e nao so emitido texto.
  const recursos = await recursosSalvos(page, id);
  expect(recursos.presenca_intimidante_usada,
    'o clique tem de marcar o uso e GRAVAR -- prova que o toast veio do handler completo')
    .toBe(true);

  expect(erros, 'nenhum erro de console').toEqual([]);
});

// ============================================================
// Oraculo 9 -- Maos Curativas do Aasimar (a divida da Tarefa 2)
// ============================================================
//
// A revisao da Tarefa 2 deste sub-projeto mutou a leitura preservada de
// `habilidades.js` (`bonusProficiencia(char.nivel || 1)`, dentro da guarda
// `char.especie !== 'Aasimar'`) para `nivelNa` e rodou a suite inteira:
// 5/5 verdes. A unica mencao a "Maos Curativas" em `testes/` era catalogo
// de especie e a asercao de RENDER de multiclasse-caracteristicas.spec.mjs
// (que le o rotulo do botao, "Curar (4d4)", produzido por
// sheet/caracteristicas.js) -- ninguem CLICAVA no botao, e o handler
// calcula o proprio Bonus de Proficiencia de novo, por conta propria.
//
// A leitura esta CERTA e tem de continuar assim: Maos Curativas e traco de
// ESPECIE (nao existe "nivel na classe" para especie) e rola "um numero de
// d4s igual ao seu Bonus de Proficiencia" (Especies.md:25), que vem do
// nivel TOTAL (PHB.md:2047). Este oraculo e a rede contra converte-la por
// analogia num lote futuro.
//
// FIXTURE MULTICLASSE, obrigatoriamente: em classe unica `nivelNa` e nivel
// total coincidem e a mutacao passa despercebida -- foi exatamente isso
// que o revisor mediu. E os niveis tem de cair em faixas DIFERENTES de
// Bonus de Proficiencia, o que a sugestao do brief (Guerreiro 3/Clerigo 2)
// nao garante o bastante. Escolhido Guerreiro 5/Clerigo 4:
//
//   nivel TOTAL 9              -> Bonus de Proficiencia +4 -> 4d4  (certo)
//   nivel de Guerreiro 5       -> +3 -> 3d4  (mutacao pelo espelho char.classe)
//   nivel de Clerigo 4         -> +2 -> 2d4  (mutacao pela outra classe)
//
// Os TRES numeros sao distintos, entao nao ha ponto onde certo e errado
// coincidam -- por qualquer classe que a conversao errada escolhesse.
//
// O Guerreiro entra em ordem 0 de proposito: `char.classe` (o espelho) e
// 'Guerreiro', que e o que a mutacao mais provavel
// (`nivelNa(char, char.classe)`) leria.
//
// ANCORA NO MODAL, e nao no rotulo do botao: o rotulo sai de
// `sheet/caracteristicas.js`, que faz a propria conta e NAO seria afetado
// por uma mutacao em `habilidades.js`. So o texto "Nd4 = [...]" do modal
// vem do `pb` que o handler calculou.
const AASIMAR_GUERREIRO5_CLERIGO4 = [
  { classe: 'Guerreiro', subclasse: 'Campeão', nivel: 5, ordem: 0 },
  { classe: 'Clérigo', subclasse: 'Domínio da Vida', nivel: 4, ordem: 1 },
];

const BOTAO_MAOS_CURATIVAS = '[data-maos-curativas]';

test('Oraculo 9 -- Aasimar Guerreiro 5/Clerigo 4: Maos Curativas rola d4s pelo Bonus de Proficiencia do nivel TOTAL', async ({ context }) => {
  const id = 'regras-3c-oraculo-9';
  const { page, erros } = await abrirFichaMulticlasse(
    context, AASIMAR_GUERREIRO5_CLERIGO4, { especie: 'Aasimar' }, id);

  // GUARDA CONTRA VACUIDADE: sem o botao de especie no DOM nao ha clique.
  await exigirNoDom(page, BOTAO_MAOS_CURATIVAS,
    'o botao de Maos Curativas do Aasimar precisa estar no DOM -- sem ele nao ha clique para medir');

  await clicarSeletorFicha(page, BOTAO_MAOS_CURATIVAS, { esperar: '#modal-overlay' });

  await expect.poll(() => corpoDoModal(page),
    { message: 'o clique tem de abrir o modal de Maos Curativas com a rolagem' })
    .toMatch(/\d+d4\s*=\s*\[/);

  const corpo = await corpoDoModal(page);
  const m = /(\d+)d4\s*=\s*\[([^\]]*)\]/.exec(corpo);
  const rolagens = m[2].split(',').map((s) => s.trim()).filter(Boolean);

  // Direcao 1: o numero DECLARADO e o do nivel total.
  expect(Number(m[1]),
    'nivel total 9 -> Bonus de Proficiencia +4 -> 4d4 (Especies.md:25 + PHB.md:2047)')
    .toBe(4);

  // Direcao 1b -- comportamental: o handler rolou mesmo 4 dados. So o
  // rotulo seria satisfeito por um "4d4" escrito a mao sobre 3 rolagens.
  expect(rolagens.length,
    'o modal tem de listar UMA rolagem por dado: 4 dados, nao 3 (Guerreiro 5) nem 2 (Clerigo 4)')
    .toBe(4);

  // Direcao 2: nenhuma das contagens por nivel de classe pode aparecer.
  expect(corpo, 'Maos Curativas e traco de ESPECIE: nao pode rolar pelo nivel de Guerreiro (5 -> +3)')
    .not.toContain('3d4');
  expect(corpo, 'nem pelo nivel de Clerigo (4 -> +2)')
    .not.toContain('2d4');

  // O handler tem de ter gravado o uso -- prova que o modal veio dele.
  const usos = await usosHabilidadesSalvos(page, id);
  expect(usos['especie_Mãos Curativas'],
    'o clique tem de marcar Maos Curativas como usado e GRAVAR').toBeTruthy();

  expect(erros, 'nenhum erro de console').toEqual([]);
});

// ============================================================
// Oraculo 10 -- a COSTURA: o resumo do topo nao pode contradizer o modal
// ============================================================
//
// REGRESSAO NOVA do 3c, e a unica dos quatro pontos de ficha.js que o
// sub-projeto PIOROU. Antes, o tooltip da caixa de resumo
// (site/js/sheet/ficha.js) e o modal do handler (site/js/sheet/
// habilidades.js) liam os DOIS `char.nivel` -- o nivel TOTAL -- e diziam o
// mesmo numero errado. A Tarefa 2 converteu so o handler para `nivelNa`.
// Resultado: num Guerreiro 5/Barbaro 11 a mesma tela passou a exibir 32 no
// tooltip e 22 no modal, e o usuario nao tem como saber qual acreditar.
//
// A regra: Furia Implacavel restaura "duas vezes seu nivel de BARBARO"
// (Classes.md:151). Barbaro 11 -> 22. O nivel total 16 -> 32 e o valor
// errado, e e justamente o que o tooltip dizia.
//
// FIXTURE, de proposito Guerreiro 5/Barbaro 11:
//  - Guerreiro em ORDEM 0, entao o espelho `char.classe` e 'Guerreiro' e o
//    espelho `char.nivel` e 16 -- exatamente o que a leitura defeituosa le;
//  - Barbaro 11 e o minimo que concede Furia Implacavel (barbaro.js:81),
//    entao o botao existe;
//  - 22 (Barbaro 11), 32 (total 16) e 10 (Guerreiro 5) sao TRES numeros
//    distintos: nao ha ponto onde o certo e o errado coincidam.
//
// DUAS DIRECOES, e as duas importam:
//  1. os dois lugares dizem o MESMO numero (a costura em si -- este e o
//     unico oraculo que compara as duas superficies entre si);
//  2. esse numero e 22 (senao "iguais" seria satisfeito revertendo o
//     handler para 32 e voltando ao erro coerente de antes).

// Guerreiro de ordem 0 + Barbaro 11: total 16, nivel de Barbaro 11.
const GUERREIRO5_BARBARO11 = [
  { classe: 'Guerreiro', subclasse: 'Campeão', nivel: 5, ordem: 0 },
  { classe: 'Bárbaro', subclasse: 'Trilha do Berserker', nivel: 11, ordem: 1 },
];

const BOTAO_FURIA_IMPLACAVEL = '[data-furia-implacavel]';

/**
 * Le o `title` do selo "Implacavel CD N" da caixa de resumo do topo.
 *
 * Ancora pelo TEXTO do proprio tooltip ("Sucesso = PV =") e nao por uma
 * classe CSS ou posicao: e o unico elemento da ficha que declara esse par,
 * e um seletor estrutural quebraria a cada ajuste de layout.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string|null>} O texto do tooltip, ou null se nao existe.
 */
async function tooltipFuriaImplacavel(page) {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll('[title]')) {
      const t = el.getAttribute('title') || '';
      if (/Sucesso\s*=\s*PV\s*=/.test(t)) return t;
    }
    return null;
  });
}

test('Oraculo 10 -- Guerreiro 5/Barbaro 11: o tooltip do resumo e o modal de Furia Implacavel dizem o MESMO PV, e ele e 22', async ({ context }) => {
  const id = 'regras-3c-oraculo-10';
  const { page, erros } = await abrirFichaMulticlasse(
    context, GUERREIRO5_BARBARO11,
    // Furia ATIVA: o botao de Furia Implacavel so e emitido com a furia em
    // curso (ficha.js) e o handler recusa sem ela (habilidades.js).
    { recursos: { furia_ativa: true, furia_usos_gastos: 0, furia_implacavel_cd: 10 } },
    id);

  // GUARDA CONTRA VACUIDADE (1/2): sem o botao no DOM nao ha modal para ler,
  // e "os dois numeros batem" passaria por ausencia dos dois.
  await exigirNoDom(page, BOTAO_FURIA_IMPLACAVEL,
    'Barbaro 11 tem Furia Implacavel: o botao precisa estar no DOM');

  // GUARDA CONTRA VACUIDADE (2/2): o tooltip do resumo tem de existir e
  // declarar um numero. Um tooltip que sumisse tornaria a comparacao vazia.
  const tooltip = await tooltipFuriaImplacavel(page);
  expect(tooltip,
    'a caixa de resumo tem de trazer o selo "Implacavel CD N" com o tooltip do PV').not.toBeNull();
  const mTooltip = /Sucesso\s*=\s*PV\s*=\s*(\d+)/.exec(tooltip);
  expect(mTooltip, 'o tooltip tem de declarar um PV numerico').not.toBeNull();
  const pvTooltip = Number(mTooltip[1]);

  await clicarSeletorFicha(page, BOTAO_FURIA_IMPLACAVEL, { esperar: '#modal-overlay' });

  await expect.poll(() => corpoDoModal(page),
    { message: 'o clique tem de abrir o modal de Furia Implacavel com o PV de sucesso' })
    .toMatch(/PV mudam para\s*\d+/);

  const corpo = await corpoDoModal(page);
  const mModal = /PV mudam para\s*(\d+)/.exec(corpo);
  const pvModal = Number(mModal[1]);

  // Direcao 1 -- A COSTURA: a mesma tela nao pode dizer duas coisas.
  expect(pvTooltip,
    `a caixa de resumo diz ${pvTooltip} PV e o modal diz ${pvModal} PV na MESMA tela: ` +
    'tooltip e modal tem de sair da mesma leitura de nivel').toBe(pvModal);

  // Direcao 2 -- e o numero certo e o do nivel DE BARBARO (Classes.md:151).
  expect(pvTooltip,
    'Barbaro 11 -> "duas vezes seu nivel de Barbaro" = 22 PV, nao 32 (nivel total 16)').toBe(22);

  // Direcao 3 -- o valor errado nao pode sobrar em lugar nenhum dos dois.
  expect(tooltip, 'o tooltip nao pode citar o PV do nivel TOTAL (16 -> 32)').not.toContain('32');
  expect(corpo, 'o modal nao pode citar o PV do nivel TOTAL (16 -> 32)').not.toContain('32');

  expect(erros, 'nenhum erro de console').toEqual([]);
});
