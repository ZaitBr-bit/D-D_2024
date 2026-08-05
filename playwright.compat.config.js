// ============================================================
// Configuração Playwright do ROUND-TRIP DE COMPATIBILIDADE (Task 37).
//
// Executa EXCLUSIVAMENTE `tests/e2e/baseline-roundtrip.spec.js`, contra DOIS
// servidores estáticos simultâneos (ambos `scripts/serve-static.mjs`):
//
//   - APP NOVO:      http://127.0.0.1:4173/site/  (raiz = worktree atual)
//   - APP BASELINE:  http://127.0.0.1:4175/site/  (raiz = .tmp/baseline-e43c5ea,
//     a aplicação legada completa do commit `e43c5ea`, materializada por
//     scripts/materialize-baseline.mjs SEM tocar o worktree)
//
// Somente Chromium desktop roda esta suíte: o round-trip depende de
// FileChooser/download reais e o objetivo é paridade de DADOS entre as duas
// aplicações, não paridade entre engines de navegador (a matriz de engines
// já é coberta por playwright.config.js).
//
// Não execute este config diretamente sem materializar o baseline antes; o
// caminho suportado é `npm run test:e2e:compat`
// (scripts/run-baseline-roundtrip.mjs), que materializa, roda e remove
// apenas a materialização validada.
// ============================================================
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/baseline-roundtrip.spec.js',
  // O round-trip é uma NARRATIVA serial (criar -> exportar -> editar no
  // baseline -> reimportar), com estado compartilhado dentro do spec.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    // O baseURL aponta para o APP NOVO — os helpers compartilhados
    // (tests/e2e/helpers/app.js, creator.js) funcionam sem mudança. O lado
    // baseline é sempre navegado por URL absoluta via
    // tests/e2e/helpers/baseline-app.js.
    baseURL: 'http://127.0.0.1:4173/site/',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'block',
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'node scripts/serve-static.mjs --root . --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173/site/index.html',
      reuseExistingServer: !process.env.CI,
      timeout: 30000
    },
    {
      command: 'node scripts/serve-static.mjs --root .tmp/baseline-e43c5ea --host 127.0.0.1 --port 4175',
      url: 'http://127.0.0.1:4175/site/index.html',
      reuseExistingServer: !process.env.CI,
      timeout: 30000
    }
  ],
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
    }
  ]
});
