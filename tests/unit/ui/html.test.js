// ============================================================
// Sinks seguros de texto, atributo e URL (site/js/ui/html.js).
//
// Os payloads hostis vêm de tests/fixtures/security/malicious-content.json —
// a MESMA fixture usada pelo teste de navegador real
// (tests/e2e/security-content.spec.js), para que os dois lados não possam
// divergir sobre o que é considerado ataque.
// ============================================================
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  escapeHtml,
  escapeHtmlAttribute,
  setSafeText,
  resolveSafeUrl,
  getAppExternalLinkAllowlist,
  SAFE_URL_KINDS,
  CHARACTER_IMAGE_MAX_BYTES,
} from '../../../site/js/ui/html.js';
import { createTestDom } from '../../helpers/test-dom.js';
import { getRepoRoot } from '../../helpers/legacy-markdown.js';

const repoRoot = getRepoRoot();
const malicious = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'security', 'malicious-content.json'), 'utf8'),
);
const nearLimits = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'characters', 'near-limits.json'), 'utf8'),
);

const BASE_URL = 'http://127.0.0.1:4173/site/index.html';

describe('escapeHtml (contexto de texto)', () => {
  test('escapa os cinco caracteres significativos e mantém o resto intacto', () => {
    assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
    assert.equal(escapeHtml('Ação — 3d6 ✓'), 'Ação — 3d6 ✓');
  });

  test('null/undefined viram string vazia (contrato do escHtml legado)', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(0), '0');
    assert.equal(escapeHtml(false), 'false');
  });

  test('nenhum payload hostil sobrevive com "<" ou aspas cruas', () => {
    for (const caso of malicious.textoEAtributo) {
      const escapado = escapeHtml(caso.payload);
      assert.ok(!/[<>]/.test(escapado), `${caso.id}: sobrou < ou > cru`);
      assert.ok(!escapado.includes('"'), `${caso.id}: sobrou aspa dupla crua`);
      assert.ok(!escapado.includes("'"), `${caso.id}: sobrou aspa simples crua`);
    }
  });
});

describe('escapeHtmlAttribute (contexto de atributo)', () => {
  test('escapa também espaço, "=", "/" e crase — o conjunto de texto não basta', () => {
    const resultado = escapeHtmlAttribute('x onmouseover=alert(1)');
    assert.ok(!resultado.includes(' '), 'espaço não escapado permitiria abrir outro atributo');
    assert.ok(!resultado.includes('='), '"=" não escapado permitiria abrir outro atributo');
    assert.equal(escapeHtmlAttribute('`x`'), '&#96;x&#96;');
  });

  test('valor injetado em atributo SEM aspas continua sendo um único atributo', () => {
    const dom = createTestDom();
    for (const caso of malicious.textoEAtributo) {
      const container = dom.document.createElement('div');
      // Atributo sem aspas de propósito: é o contexto mais frágil possível.
      container.innerHTML = `<span data-x=${escapeHtmlAttribute(caso.payload)}>t</span>`;
      const span = container.querySelector('span');
      assert.ok(span, `${caso.id}: elemento não foi criado`);
      const nomes = [...span.attributes].map((a) => a.name.toLowerCase());
      assert.deepEqual(nomes, ['data-x'], `${caso.id}: atributos inesperados ${nomes.join(',')}`);
      assert.equal(span.getAttribute('data-x'), caso.payload, `${caso.id}: valor não sobreviveu íntegro`);
    }
    dom.restore();
  });

  test('em atributo COM aspas o valor volta idêntico, sem criar handlers', () => {
    const dom = createTestDom();
    for (const caso of malicious.textoEAtributo) {
      const container = dom.document.createElement('div');
      container.innerHTML = `<span title="${escapeHtmlAttribute(caso.payload)}">t</span>`;
      const span = container.querySelector('span');
      const nomes = [...span.attributes].map((a) => a.name.toLowerCase());
      assert.deepEqual(nomes, ['title'], `${caso.id}: atributos inesperados ${nomes.join(',')}`);
      assert.ok(!nomes.some((nome) => nome.startsWith('on')), `${caso.id}: apareceu handler de evento`);
      assert.equal(span.getAttribute('title'), caso.payload);
    }
    dom.restore();
  });
});

describe('setSafeText', () => {
  test('escreve texto sem criar nenhum elemento, para todo payload hostil', () => {
    const dom = createTestDom();
    for (const caso of malicious.textoEAtributo) {
      const el = dom.document.createElement('div');
      setSafeText(el, caso.payload);
      assert.equal(el.textContent, caso.payload, `${caso.id}: texto alterado`);
      assert.equal(el.children.length, 0, `${caso.id}: criou elemento`);
      assert.equal(el.querySelectorAll('*').length, 0, `${caso.id}: criou descendentes`);
    }
    dom.restore();
  });

  test('null/undefined esvaziam o elemento e valores não textuais são convertidos', () => {
    const dom = createTestDom();
    const el = dom.document.createElement('div');
    setSafeText(el, 'x');
    setSafeText(el, null);
    assert.equal(el.textContent, '');
    setSafeText(el, 42);
    assert.equal(el.textContent, '42');
    dom.restore();
  });

  test('lança quando o alvo não é um nó DOM (defeito de programação)', () => {
    assert.throws(() => setSafeText(null, 'x'), TypeError);
    assert.throws(() => setSafeText({}, 'x'), TypeError);
  });
});

describe('resolveSafeUrl: enum fechado de modos', () => {
  test('modo desconhecido/ausente é rejeitado, nunca tratado como permissivo', () => {
    for (const kind of [undefined, null, '', 'qualquer', 'character-image ', 'APP-LINK']) {
      const resultado = resolveSafeUrl('https://www.reddit.com/user/ZaitBrz/', { kind });
      assert.equal(resultado.ok, false, `kind ${JSON.stringify(kind)} deveria ser rejeitado`);
      assert.equal(resultado.error.code, 'UI_URL_UNKNOWN_KIND');
    }
  });

  test('devolve Result (nunca lança) para valores não textuais ou vazios', () => {
    for (const value of [null, undefined, '', 42, {}, []]) {
      const resultado = resolveSafeUrl(value, { kind: SAFE_URL_KINDS.appLink });
      assert.equal(resultado.ok, false);
    }
  });

  test('erros são AppError com scope "ui/html"', () => {
    const resultado = resolveSafeUrl('javascript:alert(1)', { kind: SAFE_URL_KINDS.appLink });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.name, 'AppError');
    assert.equal(resultado.error.scope, 'ui/html');
  });
});

describe('resolveSafeUrl: payloads hostis da fixture', () => {
  const porModo = {
    'app-link': SAFE_URL_KINDS.appLink,
    'google-avatar': SAFE_URL_KINDS.googleAvatar,
    'character-image': SAFE_URL_KINDS.characterImage,
  };

  test('cada caso da fixture tem o veredito esperado', () => {
    for (const caso of malicious.urls) {
      const kind = porModo[caso.kind];
      assert.ok(kind, `${caso.id}: kind desconhecido na fixture`);
      const resultado = resolveSafeUrl(caso.payload, { kind, baseUrl: BASE_URL });
      assert.equal(
        resultado.ok,
        caso.esperado === 'aceito',
        `${caso.id}: esperado ${caso.esperado}, obtido ${resultado.ok ? 'aceito' : `rejeitado (${resultado.error.code})`}`,
      );
      if (resultado.ok) {
        assert.ok(resultado.value instanceof URL, `${caso.id}: valor de sucesso deveria ser URL`);
      }
    }
  });

  test('a fixture cobre os três modos e os dois vereditos', () => {
    const modos = new Set(malicious.urls.map((caso) => caso.kind));
    assert.deepEqual([...modos].sort(), ['app-link', 'character-image', 'google-avatar']);
    for (const modo of modos) {
      const doModo = malicious.urls.filter((caso) => caso.kind === modo);
      assert.ok(doModo.some((c) => c.esperado === 'aceito'), `${modo}: fixture sem caso aceito`);
      assert.ok(doModo.some((c) => c.esperado === 'rejeitado'), `${modo}: fixture sem caso rejeitado`);
    }
  });
});

describe('resolveSafeUrl: modo app-link', () => {
  test('aceita exatamente as URLs externas da allowlist', () => {
    for (const url of getAppExternalLinkAllowlist()) {
      assert.equal(resolveSafeUrl(url, { kind: SAFE_URL_KINDS.appLink }).ok, true, url);
    }
    // Mesmo host, caminho diferente: fora da allowlist.
    assert.equal(resolveSafeUrl('https://www.reddit.com/user/outro/', { kind: SAFE_URL_KINDS.appLink }).ok, false);
  });

  test('link local é confinado à raiz servida', () => {
    const aceito = resolveSafeUrl('js/app.js', { kind: SAFE_URL_KINDS.appLink, baseUrl: BASE_URL });
    assert.equal(aceito.ok, true);
    assert.equal(aceito.value.pathname, '/site/js/app.js');

    for (const fora of ['../segredo', '/outro/x', 'http://127.0.0.1:4173/fora.html']) {
      const resultado = resolveSafeUrl(fora, { kind: SAFE_URL_KINDS.appLink, baseUrl: BASE_URL });
      assert.equal(resultado.ok, false, `${fora} deveria ser rejeitado`);
    }
  });

  test('sem baseUrl, um link relativo não vira link válido por acidente', () => {
    assert.equal(resolveSafeUrl('js/app.js', { kind: SAFE_URL_KINDS.appLink }).ok, false);
  });
});

describe('resolveSafeUrl: modo google-avatar', () => {
  test('aceita subdomínios de googleusercontent.com por https', () => {
    for (const url of [
      'https://lh3.googleusercontent.com/a/foto',
      'https://googleusercontent.com/a/foto',
      'https://LH3.GOOGLEUSERCONTENT.COM/a/foto',
    ]) {
      assert.equal(resolveSafeUrl(url, { kind: SAFE_URL_KINDS.googleAvatar }).ok, true, url);
    }
  });

  test('rejeita outros hosts, outros esquemas e credenciais embutidas', () => {
    for (const url of [
      'https://evil.example.com/foto',
      'http://lh3.googleusercontent.com/foto',
      'javascript:alert(1)',
      'data:image/png;base64,iVBORw0KGgo=',
      'https://user:pass@lh3.googleusercontent.com/foto',
      'https://notgoogleusercontent.com/foto',
    ]) {
      assert.equal(resolveSafeUrl(url, { kind: SAFE_URL_KINDS.googleAvatar }).ok, false, url);
    }
  });
});

describe('resolveSafeUrl: modo character-image e o teto de near-limits.json', () => {
  const casoImagem = nearLimits.cases.find((caso) => caso.id === 'imagem-proximo-do-limite');
  const casoLimites = nearLimits.cases.find((caso) => caso.id === 'limites-de-payload-conhecidos');

  test('o teto usado em produção é EXATAMENTE a chave nomeada pela Task 2', () => {
    // A Task 2 não fixou uma chave `characterImageMaxBytes`: registrou, no
    // campo `cotaAceitaDerivadaDe` do caso da imagem, de qual chave o teto
    // vem — `firestoreDocumentLimitBytes`. Este teste amarra as duas coisas,
    // de modo que renomear/alterar a fixture ou a constante quebre aqui em
    // vez de deixar o limite virar `undefined` silenciosamente.
    assert.ok(casoLimites, 'near-limits.json sem o caso limites-de-payload-conhecidos');
    assert.match(casoImagem.cotaAceitaDerivadaDe, /^firestoreDocumentLimitBytes\b/);
    assert.equal(typeof casoLimites.firestoreDocumentLimitBytes, 'number');
    assert.equal(CHARACTER_IMAGE_MAX_BYTES, casoLimites.firestoreDocumentLimitBytes);
  });

  test('a imagem aceita pelo baseline continua aceita (nada de reduzir o limite em silêncio)', () => {
    const imagem = casoImagem.personagem.imagem;
    assert.equal(imagem.length, casoImagem.imagemDataUrlBytes);
    const resultado = resolveSafeUrl(imagem, { kind: SAFE_URL_KINDS.characterImage });
    assert.equal(resultado.ok, true, resultado.ok ? '' : resultado.error.code);
  });

  test('rejeita quando passa de um byte do teto', () => {
    const cabecalho = 'data:image/png;base64,';
    const enorme = cabecalho + 'A'.repeat(CHARACTER_IMAGE_MAX_BYTES - cabecalho.length + 4);
    const resultado = resolveSafeUrl(enorme, { kind: SAFE_URL_KINDS.characterImage });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'UI_URL_CHARACTER_IMAGE_TOO_LARGE');
  });

  test('aceita png, jpeg e webp válidos e recusa qualquer outro data:', () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString('base64')}`;
    const webp = `data:image/webp;base64,${Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50,
    ]).toString('base64')}`;
    for (const aceito of [png, jpeg, webp]) {
      assert.equal(resolveSafeUrl(aceito, { kind: SAFE_URL_KINDS.characterImage }).ok, true, aceito.slice(0, 40));
    }

    const recusados = [
      'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
      'data:text/plain;base64,aGVsbG8=',
      'data:image/png,notbase64',
      'data:image/png;base64,',
      'data:image/png;base64,####',
      'https://example.com/foto.png',
      // WebP com RIFF mas sem a tag "WEBP" no contêiner.
      `data:image/webp;base64,${Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]).toString('base64')}`,
    ];
    for (const recusado of recusados) {
      assert.equal(
        resolveSafeUrl(recusado, { kind: SAFE_URL_KINDS.characterImage }).ok,
        false,
        `${recusado.slice(0, 40)} deveria ser rejeitado`,
      );
    }
  });

  test('uma imagem aceita nunca vira src executável: o valor é URL com protocolo data:', () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const resultado = resolveSafeUrl(png, { kind: SAFE_URL_KINDS.characterImage });
    assert.equal(resultado.ok, true);
    assert.equal(resultado.value.protocol, 'data:');
  });
});
