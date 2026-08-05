// Seção `conditions-defenses-senses` (Task 31): CONDIÇÕES ativas, DEFESAS
// (resistências/vulnerabilidades/imunidades a dano) e SENTIDOS passivos.
//
// ## Contrato de seção (Task 29), sem exceções
//
// `select` recorta a projeção; `render` devolve markup; `toIntent` devolve uma
// `UiEventDecision`. A seção não recebe repositório, não recebe registro
// persistido, não recebe `ModalService` e não registra listener.
//
// ## Nada aqui vem de prosa, de regex ou de nome de exibição
//
// É o item explícito do checklist do brief. As três listas de defesa vêm de
// `derived.defenses` (`domain/character/queries/defenses.js`, Task 16), que as
// resolve por ContentId a partir de `build.legacyGrants` COMPOSTO com o motor
// de efeitos da Task 15 (alvos `defense.resistance`/`.vulnerability`/
// `.immunity`). Os sentidos vêm de `derived.senses`
// (`queries/senses.js`), que compõe `passive-perception` e `senses.darkvision`
// pelo mesmo motor. As condições vêm de `state.conditions`, o array canônico.
//
// Não existe neste arquivo: nenhuma tabela `MAGIAS_EFEITO`, nenhum `match()`
// sobre descrição, nenhuma comparação com nome de classe/magia/condição em
// português. O teste focal varre o próprio fonte para provar isso.
//
// ## `state.conditions` é um array de STRINGS — e por isso o campo é de texto
//
// `domain/commands/conditions.js` (Task 17) documenta que o baseline não dá
// estrutura nenhuma a uma condição: `state.conditions` é uma lista de strings, e
// `addCondition`/`removeCondition` endereçam exatamente essa string. Não há
// entidade `condition` no catálogo `dnd2024` de onde tirar uma lista fechada de
// opções. Oferecer um seletor com uma lista embutida AQUI seria inventar
// conteúdo de jogo dentro do renderizador — o defeito que esta refatoração
// existe para eliminar. O controle é, então, o mesmo que o modelo permite: um
// campo de texto, cujo valor vira o `conditionId` do comando canônico.
//
// ## Simetria aplicar/revogar (padrão de bug recorrente (b))
//
// Adicionar e remover operam sobre EXATAMENTE a mesma string: o botão de
// remoção carrega o `conditionId` que o `render` escreveu a partir do array, e
// o comando `remove-condition` recusa com `COMMAND_CONDITION_NOT_ACTIVE` o que
// não está lá. Um `add` bem-sucedido é sempre desfeito por exatamente um
// `remove` — e o teste focal prova isso por ida-e-volta contra o dispatcher
// REAL, para todas as condições das fixtures.
//
// ## Defesas e sentidos são LEITURA (lacunas DECLARADAS)
//
// O vocabulário FECHADO de comandos da Task 17 não tem nenhum comando que
// altere `build.legacyGrants.resistanceIds`/`vulnerabilityIds`/`immunityIds`,
// e `sheet-command-map.js` não mapeia esses paths. O baseline tem um botão
// "Gerenciar" nesse card; desenhar aqui um botão sem comando por trás seria o
// bypass silencioso. A lacuna é exibida (`data-sheet-defenses-readonly`) em vez
// de disfarçada de recurso.
//
// O mesmo vale para VANTAGEM/DESVANTAGEM, citada no checklist do brief: não
// existe consulta, alvo de efeito nem campo canônico de vantagem/desvantagem em
// `domain/**` (verificado por varredura). A seção declara a ausência com um
// motivo nomeado em vez de derivá-la da prosa de uma condição.

import { escapeHtml, escapeHtmlAttribute } from '../../../ui/html.js';
import { createUiEventDecision, NO_UI_EVENT_DECISION } from '../../../ui/event-delegation.js';
import { SHEET_INTENT_TYPES, createSheetIntent } from '../sheet-state.js';
import { createSheetSection } from './section-registry.js';

/** Id canônico desta seção. */
export const CONDITIONS_DEFENSES_SENSES_SECTION_ID = 'conditions-defenses-senses';

/**
 * Tipos de comando canônico que esta seção emite. Confrontados com o
 * vocabulário do dispatcher pelo teste focal: um comando renomeado no domínio
 * quebra o teste em vez de apagar um botão em silêncio.
 * @type {ReadonlyArray<string>}
 */
export const CONDITIONS_COMMAND_TYPES = Object.freeze(['add-condition', 'remove-condition']);

/**
 * Motivo NOMEADO da ausência de vantagem/desvantagem no modelo canônico. É
 * exibido, não silenciado — ver o cabeçalho.
 * @type {string}
 */
export const ADVANTAGE_UNAVAILABLE_REASON = 'SHEET_ADVANTAGE_NOT_MODELLED';

/**
 * Motivo NOMEADO da ausência de comando de edição de defesas.
 * @type {string}
 */
export const DEFENSES_READONLY_REASON = 'SHEET_DEFENSES_NO_CANONICAL_COMMAND';

/** Seletor do campo de texto de condição, dentro do markup desta seção. */
const CONDITION_INPUT_SELECTOR = '[data-sheet-condition-input]';

/**
 * As três famílias de defesa, na ordem de apresentação. Nomes de CHAVE da
 * projeção (`derived.defenses`), não rótulos de jogo.
 * @type {ReadonlyArray<Readonly<{key: string, label: string}>>}
 */
const DEFENSE_KINDS = Object.freeze([
  Object.freeze({ key: 'resistances', labelsKey: 'resistanceLabels', label: 'Resistências' }),
  Object.freeze({ key: 'vulnerabilities', labelsKey: 'vulnerabilityLabels', label: 'Vulnerabilidades' }),
  Object.freeze({ key: 'immunities', labelsKey: 'immunityLabels', label: 'Imunidades' }),
]);

/**
 * Os quatro sentidos projetados, na ordem de apresentação.
 * @type {ReadonlyArray<Readonly<{key: string, label: string}>>}
 */
const SENSE_FIELDS = Object.freeze([
  Object.freeze({ key: 'passivePerception', label: 'Percepção Passiva' }),
  Object.freeze({ key: 'passiveInsight', label: 'Intuição Passiva' }),
  Object.freeze({ key: 'passiveInvestigation', label: 'Investigação Passiva' }),
  Object.freeze({ key: 'darkvision', label: 'Visão no Escuro' }),
]);

/**
 * Formata um valor distinguindo AUSÊNCIA de zero. Um `0` exibido no lugar de um
 * valor desconhecido afirma "o valor é zero", que é falso — é o padrão de bug
 * "default de jogo inventado" na sua forma mais barata.
 * @param {*} value
 * @returns {string}
 */
function plain(value) {
  return value === null || value === undefined ? '—' : String(value);
}

/**
 * Recorta do ViewModel a projeção desta seção. Pura, sem cálculo: todo NÚMERO
 * já vem pronto de `derived`, e as condições são eco literal do estado.
 * @param {object|null} viewModel
 * @returns {Readonly<object>}
 */
export function selectConditionsDefensesSenses(viewModel) {
  if (viewModel === null || typeof viewModel !== 'object') {
    return Object.freeze({ available: false });
  }
  const derived = viewModel.derived ?? {};
  const state = viewModel.data?.state ?? {};
  const defenses = derived.defenses ?? {};
  const senses = derived.senses ?? {};

  return Object.freeze({
    available: true,
    // Eco literal do array canônico de condições (strings).
    conditions: Object.freeze([...(state.conditions ?? [])]),
    // Efeitos ativos: eco literal. A seção NÃO os interpreta (não lê descrição,
    // não deduz condição a partir de rótulo) — só declara quantos são e de que
    // fonte vieram, porque `state.activeEffects` é um dos paths que sujam esta
    // seção e ignorá-lo deixaria a tela desatualizada em silêncio.
    activeEffects: Object.freeze(
      [...(state.activeEffects ?? [])].map((entry) =>
        Object.freeze({
          effectInstanceId: entry?.effectInstanceId ?? null,
          sourceId: entry?.sourceId ?? null,
          concentration: entry?.data?.concentration === true,
        }),
      ),
    ),
    // Os ids continuam viajando (são a identidade da defesa, e é por eles que
    // o markup se ancora); os RÓTULOS resolvidos no catálogo (Task 33) vêm ao
    // lado, na mesma ordem. Antes desta task a seção mostrava o próprio
    // ContentId ao jogador (`dnd2024:damage-type:fogo`).
    defenses: Object.freeze({
      resistances: Object.freeze([...(defenses.resistances ?? [])]),
      vulnerabilities: Object.freeze([...(defenses.vulnerabilities ?? [])]),
      immunities: Object.freeze([...(defenses.immunities ?? [])]),
      resistanceLabels: Object.freeze([...(defenses.resistanceLabels ?? [])]),
      vulnerabilityLabels: Object.freeze([...(defenses.vulnerabilityLabels ?? [])]),
      immunityLabels: Object.freeze([...(defenses.immunityLabels ?? [])]),
    }),
    senses: Object.freeze({
      passivePerception: senses.passivePerception ?? null,
      passiveInsight: senses.passiveInsight ?? null,
      passiveInvestigation: senses.passiveInvestigation ?? null,
      darkvision: senses.darkvision ?? null,
    }),
    // Nível de exaustão vem de `derived.movement` (Task 16) — é a única
    // "condição" com número no canônico, e ela já é derivada lá. A seção não a
    // recalcula nem a deduz do array de condições.
    exhaustionLevel: derived.movement?.exhaustionLevel ?? null,
  });
}

/**
 * Markup da lista de condições ativas.
 * @param {ReadonlyArray<string>} conditions
 * @returns {string}
 */
function renderConditions(conditions) {
  if (conditions.length === 0) {
    return '<p class="sheet-empty" data-sheet-conditions-empty>Nenhuma condição ativa</p>';
  }
  return (
    '<ul data-sheet-conditions>' +
    conditions
      .map(
        (conditionId) =>
          `<li data-sheet-condition="${escapeHtmlAttribute(conditionId)}">` +
          `<span data-sheet-condition-label>${escapeHtml(conditionId)}</span>` +
          '<button type="button" data-action="remove-condition" ' +
          `data-condition-id="${escapeHtmlAttribute(conditionId)}">Remover</button>` +
          '</li>',
      )
      .join('') +
    '</ul>'
  );
}

/**
 * Markup das três listas de defesa.
 * @param {object} defenses
 * @returns {string}
 */
function renderDefenses(defenses) {
  const blocos = DEFENSE_KINDS.map(({ key, labelsKey, label }) => {
    const ids = defenses[key] ?? [];
    const rotulos = defenses[labelsKey] ?? [];
    const corpo =
      ids.length === 0
        ? `<p class="sheet-empty" data-sheet-defense-empty="${escapeHtmlAttribute(key)}">Nenhuma defesa configurada</p>`
        : '<ul>' +
          ids
            .map(
              (id, indice) =>
                // O id continua no ATRIBUTO (é a identidade que o teste e o
                // futuro comando de edição usam); o TEXTO é o nome de exibição.
                // O rótulo ausente cai no próprio id — nunca some da tela.
                `<li data-sheet-defense-id="${escapeHtmlAttribute(id)}">${escapeHtml(rotulos[indice] ?? id)}</li>`,
            )
            .join('') +
          '</ul>';
    return (
      `<div data-sheet-defense-kind="${escapeHtmlAttribute(key)}">` +
      `<h4>${escapeHtml(label)}</h4>` +
      corpo +
      '</div>'
    );
  }).join('');

  // Lacuna DECLARADA: nenhum comando canônico altera estas listas.
  return (
    '<div data-sheet-defenses>' +
    blocos +
    `<p class="sheet-note" data-sheet-defenses-readonly="${escapeHtmlAttribute(DEFENSES_READONLY_REASON)}">` +
    'As defesas vêm do conteúdo e dos efeitos ativos; não há comando de edição direta.' +
    '</p>' +
    '</div>'
  );
}

/**
 * Renderiza o miolo da seção.
 * @param {object} projection
 * @param {object} [uiState]
 * @returns {string}
 */
export function renderConditionsDefensesSenses(projection, uiState = {}) {
  void uiState;
  if (projection === null || typeof projection !== 'object' || projection.available !== true) {
    return '<p class="sheet-empty" data-sheet-conditions-unavailable>Condições indisponíveis: a ficha não tem projeção canônica.</p>';
  }

  const sentidos =
    '<ul data-sheet-senses>' +
    SENSE_FIELDS.map(
      ({ key, label }) =>
        `<li data-sheet-sense="${escapeHtmlAttribute(key)}">` +
        `<span data-sheet-sense-label>${escapeHtml(label)}</span>` +
        `<span data-sheet-sense-value>${escapeHtml(plain(projection.senses[key]))}</span>` +
        '</li>',
    ).join('') +
    '</ul>';

  const efeitos =
    '<ul data-sheet-active-effects>' +
    projection.activeEffects
      .map(
        (entry) =>
          `<li data-sheet-active-effect="${escapeHtmlAttribute(entry.effectInstanceId ?? '')}" ` +
          `data-source-id="${escapeHtmlAttribute(entry.sourceId ?? '')}" ` +
          `data-concentration="${entry.concentration ? 'true' : 'false'}"></li>`,
      )
      .join('') +
    '</ul>';

  return (
    '<div class="sheet-conditions" data-sheet-conditions-defenses-senses>' +
    '<div data-sheet-conditions-block>' +
    renderConditions(projection.conditions) +
    '<label>' +
    '<span>Condição</span>' +
    '<input type="text" data-sheet-condition-input>' +
    '</label>' +
    '<button type="button" data-action="add-condition">Adicionar condição</button>' +
    '</div>' +
    `<p data-sheet-exhaustion-level>${escapeHtml(plain(projection.exhaustionLevel))}</p>` +
    efeitos +
    renderDefenses(projection.defenses) +
    sentidos +
    // Lacuna DECLARADA (ver cabeçalho): vantagem/desvantagem não existe no
    // modelo canônico. Nunca derivada de prosa de condição.
    `<p class="sheet-note" data-sheet-advantage-unavailable="${escapeHtmlAttribute(ADVANTAGE_UNAVAILABLE_REASON)}">` +
    'Vantagem/desvantagem ainda não é um valor derivado do modelo canônico.' +
    '</p>' +
    '</div>'
  );
}

/**
 * Traduz um evento em `UiEventDecision`.
 *
 * `add-condition` lê a string do campo de texto; `remove-condition` lê o
 * `data-condition-id` que o próprio `render` escreveu a partir do array. Os
 * dois montam o MESMO parâmetro (`conditionId`) — é o que torna as duas
 * operações exatamente inversas.
 *
 * Campo vazio vira propriedade AUSENTE, e o domínio recusa com
 * `COMMAND_CONDITION_ID_INVALID`: a vista nunca preenche um valor plausível.
 *
 * Qualquer outro `data-action` vira um comando com aquele `type`, que o
 * dispatcher recusa com `COMMAND_TYPE_UNKNOWN` — nunca um clique inerte.
 *
 * @param {object} event
 * @param {{root: object, projection: object, uiState: object}} context
 * @returns {Readonly<object>} UiEventDecision
 */
export function conditionsDefensesSensesToIntent(event, context = {}) {
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

  if (type === 'remove-condition') {
    command.conditionId = acionado.getAttribute('data-condition-id');
  } else if (type === 'add-condition') {
    const raiz =
      (typeof acionado.closest === 'function' ? acionado.closest('[data-sheet-conditions-defenses-senses]') : null) ??
      context.root ??
      null;
    const campo = raiz !== null && typeof raiz.querySelector === 'function' ? raiz.querySelector(CONDITION_INPUT_SELECTOR) : null;
    const valor = typeof campo?.value === 'string' ? campo.value.trim() : '';
    if (valor !== '') {
      command.conditionId = valor;
    }
  }

  return createUiEventDecision({
    intent: createSheetIntent(SHEET_INTENT_TYPES.command, { command }),
    preventDefault: true,
  });
}

/**
 * Cria a seção `conditions-defenses-senses` validada pelo registro.
 * @returns {import('../../../core/result.js').Result} Result<Section, AppError>
 */
export function createConditionsDefensesSensesSection() {
  return createSheetSection({
    id: CONDITIONS_DEFENSES_SENSES_SECTION_ID,
    select: selectConditionsDefensesSenses,
    render: renderConditionsDefensesSenses,
    toIntent: conditionsDefensesSensesToIntent,
    eventTypes: ['click'],
  });
}
