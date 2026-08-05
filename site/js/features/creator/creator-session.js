// Módulo `features/creator/creator-session`: a SESSÃO do criador — o estado,
// a navegação, o carregamento assíncrono e as transações que hoje vivem em
// quatro variáveis de módulo do monólito (`personagem`, `stepAtual`,
// `dadosCache`, `containerRef`).
//
// ## Por que uma sessão, e não variáveis de módulo
//
// Variáveis de módulo são um SINGLETON: duas abas do mesmo bundle ainda são
// dois documentos, mas dois montes do mesmo criador na mesma página (o caso
// real: navegar para o criador, voltar, entrar de novo) compartilham
// `personagem` e `dadosCache`. O criador legado convive com isso porque
// `renderCreator` zera tudo na entrada — o que significa que a "limpeza"
// entre montagens é uma reatribuição global, e qualquer callback assíncrono
// pendente da montagem anterior escreve na nova.
//
// `createCreatorSession()` devolve um objeto com estado PRÓPRIO. Duas sessões
// simultâneas não compartilham rascunho, cache de step, passo atual,
// transação nem listener. Isso é testado explicitamente.
//
// ## Generation + AbortSignal: por que os dois
//
// `AbortSignal` cancela o TRABALHO (o `fetch` para de ser esperado). Ele não
// impede que uma promise já resolvida entregue seu `.then`. O caso real é a
// troca rápida de classe: o `load` da classe A resolve DEPOIS do `load` da
// classe B e sobrescreve o step data da B.
//
// Por isso toda carga carrega um número de GERAÇÃO. Ao voltar, o resultado só
// é adotado se a geração ainda for a corrente E a sessão não tiver sido
// descartada. `abort()` é enviado por educação com a rede; a geração é o que
// garante a correção.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import {
  CREATOR_STEP_IDS,
  CREATOR_DRAFT_SLICES,
  CREATOR_STATUS,
  createCreatorSnapshot,
  createCreatorDraft,
  creatorStateError,
  creatorStepIndex,
  isCreatorStepId,
} from './creator-state.js';
import {
  CREATOR_INTENT_TYPES,
  createTransactionCommittedIntent,
  isModalIntent,
  validateCreatorIntent,
} from './creator-intents.js';
import { applyInvalidationPatch, isInvalidationPatch, createInvalidationPatch } from './creator-invalidation.js';
import { createSelectionTransaction } from './selection-transaction.js';

const SCOPE = 'features.creator.session';

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {*} [cause]
 * @returns {object}
 */
function sessionError(code, message, context = {}, cause = undefined) {
  return createAppError({ code, scope: SCOPE, message, context, cause });
}

/**
 * `ValidationResult` neutro para um passo que ainda não foi validado.
 * @type {Readonly<{valid: boolean, errors: ReadonlyArray<object>}>}
 */
const UNVALIDATED = Object.freeze({ valid: false, errors: Object.freeze([]) });

/**
 * Cria uma sessão do criador.
 *
 * @param {{
 *   draft?: object,
 *   registry?: object,
 *   rules?: object,
 *   stepRegistry: object,
 *   rng?: {next: () => number},
 *   clock?: {now: () => string},
 *   imageProcessor?: {process: (file: object) => Promise<object>}
 * }} params
 * @returns {Readonly<object>}
 */
export function createCreatorSession({
  draft,
  registry = null,
  rules = null,
  stepRegistry,
  rng = null,
  clock = null,
  imageProcessor = null,
} = {}) {
  if (stepRegistry === null || typeof stepRegistry !== 'object' || typeof stepRegistry.get !== 'function') {
    throw new TypeError('createCreatorSession: "stepRegistry" é obrigatório.');
  }

  let initialDraft = draft;
  if (initialDraft === undefined || initialDraft === null) {
    const created = createCreatorDraft({});
    if (created.ok !== true) {
      throw new TypeError('createCreatorSession: não foi possível criar o rascunho inicial.');
    }
    initialDraft = created.value;
  }

  const transactions = createSelectionTransaction({ draft: initialDraft });

  // --- Estado próprio desta sessão ----------------------------------------
  let currentStepId = CREATOR_STEP_IDS[0];
  /** @type {Set<string>} */
  const visited = new Set([currentStepId]);
  /** @type {Record<string, object|null>} */
  let stepData = {};
  let status = CREATOR_STATUS.idle;
  /** @type {object|null} */
  let validation = null;
  /** @type {object|null} */
  let lastError = null;
  let generation = 0;
  let disposed = false;
  /** @type {AbortController|null} */
  let inFlightController = null;
  /** @type {Array<Function>} */
  let listeners = [];
  /** @type {Readonly<object>} */
  let snapshot;

  /**
   * Recalcula o snapshot congelado publicado pela sessão.
   * @returns {Readonly<object>}
   */
  function rebuildSnapshot() {
    snapshot = createCreatorSnapshot({
      currentStepId,
      visitedStepIds: CREATOR_STEP_IDS.filter((id) => visited.has(id)),
      status,
      draft: transactions.getDraft(),
      stepData,
      validation,
      generation,
      error: lastError,
      pendingTransactionIds: transactions.getOpenTransactionIds(),
    });
    return snapshot;
  }
  rebuildSnapshot();

  /**
   * Publica o snapshot atual a todos os inscritos. Um listener que lança não
   * derruba os demais nem a sessão: a falha é isolada.
   * @returns {Readonly<object>}
   */
  function notify() {
    const published = rebuildSnapshot();
    for (const listener of [...listeners]) {
      try {
        listener(published);
      } catch {
        // Um consumidor quebrado não pode quebrar a sessão nem os outros.
      }
    }
    return published;
  }

  /**
   * `AppError` padrão para uso após `dispose()`.
   * @returns {object}
   */
  function disposedError() {
    return sessionError('CREATOR_SESSION_DISPOSED', 'A sessão do criador já foi descartada.', {});
  }

  /**
   * Monta o contexto entregue a `load`/`render`/`bind`/`validate`/`invalidate`
   * de um passo. É sempre um objeto NOVO e congelado: um passo não consegue
   * guardar a referência e mutar o estado da sessão por ela.
   * @param {string} stepId
   * @param {{root?: object|null, signal?: AbortSignal|null}} [extra]
   * @returns {Readonly<object>}
   */
  function stepContext(stepId, extra = {}) {
    return Object.freeze({
      stepId,
      draft: transactions.getDraft(),
      data: stepData[stepId] ?? null,
      registry,
      rules,
      rng,
      clock,
      // Porta de IMAGEM (Task 28). Entra pelo mesmo canal de `rng`/`clock` —
      // uma capacidade INJETADA que o passo consome mas não constrói — porque
      // o problema é o mesmo: processar um `File` exige `FileReader`/`canvas`,
      // que um passo puro não pode tocar. Ausente, o passo `detalhes` recusa a
      // imagem com erro nomeado em vez de cair num caminho de navegador.
      imageProcessor,
      root: extra.root ?? null,
      signal: extra.signal ?? null,
      transaction: Object.freeze({
        getStaged: transactions.getStaged,
        getOpenTransactionIds: transactions.getOpenTransactionIds,
      }),
    });
  }

  /**
   * Aborta a carga em voo (se houver) e avança a geração, de modo que
   * qualquer resposta ainda a caminho seja descartada ao chegar.
   * @returns {number} a nova geração corrente.
   */
  function invalidateInFlight() {
    if (inFlightController !== null) {
      inFlightController.abort();
      inFlightController = null;
    }
    generation += 1;
    return generation;
  }

  /**
   * Carrega o step data de `stepId`, descartando o resultado se ele chegar
   * depois de a geração ter mudado (troca de passo/classe) ou de a sessão ter
   * sido descartada.
   * @param {string} stepId
   * @param {{signal?: AbortSignal}} [options]
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  async function loadStep(stepId, { signal } = {}) {
    const step = stepRegistry.get(stepId);
    if (step === null) {
      return err(sessionError('CREATOR_STEP_NOT_REGISTERED', `Nenhum passo registrado para "${stepId}".`, { stepId }));
    }

    const myGeneration = invalidateInFlight();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    inFlightController = controller;
    if (signal && typeof signal.addEventListener === 'function' && controller !== null) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    status = CREATOR_STATUS.loading;
    lastError = null;
    notify();

    let result;
    try {
      result = await step.load(stepContext(stepId, { signal: controller?.signal ?? signal ?? null }));
    } catch (cause) {
      result = err(sessionError('CREATOR_STEP_LOAD_THREW', `O "load" do passo "${stepId}" lançou uma exceção.`, { stepId }, cause));
    }

    // --- A GUARDA. Tudo depois daqui só vale para a geração corrente. -------
    if (disposed || myGeneration !== generation) {
      return err(
        sessionError('CREATOR_STEP_LOAD_STALE', `O carregamento do passo "${stepId}" foi descartado por ser de uma geração anterior.`, {
          stepId,
          loadGeneration: myGeneration,
          currentGeneration: generation,
        }),
      );
    }
    inFlightController = null;

    if (!result || result.ok !== true) {
      status = CREATOR_STATUS.error;
      lastError = result?.error ?? sessionError('CREATOR_STEP_LOAD_FAILED', `O passo "${stepId}" não devolveu um Result.`, { stepId });
      notify();
      return err(lastError);
    }

    stepData = Object.freeze({ ...stepData, [stepId]: result.value });
    status = CREATOR_STATUS.ready;
    validation = runValidate(stepId);
    return ok(notify());
  }

  /**
   * Executa `validate` do passo, isolando exceção. Nunca muta nada.
   * @param {string} stepId
   * @returns {object} ValidationResult
   */
  function runValidate(stepId) {
    const step = stepRegistry.get(stepId);
    if (step === null) {
      return UNVALIDATED;
    }
    try {
      const result = step.validate(stepContext(stepId));
      if (result === null || typeof result !== 'object' || typeof result.valid !== 'boolean') {
        return UNVALIDATED;
      }
      return Object.freeze({ valid: result.valid, errors: Object.freeze([...(result.errors ?? [])]) });
    } catch {
      return UNVALIDATED;
    }
  }

  /**
   * Pede o `InvalidationPatch` ao passo e o aplica ao rascunho.
   * @param {string} stepId
   * @returns {import('../../core/result.js').Result} `ok(patch)`
   */
  function invalidateStep(stepId) {
    const step = stepRegistry.get(stepId);
    if (step === null) {
      return err(sessionError('CREATOR_STEP_NOT_REGISTERED', `Nenhum passo registrado para "${stepId}".`, { stepId }));
    }
    let patchResult;
    try {
      patchResult = step.invalidate(stepContext(stepId));
    } catch (cause) {
      return err(sessionError('CREATOR_STEP_INVALIDATE_THREW', `O "invalidate" do passo "${stepId}" lançou uma exceção.`, { stepId }, cause));
    }
    if (!patchResult || patchResult.ok !== true) {
      return patchResult ?? err(sessionError('CREATOR_STEP_INVALIDATE_FAILED', `O "invalidate" do passo "${stepId}" não devolveu um Result.`, { stepId }));
    }
    const patch = patchResult.value;
    if (!isInvalidationPatch(patch)) {
      return err(
        sessionError('CREATOR_STEP_INVALIDATE_SHAPE', `O "invalidate" do passo "${stepId}" não devolveu um InvalidationPatch.`, { stepId }),
      );
    }

    return applyPatch(patch, stepId);
  }

  /**
   * Aplica um `InvalidationPatch` ao estado da sessão: limpa as fatias
   * derivadas de `preservedSlices`, revoga as concessões e descarta o step
   * data dos passos citados em `clearedStepIds`.
   *
   * É o ÚNICO caminho de aplicação de patch da sessão — usado tanto por
   * `invalidateStep` (navegação para trás) quanto pelo `invalidation`
   * devolvido por `reduce` (troca DENTRO do mesmo passo, o caso da troca de
   * classe). Ter dois caminhos seria ter duas semânticas de invalidação.
   *
   * @param {object} patch
   * @param {string} originStepId - passo que originou o patch (diagnóstico).
   * @param {object} [targetDraft] - rascunho SOBRE o qual o patch é aplicado.
   *   Por padrão o rascunho corrente da sessão (caminho de navegação); no
   *   caminho de `reduce` é o rascunho que o PASSO acabou de produzir, para
   *   que a revogação e a limpeza componham com a escolha nova em vez de
   *   serem sobrescritas por ela.
   * @returns {import('../../core/result.js').Result} `ok(patch)`
   */
  function applyPatch(patch, originStepId, targetDraft = undefined) {
    if (!isInvalidationPatch(patch)) {
      return err(
        sessionError('CREATOR_STEP_INVALIDATE_SHAPE', `O passo "${originStepId}" não devolveu um InvalidationPatch.`, {
          stepId: originStepId,
        }),
      );
    }
    const applied = applyInvalidationPatch(targetDraft ?? transactions.getDraft(), patch);
    if (applied.ok !== true) {
      return applied;
    }
    transactions.setDraft(applied.value.draft);

    // Passos cujo step data deixou de valer: o cache é descartado e eles
    // deixam de contar como visitados (precisam ser refeitos).
    if (patch.clearedStepIds.length > 0) {
      const nextData = { ...stepData };
      for (const cleared of patch.clearedStepIds) {
        delete nextData[cleared];
        if (cleared !== currentStepId) {
          visited.delete(cleared);
        }
      }
      stepData = Object.freeze(nextData);
    }
    return ok(patch);
  }

  /**
   * Diz quais fatias o PASSO escreveu de fato, comparando o rascunho que ele
   * devolveu com o que ele recebeu. Valor ou proveniência diferentes contam
   * como escrita.
   * @param {object} previousDraft
   * @param {object} stepDraft
   * @returns {Array<string>}
   */
  function slicesWrittenByStep(previousDraft, stepDraft) {
    const written = [];
    for (const slice of CREATOR_DRAFT_SLICES) {
      if (previousDraft.slices[slice] !== stepDraft.slices[slice]) {
        written.push(slice);
        continue;
      }
      const antes = previousDraft.provenance[slice] ?? [];
      const depois = stepDraft.provenance[slice] ?? [];
      if (antes.length !== depois.length || antes.some((id, index) => id !== depois[index])) {
        written.push(slice);
      }
    }
    return written;
  }

  /**
   * Proveniências que continuam VIGENTES depois da ação: as que aparecem em
   * alguma fatia PRESERVADA do rascunho que o passo produziu.
   *
   * É o análogo de `slicesWrittenByStep` no eixo de PROVENIÊNCIA — e a
   * restrição às fatias preservadas é o que o torna correto. Olhar TODAS as
   * fatias seria errado na direção oposta: numa troca de classe, a fonte
   * ANTIGA ainda está na proveniência de `classSkills`/
   * `startingEquipmentSelection` (fatias que o patch vai justamente limpar), e
   * protegê-la por isso deixaria de revogar exatamente o que devia.
   *
   * Uma fatia preservada é uma fatia que sobrevive; a fonte citada por ela
   * sobrevive junto.
   * @param {object} stepDraft
   * @param {ReadonlyArray<string>} preservedSlices
   * @returns {Set<string>}
   */
  function provenanceAliveAfterStep(stepDraft, preservedSlices) {
    const vivas = new Set();
    for (const slice of preservedSlices) {
      for (const id of stepDraft.provenance[slice] ?? []) {
        vivas.add(id);
      }
    }
    return vivas;
  }

  /**
   * Compõe o `invalidation` devolvido por `reduce` com o rascunho que o mesmo
   * `reduce` produziu.
   *
   * ## O problema de composição
   *
   * `reduce` devolve duas coisas sobre o MESMO instante: o rascunho novo (com
   * a classe nova escolhida) e o patch que descreve o que a escolha ANTIGA
   * levava consigo. Aplicá-los em sequência não funciona em nenhuma das duas
   * ordens:
   *
   *   - patch e depois rascunho: o rascunho do passo foi montado a partir do
   *     estado PRÉ-patch, então sobrescreve a revogação e a limpeza — o efeito
   *     da sessão é jogado fora e revogar concessões vira responsabilidade
   *     implícita do passo;
   *   - rascunho e depois patch: o patch limpa `classSelection` (que está em
   *     `clearedSlices` da linha `classe`) e apaga a escolha NOVA.
   *
   * ## A composição correta
   *
   * O patch é aplicado SOBRE o rascunho do passo, mas as fatias que o passo
   * escreveu de fato são acrescentadas a `preservedSlices` — elas são o
   * resultado da ação, não resíduo da escolha antiga. Tudo o mais do patch
   * (revogação das concessões antigas no `character`, limpeza das demais
   * fatias, descarte de step data) é produzido pela SESSÃO, via o mesmo
   * `applyInvalidationPatch` guardado do caminho de navegação.
   *
   * A revogação incide sobre o `character` do rascunho do passo: como
   * `revokeGrantEffects` é indexado por `sourceInstanceId`, remover as fontes
   * antigas nunca toca em concessões novas que o passo tenha aplicado.
   *
   * @param {object} patch - `InvalidationPatch` devolvido por `reduce`.
   * @param {object} previousDraft - rascunho ANTES do `reduce`.
   * @param {object} stepDraft - rascunho devolvido pelo `reduce`.
   * @param {string} originStepId
   * @returns {import('../../core/result.js').Result}
   */
  function applyReduceInvalidation(patch, previousDraft, stepDraft, originStepId) {
    if (!isInvalidationPatch(patch)) {
      return err(
        sessionError('CREATOR_STEP_INVALIDATE_SHAPE', `O passo "${originStepId}" não devolveu um InvalidationPatch.`, {
          stepId: originStepId,
        }),
      );
    }
    const escritas = slicesWrittenByStep(previousDraft, stepDraft);
    const preservadas = [...new Set([...patch.preservedSlices, ...escritas])];

    // A proveniência que sobrevive à ação NÃO é revogável por este patch.
    //
    // O caso é a RECONFIRMAÇÃO da mesma entidade: o `sourceInstanceId` é
    // derivado do id de conteúdo, então confirmar o mesmo Mago de novo (trocando
    // só a opção de equipamento) produz o MESMO id — e ele aparecia ao mesmo
    // tempo em `revokedProvenanceIds` (a sessão o lê da proveniência anterior,
    // para revogar "a seleção substituída") e nas fatias que o passo acabou de
    // escrever. O patch então apagava exatamente as concessões recém-aplicadas:
    // personagem sem efeito nenhum, `build.choices` vazio — e, como as fatias
    // continuavam preenchidas, `validate` seguia dizendo `valid: true`.
    //
    // Filtrar aqui é o mesmo princípio de `preservedSlices`, um eixo ao lado: o
    // que é RESULTADO da ação nunca é resíduo dela. Numa troca de verdade a
    // fonte antiga só aparece em fatias que estão sendo limpas, então continua
    // sendo revogada normalmente.
    const vivas = provenanceAliveAfterStep(stepDraft, preservadas);
    const revogaveis = patch.revokedProvenanceIds.filter((id) => !vivas.has(id));

    const efetivo = createInvalidationPatch({
      clearedStepIds: patch.clearedStepIds,
      revokedProvenanceIds: revogaveis,
      preservedSlices: preservadas,
    });
    return applyPatch(efetivo, originStepId, stepDraft);
  }

  // --- API pública ---------------------------------------------------------

  /**
   * Ativa a sessão e carrega o primeiro passo.
   * @param {{signal?: AbortSignal}} [options]
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  async function initialize({ signal } = {}) {
    if (disposed) {
      return err(disposedError());
    }
    return loadStep(currentStepId, { signal });
  }

  /**
   * @returns {Readonly<object>} o snapshot congelado atual.
   */
  function getSnapshot() {
    return snapshot;
  }

  /**
   * Despacha uma intenção.
   *
   * Navegação e transações de modal são tratadas AQUI. Qualquer outra intenção
   * é repassada ao `reduce` do passo ativo (ponto de extensão das Tasks
   * 26-28); um passo sem `reduce` recusa a intenção de forma estruturada em
   * vez de ignorá-la em silêncio.
   *
   * @param {object} intent
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  async function dispatch(intent) {
    if (disposed) {
      return err(disposedError());
    }
    const validated = validateCreatorIntent(intent);
    if (validated.ok !== true) {
      return validated;
    }

    switch (intent.type) {
      case CREATOR_INTENT_TYPES.next:
        return next();
      case CREATOR_INTENT_TYPES.previous:
        return previous();
      case CREATOR_INTENT_TYPES.goToVisited:
        return goToVisited(intent.stepId);
      default:
        break;
    }

    if (isModalIntent(intent)) {
      return applyModalIntent(intent);
    }

    const step = stepRegistry.get(currentStepId);
    if (step === null) {
      return err(sessionError('CREATOR_STEP_NOT_REGISTERED', `Nenhum passo registrado para "${currentStepId}".`, { stepId: currentStepId }));
    }
    if (typeof step.reduce !== 'function') {
      return err(
        sessionError('CREATOR_INTENT_UNHANDLED', `O passo "${currentStepId}" não trata a intenção "${intent.type}".`, {
          stepId: currentStepId,
          intentType: intent.type,
        }),
      );
    }

    // Capturado ANTES do `reduce`: é a base contra a qual sabemos quais
    // fatias o passo escreveu de fato (ver `applyReduceInvalidation`).
    const previousDraft = transactions.getDraft();
    let reduced;
    try {
      reduced = await step.reduce(stepContext(currentStepId), intent);
    } catch (cause) {
      return err(sessionError('CREATOR_STEP_REDUCE_THREW', `O "reduce" do passo "${currentStepId}" lançou uma exceção.`, { stepId: currentStepId }, cause));
    }
    if (!reduced || reduced.ok !== true) {
      return reduced ?? err(sessionError('CREATOR_STEP_REDUCE_FAILED', `O "reduce" do passo "${currentStepId}" não devolveu um Result.`, { stepId: currentStepId }));
    }
    // O `invalidation` devolvido por `reduce` é a via pela qual uma troca
    // DENTRO do mesmo passo dispara a matriz — é ela que exercita a linha
    // `classe` (trocar de classe sem sair do passo `classe`, o caso mais caro
    // desta task; a navegação para trás nunca alcança o índice 0).
    //
    // Rascunho e patch NÃO são aplicados em sequência: são COMPOSTOS por
    // `applyReduceInvalidation`, porque nenhuma das duas ordens simples está
    // certa (ver o comentário lá). Quem revoga as concessões antigas é a
    // SESSÃO, não o passo.
    const invalidation = reduced.value?.invalidation;
    const stepDraft = reduced.value?.draft ?? null;
    if (invalidation !== undefined && invalidation !== null) {
      const composed = applyReduceInvalidation(invalidation, previousDraft, stepDraft ?? previousDraft, currentStepId);
      if (composed.ok !== true) {
        return composed;
      }
    } else if (stepDraft !== null) {
      transactions.setDraft(stepDraft);
    }
    validation = runValidate(currentStepId);
    return ok(notify());
  }

  /**
   * Aplica uma intenção de transação de modal. Só `modal-commit` altera o
   * rascunho — `begin`/`update` mexem apenas na área de estágio e `cancel`
   * descarta tudo.
   *
   * ## Commit + `reduce` são UM só passo (Task 26, Decisão 1)
   *
   * Depois de `transactions.commit()` — e somente depois dele — o passo ativo
   * é consultado pelo seu `reduce`, com a intenção sintética
   * `creator/transaction-committed`. É ali que ele materializa as concessões da
   * seleção nova e devolve a `invalidation` que faz a SESSÃO revogar as da
   * seleção substituída, pelo MESMO `applyReduceInvalidation` do caminho de
   * `dispatch`. Do lado de fora continua sendo um clique e uma intenção: a
   * composição é interna.
   *
   * Se o `reduce` falhar, o commit é DESFEITO (o rascunho volta ao estado
   * pré-commit). Confirmar não pode deixar meia escolha gravada: seria pior do
   * que não ter confirmado, porque a escolha apareceria como aplicada sem
   * nenhuma concessão por trás.
   * @param {object} intent
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  async function applyModalIntent(intent) {
    // Capturado ANTES do commit: é a base contra a qual `applyReduceInvalidation`
    // descobre quais fatias a ação escreveu de fato (as encenadas pela
    // transação MAIS as escritas pelo `reduce`), e é para onde voltamos se o
    // `reduce` falhar.
    const preCommitDraft = transactions.getDraft();
    let result;
    switch (intent.type) {
      case CREATOR_INTENT_TYPES.modalBegin:
        result = transactions.begin(intent.transactionId);
        break;
      case CREATOR_INTENT_TYPES.modalUpdate:
        result = transactions.update(intent.transactionId, { slices: intent.slices, provenance: intent.provenance });
        break;
      case CREATOR_INTENT_TYPES.modalCommit:
        result = transactions.commit(intent.transactionId);
        break;
      case CREATOR_INTENT_TYPES.modalCancel:
        result = transactions.cancel(intent.transactionId);
        break;
      default:
        return err(sessionError('CREATOR_INTENT_UNHANDLED', `Intenção de modal desconhecida: "${intent.type}".`, { intentType: intent.type }));
    }
    if (result.ok !== true) {
      return result;
    }
    if (intent.type === CREATOR_INTENT_TYPES.modalCommit) {
      const composed = await reduceAfterCommit(intent.transactionId, preCommitDraft);
      if (composed.ok !== true) {
        // ROLLBACK. `transactions.commit()` já consumiu a transação, então
        // restaurar só o rascunho publicaria um snapshot que ainda anuncia uma
        // transação inexistente: o modal continuaria aberto com os dois botões
        // errando (`CREATOR_TRANSACTION_NOT_OPEN`) e o controller nunca o
        // fecharia. Reabrimos a transação de verdade — o modal volta a ser
        // cancelável e o commit, repetível — e publicamos o estado restaurado
        // com a validação recomputada, para que ninguém observe o meio da
        // falha.
        transactions.setDraft(preCommitDraft);
        transactions.begin(intent.transactionId);
        validation = runValidate(currentStepId);
        notify();
        return composed;
      }
      validation = runValidate(currentStepId);
    }
    return ok(notify());
  }

  /**
   * Consulta o `reduce` do passo ativo logo após um commit de transação e
   * compõe o resultado pelo caminho único de invalidação.
   *
   * Um passo SEM `reduce` não é erro: significa que confirmar a transação já
   * fez tudo o que havia para fazer (é o caso dos passos-placeholder e de
   * qualquer passo sem concessões). O que seria erro — e é tratado como tal —
   * é o `reduce` existir e falhar.
   * @param {string} transactionId
   * @param {object} preCommitDraft
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  async function reduceAfterCommit(transactionId, preCommitDraft) {
    const step = stepRegistry.get(currentStepId);
    if (step === null || typeof step.reduce !== 'function') {
      return ok(null);
    }
    const committedIntent = createTransactionCommittedIntent(transactionId);
    let reduced;
    try {
      reduced = await step.reduce(stepContext(currentStepId), committedIntent);
    } catch (cause) {
      return err(
        sessionError(
          'CREATOR_STEP_REDUCE_THREW',
          `O "reduce" do passo "${currentStepId}" lançou uma exceção ao confirmar a transação "${transactionId}".`,
          { stepId: currentStepId, transactionId },
          cause,
        ),
      );
    }
    if (!reduced || reduced.ok !== true) {
      return (
        reduced ??
        err(
          sessionError('CREATOR_STEP_REDUCE_FAILED', `O "reduce" do passo "${currentStepId}" não devolveu um Result.`, {
            stepId: currentStepId,
            transactionId,
          }),
        )
      );
    }

    const invalidation = reduced.value?.invalidation;
    const stepDraft = reduced.value?.draft ?? null;
    if (invalidation !== undefined && invalidation !== null) {
      return applyReduceInvalidation(invalidation, preCommitDraft, stepDraft ?? transactions.getDraft(), currentStepId);
    }
    if (stepDraft !== null) {
      transactions.setDraft(stepDraft);
    }
    return ok(null);
  }

  /**
   * Avança para o próximo passo, exigindo que o atual esteja válido.
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  async function next() {
    if (disposed) {
      return err(disposedError());
    }
    const index = creatorStepIndex(currentStepId);
    if (index === CREATOR_STEP_IDS.length - 1) {
      return err(sessionError('CREATOR_ALREADY_AT_LAST_STEP', 'O criador já está no último passo.', { stepId: currentStepId }));
    }
    const current = runValidate(currentStepId);
    validation = current;
    if (current.valid !== true) {
      notify();
      return err(
        sessionError('CREATOR_STEP_INVALID', `O passo "${currentStepId}" ainda não está válido.`, {
          stepId: currentStepId,
          errors: current.errors,
        }),
      );
    }
    currentStepId = CREATOR_STEP_IDS[index + 1];
    visited.add(currentStepId);
    return loadStep(currentStepId);
  }

  /**
   * Volta um passo, invalidando o passo que está sendo abandonado.
   *
   * É SÍNCRONO por contrato: voltar nunca depende de rede. O step data do
   * destino já foi carregado quando ele foi visitado, e o que precisa ser
   * recarregado é marcado por `clearedStepIds` — não por um `load` implícito.
   * @returns {import('../../core/result.js').Result}
   */
  function previous() {
    if (disposed) {
      return err(disposedError());
    }
    const index = creatorStepIndex(currentStepId);
    if (index <= 0) {
      return err(sessionError('CREATOR_ALREADY_AT_FIRST_STEP', 'O criador já está no primeiro passo.', { stepId: currentStepId }));
    }
    const invalidated = invalidateStep(currentStepId);
    if (invalidated.ok !== true) {
      return invalidated;
    }
    // Qualquer carga em voo do passo abandonado deixa de valer.
    invalidateInFlight();
    currentStepId = CREATOR_STEP_IDS[index - 1];
    visited.add(currentStepId);
    status = CREATOR_STATUS.ready;
    validation = runValidate(currentStepId);
    return ok(notify());
  }

  /**
   * Salta para um passo JÁ VISITADO, invalidando todos os passos entre o
   * destino (exclusive) e o atual (inclusive) — a mesma regra do wizard
   * legado, agora expressa pela matriz em vez de por posição.
   * @param {string} stepId
   * @returns {import('../../core/result.js').Result}
   */
  function goToVisited(stepId) {
    if (disposed) {
      return err(disposedError());
    }
    if (!isCreatorStepId(stepId)) {
      return err(creatorStateError('CREATOR_STEP_ID_UNKNOWN', `"${String(stepId)}" não é um passo do criador.`, {}));
    }
    if (!visited.has(stepId)) {
      return err(sessionError('CREATOR_STEP_NOT_VISITED', `O passo "${stepId}" ainda não foi visitado.`, { stepId }));
    }
    const target = creatorStepIndex(stepId);
    const current = creatorStepIndex(currentStepId);
    if (target === current) {
      return ok(snapshot);
    }
    if (target > current) {
      return err(
        sessionError('CREATOR_STEP_FORWARD_JUMP_FORBIDDEN', 'Saltar para frente exige avançar passo a passo (com validação).', {
          from: currentStepId,
          to: stepId,
        }),
      );
    }
    // Invalida do atual para trás, até o passo seguinte ao destino.
    for (let index = current; index > target; index -= 1) {
      const invalidated = invalidateStep(CREATOR_STEP_IDS[index]);
      if (invalidated.ok !== true) {
        return invalidated;
      }
    }
    invalidateInFlight();
    currentStepId = stepId;
    status = CREATOR_STATUS.ready;
    validation = runValidate(currentStepId);
    return ok(notify());
  }

  /**
   * Finaliza o personagem. Exige que TODOS os passos estejam válidos — a
   * finalização é o único ponto onde o criador afirma que o resultado é um
   * personagem canônico completo, e afirmá-lo sem checar seria o defeito mais
   * caro do fluxo.
   * @returns {import('../../core/result.js').Result} `ok(CanonicalCharacter)`
   */
  function finalize() {
    if (disposed) {
      return err(disposedError());
    }
    const invalidSteps = [];
    for (const stepId of CREATOR_STEP_IDS) {
      if (stepRegistry.get(stepId) === null || runValidate(stepId).valid !== true) {
        invalidSteps.push(stepId);
      }
    }
    if (invalidSteps.length > 0) {
      return err(
        sessionError('CREATOR_NOT_FINALIZABLE', `O personagem não pode ser finalizado: passos inválidos (${invalidSteps.join(', ')}).`, {
          invalidSteps,
        }),
      );
    }
    const character = transactions.getDraft().character;
    if (character === null || typeof character !== 'object') {
      return err(sessionError('CREATOR_CHARACTER_MISSING', 'O rascunho não contém um personagem canônico.', {}));
    }
    return ok(character);
  }

  /**
   * Inscreve um listener. Devolve o disposer, idempotente.
   * @param {Function} listener
   * @returns {() => void}
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('CreatorSession.subscribe: "listener" deve ser uma função.');
    }
    listeners.push(listener);
    let removed = false;
    return () => {
      if (removed) {
        return;
      }
      removed = true;
      listeners = listeners.filter((entry) => entry !== listener);
    };
  }

  /**
   * Descarta a sessão: aborta cargas, cancela transações abertas (sem
   * commitar nada) e solta todos os listeners. Idempotente.
   * @returns {void}
   */
  function dispose() {
    if (disposed) {
      return;
    }
    disposed = true;
    invalidateInFlight();
    transactions.cancelAll();
    listeners = [];
  }

  /**
   * @returns {boolean} `true` depois de `dispose()`.
   */
  function isDisposed() {
    return disposed;
  }

  return Object.freeze({
    initialize,
    getSnapshot,
    dispatch,
    next,
    previous,
    goToVisited,
    finalize,
    subscribe,
    dispose,
    isDisposed,
    // Exposto para o controller montar o contexto de `render`/`bind` sem
    // duplicar a construção; não é um canal de mutação (o contexto é
    // congelado e recriado a cada chamada).
    getStepContext: stepContext,
  });
}
