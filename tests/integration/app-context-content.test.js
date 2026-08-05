// Integração do composition root com o catálogo de conteúdo oficial
// (Task 11, atualizada na Task 15).
//
// O que este teste prova:
//   1. `app-context.js` separa `issue` de `verify`: o executor de handlers só
//      recebe `verify` e nunca consegue emitir a própria autorização; o
//      emissor (`issue`) nunca chega ao executor.
//   2. O catálogo real (`dados/pacotes/dnd2024/**`, 1511 entidades) é ativado
//      de verdade pela fonte HTTP, com validação de schema/referências.
//   3. O registry REAL de handlers oficiais (Task 15) executa um handler
//      registrado de ponta a ponta (`issue` no invoker -> `verify` no
//      registry) e recusa, de forma estruturada, um `handlerId` que ninguém
//      registrou (`OFFICIAL_HANDLER_NOT_REGISTERED`) — nem crash, nem no-op.
//   4. Nenhuma capacidade é obtenível a partir do contexto devolvido nem de
//      dados JSON.
//
// Todo `fetch` é injetado: o teste serve os arquivos do pacote do disco.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createAppContext,
  createOfficialHandlerRegistry,
  appContext as appContextPadrao,
} from '../../site/js/app-context.js';
import { OFFICIAL_CONTENT_BASE_URL } from '../../site/js/infra/config.js';
import { createOfficialContentRuntime } from '../../site/js/infra/content/official-content-registry.js';
import { hasOfficialHandlersCapability } from '../../site/js/content/capabilities.js';
import { createDiskFetch, installFetchTrap } from '../helpers/disk-fetch.js';

// Entidade real do pacote que declara um handler oficial (`asi-or-feat`).
const ENTIDADE_COM_HANDLER = 'dnd2024:feature:barbaro-aumento-no-valor-de-atributo-4';
const HANDLER_DECLARADO = 'asi-or-feat';

let armadilhaFetch;

before(() => {
  armadilhaFetch = installFetchTrap(
    'fetch global foi chamado: todo carregamento deve usar o fetchFn injetado.',
  );
});

after(() => {
  armadilhaFetch.restore();
  assert.equal(armadilhaFetch.count(), 0, 'nenhum teste pode ter usado o fetch global');
});

describe('app-context: ativação do catálogo oficial', () => {
  let contexto;
  let registry;
  // Rastreamento PRÓPRIO deste describe: nada aqui depende da ordem em que os
  // describes do arquivo rodam nem de estado compartilhado entre eles.
  let caminhosPedidos;

  before(async () => {
    const disco = createDiskFetch();
    caminhosPedidos = disco.requests;
    contexto = createAppContext({ fetchFn: disco.fetchFn });
    const resultado = await contexto.initializeContent();
    assert.equal(
      resultado.ok,
      true,
      `a ativação do catálogo oficial falhou: ${JSON.stringify(resultado.error ?? null, null, 1)}`,
    );
    registry = resultado.value;
  });

  test('devolve o ContentRegistry com os sete métodos públicos', () => {
    assert.deepEqual(
      Object.keys(registry).sort(),
      ['get', 'initialize', 'list', 'registerSource', 'resolve', 'validateEntity', 'validatePackage'].sort(),
    );
  });

  test('publica o pacote oficial completo (1511 entidades)', () => {
    const indice = JSON.parse(readFileSync(new URL('index.json', OFFICIAL_CONTENT_BASE_URL), 'utf8'));
    assert.equal(registry.list().length, indice.entries.length);
    assert.equal(indice.entries.length, 1511);
  });

  test('resolve entidades reais de vários tipos', () => {
    for (const [id, tipo] of [
      ['dnd2024:ruleset:core', 'ruleset'],
      ['dnd2024:class:barbaro', 'class'],
      ['dnd2024:subclass:trilha-do-berserker', 'subclass'],
      ['dnd2024:species:aasimar', 'species'],
      ['dnd2024:background:acolito', 'background'],
      ['dnd2024:feat:adepto-elemental', 'feat'],
      ['dnd2024:spell:bola-de-fogo', 'spell'],
      ['dnd2024:weapon:adaga', 'weapon'],
      ['dnd2024:armor:acolchoada', 'armor'],
      ['dnd2024:creature:alce', 'creature'],
      ['dnd2024:glossary-entry:acao', 'glossary-entry'],
    ]) {
      const resolvido = registry.resolve(id, tipo);
      assert.equal(resolvido.ok, true, `não resolveu ${id}: ${JSON.stringify(resolvido.error ?? null)}`);
      assert.equal(resolvido.value.type, tipo);
    }
  });

  test('só pede arquivos dentro de dados/pacotes/dnd2024/', () => {
    assert.equal(caminhosPedidos.length > 0, true);
    for (const url of caminhosPedidos) {
      assert.equal(
        url.startsWith(OFFICIAL_CONTENT_BASE_URL.href),
        true,
        `requisição fora do pacote oficial: ${url}`,
      );
    }
  });

  test('cada arquivo-coleção é buscado uma única vez (cache por caminho)', () => {
    const unicos = new Set(caminhosPedidos);
    assert.equal(
      unicos.size,
      caminhosPedidos.length,
      `houve requisição repetida: ${caminhosPedidos.length} chamadas para ${unicos.size} caminhos`,
    );
    // manifest + index + 49 arquivos de conteúdo
    assert.equal(unicos.size < 60, true, `esperado ~51 arquivos, houve ${unicos.size}`);
  });

  test('initializeContent é idempotente e devolve o mesmo registry', async () => {
    const segunda = await contexto.initializeContent();
    assert.equal(segunda.ok, true);
    assert.equal(segunda.value, registry);
    assert.equal(contexto.getContentRegistry(), registry);
  });

  test('registry e officialHandlerInvoker são portas distintas', () => {
    const invoker = contexto.getOfficialHandlerInvoker();
    assert.notEqual(invoker, registry);
    assert.deepEqual(Object.keys(invoker), ['invoke']);
    assert.equal(typeof registry.invoke, 'undefined', 'o registry não pode invocar handler');
    assert.equal(typeof invoker.list, 'undefined', 'o invoker não pode consultar conteúdo');
  });
});

describe('app-context: registry real de handlers oficiais (Task 15)', () => {
  let contexto;
  const chamadas = [];

  before(async () => {
    chamadas.length = 0;
    contexto = createAppContext({
      fetchFn: createDiskFetch().fetchFn,
      // Handler de teste registrado pelo composition root, com o MESMO
      // handlerId que a entidade real do pacote declara.
      officialHandlers: [
        {
          handlerId: HANDLER_DECLARADO,
          handler: (request) => {
            chamadas.push(request);
            return { ok: true, value: { executado: request.operation } };
          },
        },
      ],
    });
    const resultado = await contexto.initializeContent();
    assert.equal(resultado.ok, true);
  });

  test('handler registrado é executado de ponta a ponta (issue no invoker, verify no registry)', () => {
    const resultado = contexto.getOfficialHandlerInvoker().invoke({
      entityId: ENTIDADE_COM_HANDLER,
      handlerId: HANDLER_DECLARADO,
      operation: 'apply',
      payload: { escolha: 'feat' },
    });
    assert.equal(resultado.ok, true, JSON.stringify(resultado.error ?? null));
    assert.deepEqual(resultado.value, { executado: 'apply' });
    assert.equal(chamadas.length, 1);
    assert.deepEqual(chamadas[0].payload, { escolha: 'feat' });
    // O handler NUNCA recebe a autorização.
    assert.equal('authorization' in chamadas[0], false);
  });

  test('cada invocação emite a própria autorização de uso único', () => {
    const antes = chamadas.length;
    const primeira = contexto.getOfficialHandlerInvoker().invoke({
      entityId: ENTIDADE_COM_HANDLER,
      handlerId: HANDLER_DECLARADO,
      operation: 'apply',
    });
    const segunda = contexto.getOfficialHandlerInvoker().invoke({
      entityId: ENTIDADE_COM_HANDLER,
      handlerId: HANDLER_DECLARADO,
      operation: 'apply',
    });
    assert.equal(primeira.ok, true);
    assert.equal(segunda.ok, true, 'a autorização de uso único é reemitida a cada invoke');
    assert.equal(chamadas.length, antes + 2);
  });

  test('handlerId que ninguém registrou falha com OFFICIAL_HANDLER_NOT_REGISTERED', async () => {
    const semHandlers = createAppContext({ fetchFn: createDiskFetch().fetchFn });
    assert.equal((await semHandlers.initializeContent()).ok, true);
    const resultado = semHandlers.getOfficialHandlerInvoker().invoke({
      entityId: ENTIDADE_COM_HANDLER,
      handlerId: HANDLER_DECLARADO,
      operation: 'apply',
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'OFFICIAL_HANDLER_NOT_REGISTERED');
    assert.equal(resultado.error.context.entityId, ENTIDADE_COM_HANDLER);
    assert.equal(resultado.error.context.handlerId, HANDLER_DECLARADO);
  });

  test('handler não declarado pela entidade é recusado ANTES de qualquer emissão', () => {
    const antes = chamadas.length;
    const resultado = contexto.getOfficialHandlerInvoker().invoke({
      entityId: ENTIDADE_COM_HANDLER,
      handlerId: 'handler-que-a-entidade-nao-declara',
      operation: 'apply',
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'OFFICIAL_HANDLER_NOT_DECLARED');
    assert.equal(chamadas.length, antes);
  });

  test('entidade inexistente é recusada sem tocar no handler registry', () => {
    const antes = chamadas.length;
    const resultado = contexto.getOfficialHandlerInvoker().invoke({
      entityId: 'dnd2024:feature:nao-existe',
      handlerId: HANDLER_DECLARADO,
      operation: 'apply',
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'OFFICIAL_HANDLER_ENTITY_NOT_FOUND');
    assert.equal(chamadas.length, antes);
  });

  test('nenhum AppError de handler serializa a autorização nem o token de capacidade', () => {
    const resultado = contexto.getOfficialHandlerInvoker().invoke({
      entityId: ENTIDADE_COM_HANDLER,
      handlerId: 'handler-que-a-entidade-nao-declara',
      operation: 'apply',
    });
    const serializado = JSON.stringify(resultado.error);
    assert.equal(/authorization"\s*:/.test(serializado), false);
    assert.equal(serializado.includes('Symbol'), false);
  });
});

describe('registry real de handlers: separação issue/verify', () => {
  test('o executor recebe somente verify e não consegue emitir autorização', () => {
    const recebidos = [];
    const handlerRegistry = createOfficialHandlerRegistry(
      (autorizacao, escopo) => {
        recebidos.push({ autorizacao, escopo });
        return true;
      },
      [{ handlerId: 'h', handler: () => ({ ok: true, value: 'executou' }) }],
    );
    // Superficie fechada: nada de invoke() sem autorizacao, nada de issue.
    assert.deepEqual(Object.keys(handlerRegistry).sort(), ['invokeAuthorized', 'register']);
    assert.equal(typeof handlerRegistry.invoke, 'undefined');
    assert.equal(typeof handlerRegistry.issue, 'undefined');

    const resultado = handlerRegistry.invokeAuthorized({
      authorization: {},
      entityId: 'ns:feature:x',
      handlerId: 'h',
      operation: 'apply',
    });
    assert.equal(resultado.ok, true);
    assert.equal(recebidos.length, 1, 'o registry deve consumir a autorização via verify');
    assert.deepEqual(recebidos[0].escopo, { entityId: 'ns:feature:x', handlerId: 'h', operation: 'apply' });
  });

  test('autorização recusada por verify impede a execução do handler', () => {
    let executou = false;
    const handlerRegistry = createOfficialHandlerRegistry(() => false, [
      {
        handlerId: 'h',
        handler: () => {
          executou = true;
          return { ok: true, value: null };
        },
      },
    ]);
    const resultado = handlerRegistry.invokeAuthorized({
      authorization: { falsificada: true },
      entityId: 'ns:feature:x',
      handlerId: 'h',
      operation: 'apply',
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'OFFICIAL_HANDLER_NOT_AUTHORIZED');
    assert.equal(executou, false);
  });

  test('exige verify como função e falha alto num registro malformado', () => {
    assert.throws(() => createOfficialHandlerRegistry(undefined), /verify/);
    assert.throws(() => createOfficialHandlerRegistry({ verify: () => true }), /verify/);
    assert.throws(
      () => createOfficialHandlerRegistry(() => true, [{ handlerId: 'Nao Slug', handler: () => {} }]),
      /registro recusado/,
    );
    assert.throws(
      () => createOfficialHandlerRegistry(() => true, [{ handlerId: 'h', handler: 'nope' }]),
      /registro recusado/,
    );
  });
});

describe('app-context: fronteira de capacidade', () => {
  // A Task 25 acrescentou as portas de persistência (repositório e fila de
  // sincronização) ao contexto. A lista é fixada AQUI de propósito: qualquer
  // export novo do composition root passa obrigatoriamente por este teste,
  // que é o guarda de "nada além de funções, nenhuma capacidade".
  test('o contexto expõe apenas as portas conhecidas e nenhuma capacidade', () => {
    const contexto = createAppContext({ fetchFn: createDiskFetch().fetchFn });
    assert.deepEqual(Object.keys(contexto).sort(), [
      'getCharacterRepository',
      'getContentRegistry',
      'getOfficialHandlerInvoker',
      'getSyncQueue',
      'initializeCharacterRepository',
      'initializeContent',
      'initializeSyncQueue',
    ]);
    for (const valor of Object.values(contexto)) {
      assert.equal(typeof valor, 'function');
    }
    assert.equal(JSON.stringify(contexto), '{}', 'nada do contexto deve ser serializável');
  });

  test('nenhuma capacidade forjada a partir de JSON concede o namespace oficial', async () => {
    const forjada = Object.freeze({ namespace: 'dnd2024', officialHandlers: Symbol('falso') });
    assert.equal(hasOfficialHandlersCapability(forjada), false);
    const resultado = await createOfficialContentRuntime({
      fetchFn: createDiskFetch().fetchFn,
      handlerRegistry: { invokeAuthorized: () => ({ ok: true, value: null }) },
      capabilities: forjada,
      issueOfficialHandlerAuthorization: () => ({}),
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CONTENT_CAPABILITIES_INVALID');
  });

  test('app-context.js é o ÚNICO módulo de produção que menciona as duas fábricas', () => {
    // A regra estática vive em scripts/check-architecture.mjs (Task 6); esta
    // asserção existe para que a criação real de `app-context.js` nesta tarefa
    // não afrouxe a fronteira sem que um teste perceba.
    const siteJs = fileURLToPath(new URL('../../site/js/', import.meta.url));
    const arquivos = [];
    /** Varre recursivamente os arquivos .js de `site/js`. */
    const varrer = (dir) => {
      for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        const caminho = join(dir, entrada.name);
        if (entrada.isDirectory()) varrer(caminho);
        else if (entrada.isFile() && entrada.name.endsWith('.js')) arquivos.push(caminho);
      }
    };
    varrer(siteJs);
    assert.equal(arquivos.length > 30, true, 'a varredura deveria achar o site inteiro');

    const definidores = new Map([
      ['createOfficialSourceCapabilities', join(siteJs, 'content', 'capabilities.js')],
      ['createOfficialHandlerAuthorizationChannel', join(siteJs, 'content', 'official-handler-authorization.js')],
    ]);
    const compositionRoot = join(siteJs, 'app-context.js');

    for (const [fabrica, definidor] of definidores) {
      const mencionam = arquivos.filter((arquivo) => {
        const fonte = readFileSync(arquivo, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, ' ')
          .replace(/(^|[^:])\/\/.*$/gm, '$1');
        return new RegExp(`\\b${fabrica}\\b`).test(fonte);
      });
      assert.deepEqual(
        [...mencionam].sort(),
        [compositionRoot, definidor].sort(),
        `somente app-context.js e o módulo que define ${fabrica} podem mencioná-la`,
      );
    }
  });

  test('nem a fonte HTTP nem a fábrica do runtime conhecem a capacidade oficial', () => {
    const siteJs = new URL('../../site/js/', import.meta.url);
    for (const relativo of ['infra/content/http-content-source.js', 'infra/content/official-content-registry.js']) {
      // Comentários mencionam as duas fábricas de propósito (documentam a
      // fronteira); o que não pode existir é IMPORT, então a comparação é feita
      // sobre o código sem comentários.
      const fonte = readFileSync(fileURLToPath(new URL(relativo, siteJs)), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      assert.equal(/capabilities\.js/.test(fonte), false, `${relativo} não pode importar capabilities.js`);
      assert.equal(
        /official-handler-authorization\.js/.test(fonte),
        false,
        `${relativo} não pode importar o canal de autorização`,
      );
    }
  });

  test('o contexto padrão existe e não faz I/O ao ser criado', () => {
    assert.equal(typeof appContextPadrao.initializeContent, 'function');
    assert.equal(appContextPadrao.getContentRegistry(), null);
    assert.equal(appContextPadrao.getOfficialHandlerInvoker(), null);
  });

  test('cada contexto tem o próprio canal: autorização de um não vale no outro', async () => {
    // Dois contextos diferentes, cada um com seu canal `issue`/`verify`.
    const autorizacoesEmitidas = [];
    const contextoA = createAppContext({
      fetchFn: createDiskFetch().fetchFn,
      createContentRuntime: async ({ issueOfficialHandlerAuthorization }) => {
        autorizacoesEmitidas.push(
          issueOfficialHandlerAuthorization({ entityId: 'ns:f:x', handlerId: 'h', operation: 'apply' }),
        );
        return { ok: true, value: { registry: {}, officialHandlerInvoker: {} } };
      },
    });
    let verifyDoContextoB;
    const contextoB = createAppContext({
      fetchFn: createDiskFetch().fetchFn,
      createHandlerRegistry: (verify) => {
        verifyDoContextoB = verify;
        return createOfficialHandlerRegistry(verify);
      },
      createContentRuntime: async () => ({ ok: true, value: { registry: {}, officialHandlerInvoker: {} } }),
    });
    await contextoA.initializeContent();
    await contextoB.initializeContent();

    assert.equal(autorizacoesEmitidas.length, 1);
    assert.equal(
      verifyDoContextoB(autorizacoesEmitidas[0], { entityId: 'ns:f:x', handlerId: 'h', operation: 'apply' }),
      false,
      'a autorização do contexto A não pode ser aceita pelo canal do contexto B',
    );
  });
});

describe('app-context: falhas de inicialização', () => {
  test('falha de rede devolve err e permite retry', async () => {
    let tentativa = 0;
    const contexto = createAppContext({
      fetchFn: async (url, init) => {
        tentativa += 1;
        if (tentativa === 1) {
          throw new TypeError('Failed to fetch');
        }
        return createDiskFetch().fetchFn(url, init);
      },
    });
    const primeira = await contexto.initializeContent();
    assert.equal(primeira.ok, false);
    assert.equal(contexto.getContentRegistry(), null);

    const segunda = await contexto.initializeContent();
    assert.equal(segunda.ok, true, `o retry deveria funcionar: ${JSON.stringify(segunda.error ?? null)}`);
  });

  test('AbortSignal já abortado interrompe a ativação com err', async () => {
    const controller = new AbortController();
    controller.abort();
    const contexto = createAppContext({ fetchFn: createDiskFetch().fetchFn });
    const resultado = await contexto.initializeContent({ signal: controller.signal });
    assert.equal(resultado.ok, false);
    assert.equal(contexto.getContentRegistry(), null);
  });

  test('exceção na montagem do runtime vira Result de erro', async () => {
    const contexto = createAppContext({
      fetchFn: createDiskFetch().fetchFn,
      createContentRuntime: async () => {
        throw new Error('explodiu');
      },
    });
    const resultado = await contexto.initializeContent();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'APP_CONTEXT_CONTENT_INITIALIZATION_FAILED');
  });
});
