// Service Worker e funcionamento offline.
//
// Este arquivo roda no projeto `offline`, o unico que PERMITE Service Worker.
// Todos os outros o bloqueiam de proposito, para que o cache nunca mascare uma
// regressao.
//
// Historia deste arquivo, porque ela explica as asserções:
//
// 1. `site/sw.js` precacheava uma lista MANUAL de 12 arquivos. Isso cobria 12
//    de 22 modulos antes da quebra dos monolitos e passou a cobrir 12 de 61
//    depois -- de 52,4% para 18,3%. Estes testes MEDIRAM essa regressao, em
//    vez de raciocinar sobre ela.
// 2. A correcao foi gerar o manifesto no deploy (js-precache.json), varrendo
//    site/js/**, do mesmo jeito que ja se fazia para dados/.
// 3. Resultado medido: 100% dos modulos carregados terminam em cache, e a
//    home passou a abrir offline.
//
// 4. Ate 2026-08-23 este arquivo rodava contra DOIS sites, usando o repo
//    pre-refatoracao como controle. A suite de paridade foi aposentada
//    nessa data (o repo original parou em 2026-08-08 e o projeto seguiu
//    20+ commits de feature adiante), e as asercoes que dependiam do
//    controle viraram ALVOS ABSOLUTOS -- que e o que elas ja deviam ser:
//    exigir paridade era exigir que o novo fosse tao limitado quanto o
//    antigo, e o proprio arquivo ja dizia isso de duas delas.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { test, expect } from '@playwright/test';
import { NOVO } from './helpers.mjs';

// Os manifestos de precache sao gerados no DEPLOY (.github/workflows/
// deploy.yml), varrendo site/js/** e dados/**. Numa copia de trabalho eles
// nao existem, e o proprio sw.js trata isso como caso normal ("Local/dev
// pode nao existir"). Sem eles o Service Worker cacheia so sob demanda, e
// os dois testes que medem cobertura de precache falham por AUSENCIA DE
// ARTEFATO, nao por regressao.
//
// Pular e mais honesto que falhar: teste permanentemente vermelho nao
// verifica nada, so ensina a ignorar a saida -- foi o argumento com que
// este projeto aposentou o baseline dos monolitos em b02f1e1.
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEM_MANIFESTO = existsSync(resolve(RAIZ, 'site', 'js-precache.json'));

const SITES = [['refatorado', NOVO]];

/**
 * Abre o site, zera qualquer cache anterior, espera o Service Worker ativar e
 * o app carregar por completo.
 *
 * A limpeza previa nao e higiene opcional: sem ela uma execucao anterior pode
 * servir modulos velhos, e o teste passa medindo o passado.
 */
async function instalarSW(context, base) {
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });

  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    const chaves = await caches.keys();
    await Promise.all(chaves.map((k) => caches.delete(k)));
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => navigator.serviceWorker.ready);

  // Recarregar ate a pagina estar CONTROLADA pelo Service Worker.
  //
  // Isto nao e paranoia: no carregamento em que o SW e registrado, a pagina
  // ainda nao e controlada por ele, entao o handler de `fetch` nao roda e
  // NADA e cacheado sob demanda. So o precache do `install` acontece -- e ele
  // e uma lista manual de 12 arquivos, incompleta nos dois sites. Sem este
  // passo, o teste mede um cenario que nenhum usuario real vive: instalar o
  // SW e ir offline sem nunca revisitar a pagina.
  for (let i = 0; i < 5; i++) {
    const controlada = await page.evaluate(
      () => navigator.serviceWorker.controller !== null);
    if (controlada) break;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
  }
  const controlada = await page.evaluate(
    () => navigator.serviceWorker.controller !== null);
  if (!controlada) throw new Error('a pagina nunca ficou sob controle do SW');

  // Agora sim: o grafo inteiro e importado no boot e passa pelo handler de
  // fetch, que cacheia cada modulo. Esperar a rede acalmar garante isso.
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2500);
  return page;
}

/** Estado observavel de uma rota carregada offline. */
async function estadoOffline(context, base, hash) {
  const page = await instalarSW(context, base);
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));

  await context.setOffline(true);
  // `goto` e nao `reload`: recarregar uma pagina ja aberta faz o navegador
  // revalidar a navegacao pela rede antes de consultar o Service Worker, e
  // offline isso aborta. `goto` passa pelo SW.
  await page.goto(base + hash, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(3000);

  const estado = await page.evaluate(() => ({
    shell: document.getElementById('app-header') !== null,
    titulo: document.title,
    conteudo: (document.getElementById('app-content')?.innerHTML || '').trim().length > 100,
    passos: document.querySelectorAll('.wizard-step').length,
  }));
  await context.setOffline(false);
  await page.close();
  return { ...estado, erros };
}

test('a home abre offline depois de instalado o Service Worker', async ({ context }) => {
  test.skip(!TEM_MANIFESTO, 'js-precache.json e gerado no deploy; ausente nesta copia');

  const b = await estadoOffline(context, NOVO, '');

  // Alvos ABSOLUTOS. Ate 2026-08-23 este teste comparava contra o site
  // pre-refatoracao, que servia o shell mas nao abria a home offline --
  // entao as asercoes de conteudo ja eram absolutas, e as de shell e titulo
  // eram paridade. Com a suite de paridade aposentada, todas viraram
  // absolutas: o alvo e o comportamento correto, nao "igual ao antigo".
  expect(b.shell, 'nao serviu o shell offline').toBe(true);
  expect(b.titulo, 'titulo vazio offline').toBeTruthy();

  // Antes da correcao do precache a home nao abria offline: o sw.js
  // precacheava 12 arquivos de uma lista manual, e o resto so entrava em
  // cache sob demanda, o que exige ter visitado a tela antes. Com o
  // manifesto gerado no deploy, TODOS os modulos entram em cache no
  // install, e a home abre offline na primeira vez.
  expect(b.conteudo, 'a home nao abriu offline').toBe(true);
  expect(b.erros, `erros offline: ${b.erros}`).toEqual([]);
});

for (const [nome, base] of SITES) {
  test(`${nome}: criador abre offline depois de instalado`, async ({ context }) => {
    const page = await instalarSW(context, base);
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await context.setOffline(true);
    await page.goto(base + '#criar', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const passos = await page.evaluate(
      () => document.querySelectorAll('.wizard-step').length);
    await context.setOffline(false);

    expect(erros, `${nome}: erros de JS no criador offline`).toEqual([]);
    expect(passos, `${nome}: wizard nao renderizou offline`).toBeGreaterThan(0);
  });
}

test('o refatorado precacheia TODOS os modulos que carrega', async ({ context }) => {
  test.skip(!TEM_MANIFESTO, 'js-precache.json e gerado no deploy; ausente nesta copia');

  const resultados = {};
  for (const [nome, base] of SITES) {
    const page = await instalarSW(context, base);
    resultados[nome] = await page.evaluate(async () => {
      // Modulos que o app REALMENTE baixou nesta sessao.
      const carregados = performance.getEntriesByType('resource')
        .map((e) => e.name)
        .filter((u) => u.endsWith('.js') && !u.includes('gstatic'));
      // Quais deles o Service Worker guardou.
      const emCache = new Set();
      for (const k of await caches.keys()) {
        const c = await caches.open(k);
        for (const req of await c.keys()) emCache.add(req.url);
      }
      return {
        carregados: carregados.length,
        faltando: carregados.filter((u) => !emCache.has(u)),
      };
    });
    await page.close();
  }

  const resumo =
    `${resultados.refatorado.carregados} modulos carregados, ` +
    `${resultados.refatorado.faltando.length} fora do cache`;
  console.log('  cobertura de cache -> ' + resumo);

  // A regua e um alvo ABSOLUTO, e virou absoluta em duas etapas.
  //
  // Antes da correcao do precache, a afirmacao era comparativa: "o refatorado
  // nao ficou pior que o original", porque a lista manual do sw.js deixava
  // modulos de fora desde sempre e um alvo absoluto seria inventar uma
  // expectativa que nem o original cumpria.
  //
  // A correcao (manifesto gerado no deploy, varrendo site/js/**) tornou o
  // alvo absoluto legitimo: TODO modulo carregado tem de terminar em cache.
  // Com a suite de paridade aposentada em 2026-08-23, a metade comparativa
  // saiu e sobrou so a absoluta, que e a que tem valor.
  expect(resultados.refatorado.carregados,
    'refatorado carregou menos modulos que o esperado').toBeGreaterThan(50);
  expect(resultados.refatorado.faltando,
    `modulos carregados que ficaram fora do cache. ${resumo}`).toEqual([]);
});
