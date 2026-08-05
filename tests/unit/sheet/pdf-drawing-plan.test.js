// Teste focal de `features/sheet/pdf/pdf-drawing-plan.js` (Task 33).
//
// O plano é PURO: mesma entrada, mesma saída, sem `pdf-lib`, sem `document` e
// — o ponto central desta task — SEM etapa intermediária de HTML. O baseline
// montava o HTML de impressão e o lia de volta com `DOMParser`
// (`_extrairBlocosDetalhe`), o que amarrava o PDF à árvore de um markup de
// tela. Aqui o PDF lê o mesmo modelo de saída que a impressão lê.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildFixtureViewModel } from '../../helpers/sheet-output-fixture.js';
import {
  createPdfDrawingPlan,
  sanitizePdfText,
  PDF_OPERATIONS,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  PAGE_MARGIN,
} from '../../../site/js/features/sheet/pdf/pdf-drawing-plan.js';
import { buildSheetOutputModel, indexOutputValues } from '../../../site/js/features/sheet/output-model.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * Índice `semantic -> value` das operações de texto de um plano.
 * @param {ReadonlyArray<object>} operations
 * @returns {Record<string, *>}
 */
function semanticValues(operations) {
  const indice = {};
  for (const operacao of operations) {
    if (operacao.op === PDF_OPERATIONS.drawText && typeof operacao.semantic === 'string') {
      indice[operacao.semantic] = operacao.value;
    }
  }
  return indice;
}

describe('unit/sheet/pdf-drawing-plan — plano puro', () => {
  test('é determinístico e congelado', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const a = createPdfDrawingPlan(viewModel);
    const b = createPdfDrawingPlan(viewModel);
    assert.deepEqual(a, b);
    assert.ok(Object.isFrozen(a));
    for (const operacao of a) {
      assert.ok(Object.isFrozen(operacao));
    }
  });

  test('começa por uma página A4 e nenhuma operação de desenho a precede', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const ops = createPdfDrawingPlan(viewModel);
    assert.equal(ops[0].op, PDF_OPERATIONS.addPage);
    assert.equal(ops[0].width, PAGE_WIDTH);
    assert.equal(ops[0].height, PAGE_HEIGHT);
    const primeiraPagina = ops.findIndex((operacao) => operacao.op === PDF_OPERATIONS.addPage);
    assert.equal(primeiraPagina, 0);
  });

  test('todo desenho cabe dentro da página e nada invade a margem inferior', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    for (const operacao of createPdfDrawingPlan(viewModel)) {
      if (operacao.op === PDF_OPERATIONS.addPage) {
        continue;
      }
      assert.ok(operacao.y >= 0, `y negativo em ${operacao.op}`);
      assert.ok(operacao.y <= PAGE_HEIGHT, `y acima do topo em ${operacao.op}`);
      assert.ok(operacao.x >= 0 && operacao.x <= PAGE_WIDTH, `x fora da página em ${operacao.op}`);
    }
    assert.ok(PAGE_MARGIN > 0);
  });

  test('emite os MESMOS valores semânticos que o modelo de saída (a fonte da impressão)', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const modelo = buildSheetOutputModel(viewModel);
    assert.equal(modelo.ok, true);
    const doModelo = indexOutputValues(modelo.value);
    const doPlano = semanticValues(createPdfDrawingPlan(viewModel));
    for (const [semantic, valor] of Object.entries(doModelo)) {
      assert.deepEqual(doPlano[semantic], valor, `o PDF divergiu do modelo em "${semantic}"`);
    }
  });

  test('caracteres fora do WinAnsi viram "?" em vez de derrubar a geração', () => {
    // A Helvetica padrão não codifica CJK; `drawText` LANÇA nesse caso, e o
    // baseline já saneava por isso (`_sanitizePdfText`).
    assert.equal(sanitizePdfText('Élan – 日本'), 'Élan – ??');
    assert.equal(sanitizePdfText(null), '');
    assert.equal(sanitizePdfText(12), '12');
  });

  test('o nome do personagem é saneado dentro da operação de desenho', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const hostil = {
      ...viewModel,
      derived: {
        ...viewModel.derived,
        printable: { ...viewModel.derived.printable, headline: { ...viewModel.derived.printable.headline, name: '日本 Thalion' } },
      },
    };
    const ops = createPdfDrawingPlan(hostil);
    const cabecalho = ops.find((operacao) => operacao.semantic === 'headline.name');
    assert.equal(cabecalho.text, '?? Thalion');
    // O VALOR bruto continua íntegro: quem compara paridade compara o valor,
    // não o texto degradado pela limitação da fonte.
    assert.equal(cabecalho.value, '日本 Thalion');
  });

  test('bloco indisponível é DESENHADO com o motivo — não some do PDF', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const semCatalogo = {
      ...viewModel,
      derived: { ...viewModel.derived, inventory: { available: false, reason: 'SHEET_INVENTORY_REGISTRY_MISSING', items: [] } },
    };
    const valores = semanticValues(createPdfDrawingPlan(semCatalogo));
    assert.equal(valores['inventory.unavailableReason'], 'SHEET_INVENTORY_REGISTRY_MISSING');
  });

  test('ViewModel inválido gera uma página com a recusa, nunca um plano vazio', () => {
    const ops = createPdfDrawingPlan(null);
    assert.equal(ops[0].op, PDF_OPERATIONS.addPage);
    assert.ok(ops.some((operacao) => operacao.op === PDF_OPERATIONS.drawText && operacao.text.includes('SHEET_OUTPUT_VIEW_MODEL_INVALID')));
  });

  test('o fonte não faz HTML intermediário nem conhece pdf-lib', async () => {
    const fonte = await readFile(path.join(repoRoot, 'site/js/features/sheet/pdf/pdf-drawing-plan.js'), 'utf8');
    const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const proibido of ['DOMParser', 'innerHTML', 'document.', 'PDFDocument', 'StandardFonts', 'rgb(']) {
      assert.equal(codigo.includes(proibido), false, `"${proibido}" não pode aparecer no plano puro`);
    }
    assert.equal(/^(let|var)\s+/m.test(codigo), false, 'nenhum estado de módulo mutável');
  });
});
