// ============================================================
// Helper de estado persistente (localStorage/Cache Storage/Service Worker)
// usado por todos os specs de tests/e2e. Mantém um único ponto de verdade
// para a chave de armazenamento real do app (site/js/store.js) e para a
// limpeza/isolamento de contexto entre testes.
// ============================================================

/** Chave real usada por site/js/store.js para persistir personagens. */
export const STORAGE_KEY = 'dnd_personagens';

/**
 * Sobrescreve `localStorage['dnd_personagens']` com a lista de personagens
 * fornecida. Deve ser chamado depois de uma navegação (precisa de um
 * document/origin já carregado) e antes de qualquer ação que leia a lista
 * (site/js/store.js lê a chave a cada chamada, não faz cache em memória).
 *
 * @param {import('@playwright/test').Page} page
 * @param {object|object[]} personagens - um personagem ou array de personagens.
 */
export async function seedCharacters(page, personagens) {
  const list = Array.isArray(personagens) ? personagens : [personagens];
  await page.evaluate(
    ([key, data]) => window.localStorage.setItem(key, JSON.stringify(data)),
    [STORAGE_KEY, list]
  );
}

/** Lê e retorna a lista de personagens atualmente persistida. */
export async function readCharacters(page) {
  return page.evaluate((key) => {
    try {
      return JSON.parse(window.localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  }, STORAGE_KEY);
}

/** Limpa localStorage e sessionStorage do contexto atual. */
export async function clearAllStorage(page) {
  await page.evaluate(() => {
    try { window.localStorage.clear(); } catch { /* noop */ }
    try { window.sessionStorage.clear(); } catch { /* noop */ }
  });
}

/**
 * Desregistra todos os Service Workers e apaga todos os Cache Storage do
 * contexto atual. Precisa ser chamado com um documento já carregado (mesma
 * origem do app), nunca sobre about:blank.
 */
export async function wipeCachesAndServiceWorkers(page) {
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  });
}

/**
 * Impede que o app registre um Service Worker real (site/js/app.js#init,
 * `navigator.serviceWorker.register('./sw.js')`) neste contexto, stubando
 * `register` para uma Promise resolvida com um objeto de registro inerte
 * ANTES do primeiro script da página rodar. Precisa ser chamado antes de
 * `page.goto()`/`page.reload()` (via `addInitScript`, que se reaplica a toda
 * navegação subsequente na mesma página, inclusive reloads no meio do teste).
 *
 * Existe para fechar de vez uma race real do app: `site/js/app.js` arma um
 * `window.location.reload()` automático quando o Service Worker muda de
 * controlador (`recarregarQuandoSeguro`, disparado por
 * `serviceWorker.controllerchange` depois que o SW ativa e chama
 * `self.clients.claim()` em `site/sw.js`). Sem bloquear o registro, esse
 * reload pode disparar minutos/segundos depois do primeiro load — inclusive
 * no meio de uma asserção, já em outra rota — e nenhum timeout adicional
 * fecha essa race de verdade, só reduz a janela. Specs que precisam do SW de
 * verdade (tests/e2e/pwa.spec.js) não chamam este helper.
 */
export async function blockServiceWorker(page) {
  await page.addInitScript(() => {
    if (!('serviceWorker' in navigator)) return;
    const registroInerte = {
      installing: null,
      waiting: null,
      active: null,
      scope: location.href,
      addEventListener() {},
      removeEventListener() {},
      update: () => Promise.resolve()
    };
    navigator.serviceWorker.register = () => Promise.resolve(registroInerte);
  });
}

/**
 * Bloqueia as requisições de rede REAIS que `site/js/pages/home.js`
 * dispara a cada `renderHome()` (`iniciarAuth()` -> `auth.js#inicializarFirebase`,
 * que faz `import()` dinâmico de `https://www.gstatic.com/firebasejs/**`).
 *
 * Esta é a causa raiz de uma instabilidade que inicialmente atribuímos
 * (incorretamente) a uma race de Service Worker: `renderHome` registra, na
 * PRIMEIRA vez que roda nesta página, um callback `onAuthChange` que chama
 * `renderHome(_containerRef)` de novo assim que o Firebase resolve o estado
 * inicial de autenticação — e faz isso **sem checar a rota atual**. Se esse
 * callback dispara depois que o teste já navegou para `#criar`/`#ficha/<id>`
 * (o SDK real carrega da CDN em 1-3s, mais devagar e mais variável em
 * WebKit neste ambiente), a home sobrescreve `#app-content` no meio do
 * teste, mesmo com a URL ainda mostrando a rota anterior. `auth.js` já tem
 * um fallback ("Firebase nao disponivel (offline ou bloqueado)") para
 * quando essa importação falha — abortar a requisição aciona exatamente
 * esse caminho já tratado pelo próprio app, então o callback nunca chega a
 * ser registrado. Como `site/js/**` está fora do escopo desta task, a
 * correção real (tornar o callback ciente da rota atual) fica para uma
 * task futura de refatoração; isso aqui é a mitigação do lado do teste.
 */
export async function blockFirebaseNetwork(page) {
  await page.route(/gstatic\.com|googleapis\.com|firebaseapp\.com|firebaseio\.com/, (route) => route.abort());
}

/**
 * Congela o relógio da página num instante fixo (via `page.clock.setFixedTime`,
 * disponível desde o Playwright 1.45) para tornar determinístico qualquer
 * timestamp gerado pelo app (`new Date().toISOString()` em
 * site/js/store.js#salvarPersonagem/criarPersonagemVazio, etc.), no mesmo
 * espírito das fixtures congeladas na Task 2. Precisa ser chamado antes da
 * navegação cujo timestamp se quer congelar (o relógio "andado" por ação do
 * teste, ex. `page.clock.fastForward`, não é usado aqui — apenas o instante
 * fixo).
 *
 * Usamos `setFixedTime` (e não `install`) de propósito: `install` substitui o
 * agendador de timers inteiro do navegador por um fake, pausando também
 * `setTimeout`/`setInterval`/`requestAnimationFrame` até alguém chamar
 * `.resume()` (o que este helper nunca fazia) — isso travaria para sempre
 * qualquer coisa que dependa desses timers reais (ex.: auto-dismiss de toast,
 * o scroll-picker via `requestAnimationFrame` da ficha). `setFixedTime` só
 * congela as leituras de `Date`/`new Date()`, sem tocar no agendamento real
 * de timers — exatamente o que esta suíte precisa.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} [isoString] - instante fixo (padrão: 2026-07-26T00:00:00.000Z,
 *   o mesmo `compatibilityBaseline`/`generatedAt` usado pelas fixtures da Task 2).
 */
export async function freezeClock(page, isoString = '2026-07-26T00:00:00.000Z') {
  await page.clock.setFixedTime(new Date(isoString));
}

/**
 * Congela `Math.random` no contexto da página com um valor fixo, tornando
 * determinísticos: a geração de id de personagem (site/js/utils.js#gerarId)
 * e a rolagem 4d6 do criador (site/js/pages/creator.js#rolar4d6). Precisa
 * ser reaplicado a cada navegação completa (page.goto), pois um novo
 * documento reseta o objeto Math global.
 */
export async function freezeMathRandom(page, value = 0.42) {
  await page.evaluate((v) => {
    window.Math.random = () => v;
  }, value);
}

/**
 * Injeta uma folha de estilos que desativa animações/transições CSS no
 * documento atual. Complementar à opção `expect.toHaveScreenshot.animations:
 * "disabled"` do playwright.config.js (que só afeta comparações de
 * screenshot) — este helper também estabiliza testes funcionais que
 * dependem de estado imediatamente após uma interação.
 */
export async function disableAnimations(page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
      scroll-behavior: auto !important;
    }`
  });
}
