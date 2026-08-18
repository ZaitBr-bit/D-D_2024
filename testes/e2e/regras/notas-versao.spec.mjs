// ============================================================
// Prova por navegador (não por teste de unidade) do selo de versão e do
// modal de notas de versão -- Task 5 do plano 2026-08-08-notas-de-versao.
//
// RESOLUÇÃO DO CONTROLADOR (registrada aqui para quem ler o spec depois):
// o brief original mandava afirmar sobre `#header-versao`, mas
// `definirTituloHeader` (app.js) reescreve o `<h1>` a cada navegação e
// recria o selo SEM o atributo `id` -- o `id` só sobrevive no HTML
// estático, antes da primeira rota rodar. Usar `#header-versao` mediria o
// HTML inicial, não o app depois de rotear (que é o que o usuário vê de
// fato). Por isso este spec usa a CLASSE `.header-versao`, que o selo
// mantém em toda recriação.
//
// Nenhuma navegação artesanal aqui -- os helpers de `helpers-regras.mjs`
// (abrirSite, abrirFicha) já cobrem tudo que este spec precisa. Copiar
// `page.goto` à mão foi exatamente o erro que causou flake real no
// domínio de talentos (ver cabeçalho de helpers-regras.mjs).
// ============================================================
import { test, expect } from '@playwright/test';
import { VERSAO_ATUAL, NOTAS_VERSAO } from '../../../site/js/versao.js';
import { abrirSite, abrirFicha, SEMENTES_REGRAS, assentar } from './helpers-regras.mjs';

test('home: botão de notas existe e o selo mostra a versão manual', async ({ context }) => {
  const { page, erros } = await abrirSite(context);

  await expect(page.locator('#btn-notas-versao'), 'botão de notas de versão deveria existir na home')
    .toBeVisible();

  const selo = page.locator('.header-versao');
  await expect(selo, 'selo de versão deveria existir no header da home').toHaveCount(1);
  // Monta a expectativa a partir de VERSAO_ATUAL -- se a versão subir, o
  // spec acompanha sem precisar editar o texto esperado.
  await expect(selo).toHaveText(`v${VERSAO_ATUAL}`);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('modal de notas de versão: lista as versões, com a atual aberta e marcada', async ({ context }) => {
  const { page, erros } = await abrirSite(context);

  await page.locator('#btn-notas-versao').click();
  await page.waitForSelector('#modal-overlay', { state: 'visible' });

  // Uma <details class="nv-versao"> por entrada de NOTAS_VERSAO.
  const versoes = page.locator('details.nv-versao');
  await expect(versoes, 'deveria existir um <details> por entrada de NOTAS_VERSAO')
    .toHaveCount(NOTAS_VERSAO.length);

  // Exatamente uma marcada como atual.
  const atual = page.locator('details.nv-versao.nv-versao-atual');
  await expect(atual, 'exatamente uma versão deveria ter a classe nv-versao-atual')
    .toHaveCount(1);

  // Essa mesma tem o atributo `open` e contém o texto "atual".
  await expect(atual).toHaveAttribute('open', '');
  await expect(atual).toContainText('atual');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('modal de notas de versão: grupos de melhoria e de correção aparecem separados', async ({ context }) => {
  const { page, erros } = await abrirSite(context);

  await page.locator('#btn-notas-versao').click();
  await page.waitForSelector('#modal-overlay', { state: 'visible' });

  // Deriva os prefixos esperados (emoji + espaço) de NOTAS_VERSAO -- nunca
  // escrever o emoji literal aqui, senão o spec quebra quando o texto do
  // grupo mudar. O emoji é sempre o primeiro "token" do título (formato
  // "EMOJI Nome do grupo", ver notas-versao.js:_grupoHtml/versao.js).
  // `melhorias`/`correcoes` são OPCIONAIS: uma versão só de correções
  // (2.2.2) é legítima, e a falta da guarda aqui quebrava este spec por
  // motivo errado -- ele afirma sobre o histórico INTEIRO, não sobre cada
  // versão ter as duas seções.
  const prefixosMelhoria = [...new Set(
    NOTAS_VERSAO.flatMap((v) => (v.melhorias || []).map((g) => g.grupo.split(' ')[0])))];
  const prefixosCorrecao = [...new Set(
    NOTAS_VERSAO.flatMap((v) => (v.correcoes || []).map((g) => g.grupo.split(' ')[0])))];

  const titulos = await page.locator('.nv-grupo-titulo').allTextContents();

  expect(prefixosMelhoria.some((p) => titulos.some((t) => t.startsWith(p))),
    'deveria haver pelo menos um grupo de melhoria (título começando com o emoji de melhoria)')
    .toBe(true);
  expect(prefixosCorrecao.some((p) => titulos.some((t) => t.startsWith(p))),
    'deveria haver pelo menos um grupo de correção (título começando com o emoji de correção)')
    .toBe(true);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('dentro de uma ficha, o botão de notas de versão não existe', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, SEMENTES_REGRAS.normal);

  expect(await page.locator('#btn-notas-versao').count(),
    'o botão de notas de versão só deveria aparecer na home, não dentro de uma ficha')
    .toBe(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ------------------------------------------------------------------------
// Ajuste pedido pelo usuário depois de ver a tela pronta (Task 7): o botão
// de notas ganha rótulo em texto, o selo de versão vira clicável (só na
// home) e o header precisa caber em 375px sem transbordar.
// ------------------------------------------------------------------------

test('home: botão de notas tem rótulo em texto visível no desktop', async ({ context }) => {
  const { page, erros } = await abrirSite(context);

  const rotulo = page.locator('#btn-notas-versao .header-rotulo');
  await expect(rotulo, 'o botão de notas de versão deveria ter um rótulo em texto')
    .toHaveText('Notas de versão');
  await expect(rotulo, 'o rótulo deveria estar visível no desktop (viewport padrão)')
    .toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('home: o selo de versão é clicável e abre as notas de versão', async ({ context }) => {
  const { page, erros } = await abrirSite(context);

  const selo = page.locator('.header-versao');
  await expect(selo, 'o selo deveria sinalizar visualmente que é clicável na home')
    .toHaveClass(/header-versao--clicavel/);

  await selo.click();
  await page.waitForSelector('#modal-overlay', { state: 'visible' });
  await expect(page.locator('#modal-titulo'), 'clicar no selo na home deveria abrir o modal de notas de versão')
    .not.toHaveText('');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('dentro de uma ficha, o selo de versão não abre as notas de versão', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, SEMENTES_REGRAS.normal);

  const selo = page.locator('.header-versao');
  await expect(selo, 'fora da home o selo não deveria ter a classe de clicável')
    .not.toHaveClass(/header-versao--clicavel/);
  await expect(selo, 'fora da home o selo não deveria ter title de ação')
    .not.toHaveAttribute('title', /.+/);

  await selo.click();
  // Sem waitForSelector aqui de propósito: se o clique abrisse o modal por
  // engano, o overlay ficaria visível e a asserção abaixo pegaria isso.
  // Um waitForSelector(hidden) sempre passaria mesmo com o bug, porque o
  // overlay já começa oculto.
  await expect(page.locator('#modal-overlay'), 'clicar no selo dentro de uma ficha não deveria abrir o modal')
    .not.toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ------------------------------------------------------------------------
// Abertura automática ao atualizar (pedido do usuário depois da Task 7):
// o site deve abrir as notas de versão sozinho quando detecta que passou
// a rodar uma versão diferente da que este navegador já viu -- mas só uma
// vez por atualização, e nunca na primeira visita (que não é atualização
// nenhuma). Chave: `dnd_versao_vista` em localStorage (app.js).
// ------------------------------------------------------------------------

test('primeira visita: não abre as notas sozinho, mas grava a versão vista', async ({ context }) => {
  const { page, erros } = await abrirSite(context);

  // Nada foi salvo antes desta visita -- não é uma atualização.
  await expect(page.locator('#modal-overlay'), 'primeira visita não deveria abrir o modal sozinho')
    .not.toBeVisible();

  const vista = await page.evaluate(() => localStorage.getItem('dnd_versao_vista'));
  expect(vista, 'a primeira visita deveria gravar a versão atual, mesmo sem abrir o modal')
    .toBe(VERSAO_ATUAL);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('site atualizado para uma versão diferente: abre as notas sozinho, uma vez', async ({ context }) => {
  // Simula um navegador que já visitou o site numa versão anterior --
  // precisa ser gravado ANTES do app carregar, por isso addInitScript
  // (roda antes de qualquer script da página, em TODA navegação desta
  // context -- inclusive no reload do fim deste teste). Por isso a
  // condição: só força a versão antiga enquanto o app ainda não tiver
  // gravado a atual; depois que ele gravar (pós-abertura automática), o
  // reload seguinte encontra a versão já vista e não mexe em nada.
  await context.addInitScript((versaoAtual) => {
    if (localStorage.getItem('dnd_versao_vista') !== versaoAtual) {
      localStorage.setItem('dnd_versao_vista', '0.0.0-versao-anterior-de-teste');
    }
  }, VERSAO_ATUAL);

  const { page, erros } = await abrirSite(context);

  await page.waitForSelector('#modal-overlay', { state: 'visible' });
  const atual = page.locator('details.nv-versao.nv-versao-atual');
  await expect(atual, 'o modal aberto sozinho deveria mostrar a versão atual marcada')
    .toHaveAttribute('open', '');

  const vista = await page.evaluate(() => localStorage.getItem('dnd_versao_vista'));
  expect(vista, 'depois de abrir sozinho, a versão vista deveria virar a atual')
    .toBe(VERSAO_ATUAL);

  // Fecha o modal e recarrega a página inteira -- não é só navegar de
  // rota, é simular o usuário voltando ao site depois. Não deve abrir de
  // novo: a versão vista já é a atual.
  await page.evaluate(() => window.fecharModalTodos());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar(page);
  await expect(page.locator('#modal-overlay'), 'recarregar depois de já ter visto a versão atual não deveria reabrir o modal')
    .not.toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('site na mesma versão já vista: não abre as notas sozinho', async ({ context }) => {
  await context.addInitScript((versaoAtual) => {
    localStorage.setItem('dnd_versao_vista', versaoAtual);
  }, VERSAO_ATUAL);

  const { page, erros } = await abrirSite(context);

  await expect(page.locator('#modal-overlay'), 'versão já vista não deveria abrir o modal sozinho')
    .not.toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('em 375px de largura, o header não transborda e os botões não se sobrepõem', async ({ context }) => {
  const { page, erros } = await abrirSite(context);
  await page.setViewportSize({ width: 375, height: 800 });
  // Sem reload: media queries CSS já reavaliam sozinhas quando o viewport
  // muda, e um reload aqui corria o risco de resolver ANTES de init() rodar
  // e criar #btn-notas-versao (achado da revisão de 2026-08-08) -- as
  // asserções negativas abaixo passariam mesmo com o app inteiro fora do ar.
  await assentar(page);

  // Garante que o app terminou de rotear e o botão existe antes de
  // qualquer asserção negativa -- senão um app que não bootou faria as
  // asserções "escondido"/"sem sobreposição" passarem por vacuidade.
  await expect(page.locator('#btn-notas-versao'), 'botão de notas de versão deveria existir mesmo em 375px')
    .toBeAttached();

  const overflow = await page.locator('#app-header').evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(overflow.scrollWidth, `header transbordou: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`)
    .toBeLessThanOrEqual(overflow.clientWidth);

  // Rótulos em texto devem sumir no mobile -- só ícones sobram.
  await expect(page.locator('#btn-notas-versao .header-rotulo'),
    'em 375px o rótulo do botão de notas deveria estar escondido')
    .not.toBeVisible();
  await expect(page.locator('#label-reportar-bug'),
    'em 375px o rótulo de reportar bug deveria estar escondido')
    .not.toBeVisible();

  // Os elementos interativos do header não podem se sobrepor entre si.
  const caixas = await page.evaluate(() => {
    const seletores = ['#btn-voltar', '.header-versao', '#btn-notas-versao', '#btn-reportar-bug'];
    return seletores
      .map((s) => document.querySelector(s))
      .filter((el) => el && el.offsetParent !== null)
      .map((el) => el.getBoundingClientRect())
      .map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }));
  });
  for (let i = 0; i < caixas.length; i++) {
    for (let j = i + 1; j < caixas.length; j++) {
      const a = caixas[i], b = caixas[j];
      const sobrepoe = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      expect(sobrepoe, `elementos interativos do header se sobrepõem em 375px: ${JSON.stringify(a)} x ${JSON.stringify(b)}`)
        .toBe(false);
    }
  }

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ------------------------------------------------------------------------
// Ajuste pedido pelo usuário depois de ver a lista pronta (2026-08-18): no
// cabeçalho RECOLHIDO, a data ao lado do número virou um resumo de uma ou
// duas palavras. Numa lista de dez versões, dez datas quase iguais não
// ajudam a achar nada; o rótulo diz o que aquela versão mudou. A data não
// foi perdida -- saiu do cabeçalho e ficou dentro do card aberto.
// ------------------------------------------------------------------------

test('modal de notas de versão: o cabeçalho recolhido mostra o rótulo, não a data', async ({ context }) => {
  const { page, erros } = await abrirSite(context);

  await page.locator('#btn-notas-versao').click();
  await page.waitForSelector('#modal-overlay', { state: 'visible' });

  // Um rótulo por versão, e cada um com o texto que versao.js declara --
  // derivado de NOTAS_VERSAO, nunca escrito à mão aqui.
  const rotulos = page.locator('.nv-versao-rotulo');
  await expect(rotulos, 'deveria existir um rótulo por entrada de NOTAS_VERSAO')
    .toHaveCount(NOTAS_VERSAO.length);
  await expect(rotulos).toHaveText(NOTAS_VERSAO.map((v) => v.rotulo));

  // A data saiu do cabeçalho: nenhum <summary> pode conter uma data.
  const cabecalhos = await page.locator('summary.nv-versao-cabecalho').allTextContents();
  for (const v of NOTAS_VERSAO) {
    expect(cabecalhos.some((t) => t.includes(v.data)),
      `a data ${v.data} ainda aparece no cabeçalho recolhido -- ela deveria ter ido para dentro do card`)
      .toBe(false);
  }

  // ...mas continua no card, para quem quiser saber quando a versão saiu.
  const datas = await page.locator('.nv-data').allTextContents();
  for (const v of NOTAS_VERSAO) {
    expect(datas, `a data ${v.data} sumiu do card da versão ${v.versao}`).toContain(v.data);
  }

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
