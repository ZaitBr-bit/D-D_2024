// Sessão do criador (Task 25).
//
// Duas famílias de teste dominam este arquivo, porque são as que pegam os
// defeitos que o singleton legado esconde:
//
//  1. DUAS SESSÕES SIMULTÂNEAS. Não uma amostra — duas sessões de verdade,
//     dirigidas em intercalação, verificando rascunho, cache de passo, passo
//     atual, transação e listeners.
//  2. GERAÇÃO/AbortSignal. Uma resposta de `load` que chega DEPOIS de o
//     usuário ter trocado de passo/classe não pode vazar para o estado atual.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ok, err } from '../../../site/js/core/result.js';
import { createAppError } from '../../../site/js/core/errors.js';
import {
  CREATOR_STEP_IDS,
  CREATOR_STATUS,
  createCreatorDraft,
} from '../../../site/js/features/creator/creator-state.js';
import { createCreatorSession } from '../../../site/js/features/creator/creator-session.js';
import { createCreatorStep, createStepBinding } from '../../../site/js/features/creator/steps/creator-step.js';
import { createStepRegistry } from '../../../site/js/features/creator/steps/step-registry.js';
import {
  buildInvalidationPatch,
  applyInvalidationPatch,
  STEP_IDENTITY_SLICE,
} from '../../../site/js/features/creator/creator-invalidation.js';
import { withDraftSlices } from '../../../site/js/features/creator/creator-state.js';
import { CREATOR_INTENT_TYPES, createCreatorIntent } from '../../../site/js/features/creator/creator-intents.js';
import { NO_UI_EVENT_DECISION } from '../../../site/js/ui/event-delegation.js';
import { applyGrantEffects } from '../../../site/js/domain/effects/apply-grants.js';

/**
 * Passo de teste configurável.
 * @param {string} stepId
 * @param {object} [config]
 * @returns {object}
 */
function passo(stepId, config = {}) {
  const { alwaysValid = true, loadImpl = null, marker = 'padrao' } = config;
  const identitySlice = STEP_IDENTITY_SLICE[stepId];
  const created = createCreatorStep({
    id: stepId,
    /**
     * @param {object} context
     * @returns {Promise<object>}
     */
    async load(context) {
      if (loadImpl) {
        return loadImpl(context);
      }
      return ok({ stepId, marker });
    },
    /**
     * @param {object} context
     * @returns {string}
     */
    render(context) {
      return `<p>${stepId}:${String(context.data?.marker ?? '')}</p>`;
    },
    /** @returns {object} */
    bind() {
      return createStepBinding({ eventTypes: ['click'], toIntent: () => NO_UI_EVENT_DECISION });
    },
    /**
     * @param {object} context
     * @returns {object}
     */
    validate(context) {
      if (alwaysValid) {
        return { valid: true, errors: [] };
      }
      const selecionado = identitySlice ? context.draft.slices[identitySlice] : null;
      return selecionado ? { valid: true, errors: [] } : { valid: false, errors: [{ code: 'FALTA_ESCOLHA' }] };
    },
    /**
     * @param {object} context
     * @returns {object}
     */
    invalidate(context) {
      return buildInvalidationPatch(stepId, { draft: context.draft });
    },
    /**
     * @param {object} context
     * @param {object} intent
     * @returns {object}
     */
    reduce(context, intent) {
      if (intent.type !== 'teste/escolher' || !identitySlice) {
        return ok({ draft: context.draft });
      }
      const next = withDraftSlices(context.draft, {
        slices: { [identitySlice]: intent.valor },
        provenance: { [identitySlice]: [`${stepId}#${intent.valor}`] },
      });
      return next.ok ? ok({ draft: next.value }) : next;
    },
  });
  assert.equal(created.ok, true, `passo ${stepId} inválido`);
  return created.value;
}

/**
 * Sessão pronta com os sete passos.
 * @param {object} [config]
 * @returns {object}
 */
function sessao(config = {}) {
  const steps = CREATOR_STEP_IDS.map((stepId) => passo(stepId, { ...config, ...(config.porPasso?.[stepId] ?? {}) }));
  const registry = createStepRegistry(steps);
  assert.equal(registry.ok, true);
  const draft = createCreatorDraft({});
  assert.equal(draft.ok, true);
  return createCreatorSession({ draft: draft.value, stepRegistry: registry.value });
}

describe('sessão do criador: contrato básico', () => {
  test('initialize carrega o primeiro passo e publica um snapshot congelado', async () => {
    const session = sessao();
    const result = await session.initialize();
    assert.equal(result.ok, true);
    const snapshot = session.getSnapshot();
    assert.equal(snapshot.currentStepId, 'classe');
    assert.equal(snapshot.status, CREATOR_STATUS.ready);
    assert.equal(snapshot.stepData.classe.stepId, 'classe');
    assert.ok(Object.isFrozen(snapshot));
    assert.ok(Object.isFrozen(snapshot.visitedStepIds));
    assert.throws(() => {
      snapshot.currentStepId = 'magias';
    }, TypeError);
  });

  test('next avança e previous volta, mantendo os visitados', async () => {
    const session = sessao();
    await session.initialize();
    assert.equal((await session.next()).ok, true);
    assert.equal(session.getSnapshot().currentStepId, 'especie');
    const back = session.previous();
    assert.equal(back.ok, true);
    assert.equal(session.getSnapshot().currentStepId, 'classe');
    assert.deepEqual([...session.getSnapshot().visitedStepIds], ['classe', 'especie']);
  });

  test('next recusa avançar com o passo inválido, sem mudar de passo', async () => {
    const session = sessao({ alwaysValid: false });
    await session.initialize();
    const result = await session.next();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CREATOR_STEP_INVALID');
    assert.equal(session.getSnapshot().currentStepId, 'classe');
  });

  test('goToVisited recusa salto para frente e para passo não visitado', async () => {
    const session = sessao();
    await session.initialize();
    const frente = session.goToVisited('magias');
    assert.equal(frente.ok, false);
    assert.equal(frente.error.code, 'CREATOR_STEP_NOT_VISITED');

    await session.next();
    await session.next();
    const volta = session.goToVisited('classe');
    assert.equal(volta.ok, true);
    assert.equal(session.getSnapshot().currentStepId, 'classe');
  });

  test('finalize exige todos os passos válidos', async () => {
    const invalido = sessao({ alwaysValid: false });
    await invalido.initialize();
    const recusado = invalido.finalize();
    assert.equal(recusado.ok, false);
    assert.equal(recusado.error.code, 'CREATOR_NOT_FINALIZABLE');

    const valido = sessao();
    await valido.initialize();
    const semPersonagem = valido.finalize();
    assert.equal(semPersonagem.ok, false);
    assert.equal(semPersonagem.error.code, 'CREATOR_CHARACTER_MISSING');
  });

  test('dispose torna a sessão inerte e é idempotente', async () => {
    const session = sessao();
    await session.initialize();
    session.dispose();
    session.dispose();
    assert.equal(session.isDisposed(), true);
    const result = await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.next));
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CREATOR_SESSION_DISPOSED');
  });
});

describe('sessão do criador: DUAS SESSÕES SIMULTÂNEAS', () => {
  test('rascunho, passo atual, cache e listeners não vazam entre sessões', async () => {
    const a = sessao({ marker: 'A' });
    const b = sessao({ marker: 'B' });

    const eventosA = [];
    const eventosB = [];
    const soltaA = a.subscribe((snap) => eventosA.push(snap.currentStepId));
    b.subscribe((snap) => eventosB.push(snap.currentStepId));

    await Promise.all([a.initialize(), b.initialize()]);

    // Dirige as duas em INTERCALAÇÃO, não uma depois da outra.
    await a.dispatch(createCreatorIntent('teste/escolher', { valor: 'classe-de-A' }));
    await b.dispatch(createCreatorIntent('teste/escolher', { valor: 'classe-de-B' }));
    await a.next();
    await b.next();
    await b.next();

    assert.equal(a.getSnapshot().draft.slices.classSelection, 'classe-de-A');
    assert.equal(b.getSnapshot().draft.slices.classSelection, 'classe-de-B');
    assert.equal(a.getSnapshot().currentStepId, 'especie');
    assert.equal(b.getSnapshot().currentStepId, 'antecedente');
    assert.notEqual(a.getSnapshot().draft, b.getSnapshot().draft);
    assert.notEqual(a.getSnapshot().stepData, b.getSnapshot().stepData);

    // Transação aberta em A não aparece em B.
    await a.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalBegin, { transactionId: 'apenas-de-A' }));
    assert.deepEqual([...a.getSnapshot().pendingTransactionIds], ['apenas-de-A']);
    assert.deepEqual([...b.getSnapshot().pendingTransactionIds], []);

    // Listeners: soltar o de A não afeta B; descartar A não notifica B.
    const antesA = eventosA.length;
    const antesB = eventosB.length;
    soltaA();
    a.dispose();
    await b.next();
    assert.equal(eventosA.length, antesA, 'o listener solto de A não pode continuar recebendo');
    assert.ok(eventosB.length > antesB, 'B precisa continuar publicando depois de A ser descartada');
    assert.equal(b.isDisposed(), false);
  });

  test('invalidação em uma sessão não toca no rascunho da outra', async () => {
    const a = sessao();
    const b = sessao();
    await Promise.all([a.initialize(), b.initialize()]);
    for (const session of [a, b]) {
      await session.dispatch(createCreatorIntent('teste/escolher', { valor: 'mago' }));
      await session.next();
      await session.dispatch(createCreatorIntent('teste/escolher', { valor: 'elfo' }));
    }
    assert.equal(a.previous().ok, true);
    assert.equal(a.getSnapshot().draft.slices.speciesSelection, null, 'A precisa ter limpado a espécie');
    assert.equal(b.getSnapshot().draft.slices.speciesSelection, 'elfo', 'B não pode ter sido afetada');
  });
});

describe('sessão do criador: geração e AbortSignal', () => {
  test('resposta de load ANTERIOR não vaza depois de uma troca de passo', async () => {
    /** @type {Array<{stepId: string, resolve: Function}>} */
    const pendentes = [];
    /**
     * @param {object} context
     * @returns {Promise<object>}
     */
    const loadImpl = (context) =>
      new Promise((resolve) => {
        pendentes.push({ stepId: context.stepId, resolve });
      });

    const steps = CREATOR_STEP_IDS.map((stepId) => passo(stepId, { loadImpl }));
    const registry = createStepRegistry(steps);
    const draft = createCreatorDraft({});
    const session = createCreatorSession({ draft: draft.value, stepRegistry: registry.value });

    const inicializacao = session.initialize();
    assert.equal(pendentes.length, 1);
    assert.equal(session.getSnapshot().status, CREATOR_STATUS.loading);

    // O usuário troca de passo ANTES de a carga de `classe` responder.
    // (`previous`/`goToVisited` são síncronos, então usamos uma segunda carga.)
    const segundaCarga = session.initialize();
    assert.equal(pendentes.length, 2);

    // A carga ANTIGA responde por último — o caso real da troca rápida.
    pendentes[1].resolve(ok({ stepId: 'classe', marker: 'NOVA' }));
    pendentes[0].resolve(ok({ stepId: 'classe', marker: 'ANTIGA' }));

    const resultadoAntigo = await inicializacao;
    const resultadoNovo = await segundaCarga;

    assert.equal(resultadoAntigo.ok, false, 'a carga antiga precisa ser recusada');
    assert.equal(resultadoAntigo.error.code, 'CREATOR_STEP_LOAD_STALE');
    assert.equal(resultadoNovo.ok, true);
    assert.equal(session.getSnapshot().stepData.classe.marker, 'NOVA', 'o estado não pode ter a resposta antiga');
  });

  test('o AbortSignal da carga em voo é abortado quando outra carga começa', async () => {
    /** @type {Array<AbortSignal>} */
    const sinais = [];
    /**
     * @param {object} context
     * @returns {Promise<object>}
     */
    const loadImpl = (context) => {
      sinais.push(context.signal);
      return new Promise((resolve) => setTimeout(() => resolve(ok({ stepId: context.stepId })), 5));
    };
    const steps = CREATOR_STEP_IDS.map((stepId) => passo(stepId, { loadImpl }));
    const registry = createStepRegistry(steps);
    const draft = createCreatorDraft({});
    const session = createCreatorSession({ draft: draft.value, stepRegistry: registry.value });

    const primeira = session.initialize();
    const segunda = session.initialize();
    await Promise.all([primeira, segunda]);

    assert.equal(sinais.length, 2);
    assert.equal(sinais[0].aborted, true, 'a primeira carga precisa ter sido abortada');
    assert.equal(sinais[1].aborted, false);
  });

  test('um signal externo já abortado propaga para a carga', async () => {
    /** @type {Array<AbortSignal>} */
    const sinais = [];
    /**
     * @param {object} context
     * @returns {Promise<object>}
     */
    const loadImpl = (context) => {
      sinais.push(context.signal);
      return Promise.resolve(ok({ stepId: context.stepId }));
    };
    const steps = CREATOR_STEP_IDS.map((stepId) => passo(stepId, { loadImpl }));
    const registry = createStepRegistry(steps);
    const draft = createCreatorDraft({});
    const session = createCreatorSession({ draft: draft.value, stepRegistry: registry.value });

    const controller = new AbortController();
    controller.abort();
    await session.initialize({ signal: controller.signal });
    assert.equal(sinais[0].aborted, true);
  });

  test('uma carga que responde DEPOIS do dispose não escreve no estado', async () => {
    /** @type {Array<Function>} */
    const pendentes = [];
    /**
     * @returns {Promise<object>}
     */
    const loadImpl = () => new Promise((resolve) => pendentes.push(resolve));
    const steps = CREATOR_STEP_IDS.map((stepId) => passo(stepId, { loadImpl }));
    const registry = createStepRegistry(steps);
    const draft = createCreatorDraft({});
    const session = createCreatorSession({ draft: draft.value, stepRegistry: registry.value });

    const carga = session.initialize();
    session.dispose();
    pendentes[0](ok({ stepId: 'classe', marker: 'TARDIA' }));
    const resultado = await carga;
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_STEP_LOAD_STALE');
    assert.equal(session.getSnapshot().stepData.classe, undefined);
  });

  test('um load que falha vira status de erro estruturado, sem crash', async () => {
    /**
     * @returns {Promise<object>}
     */
    const loadImpl = () =>
      Promise.resolve(err(createAppError({ code: 'CATALOGO_FORA', scope: 'teste', message: 'Falhou.' })));
    const steps = CREATOR_STEP_IDS.map((stepId) => passo(stepId, { loadImpl }));
    const registry = createStepRegistry(steps);
    const draft = createCreatorDraft({});
    const session = createCreatorSession({ draft: draft.value, stepRegistry: registry.value });
    const resultado = await session.initialize();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CATALOGO_FORA');
    assert.equal(session.getSnapshot().status, CREATOR_STATUS.error);
    assert.equal(session.getSnapshot().error.code, 'CATALOGO_FORA');
  });

  test('um load que LANÇA é convertido em Result, sem derrubar a sessão', async () => {
    /**
     * @returns {Promise<object>}
     */
    const loadImpl = () => {
      throw new Error('boom');
    };
    const steps = CREATOR_STEP_IDS.map((stepId) => passo(stepId, { loadImpl }));
    const registry = createStepRegistry(steps);
    const draft = createCreatorDraft({});
    const session = createCreatorSession({ draft: draft.value, stepRegistry: registry.value });
    const resultado = await session.initialize();
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_STEP_LOAD_THREW');
  });
});

describe('sessão do criador: transação de modal via dispatch', () => {
  test('só o commit altera o rascunho', async () => {
    const session = sessao();
    await session.initialize();
    const antes = session.getSnapshot().draft;

    await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalBegin, { transactionId: 't1' }));
    await session.dispatch(
      createCreatorIntent(CREATOR_INTENT_TYPES.modalUpdate, { transactionId: 't1', slices: { classSelection: 'bardo' } }),
    );
    assert.equal(session.getSnapshot().draft, antes, 'update não pode mexer no rascunho');

    await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalCancel, { transactionId: 't1' }));
    assert.equal(session.getSnapshot().draft, antes, 'cancel precisa deixar tudo como estava');

    await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalBegin, { transactionId: 't2' }));
    await session.dispatch(
      createCreatorIntent(CREATOR_INTENT_TYPES.modalUpdate, { transactionId: 't2', slices: { classSelection: 'bardo' } }),
    );
    await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalCommit, { transactionId: 't2' }));
    assert.equal(session.getSnapshot().draft.slices.classSelection, 'bardo');
  });

  test('intenção de modal sem transactionId é recusada', async () => {
    const session = sessao();
    await session.initialize();
    const result = await session.dispatch({ type: CREATOR_INTENT_TYPES.modalBegin });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CREATOR_INTENT_TRANSACTION_ID_MISSING');
  });

  test('dispose cancela transações abertas sem commitar', async () => {
    const session = sessao();
    await session.initialize();
    await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalBegin, { transactionId: 't1' }));
    await session.dispatch(
      createCreatorIntent(CREATOR_INTENT_TYPES.modalUpdate, { transactionId: 't1', slices: { classSelection: 'nunca' } }),
    );
    const antes = session.getSnapshot().draft;
    session.dispose();
    assert.equal(session.getSnapshot().draft, antes);
    assert.equal(session.getSnapshot().draft.slices.classSelection, null);
  });
});

describe('sessão do criador: dispatcher com o shape pinado', () => {
  test('um passo SEM reduce recusa a intenção de domínio de forma estruturada', async () => {
    const steps = CREATOR_STEP_IDS.map((stepId) => {
      const created = createCreatorStep({
        id: stepId,
        /** @returns {Promise<object>} */
        load: async () => ok({ stepId }),
        /** @returns {string} */
        render: () => '',
        /** @returns {object} */
        bind: () => createStepBinding({ eventTypes: ['click'], toIntent: () => NO_UI_EVENT_DECISION }),
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
    });
    const registry = createStepRegistry(steps);
    const draft = createCreatorDraft({});
    const session = createCreatorSession({ draft: draft.value, stepRegistry: registry.value });
    await session.initialize();

    const result = await session.dispatch(createCreatorIntent('algum/dominio'));
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CREATOR_INTENT_UNHANDLED');

    // Mas a navegação e a invalidação continuam funcionando com o shape pinado.
    assert.equal((await session.next()).ok, true);
    assert.equal(session.previous().ok, true);
  });

  test('uma intenção malformada é recusada antes de chegar ao passo', async () => {
    const session = sessao();
    await session.initialize();
    for (const intent of [null, {}, { type: '' }, 42]) {
      const result = await session.dispatch(intent);
      assert.equal(result.ok, false);
      assert.equal(result.error.code, 'CREATOR_INTENT_INVALID');
    }
  });
});

describe('sessão do criador: troca DENTRO do mesmo passo aplica a matriz', () => {
  /**
   * Passo `classe` que, ao trocar de classe, devolve `{draft, invalidation}` —
   * o caminho pelo qual a linha `classe` da matriz é realmente exercitada por
   * uma sessão (voltar de `especie` nunca chega a invalidar `classe`, porque
   * `classe` é o índice 0).
   * @returns {object}
   */
  function passoClasseComTroca() {
    const created = createCreatorStep({
      id: 'classe',
      /** @returns {Promise<object>} */
      load: async () => ok({ stepId: 'classe' }),
      /** @returns {string} */
      render: () => '',
      /** @returns {object} */
      bind: () => createStepBinding({ eventTypes: ['click'], toIntent: () => NO_UI_EVENT_DECISION }),
      /** @returns {object} */
      validate: () => ({ valid: true, errors: [] }),
      /**
       * @param {object} context
       * @returns {object}
       */
      invalidate: (context) => buildInvalidationPatch('classe', { draft: context.draft }),
      /**
       * @param {object} context
       * @param {object} intent
       * @returns {object}
       */
      reduce(context, intent) {
        if (intent.type !== 'teste/trocar-classe') {
          return ok({ draft: context.draft });
        }
        const patchResult = buildInvalidationPatch('classe', { draft: context.draft });
        if (patchResult.ok !== true) {
          return patchResult;
        }
        // DELIBERADAMENTE BRUTO: o passo só escreve a escolha nova sobre o
        // rascunho que recebeu. Ele NÃO chama `applyInvalidationPatch`, não
        // limpa fatia nenhuma e não revoga concessão nenhuma — é a SESSÃO que
        // precisa compor o patch com este rascunho. Se o fixture fizesse o
        // trabalho, o teste provaria o fixture, não a sessão.
        const next = withDraftSlices(context.draft, {
          slices: { classSelection: intent.valor },
          provenance: { classSelection: [`classe#${intent.valor}`] },
        });
        return next.ok ? ok({ draft: next.value, invalidation: patchResult.value }) : next;
      },
    });
    assert.equal(created.ok, true);
    return created.value;
  }

  const FONTE_BARBARO = 'dnd2024:class:barbaro#instancia-1';

  /**
   * Personagem com concessões REAIS da classe antiga já materializadas por
   * `applyGrantEffects` — é a revogação dessas concessões que a sessão precisa
   * produzir sozinha.
   * @returns {{personagem: object, base: object}}
   */
  function personagemComConcessoesDoBarbaro() {
    const base = Object.freeze({
      build: { contentScopes: { dnd2024: { packageVersion: '1.0.0' } } },
      state: { spells: { known: [], prepared: [] }, inventory: [], conditions: [], resources: {}, activeEffects: [] },
    });
    const aplicado = applyGrantEffects(base, [
      {
        effect: { type: 'grant-item', item: 'dnd2024:item:machado-grande' },
        effectInstanceId: 'efeito-machado',
        sourceInstanceId: FONTE_BARBARO,
        sourceId: 'dnd2024:class:barbaro',
      },
      {
        effect: { type: 'proficiency', target: 'dnd2024:skill:atletismo' },
        effectInstanceId: 'efeito-atletismo',
        sourceInstanceId: FONTE_BARBARO,
        sourceId: 'dnd2024:class:barbaro',
      },
    ]);
    assert.equal(aplicado.ok, true);
    assert.equal(aplicado.value.character.state.inventory.length, 1);
    return { personagem: aplicado.value.character, base };
  }

  test('trocar de classe: a SESSÃO revoga as concessões antigas, limpa as fatias, adota a escolha nova e preserva itens/moedas manuais', async () => {
    const { personagem, base } = personagemComConcessoesDoBarbaro();
    const steps = [passoClasseComTroca(), ...CREATOR_STEP_IDS.slice(1).map((stepId) => passo(stepId))];
    const registry = createStepRegistry(steps);
    const inicial = createCreatorDraft({
      character: personagem,
      slices: {
        classSelection: 'barbaro',
        classSkills: ['atletismo'],
        startingEquipmentSelection: 'kit-do-barbaro',
        startingCurrencyGrant: { po: 50 },
        manualInventoryChanges: [{ id: 'espada-comprada', quantidade: 1 }],
        walletChanges: { po: 137 },
      },
      provenance: {
        classSkills: [FONTE_BARBARO],
        startingEquipmentSelection: [FONTE_BARBARO],
        startingCurrencyGrant: [FONTE_BARBARO],
      },
    });
    assert.equal(inicial.ok, true);
    const session = createCreatorSession({ draft: inicial.value, stepRegistry: registry.value });
    await session.initialize();

    const resultado = await session.dispatch(createCreatorIntent('teste/trocar-classe', { valor: 'mago' }));
    assert.equal(resultado.ok, true);

    const draft = session.getSnapshot().draft;

    // (c) a escolha NOVA do passo vale.
    assert.equal(draft.slices.classSelection, 'mago', 'a escolha NOVA precisa sobreviver ao patch');
    assert.deepEqual([...draft.provenance.classSelection], ['classe#mago']);

    // (b) as fatias do patch foram limpas — pela SESSÃO, não pelo fixture.
    assert.equal(draft.slices.classSkills, null, 'as perícias da classe antiga precisam sumir');
    assert.equal(draft.slices.startingEquipmentSelection, null);
    assert.equal(draft.slices.startingCurrencyGrant, null);
    assert.deepEqual([...draft.provenance.startingEquipmentSelection], []);

    // (a) as concessões da classe antiga foram REVOGADAS do personagem.
    assert.deepEqual(
      draft.character.state.inventory,
      base.state.inventory,
      'o item concedido pelo bárbaro precisa ter sido revogado do personagem',
    );
    assert.deepEqual(
      draft.character.state.activeEffects,
      base.state.activeEffects,
      'a proficiência concedida pelo bárbaro precisa ter sido revogada',
    );

    // (d) as fatias do jogador sobrevivem a tudo isso.
    assert.deepEqual(
      draft.slices.manualInventoryChanges,
      [{ id: 'espada-comprada', quantidade: 1 }],
      'itens comprados à mão sobrevivem a uma troca COMPLETA de classe',
    );
    assert.deepEqual(draft.slices.walletChanges, { po: 137 });
  });

  test('o invalidation de reduce descarta o step data dos passos dependentes', async () => {
    const steps = [passoClasseComTroca(), ...CREATOR_STEP_IDS.slice(1).map((stepId) => passo(stepId))];
    const registry = createStepRegistry(steps);
    const draft = createCreatorDraft({ slices: { classSelection: 'barbaro' } });
    const session = createCreatorSession({ draft: draft.value, stepRegistry: registry.value });
    await session.initialize();

    // Vai até `equipamento` (carregando-o) e volta para `classe`. A volta
    // invalida equipamento/atributos/antecedente/especie — e NENHUM desses
    // patches cita `equipamento` em `clearedStepIds`, então o step data de
    // `equipamento` continua em cache. É de propósito: assim o único
    // candidato a produzir o efeito observado é o `dispatch` seguinte.
    for (let i = 0; i < 4; i += 1) {
      assert.equal((await session.next()).ok, true);
    }
    assert.equal(session.getSnapshot().currentStepId, 'equipamento');
    assert.ok(session.getSnapshot().stepData.equipamento, 'equipamento precisa ter sido carregado');

    assert.equal(session.goToVisited('classe').ok, true);
    assert.ok(
      session.getSnapshot().stepData.equipamento,
      'pré-condição: voltar para classe NÃO pode ter descartado o step data de equipamento',
    );

    // ESTE dispatch é o único responsável pelo efeito observado abaixo.
    await session.dispatch(createCreatorIntent('teste/trocar-classe', { valor: 'mago' }));
    assert.equal(
      session.getSnapshot().stepData.equipamento,
      undefined,
      'o step data de equipamento depende da classe e precisa ser descartado pelo invalidation do reduce',
    );
  });

  test('um invalidation malformado devolvido por reduce é RECUSADO, não ignorado', async () => {
    const created = createCreatorStep({
      id: 'classe',
      /** @returns {Promise<object>} */
      load: async () => ok({ stepId: 'classe' }),
      /** @returns {string} */
      render: () => '',
      /** @returns {object} */
      bind: () => createStepBinding({ eventTypes: ['click'], toIntent: () => NO_UI_EVENT_DECISION }),
      /** @returns {object} */
      validate: () => ({ valid: true, errors: [] }),
      /**
       * @param {object} context
       * @returns {object}
       */
      invalidate: (context) => buildInvalidationPatch('classe', { draft: context.draft }),
      /**
       * @param {object} context
       * @returns {object}
       */
      reduce: (context) => ok({ draft: context.draft, invalidation: { alguma: 'coisa' } }),
    });
    assert.equal(created.ok, true);
    const registry = createStepRegistry([created.value, ...CREATOR_STEP_IDS.slice(1).map((stepId) => passo(stepId))]);
    const draft = createCreatorDraft({});
    const session = createCreatorSession({ draft: draft.value, stepRegistry: registry.value });
    await session.initialize();
    const resultado = await session.dispatch(createCreatorIntent('teste/qualquer'));
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_STEP_INVALIDATE_SHAPE');
  });
});

describe('sessão do criador: render/validate não mutam', () => {
  test('o contexto entregue ao passo é congelado e recriado a cada chamada', async () => {
    const session = sessao();
    await session.initialize();
    const a = session.getStepContext('classe');
    const b = session.getStepContext('classe');
    assert.ok(Object.isFrozen(a));
    assert.notEqual(a, b, 'o contexto precisa ser novo a cada chamada');
    assert.throws(() => {
      a.draft = null;
    }, TypeError);
  });

  test('render e validate não alteram o snapshot', async () => {
    const session = sessao();
    await session.initialize();
    const antes = session.getSnapshot();
    const registry = createStepRegistry(CREATOR_STEP_IDS.map((stepId) => passo(stepId)));
    registry.value.get('classe').render(session.getStepContext('classe'));
    registry.value.get('classe').validate(session.getStepContext('classe'));
    assert.equal(session.getSnapshot(), antes);
  });
});

// ============================================================
// Composição COMMIT + REDUCE (Task 26, Decisão 1).
//
// Confirmar um modal precisa fazer três coisas no mesmo instante: commitar o
// que foi encenado, materializar as concessões da escolha nova e revogar as da
// escolha substituída. Antes desta task o `modal-commit` retornava antes de
// consultar o passo, então as duas últimas simplesmente não aconteciam —
// assimetria apply/revoke silenciosa. Estes casos fixam a composição.
// ============================================================

/**
 * Passo que registra o que recebeu no `reduce` e devolve rascunho/invalidação
 * controlados pelo teste.
 * @param {string} stepId
 * @param {{registro: Array<object>, falhar?: boolean, comInvalidacao?: boolean}} config
 * @returns {object}
 */
function passoDeCommit(stepId, { registro, falhar = false, comInvalidacao = true }) {
  const identitySlice = STEP_IDENTITY_SLICE[stepId];
  const created = createCreatorStep({
    id: stepId,
    /** @returns {Promise<object>} */
    async load() {
      return ok({ stepId });
    },
    /** @returns {string} */
    render: () => `<p>${stepId}</p>`,
    /** @returns {object} */
    bind: () => createStepBinding({ eventTypes: ['click'], toIntent: () => NO_UI_EVENT_DECISION }),
    /** @returns {object} */
    validate: () => ({ valid: true, errors: [] }),
    /**
     * @param {object} context
     * @returns {object}
     */
    invalidate: (context) => buildInvalidationPatch(stepId, { draft: context.draft }),
    /**
     * @param {object} context
     * @param {object} intent
     * @returns {object}
     */
    reduce(context, intent) {
      registro.push({ stepId, intent, draft: context.draft });
      if (falhar) {
        return err(createAppError({ code: 'REDUCE_FALHOU', scope: 'teste', message: 'falha proposital' }));
      }
      const patch = buildInvalidationPatch(stepId, { draft: context.draft });
      const next = withDraftSlices(context.draft, {
        slices: { [identitySlice]: { contentId: 'novo' } },
        provenance: { [identitySlice]: [`${stepId}#novo`] },
      });
      if (next.ok !== true) {
        return next;
      }
      return ok(comInvalidacao ? { draft: next.value, invalidation: patch.value } : { draft: next.value });
    },
  });
  assert.equal(created.ok, true, created.ok ? '' : created.error.code);
  return created.value;
}

/**
 * Sessão cujos sete passos registram as chamadas de `reduce`.
 * @param {object} config
 * @returns {object}
 */
function sessaoDeCommit(config) {
  const steps = CREATOR_STEP_IDS.map((stepId) => passoDeCommit(stepId, config));
  const registry = createStepRegistry(steps);
  assert.equal(registry.ok, true);
  const draft = createCreatorDraft({ slices: { walletChanges: { po: 7 }, manualInventoryChanges: [{ id: 'meu' }] } });
  assert.equal(draft.ok, true);
  return createCreatorSession({ draft: draft.value, stepRegistry: registry.value });
}

describe('sessão do criador: commit de transação consulta o reduce do passo', () => {
  test('o commit chama `reduce` UMA vez, com a intenção sintética e o rascunho JÁ commitado', async () => {
    const registro = [];
    const session = sessaoDeCommit({ registro });
    await session.initialize();

    await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalBegin, { transactionId: 't1' }));
    await session.dispatch(
      createCreatorIntent(CREATOR_INTENT_TYPES.modalUpdate, { transactionId: 't1', slices: { classChoices: { a: ['b'] } } }),
    );
    assert.deepEqual(registro, [], 'encenar não pode chamar reduce');

    const commit = await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalCommit, { transactionId: 't1' }));
    assert.equal(commit.ok, true, commit.ok ? '' : commit.error.code);
    assert.equal(registro.length, 1);
    assert.equal(registro[0].intent.type, 'creator/transaction-committed');
    assert.equal(registro[0].intent.transactionId, 't1');
    assert.deepEqual(registro[0].draft.slices.classChoices, { a: ['b'] }, 'o reduce vê o rascunho já commitado');
    session.dispose();
  });

  test('cancelar NÃO chama `reduce` e não muda o rascunho', async () => {
    const registro = [];
    const session = sessaoDeCommit({ registro });
    await session.initialize();
    const antes = session.getSnapshot().draft;

    await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalBegin, { transactionId: 't1' }));
    await session.dispatch(
      createCreatorIntent(CREATOR_INTENT_TYPES.modalUpdate, { transactionId: 't1', slices: { classChoices: { a: ['b'] } } }),
    );
    const cancel = await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalCancel, { transactionId: 't1' }));

    assert.equal(cancel.ok, true);
    assert.deepEqual(registro, []);
    assert.equal(session.getSnapshot().draft, antes, 'o rascunho é o MESMO objeto');
    session.dispose();
  });

  test('a invalidação devolvida pelo reduce é aplicada, preservando o que a ação escreveu', async () => {
    const registro = [];
    const session = sessaoDeCommit({ registro });
    await session.initialize();
    await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalBegin, { transactionId: 't1' }));
    await session.dispatch(
      createCreatorIntent(CREATOR_INTENT_TYPES.modalUpdate, { transactionId: 't1', slices: { classChoices: { a: ['b'] } } }),
    );
    await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalCommit, { transactionId: 't1' }));

    const draft = session.getSnapshot().draft;
    // O que a ação escreveu (a escolha encenada e a identidade do reduce)
    // sobrevive à matriz, que limparia `classChoices`/`classSelection`.
    assert.deepEqual(draft.slices.classChoices, { a: ['b'] });
    assert.deepEqual(draft.slices.classSelection, { contentId: 'novo' });
    // E as fatias do JOGADOR nunca são tocadas.
    assert.deepEqual(draft.slices.walletChanges, { po: 7 });
    assert.deepEqual(draft.slices.manualInventoryChanges, [{ id: 'meu' }]);
    session.dispose();
  });

  test('se o reduce FALHA, o commit é desfeito: nada de meia escolha gravada', async () => {
    const registro = [];
    const session = sessaoDeCommit({ registro, falhar: true });
    await session.initialize();
    const antes = session.getSnapshot().draft;

    await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalBegin, { transactionId: 't1' }));
    await session.dispatch(
      createCreatorIntent(CREATOR_INTENT_TYPES.modalUpdate, { transactionId: 't1', slices: { classChoices: { a: ['b'] } } }),
    );
    const commit = await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalCommit, { transactionId: 't1' }));

    assert.equal(commit.ok, false);
    assert.equal(commit.error.code, 'REDUCE_FALHOU');
    assert.equal(session.getSnapshot().draft, antes, 'o rascunho voltou a ser exatamente o de antes do commit');
    session.dispose();
  });

  test('um passo SEM reduce continua funcionando: commit grava o encenado e pronto', async () => {
    const steps = CREATOR_STEP_IDS.map((stepId) => passo(stepId));
    const registry = createStepRegistry(steps);
    const draft = createCreatorDraft({});
    const session = createCreatorSession({ draft: draft.value, stepRegistry: registry.value });
    await session.initialize();

    await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalBegin, { transactionId: 't1' }));
    await session.dispatch(
      createCreatorIntent(CREATOR_INTENT_TYPES.modalUpdate, { transactionId: 't1', slices: { classSkills: ['x'] } }),
    );
    const commit = await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalCommit, { transactionId: 't1' }));

    assert.equal(commit.ok, true, commit.ok ? '' : commit.error.code);
    assert.deepEqual(session.getSnapshot().draft.slices.classSkills, ['x']);
    session.dispose();
  });
});

describe('sessão do criador: a intenção sintética de pós-commit NÃO é entrada', () => {
  test('despachar `creator/transaction-committed` direto é RECUSADO, sem transação e sem reduce', async () => {
    // Sem esta recusa, qualquer chamador de `dispatch` pulava o mecanismo
    // inteiro de modal/transação: a intenção caía no `default` do dispatcher e
    // ia direto ao `reduce`, aplicando a seleção sem nenhum `begin`/`commit`.
    const registro = [];
    const session = sessaoDeCommit({ registro });
    await session.initialize();
    const antes = session.getSnapshot().draft;

    const resultado = await session.dispatch({
      type: 'creator/transaction-committed',
      transactionId: 'creator:classe:dnd2024:class:mago',
    });

    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_INTENT_NOT_DISPATCHABLE');
    assert.deepEqual(registro, [], 'o reduce não pode ter sido alcançado');
    assert.equal(session.getSnapshot().draft, antes, 'nada foi aplicado');
    assert.deepEqual([...session.getSnapshot().pendingTransactionIds], []);
    session.dispose();
  });

  test('a recusa vale mesmo com uma transação legitimamente aberta', async () => {
    const registro = [];
    const session = sessaoDeCommit({ registro });
    await session.initialize();
    await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalBegin, { transactionId: 't1' }));

    const resultado = await session.dispatch({ type: 'creator/transaction-committed', transactionId: 't1' });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_INTENT_NOT_DISPATCHABLE');
    assert.deepEqual(registro, []);
    session.dispose();
  });
});

describe('sessão do criador: rollback do commit deixa estado e UI consistentes', () => {
  test('falha do reduce publica o estado restaurado e mantém a transação utilizável', async () => {
    const registro = [];
    const session = sessaoDeCommit({ registro, falhar: true });
    await session.initialize();
    const antes = session.getSnapshot().draft;
    const publicados = [];
    session.subscribe((snapshot) => publicados.push(snapshot));

    await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalBegin, { transactionId: 't1' }));
    await session.dispatch(
      createCreatorIntent(CREATOR_INTENT_TYPES.modalUpdate, { transactionId: 't1', slices: { classChoices: { a: ['b'] } } }),
    );
    const antesDaFalha = publicados.length;
    const commit = await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalCommit, { transactionId: 't1' }));

    assert.equal(commit.ok, false);
    assert.equal(commit.error.code, 'REDUCE_FALHOU');

    // (a) o estado restaurado foi PUBLICADO — ninguém observa o meio da falha.
    assert.ok(publicados.length > antesDaFalha, 'a falha precisa notificar os inscritos');
    const snapshot = session.getSnapshot();
    assert.equal(snapshot.draft, antes, 'o rascunho voltou a ser exatamente o de antes do commit');
    // (b) a validação foi recomputada sobre o estado restaurado.
    assert.notEqual(snapshot.validation, null);
    // (c) o snapshot não anuncia uma transação inexistente: ela foi reaberta,
    // então cancelar e reconfirmar continuam funcionando (era aqui que o
    // usuário ficava com um modal cujos dois botões erravam).
    assert.deepEqual([...snapshot.pendingTransactionIds], ['t1']);
    const cancelamento = await session.dispatch(createCreatorIntent(CREATOR_INTENT_TYPES.modalCancel, { transactionId: 't1' }));
    assert.equal(cancelamento.ok, true, cancelamento.ok ? '' : cancelamento.error.code);
    assert.deepEqual([...session.getSnapshot().pendingTransactionIds], []);
    session.dispose();
  });
});
