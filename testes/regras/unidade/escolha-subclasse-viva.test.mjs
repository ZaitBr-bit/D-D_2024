// ============================================================
// Confronto: uma escolha que o assistente EXIGE não pode nascer sem
// opção nenhuma para escolher.
//
// Irmão de escolha-morta.test.mjs, que persegue o mesmo princípio pelo
// outro lado e só para TALENTOS: lá, uma opção que não concede nada; aqui,
// uma escolha que não oferece nada. As duas produzem o mesmo estrago --
// o jogador olha para um controle que não serve para nada -- mas esta é
// pior: uma linha de ESCOLHAS_SUBCLASSE_APP com `tipo` vira PENDÊNCIA em
// subirDeNivel (levelup.js), e pendência sem opção é a ficha TRAVADA. Foi
// exatamente o que a issue #44 relatou: o Bardo do Colégio do Conhecimento
// não subia do nível 5 porque os dois seletores de "Descobertas Mágicas"
// só tinham a linha vazia "— escolha —".
//
// Desenho: percorre os DADOS (toda linha com `tipo`), não uma lista de
// nomes esperados -- uma linha nova na tabela entra neste motor sozinha,
// como um talento novo entra no de escolha-morta.
//
// Duas vias legítimas de opções, e o motor aceita as duas:
//   1. lista SÍNCRONA (`opcoes` literal ou `fonteOpcoes` de lista fixa) --
//      `opcoesDaLinha` devolve os nomes na hora;
//   2. lista ASSÍNCRONA -- a linha declara um RESOLVEDOR conhecido
//      (`resolvedorDaLinha`), e quem monta a tela o chama depois.
// O que o motor NÃO aceita é a terceira via, que era o defeito: lista
// síncrona vazia E nenhum resolvedor declarado -- ou seja, ninguém, em
// lugar nenhum do app, tem como preencher aquele seletor.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, escadaDeNivel } from './harness.mjs';

const { regrasSubclasseEscolhas: tabela, db, utils } = await modulosApp();

// Teto de círculo que o Bardo alcança no nível 6, DERIVADO da tabela do
// livro (dados/classes/bardo.json) pela mesma expressão que
// `calcularConjuracao` usa para o `maxCirculoNovo` do assistente
// (levelup-flow.js) -- e não um 3 escrito à mão aqui. É o cenário REAL da
// característica que esta rodada conserta.
const _tabelaBardo = (await db.getClasse('Bardo')).tabela_caracteristicas;
const CIRCULO_MAX_BARDO_NIVEL_6 = Math.max(
  ...Object.keys(utils.getEspacosMagia(_tabelaBardo, 6)).map(Number), 0);

// Nomes usados como sonda nos oráculos dirigidos das Descobertas Mágicas.
// Cada um discrimina UMA propriedade da regra do livro (Classes.md:770),
// e todos foram conferidos contra dados/magias/_indice.json.
const SONDA = {
  truqueDruida: 'Arte Druídica',        // truque, só de Druida -- "pode ser um truque"
  magiaMagoNoTeto: 'Bola de Fogo',      // 3º círculo de Mago -- dentro do teto do Bardo nv6
  magiaMagoAcimaDoTeto: 'Banimento',    // 4º círculo de Mago -- fora do teto
  magiaSoDeBardo: 'Sussurros Dissonantes', // 1º círculo, lista só de Bardo -- fora das 3 listas
  truqueJaConhecido: 'Luz',             // truque das 3 listas que um Bardo pode já ter
  magiaJaPreparada: 'Curar Ferimentos', // 1º círculo das 3 listas que um Bardo pode já ter
};

/** Nome de uma opção, venha ela como string (via síncrona) ou objeto (assíncrona). */
function nomeDaOpcao(opcao) {
  return typeof opcao === 'string' ? opcao : opcao?.nome;
}

// ---------- Motor genérico: toda linha que exige escolha ----------
for (const linha of tabela.ESCOLHAS_SUBCLASSE_APP.filter((l) => l.tipo)) {
  test(`escolha viva: ${linha.subclasse} nv${linha.nivel} — ${linha.caracteristica} (${linha.tipo})`, async () => {
    const sincronas = tabela.opcoesDaLinha(linha);
    if (sincronas.length > 0) {
      assert.ok(sincronas.length >= linha.quantidade,
        `${linha.rotulo}: a lista síncrona tem ${sincronas.length} opção(ões) para ` +
        `${linha.quantidade} exigida(s) -- o jogador não consegue completar a escolha.`);
      assert.equal(new Set(sincronas).size, sincronas.length,
        `${linha.rotulo}: a lista síncrona tem nomes repetidos.`);
      return;
    }

    // Lista síncrona vazia só é honesta se houver um resolvedor assíncrono
    // DECLARADO na tabela -- e se ele devolver opções de verdade. Sem isso,
    // o seletor nasce com a linha vazia e nada, em lugar nenhum, o preenche.
    const resolvedor = tabela.resolvedorDaLinha?.(linha);
    assert.equal(typeof resolvedor, 'function',
      `${linha.rotulo}: opcoesDaLinha devolve lista VAZIA e a linha não declara resolvedor ` +
      `assíncrono conhecido (fonteOpcoes: ${JSON.stringify(linha.fonteOpcoes)}). ` +
      'O seletor nasce só com "— escolha —" e a pendência trava a subida de nível.');

    const assincronas = await tabela.opcoesDaLinhaAsync(linha);
    assert.ok(Array.isArray(assincronas), `${linha.rotulo}: o resolvedor não devolveu uma lista.`);
    assert.ok(assincronas.length >= linha.quantidade,
      `${linha.rotulo}: o resolvedor devolveu ${assincronas.length} opção(ões) para ` +
      `${linha.quantidade} exigida(s).`);
    const nomes = assincronas.map(nomeDaOpcao);
    assert.ok(nomes.every((n) => typeof n === 'string' && n.length > 0),
      `${linha.rotulo}: o resolvedor devolveu opção sem nome.`);
    assert.equal(new Set(nomes).size, nomes.length,
      `${linha.rotulo}: o resolvedor devolveu nomes repetidos -- uma magia que está em duas ` +
      'das listas de classe apareceria duas vezes no mesmo seletor.');
  });
}

// ---------- Oráculos dirigidos: Descobertas Mágicas (Classes.md:770) ----------
//
// "Você aprende duas magias à sua escolha. Essas magias podem vir da lista
// de magias de Clérigo, Druida ou Mago... A magia escolhida deve ser um
// truque ou uma magia para a qual você tenha espaços de magia disponíveis."

/** Linha das Descobertas Mágicas, procurada pelo `tipo` que a pendência usa. */
function linhaDescobertas() {
  const linha = tabela.ESCOLHAS_SUBCLASSE_APP
    .find((l) => l.tipo === 'subclasse_descobertas_magicas');
  assert.ok(linha, 'a linha das Descobertas Mágicas sumiu de ESCOLHAS_SUBCLASSE_APP');
  return linha;
}

test('Descobertas Mágicas: as opções saem das listas de Clérigo, Druida e Mago', async () => {
  const opcoes = await tabela.opcoesDaLinhaAsync(linhaDescobertas(),
    { circuloMaximo: CIRCULO_MAX_BARDO_NIVEL_6 });
  const nomes = new Set(opcoes.map(nomeDaOpcao));

  // A união das três listas, lida da MESMA fonte que o app usa (db.js), e
  // não de uma cópia escrita aqui.
  const permitidos = new Set();
  for (const classe of ['Clérigo', 'Druida', 'Mago']) {
    const dados = await db.getMagiasClasse(classe);
    for (const lista of Object.values(dados?.lista_magias || {})) {
      for (const m of lista) permitidos.add(typeof m === 'string' ? m : m.nome);
    }
  }
  const intrusas = [...nomes].filter((n) => !permitidos.has(n));
  assert.deepEqual(intrusas, [],
    'o resolvedor ofereceu magias que não estão em nenhuma das três listas do livro');

  assert.ok(nomes.has(SONDA.magiaMagoNoTeto),
    `${SONDA.magiaMagoNoTeto} (3º círculo de Mago) deveria estar entre as opções`);
  assert.ok(!nomes.has(SONDA.magiaSoDeBardo),
    `${SONDA.magiaSoDeBardo} só existe na lista de Bardo -- o livro não a permite aqui`);
});

test('Descobertas Mágicas: truque sempre entra, magia acima do teto de espaços nunca', async () => {
  // Pré-condição das sondas: elas só discriminam enquanto o teto do Bardo
  // nível 6 for o 3º círculo. Afirmada aqui para uma mudança na tabela do
  // livro falhar dizendo o que mudou, em vez de acusar o resolvedor.
  assert.equal(CIRCULO_MAX_BARDO_NIVEL_6, 3,
    'a tabela do Bardo mudou: o nível 6 não alcança mais o 3º círculo, e as sondas ' +
    'deste oráculo precisam ser revistas');

  const opcoes = await tabela.opcoesDaLinhaAsync(linhaDescobertas(),
    { circuloMaximo: CIRCULO_MAX_BARDO_NIVEL_6 });
  const nomes = new Set(opcoes.map(nomeDaOpcao));

  assert.ok(nomes.has(SONDA.truqueDruida),
    `${SONDA.truqueDruida} é truque, e o livro deixa escolher truque -- deveria estar na lista`);
  assert.ok(!nomes.has(SONDA.magiaMagoAcimaDoTeto),
    `${SONDA.magiaMagoAcimaDoTeto} é de 4º círculo, e o Bardo nível 6 não tem espaço de 4º -- ` +
    'o livro exige "espaços de magia disponíveis"');

  const acimaDoTeto = opcoes.filter((o) => o.circulo > CIRCULO_MAX_BARDO_NIVEL_6);
  assert.deepEqual(acimaDoTeto.map(nomeDaOpcao), [],
    `nenhuma opção pode passar do ${CIRCULO_MAX_BARDO_NIVEL_6}º círculo neste teto`);
  assert.ok(opcoes.some((o) => o.circulo === 0), 'nenhum truque foi oferecido');
  assert.ok(opcoes.some((o) => o.circulo === CIRCULO_MAX_BARDO_NIVEL_6),
    'nenhuma magia do círculo mais alto disponível foi oferecida');
});

// Escolha que não concede nada é escolha morta -- o mesmo princípio que
// escolha-morta.test.mjs persegue do lado dos talentos. Aqui o estrago é
// mudo e imediato: a gravação deduplica por nome, então escolher o que o
// personagem já tem consome UMA DAS DUAS seleções sem conceder nada. O
// jogador escolhe duas e recebe uma, sem erro e sem aviso.
//
// Gatilhos reais: multiclasse com Clérigo/Druida/Mago (listas sobrepostas),
// talento Iniciado em Magia, magia de domínio concedida neste mesmo nível.
test('Descobertas Mágicas: o que o personagem já tem não é oferecido', async () => {
  const jaTem = new Set([SONDA.truqueJaConhecido, SONDA.magiaJaPreparada]);
  const opcoes = await tabela.opcoesDaLinhaAsync(linhaDescobertas(),
    { circuloMaximo: CIRCULO_MAX_BARDO_NIVEL_6, jaTem });
  const nomes = new Set(opcoes.map(nomeDaOpcao));

  assert.ok(!nomes.has(SONDA.truqueJaConhecido),
    `${SONDA.truqueJaConhecido} já é conhecida e continuou na lista -- escolhê-la gastaria ` +
    'uma das duas Descobertas sem conceder nada');
  assert.ok(!nomes.has(SONDA.magiaJaPreparada),
    `${SONDA.magiaJaPreparada} já está preparada e continuou na lista -- mesma escolha morta`);

  // E o filtro não pode levar junto o que o personagem NÃO tem.
  assert.ok(nomes.has(SONDA.magiaMagoNoTeto),
    `${SONDA.magiaMagoNoTeto} não está em jaTem e sumiu da lista`);
  assert.ok(nomes.has(SONDA.truqueDruida),
    `${SONDA.truqueDruida} não está em jaTem e sumiu da lista`);

  // Sem `jaTem`, as duas voltam: prova que a ausência acima é o filtro
  // agindo, e não uma sonda que nunca esteve na lista.
  const semFiltro = new Set((await tabela.opcoesDaLinhaAsync(linhaDescobertas(),
    { circuloMaximo: CIRCULO_MAX_BARDO_NIVEL_6 })).map(nomeDaOpcao));
  assert.ok(semFiltro.has(SONDA.truqueJaConhecido) && semFiltro.has(SONDA.magiaJaPreparada),
    'pré-condição: as duas sondas existem na lista quando nada é excluído');
});

test('Descobertas Mágicas: a magia escolhida é gravada com o círculo real e sempre preparada', async () => {
  const personagem = { magias_preparadas: [] };
  const circulos = { [SONDA.magiaMagoNoTeto]: 3 };
  tabela.aplicarEscolhaSubclasse(personagem, linhaDescobertas(),
    [SONDA.magiaMagoNoTeto], { circulos });

  assert.deepEqual(personagem.magias_preparadas, [
    { nome: SONDA.magiaMagoNoTeto, circulo: 3, origem: 'subclasse_escolha' },
  ], 'a gravação precisa levar o círculo REAL da magia -- um círculo fixo a mostraria no ' +
     'grupo errado da ficha e ofereceria os espaços errados para conjurá-la');
});

// O TRUQUE não é uma magia preparada, e gravá-lo como se fosse quebra a
// ficha inteira -- `sheet/magias.js:652` agrupa a preparada por
// `m.circulo || 1`, então um `circulo: 0` cai no grupo "1º Círculo"; pior,
// `Object.keys(espacos).filter(c => parseInt(c) >= m.circulo)` casa TODOS os
// círculos quando `m.circulo` é 0, e o cartão sai com seletor de upcast e um
// botão "Conjurar" que GASTA espaço de magia para lançar um truque.
//
// No app, truque mora em `magias_conhecidas` com `circulo: 0` -- é assim que
// todas as outras origens de truque gravam (`subclasse_automatica` do
// Ilusionista, `telecinetico`, `especie`) e é de lá que a seção de Truques
// da ficha lê. As Descobertas Mágicas seguem a mesma via.
test('Descobertas Mágicas: o truque escolhido vai para magias_conhecidas, não para as preparadas', async () => {
  const personagem = { magias_preparadas: [], magias_conhecidas: [] };
  const circulos = { [SONDA.truqueDruida]: 0 };
  tabela.aplicarEscolhaSubclasse(personagem, linhaDescobertas(),
    [SONDA.truqueDruida], { circulos });

  assert.deepEqual(personagem.magias_conhecidas, [
    { nome: SONDA.truqueDruida, circulo: 0, origem: 'subclasse_escolha' },
  ], 'o truque escolhido precisa entrar em magias_conhecidas, onde a ficha lê os truques');
  assert.deepEqual(personagem.magias_preparadas, [],
    `${SONDA.truqueDruida} é truque: gravá-lo em magias_preparadas o joga no grupo "1º ` +
    'Círculo" da ficha e lhe dá um botão "Conjurar" que gasta espaço de magia');
});

test('Descobertas Mágicas: escolher magia e truque juntos separa cada um na sua lista', async () => {
  const personagem = {};
  const circulos = { [SONDA.magiaMagoNoTeto]: 3, [SONDA.truqueDruida]: 0 };
  tabela.aplicarEscolhaSubclasse(personagem, linhaDescobertas(),
    [SONDA.magiaMagoNoTeto, SONDA.truqueDruida], { circulos });

  assert.deepEqual(personagem.magias_preparadas,
    [{ nome: SONDA.magiaMagoNoTeto, circulo: 3, origem: 'subclasse_escolha' }]);
  assert.deepEqual(personagem.magias_conhecidas,
    [{ nome: SONDA.truqueDruida, circulo: 0, origem: 'subclasse_escolha' }]);
});

// O truque das Descobertas Mágicas é um GANHO da subclasse, não uma das
// escolhas da tabela da classe: ele não pode gastar vaga do limite de
// truques do Bardo. Quem decide isso é ORIGENS_TRUQUE_NAO_TROCAVEL
// (regras-origens-magia.js), a fonte única -- e sem `subclasse_escolha` lá,
// a ficha passaria a acusar "Truques 4 / 3" em vermelho por um truque que o
// livro deu de graça.
test('Descobertas Mágicas: o truque escolhido não gasta vaga do limite de truques da classe', async () => {
  const { regrasOrigensMagia } = await modulosApp();
  const truque = { nome: SONDA.truqueDruida, circulo: 0, origem: 'subclasse_escolha' };
  assert.equal(regrasOrigensMagia.truqueContaNoLimite(truque), false,
    'o truque das Descobertas Mágicas não sai do orçamento de truques da classe');
  assert.equal(regrasOrigensMagia.truqueEhTrocavel(truque), false,
    'o truque das Descobertas Mágicas não entra na troca comum de truques -- a substituição ' +
    'que o livro permite é a da própria característica, ao ganhar nível de Bardo');
});

// MINOR 3 da revisão: `opcoesDaLinhaAsync` tinha um fallback síncrono
// inalcançável (todo chamador só entra ali depois de confirmar o
// resolvedor). Removido, o lugar dele é uma recusa ALTA -- nunca um
// `undefined` mudo, que faria o seletor nascer vazio de novo.
test('opcoesDaLinhaAsync recusa, alto e claro, uma linha sem resolvedor assíncrono', async () => {
  const linhaSincrona = tabela.ESCOLHAS_SUBCLASSE_APP
    .find((l) => l.tipo && tabela.opcoesDaLinha(l).length > 0);
  assert.ok(linhaSincrona, 'pré-condição: existe alguma linha de lista síncrona na tabela');
  await assert.rejects(() => tabela.opcoesDaLinhaAsync(linhaSincrona),
    /resolvedor/i,
    'chamar a via assíncrona para uma linha de lista fixa é erro de programação, e precisa ' +
    'falhar dizendo isso');
});

// Oráculo de ponta a ponta da CAMADA DE MOTOR (subirDeNivel de verdade,
// pelo mesmo driver que o resto da suíte usa): a escada leva um Bardo do
// Colégio do Conhecimento até o nível 6 e o harness responde a pendência
// `subclasse_descobertas_magicas` com duas magias de Mago reais. O que se
// mede aqui é o que FICA GRAVADO -- nome, círculo e origem -- porque é
// disso que a ficha vive depois. A escolha na TELA (os seletores populados
// e clicáveis) é medida por
// testes/e2e/regras/bardo-conhecimento-descobertas.spec.mjs.
test('Descobertas Mágicas: subir até o nível 6 grava as duas magias com o círculo do índice', async () => {
  let noNivel6 = null;
  await escadaDeNivel('Bardo', (p, nivel) => {
    if (nivel === 6) noNivel6 = JSON.parse(JSON.stringify(p));
  }, { subclasse: 'Colégio do Conhecimento', ateNivel: 6 });

  assert.ok(noNivel6, 'a escada não chegou ao nível 6 do Bardo');
  const escolhidas = (noNivel6.magias_preparadas || [])
    .filter((m) => m.origem === 'subclasse_escolha');
  assert.equal(escolhidas.length, 2,
    'o nível 6 do Colégio do Conhecimento concede DUAS magias sempre preparadas');

  const indice = await db.getIndiceMagias();
  for (const magia of escolhidas) {
    const noIndice = (indice?.magias || []).find((m) => m.nome === magia.nome);
    assert.ok(noIndice, `${magia.nome}: escolhida uma magia que não existe no índice`);
    assert.equal(magia.circulo, noIndice.circulo,
      `${magia.nome}: gravada como ${magia.circulo}º círculo, e o índice diz ` +
      `${noIndice.circulo}º -- a ficha mostraria a magia no lugar errado`);
  }
});
