// ============================================================
// Serviço de toast (site/js/ui/toast.js).
// ============================================================
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { createToastService } from '../../../site/js/ui/toast.js';
import { createTestDom } from '../../helpers/test-dom.js';
import { getRepoRoot } from '../../helpers/legacy-markdown.js';

const malicious = JSON.parse(
  fs.readFileSync(path.join(getRepoRoot(), 'tests', 'fixtures', 'security', 'malicious-content.json'), 'utf8'),
);

const HTML = '<!doctype html><html><body><div id="toast-container" class="toast-container"></div></body></html>';

/**
 * Monta o serviço com timers controlados pelo teste.
 * @returns {{dom: object, service: object, container: object, disparar: () => void}}
 */
function montar() {
  const dom = createTestDom({ html: HTML });
  const container = dom.document.getElementById('toast-container');
  const agendados = [];
  const service = createToastService({
    documentRef: dom.document,
    container,
    scheduleTimeout: (fn) => {
      agendados.push(fn);
      return agendados.length;
    },
    cancelTimeout: (handle) => {
      agendados[handle - 1] = null;
    },
  });
  return {
    dom,
    service,
    container,
    disparar: () => {
      for (const fn of [...agendados]) {
        if (fn) fn();
      }
    },
  };
}

describe('createToastService', () => {
  test('a mensagem entra como TEXTO, nunca como markup', () => {
    const { dom, service, container } = montar();
    for (const caso of malicious.textoEAtributo) {
      service.show(caso.payload, 'error');
    }
    assert.equal(container.querySelectorAll('*:not(.toast)').length, 0, 'apareceu elemento dentro do toast');
    for (const toast of container.querySelectorAll('.toast')) {
      assert.equal(toast.children.length, 0);
    }
    assert.ok(container.textContent.includes('<script>window.__xss = 1;</script>'));
    dom.restore();
  });

  test('mantém as classes usadas hoje e neutraliza tipo desconhecido', () => {
    const { dom, service, container } = montar();
    for (const tipo of ['success', 'error', 'info', 'warning', 'danger', '']) {
      service.show('x', tipo);
    }
    // `.trim()`: o serviço monta `toast ${tipo}` (idêntico ao baseline, que
    // deixa um espaço à direita quando o tipo é vazio), mas o LinkeDOM
    // normaliza o espaço final no getter de className. O espaço não tem
    // efeito nenhum no seletor de CSS.
    const classes = [...container.querySelectorAll('div')].map((el) => el.className.trim());
    assert.deepEqual(classes, ['toast success', 'toast error', 'toast info', 'toast warning', 'toast danger', 'toast']);

    container.replaceChildren();
    service.show('x', 'toast" onmouseover="alert(1)');
    assert.equal(container.firstChild.className.trim(), 'toast');
    dom.restore();
  });

  test('some sozinho depois do tempo e pode ser dispensado antes', () => {
    const { dom, service, container, disparar } = montar();
    const primeiro = service.show('a');
    service.show('b');
    assert.equal(service.getActiveCount(), 2);

    primeiro.dismiss();
    assert.equal(service.getActiveCount(), 1);
    assert.equal(container.querySelectorAll('.toast').length, 1);

    disparar();
    assert.equal(service.getActiveCount(), 0);
    assert.equal(container.querySelectorAll('.toast').length, 0);
    dom.restore();
  });

  test('dispensar duas vezes não quebra nem conta a menos', () => {
    const { dom, service, disparar } = montar();
    const toast = service.show('a');
    toast.dismiss();
    toast.dismiss();
    disparar();
    assert.equal(service.getActiveCount(), 0);
    dom.restore();
  });

  test('elementos obrigatórios ausentes fazem createToastService lançar', () => {
    assert.throws(() => createToastService(), TypeError);
    assert.throws(() => createToastService({ documentRef: {} }), TypeError);
  });
});
