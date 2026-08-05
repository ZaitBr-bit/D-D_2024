// Módulo `features/creator/steps/catalog-selection-step`: a mecânica COMUM aos
// três primeiros passos do criador (classe, espécie e antecedente).
//
// Os três fazem a mesma coisa, com conteúdo diferente: listam entidades de um
// tipo do catálogo em cards, abrem um modal com os detalhes e as escolhas
// obrigatórias da entidade, e — SOMENTE ao confirmar o modal — gravam a
// seleção, materializam as concessões e mandam a sessão revogar as da seleção
// substituída. Fatorar isso aqui é o que impede que a terceira cópia da regra
// divirja das duas primeiras (o defeito que o criador legado tem hoje: três
// blocos parecidos, cada um com um detalhe próprio).
//
// ## Nada aqui decide mecânica por nome de exibição
//
// O legado decide por texto: `NIVEL_SUBCLASSE[nome]`, `CLASSES_ESCOLHAS[nome]`,
// `ESPECIES_TRACOS_ESCOLHA[nome]` e `talento.split('(')[0]`. Nenhuma dessas
// tabelas nem esse parsing existem neste caminho. O que decide é campo
// ESTRUTURADO do catálogo: `hitDie`, `spellcasting`, `effects[].type`,
// `effects[].when`, `choice.min`/`choice.max`, `official-handler.params.featId`.
// O nome só é usado como TEXTO para o usuário ler — e sempre escapado.
//
// ## Proveniência
//
// O `sourceInstanceId` de cada seleção é derivado por `deriveSourceInstanceId`
// com a MESMA `collection`/`index`/`key` que `collectCharacterEffects` usa ao
// montar as fontes do personagem (`class`/`species`/`background`, índice 0,
// chave = id da entidade). Não é um id novo inventado aqui: é exatamente o que
// `applyGrantEffects` grava e o que `revokeGrantEffects` procura, e é por isso
// que a revogação da seleção substituída consegue ser o inverso EXATO da
// aplicação.

import { ok, err } from '../../../core/result.js';
import { escapeHtml, escapeHtmlAttribute, setSafeText } from '../../../ui/html.js';
import { createUiEventDecision, NO_UI_EVENT_DECISION } from '../../../ui/event-delegation.js';
import { collectCharacterEffects, deriveSourceInstanceId, qualifiedChoiceKey } from '../../../domain/effects/collect-effects.js';
import { applyGrantEffects, revokeGrantEffects } from '../../../domain/effects/apply-grants.js';
import { CREATOR_TRANSACTION_COMMITTED, CREATOR_INTENT_TYPES } from '../creator-intents.js';
import { buildInvalidationPatch, createInvalidationPatch, stripRevokedChoices } from '../creator-invalidation.js';
import { withDraftSlices } from '../creator-state.js';
import { createCreatorStep, createStepBinding, stepError } from './creator-step.js';

/** Prefixo dos ids de transação criados por estes passos. */
const TRANSACTION_PREFIX = 'creator';

/**
 * Monta o id de transação de uma seleção. O id CARREGA a identidade do item
 * examinado — é assim que `reduce`, que só recebe `transactionId`, sabe qual
 * entidade o jogador confirmou sem que nenhum estado intermediário precise
 * viver fora da transação.
 * @param {string} stepId
 * @param {string} contentId
 * @returns {string}
 */
export function selectionTransactionId(stepId, contentId) {
  return `${TRANSACTION_PREFIX}:${stepId}:${contentId}`;
}

/**
 * Extrai o ContentId de um id de transação deste passo, ou `null` quando o id
 * não pertence a ele.
 * @param {string} stepId
 * @param {*} transactionId
 * @returns {string|null}
 */
export function contentIdOfTransaction(stepId, transactionId) {
  const prefix = `${TRANSACTION_PREFIX}:${stepId}:`;
  if (typeof transactionId !== 'string' || !transactionId.startsWith(prefix)) {
    return null;
  }
  const contentId = transactionId.slice(prefix.length);
  return contentId.length > 0 ? contentId : null;
}

/**
 * Diz se o catálogo injetado tem a superfície mínima que estes passos usam.
 * @param {*} registry
 * @returns {boolean}
 */
function isUsableRegistry(registry) {
  return registry !== null && typeof registry === 'object' && typeof registry.list === 'function' && typeof registry.resolve === 'function';
}

/**
 * Nível do personagem do rascunho, ou `null` quando ainda não há personagem.
 *
 * `null` é deliberado: NÃO existe "nível 1 presumido" aqui. Sem personagem não
 * há nível, e um efeito com `when` de nível simplesmente não é considerado —
 * inventar 1 faria escolhas de nível 1 aparecerem para um rascunho que ainda
 * não sabe de que nível é.
 * @param {object} draft
 * @returns {number|null}
 */
export function draftLevel(draft) {
  const level = draft?.character?.state?.level;
  return Number.isInteger(level) ? level : null;
}

/**
 * Diz se um efeito está ativo para `level`, olhando SÓ o campo estruturado
 * `when` (nunca o texto do efeito).
 *
 * Só o `kind: 'level'` é avaliado aqui porque é o único gating que um passo do
 * criador pode resolver sozinho; qualquer outro `when` é deixado para o motor
 * de efeitos (`collectCharacterEffects`), que tem o contexto completo. Um
 * `when` que este módulo não sabe avaliar NÃO é tratado como "ativo": a escolha
 * não é oferecida, em vez de ser oferecida por engano.
 * @param {object} effect
 * @param {number|null} level
 * @returns {boolean}
 */
export function isEffectActiveForLevel(effect, level) {
  const when = effect?.when;
  if (when === null || when === undefined) {
    return true;
  }
  if (when.kind !== 'level') {
    return false;
  }
  if (level === null) {
    return false;
  }
  const min = Number.isInteger(when.min) ? when.min : null;
  const max = Number.isInteger(when.max) ? when.max : null;
  if (min !== null && level < min) {
    return false;
  }
  if (max !== null && level > max) {
    return false;
  }
  return true;
}

/**
 * Lista os efeitos `choice` de uma entidade que estão ativos para `level`.
 * @param {object} entity
 * @param {number|null} level
 * @returns {Array<object>}
 */
export function activeChoiceEffects(entity, level) {
  const effects = Array.isArray(entity?.effects) ? entity.effects : [];
  return effects.filter((effect) => effect?.type === 'choice' && effect.choice !== null && typeof effect.choice === 'object' && isEffectActiveForLevel(effect, level));
}

/**
 * Lê, do rascunho, o mapa de UMA fatia de escolha. As chaves são SEMPRE
 * qualificadas (`<sourceInstanceId>:<choiceId>`) — ver `collectPicks`.
 * @param {object} draft
 * @param {string} slice
 * @returns {object}
 */
function picksInSlice(draft, slice) {
  const value = draft?.slices?.[slice];
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/**
 * Junta as escolhas de todas as fatias de escolha do passo num só mapa
 * `{"<sourceInstanceId>:<choiceId>": [optionId...]}`.
 *
 * ## Por que a chave é QUALIFICADA, e nunca o `choiceId` nu
 *
 * O catálogo compartilha `choiceId` em massa entre entidades diferentes:
 * `pericias-de-classe` e `subclasse` aparecem nas 12 classes,
 * `equipamento-inicial` nas 12 classes E nos 16 antecedentes,
 * `bonus-de-atributo` e `idiomas-adicionais` nos 16 antecedentes, `tamanho` em
 * 4 espécies. Com a chave nua, trocar de entidade SEM reabrir o modal fazia as
 * escolhas da entidade antiga continuarem valendo para a nova: as que não
 * existiam lá não concediam nada mas ainda contavam em `validate` (passo
 * "válido" com zero perícias concedidas), e as que por acaso existiam com o
 * mesmo id — `equipamento-inicial` entre dois antecedentes — eram APLICADAS de
 * verdade, entregando ao jogador um item que ele nunca escolheu.
 *
 * Qualificar pelo `sourceInstanceId` (o mesmo `qualifiedChoiceKey` que o motor
 * de efeitos usa em `build.choices`) torna a coincidência de `choiceId`
 * irrelevante por construção: uma escolha feita para o Bárbaro simplesmente não
 * é legível como escolha do Mago.
 * @param {object} draft
 * @param {ReadonlyArray<string>} choiceSlices
 * @returns {object}
 */
export function collectPicks(draft, choiceSlices) {
  const merged = {};
  for (const slice of choiceSlices) {
    Object.assign(merged, picksInSlice(draft, slice));
  }
  return merged;
}

/**
 * Extrai as escolhas de UMA fonte, já desqualificadas
 * (`{choiceId: [optionId...]}`). Escolhas de qualquer outra fonte são
 * ignoradas — é isso que impede a escolha da entidade antiga de ser lida como
 * escolha da nova.
 * @param {object} picks - mapa qualificado (ver `collectPicks`)
 * @param {string} sourceInstanceId
 * @returns {object}
 */
export function picksOfSource(picks, sourceInstanceId) {
  const prefixo = `${sourceInstanceId}:`;
  const proprias = {};
  for (const [chave, valor] of Object.entries(picks)) {
    if (chave.startsWith(prefixo)) {
      proprias[chave.slice(prefixo.length)] = valor;
    }
  }
  return proprias;
}

/**
 * Normaliza um valor de escolha para array de ids de opção.
 * @param {*} value
 * @returns {Array<string>}
 */
function asOptionIds(value) {
  if (typeof value === 'string') {
    return value.length > 0 ? [value] : [];
  }
  return Array.isArray(value) ? value.filter((id) => typeof id === 'string' && id.length > 0) : [];
}

/**
 * `packageVersion` ativa do namespace de `contentId` segundo o personagem, ou
 * `null` (nunca uma versão inventada).
 * @param {object|null} character
 * @param {string} contentId
 * @returns {string|null}
 */
function packageVersionFor(character, contentId) {
  const namespace = typeof contentId === 'string' ? contentId.split(':')[0] : null;
  const scope = namespace === null ? null : character?.build?.contentScopes?.[namespace];
  return typeof scope?.packageVersion === 'string' ? scope.packageVersion : null;
}

/**
 * Monta a referência de conteúdo gravada em `build.<x>Ref`.
 * @param {object|null} character
 * @param {string} contentId
 * @returns {object}
 */
function contentRef(character, contentId) {
  const packageVersion = packageVersionFor(character, contentId);
  return packageVersion === null ? { id: contentId } : { id: contentId, packageVersion };
}

// --- Renderização ---------------------------------------------------------

/**
 * Markup de UM card de seleção, com a MESMA estrutura, classes e ordem do
 * baseline (`tests/fixtures/dom-baseline/creator-steps.json`):
 * `div.selection-card > span.card-check + div.card-nome + div.card-detalhe*`.
 *
 * `data-<passo>` continua carregando o NOME (é o atributo do baseline, e o
 * spec público de DOM o compara). A identidade MECÂNICA vai em
 * `data-content-id` — nenhuma decisão deste módulo depende do nome.
 * @param {{cardAttribute: string, card: object, selected: boolean}} params
 * @returns {string}
 */
function renderCard({ cardAttribute, card, selected }) {
  const classes = selected ? 'selection-card selected' : 'selection-card';
  const details = card.details
    .map((detail) => `<div class="card-detalhe">${escapeHtml(detail)}</div>`)
    .join('');
  return (
    `<div class="${classes}" ${cardAttribute}="${escapeHtmlAttribute(card.name)}" data-content-id="${escapeHtmlAttribute(card.id)}">` +
    '<span class="card-check">&#10003;</span>' +
    `<div class="card-nome">${escapeHtml(card.name)}</div>` +
    details +
    '</div>'
  );
}

/**
 * Markup do resumo da seleção corrente (o bloco "Alterar" do wizard legado).
 * @param {{card: object, summary: string}} params
 * @returns {string}
 */
function renderSummary({ card, summary }) {
  return (
    '<div class="selecao-resumo">' +
    '<div class="resumo-info">' +
    `<div class="resumo-titulo">${escapeHtml(card.name)}</div>` +
    `<div class="resumo-detalhe">${escapeHtml(summary)}</div>` +
    '</div>' +
    `<button class="btn btn-outline btn-sm" type="button" data-creator-reopen="${escapeHtmlAttribute(card.id)}">Alterar</button>` +
    '</div>'
  );
}

// --- Construção do corpo do modal (nós reais, nunca innerHTML) -------------

/**
 * Acrescenta a `parent` um elemento novo com texto seguro.
 * @param {object} doc
 * @param {object} parent
 * @param {string} tag
 * @param {{className?: string, text?: *, attrs?: object}} [params]
 * @returns {object} o elemento criado.
 */
function appendElement(doc, parent, tag, { className, text, attrs } = {}) {
  const element = doc.createElement(tag);
  if (typeof className === 'string') {
    element.className = className;
  }
  for (const [name, value] of Object.entries(attrs ?? {})) {
    element.setAttribute(name, String(value));
  }
  if (text !== undefined) {
    setSafeText(element, text);
  }
  parent.appendChild(element);
  return element;
}

/**
 * Monta o CONTROLE de uma escolha do catálogo.
 *
 * Escolha de uma opção só (`max === 1`) vira `<select>`; escolha múltipla vira
 * uma lista de checkboxes. São controles NATIVOS de propósito: o estado visual
 * fica no próprio DOM do navegador, então marcar uma opção não exige
 * re-renderizar o modal — e, como cada mudança é encenada na transação, o
 * rascunho continua intocado até o "Confirmar".
 * @param {object} doc
 * @param {object} parent
 * @param {{effect: object, picked: ReadonlyArray<string>}} params
 * @returns {void}
 */
function appendChoiceControl(doc, parent, { effect, picked }) {
  const choice = effect.choice;
  const min = Number.isInteger(choice.min) ? choice.min : 0;
  const max = Number.isInteger(choice.max) ? choice.max : 1;
  const group = appendElement(doc, parent, 'div', {
    className: 'form-group mt-2',
    attrs: {
      'data-choice-group': choice.id,
      'data-choice-min': String(min),
      'data-choice-max': String(max),
    },
  });
  appendElement(doc, group, 'label', { className: 'form-label', text: choice.prompt ?? choice.id });

  const options = Array.isArray(choice.options) ? choice.options : [];
  if (max === 1) {
    const select = appendElement(doc, group, 'select', {
      className: 'form-select',
      attrs: { 'data-choice-id': choice.id },
    });
    const empty = appendElement(doc, select, 'option', { text: 'Selecione uma opção', attrs: { value: '' } });
    if (picked.length === 0) {
      empty.setAttribute('selected', 'selected');
    }
    for (const option of options) {
      const node = appendElement(doc, select, 'option', {
        text: option.label ?? option.id,
        attrs: { value: option.id, 'data-option-id': option.id },
      });
      if (picked.includes(option.id)) {
        node.setAttribute('selected', 'selected');
        node.selected = true;
      }
    }
    return;
  }

  for (const option of options) {
    const wrapper = appendElement(doc, group, 'label', { className: 'checkbox-option' });
    const input = appendElement(doc, wrapper, 'input', {
      attrs: { type: 'checkbox', 'data-choice-id': choice.id, 'data-option-id': option.id, value: option.id },
    });
    if (picked.includes(option.id)) {
      input.setAttribute('checked', 'checked');
      input.checked = true;
    }
    appendElement(doc, wrapper, 'span', { text: option.label ?? option.id });
  }
}

/**
 * Monta o corpo e as ações do modal de uma seleção.
 *
 * TUDO é construído com `createElement` + `setSafeText`: nenhum ponto deste
 * caminho concatena markup com valor de catálogo. É a mesma disciplina do
 * `render`, aplicada a nós em vez de string.
 * @param {{doc: object, entity: object, describe: Function, choiceEffects: ReadonlyArray<object>, picks: object, transactionId: string, registry: object}} params
 * @returns {{content: object, actions: object}}
 */
function buildModalFragments({ doc, entity, describe, choiceEffects, picks, transactionId, registry }) {
  const content = doc.createElement('div');
  content.className = 'creator-selection-modal';
  content.setAttribute('data-creator-transaction', transactionId);
  content.setAttribute('data-content-id', entity.id);

  for (const line of describe({ entity, registry }).details) {
    appendElement(doc, content, 'div', { className: 'info-box', text: line });
  }
  if (typeof entity.description === 'string' && entity.description.length > 0) {
    appendElement(doc, content, 'p', { className: 'creator-selection-descricao', text: entity.description });
  }
  for (const effect of choiceEffects) {
    appendChoiceControl(doc, content, { effect, picked: asOptionIds(picks[effect.choice.id]) });
  }

  const actions = doc.createElement('div');
  actions.setAttribute('data-creator-transaction', transactionId);
  appendElement(doc, actions, 'button', {
    className: 'btn btn-outline',
    text: 'Cancelar',
    attrs: { type: 'button', 'data-creator-modal': 'cancel' },
  });
  appendElement(doc, actions, 'button', {
    className: 'btn btn-primary',
    text: 'Confirmar',
    attrs: { type: 'button', 'data-creator-modal': 'commit' },
  });

  return { content, actions };
}

/**
 * Cria um passo de seleção de catálogo.
 *
 * @param {{
 *   id: string,
 *   contentType: string,
 *   collection: string,
 *   heading: string,
 *   gridId: string,
 *   cardAttribute: string,
 *   introBox?: string|null,
 *   tailMarkup?: string,
 *   refField: string,
 *   identitySlice: string,
 *   choiceSlices: ReadonlyArray<string>,
 *   defaultChoiceSlice: string,
 *   choiceSliceById?: Readonly<Record<string, string>>,
 *   describe: (params: {entity: object, registry: object}) => {details: ReadonlyArray<string>, summary: string},
 *   derivedSlices?: (params: {entity: object, picks: object, registry: object}) => object
 * }} config
 * @returns {import('../../../core/result.js').Result} `ok(step)`
 */
export function createCatalogSelectionStep(config) {
  const {
    id: stepId,
    contentType,
    collection,
    heading,
    gridId,
    cardAttribute,
    introBox = null,
    tailMarkup = '',
    refField,
    identitySlice,
    choiceSlices,
    defaultChoiceSlice,
    choiceSliceById = {},
    describe,
    derivedSlices = null,
  } = config;

  /**
   * Fatia em que as escolhas de `choiceId` são gravadas.
   * @param {string} choiceId
   * @returns {string}
   */
  const sliceForChoice = (choiceId) => choiceSliceById[choiceId] ?? defaultChoiceSlice;

  /**
   * `sourceInstanceId` da seleção — o MESMO que o motor de efeitos usa.
   * @param {string} contentId
   * @returns {string}
   */
  const sourceIdFor = (contentId) => deriveSourceInstanceId({ collection, index: 0, key: contentId });

  /**
   * Entidade selecionada no rascunho, ou `null`.
   * @param {object} context
   * @returns {string|null}
   */
  const selectedContentId = (context) => {
    const selection = context.draft?.slices?.[identitySlice];
    return selection !== null && typeof selection === 'object' && typeof selection.contentId === 'string' ? selection.contentId : null;
  };

  return createCreatorStep({
    id: stepId,

    /**
     * Carrega os cards a partir do CATÁLOGO. Sem `context.registry` a carga
     * FALHA com erro nomeado — nunca devolve uma lista vazia que pareceria
     * "não há classes", que é o bypass silencioso clássico.
     * @param {object} context
     * @returns {Promise<import('../../../core/result.js').Result>}
     */
    async load(context) {
      if (!isUsableRegistry(context.registry)) {
        return err(
          stepError('CREATOR_STEP_REGISTRY_MISSING', `O passo "${stepId}" exige um ContentRegistry em "context.registry".`, {
            stepId,
            contentType,
          }),
        );
      }
      const registry = context.registry;
      const entities = registry.list(contentType);
      if (!Array.isArray(entities) || entities.length === 0) {
        return err(
          stepError('CREATOR_STEP_CATALOG_EMPTY', `O catálogo não tem nenhuma entidade do tipo "${contentType}".`, {
            stepId,
            contentType,
          }),
        );
      }

      const cards = [];
      const entitiesById = {};
      for (const entity of entities) {
        const described = describe({ entity, registry });
        cards.push(Object.freeze({ id: entity.id, name: entity.name ?? entity.id, details: Object.freeze([...described.details]), summary: described.summary }));
        entitiesById[entity.id] = entity;
      }
      return ok(Object.freeze({ stepId, contentType, cards: Object.freeze(cards), entitiesById: Object.freeze(entitiesById) }));
    },

    /**
     * Markup do passo, com a estrutura do baseline e TODO valor de catálogo
     * escapado.
     * @param {object} context
     * @returns {string}
     */
    render(context) {
      const cards = context.data?.cards ?? [];
      const selected = selectedContentId(context);
      const grid = cards.map((card) => renderCard({ cardAttribute, card, selected: card.id === selected })).join('');
      const selectedCard = cards.find((card) => card.id === selected) ?? null;
      return (
        `<h3>${escapeHtml(heading)}</h3>` +
        (introBox === null ? '' : `<div class="info-box info">${escapeHtml(introBox)}</div>`) +
        `<div class="selection-grid" id="${escapeHtmlAttribute(gridId)}">${grid}</div>` +
        (selectedCard === null ? '' : renderSummary({ card: selectedCard, summary: selectedCard.summary })) +
        tailMarkup
      );
    },

    /**
     * Descritor DECLARATIVO. Nenhum `addEventListener`: quem escuta é o
     * controller, na raiz do criador e na raiz do modal que ele mesmo abriu.
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

          // (1) Abrir o modal de uma entidade (card do grid ou "Alterar").
          // O `data-content-id` também existe na raiz do corpo do modal; por
          // isso a busca é pelo CARD (`.selection-card`), e o clique de dentro
          // de uma transação nunca reabre nada.
          if (event.type === 'click' && !target.closest('[data-creator-transaction]')) {
            const reopen = target.closest('[data-creator-reopen]');
            const card = target.closest('.selection-card[data-content-id]');
            const contentId = reopen !== null ? reopen.getAttribute('data-creator-reopen') : (card?.getAttribute('data-content-id') ?? null);
            if (typeof contentId === 'string' && contentId.length > 0) {
              return openIntent(context, contentId);
            }
          }

          const scope = target.closest('[data-creator-transaction]');
          if (!scope) {
            return NO_UI_EVENT_DECISION;
          }
          const transactionId = scope.getAttribute('data-creator-transaction');

          // (2) Confirmar / cancelar.
          if (event.type === 'click') {
            const action = target.closest('[data-creator-modal]')?.getAttribute('data-creator-modal') ?? null;
            if (action === 'commit') {
              return createUiEventDecision({
                intent: { type: CREATOR_INTENT_TYPES.modalCommit, transactionId },
                preventDefault: true,
              });
            }
            if (action === 'cancel') {
              return createUiEventDecision({
                intent: { type: CREATOR_INTENT_TYPES.modalCancel, transactionId },
                preventDefault: true,
              });
            }
            return NO_UI_EVENT_DECISION;
          }

          // (3) Mudança de uma escolha: ENCENA, nunca grava.
          if (event.type === 'change') {
            return updateIntent(context, transactionId, target);
          }
          return NO_UI_EVENT_DECISION;
        },
      });
    },

    /**
     * Válido quando há seleção E todas as escolhas ATIVAS da entidade
     * escolhida têm a quantidade de opções que o próprio catálogo exige
     * (`choice.min`/`choice.max`) — nunca um mínimo presumido.
     * @param {object} context
     * @returns {object} ValidationResult
     */
    validate(context) {
      const contentId = selectedContentId(context);
      if (contentId === null) {
        return { valid: false, errors: [{ code: 'CREATOR_SELECTION_REQUIRED', stepId }] };
      }
      const entity = context.data?.entitiesById?.[contentId] ?? null;
      if (entity === null) {
        // Sem step data carregado não há como afirmar que as escolhas estão
        // completas; afirmar que estão seria validar no escuro.
        return { valid: false, errors: [{ code: 'CREATOR_SELECTION_ENTITY_UNKNOWN', stepId, contentId }] };
      }
      // Só as escolhas feitas PARA ESTA entidade contam. Uma escolha herdada da
      // seleção anterior não pode fazer o passo passar por válido.
      const picks = picksOfSource(collectPicks(context.draft, choiceSlices), sourceIdFor(contentId));
      const errors = [];
      for (const effect of activeChoiceEffects(entity, draftLevel(context.draft))) {
        const choice = effect.choice;
        const chosen = asOptionIds(picks[choice.id]);
        const min = Number.isInteger(choice.min) ? choice.min : 0;
        const max = Number.isInteger(choice.max) ? choice.max : chosen.length;
        if (chosen.length < min || chosen.length > max) {
          errors.push({ code: 'CREATOR_CHOICE_INCOMPLETE', stepId, choiceId: choice.id, required: min, chosen: chosen.length });
        }
      }
      return { valid: errors.length === 0, errors };
    },

    /**
     * Delega para a matriz OFICIAL. `revokedProvenanceIds` sai da proveniência
     * REGISTRADA no rascunho, então revoga exatamente as concessões da seleção
     * que está sendo desfeita — nem mais, nem menos.
     * @param {object} context
     * @returns {import('../../../core/result.js').Result}
     */
    invalidate(context) {
      return buildInvalidationPatch(stepId, { draft: context.draft });
    },

    /**
     * Materializa a seleção CONFIRMADA.
     *
     * Só roda pela intenção sintética de pós-commit: nesse ponto o rascunho já
     * carrega as escolhas encenadas, e o que falta é (a) gravar a identidade,
     * (b) aplicar as concessões da entidade nova no personagem e (c) devolver
     * a invalidação para que a SESSÃO revogue as da entidade substituída.
     * @param {object} context
     * @param {object} intent
     * @returns {import('../../../core/result.js').Result}
     */
    reduce(context, intent) {
      if (intent?.type !== CREATOR_TRANSACTION_COMMITTED) {
        return ok(Object.freeze({ draft: context.draft }));
      }
      const contentId = contentIdOfTransaction(stepId, intent.transactionId);
      if (contentId === null) {
        // Transação de outro passo/outro dono: nada a fazer, e nada a
        // inventar.
        return ok(Object.freeze({ draft: context.draft }));
      }
      if (!isUsableRegistry(context.registry)) {
        return err(stepError('CREATOR_STEP_REGISTRY_MISSING', `O passo "${stepId}" exige "context.registry" para confirmar a seleção.`, { stepId }));
      }

      const resolved = context.registry.resolve(contentId, contentType);
      if (resolved.ok !== true) {
        return resolved;
      }
      const entity = resolved.value;
      const sourceInstanceId = sourceIdFor(contentId);

      // A invalidação é montada a partir do rascunho COMO ESTÁ AGORA, cuja
      // proveniência ainda é a da seleção ANTERIOR — é exatamente ela que
      // precisa ser revogada.
      const patch = buildInvalidationPatch(stepId, { draft: context.draft });
      if (patch.ok !== true) {
        return patch;
      }

      const picks = picksOfSource(collectPicks(context.draft, choiceSlices), sourceInstanceId);
      const applied = applySelectionToCharacter({ context, entity, contentId, sourceInstanceId, picks });
      if (applied.ok !== true) {
        return applied;
      }

      const slices = { [identitySlice]: Object.freeze({ contentId, packageVersion: packageVersionFor(context.draft.character, contentId) }) };
      const provenance = { [identitySlice]: [sourceInstanceId] };
      // As fatias de escolha são REESCRITAS contendo apenas as escolhas desta
      // seleção. Chaves de uma seleção substituída não sobrevivem à troca nem
      // como dado morto: se sobrevivessem, voltar para a entidade antiga
      // ressuscitaria escolhas que nunca foram reapresentadas ao jogador.
      for (const slice of choiceSlices) {
        const proprias = {};
        for (const [chave, valor] of Object.entries(picksInSlice(context.draft, slice))) {
          if (chave.startsWith(`${sourceInstanceId}:`)) {
            proprias[chave] = valor;
          }
        }
        slices[slice] = Object.freeze(proprias);
        provenance[slice] = [sourceInstanceId];
      }
      // As fatias DERIVADAS são calculadas a partir da entidade escolhida (não
      // são escolha do jogador). Elas recebem as fatias já reescritas porque
      // uma delas pode COINCIDIR com uma fatia de escolha — nesse caso quem
      // deriva é responsável por preservar o que foi encenado.
      for (const [slice, value] of Object.entries(
        derivedSlices === null ? {} : derivedSlices({ entity, picks, registry: context.registry, draft: context.draft, slices }),
      )) {
        slices[slice] = value;
        provenance[slice] = [sourceInstanceId];
      }

      const next = withDraftSlices(context.draft, { character: applied.value, slices, provenance });
      if (next.ok !== true) {
        return next;
      }

      // As fatias que este passo ESCREVEU são DECLARADAS, não inferidas.
      //
      // A sessão também as descobre por diferença (`slicesWrittenByStep`), mas
      // diferença não é escrita: numa RECONFIRMAÇÃO da mesma entidade, uma
      // fatia derivada pode ser reescrita com valor idêntico (o
      // `backgroundFeat` do mesmo antecedente, por exemplo) e a comparação não
      // vê mudança nenhuma — a matriz então limpava um dado que o passo acabara
      // de reafirmar. Declarar remove a ambiguidade: quem sabe o que escreveu é
      // quem escreveu.
      const escritas = [identitySlice, ...choiceSlices, ...Object.keys(slices)];
      const invalidation = createInvalidationPatch({
        clearedStepIds: patch.value.clearedStepIds,
        revokedProvenanceIds: patch.value.revokedProvenanceIds,
        preservedSlices: [...new Set([...patch.value.preservedSlices, ...escritas])],
      });
      return ok(Object.freeze({ draft: next.value, invalidation }));
    },
  });

  /**
   * Monta a intenção que abre o modal de uma entidade, com o corpo já
   * construído em nós reais a partir de `context.root.ownerDocument`.
   * @param {object} context
   * @param {string} contentId
   * @returns {Readonly<object>}
   */
  function openIntent(context, contentId) {
    const entity = context.data?.entitiesById?.[contentId] ?? null;
    const doc = context.root?.ownerDocument ?? null;
    if (entity === null || doc === null || typeof doc.createElement !== 'function') {
      return NO_UI_EVENT_DECISION;
    }
    const transactionId = selectionTransactionId(stepId, contentId);
    const { content, actions } = buildModalFragments({
      doc,
      entity,
      describe,
      choiceEffects: activeChoiceEffects(entity, draftLevel(context.draft)),
      // O modal é pré-preenchido SÓ com as escolhas feitas para esta entidade.
      // Abrir o Mago depois de ter confirmado o Bárbaro mostra os controles
      // vazios, não as perícias do Bárbaro.
      picks: picksOfSource(collectPicks(context.draft, choiceSlices), sourceIdFor(contentId)),
      transactionId,
      registry: context.registry,
    });
    return createUiEventDecision({
      intent: {
        type: CREATOR_INTENT_TYPES.modalBegin,
        transactionId,
        title: entity.name ?? contentId,
        content,
        actions,
      },
      preventDefault: true,
    });
  }

  /**
   * Monta a intenção de ENCENAR a escolha alterada. Lê o estado do controle
   * nativo (o navegador é quem guarda o estado visual) e o funde com o que já
   * estava encenado — nunca escreve no rascunho.
   * @param {object} context
   * @param {string} transactionId
   * @param {object} target
   * @returns {Readonly<object>}
   */
  function updateIntent(context, transactionId, target) {
    const group = target.closest('[data-choice-group]');
    if (!group) {
      return NO_UI_EVENT_DECISION;
    }
    const contentId = contentIdOfTransaction(stepId, transactionId);
    if (contentId === null) {
      return NO_UI_EVENT_DECISION;
    }
    const choiceId = group.getAttribute('data-choice-group');
    const max = Number.parseInt(group.getAttribute('data-choice-max') ?? '1', 10);
    let chosen;
    if (max === 1) {
      const value = typeof target.value === 'string' ? target.value : '';
      chosen = value.length > 0 ? [value] : [];
    } else {
      chosen = [...group.querySelectorAll('input[type="checkbox"]')]
        .filter((input) => input.checked === true)
        .map((input) => input.getAttribute('data-option-id'))
        .filter((optionId) => typeof optionId === 'string');
    }

    // A chave encenada é QUALIFICADA pela fonte da entidade que está no modal:
    // é o que garante que encenar uma escolha do Mago nunca sobrescreva (nem
    // reaproveite) a escolha de mesmo `choiceId` do Bárbaro.
    const chave = qualifiedChoiceKey(sourceIdFor(contentId), choiceId);
    const slice = sliceForChoice(choiceId);
    const staged = context.transaction?.getStaged?.(transactionId);
    const base =
      staged?.ok === true && staged.value.slices[slice] !== undefined
        ? staged.value.slices[slice]
        : picksInSlice(context.draft, slice);
    return createUiEventDecision({
      intent: {
        type: CREATOR_INTENT_TYPES.modalUpdate,
        transactionId,
        slices: { [slice]: Object.freeze({ ...base, [chave]: Object.freeze([...chosen]) }) },
      },
      preventDefault: false,
    });
  }

  /**
   * Aplica ao personagem canônico a referência da seleção nova, as escolhas
   * qualificadas e as CONCESSÕES daquela fonte.
   *
   * Só as concessões cujo `sourceInstanceId` é o desta seleção são aplicadas:
   * o motor coleta os efeitos do personagem inteiro, e aplicar tudo aqui
   * duplicaria concessões de outras fontes.
   * @param {{context: object, entity: object, contentId: string, sourceInstanceId: string, picks: object}} params
   * @returns {import('../../../core/result.js').Result} `ok(character|null)`
   */
  function applySelectionToCharacter({ context, entity, contentId, sourceInstanceId, picks }) {
    const character = context.draft?.character ?? null;
    if (character === null || typeof character !== 'object') {
      // Sem personagem canônico não há onde materializar concessão. Isso NÃO
      // é erro: o rascunho ainda guarda a seleção e a proveniência, e a
      // materialização acontece quando o personagem existir.
      return ok(null);
    }

    const qualified = {};
    for (const effect of activeChoiceEffects(entity, draftLevel(context.draft))) {
      const chosen = asOptionIds(picks[effect.choice.id]);
      if (chosen.length > 0) {
        qualified[qualifiedChoiceKey(sourceInstanceId, effect.choice.id)] = chosen;
      }
    }

    // --- RECONFIRMAÇÃO DA MESMA ENTIDADE -----------------------------------
    //
    // Confirmar o mesmo Mago de novo (pelo botão "Alterar", ou reabrindo o
    // card) trocando `opcao-a` por `opcao-b` usa o MESMO `sourceInstanceId`.
    // Sem limpar antes, a aplicação seria puramente ADITIVA: o item da opção
    // antiga continuaria no inventário ao lado do novo, e uma escolha que
    // deixou de existir continuaria em `build.choices` mandando o motor
    // conceder algo que o jogador desmarcou.
    //
    // Por isso o passo é responsável por ser IDEMPOTENTE sobre a própria
    // fonte: desfaz o que ELE mesmo materializou antes e reaplica a partir das
    // escolhas atuais. Numa TROCA de entidade isto é inócuo (a fonte nova
    // nunca materializou nada) — quem revoga a fonte SUBSTITUÍDA continua
    // sendo a sessão, pela matriz.
    const semEscolhasAntigas = stripRevokedChoices(character, [sourceInstanceId]);
    const build = {
      ...semEscolhasAntigas.build,
      [refField]: contentRef(semEscolhasAntigas, contentId),
      choices: { ...semEscolhasAntigas.build?.choices, ...qualified },
    };
    const revogado = revokeGrantEffects({ ...semEscolhasAntigas, build }, { sourceInstanceIds: [sourceInstanceId] });
    if (revogado.ok !== true) {
      return revogado;
    }
    const staged = revogado.value.character;

    const collected = collectCharacterEffects(staged, { registry: context.registry });
    if (collected.ok !== true) {
      return collected;
    }
    const mine = collected.value.filter((resolved) => resolved.sourceInstanceId === sourceInstanceId);
    const granted = applyGrantEffects(staged, mine);
    if (granted.ok !== true) {
      return granted;
    }
    return ok(granted.value.character);
  }
}
