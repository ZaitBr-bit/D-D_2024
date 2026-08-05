// Módulo `ui/modal`: serviço de modal com PILHA, montado sobre o markup que
// já existe em `site/index.html` (nenhuma mudança de estrutura, classes ou
// estilos — a Task 24 troca o mecanismo, não a aparência).
//
// Diferenças de PRINCÍPIO em relação ao `abrirModal`/`fecharModal` legados de
// `site/js/utils.js`, que passam a delegar para cá:
//
//  - `open()` recebe NÓS/FRAGMENTOS (`title`, `content`, `actions`), nunca
//    strings de HTML. Quem tem conteúdo não confiável usa `ui/markdown.js` ou
//    `setSafeText` e entrega nós já seguros. (A fachada legada ainda aceita
//    strings porque seus chamadores ainda montam markup por string; ela
//    converte no ponto de entrada e some nas Tasks 29-32.)
//  - O título do sub-modal é escrito com `textContent`. O baseline o
//    interpolava em `innerHTML` — um sink de XSS real para qualquer título
//    derivado de conteúdo (nome de magia, de item, de espécie...).
//  - Cada `open()` devolve um handle com `close(reason)`; `onClose` dispara
//    UMA única vez, com o motivo, e NUNCA muta o que quer que o chamador
//    tenha passado. Cancelar um modal não altera nenhuma transação: o serviço
//    não conhece transações — só avisa quem abriu.

import { setSafeText } from './html.js';

const SUB_MODAL_BASE_Z_INDEX = 200;

/**
 * Motivos padronizados de fechamento entregues a `onClose(reason)`.
 * @type {Readonly<{backdrop: string, escape: string, closeButton: string, programmatic: string, closeAll: string, parentClosed: string}>}
 */
export const MODAL_CLOSE_REASONS = Object.freeze({
  backdrop: 'backdrop',
  escape: 'escape',
  closeButton: 'close-button',
  programmatic: 'programmatic',
  closeAll: 'close-all',
  parentClosed: 'parent-closed',
});

/**
 * Substitui todo o conteúdo de `element` pelos nós de `value`.
 * Aceita `null` (esvazia), um nó/fragmento, ou um array de nós. Strings NÃO
 * são aceitas de propósito: seria o caminho fácil de volta para `innerHTML`.
 * @param {object} element
 * @param {*} value
 * @param {string} label - nome do campo, para mensagem de erro.
 * @returns {void}
 */
function replaceChildrenWithNodes(element, value, label) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
  if (value === null || value === undefined) {
    return;
  }
  const nodes = Array.isArray(value) ? value : [value];
  for (const node of nodes) {
    if (typeof node === 'string') {
      throw new TypeError(`ModalService: "${label}" recebe nós/fragmentos, nunca string de HTML.`);
    }
    if (!node || typeof node !== 'object' || typeof node.nodeType !== 'number') {
      throw new TypeError(`ModalService: "${label}" contém um valor que não é nó DOM.`);
    }
    element.appendChild(node);
  }
}

/**
 * Cria o serviço de modal a partir dos elementos do shell.
 *
 * @param {{documentRef: object, overlay: object, container: object, titleElement: object, bodyElement: object, actionsElement: object, closeButton?: object}} elements
 * @returns {object} ModalService
 */
export function createModalService(elements) {
  const { documentRef, overlay, container, titleElement, bodyElement, actionsElement, closeButton } = elements ?? {};
  for (const [name, value] of Object.entries({ documentRef, overlay, container, titleElement, bodyElement, actionsElement })) {
    if (!value) {
      throw new TypeError(`createModalService: elemento obrigatório ausente: "${name}".`);
    }
  }

  /**
   * @type {Array<{id: number, level: number, overlay: object, container: object, onClose: (Function|null), closed: boolean, options: object, previouslyFocused: (object|null), teardown: Array<Function>}>}
   */
  const stack = [];
  let nextId = 1;

  /**
   * Entrada do topo da pilha, ou `null`.
   * @returns {object|null}
   */
  function top() {
    return stack.length > 0 ? stack[stack.length - 1] : null;
  }

  /**
   * Devolve o foco ao elemento que o tinha antes de o modal abrir. LinkeDOM
   * não implementa foco (ver tests/helpers/test-dom.js), então o efeito real
   * é verificado por Playwright; aqui a intenção é explícita e testável.
   * @param {object|null} element
   * @returns {void}
   */
  function restoreFocus(element) {
    if (element && typeof element.focus === 'function') {
      element.focus();
    }
  }

  /**
   * Monta a árvore do sub-modal com as MESMAS classes e estilos inline do
   * baseline (`site/js/utils.js` antes da Task 24), construída com
   * `createElement` em vez de `innerHTML`.
   * @param {number} level - profundidade na pilha (1 = primeiro sub-modal).
   * @param {*} title
   * @param {*} content
   * @param {*} actions
   * @returns {{overlay: object, container: object, closeButton: object}}
   */
  function buildSubModal(level, title, content, actions) {
    const subOverlay = documentRef.createElement('div');
    subOverlay.className = 'modal-overlay sub-modal-overlay';
    subOverlay.id = `sub-modal-overlay-${level}`;
    subOverlay.style.display = 'flex';
    subOverlay.style.zIndex = String(SUB_MODAL_BASE_Z_INDEX + level);

    const subContainer = documentRef.createElement('div');
    subContainer.className = 'modal-container';
    subContainer.setAttribute('style', 'animation:slideUp 0.2s');

    const header = documentRef.createElement('div');
    header.className = 'modal-header';
    header.setAttribute('style', 'position:sticky;top:0;background:var(--bg-card);z-index:1');

    const heading = documentRef.createElement('h2');
    heading.setAttribute('style', 'font-size:1rem;font-weight:700');
    if (title && typeof title === 'object' && typeof title.nodeType === 'number') {
      heading.appendChild(title);
    } else {
      setSafeText(heading, title);
    }

    const subCloseButton = documentRef.createElement('button');
    subCloseButton.className = 'modal-fechar';
    subCloseButton.setAttribute('data-fechar-sub', 'true');
    setSafeText(subCloseButton, '×');

    header.appendChild(heading);
    header.appendChild(subCloseButton);

    const body = documentRef.createElement('div');
    body.className = 'modal-corpo';
    body.setAttribute('style', 'padding:16px');
    replaceChildrenWithNodes(body, content, 'content');

    const actionsElementSub = documentRef.createElement('div');
    actionsElementSub.className = 'modal-acoes';
    actionsElementSub.setAttribute(
      'style',
      'padding:12px 16px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--border-light)',
    );
    replaceChildrenWithNodes(actionsElementSub, actions, 'actions');

    subContainer.appendChild(header);
    subContainer.appendChild(body);
    subContainer.appendChild(actionsElementSub);
    subOverlay.appendChild(subContainer);

    return { overlay: subOverlay, container: subContainer, closeButton: subCloseButton };
  }

  /**
   * Fecha uma entrada específica (e tudo que estiver acima dela na pilha).
   * `onClose` de cada entrada fechada dispara exatamente uma vez.
   * @param {object} entry
   * @param {string} reason
   * @returns {void}
   */
  function closeEntry(entry, reason) {
    if (entry.closed) {
      return;
    }
    const index = stack.indexOf(entry);
    if (index === -1) {
      return;
    }
    // Fecha primeiro quem está acima, de cima para baixo.
    for (let position = stack.length - 1; position > index; position -= 1) {
      closeEntry(stack[position], MODAL_CLOSE_REASONS.parentClosed);
    }

    entry.closed = true;
    stack.splice(stack.indexOf(entry), 1);

    for (const undo of entry.teardown) {
      undo();
    }
    entry.teardown.length = 0;

    if (entry.level === 0) {
      overlay.style.display = 'none';
    } else if (entry.overlay.parentNode) {
      entry.overlay.parentNode.removeChild(entry.overlay);
    }

    if (entry.options.manageFocus) {
      restoreFocus(entry.previouslyFocused);
    }

    const callback = entry.onClose;
    entry.onClose = null;
    if (typeof callback === 'function') {
      callback(reason);
    }
  }

  /**
   * Fecha o modal do topo da pilha. No-op quando não há modal aberto.
   * @param {string} [reason]
   * @returns {void}
   */
  function closeTop(reason = MODAL_CLOSE_REASONS.programmatic) {
    const entry = top();
    if (entry) {
      closeEntry(entry, reason);
    }
  }

  /**
   * Fecha todos os modais abertos, do topo para a base.
   * @param {string} [reason]
   * @returns {void}
   */
  function closeAll(reason = MODAL_CLOSE_REASONS.closeAll) {
    while (stack.length > 0) {
      closeEntry(stack[stack.length - 1], reason);
    }
  }

  // --- Listeners permanentes do shell -------------------------------------
  //
  // Registrados uma única vez, no lugar dos `onclick` inline removidos de
  // `site/index.html`. Quando não há modal aberto, `closeTop` é no-op.
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      closeTop(MODAL_CLOSE_REASONS.closeButton);
    });
  }
  overlay.addEventListener('click', (event) => {
    const entry = top();
    if (event.target === overlay && entry && entry.options.closeOnBackdrop) {
      closeTop(MODAL_CLOSE_REASONS.backdrop);
    }
  });
  documentRef.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }
    const entry = top();
    if (entry && entry.options.closeOnEscape) {
      closeTop(MODAL_CLOSE_REASONS.escape);
    }
  });

  return {
    /**
     * Abre um modal. Se já houver um aberto, o novo entra como sub-modal
     * empilhado (mesmo comportamento do baseline).
     *
     * @param {{title?: *, content?: *, actions?: *, onClose?: (Function|null), closeOnEscape?: boolean, closeOnBackdrop?: boolean, manageFocus?: boolean}} params
     * @returns {{id: number, level: number, element: object, close: (reason?: string) => void, isOpen: () => boolean}}
     */
    open(params = {}) {
      const {
        title = '',
        content = null,
        actions = null,
        onClose = null,
        closeOnEscape = true,
        closeOnBackdrop = true,
        manageFocus = true,
      } = params;

      if (onClose !== null && onClose !== undefined && typeof onClose !== 'function') {
        throw new TypeError('ModalService.open: "onClose" precisa ser função ou null.');
      }

      const level = stack.length;
      const options = Object.freeze({ closeOnEscape, closeOnBackdrop, manageFocus });
      const previouslyFocused = manageFocus ? documentRef.activeElement ?? null : null;

      /** @type {Array<Function>} */
      const teardown = [];
      let entryOverlay;
      let entryContainer;
      let entryCloseButton = null;

      if (level === 0) {
        if (title && typeof title === 'object' && typeof title.nodeType === 'number') {
          replaceChildrenWithNodes(titleElement, title, 'title');
        } else {
          setSafeText(titleElement, title);
        }
        replaceChildrenWithNodes(bodyElement, content, 'content');
        replaceChildrenWithNodes(actionsElement, actions, 'actions');
        overlay.style.display = 'flex';
        container.scrollTop = 0;
        entryOverlay = overlay;
        entryContainer = container;
        entryCloseButton = closeButton ?? null;
      } else {
        const built = buildSubModal(level, title, content, actions);
        entryOverlay = built.overlay;
        entryContainer = built.container;
        entryCloseButton = built.closeButton;
        documentRef.body.appendChild(entryOverlay);
      }

      const entry = {
        id: nextId,
        level,
        overlay: entryOverlay,
        container: entryContainer,
        onClose: typeof onClose === 'function' ? onClose : null,
        closed: false,
        options,
        previouslyFocused,
        teardown,
      };
      nextId += 1;
      stack.push(entry);

      if (level > 0) {
        // UM único listener no overlay do sub-modal, com a MESMA regra do
        // baseline (`site/js/utils.js` em e43c5ea):
        //
        //   if (e.target === sub || e.target.closest('[data-fechar-sub]'))
        //
        // Ou seja: fecha ao clicar no backdrop OU em QUALQUER elemento
        // marcado com `data-fechar-sub` em qualquer ponto da árvore do
        // sub-modal — não só no `×` do cabeçalho. Chamadores reais colocam
        // esse atributo em botões de AÇÃO no rodapé (ex.: "Fechar" do
        // sub-modal de Taxas de Conversão, em site/js/pages/sheet.js);
        // tratar apenas o `×` deixava esses botões mortos.
        const onOverlayClick = (event) => {
          const alvo = event.target;
          if (alvo === entryOverlay) {
            if (entry.options.closeOnBackdrop) {
              closeEntry(entry, MODAL_CLOSE_REASONS.backdrop);
            }
            return;
          }
          const gatilho = alvo && typeof alvo.closest === 'function'
            ? alvo.closest('[data-fechar-sub]')
            : (alvo?.parentElement?.closest('[data-fechar-sub]') ?? null);
          // `entryOverlay.contains` garante que o gatilho pertence a ESTE
          // sub-modal (um `closest` pode subir para fora do overlay).
          if (gatilho && entryOverlay.contains(gatilho)) {
            closeEntry(entry, MODAL_CLOSE_REASONS.closeButton);
          }
        };
        entryOverlay.addEventListener('click', onOverlayClick);
        teardown.push(() => entryOverlay.removeEventListener('click', onOverlayClick));
      }

      if (manageFocus) {
        const focusTarget = entryCloseButton ?? entryContainer;
        if (focusTarget && typeof focusTarget.focus === 'function') {
          focusTarget.focus();
        }
      }

      return {
        id: entry.id,
        level: entry.level,
        element: entryOverlay,
        /**
         * Fecha este modal (e os que estiverem acima dele).
         * @param {string} [reason]
         * @returns {void}
         */
        close(reason = MODAL_CLOSE_REASONS.programmatic) {
          closeEntry(entry, reason);
        },
        /**
         * @returns {boolean} `true` enquanto este modal estiver aberto.
         */
        isOpen() {
          return !entry.closed;
        },
      };
    },

    closeTop,
    closeAll,

    /**
     * Quantidade de modais abertos (0 quando nenhum está aberto).
     * @returns {number}
     */
    getStackSize() {
      return stack.length;
    },

    /**
     * @returns {boolean} `true` se há pelo menos um modal aberto.
     */
    isOpen() {
      return stack.length > 0;
    },
  };
}
