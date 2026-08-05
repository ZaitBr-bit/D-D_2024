// ============================================================
// Testes de `scripts/check-inline-handlers.mjs` (Task 37): detecção de
// handlers inline em HTML/JS e de globais `window.*` fora da allowlist.
// ============================================================
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeInlineHandlers, WINDOW_GLOBAL_ALLOWLIST } from '../../../scripts/check-inline-handlers.mjs';

describe('check-inline-handlers: handlers inline', () => {
  test('onclick em HTML é violação inline-handler', () => {
    const html = '<button class="btn" onclick="fecharModal()">Ok</button>';
    const violations = analyzeInlineHandlers(html, { kind: 'html' });
    assert.equal(violations.length, 1);
    assert.equal(violations[0].rule, 'inline-handler');
  });

  test('onchange/oninput/onsubmit em template JS são violações', () => {
    const js = 'const html = `<input onchange="x()"> <form onsubmit="y()"> <input oninput="z()">`;';
    const rules = analyzeInlineHandlers(js, { kind: 'js' }).map((v) => v.rule);
    assert.deepEqual(rules, ['inline-handler', 'inline-handler', 'inline-handler']);
  });

  test('data-action e atributos comuns NÃO são violação', () => {
    const html = '<button data-action="fechar-modal" title="confirmation=x">Ok</button>';
    assert.deepEqual(analyzeInlineHandlers(html, { kind: 'html' }), []);
  });

  test('comentário HTML mencionando onclick NÃO é violação', () => {
    const html = '<!-- antes era onclick="fecharModal()" --><button>Ok</button>';
    assert.deepEqual(analyzeInlineHandlers(html, { kind: 'html' }), []);
  });

  test('comentário JS mencionando onclick= NÃO é violação', () => {
    const js = '// o legado usava onclick="fecharModal()"\nconst x = 1;';
    assert.deepEqual(analyzeInlineHandlers(js, { kind: 'js' }), []);
  });
});

describe('check-inline-handlers: globais window.*', () => {
  test('atribuição fora da allowlist é violação window-global', () => {
    const js = 'window.minhaGlobalNova = () => {};';
    const violations = analyzeInlineHandlers(js, { kind: 'js' });
    assert.equal(violations.length, 1);
    assert.equal(violations[0].rule, 'window-global');
  });

  test('as quatro globais da allowlist temporária passam', () => {
    for (const nome of WINDOW_GLOBAL_ALLOWLIST) {
      const js = `window.${nome} = fn;`;
      assert.deepEqual(analyzeInlineHandlers(js, { kind: 'js' }), [], nome);
    }
  });

  test('comparação (window.x === y) NÃO é violação', () => {
    const js = 'if (window.algo === 1) { fazer(); }';
    assert.deepEqual(analyzeInlineHandlers(js, { kind: 'js' }), []);
  });

  test('window.location = ... é estado do navegador, não registro de global', () => {
    const js = "window.location = '#home';";
    assert.deepEqual(analyzeInlineHandlers(js, { kind: 'js' }), []);
  });

  test('a allowlist congela exatamente os quatro globais da Task 34', () => {
    assert.deepEqual(
      [...WINDOW_GLOBAL_ALLOWLIST].sort(),
      ['definirTituloHeader', 'fecharModal', 'fecharModalTodos', 'navegar'],
    );
  });
});
