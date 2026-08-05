import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHashRouter } from '../../../site/js/core/hash-router.js';
import { ok, err } from '../../../site/js/core/result.js';
import { createAppError } from '../../../site/js/core/errors.js';

/**
 * Fábrica de um ambiente de hash falso: guarda o hash atual em memória e
 * expõe as três portas que o router exige (`getHash`, `setHash`,
 * `subscribeHashChange`), sem tocar em `window`/`location`/`history`.
 * @param {string} hashInicial
 */
function criarAmbienteFalso(hashInicial = '') {
  let hash = hashInicial;
  const handlers = new Set();
  return {
    getHash: () => hash,
    // `setHash` imita `location.hash =`: dispara os assinantes, como um
    // 'hashchange' real dispararia.
    setHash: (rota) => {
      hash = '#' + rota;
      for (const handler of handlers) handler();
    },
    subscribeHashChange: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    contarAssinantes: () => handlers.size,
  };
}

/** Cria uma rota de teste controlável: resolve/rejeita quando o teste mandar. */
function criarRotaControlavel() {
  let resolverLoad;
  const loadPromise = new Promise((resolve) => {
    resolverLoad = resolve;
  });
  const chamadas = [];
  const disposer = () => chamadas.push('disposed');
  const render = (container, param) => {
    chamadas.push(['render', param]);
    return ok(disposer);
  };
  return {
    entry: { load: () => loadPromise, exportName: 'render' },
    resolver: () => resolverLoad({ render }),
    chamadas,
    disposer,
  };
}

describe('core/hash-router: parsing do hash', () => {
  test('#home vira {pagina: "home", param: ""}', async () => {
    const ambiente = criarAmbienteFalso('#home');
    const montagens = [];
    const routes = {
      home: { load: async () => ({ render: (c, p) => { montagens.push(p); return ok(() => {}); } }), exportName: 'render' },
    };
    const router = createHashRouter({ routes, ...ambiente, contentRoot: {} });
    await router.process();
    assert.deepEqual(montagens, ['']);
  });

  test('#criar vira {pagina: "criar", param: ""}', async () => {
    const ambiente = criarAmbienteFalso('#criar');
    const params = [];
    const routes = {
      criar: { load: async () => ({ render: (c, p) => { params.push(p); return ok(() => {}); } }), exportName: 'render' },
    };
    const router = createHashRouter({ routes, ...ambiente, contentRoot: {} });
    await router.process();
    assert.deepEqual(params, ['']);
  });

  test('#ficha/abc123 vira {pagina: "ficha", param: "abc123"}', async () => {
    const ambiente = criarAmbienteFalso('#ficha/abc123');
    const params = [];
    const routes = {
      ficha: { load: async () => ({ render: (c, p) => { params.push(p); return ok(() => {}); } }), exportName: 'render' },
    };
    const router = createHashRouter({ routes, ...ambiente, contentRoot: {} });
    await router.process();
    assert.deepEqual(params, ['abc123']);
  });

  test('hash vazio vira a rota home', async () => {
    const ambiente = criarAmbienteFalso('');
    const params = [];
    const routes = {
      home: { load: async () => ({ render: (c, p) => { params.push(p); return ok(() => {}); } }), exportName: 'render' },
    };
    const router = createHashRouter({ routes, ...ambiente, contentRoot: {} });
    await router.process();
    assert.deepEqual(params, ['']);
  });

  test('rota inválida devolve err(AppError ROUTE_NOT_FOUND) e chama renderError, sem montar nada', async () => {
    const ambiente = criarAmbienteFalso('#inexistente');
    const errosRenderizados = [];
    const router = createHashRouter({
      routes: {},
      ...ambiente,
      contentRoot: {},
      renderError: (root, error) => errosRenderizados.push(error),
    });
    const resultado = await router.process();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'ROUTE_NOT_FOUND');
    assert.equal(errosRenderizados.length, 1);
  });
});

describe('core/hash-router: setHash e subscription', () => {
  test('navigate() chama setHash() com a rota informada', () => {
    const ambiente = criarAmbienteFalso('#home');
    const router = createHashRouter({ routes: {}, ...ambiente, contentRoot: {} });
    router.navigate('ficha/xyz');
    assert.equal(ambiente.getHash(), '#ficha/xyz');
  });

  test('start() assina subscribeHashChange() e stop() cancela a assinatura', () => {
    const ambiente = criarAmbienteFalso('#home');
    const routes = { home: { load: async () => ({ render: () => ok(() => {}) }), exportName: 'render' } };
    const router = createHashRouter({ routes, ...ambiente, contentRoot: {} });
    assert.equal(ambiente.contarAssinantes(), 0);
    const stop = router.start();
    assert.equal(ambiente.contarAssinantes(), 1);
    stop();
    assert.equal(ambiente.contarAssinantes(), 0);
  });

  test('o router nunca acessa window/location/history diretamente (só as portas injetadas)', () => {
    const ambiente = criarAmbienteFalso('#home');
    const router = createHashRouter({ routes: {}, ...ambiente, contentRoot: {} });
    assert.equal(typeof router.start, 'function');
    assert.equal(typeof router.navigate, 'function');
    assert.equal(typeof router.process, 'function');
    // A própria criação/uso acima já prova a garantia: este teste roda em
    // Node puro (`node:test`), sem jsdom, e portanto falharia com
    // ReferenceError na primeira linha do módulo se `hash-router.js`
    // referenciasse `window`/`location`/`history` fora das portas.
  });
});

describe('core/hash-router: disposer chamado exatamente uma vez, antes da próxima rota montar', () => {
  test('disposer de "home" é chamado antes de "criar" montar', async () => {
    const ambiente = criarAmbienteFalso('#home');
    const ordem = [];
    const disposerHome = () => ordem.push('dispose-home');
    const routes = {
      home: { load: async () => ({ render: () => ok(disposerHome) }), exportName: 'render' },
      criar: {
        load: async () => ({
          render: () => {
            ordem.push('render-criar');
            return ok(() => {});
          },
        }),
        exportName: 'render',
      },
    };
    const router = createHashRouter({ routes, ...ambiente, contentRoot: {} });
    await router.process();
    ambiente.setHash('criar');
    await router.process();
    assert.deepEqual(ordem, ['dispose-home', 'render-criar']);
  });

  test('uma rota sem disposer próprio recebe o no-op explícito, nunca undefined', async () => {
    const ambiente = criarAmbienteFalso('#home');
    const routes = {
      home: { load: async () => ({ render: () => ok(undefined) }), exportName: 'render' },
    };
    const router = createHashRouter({ routes, ...ambiente, contentRoot: {} });
    // Não deve lançar ao processar a rota seguinte (o disposer guardado não
    // pode virar `undefined()`).
    await router.process();
    ambiente.setHash('home');
    await assert.doesNotReject(router.process());
  });

  test('disposer de cada uma das três rotas é chamado exatamente uma vez ao trocar de rota', async () => {
    const ambiente = criarAmbienteFalso('#home');
    const chamadasHome = [];
    const chamadasCriar = [];
    const chamadasFicha = [];
    const routes = {
      home: { load: async () => ({ render: () => ok(() => chamadasHome.push(1)) }), exportName: 'render' },
      criar: { load: async () => ({ render: () => ok(() => chamadasCriar.push(1)) }), exportName: 'render' },
      ficha: { load: async () => ({ render: () => ok(() => chamadasFicha.push(1)) }), exportName: 'render' },
    };
    const router = createHashRouter({ routes, ...ambiente, contentRoot: {} });
    await router.process();
    ambiente.setHash('criar');
    await router.process();
    ambiente.setHash('ficha/x');
    await router.process();
    ambiente.setHash('home');
    await router.process();
    assert.deepEqual(chamadasHome, [1]);
    assert.deepEqual(chamadasCriar, [1]);
    assert.deepEqual(chamadasFicha, [1]);
  });
});

describe('core/hash-router: geração — apenas a última navegação pode montar', () => {
  test('navegação rápida: a primeira geração perde a corrida e é descartada, nunca vira "a rota atual"', async () => {
    const ambiente = criarAmbienteFalso('#home');
    const rotaLenta = criarRotaControlavel();
    const montagensRapidas = [];
    const routesReais = {
      home: rotaLenta.entry,
      criar: {
        load: async () => ({
          render: () => {
            montagensRapidas.push('criar');
            return ok(() => {});
          },
        }),
        exportName: 'render',
      },
    };
    const router = createHashRouter({ routes: routesReais, ...ambiente, contentRoot: {} });
    const primeiraNavegacao = router.process(); // fica pendurada em rotaLenta.entry.load()
    ambiente.setHash('criar');
    const segundaNavegacao = router.process();
    await segundaNavegacao;
    // Só agora resolve o import da primeira navegação — ela já perdeu.
    rotaLenta.resolver();
    await primeiraNavegacao;
    assert.deepEqual(montagensRapidas, ['criar']);
    // A rota "home" nunca chegou a chamar render() (o import só resolveu
    // depois que "criar" já tinha vencido), então seu disposer nunca existiu
    // para vazar.
    assert.deepEqual(rotaLenta.chamadas, []);
  });

  test('deep link para ficha, depois home, depois ficha de novo: só a montagem final permanece', async () => {
    const ambiente = criarAmbienteFalso('#ficha/abc');
    const eventos = [];
    const routes = {
      home: { load: async () => ({ render: () => { eventos.push('mount-home'); return ok(() => eventos.push('dispose-home')); } }), exportName: 'render' },
      ficha: { load: async () => ({ render: (c, id) => { eventos.push('mount-ficha-' + id); return ok(() => eventos.push('dispose-ficha-' + id)); } }), exportName: 'render' },
    };
    const router = createHashRouter({ routes, ...ambiente, contentRoot: {} });
    await router.process();
    ambiente.setHash('home');
    await router.process();
    ambiente.setHash('ficha/abc');
    await router.process();
    assert.deepEqual(eventos, [
      'mount-ficha-abc',
      'dispose-ficha-abc',
      'mount-home',
      'dispose-home',
      'mount-ficha-abc',
    ]);
  });
});

describe('core/hash-router: erro de import/render não usa handler inline', () => {
  test('import que rejeita produz err(AppError) recuperável e chama renderError uma vez', async () => {
    const ambiente = criarAmbienteFalso('#ficha/x');
    const errosRenderizados = [];
    const routes = {
      ficha: { load: async () => { throw new Error('rede caiu'); }, exportName: 'render' },
    };
    const router = createHashRouter({
      routes,
      ...ambiente,
      contentRoot: {},
      renderError: (root, error) => errosRenderizados.push(error),
    });
    const resultado = await router.process();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'ROUTE_IMPORT_FAILED');
    assert.equal(errosRenderizados.length, 1);
    assert.equal(typeof errosRenderizados[0].message, 'string');
  });

  test('render que devolve err(...) é repassado sem que o router chame renderError de novo (a própria rota já avisou)', async () => {
    const ambiente = criarAmbienteFalso('#criar');
    const errosRenderizados = [];
    const erroDaRota = createAppError({ code: 'CREATOR_REPOSITORY_UNAVAILABLE', scope: 'pages/creator', message: 'sem repositório' });
    const routes = {
      criar: { load: async () => ({ render: () => err(erroDaRota) }), exportName: 'render' },
    };
    const router = createHashRouter({
      routes,
      ...ambiente,
      contentRoot: {},
      renderError: (root, error) => errosRenderizados.push(error),
    });
    const resultado = await router.process();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error, erroDaRota);
    assert.equal(errosRenderizados.length, 0);
  });

  test('render que lança exceção produz err(AppError) recuperável', async () => {
    const ambiente = criarAmbienteFalso('#home');
    const routes = {
      home: { load: async () => ({ render: () => { throw new Error('boom'); } }), exportName: 'render' },
    };
    const router = createHashRouter({ routes, ...ambiente, contentRoot: {} });
    const resultado = await router.process();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'ROUTE_RENDER_THREW');
  });
});
