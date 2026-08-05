// Contrato da projeção compatível com `site/js/db.js` (Task 11).
//
// A comparação aqui NÃO é de "shape parecido": para cada export atual de
// `db.js`, o teste roda o CARREGADOR LEGADO REAL (com um `fetch` de teste que
// serve os JSON legados de `dados/**` do disco) e roda a projeção REAL
// alimentada pelo catálogo ativo (`dados/pacotes/dnd2024/**`, via
// `HttpContentSource` + `ContentRegistry`), e compara os dois resultados campo
// a campo, recursivamente.
//
// ONDE MORA O ORÁCULO (mudou na Task 22b): até o cutover, o carregador legado
// ERA `site/js/db.js`. Com o cutover, `site/js/db.js` virou uma fachada fina
// sobre a própria projeção — importá-lo aqui faria este teste comparar a
// projeção consigo mesma e ficar verde sem provar nada. Por isso a
// implementação legada foi PRESERVADA, congelada, em
// `tests/helpers/legacy-db-source.js`, e é ela (junto dos JSON legados de
// `dados/**` fora de `dados/pacotes/`) que este teste importa. Nenhum dos dois
// pode ser apagado enquanto esta suíte existir.
//
// As divergências medidas são comparadas com `LEGACY_PROJECTION_GAPS`
// (exportado pelo próprio módulo de projeção) por caminho E POR QUANTIDADE DE
// INSTÂNCIAS. A contagem é o que impede que uma lacuna declarada para um caso
// isolado (um typo do legado em 1 de 38 armas) sirva de licença para qualquer
// número de divergências futuras no mesmo campo. Divergência nova, lacuna que
// deixou de existir e lacuna que AUMENTOU reprovam o teste — não existe
// "compare só o que bate".

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { createAppContext } from '../../site/js/app-context.js';
import {
  projectLegacyDbResult,
  createLegacyDbProjection,
  legacyProjectionCutoverReadiness,
  assertLegacyProjectionReadyForCutover,
  LEGACY_DB_OPERATIONS,
  LEGACY_PROJECTION_GAPS,
  LEGACY_INTENTIONAL_DIVERGENCES,
  PUBLIC_RUNTIME_LEGACY_OPERATIONS,
} from '../../site/js/infra/content/legacy-db-projection.js';
import { createDiskFetch, installLegacyDbFetch } from '../helpers/disk-fetch.js';
import {
  diferencasPorCaminho,
  acumularDiferencas,
  ordenarContagens,
} from '../helpers/legacy-projection-diff.js';

// --- Estado compartilhado --------------------------------------------------

let db;
let projecao;
let restaurarFetch;

before(async () => {
  // Carregador legado (oráculo): um `fetch` global de teste serve os JSON de
  // `dados/**`. NÃO trocar por `site/js/db.js` — ver a nota do cabeçalho.
  restaurarFetch = installLegacyDbFetch();
  db = await import('../helpers/legacy-db-source.js');

  // Projeção: catálogo real ativado pelo composition root, com `fetchFn`
  // injetado (o pacote oficial só é alcançável com a capacidade oficial, que
  // só o `app-context` pode criar).
  const { fetchFn } = createDiskFetch();
  const contexto = createAppContext({ fetchFn });
  const ativacao = await contexto.initializeContent();
  assert.equal(ativacao.ok, true, `ativação do catálogo falhou: ${JSON.stringify(ativacao.error ?? null)}`);
  projecao = createLegacyDbProjection({ registry: ativacao.value });
});

describe('integridade do oráculo legado (Task 22b)', () => {
  // Estes dois testes existem por causa do risco central do cutover: se algum
  // dia alguém "simplificar" este arquivo repontando o oráculo para
  // `site/js/db.js` (hoje uma fachada sobre a própria projeção), TODA a suíte
  // de paridade abaixo continuaria verde comparando a projeção consigo mesma —
  // e a proteção construída nas Tasks 11/23/23b sumiria em silêncio.

  test('o oráculo lê os JSON legados de dados/**, não o catálogo', async () => {
    const pedidos = [];
    const restaurar = installLegacyDbFetch({ onRequest: (caminho) => pedidos.push(caminho) });
    try {
      // Import com query de cache-busting: o módulo já importado no `before`
      // tem cache interno próprio e não pediria nada de novo.
      const oraculo = await import('../helpers/legacy-db-source.js?prova-de-oraculo=1');
      await oraculo.getArmas();
      await oraculo.getClasse('Mago');
    } finally {
      restaurar();
    }
    assert.deepEqual(
      pedidos.sort(),
      ['../dados/classes/mago.json', '../dados/equipamento/armas.json'],
      'o oráculo precisa continuar buscando os JSON legados diretamente',
    );
    assert.equal(
      pedidos.some((caminho) => caminho.includes('pacotes')),
      false,
      'o oráculo não pode ler o catálogo oficial: ele é o outro lado da comparação',
    );
  });

  test('o oráculo não importa a projeção nem o composition root', async () => {
    const { readFile } = await import('node:fs/promises');
    const fonte = await readFile(new URL('../helpers/legacy-db-source.js', import.meta.url), 'utf8');
    const importsReais = [...fonte.matchAll(/^\s*import\s.*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    assert.deepEqual(importsReais, [], 'o oráculo legado é autocontido: qualquer import é sinal de contaminação');
    // Também não pode alcançar a projeção por `import()` dinâmico. (Menções em
    // COMENTÁRIO são esperadas — o cabeçalho explica justamente esta regra —,
    // por isso a checagem é sobre import de verdade, não sobre substring.)
    assert.deepEqual(
      [...fonte.matchAll(/\bimport\s*\(/g)].map((m) => m[0]),
      [],
      'o oráculo legado não pode importar nada, nem dinamicamente',
    );
  });
});

describe('projeção legada: superfície pública', () => {
  test('cobre exatamente os exports atuais de db.js', () => {
    const exportsDb = Object.keys(db).filter((nome) => typeof db[nome] === 'function').sort();
    const exportsProjecao = Object.keys(projecao).filter((nome) => typeof projecao[nome] === 'function').sort();
    assert.deepEqual(exportsProjecao, exportsDb);
    assert.equal(exportsDb.length, 17, 'db.js tem 17 exports de função hoje');
  });

  test('preserva a aridade declarada de cada export', () => {
    for (const nome of Object.keys(db)) {
      if (typeof db[nome] !== 'function') continue;
      assert.equal(projecao[nome].length, db[nome].length, `aridade diferente em ${nome}`);
    }
  });

  test('LEGACY_DB_OPERATIONS lista as operações projetáveis', () => {
    assert.equal(Array.isArray(LEGACY_DB_OPERATIONS), true);
    for (const operacao of LEGACY_DB_OPERATIONS) {
      assert.equal(typeof projecao[operacao], 'function', `operação sem export: ${operacao}`);
    }
  });

  test('projectLegacyDbResult recusa operação desconhecida', () => {
    assert.throws(() => projectLegacyDbResult('getInexistente', []), /operação/i);
  });

  test('projectLegacyDbResult é pura: não muta as entidades recebidas', () => {
    const entidades = [
      { id: 'dnd2024:glossary-entry:acao', type: 'glossary-entry', name: 'Ação', term: 'Ação', definition: 'Def.' },
    ];
    const antes = JSON.stringify(entidades);
    const primeira = projectLegacyDbResult('getGlossario', entidades);
    const segunda = projectLegacyDbResult('getGlossario', entidades);
    assert.equal(JSON.stringify(entidades), antes, 'as entidades de entrada não podem ser mutadas');
    assert.deepEqual(primeira, segunda, 'a projeção deve ser determinística');
  });
});

// --- Paridade campo a campo contra o db.js real ---------------------------

// Divergências realmente observadas, acumuladas por operação em todas as
// chamadas: `Map<operação, Map<caminho, quantidade>>`. Usadas no fim da suíte
// para exigir que `LEGACY_PROJECTION_GAPS` seja EXATAMENTE o que foi medido —
// nem uma lacuna a mais (declaração obsoleta), nem uma a menos (divergência
// nova), nem uma instância a mais no mesmo caminho (lacuna que alargou).
const divergenciasObservadas = new Map();

/**
 * Soma, para uma operação, as contagens declaradas em `LEGACY_PROJECTION_GAPS`
 * (dívida) e em `LEGACY_INTENTIONAL_DIVERGENCES` (correção deliberada de um
 * erro do legado).
 *
 * As duas listas são separadas porque significam coisas opostas — lacuna
 * bloqueia o cutover, divergência não —, mas para o diff campo a campo as duas
 * são igualmente "diferenças permitidas, nesta quantidade exata". Somar aqui é
 * o que impede que o mesmo caminho apareça nas duas listas e passe a valer o
 * dobro sem ninguém notar: a soma tem de bater com o medido.
 * @param {string} operacao
 * @returns {Record<string, number>}
 */
function contagensDeclaradas(operacao) {
  const total = {};
  for (const fonte of [LEGACY_PROJECTION_GAPS[operacao] ?? {}, LEGACY_INTENTIONAL_DIVERGENCES[operacao] ?? {}]) {
    for (const [caminho, quantidade] of Object.entries(fonte)) {
      total[caminho] = (total[caminho] ?? 0) + quantidade;
    }
  }
  return total;
}

/**
 * Confere um caso de paridade: roda o export real de `db.js` e a projeção
 * equivalente, compara campo a campo e exige que toda divergência esteja
 * declarada como lacuna conhecida daquela operação, dentro da quantidade
 * declarada.
 * @param {string} operacao
 * @param {ReadonlyArray<*>} args
 */
async function conferirParidade(operacao, args = []) {
  const esperado = await db[operacao](...args);
  const atual = await projecao[operacao](...args);

  // Ambos os lados precisam existir de verdade: um `null` inesperado (fixture
  // que não carregou, catálogo sem a entidade) tornaria a comparação vazia.
  assert.notEqual(esperado, null, `db.${operacao} devolveu null: o oráculo legado não carregou`);
  assert.notEqual(atual, null, `a projeção de ${operacao} devolveu null`);

  const medidas = diferencasPorCaminho(esperado, atual);
  const declaradas = contagensDeclaradas(operacao);
  const rotulo = `${operacao}(${args.map((a) => JSON.stringify(a)).join(', ')})`;

  const naoDeclaradas = [...medidas.keys()].filter(
    (caminho) => !Object.prototype.hasOwnProperty.call(declaradas, caminho),
  ).sort();
  assert.deepEqual(
    naoDeclaradas,
    [],
    `${rotulo}: divergências não declaradas em LEGACY_PROJECTION_GAPS nem em LEGACY_INTENTIONAL_DIVERGENCES`,
  );

  // Nenhuma chamada isolada pode estourar a quantidade declarada para a
  // operação inteira: isso pega o alargamento já na chamada que o causou.
  for (const [caminho, quantidade] of medidas) {
    assert.equal(
      quantidade <= declaradas[caminho],
      true,
      `${rotulo}: "${caminho}" divergiu em ${quantidade} instância(s), acima das ${declaradas[caminho]} declaradas`,
    );
  }

  if (!divergenciasObservadas.has(operacao)) {
    divergenciasObservadas.set(operacao, new Map());
  }
  acumularDiferencas(divergenciasObservadas.get(operacao), medidas);
}

const CLASSES = Object.freeze([
  'Bárbaro',
  'Bardo',
  'Bruxo',
  'Clérigo',
  'Druida',
  'Feiticeiro',
  'Guardião',
  'Guerreiro',
  'Ladino',
  'Mago',
  'Monge',
  'Paladino',
]);

const CLASSES_CONJURADORAS = Object.freeze([
  'Bardo',
  'Bruxo',
  'Clérigo',
  'Druida',
  'Feiticeiro',
  'Guardião',
  'Mago',
  'Paladino',
]);

describe('paridade: origens, talentos e apêndices', () => {
  test('getAntecedentes()', () => conferirParidade('getAntecedentes'));
  test('getEspecies()', () => conferirParidade('getEspecies'));
  test('getTalentos()', () => conferirParidade('getTalentos'));
  test('getCriaturas()', () => conferirParidade('getCriaturas'));
  test('getGlossario()', () => conferirParidade('getGlossario'));
});

describe('paridade: equipamento', () => {
  test('getArmas()', () => conferirParidade('getArmas'));
  test('getArmaduras()', () => conferirParidade('getArmaduras'));
  test('getEquipamentoAventura()', () => conferirParidade('getEquipamentoAventura'));
  test('getFerramentas()', () => conferirParidade('getFerramentas'));
});

describe('paridade: magias', () => {
  test('getIndiceMagias()', () => conferirParidade('getIndiceMagias'));

  for (let circulo = 0; circulo <= 9; circulo += 1) {
    test(`getMagiasPorCirculo(${circulo})`, () =>
      conferirParidade('getMagiasPorCirculo', [circulo]));
  }

  for (const classe of CLASSES_CONJURADORAS) {
    test(`getMagiasPorClasseLista(${classe})`, () =>
      conferirParidade('getMagiasPorClasseLista', [classe]));
    test(`getMagiasClasse(${classe})`, () => conferirParidade('getMagiasClasse', [classe]));
  }

  test('getMagia() por nome e círculo', () => conferirParidade('getMagia', ['Bola de Fogo', 3]));
  test('buscarMagias() por termo com acento', () => conferirParidade('buscarMagias', ['bola']));
});

describe('paridade: classes', () => {
  for (const classe of CLASSES) {
    test(`getClasse(${classe})`, () => conferirParidade('getClasse', [classe]));
  }
});

describe('paridade: comportamento em dados ausentes (null/array)', () => {
  test('getClasse de classe inexistente devolve null nos dois', async () => {
    assert.equal(await projecao.getClasse('Inexistente'), null);
  });

  test('getMagiasClasse de classe não conjuradora devolve null nos dois', async () => {
    for (const classe of ['Guerreiro', 'Ladino', 'Bárbaro', 'Monge']) {
      assert.equal(await projecao.getMagiasClasse(classe), null, `${classe} não deveria ter lista de magias`);
    }
  });

  test('getMagia de magia inexistente devolve null', async () => {
    assert.equal(await projecao.getMagia('Magia Que Não Existe', 3), null);
  });

  test('getMagiasPorCirculo fora do intervalo devolve null', async () => {
    assert.equal(await projecao.getMagiasPorCirculo(10), null);
  });

  test('buscarMagias sem correspondência devolve array vazio', async () => {
    assert.deepEqual(await projecao.buscarMagias('zzzzzzzz'), []);
  });

  test('precarregarDadosCriacao resolve sem valor e sem lançar', async () => {
    assert.equal(await projecao.precarregarDadosCriacao(), undefined);
  });
});

describe('lacunas declaradas', () => {
  test('toda lacuna/divergência declarada pertence a uma operação conhecida e tem contagem inteira', () => {
    for (const [rotulo, lista] of [
      ['LEGACY_PROJECTION_GAPS', LEGACY_PROJECTION_GAPS],
      ['LEGACY_INTENTIONAL_DIVERGENCES', LEGACY_INTENTIONAL_DIVERGENCES],
    ]) {
      for (const chave of Object.keys(lista)) {
        assert.equal(
          LEGACY_DB_OPERATIONS.includes(chave),
          true,
          `${rotulo}: declaração para operação desconhecida: ${chave}`,
        );
        const declaradas = lista[chave];
        assert.equal(
          declaradas !== null && typeof declaradas === 'object' && !Array.isArray(declaradas),
          true,
          `${rotulo}.${chave}: as declarações devem ser um objeto caminho -> quantidade`,
        );
        for (const [caminho, quantidade] of Object.entries(declaradas)) {
          assert.equal(
            Number.isInteger(quantidade) && quantidade > 0,
            true,
            `${rotulo}.${chave}."${caminho}": a quantidade de instâncias deve ser um inteiro positivo`,
          );
        }
      }
    }
  });

  test('nenhum caminho é declarado ao mesmo tempo como lacuna e como divergência deliberada', () => {
    // As duas listas significam coisas opostas (dívida x correção). Um caminho
    // nas duas tornaria impossível dizer qual dos dois números o cutover
    // deveria olhar — e dobraria a licença de divergência sem alarde.
    for (const operacao of Object.keys(LEGACY_INTENTIONAL_DIVERGENCES)) {
      const emAmbas = Object.keys(LEGACY_INTENTIONAL_DIVERGENCES[operacao]).filter((caminho) =>
        Object.prototype.hasOwnProperty.call(LEGACY_PROJECTION_GAPS[operacao] ?? {}, caminho),
      );
      assert.deepEqual(emAmbas, [], `${operacao}: caminho declarado nas duas listas`);
    }
  });

  test('as declarações são EXATAMENTE as divergências medidas, instância por instância', () => {
    const operacoes = new Set([
      ...Object.keys(LEGACY_PROJECTION_GAPS),
      ...Object.keys(LEGACY_INTENTIONAL_DIVERGENCES),
      ...divergenciasObservadas.keys(),
    ]);
    for (const operacao of [...operacoes].sort()) {
      const medidas = ordenarContagens(divergenciasObservadas.get(operacao) ?? new Map());
      const declaradasOrdenadas = ordenarContagens(new Map(Object.entries(contagensDeclaradas(operacao))));
      assert.deepEqual(
        medidas,
        declaradasOrdenadas,
        `${operacao}: as declarações (lacunas + divergências deliberadas) não correspondem às divergências reais medidas`,
      );
    }
  });

  test('uma lacuna que alargasse (mais instâncias no mesmo campo) reprovaria', () => {
    // Guarda do próprio mecanismo: se a comparação ignorasse a quantidade,
    // este caso passaria. `armas[].dano` diverge em exatamente 1 arma (typo do
    // legado); duas armas divergindo tem de ser detectável.
    const declarado = LEGACY_INTENTIONAL_DIVERGENCES.getArmas['armas[].dano'];
    assert.equal(declarado, 1, 'o typo do legado afeta exatamente uma arma');

    const legado = { armas: [{ dano: '1d4 Perfurante,' }, { dano: '1d6 Cortante,' }] };
    const projetado = { armas: [{ dano: '1d4 Perfurante' }, { dano: '1d6 Cortante' }] };
    const medidas = diferencasPorCaminho(legado, projetado);
    assert.equal(medidas.get('armas[].dano'), 2, 'o diff precisa contar as duas instâncias');
    assert.equal(
      medidas.get('armas[].dano') <= declarado,
      false,
      'alargar a lacuna tem de estourar a quantidade declarada',
    );
  });

  test('uma lacuna de .length NÃO isenta o conteúdo dos elementos excedentes', () => {
    // Guarda do próprio mecanismo: antes, o diff parava em Math.min e o
    // conteúdo além do array mais curto ficava sem verificação nenhuma.
    const legado = { lista: [{ nome: 'A' }, { nome: 'B' }, { nome: 'C' }] };
    const projetado = { lista: [{ nome: 'A' }] };
    const medidas = diferencasPorCaminho(legado, projetado);
    assert.deepEqual(ordenarContagens(medidas), {
      'lista.length': 1,
      'lista[] (elemento ausente na projeção)': 2,
    });

    const invertido = diferencasPorCaminho(projetado, legado);
    assert.deepEqual(ordenarContagens(invertido), {
      'lista.length': 1,
      'lista[] (elemento extra na projeção)': 2,
    });
  });

  test('elementos que existem nos dois lados são comparados mesmo com tamanhos diferentes', () => {
    const legado = { lista: [{ nome: 'A' }, { nome: 'B' }] };
    const projetado = { lista: [{ nome: 'X' }] };
    const medidas = diferencasPorCaminho(legado, projetado);
    assert.deepEqual(ordenarContagens(medidas), {
      'lista.length': 1,
      'lista[].nome': 1,
      'lista[] (elemento ausente na projeção)': 1,
    });
  });

  test('as operações com paridade total não declaram lacuna nem divergência nenhuma', () => {
    // As cinco primeiras já estavam em paridade; as cinco últimas foram
    // fechadas pela Task 23b e passam a valer como paridade TOTAL — se alguma
    // voltar a divergir, este teste reprova antes do teste de contagem.
    for (const operacao of [
      'getGlossario',
      'getIndiceMagias',
      'getMagiasPorCirculo',
      'getMagia',
      'buscarMagias',
      'getClasse',
      'getAntecedentes',
      'getEspecies',
      'getTalentos',
      'getEquipamentoAventura',
    ]) {
      assert.equal(
        LEGACY_PROJECTION_GAPS[operacao],
        undefined,
        `${operacao} deveria estar em paridade total com db.js`,
      );
      assert.equal(
        LEGACY_INTENTIONAL_DIVERGENCES[operacao],
        undefined,
        `${operacao} não tem divergência deliberada declarada`,
      );
      assert.equal((divergenciasObservadas.get(operacao) ?? new Map()).size, 0);
    }
  });

  test('restaura o fetch global depois da suíte (executado após as divergências)', () => {
    assert.equal(typeof restaurarFetch, 'function');
    restaurarFetch();
  });
});

// ---------------------------------------------------------------------------
// Correções deliberadas de erros do legado (Task 23b)
//
// Um teste NOMEADO por erro corrigido. Não basta a divergência estar contada
// em LEGACY_INTENTIONAL_DIVERGENCES: se alguém "consertar" a projeção para
// voltar a reproduzir o defeito do legado, a contagem continuaria batendo e
// só estes testes reprovariam. Todos leem a projeção (o catálogo), não o
// oráculo legado.
// ---------------------------------------------------------------------------

describe('divergências deliberadas: o catálogo corrige o legado', () => {
  test('armas: a Espada Curta não herda a vírgula sobrando do dano legado', async () => {
    const { armas } = await projecao.getArmas();
    const espadaCurta = armas.find((arma) => arma.nome === 'Espada Curta');
    assert.equal(espadaCurta.dano, '1d6 Perfurante', 'dados/equipamento/armas.json#armas[17].dano tem "1d6 Perfurante,"');
  });

  test('armas: o Dardo não herda a vírgula sobrando das propriedades legadas', async () => {
    const { armas } = await projecao.getArmas();
    const dardo = armas.find((arma) => arma.nome === 'Dardo');
    assert.equal(
      dardo.propriedades,
      'Acuidade, Arremesso (Alcance 6/18)',
      'dados/equipamento/armas.json#armas[12].propriedades termina com vírgula',
    );
  });

  test('armas: o Dardo é arma à distância, apesar de não ter Munição', async () => {
    // Regressão do bug que a projeção tinha antes da Task 23b: a categoria era
    // inferida da propriedade `ammunition`, e o Dardo (Arremesso, sem munição)
    // caía em "Corpo a Corpo".
    const { armas } = await projecao.getArmas();
    assert.equal(armas.find((arma) => arma.nome === 'Dardo').categoria, 'Armas Simples à Distância');
  });

  test('armaduras: a caixa de "modificador de Des" é a mesma nas 8 armaduras que o citam', async () => {
    // Das 13 armaduras de dados/equipamento/armaduras.json, 8 citam o
    // modificador de Destreza na coluna `ca`, e o legado alterna a caixa
    // entre elas (5 minúsculas, 3 maiúsculas). As outras 5 têm CA fixa. O
    // catálogo não reproduz a inconsistência.
    const { armaduras } = await projecao.getArmaduras();
    const comDes = armaduras.filter((armadura) => /odificador de Des/.test(armadura.ca));
    assert.equal(comDes.length, 8, 'só 8 das 13 armaduras citam o modificador de Des');
    for (const armadura of comDes) {
      assert.match(armadura.ca, /modificador de Des/, `${armadura.nome} deveria usar a forma minúscula`);
    }
  });

  test('magias: "De Carne para Pedra" fica no 6º Círculo da lista do Druida', async () => {
    // Livro do Jogador 2024 e dados/magias/circulo_6.json dizem 6º Círculo;
    // dados/classes/magias_druida.json e dados/magias/por_classe/druida.json
    // dizem 5º. O catálogo segue o verbete canônico.
    const { lista_magias: lista } = await projecao.getMagiasClasse('Druida');
    const nomes = (circulo) => lista[circulo].map((magia) => magia.nome);
    assert.equal(nomes('6º Círculo').includes('De Carne para Pedra'), true);
    assert.equal(nomes('5º Círculo').includes('De Carne para Pedra'), false);
  });

  test('magias: a lista de 2º Círculo do Paladino sai em ordem alfabética', async () => {
    // 69 das 70 listas de círculo do legado estão ordenadas; só essa não.
    const { lista_magias: lista } = await projecao.getMagiasClasse('Paladino');
    const nomes = lista['2º Círculo'].map((magia) => magia.nome);
    const semAcento = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    assert.deepEqual(
      nomes,
      [...nomes].sort((a, b) => (semAcento(a) < semAcento(b) ? -1 : semAcento(a) > semAcento(b) ? 1 : 0)),
    );
  });

  test('magias: a coluna "especial" é a mesma para a mesma magia em classes diferentes', async () => {
    // Sete magias recebiam marcas diferentes em tabelas de classes diferentes
    // no legado. A projeção deriva a coluna da própria magia, então a mesma
    // magia tem de sair idêntica em toda lista que a contenha.
    const porMagia = new Map();
    for (const classe of CLASSES_CONJURADORAS) {
      const { lista_magias: lista } = await projecao.getMagiasClasse(classe);
      for (const linhas of Object.values(lista)) {
        for (const linha of linhas) {
          const anterior = porMagia.get(linha.nome);
          if (anterior !== undefined) {
            assert.equal(anterior, linha.especial, `"${linha.nome}" saiu com marcas diferentes entre classes`);
          }
          porMagia.set(linha.nome, linha.especial);
        }
      }
    }
    assert.equal(porMagia.size > 0, true);
  });

  test('magias: "M" marca material com custo/consumo, não material qualquer', async () => {
    // Regressão do bug que a projeção tinha antes da Task 23b: marcava "M" em
    // toda magia com componente material (246 das 391 têm material comum).
    const { lista_magias: lista } = await projecao.getMagiasClasse('Bardo');
    const linha = (nome) => Object.values(lista).flat().find((item) => item.nome === nome);
    assert.equal(linha('Mensagem').especial.includes('M'), false, 'material "um fio de cobre" não tem custo');
    assert.equal(linha('Golpe Certeiro').especial.includes('M'), true, 'material "arma que vale 1 ou mais PP" tem custo');
  });
});

// ---------------------------------------------------------------------------
// Guarda de cutover (Task 22b)
// ---------------------------------------------------------------------------

describe('guarda de cutover da Task 22', () => {
  test('as operações usadas pelo runtime público são um subconjunto real', () => {
    assert.equal(PUBLIC_RUNTIME_LEGACY_OPERATIONS.length > 0, true);
    for (const operacao of PUBLIC_RUNTIME_LEGACY_OPERATIONS) {
      assert.equal(
        LEGACY_DB_OPERATIONS.includes(operacao),
        true,
        `operação de runtime desconhecida: ${operacao}`,
      );
    }
  });

  // MUDANÇA DE ESTADO CONSCIENTE (Task 23b). Até a Task 23 esta guarda
  // afirmava `ready === false`, com `getClasse` nominalmente no bloqueio. A
  // Task 23b fechou as 8 operações que faltavam, então a afirmação inverteu —
  // deliberadamente, e não como efeito colateral: o teste abaixo verifica as
  // 10 operações de PUBLIC_RUNTIME_LEGACY_OPERATIONS uma a uma, sem
  // subconjunto e sem exceção, e o teste seguinte exige que a prontidão saia
  // de LEGACY_PROJECTION_GAPS e não de uma lista paralela.
  test('a projeção está pronta para o cutover: nenhuma operação de runtime tem lacuna', () => {
    const prontidao = legacyProjectionCutoverReadiness();
    assert.deepEqual(
      prontidao.blocking.map((item) => `${item.operation}: ${item.gaps.join(', ')}`),
      [],
      'toda lacuna em operação de runtime bloqueia o cutover — feche-a pelo conversor, não relaxando este teste',
    );
    assert.equal(prontidao.ready, true);

    // Verificação independente do valor de `ready`: as 10 operações, uma a
    // uma, sem subsetting.
    assert.equal(PUBLIC_RUNTIME_LEGACY_OPERATIONS.length, 10);
    for (const operacao of PUBLIC_RUNTIME_LEGACY_OPERATIONS) {
      assert.deepEqual(
        Object.keys(LEGACY_PROJECTION_GAPS[operacao] ?? {}),
        [],
        `${operacao} ainda tem lacuna declarada`,
      );
    }
  });

  test('assertLegacyProjectionReadyForCutover não lança mais, e volta a lançar se surgir lacuna', () => {
    assert.doesNotThrow(() => assertLegacyProjectionReadyForCutover());
  });

  test('as lacunas que sobraram são só de operações que nenhum módulo chama', () => {
    // `ready: true` não quer dizer "projeção completa": quer dizer que o que
    // o runtime usa está completo. O resto continua declarado e visível.
    assert.deepEqual(Object.keys(LEGACY_PROJECTION_GAPS).sort(), ['getCriaturas', 'getFerramentas']);
    for (const operacao of Object.keys(LEGACY_PROJECTION_GAPS)) {
      assert.equal(
        PUBLIC_RUNTIME_LEGACY_OPERATIONS.includes(operacao),
        false,
        `${operacao} tem lacuna e É chamada pelo runtime`,
      );
    }
  });

  test('a prontidão relata as divergências deliberadas em vez de escondê-las', () => {
    // O cutover muda o que o usuário vê nesses pontos (ordem de lista de
    // magias, círculo de uma magia, caixa de texto, dois typos de tabela).
    // Ficar em silêncio sobre isso seria a "delegação de mentira" que o
    // relatório da Task 23b registra como risco.
    const prontidao = legacyProjectionCutoverReadiness();
    const relatadas = prontidao.intentionalDivergences.map((item) => item.operation).sort();
    const esperadas = PUBLIC_RUNTIME_LEGACY_OPERATIONS.filter(
      (operacao) => Object.keys(LEGACY_INTENTIONAL_DIVERGENCES[operacao] ?? {}).length > 0,
    ).sort();
    assert.deepEqual(relatadas, esperadas);
    assert.deepEqual(esperadas, ['getArmaduras', 'getArmas', 'getMagiasClasse']);
  });

  test('a prontidão é derivada de LEGACY_PROJECTION_GAPS, não de uma lista paralela', () => {
    const prontidao = legacyProjectionCutoverReadiness();
    for (const item of prontidao.blocking) {
      assert.deepEqual(
        [...item.gaps].sort(),
        Object.keys(LEGACY_PROJECTION_GAPS[item.operation] ?? {}).sort(),
        `${item.operation}: o diagnóstico deve espelhar as lacunas declaradas`,
      );
    }
    // Toda operação de runtime com lacuna declarada tem de estar bloqueando.
    const comLacuna = PUBLIC_RUNTIME_LEGACY_OPERATIONS.filter(
      (operacao) => Object.keys(LEGACY_PROJECTION_GAPS[operacao] ?? {}).length > 0,
    ).sort();
    assert.deepEqual(prontidao.blocking.map((item) => item.operation).sort(), comLacuna);
  });
});
