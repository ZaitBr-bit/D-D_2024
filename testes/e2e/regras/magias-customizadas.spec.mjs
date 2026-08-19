// ============================================================
// Magia PERSONALIZADA: o que o jogador digita no formulário tem de
// sobreviver ao "Salvar", e o que ele marcou tem de aparecer na ficha.
//
// Dois defeitos relatados pelo jogador (2026-08-19), cada um com o seu
// teste aqui:
//
//   1. GATILHO DA REAÇÃO SOME. O formulário mostra o campo "Gatilho da
//      reação" quando o tempo de conjuração é Reação, e o caminho de
//      EDIÇÃO sabe ler `"Reação, <gatilho>"` de volta para o campo
//      (grimorio.js:512-513) -- mas o caminho de SALVAR nunca lia o
//      campo. O gatilho digitado morria no DOM.
//
//   2. SELO DE RITUAL SOME NO GRIMÓRIO. O Mago que cria uma magia
//      personalizada de círculo > 0 ganha a magia no `char.grimorio`
//      (grimorio.js), mas a linha do Grimório deriva o marcador Ritual
//      de `ehMagiaRitual(nome)`, que só consulta o ACERVO -- magia
//      personalizada não está lá, e o campo `ritual: true` que o
//      jogador marcou era ignorado nessa seção.
//
// Os dois testes CLICAM na tela (memória do projeto: botão novo só está
// entregue com spec que clica nele) e leem o personagem SALVO, não o
// DOM do formulário -- é a gravação que o jogador acusou de perder o
// dado, e só a leitura do store mede isso.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const MAGO = {
  classe: 'Mago', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
};

const GATILHO = 'quando uma criatura que você vê o ataca';

/** Abre todos os `<details>` da ficha -- o Playwright não clica no que está escondido. */
async function abrirTudo(page) {
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  await assentar(page).catch(() => {});
}

/**
 * Preenche o formulário de Magia Personalizada com os campos obrigatórios,
 * deixando escola e duração no modo "Personalizado…" para não depender de
 * qual valor o acervo oferece no dropdown.
 */
async function preencherFormulario(page, { nome, tempo, ritual = false }) {
  await page.fill('#mc-nome', nome);
  await page.selectOption('#mc-circulo', '1');
  await page.selectOption('#mc-escola', '__personalizado__');
  await page.fill('#mc-escola-personalizada', 'Abjuração');
  await page.selectOption('#mc-tempo', tempo);
  await page.fill('#mc-alcance', 'Pessoal');
  await page.check('#mc-comp-v');
  await page.selectOption('#mc-duracao', '__personalizado__');
  await page.fill('#mc-duracao-texto', 'Instantânea');
  if (ritual) await page.check('#mc-ritual');
}

test('magia personalizada de Reação: o gatilho digitado sobrevive ao salvar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO, 'regras-magia-custom-gatilho');
  await assentar(page).catch(() => {});

  await page.click('#btn-add-magia-custom');
  await page.waitForSelector('#mc-nome', { state: 'visible', timeout: 20_000 });

  await preencherFormulario(page, { nome: 'Escudo de Nimb', tempo: 'Reação' });

  // GUARDA CONTRA VACUIDADE: o campo de gatilho só existe/aparece quando o
  // tempo é Reação. Se ele estivesse escondido, "o gatilho sumiu" seria uma
  // afirmação sobre um campo que o jogador nunca teve como preencher.
  await expect(page.locator('#mc-gatilho-reacao'),
    'com tempo de conjuração "Reação" o formulário precisa oferecer o campo de gatilho')
    .toBeVisible();
  await page.fill('#mc-gatilho-reacao', GATILHO);

  await page.click('#btn-salvar-mc');
  await expect(page.locator('#toast-container'),
    'a magia precisa ter sido gravada antes de medir o que foi gravado')
    .toContainText('adicionada');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  const magia = (salvo?.magias_customizadas || []).find(m => m?.nome === 'Escudo de Nimb');
  expect(magia, 'a magia personalizada precisa estar no personagem salvo').toBeTruthy();
  expect(magia.tempo_conjuracao,
    'o gatilho digitado no campo "Gatilho da reação" tem de ser gravado junto do tempo de '
    + 'conjuração -- é o formato "Reação, <gatilho>" que o próprio formulário sabe reler ao editar')
    .toContain(GATILHO);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('magia personalizada de Reação: ao reabrir para editar, o gatilho volta no campo', async ({ context }) => {
  // O contraste do teste acima: gravar no formato certo não basta se o
  // formulário não reler. Sem este par, um formato de gravação qualquer
  // passaria no primeiro teste e o jogador continuaria vendo o campo vazio.
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: 'Escudo de Nimb', circulo: 1, escola: 'Abjuração',
      tempo_conjuracao: `Reação, ${GATILHO}`, alcance: 'Pessoal',
      componentes: 'V', duracao: 'Instantânea', descricao: '', dano: '', ritual: false,
    }],
  }, 'regras-magia-custom-gatilho-edicao');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  await clicarSeletorFicha(page, '[data-editar-magia-custom]', { esperar: '#mc-gatilho-reacao' });

  await expect(page.locator('#mc-gatilho-reacao'),
    'ao editar uma magia de Reação já gravada, o gatilho tem de voltar preenchido no campo')
    .toHaveValue(GATILHO);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('grimório do Mago: magia personalizada marcada como Ritual mostra o selo Ritual', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: 'Selo de Nimb', circulo: 1, escola: 'Abjuração',
      tempo_conjuracao: 'Ação', alcance: 'Pessoal', componentes: 'V',
      duracao: 'Instantânea', descricao: '', dano: '', ritual: true,
    }],
    grimorio: [{ nome: 'Selo de Nimb', circulo: 1 }],
  }, 'regras-magia-custom-ritual');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  // GUARDA CONTRA VACUIDADE: a linha precisa existir no Grimório antes de
  // qualquer afirmação sobre o selo dela.
  const linha = page.locator('[data-details-id="grimorio-mago"] [data-magia-nome="Selo de Nimb"]');
  await expect(linha,
    'a magia personalizada de círculo > 0 do Mago vive no grimório -- sem a linha, nada a medir')
    .toHaveCount(1);

  await expect(linha,
    'o jogador marcou "Pode ser conjurada como Ritual" no formulário; o selo Ritual tem de '
    + 'aparecer no grimório como aparece para magia do acervo')
    .toContainText('Ritual');

  // O selo vem acompanhado do botão -- e botão só está entregue quando um
  // spec CLICA nele. Aqui o clique também prova que o botão do grimório está
  // ligado ao handler certo: o do acervo se guarda com `ehMagiaRitual`, que
  // não conhece magia personalizada, e não faria nada.
  const antes = (await personagemSalvo(page))?.espacos_magia?.['1']?.usados ?? null;
  expect(antes, 'o spec precisa ler os espaços de 1º círculo antes de medir o efeito do clique')
    .not.toBeNull();

  await clicarSeletorFicha(page,
    '[data-details-id="grimorio-mago"] [data-conjurar-ritual-custom]',
    { esperar: '#toast-container' });
  await expect(page.locator('#toast-container'),
    'a conjuração ritual precisa ter acontecido antes de medir os espaços')
    .toContainText('conjurada como Ritual');
  await assentar(page).catch(() => {});

  expect((await personagemSalvo(page))?.espacos_magia?.['1']?.usados,
    'a versão Ritual NÃO utiliza um espaço de magia (Magias.md:62)')
    .toBe(antes);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('editar magia personalizada de Ritual: a marca de Ritual sobrevive à edição', async ({ context }) => {
  // Terceira causa do mesmo relato ("o ritual some"): o formulário deriva a
  // caixa "Pode ser conjurada como Ritual" do TEXTO do tempo de conjuração,
  // e essa derivação roda DEPOIS de preencher o formulário com a magia
  // existente. Numa magia gravada com `ritual: true` e tempo "Ação" (o
  // jogador marcou a caixa à mão), abrir para editar desmarcava a caixa
  // sozinho -- e salvar qualquer outra alteração apagava o Ritual.
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: 'Selo de Nimb', circulo: 1, escola: 'Abjuração',
      tempo_conjuracao: 'Ação', alcance: 'Pessoal', componentes: 'V',
      duracao: 'Instantânea', descricao: 'Original', dano: '', ritual: true,
    }],
    grimorio: [{ nome: 'Selo de Nimb', circulo: 1 }],
  }, 'regras-magia-custom-ritual-edicao');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  await clicarSeletorFicha(page, '[data-editar-magia-custom]', { esperar: '#mc-ritual' });

  await expect(page.locator('#mc-ritual'),
    'a magia foi gravada como Ritual; ao abrir para editar, a caixa tem de vir marcada')
    .toBeChecked();

  // E o clique no Salvar é o que mede o prejuízo real: sem ele, "a caixa
  // veio desmarcada" seria só cosmético.
  await page.fill('#mc-desc', 'Editada');
  await page.click('#btn-salvar-mc');
  await expect(page.locator('#toast-container'),
    'a edição precisa ter sido gravada antes de medir o que sobrou dela')
    .toContainText('atualizada');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo?.magias_customizadas?.[0]?.ritual,
    'editar a descrição não pode apagar o marcador Ritual da magia')
    .toBe(true);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('grimório do Mago: magia personalizada SEM Ritual não ganha o selo -- o contraste', async ({ context }) => {
  // Sem este contraste, "aparece Ritual" passaria numa tela que carimba
  // Ritual em toda linha do grimório.
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: 'Selo Mundano', circulo: 1, escola: 'Abjuração',
      tempo_conjuracao: 'Ação', alcance: 'Pessoal', componentes: 'V',
      duracao: 'Instantânea', descricao: '', dano: '', ritual: false,
    }],
    grimorio: [{ nome: 'Selo Mundano', circulo: 1 }],
  }, 'regras-magia-custom-sem-ritual');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  const linha = page.locator('[data-details-id="grimorio-mago"] [data-magia-nome="Selo Mundano"]');
  await expect(linha, 'a linha precisa existir para o contraste medir alguma coisa').toHaveCount(1);
  await expect(linha,
    'magia personalizada sem o marcador Ritual não pode ganhar o selo')
    .not.toContainText('Ritual');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
