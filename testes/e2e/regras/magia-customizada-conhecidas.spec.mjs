// ============================================================
// Issue #46 nas classes de magias CONHECIDAS: a customizada saiu das DUAS
// portas que Bardo, Bruxo, Feiticeiro e as subclasses conjuradoras têm.
//
// O QUE ESTE ARQUIVO MEDIA ANTES (issues #27/#33, a metade das classes de
// conhecidas). Três linhas de site/js/sheet/grimorio.js fechavam as duas
// portas para a magia do jogador:
//
//  1. o check da grade de círculos só saía com `!isDominio &&
//     !somenteConsulta` -- o cartão da magia personalizada nascia SEM
//     `data-circ-check`: aparecia na grade e não clicava;
//  2. o `data-remover-check` da aba "Conhecidas Atuais" também era gated
//     em `!somenteConsulta` -- nem desmarcar dava;
//  3. e `mostrarTrocaMagiaConhecida` (a troca do Descanso Longo) montava o
//     lado "entra" só da lista da classe, sem ler `magias_customizadas`.
//
// A correção de então abriu as três, com o cuidado de não abrir junto a
// LISTA DA CLASSE -- que essas classes escolhem na subida de nível e trocam
// no Descanso Longo.
//
// O QUE A #46 MUDOU. A customizada de círculo passou a ser SEMPRE preparada
// e derivada de `char.magias_customizadas`: ela não precisa de porta
// nenhuma, porque já está do lado de dentro. As três aberturas foram
// desfeitas -- o destravamento do check, a entrada na aba e a fusão na
// troca --, e o modal voltou a ser de CONSULTA para essas classes.
//
// A TROCA DO DESCANSO LONGO é o ponto mais delicado, e o motivo está na
// regra: o Bardo tem UMA troca por Descanso Longo. Oferecer a customizada
// ali faria ele gastá-la para trazer o que já tem, perdendo uma magia de
// classe em troca de nada. É a mesma regra que a lista de truques
// (`truquesTrocaveis`) sempre seguiu, lendo só `magias_conhecidas`.
//
// A AFIRMAÇÃO PRESERVADA em cada cenário não é "o clique funciona" -- é "a
// magia é CONJURÁVEL", que passou a valer sem clique. E cada um traz o
// GUARDA CONTRA O EXCESSO: a lista da classe continua sendo oferecida (e
// clicável onde a regra do Bardo permite clicar). Sem esse guarda, "a
// customizada não aparece" passaria por uma lista vazia.
//
// DECISÃO DE PRODUTO QUE MUDOU: magia personalizada não conta mais no
// limite (issue #46, Tarefa 1). O acesso deixou de ser um problema porque
// deixou de haver acesso a conquistar.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha, personagemSalvo } from './helpers-regras.mjs';

// Bardo é a semente de propósito: classe de magias CONHECIDAS, sem
// grimório e sem domínio -- o alcance exato desta lacuna. Nível 3 dá
// espaços de 1º e 2º círculo (dados/classes/bardo.json) e limite de 6
// magias conhecidas, folga suficiente para os cenários de lista e pouco o
// bastante para o cenário "no limite" caber em seis linhas.
const BARDO = {
  classe: 'Bardo', subclasse: '', nivel: 3, xp: 900,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atuação', 'Persuasão'],
};

const NOME_MAGIA = 'Balada de Nimb';
// Segunda personalizada, de 2º círculo: contraste que impede as afirmações
// sobre a linha do 1º círculo de passarem por vacuidade.
const NOME_MAGIA_2 = 'Selo de Nimb';
// Magias DE CLASSE (dados/classes/magias_bardo.json, 1º Círculo) -- o outro
// lado do guarda: elas continuam listadas, e continuam travadas na grade.
const MAGIA_CLASSE = 'Comando';
const MAGIA_CLASSE_2 = 'Curar Ferimentos';

/** A magia personalizada do relato, no formato gravado pelo formulário. */
function magiaCustom(nome = NOME_MAGIA, circulo = 1) {
  return {
    nome, circulo, escola: 'Encantamento', tempo_conjuracao: 'Ação',
    alcance: '9 metros', componentes: 'V', duracao: 'Instantânea',
    descricao: 'Uma estrofe curta que ergue o ânimo de quem ouve.',
    dano: '', ritual: false,
  };
}

/** Entrada de magia conhecida da lista do Bardo, já carimbada com a classe. */
function conhecidaDeClasse(nome, circulo = 1) {
  return { nome, circulo, classe: 'Bardo' };
}

/** Abre todos os `<details>` da ficha -- o Playwright não clica no que está escondido. */
async function abrirTudo(page) {
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  await assentar(page).catch(() => {});
}

/**
 * Abre o modal "Preparar Magias" e espera a grade existir -- `mostrarBuscaMagia` é
 * async (carrega a lista da classe antes de montar o HTML), então esperar
 * o elemento cobre essa corrida em vez de um timeout fixo. Mesma forma do
 * spec irmão.
 */
async function abrirGerenciarMagias(page) {
  await clicarBotaoFicha(page, 'btn-add-magia', { esperar: '#resultado-magias' });
  await assentar(page).catch(() => {});
}

/** Troca para a aba do círculo pedido dentro do modal "Preparar Magias". */
async function abrirAbaCirculo(page, circulo) {
  const aba = page.locator(`#tabs-gerenciar-magias [data-tab-mg="${circulo}"]`);
  await expect(aba, `o Bardo 3 tem espaços de ${circulo}º círculo -- a aba precisa existir`)
    .toHaveCount(1);
  await aba.click();
  await assentar(page).catch(() => {});
}

/**
 * Percorre o caminho REAL da UI até a lista do que ENTRA numa troca do
 * Descanso Longo: "Descanso Longo" (`#btn-descanso-longo`) -> o card
 * "Trocar Magias" do resumo (`#btn-trocar-magias-dl`) -> o modal de troca
 * (`#btn-confirmar-troca-conhecida`) -> escolher a magia que SAI.
 *
 * O último passo faz parte do caminho, não é conveniência do teste:
 * `mostrarTrocaMagiaConhecida` mantém `#troca-conhecida-adicionar-container`
 * escondido até haver uma magia escolhida para sair, e é só então que
 * `renderListaSubstituta` desenha os cartões `[data-selecionar-troca]`.
 * Sem escolher, a lista de candidatas não existe e qualquer afirmação
 * sobre ela seria sobre um container vazio.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} nomeQueSai Magia conhecida a colocar no lugar "sai".
 */
async function abrirTrocaDoDescansoLongo(page, nomeQueSai = MAGIA_CLASSE) {
  await clicarBotaoFicha(page, 'btn-descanso-longo', { esperar: '#modal-overlay' });
  await assentar(page).catch(() => {});
  await page.locator('#btn-trocar-magias-dl').click();
  await expect(page.locator('#btn-confirmar-troca-conhecida'),
    'o Bardo tem direito à troca de 1 magia no Descanso Longo -- o modal precisa abrir')
    .toBeVisible({ timeout: 10_000 });
  await page.locator(`#troca-conhecida-remover-lista .opcao-card[data-opcao="${nomeQueSai}"]`)
    .click();
  await assentar(page).catch(() => {});
}

/** As entradas salvas com este nome, na ordem em que estão no array. */
async function preparadasComNome(page, nome) {
  const p = await personagemSalvo(page);
  return (p?.magias_preparadas || []).filter((m) => m?.nome === nome);
}

// ============================================================
// 1. SUPERFÍCIE 1 -- o modal "Preparar Magias" não tem mais a customizada.
// ============================================================
test('Bardo: a customizada não tem cartão na grade nem entrada na aba "Conhecidas Atuais", e é conjurável assim mesmo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...BARDO,
    magias_customizadas: [magiaCustom(), magiaCustom(NOME_MAGIA_2, 2)],
    magias_preparadas: [conhecidaDeClasse(MAGIA_CLASSE)],
  }, 'regras-magia-custom-conhecidas-bardo');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  // A CAPACIDADE PRESERVADA: sem marcar nada, a magia do Bardo já está na
  // seção do círculo dela, com Conjurar. Era isto que as issues #27/#33
  // pediam, e o que a #46 tornou incondicional.
  const linha = page.locator('[data-details-id="magias-circulo-1"] .magia-personalizada',
    { hasText: NOME_MAGIA });
  await expect(linha,
    'a customizada de 1º círculo aparece UMA vez na seção do círculo dela, sem clique nenhum')
    .toHaveCount(1);
  await expect(linha.locator('[data-conjurar-magia-custom]'),
    'com o botão de Conjurar -- a capacidade que as issues #27/#33 relatam como ausente')
    .toHaveCount(1);
  await expect(page.locator('[data-details-id="magias-circulo-2"] .magia-personalizada',
    { hasText: NOME_MAGIA_2 }),
  'a segunda personalizada, de 2º círculo, também -- sem esse contraste "aparece uma vez" '
  + 'valeria numa ficha que só sabe desenhar uma linha')
    .toHaveCount(1);

  await abrirGerenciarMagias(page);

  // Aba "Conhecidas Atuais". GUARDA CONTRA O EXCESSO primeiro: a magia da
  // classe continua listada.
  await expect(page.locator('#resultado-magias .opcao-card', { hasText: MAGIA_CLASSE }),
    `"${MAGIA_CLASSE}" veio da lista do Bardo e continua VISÍVEL na aba de conhecidas`)
    .toHaveCount(1);
  await expect(page.locator('#resultado-magias .opcao-card', { hasText: NOME_MAGIA }),
    'a customizada não é entrada de magias_preparadas: ela não aparece nesta aba, nem com '
    + 'check nem sem')
    .toHaveCount(0);

  await abrirAbaCirculo(page, 1);

  await expect(page.locator('#resultado-magias .opcao-card', { hasText: MAGIA_CLASSE_2 }),
    `GUARDA CONTRA O EXCESSO: "${MAGIA_CLASSE_2}" é magia da lista do Bardo e continua na `
    + 'grade -- o modal do Bardo é de consulta, não de nada')
    .toHaveCount(1);
  await expect(page.locator(`#resultado-magias [data-circ-check="${NOME_MAGIA}"]`),
    'a customizada não tem check na grade porque não tem cartão: ela não é escolha')
    .toHaveCount(0);
  await expect(page.locator('#resultado-magias .opcao-card', { hasText: NOME_MAGIA }),
    'e nem cartão sem check -- a grade voltou a ser só a lista da classe')
    .toHaveCount(0);

  // Nada do que se faz neste modal grava marca de personalizada.
  await page.evaluate(() => window.fecharModal?.());
  await assentar(page).catch(() => {});
  const salvo = await personagemSalvo(page);
  expect(salvo.magias_preparadas.map((m) => m.nome),
    'abrir e fechar o modal não pode gravar entrada nenhuma para a customizada')
    .toEqual([MAGIA_CLASSE]);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 2. O GUARDA -- a lista da CLASSE continua travada, e continua visível.
// ============================================================
// Se este cenário ficar vermelho, o corte foi largo demais: ou o Bardo
// ganhou de brinde a escolha da lista da classe (que é da subida de nível e
// da troca do Descanso Longo), ou a lista sumiu da tela junto com a
// customizada. As duas afirmações vivem no MESMO modal de propósito.
test('Bardo: tirar a customizada não mexeu na lista da classe -- visível e travada', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...BARDO,
    magias_customizadas: [magiaCustom()],
    magias_preparadas: [conhecidaDeClasse(MAGIA_CLASSE)],
  }, 'regras-magia-custom-conhecidas-guarda');
  await assentar(page).catch(() => {});

  await abrirGerenciarMagias(page);

  await expect(page.locator(`#resultado-magias [data-remover-check="${MAGIA_CLASSE}"]`),
    `"${MAGIA_CLASSE}" veio da lista do Bardo: desmarcá-la aqui abriria vaga fora da subida de `
    + 'nível e da troca do Descanso Longo -- ela continua sem check')
    .toHaveCount(0);
  await expect(page.locator('#resultado-magias .opcao-card', { hasText: MAGIA_CLASSE }),
    'e continua VISÍVEL na lista -- travar o check não pode virar esconder a magia')
    .toHaveCount(1);

  await abrirAbaCirculo(page, 1);
  await expect(page.locator(`#resultado-magias [data-circ-check="${MAGIA_CLASSE_2}"]`),
    `"${MAGIA_CLASSE_2}" é magia da lista do Bardo: marcá-la aqui seria escolher magia `
    + 'conhecida fora da subida de nível -- ela continua sem check')
    .toHaveCount(0);
  await expect(page.locator('#resultado-magias .opcao-card', { hasText: MAGIA_CLASSE_2 }),
    'e continua VISÍVEL na grade')
    .toHaveCount(1);
  await expect(page.locator('#resultado-magias [data-detalhe-magia]').first(),
    'a lista da classe continua CLICÁVEL no que a regra do Bardo permite: o nome abre os '
    + 'detalhes da magia. Sem isto, "está visível" poderia ser uma grade morta')
    .toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 3. FICHA ANTIGA COM HOMÔNIMAS -- a magia da CLASSE sobrevive.
// ============================================================
// A ficha que as issues #27/#33 produziam: a personalizada marcada em
// `magias_preparadas` junto da homônima da classe. `magias_preparadas[]` é
// indexada por NOME no app inteiro, e o handler de desmarcar achava a
// entrada por `findIndex(m => m.nome === nome)` -- o clique no check da
// personalizada apagava a que estivesse PRIMEIRO no array, a da classe.
//
// Com a #46 esse estado é desfeito na abertura da ficha
// (`migrarMagiasCustomizadasSemprePreparadas`, sheet/migracoes.js): sai a
// entrada MARCADA, e só ela. A ordem da semente é deliberada -- a da classe
// vem primeiro, que era a posição em que ela morria.
test('Bardo: na ficha antiga com homônimas, sai a entrada da personalizada e a da CLASSE fica', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...BARDO,
    magias_customizadas: [magiaCustom(MAGIA_CLASSE_2)],
    magias_preparadas: [
      conhecidaDeClasse(MAGIA_CLASSE_2),
      { ...conhecidaDeClasse(MAGIA_CLASSE_2), personalizada: true },
    ],
  }, 'regras-magia-custom-conhecidas-homonimas');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  const sobreviventes = await preparadasComNome(page, MAGIA_CLASSE_2);
  expect(sobreviventes.length,
    'das duas entradas homônimas sobra UMA -- a marcada virou derivação de '
    + 'magias_customizadas e não pode continuar gravada também')
    .toBe(1);
  expect(Boolean(sobreviventes[0].personalizada),
    'e quem sobra é a magia da LISTA DA CLASSE: apagá-la devolveria ao Bardo uma vaga da '
    + 'lista da classe em silêncio')
    .toBe(false);

  // E as DUAS continuam na tela: a da classe pelo caminho do acervo, a do
  // jogador pela derivação.
  const bloco1 = page.locator('[data-details-id="magias-circulo-1"]');
  await expect(bloco1.locator(`.magia-item[data-magia-nome="${MAGIA_CLASSE_2}"]`),
    'a magia da classe continua desenhada, com o handler do acervo')
    .toHaveCount(1);
  await expect(bloco1.locator('.magia-personalizada[data-magia-custom-index]',
    { hasText: MAGIA_CLASSE_2 }),
  'e a homônima do jogador ao lado dela, conjurável -- homônimas são magias diferentes')
    .toHaveCount(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 4. SUPERFÍCIE 2 -- a troca do Descanso Longo não oferece a customizada.
// ============================================================
test('issue #46: a customizada não entra na troca do Descanso Longo, e a de classe entra', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...BARDO,
    magias_preparadas: [conhecidaDeClasse(MAGIA_CLASSE), conhecidaDeClasse(MAGIA_CLASSE_2)],
    magias_customizadas: [magiaCustom()],
  }, 'regras-issue46-troca-descanso');
  await assentar(page).catch(() => {});

  await expect(page.locator('#btn-add-magia'),
    'GUARDA CONTRA VACUIDADE: sem a seção de Magias não há Descanso Longo a exercitar')
    .toBeVisible();

  await abrirTrocaDoDescansoLongo(page);

  await expect(page.locator(`[data-selecionar-troca="${NOME_MAGIA}"]`),
    'a customizada é SEMPRE preparada -- oferecê-la na troca faria o Bardo gastar a '
    + 'única troca do descanso para trazer o que ele já tem')
    .toHaveCount(0);

  await expect(page.locator('[data-selecionar-troca]'),
    'GUARDA CONTRA O EXCESSO: a lista da classe continua sendo oferecida')
    .not.toHaveCount(0);

  // E ela é CLICÁVEL: a troca continua fechando com magia da classe. Sem
  // este clique, "a lista está lá" não distinguiria uma lista viva de uma
  // lista morta -- e é o gravador da troca que deixou de carimbar a marca.
  const candidata = page.locator('[data-selecionar-troca]').first();
  const nomeQueEntra = await candidata.getAttribute('data-selecionar-troca');
  await candidata.click();
  await assentar(page).catch(() => {});
  await page.locator('#btn-confirmar-troca-conhecida').click();
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo.magias_preparadas.some((m) => m.nome === nomeQueEntra),
    'a magia escolhida tem de ter entrado -- a troca da lista da classe não foi tocada')
    .toBe(true);
  expect(salvo.magias_preparadas.some((m) => m.nome === MAGIA_CLASSE),
    'e a escolhida para sair saiu: troca é troca, não acréscimo')
    .toBe(false);
  expect(salvo.magias_preparadas.filter((m) => m.personalizada),
    'nenhuma entrada gravada pela troca pode carregar a marca `personalizada` -- nenhuma '
    + 'candidata é a magia do jogador')
    .toEqual([]);

  expect(erros, 'nenhum erro de console').toEqual([]);
});

// O caminho de quem está NO LIMITE, que era a razão de ser da fusão
// removida: com a lista cheia, o cartão da grade saía `bloqueada` e o
// clique era recusado, e a troca do Descanso Longo era a única vaga que o
// jogador tinha para dar à magia que inventou. A #46 desfez o problema pela
// raiz -- ela nunca precisou de vaga.
const CONHECIDAS_NO_LIMITE = [
  'Comando', 'Curar Ferimentos', 'Detectar Magia', 'Heroísmo', 'Identificar', 'Palavra Curativa',
].map((nome) => conhecidaDeClasse(nome));

test('Bardo NO LIMITE: a customizada é conjurável sem gastar a troca do Descanso Longo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...BARDO,
    magias_customizadas: [magiaCustom()],
    // Bardo 3 conhece 6 magias (dados/classes/bardo.json) -- estas seis
    // fecham o limite.
    magias_preparadas: [...CONHECIDAS_NO_LIMITE],
  }, 'regras-magia-custom-conhecidas-limite');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  // GUARDA CONTRA VACUIDADE: o personagem precisa estar mesmo no limite,
  // senão o cenário não mede o caso difícil.
  const contador = page.locator('.magia-contador')
    .filter({ hasText: 'Magias Conhecidas' }).first();
  await expect(contador, 'o contador de conhecidas precisa existir para provar o limite')
    .toHaveCount(1);
  expect((await contador.locator('.contador-valor').innerText()).trim(),
    'as seis magias da lista do Bardo fecham o limite -- e a customizada não entra na conta')
    .toBe('6 / 6');

  const linha = page.locator('[data-details-id="magias-circulo-1"] .magia-personalizada',
    { hasText: NOME_MAGIA });
  await expect(linha,
    'mesmo com a lista cheia, a customizada está desenhada e é conjurável: ela não disputa '
    + 'vaga com a lista da classe')
    .toHaveCount(1);
  await expect(linha.locator('[data-conjurar-magia-custom]'),
    'sem precisar da troca do Descanso Longo, que era o único caminho que ela tinha')
    .toHaveCount(1);

  await abrirGerenciarMagias(page);
  await abrirAbaCirculo(page, 1);
  await expect(page.locator('#resultado-magias .opcao-card', { hasText: NOME_MAGIA }),
    'e na grade ela não aparece nem bloqueada: não há cartão para bloquear')
    .toHaveCount(0);
  await expect(page.locator('#resultado-magias .opcao-card', { hasText: MAGIA_CLASSE_2 }),
    'GUARDA CONTRA O EXCESSO: a lista da classe continua na grade')
    .toHaveCount(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 5. MULTICLASSE -- nenhum dos dois passos oferece a customizada.
// ============================================================
// Semear só classe única já deixou lacuna aberta nesta mesma rodada de
// correções, por isso o par vem aqui. Bardo 5/Mago 1 separa os dois ramos
// de `mostrarTrocaMagiaConhecida` (`ehMago = !!sup?.usaGrimorio`): o
// Descanso Longo abre um passo por classe, e os dois caem em ramos
// diferentes da MESMA função. Antes da #46 a customizada entrava no passo do
// Bardo e não no do Mago (que a recebia só pelo grimório, e só se paga);
// agora não entra em nenhum.
const BARDO_5_MAGO_1 = [
  { classe: 'Bardo', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Mago', subclasse: '', nivel: 1, ordem: 1 },
];

test('Bardo 5/Mago 1: a customizada não entra na troca de NENHUMA das duas classes', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Bardo', nivel: 6, xp: 14000,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Atuação', 'Persuasão'],
    classes: BARDO_5_MAGO_1,
    schema_versao: 2,
    magias_customizadas: [magiaCustom()],
    magias_preparadas: [
      { nome: 'Heroísmo', circulo: 1, classe: 'Bardo' },
      { nome: 'Mísseis Mágicos', circulo: 1, classe: 'Mago' },
    ],
    // Duas magias no grimório de propósito: com uma só, tirar "Mísseis
    // Mágicos" esvaziaria a lista do passo do Mago e "a customizada não
    // está aqui" passaria por vacuidade, sobre uma lista vazia.
    grimorio: [{ nome: 'Mísseis Mágicos', circulo: 1 }, { nome: 'Detectar Magia', circulo: 1 }],
  }, 'regras-magia-custom-conhecidas-multiclasse');
  await assentar(page).catch(() => {});

  await clicarBotaoFicha(page, 'btn-descanso-longo', { esperar: '#modal-overlay' });
  await assentar(page).catch(() => {});
  await page.locator('#btn-trocar-magias-dl').click();

  // PASSO 1 -- Bardo (classe inicial, ordem 0).
  await expect(page.locator('#modal-titulo'), 'o passo 1 tem de ser do Bardo')
    .toHaveText('Trocar Magia Conhecida — Bardo', { timeout: 10_000 });
  await page.locator('#troca-conhecida-remover-lista .opcao-card[data-opcao="Heroísmo"]').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#resultado-troca-conhecida [data-selecionar-troca]'),
    'GUARDA CONTRA VACUIDADE: a lista do Bardo continua sendo oferecida no passo dele')
    .not.toHaveCount(0);
  await expect(page.locator(`#resultado-troca-conhecida [data-selecionar-troca="${NOME_MAGIA}"]`),
    'no passo do Bardo a customizada não pode ser candidata: ela já está preparada, e gastar '
    + 'a troca nela custaria uma magia de classe por nada')
    .toHaveCount(0);

  await page.locator('#btn-pular-troca-conhecida').click();
  await assentar(page).catch(() => {});

  // PASSO 2 -- Mago.
  await expect(page.locator('#modal-titulo'), 'o passo 2 tem de ser do Mago')
    .toHaveText('Trocar Magia Conhecida — Mago', { timeout: 10_000 });
  await page.locator('#troca-conhecida-remover-lista .opcao-card[data-opcao="Mísseis Mágicos"]')
    .click();
  await assentar(page).catch(() => {});

  await expect(page.locator('#resultado-troca-conhecida [data-selecionar-troca="Detectar Magia"]'),
    'GUARDA CONTRA VACUIDADE: a outra magia do grimório continua candidata no passo do Mago')
    .toHaveCount(1);
  await expect(page.locator(`#resultado-troca-conhecida [data-selecionar-troca="${NOME_MAGIA}"]`),
    'e no passo do Mago também não: a lista dele é o grimório, e a customizada não mora lá')
    .toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 6. A DESCRIÇÃO NA TROCA DO DESCANSO LONGO.
// ============================================================
// Esta tela é onde o jogador decide em que gastar a ÚNICA troca que o
// Descanso Longo lhe dá, e o nome de cada cartão é um gatilho
// (`data-troca-detalhe`) que abre a descrição. A #46 tirou a customizada da
// lista; o painel continua tendo de funcionar para a magia da CLASSE.
//
// É o guarda contra o excesso deste lado do modal: remover a fusão mexeu no
// mesmo `renderListaSubstituta` que desenha esses cartões e liga esse
// handler. Se o corte tivesse pegado o painel junto, a tela mais decisiva do
// Descanso Longo passaria a abrir com nada -- exatamente a forma da issue
// #39, só que na magia do livro.
test('troca do Descanso Longo: clicar no nome da magia da classe continua abrindo a descrição', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...BARDO,
    magias_customizadas: [magiaCustom()],
    magias_preparadas: [conhecidaDeClasse(MAGIA_CLASSE), conhecidaDeClasse(MAGIA_CLASSE_2)],
  }, 'regras-magia-custom-conhecidas-detalhe-troca');
  await assentar(page).catch(() => {});

  await abrirTrocaDoDescansoLongo(page);

  await expect(page.locator(`#resultado-troca-conhecida [data-troca-detalhe="${NOME_MAGIA}"]`),
    'a customizada não é candidata, então não tem nome a clicar aqui')
    .toHaveCount(0);

  const nome = page.locator('#resultado-troca-conhecida [data-troca-detalhe]').first();
  await expect(nome,
    'GUARDA CONTRA VACUIDADE: precisa haver cartão de magia da classe com nome clicável')
    .toBeVisible();
  await nome.click();
  await assentar(page).catch(() => {});

  await expect(page.locator('.sub-modal-overlay'),
    'clicar no nome tem de abrir o sub-modal de detalhes da magia da classe -- é aqui que o '
    + 'jogador decide em que gastar a única troca do Descanso Longo')
    .toBeVisible();
  // `.first()`: o painel tem dois `.md-content` quando a magia tem o bloco
  // "Em círculos superiores" -- o primeiro é sempre a descrição.
  await expect(page.locator('.sub-modal-overlay .md-content').first(),
    'e o painel precisa vir com a descrição, não vazio')
    .not.toBeEmpty();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
