// ============================================================
// Prova por navegador de que a lista de talentos da subida de nível se
// RECOLHE ao escolher.
//
// Problema relatado: talentos que exigem uma escolha extra (o atributo do
// "Aumento no Valor de Atributo", as perícias do Habilidoso, a arma do
// Mestre das Armas) montam essa escolha em `#levelup-talento-escolhas`,
// que vem DEPOIS de `#levelup-talento-lista` -- ou seja, depois de ~49
// cards. O jogador escolhia o talento, não via a pendência (estava fora da
// tela), tentava avançar e só então era barrado, sem entender por quê.
//
// A correção (levelup-ui.js, `montarListaTalentos`) remonta o mesmo
// montarSeletor com apenas o talento escolhido assim que a escolha
// acontece, mais um link "trocar talento" para reabrir. Com um card só, a
// escolha pendente passa a ser a única coisa na tela.
//
// Este teste mede as três metades da correção: recolher, deixar a escolha
// visível sem rolagem, e reabrir limpando a pendência (sem o `innerHTML`
// de `#levelup-talento-escolhas` sendo limpo, a escolha do talento antigo
// sobreviveria à troca).
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, irAteEscolhaDeTalento } from './helpers-regras.mjs';

test('lista de talentos da subida de nível recolhe ao escolher e deixa a escolha à vista', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', nivel: 3, xp: 2700,
    atributos: { forca: 15, destreza: 14, constituicao: 14, inteligencia: 13, sabedoria: 12, carisma: 13 },
    talentos: [],
  }, 'regras-recolhe-talento');

  expect(await irAteEscolhaDeTalento(page), 'não chegou à tela de ASI/talento').toBe(true);
  await page.check('input[name="levelup-asi-modo"][value="talento"]', { timeout: 1500 }).catch(() => {});
  await page.waitForSelector('#levelup-talento-lista .opcao-card', { state: 'visible', timeout: 10_000 });

  const antes = await page.evaluate(() => ({
    cards: document.querySelectorAll('#levelup-talento-lista .opcao-card').length,
    temTrocar: Boolean(document.querySelector('#levelup-talento-lista [data-trocar-talento]')),
  }));
  expect(antes.cards, 'a lista aberta deveria trazer o catálogo inteiro').toBeGreaterThan(20);
  expect(antes.temTrocar, 'sem talento escolhido não deveria existir link de "trocar talento"').toBe(false);

  // Atleta exige escolher o atributo (Força ou Destreza) -- é justamente o
  // caso do relato.
  await page.locator('#levelup-talento-lista .opcao-card[data-opcao="Atleta"]').click();
  await page.waitForTimeout(500);

  const depois = await page.evaluate(() => {
    const lista = document.getElementById('levelup-talento-lista');
    const escolhas = document.getElementById('levelup-talento-escolhas');
    const cont = document.getElementById('modal-container');
    const r = escolhas?.getBoundingClientRect();
    const rc = cont?.getBoundingClientRect();
    return {
      cards: lista.querySelectorAll('.opcao-card').length,
      marcado: lista.querySelector('.opcao-card.selecionada')?.dataset.opcao || '',
      temTrocar: Boolean(lista.querySelector('[data-trocar-talento]')),
      temEscolha: Boolean(escolhas?.querySelector('select, input, .opcao-card')),
      // A escolha cabe na área visível do modal, sem precisar rolar.
      escolhaNaTela: Boolean(r && rc && r.top < rc.bottom && r.bottom > rc.top),
    };
  });
  expect(depois.cards, 'recolhida, a lista deveria mostrar só o talento escolhido').toBe(1);
  expect(depois.marcado, 'o card que sobrou deveria ser o escolhido').toBe('Atleta');
  expect(depois.temTrocar, 'faltou o link "trocar talento" para reabrir a lista').toBe(true);
  expect(depois.temEscolha, 'a escolha de atributo do Atleta deveria estar montada').toBe(true);
  expect(depois.escolhaNaTela, 'a escolha pendente deveria caber na tela sem rolar -- é o ponto da correção').toBe(true);

  // "trocar talento" devolve a lista inteira, sem seleção e sem a escolha
  // pendente do talento anterior.
  await page.locator('#levelup-talento-lista [data-trocar-talento]').click();
  await page.waitForTimeout(400);

  const reaberto = await page.evaluate(() => ({
    cards: document.querySelectorAll('#levelup-talento-lista .opcao-card').length,
    marcados: document.querySelectorAll('#levelup-talento-lista .opcao-card.selecionada').length,
    escolhasVazio: (document.getElementById('levelup-talento-escolhas')?.innerHTML || '').trim() === '',
  }));
  expect(reaberto.cards, 'a lista inteira deveria voltar ao clicar em "trocar talento"').toBeGreaterThan(20);
  expect(reaberto.marcados, 'nada deveria ficar marcado depois de pedir para trocar').toBe(0);
  expect(reaberto.escolhasVazio, 'a escolha do talento anterior deveria ser limpa ao trocar').toBe(true);

  expect(erros).toEqual([]);
});

// ============================================================
// Guarda do vazamento de handler que o recolhimento acima expôs.
//
// montarSeletor/montarTroca reescrevem `el.innerHTML` -- o que descarta os
// listeners dos FILHOS -- mas registravam o clique no PRÓPRIO `el`, que
// sobrevive. Enquanto cada tela remontava o container inteiro, o elemento
// era sempre novo e o vazamento não aparecia. Com a lista de talentos
// recolhendo e reabrindo NO MESMO elemento, montar-recolher-reabrir deixava
// três handlers vivos: um clique em "ver detalhes" abria três popups
// idênticos empilhados (relato do dono do produto, com print), e um clique
// num card marcava e desmarcava na mesma ação.
//
// Corrigido em ui-opcoes.js com `ligarClique`, que remove o handler
// anterior do elemento (WeakMap) antes de registrar o novo. Este teste
// exercita o ciclo completo de remontagem porque é ele que produz o
// vazamento -- clicar em "ver detalhes" numa lista recém-montada passava
// mesmo com o bug presente.
// ============================================================
test('ver detalhes abre UM popup só, mesmo depois de recolher e reabrir a lista', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', nivel: 3, xp: 2700,
    atributos: { forca: 15, destreza: 14, constituicao: 14, inteligencia: 13, sabedoria: 12, carisma: 13 },
    talentos: [],
  }, 'regras-popup-unico');

  expect(await irAteEscolhaDeTalento(page), 'não chegou à tela de ASI/talento').toBe(true);
  await page.check('input[name="levelup-asi-modo"][value="talento"]', { timeout: 1500 }).catch(() => {});
  await page.waitForSelector('#levelup-talento-lista .opcao-card', { state: 'visible', timeout: 10_000 });

  // Escolher recolhe (2ª montagem) e "trocar talento" reabre (3ª montagem).
  await page.locator('#levelup-talento-lista .opcao-card[data-opcao="Alerta"]').click();
  await page.waitForTimeout(400);
  await page.locator('#levelup-talento-lista [data-trocar-talento]').click();
  await page.waitForTimeout(400);

  await page.locator('#levelup-talento-lista .opcao-card[data-opcao="Atleta"] [data-ver]').click();
  await page.waitForTimeout(800);

  const popups = await page.evaluate(() => [...document.querySelectorAll('.sub-modal-overlay')]
    .map(m => m.querySelector('.modal-titulo, h3, h2')?.textContent?.trim() || ''));
  expect(popups, 'um clique em "ver detalhes" abriu mais de um popup -- ' +
    'handler de clique acumulado no container a cada remontagem de montarSeletor')
    .toEqual(['Atleta']);

  // O mesmo vazamento fazia um clique no card marcar e desmarcar de uma vez.
  await page.locator('.sub-modal-overlay .modal-fechar, .sub-modal-overlay [onclick*="fechar"]').first().click().catch(() => {});
  await page.waitForTimeout(400);
  await page.locator('#levelup-talento-lista .opcao-card[data-opcao="Atleta"]').click();
  await page.waitForTimeout(400);
  const marcados = await page.evaluate(() =>
    [...document.querySelectorAll('#levelup-talento-lista .opcao-card.selecionada')].map(c => c.dataset.opcao));
  expect(marcados, 'um clique no card não marcou -- sinal de dois handlers alternando a seleção')
    .toEqual(['Atleta']);

  expect(erros).toEqual([]);
});
