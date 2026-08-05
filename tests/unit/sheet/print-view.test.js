// Teste focal de `features/sheet/print/print-view.js` (Task 33).
//
// O que este arquivo prende:
//   - a impressão sai do MESMO `SheetViewModel` da tela e do PDF;
//   - ela traz `@media print` e as MESMAS seções, diferindo só em layout;
//   - o valor de PV temporário e de Dados de Vida restantes é o do ViewModel,
//     e não o campo inexistente que o baseline lia (as duas divergências
//     registradas em `baselineDifferences` de `derived-values.json`);
//   - texto do jogador é ESCAPADO;
//   - uma projeção indisponível imprime o MOTIVO, nunca uma folha em branco;
//   - o fonte não contém regra de jogo nem parsing de prosa.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildFixtureViewModel } from '../../helpers/sheet-output-fixture.js';
import { renderPrintHtml, FIRST_PAGE_BLOCK_IDS, PRINT_OVERLAY_ID } from '../../../site/js/features/sheet/print/print-view.js';
import { buildSheetOutputModel } from '../../../site/js/features/sheet/output-model.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

describe('unit/sheet/print-view — a folha impressa', () => {
  test('emite `@media print` e revela o overlay que a folha do app já conhece', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const html = renderPrintHtml(viewModel);
    assert.match(html, /@media print\{/);
    assert.ok(html.includes(`#${PRINT_OVERLAY_ID}`), 'o id do overlay é o mesmo do baseline (site/css/app.css já o trata)');
    assert.match(html, /data-sheet-print="ready"/);
  });

  test('imprime TODOS os blocos do modelo de saída — nem mais, nem menos', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const modelo = buildSheetOutputModel(viewModel);
    assert.equal(modelo.ok, true);
    const html = renderPrintHtml(viewModel);
    const impressos = [...html.matchAll(/data-print-block="([^"]+)"/g)].map((achado) => achado[1]);
    assert.deepEqual(
      impressos,
      modelo.value.blocks.map((bloco) => bloco.id),
      'a impressão não pode ter uma lista de seções própria',
    );
  });

  test('a diferença entre a primeira página e as demais é de LAYOUT, não de conteúdo', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const html = renderPrintHtml(viewModel);
    const paginas = html.split('<div class="print-page">').slice(1);
    assert.equal(paginas.length, 2, 'resumo numa página, detalhamento na seguinte');
    for (const blocoId of FIRST_PAGE_BLOCK_IDS) {
      assert.ok(paginas[0].includes(`data-print-block="${blocoId}"`), `bloco "${blocoId}" deveria estar na primeira página`);
      assert.equal(paginas[1].includes(`data-print-block="${blocoId}"`), false, `bloco "${blocoId}" duplicado na segunda página`);
    }
  });

  test('PV temporário e Dados de Vida vêm do ViewModel (corrige as duas divergências do baseline)', async () => {
    const { viewModel, testCase } = await buildFixtureViewModel('pv-temporario-divergente');
    const html = renderPrintHtml(viewModel);
    const temporario = html.match(/data-print-semantic="hitPoints\.temporary"[\s\S]*?sheet-print-entry-value">([^<]*)</);
    assert.ok(temporario, 'a folha precisa ter a entrada de PV temporário');
    assert.equal(temporario[1], String(testCase.expectedUnified));
    // `baselineObserved.print` era 0 — o valor que o campo inexistente
    // `char.pv_temp` produzia. A saída unificada não tem como reproduzi-lo.
    assert.notEqual(temporario[1], String(testCase.baselineObserved.print));

    const { viewModel: vmDados, testCase: casoDados } = await buildFixtureViewModel('dados-de-vida-restantes-divergente');
    const htmlDados = renderPrintHtml(vmDados);
    const dados = htmlDados.match(/data-print-semantic="hitDice\.remaining"[\s\S]*?sheet-print-entry-value">([^<]*)</);
    assert.ok(dados);
    assert.match(dados[1], new RegExp(`^${casoDados.expectedUnified}/`));
  });

  test('texto do jogador é escapado — markup no nome não vira markup na folha', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const hostil = {
      ...viewModel,
      data: {
        ...viewModel.data,
        identity: { ...viewModel.data.identity, name: '<img src=x onerror=alert(1)>', notes: '<b>negrito</b>' },
      },
      derived: {
        ...viewModel.derived,
        printable: {
          ...viewModel.derived.printable,
          headline: { ...viewModel.derived.printable.headline, name: '<img src=x onerror=alert(1)>' },
        },
      },
    };
    const html = renderPrintHtml(hostil);
    assert.equal(html.includes('<img src=x'), false);
    assert.ok(html.includes('&lt;img src=x'));
    assert.equal(html.includes('<b>negrito</b>'), false);
  });

  test('ViewModel inválido imprime o MOTIVO, nunca uma folha vazia', () => {
    const html = renderPrintHtml(null);
    assert.match(html, /data-sheet-print="error"/);
    assert.match(html, /data-print-error="SHEET_OUTPUT_VIEW_MODEL_INVALID"/);
    assert.ok(html.includes('print-page'), 'a recusa continua sendo uma página imprimível');
  });

  test('inventário indisponível declara o motivo em vez de imprimir "nenhum item"', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const semCatalogo = {
      ...viewModel,
      derived: { ...viewModel.derived, inventory: { available: false, reason: 'SHEET_INVENTORY_REGISTRY_MISSING', items: [] } },
    };
    const html = renderPrintHtml(semCatalogo);
    assert.match(html, /data-print-unavailable="SHEET_INVENTORY_REGISTRY_MISSING"/);
  });

  test('o fonte não contém regra de jogo, parsing de prosa nem DOM', async () => {
    const fonte = await readFile(path.join(repoRoot, 'site/js/features/sheet/print/print-view.js'), 'utf8');
    const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const proibido of ['DOMParser', 'document.', 'addEventListener', 'calcMod', 'CLASSES_INFO', 'bonusProficiencia', 'querySelector']) {
      assert.equal(codigo.includes(proibido), false, `"${proibido}" não pode aparecer na impressão`);
    }
    assert.equal(/^(let|var)\s+/m.test(codigo), false, 'nenhum estado de módulo mutável');
  });
});
