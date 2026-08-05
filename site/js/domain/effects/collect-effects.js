// Módulo `domain/effects/collect-effects`: percorre as fontes de efeito de um
// personagem canônico v2 e devolve a lista PLANA e ORDENADA de efeitos ativos,
// cada um envelopado com sua proveniência determinística e seu grupo de
// precedência.
//
// ## Os quatro grupos de precedência
//
// A ordem é fixa e fechada (`PRECEDENCE_GROUPS`):
//
//   1. `base`       — o ruleset (valores de partida do sistema);
//   2. `progression` — classe, subclasse, espécie, antecedente, talentos e as
//                      features concedidas por eles;
//   3. `equipment`   — itens EQUIPADOS e condições temporárias ativas;
//   4. `manual`      — `character.overrides` (edição manual do usuário).
//
// Grupos posteriores vencem grupos anteriores. Dentro de um grupo, vence a
// maior `priority`; empate de `priority` é desempatado pelo `effectInstanceId`
// (lexicográfico), que é determinístico — nunca pela ordem em que o array
// chegou.
//
// ## Proveniência determinística
//
// Mesma família de fórmula do `legacy:<collection>:<index>:<slug>` da Task 12:
//
//   sourceInstanceId = `source:<collection>:<index-4-dígitos>:<slug-do-id>`
//   effectInstanceId = `effect:<sourceInstanceId>:<index-4-dígitos>:<slug>`
//
// Nada de aleatoriedade: o mesmo personagem com o mesmo catálogo produz sempre
// os mesmos IDs, que é o que faz `applyGrantEffects` convergir em vez de
// duplicar a cada recomputo.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import {
  hasOwn,
  validateEffectSemantics,
  evaluateEffectCondition,
  effectPriority,
  effectStackKey,
  effectStackable,
  isAllowedTargetPath,
  isKnownSetTarget,
  isKnownSetOperation,
  setContributionForEffect,
} from './effect-predicates.js';

const SCOPE = 'domain.effects.collect';

// Ordem fixa dos grupos de precedência. O índice do array É a precedência.
export const PRECEDENCE_GROUPS = Object.freeze(['base', 'progression', 'equipment', 'manual']);
const GROUP_INDEX = new Map(PRECEDENCE_GROUPS.map((group, index) => [group, index]));

const PAD_WIDTH = 4;

// Métodos que o coletor exige do catálogo injetado.
const REQUIRED_REGISTRY_METHODS = Object.freeze(['resolve', 'list']);

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
function collectError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Normaliza um texto em slug determinístico (minúsculo, ASCII, kebab-case).
 * Mesma normalização de `infra/character/legacy-instance-id.js`, reimplementada
 * aqui porque `domain/**` não pode importar de `infra/**`.
 * @param {*} text
 * @returns {string}
 */
function slugify(text) {
  const stripped = String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return stripped.length > 0 ? stripped : 'item';
}

/**
 * Deriva o `sourceInstanceId` determinístico de uma fonte de efeitos.
 * @param {{collection: string, index?: number, key: string}} params
 * @returns {string}
 */
export function deriveSourceInstanceId({ collection, index = 0, key } = {}) {
  if (typeof collection !== 'string' || !/^[a-z][a-z-]*$/.test(collection)) {
    throw new TypeError('deriveSourceInstanceId: "collection" deve ser um slug ASCII minúsculo.');
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new TypeError('deriveSourceInstanceId: "index" deve ser um inteiro >= 0.');
  }
  return `source:${collection}:${String(index).padStart(PAD_WIDTH, '0')}:${slugify(key)}`;
}

/**
 * Deriva o `effectInstanceId` determinístico de um efeito dentro de uma fonte.
 * @param {{sourceInstanceId: string, index: number, key: string}} params
 * @returns {string}
 */
export function deriveEffectInstanceId({ sourceInstanceId, index, key } = {}) {
  if (typeof sourceInstanceId !== 'string' || sourceInstanceId.length === 0) {
    throw new TypeError('deriveEffectInstanceId: "sourceInstanceId" deve ser uma string não vazia.');
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new TypeError('deriveEffectInstanceId: "index" deve ser um inteiro >= 0.');
  }
  return `effect:${sourceInstanceId}:${String(index).padStart(PAD_WIDTH, '0')}:${slugify(key)}`;
}

/**
 * Confere que `group` é um dos quatro grupos fechados. Grupo inválido é
 * defeito de programação de quem monta o envelope, não conteúdo — por isso
 * lança.
 * @param {*} group
 * @returns {number} índice de precedência
 */
function requireGroupIndex(group) {
  if (!GROUP_INDEX.has(group)) {
    throw new TypeError(
      `createResolvedEffect: "group" deve ser um de ${PRECEDENCE_GROUPS.join(', ')} (recebido: ${String(group)}).`,
    );
  }
  return GROUP_INDEX.get(group);
}

/**
 * Envelopa um efeito bruto com grupo de precedência, `priority` efetiva,
 * empilhamento e proveniência determinística. O envelope é congelado.
 *
 * Também é a porta usada por tarefas posteriores (Task 16/17) para sintetizar
 * efeitos do grupo `manual` sem duplicar a lógica de ordenação.
 *
 * @param {{effect: object, group: string, sourceId?: string | null,
 *   sourceInstanceId: string, effectInstanceId: string, orderIndex?: number}} params
 * @returns {Readonly<object>} ResolvedEffect
 */
export function createResolvedEffect({
  effect,
  group,
  sourceId = null,
  sourceInstanceId,
  effectInstanceId,
  orderIndex = 0,
} = {}) {
  const groupIndex = requireGroupIndex(group);
  if (effect === null || typeof effect !== 'object' || Array.isArray(effect)) {
    throw new TypeError('createResolvedEffect: "effect" deve ser um objeto simples.');
  }
  for (const [name, value] of [
    ['sourceInstanceId', sourceInstanceId],
    ['effectInstanceId', effectInstanceId],
  ]) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError(`createResolvedEffect: "${name}" deve ser uma string não vazia.`);
    }
  }
  if (!Number.isInteger(orderIndex) || orderIndex < 0) {
    throw new TypeError('createResolvedEffect: "orderIndex" deve ser um inteiro >= 0.');
  }

  const contribution = setContributionForEffect(effect);
  return Object.freeze({
    effect,
    type: effect.type,
    group,
    groupIndex,
    priority: effectPriority(effect),
    stackKey: effectStackKey(effect),
    stackable: effectStackable(effect),
    sourceId,
    sourceInstanceId,
    effectInstanceId,
    orderIndex,
    setTarget: contribution === null ? null : contribution.setTarget,
    setOperation: contribution === null ? null : 'add-ids',
    ids: contribution === null ? null : contribution.ids,
  });
}

/**
 * Cria uma contribuição PURA de conjunto (`add-ids`/`remove-ids`/`replace-ids`)
 * sem um efeito de conteúdo por trás. É como o grupo `manual` expressa a
 * remoção de um ID concedido por um grupo de menor precedência — o vocabulário
 * de efeitos declarativos só sabe acrescentar.
 *
 * @param {{group: string, setTarget: string, setOperation: string,
 *   ids: ReadonlyArray<string>, priority?: number, stackKey?: string | null,
 *   stackable?: boolean, sourceInstanceId: string, effectInstanceId: string,
 *   orderIndex?: number}} params
 * @returns {Readonly<object>} ResolvedEffect (sem `effect`)
 */
export function createSetContribution({
  group,
  setTarget,
  setOperation,
  ids,
  priority = 0,
  stackKey = null,
  stackable = true,
  sourceInstanceId,
  effectInstanceId,
  orderIndex = 0,
} = {}) {
  const groupIndex = requireGroupIndex(group);
  if (!isKnownSetTarget(setTarget)) {
    throw new TypeError(`createSetContribution: "setTarget" desconhecido (${String(setTarget)}).`);
  }
  if (!isKnownSetOperation(setOperation)) {
    throw new TypeError(`createSetContribution: "setOperation" desconhecida (${String(setOperation)}).`);
  }
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || id.length === 0)) {
    throw new TypeError('createSetContribution: "ids" deve ser um array de strings não vazias.');
  }
  if (!Number.isSafeInteger(priority)) {
    throw new TypeError('createSetContribution: "priority" deve ser um inteiro.');
  }
  if (typeof stackable !== 'boolean') {
    throw new TypeError('createSetContribution: "stackable" deve ser boolean.');
  }
  if (stackable === false && (typeof stackKey !== 'string' || stackKey.length === 0)) {
    throw new TypeError('createSetContribution: "stackable": false exige "stackKey".');
  }
  for (const [name, value] of [
    ['sourceInstanceId', sourceInstanceId],
    ['effectInstanceId', effectInstanceId],
  ]) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError(`createSetContribution: "${name}" deve ser uma string não vazia.`);
    }
  }

  return Object.freeze({
    effect: null,
    type: null,
    group,
    groupIndex,
    priority,
    stackKey: typeof stackKey === 'string' && stackKey.length > 0 ? stackKey : null,
    stackable,
    sourceId: null,
    sourceInstanceId,
    effectInstanceId,
    orderIndex: Number.isInteger(orderIndex) && orderIndex >= 0 ? orderIndex : 0,
    setTarget,
    setOperation,
    ids: Object.freeze([...ids]),
  });
}

/**
 * Comparador estável dos ResolvedEffects: grupo, depois `priority` crescente
 * (a maior é aplicada por último), depois `effectInstanceId` como desempate
 * determinístico. NUNCA usa a posição no array de entrada.
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function compareResolvedEffects(a, b) {
  if (a.groupIndex !== b.groupIndex) {
    return a.groupIndex - b.groupIndex;
  }
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }
  if (a.effectInstanceId === b.effectInstanceId) {
    return 0;
  }
  return a.effectInstanceId < b.effectInstanceId ? -1 : 1;
}

/**
 * Ordena uma lista de ResolvedEffects sem mutar o array recebido.
 * @param {ReadonlyArray<object>} effects
 * @returns {Array<object>}
 */
export function sortResolvedEffects(effects) {
  return [...effects].sort(compareResolvedEffects);
}

/**
 * Filtra contribuições por `stackKey`: para cada `stackKey` cujas
 * contribuições declarem `stackable: false`, sobra APENAS a de maior
 * precedência (a última na ordem estável). A ausência de `stackKey` significa
 * "sempre acumula" e nunca é filtrada.
 *
 * Espera receber a lista JÁ ORDENADA por `compareResolvedEffects`.
 *
 * @param {ReadonlyArray<object>} sorted
 * @returns {Array<object>}
 */
export function filterByStackKey(sorted) {
  // Última posição vencedora de cada stackKey não acumulável.
  const winner = new Map();
  for (const [index, entry] of sorted.entries()) {
    if (entry.stackKey === null || entry.stackable !== false) {
      continue;
    }
    winner.set(entry.stackKey, index);
  }
  if (winner.size === 0) {
    return [...sorted];
  }
  return sorted.filter((entry, index) => {
    if (entry.stackKey === null || entry.stackable !== false) {
      return true;
    }
    return winner.get(entry.stackKey) === index;
  });
}

/**
 * Monta a chave de escolha QUALIFICADA POR PROVENIÊNCIA
 * (`<sourceInstanceId>:<choiceId>`).
 *
 * Existe porque `choiceId` sozinho NÃO identifica uma escolha: 55 dos 75
 * talentos do catálogo declaram o mesmo `aumento-atributo`, e 4 deles são
 * repetíveis. Num mapa chaveado só por `choiceId`, o segundo talento apagava
 * silenciosamente a escolha do primeiro. É o mesmo princípio que
 * `state.resources`/`usageFlags` já usam para separar instâncias
 * (`sourceInstanceId`, Tasks 15/20/21).
 * @param {string} sourceInstanceId
 * @param {string} choiceId
 * @returns {string}
 */
export function qualifiedChoiceKey(sourceInstanceId, choiceId) {
  return `${sourceInstanceId}:${choiceId}`;
}

/**
 * Prefixo de ORIGEM que `infra/character/migrations/v1-to-v2.js` usa ao migrar
 * as escolhas do baseline (`classe:<chave>`, `antecedente:<chave>`), por
 * coleção de fonte.
 *
 * A migração v1 SEMPRE prefixa — nunca grava a chave nua. Sem reconhecer esses
 * prefixos aqui, a expansão de `choice` simplesmente não dispararia para
 * nenhum personagem migrado do baseline.
 *
 * `feat` fica de fora de propósito: a migração v1 grava `talento:<slug-do-talento>`
 * (o slug do TALENTO, não o `choiceId`), que não é o mesmo esquema; escolhas de
 * talento usam a chave por instância (`qualifiedChoiceKey`).
 */
const LEGACY_CHOICE_ORIGIN_PREFIX = Object.freeze({ class: 'classe', background: 'antecedente' });

/**
 * Lê as opções escolhidas para um efeito `choice`, na ordem de especificidade:
 *
 *   1. `<sourceInstanceId>:<choiceId>` — identidade por INSTÂNCIA (talentos);
 *   2. `<origem>:<choiceId>` — `classe:`/`antecedente:`, o esquema que a
 *      migração v1->v2 grava;
 *   3. `<choiceId>` NU — só quando UMA única fonte do personagem declara esse
 *      `choiceId`.
 *
 * A condição de (3) é o que corrige a colisão de `equipamento-inicial`, que as
 * 12 classes E os 16 antecedentes declaram com os MESMOS ids de opção
 * (`opcao-a`/`opcao-b`): com a chave nua aplicada aos dois, escolher `opcao-a`
 * aplicava a opção A na classe E no antecedente ao mesmo tempo, e não havia
 * como escolher A numa e B na outra. Quando o `choiceId` é ambíguo, a chave nua
 * não identifica NADA — e adivinhar uma das fontes seria pior do que não
 * aplicar: quem quiser escolher precisa gravar a chave qualificada.
 * @param {*} choices
 * @param {string} sourceInstanceId
 * @param {string} collection - coleção da fonte (`class`, `background`, `feat`, ...)
 * @param {string} choiceId
 * @param {Map<string, number>} declaracoesPorChoiceId - quantas fontes do personagem declaram cada `choiceId`
 * @returns {*} o valor bruto da escolha, ou `undefined`
 */
function readChoiceSelection(choices, sourceInstanceId, collection, choiceId, declaracoesPorChoiceId) {
  if (choices === null || typeof choices !== 'object' || Array.isArray(choices)) {
    return undefined;
  }
  const qualificada = qualifiedChoiceKey(sourceInstanceId, choiceId);
  if (hasOwn(choices, qualificada)) {
    return choices[qualificada];
  }
  const origem = LEGACY_CHOICE_ORIGIN_PREFIX[collection];
  if (origem !== undefined && hasOwn(choices, `${origem}:${choiceId}`)) {
    return choices[`${origem}:${choiceId}`];
  }
  if ((declaracoesPorChoiceId.get(choiceId) ?? 0) > 1) {
    return undefined;
  }
  return hasOwn(choices, choiceId) ? choices[choiceId] : undefined;
}

/**
 * Conta quantas FONTES do personagem declaram cada `choiceId`. Usado para
 * decidir se a chave nua é uma identidade legítima ou ambígua.
 * @param {ReadonlyArray<object>} sources
 * @returns {Map<string, number>}
 */
function countChoiceDeclarations(sources) {
  const contagem = new Map();
  for (const source of sources) {
    for (const effect of Array.isArray(source.entity?.effects) ? source.entity.effects : []) {
      const choiceId = effect?.type === 'choice' ? effect.choice?.id : undefined;
      if (typeof choiceId === 'string') {
        contagem.set(choiceId, (contagem.get(choiceId) ?? 0) + 1);
      }
    }
  }
  return contagem;
}

/**
 * Normaliza o valor de uma escolha para lista de ids de opção. Aceita string
 * (escolha única, forma do baseline) e array.
 * @param {*} selection
 * @returns {Array<string>}
 */
function selectedOptionIds(selection) {
  if (typeof selection === 'string') {
    return [selection];
  }
  return Array.isArray(selection) ? selection.filter((id) => typeof id === 'string') : [];
}

/**
 * Expande os `grants` das opções ESCOLHIDAS de um efeito `choice` em
 * ResolvedEffects, herdando grupo/fonte/proveniência do próprio efeito
 * `choice`.
 *
 * Nada é expandido quando não há escolha registrada — ausência de escolha é
 * ausência de concessão, nunca uma opção padrão presumida. Um grant que não
 * passa na validação semântica é ERRO EXPLÍCITO, com o mesmo tratamento de um
 * efeito de topo malformado.
 * @param {{effect: object, source: object, sourceInstanceId: string,
 *   effectIndex: number, choices: *, conditionContext: object,
 *   declaracoesPorChoiceId: Map<string, number>, nextOrderIndex: number}} params
 * @returns {{ok: true, value: Array<object>} | {ok: false, error: object}}
 */
function expandChosenOptionGrants({ effect, source, sourceInstanceId, effectIndex, choices, conditionContext, declaracoesPorChoiceId, nextOrderIndex }) {
  const choiceId = effect?.choice?.id;
  if (typeof choiceId !== 'string') {
    return { ok: true, value: [] };
  }
  const escolhidas = selectedOptionIds(
    readChoiceSelection(choices, sourceInstanceId, source.collection, choiceId, declaracoesPorChoiceId),
  );
  if (escolhidas.length === 0) {
    return { ok: true, value: [] };
  }

  const opcoes = Array.isArray(effect.choice.options) ? effect.choice.options : [];
  const resolvidos = [];
  let ordem = nextOrderIndex;
  for (const optionId of escolhidas) {
    const opcao = opcoes.find((candidata) => candidata?.id === optionId);
    if (opcao === undefined) {
      // Escolha que não corresponde a nenhuma opção declarada: ERRAR aqui
      // quebraria qualquer personagem com uma escolha legada órfã (o baseline
      // gravava texto livre em `escolhas_classe`). A escolha simplesmente não
      // concede nada; quem valida a legitimidade da seleção é o comando que a
      // grava (`domain/progression/feat-choices.js`), na ENTRADA.
      continue;
    }
    const grants = Array.isArray(opcao.grants) ? opcao.grants : [];
    for (const [grantIndex, grant] of grants.entries()) {
      const pointer = `${source.entity.id}.effects[${effectIndex}].choice.options[${optionId}].grants[${grantIndex}]`;
      const validation = validateEffectSemantics(grant, { path: pointer });
      if (!validation.valid) {
        return {
          ok: false,
          error: collectError('EFFECT_INVALID', `A concessão em ${pointer} não passou na validação semântica.`, {
            pointer,
            errors: validation.errors.map((error) => ({ code: error.code, message: error.message })),
          }),
        };
      }
      // O grant tem `when` PRÓPRIO, e ele vale — exatamente como o `when` de um
      // efeito de topo. Ignorá-lo era bypass silencioso de gating por nível: as
      // 12 concessões gated do catálogo (magias de linhagem de Elfo e Tiferino,
      // `{kind:'level', min:3}` e `min:5`) caíam TODAS num personagem de nível
      // 1 assim que a linhagem era escolhida, e ainda entravam em
      // `state.spells.prepared` por serem `alwaysPrepared`.
      //
      // A condição é avaliada contra o MESMO `conditionContext` do efeito de
      // topo, e um erro de avaliação é propagado igual — o gating de uma
      // concessão não pode falhar "para o lado permissivo".
      const active = evaluateEffectCondition(grant.when, conditionContext);
      if (!active.ok) {
        return { ok: false, error: active.error };
      }
      if (active.value !== true) {
        continue;
      }
      resolvidos.push(
        createResolvedEffect({
          effect: grant,
          group: source.group,
          sourceId: source.entity.id,
          sourceInstanceId,
          effectInstanceId: deriveEffectInstanceId({
            sourceInstanceId,
            index: effectIndex,
            key: `${choiceId}-${optionId}-${grant.id ?? grant.type}-${grantIndex}`,
          }),
          orderIndex: ordem++,
        }),
      );
    }
  }
  return { ok: true, value: resolvidos };
}

/**
 * Confere que o catálogo injetado tem a superfície mínima esperada. Registry
 * incompleto é defeito de programação de quem monta o contexto.
 * @param {*} registry
 */
function requireRegistry(registry) {
  if (
    registry === null ||
    typeof registry !== 'object' ||
    REQUIRED_REGISTRY_METHODS.some((method) => typeof registry[method] !== 'function')
  ) {
    throw new TypeError(
      `collectCharacterEffects: "context.registry" deve oferecer ${REQUIRED_REGISTRY_METHODS.join(', ')}.`,
    );
  }
}

/**
 * Resolve uma referência de conteúdo pelo catálogo, devolvendo a entidade ou
 * `null` quando a referência é ausente. Referência presente mas irresolvível é
 * erro (nunca ignorada em silêncio).
 * @param {object} registry
 * @param {*} reference
 * @param {string} pointer
 * @returns {{ok: true, entity: object | null} | {ok: false, error: object}}
 */
function resolveReference(registry, reference, pointer) {
  if (reference === null || reference === undefined) {
    return { ok: true, entity: null };
  }
  const result = registry.resolve(reference);
  if (!result || result.ok !== true) {
    return {
      ok: false,
      error: collectError('EFFECT_SOURCE_UNRESOLVED', `A referência de conteúdo em ${pointer} não pôde ser resolvida.`, {
        pointer,
        id: typeof reference === 'string' ? reference : (reference?.id ?? null),
      }),
    };
  }
  return { ok: true, entity: result.value };
}

/**
 * Monta a lista de fontes de efeito do personagem, na ordem canônica dos
 * grupos de precedência. Cada fonte é `{group, collection, index, key,
 * entity}`.
 * @param {object} character
 * @param {object} registry
 * @param {number} level
 * @returns {{ok: true, sources: Array<object>} | {ok: false, error: object}}
 */
function buildSources(character, registry, level) {
  const build = character?.build ?? {};
  const state = character?.state ?? {};
  const sources = [];

  /** Acrescenta uma fonte resolvida a partir de uma referência de conteúdo. */
  const pushRef = (group, collection, index, reference, pointer) => {
    const resolved = resolveReference(registry, reference, pointer);
    if (!resolved.ok) {
      return resolved.error;
    }
    if (resolved.entity !== null) {
      sources.push({ group, collection, index, key: resolved.entity.id, entity: resolved.entity });
    }
    return null;
  };

  // --- 1. base -------------------------------------------------------------
  const rulesetError = pushRef('base', 'ruleset', 0, build.rulesetRef, 'build.rulesetRef');
  if (rulesetError !== null) {
    return { ok: false, error: rulesetError };
  }

  // --- 2. progression: escolhas de construção ------------------------------
  const owners = [];
  for (const [collection, pointer] of [
    ['class', 'build.classRef'],
    ['subclass', 'build.subclassRef'],
    ['species', 'build.speciesRef'],
    ['background', 'build.backgroundRef'],
  ]) {
    const reference = build[`${collection}Ref`];
    const error = pushRef('progression', collection, 0, reference, pointer);
    if (error !== null) {
      return { ok: false, error };
    }
    if (reference !== null && reference !== undefined) {
      owners.push(typeof reference === 'string' ? reference : reference.id);
    }
  }
  const featRefs = Array.isArray(build.featRefs) ? build.featRefs : [];
  for (const [index, reference] of featRefs.entries()) {
    const error = pushRef('progression', 'feat', index, reference, `build.featRefs[${index}]`);
    if (error !== null) {
      return { ok: false, error };
    }
    owners.push(typeof reference === 'string' ? reference : reference?.id);
  }

  // --- 2b. progression: features concedidas por essas fontes ---------------
  // Descobertas pelo catálogo (campo `grantedBy` da própria feature), em ordem
  // determinística (nível, depois id). Feature sem `level` não é gated por
  // nível — a ausência não é tratada como "nível 1" inventado.
  const ownerSet = new Set(owners.filter((id) => typeof id === 'string'));
  if (ownerSet.size > 0) {
    const features = [...registry.list('feature')]
      .filter((feature) => typeof feature?.grantedBy === 'string' && ownerSet.has(feature.grantedBy))
      .filter((feature) => !Number.isInteger(feature.level) || feature.level <= level)
      .sort((a, b) => {
        const levelA = Number.isInteger(a.level) ? a.level : 0;
        const levelB = Number.isInteger(b.level) ? b.level : 0;
        if (levelA !== levelB) {
          return levelA - levelB;
        }
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
    for (const [index, feature] of features.entries()) {
      sources.push({ group: 'progression', collection: 'feature', index, key: feature.id, entity: feature });
    }
  }

  // --- 3. equipment: itens equipados e condições ativas -------------------
  const inventory = Array.isArray(state.inventory) ? state.inventory : [];
  for (const [index, entry] of inventory.entries()) {
    if (entry?.equipped !== true) {
      continue;
    }
    const error = pushRef('equipment', 'item', index, entry.itemRef, `state.inventory[${index}].itemRef`);
    if (error !== null) {
      return { ok: false, error };
    }
  }
  const conditions = Array.isArray(state.conditions) ? state.conditions : [];
  for (const [index, conditionId] of conditions.entries()) {
    if (typeof conditionId !== 'string' || conditionId.length === 0) {
      continue;
    }
    const resolved = registry.resolve(conditionId);
    // Condições legadas podem ser texto livre sem entidade correspondente:
    // nesse caso não há efeito nenhum a coletar, e isso não é erro.
    if (resolved && resolved.ok === true) {
      sources.push({
        group: 'equipment',
        collection: 'condition',
        index,
        key: resolved.value.id,
        entity: resolved.value,
      });
    }
  }

  return { ok: true, sources };
}

/**
 * Sintetiza os efeitos do grupo `manual` a partir de `character.overrides`.
 * A chave do override É o path do efeito (`hp.maximum`, `ac`, ...) — o mesmo
 * vocabulário fechado de `modifierEffect.target`, nunca uma variante ad hoc.
 * @param {object} character
 * @returns {{ok: true, entries: Array<object>} | {ok: false, error: object}}
 */
function buildManualEffects(character) {
  const overrides = character?.overrides;
  if (overrides === null || overrides === undefined) {
    return { ok: true, entries: [] };
  }
  if (typeof overrides !== 'object' || Array.isArray(overrides)) {
    return {
      ok: false,
      error: collectError('EFFECT_OVERRIDES_INVALID', 'O campo "overrides" do personagem deve ser um objeto.', {}),
    };
  }

  const entries = [];
  // Ordem determinística das chaves: alfabética, não a ordem de inserção.
  for (const [index, target] of Object.keys(overrides).sort().entries()) {
    // Overrides `identity.*` (correção I2 da revisão final) NÃO são efeitos:
    // são o registro de reversão de `edit-character-field` sobre campos de
    // TEXTO da identidade (`domain/commands/edit-character.js`,
    // `IDENTITY_EDIT_PATHS`). O valor já vive em `character.identity` — não
    // há alvo derivado a modificar, e tratá-los como modifier quebraria TODA
    // coleta de efeitos com `EFFECT_TARGET_NOT_ALLOWED`. A exclusão é por
    // PREFIXO NOMEADO, não um catch-all: qualquer outra chave fora do
    // vocabulário continua sendo erro explícito logo abaixo.
    if (target.startsWith('identity.')) {
      continue;
    }
    if (!isAllowedTargetPath(target)) {
      return {
        ok: false,
        error: collectError(
          'EFFECT_TARGET_NOT_ALLOWED',
          `O override "${target}" não usa o vocabulário fechado de alvos derivados.`,
          { target },
        ),
      };
    }
    const entry = overrides[target];
    if (entry === null || typeof entry !== 'object' || !hasOwn(entry, 'value')) {
      return {
        ok: false,
        error: collectError('EFFECT_OVERRIDES_INVALID', `O override "${target}" não tem a forma {value, ...}.`, {
          target,
        }),
      };
    }
    entries.push({
      target,
      index,
      effect: Object.freeze({ id: 'override', type: 'modifier', target, operation: 'set', value: entry.value }),
    });
  }
  return { ok: true, entries };
}

/**
 * Percorre as fontes de efeito de um personagem e devolve todos os efeitos
 * ATIVOS (com `when` satisfeito), envelopados e ordenados.
 *
 * @param {object} character - CanonicalCharacter (Task 12)
 * @param {{registry: object, level?: number, choices?: object,
 *   equippedItemIds?: Array<string>, stateFlags?: object,
 *   classLevels?: object}} context
 * @returns {import('../../core/result.js').Result} `ok(ReadonlyArray<ResolvedEffect>)`
 */
export function collectCharacterEffects(character, context = {}) {
  requireRegistry(context?.registry);
  if (character === null || typeof character !== 'object' || Array.isArray(character)) {
    return err(collectError('EFFECT_CHARACTER_INVALID', 'O personagem deve ser um objeto canônico.', {}));
  }

  const registry = context.registry;
  const build = character.build ?? {};
  const state = character.state ?? {};

  // Contexto de avaliação de condição: derivado do personagem, com o que o
  // chamador informar tendo precedência (permite pré-visualizar um nível
  // diferente sem clonar o personagem).
  const level = Number.isInteger(context.level) ? context.level : state.level;
  const classId = build.classRef === null || build.classRef === undefined ? null : build.classRef.id ?? null;
  const classLevels = context.classLevels ?? (classId === null ? {} : { [classId]: level });
  const equippedItemIds =
    context.equippedItemIds ??
    (Array.isArray(state.inventory) ? state.inventory : [])
      .filter((entry) => entry?.equipped === true && typeof entry?.itemRef?.id === 'string')
      .map((entry) => entry.itemRef.id);
  const conditionContext = Object.freeze({
    level,
    classLevels,
    choices: context.choices ?? build.choices ?? {},
    equippedItemIds,
    stateFlags: context.stateFlags ?? {},
  });

  const built = buildSources(character, registry, level);
  if (!built.ok) {
    return err(built.error);
  }

  // Quantas fontes declaram cada `choiceId` — decide se a chave NUA é uma
  // identidade legítima ou ambígua (ver `readChoiceSelection`).
  const declaracoesPorChoiceId = countChoiceDeclarations(built.sources);

  const collected = [];
  let orderIndex = 0;

  for (const source of built.sources) {
    const sourceInstanceId = deriveSourceInstanceId({
      collection: source.collection,
      index: source.index,
      key: source.key,
    });
    const effects = Array.isArray(source.entity.effects) ? source.entity.effects : [];
    for (const [effectIndex, effect] of effects.entries()) {
      const pointer = `${source.entity.id}.effects[${effectIndex}]`;
      const validation = validateEffectSemantics(effect, { path: pointer });
      if (!validation.valid) {
        return err(
          collectError('EFFECT_INVALID', `O efeito em ${pointer} não passou na validação semântica.`, {
            pointer,
            errors: validation.errors.map((error) => ({ code: error.code, message: error.message })),
          }),
        );
      }
      const active = evaluateEffectCondition(effect.when, conditionContext);
      if (!active.ok) {
        return err(active.error);
      }
      if (active.value !== true) {
        continue;
      }
      collected.push(
        createResolvedEffect({
          effect,
          group: source.group,
          sourceId: source.entity.id,
          sourceInstanceId,
          effectInstanceId: deriveEffectInstanceId({
            sourceInstanceId,
            index: effectIndex,
            key: effect.id ?? effect.type,
          }),
          orderIndex: orderIndex++,
        }),
      );

      // Expansão das opções ESCOLHIDAS de um efeito `choice` (Task 23).
      //
      // Um efeito `choice` declara `options[].grants` — os efeitos que aquela
      // opção concede quando escolhida. Até aqui NADA os expandia: o efeito
      // `choice` era coletado e as concessões ficavam inertes, então escolher
      // "+1 Constituição" num talento não mudava Constituição nenhuma. A UI
      // gravava a escolha e o motor a ignorava.
      if (effect.type === 'choice') {
        const expandido = expandChosenOptionGrants({
          effect,
          source,
          sourceInstanceId,
          effectIndex,
          choices: conditionContext.choices,
          conditionContext,
          declaracoesPorChoiceId,
          nextOrderIndex: orderIndex,
        });
        if (!expandido.ok) {
          return err(expandido.error);
        }
        collected.push(...expandido.value);
        orderIndex += expandido.value.length;
      }
    }
  }

  const manual = buildManualEffects(character);
  if (!manual.ok) {
    return err(manual.error);
  }
  for (const entry of manual.entries) {
    const sourceInstanceId = deriveSourceInstanceId({ collection: 'override', index: entry.index, key: entry.target });
    collected.push(
      createResolvedEffect({
        effect: entry.effect,
        group: 'manual',
        sourceId: null,
        sourceInstanceId,
        effectInstanceId: deriveEffectInstanceId({ sourceInstanceId, index: 0, key: entry.target }),
        orderIndex: orderIndex++,
      }),
    );
  }

  return ok(Object.freeze(sortResolvedEffects(collected)));
}
