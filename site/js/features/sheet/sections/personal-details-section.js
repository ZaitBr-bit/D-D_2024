// Seção `personal-details` (Task 32): NOME, IMAGEM, ALINHAMENTO e os campos
// pessoais (aparência, personalidade, ideais, laços, defeitos, história,
// anotações).
//
// ## Contrato de seção (Task 29), sem exceções
//
// `select` recorta a projeção; `render` devolve markup; `toIntent` devolve uma
// `UiEventDecision`. A seção não recebe repositório, não recebe processador de
// imagem e não registra listener.
//
// ## Tudo aqui é ECO de `data.identity` — não há nada a derivar
//
// Nome, alinhamento e campos pessoais são texto do jogador; nenhum deles é
// valor de jogo calculado, e por isso não existe (nem deveria existir) chave em
// `derived` para eles. É o mesmo caso das condições em
// `conditions-defenses-senses-section.js`, que ecoa `state.conditions`.
//
// ## A imagem SEMPRE passa por `resolveSafeUrl` (Task 24)
//
// `identity.image` chega de `localStorage`, de JSON importado e do Firestore —
// ou seja, é conteúdo arbitrário controlável pelo usuário. `sheet.js` legado
// interpola esse campo direto no `src` (linhas 3226/7889/8054 do baseline), o
// sink real que a Task 24 apontou. Aqui a URL só chega ao atributo depois de
// `resolveSafeUrl(..., {kind: 'character-image'})`, que exige data URL de
// imagem raster com magic bytes coerentes; uma imagem RECUSADA não vira `src`
// nenhum, e o motivo é EXIBIDO (`data-sheet-image-rejected`) em vez de virar
// uma imagem quebrada silenciosa.
//
// ## Edição de identidade FUNCIONA (correção I2 da revisão final)
//
// A lacuna 1 original desta seção ("EDIÇÃO DE IDENTIDADE SEM ALLOWLIST",
// `SHEET_IDENTITY_EDIT_NOT_ALLOWLISTED`) foi fechada: a allowlist do domínio
// (`domain/commands/edit-character.js#ALLOWED_EDIT_PATHS`) agora cobre os
// paths `identity.*` que esta seção emite (exatamente `PERSONAL_DETAIL_FIELDS`),
// e `sheet-command-map.js` mapeia `identity.*` para esta seção + resumo.
// Como o cabeçalho original previa, a seção passou a funcionar SEM uma linha
// de mudança no fluxo de intents — só as notas de lacuna saíram do markup.
//
// ## Lacuna DECLARADA (a que fica)
//
//  TROCA DE IMAGEM SEM COMANDO (`SHEET_CHARACTER_IMAGE_EDIT_NOT_COMMANDED`).
//     `identity.image` fica FORA da allowlist deliberadamente (ship-as-debt
//     decidido na revisão final): trocar a imagem exige processar um `File`
//     pela porta `infra/image/character-image-processor.js` — e uma seção é
//     PURA: não pode ler arquivo, nem chamar porta, nem `await`. A gravação
//     de `identity.image` continua recusada com `COMMAND_EDIT_PATH_NOT_ALLOWED`
//     e a seção declara o motivo.

import { escapeHtml, escapeHtmlAttribute, resolveSafeUrl, SAFE_URL_KINDS } from '../../../ui/html.js';
import { createUiEventDecision, NO_UI_EVENT_DECISION } from '../../../ui/event-delegation.js';
import { SHEET_INTENT_TYPES, createSheetIntent } from '../sheet-state.js';
import { createSheetSection } from './section-registry.js';

/** Id canônico desta seção. */
export const PERSONAL_DETAILS_SECTION_ID = 'personal-details';

/**
 * Tipos de comando canônico que esta seção emite. Confrontados com o
 * vocabulário do dispatcher pelo teste focal.
 * @type {ReadonlyArray<string>}
 */
export const PERSONAL_DETAILS_COMMAND_TYPES = Object.freeze(['edit-character-field', 'revert-character-edit']);

/** `modalId` do formulário de edição dos detalhes pessoais. */
export const PERSONAL_DETAILS_MODAL_ID = 'sheet-personal-details-edit';

/** Motivo NOMEADO da lacuna de imagem (a única que fica — ver cabeçalho). */
export const IMAGE_EDIT_UNAVAILABLE_REASON = 'SHEET_CHARACTER_IMAGE_EDIT_NOT_COMMANDED';

/** Motivo NOMEADO de uma imagem recusada por `resolveSafeUrl`. */
export const IMAGE_REJECTED_REASON = 'SHEET_CHARACTER_IMAGE_REJECTED';

/**
 * Ações de FLUXO (abrir/fechar o modal de edição). Não são tipos de comando.
 * @type {Readonly<Record<string, string>>}
 */
export const PERSONAL_DETAILS_FLOW_ACTIONS = Object.freeze({
  editOpen: 'sheet-personal-details-open',
  editClose: 'sheet-personal-details-close',
});

/**
 * Os campos pessoais editáveis, na ordem de apresentação.
 *
 * `field` é o nome CANÔNICO em `identity` (o mesmo que
 * `infra/character/character-codec.js` grava de volta no registro legado), e
 * `path` é o path de edição correspondente. Nomes de campo, não rótulos: o
 * rótulo é só de tela.
 * @type {ReadonlyArray<Readonly<{field: string, label: string, multiline: boolean}>>}
 */
export const PERSONAL_DETAIL_FIELDS = Object.freeze([
  Object.freeze({ field: 'name', label: 'Nome', multiline: false }),
  Object.freeze({ field: 'alignment', label: 'Alinhamento', multiline: false }),
  Object.freeze({ field: 'size', label: 'Tamanho', multiline: false }),
  Object.freeze({ field: 'appearance', label: 'Aparência', multiline: true }),
  Object.freeze({ field: 'personality', label: 'Personalidade', multiline: true }),
  Object.freeze({ field: 'ideals', label: 'Ideais', multiline: true }),
  Object.freeze({ field: 'bonds', label: 'Vínculos', multiline: true }),
  Object.freeze({ field: 'flaws', label: 'Defeitos', multiline: true }),
  Object.freeze({ field: 'backstory', label: 'História', multiline: true }),
  Object.freeze({ field: 'notes', label: 'Anotações', multiline: true }),
]);

/**
 * Path canônico de edição de um campo de identidade.
 * @param {string} field
 * @returns {string}
 */
export function identityEditPath(field) {
  return `identity.${field}`;
}

/**
 * Recorta do ViewModel a projeção desta seção. Pura, sem cálculo: é eco de
 * `data.identity`.
 *
 * A imagem viaja RESOLVIDA (`safeImageUrl`) e com o motivo da recusa, porque a
 * decisão de segurança é da porta `ui/html.js` e não pode depender de cada
 * `render` lembrar de chamá-la.
 * @param {object|null} viewModel
 * @returns {Readonly<object>}
 */
export function selectPersonalDetails(viewModel) {
  if (viewModel === null || typeof viewModel !== 'object') {
    return Object.freeze({ available: false });
  }
  const identity = viewModel.data?.identity ?? {};

  /** @type {Record<string, string|null>} */
  const fields = {};
  for (const { field } of PERSONAL_DETAIL_FIELDS) {
    const valor = identity[field];
    fields[field] = typeof valor === 'string' && valor !== '' ? valor : null;
  }

  const rawImage = typeof identity.image === 'string' && identity.image !== '' ? identity.image : null;
  const resolved = rawImage === null ? null : resolveSafeUrl(rawImage, { kind: SAFE_URL_KINDS.characterImage });

  return Object.freeze({
    available: true,
    characterId: typeof identity.id === 'string' ? identity.id : null,
    fields: Object.freeze(fields),
    hasImage: rawImage !== null,
    // NUNCA a URL crua: ou a resolvida pela porta, ou nada.
    safeImageUrl: resolved !== null && resolved.ok === true ? resolved.value.href : null,
    imageRejectedCode: resolved !== null && resolved.ok !== true ? resolved.error.code : null,
  });
}

/**
 * Markup da imagem do personagem.
 * @param {object} projection
 * @returns {string}
 */
function renderImage(projection) {
  if (projection.safeImageUrl !== null) {
    return `<img data-sheet-character-image src="${escapeHtmlAttribute(projection.safeImageUrl)}" alt="">`;
  }
  if (projection.hasImage) {
    // Imagem PRESENTE e RECUSADA: o motivo é exibido, não escondido.
    return (
      `<p class="sheet-note" data-sheet-image-rejected="${escapeHtmlAttribute(IMAGE_REJECTED_REASON)}" ` +
      `data-reason-code="${escapeHtmlAttribute(projection.imageRejectedCode ?? '')}">` +
      'A imagem gravada não passou na validação de segurança e não foi exibida.' +
      '</p>'
    );
  }
  return '<p class="sheet-empty" data-sheet-image-empty>Sem imagem</p>';
}

/**
 * Renderiza o miolo da seção.
 * @param {object} projection
 * @param {object} [uiState]
 * @returns {string}
 */
export function renderPersonalDetails(projection, uiState = {}) {
  void uiState;
  if (projection === null || typeof projection !== 'object' || projection.available !== true) {
    return '<p class="sheet-empty" data-sheet-details-unavailable>Detalhes indisponíveis: a ficha não tem projeção canônica.</p>';
  }

  const campos = PERSONAL_DETAIL_FIELDS.map(({ field, label }) => {
    const valor = projection.fields[field];
    return (
      `<li data-sheet-detail-field="${escapeHtmlAttribute(field)}">` +
      `<span data-sheet-detail-label>${escapeHtml(label)}</span>` +
      // Texto do jogador: SEMPRE escapado. Ausência permanece ausência ("—"),
      // nunca substituída por um valor plausível.
      `<span data-sheet-detail-value>${valor === null ? '—' : escapeHtml(valor)}</span>` +
      '</li>'
    );
  }).join('');

  return (
    '<div class="sheet-details" data-sheet-personal-details>' +
    renderImage(projection) +
    `<ul data-sheet-detail-fields>${campos}</ul>` +
    `<button type="button" data-action="${escapeHtmlAttribute(PERSONAL_DETAILS_FLOW_ACTIONS.editOpen)}">Editar detalhes</button>` +
    // Lacuna DECLARADA que fica (ver cabeçalho) — a nota de identidade saiu
    // com a correção I2: a allowlist do domínio cobre `identity.*` agora.
    `<p class="sheet-note" data-sheet-image-edit-unavailable="${escapeHtmlAttribute(IMAGE_EDIT_UNAVAILABLE_REASON)}">` +
    'Trocar a imagem ainda não tem comando canônico.' +
    '</p>' +
    '</div>'
  );
}

/**
 * Envolve o markup de um modal com o marcador de DONO.
 * @param {string} markup
 * @returns {string}
 */
function owned(markup) {
  return `<div data-sheet-modal-owner="${escapeHtmlAttribute(PERSONAL_DETAILS_SECTION_ID)}">${markup}</div>`;
}

/**
 * Descreve o modal de edição dos detalhes pessoais.
 *
 * Cada campo nasce com o valor ATUAL (escapado como atributo/texto), e cada
 * botão de gravação carrega o `data-path` canônico do campo — é isso que torna
 * a edição simétrica: um `edit-character-field` de um path é desfeito por um
 * `revert-character-edit` do MESMO path.
 * @param {object} projection
 * @returns {{content: string, actions: string}}
 */
function describeEditModal(projection) {
  const linhas = PERSONAL_DETAIL_FIELDS.map(({ field, label, multiline }) => {
    const valor = projection.fields?.[field] ?? '';
    const campo = multiline
      ? `<textarea data-sheet-detail-input="${escapeHtmlAttribute(field)}">${escapeHtml(valor)}</textarea>`
      : `<input type="text" data-sheet-detail-input="${escapeHtmlAttribute(field)}" value="${escapeHtmlAttribute(valor)}">`;
    return (
      `<label data-sheet-detail-editor="${escapeHtmlAttribute(field)}">` +
      `<span>${escapeHtml(label)}</span>` +
      campo +
      `<button type="button" data-action="edit-character-field" data-path="${escapeHtmlAttribute(identityEditPath(field))}" ` +
      `data-field="${escapeHtmlAttribute(field)}">Gravar</button>` +
      `<button type="button" data-action="revert-character-edit" data-path="${escapeHtmlAttribute(identityEditPath(field))}">Reverter</button>` +
      '</label>'
    );
  }).join('');

  return {
    content:
      '<div data-sheet-details-form>' +
      linhas +
      `<p class="sheet-note" data-sheet-image-edit-unavailable="${escapeHtmlAttribute(IMAGE_EDIT_UNAVAILABLE_REASON)}">` +
      'A imagem não é editável por aqui: processá-la exige a porta de imagem, e uma seção é pura.' +
      '</p>' +
      '</div>',
    actions: `<button type="button" data-action="${escapeHtmlAttribute(PERSONAL_DETAILS_FLOW_ACTIONS.editClose)}">Fechar</button>`,
  };
}

/**
 * Traduz um evento em `UiEventDecision`.
 *
 * `edit-character-field` monta `{path, value}` com o texto do campo — sem
 * validar nada: quem decide se o path é editável e se o valor serve é o
 * domínio. Um campo vazio vira `value: ''` (string vazia é um valor de texto
 * legítimo, diferente de ausência), e o path SEMPRE viaja, para que a recusa
 * seja sobre o path certo.
 *
 * Qualquer outro `data-action` vira um comando com aquele `type`, que o
 * dispatcher recusa com `COMMAND_TYPE_UNKNOWN` — nunca um clique inerte.
 *
 * @param {object} event
 * @param {{root: object, projection: object, uiState: object}} context
 * @returns {Readonly<object>} UiEventDecision
 */
export function personalDetailsToIntent(event, context = {}) {
  if (event?.type !== 'click') {
    return NO_UI_EVENT_DECISION;
  }
  const target = event.target;
  const acionado = typeof target?.closest === 'function' ? target.closest('[data-action]') : null;
  if (acionado === null || acionado === undefined) {
    return NO_UI_EVENT_DECISION;
  }
  const action = acionado.getAttribute('data-action');
  if (typeof action !== 'string' || action.length === 0) {
    return NO_UI_EVENT_DECISION;
  }

  if (action === PERSONAL_DETAILS_FLOW_ACTIONS.editOpen) {
    const descricao = describeEditModal(context.projection ?? {});
    return createUiEventDecision({
      intent: createSheetIntent(SHEET_INTENT_TYPES.modalOpen, {
        modalId: PERSONAL_DETAILS_MODAL_ID,
        title: 'Editar detalhes',
        content: owned(descricao.content),
        actions: owned(descricao.actions),
        uiStatePatch: null,
      }),
      preventDefault: true,
    });
  }
  if (action === PERSONAL_DETAILS_FLOW_ACTIONS.editClose) {
    // CANCELAR/FECHAR não emite comando: nada é mutado.
    return createUiEventDecision({
      intent: createSheetIntent(SHEET_INTENT_TYPES.modalClose, { modalId: PERSONAL_DETAILS_MODAL_ID }),
      preventDefault: true,
    });
  }

  /** @type {Record<string, *>} */
  const command = { type: action };
  const path = acionado.getAttribute('data-path');
  if (typeof path === 'string' && path !== '') {
    command.path = path;
  }
  if (action === 'edit-character-field') {
    const field = acionado.getAttribute('data-field');
    const raiz =
      (typeof acionado.closest === 'function' ? acionado.closest('[data-sheet-modal-owner]') : null) ?? context.root ?? null;
    const campo =
      raiz !== null && typeof raiz.querySelector === 'function' && typeof field === 'string'
        ? raiz.querySelector(`[data-sheet-detail-input="${field}"]`)
        : null;
    command.value = typeof campo?.value === 'string' ? campo.value : '';
  }

  return createUiEventDecision({
    intent: createSheetIntent(SHEET_INTENT_TYPES.command, { command }),
    preventDefault: true,
  });
}

/**
 * Cria a seção `personal-details` validada pelo registro.
 * @returns {import('../../../core/result.js').Result} Result<Section, AppError>
 */
export function createPersonalDetailsSection() {
  return createSheetSection({
    id: PERSONAL_DETAILS_SECTION_ID,
    select: selectPersonalDetails,
    render: renderPersonalDetails,
    toIntent: personalDetailsToIntent,
    eventTypes: ['click'],
  });
}
