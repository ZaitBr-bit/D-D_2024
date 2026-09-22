// ============================================================
// Issue #114: "Exportar Todos" e o exportar individual não baixavam nada
// no Android (Opera GX).
//
// Os dois handlers (site/js/pages/home.js) clicavam numa `<a download>`
// que nunca entrava no DOM e revogavam o blob na linha seguinte ao
// `a.click()`. O download de blob é assíncrono: navegador que só lê o
// blob depois do fim da tarefa encontra a URL já revogada e descarta o
// arquivo em silêncio. O Chromium desktop tolera a corrida, então o
// round trip de home-exportar-importar.spec.mjs passava verde com o
// defeito presente -- por isso este spec não mede "baixou", mede as duas
// condições que o navegador móvel exige: a âncora está no documento no
// instante do clique, e o revoke NÃO acontece junto com o clique.
//
// `a.click()` e `URL.revokeObjectURL` são instrumentados antes de o app
// carregar (addInitScript), e o clique no botão é real (`tap`, com
// emulação de toque).
// ============================================================
import { expect, test } from '@playwright/test';
import { ATRIBUTOS_REGRAS, NOVO, abrirSite, assentar } from './helpers-regras.mjs';
import { semearPersonagem } from '../helpers.mjs';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 } });

const SEMENTE = {
  nome: 'Exportado no Celular', classe: 'Guerreiro', nivel: 1,
  especie: 'Humano', antecedente: 'Soldado', atributos: ATRIBUTOS_REGRAS,
};

// Registra cada clique em âncora de blob e cada revoke, com o instante.
const INSTRUMENTO = () => {
  window.__downloads = [];
  const clickOrig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.href.startsWith('blob:')) {
      window.__downloads.push({ ev: 'click', t: performance.now(), noDocumento: this.isConnected, href: this.href });
    }
    return clickOrig.call(this);
  };
  const revokeOrig = URL.revokeObjectURL;
  URL.revokeObjectURL = function (url) {
    window.__downloads.push({ ev: 'revoke', t: performance.now(), href: url });
    return revokeOrig.call(URL, url);
  };
};

/** Abre a home com um personagem semeado e a instrumentação ativa. */
async function abrirHome(context) {
  await context.addInitScript(INSTRUMENTO);
  const { page } = await abrirSite(context);
  await semearPersonagem(page, SEMENTE, 'regras-exp-robusto');
  await page.goto(NOVO, { waitUntil: 'domcontentloaded' });
  await assentar(page);
  return page;
}

/**
 * Toca no botão, espera o download e 1,5 s a mais, e devolve o registro.
 * O intervalo é o que separa "revogou junto com o clique" de "revogou
 * depois que o navegador já leu o blob".
 */
async function registroDoDownload(page, seletor) {
  const baixando = page.waitForEvent('download');
  await page.locator(seletor).first().tap();
  await baixando;
  await page.waitForTimeout(1500);
  return page.evaluate(() => window.__downloads);
}

/** Afirma as duas condições do download robusto sobre o registro. */
function afirmarDownloadRobusto(registro) {
  const clique = registro.find(r => r.ev === 'click');
  expect(clique, 'nenhum clique em âncora de blob foi registrado').toBeTruthy();
  expect(clique.noDocumento,
    'a âncora de download precisa estar no documento no instante do clique').toBe(true);
  const revokeCedo = registro.find(r => r.ev === 'revoke' && r.href === clique.href && r.t - clique.t < 1000);
  expect(revokeCedo,
    'o blob foi revogado junto com o clique -- navegador móvel descarta o download').toBeUndefined();
}

test('#114: Exportar Todos mantém a âncora no documento e não revoga o blob junto do clique', async ({ context }) => {
  const page = await abrirHome(context);
  afirmarDownloadRobusto(await registroDoDownload(page, '#btn-exportar'));
});

test('#114: exportar individual mantém a âncora no documento e não revoga o blob junto do clique', async ({ context }) => {
  const page = await abrirHome(context);
  afirmarDownloadRobusto(await registroDoDownload(page, '[data-action="exportar-individual"]'));
});
