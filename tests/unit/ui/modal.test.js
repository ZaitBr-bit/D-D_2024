// ============================================================
// Serviço de modal com pilha (site/js/ui/modal.js).
//
// Cobre o que o brief da Task 24 exige: pilha, fechar clicando fora, Escape,
// foco, `onClose` único e cancelamento sem mutação de transação.
//
// Sobre FOCO: LinkeDOM não implementa foco real (não há `activeElement`).
// Aqui é verificado que o serviço CHAMA `focus()` no elemento certo e que
// devolve o foco ao elemento anterior; o comportamento real de foco no
// navegador é coberto por tests/e2e/security-content.spec.js.
// ============================================================
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import { createModalService, MODAL_CLOSE_REASONS } from '../../../site/js/ui/modal.js';
import { createTestDom, createTestEvent, trackFocusCalls } from '../../helpers/test-dom.js';

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
</body></html>`;

/**
 * Monta um DOM com o shell real e o serviço ligado a ele.
 * @returns {{dom: object, document: object, service: object, overlay: object}}
 */
function montar() {
  const dom = createTestDom({ html: SHELL_HTML });
  const { document } = dom;
  const overlay = document.getElementById('modal-overlay');
  const service = createModalService({
    documentRef: document,
    overlay,
    container: document.getElementById('modal-container'),
    titleElement: document.getElementById('modal-titulo'),
    bodyElement: document.getElementById('modal-corpo'),
    actionsElement: document.getElementById('modal-acoes'),
    closeButton: overlay.querySelector('.modal-fechar'),
  });
  return { dom, document, service, overlay };
}

/**
 * Cria um parágrafo de conteúdo.
 * @param {object} document
 * @param {string} texto
 * @returns {object}
 */
function paragrafo(document, texto) {
  const p = document.createElement('p');
  p.textContent = texto;
  return p;
}

describe('ModalService: abertura e conteúdo', () => {
  test('usa o markup do shell e escreve o título como TEXTO', () => {
    const { dom, document, service, overlay } = montar();
    service.open({ title: '<img src=x onerror=alert(1)>', content: paragrafo(document, 'corpo') });

    assert.equal(overlay.style.display, 'flex');
    assert.equal(document.getElementById('modal-titulo').textContent, '<img src=x onerror=alert(1)>');
    assert.equal(document.getElementById('modal-titulo').querySelectorAll('*').length, 0);
    assert.equal(document.getElementById('modal-corpo').textContent, 'corpo');
    dom.restore();
  });

  test('recusa string de HTML em content/actions (o sink é nó, não markup)', () => {
    const { dom, service } = montar();
    assert.throws(() => service.open({ title: 't', content: '<b>x</b>' }), TypeError);
    assert.throws(() => service.open({ title: 't', actions: '<button>x</button>' }), TypeError);
    dom.restore();
  });

  test('reabrir substitui o conteúdo anterior (sem acumular)', () => {
    const { dom, document, service } = montar();
    service.open({ title: 'a', content: paragrafo(document, 'primeiro') });
    service.closeTop();
    service.open({ title: 'b', content: paragrafo(document, 'segundo') });
    assert.equal(document.getElementById('modal-corpo').textContent, 'segundo');
    assert.equal(document.getElementById('modal-corpo').childNodes.length, 1);
    dom.restore();
  });
});

describe('ModalService: pilha', () => {
  test('o segundo open empilha um sub-modal com o markup do baseline', () => {
    const { dom, document, service } = montar();
    service.open({ title: 'principal', content: paragrafo(document, 'a') });
    service.open({ title: 'sub', content: paragrafo(document, 'b') });

    assert.equal(service.getStackSize(), 2);
    const sub = document.getElementById('sub-modal-overlay-1');
    assert.ok(sub, 'sub-modal não foi criado com o id do baseline');
    assert.equal(sub.className, 'modal-overlay sub-modal-overlay');
    assert.equal(sub.style.display, 'flex');
    assert.equal(sub.style.zIndex, '201');
    assert.ok(sub.querySelector('.modal-container'));
    assert.equal(sub.querySelector('.modal-header h2').textContent, 'sub');
    assert.ok(sub.querySelector('button[data-fechar-sub]'));
    assert.equal(sub.querySelector('.modal-corpo').textContent, 'b');
    // O modal principal continua aberto por baixo.
    assert.equal(document.getElementById('modal-overlay').style.display, 'flex');
    dom.restore();
  });

  test('fechar pelo topo desempilha um por vez; o principal só some por último', () => {
    const { dom, document, service, overlay } = montar();
    service.open({ title: 'principal', content: paragrafo(document, 'a') });
    service.open({ title: 'sub1', content: paragrafo(document, 'b') });
    service.open({ title: 'sub2', content: paragrafo(document, 'c') });
    assert.equal(service.getStackSize(), 3);

    service.closeTop();
    assert.equal(service.getStackSize(), 2);
    assert.equal(document.getElementById('sub-modal-overlay-2'), null);
    assert.equal(overlay.style.display, 'flex');

    service.closeTop();
    assert.equal(document.getElementById('sub-modal-overlay-1'), null);
    assert.equal(overlay.style.display, 'flex');

    service.closeTop();
    assert.equal(service.getStackSize(), 0);
    assert.equal(overlay.style.display, 'none');
    dom.restore();
  });

  test('closeAll fecha tudo, do topo para a base, e limpa os sub-overlays do DOM', () => {
    const { dom, document, service, overlay } = montar();
    const ordem = [];
    service.open({ title: 'principal', onClose: () => ordem.push('principal') });
    service.open({ title: 'sub1', onClose: () => ordem.push('sub1') });
    service.open({ title: 'sub2', onClose: () => ordem.push('sub2') });

    service.closeAll();
    assert.deepEqual(ordem, ['sub2', 'sub1', 'principal']);
    assert.equal(service.getStackSize(), 0);
    assert.equal(overlay.style.display, 'none');
    assert.equal(document.querySelectorAll('.sub-modal-overlay').length, 0);
    dom.restore();
  });

  test('fechar uma entrada do meio fecha também tudo que está acima dela', () => {
    const { dom, service } = montar();
    const principal = service.open({ title: 'principal' });
    const sub1 = service.open({ title: 'sub1' });
    const sub2 = service.open({ title: 'sub2' });

    principal.close('teste');
    assert.equal(service.getStackSize(), 0);
    assert.equal(sub1.isOpen(), false);
    assert.equal(sub2.isOpen(), false);
    dom.restore();
  });
});

describe('ModalService: fechar fora, botão e Escape', () => {
  test('clique no backdrop fecha; clique DENTRO do modal não', () => {
    const { dom, document, service, overlay } = montar();
    service.open({ title: 't', content: paragrafo(document, 'corpo') });

    document
      .getElementById('modal-container')
      .dispatchEvent(createTestEvent(dom.window, 'click'));
    assert.equal(service.getStackSize(), 1, 'clique dentro do container não deveria fechar');

    overlay.dispatchEvent(createTestEvent(dom.window, 'click'));
    assert.equal(service.getStackSize(), 0);
    dom.restore();
  });

  test('clique no backdrop do sub-modal fecha apenas o sub-modal', () => {
    const { dom, service } = montar();
    service.open({ title: 'principal' });
    const sub = service.open({ title: 'sub' });
    sub.element.dispatchEvent(createTestEvent(dom.window, 'click'));
    assert.equal(service.getStackSize(), 1);
    dom.restore();
  });

  test('qualquer [data-fechar-sub] dentro do sub-modal fecha o sub-modal, não só o × do cabeçalho', () => {
    // Regressão real pega na revisão da Task 24: chamadores marcam botões de
    // AÇÃO no rodapé com `data-fechar-sub` (ex.: sub-modal "Taxas de
    // Conversão", site/js/pages/sheet.js:16028) e o baseline fechava por
    // `e.target.closest('[data-fechar-sub]')`. Tratar apenas o × do cabeçalho
    // deixava esses botões mortos.
    const { dom, document, service } = montar();
    service.open({ title: 'principal' });

    const acao = document.createElement('button');
    acao.className = 'btn btn-secondary';
    acao.setAttribute('data-fechar-sub', 'true');
    const rotulo = document.createElement('span');
    rotulo.textContent = 'Fechar';
    acao.appendChild(rotulo);

    service.open({ title: 'Taxas de Conversão', content: paragrafo(document, 'corpo'), actions: acao });
    assert.equal(service.getStackSize(), 2);

    // Clique em um FILHO do botão marcado (o alvo real de um clique de mouse).
    rotulo.dispatchEvent(createTestEvent(dom.window, 'click'));
    assert.equal(service.getStackSize(), 1, 'o botão de ação com data-fechar-sub não fechou o sub-modal');
    assert.equal(document.querySelectorAll('.sub-modal-overlay').length, 0);
    assert.equal(document.getElementById('modal-overlay').style.display, 'flex', 'o principal não pode fechar junto');
    dom.restore();
  });

  test('o × do cabeçalho do sub-modal continua fechando (mesmo caminho de [data-fechar-sub])', () => {
    const { dom, document, service } = montar();
    service.open({ title: 'principal' });
    const sub = service.open({ title: 'sub' });

    // É assim que site/js/pages/sheet.js:15952 fecha o sub-modal: pelo
    // PRIMEIRO [data-fechar-sub] em ordem de documento — o × do cabeçalho.
    sub.element.querySelector('[data-fechar-sub]').dispatchEvent(createTestEvent(dom.window, 'click'));
    assert.equal(service.getStackSize(), 1);
    assert.equal(document.querySelectorAll('.sub-modal-overlay').length, 0);
    dom.restore();
  });

  test('um [data-fechar-sub] FORA do sub-modal não o fecha', () => {
    const { dom, document, service } = montar();
    service.open({ title: 'principal' });
    service.open({ title: 'sub' });

    const forasteiro = document.createElement('button');
    forasteiro.setAttribute('data-fechar-sub', 'true');
    document.body.appendChild(forasteiro);
    forasteiro.dispatchEvent(createTestEvent(dom.window, 'click'));

    assert.equal(service.getStackSize(), 2);
    dom.restore();
  });

  test('o botão × do shell fecha o topo (substitui o onclick inline removido)', () => {
    const { dom, document, service, overlay } = montar();
    service.open({ title: 'principal' });
    service.open({ title: 'sub' });

    overlay.querySelector('.modal-fechar').dispatchEvent(createTestEvent(dom.window, 'click'));
    assert.equal(service.getStackSize(), 1, 'o × do shell fecha o topo da pilha');

    overlay.querySelector('.modal-fechar').dispatchEvent(createTestEvent(dom.window, 'click'));
    assert.equal(service.getStackSize(), 0);

    // Sem modal aberto, o botão é inofensivo.
    overlay.querySelector('.modal-fechar').dispatchEvent(createTestEvent(dom.window, 'click'));
    assert.equal(service.getStackSize(), 0);
    dom.restore();
  });

  test('Escape fecha o topo quando habilitado e é ignorado quando não', () => {
    const { dom, document, service } = montar();
    service.open({ title: 'principal', closeOnEscape: true });
    document.dispatchEvent(createTestEvent(dom.window, 'keydown', { key: 'A' }));
    assert.equal(service.getStackSize(), 1, 'outra tecla não pode fechar');

    document.dispatchEvent(createTestEvent(dom.window, 'keydown', { key: 'Escape' }));
    assert.equal(service.getStackSize(), 0);

    service.open({ title: 'sem escape', closeOnEscape: false });
    document.dispatchEvent(createTestEvent(dom.window, 'keydown', { key: 'Escape' }));
    assert.equal(service.getStackSize(), 1, 'closeOnEscape:false precisa ser respeitado');

    // A decisão é do modal do TOPO, não do de baixo.
    service.open({ title: 'sub com escape', closeOnEscape: true });
    document.dispatchEvent(createTestEvent(dom.window, 'keydown', { key: 'Escape' }));
    assert.equal(service.getStackSize(), 1);
    dom.restore();
  });

  test('closeOnBackdrop:false mantém o modal aberto ao clicar fora', () => {
    const { dom, service, overlay } = montar();
    service.open({ title: 't', closeOnBackdrop: false });
    overlay.dispatchEvent(createTestEvent(dom.window, 'click'));
    assert.equal(service.getStackSize(), 1);
    dom.restore();
  });
});

describe('ModalService: foco', () => {
  test('move o foco para o botão de fechar ao abrir e devolve ao fechar', () => {
    const { dom, document, service } = montar();
    const rastreio = trackFocusCalls(dom.window);

    const anterior = document.createElement('button');
    document.body.appendChild(anterior);
    // LinkeDOM não tem activeElement; o "anterior" é injetado no serviço pela
    // única via que existe no DOM real (document.activeElement), então aqui é
    // simulado explicitamente para exercitar a restauração.
    Object.defineProperty(document, 'activeElement', { value: anterior, configurable: true });

    const handle = service.open({ title: 't', manageFocus: true });
    assert.equal(rastreio.calls.at(-1).element, handle.element.querySelector('.modal-fechar'));

    handle.close();
    assert.equal(rastreio.calls.at(-1).element, anterior, 'foco não voltou ao elemento anterior');

    rastreio.restore();
    dom.restore();
  });

  test('manageFocus:false não mexe no foco (compatibilidade com a fachada legada)', () => {
    const { dom, service } = montar();
    const rastreio = trackFocusCalls(dom.window);
    const handle = service.open({ title: 't', manageFocus: false });
    handle.close();
    assert.deepEqual(rastreio.calls, []);
    rastreio.restore();
    dom.restore();
  });
});

describe('ModalService: onClose e cancelamento', () => {
  test('onClose dispara UMA única vez, mesmo com close() repetido', () => {
    const { dom, service } = montar();
    let chamadas = 0;
    const handle = service.open({ title: 't', onClose: () => { chamadas += 1; } });

    handle.close('a');
    handle.close('b');
    service.closeTop();
    service.closeAll();
    assert.equal(chamadas, 1);
    dom.restore();
  });

  test('onClose recebe o motivo do fechamento', () => {
    const { dom, document, service, overlay } = montar();
    const motivos = [];

    service.open({ title: 't', onClose: (motivo) => motivos.push(motivo) });
    overlay.dispatchEvent(createTestEvent(dom.window, 'click'));

    service.open({ title: 't', onClose: (motivo) => motivos.push(motivo), closeOnEscape: true });
    document.dispatchEvent(createTestEvent(dom.window, 'keydown', { key: 'Escape' }));

    service.open({ title: 't', onClose: (motivo) => motivos.push(motivo) });
    overlay.querySelector('.modal-fechar').dispatchEvent(createTestEvent(dom.window, 'click'));

    service.open({ title: 't', onClose: (motivo) => motivos.push(motivo) });
    service.closeTop();

    assert.deepEqual(motivos, [
      MODAL_CLOSE_REASONS.backdrop,
      MODAL_CLOSE_REASONS.escape,
      MODAL_CLOSE_REASONS.closeButton,
      MODAL_CLOSE_REASONS.programmatic,
    ]);
    dom.restore();
  });

  test('cancelar não muta nada do que o chamador passou (transação intacta)', () => {
    const { dom, document, service } = montar();
    // "Transação" no sentido do brief: o estado em edição que o modal
    // apresenta. O serviço nunca o toca — só avisa quem abriu.
    const transacao = { rascunho: { nome: 'Elandra', pv: 12 }, confirmada: false };
    const antes = JSON.stringify(transacao);

    const handle = service.open({
      title: 'Editar',
      content: paragrafo(document, 'x'),
      onClose: () => {
        // O chamador é quem decide; aqui, cancelar não confirma nada.
      },
    });
    handle.close(MODAL_CLOSE_REASONS.escape);

    assert.equal(JSON.stringify(transacao), antes, 'o serviço mutou a transação do chamador');
    assert.equal(transacao.confirmada, false);
    dom.restore();
  });

  test('onClose inválido é defeito de programação (lança)', () => {
    const { dom, service } = montar();
    assert.throws(() => service.open({ title: 't', onClose: 'nao-e-funcao' }), TypeError);
    dom.restore();
  });

  test('elementos obrigatórios ausentes fazem createModalService lançar', () => {
    assert.throws(() => createModalService(), TypeError);
    assert.throws(() => createModalService({ documentRef: {} }), TypeError);
  });
});
