// Módulo `features/creator/creator-intents`: o vocabulário de INTENÇÕES do
// criador.
//
// Uma intenção descreve o que o jogador QUIS fazer ("avançar", "escolher a
// opção X", "confirmar o modal"), nunca como isso deve ser executado. Quem
// produz intenção (o `toIntent` declarativo de cada passo) não toca no DOM,
// não abre modal e não muta rascunho; quem consome (a sessão e o controller)
// não sabe qual clique gerou a intenção.
//
// As intenções de NAVEGAÇÃO e de TRANSAÇÃO DE MODAL são fechadas e tratadas
// pela própria sessão. As demais são repassadas ao passo ativo — os passos
// reais chegam nas Tasks 26-28 e declaram seus próprios `type`s de domínio.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';

const SCOPE = 'features.creator.intents';

/**
 * Intenções que a SESSÃO trata diretamente, sem consultar o passo ativo.
 * @type {Readonly<Record<string, string>>}
 */
export const CREATOR_INTENT_TYPES = Object.freeze({
  next: 'creator/next',
  previous: 'creator/previous',
  goToVisited: 'creator/go-to-visited',
  modalBegin: 'creator/modal-begin',
  modalUpdate: 'creator/modal-update',
  modalCommit: 'creator/modal-commit',
  modalCancel: 'creator/modal-cancel',
});

const SESSION_HANDLED = new Set(Object.values(CREATOR_INTENT_TYPES));

/**
 * Intenção SINTÉTICA que a sessão entrega ao `reduce` do passo ativo logo
 * depois de um `modal-commit` bem-sucedido (Task 26, Decisão 1).
 *
 * ## Por que ela existe
 *
 * Confirmar um modal precisa fazer três coisas no MESMO instante: commitar as
 * escolhas encenadas, materializar as concessões da seleção nova no
 * `character` e revogar as da seleção substituída. As duas últimas só são
 * expressáveis por `reduce` (é ele que devolve `{draft, invalidation}`), e
 * `reduce` nunca era alcançado por uma intenção de modal — a sessão retornava
 * antes. Sem esta intenção, confirmar uma classe gravava a escolha e deixava
 * as concessões da classe anterior penduradas no personagem: a assimetria
 * apply/revoke exata que a matriz de invalidação existe para impedir.
 *
 * Ela NÃO entra em `CREATOR_INTENT_TYPES` de propósito: não é despachável de
 * fora. Nasce dentro da sessão, no caminho do commit, e morre no `reduce` do
 * passo. Um passo que a receba sabe que o rascunho JÁ reflete o que foi
 * encenado — e que ele agora responde pelas concessões.
 * @type {string}
 */
export const CREATOR_TRANSACTION_COMMITTED = 'creator/transaction-committed';

/**
 * Cria a intenção sintética de pós-commit. `transactionId` é o mesmo do
 * `modal-commit` que a originou, para que o passo saiba QUAL seleção foi
 * confirmada (o id da transação carrega a identidade do item escolhido).
 * @param {string} transactionId
 * @returns {Readonly<object>}
 */
export function createTransactionCommittedIntent(transactionId) {
  return createCreatorIntent(CREATOR_TRANSACTION_COMMITTED, { transactionId });
}

/**
 * Intenções que pedem ao CONTROLLER que abra/atualize/feche um modal. O
 * controller é o único que conhece o `ModalService`; passos nunca o recebem.
 * @type {ReadonlySet<string>}
 */
export const MODAL_INTENT_TYPES = Object.freeze(
  new Set([
    CREATOR_INTENT_TYPES.modalBegin,
    CREATOR_INTENT_TYPES.modalUpdate,
    CREATOR_INTENT_TYPES.modalCommit,
    CREATOR_INTENT_TYPES.modalCancel,
  ]),
);

/**
 * Cria uma intenção congelada.
 *
 * `type` é obrigatório e não vazio; o restante do payload é copiado como
 * está (raso) e congelado. Um payload malformado é defeito de programação e
 * lança — intenções nascem de código nosso, não de dados externos.
 *
 * @param {string} type
 * @param {object} [payload]
 * @returns {Readonly<object>}
 */
export function createCreatorIntent(type, payload = {}) {
  if (typeof type !== 'string' || type.length === 0) {
    throw new TypeError('createCreatorIntent: "type" deve ser uma string não vazia.');
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('createCreatorIntent: "payload" deve ser um objeto simples.');
  }
  return Object.freeze({ type, ...payload });
}

/**
 * Diz se `value` tem o formato de uma intenção do criador.
 * @param {*} value
 * @returns {boolean}
 */
export function isCreatorIntent(value) {
  return value !== null && typeof value === 'object' && typeof value.type === 'string' && value.type.length > 0;
}

/**
 * Diz se a intenção é tratada pela própria sessão (navegação/transação).
 * @param {*} intent
 * @returns {boolean}
 */
export function isSessionHandledIntent(intent) {
  return isCreatorIntent(intent) && SESSION_HANDLED.has(intent.type);
}

/**
 * Diz se a intenção é um efeito de modal, tratado pelo controller.
 * @param {*} intent
 * @returns {boolean}
 */
export function isModalIntent(intent) {
  return isCreatorIntent(intent) && MODAL_INTENT_TYPES.has(intent.type);
}

/**
 * Valida uma intenção recebida de fora (de um `toIntent` de passo).
 * @param {*} intent
 * @returns {import('../../core/result.js').Result} `ok(intent)`
 */
export function validateCreatorIntent(intent) {
  // A intenção sintética de pós-commit NÃO é entrada: ficar fora de
  // `CREATOR_INTENT_TYPES` não bastava para impedir que alguém a despachasse,
  // porque o dispatcher aceita qualquer `type` string e a repassa ao `reduce`
  // do passo ativo. Despachada direto, ela aplicava as concessões completas de
  // uma classe SEM nenhuma transação aberta — ou seja, pulava inteiro o
  // mecanismo de modal/transação que existe para que escolha só valha ao
  // confirmar. A recusa é aqui, no único ponto por onde toda intenção externa
  // passa; a sessão a produz depois desta validação, no caminho do commit.
  if (isCreatorIntent(intent) && intent.type === CREATOR_TRANSACTION_COMMITTED) {
    return err(
      createAppError({
        code: 'CREATOR_INTENT_NOT_DISPATCHABLE',
        scope: SCOPE,
        message: `A intenção "${CREATOR_TRANSACTION_COMMITTED}" é produzida internamente pela sessão e não pode ser despachada.`,
        context: { type: intent.type },
      }),
    );
  }
  if (!isCreatorIntent(intent)) {
    return err(
      createAppError({
        code: 'CREATOR_INTENT_INVALID',
        scope: SCOPE,
        message: 'Uma intenção do criador precisa ser um objeto com "type" string não vazia.',
        context: {},
      }),
    );
  }
  if (MODAL_INTENT_TYPES.has(intent.type) && (typeof intent.transactionId !== 'string' || intent.transactionId.length === 0)) {
    return err(
      createAppError({
        code: 'CREATOR_INTENT_TRANSACTION_ID_MISSING',
        scope: SCOPE,
        message: `A intenção "${intent.type}" exige um "transactionId" string não vazio.`,
        context: { type: intent.type },
      }),
    );
  }
  if (intent.type === CREATOR_INTENT_TYPES.goToVisited && (typeof intent.stepId !== 'string' || intent.stepId.length === 0)) {
    return err(
      createAppError({
        code: 'CREATOR_INTENT_STEP_ID_MISSING',
        scope: SCOPE,
        message: 'A intenção "creator/go-to-visited" exige um "stepId".',
        context: {},
      }),
    );
  }
  return ok(intent);
}
