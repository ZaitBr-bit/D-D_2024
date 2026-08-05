// Seção `inventory-load-coins` (Task 32): INVENTÁRIO (itens ativos, mochila e
// esgotados), CARGA transportada e CARTEIRA.
//
// ## Contrato de seção (Task 29), sem exceções
//
// `select` recorta a projeção; `render` devolve markup; `toIntent` devolve uma
// `UiEventDecision`. A seção não recebe repositório, não recebe catálogo, não
// recebe `ModalService` e não registra listener. Todo número exibido já vem
// pronto de `derived` (`derived.inventory`, `derived.load`, `derived.wallet` —
// extensões da Task 32 documentadas em `sheet-view-model-keys.json`): nenhum
// peso, custo, capacidade ou conversão de moeda é recalculado aqui.
//
// ## A identidade de um item é `instanceId`, NUNCA o índice
//
// É o item explícito do checklist do brief, e é a regra que `reorderInventory`
// (Task 19) impõe: reordenar exige uma PERMUTAÇÃO EXATA dos ids atuais. Por
// isso `derived.inventory` sequer expõe `index` (ver a nota da fixture), o
// markup endereça cada linha por `data-instance-id`, e o arrasto emite a lista
// completa de ids na nova ordem. Um índice viajando no comando voltaria a
// permitir que a tela e o registro discordem sobre QUAL item foi movido — o
// defeito que o baseline tem por construção (`renderSheetInvItem(item, idx)`).
//
// ## Agrupamento ativos/mochila/esgotados: partição, não regra de jogo
//
// Os três grupos replicam LITERALMENTE `site/js/pages/sheet.js`
// (~15440-15450, commit e43c5ea): `quantidade <= 0` -> esgotados; senão
// `equipado` -> equipados; senão mochila. É uma partição de APRESENTAÇÃO sobre
// campos que já vêm da projeção (`quantity`/`equipped`), não uma regra
// derivada: nada é somado, comparado com capacidade nem inferido de nome.
//
// ## O arrasto guarda o item arrastado no UI STATE, não em variável de módulo
//
// Uma seção é pura e não pode ter memória própria (duas fichas montadas na
// mesma página compartilhariam a variável — o vazamento que
// `sheet-session-isolation.test.js` existe para impedir). `dragstart` emite uma
// intenção `sheet/ui-state` com `draggingInstanceId`, `drop` lê esse id de
// `context.uiState` e emite a permutação. Nenhum efeito é aplicado ao evento
// pela seção: `dragover` só DESCREVE `preventDefault: true`, e quem o aplica é
// o controller (`applyUiEventDecision`).
//
// O id do arrasto é limpo por `drop` E por `dragend` — não só por `dragend`.
// Confiar num único ponto de limpeza deixava o id ÓRFÃO sempre que o `dragend`
// não chegava à raiz de delegação (nó desmontado por um repaint no meio do
// gesto, arrasto abortado), e um id órfão transforma o próximo `drop` — de um
// arquivo, de um texto selecionado, de um arrasto vindo de fora — num
// `reorder-inventory` real que ninguém pediu. Por isso, além da limpeza dupla:
// `dragover` só descreve `preventDefault` quando há arrasto NOSSO em andamento
// (id guardado que ainda é item desta projeção), e `sheet-session#setUiState`
// zera `dirtySections` para que uma mudança de tela não repinte a seção no meio
// do arrasto.
//
// ## Lacunas DECLARADAS (nunca controle sem comando por trás)
//
//  1. COMPRA NÃO É ATÔMICA (`SHEET_PURCHASE_NOT_ATOMIC`). O vocabulário
//     fechado da Task 19 tem `add-inventory-item` e `change-wallet` como
//     comandos SEPARADOS, e uma `SheetIntent` carrega UM comando. Não existe
//     `purchase-item` que adicione o item e debite o custo numa transação só.
//     Em vez de encadear dois comandos por fora (que poderia deixar o item
//     adicionado e o pagamento não feito, sem erro nenhum), o modal de compra
//     adiciona o item e o pagamento é uma operação EXPLÍCITA da carteira, com
//     a limitação exibida.
//  2. CATÁLOGO NÃO PROJETADO (`SHEET_ITEM_CATALOG_NOT_PROJECTED`). Nenhuma
//     chave de `derived` lista os itens compráveis do catálogo, e uma seção não
//     recebe o registro. Embutir aqui uma lista de itens seria inventar
//     conteúdo de jogo dentro do renderizador. O controle é, então, o que o
//     modelo permite: o ContentId do item é digitado, exatamente como
//     `conditions-defenses-senses-section.js` faz com a condição.
//
// Fora essas duas, TODA ação desta seção tem comando canônico correspondente
// (`INVENTORY_COMMAND_TYPES`, confrontado com o dispatcher pelo teste focal):
// não existe aqui clique que não vire comando ou motivo nomeado.

import { escapeHtml, escapeHtmlAttribute } from '../../../ui/html.js';
import { createUiEventDecision, NO_UI_EVENT_DECISION } from '../../../ui/event-delegation.js';
import { SHEET_INTENT_TYPES, createSheetIntent } from '../sheet-state.js';
import { createSheetSection } from './section-registry.js';

/** Id canônico desta seção. */
export const INVENTORY_LOAD_COINS_SECTION_ID = 'inventory-load-coins';

/**
 * Tipos de comando canônico que esta seção emite. Confrontados com o
 * vocabulário de `domain/commands/command-dispatcher.js` pelo teste focal: um
 * comando renomeado no domínio quebra o teste em vez de apagar um botão em
 * silêncio.
 * @type {ReadonlyArray<string>}
 */
export const INVENTORY_COMMAND_TYPES = Object.freeze([
  'add-inventory-item',
  'remove-inventory-item',
  'change-item-quantity',
  'equip-item',
  'reorder-inventory',
  'change-wallet',
]);

/** `modalId` do formulário de compra (item de catálogo). */
export const INVENTORY_PURCHASE_MODAL_ID = 'sheet-inventory-purchase';

/** `modalId` do formulário de item customizado. */
export const INVENTORY_CUSTOM_MODAL_ID = 'sheet-inventory-custom';

/** Motivo NOMEADO da ausência de compra atômica (ver o cabeçalho). */
export const PURCHASE_NOT_ATOMIC_REASON = 'SHEET_PURCHASE_NOT_ATOMIC';

/** Motivo NOMEADO da ausência de catálogo de itens na projeção. */
export const ITEM_CATALOG_UNAVAILABLE_REASON = 'SHEET_ITEM_CATALOG_NOT_PROJECTED';

/** Motivo NOMEADO da ausência de tabela de conversão de moedas. */
export const CURRENCY_RATES_UNAVAILABLE_REASON = 'SHEET_CURRENCY_RATES_UNAVAILABLE';

/**
 * Motivo usado quando `derived.inventory` diz `available: false` sem dizer POR
 * QUÊ (envelope de uma versão antiga da projeção). Nunca substitui o `reason`
 * publicado pelo ViewModel: só impede que a ausência apareça sem nome.
 * @type {string}
 */
export const INVENTORY_UNAVAILABLE_FALLBACK_REASON = 'SHEET_INVENTORY_UNAVAILABLE';

/**
 * Ações de FLUXO (abrir/fechar modal, arrastar). Não são tipos de comando: são
 * nomes de interação, e por isso vivem num objeto separado de
 * `INVENTORY_COMMAND_TYPES` — misturá-los faria o teste que confronta o
 * dispatcher acusar "comando inexistente" para um nome que nunca foi comando.
 * @type {Readonly<Record<string, string>>}
 */
export const INVENTORY_FLOW_ACTIONS = Object.freeze({
  purchaseOpen: 'sheet-inventory-purchase-open',
  purchaseClose: 'sheet-inventory-purchase-close',
  customOpen: 'sheet-inventory-custom-open',
  customClose: 'sheet-inventory-custom-close',
});

/**
 * Os três grupos de apresentação, na ordem do baseline.
 * @type {ReadonlyArray<Readonly<{key: string, label: string}>>}
 */
const ITEM_GROUPS = Object.freeze([
  Object.freeze({ key: 'equipped', label: 'Equipados' }),
  Object.freeze({ key: 'backpack', label: 'Mochila' }),
  Object.freeze({ key: 'depleted', label: 'Esgotados' }),
]);

/**
 * As cinco denominações da carteira, na ordem de apresentação (da mais valiosa
 * para a menos). Os CÓDIGOS vêm do vocabulário fechado da Task 19
 * (`WALLET_DENOMINATIONS`); os rótulos são de tela.
 * @type {ReadonlyArray<Readonly<{key: string, label: string}>>}
 */
const WALLET_FIELDS = Object.freeze([
  Object.freeze({ key: 'pl', label: 'Platina' }),
  Object.freeze({ key: 'po', label: 'Ouro' }),
  Object.freeze({ key: 'pe', label: 'Electro' }),
  Object.freeze({ key: 'pp', label: 'Prata' }),
  Object.freeze({ key: 'pc', label: 'Cobre' }),
]);

/** Seletores dos campos de formulário desta seção. */
const SELECTORS = Object.freeze({
  walletQuantity: '[data-sheet-wallet-quantity]',
  walletCost: '[data-sheet-wallet-cost]',
  purchaseItemId: '[data-sheet-purchase-item-id]',
  purchaseItemVersion: '[data-sheet-purchase-item-version]',
  purchaseQuantity: '[data-sheet-purchase-quantity]',
  purchaseEquipped: '[data-sheet-purchase-equipped]',
  customName: '[data-sheet-custom-name]',
  customWeight: '[data-sheet-custom-weight]',
  customCost: '[data-sheet-custom-cost]',
  customQuantity: '[data-sheet-custom-quantity]',
});

/**
 * Formata um valor distinguindo AUSÊNCIA de zero. Um `0` no lugar de um valor
 * desconhecido afirma "o valor é zero", que é falso.
 * @param {*} value
 * @returns {string}
 */
function plain(value) {
  return value === null || value === undefined ? '—' : String(value);
}

/**
 * Encontra um campo do formulário aberto.
 *
 * Procura, nesta ordem: o contêiner do próprio dono do modal, o elemento-pai
 * dele e, por fim, a raiz de delegação. É a MESMA cascata de
 * `spells-spellbook-section.js#findForm` (Task 31), e ela existe porque
 * `content` e `actions` de um modal são materializados em elementos IRMÃOS
 * pelo controller: o botão de confirmar está num `owned(...)` diferente do
 * `owned(...)` que tem os campos, e procurar só a partir do botão nunca
 * encontraria o formulário.
 *
 * Devolve `null` quando não há campo nenhum — e aí o comando sai sem a
 * propriedade, para o domínio recusar com erro nomeado.
 * @param {object|null} acionado
 * @param {object|null} root
 * @param {string} selector
 * @returns {object|null}
 */
function findField(acionado, root, selector) {
  const dono = typeof acionado?.closest === 'function' ? acionado.closest('[data-sheet-modal-owner]') : null;
  for (const escopo of [dono, dono?.parentElement ?? null, root]) {
    if (escopo !== null && escopo !== undefined && typeof escopo.querySelector === 'function') {
      const encontrado = escopo.querySelector(selector);
      if (encontrado !== null) {
        return encontrado;
      }
    }
  }
  return null;
}

/**
 * Lê o valor de texto de um campo, devolvendo `''` quando ele não existe.
 * @param {object|null} acionado
 * @param {object|null} root
 * @param {string} selector
 * @returns {string}
 */
function readField(acionado, root, selector) {
  const campo = findField(acionado, root, selector);
  return typeof campo?.value === 'string' ? campo.value.trim() : '';
}

/**
 * Lê o estado marcado/desmarcado de uma caixa de seleção.
 * @param {object|null} acionado
 * @param {object|null} root
 * @param {string} selector
 * @returns {boolean}
 */
function readChecked(acionado, root, selector) {
  const campo = findField(acionado, root, selector);
  if (campo === null) {
    return false;
  }
  // Num navegador real a PROPRIEDADE é a verdade (ela acompanha o clique do
  // usuário; o atributo continua marcando só o estado inicial). Em uma
  // implementação de DOM que não materializa a propriedade, cair no atributo é
  // melhor do que ler `undefined` e concluir "desmarcado" — que faria a
  // preferência do jogador ser silenciosamente descartada.
  if (typeof campo.checked === 'boolean') {
    return campo.checked;
  }
  return typeof campo.hasAttribute === 'function' && campo.hasAttribute('checked');
}

/**
 * Converte texto em INTEIRO, ou `null` quando o texto não é um inteiro. Nunca
 * arredonda nem "conserta": um valor impossível vira ausência, e a ausência é
 * recusada pelo domínio com erro nomeado — a vista não inventa número.
 * @param {string} text
 * @returns {number|null}
 */
function toInteger(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return null;
  }
  const numero = Number(text);
  return Number.isInteger(numero) ? numero : null;
}

/**
 * Próximo `instanceId` determinístico para um item criado pela ficha.
 *
 * O domínio NÃO pode gerar id (seria `Math.random`/`crypto`, proibidos lá pela
 * Task 4) e por isso `addInventoryItem` EXIGE `instanceId` de quem chama. A
 * regra aqui é a MESMA já usada por `features/creator/steps/equipment-step.js`
 * (`manual-<sequência>`): um contador derivado dos ids já presentes, e não um
 * valor aleatório. Assim o mesmo estado produz sempre o mesmo id — a seção
 * continua pura e o teste consegue afirmar o comando inteiro.
 *
 * Colisão continua sendo erro EXPLÍCITO do domínio
 * (`COMMAND_INVENTORY_INSTANCE_ID_DUPLICATE`), nunca sobrescrita silenciosa.
 * @param {ReadonlyArray<object>} items
 * @returns {string}
 */
export function nextSheetInstanceId(items) {
  const prefixo = 'sheet-item-';
  let maior = 0;
  for (const item of items ?? []) {
    const id = item?.instanceId;
    if (typeof id !== 'string' || !id.startsWith(prefixo)) {
      continue;
    }
    const numero = Number(id.slice(prefixo.length));
    if (Number.isInteger(numero) && numero > maior) {
      maior = numero;
    }
  }
  return `${prefixo}${maior + 1}`;
}

/**
 * Move `sourceId` para a posição de `targetId`, devolvendo a lista COMPLETA de
 * ids na nova ordem — uma permutação exata da atual, que é o que
 * `reorderInventory` exige.
 *
 * Devolve `null` quando um dos ids não pertence à lista (arrasto para fora, id
 * repetido, projeção desatualizada): melhor não emitir comando nenhum do que
 * emitir uma "permutação" que o domínio recusaria por não ser permutação.
 * @param {ReadonlyArray<string>} ids
 * @param {string} sourceId
 * @param {string} targetId
 * @returns {ReadonlyArray<string>|null}
 */
export function reorderInstanceIds(ids, sourceId, targetId) {
  const lista = Array.isArray(ids) ? [...ids] : [];
  const origem = lista.indexOf(sourceId);
  const destino = lista.indexOf(targetId);
  if (origem === -1 || destino === -1 || origem === destino) {
    return null;
  }
  lista.splice(origem, 1);
  lista.splice(destino, 0, sourceId);
  return Object.freeze(lista);
}

/**
 * Recorta do ViewModel a projeção desta seção. Pura, sem cálculo: os itens, a
 * carga e a carteira já vêm prontos de `derived`.
 *
 * A ÚNICA transformação é a partição em três grupos, que replica literalmente o
 * baseline (ver o cabeçalho) e não deriva nenhum valor novo.
 * @param {object|null} viewModel
 * @returns {Readonly<object>}
 */
export function selectInventoryLoadCoins(viewModel) {
  if (viewModel === null || typeof viewModel !== 'object') {
    return Object.freeze({ available: false });
  }
  const derived = viewModel.derived ?? {};
  // `derived.inventory` é um ENVELOPE (`available`/`reason`/`items`), não um
  // array solto: sem catálogo a projeção de inventário nem é calculada, e uma
  // lista vazia afirmaria "o personagem não tem item nenhum" — mentira que a
  // seção repassaria para a tela. Ver a nota do envelope em `sheet-view-model`.
  const inventory = derived.inventory ?? null;
  const itemsAvailable = inventory !== null && typeof inventory === 'object' && inventory.available === true;
  const items = Object.freeze([...(itemsAvailable ? (inventory.items ?? []) : [])]);
  const load = derived.load ?? {};
  const wallet = derived.wallet ?? {};

  const equipped = [];
  const backpack = [];
  const depleted = [];
  for (const item of items) {
    // Mesma ordem de decisão do baseline: quantidade zerada vence "equipado".
    if (!(item.quantity > 0)) {
      depleted.push(item);
    } else if (item.equipped === true) {
      equipped.push(item);
    } else {
      backpack.push(item);
    }
  }

  return Object.freeze({
    available: true,
    // Disponibilidade da LISTA de itens, separada de `available` (que diz se há
    // ViewModel). `false` significa "não deu para saber", nunca "vazio".
    itemsAvailable,
    itemsUnavailableReason: itemsAvailable ? null : ((inventory?.reason ?? null) || INVENTORY_UNAVAILABLE_FALLBACK_REASON),
    items,
    // Ordem canônica dos ids — a base de qualquer permutação de reordenação.
    instanceIds: Object.freeze(items.map((item) => item.instanceId)),
    groups: Object.freeze({
      equipped: Object.freeze(equipped),
      backpack: Object.freeze(backpack),
      depleted: Object.freeze(depleted),
    }),
    load: Object.freeze({
      totalWeightKg: load.totalWeightKg ?? null,
      carryingCapacityKg: load.carryingCapacityKg ?? null,
      encumbranceLevel: load.encumbranceLevel ?? null,
      overloaded: load.overloaded === true,
      encumbranceAffectsMovement: load.encumbranceAffectsMovement === true,
    }),
    wallet: Object.freeze({
      pl: wallet.pl ?? null,
      po: wallet.po ?? null,
      pe: wallet.pe ?? null,
      pp: wallet.pp ?? null,
      pc: wallet.pc ?? null,
      totalCopper: wallet.totalCopper ?? null,
      ratesAvailable: wallet.ratesAvailable === true,
    }),
    // Id determinístico do PRÓXIMO item criado por esta ficha (ver
    // `nextSheetInstanceId`). Faz parte da projeção para que `render` e
    // `toIntent` concordem sobre ele sem que nenhum dos dois sorteie nada.
    nextInstanceId: nextSheetInstanceId(items),
  });
}

/**
 * Markup de UMA linha de item.
 *
 * Nome, categoria e avisos são conteúdo NÃO CONFIÁVEL (item customizado é texto
 * livre do jogador, e um registro importado pode trazer qualquer coisa): tudo
 * passa por `escapeHtml`/`escapeHtmlAttribute`, nunca por interpolação crua.
 * @param {object} item
 * @returns {string}
 */
function renderItem(item) {
  const id = escapeHtmlAttribute(item.instanceId ?? '');
  const avisos =
    (item.advisories ?? []).length === 0
      ? ''
      : '<ul data-sheet-item-advisories>' +
        item.advisories.map((aviso) => `<li>${escapeHtml(typeof aviso === 'string' ? aviso : (aviso?.code ?? ''))}</li>`).join('') +
        '</ul>';

  return (
    `<li data-sheet-item="${id}" data-instance-id="${id}" draggable="true" data-sheet-item-draggable ` +
    `data-equipped="${item.equipped === true ? 'true' : 'false'}" ` +
    `data-custom="${item.isCustom === true ? 'true' : 'false'}">` +
    `<span data-sheet-item-name>${escapeHtml(item.name ?? '')}</span>` +
    `<span data-sheet-item-category>${escapeHtml(plain(item.categoryLabel))}</span>` +
    `<span data-sheet-item-quantity>${escapeHtml(plain(item.quantity))}</span>` +
    `<span data-sheet-item-weight>${escapeHtml(plain(item.stackWeightKg))}</span>` +
    `<span data-sheet-item-cost>${escapeHtml(plain(item.unitCostCopper))}</span>` +
    `<span data-sheet-item-proficient>${escapeHtml(plain(item.proficient))}</span>` +
    `<span data-sheet-item-strength>${escapeHtml(plain(item.strengthRequirement))}</span>` +
    avisos +
    `<button type="button" data-action="change-item-quantity" data-instance-id="${id}" data-delta="1">+1</button>` +
    `<button type="button" data-action="change-item-quantity" data-instance-id="${id}" data-delta="-1">-1</button>` +
    `<button type="button" data-action="equip-item" data-instance-id="${id}" ` +
    `data-equipped="${item.equipped === true ? 'false' : 'true'}">` +
    (item.equipped === true ? 'Desequipar' : 'Equipar') +
    '</button>' +
    `<button type="button" data-action="remove-inventory-item" data-instance-id="${id}">Remover</button>` +
    '</li>'
  );
}

/**
 * Markup dos três grupos de itens.
 * @param {object} groups
 * @returns {string}
 */
function renderGroups(groups) {
  return ITEM_GROUPS.map(({ key, label }) => {
    const itens = groups[key] ?? [];
    const corpo =
      itens.length === 0
        ? `<p class="sheet-empty" data-sheet-item-group-empty="${escapeHtmlAttribute(key)}">Nenhum item</p>`
        : `<ul data-sheet-item-group-list="${escapeHtmlAttribute(key)}">${itens.map((item) => renderItem(item)).join('')}</ul>`;
    return (
      `<section data-sheet-item-group="${escapeHtmlAttribute(key)}" data-count="${itens.length}">` +
      `<h4>${escapeHtml(label)} (${itens.length})</h4>` +
      corpo +
      '</section>'
    );
  }).join('');
}

/**
 * Markup do bloco de carga. Todos os números vêm de `derived.load`.
 * @param {object} load
 * @returns {string}
 */
function renderLoad(load) {
  return (
    '<div data-sheet-load ' +
    `data-overloaded="${load.overloaded ? 'true' : 'false'}" ` +
    `data-affects-movement="${load.encumbranceAffectsMovement ? 'true' : 'false'}">` +
    `<span data-sheet-load-total>${escapeHtml(plain(load.totalWeightKg))}</span>` +
    `<span data-sheet-load-capacity>${escapeHtml(plain(load.carryingCapacityKg))}</span>` +
    `<span data-sheet-load-level>${escapeHtml(plain(load.encumbranceLevel))}</span>` +
    '</div>'
  );
}

/**
 * Markup do bloco de carteira.
 *
 * Cada denominação tem um campo de quantidade e as operações do vocabulário
 * fechado da Task 19 (`add`, `remove`, `convert-up`). O pagamento tem campo
 * próprio (texto de custo, ex. "5 po"), porque `pay` não usa denominação.
 *
 * Campo vazio vira propriedade AUSENTE no comando, e o domínio recusa com
 * `WALLET_QUANTITY_INVALID`/`WALLET_REQUEST_COST_INVALID`: a vista nunca
 * preenche "1" por conta própria.
 * @param {object} wallet
 * @returns {string}
 */
function renderWallet(wallet) {
  const linhas = WALLET_FIELDS.map(({ key, label }) => {
    const den = escapeHtmlAttribute(key);
    return (
      `<li data-sheet-wallet-denomination="${den}">` +
      `<span data-sheet-wallet-label>${escapeHtml(label)}</span>` +
      `<span data-sheet-wallet-value>${escapeHtml(plain(wallet[key]))}</span>` +
      `<input type="number" data-sheet-wallet-quantity="${den}">` +
      `<button type="button" data-action="change-wallet" data-wallet-operation="add" data-denomination="${den}">Adicionar</button>` +
      `<button type="button" data-action="change-wallet" data-wallet-operation="remove" data-denomination="${den}">Remover</button>` +
      `<button type="button" data-action="change-wallet" data-wallet-operation="convert-up" data-denomination="${den}">Converter</button>` +
      '</li>'
    );
  }).join('');

  // A ausência de tabela de câmbio é EXIBIDA, não escondida: sem ela o total
  // convertido não existe (`null`, nunca 0) e `convert-up`/`pay` falham com
  // erro nomeado do domínio.
  const aviso = wallet.ratesAvailable
    ? ''
    : `<p class="sheet-note" data-sheet-currency-rates-unavailable="${escapeHtmlAttribute(CURRENCY_RATES_UNAVAILABLE_REASON)}">` +
      'Sem tabela de conversão: o total em PC e as conversões ficam indisponíveis.' +
      '</p>';

  return (
    '<div data-sheet-wallet ' +
    `data-rates-available="${wallet.ratesAvailable ? 'true' : 'false'}">` +
    `<span data-sheet-wallet-total-copper>${escapeHtml(plain(wallet.totalCopper))}</span>` +
    `<ul data-sheet-wallet-list>${linhas}</ul>` +
    '<label><span>Custo</span><input type="text" data-sheet-wallet-cost></label>' +
    '<button type="button" data-action="change-wallet" data-wallet-operation="pay">Pagar</button>' +
    aviso +
    '</div>'
  );
}

/**
 * Renderiza o miolo da seção.
 * @param {object} projection
 * @param {object} [uiState]
 * @returns {string}
 */
export function renderInventoryLoadCoins(projection, uiState = {}) {
  void uiState;
  if (projection === null || typeof projection !== 'object' || projection.available !== true) {
    return '<p class="sheet-empty" data-sheet-inventory-unavailable>Inventário indisponível: a ficha não tem projeção canônica.</p>';
  }

  // AUSÊNCIA da lista != lista vazia. Sem catálogo os três grupos NÃO são
  // desenhados: "Nenhum item" ali seria uma afirmação falsa sobre o
  // personagem. No lugar deles vai o motivo NOMEADO, como a Task 31 já faz com
  // `SHEET_SPELL_PREPARATION_NOT_COMMANDED` — a lacuna aparece, nunca some.
  const corpoDeItens =
    projection.itemsAvailable === false
      ? `<p class="sheet-note" data-sheet-inventory-items-unavailable="${escapeHtmlAttribute(projection.itemsUnavailableReason ?? INVENTORY_UNAVAILABLE_FALLBACK_REASON)}">` +
        'Sem catálogo carregado: a lista de itens não pôde ser resolvida (isto não significa que o personagem não tenha itens).' +
        '</p>'
      : renderGroups(projection.groups);

  return (
    `<div class="sheet-inventory" data-sheet-inventory-load-coins data-items-available="${projection.itemsAvailable === false ? 'false' : 'true'}">` +
    renderLoad(projection.load) +
    corpoDeItens +
    `<button type="button" data-action="${escapeHtmlAttribute(INVENTORY_FLOW_ACTIONS.purchaseOpen)}">Comprar item</button>` +
    `<button type="button" data-action="${escapeHtmlAttribute(INVENTORY_FLOW_ACTIONS.customOpen)}">Item customizado</button>` +
    renderWallet(projection.wallet) +
    // Lacuna DECLARADA (ver cabeçalho): não existe comando de compra atômica.
    `<p class="sheet-note" data-sheet-purchase-not-atomic="${escapeHtmlAttribute(PURCHASE_NOT_ATOMIC_REASON)}">` +
    'Adicionar o item e pagar o custo são operações separadas: não há comando canônico de compra atômica.' +
    '</p>' +
    '</div>'
  );
}

/**
 * Envolve o markup de um modal com o marcador de DONO, para que os cliques
 * dentro dele voltem ao `toIntent` desta seção (o overlay do modal é irmão do
 * container da ficha, então não há contêiner de seção no caminho).
 * @param {string} markup
 * @returns {string}
 */
function owned(markup) {
  return `<div data-sheet-modal-owner="${escapeHtmlAttribute(INVENTORY_LOAD_COINS_SECTION_ID)}">${markup}</div>`;
}

/**
 * Descreve o modal de COMPRA (item de catálogo).
 *
 * O ContentId é digitado porque o catálogo não é projetado (lacuna 2 do
 * cabeçalho). A caixa "já equipado" nasce marcada a partir da PREFERÊNCIA
 * persistida (`dnd_comprar_ativo_padrao`, espelhada no UI state pela sessão) —
 * é a preferência do jogador lida do repositório, não um default de jogo
 * inventado aqui: sem preferência, ela nasce desmarcada.
 * @param {{uiState: object}} params
 * @returns {{content: string, actions: string}}
 */
function describePurchaseModal({ uiState }) {
  const marcado = uiState?.purchaseEquippedDefault === true ? ' checked' : '';
  return {
    content:
      '<div data-sheet-purchase-form>' +
      '<label><span>Item (ContentId)</span><input type="text" data-sheet-purchase-item-id></label>' +
      // A VERSÃO DO PACOTE é campo do próprio formulário (achado do cutover da
      // Task 33). `character-canonical-v2.schema.json#/$defs/contentRef` exige
      // `id` E `packageVersion`; a versão anterior emitia `{id}` sozinho, o
      // personagem resultante ficava INVÁLIDO e o save morria em
      // `CHARACTER_ENCODE_INVALID_INPUT` ("O personagem canônico a codificar é
      // inválido") — o item digitado simplesmente sumia. Reproduzido no
      // navegador antes da correção.
      //
      // A versão é PEDIDA em vez de deduzida porque o `ContentRegistry` não
      // expõe a versão de pacote de uma entidade resolvida, e escolher uma por
      // conta própria seria inventar procedência de conteúdo. É feio, e é a
      // mesma lacuna que `data-sheet-item-catalog-unavailable` já declara.
      '<label><span>Versão do pacote</span><input type="text" data-sheet-purchase-item-version></label>' +
      '<label><span>Quantidade</span><input type="number" data-sheet-purchase-quantity></label>' +
      `<label><span>Já equipado</span><input type="checkbox" data-sheet-purchase-equipped${marcado}></label>` +
      `<p class="sheet-note" data-sheet-item-catalog-unavailable="${escapeHtmlAttribute(ITEM_CATALOG_UNAVAILABLE_REASON)}">` +
      'O catálogo de itens ainda não é projetado pelo modelo canônico; informe o ContentId do item.' +
      '</p>' +
      `<p class="sheet-note" data-sheet-purchase-not-atomic="${escapeHtmlAttribute(PURCHASE_NOT_ATOMIC_REASON)}">` +
      'Este formulário adiciona o item; o pagamento é feito na carteira.' +
      '</p>' +
      '</div>',
    actions:
      '<button type="button" data-action="add-inventory-item" data-origin="purchase">Adicionar</button>' +
      `<button type="button" data-action="${escapeHtmlAttribute(INVENTORY_FLOW_ACTIONS.purchaseClose)}">Cancelar</button>`,
  };
}

/**
 * Descreve o modal de ITEM CUSTOMIZADO.
 *
 * Os campos usam os nomes LEGADOS do `customDefinition` (`nome`/`peso`/
 * `custo`), que são os que `resolveItemDefinition` (Task 19) lê — a seção não
 * renomeia campo de persistência.
 * @returns {{content: string, actions: string}}
 */
function describeCustomModal() {
  return {
    content:
      '<div data-sheet-custom-form>' +
      '<label><span>Nome</span><input type="text" data-sheet-custom-name></label>' +
      '<label><span>Peso</span><input type="text" data-sheet-custom-weight></label>' +
      '<label><span>Custo</span><input type="text" data-sheet-custom-cost></label>' +
      '<label><span>Quantidade</span><input type="number" data-sheet-custom-quantity></label>' +
      '</div>',
    actions:
      '<button type="button" data-action="add-inventory-item" data-origin="custom">Adicionar</button>' +
      `<button type="button" data-action="${escapeHtmlAttribute(INVENTORY_FLOW_ACTIONS.customClose)}">Cancelar</button>`,
  };
}

/**
 * Monta o comando `add-inventory-item` a partir do formulário aberto.
 *
 * Campo vazio vira propriedade AUSENTE: um item sem `itemRef` nem
 * `customDefinition` é recusado pelo domínio com
 * `COMMAND_INVENTORY_ITEM_IDENTITY_MISSING`, e um item customizado sem nome
 * chega ao domínio como está — a vista nunca inventa "Item sem nome".
 * @param {{origin: string, acionado: object, root: object|null, projection: object}} params
 * @returns {Record<string, *>}
 */
function buildAddCommand({ origin, acionado, root, projection }) {
  /** @type {Record<string, *>} */
  const command = { type: 'add-inventory-item', instanceId: projection.nextInstanceId };

  if (origin === 'custom') {
    const nome = readField(acionado, root, SELECTORS.customName);
    const peso = readField(acionado, root, SELECTORS.customWeight);
    const custo = readField(acionado, root, SELECTORS.customCost);
    /** @type {Record<string, string>} */
    const definicao = {};
    if (nome !== '') {
      definicao.nome = nome;
    }
    if (peso !== '') {
      definicao.peso = peso;
    }
    if (custo !== '') {
      definicao.custo = custo;
    }
    command.customDefinition = definicao;
    const quantidade = toInteger(readField(acionado, root, SELECTORS.customQuantity));
    if (quantidade !== null) {
      command.quantity = quantidade;
    }
    return command;
  }

  const itemId = readField(acionado, root, SELECTORS.purchaseItemId);
  const packageVersion = readField(acionado, root, SELECTORS.purchaseItemVersion);
  if (itemId !== '' && packageVersion !== '') {
    command.itemRef = { id: itemId, packageVersion };
  } else if (itemId !== '') {
    // Referência INCOMPLETA nunca é completada por aqui: o comando viaja sem
    // `itemRef` e o domínio recusa com `COMMAND_INVENTORY_ITEM_IDENTITY_MISSING`
    // — erro nomeado no lugar certo, em vez de um personagem inválido que só
    // explode na hora de salvar.
    void itemId;
  }
  const quantidade = toInteger(readField(acionado, root, SELECTORS.purchaseQuantity));
  if (quantidade !== null) {
    command.quantity = quantidade;
  }
  command.equipped = readChecked(acionado, root, SELECTORS.purchaseEquipped);
  return command;
}

/**
 * Monta o comando `change-wallet` a partir do botão acionado.
 * @param {{acionado: object, root: object|null}} params
 * @returns {Record<string, *>}
 */
function buildWalletCommand({ acionado, root }) {
  const operation = acionado.getAttribute('data-wallet-operation');
  /** @type {Record<string, *>} */
  const command = { type: 'change-wallet' };
  if (typeof operation === 'string' && operation !== '') {
    command.operation = operation;
  }
  if (operation === 'pay') {
    const custo = readField(acionado, root, SELECTORS.walletCost);
    if (custo !== '') {
      command.costText = custo;
    }
    return command;
  }
  const denomination = acionado.getAttribute('data-denomination');
  if (typeof denomination === 'string' && denomination !== '') {
    command.denomination = denomination;
    // O campo de quantidade é o da PRÓPRIA denominação — nunca o primeiro da
    // lista, que faria o botão de uma moeda gastar o número digitado em outra.
    const quantidade = toInteger(readField(acionado, root, `[data-sheet-wallet-quantity="${denomination}"]`));
    if (quantidade !== null) {
      command.quantity = quantidade;
    }
  }
  return command;
}

/**
 * Traduz um evento em `UiEventDecision`.
 *
 * Cinco famílias: arrasto (`dragstart`/`dragover`/`drop`/`dragend`), comandos
 * diretos de item, comandos de carteira, abertura/fechamento de modal e
 * confirmação de modal. Nenhuma delas decide se a operação é válida — quem
 * valida é o domínio.
 *
 * Qualquer outro `data-action` vira um comando com aquele `type`, que o
 * dispatcher recusa com `COMMAND_TYPE_UNKNOWN` — nunca um clique inerte.
 *
 * @param {object} event
 * @param {{root: object, projection: object, uiState: object}} context
 * @returns {Readonly<object>} UiEventDecision
 */
export function inventoryLoadCoinsToIntent(event, context = {}) {
  const projection = context.projection ?? {};
  const uiState = context.uiState ?? {};
  const target = event?.target ?? null;
  const linha = typeof target?.closest === 'function' ? target.closest('[data-sheet-item-draggable]') : null;

  // --- Arrasto: a ordem viaja como PERMUTAÇÃO de instanceIds --------------
  if (event?.type === 'dragstart') {
    const instanceId = linha?.getAttribute('data-instance-id') ?? null;
    if (instanceId === null || instanceId === '') {
      return NO_UI_EVENT_DECISION;
    }
    return createUiEventDecision({
      intent: createSheetIntent(SHEET_INTENT_TYPES.uiState, { patch: { draggingInstanceId: instanceId } }),
    });
  }
  // O arrasto EM ANDAMENTO só conta quando o id guardado ainda é um item desta
  // projeção. Um id que sobrou de um gesto anterior (ou de uma ficha já
  // recarregada) não autoriza nada.
  const arrastando = typeof uiState.draggingInstanceId === 'string' ? uiState.draggingInstanceId : null;
  const arrastoAtivo = arrastando !== null && (projection.instanceIds ?? []).includes(arrastando);

  if (event?.type === 'dragover') {
    // Sem `preventDefault` o navegador não aceita o `drop`. A seção DESCREVE o
    // efeito; quem o aplica ao evento é o controller.
    //
    // E ele só é descrito quando existe um arrasto NOSSO em andamento. Aceitar
    // qualquer `dragover` sobre uma linha fazia o navegador aceitar o drop de
    // um payload arbitrário (arquivo, texto selecionado, arrasto começado em
    // outra página) — que, com um `draggingInstanceId` sobrevivente, virava um
    // `reorder-inventory` que ninguém pediu.
    return linha === null || !arrastoAtivo ? NO_UI_EVENT_DECISION : createUiEventDecision({ preventDefault: true });
  }
  if (event?.type === 'dragend') {
    return createUiEventDecision({
      intent: createSheetIntent(SHEET_INTENT_TYPES.uiState, { patch: { draggingInstanceId: null } }),
    });
  }
  if (event?.type === 'drop') {
    // O `drop` ENCERRA o gesto, sempre. Confiar só no `dragend` para limpar
    // deixava o id órfão quando o `dragend` não chegava (nó desmontado por um
    // repaint, arrasto abortado pelo navegador) — e o id órfão é justamente o
    // que transforma um drop estranho num comando real.
    const limpar = { draggingInstanceId: null };
    const targetId = linha?.getAttribute('data-instance-id') ?? null;
    if (!arrastoAtivo) {
      // Nada nosso em andamento: nenhum comando, nenhum efeito no evento. Se
      // ainda havia um id guardado (inválido para esta projeção), ele é apagado
      // agora em vez de esperar por um `dragend` que talvez nunca venha.
      return arrastando === null
        ? NO_UI_EVENT_DECISION
        : createUiEventDecision({ intent: createSheetIntent(SHEET_INTENT_TYPES.uiState, { patch: limpar }) });
    }
    const instanceIds = targetId === null ? null : reorderInstanceIds(projection.instanceIds ?? [], arrastando, targetId);
    if (instanceIds === null) {
      return createUiEventDecision({
        intent: createSheetIntent(SHEET_INTENT_TYPES.uiState, { patch: limpar }),
        preventDefault: true,
      });
    }
    return createUiEventDecision({
      intent: createSheetIntent(SHEET_INTENT_TYPES.command, {
        command: { type: 'reorder-inventory', instanceIds: [...instanceIds] },
        // Aplicado pelo controller ANTES do dispatch: o gesto acaba aqui,
        // aconteça o que acontecer com o comando.
        uiStatePatch: limpar,
      }),
      preventDefault: true,
    });
  }

  if (event?.type !== 'click') {
    return NO_UI_EVENT_DECISION;
  }
  const acionado = typeof target?.closest === 'function' ? target.closest('[data-action]') : null;
  if (acionado === null || acionado === undefined) {
    return NO_UI_EVENT_DECISION;
  }
  const action = acionado.getAttribute('data-action');
  if (typeof action !== 'string' || action.length === 0) {
    return NO_UI_EVENT_DECISION;
  }

  const root = context.root ?? null;

  // --- Fluxo de modal: DESCREVE, nunca muta -------------------------------
  if (action === INVENTORY_FLOW_ACTIONS.purchaseOpen) {
    const descricao = describePurchaseModal({ uiState });
    return createUiEventDecision({
      intent: createSheetIntent(SHEET_INTENT_TYPES.modalOpen, {
        modalId: INVENTORY_PURCHASE_MODAL_ID,
        title: 'Comprar item',
        content: owned(descricao.content),
        actions: owned(descricao.actions),
        uiStatePatch: null,
      }),
      preventDefault: true,
    });
  }
  if (action === INVENTORY_FLOW_ACTIONS.customOpen) {
    const descricao = describeCustomModal();
    return createUiEventDecision({
      intent: createSheetIntent(SHEET_INTENT_TYPES.modalOpen, {
        modalId: INVENTORY_CUSTOM_MODAL_ID,
        title: 'Item customizado',
        content: owned(descricao.content),
        actions: owned(descricao.actions),
        uiStatePatch: null,
      }),
      preventDefault: true,
    });
  }
  if (action === INVENTORY_FLOW_ACTIONS.purchaseClose || action === INVENTORY_FLOW_ACTIONS.customClose) {
    // CANCELAR não emite comando: a intenção não carrega `command`, e o
    // personagem confirmado permanece byte a byte como estava.
    return createUiEventDecision({
      intent: createSheetIntent(SHEET_INTENT_TYPES.modalClose, {
        modalId: action === INVENTORY_FLOW_ACTIONS.purchaseClose ? INVENTORY_PURCHASE_MODAL_ID : INVENTORY_CUSTOM_MODAL_ID,
      }),
      preventDefault: true,
    });
  }

  /** @type {Record<string, *>} */
  let command;
  if (action === 'add-inventory-item') {
    command = buildAddCommand({ origin: acionado.getAttribute('data-origin') ?? 'purchase', acionado, root, projection });
  } else if (action === 'change-wallet') {
    command = buildWalletCommand({ acionado, root });
  } else {
    command = { type: action };
    const instanceId = acionado.getAttribute('data-instance-id');
    if (typeof instanceId === 'string' && instanceId !== '') {
      command.instanceId = instanceId;
    }
    if (action === 'change-item-quantity') {
      const delta = toInteger(acionado.getAttribute('data-delta') ?? '');
      if (delta !== null) {
        command.delta = delta;
      }
    }
    if (action === 'equip-item') {
      command.equipped = acionado.getAttribute('data-equipped') === 'true';
    }
  }

  return createUiEventDecision({
    intent: createSheetIntent(SHEET_INTENT_TYPES.command, { command }),
    preventDefault: true,
  });
}

/**
 * Cria a seção `inventory-load-coins` validada pelo registro.
 * @returns {import('../../../core/result.js').Result} Result<Section, AppError>
 */
export function createInventoryLoadCoinsSection() {
  return createSheetSection({
    id: INVENTORY_LOAD_COINS_SECTION_ID,
    select: selectInventoryLoadCoins,
    render: renderInventoryLoadCoins,
    toIntent: inventoryLoadCoinsToIntent,
    eventTypes: ['click', 'dragstart', 'dragover', 'drop', 'dragend'],
  });
}
