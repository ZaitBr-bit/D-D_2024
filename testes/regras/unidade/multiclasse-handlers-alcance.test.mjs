// ============================================================
// Oraculo de ALCANCE dos handlers por classe (setupEventosHabilidades).
//
// POR QUE ESTE ARQUIVO EXISTE
// ---------------------------
// O sub-projeto 3c converteu `setupEventosHabilidades`
// (site/js/sheet/habilidades.js) de ESPELHO para MULTICLASSE: 60 leituras
// deixaram de olhar `char.classe`, `char.subclasse` e `char.nivel` -- que
// apontam sempre para a classe INICIAL e para o nivel TOTAL -- e passaram a
// olhar `temClasse(char, C)`, `subclasseDe(char, C)` e `nivelNa(char, C)`,
// onde C e a classe a que aquele botao pertence.
//
// A revisao final do 3c mediu a rede que protege essa conversao: reverteu
// UMA A UMA as 60 leituras e rodou os 9 oraculos de
// `testes/e2e/regras/multiclasse-handlers.spec.mjs` a cada reversao.
// Resultado: 55 das 60 SOBREVIVEM (91,7%) -- so 5 matam algum oraculo. O
// caso concreto que ela exibiu: reverter so o `nivelNa(char, 'Guerreiro')`
// do Recuperar Folego para `char.nivel || 1` faz um Barbaro 10/Guerreiro 5
// curar `1d10+15` em vez de `1d10+5`, e os 9 oraculos ficam 9/9 VERDES.
//
// E a mesma familia de defeito que o 3b enfrentou no render (138 de 145
// mutacoes sobreviviam), e que o obrigou a construir
// `multiclasse-render-alcance.test.mjs`. Este arquivo e o equivalente para
// os handlers.
//
// O defeito que passava nao e exotico: e CONVERSAO PARCIAL -- alguem
// reverter, esquecer ou acrescentar uma linha nova sobre o espelho. Os 9
// oraculos existentes sao PONTUAIS: cada um prende UM comportamento (o
// Canalizar Divindade do Clerigo, a Furia Persistente, o teto de maestrias).
// Nenhum prende a propriedade geral.
//
// A PROPRIEDADE QUE ESTE ARQUIVO PRENDE
// -------------------------------------
// Dentro de `setupEventosHabilidades` NAO PODE HAVER leitura de espelho.
// Todo handler pertence a UMA classe conhecida no proprio ponto do codigo,
// entao a classe, a subclasse e o nivel dele tem de vir de
// `temClasse`/`subclasseDe`/`nivelNa` -- nunca de `char.classe`,
// `char.subclasse` ou `char.nivel`.
//
// POR QUE UM TESTE ESTATICO, E NAO COMPORTAMENTAL
// ----------------------------------------------
// O analogo do render (`multiclasse-render-alcance.test.mjs`) e
// comportamental: chama `renderFeatureItem` e compara HTML. Aqui isso nao
// e possivel pelo mesmo motivo que os oraculos do 3c sao e2e e nao unidade:
// `setupEventosHabilidades` so registra `addEventListener`, e o harness de
// unidade monta um `document` de mentira, sem eventos de verdade. Cobrir as
// 60 leituras por comportamento custaria 60 cenarios de navegador.
//
// A varredura estatica compra a MESMA propriedade por muito menos: ela nao
// julga o que o handler faz, julga de ONDE ele le. Uma conversao revertida
// reintroduz o simbolo `char.classe`/`char.subclasse`/`char.nivel` na faixa
// -- e e exatamente isso que este arquivo proibe.
//
// A UNICA EXCECAO, DECLARADA EM `EXCECOES_NIVEL_TOTAL`
// ----------------------------------------------------
// Maos Curativas do Aasimar le `char.nivel` DE PROPOSITO e tem de continuar
// lendo. E traco de ESPECIE -- nao existe "nivel na classe" para especie --
// e rola "um numero de d4s igual ao seu Bonus de Proficiencia"
// (Especies.md:25), que vem do nivel TOTAL do personagem, "nao do nivel de
// uma classe especifica" (PHB.md:2047). Quem prende esse comportamento e o
// Oraculo 9 de multiclasse-handlers.spec.mjs.
//
// A excecao e declarada por CONTEUDO da linha e com o motivo por escrito,
// nao por numero de linha nem por uma contagem "espera-se 1": uma contagem
// deixaria QUALQUER leitura nova passar desde que outra sumisse.
//
// TRES ARMADILHAS QUE ESTE ARQUIVO EVITA DE PROPOSITO
// ---------------------------------------------------
// 1. COMENTARIOS NAO CONTAM. Este sub-projeto exige comentario em toda
//    conversao, e os comentarios CITAM os espelhos ("nao converter para
//    char.nivel"). Um `grep -o "char.nivel"` conta prosa: o implementador
//    da Tarefa 2 viu a contagem "nao fechar" duas vezes por isso. A faixa e
//    limpa por `semComentarios` antes de qualquer conta.
// 2. ANCORAGEM POR CONTEUDO, NAO POR LINHA. `setupEventosHabilidades` hoje
//    vai de 101 a 2585, e qualquer edicao desloca os dois numeros. O inicio
//    e o fim sao achados pelo TEXTO da assinatura e pelo primeiro `}` em
//    coluna zero depois dela.
// 3. GUARDA CONTRA VACUIDADE. Um teste que mede um arquivo vazio passa
//    sempre. Se a assinatura nao for encontrada, se a faixa vier curta
//    demais, se o filtro de comentarios apagar o codigo junto, ou se uma
//    excecao declarada nao casar com nada, o teste FALHA.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './harness.mjs';

const ARQUIVO = join(RAIZ, 'site', 'js', 'sheet', 'habilidades.js');
const REL = 'site/js/sheet/habilidades.js';

// A assinatura que abre a faixa medida. Texto, nao numero de linha.
const ASSINATURA = 'export function setupEventosHabilidades()';

// Piso de tamanho da faixa. `setupEventosHabilidades` tem hoje ~2485
// linhas; 500 e folgado o bastante para nao brigar com refatoracao e
// apertado o bastante para acusar uma varredura que achou so o cabecalho.
const MINIMO_LINHAS = 500;

// Os espelhos proibidos: os tres campos que `sincronizarEspelhos()` escreve
// apontando para a classe INICIAL (classe, subclasse) e para o nivel TOTAL.
// `char.classes` (a lista de verdade) NAO casa -- `classe\b` nao encosta em
// `classes`.
const ESPELHOS = /(?<![\w.$])char\s*\.\s*(classe|subclasse|nivel)\b/g;

/**
 * As leituras de espelho que continuam CERTAS, declaradas uma a uma com o
 * motivo. Casadas pelo CONTEUDO da linha (texto ja sem comentario, com os
 * espacos das pontas cortados), nunca por numero de linha.
 *
 * Cada entrada tem de casar com EXATAMENTE UMA linha da faixa: zero
 * significa que a excecao virou letra morta (o codigo mudou e ninguem
 * reviu a justificativa), mais de uma significa que a declaracao ficou
 * ambigua e estaria absolvendo uma leitura que ninguem examinou.
 */
const EXCECOES_NIVEL_TOTAL = [
  {
    linha: 'const pb = bonusProficiencia(char.nivel || 1);',
    feature: 'Mãos Curativas (traço de espécie do Aasimar)',
    motivo:
      'Traço de ESPÉCIE: não existe "nível na classe" para espécie. Rola "um ' +
      'número de d4s igual ao seu Bônus de Proficiência" (Especies.md:25), e o ' +
      'Bônus de Proficiência vem do nível TOTAL do personagem, não do nível de ' +
      'uma classe específica (PHB.md:2047). O espelho char.nivel JÁ É o total ' +
      '(regras-multiclasse.js). Comportamento preso pelo Oráculo 9 de ' +
      'testes/e2e/regras/multiclasse-handlers.spec.mjs.',
  },
];

/**
 * Apaga comentarios (`//` de linha e `/* *\/` de bloco) PRESERVANDO a
 * contagem de linhas, para que os numeros relatados sigam batendo com o
 * arquivo real.
 *
 * O `(^|[^:])` antes de `//` evita comer o resto de uma URL (`https://...`),
 * mesmo padrao ja usado por gatilhos-ui-cobertos.test.mjs.
 *
 * @param {string} texto
 * @returns {string} o mesmo texto sem comentarios e com as mesmas linhas.
 */
function semComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/gm, (m, antes) => antes);
}

/**
 * Acha a faixa de `setupEventosHabilidades` por CONTEUDO: a linha da
 * assinatura ate o primeiro `}` em coluna zero depois dela.
 *
 * @param {string[]} linhas Todas as linhas do arquivo.
 * @returns {{inicio:number,fim:number}} indices 0-based, `fim` inclusivo.
 */
function faixaDaFuncao(linhas) {
  const inicio = linhas.findIndex((l) => l.includes(ASSINATURA));
  assert.notEqual(inicio, -1,
    `GUARDA CONTRA VACUIDADE: a assinatura "${ASSINATURA}" não foi encontrada em ` +
    `${REL}. Sem faixa não há o que medir, e um teste que não acha nada passaria ` +
    'sempre. Se a função foi renomeada, atualize ASSINATURA aqui.');
  let fim = -1;
  for (let i = inicio + 1; i < linhas.length; i++) {
    if (/^\}/.test(linhas[i])) { fim = i; break; }
  }
  assert.notEqual(fim, -1,
    `GUARDA CONTRA VACUIDADE: não foi achado o "}" em coluna zero que fecha ` +
    `${ASSINATURA} em ${REL}.`);
  return { inicio, fim };
}

/**
 * Todas as leituras de espelho da faixa, ja sem comentarios.
 *
 * @returns {{ocorrencias:Array<{linha:number,texto:string,simbolo:string}>,
 *            totalLinhas:number, corpo:string}}
 */
function varrer() {
  const bruto = readFileSync(ARQUIVO, 'utf-8');
  const linhasBrutas = bruto.split(/\r?\n/);
  const { inicio, fim } = faixaDaFuncao(linhasBrutas);
  const linhas = semComentarios(bruto).split(/\r?\n/).slice(inicio, fim + 1);
  const ocorrencias = [];
  linhas.forEach((texto, i) => {
    for (const m of texto.matchAll(ESPELHOS)) {
      ocorrencias.push({ linha: inicio + i + 1, texto: texto.trim(), simbolo: m[0] });
    }
  });
  return { ocorrencias, totalLinhas: linhas.length, corpo: linhas.join('\n') };
}

// ============================================================
// Guardas contra vacuidade -- rodam ANTES da medida.
//
// Sem elas, uma varredura que lesse o arquivo errado, achasse a faixa
// vazia, ou tivesse o filtro de comentarios apagando codigo junto daria
// "zero leituras de espelho" e passaria com qualquer implementacao.
// ============================================================
test('alcance handlers: a varredura enxerga a faixa de setupEventosHabilidades', () => {
  const { totalLinhas, corpo } = varrer();
  assert.ok(totalLinhas >= MINIMO_LINHAS,
    `só ${totalLinhas} linhas na faixa de ${ASSINATURA} -- esperado ao menos ` +
    `${MINIMO_LINHAS}. A varredura achou a assinatura mas o corpo veio curto ` +
    'demais para ser a função de verdade.');
  // O filtro de comentarios nao pode ter levado o codigo junto: estes tres
  // ancoras sao codigo executavel, nao prosa.
  for (const ancora of ['addEventListener', 'querySelectorAll', 'nivelNa(char,']) {
    assert.ok(corpo.includes(ancora),
      `a faixa medida não contém "${ancora}" -- o filtro de comentários apagou ` +
      'código junto, e a contagem de espelhos seria zero por vacuidade.');
  }
  // E a conversao do 3c tem de estar la em quantidade: se as chamadas por
  // classe sumissem, "zero espelhos" poderia significar "zero codigo".
  const porClasse = (corpo.match(/\b(temClasse|subclasseDe|nivelNa)\(char\s*,/g) || []).length;
  assert.ok(porClasse >= 30,
    `só ${porClasse} leituras por classe (temClasse/subclasseDe/nivelNa) na faixa. ` +
    'A conversão do 3c pôs dezenas delas -- este número no chão significa que a ' +
    'varredura está olhando outro trecho.');
});

test('alcance handlers: o filtro de comentários apaga prosa e preserva código', () => {
  const amostra = [
    'const a = char.nivel;',
    '// comentário citando char.classe e char.subclasse',
    'const b = 1; // rabo de comentário com char.nivel',
    '/* bloco',
    '   citando char.classe',
    '   em várias linhas */',
    'const url = "https://exemplo/char.nivel";',
  ].join('\n');
  const limpo = semComentarios(amostra);
  assert.equal(limpo.split('\n').length, amostra.split('\n').length,
    'o filtro tem de preservar a contagem de linhas, senão os números relatados mentem');
  const achados = [...limpo.matchAll(ESPELHOS)].map((m) => m[0]);
  // Duas leituras de CÓDIGO: a da linha 1 e a de dentro da string da URL
  // (uma string é código, e este filtro não interpreta strings -- o que
  // importa é que NENHUMA das citações em comentário sobreviveu).
  assert.equal(achados.length, 2,
    `esperado 2 leituras de código, achadas ${achados.length}: ${achados.join(', ')}`);
  assert.ok(!limpo.includes('citando'), 'texto de comentário sobreviveu ao filtro');
  assert.ok(!limpo.includes('rabo de comentário'), 'comentário de fim de linha sobreviveu');
});

test('alcance handlers: cada exceção declarada casa com exatamente uma linha', () => {
  const { ocorrencias } = varrer();
  for (const e of EXCECOES_NIVEL_TOTAL) {
    const casos = ocorrencias.filter((o) => o.texto === e.linha);
    assert.equal(casos.length, 1,
      `a exceção declarada para ${e.feature} casou com ${casos.length} linha(s) da faixa, ` +
      'e tem de casar com exatamente uma.\n' +
      `  linha declarada: ${e.linha}\n` +
      '  Zero: a exceção virou letra morta -- o código mudou e o motivo por escrito ' +
      'não foi revisto. Reveja e atualize EXCECOES_NIVEL_TOTAL.\n' +
      '  Mais de uma: a declaração ficou ambígua e estaria absolvendo uma leitura ' +
      'que ninguém examinou. Torne o texto declarado único.');
  }
});

// ============================================================
// A MEDIDA: zero leituras de espelho na faixa, fora as declaradas.
// ============================================================
test('alcance handlers: setupEventosHabilidades não lê char.classe/char.subclasse/char.nivel', () => {
  const { ocorrencias } = varrer();
  const declaradas = new Set(EXCECOES_NIVEL_TOTAL.map((e) => e.linha));
  const sobrando = ocorrencias.filter((o) => !declaradas.has(o.texto));
  assert.deepEqual(sobrando.map((o) => `${REL}:${o.linha}  ${o.texto}`), [],
    'leitura de ESPELHO dentro de setupEventosHabilidades.\n\n' +
    'char.classe e char.subclasse apontam sempre para a classe INICIAL, e ' +
    'char.nivel é o nível TOTAL -- num personagem multiclasse os três estão ' +
    'errados para qualquer botão que não seja da primeira classe. Um handler ' +
    'escrito sobre eles é um botão que aparece na tela e não faz nada, ou que faz ' +
    'a conta com o nível do personagem errado.\n\n' +
    'O conserto é ler pela classe a que o botão pertence, que é conhecida ali ' +
    'mesmo:\n' +
    "  char.classe === 'X'    ->  temClasse(char, 'X')\n" +
    "  char.subclasse         ->  subclasseDe(char, 'X')\n" +
    "  char.nivel             ->  nivelNa(char, 'X')\n\n" +
    'Se a leitura do nível TOTAL for CERTA (traço de espécie, Bônus de ' +
    'Proficiência do personagem -- PHB.md:2047), declare-a em ' +
    'EXCECOES_NIVEL_TOTAL, neste arquivo, com o motivo por escrito e a regra do ' +
    'livro citada. Não acrescente exceção sem motivo: é a rede inteira que ela ' +
    'afrouxa.\n\nPontos encontrados:');
});
