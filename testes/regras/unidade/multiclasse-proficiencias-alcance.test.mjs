// ============================================================
// Oraculo de ALCANCE do sub-projeto de proficiencias de armadura/arma por
// classe nova (livro:2051).
//
// POR QUE ESTE ARQUIVO EXISTE
// ---------------------------
// A Tarefa 1 construiu `regras-multiclasse-proficiencias.js`, um modulo
// PURO que junta a proficiencia de armadura/arma de TODAS as classes da
// ficha (`armadurasDoPersonagem`/`armasDoPersonagem`). A Tarefa 2 ligou
// quatro pontos de leitura a esse modulo -- `regras-equipamento.js`
// (temProficienciaArma/temProficienciaArmadura), `levelup.js` (o portao de
// talentos), `sheet/ficha.js` e `sheet/impressao.js` (as duas telas) --
// que ate entao liam `CLASSES_INFO[personagem.classe]` /
// `CLASSES_INFO[char.classe]` (o ESPELHO da classe INICIAL) e
// `info.armaduras`/`info.armas`. Num Mago 5/Guerreiro 1 isso fazia a ficha
// nao reconhecer NENHUMA proficiencia vinda do Guerreiro.
//
// Este arquivo prende CONVERSAO PARCIAL nesses quatro pontos: alguem
// reverter, esquecer, ou escrever uma linha nova sobre o espelho antigo.
// Ele e SINTATICO -- julga de ONDE o codigo le, nao o que ele faz --,
// mesma familia dos outros guardas de alcance do repositorio
// (multiclasse-combate-alcance.test.mjs e os que ele lista).
//
// ANCORAGEM POR CONTEUDO, NAO POR NUMERO DE LINHA. Cada faixa e achada
// pelo TEXTO de inicio e de fim, nunca por linha -- os quatro arquivos sao
// editados por outras tarefas o tempo todo, e um oraculo preso a numero
// ficaria vermelho por deslocamento.
//
// GUARDA CONTRA VACUIDADE. Se uma ancora nao for encontrada, ou se a faixa
// vier curta demais, ou se o filtro de comentarios apagar codigo junto, o
// teste FALHA -- um teste que mede um arquivo vazio (ou nao acha nada)
// passaria sempre, e isso e pior do que nenhum teste.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './harness.mjs';

/**
 * Apaga comentarios (`//` de linha e `/* *\/` de bloco) PRESERVANDO a
 * contagem de linhas, para que os numeros relatados sigam batendo com o
 * arquivo real. Sem este filtro, um comentario que CITA o espelho antigo
 * (como os que a propria Tarefa 2 escreveu, ex.: "Era `info.armaduras`")
 * contaria como leitura de codigo.
 *
 * O `(^|[^:])` antes de `//` evita comer o resto de uma URL
 * (`https://...`), mesmo padrao ja usado pelos outros guardas de alcance.
 *
 * @param {string} texto Codigo-fonte bruto.
 * @returns {string} o mesmo texto sem comentarios e com as mesmas linhas.
 */
function semComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/gm, (m, antes) => antes);
}

// Os padroes proibidos nas faixas convertidas. Os quatro primeiros sao os do
// Step 1 desta tarefa (o grep que mediu o estado antes de mexer). `\??`
// cobre o encadeamento opcional (`personagem?.classe`), a forma que
// regras-equipamento.js usava; sem ele, escrever a leitura de volta com
// `?.` em vez de `.` passaria pelo guarda sem ser notado.
//
// O QUINTO PADRAO E DA REVISAO FINAL (Importante 2, 2026-08-27). A guarda
// afirmava cobrir regras-equipamento.js INTEIRO (`ancoraInicio: null`) e
// mesmo assim `armasElegiveisMaestria` sobreviveu com
// `personagem?.classe === 'Bárbaro'` -- comparacao direta contra o espelho,
// que nenhum dos quatro padroes originais casa. A guarda afirmava mais do
// que media. Agora mede tambem a COMPARACAO com o espelho, que e a outra
// forma de perguntar "qual e a classe do personagem" lendo a classe
// INICIAL. O conserto continua sendo o mesmo: `temClasse(p, 'X')`.
const ESPELHOS = new RegExp([
  '(?<![\\w.$])CLASSES_INFO\\s*\\[\\s*(?:personagem|char)\\s*\\??\\s*\\.\\s*classe\\s*\\]',
  '(?<![\\w.$])info\\.(?:armaduras|armas)\\b',
  '(?<![\\w.$])(?:personagem|char)\\s*\\??\\s*\\.\\s*classe\\s*={2,3}',
].join('|'), 'g');

/**
 * Le um arquivo do app e devolve as linhas cruas (para achar ancoras) e as
 * limpas de comentario (para medir).
 *
 * @param {string} rel Caminho relativo a raiz do repositorio.
 * @returns {{brutas: string[], limpas: string[]}}
 */
function lerLinhas(rel) {
  const bruto = readFileSync(join(RAIZ, ...rel.split('/')), 'utf-8');
  return {
    brutas: bruto.split(/\r?\n/),
    limpas: semComentarios(bruto).split(/\r?\n/),
  };
}

/**
 * Acha a faixa de um alvo por CONTEUDO -- nunca por numero de linha.
 *
 * `ancoraInicio` nulo = o arquivo INTEIRO e a faixa (regras-equipamento.js,
 * que a Tarefa 2 converteu por completo). Com `ancoraInicio` e `ancoraFim`,
 * a faixa vai da linha da primeira ocorrencia da primeira ate a linha da
 * primeira ocorrencia da segunda, procurada a partir dali -- os blocos
 * convertidos em sheet/ficha.js e sheet/impressao.js estao dentro de uma
 * funcao de render bem maior, sem um `}` em coluna zero por perto, entao
 * este guarda ancora nos DOIS lados por texto em vez de procurar chave de
 * fechamento.
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

  const fim = brutas.findIndex((l, i) => i >= inicio && l.includes(alvo.ancoraFim));
  assert.notEqual(fim, -1,
    `GUARDA CONTRA VACUIDADE: a âncora de fim "${alvo.ancoraFim}" não foi encontrada ` +
    `depois de "${alvo.ancoraInicio}" em ${alvo.rel}.`);

  return { inicio, fim };
}

/**
 * Varre a faixa de um alvo e devolve as leituras de espelho encontradas.
 *
 * @param {object} alvo Entrada de ALVOS.
 * @returns {{ocorrencias: Array<{linha: number, texto: string}>,
 *            totalLinhas: number, corpo: string}}
 */
function varrer(alvo) {
  const { brutas, limpas } = lerLinhas(alvo.rel);
  const { inicio, fim } = faixaDoAlvo(alvo, brutas);
  const linhas = limpas.slice(inicio, fim + 1);
  const ocorrencias = [];
  linhas.forEach((texto, i) => {
    for (const m of texto.matchAll(ESPELHOS)) {
      ocorrencias.push({ linha: inicio + i + 1, texto: texto.trim() });
    }
  });
  return { ocorrencias, totalLinhas: linhas.length, corpo: linhas.join('\n') };
}

// ============================================================
// OS ALVOS: um por arquivo convertido pela Tarefa 2, com o piso de tamanho
// e as ancoras de codigo que provam que a faixa achada e a certa (e nao so
// o cabecalho).
// ============================================================
const ALVOS = [
  {
    nome: 'temProficienciaArma / temProficienciaArmadura / armasElegiveisMaestria',
    rel: 'site/js/regras-equipamento.js',
    // Arquivo inteiro. A Tarefa 2 convertera as DUAS funcoes de proficiencia
    // e a guarda ja afirmava "tudo o que havia nele" -- mas
    // `armasElegiveisMaestria` continuava comparando com o espelho, e nenhum
    // padrao daquela rodada casava com essa forma (Importante 2 da revisao
    // final). Convertida em 2026-08-27; a ancora de codigo abaixo prende as
    // tres.
    ancoraInicio: null,
    // O arquivo tem hoje ~145 linhas; 100 e folgado para refatoracao e
    // apertado o bastante para acusar uma varredura vazia.
    minimoLinhas: 100,
    ancorasCodigo: [
      'armasDoPersonagem(personagem)',
      'armadurasDoPersonagem(personagem)',
      "temClasse(personagem, 'Bárbaro')",
    ],
  },
  {
    nome: 'talentoElegivelParaPersonagem (portão de talentos)',
    rel: 'site/js/levelup.js',
    ancoraInicio: 'export function talentoElegivelParaPersonagem',
    ancoraFim: 'return opcoes.permitirExistente === true || !jaTem || repetivel;',
    // A faixa tem hoje ~49 linhas.
    minimoLinhas: 40,
    ancorasCodigo: ['armadurasDoPersonagem(personagem)'],
  },
  {
    nome: 'ficha: bloco de Proficiências de Armas e Armaduras',
    rel: 'site/js/sheet/ficha.js',
    ancoraInicio: '<!-- Proficiencias de Armas e Armaduras -->',
    ancoraFim: 'Concedida por subclasse/talento',
    // A faixa tem hoje ~34 linhas.
    minimoLinhas: 25,
    ancorasCodigo: ['armadurasDoPersonagem(char)', 'armasDoPersonagem(char)'],
  },
  {
    nome: 'impressão: bloco de Proficiências de Armaduras e Armas',
    rel: 'site/js/sheet/impressao.js',
    ancoraInicio: '// --- Proficiencias de Armaduras e Armas ---',
    ancoraFim: 'Concedida por subclasse/talento',
    // A faixa tem hoje ~32 linhas.
    minimoLinhas: 25,
    ancorasCodigo: ['armadurasDoPersonagem(char)', 'armasDoPersonagem(char)'],
  },
];

// ============================================================
// O filtro de comentarios, provado a parte -- ele e a peca de que TODA a
// medida depende: se apagasse codigo junto, a contagem de espelhos viria
// zero por vacuidade e o guarda passaria com qualquer implementacao.
// ============================================================
test('proficiencias-alcance: o filtro de comentários apaga prosa e preserva código', () => {
  const amostra = [
    'const a = CLASSES_INFO[personagem.classe];',
    '// comentário citando CLASSES_INFO[char.classe] e info.armaduras',
    'const b = 1; // rabo de comentário com info.armas',
    '/* bloco',
    '   citando info.armaduras',
    '   em várias linhas */',
    'const c = info.armas;',
    // Padrão acrescentado pelo Importante 2 da revisão final: comparação
    // direta com o espelho, a forma que sobreviveu em armasElegiveisMaestria.
    "if (personagem?.classe === 'Bárbaro') {",
  ].join('\n');
  const limpo = semComentarios(amostra);
  assert.equal(limpo.split('\n').length, amostra.split('\n').length,
    'o filtro tem de preservar a contagem de linhas, senão os números relatados mentem');

  const achados = [...limpo.matchAll(ESPELHOS)].map((m) => m[0]);
  // Três leituras de CÓDIGO: a da linha 1 (CLASSES_INFO[personagem.classe]),
  // `info.armas` e a comparação `personagem?.classe ===`. NENHUMA das três
  // citações em comentário pode sobreviver.
  assert.equal(achados.length, 3,
    `esperado 3 leituras de código, achadas ${achados.length}: ${achados.join(', ')}`);
  assert.ok(!limpo.includes('citando'), 'texto de comentário sobreviveu ao filtro');
  assert.ok(!limpo.includes('rabo de comentário'), 'comentário de fim de linha sobreviveu');
});

// ============================================================
// Guardas contra vacuidade -- rodam ANTES da medida, um por alvo.
// ============================================================
for (const alvo of ALVOS) {
  test(`proficiencias-alcance [${alvo.nome}]: a varredura enxerga a faixa`, () => {
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
  });
}

// ============================================================
// A MEDIDA: zero leituras de espelho nas quatro faixas convertidas.
// ============================================================
for (const alvo of ALVOS) {
  test(`proficiencias-alcance [${alvo.nome}]: ${alvo.rel} não lê o espelho de armadura/arma`, () => {
    const { ocorrencias } = varrer(alvo);
    assert.deepEqual(ocorrencias.map((o) => `${alvo.rel}:${o.linha}  ${o.texto}`), [],
      `leitura de ESPELHO em ${alvo.rel} (${alvo.nome}).\n\n` +
      'CLASSES_INFO[personagem.classe]/CLASSES_INFO[char.classe] e ' +
      'info.armaduras/info.armas leem sempre a classe INICIAL -- num personagem ' +
      'multiclasse eles ignoram qualquer proficiência vinda de uma classe ' +
      'adquirida depois (livro:2051).\n\n' +
      'O conserto é ler pela UNIÃO das classes, de ' +
      'regras-multiclasse-proficiencias.js:\n' +
      '  info.armaduras  ->  armadurasDoPersonagem(personagem)\n' +
      '  info.armas      ->  armasDoPersonagem(personagem)\n\n' +
      'Pontos encontrados:');
  });
}
