// ============================================================
// COMPARAÇÃO-SOMBRA do cutover de `db.js` (Task 22b).
//
// Este spec é a condição de liberação do cutover. Ele existe por causa da nota
// de risco registrada entre as Tasks 12 e 21 do plano: até aqui, a projeção só
// foi comparada com o legado em Node, contra os JSON do disco. Divergências de
// DEFAULT (um `null` que vira `[]`, um campo ausente que vira `""`, uma ordem
// diferente) e divergências que só aparecem no caminho HTTP real ficariam
// invisíveis. Aqui a comparação acontece no navegador, no app de verdade.
//
// ## As três camadas de verificação
//
//  1. SOMBRA SOBRE OS FLUXOS REAIS (tests "sombra: ..."). Com o modo sombra
//     instalado (ver tests/e2e/helpers/legacy-shadow.js), o app carrega a
//     fachada nova E o carregador legado congelado e compara os dois a cada
//     chamada que o próprio app faz. Cobre um fluxo COMPLETO de criação de
//     personagem para CADA UMA DAS 12 CLASSES (não uma amostra) e, na
//     sequência, a abertura da ficha recém-criada — os dois fluxos que o brief
//     exige.
//
//  2. VARREDURA EXAUSTIVA NO NAVEGADOR (test "varredura"). Os fluxos de UI só
//     chamam o que a UI precisa; esta camada chama TODAS as 17 operações, com
//     o mesmo conjunto de argumentos de `legacy-db-projection.test.js` (12
//     classes, 10 círculos, 8 classes conjuradoras), e exige que as contagens
//     acumuladas batam EXATAMENTE com o declarado. É a mesma severidade do
//     teste de contrato, executada pelo caminho HTTP do navegador.
//
//  3. PUREZA DE REDE (test "requisições"). Sem modo sombra, roda criação e
//     ficha e afirma que NENHUM JSON legado de `dados/**` é requisitado — só
//     `dados/pacotes/dnd2024/**`.
//
// ## O que NÃO reprova
//
// As divergências declaradas em `LEGACY_INTENTIONAL_DIVERGENCES` (cinco
// famílias de erro do legado que o catálogo corrige) e em
// `LEGACY_PROJECTION_GAPS`. Qualquer outra divergência reprova, e a instrução
// da task é explícita: bloquear o cutover, nunca afrouxar este spec.
//
// ## Nota de escopo de projeto
//
// Sem tag `@critical`: roda só em `chromium-desktop` (os projetos mobile,
// Firefox e WebKit filtram por `@critical`). É deliberado — é um spec caro,
// de oráculo, não um smoke cross-browser.
// ============================================================
import { test, expect } from '@playwright/test';
import { resetApp, goCreator, goFicha, fichaIdFromUrl } from './helpers/app.js';
import { readCharacters } from './helpers/storage.js';
import {
  primeiroContentId,
  selecionarClasse,
  selecionarEspecie,
  selecionarAntecedente,
  escolherAtributosConjuntoPadrao,
  escolherEquipamentoPadrao,
  escolherMagiasSuficientes,
  preencherDetalhes,
  proximoPasso,
  finalizarCriacao,
} from './helpers/creator.js';
import { installShadowMode, lerRegistroSombra } from './helpers/legacy-shadow.js';
import {
  LEGACY_DB_OPERATIONS,
  LEGACY_PROJECTION_GAPS,
  LEGACY_INTENTIONAL_DIVERGENCES,
  PUBLIC_RUNTIME_LEGACY_OPERATIONS,
} from '../../site/js/infra/content/legacy-db-projection.js';

// Este arquivo roda em UM worker, em ordem, em vez de espalhar seus 15 testes
// pelos workers paralelos (`fullyParallel: true` no config). Motivo concreto:
// em modo sombra cada operação busca DUAS vezes os dados (catálogo + JSON
// legado), e o servidor estático de dev é single-process — com dois testes
// deste arquivo disputando-o ao mesmo tempo, a transição de passo do criador
// passava do orçamento de 15s do helper `proximoPasso` e reprovava por
// contenção, não por divergência. `retries: 0` é política do projeto (ver
// playwright.config.js): a resposta certa é remover a corrida, não mascará-la
// com retry. `default` (e não `serial`) de propósito: uma classe que reprove
// não pode impedir as outras 11 de serem medidas.
test.describe.configure({ mode: 'default' });

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

// Task 28b: o criador passou a selecionar entidades por ContentId (o DOM novo
// não carrega mais o nome de exibição como chave). O mapa é EXPLÍCITO em vez
// de derivado por slug: derivar seria uma regra a mais para manter, e este
// spec já é o lugar onde os dois vocabulários — o legado (nome) e o do
// catálogo (id) — se encontram.
const CLASSE_CONTENT_ID = Object.freeze({
  'Bárbaro': 'dnd2024:class:barbaro',
  'Bardo': 'dnd2024:class:bardo',
  'Bruxo': 'dnd2024:class:bruxo',
  'Clérigo': 'dnd2024:class:clerigo',
  'Druida': 'dnd2024:class:druida',
  'Feiticeiro': 'dnd2024:class:feiticeiro',
  'Guardião': 'dnd2024:class:guardiao',
  'Guerreiro': 'dnd2024:class:guerreiro',
  'Ladino': 'dnd2024:class:ladino',
  'Mago': 'dnd2024:class:mago',
  'Monge': 'dnd2024:class:monge',
  'Paladino': 'dnd2024:class:paladino',
});

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

// --- Declarações permitidas ------------------------------------------------

/**
 * Soma, por operação, as contagens de `LEGACY_PROJECTION_GAPS` (dívida) e
 * `LEGACY_INTENTIONAL_DIVERGENCES` (correção deliberada). Mesma regra do teste
 * de contrato: significados opostos, mas para o diff as duas são "diferenças
 * permitidas, nesta quantidade exata".
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
 * Caminhos-base permitidos para uma operação: a chave declarada sem o sufixo
 * de diagnóstico (` (elemento ausente...)`, ` (extra na projeção)`) e sem o
 * `.length` final. Usado SOMENTE na comparação de sentinelas vazias, que é
 * uma medida secundária — a medida primária (diff campo a campo) continua
 * exigindo o caminho exato E a quantidade exata.
 * @param {string} operacao
 * @returns {string[]}
 */
function basesDeclaradas(operacao) {
  return Object.keys(contagensDeclaradas(operacao)).map((caminho) =>
    caminho.replace(/\s+\(.*\)$/, '').replace(/\.length$/, ''),
  );
}

/**
 * Diz se um caminho de sentinela está coberto por alguma declaração da
 * operação (igual à base declarada ou dentro dela).
 * @param {string} operacao
 * @param {string} caminho
 * @returns {boolean}
 */
function sentinelaDeclarada(operacao, caminho) {
  return basesDeclaradas(operacao).some((base) => caminho === base || caminho.startsWith(`${base}.`));
}

/**
 * Confere UMA chamada registrada pelo modo sombra.
 * @param {object} chamada
 */
function conferirChamadaSombra(chamada) {
  const rotulo = `${chamada.operacao}(${chamada.args.join(', ')})`;
  const declaradas = contagensDeclaradas(chamada.operacao);

  // Um `null` de um lado só e não do outro esconderia a comparação inteira.
  expect(chamada.esperadoNulo, `${rotulo}: o oráculo legado devolveu null e a fachada não`).toBe(
    chamada.atualNulo,
  );

  const naoDeclaradas = Object.keys(chamada.diff)
    .filter((caminho) => !Object.prototype.hasOwnProperty.call(declaradas, caminho))
    .sort();
  expect(
    naoDeclaradas,
    `${rotulo}: divergência NÃO declarada entre o legado e a projeção. Isto bloqueia o cutover — ` +
      'corrija o catálogo pelo conversor correspondente, nunca afrouxando este spec.',
  ).toEqual([]);

  for (const [caminho, quantidade] of Object.entries(chamada.diff)) {
    expect(
      quantidade,
      `${rotulo}: "${caminho}" divergiu em ${quantidade} instância(s), acima das declaradas`,
    ).toBeLessThanOrEqual(declaradas[caminho]);
  }

  // Camada explícita de `null` x `undefined` x `[]` x `""` x `{}`.
  const legado = chamada.sentinelasLegado;
  const projecao = chamada.sentinelasProjecao;
  const caminhos = [...new Set([...Object.keys(legado), ...Object.keys(projecao)])].sort();
  const divergentes = caminhos.filter((caminho) => {
    const a = (legado[caminho] ?? []).join('|');
    const b = (projecao[caminho] ?? []).join('|');
    return a !== b && !sentinelaDeclarada(chamada.operacao, caminho);
  });
  expect(
    divergentes.map((caminho) => `${caminho}: legado=${legado[caminho] ?? '(ausente)'} projeção=${projecao[caminho] ?? '(ausente)'}`),
    `${rotulo}: default vazio diferente entre o legado e a projeção`,
  ).toEqual([]);
}

// `conferirRegistroSombra` (que exigia "o fluxo chamou pelo menos estas
// operações") foi REMOVIDO na Task 33: com a criação (Task 28b) e a ficha
// (Task 33) migradas, nenhum fluxo de usuário chama mais a fachada `db.js`, e
// a única forma de satisfazer aquela exigência seria um fluxo que voltasse ao
// legado. A guarda contra "sombra que não observou nada" — o modo de falha
// mais perigoso deste spec — NÃO foi perdida: ela vive na camada 2, que chama
// as 17 operações DIRETAMENTE e falha se o registro vier vazio.

// --- Camada 1: sombra sobre os fluxos reais --------------------------------

/**
 * Percorre o assistente inteiro para a classe informada e finaliza,
 * devolvendo o id do personagem criado.
 * @param {import('@playwright/test').Page} page
 * @param {string} classe
 * @returns {Promise<string>}
 */
async function criarPersonagemCompleto(page, classe) {
  await goCreator(page);

  await selecionarClasse(page, CLASSE_CONTENT_ID[classe]);
  await proximoPasso(page);

  const especie = await primeiroContentId(page, 'grid-especies');
  await selecionarEspecie(page, especie);
  await proximoPasso(page);

  const antecedente = await primeiroContentId(page, 'grid-antecedentes');
  await selecionarAntecedente(page, antecedente);
  await proximoPasso(page);

  await escolherAtributosConjuntoPadrao(page);
  await proximoPasso(page);

  await escolherEquipamentoPadrao(page);
  await proximoPasso(page);

  await escolherMagiasSuficientes(page);
  await proximoPasso(page);

  await preencherDetalhes(page, { nome: `Sombra ${classe}` });

  // O registro é lido AQUI, antes de finalizar: finalizar navega para a
  // ficha, e a ficha (ainda legada) consulta `db.js` na hora. Ler depois
  // misturaria as chamadas dos dois fluxos e mediria a ficha achando que
  // estava medindo o criador.
  const registroDoCriador = await lerRegistroSombra(page);
  await finalizarCriacao(page);

  const id = fichaIdFromUrl(page.url());
  expect(id, `a criação de ${classe} não navegou para a ficha`).toBeTruthy();
  return { id, registroDoCriador };
}

test.describe('Modo sombra: fachada db.js x carregador legado', () => {
  for (const classe of CLASSES) {
    test(`sombra: criação completa e abertura de ficha — ${classe}`, async ({ page }) => {
      // Fluxo completo de criação + reabertura de ficha, com o oráculo legado
      // buscado em paralelo a cada chamada: bem mais lento que um spec comum.
      test.setTimeout(180_000);

      await installShadowMode(page);
      await resetApp(page, { characters: [] });

      const { id, registroDoCriador } = await criarPersonagemCompleto(page, classe);

      const lista = await readCharacters(page);
      expect(lista).toHaveLength(1);
      expect(lista[0].classe).toBe(classe);

      // FLUXO 1 conferido AQUI, antes do reload. `window.__LEGACY_SHADOW__`
      // vive no documento: recarregar a página zera o registro. Ler só no fim
      // deixaria o fluxo de criação inteiro sem verificação nenhuma — foi
      // exatamente esse o defeito encontrado na primeira execução deste spec.
      const registroCriacao = registroDoCriador;
      // ATUALIZADO NA TASK 28b (cutover do criador).
      //
      // Antes, a criação era um dos dois fluxos que exercitavam a fachada
      // `db.js`, e este ponto exigia `getClasse`. O criador novo NÃO consulta
      // `db.js`: ele lê o `ContentRegistry` direto (é exatamente o fim de
      // linha que `app-context.js` antecipa — "a fachada só existe enquanto
      // levelup/criador/ficha não forem reescritos"). Continuar exigindo
      // `getClasse` aqui só poderia ser satisfeito por um criador que voltasse
      // a passar pelo legado.
      //
      // Então a exigência VIRA o seu oposto, e continua sendo uma afirmação
      // forte: a criação não pode tocar a fachada legada — e, se tocar,
      // qualquer chamada observada ainda tem de bater com o oráculo (a
      // conferência abaixo não é dispensada).
      expect(registroCriacao.erros, 'o oráculo legado falhou durante a criação').toEqual([]);
      for (const chamada of registroCriacao.chamadas) {
        conferirChamadaSombra(chamada);
      }
      expect(
        registroCriacao.chamadas.map((c) => c.operacao),
        'o criador novo não deve consultar a fachada legada db.js',
      ).toEqual([]);

      // FLUXO 2 exigido pelo brief: abertura de uma ficha JÁ EXISTENTE, num
      // documento novo (reload), para que a ficha carregue do zero em vez de
      // reaproveitar o estado deixado pelo criador. O modo sombra sobrevive ao
      // reload porque a rota do Playwright continua instalada; o REGISTRO, não
      // — daí a segunda leitura, que cobre só o fluxo da ficha.
      await page.reload();
      await goFicha(page, id);

      // ATUALIZADO NA TASK 33 (cutover da ficha), pelo MESMO motivo e com a
      // MESMA forma da atualização que a Task 28b fez logo acima para a
      // criação.
      //
      // Até aqui a ficha era o último fluxo que exercitava a fachada `db.js`, e
      // este ponto exigia `getClasse`. A ficha nova não consulta `db.js`: ela
      // projeta o `SheetViewModel` a partir do personagem canônico e do
      // `ContentRegistry`. Continuar exigindo `getClasse` só poderia ser
      // satisfeito por uma ficha que voltasse ao legado.
      //
      // A exigência VIRA o oposto, e continua forte: a abertura da ficha não
      // pode tocar a fachada legada — e, se tocar, qualquer chamada observada
      // ainda tem de bater com o oráculo (a conferência não é dispensada).
      //
      // CONSEQUÊNCIA REGISTRADA: com criação E ficha migradas, nenhum fluxo de
      // usuário exercita mais a fachada `db.js` em modo sombra. A camada 2
      // abaixo (varredura exaustiva das 17 operações, chamadas DIRETAMENTE) é
      // o que continua provando a paridade da projeção — e é por isso que ela
      // existe separada desta.
      const registroFicha = await lerRegistroSombra(page);
      expect(registroFicha.erros, 'o oráculo legado falhou durante a abertura da ficha').toEqual([]);
      for (const chamada of registroFicha.chamadas) {
        conferirChamadaSombra(chamada);
      }
      expect(
        registroFicha.chamadas.map((c) => c.operacao),
        'a ficha nova não deve consultar a fachada legada db.js',
      ).toEqual([]);
    });
  }
});

// --- Camada 2: varredura exaustiva no navegador ---------------------------

test.describe('Modo sombra: varredura exaustiva das 17 operações', () => {
  test('varredura: toda operação, no navegador, com contagens exatas', async ({ page }) => {
    test.setTimeout(240_000);

    await resetApp(page, { characters: [] });

    const relatorio = await page.evaluate(
      async ({ classes, conjuradoras }) => {
        const [fachada, oraculo, diff] = await Promise.all([
          import('/site/js/db.js'),
          import('/tests/helpers/legacy-db-source.js'),
          import('/tests/helpers/legacy-projection-diff.js'),
        ]);

        /** Chamadas espelhando exatamente as de tests/contract/legacy-db-projection.test.js. */
        const casos = [
          ['getAntecedentes', []],
          ['getEspecies', []],
          ['getTalentos', []],
          ['getCriaturas', []],
          ['getGlossario', []],
          ['getArmas', []],
          ['getArmaduras', []],
          ['getEquipamentoAventura', []],
          ['getFerramentas', []],
          ['getIndiceMagias', []],
          ...Array.from({ length: 10 }, (_, circulo) => ['getMagiasPorCirculo', [circulo]]),
          ...conjuradoras.flatMap((classe) => [
            ['getMagiasPorClasseLista', [classe]],
            ['getMagiasClasse', [classe]],
          ]),
          ['getMagia', ['Bola de Fogo', 3]],
          ['buscarMagias', ['bola']],
          ...classes.map((classe) => ['getClasse', [classe]]),
        ];

        const acumulado = {};
        const nulos = [];
        const sentinelas = [];
        for (const [operacao, args] of casos) {
          const esperado = await oraculo[operacao](...args);
          const atual = await fachada[operacao](...args);
          if (esperado === null || atual === null) {
            nulos.push({ operacao, args, esperadoNulo: esperado === null, atualNulo: atual === null });
            continue;
          }
          const medidas = diff.ordenarContagens(diff.diferencasPorCaminho(esperado, atual));
          const alvo = acumulado[operacao] ?? (acumulado[operacao] = {});
          for (const [caminho, quantidade] of Object.entries(medidas)) {
            alvo[caminho] = (alvo[caminho] ?? 0) + quantidade;
          }
          sentinelas.push({
            operacao,
            args,
            legado: diff.coletarSentinelas(esperado),
            projecao: diff.coletarSentinelas(atual),
          });
        }

        // Comportamento em dados ausentes, dos dois lados.
        const ausentes = {
          classeInexistenteLegado: await oraculo.getClasse('Inexistente'),
          classeInexistenteFachada: await fachada.getClasse('Inexistente'),
          naoConjuradorLegado: await oraculo.getMagiasClasse('Guerreiro'),
          naoConjuradorFachada: await fachada.getMagiasClasse('Guerreiro'),
          magiaInexistenteLegado: await oraculo.getMagia('Magia Que Não Existe', 3),
          magiaInexistenteFachada: await fachada.getMagia('Magia Que Não Existe', 3),
          circuloForaLegado: await oraculo.getMagiasPorCirculo(10),
          circuloForaFachada: await fachada.getMagiasPorCirculo(10),
          buscaVaziaLegado: await oraculo.buscarMagias('zzzzzzzz'),
          buscaVaziaFachada: await fachada.buscarMagias('zzzzzzzz'),
          precarregarLegado: await oraculo.precarregarDadosCriacao(),
          precarregarFachada: await fachada.precarregarDadosCriacao(),
        };

        return {
          acumulado,
          nulos,
          sentinelas,
          exportsFachada: Object.keys(fachada).filter((n) => typeof fachada[n] === 'function').sort(),
          exportsOraculo: Object.keys(oraculo).filter((n) => typeof oraculo[n] === 'function').sort(),
          ausentes: JSON.parse(
            JSON.stringify(ausentes, (chave, valor) => (valor === undefined ? '__undefined__' : valor)),
          ),
        };
      },
      { classes: CLASSES, conjuradoras: CLASSES_CONJURADORAS },
    );

    // A fachada preserva a superfície pública inteira do legado.
    expect(relatorio.exportsFachada).toEqual(relatorio.exportsOraculo);
    expect(relatorio.exportsFachada).toHaveLength(17);
    expect(relatorio.exportsFachada).toEqual([...LEGACY_DB_OPERATIONS].sort());

    // Nenhuma das chamadas do inventário pode devolver null de um lado só —
    // e, no caso deste inventário, de nenhum dos lados.
    expect(relatorio.nulos, 'operação devolveu null onde os dois lados deveriam ter dados').toEqual([]);

    // Contagens acumuladas EXATAMENTE iguais às declaradas, por operação.
    const operacoes = [
      ...new Set([
        ...Object.keys(LEGACY_PROJECTION_GAPS),
        ...Object.keys(LEGACY_INTENTIONAL_DIVERGENCES),
        ...Object.keys(relatorio.acumulado),
      ]),
    ].sort();
    for (const operacao of operacoes) {
      const medido = Object.fromEntries(
        Object.entries(relatorio.acumulado[operacao] ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)),
      );
      const declarado = Object.fromEntries(
        Object.entries(contagensDeclaradas(operacao)).sort(([a], [b]) => (a < b ? -1 : 1)),
      );
      expect(
        medido,
        `${operacao}: o que o NAVEGADOR mediu não é o que está declarado em ` +
          'LEGACY_PROJECTION_GAPS + LEGACY_INTENTIONAL_DIVERGENCES',
      ).toEqual(declarado);
    }

    // Camada explícita de sentinelas vazias, por chamada.
    for (const registro of relatorio.sentinelas) {
      const caminhos = [
        ...new Set([...Object.keys(registro.legado), ...Object.keys(registro.projecao)]),
      ].sort();
      const divergentes = caminhos
        .filter((caminho) => {
          const a = (registro.legado[caminho] ?? []).join('|');
          const b = (registro.projecao[caminho] ?? []).join('|');
          return a !== b && !sentinelaDeclarada(registro.operacao, caminho);
        })
        .map(
          (caminho) =>
            `${caminho}: legado=${registro.legado[caminho] ?? '(ausente)'} projeção=${registro.projecao[caminho] ?? '(ausente)'}`,
        );
      expect(
        divergentes,
        `${registro.operacao}(${registro.args.join(', ')}): default vazio diferente (null x undefined x [] x "")`,
      ).toEqual([]);
    }

    // Dados ausentes: os dois lados concordam, sentinela por sentinela.
    const a = relatorio.ausentes;
    expect(a.classeInexistenteFachada).toEqual(a.classeInexistenteLegado);
    expect(a.classeInexistenteFachada).toBeNull();
    expect(a.naoConjuradorFachada).toEqual(a.naoConjuradorLegado);
    expect(a.naoConjuradorFachada).toBeNull();
    expect(a.magiaInexistenteFachada).toEqual(a.magiaInexistenteLegado);
    expect(a.magiaInexistenteFachada).toBeNull();
    expect(a.circuloForaFachada).toEqual(a.circuloForaLegado);
    expect(a.circuloForaFachada).toBeNull();
    // `[]`, não `null` e não `undefined` — o default que mais facilmente se perde.
    expect(a.buscaVaziaFachada).toEqual([]);
    expect(a.buscaVaziaLegado).toEqual([]);
    expect(a.precarregarFachada).toBe('__undefined__');
    expect(a.precarregarLegado).toBe('__undefined__');
  });
});

// --- Camada 3: pureza de rede ---------------------------------------------

test.describe('Pureza de rede após o cutover', () => {
  test('requisições: só dados/pacotes/dnd2024/** alimenta conteúdo', async ({ page }) => {
    test.setTimeout(180_000);

    const pedidos = [];
    page.on('request', (request) => pedidos.push(new URL(request.url()).pathname));

    await resetApp(page, { characters: [] });
    const { id } = await criarPersonagemCompleto(page, 'Mago');
    await page.reload();
    await goFicha(page, id);
    // Task 33 (cutover): o marcador da ficha é a raiz que o controller
    // desenha, não mais um botão do monólito.
    await expect(page.locator('[data-sheet-section="summary-combat"]')).toBeVisible();

    // Abrir o fluxo de level-up garante que esse caminho de leitura também
    // não busca JSON legado (Task 37: o cluster `levelup-*.js`, que importava
    // `db.js`, foi removido do runtime — o fluxo atual é o v2 de
    // `features/sheet`). Sem `catch` silencioso de propósito: se o botão
    // sumir, este teste tem de reprovar, não deixar de exercitar o caminho.
    const btnLevelUp = page.locator('[data-action="level-up-open"]');
    await expect(btnLevelUp).toBeVisible();
    await btnLevelUp.click();
    await expect(page.locator('#modal-overlay')).toHaveCSS('display', 'flex', { timeout: 15000 });

    const dados = pedidos.filter((caminho) => caminho.startsWith('/dados/'));
    const legados = dados.filter((caminho) => !caminho.startsWith('/dados/pacotes/dnd2024/'));

    expect(dados.length, 'nenhum conteúdo foi buscado: o teste não provaria nada').toBeGreaterThan(0);
    expect(
      [...new Set(legados)].sort(),
      'JSON legado requisitado pelo APP depois do cutover — o caminho de leitura não foi trocado ' +
        '(os arquivos continuam no repositório de propósito, como oráculo de teste, mas o app não pode lê-los)',
    ).toEqual([]);

    // Guarda do próprio mecanismo: os JSON legados CONTINUAM servíveis (é o
    // que o modo sombra e o teste de contrato precisam). Se não estivessem, o
    // filtro acima ficaria verde por ausência de arquivo, não por cutover.
    const resposta = await page.request.get('/dados/classes/mago.json');
    expect(resposta.ok(), 'os JSON legados precisam continuar existindo como oráculo de teste').toBe(true);
  });

  test('as operações de runtime declaradas são as que a fachada realmente serve', async ({ page }) => {
    await resetApp(page, { characters: [] });
    const exports = await page.evaluate(async () => {
      const fachada = await import('/site/js/db.js');
      return Object.keys(fachada).filter((nome) => typeof fachada[nome] === 'function');
    });
    for (const operacao of PUBLIC_RUNTIME_LEGACY_OPERATIONS) {
      expect(exports, `a fachada não exporta ${operacao}`).toContain(operacao);
    }
  });
});
