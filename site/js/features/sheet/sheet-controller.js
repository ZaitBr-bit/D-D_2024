// Módulo `features/sheet/sheet-controller`: o CONTROLLER da ficha — o único
// lugar do fluxo autorizado a tocar o DOM, registrar listeners e abrir modal.
//
// ## O que ele centraliza (e por quê)
//
//  - LISTENERS: um único conjunto DELEGADO na raiz, registrado uma vez no
//    mount e removido uma vez no dispose. As seções declaram `eventTypes` e
//    `toIntent`; nunca chamam `addEventListener`. Assim um rerender parcial
//    não multiplica listener (o defeito clássico do `sheet.js` legado, que
//    reatribui handlers a cada redesenho) e o disposer consegue prometer "não
//    sobra listener".
//  - `preventDefault`/`stopPropagation`: aplicados aqui, a partir da
//    `UiEventDecision` devolvida pela seção (`applyUiEventDecision`).
//  - MODAIS: abertos aqui. Uma seção pede um modal DESCREVENDO-o
//    (`sheet/modal-open`); ela não recebe o `ModalService` e por isso não tem
//    como abrir um modal por fora do fluxo.
//  - RERENDER PARCIAL: só os miolos de `snapshot.dirtySections` são
//    reescritos. Repintar a ficha inteira a cada comando destruiria o nó que o
//    jogador está tocando.
//
// ## Disposer
//
// `mountSheet` devolve, em caso de sucesso, um disposer IDEMPOTENTE que
// cancela o init em voo, fecha os modais que ele mesmo abriu, remove os
// listeners/subscriptions e chama `session.dispose()`.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { applyUiEventDecision, delegate } from '../../ui/event-delegation.js';
import { SHEET_INTENT_TYPES, isSheetIntent } from './sheet-state.js';
import { renderSheetShell, sectionBodySelector, shellKeyOf, updateSheetNotices, SECTION_ATTRIBUTE } from './sheet-view.js';

const SCOPE = 'features.sheet.controller';

// Seletor da delegação: o controller não filtra por seletor porque QUEM sabe
// se o evento interessa é o `toIntent` da seção. `*` casa com o elemento-alvo
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
 * Monta a ficha em `container`.
 *
 * @param {{
 *   container: object,
 *   session: object,
 *   sectionRegistry: object,
 *   modal?: object|null,
 *   notifier?: object|null,
 *   moduleName?: string,
 *   signal?: AbortSignal
 * }} ports
 * @returns {Promise<import('../../core/result.js').Result>} `ok(dispose)`
 */
export async function mountSheet(ports = {}) {
  const { container, session, sectionRegistry, modal = null, notifier = null, moduleName = 'features/sheet', signal } = ports;

  if (!container || typeof container.addEventListener !== 'function') {
    return err(controllerError('SHEET_MOUNT_CONTAINER_INVALID', '"container" precisa ser um nó DOM.'));
  }
  if (!session || typeof session.subscribe !== 'function' || typeof session.dispatch !== 'function') {
    return err(controllerError('SHEET_MOUNT_SESSION_INVALID', '"session" precisa ser uma SheetSession.'));
  }
  if (!sectionRegistry || typeof sectionRegistry.get !== 'function' || typeof sectionRegistry.list !== 'function') {
    return err(controllerError('SHEET_MOUNT_SECTION_REGISTRY_INVALID', '"sectionRegistry" é obrigatório.'));
  }

  /** @type {Array<Function>} */
  const teardown = [];
  /** @type {Map<string, {handle: object, teardown: Array<Function>}>} modais abertos POR ESTE controller. */
  const openModals = new Map();
  let disposed = false;

  // Cancelamento do init pertence ao CONTROLLER: o disposer precisa poder
  // abortar um carregamento que ainda não terminou, mesmo que quem montou não
  // tenha passado `signal`.
  const mountController = typeof AbortController === 'function' ? new AbortController() : null;
  if (signal && typeof signal.addEventListener === 'function' && mountController !== null) {
    if (signal.aborted) {
      mountController.abort();
    } else {
      signal.addEventListener('abort', () => mountController.abort(), { once: true });
    }
  }

  /** @type {string|null} assinatura do shell desenhado por último. */
  let lastShellKey = null;

  /**
   * Renderiza o miolo de UMA seção a partir do snapshot.
   *
   * `select` recorta a projeção; `render` devolve markup. Uma seção que lança
   * produz miolo vazio — nunca derruba o resto da ficha nem deixa a exceção
   * escapar para o loop de eventos.
   * @param {object} section
   * @param {object} snapshot
   * @returns {string}
   */
  function renderSection(section, snapshot) {
    try {
      const projection = section.select(snapshot.viewModel);
      const markup = section.render(projection, snapshot.uiState);
      return typeof markup === 'string' ? markup : '';
    } catch {
      return '';
    }
  }

  /**
   * Desenha o snapshot.
   *
   * Shell inalterado + `dirtySections` -> reescreve SÓ os miolos sujos,
   * preservando a identidade de todos os demais nós. Shell alterado (status,
   * modo, erro, colapso) -> redesenha o casco uma vez.
   * @param {object} snapshot
   * @returns {void}
   */
  function render(snapshot) {
    if (disposed) {
      return;
    }
    const shellKey = shellKeyOf(snapshot);
    const sections = sectionRegistry.list();

    if (shellKey !== lastShellKey || container.querySelector(`[${SECTION_ATTRIBUTE}]`) === null) {
      /** @type {Map<string, string>} */
      const markup = new Map();
      for (const section of sections) {
        markup.set(section.id, renderSection(section, snapshot));
      }
      container.innerHTML = renderSheetShell(snapshot, markup, { moduleName, sectionIds: sectionRegistry.sectionIds() });
      lastShellKey = shellKey;
      return;
    }

    // Estado de sincronização e avisos mudam a cada comando; eles são
    // atualizados NO LUGAR, sem tocar na estrutura das seções.
    updateSheetNotices(container, snapshot);

    for (const sectionId of snapshot.dirtySections ?? []) {
      const section = sectionRegistry.get(sectionId);
      if (section === null) {
        continue;
      }
      const body = container.querySelector(sectionBodySelector(sectionId));
      if (body !== null) {
        body.innerHTML = renderSection(section, snapshot);
      }
    }
  }

  /**
   * Notifica, quando há notificador. Isolado para que a ausência (ou um
   * notificador quebrado) nunca derrube o fluxo.
   * @param {string} level
   * @param {*} payload
   * @returns {void}
   */
  function notify(level, payload) {
    const handler = notifier?.[level];
    if (typeof handler === 'function') {
      try {
        handler(payload);
      } catch {
        // Um notificador quebrado não desfaz nada que já aconteceu.
      }
    }
  }

  /**
   * Aplica uma `SheetIntent`. É o ÚNICO ponto onde intenção vira efeito.
   * @param {object} intent
   * @returns {Promise<void>}
   */
  async function handleIntent(intent) {
    if (disposed || !isSheetIntent(intent)) {
      return;
    }
    switch (intent.type) {
      case SHEET_INTENT_TYPES.command: {
        // `uiStatePatch` num comando — mesma porta que `modal-open` já usa
        // (Task 30), e pelo mesmo motivo: existe estado de TELA que precisa
        // valer junto com o comando, e uma `SheetIntent` carrega UM comando.
        //
        // O caso concreto é o fim de um arrasto: o `drop` emite
        // `reorder-inventory` E precisa apagar `draggingInstanceId`. Sem isto o
        // id sobrevivia ao gesto e um segundo `drop` — inclusive de um payload
        // que não é nosso — reordenava de novo sem que ninguém tivesse
        // arrastado nada. Aplicar ANTES do dispatch é deliberado: o repaint
        // disparado pelo comando já encontra o gesto encerrado.
        if (intent.uiStatePatch !== null && intent.uiStatePatch !== undefined && typeof intent.uiStatePatch === 'object') {
          const applied = session.setUiState(intent.uiStatePatch);
          if (applied.ok !== true) {
            notify('error', applied.error);
          }
        }
        const result = await session.dispatch(intent.command);
        if (result.ok !== true) {
          notify('error', result.error);
        }
        return;
      }
      case SHEET_INTENT_TYPES.uiState: {
        const result = session.setUiState(intent.patch ?? {});
        if (result.ok !== true) {
          notify('error', result.error);
        }
        return;
      }
      case SHEET_INTENT_TYPES.retry: {
        const result = await session.retry(intent.failureId);
        if (result.ok !== true) {
          notify('error', result.error);
        }
        return;
      }
      case SHEET_INTENT_TYPES.modalOpen: {
        // `uiStatePatch` (Task 30): um modal pode vir acompanhado de uma
        // mudança de ESTADO DE TELA que precisa valer ANTES de ele abrir — hoje
        // o "Ativar V2 e continuar" do fluxo de level-up, que religa
        // `feature.levelup.flow.v2` e reabre o modal já no modo em cards.
        //
        // Aplicá-lo aqui, e não na seção, mantém o contrato: a seção continua
        // apenas DESCREVENDO, e o único ponto que converte intenção em efeito
        // continua sendo este. Sem isto, o botão reabriria o modal em cards e
        // não gravaria preferência nenhuma — um controle que parece funcionar e
        // volta atrás no próximo clique.
        if (intent.uiStatePatch !== null && typeof intent.uiStatePatch === 'object') {
          const applied = session.setUiState(intent.uiStatePatch);
          if (applied.ok !== true) {
            notify('error', applied.error);
          }
        }
        openModal(intent);
        return;
      }
      case SHEET_INTENT_TYPES.modalClose:
        closeModal(intent.modalId);
        return;
      default:
    }
  }

  /**
   * Converte o `content`/`actions` DESCRITO por uma seção em nós DOM.
   *
   * O `ModalService` (Task 24) recusa string de HTML por contrato — e está
   * certo: quem constrói o nó precisa ser quem tem `document`. Uma seção é
   * PURA e não tem; ela descreve o markup (já escapado por
   * `escapeHtml`/`escapeHtmlAttribute`, mesma disciplina do `render`), e é o
   * controller — o único dono do DOM neste fluxo — que o materializa. Assim o
   * modelo de confiança continua o mesmo do `render` de seção, sem afrouxar a
   * fronteira do `ModalService`.
   * @param {*} value
   * @returns {*} nós, ou o valor original quando já não é string.
   */
  function toModalNodes(value) {
    if (typeof value !== 'string') {
      return value ?? null;
    }
    const doc = container.ownerDocument ?? null;
    if (doc === null || typeof doc.createElement !== 'function') {
      return null;
    }
    const template = doc.createElement('template');
    template.innerHTML = value;
    return template.content !== undefined && template.content !== null ? [...template.content.childNodes] : [...template.childNodes];
  }

  /**
   * Abre um modal DESCRITO por uma seção, ligando nele a MESMA delegação da
   * raiz.
   *
   * O overlay do modal é irmão do container da ficha, não descendente: sem
   * isto, nenhum clique dentro do modal chegaria ao `toIntent` da seção e o
   * corpo do modal seria markup morto. Não é um segundo caminho de evento —
   * é uma segunda raiz de delegação, criada e destruída junto com o modal.
   * @param {object} intent
   * @returns {void}
   */
  function openModal(intent) {
    if (modal === null || typeof modal.open !== 'function' || typeof intent.modalId !== 'string') {
      return;
    }
    // REABERTURA do mesmo `modalId`: fecha o anterior e desenha o novo, em vez
    // de ignorar o pedido.
    //
    // Ignorar era o comportamento original, e ele escondia um defeito real: o
    // "Ativar V2 e continuar" do fluxo de level-up pede o MESMO `modalId` com
    // conteúdo NOVO (o fluxo em cards no lugar do aviso). Com o early-return, a
    // preferência era gravada e a tela continuava mostrando o aviso — um botão
    // que parece não fazer nada. É a mesma sequência do baseline
    // (`sheet.js#abrirModalLevelUp`: `fecharModal()` e abre de novo).
    //
    // Um clique duplicado no mesmo botão continua sendo inofensivo: redesenha o
    // mesmo conteúdo.
    if (openModals.has(intent.modalId)) {
      closeModal(intent.modalId);
    }
    /** @type {Array<Function>} */
    const modalTeardown = [];
    const handle = modal.open({
      title: intent.title ?? '',
      content: toModalNodes(intent.content),
      actions: toModalNodes(intent.actions),
      /**
       * Fechar por backdrop/Escape é FECHAR, nunca confirmar: um fechamento
       * acidental não pode disparar comando nenhum.
       * @returns {void}
       */
      onClose: () => {
        const entry = openModals.get(intent.modalId);
        if (entry !== undefined) {
          openModals.delete(intent.modalId);
          for (const undo of entry.teardown.splice(0)) {
            undo();
          }
        }
      },
    });

    const modalRoot = handle?.element ?? null;
    if (modalRoot !== null && typeof modalRoot.addEventListener === 'function') {
      for (const eventType of eventTypes) {
        modalTeardown.push(delegate(modalRoot, eventType, ANY_ELEMENT, (event, matched) => handleDelegatedEvent(modalRoot, event, matched)));
      }
    }
    openModals.set(intent.modalId, { handle, teardown: modalTeardown });
  }

  /**
   * Fecha um modal aberto por este controller.
   * @param {string} modalId
   * @returns {void}
   */
  function closeModal(modalId) {
    const entry = openModals.get(modalId);
    if (entry === undefined) {
      return;
    }
    openModals.delete(modalId);
    for (const undo of entry.teardown.splice(0)) {
      undo();
    }
    if (typeof entry.handle?.close === 'function') {
      entry.handle.close();
    }
  }

  // --- Um único conjunto de listeners delegados na raiz ---------------------
  //
  // A união dos `eventTypes` das seções registradas é calculada UMA vez, no
  // mount. Se uma seção declarasse um tipo novo depois, ele não seria ouvido —
  // e é isso que queremos: o conjunto de listeners é estável e auditável, não
  // algo que cresce a cada render.
  const eventTypes = new Set(['click']);
  for (const type of typeof sectionRegistry.eventTypes === 'function' ? sectionRegistry.eventTypes() : []) {
    eventTypes.add(type);
  }

  /**
   * Tratador ÚNICO de evento delegado — usado na raiz da ficha e na raiz de
   * qualquer modal aberto por este controller.
   * @param {object} root
   * @param {object} event
   * @param {object} matched
   * @returns {void}
   */
  function handleDelegatedEvent(root, event, matched) {
    if (disposed) {
      return;
    }
    const snapshot = session.getSnapshot();

    // 1) Colapso de seção: é do SHELL (o controller o desenha), então é ele
    // quem o trata. Nenhuma seção precisa saber que existe um cabeçalho.
    const toggle = typeof matched.closest === 'function' ? matched.closest('[data-sheet-toggle]') : null;
    if (event.type === 'click' && toggle && root.contains(toggle)) {
      const sectionId = toggle.getAttribute('data-sheet-toggle');
      if (sectionId) {
        event.preventDefault();
        const atual = snapshot.uiState?.collapsed?.[sectionId] === true;
        void handleIntent({ type: SHEET_INTENT_TYPES.uiState, patch: { collapsed: { [sectionId]: !atual } } });
        return;
      }
    }

    // 2) Retry de uma falha de sincronização: é do SHELL (o controller desenha
    // o aviso e o botão), então é ele quem trata.
    const retryButton = typeof matched.closest === 'function' ? matched.closest('[data-sheet-retry]') : null;
    if (event.type === 'click' && retryButton && root.contains(retryButton)) {
      const failureId = retryButton.getAttribute('data-sheet-retry');
      if (failureId) {
        event.preventDefault();
        void handleIntent({ type: SHEET_INTENT_TYPES.retry, failureId });
        return;
      }
    }

    // 3) A seção DONA do evento decide o resto — sempre por decisão
    // declarativa. Num modal não há contêiner de seção no caminho, então a
    // seção dona é a que pediu o modal (`data-sheet-modal-owner`).
    const container_ = typeof matched.closest === 'function' ? matched.closest(`[${SECTION_ATTRIBUTE}]`) : null;
    const ownerAttr = typeof matched.closest === 'function' ? matched.closest('[data-sheet-modal-owner]') : null;
    const sectionId = container_?.getAttribute(SECTION_ATTRIBUTE) ?? ownerAttr?.getAttribute('data-sheet-modal-owner') ?? null;
    if (sectionId === null) {
      return;
    }
    const section = sectionRegistry.get(sectionId);
    if (section === null) {
      return;
    }

    let decision;
    try {
      decision = section.toIntent(event, {
        root,
        projection: section.select(snapshot.viewModel),
        uiState: snapshot.uiState,
      });
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

  teardown.push(session.subscribe(render));

  const initialized = await session.initialize({ signal: mountController?.signal ?? signal });
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

  /**
   * Disposer idempotente do mount.
   * @returns {void}
   */
  function dispose() {
    if (disposed) {
      return;
    }
    disposed = true;
    if (mountController !== null) {
      mountController.abort();
    }
    for (const modalId of [...openModals.keys()]) {
      closeModal(modalId);
    }
    for (const undo of teardown.splice(0)) {
      undo();
    }
    session.dispose();
  }

  return ok(dispose);
}
