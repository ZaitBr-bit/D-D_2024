// ============================================================
// Caracterização do PWA atual (site/manifest.json, site/sw.js): manifesto,
// registro/ativação do Service Worker, inventário atual dos caches e
// recarga offline de uma rota já visitada (home). Executa somente em
// chromium-desktop (PWA/offline são exclusivos de Chromium por decisão do
// brief). As garantias de precache completo para rotas NÃO visitadas e
// atualização atômica são adicionadas — e entram RED — só na Task 36; aqui
// caracterizamos apenas o comportamento atual.
// ============================================================
import { test, expect } from '@playwright/test';
import { resetApp, goHome } from './helpers/app.js';

// playwright.config.js bloqueia Service Workers por padrão (`serviceWorkers:
// 'block'`) para fechar a race de reload automático de site/js/app.js em
// todos os outros specs — este é o único arquivo que precisa do SW de
// verdade, então liga de volta só aqui.
test.use({ serviceWorkers: 'allow' });

test.describe('PWA', () => {
  test('manifest.json expõe os campos esperados e está referenciado no <head>', async ({ page, request }) => {
    await resetApp(page);
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('manifest.json');

    const resp = await request.get('http://127.0.0.1:4173/site/manifest.json');
    expect(resp.ok()).toBe(true);
    const manifest = await resp.json();
    expect(manifest.name).toBe('D&D 5.5 - Ficha de Personagem');
    expect(manifest.start_url).toBe('./index.html');
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('Service Worker registra e ativa, controlando o cliente', async ({ page }) => {
    await resetApp(page, { keepServiceWorker: true });
    await goHome(page);

    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 15000 });
    const estado = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return { active: !!reg?.active, scope: reg?.scope };
    });
    expect(estado.active).toBe(true);
    expect(estado.scope).toContain('/site/');
  });

  test('inventário de caches após ativação inclui o cache estático versionado com os assets do app shell', async ({
    page
  }) => {
    await resetApp(page, { keepServiceWorker: true });
    await goHome(page);
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 15000 });

    const inventario = await page.evaluate(async () => {
      const nomes = await caches.keys();
      const detalhes = {};
      for (const nome of nomes) {
        const cache = await caches.open(nome);
        const reqs = await cache.keys();
        detalhes[nome] = reqs.map((r) => new URL(r.url).pathname);
      }
      return { nomes, detalhes };
    });

    expect(inventario.nomes.some((n) => n.startsWith('dnd-ficha-static-v'))).toBe(true);
    const cacheEstatico = inventario.nomes.find((n) => n.startsWith('dnd-ficha-static-v'));
    const paths = inventario.detalhes[cacheEstatico];
    expect(paths.some((p) => p.endsWith('/site/js/app.js'))).toBe(true);
    expect(paths.some((p) => p.endsWith('/site/index.html') || p.endsWith('/site/'))).toBe(true);
  });

  test('recarregar a home já visitada funciona offline (shell servido pelo cache)', async ({ page, context }) => {
    await resetApp(page, { keepServiceWorker: true });
    await goHome(page);
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 15000 });
    // Garante que o app shell já foi cacheado pelo fetch handler de navegação
    // antes de simular a queda de rede.
    await page.waitForTimeout(500);

    await context.setOffline(true);
    try {
      await page.reload();
      // O shell (index.html + app.js) é servido do cache — o <main id="app-content">
      // sempre existe no HTML estático, independentemente do JS terminar de rodar.
      await expect(page.locator('#app-content')).toBeAttached();
      await expect(page.locator('#app-header')).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });
});
