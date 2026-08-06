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
//    home passou a abrir offline -- coisa que o ORIGINAL nao faz.
//
// Por isso duas asserções aqui sao alvos ABSOLUTOS e nao paridade: exigir
// paridade seria exigir que o novo fosse tao limitado quanto o antigo.
import { test, expect } from '@playwright/test';
import { ORIG, NOVO } from './helpers.mjs';

const SITES = [['original', ORIG], ['refatorado', NOVO]];

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

test('a home do refatorado abre offline (o original nao abre)', async ({ context }) => {
  const a = await estadoOffline(context, ORIG, '');
  const b = await estadoOffline(context, NOVO, '');

  // O shell TEM de vir do cache nos dois -- isso o original satisfaz.
  expect(a.shell, 'o original nao serviu nem o shell offline').toBe(true);
  expect(b.shell, 'refatorado nao serviu o shell offline').toBe(true);
  expect(b.titulo, 'titulo offline difere').toBe(a.titulo);

  // Aqui a regua NAO e paridade, e um alvo absoluto -- e e proposital.
  //
  // Antes da correcao do precache, a home nao abria offline em nenhum dos
  // dois: o sw.js precacheava 12 arquivos de uma lista manual, e o resto so
  // entrava em cache sob demanda, o que exige ter visitado a tela antes. Com
  // o manifesto gerado no deploy, o refatorado passa a ter TODOS os modulos
  // em cache no install, e a home abre offline na primeira vez.
  //
  // O original continua com a lista manual e continua nao abrindo. Exigir
  // paridade aqui seria exigir que o novo fosse tao limitado quanto o antigo.
  expect(b.conteudo,
    `a home do refatorado nao abriu offline. original=${a.conteudo}, refatorado=${b.conteudo}`)
    .toBe(true);
  expect(b.erros, `refatorado teve erros offline: ${b.erros}`).toEqual([]);
});

test('criador offline se comporta igual nos dois sites', async ({ context }) => {
  const a = await estadoOffline(context, ORIG, '#criar');
  const b = await estadoOffline(context, NOVO, '#criar');

  expect(a.passos, 'o criador nao abriu offline nem no original; teste sem valor')
    .toBeGreaterThan(0);
  expect(b.passos, 'criador offline: numero de passos difere').toBe(a.passos);
  expect(b.erros, `refatorado teve erros que o original nao teve: ${b.erros}`)
    .toEqual(a.erros);
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

  // A afirmacao NAO e "nenhum modulo fica fora do cache": o ORIGINAL tambem
  // deixa modulos de fora, porque a lista de precache do sw.js e manual e
  // incompleta desde sempre. Absoluto aqui seria inventar uma expectativa que
  // o proprio original nao cumpre.
  //
  // O que se afirma e que o refatorado nao ficou PIOR: a fracao de modulos
  // carregados que terminam em cache tem de ser pelo menos a do original.
  const fracao = (r) => (r.carregados - r.faltando.length) / r.carregados;
  const fOrig = fracao(resultados.original);
  const fNovo = fracao(resultados.refatorado);

  const resumo =
    `original: ${resultados.original.carregados} carregados, ` +
    `${resultados.original.faltando.length} fora do cache (${(fOrig * 100).toFixed(1)}% cobertos) | ` +
    `refatorado: ${resultados.refatorado.carregados} carregados, ` +
    `${resultados.refatorado.faltando.length} fora do cache (${(fNovo * 100).toFixed(1)}% cobertos)`;
  console.log('  cobertura de cache -> ' + resumo);

  expect(resultados.refatorado.carregados,
    'refatorado carregou menos modulos que o esperado').toBeGreaterThan(50);

  // A regressao FOI CORRIGIDA: o manifesto de precache passou a ser gerado no
  // deploy varrendo site/js/**, em vez de uma lista manual de 12 arquivos.
  //
  // A regua aqui deixa de ser paridade e passa a ser um alvo ABSOLUTO -- e e
  // legitimo, porque ficar melhor que o original era o objetivo declarado da
  // correcao. O original continua com sua lista manual e nao muda.
  expect(resultados.refatorado.carregados,
    'refatorado carregou menos modulos que o esperado').toBeGreaterThan(50);
  expect(resultados.refatorado.faltando,
    `modulos carregados que ficaram fora do cache. ${resumo}`).toEqual([]);
  expect(fNovo, `cobertura do refatorado nao superou a do original. ${resumo}`)
    .toBeGreaterThan(fOrig);
});
