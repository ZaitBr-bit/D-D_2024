// Módulo `ui/toast`: notificações efêmeras. A mensagem SEMPRE entra por
// `setSafeText` — um toast nunca renderiza markup, mesmo que a mensagem
// carregue nome de item, de magia ou texto de erro vindo de conteúdo não
// confiável.

import { setSafeText } from './html.js';

const DEFAULT_DURATION_MS = 3000;

/**
 * Classes de toast aceitas. Enum FECHADO: um tipo desconhecido não vira
 * classe CSS arbitrária (o que permitiria injetar seletores/estilos a partir
 * de conteúdo), e sim o tipo neutro.
 *
 * A lista é exatamente a que os chamadores atuais usam — levantada por
 * varredura em `site/js/**` (`error`, `success`, `info`, `warning`, `danger`
 * e o padrão vazio). Nenhum toast existente pode mudar de aparência por causa
 * desta allowlist; um tipo novo precisa ser adicionado aqui de propósito.
 * @type {ReadonlySet<string>}
 */
const ALLOWED_KINDS = new Set(['', 'success', 'error', 'info', 'warning', 'danger']);

/**
 * Cria o serviço de toast sobre o contêiner do shell.
 * @param {{documentRef: object, container: object, durationMs?: number, scheduleTimeout?: Function, cancelTimeout?: Function}} elements
 * @returns {{show: (message: *, kind?: string) => object, getActiveCount: () => number}}
 */
export function createToastService(elements) {
  const { documentRef, container } = elements ?? {};
  if (!documentRef || !container) {
    throw new TypeError('createToastService: "documentRef" e "container" são obrigatórios.');
  }
  const durationMs = elements.durationMs ?? DEFAULT_DURATION_MS;
  // Injetáveis para que os testes controlem o tempo sem esperar 3 segundos
  // reais nem usar timers falsos globais.
  const scheduleTimeout = elements.scheduleTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const cancelTimeout = elements.cancelTimeout ?? ((handle) => clearTimeout(handle));

  const active = new Set();

  return {
    /**
     * Mostra uma mensagem por `durationMs` e devolve um handle com
     * `dismiss()` (para remover antes do tempo).
     * @param {*} message - texto; qualquer valor é convertido e escapado.
     * @param {string} [kind] - um dos tipos da allowlist.
     * @returns {{element: object, dismiss: () => void}}
     */
    show(message, kind = '') {
      const safeKind = ALLOWED_KINDS.has(kind) ? kind : '';
      const element = documentRef.createElement('div');
      element.className = `toast ${safeKind}`;
      setSafeText(element, message);
      container.appendChild(element);
      active.add(element);

      let handle = null;
      const dismiss = () => {
        if (!active.has(element)) {
          return;
        }
        active.delete(element);
        if (handle !== null) {
          cancelTimeout(handle);
          handle = null;
        }
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      };
      handle = scheduleTimeout(dismiss, durationMs);

      return { element, dismiss };
    },

    /**
     * @returns {number} quantidade de toasts ainda visíveis.
     */
    getActiveCount() {
      return active.size;
    },
  };
}
