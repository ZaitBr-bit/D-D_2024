// ============================================================
// Ilusões Aprimoradas (Mago, Ilusionista, nível 3) -- as DUAS frases da
// regra, não só a primeira.
//
// PHB 2024, Classes.md:5074: "Você também conhece o truque *Ilusão Menor*.
// SE JÁ O CONHECE, você aprende um truque de Mago diferente à sua escolha.
// O truque não conta para o seu número de truques conhecidos."
//
// A issue #30 relatou os dois sintomas do mesmo silêncio: quem chegava ao
// nível 3 já conhecendo Ilusão Menor não ganhava truque nenhum, e -- pior --
// trocar depois a Ilusão Menor do talento Iniciado em Magia por outra
// deixava o personagem sem ela por completo, porque a subclasse não havia
// gravado NADA. A concessão automática fazia um `push` que a deduplicação
// por nome descartava, e a segunda frase da regra não existia em lugar
// nenhum do código.
//
// O que este arquivo mede, em três camadas:
//   1. a TABELA -- a linha da característica troca de ramo conforme o
//      personagem já conheça ou não o truque;
//   2. a GRAVAÇÃO -- o truque substituto entra em `magias_conhecidas` com a
//      MESMA origem da concessão automática, isenta do limite de truques;
//   3. o MOTOR -- `subirDeNivel` de verdade, do nível 2 ao 3, exigindo a
//      escolha e gravando o que foi escolhido.
//
// A escolha na TELA (o seletor aparecendo e o clique gravando) é medida por
// testes/e2e/regras/ilusionista-truque-substituto.spec.mjs.
//
// AS TRÊS FONTES DE ILUSÃO MENOR são percorridas de propósito, e não uma
// só: o predicado tem de perguntar ao DADO ("este personagem conhece este
// truque?") e não à ORIGEM nem ao nome da fonte. Um Gnomo do Bosque a
// recebe por espécie (`origem: 'especie'`), o talento Iniciado em Magia a
// grava com `origem: 'iniciado_em_magia'`, e quem a escolheu como truque de
// classe na criação a tem SEM ORIGEM NENHUMA -- é essa terceira que
// qualquer predicado escrito sobre `origem` deixaria passar.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemSemente, subirAteNivel } from './harness.mjs';

const { regrasSubclasseEscolhas: tabela, regrasOrigensMagia, levelup, db, utils,
        levelupFlow } = await modulosApp();

const TRUQUE_DA_CARACTERISTICA = 'Ilusão Menor';

// Cada forma pela qual um Mago pode chegar ao nível 3 já conhecendo o
// truque, escrita como o app REALMENTE grava cada uma (conferido em
// creator/wizard.js:555 e :566, levelup.js:2251 e levelup-ui.js:2195).
const FONTES_DO_TRUQUE = [
  { rotulo: 'talento Iniciado em Magia',
    entrada: { nome: TRUQUE_DA_CARACTERISTICA, circulo: 0, origem: 'iniciado_em_magia' } },
  { rotulo: 'espécie (Gnomo do Bosque)',
    entrada: { nome: TRUQUE_DA_CARACTERISTICA, circulo: 0, origem: 'especie' } },
  { rotulo: 'truque de classe, sem origem nenhuma',
    entrada: { nome: TRUQUE_DA_CARACTERISTICA, circulo: 0 } },
];

/** A linha das Ilusões Aprimoradas para um personagem concreto. */
function linhaDoIlusionista(personagem) {
  const linhas = tabela.linhasDaSubclasseNoNivel('Ilusionista', 3,
    tabela.truquesConhecidosDe(personagem));
  const linha = linhas.find((l) => l.caracteristica === 'Ilusões Aprimoradas');
  assert.ok(linha, 'a linha das Ilusões Aprimoradas sumiu de ESCOLHAS_SUBCLASSE_APP');
  return linha;
}

/** Personagem mínimo que conhece os truques informados. */
function comTruques(...entradas) {
  return { magias_conhecidas: entradas.map((e) => ({ ...e })) };
}

// ---------- Camada 1: a tabela escolhe o ramo pelo que o personagem sabe ----------

for (const fonte of FONTES_DO_TRUQUE) {
  test(`Ilusões Aprimoradas: quem já conhece ${TRUQUE_DA_CARACTERISTICA} por ${fonte.rotulo} recebe uma ESCOLHA`, () => {
    const linha = linhaDoIlusionista(comTruques(fonte.entrada));

    assert.equal(linha.tipo, 'subclasse_truque_substituto',
      `com ${TRUQUE_DA_CARACTERISTICA} já conhecida, a característica vira escolha -- ` +
      'sem `tipo` ela não levanta pendência nenhuma e o nível termina sem truque, ' +
      'que é exatamente a issue #30');
    assert.equal(linha.automatica, undefined,
      'o ramo substituto não pode carregar junto a concessão automática: a subida ' +
      'concederia e perguntaria ao mesmo tempo');
    assert.equal(linha.quantidade, 1, 'o livro dá UM truque de Mago diferente');
    assert.equal(linha.destino, 'truque_de_subclasse');
    assert.equal(linha.livro, 'Classes.md:5074',
      'a linha substituta tem de herdar a citação do livro da característica');
  });
}

test('Ilusões Aprimoradas: quem NÃO conhece Ilusão Menor continua recebendo a concessão automática', () => {
  const linha = linhaDoIlusionista(comTruques({ nome: 'Prestidigitação Arcana', circulo: 0 }));

  assert.deepEqual(linha.automatica, { truques: [TRUQUE_DA_CARACTERISTICA] },
    'o caso comum é a primeira frase da regra, e ela não pode ter mudado');
  assert.equal(linha.tipo, undefined,
    'perguntar aqui cobraria uma decisão que o livro não prevê para quem ainda não ' +
    'conhece o truque');
});

test('Ilusões Aprimoradas: sem os truques conhecidos em mãos, a tabela devolve o ramo automático', () => {
  // `sheet/habilidades.js` chama a função só para ler as opções do Estilo de
  // Luta do Campeão, sem personagem -- e nesse uso o ramo automático é a
  // resposta certa, não um erro.
  const linha = tabela.linhasDaSubclasseNoNivel('Ilusionista', 3)
    .find((l) => l.caracteristica === 'Ilusões Aprimoradas');
  assert.deepEqual(linha.automatica, { truques: [TRUQUE_DA_CARACTERISTICA] });
  assert.equal(linha.tipo, undefined);
});

// ---------- Camada 1b: as opções oferecidas ----------

test('truque substituto: as opções são truques de Mago, e nunca um que o personagem já tenha', async () => {
  const personagem = comTruques(
    { nome: TRUQUE_DA_CARACTERISTICA, circulo: 0, origem: 'especie' },
    { nome: 'Prestidigitação Arcana', circulo: 0 });
  const linha = linhaDoIlusionista(personagem);
  const jaTem = tabela.truquesConhecidosDe(personagem);

  const opcoes = await tabela.opcoesDaLinhaAsync(linha, { jaTem });
  const nomes = opcoes.map((o) => o.nome);
  assert.ok(nomes.length > 0, 'o seletor nasceria vazio e a pendência travaria a subida');
  assert.equal(new Set(nomes).size, nomes.length, 'o resolvedor devolveu nomes repetidos');
  assert.ok(opcoes.every((o) => o.circulo === 0),
    'a característica concede um TRUQUE -- nenhuma opção pode vir de outro círculo');

  // A lista permitida vem da MESMA fonte que o app lê, não de uma cópia.
  const dadosMago = await db.getMagiasClasse('Mago');
  const truquesDeMago = new Set((dadosMago?.lista_magias?.['Truques'] || [])
    .map((m) => (typeof m === 'string' ? m : m?.nome)));
  const intrusos = nomes.filter((n) => !truquesDeMago.has(n));
  assert.deepEqual(intrusos, [], 'o livro diz "um truque de Mago", e só');

  assert.ok(!nomes.includes(TRUQUE_DA_CARACTERISTICA),
    `${TRUQUE_DA_CARACTERISTICA} continuou na lista -- escolhê-la gastaria a ` +
    'característica inteira sem conceder nada, porque a gravação deduplica por nome');
  assert.ok(!nomes.includes('Prestidigitação Arcana'),
    'o livro diz um truque DIFERENTE, e o personagem já conhece esse');

  // Sem o filtro as duas voltam: prova que a ausência acima é o filtro
  // agindo, e não sondas que nunca estiveram na lista.
  const semFiltro = (await tabela.opcoesDaLinhaAsync(linha)).map((o) => o.nome);
  assert.ok(semFiltro.includes(TRUQUE_DA_CARACTERISTICA) &&
            semFiltro.includes('Prestidigitação Arcana'),
    'pré-condição: as duas sondas existem na lista de truques de Mago');
});

// ---------- Camada 2: a gravação ----------

test('truque substituto: entra em magias_conhecidas, com a mesma origem da concessão automática', () => {
  const personagem = comTruques({ nome: TRUQUE_DA_CARACTERISTICA, circulo: 0, origem: 'iniciado_em_magia' });
  const linha = linhaDoIlusionista(personagem);

  tabela.aplicarEscolhaSubclasse(personagem, linha, ['Prestidigitação Arcana']);

  assert.deepEqual(personagem.magias_conhecidas, [
    { nome: TRUQUE_DA_CARACTERISTICA, circulo: 0, origem: 'iniciado_em_magia' },
    { nome: 'Prestidigitação Arcana', circulo: 0, origem: 'subclasse_automatica' },
  ], 'o truque escolhido é o mesmo ganho da concessão automática desta característica: ' +
     'mora em magias_conhecidas (onde a ficha lê os truques) e sai com a mesma origem');
  assert.equal(personagem.magias_preparadas, undefined,
    'truque em magias_preparadas cai no grupo "1º Círculo" da ficha e ganha um ' +
    '"Conjurar" que gasta espaço de magia');
});

test('truque substituto: não gasta vaga do limite de truques da tabela do Mago, e não é trocável', () => {
  const truque = { nome: 'Prestidigitação Arcana', circulo: 0, origem: 'subclasse_automatica' };
  assert.equal(regrasOrigensMagia.truqueContaNoLimite(truque), false,
    '"O truque não conta para o seu número de truques conhecidos" (Classes.md:5074)');
  assert.equal(regrasOrigensMagia.truqueEhTrocavel(truque), false,
    'não foi escolhido da tabela da classe: é um ganho da subclasse, como a própria ' +
    'Ilusão Menor que ele substitui');
});

// ---------- Camada 3: o motor (subirDeNivel de verdade) ----------

/** Mago 2 pronto para subir ao 3, com (ou sem) o truque já conhecido. */
async function magoNivel2(entradaDoTruque = null) {
  const personagem = await personagemSemente('Mago');
  await subirAteNivel(personagem, 'Mago', 2);
  if (entradaDoTruque) {
    if (!Array.isArray(personagem.magias_conhecidas)) personagem.magias_conhecidas = [];
    personagem.magias_conhecidas.push({ ...entradaDoTruque });
  }
  return personagem;
}

/**
 * Magias de Mago que cabem no nível 3 e ainda não estão no grimório --
 * mesma regra que o app valida (levelup.js): círculo com espaços, classe
 * Mago, ausente do grimório, e da escola pedida quando houver uma.
 */
async function magiasDeMago(personagem, quantidade, { escola = null, excluir = [] } = {}) {
  const classeData = await db.getClasse('Mago');
  const espacos = utils.getEspacosMagia(classeData.tabela_caracteristicas, 3);
  const fora = new Set([...(personagem.grimorio || []).map((m) => m?.nome), ...excluir]);
  const indice = await db.getIndiceMagias();
  const candidatas = (indice?.magias || []).filter((m) =>
    Array.isArray(m.classes) && m.classes.includes('Mago') &&
    m.circulo > 0 && (espacos[m.circulo]?.total || 0) > 0 &&
    !fora.has(m.nome) && (!escola || m.escola === escola));
  assert.ok(candidatas.length >= quantidade,
    `magias de Mago${escola ? ` da escola ${escola}` : ''} insuficientes no nível 3`);
  return candidatas.slice(0, quantidade).map((m) => m.nome);
}

/**
 * Sobe o Mago do nível 2 para o 3 escolhendo Ilusionista, respondendo cada
 * pendência AQUI -- e não pelo driver genérico do harness -- porque estes
 * oráculos precisam de duas coisas que ele não devolve: escolher QUAL truque
 * substituto entra, e ver a LISTA de pendências que o motor exigiu.
 *
 * Para no primeiro tipo repetido: pendência que reaparece é pendência que a
 * resposta não satisfez, e continuar o laço só esconderia isso atrás do
 * teto de tentativas.
 */
async function subirParaIlusionista(personagem, { truqueSubstituto = null } = {}) {
  const opcoes = { ignorar_xp: true, classe: 'Mago', subclasse: 'Ilusionista' };
  const pendencias = [];
  let resultado = null;
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    resultado = await levelup.subirDeNivel(personagem, opcoes);
    if (resultado.sucesso) break;
    assert.ok(resultado.pendente,
      `subirDeNivel falhou sem pendência: ${resultado.erro ?? JSON.stringify(resultado)}`);
    const tipo = resultado.tipo_pendencia;
    if (pendencias.includes(tipo)) break;
    pendencias.push(tipo);
    if (tipo === 'grimorio') {
      opcoes.grimorio_selecionados = await magiasDeMago(personagem, 2);
    } else if (tipo === 'subclasse_magias_arcana') {
      opcoes.subclasse_magias_selecionadas = await magiasDeMago(personagem, 2,
        { escola: 'Ilusão', excluir: opcoes.grimorio_selecionados || [] });
    } else if (tipo === 'subclasse_truque_substituto') {
      if (!truqueSubstituto) break;
      opcoes.subclasse_truque_substituto = [truqueSubstituto];
    } else {
      break;
    }
  }
  return { resultado, pendencias };
}

/** Os truques do personagem, por nome. */
function truques(personagem) {
  return (personagem.magias_conhecidas || []).filter((m) => m.circulo === 0);
}

/**
 * O primeiro truque da lista de Mago que não esteja entre `jaConhecidos`,
 * lido de dados/classes/ pela MESMA função do app (`getMagiasClasse`).
 * Fica fora do resolvedor de propósito: o nome que o oráculo espera não pode
 * sair da peça que ele mede.
 */
async function primeiroTruqueDeMagoFora(jaConhecidos) {
  const dados = await db.getMagiasClasse('Mago');
  const fora = new Set(jaConhecidos);
  const nomes = (dados?.lista_magias?.['Truques'] || [])
    .map((m) => (typeof m === 'string' ? m : m?.nome))
    .filter((n) => n && !fora.has(n));
  assert.ok(nomes.length, 'a lista de truques de Mago não ofereceu nenhum candidato');
  return nomes[0];
}

for (const fonte of FONTES_DO_TRUQUE) {
  test(`nível 3: o Ilusionista que já tem ${TRUQUE_DA_CARACTERISTICA} por ${fonte.rotulo} sai com um truque de Mago a mais`, async () => {
    const personagem = await magoNivel2(fonte.entrada);
    const antes = truques(personagem).map((m) => m.nome);

    // O substituto sai da lista de truques do Mago lida direto de
    // dados/classes/ -- NÃO do resolvedor da tabela: o valor esperado de um
    // oráculo não pode vir da função sob teste.
    const escolhido = await primeiroTruqueDeMagoFora(antes);

    const { resultado, pendencias } = await subirParaIlusionista(personagem,
      { truqueSubstituto: escolhido });

    assert.equal(resultado.sucesso, true,
      `a subida não concluiu (pendências vistas: ${pendencias.join(', ')})`);
    assert.ok(pendencias.includes('subclasse_truque_substituto'),
      'o motor precisa PERGUNTAR o truque substituto -- sem pendência a escolha some em ' +
      `silêncio e o nível termina como antes da correção (pendências: ${pendencias.join(', ')})`);

    const depois = truques(personagem);
    assert.deepEqual(depois.map((m) => m.nome).sort(), [...antes, escolhido].sort(),
      `o Ilusionista tinha de terminar com ${escolhido} a mais, e com ` +
      `${TRUQUE_DA_CARACTERISTICA} intacta`);

    const gravado = depois.find((m) => m.nome === escolhido);
    assert.deepEqual(gravado, { nome: escolhido, circulo: 0, origem: 'subclasse_automatica' },
      'o truque substituto é um ganho da subclasse -- a origem é o que o isenta do ' +
      'limite de truques da tabela do Mago');

    // O SEGUNDO sintoma da issue #30: a subclasse agora GRAVA a concessão
    // dela. Trocar depois a fonte que dava Ilusão Menor (o talento, a
    // espécie) não deixa mais o personagem sem nada da característica.
    assert.ok(depois.some((m) => m.origem === 'subclasse_automatica'),
      'a subclasse não gravou nada, e trocar a outra fonte apagaria a característica inteira');
  });
}

test('nível 3: sem o truque substituto escolhido, a subida é recusada -- não concluída em silêncio', async () => {
  const personagem = await magoNivel2(FONTES_DO_TRUQUE[0].entrada);
  const antes = truques(personagem).map((m) => m.nome).sort();

  const { resultado } = await subirParaIlusionista(personagem);

  assert.equal(resultado.sucesso, false, 'a subida concluiu sem a escolha do livro');
  assert.equal(resultado.tipo_pendencia, 'subclasse_truque_substituto');
  assert.equal(personagem.nivel, 2, 'o nível não pode ter avançado com a pendência aberta');
  assert.deepEqual(truques(personagem).map((m) => m.nome).sort(), antes,
    'a recusa não pode deixar truque nenhum para trás');
});

test('nível 3: responder com um truque que o personagem JÁ conhece é recusado, não aceito em silêncio', async () => {
  // "um truque de Mago DIFERENTE à sua escolha". A tela não oferece esses
  // nomes (o resolvedor os filtra, e o oráculo acima mede isso), mas quem
  // chama `subirDeNivel` direto não passa pela tela -- e aceitar aqui faria
  // a gravação deduplicar por nome e a característica se perder em silêncio,
  // que é a issue #30 por outra porta.
  const personagem = await magoNivel2(FONTES_DO_TRUQUE[0].entrada);
  const jaConhecido = truques(personagem)[0]?.nome;
  assert.ok(jaConhecido, 'pré-condição: o Mago semeado conhece algum truque');

  const { resultado } = await subirParaIlusionista(personagem,
    { truqueSubstituto: jaConhecido });

  assert.equal(resultado.sucesso, false,
    `${jaConhecido} já é conhecido, e a subida o aceitou -- o jogador terminaria o nível ` +
    'sem truque nenhum da característica');
  assert.equal(resultado.tipo_pendencia, 'subclasse_truque_substituto');
  assert.equal(personagem.nivel, 2);
});

test('nível 3: o Ilusionista que NÃO conhece Ilusão Menor continua ganhando-a, sem pergunta nenhuma', async () => {
  const personagem = await magoNivel2();
  const antes = truques(personagem).map((m) => m.nome);
  assert.ok(!antes.includes(TRUQUE_DA_CARACTERISTICA),
    `pré-condição: a semente não pode conhecer ${TRUQUE_DA_CARACTERISTICA}`);

  const { resultado, pendencias } = await subirParaIlusionista(personagem);

  assert.equal(resultado.sucesso, true,
    `a subida não concluiu (pendências vistas: ${pendencias.join(', ')})`);
  assert.ok(!pendencias.includes('subclasse_truque_substituto'),
    'o livro só manda escolher quem JÁ conhece o truque -- perguntar aos demais cobra ' +
    'uma decisão que o livro não prevê');
  assert.deepEqual(truques(personagem).map((m) => m.nome).sort(),
    [...antes, TRUQUE_DA_CARACTERISTICA].sort(),
    'a primeira frase da regra continua valendo: o truque é concedido sem perguntar');
  assert.deepEqual(truques(personagem).find((m) => m.nome === TRUQUE_DA_CARACTERISTICA),
    { nome: TRUQUE_DA_CARACTERISTICA, circulo: 0, origem: 'subclasse_automatica' });
});

// ---------- A tela e o motor têm de enxergar o MESMO personagem ----------
//
// `confirmarLevelUp` (levelup-ui.js) empurra os truques escolhidos e as
// trocas de truque para `char.magias_conhecidas` ANTES de chamar
// `subirDeNivel`: a tela lê o personagem de antes, o motor o de depois. Para
// uma característica condicionada ao que o personagem já sabe isso basta
// para os dois discordarem -- e a discordância é uma subida RECUSADA por uma
// pendência que não tem nenhum controle na página.
//
// `truquesDaSessao` (levelup-flow.js) é a fonte ÚNICA dos dois lados: quem
// aplica os empurrões consome `ganhos`/`trocas`, quem prevê o personagem
// consome `conhecidos`. O contexto usado aqui é o REAL
// (`buildLevelUpContext`), e não um objeto montado à mão: as três guardas
// dessa função dependem de campos do contexto (`ehConjuradorAtivo`,
// `_listaMagiasClasse`), e um `ctx` de mentira as pularia sem ninguém notar.

/** Contexto REAL do assistente para um Mago subindo do nível 2 para o 3. */
async function contextoMagoNivel3(personagem, listaMagiasClasse = []) {
  const classeData = await db.getClasse('Mago');
  const ctx = await levelupFlow.buildLevelUpContext(personagem, classeData, {}, 'Mago');
  // Campo de cache que a tela preenche com `carregarMagiasDisponiveis`
  // (levelup-flow.js) assim que o passo de magias é montado -- é dele que
  // sai a guarda "só entra truque que exista na lista da classe que sobe".
  ctx._listaMagiasClasse = listaMagiasClasse;
  return ctx;
}

/** Mago 2 de verdade (nível 3 é o alvo), com os truques informados. */
async function magoNivel2ComTruques(...nomes) {
  const personagem = await magoNivel2();
  personagem.magias_conhecidas = nomes.map((nome) => ({ nome, circulo: 0 }));
  return personagem;
}

test('tela: trocar um truque POR Ilusão Menor nesta mesma subida já faz o seletor do substituto aparecer', async () => {
  const personagem = await magoNivel2ComTruques('Prestidigitação Arcana');
  const ctx = await contextoMagoNivel3(personagem);

  const semTroca = levelupFlow.escolhasSubclasseDoNivel(ctx, { subclasse: 'Ilusionista' });
  assert.deepEqual(semTroca.map((l) => l.tipo), [],
    'pré-condição: sem a troca, este Mago não conhece Ilusão Menor e nada é perguntado');

  const comTroca = levelupFlow.escolhasSubclasseDoNivel(ctx, {
    subclasse: 'Ilusionista',
    truqueTrocarDe: 'Prestidigitação Arcana',
    truqueTrocarPara: TRUQUE_DA_CARACTERISTICA,
  });
  assert.deepEqual(comTroca.map((l) => l.tipo), ['subclasse_truque_substituto'],
    'a troca entra em magias_conhecidas antes de subirDeNivel, então o motor VAI cobrar ' +
    'o substituto -- se a tela não o mostrar, a confirmação é recusada sem nenhum ' +
    'controle na página para responder');
});

test('tela: trocar Ilusão Menor FORA nesta mesma subida faz o seletor do substituto sumir', async () => {
  // Ilusão Menor escolhida como truque de classe é trocável (não tem origem
  // especial), então este caminho existe de verdade.
  const personagem = await magoNivel2ComTruques(TRUQUE_DA_CARACTERISTICA);
  const ctx = await contextoMagoNivel3(personagem);

  const semTroca = levelupFlow.escolhasSubclasseDoNivel(ctx, { subclasse: 'Ilusionista' });
  assert.deepEqual(semTroca.map((l) => l.tipo), ['subclasse_truque_substituto'],
    'pré-condição: sem a troca, este Mago já conhece Ilusão Menor');

  const comTroca = levelupFlow.escolhasSubclasseDoNivel(ctx, {
    subclasse: 'Ilusionista',
    trocasTruque: [{ de: TRUQUE_DA_CARACTERISTICA, para: 'Prestidigitação Arcana' }],
  });
  assert.deepEqual(comTroca.map((l) => l.tipo), [],
    'depois da troca o personagem não conhece mais Ilusão Menor, e o motor volta ao ramo ' +
    'automático -- a tela que ainda perguntasse jogaria a resposta fora em silêncio');
});

// ---------- O que a tela PREVÊ e o que a confirmação APLICA ----------
//
// A previsão (`conhecidos`) e a aplicação (`ganhos`/`trocas`) saem da MESMA
// chamada, então elas não podem discordar -- e é isso que este oráculo
// afirma, cenário a cenário, incluindo as três guardas. Antes desta rodada
// havia duas expressões independentes para a mesma pergunta, com guardas
// diferentes; foi o Important da revisão.
//
// `aplicarComoAConfirmacao` repete a MUTAÇÃO de `confirmarLevelUp`
// (levelup-ui.js) -- push do ganho, splice+push da troca --, nunca a
// DECISÃO, que é justamente o que se quer ver vindo de um lugar só.

/** Aplica `ganhos`/`trocas` em `char` como `confirmarLevelUp` aplica. */
function aplicarComoAConfirmacao(char, { ganhos, trocas }) {
  for (const nome of ganhos) {
    if (!char.magias_conhecidas) char.magias_conhecidas = [];
    char.magias_conhecidas.push({ nome, circulo: 0 });
  }
  for (const troca of trocas) {
    const i = char.magias_conhecidas?.findIndex((m) => m.nome === troca.de);
    if (i === undefined || i === -1) continue;
    char.magias_conhecidas.splice(i, 1);
    char.magias_conhecidas.push({ nome: troca.para, circulo: 0 });
  }
  return new Set((char.magias_conhecidas || []).map((m) => m.nome));
}

// Cada cenário exercita uma das guardas -- e nenhum deles é hipotético: o
// grid de truques só oferece nomes da lista da classe, mas o `state`
// sobrevive a uma troca de classe no primeiro passo do assistente, e o
// seletor de troca de truque é remontado a cada render.
// `ganhos`/`trocas` são afirmados NOME A NOME, e não só confrontados com a
// previsão: coerência sozinha ficaria verde com as duas metades erradas do
// mesmo jeito -- as guardas 2 e 3 precisam de um valor esperado escrito à
// mão para poderem ficar vermelhas.
const CENARIOS_SESSAO = [
  { rotulo: 'nada escolhido', state: {},
    ganhos: [], trocas: [] },
  { rotulo: 'truque novo da lista da classe',
    state: { truquesSelecionados: ['Talho Mental'] },
    ganhos: ['Talho Mental'], trocas: [] },
  { rotulo: 'truque escolhido que NÃO está na lista da classe que sobe',
    state: { truquesSelecionados: ['Arte Druídica'] },
    ganhos: [], trocas: [] },
  { rotulo: 'truque escolhido que o personagem já conhece',
    state: { truquesSelecionados: ['Luz'] },
    ganhos: [], trocas: [] },
  { rotulo: 'troca cujo "de" o personagem tem',
    state: { truqueTrocarDe: 'Luz', truqueTrocarPara: 'Talho Mental' },
    ganhos: [], trocas: [{ de: 'Luz', para: 'Talho Mental' }] },
  { rotulo: 'troca cujo "de" o personagem NÃO tem',
    state: { truqueTrocarDe: 'Trovão', truqueTrocarPara: 'Talho Mental' },
    ganhos: [], trocas: [] },
  { rotulo: 'par pendente incompleto (só o "de")',
    state: { truqueTrocarDe: 'Luz' },
    ganhos: [], trocas: [] },
  { rotulo: 'troca confirmada e par pendente, juntos',
    state: { trocasTruque: [{ de: 'Luz', para: 'Talho Mental' }],
             truqueTrocarDe: 'Mãos Mágicas', truqueTrocarPara: 'Trovão' },
    ganhos: [], trocas: [{ de: 'Luz', para: 'Talho Mental' },
                         { de: 'Mãos Mágicas', para: 'Trovão' }] },
];

for (const cenario of CENARIOS_SESSAO) {
  test(`sessão: a tela prevê exatamente o que a confirmação aplica — ${cenario.rotulo}`, async () => {
    const personagem = await magoNivel2ComTruques(TRUQUE_DA_CARACTERISTICA, 'Luz', 'Mãos Mágicas');
    // A lista da classe que sobe, lida de dados/classes/ como a tela lê.
    const dadosMago = await db.getMagiasClasse('Mago');
    const lista = (dadosMago?.lista_magias?.['Truques'] || [])
      .map((m) => (typeof m === 'string' ? { nome: m } : m));
    const ctx = await contextoMagoNivel3(personagem, lista);
    const state = { subclasse: 'Ilusionista', ...cenario.state };

    const sessao = levelupFlow.truquesDaSessao(ctx, state);
    const previsto = new Set(sessao.conhecidos);
    const aplicado = aplicarComoAConfirmacao(personagem, sessao);

    assert.deepEqual(sessao.ganhos, cenario.ganhos,
      'os truques que a confirmação vai empurrar não são os esperados');
    assert.deepEqual(sessao.trocas.map((t) => ({ de: t.de, para: t.para })), cenario.trocas,
      'as trocas que a confirmação vai aplicar não são as esperadas');
    assert.deepEqual([...aplicado].sort(), [...previsto].sort(),
      'a tela previu um personagem e a confirmação escreveu outro -- é essa divergência ' +
      'que faz o motor cobrar uma pendência sem controle na página');
  });
}

test('sessão: classe que não conjura neste nível não empurra truque nenhum', async () => {
  // A guarda 1 (`ehConjuradorAtivo`) vivia só em `confirmarLevelUp`. Um
  // Guerreiro sem subclasse conjuradora escolhida não conjura, e um `state`
  // com truques -- resto de uma troca de classe no primeiro passo -- não
  // pode virar truque na ficha.
  const personagem = await personagemSemente('Guerreiro');
  await subirAteNivel(personagem, 'Guerreiro', 2);
  const classeData = await db.getClasse('Guerreiro');
  const ctx = await levelupFlow.buildLevelUpContext(personagem, classeData, {}, 'Guerreiro');
  ctx._listaMagiasClasse = [{ nome: 'Talho Mental', circulo: 0 }];

  const sessao = levelupFlow.truquesDaSessao(ctx, {
    truquesSelecionados: ['Talho Mental'],
    truqueTrocarDe: 'Luz', truqueTrocarPara: 'Trovão',
  });

  assert.deepEqual(sessao.ganhos, [], 'um não-conjurador não aprende truque nenhum aqui');
  assert.deepEqual(sessao.trocas, [], 'nem troca truque nenhum');
  assert.deepEqual([...sessao.conhecidos], [],
    'e a previsão da tela tem de dizer a mesma coisa');
});
