// Módulo `features/creator/steps/creator-step`: o CONTRATO de um passo do
// criador, validado na construção.
//
// Um passo é um objeto puro com cinco capacidades e nenhum efeito colateral
// de navegador:
//
//   load(context)     -> Promise<Result<StepData, AppError>>
//   render(context)   -> string
//   bind(context)     -> {eventTypes, toIntent(event)}   (DESCRITOR, congelado)
//   validate(context) -> ValidationResult
//   invalidate(ctx)   -> Result<InvalidationPatch, AppError>
//
// ## `bind` é DECLARATIVO
//
// `bind` NUNCA chama `addEventListener`. Ele devolve um descritor congelado
// que diz quais tipos de evento interessam e como traduzir um evento em
// `UiEventDecision<CreatorIntent>`. Quem registra listeners é o controller, uma
// única vez, na raiz — e é ele quem aplica `preventDefault`/`stopPropagation`
// e quem abre modais. Um passo que registrasse o próprio listener recriaria o
// vazamento que a Task 24 acabou de fechar: listeners órfãos a cada
// re-render, e um caminho de efeito colateral fora do controller.
//
// Para que isso não seja apenas convenção, `createCreatorStep` chama `bind`
// com uma sonda em `context.root` e FALHA se o passo tiver tentado registrar
// listener direto (ver `assertDeclarativeBinding`).
//
// ## `render` devolve string, mas nunca interpolação crua
//
// A montagem final pode ser string (o controller a insere por um caminho já
// validado), mas todo valor derivado de CONTEÚDO (nome/descrição de catálogo)
// precisa passar por `escapeHtml`/`escapeHtmlAttribute` de `ui/html.js` antes
// de entrar nela. Conteúdo JSON é não confiável por Global Constraint.

import { ok, err } from '../../../core/result.js';
import { createAppError } from '../../../core/errors.js';
import { createUiEventDecision, isUiEventDecision, NO_UI_EVENT_DECISION } from '../../../ui/event-delegation.js';
import { isCreatorStepId, createCreatorDraft } from '../creator-state.js';

const SCOPE = 'features.creator.step';

const REQUIRED_METHODS = Object.freeze(['load', 'render', 'bind', 'validate', 'invalidate']);

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {*} [cause]
 * @returns {object}
 */
export function stepError(code, message, context = {}, cause = undefined) {
  return createAppError({ code, scope: SCOPE, message, context, cause });
}

/**
 * Cria um descritor de binding congelado.
 * @param {{eventTypes?: ReadonlyArray<string>, toIntent?: Function}} params
 * @returns {Readonly<{eventTypes: ReadonlyArray<string>, toIntent: Function}>}
 */
export function createStepBinding({ eventTypes = [], toIntent } = {}) {
  if (!Array.isArray(eventTypes) || eventTypes.some((type) => typeof type !== 'string' || type.length === 0)) {
    throw new TypeError('createStepBinding: "eventTypes" deve ser um array de strings não vazias.');
  }
  if (typeof toIntent !== 'function') {
    throw new TypeError('createStepBinding: "toIntent" deve ser uma função.');
  }
  const supported = new Set(eventTypes);
  /**
   * Traduz um evento em `UiEventDecision`. Um tipo de evento não declarado é
   * IGNORADO com a decisão neutra, nunca repassado ao `toIntent` do passo —
   * assim o controller pode agregar tipos de vários passos sem que um passo
   * receba eventos que não pediu.
   * @param {object} event
   * @returns {Readonly<object>}
   */
  const guardedToIntent = (event) => {
    if (!event || typeof event.type !== 'string' || !supported.has(event.type)) {
      return NO_UI_EVENT_DECISION;
    }
    const decision = toIntent(event);
    if (decision === null || decision === undefined) {
      return NO_UI_EVENT_DECISION;
    }
    if (!isUiEventDecision(decision)) {
      throw new TypeError('createStepBinding: "toIntent" precisa devolver uma UiEventDecision.');
    }
    return createUiEventDecision(decision);
  };

  return Object.freeze({ eventTypes: Object.freeze([...eventTypes]), toIntent: guardedToIntent });
}

/**
 * Verifica que `bind` é realmente declarativo: chama-o com uma raiz-sonda que
 * grava qualquer `addEventListener` e falha se algum tiver sido registrado.
 * @param {object} step
 * @param {object} context - contexto real que será passado ao `bind`.
 * @returns {object|null} AppError, ou `null` quando o binding é declarativo.
 */
export function assertDeclarativeBinding(step, context) {
  const registered = [];
  /** Sonda de raiz: registra tentativas em vez de executá-las. */
  const probeRoot = {
    /**
     * @param {string} type
     * @returns {void}
     */
    addEventListener(type) {
      registered.push(type);
    },
    /** @returns {void} */
    removeEventListener() {},
    /** @returns {boolean} */
    contains() {
      return false;
    },
    /** @returns {null} */
    querySelector() {
      return null;
    },
    /** @returns {ReadonlyArray<object>} */
    querySelectorAll() {
      return [];
    },
  };

  let binding;
  try {
    binding = step.bind({ ...context, root: probeRoot });
  } catch (cause) {
    return stepError('CREATOR_STEP_BIND_THREW', `O "bind" do passo "${step.id}" lançou uma exceção.`, { stepId: step.id }, cause);
  }
  if (registered.length > 0) {
    return stepError(
      'CREATOR_STEP_BIND_NOT_DECLARATIVE',
      `O passo "${step.id}" registrou listeners diretamente em "bind" (${registered.join(', ')}); o binding precisa ser declarativo.`,
      { stepId: step.id, eventTypes: registered },
    );
  }
  if (
    binding === null ||
    typeof binding !== 'object' ||
    !Array.isArray(binding.eventTypes) ||
    typeof binding.toIntent !== 'function'
  ) {
    return stepError(
      'CREATOR_STEP_BINDING_INVALID',
      `O "bind" do passo "${step.id}" precisa devolver {eventTypes, toIntent}.`,
      { stepId: step.id },
    );
  }
  if (!Object.isFrozen(binding)) {
    return stepError('CREATOR_STEP_BINDING_MUTABLE', `O descritor de binding do passo "${step.id}" precisa ser congelado.`, {
      stepId: step.id,
    });
  }
  return null;
}

/**
 * Valida e congela a definição de um passo.
 *
 * `reduce(context, intent)` é um ponto de extensão OPCIONAL: quando presente,
 * é ele que traduz uma intenção de domínio em um novo rascunho
 * (`Result<{draft, invalidation?}>`). Os passos-placeholder desta task não o
 * têm — e é justamente isso que prova que o dispatcher lida com o shape pinado
 * sem que nenhum passo real exista ainda.
 *
 * @param {object} definition
 * @returns {import('../../../core/result.js').Result} `ok(step)`
 */
export function createCreatorStep(definition) {
  if (definition === null || typeof definition !== 'object') {
    return err(stepError('CREATOR_STEP_DEFINITION_INVALID', 'A definição de um passo deve ser um objeto.'));
  }
  if (!isCreatorStepId(definition.id)) {
    return err(
      stepError('CREATOR_STEP_ID_UNKNOWN', `"${String(definition.id)}" não é um dos sete IDs de passo do criador.`, {
        stepId: typeof definition.id === 'string' ? definition.id : null,
      }),
    );
  }
  for (const method of REQUIRED_METHODS) {
    if (typeof definition[method] !== 'function') {
      return err(
        stepError('CREATOR_STEP_METHOD_MISSING', `O passo "${definition.id}" não implementa "${method}".`, {
          stepId: definition.id,
          method,
        }),
      );
    }
  }
  if (definition.reduce !== undefined && typeof definition.reduce !== 'function') {
    return err(
      stepError('CREATOR_STEP_REDUCE_INVALID', `O "reduce" do passo "${definition.id}", quando presente, deve ser função.`, {
        stepId: definition.id,
      }),
    );
  }

  // A garantia de binding declarativo é ESTRUTURAL, não convenção de teste:
  // é aplicada aqui, no único ponto de construção de um passo, antes que ele
  // possa entrar num registro. Sem isto, um passo que chamasse
  // `context.root.addEventListener` dentro de `bind` seria aceito e o
  // controller — que chama `bind` a cada evento — acumularia um listener novo
  // a cada clique, indefinidamente.
  //
  // A sonda recebe um rascunho VAZIO porque é exatamente o estado em que
  // `bind` é chamado no primeiro render: um `bind` que só funciona com o
  // rascunho preenchido já é um defeito, e é melhor descobri-lo aqui.
  const probeDraft = createCreatorDraft({});
  const bindingProblem = assertDeclarativeBinding(definition, {
    stepId: definition.id,
    draft: probeDraft.ok ? probeDraft.value : null,
    data: null,
    registry: null,
    rules: null,
  });
  if (bindingProblem !== null) {
    return err(bindingProblem);
  }

  const step = Object.freeze({
    id: definition.id,
    load: definition.load.bind(definition),
    render: definition.render.bind(definition),
    bind: definition.bind.bind(definition),
    validate: definition.validate.bind(definition),
    invalidate: definition.invalidate.bind(definition),
    reduce: typeof definition.reduce === 'function' ? definition.reduce.bind(definition) : null,
  });
  return ok(step);
}
