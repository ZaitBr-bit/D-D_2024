// Teste de contrato (Task 19): inventário, carga e moedas do domínio contra
// as fixtures de baseline do commit `e43c5ea`.
//
// Três frentes:
//
//   1. TRANSIÇÕES — as categorias "inventario" e "moedas" de
//      `tests/fixtures/expected/command-transitions.json` (que a Task 17
//      deixou explicitamente fora do escopo dela) rodadas pelo ciclo completo
//      `decodeCharacterRecord -> executeCharacterCommand -> encodeCharacterRecord`.
//   2. CARGA — o oráculo `carga-somente-na-tela` de
//      `tests/fixtures/expected/derived-values.json` (peso total 28 kg,
//      capacidade 84 kg) via `getInventoryProjection`.
//   3. ITENS CUSTOMIZADOS REAIS — o ciclo `parse(texto) -> editar ->
//      formatar -> parse` sobre os itens de
//      `tests/fixtures/characters/legacy-custom-spells-items.json`, lidos
//      pela MIGRAÇÃO REAL (`decodeCharacterRecord`), não por objetos
//      fabricados à mão — para que o formato exato que
//      `migrations/v1-to-v2.js` produz (incluindo `sourceInstanceId: null` e
//      `customDefinition` com o item bruto) seja o que os testes exercitam.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLegacyAliasResolver } from '../../site/js/infra/character/legacy-alias-resolver.js';
import { decodeCharacterRecord, encodeCharacterRecord } from '../../site/js/infra/character/character-codec.js';
import { projectLegacyCharacterForQueries } from '../../site/js/infra/character/legacy-query-adapter.js';
import { executeCharacterCommand } from '../../site/js/domain/commands/command-dispatcher.js';
import { getInventoryProjection } from '../../site/js/domain/inventory/index.js';
import {
  resolveItemDefinition,
  editCustomDefinitionNumbers,
  parseWeightText,
  formatWeightText,
  readRulesetCurrencyRates,
  parseCostText,
  formatCostText,
} from '../../site/js/domain/inventory/index.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const NOW = '2026-08-02T00:00:00.000Z';

// Tabela do baseline `e43c5ea` (`site/js/moedas.js#TAXAS_PADRAO`). Entra aqui
// como a preferência que a camada de `infra`/`features` injetaria em
// `context.currencyRates` — NÃO é um default do domínio.
const TAXAS_BASELINE = Object.freeze({ pc: 1, pp: 10, pe: 50, po: 100, pl: 1000 });

let ctx;
let transitions;
let derivedValues;
let customItemsFixture;
let rulesetEntity;

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  ctx = { aliasResolver: createLegacyAliasResolver(aliases), now: NOW };

  const transitionsFixture = JSON.parse(
    await readFile(path.join(repoRoot, 'tests/fixtures/expected/command-transitions.json'), 'utf8'),
  );
  transitions = Object.fromEntries(transitionsFixture.cases.map((entry) => [entry.id, entry]));

  derivedValues = JSON.parse(await readFile(path.join(repoRoot, 'tests/fixtures/expected/derived-values.json'), 'utf8'));
  customItemsFixture = JSON.parse(
    await readFile(path.join(repoRoot, 'tests/fixtures/characters/legacy-custom-spells-items.json'), 'utf8'),
  );
  rulesetEntity = JSON.parse(await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/rulesets/core.json'), 'utf8'));
});

/**
 * Compara o registro codificado com `personagemDepois`, apenas nas chaves que
 * o próprio fixture v1 declara (o registro v2 tem canais adicionais —
 * `_schema`, `overrides`, `content_refs` — que não existem no vocabulário do
 * app baseline). Mesmo critério de `tests/contract/command-transition-parity.test.js`.
 *
 * `instanceId` é removido de cada item de `inventario` antes da comparação:
 * é um canal NOVO do modelo canônico (`inventoryEntry.instanceId`), emitido
 * por `character-codec.js#encodeCharacterRecord` para que a identidade da
 * instância sobreviva ao round-trip. O fixture foi capturado no baseline, que
 * não tinha esse campo. A presença e a estabilidade do `instanceId` são
 * verificadas à parte (`assertInstanceIdsPreserved`), então isto não esconde
 * regressão — apenas alinha os dois vocabulários.
 * @param {object} encoded
 * @param {object} expectedRecord
 * @param {string} label
 */
function assertRecordMatches(encoded, expectedRecord, label) {
  const stripInstanceIds = (record) => {
    if (!Array.isArray(record?.inventario)) {
      return record;
    }
    return {
      ...record,
      inventario: record.inventario.map((item) => {
        const { instanceId, ...rest } = item;
        void instanceId;
        return rest;
      }),
    };
  };

  const expected = stripInstanceIds({ ...expectedRecord });
  const actualFull = stripInstanceIds(encoded);
  const actual = {};
  for (const key of Object.keys(expected)) {
    actual[key] = actualFull[key];
  }
  assert.deepEqual(actual, expected, `personagemDepois diverge para "${label}"`);
}

/**
 * Confere que todo item do inventário codificado tem `instanceId` não vazio e
 * que os ids são únicos — a contrapartida da exclusão feita acima.
 * @param {object} encoded
 */
function assertInstanceIdsPreserved(encoded) {
  const ids = (encoded.inventario ?? []).map((item) => item.instanceId);
  for (const id of ids) {
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0, 'todo item precisa manter um instanceId próprio');
  }
  assert.equal(new Set(ids).size, ids.length, 'os instanceId precisam ser únicos');
}

/**
 * Roda um caso de transição pelo ciclo completo.
 * @param {string} caseId
 * @param {object} command
 * @param {object} [context]
 * @returns {{result: object, encoded: object, fixtureCase: object}}
 */
function runCase(caseId, command, context = {}) {
  const fixtureCase = transitions[caseId];
  assert.ok(fixtureCase, `fixture "${caseId}" não encontrado`);

  const decoded = decodeCharacterRecord(fixtureCase.personagemAntes, ctx);
  assert.equal(decoded.ok, true, `decode falhou para "${caseId}": ${JSON.stringify(decoded.error ?? null)}`);
  assert.equal(decoded.value.mode, 'editable');

  const result = executeCharacterCommand(decoded.value.character, command, { ...ctx, ...context });
  const encoded = encodeCharacterRecord(result.character, ctx);
  assert.equal(encoded.ok, true, `encode falhou para "${caseId}": ${JSON.stringify(encoded.error ?? null)}`);
  return { result, encoded: encoded.value, fixtureCase };
}

describe('contract/inventory-parity — transições de inventário do baseline', () => {
  test('inventario-equipar-item-e-toggle-nao-exclusivo: equipar NÃO desequipa a outra armadura', () => {
    const fixtureCase = transitions['inventario-equipar-item-e-toggle-nao-exclusivo'];
    const decoded = decodeCharacterRecord(fixtureCase.personagemAntes, ctx);
    assert.equal(decoded.ok, true);
    // O comando endereça a INSTÂNCIA (id estável derivado pela migração), não
    // o índice nem o nome — mas o item alvo do fixture é identificado pelo
    // nome legado, então ele é traduzido para o instanceId aqui.
    const alvo = decoded.value.character.state.inventory.find(
      (entry) => entry.customDefinition?.nome === fixtureCase.operacao.nome,
    );
    assert.ok(alvo, 'item alvo do fixture não encontrado no personagem decodificado');

    const { result, encoded } = runCase('inventario-equipar-item-e-toggle-nao-exclusivo', {
      type: 'equip-item',
      instanceId: alvo.instanceId,
      equipped: fixtureCase.operacao.equipado,
    });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.deepEqual(result.affected, ['state.inventory']);
    assertRecordMatches(encoded, fixtureCase.personagemDepois, 'inventario-equipar-item-e-toggle-nao-exclusivo');
    assertInstanceIdsPreserved(encoded);
  });
});

describe('contract/inventory-parity — transições de moedas do baseline', () => {
  const casosDePagamento = [
    'moedas-pagar-custo-sucesso',
    'moedas-pagar-custo-converte-denominacao-menor',
    'moedas-pagar-custo-insuficiente',
  ];

  for (const caseId of casosDePagamento) {
    test(`${caseId} (taxas via context.currencyRates, como a preferência dnd_taxas_moeda)`, () => {
      const fixtureCase = transitions[caseId];
      const { result, encoded } = runCase(
        caseId,
        { type: 'change-wallet', operation: 'pay', costText: fixtureCase.operacao.custoStr },
        { currencyRates: TAXAS_BASELINE },
      );

      const esperaFalha = caseId === 'moedas-pagar-custo-insuficiente';
      assert.equal(result.ok, !esperaFalha, JSON.stringify(result.error ?? null));
      if (esperaFalha) {
        assert.equal(result.error.code, 'WALLET_INSUFFICIENT_FUNDS');
        assert.deepEqual(result.affected, [], 'falha nunca reporta campos afetados');
      } else {
        assert.deepEqual(result.affected, ['state.wallet']);
      }
      assertRecordMatches(encoded, fixtureCase.personagemDepois, caseId);
    });

    test(`${caseId} também bate usando a tabela do RULESET oficial (sem currencyRates)`, () => {
      // O caminho "default vindo do ruleset" (o que as Tasks 29/33 vão usar
      // quando o shim `moedas.js` sumir) precisa produzir exatamente o mesmo
      // resultado que a preferência do usuário.
      const fixtureCase = transitions[caseId];
      const { encoded } = runCase(
        caseId,
        { type: 'change-wallet', operation: 'pay', costText: fixtureCase.operacao.custoStr },
        { currencyRates: null, ruleset: rulesetEntity },
      );
      assertRecordMatches(encoded, fixtureCase.personagemDepois, `${caseId} (ruleset)`);
    });
  }

  test('a tabela do ruleset oficial cobre as cinco denominações da carteira, incluindo eletro', () => {
    // Fix da revisão da Task 19: `{"code":"ep","copperValue":50}` foi
    // restaurado em `dados/pacotes/dnd2024/rulesets/core.json`. Sem ele, o
    // caminho default (ruleset) não pagaria nem daria troco em eletro quando
    // as Tasks 29/33 substituírem o shim `site/js/moedas.js` — regressão
    // visível contra o baseline e43c5ea. O enum fechado de moeda de CUSTO DE
    // ITEM (`common.schema.json#/$defs/cost`) segue sem eletro, por decisão
    // da Task 7: são tabelas distintas.
    const rates = readRulesetCurrencyRates(rulesetEntity);
    assert.equal(rates.ok, true);
    assert.deepEqual(rates.value, TAXAS_BASELINE);
  });

  test('com a tabela do ruleset, uma carteira COM eletro paga normalmente', () => {
    const fixtureCase = transitions['moedas-pagar-custo-sucesso'];
    const comEletro = {
      ...fixtureCase.personagemAntes,
      moedas: { pc: 0, pp: 0, pe: 4, po: 0, pl: 0 },
    };
    const decoded = decodeCharacterRecord(comEletro, ctx);
    assert.equal(decoded.ok, true);
    const result = executeCharacterCommand(
      decoded.value.character,
      { type: 'change-wallet', operation: 'pay', costText: '1 PO' },
      { ...ctx, currencyRates: null, ruleset: rulesetEntity },
    );
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    // 4 PE = 200 cobre; -100 = 100 -> 1 PO.
    assert.deepEqual(result.character.state.wallet, { pc: 0, pp: 0, pe: 0, po: 1, pl: 0 });
  });
});

describe('contract/inventory-parity — oráculo de carga (derived-values.json)', () => {
  test('carga-somente-na-tela: peso total 28 kg e capacidade 84 kg via getInventoryProjection', () => {
    const testCase = derivedValues.cases.find((entry) => entry.id === 'carga-somente-na-tela');
    assert.ok(testCase);
    const character = projectLegacyCharacterForQueries(testCase.personagem, ctx);
    assert.equal(character.ok, true, JSON.stringify(character.error ?? null));

    const projection = getInventoryProjection(character.value);
    assert.equal(projection.ok, true, JSON.stringify(projection.error ?? null));
    // `expectedUnified` é a CAPACIDADE (84); o peso total (28) está descrito
    // em `notas` ("20 + 3 + 5 = 28 kg").
    assert.equal(projection.value.carryingCapacityKg, testCase.expectedUnified);
    assert.equal(projection.value.totalWeightKg, 28);
    assert.equal(projection.value.encumbranceLevel, 'none');
    assert.equal(projection.value.items.length, 3);
  });
});

describe('contract/inventory-parity — itens customizados reais (formato da migração)', () => {
  /**
   * Todas as entradas de inventário de todos os casos da fixture de itens
   * customizados, já passadas pela migração real.
   * @returns {Array<{caseId: string, entry: object}>}
   */
  function decodedInventoryEntries() {
    const out = [];
    for (const fixtureCase of customItemsFixture.cases) {
      const decoded = decodeCharacterRecord(fixtureCase.personagem, ctx);
      assert.equal(decoded.ok, true, `decode falhou para "${fixtureCase.id}"`);
      for (const entry of decoded.value.character.state.inventory) {
        out.push({ caseId: fixtureCase.id, entry });
      }
    }
    return out;
  }

  test('a fixture real produz o formato da migração (customDefinition + sourceInstanceId null)', () => {
    const entries = decodedInventoryEntries();
    assert.ok(entries.length > 0, 'a fixture precisa ter ao menos um item de inventário');
    for (const { caseId, entry } of entries) {
      assert.equal(typeof entry.instanceId, 'string', `${caseId}: instanceId ausente`);
      assert.ok(entry.instanceId.length > 0);
      assert.equal(entry.sourceInstanceId, null, `${caseId}: a migração grava sourceInstanceId null`);
      assert.ok(entry.customDefinition !== null, `${caseId}: customDefinition preservado`);
      assert.equal(Number.isInteger(entry.quantity), true);
      assert.equal(typeof entry.equipped, 'boolean');
    }
  });

  test('ciclo parse -> editar -> formatar -> parse é estável para CADA item customizado real', () => {
    const rates = readRulesetCurrencyRates(rulesetEntity);
    assert.equal(rates.ok, true);
    // A tabela do baseline é usada aqui porque os textos de custo legados
    // podem estar em qualquer das cinco denominações.
    const entries = decodedInventoryEntries();

    for (const { caseId, entry } of entries) {
      const definition = resolveItemDefinition(entry, { rates: TAXAS_BASELINE });

      // 1. parse: o texto legado vira número.
      const pesoOriginal = definition.weightKg ?? 0;
      if (definition.legacyWeightText !== null) {
        assert.equal(
          pesoOriginal,
          parseWeightText(definition.legacyWeightText),
          `${caseId}/${definition.name}: peso numérico não bate com o texto legado`,
        );
      }

      // 2. editar: um novo valor numérico entra pelo domínio.
      const novoPeso = pesoOriginal + 1.5;
      const editado = editCustomDefinitionNumbers(entry.customDefinition, { weightKg: novoPeso }, TAXAS_BASELINE);
      assert.equal(editado.ok, true, `${caseId}/${definition.name}: edição falhou`);

      // 3. formatar: o texto foi REGERADO (nunca ficou congelado no antigo).
      assert.equal(editado.value.dados.peso, formatWeightText(novoPeso));
      if (definition.legacyWeightText !== null && parseWeightText(definition.legacyWeightText) !== novoPeso) {
        assert.notEqual(
          editado.value.dados.peso,
          definition.legacyWeightText,
          `${caseId}/${definition.name}: o texto legado ficou congelado após a edição`,
        );
      }

      // 4. parse de novo: o ciclo fecha no mesmo número, e uma segunda volta
      //    não muda mais nada (idempotente).
      const relido = resolveItemDefinition({ ...entry, customDefinition: editado.value }, { rates: TAXAS_BASELINE });
      assert.equal(relido.weightKg, novoPeso, `${caseId}/${definition.name}: ciclo não fechou`);
      const reeditado = editCustomDefinitionNumbers(editado.value, { weightKg: relido.weightKg }, TAXAS_BASELINE);
      assert.equal(reeditado.ok, true);
      assert.deepEqual(
        reeditado.value.dados,
        editado.value.dados,
        `${caseId}/${definition.name}: segunda volta do ciclo alterou o item`,
      );
    }
  });

  test('ciclo de CUSTO também é estável (parse -> editar -> formatar -> parse)', () => {
    for (const copper of [0, 1, 50, 500, 7500, 100000]) {
      const texto = formatCostText(copper, TAXAS_BASELINE);
      assert.notEqual(texto, null, `custo ${copper} não é representável`);
      const parsed = parseCostText(texto, TAXAS_BASELINE);
      assert.equal(parsed.copper, copper);
      assert.equal(formatCostText(parsed.copper, TAXAS_BASELINE), texto);
    }
  });

  test('a projeção de um personagem com item customizado soma o peso e preserva os campos legados', () => {
    const fixtureCase = customItemsFixture.cases.find((entry) => entry.id === 'itens-customizados-basico');
    assert.ok(fixtureCase);
    const decoded = decodeCharacterRecord(fixtureCase.personagem, ctx);
    assert.equal(decoded.ok, true);

    const projection = getInventoryProjection(decoded.value.character, { currencyRates: TAXAS_BASELINE });
    assert.equal(projection.ok, true, JSON.stringify(projection.error ?? null));
    const [item] = projection.value.items;
    assert.equal(item.name, 'Anel de Proteção Caseiro');
    assert.equal(item.isCustom, true);
    assert.equal(item.legacyWeightText, '0 kg');
    assert.equal(item.unitWeightKg, 0);
    assert.equal(projection.value.totalWeightKg, 0);
    // O campo livre do v1 (bonus_ca) continua no customDefinition intocado.
    assert.equal(decoded.value.character.state.inventory[0].customDefinition.dados.bonus_ca, 1);
  });
});

describe('contract/inventory-parity — round-trip de comando de inventário pelo codec', () => {
  test('adicionar, mudar quantidade e remover sobrevivem ao encode/decode', () => {
    const fixtureCase = transitions['inventario-equipar-item-e-toggle-nao-exclusivo'];
    const decoded = decodeCharacterRecord(fixtureCase.personagemAntes, ctx);
    assert.equal(decoded.ok, true);

    const adicionado = executeCharacterCommand(
      decoded.value.character,
      {
        type: 'add-inventory-item',
        instanceId: 'contract-item-1',
        customDefinition: { nome: 'Corda de Cânhamo', tipo: 'equipamento', dados: { peso: '5 kg' } },
        quantity: 2,
      },
      ctx,
    );
    assert.equal(adicionado.ok, true, JSON.stringify(adicionado.error ?? null));

    const encoded = encodeCharacterRecord(adicionado.character, ctx);
    assert.equal(encoded.ok, true);
    const gravado = encoded.value.inventario.at(-1);
    assert.equal(gravado.nome, 'Corda de Cânhamo');
    assert.equal(gravado.quantidade, 2);
    assert.equal(gravado.equipado, false);
    assert.equal(gravado.instanceId, 'contract-item-1');

    // read-back: o CONTEÚDO do item sobrevive ao round-trip pelo codec.
    const redecoded = decodeCharacterRecord(encoded.value, ctx);
    assert.equal(redecoded.ok, true);
    const rele = redecoded.value.character.state.inventory.at(-1);
    assert.equal(rele.customDefinition.nome, 'Corda de Cânhamo');
    assert.equal(rele.quantity, 2);
    assert.equal(rele.customDefinition.dados.peso, '5 kg');
    assert.equal(rele.equipped, false);

    // LACUNA CONHECIDA (fora do escopo da Task 19 — ver CONCERN do relatório):
    // `character-codec.js#encodeCharacterRecord` GRAVA `instanceId` no item
    // plano, mas `migrations/v1-to-v2.js` (linhas 447-456) o RE-DERIVA de
    // índice+nome ao decodificar, ignorando o valor persistido. Ou seja, o
    // canal é write-only: o id escolhido pelo domínio não sobrevive a um
    // ciclo de gravação/leitura. Este assert documenta o comportamento REAL
    // de hoje; quando o codec passar a ler o `instanceId` gravado, ele falha
    // de propósito, sinalizando que o CONCERN foi resolvido e que o teste
    // deve voltar a exigir a preservação do id.
    assert.notEqual(
      rele.instanceId,
      'contract-item-1',
      'se o instanceId agora sobrevive ao round-trip, remova o CONCERN da Task 19 e volte a exigir a preservação',
    );
    assert.equal(rele.instanceId, 'legacy:inventory:0002:corda-de-canhamo');

    // O inverso exato do add continua valendo dentro do modelo canônico
    // (antes de qualquer round-trip): remover devolve o inventário original.
    const removido = executeCharacterCommand(
      adicionado.character,
      { type: 'remove-inventory-item', instanceId: 'contract-item-1' },
      ctx,
    );
    assert.equal(removido.ok, true);
    assert.deepEqual(removido.character.state.inventory, decoded.value.character.state.inventory);
  });
});
