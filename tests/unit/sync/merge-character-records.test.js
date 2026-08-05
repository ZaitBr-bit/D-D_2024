// ============================================================
// Testes de `infra/sync/merge-character-records`: merge determinístico
// entre a lista local e a lista remota por `atualizado_em`, incluindo a
// regra estrita de timestamp ausente/vazio/não-ISO (conflito retido, nunca
// vencedor silencioso) e o cálculo de `toUpsert` (local estritamente mais
// novo precisa ser REENVIADO, não só adotado).
// ============================================================
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { mergeCharacterRecords } from '../../../site/js/infra/sync/merge-character-records.js';

/** Monta um envelope local (formato devolvido por `repository.list()`). */
function local(id, atualizadoEm, extra = {}) {
  return {
    mode: 'editable',
    character: {
      identity: { id },
      metadata: atualizadoEm === undefined ? {} : { updatedAt: atualizadoEm },
    },
    rawRecord: { id, atualizado_em: atualizadoEm },
    localSync: extra.localSync ?? null,
    revisionToken: `tok-${id}`,
    ...extra,
  };
}

/** Monta um envelope remoto (formato devolvido por `gateway.list()`). */
function remote(id, atualizadoEm, extra = {}) {
  return {
    characterId: id,
    mode: 'editable',
    character: {
      identity: { id },
      metadata: atualizadoEm === undefined ? {} : { updatedAt: atualizadoEm },
    },
    rawRecord: { id, atualizado_em: atualizadoEm },
    ...extra,
  };
}

/** Índice `id -> registro` do resultado do merge, para asserções diretas. */
function porId(merged) {
  return new Map(merged.map((r) => [r.character?.identity?.id ?? r.rawRecord?.id, r]));
}

describe('mergeCharacterRecords — vencedor por atualizado_em', () => {
  test('local estritamente mais novo vence E entra em toUpsert (precisa ser reenviado)', () => {
    const resultado = mergeCharacterRecords({
      localRecords: [local('a', '2026-02-01T00:00:00.000Z')],
      remoteRecords: [remote('a', '2026-01-01T00:00:00.000Z')],
      pendingDeletionIds: [],
    });

    assert.equal(resultado.merged.length, 1);
    assert.equal(porId(resultado.merged).get('a').character.metadata.updatedAt, '2026-02-01T00:00:00.000Z');
    assert.deepEqual([...resultado.toUpsert], ['a']);
    assert.deepEqual([...resultado.toRemoveLocally], []);
    assert.deepEqual([...resultado.warnings], []);
  });

  test('remoto mais novo vence e NÃO entra em toUpsert', () => {
    const resultado = mergeCharacterRecords({
      localRecords: [local('a', '2026-01-01T00:00:00.000Z')],
      remoteRecords: [remote('a', '2026-03-01T00:00:00.000Z')],
      pendingDeletionIds: [],
    });

    assert.equal(porId(resultado.merged).get('a').character.metadata.updatedAt, '2026-03-01T00:00:00.000Z');
    assert.deepEqual([...resultado.toUpsert], []);
  });

  test('empate exato preserva o baseline remoto (remoto vence) e não reenvia', () => {
    const mesmoInstante = '2026-01-01T00:00:00.000Z';
    const resultado = mergeCharacterRecords({
      localRecords: [local('a', mesmoInstante, { rawRecord: { id: 'a', atualizado_em: mesmoInstante, marca: 'local' } })],
      remoteRecords: [remote('a', mesmoInstante, { rawRecord: { id: 'a', atualizado_em: mesmoInstante, marca: 'remoto' } })],
      pendingDeletionIds: [],
    });

    assert.deepEqual([...resultado.toUpsert], []);
    assert.equal(resultado.merged.length, 1);
    assert.equal(resultado.merged[0].origin, 'remote');
  });

  test('timestamps ISO com fuso diferente mas mesmo instante são empate (não local-vence)', () => {
    const resultado = mergeCharacterRecords({
      localRecords: [local('a', '2026-01-01T00:00:00.000Z')],
      remoteRecords: [remote('a', '2025-12-31T21:00:00.000-03:00')],
      pendingDeletionIds: [],
    });

    assert.deepEqual([...resultado.toUpsert], []);
    assert.equal(resultado.merged[0].origin, 'remote');
  });
});

describe('mergeCharacterRecords — presença em um só lado', () => {
  test('só local: mantém e marca para envio', () => {
    const resultado = mergeCharacterRecords({
      localRecords: [local('a', '2026-01-01T00:00:00.000Z')],
      remoteRecords: [],
      pendingDeletionIds: [],
    });

    assert.equal(resultado.merged.length, 1);
    assert.deepEqual([...resultado.toUpsert], ['a']);
  });

  test('só remoto: adota localmente e não reenvia', () => {
    const resultado = mergeCharacterRecords({
      localRecords: [],
      remoteRecords: [remote('a', '2026-01-01T00:00:00.000Z')],
      pendingDeletionIds: [],
    });

    assert.equal(resultado.merged.length, 1);
    assert.equal(resultado.merged[0].origin, 'remote');
    assert.deepEqual([...resultado.toUpsert], []);
  });

  test('só remoto COM remoção pendente: não ressuscita e não vira remoção local', () => {
    const resultado = mergeCharacterRecords({
      localRecords: [],
      remoteRecords: [remote('a', '2026-01-01T00:00:00.000Z')],
      pendingDeletionIds: ['a'],
    });

    assert.deepEqual([...resultado.merged], []);
    assert.deepEqual([...resultado.toUpsert], []);
    // Não estava local, então nada a remover localmente.
    assert.deepEqual([...resultado.toRemoveLocally], []);
  });

  test('local + remoto COM remoção pendente: sai do merged e entra em toRemoveLocally', () => {
    const resultado = mergeCharacterRecords({
      localRecords: [local('a', '2026-05-01T00:00:00.000Z')],
      remoteRecords: [remote('a', '2026-01-01T00:00:00.000Z')],
      pendingDeletionIds: ['a'],
    });

    assert.deepEqual([...resultado.merged], []);
    assert.deepEqual([...resultado.toUpsert], []);
    assert.deepEqual([...resultado.toRemoveLocally], ['a']);
  });
});

describe('mergeCharacterRecords — atualizado_em ausente/inválido nunca produz vencedor silencioso', () => {
  const invalidos = [
    ['ausente', undefined],
    ['string vazia', ''],
    ['não-ISO', 'ontem à tarde'],
    ['nulo', null],
  ];

  for (const [rotulo, valor] of invalidos) {
    test(`local com atualizado_em ${rotulo}: conflito retido, baseline local preservado`, () => {
      const resultado = mergeCharacterRecords({
        localRecords: [local('a', valor)],
        remoteRecords: [remote('a', '2026-01-01T00:00:00.000Z')],
        pendingDeletionIds: [],
      });

      assert.equal(resultado.merged.length, 1, 'o registro não pode desaparecer');
      assert.equal(resultado.merged[0].origin, 'local', 'nenhum lado pode ser adotado num conflito de timestamp');
      assert.deepEqual([...resultado.toUpsert], [], 'não pode reenviar um conflito não resolvido');
      assert.equal(resultado.warnings.length, 1);
      assert.equal(resultado.warnings[0].code, 'SYNC_MERGE_TIMESTAMP_UNCOMPARABLE');
      assert.equal(resultado.warnings[0].context.characterId, 'a');
      assert.equal(resultado.warnings[0].context.side, 'local');
    });

    test(`remoto com atualizado_em ${rotulo}: conflito retido, baseline local preservado`, () => {
      const resultado = mergeCharacterRecords({
        localRecords: [local('a', '2026-01-01T00:00:00.000Z')],
        remoteRecords: [remote('a', valor)],
        pendingDeletionIds: [],
      });

      assert.equal(resultado.merged.length, 1);
      assert.equal(resultado.merged[0].origin, 'local');
      assert.deepEqual([...resultado.toUpsert], []);
      assert.equal(resultado.warnings.length, 1);
      assert.equal(resultado.warnings[0].code, 'SYNC_MERGE_TIMESTAMP_UNCOMPARABLE');
      assert.equal(resultado.warnings[0].context.side, 'remote');
    });
  }

  test('os dois lados inválidos: um único conflito, ambos os lados reportados', () => {
    const resultado = mergeCharacterRecords({
      localRecords: [local('a', '')],
      remoteRecords: [remote('a', 'quinta-feira')],
      pendingDeletionIds: [],
    });

    assert.equal(resultado.warnings.length, 1);
    assert.equal(resultado.warnings[0].context.side, 'both');
    assert.equal(resultado.merged[0].origin, 'local');
    assert.deepEqual([...resultado.toUpsert], []);
  });

  test('timestamp inválido em registro que existe SÓ de um lado não é conflito', () => {
    const resultado = mergeCharacterRecords({
      localRecords: [local('a', '')],
      remoteRecords: [remote('b', 'nunca')],
      pendingDeletionIds: [],
    });

    assert.deepEqual([...resultado.warnings], [], 'sem comparação, não há conflito de comparação');
    assert.equal(resultado.merged.length, 2);
    assert.deepEqual([...resultado.toUpsert], ['a']);
  });
});

describe('mergeCharacterRecords — robustez e contrato', () => {
  test('registro read-only (schema futuro) é preservado byte a byte e nunca reenviado', () => {
    const brutoFuturo = { id: 'f', atualizado_em: '2026-01-01T00:00:00.000Z', _schema: { version: 99 }, x: 1 };
    const resultado = mergeCharacterRecords({
      localRecords: [{ mode: 'read-only', rawRecord: brutoFuturo, revisionToken: 'tok-f' }],
      remoteRecords: [],
      pendingDeletionIds: [],
    });

    assert.equal(resultado.merged[0].mode, 'read-only');
    assert.deepEqual(resultado.merged[0].rawRecord, brutoFuturo);
    assert.deepEqual([...resultado.toUpsert], [], 'schema futuro nunca é reenviado (não é encodável)');
    assert.equal(resultado.warnings.length, 1);
    assert.equal(resultado.warnings[0].code, 'SYNC_MERGE_READ_ONLY_NOT_SENDABLE');
  });

  test('adoção do remoto preserva o marcador _local_sync do lado local', () => {
    const resultado = mergeCharacterRecords({
      localRecords: [local('a', '2026-01-01T00:00:00.000Z', { localSync: { lastMutationId: 'm-1' } })],
      remoteRecords: [remote('a', '2026-06-01T00:00:00.000Z')],
      pendingDeletionIds: [],
    });

    assert.equal(resultado.merged[0].origin, 'remote');
    assert.deepEqual(resultado.merged[0].localSync, { lastMutationId: 'm-1' });
  });

  test('registro sem id identificável é retido como aviso, nunca descartado em silêncio', () => {
    const semId = { mode: 'read-only', rawRecord: { atualizado_em: '2026-01-01T00:00:00.000Z' } };
    const resultado = mergeCharacterRecords({
      localRecords: [semId],
      remoteRecords: [],
      pendingDeletionIds: [],
    });

    assert.equal(resultado.merged.length, 1, 'o registro sem id continua no storage local');
    assert.equal(resultado.warnings.length, 1);
    assert.equal(resultado.warnings[0].code, 'SYNC_MERGE_RECORD_WITHOUT_ID');
  });

  test('resultado é congelado em todos os níveis de lista', () => {
    const resultado = mergeCharacterRecords({ localRecords: [], remoteRecords: [], pendingDeletionIds: [] });
    assert.ok(Object.isFrozen(resultado));
    assert.ok(Object.isFrozen(resultado.merged));
    assert.ok(Object.isFrozen(resultado.toUpsert));
    assert.ok(Object.isFrozen(resultado.toRemoveLocally));
    assert.ok(Object.isFrozen(resultado.warnings));
  });

  test('ordem do merged é determinística: locais na ordem original, depois remotos novos', () => {
    const resultado = mergeCharacterRecords({
      localRecords: [local('b', '2026-01-01T00:00:00.000Z'), local('a', '2026-01-01T00:00:00.000Z')],
      remoteRecords: [remote('z', '2026-01-01T00:00:00.000Z'), remote('a', '2026-01-01T00:00:00.000Z')],
      pendingDeletionIds: [],
    });

    const ids = resultado.merged.map((r) => r.character?.identity?.id ?? r.rawRecord?.id);
    assert.deepEqual(ids, ['b', 'a', 'z']);
  });

  test('entradas inválidas (não-array) produzem erro de programação explícito', () => {
    assert.throws(
      () => mergeCharacterRecords({ localRecords: null, remoteRecords: [], pendingDeletionIds: [] }),
      TypeError,
    );
  });
});
