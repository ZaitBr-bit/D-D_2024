// ============================================================
// Issue #46: a magia PERSONALIZADA de círculo 1+ saiu da ESCOLHA.
//
// O QUE ESTE ARQUIVO MEDIA ANTES (issues #27 e #33). O jogador criava a
// magia pelo formulário "Magia Personalizada", ela era gravada em
// `char.magias_customizadas` -- e parava ali. A seção "Magias Customizadas"
// da ficha mostrava a linha marcada "Não preparada", com editar e remover,
// sem "Conjurar". O caminho normal de preparo (o modal "Preparar Magias" -> aba do
// círculo -> marcar) montava a grade SÓ a partir da lista da classe e, para
// o Mago, de `char.grimorio`: `char.magias_customizadas` nunca era lido ali.
// Sem cartão na grade não existia clique nenhum capaz de fazer a magia
// virar `magias_preparadas`. As #27/#33 puseram esse cartão na grade.
//
// O QUE A #46 MUDOU. O destino daquele caminho virou o ponto de partida: a
// customizada de círculo é SEMPRE preparada, derivada de
// `char.magias_customizadas`, e a ficha a desenha na seção Preparadas sem
// clique nenhum. Com isso o cartão da grade deixou de ter função -- pior,
// passou a ser um jeito de gravar uma SEGUNDA cópia da mesma magia em
// `magias_preparadas` (medido na revisão da Tarefa 4: a ficha desenhava a
// linha duas vezes, a segunda com `data-magia-custom-index="undefined"`, com
// Editar e Remover mortos). O modal voltou a ser só o lugar de ESCOLHER da
// lista da classe.
//
// A AFIRMAÇÃO QUE ESTES CENÁRIOS PRESERVAM não é "o clique de preparar
// funciona" -- é "a magia é CONJURÁVEL", que agora vale sem clique nenhum.
// Perder isso devolveria as #27/#33 em silêncio.
//
// E CADA CENÁRIO CARREGA O GUARDA CONTRA O EXCESSO. "A customizada não
// aparece na grade" passaria por uma grade vazia, ou por um corte que
// tivesse levado a magia da classe junto -- que é a regressão exatamente na
// população que as #27/#33 existem para atender. Por isso todo cenário que
// mede a SAÍDA da customizada afirma também que a magia da classe continua
// sendo oferecida e clicável.
//
// O CLÉRIGO é a semente do cenário principal de propósito: é classe de
// PREPARADAS e NÃO-Mago, exatamente o alcance da issue #27 (o print do
// relato é de um personagem não-Mago). Os cenários leem o personagem SALVO,
// e não só o DOM: é a AUSÊNCIA de gravação em `magias_preparadas` que esta
// mudança produz, e só a leitura do store mede isso.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

const CLERIGO = {
  classe: 'Clérigo', subclasse: '', nivel: 3, xp: 900,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Religião', 'Intuição'],
};

const MAGO = {
  classe: 'Mago', subclasse: '', nivel: 3, xp: 900,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
};

const NOME_MAGIA = 'Bênção de Nimb';
// Segunda personalizada, de 2º círculo: o contraste que impede as
// afirmações sobre a linha do 1º círculo de passarem por vacuidade -- com
// uma só, "aparece uma vez" valeria também numa ficha que só sabe desenhar
// uma linha.
const NOME_MAGIA_2 = 'Selo de Nimb';
// Magia de 1º círculo do Clérigo no ACERVO (dados/magias/circulo_1.json).
// É o GUARDA CONTRA O EXCESSO de todo cenário: ela tem de continuar com
// cartão e com check clicável na grade.
const MAGIA_CLASSE = 'Bênção';

// Carga e medição na forma que xss-campos-livres.spec.mjs já estabeleceu
// neste diretório: `src=x` falha a carregar em qualquer navegador, então o
// `onerror` dispara sozinho, sem interação. O texto visível (XSS-MARCA)
// serve para a afirmação POSITIVA -- escapar não pode virar apagar.
const CARGA = '<img src=x onerror="window.__xss=(window.__xss||0)+1">XSS-MARCA';

/** Lê os dois indicadores de injeção de uma vez, direto da página. */
async function medirInjecao(page) {
  return page.evaluate(() => ({
    scriptRodou: window.__xss ?? null,
    tagsInjetadas: document.querySelectorAll('img[src="x"]').length,
  }));
}

/** A magia personalizada do relato, no formato gravado pelo formulário. */
function magiaCustom(nome = NOME_MAGIA, circulo = 1) {
  return {
    nome, circulo, escola: 'Abjuração', tempo_conjuracao: 'Ação',
    alcance: 'Toque', componentes: 'V, S', duracao: 'Instantânea',
    descricao: 'Um brilho tênue protege o alvo por um instante.',
    dano: '', ritual: false,
  };
}

/** Abre todos os `<details>` da ficha -- o Playwright não clica no que está escondido. */
async function abrirTudo(page) {
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  await assentar(page).catch(() => {});
}

/**
 * Abre o modal "Preparar Magias" (o botão de mesmo nome da seção
 * Magias) e espera a grade
 * existir -- `mostrarBuscaMagia` é async (carrega a lista de magias da
 * classe antes de montar o HTML), então esperar o elemento cobre essa
 * corrida em vez de um timeout fixo. Mesma forma que magia-classe.spec.mjs
 * usa; helper pequeno e específico de um spec fica replicado, pela
 * convenção já estabelecida neste diretório.
 */
async function abrirGerenciarMagias(page) {
  await page.click('#btn-add-magia');
  await page.waitForSelector('#resultado-magias', { state: 'visible', timeout: 20_000 });
  await assentar(page).catch(() => {});
}

/** Troca para a aba do círculo pedido dentro do modal "Preparar Magias". */
async function abrirAbaCirculo(page, circulo) {
  const aba = page.locator(`#tabs-gerenciar-magias [data-tab-mg="${circulo}"]`);
  await expect(aba, `a aba do ${circulo}º círculo precisa existir para haver grade a medir`)
    .toHaveCount(1);
  await aba.click();
  await assentar(page).catch(() => {});
}

/** Fecha o modal e deixa a ficha re-renderizada, para medir a seção Preparadas. */
async function fecharModalERenderizar(page) {
  await page.evaluate(() => window.fecharModal?.());
  await assentar(page).catch(() => {});
  await abrirTudo(page);
}

/** As entradas de `magias_preparadas` que carregam a marca `personalizada`. */
async function preparadasMarcadas(page) {
  const p = await personagemSalvo(page);
  return (p?.magias_preparadas || []).filter((m) => m?.personalizada);
}

test('Clérigo: a customizada não tem cartão na grade do modal, e é conjurável na ficha assim mesmo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...CLERIGO,
    magias_customizadas: [magiaCustom(), magiaCustom(NOME_MAGIA_2, 2)],
  }, 'regras-magia-custom-preparar-clerigo');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  // A CAPACIDADE PRESERVADA, medida ANTES de qualquer clique: sem preparo
  // nenhum a magia já vive na seção do 1º círculo, com Conjurar. É o que as
  // issues #27/#33 pediam, agora incondicional.
  const linha = page.locator('[data-details-id="magias-circulo-1"] .magia-personalizada',
    { hasText: NOME_MAGIA });
  await expect(linha,
    'a customizada de 1º círculo tem de aparecer UMA vez na seção Preparadas, sem clique '
    + 'nenhum de preparo -- e uma vez só: duas linhas seriam a mesma magia entrando pela '
    + 'derivação E por uma entrada gravada em magias_preparadas')
    .toHaveCount(1);
  await expect(linha.locator('[data-conjurar-magia-custom]'),
    'a linha precisa ter o botão de Conjurar -- é a capacidade que as issues #27/#33 relatam '
    + 'como ausente, e que a #46 tornou incondicional')
    .toHaveCount(1);
  await expect(page.locator('[data-details-id="magias-circulo-2"] .magia-personalizada',
    { hasText: NOME_MAGIA_2 }),
  'a segunda personalizada tem de estar desenhada no círculo DELA -- sem esse contraste, '
  + '"aparece uma vez" valeria também numa ficha que só sabe desenhar uma linha')
    .toHaveCount(1);

  await abrirGerenciarMagias(page);
  await abrirAbaCirculo(page, 1);

  // GUARDA CONTRA O EXCESSO, e ele vem PRIMEIRO: a grade tem de estar
  // montada e a magia da CLASSE tem de continuar com cartão e com check.
  // Sem isto, "a customizada não está na grade" passaria por uma grade
  // vazia -- ou por um corte que levou a lista da classe junto.
  const cartaoDaClasse = page.locator(`#resultado-magias [data-circ-check="${MAGIA_CLASSE}"]`);
  await expect(cartaoDaClasse,
    `"${MAGIA_CLASSE}" é magia de 1º círculo do Clérigo: o modal continua sendo o lugar de `
    + 'escolher da lista da classe, e o check dela continua clicável')
    .toBeVisible({ timeout: 10_000 });

  // A REGRA NOVA: a magia do jogador não é escolha, então não tem cartão.
  await expect(page.locator(`#resultado-magias [data-circ-check="${NOME_MAGIA}"]`),
    'a customizada é SEMPRE preparada -- um cartão para "preparar" o que já está preparado só '
    + 'grava uma segunda cópia da mesma magia em magias_preparadas')
    .toHaveCount(0);
  await expect(page.locator('#resultado-magias .opcao-card', { hasText: NOME_MAGIA }),
    'e ela não pode aparecer nem como cartão sem check: a grade é a lista da classe')
    .toHaveCount(0);

  // O clique na magia da CLASSE continua gravando -- e gravando SEM marca.
  await cartaoDaClasse.click();
  await assentar(page).catch(() => {});
  await expect.poll(async () => {
    const p = await personagemSalvo(page);
    return (p?.magias_preparadas || []).find((m) => m?.nome === MAGIA_CLASSE) || null;
  }, {
    message: 'marcar a magia da classe na grade tem de continuar gravando em magias_preparadas[]',
  }).not.toBeNull();

  const preparada = (await personagemSalvo(page)).magias_preparadas
    .find((m) => m.nome === MAGIA_CLASSE);
  expect(preparada.classe,
    'preparada pela superfície do Clérigo, a entrada sai carimbada com essa classe')
    .toBe('Clérigo');
  expect(preparada.personalizada,
    'este modal só grava magia da lista da classe: nenhuma entrada pode sair com a marca '
    + '`personalizada` -- é ela que faz a ficha desenhar a magia duas vezes')
    .toBeUndefined();

  await fecharModalERenderizar(page);

  // DEPOIS DE MEXER NO MODAL a customizada continua desenhada UMA vez. É
  // aqui que a duplicata medida na revisão da Tarefa 4 apareceria.
  await expect(page.locator('[data-details-id="magias-circulo-1"] .magia-personalizada',
    { hasText: NOME_MAGIA }),
  'abrir o modal e preparar uma magia da classe não pode fazer a customizada duplicar')
    .toHaveCount(1);
  expect(await preparadasMarcadas(page),
    'nenhum caminho deste modal pode gravar `personalizada: true` em magias_preparadas')
    .toEqual([]);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Clérigo: o check da aba "Preparadas Atuais" continua despreparando a magia da classe', async ({ context }) => {
  // POR QUE ESTE CENÁRIO EXISTE. `data-remover-check` é o gatilho que
  // desprepara pela aba "Preparadas Atuais", e os únicos cliques nele em
  // toda a suíte estavam nos dois specs que a issue #46 reescreveu -- e
  // eram sobre a magia PERSONALIZADA, que saiu desta aba com razão. A magia
  // da CLASSE continua usando exatamente o mesmo caminho, e ficou sem
  // ninguém clicando: medido, forçar o gate a nunca emitir o atributo
  // deixava a suíte de regras INTEIRA verde.
  //
  // `gatilhos-ui-cobertos.test.mjs` não alcança este gatilho -- o motor
  // dele varre `id="btn-..."` e `data-*-acao`, e este não é nenhum dos
  // dois. Sem o cenário abaixo, uma edição futura que derrube o atributo ou
  // o `findIndex` do handler passa despercebida.
  //
  // LÊ O STORE, não só o DOM: é a gravação que o gatilho existe para fazer.
  const { page, erros } = await abrirFicha(context, {
    ...CLERIGO,
    magias_customizadas: [magiaCustom()],
    magias_preparadas: [{ nome: MAGIA_CLASSE, circulo: 1, classe: 'Clérigo' }],
  }, 'regras-magia-custom-preparar-desmarcar');
  await assentar(page).catch(() => {});

  await abrirGerenciarMagias(page);

  // A aba "Preparadas Atuais" já abre ativa. GUARDA CONTRA VACUIDADE: o
  // gatilho precisa existir, senão o clique abaixo não mede nada.
  const check = page.locator(`#resultado-magias [data-remover-check="${MAGIA_CLASSE}"]`);
  await expect(check,
    'a magia da classe preparada precisa aparecer na aba com o check de desmarcar')
    .toBeVisible({ timeout: 10_000 });
  await expect(page.locator(`#resultado-magias [data-remover-check="${NOME_MAGIA}"]`),
    'e a customizada não, porque ela não é entrada de magias_preparadas desde a issue #46')
    .toHaveCount(0);

  await check.click();
  await assentar(page).catch(() => {});

  await expect.poll(async () => {
    const p = await personagemSalvo(page);
    return (p?.magias_preparadas || []).some((m) => m?.nome === MAGIA_CLASSE);
  }, {
    message: 'clicar no check tem de tirar a entrada de magias_preparadas[] do personagem salvo',
  }).toBe(false);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Mago: nem pela cópia no grimório a customizada volta à grade do modal', async ({ context }) => {
  // O Mago é o caso em que a customizada tinha uma segunda porta: a cópia
  // paga para `char.grimorio` (issue #42), de onde a grade dele é montada.
  // A issue #46 fechou as duas -- a busca de cópia não a oferece mais
  // (grimorio-mago.spec.mjs) e `migrarCopiasCustomizadasDoGrimorio` limpa a
  // cópia que já existia. Este cenário semeia essa ficha antiga.
  //
  // "Mísseis Mágicos" no grimório é o GUARDA CONTRA VACUIDADE: sem ela a
  // grade do 1º círculo do Mago ficaria vazia depois da limpeza, e "a
  // customizada não está lá" não distinguiria a regra de uma tela em branco.
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [magiaCustom()],
    grimorio: [{ nome: NOME_MAGIA, circulo: 1 }, { nome: 'Mísseis Mágicos', circulo: 1 }],
  }, 'regras-magia-custom-preparar-mago');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  // A CAPACIDADE PRESERVADA: conjurável, sem preparo e sem cópia paga.
  const linha = page.locator('[data-details-id="magias-circulo-1"] .magia-personalizada',
    { hasText: NOME_MAGIA });
  await expect(linha, 'a customizada do Mago também é sempre preparada').toHaveCount(1);
  await expect(linha.locator('[data-conjurar-magia-custom]'),
    'e conjurável a partir da própria linha').toHaveCount(1);

  await abrirGerenciarMagias(page);
  await abrirAbaCirculo(page, 1);

  const cartaoDoLivro = page.locator('#resultado-magias [data-circ-check="Mísseis Mágicos"]');
  await expect(cartaoDoLivro,
    'GUARDA CONTRA O EXCESSO: a magia do LIVRO continua na grade do Mago, com check -- a grade '
    + 'dele é o grimório, e ela não pode ter sido esvaziada junto')
    .toBeVisible({ timeout: 10_000 });

  await expect(page.locator('#resultado-magias .opcao-card', { hasText: NOME_MAGIA }),
    'a customizada não pode ter cartão nem chegando pelo grimório: a cópia paga foi removida '
    + 'pela migração da #46, porque comprá-la não comprava mais nada')
    .toHaveCount(0);

  await cartaoDoLivro.click();
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect((salvo.grimorio || []).map((m) => m.nome),
    'o grimório fica só com a magia do livro -- a cópia da customizada saiu na migração')
    .toEqual(['Mísseis Mágicos']);
  expect(salvo.magias_preparadas.filter((m) => m.personalizada),
    'e o clique na magia do livro não grava marca nenhuma de personalizada')
    .toEqual([]);
  expect(salvo.magias_preparadas.some((m) => m.nome === 'Mísseis Mágicos'),
    'o preparo pelo grimório continua funcionando -- sem isto, "nada foi gravado" passaria '
    + 'por um modal quebrado')
    .toBe(true);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('NENHUM campo da magia personalizada vira HTML na ficha', async ({ context }) => {
  // Mesma disciplina (e a mesma carga) de xss-campos-livres.spec.mjs. O
  // modelo de ameaça é o daquele arquivo: fichas CIRCULAM (o README ensina a
  // exportar e passar adiante, o formulário de bug pede o arquivo exportado
  // em anexo), então ficha de terceiro é entrada não confiável.
  //
  // O DESTINO MUDOU COM A #46, a exigência não. Antes os campos livres da
  // magia do jogador chegavam ao modal "Preparar Magias" (grade, sub-modal de
  // detalhes e aba "Preparadas Atuais"); a customizada saiu de lá e passou a
  // ser desenhada na seção Preparadas da ficha, com o painel de descrição
  // dela. É esse o par de superfícies medido aqui.
  //
  // A carga vai em TODO campo, não só no nome: uma versão anterior deste
  // cenário só envenenava `nome` e por isso nascia verde por cima de
  // `escola`, que chega ao mesmo `innerHTML` duas linhas abaixo. `classes` e
  // `circulo_superior` não existem no formulário -- só uma ficha importada
  // os traz --, e é justamente por isso que estão aqui.
  const MAGIA_ENVENENADA = {
    nome: `Bencao ${CARGA}`,
    circulo: 1,
    escola: `Abjuracao ${CARGA}`,
    tempo_conjuracao: `Acao ${CARGA}`,
    alcance: `Toque ${CARGA}`,
    componentes: `V, S ${CARGA}`,
    duracao: `Instantanea ${CARGA}`,
    descricao: `Descricao ${CARGA}`,
    dano: `1d8 ${CARGA}`,
    ritual: false,
    classes: [`Clerigo ${CARGA}`],
    circulo_superior: `Superior ${CARGA}`,
  };
  const { page, erros } = await abrirFicha(context, {
    ...CLERIGO,
    magias_customizadas: [MAGIA_ENVENENADA],
  }, 'regras-magia-custom-preparar-escape');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  /** Afirma os dois indicadores de injeção de uma vez, com o lugar no recado. */
  const exigirLimpo = async (onde) => {
    const { scriptRodou, tagsInjetadas } = await medirInjecao(page);
    expect(scriptRodou, `um campo da magia personalizada executou script em ${onde}`).toBeNull();
    expect(tagsInjetadas, `a carga virou tag <img> de verdade no DOM em ${onde}`).toBe(0);
  };

  await exigirLimpo('a ficha');

  // GUARDA CONTRA VACUIDADE 1: a linha precisa existir, e existir com o
  // texto na tela -- escapar não pode virar apagar.
  const linha = page.locator('[data-details-id="magias-circulo-1"] .magia-personalizada');
  await expect(linha, 'a customizada envenenada tem de estar desenhada -- sem linha, nada a medir')
    .toHaveCount(1);
  await expect(linha,
    'o nome e as tags têm de continuar visíveis, só que como TEXTO')
    .toContainText('XSS-MARCA');

  // GUARDA CONTRA VACUIDADE 2: o gatilho da linha é o ÍNDICE em
  // `magias_customizadas`, e é ele que leva o clique ao handler certo. Um
  // índice ausente (ou `undefined`) deixaria os botões mortos e a medição
  // seguinte sem sentido.
  expect(await linha.getAttribute('data-magia-custom-index'),
    'a linha precisa carregar o índice da magia em magias_customizadas')
    .toBe('0');

  // O painel de descrição é o segundo destino: ele recebe escola, tempo,
  // alcance, componentes, duração, descrição e dano.
  const descricao = linha.locator('.magia-desc');
  await expect(descricao, 'a descrição não pode estar visível antes do clique').toBeHidden();
  await linha.locator('.magia-nome').click();
  await expect(descricao,
    'clicar na linha tem de abrir a descrição lida de char.magias_customizadas')
    .toBeVisible();
  await expect(descricao, 'e o texto envenenado aparece nela como texto').toContainText('XSS-MARCA');
  await exigirLimpo('o painel de descrição da linha personalizada');

  // E o modal continua limpo -- porque a customizada não chega mais nele.
  await abrirGerenciarMagias(page);
  await abrirAbaCirculo(page, 1);
  await expect(page.locator(`#resultado-magias [data-circ-check="${MAGIA_CLASSE}"]`),
    'GUARDA CONTRA O EXCESSO: a grade da classe continua montada')
    .toHaveCount(1);
  await expect(page.locator('#resultado-magias'),
    'nenhum campo da magia personalizada pode chegar ao modal: ela saiu da grade, da aba de '
    + 'preparadas e da lista de troca')
    .not.toContainText('XSS-MARCA');
  await exigirLimpo('o modal "Preparar Magias"');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('personalizada HOMÔNIMA de uma magia da classe: a grade mostra só a do livro, e as duas convivem na ficha', async ({ context }) => {
  // "Bênção" é magia de 1º círculo do Clérigo no acervo. Nada impede o
  // jogador de criar a SUA "Bênção" personalizada -- o formulário só exige
  // nome não vazio. Homônimas não são a mesma magia.
  //
  // Antes da #46 as duas tinham cartão na grade, e o app precisava de uma
  // maquinaria inteira para saber em qual delas o jogador tinha clicado
  // (`nomesEmDisputa`, `data-circ-personalizada`). Com a customizada fora da
  // grade, a disputa acabou: o único cartão é o da magia do LIVRO, e a magia
  // do jogador vive na ficha, sempre preparada. As duas continuam existindo
  // -- é isso que este cenário guarda.
  const { page, erros } = await abrirFicha(context, {
    ...CLERIGO,
    magias_customizadas: [magiaCustom(MAGIA_CLASSE, 1)],
  }, 'regras-magia-custom-preparar-homonima');
  await assentar(page).catch(() => {});

  await abrirGerenciarMagias(page);
  await abrirAbaCirculo(page, 1);

  const cartoes = page.locator('#resultado-magias .opcao-card', { hasText: MAGIA_CLASSE });
  await expect(cartoes,
    'na grade sobra UM cartão com esse nome: o da magia do livro. O do jogador saiu com a #46, '
    + 'e o do livro não pode ter ido junto -- perder o caminho para prepará-la seria regressão '
    + 'na população que as #27/#33 existem para atender')
    .toHaveCount(1);

  await cartoes.locator('[data-circ-check]').click();
  await assentar(page).catch(() => {});

  await expect.poll(async () => {
    const p = await personagemSalvo(page);
    return (p?.magias_preparadas || []).filter((m) => m?.nome === MAGIA_CLASSE).length;
  }, {
    message: 'preparar pelo cartão da magia do livro tem de gravar UMA entrada',
  }).toBe(1);

  const preparada = (await personagemSalvo(page)).magias_preparadas
    .find((m) => m.nome === MAGIA_CLASSE);
  expect(preparada.personalizada,
    'o cartão clicado é o do ACERVO: a entrada não pode sair marcada como personalizada só '
    + 'porque existe uma magia do jogador com o mesmo nome -- com a marca, a ficha desenharia '
    + 'a magia do jogador no lugar da que ele escolheu')
    .toBeUndefined();

  // E o cartão preparado é o do livro, aceso: a tela não pode mentir sobre
  // qual das duas está preparada.
  await expect(cartoes, 'o cartão do livro fica marcado depois do clique')
    .toHaveClass(/selecionada/);

  await fecharModalERenderizar(page);

  // A FICHA MOSTRA AS DUAS. Uma linha do livro (handler do acervo) e uma
  // linha personalizada (handler que lê char.magias_customizadas).
  const bloco1 = page.locator('[data-details-id="magias-circulo-1"]');
  await expect(bloco1.locator(`.magia-item[data-magia-nome="${MAGIA_CLASSE}"]`),
    'a magia do livro, preparada agora, sai com data-magia-nome')
    .toHaveCount(1);
  await expect(bloco1.locator('.magia-personalizada[data-magia-custom-index]'),
    'e a homônima do jogador continua desenhada ao lado dela, sempre preparada -- as duas são '
    + 'magias diferentes, e nenhuma pode apagar a outra')
    .toHaveCount(1);
  await expect(bloco1.locator('.magia-personalizada [data-conjurar-magia-custom]'),
    'a do jogador continua conjurável').toHaveCount(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('homônimas em círculos DIFERENTES: cada uma na seção do seu círculo, nenhuma some', async ({ context }) => {
  // A variante entre círculos. `magias_preparadas[]` é indexada por NOME no
  // app inteiro, e o handler de despreparo casa por nome: antes da #46, o
  // cartão da personalizada de 2º círculo resolvia para a entrada da magia
  // da classe preparada no 1º -- duas abas disputando a MESMA entrada. Sem
  // o cartão a disputa não existe, e o que fica a medir é que a fusão do
  // render não confunde os dois círculos.
  const { page, erros } = await abrirFicha(context, {
    ...CLERIGO,
    magias_customizadas: [magiaCustom(MAGIA_CLASSE, 2)],
    magias_preparadas: [{ nome: MAGIA_CLASSE, circulo: 1, classe: 'Clérigo' }],
  }, 'regras-magia-custom-preparar-homonima-circulos');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  await expect(page.locator(`[data-details-id="magias-circulo-1"] .magia-item[data-magia-nome="${MAGIA_CLASSE}"]`),
    'a magia da classe preparada no 1º círculo continua desenhada no 1º')
    .toHaveCount(1);
  await expect(page.locator('[data-details-id="magias-circulo-1"] .magia-personalizada'),
    'e nenhuma linha personalizada aparece no 1º círculo -- a do jogador é de 2º')
    .toHaveCount(0);
  await expect(page.locator('[data-details-id="magias-circulo-2"] .magia-personalizada',
    { hasText: MAGIA_CLASSE }),
  'a personalizada de 2º círculo é desenhada no círculo DELA, sempre preparada')
    .toHaveCount(1);

  await abrirGerenciarMagias(page);
  await abrirAbaCirculo(page, 2);
  await expect(page.locator('#resultado-magias .opcao-card').first(),
    'GUARDA CONTRA O EXCESSO: a aba do 2º círculo continua montando a lista da classe')
    .toBeVisible();
  await expect(page.locator('#resultado-magias .opcao-card', { hasText: MAGIA_CLASSE }),
    'e o cartão do jogador não está lá: "Bênção" não é magia de 2º círculo do Clérigo, então '
    + 'nenhum cartão com esse nome pode aparecer nesta aba')
    .toHaveCount(0);

  const depois = (await personagemSalvo(page)).magias_preparadas
    .filter((m) => m.nome === MAGIA_CLASSE);
  expect(depois.length, 'a entrada da classe continua intacta').toBe(1);
  expect(depois[0].circulo, 'e continua sendo a de 1º círculo').toBe(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha das issues #27/#33: a entrada preparada da customizada sai, e a magia aparece UMA vez', async ({ context }) => {
  // A ficha que as #27/#33 produziram: o jogador clicou em "Preparar" na
  // grade e a entrada foi gravada em `magias_preparadas` com
  // `personalizada: true`. Com a customizada agora DERIVADA de
  // `magias_customizadas`, essa entrada é uma segunda cópia da mesma magia
  // -- e é `migrarMagiasCustomizadasSemprePreparadas` (sheet/migracoes.js)
  // que a remove, a cada abertura de ficha.
  //
  // Medido pela TELA e pelo STORE: a migração tem teste de unidade próprio,
  // mas nada media o efeito dela na ficha, que é onde o jogador veria a
  // linha duplicada.
  const { page, erros } = await abrirFicha(context, {
    ...CLERIGO,
    magias_customizadas: [magiaCustom()],
    magias_preparadas: [
      { nome: NOME_MAGIA, circulo: 1, classe: 'Clérigo', personalizada: true },
      { nome: MAGIA_CLASSE, circulo: 1, classe: 'Clérigo' },
    ],
  }, 'regras-magia-custom-preparar-legado');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  const bloco1 = page.locator('[data-details-id="magias-circulo-1"]');
  await expect(bloco1.locator('.magia-item', { hasText: NOME_MAGIA }),
    'a magia do jogador tem de aparecer UMA vez -- a entrada antiga e a derivação são a mesma '
    + 'magia, e desenhar as duas põe na tela uma linha com índice inválido, sem Editar nem '
    + 'Remover')
    .toHaveCount(1);
  await expect(bloco1.locator('.magia-personalizada[data-magia-custom-index]', { hasText: NOME_MAGIA }),
    'e a que fica é a DERIVADA, com o índice que leva o clique ao handler de '
    + 'char.magias_customizadas')
    .toHaveCount(1);
  await expect(bloco1.locator(`.magia-item[data-magia-nome="${MAGIA_CLASSE}"]`),
    'GUARDA CONTRA O EXCESSO: a magia da classe preparada na mesma ficha continua desenhada -- '
    + 'a migração não pode levar entrada que não é da customizada')
    .toHaveCount(1);

  const salvo = await personagemSalvo(page);
  expect(salvo.magias_preparadas.map((m) => m.nome),
    'a entrada marcada sai de magias_preparadas; a da classe fica')
    .toEqual([MAGIA_CLASSE]);
  expect(await preparadasMarcadas(page),
    'e não sobra nenhuma marca `personalizada` no personagem salvo')
    .toEqual([]);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// Clérigo 5 / Mago 1 -- o multiclasse do recurso principal da 3.0.0. Clérigo é
// a classe INICIAL (ordem 0), como nos fixtures irmãos deste diretório.
const CLERIGO_5_MAGO_1 = [
  { classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Mago', subclasse: '', nivel: 1, ordem: 1 },
];

const MULTICLASSE = {
  classe: 'Clérigo', subclasse: '', nivel: 6, xp: 14000,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Religião', 'Intuição'],
  classes: CLERIGO_5_MAGO_1,
  schema_versao: 2,
};

test('multiclasse: a customizada não tem cartão em superfície nenhuma, e a preparada da outra classe fica intacta', async ({ context }) => {
  // O residual que só o multiclasse revela. "Mísseis Mágicos" é magia de 1º
  // círculo do MAGO e não existe na lista do Clérigo. Antes da #46, na aba
  // do Clérigo o único cartão com esse nome era o da personalizada -- ele
  // nascia aceso pela entrada do MAGO e o clique fazia `splice` nela, com o
  // toast "removida". A entrada do Mago era destruída em silêncio.
  //
  // Sem cartão nenhum, o caminho para essa destruição fechou. O que este
  // cenário guarda é que ele fechou sem levar a lista do Clérigo junto.
  const { page, erros } = await abrirFicha(context, {
    ...MULTICLASSE,
    magias_customizadas: [magiaCustom('Mísseis Mágicos', 1)],
    magias_preparadas: [{ nome: 'Mísseis Mágicos', circulo: 1, classe: 'Mago' }],
  }, 'regras-magia-custom-preparar-multiclasse');
  await assentar(page).catch(() => {});

  // A superfície ativa tem de ser a do CLÉRIGO -- é a aba onde a magia do
  // Mago não aparece, e é aí que o defeito morava.
  await expect(page.locator('#tabs-superficie-magia'),
    'o personagem precisa ter as duas superfícies de conjuração para o cenário existir')
    .toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-tab-superficie="Clérigo"].active'),
    'a aba ativa tem de ser a do Clérigo -- é a superfície em que a magia do Mago não é listada')
    .toHaveCount(1);

  await abrirGerenciarMagias(page);
  await abrirAbaCirculo(page, 1);

  await expect(page.locator(`#resultado-magias [data-circ-check="${MAGIA_CLASSE}"]`),
    'GUARDA CONTRA O EXCESSO: a lista de 1º círculo do Clérigo continua na grade, com check')
    .toHaveCount(1);
  await expect(page.locator('#resultado-magias .opcao-card', { hasText: 'Mísseis Mágicos' }),
    'e não há cartão nenhum com o nome da customizada na aba do Clérigo -- sem cartão, não há '
    + 'clique capaz de alcançar a entrada preparada no Mago')
    .toHaveCount(0);

  await page.evaluate(() => window.fecharModal?.());
  await assentar(page).catch(() => {});

  const depois = (await personagemSalvo(page)).magias_preparadas
    .filter((m) => m.nome === 'Mísseis Mágicos');
  expect(depois.length, 'a preparação do Mago sobrevive').toBe(1);
  expect(depois[0].classe, 'e continua sendo a entrada do Mago, intacta').toBe('Mago');
  expect(depois[0].personalizada,
    'sem ganhar marca nenhuma: a customizada homônima é OUTRA magia')
    .toBeUndefined();

  await abrirTudo(page);
  await expect(page.locator('[data-details-id="magias-circulo-1"] .magia-personalizada',
    { hasText: 'Mísseis Mágicos' }),
  'e a magia do jogador continua conjurável na ficha, ao lado da homônima do Mago')
    .toHaveCount(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('origem isenta: a magia CONCEDIDA homônima continua intacta, e a customizada continua conjurável', async ({ context }) => {
  // O personagem da própria issue #27 (não-Mago, com magias de Iniciado em
  // Magia). A entrada concedida não foi escolhida na lista de classe
  // nenhuma. Antes da #46, `isDominio` casava por nome, o cartão do jogador
  // saía marcado como preparado e "Especial", e o check era removido junto:
  // a magia dele ficava SEM caminho para ser preparada -- o defeito destas
  // issues, reintroduzido por outra porta.
  //
  // Com a customizada fora da grade não há cartão para herdar estado nenhum,
  // e a capacidade que estava em risco (ela ser conjurável) é incondicional.
  const { page, erros } = await abrirFicha(context, {
    ...CLERIGO,
    magias_customizadas: [magiaCustom('Escudo Arcano', 1)],
    magias_preparadas: [{ nome: 'Escudo Arcano', circulo: 1, origem: 'iniciado_em_magia' }],
  }, 'regras-magia-custom-preparar-isenta');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  const linha = page.locator('[data-details-id="magias-circulo-1"] .magia-personalizada',
    { hasText: 'Escudo Arcano' });
  await expect(linha,
    'a magia do jogador é sempre preparada, mesmo com uma concedida homônima na ficha')
    .toHaveCount(1);
  await expect(linha.locator('[data-conjurar-magia-custom]'),
    'e conjurável -- era exatamente esta capacidade que a herança de estado da concedida tirava')
    .toHaveCount(1);

  await abrirGerenciarMagias(page);
  await abrirAbaCirculo(page, 1);

  await expect(page.locator(`#resultado-magias [data-circ-check="${MAGIA_CLASSE}"]`),
    'GUARDA CONTRA O EXCESSO: a lista da classe continua com check na grade')
    .toHaveCount(1);
  await expect(page.locator('#resultado-magias .opcao-card', { hasText: 'Escudo Arcano' }),
    '"Escudo Arcano" não é magia de Clérigo: sem o cartão da customizada, nenhum cartão com '
    + 'esse nome aparece na grade')
    .toHaveCount(0);

  await page.evaluate(() => window.fecharModal?.());
  await assentar(page).catch(() => {});

  const depois = (await personagemSalvo(page)).magias_preparadas
    .filter((m) => m.nome === 'Escudo Arcano');
  expect(depois.length, 'a magia concedida não pode ser destruída').toBe(1);
  expect(depois[0].origem, 'e continua sendo a concedida, intacta').toBe('iniciado_em_magia');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
