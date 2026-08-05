// ============================================================
// Passo `equipamento` (Task 27).
//
// O ponto destes casos é a SEPARAÇÃO das quatro fatias: o que veio da opção
// inicial (`startingEquipmentSelection`/`startingCurrencyGrant`) e o que o
// jogador acrescentou à mão (`manualInventoryChanges`/`walletChanges`). Trocar
// a opção inicial mexe só no primeiro par; nenhum passo consegue mexer no
// segundo.
// ============================================================
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  EQUIPMENT_INTENT_TYPES,
  collectStartingSources,
  createEquipmentStep,
  describeStartingOption,
  readManualInventory,
  readWalletChanges,
} from '../../../site/js/features/creator/steps/equipment-step.js';
import { PLAYER_OWNED_SLICES, createCreatorDraft } from '../../../site/js/features/creator/creator-state.js';
import { clearedSlicesOf } from '../../../site/js/features/creator/creator-invalidation.js';
import { officialRegistry, draftWithCharacter, stepContext, qualifiedPicks, sourceIdOf } from '../../helpers/creator-steps.js';

const BARBARO = 'dnd2024:class:barbaro';
const MAGO = 'dnd2024:class:mago';
const ACOLITO = 'dnd2024:background:acolito';

let registry;
let step;

before(async () => {
  registry = await officialRegistry();
  const created = createEquipmentStep();
  assert.equal(created.ok, true, created.ok ? '' : created.error.code);
  step = created.value;
});

/**
 * Rascunho com classe (e opcionalmente antecedente) já escolhidos, com a
 * opção de equipamento inicial na fatia do passo DONO.
 * @param {{classId?: string, classOption?: string|null, backgroundId?: string|null, backgroundOption?: string|null}} [params]
 * @returns {object} draft
 */
function draftComOrigens({ classId = BARBARO, classOption = 'opcao-a', backgroundId = null, backgroundOption = null } = {}) {
  const slices = {
    classSelection: { contentId: classId, packageVersion: '1.0.0' },
    classChoices: classOption === null ? {} : qualifiedPicks('class', classId, { 'equipamento-inicial': [classOption] }),
  };
  let choices = { ...slices.classChoices };
  if (backgroundId !== null) {
    slices.backgroundSelection = { contentId: backgroundId, packageVersion: '1.0.0' };
    slices.backgroundEquipmentSelection =
      backgroundOption === null ? {} : qualifiedPicks('background', backgroundId, { 'equipamento-inicial': [backgroundOption] });
    choices = { ...choices, ...slices.backgroundEquipmentSelection };
  }
  const base = draftWithCharacter({ slices });
  // O personagem canônico já carrega as REFERÊNCIAS que os passos anteriores
  // gravaram — sem elas o motor de efeitos não enxergaria a classe e nenhum
  // `grant-item` seria materializado (é o estado real na chegada a este passo).
  const character = {
    ...base.character,
    build: {
      ...base.character.build,
      classRef: { id: classId, packageVersion: '1.0.0' },
      backgroundRef: backgroundId === null ? null : { id: backgroundId, packageVersion: '1.0.0' },
      choices,
    },
  };
  const criado = createCreatorDraft({ character, slices: base.slices, provenance: base.provenance });
  assert.equal(criado.ok, true);
  return criado.value;
}

/**
 * Carrega o step data para um rascunho.
 * @param {object} draft
 * @returns {Promise<object>}
 */
async function carregar(draft) {
  const loaded = await step.load(stepContext({ stepId: 'equipamento', draft, registry }));
  assert.equal(loaded.ok, true, loaded.ok ? '' : loaded.error.code);
  return loaded.value;
}

/**
 * Aplica uma intenção e devolve o rascunho resultante.
 * @param {object} draft
 * @param {object} data
 * @param {object} intent
 * @returns {object}
 */
function reduzir(draft, data, intent) {
  const resultado = step.reduce(stepContext({ stepId: 'equipamento', draft, data, registry }), intent);
  assert.equal(resultado.ok, true, resultado.ok ? '' : `${resultado.error.code}: ${resultado.error.message}`);
  return resultado.value.draft;
}

describe('passo equipamento: carga e opções ESTRUTURADAS', () => {
  test('load sem registry falha com erro nomeado', async () => {
    const resultado = await step.load(stepContext({ stepId: 'equipamento', draft: draftComOrigens(), registry: null }));
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_STEP_REGISTRY_MISSING');
  });

  test('as DOZE classes declaram opções de equipamento inicial com `grant-item` estruturado', () => {
    const classes = registry.list('class');
    assert.equal(classes.length, 12);
    for (const entity of classes) {
      const draft = draftComOrigens({ classId: entity.id, classOption: null });
      const sources = collectStartingSources(stepContext({ stepId: 'equipamento', draft, registry }));
      assert.equal(sources.length, 1, `${entity.id}: uma origem de classe`);
      assert.ok(sources[0].options.length >= 2, `${entity.id}: pelo menos duas opções`);
      assert.equal(sources[0].selectedOptionId, null);
      for (const option of sources[0].options) {
        for (const grant of option.itemGrants) {
          assert.match(grant.itemId, /^dnd2024:/, `${entity.id}/${option.id}: item por ContentId`);
          assert.ok(Number.isInteger(grant.quantity) && grant.quantity > 0);
        }
      }
    }
  });

  test('os DEZESSEIS antecedentes também entram como origem', () => {
    for (const entity of registry.list('background')) {
      const draft = draftComOrigens({ backgroundId: entity.id, backgroundOption: null });
      const sources = collectStartingSources(stepContext({ stepId: 'equipamento', draft, registry }));
      assert.equal(sources.length, 2, `${entity.id}: classe + antecedente`);
      assert.deepEqual(sources.map((source) => source.collection), ['class', 'background']);
    }
  });

  test('o step data COMPUTA (não fixa) a ausência de concessão estruturada de moeda/instrumento', async () => {
    const data = await carregar(draftComOrigens());
    assert.equal(data.structuredCurrencyGrants, false, 'o pacote oficial de hoje não declara nenhuma');
    assert.equal(data.structuredInstrumentChoices, false);
    assert.equal(data.currencyRates.pc, 1);
    assert.equal(data.currencyRates.po, 100);
    assert.ok(data.catalogItems.length > 0);
    // E a lacuna é LOCALIZADA: a opção B do Bárbaro promete "75 PO" no rótulo.
    const lacuna = data.contentGaps.find((entrada) => entrada.optionId === 'opcao-b');
    assert.notEqual(lacuna, undefined);
    assert.deepEqual([...lacuna.missing], ['currency']);
  });

  test('a varredura ENXERGA a concessão estruturada quando o conteúdo a declara', () => {
    // Prova que `structuredCurrencyGrants` é resultado de varredura e não uma
    // constante `false`: uma opção com `grant-currency` é reconhecida, e a
    // lacuna deixa de ser reportada.
    const comMoeda = describeStartingOption({
      id: 'opcao-x',
      label: '75 PO',
      grants: [{ type: 'grant-currency', denomination: 'po', quantity: 75 }],
    });
    assert.equal(comMoeda.currencyGrants.length, 1);
    assert.equal(comMoeda.promisesCurrency, true);
    assert.equal(comMoeda.currencyGapped, false, 'com concessão estruturada não há lacuna');

    const semMoeda = describeStartingOption({ id: 'opcao-y', label: '75 PO', grants: [] });
    assert.equal(semMoeda.currencyGapped, true);

    const comInstrumento = describeStartingOption({
      id: 'opcao-z',
      label: 'Um instrumento musical à sua escolha',
      grants: [{ type: 'choice', choice: { id: 'instrumento-musical', options: [] } }],
    });
    assert.deepEqual([...comInstrumento.nestedChoices], ['instrumento-musical']);
    assert.equal(comInstrumento.instrumentGapped, false);

    const semInstrumento = describeStartingOption({ id: 'opcao-w', label: 'Um instrumento musical à sua escolha', grants: [] });
    assert.equal(semInstrumento.instrumentGapped, true);
    // Rótulo sem promessa nenhuma não vira lacuna.
    assert.equal(describeStartingOption({ id: 'opcao-v', label: 'Machado Grande', grants: [] }).currencyGapped, false);
  });

  test('a lacuna aparece VISÍVEL no card, escapada', async () => {
    const draft = draftComOrigens();
    const data = await carregar(draft);
    const markup = step.render(stepContext({ stepId: 'equipamento', draft, data, registry }));
    assert.match(markup, /data-equip-lacuna="currency"/);
    assert.match(markup, /não é adicionada automaticamente/);
    assert.doesNotMatch(markup, /<script/i);
  });
});

describe('passo equipamento: validate', () => {
  test('exige opção escolhida em cada origem que a declara', async () => {
    const semOpcao = draftComOrigens({ classOption: null });
    const data = await carregar(semOpcao);
    const invalido = step.validate(stepContext({ stepId: 'equipamento', draft: semOpcao, data, registry }));
    assert.equal(invalido.valid, false);
    assert.deepEqual(invalido.errors.map((erro) => erro.code), ['CREATOR_EQUIPMENT_OPTION_REQUIRED']);

    const comOpcao = draftComOrigens({ classOption: 'opcao-a' });
    assert.equal(step.validate(stepContext({ stepId: 'equipamento', draft: comOpcao, data, registry })).valid, true);
  });

  test('classe E antecedente precisam ter opção', async () => {
    const draft = draftComOrigens({ classOption: 'opcao-a', backgroundId: ACOLITO, backgroundOption: null });
    const data = await carregar(draft);
    const resultado = step.validate(stepContext({ stepId: 'equipamento', draft, data, registry }));
    assert.equal(resultado.valid, false);
    assert.deepEqual(resultado.errors.map((erro) => erro.sourceInstanceId), [sourceIdOf('background', ACOLITO)]);
  });
});

describe('passo equipamento: opção inicial, itens e moedas', () => {
  test('escolher a opção materializa os itens com a proveniência da FONTE', async () => {
    const draft = draftComOrigens({ classOption: null });
    const data = await carregar(draft);
    const depois = reduzir(draft, data, {
      type: EQUIPMENT_INTENT_TYPES.startingOption,
      sourceInstanceId: sourceIdOf('class', BARBARO),
      optionId: 'opcao-a',
    });
    const inventario = depois.character.state.inventory;
    assert.ok(inventario.length > 0, 'a opção A do Bárbaro concede itens');
    assert.deepEqual(
      [...new Set(inventario.map((entrada) => entrada.sourceInstanceId))],
      [sourceIdOf('class', BARBARO)],
    );
    assert.equal(depois.slices.startingEquipmentSelection.sources[0].optionId, 'opcao-a');
    assert.deepEqual(
      [...depois.slices.startingEquipmentSelection.sources[0].itemInstanceIds],
      inventario.map((entrada) => entrada.instanceId),
    );
    // A ESCOLHA continua morando na fatia do passo dono.
    assert.deepEqual(depois.slices.classChoices, qualifiedPicks('class', BARBARO, { 'equipamento-inicial': ['opcao-a'] }));
  });

  test('uma opção inexistente é recusada com erro nomeado', async () => {
    const draft = draftComOrigens({ classOption: null });
    const data = await carregar(draft);
    const resultado = step.reduce(stepContext({ stepId: 'equipamento', draft, data, registry }), {
      type: EQUIPMENT_INTENT_TYPES.startingOption,
      sourceInstanceId: sourceIdOf('class', BARBARO),
      optionId: 'opcao-z',
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_EQUIPMENT_OPTION_UNKNOWN');
  });

  test('trocar a opção troca SÓ os itens daquela fonte', async () => {
    let draft = draftComOrigens({ classOption: null });
    const data = await carregar(draft);
    draft = reduzir(draft, data, {
      type: EQUIPMENT_INTENT_TYPES.startingOption,
      sourceInstanceId: sourceIdOf('class', BARBARO),
      optionId: 'opcao-a',
    });
    const antes = draft.character.state.inventory.length;
    assert.ok(antes > 0);

    draft = reduzir(draft, data, {
      type: EQUIPMENT_INTENT_TYPES.startingOption,
      sourceInstanceId: sourceIdOf('class', BARBARO),
      optionId: 'opcao-b',
    });
    assert.equal(draft.character.state.inventory.length, 0, 'a opção B do Bárbaro não concede item nenhum');
    assert.equal(draft.slices.startingEquipmentSelection.sources[0].optionId, 'opcao-b');
  });
});

describe('passo equipamento: inventário e carteira do JOGADOR', () => {
  test('item de catálogo e item CUSTOMIZADO entram sem proveniência e no ledger manual', async () => {
    let draft = draftComOrigens();
    const data = await carregar(draft);
    draft = reduzir(draft, data, {
      type: EQUIPMENT_INTENT_TYPES.addCatalogItem,
      contentId: data.catalogItems[0].id,
      quantity: 2,
    });
    draft = reduzir(draft, data, {
      type: EQUIPMENT_INTENT_TYPES.addCustomItem,
      name: 'Amuleto do Mestre',
      quantity: 1,
      weightText: '0,5 kg',
      costText: '25 PO',
    });

    const manual = readManualInventory(draft);
    assert.equal(manual.instanceIds.length, 2);
    assert.equal(manual.sequence, 2);
    for (const instanceId of manual.instanceIds) {
      const entrada = draft.character.state.inventory.find((item) => item.instanceId === instanceId);
      assert.equal(entrada.sourceInstanceId, null, 'item do jogador nunca tem proveniência de concessão');
    }
    const custom = draft.character.state.inventory.find((item) => item.customDefinition !== null);
    assert.equal(custom.customDefinition.nome, 'Amuleto do Mestre');
    assert.equal(custom.customDefinition.dados.custo, '25 PO');
  });

  test('um item customizado sem nome é recusado', async () => {
    const draft = draftComOrigens();
    const data = await carregar(draft);
    const resultado = step.reduce(stepContext({ stepId: 'equipamento', draft, data, registry }), {
      type: EQUIPMENT_INTENT_TYPES.addCustomItem,
      name: '   ',
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_EQUIPMENT_CUSTOM_NAME_REQUIRED');
  });

  test('quantidade, equipar e remover usam os comandos do domínio', async () => {
    let draft = draftComOrigens();
    const data = await carregar(draft);
    draft = reduzir(draft, data, { type: EQUIPMENT_INTENT_TYPES.addCustomItem, name: 'Corda', quantity: 1 });
    const instanceId = readManualInventory(draft).instanceIds[0];

    draft = reduzir(draft, data, { type: EQUIPMENT_INTENT_TYPES.changeQuantity, instanceId, delta: 3 });
    assert.equal(draft.character.state.inventory.find((item) => item.instanceId === instanceId).quantity, 4);

    draft = reduzir(draft, data, { type: EQUIPMENT_INTENT_TYPES.equip, instanceId, equipped: true });
    assert.equal(draft.character.state.inventory.find((item) => item.instanceId === instanceId).equipped, true);

    draft = reduzir(draft, data, { type: EQUIPMENT_INTENT_TYPES.remove, instanceId });
    assert.equal(draft.character.state.inventory.length, 0);
    assert.deepEqual([...readManualInventory(draft).instanceIds], []);
  });

  test('mover um item é uma PERMUTAÇÃO exata; fora do intervalo é recusado', async () => {
    let draft = draftComOrigens();
    const data = await carregar(draft);
    draft = reduzir(draft, data, { type: EQUIPMENT_INTENT_TYPES.addCustomItem, name: 'A' });
    draft = reduzir(draft, data, { type: EQUIPMENT_INTENT_TYPES.addCustomItem, name: 'B' });
    const [primeiro, segundo] = draft.character.state.inventory.map((item) => item.instanceId);

    draft = reduzir(draft, data, { type: EQUIPMENT_INTENT_TYPES.move, instanceId: segundo, direction: 'up' });
    assert.deepEqual(draft.character.state.inventory.map((item) => item.instanceId), [segundo, primeiro]);

    const fora = step.reduce(stepContext({ stepId: 'equipamento', draft, data, registry }), {
      type: EQUIPMENT_INTENT_TYPES.move,
      instanceId: segundo,
      direction: 'up',
    });
    assert.equal(fora.ok, false);
    assert.equal(fora.error.code, 'CREATOR_EQUIPMENT_MOVE_OUT_OF_RANGE');
  });

  test('a carteira do jogador é acumulada em `walletChanges` e projetada em `state.wallet`', async () => {
    let draft = draftComOrigens();
    const data = await carregar(draft);
    draft = reduzir(draft, data, { type: EQUIPMENT_INTENT_TYPES.wallet, operation: 'add', denomination: 'po', quantity: 12 });
    assert.equal(readWalletChanges(draft).copper, 1200);
    // A carteira é REDISTRIBUÍDA (menor número de moedas): 1200 cobre viram
    // 1 PL + 2 PO com a tabela do ruleset oficial.
    assert.deepEqual({ ...draft.character.state.wallet }, { pc: 0, pp: 0, pe: 0, po: 2, pl: 1 });

    draft = reduzir(draft, data, { type: EQUIPMENT_INTENT_TYPES.wallet, operation: 'remove', denomination: 'po', quantity: 2 });
    assert.equal(readWalletChanges(draft).copper, 1000);
    assert.deepEqual({ ...draft.character.state.wallet }, { pc: 0, pp: 0, pe: 0, po: 0, pl: 1 });
    assert.equal(readWalletChanges(draft).operations, 2);
  });

  test('o espelho da carteira inclui a CONCESSÃO inicial: o jogador consegue gastar o que vê', async () => {
    // Cenário futuro-prova: o dia em que o catálogo declarar a concessão de
    // moeda. O espelho precisa somar concessão + delta manual, senão o jogador
    // veria 50 PO na tela e receberia `WALLET_INSUFFICIENT_FUNDS` ao gastar.
    const base = draftComOrigens();
    const comConcessao = createCreatorDraft({
      character: base.character,
      slices: { ...base.slices, startingCurrencyGrant: { copper: 5000 } },
      provenance: base.provenance,
    });
    assert.equal(comConcessao.ok, true);
    const data = await carregar(comConcessao.value);

    const gasto = reduzir(comConcessao.value, data, {
      type: EQUIPMENT_INTENT_TYPES.wallet,
      operation: 'remove',
      denomination: 'po',
      quantity: 20,
    });
    // O total cai de 5000 para 3000 cobre; o que fica GRAVADO é o delta do
    // jogador, negativo, porque ele gastou parte da concessão.
    assert.equal(readWalletChanges(gasto).copper, -2000);
    assert.equal(gasto.character.state.wallet.pl, 3);
    // E acrescentar por cima volta a somar sobre o total visível.
    const somado = reduzir(gasto, data, { type: EQUIPMENT_INTENT_TYPES.wallet, operation: 'add', denomination: 'po', quantity: 10 });
    assert.equal(readWalletChanges(somado).copper, -1000);
    assert.equal(somado.character.state.wallet.pl, 4);
  });

  test('uma operação de carteira inválida é recusada pelo domínio', async () => {
    const draft = draftComOrigens();
    const data = await carregar(draft);
    const resultado = step.reduce(stepContext({ stepId: 'equipamento', draft, data, registry }), {
      type: EQUIPMENT_INTENT_TYPES.wallet,
      operation: 'remove',
      denomination: 'po',
      quantity: 5,
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'WALLET_INSUFFICIENT_FUNDS');
  });

  test('a projeção de CARGA responde ao que foi adicionado', async () => {
    let draft = draftComOrigens({ classOption: null });
    const data = await carregar(draft);
    const vazio = step.render(stepContext({ stepId: 'equipamento', draft, data, registry }));
    assert.match(vazio, /data-inv-peso="0"/);

    draft = reduzir(draft, data, {
      type: EQUIPMENT_INTENT_TYPES.startingOption,
      sourceInstanceId: sourceIdOf('class', BARBARO),
      optionId: 'opcao-a',
    });
    const cheio = step.render(stepContext({ stepId: 'equipamento', draft, data, registry }));
    assert.doesNotMatch(cheio, /data-inv-peso="0"/, 'o equipamento inicial do Bárbaro tem peso');
    assert.match(cheio, /data-inv-sobrecarga="(true|false)"/);
  });
});

describe('passo equipamento: troca de opção PRESERVA o que é do jogador', () => {
  test('item customizado e moedas manuais sobrevivem à troca da opção inicial', async () => {
    let draft = draftComOrigens({ classOption: null });
    const data = await carregar(draft);
    draft = reduzir(draft, data, {
      type: EQUIPMENT_INTENT_TYPES.startingOption,
      sourceInstanceId: sourceIdOf('class', BARBARO),
      optionId: 'opcao-a',
    });
    draft = reduzir(draft, data, { type: EQUIPMENT_INTENT_TYPES.addCustomItem, name: 'Diário de Bordo', quantity: 1 });
    draft = reduzir(draft, data, { type: EQUIPMENT_INTENT_TYPES.wallet, operation: 'add', denomination: 'po', quantity: 30 });
    const manualId = readManualInventory(draft).instanceIds[0];

    draft = reduzir(draft, data, {
      type: EQUIPMENT_INTENT_TYPES.startingOption,
      sourceInstanceId: sourceIdOf('class', BARBARO),
      optionId: 'opcao-b',
    });

    assert.ok(
      draft.character.state.inventory.some((item) => item.instanceId === manualId),
      'o item comprado à mão não pode sair junto com a opção substituída',
    );
    assert.equal(draft.character.state.inventory.filter((item) => item.sourceInstanceId !== null).length, 0);
    assert.equal(readWalletChanges(draft).copper, 3000);
    assert.deepEqual({ ...draft.character.state.wallet }, { pc: 0, pp: 0, pe: 0, po: 0, pl: 3 });
  });
});

describe('passo equipamento: invalidate', () => {
  test('limpa só a seleção inicial e a concessão de moedas; as fatias do jogador ficam', () => {
    const draft = draftComOrigens();
    const patch = step.invalidate(stepContext({ stepId: 'equipamento', draft, registry }));
    assert.equal(patch.ok, true);
    assert.deepEqual([...patch.value.clearedStepIds], []);
    assert.deepEqual([...clearedSlicesOf(patch.value)], ['startingEquipmentSelection', 'startingCurrencyGrant']);
    for (const slice of PLAYER_OWNED_SLICES) {
      assert.ok(patch.value.preservedSlices.includes(slice));
    }
  });

  test('o `invalidation` do reduce declara as fatias do jogador como preservadas', async () => {
    const draft = draftComOrigens();
    const data = await carregar(draft);
    const resultado = step.reduce(stepContext({ stepId: 'equipamento', draft, data, registry }), {
      type: EQUIPMENT_INTENT_TYPES.addCustomItem,
      name: 'Tocha',
    });
    assert.equal(resultado.ok, true);
    for (const slice of [...PLAYER_OWNED_SLICES, 'startingEquipmentSelection', 'startingCurrencyGrant']) {
      assert.ok(resultado.value.invalidation.preservedSlices.includes(slice), `${slice} precisa estar preservada`);
    }
  });

  test('uma intenção de outro dono não mexe no rascunho', () => {
    const draft = draftComOrigens();
    const resultado = step.reduce(stepContext({ stepId: 'equipamento', draft, registry }), { type: 'creator/transaction-committed' });
    assert.equal(resultado.ok, true);
    assert.equal(resultado.value.draft, draft);
    assert.equal(resultado.value.invalidation, undefined);
  });
});

describe('passo equipamento: o Mago também tem opções (paridade multi-classe)', () => {
  test('a mesma mecânica vale para outra classe, sem código específico', async () => {
    let draft = draftComOrigens({ classId: MAGO, classOption: null });
    const data = await carregar(draft);
    draft = reduzir(draft, data, {
      type: EQUIPMENT_INTENT_TYPES.startingOption,
      sourceInstanceId: sourceIdOf('class', MAGO),
      optionId: 'opcao-a',
    });
    assert.ok(draft.character.state.inventory.length > 0);
    assert.deepEqual(
      [...new Set(draft.character.state.inventory.map((entrada) => entrada.sourceInstanceId))],
      [sourceIdOf('class', MAGO)],
    );
  });
});
