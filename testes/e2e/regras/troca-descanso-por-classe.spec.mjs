// ============================================================
// Tarefa 4 (sub-projeto 2026-08-29-troca-por-classe-descanso) -- a prova,
// com NAVEGADOR DE VERDADE, de que a CADEIA de N modais do Descanso Longo
// (site/js/sheet/hp-descanso.js) se comporta: T1 (trocasDoDescansoLongo)
// responde so o DIREITO por superficie de conjuracao, T2 (mostrarTrocaMagia-
// Conhecida/mostrarTrocaTruque) sabe nomear a classe quando `opcoes.classe`
// chega, e T3 monta um passo de magia POR CLASSE conjuradora + um passo de
// truque so, encadeados num unico botao "Trocar Magias".
//
// CORRECAO (rodada 1 de revisao, Important 2): a versao anterior deste
// cabecalho afirmava que NENHUM teste de unidade alcancava a travessia
// inteira da cadeia. E falso -- `testes/regras/unidade/troca-descanso-
// cadeia.test.mjs`, ORACULO 5, ja percorre magia(Clerigo) -> magia(Druida)
// -> truque clicando os MESMOS quatro botoes (#btn-trocar-magias-dl,
// #btn-pular-troca-conhecida duas vezes, #btn-pular-troca-truque), entregue
// pela propria Tarefa 3 deste sub-projeto. O que ESTE arquivo acrescenta de
// fato, e que aquele nao tem como dar: um NAVEGADOR real (Chromium via
// Playwright) rodando o app de verdade, com DOM real (nao o `document` FALSO
// que troca-descanso-cadeia.test.mjs instala -- `elementoFalso`/
// `instalarDocumentoFalso`, que simula so o minimo que abrirModal/
// addEventListener tocam) e a cadeia disparada por um clique de VERDADE do
// Playwright (`page.click`/`page.locator(...).click()`), nao por uma
// chamada direta ao handler capturado (`cliques[cliques.length - 1]({})`
// daquele arquivo). As duas suites protegem a MESMA travessia por caminhos
// diferentes -- o unico ponto sem cobertura nenhuma antes deste arquivo era
// o navegador de verdade, nao a travessia em si.
//
// Leia antes testes/e2e/regras/magias-troca-descanso.spec.mjs (o irmao que
// prova que TODA classe conjuradora recebe a troca de UMA magia, sem
// multiclasse) e testes/e2e/regras/trocas-conjurador.spec.mjs (o irmao que
// prova a REGRA DA CASA de truque no Descanso Longo). Este arquivo nao repete
// as provas deles -- assume "toda classe conjuradora tem direito" como dado
// e mede so o que muda com DUAS OU MAIS classes conjuradoras no mesmo
// personagem.
//
// FATO QUE OS SEIS CENARIOS ABAIXO DEPENDEM (T2/T3, repetido aqui porque
// ja custou uma rodada de correcao): com UMA superficie de conjuracao no
// personagem INTEIRO, a cadeia chama mostrarTrocaMagiaConhecida/
// mostrarTrocaTruque SEM `opcoes.classe`, e o titulo/explicacao do modal
// ficam byte a byte os de antes deste sub-projeto -- sem nomear a classe.
// Com duas ou mais, `opcoes.classe` e OBRIGATORIO -- inclusive quando so
// UMA das classes sobra com candidata (Oraculo 4, cenario 6 abaixo): a
// condicao certa e "quantas superficies o personagem tem", nao "quantos
// passos a cadeia vai mostrar agora".
//
// A troca de TRUQUE continua sendo UMA por personagem, nao por classe --
// decisao ja registrada (magias_conhecidas[] nao tem campo `classe`), nao
// revisitada aqui. `mostrarTrocaTruque` nunca recebe `opcoes.classe` nesta
// cadeia (hp-descanso.js: `abrir: (prox) => mostrarTrocaTruque(prox)`), e o
// titulo do modal de truque e sempre "Trocar Truque", multiclasse ou nao --
// e o que o cenario 3 usa para confirmar que a cadeia chegou ao fim.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha, personagemSalvo } from './helpers-regras.mjs';

// Classes DUAS-preparadas (Clerigo/Druida), na ordem em que o jogador as
// pegou -- Clerigo e a classe INICIAL (ordem 0). Nivel total 10, xp do
// proprio patamar (XP_POR_NIVEL[10], site/js/levelup.js) -- mesma convencao
// dos specs irmaos de multiclasse (magia-classe.spec.mjs).
const CLERIGO_5_DRUIDA_5 = [
  { classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Druida', subclasse: '', nivel: 5, ordem: 1 },
];
const PERICIAS_CLERIGO = ['Religião', 'Intuição'];

// Classes conhecida+preparada (Bardo/Mago), para o cenario 5 -- Bardo e
// "conhecidas" (dados-classes.js:40), Mago e "preparadas" (:280).
//
// ACHADO desta tarefa, nao previsto no brief: o brief sugeria "Bardo/
// Clerigo" como par conhecida/preparada -- mas a palavra "preparada" dentro
// do modal encadeado (mostrarTrocaMagiaConhecida, grimorio.js) NAO vem de
// `rotuloMagia` (o campo que T1/trocasDoDescansoLongo calcula a partir de
// `tipo_conjuracao`). Ela vem de um `ehMago` LOCAL aquele modulo:
//   const explicacaoPadrao = opcoes.classe
//     ? `...trocar 1 magia ${ehMago ? 'preparada' : 'conhecida'}...`
//     : `...`;
// `ehMago = !!sup?.usaGrimorio`, que so e true para o Mago -- QUALQUER
// outra classe preparada (Clerigo, Druida, Guardiao, Paladino) cai no
// mesmo ramo "conhecida" que as classes de fato conhecidas (Bardo/Bruxo/
// Feiticeiro). `git diff HEAD -- site/js/sheet/grimorio.js` confirma que a
// expressao `ehMago ? 'preparada' : 'conhecida'` e IDENTICA na linha
// REMOVIDA (codigo de antes deste sub-projeto) e nas duas linhas
// ADICIONADAS pela Tarefa 2 -- T2 so duplicou a expressao existente nos
// dois ramos do novo ternario de `opcoes.classe`, sem mexer nela. E um
// defeito PRE-EXISTENTE (a doc de `avisoSuperficieAtiva`, no mesmo
// arquivo, data a ultima regressao dessa area em 2026-08-19, 10 dias antes
// deste sub-projeto comecar), no arquivo de uma tarefa ja revisada e
// aprovada (T2) -- NAO da T3 (hp-descanso.js, o unico escopo em que este
// relatorio tem autorizacao para consertar producao). Por isso o cenario
// usa Mago (unica classe preparada em que `ehMago` acerta a palavra) em
// vez do Clerigo sugerido, e o defeito vai reportado, nao consertado --
// ver o relatorio desta tarefa.
const BARDO_5_MAGO_1 = [
  { classe: 'Bardo', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Mago', subclasse: '', nivel: 1, ordem: 1 },
];
const PERICIAS_BARDO = ['Atuação', 'Persuasão'];

/**
 * Abre o Descanso Longo e espera o botao "Trocar Magias" existir -- a
 * mesma disciplina de espera de `clicarBotaoFicha` (retentativa sob carga),
 * usada por trocas-conjurador.spec.mjs para o mesmo botao de descanso.
 */
async function abrirDescansoLongo(page) {
  await clicarBotaoFicha(page, 'btn-descanso-longo', { esperar: '#modal-overlay' });
  await assentar(page).catch(() => {});
}

// ============================================================
// 1. O CANARIO DA MAIORIA: classe unica nao nomeia a classe em NADA.
// ============================================================
// Quase todo personagem do app e de classe unica, e nenhum deles e
// multiclasse -- um erro aqui atinge quase todo mundo, por isso vem
// primeiro. Clerigo 5 puro, 2 magias preparadas de verdade (1o Circulo,
// dados/classes/magias_clerigo.json) para o seletor "magia a remover" nao
// cair no caminho de opcao unica.
//
// PROVA DE MUTACAO (exigida pelo brief para toda assercao de AUSENCIA): a
// linha que decide isto e hp-descanso.js, dentro do map de PASSOS --
//   abrir: (prox) => ehSuperficieUnica
//     ? mostrarTrocaMagiaConhecida(prox)
//     : mostrarTrocaMagiaConhecida(prox, { classe: entrada.classe }),
// Troquei temporariamente por `abrir: (prox) => mostrarTrocaMagiaConhecida(
// prox, { classe: entrada.classe })` (sempre nomear, o EXATO defeito que o
// brief descreve como "a primeira versao nomeava a classe tambem em classe
// unica") e rodei so este cenario: FALHOU, com
//   Error: Timed out ... waiting for expect(locator).toHaveText(expected)
//   Locator: locator('#modal-titulo')
//   Expected string: "Trocar Magia Conhecida"
//   Received string: "Trocar Magia Conhecida — Clérigo"
// Restaurei a linha e rodei de novo: verde. A prova esta descrita aqui
// porque a mutacao em si NAO fica no diff -- e' o "ligar e desligar" pedido
// pelo brief, nao uma alteracao de producao.
test('Clérigo 5 puro: a cadeia do Descanso Longo NÃO nomeia a classe -- canário da maioria dos personagens', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo', nivel: 5, xp: 6500,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: PERICIAS_CLERIGO,
    magias_preparadas: [
      { nome: 'Bênção', circulo: 1 },
      { nome: 'Curar Ferimentos', circulo: 1 },
    ],
  }, 'regras-t4-canario-clerigo');

  await abrirDescansoLongo(page);

  const botaoTroca = page.locator('#btn-trocar-magias-dl');
  await expect(botaoTroca,
    'Clérigo de classe única deveria receber a troca de magia no Descanso Longo')
    .toBeVisible();
  await botaoTroca.click();
  await assentar(page).catch(() => {});

  // A cadeia chama SEM opcoes.classe -- o titulo do modal tem de ser
  // EXATAMENTE o de antes deste sub-projeto, sem " — Clérigo" no final.
  await expect(page.locator('#btn-confirmar-troca-conhecida'),
    'o modal de trocar 1 magia não abriu')
    .toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#modal-titulo'),
    'classe única não pode nomear a classe no título -- os textos têm de ficar byte a byte os de ' +
    'antes deste sub-projeto (fato citado no brief, e a regressão que a Rodada 1 desta tarefa já ' +
    'corrigiu uma vez)')
    .toHaveText('Trocar Magia Conhecida');

  // A explicação também não pode abrir com "<classe>: " -- ela continua
  // mencionando "da lista de Clérigo" (isso já existia antes de opcoes.classe
  // existir, não é o que este cenário protege), mas sem o prefixo em negrito
  // que só `opcoes.classe` acrescenta (grimorio.js:1341-1343).
  const explicacao = page.locator('#modal-corpo .info-box.info');
  // Guarda contra vacuidade (Minor CA-6, revisão final): sem esta linha, um
  // seletor errado (que não casasse com nada) faria a asserção `.not`
  // abaixo passar em silêncio -- localizador vazio nunca CONTÉM "Clérigo:".
  // Esta linha prova que `explicacao` de fato resolveu para o parágrafo de
  // verdade antes de a ausência do prefixo virar afirmação.
  await expect(explicacao,
    'sanity: o localizador da explicação tem de apontar para o parágrafo de verdade -- senão a ' +
    'ausência de "Clérigo:", abaixo, não afirma nada')
    .toContainText('Descanso Longo');
  await expect(explicacao,
    'a explicação não pode começar com o prefixo "<strong>Clérigo:</strong> " que só existe ' +
    'quando opcoes.classe é passado -- classe única não passa esse parâmetro')
    .not.toContainText('Clérigo:');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 2. DUAS CLASSES, DUAS TROCAS -- o defeito que o sub-projeto conserta.
// ============================================================
// Clérigo 5/Druida 5: as duas classes têm candidata de sobra, carimbadas
// explicitamente (evita depender do timing assíncrono da migração --
// migrarMagiaClasse, achado citado em magia-classe.spec.mjs -- para uma
// pergunta que não é sobre migração). "Bênção"/"Comando" são 1º Círculo só
// de Clérigo relevante aqui (medido em magias_clerigo.json); "Emaranhar"/
// "Faca de Gelo" são 1º Círculo de Druida (magias_druida.json). Sem truque
// (magias_conhecidas vazio) para isolar a afirmação central: ANTES deste
// sub-projeto o app oferecia UMA troca só, da classe que veio primeiro --
// aqui tem de oferecer DUAS, uma por classe.
const CANDIDATAS_CLERIGO = [
  { nome: 'Bênção', circulo: 1, classe: 'Clérigo' },
  { nome: 'Comando', circulo: 1, classe: 'Clérigo' },
];
const CANDIDATAS_DRUIDA = [
  { nome: 'Emaranhar', circulo: 1, classe: 'Druida' },
  { nome: 'Faca de Gelo', circulo: 1, classe: 'Druida' },
];

test('Clérigo 5/Druida 5: o Descanso Longo oferece DUAS trocas de magia, uma por classe', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo', nivel: 10, xp: 64000,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: PERICIAS_CLERIGO,
    classes: CLERIGO_5_DRUIDA_5,
    schema_versao: 2,
    magias_preparadas: [...CANDIDATAS_CLERIGO, ...CANDIDATAS_DRUIDA],
  }, 'regras-t4-duas-classes-duas-trocas');

  await abrirDescansoLongo(page);

  // O resumo (modal "Descanso Longo Concluído", ANTES de clicar em "Trocar
  // Magias") já anuncia as DUAS trocas -- é o texto que hp-descanso.js monta
  // quando passosMagia.length > 1 (a lista existe para o jogador ver de
  // antemão quantas trocas o botão único vai encadear).
  const resumo = page.locator('#modal-corpo');
  await expect(resumo,
    'com duas classes conjuradoras com candidata, o resumo tem de anunciar 2 trocas de magia')
    .toContainText('2 trocas de magia disponíveis');
  await expect(resumo,
    'o resumo tem de listar o Clérigo como uma das duas trocas, com o rótulo "preparada" dele')
    .toContainText('Clérigo: 1 magia preparada');
  await expect(resumo,
    'o resumo tem de listar a Druida como a OUTRA troca -- antes deste sub-projeto só a classe ' +
    'inicial (Clérigo) aparecia aqui')
    .toContainText('Druida: 1 magia preparada');

  await page.locator('#btn-trocar-magias-dl').click();
  await assentar(page).catch(() => {});

  // O PRIMEIRO passo da cadeia é da classe INICIAL (Clérigo, ordem 0), e com
  // duas superfícies `opcoes.classe` é obrigatório: o título nomeia a classe.
  await expect(page.locator('#btn-confirmar-troca-conhecida'),
    'o primeiro modal de troca de magia não abriu')
    .toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#modal-titulo'),
    'o primeiro passo da cadeia tem de ser do Clérigo (classe inicial, ordem 0) -- e nomear a ' +
    'classe, porque o personagem tem duas superfícies de conjuração')
    .toHaveText('Trocar Magia Conhecida — Clérigo');

  // As candidatas do passo do Clérigo são só as DELE -- se a Druida vazasse
  // aqui, uma troca "de Clérigo" moveria magia do orçamento errado.
  await expect(page.locator('#troca-conhecida-remover-lista .opcao-card[data-opcao="Bênção"]'),
    '"Bênção" (carimbada Clérigo) tem de aparecer como candidata no passo do Clérigo')
    .toBeVisible({ timeout: 5000 });
  await expect(page.locator('#troca-conhecida-remover-lista .opcao-card[data-opcao="Emaranhar"]'),
    '"Emaranhar" (carimbada Druida) NÃO pode aparecer no passo do Clérigo -- moveria magia do ' +
    'orçamento da Druida para o do Clérigo em silêncio')
    .toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 3. A CADEIA PERCORRE TUDO DALI PARA A FRENTE.
// ============================================================
// Mesma dupla Clérigo 5/Druida 5, mas agora com um truque de classe
// trocável também (Clérigo, "Chama Sagrada", sem `origem` -- a mesma forma
// de CLERIGO_TROCAVEL em trocas-conjurador.spec.mjs). Clicar "Trocar
// Magias" tem de encadear os TRÊS passos -- magia do Clérigo, magia da
// Druida, e por fim o truque -- sem nenhum sumir em silêncio. É a
// propriedade que a estrutura PASSOS (hp-descanso.js) existe para garantir:
// o comentário do próprio código explica que o encadeamento par-a-par foi
// abandonado porque a combinação que faltasse sumiria sem aviso nenhum.
//
// O truque nunca recebe opcoes.classe nesta cadeia (é UMA troca por
// personagem, não por classe) -- por isso o título do terceiro modal é
// sempre "Trocar Truque" puro, multiclasse ou não. Chegar a ELE, com esse
// título exato, é a prova de que a cadeia não parou nos dois passos de
// magia.
test('Clérigo 5/Druida 5 com truque: a cadeia percorre magia do Clérigo → magia da Druida → truque', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo', nivel: 10, xp: 64000,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: PERICIAS_CLERIGO,
    classes: CLERIGO_5_DRUIDA_5,
    schema_versao: 2,
    magias_preparadas: [...CANDIDATAS_CLERIGO, ...CANDIDATAS_DRUIDA],
    magias_conhecidas: [{ nome: 'Chama Sagrada', circulo: 0 }],
  }, 'regras-t4-cadeia-percorre-tudo');

  await abrirDescansoLongo(page);
  await expect(page.locator('#btn-trocar-magias-dl'), 'a troca de magia não foi oferecida')
    .toBeVisible();
  await expect(page.locator('#btn-trocar-truque-dl'), 'a troca de truque não foi oferecida')
    .toBeVisible();

  await page.locator('#btn-trocar-magias-dl').click();
  await assentar(page).catch(() => {});

  // Passo 1: magia do Clérigo. "Não Trocar" avança a cadeia sem escolher
  // nada -- é o caminho mais curto para provar a TRAVESSIA, não a troca em
  // si (já provada pelo cenário 2).
  await expect(page.locator('#btn-confirmar-troca-conhecida'), 'o passo 1 (magia do Clérigo) não abriu')
    .toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#modal-titulo'), 'o passo 1 tem de ser o do Clérigo')
    .toHaveText('Trocar Magia Conhecida — Clérigo');
  await page.locator('#btn-pular-troca-conhecida').click();
  await assentar(page).catch(() => {});

  // Passo 2: magia da Druida -- se a cadeia parasse no passo 1 (o defeito
  // que este sub-projeto conserta), este passo nunca apareceria.
  await expect(page.locator('#btn-confirmar-troca-conhecida'), 'o passo 2 (magia da Druida) não abriu -- a cadeia parou no passo do Clérigo')
    .toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#modal-titulo'), 'o passo 2 tem de ser o da Druida')
    .toHaveText('Trocar Magia Conhecida — Druida');
  await page.locator('#btn-pular-troca-conhecida').click();
  await assentar(page).catch(() => {});

  // Passo 3: o truque -- prova de que a cadeia chega ATÉ O FIM, não só até
  // a última classe conjuradora.
  await expect(page.locator('#btn-confirmar-troca-truque'), 'o passo 3 (truque) não abriu -- a cadeia parou nas trocas de magia')
    .toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#modal-titulo'),
    'o truque é UMA troca por personagem, não por classe -- o título nunca nomeia classe nenhuma')
    .toHaveText('Trocar Truque');
  await page.locator('#btn-pular-troca-truque').click();
  await assentar(page).catch(() => {});

  // Fim da cadeia: nenhum quarto passo, o modal fecha.
  await expect(page.locator('#modal-overlay'),
    'depois do truque a cadeia tem de terminar -- nenhum passo a mais foi declarado em PASSOS')
    .toBeHidden({ timeout: 10_000 });

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 4. "MANTER TUDO" PULA TUDO -- o caminho que mais gente usa.
// ============================================================
// Mesma dupla com magia E truque disponíveis (mesma semente do cenário 3),
// mas aqui o jogador clica "Manter Tudo" no resumo em vez de "Trocar
// Magias": nenhum modal de troca pode aparecer depois, e a ficha salva tem
// de continuar EXATAMENTE como foi semeada -- nenhuma troca, nenhuma
// gravação.
test('Clérigo 5/Druida 5: "Manter Tudo" não abre passo nenhum e não muda a ficha', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo', nivel: 10, xp: 64000,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: PERICIAS_CLERIGO,
    classes: CLERIGO_5_DRUIDA_5,
    schema_versao: 2,
    magias_preparadas: [...CANDIDATAS_CLERIGO, ...CANDIDATAS_DRUIDA],
    magias_conhecidas: [{ nome: 'Chama Sagrada', circulo: 0 }],
  }, 'regras-t4-manter-tudo');

  await abrirDescansoLongo(page);
  await expect(page.locator('#btn-pular-troca-dl'), 'o botão "Manter Tudo" não apareceu')
    .toBeVisible();

  await page.locator('#btn-pular-troca-dl').click();
  await assentar(page).catch(() => {});

  await expect(page.locator('#modal-overlay'), '"Manter Tudo" tem de fechar o modal sem abrir mais nada')
    .toBeHidden({ timeout: 10_000 });
  await expect(page.locator('#btn-confirmar-troca-conhecida'), 'nenhum modal de troca de magia pode ter aberto')
    .toHaveCount(0);
  await expect(page.locator('#btn-confirmar-troca-truque'), 'nenhum modal de troca de truque pode ter aberto')
    .toHaveCount(0);

  // A ficha salva tem de bater exatamente com o que foi semeado -- "Manter
  // Tudo" não chama salvar() nenhum (hp-descanso.js), então nada deveria
  // ter se movido nem sido carimbado de novo.
  await expect.poll(async () => {
    const p = await personagemSalvo(page);
    return (p?.magias_preparadas || []).map((m) => `${m.nome}:${m.circulo}:${m.classe}`).sort();
  }, {
    message: '"Manter Tudo" não pode alterar magias_preparadas -- é o caminho que a maioria dos ' +
      'jogadores usa, e ele existe para NÃO mudar nada',
  }).toEqual(['Bênção:1:Clérigo', 'Comando:1:Clérigo', 'Emaranhar:1:Druida', 'Faca de Gelo:1:Druida'].sort());
  await expect.poll(async () => {
    const p = await personagemSalvo(page);
    return (p?.magias_conhecidas || []).map((m) => `${m.nome}:${m.circulo}`);
  }, {
    message: '"Manter Tudo" não pode alterar o truque de classe',
  }).toEqual(['Chama Sagrada:0']);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 5. O RÓTULO ACOMPANHA A CLASSE -- Bardo ("conhecida") vs. Mago ("preparada").
// ============================================================
// Sem isto, dois modais seguidos diriam a mesma coisa e o jogador não
// saberia qual é qual. Bardo/Mago porque é o ÚNICO par onde a palavra
// muda de verdade HOJE -- ver o comentário de BARDO_5_MAGO_1, acima, para
// o porquê de não ser Bardo/Clérigo (o exemplo do brief).
//
// CORREÇÃO (rodada 1 de revisão, Important 1): o nome do teste e as duas
// mensagens de asserção abaixo atribuíam a palavra a `tipo_conjuracao`
// (dados-classes.js) -- falso. Quem decide "conhecida" vs. "preparada"
// dentro do modal (`mostrarTrocaMagiaConhecida`, grimorio.js) é
// `ehMago = !!sup?.usaGrimorio`: só o Mago cai no ramo "preparada"; QUALQUER
// outra classe (Bardo, mas também Clérigo/Druida/Guardião/Paladino, que são
// "preparadas" de verdade por `tipo_conjuracao`) cai no ramo "conhecida".
// O teste ficava verde por COINCIDÊNCIA -- o Mago é a única classe em que
// `usaGrimorio` e `tipo_conjuracao` concordam --, e por isso não provava o
// que o nome dizia provar. `git log -S` (achado do revisor) acha essa
// palavra num commit único de 2026-08-19, dez dias antes deste sub-projeto
// -- pré-existente, fora do escopo de conserto desta tarefa (só T3 pode ser
// consertada aqui). `testes/regras/lacunas-conhecidas.mjs:1014` registra por
// escrito, da época daquele commit, a mesma afirmação falsa ("passou a dizer
// '1 magia preparada' para conjurador preparado") -- ou seja, o texto errado
// não é só deste spec: é uma crença documentada em pelo menos dois lugares
// do repositório, nenhum deles esta tarefa. Bardo/Clérigo seria o par
// NATURAL para este cenário (os dois nomes que o brief sugeriu) se
// `usaGrimorio` não fosse a fonte real -- não usei porque, com Clérigo, os
// DOIS passos diriam "conhecida", e o cenário passaria sem provar nada.
//
// "Heroísmo" é 1º Círculo só de Bardo (ausente de magias_mago.json,
// medido); "Mísseis Mágicos" é 1º Círculo de Mago. O Mago só pode
// PREPARAR o que está no grimório (achado de magia-classe.spec.mjs,
// cenário 4) -- por isso `grimorio` semeado junto.
test('Bardo 5/Mago 1: o modal usa "conhecida" para o Bardo e "preparada" para o Mago (a palavra segue usaGrimorio, não tipo_conjuracao)', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Bardo', nivel: 6, xp: 14000,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: PERICIAS_BARDO,
    classes: BARDO_5_MAGO_1,
    schema_versao: 2,
    magias_preparadas: [
      { nome: 'Heroísmo', circulo: 1, classe: 'Bardo' },
      { nome: 'Mísseis Mágicos', circulo: 1, classe: 'Mago' },
    ],
    grimorio: [{ nome: 'Mísseis Mágicos', circulo: 1 }],
  }, 'regras-t4-rotulo-por-classe');

  await abrirDescansoLongo(page);
  await page.locator('#btn-trocar-magias-dl').click();
  await assentar(page).catch(() => {});

  // Passo 1: Bardo -- `usaGrimorio` é false para ele, então o modal cai no
  // ramo "conhecida" (que também é o `tipo_conjuracao` certo do Bardo, mas
  // não é ISSO que decide o texto -- ver o comentário do cenário, acima).
  await expect(page.locator('#btn-confirmar-troca-conhecida'), 'o passo do Bardo não abriu')
    .toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#modal-titulo'), 'o passo 1 tem de ser do Bardo (classe inicial)')
    .toHaveText('Trocar Magia Conhecida — Bardo');
  await expect(page.locator('#modal-corpo .info-box.info'),
    'o Bardo não usa grimório (usaGrimorio: false, grimorio.js) -- o texto do passo dele tem de ' +
    'dizer "magia conhecida", não "preparada" (esta palavra segue usaGrimorio, NÃO ' +
    'tipo_conjuracao -- ver o comentário do cenário, acima, para o porquê)')
    .toContainText('1 magia conhecida');
  await page.locator('#btn-pular-troca-conhecida').click();
  await assentar(page).catch(() => {});

  // Passo 2: Mago -- a ÚNICA classe em que `usaGrimorio` é true, então o
  // modal cai no ramo "preparada" (inclusive "do seu livro de magias", em
  // vez de "da lista de <classe>"). É esta diferença, e não `tipo_conjuracao`,
  // que faz o par Bardo/Mago provar o cenário -- Bardo/Clérigo NÃO provaria
  // (os dois são "preparada" por tipo_conjuracao, mas usaGrimorio é false
  // para os dois, e os dois diriam "conhecida").
  await expect(page.locator('#btn-confirmar-troca-conhecida'), 'o passo do Mago não abriu')
    .toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#modal-titulo'), 'o passo 2 tem de ser do Mago')
    .toHaveText('Trocar Magia Conhecida — Mago');
  await expect(page.locator('#modal-corpo .info-box.info'),
    'o Mago usa grimório (usaGrimorio: true, grimorio.js) -- é a ÚNICA classe em que o texto do ' +
    'passo diz "magia preparada" em vez de "conhecida" (repetir o texto do Bardo faria os dois ' +
    'modais parecerem o mesmo passo)')
    .toContainText('1 magia preparada');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 6. CLASSE SEM CANDIDATA NÃO GERA PASSO -- a regressão mais provável.
// ============================================================
// Clérigo 5/Druida 5, mas só o Clérigo tem magia preparada de verdade; a
// Druida não tem NENHUMA (nem carimbada nem sem carimbo -- zero entradas).
// A Druida TEM o direito de trocar (é conjuradora, trocasDoDescansoLongo
// devolveria podeTrocarMagia: true para ela), mas não tem o que oferecer --
// e "portão e lista têm de concordar": este beco sem saída (o fluxo abrir e
// não ter candidata nenhuma) já foi consertado QUATRO vezes nesta branch,
// e é a regressão mais provável desta tarefa.
//
// A ASSERÇÃO DE AUSÊNCIA fica no RESUMO (modal "Descanso Longo Concluído"),
// não num evento passageiro: com só 1 classe sobrevivendo ao portão
// (passosMagia.length === 1), hp-descanso.js usa o MESMO texto singular que
// um personagem de classe única usaria -- e esse texto é uma peça ESTÁVEL
// do DOM (renderizada de uma vez, antes de qualquer clique), diferente de
// um toast que se autodestrói em 3s. Se o portão vazasse a Druida para a
// lista (o defeito que este cenário existe para pegar), o resumo mudaria
// para o texto PLURAL e passaria a citar "Druida" -- os dois são
// verificados abaixo.
//
// PROVA DE MUTAÇÃO (exigida pelo brief): troquei temporariamente o filtro
//   const passosMagia = trocasLongo.filter((entrada) => {
//     if (!entrada.podeTrocarMagia) return false;
//     const candidatas = preparadasPorClasse(char, entrada.classe);
//     return [...candidatas.desta, ...candidatas.semClasse].some((m) => m.circulo > 0);
//   });
// por `const passosMagia = trocasLongo.filter((entrada) => entrada.podeTrocarMagia);`
// (remove a checagem de candidata, deixando só o DIREITO) e rodei só este
// cenário: FALHOU -- já na assertiva de CONTROLE (a primeira, "controle: o
// resumo tem de nomear o Clérigo como quem pode trocar"), porque o texto
// virou o PLURAL antes mesmo de chegar na checagem de ausência:
//   Expected substring: "Como Clérigo, você pode trocar"
//   Received string: "...Deseja trocar suas magias?...
//     Você tem 2 trocas de magia disponíveis, uma por classe conjuradora...
//     Clérigo: 1 magia preparadaDruida: 1 magia preparada..."
// (a Druida entrou no resumo mesmo sem candidata nenhuma -- a falha bateu
// um passo antes do que eu esperava ao escrever o teste, na guarda contra
// vacuidade em vez da asserção final de ausência, mas prova exatamente o
// mesmo vazamento). Restaurei a linha e rodei de novo: verde.
test('Clérigo 5/Druida 5: a Druida sem candidata NÃO gera passo de magia', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo', nivel: 10, xp: 64000,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: PERICIAS_CLERIGO,
    classes: CLERIGO_5_DRUIDA_5,
    schema_versao: 2,
    // Só o Clérigo tem preparada -- a Druida não tem NENHUMA entrada em
    // magias_preparadas[], nem carimbada nem sem carimbo. Sem truque
    // também (magias_conhecidas ausente), para isolar a cadeia num passo só.
    magias_preparadas: [...CANDIDATAS_CLERIGO],
  }, 'regras-t4-classe-sem-candidata');

  await abrirDescansoLongo(page);
  await expect(page.locator('#btn-trocar-magias-dl'), 'o Clérigo tem candidata -- a troca de magia tem de ser oferecida')
    .toBeVisible();

  // GUARDA CONTRA VACUIDADE: se o portão também tivesse excluído o Clérigo
  // por engano, o resumo estaria vazio e a ausência da Druida abaixo não
  // provaria filtro nenhum -- só uma lista quebrada. O texto SINGULAR
  // (não-plural) é o mesmo de classe única -- prova que passosMagia tem
  // exatamente 1 elemento, e esse elemento é o Clérigo.
  const resumo = page.locator('#modal-corpo');
  await expect(resumo,
    'controle: o resumo tem de nomear o Clérigo como quem pode trocar')
    .toContainText('Como Clérigo, você pode trocar');

  // A ASSERÇÃO CENTRAL, provada por mutação (ver comentário do cenário,
  // acima): a Druida, sem candidata nenhuma, não pode aparecer no resumo.
  await expect(resumo,
    'a Druida não tem candidata nenhuma a trocar -- ela não pode aparecer no resumo de trocas, ' +
    'mesmo tendo o DIREITO (é conjuradora): "direito" e "candidata de verdade" são perguntas ' +
    'diferentes, e é o portão (passosMagia) que precisa concordar com a lista')
    .not.toContainText('Druida');
  await expect(resumo,
    'com só 1 classe sobrevivendo ao portão, o resumo tem de usar o texto SINGULAR (o mesmo de ' +
    'classe única) -- o texto PLURAL ("N trocas de magia disponíveis") só aparece quando mais de ' +
    'uma classe tem candidata de verdade')
    .not.toContainText('trocas de magia disponíveis');

  // Oráculo 4 (comentário de hp-descanso.js): mesmo com 1 passo só, o
  // personagem tem DUAS superfícies no total -- `opcoes.classe` continua
  // obrigatório na cadeia, então o modal ainda nomeia "Clérigo" (diferente
  // do cenário 1, onde a classe única faz ehSuperficieUnica ser true).
  await page.locator('#btn-trocar-magias-dl').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-confirmar-troca-conhecida'), 'o passo do Clérigo não abriu')
    .toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#modal-titulo'),
    'com duas superfícies no personagem (mesmo a Druida sem candidata), opcoes.classe continua ' +
    'obrigatório -- Oráculo 4 do brief da Tarefa 3')
    .toHaveText('Trocar Magia Conhecida — Clérigo');

  // Fim da cadeia: sem truque e sem segundo passo de magia, "Não Trocar"
  // tem de fechar tudo -- nenhum passo fantasma da Druida aparece depois.
  await page.locator('#btn-pular-troca-conhecida').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#modal-overlay'),
    'depois do único passo (Clérigo), a cadeia tem de terminar -- nenhum passo da Druida existe ' +
    'para aparecer')
    .toBeHidden({ timeout: 10_000 });

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
