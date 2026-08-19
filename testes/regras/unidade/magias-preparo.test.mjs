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
//      origens isentas -- copiada em DEZ lugares de site/js/. Aqui o oráculo
//      não é o livro: é o próprio app, que não pode responder duas coisas
//      diferentes para a mesma pergunta dependendo da tela.
//
// O que este motor NÃO cobre: ritual, concentração e conjurar em círculo
// superior (Plano 4).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { modulosApp, RAIZ, comLacuna } from './harness.mjs';
import { TROCA_POR_CLASSE, PAPEIS_LISTA_ORIGEM, EXCECOES_LISTA_ORIGEM } from '../catalogo/magias-preparo.mjs';

const { dadosClasses } = await modulosApp();

// ============================================================
// Eixo 1 -- a tabela do livro
// ============================================================
//
// As duas expressões abaixo são as MESMAS de hp-descanso.js:1093-1095, com
// `ehSubConj` falso (personagem sem subclasse conjuradora). Copiadas em vez
// de importadas porque vivem dentro de um handler de botão, inalcançável sem
// navegador -- e o que se afirma aqui é a REGRA que elas codificam.

const trocaOferecidaNoDescanso = (classe) => {
  const info = dadosClasses.CLASSES_INFO[classe];
  if (!info?.conjurador) return null;
  if (info.tipo_conjuracao === 'preparadas') return 'qualquer';
  if (info.tipo_conjuracao === 'conhecidas') return 'uma';
  return null;
};

// Causas registradas em lacunas-conhecidas.mjs.
const CAUSA_OCASIAO = new Set(['Bardo', 'Bruxo', 'Feiticeiro']);
const CAUSA_QUANTIDADE = new Set(['Guardião', 'Paladino']);

for (const linha of TROCA_POR_CLASSE) {
  test(`ocasião de troca × livro: ${linha.classe}`, async () => {
    const corpo = () => {
      const noDescanso = trocaOferecidaNoDescanso(linha.classe);
      const livroPermiteNoDescanso = linha.ocasiao === 'descanso-longo';
      assert.equal(noDescanso !== null, livroPermiteNoDescanso,
        `${linha.classe} (${linha.livro}): o livro manda alterar a lista ao ` +
        `${linha.ocasiao === 'nivel' ? 'AVANÇAR UM NÍVEL' : 'terminar um Descanso Longo'}, e o app ` +
        `${noDescanso !== null ? 'oferece' : 'não oferece'} a troca no Descanso Longo ` +
        `(tipo_conjuracao: "${dadosClasses.CLASSES_INFO[linha.classe]?.tipo_conjuracao}")`);
    };
    if (CAUSA_OCASIAO.has(linha.classe)) {
      await comLacuna('Bardo', 'magias-troca-ocasiao', corpo);
    } else corpo();
  });

  test(`quantidade de troca × livro: ${linha.classe}`, async () => {
    const corpo = () => {
      const noDescanso = trocaOferecidaNoDescanso(linha.classe);
      // Só faz sentido perguntar "quantas" onde o livro permite a troca.
      if (linha.ocasiao !== 'descanso-longo') return;
      assert.equal(noDescanso, linha.quantas,
        `${linha.classe} (${linha.livro}): o livro permite trocar ` +
        `"${linha.quantas === 'uma' ? 'Uma' : 'Qualquer uma'}" e o app oferece ` +
        `"${noDescanso === 'uma' ? 'Uma' : 'Qualquer uma'}" no Descanso Longo`);
    };
    if (CAUSA_QUANTIDADE.has(linha.classe)) {
      await comLacuna('Guardião', 'magias-troca-quantidade', corpo);
    } else corpo();
  });
}

// ============================================================
// Eixo 2 -- as dez cópias da lista de origens isentas
// ============================================================

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
 */
function listasDeOrigem() {
  const achadas = [];
  for (const caminho of listarJs(join(RAIZ, 'site', 'js'))) {
    const texto = readFileSync(caminho, 'utf-8');
    const re = /const\s+(\w*[Oo]rigens\w*|ORIGENS\w*)\s*=\s*\[([^\]]*)\]/g;
    let m;
    while ((m = re.exec(texto)) !== null) {
      const nomes = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
      if (!nomes.length) continue;
      achadas.push({
        arquivo: relative(RAIZ, caminho).replace(/\\/g, '/').replace(/^site\/js\//, ''),
        linha: texto.slice(0, m.index).split('\n').length,
        nome: m[1],
        nomes,
      });
    }
  }
  return achadas;
}

const LISTAS = listasDeOrigem();

test('sanity: a varredura encontra as listas de origem em site/js/', () => {
  assert.ok(LISTAS.length >= 8,
    `a varredura achou ${LISTAS.length} listas de origem -- o pré-voo mediu 10. Se o regex ` +
    `parou de casar, este motor passa a afirmar sobre quase nada`);
});

test('toda exceção declarada aponta para uma lista que existe', () => {
  const chaves = new Set(LISTAS.map((l) => `${l.arquivo}:${l.linha}`));
  const orfas = Object.keys(EXCECOES_LISTA_ORIGEM).filter((c) => !chaves.has(c));
  assert.deepEqual(orfas, [],
    `exceção declarada para lista que não existe mais -- remova a entrada de ` +
    `EXCECOES_LISTA_ORIGEM: ${orfas.join(', ')}`);
});

for (const [papel, { marcador, descricao }] of Object.entries(PAPEIS_LISTA_ORIGEM)) {
  test(`as cópias da lista de ${papel} (${descricao}) concordam entre si`, async () => {
    const doPapel = LISTAS.filter((l) =>
      l.nomes.includes(marcador) && !EXCECOES_LISTA_ORIGEM[`${l.arquivo}:${l.linha}`]);
    assert.ok(doPapel.length >= 2,
      `esperadas ao menos 2 cópias da lista de ${papel} para comparar, achadas ${doPapel.length}`);

    const corpo = () => {
      const referencia = [...doPapel[0].nomes].sort();
      const divergentes = doPapel
        .filter((l) => JSON.stringify([...l.nomes].sort()) !== JSON.stringify(referencia))
        .map((l) => `${l.arquivo}:${l.linha} (${l.nome}) = [${[...l.nomes].sort().join(', ')}]`);
      assert.deepEqual(divergentes, [],
        `as cópias da lista de ${papel} divergiram. Referência ` +
        `${doPapel[0].arquivo}:${doPapel[0].linha} = [${referencia.join(', ')}]. ` +
        `Divergentes: ${divergentes.join(' | ')}`);
    };
    await comLacuna('Mago', 'magias-origens-isentas', corpo);
  });
}

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
