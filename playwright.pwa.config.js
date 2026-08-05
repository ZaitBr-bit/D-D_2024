// ============================================================
// Configuração do Playwright dedicada aos specs de Service Worker (Task 36):
// pwa-precache, pwa-offline e pwa-update. Isolada do config comum
// (playwright.config.js) porque esses três specs servem artifacts de deploy
// REAIS (via tests/e2e/helpers/versioned-pages-server.js) sob
// `/D-D_2024/site/`, replicando o subpath do GitHub Pages — um baseURL
// diferente do `/site/` usado pela caracterização funcional/visual/compat, e
// que nunca deve rodar nesses outros projetos.
//
// Único projeto (`pwa-pages`), Chromium desktop, `serviceWorkers: 'allow'`
// (o oposto do padrão bloqueado do config comum — aqui o ciclo de vida real
// do worker É o que está sob teste). `workers: 1` (via
// `npm run test:e2e:pwa`) porque os specs sobem o mesmo servidor na porta
// 4174 e mutam qual versão está "no ar" — paralelismo quebraria isso.
// ============================================================
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/pwa-precache.spec.js', '**/pwa-offline.spec.js', '**/pwa-update.spec.js'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4174/D-D_2024/site/',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'pwa-pages',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
