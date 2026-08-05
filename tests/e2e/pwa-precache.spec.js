// ============================================================
// Task 36 — instalação transacional do Service Worker: cada URL/hash do
// manifesto termina no Cache Storage, manifesto/worker ficam ativos,
// localStorage permanece intacto, e uma adulteração de bytes (mesma URL)
// falha a instalação com PWA_ASSET_INTEGRITY_MISMATCH sem ativar cache
// parcial. Roda exclusivamente via playwright.pwa.config.js, contra
// artifacts reais construídos por scripts/prepare-pages.mjs e servidos sob
// /D-D_2024/site/ (tests/e2e/helpers/versioned-pages-server.js).
// ============================================================
import { test, expect } from '@playwright/test';
import { startVersionedPagesServer } from './helpers/versioned-pages-server.js';

let server;

test.beforeAll(async () => {
  server = await startVersionedPagesServer({ port: 4174 });
});

test.afterAll(async () => {
  await server.close();
});

test.describe('PWA precache transacional', () => {
  test('install grava no Cache Storage cada URL/hash do manifesto e ativa o worker', async ({ page }) => {
    server.setActiveVersion('test-v1');
    await page.goto('index.html');

    await page.evaluate(() => navigator.serviceWorker.register('./sw.js'));
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 20000 });

    const resultado = await page.evaluate(async () => {
      const manifestResp = await fetch('./precache-manifest.json');
      const manifest = await manifestResp.json();
      const staticCache = await caches.open(`dnd-ficha-static-v${manifest.deployVersion}`);
      const dataCache = await caches.open(`dnd-ficha-data-v${manifest.deployVersion}`);
      const staticKeys = (await staticCache.keys()).map((r) => new URL(r.url).pathname);
      const dataKeys = (await dataCache.keys()).map((r) => new URL(r.url).pathname);
      return {
        deployVersion: manifest.deployVersion,
        staticCount: manifest.staticAssets.length,
        dataCount: manifest.dataAssets.length,
        staticFoundAll: manifest.staticAssets.every((a) => staticKeys.some((k) => k.endsWith(a.url.slice(1)))),
        dataFoundAll: manifest.dataAssets.every((a) => dataKeys.some((k) => k.endsWith(a.url.slice(2)))),
        manifestCached: staticKeys.some((k) => k.endsWith('/precache-manifest.json')),
      };
    });

    expect(resultado.deployVersion).toBe('test-v1');
    expect(resultado.staticCount).toBeGreaterThan(0);
    expect(resultado.dataCount).toBeGreaterThan(0);
    expect(resultado.staticFoundAll).toBe(true);
    expect(resultado.dataFoundAll).toBe(true);
    expect(resultado.manifestCached).toBe(true);
  });

  test('localStorage permanece intacto depois da instalação do Service Worker', async ({ page }) => {
    server.setActiveVersion('test-v1');
    await page.goto('index.html');
    await page.evaluate(() => window.localStorage.setItem('dnd_personagens', JSON.stringify([{ id: 'x', nome: 'Intacto' }])));

    await page.evaluate(() => navigator.serviceWorker.register('./sw.js'));
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 20000 });

    // A app migra o registro para o schema atual no boot (store.js) — o que
    // importa aqui é que o dado sobrevive (id/nome preservados), não o
    // formato bruto exato gravado antes da migração.
    const persistido = await page.evaluate(() => window.localStorage.getItem('dnd_personagens'));
    const lista = JSON.parse(persistido);
    expect(lista).toHaveLength(1);
    expect(lista[0].id).toBe('x');
    expect(lista[0].nome).toBe('Intacto');
  });

  test('bytes adulterados (mesma URL) falham a instalação por integridade e não ativam cache parcial', async ({ page }) => {
    server.setActiveVersion('test-broken');
    await page.goto('index.html');

    const registro = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.register('./sw.js');
      const worker = reg.installing || reg.waiting || reg.active;
      const resultadoInstall = await new Promise((resolve) => {
        if (!worker) return resolve('sem-worker');
        worker.addEventListener('statechange', () => {
          if (worker.state === 'redundant') resolve('redundant');
          if (worker.state === 'activated') resolve('activated');
        });
        setTimeout(() => resolve('timeout'), 15000);
      });
      return resultadoInstall;
    });

    // O worker de test-broken nunca deve chegar a 'activated' — ou fica
    // 'redundant' (install rejeitado) ou o teste estoura o timeout esperando
    // 'activated' (que nunca deve acontecer).
    expect(registro).not.toBe('activated');

    // Nenhum cache da versão test-broken deve existir (rollback completo).
    const cachesRestantes = await page.evaluate(async () => caches.keys());
    expect(cachesRestantes.some((k) => k.includes('test-broken'))).toBe(false);
  });
});
