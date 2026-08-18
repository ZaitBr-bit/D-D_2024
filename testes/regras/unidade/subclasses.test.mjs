// ============================================================
// Motor estrutural do domínio Subclasses: as 241 características das 48
// subclasses, transcritas do livro, confrontadas contra as DUAS rotas pelas
// quais o app chega ao mesmo fato -- o arquivo `dados/classes/*.json` lido
// direto do disco, e `levelup.obterCaracteristicasSubclasseNivel()`, que
// passa por `db.getClasse()` em runtime.
//
// O que este motor NÃO confronta, por decisão de escopo (ver o desenho em
// docs/superpowers/specs/2026-08-17-subclasses-design.md): as magias que a
// subclasse concede (Plano 2), as escolhas que ela exige na subida de nível
// (Plano 3) e os recursos que ela cria na ficha (Plano 4). Cavaleiro
// Místico e Trapaceiro Arcano já têm motor próprio para a parte de
// conjuração (unidade/subclasse-conjuradora.test.mjs) -- nada aqui repete
// aquelas asserções.
//
// A citação de cada subclasse (`CITACOES`) é conferida nas duas pontas: o
// texto citado precisa ser um heading real de `Classes.md` E precisa ser o
// heading da própria subclasse -- não só "existe em algum lugar do livro"
// (ver o comentário acima do teste "schema e citação", mais abaixo, para o
// porquê da segunda checagem). A garantia, com precisão: Classes.md tem um
// heading cujo texto é exatamente o nome desta subclasse; `CITACOES` é
// conferida contra o formato canônico ('Classes.md §' + nome da subclasse).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CITACOES, CLASSE_DA_SUBCLASSE, SUBCLASSES_CARACTERISTICAS,
} from '../catalogo/subclasses.mjs';
import { SUBCLASSES, PROGRESSAO } from '../catalogo/classes.mjs';
import { lerClassesDados, lerHeadingsClasses, modulosApp } from './harness.mjs';

const dados = lerClassesDados();
const headings = lerHeadingsClasses();
const CLASSES = Object.keys(SUBCLASSES_CARACTERISTICAS);
// Lista achatada [classe, subclasse, características] -- usada por todos os
// laços abaixo, para nenhum deles recalcular a travessia aninhada.
const TODAS = CLASSES.flatMap((classe) =>
  Object.entries(SUBCLASSES_CARACTERISTICAS[classe])
    .map(([subclasse, caracteristicas]) => ({ classe, subclasse, caracteristicas })));

// Guarda de tamanho: sem ela, o catálogo encolher (uma classe apagada por
// engano num merge) desligaria em silêncio os laços que iteram sobre ele --
// todo teste "para cada subclasse" simplesmente deixaria de existir, e a
// suíte ficaria verde com menos asserções do que ontem.
test('o catálogo cobre 12 classes, 48 subclasses e 241 características', () => {
  assert.equal(CLASSES.length, 12, 'classes no catálogo de subclasses');
  assert.equal(TODAS.length, 48, 'subclasses no catálogo');
  assert.equal(TODAS.flatMap((s) => s.caracteristicas).length, 241,
    'características transcritas');
});

// catalogo/classes.mjs já traz os 48 NOMES de subclasse, e a bijeção deles
// contra dados/classes/*.json já é conferida por unidade/classes.test.mjs.
// Este teste não repete aquela bijeção: ele confere que os DOIS catálogos
// falam dos mesmos 48 nomes, para uma diferença de grafia entre eles não
// virar "subclasse sem características" em silêncio.
for (const classe of CLASSES) {
  test(`os dois catálogos listam as mesmas 4 subclasses: ${classe}`, () => {
    const noCatalogoDeClasses = [...SUBCLASSES[classe]].sort();
    const aqui = Object.keys(SUBCLASSES_CARACTERISTICAS[classe]).sort();
    assert.deepEqual(aqui, noCatalogoDeClasses,
      `${classe}: nomes divergentes entre catalogo/classes.mjs e catalogo/subclasses.mjs`);
    for (const subclasse of aqui) {
      assert.equal(CLASSE_DA_SUBCLASSE[subclasse], classe,
        `${subclasse}: CLASSE_DA_SUBCLASSE aponta para a classe errada`);
    }
  });
}

// Achado Important da revisão independente: `headings.has(titulo)` sozinho só
// prova que ALGUM heading do livro tem aquele texto -- e `lerHeadingsClasses()`
// coleta também os 241 headings `### Nível N: <característica>` aninhados
// dentro das seções de subclasse, então uma citação corrompida apontando para
// o heading de OUTRA subclasse (ou para uma característica) ainda "existe" no
// arquivo e passava despercebida. A segunda asserção fecha essa lacuna: exige
// que o título da citação seja exatamente o nome desta subclasse, não só um
// heading real de Classes.md em algum lugar. O que as duas garantem juntas
// está declarado uma vez só, no cabeçalho deste arquivo -- não é repetido
// aqui de propósito, para não haver duas redações do mesmo limite.
for (const { classe, subclasse, caracteristicas } of TODAS) {
  test(`schema e citação: ${subclasse} (${classe})`, () => {
    assert.match(CITACOES[subclasse] || '', /^Classes\.md §.+/,
      'citação ausente ou fora do formato');
    const titulo = CITACOES[subclasse].replace('Classes.md §', '');
    assert.ok(headings.has(titulo),
      `citação quebrada: "${titulo}" não é heading de Classes.md`);
    assert.equal(titulo, subclasse,
      'a citação aponta para o heading de outra seção do livro');

    assert.ok(caracteristicas.length > 0,
      'subclasse sem nenhuma característica transcrita');

    for (const [i, c] of caracteristicas.entries()) {
      assert.ok(Number.isInteger(c.nivel) && c.nivel >= 1 && c.nivel <= 20,
        `${subclasse}[${i}]: nivel deve ser inteiro de 1 a 20, veio ${c.nivel}`);
      assert.equal(typeof c.nome, 'string', `${subclasse}[${i}]: nome deve ser string`);
      assert.ok(c.nome.trim().length > 0, `${subclasse}[${i}]: nome vazio`);
      // "Nível 3: X" no campo `nome` significa que o heading foi copiado
      // inteiro em vez de só o nome da característica -- erro de
      // transcrição que passaria despercebido na contagem.
      assert.doesNotMatch(c.nome, /^N[íi]vel\s+\d+\s*:/,
        `${subclasse}[${i}]: nome carrega o prefixo "Nível N:" do heading`);
      if (i > 0) {
        assert.ok(c.nivel >= caracteristicas[i - 1].nivel,
          `${subclasse}[${i}]: lista fora de ordem crescente de nível`);
      }
    }
  });
}

// A tabela de cada classe (catalogo/classes.mjs, transcrita do livro na
// rodada anterior) imprime "Subclasse <Classe>" no nível 3 e "Característica
// de Subclasse" nos demais níveis de concessão. Este teste confronta os
// níveis em que as características de subclasse EXISTEM contra os níveis em
// que a tabela diz que elas são concedidas -- duas transcrições
// independentes do mesmo livro, feitas em rodadas diferentes.
//
// A regex é case-insensitive de propósito: a célula do Monge nível 11 grafa
// "Característica de subclasse" com inicial minúscula, diferente das outras
// 47 (conferido no pré-voo). Um regex sensível a caixa produziria uma falha
// que pareceria bug do app e é só grafia do livro.
const ROTULO_CONCESSAO = /^(Subclasse\s+.+|Característica\s+de\s+subclasse)$/i;

for (const classe of CLASSES) {
  test(`níveis de concessão × tabela do livro: ${classe}`, () => {
    const naTabela = PROGRESSAO[classe]
      .filter((linha) => linha.caracteristicas.some((c) => ROTULO_CONCESSAO.test(c)))
      .map((linha) => linha.nivel);
    assert.ok(naTabela.length > 0,
      `${classe}: a tabela não marca nenhum nível de concessão de subclasse`);

    for (const [subclasse, caracteristicas] of Object.entries(SUBCLASSES_CARACTERISTICAS[classe])) {
      const niveis = [...new Set(caracteristicas.map((c) => c.nivel))].sort((a, b) => a - b);
      assert.deepEqual(niveis, naTabela,
        `${subclasse}: níveis com característica divergem dos níveis de concessão da tabela`);
    }
  });
}

// Rota 1: o arquivo de dados lido direto do disco. Compara a lista inteira
// de uma vez (não característica a característica) para a mensagem de falha
// mostrar a lista dos dois lados -- é o que distingue "o app tem uma a mais"
// de "o app tem o nome escrito diferente", e as duas exigem investigação
// diferente.
for (const { classe, subclasse, caracteristicas } of TODAS) {
  test(`características × dados/classes/: ${subclasse} (${classe})`, () => {
    const classeData = dados.get(classe);
    assert.ok(classeData, `dados/classes/ não tem a classe ${classe}`);
    const sc = (classeData.subclasses || []).find((s) => s.nome === subclasse);
    assert.ok(sc, `dados/classes/ não tem a subclasse ${subclasse}`);

    const nosDados = (sc.caracteristicas || []).map((c) => ({ nivel: c.nivel, nome: c.nome }));
    const noLivro = caracteristicas.map((c) => ({ nivel: c.nivel, nome: c.nome }));
    assert.deepEqual(nosDados, noLivro,
      `${subclasse}: características divergentes entre dados/ e o livro`);
  });
}

const { levelup } = await modulosApp();

// Rota 2: a função que o app chama em runtime (site/js/levelup.js:726), que
// passa por db.getClasse() em vez de ler o arquivo. Varre os 20 níveis de
// cada subclasse, INCLUINDO os níveis em que o esperado é lista vazia -- são
// eles que pegam uma característica concedida no nível errado, e são a maior
// parte das 960 verificações (48 × 20).
for (const { classe, subclasse, caracteristicas } of TODAS) {
  test(`obterCaracteristicasSubclasseNivel × livro: ${subclasse} (20 níveis)`, async () => {
    for (let nivel = 1; nivel <= 20; nivel++) {
      const esperado = caracteristicas
        .filter((c) => c.nivel === nivel)
        .map((c) => c.nome);
      const obtido = (await levelup.obterCaracteristicasSubclasseNivel(classe, subclasse, nivel))
        .map((c) => c.nome);
      assert.deepEqual(obtido, esperado, `${subclasse} nv${nivel}`);
    }
  });
}

// Guardas de contrato da mesma função, nos dois casos em que o app a chama
// com entrada incompleta: personagem sem subclasse escolhida (nível 1 e 2 de
// qualquer classe) e subclasse desconhecida (ficha legada com nome antigo).
// Sem estas duas, um `undefined` devolvido no lugar de `[]` só apareceria
// como TypeError na tela.
test('obterCaracteristicasSubclasseNivel devolve [] sem subclasse e para subclasse desconhecida', async () => {
  assert.deepEqual(await levelup.obterCaracteristicasSubclasseNivel('Bárbaro', '', 3), []);
  assert.deepEqual(await levelup.obterCaracteristicasSubclasseNivel('Bárbaro', null, 3), []);
  assert.deepEqual(
    await levelup.obterCaracteristicasSubclasseNivel('Bárbaro', 'Trilha Inexistente', 3), []);
});
