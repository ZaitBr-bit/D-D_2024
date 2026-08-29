// ============================================================
// Oráculos da Tarefa 3 (sub-projeto "tela magias por classe"): conversão
// da SEÇÃO Magias da ficha (site/js/sheet/magias.js, renderSecaoMagias) e
// das raízes compartilhadas (getBonusTruquesOrdem, utils.js) para decidir
// pela SUPERFÍCIE DE CONJURAÇÃO ATIVA -- a primeira de
// superficiesDaFicha(char) -- em vez de char.classe/char.subclasse/
// char.nivel (a classe INICIAL, o espelho; o nível TOTAL). Mesmo padrão
// da Tarefa 2 (multiclasse-magias-grimorio.test.mjs, o modal "Gerenciar
// Magias"), agora para a própria seção da ficha, que é SÍNCRONA -- não
// precisa da simulação de modal/DOM daquele arquivo.
//
//   Oráculo 1 -- o caso reportado: Ladino 5/Mago 1 -- renderSecaoMagias()
//                mostra os limites do MAGO nível 1 (Truques 3, Preparadas
//                4 -- medidos em dados/classes/mago.json, não chutados).
//   Oráculo 2 -- classe única não muda nada: Mago 5 puro, provado por
//                IDENTIDADE de objeto (===) entre classeData e a tabela
//                que o render de fato consome (fetchJSON, site/js/db.js,
//                cacheia por caminho).
//   Oráculo 3 -- getBonusTruquesOrdem, num personagem MULTICLASSE: um
//                Ladino 5/Clérigo 1 Taumaturgo tem +1 truque no limite
//                mostrado em relação a um Ladino 5/Clérigo 1 sem
//                Taumaturgo -- prova que o bônus segue a classe da
//                SUPERFÍCIE ativa (o Clérigo, a única que conjura), não o
//                espelho char.classe (o Ladino, que não tem Ordem
//                nenhuma).
//   Oráculo 4 -- o contador honesto: com DUAS superfícies de conjuração
//                (Clérigo 5/Mago 1) o aviso do contador global aparece;
//                com UMA (Clérigo 5 puro), não.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse, lerClassesDados } from './harness.mjs';

const mods = await modulosApp();
const { sheetEstado, sheetMagias, contextoClasse, db, utils, regrasConjuracaoSubclasse } = mods;

// Mapa nome-de-classe -> JSON completo (leitura direta do disco, não pelo
// cache de fetchJSON de db.js) -- usado pelos Oráculos 1, 3 e 4, que só
// precisam dos DADOS, não da identidade de objeto entre chamadas (essa é
// a pergunta exclusiva do Oráculo 2). Mesmo padrão de
// multiclasse-magias-grimorio.test.mjs (Tarefa 2).
const mapaDadosDisco = lerClassesDados();

/** Extrai {atual, limite} de um contador "<span class="contador-label">RÓTULO</span> <span class="contador-valor">X / Y</span>" do HTML de renderSecaoMagias(). */
function extrairContador(html, rotuloExato) {
  const re = new RegExp(
    `<span class="contador-label">${rotuloExato}</span>\\s*<span class="contador-valor">(\\d+)\\s*/\\s*(\\d+)</span>`
  );
  const m = html.match(re);
  return m ? { atual: parseInt(m[1], 10), limite: parseInt(m[2], 10) } : null;
}

// ============================================================
// ORÁCULO 1 -- o caso reportado: Ladino 5/Mago 1.
// ============================================================
test('Oráculo 1: Ladino 5/Mago 1 -- renderSecaoMagias() mostra os limites do Mago nível 1, não os do Ladino (classe inicial)', async () => {
  const p = await personagemMulticlasse([{ classe: 'Ladino', nivel: 5 }, { classe: 'Mago', nivel: 1 }]);
  sheetEstado.definirChar(p);
  // classeData deliberadamente do LADINO (a classe inicial, o espelho) --
  // é exatamente isto que renderSheet grava (pages/sheet.js:40,
  // definirClasseData(await getClasse(char.classe))). Se o render ainda
  // lesse `classeData` para os limites (em vez da superfície ativa), a
  // tabela do Ladino (sem colunas de magia) devolveria 0/0 -- o defeito
  // relatado.
  sheetEstado.definirClasseData(mapaDadosDisco.get('Ladino'));
  sheetEstado.definirClassesData(mapaDadosDisco);

  const html = sheetMagias.renderSecaoMagias();

  // Limites medidos na tabela REAL do Mago nível 1 (dados/classes/mago.json),
  // não chutados.
  const tabelaMago = mapaDadosDisco.get('Mago').tabela_caracteristicas;
  const linhaNivel1 = tabelaMago.find((r) => r['Nível'] === '1');
  assert.ok(linhaNivel1, 'sanity: dados/classes/mago.json não tem linha de nível 1');
  const truquesEsperados = parseInt(linhaNivel1['Truques'], 10);
  const preparadasEsperadas = parseInt(linhaNivel1['Magias Preparadas'], 10);
  assert.equal(truquesEsperados, 3, 'sanity: a tabela do Mago mudou -- truques de nível 1 não é mais 3');
  assert.equal(preparadasEsperadas, 4, 'sanity: a tabela do Mago mudou -- preparadas de nível 1 não é mais 4');

  const truques = extrairContador(html, 'Truques');
  assert.ok(truques, 'sanity: não achei o contador de Truques no HTML de renderSecaoMagias()');
  assert.equal(truques.limite, truquesEsperados,
    `limite de truques deveria ser o do Mago nível 1 (${truquesEsperados}) -- se vier 0, a seção ainda ` +
    'decide pelo espelho char.classe (Ladino, sem coluna de magia na tabela).');

  const preparadas = extrairContador(html, 'Magias Preparadas');
  assert.ok(preparadas, 'sanity: não achei o contador de Magias Preparadas no HTML de renderSecaoMagias()');
  assert.equal(preparadas.limite, preparadasEsperadas,
    `limite de preparadas deveria ser o do Mago nível 1 (${preparadasEsperadas}) -- antes do conserto dava 0`);
});

// ============================================================
// ORÁCULO 2 -- classe única não muda nada: Mago 5 puro, provado por
// IDENTIDADE de objeto, não por comparação de valor.
//
// site/js/db.js:12-14 (fetchJSON) cacheia em memória POR CAMINHO. Na
// abertura real da ficha (site/js/pages/sheet.js:40 e :50), `classeData`
// (o espelho que a seção usava ANTES desta tarefa) e
// `classesData.get('Mago')` (o mapa que superficiesDaFicha consulta AGORA)
// vêm das MESMAS duas chamadas a getClasse('Mago') -- a segunda é cache
// hit e devolve o MESMO objeto da primeira. Reproduz aqui essa MESMA
// ordem para que a asserção seja sobre `===`, não sobre igualdade
// estrutural: uma conversão que passasse a ler um dado DIFERENTE para
// classe única (uma cópia, um outro caminho de arquivo) faria esta
// asserção falhar mesmo que os VALORES batessem por coincidência.
// ============================================================
test('Oráculo 2: Mago 5 de classe única não muda -- identidade entre classeData e a tabela da superfície ativa', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);

  // Mesma ordem de site/js/pages/sheet.js: definirClasseData(await
  // getClasse(char.classe)) primeiro, garantirDadosDeClasses(char, true)
  // depois.
  const classeDataMago = await db.getClasse('Mago');
  sheetEstado.definirClasseData(classeDataMago);
  sheetEstado.definirChar(p);
  await contextoClasse.garantirDadosDeClasses(p, true);

  const superficies = contextoClasse.superficiesDaFicha(p);
  assert.equal(superficies.length, 1, 'sanity: Mago de classe única deveria ter exatamente uma superfície');
  assert.equal(superficies[0].classe, 'Mago');
  assert.equal(superficies[0].tabela, classeDataMago.tabela_caracteristicas,
    'a tabela da superfície ativa deveria ser o MESMO objeto (===) que classeData.tabela_caracteristicas ' +
    '-- se isto falhar, a conversão passou a ler uma CÓPIA (ou um dado diferente) para o caso mais comum ' +
    'do app: personagem de classe única.');

  // O grimório também é lido pela classe Mago especificamente
  // (nivelETabelaDoMago, sheet/magias.js) -- mesma identidade, mesmo
  // motivo: dadosDe('Mago') tem de ser o MESMO objeto.
  assert.equal(contextoClasse.dadosDe('Mago'), classeDataMago,
    'dadosDe("Mago") (usado pelo painel do grimório) deveria ser o MESMO objeto que classeData');

  // Confirma também que renderSecaoMagias() de fato CONSOME essa tabela:
  // os limites batem com getLimitesMagias(a mesma tabela, 5, null) --
  // mesma função que o app usa, chamada aqui de fora para não reimplementar
  // a regra dentro do teste.
  const limitesEsperados = utils.getLimitesMagias(classeDataMago.tabela_caracteristicas, 5, null);
  const html = sheetMagias.renderSecaoMagias();
  const truques = extrairContador(html, 'Truques');
  const preparadas = extrairContador(html, 'Magias Preparadas');
  assert.ok(truques && preparadas, 'sanity: não achei os contadores de Truques/Magias Preparadas no HTML');
  assert.equal(truques.limite, limitesEsperados.truques);
  assert.equal(preparadas.limite, limitesEsperados.preparadas);
});

// ============================================================
// ORÁCULO 3 -- getBonusTruquesOrdem num personagem MULTICLASSE: um Ladino
// 5/Clérigo 1 Taumaturgo tem +1 truque no limite mostrado, um Ladino
// 5/Clérigo 1 sem Taumaturgo não. O Ladino não conjura (sem subclasse
// conjuradora), então a ÚNICA superfície é o Clérigo -- se o bônus ainda
// seguisse o espelho char.classe (o Ladino, a classe inicial), ele nunca
// apareceria, porque `nomeClasse === 'Clérigo'` nunca seria verdadeiro
// para 'Ladino'.
// ============================================================
function personagemLadinoClerigo(ordemDivina) {
  return personagemMulticlasse([{ classe: 'Ladino', nivel: 5 }, { classe: 'Clérigo', nivel: 1 }])
    .then((p) => { p.ordem_divina = ordemDivina; return p; });
}

test('Oráculo 3: Ladino 5/Clérigo 1 Taumaturgo -- renderSecaoMagias() aplica de fato o +1 truque (não só cita a função)', async () => {
  sheetEstado.definirClasseData(mapaDadosDisco.get('Ladino'));
  sheetEstado.definirClassesData(mapaDadosDisco);

  const semTaumaturgo = await personagemLadinoClerigo('Protetor');
  sheetEstado.definirChar(semTaumaturgo);
  const limiteSemBonus = extrairLimiteTruques(sheetMagias.renderSecaoMagias());

  const comTaumaturgo = await personagemLadinoClerigo('Taumaturgo');
  sheetEstado.definirChar(comTaumaturgo);
  const limiteComBonus = extrairLimiteTruques(sheetMagias.renderSecaoMagias());

  assert.equal(limiteComBonus, limiteSemBonus + 1,
    `Clérigo Taumaturgo (Classes.md:1568) deveria ter +1 truque no limite mostrado pela seção Magias em ` +
    `relação a um Clérigo sem Taumaturgo -- Protetor: ${limiteSemBonus}, Taumaturgo: ${limiteComBonus}. Se os ` +
    'dois baterem, o bônus não está seguindo a superfície ativa (o Clérigo), e sim o espelho char.classe ' +
    '(o Ladino, que nunca tem Ordem Divina nenhuma).');
});

function extrairLimiteTruques(html) {
  const c = extrairContador(html, 'Truques');
  assert.ok(c, 'sanity: não achei o contador "Truques X / Y" no HTML de renderSecaoMagias()');
  return c.limite;
}

test('Oráculo 3b: Ladino 5/Clérigo 1 SEM Taumaturgo -- getBonusTruquesOrdem(char, "Clérigo") devolve 0', async () => {
  const p = await personagemLadinoClerigo('Protetor');
  assert.equal(utils.getBonusTruquesOrdem(p, 'Clérigo'), 0);
  assert.equal(utils.getBonusTruquesOrdem(p, 'Ladino'), 0);
});

test('Oráculo 3c: Ladino 5/Clérigo 1 Taumaturgo -- getBonusTruquesOrdem(char, "Clérigo") devolve 1, mas devolve 0 se perguntado pela classe errada (Ladino)', async () => {
  const p = await personagemLadinoClerigo('Taumaturgo');
  assert.equal(utils.getBonusTruquesOrdem(p, 'Clérigo'), 1,
    'a superfície que de fato conjura (Clérigo) deveria ganhar o bônus');
  assert.equal(utils.getBonusTruquesOrdem(p, 'Ladino'), 0,
    'perguntado pela classe ERRADA (o espelho char.classe deste personagem), o bônus não deveria aparecer -- ' +
    'é exatamente essa pergunta errada que o defeito antigo fazia sempre.');
  // Sem segundo argumento: cai em personagem?.classe (o espelho) --
  // comportamento INALTERADO para os chamadores do criador (personagem de
  // uma classe só) e o no-op documentado de levelup-flow.js.
  assert.equal(utils.getBonusTruquesOrdem(p), 0,
    'sem nomeClasse explícito, o default cai no espelho char.classe (Ladino aqui) -- mesmo comportamento de ' +
    'antes da Tarefa 3, preservado de propósito para os chamadores não convertidos.');
});

// ============================================================
// ORÁCULO 4 -- o contador honesto: com DUAS superfícies de conjuração
// (Clérigo 5/Mago 1, as duas do tipo "preparadas") o aviso do contador
// global aparece; com UMA (Clérigo 5 puro), não.
// ============================================================
test('Oráculo 4: Clérigo 5/Mago 1 (duas superfícies) -- o aviso do contador honesto aparece', async () => {
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 }]);
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Clérigo'));
  sheetEstado.definirClassesData(mapaDadosDisco);

  assert.equal(contextoClasse.superficiesDaFicha(p).length, 2,
    'sanity: Clérigo 5/Mago 1 deveria ter duas superfícies de conjuração (as duas conjuram)');

  const html = sheetMagias.renderSecaoMagias();
  assert.match(html, /contam o personagem inteiro/,
    'com duas superfícies de conjuração, a seção precisa avisar que a contagem é do personagem inteiro ' +
    'e o limite mostrado é de uma classe só -- decisão de produto ("o contador honesto").');
  // O aviso nomeia a classe ATIVA (a primeira por ordem de aquisição --
  // aqui, o Clérigo).
  assert.match(html, /Clérigo/);
});

test('Oráculo 4b: Clérigo 5 puro (uma superfície) -- o aviso do contador honesto NÃO aparece', async () => {
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }]);
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Clérigo'));
  sheetEstado.definirClassesData(mapaDadosDisco);

  assert.equal(contextoClasse.superficiesDaFicha(p).length, 1,
    'sanity: Clérigo 5 puro deveria ter exatamente uma superfície de conjuração');

  const html = sheetMagias.renderSecaoMagias();
  assert.doesNotMatch(html, /contam o personagem inteiro/,
    'com UMA superfície de conjuração (classe única), nada deveria mudar na tela -- o aviso do contador ' +
    'honesto é exclusivo de personagem multiclasse com mais de uma classe conjuradora.');
});

// ============================================================
// Oráculos 5-7 -- Tarefa 4 (rodada de revisão 1/5): o SELETOR de classe
// (`#tabs-superficie-magia`) e o estado que ele grava em
// site/js/sheet/contexto-classe.js (`definirSuperficieSelecionada`,
// `resetarSuperficieSelecionada`, `superficieAtivaDaFicha`). Nenhum dos
// três tinha oráculo de unidade -- só a cobertura e2e
// (multiclasse-seletor-magias.spec.mjs), que não alcança o ramo de
// fallback do Oráculo 7 (o seletor da TELA só oferece abas de superfícies
// que o personagem REALMENTE tem; a classe "removida" só é alcançável por
// chamada direta).
//
// `contextoClasse.resetarSuperficieSelecionada()` abre e fecha cada teste
// desta seção: `_classeSuperficieSelecionada` é uma variável de MÓDULO
// (mesmo padrão de `_truquesColapsados`, sheet/colapso.js), e este arquivo
// roda vários testes em sequência no MESMO processo -- sem o reset, uma
// escolha feita aqui vazaria para o próximo teste que chamar
// renderSecaoMagias(), o mesmo vazamento entre personagens que
// `resetarSuperficieSelecionada()` existe para evitar em pages/sheet.js.
// ============================================================

/** Extrai a `class="..."` da aba `data-tab-superficie="<classe>"` do HTML de renderSecaoMagias(). */
function extrairClasseDaAba(html, classe) {
  const re = new RegExp(`<div class="([^"]*)" data-tab-superficie="${classe}">`);
  const m = html.match(re);
  assert.ok(m, `sanity: não achei a aba data-tab-superficie="${classe}" no HTML de renderSecaoMagias()`);
  return m[1];
}

test('Oráculo 5: #tabs-superficie-magia só existe no HTML com MAIS DE UMA superfície de conjuração', async () => {
  contextoClasse.resetarSuperficieSelecionada();

  const duas = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 }]);
  sheetEstado.definirChar(duas);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Clérigo'));
  sheetEstado.definirClassesData(mapaDadosDisco);
  const htmlDuas = sheetMagias.renderSecaoMagias();
  assert.match(htmlDuas, /id="tabs-superficie-magia"/,
    'com duas superfícies de conjuração (Clérigo e Mago), o seletor de classe precisa existir no HTML');
  assert.match(htmlDuas, /data-tab-superficie="Clérigo"/, 'a aba do Clérigo deveria existir');
  assert.match(htmlDuas, /data-tab-superficie="Mago"/, 'a aba do Mago deveria existir');

  contextoClasse.resetarSuperficieSelecionada();
  const uma = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }]);
  sheetEstado.definirChar(uma);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Clérigo'));
  sheetEstado.definirClassesData(mapaDadosDisco);
  const htmlUma = sheetMagias.renderSecaoMagias();
  assert.doesNotMatch(htmlUma, /id="tabs-superficie-magia"/,
    'com UMA superfície de conjuração, o seletor de classe não pode existir no HTML -- é o caso da ' +
    'maioria dos personagens, e ele não pode ganhar um seletor à toa (mesmo critério de ' +
    'conjuracoesPorClasse em sheet/ficha.js)');

  contextoClasse.resetarSuperficieSelecionada();
});

test('Oráculo 6: a aba marcada "active" segue definirSuperficieSelecionada, não fica presa na primeira', async () => {
  contextoClasse.resetarSuperficieSelecionada();

  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 }]);
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Clérigo'));
  sheetEstado.definirClassesData(mapaDadosDisco);

  const htmlPadrao = sheetMagias.renderSecaoMagias();
  assert.match(extrairClasseDaAba(htmlPadrao, 'Clérigo'), /\bactive\b/,
    'sem escolha nenhuma no seletor, a aba ativa deveria ser a PRIMEIRA superfície (a classe ' +
    'inicial, Clérigo) -- o mesmo que a tela sempre mostrou antes do seletor existir');
  assert.doesNotMatch(extrairClasseDaAba(htmlPadrao, 'Mago'), /\bactive\b/,
    'sem escolha nenhuma, a aba do Mago não deveria vir marcada ativa');

  contextoClasse.definirSuperficieSelecionada('Mago');
  const htmlEscolhido = sheetMagias.renderSecaoMagias();
  assert.match(extrairClasseDaAba(htmlEscolhido, 'Mago'), /\bactive\b/,
    'depois de definirSuperficieSelecionada("Mago"), a aba do Mago deveria vir marcada ativa -- se ' +
    'não vier, a marcação "active" não está seguindo o estado do seletor');
  assert.doesNotMatch(extrairClasseDaAba(htmlEscolhido, 'Clérigo'), /\bactive\b/,
    'depois de trocar para o Mago, a aba do Clérigo não deveria continuar ativa -- as duas não podem ' +
    'vir marcadas ao mesmo tempo');

  contextoClasse.resetarSuperficieSelecionada();
});

test('Oráculo 7: superficieAtivaDaFicha cai para a PRIMEIRA superfície quando a classe escolhida não existe mais entre elas', async () => {
  contextoClasse.resetarSuperficieSelecionada();

  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 }]);

  // "Feiticeiro" não é superfície nenhuma deste personagem -- inalcançável
  // pela TELA (o seletor só oferece abas das superfícies reais que
  // superficiesDaFicha devolve), mas alcançável por chamada direta: é
  // exatamente o cenário que resetarSuperficieSelecionada() existe para
  // prevenir na abertura de ficha (pages/sheet.js), e o fallback do
  // próprio find() dentro de superficieAtivaDaFicha é a segunda linha de
  // defesa, para o caso de alguém trocar o personagem em memória sem
  // passar por lá.
  contextoClasse.definirSuperficieSelecionada('Feiticeiro');
  const ativa = contextoClasse.superficieAtivaDaFicha(p);
  assert.equal(ativa?.classe, 'Clérigo',
    'com a classe escolhida ("Feiticeiro") ausente das superfícies do personagem, ' +
    'superficieAtivaDaFicha deveria cair para a PRIMEIRA superfície (Clérigo) -- devolveu ' +
    `${JSON.stringify(ativa)}. Se vier null ou continuar presa a "Feiticeiro", o fallback do find() ` +
    'não está funcionando, e uma classe removida em memória travaria a tela sem superfície nenhuma.');

  contextoClasse.resetarSuperficieSelecionada();
});

// ============================================================
// ORÁCULOS 8 e 9 (onda de correção da revisão final, achado Important 4) --
// a cobertura da TELA era fina exatamente onde o risco estava: TODO cenário
// de tela deste sub-projeto usava Mago e/ou Clérigo, os dois
// `tipo: 'preparadas'`, os dois com colunas de magia na tabela da CLASSE,
// nenhum com reserva de PACTO. O Bruxo e as subclasses conjuradoras tinham
// oráculo só na função PURA (multiclasse-superficies-conjuracao.test.mjs,
// Oráculos 4 e 5) e nunca chegavam a `renderSecaoMagias()`.
//
// O que estes dois passam a medir, e nada media antes:
//   - `tipoConj === 'conhecidas'` NA TELA -- o rótulo do contador alterna
//     entre "Magias Preparadas" e "Magias Conhecidas" conforme a
//     superfície ATIVA (Oráculos 8 e 9);
//   - a superfície de PACTO na seção: um Bruxo 5 não tem círculo 1 nem 2,
//     só dois espaços de 3º (Oráculo 8);
//   - o fallback de limite para a tabela da SUBCLASSE conjuradora
//     (`getLimitesMagias(tabela sem coluna de magia, nível, subConj)`)
//     quando ela é UMA DE DUAS superfícies, não a única (Oráculo 9);
//   - o seletor de classe trocando os DOIS de uma vez -- rótulo e limite --
//     entre superfícies de TIPOS diferentes (Oráculo 9).
// ============================================================
test('Oráculo 8: Guerreiro 5/Bruxo 5 -- a seção mostra o rótulo e os limites do BRUXO ("conhecidas") e a reserva de PACTO', async () => {
  contextoClasse.resetarSuperficieSelecionada();
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }, { classe: 'Bruxo', nivel: 5 }]);
  sheetEstado.definirChar(p);
  // classeData do GUERREIRO -- o espelho da classe inicial, como
  // renderSheet monta (pages/sheet.js:40). O Guerreiro sem Cavaleiro
  // Místico não conjura: se a seção ainda decidisse por ele, não haveria
  // limite nenhum a mostrar.
  sheetEstado.definirClasseData(mapaDadosDisco.get('Guerreiro'));
  sheetEstado.definirClassesData(mapaDadosDisco);

  const superficies = contextoClasse.superficiesDaFicha(p);
  assert.equal(superficies.length, 1,
    'sanity: só o Bruxo conjura neste par (Guerreiro sem subclasse conjuradora) -- uma superfície');
  assert.equal(superficies[0].classe, 'Bruxo',
    'sanity: a única superfície deveria ser a do Bruxo. Se vier vazia, `classesConjuradoras` (que exclui ' +
    'a categoria "pacto" por desenho) voltou a ser a base de superficiesDeConjuracao e o Bruxo sumiu ' +
    'da tela inteira.');

  const html = sheetMagias.renderSecaoMagias();

  // Limites medidos na tabela REAL do Bruxo nível 5 (dados/classes/bruxo.json).
  const limitesBruxo = utils.getLimitesMagias(mapaDadosDisco.get('Bruxo').tabela_caracteristicas, 5, null);
  assert.equal(limitesBruxo.truques, 3, 'sanity: a tabela do Bruxo mudou -- truques de nível 5 não é mais 3');
  assert.equal(limitesBruxo.preparadas, 6, 'sanity: a tabela do Bruxo mudou -- magias de nível 5 não é mais 6');

  const conhecidas = extrairContador(html, 'Magias Conhecidas');
  assert.ok(conhecidas,
    'o Bruxo é `tipo_conjuracao: "conhecidas"` (dados-classes.js) -- o contador precisa se chamar ' +
    '"Magias Conhecidas". Se só existir "Magias Preparadas", o rótulo está saindo do ramo de omissão, ' +
    'que é o defeito irmão registrado em PERGUNTAS-PENDENTES ("MAGIA PREPARADA NAO SABE DE QUE CLASSE E").');
  assert.equal(extrairContador(html, 'Magias Preparadas'), null,
    'com a superfície ativa do tipo "conhecidas", o rótulo "Magias Preparadas" não pode aparecer');
  assert.equal(conhecidas.limite, limitesBruxo.preparadas,
    `o limite mostrado deveria ser o do Bruxo nível 5 (${limitesBruxo.preparadas})`);
  assert.equal(extrairLimiteTruques(html), limitesBruxo.truques,
    `o limite de truques deveria ser o do Bruxo nível 5 (${limitesBruxo.truques})`);

  // A reserva de PACTO na tela: um Bruxo 5 tem DOIS espaços de 3º círculo
  // e NENHUM de 1º ou 2º (bruxo.json, colunas "Espacos de Magia"/"Nivel do
  // Espaco"). É a forma de reserva que nenhum cenário de tela deste
  // sub-projeto exercitava -- todos usavam Conjuração comum.
  assert.match(html, /data-slot-circ="3" data-slot-fonte="pacto"/,
    'a caixa de espaços deveria mostrar o 3º círculo vindo da fonte "pacto" -- se vier "conjuracao", a ' +
    'reserva separada de Magia de Pacto (livro:2118) foi misturada com a tabela comum');
  assert.doesNotMatch(html, /data-slot-circ="1"/,
    'um Bruxo 5 NÃO tem espaço de 1º círculo -- se aparecer, a tela está lendo a tabela errada');
  assert.doesNotMatch(html, /data-slot-circ="2"/,
    'um Bruxo 5 NÃO tem espaço de 2º círculo -- idem');

  contextoClasse.resetarSuperficieSelecionada();
});

test('Oráculo 9: Guerreiro 3 (Cavaleiro Místico)/Mago 3 -- o seletor alterna rótulo E limite entre a tabela da SUBCLASSE e a do Mago', async () => {
  contextoClasse.resetarSuperficieSelecionada();
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 3, subclasse: 'Cavaleiro Místico' },
    { classe: 'Mago', nivel: 3 },
  ]);
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Guerreiro'));
  sheetEstado.definirClassesData(mapaDadosDisco);

  const superficies = contextoClasse.superficiesDaFicha(p);
  assert.equal(superficies.length, 2,
    'sanity: o Cavaleiro Místico (nível 3) conjura por tabela de subclasse e o Mago por tabela de ' +
    'classe -- duas superfícies');
  assert.equal(superficies[0].classe, 'Guerreiro',
    'sanity: a primeira superfície (a ativa por padrão) deveria ser a classe inicial, o Guerreiro');

  // --- Superfície ativa: o Cavaleiro Místico (padrão, ordem 0) ---
  const htmlCM = sheetMagias.renderSecaoMagias();
  // Valores medidos na FONTE da regra (regras-conjuracao-subclasse.js),
  // não chutados: a tabela do Guerreiro não tem coluna de magia nenhuma, e
  // é justamente por isso que getLimitesMagias precisa cair para a
  // subclasse -- sem esse fallback os dois limites viriam 0.
  const conj = regrasConjuracaoSubclasse.getConjuracaoSubclasse('Guerreiro', 'Cavaleiro Místico', 3);
  assert.ok(conj, 'sanity: getConjuracaoSubclasse não devolveu tabela para Cavaleiro Místico nível 3');
  assert.equal(conj.truques, 2, 'sanity: a tabela do Cavaleiro Místico mudou -- truques de nível 3 não é mais 2');
  assert.equal(conj.preparadas, 3, 'sanity: a tabela do Cavaleiro Místico mudou -- magias de nível 3 não é mais 3');

  const cmConhecidas = extrairContador(htmlCM, 'Magias Conhecidas');
  // Dois modos de falha, medidos por mutação ao escrever este oráculo, e
  // a mensagem nomeia os dois: (a) o rótulo saiu "Magias Preparadas" -- o
  // `tipo` da superfície não chegou à tela; (b) o contador SUMIU inteiro --
  // ele só é renderizado com `maxPreparadas > 0`, e sem o fallback para a
  // tabela da subclasse (`subConj` em getLimitesMagias) a tabela do
  // Guerreiro devolve 0 e o bloco nem existe no HTML.
  assert.ok(cmConhecidas,
    'não achei o contador "Magias Conhecidas" no HTML: ou o rótulo saiu "Magias Preparadas" (o tipo da ' +
    'superfície ativa não chegou à tela -- subclasse conjuradora cai em `conhecidas`, ' +
    'regras-multiclasse-conjuracao.js), ou o limite veio 0 e o contador inteiro sumiu (o fallback de ' +
    'getLimitesMagias para a tabela da SUBCLASSE não foi aplicado -- a tabela do Guerreiro não tem ' +
    'coluna de magia nenhuma).');
  assert.equal(cmConhecidas.limite, conj.preparadas,
    `com o Cavaleiro Místico ativo, o limite deveria ser o da tabela da SUBCLASSE (${conj.preparadas}), ` +
    'não 0 (a tabela do Guerreiro não tem coluna de magia) nem o do Mago');
  assert.equal(extrairLimiteTruques(htmlCM), conj.truques,
    `com o Cavaleiro Místico ativo, o limite de truques deveria ser ${conj.truques}`);

  // --- Superfície ativa: o Mago (troca pelo seletor) ---
  contextoClasse.definirSuperficieSelecionada('Mago');
  const htmlMago = sheetMagias.renderSecaoMagias();
  const limitesMago = utils.getLimitesMagias(mapaDadosDisco.get('Mago').tabela_caracteristicas, 3, null);
  assert.equal(limitesMago.truques, 3, 'sanity: a tabela do Mago mudou -- truques de nível 3 não é mais 3');
  assert.equal(limitesMago.preparadas, 6, 'sanity: a tabela do Mago mudou -- preparadas de nível 3 não é mais 6');

  const magoPreparadas = extrairContador(htmlMago, 'Magias Preparadas');
  assert.ok(magoPreparadas,
    'depois de trocar para o Mago, o rótulo tem de virar "Magias Preparadas" -- se continuar ' +
    '"Magias Conhecidas", o TIPO da superfície não está seguindo o seletor, só o limite está');
  assert.equal(extrairContador(htmlMago, 'Magias Conhecidas'), null,
    'com o Mago ativo o rótulo "Magias Conhecidas" (do Cavaleiro Místico) não pode continuar na tela');
  assert.equal(magoPreparadas.limite, limitesMago.preparadas,
    `com o Mago ativo, o limite deveria ser o do Mago nível 3 (${limitesMago.preparadas}), não o da ` +
    `subclasse (${conj.preparadas})`);
  assert.equal(extrairLimiteTruques(htmlMago), limitesMago.truques,
    `com o Mago ativo, o limite de truques deveria ser ${limitesMago.truques}, não ${conj.truques}`);

  contextoClasse.resetarSuperficieSelecionada();
});
