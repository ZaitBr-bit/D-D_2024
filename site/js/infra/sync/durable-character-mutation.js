// Módulo `infra/sync/durable-character-mutation`: implementa o protocolo de
// três fases que liga uma mutação LOCAL (repositório transacional) à sua
// propagação REMOTA (fila de sincronização), sem que nenhuma falha
// intermediária perca o intent nem libere um envio indevido.
//
//   1. `prepare`  — grava na fila um job NÃO ENVIÁVEL (`state: "prepared"`)
//                   contendo `mutationId`, operação e precondição. Se este
//                   passo falhar, a escrita local NEM É TENTADA: sem fila
//                   durável, um save local viraria uma mudança que jamais
//                   chegaria ao servidor e ninguém saberia.
//   2. `save`     — a mutação local propriamente dita, marcada com o mesmo
//                   `mutationId` (`_local_sync.lastMutationId`). Se ela
//                   falhar, `confirmPrepared` NÃO é chamado e o preparo é
//                   ABORTADO na hora (`abortPrepared`), restaurando o job
//                   que ele havia deslocado. Sem esse aborto, um upsert já
//                   confirmado e pendente offline seria rebaixado a
//                   `prepared` — visível como "sincronizando" para sempre,
//                   sem falha alguma, até um reload reconciliar.
//   3. `confirm`  — torna o job enviável. Se ESTE passo falhar (ex.: quota
//                   ao regravar a fila), o save local já é válido e NÃO é
//                   revertido: devolvemos `syncState:
//                   "reconciliation-needed"`, e no próximo boot
//                   `initialize()`/`reconcilePrepared()` recuperam o intent
//                   pelo marcador de mutação (upsert) ou pela ausência do
//                   registro com o token esperado (remoção).
//
// A ordem observável aprovada não muda: só depois do save local o estado é
// adotado, e só então o job pode ir à rede.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';

const SCOPE = 'infra.sync.durable-character-mutation';

/**
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
function invalidInput(message, context = {}) {
  return createAppError({ code: 'DURABLE_MUTATION_INVALID_INPUT', scope: SCOPE, message, context });
}

/**
 * Cria a mutação durável de personagens.
 * @param {{
 *   repository: {save: Function, remove: Function},
 *   syncQueue: {prepareMutation: Function, confirmPrepared: Function},
 *   mutationIdFactory?: () => string,
 *   characterIdOf?: (character: object) => string|undefined,
 * }} params
 * @returns {Readonly<object>}
 */
export function createDurableCharacterMutation({ repository, syncQueue, mutationIdFactory, characterIdOf } = {}) {
  if (repository === null || typeof repository !== 'object' || typeof repository.save !== 'function') {
    throw new TypeError('createDurableCharacterMutation: "repository" é obrigatório.');
  }
  if (syncQueue === null || typeof syncQueue !== 'object' || typeof syncQueue.prepareMutation !== 'function') {
    throw new TypeError('createDurableCharacterMutation: "syncQueue" é obrigatório.');
  }

  // Como ler o id do objeto passado a `save`. O padrão é o personagem
  // canônico (`identity.id`); a fachada legada de `store.js` opera sobre o
  // REGISTRO PLANO (`{id, nome, ...}`) que criador/ficha mutam em memória e
  // injeta seu próprio extrator. Sem isso o protocolo durável só serviria a
  // chamadores já migrados para o modelo canônico — que é exatamente por que
  // ele acabou sem uso no caminho real de save.
  const idDoPersonagem =
    typeof characterIdOf === 'function' ? characterIdOf : (character) => character?.identity?.id;

  let fallbackCounter = 0;
  const nextMutationId =
    typeof mutationIdFactory === 'function'
      ? mutationIdFactory
      : () => {
          if (typeof globalThis.crypto?.randomUUID === 'function') {
            return globalThis.crypto.randomUUID();
          }
          fallbackCounter += 1;
          return `mut-${Date.now()}-${fallbackCounter}`;
        };

  /**
   * Desfaz um preparo depois de a mutação local ter falhado. O resultado do
   * aborto NÃO altera o erro devolvido ao chamador (o fato relevante para
   * ele continua sendo a falha do save local); um aborto que não persiste é
   * sinalizado pela própria fila, que marca o job com uma falha visível de
   * imediato no snapshot.
   * @param {string|null} preparationId
   */
  function abortarPreparo(preparationId) {
    if (preparationId === null || preparationId === undefined) {
      return;
    }
    if (typeof syncQueue.abortPrepared !== 'function') {
      return;
    }
    const aborted = syncQueue.abortPrepared(preparationId);
    if (!aborted.ok) {
      console.warn(
        '[durable-character-mutation] preparo não pôde ser abortado após falha do save local:',
        aborted.error?.code ?? aborted.error?.message ?? aborted.error,
      );
    }
  }

  /**
   * Salva um personagem localmente garantindo que o intent de sincronizar
   * seja durável antes (e independentemente) do sucesso da fila depois.
   * @param {object} character - personagem canônico.
   * @param {{expectedRevisionToken: string|null, reason: string}} options
   * @returns {import('../../core/result.js').Result} Result<{envelope, syncState}, AppError>
   */
  function save(character, { expectedRevisionToken = null, reason } = {}) {
    const characterId = idDoPersonagem(character);
    if (typeof characterId !== 'string' || characterId.length === 0) {
      return err(invalidInput('O personagem a salvar precisa de identity.id.'));
    }

    const mutationId = nextMutationId();

    const prepared = syncQueue.prepareMutation({
      mutationId,
      operation: 'upsert',
      character,
      characterId,
      expectedRevisionToken,
    });
    if (!prepared.ok) {
      // Sem fila durável não se escreve localmente.
      return prepared;
    }

    const saved = repository.save(character, { expectedRevisionToken, reason, localSyncMutationId: mutationId });
    if (!saved.ok) {
      // A escrita local não aconteceu: o preparo é desfeito AGORA, devolvendo
      // a fila ao estado exato de antes (inclusive um job já confirmado que
      // este preparo tinha deslocado). Nunca se confirma o job.
      abortarPreparo(prepared.value.preparationId);
      return saved;
    }

    const confirmed = syncQueue.confirmPrepared(prepared.value.preparationId);
    return ok(
      Object.freeze({
        envelope: saved.value,
        syncState: confirmed.ok ? 'queued' : 'reconciliation-needed',
      }),
    );
  }

  /**
   * Remove um personagem localmente com o mesmo protocolo durável.
   * @param {string} characterId
   * @param {{expectedRevisionToken: string}} options
   * @returns {import('../../core/result.js').Result} Result<{syncState}, AppError>
   */
  function remove(characterId, { expectedRevisionToken } = {}) {
    if (typeof characterId !== 'string' || characterId.length === 0) {
      return err(invalidInput('"characterId" é obrigatório para remover.'));
    }
    if (typeof expectedRevisionToken !== 'string' || expectedRevisionToken.length === 0) {
      return err(invalidInput('"expectedRevisionToken" é obrigatório para remover (precondição do repositório).', { characterId }));
    }

    const mutationId = nextMutationId();

    const prepared = syncQueue.prepareMutation({
      mutationId,
      operation: 'remove',
      characterId,
      expectedRevisionToken,
    });
    if (!prepared.ok) {
      return prepared;
    }

    const removed = repository.remove(characterId, { expectedRevisionToken });
    if (!removed.ok) {
      abortarPreparo(prepared.value.preparationId);
      return removed;
    }

    const confirmed = syncQueue.confirmPrepared(prepared.value.preparationId);
    return ok(Object.freeze({ syncState: confirmed.ok ? 'queued' : 'reconciliation-needed' }));
  }

  return Object.freeze({ save, remove });
}
