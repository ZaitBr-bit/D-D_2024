// ============================================================
// O cabeçalho e o rodapé FIXOS do modal (v2.1.0) têm de ficar ACIMA do
// conteúdo que rola por baixo deles.
//
// Bug relatado em 2026-08-13 (print do "Adicionar Talento" no celular): o
// círculo de seleção de um card da lista aparecia flutuando POR CIMA do
// botão "Adicionar", solto, sem o card em volta.
//
// Causa: `.opcao-check` tem `z-index: 2` (app.css) e o `.modal-header`/
// `.modal-acoes` sticky tinham `z-index: 1`. `.opcao-card` é
// `position: relative` SEM `z-index`, e `position: relative` com
// `z-index: auto` NÃO abre contexto de empilhamento -- então o círculo
// disputava a pilha direto com o rodapé, e vencia. O CORPO do card
// (z-index auto) continuava passando por baixo do fundo opaco, o que é
// exatamente por que só a bolinha aparecia, solta.
//
// Não é só feio: o círculo pinta sobre a área do botão, então o toque
// naquele ponto não chega ao botão. Por isso a medição é
// `elementFromPoint` no centro do próprio círculo -- se o que responde ali
// for o círculo, ele está por cima da barra fixa.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, ATRIBUTOS_REGRAS, clicarBotaoFicha } from './helpers-regras.mjs';

// Viewport de celular, perto do aparelho do print (o modal é um bottom
// sheet de 85dvh; é aqui que a lista rola por baixo das duas barras).
test.use({ viewport: { width: 375, height: 780 } });

const SEMENTE = {
  classe: 'Guerreiro',
  nivel: 4,
  xp: 355000,
  atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
  talentos: [],
};

/**
 * Abre o "+ Talento" (75 cards -- a lista mais longa do app, e a do print)
 * e espera a animação `slideUp` do modal TERMINAR.
 *
 * A espera não é decorativa: `getBoundingClientRect` inclui o transform da
 * animação. Medindo antes do fim, o container aparece deslocado centenas de
 * pixels para baixo do viewport, `elementFromPoint` responde sobre pontos
 * fora da tela e o teste passa medindo coisa nenhuma -- foi exatamente o
 * que aconteceu na primeira versão deste arquivo, que passava com o bug
 * presente.
 */
async function abrirListaDeTalentos(page) {
  await clicarBotaoFicha(page, 'btn-add-talento', { esperar: '#add-talento-lista' });
  await page.waitForFunction(() => {
    const ct = document.querySelector('.modal-container');
    if (!ct) return false;
    // Animação terminada = topo do container estável dentro do viewport.
    return ct.getBoundingClientRect().bottom <= window.innerHeight + 1;
  }, null, { timeout: 10_000 });
}

/**
 * Rola a lista e devolve os círculos de seleção que invadem a faixa do
 * cabeçalho ou do rodapé fixos E estão pintados por cima deles.
 */
async function circulosPorCimaDasBarras(page, fracao) {
  return page.evaluate((f) => {
    const ct = document.querySelector('.modal-container');
    ct.scrollTop = ct.scrollHeight * f;
    const rod = document.getElementById('modal-acoes').getBoundingClientRect();
    const cab = document.querySelector('.modal-header').getBoundingClientRect();
    const invasores = [];
    for (const chk of document.querySelectorAll('.opcao-check')) {
      const r = chk.getBoundingClientRect();
      if (r.width === 0) continue;
      const zona = (r.bottom > rod.top && r.top < rod.bottom) ? 'rodapé'
        : (r.top < cab.bottom && r.bottom > cab.top) ? 'cabeçalho' : null;
      if (!zona) continue;
      const alvo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      // Só é defeito se o CÍRCULO responde no ponto: se responder a barra,
      // ele está corretamente coberto por ela.
      if (alvo && alvo.classList?.contains('opcao-check')) {
        invasores.push(`${zona} (y=${Math.round(r.top)})`);
      }
    }
    return invasores;
  }, fracao);
}

// Duas posições de rolagem: os cards têm alturas diferentes (o resumo
// quebra em 1 ou 2 linhas), então um único scrollTop pode, por sorte, não
// deixar nenhum círculo dentro da faixa das barras.
for (const fracao of [0.3, 0.6]) {
  test(`modal com lista longa (rolagem ${fracao * 100}%): nenhum círculo de seleção fica por cima das barras fixas`, async ({ context }) => {
    const { page } = await abrirFicha(context, SEMENTE);
    await abrirListaDeTalentos(page);

    const invasores = await circulosPorCimaDasBarras(page, fracao);
    expect(invasores,
      'círculo de seleção pintado por cima da barra fixa do modal — '
      + 'o toque nesse ponto não chega ao botão')
      .toEqual([]);
  });
}

test('o modal realmente rola por baixo das barras (guarda do próprio teste)', async ({ context }) => {
  // Sem isto, os testes acima passariam num modal que não rola -- nenhum
  // círculo chegaria perto das barras e a ausência de invasor não provaria
  // nada. Aqui é confirmado que o cenário medido existe de verdade.
  const { page } = await abrirFicha(context, SEMENTE);
  await abrirListaDeTalentos(page);

  const cenario = await page.evaluate(() => {
    const ct = document.querySelector('.modal-container');
    ct.scrollTop = ct.scrollHeight * 0.3;
    const rod = document.getElementById('modal-acoes').getBoundingClientRect();
    const dentroDoRodape = [...document.querySelectorAll('.opcao-check')]
      .map(c => c.getBoundingClientRect())
      .filter(r => r.width > 0 && r.bottom > rod.top && r.top < rod.bottom).length;
    return { rolavel: ct.scrollHeight > ct.clientHeight, dentroDoRodape };
  });

  expect(cenario.rolavel, 'o modal não rola: o teste de sobreposição não mediria nada').toBe(true);
  expect(cenario.dentroDoRodape,
    'nenhum círculo caiu na faixa do rodapé: o teste de sobreposição não mediria nada')
    .toBeGreaterThan(0);
});
