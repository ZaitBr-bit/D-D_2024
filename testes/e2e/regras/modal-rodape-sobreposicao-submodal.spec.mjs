// ============================================================
// Issue #87 -- a mesma sobreposição já corrigida para o modal PRINCIPAL
// (ver modal-rodape-sobreposicao.spec.mjs, bug de 2026-08-13) reaparecia
// no SUB-MODAL empilhado ("Configurar Talento", aberto sobre "Adicionar
// Talento" ao escolher Mestre das Armas -- utils.js/abrirModal).
//
// Causa: o clone inline do sub-modal (utils.js) nunca recebeu o mesmo
// ajuste de `z-index: 3` que `.modal-header`/`.modal-acoes` têm em
// app.css -- ficou com `z-index: 1`, MENOR que o `z-index: 2` de
// `.opcao-check` (o círculo de seleção). A lista de armas (Simples E
// Marciais, mais de 20 opções) é longa o bastante para rolar por baixo do
// rodapé fixo do sub-modal, reproduzindo o print do relato.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, ATRIBUTOS_REGRAS, clicarBotaoFicha } from './helpers-regras.mjs';

test.use({ viewport: { width: 375, height: 780 } });

const SEMENTE = {
  classe: 'Guerreiro', nivel: 4, xp: 2700, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'], talentos: [],
};

/** Abre "+ Talento", escolhe Mestre das Armas e espera o SUB-modal
 *  "Configurar Talento" (com a lista de armas) terminar de animar. */
async function abrirConfigurarMestreDasArmas(page) {
  await clicarBotaoFicha(page, 'btn-add-talento', { esperar: '#add-talento-lista' });
  await page.click('[data-opcao="Mestre das Armas"]');
  await page.click('#btn-confirmar-add-talento');
  await page.waitForSelector('#lvlup-mestre-armas-lista .opcao-card', { timeout: 10_000 });
  await page.waitForFunction(() => {
    const containers = document.querySelectorAll('.modal-container');
    const sub = containers[containers.length - 1];
    if (!sub) return false;
    return sub.getBoundingClientRect().bottom <= window.innerHeight + 1;
  }, null, { timeout: 10_000 });
}

/** Mesma medição de modal-rodape-sobreposicao.spec.mjs, mas contra o
 *  SUB-modal (último `.modal-container`/`.modal-acoes` no DOM -- o
 *  sub-modal é anexado depois do principal, sempre por último). */
async function circulosPorCimaDasBarrasDoSubModal(page, fracao) {
  return page.evaluate((f) => {
    const containers = document.querySelectorAll('.modal-container');
    const ct = containers[containers.length - 1];
    const acoes = ct.querySelectorAll('.modal-acoes');
    const rod = acoes[acoes.length - 1].getBoundingClientRect();
    const cabs = ct.querySelectorAll('.modal-header');
    const cab = cabs[cabs.length - 1].getBoundingClientRect();
    ct.scrollTop = ct.scrollHeight * f;
    const invasores = [];
    for (const chk of ct.querySelectorAll('.opcao-check')) {
      const r = chk.getBoundingClientRect();
      if (r.width === 0) continue;
      const zona = (r.bottom > rod.top && r.top < rod.bottom) ? 'rodapé'
        : (r.top < cab.bottom && r.bottom > cab.top) ? 'cabeçalho' : null;
      if (!zona) continue;
      const alvo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (alvo && alvo.classList?.contains('opcao-check')) {
        invasores.push(`${zona} (y=${Math.round(r.top)})`);
      }
    }
    return invasores;
  }, fracao);
}

for (const fracao of [0.5, 0.9]) {
  test(`sub-modal Configurar Talento (rolagem ${fracao * 100}%): nenhum círculo de seleção fica por cima das barras fixas`, async ({ context }) => {
    const { page } = await abrirFicha(context, SEMENTE);
    await abrirConfigurarMestreDasArmas(page);

    const invasores = await circulosPorCimaDasBarrasDoSubModal(page, fracao);
    expect(invasores,
      'círculo de seleção do sub-modal pintado por cima da barra fixa -- '
      + 'o toque nesse ponto não chega ao botão')
      .toEqual([]);
  });
}

test('o sub-modal Configurar Talento realmente rola por baixo das barras (guarda do próprio teste)', async ({ context }) => {
  const { page } = await abrirFicha(context, SEMENTE);
  await abrirConfigurarMestreDasArmas(page);

  const cenario = await page.evaluate(() => {
    const containers = document.querySelectorAll('.modal-container');
    const ct = containers[containers.length - 1];
    const acoes = ct.querySelectorAll('.modal-acoes');
    const rod = acoes[acoes.length - 1].getBoundingClientRect();
    ct.scrollTop = ct.scrollHeight * 0.5;
    const dentroDoRodape = [...ct.querySelectorAll('.opcao-check')]
      .map(c => c.getBoundingClientRect())
      .filter(r => r.width > 0 && r.bottom > rod.top && r.top < rod.bottom).length;
    return { rolavel: ct.scrollHeight > ct.clientHeight, dentroDoRodape };
  });

  expect(cenario.rolavel, 'o sub-modal não rola: o teste de sobreposição não mediria nada').toBe(true);
  expect(cenario.dentroDoRodape,
    'nenhum círculo caiu na faixa do rodapé: o teste de sobreposição não mediria nada')
    .toBeGreaterThan(0);
});
