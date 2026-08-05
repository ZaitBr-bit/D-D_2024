// ============================================================
// Helper do APP BASELINE materializado (Task 37).
//
// O round-trip de compatibilidade (`tests/e2e/baseline-roundtrip.spec.js`,
// via playwright.compat.config.js) navega a MESMA página entre duas origens:
// o app novo (127.0.0.1:4173, alcançado pelos helpers normais de
// `./app.js`/baseURL) e a aplicação LEGADA COMPLETA do commit `e43c5ea`
// servida de `.tmp/baseline-e43c5ea` em 127.0.0.1:4175. Como são origens
// distintas, cada uma tem seu próprio `localStorage` — exatamente o
// isolamento que o round-trip precisa.
//
// Os seletores daqui são os do BASELINE (levantados de
// `.tmp/baseline-e43c5ea/site/js/pages/{home,sheet}.js`, os mesmos fontes
// congelados em tests/helpers/legacy-sheet-source.js). Não use os page
// objects novos contra o baseline: as arquiteturas divergiram no cutover
// (Tasks 28b/33) e é justamente essa divergência que o round-trip atravessa.
// ============================================================
import { expect } from '@playwright/test';
import fsp from 'node:fs/promises';
import { blockServiceWorker, blockFirebaseNetwork, clearAllStorage, disableAnimations, STORAGE_KEY } from './storage.js';

/** Origem do baseline servida por playwright.compat.config.js. */
export const BASELINE_ORIGIN = 'http://127.0.0.1:4175/site/';

/**
 * Abre a home do baseline do zero: bloqueia Service Worker e rede Firebase
 * (mesma disciplina dos helpers do app novo), limpa todo o storage DA ORIGEM
 * DO BASELINE e espera a home renderizar.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
export async function abrirBaselineLimpo(page) {
  await blockServiceWorker(page);
  await blockFirebaseNetwork(page);
  await page.goto(`${BASELINE_ORIGIN}index.html`);
  await clearAllStorage(page);
  await page.reload();
  await disableAnimations(page);
  await page.waitForSelector('.empty-state, .char-list');
}

/**
 * Recarrega a home do baseline SEM limpar o storage (estado preservado).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
export async function irParaHomeBaseline(page) {
  await page.goto(`${BASELINE_ORIGIN}index.html#home`);
  await page.waitForSelector('.empty-state, .char-list');
}

/**
 * Importa personagens no baseline pela UI real (`#btn-importar` + file
 * chooser), gravando `dados` num arquivo temporário do teste.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {Array<object>} dados - array de personagens (formato de exportação).
 * @param {string} [nomeArquivo]
 * @returns {Promise<void>}
 */
export async function importarNoBaseline(page, testInfo, dados, nomeArquivo = 'roundtrip-import.json') {
  const filePath = testInfo.outputPath(nomeArquivo);
  await fsp.writeFile(filePath, JSON.stringify(dados, null, 2));
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('#btn-importar').click()
  ]);
  await chooser.setFiles(filePath);
  // Toast de sucesso da importação do baseline.
  await expect(page.locator('#toast-container .toast.success').first()).toBeVisible({ timeout: 3000 });
}

/**
 * Abre a ficha LEGADA de um personagem e espera o marcador exclusivo do
 * baseline (`#btn-editar-ficha`, o monólito) — que NÃO existe na ficha nova.
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function abrirFichaBaseline(page, id) {
  await page.goto(`${BASELINE_ORIGIN}index.html#ficha/${id}`);
  await page.waitForSelector('#btn-editar-ficha');
}

/**
 * Lê a lista bruta de personagens do `localStorage` DA ORIGEM ATUAL da
 * página (útil nas duas pontas do round-trip).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<object>>}
 */
export async function lerPersonagens(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), STORAGE_KEY);
}

/**
 * Sobrescreve um personagem da lista no `localStorage` da origem atual,
 * aplicando `mutator` ao registro de `id` (usado para injetar `_local_sync`
 * no cenário de storage compartilhado do item (f) do round-trip).
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 * @param {object} patch - chaves copiadas rasas para o registro.
 * @returns {Promise<void>}
 */
export async function remendarPersonagem(page, id, patch) {
  await page.evaluate(({ key, charId, extra }) => {
    const lista = JSON.parse(localStorage.getItem(key) || '[]');
    const alvo = lista.find((p) => p.id === charId);
    if (!alvo) throw new Error(`personagem ${charId} não encontrado para remendo`);
    Object.assign(alvo, extra);
    localStorage.setItem(key, JSON.stringify(lista));
  }, { key: STORAGE_KEY, charId: id, extra: patch });
}

/**
 * Exporta TODOS os personagens do baseline pela UI (`#btn-exportar`) e
 * devolve o array parseado do download.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<object>>}
 */
export async function exportarTodosDoBaseline(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#btn-exportar').click()
  ]);
  return JSON.parse(await fsp.readFile(await download.path(), 'utf8'));
}
