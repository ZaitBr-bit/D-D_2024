import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const NOVO = resolve(AQUI, '..', '..');

export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Cada teste roda em seu proprio contexto de navegador, com localStorage
  // isolado, e o servidor e estatico -- entao paralelizar e
  // seguro. Serial levava 6 minutos, e suite que ninguem roda nao vale nada.
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? 'line' : [['line'], ['html', { open: 'never' }]],
  use: {
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'offline',
      testMatch: 'offline.spec.mjs',
      // O UNICO projeto que permite Service Worker -- é justamente ele o
      // objeto do teste. Serial porque cada teste mexe em cache do dominio.
      use: { serviceWorkers: 'allow' },
      fullyParallel: false,
      workers: 1,
    },
  ],
  webServer: [
    {
      command: `node servidor.mjs "${NOVO.replace(/\\/g, '/')}" 8802`,
      url: 'http://127.0.0.1:8802/site/',
      reuseExistingServer: true,
      timeout: 20_000,
    },
  ],
});
