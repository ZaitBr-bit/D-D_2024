// ============================================================
// DOM isolado para testes Node, sobre LinkeDOM.
//
// Cada teste cria o seu próprio `window`/`document` e o descarta no fim
// (`restore()`), sem estado compartilhado entre casos. Os globais `window`,
// `document`, `Event`, `CustomEvent` e `Node` são instalados no `globalThis`
// enquanto o DOM está ativo, porque o código de UI de produção usa `document`
// como global em alguns pontos legados — e restaurados exatamente ao valor
// anterior no `restore()`.
//
// ## O que este helper NÃO faz
//
// LinkeDOM é uma implementação de DOM, não um navegador. Ele NÃO tem foco
// real (`document.activeElement` não existe), nem layout, nem drag-and-drop,
// nem download, nem parser de CSS. Nada disso é simulado aqui: fingir que
// `element.focus()` "deu foco" produziria testes verdes sobre comportamento
// inexistente. O que este helper oferece é `trackFocusCalls`, que registra em
// QUAIS elementos `focus()` foi chamado — suficiente para provar a intenção
// do código sob teste. A verificação de foco REAL (e de drag-and-drop,
// download e comportamento de navegador em geral) fica em Playwright:
// `tests/e2e/security-content.spec.js`.
// ============================================================
import { parseHTML } from 'linkedom';

const DEFAULT_HTML = '<!doctype html><html><head></head><body></body></html>';

const INSTALLED_GLOBALS = ['window', 'document', 'Event', 'CustomEvent', 'Node', 'HTMLElement'];

/**
 * Cria um DOM isolado e instala os globais de navegador correspondentes.
 * @param {{html?: string, installGlobals?: boolean}} [options]
 * @returns {{window: object, document: object, restore: () => void}}
 */
export function createTestDom(options = {}) {
  const html = options.html ?? DEFAULT_HTML;
  const installGlobals = options.installGlobals !== false;
  const win = parseHTML(html);

  /** @type {Array<{name: string, existed: boolean, value: *}>} */
  const saved = [];
  if (installGlobals) {
    const values = {
      window: win,
      document: win.document,
      Event: win.Event,
      CustomEvent: win.CustomEvent,
      Node: win.Node,
      HTMLElement: win.HTMLElement,
    };
    for (const name of INSTALLED_GLOBALS) {
      saved.push({ name, existed: name in globalThis, value: globalThis[name] });
      if (values[name] !== undefined) {
        globalThis[name] = values[name];
      }
    }
  }

  return {
    window: win,
    document: win.document,
    /**
     * Restaura os globais ao estado anterior. Idempotente.
     * @returns {void}
     */
    restore() {
      while (saved.length > 0) {
        const entry = saved.pop();
        if (entry.existed) {
          globalThis[entry.name] = entry.value;
        } else {
          delete globalThis[entry.name];
        }
      }
    },
  };
}

/**
 * Cria um evento com propriedades extras (ex.: `key` de teclado). LinkeDOM
 * não expõe `KeyboardEvent`/`MouseEvent`, então o evento é um `Event` comum
 * com os campos que o código sob teste lê atribuídos explicitamente — nunca
 * um objeto literal fingindo ser evento, para que `preventDefault()`,
 * `stopPropagation()` e o borbulhamento reais continuem sendo exercitados.
 * @param {object} win - window do DOM de teste.
 * @param {string} type - tipo do evento (`click`, `keydown`, ...).
 * @param {object} [init] - `{bubbles, cancelable, ...extras}`.
 * @returns {object}
 */
export function createTestEvent(win, type, init = {}) {
  const { bubbles = true, cancelable = true, ...extras } = init;
  const event = new win.Event(type, { bubbles, cancelable });
  for (const [key, value] of Object.entries(extras)) {
    try {
      event[key] = value;
    } catch {
      Object.defineProperty(event, key, { value, configurable: true, enumerable: true });
    }
  }
  return event;
}

/**
 * Instrumenta `focus()`/`blur()` de todos os elementos de um documento para
 * registrar em qual elemento foram chamados. LinkeDOM não tem foco real (ver
 * cabeçalho); isto prova apenas a INTENÇÃO do código, e é assim que os testes
 * devem lê-lo.
 * @param {object} win - window do DOM de teste.
 * @returns {{calls: Array<{type: string, element: object}>, restore: () => void}}
 */
export function trackFocusCalls(win) {
  const calls = [];
  const proto = win.HTMLElement ? win.HTMLElement.prototype : null;
  if (!proto) {
    throw new Error('test-dom: HTMLElement.prototype indisponível neste DOM.');
  }
  const originalFocus = proto.focus;
  const originalBlur = proto.blur;
  proto.focus = function focus(...args) {
    calls.push({ type: 'focus', element: this });
    if (typeof originalFocus === 'function') {
      return originalFocus.apply(this, args);
    }
    return undefined;
  };
  proto.blur = function blur(...args) {
    calls.push({ type: 'blur', element: this });
    if (typeof originalBlur === 'function') {
      return originalBlur.apply(this, args);
    }
    return undefined;
  };
  return {
    calls,
    /**
     * Devolve `focus`/`blur` originais ao protótipo.
     * @returns {void}
     */
    restore() {
      proto.focus = originalFocus;
      proto.blur = originalBlur;
    },
  };
}

/**
 * Normaliza uma árvore DOM em uma estrutura comparável entre dois
 * renderizadores diferentes.
 *
 * Política (deliberadamente ESTRITA — a ideia é que diferenças reais
 * apareçam, não que sumam):
 *  - Elementos viram `{tag, attributes, children}` com atributos ordenados.
 *  - Nós de texto ADJACENTES são concatenados antes de qualquer comparação.
 *    Isso é equivalente a `Node.normalize()` e é necessário porque o parser
 *    de HTML quebra o texto em vários nós ao redor de entidades (`D&amp;D`
 *    vira dois nós), enquanto uma árvore montada por `createTextNode` não —
 *    uma diferença de representação sem nenhum efeito observável.
 *  - Nós de texto que contêm APENAS quebras de linha (`\n`) são descartados:
 *    são os separadores estruturais produzidos pelo `join('\n')` do baseline,
 *    sem efeito visual.
 *  - Espaços em branco DENTRO do texto não são colapsados: perder um espaço
 *    entre dois trechos formatados é uma diferença real e deve falhar.
 * @param {object} node - elemento, fragmento ou nó de texto.
 * @returns {object|string|null}
 */
export function normalizeDomNode(node) {
  const TEXT_NODE = 3;
  const ELEMENT_NODE = 1;
  if (node.nodeType === TEXT_NODE) {
    return node.data ?? node.textContent ?? '';
  }
  /** @type {Array<object|string>} */
  const merged = [];
  for (const child of node.childNodes) {
    const normalized = normalizeDomNode(child);
    if (normalized === null) {
      continue;
    }
    if (typeof normalized === 'string' && typeof merged[merged.length - 1] === 'string') {
      merged[merged.length - 1] += normalized;
      continue;
    }
    merged.push(normalized);
  }
  const children = merged.filter((child) => typeof child !== 'string' || !/^\n+$/.test(child));
  if (node.nodeType !== ELEMENT_NODE) {
    return { tag: '#fragment', attributes: [], children };
  }
  const attributes = [];
  for (const attribute of node.attributes ?? []) {
    attributes.push([attribute.name, attribute.value]);
  }
  attributes.sort((a, b) => a[0].localeCompare(b[0]));
  return { tag: node.tagName.toLowerCase(), attributes, children };
}

/**
 * Interpreta uma string de HTML no DOM de teste e normaliza o resultado.
 * @param {object} documentRef
 * @param {string} html
 * @returns {object}
 */
export function normalizeHtmlString(documentRef, html) {
  const container = documentRef.createElement('div');
  container.innerHTML = html;
  return normalizeDomNode(container);
}

/**
 * Normaliza um fragmento já montado, embrulhando-o em um contêiner
 * equivalente ao usado por `normalizeHtmlString` (para que as duas saídas
 * sejam comparáveis diretamente).
 * @param {object} documentRef
 * @param {object} fragment
 * @returns {object}
 */
export function normalizeFragment(documentRef, fragment) {
  const container = documentRef.createElement('div');
  container.appendChild(fragment);
  return normalizeDomNode(container);
}
