// ============================================================
// Oraculo de ALCANCE do sub-projeto 3d (combate, CA, salvaguardas e
// maestrias).
//
// POR QUE ESTE ARQUIVO EXISTE
// ---------------------------
// O sub-projeto 3c mediu, no braco, que oraculos PONTUAIS nao prendem a
// propriedade geral: revertendo UMA A UMA as 60 conversoes de
// `setupEventosHabilidades`, 55 continuavam passando pelos 9 oraculos de
// `testes/e2e/regras/multiclasse-handlers.spec.mjs`. O caso concreto que
// ele exibiu: reverter uma linha fazia um Barbaro 10/Guerreiro 5 curar
// `1d10+15` em vez de `1d10+5`, e tudo seguia verde.
//
// A resposta foi um GUARDA ESTATICO -- `multiclasse-handlers-alcance.test.mjs`
// -- que le o arquivo e exige ZERO leitura de espelho na faixa, com as
// excecoes declaradas por texto e com o motivo escrito. Ele mediu 58
// conversoes revertidas, 58 pegas.
//
// Este arquivo e o analogo para o 3d, que converteu:
//   Tarefa 1  -- `regras-salvaguardas.js` (Sobrevivente Disciplinado, do
//                Monge 14, e Mente Escorregadia, do Ladino 15);
//   Tarefa 2  -- `getAtaquesPorAcao()` em `sheet/combate.js`;
//   Tarefa 2b -- as outras 14 leituras de `sheet/combate.js`;
//   Tarefa 3  -- `calcCA` em `utils.js`, mais o coletor e o escolhedor de
//                CA alternativa que a substituiram;
//   Tarefa 5  -- o teto agregado de maestrias em `sheet/maestrias.js` e o
//                gate do Descanso Longo em `sheet/hp-descanso.js`.
//
// A PROPRIEDADE QUE ESTE ARQUIVO PRENDE
// -------------------------------------
// Nas faixas convertidas NAO PODE HAVER leitura de espelho. `char.classe` e
// `char.subclasse` (e os equivalentes na variavel `personagem`) apontam
// sempre para a classe INICIAL, e `char.nivel` e o nivel TOTAL. Num
// personagem multiclasse os tres estao errados para qualquer caracteristica
// que nao seja da primeira classe. O nivel que manda e o NAQUELA CLASSE:
// `temClasse(x, C)`, `subclasseDe(x, C)`, `nivelNa(x, C)`.
//
// O DEFEITO QUE ESTE GUARDA PEGA, E O QUE ELE NAO PEGA
// ----------------------------------------------------
// Ele e SINTATICO: julga de ONDE o codigo le, nao o que ele faz. Uma
// conversao para a CLASSE ERRADA -- `nivelNa(char, 'Bardo')` num ramo que
// e de Bruxo -- passa por ele sem reclamar, porque o simbolo lido e o
// certo. Prender isso continua sendo trabalho dos oraculos pontuais de
// `multiclasse-combate.test.mjs`. O 3c documentou essa mesma fronteira no
// proprio teste, e vale repetir aqui: este arquivo prende CONVERSAO
// PARCIAL (alguem reverte, esquece, ou escreve uma linha nova sobre o
// espelho), nao conversao TROCADA.
//
// AS QUATRO ARMADILHAS EVITADAS DE PROPOSITO (as mesmas do 3c)
// ------------------------------------------------------------
// 1. COMENTARIOS NAO CONTAM. Este sub-projeto exige comentario em toda
//    conversao, e os comentarios CITAM os espelhos ("nao converter para
//    char.nivel"). Um grep cru contaria prosa. A faixa e limpa por
//    `semComentarios` antes de qualquer conta, e ha um teste dedicado
//    provando que o filtro apaga prosa e preserva codigo.
// 2. ANCORAGEM POR CONTEUDO, NAO POR LINHA. Nenhum numero de linha aparece
//    na configuracao: as faixas sao achadas pelo TEXTO das assinaturas.
// 3. EXCECOES POR TEXTO E COM MOTIVO. Nunca por numero de linha nem por uma
//    contagem "espera-se 1" -- uma contagem deixaria QUALQUER leitura nova
//    passar desde que outra sumisse.
// 4. GUARDA CONTRA VACUIDADE. Um teste que mede um arquivo vazio passa
//    sempre. Se a ancora nao for encontrada, se a faixa vier curta demais,
//    se o filtro de comentarios apagar codigo junto, se as chamadas por
//    classe cairem abaixo do piso, ou se uma excecao declarada nao casar
//    com nada, o teste FALHA.
//
// A DECISAO SOBRE `sheet/hp-descanso.js`, E A PROMOCAO PELO 3e
// ---------------------------------------------------------------
// `hp-descanso.js` era escopo do sub-projeto 3e (PV e dados de vida). Na
// epoca deste guarda (3d), o arquivo tinha 90 leituras de espelho e o 3d
// converteu UMA (o gate de Maestria em Arma do Descanso Longo) -- um guarda
// de "zero espelhos" sobre ele teria acusado 89 linhas que nao eram desta
// tarefa, e um guarda que exige o impossivel e um guarda que alguem vai
// desligar. Por isso ele NAO entrava em ALVOS: era coberto por um teste de
// ANCORA proprio, no fim deste arquivo, que prendia exatamente a linha
// convertida (positivo) e proibia espelho em qualquer linha de codigo que
// falasse de maestria (negativo).
//
// O 3e converteu o resto (Tarefas 1-10: formula de PV, reservas de dado de
// vida por tipo, Resiliencia Draconica, restaurarHabilidades, os 24 blocos
// dos dois descansos) e promoveu `hp-descanso.js` a ALVOS -- em
// `testes/regras/unidade/multiclasse-descansos-alcance.test.mjs`, nao aqui.
// O teste de ancora foi apagado deste arquivo; a PROPRIEDADE POSITIVA que
// ele prendia (as duas linhas da Tarefa 5 existirem exatamente uma vez, e
// `classesComMaestria` vir de `./maestrias.js` -- que um guarda de "zero
// espelhos" sozinho nao prende, porque reescrever aquelas linhas com um
// literal nao reintroduz espelho nenhum) migrou junto, num teste proprio no
// arquivo novo ("PROPRIEDADE HERDADA DO 3d").
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './harness.mjs';

/**
 * Monta o regex de leitura de espelho para um conjunto de identificadores.
 *
 * Casa `x.classe`, `x.subclasse`, `x.nivel` E TAMBEM a forma com
 * encadeamento opcional (`x?.classe`) -- o guarda do 3c nao cobria essa
 * segunda forma, e `utils.js` a usa de verdade (`personagem?.classe`), o
 * que abriria um caminho silencioso para reverter uma conversao.
 *
 * O `(?<![\w.$])` antes do identificador evita casar sufixo de outro nome
 * (`meuChar.nivel`) e propriedade de outro objeto (`fonte.char.nivel`).
 * `char.classes` -- a LISTA de verdade -- nao casa, porque `classe\b` nao
 * encosta em `classes`.
 *
 * @param {string[]} identificadores Nomes de variavel que carregam o
 *   personagem naquele arquivo (ex.: ['char'], ['personagem']).
 * @returns {RegExp} regex global de leitura de espelho.
 */
function regexEspelhos(identificadores) {
  return new RegExp(
    `(?<![\\w.$])(${identificadores.join('|')})\\s*\\??\\s*\\.\\s*(classe|subclasse|nivel)\\b`,
    'g');
}

/**
 * Apaga comentarios (`//` de linha e de bloco) PRESERVANDO a contagem de
 * linhas, para que os numeros relatados sigam batendo com o arquivo real.
 *
 * O `(^|[^:])` antes de `//` evita comer o resto de uma URL
 * (`https://...`), mesmo padrao ja usado por gatilhos-ui-cobertos.test.mjs
 * e pelo guarda do 3c.
 *
 * @param {string} texto Codigo-fonte bruto.
 * @returns {string} o mesmo texto sem comentarios e com as mesmas linhas.
 */
function semComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/gm, (m, antes) => antes);
}

/**
 * Le um arquivo do app e devolve as linhas ja sem comentarios.
 *
 * @param {string} rel Caminho relativo a raiz do repositorio.
 * @returns {{brutas: string[], limpas: string[]}} as linhas cruas (para
 *   achar ancoras) e as limpas (para medir).
 */
function lerLinhas(rel) {
  const bruto = readFileSync(join(RAIZ, ...rel.split('/')), 'utf-8');
  return {
    brutas: bruto.split(/\r?\n/),
    limpas: semComentarios(bruto).split(/\r?\n/),
  };
}

// ============================================================
// OS ALVOS: uma faixa por arquivo convertido, com as excecoes declaradas.
//
// `ancoraInicio` nulo = o arquivo INTEIRO e a faixa. Isso vale para os tres
// arquivos em que o 3d converteu tudo o que havia; em `utils.js`, que tem
// leituras de espelho fora do escopo do 3d (ver o teste de INVENTARIO, no
// fim), a faixa e so o bloco de CA.
// ============================================================
const ALVOS = [
  {
    nome: 'CA alternativa + calcCA',
    rel: 'site/js/utils.js',
    identificadores: ['personagem'],
    // A faixa vai da tabela de fontes ate o `}` em coluna zero que fecha
    // `calcCA` -- ou seja, cobre FONTES_CA_ALTERNATIVA, o coletor, o
    // escolhedor, `equipamentoDeCA` e a propria `calcCA`.
    ancoraInicio: 'const FONTES_CA_ALTERNATIVA = [',
    ancoraFimApos: 'export function calcCA(',
    // A faixa tem hoje ~249 linhas. 120 e folgado o bastante para nao
    // brigar com refatoracao e apertado o bastante para acusar uma
    // varredura que achou so o cabecalho.
    minimoLinhas: 120,
    ancorasCodigo: ['coletarCAsAlternativas', 'escolherCAAlternativa',
                    'classesDe(personagem)', 'FONTES_CA_ALTERNATIVA'],
    // Piso BAIXO de proposito: a conversao da Tarefa 3 nao espalhou
    // chamadas por classe, ela trocou quatro `if` por uma TABELA lida uma
    // vez em `classesDe(personagem)` (mais o `temClasse` da guarda de
    // coerencia do escolhedor). Duas chamadas e o total real, e o piso
    // existe para acusar o sumico delas, nao para exigir quantidade.
    pisoPorClasse: 2,
    excecoes: [],
  },
  {
    nome: 'salvaguardas concedidas por classe',
    rel: 'site/js/regras-salvaguardas.js',
    identificadores: ['personagem'],
    ancoraInicio: null,
    minimoLinhas: 60,
    ancorasCodigo: ['salvaguardasConcedidasPorClasse', 'TODAS_AS_SALVAGUARDAS',
                    'ehProficienteEmSalvaguarda'],
    // Duas caracteristicas convertidas pela Tarefa 1: Monge 14 e Ladino 15.
    pisoPorClasse: 2,
    excecoes: [],
  },
  {
    nome: 'combate (ataques, deslocamento, iniciativa, pericias)',
    rel: 'site/js/sheet/combate.js',
    identificadores: ['char'],
    ancoraInicio: null,
    minimoLinhas: 250,
    ancorasCodigo: ['getAtaquesPorAcao', 'getDeslocamentoFinal',
                    'getModIniciativa', 'nivelNa(char,'],
    // Tarefa 2 (1 funcao) + Tarefa 2b (14 leituras) somam 25 chamadas por
    // classe hoje. 18 deixa margem para refatoracao sem virar decoracao.
    pisoPorClasse: 18,
    excecoes: [
      {
        linha: "if (pericia?.atributo === 'Força' && char.especie === 'Golias' && (char.nivel || 1) >= 5) {",
        feature: 'Forma Grande (traço de espécie do Goliás)',
        motivo:
          'Traço de ESPÉCIE, não de classe: espécie não tem "nível na classe". O ' +
          'livro diz "a partir do nível 5 DE PERSONAGEM" (Especies.md:212), e o ' +
          'número que manda é o nível TOTAL (livro:2037) -- que é exatamente o que ' +
          'o espelho char.nivel guarda (regras-multiclasse.js). Mesma família do ' +
          '`pb` de Mãos Curativas do Aasimar, que o sub-projeto 3c preservou pelo ' +
          'mesmo motivo e declarou no guarda dele. A Tarefa 2b examinou esta linha ' +
          'uma a uma junto com as outras 14 e a preservou de propósito.',
      },
    ],
  },
  {
    nome: 'maestrias em arma (o teto único)',
    rel: 'site/js/sheet/maestrias.js',
    // `p` entra porque `classesComMaestria(p = char)` e
    // `trocaTodasNoDescanso(p = char)` recebem o personagem nesse nome:
    // uma reversao ali seria escrita `p.classe`, e sem o identificador o
    // guarda passaria batido.
    identificadores: ['char', 'p'],
    ancoraInicio: null,
    minimoLinhas: 200,
    ancorasCodigo: ['CLASSES_MAESTRIA', 'classesComMaestria', 'tetoMaestrias',
                    'temClasse(char,'],
    // Tarefa 5: temClasse x2, classesComMaestria x3, trocaTodasNoDescanso x2.
    pisoPorClasse: 5,
    excecoes: [
      {
        linha: 'export async function abrirModalMaestrias(classe = char.classe) {',
        feature: 'abrirModalMaestrias -- valor PADRÃO do parâmetro `classe`',
        motivo:
          'NÃO é uma leitura de regra: é o default de um parâmetro que só ROTULA o ' +
          'modal. O teto deixou de sair daqui na Tarefa 5 -- vem de tetoMaestrias(), ' +
          'que é do personagem inteiro. O default existe para preservar o ' +
          'comportamento de quem chama sem argumento (ficha de classe única), e os ' +
          'dois chamadores de hoje passam a classe explicitamente: ' +
          'habilidades.js:2560 (o botão do card, que sabe de qual classe é) e ' +
          'maestrias.js (abrirModalTrocaMaestriaDescanso, que passa ' +
          '`comMaestria[0]`, justamente para não cair neste espelho). ' +
          'RESSALVA REGISTRADA no relatório da Tarefa 6: se um chamador NOVO ' +
          'esquecer o argumento, um Mago 5/Guerreiro 5 cai em `char.classe` = ' +
          "'Mago', o `if (!CLASSES_MAESTRIA.includes(classe)) return` dispara e o " +
          'modal não abre -- em silêncio. O guarda é sintático e não distingue os ' +
          'dois casos; quem prende isso é um oráculo de comportamento.',
      },
    ],
  },
];

/**
 * Acha a faixa de um alvo por CONTEUDO -- nunca por numero de linha.
 *
 * Sem `ancoraInicio`, a faixa e o arquivo inteiro. Com ela, comeca na linha
 * da ancora e termina no primeiro `}` em coluna zero DEPOIS da linha de
 * `ancoraFimApos` (que pode ser a mesma da abertura).
 *
 * @param {object} alvo Entrada de ALVOS.
 * @param {string[]} brutas Linhas cruas do arquivo.
 * @returns {{inicio: number, fim: number}} indices 0-based, `fim` inclusivo.
 */
function faixaDoAlvo(alvo, brutas) {
  if (!alvo.ancoraInicio) return { inicio: 0, fim: brutas.length - 1 };

  const inicio = brutas.findIndex((l) => l.includes(alvo.ancoraInicio));
  assert.notEqual(inicio, -1,
    `GUARDA CONTRA VACUIDADE: a âncora de início "${alvo.ancoraInicio}" não foi ` +
    `encontrada em ${alvo.rel}. Sem faixa não há o que medir, e um teste que não ` +
    'acha nada passaria sempre. Se o código foi renomeado, atualize a âncora aqui.');

  const alvoFim = alvo.ancoraFimApos || alvo.ancoraInicio;
  const linhaFim = brutas.findIndex((l, i) => i >= inicio && l.includes(alvoFim));
  assert.notEqual(linhaFim, -1,
    `GUARDA CONTRA VACUIDADE: a âncora de fim "${alvoFim}" não foi encontrada ` +
    `depois de "${alvo.ancoraInicio}" em ${alvo.rel}.`);

  let fim = -1;
  for (let i = linhaFim + 1; i < brutas.length; i++) {
    if (/^\}/.test(brutas[i])) { fim = i; break; }
  }
  assert.notEqual(fim, -1,
    `GUARDA CONTRA VACUIDADE: não foi achado o "}" em coluna zero que fecha ` +
    `"${alvoFim}" em ${alvo.rel}.`);
  return { inicio, fim };
}

/**
 * Varre a faixa de um alvo e devolve as leituras de espelho encontradas.
 *
 * @param {object} alvo Entrada de ALVOS.
 * @returns {{ocorrencias: Array<{linha: number, texto: string, simbolo: string}>,
 *            totalLinhas: number, corpo: string}}
 */
function varrer(alvo) {
  const { brutas, limpas } = lerLinhas(alvo.rel);
  const { inicio, fim } = faixaDoAlvo(alvo, brutas);
  const linhas = limpas.slice(inicio, fim + 1);
  const espelhos = regexEspelhos(alvo.identificadores);
  const ocorrencias = [];
  linhas.forEach((texto, i) => {
    for (const m of texto.matchAll(espelhos)) {
      ocorrencias.push({ linha: inicio + i + 1, texto: texto.trim(), simbolo: m[0] });
    }
  });
  return { ocorrencias, totalLinhas: linhas.length, corpo: linhas.join('\n') };
}

// ============================================================
// O filtro de comentarios, provado a parte.
//
// Ele e a peca de que TODA a medida depende: se apagasse codigo junto, a
// contagem de espelhos viria zero por vacuidade e o guarda passaria com
// qualquer implementacao.
// ============================================================
test('alcance 3d: o filtro de comentários apaga prosa e preserva código', () => {
  const amostra = [
    'const a = char.nivel;',
    '// comentário citando char.classe e char.subclasse',
    'const b = 1; // rabo de comentário com char.nivel',
    '/* bloco',
    '   citando char.classe',
    '   em várias linhas */',
    'const url = "https://exemplo/char.nivel";',
    'const c = personagem?.classe;',
  ].join('\n');
  const limpo = semComentarios(amostra);
  assert.equal(limpo.split('\n').length, amostra.split('\n').length,
    'o filtro tem de preservar a contagem de linhas, senão os números relatados mentem');

  const achados = [...limpo.matchAll(regexEspelhos(['char', 'personagem']))].map((m) => m[0]);
  // Três leituras de CÓDIGO: a da linha 1, a de dentro da string da URL (uma
  // string é código, e este filtro não interpreta strings) e a da última
  // linha, com encadeamento opcional. NENHUMA das citações em comentário
  // pode sobreviver.
  assert.equal(achados.length, 3,
    `esperado 3 leituras de código, achadas ${achados.length}: ${achados.join(', ')}`);
  assert.ok(achados.some((s) => s.includes('?.')),
    'o regex tem de casar o encadeamento opcional (personagem?.classe) -- é a forma ' +
    'que utils.js usa de verdade, e sem ela haveria caminho silencioso de reversão');
  assert.ok(!limpo.includes('citando'), 'texto de comentário sobreviveu ao filtro');
  assert.ok(!limpo.includes('rabo de comentário'), 'comentário de fim de linha sobreviveu');
});

// ============================================================
// Guardas contra vacuidade -- rodam ANTES da medida, um por alvo.
// ============================================================
for (const alvo of ALVOS) {
  test(`alcance 3d [${alvo.nome}]: a varredura enxerga a faixa`, () => {
    const { totalLinhas, corpo } = varrer(alvo);

    assert.ok(totalLinhas >= alvo.minimoLinhas,
      `só ${totalLinhas} linhas na faixa de ${alvo.rel} -- esperado ao menos ` +
      `${alvo.minimoLinhas}. A varredura achou a âncora mas o corpo veio curto ` +
      'demais para ser o trecho de verdade.');

    for (const ancora of alvo.ancorasCodigo) {
      assert.ok(corpo.includes(ancora),
        `a faixa medida de ${alvo.rel} não contém "${ancora}" -- ou o filtro de ` +
        'comentários apagou código junto, ou a faixa está no lugar errado. Nos dois ' +
        'casos a contagem de espelhos seria zero por vacuidade.');
    }

    const porClasse = (corpo.match(
      /\b(temClasse|subclasseDe|nivelNa|classesDe|classesComMaestria|trocaTodasNoDescanso)\s*\(/g
    ) || []).length;
    assert.ok(porClasse >= alvo.pisoPorClasse,
      `só ${porClasse} chamadas por classe na faixa de ${alvo.rel} -- esperado ao ` +
      `menos ${alvo.pisoPorClasse}. A conversão do 3d pôs essas chamadas; este ` +
      'número no chão significa que ela foi desfeita em bloco, ou que a varredura ' +
      'está olhando outro trecho. "Zero espelhos" com zero código não é medida.');
  });

  test(`alcance 3d [${alvo.nome}]: cada exceção declarada casa com exatamente uma linha`, () => {
    const { ocorrencias } = varrer(alvo);
    for (const e of alvo.excecoes) {
      const casos = ocorrencias.filter((o) => o.texto === e.linha);
      assert.equal(casos.length, 1,
        `a exceção declarada para ${e.feature} (${alvo.rel}) casou com ` +
        `${casos.length} linha(s), e tem de casar com exatamente uma.\n` +
        `  linha declarada: ${e.linha}\n` +
        '  Zero: a exceção virou letra morta -- o código mudou e o motivo por ' +
        'escrito não foi revisto. Reveja e atualize a declaração.\n' +
        '  Mais de uma: a declaração ficou ambígua e estaria absolvendo uma leitura ' +
        'que ninguém examinou. Torne o texto declarado único.');
    }
  });
}

// ============================================================
// A MEDIDA: zero leituras de espelho nas faixas, fora as declaradas.
// ============================================================
for (const alvo of ALVOS) {
  test(`alcance 3d [${alvo.nome}]: ${alvo.rel} não lê espelho de classe/subclasse/nível`, () => {
    const { ocorrencias } = varrer(alvo);
    const declaradas = new Set(alvo.excecoes.map((e) => e.linha));
    const sobrando = ocorrencias.filter((o) => !declaradas.has(o.texto));
    assert.deepEqual(sobrando.map((o) => `${alvo.rel}:${o.linha}  ${o.texto}`), [],
      `leitura de ESPELHO em ${alvo.rel} (${alvo.nome}).\n\n` +
      'char.classe/personagem.classe e char.subclasse apontam sempre para a classe ' +
      'INICIAL, e char.nivel é o nível TOTAL -- num personagem multiclasse os três ' +
      'estão errados para qualquer característica que não seja da primeira classe. ' +
      'Uma característica calculada sobre eles chega cedo demais para quem ainda não ' +
      'a conquistou, e some para quem conquistou.\n\n' +
      'O conserto é ler pela classe DONA da característica, que é conhecida ali ' +
      'mesmo:\n' +
      "  x.classe === 'C'   ->  temClasse(x, 'C')\n" +
      "  x.subclasse        ->  subclasseDe(x, 'C')\n" +
      "  x.nivel            ->  nivelNa(x, 'C')\n\n" +
      'Se a leitura do nível TOTAL for CERTA (traço de espécie, Bônus de ' +
      'Proficiência do personagem -- livro:2037 e livro:2047), declare-a em ' +
      '`excecoes`, neste arquivo, com o motivo por escrito e a regra do livro ' +
      'citada. Não acrescente exceção sem motivo: é a rede inteira que ela ' +
      'afrouxa.\n\nPontos encontrados:');
  });
}

// ============================================================
// INVENTARIO de `site/js/utils.js` FORA da faixa de CA.
//
// A faixa medida acima cobre so o que a Tarefa 3 converteu. O resto do
// arquivo tem 21 leituras de espelho que o 3d NAO tocou, e elas nao sao
// todas do mesmo tipo: uma parte esta CERTA (Bonus de Proficiencia vem do
// nivel TOTAL -- livro:2047 e explicito: "nao do nivel de uma classe
// especifica"), e outra parte e defeito de espelho de verdade, fora do
// escopo deste sub-projeto.
//
// Este teste CONGELA as duas listas, casando por TEXTO da linha (nunca por
// numero: `utils.js` e editado o tempo todo e um oraculo preso a numero
// ficaria vermelho por deslocamento). Ele nao manda consertar nada -- manda
// CLASSIFICAR: uma leitura nova em utils.js so entra depois que alguem
// escreveu se ela e o nivel total de proposito ou um espelho a converter.
//
// E o que responde ao pedido da Tarefa 6 de "achar as leituras de nivel
// TOTAL de utils.js e declarar cada uma".
// ============================================================
const UTILS_LEGITIMAS_NIVEL_TOTAL = [
  // Bonus de Proficiencia: livro:2047 -- "seu Bonus de Proficiencia vem do
  // seu nivel de personagem, NAO do nivel de uma classe especifica". Estas
  // linhas leem `personagem.nivel` porque e exatamente o total que elas
  // querem; converter qualquer uma delas seria introduzir um defeito.
  'let cd = 8 + bonusProficiencia(personagem.nivel) + modAttr;',
  'return bonusProficiencia(personagem.nivel) + modAttr;',
  'if (prof) bonus += bonusProficiencia(personagem.nivel);',
  'if (exp) bonus += bonusProficiencia(personagem.nivel);',
  'bonus += Math.floor(bonusProficiencia(personagem.nivel) / 2);',
  // conjuracoesPorClasse (rodada de conformidade, 2026-08-26): resolve a CD
  // e o ataque de magia POR CLASSE conjuradora (livro:2075), mas o Bonus de
  // Proficiencia continua sendo o do nivel TOTAL nas duas colunas -- e o
  // mesmo livro:2047 das linhas acima. O que varia entre as entradas e so o
  // modificador de atributo. Converter esta linha para nivelNa daria PB
  // menor a cada classe de um multiclasse, que e exatamente o que a regra
  // proibe.
  'const prof = bonusProficiencia(personagem?.nivel);',
];

const UTILS_ESPELHOS_FORA_DO_ESCOPO_3D = [
  // Grimorio do Mago: `personagem.classe !== 'Mago'` era o espelho da classe
  // INICIAL -- um Clerigo 1/Mago 5 tinha grimorio e o app nao o enxergava.
  // CONVERTIDO no sub-projeto de conjuracao por classe (Tarefa 2,
  // magiaMagoEstaNoGrimorio agora usa temClasse) -- a linha abaixo saiu
  // desta lista porque `magiaMagoEstaNoGrimorio` nao lê mais `personagem`
  // como espelho. `nomesMagiaCirculo1Conhecidas`, a linha seguinte, continua
  // fora do escopo desta tarefa (ela decide "1º círculo já conhecido",
  // não o grimório em si) e permanece classificada abaixo.
  "if (personagem?.classe === 'Mago') {",
  "if (!personagem || typeof personagem !== 'object' || personagem.classe !== 'Mago') {",
  // Atributo de conjuracao: le classe, subclasse e nivel do espelho de uma
  // vez so. Num multiclasse conjurador o CD sai da classe inicial.
  'const info = CLASSES_INFO[personagem?.classe];',
  'if (!getConjuracaoSubclasse(personagem?.classe, personagem?.subclasse, personagem?.nivel)) return null;',
  'return getAtributoConjuracaoSubclasse(personagem?.classe, personagem?.subclasse);',
  // Feiticaria Inata (Feiticeiro): espelho da classe inicial.
  "if (personagem.classe === 'Feiticeiro' && personagem?.recursos?.feiticeiro?.feiticaria_inata_ativa) {",
  // Pau pra Toda Obra: caracteristica de BARDO 2 (metade do PB nas pericias
  // sem proficiencia). Aparece DUAS vezes -- calcPercepcaoPassiva e
  // calcBonusPericia. O gate cruza o espelho da classe inicial com o nivel
  // TOTAL: um Ladino 1/Bardo 5 nao recebe o que conquistou, e um
  // Bardo 1/Ladino 5 recebe no nivel 1 de Bardo. Defeito real, fora do
  // escopo do 3d.
  "if (personagem.classe === 'Bardo' && (personagem.nivel || 1) >= 2 && !prof && !exp) {",
  // Ordem Divina (Clerigo/Taumaturgo) e Ordem Primal (Druida/Xama): bonus
  // de pericia, preso ao espelho da classe inicial (calcBonusPericia). O
  // bonus de TRUQUES da mesma dupla (getBonusTruquesOrdem) saiu desta lista
  // na Tarefa 3 -- ver o comentário logo abaixo.
  "personagem.classe === 'Clérigo' &&",
  "personagem.classe === 'Druida' &&",
  // getBonusTruquesOrdem (Tarefa 3, sub-projeto "tela magias por classe"):
  // o DEFAULT do segundo parâmetro, NO-OP por desenho -- não é um defeito
  // adiado como os itens acima desta lista, mas não é nível TOTAL de
  // propósito (a outra lista) também, então entra aqui pela classificação
  // mais próxima. Os dois chamadores da FICHA (sheet/grimorio.js,
  // sheet/magias.js) agora passam `nomeClasse` explicitamente
  // (`sup?.classe`, a superfície de conjuração ativa); o default só serve
  // quem NÃO foi convertido -- o criador (creator/passo-magias.js,
  // creator/wizard.js), onde `personagem.classe` é a classe certa por
  // construção (personagem de uma classe só), e levelup-flow.js:100-101,
  // onde é documentadamente um no-op (ordem_divina/ordem_primal não muda
  // dentro de uma mesma chamada de subirDeNivel).
  'export function getBonusTruquesOrdem(personagem, nomeClasse = personagem?.classe) {',
];

test('alcance 3d [inventário utils.js]: toda leitura fora da faixa de CA está classificada', () => {
  const alvoCA = ALVOS.find((a) => a.rel === 'site/js/utils.js');
  const { brutas, limpas } = lerLinhas('site/js/utils.js');
  const { inicio, fim } = faixaDoAlvo(alvoCA, brutas);
  const espelhos = regexEspelhos(['personagem']);

  const fora = [];
  limpas.forEach((texto, i) => {
    if (i >= inicio && i <= fim) return;
    if (espelhos.test(texto)) fora.push({ linha: i + 1, texto: texto.trim() });
    espelhos.lastIndex = 0;
  });

  // GUARDA CONTRA VACUIDADE: se esta varredura devolvesse zero, o teste
  // passaria sem medir nada. Ela tem de continuar achando a dezena larga de
  // leituras que utils.js de fato tem fora do bloco de CA.
  assert.ok(fora.length >= 15,
    `só ${fora.length} leituras de espelho fora da faixa de CA em utils.js -- ` +
    'esperado ao menos 15. Ou o arquivo mudou muito, ou a varredura está cega.');

  const classificadas = new Set([
    ...UTILS_LEGITIMAS_NIVEL_TOTAL,
    ...UTILS_ESPELHOS_FORA_DO_ESCOPO_3D,
  ]);
  const semClassificacao = fora.filter((o) => !classificadas.has(o.texto));
  assert.deepEqual(semClassificacao.map((o) => `site/js/utils.js:${o.linha}  ${o.texto}`), [],
    'leitura de espelho NOVA (ou alterada) em site/js/utils.js, fora do bloco de CA ' +
    'e sem classificação.\n\n' +
    'Este teste não manda consertar: manda DECIDIR e escrever a decisão. Ponha a ' +
    'linha em uma das duas listas deste arquivo:\n' +
    '  UTILS_LEGITIMAS_NIVEL_TOTAL -- a leitura QUER o nível total, e o livro manda ' +
    'assim (Bônus de Proficiência, livro:2047; traço de espécie, livro:2037).\n' +
    '  UTILS_ESPELHOS_FORA_DO_ESCOPO_3D -- é defeito de espelho de verdade, e vai ' +
    'ser convertido por outro sub-projeto. Escreva qual característica é e o que ela ' +
    'erra num multiclasse.\n\n' +
    'Uma leitura que ninguém soube classificar não vai para lista nenhuma: vai para ' +
    'docs/PERGUNTAS-PENDENTES.txt.\n\nLinhas encontradas:');

  // O par do congelamento: as duas listas nao podem virar letra morta.
  // Cada linha declarada tem de existir no arquivo de verdade.
  const textos = new Set(fora.map((o) => o.texto));
  for (const declarada of classificadas) {
    assert.ok(textos.has(declarada),
      `a linha declarada no inventário de utils.js não existe mais no arquivo:\n` +
      `  ${declarada}\n` +
      'Ou ela foi convertida (então apague a entrada) ou foi editada (então reveja a ' +
      'classificação e atualize o texto). Uma declaração que não casa com nada é uma ' +
      'justificativa que ninguém está mais lendo.');
  }
});
