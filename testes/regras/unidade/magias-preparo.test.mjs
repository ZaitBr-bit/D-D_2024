// ============================================================
// Domínio Magias, Plano 3: preparo, troca e o limite.
//
// Dois eixos, de naturezas diferentes:
//
//   1. A TABELA DO LIVRO ("Magias Preparadas por Classe", Magias.md:19-28)
//      contra o que o app oferece. O livro fixa, por classe, QUANDO a lista
//      pode mudar e QUANTAS magias; o app despacha por `tipo_conjuracao`
//      (hp-descanso.js:1093-1095), que só tem dois valores e não distingue
//      as duas variáveis.
//
//   2. A COERÊNCIA DO APP CONSIGO MESMO. A regra "magia sempre preparada não
//      conta no limite" (Magias.md:41) é implementada por uma lista de
//      origens isentas, que vivia copiada em DEZ lugares de site/js/. Aqui o
//      oráculo não é o livro: é o próprio app, que não pode responder duas
//      coisas diferentes para a mesma pergunta dependendo da tela.
//      A Correção B (2026-08-19) consolidou as cópias numa fonte só, e este
//      eixo passou a cobrar isso -- ver o cabeçalho dele, mais abaixo.
//
// O que este motor NÃO cobre: ritual, concentração e conjurar em círculo
// superior (Plano 4).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { modulosApp, RAIZ, comLacuna } from './harness.mjs';
import {
  TROCA_POR_CLASSE, DECISAO_PRODUTO, AFASTAMENTOS_DO_LIVRO,
  PAPEIS_LISTA_ORIGEM, EXCECOES_LISTA_ORIGEM,
} from '../catalogo/magias-preparo.mjs';

const { dadosClasses } = await modulosApp();

// ============================================================
// Eixo 1 -- a regra de troca, e o que ela se afasta do livro
// ============================================================
//
// ESTE EIXO MUDOU DE ORÁCULO em 2026-08-19, e a mudança precisa ser lida com
// atenção: o app deixou de seguir a tabela do livro POR DECISÃO do dono do
// produto. A regra passou a ser uniforme -- uma troca no Descanso Longo,
// quantas quiser na subida de nível, para toda classe conjuradora.
//
// Um motor que continuasse cobrando a tabela ficaria vermelho para sempre, e
// alguém acabaria apagando o teste. Um motor que simplesmente parasse de
// cobrar deixaria a divergência invisível. A saída é COBRAR AS DUAS COISAS:
//
//   1. O app faz o que foi DECIDIDO (`DECISAO_PRODUTO`, transcrita à mão no
//      catálogo a partir da decisão -- não lida do app, senão o oráculo
//      mediria a própria saída).
//   2. Toda diferença entre a decisão e o LIVRO está declarada em
//      `AFASTAMENTOS_DO_LIVRO`, com motivo. Um afastamento novo, que ninguém
//      decidiu, fica vermelho.
//
// O que continua fora do alcance deste motor: que `hp-descanso.js` e o
// assistente de nível chamem essas funções e montem a tela certa. Isso é de
// tela, e quem prova são os specs de navegador citados abaixo.

const { trocaNoDescansoLongo, trocaAoAvancarNivel } = await import(
  new URL('../../../site/js/regras-preparo-magias.js', import.meta.url).href);

const LIVRO_POR_CLASSE = new Map(TROCA_POR_CLASSE.map((l) => [l.classe, l]));

test('sanity: a decisão de produto cobre as mesmas 8 classes da tabela do livro', () => {
  assert.deepEqual(
    DECISAO_PRODUTO.map((d) => d.classe).sort(),
    TROCA_POR_CLASSE.map((l) => l.classe).sort(),
    'a decisão e a tabela do livro precisam falar das mesmas classes -- se divergirem, as ' +
    'asserções abaixo passam a comparar coisas diferentes');
});

for (const linha of DECISAO_PRODUTO) {
  test(`troca no Descanso Longo × decisão: ${linha.classe}`, () => {
    assert.equal(trocaNoDescansoLongo(linha.classe), linha.descansoLongo,
      `${linha.classe}: a decisão do produto é trocar "${linha.descansoLongo}" magia(s) no ` +
      `Descanso Longo, e o app oferece "${trocaNoDescansoLongo(linha.classe)}"`);
  });

  test(`troca na subida de nível × decisão: ${linha.classe}`, () => {
    assert.equal(trocaAoAvancarNivel(linha.classe), linha.nivel,
      `${linha.classe}: a decisão do produto é trocar "${linha.nivel}" ao avançar de nível, e o ` +
      `app oferece "${trocaAoAvancarNivel(linha.classe)}"`);
  });
}

test('toda diferença entre a decisão e a tabela do livro está declarada', () => {
  const naoDeclarados = [];
  for (const d of DECISAO_PRODUTO) {
    const L = LIVRO_POR_CLASSE.get(d.classe);
    if (!L) continue;

    // Descanso Longo: o livro dá algo a esta classe nesta ocasião?
    const livroNoDescanso = L.ocasiao === 'descanso-longo' ? L.quantas : null;
    // O vocabulário do livro é 'qualquer'; o do app, 'todas'. Mesma ideia.
    const appNoDescanso = d.descansoLongo;
    if ((livroNoDescanso === 'qualquer' ? 'todas' : livroNoDescanso) !== appNoDescanso
        && !AFASTAMENTOS_DO_LIVRO[`${d.classe}|descanso-longo`]) {
      naoDeclarados.push(`${d.classe}|descanso-longo: livro="${livroNoDescanso}", app="${appNoDescanso}"`);
    }

    const livroNoNivel = L.ocasiao === 'nivel' ? L.quantas : null;
    if ((livroNoNivel === 'qualquer' ? 'todas' : livroNoNivel) !== d.nivel
        && !AFASTAMENTOS_DO_LIVRO[`${d.classe}|nivel`]) {
      naoDeclarados.push(`${d.classe}|nivel: livro="${livroNoNivel}", app="${d.nivel}"`);
    }
  }
  assert.deepEqual(naoDeclarados, [],
    `o app se afasta da tabela do livro (Magias.md:19-28) em pontos que ninguém declarou. ` +
    `Afastamento é decisão quando está escrito, e bug quando não está -- acrescente a entrada ` +
    `em AFASTAMENTOS_DO_LIVRO com o motivo, ou conserte o app: ${naoDeclarados.join(' | ')}`);
});

test('nenhum afastamento declarado está obsoleto', () => {
  const orfaos = [];
  for (const chave of Object.keys(AFASTAMENTOS_DO_LIVRO)) {
    const [classe, eixo] = chave.split('|');
    const L = LIVRO_POR_CLASSE.get(classe);
    const d = DECISAO_PRODUTO.find((x) => x.classe === classe);
    if (!L || !d) { orfaos.push(`${chave}: classe fora das tabelas`); continue; }
    const doLivro = L.ocasiao === eixo ? (L.quantas === 'qualquer' ? 'todas' : L.quantas) : null;
    const doApp = eixo === 'descanso-longo' ? d.descansoLongo : d.nivel;
    if (doLivro === doApp) orfaos.push(`${chave}: app e livro concordam hoje`);
  }
  assert.deepEqual(orfaos, [],
    `afastamento declarado para um ponto em que o app já concorda com o livro -- remova a ` +
    `entrada de AFASTAMENTOS_DO_LIVRO, ou ela vira licença permanente para divergir de novo ` +
    `sem ninguém notar: ${orfaos.join(' | ')}`);
});

test('todo afastamento declarado tem motivo escrito', () => {
  for (const [chave, motivo] of Object.entries(AFASTAMENTOS_DO_LIVRO)) {
    assert.ok(motivo && motivo.length > 60,
      `o afastamento ${chave} não tem motivo escrito. Sem o porquê, ninguém depois consegue ` +
      `distinguir decisão de descuido`);
  }
});

// ============================================================
// Eixo 2 -- a lista de origens isentas tem UMA fonte só
// ============================================================
//
// Este eixo mudou de pergunta em 2026-08-19 (Correção B). Antes, a lista
// vivia copiada em dez lugares e o motor cobrava que as cópias do mesmo PAPEL
// fossem idênticas -- o melhor que dava para cobrar de um desenho em que a
// divergência era possível. A Correção B consolidou tudo em
// `site/js/regras-origens-magia.js`, e a pergunta certa passou a ser outra:
// **ninguém recriou uma cópia?**
//
// A troca importa porque o invariante antigo já não pega o erro que interessa:
// com uma cópia só, "as cópias concordam" passa por vacuidade para sempre.

/**
 * O único lugar onde as listas de origem podem morar, depois da Correção B.
 * Caminho relativo a `site/js/`, como a varredura o devolve.
 */
const MODULO_UNICO_ORIGENS = 'regras-origens-magia.js';

/** Lista todo arquivo .js sob site/js/. */
function listarJs(dir) {
  const saida = [];
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) saida.push(...listarJs(caminho));
    else if (entrada.endsWith('.js')) saida.push(caminho);
  }
  return saida;
}

/**
 * Encontra toda lista literal de origens de magia em site/js/, com arquivo,
 * linha e conteúdo. A varredura é sintática de propósito: uma lista nova
 * escrita em qualquer arquivo entra no confronto sem ninguém precisar
 * lembrar de registrá-la aqui.
 *
 * `espalha` registra os `...outraLista` do literal. Ele existe porque a
 * ausência dele escondeu um bug real: `levelup-flow.js` montava a lista de
 * MAGIA como `['dominio', ...origensEspeciais]`, espalhando a lista de
 * TRUQUE. O extrator só colhia strings entre aspas, via `['dominio']`, e a
 * exceção declarada para aquele ponto o descrevia como "lista de um item só,
 * usada para outra pergunta" -- leitura errada, apoiada na cegueira do
 * instrumento. Era a mesma pergunta, respondida com a lista errada.
 */
function listasDeOrigem() {
  const achadas = [];
  for (const caminho of listarJs(join(RAIZ, 'site', 'js'))) {
    const texto = readFileSync(caminho, 'utf-8');
    const re = /const\s+(\w*[Oo]rigens\w*|ORIGENS\w*)\s*=\s*\[([^\]]*)\]/g;
    let m;
    while ((m = re.exec(texto)) !== null) {
      const nomes = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
      const espalha = [...m[2].matchAll(/\.\.\.(\w+)/g)].map((x) => x[1]);
      if (!nomes.length && !espalha.length) continue;
      achadas.push({
        arquivo: relative(RAIZ, caminho).replace(/\\/g, '/').replace(/^site\/js\//, ''),
        linha: texto.slice(0, m.index).split('\n').length,
        nome: m[1],
        nomes,
        espalha,
      });
    }
  }
  return achadas;
}

const LISTAS = listasDeOrigem();

test('sanity: a varredura encontra as listas de origem em site/js/', () => {
  assert.ok(LISTAS.length >= 3,
    `a varredura achou ${LISTAS.length} listas de origem -- depois da Correção B esperam-se as ` +
    `2 do módulo único mais as declaradas em EXCECOES_LISTA_ORIGEM. Se o regex parou de casar, ` +
    `este motor passa a afirmar sobre quase nada`);
});

test('toda exceção declarada aponta para uma lista que existe', () => {
  const chaves = new Set(LISTAS.map((l) => `${l.arquivo}:${l.linha}`));
  const orfas = Object.keys(EXCECOES_LISTA_ORIGEM).filter((c) => !chaves.has(c));
  assert.deepEqual(orfas, [],
    `exceção declarada para lista que não existe mais -- remova a entrada de ` +
    `EXCECOES_LISTA_ORIGEM: ${orfas.join(', ')}`);
});

for (const [papel, { marcador, descricao }] of Object.entries(PAPEIS_LISTA_ORIGEM)) {
  test(`a lista de ${papel} (${descricao}) tem uma fonte só`, () => {
    const doPapel = LISTAS.filter((l) =>
      l.nomes.includes(marcador) && !EXCECOES_LISTA_ORIGEM[`${l.arquivo}:${l.linha}`]);

    assert.equal(doPapel.length, 1,
      `esperada UMA lista de ${papel} em site/js/, achadas ${doPapel.length}. Se apareceu mais ` +
      `de uma, alguém recriou a cópia que a Correção B eliminou -- e cópia de dado derivado ` +
      `diverge em silêncio, que foi exatamente o bug desta lacuna. Use ` +
      `regras-origens-magia.js. Achadas: ` +
      `${doPapel.map((l) => `${l.arquivo}:${l.linha} (${l.nome})`).join(', ')}`);

    assert.equal(doPapel[0].arquivo, MODULO_UNICO_ORIGENS,
      `a única lista de ${papel} deveria morar em ${MODULO_UNICO_ORIGENS}, e está em ` +
      `${doPapel[0].arquivo}:${doPapel[0].linha}`);
  });
}

test('nenhuma lista de origem é montada espalhando outra', () => {
  const espalhando = LISTAS
    .filter((l) => l.espalha.length)
    .map((l) => `${l.arquivo}:${l.linha} (${l.nome}) espalha ${l.espalha.join(', ')}`);
  assert.deepEqual(espalhando, [],
    `lista de origem montada com \`...outraLista\`. As listas de MAGIA e de TRUQUE diferem de ` +
    `propósito (truque de espécie tem origem \`especie\`, magia de domínio tem \`dominio\`), ` +
    `então derivar uma da outra carrega origens que não valem e perde as que valem -- foi ` +
    `assim que levelup-flow.js passou a oferecer troca de magia que o livro diz ser sempre ` +
    `preparada: ${espalhando.join(' | ')}`);
});

// ============================================================
// Toda origem escrita pelo app está classificada
// ============================================================
//
// Uma origem nova que ninguém classificou entra silenciosamente como magia
// comum e passa a consumir vaga do limite -- sem erro, sem aviso.

test('toda origem que o app escreve aparece em alguma lista de origem', () => {
  const escritas = new Set();
  for (const caminho of listarJs(join(RAIZ, 'site', 'js'))) {
    const texto = readFileSync(caminho, 'utf-8');
    for (const m of texto.matchAll(/origem:\s*'([a-z_]+)'/g)) escritas.add(m[1]);
  }
  const classificadas = new Set(LISTAS.flatMap((l) => l.nomes));
  // `manual` é a origem de uma magia que o jogador acrescentou à mão: ela
  // CONTA no limite de propósito, e por isso não está em lista de isentas.
  //
  // `invocacao_grandes_antigos` não é origem de MAGIA: é de TALENTO, gravada
  // em `char.talentos` (sheet/talentos.js:294,304). A varredura acima procura
  // `origem: '...'` em todo o site/js/ e não distingue a coleção de destino --
  // foi um falso positivo deste teste, não uma origem de magia esquecida.
  const foraDoLimiteDeMagias = new Set(['manual', 'invocacao_grandes_antigos']);
  const semClassificacao = [...escritas]
    .filter((o) => !classificadas.has(o) && !foraDoLimiteDeMagias.has(o));
  assert.deepEqual(semClassificacao, [],
    `origem de magia que o app escreve e nenhuma lista classifica -- ela vai contar no limite ` +
    `de preparadas por omissão, não por decisão: ${semClassificacao.join(', ')}`);
});
