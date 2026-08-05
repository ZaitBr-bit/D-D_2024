// Testes da fonte HTTP oficial (Task 11).
//
// Todos os testes usam um `fetchFn` controlado e injetado: nenhum teste
// (nem o módulo sob teste) pode tocar em `window.fetch`/`globalThis.fetch`.
// Para provar isso, o arquivo substitui `globalThis.fetch` por um stub que
// explode ao ser chamado durante toda a execução.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  HttpContentSource,
  assertSafeContentPath,
  resolveContentUrl,
} from '../../../site/js/infra/content/http-content-source.js';
import { OFFICIAL_CONTENT_BASE_URL } from '../../../site/js/infra/config.js';
import { assertContentSource } from '../../../site/js/content/source.js';

const BASE = new URL('https://conteudo.test/pacotes/dnd2024/');

// --- Armadilha global: nada aqui pode usar fetch global ---------------------
let fetchGlobalOriginal;
let usosDeFetchGlobal = 0;

before(() => {
  fetchGlobalOriginal = globalThis.fetch;
  globalThis.fetch = () => {
    usosDeFetchGlobal += 1;
    throw new Error('fetch global foi chamado: a fonte HTTP deve usar somente o fetchFn injetado.');
  };
});

after(() => {
  globalThis.fetch = fetchGlobalOriginal;
  assert.equal(usosDeFetchGlobal, 0, 'nenhum teste pode ter usado o fetch global');
});

/**
 * Cria um `fetchFn` de teste que responde a partir de um mapa de rotas
 * (chave = href completo) e registra cada chamada.
 * @param {Record<string, {status?: number, body?: *, invalidJson?: boolean, throws?: Error}>} rotas
 * @returns {{fn: Function, calls: string[]}}
 */
function criarFetchFn(rotas) {
  const calls = [];
  /**
   * Implementação do fetch de teste.
   * @param {string} url
   * @returns {Promise<object>}
   */
  async function fn(url) {
    calls.push(String(url));
    const rota = rotas[String(url)];
    if (!rota) {
      return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) };
    }
    if (rota.throws) {
      throw rota.throws;
    }
    const status = rota.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: 'stub',
      json: async () => {
        if (rota.invalidJson) {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        }
        return rota.body;
      },
    };
  }
  return { fn, calls };
}

/** Monta um manifesto mínimo válido para o registry (não é validado aqui). */
function manifestoDeTeste() {
  return { schemaVersion: '1.0.0', id: 'dnd2024', name: 'Pacote', version: '1.0.0', status: 'ready' };
}

/** Índice de teste com duas entidades no mesmo arquivo-coleção. */
function indiceDeTeste() {
  return {
    schemaVersion: '1.0.0',
    entries: [
      { id: 'dnd2024:ability:forca', type: 'ability', path: 'rulesets/abilities.json', pointer: '/items/0' },
      { id: 'dnd2024:ability:destreza', type: 'ability', path: 'rulesets/abilities.json', pointer: '/items/1' },
      { id: 'dnd2024:ruleset:core', type: 'ruleset', path: 'rulesets/core.json' },
    ],
  };
}

/** Rotas padrão do pacote de teste. */
function rotasPadrao() {
  return {
    [`${BASE.href}manifest.json`]: { body: manifestoDeTeste() },
    [`${BASE.href}index.json`]: { body: indiceDeTeste() },
    [`${BASE.href}rulesets/abilities.json`]: {
      body: {
        schemaVersion: '1.0.0',
        type: 'ability',
        items: [
          { id: 'dnd2024:ability:forca', type: 'ability', name: 'Força' },
          { id: 'dnd2024:ability:destreza', type: 'ability', name: 'Destreza' },
        ],
      },
    },
    [`${BASE.href}rulesets/core.json`]: { body: { id: 'dnd2024:ruleset:core', type: 'ruleset', name: 'Core' } },
  };
}

describe('HttpContentSource: contrato e construção', () => {
  test('implementa exatamente o contrato ContentSource', () => {
    const { fn } = criarFetchFn({});
    const source = HttpContentSource({ baseUrl: BASE, fetchFn: fn });
    const validacao = assertContentSource(source);
    assert.equal(validacao.valid, true);
    assert.deepEqual(validacao.warnings, [], 'a fonte não deve expor métodos fora do contrato');
  });

  test('exige fetchFn injetado (defeito de programação, não Result)', () => {
    assert.throws(() => HttpContentSource({ baseUrl: BASE }), /fetchFn/);
    assert.throws(() => HttpContentSource({ baseUrl: BASE, fetchFn: {} }), /fetchFn/);
  });

  test('exige baseUrl absoluta terminada em barra, com protocolo suportado', () => {
    const { fn } = criarFetchFn({});
    assert.throws(() => HttpContentSource({ fetchFn: fn }), /baseUrl/);
    assert.throws(() => HttpContentSource({ baseUrl: 'pacotes/dnd2024/', fetchFn: fn }), /baseUrl/);
    assert.throws(() => HttpContentSource({ baseUrl: 'https://x.test/pacote', fetchFn: fn }), /baseUrl/);
    assert.throws(() => HttpContentSource({ baseUrl: 'javascript:void 0', fetchFn: fn }), /baseUrl/);
    // string absoluta válida é aceita
    assert.doesNotThrow(() => HttpContentSource({ baseUrl: 'https://x.test/pacote/', fetchFn: fn }));
  });

  test('não referencia fetch global nem window no código-fonte', () => {
    const arquivo = fileURLToPath(
      new URL('../../../site/js/infra/content/http-content-source.js', import.meta.url),
    );
    const fonte = readFileSync(arquivo, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.equal(/\bwindow\b/.test(fonte), false, 'não pode mencionar window');
    assert.equal(/\bglobalThis\b/.test(fonte), false, 'não pode mencionar globalThis');
    // Qualquer `fetch(` que não seja `fetchFn(` é uso do global.
    assert.equal(/(?<![.\w])fetch\s*\(/.test(fonte), false, 'não pode chamar fetch global');
  });
});

describe('HttpContentSource: carregamento com sucesso', () => {
  test('loadManifest/loadIndex resolvem os caminhos fixos do pacote', async () => {
    const { fn, calls } = criarFetchFn(rotasPadrao());
    const source = HttpContentSource({ baseUrl: BASE, fetchFn: fn });

    const manifesto = await source.loadManifest();
    assert.equal(manifesto.ok, true);
    assert.deepEqual(manifesto.value, manifestoDeTeste());

    const indice = await source.loadIndex();
    assert.equal(indice.ok, true);
    assert.deepEqual(indice.value, indiceDeTeste());

    assert.deepEqual(calls, [`${BASE.href}manifest.json`, `${BASE.href}index.json`]);
  });

  test('loadEntity resolve arquivo inteiro e coleção com pointer', async () => {
    const { fn, calls } = criarFetchFn(rotasPadrao());
    const source = HttpContentSource({ baseUrl: BASE, fetchFn: fn });

    const forca = await source.loadEntity('dnd2024:ability:forca');
    assert.equal(forca.ok, true);
    assert.deepEqual(forca.value, { id: 'dnd2024:ability:forca', type: 'ability', name: 'Força' });

    const destreza = await source.loadEntity('dnd2024:ability:destreza');
    assert.equal(destreza.ok, true);
    assert.equal(destreza.value.name, 'Destreza');

    const core = await source.loadEntity('dnd2024:ruleset:core');
    assert.equal(core.ok, true);
    assert.equal(core.value.name, 'Core');

    // index.json + abilities.json (uma vez, cache por caminho) + core.json
    assert.deepEqual(calls, [
      `${BASE.href}index.json`,
      `${BASE.href}rulesets/abilities.json`,
      `${BASE.href}rulesets/core.json`,
    ]);
  });

  test('a URL final é construída a partir da baseUrl, sem host absoluto embutido', async () => {
    const outraBase = new URL('http://127.0.0.1:4173/site/../dados/pacotes/dnd2024/');
    const rotas = { [`${outraBase.href}manifest.json`]: { body: manifestoDeTeste() } };
    const { fn, calls } = criarFetchFn(rotas);
    const source = HttpContentSource({ baseUrl: outraBase, fetchFn: fn });
    const resultado = await source.loadManifest();
    assert.equal(resultado.ok, true, JSON.stringify(resultado.error ?? null));
    assert.equal(calls[0], `${outraBase.href}manifest.json`);
  });
});

describe('HttpContentSource: falhas de rede e de conteúdo', () => {
  test('404 devolve err com o status no contexto', async () => {
    const { fn } = criarFetchFn({ [`${BASE.href}index.json`]: { status: 404 } });
    const source = HttpContentSource({ baseUrl: BASE, fetchFn: fn });
    const resultado = await source.loadManifest();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CONTENT_HTTP_STATUS');
    assert.equal(resultado.error.context.status, 404);
    assert.equal(resultado.error.context.path, 'manifest.json');
  });

  test('JSON inválido devolve err sem lançar', async () => {
    const { fn } = criarFetchFn({ [`${BASE.href}manifest.json`]: { invalidJson: true } });
    const source = HttpContentSource({ baseUrl: BASE, fetchFn: fn });
    const resultado = await source.loadManifest();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CONTENT_HTTP_INVALID_JSON');
  });

  test('offline (fetchFn rejeita) devolve err, nunca exceção', async () => {
    const { fn } = criarFetchFn({
      [`${BASE.href}manifest.json`]: { throws: new TypeError('Failed to fetch') },
    });
    const source = HttpContentSource({ baseUrl: BASE, fetchFn: fn });
    const resultado = await source.loadManifest();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CONTENT_HTTP_REQUEST_FAILED');
  });

  test('fetchFn que devolve algo que não é Response é violação de contrato', async () => {
    const source = HttpContentSource({ baseUrl: BASE, fetchFn: async () => 'não é resposta' });
    const resultado = await source.loadManifest();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CONTENT_HTTP_INVALID_RESPONSE');
  });

  test('loadEntity de id ausente no índice devolve err', async () => {
    const { fn } = criarFetchFn(rotasPadrao());
    const source = HttpContentSource({ baseUrl: BASE, fetchFn: fn });
    const resultado = await source.loadEntity('dnd2024:ability:carisma');
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CONTENT_ENTITY_NOT_INDEXED');
  });

  test('loadEntity com id que não é string devolve err', async () => {
    const { fn } = criarFetchFn(rotasPadrao());
    const source = HttpContentSource({ baseUrl: BASE, fetchFn: fn });
    for (const id of [undefined, null, 42, {}, []]) {
      const resultado = await source.loadEntity(id);
      assert.equal(resultado.ok, false, `aceitou ${String(id)}`);
      assert.equal(resultado.error.code, 'CONTENT_ENTITY_ID_INVALID');
    }
  });

  test('índice malformado devolve err em loadEntity', async () => {
    const rotas = rotasPadrao();
    rotas[`${BASE.href}index.json`] = { body: { schemaVersion: '1.0.0' } };
    const { fn } = criarFetchFn(rotas);
    const source = HttpContentSource({ baseUrl: BASE, fetchFn: fn });
    const resultado = await source.loadEntity('dnd2024:ability:forca');
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CONTENT_INDEX_MALFORMED');
  });

  test('pointer que não resolve nada devolve err', async () => {
    const rotas = rotasPadrao();
    rotas[`${BASE.href}index.json`] = {
      body: {
        schemaVersion: '1.0.0',
        entries: [
          { id: 'dnd2024:ability:forca', type: 'ability', path: 'rulesets/abilities.json', pointer: '/items/99' },
        ],
      },
    };
    const { fn } = criarFetchFn(rotas);
    const source = HttpContentSource({ baseUrl: BASE, fetchFn: fn });
    const resultado = await source.loadEntity('dnd2024:ability:forca');
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CONTENT_ENTITY_POINTER_UNRESOLVED');
    assert.equal(resultado.error.context.pointerCode, 'POINTER_NOT_FOUND');
  });

  test('pointer que tenta alcançar o protótipo é rejeitado, com código estruturado', async () => {
    // A classificação "inaceitável" vs "não resolveu" precisa vir de um CÓDIGO,
    // nunca da redação da mensagem: reescrever a prosa não pode transformar a
    // rejeição de `/__proto__/x` num benigno "não encontrado".
    const esperado = new Map([
      ['/__proto__/polluido', 'POINTER_SEGMENT_FORBIDDEN'],
      ['/constructor/prototype', 'POINTER_SEGMENT_FORBIDDEN'],
      ['/items/0/__proto__', 'POINTER_SEGMENT_FORBIDDEN'],
      ['/items/0/prototype', 'POINTER_SEGMENT_FORBIDDEN'],
      ['items/0', 'POINTER_MALFORMED'],
      ['', 'POINTER_MALFORMED'],
    ]);
    for (const [pointer, pointerCode] of esperado) {
      const rotas = rotasPadrao();
      rotas[`${BASE.href}index.json`] = {
        body: {
          schemaVersion: '1.0.0',
          entries: [
            { id: 'dnd2024:ability:forca', type: 'ability', path: 'rulesets/abilities.json', pointer },
          ],
        },
      };
      const { fn } = criarFetchFn(rotas);
      const source = HttpContentSource({ baseUrl: BASE, fetchFn: fn });
      const resultado = await source.loadEntity('dnd2024:ability:forca');
      assert.equal(resultado.ok, false, `aceitou pointer ${JSON.stringify(pointer)}`);
      assert.equal(resultado.error.code, 'CONTENT_ENTITY_POINTER_INVALID');
      assert.equal(
        resultado.error.context.pointerCode,
        pointerCode,
        `código de pointer errado para ${JSON.stringify(pointer)}`,
      );
    }
  });
});

describe('HttpContentSource: cache de promessas por caminho', () => {
  test('duas chamadas ao mesmo caminho fazem uma única requisição', async () => {
    const { fn, calls } = criarFetchFn(rotasPadrao());
    const source = HttpContentSource({ baseUrl: BASE, fetchFn: fn });
    await source.loadManifest();
    await source.loadManifest();
    assert.deepEqual(calls, [`${BASE.href}manifest.json`]);
  });

  test('chamadas concorrentes compartilham a mesma promessa', async () => {
    const { fn, calls } = criarFetchFn(rotasPadrao());
    const source = HttpContentSource({ baseUrl: BASE, fetchFn: fn });
    const [a, b, c] = await Promise.all([source.loadIndex(), source.loadIndex(), source.loadIndex()]);
    assert.equal(a.ok && b.ok && c.ok, true);
    assert.deepEqual(calls, [`${BASE.href}index.json`]);
  });

  test('falha invalida a entrada do cache e permite retry', async () => {
    let tentativa = 0;
    const calls = [];
    /** fetch que falha na primeira tentativa e responde na segunda. */
    async function fn(url) {
      calls.push(String(url));
      tentativa += 1;
      if (tentativa === 1) {
        return { ok: false, status: 503, statusText: 'Service Unavailable', json: async () => ({}) };
      }
      return { ok: true, status: 200, statusText: 'OK', json: async () => manifestoDeTeste() };
    }
    const source = HttpContentSource({ baseUrl: BASE, fetchFn: fn });

    const primeira = await source.loadManifest();
    assert.equal(primeira.ok, false);
    const segunda = await source.loadManifest();
    assert.equal(segunda.ok, true, 'o retry deve funcionar depois da falha');
    assert.deepEqual(segunda.value, manifestoDeTeste());
    assert.equal(calls.length, 2, 'a entrada com falha não pode ficar no cache');
  });

  test('sucesso NÃO é refeito depois de um erro em outro caminho', async () => {
    const rotas = rotasPadrao();
    rotas[`${BASE.href}rulesets/core.json`] = { status: 500 };
    const { fn, calls } = criarFetchFn(rotas);
    const source = HttpContentSource({ baseUrl: BASE, fetchFn: fn });
    await source.loadIndex();
    const falha = await source.loadEntity('dnd2024:ruleset:core');
    assert.equal(falha.ok, false);
    await source.loadEntity('dnd2024:ability:forca');
    // index.json só uma vez, apesar da falha em core.json
    assert.equal(calls.filter((url) => url.endsWith('index.json')).length, 1);
  });
});

// ---------------------------------------------------------------------------
// Camada 1: allowlist textual de caminhos
// ---------------------------------------------------------------------------

const CAMINHOS_VALIDOS = Object.freeze([
  'manifest.json',
  'index.json',
  'appendices/creatures.json',
  'spells/by-class/bardo.json',
  'equipment/mounts-vehicles.json',
  'migrations/character-v1-aliases.json',
  'spells/level-1.json',
]);

// Cada caminho malicioso, com o motivo pelo qual precisa ser recusado.
const CAMINHOS_MALICIOSOS = Object.freeze([
  ['../evil.json', 'segmento pai literal'],
  ['./evil.json', 'segmento atual literal'],
  ['a/../evil.json', 'segmento pai no meio'],
  ['a/./evil.json', 'segmento atual no meio'],
  ['..', 'somente o segmento pai'],
  ['%2e%2e/evil.json', 'ponto-ponto percent-encoded'],
  ['.%2e/evil.json', 'ponto-ponto meio percent-encoded'],
  ['%2e./evil.json', 'ponto-ponto meio percent-encoded (inverso)'],
  ['%2E%2E%2Fevil.json', 'ponto-ponto e barra percent-encoded em maiúsculas'],
  ['..%2fevil.json', 'barra percent-encoded'],
  ['..%5cevil.json', 'barra invertida percent-encoded'],
  ['a%2fb.json', 'separador percent-encoded'],
  ['evil%2ejson', 'ponto da extensão percent-encoded'],
  ['%zz/evil.json', 'escape percent malformado'],
  ['evil%2.json', 'escape percent truncado'],
  ['evil%.json', 'percent solto'],
  ['dir\\evil.json', 'barra invertida'],
  ['..\\evil.json', 'barra invertida com segmento pai'],
  ['/etc/passwd', 'caminho absoluto POSIX'],
  ['/index.json', 'caminho com barra inicial'],
  ['//evil.test/index.json', 'URL protocol-relative'],
  ['https://evil.test/evil.json', 'URL absoluta https'],
  ['http://evil.test/evil.json', 'URL absoluta http'],
  ['file:///etc/passwd', 'URL absoluta file'],
  ['data:application/json,{}', 'URL data'],
  ['index.json?x=1', 'query string'],
  ['index.json#frag', 'fragmento'],
  ['index.json?', 'query vazia'],
  ['index.json#', 'fragmento vazio'],
  ['', 'caminho vazio'],
  ['   ', 'somente espaços'],
  ['index.json ', 'espaço no fim'],
  [' index.json', 'espaço no início'],
  ['Index.json', 'maiúscula'],
  ['ÍNDICE.json', 'não ASCII'],
  ['índice.json', 'acento'],
  ['index.txt', 'extensão não permitida'],
  ['index.json.txt', 'extensão dupla'],
  ['index', 'sem extensão'],
  ['spells/', 'termina em barra'],
  ['spells//index.json', 'barra dupla'],
  ['spells/-index.json', 'hífen inicial no segmento'],
  ['spells/index-.json', 'hífen final no segmento'],
  ['.json', 'somente extensão'],
  ['a/\u0000b.json', 'byte nulo'],
  ['a\nb.json', 'quebra de linha'],
  ['a\u202ejson.b', 'caractere de controle bidi'],
  ['~/index.json', 'expansão de home'],
  ['C:/index.json', 'caminho absoluto Windows'],
  ['\\\\servidor\\share\\index.json', 'caminho UNC'],
]);

describe('assertSafeContentPath: allowlist textual (camada 1)', () => {
  test('aceita os caminhos reais do pacote oficial', () => {
    for (const caminho of CAMINHOS_VALIDOS) {
      const resultado = assertSafeContentPath(caminho);
      assert.equal(resultado.ok, true, `recusou o caminho legítimo "${caminho}"`);
      assert.equal(resultado.value, caminho);
    }
  });

  test('aceita todos os caminhos declarados no índice oficial real', () => {
    const indice = JSON.parse(
      readFileSync(new URL('index.json', OFFICIAL_CONTENT_BASE_URL), 'utf8'),
    );
    const caminhos = [...new Set(indice.entries.map((entrada) => entrada.path))];
    assert.equal(caminhos.length > 40, true, 'o índice oficial deveria ter dezenas de arquivos');
    for (const caminho of caminhos) {
      assert.equal(assertSafeContentPath(caminho).ok, true, `recusou "${caminho}" do índice oficial`);
    }
  });

  test('recusa toda a matriz de caminhos maliciosos', () => {
    for (const [caminho, motivo] of CAMINHOS_MALICIOSOS) {
      const resultado = assertSafeContentPath(caminho);
      assert.equal(resultado.ok, false, `aceitou "${caminho}" (${motivo})`);
      assert.equal(resultado.error.code, 'CONTENT_PATH_REJECTED', `código errado para "${caminho}"`);
      assert.equal(typeof resultado.error.context.reason, 'string');
    }
  });

  test('recusa valores que não são string e caminhos longos demais', () => {
    for (const valor of [null, undefined, 42, {}, [], new String('index.json')]) {
      assert.equal(assertSafeContentPath(valor).ok, false, `aceitou ${String(valor)}`);
    }
    const longo = `${'a'.repeat(300)}.json`;
    assert.equal(assertSafeContentPath(longo).ok, false, 'aceitou caminho longo demais');
  });

  test('nenhum caminho malicioso chega ao fetchFn via entrada do índice', async () => {
    for (const [caminho, motivo] of CAMINHOS_MALICIOSOS) {
      const rotas = {
        [`${BASE.href}index.json`]: {
          body: {
            schemaVersion: '1.0.0',
            entries: [{ id: 'dnd2024:ability:forca', type: 'ability', path: caminho }],
          },
        },
      };
      const { fn, calls } = criarFetchFn(rotas);
      const source = HttpContentSource({ baseUrl: BASE, fetchFn: fn });
      const resultado = await source.loadEntity('dnd2024:ability:forca');
      assert.equal(resultado.ok, false, `aceitou o path "${caminho}" (${motivo}) do índice`);
      assert.equal(resultado.error.code, 'CONTENT_PATH_REJECTED');
      assert.deepEqual(
        calls,
        [`${BASE.href}index.json`],
        `houve requisição extra para o path malicioso "${caminho}"`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Camada 2: contenção via new URL(path, baseUrl) — independente da camada 1
// ---------------------------------------------------------------------------

describe('resolveContentUrl: contenção de URL (camada 2)', () => {
  test('resolve um caminho legítimo para dentro da base', () => {
    const resultado = resolveContentUrl('spells/level-1.json', BASE);
    assert.equal(resultado.ok, true);
    assert.equal(resultado.value.href, `${BASE.href}spells/level-1.json`);
  });

  test('recusa escapes que burlariam uma allowlist textual mais frouxa', () => {
    // Estes valores NUNCA passam pela camada 1; são passados direto para a
    // camada 2 de propósito, para provar que ela é independente e suficiente.
    const escapes = [
      '../fora.json',
      '../../fora.json',
      'a/../../fora.json',
      '/absoluto.json',
      '//evil.test/x.json',
      'https://evil.test/x.json',
      'file:///etc/passwd',
      'level-1.json?x=1',
      'level-1.json#frag',
      '%2e%2e/fora.json',
      '..%2ffora.json',
    ];
    for (const caminho of escapes) {
      const resultado = resolveContentUrl(caminho, BASE);
      assert.equal(resultado.ok, false, `camada 2 aceitou "${caminho}"`);
      assert.equal(resultado.error.code, 'CONTENT_URL_OUT_OF_BOUNDS');
    }
  });

  test('recusa base cujo pathname é apenas prefixo textual de outro diretório', () => {
    // `https://x.test/pacote/` vs `https://x.test/pacote-malicioso/`: a
    // contenção precisa ser por segmento, não por prefixo de string.
    const base = new URL('https://x.test/pacote/');
    const resultado = resolveContentUrl('../pacote-malicioso/x.json', base);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CONTENT_URL_OUT_OF_BOUNDS');
  });

  test('funciona com a base oficial real (file: em desenvolvimento)', () => {
    const resultado = resolveContentUrl('index.json', OFFICIAL_CONTENT_BASE_URL);
    assert.equal(resultado.ok, true);
    assert.equal(resultado.value.protocol, OFFICIAL_CONTENT_BASE_URL.protocol);
    assert.equal(
      resultado.value.pathname.startsWith(OFFICIAL_CONTENT_BASE_URL.pathname),
      true,
      'o pathname resolvido deve estar dentro do pathname da base oficial',
    );
    const fora = resolveContentUrl('../../evil.json', OFFICIAL_CONTENT_BASE_URL);
    assert.equal(fora.ok, false);
  });
});

describe('OFFICIAL_CONTENT_BASE_URL', () => {
  test('é derivada de import.meta.url e aponta para o pacote oficial', () => {
    assert.ok(OFFICIAL_CONTENT_BASE_URL instanceof URL);
    assert.equal(OFFICIAL_CONTENT_BASE_URL.href.endsWith('/dados/pacotes/dnd2024/'), true);
    assert.equal(OFFICIAL_CONTENT_BASE_URL.search, '');
    assert.equal(OFFICIAL_CONTENT_BASE_URL.hash, '');
  });

  test('o manifesto oficial é alcançável a partir da base', () => {
    const manifesto = JSON.parse(readFileSync(new URL('manifest.json', OFFICIAL_CONTENT_BASE_URL), 'utf8'));
    assert.equal(manifesto.id, 'dnd2024');
    assert.equal(manifesto.status, 'ready');
  });
});
