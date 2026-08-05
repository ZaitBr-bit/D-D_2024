// Teste focal de `features/sheet/pdf/pdf-renderer.js` + `pdf-lib-backend.js`
// (Task 33).
//
// O ponto do arquivo é o CONTRATO COMPARTILHADO: o backend real e o gravador
// respondem à mesma pergunta do mesmo jeito. Sem isso, o teste de paridade
// estaria confiando num dublê que aceita planos que a produção recusaria.
//
// O backend real é exercitado com o vendor DE VERDADE (`site/js/vendor/
// pdf-lib.min.js`, avaliado como o bundle UMD que ele é) — os bytes gerados são
// conferidos pela assinatura `%PDF-`.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildFixtureViewModel } from '../../helpers/sheet-output-fixture.js';
import { createRecordingPdfBackend } from '../../helpers/recording-pdf-backend.js';
import { renderPdf } from '../../../site/js/features/sheet/pdf/pdf-renderer.js';
import { createPdfLibBackend } from '../../../site/js/features/sheet/pdf/pdf-lib-backend.js';
import { createPdfDrawingPlan, PDF_OPERATIONS } from '../../../site/js/features/sheet/pdf/pdf-drawing-plan.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

/** @type {object|null} */
let PDFLib = null;

before(async () => {
  // O vendor é UMD, não ESM: ele é AVALIADO como módulo CommonJS. É a mesma
  // razão pela qual o loader de produção injeta `<script>` em vez de usar
  // `import()`.
  const fonte = await readFile(path.join(repoRoot, 'site/js/vendor/pdf-lib.min.js'), 'utf8');
  const modulo = { exports: {} };
  new Function('module', 'exports', 'self', 'window', fonte)(modulo, modulo.exports, {}, {});
  PDFLib = modulo.exports;
});

describe('unit/sheet/pdf-renderer — junção plano + backend', () => {
  test('sem backend, recusa nomeada — nunca bytes vazios', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const resultado = await renderPdf(viewModel, {});
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'PDF_RENDER_BACKEND_REQUIRED');
  });

  test('entrega ao backend exatamente o plano de `createPdfDrawingPlan`', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const backend = createRecordingPdfBackend();
    const resultado = await renderPdf(viewModel, { backend });
    assert.equal(resultado.ok, true);
    assert.deepEqual(
      backend.getOperations().map((operacao) => operacao.op),
      createPdfDrawingPlan(viewModel).map((operacao) => operacao.op),
    );
  });

  test('uma falha do backend sobe como Result, sem exceção', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const backend = createRecordingPdfBackend({ failWith: { code: 'BACKEND_EXPLODIU', scope: 'teste', message: 'falhou' } });
    const resultado = await renderPdf(viewModel, { backend });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'BACKEND_EXPLODIU');
  });
});

describe('unit/sheet/pdf-renderer — contrato COMPARTILHADO dos dois backends', () => {
  /**
   * Constrói os dois backends que o contrato cobre.
   * @returns {Array<{nome: string, backend: object}>}
   */
  function backends() {
    const real = createPdfLibBackend(PDFLib, {});
    assert.equal(real.ok, true, real.ok ? '' : real.error.code);
    return [
      { nome: 'pdf-lib (real)', backend: real.value },
      { nome: 'recording (teste)', backend: createRecordingPdfBackend() },
    ];
  }

  test('ambos recusam `operations` que não é array, com o MESMO código', async () => {
    for (const { nome, backend } of backends()) {
      const resultado = await backend.render(null);
      assert.equal(resultado.ok, false, nome);
      assert.equal(resultado.error.code, 'PDF_BACKEND_OPERATIONS_INVALID', nome);
    }
  });

  test('ambos recusam uma operação DESCONHECIDA, com o MESMO código', async () => {
    for (const { nome, backend } of backends()) {
      const resultado = await backend.render([
        { op: PDF_OPERATIONS.addPage, width: 100, height: 100 },
        { op: 'desenhar-dragao' },
      ]);
      assert.equal(resultado.ok, false, nome);
      assert.equal(resultado.error.code, 'PDF_BACKEND_OPERATION_UNKNOWN', nome);
    }
  });

  test('ambos devolvem Uint8Array com assinatura de PDF para o plano da ficha', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    for (const { nome, backend } of backends()) {
      const resultado = await renderPdf(viewModel, { backend });
      assert.equal(resultado.ok, true, `${nome}: ${resultado.ok ? '' : resultado.error.code}`);
      assert.ok(resultado.value instanceof Uint8Array, nome);
      assert.equal(Buffer.from(resultado.value.subarray(0, 5)).toString('ascii'), '%PDF-', nome);
    }
  });
});

describe('unit/sheet/pdf-lib-backend — o backend real', () => {
  test('recusa um namespace que não é PDFLib', () => {
    const resultado = createPdfLibBackend({}, {});
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'PDF_BACKEND_NAMESPACE_INVALID');
  });

  test('recusa desenho antes da primeira página', async () => {
    const backend = createPdfLibBackend(PDFLib, {});
    const resultado = await backend.value.render([{ op: PDF_OPERATIONS.drawText, text: 'x', x: 1, y: 1, size: 8, font: 'regular' }]);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'PDF_BACKEND_PAGE_MISSING');
  });

  test('gera bytes MAIORES para uma ficha do que para uma página vazia', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const backend = createPdfLibBackend(PDFLib, {}).value;
    const vazio = await backend.render([{ op: PDF_OPERATIONS.addPage, width: 595.28, height: 841.89 }]);
    const cheio = await renderPdf(viewModel, { backend });
    assert.equal(vazio.ok, true);
    assert.equal(cheio.ok, true);
    // Não é uma prova de conteúdo (para isso existe o teste de paridade sobre
    // operações); é a prova de que o desenho de fato aconteceu, e não de que
    // um plano vazio passou despercebido.
    assert.ok(cheio.value.length > vazio.value.length, 'a ficha desenhada precisa produzir mais bytes que uma página em branco');
  });
});
