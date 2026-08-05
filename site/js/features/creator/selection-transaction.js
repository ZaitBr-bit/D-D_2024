// Módulo `features/creator/selection-transaction`: a TRANSAÇÃO de seleção que
// dá semântica a "Cancelar" nos modais do criador.
//
// ## O problema
//
// Nos modais do criador legado, cada clique dentro do modal já escreve no
// objeto `personagem` global. "Cancelar" fecha o modal, mas o que foi clicado
// lá dentro permanece — o botão mente. Pior: um modal aberto sobre outro
// escreve no mesmo estado, e fechar o de cima deixa metade de uma escolha
// aplicada.
//
// ## O contrato
//
// Uma transação é uma ÁREA DE ESTÁGIO nomeada. `begin` a abre com o rascunho
// atual como base; `update` acumula alterações SOMENTE na área de estágio;
// `cancel` a descarta inteira; e `commit` é o ÚNICO ponto em que o rascunho
// muda. Enquanto a transação está aberta, `getDraft()` continua devolvendo o
// rascunho COMMITADO — quem lê o estado nunca enxerga uma escolha pela metade.
//
// Transações são independentes entre si (modais empilhados) e não vazam entre
// sessões: cada sessão tem a sua própria instância.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { isCreatorDraftSlice, withDraftSlices } from './creator-state.js';

const SCOPE = 'features.creator.transaction';

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
function transactionError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Cria o gerenciador de transações de seleção de UMA sessão.
 *
 * @param {{draft: object}} params - `draft` é o rascunho commitado inicial.
 * @returns {Readonly<object>}
 */
export function createSelectionTransaction({ draft } = {}) {
  if (draft === null || typeof draft !== 'object') {
    throw new TypeError('createSelectionTransaction: "draft" é obrigatório.');
  }

  let committedDraft = draft;
  /** @type {Map<string, {id: string, slices: object, provenance: object, base: object}>} */
  const open = new Map();

  /**
   * Rascunho COMMITADO. Nunca reflete transação aberta.
   * @returns {object}
   */
  function getDraft() {
    return committedDraft;
  }

  /**
   * Substitui o rascunho commitado (usado pela sessão quando a invalidação ou
   * um passo altera o rascunho fora de uma transação).
   * @param {object} next
   * @returns {void}
   */
  function setDraft(next) {
    committedDraft = next;
  }

  /**
   * IDs das transações abertas, na ordem de abertura.
   * @returns {ReadonlyArray<string>}
   */
  function getOpenTransactionIds() {
    return Object.freeze([...open.keys()]);
  }

  /**
   * Abre uma transação. Um `id` já aberto é erro (não um "reabrir" silencioso
   * que descartaria o estágio anterior).
   * @param {string} id
   * @returns {import('../../core/result.js').Result} `ok({id, base})`
   */
  function begin(id) {
    if (typeof id !== 'string' || id.length === 0) {
      return err(transactionError('CREATOR_TRANSACTION_ID_INVALID', 'O id da transação deve ser uma string não vazia.'));
    }
    if (open.has(id)) {
      return err(transactionError('CREATOR_TRANSACTION_ALREADY_OPEN', `A transação "${id}" já está aberta.`, { id }));
    }
    open.set(id, { id, slices: {}, provenance: {}, base: committedDraft });
    return ok(Object.freeze({ id, base: committedDraft }));
  }

  /**
   * Acumula alterações na área de estágio. NÃO toca no rascunho commitado.
   * @param {string} id
   * @param {{slices?: object, provenance?: object}} patch
   * @returns {import('../../core/result.js').Result} `ok(staged)`
   */
  function update(id, patch = {}) {
    const entry = open.get(id);
    if (entry === undefined) {
      return err(transactionError('CREATOR_TRANSACTION_NOT_OPEN', `A transação "${String(id)}" não está aberta.`, { id: typeof id === 'string' ? id : null }));
    }
    const slices = patch?.slices ?? {};
    const provenance = patch?.provenance ?? {};
    for (const name of [...Object.keys(slices), ...Object.keys(provenance)]) {
      if (!isCreatorDraftSlice(name)) {
        return err(transactionError('CREATOR_TRANSACTION_SLICE_UNKNOWN', `A transação "${id}" cita a fatia desconhecida "${name}".`, { id, slice: name }));
      }
    }
    entry.slices = { ...entry.slices, ...slices };
    entry.provenance = { ...entry.provenance, ...provenance };
    return ok(Object.freeze({ id, slices: Object.freeze({ ...entry.slices }), provenance: Object.freeze({ ...entry.provenance }) }));
  }

  /**
   * Lê a área de estágio de uma transação aberta (para o `render` do modal).
   * @param {string} id
   * @returns {import('../../core/result.js').Result}
   */
  function getStaged(id) {
    const entry = open.get(id);
    if (entry === undefined) {
      return err(transactionError('CREATOR_TRANSACTION_NOT_OPEN', `A transação "${String(id)}" não está aberta.`, { id: typeof id === 'string' ? id : null }));
    }
    return ok(Object.freeze({ id, slices: Object.freeze({ ...entry.slices }), provenance: Object.freeze({ ...entry.provenance }) }));
  }

  /**
   * Confirma a transação: ESTE é o único ponto em que o rascunho muda.
   * A área de estágio é descartada mesmo se a fusão falhar, para que uma
   * transação não fique presa em estado indefinido.
   * @param {string} id
   * @returns {import('../../core/result.js').Result} `ok(draft)`
   */
  function commit(id) {
    const entry = open.get(id);
    if (entry === undefined) {
      return err(transactionError('CREATOR_TRANSACTION_NOT_OPEN', `A transação "${String(id)}" não está aberta.`, { id: typeof id === 'string' ? id : null }));
    }
    open.delete(id);
    // A fusão parte do rascunho COMMITADO ATUAL, não da `base` capturada no
    // `begin`: se outra transação commitou no meio, descartar o trabalho dela
    // seria uma perda silenciosa. Só as fatias tocadas por ESTA transação são
    // sobrescritas.
    const merged = withDraftSlices(committedDraft, { slices: entry.slices, provenance: entry.provenance });
    if (merged.ok !== true) {
      return merged;
    }
    committedDraft = merged.value;
    return ok(committedDraft);
  }

  /**
   * Cancela a transação: a área de estágio é descartada e o rascunho fica
   * EXATAMENTE como estava.
   * @param {string} id
   * @returns {import('../../core/result.js').Result} `ok(draft)`
   */
  function cancel(id) {
    if (!open.has(id)) {
      return err(transactionError('CREATOR_TRANSACTION_NOT_OPEN', `A transação "${String(id)}" não está aberta.`, { id: typeof id === 'string' ? id : null }));
    }
    open.delete(id);
    return ok(committedDraft);
  }

  /**
   * Cancela todas as transações abertas (usado pelo disposer da sessão).
   * @returns {number} quantas foram canceladas.
   */
  function cancelAll() {
    const total = open.size;
    open.clear();
    return total;
  }

  return Object.freeze({ begin, update, getStaged, commit, cancel, cancelAll, getDraft, setDraft, getOpenTransactionIds });
}
