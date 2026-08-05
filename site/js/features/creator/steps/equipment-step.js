// Passo `equipamento` do criador (Task 27).
//
// ## As QUATRO fatias, e por que elas são separadas
//
//   - `startingEquipmentSelection` — o registro do que a OPÇÃO de equipamento
//     inicial materializou (fonte, opção e os `instanceId`s dos itens gerados).
//   - `startingCurrencyGrant`      — as moedas concedidas pela opção inicial.
//   - `manualInventoryChanges`     — o que o JOGADOR acrescentou à mão.
//   - `walletChanges`              — as moedas que o JOGADOR mexeu à mão.
//
// As duas primeiras são do PASSO e a matriz de invalidação as limpa quando a
// classe muda; as duas últimas são do JOGADOR e NENHUM passo pode limpá-las
// (`applyInvalidationPatch` recusa um patch que tente). É essa separação que
// faz "comprar um item customizado, botar moedas na carteira e depois trocar de
// classe inteira" preservar o que era do jogador — o defeito que o criador
// legado tem hoje, onde trocar de classe chama `criarCarteiraVazia()` e zera o
// `inventario` inteiro.
//
// ## A carteira é uma PROJEÇÃO das duas fatias
//
// `state.wallet` nunca é editado por soma cega: ele é sempre redistribuído a
// partir de `startingCurrencyGrant.copper + walletChanges.copper`. Assim,
// quando a concessão inicial é limpa pela troca de classe, o que sobra é
// exatamente o do jogador — não um resto de subtração que poderia ficar
// negativo.
//
// ## Nada é parseado de prosa
//
// A opção inicial e seus itens saem dos `grants` do tipo `grant-item` da opção
// escolhida (campo estruturado do catálogo). O pacote oficial de hoje NÃO
// declara concessão estruturada de MOEDA (o "15 PO" existe só no `label` da
// opção) nem escolha estruturada de INSTRUMENTO MUSICAL ("instrumento musical
// à sua escolha" também é só texto do rótulo). Este passo não os adivinha:
// `startingCurrencyGrant` fica em zero e o step data reporta
// `structuredCurrencyGrants: false`, para que a lacuna seja visível em vez de
// preenchida por um `parseCusto` sobre rótulo — que é como o legado faz e é
// exatamente o parsing de prosa que esta arquitetura proíbe.

import { ok, err } from '../../../core/result.js';
import { escapeHtml, escapeHtmlAttribute } from '../../../ui/html.js';
import { createUiEventDecision, NO_UI_EVENT_DECISION } from '../../../ui/event-delegation.js';
import { collectCharacterEffects, deriveSourceInstanceId, qualifiedChoiceKey } from '../../../domain/effects/collect-effects.js';
import { applyGrantEffects, revokeGrantEffects } from '../../../domain/effects/apply-grants.js';
import {
  addInventoryItem,
  changeItemQuantity,
  equipItem,
  removeInventoryItem,
  reorderInventory,
  changeWallet,
  getInventoryProjection,
  resolveCurrencyRates,
  distributeCopper,
  walletTotalInCopper,
  WALLET_DENOMINATIONS,
} from '../../../domain/inventory/index.js';
import { buildInvalidationPatch, createInvalidationPatch } from '../creator-invalidation.js';
import { withDraftSlices } from '../creator-state.js';
import { createCreatorStep, createStepBinding, stepError } from './creator-step.js';

const STEP_ID = 'equipamento';

/** `choiceId` da opção de equipamento inicial (mesmo id nas 12 classes e nos 16 antecedentes). */
const STARTING_EQUIPMENT_CHOICE_ID = 'equipamento-inicial';

/**
 * As duas ORIGENS de equipamento inicial, com a fatia em que cada uma guarda a
 * própria escolha. A fatia é a MESMA que o passo dono (classe/antecedente)
 * escreve: a escolha tem um lar só, e este passo apenas a edita pela outra
 * porta. Duplicá-la numa fatia própria seria guardar o mesmo fato duas vezes.
 * @type {ReadonlyArray<Readonly<{collection: string, contentType: string, identitySlice: string, choiceSlice: string}>>}
 */
const STARTING_SOURCES = Object.freeze([
  Object.freeze({ collection: 'class', contentType: 'class', identitySlice: 'classSelection', choiceSlice: 'classChoices' }),
  Object.freeze({
    collection: 'background',
    contentType: 'background',
    identitySlice: 'backgroundSelection',
    choiceSlice: 'backgroundEquipmentSelection',
  }),
]);

/** Intenções de domínio deste passo. */
export const EQUIPMENT_INTENT_TYPES = Object.freeze({
  startingOption: 'creator/equipment-start-option',
  addCatalogItem: 'creator/equipment-add-item',
  addCustomItem: 'creator/equipment-add-custom',
  changeQuantity: 'creator/equipment-quantity',
  equip: 'creator/equipment-equip',
  remove: 'creator/equipment-remove',
  move: 'creator/equipment-move',
  wallet: 'creator/equipment-wallet',
});

/** Tipos de conteúdo oferecidos no seletor de item do catálogo. */
const CATALOG_ITEM_TYPES = Object.freeze(['weapon', 'armor', 'equipment']);

/**
 * Tipos de efeito que este passo reconhece como concessão ESTRUTURADA de moeda.
 *
 * Hoje nenhuma opção do pacote oficial declara qualquer um deles (o schema de
 * `choiceOption.grants` só tem `grant-item`), então a varredura devolve zero —
 * mas ela é uma VARREDURA, não uma constante `false`. No dia em que o conteúdo
 * declarar a concessão, o passo passa a enxergá-la sem que ninguém precise
 * lembrar de virar uma flag.
 * @type {ReadonlyArray<string>}
 */
const CURRENCY_GRANT_TYPES = Object.freeze(['grant-currency']);

/**
 * Padrão que reconhece uma PROMESSA de moeda no rótulo da opção ("15 PO").
 *
 * Isto NÃO é parsing de regra: o valor lido aqui nunca vira moeda no bolso de
 * ninguém. Ele serve só para detectar a LACUNA — rótulo prometendo dinheiro sem
 * concessão estruturada correspondente — e avisar o jogador. A alternativa
 * (ignorar) é o que escondia a lacuna.
 */
const CURRENCY_PROMISE_PATTERN = /\b\d{1,3}(?:\.\d{3})*\s*(?:PC|PP|PE|PO|PL)\b/i;

/** Mesma ideia para o instrumento musical prometido em prosa no rótulo. */
const INSTRUMENT_PROMISE_PATTERN = /instrumento\s+musical/i;

/**
 * @param {*} registry
 * @returns {boolean}
 */
function isUsableRegistry(registry) {
  return registry !== null && typeof registry === 'object' && typeof registry.list === 'function' && typeof registry.resolve === 'function';
}

/**
 * Lê um mapa de escolhas QUALIFICADAS de uma fatia do rascunho.
 * @param {object} draft
 * @param {string} slice
 * @returns {object}
 */
function picksInSlice(draft, slice) {
  const value = draft?.slices?.[slice];
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/**
 * Normaliza um valor de escolha para array de ids de opção.
 * @param {*} value
 * @returns {ReadonlyArray<string>}
 */
function asOptionIds(value) {
  if (typeof value === 'string') {
    return value.length > 0 ? [value] : [];
  }
  return Array.isArray(value) ? value.filter((id) => typeof id === 'string' && id.length > 0) : [];
}

/**
 * Fatia `manualInventoryChanges` normalizada.
 * @param {object} draft
 * @returns {Readonly<{instanceIds: ReadonlyArray<string>, sequence: number}>}
 */
export function readManualInventory(draft) {
  const slice = draft?.slices?.manualInventoryChanges;
  const safe = slice !== null && typeof slice === 'object' && !Array.isArray(slice) ? slice : {};
  return Object.freeze({
    instanceIds: Object.freeze(Array.isArray(safe.instanceIds) ? [...safe.instanceIds] : []),
    sequence: Number.isInteger(safe.sequence) ? safe.sequence : 0,
  });
}

/**
 * Fatia `walletChanges` normalizada: as moedas do JOGADOR, em cobre.
 * @param {object} draft
 * @returns {Readonly<{copper: number, operations: number}>}
 */
export function readWalletChanges(draft) {
  const slice = draft?.slices?.walletChanges;
  const safe = slice !== null && typeof slice === 'object' && !Array.isArray(slice) ? slice : {};
  // `copper` é o DELTA LÍQUIDO do jogador sobre a concessão inicial, e por isso
  // pode ser NEGATIVO: gastar as moedas que vieram da opção inicial é uma
  // operação legítima. Clampar em zero aqui faria o gasto ser silenciosamente
  // desfeito na próxima projeção da carteira.
  return Object.freeze({
    copper: Number.isInteger(safe.copper) ? safe.copper : 0,
    operations: Number.isInteger(safe.operations) ? safe.operations : 0,
  });
}

/**
 * Fatia `startingCurrencyGrant` normalizada: as moedas concedidas pela opção
 * inicial, em cobre.
 * @param {object} draft
 * @returns {Readonly<{copper: number}>}
 */
export function readStartingCurrencyGrant(draft) {
  const slice = draft?.slices?.startingCurrencyGrant;
  const safe = slice !== null && typeof slice === 'object' && !Array.isArray(slice) ? slice : {};
  return Object.freeze({ copper: Number.isInteger(safe.copper) && safe.copper >= 0 ? safe.copper : 0 });
}

/**
 * Descreve UMA opção de equipamento inicial, separando o que ela CONCEDE de
 * fato (grants estruturados) do que ela apenas PROMETE no rótulo.
 *
 * As duas lacunas conhecidas do pacote oficial (moeda e instrumento musical) são
 * detectadas por comparação entre as duas coisas — nunca preenchidas a partir da
 * prosa. `currencyGapped`/`instrumentGapped` é o que o `render` usa para AVISAR
 * o jogador de que aquele "75 PO" do rótulo não chega ao bolso dele.
 * @param {object} option - `choiceOption` do catálogo.
 * @returns {Readonly<object>}
 */
export function describeStartingOption(option) {
  const label = typeof option?.label === 'string' ? option.label : option?.id;
  const grants = Array.isArray(option?.grants) ? option.grants : [];
  const itemGrants = grants
    .filter((grant) => grant?.type === 'grant-item' && typeof grant.item === 'string')
    .map((grant) => Object.freeze({ itemId: grant.item, quantity: Number.isInteger(grant.quantity) ? grant.quantity : 1 }));
  // VARREDURA, não constante: hoje devolve zero porque o catálogo não declara
  // nenhum destes tipos, e passará a devolver a concessão real no dia em que
  // declarar.
  const currencyGrants = grants.filter((grant) => CURRENCY_GRANT_TYPES.includes(grant?.type));
  // Uma escolha ANINHADA na opção (o instrumento "à sua escolha") seria um grant
  // do tipo `choice`; nenhuma opção oficial declara uma hoje.
  const nestedChoices = grants.filter((grant) => grant?.type === 'choice' && grant.choice !== null && typeof grant.choice === 'object');
  const promisesCurrency = typeof label === 'string' && CURRENCY_PROMISE_PATTERN.test(label);
  const promisesInstrument = typeof label === 'string' && INSTRUMENT_PROMISE_PATTERN.test(label);
  return Object.freeze({
    id: option?.id,
    label,
    itemGrants: Object.freeze(itemGrants),
    currencyGrants: Object.freeze([...currencyGrants]),
    nestedChoices: Object.freeze(nestedChoices.map((grant) => grant.choice.id)),
    promisesCurrency,
    promisesInstrument,
    currencyGapped: promisesCurrency && currencyGrants.length === 0,
    instrumentGapped: promisesInstrument && nestedChoices.length === 0,
  });
}

/**
 * Descreve as ORIGENS de equipamento inicial presentes no rascunho: a entidade
 * escolhida, o `sourceInstanceId` (o MESMO que o motor de efeitos usa), as
 * opções estruturadas e a opção atualmente confirmada.
 * @param {object} context
 * @returns {ReadonlyArray<object>}
 */
export function collectStartingSources(context) {
  const registry = context.registry;
  const sources = [];
  for (const origem of STARTING_SOURCES) {
    const selection = context.draft?.slices?.[origem.identitySlice];
    const contentId = selection !== null && typeof selection === 'object' ? selection.contentId : null;
    if (typeof contentId !== 'string' || contentId.length === 0) {
      continue;
    }
    const resolved = registry.resolve(contentId, origem.contentType);
    if (resolved.ok !== true) {
      continue;
    }
    const entity = resolved.value;
    const effects = Array.isArray(entity.effects) ? entity.effects : [];
    const choice = effects.find((effect) => effect?.type === 'choice' && effect.choice?.id === STARTING_EQUIPMENT_CHOICE_ID)?.choice ?? null;
    if (choice === null) {
      continue;
    }
    const sourceInstanceId = deriveSourceInstanceId({ collection: origem.collection, index: 0, key: contentId });
    const picked = asOptionIds(picksInSlice(context.draft, origem.choiceSlice)[qualifiedChoiceKey(sourceInstanceId, STARTING_EQUIPMENT_CHOICE_ID)]);
    sources.push(
      Object.freeze({
        collection: origem.collection,
        contentType: origem.contentType,
        choiceSlice: origem.choiceSlice,
        contentId,
        entityName: typeof entity.name === 'string' ? entity.name : contentId,
        sourceInstanceId,
        choiceId: STARTING_EQUIPMENT_CHOICE_ID,
        selectedOptionId: picked.length > 0 ? picked[0] : null,
        options: Object.freeze((Array.isArray(choice.options) ? choice.options : []).map((option) => describeStartingOption(option))),
      }),
    );
  }
  return Object.freeze(sources);
}

/**
 * Registro do que a opção inicial materializou, por fonte. É a fatia
 * `startingEquipmentSelection`: guarda os `instanceId`s dos itens gerados, que
 * é a informação que a escolha (em `classChoices`/`backgroundEquipmentSelection`)
 * não tem.
 * @param {object} character
 * @param {ReadonlyArray<object>} sources
 * @returns {Readonly<object>}
 */
function projectStartingSelection(character, sources) {
  const inventory = Array.isArray(character?.state?.inventory) ? character.state.inventory : [];
  return Object.freeze({
    sources: Object.freeze(
      sources.map((source) =>
        Object.freeze({
          sourceInstanceId: source.sourceInstanceId,
          contentId: source.contentId,
          collection: source.collection,
          choiceId: source.choiceId,
          optionId: source.selectedOptionId,
          itemInstanceIds: Object.freeze(
            inventory.filter((entry) => entry?.sourceInstanceId === source.sourceInstanceId).map((entry) => entry.instanceId),
          ),
        }),
      ),
    ),
  });
}

/**
 * Reaplica, no personagem, as concessões de UMA fonte a partir das escolhas
 * atuais — o mesmo protocolo idempotente do passo de catálogo: desfaz o que
 * aquela fonte materializou e reaplica.
 *
 * Só as concessões daquela fonte são tocadas: `revokeGrantEffects` é indexado
 * por `sourceInstanceId`, então nem os itens do jogador (que têm
 * `sourceInstanceId: null`) nem os de outra fonte entram na conta.
 * @param {{character: object, registry: object, sourceInstanceId: string, choiceId: string, optionId: string|null}} params
 * @returns {import('../../../core/result.js').Result} `ok(character)`
 */
function reapplySourceGrants({ character, registry, sourceInstanceId, choiceId, optionId }) {
  // Só a chave DESTA escolha é trocada. Ao contrário do passo de catálogo — que
  // reescreve todas as escolhas da fonte a partir do que o modal encenou —
  // aqui as demais escolhas da MESMA fonte (as perícias de classe, a subclasse,
  // o estilo de luta) não estão em jogo: apagá-las junto faria trocar a opção de
  // equipamento zerar as perícias da classe.
  const choices = { ...character.build?.choices };
  if (optionId === null) {
    delete choices[qualifiedChoiceKey(sourceInstanceId, choiceId)];
  } else {
    choices[qualifiedChoiceKey(sourceInstanceId, choiceId)] = Object.freeze([optionId]);
  }
  const build = { ...character.build, choices: Object.freeze(choices) };
  const revogado = revokeGrantEffects({ ...character, build }, { sourceInstanceIds: [sourceInstanceId] });
  if (revogado.ok !== true) {
    return revogado;
  }
  const staged = revogado.value.character;
  const collected = collectCharacterEffects(staged, { registry });
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

/**
 * Redistribui `state.wallet` a partir das DUAS fatias de moeda.
 *
 * Nunca subtrai do saldo corrente: o saldo é sempre reconstruído da soma
 * `concessão + jogador`. Subtrair deixaria a carteira dependente da ordem das
 * operações (e negativa quando o jogador tivesse gasto a concessão).
 * @param {{character: object, rates: object, grantCopper: number, manualCopper: number}} params
 * @returns {object} personagem com a carteira redistribuída.
 */
function syncWallet({ character, rates, grantCopper, manualCopper }) {
  // `manualCopper` pode ser negativo (o jogador gastou parte da concessão);
  // `distributeCopper` já trata a soma final em zero como piso.
  const wallet = distributeCopper(grantCopper + manualCopper, rates);
  return Object.freeze({ ...character, state: Object.freeze({ ...character.state, wallet: Object.freeze(wallet) }) });
}

/**
 * Aviso VISÍVEL de lacuna de conteúdo numa opção: o rótulo promete moeda e/ou
 * instrumento, mas não há concessão estruturada correspondente.
 *
 * Sem isto o jogador escolhia "75 PO", não recebia nada e não tinha como saber
 * por quê — a lacuna ficava escondida atrás de um card que parecia normal.
 * @param {object} option - saída de `describeStartingOption`.
 * @returns {string}
 */
function renderOptionGapNote(option) {
  // `codigos` é o eixo de MÁQUINA (o mesmo vocabulário de `contentGaps.missing`,
  // para que teste e telemetria não dependam de texto em português); `rotulos` é
  // o eixo de leitura humana.
  const codigos = [];
  const rotulos = [];
  if (option.currencyGapped) {
    codigos.push('currency');
    rotulos.push('moeda');
  }
  if (option.instrumentGapped) {
    codigos.push('instrument');
    rotulos.push('instrumento musical');
  }
  if (codigos.length === 0) {
    return '';
  }
  return (
    `<div class="info-box warning card-lacuna" data-equip-lacuna="${escapeHtmlAttribute(codigos.join(','))}">` +
    escapeHtml(
      `Esta opção menciona ${rotulos.join(' e ')} no texto, mas o catálogo ainda não declara essa concessão: ` +
        'ela não é adicionada automaticamente. Acrescente à mão no inventário/carteira abaixo.',
    ) +
    '</div>'
  );
}

// --- Renderização ---------------------------------------------------------

/**
 * Markup do bloco de UMA origem de equipamento inicial.
 * @param {object} source
 * @returns {string}
 */
function renderStartingSource(source) {
  const cards = source.options
    .map((option) => {
      const selected = option.id === source.selectedOptionId ? ' selected' : '';
      return (
        `<div class="selection-card${selected}" data-equip-source="${escapeHtmlAttribute(source.sourceInstanceId)}" data-equip-option="${escapeHtmlAttribute(option.id)}">` +
        `<div class="card-nome">${escapeHtml(option.label)}</div>` +
        `<div class="card-detalhe">${option.itemGrants.length} item(ns)</div>` +
        renderOptionGapNote(option) +
        '</div>'
      );
    })
    .join('');
  return (
    `<div class="card mb-2" data-equip-origem="${escapeHtmlAttribute(source.collection)}">` +
    `<div class="card-header"><h3>Equipamento Inicial (${escapeHtml(source.entityName)})</h3></div>` +
    `<div class="selection-grid">${cards}</div>` +
    (source.selectedOptionId === null ? '<div class="info-box warning">Selecione uma opção acima.</div>' : '') +
    '</div>'
  );
}

/**
 * Markup de uma linha do inventário.
 * @param {object} item - item da projeção de inventário.
 * @returns {string}
 */
function renderInventoryRow(item) {
  const id = escapeHtmlAttribute(item.instanceId ?? '');
  return (
    `<div class="inv-item" data-inv-instance="${id}"${item.sourceInstanceId === null ? ' data-inv-manual="true"' : ''}>` +
    `<div class="inv-item-nome">${escapeHtml(item.name)}</div>` +
    `<div class="inv-item-detalhe">${escapeHtml(item.categoryLabel ?? item.categorySlug ?? '')}</div>` +
    '<div class="inv-qty-control">' +
    `<button class="btn btn-sm" type="button" data-inv-qty="${id}" data-inv-delta="-1">-</button>` +
    `<span class="inv-qty">${item.quantity}</span>` +
    `<button class="btn btn-sm" type="button" data-inv-qty="${id}" data-inv-delta="1">+</button>` +
    '</div>' +
    `<label class="form-check"><input type="checkbox" data-inv-equip="${id}"${item.equipped ? ' checked' : ''}> Eq.</label>` +
    `<button class="btn btn-sm" type="button" data-inv-move="${id}" data-inv-direction="up">&uarr;</button>` +
    `<button class="btn btn-sm" type="button" data-inv-move="${id}" data-inv-direction="down">&darr;</button>` +
    `<button class="btn btn-sm btn-danger" type="button" data-inv-remove="${id}">&times;</button>` +
    '</div>'
  );
}

/**
 * Cria o passo `equipamento`.
 * @returns {import('../../../core/result.js').Result} `ok(step)`
 */
export function createEquipmentStep() {
  return createCreatorStep({
    id: STEP_ID,

    /**
     * Carrega as opções ESTRUTURADAS de equipamento inicial (classe e
     * antecedente), o catálogo de itens do seletor manual e as taxas de moeda.
     * Sem `context.registry` a carga FALHA com erro nomeado.
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
      const rates = resolveCurrencyRates({ registry: context.registry }, context.draft?.character ?? null);
      if (rates.ok !== true) {
        return rates;
      }

      const catalogItems = [];
      for (const type of CATALOG_ITEM_TYPES) {
        for (const entity of context.registry.list(type) ?? []) {
          catalogItems.push(Object.freeze({ id: entity.id, name: typeof entity.name === 'string' ? entity.name : entity.id, type }));
        }
      }

      const startingSources = collectStartingSources(context);
      // As duas flags são COMPUTADAS a partir do que o catálogo declara, nunca
      // fixadas em `false`. Se o conteúdo passar a declarar a concessão, elas
      // viram `true` sozinhas — uma constante mentiria em silêncio.
      const todasAsOpcoes = startingSources.flatMap((source) => [...source.options]);
      return ok(
        Object.freeze({
          stepId: STEP_ID,
          startingSources,
          catalogItems: Object.freeze(catalogItems),
          currencyRates: rates.value,
          denominations: WALLET_DENOMINATIONS,
          structuredCurrencyGrants: todasAsOpcoes.some((option) => option.currencyGrants.length > 0),
          structuredInstrumentChoices: todasAsOpcoes.some((option) => option.nestedChoices.length > 0),
          // As lacunas ficam DECLARADAS e localizadas (qual origem, qual opção),
          // além de visíveis no card renderizado.
          contentGaps: Object.freeze(
            startingSources.flatMap((source) =>
              source.options
                .filter((option) => option.currencyGapped || option.instrumentGapped)
                .map((option) =>
                  Object.freeze({
                    sourceInstanceId: source.sourceInstanceId,
                    contentId: source.contentId,
                    optionId: option.id,
                    missing: Object.freeze(
                      [option.currencyGapped ? 'currency' : null, option.instrumentGapped ? 'instrument' : null].filter(
                        (entry) => entry !== null,
                      ),
                    ),
                  }),
                ),
            ),
          ),
        }),
      );
    },

    /**
     * Markup do passo. Todo valor de catálogo é escapado.
     * @param {object} context
     * @returns {string}
     */
    render(context) {
      const data = context.data;
      if (data === null || data === undefined) {
        return '<h3>Equipamento</h3>';
      }
      // As fontes são recalculadas do rascunho corrente (a seleção pode ter
      // mudado depois da carga), mas as OPÇÕES continuam vindo do step data.
      const sources = isUsableRegistry(context.registry) ? collectStartingSources(context) : data.startingSources;
      const projection = getInventoryProjection(context.draft?.character ?? null, {
        registry: context.registry,
        currencyRates: data.currencyRates,
      });
      const items = projection.ok === true ? projection.value.items : [];
      const wallet = context.draft?.character?.state?.wallet ?? {};

      const opcoesCatalogo = data.catalogItems
        .map((item) => `<option value="${escapeHtmlAttribute(item.id)}">${escapeHtml(item.name)}</option>`)
        .join('');

      return (
        '<h3>Equipamento</h3>' +
        sources.map((source) => renderStartingSource(source)).join('') +
        '<div class="card mb-2"><div class="card-header"><h3>Inventário</h3></div>' +
        `<div class="inv-peso" data-inv-peso="${projection.ok === true ? projection.value.totalWeightKg : 0}" data-inv-capacidade="${projection.ok === true ? projection.value.carryingCapacityKg : 0}" data-inv-sobrecarga="${projection.ok === true && projection.value.overloaded ? 'true' : 'false'}">` +
        `Peso: ${projection.ok === true ? projection.value.totalWeightKg : 0} / ${projection.ok === true ? projection.value.carryingCapacityKg : 0} kg</div>` +
        `<div id="lista-inventario">${items.map((item) => renderInventoryRow(item)).join('')}</div>` +
        '<div class="form-group mt-2">' +
        `<select class="form-select" data-inv-catalog-select="true"><option value="">-- Item do catálogo --</option>${opcoesCatalogo}</select>` +
        '<button class="btn btn-sm btn-accent" type="button" data-inv-add-catalog="true">+ Item</button>' +
        '</div>' +
        '<div class="form-group mt-2" data-inv-custom-form="true">' +
        '<input class="form-input" type="text" data-inv-custom-name placeholder="Nome do item customizado">' +
        '<input class="form-input" type="number" min="1" value="1" data-inv-custom-quantity>' +
        '<input class="form-input" type="text" data-inv-custom-weight placeholder="Peso (ex.: 1,5 kg)">' +
        '<input class="form-input" type="text" data-inv-custom-cost placeholder="Custo (ex.: 25 PO)">' +
        '<button class="btn btn-sm btn-secondary" type="button" data-inv-add-custom="true">+ Custom</button>' +
        '</div>' +
        '</div>' +
        '<div class="card mb-2"><div class="card-header"><h3>Carteira</h3></div>' +
        '<div class="carteira-grid">' +
        WALLET_DENOMINATIONS.map(
          (denomination) =>
            `<div class="form-group"><label class="form-label">${escapeHtml(denomination.toUpperCase())}</label>` +
            `<span class="moeda-valor" data-moeda="${escapeHtmlAttribute(denomination)}">${Number.isInteger(wallet[denomination]) ? wallet[denomination] : 0}</span>` +
            `<button class="btn btn-sm" type="button" data-moeda-op="add" data-moeda-denominacao="${escapeHtmlAttribute(denomination)}">+</button>` +
            `<button class="btn btn-sm" type="button" data-moeda-op="remove" data-moeda-denominacao="${escapeHtmlAttribute(denomination)}">-</button>` +
            '</div>',
        ).join('') +
        '</div></div>'
      );
    },

    /**
     * Descritor DECLARATIVO. Nenhum `addEventListener`: o controller é quem
     * escuta, e este `bind` só traduz evento em intenção.
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
            const equip = target.closest('[data-inv-equip]');
            if (equip !== null) {
              return createUiEventDecision({
                intent: {
                  type: EQUIPMENT_INTENT_TYPES.equip,
                  instanceId: equip.getAttribute('data-inv-equip'),
                  equipped: target.checked === true,
                },
                preventDefault: false,
              });
            }
            return NO_UI_EVENT_DECISION;
          }

          const opcao = target.closest('[data-equip-option]');
          if (opcao !== null) {
            return createUiEventDecision({
              intent: {
                type: EQUIPMENT_INTENT_TYPES.startingOption,
                sourceInstanceId: opcao.getAttribute('data-equip-source'),
                optionId: opcao.getAttribute('data-equip-option'),
              },
              preventDefault: true,
            });
          }

          const qty = target.closest('[data-inv-qty]');
          if (qty !== null) {
            const delta = Number.parseInt(qty.getAttribute('data-inv-delta') ?? '0', 10);
            return createUiEventDecision({
              intent: { type: EQUIPMENT_INTENT_TYPES.changeQuantity, instanceId: qty.getAttribute('data-inv-qty'), delta },
              preventDefault: true,
            });
          }

          const move = target.closest('[data-inv-move]');
          if (move !== null) {
            return createUiEventDecision({
              intent: {
                type: EQUIPMENT_INTENT_TYPES.move,
                instanceId: move.getAttribute('data-inv-move'),
                direction: move.getAttribute('data-inv-direction'),
              },
              preventDefault: true,
            });
          }

          const remove = target.closest('[data-inv-remove]');
          if (remove !== null) {
            return createUiEventDecision({
              intent: { type: EQUIPMENT_INTENT_TYPES.remove, instanceId: remove.getAttribute('data-inv-remove') },
              preventDefault: true,
            });
          }

          const root = context.root ?? null;
          if (target.closest('[data-inv-add-catalog]') !== null) {
            // O estado do controle NATIVO é lido aqui e vira payload: o passo
            // continua sem tocar no DOM para escrever nada.
            const select = root?.querySelector?.('[data-inv-catalog-select]') ?? null;
            const contentId = typeof select?.value === 'string' ? select.value : '';
            if (contentId.length === 0) {
              return NO_UI_EVENT_DECISION;
            }
            return createUiEventDecision({
              intent: { type: EQUIPMENT_INTENT_TYPES.addCatalogItem, contentId, quantity: 1 },
              preventDefault: true,
            });
          }

          if (target.closest('[data-inv-add-custom]') !== null) {
            const form = root?.querySelector?.('[data-inv-custom-form]') ?? null;
            const name = form?.querySelector?.('[data-inv-custom-name]')?.value ?? '';
            if (typeof name !== 'string' || name.trim().length === 0) {
              return NO_UI_EVENT_DECISION;
            }
            const quantidade = Number.parseInt(form?.querySelector?.('[data-inv-custom-quantity]')?.value ?? '1', 10);
            return createUiEventDecision({
              intent: {
                type: EQUIPMENT_INTENT_TYPES.addCustomItem,
                name: name.trim(),
                quantity: Number.isInteger(quantidade) && quantidade > 0 ? quantidade : 1,
                weightText: form?.querySelector?.('[data-inv-custom-weight]')?.value ?? '',
                costText: form?.querySelector?.('[data-inv-custom-cost]')?.value ?? '',
              },
              preventDefault: true,
            });
          }

          const moeda = target.closest('[data-moeda-op]');
          if (moeda !== null) {
            return createUiEventDecision({
              intent: {
                type: EQUIPMENT_INTENT_TYPES.wallet,
                operation: moeda.getAttribute('data-moeda-op'),
                denomination: moeda.getAttribute('data-moeda-denominacao'),
                quantity: 1,
              },
              preventDefault: true,
            });
          }
          return NO_UI_EVENT_DECISION;
        },
      });
    },

    /**
     * Válido quando TODA origem que declara `equipamento-inicial` tem opção
     * escolhida — a mesma exigência do wizard legado ("Selecione o equipamento
     * inicial da classe"), agora por campo estruturado.
     * @param {object} context
     * @returns {object} ValidationResult
     */
    validate(context) {
      if (!isUsableRegistry(context.registry)) {
        return { valid: false, errors: [{ code: 'CREATOR_STEP_REGISTRY_MISSING', stepId: STEP_ID }] };
      }
      const errors = collectStartingSources(context)
        .filter((source) => source.selectedOptionId === null)
        .map((source) => ({ code: 'CREATOR_EQUIPMENT_OPTION_REQUIRED', stepId: STEP_ID, sourceInstanceId: source.sourceInstanceId }));
      return { valid: errors.length === 0, errors };
    },

    /**
     * Delega para a matriz OFICIAL: só a seleção inicial e a concessão de
     * moedas são limpas; as fatias do jogador ficam.
     * @param {object} context
     * @returns {import('../../../core/result.js').Result}
     */
    invalidate(context) {
      return buildInvalidationPatch(STEP_ID, { draft: context.draft });
    },

    /**
     * Aplica a intenção de domínio.
     * @param {object} context
     * @param {object} intent
     * @returns {import('../../../core/result.js').Result}
     */
    reduce(context, intent) {
      if (!Object.values(EQUIPMENT_INTENT_TYPES).includes(intent?.type)) {
        // Intenção de outro dono (inclusive o pós-commit sintético): nada a
        // fazer, e nada a inventar.
        return ok(Object.freeze({ draft: context.draft }));
      }
      if (!isUsableRegistry(context.registry)) {
        return err(stepError('CREATOR_STEP_REGISTRY_MISSING', `O passo "${STEP_ID}" exige "context.registry".`, { stepId: STEP_ID }));
      }
      const character = context.draft?.character ?? null;
      if (character === null || typeof character !== 'object') {
        return err(stepError('CREATOR_EQUIPMENT_CHARACTER_MISSING', 'O rascunho ainda não tem personagem canônico para receber equipamento.', { stepId: STEP_ID }));
      }
      const rates = resolveCurrencyRates({ registry: context.registry }, character);
      if (rates.ok !== true) {
        return rates;
      }

      const manual = readManualInventory(context.draft);
      const walletChanges = readWalletChanges(context.draft);
      const grant = readStartingCurrencyGrant(context.draft);

      const applied = applyEquipmentIntent({ context, intent, character, rates: rates.value, manual, walletChanges, grant });
      if (applied.ok !== true) {
        return applied;
      }
      const { character: updatedCharacter, manualNext, walletNext, choiceSlices } = applied.value;

      // A carteira é sempre REDISTRIBUÍDA a partir das duas fatias.
      const synced = syncWallet({
        character: updatedCharacter,
        rates: rates.value,
        grantCopper: grant.copper,
        manualCopper: walletNext.copper,
      });

      const sources = collectStartingSources({ ...context, draft: { ...context.draft, slices: { ...context.draft.slices, ...choiceSlices } } });
      const slices = {
        ...choiceSlices,
        startingEquipmentSelection: projectStartingSelection(synced, sources),
        startingCurrencyGrant: Object.freeze({ copper: grant.copper }),
        manualInventoryChanges: Object.freeze({ instanceIds: Object.freeze([...manualNext.instanceIds]), sequence: manualNext.sequence }),
        walletChanges: Object.freeze({ copper: walletNext.copper, operations: walletNext.operations }),
      };
      // PROVENIÊNCIA VAZIA, de propósito.
      //
      // Os itens da opção inicial são concessão da CLASSE/ANTECEDENTE, e a
      // proveniência deles já está registrada nas fatias de escolha desses
      // passos (`classChoices`/`backgroundEquipmentSelection`) — é por lá que a
      // linha `classe` da matriz revoga tudo quando a classe muda.
      //
      // Repetir o `sourceInstanceId` da classe aqui teria um efeito destrutivo:
      // a linha `equipamento` da matriz limpa `startingEquipmentSelection`, e
      // `invalidate` (chamado ao VOLTAR do passo de equipamento para atributos)
      // passaria a revogar a fonte da classe inteira — o jogador perderia as
      // perícias de classe só por navegar para trás. Esta fatia é um REGISTRO do
      // que foi materializado, não a origem da concessão.
      const provenance = { startingEquipmentSelection: [], startingCurrencyGrant: [] };
      const updated = withDraftSlices(context.draft, { character: synced, slices, provenance });
      if (updated.ok !== true) {
        return updated;
      }

      const patch = buildInvalidationPatch(STEP_ID, { draft: context.draft });
      if (patch.ok !== true) {
        return patch;
      }
      // As fatias escritas por este passo são DECLARADAS — inclusive quando o
      // valor sai idêntico (reconfirmar a MESMA opção). Sem isso, a matriz
      // limparia `startingEquipmentSelection`/`startingCurrencyGrant` que o
      // passo acabou de reafirmar, e a proveniência da própria fonte (que
      // continua viva nessas fatias) seria revogada junto com as perícias da
      // classe. As fatias do JOGADOR entram sempre, por contrato.
      const escritas = [
        ...Object.keys(slices),
        'manualInventoryChanges',
        'walletChanges',
      ];
      const invalidation = createInvalidationPatch({
        clearedStepIds: patch.value.clearedStepIds,
        revokedProvenanceIds: patch.value.revokedProvenanceIds,
        preservedSlices: [...new Set([...patch.value.preservedSlices, ...escritas])],
      });
      return ok(Object.freeze({ draft: updated.value, invalidation }));
    },
  });
}

/**
 * Executa a intenção sobre o personagem, devolvendo o novo personagem e as
 * fatias de apoio atualizadas. Separada do `reduce` para que este fique só com
 * a composição de fatias e invalidação.
 * @param {{context: object, intent: object, character: object, rates: object, manual: object, walletChanges: object, grant: object}} params
 * @returns {import('../../../core/result.js').Result}
 */
function applyEquipmentIntent({ context, intent, character, rates, manual, walletChanges, grant }) {
  /**
   * Envelopa o resultado padrão (nada mudou além do personagem).
   * @param {object} next
   * @returns {import('../../../core/result.js').Result}
   */
  const semMudancaAuxiliar = (next) =>
    ok(Object.freeze({ character: next, manualNext: manual, walletNext: walletChanges, choiceSlices: {} }));

  /**
   * Traduz um `CommandResult` de `domain/inventory` em `Result`.
   * @param {object} commandResult
   * @returns {import('../../../core/result.js').Result}
   */
  const fromCommand = (commandResult) =>
    commandResult.ok === true ? ok(commandResult.character) : err(commandResult.error);

  /**
   * Encapsula um `Result<character>` no envelope padrão desta função.
   * @param {object} result
   * @returns {import('../../../core/result.js').Result}
   */
  const semMudancaAuxiliarOrErr = (result) => (result.ok === true ? semMudancaAuxiliar(result.value) : result);

  switch (intent.type) {
    case EQUIPMENT_INTENT_TYPES.startingOption: {
      const source = collectStartingSources(context).find((entry) => entry.sourceInstanceId === intent.sourceInstanceId) ?? null;
      if (source === null) {
        return err(
          stepError('CREATOR_EQUIPMENT_SOURCE_UNKNOWN', `Nenhuma origem de equipamento inicial com id "${String(intent.sourceInstanceId)}".`, {
            stepId: STEP_ID,
            sourceInstanceId: typeof intent.sourceInstanceId === 'string' ? intent.sourceInstanceId : null,
          }),
        );
      }
      if (!source.options.some((option) => option.id === intent.optionId)) {
        return err(
          stepError('CREATOR_EQUIPMENT_OPTION_UNKNOWN', `A opção "${String(intent.optionId)}" não existe em "${source.contentId}".`, {
            stepId: STEP_ID,
            contentId: source.contentId,
            optionId: typeof intent.optionId === 'string' ? intent.optionId : null,
          }),
        );
      }
      const reapplied = reapplySourceGrants({
        character,
        registry: context.registry,
        sourceInstanceId: source.sourceInstanceId,
        choiceId: source.choiceId,
        optionId: intent.optionId,
      });
      if (reapplied.ok !== true) {
        return reapplied;
      }
      // A ESCOLHA continua morando na fatia do passo dono; o que muda aqui é o
      // valor dela, não o lugar.
      const chave = qualifiedChoiceKey(source.sourceInstanceId, source.choiceId);
      const atual = picksInSlice(context.draft, source.choiceSlice);
      return ok(
        Object.freeze({
          character: reapplied.value,
          manualNext: manual,
          walletNext: walletChanges,
          choiceSlices: { [source.choiceSlice]: Object.freeze({ ...atual, [chave]: Object.freeze([intent.optionId]) }) },
        }),
      );
    }

    case EQUIPMENT_INTENT_TYPES.addCatalogItem: {
      const resolved = context.registry.resolve(intent.contentId);
      if (resolved.ok !== true) {
        return resolved;
      }
      const sequence = manual.sequence + 1;
      const instanceId = `manual-${sequence}`;
      const added = addInventoryItem(character, {
        instanceId,
        itemRef: { id: intent.contentId },
        quantity: Number.isInteger(intent.quantity) && intent.quantity > 0 ? intent.quantity : 1,
        // `sourceInstanceId: null` é o que marca o item como DO JOGADOR: é por
        // ele que `revokeGrantEffects` nunca o alcança.
        sourceInstanceId: null,
      });
      if (added.ok !== true) {
        return err(added.error);
      }
      return ok(
        Object.freeze({
          character: added.character,
          manualNext: { instanceIds: [...manual.instanceIds, instanceId], sequence },
          walletNext: walletChanges,
          choiceSlices: {},
        }),
      );
    }

    case EQUIPMENT_INTENT_TYPES.addCustomItem: {
      if (typeof intent.name !== 'string' || intent.name.trim().length === 0) {
        return err(stepError('CREATOR_EQUIPMENT_CUSTOM_NAME_REQUIRED', 'Um item customizado precisa de nome.', { stepId: STEP_ID }));
      }
      const sequence = manual.sequence + 1;
      const instanceId = `manual-${sequence}`;
      const added = addInventoryItem(character, {
        instanceId,
        customDefinition: {
          nome: intent.name.trim(),
          tipo: 'customizado',
          dados: {
            peso: typeof intent.weightText === 'string' ? intent.weightText : '',
            custo: typeof intent.costText === 'string' ? intent.costText : '',
          },
        },
        quantity: Number.isInteger(intent.quantity) && intent.quantity > 0 ? intent.quantity : 1,
        sourceInstanceId: null,
      });
      if (added.ok !== true) {
        return err(added.error);
      }
      return ok(
        Object.freeze({
          character: added.character,
          manualNext: { instanceIds: [...manual.instanceIds, instanceId], sequence },
          walletNext: walletChanges,
          choiceSlices: {},
        }),
      );
    }

    case EQUIPMENT_INTENT_TYPES.changeQuantity:
      return semMudancaAuxiliarOrErr(fromCommand(changeItemQuantity(character, { instanceId: intent.instanceId, delta: intent.delta })));

    case EQUIPMENT_INTENT_TYPES.equip:
      return semMudancaAuxiliarOrErr(fromCommand(equipItem(character, { instanceId: intent.instanceId, equipped: intent.equipped === true })));

    case EQUIPMENT_INTENT_TYPES.remove: {
      const removed = fromCommand(removeInventoryItem(character, { instanceId: intent.instanceId }));
      if (removed.ok !== true) {
        return removed;
      }
      return ok(
        Object.freeze({
          character: removed.value,
          manualNext: { instanceIds: manual.instanceIds.filter((id) => id !== intent.instanceId), sequence: manual.sequence },
          walletNext: walletChanges,
          choiceSlices: {},
        }),
      );
    }

    case EQUIPMENT_INTENT_TYPES.move: {
      const inventory = Array.isArray(character.state?.inventory) ? character.state.inventory : [];
      const ids = inventory.map((entry) => entry.instanceId);
      const index = ids.indexOf(intent.instanceId);
      const alvo = intent.direction === 'up' ? index - 1 : index + 1;
      if (index === -1 || alvo < 0 || alvo >= ids.length) {
        return err(
          stepError('CREATOR_EQUIPMENT_MOVE_OUT_OF_RANGE', 'O item não pode ser movido para fora do inventário.', {
            stepId: STEP_ID,
            instanceId: typeof intent.instanceId === 'string' ? intent.instanceId : null,
          }),
        );
      }
      // Permutação EXATA (contrato de `reorderInventory`): só duas posições
      // trocam, nenhum id é criado, perdido ou duplicado.
      const ordem = [...ids];
      ordem[index] = ids[alvo];
      ordem[alvo] = ids[index];
      return semMudancaAuxiliarOrErr(fromCommand(reorderInventory(character, { instanceIds: ordem })));
    }

    case EQUIPMENT_INTENT_TYPES.wallet: {
      // O espelho carrega o saldo INTEIRO que o jogador vê na tela — concessão
      // inicial MAIS o delta manual — e não só o delta.
      //
      // Hoje as duas contas dão no mesmo (a concessão é sempre zero, ver a
      // lacuna de conteúdo no cabeçalho), mas espelhar só o delta quebra no
      // instante em que a concessão existir: a tela mostraria as moedas da
      // opção inicial, o jogador tentaria gastá-las e `changeWallet` responderia
      // `WALLET_INSUFFICIENT_FUNDS` sobre um dinheiro visível. Somar a concessão
      // aqui torna a validação de fundos igual ao que está na tela.
      //
      // O que é GRAVADO continua sendo o delta do jogador
      // (`total - concessão`) — inclusive negativo, quando ele gasta parte da
      // concessão. É isso que faz a moeda manual sobreviver intacta à limpeza da
      // concessão inicial numa troca de classe.
      const espelho = Object.freeze({
        ...character,
        state: Object.freeze({ ...character.state, wallet: distributeCopper(grant.copper + walletChanges.copper, rates) }),
      });
      const changed = changeWallet(espelho, intent, { currencyRates: rates });
      if (changed.ok !== true) {
        return err(changed.error);
      }
      const total = walletTotalInCopper(changed.character.state.wallet, rates);
      if (total.ok !== true) {
        return total;
      }
      return ok(
        Object.freeze({
          character,
          manualNext: manual,
          walletNext: { copper: total.value - grant.copper, operations: walletChanges.operations + 1 },
          choiceSlices: {},
        }),
      );
    }

    default:
      return err(stepError('CREATOR_EQUIPMENT_INTENT_UNHANDLED', `O passo "${STEP_ID}" não trata "${String(intent.type)}".`, { stepId: STEP_ID }));
  }
}
