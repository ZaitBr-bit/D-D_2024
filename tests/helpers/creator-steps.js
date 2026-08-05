// Helper de testes dos passos de conteúdo do criador (Task 26).
//
// Monta o catálogo OFICIAL de verdade (o mesmo `dados/pacotes/dnd2024` que a
// página carrega, lido do disco por `createDiskFetch`) e um registro de passos
// com os três passos REAIS mais os quatro placeholders que ainda faltam
// migrar. Nada aqui usa uma fixture reduzida de uma classe só: o ponto destes
// testes é justamente exercitar todas as classes/espécies/antecedentes do
// pacote.

import { createAppContext } from '../../site/js/app-context.js';
import { createDiskFetch } from './disk-fetch.js';
import { deriveSourceInstanceId, qualifiedChoiceKey } from '../../site/js/domain/effects/collect-effects.js';
import { createEmptyCharacter } from '../../site/js/domain/character/model.js';
import { createCreatorDraft } from '../../site/js/features/creator/creator-state.js';
import { CREATOR_STEP_IDS } from '../../site/js/features/creator/creator-state.js';
import { buildRealCreatorSteps } from '../../site/js/features/creator/steps/index.js';
import { createStepRegistry } from '../../site/js/features/creator/steps/step-registry.js';
import { createPlaceholderStep } from '../e2e/harness/placeholder-creator-step.js';

/** Referência de ruleset do pacote oficial (manifesto `dados/pacotes/dnd2024`). */
export const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

/** IDs dos passos de CONTEÚDO migrados na Task 26. */
export const CONTENT_STEP_IDS = Object.freeze(['classe', 'especie', 'antecedente']);

/**
 * RNG DETERMINÍSTICO de teste: percorre uma sequência fixa de valores em
 * `[0, 1)`, ciclicamente. É o que permite afirmar o resultado exato de uma
 * rolagem 4d6 sem depender de `Math.random()`.
 * @param {ReadonlyArray<number>} values
 * @returns {{next: () => number, calls: () => number}}
 */
export function sequenceRng(values) {
  let index = 0;
  return {
    /** @returns {number} */
    next() {
      const value = values[index % values.length];
      index += 1;
      return value;
    },
    /** @returns {number} */
    calls() {
      return index;
    },
  };
}

/**
 * RNG que devolve sempre a mesma face de d6 (`face` de 1 a 6).
 * @param {number} face
 * @returns {{next: () => number}}
 */
export function fixedFaceRng(face) {
  return sequenceRng([(face - 1) / 6 + 0.01]);
}

/**
 * `sourceInstanceId` de uma seleção — a MESMA derivação do motor de efeitos.
 * @param {string} collection - `class` | `species` | `background`
 * @param {string} contentId
 * @returns {string}
 */
export function sourceIdOf(collection, contentId) {
  return deriveSourceInstanceId({ collection, index: 0, key: contentId });
}

/**
 * Converte `{choiceId: [optionId...]}` no mapa QUALIFICADO que as fatias de
 * escolha guardam (`{"<sourceInstanceId>:<choiceId>": [...]}`).
 *
 * Existe porque a chave nua NÃO identifica uma escolha: o catálogo repete
 * `choiceId` entre entidades (`equipamento-inicial` nas 12 classes e nos 16
 * antecedentes). Um teste que montasse a fatia com a chave nua estaria testando
 * um formato que a produção não usa mais.
 * @param {string} collection
 * @param {string} contentId
 * @param {object} picks
 * @returns {object}
 */
export function qualifiedPicks(collection, contentId, picks) {
  const sourceInstanceId = sourceIdOf(collection, contentId);
  return Object.fromEntries(
    Object.entries(picks).map(([choiceId, value]) => [qualifiedChoiceKey(sourceInstanceId, choiceId), value]),
  );
}

let registryPromise = null;

/**
 * Ativa (uma única vez por processo) o catálogo oficial a partir do disco.
 * @returns {Promise<object>} ContentRegistry
 */
export async function officialRegistry() {
  if (registryPromise === null) {
    registryPromise = createAppContext({ fetchFn: createDiskFetch().fetchFn })
      .initializeContent()
      .then((resultado) => {
        if (resultado.ok !== true) {
          throw new Error(`catálogo oficial não ativou: ${resultado.error.code}`);
        }
        return resultado.value;
      });
  }
  return registryPromise;
}

/**
 * Cria um personagem canônico vazio para servir de base do rascunho.
 * @param {{id?: string, level?: number}} [params]
 * @returns {object} CanonicalCharacter
 */
export function emptyCharacter({ id = 'test-test-test', level = 1 } = {}) {
  const character = createEmptyCharacter({ id, now: '2026-01-01T00:00:00.000Z', rulesetRef: RULESET_REF });
  if (level === character.state.level) {
    return character;
  }
  return { ...character, state: { ...character.state, level } };
}

/**
 * Cria um rascunho com personagem canônico.
 * @param {{level?: number, slices?: object, provenance?: object}} [params]
 * @returns {object} draft
 */
export function draftWithCharacter({ level = 1, slices = {}, provenance = {} } = {}) {
  const created = createCreatorDraft({ character: emptyCharacter({ level }), slices, provenance });
  if (created.ok !== true) {
    throw new Error(`rascunho inválido: ${created.error.code}`);
  }
  return created.value;
}

/**
 * Registro com os três passos reais e os quatro placeholders restantes.
 * @returns {object} StepRegistry
 */
export function fullStepRegistry() {
  const reais = buildRealCreatorSteps();
  if (reais.ok !== true) {
    throw new Error(`passos reais não construíram: ${reais.error.code}`);
  }
  const steps = [...reais.value];
  for (const stepId of CREATOR_STEP_IDS) {
    if (steps.some((step) => step.id === stepId)) {
      continue;
    }
    const placeholder = createPlaceholderStep(stepId, { options: [{ id: 'x', name: 'X' }] });
    if (placeholder.ok !== true) {
      throw new Error(`placeholder inválido: ${placeholder.error.code}`);
    }
    steps.push(placeholder.value);
  }
  const registry = createStepRegistry(steps);
  if (registry.ok !== true) {
    throw new Error(`registro inválido: ${registry.error.code}`);
  }
  return registry.value;
}

/**
 * Contexto de passo mínimo para exercitar `load`/`render`/`validate`/`reduce`
 * fora de uma sessão.
 * @param {{stepId: string, draft: object, data?: object|null, registry: object, root?: object|null, staged?: object|null, rng?: object|null, rules?: object|null}} params
 * @returns {Readonly<object>}
 */
export function stepContext({ stepId, draft, data = null, registry, root = null, staged = null, rng = null, rules = null }) {
  return Object.freeze({
    stepId,
    draft,
    data,
    registry,
    rules,
    rng,
    clock: null,
    root,
    signal: null,
    transaction: Object.freeze({
      /**
       * @param {string} id
       * @returns {object}
       */
      getStaged(id) {
        return staged === null ? { ok: false, error: { code: 'CREATOR_TRANSACTION_NOT_OPEN' } } : { ok: true, value: { id, slices: staged, provenance: {} } };
      },
      /** @returns {ReadonlyArray<string>} */
      getOpenTransactionIds() {
        return Object.freeze([]);
      },
    }),
  });
}

/**
 * Carrega o step data de um passo e devolve `{step, data, context}`.
 * @param {object} stepRegistry
 * @param {string} stepId
 * @param {object} draft
 * @param {object} registry
 * @returns {Promise<object>}
 */
export async function loadStepData(stepRegistry, stepId, draft, registry) {
  const step = stepRegistry.get(stepId);
  const loaded = await step.load(stepContext({ stepId, draft, registry }));
  if (loaded.ok !== true) {
    throw new Error(`load de "${stepId}" falhou: ${loaded.error.code}`);
  }
  return { step, data: loaded.value };
}
