// Módulo `ui/event-delegation`: delegação de eventos e o contrato
// `UiEventDecision`, que substituem os `onclick` inline do shell (e, a partir
// das Tasks 25-32, os dos passos do criador e das seções da ficha).
//
// ## Por que delegação em vez de `onclick=".."`
//
// Um `onclick` inline é código executado a partir de um ATRIBUTO — ou seja,
// markup. Enquanto existir um só deles, `script-src` precisa de
// `'unsafe-inline'`, e qualquer falha de escape em qualquer sink vira
// execução de script. Além disso, o handler inline só alcança funções
// globais, o que força `window.fecharModal`/`window.navegar` a existirem.
//
// ## `UiEventDecision`: inversão de controle deliberada
//
// Renderizadores, passos e seções NÃO chamam `preventDefault()`,
// `stopPropagation()`, nem abrem modais. Eles apenas DESCREVEM o que o clique
// significa:
//
//     { intent: {type: 'abrir-magia', id}, preventDefault: true, stopPropagation: false }
//
// Quem aplica a decisão ao evento e decide o que fazer com a intenção é o
// controller (`applyUiEventDecision` + o despacho do controller). Isso
// mantém a lógica de apresentação pura e testável sem DOM real, e concentra
// os efeitos de navegador em um ponto só.

/**
 * Cria uma `UiEventDecision` normalizada e congelada.
 * @template TIntent
 * @param {{intent?: (TIntent|null), preventDefault?: boolean, stopPropagation?: boolean}} [params]
 * @returns {Readonly<{intent: (TIntent|null), preventDefault: boolean, stopPropagation: boolean}>}
 */
export function createUiEventDecision(params = {}) {
  const { intent = null, preventDefault = false, stopPropagation = false } = params;
  if (typeof preventDefault !== 'boolean' || typeof stopPropagation !== 'boolean') {
    throw new TypeError('createUiEventDecision: "preventDefault" e "stopPropagation" precisam ser booleanos.');
  }
  return Object.freeze({ intent: intent ?? null, preventDefault, stopPropagation });
}

/**
 * Decisão neutra: nenhuma intenção, nenhum efeito sobre o evento.
 * @type {Readonly<{intent: null, preventDefault: false, stopPropagation: false}>}
 */
export const NO_UI_EVENT_DECISION = createUiEventDecision();

/**
 * Verifica se `value` tem o formato de uma `UiEventDecision`.
 * @param {*} value
 * @returns {boolean}
 */
export function isUiEventDecision(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    'intent' in value &&
    typeof value.preventDefault === 'boolean' &&
    typeof value.stopPropagation === 'boolean'
  );
}

/**
 * Aplica ao evento os efeitos descritos por `decision`. É o ÚNICO ponto do
 * código de UI autorizado a chamar `preventDefault()`/`stopPropagation()` a
 * partir de uma decisão de renderizador.
 *
 * Uma `decision` malformada é defeito de programação (não uma falha de
 * domínio) e lança `TypeError` — silenciar aqui esconderia exatamente o tipo
 * de bug que este contrato existe para evitar.
 * @param {object} event - evento DOM real.
 * @param {object} decision - `UiEventDecision`.
 * @returns {void}
 */
export function applyUiEventDecision(event, decision) {
  if (!event || typeof event.preventDefault !== 'function' || typeof event.stopPropagation !== 'function') {
    throw new TypeError('applyUiEventDecision: "event" precisa ser um evento DOM.');
  }
  if (!isUiEventDecision(decision)) {
    throw new TypeError('applyUiEventDecision: "decision" precisa ser uma UiEventDecision {intent, preventDefault, stopPropagation}.');
  }
  if (decision.preventDefault) {
    event.preventDefault();
  }
  if (decision.stopPropagation) {
    event.stopPropagation();
  }
}

/**
 * Registra um listener delegado em `root`: `handler` só é chamado quando o
 * alvo do evento está dentro de um descendente de `root` que casa com
 * `selector`.
 *
 * O elemento que casou é passado como segundo argumento — nenhum handler
 * precisa re-consultar o DOM. A busca NUNCA sai de `root` (um ancestral fora
 * da raiz que case com o seletor é ignorado), e um alvo que não é elemento
 * (nó de texto) é resolvido pelo elemento-pai.
 *
 * @param {object} root - elemento raiz onde o listener real fica registrado.
 * @param {string} eventName - nome do evento (`click`, `change`, ...).
 * @param {string} selector - seletor CSS dos elementos de interesse.
 * @param {(event: object, matchedElement: object) => void} handler
 * @returns {() => void} função que remove o listener (idempotente).
 */
export function delegate(root, eventName, selector, handler) {
  if (!root || typeof root.addEventListener !== 'function') {
    throw new TypeError('delegate: "root" precisa ser um nó DOM com addEventListener.');
  }
  if (typeof eventName !== 'string' || eventName === '') {
    throw new TypeError('delegate: "eventName" precisa ser uma string não vazia.');
  }
  if (typeof selector !== 'string' || selector === '') {
    throw new TypeError('delegate: "selector" precisa ser uma string não vazia.');
  }
  if (typeof handler !== 'function') {
    throw new TypeError('delegate: "handler" precisa ser uma função.');
  }

  const listener = (event) => {
    const target = event.target;
    if (!target) {
      return;
    }
    const startElement = typeof target.closest === 'function' ? target : target.parentElement ?? null;
    if (!startElement || typeof startElement.closest !== 'function') {
      return;
    }
    const matched = startElement.closest(selector);
    if (!matched) {
      return;
    }
    // `closest` sobe até o topo do documento; a delegação precisa parar na
    // raiz. `root.contains(matched)` garante que um ancestral FORA de `root`
    // que case com o seletor não dispare o handler.
    if (matched !== root && typeof root.contains === 'function' && !root.contains(matched)) {
      return;
    }
    handler(event, matched);
  };

  root.addEventListener(eventName, listener);

  let removed = false;
  return () => {
    if (removed) {
      return;
    }
    removed = true;
    root.removeEventListener(eventName, listener);
  };
}
