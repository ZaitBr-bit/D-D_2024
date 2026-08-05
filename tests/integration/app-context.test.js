// Portas de PERSISTÊNCIA do composition root (Task 25).
//
// A Task 11 criou `app-context.js` e a Task 15 ligou os handlers reais; a
// Task 22b documentou o cutover de `db.js`. Esta task acrescenta repositório e
// fila de sincronização — e o que precisa ser provado é sempre o mesmo:
//
//   - cada porta é montada UMA única vez (memoizada);
//   - uma falha NÃO fica memoizada (retry continua possível);
//   - o override injetável funciona sem tocar em produção;
//   - a ausência de ambiente vira erro NOMEADO, nunca um stub silencioso que
//     "salvaria" para lugar nenhum;
//   - nenhum token de confiança vaza pelo objeto devolvido.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createAppContext, LEGACY_ALIAS_ENTITY_ID } from '../../site/js/app-context.js';
import { ok, err } from '../../site/js/core/result.js';
import { createAppError } from '../../site/js/core/errors.js';
import { createMemoryStorage } from '../helpers/memory-storage.js';

/**
 * Entidade mínima de aliases aceita por `createLegacyAliasResolver`.
 * @returns {object}
 */
function entidadeDeAliases() {
  return { id: LEGACY_ALIAS_ENTITY_ID, mappings: [{ from: 'Força', to: 'dnd2024:ability:forca' }] };
}

/**
 * Cria um contexto com o runtime de conteúdo dublado, para que estes testes
 * não dependam do catálogo real (coberto por app-context-content.test.js).
 * @param {object} [overrides]
 * @returns {object}
 */
function contexto(overrides = {}) {
  const registry = {
    /**
     * @param {string} id
     * @returns {object|null}
     */
    get: (id) => (id === LEGACY_ALIAS_ENTITY_ID ? entidadeDeAliases() : null),
  };
  return createAppContext({
    fetchFn: () => Promise.reject(new Error('nenhum fetch deveria acontecer neste teste')),
    createContentRuntime: () => Promise.resolve(ok({ registry, officialHandlerInvoker: {} })),
    officialHandlers: [],
    ...overrides,
  });
}

describe('app-context: porta de repositório de personagens', () => {
  test('monta o repositório UMA única vez e memoiza', async () => {
    let construcoes = 0;
    const contexto1 = contexto({
      storage: createMemoryStorage(),
      createCharacterRepository: () => {
        construcoes += 1;
        return { initialize: () => ok({}), marca: 'repo' };
      },
    });

    const a = await contexto1.initializeCharacterRepository();
    const b = await contexto1.initializeCharacterRepository();
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(a.value, b.value, 'a mesma instância precisa ser reaproveitada');
    assert.equal(construcoes, 1);
    assert.equal(contexto1.getCharacterRepository(), a.value);
  });

  test('duas chamadas CONCORRENTES compartilham a mesma inicialização', async () => {
    let construcoes = 0;
    const contexto1 = contexto({
      storage: createMemoryStorage(),
      createCharacterRepository: () => {
        construcoes += 1;
        return { initialize: () => ok({}) };
      },
    });
    const [a, b] = await Promise.all([
      contexto1.initializeCharacterRepository(),
      contexto1.initializeCharacterRepository(),
    ]);
    assert.equal(a.value, b.value);
    assert.equal(construcoes, 1);
  });

  test('sem storage utilizável devolve erro NOMEADO, não um stub', async () => {
    const contexto1 = contexto({ storage: null });
    const anterior = globalThis.localStorage;
    // Garante que o fallback de ambiente também está ausente.
    delete globalThis.localStorage;
    try {
      const resultado = await contexto1.initializeCharacterRepository();
      assert.equal(resultado.ok, false);
      assert.equal(resultado.error.code, 'APP_CONTEXT_STORAGE_UNAVAILABLE');
      assert.equal(contexto1.getCharacterRepository(), null);
    } finally {
      if (anterior !== undefined) {
        globalThis.localStorage = anterior;
      }
    }
  });

  test('uma falha NÃO fica memoizada: o retry pode ter sucesso', async () => {
    let tentativa = 0;
    const contexto1 = contexto({
      storage: createMemoryStorage(),
      createCharacterRepository: () => {
        tentativa += 1;
        return {
          initialize: () =>
            tentativa === 1
              ? err(createAppError({ code: 'FALHA_TRANSITORIA', scope: 'teste', message: 'Falhou.' }))
              : ok({}),
        };
      },
    });
    const primeira = await contexto1.initializeCharacterRepository();
    assert.equal(primeira.ok, false);
    assert.equal(primeira.error.code, 'FALHA_TRANSITORIA');
    const segunda = await contexto1.initializeCharacterRepository();
    assert.equal(segunda.ok, true, 'a falha não pode ficar memoizada');
  });

  test('entidade de aliases ausente no catálogo é erro nomeado', async () => {
    const contexto1 = contexto({
      storage: createMemoryStorage(),
      createContentRuntime: () => Promise.resolve(ok({ registry: { get: () => null }, officialHandlerInvoker: {} })),
    });
    const resultado = await contexto1.initializeCharacterRepository();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'APP_CONTEXT_ALIAS_ENTITY_MISSING');
  });
});

describe('app-context: porta de fila de sincronização', () => {
  test('sem gateway (usuário não autenticado) devolve erro nomeado', async () => {
    const contexto1 = contexto({ storage: createMemoryStorage() });
    const resultado = await contexto1.initializeSyncQueue({});
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'APP_CONTEXT_SYNC_GATEWAY_UNAVAILABLE');
    assert.equal(contexto1.getSyncQueue(), null);
  });

  test('monta a fila UMA única vez, sobre o repositório já inicializado', async () => {
    let construcoes = 0;
    const repositorio = { initialize: () => ok({}), get: () => ok(null), list: () => ok([]) };
    const contexto1 = contexto({
      storage: createMemoryStorage(),
      createCharacterRepository: () => repositorio,
      createSyncQueuePort: (params) => {
        construcoes += 1;
        assert.equal(params.characterRepository, repositorio, 'a fila recebe o repositório do contexto');
        assert.equal(typeof params.codec.decode, 'function');
        return { marca: 'fila' };
      },
    });
    const gateway = { uid: 'u1', upsert: () => {}, list: () => {}, remove: () => {} };
    const portas = { gateway, connectivity: { isOnline: () => true }, scheduler: { schedule: () => {}, cancel: () => {} } };

    const a = await contexto1.initializeSyncQueue(portas);
    const b = await contexto1.initializeSyncQueue(portas);
    assert.equal(a.ok, true);
    assert.equal(a.value, b.value);
    assert.equal(construcoes, 1);
    assert.equal(contexto1.getSyncQueue(), a.value);
  });

  test('duas chamadas CONCORRENTES compartilham a mesma inicialização da fila', async () => {
    // Regressão: `initializeSyncQueue` tem um `await` no meio (o repositório).
    // Memoizar só o RESULTADO deixava duas chamadas concorrentes atravessarem
    // a guarda antes de qualquer atribuição, produzindo DUAS filas sobre o
    // mesmo storage e o mesmo gateway — cada uma agendando flush do mesmo
    // backlog, duplicando mutações no remoto.
    let construcoes = 0;
    const contexto1 = contexto({
      storage: createMemoryStorage(),
      createCharacterRepository: () => ({ initialize: () => ok({}), get: () => ok(null) }),
      createSyncQueuePort: () => {
        construcoes += 1;
        return { marca: `fila-${construcoes}` };
      },
    });
    const portas = {
      gateway: { uid: 'u1', upsert: () => {} },
      connectivity: { isOnline: () => true },
      scheduler: { schedule: () => {}, cancel: () => {} },
    };

    const [a, b, c] = await Promise.all([
      contexto1.initializeSyncQueue(portas),
      contexto1.initializeSyncQueue(portas),
      contexto1.initializeSyncQueue(portas),
    ]);
    assert.equal(a.ok, true);
    assert.equal(construcoes, 1, 'a fila só pode ser construída UMA vez');
    assert.equal(a.value, b.value);
    assert.equal(b.value, c.value);
    assert.equal(contexto1.getSyncQueue(), a.value);
  });

  test('uma falha da fila NÃO fica memoizada: o retry pode ter sucesso', async () => {
    let tentativa = 0;
    const contexto1 = contexto({
      storage: createMemoryStorage(),
      createCharacterRepository: () => ({ initialize: () => ok({}) }),
      createSyncQueuePort: () => {
        tentativa += 1;
        if (tentativa === 1) {
          throw new Error('falha transitória');
        }
        return { marca: 'fila' };
      },
    });
    const portas = {
      gateway: { upsert: () => {} },
      connectivity: { isOnline: () => true },
      scheduler: { schedule: () => {}, cancel: () => {} },
    };
    const primeira = await contexto1.initializeSyncQueue(portas);
    assert.equal(primeira.ok, false);
    assert.equal(primeira.error.code, 'APP_CONTEXT_SYNC_QUEUE_INITIALIZATION_FAILED');
    const segunda = await contexto1.initializeSyncQueue(portas);
    assert.equal(segunda.ok, true);
  });

  test('a fila não é montada quando o repositório falha', async () => {
    const contexto1 = contexto({ storage: null });
    const anterior = globalThis.localStorage;
    delete globalThis.localStorage;
    try {
      const resultado = await contexto1.initializeSyncQueue({
        gateway: { upsert: () => {} },
        connectivity: { isOnline: () => true },
        scheduler: { schedule: () => {}, cancel: () => {} },
      });
      assert.equal(resultado.ok, false);
      assert.equal(resultado.error.code, 'APP_CONTEXT_STORAGE_UNAVAILABLE');
      assert.equal(contexto1.getSyncQueue(), null);
    } finally {
      if (anterior !== undefined) {
        globalThis.localStorage = anterior;
      }
    }
  });
});

describe('app-context: nenhuma capacidade vaza pelas portas novas', () => {
  test('o objeto devolvido não expõe issue/verify/capabilities', () => {
    const contexto1 = contexto();
    const chaves = Object.keys(contexto1).sort();
    assert.deepEqual(chaves, [
      'getCharacterRepository',
      'getContentRegistry',
      'getOfficialHandlerInvoker',
      'getSyncQueue',
      'initializeCharacterRepository',
      'initializeContent',
      'initializeSyncQueue',
    ]);
    for (const proibido of ['issue', 'verify', 'capabilities', 'officialHandlers']) {
      assert.equal(contexto1[proibido], undefined, `"${proibido}" não pode ser alcançável`);
    }
    assert.ok(Object.isFrozen(contexto1));
  });

  test('o repositório não recebe nenhuma capacidade oficial', async () => {
    let recebido = null;
    const contexto1 = contexto({
      storage: createMemoryStorage(),
      createCharacterRepository: (params) => {
        recebido = params;
        return { initialize: () => ok({}) };
      },
    });
    await contexto1.initializeCharacterRepository();
    assert.deepEqual(Object.keys(recebido).sort(), ['aliasResolver', 'backupService', 'clock', 'storage']);
  });
});
