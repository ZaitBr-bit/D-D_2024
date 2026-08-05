// ============================================================
// Fronteira de UI segura NO NAVEGADOR REAL (Task 24).
//
// Os testes de nó (tests/unit/ui/**) rodam sobre LinkeDOM, que é uma
// implementação de DOM — não um navegador. Ele não executa script, não tem
// foco real e não tem o parser tolerante do Chromium. Este spec fecha esse
// vão: os MESMOS payloads de tests/fixtures/security/malicious-content.json
// são renderizados pelos sinks reais dentro do Chromium, com CSP real, e o
// teste falha se qualquer um deles conseguir executar código, criar um
// destino navegável ou virar handler de evento.
//
// Também cobre aqui, e só aqui, o que Node não consegue provar:
//  - foco REAL do modal (document.activeElement) e devolução do foco;
//  - Escape/clique fora com eventos de teclado e mouse de verdade;
//  - a remoção dos `onclick` inline do shell (o botão × do modal, o botão da
//    página não encontrada e o botão Fechar do modal de reporte continuam
//    funcionando SEM atributo inline).
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { resetApp, goHome } from './helpers/app.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const malicious = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'security', 'malicious-content.json'), 'utf8'),
);

/**
 * Instala uma sentinela de execução: qualquer payload que conseguir rodar
 * código escreve em `window.__xss` (todos os payloads da fixture foram
 * escritos para isso).
 * @param {import('@playwright/test').Page} page
 */
async function armarSentinela(page) {
  await page.evaluate(() => {
    window.__xss = undefined;
  });
}

/**
 * Falha se algum payload tiver executado.
 * @param {import('@playwright/test').Page} page
 * @param {string} contexto
 */
async function conferirSentinela(page, contexto) {
  const executou = await page.evaluate(() => window.__xss);
  expect(executou, `${contexto}: um payload conseguiu executar código`).toBeUndefined();
}

test.describe('sinks seguros de UI com conteúdo hostil @critical', () => {
  test('renderSafeMarkdown não cria tag, atributo, destino nem script para nenhum payload', async ({ page }) => {
    await resetApp(page);
    await goHome(page);
    await armarSentinela(page);

    const payloads = [
      ...malicious.markdown.map((caso) => ({ id: caso.id, payload: caso.payload })),
      ...malicious.textoEAtributo.map((caso) => ({ id: `texto:${caso.id}`, payload: caso.payload })),
      ...malicious.urls.map((caso) => ({ id: `url:${caso.id}`, payload: caso.payload })),
    ];

    const relatorio = await page.evaluate(async (casos) => {
      const { renderSafeMarkdown } = await import('/site/js/ui/markdown.js');
      const permitidas = new Set(['P', 'H3', 'H4', 'STRONG', 'EM', 'UL', 'LI', 'DIV', 'TABLE', 'TR', 'TD', 'TH', 'TBODY']);
      const problemas = [];

      const host = document.createElement('div');
      document.body.appendChild(host);

      for (const caso of casos) {
        host.replaceChildren();
        host.appendChild(renderSafeMarkdown(document, caso.payload));
        for (const elemento of host.querySelectorAll('*')) {
          if (!permitidas.has(elemento.tagName)) {
            problemas.push(`${caso.id}: tag ${elemento.tagName}`);
          }
          for (const atributo of elemento.attributes) {
            if (atributo.name !== 'class' || atributo.value !== 'table-wrapper') {
              problemas.push(`${caso.id}: atributo ${atributo.name}="${atributo.value}"`);
            }
          }
        }
        if (host.querySelectorAll('[href],[src],[srcset],[action]').length > 0) {
          problemas.push(`${caso.id}: destino navegável`);
        }
        // O texto hostil PRECISA continuar visível — bloquear não é apagar
        // (sanitização por blacklist apagaria). Onde o payload carrega a
        // sentinela, ela tem de aparecer como TEXTO na tela.
        if (caso.payload.includes('window.__xss') && !host.textContent.includes('window.__xss')) {
          problemas.push(`${caso.id}: o texto sumiu da tela em vez de virar texto inerte`);
        }
      }

      host.remove();
      return problemas;
    }, payloads);

    expect(relatorio).toEqual([]);
    // Um `<img onerror>` só dispara depois de o navegador tentar carregar a
    // imagem; a espera dá essa chance ao payload antes de conferirmos.
    await page.waitForTimeout(300);
    await conferirSentinela(page, 'markdown');
  });

  test('resolveSafeUrl aplica as três allowlists dentro do navegador', async ({ page }) => {
    await resetApp(page);
    await goHome(page);

    const resultados = await page.evaluate(async (casos) => {
      const { resolveSafeUrl } = await import('/site/js/ui/html.js');
      return casos.map((caso) => {
        const resultado = resolveSafeUrl(caso.payload, { kind: caso.kind, baseUrl: window.location.href });
        return { id: caso.id, esperado: caso.esperado, obtido: resultado.ok ? 'aceito' : 'rejeitado' };
      });
    }, malicious.urls);

    for (const resultado of resultados) {
      expect(resultado.obtido, `${resultado.id}`).toBe(resultado.esperado);
    }
  });

  test('setSafeText e escapeHtmlAttribute não deixam nada virar handler no parser real', async ({ page }) => {
    await resetApp(page);
    await goHome(page);
    await armarSentinela(page);

    const problemas = await page.evaluate(async (casos) => {
      const { setSafeText, escapeHtmlAttribute } = await import('/site/js/ui/html.js');
      const achados = [];
      const host = document.createElement('div');
      document.body.appendChild(host);

      for (const caso of casos) {
        host.replaceChildren();
        const alvo = document.createElement('div');
        setSafeText(alvo, caso.payload);
        host.appendChild(alvo);
        if (alvo.querySelectorAll('*').length > 0) {
          achados.push(`${caso.id}: setSafeText criou elemento`);
        }

        // Atributo sem aspas: o contexto mais frágil possível para o parser.
        host.innerHTML = `<span data-x=${escapeHtmlAttribute(caso.payload)}>t</span>`;
        const span = host.querySelector('span');
        const nomes = [...span.attributes].map((a) => a.name.toLowerCase());
        if (nomes.length !== 1 || nomes[0] !== 'data-x') {
          achados.push(`${caso.id}: atributos ${nomes.join(',')}`);
        }
        if (span.getAttribute('data-x') !== caso.payload) {
          achados.push(`${caso.id}: valor do atributo alterado`);
        }
      }

      host.remove();
      return achados;
    }, malicious.textoEAtributo);

    expect(problemas).toEqual([]);
    await page.waitForTimeout(300);
    await conferirSentinela(page, 'texto/atributo');
  });
});

test.describe('shell sem handlers inline @critical', () => {
  test('o botão de fechar do modal não tem onclick inline e fecha o modal', async ({ page }) => {
    await resetApp(page);
    await goHome(page);

    const botaoFechar = page.locator('#modal-overlay .modal-fechar');
    expect(await botaoFechar.getAttribute('onclick')).toBeNull();

    await page.locator('#btn-reportar-bug').click();
    await expect(page.locator('#modal-overlay')).toBeVisible();
    await expect(page.locator('#modal-titulo')).toHaveText('Reportar Problema');

    await botaoFechar.click();
    await expect(page.locator('#modal-overlay')).toBeHidden();
  });

  test('o modal de reporte monta os links da allowlist e o botão Fechar sem onclick', async ({ page }) => {
    await resetApp(page);
    await goHome(page);
    await page.locator('#btn-reportar-bug').click();

    const links = page.locator('#modal-corpo a');
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute(
      'href',
      'https://www.reddit.com/r/rpgbrasil/comments/1sgrj1j/criador_de_ficha_dd_55_2024_web_e_mobile_gratuito/',
    );
    await expect(links.nth(1)).toHaveAttribute('href', 'https://www.reddit.com/user/ZaitBrz/');
    await expect(links.nth(0)).toHaveAttribute('rel', 'noopener noreferrer');

    const fechar = page.locator('#modal-acoes button');
    expect(await fechar.getAttribute('onclick')).toBeNull();
    await fechar.click();
    await expect(page.locator('#modal-overlay')).toBeHidden();
  });

  test('a página não encontrada volta para a home por listener delegado, sem onclick', async ({ page }) => {
    await resetApp(page);
    await page.evaluate(() => {
      window.location.hash = 'rota-que-nao-existe';
    });
    await page.waitForSelector('[data-acao="voltar-home"]');

    const botao = page.locator('[data-acao="voltar-home"]');
    expect(await botao.getAttribute('onclick')).toBeNull();
    await botao.click();
    await expect(page).toHaveURL(/#home$/);
    await page.waitForSelector('.empty-state, .char-list');
  });

  test('nenhum handler inline sobrou no HTML do shell', async ({ page }) => {
    await resetApp(page);
    await goHome(page);
    // Task 37: TODO o documento (shell + home renderizada) precisa estar sem
    // handler inline — foi isso que permitiu remover 'unsafe-inline' de
    // script-src na CSP (asserção abaixo). style-src mantém 'unsafe-inline'
    // por escopo aprovado.
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    const scriptSrc = /script-src([^;]*)/.exec(csp)?.[1] ?? '';
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    const styleSrc = /style-src([^;]*)/.exec(csp)?.[1] ?? '';
    expect(styleSrc).toContain("'unsafe-inline'");
    const inlineNoShell = await page.evaluate(() => {
      const alvos = [document.documentElement];
      const achados = [];
      for (const raiz of alvos) {
        for (const elemento of [raiz, ...raiz.querySelectorAll('*')]) {
          for (const atributo of elemento.attributes) {
            if (atributo.name.toLowerCase().startsWith('on')) {
              achados.push(`${elemento.tagName}#${elemento.id}[${atributo.name}]`);
            }
          }
        }
      }
      return achados;
    });
    expect(inlineNoShell).toEqual([]);
  });
});

test.describe('modal: foco, Escape e pilha no navegador real', () => {
  test('Escape e clique fora fecham; o foco real vai para o modal e volta depois', async ({ page }) => {
    await resetApp(page);
    await goHome(page);

    // O serviço com foco/Escape ligados (a fachada legada os desliga por
    // compatibilidade; aqui é exercitado o contrato do serviço em si).
    const resultado = await page.evaluate(async () => {
      const { createModalService } = await import('/site/js/ui/modal.js');
      const overlay = document.getElementById('modal-overlay');
      const service = createModalService({
        documentRef: document,
        overlay,
        container: document.getElementById('modal-container'),
        titleElement: document.getElementById('modal-titulo'),
        bodyElement: document.getElementById('modal-corpo'),
        actionsElement: document.getElementById('modal-acoes'),
        closeButton: overlay.querySelector('.modal-fechar'),
      });

      const anterior = document.getElementById('btn-reportar-bug');
      anterior.focus();
      const antesDeAbrir = document.activeElement === anterior;

      const motivos = [];
      const corpo = document.createElement('p');
      corpo.textContent = 'conteúdo';
      service.open({ title: 'Foco', content: corpo, onClose: (motivo) => motivos.push(motivo) });
      const focoNoModal = document.getElementById('modal-overlay').contains(document.activeElement);

      window.__servicoDeTeste = { service, motivos, anterior };
      return { antesDeAbrir, focoNoModal, aberto: service.getStackSize() };
    });

    expect(resultado.antesDeAbrir).toBe(true);
    expect(resultado.focoNoModal, 'o foco real deveria estar dentro do modal').toBe(true);
    expect(resultado.aberto).toBe(1);

    await page.keyboard.press('Escape');
    const depoisDoEscape = await page.evaluate(() => ({
      pilha: window.__servicoDeTeste.service.getStackSize(),
      motivos: window.__servicoDeTeste.motivos,
      focoRestaurado: document.activeElement === window.__servicoDeTeste.anterior,
    }));
    expect(depoisDoEscape.pilha).toBe(0);
    expect(depoisDoEscape.motivos).toEqual(['escape']);
    expect(depoisDoEscape.focoRestaurado, 'o foco real deveria voltar ao elemento anterior').toBe(true);

    // Clique fora (mouse de verdade sobre o backdrop).
    await page.evaluate(() => {
      const corpo = document.createElement('p');
      corpo.textContent = 'de novo';
      window.__servicoDeTeste.service.open({ title: 'Fora', content: corpo });
    });
    await expect(page.locator('#modal-overlay')).toBeVisible();
    await page.locator('#modal-overlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#modal-overlay')).toBeHidden();
  });

  test('sub-modal empilha, fecha por cima e mantém o principal aberto', async ({ page }) => {
    await resetApp(page);
    await goHome(page);

    // ATUALIZAÇÃO CONSCIENTE (Task 37): a CSP removeu 'unsafe-inline' de
    // script-src (site/index.html), então `onclick="fecharModal()"` inline é
    // BLOQUEADO pelo navegador — comportamento desejado. O vocabulário real de
    // fechamento é o declarativo `data-action="fechar-modal"`, religado por
    // `abrirModal` (site/js/utils.js). O teste cobre os dois lados: o botão
    // inline legado NÃO fecha mais nada, e o declarativo fecha só o sub-modal.
    await page.evaluate(async () => {
      const { abrirModal } = await import('/site/js/utils.js');
      abrirModal('Principal', '<p>um</p>');
      abrirModal(
        'Sub',
        '<p>dois</p>',
        '<button class="btn" id="btn-inline-legado" onclick="window.__inlineExecutou=1;fecharModal()">Inline legado</button>' +
        '<button class="btn" id="btn-declarativo" data-action="fechar-modal">Fechar sub</button>',
      );
    });

    await expect(page.locator('#sub-modal-overlay-1')).toBeVisible();
    await expect(page.locator('#sub-modal-overlay-1 .modal-header h2')).toHaveText('Sub');
    await expect(page.locator('#modal-overlay')).toBeVisible();

    // O botão com onclick inline não executa nada sob a CSP nova: o sub-modal
    // continua aberto e a sentinela nunca é escrita.
    await page.locator('#sub-modal-overlay-1 #btn-inline-legado').click();
    await expect(page.locator('#sub-modal-overlay-1')).toBeVisible();
    const inlineExecutou = await page.evaluate(() => window.__inlineExecutou);
    expect(inlineExecutou, 'onclick inline deveria ser bloqueado pela CSP sem unsafe-inline').toBeUndefined();

    // Botão declarativo `data-action="fechar-modal"`: fecha o sub-modal,
    // não o principal.
    await page.locator('#sub-modal-overlay-1 #btn-declarativo').click();
    await expect(page.locator('#sub-modal-overlay-1')).toHaveCount(0);
    await expect(page.locator('#modal-overlay')).toBeVisible();

    await page.locator('#modal-overlay .modal-fechar').click();
    await expect(page.locator('#modal-overlay')).toBeHidden();
  });

  test('o título de um sub-modal com markup é mostrado como texto (era XSS no baseline)', async ({ page }) => {
    await resetApp(page);
    await goHome(page);
    await armarSentinela(page);

    await page.evaluate(async () => {
      const { abrirModal } = await import('/site/js/utils.js');
      abrirModal('Principal', '<p>um</p>');
      abrirModal('<img src=x onerror="window.__xss=1">', '<p>dois</p>');
    });

    await expect(page.locator('#sub-modal-overlay-1 .modal-header h2')).toHaveText('<img src=x onerror="window.__xss=1">');
    await expect(page.locator('#sub-modal-overlay-1 .modal-header img')).toHaveCount(0);
    await page.waitForTimeout(300);
    await conferirSentinela(page, 'título de sub-modal');
  });
});

test.describe('toast e Markdown legítimo no navegador real', () => {
  test('o toast mostra a mensagem como texto', async ({ page }) => {
    await resetApp(page);
    await goHome(page);
    await armarSentinela(page);

    await page.evaluate(async () => {
      const { toast } = await import('/site/js/utils.js');
      toast('<img src=x onerror="window.__xss=1">', 'error');
    });

    const toastLocator = page.locator('#toast-container .toast');
    await expect(toastLocator).toHaveText('<img src=x onerror="window.__xss=1">');
    await expect(toastLocator.locator('img')).toHaveCount(0);
    await page.waitForTimeout(300);
    await conferirSentinela(page, 'toast');
  });

  test('uma descrição real do catálogo continua com negrito, lista e tabela na tela', async ({ page }) => {
    await resetApp(page);
    await goHome(page);

    const estrutura = await page.evaluate(async () => {
      const { renderSafeMarkdown } = await import('/site/js/ui/markdown.js');
      const host = document.createElement('div');
      document.body.appendChild(host);
      host.appendChild(
        renderSafeMarkdown(
          document,
          '### Título\n\n**Negrito** e *itálico*, dano 3d6.\n\n- item um\n- item dois\n\n|a|b|\n|c|d|',
        ),
      );
      const resultado = {
        h3: host.querySelectorAll('h3').length,
        strong: host.querySelectorAll('strong').length,
        em: host.querySelectorAll('em').length,
        li: host.querySelectorAll('li').length,
        tabelas: host.querySelectorAll('.table-wrapper table tr').length,
        dados: host.textContent.includes('🎲3d6🎲'),
      };
      host.remove();
      return resultado;
    });

    expect(estrutura).toEqual({ h3: 1, strong: 1, em: 1, li: 2, tabelas: 2, dados: true });
  });
});
