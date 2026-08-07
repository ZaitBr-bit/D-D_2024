// ============================================================
// Config da suíte de REGRAS: diferente da paridade, sobe SÓ este
// site — a pergunta aqui é "o app obedece ao livro?", não "é igual
// ao original?". Vive dentro de testes/e2e/ porque é a única árvore
// com node_modules (a resolução do @playwright/test sobe a partir
// do arquivo que importa).
// ============================================================
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const NOVO = resolve(AQUI, '..', '..', '..');

export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? 'line' : [['line'], ['html', { open: 'never' }]],
  use: {
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    // Igual à paridade: o cache do SW mascararia regressões.
    serviceWorkers: 'block',
  },
  webServer: [{
    command: `node ../servidor.mjs "${NOVO.replace(/\\/g, '/')}" 8802`,
    url: 'http://127.0.0.1:8802/site/',
    reuseExistingServer: true,
    timeout: 20_000,
  }],
});
