// ============================================================
// Task 36 — offline real: visita só a home, cai offline, e abre
// criador/ficha NUNCA visitados nesta sessão. Módulos dinâmicos (rotas
// lazy, Task 34) e dados oficiais (dados/pacotes/**) precisam vir do
// precache — não há segunda chance de buscá-los pela rede. Inclui
// explicitamente exportar PDF offline de uma ficha não visitada antes de
// cair offline (prova site/js/vendor/pdf-lib.min.js está no precache). Para
// JSON ausente offline, exige 503 estruturado — nunca `200 null`.
// ============================================================
import { test, expect } from '@playwright/test';
import { startVersionedPagesServer } from './helpers/versioned-pages-server.js';

let server;

const PERSONAGEM = {
  id: 'pwa-offline-guerreiro',
  nome: 'Testado Offline',
  imagem: '',
  nivel: 1,
  xp: 0,
  exaustao: 0,
  // O migrador v1->v2 (site/js/infra/character/migrations/v1-to-v2.js) só
  // aceita o nome de exibição EXATO do mapa de aliases legado
  // (dados/pacotes/dnd2024/migrations/character-v1-aliases.json:
  // {"from":"Guerreiro","to":"dnd2024:class:guerreiro"}) — "guerreiro"
  // minúsculo não bate e faz a migração inteira falhar silenciosamente
  // (CHARACTER_LEGACY_ALIAS_NOT_FOUND), deixando o registro no shape v1 cru
  // para sempre (decodificado depois como "read-only", sem viewModel real).
  classe: 'Guerreiro',
  subclasse: '',
  especie: '',
  antecedente: '',
  alinhamento: '',
  tracos_escolhidos: [],
  extras_classe: {},
  escolhas_classe: {},
  escolhas_antecedente: {},
  proficiencias_extra: [],
  atributos: { forca: 16, destreza: 14, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 8 },
  atributos_base: { forca: 16, destreza: 14, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 8 },
  configuracao_criacao: { atributos: { metodo: null, valoresBase: null, rolagens: null } },
  edicoes: { versao: 1, campos: {} },
  bonus_antecedente: {},
  pv_max: 12,
  pv_atual: 12,
  pv_temporario: 0,
  dados_vida_total: 1,
  dados_vida_usados: 0,
  pericias_proficientes: [],
  pericias_expertise: [],
  salvaguardas_proficientes: [],
  inventario: [],
  escolha_equip_classe: null,
  escolha_equip_antecedente: null,
  moedas: { po: 0, pp: 0, pc: 0, pe: 0, pl: 0 },
  magias_conhecidas: [],
  magias_preparadas: [],
  grimorio: [],
  espacos_magia: {},
  talentos: [],
  itens_customizados: [],
  magias_customizadas: [],
  efeitos_magicos: [],
  usos_habilidades: {},
  aparencia: ''
};

test.beforeAll(async () => {
  server = await startVersionedPagesServer({ port: 4174 });
  server.setActiveVersion('test-v1');
});

test.afterAll(async () => {
  await server.close();
});

test.describe('PWA offline', () => {
  test('rota lazy (criador) nunca visitada abre offline a partir do precache', async ({ page, context }) => {
    await page.goto('index.html');
    await page.evaluate(() => navigator.serviceWorker.register('./sw.js'));
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 20000 });
    await page.evaluate(() => { window.location.hash = 'home'; });
    await page.waitForSelector('#app-content');

    await context.setOffline(true);
    try {
      await page.evaluate(() => { window.location.hash = 'criar'; });
      await page.waitForSelector('#wizard-content', { timeout: 15000 });
      await expect(page.locator('#wizard-content')).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  test('exportar PDF offline de ficha não visitada antes de cair offline', async ({ page, context }) => {
    await page.goto('index.html');
    await page.evaluate((personagem) => {
      window.localStorage.setItem('dnd_personagens', JSON.stringify([personagem]));
    }, PERSONAGEM);
    // Reload ANTES de registrar/navegar: mesmo padrão de
    // tests/e2e/helpers/app.js#resetApp — garante que
    // `initializeCharacterStorage()` (site/js/app.js#init()) rode sobre o
    // `localStorage` JÁ semeado, migrando o registro v1 para o canônico v2
    // (com `content_refs`/`content_scopes`) antes de qualquer leitura da
    // ficha. Sem isso, o repositório pode decodificar o registro como
    // "read-only" (fallback seguro para registro não reconhecido) e a ficha
    // nunca produz um `viewModel` real.
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.register('./sw.js'));
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 20000 });
    await page.evaluate(() => { window.location.hash = 'home'; });
    await page.waitForSelector('#app-content');

    await context.setOffline(true);
    try {
      await page.evaluate((id) => { window.location.hash = `ficha/${id}`; }, PERSONAGEM.id);
      await page.waitForSelector('[data-sheet-section="summary-combat"] [data-sheet-section-body]', { timeout: 15000 });
      // O container da seção existe antes do ViewModel terminar de montar (o
      // catálogo oficial inteiro é carregado de forma assíncrona ao abrir a
      // ficha — ver nota do timeout maior de WebKit em playwright.config.js).
      // Espera curta e determinística: o texto de PV (nunca vazio quando o
      // ViewModel está pronto) aparece dentro da seção de combate.
      await page.waitForFunction(() => {
        const secao = document.querySelector('[data-sheet-section="summary-combat"] [data-sheet-section-body]');
        return !!secao && secao.textContent.trim().length > 0;
      }, null, { timeout: 15000 });

      // Corrida entre o download real e um possível toast de erro (o toast
      // se autorremove em 3s — se só esperássemos o timeout de
      // `waitForEvent('download')`, um erro real já teria desaparecido antes
      // de conseguirmos inspecioná-lo).
      const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
      const toastErrorPromise = page.locator('#toast-container .toast.error').first()
        .waitFor({ state: 'visible', timeout: 15000 }).then(() => page.locator('#toast-container .toast.error').first().textContent()).catch(() => null);
      await page.locator('#btn-print').click();
      const [download, toastErrorText] = await Promise.all([downloadPromise, toastErrorPromise]);

      if (!download) {
        throw new Error(`Exportação de PDF offline falhou sem download. Toast de erro: ${toastErrorText ?? '(nenhum)'}`);
      }
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    } finally {
      await context.setOffline(false);
    }
  });

  test('JSON de dados ausente offline responde 503 estruturado, nunca 200 null', async ({ page, context }) => {
    await page.goto('index.html');
    await page.evaluate(() => navigator.serviceWorker.register('./sw.js'));
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 20000 });

    await context.setOffline(true);
    try {
      const resultado = await page.evaluate(async () => {
        const resp = await fetch('../dados/pacotes/dnd2024/arquivo-inexistente-para-teste.json');
        const body = await resp.json().catch(() => null);
        return { status: resp.status, body };
      });
      expect(resultado.status).toBe(503);
      expect(resultado.body).not.toBeNull();
      expect(typeof resultado.body).toBe('object');
    } finally {
      await context.setOffline(false);
    }
  });
});
