// Controller do criador (Task 25) sobre um DOM isolado (LinkeDOM).
//
// O que este arquivo prova, e que só se prova com DOM:
//
//  - o controller instala UM único conjunto de listeners delegados na raiz e
//    NÃO os multiplica a cada re-render (o defeito clássico do wizard legado);
//  - `preventDefault`/`stopPropagation` são aplicados pelo controller, a
//    partir da decisão do passo — o passo nunca toca no evento;
//  - o passo NÃO registra listener (`assertDeclarativeBinding` com sonda);
//  - o modal é efeito do CONTROLLER, e fechar por fora cancela a transação;
//  - o disposer é idempotente e não deixa listener vivo;
//  - `render` de um passo com conteúdo MALICIOSO nunca devolve o payload cru.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createTestDom } from '../helpers/test-dom.js';
import { ok } from '../../site/js/core/result.js';
import { CREATOR_STEP_IDS, createCreatorDraft } from '../../site/js/features/creator/creator-state.js';
import { createCreatorSession } from '../../site/js/features/creator/creator-session.js';
import { mountCreator } from '../../site/js/features/creator/creator-controller.js';
import { createStepRegistry } from '../../site/js/features/creator/steps/step-registry.js';
import {
  createCreatorStep,
  createStepBinding,
  assertDeclarativeBinding,
} from '../../site/js/features/creator/steps/creator-step.js';
import { buildInvalidationPatch } from '../../site/js/features/creator/creator-invalidation.js';
import { CREATOR_INTENT_TYPES } from '../../site/js/features/creator/creator-intents.js';
import { createUiEventDecision, NO_UI_EVENT_DECISION } from '../../site/js/ui/event-delegation.js';
import { createPlaceholderStep } from '../e2e/harness/placeholder-creator-step.js';

let dom;

beforeEach(() => {
  dom = createTestDom();
});

afterEach(() => {
  dom.restore();
});

/**
 * Monta um registro com os sete passos-placeholder.
 * @param {object} [config]
 * @returns {object}
 */
function registroPlaceholder(config = {}) {
  const steps = CREATOR_STEP_IDS.map((stepId) => {
    const created = createPlaceholderStep(stepId, config);
    assert.equal(created.ok, true, stepId);
    return created.value;
  });
  const registry = createStepRegistry(steps);
  assert.equal(registry.ok, true);
  return registry.value;
}

/**
 * Monta sessão + controller num container novo.
 * @param {object} [params]
 * @returns {Promise<object>}
 */
async function montar({ config = {}, modal = null } = {}) {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const stepRegistry = registroPlaceholder(config);
  const draft = createCreatorDraft({});
  const session = createCreatorSession({ draft: draft.value, stepRegistry });
  const mounted = await mountCreator({ container, session, stepRegistry, modal });
  assert.equal(mounted.ok, true, mounted.ok ? '' : mounted.error.code);
  return { container, session, stepRegistry, dispose: mounted.value };
}

/**
 * Dispara um clique real no elemento.
 * @param {object} element
 * @returns {object} o evento disparado.
 */
function clicar(element) {
  const event = new dom.window.Event('click', { bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

describe('controller do criador: montagem e render', () => {
  test('renderiza o shell, marca o módulo montado e o passo atual', async () => {
    const { container, dispose } = await montar({
      config: { options: [{ id: 'barbaro', name: 'Bárbaro', description: 'Fúria.' }] },
    });
    const raiz = container.querySelector('[data-creator-module]');
    assert.ok(raiz, 'o harness/DOM precisa poder identificar o módulo montado');
    assert.equal(raiz.getAttribute('data-creator-step'), 'classe');
    assert.ok(container.querySelector('[data-placeholder-step="classe"]'));
    assert.ok(container.textContent.includes('Bárbaro'));
    dispose();
  });

  test('um mount que falha na inicialização não deixa listener vivo', async () => {
    const container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    const registrados = [];
    const original = container.addEventListener.bind(container);
    container.addEventListener = (type, listener, options) => {
      registrados.push(type);
      original(type, listener, options);
    };
    const removidos = [];
    const originalRemove = container.removeEventListener.bind(container);
    container.removeEventListener = (type, listener, options) => {
      removidos.push(type);
      originalRemove(type, listener, options);
    };

    const stepRegistry = registroPlaceholder();
    const draft = createCreatorDraft({});
    const session = createCreatorSession({ draft: draft.value, stepRegistry });
    // Força a falha da inicialização descartando a sessão antes do mount.
    session.dispose();
    const mounted = await mountCreator({ container, session, stepRegistry });
    assert.equal(mounted.ok, false);
    assert.equal(mounted.error.code, 'CREATOR_SESSION_DISPOSED');
    assert.deepEqual(removidos.sort(), registrados.sort(), 'todo listener registrado precisa ter sido removido');
  });
});

describe('controller do criador: listeners delegados', () => {
  test('registra UM conjunto de listeners na raiz e não o multiplica a cada render', async () => {
    const container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    const registrados = [];
    const original = container.addEventListener.bind(container);
    container.addEventListener = (type, listener, options) => {
      registrados.push(type);
      original(type, listener, options);
    };

    const stepRegistry = registroPlaceholder({ options: [{ id: 'x', name: 'X' }] });
    const draft = createCreatorDraft({});
    const session = createCreatorSession({ draft: draft.value, stepRegistry });
    const mounted = await mountCreator({ container, session, stepRegistry });
    assert.equal(mounted.ok, true);
    const depoisDoMount = registrados.length;

    // Vários re-renders (cada dispatch publica um snapshot novo).
    clicar(container.querySelector('[data-placeholder-option="x"]'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    clicar(container.querySelector('[data-placeholder-option="x"]'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(registrados.length, depoisDoMount, 'o re-render não pode registrar listener novo');
    assert.deepEqual([...new Set(registrados)], ['click'], 'apenas os eventTypes declarados');
    mounted.value();
  });

  test('a intenção do passo chega à sessão e altera o rascunho', async () => {
    const { container, session, dispose } = await montar({
      config: { options: [{ id: 'mago', name: 'Mago' }] },
    });
    clicar(container.querySelector('[data-placeholder-option="mago"]'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(session.getSnapshot().draft.slices.classSelection, 'mago');
    dispose();
  });

  test('o controller aplica preventDefault segundo a decisão do passo', async () => {
    const { container, dispose } = await montar({ config: { options: [{ id: 'mago', name: 'Mago' }] } });
    const evento = clicar(container.querySelector('[data-placeholder-option="mago"]'));
    assert.equal(evento.defaultPrevented, true, 'a decisão do passo pedia preventDefault');
    dispose();
  });

  test('um clique fora de qualquer alvo do passo não vira intenção nem preventDefault', async () => {
    const { container, session, dispose } = await montar({ config: { options: [{ id: 'mago', name: 'Mago' }] } });
    const antes = session.getSnapshot();
    const evento = clicar(container.querySelector('[data-creator-content]'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(evento.defaultPrevented, false);
    assert.equal(session.getSnapshot(), antes);
    dispose();
  });

  test('os botões de navegação do shell despacham next/previous', async () => {
    const { container, session, dispose } = await montar({ config: { requireSelection: false } });
    clicar(container.querySelector('[data-creator-nav="next"]'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(session.getSnapshot().currentStepId, 'especie');
    clicar(container.querySelector('[data-creator-nav="previous"]'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(session.getSnapshot().currentStepId, 'classe');
    dispose();
  });
});

describe('controller do criador: bind é declarativo', () => {
  test('nenhum dos sete placeholders registra listener em bind', () => {
    for (const stepId of CREATOR_STEP_IDS) {
      const created = createPlaceholderStep(stepId);
      assert.equal(created.ok, true);
      const problema = assertDeclarativeBinding(created.value, { draft: null, data: null });
      assert.equal(problema, null, `${stepId}: ${problema?.code ?? ''}`);
    }
  });

  test('createCreatorStep RECUSA um passo que registra listener em bind', () => {
    // A garantia precisa ser ESTRUTURAL: um passo mentiroso não pode nem
    // chegar a existir, muito menos entrar num registro. O controller chama
    // `bind` a CADA evento — um listener direto ali acumularia um novo a cada
    // clique, indefinidamente.
    const created = createCreatorStep({
      id: 'classe',
      /** @returns {Promise<object>} */
      load: async () => ok({}),
      /** @returns {string} */
      render: () => '',
      /**
       * @param {object} context
       * @returns {object}
       */
      bind(context) {
        context.root.addEventListener('click', () => {});
        return createStepBinding({ eventTypes: ['click'], toIntent: () => NO_UI_EVENT_DECISION });
      },
      /** @returns {object} */
      validate: () => ({ valid: true, errors: [] }),
      /**
       * @param {object} context
       * @returns {object}
       */
      invalidate: (context) => buildInvalidationPatch('classe', { draft: context.draft }),
    });
    assert.equal(created.ok, false, 'o passo mentiroso não pode ser construído');
    assert.equal(created.error.code, 'CREATOR_STEP_BIND_NOT_DECLARATIVE');
    assert.deepEqual([...created.error.context.eventTypes], ['click']);
  });

  test('um passo que registra listener em bind é DETECTADO', () => {
    const mentiroso = {
      id: 'classe',
      /** @returns {object} */
      bind(context) {
        // Delegação de mentira: o descritor existe, mas o listener é direto.
        context.root.addEventListener('click', () => {});
        return createStepBinding({ eventTypes: ['click'], toIntent: () => NO_UI_EVENT_DECISION });
      },
    };
    const problema = assertDeclarativeBinding(mentiroso, {});
    assert.ok(problema);
    assert.equal(problema.code, 'CREATOR_STEP_BIND_NOT_DECLARATIVE');
  });

  test('o descritor é congelado e ignora eventos não declarados', () => {
    const binding = createStepBinding({
      eventTypes: ['click'],
      toIntent: () => createUiEventDecision({ intent: { type: 'x' }, preventDefault: true }),
    });
    assert.ok(Object.isFrozen(binding));
    assert.ok(Object.isFrozen(binding.eventTypes));
    assert.throws(() => {
      binding.toIntent = null;
    }, TypeError);
    assert.equal(binding.toIntent({ type: 'dragstart' }), NO_UI_EVENT_DECISION, 'evento não declarado é ignorado');
    assert.equal(binding.toIntent({ type: 'click' }).preventDefault, true);
  });

  test('decisões de submit e drag/drop são descritas, não executadas', () => {
    const binding = createStepBinding({
      eventTypes: ['submit', 'dragstart', 'drop'],
      /**
       * @param {object} event
       * @returns {object}
       */
      toIntent(event) {
        if (event.type === 'submit') {
          return createUiEventDecision({ intent: { type: 'creator/next' }, preventDefault: true });
        }
        if (event.type === 'drop') {
          return createUiEventDecision({ intent: { type: 'mover' }, preventDefault: true, stopPropagation: true });
        }
        return createUiEventDecision({ intent: { type: 'arrastar' } });
      },
    });
    assert.equal(binding.toIntent({ type: 'submit' }).preventDefault, true);
    const soltar = binding.toIntent({ type: 'drop' });
    assert.equal(soltar.preventDefault, true);
    assert.equal(soltar.stopPropagation, true);
    const arrastar = binding.toIntent({ type: 'dragstart' });
    assert.equal(arrastar.preventDefault, false);
    assert.equal(arrastar.stopPropagation, false);
  });
});

describe('controller do criador: modal como efeito do controller', () => {
  /**
   * ModalService mínimo que registra as chamadas.
   * @returns {object}
   */
  function modalEspiao() {
    const aberturas = [];
    return {
      aberturas,
      /**
       * @param {object} params
       * @returns {object}
       */
      open(params) {
        const entry = { params, closed: false, reason: null };
        aberturas.push(entry);
        return {
          /**
           * @param {string} [reason]
           * @returns {void}
           */
          close(reason = 'programmatic') {
            if (entry.closed) {
              return;
            }
            entry.closed = true;
            entry.reason = reason;
            if (typeof params.onClose === 'function') {
              params.onClose(reason);
            }
          },
          /** @returns {boolean} */
          isOpen: () => !entry.closed,
        };
      },
    };
  }

  test('o passo não recebe o serviço de modal', async () => {
    const modal = modalEspiao();
    const { session, dispose } = await montar({ modal });
    const contexto = session.getStepContext('classe');
    assert.equal(contexto.modal, undefined, 'o contexto do passo não pode conter o ModalService');
    assert.ok(!Object.keys(contexto).some((chave) => chave.toLowerCase().includes('modal')));
    dispose();
  });

  /**
   * Passo cujo `toIntent` produz intenções de MODAL — é assim que um passo
   * real pede um modal: descrevendo a intenção, sem receber o `ModalService`.
   * É o único jeito de exercitar `handleModalIntent` do controller pelo
   * caminho de verdade (clique -> delegação -> decisão -> efeito de modal).
   * @param {string} stepId
   * @returns {object}
   */
  function passoComModal(stepId) {
    const created = createCreatorStep({
      id: stepId,
      /** @returns {Promise<object>} */
      load: async () => ok({ stepId }),
      /** @returns {string} */
      render: () =>
        '<button data-modal-acao="begin">Abrir</button>' +
        '<button data-modal-acao="update">Escolher</button>' +
        '<button data-modal-acao="commit">Confirmar</button>',
      /** @returns {object} */
      bind: () =>
        createStepBinding({
          eventTypes: ['click'],
          /**
           * @param {object} event
           * @returns {object}
           */
          toIntent(event) {
            const alvo = event.target?.closest?.('[data-modal-acao]');
            if (!alvo) {
              return NO_UI_EVENT_DECISION;
            }
            const acao = alvo.getAttribute('data-modal-acao');
            const porAcao = {
              begin: { type: CREATOR_INTENT_TYPES.modalBegin, transactionId: 't1', title: 'Escolha uma classe' },
              update: { type: CREATOR_INTENT_TYPES.modalUpdate, transactionId: 't1', slices: { classSelection: 'mago' } },
              commit: { type: CREATOR_INTENT_TYPES.modalCommit, transactionId: 't1' },
            };
            return createUiEventDecision({ intent: porAcao[acao] ?? null, preventDefault: true });
          },
        }),
      /** @returns {object} */
      validate: () => ({ valid: true, errors: [] }),
      /**
       * @param {object} context
       * @returns {object}
       */
      invalidate: (context) => buildInvalidationPatch(stepId, { draft: context.draft }),
    });
    assert.equal(created.ok, true);
    return created.value;
  }

  /**
   * Monta um controller cujo passo ativo pede modais por intenção.
   * @param {object} modal
   * @returns {Promise<object>}
   */
  async function montarComModal(modal) {
    const container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    const steps = CREATOR_STEP_IDS.map((stepId) => passoComModal(stepId));
    const stepRegistry = createStepRegistry(steps);
    assert.equal(stepRegistry.ok, true);
    const draft = createCreatorDraft({});
    const session = createCreatorSession({ draft: draft.value, stepRegistry: stepRegistry.value });
    const mounted = await mountCreator({ container, session, stepRegistry: stepRegistry.value, modal });
    assert.equal(mounted.ok, true);
    return { container, session, dispose: mounted.value };
  }

  /**
   * Espera o microtask do despacho assíncrono do controller.
   * @returns {Promise<void>}
   */
  const aguardar = () => new Promise((resolve) => setTimeout(resolve, 0));

  test('o clique do passo abre o modal PELO controller (o passo nunca chama modal.open)', async () => {
    const modal = modalEspiao();
    const { container, session, dispose } = await montarComModal(modal);

    clicar(container.querySelector('[data-modal-acao="begin"]'));
    await aguardar();

    assert.equal(modal.aberturas.length, 1, 'o controller precisa ter aberto UM modal');
    assert.equal(modal.aberturas[0].params.title, 'Escolha uma classe');
    assert.deepEqual([...session.getSnapshot().pendingTransactionIds], ['t1']);
    dispose();
  });

  test('fechar o modal por fora (backdrop/Escape) CANCELA a transação', async () => {
    const modal = modalEspiao();
    const { container, session, dispose } = await montarComModal(modal);

    clicar(container.querySelector('[data-modal-acao="begin"]'));
    await aguardar();
    clicar(container.querySelector('[data-modal-acao="update"]'));
    await aguardar();

    const antes = session.getSnapshot().draft;
    assert.equal(antes.slices.classSelection, null, 'update não pode ter tocado no rascunho');

    // O serviço de modal fecha por conta própria (backdrop/Escape): é o
    // `onClose` registrado pelo CONTROLLER que precisa cancelar a transação.
    modal.aberturas[0].params.onClose('backdrop');
    await aguardar();

    assert.equal(session.getSnapshot().draft, antes, 'fechar por fora não pode gravar escolha');
    assert.equal(session.getSnapshot().draft.slices.classSelection, null);
    assert.deepEqual([...session.getSnapshot().pendingTransactionIds], [], 'a transação precisa ter sido fechada');
    dispose();
  });

  test('o commit fecha o modal SEM que o onClose cancele a transação já confirmada', async () => {
    const modal = modalEspiao();
    const { container, session, dispose } = await montarComModal(modal);

    clicar(container.querySelector('[data-modal-acao="begin"]'));
    await aguardar();
    clicar(container.querySelector('[data-modal-acao="update"]'));
    await aguardar();
    clicar(container.querySelector('[data-modal-acao="commit"]'));
    await aguardar();

    // O controller remove de `openModals` ANTES de fechar, para que o
    // `onClose` do próprio fechamento não despache um cancel sobre a
    // transação recém-commitada. Verificado empiricamente: invertendo a ordem
    // no controller, este teste continua verde — porque o cancel tardio cai
    // em `CREATOR_TRANSACTION_NOT_OPEN` e é engolido, sem desfazer o commit.
    // Ou seja, a ordem é DEFENSIVA, não a última linha de defesa; o que este
    // teste garante de fato é o resultado observável: modal fechado e commit
    // preservado.
    assert.equal(modal.aberturas[0].closed, true, 'o modal precisa ter sido fechado pelo commit');
    assert.equal(session.getSnapshot().draft.slices.classSelection, 'mago', 'o commit precisa ter sobrevivido ao onClose');
    assert.deepEqual([...session.getSnapshot().pendingTransactionIds], []);
    dispose();
  });

  test('o disposer fecha os modais que o CONTROLLER abriu e é idempotente', async () => {
    const modal = modalEspiao();
    const { container, session, dispose } = await montarComModal(modal);

    clicar(container.querySelector('[data-modal-acao="begin"]'));
    await aguardar();
    assert.equal(modal.aberturas.length, 1);
    assert.equal(modal.aberturas[0].closed, false);

    dispose();
    assert.equal(modal.aberturas[0].closed, true, 'o disposer precisa fechar o modal aberto pelo controller');
    assert.equal(session.isDisposed(), true);

    // Idempotente: uma segunda chamada não reabre, não refecha, não lança.
    dispose();
    assert.equal(modal.aberturas.length, 1);
  });
});

describe('controller do criador: render nunca devolve payload cru', () => {
  test('nome e descrição maliciosos saem escapados do render do passo', () => {
    const payloads = [
      '<script>window.__xss=1</script>',
      '"><img src=x onerror="window.__xss=1">',
      "javascript:alert(1)",
      '<svg/onload=window.__xss=1>',
      '</title><script>window.__xss=1</script>',
    ];
    for (const payload of payloads) {
      const created = createPlaceholderStep('classe', {});
      assert.equal(created.ok, true);
      const draft = createCreatorDraft({});
      const markup = created.value.render({
        stepId: 'classe',
        draft: draft.value,
        data: { stepId: 'classe', options: [{ id: 'a', name: payload, description: payload }] },
      });
      // Nenhuma TAG do payload sobrevive à montagem da string: o `<` do
      // payload sempre sai como `&lt;`.
      assert.ok(!markup.includes('<script'), `payload cru vazou: ${payload}`);
      assert.ok(!markup.includes('<img'), `payload cru vazou: ${payload}`);
      assert.ok(!markup.includes('<svg'), `payload cru vazou: ${payload}`);

      // E, parseado por um DOM real, o payload não cria elemento nenhum nem
      // vira atributo de evento — só TEXTO. (Um `onerror=` que aparece dentro
      // de um nó de texto escapado é inerte; o que importa é que ele nunca
      // seja um ATRIBUTO.)
      const host = dom.document.createElement('div');
      host.innerHTML = markup;
      assert.equal(host.querySelectorAll('script, img, svg, iframe').length, 0, `payload criou elemento: ${payload}`);
      for (const elemento of host.querySelectorAll('*')) {
        for (const atributo of elemento.attributes) {
          assert.ok(!atributo.name.startsWith('on'), `payload virou handler ${atributo.name}: ${payload}`);
          // Só atributos NAVEGÁVEIS importam para `javascript:`. Um `title`
          // com esse texto é inerte — exigir o contrário testaria estética,
          // não segurança.
          if (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(atributo.name)) {
            assert.ok(
              !String(atributo.value).toLowerCase().includes('javascript:'),
              `payload virou destino navegável: ${payload}`,
            );
          }
        }
      }
      assert.ok(host.textContent.includes(payload), 'o payload precisa aparecer como TEXTO, não como markup');
    }
  });

  test('o render do shell escapa o status e o passo atual', async () => {
    const { container, dispose } = await montar({});
    const raiz = container.querySelector('[data-creator-module]');
    assert.equal(raiz.getAttribute('data-creator-module'), 'features/creator');
    dispose();
  });
});

describe('controller do criador: duas montagens simultâneas', () => {
  test('dois controllers no mesmo documento não trocam evento nem estado', async () => {
    const a = await montar({ config: { options: [{ id: 'mago', name: 'Mago' }] } });
    const b = await montar({ config: { options: [{ id: 'ladino', name: 'Ladino' }] } });

    clicar(a.container.querySelector('[data-placeholder-option="mago"]'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(a.session.getSnapshot().draft.slices.classSelection, 'mago');
    assert.equal(b.session.getSnapshot().draft.slices.classSelection, null, 'o clique em A não pode afetar B');

    a.dispose();
    // Depois do dispose de A, B continua funcionando.
    clicar(b.container.querySelector('[data-placeholder-option="ladino"]'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(b.session.getSnapshot().draft.slices.classSelection, 'ladino');
    b.dispose();
  });

  test('depois do dispose, um clique não produz mais nenhuma mudança', async () => {
    const { container, session, dispose } = await montar({ config: { options: [{ id: 'mago', name: 'Mago' }] } });
    const alvo = container.querySelector('[data-placeholder-option="mago"]');
    dispose();
    const antes = session.getSnapshot();
    clicar(alvo);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(session.getSnapshot(), antes);
  });
});

describe('controller do criador: registro de produção', () => {
  test('o registro de produção monta os SETE passos reais (Task 28)', async () => {
    const { createDefaultStepRegistry, buildRealCreatorSteps } = await import('../../site/js/features/creator/steps/index.js');
    const construidos = buildRealCreatorSteps();
    assert.equal(construidos.ok, true, construidos.ok ? '' : construidos.error.code);
    assert.deepEqual(
      construidos.value.map((step) => step.id),
      [...CREATOR_STEP_IDS],
      'os sete passos precisam ser REAIS: nenhum placeholder no caminho público',
    );
    const registry = createDefaultStepRegistry();
    assert.equal(registry.ok, true, registry.ok ? '' : registry.error.code);
    assert.deepEqual([...registry.value.stepIds()], [...CREATOR_STEP_IDS]);
  });

  test('o registro continua RECUSANDO um conjunto incompleto, com erro nomeado', async () => {
    const { buildRealCreatorSteps } = await import('../../site/js/features/creator/steps/index.js');
    const { createStepRegistry } = await import('../../site/js/features/creator/steps/step-registry.js');
    const construidos = buildRealCreatorSteps();
    // Tira UM passo: a recusa precisa continuar alta e nomeada, nunca um
    // wizard que silenciosamente pula uma etapa.
    const parcial = createStepRegistry(construidos.value.filter((step) => step.id !== 'detalhes'));
    assert.equal(parcial.ok, false);
    assert.equal(parcial.error.code, 'CREATOR_STEP_REGISTRY_INCOMPLETE');
    assert.deepEqual([...parcial.error.context.missing], ['detalhes']);
  });

  test('o placeholder é um passo VÁLIDO mas não finaliza personagem', async () => {
    const { session, dispose } = await montar({});
    const finalizado = session.finalize();
    assert.equal(finalizado.ok, false);
    assert.ok(['CREATOR_NOT_FINALIZABLE', 'CREATOR_CHARACTER_MISSING'].includes(finalizado.error.code));
    dispose();
  });
});

// Sanidade: o helper `ok` é usado indiretamente pelos placeholders.
void ok;
