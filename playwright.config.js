// ============================================================
// Configuração do Playwright para a caracterização E2E da interface atual
// (Task 3 do plano de refatoração). Codifica a matriz de projetos definida
// no brief, não apenas a documenta:
//
// - chromium-desktop (1440x900): suíte funcional completa (todos os specs).
// - chromium-mobile (390x844, toque): apenas testes marcados @critical ou
//   @visual — a suíte funcional padrão sempre roda com --grep-invert @visual,
//   então na prática só @critical roda aqui via `npm run test:e2e`. A tag
//   @visual só é exercitada pelo runner visual dedicado
//   (scripts/run-playwright-visual-linux.mjs), que abre visual.spec.js
//   diretamente nos projetos chromium-desktop e chromium-mobile.
// - firefox-critical / webkit-critical: apenas @critical, e nunca os specs
//   exclusivos de Chromium (PWA, download/print-pdf, dom-baseline, visual).
//
// Screenshots (`toHaveScreenshot`) só são geradas/comparadas em Linux, na
// imagem mcr.microsoft.com/playwright:v1.62.0-noble — uma execução comum
// neste host nunca abre tests/e2e/visual.spec.js.
// ============================================================
import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const DOM_BASELINE_ORACLES = [
  'tests/fixtures/dom-baseline/creator-steps.json',
  'tests/fixtures/dom-baseline/sheet-sections.json'
].map((rel) => path.join(repoRoot, rel));

// Os oráculos "v2" (criador, Task 28b; ficha, Task 33) NÃO entram nesta lista:
// eles são gravados por flags próprios, fora do commit-baseline, e o spec já
// falha com mensagem clara quando um deles falta.
const isUpdateMode =
  process.env.UPDATE_DOM_BASELINE === '1' ||
  process.env.UPDATE_CREATOR_DOM_BASELINE === '1' ||
  process.env.UPDATE_SHEET_DOM_BASELINE === '1';
const anyOracleMissing = DOM_BASELINE_ORACLES.some((file) => !fs.existsSync(file));
// O config funcional ignora dom-baseline.spec.js somente quando NÃO estamos em
// modo de atualização e pelo menos um dos dois oráculos ainda não existe. No
// modo update (UPDATE_DOM_BASELINE=1) ele nunca é ignorado.
const shouldIgnoreDomBaseline = !isUpdateMode && anyOracleMissing;

const CHROMIUM_ONLY_SPECS = [
  '**/pwa.spec.js',
  '**/print-pdf.spec.js',
  '**/import-export.spec.js',
  '**/dom-baseline.spec.js',
  '**/visual.spec.js'
];

// Specs de instalação transacional do Service Worker (Task 36): rodam
// EXCLUSIVAMENTE via playwright.pwa.config.js (baseURL/servidor próprios,
// sob /D-D_2024/site/). O `pwa.spec.js` de caracterização baseline continua
// neste config normalmente — só os três specs novos são ignorados aqui.
const PWA_TRANSACTIONAL_SPECS = [
  '**/pwa-precache.spec.js',
  '**/pwa-offline.spec.js',
  '**/pwa-update.spec.js'
];

// Round-trip contra o baseline materializado (Task 37): roda EXCLUSIVAMENTE
// via playwright.compat.config.js (dois webServers: app novo em 4173 e o
// baseline `e43c5ea` materializado em 4175), orquestrado por
// scripts/run-baseline-roundtrip.mjs (`npm run test:e2e:compat`).
const COMPAT_SPECS = ['**/baseline-roundtrip.spec.js'];

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: [...PWA_TRANSACTIONAL_SPECS, ...COMPAT_SPECS],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // O servidor estático de dev (scripts/serve-static.mjs, Task 1) é
  // single-process e serve dezenas de fetches por navegação do criador
  // (uma por arquivo em dados/**); com todos os specs rodando em paralelo,
  // um número alto de workers pode saturá-lo o suficiente para atrasar um
  // fetch além do timeout de uma ação pontual. Um teto de workers reduz essa
  // contenção.
  //
  // retries: 0 de propósito, mesmo localmente. Esta suíte É o oráculo de
  // compatibilidade para as 34 tasks restantes do plano — se `retries` > 0,
  // uma regressão real que falhe de forma intermitente (ex.: uma race
  // introduzida por uma refatoração futura) vira "flaky" em vez de
  // "failed", e `npm run test:e2e` sai verde mesmo tendo quebrado alguma
  // coisa. Testes instáveis devem ser corrigidos para serem determinísticos
  // (como fizemos com as races de Service Worker/render assíncrono
  // encontradas nesta task), nunca mascarados por retry.
  workers: process.env.CI ? undefined : 2,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173/site/',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // Bloqueado por padrão (garantia do próprio driver do Playwright, não um
    // stub de página) — só tests/e2e/pwa.spec.js liga de volta via
    // `test.use({ serviceWorkers: 'allow' })`, já que é o único spec que
    // precisa testar o ciclo de vida real do Service Worker. Isso fecha uma
    // race de verdade: site/js/app.js recarrega a página sozinho quando o SW
    // muda de controlador (`recarregarQuandoSeguro`), e um stub em
    // `page.addInitScript` (tentado antes) não impede um SW de uma execução
    // anterior de continuar controlando a origem no nível do browser — só a
    // opção nativa do BrowserContext garante isso.
    serviceWorkers: 'block',
    trace: 'retain-on-failure'
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.002,
      animations: 'disabled'
    }
  },
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  webServer: {
    command: 'npm run serve:test',
    url: 'http://127.0.0.1:4173/site/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      // `testIgnore` de PROJETO substitui (não soma) o `testIgnore` de nível
      // raiz do defineConfig — por isso PWA_TRANSACTIONAL_SPECS precisa ser
      // repetido aqui em CADA projeto, não só declarado uma vez no topo.
      testIgnore: [...PWA_TRANSACTIONAL_SPECS, ...COMPAT_SPECS, ...(shouldIgnoreDomBaseline ? ['**/dom-baseline.spec.js'] : [])]
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true
      },
      grep: /@critical|@visual/,
      testIgnore: [
        '**/pwa.spec.js',
        '**/print-pdf.spec.js',
        '**/import-export.spec.js',
        ...PWA_TRANSACTIONAL_SPECS,
        ...COMPAT_SPECS,
        ...(shouldIgnoreDomBaseline ? ['**/dom-baseline.spec.js'] : [])
      ]
    },
    {
      name: 'firefox-critical',
      use: { ...devices['Desktop Firefox'] },
      grep: /@critical/,
      testIgnore: [...CHROMIUM_ONLY_SPECS, ...PWA_TRANSACTIONAL_SPECS, ...COMPAT_SPECS]
    },
    {
      name: 'webkit-critical',
      use: { ...devices['Desktop Safari'] },
      grep: /@critical/,
      testIgnore: [...CHROMIUM_ONLY_SPECS, ...PWA_TRANSACTIONAL_SPECS, ...COMPAT_SPECS],
      // TIMEOUT MAIOR SÓ AQUI (Task 33). Depois do cutover, abrir a ficha ativa
      // o CATÁLOGO OFICIAL inteiro (`appContext.initializeContent()`) — dezenas
      // de fetches que a ficha legada não fazia, porque ela lia o DB legado sob
      // demanda. O WebKit deste host leva de 7s a 35s para essa ativação (medido
      // em execuções repetidas do mesmo caso), e o teto de 30s caía bem no meio
      // dessa faixa: o mesmo teste passava e falhava alternadamente, sempre por
      // TIMEOUT e nunca por erro.
      //
      // Aumentar o teto aqui NÃO afrouxa asserção nenhuma — nenhum valor
      // esperado muda, e Chromium/Firefox continuam com o teto de 30s. O que
      // seria inaceitável é deixar um caso `@critical` intermitente e chamá-lo
      // de "flaky": o oráculo desta suíte tem de reprovar por divergência, não
      // por relógio.
      timeout: 90_000
    }
  ]
});
