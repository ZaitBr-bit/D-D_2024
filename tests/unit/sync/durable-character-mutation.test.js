// ============================================================
// Testes de `infra/sync/durable-character-mutation`: o protocolo
// preparar -> gravar localmente -> confirmar, que garante que uma falha ao
// regravar a fila DEPOIS do save local não perca o intent de sincronizar
// (nem libere um job cujo save local falhou).
// ============================================================
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ok, err } from '../../../site/js/core/result.js';
import { createAppError } from '../../../site/js/core/errors.js';
import { createDurableCharacterMutation } from '../../../site/js/infra/sync/durable-character-mutation.js';

const CHAR = Object.freeze({
  identity: { id: 'c1' },
  metadata: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' },
});

/** Repositório falso que grava o histórico de chamadas. */
function createFakeRepository(overrides = {}) {
  const calls = [];
  return {
    calls,
    save(character, options) {
      calls.push({ op: 'save', character, options });
      return overrides.saveResult ?? ok(Object.freeze({ mode: 'editable', character, revisionToken: 'tok-novo' }));
    },
    remove(id, options) {
      calls.push({ op: 'remove', id, options });
      return overrides.removeResult ?? ok(undefined);
    },
  };
}

/** Fila falsa que grava o histórico de chamadas do protocolo. */
function createFakeQueue(overrides = {}) {
  const calls = [];
  return {
    calls,
    prepareMutation(params) {
      calls.push({ op: 'prepareMutation', params });
      return overrides.prepareResult ?? ok(Object.freeze({ preparationId: `prep-${params.characterId}`, snapshot: {} }));
    },
    confirmPrepared(preparationId) {
      calls.push({ op: 'confirmPrepared', preparationId });
      return overrides.confirmResult ?? ok(Object.freeze({ jobId: preparationId, snapshot: {} }));
    },
    abortPrepared(preparationId) {
      calls.push({ op: 'abortPrepared', preparationId });
      return overrides.abortResult ?? ok(Object.freeze({ jobId: preparationId, snapshot: {} }));
    },
  };
}

/** Monta a mutação durável com dublês e um gerador de mutationId previsível. */
function build(overrides = {}) {
  const repository = overrides.repository ?? createFakeRepository();
  const syncQueue = overrides.syncQueue ?? createFakeQueue();
  let n = 0;
  const mutationIdFactory = overrides.mutationIdFactory ?? (() => { n += 1; return `m-${n}`; });
  const durableMutation = createDurableCharacterMutation({ repository, syncQueue, mutationIdFactory });
  return { durableMutation, repository, syncQueue };
}

describe('durable-character-mutation — save', () => {
  test('ordem do protocolo: prepare -> save local -> confirm, e syncState "queued"', () => {
    const { durableMutation, repository, syncQueue } = build();
    const resultado = durableMutation.save(CHAR, { expectedRevisionToken: 'tok-atual', reason: 'user' });

    assert.equal(resultado.ok, true);
    assert.equal(resultado.value.syncState, 'queued');
    assert.equal(resultado.value.envelope.revisionToken, 'tok-novo');

    assert.deepEqual(syncQueue.calls.map((c) => c.op), ['prepareMutation', 'confirmPrepared']);
    assert.equal(repository.calls.length, 1);
    assert.equal(syncQueue.calls[0].params.operation, 'upsert');
    assert.equal(syncQueue.calls[0].params.characterId, 'c1');
    assert.equal(syncQueue.calls[0].params.expectedRevisionToken, 'tok-atual');
  });

  test('o mutationId preparado é exatamente o gravado como marker local', () => {
    const { durableMutation, repository, syncQueue } = build();
    durableMutation.save(CHAR, { expectedRevisionToken: null, reason: 'user' });

    const preparado = syncQueue.calls[0].params.mutationId;
    assert.equal(typeof preparado, 'string');
    assert.equal(repository.calls[0].options.localSyncMutationId, preparado);
    assert.equal(repository.calls[0].options.reason, 'user');
  });

  test('falha no prepare IMPEDE a escrita local', () => {
    const syncQueue = createFakeQueue({
      prepareResult: err(createAppError({ code: 'SYNC_QUEUE_WRITE_FAILED', scope: 'test', message: 'sem espaço' })),
    });
    const { durableMutation, repository } = build({ syncQueue });

    const resultado = durableMutation.save(CHAR, { expectedRevisionToken: null, reason: 'user' });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SYNC_QUEUE_WRITE_FAILED');
    assert.deepEqual(repository.calls, [], 'nada pode ser gravado localmente sem preparo durável');
  });

  test('falha do save local NUNCA libera o job e ABORTA o preparo', () => {
    const repository = createFakeRepository({
      saveResult: err(createAppError({ code: 'CHARACTER_SAVE_REVISION_CONFLICT', scope: 'test', message: 'conflito' })),
    });
    const { durableMutation, syncQueue } = build({ repository });

    const resultado = durableMutation.save(CHAR, { expectedRevisionToken: 'tok', reason: 'user' });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CHARACTER_SAVE_REVISION_CONFLICT');
    assert.deepEqual(
      syncQueue.calls.map((c) => c.op),
      ['prepareMutation', 'abortPrepared'],
      'o job nunca é confirmado E o preparo é desfeito na hora, sem deixar um "prepared" órfão',
    );
    assert.equal(syncQueue.calls[1].preparationId, 'prep-c1');
  });

  test('aborto que falha não mascara o erro do save local (a fila sinaliza por conta própria)', () => {
    const repository = createFakeRepository({
      saveResult: err(createAppError({ code: 'CHARACTER_SAVE_REVISION_CONFLICT', scope: 'test', message: 'conflito' })),
    });
    const syncQueue = createFakeQueue({
      abortResult: err(createAppError({ code: 'SYNC_QUEUE_WRITE_FAILED', scope: 'test', message: 'sem espaço' })),
    });
    const { durableMutation } = build({ repository, syncQueue });

    const resultado = durableMutation.save(CHAR, { expectedRevisionToken: 'tok', reason: 'user' });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CHARACTER_SAVE_REVISION_CONFLICT', 'o chamador continua vendo a causa real');
  });

  test('save válido + falha de confirmPrepared mantém o estado adotado e sinaliza reconciliação', () => {
    const syncQueue = createFakeQueue({
      confirmResult: err(createAppError({ code: 'SYNC_QUEUE_WRITE_FAILED', scope: 'test', message: 'sem espaço' })),
    });
    const { durableMutation } = build({ syncQueue });

    const resultado = durableMutation.save(CHAR, { expectedRevisionToken: null, reason: 'user' });
    assert.equal(resultado.ok, true, 'o save local válido não pode ser revertido por falha da fila');
    assert.equal(resultado.value.syncState, 'reconciliation-needed');
    assert.equal(resultado.value.envelope.revisionToken, 'tok-novo');
  });

  test('personagem sem identity.id é recusado antes de qualquer efeito', () => {
    const { durableMutation, repository, syncQueue } = build();
    const resultado = durableMutation.save({ metadata: {} }, { expectedRevisionToken: null, reason: 'user' });

    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'DURABLE_MUTATION_INVALID_INPUT');
    assert.deepEqual(repository.calls, []);
    assert.deepEqual(syncQueue.calls, []);
  });

  test('cada save usa um mutationId novo', () => {
    const { durableMutation, syncQueue } = build();
    durableMutation.save(CHAR, { expectedRevisionToken: null, reason: 'user' });
    durableMutation.save(CHAR, { expectedRevisionToken: 'tok-novo', reason: 'user' });

    const ids = syncQueue.calls.filter((c) => c.op === 'prepareMutation').map((c) => c.params.mutationId);
    assert.equal(ids.length, 2);
    assert.notEqual(ids[0], ids[1]);
  });
});

describe('durable-character-mutation — remove', () => {
  test('ordem do protocolo e syncState "queued"', () => {
    const { durableMutation, repository, syncQueue } = build();
    const resultado = durableMutation.remove('c1', { expectedRevisionToken: 'tok-atual' });

    assert.equal(resultado.ok, true);
    assert.equal(resultado.value.syncState, 'queued');
    assert.deepEqual(syncQueue.calls.map((c) => c.op), ['prepareMutation', 'confirmPrepared']);
    assert.equal(syncQueue.calls[0].params.operation, 'remove');
    assert.equal(syncQueue.calls[0].params.expectedRevisionToken, 'tok-atual');
    assert.deepEqual(repository.calls, [{ op: 'remove', id: 'c1', options: { expectedRevisionToken: 'tok-atual' } }]);
  });

  test('falha no prepare impede a remoção local', () => {
    const syncQueue = createFakeQueue({
      prepareResult: err(createAppError({ code: 'SYNC_QUEUE_WRITE_FAILED', scope: 'test', message: 'x' })),
    });
    const { durableMutation, repository } = build({ syncQueue });

    const resultado = durableMutation.remove('c1', { expectedRevisionToken: 'tok' });
    assert.equal(resultado.ok, false);
    assert.deepEqual(repository.calls, []);
  });

  test('falha da remoção local não libera o job', () => {
    const repository = createFakeRepository({
      removeResult: err(createAppError({ code: 'CHARACTER_REMOVE_REVISION_CONFLICT', scope: 'test', message: 'x' })),
    });
    const { durableMutation, syncQueue } = build({ repository });

    const resultado = durableMutation.remove('c1', { expectedRevisionToken: 'tok' });
    assert.equal(resultado.ok, false);
    assert.deepEqual(syncQueue.calls.map((c) => c.op), ['prepareMutation', 'abortPrepared']);
  });

  test('remoção local válida + falha de confirmPrepared sinaliza reconciliação', () => {
    const syncQueue = createFakeQueue({
      confirmResult: err(createAppError({ code: 'SYNC_QUEUE_WRITE_FAILED', scope: 'test', message: 'x' })),
    });
    const { durableMutation } = build({ syncQueue });

    const resultado = durableMutation.remove('c1', { expectedRevisionToken: 'tok' });
    assert.equal(resultado.ok, true);
    assert.equal(resultado.value.syncState, 'reconciliation-needed');
  });

  test('remoção exige expectedRevisionToken (precondição do repositório)', () => {
    const { durableMutation, repository, syncQueue } = build();
    const resultado = durableMutation.remove('c1', {});

    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'DURABLE_MUTATION_INVALID_INPUT');
    assert.deepEqual(repository.calls, []);
    assert.deepEqual(syncQueue.calls, []);
  });
});

describe('durable-character-mutation — construção', () => {
  test('dependências ausentes são defeito de programação (TypeError)', () => {
    assert.throws(() => createDurableCharacterMutation({}), TypeError);
    assert.throws(() => createDurableCharacterMutation({ repository: createFakeRepository() }), TypeError);
  });
});
