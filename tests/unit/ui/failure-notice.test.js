// ============================================================
// Aviso de recusa (site/js/ui/failure-notice.js), Task 28b.
//
// É o que o composition root do criador mostra quando se recusa a montar. As
// duas propriedades que importam: a recusa é VISÍVEL (nunca uma tela em
// branco) e o texto entra como TEXTO — `code`/`message` de um `AppError`
// podem carregar id ou nome vindos de conteúdo.
// ============================================================
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { renderFailureNotice } from '../../../site/js/ui/failure-notice.js';
import { createTestDom } from '../../helpers/test-dom.js';
import { getRepoRoot } from '../../helpers/legacy-markdown.js';

const malicious = JSON.parse(
  fs.readFileSync(path.join(getRepoRoot(), 'tests', 'fixtures', 'security', 'malicious-content.json'), 'utf8'),
);

const HTML = '<!doctype html><html><body><div id="app-content"><p id="anterior">conteúdo antigo</p></div></body></html>';

/** @returns {{dom: object, container: object}} */
function montar() {
  const dom = createTestDom({ html: HTML });
  return { dom, container: dom.document.getElementById('app-content') };
}

describe('renderFailureNotice', () => {
  test('exige um contêiner DOM', () => {
    assert.throws(() => renderFailureNotice(null, {}), TypeError);
    assert.throws(() => renderFailureNotice({}, {}), TypeError);
  });

  test('substitui o conteúdo anterior e mostra título, mensagem e código', () => {
    const { container } = montar();
    renderFailureNotice(container, { title: 'Não foi possível abrir o criador', message: 'Sem repositório.', code: 'X_Y' });

    assert.equal(container.querySelector('#anterior'), null, 'o conteúdo anterior precisa sair');
    const aviso = container.querySelector('[data-failure-notice]');
    assert.notEqual(aviso, null, 'a recusa precisa ser visível');
    assert.equal(aviso.getAttribute('data-failure-notice'), 'X_Y');
    assert.equal(aviso.querySelector('h2').textContent, 'Não foi possível abrir o criador');
    assert.equal(aviso.querySelector('p').textContent, 'Sem repositório.');
    assert.equal(aviso.querySelector('code').textContent, 'X_Y');
  });

  test('sem mensagem e sem código, o título sozinho já é a recusa', () => {
    const { container } = montar();
    const aviso = renderFailureNotice(container, { title: 'Falhou' });
    assert.equal(aviso.querySelector('p'), null);
    assert.equal(aviso.querySelector('code'), null);
    assert.equal(aviso.textContent, 'Falhou');
  });

  test('payload hostil vira TEXTO: nenhuma tag é criada', () => {
    const { container } = montar();
    for (const payload of malicious.payloads ?? Object.values(malicious).flat()) {
      const texto = typeof payload === 'string' ? payload : JSON.stringify(payload);
      renderFailureNotice(container, { title: texto, message: texto, code: texto });
      const criadas = [...container.querySelectorAll('*')].map((el) => el.tagName.toUpperCase());
      for (const proibida of ['SCRIPT', 'IMG', 'SVG', 'IFRAME']) {
        assert.equal(criadas.includes(proibida), false, `payload criou <${proibida}>: ${texto}`);
      }
      for (const el of container.querySelectorAll('*')) {
        for (const attr of el.attributes) {
          assert.equal(attr.name.startsWith('on'), false, `payload criou handler ${attr.name}`);
        }
      }
    }
  });
});
