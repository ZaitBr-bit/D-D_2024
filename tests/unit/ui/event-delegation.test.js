// ============================================================
// Delegação de eventos e o contrato UiEventDecision
// (site/js/ui/event-delegation.js).
// ============================================================
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  delegate,
  applyUiEventDecision,
  createUiEventDecision,
  isUiEventDecision,
  NO_UI_EVENT_DECISION,
} from '../../../site/js/ui/event-delegation.js';
import { createTestDom, createTestEvent } from '../../helpers/test-dom.js';

const HTML = `<!doctype html><html><body>
  <div id="fora"><button class="alvo" id="botao-fora">fora</button></div>
  <div id="raiz">
    <button class="alvo" id="a">A</button>
    <div id="embrulho"><button class="alvo" id="b"><span id="dentro">B</span></button></div>
    <button id="c">C</button>
  </div>
</body></html>`;

describe('delegate', () => {
  test('chama o handler com o elemento que casou, inclusive a partir de um filho', () => {
    const dom = createTestDom({ html: HTML });
    const { document } = dom;
    const chamadas = [];
    const remover = delegate(document.getElementById('raiz'), 'click', '.alvo', (evento, elemento) => {
      chamadas.push(elemento.id);
    });

    document.getElementById('a').dispatchEvent(createTestEvent(dom.window, 'click'));
    document.getElementById('dentro').dispatchEvent(createTestEvent(dom.window, 'click'));
    document.getElementById('c').dispatchEvent(createTestEvent(dom.window, 'click'));

    assert.deepEqual(chamadas, ['a', 'b']);
    remover();
    dom.restore();
  });

  test('não dispara para alvos fora da raiz', () => {
    const dom = createTestDom({ html: HTML });
    const { document } = dom;
    let chamou = false;
    delegate(document.getElementById('raiz'), 'click', '.alvo', () => { chamou = true; });
    document.getElementById('botao-fora').dispatchEvent(createTestEvent(dom.window, 'click'));
    assert.equal(chamou, false);
    dom.restore();
  });

  test('a função devolvida remove o listener e é idempotente', () => {
    const dom = createTestDom({ html: HTML });
    const { document } = dom;
    let chamadas = 0;
    const remover = delegate(document.getElementById('raiz'), 'click', '.alvo', () => { chamadas += 1; });

    document.getElementById('a').dispatchEvent(createTestEvent(dom.window, 'click'));
    remover();
    remover();
    document.getElementById('a').dispatchEvent(createTestEvent(dom.window, 'click'));
    assert.equal(chamadas, 1);
    dom.restore();
  });

  test('sobrevive a re-render: elementos criados depois do registro também disparam', () => {
    const dom = createTestDom({ html: HTML });
    const { document } = dom;
    const raiz = document.getElementById('raiz');
    let chamadas = 0;
    delegate(raiz, 'click', '[data-acao="voltar-home"]', () => { chamadas += 1; });

    raiz.replaceChildren();
    const novo = document.createElement('button');
    novo.setAttribute('data-acao', 'voltar-home');
    raiz.appendChild(novo);
    novo.dispatchEvent(createTestEvent(dom.window, 'click'));

    assert.equal(chamadas, 1);
    dom.restore();
  });

  test('argumentos inválidos são defeito de programação (lançam)', () => {
    const dom = createTestDom({ html: HTML });
    const raiz = dom.document.getElementById('raiz');
    assert.throws(() => delegate(null, 'click', '.x', () => {}), TypeError);
    assert.throws(() => delegate(raiz, '', '.x', () => {}), TypeError);
    assert.throws(() => delegate(raiz, 'click', '', () => {}), TypeError);
    assert.throws(() => delegate(raiz, 'click', '.x', null), TypeError);
    dom.restore();
  });
});

describe('UiEventDecision', () => {
  test('createUiEventDecision normaliza e congela', () => {
    const decisao = createUiEventDecision({ intent: { type: 'abrir' } });
    assert.deepEqual(decisao, { intent: { type: 'abrir' }, preventDefault: false, stopPropagation: false });
    assert.ok(Object.isFrozen(decisao));
    assert.deepEqual(NO_UI_EVENT_DECISION, { intent: null, preventDefault: false, stopPropagation: false });
    assert.throws(() => createUiEventDecision({ preventDefault: 'sim' }), TypeError);
  });

  test('isUiEventDecision só aceita o formato completo', () => {
    assert.equal(isUiEventDecision(NO_UI_EVENT_DECISION), true);
    assert.equal(isUiEventDecision({ intent: null }), false);
    assert.equal(isUiEventDecision(null), false);
    assert.equal(isUiEventDecision({ intent: null, preventDefault: 1, stopPropagation: false }), false);
  });

  test('applyUiEventDecision aplica exatamente o que a decisão descreve', () => {
    const dom = createTestDom({ html: HTML });
    const { document } = dom;

    const semEfeito = createTestEvent(dom.window, 'click');
    applyUiEventDecision(semEfeito, createUiEventDecision({ intent: { type: 'x' } }));
    assert.equal(semEfeito.defaultPrevented, false);

    const comPrevent = createTestEvent(dom.window, 'click');
    applyUiEventDecision(comPrevent, createUiEventDecision({ preventDefault: true }));
    assert.equal(comPrevent.defaultPrevented, true);

    // stopPropagation: o clique não deve chegar ao ancestral.
    let ancestralViu = 0;
    document.getElementById('raiz').addEventListener('click', () => { ancestralViu += 1; });
    document.getElementById('embrulho').addEventListener('click', (evento) => {
      applyUiEventDecision(evento, createUiEventDecision({ stopPropagation: true }));
    });
    document.getElementById('b').dispatchEvent(createTestEvent(dom.window, 'click'));
    assert.equal(ancestralViu, 0);

    dom.restore();
  });

  test('decisão malformada lança em vez de ser silenciosamente ignorada', () => {
    const dom = createTestDom({ html: HTML });
    const evento = createTestEvent(dom.window, 'click');
    assert.throws(() => applyUiEventDecision(evento, null), TypeError);
    assert.throws(() => applyUiEventDecision(evento, { intent: null }), TypeError);
    assert.throws(() => applyUiEventDecision({}, NO_UI_EVENT_DECISION), TypeError);
    dom.restore();
  });

  test('o renderizador descreve a intenção; só o controller toca no evento', () => {
    // Este é o contrato que as Tasks 25-32 vão consumir: um "renderizador"
    // puro devolve a decisão sem receber o evento, e o controller aplica.
    const dom = createTestDom({ html: HTML });
    const renderizador = (elemento) =>
      createUiEventDecision({ intent: { type: 'abrir-magia', id: elemento.id }, preventDefault: true });

    const aplicadas = [];
    delegate(dom.document.getElementById('raiz'), 'click', '.alvo', (evento, elemento) => {
      const decisao = renderizador(elemento);
      applyUiEventDecision(evento, decisao);
      aplicadas.push(decisao.intent);
    });

    const evento = createTestEvent(dom.window, 'click');
    dom.document.getElementById('a').dispatchEvent(evento);

    assert.deepEqual(aplicadas, [{ type: 'abrir-magia', id: 'a' }]);
    assert.equal(evento.defaultPrevented, true);
    dom.restore();
  });
});
