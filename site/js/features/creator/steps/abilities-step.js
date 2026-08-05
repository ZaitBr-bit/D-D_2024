// Passo `atributos` do criador (Task 27).
//
// ## O que este passo NÃO faz
//
//  - NÃO embute `STANDARD_ARRAY`, `POINT_BUY_CUSTOS` nem `POINT_BUY_TOTAL` em
//    código. Os três vêm do RULESET (`tables.standardArray`,
//    `tables.pointBuy`), pela mesma disciplina de `domain/inventory/wallet.js`:
//    sem ruleset acessível a carga FALHA com erro nomeado, em vez de cair numa
//    tabela "plausível" embutida (Global Constraint: regra de defaults).
//  - NÃO usa `Math.random()`. A rolagem 4d6-descartando-o-menor consome o
//    `rng` INJETADO na sessão (`createCreatorSession({rng})`). Sem `rng` a
//    intenção de rolagem é recusada com erro nomeado — nunca cai em
//    `Math.random()`, que tornaria o passo intestável de forma determinística.
//  - NÃO deriva o bônus de antecedente de prosa nem do nome do atributo. Ele
//    sai dos `grants` do tipo `modifier` da OPÇÃO escolhida em
//    `bonus-de-atributo` (alvo `ability.<chave>.score`), que é campo
//    estruturado do catálogo.
//
// ## Modo MANUAL: caracterizado, visível e DESABILITADO
//
// O criador legado já renderiza o rádio "Manual" com `disabled` (e reseta para
// `standard` quando um rascunho antigo trazia esse modo). Esta task PRESERVA
// exatamente esse estado: a opção continua aparecendo, continua desabilitada, e
// nenhuma intenção é produzida por ela. Ativar a edição manual é decisão de
// produto, não efeito colateral de uma refatoração — e escondê-la seria mudar
// a interface sem que ninguém tivesse pedido.
//
// ## `state.abilities` guarda a BASE, não o total
//
// O bônus de antecedente é um efeito `modifier` com alvo `ability.<x>.score`,
// aplicado em tempo de CONSULTA por `getAbilityModifier`. Somá-lo dentro de
// `state.abilities` o contaria duas vezes. Por isso o passo grava a base em
// `state.abilities`/`build.abilityGeneration.base` e publica o total apenas na
// fatia DERIVADA `derivedStats`.

import { ok, err } from '../../../core/result.js';
import { createAppWarning } from '../../../core/errors.js';
import { escapeHtml, escapeHtmlAttribute } from '../../../ui/html.js';
import { createUiEventDecision, NO_UI_EVENT_DECISION } from '../../../ui/event-delegation.js';
import { ABILITY_KEYS, getAbilityModifier, getProficiencyBonus } from '../../../domain/character/queries/index.js';
import { buildInvalidationPatch, createInvalidationPatch } from '../creator-invalidation.js';
import { withDraftSlices } from '../creator-state.js';
import { createCreatorStep, createStepBinding, stepError } from './creator-step.js';

const STEP_ID = 'atributos';

/** Escopo dos diagnósticos estruturados deste passo. */
const SCOPE = 'features.creator.steps.abilities';

/**
 * Assinaturas de divergência já reportadas no console, para que o aviso seja
 * emitido uma vez por combinação de atributos e não a cada clique.
 * @type {Set<string>}
 */
const reportedDivergences = new Set();

/**
 * Zera a memória de deduplicação dos avisos de divergência. Existe para que um
 * teste consiga observar o aviso mais de uma vez sem depender da ordem de
 * execução dos casos.
 * @returns {void}
 */
export function resetDivergenceReporting() {
  reportedDivergences.clear();
}

/**
 * Métodos de geração de atributo, na ordem em que o wizard legado os exibe.
 *
 * `canonical` é o valor gravado em `build.abilityGeneration.method`, cujo enum
 * (`character-canonical-v2.schema.json`) é `standard|pointbuy|rolled|manual` —
 * a diferença de nome entre `rolagem` (id da UI, herdado do legado) e `rolled`
 * (enum canônico) é traduzida AQUI, uma vez, em vez de espalhada.
 *
 * `enabled: false` é o modo MANUAL: renderizado e desabilitado (ver cabeçalho).
 * @type {ReadonlyArray<Readonly<{id: string, canonical: string, label: string, enabled: boolean}>>}
 */
export const ABILITY_METHODS = Object.freeze([
  Object.freeze({ id: 'standard', canonical: 'standard', label: 'Conjunto Padrão', enabled: true }),
  Object.freeze({ id: 'pointbuy', canonical: 'pointbuy', label: 'Compra de Pontos', enabled: true }),
  Object.freeze({ id: 'rolagem', canonical: 'rolled', label: 'Rolagem 4d6', enabled: true }),
  Object.freeze({ id: 'manual', canonical: 'manual', label: 'Manual', enabled: false }),
]);

/** Métodos que esta task ATIVA (o manual fica de fora, de propósito). */
export const ENABLED_ABILITY_METHODS = Object.freeze(ABILITY_METHODS.filter((method) => method.enabled).map((method) => method.id));

/** Intenções de domínio deste passo. */
export const ABILITIES_INTENT_TYPES = Object.freeze({
  chooseMethod: 'creator/abilities-method',
  assignStandard: 'creator/abilities-assign',
  pointBuy: 'creator/abilities-point-buy',
  roll: 'creator/abilities-roll',
});

/** `choiceId` do bônus de atributo de origem (mesmo id dos 16 antecedentes). */
const ABILITY_BONUS_CHOICE_ID = 'bonus-de-atributo';

/** Prefixo do alvo de um `modifier` de pontuação de atributo. */
const ABILITY_SCORE_TARGET = /^ability\.([a-z]+)\.score$/;

/**
 * Diz se o catálogo injetado tem a superfície mínima que este passo usa.
 * @param {*} registry
 * @returns {boolean}
 */
function isUsableRegistry(registry) {
  return registry !== null && typeof registry === 'object' && typeof registry.get === 'function' && typeof registry.resolve === 'function';
}

/**
 * Resolve a entidade de RULESET que declara as tabelas de geração de atributo.
 *
 * Precedência idêntica à de `wallet.js#resolveCurrencyRates`: `context.rules`
 * (entidade já resolvida, injetada na sessão) e depois
 * `context.registry` + `character.build.rulesetRef`. Nenhuma tabela padrão é
 * embutida aqui.
 * @param {object} context
 * @returns {import('../../../core/result.js').Result} `ok(ruleset)`
 */
export function resolveAbilityRuleset(context) {
  const rules = context?.rules;
  if (rules !== null && rules !== undefined && typeof rules === 'object') {
    return ok(rules);
  }
  const rulesetId = context?.draft?.character?.build?.rulesetRef?.id;
  if (isUsableRegistry(context?.registry) && typeof rulesetId === 'string') {
    const entity = context.registry.get(rulesetId);
    if (entity !== null && entity !== undefined) {
      return ok(entity);
    }
  }
  return err(
    stepError(
      'CREATOR_STEP_RULESET_UNAVAILABLE',
      `O passo "${STEP_ID}" exige o ruleset (por "context.rules" ou por "context.registry" + "build.rulesetRef") para ler o conjunto padrão e a compra de pontos.`,
      { stepId: STEP_ID, rulesetId: typeof rulesetId === 'string' ? rulesetId : null },
    ),
  );
}

/**
 * Lê `tables.standardArray` do ruleset, exigindo um valor por atributo.
 * @param {object} ruleset
 * @returns {import('../../../core/result.js').Result} `ok(ReadonlyArray<number>)`
 */
export function readStandardArray(ruleset) {
  const table = ruleset?.tables?.standardArray;
  if (!Array.isArray(table) || table.length !== ABILITY_KEYS.length || table.some((value) => !Number.isInteger(value))) {
    return err(
      stepError(
        'CREATOR_STEP_STANDARD_ARRAY_INVALID',
        `O ruleset precisa declarar "tables.standardArray" com ${ABILITY_KEYS.length} inteiros.`,
        { stepId: STEP_ID, rulesetId: typeof ruleset?.id === 'string' ? ruleset.id : null },
      ),
    );
  }
  return ok(Object.freeze([...table]));
}

/**
 * Lê `tables.pointBuy` do ruleset (`{budget, minScore, maxScore, costs}`).
 * Toda pontuação do intervalo precisa ter custo declarado — um buraco na
 * tabela viraria "custo 0" silencioso, que é pontuação de graça.
 * @param {object} ruleset
 * @returns {import('../../../core/result.js').Result} `ok(pointBuy)`
 */
export function readPointBuyTable(ruleset) {
  const table = ruleset?.tables?.pointBuy;
  const costs = table?.costs;
  if (
    table === null ||
    typeof table !== 'object' ||
    !Number.isInteger(table.budget) ||
    !Number.isInteger(table.minScore) ||
    !Number.isInteger(table.maxScore) ||
    table.minScore > table.maxScore ||
    costs === null ||
    typeof costs !== 'object'
  ) {
    return err(
      stepError('CREATOR_STEP_POINT_BUY_INVALID', 'O ruleset precisa declarar "tables.pointBuy" com {budget, minScore, maxScore, costs}.', {
        stepId: STEP_ID,
      }),
    );
  }
  const normalized = {};
  for (let score = table.minScore; score <= table.maxScore; score += 1) {
    const cost = costs[String(score)];
    if (!Number.isInteger(cost) || cost < 0) {
      return err(
        stepError('CREATOR_STEP_POINT_BUY_COST_MISSING', `A tabela de compra de pontos não declara o custo da pontuação ${score}.`, {
          stepId: STEP_ID,
          score,
        }),
      );
    }
    normalized[score] = cost;
  }
  return ok(
    Object.freeze({
      budget: table.budget,
      minScore: table.minScore,
      maxScore: table.maxScore,
      costs: Object.freeze(normalized),
    }),
  );
}

/**
 * Rola 4d6 e DESCARTA o menor dado, consumindo o `rng` injetado.
 *
 * `rng.next()` devolve um número em `[0, 1)` — a mesma convenção de
 * `Math.random()`, para que um RNG de teste possa ser trocado sem mudar a
 * fórmula. A ordem dos dados devolvida é a ORIGINAL da rolagem (não a
 * ordenada), porque é ela que o jogador vê rolar; `dropped` diz qual valor
 * saiu da soma.
 * @param {{next: () => number}} rng
 * @returns {{dice: ReadonlyArray<number>, dropped: number, total: number}}
 */
export function roll4d6DropLowest(rng) {
  const dice = [];
  for (let index = 0; index < 4; index += 1) {
    const value = rng.next();
    dice.push(Math.floor(value * 6) + 1);
  }
  const ordered = [...dice].sort((a, b) => a - b);
  const dropped = ordered[0];
  const total = ordered.slice(1).reduce((sum, die) => sum + die, 0);
  return Object.freeze({ dice: Object.freeze([...dice]), dropped, total });
}

/**
 * Lê o mapa de escolhas QUALIFICADAS de uma fatia do rascunho.
 * @param {object} draft
 * @param {string} slice
 * @returns {object}
 */
function picksInSlice(draft, slice) {
  const value = draft?.slices?.[slice];
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/**
 * Bônus de atributo do ANTECEDENTE, lido dos `grants` estruturados da opção
 * escolhida.
 *
 * A regra 2024 é `+2/+1` em atributos DISTINTOS ou `+1/+1/+1`. Aqui ela é
 * VERIFICADA sobre o que o catálogo declara, não presumida: uma opção que não
 * some 3 pontos, que repita atributo no `+2/+1` ou que use outra forma é
 * reportada como `shape: null`, e `validate` recusa o passo em vez de aplicar
 * um bônus torto.
 * @param {{entity: object|null, optionId: string|null}} params
 * @returns {Readonly<{byAbility: object, shape: string|null, optionId: string|null}>}
 */
export function readBackgroundAbilityBonus({ entity, optionId }) {
  const empty = Object.freeze({ byAbility: Object.freeze({}), shape: null, optionId: null });
  if (entity === null || typeof optionId !== 'string' || optionId.length === 0) {
    return empty;
  }
  const effects = Array.isArray(entity.effects) ? entity.effects : [];
  const choice = effects.find((effect) => effect?.type === 'choice' && effect.choice?.id === ABILITY_BONUS_CHOICE_ID)?.choice ?? null;
  const option = (Array.isArray(choice?.options) ? choice.options : []).find((entry) => entry?.id === optionId) ?? null;
  if (option === null) {
    return empty;
  }

  const byAbility = {};
  for (const grant of Array.isArray(option.grants) ? option.grants : []) {
    if (grant?.type !== 'modifier' || grant.operation !== 'add' || !Number.isInteger(grant.value)) {
      continue;
    }
    const match = ABILITY_SCORE_TARGET.exec(typeof grant.target === 'string' ? grant.target : '');
    if (match === null || !ABILITY_KEYS.includes(match[1])) {
      continue;
    }
    byAbility[match[1]] = (byAbility[match[1]] ?? 0) + grant.value;
  }

  const values = Object.values(byAbility).sort((a, b) => b - a);
  const total = values.reduce((sum, value) => sum + value, 0);
  let shape = null;
  if (total === 3 && values.length === 2 && values[0] === 2 && values[1] === 1) {
    shape = '+2/+1';
  } else if (total === 3 && values.length === 3 && values.every((value) => value === 1)) {
    shape = '+1/+1/+1';
  }
  return Object.freeze({ byAbility: Object.freeze({ ...byAbility }), shape, optionId });
}

/**
 * Descobre o antecedente escolhido e a opção de bônus confirmada no rascunho.
 * @param {object} context
 * @returns {Readonly<object>} o mesmo shape de `readBackgroundAbilityBonus`.
 */
export function draftBackgroundBonus(context) {
  const selection = context?.draft?.slices?.backgroundSelection;
  const contentId = selection !== null && typeof selection === 'object' ? selection.contentId : null;
  if (typeof contentId !== 'string' || !isUsableRegistry(context?.registry)) {
    return readBackgroundAbilityBonus({ entity: null, optionId: null });
  }
  const resolved = context.registry.resolve(contentId, 'background');
  if (resolved.ok !== true) {
    return readBackgroundAbilityBonus({ entity: null, optionId: null });
  }
  // A fatia é um mapa QUALIFICADO (`<sourceInstanceId>:<choiceId>`): basta
  // achar a chave que termina no `choiceId` do bônus. Só existe uma seleção de
  // antecedente por rascunho, então não há ambiguidade.
  let optionId = null;
  for (const [key, value] of Object.entries(picksInSlice(context.draft, 'backgroundAbilityBonus'))) {
    if (key.endsWith(`:${ABILITY_BONUS_CHOICE_ID}`)) {
      const ids = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
      optionId = ids.length > 0 ? ids[0] : null;
    }
  }
  return readBackgroundAbilityBonus({ entity: resolved.value, optionId });
}

/**
 * Perícias de classe já confirmadas, para EXIBIÇÃO. O passo `atributos` só as
 * mostra: quem as concede é o passo `classe`, e conceder de novo aqui
 * duplicaria a proficiência (o defeito de "não duplicação de concessões" que
 * o brief pede para testar).
 * @param {object} draft
 * @returns {ReadonlyArray<string>}
 */
export function grantedClassSkillIds(draft) {
  const ids = [];
  for (const value of Object.values(picksInSlice(draft, 'classSkills'))) {
    for (const id of Array.isArray(value) ? value : []) {
      if (typeof id === 'string' && id.length > 0 && !ids.includes(id)) {
        ids.push(id);
      }
    }
  }
  return Object.freeze(ids);
}

/**
 * Fatia `abilityScores` corrente, com o formato normalizado (nunca `undefined`).
 * @param {object} draft
 * @returns {Readonly<{method: string|null, base: object, standardAssignment: object, rolls: object}>}
 */
export function readAbilityScores(draft) {
  const slice = draft?.slices?.abilityScores;
  const safe = slice !== null && typeof slice === 'object' && !Array.isArray(slice) ? slice : {};
  return Object.freeze({
    method: typeof safe.method === 'string' ? safe.method : null,
    base: safe.base !== null && typeof safe.base === 'object' ? safe.base : {},
    standardAssignment: safe.standardAssignment !== null && typeof safe.standardAssignment === 'object' ? safe.standardAssignment : {},
    rolls: safe.rolls !== null && typeof safe.rolls === 'object' ? safe.rolls : {},
  });
}

/**
 * Custo total de uma distribuição de compra de pontos. Devolve `null` quando
 * alguma pontuação está fora do intervalo declarado pelo ruleset — nunca 0,
 * que faria a distribuição inválida parecer gratuita.
 * @param {object} base
 * @param {object} pointBuy
 * @returns {number|null}
 */
export function pointBuyCost(base, pointBuy) {
  let total = 0;
  for (const key of ABILITY_KEYS) {
    const score = base?.[key];
    if (!Number.isInteger(score) || score < pointBuy.minScore || score > pointBuy.maxScore) {
      return null;
    }
    total += pointBuy.costs[score];
  }
  return total;
}

/**
 * Base inicial de uma distribuição de compra de pontos: a MENOR pontuação que
 * o ruleset declara, para os seis atributos (não um "8" embutido).
 * @param {object} pointBuy
 * @returns {object}
 */
function pointBuyFloor(pointBuy) {
  return Object.fromEntries(ABILITY_KEYS.map((key) => [key, pointBuy.minScore]));
}

/**
 * Projeta a fatia DERIVADA `derivedStats` a partir do personagem já atualizado.
 *
 * `proficiencyBonus` sai da consulta do domínio (`getProficiencyBonus`), com
 * os efeitos aplicados.
 *
 * ## Por que o TOTAL de atributo não vem de `getAbilityModifier`
 *
 * O bônus de origem é declarado no catálogo com alvo `ability.<chave>.score`,
 * mas `getAbilityModifier` (Task 16) resolve o alvo `ability.<chave>` — os dois
 * paths não casam, então a consulta hoje devolve o modificador da BASE, sem o
 * bônus de origem. Enquanto essa divergência entre conteúdo e consulta não for
 * decidida no DOMÍNIO (não é decisão deste passo), o total exibido é composto
 * aqui a partir do bônus ESTRUTURADO já lido do catálogo — nunca de prosa.
 * `engineModifier` guarda o que a consulta devolve, para que a diferença seja
 * observável em vez de silenciosa.
 * @param {object} character
 * @param {object} context
 * @param {object} bonus - saída de `readBackgroundAbilityBonus`.
 * @returns {import('../../../core/result.js').Result} `ok(derivedStats)`
 */
function projectDerivedStats(character, context, bonus) {
  const abilities = {};
  const warnings = [];
  for (const key of ABILITY_KEYS) {
    const base = character.state.abilities?.[key];
    const engineModifier = getAbilityModifier(character, key, { registry: context.registry });
    if (engineModifier.ok !== true) {
      return engineModifier;
    }
    const applied = bonus.byAbility[key] ?? 0;
    const total = base + applied;
    const modifier = Math.floor((total - 10) / 2);
    abilities[key] = Object.freeze({
      base,
      bonus: applied,
      total,
      modifier,
      engineModifier: engineModifier.value,
    });
    if (modifier !== engineModifier.value) {
      // ALARME de dívida conhecida, não erro fatal.
      //
      // Expor os dois valores lado a lado já é honesto, mas silencioso: um
      // consumidor futuro (a ficha da Task 29/33, o cutover da Task 28) pode ler
      // o campo errado sem nunca perceber que eles divergem. Este aviso torna a
      // divergência BARULHENTA em log e inspecionável na própria fatia, até que
      // a raiz seja resolvida no domínio (alvo `ability.<x>.score` do catálogo
      // vs. `ability.<x>` de `getAbilityModifier`).
      warnings.push(
        createAppWarning({
          code: 'CREATOR_ABILITIES_MODIFIER_DIVERGENCE',
          scope: SCOPE,
          message:
            `O modificador exibido de "${key}" (${modifier}) diverge do que a consulta do domínio devolve ` +
            `(${engineModifier.value}): o bônus de origem é declarado com alvo "ability.${key}.score" e ` +
            'a consulta resolve "ability.' + key + '". O total exibido usa o bônus estruturado do catálogo.',
          context: { stepId: STEP_ID, abilityKey: key, base, bonus: applied, modifier, engineModifier: engineModifier.value },
        }),
      );
    }
  }
  const proficiencyBonus = getProficiencyBonus(character, { registry: context.registry });
  if (proficiencyBonus.ok !== true) {
    return proficiencyBonus;
  }
  reportDivergences(warnings);
  return ok(
    Object.freeze({
      abilities: Object.freeze(abilities),
      proficiencyBonus: proficiencyBonus.value,
      backgroundBonusShape: bonus.shape,
      // Os avisos moram na própria fatia: quem ler `derivedStats` lê junto a
      // ressalva sobre ele.
      warnings: Object.freeze([...warnings]),
    }),
  );
}

/**
 * Publica os avisos de divergência no console, uma vez por conjunto de chaves
 * divergentes.
 *
 * A deduplicação existe porque `derivedStats` é reprojetado a CADA intenção do
 * passo (cada clique de compra de pontos, cada rolagem): sem ela o log viraria
 * ruído e deixaria de ser lido, que é o oposto de "barulhento até ser
 * resolvido".
 * @param {ReadonlyArray<object>} warnings
 * @returns {void}
 */
function reportDivergences(warnings) {
  if (warnings.length === 0) {
    return;
  }
  const assinatura = warnings.map((warning) => warning.context.abilityKey).join(',');
  if (reportedDivergences.has(assinatura)) {
    return;
  }
  reportedDivergences.add(assinatura);
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(
      `[${SCOPE}] ${warnings[0].code}: o modificador exibido diverge da consulta do domínio em ${assinatura}.`,
      warnings.map((warning) => warning.context),
    );
  }
}

/**
 * Grava a base no personagem canônico: `state.abilities` e
 * `build.abilityGeneration`. Sem personagem no rascunho devolve `null` (o
 * rascunho ainda guarda a fatia; materializar acontece quando ele existir),
 * exatamente como fazem os passos de catálogo.
 * @param {{character: object|null, method: string, base: object, rolls: object}} params
 * @returns {object|null}
 */
function applyBaseToCharacter({ character, method, base, rolls }) {
  if (character === null || typeof character !== 'object') {
    return null;
  }
  const canonicalMethod = ABILITY_METHODS.find((entry) => entry.id === method)?.canonical ?? 'standard';
  const abilities = Object.fromEntries(ABILITY_KEYS.map((key) => [key, Number.isInteger(base[key]) ? base[key] : 10]));
  // `build.abilityGeneration.rolls` é um array PLANO de números pelo schema
  // canônico; a rolagem detalhada (dados e descarte) fica na fatia do rascunho,
  // que é onde a UI a lê.
  const flatRolls = ABILITY_KEYS.map((key) => rolls?.[key]?.total).filter((total) => Number.isInteger(total));
  return Object.freeze({
    ...character,
    build: Object.freeze({
      ...character.build,
      abilityGeneration: Object.freeze({
        method: canonicalMethod,
        base: Object.freeze({ ...abilities }),
        rolls: Object.freeze(flatRolls),
      }),
    }),
    state: Object.freeze({ ...character.state, abilities: Object.freeze({ ...abilities }) }),
  });
}

// --- Renderização ---------------------------------------------------------

/**
 * Markup dos rádios de método. O MANUAL sai com `disabled` e com a mesma
 * marcação de "opção desabilitada" do wizard legado.
 * @param {string|null} current
 * @returns {string}
 */
function renderMethods(current) {
  const selected = current ?? ABILITY_METHODS[0].id;
  return (
    '<div class="atributos-modos">' +
    ABILITY_METHODS.map((method) => {
      const checked = method.enabled && method.id === selected ? ' checked' : '';
      const disabled = method.enabled ? '' : ' disabled';
      const wrapper = method.enabled ? 'form-check' : 'form-check form-check-disabled';
      return (
        `<label class="${wrapper}"${method.enabled ? '' : ' title="Opção desabilitada"'}>` +
        `<input type="radio" name="attr-mode" data-attr-mode="${escapeHtmlAttribute(method.id)}" value="${escapeHtmlAttribute(method.id)}"${checked}${disabled}> ` +
        escapeHtml(method.label) +
        '</label>'
      );
    }).join('') +
    '</div>'
  );
}

/**
 * Markup de uma caixa de atributo (nome, controle e valores derivados).
 * @param {{key: string, name: string, control: string, base: number|null, bonus: number, modifier: number|null}} params
 * @returns {string}
 */
function renderAbilityBox({ key, name, control, base, bonus, modifier }) {
  const total = base === null ? null : base + bonus;
  return (
    `<div class="atributo-box" data-key="${escapeHtmlAttribute(key)}">` +
    `<div class="atributo-nome">${escapeHtml(name)}</div>` +
    control +
    (bonus > 0 ? `<div class="atributo-bonus">+${bonus} antec.</div>` : '') +
    `<div class="atributo-mod">${modifier === null ? '--' : modifier >= 0 ? `+${modifier}` : String(modifier)}</div>` +
    `<div class="atributo-valor">${total === null ? '--' : total}</div>` +
    '</div>'
  );
}

/**
 * Markup do corpo do método CONJUNTO PADRÃO: um `<select>` por atributo, com
 * os índices já usados desabilitados (é assim que "sem reutilização" fica
 * visível na interface, e não só no `validate`).
 * @param {{data: object, scores: object, bonus: object}} params
 * @returns {string}
 */
function renderStandard({ data, scores, bonus }) {
  const usados = Object.values(scores.standardAssignment).filter((index) => Number.isInteger(index));
  const boxes = data.abilities
    .map((ability) => {
      const assigned = scores.standardAssignment[ability.key];
      const options = data.standardArray
        .map((value, index) => {
          const usadoPorOutro = usados.includes(index) && assigned !== index;
          return (
            `<option value="${index}"${usadoPorOutro ? ' disabled' : ''}${assigned === index ? ' selected' : ''}>` +
            `${value}</option>`
          );
        })
        .join('');
      const control =
        `<select class="form-select" data-attr-assign="${escapeHtmlAttribute(ability.key)}">` +
        `<option value=""${Number.isInteger(assigned) ? '' : ' selected'}>--</option>${options}</select>`;
      const base = Number.isInteger(assigned) ? data.standardArray[assigned] : null;
      const bonusValue = bonus.byAbility[ability.key] ?? 0;
      return renderAbilityBox({
        key: ability.key,
        name: ability.name,
        control,
        base,
        bonus: bonusValue,
        modifier: base === null ? null : Math.floor((base + bonusValue - 10) / 2),
      });
    })
    .join('');
  return (
    `<div class="info-box warning">Distribua os valores [${escapeHtml(data.standardArray.join(', '))}] entre seus atributos.</div>` +
    `<div class="atributos-grid">${boxes}</div>`
  );
}

/**
 * Markup do corpo do método COMPRA DE PONTOS.
 * @param {{data: object, scores: object, bonus: object}} params
 * @returns {string}
 */
function renderPointBuy({ data, scores, bonus }) {
  const base = ABILITY_KEYS.every((key) => Number.isInteger(scores.base[key])) ? scores.base : pointBuyFloor(data.pointBuy);
  const custo = pointBuyCost(base, data.pointBuy);
  const restante = custo === null ? null : data.pointBuy.budget - custo;
  const boxes = data.abilities
    .map((ability) => {
      const score = base[ability.key];
      const bonusValue = bonus.byAbility[ability.key] ?? 0;
      const control =
        '<div class="counter">' +
        `<button class="counter-btn" type="button" data-pb-key="${escapeHtmlAttribute(ability.key)}" data-pb-delta="-1"${score <= data.pointBuy.minScore ? ' disabled' : ''}>-</button>` +
        `<span class="counter-valor">${score}</span>` +
        `<button class="counter-btn" type="button" data-pb-key="${escapeHtmlAttribute(ability.key)}" data-pb-delta="1"${score >= data.pointBuy.maxScore ? ' disabled' : ''}>+</button>` +
        '</div>' +
        `<div class="atributo-custo">custo: ${data.pointBuy.costs[score] ?? 0}</div>`;
      return renderAbilityBox({
        key: ability.key,
        name: ability.name,
        control,
        base: score,
        bonus: bonusValue,
        modifier: Math.floor((score + bonusValue - 10) / 2),
      });
    })
    .join('');
  return (
    `<div class="info-box info">Pontos restantes: <strong>${restante === null ? '--' : restante}</strong> / ${data.pointBuy.budget}</div>` +
    `<div class="atributos-grid">${boxes}</div>`
  );
}

/**
 * Markup do corpo do método ROLAGEM 4d6.
 * @param {{data: object, scores: object, bonus: object}} params
 * @returns {string}
 */
function renderRolls({ data, scores, bonus }) {
  const boxes = data.abilities
    .map((ability) => {
      const roll = scores.rolls[ability.key] ?? null;
      const base = roll === null ? null : roll.total;
      const bonusValue = bonus.byAbility[ability.key] ?? 0;
      const control =
        (roll === null
          ? ''
          : `<div class="atributo-dados">${escapeHtml(roll.dice.join(', '))} (descartado ${roll.dropped})</div>`) +
        `<button class="btn btn-sm" type="button" data-roll-key="${escapeHtmlAttribute(ability.key)}">${roll === null ? 'Rolar' : 'Re-rolar'}</button>`;
      return renderAbilityBox({
        key: ability.key,
        name: ability.name,
        control,
        base,
        bonus: bonusValue,
        modifier: base === null ? null : Math.floor((base + bonusValue - 10) / 2),
      });
    })
    .join('');
  return (
    '<div class="info-box info">Role 4d6 para cada atributo e descarte o menor dado.</div>' +
    '<button class="btn btn-sm btn-accent" type="button" data-roll-all="true">Rolar Todos</button>' +
    `<div class="atributos-grid">${boxes}</div>`
  );
}

/**
 * Cria o passo `atributos`.
 * @returns {import('../../../core/result.js').Result} `ok(step)`
 */
export function createAbilitiesStep() {
  return createCreatorStep({
    id: STEP_ID,

    /**
     * Carrega as TABELAS do ruleset e os nomes dos atributos do catálogo.
     * Sem catálogo ou sem ruleset a carga FALHA com erro nomeado — nunca
     * devolve tabelas embutidas.
     * @param {object} context
     * @returns {Promise<import('../../../core/result.js').Result>}
     */
    async load(context) {
      if (!isUsableRegistry(context.registry)) {
        return err(
          stepError('CREATOR_STEP_REGISTRY_MISSING', `O passo "${STEP_ID}" exige um ContentRegistry em "context.registry".`, {
            stepId: STEP_ID,
          }),
        );
      }
      const ruleset = resolveAbilityRuleset(context);
      if (ruleset.ok !== true) {
        return ruleset;
      }
      const standardArray = readStandardArray(ruleset.value);
      if (standardArray.ok !== true) {
        return standardArray;
      }
      const pointBuy = readPointBuyTable(ruleset.value);
      if (pointBuy.ok !== true) {
        return pointBuy;
      }

      // Os nomes exibidos vêm das entidades `ability` do ruleset, resolvidas
      // no catálogo — nunca de um dicionário de português embutido no passo.
      const declared = Array.isArray(ruleset.value?.tables?.abilities) ? ruleset.value.tables.abilities : [];
      const abilities = [];
      for (const key of ABILITY_KEYS) {
        const abilityId = declared.find((id) => typeof id === 'string' && id.endsWith(`:${key}`)) ?? null;
        const resolved = abilityId === null ? null : context.registry.resolve(abilityId, 'ability');
        abilities.push(
          Object.freeze({
            key,
            id: abilityId,
            name: resolved !== null && resolved.ok === true && typeof resolved.value.name === 'string' ? resolved.value.name : key,
          }),
        );
      }

      return ok(
        Object.freeze({
          stepId: STEP_ID,
          methods: ABILITY_METHODS,
          standardArray: standardArray.value,
          pointBuy: pointBuy.value,
          abilities: Object.freeze(abilities),
          rulesetId: typeof ruleset.value.id === 'string' ? ruleset.value.id : null,
        }),
      );
    },

    /**
     * Markup do passo. Todo texto de catálogo é escapado.
     * @param {object} context
     * @returns {string}
     */
    render(context) {
      const data = context.data;
      if (data === null || data === undefined) {
        return '<h3>Defina seus Atributos</h3>';
      }
      const scores = readAbilityScores(context.draft);
      const bonus = draftBackgroundBonus(context);
      const method = scores.method ?? ABILITY_METHODS[0].id;
      const corpo =
        method === 'pointbuy'
          ? renderPointBuy({ data, scores, bonus })
          : method === 'rolagem'
            ? renderRolls({ data, scores, bonus })
            : renderStandard({ data, scores, bonus });

      const pericias = grantedClassSkillIds(context.draft);
      return (
        '<h3>Defina seus Atributos</h3>' +
        renderMethods(scores.method) +
        `<div id="attr-content" data-attr-method="${escapeHtmlAttribute(method)}">${corpo}</div>` +
        '<div class="section-divider mt-2"><span>Perícias da Classe</span></div>' +
        `<div class="info-box info" id="pericias-classe-resumo" data-pericias-count="${pericias.length}">` +
        (pericias.length === 0
          ? 'Nenhuma perícia de classe confirmada.'
          : `Perícias já concedidas pela classe: ${escapeHtml(pericias.join(', '))}`) +
        '</div>'
      );
    },

    /**
     * Descritor DECLARATIVO. Nenhum `addEventListener`.
     *
     * O rádio MANUAL é `disabled`: o navegador não dispara `change` nele, e
     * mesmo que disparasse o `toIntent` recusa qualquer método que não esteja
     * em `ENABLED_ABILITY_METHODS` — a desabilitação não é só visual.
     * @param {object} context
     * @returns {Readonly<object>}
     */
    bind(context) {
      return createStepBinding({
        eventTypes: ['click', 'change'],
        /**
         * @param {object} event
         * @returns {Readonly<object>}
         */
        toIntent(event) {
          const target = event.target;
          if (!target || typeof target.closest !== 'function') {
            return NO_UI_EVENT_DECISION;
          }

          if (event.type === 'change') {
            const modo = target.closest('[data-attr-mode]');
            if (modo !== null) {
              const method = modo.getAttribute('data-attr-mode');
              if (!ENABLED_ABILITY_METHODS.includes(method)) {
                return NO_UI_EVENT_DECISION;
              }
              return createUiEventDecision({
                intent: { type: ABILITIES_INTENT_TYPES.chooseMethod, method },
                preventDefault: false,
              });
            }
            const assign = target.closest('[data-attr-assign]');
            if (assign !== null) {
              const value = typeof target.value === 'string' ? target.value : '';
              const index = value === '' ? null : Number.parseInt(value, 10);
              return createUiEventDecision({
                intent: {
                  type: ABILITIES_INTENT_TYPES.assignStandard,
                  abilityKey: assign.getAttribute('data-attr-assign'),
                  index: Number.isInteger(index) ? index : null,
                },
                preventDefault: false,
              });
            }
            return NO_UI_EVENT_DECISION;
          }

          const pb = target.closest('[data-pb-key]');
          if (pb !== null) {
            const delta = Number.parseInt(pb.getAttribute('data-pb-delta') ?? '0', 10);
            if (!Number.isInteger(delta) || delta === 0) {
              return NO_UI_EVENT_DECISION;
            }
            return createUiEventDecision({
              intent: { type: ABILITIES_INTENT_TYPES.pointBuy, abilityKey: pb.getAttribute('data-pb-key'), delta },
              preventDefault: true,
            });
          }

          if (target.closest('[data-roll-all]') !== null) {
            return createUiEventDecision({ intent: { type: ABILITIES_INTENT_TYPES.roll, abilityKey: null }, preventDefault: true });
          }
          const roll = target.closest('[data-roll-key]');
          if (roll !== null) {
            return createUiEventDecision({
              intent: { type: ABILITIES_INTENT_TYPES.roll, abilityKey: roll.getAttribute('data-roll-key') },
              preventDefault: true,
            });
          }
          void context;
          return NO_UI_EVENT_DECISION;
        },
      });
    },

    /**
     * Válido quando o método escolhido está COMPLETO segundo as tabelas do
     * ruleset, e quando o bônus de antecedente confirmado tem uma das duas
     * formas legais (`+2/+1` distintos ou `+1/+1/+1`).
     * @param {object} context
     * @returns {object} ValidationResult
     */
    validate(context) {
      const data = context.data;
      if (data === null || data === undefined) {
        // Sem tabelas carregadas não há como afirmar completude; afirmar que
        // está completo seria validar no escuro.
        return { valid: false, errors: [{ code: 'CREATOR_ABILITIES_DATA_MISSING', stepId: STEP_ID }] };
      }
      const scores = readAbilityScores(context.draft);
      const errors = [];
      if (scores.method === null) {
        errors.push({ code: 'CREATOR_ABILITIES_METHOD_REQUIRED', stepId: STEP_ID });
      } else if (!ENABLED_ABILITY_METHODS.includes(scores.method)) {
        errors.push({ code: 'CREATOR_ABILITIES_METHOD_DISABLED', stepId: STEP_ID, method: scores.method });
      } else if (scores.method === 'standard') {
        const indices = ABILITY_KEYS.map((key) => scores.standardAssignment[key]).filter((index) => Number.isInteger(index));
        if (indices.length < ABILITY_KEYS.length) {
          errors.push({ code: 'CREATOR_ABILITIES_STANDARD_INCOMPLETE', stepId: STEP_ID, assigned: indices.length });
        } else if (new Set(indices).size !== indices.length) {
          // Sem reutilização: cada valor do conjunto padrão é usado UMA vez.
          errors.push({ code: 'CREATOR_ABILITIES_STANDARD_REUSED', stepId: STEP_ID });
        }
      } else if (scores.method === 'pointbuy') {
        const custo = pointBuyCost(scores.base, data.pointBuy);
        if (custo === null) {
          errors.push({ code: 'CREATOR_ABILITIES_POINT_BUY_OUT_OF_RANGE', stepId: STEP_ID });
        } else if (custo !== data.pointBuy.budget) {
          errors.push({
            code: custo > data.pointBuy.budget ? 'CREATOR_ABILITIES_POINT_BUY_OVER_BUDGET' : 'CREATOR_ABILITIES_POINT_BUY_REMAINING',
            stepId: STEP_ID,
            spent: custo,
            budget: data.pointBuy.budget,
          });
        }
      } else if (scores.method === 'rolagem') {
        const rolados = ABILITY_KEYS.filter((key) => Number.isInteger(scores.rolls[key]?.total));
        if (rolados.length < ABILITY_KEYS.length) {
          errors.push({ code: 'CREATOR_ABILITIES_ROLLS_INCOMPLETE', stepId: STEP_ID, rolled: rolados.length });
        }
      }

      const bonus = draftBackgroundBonus(context);
      if (bonus.optionId !== null && bonus.shape === null) {
        errors.push({ code: 'CREATOR_ABILITIES_BACKGROUND_BONUS_INVALID', stepId: STEP_ID, optionId: bonus.optionId });
      }
      return { valid: errors.length === 0, errors };
    },

    /**
     * Delega para a matriz OFICIAL: mudar atributos invalida os DERIVADOS, e
     * nunca escolha de outro passo.
     * @param {object} context
     * @returns {import('../../../core/result.js').Result}
     */
    invalidate(context) {
      return buildInvalidationPatch(STEP_ID, { draft: context.draft });
    },

    /**
     * Aplica a intenção de domínio ao rascunho.
     * @param {object} context
     * @param {object} intent
     * @returns {import('../../../core/result.js').Result}
     */
    reduce(context, intent) {
      const data = context.data;
      const scores = readAbilityScores(context.draft);
      let next = null;

      switch (intent?.type) {
        case ABILITIES_INTENT_TYPES.chooseMethod: {
          if (!ENABLED_ABILITY_METHODS.includes(intent.method)) {
            return err(
              stepError('CREATOR_ABILITIES_METHOD_DISABLED', `O método de atributos "${String(intent.method)}" não está ativo.`, {
                stepId: STEP_ID,
                method: typeof intent.method === 'string' ? intent.method : null,
                enabled: ENABLED_ABILITY_METHODS,
              }),
            );
          }
          if (data === null || data === undefined) {
            return err(stepError('CREATOR_ABILITIES_DATA_MISSING', `O passo "${STEP_ID}" precisa do step data para trocar de método.`, { stepId: STEP_ID }));
          }
          // Trocar de método RECOMEÇA a distribuição: manter os valores do
          // método anterior faria, por exemplo, um 15 de conjunto padrão passar
          // por compra de pontos sem ter custado ponto nenhum.
          next = {
            method: intent.method,
            standardAssignment: {},
            rolls: {},
            base: intent.method === 'pointbuy' ? pointBuyFloor(data.pointBuy) : {},
          };
          break;
        }

        case ABILITIES_INTENT_TYPES.assignStandard: {
          if (data === null || data === undefined) {
            return err(stepError('CREATOR_ABILITIES_DATA_MISSING', `O passo "${STEP_ID}" precisa do step data para distribuir o conjunto padrão.`, { stepId: STEP_ID }));
          }
          if (!ABILITY_KEYS.includes(intent.abilityKey)) {
            return err(stepError('CREATOR_ABILITIES_KEY_UNKNOWN', `"${String(intent.abilityKey)}" não é um atributo.`, { stepId: STEP_ID }));
          }
          const index = intent.index;
          if (index !== null && (!Number.isInteger(index) || index < 0 || index >= data.standardArray.length)) {
            return err(stepError('CREATOR_ABILITIES_STANDARD_INDEX_INVALID', 'O índice do conjunto padrão está fora da tabela do ruleset.', { stepId: STEP_ID, index }));
          }
          const assignment = { ...scores.standardAssignment };
          if (index === null) {
            delete assignment[intent.abilityKey];
          } else {
            // SEM REUTILIZAÇÃO: o valor atribuído a outro atributo é liberado
            // dele antes de ir para este. Trocar dois atributos de valor é uma
            // permuta, nunca uma duplicação.
            for (const key of ABILITY_KEYS) {
              if (assignment[key] === index) {
                delete assignment[key];
              }
            }
            assignment[intent.abilityKey] = index;
          }
          next = {
            method: 'standard',
            standardAssignment: assignment,
            rolls: {},
            base: Object.fromEntries(
              ABILITY_KEYS.filter((key) => Number.isInteger(assignment[key])).map((key) => [key, data.standardArray[assignment[key]]]),
            ),
          };
          break;
        }

        case ABILITIES_INTENT_TYPES.pointBuy: {
          if (data === null || data === undefined) {
            return err(stepError('CREATOR_ABILITIES_DATA_MISSING', `O passo "${STEP_ID}" precisa do step data para a compra de pontos.`, { stepId: STEP_ID }));
          }
          if (!ABILITY_KEYS.includes(intent.abilityKey)) {
            return err(stepError('CREATOR_ABILITIES_KEY_UNKNOWN', `"${String(intent.abilityKey)}" não é um atributo.`, { stepId: STEP_ID }));
          }
          const base = { ...(ABILITY_KEYS.every((key) => Number.isInteger(scores.base[key])) ? scores.base : pointBuyFloor(data.pointBuy)) };
          const alvo = base[intent.abilityKey] + intent.delta;
          if (alvo < data.pointBuy.minScore || alvo > data.pointBuy.maxScore) {
            return err(
              stepError('CREATOR_ABILITIES_POINT_BUY_OUT_OF_RANGE', `A compra de pontos aceita de ${data.pointBuy.minScore} a ${data.pointBuy.maxScore}.`, {
                stepId: STEP_ID,
                abilityKey: intent.abilityKey,
                requested: alvo,
              }),
            );
          }
          base[intent.abilityKey] = alvo;
          const custo = pointBuyCost(base, data.pointBuy);
          if (custo !== null && custo > data.pointBuy.budget) {
            return err(
              stepError('CREATOR_ABILITIES_POINT_BUY_OVER_BUDGET', `A distribuição custaria ${custo} pontos, acima do orçamento de ${data.pointBuy.budget}.`, {
                stepId: STEP_ID,
                spent: custo,
                budget: data.pointBuy.budget,
              }),
            );
          }
          next = { method: 'pointbuy', standardAssignment: {}, rolls: {}, base };
          break;
        }

        case ABILITIES_INTENT_TYPES.roll: {
          const rng = context.rng;
          if (rng === null || rng === undefined || typeof rng.next !== 'function') {
            // NUNCA `Math.random()`: sem RNG injetado a rolagem é recusada.
            return err(
              stepError('CREATOR_ABILITIES_RNG_MISSING', 'A rolagem 4d6 exige um RNG injetado na sessão ("rng.next").', {
                stepId: STEP_ID,
              }),
            );
          }
          const alvos = intent.abilityKey === null || intent.abilityKey === undefined ? [...ABILITY_KEYS] : [intent.abilityKey];
          if (alvos.some((key) => !ABILITY_KEYS.includes(key))) {
            return err(stepError('CREATOR_ABILITIES_KEY_UNKNOWN', `"${String(intent.abilityKey)}" não é um atributo.`, { stepId: STEP_ID }));
          }
          const rolls = { ...scores.rolls };
          for (const key of alvos) {
            rolls[key] = roll4d6DropLowest(rng);
          }
          next = {
            method: 'rolagem',
            standardAssignment: {},
            rolls,
            base: Object.fromEntries(ABILITY_KEYS.filter((key) => rolls[key] !== undefined).map((key) => [key, rolls[key].total])),
          };
          break;
        }

        default:
          // Intenção de outro dono: nada a fazer, e nada a inventar.
          return ok(Object.freeze({ draft: context.draft }));
      }

      const bonus = draftBackgroundBonus(context);
      const character = applyBaseToCharacter({
        character: context.draft.character,
        method: next.method,
        base: next.base,
        rolls: next.rolls,
      });

      let derivedStats = null;
      if (character !== null) {
        const projected = projectDerivedStats(character, context, bonus);
        if (projected.ok !== true) {
          return projected;
        }
        derivedStats = projected.value;
      }

      const slices = {
        abilityScores: Object.freeze({
          method: next.method,
          base: Object.freeze({ ...next.base }),
          standardAssignment: Object.freeze({ ...next.standardAssignment }),
          rolls: Object.freeze({ ...next.rolls }),
        }),
        derivedStats,
      };
      const updated = withDraftSlices(context.draft, { character, slices });
      if (updated.ok !== true) {
        return updated;
      }

      const patch = buildInvalidationPatch(STEP_ID, { draft: context.draft });
      if (patch.ok !== true) {
        return patch;
      }
      // `derivedStats` é DECLARADA como escrita mesmo quando o valor sai
      // idêntico (re-rolar e cair no mesmo total, por exemplo): a matriz limpa
      // `derivedStats` na linha `atributos`, e sem esta declaração ela apagaria
      // um derivado que o passo acabou de reafirmar (o modo de falha (b) da
      // Task 26).
      const invalidation = createInvalidationPatch({
        clearedStepIds: patch.value.clearedStepIds,
        revokedProvenanceIds: patch.value.revokedProvenanceIds,
        preservedSlices: [...new Set([...patch.value.preservedSlices, 'abilityScores', 'derivedStats'])],
      });
      return ok(Object.freeze({ draft: updated.value, invalidation }));
    },
  });
}
