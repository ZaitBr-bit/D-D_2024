// ============================================================
// Renderizador de Markdown seguro (site/js/ui/markdown.js).
//
// Duas responsabilidades cobertas aqui:
//  1. Conteúdo hostil NUNCA vira markup, atributo ou handler.
//  2. A gramática permitida (títulos, ênfase, listas, tabelas, dados)
//     continua produzindo a MESMA estrutura do baseline.
//
// A prova de que conteúdo LEGÍTIMO sobrevive em escala está em
// `markdown-fidelity.test.js`, que roda sobre o catálogo inteiro.
// ============================================================
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { renderSafeMarkdown, renderSafeMarkdownToHtml } from '../../../site/js/ui/markdown.js';
import { createTestDom } from '../../helpers/test-dom.js';
import { getRepoRoot } from '../../helpers/legacy-markdown.js';

const malicious = JSON.parse(
  fs.readFileSync(path.join(getRepoRoot(), 'tests', 'fixtures', 'security', 'malicious-content.json'), 'utf8'),
);

/**
 * Renderiza `texto` em um contêiner do DOM de teste.
 * @param {object} dom
 * @param {string} texto
 * @returns {object} elemento contêiner
 */
function render(dom, texto) {
  const container = dom.document.createElement('div');
  container.appendChild(renderSafeMarkdown(dom.document, texto));
  return container;
}

const TAGS_PERMITIDAS = new Set(['P', 'H3', 'H4', 'STRONG', 'EM', 'UL', 'LI', 'DIV', 'TABLE', 'TR', 'TD', 'TH']);

describe('renderSafeMarkdown: bloqueio de conteúdo hostil', () => {
  test('nenhum payload da fixture produz tag, atributo ou handler', () => {
    const dom = createTestDom();
    const alvos = [
      ...malicious.markdown.map((caso) => ({ id: caso.id, payload: caso.payload })),
      ...malicious.textoEAtributo.map((caso) => ({ id: `texto:${caso.id}`, payload: caso.payload })),
      ...malicious.urls.map((caso) => ({ id: `url:${caso.id}`, payload: caso.payload })),
    ];

    for (const { id, payload } of alvos) {
      const container = render(dom, payload);
      for (const elemento of container.querySelectorAll('*')) {
        assert.ok(TAGS_PERMITIDAS.has(elemento.tagName), `${id}: tag fora da allowlist: ${elemento.tagName}`);
        for (const atributo of elemento.attributes) {
          assert.equal(
            atributo.name.toLowerCase(),
            'class',
            `${id}: atributo inesperado "${atributo.name}" em <${elemento.tagName}>`,
          );
          assert.equal(atributo.value, 'table-wrapper', `${id}: classe inesperada "${atributo.value}"`);
        }
      }
      // Nenhum nó com destino navegável/carregável — é o que impediria um
      // `javascript:`/`data:` de virar navegação ou requisição. (O texto
      // "javascript:" PODE aparecer como conteúdo visível: o renderizador não
      // apaga texto, só se recusa a interpretá-lo.)
      assert.equal(container.querySelectorAll('[href],[src],[srcset],[action]').length, 0, `${id}: apareceu destino`);
      assert.equal(
        container.querySelectorAll('script,img,svg,iframe,a,style,link,object,embed,form,input').length,
        0,
        `${id}: apareceu tag proibida`,
      );
      // A checagem de "nenhum handler de evento" é feita no DOM (laço acima:
      // o ÚNICO atributo aceito é class="table-wrapper"), não por regex sobre
      // a string: o texto escapado legitimamente contém trechos como
      // `onload=` quando o próprio conteúdo hostil é exibido como texto.
      const html = container.innerHTML;
      assert.ok(!/<script/i.test(html), `${id}: apareceu <script> no HTML`);
    }
    dom.restore();
  });

  test('o texto hostil sobrevive VISÍVEL como texto (não é apagado por blacklist)', () => {
    const dom = createTestDom();
    const container = render(dom, 'Antes <script>window.__xss=1;</script> depois');
    assert.equal(container.textContent, 'Antes <script>window.__xss=1;</script> depois');
    dom.restore();
  });

  test('tentativa de forjar um marcador interno com U+0000 vira texto inerte', () => {
    const dom = createTestDom();
    const forja = 'a<\u0000o:strong:0\u0000>b<\u0000c:strong:0\u0000>c';
    const container = render(dom, forja);
    assert.equal(container.querySelectorAll('strong').length, 0, 'marcador forjado virou elemento');
    assert.ok(container.textContent.includes('<o:strong:0>'), 'texto do marcador deveria sobreviver sem o U+0000');
    dom.restore();
  });

  test('entidades do conteúdo não são decodificadas duas vezes', () => {
    const dom = createTestDom();
    const container = render(dom, '&lt;script&gt;window.__xss=1&lt;/script&gt;');
    assert.equal(container.querySelectorAll('*').length, 1, 'deveria ser só o <p>');
    assert.equal(container.textContent, '&lt;script&gt;window.__xss=1&lt;/script&gt;');
    dom.restore();
  });
});

describe('renderSafeMarkdown: gramática permitida', () => {
  test('títulos, ênfase, listas, tabelas e notação de dados', () => {
    const dom = createTestDom();

    assert.equal(render(dom, '### Título').innerHTML, '<h3>Título</h3>');
    assert.equal(render(dom, '#### Sub').innerHTML, '<h4>Sub</h4>');
    assert.equal(render(dom, 'a **b** c').innerHTML, '<p>a <strong>b</strong> c</p>');
    assert.equal(render(dom, 'a *b* c').innerHTML, '<p>a <em>b</em> c</p>');
    assert.equal(render(dom, '***x***').innerHTML, '<strong><em>x</em></strong>');
    assert.equal(render(dom, '- um\n- dois').innerHTML, '<ul><li>um</li>\n<li>dois</li></ul>');
    assert.equal(render(dom, 'Dano 3d6').innerHTML, '<p>Dano 🎲3d6🎲</p>');
    assert.equal(
      render(dom, '|a|b|').innerHTML,
      '<div class="table-wrapper"><table><tr><td>a</td><td>b</td></tr></table></div>',
    );
    // Linha separadora de tabela é descartada, como no baseline.
    assert.equal(render(dom, '|---|:--|').innerHTML, '');

    dom.restore();
  });

  test('ênfase aninhada atravessando elementos (itálico contendo negrito)', () => {
    const dom = createTestDom();
    // Sem `<p>` de propósito: no baseline, uma linha que já COMEÇA com uma
    // tag não recebe parágrafo (`trimmed.startsWith('<')`). Reproduzir isso é
    // requisito de fidelidade, não um descuido.
    assert.equal(render(dom, '*a **b** c*').innerHTML, '<em>a <strong>b</strong> c</em>');
    assert.equal(render(dom, 'x *a **b** c*').innerHTML, '<p>x <em>a <strong>b</strong> c</em></p>');
    dom.restore();
  });

  test('entrada vazia produz fragmento vazio', () => {
    const dom = createTestDom();
    for (const vazio of ['', null, undefined]) {
      const fragmento = renderSafeMarkdown(dom.document, vazio);
      assert.equal(fragmento.childNodes.length, 0);
    }
    dom.restore();
  });

  test('renderSafeMarkdownToHtml serializa a mesma árvore', () => {
    const dom = createTestDom();
    const texto = '### T\n\n- a\n- b\n\nx **y**';
    const container = render(dom, texto);
    assert.equal(renderSafeMarkdownToHtml(dom.document, texto), container.innerHTML);
    dom.restore();
  });

  test('lança quando documentRef não é um Document (defeito de programação)', () => {
    assert.throws(() => renderSafeMarkdown(null, 'x'), TypeError);
    assert.throws(() => renderSafeMarkdown({}, 'x'), TypeError);
  });
});
