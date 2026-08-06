import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));

// Este repositorio (o refatorado) e o original, lado a lado no disco.
// REPO_ORIGINAL permite apontar para outro caminho sem editar o arquivo.
const NOVO = resolve(AQUI, '..', '..');
const ORIG = process.env.REPO_ORIGINAL || resolve(NOVO, '..', 'D-D_2024');

export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Cada teste roda em seu proprio contexto de navegador, com localStorage
  // isolado, e os dois servidores sao estaticos -- entao paralelizar e
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
      name: 'paridade',
      testIgnore: 'offline.spec.mjs',
      // O Service Worker cachearia a versao anterior entre execucoes e
      // mascararia regressoes; estes testes tem de ver os arquivos do disco.
      use: { serviceWorkers: 'block' },
    },
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
      command: `node servidor.mjs "${ORIG.replace(/\\/g, '/')}" 8801`,
      url: 'http://127.0.0.1:8801/site/',
      reuseExistingServer: true,
      timeout: 20_000,
    },
    {
      command: `node servidor.mjs "${NOVO.replace(/\\/g, '/')}" 8802`,
      url: 'http://127.0.0.1:8802/site/',
      reuseExistingServer: true,
      timeout: 20_000,
    },
  ],
});
