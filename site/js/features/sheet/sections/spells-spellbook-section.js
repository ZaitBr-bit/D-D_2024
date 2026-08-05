// Seção `spells-spellbook` (Task 31): MAGIAS, GRIMÓRIO, espaços de magia,
// espaços de pacto e CONCENTRAÇÃO.
//
// ## Contrato de seção (Task 29), sem exceções
//
// `select` recorta a projeção; `render` devolve markup; `toIntent` devolve uma
// `UiEventDecision`. A seção não recebe repositório, não recebe catálogo, não
// recebe `ModalService` e não registra listener. Quando quer um modal, ela o
// DESCREVE (`sheet/modal-open`) e o controller o abre.
//
// ## Nenhuma regra de magia é reimplementada aqui
//
// Espaços, pacto, tetos de truques/preparadas, CD e bônus de ataque de magia
// vêm prontos de `derived.spellSlots` e `derived.defenses`, que por sua vez
// delegam a `getSpellcastingProjection` (Task 18). Conjurar, concentrar e
// encerrar concentração são os comandos CANÔNICOS `cast-spell`,
// `set-concentration` e `end-concentration` — a seção não decide se há espaço,
// se o círculo é suficiente nem se a substituição de concentração é permitida.
// Todas essas recusas voltam como erro NOMEADO do domínio.
//
// Não existe neste arquivo: tabela `MAGIAS_EFEITO`, regex sobre descrição de
// magia, nem comparação por nome de exibição. O teste focal varre o fonte.
//
// ## A transação de CONCENTRAÇÃO é atômica no DOMÍNIO — um comando, não dois
//
// `domain/spells/concentration.js#setConcentration` já faz, num único
// `CommandResult`: derruba os efeitos de concentração anteriores (canônicos E
// o array legado `efeitos_magicos`) e grava o novo alvo. Não existe, e não
// deve existir, uma sequência "encerrar a antiga, depois começar a nova" vinda
// da interface — ela poderia parar no meio e deixar o personagem sem nenhuma
// concentração. Por isso o botão de confirmar substituição emite EXATAMENTE UM
// comando, com `replaceConcentration: true`.
//
// `checkConcentrationReplacement` é quem exige a confirmação
// (`CONCENTRATION_REPLACEMENT_REQUIRED`); a seção apenas oferece o modal quando
// já há concentração ativa, e CANCELAR não emite comando nenhum.
//
// ## Reabertura de modal com formulário (semântica introduzida na Task 30)
//
// `sheet-controller.js#openModal` REABRE um modal com o mesmo `modalId` (fecha
// e redesenha) em vez de ignorar o pedido. Esta seção é o segundo produtor de
// modal da ficha, e o primeiro com FORMULÁRIO. O conteúdo do modal é DESCRITO
// do zero a cada `spell-cast-open`, a partir da projeção e do `data-spell-id`
// do botão clicado — nenhum estado de formulário é guardado na seção nem no
// `uiState`. Consequência: reabrir o modal para OUTRA magia não pode vazar a
// escolha de espaço da magia anterior, porque o markup anterior deixou de
// existir. Há caso de teste dedicado a esse cenário.
//
// ## Markdown seguro
//
// O detalhe de uma magia usa `ui/markdown.js#renderSafeMarkdownToHtml`
// (Task 24), com o oráculo de fidelidade já testado contra as 391 descrições
// reais do catálogo. Nenhum parsing novo. O `Document` necessário vem de
// `context.root.ownerDocument` — `toIntent` é o único ponto do contrato de
// seção que recebe um nó DOM, e é exatamente onde o conteúdo do modal é
// descrito. `render` continua puro e sem DOM.
//
// ## Lacunas DECLARADAS (não disfarçadas de recurso)
//
// Três coisas que o brief pede NÃO têm caminho canônico hoje, e a seção as
// declara com motivo nomeado em vez de desenhar um controle sem comando por
// trás (o "bypass silencioso" que este projeto persegue):
//
//   1. ADIÇÃO DE MAGIA NOVA A PARTIR DO CATÁLOGO ("busca" do baseline).
//      Preparar/despreparar e remover do grimório GANHARAM comandos canônicos
//      na correção C1 da revisão final (`prepare-spell`/`unprepare-spell`/
//      `remove-spellbook-spell`/`add-spellbook-spell`, em
//      `domain/spells/spell-preparation.js`) e esta seção os emite sobre as
//      entradas que a projeção já carrega. O que CONTINUA declarado é o
//      picker de catálogo (adicionar uma magia que o personagem ainda não
//      tem em coleção nenhuma): a lista de magias do catálogo não está na
//      lista FECHADA de `sheet-view-model.js` (lacuna 3 abaixo), então não há
//      de onde desenhar a busca — o comando `add-spellbook-spell` existe e é
//      recusado/aceito pelo domínio, mas nenhum controle desta seção o emite
//      ainda.
//   2. METAMAGIA. `readMetamagicContext` lê as opções de `context.metamagic`, e
//      nenhum produtor desse canal existe fora dos testes e do criador: o
//      pacote `dnd2024` não tem entidade `metamagic-option` (concern da
//      Task 18). Sem opções não há o que oferecer, e inventá-las aqui seria
//      conteúdo de jogo dentro do renderizador.
//   3. CÍRCULO/ESCOLA/RITUAL/CONCENTRAÇÃO e DESCRIÇÃO das magias do CATÁLOGO.
//      `derived.spellSlots` só carrega NÚMEROS de espaço; a lista de magias
//      resolvida contra o catálogo (`getSpellcastingProjection().spells`) não
//      está na lista FECHADA de `sheet-view-model.js`. A seção lê o que o
//      ViewModel de fato tem (o eco de `state.spells.*`) e declara o motivo do
//      resto. Magia CUSTOMIZADA é a exceção: sua definição viaja no próprio
//      personagem (`customDefinition`), e por isso o detalhe dela é renderizado
//      de verdade, com o Markdown seguro.
//
// Tudo isso está registrado como achado candidato no relatório da Task 31.

import { escapeHtml, escapeHtmlAttribute } from '../../../ui/html.js';
import { renderSafeMarkdownToHtml } from '../../../ui/markdown.js';
import { createUiEventDecision, NO_UI_EVENT_DECISION } from '../../../ui/event-delegation.js';
import { SHEET_INTENT_TYPES, createSheetIntent } from '../sheet-state.js';
import { createSheetSection } from './section-registry.js';

/** Id canônico desta seção. */
export const SPELLS_SPELLBOOK_SECTION_ID = 'spells-spellbook';

/** `modalId` do formulário de conjuração. */
export const SPELL_CAST_MODAL_ID = 'sheet-spell-cast';

/** `modalId` da confirmação de substituição de concentração. */
export const CONCENTRATION_MODAL_ID = 'sheet-spell-concentration';

/** `modalId` do detalhe de uma magia. */
export const SPELL_DETAIL_MODAL_ID = 'sheet-spell-detail';

/**
 * `data-action` que NÃO são comandos canônicos (abrir/fechar modal não muta o
 * personagem). Mantidos separados justamente para que o restante possa ser
 * repassado ao dispatcher como `type`.
 * @type {Readonly<Record<string, string>>}
 */
export const SPELL_FLOW_ACTIONS = Object.freeze({
  castOpen: 'spell-cast-open',
  castClose: 'spell-cast-close',
  concentrationOpen: 'spell-concentration-open',
  concentrationClose: 'spell-concentration-close',
  detailOpen: 'spell-detail-open',
  detailClose: 'spell-detail-close',
});

/**
 * Tipos de comando canônico que esta seção emite. Confrontados com o
 * vocabulário do dispatcher pelo teste focal.
 * @type {ReadonlyArray<string>}
 */
export const SPELLS_COMMAND_TYPES = Object.freeze([
  'cast-spell',
  'set-concentration',
  'end-concentration',
  // Correção C1 da revisão final: preparar/despreparar e remover do grimório.
  'prepare-spell',
  'unprepare-spell',
  'remove-spellbook-spell',
]);

/** Coleções de magia do personagem canônico, na ordem de apresentação. */
export const SPELL_COLLECTION_ORDER = Object.freeze(['known', 'prepared', 'spellbook']);

/** Rótulos das coleções. Apresentação — nenhuma regra depende deles. */
const COLLECTION_LABELS = Object.freeze({
  known: 'Magias Conhecidas',
  prepared: 'Magias Preparadas',
  spellbook: 'Grimório',
});

/**
 * Motivo NOMEADO da lacuna 1 (ver cabeçalho): adicionar magia NOVA a partir do
 * catálogo ainda não tem picker — a lista de magias do catálogo não é
 * projetada pelo ViewModel. Substitui o antigo
 * `SHEET_SPELL_SELECTION_NO_CANONICAL_COMMAND` (correção C1 da revisão final:
 * preparar/despreparar/remover do grimório agora TÊM comando canônico e são
 * emitidos por esta seção).
 */
export const CATALOG_PICKER_UNAVAILABLE_REASON = 'SHEET_SPELL_CATALOG_PICKER_NOT_PROJECTED';

/** Motivo NOMEADO da ausência de opções de metamagia projetadas. */
export const METAMAGIC_UNAVAILABLE_REASON = 'SHEET_METAMAGIC_OPTIONS_NOT_PROJECTED';

/** Motivo NOMEADO da ausência do detalhe de catálogo de uma magia. */
export const SPELL_DETAIL_UNAVAILABLE_REASON = 'SHEET_SPELL_CATALOG_DETAIL_NOT_PROJECTED';

/**
 * Formata um valor distinguindo AUSÊNCIA de zero. Um teto de espaços
 * desconhecido exibido como `0` afirmaria "não há espaços", que é diferente de
 * "não sabemos quantos" — e é o padrão de bug "default de jogo inventado".
 * @param {*} value
 * @returns {string}
 */
function plain(value) {
  return value === null || value === undefined ? '—' : String(value);
}

/**
 * Normaliza UMA entrada de `state.spells.<coleção>` para a projeção da seção.
 * Eco literal: nenhum campo é resolvido contra catálogo (a seção não o tem).
 * @param {object} entry
 * @param {string} collection
 * @returns {Readonly<object>}
 */
function projectEntry(entry, collection) {
  const custom = entry?.customDefinition ?? null;
  return Object.freeze({
    collection,
    instanceId: typeof entry?.instanceId === 'string' ? entry.instanceId : null,
    spellId: typeof entry?.spellRef?.id === 'string' ? entry.spellRef.id : null,
    // `sourceInstanceId` é NULLABLE no canônico e `null` significa "fonte
    // base/classe" (ver `cast-spell.js#normalizeRequest`). A distinção é
    // preservada: ela é o que separa duas instâncias de "Iniciado em Magia".
    sourceInstanceId: typeof entry?.sourceInstanceId === 'string' ? entry.sourceInstanceId : null,
    // Definição de magia CUSTOMIZADA: viaja no próprio personagem, então está
    // ao alcance da seção. É a única fonte de detalhe disponível hoje.
    customName: typeof custom?.nome === 'string' ? custom.nome : null,
    customLevel: Number.isInteger(custom?.circulo) ? custom.circulo : null,
    customSchool: typeof custom?.escola === 'string' ? custom.escola : null,
    customDescription: typeof custom?.descricao === 'string' ? custom.descricao : null,
    custom: custom !== null && typeof custom === 'object',
  });
}

/**
 * Recorta do ViewModel a projeção desta seção. Pura, sem cálculo.
 * @param {object|null} viewModel
 * @returns {Readonly<object>}
 */
export function selectSpellsSpellbook(viewModel) {
  if (viewModel === null || typeof viewModel !== 'object') {
    return Object.freeze({ available: false });
  }
  const derived = viewModel.derived ?? {};
  const spells = viewModel.data?.state?.spells ?? {};
  const slots = derived.spellSlots ?? {};
  const defenses = derived.defenses ?? {};

  /** @type {Record<string, ReadonlyArray<object>>} */
  const collections = {};
  for (const collection of SPELL_COLLECTION_ORDER) {
    const lista = Array.isArray(spells[collection]) ? spells[collection] : [];
    collections[collection] = Object.freeze(lista.map((entry) => projectEntry(entry, collection)));
  }

  return Object.freeze({
    available: true,
    // Espaços por círculo, já ordenados pelo número do círculo.
    slots: Object.freeze(
      Object.values(slots.byLevel ?? {})
        .slice()
        .sort((a, b) => (a?.level ?? 0) - (b?.level ?? 0))
        .map((slot) => Object.freeze({ ...slot })),
    ),
    // Pool SEPARADO de Magia de Pacto — nunca somado ao de espaços comuns.
    pact: Object.freeze({ ...(slots.pact ?? { used: null, maximum: null, level: null, available: null }) }),
    cantripsKnown: slots.cantripsKnown ?? null,
    preparedLimit: slots.preparedLimit ?? null,
    saveDC: defenses.spellSaveDC ?? null,
    attackBonus: defenses.spellAttackBonus ?? null,
    // Alvo ATUAL de concentração (ContentId), ou `null`.
    concentration: typeof spells.concentration === 'string' ? spells.concentration : null,
    collections: Object.freeze(collections),
  });
}

/**
 * Chave de presença de uma magia numa coleção, POR FONTE — a mesma identidade
 * (`spellId` + `sourceInstanceId`) que os comandos de preparo usam. É o que
 * separa duas instâncias independentes de "Iniciado em Magia".
 * @param {string} spellId
 * @param {string|null} sourceInstanceId
 * @returns {string}
 */
function spellSourceKey(spellId, sourceInstanceId) {
  return `${sourceInstanceId ?? ''}|${spellId}`;
}

/**
 * Botões de preparo/grimório de UMA entrada (correção C1 da revisão final).
 *
 * A seção não decide regra nenhuma: ela oferece o botão coerente com a
 * coleção da entrada e o DOMÍNIO recusa com erro NOMEADO o que não puder
 * (limite de preparadas, magia fora da lista, sempre preparada, ...). O
 * `data-prepared-from="spellbook"` de uma entrada do grimório é PROVENIÊNCIA
 * (onde o botão vive), não regra — é o pedido explícito de "preparar a partir
 * do grimório" que `spell-selection.js` documenta (nunca inferido da classe).
 * @param {object} entry
 * @param {Set<string>} preparedKeys - chaves `fonte|magia` atualmente preparadas.
 * @returns {string}
 */
function renderPreparationButtons(entry, preparedKeys) {
  if (entry.spellId === null) {
    // Magia customizada: não existe no catálogo, e o domínio a recusaria
    // (`SPELL_SELECTION_UNKNOWN_SPELL`). A ausência do botão é coerente com o
    // `data-custom` já declarado na entrada.
    return '';
  }
  const fonte = `data-spell-id="${escapeHtmlAttribute(entry.spellId)}" ` +
    `data-source-instance-id="${escapeHtmlAttribute(entry.sourceInstanceId ?? '')}"`;
  const jaPreparada = preparedKeys.has(spellSourceKey(entry.spellId, entry.sourceInstanceId));

  if (entry.collection === 'prepared') {
    return `<button type="button" data-action="unprepare-spell" ${fonte}>Despreparar</button>`;
  }
  if (entry.collection === 'known') {
    return jaPreparada ? '' : `<button type="button" data-action="prepare-spell" ${fonte}>Preparar</button>`;
  }
  // collection === 'spellbook': preparar A PARTIR do grimório (baseline
  // `data-preparar-grimorio`/`data-despreparar-grimorio`) e remover do
  // grimório (baseline `data-remover-grimorio`).
  const toggle = jaPreparada
    ? `<button type="button" data-action="unprepare-spell" ${fonte}>Despreparar</button>`
    : `<button type="button" data-action="prepare-spell" data-prepared-from="spellbook" ${fonte}>Preparar</button>`;
  return toggle + `<button type="button" data-action="remove-spellbook-spell" ${fonte}>Remover do grimório</button>`;
}

/**
 * Markup de UMA entrada de magia.
 * @param {object} entry
 * @param {Set<string>} preparedKeys - ver `renderPreparationButtons`.
 * @returns {string}
 */
function renderSpellEntry(entry, preparedKeys) {
  // Rótulo: nome customizado quando existe, senão o ContentId. Nunca um nome
  // inventado — a seção não tem catálogo para resolver o nome oficial.
  const rotulo = entry.customName ?? entry.spellId ?? '';
  const alvo = entry.spellId ?? entry.instanceId ?? '';
  return (
    `<li data-sheet-spell="${escapeHtmlAttribute(alvo)}" ` +
    `data-collection="${escapeHtmlAttribute(entry.collection)}" ` +
    `data-custom="${entry.custom ? 'true' : 'false'}" ` +
    `data-source-instance-id="${escapeHtmlAttribute(entry.sourceInstanceId ?? '')}">` +
    `<span data-sheet-spell-label>${escapeHtml(rotulo)}</span>` +
    `<span data-sheet-spell-level>${escapeHtml(plain(entry.customLevel))}</span>` +
    // Conjurar só faz sentido para uma magia do CATÁLOGO: `cast-spell` resolve
    // a entidade por `spellId` e recusa o que não existe lá
    // (`CAST_SPELL_UNKNOWN_SPELL`). Uma magia customizada não tem entidade, e
    // por isso não ganha botão de conjurar — a ausência é declarada no
    // atributo `data-custom`, não escondida.
    (entry.spellId === null
      ? ''
      : '<button type="button" ' +
        `data-action="${escapeHtmlAttribute(SPELL_FLOW_ACTIONS.castOpen)}" ` +
        `data-spell-id="${escapeHtmlAttribute(entry.spellId)}" ` +
        `data-source-instance-id="${escapeHtmlAttribute(entry.sourceInstanceId ?? '')}">Conjurar</button>` +
        '<button type="button" ' +
        `data-action="${escapeHtmlAttribute(SPELL_FLOW_ACTIONS.concentrationOpen)}" ` +
        `data-spell-id="${escapeHtmlAttribute(entry.spellId)}">Concentrar</button>`) +
    renderPreparationButtons(entry, preparedKeys) +
    '<button type="button" ' +
    `data-action="${escapeHtmlAttribute(SPELL_FLOW_ACTIONS.detailOpen)}" ` +
    `data-spell-id="${escapeHtmlAttribute(alvo)}" ` +
    `data-collection="${escapeHtmlAttribute(entry.collection)}">Detalhes</button>` +
    '</li>'
  );
}

/**
 * Markup da grade de espaços de magia.
 * @param {ReadonlyArray<object>} slots
 * @param {object} pact
 * @returns {string}
 */
function renderSlots(slots, pact) {
  const comuns =
    slots.length === 0
      ? '<p class="sheet-empty" data-sheet-slots-empty>Nenhum espaço de magia</p>'
      : '<ul data-sheet-spell-slots>' +
        slots
          .map(
            (slot) =>
              `<li data-sheet-slot-level="${escapeHtmlAttribute(slot.level)}">` +
              `<span data-sheet-slot-used>${escapeHtml(plain(slot.used))}</span>` +
              `<span data-sheet-slot-maximum>${escapeHtml(plain(slot.maximum))}</span>` +
              `<span data-sheet-slot-available>${escapeHtml(plain(slot.available))}</span>` +
              '</li>',
          )
          .join('') +
        '</ul>';

  // O pool de PACTO é exibido em separado, sempre — somá-lo aos espaços comuns
  // seria exatamente o erro que `cast-spell.js` documenta no seu cabeçalho.
  const pacto =
    '<div data-sheet-pact-slots ' +
    `data-pact-level="${escapeHtmlAttribute(plain(pact.level))}">` +
    `<span data-sheet-pact-used>${escapeHtml(plain(pact.used))}</span>` +
    `<span data-sheet-pact-maximum>${escapeHtml(plain(pact.maximum))}</span>` +
    `<span data-sheet-pact-available>${escapeHtml(plain(pact.available))}</span>` +
    '</div>';

  return comuns + pacto;
}

/**
 * Renderiza o miolo da seção.
 * @param {object} projection
 * @param {object} [uiState]
 * @returns {string}
 */
export function renderSpellsSpellbook(projection, uiState = {}) {
  void uiState;
  if (projection === null || typeof projection !== 'object' || projection.available !== true) {
    return '<p class="sheet-empty" data-sheet-spells-unavailable>Magias indisponíveis: a ficha não tem projeção canônica.</p>';
  }

  const contadores =
    '<div data-sheet-spell-counters>' +
    `<span data-sheet-cantrips-known>${escapeHtml(plain(projection.cantripsKnown))}</span>` +
    `<span data-sheet-prepared-limit>${escapeHtml(plain(projection.preparedLimit))}</span>` +
    `<span data-sheet-spell-save-dc>${escapeHtml(plain(projection.saveDC))}</span>` +
    `<span data-sheet-spell-attack-bonus>${escapeHtml(plain(projection.attackBonus))}</span>` +
    '</div>';

  const concentracao =
    projection.concentration === null
      ? '<p class="sheet-empty" data-sheet-concentration-empty>Sem concentração ativa</p>'
      : `<div data-sheet-concentration="${escapeHtmlAttribute(projection.concentration)}">` +
        // O ID continua no ATRIBUTO (é a identidade que `end-concentration`
        // usa); o TEXTO é o nome que o jogador reconhece, buscado nas coleções
        // que esta MESMA projeção já carrega. Sem isto a ficha anunciava
        // "concentrando em dnd2024:spell:curar-ferimentos" — o mesmo defeito de
        // identificador técnico exposto que a Task 33 fechou para os tipos de
        // dano. Uma magia que não esteja em coleção nenhuma cai no próprio id,
        // que é feio mas nunca esconde a concentração ativa.
        `<span data-sheet-concentration-label>${escapeHtml(rotuloDeMagia(projection, projection.concentration))}</span>` +
        '<button type="button" data-action="end-concentration">Encerrar concentração</button>' +
        '</div>';

  // Chaves `fonte|magia` atualmente preparadas — decide Preparar/Despreparar
  // nas entradas de conhecidas/grimório (ver `renderPreparationButtons`).
  const preparedKeys = new Set(
    (projection.collections.prepared ?? [])
      .filter((entry) => entry.spellId !== null)
      .map((entry) => spellSourceKey(entry.spellId, entry.sourceInstanceId)),
  );

  const colecoes = SPELL_COLLECTION_ORDER.map((collection) => {
    const entradas = projection.collections[collection] ?? [];
    const corpo =
      entradas.length === 0
        ? `<p class="sheet-empty" data-sheet-collection-empty="${escapeHtmlAttribute(collection)}">Nenhuma magia</p>`
        : `<ul data-sheet-collection-list="${escapeHtmlAttribute(collection)}">` +
          entradas.map((entry) => renderSpellEntry(entry, preparedKeys)).join('') +
          '</ul>';
    return (
      `<section data-sheet-spell-collection="${escapeHtmlAttribute(collection)}">` +
      `<h4>${escapeHtml(COLLECTION_LABELS[collection] ?? collection)}</h4>` +
      corpo +
      '</section>'
    );
  }).join('');

  return (
    '<div class="sheet-spells" data-sheet-spells-spellbook>' +
    contadores +
    renderSlots(projection.slots, projection.pact) +
    concentracao +
    colecoes +
    // Lacunas DECLARADAS (ver cabeçalho). São exibidas com o motivo nomeado,
    // nunca substituídas por um controle sem comando por trás.
    `<p class="sheet-note" data-sheet-spell-catalog-picker-unavailable="${escapeHtmlAttribute(CATALOG_PICKER_UNAVAILABLE_REASON)}">` +
    'Adicionar magia nova a partir do catálogo ainda não tem busca: a lista de magias do catálogo não é projetada.' +
    '</p>' +
    `<p class="sheet-note" data-sheet-metamagic-unavailable="${escapeHtmlAttribute(METAMAGIC_UNAVAILABLE_REASON)}">` +
    'As opções de Metamagia ainda não são projetadas pelo modelo canônico.' +
    '</p>' +
    '</div>'
  );
}

/**
 * Envolve o markup de um modal com o marcador de DONO, para que os cliques
 * dentro dele voltem ao `toIntent` desta seção (o overlay é irmão do container
 * da ficha, então não há contêiner de seção no caminho).
 * @param {string} markup
 * @returns {string}
 */
function owned(markup) {
  return `<div data-sheet-modal-owner="${escapeHtmlAttribute(SPELLS_SPELLBOOK_SECTION_ID)}">${markup}</div>`;
}

/**
 * Descreve o formulário de conjuração.
 *
 * As opções de fonte de espaço são EXATAMENTE as que a projeção conhece: cada
 * círculo presente em `derived.spellSlots.byLevel`, o pacto quando ele existe,
 * e "à vontade". Um círculo baixo demais para a magia é recusado pelo domínio
 * (`CAST_SPELL_SLOT_LEVEL_TOO_LOW`) — a seção não filtra por círculo porque não
 * conhece o círculo da magia (ver lacuna 3 no cabeçalho), e filtrar por um
 * palpite esconderia opções legítimas.
 *
 * NENHUMA opção nasce marcada. Um formulário não respondido tem de produzir um
 * comando SEM `slotSource`, que o domínio recusa com
 * `CAST_SPELL_SLOT_SOURCE_INVALID`. Pré-marcar "à vontade" era um DEFAULT DE
 * JOGO inventado pela vista: quem abrisse "Conjurar" numa magia de círculo e
 * confirmasse sem tocar em nada conjuraria de graça, porque `castSpell` aceita
 * `{kind:'at-will'}` sem conferir se a magia é truque. A ausência de escolha
 * permanece ausência.
 * @param {{spellId: string, sourceInstanceId: string|null, projection: object}} params
 * @returns {{content: string, actions: string}}
 */
function describeCastModal({ spellId, sourceInstanceId, projection }) {
  // Botões de rádio, e não um `<select>`: a escolha precisa ser legível a
  // partir do DOM por uma propriedade que exista em qualquer implementação
  // (`checked`), e cada opção fica endereçável por atributo — o que permite ao
  // teste focal exercitar o formulário exatamente como o jogador o usaria.
  // A função NÃO tem parâmetro de "marcado": não existe opção padrão.
  const opcao = (valor, rotulo) =>
    '<label>' +
    `<input type="radio" name="sheet-cast-slot-source" data-sheet-cast-slot-source value="${escapeHtmlAttribute(valor)}">` +
    `<span>${rotulo}</span>` +
    '</label>';

  const opcoes = [
    opcao('at-will', 'À vontade (sem gastar espaço)'),
    ...(projection.pact?.maximum === null || projection.pact?.maximum === undefined
      ? []
      : [opcao('pact-slot', `Espaço de Pacto (${escapeHtml(plain(projection.pact.level))}º)`)]),
    ...(projection.slots ?? []).map((slot) =>
      opcao(`spell-slot:${slot.level}`, `${escapeHtml(slot.level)}º círculo (${escapeHtml(plain(slot.available))} disponíveis)`),
    ),
  ].join('');

  // A caixa de substituição SÓ aparece quando há de fato outra concentração
  // ativa: oferecer "substituir" sem nada a substituir seria um controle sem
  // significado. Marcada, ela vira `replaceConcentration: true` no MESMO
  // comando de conjuração — nunca um segundo comando.
  const substituicao =
    projection.concentration === null
      ? ''
      : '<label data-sheet-cast-replace-block>' +
        '<input type="checkbox" data-sheet-cast-replace>' +
        `<span>Substituir a concentração em "${escapeHtml(projection.concentration)}"</span>` +
        '</label>';

  const content =
    `<div data-sheet-cast-form data-spell-id="${escapeHtmlAttribute(spellId)}" ` +
    `data-source-instance-id="${escapeHtmlAttribute(sourceInstanceId ?? '')}">` +
    `<p data-sheet-cast-spell>${escapeHtml(spellId)}</p>` +
    `<div data-sheet-cast-slot-sources>${opcoes}</div>` +
    substituicao +
    `<p class="sheet-note" data-sheet-metamagic-unavailable="${escapeHtmlAttribute(METAMAGIC_UNAVAILABLE_REASON)}">` +
    'Metamagia indisponível: as opções não são projetadas pelo modelo canônico.' +
    '</p>' +
    '</div>';

  const actions =
    `<button type="button" data-action="${escapeHtmlAttribute(SPELL_FLOW_ACTIONS.castClose)}">Cancelar</button>` +
    '<button type="button" data-action="cast-spell">Conjurar</button>';

  return { content, actions };
}

/**
 * Descreve a confirmação de substituição de concentração.
 * @param {{spellId: string, current: string|null}} params
 * @returns {{content: string, actions: string}}
 */
function describeConcentrationModal({ spellId, current }) {
  const content =
    `<div data-sheet-concentration-form data-spell-id="${escapeHtmlAttribute(spellId)}">` +
    `<p data-sheet-concentration-current>${escapeHtml(current ?? '')}</p>` +
    `<p data-sheet-concentration-next>${escapeHtml(spellId)}</p>` +
    '</div>';
  const actions =
    `<button type="button" data-action="${escapeHtmlAttribute(SPELL_FLOW_ACTIONS.concentrationClose)}">Cancelar</button>` +
    '<button type="button" data-action="set-concentration" ' +
    `data-spell-id="${escapeHtmlAttribute(spellId)}" ` +
    // A confirmação viaja no ATRIBUTO do próprio botão de confirmar: é o clique
    // que confirma, e não um estado guardado em algum lugar entre os dois.
    'data-replace-concentration="true">Substituir concentração</button>';
  return { content, actions };
}

/**
 * Descreve o detalhe de uma magia.
 *
 * A descrição de uma magia CUSTOMIZADA viaja no personagem e é renderizada com
 * o Markdown SEGURO da Task 24. A de uma magia do CATÁLOGO não está no
 * ViewModel (lacuna 3 do cabeçalho) e o modal declara o motivo — nunca um texto
 * vazio que pareceria "esta magia não tem descrição".
 * @param {{entry: object|null, spellId: string, documentRef: object|null}} params
 * @returns {{content: string, actions: string}}
 */
function describeDetailModal({ entry, spellId, documentRef }) {
  let corpo;
  if (entry !== null && typeof entry.customDescription === 'string' && entry.customDescription !== '' && documentRef !== null) {
    corpo = `<div data-sheet-spell-description>${renderSafeMarkdownToHtml(documentRef, entry.customDescription)}</div>`;
  } else {
    corpo =
      `<p class="sheet-note" data-sheet-spell-detail-unavailable="${escapeHtmlAttribute(SPELL_DETAIL_UNAVAILABLE_REASON)}">` +
      'A descrição desta magia não está na projeção canônica da ficha.' +
      '</p>';
  }
  const content =
    `<div data-sheet-spell-detail data-spell-id="${escapeHtmlAttribute(spellId)}">` +
    `<p data-sheet-spell-detail-name>${escapeHtml(entry?.customName ?? spellId)}</p>` +
    corpo +
    '</div>';
  const actions = `<button type="button" data-action="${escapeHtmlAttribute(SPELL_FLOW_ACTIONS.detailClose)}">Fechar</button>`;
  return { content, actions };
}

/**
 * Rótulo de exibição de uma magia, buscado nas coleções JÁ projetadas.
 *
 * Nenhuma resolução nova acontece aqui: `customName` é o nome que a própria
 * projeção carrega para cada entrada. Um id sem entrada correspondente devolve
 * o próprio id — visível, nunca vazio.
 * @param {object} projection - projeção desta seção.
 * @param {string} spellId - ContentId (ou instanceId) da magia.
 * @returns {string}
 */
function rotuloDeMagia(projection, spellId) {
  const entrada = findEntry(projection, spellId, null);
  return entrada?.customName ?? spellId;
}

/**
 * Localiza a entrada projetada de uma magia, por id e coleção.
 * @param {object} projection
 * @param {string} spellId
 * @param {string|null} collection
 * @returns {object|null}
 */
function findEntry(projection, spellId, collection) {
  const colecoes = collection === null ? SPELL_COLLECTION_ORDER : [collection];
  for (const nome of colecoes) {
    for (const entry of projection.collections?.[nome] ?? []) {
      if (entry.spellId === spellId || entry.instanceId === spellId) {
        return entry;
      }
    }
  }
  return null;
}

/**
 * Lê a fonte de espaço escolhida no formulário, no formato discriminado que
 * `castSpell` exige. Um valor irreconhecível vira `null`, e o comando sai SEM
 * `slotSource` — o domínio recusa com `CAST_SPELL_SLOT_SOURCE_INVALID`, erro
 * declarado. A vista nunca escolhe um espaço no lugar do jogador.
 * @param {string|null} raw
 * @returns {object|null}
 */
function parseSlotSource(raw) {
  if (raw === 'at-will') {
    return { kind: 'at-will' };
  }
  if (raw === 'pact-slot') {
    return { kind: 'pact-slot' };
  }
  if (typeof raw === 'string' && raw.startsWith('spell-slot:')) {
    const nivel = Number.parseInt(raw.slice('spell-slot:'.length), 10);
    return Number.isInteger(nivel) ? { kind: 'spell-slot', level: nivel } : null;
  }
  return null;
}

/**
 * Localiza um formulário de modal a partir do elemento clicado.
 *
 * Procura, nesta ordem: o contêiner do próprio dono do modal, o elemento-pai
 * dele e, por fim, a raiz de delegação do modal. Devolve `null` quando não há
 * formulário nenhum — e aí o comando sai sem os campos, para o domínio recusar
 * com erro nomeado.
 * @param {object} acionado
 * @param {object|null} root
 * @param {string} seletor
 * @returns {object|null}
 */
function findForm(acionado, root, seletor) {
  const dono = typeof acionado.closest === 'function' ? acionado.closest('[data-sheet-modal-owner]') : null;
  for (const escopo of [dono, dono?.parentElement ?? null, root]) {
    if (escopo !== null && escopo !== undefined && typeof escopo.querySelector === 'function') {
      const encontrado = escopo.querySelector(seletor);
      if (encontrado !== null) {
        return encontrado;
      }
    }
  }
  return null;
}

/**
 * Lê o `value` do controle MARCADO dentro de `escopo`. Percorre a lista em vez
 * de usar o pseudo-seletor `:checked`, para não depender de quanto do CSS a
 * implementação de DOM em uso resolve. Nenhum marcado devolve `null` —
 * ausência é ausência, e o comando sai sem o campo.
 * @param {object|null} escopo
 * @param {string} seletor
 * @returns {string|null}
 */
function readCheckedValue(escopo, seletor) {
  if (escopo === null || escopo === undefined || typeof escopo.querySelectorAll !== 'function') {
    return null;
  }
  /** @type {string|null} */
  let padrao = null;
  for (const controle of escopo.querySelectorAll(seletor)) {
    if (controle.checked === true) {
      return controle.getAttribute('value');
    }
    // O ATRIBUTO `checked` é o padrão declarado no markup. Ele só vale quando
    // NENHUM controle tem a propriedade marcada — se o jogador escolheu outra
    // opção, a propriedade do escolhido é `true` e o laço já retornou acima. A
    // ordem importa: trocar as duas leituras faria a escolha do jogador ser
    // ignorada em favor do padrão do markup.
    if (padrao === null && controle.hasAttribute?.('checked') === true) {
      padrao = controle.getAttribute('value');
    }
  }
  return padrao;
}

/**
 * Traduz um evento em `UiEventDecision`.
 *
 * Seis `data-action` de FLUXO abrem/fecham modal (e não mutam nada); os demais
 * viram um comando com aquele `type` — o que faz `cast-spell`,
 * `set-concentration` e `end-concentration` funcionarem, e faz um `data-action`
 * inventado ser recusado com `COMMAND_TYPE_UNKNOWN`. Não existe caminho entre
 * "elemento com `data-action`" e "nada acontece".
 *
 * @param {object} event
 * @param {{root: object, projection: object, uiState: object}} context
 * @returns {Readonly<object>} UiEventDecision
 */
export function spellsSpellbookToIntent(event, context = {}) {
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

  const projection = context.projection ?? {};
  const root = context.root ?? null;

  // --- Fluxo de modal: DESCREVE, nunca muta -------------------------------
  if (action === SPELL_FLOW_ACTIONS.castOpen) {
    const spellId = acionado.getAttribute('data-spell-id') ?? '';
    const fonte = acionado.getAttribute('data-source-instance-id');
    const descricao = describeCastModal({
      spellId,
      sourceInstanceId: fonte === null || fonte === '' ? null : fonte,
      projection,
    });
    return createUiEventDecision({
      intent: createSheetIntent(SHEET_INTENT_TYPES.modalOpen, {
        modalId: SPELL_CAST_MODAL_ID,
        title: 'Conjurar magia',
        content: owned(descricao.content),
        actions: owned(descricao.actions),
        // Nenhuma preferência é gravada ao abrir este modal.
        uiStatePatch: null,
      }),
      preventDefault: true,
    });
  }

  if (action === SPELL_FLOW_ACTIONS.concentrationOpen) {
    const spellId = acionado.getAttribute('data-spell-id') ?? '';
    // Sem concentração ativa não há o que substituir: o comando direto já
    // basta, e um modal de confirmação vazio seria ruído. UM comando, aqui
    // também.
    if (projection.concentration === null || projection.concentration === undefined) {
      return createUiEventDecision({
        intent: createSheetIntent(SHEET_INTENT_TYPES.command, { command: { type: 'set-concentration', spellId } }),
        preventDefault: true,
      });
    }
    const descricao = describeConcentrationModal({ spellId, current: projection.concentration });
    return createUiEventDecision({
      intent: createSheetIntent(SHEET_INTENT_TYPES.modalOpen, {
        modalId: CONCENTRATION_MODAL_ID,
        title: 'Substituir concentração',
        content: owned(descricao.content),
        actions: owned(descricao.actions),
        uiStatePatch: null,
      }),
      preventDefault: true,
    });
  }

  if (action === SPELL_FLOW_ACTIONS.detailOpen) {
    const spellId = acionado.getAttribute('data-spell-id') ?? '';
    const collection = acionado.getAttribute('data-collection');
    const descricao = describeDetailModal({
      entry: findEntry(projection, spellId, collection),
      spellId,
      documentRef: root?.ownerDocument ?? null,
    });
    return createUiEventDecision({
      intent: createSheetIntent(SHEET_INTENT_TYPES.modalOpen, {
        modalId: SPELL_DETAIL_MODAL_ID,
        title: 'Detalhes da magia',
        content: owned(descricao.content),
        actions: owned(descricao.actions),
        uiStatePatch: null,
      }),
      preventDefault: true,
    });
  }

  if (action === SPELL_FLOW_ACTIONS.castClose || action === SPELL_FLOW_ACTIONS.concentrationClose || action === SPELL_FLOW_ACTIONS.detailClose) {
    // CANCELAR não emite comando: a intenção não carrega `command`, e o
    // personagem confirmado permanece byte a byte como estava.
    const modalId =
      action === SPELL_FLOW_ACTIONS.castClose
        ? SPELL_CAST_MODAL_ID
        : action === SPELL_FLOW_ACTIONS.concentrationClose
          ? CONCENTRATION_MODAL_ID
          : SPELL_DETAIL_MODAL_ID;
    return createUiEventDecision({
      intent: createSheetIntent(SHEET_INTENT_TYPES.modalClose, { modalId }),
      preventDefault: true,
    });
  }

  // --- Comandos canônicos --------------------------------------------------
  /** @type {Record<string, *>} */
  const command = { type: action };

  if (action === 'cast-spell') {
    // O formulário e o botão de confirmar vivem em partes DIFERENTES do modal
    // (`content` e `actions` são materializados em contêineres distintos pelo
    // `ModalService`). Por isso a busca começa perto e ABRE para a raiz de
    // delegação do modal — que é o menor escopo que contém os dois. Sem esse
    // segundo passo, o clique em "Conjurar" leria um formulário inexistente e
    // produziria um comando sem espaço escolhido.
    const formulario = findForm(acionado, root, '[data-sheet-cast-form]');
    const fonte = formulario?.getAttribute('data-source-instance-id') ?? '';
    command.spellId = formulario?.getAttribute('data-spell-id') ?? null;
    // A chave precisa estar PRESENTE mesmo valendo `null` — `castSpell` exige
    // isso para que um esquecimento não vire "fonte base/classe" por acidente.
    command.sourceInstanceId = fonte === '' ? null : fonte;
    const slotSource = parseSlotSource(readCheckedValue(formulario, '[data-sheet-cast-slot-source]'));
    if (slotSource !== null) {
      command.slotSource = slotSource;
    }
    command.replaceConcentration = formulario?.querySelector('[data-sheet-cast-replace]')?.checked === true;
  } else if (action === 'set-concentration') {
    command.spellId = acionado.getAttribute('data-spell-id');
    if (acionado.getAttribute('data-replace-concentration') === 'true') {
      command.replaceConcentration = true;
    }
  } else if (action === 'prepare-spell' || action === 'unprepare-spell' || action === 'remove-spellbook-spell') {
    // Correção C1: os três comandos de preparo/grimório viajam com a
    // identidade completa da entrada. `sourceInstanceId` PRESENTE mesmo
    // valendo `null` — mesma exigência de `cast-spell` (a ausência da chave
    // nunca pode virar "fonte base/classe" por acidente).
    command.spellId = acionado.getAttribute('data-spell-id');
    const fonte = acionado.getAttribute('data-source-instance-id');
    command.sourceInstanceId = fonte === null || fonte === '' ? null : fonte;
    if (action === 'prepare-spell' && acionado.getAttribute('data-prepared-from') === 'spellbook') {
      command.preparedFrom = 'spellbook';
    }
  }

  return createUiEventDecision({
    intent: createSheetIntent(SHEET_INTENT_TYPES.command, { command }),
    preventDefault: true,
  });
}

/**
 * Cria a seção `spells-spellbook` validada pelo registro.
 * @returns {import('../../../core/result.js').Result} Result<Section, AppError>
 */
export function createSpellsSpellbookSection() {
  return createSheetSection({
    id: SPELLS_SPELLBOOK_SECTION_ID,
    select: selectSpellsSpellbook,
    render: renderSpellsSpellbook,
    toIntent: spellsSpellbookToIntent,
    eventTypes: ['click'],
  });
}
