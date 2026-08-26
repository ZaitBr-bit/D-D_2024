// ============================================================
// Motor de regras de multiclasse: conjuracao e progressao.
//
// Confronta o app com o CATALOGO (transcrito do livro), e em dois
// oraculos com as tabelas de classe do proprio acervo -- que sao fonte
// independente, ninguem as transcreveu para este sub-projeto.
//
// Nenhum teste aqui pode passar antes da implementacao: rode o arquivo
// contra a arvore intacta e confirme `# pass 0` antes de codar.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modulosApp, personagemMulticlasse, RAIZ } from './harness.mjs';
import {
  // PRE_REQUISITOS ainda nao tem oraculo NESTE arquivo -- a Tarefa 2
  // acrescenta o oraculo 6 (pre-requisito de 13+) aqui mesmo e o usa. Nao
  // e import morto, e antecipado.
  PRE_REQUISITOS, CATEGORIA_CONJURACAO, TABELA_CONJURADOR_MULTICLASSE,
} from '../catalogo/multiclasse.mjs';

const CLASSES = Object.keys(CATEGORIA_CONJURACAO);

// Peso de cada classe na soma, direto do catalogo -- para o teste nao
// repetir a implementacao que ele mede.
function pesoDe(categoria, nivel) {
  if (categoria === 'plena') return nivel;
  if (categoria === 'meia') return Math.ceil(nivel / 2);
  if (categoria === 'um_terco_subclasse') return Math.floor(nivel / 3);
  return 0;
}

// Subclasse conjuradora de cada classe de 1/3, para montar fixtures.
const SUBCLASSE_CONJ = { 'Guerreiro': 'Cavaleiro Místico', 'Ladino': 'Trapaceiro Arcano' };

// ORÁCULO 1 -- varredura das 132 combinacoes ordenadas de duas classes.
test('nivel de conjurador nas 132 combinacoes de duas classes', async () => {
  const { multiclasseConjuracao: mc } = await modulosApp();
  let conferidas = 0;
  for (const a of CLASSES) {
    for (const b of CLASSES) {
      if (a === b) continue;
      const p = await personagemMulticlasse([
        { classe: a, nivel: 6, subclasse: SUBCLASSE_CONJ[a] || '' },
        { classe: b, nivel: 6, subclasse: SUBCLASSE_CONJ[b] || '' },
      ]);
      const catA = CATEGORIA_CONJURACAO[a];
      const catB = CATEGORIA_CONJURACAO[b];
      const conta = (cat) => cat === 'plena' || cat === 'meia' || cat === 'um_terco_subclasse';
      const nConj = [catA, catB].filter(conta).length;
      const esperado = nConj >= 2 ? pesoDe(catA, 6) + pesoDe(catB, 6) : 0;
      assert.equal(mc.nivelConjurador(p), esperado, `${a} 6 / ${b} 6`);
      conferidas++;
    }
  }
  assert.equal(conferidas, 132, 'a varredura tem de cobrir as 132 combinacoes ordenadas');
});

// ORÁCULO 2 -- a regra do livro:2071.
test('com UMA classe conjuradora, espacosPorCirculo devolve null', async () => {
  const { multiclasseConjuracao: mc } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Paladino', nivel: 5 }, { classe: 'Guerreiro', nivel: 2 },
  ]);
  assert.equal(mc.usaTabelaUnificada(p), false, 'Paladino/Guerreiro sem subclasse tem UMA conjuradora');
  assert.equal(mc.espacosPorCirculo(p), null,
    'null e o sinal de "siga as regras daquela classe" -- {} seria lido como zero espacos');
  assert.equal(mc.nivelConjurador(p), 0);

  const duas = await personagemMulticlasse([
    { classe: 'Paladino', nivel: 5 }, { classe: 'Mago', nivel: 3 },
  ]);
  assert.equal(mc.usaTabelaUnificada(duas), true);
  assert.notEqual(mc.espacosPorCirculo(duas), null);
});

// ORÁCULO 3 -- 1/3 conjurador so conta com a subclasse.
test('Guerreiro e Ladino contam zero sem a subclasse conjuradora', async () => {
  const { multiclasseConjuracao: mc } = await modulosApp();
  for (const [classe, sub] of Object.entries(SUBCLASSE_CONJ)) {
    const sem = await personagemMulticlasse([
      { classe, nivel: 9 }, { classe: 'Mago', nivel: 5 },
    ]);
    assert.equal(mc.classesConjuradoras(sem).length, 1, `${classe} sem subclasse nao conjura`);
    assert.equal(mc.nivelConjurador(sem), 0, `uma conjuradora so -> 0`);

    const com = await personagemMulticlasse([
      { classe, nivel: 9, subclasse: sub }, { classe: 'Mago', nivel: 5 },
    ]);
    assert.equal(mc.nivelConjurador(com), Math.floor(9 / 3) + 5, `${sub}: floor(9/3) + 5`);
  }
});

// ORÁCULO 4 -- Bruxo fora da soma.
test('Bruxo nao entra na soma; Magia de Pacto e reserva separada', async () => {
  const { multiclasseConjuracao: mc } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Bruxo', nivel: 5 }, { classe: 'Feiticeiro', nivel: 3 },
  ]);
  assert.equal(mc.temMagiaDePacto(p), true);
  assert.deepEqual(mc.classesConjuradoras(p).map((c) => c.classe), ['Feiticeiro'],
    'Bruxo tem Magia de Pacto, nao Conjuracao (livro:2118)');
  assert.equal(mc.usaTabelaUnificada(p), false, 'so o Feiticeiro conjura -> uma classe so');
  assert.equal(mc.espacosPorCirculo(p), null);

  const soBruxo = await personagemMulticlasse([
    { classe: 'Bruxo', nivel: 5 }, { classe: 'Guerreiro', nivel: 2 },
  ]);
  assert.equal(mc.temMagiaDePacto(soBruxo), true);
  assert.equal(mc.nivelConjurador(soBruxo), 0);
});

// ORÁCULO 5 -- o exemplo literal do livro:2114.
test('exemplo do livro: Guardiao 4 / Feiticeiro 3 tem 4/3/2', async () => {
  const { multiclasseConjuracao: mc } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Guardião', nivel: 4 }, { classe: 'Feiticeiro', nivel: 3 },
  ]);
  assert.equal(mc.nivelConjurador(p), 5, 'ceil(4/2) + 3 = 5');
  assert.deepEqual(mc.espacosPorCirculo(p), { 1: 4, 2: 3, 3: 2 });
});

// ORÁCULO 10 -- a tabela de producao contra SETE tabelas independentes do acervo.
test('a tabela unificada reproduz a tabela propria dos plenos e meios', async () => {
  const { multiclasseConjuracao: mc } = await modulosApp();
  const PESOS = { 'Bardo': 'plena', 'Clérigo': 'plena', 'Druida': 'plena',
    'Feiticeiro': 'plena', 'Mago': 'plena', 'Guardião': 'meia', 'Paladino': 'meia' };
  const ARQ = { 'Bardo': 'bardo', 'Clérigo': 'clerigo', 'Druida': 'druida',
    'Feiticeiro': 'feiticeiro', 'Mago': 'mago', 'Guardião': 'guardiao', 'Paladino': 'paladino' };
  let comparacoes = 0;
  for (const [classe, categoria] of Object.entries(PESOS)) {
    const dados = JSON.parse(readFileSync(
      resolve(RAIZ, 'dados', 'classes', `${ARQ[classe]}.json`), 'utf-8'));
    for (const linha of dados.tabela_caracteristicas) {
      const n = parseInt(String(linha['Nível']).replace(/[^0-9]/g, ''), 10);
      if (!(n >= 1 && n <= 20)) continue;
      const propria = [];
      for (let c = 1; c <= 9; c++) {
        const v = linha[String(c)];
        propria.push(!v || v === '—' || v === '-' ? 0 : parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0);
      }
      const peso = categoria === 'plena' ? n : Math.ceil(n / 2);
      assert.deepEqual(mc.TABELA_CONJURADOR_MULTICLASSE[peso], propria,
        `${classe} nivel ${n}: a tabela unificada em ${peso} tem de reproduzir a tabela da classe`);
      comparacoes++;
    }
  }
  assert.equal(comparacoes, 140, '7 classes x 20 niveis');
});

// ORÁCULO 11 -- a tabela unificada em floor(n/3) contra a fonte
// INDEPENDENTE de verdade (Correcao final, item 7). A versao anterior
// fazia `assert.ok(Number.isInteger(n/3))` sobre LITERAIS (3, 6, 9...) --
// isso nao toca o app nenhuma vez. E as tres asercoes de nao-equivalencia
// eram `notDeepEqual` contra uma tabela PROPRIA transcrita a mao aqui
// mesmo, nunca lida de regras-conjuracao-subclasse.js -- a fonte
// independente que o desenho apontava (docs/superpowers/specs/
// 2026-08-22-multiclasse-motor-design.md, secao "A regra 2071"). Agora mede
// as DUAS fontes reais uma contra a outra, para os 18 niveis de 3 a 20:
// getConjuracaoSubclasse() (a tabela da subclasse, unica fonte dela no app)
// e TABELA_CONJURADOR_MULTICLASSE[floor(n/3)] (a tabela unificada).
test('a tabela unificada em floor(n/3) coincide so nos multiplos de 3, contra a fonte da subclasse', async () => {
  const { multiclasseConjuracao: mc, regrasConjuracaoSubclasse: rcs } = await modulosApp();
  const coincidem = [];
  const divergem = [];
  for (let n = 3; n <= 20; n++) {
    const propria = rcs.getConjuracaoSubclasse('Guerreiro', 'Cavaleiro Místico', n).espacos;
    const linha = mc.TABELA_CONJURADOR_MULTICLASSE[Math.floor(n / 3)];
    const unificada = {};
    linha.forEach((q, i) => { if (q > 0) unificada[i + 1] = q; });
    if (n % 3 === 0) {
      assert.deepEqual(unificada, propria,
        `nivel ${n} (multiplo de 3): floor(${n}/3) = ${n / 3} tem de reproduzir a tabela da subclasse`);
      coincidem.push(n);
    } else {
      assert.notDeepEqual(unificada, propria,
        `nivel ${n}: a unificada em floor(n/3) NAO pode coincidir com a tabela do 1/3 conjurador`);
      divergem.push(n);
    }
  }
  assert.deepEqual(coincidem, [3, 6, 9, 12, 15, 18],
    'so os multiplos de 3 coincidem, dos 18 niveis de 3 a 20');
  assert.equal(divergem.length, 12, 'os outros 12 niveis divergem');
});

// ORÁCULO 12 -- a DIRECAO do arredondamento em nivelConjurador (Rodada 1
// de correcao: nenhum dos oraculos 1-11 usava um nivel onde ceil() e
// floor() DIVERGEM -- 6, 9 e 4 sao multiplos de 2 e de 3 ao mesmo tempo,
// entao trocar Math.ceil por Math.floor no ramo 'meia' (ou o inverso no
// ramo 'um_terco_subclasse') passava 7/7 em silencio. Os valores abaixo
// sao LITERAIS, nao recalculados com Math.ceil/Math.floor -- um teste que
// repete a formula da implementacao nao a mede (foi assim que o oraculo
// 11 escapou).
test('nivelConjurador respeita a direcao do arredondamento', async () => {
  const { multiclasseConjuracao: mc } = await modulosApp();

  // Guardião 5 (meia): livro:2107 manda arredondar PARA CIMA -- ceil(5/2)
  // = 3, nao floor(5/2) = 2. Somado ao Mago 1 (plena, peso = nivel): 4.
  // Se o ramo 'meia' usasse floor, o resultado seria 3.
  const guardiao5 = await personagemMulticlasse([
    { classe: 'Guardião', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  assert.equal(mc.nivelConjurador(guardiao5), 4,
    'Guardião 5 (ceil(5/2)=3) + Mago 1 = 4 -- floor daria 3');

  // Paladino 7 (meia): ceil(7/2) = 4, nao floor(7/2) = 3. Somado ao Mago 1: 5.
  const paladino7 = await personagemMulticlasse([
    { classe: 'Paladino', nivel: 7 }, { classe: 'Mago', nivel: 1 },
  ]);
  assert.equal(mc.nivelConjurador(paladino7), 5,
    'Paladino 7 (ceil(7/2)=4) + Mago 1 = 5 -- floor daria 4');

  // Cavaleiro Místico 7 (um_terco_subclasse): floor(7/3) = 2, nao
  // ceil(7/3) = 3. Somado ao Mago 1: 3. Se o ramo usasse ceil, seria 4.
  const cavaleiro7 = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 7, subclasse: 'Cavaleiro Místico' },
    { classe: 'Mago', nivel: 1 },
  ]);
  assert.equal(mc.nivelConjurador(cavaleiro7), 3,
    'Cavaleiro Místico 7 (floor(7/3)=2) + Mago 1 = 3 -- ceil daria 4');

  // Trapaceiro Arcano 8 (um_terco_subclasse): floor(8/3) = 2, nao
  // ceil(8/3) = 3. Somado ao Mago 1: 3.
  const trapaceiro8 = await personagemMulticlasse([
    { classe: 'Ladino', nivel: 8, subclasse: 'Trapaceiro Arcano' },
    { classe: 'Mago', nivel: 1 },
  ]);
  assert.equal(mc.nivelConjurador(trapaceiro8), 3,
    'Trapaceiro Arcano 8 (floor(8/3)=2) + Mago 1 = 3 -- ceil daria 4');
});

// ORÁCULO 12b -- a ORDEM das operacoes: arredonda POR CLASSE, depois soma.
//
// O Oraculo 12 acima mede a DIRECAO do arredondamento, e mede com UM
// meio-conjurador so. Com um so, "arredondar cada classe" e "arredondar a
// soma" dao o mesmo numero SEMPRE -- as duas leituras nunca divergem, e a
// varredura de 132 combinacoes (linha 40) usa nivel 6 nas duas classes,
// onde 3+3 = ceil(12/2) tambem coincide. Resultado: antes deste oraculo,
// trocar o reduce por um agrupamento-por-categoria-antes-de-arredondar
// passava a suite INTEIRA em silencio, mudando o numero de espacos de
// magia de qualquer ficha com dois meio-conjuradores.
//
// A REGRA. A frase do livro:2107 ("Metade dos seus niveis (arredonde para
// cima) NAS CLASSES Guardiao e Paladino") e ambigua nas duas linguas --
// http://dnd2024.wikidot.com/class:multiclassing traz a mesma construcao
// em ingles. A regra oficial e a leitura POR CLASSE: Jeremy Crawford,
// 18/10/2016, "Multiclass spell slots: when dividing the levels of
// multiple classes, you divide, round down, and then add the results
// together". O 2024 trocou o SENTIDO do arredondamento dos meios (para
// cima), nao a ORDEM das operacoes.
//
// Os valores abaixo sao LITERAIS, nao recalculados com a formula da
// implementacao -- mesmo cuidado do Oraculo 12.
test('nivelConjurador arredonda POR CLASSE, nao sobre a soma', async () => {
  const { multiclasseConjuracao: mc } = await modulosApp();

  // O PAR MINIMO onde as duas leituras divergem. Por classe:
  // ceil(3/2) + ceil(3/2) = 2 + 2 = 4. Pela soma: ceil(6/2) = 3.
  const guardiaoPaladino = await personagemMulticlasse([
    { classe: 'Guardião', nivel: 3 }, { classe: 'Paladino', nivel: 3 },
  ]);
  assert.equal(mc.nivelConjurador(guardiaoPaladino), 4,
    'Guardião 3/Paladino 3 = 2 + 2 = 4. Agrupar por categoria antes de ' +
    'arredondar daria ceil(6/2) = 3.');

  // E a DIFERENCA tem de aparecer nos espacos de verdade, senao o oraculo
  // prende so o numero intermediario e nao o que o jogador ve: nivel de
  // conjurador 4 e a linha [4, 3] da tabela; o nivel 3 seria [4, 2]. Um
  // espaco de 2o circulo a mais.
  const espacos = mc.espacosPorCirculo(guardiaoPaladino);
  assert.equal(espacos[2], 3,
    'nível de conjurador 4 dá 3 espaços de 2º círculo; o nível 3 daria 2');
  assert.equal(espacos[3], undefined,
    'nenhum dos dois níveis dá espaço de 3º círculo -- fixado para o oráculo ' +
    'não passar a impressão de que a diferença está no 3º');

  // O MESMO na direcao oposta, no marcador de um terco: por classe
  // floor(5/3) + floor(5/3) = 1 + 1 = 2. Pela soma, floor(10/3) = 3.
  // Aqui a leitura por soma seria mais GENEROSA -- prova que a diferenca
  // nao e um vies de arredondamento, e a ordem das operacoes.
  const doisUmTerco = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5, subclasse: 'Cavaleiro Místico' },
    { classe: 'Ladino', nivel: 5, subclasse: 'Trapaceiro Arcano' },
  ]);
  assert.equal(mc.nivelConjurador(doisUmTerco), 2,
    'Cavaleiro Místico 5 + Trapaceiro Arcano 5 = 1 + 1 = 2. Somar antes ' +
    'daria floor(10/3) = 3.');

  // Tres meio-conjuradores nao existem no livro (so ha dois), entao o caso
  // de tres nao e testavel; mas UM meio + UM pleno tem de continuar batendo
  // com o Oraculo 12, para o guarda nao virar uma reescrita disfarcada.
  const meioMaisPleno = await personagemMulticlasse([
    { classe: 'Paladino', nivel: 3 }, { classe: 'Feiticeiro', nivel: 3 },
  ]);
  assert.equal(mc.nivelConjurador(meioMaisPleno), 5,
    'Paladino 3 (ceil(3/2)=2) + Feiticeiro 3 (pleno) = 5');
});

// ORÁCULO 6 -- pre-requisito confere a classe nova E as atuais, nas 132 combinacoes.
test('pre-requisito confere a classe nova E as atuais, nas 132 combinacoes', async () => {
  const { multiclasseProgressao: mp } = await modulosApp();
  const CHAVE = { 'Força': 'forca', 'Destreza': 'destreza', 'Constituição': 'constituicao',
    'Inteligência': 'inteligencia', 'Sabedoria': 'sabedoria', 'Carisma': 'carisma' };
  let conferidas = 0;
  for (const atual of CLASSES) {
    for (const nova of CLASSES) {
      if (atual === nova) continue;
      // Personagem com 13 em tudo: qualquer combinacao e permitida.
      const bom = await personagemMulticlasse([{ classe: atual, nivel: 3 }]);
      for (const k of Object.values(CHAVE)) bom.atributos[k] = 13;
      assert.equal(mp.podeEntrarEm(bom, nova).permitido, true,
        `${atual} -> ${nova} com 13 em tudo tem de ser permitido`);

      // Baixar para 12 QUALQUER atributo exigido pela classe nova, quando o
      // conector e 'e', tem de bloquear. Com 'ou', bloqueia so se os dois cairem.
      const req = PRE_REQUISITOS[nova];
      const ruim = await personagemMulticlasse([{ classe: atual, nivel: 3 }]);
      for (const k of Object.values(CHAVE)) ruim.atributos[k] = 13;
      if (req.conector === 'ou') {
        for (const a of req.lista) ruim.atributos[CHAVE[a]] = 12;
      } else {
        ruim.atributos[CHAVE[req.lista[0]]] = 12;
      }
      assert.equal(mp.podeEntrarEm(ruim, nova).permitido, false,
        `${atual} -> ${nova} sem o atributo primario tem de ser bloqueado`);
      conferidas++;
    }
  }
  assert.equal(conferidas, 132);
});

// ORÁCULO 7 -- Guerreiro e a unica com conector 'ou'.
test('Guerreiro aceita Forca OU Destreza; as de dois atributos exigem os dois', async () => {
  const { multiclasseProgressao: mp } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 3 }]);
  p.atributos = { forca: 13, destreza: 12, constituicao: 10,
    inteligencia: 10, sabedoria: 13, carisma: 10 };
  assert.equal(mp.podeEntrarEm(p, 'Guerreiro').permitido, true, 'Forca 13 basta');
  p.atributos.forca = 12; p.atributos.destreza = 13;
  assert.equal(mp.podeEntrarEm(p, 'Guerreiro').permitido, true, 'Destreza 13 basta');
  p.atributos.destreza = 12;
  assert.equal(mp.podeEntrarEm(p, 'Guerreiro').permitido, false, 'nenhum dos dois -> bloqueia');

  // Paladino exige Forca E Carisma.
  p.atributos = { forca: 13, destreza: 10, constituicao: 10,
    inteligencia: 10, sabedoria: 13, carisma: 12 };
  assert.equal(mp.podeEntrarEm(p, 'Paladino').permitido, false, 'Carisma 12 bloqueia');
  p.atributos.carisma = 13;
  assert.equal(mp.podeEntrarEm(p, 'Paladino').permitido, true);
});

// ORÁCULO 8 -- `faltando` diz o que falta, e de qual classe.
test('faltando nomeia classe, atributo e valor atual', async () => {
  const { multiclasseProgressao: mp } = await modulosApp();
  // Barbaro (Forca) querendo Druida (Sabedoria), com Sabedoria 11.
  const p = await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 3 }]);
  p.atributos = { forca: 15, destreza: 10, constituicao: 10,
    inteligencia: 10, sabedoria: 11, carisma: 10 };
  const r = mp.podeEntrarEm(p, 'Druida');
  assert.equal(r.permitido, false);
  assert.deepEqual(r.faltando, [{ classe: 'Druida', atributo: 'Sabedoria', valor: 11 }]);

  // O sentido inverso: Druida com Forca 8 nao pode pegar Barbaro.
  const d = await personagemMulticlasse([{ classe: 'Druida', nivel: 3 }]);
  d.atributos = { forca: 8, destreza: 10, constituicao: 10,
    inteligencia: 10, sabedoria: 15, carisma: 10 };
  const r2 = mp.podeEntrarEm(d, 'Bárbaro');
  assert.equal(r2.permitido, false);
  assert.deepEqual(r2.faltando, [{ classe: 'Bárbaro', atributo: 'Força', valor: 8 }]);
});

// ORÁCULO 9 -- PV: dado cheio so no nivel total 1, e o dado da classe que SOBE.
test('PV usa o dado da classe que sobe, e o dado cheio so no nivel total 1', async () => {
  const { multiclasseProgressao: mp } = await modulosApp();
  const vazio = { classes: [], atributos: { constituicao: 14 } };  // modCON = +2
  assert.equal(mp.pvGanhoAoSubir(vazio, 'Paladino', {}), 10 + 2,
    'nivel total 0 -> este e o 1o nivel: dado CHEIO');

  const pal3 = await personagemMulticlasse([{ classe: 'Paladino', nivel: 3 }]);
  pal3.atributos.constituicao = 14;
  // O defeito que este teste existe para impedir (levelup.js:1067): usar o
  // dado do Paladino (d10) ao subir o primeiro nivel de Feiticeiro (d6).
  assert.equal(mp.pvGanhoAoSubir(pal3, 'Feiticeiro', {}), Math.floor(6 / 2) + 1 + 2,
    'd6 do Feiticeiro: media 4 + 2 = 6');
  assert.equal(mp.pvGanhoAoSubir(pal3, 'Paladino', {}), Math.floor(10 / 2) + 1 + 2,
    'd10 do Paladino: media 6 + 2 = 8');

  // Modo rolado, limitado pelas faces DAQUELA classe.
  assert.equal(mp.pvGanhoAoSubir(pal3, 'Feiticeiro', { rolado: 5 }), 5 + 2);
  assert.equal(mp.pvGanhoAoSubir(pal3, 'Feiticeiro', { rolado: 9 }), 6 + 2,
    'rolagem acima das faces do d6 e limitada a 6');
  assert.equal(mp.pvGanhoAoSubir(pal3, 'Feiticeiro', { rolado: 0 }), 1 + 2,
    'rolagem abaixo de 1 e elevada a 1');
});

// ORÁCULO 13 -- a classe ATUAL tambem pode ser a que bloqueia (Rodada 1 de
// correcao: os oraculos 6-8 so cobriam a classe NOVA bloqueando -- o
// oraculo 8 rotulava um caso de "sentido inverso" que na verdade tambem
// media a classe nova (Forca e o atributo primario do Barbaro, que ali
// era a classe nova). Com o laco `for (const c of classesDe(char))`
// removido de podeEntrarEm, ou com `faltando.push` acusando sempre
// `nomeClasse` em vez da classe que exigiu, os 12 oraculos anteriores
// continuavam verdes -- este oraculo existe para fechar esse buraco).
test('a classe ATUAL bloqueia quando deixa de atender seu proprio requisito', async () => {
  const { multiclasseProgressao: mp } = await modulosApp();

  // 1) Barbaro (Forca 12, abaixo do proprio limiar) querendo Druida, com
  // Sabedoria 15 (a Druida esta atendida de sobra). Bloqueia mesmo assim,
  // e quem aparece em `faltando` e o BARBARO -- a classe ATUAL -- nao a
  // Druida.
  const barbaro12 = await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 3 }]);
  barbaro12.atributos = { forca: 12, destreza: 10, constituicao: 10,
    inteligencia: 10, sabedoria: 15, carisma: 10 };
  const r1 = mp.podeEntrarEm(barbaro12, 'Druida');
  assert.equal(r1.permitido, false, 'Barbaro com Forca 12 nao pode multiclassar em nada');
  assert.deepEqual(r1.faltando, [{ classe: 'Bárbaro', atributo: 'Força', valor: 12 }]);

  // 2) O espelho: Druida (Sabedoria 12) querendo Barbaro, com Forca 15 (o
  // Barbaro esta atendido de sobra). Quem bloqueia e a DRUIDA.
  const druida12 = await personagemMulticlasse([{ classe: 'Druida', nivel: 3 }]);
  druida12.atributos = { forca: 15, destreza: 10, constituicao: 10,
    inteligencia: 10, sabedoria: 12, carisma: 10 };
  const r2 = mp.podeEntrarEm(druida12, 'Bárbaro');
  assert.equal(r2.permitido, false);
  assert.deepEqual(r2.faltando, [{ classe: 'Druida', atributo: 'Sabedoria', valor: 12 }]);

  // 3) O par positivo que fecha a prova: com os dois atributos em 13, os
  // dois sentidos passam. Sem este caso, uma implementacao que bloqueasse
  // tudo passaria nos dois casos acima.
  const barbaro13 = await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 3 }]);
  barbaro13.atributos = { forca: 13, destreza: 10, constituicao: 10,
    inteligencia: 10, sabedoria: 13, carisma: 10 };
  const r3 = mp.podeEntrarEm(barbaro13, 'Druida');
  assert.equal(r3.permitido, true);
  assert.deepEqual(r3.faltando, []);

  // 4) Duas classes atuais: o laco tem de percorrer TODAS, nao so a
  // primeira. Barbaro 3 (Forca 15, atende) / Clerigo 3 (Sabedoria 12, NAO
  // atende) querendo Guerreiro (Forca 15 atende). Bloqueia por causa do
  // Clerigo, que e a segunda classe do roteiro.
  const duasClasses = await personagemMulticlasse([
    { classe: 'Bárbaro', nivel: 3 }, { classe: 'Clérigo', nivel: 3 },
  ]);
  duasClasses.atributos = { forca: 15, destreza: 10, constituicao: 10,
    inteligencia: 10, sabedoria: 12, carisma: 10 };
  const r4 = mp.podeEntrarEm(duasClasses, 'Guerreiro');
  assert.equal(r4.permitido, false, 'Clerigo com Sabedoria 12 bloqueia mesmo com Forca de sobra');
  assert.deepEqual(r4.faltando, [{ classe: 'Clérigo', atributo: 'Sabedoria', valor: 12 }]);
});

// ORÁCULO 14 -- PV nunca cai abaixo de 1 (Correcao final, item 1). O
// livro:1963 e explicito: "some o total (MINIMO DE 1) aos seus Pontos de
// Vida maximos". levelup.js:350 e :368 ja aplicam esse piso para classe
// unica; pvGanhoAoSubir tinha de aplicar o MESMO piso nos tres caminhos de
// retorno (dado cheio, media, rolado), ou um personagem de Constituicao
// baixa (CON 8, atributo de descarte de rotina, e a ficha permite editar
// atributos desde a 2.2.15) PERDE PV maximo ao subir de nivel.
test('PV nunca cai abaixo de 1, nos tres modos', async () => {
  const { multiclasseProgressao: mp } = await modulosApp();
  // Nivel total > 0 (nao e o 1o nivel do personagem), para exercitar os
  // ramos de media e de rolado -- com nivelTotal(char) === 0 o ramo de dado
  // cheio ignora `rolado` por completo.
  const base = (con) => ({
    classes: [{ classe: 'Paladino', subclasse: '', nivel: 3, ordem: 0 }],
    atributos: { constituicao: con },
  });

  // Rolado: CON 8 (mod -1), rolagem 1 -- sem o piso, 1 + (-1) = 0.
  assert.equal(mp.pvGanhoAoSubir(base(8), 'Feiticeiro', { rolado: 1 }), 1,
    'CON 8 (mod -1) com rolagem 1: sem o piso daria 0');
  // Rolado: CON 6 (mod -2), rolagem 1 -- sem o piso, 1 + (-2) = -1: o
  // personagem PERDERIA PV maximo ao subir de nivel.
  assert.equal(mp.pvGanhoAoSubir(base(6), 'Feiticeiro', { rolado: 1 }), 1,
    'CON 6 (mod -2) com rolagem 1: sem o piso daria -1');
  // Fixo (media): CON 3 (mod -4), d6 do Feiticeiro -- media floor(6/2)+1 = 4;
  // sem o piso, 4 + (-4) = 0.
  assert.equal(mp.pvGanhoAoSubir(base(3), 'Feiticeiro', {}), 1,
    'CON 3 (mod -4) no modo fixo com d6 (media 4): sem o piso daria 0');
  // Prova de que o piso nao estraga o caso normal: CON 14 (mod +2), rolagem 5
  // num d6 -- nada aqui deveria ser elevado a 1.
  assert.equal(mp.pvGanhoAoSubir(base(14), 'Feiticeiro', { rolado: 5 }), 7,
    'CON 14 (mod +2) com rolagem 5: 5 + 2 = 7, o piso nao entra aqui');
});

// ORÁCULO 15 -- podeEntrarEm nao bloqueia subir de nivel na classe que o
// personagem JA TEM (Correcao final, item 2). O livro:2033 impoe o 13+ para
// "se qualificar para uma NOVA classe" -- subir de nivel na classe que voce
// ja tem nao e qualificar-se para nada. Um Monge 5 com Sabedoria 12 e
// personagem legal e criavel hoje (classe unica nunca teve minimo de
// atributo), mas sem este conserto `podeEntrarEm` recusava a propria
// subida de nivel em Monge.
test('podeEntrarEm permite subir na classe ja possuida, mesmo sem o 13+', async () => {
  const { multiclasseProgressao: mp } = await modulosApp();
  const monge5Sab12 = {
    classes: [{ classe: 'Monge', subclasse: '', nivel: 5, ordem: 0 }],
    atributos: { forca: 10, destreza: 15, constituicao: 10,
      inteligencia: 10, sabedoria: 12, carisma: 10 },
  };
  // Classe JA possuida: sim, mesmo com Sabedoria 12 (abaixo do proprio
  // limiar de Monge, que exige Destreza E Sabedoria 13+).
  const r1 = mp.podeEntrarEm(monge5Sab12, 'Monge');
  assert.equal(r1.permitido, true,
    'subir de nivel na propria classe nao exige requisito nenhum');
  assert.deepEqual(r1.faltando, []);

  // Para nao afrouxar o resto: o MESMO personagem tentando uma classe NOVA
  // (Druida, que exige Sabedoria 13+) continua bloqueado.
  const r2 = mp.podeEntrarEm(monge5Sab12, 'Druida');
  assert.equal(r2.permitido, false,
    'classe NOVA continua exigindo o 13+ -- so a classe ja possuida e isenta');
});

// ORÁCULO 16 -- classe desconhecida falha FECHADA em podeEntrarEm (Correcao
// final, item 3). CLASSES_INFO['Necromante'] e undefined; sem este conserto
// a funcao retornava cedo com `{ permitido: true }` -- uma classe que nao
// existe no catalogo passava como se fosse permitida. pvGanhoAoSubir (a
// funcao irma) falha FECHADA para a mesma entrada (devolve 0); as duas
// tinham de concordar na direcao do erro numa funcao que decide o que o
// jogador pode escolher.
test('classe desconhecida falha fechada em podeEntrarEm', async () => {
  const { multiclasseProgressao: mp } = await modulosApp();
  const p = {
    classes: [{ classe: 'Mago', subclasse: '', nivel: 3, ordem: 0 }],
    atributos: { forca: 15, destreza: 15, constituicao: 15,
      inteligencia: 15, sabedoria: 15, carisma: 15 },
  };
  const r1 = mp.podeEntrarEm(p, 'Necromante');
  assert.equal(r1.permitido, false, 'classe fora do catalogo tem de ser recusada');
  assert.deepEqual(r1.faltando, [{ classe: 'Necromante', atributo: null, valor: null }]);

  // 'Guardiao' sem o acento tambem nao esta em CLASSES_INFO (a chave e
  // 'Guardião') -- mesmo tratamento.
  const r2 = mp.podeEntrarEm(p, 'Guardiao');
  assert.equal(r2.permitido, false, "'Guardiao' sem acento nao existe no catalogo");
  assert.deepEqual(r2.faltando, [{ classe: 'Guardiao', atributo: null, valor: null }]);
});
