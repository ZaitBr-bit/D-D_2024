// ============================================================
// A fachada de `site/js/utils.js` DELEGA de verdade (Task 24).
//
// Este arquivo existe por causa de um padrão de bug já visto neste projeto:
// o comentário diz "delega para X", o código mantém uma segunda
// implementação, e nenhum teste percebe. Cada caso aqui é escolhido para
// FALHAR se `utils.js` voltar a ter lógica própria: o comportamento
// verificado é observável APENAS na implementação nova, nunca na do baseline.
// ============================================================
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createTestDom, createTestEvent } from '../../helpers/test-dom.js';
import { escapeHtml } from '../../../site/js/ui/html.js';
import { renderSafeMarkdownToHtml } from '../../../site/js/ui/markdown.js';
import { loadBaselineMdParaHtml } from '../../helpers/legacy-markdown.js';

const SHELL_HTML = `<!doctype html><html><body>
  <div id="modal-overlay" class="modal-overlay" style="display:none">
    <div id="modal-container" class="modal-container">
      <div id="modal-header" class="modal-header">
        <h2 id="modal-titulo"></h2>
        <button class="modal-fechar">&times;</button>
      </div>
      <div id="modal-corpo" class="modal-corpo"></div>
      <div id="modal-acoes" class="modal-acoes"></div>
    </div>
  </div>
  <div id="toast-container" class="toast-container"></div>
</body></html>`;

let dom;
let utils;

before(async () => {
  dom = createTestDom({ html: SHELL_HTML });
  // `utils.js` é avaliado com os globais já instalados (é assim que ele roda
  // no navegador); o import é dinâmico justamente para respeitar essa ordem.
  utils = await import('../../../site/js/utils.js');
});

after(() => {
  dom.restore();
});

describe('utils.escHtml delega para ui/html.js#escapeHtml', () => {
  test('produz exatamente o mesmo resultado, inclusive nos casos de borda', () => {
    const casos = [
      null,
      undefined,
      '',
      0,
      false,
      '<script>alert(1)</script>',
      `aspas " e ' e & e < e >`,
      'Ação — 3d6 🎲',
      '&amp;já escapado',
    ];
    for (const caso of casos) {
      assert.equal(utils.escHtml(caso), escapeHtml(caso), `divergiu para ${JSON.stringify(caso)}`);
    }
  });
});

describe('utils.mdParaHtml delega para ui/markdown.js', () => {
  test('produz byte a byte o mesmo que renderSafeMarkdownToHtml', () => {
    const texto = '### T\n\n**a** *b*\n\n- x\n- y\n\n|c|d|';
    assert.equal(utils.mdParaHtml(texto), renderSafeMarkdownToHtml(dom.document, texto));
  });

  test('tem o comportamento NOVO onde o baseline diferia (prova de delegação real)', () => {
    // Controles C0 só são removidos pelo renderizador novo; o `mdParaHtml`
    // do baseline os mantinha. Se a fachada tivesse mantido uma cópia da
    // implementação antiga, esta asserção falharia.
    const comControle = 'a\u0001b';
    const baseline = loadBaselineMdParaHtml();
    assert.ok(baseline(comControle).includes('\u0001'), 'premissa do teste: o baseline mantinha o controle');
    assert.equal(utils.mdParaHtml(comControle), '<p>ab</p>');
  });

  test('mantém o contrato de entrada vazia', () => {
    assert.equal(utils.mdParaHtml(''), '');
    assert.equal(utils.mdParaHtml(null), '');
    assert.equal(utils.mdParaHtml(undefined), '');
  });
});

describe('utils.toast delega para ui/toast.js', () => {
  test('cria o toast no contêiner do shell com a mensagem como texto', () => {
    const container = dom.document.getElementById('toast-container');
    container.replaceChildren();
    utils.toast('<b>oi</b>', 'success');
    const toast = container.querySelector('.toast');
    assert.ok(toast);
    assert.equal(toast.className.trim(), 'toast success');
    assert.equal(toast.textContent, '<b>oi</b>');
    assert.equal(toast.querySelectorAll('*').length, 0);
    container.replaceChildren();
  });
});

describe('utils.abrirModal/fecharModal delegam para ui/modal.js', () => {
  test('abre no markup do shell e fecha pela pilha', () => {
    const { document } = dom;
    utils.abrirModal('Título', '<p>corpo</p>', '<button>ok</button>');
    assert.equal(document.getElementById('modal-overlay').style.display, 'flex');
    assert.equal(document.getElementById('modal-titulo').textContent, 'Título');
    assert.equal(document.getElementById('modal-corpo').textContent, 'corpo');

    utils.fecharModal();
    assert.equal(document.getElementById('modal-overlay').style.display, 'none');
  });

  test('o título do SUB-modal vira texto (o baseline o injetava como HTML)', () => {
    const { document } = dom;
    utils.abrirModal('Principal', '<p>a</p>');
    utils.abrirModal('<img src=x onerror=alert(1)>', '<p>b</p>');

    const sub = document.getElementById('sub-modal-overlay-1');
    assert.ok(sub, 'sub-modal não foi criado');
    assert.equal(sub.querySelector('.modal-header h2').textContent, '<img src=x onerror=alert(1)>');
    assert.equal(sub.querySelectorAll('.modal-header img').length, 0, 'o título voltou a ser interpretado como HTML');

    utils.fecharModalTodos();
    assert.equal(document.querySelectorAll('.sub-modal-overlay').length, 0);
    assert.equal(document.getElementById('modal-overlay').style.display, 'none');
  });

  // Task 37: o religamento de `onclick="fecharModal()"` legado foi removido
  // junto com o último produtor desse markup; a forma declarativa
  // `data-action="fechar-modal"` é o contrato atual (e vale para o modal
  // principal E para sub-modais — fecha o PRÓPRIO modal, nunca a pilha toda).
  test('botão com data-action="fechar-modal" no sub-modal fecha só o sub-modal', () => {
    const { document } = dom;
    utils.abrirModal('Principal', '<p>a</p>');
    utils.abrirModal('Sub', '<p>b</p>', '<button id="btn-fechar-sub" data-action="fechar-modal">Fechar</button>');

    const botao = document.getElementById('btn-fechar-sub');
    botao.dispatchEvent(createTestEvent(dom.window, 'click'));

    assert.equal(document.querySelectorAll('.sub-modal-overlay').length, 0);
    assert.equal(document.getElementById('modal-overlay').style.display, 'flex', 'o principal não deveria fechar junto');
    utils.fecharModalTodos();
  });

  test('botão com data-action="fechar-modal" no modal PRINCIPAL fecha o principal', () => {
    const { document } = dom;
    utils.abrirModal('Principal', '<p>a</p>', '<button id="btn-fechar-principal" data-action="fechar-modal">Cancelar</button>');

    document.getElementById('btn-fechar-principal').dispatchEvent(createTestEvent(dom.window, 'click'));
    assert.equal(document.getElementById('modal-overlay').style.display, 'none');
  });

  test('sub-modal de "Taxas de Conversão": o botão de ação data-fechar-sub fecha o sub-modal', () => {
    // Repro exata do cenário que regrediu (Ficha -> Carteira -> Taxas de
    // Conversão), montado pela fachada real, com o MESMO markup de ações de
    // site/js/pages/sheet.js:16028.
    const { document } = dom;
    utils.abrirModal('Carteira', '<p>moedas</p>');
    utils.abrirModal(
      'Taxas de Conversão',
      '<p>taxas</p>',
      '<button class="btn btn-secondary" data-fechar-sub="true">Fechar</button>',
    );

    const sub = document.getElementById('sub-modal-overlay-1');
    assert.ok(sub, 'sub-modal não foi criado');
    const botao = sub.querySelector('.modal-acoes [data-fechar-sub]');
    assert.ok(botao, 'o botão de ação com data-fechar-sub não chegou ao sub-modal');

    botao.dispatchEvent(createTestEvent(dom.window, 'click'));

    assert.equal(document.querySelectorAll('.sub-modal-overlay').length, 0, 'o sub-modal não fechou');
    assert.equal(document.getElementById('modal-overlay').style.display, 'flex', 'o principal não podia fechar junto');
    utils.fecharModalTodos();
  });

  test('onClose do modal principal dispara uma vez; em sub-modal é ignorado (como no baseline)', () => {
    let principal = 0;
    let sub = 0;
    utils.abrirModal('Principal', '<p>a</p>', '', () => { principal += 1; });
    utils.abrirModal('Sub', '<p>b</p>', '', () => { sub += 1; });

    utils.fecharModalTodos();
    assert.equal(principal, 1);
    assert.equal(sub, 0, 'o baseline descartava o onClose de sub-modais; a fachada precisa manter isso');
  });

  test('o × do shell fecha o modal sem nenhum onclick inline', () => {
    const { document } = dom;
    utils.abrirModal('Principal', '<p>a</p>');
    const botao = document.querySelector('#modal-overlay .modal-fechar');
    assert.equal(botao.getAttribute('onclick'), null);
    botao.dispatchEvent(createTestEvent(dom.window, 'click'));
    assert.equal(document.getElementById('modal-overlay').style.display, 'none');
  });
});
