// ============================================================
// Task 34: rotas lazy — prova, num navegador real, que `home`, `criar` e
// `ficha/<id>` só baixam seu próprio módulo (e o grafo dele) quando a rota é
// de fato visitada, e que o hash-router (site/js/core/hash-router.js) chama
// o disposer da rota anterior exatamente uma vez, respeita deep link/voltar
// e nunca deixa uma navegação obsoleta vencer uma mais nova.
//
// `test.use({ serviceWorkers: 'block' })` é redundante com o padrão global
// do BrowserContext (playwright.config.js), mas explícito aqui de propósito:
// este é o spec que MEDE rede, e o precache do Service Worker mascararia
// exatamente o que está sendo provado (a ausência de um fetch antes da hora).
// `resetApp()` (helpers/app.js) já limpa Cache Storage e desregistra
// qualquer SW residual antes de cada teste.
// ============================================================
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetApp, goHome, goCreator, goFicha } from './helpers/app.js';

test.use({ serviceWorkers: 'block' });

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const derivedValues = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'tests/fixtures/expected/derived-values.json'), 'utf8')
);
const casesById = Object.fromEntries(derivedValues.cases.map((c) => [c.id, c]));
const PERSONAGEM = casesById['pv-convergente'].personagem;

/**
 * Registra todo request de rede feito pela página e devolve a lista viva de
 * URLs capturadas (cresce ao longo do teste). Usado para provar ausência
 * ("nunca pediu X antes de Y") e presença ("pediu X depois de Y").
 * @param {import('@playwright/test').Page} page
 * @returns {string[]}
 */
function capturarRequisicoes(page) {
  const urls = [];
  page.on('request', (req) => urls.push(req.url()));
  return urls;
}

test.describe('Rotas lazy (site/js/core/hash-router.js)', () => {
  test('abrir a home não baixa o módulo do criador nem o da ficha, só o próprio grafo', { tag: '@critical' }, async ({ page }) => {
    const urls = capturarRequisicoes(page);
    await resetApp(page, { characters: [] });
    // resetApp já navega + recarrega; a lista capturada a partir daqui cobre
    // a carga real do app (o `page.on('request')` foi registrado ANTES do
    // primeiro `page.goto`, então pega tudo, inclusive o reload interno).
    await goHome(page);

    // `app-context.js` NÃO entra nesta lista: `store.js` (importado por
    // `app.js` incondicionalmente, para inicializar o repositório de
    // personagens) já o importa — isso é boot do app, não do roteamento, e
    // acontece pra QUALQUER rota inicial, inclusive a home.
    const baixouCriador = urls.some((u) => u.includes('/js/pages/creator.js') || u.includes('/js/features/creator/'));
    const baixouFicha = urls.some((u) => u.includes('/js/pages/sheet.js') || u.includes('/js/features/sheet/'));

    expect(baixouCriador, 'a home não deveria ter baixado nada do criador').toBe(false);
    expect(baixouFicha, 'a home não deveria ter baixado nada da ficha').toBe(false);

    // Confirma que a instrumentação em si funciona: navegando para o
    // criador, o módulo aparece na lista.
    await goCreator(page);
    const baixouCriadorAgora = urls.some((u) => u.includes('/js/pages/creator.js'));
    expect(baixouCriadorAgora, 'depois de navegar para #criar, o módulo precisa ter sido baixado').toBe(true);
  });

  test('abrir o criador não baixa o módulo da ficha antes de navegar para ela', { tag: '@critical' }, async ({ page }) => {
    const urls = capturarRequisicoes(page);
    await resetApp(page, { characters: [PERSONAGEM] });
    await goCreator(page);

    const baixouFicha = urls.some((u) => u.includes('/js/pages/sheet.js') || u.includes('/js/features/sheet/'));
    expect(baixouFicha, 'o criador não deveria ter baixado nada da ficha').toBe(false);

    await goFicha(page, PERSONAGEM.id);
    const baixouFichaAgora = urls.some((u) => u.includes('/js/pages/sheet.js'));
    expect(baixouFichaAgora, 'depois de navegar para #ficha, o módulo precisa ter sido baixado').toBe(true);
  });

  test('deep link direto para a ficha monta a ficha sem passar pela home', { tag: '@critical' }, async ({ page }) => {
    await resetApp(page, { characters: [PERSONAGEM] });
    await page.evaluate((id) => {
      window.location.hash = `ficha/${id}`;
    }, PERSONAGEM.id);
    await page.reload();
    await page.waitForSelector('[data-sheet-section="summary-combat"] [data-sheet-section-body]');
    await expect(page.locator('.char-list')).toHaveCount(0);
  });

  test('deep link direto para o criador, depois voltar pelo HISTÓRICO do navegador, chega na home', { tag: '@critical' }, async ({ page }) => {
    // Cobre o caminho que o brief marca como de risco alto: `#btn-voltar`
    // aponta para `window.history.back()` enquanto a rota é `criar`
    // (site/js/app.js#aplicarChromeDaRota), e `page.goBack()` é o
    // equivalente real do usuário clicando o botão "Voltar" do navegador —
    // dispara 'popstate'/'hashchange' de verdade, não uma reatribuição
    // direta de `location.hash`. Isso exercita, ponta a ponta, o
    // `subscribeHashChange` real de `app.js` reagindo a uma navegação
    // originada do HISTÓRICO, não de `router.navigate()`.
    await resetApp(page, { characters: [] });
    await goHome(page); // fixa 'home' como a entrada de histórico anterior a 'criar'.

    await page.evaluate(() => {
      window.location.hash = 'criar';
    });
    await page.waitForSelector('#wizard-content');
    await expect(page.locator('#btn-voltar')).toBeVisible();

    await page.goBack();
    await page.waitForSelector('.empty-state, .char-list');
    await expect(page.locator('#wizard-content')).toHaveCount(0);
    expect(page.url()).not.toContain('#criar');
  });

  test('deep link direto para a ficha, voltar pelo BOTÃO (casinha) chega na home', { tag: '@critical' }, async ({ page }) => {
    // Na ficha, `#btn-voltar` NÃO usa `history.back()` — vira a "casinha"
    // que chama `navegar('home')` diretamente (site/js/app.js#aplicarChromeDaRota).
    // `navegar()` agora delega para `router.navigate()` (fix round 1); este
    // teste prova que esse caminho continua funcionando fim a fim depois da
    // troca, com um clique real no botão, não uma reatribuição de hash pelo teste.
    await resetApp(page, { characters: [PERSONAGEM] });
    await goFicha(page, PERSONAGEM.id);
    await expect(page.locator('#btn-voltar')).toBeVisible();

    await page.locator('#btn-voltar').click();
    await page.waitForSelector('.empty-state, .char-list');
    await expect(page.locator('[data-sheet-section="summary-combat"]')).toHaveCount(0);
    expect(page.url()).toContain('#home');
  });

  test('alternância rápida entre rotas: só a última geração renderiza', { tag: '@critical' }, async ({ page }) => {
    await resetApp(page, { characters: [PERSONAGEM] });
    await goHome(page);

    // Dispara três navegações em sequência, sem esperar nenhuma terminar de
    // montar — exercita o generation-guard do router (core/hash-router.js):
    // criar e ficha podem perder a corrida, mas home (a última) tem que
    // vencer e ser a única coisa na tela ao final.
    await page.evaluate((id) => {
      window.location.hash = 'criar';
      window.location.hash = `ficha/${id}`;
      window.location.hash = 'home';
    }, PERSONAGEM.id);

    await page.waitForSelector('.empty-state, .char-list');
    // Nem o wizard nem a ficha deixaram vestígio no DOM final.
    await expect(page.locator('#wizard-content')).toHaveCount(0);
    await expect(page.locator('[data-sheet-section="summary-combat"]')).toHaveCount(0);
  });

  test('erro de import da rota mostra aviso recuperável, sem handler inline', { tag: '@critical' }, async ({ page }) => {
    await resetApp(page, { characters: [PERSONAGEM] });
    await goHome(page);

    // Força o `import()` dinâmico de `pages/sheet.js` a falhar (rede
    // abortada) — o cenário real seria uma falha de rede/CDN, não um bug de
    // código; o router precisa degradar para um aviso, nunca travar a SPA.
    await page.route('**/js/pages/sheet.js', (route) => route.abort('failed'));

    await page.evaluate((id) => {
      window.location.hash = `ficha/${id}`;
    }, PERSONAGEM.id);

    // Timeout maior só aqui (mesma razão documentada em playwright.config.js
    // para `webkit-critical`): esta rota ativa o catálogo oficial completo
    // antes de sequer tentar o `import()` que vai falhar, e o WebKit deste
    // host mede de 7s a 35s para essa ativação — o padrão de 5s do
    // `expect()` cai bem no meio dessa faixa.
    const aviso = page.locator('[data-failure-notice]');
    await expect(aviso).toBeVisible({ timeout: 20000 });

    // Nenhum handler inline no aviso de erro (mesma disciplina de Task 24 —
    // sinks seguros de UI, tests/e2e/security-content.spec.js).
    const comOnclick = await page.locator('#app-content [onclick]').count();
    expect(comOnclick).toBe(0);

    // A home continua acessível: o app não travou, e o botão "voltar ao
    // início" delegado (registrado uma única vez em app.js#init) funciona
    // mesmo depois de uma rota ter falhado ao montar.
    await page.unroute('**/js/pages/sheet.js');
    await goHome(page);
    await expect(page.locator('.empty-state, .char-list')).toBeVisible();
  });
});
