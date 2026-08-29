// ============================================================
// Task 5 (sub-projeto "proficiências de classe nova", livro:2051): o
// cenário e2e de ponta a ponta. As quatro tarefas anteriores foram
// verificadas ISOLADAMENTE -- um módulo puro (regras-multiclasse-
// proficiencias.js) decidindo quais proficiências uma classe NOVA
// concede; a conversão dos quatro lugares que liam armadura/arma para
// derivar da união de `classes[]`; o motor (levelup.js/levelup-flow.js)
// recusando a subida em Bardo/Guardião/Ladino sem a escolha; e a tela
// (levelup-cards.js) que faz essa pergunta. NENHUM desses testes prova
// que a tela e o motor concordam -- cada um pode estar certo sozinho e
// discordar no meio. Este arquivo é essa prova.
//
// Três cenários (o 3º acrescentado pela revisão final -- ver o cabeçalho
// dele para os dois buracos de cobertura que ele fecha):
//
// 1. Mago 5 entra em Guardião: Guardião CONCEDE perícia (livro:5596),
//    então o step "Proficiências da Classe Nova" tem de aparecer, e a
//    escolha feita ali tem de chegar ao personagem salvo -- e a seção de
//    equipamento da ficha tem de passar a mostrar "Média" (armadura que
//    só o Guardião dá; o Mago não dá nenhuma), medindo a Task 2
//    (armadurasDoPersonagem) de ponta a ponta.
//
// 2. Mago 5 entra em Bárbaro: Bárbaro NÃO concede perícia nem instrumento
//    como classe nova (livro:2385 -- só armas Marciais e Escudo), então o
//    step nem pode aparecer -- um step que aparecesse sempre travaria a
//    subida de QUALQUER classe sem escolha, mesmo as que não têm nada a
//    perguntar. E a armadura na ficha muda mesmo assim: o Bárbaro
//    concede só "Escudo" como classe nova, não o "Leve, Média, Escudo"
//    que ele daria como classe ÚNICA -- essa é a armadilha do livro,
//    medida na tela.
//
// 3. Mago 5 escolhe Bardo, faz as DUAS escolhas do Bardo (perícia E
//    Instrumento Musical -- a única classe que exige as duas), volta ao
//    step da classe e troca para Guardião: nem a perícia nem o instrumento
//    podem sobreviver à troca.
//
// RULING 11 (revisão desta task): o roteiro original pedia medir ARMAS
// (Marcial) no cenário 2. Isso não discrimina nada -- a união mostra
// "Simples" de qualquer forma, porque o MAGO (classe inicial) já concede
// Simples com o conjunto COMPLETO. Uma classe que recebesse o conjunto
// COMPLETO de arma do Bárbaro por engano (Simples + Marcial) passaria
// pela mesma tela sem diferença nenhuma. Quem discrimina é a ARMADURA:
// o conjunto completo do Bárbaro é "Leve, Média, Escudo"; o reduzido é só
// "Escudo". Por isso o cenário 2 mede armadura, não arma -- a arma já
// está coberta pelos testes de unidade por classe.
//
// DESVIO DO BRIEF, medido no código (não é decisão deste arquivo): o
// roteiro original também pedia afirmar que "#btn-step-proximo" nasce
// DESABILITADO no step de proficiências, do mesmo jeito que no step
// "Classe do Nível". Não é assim que o step funciona -- levelup-ui.js
// (linha ~181) só desabilita "Próximo" no step 'escolha_classe'; em
// TODOS os outros, incluindo este, "Próximo" nunca valida nada (mesmo
// design do step de ASI/talento -- ver o cabeçalho de
// talentos-levelup.spec.mjs): quem quiser ver a Revisão sem escolher
// pode, e é lá que a pendência aparece, com o "Confirmar" recusando via
// toast. O cenário 1 abaixo mede ESSA barreira -- a real -- em vez de um
// botão desabilitado que o produto nunca teve.
// ============================================================
import { test, expect } from '@playwright/test';
import {
  ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar,
  lerToastErro, personagemSalvo,
} from './helpers-regras.mjs';

const CARD_CLASSE = '#levelup-escolha-classe';
const PROXIMO = '#btn-step-proximo';
const ANTERIOR = '#btn-step-anterior';
const CONFIRMAR = '#btn-confirmar-levelup';
const STEP_ATIVO = '.levelup-step-ativo .levelup-step-label';

/** Radio de uma classe dentro do card do step 'escolha_classe'. */
function radioClasse(page, nome) {
  return page.locator(`${CARD_CLASSE} input[name="classe-que-sobe"][data-classe="${nome}"]`);
}

/** Clica em "Próximo" e espera o modal reagir. */
async function proximo(page) {
  await page.locator(PROXIMO).click();
  await assentar(page).catch(() => {});
}

// Os números da barra de progresso são clicáveis (levelup-ui.js/bindNavegacao
// liga `.levelup-step[data-step-idx]` a `irParaStep`). Navegar por eles em vez
// de contar cliques em "Próximo" deixa o cenário 3 imune a quantos passos o
// Bardo insere no meio (truques, magias) -- e são passos que ele insere e o
// Guardião não, então contar "Próximo" quebraria justamente na troca de classe
// que o cenário existe para medir.
function stepDaBarra(page, rotulo) {
  return page.locator('.levelup-progress .levelup-step', { hasText: rotulo });
}

/** Vai direto para um passo clicando no rótulo dele na barra de progresso. */
async function irParaStep(page, rotulo) {
  await stepDaBarra(page, rotulo).click();
  await assentar(page).catch(() => {});
  await expect(page.locator(STEP_ATIVO), `o clique na barra tem de abrir "${rotulo}"`)
    .toHaveText(rotulo);
}

// Mesma semente de multiclasse-subida.spec.mjs: nível 5 é suficiente para
// o cabeçalho mostrar "Mago 5 / X 1" depois da subida, e Inteligência 13
// (ATRIBUTOS_REGRAS) mantém o Mago qualificado como classe ATUAL. Guardião
// pede Destreza E Sabedoria 13+ (livro:5574) e Bárbaro pede Força 13+
// (livro:2361) -- ATRIBUTOS_REGRAS (todos 13+) qualifica os dois.
const MAGO_5 = {
  classe: 'Mago', subclasse: '', nivel: 5, xp: 6500,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
};

// Localiza o grupo "Armaduras:"/"Armas:" da seção de proficiências de
// equipamento da ficha (sheet/ficha.js, .prof-equip-group).
function grupoProfEquip(page, rotulo) {
  return page.locator('.prof-equip-group', { hasText: rotulo });
}

// ============================================================
// 1. Mago 5 entra em Guardião: perícia obrigatória, motor e tela concordam
// ============================================================
test('Mago 5 escolhe Guardião: a perícia da classe nova é exigida na Revisão, chega ao personagem salvo, e a ficha passa a mostrar Média', async ({ context }) => {
  const id = 'regras-multiclasse-prof-guardiao';
  const { page, erros } = await abrirFicha(context, MAGO_5, id);

  // CONTROLE: antes da subida a ficha não mostra "Média" em armadura --
  // sem isto, uma ficha que já mostrasse Média por outro motivo (ex.:
  // proficiencias_extra) faria a asserção final passar por coincidência.
  await expect(grupoProfEquip(page, 'Armaduras:'),
    'controle: um Mago 5 sozinho não tem proficiência de armadura nenhuma').not.toContainText('Média');

  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false }),
    'o assistente de nível não abriu').toBe(true);
  await expect(page.locator(CARD_CLASSE), 'o card do step da classe precisa estar visível').toBeVisible();

  await radioClasse(page, 'Guardião').click();
  await expect(page.locator(CARD_CLASSE), 'o contexto tem de ser reconstruído sobre o Guardião')
    .toHaveAttribute('data-classe-ctx', 'Guardião');
  await assentar(page).catch(() => {});

  await proximo(page); // escolha_classe -> ganhos_nivel
  await proximo(page); // ganhos_nivel -> proficiencias_classe_nova (Guardião nível 1 não pede subclasse, ASI, escolhas de classe nem magia)
  await expect(page.locator(STEP_ATIVO), 'o assistente tem de chegar ao step "Proficiências da Classe Nova"')
    .toHaveText('Proficiências da Classe Nova');

  const select = page.locator('#select-pericia-classe-nova');
  await expect(select, 'o seletor de perícia da classe nova precisa estar na tela').toBeVisible();
  // MENOR 3 da revisão final: aqui estava `.not.toContainText('Arcanismo')`,
  // justificado como prova de que a lista do Guardião RESTRINGE. Só que
  // MAGO_5 tem `pericias_proficientes: ['Arcanismo', 'História']` -- Arcanismo
  // sairia do select tanto por estar fora da lista do Guardião QUANTO pelo
  // filtro de já-possuídas. Uma implementação que ignorasse `opcoesPericia`
  // inteiramente passava nessa asserção. Religião também está fora da lista do
  // Guardião (Classes.md:3246) e o personagem NÃO a possui: só a restrição da
  // lista pode tirá-la do select.
  await expect(select, 'Religião não está na lista de perícias do Guardião (Classes.md) -- oferecê-la venderia uma escolha que o livro não dá')
    .not.toContainText('Religião');
  await expect(select, 'Natureza está na lista de perícias do Guardião e não pode faltar no seletor')
    .toContainText('Natureza');

  // A barreira real do produto: "Próximo" nunca trava aqui (só no step da
  // classe -- ver o comentário do cabeçalho). Avança sem escolher nada e
  // tenta confirmar: é em "Confirmar" que validateAll recusa, com um toast
  // nomeando a pendência -- essa é a linha em que TELA e MOTOR precisam
  // concordar.
  await proximo(page); // proficiencias_classe_nova -> revisao_confirmacao
  await expect(page.locator(CONFIRMAR), 'o assistente deveria chegar ao passo de confirmação').toBeVisible();
  await page.locator(CONFIRMAR).click();
  await assentar(page).catch(() => {});
  const erroSemEscolha = await lerToastErro(page);
  expect(erroSemEscolha, 'sem escolher a perícia da classe nova, a confirmação tem de ser recusada nomeando o step')
    .toContain('Proficiências da Classe Nova');
  await expect(page.locator(CONFIRMAR),
    'a recusa não pode fechar o modal -- senão a subida teria sido gravada sem a escolha').toBeVisible();

  // Volta ao step de proficiências e escolhe Natureza.
  await page.locator(ANTERIOR).click();
  await assentar(page).catch(() => {});
  await expect(page.locator(STEP_ATIVO), 'o "Anterior" tem de voltar exatamente ao step de proficiências')
    .toHaveText('Proficiências da Classe Nova');
  await select.selectOption('Natureza');
  await assentar(page).catch(() => {});

  await proximo(page); // proficiencias_classe_nova -> revisao_confirmacao, de novo
  await expect(page.locator(CONFIRMAR)).toBeVisible();
  await page.locator(CONFIRMAR).click();
  await assentar(page).catch(() => {});

  // ESTADO SALVO: expect.poll porque a gravação é assíncrona (mesma
  // corrida documentada em multiclasse-subida.spec.mjs:110-124 e
  // magias-ritual-ficha.spec.mjs:133 -- uma leitura única aqui é
  // exatamente a causa das falhas intermitentes desta suíte).
  await expect.poll(() => personagemSalvo(page).then((p) => p.pericias_proficientes || []),
    { message: 'Natureza, escolhida na tela, tem de ter chegado ao personagem salvo' })
    .toContain('Natureza');
  await expect.poll(() => personagemSalvo(page).then((p) => p.classes.map((c) => `${c.classe} ${c.nivel}`)),
    { message: 'o nível tem de ter entrado no Guardião, com o Mago intacto em 5' })
    .toEqual(['Mago 5', 'Guardião 1']);

  // O cabeçalho da ficha (por trás do modal de resumo) lista as duas
  // classes com seus níveis.
  await expect(page.locator('#char-nome-display').locator('xpath=following-sibling::div[1]'),
    'o cabeçalho da ficha tem de listar as duas classes e o nível total')
    .toHaveText(/Mago 5 \/ Guardião 1\s*·\s*Nível 6/);

  // A ASSERÇÃO QUE PROVA A TASK 2 DE PONTA A PONTA: "Média" só existe
  // porque armadurasDoPersonagem (regras-multiclasse-proficiencias.js)
  // agora une as classes -- o Mago sozinho nunca daria Média, e antes da
  // Task 2 a ficha lia só o espelho `char.classe` (o Mago).
  await expect(grupoProfEquip(page, 'Armaduras:'),
    'a ficha tem de mostrar Média (concedida pelo Guardião, não pelo Mago) na seção de proficiências de equipamento')
    .toContainText('Média');
  await expect(grupoProfEquip(page, 'Armaduras:'),
    'o conjunto reduzido do Guardião (Leve, Média, Escudo) também inclui Leve e Escudo')
    .toContainText('Leve');
  await expect(grupoProfEquip(page, 'Armas:'),
    'a arma Marcial do Guardião também tem de aparecer, unida ao Simples do Mago')
    .toContainText('Marcial');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 2. Mago 5 entra em Bárbaro: nenhuma escolha, mas a armadura muda mesmo
//    assim -- a armadilha do Bárbaro, medida na tela (Ruling 11)
// ============================================================
test('Mago 5 escolhe Bárbaro: o step de proficiências não aparece, e a ficha mostra só Escudo (não Leve/Média) na armadura', async ({ context }) => {
  const id = 'regras-multiclasse-prof-barbaro';
  const { page, erros } = await abrirFicha(context, MAGO_5, id);

  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false }),
    'o assistente de nível não abriu').toBe(true);
  await expect(page.locator(CARD_CLASSE)).toBeVisible();

  await radioClasse(page, 'Bárbaro').click();
  await expect(page.locator(CARD_CLASSE), 'o contexto tem de ser reconstruído sobre o Bárbaro')
    .toHaveAttribute('data-classe-ctx', 'Bárbaro');
  await assentar(page).catch(() => {});

  // Bárbaro como classe NOVA (livro:2385) não concede perícia nem
  // instrumento -- só armas Marciais e Escudo, automáticos. O step
  // 'proficiencias_classe_nova' só é visível quando há pericias>0 ou
  // instrumentos>0 nessa concessão (levelup-flow.js:675-676), então ele
  // não pode estar na barra de progresso NENHUMA vez. Sem este cenário,
  // um step que aparecesse sempre (mesmo sem nada para escolher)
  // travaria a subida de QUALQUER classe nova sem escolha, incluindo o
  // Bárbaro.
  const labelsDaBarra = await page.locator('.levelup-progress .levelup-step-label').allTextContents();
  expect(labelsDaBarra, 'o Bárbaro não concede perícia nem instrumento como classe nova -- o step não pode aparecer na barra de progresso')
    .not.toContain('Proficiências da Classe Nova');

  // Bárbaro nível 1 não tem subclasse nem escolha obrigatória: do passo
  // de ganhos vai direto para a Revisão (mesmo caminho de
  // multiclasse-subida.spec.mjs, cenário 2).
  await proximo(page); // escolha_classe -> ganhos_nivel
  await proximo(page); // ganhos_nivel -> revisao_confirmacao
  await expect(page.locator(STEP_ATIVO), 'sem nada para escolher, o Bárbaro vai direto de "Ganhos do Nível" para a Revisão')
    .toHaveText('Revisão e Confirmação');
  const confirmar = page.locator(CONFIRMAR);
  await expect(confirmar, 'o assistente deveria chegar ao passo de confirmação').toBeVisible();
  await confirmar.click();
  await assentar(page).catch(() => {});

  await expect.poll(() => personagemSalvo(page).then((p) => p.classes.map((c) => `${c.classe} ${c.nivel}`)),
    { message: 'o nível tem de ter entrado no Bárbaro, com o Mago intacto em 5' })
    .toEqual(['Mago 5', 'Bárbaro 1']);

  // A ARMADILHA DO BÁRBARO (Ruling 11): como classe ÚNICA ele daria Leve,
  // Média e Escudo -- como classe NOVA, só Escudo. A arma não discrimina
  // nada aqui (o Mago já dá Simples pelo conjunto COMPLETO, então
  // "Simples" apareceria de qualquer forma) -- é a ARMADURA que prova que
  // o conjunto REDUZIDO foi o que entrou, não o completo.
  const armaduraGroup = grupoProfEquip(page, 'Armaduras:');
  await expect(armaduraGroup,
    'o Bárbaro concede Escudo mesmo como classe nova -- sem isto a união com o Mago (que não dá armadura nenhuma) ficaria vazia')
    .toContainText('Escudo');
  await expect(armaduraGroup,
    'Média só viria do conjunto COMPLETO do Bárbaro (classe única) -- como classe nova ele não concede, e a ficha não pode mostrar')
    .not.toContainText('Média');
  await expect(armaduraGroup,
    'Leve só viria do conjunto COMPLETO do Bárbaro (classe única) -- como classe nova ele não concede, e a ficha não pode mostrar')
    .not.toContainText('Leve');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 3. Mago 5 escolhe Bardo, faz as DUAS escolhas, volta e troca para
//    Guardião: as escolhas velhas não podem sobreviver à troca de classe
//    (IMPORTANTE 4 da revisão final)
// ============================================================
// DOIS BURACOS DE COBERTURA, FECHADOS PELO MESMO CENÁRIO.
//
// (a) O conserto de `createInitialState` (levelup-flow.js) não tinha guarda
//     NENHUMA. `trocarClasseQueSobe` (levelup-ui.js) reseta o state com
//     `Object.assign(state, createInitialState(char), ...)`, e Object.assign
//     só sobrescreve as chaves que a FONTE declara -- enquanto
//     `periciaClasseNova`/`instrumentoClasseNova` não estavam declaradas ali,
//     a escolha feita para uma classe sobrevivia intacta à troca para outra.
//     Foi corrigido, mas apagar as duas linhas de volta deixava 3519 testes
//     de unidade e 311 e2e VERDES: o comentário era a única coisa segurando
//     o conserto.
//
// (b) O Bardo -- a única classe com instrumento, e a única que exige DUAS
//     escolhas simultâneas -- não era dirigido por teste de tela nenhum. Os
//     cenários 1 e 2 cobrem Guardião (1 escolha) e Bárbaro (0). O id
//     `select-instrumento-classe-nova` aparece em TRÊS lugares independentes
//     (levelup-cards.js, e duas vezes em levelup-ui.js: `salvarStateDoDOM` e
//     o bind) e só era conferido por leitura humana -- um erro de digitação
//     em qualquer um dos três dá o modo de falha "tela e motor discordam"
//     com a suíte verde.
//
// A ASSERÇÃO QUE DISCRIMINA é o card de Revisão, não o select. Depois da
// troca para Guardião o select de perícia renderiza VAZIO nos dois mundos
// (com o defeito, "Persuasão" continua em state mas não casa com nenhuma
// <option> do Guardião, e o navegador cai na opção placeholder), então medir
// o select não distinguiria nada. O resumo, sim: ele imprime o que está em
// `state.periciaClasseNova`/`state.instrumentoClasseNova` -- com o defeito,
// a Revisão do Guardião anuncia uma perícia de Bardo e um Instrumento
// Musical que o Guardião nem concede.
//
// De quebra, a primeira metade deste cenário é a guarda do IMPORTANTE 3: o
// card de Revisão passou a listar as duas escolhas, que até então eram as
// únicas gravações sem desfazer que o último resumo antes do "Confirmar"
// não nomeava.
test('Mago 5 escolhe Bardo, faz as duas escolhas e troca para Guardião: as escolhas velhas não sobrevivem à troca', async ({ context }) => {
  const id = 'regras-multiclasse-prof-bardo-troca';
  const { page, erros } = await abrirFicha(context, MAGO_5, id);

  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false }),
    'o assistente de nível não abriu').toBe(true);
  await expect(page.locator(CARD_CLASSE)).toBeVisible();

  await radioClasse(page, 'Bardo').click();
  await expect(page.locator(CARD_CLASSE), 'o contexto tem de ser reconstruído sobre o Bardo')
    .toHaveAttribute('data-classe-ctx', 'Bardo');
  await assentar(page).catch(() => {});

  // --- As DUAS escolhas do Bardo, na tela ---
  await irParaStep(page, 'Proficiências da Classe Nova');
  const selectPericia = page.locator('#select-pericia-classe-nova');
  const selectInstrumento = page.locator('#select-instrumento-classe-nova');
  await expect(selectPericia, 'o Bardo concede 1 perícia (Classes.md:366)').toBeVisible();
  await expect(selectInstrumento,
    'o Bardo é a ÚNICA classe do sub-projeto que concede Instrumento Musical -- se este select some, ' +
    'o id divergiu entre levelup-cards.js e levelup-ui.js e ninguém mais notaria')
    .toBeVisible();
  // Persuasão está FORA da lista do Guardião e o personagem não a possui:
  // é o valor que torna a troca de classe medível mais adiante.
  await expect(selectPericia,
    'o Bardo escolhe "uma perícia à sua escolha" -- sem lista, então Persuasão tem de estar oferecida')
    .toContainText('Persuasão');
  await selectPericia.selectOption('Persuasão');
  await selectInstrumento.selectOption('Alaúde');
  await assentar(page).catch(() => {});

  // --- IMPORTANTE 3: a Revisão nomeia as duas escolhas ---
  await irParaStep(page, 'Revisão e Confirmação');
  const resumo = page.locator('#levelup-step-body');
  await expect(resumo,
    'a perícia da classe nova é gravada por um caminho SEM DESFAZER -- o último resumo antes do ' +
    '"Confirmar" tem de nomeá-la, senão o jogador confirma sem ver o que escolheu')
    .toContainText('Persuasão');
  await expect(resumo, 'o Instrumento Musical escolhido também tem de aparecer no resumo')
    .toContainText('Alaúde');

  // --- A TROCA DE CLASSE, com escolha já feita ---
  await irParaStep(page, 'Classe do Nível');
  await radioClasse(page, 'Guardião').click();
  await expect(page.locator(CARD_CLASSE), 'o contexto tem de ser reconstruído sobre o Guardião')
    .toHaveAttribute('data-classe-ctx', 'Guardião');
  await assentar(page).catch(() => {});

  // O step continua existindo (Guardião também concede perícia), mas sem
  // instrumento -- e sem nada preenchido.
  await irParaStep(page, 'Proficiências da Classe Nova');
  await expect(page.locator('#select-pericia-classe-nova')).toBeVisible();
  await expect(page.locator('#select-instrumento-classe-nova'),
    'Guardião não concede Instrumento Musical -- o select do Bardo não pode sobreviver à troca')
    .toHaveCount(0);

  // A MEDIDA DE (a): o resumo do Guardião não pode carregar nada do Bardo.
  await irParaStep(page, 'Revisão e Confirmação');
  await expect(resumo,
    'Persuasão foi escolhida para o BARDO e não está na lista do Guardião -- se ela sobrevive à troca, ' +
    'createInitialState voltou a não declarar `periciaClasseNova` e Object.assign não a reseta')
    .not.toContainText('Persuasão');
  await expect(resumo,
    'o Guardião não concede Instrumento Musical nenhum -- o Alaúde do Bardo não pode aparecer no resumo dele')
    .not.toContainText('Alaúde');

  // E a barreira do produto continua de pé: sem escolher a perícia do
  // Guardião, "Confirmar" recusa nomeando o step.
  await page.locator(CONFIRMAR).click();
  await assentar(page).catch(() => {});
  expect(await lerToastErro(page),
    'depois da troca a escolha tem de voltar a ser exigida, para a classe NOVA')
    .toContain('Proficiências da Classe Nova');
  await expect(page.locator(CONFIRMAR),
    'a recusa não pode fechar o modal').toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
