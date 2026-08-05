// ============================================================
// Helper de navegação/bootstrap do app (router hash, modal, toast) usado por
// todos os specs de tests/e2e. Encapsula o ciclo: carregar a página uma vez
// limpa (sem SW/cache/localStorage de execuções anteriores), semear estado
// determinístico e navegar pelas rotas reais do hash router
// (site/js/app.js: #home, #criar, #ficha/<id>).
// ============================================================
import { expect } from '@playwright/test';
import {
  seedCharacters,
  clearAllStorage,
  wipeCachesAndServiceWorkers,
  blockServiceWorker,
  blockFirebaseNetwork,
  freezeClock,
  freezeMathRandom,
  disableAnimations
} from './storage.js';

/**
 * Carrega o app do zero (navegação completa), limpa todo estado residual
 * (Cache Storage, Service Workers, localStorage) e opcionalmente semeia
 * personagens antes de qualquer interação. Sempre congela `Math.random`
 * (geração de id, site/js/utils.js#gerarId, e rolagem 4d6 do criador) e o
 * relógio (timestamps `new Date().toISOString()` de site/js/store.js).
 *
 * Também bloqueia, por padrão, o registro de Service Worker
 * (`playwright.config.js` já faz isso via `serviceWorkers: 'block'` no
 * nível do BrowserContext — `blockServiceWorker` aqui é só uma segunda
 * camada defensiva) e as requisições de rede reais para o Firebase — ver
 * storage.js#blockFirebaseNetwork para a race real que isso fecha (a causa
 * raiz de uma instabilidade em WebKit que inicialmente atribuímos, de forma
 * errada, a Service Worker).
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {object|object[]} [options.characters] - personagens a semear em
 *   `localStorage['dnd_personagens']` antes da primeira renderização.
 * @param {number} [options.randomSeed] - valor fixo para Math.random (padrão 0.42).
 * @param {string} [options.clockIso] - instante fixo do relógio (ver freezeClock()).
 * @param {boolean} [options.keepServiceWorker] - permite o registro real do
 *   Service Worker (necessário só em tests/e2e/pwa.spec.js, que também
 *   precisa rodar com `test.use({ serviceWorkers: 'allow' })` nesse arquivo
 *   para sobrepor o bloqueio padrão do BrowserContext).
 */
export async function resetApp(page, { characters, randomSeed = 0.42, clockIso, keepServiceWorker = false } = {}) {
  if (!keepServiceWorker) await blockServiceWorker(page);
  await blockFirebaseNetwork(page);
  // page.clock é instalado por BrowserContext inteiro (não por documento) e a
  // própria documentação recomenda instalar antes de navegar.
  await freezeClock(page, clockIso);

  await page.goto('./index.html');
  await wipeCachesAndServiceWorkers(page);
  await clearAllStorage(page);
  if (characters) await seedCharacters(page, characters);
  await disableAnimations(page);
  await freezeMathRandom(page, randomSeed);

  // Recarrega para que a home renderize já com o estado semeado (a 1a carga
  // rodou com localStorage vazio antes da semeadura acima). O bloqueio do SW
  // (via addInitScript) e o relógio (via page.clock, que a própria API do
  // Playwright reaplica a cada novo documento) sobrevivem ao reload sozinhos;
  // `Math.random` é só uma mutação do objeto `window.Math` do documento
  // anterior, então precisa ser reaplicado depois de qualquer navegação.
  await page.reload();
  await disableAnimations(page);
  await freezeMathRandom(page, randomSeed);
  // `#app-content` é estático (existe antes de qualquer render); esperar a
  // home de fato ter processado a rota evita seguir em frente com um DOM
  // ainda vazio/intermediário (ver nota em goHome() sobre `.empty-state`).
  await page.waitForSelector('.empty-state, .char-list');
}

/** Navega via hash router para a home (site/js/app.js: rota 'home'). */
export async function goHome(page) {
  await page.evaluate(() => { window.location.hash = 'home'; });
  // `#app-content` é um container estático (sempre presente, em qualquer
  // rota) — esperar só por ele não confirma que a home de fato renderizou.
  // A home renderiza `.empty-state` (sem personagens) ou `.char-list` (com
  // personagens), nunca nenhum dos dois. `.empty-state` NÃO é exclusivo da
  // home (a ficha também usa essa classe no estado "personagem não
  // encontrado", site/js/pages/sheet.js, e a rota 404 de site/js/app.js
  // também) — mas esta função só é chamada depois de já termos navegado
  // explicitamente para a rota 'home', então a ambiguidade não se aplica
  // aqui (só pode ser a home real ou o próprio "personagem não encontrado"
  // seria em #ficha, não em #home).
  await page.waitForSelector('.empty-state, .char-list');
}

/** Navega via hash router para o criador (site/js/app.js: rota 'criar'). */
export async function goCreator(page) {
  await page.evaluate(() => { window.location.hash = 'criar'; });
  await page.waitForSelector('#wizard-content');
}

/** Navega via hash router para a ficha de um personagem (rota 'ficha/<id>'). */
export async function goFicha(page, id) {
  await page.evaluate((charId) => { window.location.hash = `ficha/${charId}`; }, id);
  // Esperar por um marcador exclusivo da ficha, não por `.card` genérico:
  // a home também renderiza `.card` (barra de login/sync), então esperar só
  // por `.card` corre uma corrida real — em navegadores mais lentos para
  // disparar `hashchange` (visto em WebKit), o teste seguia em frente ainda
  // com o DOM da home, porque a home “satisfaz” um `.card` qualquer.
  // Task 33 (cutover): o marcador exclusivo da ficha deixou de ser
  // `#btn-editar-ficha` (um botão do monólito) e passou a ser a RAIZ que o
  // controller desenha. Continua valendo a razão original de não esperar por
  // `.card` genérico: a home também renderiza `.card`, e esperar por ele corre
  // uma corrida real com o `hashchange`.
  await page.waitForSelector('[data-sheet-section="summary-combat"] [data-sheet-section-body]');
}

/** Abre o menu flutuante de descanso (FAB) na ficha — os botões de descanso só existem dentro dele. */
export async function abrirMenuDescanso(page) {
  await page.locator('#fab-toggle-descanso').click();
  await expect(page.locator('#fab-menu-descanso')).toBeVisible();
}

/** Retorna o id do personagem a partir da URL atual (#ficha/<id>). */
export function fichaIdFromUrl(url) {
  const match = /#ficha\/([^/?#]+)/.exec(url);
  return match ? match[1] : null;
}

/**
 * Espera por um toast (site/js/utils.js#toast) com o tipo e/ou texto dados.
 * Os toasts se auto-removem após 3000ms, então este helper deve ser chamado
 * imediatamente após a ação que os dispara.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {'success'|'error'|'info'|''} [options.type]
 * @param {string|RegExp} [options.text]
 */
export function toastLocator(page, { type, text } = {}) {
  let locator = type
    ? page.locator(`#toast-container .toast.${type}`)
    : page.locator('#toast-container .toast');
  if (text) locator = locator.filter({ hasText: text });
  return locator;
}

export async function expectToast(page, options = {}) {
  const locator = toastLocator(page, options);
  await expect(locator.first()).toBeVisible({ timeout: 3000 });
  return locator.first();
}

/** Overlay principal de modal (site/js/utils.js#abrirModal / index.html). */
export const modal = {
  overlay: (page) => page.locator('#modal-overlay'),
  titulo: (page) => page.locator('#modal-titulo'),
  corpo: (page) => page.locator('#modal-corpo'),
  acoes: (page) => page.locator('#modal-acoes'),
  async isOpen(page) {
    return page.locator('#modal-overlay').evaluate((el) => el.style.display === 'flex');
  },
  async close(page) {
    await page.locator('#modal-overlay .modal-fechar').click();
  }
};
