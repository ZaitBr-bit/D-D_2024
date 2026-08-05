// Seção `feats-progression` (Task 30): TALENTOS, XP e PROGRESSÃO de nível,
// mais o ponto de entrada do fluxo de subir de nível (`level-up-flow-view.js`).
//
// ## Contrato de seção (Task 29), sem exceções
//
// `select` recorta a projeção; `render` devolve markup; `toIntent` devolve uma
// `UiEventDecision`. A seção não recebe repositório, não recebe registro
// persistido, não recebe `ModalService` e não registra listener. Quando ela
// quer um modal, ela o DESCREVE (`sheet/modal-open`) e o controller o abre.
//
// ## Os dois modos do fluxo de level-up moram em `level-up-flow-view.js`
//
// Esta seção só decide QUANDO abrir o fluxo; QUAL vista desenhar é decisão de
// `describeLevelUpModal`, a partir da flag `feature.levelup.flow.v2`. Os dois
// modos confirmam pelo MESMO comando canônico `level-up`
// (`domain/progression/level-up.js`, Task 23) — ver o cabeçalho daquele módulo.
//
// ## Transação de modal: só o COMMIT altera o personagem
//
// Mesmo padrão das Tasks 25/26/29. `level-up-close` produz `sheet/modal-close`
// e mais nada: cancelar não emite comando, não grava preferência e não deixa
// resíduo — o personagem confirmado permanece byte a byte como estava. Só
// `data-action="level-up"` (o `type` do comando canônico) muta, e a mutação é
// atômica dentro de `applyLevelUp`, com rollback total já testado na Task 23.
//
// ## XP e testes de morte: LEITURA (lacuna DECLARADA)
//
// `state.xp` é exibido, e não editável: o vocabulário fechado de comandos da
// Task 17 não tem um comando que altere XP, e `sheet-command-map.js` não mapeia
// o path `state.xp`. Desenhar um campo editável sem comando por trás seria o
// bypass silencioso que este projeto persegue. A lacuna está registrada no
// relatório da Task 30.
//
// ## De onde vêm as OPÇÕES do nível (e por que a ausência é explícita)
//
// O fluxo em cards projeta `getLevelUpOptions` (Task 23), que exige o
// personagem canônico e o catálogo — nenhum dos dois está ao alcance de uma
// seção. A projeção precisa, portanto, chegar pelo ViewModel
// (`derived.levelUp`). Enquanto essa chave não existir na lista fechada de
// `sheet-view-model.js`, o cartão é renderizado no seu estado de ERRO
// DECLARADO (`data-levelup-error`), com a razão visível — nunca como um
// conjunto de cartões vazio que pareceria "este nível não pede nada".

import { escapeHtml, escapeHtmlAttribute } from '../../../ui/html.js';
import { createUiEventDecision, NO_UI_EVENT_DECISION } from '../../../ui/event-delegation.js';
import { SHEET_INTENT_TYPES, createSheetIntent } from '../sheet-state.js';
import { createSheetSection } from './section-registry.js';
import { LEVEL_UP_FLOW_ACTIONS, LEVEL_UP_MODAL_ID, describeLevelUpModal } from './level-up-flow-view.js';

/** Id canônico desta seção. */
export const FEATS_PROGRESSION_SECTION_ID = 'feats-progression';

/**
 * `data-action` que ABREM o fluxo de level-up. Separado dos `data-action` de
 * comando: abrir um modal não é mutar o personagem.
 * @type {string}
 */
export const OPEN_LEVEL_UP_ACTION = 'level-up-open';

/**
 * Tipos de comando canônico que esta seção emite. Confrontados com o
 * vocabulário do dispatcher pelo teste focal, pela mesma razão de
 * `summary-combat-section.js`: um comando renomeado no domínio quebra o teste
 * em vez de apagar um botão em silêncio.
 * @type {ReadonlyArray<string>}
 */
export const FEATS_PROGRESSION_COMMAND_TYPES = Object.freeze(['level-up', 'choose-feat']);

/**
 * Recorta do ViewModel a projeção desta seção. Pura, sem cálculo.
 * @param {object|null} viewModel
 * @returns {Readonly<object>}
 */
export function selectFeatsProgression(viewModel) {
  if (viewModel === null || typeof viewModel !== 'object') {
    return Object.freeze({ available: false });
  }
  const data = viewModel.data ?? {};
  const derived = viewModel.derived ?? {};
  const build = data.build ?? {};
  const state = data.state ?? {};

  return Object.freeze({
    available: true,
    level: state.level ?? null,
    xp: state.xp ?? null,
    proficiencyBonus: derived.proficiencyBonus ?? null,
    featRefs: Object.freeze([...(build.featRefs ?? [])]),
    subclassRef: build.subclassRef ?? null,
    // NOME de exibição da subclasse, resolvido no catálogo (Task 33). A
    // referência crua continua viajando (é a identidade, e o atributo do
    // markup se ancora nela); o TEXTO passou a ser o nome. Sem isto a ficha
    // mostrava `dnd2024:subclass:dominio-da-vida` ao jogador — o mesmo defeito
    // que `derived.defenses.*Labels` fechou para os tipos de dano, e achado
    // pela mesma via (o cutover público). Nada é resolvido aqui: o nome já
    // está em `derived.printable.headline`, que é a chave da lista FECHADA
    // criada justamente para carregar nomes resolvidos.
    subclassName: derived.printable?.headline?.subclassName ?? null,
    choices: Object.freeze({ ...(build.choices ?? {}) }),
    // Rolagens de PV por nível: eco literal do estado (é registro do que o
    // jogador rolou, não uma conta).
    hitPointRolls: Object.freeze([...(state.hitPointRolls ?? [])]),
    // Projeção do PRÓXIMO nível (`derived.levelUp`, extensão da Task 30):
    // `{available, unavailableReason, options}`. Alimenta os cards do modo v2 —
    // e, quando indisponível (nível 20, catálogo ausente), o motivo NOMEADO que
    // a vista mostra em vez de cartões vazios.
    levelUp: derived.levelUp ?? null,
  });
}

/**
 * Nome exibível de uma referência de conteúdo, sem resolver catálogo (a seção
 * não o tem): usa o `name` quando a referência já vem enriquecida, senão o
 * próprio `id`. Nunca inventa um rótulo.
 * @param {*} reference
 * @returns {string}
 */
function refLabel(reference) {
  if (typeof reference === 'string') {
    return reference;
  }
  if (reference !== null && typeof reference === 'object') {
    return typeof reference.name === 'string' && reference.name.length > 0 ? reference.name : (reference.id ?? '');
  }
  return '';
}

/**
 * Renderiza o miolo da seção.
 * @param {object} projection
 * @param {object} [uiState]
 * @returns {string}
 */
export function renderFeatsProgression(projection, uiState = {}) {
  void uiState;
  if (projection === null || typeof projection !== 'object' || projection.available !== true) {
    return '<p class="sheet-empty" data-sheet-progression-unavailable>Progressão indisponível: a ficha não tem projeção canônica.</p>';
  }

  const talentos =
    projection.featRefs.length === 0
      ? '<p class="sheet-empty" data-sheet-feats-empty>Nenhum talento registrado.</p>'
      : '<ul data-sheet-feats>' +
        projection.featRefs
          .map((ref) => {
            const id = typeof ref === 'string' ? ref : (ref?.id ?? '');
            return `<li data-sheet-feat="${escapeHtmlAttribute(id)}">${escapeHtml(refLabel(ref))}</li>`;
          })
          .join('') +
        '</ul>';

  const rolagens =
    '<ul data-sheet-hit-point-rolls>' +
    projection.hitPointRolls
      .map((roll, indice) => `<li data-sheet-hit-point-roll="${escapeHtmlAttribute(indice)}">${escapeHtml(String(roll))}</li>`)
      .join('') +
    '</ul>';

  return (
    '<div class="sheet-progression" data-sheet-progression>' +
    `<p data-sheet-level>${escapeHtml(projection.level ?? '—')}</p>` +
    `<p data-sheet-xp>${escapeHtml(projection.xp ?? '—')}</p>` +
    `<p data-sheet-subclass="${escapeHtmlAttribute(
      typeof projection.subclassRef === 'string' ? projection.subclassRef : (projection.subclassRef?.id ?? ''),
    )}">${escapeHtml(projection.subclassName ?? refLabel(projection.subclassRef))}</p>` +
    talentos +
    rolagens +
    `<button type="button" data-action="${escapeHtmlAttribute(OPEN_LEVEL_UP_ACTION)}">Subir de Nível</button>` +
    '</div>'
  );
}

/**
 * Traduz um evento em `UiEventDecision`.
 *
 * Quatro `data-action` são reconhecidos, e cada um vira uma intenção do
 * vocabulário FECHADO de `SHEET_INTENT_TYPES`:
 *
 *   - `level-up-open`     -> `sheet/modal-open` com a vista escolhida pela flag;
 *   - `level-up-close`    -> `sheet/modal-close` (cancelar não muta nada);
 *   - `level-up-enable-v2`-> `sheet/ui-state` (religa a flag e reabre no modo
 *     v2 — é a mesma sequência do baseline, que salva a flag e chama
 *     `abrirModalLevelUp()` de novo);
 *   - `level-up`          -> `sheet/command` com o comando canônico.
 *
 * Qualquer OUTRO `data-action` dentro desta seção vira um comando com aquele
 * `type`, e o dispatcher o recusa com `COMMAND_TYPE_UNKNOWN` — um erro de
 * validação declarado. Nunca um clique que não faz nada.
 *
 * @param {object} event
 * @param {{root: object, projection: object, uiState: object}} context
 * @returns {Readonly<object>} UiEventDecision
 */
export function featsProgressionToIntent(event, context = {}) {
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

  const uiState = context.uiState ?? {};
  const projection = context.projection ?? {};

  if (action === OPEN_LEVEL_UP_ACTION || action === LEVEL_UP_FLOW_ACTIONS.enableV2) {
    // Religar a flag e reabrir são UMA coisa só do ponto de vista do jogador,
    // e por isso viajam numa intenção só: `uiStatePatch` carrega a mudança de
    // preferência, que o CONTROLLER aplica (via `session.setUiState`) antes de
    // abrir o modal — e a sessão a PERSISTE em `feature.levelup.flow.v2`.
    //
    // A primeira versão desta função só marcava `levelUpFlowV2: true` no
    // payload da intent e mais nada. O modal reabria em cards, então parecia
    // funcionar — mas nada era gravado, e fechar o modal e clicar "Subir de
    // Nível" de novo voltava ao aviso "V2 desativado". O baseline
    // (`sheet.js#salvarFlagLevelUpFlowV2`) grava de verdade, e o oráculo de DOM
    // não pega a diferença porque compara árvore, não efeito.
    const ligandoV2 = action === LEVEL_UP_FLOW_ACTIONS.enableV2;
    const levelUpFlowV2 = ligandoV2 ? true : uiState.levelUpFlowV2 === true;
    const levelUp = projection.levelUp ?? null;
    const descricao = describeLevelUpModal({
      levelUpFlowV2,
      options: levelUp?.available === true ? levelUp.options : null,
      error: levelUp?.available === true ? null : { code: levelUp?.unavailableReason ?? 'LEVEL_UP_UNAVAILABLE', message: 'As opções do próximo nível não puderam ser derivadas.' },
    });
    return createUiEventDecision({
      intent: createSheetIntent(SHEET_INTENT_TYPES.modalOpen, {
        modalId: descricao.modalId,
        title: descricao.title,
        // `data-sheet-modal-owner` é o que faz os cliques DENTRO do modal
        // voltarem para o `toIntent` desta seção (o overlay é irmão do
        // container da ficha, então não há contêiner de seção no caminho).
        content: `<div data-sheet-modal-owner="${escapeHtmlAttribute(FEATS_PROGRESSION_SECTION_ID)}">${descricao.content}</div>`,
        actions: `<div data-sheet-modal-owner="${escapeHtmlAttribute(FEATS_PROGRESSION_SECTION_ID)}">${descricao.actions}</div>`,
        mode: descricao.mode,
        levelUpFlowV2,
        // Só o clique que RELIGA a flag pede a mudança de preferência; abrir o
        // fluxo normalmente não reescreve preferência nenhuma.
        uiStatePatch: ligandoV2 ? { levelUpFlowV2: true } : null,
      }),
      preventDefault: true,
    });
  }

  if (action === LEVEL_UP_FLOW_ACTIONS.close) {
    return createUiEventDecision({
      intent: createSheetIntent(SHEET_INTENT_TYPES.modalClose, { modalId: LEVEL_UP_MODAL_ID }),
      preventDefault: true,
    });
  }

  // Comando canônico (inclusive `level-up`). O `type` é o próprio
  // `data-action`; parâmetros declarados viajam em `selection`.
  const command = { type: action };
  if (action === 'level-up') {
    command.selection = readLevelUpSelection(acionado, context);
  }
  return createUiEventDecision({
    intent: createSheetIntent(SHEET_INTENT_TYPES.command, { command }),
    preventDefault: true,
  });
}

/**
 * Lê a seleção do fluxo em cards a partir dos campos declarados no modal.
 *
 * Campo ausente/ilegível vira propriedade AUSENTE, nunca um valor plausível:
 * `validateLevelUp` (Task 23) é quem recusa uma seleção incompleta, com erro
 * nomeado, e é o único lugar onde essa regra existe.
 * @param {object} acionado - o elemento clicado.
 * @param {object} context
 * @returns {object}
 */
function readLevelUpSelection(acionado, context) {
  const escopo =
    typeof acionado.closest === 'function'
      ? acionado.closest('[data-sheet-modal-owner]')?.parentElement ?? context.root ?? null
      : context.root ?? null;
  const raiz = escopo === null || typeof escopo.querySelector !== 'function' ? context.root ?? null : escopo;
  if (raiz === null || typeof raiz.querySelector !== 'function') {
    return {};
  }

  /**
   * @param {string} seletor
   * @returns {string|null}
   */
  const texto = (seletor) => {
    const campo = raiz.querySelector(seletor);
    const valor = typeof campo?.value === 'string' ? campo.value.trim() : '';
    return valor === '' ? null : valor;
  };

  /** @type {Record<string, *>} */
  const selection = {};
  const pv = texto('[data-levelup-hit-points]');
  if (pv !== null && /^-?\d+$/.test(pv)) {
    selection.hitPoints = { rolled: Number.parseInt(pv, 10) };
  }
  const subclasse = texto('[data-levelup-subclass]');
  if (subclasse !== null) {
    selection.subclassRef = subclasse;
  }
  const asi = texto('[data-levelup-asi]');
  if (asi !== null) {
    selection.abilityScoreImprovement = asi;
  }
  return selection;
}

/**
 * Cria a seção `feats-progression` validada pelo registro.
 * @returns {import('../../../core/result.js').Result} Result<Section, AppError>
 */
export function createFeatsProgressionSection() {
  return createSheetSection({
    id: FEATS_PROGRESSION_SECTION_ID,
    select: selectFeatsProgression,
    render: renderFeatsProgression,
    toIntent: featsProgressionToIntent,
    eventTypes: ['click'],
  });
}
