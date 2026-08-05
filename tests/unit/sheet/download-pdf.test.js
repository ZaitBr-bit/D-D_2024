// Teste focal de `features/sheet/pdf/download-pdf.js` (Task 33).
//
// O nome do arquivo é o do baseline caractere a caractere — `tests/e2e/
// print-pdf.spec.js` afirma `Ficha <nome>.pdf`, e um jogador com uma pasta de
// fichas espera continuar achando as dele.
//
// O restante prende as recusas: sem documento, sem Blob, com o vendor
// indisponível ou com o backend falhando, `downloadPdf` devolve `Result` de
// erro NOMEADO. Nenhum caminho termina em "não aconteceu nada" (o clique que o
// jogador dá e que não produz arquivo nem mensagem).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildFixtureViewModel } from '../../helpers/sheet-output-fixture.js';
import { createRecordingPdfBackend } from '../../helpers/recording-pdf-backend.js';
import { ok, err } from '../../../site/js/core/result.js';
import { createAppError } from '../../../site/js/core/errors.js';
import { downloadPdf, pdfFileName, OBJECT_URL_TTL_MS } from '../../../site/js/features/sheet/pdf/download-pdf.js';

/**
 * Portas dublê completas. Cada dublê registra o que recebeu.
 * @param {object} [overrides]
 * @returns {object}
 */
function portas(overrides = {}) {
  const cliques = [];
  const criadas = [];
  const revogadas = [];
  const agendadas = [];
  const anexados = [];
  const documentRef = {
    body: {
      /**
       * @param {object} node
       * @returns {void}
       */
      appendChild(node) {
        anexados.push(node);
      },
    },
    /**
     * @returns {object}
     */
    createElement() {
      return {
        href: '',
        download: '',
        rel: '',
        /** @returns {void} */
        click() {
          cliques.push({ href: this.href, download: this.download });
        },
        /** @returns {void} */
        remove() {},
      };
    },
  };
  return {
    cliques,
    criadas,
    revogadas,
    agendadas,
    anexados,
    ports: {
      documentRef,
      globalRef: {},
      loader: async () => ok({ PDFDocument: {}, rgb: () => ({}) }),
      backendFactory: () => ok(createRecordingPdfBackend()),
      blobFactory: (partes, opcoes) => ({ partes, opcoes }),
      urlFactory: {
        /**
         * @param {object} blob
         * @returns {string}
         */
        createObjectURL(blob) {
          criadas.push(blob);
          return `blob:${criadas.length}`;
        },
        /**
         * @param {string} url
         * @returns {void}
         */
        revokeObjectURL(url) {
          revogadas.push(url);
        },
      },
      scheduler: {
        /**
         * @param {Function} fn
         * @param {number} ms
         * @returns {void}
         */
        schedule(fn, ms) {
          agendadas.push({ fn, ms });
        },
      },
      ...overrides,
    },
  };
}

describe('unit/sheet/download-pdf — nome do arquivo', () => {
  test('mantém o formato do baseline', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    assert.equal(pdfFileName(viewModel), `Ficha ${viewModel.data.identity.name}.pdf`);
  });

  test('troca por "-" os caracteres proibidos em nome de arquivo', () => {
    assert.equal(pdfFileName({ data: { identity: { name: 'A/B:C*D?E"F<G>H|I\\J' } } }), 'Ficha A-B-C-D-E-F-G-H-I-J.pdf');
  });

  test('sem nome, cai no fallback do baseline', () => {
    assert.equal(pdfFileName({ data: { identity: { name: '   ' } } }), 'Ficha personagem.pdf');
    assert.equal(pdfFileName({}), 'Ficha personagem.pdf');
  });
});

describe('unit/sheet/download-pdf — entrega', () => {
  test('gera, anexa a âncora, clica e agenda a revogação da object URL', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const dublê = portas();
    const resultado = await downloadPdf(viewModel, dublê.ports);
    assert.equal(resultado.ok, true, resultado.ok ? '' : resultado.error.code);
    assert.equal(dublê.cliques.length, 1);
    assert.equal(dublê.cliques[0].download, pdfFileName(viewModel));
    assert.equal(dublê.anexados.length, 1, 'a âncora precisa estar no documento para o clique valer');
    assert.equal(dublê.criadas[0].opcoes.type, 'application/pdf');
    assert.equal(dublê.agendadas.length, 1);
    assert.equal(dublê.agendadas[0].ms, OBJECT_URL_TTL_MS);
    // A revogação só acontece quando o agendamento dispara — revogar na hora
    // cancelaria um download que ainda não começou.
    assert.deepEqual(dublê.revogadas, []);
    dublê.agendadas[0].fn();
    assert.deepEqual(dublê.revogadas, ['blob:1']);
  });

  test('falha do loader sobe com o código do loader', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const dublê = portas({
      loader: async () => err(createAppError({ code: 'PDF_LIB_SCRIPT_ERROR', scope: 'teste', message: 'sem rede' })),
    });
    const resultado = await downloadPdf(viewModel, dublê.ports);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'PDF_LIB_SCRIPT_ERROR');
    assert.equal(dublê.cliques.length, 0, 'nenhum arquivo pode ser entregue quando o vendor não carregou');
  });

  test('falha do backend sobe sem entregar arquivo', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const dublê = portas({
      backendFactory: () => ok(createRecordingPdfBackend({ failWith: createAppError({ code: 'PDF_BACKEND_RENDER_THREW', scope: 'teste', message: 'x' }) })),
    });
    const resultado = await downloadPdf(viewModel, dublê.ports);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'PDF_BACKEND_RENDER_THREW');
    assert.equal(dublê.cliques.length, 0);
  });

  test('sem documento ou sem Blob, recusa nomeada', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const semDoc = await downloadPdf(viewModel, { ...portas().ports, documentRef: null });
    assert.equal(semDoc.ok, false);
    assert.equal(semDoc.error.code, 'PDF_DOWNLOAD_DOCUMENT_UNAVAILABLE');

    const semBlob = await downloadPdf(viewModel, { ...portas().ports, blobFactory: null });
    assert.equal(semBlob.ok, false);
    assert.equal(semBlob.error.code, 'PDF_DOWNLOAD_BLOB_UNAVAILABLE');
  });

  test('se a entrega falhar depois de criada a URL, ela é REVOGADA na hora', async () => {
    const { viewModel } = await buildFixtureViewModel('pv-convergente');
    const dublê = portas();
    dublê.ports.documentRef = {
      ...dublê.ports.documentRef,
      /**
       * @returns {object}
       */
      createElement() {
        throw new Error('sem DOM');
      },
    };
    const resultado = await downloadPdf(viewModel, dublê.ports);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'PDF_DOWNLOAD_DELIVERY_FAILED');
    assert.deepEqual(dublê.revogadas, ['blob:1'], 'o blob não pode vazar quando a entrega falha');
  });
});
