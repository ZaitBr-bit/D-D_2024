// ============================================================
// ORDEM DE PERSISTÊNCIA da finalização do criador (Task 28), sobre as peças
// REAIS das Tasks 13/14 (repositório transacional + fila de sincronização +
// mutação durável). Só storage, gateway e relógio são dublês.
//
// A ordem aprovada, e o que cada elo garante:
//
//   finalizar -> PREPARAR intent (job NÃO enviável) -> SALVAR local com o
//   mutationId -> ADOTAR -> CONFIRMAR/enfileirar -> NOTIFICAR -> NAVEGAR
//
// Os três cenários de falha que este arquivo prende:
//
//   1. falha ao PREPARAR    -> nada é salvo, nada é adotado, não navega;
//   2. falha ao SALVAR local -> o preparo é ABORTADO, nenhum job enviável
//      sobra, não navega;
//   3. save local OK + falha ao CONFIRMAR -> o personagem FICA salvo e
//      adotado, o job preparado continua DURÁVEL, a UI diz "salvo localmente,
//      sincronização pendente", oferece retry, e SÓ ENTÃO navega — sem nunca
//      alegar que sincronizou. Depois de um enqueue válido, uma falha REMOTA
//      assíncrona mantém o estado local e vira status de erro/retry.
//
// O controller nunca espera a tentativa remota: a finalização retorna assim
// que o job está durável.
// ============================================================
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTestDom } from '../helpers/test-dom.js';
import { createMemoryStorage } from '../helpers/memory-storage.js';
import { ok, err } from '../../site/js/core/result.js';
import { createAppError } from '../../site/js/core/errors.js';
import { createLegacyAliasResolver } from '../../site/js/infra/character/legacy-alias-resolver.js';
import { createPreMigrationBackupService } from '../../site/js/infra/character/pre-migration-backup.js';
import { LocalStorageCharacterRepository } from '../../site/js/infra/character/local-storage-character-repository.js';
import { decodeCharacterRecord } from '../../site/js/infra/character/character-codec.js';
import { createSyncQueue, SYNC_QUEUE_KEY } from '../../site/js/infra/sync/sync-queue.js';
import { createDurableCharacterMutation } from '../../site/js/infra/sync/durable-character-mutation.js';
import { CREATOR_STEP_IDS, createCreatorDraft } from '../../site/js/features/creator/creator-state.js';
import { createCreatorSession } from '../../site/js/features/creator/creator-session.js';
import { mountCreator } from '../../site/js/features/creator/creator-controller.js';
import { createStepRegistry } from '../../site/js/features/creator/steps/step-registry.js';
import { createPlaceholderStep } from '../e2e/harness/placeholder-creator-step.js';
import { emptyCharacter } from '../helpers/creator-steps.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const NOW = '2026-08-03T12:00:00.000Z';

let dom;
let aliasResolver;

beforeEach(async () => {
  dom = createTestDom();
  if (aliasResolver === undefined) {
    const aliases = JSON.parse(
      await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
    );
    aliasResolver = createLegacyAliasResolver(aliases);
  }
});

afterEach(() => {
  dom.restore();
});

/** Gateway falso: registra os envios e pode ser mandado falhar. */
function fakeGateway({ failUpsert = false } = {}) {
  const calls = [];
  return {
    uid: 'uid-teste',
    calls,
    failUpsert,
    /** @returns {Promise<object>} */
    async list() {
      return ok(Object.freeze([]));
    },
    /**
     * @param {object} envelope
     * @returns {Promise<object>}
     */
    async upsert(envelope) {
      calls.push({ op: 'upsert', characterId: envelope?.character?.identity?.id ?? null });
      if (this.failUpsert) {
        return err(createAppError({ code: 'GATEWAY_UPSERT_FAILED', scope: 'teste', message: 'Falha remota simulada.' }));
      }
      return ok(Object.freeze({ characterId: envelope.character.identity.id, updatedAt: NOW, remoteBackup: 'not-applicable' }));
    },
    /** @returns {Promise<object>} */
    async remove() {
      return ok(undefined);
    },
  };
}

/**
 * Compõe a pilha REAL de persistência.
 * @param {{gateway?: object}} [params]
 * @returns {object}
 */
function pilhaReal({ gateway = fakeGateway() } = {}) {
  const storage = createMemoryStorage();
  const clock = { now: () => NOW };
  const repository = LocalStorageCharacterRepository({
    storage,
    aliasResolver,
    backupService: createPreMigrationBackupService({ storage }),
    clock,
  });
  const inicializado = repository.initialize({});
  assert.equal(inicializado.ok, true, inicializado.ok ? '' : inicializado.error.code);
  const syncQueue = createSyncQueue({
    storage,
    gateway,
    characterRepository: repository,
    // Sem conectividade nem scheduler automáticos: o flush é DISPARADO pelo
    // teste, para que a assincronia do envio remoto seja observável em vez de
    // acontecer por baixo.
    connectivity: { isOnline: () => true, subscribe: () => () => {} },
    scheduler: { schedule: () => () => {} },
    codec: { decode: (raw) => decodeCharacterRecord(raw, { aliasResolver, now: NOW }) },
    clock,
  });
  // A fila só passa a valer depois de `initialize()` (é o que carrega os jobs
  // do storage e liga o snapshot); sem isso ela ficaria em `idle` e nada seria
  // observável.
  const filaPronta = syncQueue.initialize();
  assert.equal(filaPronta.ok, true, filaPronta.ok ? '' : filaPronta.error.code);
  return { storage, repository, syncQueue, gateway, clock };
}

/**
 * Rascunho pronto para finalizar (personagem canônico + nome no `details`).
 * @param {string} [id]
 * @returns {object}
 */
function draftFinalizavel(id = 'pers-onag-em01') {
  const criado = createCreatorDraft({
    character: emptyCharacter({ id }),
    slices: { details: { name: 'Thalion, o Escudeiro' } },
  });
  assert.equal(criado.ok, true, criado.ok ? '' : criado.error.code);
  return criado.value;
}

/**
 * Monta o controller com os sete passos-placeholder (todos válidos) e as
 * portas de persistência indicadas.
 *
 * Os placeholders são usados aqui de propósito: o objeto deste arquivo é a
 * ORDEM DE PERSISTÊNCIA, não o conteúdo dos passos — que os testes focais de
 * cada passo já cobrem. Um registro de passos reais exigiria montar um
 * personagem completo e tornaria a falha de persistência indistinguível de
 * uma falha de conteúdo.
 * @param {object} portas
 * @returns {Promise<object>}
 */
async function montar(portas) {
  const steps = CREATOR_STEP_IDS.map((stepId) => {
    const created = createPlaceholderStep(stepId, { requireSelection: false });
    assert.equal(created.ok, true, stepId);
    return created.value;
  });
  const stepRegistry = createStepRegistry(steps);
  assert.equal(stepRegistry.ok, true);

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const session = createCreatorSession({ draft: portas.draft ?? draftFinalizavel(), stepRegistry: stepRegistry.value });
  const mounted = await mountCreator({
    container,
    session,
    stepRegistry: stepRegistry.value,
    clock: { now: () => NOW },
    ...portas,
  });
  assert.equal(mounted.ok, true, mounted.ok ? '' : mounted.error.code);
  return { container, session, dispose: mounted.value, finalize: mounted.value.finalize };
}

/** Notificador que registra tudo, na ordem. */
function notificador() {
  const eventos = [];
  return {
    eventos,
    /** @param {*} payload */
    error(payload) {
      eventos.push({ level: 'error', payload });
    },
    /** @param {*} payload */
    warn(payload) {
      eventos.push({ level: 'warn', payload });
    },
    /** @param {*} payload */
    success(payload) {
      eventos.push({ level: 'success', payload });
    },
  };
}

describe('finalização do criador: caminho feliz', () => {
  test('ordem exata: prepara, salva local com mutationId, adota, confirma, notifica e navega', async () => {
    const pilha = pilhaReal();
    const notifier = notificador();
    const navegacoes = [];
    const { finalize, dispose } = await montar({
      repository: pilha.repository,
      syncQueue: pilha.syncQueue,
      notifier,
      navigate: (id, info) => navegacoes.push({ id, info }),
    });

    const resultado = await finalize();
    assert.equal(resultado.ok, true, resultado.ok ? '' : resultado.error.code);
    assert.equal(resultado.value.syncState, 'queued');

    // ADOTADO: o personagem está no repositório local.
    const lista = pilha.repository.list();
    assert.equal(lista.ok, true);
    assert.equal(lista.value.characters.length, 1);
    assert.equal(lista.value.characters[0].character.identity.id, 'pers-onag-em01');
    assert.equal(lista.value.characters[0].character.identity.name, 'Thalion, o Escudeiro');
    // E com o `identity.size` correto: "" e nunca "medium".
    assert.equal(lista.value.characters[0].character.identity.size, '');

    // ENFILEIRADO e ENVIÁVEL (nenhum job preso em `prepared`).
    const fila = pilha.syncQueue.getSnapshot();
    assert.equal(fila.prepared, 0, 'nenhum job pode ficar preso em "prepared" depois de confirmar');
    assert.ok(fila.pending >= 1 || pilha.gateway.calls.length >= 1, 'o job precisa estar enviável (ou já enviado)');

    // NOTIFICOU sucesso, e só então NAVEGOU.
    assert.deepEqual(
      notifier.eventos.map((entrada) => entrada.level),
      ['success'],
    );
    assert.deepEqual(navegacoes.map((entrada) => entrada.id), ['pers-onag-em01']);

    // O controller NÃO esperou a tentativa remota: a finalização já retornou.
    dispose();
  });

  test('a finalização exige os sete passos válidos', async () => {
    const pilha = pilhaReal();
    const notifier = notificador();
    const navegacoes = [];
    const steps = CREATOR_STEP_IDS.map((stepId) => {
      // `requireSelection: true` sem opção escolhida deixa o passo INVÁLIDO.
      const created = createPlaceholderStep(stepId, { requireSelection: true, options: [{ id: 'x', name: 'X' }] });
      return created.value;
    });
    const stepRegistry = createStepRegistry(steps).value;
    const container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    const session = createCreatorSession({ draft: draftFinalizavel(), stepRegistry });
    const mounted = await mountCreator({
      container,
      session,
      stepRegistry,
      repository: pilha.repository,
      syncQueue: pilha.syncQueue,
      notifier,
      navigate: (id) => navegacoes.push(id),
      clock: { now: () => NOW },
    });
    const resultado = await mounted.value.finalize();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_NOT_FINALIZABLE');
    assert.equal(pilha.repository.list().value.characters.length, 0);
    assert.deepEqual(navegacoes, []);
    mounted.value();
  });

  test('sem repositório/fila a finalização RECUSA em vez de salvar em lugar nenhum', async () => {
    const notifier = notificador();
    const navegacoes = [];
    const { finalize, dispose } = await montar({ notifier, navigate: (id) => navegacoes.push(id) });
    const resultado = await finalize();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_FINALIZE_PERSISTENCE_UNAVAILABLE');
    assert.deepEqual(navegacoes, []);
    assert.equal(notifier.eventos[0].level, 'error');
    dispose();
  });
});

describe('finalização do criador: cenário 1 — falha ao PREPARAR', () => {
  test('nada é salvo, nada é adotado, não navega e o rascunho fica intacto', async () => {
    const pilha = pilhaReal();
    const notifier = notificador();
    const navegacoes = [];
    const draft = draftFinalizavel();
    // Mutação durável com fila que RECUSA o preparo. É o cenário "sem fila
    // durável": a escrita local nem é tentada.
    const durableMutation = createDurableCharacterMutation({
      repository: pilha.repository,
      syncQueue: {
        /** @returns {object} */
        prepareMutation() {
          return err(createAppError({ code: 'SYNC_QUEUE_PREPARE_FAILED', scope: 'teste', message: 'Quota estourada.' }));
        },
        /** @returns {object} */
        confirmPrepared() {
          assert.fail('confirmPrepared não pode ser chamado quando o preparo falha');
        },
      },
    });
    const { finalize, session, dispose } = await montar({
      draft,
      durableMutation,
      notifier,
      navigate: (id) => navegacoes.push(id),
    });
    const antes = session.getSnapshot();

    const resultado = await finalize();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SYNC_QUEUE_PREPARE_FAILED');

    assert.equal(pilha.repository.list().value.characters.length, 0, 'nada pode ter sido adotado');
    assert.deepEqual(navegacoes, [], 'não navega');
    assert.equal(notifier.eventos.at(-1).level, 'error');
    // Rascunho e passo atual intactos.
    assert.equal(session.getSnapshot().currentStepId, antes.currentStepId);
    assert.deepEqual(session.getSnapshot().draft.slices.details, antes.draft.slices.details);
    dispose();
  });
});

describe('finalização do criador: cenário 2 — falha ao SALVAR local', () => {
  test('o preparo é ABORTADO, nenhum job enviável sobra e não navega', async () => {
    const pilha = pilhaReal();
    const notifier = notificador();
    const navegacoes = [];
    const durableMutation = createDurableCharacterMutation({
      repository: {
        /** @returns {object} */
        save() {
          return err(createAppError({ code: 'REPO_SAVE_FAILED', scope: 'teste', message: 'Storage cheio.' }));
        },
        /** @returns {object} */
        remove() {
          return ok(undefined);
        },
      },
      syncQueue: pilha.syncQueue,
    });
    const { finalize, session, dispose } = await montar({
      durableMutation,
      notifier,
      navigate: (id) => navegacoes.push(id),
    });

    const resultado = await finalize();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'REPO_SAVE_FAILED');

    assert.equal(pilha.repository.list().value.characters.length, 0);
    const fila = pilha.syncQueue.getSnapshot();
    assert.equal(fila.pending, 0, 'nenhum job ENVIÁVEL pode existir depois de uma falha de save local');
    assert.equal(fila.prepared, 0, 'o preparo precisa ter sido ABORTADO, não deixado pendurado');
    assert.deepEqual(navegacoes, []);
    assert.equal(notifier.eventos.at(-1).level, 'error');
    assert.equal(session.isDisposed(), false);
    dispose();
  });
});

describe('finalização do criador: cenário 3 — save local OK + falha ao CONFIRMAR', () => {
  test('salvo e adotado, job preparado DURÁVEL, aviso de sync pendente com retry, e só então navega', async () => {
    const pilha = pilhaReal();
    const notifier = notificador();
    const navegacoes = [];
    // A fila real PREPARA de verdade (o job fica durável no storage) mas
    // RECUSA confirmar — exatamente a falha de quota ao regravar a fila.
    let confirmarPodeFalhar = true;
    const filaComFalhaNoConfirm = {
      /**
       * @param {object} params
       * @returns {object}
       */
      prepareMutation(params) {
        return pilha.syncQueue.prepareMutation(params);
      },
      /**
       * @param {string} preparationId
       * @returns {object}
       */
      confirmPrepared(preparationId) {
        if (confirmarPodeFalhar) {
          return err(createAppError({ code: 'SYNC_QUEUE_CONFIRM_FAILED', scope: 'teste', message: 'Quota ao regravar a fila.' }));
        }
        return pilha.syncQueue.confirmPrepared(preparationId);
      },
      /**
       * @param {string} preparationId
       * @returns {object}
       */
      abortPrepared(preparationId) {
        return pilha.syncQueue.abortPrepared(preparationId);
      },
    };
    const durableMutation = createDurableCharacterMutation({ repository: pilha.repository, syncQueue: filaComFalhaNoConfirm });
    const { finalize, dispose } = await montar({
      durableMutation,
      // A fila REAL também entra: é ela que oferece a reconciliação usada pelo
      // retry (o retry NÃO regrava o personagem — ele já está salvo).
      syncQueue: pilha.syncQueue,
      notifier,
      navigate: (id, info) => navegacoes.push({ id, info }),
    });

    const resultado = await finalize();
    // O SAVE deu certo — a finalização NÃO é um erro.
    assert.equal(resultado.ok, true, resultado.ok ? '' : resultado.error.code);
    assert.equal(resultado.value.syncState, 'reconciliation-needed');

    // Salvo e ADOTADO.
    const lista = pilha.repository.list();
    assert.equal(lista.value.characters.length, 1);
    assert.equal(lista.value.characters[0].character.identity.id, 'pers-onag-em01');

    // O job PREPARADO continua durável na fila.
    assert.equal(pilha.syncQueue.getSnapshot().prepared, 1, 'o intent precisa sobreviver para a reconciliação recuperá-lo');

    // A UI foi avisada com HONESTIDADE — aviso, não sucesso — e recebeu retry.
    const aviso = notifier.eventos.at(-1);
    assert.equal(aviso.level, 'warn');
    assert.equal(aviso.payload.code, 'CREATOR_SAVED_SYNC_PENDING');
    assert.match(aviso.payload.message, /pendente/i);
    assert.equal(typeof aviso.payload.retry, 'function');
    assert.equal(
      notifier.eventos.some((entrada) => entrada.level === 'success'),
      false,
      'nunca alegar sincronização concluída',
    );

    // E SÓ ENTÃO navegou, carregando o estado real de sync.
    assert.equal(navegacoes.length, 1);
    assert.equal(navegacoes[0].id, 'pers-onag-em01');
    assert.equal(navegacoes[0].info.syncState, 'reconciliation-needed');

    // RETRY: reconcilia o intent preparado, tornando-o enviável — sem
    // regravar o personagem (que já está salvo e adotado).
    confirmarPodeFalhar = false;
    const retentado = aviso.payload.retry();
    assert.equal(retentado.ok, true, retentado.ok ? '' : retentado.error.code);
    assert.equal(pilha.syncQueue.getSnapshot().prepared, 0, 'o retry precisa liberar o job preparado');
    assert.ok(pilha.syncQueue.getSnapshot().pending >= 1 || pilha.gateway.calls.length >= 1);
    dispose();
  });

  test('após reload, a reconciliação recupera o intent preparado', async () => {
    const pilha = pilhaReal();
    const durableMutation = createDurableCharacterMutation({
      repository: pilha.repository,
      syncQueue: {
        prepareMutation: (params) => pilha.syncQueue.prepareMutation(params),
        confirmPrepared: () => err(createAppError({ code: 'SYNC_QUEUE_CONFIRM_FAILED', scope: 'teste', message: 'Falhou.' })),
        abortPrepared: (id) => pilha.syncQueue.abortPrepared(id),
      },
    });
    const { finalize, dispose } = await montar({ durableMutation, navigate: () => {} });
    const resultado = await finalize();
    assert.equal(resultado.ok, true);
    dispose();

    // "Reload": uma fila NOVA sobre o MESMO storage, com o mesmo repositório.
    const filaNova = createSyncQueue({
      storage: pilha.storage,
      gateway: pilha.gateway,
      characterRepository: pilha.repository,
      connectivity: { isOnline: () => true, subscribe: () => () => {} },
      scheduler: { schedule: () => () => {} },
      codec: { decode: (raw) => decodeCharacterRecord(raw, { aliasResolver, now: NOW }) },
      clock: { now: () => NOW },
    });
    // O job PREPARADO sobreviveu ao "reload": está nos bytes do storage.
    const bytes = pilha.storage.getItem(SYNC_QUEUE_KEY);
    assert.match(String(bytes), /"prepared"/, 'o intent precisa estar durável no storage');

    // `initialize()` já reconcilia (é o caminho de boot); `reconcilePrepared()`
    // é o mesmo efeito, chamável à parte. Depois de qualquer um dos dois, o
    // intent existe como job ENVIÁVEL e nenhum fica preso em "prepared".
    const iniciada = filaNova.initialize();
    assert.equal(iniciada.ok, true, iniciada.ok ? '' : iniciada.error.code);
    const reconciliado = filaNova.reconcilePrepared();
    assert.equal(reconciliado.ok, true, reconciliado.ok ? '' : reconciliado.error.code);
    const depois = filaNova.getSnapshot();
    assert.equal(depois.prepared, 0, 'nenhum job pode ficar preso em "prepared" após reconciliar');
    assert.ok(
      depois.pending >= 1 || pilha.gateway.calls.length >= 1,
      'o intent precisa ter sido recuperado como job enviável (ou já enviado)',
    );
  });
});

describe('finalização do criador: falha REMOTA assíncrona depois do enqueue', () => {
  test('o estado local permanece e a falha vira status de erro/retry na fila', async () => {
    const gateway = fakeGateway({ failUpsert: true });
    const pilha = pilhaReal({ gateway });
    const navegacoes = [];
    const { finalize, dispose } = await montar({
      repository: pilha.repository,
      syncQueue: pilha.syncQueue,
      navigate: (id) => navegacoes.push(id),
    });

    const resultado = await finalize();
    assert.equal(resultado.ok, true, resultado.ok ? '' : resultado.error.code);
    assert.deepEqual(navegacoes, ['pers-onag-em01'], 'a navegação não espera a rede');

    // A tentativa remota acontece DEPOIS, pela fila.
    await pilha.syncQueue.flush();

    // O personagem continua salvo localmente.
    assert.equal(pilha.repository.list().value.characters.length, 1);
    // E a falha remota aparece como estado da fila (erro/retry), não como
    // perda silenciosa.
    const snapshot = pilha.syncQueue.getSnapshot();
    assert.ok(gateway.calls.length >= 1, 'a fila precisa ter tentado enviar');
    assert.equal(snapshot.status, 'erro', 'a falha remota precisa virar status de erro');
    assert.ok(snapshot.failures.length >= 1, 'a falha remota precisa ficar registrada para retry');
    assert.equal(typeof pilha.syncQueue.retry, 'function', 'a fila precisa oferecer retry');
    dispose();
  });
});
