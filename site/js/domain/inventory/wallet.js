// Módulo `domain/inventory/wallet`: carteira multi-moeda pura (Task 19).
// Extraído de `site/js/moedas.js` (commit e43c5ea), que continua existindo
// como shim de transição e agora DELEGA para cá.
//
// ## Tabela de taxas: nunca hardcoded aqui
//
// A regra explícita do brief da Task 19 é que `wallet.js` NUNCA carrega uma
// constante JavaScript com a tabela padrão de conversão. A tabela vem de:
//
//   1. `context.currencyRates` (`CurrencyRates | null`), quando não-nulo — é a
//      preferência do usuário (`dnd_taxas_moeda`), lida por
//      `infra/preferences/local-storage-preferences-repository.js#getCurrencyRates`
//      e injetada no `context` pela camada de `features`/`infra`. `domain/**`
//      nunca lê `localStorage` (Task 4).
//   2. quando `context.currencyRates` é `null`/ausente: a tabela do RULESET
//      OFICIAL (`dnd2024:ruleset:core`, `tables.currency`), obtida via
//      `context.ruleset` (entidade já resolvida) ou via
//      `context.registry` + `character.build.rulesetRef`.
//
// Sem nenhuma das duas fontes, toda operação que precise converter falha com
// erro explícito (`WALLET_CURRENCY_RATES_UNAVAILABLE`) — nunca com uma tabela
// "plausível" inventada em código (Global Constraint: regra de defaults).
//
// ## Denominação `pe` (eletro)
//
// A carteira canônica (`state.wallet`, character-canonical-v2.schema.json)
// tem CINCO denominações (`pc/pp/pe/po/pl`). A tabela do ruleset declarava só
// quatro (`cp/sp/gp/pp`) porque a Task 7 tirou `ep` do enum FECHADO de moeda
// de CUSTO DE ITEM (`common.schema.json#/$defs/cost`, onde eletro de fato não
// é usado por nenhum item) e, junto, da tabela do ruleset. A tabela de
// conversão da CARTEIRA é outra coisa: o baseline `e43c5ea` converte eletro a
// 50 cobre (`site/js/moedas.js`, "2 PE = 1 PO"). A entrada
// `{"code":"ep","name":"Peça de electrum","copperValue":50}` foi restaurada em
// `dados/pacotes/dnd2024/rulesets/core.json#/tables/currency` (Task 19, fix da
// revisão) — o enum de custo de item continua sem eletro, de propósito.
//
// Mesmo assim, este módulo NÃO assume que toda denominação tem taxa: um
// ruleset de terceiros pode declarar menos moedas do que a carteira legada
// tem. Quando falta taxa, nada é inventado:
//   - `walletTotalInCopper` FALHA com `WALLET_CURRENCY_RATE_MISSING` se
//     houver saldo na denominação sem taxa (nunca ignora em silêncio moedas
//     do jogador);
//   - `distributeCopper` só distribui nas denominações com taxa conhecida.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { commandOk, commandErr, commandError } from '../commands/command-result.js';

export const WALLET_SCOPE = 'domain.inventory.wallet';

// Path de `affected` para toda mutação de carteira. `state.wallet` não é um
// alvo derivado do motor de efeitos (Task 15) — é o campo real do schema
// canônico, e o contrato de `command-result.js` manda usar o path pontilhado
// nesse caso.
export const AFFECTED_WALLET = 'state.wallet';

// Ordem legada das denominações da carteira, do MAIOR para o MENOR valor
// (mesma de `site/js/moedas.js#DENOMINACOES`). É só a ordem de desempate
// determinística/serialização — a ordem REAL de distribuição é recalculada a
// partir das taxas resolvidas, para que uma taxa customizada que inverta a
// hierarquia continue produzindo distribuição gulosa correta.
export const WALLET_DENOMINATIONS = Object.freeze(['pl', 'po', 'pe', 'pp', 'pc']);

// A denominação-base: vale sempre 1 (é a unidade de conversão). Igual ao
// `pc: 1` não-editável de `site/js/moedas.js#definirTaxas`.
export const BASE_DENOMINATION = 'pc';

// Mapeamento ESTRUTURAL (nomenclatura, não valor de jogo) entre o `code` da
// tabela de moedas do ruleset e a chave da carteira canônica. Mesmo mapa já
// usado em sentido inverso por `scripts/content/migrate-spells-equipment.mjs`
// (`MOEDA_MAP`) e por `tests/contract/dnd2024-spells-equipment.test.js`.
// Atenção à colisão de siglas: `pp` do ruleset é "platinum piece" (=> `pl` em
// português), enquanto `pp` da carteira é "peça de prata" (=> `sp`).
export const RULESET_CURRENCY_CODE_TO_DENOMINATION = Object.freeze({
  cp: 'pc',
  sp: 'pp',
  ep: 'pe',
  gp: 'po',
  pp: 'pl',
});

// Vocabulário fechado de operações de `changeWallet`.
export const WALLET_OPERATIONS = Object.freeze(['add', 'remove', 'pay', 'convert-up', 'set']);

const DENOMINATION_SET = new Set(WALLET_DENOMINATIONS);

/**
 * Cria um AppError do escopo da carteira.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {Readonly<object>}
 */
export function walletError(code, message, context = {}) {
  return createAppError({ code, scope: WALLET_SCOPE, message, context });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Cria uma carteira zerada com as cinco denominações (equivalente a
 * `site/js/moedas.js#criarCarteiraVazia`).
 * @returns {{pc: number, pp: number, pe: number, po: number, pl: number}}
 */
export function createEmptyWallet() {
  return { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 };
}

/**
 * Normaliza uma carteira para as cinco chaves como inteiros >= 0, zerando o
 * que faltar ou for inválido. Réplica EXATA de
 * `site/js/moedas.js#normalizarCarteira` (inclusive o descarte de valores
 * negativos e o `Math.floor` de fracionários).
 * @param {*} wallet
 * @returns {{pc: number, pp: number, pe: number, po: number, pl: number}}
 */
export function normalizeWallet(wallet) {
  const source = isPlainObject(wallet) ? wallet : {};
  const out = createEmptyWallet();
  for (const denomination of WALLET_DENOMINATIONS) {
    const value = Number(source[denomination]);
    out[denomination] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  return out;
}

/**
 * Lê a tabela de moedas de uma entidade de ruleset já resolvida
 * (`tables.currency`) e a traduz para taxas por denominação de carteira.
 * Códigos desconhecidos são ignorados (o ruleset pode declarar moedas que a
 * carteira legada não tem); denominações sem entrada ficam SEM taxa — nunca
 * recebem um valor inventado.
 * @param {*} ruleset - entidade `type: "ruleset"` do catálogo.
 * @returns {import('../../core/result.js').Result} Result<Record<string, number>, AppError>
 */
export function readRulesetCurrencyRates(ruleset) {
  const table = ruleset?.tables?.currency;
  if (!Array.isArray(table) || table.length === 0) {
    return err(
      walletError(
        'WALLET_RULESET_CURRENCY_TABLE_MISSING',
        'O ruleset informado não declara "tables.currency"; sem tabela de moedas não há taxa padrão.',
        { rulesetId: typeof ruleset?.id === 'string' ? ruleset.id : null },
      ),
    );
  }

  const rates = {};
  for (const entry of table) {
    const denomination = RULESET_CURRENCY_CODE_TO_DENOMINATION[entry?.code];
    if (denomination === undefined) {
      continue;
    }
    if (!Number.isInteger(entry?.copperValue) || entry.copperValue <= 0) {
      return err(
        walletError(
          'WALLET_RULESET_CURRENCY_VALUE_INVALID',
          `A moeda "${entry?.code}" do ruleset tem "copperValue" inválido (precisa ser inteiro > 0).`,
          { code: entry?.code, copperValue: entry?.copperValue },
        ),
      );
    }
    rates[denomination] = entry.copperValue;
  }

  if (rates[BASE_DENOMINATION] !== 1) {
    return err(
      walletError(
        'WALLET_RULESET_BASE_CURRENCY_INVALID',
        'A tabela de moedas do ruleset precisa declarar a moeda-base (cp) valendo 1.',
        { rates },
      ),
    );
  }
  return ok(Object.freeze(rates));
}

/**
 * Valida uma tabela de taxas explícita (`context.currencyRates`, oriunda da
 * preferência `dnd_taxas_moeda`). Aplica as MESMAS regras de
 * `site/js/moedas.js#definirTaxas`: a moeda-base vale 1; cada denominação
 * presente é inteiro > 0; a cadeia (do menor para o maior) é estritamente
 * crescente e cada valor é múltiplo inteiro do anterior — o que garante
 * conversões exatas. Uma preferência que o baseline recusaria também é
 * recusada aqui, com erro explícito (nunca cai em silêncio para a tabela do
 * ruleset — isso seria o "bypass silencioso de dependência opcional").
 * @param {*} currencyRates
 * @returns {import('../../core/result.js').Result} Result<Record<string, number>, AppError>
 */
export function validateCurrencyRates(currencyRates) {
  if (!isPlainObject(currencyRates)) {
    return err(
      walletError('WALLET_CURRENCY_RATES_INVALID', '"currencyRates" deve ser um objeto de taxas por denominação.', {
        received: currencyRates === null ? 'null' : typeof currencyRates,
      }),
    );
  }

  const rates = {};
  // Ordem ASCENDENTE de valor (pc -> pl), a mesma de
  // `site/js/moedas.js#definirTaxas` no baseline, para que a PRIMEIRA taxa
  // inválida reportada seja exatamente a mesma que o baseline reportava.
  for (const denomination of [...WALLET_DENOMINATIONS].reverse()) {
    if (!Object.hasOwn(currencyRates, denomination)) {
      continue;
    }
    const value = currencyRates[denomination];
    if (!Number.isInteger(value) || value <= 0) {
      return err(
        walletError(
          'WALLET_CURRENCY_RATE_INVALID',
          `A taxa de "${denomination}" precisa ser um inteiro positivo.`,
          { denomination, value },
        ),
      );
    }
    rates[denomination] = value;
  }

  if (rates[BASE_DENOMINATION] !== 1) {
    return err(
      walletError(
        'WALLET_CURRENCY_BASE_RATE_INVALID',
        `A denominação-base "${BASE_DENOMINATION}" precisa estar presente e valer 1.`,
        { rates },
      ),
    );
  }

  // Cadeia crescente por múltiplos exatos, na ordem legada ascendente.
  const ascending = [...WALLET_DENOMINATIONS].reverse().filter((denomination) => Object.hasOwn(rates, denomination));
  for (let index = 1; index < ascending.length; index += 1) {
    const previous = rates[ascending[index - 1]];
    const current = rates[ascending[index]];
    if (current <= previous || current % previous !== 0) {
      return err(
        walletError(
          'WALLET_CURRENCY_RATE_CHAIN_INVALID',
          `A taxa de "${ascending[index]}" precisa ser múltiplo inteiro maior que a de "${ascending[index - 1]}".`,
          { denomination: ascending[index], previousDenomination: ascending[index - 1], rates },
        ),
      );
    }
  }

  return ok(Object.freeze(rates));
}

/**
 * Resolve a tabela de taxas efetiva para uma operação, na precedência
 * documentada no topo do módulo: `context.currencyRates` > ruleset
 * (`context.ruleset` ou `context.registry` + `character.build.rulesetRef`).
 * Nunca devolve uma tabela padrão embutida em código.
 * @param {{currencyRates?: object|null, ruleset?: object, registry?: object}} [context]
 * @param {object} [character] - usado só para achar `build.rulesetRef` no registry.
 * @returns {import('../../core/result.js').Result} Result<Record<string, number>, AppError>
 */
export function resolveCurrencyRates(context = {}, character = null) {
  const safeContext = isPlainObject(context) ? context : {};

  if (safeContext.currencyRates !== null && safeContext.currencyRates !== undefined) {
    return validateCurrencyRates(safeContext.currencyRates);
  }

  if (safeContext.ruleset !== null && safeContext.ruleset !== undefined) {
    return readRulesetCurrencyRates(safeContext.ruleset);
  }

  const registry = safeContext.registry;
  const rulesetId = character?.build?.rulesetRef?.id;
  if (registry !== null && registry !== undefined && typeof registry.get === 'function' && typeof rulesetId === 'string') {
    const entity = registry.get(rulesetId);
    if (entity !== null && entity !== undefined) {
      return readRulesetCurrencyRates(entity);
    }
  }

  return err(
    walletError(
      'WALLET_CURRENCY_RATES_UNAVAILABLE',
      'Sem "context.currencyRates" e sem ruleset acessível não há tabela de conversão; a operação de moedas foi recusada (nenhuma tabela padrão é embutida no domínio).',
      { rulesetId: typeof rulesetId === 'string' ? rulesetId : null },
    ),
  );
}

/**
 * Denominações com taxa conhecida, da MAIOR para a MENOR (desempate pela
 * ordem legada). É a ordem usada pela distribuição gulosa.
 * @param {Record<string, number>} rates
 * @returns {ReadonlyArray<string>}
 */
export function denominationsByValueDesc(rates) {
  const known = WALLET_DENOMINATIONS.filter((denomination) => Number.isInteger(rates?.[denomination]));
  return Object.freeze(
    [...known].sort((a, b) => {
      if (rates[b] !== rates[a]) {
        return rates[b] - rates[a];
      }
      return WALLET_DENOMINATIONS.indexOf(a) - WALLET_DENOMINATIONS.indexOf(b);
    }),
  );
}

/**
 * Soma o valor total da carteira em cobre. FALHA (em vez de ignorar) quando
 * existe saldo em uma denominação sem taxa conhecida — o jogador não pode ter
 * moedas silenciosamente desconsideradas de um pagamento.
 * @param {*} wallet
 * @param {Record<string, number>} rates
 * @returns {import('../../core/result.js').Result} Result<number, AppError>
 */
export function walletTotalInCopper(wallet, rates) {
  const normalized = normalizeWallet(wallet);
  let total = 0;
  for (const denomination of WALLET_DENOMINATIONS) {
    const rate = rates?.[denomination];
    if (!Number.isInteger(rate)) {
      if (normalized[denomination] > 0) {
        return err(
          walletError(
            'WALLET_CURRENCY_RATE_MISSING',
            `A carteira tem ${normalized[denomination]} "${denomination}", mas nenhuma taxa de conversão para essa denominação foi informada nem existe no ruleset.`,
            { denomination, quantity: normalized[denomination] },
          ),
        );
      }
      continue;
    }
    total += normalized[denomination] * rate;
  }
  return ok(total);
}

/**
 * Redistribui um valor em cobre pelas denominações COM TAXA CONHECIDA, usando
 * o menor número de moedas (guloso da maior para a menor) — mesmo algoritmo
 * de `site/js/moedas.js#distribuirCobre`.
 * @param {number} totalCopper
 * @param {Record<string, number>} rates
 * @returns {{pc: number, pp: number, pe: number, po: number, pl: number}}
 */
export function distributeCopper(totalCopper, rates) {
  let remainder = Math.max(0, Math.floor(Number(totalCopper) || 0));
  const out = createEmptyWallet();
  for (const denomination of denominationsByValueDesc(rates)) {
    const rate = rates[denomination];
    out[denomination] = Math.floor(remainder / rate);
    remainder -= out[denomination] * rate;
  }
  return out;
}

/**
 * Formata a carteira como texto legível, só denominações com saldo > 0, na
 * ordem legada (PL -> PC). Réplica de `site/js/moedas.js#formatarCarteira`.
 * @param {*} wallet
 * @returns {string}
 */
export function formatWallet(wallet) {
  const normalized = normalizeWallet(wallet);
  const parts = WALLET_DENOMINATIONS.filter((denomination) => normalized[denomination] > 0).map(
    (denomination) => `${normalized[denomination]} ${denomination.toUpperCase()}`,
  );
  return parts.length > 0 ? parts.join(', ') : '0 PO';
}

// Formato textual de custo aceito pelo baseline (`site/js/moedas.js#parseCusto`):
// inteiro com separador de milhar opcional em ponto + sigla da denominação.
const COST_TEXT_PATTERN = /^(\d{1,3}(?:\.\d{3})+|\d+)\s*(PC|PP|PE|PO|PL)$/i;

/**
 * Extrai `{denomination, quantity, copper}` de um texto de custo ("25 PO",
 * "1.000 PO"). Devolve `null` quando o texto não é parseável (ex.: "Varia") —
 * mesma semântica de `site/js/moedas.js#parseCusto`. `copper` é `null` quando
 * a denominação lida não tem taxa conhecida (nunca um valor chutado).
 * @param {*} text
 * @param {Record<string, number>} [rates]
 * @returns {{denomination: string, quantity: number, copper: number|null} | null}
 */
export function parseCostText(text, rates = {}) {
  if (text === null || text === undefined || text === '') {
    return null;
  }
  const match = String(text).trim().match(COST_TEXT_PATTERN);
  if (!match) {
    return null;
  }
  const quantity = Number.parseInt(match[1].replace(/\./g, ''), 10);
  const denomination = match[2].toLowerCase();
  const rate = rates?.[denomination];
  return {
    denomination,
    quantity,
    copper: Number.isInteger(rate) ? quantity * rate : null,
  };
}

/**
 * Projeção textual determinística de um custo em cobre, usando a MAIOR
 * denominação que o divide exatamente (ex.: 5000 cobre com a tabela padrão ->
 * "5 PL"). É o inverso de `parseCostText` para os valores que ele produz, o
 * que mantém o ciclo `parse -> editar -> formatar -> parse` idempotente.
 * @param {number} copper
 * @param {Record<string, number>} rates
 * @returns {string | null}
 */
export function formatCostText(copper, rates) {
  const value = Math.floor(Number(copper));
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  for (const denomination of denominationsByValueDesc(rates)) {
    const rate = rates[denomination];
    if (value % rate === 0 && (value !== 0 || denomination === BASE_DENOMINATION)) {
      return `${value / rate} ${denomination.toUpperCase()}`;
    }
  }
  return null;
}

/**
 * Retira `costCopper` da carteira convertendo automaticamente denominações
 * maiores quando necessário: reduz o total e redistribui (menor número de
 * moedas). Réplica de `site/js/moedas.js#retirarValor`.
 * @param {*} wallet
 * @param {number} costCopper
 * @param {Record<string, number>} rates
 * @returns {import('../../core/result.js').Result} Result<{wallet: object, paid: number}, AppError>
 */
export function withdrawCopper(wallet, costCopper, rates) {
  const totalResult = walletTotalInCopper(wallet, rates);
  if (!totalResult.ok) {
    return totalResult;
  }
  const total = totalResult.value;
  if (total < costCopper) {
    return err(
      walletError('WALLET_INSUFFICIENT_FUNDS', 'A carteira não tem valor suficiente para cobrir o custo.', {
        totalCopper: total,
        costCopper,
      }),
    );
  }
  return ok({ wallet: distributeCopper(total - costCopper, rates), paid: costCopper });
}

/**
 * Aplica a operação pedida sobre a carteira já normalizada, devolvendo a nova
 * carteira. Funções auxiliares por operação ficam aqui para que `changeWallet`
 * seja só validação + envelope.
 * @param {{operation: string, denomination?: string, quantity?: number, costText?: string, costCopper?: number, wallet?: object}} request
 * @param {{pc: number, pp: number, pe: number, po: number, pl: number}} current
 * @param {Record<string, number>} rates
 * @returns {import('../../core/result.js').Result} Result<{wallet: object, details: object}, AppError>
 */
function applyWalletOperation(request, current, rates) {
  const { operation } = request;

  if (operation === 'set') {
    return ok({ wallet: normalizeWallet(request.wallet), details: {} });
  }

  if (operation === 'add') {
    const next = { ...current, [request.denomination]: current[request.denomination] + request.quantity };
    return ok({ wallet: next, details: { denomination: request.denomination, quantity: request.quantity } });
  }

  if (operation === 'remove') {
    // Réplica de `removerQuantidadeMoeda`: se a pilha da própria denominação
    // já cobre a quantidade, só ela é decrementada (as demais ficam
    // intactas); senão, converte via total/redistribuição.
    const rate = rates[request.denomination];
    if (!Number.isInteger(rate)) {
      return err(
        walletError(
          'WALLET_CURRENCY_RATE_MISSING',
          `Não há taxa de conversão conhecida para "${request.denomination}".`,
          { denomination: request.denomination },
        ),
      );
    }
    const costCopper = request.quantity * rate;
    const totalResult = walletTotalInCopper(current, rates);
    if (!totalResult.ok) {
      return totalResult;
    }
    if (totalResult.value < costCopper) {
      return err(
        walletError('WALLET_INSUFFICIENT_FUNDS', 'A carteira não tem valor suficiente para remover essa quantidade.', {
          denomination: request.denomination,
          quantity: request.quantity,
          totalCopper: totalResult.value,
          costCopper,
        }),
      );
    }
    if (current[request.denomination] >= request.quantity) {
      const next = { ...current, [request.denomination]: current[request.denomination] - request.quantity };
      return ok({ wallet: next, details: { denomination: request.denomination, quantity: request.quantity } });
    }
    const withdrawn = withdrawCopper(current, costCopper, rates);
    if (!withdrawn.ok) {
      return withdrawn;
    }
    return ok({
      wallet: withdrawn.value.wallet,
      details: { denomination: request.denomination, quantity: request.quantity, costCopper },
    });
  }

  if (operation === 'pay') {
    let costCopper = request.costCopper;
    let costText = null;
    if (costCopper === undefined) {
      const parsed = parseCostText(request.costText, rates);
      if (parsed === null) {
        return err(
          walletError('WALLET_COST_TEXT_UNPARSEABLE', `O custo "${request.costText}" não é um valor monetário legível.`, {
            costText: request.costText,
          }),
        );
      }
      if (parsed.copper === null) {
        return err(
          walletError(
            'WALLET_CURRENCY_RATE_MISSING',
            `O custo está em "${parsed.denomination}", denominação sem taxa de conversão conhecida.`,
            { denomination: parsed.denomination },
          ),
        );
      }
      costCopper = parsed.copper;
      costText = String(request.costText);
    }
    const withdrawn = withdrawCopper(current, costCopper, rates);
    if (!withdrawn.ok) {
      return withdrawn;
    }
    return ok({ wallet: withdrawn.value.wallet, details: { costCopper, costText } });
  }

  // 'convert-up': réplica de `converterParaMaior`.
  const ordered = denominationsByValueDesc(rates);
  const index = ordered.indexOf(request.denomination);
  if (index <= 0) {
    return err(
      walletError(
        'WALLET_NO_HIGHER_DENOMINATION',
        `Não há denominação de valor maior que "${request.denomination}" com taxa conhecida.`,
        { denomination: request.denomination },
      ),
    );
  }
  const target = ordered[index - 1];
  const factor = rates[target] / rates[request.denomination];
  const converted = Math.floor(current[request.denomination] / factor);
  if (converted <= 0) {
    return err(
      walletError(
        'WALLET_CONVERSION_NOT_POSSIBLE',
        `São necessárias ${factor} moedas de "${request.denomination}" para formar 1 de "${target}".`,
        { denomination: request.denomination, target, factor, available: current[request.denomination] },
      ),
    );
  }
  const next = {
    ...current,
    [request.denomination]: current[request.denomination] - converted * factor,
    [target]: current[target] + converted,
  };
  return ok({ wallet: next, details: { denomination: request.denomination, target, converted, factor } });
}

/**
 * Valida a forma do pedido de `changeWallet`.
 * @param {*} request
 * @returns {Readonly<object> | null} AppError ou `null` quando válido.
 */
function validateWalletRequest(request) {
  if (!isPlainObject(request) || typeof request.operation !== 'string') {
    return walletError('WALLET_REQUEST_INVALID', 'O pedido de carteira deve ser um objeto com "operation".', {});
  }
  if (!WALLET_OPERATIONS.includes(request.operation)) {
    return walletError('WALLET_OPERATION_UNKNOWN', `A operação de carteira "${request.operation}" não existe.`, {
      operation: request.operation,
      allowed: WALLET_OPERATIONS,
    });
  }
  if (request.operation === 'set') {
    if (!isPlainObject(request.wallet)) {
      return walletError('WALLET_REQUEST_WALLET_INVALID', '"wallet" deve ser um objeto de denominações.', {});
    }
    return null;
  }
  if (request.operation === 'pay') {
    const hasCopper = request.costCopper !== undefined;
    const hasText = request.costText !== undefined;
    if (hasCopper === hasText) {
      return walletError(
        'WALLET_REQUEST_COST_INVALID',
        'Um pagamento exige exatamente um entre "costCopper" (número) e "costText" (texto).',
        {},
      );
    }
    if (hasCopper && (!Number.isInteger(request.costCopper) || request.costCopper < 0)) {
      return walletError('WALLET_REQUEST_COST_INVALID', '"costCopper" deve ser um inteiro >= 0.', {
        costCopper: request.costCopper,
      });
    }
    return null;
  }
  if (!DENOMINATION_SET.has(request.denomination)) {
    return walletError('WALLET_DENOMINATION_UNKNOWN', `"${request.denomination}" não é uma denominação da carteira.`, {
      denomination: request.denomination,
      allowed: WALLET_DENOMINATIONS,
    });
  }
  if (request.operation !== 'convert-up' && (!Number.isInteger(request.quantity) || request.quantity <= 0)) {
    return walletError('WALLET_QUANTITY_INVALID', '"quantity" deve ser um inteiro > 0.', {
      quantity: request.quantity,
    });
  }
  return null;
}

/**
 * Comando de mutação da carteira (`state.wallet`). Nunca deixa saldo negativo
 * (um pagamento sem fundos falha com `WALLET_INSUFFICIENT_FUNDS` e devolve o
 * personagem ORIGINAL, como o `pagarCusto` do baseline, que retorna
 * `{sucesso:false}` sem alterar as moedas).
 *
 * A tabela de conversão vem SEMPRE de fora (`context.currencyRates` ou o
 * ruleset) — ver o cabeçalho do módulo.
 * @param {object} character - CanonicalCharacter
 * @param {{operation: string, denomination?: string, quantity?: number, costText?: string, costCopper?: number, wallet?: object}} request
 * @param {{currencyRates?: object|null, ruleset?: object, registry?: object}} [context]
 * @returns {import('../commands/command-result.js').CommandResult}
 */
export function changeWallet(character, request, context = {}) {
  const requestError = validateWalletRequest(request);
  if (requestError !== null) {
    return commandErr({ character, error: requestError });
  }

  const ratesResult = resolveCurrencyRates(context, character);
  if (!ratesResult.ok) {
    return commandErr({ character, error: ratesResult.error });
  }
  const rates = ratesResult.value;

  const current = normalizeWallet(character?.state?.wallet);
  const applied = applyWalletOperation(request, current, rates);
  if (!applied.ok) {
    return commandErr({ character, error: applied.error });
  }

  const nextWallet = normalizeWallet(applied.value.wallet);
  const unchanged = WALLET_DENOMINATIONS.every((denomination) => nextWallet[denomination] === current[denomination]);
  if (unchanged) {
    return commandOk({ character, events: [], affected: [] });
  }

  const nextCharacter = Object.freeze({
    ...character,
    state: Object.freeze({ ...character.state, wallet: Object.freeze(nextWallet) }),
  });

  return commandOk({
    character: nextCharacter,
    events: [{ type: 'wallet-changed', operation: request.operation, ...applied.value.details }],
    affected: [AFFECTED_WALLET],
  });
}

// Reexportado para que `inventory-commands.js` monte erros no mesmo escopo de
// comando quando o problema não é da carteira em si.
export { commandError as walletCommandError };
