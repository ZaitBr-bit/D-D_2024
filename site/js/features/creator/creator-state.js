// Módulo `features/creator/creator-state`: o VOCABULÁRIO de estado do criador
// de personagens — os sete passos, as fatias do rascunho, o rascunho em si e o
// `CreatorSnapshot` congelado que a sessão publica.
//
// Este módulo é deliberadamente PURO: nenhum DOM, nenhuma rede, nenhum
// storage. Ele só define formatos e transformações imutáveis, para que a
// matriz de invalidação (`creator-invalidation.js`) e a sessão
// (`creator-session.js`) possam ser testadas sem navegador.
//
// ## Por que "fatia" (slice) é um conceito de primeira classe
//
// O criador legado (`site/js/pages/creator.js`) limpa dados por EFEITO
// COLATERAL: um `switch (stepId)` que apaga campos soltos do objeto
// `personagem` e chaves soltas de um `dadosCache` global. Duas consequências
// ruins: (a) não há como perguntar "o que este passo limpa?" sem ler o corpo
// da função, e (b) o que NÃO é limpo é um silêncio — ninguém declara que os
// itens comprados manualmente pelo jogador deveriam sobreviver, eles apenas
// por acaso não aparecem no `switch`.
//
// Aqui cada pedaço nomeado do rascunho é uma FATIA, e toda invalidação
// classifica TODAS as fatias em "limpa" ou "preserva" — nunca deixa nenhuma
// de fora. A preservação vira uma decisão positiva e verificável.
//
// ## Proveniência
//
// Cada fatia carrega, em `draft.provenance[slice]`, exatamente os
// `sourceInstanceId`s que `applyGrantEffects` (Task 15) usou ao materializar
// as concessões daquela fatia. É esse array — e nenhum ID novo inventado aqui
// — que alimenta `revokeGrantEffects`, garantindo que a revogação seja o
// inverso EXATO da aplicação.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';

const SCOPE = 'features.creator.state';

/**
 * Os sete passos do criador, na ordem em que aparecem no wizard. Os IDs são
 * exatamente os do wizard legado (`site/js/pages/creator.js`), para que a
 * paridade de comportamento possa ser comparada passo a passo.
 * @type {ReadonlyArray<string>}
 */
export const CREATOR_STEP_IDS = Object.freeze([
  'classe',
  'especie',
  'antecedente',
  'atributos',
  'equipamento',
  'magias',
  'detalhes',
]);

const STEP_ID_SET = new Set(CREATOR_STEP_IDS);

/**
 * Todas as fatias nomeadas do rascunho. Esta lista é FECHADA: a matriz de
 * invalidação exige que toda fatia daqui apareça em `clearedSlices` ou em
 * `preservedSlices` de cada passo, o que torna impossível "esquecer" uma.
 * @type {ReadonlyArray<string>}
 */
export const CREATOR_DRAFT_SLICES = Object.freeze([
  // --- Passo `classe` ---
  'classSelection',
  'classChoices',
  'classSkills',
  'classResources',
  'progression',
  // --- Passo `especie` ---
  'speciesSelection',
  'speciesChoices',
  // --- Passo `antecedente` ---
  'backgroundSelection',
  'backgroundAbilityBonus',
  'backgroundSkills',
  'backgroundToolProficiency',
  'backgroundFeat',
  'backgroundEquipmentSelection',
  // --- Passo `atributos` ---
  'abilityScores',
  'derivedStats',
  // --- Passo `equipamento` ---
  'startingEquipmentSelection',
  'startingCurrencyGrant',
  // --- Passo `magias` ---
  'spellSelection',
  // --- Passo `detalhes` ---
  'details',
  // --- Fatias do JOGADOR, de nenhum passo ---
  //
  // Itens e moedas que o jogador acrescentou à mão. Não pertencem a passo
  // nenhum e, por isso, nenhum passo pode limpá-las: sobrevivem inclusive a
  // uma troca completa de classe. A matriz de invalidação verifica isso.
  'manualInventoryChanges',
  'walletChanges',
]);

const SLICE_SET = new Set(CREATOR_DRAFT_SLICES);

/**
 * Fatias que pertencem ao JOGADOR e nunca a um passo. Nenhuma entrada da
 * matriz de invalidação pode limpá-las.
 * @type {ReadonlyArray<string>}
 */
export const PLAYER_OWNED_SLICES = Object.freeze(['manualInventoryChanges', 'walletChanges']);

/**
 * Estados possíveis de uma sessão do criador.
 * @type {Readonly<Record<string, string>>}
 */
export const CREATOR_STATUS = Object.freeze({
  idle: 'idle',
  loading: 'loading',
  ready: 'ready',
  error: 'error',
});

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
export function creatorStateError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Diz se `id` é um dos sete IDs de passo do criador.
 * @param {*} id
 * @returns {boolean}
 */
export function isCreatorStepId(id) {
  return typeof id === 'string' && STEP_ID_SET.has(id);
}

/**
 * Diz se `name` é uma fatia conhecida do rascunho.
 * @param {*} name
 * @returns {boolean}
 */
export function isCreatorDraftSlice(name) {
  return typeof name === 'string' && SLICE_SET.has(name);
}

/**
 * Índice de um passo na ordem do wizard, ou `-1`.
 * @param {*} id
 * @returns {number}
 */
export function creatorStepIndex(id) {
  return CREATOR_STEP_IDS.indexOf(id);
}

/**
 * Congela `value` recursivamente (objetos simples e arrays), cortando ciclos.
 * Só é usado sobre estruturas CRIADAS aqui ou entregues explicitamente à
 * sessão como rascunho — nunca sobre o grafo de outro módulo.
 * @param {*} value
 * @param {WeakSet<object>} [seen]
 * @returns {*}
 */
export function deepFreezeValue(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return value;
  }
  seen.add(value);
  Object.freeze(value);
  for (const key of Object.keys(value)) {
    deepFreezeValue(value[key], seen);
  }
  return value;
}

/**
 * Cria um rascunho do criador já congelado.
 *
 * Uma fatia AUSENTE é representada por `null` explícito (nunca por um valor
 * de jogo plausível inventado aqui) e toda fatia conhecida existe no objeto,
 * para que "não escolhido" seja um fato observável e não a ausência da chave.
 *
 * @param {{character?: object|null, slices?: object, provenance?: object}} [params]
 * @returns {import('../../core/result.js').Result} `ok(draft)`
 */
export function createCreatorDraft(params = {}) {
  const { character = null, slices = {}, provenance = {} } = params ?? {};
  if (slices === null || typeof slices !== 'object' || Array.isArray(slices)) {
    return err(creatorStateError('CREATOR_DRAFT_SLICES_INVALID', '"slices" deve ser um objeto simples.'));
  }
  if (provenance === null || typeof provenance !== 'object' || Array.isArray(provenance)) {
    return err(creatorStateError('CREATOR_DRAFT_PROVENANCE_INVALID', '"provenance" deve ser um objeto simples.'));
  }

  for (const name of Object.keys(slices)) {
    if (!isCreatorDraftSlice(name)) {
      return err(
        creatorStateError('CREATOR_DRAFT_SLICE_UNKNOWN', `A fatia "${name}" não faz parte do rascunho do criador.`, {
          slice: name,
        }),
      );
    }
  }
  for (const name of Object.keys(provenance)) {
    if (!isCreatorDraftSlice(name)) {
      return err(
        creatorStateError('CREATOR_DRAFT_SLICE_UNKNOWN', `A proveniência cita a fatia desconhecida "${name}".`, {
          slice: name,
        }),
      );
    }
    const ids = provenance[name];
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || id.length === 0)) {
      return err(
        creatorStateError(
          'CREATOR_DRAFT_PROVENANCE_INVALID',
          `A proveniência da fatia "${name}" deve ser um array de sourceInstanceId não vazios.`,
          { slice: name },
        ),
      );
    }
  }

  const nextSlices = {};
  const nextProvenance = {};
  for (const name of CREATOR_DRAFT_SLICES) {
    nextSlices[name] = Object.prototype.hasOwnProperty.call(slices, name) ? slices[name] : null;
    nextProvenance[name] = Object.freeze([
      ...(Object.prototype.hasOwnProperty.call(provenance, name) ? provenance[name] : []),
    ]);
  }

  const draft = { character, slices: nextSlices, provenance: nextProvenance };
  // Congelamos as estruturas que CRIAMOS. `character` vem do chamador: é
  // congelado junto porque o rascunho é imutável por contrato, e a sessão
  // sempre substitui o objeto inteiro em vez de mutá-lo.
  deepFreezeValue(nextSlices);
  deepFreezeValue(nextProvenance);
  Object.freeze(draft);
  return ok(draft);
}

/**
 * Devolve um NOVO rascunho com as fatias de `patch` substituídas. Nunca muta
 * o rascunho recebido.
 * @param {object} draft
 * @param {{character?: object|null, slices?: object, provenance?: object}} patch
 * @returns {import('../../core/result.js').Result} `ok(draft)`
 */
export function withDraftSlices(draft, patch = {}) {
  if (draft === null || typeof draft !== 'object') {
    return err(creatorStateError('CREATOR_DRAFT_INVALID', 'O rascunho deve ser um objeto.'));
  }
  const slices = { ...draft.slices, ...(patch.slices ?? {}) };
  const provenance = { ...draft.provenance, ...(patch.provenance ?? {}) };
  const character = Object.prototype.hasOwnProperty.call(patch, 'character') ? patch.character : draft.character;
  return createCreatorDraft({ character, slices, provenance });
}

/**
 * Cria um `CreatorSnapshot` congelado — a ÚNICA forma pela qual a sessão
 * expõe seu estado. Um snapshot nunca muda depois de criado: cada transição
 * publica um objeto novo, de modo que um consumidor que guardou o anterior
 * continua vendo o passado consistente em vez de um objeto meio atualizado.
 *
 * @param {{
 *   currentStepId: string,
 *   visitedStepIds?: ReadonlyArray<string>,
 *   status?: string,
 *   draft: object,
 *   stepData?: object,
 *   validation?: object|null,
 *   generation?: number,
 *   error?: object|null,
 *   pendingTransactionIds?: ReadonlyArray<string>
 * }} params
 * @returns {Readonly<object>}
 */
export function createCreatorSnapshot(params) {
  const {
    currentStepId,
    visitedStepIds = [],
    status = CREATOR_STATUS.idle,
    draft,
    stepData = {},
    validation = null,
    generation = 0,
    error = null,
    pendingTransactionIds = [],
  } = params ?? {};

  if (!isCreatorStepId(currentStepId)) {
    throw new TypeError(`createCreatorSnapshot: "currentStepId" inválido: ${String(currentStepId)}.`);
  }

  const snapshot = {
    currentStepId,
    stepIds: CREATOR_STEP_IDS,
    visitedStepIds: Object.freeze([...visitedStepIds]),
    status,
    draft,
    stepData: Object.freeze({ ...stepData }),
    validation,
    generation,
    error,
    pendingTransactionIds: Object.freeze([...pendingTransactionIds]),
  };
  return Object.freeze(snapshot);
}
