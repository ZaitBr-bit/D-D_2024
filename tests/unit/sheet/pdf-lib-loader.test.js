// Teste focal de `features/sheet/pdf/pdf-lib-loader.js` (Task 33).
//
// As quatro garantias do brief: URL padrão resolvida contra o MÓDULO (nunca
// relativa ao documento, nunca `import()` sobre um bundle UMD), injeção ÚNICA
// com deduplicação de chamadas concorrentes, e RETRY depois de um erro — que é
// exatamente o que o baseline não tinha (`_pdfLibPromise` guardava a promise
// rejeitada para sempre, e o botão de PDF ficava quebrado até o reload).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPdfLib, resetPdfLibLoader, DEFAULT_PDF_LIB_URL, PDF_LIB_SCRIPT_ATTRIBUTE } from '../../../site/js/features/sheet/pdf/pdf-lib-loader.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * Documento dublê: registra os `<script>` injetados e permite disparar
 * `onload`/`onerror` na hora que o teste quiser.
 * @returns {object}
 */
function fakeDocument() {
  /** @type {Array<object>} */
  const scripts = [];
  const head = {
    /**
     * @param {object} node
     * @returns {void}
     */
    appendChild(node) {
      scripts.push(node);
    },
  };
  return {
    scripts,
    head,
    /**
     * @returns {object}
     */
    createElement() {
      return { src: '', onload: null, onerror: null, attributes: {}, setAttribute(nome, valor) {
        this.attributes[nome] = valor;
      } };
    },
  };
}

beforeEach(() => {
  resetPdfLibLoader();
});

describe('unit/sheet/pdf-lib-loader — compatibilidade com o vendor UMD', () => {
  test('a URL padrão é resolvida contra o MÓDULO e aponta para o vendor real', async () => {
    assert.match(DEFAULT_PDF_LIB_URL, /\/site\/js\/vendor\/pdf-lib\.min\.js$/);
    // O arquivo existe de verdade nesse caminho — um default que aponta para
    // lugar nenhum quebraria só no clique do jogador.
    const caminho = path.join(repoRoot, 'site/js/vendor/pdf-lib.min.js');
    const conteudo = await readFile(caminho, 'utf8');
    assert.ok(conteudo.length > 1000);
    assert.equal(conteudo.includes('export '), false, 'o vendor é UMD: `import()` sobre ele devolveria um namespace vazio');
  });

  test('não injeta nada quando `window.PDFLib` já existe', async () => {
    const documentRef = fakeDocument();
    const globalRef = { PDFLib: { PDFDocument: {} } };
    const resultado = await loadPdfLib({ documentRef, globalRef });
    assert.equal(resultado.ok, true);
    assert.equal(resultado.value, globalRef.PDFLib);
    assert.equal(documentRef.scripts.length, 0);
  });

  test('injeta UM único `<script>` e resolve com o global publicado', async () => {
    const documentRef = fakeDocument();
    const globalRef = {};
    const promessa = loadPdfLib({ documentRef, globalRef, scriptUrl: 'vendor.js' });
    assert.equal(documentRef.scripts.length, 1);
    assert.equal(documentRef.scripts[0].src, 'vendor.js');
    assert.equal(documentRef.scripts[0].attributes[PDF_LIB_SCRIPT_ATTRIBUTE], 'true');
    globalRef.PDFLib = { PDFDocument: {} };
    documentRef.scripts[0].onload();
    const resultado = await promessa;
    assert.equal(resultado.ok, true);
    assert.equal(resultado.value, globalRef.PDFLib);
  });

  test('duas chamadas CONCORRENTES compartilham a mesma injeção', async () => {
    const documentRef = fakeDocument();
    const globalRef = {};
    const a = loadPdfLib({ documentRef, globalRef, scriptUrl: 'vendor.js' });
    const b = loadPdfLib({ documentRef, globalRef, scriptUrl: 'vendor.js' });
    assert.equal(documentRef.scripts.length, 1, 'a segunda chamada não pode injetar um segundo script');
    globalRef.PDFLib = { PDFDocument: {} };
    documentRef.scripts[0].onload();
    const [ra, rb] = await Promise.all([a, b]);
    assert.equal(ra.ok, true);
    assert.equal(rb.ok, true);
    assert.equal(ra.value, rb.value);
  });

  test('erro de rede vira Result e a chamada SEGUINTE tenta de novo', async () => {
    const documentRef = fakeDocument();
    const globalRef = {};
    const primeira = loadPdfLib({ documentRef, globalRef, scriptUrl: 'vendor.js' });
    documentRef.scripts[0].onerror();
    const falha = await primeira;
    assert.equal(falha.ok, false);
    assert.equal(falha.error.code, 'PDF_LIB_SCRIPT_ERROR');

    // RETRY: o baseline ficava preso na promise rejeitada. Aqui uma segunda
    // chamada injeta de novo e consegue terminar.
    const segunda = loadPdfLib({ documentRef, globalRef, scriptUrl: 'vendor.js' });
    assert.equal(documentRef.scripts.length, 2, 'a falha precisa liberar uma nova tentativa');
    globalRef.PDFLib = { PDFDocument: {} };
    documentRef.scripts[1].onload();
    const sucesso = await segunda;
    assert.equal(sucesso.ok, true);
  });

  test('script que carrega mas não publica o global tem código PRÓPRIO', async () => {
    const documentRef = fakeDocument();
    const globalRef = {};
    const promessa = loadPdfLib({ documentRef, globalRef, scriptUrl: 'vendor.js' });
    documentRef.scripts[0].onload();
    const resultado = await promessa;
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'PDF_LIB_GLOBAL_MISSING');
  });

  test('sem documento, recusa nomeada em vez de exceção', async () => {
    const resultado = await loadPdfLib({ documentRef: null, globalRef: {} });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'PDF_LIB_DOCUMENT_UNAVAILABLE');
  });

  test('o fonte não usa `import()` nem caminho relativo ao documento', async () => {
    const fonte = await readFile(path.join(repoRoot, 'site/js/features/sheet/pdf/pdf-lib-loader.js'), 'utf8');
    const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.equal(/\bimport\s*\(/.test(codigo), false, '`import()` sobre um bundle UMD devolveria namespace vazio');
    assert.equal(codigo.includes("'js/vendor/"), false, 'caminho relativo ao documento quebra fora da raiz');
    assert.ok(codigo.includes('import.meta.url'), 'a URL precisa ser resolvida contra o módulo');
  });
});
