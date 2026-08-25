// ============================================================
// Tarefa 9 (sub-projeto 3e): o clique de verdade que o guarda estático
// não mede.
//
// As cinco conversões desta tarefa (ficha.js) trocam char.nivel/
// char.subclasse por nivelNa/subclasseDe DENTRO de painéis que já
// aparecem na hora certa (o estadoX que os guarda já foi convertido nos
// sub-projetos 3a/3b). Quatro delas são só TEXTO -- um oráculo de unidade
// que renderiza e lê o HTML mede o suficiente (multiclasse-descansos.test.mjs,
// oráculos 26-28). A quinta guarda um BOTÃO: com char.subclasse, num
// Mago 5/Feiticeiro 5 (Feitiçaria Selvagem) o bloco inteiro (aviso de
// Surto + botão "Marcar resolvido") nem era emitido no HTML -- e um
// guarda estático não distingue "o botão existe e não funciona" de "o
// botão não existe". A revisão final do sub-projeto 3d mediu que, dos 19
// defeitos plausíveis daquela tarefa, 4 escapavam de toda a rede de
// unidade por essa fronteira. Este spec é a rede que falta: abre a ficha
// de verdade, exige o botão no DOM, CLICA nele, e mede o re-render e a
// persistência.
//
// Segue a estrutura de multiclasse-handlers.spec.mjs (helper de montar
// personagem multiclasse + abrir a ficha, leitura do `recursos` salvo no
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
 * Mesmo mecanismo de `abrirFichaMulticlasse` (multiclasse-handlers.spec.mjs):
 * os espelhos (`classe`, `subclasse`, `nivel`) são preenchidos com o que
 * `sincronizarEspelhos()` produziria -- a classe INICIAL e o nível TOTAL --
 * que é exatamente o que a leitura defeituosa (`char.subclasse`,
 * `char.nivel`) lia antes desta tarefa.
 *
 * @param {import('@playwright/test').BrowserContext} context
 * @param {Array<{classe:string,subclasse:string,nivel:number,ordem:number}>} classes
 * @param {object} extras Campos extras do personagem (ex.: `recursos`).
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
 * Lê o objeto `recursos` do personagem SALVO no store, pelo id -- dado CRU
 * gravado, não o resultado de `getEstadoRecursosFeiticeiro()`, para o
 * clique provar que persistiu (não só que a tela mudou).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 * @returns {Promise<object>}
 */
async function recursosSalvos(page, id) {
  return page.evaluate(async (alvo) => {
    const store = await import(new URL('./js/store.js', location.href).href);
    const p = store.listarPersonagens().find((x) => x.id === alvo);
    return (p && p.recursos) || {};
  }, id);
}

/**
 * GUARDA CONTRA VACUIDADE: exige que o widget exista no DOM antes de
 * qualquer afirmação sobre ele. Mesma disciplina de
 * multiclasse-handlers.spec.mjs -- sem isso, um bloco que simplesmente
 * não renderiza faria "o aviso sumiu" passar por AUSÊNCIA desde o
 * início, e não por efeito do clique.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} seletor Seletor CSS do widget.
 * @param {string} mensagem Por que ele precisa estar lá.
 */
async function exigirNoDom(page, seletor, mensagem) {
  await expect.poll(() => page.locator(seletor).count(), { message: mensagem })
    .toBeGreaterThan(0);
}

const BOTAO_SURTO_RESOLVIDO = '[data-feiticeiro-acao="surto-resolvido"]';
const TEXTO_AVISO_SURTO = 'Surto de Magia Selvagem automático pendente';

/**
 * Recursos semeados: Surto de Magia Selvagem automático PENDENTE -- a
 * pré-condição que faz ficha.js emitir o aviso e o botão "Marcar
 * resolvido" (site/js/sheet/classes/feiticeiro.js normaliza os outros
 * campos de `subclasses.selvagem` só quando o objeto inteiro está
 * ausente, então os três campos são semeados aqui para não depender
 * dessa normalização).
 */
const RECURSOS_SURTO_PENDENTE = {
  feiticeiro: {
    subclasses: {
      selvagem: {
        mares_caos_disponivel: true,
        surto_pendente_automatico: true,
        surto_controlado_usado: false,
      },
    },
  },
};

/**
 * Roda os passos 3-6 do cenário sobre uma ficha já aberta: exige o aviso e
 * o botão visíveis, clica, e mede o re-render + a persistência.
 *
 * Extraído para função porque o passo 7 (controle de classe única) roda a
 * MESMA sequência de asserções sobre um personagem diferente -- duplicar
 * as seis expectativas duas vezes seria exatamente o tipo de cópia que já
 * causou divergência neste projeto.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string[]} erros Erros de console/página coletados por `abrirFicha`.
 * @param {string} id Id do personagem no store.
 * @param {string} rotulo Rótulo do fixture, para as mensagens de falha.
 */
async function medirSurtoPendenteEClique(page, erros, id, rotulo) {
  // Passo 3: o aviso está visível -- com char.subclasse ele sumia
  // INTEIRO num Mago/Feiticeiro (subclasse "" não bate com Selvagem).
  await expect(page.getByText(TEXTO_AVISO_SURTO),
    `${rotulo}: o aviso de Surto pendente tem de estar visível`).toBeVisible();

  // Passo 4: o botão existe E está visível -- não é um botão que não
  // funciona, é um botão que nem era EMITIDO.
  await exigirNoDom(page, BOTAO_SURTO_RESOLVIDO,
    `${rotulo}: o botão "Marcar resolvido" precisa estar no DOM`);
  await expect(page.locator(BOTAO_SURTO_RESOLVIDO),
    `${rotulo}: o botão "Marcar resolvido" precisa estar visível`).toBeVisible();

  // Passo 5: o clique de verdade.
  await clicarSeletorFicha(page, BOTAO_SURTO_RESOLVIDO);

  // Passo 6: o re-render tira o aviso da tela, e o clique persiste.
  await expect(page.getByText(TEXTO_AVISO_SURTO),
    `${rotulo}: o aviso tem de sumir depois do clique em "Marcar resolvido"`).toBeHidden();

  const recursos = await recursosSalvos(page, id);
  expect(recursos.feiticeiro?.subclasses?.selvagem?.surto_pendente_automatico,
    `${rotulo}: o clique tem de GRAVAR surto_pendente_automatico = false`).toBe(false);

  expect(erros, `${rotulo}: nenhum erro de console`).toEqual([]);
}

// ============================================================
// Cenário principal -- Mago 5/Feiticeiro 5 (Feitiçaria Selvagem)
// ============================================================
//
// Mago em ORDEM 0, de propósito: o espelho `char.subclasse` fica sendo o
// do Mago ("", já que Mago não tem subclasse com esse nome cadastrado
// aqui) -- exatamente a leitura que `escHtml(char.subclasse)` e as
// guardas `char.subclasse || ''` liam antes da conversão da Tarefa 9.
const MAGO5_FEITICEIRO5_SELVAGEM = [
  { classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Feiticeiro', subclasse: 'Feitiçaria Selvagem', nivel: 5, ordem: 1 },
];

test('Mago 5/Feiticeiro 5 (Feitiçaria Selvagem): o aviso de Surto pendente aparece e o botão "Marcar resolvido" funciona', async ({ context }) => {
  const id = 'regras-3e-t9-surto-multiclasse';
  const { page, erros } = await abrirFichaMulticlasse(
    context, MAGO5_FEITICEIRO5_SELVAGEM,
    { recursos: structuredClone(RECURSOS_SURTO_PENDENTE) }, id);

  await exigirNoDom(page, '.info-box', 'a ficha precisa ter renderizado ao menos um painel de recursos');

  await medirSurtoPendenteEClique(page, erros, id, 'Mago 5/Feiticeiro 5');
});

// ============================================================
// Passo 7 -- CONTROLE de classe única: Feiticeiro 10 (Feitiçaria
// Selvagem) com a mesma pendência.
// ============================================================
//
// Nasce VERDE de propósito: é a rede que impede a Tarefa 9 de "consertar"
// o multiclasse quebrando o caso comum. Feiticeiro de classe única já
// tinha `char.subclasse` correto (é a própria classe inicial), então o
// defeito nunca apareceu aqui -- mas se a conversão para `subclasseDe`
// introduzisse uma regressão (ex.: `classesDe(char)` vazio fora de um
// contexto multiclasse), este teste cairia junto.
test('CONTROLE -- Feiticeiro 10 (Feitiçaria Selvagem) de classe única: mesmo comportamento', async ({ context }) => {
  const id = 'regras-3e-t9-surto-classe-unica';
  const { page, erros } = await abrirFicha(context, {
    classe: 'Feiticeiro',
    subclasse: 'Feitiçaria Selvagem',
    nivel: 10,
    xp: 64000,
    especie: 'Humano',
    atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Arcanismo', 'Religião'],
    recursos: structuredClone(RECURSOS_SURTO_PENDENTE),
  }, id);
  await assentar(page).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });

  await exigirNoDom(page, '.info-box', 'a ficha precisa ter renderizado ao menos um painel de recursos');

  await medirSurtoPendenteEClique(page, erros, id, 'Feiticeiro 10 (classe única)');
});
