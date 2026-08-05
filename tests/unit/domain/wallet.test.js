// Testes da carteira multi-moeda do domínio (Task 19):
// `site/js/domain/inventory/wallet.js`. Cobre as cinco denominações,
// pagamentos, conversões, impossibilidade de saldo negativo, e — o ponto
// central do brief — que a tabela de taxas NUNCA está embutida no domínio:
// vem de `context.currencyRates` (preferência `dnd_taxas_moeda`) ou do
// ruleset oficial, e uma taxa não padrão MUDA o resultado.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import {
  WALLET_DENOMINATIONS,
  normalizeWallet,
  createEmptyWallet,
  readRulesetCurrencyRates,
  validateCurrencyRates,
  resolveCurrencyRates,
  walletTotalInCopper,
  distributeCopper,
  formatWallet,
  parseCostText,
  formatCostText,
  withdrawCopper,
  changeWallet,
} from '../../../site/js/domain/inventory/wallet.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

// Taxas do baseline e43c5ea (site/js/moedas.js#TAXAS_PADRAO). Aqui elas são
// ENTRADA de teste (o que a preferência do usuário/ruleset entregaria), não
// um default do domínio.
const TAXAS_BASELINE = Object.freeze({ pc: 1, pp: 10, pe: 50, po: 100, pl: 1000 });

// Taxas deliberadamente NÃO padrão: cada denominação vale metade. Se a
// implementação ignorasse `currencyRates`, os testes que usam esta tabela
// falhariam (é exatamente o que o brief exige provar).
const TAXAS_CUSTOMIZADAS = Object.freeze({ pc: 1, pp: 5, pe: 25, po: 50, pl: 500 });

let rulesetEntity;

/**
 * Carrega a entidade real do ruleset oficial do pacote em disco.
 * @returns {Promise<object>}
 */
async function loadRuleset() {
  if (rulesetEntity === undefined) {
    rulesetEntity = JSON.parse(await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/rulesets/core.json'), 'utf8'));
  }
  return rulesetEntity;
}

/**
 * Personagem canônico mínimo com a carteira informada.
 * @param {object} wallet
 * @returns {object}
 */
function makeCharacter(wallet) {
  const base = createEmptyCharacter({ id: 'char-wallet', now: '2026-08-02T00:00:00.000Z', rulesetRef: RULESET_REF });
  return Object.freeze({ ...base, state: Object.freeze({ ...base.state, wallet: Object.freeze({ ...wallet }) }) });
}

describe('domain/inventory/wallet — normalização e as cinco denominações', () => {
  test('a carteira tem exatamente as cinco denominações da ficha', () => {
    assert.deepEqual([...WALLET_DENOMINATIONS], ['pl', 'po', 'pe', 'pp', 'pc']);
    assert.deepEqual(Object.keys(createEmptyWallet()).sort(), ['pc', 'pe', 'pl', 'po', 'pp']);
  });

  test('normaliza negativos, fracionários, strings e chaves ausentes (réplica do baseline)', () => {
    assert.deepEqual(normalizeWallet({ po: '7', pp: 2.9, pc: -5 }), { pc: 0, pp: 2, pe: 0, po: 7, pl: 0 });
    assert.deepEqual(normalizeWallet(null), createEmptyWallet());
  });

  test('formatarCarteira mostra só denominações com saldo, na ordem PL->PC', () => {
    assert.equal(formatWallet({ pl: 1, po: 0, pe: 2, pp: 0, pc: 3 }), '1 PL, 2 PE, 3 PC');
    assert.equal(formatWallet(createEmptyWallet()), '0 PO');
  });
});

describe('domain/inventory/wallet — origem da tabela de taxas (nunca embutida)', () => {
  test('sem currencyRates e sem ruleset, qualquer operação é recusada com erro explícito', () => {
    const character = makeCharacter({ ...createEmptyWallet(), po: 10 });
    const result = changeWallet(character, { operation: 'pay', costText: '5 PO' }, {});
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'WALLET_CURRENCY_RATES_UNAVAILABLE');
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
  });

  test('a tabela do ruleset oficial real cobre as CINCO denominações da carteira', async () => {
    const ruleset = await loadRuleset();
    const rates = readRulesetCurrencyRates(ruleset);
    assert.equal(rates.ok, true, JSON.stringify(rates.error ?? null));
    // Fix da revisão da Task 19: `ep` (eletro) foi restaurado na tabela de
    // moedas do ruleset — sem ele, o caminho "default vindo do ruleset"
    // (Tasks 29/33) deixaria de pagar/dar troco em eletro, uma regressão
    // visível contra o baseline e43c5ea. O enum FECHADO de moeda de custo de
    // item (`common.schema.json#/$defs/cost`) continua sem eletro, de
    // propósito (Task 7) — são tabelas diferentes.
    assert.deepEqual(rates.value, { pc: 1, pp: 10, pe: 50, po: 100, pl: 1000 });
    // Consequência: a tabela do ruleset é EQUIVALENTE à do baseline.
    assert.deepEqual({ ...rates.value }, { ...TAXAS_BASELINE });
  });

  test('denominação sem taxa conhecida nunca é ignorada em silêncio (ruleset parcial de terceiros)', () => {
    // O domínio não presume que todo ruleset declare as cinco moedas: um
    // pacote de terceiros pode declarar menos. Aqui a tabela vem sem `pe`.
    const parcial = { pc: 1, pp: 10, po: 100, pl: 1000 };

    const total = walletTotalInCopper({ ...createEmptyWallet(), pe: 2 }, parcial);
    assert.equal(total.ok, false);
    assert.equal(total.error.code, 'WALLET_CURRENCY_RATE_MISSING');

    // E um saldo ZERO na denominação sem taxa não atrapalha nada.
    const semEletro = walletTotalInCopper({ ...createEmptyWallet(), po: 3 }, parcial);
    assert.equal(semEletro.ok, true);
    assert.equal(semEletro.value, 300);

    // A distribuição também só usa as denominações com taxa conhecida.
    assert.deepEqual(distributeCopper(150, parcial), { pc: 0, pp: 5, pe: 0, po: 1, pl: 0 });
  });

  test('resolveCurrencyRates: currencyRates tem precedência sobre o ruleset', async () => {
    const ruleset = await loadRuleset();
    const comPreferencia = resolveCurrencyRates({ currencyRates: TAXAS_CUSTOMIZADAS, ruleset });
    assert.equal(comPreferencia.ok, true);
    assert.equal(comPreferencia.value.po, 50);

    const semPreferencia = resolveCurrencyRates({ currencyRates: null, ruleset });
    assert.equal(semPreferencia.ok, true);
    assert.equal(semPreferencia.value.po, 100);
  });

  test('resolveCurrencyRates busca o ruleset pelo registry + build.rulesetRef do personagem', async () => {
    const ruleset = await loadRuleset();
    const registry = { get: (id) => (id === RULESET_REF.id ? ruleset : null) };
    const character = makeCharacter(createEmptyWallet());
    const resolved = resolveCurrencyRates({ registry }, character);
    assert.equal(resolved.ok, true);
    assert.equal(resolved.value.pl, 1000);
  });

  test('uma tabela de taxas inválida é ERRO, nunca um fallback silencioso para o ruleset', async () => {
    const ruleset = await loadRuleset();
    const semBase = resolveCurrencyRates({ currencyRates: { pp: 10, po: 100 }, ruleset });
    assert.equal(semBase.ok, false);
    assert.equal(semBase.error.code, 'WALLET_CURRENCY_BASE_RATE_INVALID');

    const naoInteira = validateCurrencyRates({ pc: 1, pp: 10.5, pe: 50, po: 100, pl: 1000 });
    assert.equal(naoInteira.ok, false);
    assert.equal(naoInteira.error.code, 'WALLET_CURRENCY_RATE_INVALID');

    const foraDaCadeia = validateCurrencyRates({ pc: 1, pp: 10, pe: 15, po: 100, pl: 1000 });
    assert.equal(foraDaCadeia.ok, false);
    assert.equal(foraDaCadeia.error.code, 'WALLET_CURRENCY_RATE_CHAIN_INVALID');
    assert.equal(foraDaCadeia.error.context.denomination, 'pe');
    assert.equal(foraDaCadeia.error.context.previousDenomination, 'pp');
  });
});

describe('domain/inventory/wallet — totalização, distribuição e custos textuais', () => {
  test('total em cobre soma as cinco denominações pelas taxas informadas', () => {
    const total = walletTotalInCopper({ pl: 1, po: 2, pe: 3, pp: 4, pc: 5 }, TAXAS_BASELINE);
    assert.equal(total.ok, true);
    assert.equal(total.value, 1000 + 200 + 150 + 40 + 5);
  });

  test('distribuição é gulosa da maior denominação para a menor', () => {
    assert.deepEqual(distributeCopper(5000, TAXAS_BASELINE), { pc: 0, pp: 0, pe: 0, po: 0, pl: 5 });
    assert.deepEqual(distributeCopper(1234, TAXAS_BASELINE), { pc: 4, pp: 3, pe: 0, po: 2, pl: 1 });
  });

  test('parse/format de custo textual são inversos entre si (ciclo estável)', () => {
    const parsed = parseCostText('1.000 PO', TAXAS_BASELINE);
    assert.deepEqual(parsed, { denomination: 'po', quantity: 1000, copper: 100000 });
    assert.equal(formatCostText(parsed.copper, TAXAS_BASELINE), '100 PL');
    assert.equal(parseCostText(formatCostText(parsed.copper, TAXAS_BASELINE), TAXAS_BASELINE).copper, parsed.copper);
    assert.equal(parseCostText('Varia', TAXAS_BASELINE), null);
  });
});

describe('domain/inventory/wallet — changeWallet: pagamentos e saldo nunca negativo', () => {
  test('pagar com fundos suficientes redistribui o troco (paridade com pagarCusto)', () => {
    const character = makeCharacter({ ...createEmptyWallet(), po: 100 });
    const result = changeWallet(character, { operation: 'pay', costText: '50 PO' }, { currencyRates: TAXAS_BASELINE });
    assert.equal(result.ok, true);
    assert.deepEqual(result.character.state.wallet, { pc: 0, pp: 0, pe: 0, po: 0, pl: 5 });
    assert.deepEqual(result.affected, ['state.wallet']);
  });

  test('pagar sem fundos falha e devolve o personagem ORIGINAL intacto', () => {
    const character = makeCharacter({ ...createEmptyWallet(), po: 3 });
    const result = changeWallet(character, { operation: 'pay', costText: '50 PO' }, { currencyRates: TAXAS_BASELINE });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'WALLET_INSUFFICIENT_FUNDS');
    assert.equal(result.character, character);
    assert.deepEqual(result.character.state.wallet, { pc: 0, pp: 0, pe: 0, po: 3, pl: 0 });
    assert.deepEqual(result.affected, []);
  });

  test('nenhuma denominação pode ficar negativa em nenhuma operação', () => {
    const character = makeCharacter({ ...createEmptyWallet(), pp: 3 });
    const remocao = changeWallet(
      character,
      { operation: 'remove', denomination: 'po', quantity: 1 },
      { currencyRates: TAXAS_BASELINE },
    );
    assert.equal(remocao.ok, false);
    assert.equal(remocao.error.code, 'WALLET_INSUFFICIENT_FUNDS');
    for (const denomination of WALLET_DENOMINATIONS) {
      assert.ok(remocao.character.state.wallet[denomination] >= 0);
    }
  });

  test('remover da própria pilha não mexe nas outras; remover além dela converte', () => {
    const character = makeCharacter({ pc: 0, pp: 5, pe: 0, po: 2, pl: 0 });
    const daPilha = changeWallet(
      character,
      { operation: 'remove', denomination: 'pp', quantity: 3 },
      { currencyRates: TAXAS_BASELINE },
    );
    assert.equal(daPilha.ok, true);
    assert.deepEqual(daPilha.character.state.wallet, { pc: 0, pp: 2, pe: 0, po: 2, pl: 0 });

    const convertendo = changeWallet(
      character,
      { operation: 'remove', denomination: 'pp', quantity: 10 },
      { currencyRates: TAXAS_BASELINE },
    );
    assert.equal(convertendo.ok, true);
    // 5 PP + 2 PO = 250 cobre; -10 PP (100) = 150 -> 1 PO + 1 PE
    assert.deepEqual(convertendo.character.state.wallet, { pc: 0, pp: 0, pe: 1, po: 1, pl: 0 });
  });

  test('adicionar credita a denominação pedida sem conversão', () => {
    const character = makeCharacter(createEmptyWallet());
    const result = changeWallet(
      character,
      { operation: 'add', denomination: 'po', quantity: 7 },
      { currencyRates: TAXAS_BASELINE },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.character.state.wallet, { pc: 0, pp: 0, pe: 0, po: 7, pl: 0 });
  });

  test('converter para a denominação maior consome o múltiplo exato e deixa o resto', () => {
    const character = makeCharacter({ ...createEmptyWallet(), pc: 25 });
    const result = changeWallet(
      character,
      { operation: 'convert-up', denomination: 'pc' },
      { currencyRates: TAXAS_BASELINE },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.character.state.wallet, { pc: 5, pp: 2, pe: 0, po: 0, pl: 0 });
  });

  test('operação que não muda nada devolve ok com affected vazio', () => {
    const character = makeCharacter({ ...createEmptyWallet(), pc: 5 });
    const result = changeWallet(
      character,
      { operation: 'convert-up', denomination: 'pl' },
      { currencyRates: TAXAS_BASELINE },
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'WALLET_NO_HIGHER_DENOMINATION');

    const set = changeWallet(
      character,
      { operation: 'set', wallet: { ...createEmptyWallet(), pc: 5 } },
      { currencyRates: TAXAS_BASELINE },
    );
    assert.equal(set.ok, true);
    assert.deepEqual(set.affected, []);
    assert.equal(set.character, character);
  });

  test('withdrawCopper nunca deixa o total negativo', () => {
    const insuficiente = withdrawCopper({ ...createEmptyWallet(), pc: 10 }, 11, TAXAS_BASELINE);
    assert.equal(insuficiente.ok, false);
    const exato = withdrawCopper({ ...createEmptyWallet(), pc: 10 }, 10, TAXAS_BASELINE);
    assert.equal(exato.ok, true);
    assert.deepEqual(exato.value.wallet, createEmptyWallet());
  });
});

describe('domain/inventory/wallet — currencyRates customizado MUDA o resultado', () => {
  // Este bloco é a prova exigida pelo brief: uma implementação que apenas
  // "aceitasse" `currencyRates` sem usá-lo falharia aqui.
  test('o mesmo custo textual consome metade do valor com a tabela customizada', () => {
    const carteira = { ...createEmptyWallet(), pc: 1000 };
    const character = makeCharacter(carteira);

    const padrao = changeWallet(character, { operation: 'pay', costText: '5 PO' }, { currencyRates: TAXAS_BASELINE });
    assert.equal(padrao.ok, true);
    // 5 PO = 500 cobre -> restam 500 -> 5 PO na tabela padrão.
    assert.deepEqual(padrao.character.state.wallet, { pc: 0, pp: 0, pe: 0, po: 5, pl: 0 });

    const custom = changeWallet(character, { operation: 'pay', costText: '5 PO' }, { currencyRates: TAXAS_CUSTOMIZADAS });
    assert.equal(custom.ok, true);
    // 5 PO = 250 cobre -> restam 750 -> 1 PL(500) + 5 PO(250) na tabela customizada.
    assert.deepEqual(custom.character.state.wallet, { pc: 0, pp: 0, pe: 0, po: 5, pl: 1 });

    assert.notDeepEqual(padrao.character.state.wallet, custom.character.state.wallet);
  });

  test('um pagamento IMPOSSÍVEL com a tabela padrão passa a ser possível com a customizada', () => {
    const character = makeCharacter({ ...createEmptyWallet(), pc: 400 });

    const padrao = changeWallet(character, { operation: 'pay', costText: '5 PO' }, { currencyRates: TAXAS_BASELINE });
    assert.equal(padrao.ok, false, 'com PO=100 o custo é 500 cobre e a carteira tem 400');
    assert.equal(padrao.error.code, 'WALLET_INSUFFICIENT_FUNDS');

    const custom = changeWallet(character, { operation: 'pay', costText: '5 PO' }, { currencyRates: TAXAS_CUSTOMIZADAS });
    assert.equal(custom.ok, true, 'com PO=50 o custo é 250 cobre e a carteira tem 400');
    assert.equal(walletTotalInCopper(custom.character.state.wallet, TAXAS_CUSTOMIZADAS).value, 150);
  });

  test('a tabela do ruleset e a do baseline distribuem IGUAL (inclusive em eletro)', async () => {
    const ruleset = await loadRuleset();
    const doRuleset = resolveCurrencyRates({ currencyRates: null, ruleset });
    assert.equal(doRuleset.ok, true);

    // 150 cobre = 1 PO + 1 PE nas duas tabelas. Este teste é a contraparte do
    // fix da revisão: antes de `ep` entrar no ruleset, o caminho do ruleset
    // devolvia 1 PO + 5 PP (troco sem eletro), divergindo do baseline.
    assert.deepEqual(distributeCopper(150, doRuleset.value), { pc: 0, pp: 0, pe: 1, po: 1, pl: 0 });
    assert.deepEqual(distributeCopper(150, TAXAS_BASELINE), { pc: 0, pp: 0, pe: 1, po: 1, pl: 0 });

    // E um personagem com eletro no bolso consegue pagar pelo caminho do
    // ruleset (era exatamente a regressão apontada na revisão).
    const character = makeCharacter({ ...createEmptyWallet(), pe: 4 });
    const pago = changeWallet(character, { operation: 'pay', costText: '1 PO' }, { currencyRates: null, ruleset });
    assert.equal(pago.ok, true, JSON.stringify(pago.error ?? null));
    // 4 PE = 200 cobre; -100 = 100 cobre, redistribuídos gulosamente -> 1 PO.
    assert.deepEqual(pago.character.state.wallet, { pc: 0, pp: 0, pe: 0, po: 1, pl: 0 });
  });
});
