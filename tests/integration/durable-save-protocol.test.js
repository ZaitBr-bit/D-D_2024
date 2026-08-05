// ============================================================
// Integração do PROTOCOLO DE MUTAÇÃO DURÁVEL no caminho REAL de save.
//
// Motivação (achado de revisão da Task 14): o protocolo
// `prepare -> save local -> confirm` estava implementado e testado em
// isolamento, mas nada em produção o chamava — `store.js#salvarPersonagem`
// ia direto a `queue.enqueueUpsert`. Consequência: o estado `prepared` era
// inalcançável, `reconcilePrepared()` era um no-op real, e a falha que o
// protocolo existe para prevenir (save local adotado + fila não persistida
// = intent de sync perdido) continuava acontecendo.
//
// Este arquivo compõe exatamente as MESMAS peças reais que `store.js`
// compõe hoje — repositório transacional + fachada legada + fila de
// sincronização + mutação durável, ligados pela mesma porta que
// `sync.js#portaDeMutacaoDuravel` expõe — e prova o comportamento
// end-to-end. Nada aqui é dublê exceto storage/gateway/relógio.
//
// Um teste de FIAÇÃO no fim do arquivo lê o fonte de `store.js` e garante
// que o caminho de save continue passando pelo protocolo: é a regressão
// concreta que o revisor encontrou, e ela é invisível para qualquer teste
// que só exercite os módulos separadamente.
// ============================================================
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMemoryStorage } from '../helpers/memory-storage.js';
import { ok } from '../../site/js/core/result.js';
import { createLegacyAliasResolver } from '../../site/js/infra/character/legacy-alias-resolver.js';
import { createPreMigrationBackupService } from '../../site/js/infra/character/pre-migration-backup.js';
import { LocalStorageCharacterRepository } from '../../site/js/infra/character/local-storage-character-repository.js';
import { createLegacyStoreFacade, LegacyStoreFacadeError } from '../../site/js/infra/character/legacy-character-projection.js';
import { decodeCharacterRecord, encodeCharacterRecord } from '../../site/js/infra/character/character-codec.js';
import { createSyncQueue, SYNC_QUEUE_KEY } from '../../site/js/infra/sync/sync-queue.js';
import { createDurableCharacterMutation } from '../../site/js/infra/sync/durable-character-mutation.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const UID = 'uid-alice';
const NOW = '2026-07-31T00:00:00.000Z';

let aliasResolver;
let legacyMinimalRaw;

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  aliasResolver = createLegacyAliasResolver(aliases);
  const fixture = JSON.parse(await readFile(path.join(repoRoot, 'tests/fixtures/characters/legacy-minimal.json'), 'utf8'));
  legacyMinimalRaw = fixture.cases[0].personagem;
});

/** Gateway falso: registra o que foi enviado, sem rede. */
function createFakeGateway() {
  const calls = [];
  return {
    uid: UID,
    calls,
    async list() {
      return ok(Object.freeze([]));
    },
    async upsert(envelope) {
      calls.push({ op: 'upsert', envelope });
      return ok(Object.freeze({ characterId: envelope.character.identity.id, updatedAt: NOW, remoteBackup: 'not-applicable' }));
    },
    async remove(characterId) {
      calls.push({ op: 'remove', characterId });
      return ok(undefined);
    },
  };
}

/**
 * Compõe a MESMA pilha de `store.js`: repositório real -> fachada legada
 * real -> fila real -> mutação durável real, com a mesma porta que
 * `sync.js#portaDeMutacaoDuravel` expõe (prepare/confirm + flush no
 * confirm).
 */
function buildStack({ storage = createMemoryStorage(), online = true } = {}) {
  const backupService = createPreMigrationBackupService({ storage });
  const repository = LocalStorageCharacterRepository({ storage, aliasResolver, backupService, clock: { now: () => NOW } });
  const init = repository.initialize({});
  assert.equal(init.ok, true, 'o repositório precisa inicializar');

  const facade = createLegacyStoreFacade({ repository, aliasResolver, clock: { now: () => NOW } });
  const gateway = createFakeGateway();
  const queue = createSyncQueue({
    storage,
    gateway,
    characterRepository: repository,
    connectivity: { isOnline: () => online },
    scheduler: { schedule: () => 1, cancel: () => undefined },
    codec: {
      decode: (raw) => decodeCharacterRecord(raw, { aliasResolver, now: NOW }),
      encode: (character) => encodeCharacterRecord(character, { aliasResolver, localSync: null }),
    },
    clock: { now: () => NOW },
  });
  assert.equal(queue.initialize().ok, true);

  const flushes = [];
  // Espelho fiel de `sync.js#portaDeMutacaoDuravel`.
  const porta = {
    prepareMutation: (params) => queue.prepareMutation(params),
    confirmPrepared: (preparationId) => {
      const confirmado = queue.confirmPrepared(preparationId);
      if (confirmado.ok && online) flushes.push(queue.flush());
      return confirmado;
    },
    abortPrepared: (preparationId) => queue.abortPrepared(preparationId),
  };

  const durableMutation = createDurableCharacterMutation({
    repository: {
      save(record, { localSyncMutationId } = {}) {
        try {
          return ok(facade.save(record, { localSyncMutationId }));
        } catch (cause) {
          if (cause instanceof LegacyStoreFacadeError) return { ok: false, error: cause.appError };
          throw cause;
        }
      },
      remove: () => ({ ok: false, error: { code: 'CHARACTER_DURABLE_REMOVE_NOT_WIRED' } }),
    },
    syncQueue: porta,
    characterIdOf: (record) => record?.identity?.id ?? record?.id,
  });

  /** Espera os flushes disparados pelo confirm (o `store.js` não os aguarda). */
  const aguardarFlushes = async () => {
    await Promise.all(flushes);
  };

  return { storage, repository, facade, queue, gateway, durableMutation, aguardarFlushes };
}

/** Lê a fila persistida bruta. */
function lerFila(storage) {
  const raw = storage.getItem(SYNC_QUEUE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

/** Lê o registro plano persistido de um personagem. */
function lerRegistro(storage, id) {
  const lista = JSON.parse(storage.getItem('dnd_personagens') ?? '[]');
  return lista.find((r) => r.id === id) ?? null;
}

describe('protocolo durável no caminho real de save', () => {
  test('o save individual PASSA pelo protocolo: prepared -> escrita local marcada -> ready', async () => {
    const { storage, durableMutation, gateway, aguardarFlushes } = buildStack();

    const resultado = durableMutation.save({ ...legacyMinimalRaw, id: 'dur-1', nome: 'Alfa' }, { reason: 'user' });
    assert.equal(resultado.ok, true, `save falhou: ${JSON.stringify(resultado.error ?? null)}`);
    assert.equal(resultado.value.syncState, 'queued');
    assert.equal(resultado.value.envelope.id, 'dur-1', 'o retorno continua sendo o registro plano legado');

    // O registro local carrega o marcador da mutação — é ele que permite a
    // reconciliação decidir, num boot futuro, que a escrita foi adotada.
    const registro = lerRegistro(storage, 'dur-1');
    assert.equal(typeof registro._local_sync.lastMutationId, 'string');
    assert.ok(registro._local_sync.lastMutationId.length > 0);

    await aguardarFlushes();
    assert.equal(gateway.calls.length, 1, 'o job confirmado foi enviado');
    assert.equal(gateway.calls[0].envelope.character.identity.id, 'dur-1');
    // E o marcador local NUNCA vai ao payload remoto.
    assert.equal(Object.hasOwn(gateway.calls[0].envelope, '_local_sync'), false);
  });

  test('o estado `prepared` é ALCANÇÁVEL: existe na fila entre o preparo e a escrita local', () => {
    const storage = createMemoryStorage();
    const { durableMutation, facade, queue } = buildStack({ storage, online: false });

    // Observa a fila de dentro de um save que falha depois do preparo (id já
    // existente + objeto não rastreado => a fachada recusa a escrita local).
    facade.save({ ...legacyMinimalRaw, id: 'dur-2', nome: 'Primeiro' });
    const transicoes = [];
    queue.subscribe((snapshot) => transicoes.push({ prepared: snapshot.prepared, pending: snapshot.pending }));

    const resultado = durableMutation.save({ ...legacyMinimalRaw, id: 'dur-2', nome: 'Clone' }, { reason: 'user' });

    assert.equal(resultado.ok, false, 'a escrita local precisa ter falhado');
    assert.equal(resultado.error.code, 'CHARACTER_LEGACY_FACADE_STALE_OBJECT');
    assert.deepEqual(
      transicoes,
      [{ prepared: 1, pending: 0 }, { prepared: 0, pending: 0 }],
      'o job existe como "prepared" (não enviável) e o aborto o retira assim que o save local falha',
    );
    assert.deepEqual(lerFila(storage)?.jobs ?? [], [], 'nenhum preparo órfão sobra em disco');
  });

  test('save local que FALHA não rebaixa um upsert já confirmado nem deixa spinner mudo', async () => {
    // Regressão do fix round 2: com um upsert confirmado pendente offline, um
    // novo save cujo write local falha NÃO pode transformá-lo num `prepared`
    // sem erro — isso mostraria "sincronizando" para sempre nesta sessão e o
    // envio já confirmado nunca aconteceria.
    const storage = createMemoryStorage();
    const stack = buildStack({ storage, online: false });

    stack.facade.save({ ...legacyMinimalRaw, id: 'dur-6', nome: 'Confirmado' });
    assert.equal(stack.queue.enqueueUpsert(stack.repository.get('dur-6').value).ok, true);
    assert.equal(stack.queue.getSnapshot().pending, 1);

    const statusVistos = [];
    stack.queue.subscribe((snapshot) => statusVistos.push(snapshot.status));

    const resultado = stack.durableMutation.save({ ...legacyMinimalRaw, id: 'dur-6', nome: 'Clone' }, { reason: 'user' });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CHARACTER_LEGACY_FACADE_STALE_OBJECT');

    // IMEDIATAMENTE (sem reload, sem reconciliação): nada preparado e o job
    // confirmado intacto — em disco, não só em memória.
    const snapshot = stack.queue.getSnapshot();
    assert.equal(snapshot.prepared, 0, 'nenhum preparo órfão');
    assert.equal(snapshot.pending, 1, 'o upsert já confirmado NÃO foi perdido');
    assert.equal(lerFila(storage).jobs[0].state, 'ready');
    assert.ok(!statusVistos.includes('sincronizando'), `status observados: ${JSON.stringify(statusVistos)}`);

    // E ele continua sendo enviado nesta MESMA sessão, ao voltar a conexão.
    const online = buildStack({ storage, online: true });
    await online.queue.flush();
    assert.deepEqual(online.gateway.calls.map((c) => c.envelope.character.identity.id), ['dur-6']);
  });

  test('preparo cuja escrita local não aconteceu é DESCARTADO na reconciliação, nunca enviado', async () => {
    const storage = createMemoryStorage();
    const primeira = buildStack({ storage, online: false });
    // Aba morta entre o preparo e a escrita local: o aborto nunca chegou a
    // rodar, então o preparo órfão sobrevive em disco. É este caso — e não
    // mais um save local falho — que a reconciliação do próximo boot resolve.
    assert.equal(
      primeira.queue.prepareMutation({
        mutationId: 'm-dur-3', operation: 'upsert', characterId: 'dur-3', expectedRevisionToken: null,
      }).ok,
      true,
    );
    assert.equal(lerRegistro(storage, 'dur-3'), null, 'nada pode ter sido gravado localmente');
    assert.equal(lerFila(storage).jobs[0].state, 'prepared');

    const segunda = buildStack({ storage, online: true });
    const diagnosticos = segunda.queue.getDiagnostics().map((d) => d.code);
    assert.ok(
      diagnosticos.includes('SYNC_PREPARED_DISCARDED_NO_LOCAL_EFFECT'),
      `o descarte precisa deixar rastro; diagnósticos: ${JSON.stringify(diagnosticos)}`,
    );
    await segunda.queue.flush();
    assert.deepEqual(segunda.gateway.calls, [], 'um preparo sem efeito local jamais é enviado');
  });

  test('FILA NÃO PERSISTÍVEL: a escrita local nem é tentada (o intent de sync nunca se perde)', () => {
    const storage = createMemoryStorage();
    const stack = buildStack({ storage });

    // Storage cheio a partir daqui: a fila não consegue gravar o preparo.
    const setItemOriginal = storage.setItem.bind(storage);
    storage.setItem = (chave, valor) => {
      if (chave === SYNC_QUEUE_KEY) {
        const erro = new Error('QuotaExceededError');
        erro.name = 'QuotaExceededError';
        throw erro;
      }
      return setItemOriginal(chave, valor);
    };

    const resultado = stack.durableMutation.save({ ...legacyMinimalRaw, id: 'dur-4', nome: 'Não pode existir' }, { reason: 'user' });

    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SYNC_QUEUE_WRITE_FAILED');
    assert.equal(
      lerRegistro(storage, 'dur-4'),
      null,
      'sem fila durável a escrita local NÃO pode acontecer: seria uma mudança que jamais chegaria ao servidor',
    );
  });

  test('confirmação que falha NÃO reverte o save local; a reconciliação promove o job pelo mutationId', async () => {
    const storage = createMemoryStorage();
    const stack = buildStack({ storage, online: false });

    // Deixa prepare e save passarem, e só quebra a gravação do confirm.
    let escritasNaFila = 0;
    const setItemOriginal = storage.setItem.bind(storage);
    storage.setItem = (chave, valor) => {
      if (chave === SYNC_QUEUE_KEY) {
        escritasNaFila += 1;
        if (escritasNaFila > 1) throw new Error('QuotaExceededError');
      }
      return setItemOriginal(chave, valor);
    };

    const resultado = stack.durableMutation.save({ ...legacyMinimalRaw, id: 'dur-5', nome: 'Salvo mesmo assim' }, { reason: 'user' });
    assert.equal(resultado.ok, true, 'o save local é válido e não é revertido');
    assert.equal(resultado.value.syncState, 'reconciliation-needed');
    assert.notEqual(lerRegistro(storage, 'dur-5'), null);
    assert.equal(lerFila(storage).jobs[0].state, 'prepared', 'o job continua não enviável em disco');

    // Próximo boot, com o storage de novo saudável: a reconciliação promove
    // o preparo porque o registro local carrega o mesmo mutationId.
    storage.setItem = setItemOriginal;
    const boot = buildStack({ storage, online: true });
    assert.equal(lerFila(storage).jobs[0].state, 'ready', 'o intent sobreviveu ao reboot');
    await boot.queue.flush();
    assert.deepEqual(
      boot.gateway.calls.map((c) => c.envelope.character.identity.id),
      ['dur-5'],
    );
  });
});

describe('fiação: store.js não pode voltar a pular o protocolo', () => {
  let fonteStore;
  let fonteSync;
  let fonteCreator;

  before(async () => {
    fonteStore = await readFile(path.join(repoRoot, 'site/js/store.js'), 'utf8');
    fonteSync = await readFile(path.join(repoRoot, 'site/js/sync.js'), 'utf8');
    // Task 28b (CUTOVER): a finalização da criação saiu de
    // `site/js/pages/creator.js` — que virou um composition root fino — e
    // passou a viver em `features/creator/creator-controller.js#finalize`. A
    // GARANTIA verificada aqui é a mesma de antes (não anunciar sucesso nem
    // navegar sobre um save que não aconteceu); só mudou o arquivo que a
    // implementa.
    fonteCreator = await readFile(path.join(repoRoot, 'site/js/features/creator/creator-controller.js'), 'utf8');
  });

  test('salvarPersonagem chama o protocolo durável, não a fila diretamente', () => {
    const corpo = fonteStore.slice(
      fonteStore.indexOf('export function salvarPersonagem'),
      fonteStore.indexOf('export function removerPersonagem'),
    );
    assert.ok(corpo.length > 0, 'não foi possível localizar salvarPersonagem em store.js');
    assert.ok(corpo.includes('_durableMutation.save('), 'salvarPersonagem precisa passar pelo protocolo durável');
    assert.ok(
      !corpo.includes('enfileirarSync('),
      'salvarPersonagem não pode voltar a enfileirar direto: isso torna o estado "prepared" inalcançável e perde o intent de sync',
    );
  });

  test('store.js constrói a mutação durável com a porta de fila de sync.js', () => {
    assert.ok(fonteStore.includes('createDurableCharacterMutation('), 'store.js precisa construir a mutação durável');
    assert.ok(fonteStore.includes('portaDeMutacaoDuravel'), 'store.js precisa usar a porta exposta por sync.js');
  });

  test('sync.js expõe abortPrepared na porta durável', () => {
    assert.ok(
      /abortPrepared\s*\(/.test(fonteSync),
      'sem abortPrepared na porta, um save local falho deixa um "prepared" órfão que a UI mostra como "sincronizando"',
    );
  });

  test('a finalização do criador só anuncia sucesso e navega sobre um save que aconteceu', () => {
    const inicio = fonteCreator.indexOf('async function finalize()');
    assert.ok(inicio > 0, 'não foi possível localizar a finalização da criação no controller do criador');
    const trecho = fonteCreator.slice(inicio);

    const posSave = trecho.indexOf('mutation.save(');
    const posGuarda = trecho.indexOf('saved.ok !== true');
    const posSucesso = trecho.indexOf("notify('success'");
    const posNavega = trecho.indexOf('navigate(');
    assert.ok(posSave > 0, 'a finalização precisa passar pelo protocolo durável (`mutation.save`)');
    assert.ok(posGuarda > posSave, 'o resultado do save precisa ser conferido logo depois dele');
    assert.ok(posSucesso > posGuarda, 'o sucesso não pode ser anunciado antes de o save ser conferido');
    assert.ok(posNavega > posGuarda, 'a navegação não pode acontecer antes de o save ser conferido');

    // A guarda RETORNA — não segue adiante com um aviso.
    const guarda = trecho.slice(posGuarda, posSucesso);
    assert.ok(/return err\(/.test(guarda), 'um save abortado precisa interromper o fluxo, não só avisar');
    assert.ok(
      guarda.indexOf("notify('error'") < guarda.indexOf('return err('),
      'a falha precisa ser notificada antes de o fluxo ser interrompido',
    );

    // E a mutação durável não é montada sem as duas portas: sem repositório ou
    // sem fila, finalizar RECUSA em vez de salvar para lugar nenhum.
    assert.ok(
      fonteCreator.includes('CREATOR_FINALIZE_PERSISTENCE_UNAVAILABLE'),
      'sem repositório/fila a finalização precisa recusar com erro nomeado',
    );
  });
});
