// Seção `resources-features` (Task 30): RECURSOS e CARACTERÍSTICAS de classe —
// os usos de Fúria, Pontos de Foco, Inspiração de Bardo, Surto de Ação e
// companhia, mais as AÇÕES que os consomem e os descansos que os recarregam.
//
// É a seção mais arriscada do brief, por três razões concretas, e cada uma
// tem uma resposta estrutural aqui.
//
// ## 1. Nenhuma mecânica de classe é reimplementada
//
// Toda a superfície vem de `derived.classActions`, que é o retorno literal de
// `handler.project()` (`domain/rulesets/dnd2024/handlers/class-handler.js`,
// Tasks 20/21/22a) atravessando a porta autorizada. A seção não sabe o que é
// Fúria, não sabe que o Bárbaro recupera 1 uso no descanso curto e não sabe
// quais níveis destravam o quê. Ela desenha `{actionId, available, reason}` e
// `{current, max, missing}`.
//
// A consequência que interessa: `available` é calculado pelas MESMAS condições
// que `execute` aplica (é o mesmo `describeAvailability`), então a interface
// não consegue oferecer um botão que o comando recusaria — nem esconder um que
// ele aceitaria.
//
// ## 2. Recurso ausente é `{current: null, missing: true}`, e aparece assim
//
// Personagem migrado que nunca materializou o recurso de classe projeta
// `missing: true`. A seção mostra `—` e `data-missing="true"`, NUNCA um valor
// inferido — nem "máximo, porque está descansado", nem "zero, porque nunca
// usou". As duas invenções são plausíveis e ambas erradas, e é por isso que o
// handler se recusa a adivinhar (`HANDLER_RESOURCE_NOT_INITIALIZED`).
//
// ## 3. Ação indisponível continua CLICÁVEL — de propósito
//
// A ação indisponível é renderizada com `aria-disabled="true"`,
// `data-available="false"` e `data-reason="<código>"`, e **não** com o atributo
// `disabled`. É deliberado: um botão `disabled` é engolido pelo navegador
// antes de qualquer handler, o que produz exatamente a experiência que este
// projeto persegue — um clique que não faz nada e não explica nada. Clicando,
// o comando chega ao handler e volta com o motivo NOMEADO
// (`HANDLER_ACTION_LEVEL_TOO_LOW`, `HANDLER_RESOURCE_INSUFFICIENT`,
// `HANDLER_RESOURCE_NOT_INITIALIZED`, ...), que o controller notifica.
//
// É também o que torna verificável o item 3 do brief: para TODA ação do
// catálogo existe um elemento carregando o `actionId`, e disparar qualquer um
// deles devolve `ok: true` ou um erro de validação DECLARADO.
//
// ## Descansos
//
// Os botões de descanso emitem `short-rest`/`long-rest` — os comandos
// canônicos, que desde esta task COMPÕEM o `onRest` de cada handler de classe
// dentro do mesmo `CommandResult` (decisão registrada em
// `questions-for-review.txt` item 15). Não existe um comando de "descanso de
// classe" separado a disparar aqui, e é por isso que não há como aplicar meio
// descanso.

import { escapeHtml, escapeHtmlAttribute } from '../../../ui/html.js';
import { createUiEventDecision, NO_UI_EVENT_DECISION } from '../../../ui/event-delegation.js';
import { SHEET_INTENT_TYPES, createSheetIntent } from '../sheet-state.js';
import { createSheetSection } from './section-registry.js';

/** Id canônico desta seção. */
export const RESOURCES_FEATURES_SECTION_ID = 'resources-features';

/**
 * `data-action` de uma ação de classe. É o `type` do comando canônico
 * `class-action`; o handler e a ação viajam em atributos próprios, porque um
 * `data-action` por ação criaria ~110 tipos de comando inexistentes.
 * @type {string}
 */
export const CLASS_ACTION = 'class-action';

/**
 * Tipos de comando canônico que esta seção emite. Confrontados com o
 * dispatcher pelo teste focal.
 * @type {ReadonlyArray<string>}
 */
export const RESOURCES_FEATURES_COMMAND_TYPES = Object.freeze([CLASS_ACTION, 'short-rest', 'long-rest']);

/**
 * Formata um valor, distinguindo ausência de zero.
 * @param {*} value
 * @returns {string}
 */
function plain(value) {
  return value === null || value === undefined ? '—' : String(value);
}

/**
 * Humaniza um slug (`centelha-divina` -> `Centelha divina`) como ÚLTIMO
 * recurso de exibição (correção I3): usado apenas quando o handler não
 * declara `label`, e SEMPRE acompanhado de `data-label-fallback="true"` no
 * markup — sinalização honesta, nunca um rótulo silenciosamente inventado
 * (o slug não carrega acentos; o fallback é legível, não é o nome oficial).
 * @param {string} slug
 * @returns {string}
 */
function humanizeSlug(slug) {
  const texto = String(slug).split(':').pop().replace(/-/g, ' ');
  return texto.length === 0 ? String(slug) : texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Recorta do ViewModel a projeção desta seção. Pura, sem cálculo.
 * @param {object|null} viewModel
 * @returns {Readonly<object>}
 */
export function selectResourcesFeatures(viewModel) {
  if (viewModel === null || typeof viewModel !== 'object') {
    return Object.freeze({ available: false });
  }
  const derived = viewModel.derived ?? {};
  const data = viewModel.data ?? {};
  const classActions = derived.classActions ?? { available: false, unavailableReason: 'CLASS_ACTIONS_ABSENT', handlers: [] };

  return Object.freeze({
    available: true,
    // Projeção dos handlers de classe: `{available, unavailableReason, handlers}`.
    classActions: Object.freeze({
      available: classActions.available === true,
      unavailableReason: classActions.unavailableReason ?? null,
      handlers: Object.freeze([...(classActions.handlers ?? [])]),
    }),
    // Recursos DECLARADOS pelo conteúdo (teto por efeito `resource`), a
    // leitura compartilhada com o comando de descanso.
    resources: Object.freeze({ ...(derived.resources ?? {}) }),
    // Recursos do registro legado que ainda não têm equivalente declarativo.
    // Eco literal — a seção não os interpreta.
    legacyResources: data.extensions?.legacyPassthrough?.recursos ?? null,
  });
}

/**
 * Markup de UMA entrada de recurso projetada por um handler.
 *
 * `missing: true` produz `—` e `data-missing="true"`. Ver o cabeçalho: um
 * recurso não materializado não é zero e não é o máximo.
 * @param {string} resourceId
 * @param {object} entry
 * @returns {string}
 */
function renderResourceEntry(resourceId, entry) {
  const ausente = entry?.missing === true;
  // Rótulo de exibição (correção I3): o `label` pt-BR declarado no handler
  // (fonte: monólito congelado); sem ele, o slug humanizado COM sinalização
  // — nunca o ContentId cru `dnd2024:resource:...` na tela.
  const temLabel = typeof entry?.label === 'string' && entry.label.length > 0;
  const rotulo = temLabel ? entry.label : humanizeSlug(resourceId);
  return (
    `<li data-sheet-resource="${escapeHtmlAttribute(resourceId)}" ` +
    `data-missing="${ausente ? 'true' : 'false'}"` +
    `${temLabel ? '' : ' data-label-fallback="true"'}` +
    // `data-foreign` só existe quando a entrada pertence a OUTRA proveniência
    // (`sourceInstanceId` de outra fonte). O handler nunca a sobrescreve, e a
    // tela não pode fingir que ela é deste personagem.
    `${entry?.foreign === true ? ' data-foreign="true"' : ''}>` +
    `<span data-sheet-resource-label>${escapeHtml(rotulo)}</span>` +
    `<span data-sheet-resource-current>${escapeHtml(ausente ? '—' : plain(entry?.current))}</span>` +
    `<span data-sheet-resource-max>${escapeHtml(plain(entry?.max))}</span>` +
    '</li>'
  );
}

/**
 * Markup de UMA ação de classe.
 *
 * Sempre renderizada, disponível ou não — é o que garante que exista um
 * elemento por ação do catálogo. Ver o cabeçalho sobre `aria-disabled` em vez
 * de `disabled`.
 * @param {{handlerId: string, entityId: string}} handler
 * @param {object} action
 * @returns {string}
 */
function renderAction(handler, action) {
  const disponivel = action?.available === true;
  // Texto do botão (correção I3): o `label` pt-BR projetado pelo handler
  // vence sempre; sem ele, o slug humanizado com `data-label-fallback="true"`
  // — o jogador nunca mais lê `centelha-divina` cru, e a ausência de rótulo
  // declarado continua visível para diagnóstico, não disfarçada.
  const temLabel = typeof action?.label === 'string' && action.label.length > 0;
  const texto = temLabel ? action.label : humanizeSlug(action?.actionId ?? '');
  return (
    '<button type="button" ' +
    `data-action="${escapeHtmlAttribute(CLASS_ACTION)}" ` +
    `data-handler-id="${escapeHtmlAttribute(handler.handlerId)}" ` +
    `data-entity-id="${escapeHtmlAttribute(handler.entityId)}" ` +
    `data-action-id="${escapeHtmlAttribute(action?.actionId ?? '')}" ` +
    `data-available="${disponivel ? 'true' : 'false'}" ` +
    `aria-disabled="${disponivel ? 'false' : 'true'}"` +
    `${temLabel ? '' : ' data-label-fallback="true"'}` +
    `${disponivel ? '' : ` data-reason="${escapeHtmlAttribute(action?.reason ?? '')}"`}>` +
    escapeHtml(texto) +
    '</button>'
  );
}

/**
 * Renderiza o miolo da seção.
 * @param {object} projection
 * @param {object} [uiState]
 * @returns {string}
 */
export function renderResourcesFeatures(projection, uiState = {}) {
  void uiState;
  if (projection === null || typeof projection !== 'object' || projection.available !== true) {
    return '<p class="sheet-empty" data-sheet-resources-unavailable>Recursos indisponíveis: a ficha não tem projeção canônica.</p>';
  }

  const classActions = projection.classActions;

  // AUSÊNCIA DECLARADA. Sem a porta de handlers, sem catálogo, ou com um
  // handler que falhou ao projetar, a seção diz POR QUÊ — nunca desenha uma
  // lista vazia, que o jogador leria como "minha classe não tem recursos".
  const blocoIndisponivel = classActions.available
    ? ''
    : `<p class="sheet-empty" data-sheet-class-actions-unavailable="${escapeHtmlAttribute(
        classActions.unavailableReason ?? '',
      )}">As ações de classe não puderam ser projetadas.</p>`;

  const blocosDeClasse = classActions.handlers
    .map((entrada) => {
      const projecao = entrada.projection ?? {};
      const recursos = Object.entries(projecao.resources ?? {});
      const acoes = Array.isArray(projecao.actions) ? projecao.actions : [];
      return (
        `<section data-sheet-class-handler="${escapeHtmlAttribute(entrada.handlerId)}" ` +
        `data-sheet-class-entity="${escapeHtmlAttribute(entrada.entityId)}" ` +
        `data-sheet-class-level="${escapeHtmlAttribute(plain(projecao.level))}">` +
        '<ul data-sheet-resources>' +
        recursos.map(([resourceId, entry]) => renderResourceEntry(resourceId, entry)).join('') +
        '</ul>' +
        '<ul data-sheet-class-flags>' +
        Object.entries(projecao.flags ?? {})
          .map(
            ([flagKey, value]) =>
              `<li data-sheet-flag="${escapeHtmlAttribute(flagKey)}" data-value="${value === true ? 'true' : 'false'}"></li>`,
          )
          .join('') +
        '</ul>' +
        '<div data-sheet-class-actions>' +
        acoes.map((action) => renderAction(entrada, action)).join('') +
        '</div>' +
        '</section>'
      );
    })
    .join('');

  const legado =
    projection.legacyResources === null || typeof projection.legacyResources !== 'object'
      ? ''
      : '<ul data-sheet-legacy-resources>' +
        Object.keys(projection.legacyResources)
          .map((chave) => `<li data-sheet-legacy-resource="${escapeHtmlAttribute(chave)}"></li>`)
          .join('') +
        '</ul>';

  return (
    '<div class="sheet-resources" data-sheet-resources-features>' +
    blocoIndisponivel +
    blocosDeClasse +
    legado +
    '<div data-sheet-rest-controls>' +
    '<button type="button" data-action="short-rest">Descanso curto</button>' +
    '<button type="button" data-action="long-rest">Descanso longo</button>' +
    '</div>' +
    '</div>'
  );
}

/**
 * Traduz um evento em `UiEventDecision`.
 *
 * `class-action` monta o comando canônico com `handlerId`/`entityId`/`actionId`
 * lidos dos atributos do próprio botão. Qualquer outro `data-action` vira um
 * comando com aquele `type` — o que faz `short-rest`/`long-rest` funcionarem e
 * faz um `data-action` inventado ser recusado com `COMMAND_TYPE_UNKNOWN`.
 * Não existe caminho entre "elemento com `data-action`" e "nada acontece".
 *
 * @param {object} event
 * @param {{root: object, projection: object, uiState: object}} context
 * @returns {Readonly<object>} UiEventDecision
 */
export function resourcesFeaturesToIntent(event, context = {}) {
  void context;
  if (event?.type !== 'click') {
    return NO_UI_EVENT_DECISION;
  }
  const target = event.target;
  const acionado = typeof target?.closest === 'function' ? target.closest('[data-action]') : null;
  if (acionado === null || acionado === undefined) {
    return NO_UI_EVENT_DECISION;
  }
  const type = acionado.getAttribute('data-action');
  if (typeof type !== 'string' || type.length === 0) {
    return NO_UI_EVENT_DECISION;
  }

  /** @type {Record<string, *>} */
  const command = { type };
  if (type === CLASS_ACTION) {
    // Os três viajam SEMPRE, mesmo ausentes: um botão malformado é recusado
    // por `COMMAND_CLASS_ACTION_HANDLER_ID_INVALID` /
    // `COMMAND_CLASS_ACTION_ACTION_ID_INVALID`, erros declarados, e nunca
    // engolido aqui.
    command.handlerId = acionado.getAttribute('data-handler-id');
    command.entityId = acionado.getAttribute('data-entity-id');
    command.actionId = acionado.getAttribute('data-action-id');
  }

  return createUiEventDecision({
    intent: createSheetIntent(SHEET_INTENT_TYPES.command, { command }),
    preventDefault: true,
  });
}

/**
 * Cria a seção `resources-features` validada pelo registro.
 * @returns {import('../../../core/result.js').Result} Result<Section, AppError>
 */
export function createResourcesFeaturesSection() {
  return createSheetSection({
    id: RESOURCES_FEATURES_SECTION_ID,
    select: selectResourcesFeatures,
    render: renderResourcesFeatures,
    toIntent: resourcesFeaturesToIntent,
    eventTypes: ['click'],
  });
}
