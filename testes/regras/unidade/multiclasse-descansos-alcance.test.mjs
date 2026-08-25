// ============================================================
// Oraculo de ALCANCE do sub-projeto 3e (PV, dados de vida e descansos).
//
// POR QUE ESTE ARQUIVO EXISTE
// ---------------------------
// Mesmo motivo do 3c e do 3d: oraculos PONTUAIS nao prendem a propriedade
// GERAL. Uma conversao revertida uma a uma passa despercebida pelos
// oraculos de comportamento enquanto sobrar QUALQUER caminho que ainda
// acerte o resultado por acidente. A resposta e um GUARDA ESTATICO que le
// o arquivo inteiro (ou a faixa convertida) e exige ZERO leitura de
// espelho, com as excecoes declaradas por texto e com o motivo escrito.
//
// ESTE ARQUIVO PROMOVE `site/js/sheet/hp-descanso.js`
// ----------------------------------------------------
// `multiclasse-combate-alcance.test.mjs` (guarda do 3d) documentava, no
// proprio cabecalho: "hp-descanso.js e escopo do sub-projeto 3e... Por
// isso ele NAO entra em ALVOS: e coberto por um teste de ANCORA proprio,
// no fim deste arquivo... Quando o 3e converter o resto, promova
// hp-descanso.js a ALVOS e apague o teste de ancora." As Tarefas 1-10
// converteram o resto do arquivo (formula de PV, reservas de dado de vida
// por tipo, Resiliencia Draconica, restaurarHabilidades, os 24 blocos dos
// dois descansos). A promocao aconteceu: `hp-descanso.js` entra em ALVOS
// aqui, e o teste de ancora (junto com as constantes HP_DESCANSO_REL e
// HP_DESCANSO_LINHAS_CONVERTIDAS) foi apagado de
// multiclasse-combate-alcance.test.mjs.
//
// A PROPRIEDADE POSITIVA QUE O TESTE DE ANCORA PRENDIA NAO SOME JUNTO
// ---------------------------------------------------------------------
// O teste apagado exigia, ALEM do negativo (nenhuma linha sobre maestria
// le espelho), um POSITIVO: as duas linhas que a Tarefa 5 do 3d escreveu
// (`classesDeMaestria` e `trocaUma`) existirem EXATAMENTE UMA VEZ cada, e
// `classesComMaestria` vir de `./maestrias.js`. Um guarda de "zero
// espelhos" NAO prende isso -- reescrever aquelas duas linhas com um
// LITERAL (por exemplo trocar `classesComMaestria(char)` por um array
// fixo) nao reintroduz espelho nenhum, entao passaria batido pelos testes
// de ALVOS abaixo. Por isso o positivo tem teste proprio, no fim deste
// arquivo, na secao "PROPRIEDADE HERDADA DO 3d".
//
// AS QUATRO ARMADILHAS EVITADAS DE PROPOSITO (as mesmas do 3c e do 3d)
// ----------------------------------------------------------------------
// 1. COMENTARIOS NAO CONTAM. Este sub-projeto exige comentario em toda
//    conversao, e os comentarios CITAM os espelhos ("nao converter para
//    char.nivel"). Um grep cru contaria prosa. A faixa e limpa por
//    `semComentarios` antes de qualquer conta, e ha um teste dedicado
//    provando que o filtro apaga prosa e preserva codigo.
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
// UM QUINTO PONTO, NOVO AQUI: EXCECAO EM LINHA COM MAIS DE UM ESPELHO
// ---------------------------------------------------------------------
// O 3d nunca precisou disso, mas `hp-descanso.js` e `ficha.js` tem linhas
// (template strings, principalmente) com DOIS espelhos na MESMA linha --
// ex.: `char.classe === 'Mago' && (char.nivel || 1) >= 5`. O teste
// "cada excecao casa com exatamente uma linha" do 3d contava OCORRENCIAS
// (uma por SIMBOLO casado); numa linha com dois simbolos isso daria 2 e
// quebraria a excecao unica. Aqui o teste conta LINHAS distintas (dedup
// por numero de linha), que e o que a frase realmente quer dizer: "esta
// linha de codigo esta coberta", nao "este simbolo aparece uma vez".
//
// O DEFEITO QUE ESTE GUARDA PEGA, E O QUE ELE NAO PEGA
// ----------------------------------------------------
// Ele e SINTATICO: julga de ONDE o codigo le, nao o que ele faz. Uma
// conversao para a CLASSE ERRADA (`nivelNa(char, 'Bardo')` num ramo que e
// de Bruxo) passa por ele sem reclamar, porque o simbolo lido e o certo.
// E, mais importante para este sub-projeto especificamente: reverter um
// valor CALCULADO para um LITERAL (`d${r.faces}` -> `d6`, ou
// `nivelFeiticeiro` -> `5`) NAO reintroduz leitura de espelho nenhuma --
// o guarda fica verde por construcao. Prender isso e trabalho dos
// oraculos de comportamento de `multiclasse-descansos.test.mjs`; a
// campanha de mutacao da Tarefa 11 mede exatamente essa fronteira.
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
 * encadeamento opcional (`x?.classe`) -- forma que hp-descanso.js e
 * ficha.js nao usam hoje, mas que o guarda do 3d exigiu depois de medir
 * que outro arquivo do app a usava de verdade; manter a cobertura aqui
 * evita abrir de novo o mesmo caminho silencioso de reversao.
 *
 * O `(?<![\w.$])` antes do identificador evita casar sufixo de outro nome
 * (`meuChar.nivel`) e propriedade de outro objeto (`fonte.char.nivel`).
 * `char.classes` -- a LISTA de verdade -- nao casa, porque `classe\b` nao
 * encosta em `classes`.
 *
 * @param {string[]} identificadores Nomes de variavel que carregam o
 *   personagem naquele arquivo (ex.: ['char']).
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
 * (`https://...`), mesmo padrao ja usado pelos guardas do 3c e do 3d.
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
// `hp-descanso.js` e o arquivo INTEIRO -- e o unico consumidor de
// char.classe/subclasse/nivel do arquivo, e o 3e converteu tudo que havia
// de escopo dele. `ficha.js` tem leituras CORRETAS de char.nivel ANTES do
// recalculo de PV (Bonus de Proficiencia, `info` residual -- ver comentario
// em ficha.js:176-185), entao a faixa comeca so no recalculo de PV.
// ============================================================
const ALVOS = [
  {
    nome: 'PV, dados de vida e descansos',
    rel: 'site/js/sheet/hp-descanso.js',
    identificadores: ['char'],
    ancoraInicio: null, // o arquivo inteiro
    // 24 blocos de descanso + restaurarHabilidades + Draconica + modal de
    // dano. Piso folgado o bastante para refatoracao, apertado o bastante
    // para acusar o sumico de uma familia inteira.
    minimoLinhas: 800,
    ancorasCodigo: ['reservasDadosVida', 'gastarDadosVida',
                    'restaurarTodosDadosVida', 'contextosDeClasse',
                    'temClasse(char,', 'nivelNa(char,', 'subclasseDe(char,'],
    pisoPorClasse: 50,
    excecoes: [
      {
        linha: 'const esperado = ehAnao ? (char.nivel || 1) : 0;',
        feature: 'Tenacidade Anã (sincronizarBonusPvAnao)',
        motivo:
          'Traço de ESPÉCIE, correto por regra: Especies.md:61 diz que os PV ' +
          'máximos "aumentam em 1 sempre que você atinge um nível de personagem" ' +
          '-- é o nível TOTAL que manda, não o nível numa classe. Mesma família da ' +
          'exceção de Forma Grande (Goliás) que o guarda do 3d preservou.',
      },
      {
        linha: 'const esperado = temVigoroso ? (char.nivel || 1) * 2 : 0;',
        feature: 'Talento Vigoroso (sincronizarBonusPvVigoroso)',
        motivo:
          'Talento, não característica de classe: Talentos.md:230 concede PV ' +
          'máximos "igual ao dobro do seu nível de personagem" -- de novo o nível ' +
          'TOTAL, por regra, não o nível numa classe.',
      },
      {
        linha: 'const tracosSinteticos = gerarTracoSinteticoEspecie(char.especie, char.tracos_escolhidos, char.nivel) || [];',
        feature: 'Traços sintéticos de espécie em restaurarHabilidades (Tiferino, Elfo etc.)',
        motivo:
          'Mesmo motivo da Tenacidade Anã acima: traço de ESPÉCIE, e o texto do ' +
          'próprio traço fala em nível de personagem, não em nível de classe.',
      },
      {
        linha: "const memorizarMagia = char.classe === 'Mago' && (char.nivel || 1) >= 5",
        feature: 'Gate do botão "Memorizar Magia" no Descanso Curto',
        motivo:
          'NAO CONVERTIDA DE PROPOSITO, como o comentário logo acima desta linha ' +
          'documenta: decide troca de magia preparada -- escopo do sub-projeto 4 ' +
          '(magias), não desta tarefa (3e, PV/dados de vida/descansos). Continua ' +
          'lendo a classe e o nível INICIAIS.',
      },
      {
        linha: 'const _infoClasseRest = CLASSES_INFO[char.classe];',
        feature: 'Recálculo de espaços de magia ao fim do Descanso Longo',
        motivo:
          'NAO CONVERTIDA DE PROPOSITO (mesmo comentário acima da linha, no ' +
          'arquivo): escopo do sub-projeto 4 (magias). `CLASSES_INFO[char.classe]` ' +
          'continua lendo a classe INICIAL.',
      },
      {
        linha: 'const _espacosBase = getEspacosMagia(classeData.tabela_caracteristicas, char.nivel);',
        feature: 'Recálculo de espaços de magia ao fim do Descanso Longo (mesmo bloco acima)',
        motivo:
          'NAO CONVERTIDA DE PROPOSITO: mesmo bloco e mesmo motivo da linha ' +
          'anterior -- sub-projeto 4 (magias), continua lendo o nível TOTAL em vez ' +
          'do nível na classe conjuradora.',
      },
      {
        linha: 'const infoClasse = CLASSES_INFO[char.classe] || {};',
        feature: 'Troca de magia/truque ao fim do Descanso Longo (infoClasse.conjurador, infoClasse.tipo_conjuracao)',
        motivo:
          'NAO CONVERTIDA DE PROPOSITO, como o comentário "Verificar se a classe ' +
          'tem Maestria em Arma e/ou troca de magias" documenta: escopo do ' +
          'sub-projeto 4 (magias), não desta tarefa. Continua lendo a classe ' +
          'INICIAL.',
      },
      {
        linha: "const temTrocaMagia = trocaNoDescansoLongo(char.classe) === 'uma' || ehSubConj;",
        feature: 'Troca de magia ao fim do Descanso Longo',
        motivo:
          'NAO CONVERTIDA DE PROPOSITO (mesmo bloco de infoClasse acima): escopo ' +
          'do sub-projeto 4 (magias). `trocaNoDescansoLongo` continua recebendo a ' +
          'classe INICIAL.',
      },
      {
        linha: "Como ${escHtml(char.classe)}${ehSubConj ? ' (' + escHtml(char.subclasse) + ')' : ''}, você pode trocar <strong>1 magia ${rotuloMagia}</strong> por outra da lista de classe após um Descanso Longo. Para remontar a lista inteira, use a subida de nível.",
        feature: 'Rótulo "Como Classe (Subclasse), você pode trocar..." no modal do Descanso Longo',
        motivo:
          'NAO CONVERTIDA DE PROPOSITO: rótulo de texto da troca de magia -- ' +
          'escopo do sub-projeto 4 (magias), não desta tarefa. Duas leituras de ' +
          'espelho na MESMA linha (char.classe e char.subclasse); o teste de ' +
          'exceção deste arquivo dedup por número de linha, não por ocorrência.',
      },
      {
        linha: 'Você pode trocar <strong>1 truque</strong> por outro da lista de ${escHtml(char.classe)} após um Descanso Longo.',
        feature: 'Rótulo de troca de truque no modal do Descanso Longo',
        motivo:
          'NAO CONVERTIDA DE PROPOSITO: mesmo motivo do rótulo de troca de magia ' +
          'acima -- escopo do sub-projeto 4 (magias).',
      },
    ],
  },
  {
    nome: 'PV, cabeçalho e painéis de recurso da ficha',
    rel: 'site/js/sheet/ficha.js',
    identificadores: ['char'],
    // ficha.js tem leituras CORRETAS de char.nivel (Bônus de Proficiência e
    // `info` residual, ANTES do recálculo de PV), então a faixa NÃO é o
    // arquivo inteiro -- começa no recálculo de PV e vai até o fim dos
    // painéis de recurso (fim da função renderFichaCompleta).
    ancoraInicio: '  // Recalcular PV max se necessário.',
    ancoraFimApos: 'Recursos do Guerreiro',
    minimoLinhas: 200,
    ancorasCodigo: ['calcPVMulticlasse', 'classesDe(char)',
                    'subclasseDe(char,', 'nivelNa(char,'],
    pisoPorClasse: 6,
    excecoes: [
      {
        linha: '})()} &middot; Nível ${char.nivel}',
        feature: 'Cabeçalho -- nível total exibido ao lado das classes ("Mago 5 / Bárbaro 5 · Nível 10")',
        motivo:
          '`Nível` aqui é sempre o TOTAL, por regra -- regras-multiclasse.js:55 ' +
          'documenta "é o número que manda em Bônus de Proficiência e XP ' +
          '(livro:2037, 2047)", e nível de personagem é o mesmo conceito. O ' +
          'comentário logo acima desta linha, em ficha.js:262, já registra isso.',
      },
      {
        linha: "${char.nivel < 20 ? ` / ${XP_POR_NIVEL[char.nivel + 1]}` : ' (Nível Máximo)'}",
        feature: 'Cabeçalho -- XP até o próximo nível',
        motivo:
          'XP é acumulado pelo personagem inteiro, não por classe ' +
          '(regras-multiclasse.js:55, livro:2037/2047) -- duas leituras de ' +
          'espelho na mesma linha, dedup por número de linha.',
      },
      {
        linha: '${char.nivel < 20 ? `',
        feature: 'Cabeçalho -- gate que mostra o botão "Subir de Nível" até o nível 20',
        motivo:
          'Mesmo motivo da linha de XP acima: nível de personagem é o TOTAL, e o ' +
          'teto de 20 é do personagem, não de uma classe isolada.',
      },
      {
        linha: '⬆ Subir de Nível (Nível ${char.nivel + 1})',
        feature: 'Cabeçalho -- rótulo do botão "Subir de Nível"',
        motivo:
          'O próximo nível que o botão anuncia é o próximo nível TOTAL do ' +
          'personagem (o jogador escolhe em qual classe ele entra dentro do ' +
          'próprio fluxo de subida) -- mesmo motivo das linhas acima.',
      },
      {
        linha: 'const total = bonusProficiencia(char.nivel);',
        feature: 'Sortudo -- Pontos de Sorte (bônus de proficiência)',
        motivo:
          'Bônus de Proficiência vem do nível TOTAL do personagem, "não do nível ' +
          'de uma classe específica" (livro:2047, citado em ' +
          'regras-multiclasse.js:55) -- Pontos de Sorte do talento Sortudo são ' +
          'iguais ao Bônus de Proficiência.',
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
test('alcance 3e: o filtro de comentários apaga prosa e preserva código', () => {
  const amostra = [
    'const a = char.nivel;',
    '// comentário citando char.classe e char.subclasse',
    'const b = 1; // rabo de comentário com char.nivel',
    '/* bloco',
    '   citando char.classe',
    '   em várias linhas */',
    'const url = "https://exemplo/char.nivel";',
    'const c = char?.classe;',
  ].join('\n');
  const limpo = semComentarios(amostra);
  assert.equal(limpo.split('\n').length, amostra.split('\n').length,
    'o filtro tem de preservar a contagem de linhas, senão os números relatados mentem');

  const achados = [...limpo.matchAll(regexEspelhos(['char']))].map((m) => m[0]);
  // Três leituras de CÓDIGO: a da linha 1, a de dentro da string da URL (uma
  // string é código, e este filtro não interpreta strings) e a da última
  // linha, com encadeamento opcional. NENHUMA das citações em comentário
  // pode sobreviver.
  assert.equal(achados.length, 3,
    `esperado 3 leituras de código, achadas ${achados.length}: ${achados.join(', ')}`);
  assert.ok(achados.some((s) => s.includes('?.')),
    'o regex tem de casar o encadeamento opcional (char?.classe) -- sem ela haveria ' +
    'caminho silencioso de reversão');
  assert.ok(!limpo.includes('citando'), 'texto de comentário sobreviveu ao filtro');
  assert.ok(!limpo.includes('rabo de comentário'), 'comentário de fim de linha sobreviveu');
});

// ============================================================
// Guardas contra vacuidade -- rodam ANTES da medida, um por alvo.
// ============================================================
for (const alvo of ALVOS) {
  test(`alcance 3e [${alvo.nome}]: a varredura enxerga a faixa`, () => {
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
      /\b(temClasse|subclasseDe|nivelNa|classesDe|contextosDeClasse|reservasDadosVida|gastarDadosVida|restaurarTodosDadosVida|calcPVMulticlasse|classesComMaestria|trocaTodasNoDescanso)\s*\(/g
    ) || []).length;
    assert.ok(porClasse >= alvo.pisoPorClasse,
      `só ${porClasse} chamadas por classe na faixa de ${alvo.rel} -- esperado ao ` +
      `menos ${alvo.pisoPorClasse}. As conversões do 3e puseram essas chamadas; este ` +
      'número no chão significa que elas foram desfeitas em bloco, ou que a ' +
      'varredura está olhando outro trecho. "Zero espelhos" com zero código não é ' +
      'medida.');
  });

  test(`alcance 3e [${alvo.nome}]: cada exceção declarada casa com exatamente uma linha`, () => {
    const { ocorrencias } = varrer(alvo);
    for (const e of alvo.excecoes) {
      // Dedup por NUMERO DE LINHA, nao por ocorrencia de simbolo: algumas
      // linhas deste sub-projeto (template strings) tem DOIS espelhos na
      // MESMA linha (ex.: char.classe e char.nivel na mesma expressao). O
      // guarda do 3d nunca precisou disso -- contava ocorrencias -- porque
      // nenhuma excecao dele caia nesse caso. Aqui a pergunta certa e "esta
      // LINHA de codigo esta coberta pela excecao", nao "este SIMBOLO
      // aparece uma vez".
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
  test(`alcance 3e [${alvo.nome}]: ${alvo.rel} não lê espelho de classe/subclasse/nível`, () => {
    const { ocorrencias } = varrer(alvo);
    const declaradas = new Set(alvo.excecoes.map((e) => e.linha));
    const sobrando = ocorrencias.filter((o) => !declaradas.has(o.texto));
    assert.deepEqual(sobrando.map((o) => `${alvo.rel}:${o.linha}  ${o.texto}`), [],
      `leitura de ESPELHO em ${alvo.rel} (${alvo.nome}).\n\n` +
      'char.classe e char.subclasse apontam sempre para a classe INICIAL, e ' +
      'char.nivel é o nível TOTAL -- num personagem multiclasse os três estão ' +
      'errados para qualquer característica que não seja da primeira classe. Uma ' +
      'característica calculada sobre eles chega cedo demais para quem ainda não a ' +
      'conquistou, e some para quem conquistou.\n\n' +
      'O conserto é ler pela classe DONA da característica, que é conhecida ali ' +
      'mesmo:\n' +
      "  x.classe === 'C'   ->  temClasse(x, 'C')\n" +
      "  x.subclasse        ->  subclasseDe(x, 'C')\n" +
      "  x.nivel            ->  nivelNa(x, 'C')\n\n" +
      'Se a leitura do nível TOTAL for CERTA (traço de espécie, talento, Bônus de ' +
      'Proficiência/XP do personagem -- livro:2037 e livro:2047), declare-a em ' +
      '`excecoes`, neste arquivo, com o motivo por escrito e a regra do livro ' +
      'citada. Se for uma leitura de MAGIAS fora de escopo (sub-projeto 4), declare ' +
      'também, dizendo qual sub-projeto a pega. Não acrescente exceção sem motivo: ' +
      'é a rede inteira que ela afrouxa.\n\nPontos encontrados:');
  });
}

// ============================================================
// PROPRIEDADE HERDADA DO 3d: o gate de Maestria em Arma do Descanso Longo.
//
// A Tarefa 5 do 3d converteu duas linhas em hp-descanso.js e um teste de
// ANCORA proprio (agora apagado de multiclasse-combate-alcance.test.mjs)
// prendia tres coisas: as duas linhas existirem EXATAMENTE UMA VEZ, e
// `classesComMaestria` vir de `./maestrias.js`. O guarda de ALVOS acima NAO
// prende isso -- ele so proibe ESPELHO, e reescrever estas duas linhas com
// um literal (por exemplo `const classesDeMaestria = ['Guardião', 'Ladino',
// 'Monge', 'Paladino', 'Guerreiro'];`) nao introduz espelho nenhum. Por
// isso as tres asserções do teste de ancora do 3d migram para ca, num teste
// proprio, em vez de sumirem com a promocao de hp-descanso.js a ALVOS.
// ============================================================
test('alcance 3e [herdado do 3d]: o gate de Maestria em Arma do Descanso Longo continua vindo de maestrias.js', () => {
  const { limpas } = lerLinhas('site/js/sheet/hp-descanso.js');

  const linhasEsperadas = [
    'const classesDeMaestria = classesComMaestria(char);',
    'const trocaUma = !trocaTodasNoDescanso(char);',
  ];
  for (const esperada of linhasEsperadas) {
    const convertidas = limpas.filter((l) => l.trim() === esperada);
    assert.equal(convertidas.length, 1,
      `esperada exatamente 1 linha "${esperada}" em hp-descanso.js, achadas ` +
      `${convertidas.length}. Zero significa que o gate do Descanso Longo voltou a ` +
      'decidir Maestria em Arma por outro caminho (por exemplo um literal), e mais ' +
      'de uma significa que a linha foi duplicada -- os dois casos escapam do guarda ' +
      'de ESPELHOS acima, porque nenhum dos dois lê char.classe/subclasse/nivel.');
  }

  const temImport = limpas.some((l) => l.includes('classesComMaestria')
    && l.includes('./maestrias.js'));
  assert.ok(temImport,
    'hp-descanso.js tem de importar classesComMaestria de ./maestrias.js -- a lista ' +
    'das cinco classes com Maestria em Arma mora lá. Uma cópia local dessa lista foi ' +
    'exatamente o defeito que a Tarefa 5 do 3d removeu (o teste de ancora original ' +
    'prendia isso).');
});
