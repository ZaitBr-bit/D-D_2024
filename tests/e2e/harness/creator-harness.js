// Harness do criador NOVO: monta `mountCreator` + `CreatorSession` numa página
// própria servida só de `tests/e2e/harness`.
//
// Por que um harness em vez de montar na rota real: até a Task 28 o criador
// público continua sendo o monólito legado (`site/js/pages/creator.js`), que
// esta task não toca. O harness dá um navegador REAL para exercitar a
// arquitetura nova (delegação de evento, transação de modal, escape do
// `render`) sem cutover — e some quando o cutover acontecer.
//
// Desde a Task 27 os CINCO primeiros passos são os REAIS (`classe`, `especie`,
// `antecedente`, `atributos`, `equipamento`), montados sobre o catálogo oficial
// carregado pelo composition root de verdade; `magias`/`detalhes` continuam
// placeholders até a Task 28. Nenhum arquivo daqui é publicado no artifact do
// Pages.
//
// O `rng` da sessão é INJETADO aqui (sequência fixa), para que a rolagem 4d6 do
// passo de atributos seja determinística no navegador — o passo recusa rolar sem
// RNG, e nenhum caminho cai em `Math.random()`.

import { createAppContext } from '../../../site/js/app-context.js';
import { createCreatorSession } from '../../../site/js/features/creator/creator-session.js';
import { mountCreator } from '../../../site/js/features/creator/creator-controller.js';
import { createStepRegistry } from '../../../site/js/features/creator/steps/step-registry.js';
import { buildRealCreatorSteps } from '../../../site/js/features/creator/steps/index.js';
import { CREATOR_STEP_IDS, createCreatorDraft } from '../../../site/js/features/creator/creator-state.js';
import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import { createModalService } from '../../../site/js/ui/modal.js';
import { createPlaceholderStep } from './placeholder-creator-step.js';

const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

/**
 * Opções de conteúdo do harness. Podem ser sobrescritas por
 * `window.__harnessOptions` antes do carregamento do módulo.
 * @returns {object}
 */
function harnessOptions() {
  const provided = globalThis.__harnessOptions;
  return provided !== null && typeof provided === 'object' ? provided : {};
}

/** @type {Promise<object>|null} */
let registryPromise = null;

/**
 * Ativa o catálogo oficial UMA vez por página, pelo composition root real.
 * @returns {Promise<object>} ContentRegistry
 */
async function officialRegistry() {
  if (registryPromise === null) {
    registryPromise = createAppContext()
      .initializeContent()
      .then((resultado) => {
        if (resultado.ok !== true) {
          throw new Error(`harness: catálogo não ativou: ${resultado.error.code}`);
        }
        return resultado.value;
      });
  }
  return registryPromise;
}

/**
 * Envolve o catálogo real substituindo as entidades dos três tipos por
 * fixtures HOSTIS. É assim que o spec faz conteúdo malicioso atravessar o
 * `render` dos passos REAIS, e não só o de um placeholder.
 * @param {object} registry
 * @param {ReadonlyArray<object>} payloads
 * @returns {object}
 */
function hostileRegistry(registry, payloads) {
  const porTipo = new Map();
  for (const type of ['class', 'species', 'background']) {
    porTipo.set(
      type,
      payloads.map((payload, indice) => ({
        id: `dnd2024:${type}:hostil-${indice}`,
        type,
        name: payload.name,
        description: payload.description,
        hitDie: payload.name,
        primaryAbility: [],
        legacyPresentation: {
          tracos: [{ nome: payload.name }],
          ferramentas: payload.name,
          tracos_basicos: { 'Atributo Primário': payload.description },
        },
        effects: [],
      })),
    );
  }
  return {
    /**
     * @param {string} type
     * @returns {ReadonlyArray<object>}
     */
    list(type) {
      return porTipo.get(type) ?? registry.list(type);
    },
    /**
     * @param {*} reference
     * @param {string} [expectedType]
     * @returns {object}
     */
    resolve(reference, expectedType) {
      for (const entidades of porTipo.values()) {
        const encontrada = entidades.find((entidade) => entidade.id === reference);
        if (encontrada !== undefined) {
          return { ok: true, value: encontrada };
        }
      }
      return registry.resolve(reference, expectedType);
    },
    /**
     * @param {string} id
     * @returns {object|null}
     */
    get(id) {
      return registry.get(id);
    },
  };
}

/**
 * Monta o serviço de modal sobre o markup da página do harness.
 * @returns {object}
 */
function buildModalService() {
  return createModalService({
    documentRef: document,
    overlay: document.getElementById('modal-overlay'),
    container: document.getElementById('modal-container'),
    titleElement: document.getElementById('modal-titulo'),
    bodyElement: document.getElementById('modal-corpo'),
    actionsElement: document.getElementById('modal-acoes'),
    closeButton: document.getElementById('modal-fechar'),
  });
}

/**
 * Monta o registro: os cinco passos REAIS mais os dois placeholders que ainda
 * não foram migrados.
 * @param {object} config
 * @returns {object} StepRegistry
 */
function buildStepRegistry(config) {
  const reais = buildRealCreatorSteps();
  if (reais.ok !== true) {
    throw new Error(`harness: passos reais inválidos: ${reais.error.code}`);
  }
  const steps = [...reais.value];
  for (const stepId of CREATOR_STEP_IDS) {
    if (steps.some((step) => step.id === stepId)) {
      continue;
    }
    const created = createPlaceholderStep(stepId, {
      options: config.optionsByStep?.[stepId] ?? config.options ?? [],
      requireSelection: config.requireSelection !== false,
      loadDelay: config.loadDelay ?? 0,
    });
    if (created.ok !== true) {
      throw new Error(`harness: passo "${stepId}" inválido: ${created.error.code}`);
    }
    steps.push(created.value);
  }
  const registryResult = createStepRegistry(steps);
  if (registryResult.ok !== true) {
    throw new Error(`harness: registro inválido: ${registryResult.error.code}`);
  }
  return registryResult.value;
}

/**
 * RNG DETERMINÍSTICO do harness: percorre ciclicamente uma sequência fixa de
 * valores em `[0, 1)`. O padrão produz as faces 6, 1, 4, 5 — que, com o descarte
 * do menor dado, dão 15 em todo atributo rolado.
 * @param {ReadonlyArray<number>} [sequence]
 * @returns {{next: () => number}}
 */
function createHarnessRng(sequence) {
  const valores = Array.isArray(sequence) && sequence.length > 0 ? sequence : [5 / 6 + 0.01, 0.01, 3 / 6 + 0.01, 4 / 6 + 0.01];
  let indice = 0;
  return {
    /** @returns {number} */
    next() {
      const valor = valores[indice % valores.length];
      indice += 1;
      return valor;
    },
  };
}

/**
 * Monta uma sessão + controller no container indicado.
 * @param {{container: object, options?: object}} params
 * @returns {Promise<object>} `{session, dispose}`
 */
export async function mountHarness({ container, options = {} }) {
  const config = { ...harnessOptions(), ...options };
  const base = await officialRegistry();
  const registry = Array.isArray(config.hostilePayloads) ? hostileRegistry(base, config.hostilePayloads) : base;
  const stepRegistry = buildStepRegistry(config);

  const draftResult = createCreatorDraft({
    character: createEmptyCharacter({
      id: config.characterId ?? 'harn-ess0-0001',
      now: '2026-01-01T00:00:00.000Z',
      rulesetRef: RULESET_REF,
    }),
  });
  if (draftResult.ok !== true) {
    throw new Error(`harness: rascunho inválido: ${draftResult.error.code}`);
  }

  const session = createCreatorSession({
    draft: draftResult.value,
    registry,
    stepRegistry,
    rng: createHarnessRng(config.rngSequence),
  });

  const mounted = await mountCreator({
    container,
    session,
    stepRegistry,
    modal: buildModalService(),
    moduleName: 'features/creator (harness)',
  });
  if (mounted.ok !== true) {
    throw new Error(`harness: mount falhou: ${mounted.error.code}`);
  }
  return { session, dispose: mounted.value };
}

// --- API exposta ao Playwright ------------------------------------------
//
// Duas montagens SIMULTÂNEAS, em containers distintos, para que o spec possa
// provar no navegador real o que os testes de nó provam em memória: nada
// vaza entre sessões.
globalThis.__creatorHarness = {
  mountHarness,
  /** @type {Array<{session: object, dispose: Function}>} */
  mounted: [],
  /**
   * Monta as duas sessões do harness.
   * @param {object} [options]
   * @returns {Promise<void>}
   */
  async start(options = {}) {
    for (const id of ['creator-a', 'creator-b']) {
      const mounted = await mountHarness({ container: document.getElementById(id), options });
      globalThis.__creatorHarness.mounted.push(mounted);
    }
    document.body.setAttribute('data-harness-ready', 'true');
  },
  /**
   * Descarta tudo (para testar o disposer).
   * @returns {void}
   */
  disposeAll() {
    for (const entry of globalThis.__creatorHarness.mounted) {
      entry.dispose();
    }
    globalThis.__creatorHarness.mounted = [];
    document.body.setAttribute('data-harness-disposed', 'true');
  },
};
