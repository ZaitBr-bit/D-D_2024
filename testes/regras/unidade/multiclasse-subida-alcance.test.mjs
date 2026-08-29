// ============================================================
// Oraculo de ALCANCE do sub-projeto 5 (fluxo de subida de nivel escolhe a
// classe em que o nivel entra).
//
// POR QUE ESTE ARQUIVO EXISTE
// ---------------------------
// Mesmo motivo do 3c, do 3d e do 3e: oraculos PONTUAIS nao prendem a
// propriedade GERAL. Uma conversao revertida uma a uma passa despercebida
// pelos oraculos de comportamento enquanto sobrar QUALQUER caminho que
// ainda acerte o resultado por acidente -- por exemplo num personagem de
// classe UNICA, onde o espelho e a fonte da verdade sempre concordam e o
// oraculo de comportamento nao teria como discordar. A resposta e um GUARDA
// ESTATICO que le o arquivo inteiro (ou a faixa convertida) e exige ZERO
// leitura de espelho, com as excecoes declaradas por texto e com o motivo
// escrito.
//
// ESTE GUARDA COBRE CINCO ARQUIVOS, NAO OS DOIS QUE O PLANO NOMEIA
// -------------------------------------------------------------------
// O plano original previa so `levelup.js` e `levelup-flow.js`, escrito
// quando so esses dois estavam previstos para a conversao. As Tarefas 4-8
// converteram tambem `levelup-cards.js`, `levelup-ui.js` e
// `levelup-validations.js`. Um guarda que cobrisse dois de cinco deixaria
// tres superficies convertidas sem rede -- por isso ALVOS abaixo tem cinco
// entradas.
//
// AS QUATRO ARMADILHAS EVITADAS DE PROPOSITO (as mesmas do 3c, do 3d e do 3e)
// -----------------------------------------------------------------------------
// 1. COMENTARIOS NAO CONTAM. Este sub-projeto exige comentario em toda
//    conversao, e os comentarios CITAM os espelhos ("nao converter para
//    char.classe"). Um grep cru contaria prosa. A faixa e limpa por
//    `semComentarios` antes de qualquer conta, e ha um teste dedicado
//    provando que o filtro apaga prosa e preserva codigo -- inclusive
//    dentro de um comentario de bloco embutido em template string
//    (`${/* ... */''}`, usado de verdade em levelup-cards.js:148).
// 2. ANCORAGEM POR CONTEUDO, NAO POR LINHA. Nenhum numero de linha aparece
//    na configuracao: as faixas sao achadas pelo TEXTO das assinaturas.
// 3. EXCECOES POR TEXTO E COM MOTIVO. Nunca por numero de linha nem por
//    uma contagem "espera-se 1" -- uma contagem deixaria QUALQUER leitura
//    nova passar desde que outra sumisse.
// 4. GUARDA CONTRA VACUIDADE. Se a ancora nao for encontrada, se a faixa
//    vier curta demais, se o filtro de comentarios apagar codigo junto, se
//    as chamadas por classe cairem abaixo do piso, ou se uma excecao
//    declarada nao casar com nada, o teste FALHA.
//
// UM QUINTO PONTO, NOVO AQUI: IDENTIFICADOR COMPOSTO (`ctx.char`)
// -------------------------------------------------------------------
// `levelup.js` e `levelup-flow.js` recebem o personagem como parametro
// direto (`personagem`, `char`). Mas `levelup-cards.js`, `levelup-ui.js` e
// `levelup-validations.js` trabalham sobre um `ctx` (o contexto de
// `buildLevelUpContext`) e, em boa parte do codigo, acessam o personagem
// via `ctx.char` -- nunca so `ctx`. `regexEspelhos` (do 3e) so casava
// IDENTIFICADORES simples (`char`), e com a lookbehind `(?<![\w.$])` um
// `ctx.char.classe` NAO seria pego pelo identificador `char` sozinho (o `.`
// antes de `char` reprova a lookbehind, de proposito -- e o mesmo motivo
// que exclui `fonte.char.nivel`). Este arquivo estende a lista de
// identificadores para aceitar tambem um CAMINHO composto com ponto
// literal escapado (`'ctx\\.char'`), passado como mais uma alternativa da
// mesma regex -- sem mudar `regexEspelhos` nem sua semantica para os outros
// dois arquivos, que continuam usando so `personagem`/`char` soltos.
//
// O DEFEITO QUE ESTE GUARDA PEGA, E O QUE ELE NAO PEGA
// ----------------------------------------------------
// Ele e SINTATICO: julga de ONDE o codigo le, nao o que ele faz.
// `char.classe`/`char.subclasse` (ou `personagem.classe`/`.subclasse`)
// apontam sempre para a classe INICIAL, e `char.nivel`/`personagem.nivel` e
// o nivel TOTAL -- num personagem multiclasse os tres estao errados para
// qualquer decisao que dependa da classe QUE ESTA SUBINDO. Mas uma
// conversao para a CLASSE ERRADA (`nivelNa(char, 'Bardo')` num ramo que e
// de Bruxo) passa por ele sem reclamar, porque o simbolo lido e o certo. E
// ele tambem nao pega a troca de significado entre nivel-na-classe e
// nivel-total (por exemplo usar `nivelTotalAnterior` onde a regra pedia
// `nivelTotalNovo`) quando os dois lados ja sao variaveis locais derivadas
// de `contextoDeSubida` -- nenhum dos dois nomes bate no regex de espelho,
// entao os dois passam batido. Prender isso e trabalho dos oraculos de
// comportamento (`multiclasse-fundacao.test.mjs`,
// `multiclasse-descansos-alcance.test.mjs` e irmaos, alem dos cenarios e2e
// de `multiclasse-magias.spec.mjs` etc.).
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
 * encadeamento opcional (`x?.classe`). Um identificador pode ser um nome
 * simples (`char`) OU um caminho composto com ponto literal ja escapado
 * pelo chamador (`ctx\\.char`) -- ver a secao "IDENTIFICADOR COMPOSTO" no
 * cabecalho deste arquivo.
 *
 * O `(?<![\w.$])` antes do identificador evita casar sufixo de outro nome
 * (`meuChar.nivel`) e propriedade de outro objeto (`fonte.char.nivel`,
 * ou -- e este e o caso novo aqui -- `ctx.char.classe` quando so `char`
 * esta na lista, sem o caminho composto `ctx\\.char`).
 * `char.classes` -- a LISTA de verdade -- nao casa, porque `classe\b` nao
 * encosta em `classes`.
 *
 * @param {string[]} identificadores Nomes (ou caminhos com ponto escapado)
 *   que carregam o personagem naquele arquivo (ex.: ['personagem'] ou
 *   ['char', 'ctx\\.char']).
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
 * (`https://...`), mesmo padrao ja usado pelos guardas do 3c, do 3d e do 3e.
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
// `levelup.js` tem funcoes ANTERIORES a `subirDeNivel` (talentos, XP,
// pre-requisitos de caracteristica por classe/nivel) que trabalham sobre
// `classe`/`nivel` como PARAMETROS soltos, nao sobre o personagem -- fora
// de escopo deste guarda. A faixa comeca na assinatura de `subirDeNivel` e
// vai ate o `}` que fecha a funcao. Os outros quatro arquivos sao
// convertidos de ponta a ponta (mesma promocao que `hp-descanso.js` recebeu
// no 3e): a faixa e o arquivo inteiro.
// ============================================================
const ALVOS = [
  {
    nome: 'levelup.js -- motor de subirDeNivel',
    rel: 'site/js/levelup.js',
    identificadores: ['personagem'],
    ancoraInicio: 'export async function subirDeNivel(personagem, opcoes = {}) {',
    // mesma linha: so precisa do "}" em coluna zero que fecha a funcao.
    ancoraFimApos: 'export async function subirDeNivel(personagem, opcoes = {}) {',
    minimoLinhas: 900,
    ancorasCodigo: ['contextoDeSubida(personagem, classeQueSobe)',
                    'sincronizarEspelhos(personagem)', 'sub.classe',
                    'nivelNaClasseNovo', 'getClasse(sub.classe)'],
    pisoPorClasse: 15,
    excecoes: [
      {
        linha: 'const classeQueSobe = opcoes.classe || personagem.classe;',
        feature: 'Classe em que o nivel entra (default de compatibilidade)',
        motivo:
          'Sem `opcoes.classe`, cai na classe INICIAL do personagem -- o comportamento ' +
          'de ANTES do sub-projeto 5, preservado de proposito para todo chamador que ' +
          'ainda nao passa a escolha (testes e o proprio motor antes do wizard adotar ' +
          'o seletor). O proprio comentario do codigo, logo acima desta linha, documenta ' +
          'o motivo. Mesma familia do default declarado em levelup-flow.js:185.',
      },
    ],
  },
  {
    nome: 'levelup-flow.js -- contexto e steps do fluxo de subida',
    rel: 'site/js/levelup-flow.js',
    identificadores: ['char'],
    ancoraInicio: null, // o arquivo inteiro
    minimoLinhas: 600,
    ancorasCodigo: ['buildLevelUpContext', 'contextoDeSubida(char, classeQueSobe)',
                    'sub.classe', 'nivelNaClasseNovo', 'montarConjuracao'],
    pisoPorClasse: 25,
    excecoes: [
      {
        linha: 'const classeQueSobe = nomeClasse || char.classe;',
        feature: 'Classe em que o nivel entra (default de compatibilidade)',
        motivo:
          'Mesmo motivo do default em levelup.js:1053: sem `nomeClasse`, cai na classe ' +
          'INICIAL -- o comportamento de antes do multiclasse, preservado para quem ' +
          'ainda nao passa a escolha. O JSDoc do parametro, logo acima da funcao, ja ' +
          'documenta isso.',
      },
    ],
  },
  {
    nome: 'levelup-cards.js -- cards do fluxo de subida',
    rel: 'site/js/levelup-cards.js',
    identificadores: ['char', 'ctx\\.char'],
    ancoraInicio: null, // o arquivo inteiro
    minimoLinhas: 800,
    ancorasCodigo: ['ctx.classeQueSobe', 'escHtml(sub.subclasse)',
                    'classesDe(ctx.char)', 'sub.nivelNaClasseNovo'],
    pisoPorClasse: 5,
    excecoes: [
      {
        linha: 'const nivelNovo = (char.nivel || 1) + 1;',
        feature: 'renderCardASI -- elegibilidade de talento (obterTalentosElegiveis)',
        motivo:
          'CORRETO por regra, e NAO deve ser convertido: pre-requisito de talento e ' +
          'por nivel de PERSONAGEM, nao de classe -- mesma leitura, mesmo motivo, do ' +
          'nivel usado por obterTalentosElegiveis em levelup.js. Ver a mesma excecao ' +
          'em levelup-ui.js (bindEventosTalentos), decidida junto por ser o mesmo ' +
          'calculo duplicado nos dois arquivos.',
      },
    ],
  },
  {
    nome: 'levelup-ui.js -- eventos e render do modal de subida',
    rel: 'site/js/levelup-ui.js',
    identificadores: ['char', 'ctx\\.char'],
    ancoraInicio: null, // o arquivo inteiro
    minimoLinhas: 1800,
    ancorasCodigo: ['trocarClasseQueSobe', 'state.classeQueSobe',
                    'classeInicial(char)'],
    pisoPorClasse: 3,
    excecoes: [
      {
        linha: "const classeBase = state.classeQueSobe || classeInicial(char)?.classe || char.classe;",
        feature: 'abrirLevelUpCards -- classe provisoria antes da escolha do jogador',
        motivo:
          'Fallback de ultimo recurso, so alcancado ANTES do jogador escolher (com duas ' +
          'ou mais classes `state.classeQueSobe` nasce vazio de proposito, ver ' +
          'createInitialState em levelup-flow.js). O proprio comentario do codigo, ' +
          'algumas linhas acima, documenta que o contexto montado aqui e PROVISORIO ' +
          '("nasce PROVISORIO sobre a classe INICIAL") e e RECONSTRUIDO inteiro assim ' +
          'que o jogador escolhe (trocarClasseQueSobe) -- nada deste contexto ' +
          'provisorio chega ao jogador, porque o step \'escolha_classe\' e o primeiro e ' +
          'fica incompleto ate a escolha. Mesma familia dos defaults declarados em ' +
          'levelup.js:1053 e levelup-flow.js:185.',
      },
      {
        linha: 'const nivelNovo = (char.nivel || 1) + 1;',
        feature: 'bindEventosTalentos -- elegibilidade de talento (obterTalentosElegiveis)',
        motivo:
          'CORRETO por regra, e NAO deve ser convertido: pre-requisito de talento e ' +
          'por nivel de PERSONAGEM, nao de classe -- igual a renderCardASI ' +
          '(levelup-cards.js:236), decidida com o mesmo motivo.',
      },
    ],
  },
  {
    nome: 'levelup-validations.js -- coleta e validacao das escolhas',
    rel: 'site/js/levelup-validations.js',
    identificadores: ['char', 'ctx\\.char'],
    ancoraInicio: null, // o arquivo inteiro
    minimoLinhas: 200,
    ancorasCodigo: ['ctx.classeQueSobe', 'ctx.nivelNaClasseNovo'],
    // So 3 ocorrencias de simbolo por classe no arquivo inteiro (o mais
    // enxuto dos cinco) -- piso baixo de proposito, mas MAIOR que zero: um
    // arquivo que perdesse as duas unicas referencias a `classeQueSobe`
    // voltaria a resolver a classe do jeito antigo (o espelho), sem
    // reintroduzir leitura de espelho nenhuma no processo (`state.classe`
    // continuaria nao existindo) -- e e exatamente esse buraco que o piso
    // fecha.
    pisoPorClasse: 2,
    excecoes: [],
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
// qualquer implementacao. O caso do comentario de bloco DENTRO de template
// string (`${/* ... */''}`) e novo aqui: e o padrao real usado em
// levelup-cards.js:148 para citar `char.subclasse` em prosa sem gerar
// leitura de espelho nenhuma.
// ============================================================
test('alcance subida 5: o filtro de comentários apaga prosa e preserva código', () => {
  const amostra = [
    'const a = personagem.nivel;',
    '// comentário citando char.classe e char.subclasse',
    'const b = 1; // rabo de comentário com personagem.nivel',
    '/* bloco',
    '   citando char.classe',
    '   em várias linhas */',
    'const url = "https://exemplo/char.nivel";',
    'const c = char?.classe;',
    "const d = `${/* citando ctx.char.classe em bloco embutido */''}X`;",
    'const e = ctx.char.subclasse;',
  ].join('\n');
  const limpo = semComentarios(amostra);
  assert.equal(limpo.split('\n').length, amostra.split('\n').length,
    'o filtro tem de preservar a contagem de linhas, senão os números relatados mentem');

  const achados = [...limpo.matchAll(regexEspelhos(['char', 'personagem', 'ctx\\.char']))]
    .map((m) => m[0]);
  // Quatro leituras de CÓDIGO: a linha 1 (personagem.nivel), a de dentro da
  // string da URL (char.nivel, uma string é código, e este filtro não
  // interpreta strings), a linha 8 (char?.classe, encadeamento opcional) e
  // a linha 10 (ctx.char.subclasse, identificador composto). NENHUMA das
  // citações em comentário -- incluindo a embutida em template string --
  // pode sobreviver.
  assert.equal(achados.length, 4,
    `esperado 4 leituras de código, achadas ${achados.length}: ${achados.join(', ')}`);
  assert.ok(achados.some((s) => s.includes('?.')),
    'o regex tem de casar o encadeamento opcional (char?.classe) -- sem ela haveria ' +
    'caminho silencioso de reversão');
  assert.ok(achados.some((s) => s.startsWith('ctx.char')),
    'o regex tem de casar o identificador composto (ctx.char.subclasse) -- sem ele ' +
    'levelup-cards.js/levelup-ui.js/levelup-validations.js ficariam sem rede para o ' +
    'acesso que de fato usam');
  assert.ok(!limpo.includes('citando'), 'texto de comentário sobreviveu ao filtro');
  assert.ok(!limpo.includes('rabo de comentário'), 'comentário de fim de linha sobreviveu');
  assert.ok(!limpo.includes('embutido'),
    'comentário de bloco embutido em template string sobreviveu ao filtro');
});

// ============================================================
// Guardas contra vacuidade -- rodam ANTES da medida, um por alvo.
// ============================================================
for (const alvo of ALVOS) {
  test(`alcance subida 5 [${alvo.nome}]: a varredura enxerga a faixa`, () => {
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
      /\b(contextoDeSubida|classeQueSobe|nivelNaClasseNovo|nivelNaClasseAnterior|classesDe|classeInicial|nivelNa|temClasse|subclasseDe)\b/g
    ) || []).length;
    assert.ok(porClasse >= alvo.pisoPorClasse,
      `só ${porClasse} referências à classe-que-sobe na faixa de ${alvo.rel} -- ` +
      `esperado ao menos ${alvo.pisoPorClasse}. As conversões deste sub-projeto puseram ` +
      'essas referências; este número no chão significa que elas foram desfeitas em ' +
      'bloco, ou que a varredura está olhando outro trecho. "Zero espelhos" com zero ' +
      'código não é medida.');
  });

  test(`alcance subida 5 [${alvo.nome}]: cada exceção declarada casa com exatamente uma linha`, () => {
    const { ocorrencias } = varrer(alvo);
    for (const e of alvo.excecoes) {
      // Dedup por NUMERO DE LINHA, nao por ocorrencia de simbolo: algumas
      // linhas deste sub-projeto (template strings, condicoes compostas)
      // tem DOIS espelhos na MESMA linha. A pergunta certa e "esta LINHA de
      // codigo esta coberta pela excecao", nao "este SIMBOLO aparece uma vez".
      const linhas = new Set(
        ocorrencias.filter((o) => o.texto === e.linha).map((o) => o.linha));
      assert.equal(linhas.size, 1,
        `a exceção declarada para ${e.feature} (${alvo.rel}) casou com ` +
        `${linhas.size} linha(s) distinta(s), e tem de casar com exatamente uma.\n` +
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
  test(`alcance subida 5 [${alvo.nome}]: ${alvo.rel} não lê espelho de classe/subclasse/nível`, () => {
    const { ocorrencias } = varrer(alvo);
    const declaradas = new Set(alvo.excecoes.map((e) => e.linha));
    const sobrando = ocorrencias.filter((o) => !declaradas.has(o.texto));
    assert.deepEqual(sobrando.map((o) => `${alvo.rel}:${o.linha}  ${o.texto}`), [],
      `leitura de ESPELHO em ${alvo.rel} (${alvo.nome}).\n\n` +
      'personagem.classe/char.classe e .subclasse apontam sempre para a classe ' +
      'INICIAL, e .nivel é o nível TOTAL -- num personagem multiclasse os três estão ' +
      'errados para qualquer decisão que dependa da classe que ESTÁ SUBINDO. Uma ' +
      'decisão calculada sobre eles usa a classe/subclasse/nível ERRADOS assim que o ' +
      'personagem tiver uma segunda classe.\n\n' +
      'O conserto é ler pela CLASSE QUE SOBE, disponível ali mesmo (via `sub`/`ctx.sub`, ' +
      'devolvido por contextoDeSubida, ou via `classeQueSobe`/`ctx.classeQueSobe`):\n' +
      "  x.classe === 'C'   ->  sub.classe === 'C' (ou classeQueSobe === 'C')\n" +
      "  x.subclasse        ->  sub.subclasse\n" +
      "  x.nivel            ->  nivelNaClasseNovo (na classe) ou nivelTotalNovo/nivelNovo (total)\n\n" +
      'Se a leitura do nível TOTAL for CERTA (talento, Bônus de Proficiência/XP do ' +
      'personagem -- livro:2037 e livro:2047), declare-a em `excecoes`, neste arquivo, ' +
      'com o motivo por escrito e a regra do livro citada. Se for um defeito VIVO já ' +
      'conhecido e fora do escopo desta tarefa, declare também, dizendo por quê. Não ' +
      'acrescente exceção sem motivo: é a rede inteira que ela afrouxa.\n\nPontos encontrados:');
  });
}
