// Módulo `features/creator/creator-controller`: o CONTROLLER do criador — o
// único lugar do fluxo autorizado a tocar o DOM, registrar listeners, abrir
// modal e falar com repositório/fila de sincronização.
//
// ## O que o controller centraliza (e por quê)
//
//  - LISTENERS: um único conjunto de listeners DELEGADOS na raiz, registrado
//    uma vez no mount e removido uma vez no dispose. Os passos declaram
//    `eventTypes` e `toIntent`; nunca registram nada. Assim um re-render não
//    multiplica listeners (o bug clássico do wizard legado, que refaz
//    `addEventListener` a cada `renderStep`) e o disposer consegue prometer
//    "não sobra listener".
//  - `preventDefault`/`stopPropagation`: aplicados aqui, a partir da
//    `UiEventDecision` devolvida pelo passo (`applyUiEventDecision`).
//  - MODAIS: abertos aqui. Um passo pede um modal DESCREVENDO a intenção
//    (`creator/modal-begin`); ele não recebe o `ModalService` e por isso não
//    tem como abrir um modal por fora da transação.
//
// ## Disposer
//
// `mountCreator` devolve, em caso de sucesso, um disposer IDEMPOTENTE que
// cancela cargas em voo, fecha os modais que ele mesmo abriu, remove os
// listeners e chama `session.dispose()`.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { applyUiEventDecision, delegate } from '../../ui/event-delegation.js';
import { createDurableCharacterMutation } from '../../infra/sync/durable-character-mutation.js';
import { CREATOR_INTENT_TYPES, createCreatorIntent, isModalIntent } from './creator-intents.js';
import { renderCreatorShell } from './creator-view.js';
import { finalizeCharacter } from './finalize-character.js';

const SCOPE = 'features.creator.controller';

/**
 * Motivo registrado no repositório para a escrita de criação.
 *
 * O enum é FECHADO pelo repositório (`user` | `migration` | `sync`, ver
 * `local-storage-character-repository.js#VALID_REASONS`): criar personagem é
 * uma ação do usuário. Um valor fora do enum é recusado com
 * `CHARACTER_SAVE_INVALID_REASON` — a constante mora aqui para que o motivo
 * seja verificável por teste em vez de um literal solto no meio do fluxo.
 * @type {string}
 */
export const CREATOR_SAVE_REASON = 'user';

/**
 * Estados de sincronização que o controller sabe distinguir depois do save
 * local. São exatamente os dois que `createDurableCharacterMutation` devolve.
 * @type {Readonly<Record<string, string>>}
 */
export const CREATOR_SYNC_STATES = Object.freeze({
  queued: 'queued',
  reconciliationNeeded: 'reconciliation-needed',
});

// Seletor da delegação: o controller não filtra por seletor porque QUEM sabe
// se o evento interessa é o `toIntent` do passo. `*` casa com o elemento-alvo
// e a busca continua limitada a `root` por `delegate`.
const ANY_ELEMENT = '*';

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {*} [cause]
 * @returns {object}
 */
function controllerError(code, message, context = {}, cause = undefined) {
  return createAppError({ code, scope: SCOPE, message, context, cause });
}

/**
 * Monta o criador em `container`.
 *
 * @param {{
 *   container: object,
 *   session: object,
 *   stepRegistry: object,
 *   repository?: object|null,
 *   syncQueue?: object|null,
 *   modal?: object|null,
 *   notifier?: object|null,
 *   navigate?: Function|null,
 *   imageProcessor?: object|null,
 *   moduleName?: string,
 *   signal?: AbortSignal
 * }} ports
 * @returns {Promise<import('../../core/result.js').Result>} `ok(dispose)`
 */
export async function mountCreator(ports = {}) {
  const {
    container,
    session,
    stepRegistry,
    repository = null,
    syncQueue = null,
    modal = null,
    notifier = null,
    navigate = null,
    imageProcessor = null,
    clock = null,
    durableMutation = null,
    moduleName = 'features/creator',
    signal,
  } = ports;

  if (!container || typeof container.addEventListener !== 'function') {
    return err(controllerError('CREATOR_MOUNT_CONTAINER_INVALID', '"container" precisa ser um nó DOM.'));
  }
  if (!session || typeof session.subscribe !== 'function' || typeof session.dispatch !== 'function') {
    return err(controllerError('CREATOR_MOUNT_SESSION_INVALID', '"session" precisa ser uma CreatorSession.'));
  }
  if (!stepRegistry || typeof stepRegistry.get !== 'function') {
    return err(controllerError('CREATOR_MOUNT_STEP_REGISTRY_INVALID', '"stepRegistry" é obrigatório.'));
  }

  /** @type {Array<Function>} */
  const teardown = [];
  /** @type {Map<string, {handle: object, teardown: Array<Function>}>} modais abertos POR ESTE controller. */
  const openModals = new Map();
  let disposed = false;

  /**
   * Devolve o descritor de binding do passo ativo, ou `null`.
   * @param {object} snapshot
   * @returns {object|null}
   */
  function bindingFor(snapshot) {
    const step = stepRegistry.get(snapshot.currentStepId);
    if (step === null) {
      return null;
    }
    try {
      return step.bind(session.getStepContext(snapshot.currentStepId, { root: container }));
    } catch {
      return null;
    }
  }

  // Assinatura do SHELL desenhado por último. Tudo o que `renderCreatorShell`
  // desenha fora do miolo do passo depende SÓ destes campos (ver
  // `creator-view.js`): a barra de passos vem de `currentStepId` +
  // `visitedStepIds`, o bloco de erro vem de `error`, e a barra de navegação
  // vem apenas do índice do passo atual. Nada ali depende do rascunho.
  /** @type {string|null} */
  let lastShellKey = null;

  /**
   * Assinatura do shell para o snapshot dado.
   * @param {object} snapshot
   * @returns {string}
   */
  function shellKeyOf(snapshot) {
    return JSON.stringify([
      snapshot.currentStepId,
      snapshot.visitedStepIds,
      snapshot.status,
      snapshot.generation,
      snapshot.error?.code ?? null,
      snapshot.error?.message ?? null,
    ]);
  }

  /**
   * Renderiza o snapshot atual em `container`.
   *
   * ## Por que o shell NÃO é redesenhado a cada intenção (Task 28b)
   *
   * Redesenhar tudo (`container.innerHTML = ...`) a cada `notify` destrói e
   * recria também os botões de navegação — e isso ENGOLE cliques do usuário,
   * num caso concreto e frequente:
   *
   *   1. o jogador digita o nome no passo `detalhes` e clica em "Finalizar";
   *   2. o `mousedown` no botão tira o foco do campo, o que dispara `change`;
   *   3. a intenção do campo é despachada e o `notify` redesenha o contêiner
   *      INTEIRO — ainda antes do `mouseup`, porque o ciclo é de microtasks;
   *   4. o `mouseup` cai num botão que não está mais no documento, então
   *      NENHUM evento `click` chega à raiz de delegação.
   *
   * O efeito é o pior possível: o primeiro clique em "Finalizar" não faz nada
   * e não diz nada. Reproduzido em navegador real ao ligar o composition root
   * público — os testes de passo isolados não veem porque não têm foco/blur.
   *
   * A primeira metade da correção é preservar a IDENTIDADE dos nós que a
   * mudança não afeta: enquanto a assinatura do shell não mudar, só o miolo do
   * passo é reescrito. O markup produzido é o mesmo; o que muda é quanta coisa
   * é destruída para chegar nele.
   *
   * A segunda metade é `paint` NÃO ACONTECER NO MEIO DE UM GESTO (ver
   * `render`/`onGestureStart`): preservar o shell salva os botões de
   * navegação, mas não salva um controle DENTRO do próprio passo — e o passo
   * `detalhes` põe o campo de nome ANTES do grid de alinhamento e dos demais
   * campos de texto, então "digitar o nome e clicar no alinhamento" caía
   * exatamente no mesmo buraco.
   *
   * @param {object} snapshot
   * @returns {void}
   */
  function paint(snapshot) {
    const step = stepRegistry.get(snapshot.currentStepId);
    let stepMarkup = '';
    if (step !== null) {
      try {
        const produced = step.render(session.getStepContext(snapshot.currentStepId, { root: container }));
        stepMarkup = typeof produced === 'string' ? produced : '';
      } catch {
        stepMarkup = '';
      }
    }

    const foco = captureFocus();
    const shellKey = shellKeyOf(snapshot);
    const content = typeof container.querySelector === 'function' ? container.querySelector('#wizard-content') : null;
    if (content !== null && shellKey === lastShellKey) {
      content.innerHTML = stepMarkup;
    } else {
      container.innerHTML = renderCreatorShell(snapshot, stepMarkup, { moduleName });
      lastShellKey = shellKey;
    }
    restoreFocus(foco);
  }

  // --- Foco e cursor sobrevivem ao re-render (Task 28b) ---------------------
  //
  // Reescrever o miolo do passo destrói o elemento focado. Num formulário isso
  // é grave de um jeito específico: o jogador CLICA num campo para digitar, o
  // re-render (provocado pelo campo anterior) troca o nó logo depois, e ele
  // começa a digitar num documento cujo `activeElement` voltou a ser o `body`.
  // As teclas vão para lugar nenhum e não há nada na tela dizendo por quê.
  //
  // A identidade é reconstruída por SELETOR ESTÁVEL — `id` quando existe,
  // senão o primeiro atributo `data-*` do elemento —, porque o nó novo é
  // outro objeto. Sem seletor estável, nada é restaurado (nunca se adivinha
  // "um input parecido").

  /**
   * Seletor estável do elemento, ou `null` quando ele não tem um.
   * @param {object} element
   * @returns {string|null}
   */
  function stableSelectorOf(element) {
    if (typeof element?.getAttribute !== 'function') {
      return null;
    }
    const id = element.getAttribute('id');
    if (typeof id === 'string' && id.length > 0) {
      return `#${CSS_ESCAPE(id)}`;
    }
    for (const attribute of element.attributes ?? []) {
      if (attribute.name.startsWith('data-')) {
        return `[${attribute.name}="${CSS_ESCAPE(attribute.value)}"]`;
      }
    }
    return null;
  }

  /**
   * Fotografa o foco atual (e o cursor, quando o controle tem seleção).
   * @returns {object|null}
   */
  function captureFocus() {
    const doc = container.ownerDocument ?? null;
    const active = doc?.activeElement ?? null;
    if (active === null || active === doc?.body || typeof container.contains !== 'function' || !container.contains(active)) {
      return null;
    }
    const selector = stableSelectorOf(active);
    if (selector === null) {
      return null;
    }
    const selection =
      typeof active.selectionStart === 'number' ? { start: active.selectionStart, end: active.selectionEnd } : null;
    return { selector, selection };
  }

  /**
   * Devolve o foco (e o cursor) ao equivalente do elemento fotografado.
   * @param {object|null} foco
   * @returns {void}
   */
  function restoreFocus(foco) {
    if (foco === null) {
      return;
    }
    let alvo = null;
    try {
      alvo = container.querySelector(foco.selector);
    } catch {
      alvo = null;
    }
    if (alvo === null || typeof alvo.focus !== 'function') {
      return;
    }
    try {
      alvo.focus();
      if (foco.selection !== null && typeof alvo.setSelectionRange === 'function') {
        alvo.setSelectionRange(foco.selection.start, foco.selection.end);
      }
    } catch {
      // Ambientes sem foco real (LinkeDOM) não podem derrubar o render.
    }
  }

  // --- Nenhum `paint` no meio de um gesto do usuário (Task 28b) -------------
  //
  // O defeito, reproduzido em Chromium no criador público: digitar o nome no
  // passo `detalhes` e clicar UMA vez num card de alinhamento. O `mousedown`
  // tira o foco do campo -> `change` -> intenção -> `notify` -> `paint`, e
  // tudo isso acontece ANTES do `mouseup`, porque o ciclo é de microtasks. O
  // card que recebeu o `mousedown` já não está no documento quando o `mouseup`
  // chega: o `click` nunca é emitido e o alinhamento não é selecionado. Sem
  // toast, sem log — só um clique que não fez nada. O mesmo vale para clicar
  // num campo de texto para focá-lo.
  //
  // Preservar o shell (acima) resolveu o caso do botão "Finalizar", que vive
  // FORA do miolo. Não resolve nada dentro do passo — e é dentro do passo que
  // moram o alinhamento, a imagem e os sete campos de texto.
  //
  // A correção é temporal, não estrutural: enquanto um gesto de ponteiro
  // estiver aberto (`mousedown` .. `mouseup`), o `paint` é ADIADO. O DOM que o
  // usuário começou a tocar continua existindo até o gesto terminar, o `click`
  // é emitido normalmente, e só então a tela é redesenhada — uma vez, com o
  // snapshot mais recente.
  //
  // O adiamento vale para QUALQUER passo (é do controller, não do passo), e é
  // curto por construção: o limite é a duração de um clique.

  /**
   * Escape mínimo para valor dentro de seletor CSS. `CSS.escape` não existe em
   * todo ambiente de teste, então a função é local e conservadora.
   * @param {string} valor
   * @returns {string}
   */
  function CSS_ESCAPE(valor) {
    return String(valor).replace(/["\\\]]/g, '\\$&');
  }

  let gestureOpen = false;
  /** @type {object|null} snapshot cujo `paint` foi adiado pelo gesto em curso. */
  let deferredSnapshot = null;
  /** @type {*} */
  let gestureEndHandle = null;

  /**
   * Aplica o `paint` adiado, se houver.
   * @returns {void}
   */
  function flushDeferredPaint() {
    const snapshot = deferredSnapshot;
    deferredSnapshot = null;
    if (snapshot !== null && !disposed) {
      paint(snapshot);
    }
  }

  /**
   * Abre o gesto: nenhum `paint` acontece até ele fechar.
   * @returns {void}
   */
  function onGestureStart() {
    if (gestureEndHandle !== null) {
      clearTimeout(gestureEndHandle);
      gestureEndHandle = null;
    }
    gestureOpen = true;
  }

  /**
   * Fecha o gesto — mas só depois de o `click` ter sido despachado.
   *
   * `mouseup` vem ANTES de `click`. Repintar já no `mouseup` recriaria o
   * defeito na última fração: o alvo sumiria entre o `mouseup` e o `click`. O
   * `setTimeout(0)` põe o fechamento depois de toda a sequência do gesto.
   * @returns {void}
   */
  function onGestureEnd() {
    if (!gestureOpen || gestureEndHandle !== null) {
      return;
    }
    gestureEndHandle = setTimeout(() => {
      gestureEndHandle = null;
      gestureOpen = false;
      flushDeferredPaint();
    }, 0);
  }

  /**
   * Renderiza o snapshot — ou o guarda, se um gesto estiver em curso.
   * @param {object} snapshot
   * @returns {void}
   */
  function render(snapshot) {
    if (gestureOpen) {
      // Só o ÚLTIMO snapshot importa: repintar estados intermediários que
      // ninguém chegou a ver seria trabalho jogado fora.
      deferredSnapshot = snapshot;
      return;
    }
    paint(snapshot);
  }

  {
    // `mouseup` é ouvido no DOCUMENTO: soltar o botão fora do contêiner (ou
    // fora da janela) ainda precisa fechar o gesto, senão um arrasto para fora
    // congelaria a tela. `capture: true` para que o fechamento seja agendado
    // mesmo que alguém pare a propagação no caminho.
    // Os dois listeners ficam no DOCUMENTO, nunca na raiz: a raiz continua
    // tendo EXATAMENTE os listeners delegados dos `eventTypes` declarados
    // pelos passos (invariante da Task 25, verificada por
    // `tests/integration/creator-controller.test.js`). O guarda de gesto não é
    // delegação — é uma janela de tempo — e não tem por que aparecer lá.
    const doc = container.ownerDocument ?? null;
    if (doc !== null && typeof doc.addEventListener === 'function') {
      doc.addEventListener('mousedown', onGestureStart, true);
      doc.addEventListener('mouseup', onGestureEnd, true);
      teardown.push(() => {
        doc.removeEventListener('mousedown', onGestureStart, true);
        doc.removeEventListener('mouseup', onGestureEnd, true);
      });
    }
    teardown.push(() => {
      if (gestureEndHandle !== null) {
        clearTimeout(gestureEndHandle);
        gestureEndHandle = null;
      }
      gestureOpen = false;
      // Um `paint` adiado é APLICADO no descarte, não jogado fora: ele
      // representa uma mudança que a sessão JÁ aceitou. Descartá-lo deixaria
      // na tela um estado anterior ao último clique do jogador — o disposer
      // teria "desfeito" visualmente algo que continua gravado no rascunho.
      const pendente = deferredSnapshot;
      deferredSnapshot = null;
      if (pendente !== null) {
        paint(pendente);
      }
    });
  }

  // --- Persistência da criação (Tasks 13/14) -------------------------------
  //
  // A mutação durável é montada UMA vez, aqui, a partir das portas recebidas.
  // Um `durableMutation` injetado vence (é o ponto de teste); sem repositório
  // ou sem fila não há protocolo durável e a finalização RECUSA — nunca salva
  // localmente uma mudança que jamais chegaria ao servidor.
  const mutation =
    durableMutation !== null
      ? durableMutation
      : repository !== null && syncQueue !== null
        ? createDurableCharacterMutation({ repository, syncQueue })
        : null;

  /**
   * Relógio da finalização. `finalizeCharacter` é PURA e por isso não lê
   * relógio nenhum: quem carimba `createdAt`/`updatedAt` é este ponto, com a
   * porta injetada (ou, na ausência dela, o relógio do ambiente — o único
   * lugar do fluxo autorizado a fazer efeito).
   * @returns {string}
   */
  function nowIso() {
    return typeof clock?.now === 'function' ? clock.now() : new Date().toISOString();
  }

  /**
   * Notifica, quando há notificador. Isolado para que a ausência da porta
   * nunca derrube o fluxo de persistência.
   * @param {string} level - `error` | `warn` | `success`
   * @param {*} payload
   * @returns {void}
   */
  function notify(level, payload) {
    const handler = notifier?.[level];
    if (typeof handler === 'function') {
      try {
        handler(payload);
      } catch {
        // Um notificador quebrado não pode desfazer um save já concluído.
      }
    }
  }

  /**
   * FINALIZA o personagem, na ordem exata aprovada.
   *
   *   1. a sessão confere que os SETE passos estão válidos;
   *   2. `finalizeCharacter` monta o `CanonicalCharacter` (função pura);
   *   3. a mutação durável PREPARA o intent (job não enviável), SALVA local
   *      com o `mutationId` e só então CONFIRMA/enfileira;
   *   4. o resultado é notificado;
   *   5. só aí navegamos.
   *
   * O controller NÃO espera a tentativa remota: `save` devolve assim que o
   * job está durável, e o envio acontece pela fila, fora deste caminho. Uma
   * falha ANTES do save local (preparo ou gravação) não navega e não toca o
   * rascunho — o jogador continua no passo `detalhes` com tudo preenchido.
   *
   * Uma falha ao CONFIRMAR a fila é diferente: o personagem JÁ está salvo e
   * adotado, e o job preparado continua durável (a reconciliação do próximo
   * boot o recupera). Nesse caso avisamos "salvo localmente, sincronização
   * pendente", oferecemos retry e navegamos — nunca alegando que sincronizou.
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  async function finalize() {
    if (disposed) {
      return err(controllerError('CREATOR_FINALIZE_DISPOSED', 'O criador já foi descartado.'));
    }
    if (mutation === null) {
      const problem = controllerError(
        'CREATOR_FINALIZE_PERSISTENCE_UNAVAILABLE',
        'A finalização exige repositório e fila de sincronização; sem eles nada é salvo.',
      );
      notify('error', problem);
      return err(problem);
    }

    // 1) Portão: os sete passos precisam estar válidos.
    const gate = session.finalize();
    if (gate.ok !== true) {
      notify('error', gate.error);
      return gate;
    }

    // 2) Montagem PURA do personagem canônico.
    const finalized = finalizeCharacter(session.getSnapshot().draft, { now: nowIso() });
    if (finalized.ok !== true) {
      notify('error', finalized.error);
      return finalized;
    }
    const character = finalized.value;

    // 3) Protocolo durável: prepare -> save local -> confirm.
    let saved;
    try {
      saved = mutation.save(character, { expectedRevisionToken: null, reason: CREATOR_SAVE_REASON });
    } catch (cause) {
      const problem = controllerError('CREATOR_FINALIZE_SAVE_THREW', 'A persistência do personagem lançou uma exceção.', {}, cause);
      notify('error', problem);
      return err(problem);
    }
    if (!saved || saved.ok !== true) {
      // Falha de PREPARO ou de gravação local. Nada foi adotado, nenhum job
      // enviável existe e não navegamos: o rascunho e o passo atual ficam
      // exatamente como estavam.
      const problem = saved?.error ?? controllerError('CREATOR_FINALIZE_SAVE_FAILED', 'A persistência não devolveu um Result.');
      notify('error', problem);
      return err(problem);
    }

    const syncState = saved.value.syncState;
    const pendingSync = syncState !== CREATOR_SYNC_STATES.queued;

    // 4) Notificação HONESTA sobre o que de fato aconteceu.
    if (pendingSync) {
      notify('warn', {
        code: 'CREATOR_SAVED_SYNC_PENDING',
        message: 'Personagem salvo localmente; a sincronização ficou pendente e será retomada.',
        characterId: character.identity.id,
        syncState,
        /**
         * Retry EXPLÍCITO oferecido ao jogador.
         *
         * Reconcilia o intent PREPARADO — que continua durável na fila —, em
         * vez de regravar o personagem. Regravar seria errado duas vezes: o
         * personagem já está salvo e adotado (um segundo `save` com
         * `expectedRevisionToken: null` bate em `CHARACTER_SAVE_ALREADY_EXISTS`),
         * e o que falhou não foi a escrita local e sim a confirmação da fila.
         * @returns {import('../../core/result.js').Result}
         */
        retry: () =>
          typeof syncQueue?.reconcilePrepared === 'function'
            ? syncQueue.reconcilePrepared()
            : err(
                controllerError(
                  'CREATOR_RETRY_UNAVAILABLE',
                  'A fila de sincronização não oferece reconciliação; a retomada acontecerá no próximo boot.',
                ),
              ),
      });
    } else {
      notify('success', { code: 'CREATOR_SAVED', message: 'Personagem criado.', characterId: character.identity.id });
    }

    // 5) Só agora navegamos.
    if (typeof navigate === 'function') {
      navigate(character.identity.id, { syncState });
    }
    return ok(Object.freeze({ character, syncState, envelope: saved.value.envelope }));
  }

  /**
   * Encaminha uma intenção: modais são efeito do controller; o resto vai para
   * a sessão.
   * @param {object} intent
   * @returns {Promise<void>}
   */
  async function handleIntent(intent) {
    if (disposed || intent === null || intent === undefined) {
      return;
    }
    if (isModalIntent(intent)) {
      await handleModalIntent(intent);
      return;
    }
    const result = await session.dispatch(intent);
    if (result.ok !== true && notifier && typeof notifier.error === 'function') {
      notifier.error(result.error);
    }
  }

  /**
   * Abre/fecha o modal correspondente e mantém a transação da sessão em
   * sincronia. Fechar por backdrop/Escape é tratado como CANCELAR — nunca
   * como confirmar: um fechamento acidental jamais grava escolha.
   * @param {object} intent
   * @returns {Promise<void>}
   */
  async function handleModalIntent(intent) {
    const dispatched = await session.dispatch(intent);
    if (dispatched.ok !== true) {
      if (notifier && typeof notifier.error === 'function') {
        notifier.error(dispatched.error);
      }
      return;
    }

    if (intent.type === CREATOR_INTENT_TYPES.modalBegin) {
      if (modal === null || typeof modal.open !== 'function') {
        return;
      }
      /** @type {Array<Function>} */
      const modalTeardown = [];
      const handle = modal.open({
        title: intent.title ?? '',
        content: intent.content ?? null,
        actions: intent.actions ?? null,
        /**
         * Fechamento por qualquer via que não seja o commit explícito conta
         * como cancelamento da transação.
         * @returns {void}
         */
        onClose: () => {
          const entry = openModals.get(intent.transactionId);
          if (entry !== undefined) {
            openModals.delete(intent.transactionId);
            for (const undo of entry.teardown.splice(0)) {
              undo();
            }
            if (!disposed) {
              void session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalCancel, { transactionId: intent.transactionId }));
            }
          }
        },
      });

      // DELEGAÇÃO DENTRO DO MODAL (Task 26, Decisão 2).
      //
      // O overlay do modal é irmão do container do criador, não descendente:
      // sem isto, NENHUM clique dentro do modal chegaria ao `toIntent` do
      // passo e o corpo do modal seria markup morto. O tratador é o MESMO da
      // raiz — não há um segundo caminho de evento, só uma segunda raiz de
      // delegação, criada e destruída junto com o modal que a originou.
      const modalRoot = handle?.element ?? null;
      if (modalRoot !== null && typeof modalRoot.addEventListener === 'function') {
        for (const eventType of eventTypes) {
          modalTeardown.push(
            delegate(modalRoot, eventType, ANY_ELEMENT, (event, matched) => handleDelegatedEvent(modalRoot, event, matched)),
          );
        }
      }
      openModals.set(intent.transactionId, { handle, teardown: modalTeardown });
      return;
    }

    if (intent.type === CREATOR_INTENT_TYPES.modalCommit || intent.type === CREATOR_INTENT_TYPES.modalCancel) {
      const entry = openModals.get(intent.transactionId);
      if (entry !== undefined) {
        // Remove ANTES de fechar: o `onClose` não pode disparar um cancel
        // sobre uma transação que acabou de ser commitada.
        openModals.delete(intent.transactionId);
        for (const undo of entry.teardown.splice(0)) {
          undo();
        }
        if (typeof entry.handle.close === 'function') {
          entry.handle.close();
        }
      }
    }
  }

  // --- Um único conjunto de listeners delegados na raiz ---------------------
  //
  // A união dos `eventTypes` de TODOS os passos registrados é calculada uma
  // vez, no mount. Se um passo declarasse um tipo novo depois, ele não seria
  // ouvido — e é isso que queremos: o conjunto de listeners é estável e
  // auditável, não algo que cresce a cada render.
  const eventTypes = new Set(['click']);
  for (const step of typeof stepRegistry.list === 'function' ? stepRegistry.list() : []) {
    let binding = null;
    try {
      binding = step.bind(session.getStepContext(step.id, { root: container }));
    } catch {
      binding = null;
    }
    for (const type of binding?.eventTypes ?? []) {
      eventTypes.add(type);
    }
  }

  /**
   * Tratador ÚNICO de evento delegado, usado tanto na raiz do criador quanto
   * na raiz de um modal aberto por este controller.
   * @param {object} root - raiz de delegação em que o evento foi capturado.
   * @param {object} event
   * @param {object} matched
   * @returns {void}
   */
  function handleDelegatedEvent(root, event, matched) {
    if (disposed) {
      return;
    }
    // 1) Navegação do shell (botões do próprio controller). Só existe na raiz
    // do criador; num modal não há barra de navegação.
    const navButton = typeof matched.closest === 'function' ? matched.closest('[data-creator-nav]') : null;
    if (event.type === 'click' && navButton && root.contains(navButton)) {
      const action = navButton.getAttribute('data-creator-nav');
      if (action === 'previous') {
        void handleIntent(createCreatorIntent(CREATOR_INTENT_TYPES.previous));
        return;
      }
      if (action === 'next') {
        void handleIntent(createCreatorIntent(CREATOR_INTENT_TYPES.next));
        return;
      }
      // `finalize` é o botão do ÚLTIMO passo (`renderCreatorShell` já o
      // emitia desde a Task 25, sem tratador). Não é uma intenção da sessão:
      // finalizar é efeito do controller (persistência e navegação), e por
      // isso é tratado aqui, no mesmo lugar onde vivem as outras portas.
      if (action === 'finalize') {
        void finalize();
        return;
      }
    }
    const stepChip = typeof matched.closest === 'function' ? matched.closest('[data-step]') : null;
    if (event.type === 'click' && stepChip && root.contains(stepChip)) {
      const target = stepChip.getAttribute('data-step');
      if (target) {
        void handleIntent(createCreatorIntent(CREATOR_INTENT_TYPES.goToVisited, { stepId: target }));
        return;
      }
    }

    // 2) O passo ativo decide o resto — sempre por decisão declarativa.
    const binding = bindingFor(session.getSnapshot());
    if (binding === null) {
      return;
    }
    let decision;
    try {
      decision = binding.toIntent(event);
    } catch {
      return;
    }
    if (!decision) {
      return;
    }
    applyUiEventDecision(event, decision);
    if (decision.intent !== null) {
      void handleIntent(decision.intent);
    }
  }

  for (const eventType of eventTypes) {
    teardown.push(delegate(container, eventType, ANY_ELEMENT, (event, matched) => handleDelegatedEvent(container, event, matched)));
  }

  const unsubscribe = session.subscribe(render);
  teardown.push(unsubscribe);

  const initialized = await session.initialize({ signal });
  if (initialized.ok !== true) {
    // O mount FALHOU: desfazemos tudo que já tinha sido montado antes de
    // devolver o erro. Um mount fracassado não pode deixar listener vivo.
    for (const undo of teardown.splice(0)) {
      undo();
    }
    session.dispose();
    return initialized;
  }
  render(session.getSnapshot());

  // `imageProcessor` é consumido pelo passo `detalhes` através do contexto da
  // SESSÃO (mesmo canal de `rng`/`clock`), não daqui: processar um arquivo é
  // parte do `reduce` do passo, não do ciclo de eventos do controller. A porta
  // continua declarada no mount porque é o composition root quem a monta, e é
  // ele quem a entrega às duas pontas.
  void imageProcessor;

  /**
   * Disposer idempotente do mount.
   * @returns {void}
   */
  function dispose() {
    if (disposed) {
      return;
    }
    disposed = true;
    for (const [, entry] of openModals) {
      for (const undo of entry.teardown.splice(0)) {
        undo();
      }
      if (typeof entry.handle.close === 'function') {
        entry.handle.close();
      }
    }
    openModals.clear();
    for (const undo of teardown.splice(0)) {
      undo();
    }
    session.dispose();
  }

  // O disposer é a interface primária (contrato da Task 25: `ok(dispose)`), e
  // continua sendo uma FUNÇÃO chamável. `finalize` é pendurado nele como
  // propriedade para que os testes possam disparar a finalização sem simular
  // um clique — sem introduzir um segundo formato de retorno que quebraria
  // `renderCreator`/harness, que só chamam `dispose()`.
  dispose.finalize = finalize;
  return ok(dispose);
}
