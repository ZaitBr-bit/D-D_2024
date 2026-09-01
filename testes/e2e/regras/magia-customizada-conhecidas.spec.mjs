// ============================================================
// Issues #27 e #33, a metade que ficou de fora: as classes de magias
// CONHECIDAS.
//
// A primeira correção (commit 44d34ab) fez o modal "+ Magia" fundir
// `char.magias_customizadas` de círculo 1+ na grade por círculo. Isso
// resolveu para as classes de magias PREPARADAS (Clérigo, Druida,
// Guardião, Mago, Paladino), medidas pelo irmão deste arquivo,
// `magia-customizada-preparar.spec.mjs`.
//
// Para Bardo, Bruxo, Feiticeiro e as subclasses conjuradoras a magia
// continuou sem caminho NENHUM. Duas linhas fechavam as duas únicas
// portas dessas classes (site/js/sheet/grimorio.js):
//
//  1. o check da grade de círculos só saía com `!isDominio &&
//     !somenteConsulta` -- o cartão da magia personalizada nascia SEM
//     `data-circ-check`: aparecia na grade e não clicava;
//  2. o `data-remover-check` da aba "Conhecidas Atuais" também era gated
//     em `!somenteConsulta` -- nem desmarcar dava;
//  3. e `mostrarTrocaMagiaConhecida` (a troca do Descanso Longo, a outra
//     rota dessas classes) montava o lado "entra" só da lista da classe,
//     sem nunca ler `magias_customizadas`.
//
// O travamento existe para proteger a LISTA DA CLASSE -- que essas classes
// escolhem na subida de nível e trocam no Descanso Longo. Magia
// personalizada não é da lista da classe: é do jogador. Por isso o
// destravamento é só dela, e o cenário "a magia da classe continua
// travada", abaixo, é o guarda que prova que ele não foi largo demais.
//
// DECISÃO DE PRODUTO INALTERADA: magia personalizada CONTA no limite,
// para toda classe. O que muda aqui é só o ACESSO.
//
// Os testes CLICAM (memória do projeto: gatilho de tela só está entregue
// com um spec que clica nele) e leem o personagem SALVO -- é a gravação em
// `magias_preparadas` que nunca acontecia, e só a leitura do store mede
// isso.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha, personagemSalvo } from './helpers-regras.mjs';

// Bardo é a semente de propósito: classe de magias CONHECIDAS, sem
// grimório e sem domínio -- o alcance exato desta lacuna. Nível 3 dá
// espaços de 1º e 2º círculo (dados/classes/bardo.json) e limite de 6
// magias conhecidas, folga suficiente para o cenário de marcar/desmarcar
// e pouco o bastante para o cenário "no limite" caber em seis linhas.
const BARDO = {
  classe: 'Bardo', subclasse: '', nivel: 3, xp: 900,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atuação', 'Persuasão'],
};

const NOME_MAGIA = 'Balada de Nimb';
// Segunda personalizada, que fica SEM preparar do começo ao fim: é o
// contraste que impede "a seção Magias Customizadas não contém mais a
// magia" de passar por vacuidade (com uma só, preparar esvazia a seção
// inteira e a afirmação valeria também para uma regressão que a apagasse).
const NOME_MAGIA_2 = 'Selo de Nimb';
// Magia DE CLASSE (dados/classes/magias_bardo.json, 1º Círculo) -- o outro
// lado do guarda: ela não pode ganhar check nenhum.
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
 * Abre o modal "+ Magia" e espera a grade existir -- `mostrarBuscaMagia` é
 * async (carrega a lista da classe antes de montar o HTML), então esperar
 * o elemento cobre essa corrida em vez de um timeout fixo. Mesma forma do
 * spec irmão.
 */
async function abrirGerenciarMagias(page) {
  await clicarBotaoFicha(page, 'btn-add-magia', { esperar: '#resultado-magias' });
  await assentar(page).catch(() => {});
}

/** Troca para a aba do círculo pedido dentro do modal "+ Magia". */
async function abrirAbaCirculo(page, circulo) {
  const aba = page.locator(`#tabs-gerenciar-magias [data-tab-mg="${circulo}"]`);
  await expect(aba, `o Bardo 3 tem espaços de ${circulo}º círculo -- a aba precisa existir`)
    .toHaveCount(1);
  await aba.click();
  await assentar(page).catch(() => {});
}

/** Fecha o modal e deixa a ficha re-renderizada, para medir a seção Conhecidas. */
async function fecharModalERenderizar(page) {
  await page.evaluate(() => window.fecharModal?.());
  await assentar(page).catch(() => {});
  await abrirTudo(page);
}

/** As entradas salvas com este nome, na ordem em que estão no array. */
async function preparadasComNome(page, nome) {
  const p = await personagemSalvo(page);
  return (p?.magias_preparadas || []).filter((m) => m?.nome === nome);
}

// ============================================================
// 1. SUPERFÍCIE 1 -- o modal "+ Magia" marca E desmarca a personalizada.
// ============================================================
test('Bardo: a magia personalizada de círculo pode ser marcada e desmarcada no modal "+ Magia"', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...BARDO,
    magias_customizadas: [magiaCustom(), magiaCustom(NOME_MAGIA_2, 2)],
    magias_preparadas: [conhecidaDeClasse(MAGIA_CLASSE)],
  }, 'regras-magia-custom-conhecidas-bardo');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  // GUARDA CONTRA VACUIDADE: hoje a magia vive na seção separada "Magias
  // Customizadas", marcada "Não preparada". Sem essa linha na tela não
  // haveria defeito nenhum a medir.
  const secaoCustom = page.locator('[data-details-id="magias-customizadas-circulo"]');
  await expect(secaoCustom,
    'a magia personalizada de círculo 1 precisa começar na seção "Magias Customizadas" -- '
    + 'é de lá que ela tem de sair ao ser conhecida')
    .toContainText(NOME_MAGIA);
  await expect(secaoCustom,
    'antes de marcar, a linha é a do relato: "Não preparada", sem Conjurar')
    .toContainText('Não preparada');

  await abrirGerenciarMagias(page);
  await abrirAbaCirculo(page, 1);

  // A AÇÃO CENTRAL: para uma classe de magias CONHECIDAS o cartão da magia
  // personalizada existia (a fusão da primeira correção já o desenhava),
  // mas nascia SEM check -- aparecia e não clicava.
  const check = page.locator(`#resultado-magias [data-circ-check="${NOME_MAGIA}"]`);
  await expect(check,
    'o cartão da magia personalizada precisa ter o check clicável também para o Bardo -- '
    + 'sem ele a magia aparece na grade e não há clique nenhum capaz de torná-la conhecida '
    + '(issues #27/#33, metade das classes de magias CONHECIDAS)')
    .toBeVisible({ timeout: 10_000 });

  await check.click();
  await assentar(page).catch(() => {});

  await expect.poll(async () => (await preparadasComNome(page, NOME_MAGIA)).length, {
    message: 'marcar a magia personalizada na grade tem de gravá-la em magias_preparadas[]',
  }).toBe(1);

  const [gravada] = await preparadasComNome(page, NOME_MAGIA);
  expect(gravada.circulo, 'a entrada gravada tem de manter o círculo da magia').toBe(1);
  expect(gravada.personalizada,
    'a entrada precisa carregar `personalizada: true` -- é a marca que a seção de magias da '
    + 'ficha usa para achar a magia em magias_customizadas[] e renderizar a linha personalizada '
    + '(descrição, tags e o botão de Conjurar próprio dela)')
    .toBe(true);
  expect(gravada.classe,
    'marcada pela superfície do Bardo, a entrada sai carimbada com essa classe -- é assim que '
    + 'ela conta no limite de magias conhecidas da classe (magia personalizada é escolha do '
    + 'jogador, não concessão: não é origem isenta)')
    .toBe('Bardo');

  await fecharModalERenderizar(page);

  // O outro lado do conserto: conhecida, a magia passa a viver na seção do
  // círculo dela, com Conjurar -- e SAI da seção "Magias Customizadas".
  const linhaConhecida = page.locator('[data-details-id="magias-circulo-1"] .magia-personalizada',
    { hasText: NOME_MAGIA });
  await expect(linhaConhecida,
    'depois de marcada, a magia personalizada tem de aparecer na seção do 1º círculo da ficha')
    .toHaveCount(1);
  await expect(linhaConhecida.locator('[data-conjurar-magia-custom]'),
    'a linha precisa ter o botão de Conjurar -- é a capacidade que as issues #27/#33 relatam '
    + 'como ausente')
    .toHaveCount(1);

  const secaoDepois = page.locator('[data-details-id="magias-customizadas-circulo"]');
  await expect(secaoDepois,
    'a segunda personalizada continua sem preparo -- a seção tem de sobreviver, senão a '
    + 'afirmação seguinte não distingue "a magia saiu" de "a seção inteira sumiu"')
    .toContainText(NOME_MAGIA_2);
  await expect(secaoDepois,
    'marcada, a magia não pode continuar listada como "Magias Customizadas" não preparada')
    .not.toContainText(NOME_MAGIA);

  // DESMARCAR: a segunda metade da superfície 1. Sem ela o jogador do Bardo
  // grava a magia e não tem como voltar atrás -- e a vaga dela no limite
  // fica presa para sempre.
  await abrirGerenciarMagias(page);
  const remover = page.locator(`#resultado-magias [data-remover-check="${NOME_MAGIA}"]`);
  await expect(remover,
    'na aba "Conhecidas Atuais" a magia personalizada precisa ter o check de desmarcar -- '
    + 'para o Bardo ele também nascia travado')
    .toBeVisible({ timeout: 10_000 });

  await remover.click();
  await assentar(page).catch(() => {});

  await expect.poll(async () => (await preparadasComNome(page, NOME_MAGIA)).length, {
    message: 'desmarcar tem de tirar a entrada de magias_preparadas[]',
  }).toBe(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 2. O GUARDA -- a magia da LISTA DA CLASSE continua travada.
// ============================================================
// Se este cenário ficar vermelho depois do conserto, o destravamento foi
// largo demais: o Bardo teria ganhado de brinde a escolha da lista da
// classe, que é da subida de nível e da troca do Descanso Longo. As duas
// afirmações vivem juntas no MESMO modal de propósito -- é o contraste
// lado a lado (a personalizada clica, a da classe não) que prova que o
// critério é a origem da magia, e não "o modal virou editável".
test('Bardo: destravar a personalizada NÃO destrava a magia da lista da classe', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...BARDO,
    magias_customizadas: [magiaCustom()],
    magias_preparadas: [
      conhecidaDeClasse(MAGIA_CLASSE),
      { ...conhecidaDeClasse(NOME_MAGIA), personalizada: true },
    ],
  }, 'regras-magia-custom-conhecidas-guarda');
  await assentar(page).catch(() => {});

  await abrirGerenciarMagias(page);

  // Aba "Conhecidas Atuais": as duas entradas estão na tela, e só uma tem
  // check.
  await expect(page.locator(`#resultado-magias [data-remover-check="${NOME_MAGIA}"]`),
    'a personalizada conhecida precisa poder ser desmarcada')
    .toHaveCount(1);
  await expect(page.locator(`#resultado-magias [data-remover-check="${MAGIA_CLASSE}"]`),
    `"${MAGIA_CLASSE}" veio da lista do Bardo: desmarcá-la aqui abriria vaga fora da subida de `
    + 'nível e da troca do Descanso Longo -- ela continua sem check')
    .toHaveCount(0);
  await expect(page.locator('#resultado-magias .opcao-card', { hasText: MAGIA_CLASSE }),
    'e ela continua VISÍVEL na lista -- travar o check não pode virar esconder a magia')
    .toHaveCount(1);

  // Grade do 1º círculo: mesmo contraste, do outro lado do modal.
  await abrirAbaCirculo(page, 1);
  await expect(page.locator(`#resultado-magias [data-circ-check="${NOME_MAGIA}"]`),
    'a personalizada precisa ter check na grade do círculo')
    .toHaveCount(1);
  await expect(page.locator(`#resultado-magias [data-circ-check="${MAGIA_CLASSE_2}"]`),
    `"${MAGIA_CLASSE_2}" é magia da lista do Bardo: marcá-la aqui seria escolher magia conhecida `
    + 'fora da subida de nível -- ela continua sem check')
    .toHaveCount(0);
  await expect(page.locator('#resultado-magias .opcao-card', { hasText: MAGIA_CLASSE_2 }),
    'e ela continua VISÍVEL na grade -- o modal do Bardo é de consulta para a lista da classe')
    .toHaveCount(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 3. HOMÔNIMAS -- desmarcar a personalizada não apaga a da classe.
// ============================================================
// `magias_preparadas[]` é indexada por NOME no app inteiro, e o handler de
// desmarcar achava a entrada por `findIndex(m => m.nome === nome)`. Com a
// personalizada e a homônima da classe conhecidas ao mesmo tempo, o clique
// no check da personalizada apagava a que estivesse PRIMEIRO no array -- a
// da classe. A ordem da semente é deliberada: a da classe vem primeiro,
// senão o defeito não aparece.
//
// DE ONDE VEM esse estado (correção da rodada 1 de revisão -- a versão
// anterior deste cabeçalho dizia "marca-se a personalizada aqui e ganha-se
// a da classe na subida de nível", e isso é FALSO: levelup-ui.js esconde a
// homônima pelo `jaTemMagias` de nomes e ainda guarda a gravação com
// `!char.magias_preparadas?.find(x => x.nome === nome)`;
// `mostrarPreencherSlotMagia` filtra pelo mesmo `jaTemSet`; e o handler da
// grade recusa com toast): NENHUM caminho do app produz as duas. Ele chega
// de FORA -- ficha importada ou editada à mão, modelo de ameaça declarado
// neste repositório (xss-campos-livres.spec.mjs: a ficha circula como
// arquivo exportado). Por isso a semente é direta no store, e não uma
// sequência de cliques: reproduzir por clique é impossível, e é justamente
// esse o ponto. O que o app não sabe criar, ele ainda tem de não destruir
// em silêncio ao encontrar.
test('Bardo: desmarcar a personalizada homônima não apaga a magia da classe', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...BARDO,
    magias_customizadas: [magiaCustom(MAGIA_CLASSE_2)],
    magias_preparadas: [
      conhecidaDeClasse(MAGIA_CLASSE_2),
      { ...conhecidaDeClasse(MAGIA_CLASSE_2), personalizada: true },
    ],
  }, 'regras-magia-custom-conhecidas-homonimas');
  await assentar(page).catch(() => {});

  await abrirGerenciarMagias(page);

  // GUARDA CONTRA VACUIDADE: as duas homônimas precisam estar na aba, ou
  // não há disputa nenhuma a medir.
  await expect(page.locator('#resultado-magias .opcao-card', { hasText: MAGIA_CLASSE_2 }),
    'as duas homônimas conhecidas têm de aparecer na aba "Conhecidas Atuais"')
    .toHaveCount(2);

  const checkDaPersonalizada = page.locator(
    `#resultado-magias [data-remover-check="${MAGIA_CLASSE_2}"][data-remover-personalizada="1"]`);
  await expect(checkDaPersonalizada,
    'só a personalizada tem check, e o cartão precisa DIZER qual das duas ele é -- o nome '
    + 'sozinho não distingue as homônimas')
    .toHaveCount(1);

  await checkDaPersonalizada.click();
  await assentar(page).catch(() => {});

  await expect.poll(async () => (await preparadasComNome(page, MAGIA_CLASSE_2)).length, {
    message: 'desmarcar tem de tirar UMA das duas entradas homônimas',
  }).toBe(1);

  const [sobrevivente] = await preparadasComNome(page, MAGIA_CLASSE_2);
  expect(Boolean(sobrevivente.personalizada),
    'quem sai é a personalizada (a do cartão clicado); a magia da LISTA DA CLASSE tem de '
    + 'sobreviver -- apagá-la aqui devolveria ao Bardo uma vaga da lista da classe em silêncio')
    .toBe(false);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 4. SUPERFÍCIE 2 -- a troca do Descanso Longo enxerga a personalizada.
// ============================================================
// É o caminho de quem está NO LIMITE: com a lista cheia, o cartão da grade
// sai `bloqueada` e o clique é recusado -- a troca é o direito que o
// jogador já tem para abrir vaga, e ela nunca lia `magias_customizadas`.
const CONHECIDAS_NO_LIMITE = [
  'Comando', 'Curar Ferimentos', 'Detectar Magia', 'Heroísmo', 'Identificar', 'Palavra Curativa',
].map((nome) => conhecidaDeClasse(nome));

test('Bardo no limite: o Descanso Longo troca uma magia da classe pela personalizada', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...BARDO,
    magias_customizadas: [magiaCustom()],
    // Bardo 3 conhece 6 magias (dados/classes/bardo.json) -- estas seis
    // fecham o limite.
    magias_preparadas: [...CONHECIDAS_NO_LIMITE],
  }, 'regras-magia-custom-conhecidas-limite');
  await assentar(page).catch(() => {});

  // GUARDA: no limite, a superfície 1 não resolve -- o cartão sai
  // bloqueado. É o que torna a troca o único caminho, e por isso ela
  // precisa enxergar a magia.
  await abrirGerenciarMagias(page);
  await abrirAbaCirculo(page, 1);
  await expect(page.locator('#resultado-magias .opcao-card.bloqueada', { hasText: NOME_MAGIA }),
    'com a lista cheia o cartão da personalizada nasce bloqueado -- se ele estivesse livre, '
    + 'este cenário não estaria medindo o caminho de quem está no limite')
    .toHaveCount(1);
  await page.evaluate(() => window.fecharModal?.());
  await assentar(page).catch(() => {});

  await clicarBotaoFicha(page, 'btn-descanso-longo', { esperar: '#modal-overlay' });
  await assentar(page).catch(() => {});

  await page.locator('#btn-trocar-magias-dl').click();
  await expect(page.locator('#btn-confirmar-troca-conhecida'),
    'o Bardo tem direito à troca de 1 magia no Descanso Longo -- o modal precisa abrir')
    .toBeVisible({ timeout: 10_000 });

  await page.locator(`#troca-conhecida-remover-lista .opcao-card[data-opcao="${MAGIA_CLASSE}"]`)
    .click();
  await assentar(page).catch(() => {});

  // A AÇÃO CENTRAL: a magia personalizada tem de estar entre as que podem
  // ENTRAR. `mostrarTrocaMagiaConhecida` montava esse lado só da lista da
  // classe.
  const cartaoEntra = page.locator(
    `#resultado-troca-conhecida [data-selecionar-troca="${NOME_MAGIA}"]`);
  await expect(cartaoEntra,
    'a magia personalizada de círculo tem de aparecer entre as candidatas a ENTRAR na troca -- '
    + 'para quem está no limite esta é a única vaga possível (issues #27/#33)')
    .toBeVisible({ timeout: 10_000 });
  await expect(cartaoEntra,
    'e ela tem de se identificar como invenção do jogador, no meio de uma lista em que todo o '
    + 'resto veio da lista da classe')
    .toContainText('Personalizada');

  await cartaoEntra.click();
  await assentar(page).catch(() => {});
  await page.locator('#btn-confirmar-troca-conhecida').click();
  await assentar(page).catch(() => {});

  await expect.poll(async () => (await preparadasComNome(page, NOME_MAGIA)).length, {
    message: 'confirmar a troca tem de gravar a magia personalizada em magias_preparadas[]',
  }).toBe(1);

  const salvo = await personagemSalvo(page);
  const entrou = salvo.magias_preparadas.find((m) => m.nome === NOME_MAGIA);
  expect(entrou.circulo, 'a entrada gravada tem de manter o círculo da magia').toBe(1);
  expect(entrou.personalizada,
    'a entrada que ENTRA pela troca precisa da marca `personalizada` igual à que entra pela '
    + 'grade -- sem ela a ficha renderiza a magia como se fosse do acervo, sem descrição e sem '
    + 'o botão de Conjurar próprio dela')
    .toBe(true);
  expect(entrou.classe,
    'a troca é sempre DENTRO da mesma classe: a que entra herda o carimbo da que saiu')
    .toBe('Bardo');
  expect(salvo.magias_preparadas.some((m) => m.nome === MAGIA_CLASSE),
    'a magia escolhida para sair tem de ter saído -- troca é troca, não acréscimo')
    .toBe(false);
  expect(salvo.magias_preparadas.length,
    'o total continua no limite de 6 do Bardo 3 -- a troca abre vaga, não amplia o orçamento')
    .toBe(6);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 5. MULTICLASSE -- o passo do Bardo enxerga; o do Mago, não.
// ============================================================
// Semear só classe única já deixou lacuna aberta nesta mesma rodada de
// correções, por isso o par vem aqui. E ele mede a decisão mais fácil de
// desfazer sem querer: a magia personalizada NÃO é somada ao lado "entra"
// do Mago, porque para ele ela já chega pelo `char.grimorio` -- e só se
// ele tiver PAGO a cópia, que é a decisão da issue #42. Fundir a lista
// para todo mundo desenharia o cartão duplicado no Mago e devolveria de
// graça o que a #42 mandou pagar.
//
// Bardo 5/Mago 1 é o par que separa os dois ramos (`ehMago =
// !!sup?.usaGrimorio`): o Descanso Longo abre um passo por classe, e os
// dois passos deste personagem caem em ramos diferentes da MESMA função.
// "Heroísmo" é 1º Círculo só de Bardo, "Mísseis Mágicos" é de Mago
// (medido em troca-descanso-por-classe.spec.mjs).
const BARDO_5_MAGO_1 = [
  { classe: 'Bardo', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Mago', subclasse: '', nivel: 1, ordem: 1 },
];

test('Bardo 5/Mago 1: a personalizada entra na troca do Bardo e NÃO na do Mago', async ({ context }) => {
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
    // Mágicos" esvaziaria a lista do passo do Mago e "a personalizada não
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
  await expect(page.locator(`#resultado-troca-conhecida [data-selecionar-troca="${NOME_MAGIA}"]`),
    'no passo do Bardo a magia personalizada tem de estar entre as candidatas a entrar -- a '
    + 'lacuna vale igual para o multiclasse')
    .toHaveCount(1);

  await page.locator('#btn-pular-troca-conhecida').click();
  await assentar(page).catch(() => {});

  // PASSO 2 -- Mago.
  await expect(page.locator('#modal-titulo'), 'o passo 2 tem de ser do Mago')
    .toHaveText('Trocar Magia Conhecida — Mago', { timeout: 10_000 });
  await page.locator('#troca-conhecida-remover-lista .opcao-card[data-opcao="Mísseis Mágicos"]')
    .click();
  await assentar(page).catch(() => {});

  // GUARDA CONTRA VACUIDADE: a lista do Mago tem de ter alguma coisa, ou a
  // ausência medida abaixo não distingue "a regra do grimório valeu" de "a
  // lista não renderizou".
  await expect(page.locator('#resultado-troca-conhecida [data-selecionar-troca="Detectar Magia"]'),
    'a outra magia do grimório continua candidata no passo do Mago')
    .toHaveCount(1);
  await expect(page.locator(`#resultado-troca-conhecida [data-selecionar-troca="${NOME_MAGIA}"]`),
    'a personalizada NÃO pode aparecer no passo do Mago: ela não está no grimório dele, e o '
    + 'Mago só prepara o que copiou para o livro (issue #42) -- somá-la aqui devolveria de graça '
    + 'o que aquela correção mandou pagar')
    .toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 6. A DESCRIÇÃO DA PERSONALIZADA NA TROCA DO DESCANSO LONGO.
// ============================================================
// Consequência direta do cartão novo, e não achado avulso: o nome do cartão
// é um gatilho de clique (`data-troca-detalhe`) que busca a magia no ACERVO
// (`getMagiasPorCirculo`), e magia personalizada não está lá. O painel da
// grade do "+ Magia" já tinha ganhado o plano B (issues #27/#33, mesma forma
// da issue #39); esta tela ficou sem ele -- e é a PIOR para ficar, porque é
// aqui que o jogador decide em que gastar a ÚNICA troca que o Descanso Longo
// lhe dá. Ler a descrição da própria magia numa tela e não na outra é a
// mesma incoerência que este projeto já pagou caro para eliminar.
test('troca do Descanso Longo: clicar no nome da personalizada abre a descrição dela', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...BARDO,
    magias_customizadas: [magiaCustom()],
    magias_preparadas: [conhecidaDeClasse(MAGIA_CLASSE), conhecidaDeClasse(MAGIA_CLASSE_2)],
  }, 'regras-magia-custom-conhecidas-detalhe-troca');
  await assentar(page).catch(() => {});

  await clicarBotaoFicha(page, 'btn-descanso-longo', { esperar: '#modal-overlay' });
  await assentar(page).catch(() => {});
  await page.locator('#btn-trocar-magias-dl').click();
  await expect(page.locator('#btn-confirmar-troca-conhecida'), 'o modal de troca não abriu')
    .toBeVisible({ timeout: 10_000 });

  await page.locator(`#troca-conhecida-remover-lista .opcao-card[data-opcao="${MAGIA_CLASSE}"]`)
    .click();
  await assentar(page).catch(() => {});

  const nome = page.locator(`#resultado-troca-conhecida [data-troca-detalhe="${NOME_MAGIA}"]`);
  await expect(nome,
    'o nome do cartão da personalizada precisa ser clicável na lista de candidatas -- sem o '
    + 'gatilho não há descrição nenhuma a abrir')
    .toHaveCount(1);
  await nome.click();
  await assentar(page).catch(() => {});

  await expect(page.locator('.sub-modal-overlay'),
    'clicar no nome tem de abrir o sub-modal de detalhes lido da FICHA -- o acervo não conhece a '
    + 'magia que o jogador inventou, e sem o plano B este clique não abria nada')
    .toContainText(magiaCustom().descricao);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
