// ============================================================
// Tarefa 7 (sub-projeto 5): o step "Classe do Nível" -- a tela que torna
// multiclasse ALCANÇÁVEL. Todo o resto do sub-projeto (o motor
// `subirDeNivel`, o contexto `buildLevelUpContext`, a fiação do estado)
// já sabia receber a classe em que o nível entra, mas nenhuma tela
// permitia escolher: até aqui era tudo no-op.
//
// O que cada cenário abaixo protege:
//
// 1. CLASSE ÚNICA NÃO MUDA. O step é o novo primeiro passo do assistente,
//    mas com uma classe só a resposta já vem marcada -- o jogador clica
//    "Próximo" e cai em "Ganhos do Nível" como sempre, sem escolha nova.
//    Sem este cenário, um seletor que exigisse resposta de TODO MUNDO
//    passaria despercebido.
// 2. MULTICLASSE DE VERDADE. O caminho completo: um Mago 5 escolhe
//    Bárbaro, conclui, e o personagem SALVO fica Mago 5 / Bárbaro 1 com o
//    PV do d12 (o dado da classe que sobe, não o d6 do Mago). Mede o
//    estado gravado, não só a tela.
// 3. NADA PRÉ-SELECIONADO COM DUAS CLASSES. A assimetria é deliberada:
//    pré-selecionar uma resposta num personagem que JÁ é multiclasse faz
//    dois cliques em "Avançar" subirem a classe errada, e não existe
//    descer de nível. Por isso "Próximo" nasce desabilitado.
// 4. CLASSE TRAVADA. O 13+ do livro:2033 vale para se qualificar a uma
//    classe NOVA. Um Mago com Carisma 11 vê Paladino travado, com o
//    motivo escrito na tela -- travar sem dizer por quê não ensina nada.
// 5. TELA E MOTOR CONCORDAM. Um nível de SEGUNDA classe que exige escolha
//    (Guerreiro 3/Mestre da Batalha, 3 manobras) tem de CONCLUIR. Este é o
//    cenário que pega o desacordo em que a tela pede uma escolha e o motor
//    a descarta -- recusa muda, com o card preenchido.
//
// `abrirModalLevelUp` é chamado com `{ pularEscolhaDeClasse: false }` em
// todos eles: o padrão do helper pula esse step justamente para as outras
// specs, e aqui ele É o objeto da medição.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, NOVO, abrirFicha, abrirModalLevelUp, assentar, personagemSalvo } from './helpers-regras.mjs';

const CARD_CLASSE = '#levelup-escolha-classe';
const PROXIMO = '#btn-step-proximo';
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

// Mago 5: 5 níveis já são suficientes para o cabeçalho da ficha mostrar
// "Mago 5 / Bárbaro 1" depois da subida (com uma classe só o número não
// aparece), e Inteligência 13 em ATRIBUTOS_REGRAS mantém o Mago
// qualificado como classe ATUAL para qualquer entrada nova.
const MAGO_5 = {
  classe: 'Mago', subclasse: '', nivel: 5, xp: 6500,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
};

// ============================================================
// 1. Classe única: o step existe, já vem respondido, e não atrapalha
// ============================================================
// ÂNCORA -- NÃO APAGUE NEM ENFRAQUEÇA ESTE CENÁRIO SEM SUBSTITUIR A REDE.
// `abrirModalLevelUp` (helpers-regras.mjs) volta EM SILÊNCIO quando
// `#levelup-escolha-classe` não está no DOM. Se o step 'escolha_classe'
// parar de renderizar por regressão, as ~13 specs que dirigem o assistente
// por aquele helper continuam TODAS verdes -- elas voltariam a medir o
// modal de antes, sem sinal nenhum. Este cenário é o único que abre com
// `{ pularEscolhaDeClasse: false }` e EXIGE o card no DOM: é ele que
// guarda a existência do step para todas as outras.
test('classe única: o step "Classe do Nível" já vem com a classe marcada e "Próximo" leva a "Ganhos do Nível"', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_5, 'regras-5-t7-classe-unica');
  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false }),
    'o assistente de nível não abriu').toBe(true);

  // GUARDA CONTRA VACUIDADE: o card tem de estar na tela antes de
  // qualquer afirmação sobre o que ele mostra.
  await expect(page.locator(CARD_CLASSE), 'o card do step da classe precisa estar visível').toBeVisible();
  await expect(page.locator(STEP_ATIVO), 'o assistente tem de ABRIR no step da classe')
    .toHaveText('Classe do Nível');

  await expect(radioClasse(page, 'Mago'),
    'com uma classe só, ela já vem marcada -- o jogador não escolhe nada de novo').toBeChecked();
  await expect(page.locator(CARD_CLASSE),
    'o contexto do assistente foi montado sobre a única classe do personagem')
    .toHaveAttribute('data-classe-ctx', 'Mago');
  await expect(page.locator(`${CARD_CLASSE} input[name="classe-que-sobe"]:checked`),
    'exatamente uma opção pode estar marcada').toHaveCount(1);
  await expect(page.locator(PROXIMO),
    'com a classe já marcada o step nasce completo e "Próximo" fica habilitado').toBeEnabled();

  await proximo(page);
  await expect(page.locator(STEP_ATIVO), '"Próximo" tem de levar direto a "Ganhos do Nível"')
    .toHaveText('Ganhos do Nível');
  await expect(page.locator(CARD_CLASSE), 'o card da classe sai da tela ao avançar').toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 2. Multiclasse de verdade: Mago 5 sobe um nível de Bárbaro
// ============================================================
test('Mago 5 escolhe Bárbaro: a ficha vira "Mago 5 / Bárbaro 1 · Nível 6" e o PV sobe pelo d12', async ({ context }) => {
  const id = 'regras-5-t7-mago-vira-barbaro';
  const { page, erros } = await abrirFicha(context, MAGO_5, id);
  const antes = await personagemSalvo(page);
  expect(antes.nivel, 'controle: o personagem começa no nível 5').toBe(5);
  // A SEMENTE grava `pv_max: 0` (store.js:321): quem calcula o PV é a
  // ficha, ao abrir, e essa gravação é ASSÍNCRONA. Ler o valor de uma vez
  // só era uma corrida -- sob a carga da suíte cheia o 0 da semente vencia
  // e a asserção lá embaixo acusava um d12 errado (delta 41) com o PV do
  // produto certo o tempo todo. Mesmo motivo do `expect.poll` em
  // magias-ritual-ficha.spec.mjs:133.
  //
  // Espera-se o valor FECHADO do Mago 5 -- d6, CON 14 (+2):
  // (6+2) + 4*(4+2) = 32 -- e não um "qualquer coisa > 0": assim a linha
  // de base é ela própria um oráculo, e um PV inicial errado falha aqui,
  // com o nome certo, em vez de virar um delta enganoso no fim do teste.
  await expect.poll(() => personagemSalvo(page).then((p) => p.pv_max), {
    message: 'a ficha precisa ter calculado e gravado o PV do Mago 5 (32) antes de medir a subida',
  }).toBe(32);

  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false })).toBe(true);
  await expect(page.locator(CARD_CLASSE)).toBeVisible();

  // Bárbaro exige Força 13 (livro:2361) e o Mago atual exige Inteligência
  // 13 -- ATRIBUTOS_REGRAS atende aos dois, então a opção é selecionável.
  await expect(radioClasse(page, 'Bárbaro'),
    'Bárbaro precisa aparecer como classe NOVA selecionável').toBeEnabled();
  await radioClasse(page, 'Bárbaro').click();
  // Espera o RE-RENDER: `data-classe-ctx` só passa a "Bárbaro" quando o
  // contexto terminou de ser reconstruído sobre a classe escolhida (ver
  // renderCardEscolhaClasse). Avançar antes disso mediria a tela antiga.
  await expect(page.locator(CARD_CLASSE), 'o contexto tem de ser reconstruído sobre o Bárbaro')
    .toHaveAttribute('data-classe-ctx', 'Bárbaro');
  await assentar(page).catch(() => {});

  // O contexto foi RECONSTRUÍDO sobre o Bárbaro: o card de PV do passo
  // seguinte tem de falar em d12, não no d6 do Mago. Sem esta asserção o
  // teste passaria mesmo se a tela continuasse inteira montada no Mago e
  // só a gravação final mudasse de classe.
  await proximo(page);
  await expect(page.locator('#levelup-step-body'), 'os ganhos têm de ser lidos na tabela do Bárbaro (d12)')
    .toContainText('d12');

  // Bárbaro nível 1 não tem subclasse nem escolha obrigatória: do passo de
  // ganhos vai direto para a Revisão.
  await proximo(page);
  const confirmar = page.locator('#btn-confirmar-levelup');
  await expect(confirmar, 'o assistente deveria chegar ao passo de confirmação').toBeVisible();
  // A Revisão nomeia a classe -- é a última tela antes de uma escrita que
  // não dá para desfazer, e o título/botão só falam do nível TOTAL. Numa
  // classe NOVA o texto diz isso, em vez de um "Bárbaro 0 → Bárbaro 1".
  await expect(page.locator('#levelup-step-body'),
    'a Revisão tem de nomear a classe em que o nível entra')
    .toContainText('Bárbaro 1 (classe nova)');
  await confirmar.click();
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo.nivel, 'o nível TOTAL vai a 6').toBe(6);
  expect(salvo.classes.map((c) => `${c.classe} ${c.nivel}`),
    'o nível tem de ter entrado no Bárbaro, com o Mago intacto em 5')
    .toEqual(['Mago 5', 'Bárbaro 1']);
  expect(salvo.classe, 'o espelho continua apontando para a classe INICIAL').toBe('Mago');
  // d12: média do app = floor(12/2) + 1 + modCON = 6 + 1 + 2 = 9, sobre os
  // 32 já medidos acima. Pelo d6 do Mago o ganho seria 3 + 1 + 2 = 6 (38) --
  // é esta diferença que prova que o dado de vida veio da classe que SUBIU,
  // não da inicial. Valor ABSOLUTO em vez de delta: um delta pode dar 9 a
  // partir de uma base errada, 41 só se as duas pontas estiverem certas.
  expect(salvo.pv_max, 'o PV tem de subir pelo d12 do Bárbaro (32 + 9 = 41), não pelo d6 do Mago (32 + 6 = 38)').toBe(41);

  // O cabeçalho da ficha (já re-renderizado por trás do modal de resumo)
  // passa a listar as DUAS classes com seus níveis.
  await expect(page.locator('#char-nome-display').locator('xpath=following-sibling::div[1]'),
    'o cabeçalho da ficha tem de listar as duas classes e o nível total')
    .toHaveText(/Mago 5 \/ Bárbaro 1\s*·\s*Nível 6/);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 3. Duas classes: nada vem marcado, e "Próximo" fica travado
// ============================================================
const MAGO_5_BARBARO_1 = [
  { classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Bárbaro', subclasse: '', nivel: 1, ordem: 1 },
];

test('duas classes: nada vem pré-selecionado e "Próximo" só destrava depois da escolha', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    // Espelhos preenchidos com o que `sincronizarEspelhos()` produziria:
    // a classe INICIAL e o nível TOTAL.
    classe: 'Mago', subclasse: '', nivel: 6, xp: 14000,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Arcanismo', 'História'],
    classes: MAGO_5_BARBARO_1,
    schema_versao: 2,
  }, 'regras-5-t7-duas-classes');

  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false })).toBe(true);
  await expect(page.locator(CARD_CLASSE), 'o card do step da classe precisa estar visível').toBeVisible();

  // As duas classes atuais aparecem, e NENHUMA marcada.
  await expect(radioClasse(page, 'Mago'), 'a classe inicial precisa estar na lista').toHaveCount(1);
  await expect(radioClasse(page, 'Bárbaro'), 'a segunda classe precisa estar na lista').toHaveCount(1);
  await expect(page.locator(`${CARD_CLASSE} input[name="classe-que-sobe"]:checked`),
    'com duas classes nada pode vir marcado -- escolher pelo jogador subiria a classe errada')
    .toHaveCount(0);
  await expect(page.locator(PROXIMO),
    'sem classe escolhida, "Próximo" tem de estar desabilitado').toBeDisabled();

  // O clique direto na barra de progresso também não pode escapar do step
  // -- é o OUTRO caminho de navegação, e o botão desabilitado não o cobre.
  const ultimoStep = page.locator('.levelup-step[data-step-idx]').last();
  await expect(ultimoStep, 'a barra de progresso precisa ter mais de um step para o teste valer algo')
    .not.toHaveAttribute('data-step-idx', '0');
  await ultimoStep.click();
  await assentar(page).catch(() => {});
  await expect(page.locator(STEP_ATIVO), 'nem pela barra de progresso se pula a escolha da classe')
    .toHaveText('Classe do Nível');

  // Escolher destrava.
  await radioClasse(page, 'Bárbaro').click();
  await expect(page.locator(CARD_CLASSE), 'o contexto tem de ser reconstruído sobre o Bárbaro')
    .toHaveAttribute('data-classe-ctx', 'Bárbaro');
  await assentar(page).catch(() => {});
  await expect(page.locator(PROXIMO), 'escolhida a classe, "Próximo" destrava').toBeEnabled();
  await expect(radioClasse(page, 'Bárbaro'), 'a escolha do jogador tem de sobreviver ao re-render').toBeChecked();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 4. Classe travada pelo pré-requisito de atributo
// ============================================================
// Carisma 11 é o único desvio de ATRIBUTOS_REGRAS aqui: Paladino pede
// Força E Carisma 13+ (livro:2361), a Força continua 15, então o motivo
// exibido tem de ser SÓ o Carisma.
const MAGO_5_CARISMA_11 = {
  classe: 'Mago', subclasse: '', nivel: 5, xp: 6500,
  especie: 'Humano',
  atributos: { ...ATRIBUTOS_REGRAS, carisma: 11 },
  pericias_proficientes: ['Arcanismo', 'História'],
};

test('classe travada: Paladino aparece com o motivo "Carisma 11, precisa 13" e não é selecionável', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_5_CARISMA_11, 'regras-5-t7-classe-travada');
  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false })).toBe(true);
  await expect(page.locator(CARD_CLASSE), 'o card do step da classe precisa estar visível').toBeVisible();

  const paladino = radioClasse(page, 'Paladino');
  await expect(paladino, 'Paladino continua LISTADO -- esconder a opção não ensina o que falta').toHaveCount(1);
  await expect(paladino, 'sem Carisma 13 o Paladino não pode ser escolhido').toBeDisabled();
  await expect(page.locator(`${CARD_CLASSE} label`, { hasText: 'Paladino' }),
    'o motivo do bloqueio tem de estar escrito ao lado da opção')
    .toContainText('Carisma 11, precisa 13');

  // Controle na MESMA tela: Bárbaro só pede Força 13, que este personagem
  // tem -- sem ele, um card que travasse TODA classe nova passaria aqui.
  await expect(radioClasse(page, 'Bárbaro'),
    'Bárbaro pede só Força 13, que o personagem tem: não pode estar travado').toBeEnabled();
  // E a própria classe do personagem nunca é barrada (livro:2033 é sobre
  // qualificar-se a uma classe NOVA).
  await expect(radioClasse(page, 'Mago'),
    'a classe que o personagem já tem nunca pode travar').toBeEnabled();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 4b. Tarefa 8: o escape do pré-requisito -- "usar mesmo assim"
// ============================================================
// Mesmo personagem do cenário 4 (Paladino travado por Carisma 11). Aqui o
// jogador dispensa o pré-requisito explicitamente: a confirmação nomeia o
// que falta e avisa da marca permanente, a classe travada passa a ser
// aceita, e a subida completa deixa a dispensa registrada -- tanto no
// personagem salvo (`edicoes.campos`) quanto no selo do cabeçalho da ficha.
test('classe travada: "usar mesmo assim" dispensa o pré-requisito e marca a ficha permanentemente', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_5_CARISMA_11, 'regras-5-t8-dispensa-prerequisito');
  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false })).toBe(true);
  await expect(page.locator(CARD_CLASSE)).toBeVisible();

  const paladino = radioClasse(page, 'Paladino');
  await expect(paladino, 'controle: Paladino continua travado').toBeDisabled();

  // O botão "usar mesmo assim" nasce ao lado do motivo do bloqueio.
  const btnUsarMesmoAssim = page.locator(`${CARD_CLASSE} button[data-dispensar="Paladino"]`);
  await expect(btnUsarMesmoAssim, 'o botão de dispensa tem de estar visível e habilitado').toBeEnabled();
  await btnUsarMesmoAssim.click();

  // A confirmação nomeia o que falta e avisa da marca permanente -- não é
  // um clique único sem aviso nenhum.
  const confirmacao = page.locator('.sub-modal-overlay');
  await expect(confirmacao, 'a confirmação tem de abrir').toBeVisible();
  await expect(confirmacao, 'tem de nomear o que falta, como o card já faz').toContainText('Carisma');
  await expect(confirmacao, 'tem de avisar que a marca é permanente').toContainText('permanentemente');

  const btnConfirmar = page.locator('#btn-confirmar-dispensa-prerequisito');
  await expect(btnConfirmar).toBeVisible();
  await btnConfirmar.click();
  await assentar(page).catch(() => {});

  // A confirmação fechou, o contexto foi reconstruído sobre o Paladino
  // (mesmo travado), e "Próximo" destrava.
  await expect(confirmacao, 'a confirmação fecha ao confirmar').toHaveCount(0);
  await expect(page.locator(CARD_CLASSE), 'o contexto tem de ser reconstruído sobre o Paladino')
    .toHaveAttribute('data-classe-ctx', 'Paladino');
  await expect(paladino, 'a classe dispensada fica marcada mesmo continuando travada').toBeChecked();
  await expect(page.locator(PROXIMO), 'a dispensa destrava "Próximo"').toBeEnabled();
  // Achado Minor da revisão final: o card era re-renderizado ainda com o
  // cadeado e o botão "usar mesmo assim", e o ÚNICO retorno visual da
  // dispensa era o "Próximo" destravando. Agora a linha diz o que houve.
  await expect(page.locator(`${CARD_CLASSE} [data-prerequisito-dispensado="Paladino"]`),
    'o card tem de avisar que o pré-requisito foi dispensado, e nomear o que faltava')
    .toContainText('pré-requisito dispensado');
  await expect(page.locator(`${CARD_CLASSE} [data-prerequisito-dispensado="Paladino"]`),
    'o motivo continua escrito ao lado do aviso').toContainText('Carisma 11');
  await expect(page.locator(`${CARD_CLASSE} button[data-dispensar="Paladino"]`),
    'o botão "usar mesmo assim" sai da tela depois de usado').toHaveCount(0);

  // Paladino nível 1 não tem subclasse nem ASI: do passo de ganhos vai
  // direto para a Revisão, como o Bárbaro do cenário 2.
  await proximo(page);
  await proximo(page);
  const confirmar = page.locator('#btn-confirmar-levelup');
  await expect(confirmar, 'o assistente deveria chegar ao passo de confirmação').toBeVisible();
  await expect(page.locator('#levelup-step-body'),
    'a Revisão tem de nomear a classe em que o nível entra')
    .toContainText('Paladino 1 (classe nova)');
  await confirmar.click();
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo.classes.map((c) => `${c.classe} ${c.nivel}`),
    'o nível tem de ter entrado no Paladino, mesmo dispensado').toEqual(['Mago 5', 'Paladino 1']);
  const marca = salvo.edicoes?.campos?.['prerequisitoDispensado.Paladino'];
  expect(marca, 'a dispensa fica registrada no personagem salvo').toBeTruthy();
  expect(marca.faltando?.some((f) => f.atributo === 'Carisma' && f.valor === 11),
    'a marca nomeia o que faltava, não só que algo faltou').toBe(true);

  // O cabeçalho da ficha (por trás do modal de resumo) mostra o selo.
  await expect(page.locator('#char-nome-display').locator('xpath=following-sibling::div[1]'),
    'o cabeçalho tem de exibir o selo de pré-requisito dispensado')
    .toContainText('pré-requisito dispensado');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 5. O ACORDO TELA x MOTOR: manobras num nível de SEGUNDA classe
// ============================================================
// Achado da revisão (Important 1). Antes da correção em
// `levelup-validations.js:precisaManobrasAgora`, este caminho falhava
// MUDO: o step de manobras renderizava (o step lê `ctx.classeQueSobe` /
// `ctx.nivelNaClasseNovo`), o jogador escolhia as 3, e então
// `collectOpcoes` DESCARTAVA `manobras_novas` porque lia o espelho
// `char.classe` -- que num Mago 5/Guerreiro 2 diz "Mago". `subirDeNivel`
// recusava por pendência de manobra, e `validateAll` pulava a própria
// checagem pelo mesmo motivo: o modal simplesmente não fechava, com o
// card preenchido na tela e nenhuma mensagem dizendo o quê.
//
// Este cenário é o espelho multiclasse de
// `subclasse-escolha.spec.mjs` ("Guerreiro escolhe Mestre da Batalha e as
// 3 manobras do nível 3"), que cobre o mesmo nível em classe ÚNICA. Os
// dois juntos provam que tela e motor concordam nos dois casos.
const MAGO_5_GUERREIRO_2 = [
  { classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Guerreiro', subclasse: '', nivel: 2, ordem: 1 },
];

test('Mago 5/Guerreiro 2 sobe para Guerreiro 3: as manobras do Mestre da Batalha chegam ao motor e a subida conclui', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', subclasse: '', nivel: 7, xp: 23000,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Arcanismo', 'História'],
    classes: MAGO_5_GUERREIRO_2,
    schema_versao: 2,
  }, 'regras-5-t7-manobras-multiclasse');

  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false })).toBe(true);
  await expect(page.locator(CARD_CLASSE)).toBeVisible();

  // Escolhe GUERREIRO (o nível vai para a segunda classe, 2 -> 3).
  await radioClasse(page, 'Guerreiro').click();
  await expect(page.locator(CARD_CLASSE), 'o contexto tem de ser reconstruído sobre o Guerreiro')
    .toHaveAttribute('data-classe-ctx', 'Guerreiro');
  await assentar(page).catch(() => {});

  // Ganhos -> escolha de subclasse (Guerreiro 3 é onde ela nasce).
  await proximo(page);
  await proximo(page);
  const mdb = page.locator('[data-subclasse="Mestre da Batalha"]');
  await expect(mdb, 'o nível 3 DE GUERREIRO tem de pedir a subclasse de Guerreiro').toBeVisible();
  await mdb.click();
  await assentar(page).catch(() => {});

  // Estudioso da Guerra (Classes.md:4061) levanta duas escolhas num step
  // próprio, antes do de manobras -- mesma navegação de
  // subclasse-escolha.spec.mjs.
  await proximo(page);
  const estudiosoFerramenta = page.locator('[data-subclasse-escolha="subclasse_estudioso_ferramenta"]');
  if (await estudiosoFerramenta.count()) {
    await estudiosoFerramenta.selectOption('Ferramentas de Ferreiro');
    await page.locator('[data-subclasse-escolha="subclasse_estudioso_pericia"]').selectOption('Percepção');
    await proximo(page);
  }

  // O card de manobras aparece -- e é pelo nível NA CLASSE (Guerreiro 3),
  // não pelo total (8), que não concede manobra nenhuma.
  await expect(page.locator('.levelup-card-header', { hasText: 'Novas Manobras (+3)' }),
    'Guerreiro 3/Mestre da Batalha concede 3 manobras (Classes.md:4067)').toBeVisible();
  await page.locator('#btn-lvlup-manobras').click();
  const checks = page.locator('[data-grid-manobra-check]');
  await expect(checks.first()).toBeVisible();
  const candidatas = await checks.evaluateAll((els) => els.map((el) => el.dataset.gridManobraCheck));
  const escolhidas = candidatas.slice(0, 3);
  expect(escolhidas.length, 'o grid não ofereceu 3 candidatas').toBe(3);
  for (const nome of escolhidas) {
    await page.locator(`[data-grid-manobra-check="${nome}"]`).click();
  }
  await expect(page.locator('#grid-manobra-sel-count')).toHaveText('3');
  await page.locator('.sub-modal-overlay button', { hasText: 'Confirmar Seleção' }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('#lvlup-manobras-resumo')).toContainText('3/3');

  // Revisão: nomeia a CLASSE em que o nível entra (achado Minor da
  // revisão -- o título e o botão só falam do nível total).
  await proximo(page);
  await expect(page.locator('#levelup-step-body'),
    'a última tela antes de uma escrita irreversível tem de nomear a classe')
    .toContainText('Guerreiro 2 → Guerreiro 3');

  await page.locator('#btn-confirmar-levelup').click();
  await page.waitForTimeout(800);

  // ESTA é a asserção que falhava antes da correção: o modal não fechava,
  // porque subirDeNivel recusava por pendência de manobra que a tela já
  // tinha respondido.
  await expect(page.locator('#btn-confirmar-levelup'),
    'a subida foi recusada mesmo com as 3 manobras escolhidas na tela -- tela e motor discordam')
    .toHaveCount(0);

  const salvo = await personagemSalvo(page);
  expect(salvo.nivel, 'o nível TOTAL vai a 8').toBe(8);
  expect(salvo.classes.map((c) => `${c.classe} ${c.nivel}`),
    'o nível tem de ter entrado no Guerreiro').toEqual(['Mago 5', 'Guerreiro 3']);
  expect(salvo.classes.find((c) => c.classe === 'Guerreiro').subclasse,
    'a subclasse foi gravada na entrada do GUERREIRO, não no espelho do Mago')
    .toBe('Mestre da Batalha');
  expect([...(salvo.manobras_conhecidas || [])].sort(),
    'as 3 manobras escolhidas na tela precisam ter chegado ao personagem salvo')
    .toEqual([...escolhidas].sort());

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 6. SEGUNDA CLASSE CONJURADORA -- o cenário que faltava
// ============================================================
// Achado da revisão final (Important 2): os cinco cenários acima abrem
// Bárbaro, Paladino 1 e Guerreiro 3 -- nenhum abre uma classe que passe a
// conceder ESPAÇO DE MAGIA. Foi por esse buraco que o Critical (a ficha
// apagava as magias sempre preparadas da segunda classe ao reabrir) e o
// Important 1 (o mapa `classesData` da abertura não conhece a classe
// recém-aberta) passaram por onze tarefas revisadas e 304 specs verdes.
//
// Este cenário mede as DUAS telas que ninguém media:
//
//   a) a ficha re-renderizada LOGO DEPOIS da subida, sem recarregar --
//      é aqui que `classesData` estava obsoleto e o Mago recém-aberto
//      aparecia sem espaços, sem características e sem subclasse;
//   b) a MESMA ficha depois de um recarregamento de verdade -- é aqui que
//      a cadeia de migração de abertura roda e onde a perda de dado
//      acontecia.
//
// 2 espaços de 1º círculo é a tabela de conjuração para 1 nível de
// conjurador pleno (livro:2050), literal.
const BARBARO_5 = {
  classe: 'Bárbaro', subclasse: '', nivel: 5, xp: 6500,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'Sobrevivência'],
};

test('Bárbaro 5 abre Mago 1: o Grimório chega com SEIS magias, os 2 espaços de 1º círculo aparecem na hora e sobrevivem ao recarregamento', async ({ context }) => {
  const id = 'regras-5-revisao-barbaro-abre-mago';
  const { page, erros } = await abrirFicha(context, BARBARO_5, id);

  // CONTROLE: antes da subida não há espaço de magia nenhum na ficha --
  // sem isto, uma ficha que já mostrasse espaços por outro motivo faria a
  // asserção seguinte passar por coincidência.
  await expect(page.locator('[data-slot-circ]'),
    'controle: um Bárbaro 5 não tem espaço de magia nenhum').toHaveCount(0);

  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false })).toBe(true);
  await expect(page.locator(CARD_CLASSE)).toBeVisible();

  // Mago exige Inteligência 13 e o Bárbaro atual exige Força 13
  // (livro:2361) -- ATRIBUTOS_REGRAS atende aos dois.
  await expect(radioClasse(page, 'Mago'),
    'Mago precisa aparecer como classe NOVA selecionável').toBeEnabled();
  await radioClasse(page, 'Mago').click();
  await expect(page.locator(CARD_CLASSE), 'o contexto tem de ser reconstruído sobre o Mago')
    .toHaveAttribute('data-classe-ctx', 'Mago');
  await assentar(page).catch(() => {});

  // Ganhos do Nível -> passo de magias. O Mago 1 concede 3 truques, e é
  // pelo nível NA CLASSE (Mago 1) que essa conta sai -- pelo total (6) o
  // Mago teria 4. MEDIDO: sem responder a este passo, `validateAll`
  // recusa a confirmação com o toast "Selecione 3 truque(s)." e a subida
  // não acontece; o passo não trava o "Próximo" (a validação é no
  // confirmar, como em todo o assistente).
  await proximo(page);
  await proximo(page);
  await expect(page.locator('#lvlup-truques-resumo'),
    'Mago 1 pede 3 truques -- a conta é pelo nível NA CLASSE, não pelo total')
    .toContainText('Selecione 3');
  await page.locator('#btn-lvlup-truques').click();
  await assentar(page).catch(() => {});
  const truques = page.locator('#grid-magias [data-grid-circulo="0"] [data-grid-nome]');
  await expect(truques.first(), 'o grid de truques tem de oferecer a lista do Mago').toBeVisible();
  const nomesTruques = (await truques.evaluateAll((els) => els.map((el) => el.dataset.gridNome))).slice(0, 3);
  expect(nomesTruques.length, 'o grid não ofereceu 3 truques de Mago').toBe(3);
  // O listener de seleção vive no `[data-grid-check]`, não no card
  // inteiro (levelup-ui.js) -- clicar no card não marca nada.
  for (const nome of nomesTruques) {
    await page.locator(`#grid-magias [data-grid-check="${nome}"]`).click();
  }
  await page.locator('.sub-modal-overlay button', { hasText: 'Confirmar Seleção' }).click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#lvlup-truques-resumo'), 'os 3 truques têm de ficar registrados no card')
    .toContainText('3/3');

  // Grimório do Mago (residuo-1): o 1º nível DE MAGO -- alcançado aqui só
  // porque é multiclasse (o 1º nível de um Mago de classe única vem da
  // criação, nunca deste assistente) -- concede o Livro de Magias com SEIS
  // magias de 1º círculo (Classes.md, característica Conjuração), não as
  // duas dos níveis seguintes. Antes da correção este card nem aparecia
  // (`ehMago` exigia nivelNaClasseNovo > 1) e a subida concluía com
  // `char.grimorio` vazio para sempre -- sem NADA na tela avisando.
  await expect(page.locator('.levelup-card-header', { hasText: 'Grimório' }),
    'o card do Grimório tem de anunciar SEIS magias, não duas')
    .toContainText('Grimório: +6 Magia');
  await expect(page.locator('#lvlup-grimorio-resumo'),
    'o Grimório do 1º nível de Mago pede 6, não 2')
    .toContainText('Selecione 6');
  await page.locator('#btn-lvlup-grimorio').click();
  await assentar(page).catch(() => {});
  // O grupo do 1º círculo nasce FECHADO (o `<details>` só abre sozinho
  // para truques -- circulo 0 -- ou com busca digitada; ver abrirGridSelecao,
  // levelup-ui.js). Sem abrir, os cartões de magia ficam ocultos e os
  // cliques abaixo não acham nada visível.
  await page.locator('#grid-magias details[data-grid-circulo="1"] summary').click();
  await assentar(page).catch(() => {});
  const magiasGrimorio = page.locator('#grid-magias [data-grid-nome]');
  await expect(magiasGrimorio.first(), 'o grid de magias tem de oferecer a lista de 1º círculo do Mago').toBeVisible();
  const nomesGrimorio = (await magiasGrimorio.evaluateAll((els) => els.map((el) => el.dataset.gridNome))).slice(0, 6);
  expect(nomesGrimorio.length, 'o grid não ofereceu 6 magias de Mago para o Grimório').toBe(6);
  for (const nome of nomesGrimorio) {
    await page.locator(`#grid-magias [data-grid-check="${nome}"]`).click();
  }
  await page.locator('.sub-modal-overlay button', { hasText: 'Confirmar Seleção' }).click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#lvlup-grimorio-resumo'), 'as 6 magias têm de ficar registradas no card')
    .toContainText('6/6');

  // Revisão.
  const confirmar = page.locator('#btn-confirmar-levelup');
  for (let i = 0; i < 4 && !(await confirmar.count()); i++) {
    expect(await page.locator(PROXIMO).isEnabled().catch(() => false),
      `o assistente travou no step "${await page.locator(STEP_ATIVO).textContent().catch(() => '?')}"`)
      .toBe(true);
    await proximo(page);
  }
  await expect(confirmar, 'o assistente deveria chegar ao passo de confirmação').toBeVisible();
  await expect(page.locator('#levelup-step-body'),
    'a Revisão tem de nomear a classe em que o nível entra')
    .toContainText('Mago 1 (classe nova)');
  await confirmar.click();
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo.classes.map((c) => `${c.classe} ${c.nivel}`),
    'o nível tem de ter entrado no Mago, com o Bárbaro intacto em 5')
    .toEqual(['Bárbaro 5', 'Mago 1']);

  // O DADO GRAVADO, não só a tela: `char.grimorio` tem de ter as MESMAS
  // seis magias clicadas no grid -- residuo-1 (multiclassar em Mago não
  // concedia o Livro de Magias).
  expect((salvo.grimorio || []).map((m) => m.nome).sort(),
    'o grimório salvo tem de ter exatamente as 6 magias escolhidas na tela')
    .toEqual([...nomesGrimorio].sort());

  // (a) A TELA IMEDIATAMENTE POSTERIOR, sem recarregar. Antes da correção
  // do Important 1, `classesData` ainda era o mapa da abertura (só
  // Bárbaro): a reserva vinha vazia e nada disto aparecia.
  await expect(page.locator('[data-slot-circ="1"][data-slot-fonte="conjuracao"]'),
    'sem recarregar, o Mago 1 tem de mostrar os 2 espaços de 1º círculo')
    .toHaveCount(2);
  await expect(page.locator('#app-content'),
    'sem recarregar, as características da classe nova têm de aparecer')
    .toContainText('Recuperação Arcana');

  // (b) DEPOIS DE RECARREGAR: a cadeia de migração de abertura roda de
  // verdade (é ela que apagava dado do jogador no Critical).
  // RECARREGAMENTO DE VERDADE: `page.goto` para a MESMA URL só troca o
  // hash e NÃO re-executa renderSheet (medido -- a cadeia de migração de
  // abertura nem rodava, e o cenário passava com o defeito presente).
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar(page);

  await expect(page.locator('[data-slot-circ="1"][data-slot-fonte="conjuracao"]'),
    'depois de recarregar, os 2 espaços de 1º círculo continuam lá')
    .toHaveCount(2);
  await expect(page.locator('#app-content'),
    'depois de recarregar, as características da classe nova continuam lá')
    .toContainText('Recuperação Arcana');

  const depoisDeRecarregar = await personagemSalvo(page);
  expect(depoisDeRecarregar.classes.map((c) => `${c.classe} ${c.nivel}`),
    'a abertura da ficha não pode desfazer a subida').toEqual(['Bárbaro 5', 'Mago 1']);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 7. SEGUNDA CLASSE CONJURADORA com magia SEMPRE PREPARADA -- o Critical
// ============================================================
// Este é o cenário do Critical da revisão final, pelo fluxo real e ponta a
// ponta: um Mago 5/Paladino 1 sobe para Paladino 2 -- o nível em que a
// característica 'Destruição Divina' (Classes.md) deixa a magia de mesmo
// nome SEMPRE PREPARADA (MEDIDO: no 1º nível de Paladino ainda não há
// nenhuma) -- e depois REABRE a ficha.
//
// `subirDeNivel` grava a magia em `magias_preparadas` com
// `origem: 'sempre'`. Na abertura seguinte, `migrarMagiasSemprePreparadas`
// REMOVE toda entrada 'sempre' ausente de `magiasSempreCache` e chama
// salvar(). Com o cache montado pelos espelhos (a classe INICIAL, no nível
// TOTAL), o cache de um Mago 5/Paladino 2 não conhecia NENHUMA magia de
// Paladino: a magia sumia da ficha na reabertura, em silêncio e
// PERSISTIDA. MEDIDO nesta árvore antes da correção.
//
// A asserção final é sobre o PERSONAGEM SALVO depois do recarregamento: é
// o dado gravado que era perdido, não só o que a tela mostrava.
const MAGO_5_PALADINO_1 = [
  { classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Paladino', subclasse: '', nivel: 1, ordem: 1 },
];

test('Mago 5/Paladino 1 sobe para Paladino 2: a magia sempre preparada da segunda classe sobrevive a reabrir a ficha', async ({ context }) => {
  const id = 'regras-5-revisao-sempre-preparada';
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', subclasse: '', nivel: 6, xp: 14000,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Arcanismo', 'História'],
    classes: MAGO_5_PALADINO_1,
    schema_versao: 2,
  }, id);

  const magiasSempre = async () => {
    const p = await personagemSalvo(page);
    return (p.magias_preparadas || []).filter((m) => m.origem === 'sempre').map((m) => m.nome);
  };
  expect(await magiasSempre(),
    'controle: a semente não tem magia sempre preparada nenhuma').toEqual([]);

  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false })).toBe(true);
  await expect(page.locator(CARD_CLASSE)).toBeVisible();
  await radioClasse(page, 'Paladino').click();
  await expect(page.locator(CARD_CLASSE)).toHaveAttribute('data-classe-ctx', 'Paladino');
  await assentar(page).catch(() => {});

  // Navega até a Revisão. O único portão do caminho é o Estilo de Luta do
  // Paladino 2; o laço responde a ele e FALHA ALTO em qualquer outro,
  // nomeando o step -- um `continue` silencioso mediria a ficha sem a
  // subida.
  const confirmar = page.locator('#btn-confirmar-levelup');
  let estiloEscolhido = false;
  for (let i = 0; i < 8 && !(await confirmar.count()); i++) {
    const estilo = page.locator('#lvlup-estilo-luta-escolha [data-opcao]').first();
    if (!estiloEscolhido && await estilo.count()) {
      await estilo.click();
      await assentar(page).catch(() => {});
      estiloEscolhido = true;
      continue;
    }
    expect(await page.locator(PROXIMO).isEnabled().catch(() => false),
      `o assistente travou no step "${await page.locator(STEP_ATIVO).textContent().catch(() => '?')}"`)
      .toBe(true);
    await proximo(page);
  }
  expect(estiloEscolhido, 'o 2º nível DE PALADINO tem de pedir o Estilo de Luta').toBe(true);
  await expect(confirmar, 'o assistente deveria chegar ao passo de confirmação').toBeVisible();
  await expect(page.locator('#levelup-step-body'),
    'a Revisão tem de nomear a classe em que o nível entra')
    .toContainText('Paladino 1 → Paladino 2');
  await confirmar.click();
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo.classes.map((c) => `${c.classe} ${c.nivel}`),
    'o cenário é Mago 5/Paladino 2').toEqual(['Mago 5', 'Paladino 2']);
  expect(await magiasSempre(),
    'o 2º nível de Paladino concede a magia sempre preparada de Destruição Divina')
    .toEqual(['Destruição Divina']);

  // REABRIR a ficha -- é aqui que a higienização rodava e apagava.
  // RECARREGAMENTO DE VERDADE: `page.goto` para a MESMA URL só troca o
  // hash e NÃO re-executa renderSheet (medido -- a cadeia de migração de
  // abertura nem rodava, e o cenário passava com o defeito presente).
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar(page);

  expect(await magiasSempre(),
    'reabrir a ficha NÃO pode apagar a magia sempre preparada da segunda classe')
    .toEqual(['Destruição Divina']);
  // E a tela mostra a magia, não só o dado salvo.
  await expect(page.locator('#app-content'),
    'a magia sempre preparada da segunda classe continua na ficha renderizada')
    .toContainText('Destruição Divina');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
