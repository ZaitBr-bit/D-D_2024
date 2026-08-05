// ============================================================
// Teste de contrato (Task 33): TELA, IMPRESSÃO e PDF emitem os MESMOS valores.
//
// ## Como a comparação é feita (e por que não se faz parsing de PDF)
//
// Um PDF final é um stream comprimido: procurar o caractere "6" dentro dele
// para provar "o PV temporário é 6" não é uma verificação, é uma coincidência
// esperando para acontecer. Aqui a comparação é de OPERAÇÕES SEMÂNTICAS: cada
// operação de desenho que carrega um valor de ficha leva junto o par
// (`semantic`, `value`), e `tests/helpers/recording-pdf-backend.js` as grava.
// O mesmo `semantic` identifica o valor na impressão (atributo
// `data-print-semantic`) e na projeção que a seção da tela recorta.
//
// A âncora dos três é `expectedUnified` de
// `tests/fixtures/expected/derived-values.json` — o oráculo congelado da Task 2.
// Comparar as três saídas SÓ entre si deixaria passar três erros idênticos.
//
// ## A política da Task 2 (`baselineObserved` / `baselineDifferences`)
//
// `baselineObserved` documenta o que o app ANTIGO fazia, bugs inclusive;
// `expectedUnified` é o valor correto; `baselineDifferences` lista, por meio de
// saída (`screen`/`print`/`pdf`), toda divergência ACEITA do baseline, com
// motivo. A saída unificada desta task CONVERGE: onde o baseline divergia (PV
// temporário e Dados de Vida restantes em print/PDF, capacidade de carga e
// recursos de talento ausentes de print/PDF), as três saídas agora dão o mesmo
// número. Este arquivo verifica as duas metades — a convergência com
// `expectedUnified` E a superação de cada `baselineDifferences` listada.
//
// ## As duas lacunas que ESTE teste descobriu, e o que aconteceu com elas
//
// Na primeira rodada da Task 33 este arquivo expôs dois buracos que só não
// apareciam antes porque nenhuma saída pública consumia o ViewModel — o harness
// de teste os tapava injetando dicas por `projectionContext`. A rodada de
// cutover fechou os dois (autorização registrada em `questions-for-review.txt`
// item 20):
//
//   1. ESPAÇOS DE MAGIA — `getSpellcastingProjection` (Task 18) exige os
//      máximos por `context.spellcasting`, e não havia produtor em produção.
//      FECHADO por `features/sheet/spellcasting-table.js`, que os deriva da
//      matriz de progressão da Task 23 (efeitos `resource` estruturados do
//      catálogo). O caso `espacos-de-magia-convergente` agora CONVERGE para
//      `expectedUnified` (3) nas três saídas.
//   2. NOMES DE EXIBIÇÃO de resistências/vulnerabilidades/imunidades —
//      `derived.defenses.*` carregava só ContentIds, e tela/impressão/PDF
//      mostravam `dnd2024:damage-type:fogo` ao jogador. FECHADO por
//      `derived.defenses.*Labels`, resolvido pelo MESMO mecanismo de
//      nome-por-ContentId que `printable` já usava. O que resta é uma diferença
//      de VOCABULÁRIO ("Ígneo" no registro legado vs. "Fogo" no catálogo
//      publicado), e continua declarada abaixo.
//
// A divergência remanescente está em `DIVERGENCIAS_DECLARADAS` e é VERIFICADA
// (o teste falha se a lacuna deixar de existir sem que alguém a tire da lista),
// em vez de silenciosamente pulada.
// ============================================================
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildFixtureViewModel } from '../helpers/sheet-output-fixture.js';
import { createRecordingPdfBackend } from '../helpers/recording-pdf-backend.js';
import { renderPdf } from '../../site/js/features/sheet/pdf/pdf-renderer.js';
import { renderPrintHtml } from '../../site/js/features/sheet/print/print-view.js';
import { buildSheetOutputModel, indexOutputValues } from '../../site/js/features/sheet/output-model.js';
import { createSummaryCombatSection } from '../../site/js/features/sheet/sections/summary-combat-section.js';
import { createConditionsDefensesSensesSection } from '../../site/js/features/sheet/sections/conditions-defenses-senses-section.js';
import { createInventoryLoadCoinsSection } from '../../site/js/features/sheet/sections/inventory-load-coins-section.js';
import { createResourcesFeaturesSection } from '../../site/js/features/sheet/sections/resources-features-section.js';
import { createSpellsSpellbookSection } from '../../site/js/features/sheet/sections/spells-spellbook-section.js';

/**
 * Divergências DECLARADAS entre a saída unificada e `expectedUnified`, com o
 * motivo e a task que as registrou. Cada uma é verificada abaixo.
 * @type {ReadonlyArray<Readonly<object>>}
 */
export const DIVERGENCIAS_DECLARADAS = Object.freeze([
  // `espacos-de-magia-convergente` SAIU desta lista na Task 33: a lacuna era a
  // ausência de produtor para `context.spellcasting`, e ela foi FECHADA por
  // `features/sheet/spellcasting-table.js` (derivado da matriz de progressão da
  // Task 23, com paridade exaustiva contra a tabela legada em
  // `tests/unit/sheet/spellcasting-table.test.js`). O caso agora converge para
  // `expectedUnified` nas três saídas, e o teste abaixo o exige.
  Object.freeze({
    caso: 'resistencias-convergente',
    semantic: 'defenses.resistances',
    valorUnificado: Object.freeze(['Fogo']),
    motivo:
      'O ContentId JÁ é resolvido para nome de exibição (Task 33) — a lacuna do identificador técnico exposto ao ' +
      'jogador foi fechada. O que resta é uma diferença de VOCABULÁRIO, não de mecanismo: o app legado persistia o ' +
      'rótulo "Ígneo" digitado no monólito (`TIPOS_DANO` de sheet.js), enquanto o nome canônico da entidade ' +
      '`dnd2024:damage-type:fogo` no catálogo publicado é "Fogo". O próprio arquivo de aliases ' +
      '(`character-v1-aliases.json`) declara que o mapa legado é "usado exclusivamente na fronteira de migração/' +
      'leitura — nunca como fonte de verdade de apresentação", então resolver para "Fogo" é o comportamento correto. ' +
      'Fechar esta entrada exigiria renomear a entidade do catálogo, que é decisão de CONTEÚDO, não desta task.',
  }),
]);

/**
 * Constrói o índice `semantic -> valor` da TELA, a partir das projeções que as
 * seções reais recortam do ViewModel. É o que a tela de fato tem — não uma
 * segunda leitura do ViewModel feita por este teste.
 * @param {object} viewModel
 * @returns {Record<string, *>}
 */
function indiceDaTela(viewModel) {
  /**
   * @param {object} resultado
   * @returns {object}
   */
  const secao = (resultado) => {
    assert.equal(resultado.ok, true, resultado.ok ? '' : resultado.error.code);
    return resultado.value;
  };
  const resumo = secao(createSummaryCombatSection()).select(viewModel);
  const condicoes = secao(createConditionsDefensesSensesSection()).select(viewModel);
  const inventario = secao(createInventoryLoadCoinsSection()).select(viewModel);
  const recursos = secao(createResourcesFeaturesSection()).select(viewModel);
  const magias = secao(createSpellsSpellbookSection()).select(viewModel);

  /** @type {Record<string, *>} */
  const indice = {
    armorClass: resumo.armorClass,
    initiative: resumo.initiative,
    speed: typeof resumo.movement.effective === 'number' ? `${resumo.movement.effective} metros` : null,
    hitPoints: `${resumo.hitPoints.current}/${resumo.hitPoints.maximum}`,
    'hitPoints.maximum': resumo.hitPoints.maximum,
    'hitPoints.temporary': resumo.hitPoints.temporary,
    'hitDice.remaining': resumo.hitPoints.hitDiceRemaining,
    proficiencyBonus: resumo.proficiencyBonus,
    spellSaveDC: magias.saveDC,
    spellAttackBonus: magias.attackBonus,
    passivePerception: condicoes.senses.passivePerception,
    passiveInsight: condicoes.senses.passiveInsight,
    passiveInvestigation: condicoes.senses.passiveInvestigation,
    darkvision: condicoes.senses.darkvision,
    // Task 33: o que a TELA mostra é o rótulo resolvido, não o ContentId — é
    // o texto que o jogador lê, e é ele que tem de convergir com impressão,
    // PDF e o oráculo. Os ids continuam na projeção (`condicoes.defenses.
    // resistances`) como identidade, e são exercitados pelo teste focal da
    // seção.
    'defenses.resistances': condicoes.defenses.resistanceLabels,
    'defenses.vulnerabilities': condicoes.defenses.vulnerabilityLabels,
    'defenses.immunities': condicoes.defenses.immunityLabels,
    'load.totalWeightKg': inventario.load.totalWeightKg,
    'load.carryingCapacityKg': inventario.load.carryingCapacityKg,
    'wallet.totalCopper': inventario.wallet.totalCopper,
  };
  for (const [chave, valor] of Object.entries(resumo.abilities)) {
    indice[`ability.${chave}`] = valor.modifier;
  }
  for (const [chave, valor] of Object.entries(resumo.savingThrows)) {
    indice[`save.${chave}`] = valor.bonus;
  }
  for (const [chave, valor] of Object.entries(resumo.skills)) {
    indice[`skill.${chave}`] = valor.bonus;
  }
  for (const ataque of resumo.attacks) {
    indice[`attack.${ataque.instanceId}`] = ataque.attackBonus;
  }
  for (const [chave, valor] of Object.entries(recursos.resources)) {
    indice[`resource.${chave}`] = valor.available;
  }
  for (const slot of magias.slots) {
    indice[`spellSlot.${slot.level}`] = slot.available;
  }
  for (const item of inventario.items) {
    indice[`inventory.${item.instanceId}`] = item.quantity;
  }
  for (const denominacao of ['pl', 'po', 'pe', 'pp', 'pc']) {
    indice[`wallet.${denominacao}`] = inventario.wallet[denominacao];
  }
  return indice;
}

/**
 * Índice `semantic -> texto` da IMPRESSÃO, lido do markup emitido.
 * @param {string} html
 * @returns {Record<string, string>}
 */
function indiceDaImpressao(html) {
  /** @type {Record<string, string>} */
  const indice = {};
  const padrao = /data-print-semantic="([^"]+)"><div class="sheet-print-entry-label">[^<]*<\/div><div class="sheet-print-entry-value">([^<]*)</g;
  let achado;
  while ((achado = padrao.exec(html)) !== null) {
    indice[achado[1]] = achado[2];
  }
  return indice;
}

/**
 * Roda o plano contra o gravador e devolve `semantic -> valor`.
 * @param {object} viewModel
 * @returns {Promise<Record<string, *>>}
 */
async function indiceDoPdf(viewModel) {
  const backend = createRecordingPdfBackend();
  const resultado = await renderPdf(viewModel, { backend });
  assert.equal(resultado.ok, true, resultado.ok ? '' : resultado.error.code);
  return { ...backend.getSemanticValues() };
}

/** Casos do oráculo cujos valores esta task compara nas três saídas. */
const CASOS = Object.freeze([
  'pv-convergente',
  'ca-convergente',
  'iniciativa-convergente',
  'pv-temporario-divergente',
  'dados-de-vida-restantes-divergente',
  'cd-magia-convergente',
  'ataque-magia-convergente',
  'percepcao-passiva-convergente',
  'intuicao-passiva-convergente',
  'carga-somente-na-tela',
  'deslocamento-convergente',
  'espacos-de-magia-convergente',
  'recursos-de-talento-convergente',
  'resistencias-convergente',
]);

/**
 * Semântica correspondente ao `campo` de cada caso do oráculo.
 * @type {Readonly<Record<string, string>>}
 */
const SEMANTICA_DO_CASO = Object.freeze({
  'pv-convergente': 'hitPoints',
  'ca-convergente': 'armorClass',
  'iniciativa-convergente': 'initiative',
  'pv-temporario-divergente': 'hitPoints.temporary',
  'dados-de-vida-restantes-divergente': 'hitDice.remaining',
  'cd-magia-convergente': 'spellSaveDC',
  'ataque-magia-convergente': 'spellAttackBonus',
  'percepcao-passiva-convergente': 'passivePerception',
  'intuicao-passiva-convergente': 'passiveInsight',
  'carga-somente-na-tela': 'load.carryingCapacityKg',
  'deslocamento-convergente': 'speed',
  'espacos-de-magia-convergente': 'spellSlot.1',
  'resistencias-convergente': 'defenses.resistances',
});

describe('contract/sheet-output-parity — as três saídas emitem os MESMOS valores', () => {
  for (const casoId of CASOS) {
    test(`${casoId}: tela, impressão e PDF concordam em TODA a semântica`, async () => {
      const { viewModel } = await buildFixtureViewModel(casoId);
      const modelo = buildSheetOutputModel(viewModel);
      assert.equal(modelo.ok, true, modelo.ok ? '' : modelo.error.code);

      const daTela = indiceDaTela(viewModel);
      const doModelo = indexOutputValues(modelo.value);
      const daImpressao = indiceDaImpressao(renderPrintHtml(viewModel));
      const doPdf = await indiceDoPdf(viewModel);

      // O PDF precisa emitir TODA a semântica do modelo de saída — nem uma a
      // menos. Um campo que some do PDF é o defeito que o baseline tinha com
      // os Dados de Vida.
      for (const semantic of Object.keys(doModelo)) {
        assert.ok(Object.hasOwn(doPdf, semantic), `o PDF não emitiu "${semantic}"`);
        assert.ok(Object.hasOwn(daImpressao, semantic), `a impressão não emitiu "${semantic}"`);
        assert.deepEqual(doPdf[semantic], doModelo[semantic], `PDF divergiu da impressão em "${semantic}"`);
      }

      // E onde a TELA tem o campo, ela precisa concordar com os outros dois.
      for (const [semantic, valorDaTela] of Object.entries(daTela)) {
        if (!Object.hasOwn(doModelo, semantic)) {
          continue;
        }
        assert.deepEqual(doModelo[semantic], valorDaTela, `tela e impressão/PDF divergiram em "${semantic}"`);
      }
    });
  }

  for (const casoId of CASOS) {
    const semantic = SEMANTICA_DO_CASO[casoId];
    if (semantic === undefined) {
      continue;
    }
    test(`${casoId}: o valor unificado é o do oráculo da Task 2 (ou uma divergência DECLARADA)`, async () => {
      const { viewModel, testCase } = await buildFixtureViewModel(casoId);
      const doPdf = await indiceDoPdf(viewModel);
      const declarada = DIVERGENCIAS_DECLARADAS.find((entrada) => entrada.caso === casoId && entrada.semantic === semantic);

      if (declarada === undefined) {
        assert.deepEqual(doPdf[semantic], testCase.expectedUnified, `"${semantic}" não converge para expectedUnified`);
        return;
      }
      // A lacuna é VERIFICADA: se ela deixar de existir, este teste falha e
      // obriga a tirar a entrada da lista — nada de divergência que envelhece
      // em silêncio.
      assert.deepEqual(doPdf[semantic], declarada.valorUnificado, `a divergência declarada de "${semantic}" mudou de valor`);
      assert.notDeepEqual(doPdf[semantic], testCase.expectedUnified, `"${semantic}" convergiu: remova-o de DIVERGENCIAS_DECLARADAS`);
      assert.ok(declarada.motivo.length > 40, 'toda divergência declarada precisa de motivo escrito');
    });
  }
});

describe('contract/sheet-output-parity — as diferenças de print/PDF do baseline foram SUPERADAS', () => {
  test('PV temporário: o baseline imprimia 0 em print e PDF; a saída unificada imprime o valor real', async () => {
    const { viewModel, testCase } = await buildFixtureViewModel('pv-temporario-divergente');
    assert.equal(testCase.baselineDifferences.length, 2, 'o oráculo registra a divergência em print e PDF');
    const doPdf = await indiceDoPdf(viewModel);
    const daImpressao = indiceDaImpressao(renderPrintHtml(viewModel));
    for (const diferenca of testCase.baselineDifferences) {
      assert.equal(diferenca.valorEsperado, testCase.expectedUnified);
      const atual = diferenca.onde === 'pdf' ? doPdf['hitPoints.temporary'] : Number(daImpressao['hitPoints.temporary']);
      assert.equal(atual, testCase.expectedUnified);
      assert.notEqual(atual, diferenca.valorAtual, `a saída unificada não pode reproduzir o bug do baseline em ${diferenca.onde}`);
    }
  });

  test('Dados de Vida restantes: o baseline errava em print e OMITIA no PDF', async () => {
    const { viewModel, testCase } = await buildFixtureViewModel('dados-de-vida-restantes-divergente');
    const doPdf = await indiceDoPdf(viewModel);
    assert.equal(doPdf['hitDice.remaining'], testCase.expectedUnified);
    // `baselineObserved.pdf` era `null` — o campo simplesmente não existia no
    // cartão. Agora ele existe.
    assert.equal(testCase.baselineObserved.pdf, null);
  });

  test('capacidade de carga: ausente de print/PDF no baseline, presente agora nas três saídas', async () => {
    const { viewModel, testCase } = await buildFixtureViewModel('carga-somente-na-tela');
    const doPdf = await indiceDoPdf(viewModel);
    const daImpressao = indiceDaImpressao(renderPrintHtml(viewModel));
    assert.equal(testCase.baselineObserved.print, null);
    assert.equal(testCase.baselineObserved.pdf, null);
    assert.equal(doPdf['load.carryingCapacityKg'], testCase.expectedUnified);
    assert.equal(Number(daImpressao['load.carryingCapacityKg']), testCase.expectedUnified);
  });

  test('recursos: o baseline não tinha seção própria em print/PDF; a saída unificada tem', async () => {
    const { viewModel, testCase } = await buildFixtureViewModel('recursos-de-talento-convergente');
    assert.equal(testCase.baselineObserved.print, null);
    const doPdf = await indiceDoPdf(viewModel);
    const recursos = Object.keys(doPdf).filter((semantic) => semantic.startsWith('resource.'));
    assert.ok(recursos.length > 0, 'o PDF precisa emitir a seção de recursos');
  });
});

describe('contract/sheet-output-parity — o PDF não passa por HTML', () => {
  test('a impressão e o PDF são renderizadores do MESMO modelo, sem uma extrair da outra', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    // Se o PDF lesse o HTML de impressão (como `_extrairBlocosDetalhe` fazia),
    // um markup vazio esvaziaria o PDF. Aqui o plano é gerado do ViewModel: o
    // PDF continua completo mesmo sem nunca ter chamado `renderPrintHtml`.
    const doPdf = await indiceDoPdf(viewModel);
    const doModelo = indexOutputValues(buildSheetOutputModel(viewModel).value);
    assert.deepEqual(Object.keys(doPdf).sort(), [...Object.keys(doModelo), 'headline.name', 'headline.subtitle'].sort());
  });
});
