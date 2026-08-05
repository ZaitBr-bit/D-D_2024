// ============================================================
// Integração dos passos `atributos` e `equipamento` (Task 27), sobre o catálogo
// OFICIAL e uma `CreatorSession` de verdade.
//
// O que estes casos provam, e que os testes de unidade não provam:
//
//  1. O wizard ATRAVESSA os cinco passos migrados de ponta a ponta, com a
//     validação real de cada um.
//  2. Os três métodos ATIVOS de atributos funcionam dentro da sessão, com RNG
//     injetado — e o modo manual continua visível e desabilitado.
//  3. Trocar a OPÇÃO de equipamento inicial preserva o item comprado à mão e as
//     moedas da carteira.
//  4. O caso mais amplo da matriz da Task 25: comprar item customizado + mexer
//     na carteira e depois trocar de CLASSE INTEIRA. `manualInventoryChanges` e
//     `walletChanges` sobrevivem intactos; só `startingEquipmentSelection`/
//     `startingCurrencyGrant` são limpos.
//  5. Voltar do passo de equipamento NÃO revoga as concessões da classe (a
//     assimetria que uma proveniência mal atribuída produziria).
// ============================================================
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { createCreatorSession } from '../../site/js/features/creator/creator-session.js';
import { CREATOR_INTENT_TYPES } from '../../site/js/features/creator/creator-intents.js';
import { createCreatorDraft, PLAYER_OWNED_SLICES } from '../../site/js/features/creator/creator-state.js';
import { selectionTransactionId } from '../../site/js/features/creator/steps/catalog-selection-step.js';
import { ABILITIES_INTENT_TYPES } from '../../site/js/features/creator/steps/abilities-step.js';
import { EQUIPMENT_INTENT_TYPES, readManualInventory, readWalletChanges } from '../../site/js/features/creator/steps/equipment-step.js';
import { ABILITY_KEYS } from '../../site/js/domain/character/queries/index.js';
import {
  officialRegistry,
  emptyCharacter,
  fullStepRegistry,
  qualifiedPicks,
  sourceIdOf,
  sequenceRng,
} from '../helpers/creator-steps.js';

const BARBARO = 'dnd2024:class:barbaro';
const MAGO = 'dnd2024:class:mago';
const ANAO = 'dnd2024:species:anao';
const ANDARILHO = 'dnd2024:background:andarilho';
const FONTE_BARBARO = sourceIdOf('class', BARBARO);
const FONTE_MAGO = sourceIdOf('class', MAGO);

let registry;

before(async () => {
  registry = await officialRegistry();
});

/**
 * Cria uma sessão com os cinco passos reais mais os dois placeholders.
 * @param {{rng?: object}} [params]
 * @returns {object} CreatorSession
 */
function criarSessao({ rng = null } = {}) {
  const draft = createCreatorDraft({ character: emptyCharacter() });
  assert.equal(draft.ok, true);
  return createCreatorSession({ draft: draft.value, registry, stepRegistry: fullStepRegistry(), rng });
}

/**
 * Confirma uma seleção de catálogo (abrir, encenar, confirmar).
 * @param {object} session
 * @param {string} stepId
 * @param {string} contentId
 * @param {object} escolhas
 * @returns {Promise<object>}
 */
async function confirmar(session, stepId, contentId, escolhas) {
  const transactionId = selectionTransactionId(stepId, contentId);
  assert.equal((await session.dispatch({ type: CREATOR_INTENT_TYPES.modalBegin, transactionId })).ok, true);
  for (const [slice, valor] of Object.entries(escolhas)) {
    assert.equal((await session.dispatch({ type: CREATOR_INTENT_TYPES.modalUpdate, transactionId, slices: { [slice]: valor } })).ok, true);
  }
  return session.dispatch({ type: CREATOR_INTENT_TYPES.modalCommit, transactionId });
}

/** Escolhas mínimas do Bárbaro. */
const ESCOLHAS_BARBARO = Object.freeze({
  classSkills: qualifiedPicks('class', BARBARO, { 'pericias-de-classe': ['atletismo', 'intimidacao'] }),
  classChoices: qualifiedPicks('class', BARBARO, { 'equipamento-inicial': ['opcao-a'] }),
});

/** Escolhas mínimas do Mago. */
const ESCOLHAS_MAGO = Object.freeze({
  classSkills: qualifiedPicks('class', MAGO, { 'pericias-de-classe': ['arcanismo', 'historia'] }),
  classChoices: qualifiedPicks('class', MAGO, { 'equipamento-inicial': ['opcao-a'] }),
});

/** Escolhas mínimas do Andarilho. */
const ESCOLHAS_ANDARILHO = Object.freeze({
  backgroundAbilityBonus: qualifiedPicks('background', ANDARILHO, { 'bonus-de-atributo': ['destreza-mais2-sabedoria-mais1'] }),
  backgroundEquipmentSelection: qualifiedPicks('background', ANDARILHO, { 'equipamento-inicial': ['opcao-a'] }),
  backgroundSkills: qualifiedPicks('background', ANDARILHO, { 'idiomas-adicionais': ['anao', 'elfico'] }),
});

/**
 * Leva a sessão até o passo `atributos`, com classe, espécie e antecedente
 * confirmados.
 * @param {object} session
 * @param {{classId?: string, escolhasClasse?: object}} [params]
 * @returns {Promise<void>}
 */
async function ateAtributos(session, { classId = BARBARO, escolhasClasse = ESCOLHAS_BARBARO } = {}) {
  assert.equal((await session.initialize()).ok, true);
  assert.equal((await confirmar(session, 'classe', classId, escolhasClasse)).ok, true);
  assert.equal((await session.next()).ok, true);
  assert.equal((await confirmar(session, 'especie', ANAO, {})).ok, true);
  assert.equal((await session.next()).ok, true);
  assert.equal((await confirmar(session, 'antecedente', ANDARILHO, ESCOLHAS_ANDARILHO)).ok, true);
  assert.equal((await session.next()).ok, true);
  assert.equal(session.getSnapshot().currentStepId, 'atributos');
}

/**
 * Distribui o conjunto padrão inteiro (um valor por atributo, na ordem).
 * @param {object} session
 * @returns {Promise<void>}
 */
async function distribuirConjuntoPadrao(session) {
  assert.equal((await session.dispatch({ type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'standard' })).ok, true);
  for (const [index, key] of ABILITY_KEYS.entries()) {
    assert.equal((await session.dispatch({ type: ABILITIES_INTENT_TYPES.assignStandard, abilityKey: key, index })).ok, true);
  }
}

describe('travessia completa dos cinco passos migrados', () => {
  test('classe -> espécie -> antecedente -> atributos -> equipamento, com validação real', async () => {
    const session = criarSessao();
    await ateAtributos(session);

    // O passo de atributos chega INVÁLIDO: nada distribuído ainda.
    assert.equal(session.getSnapshot().validation.valid, false);
    assert.equal((await session.next()).ok, false, 'avançar sem distribuir é recusado');

    await distribuirConjuntoPadrao(session);
    assert.equal(session.getSnapshot().validation.valid, true);
    assert.equal((await session.next()).ok, true);
    assert.equal(session.getSnapshot().currentStepId, 'equipamento');

    // O equipamento já chega VÁLIDO: a opção inicial foi escolhida no modal da
    // classe e a do antecedente no modal do antecedente.
    assert.equal(session.getSnapshot().validation.valid, true);
    session.dispose();
  });

  test('o passo de equipamento chega INVÁLIDO quando a classe não teve opção escolhida', async () => {
    const session = criarSessao();
    assert.equal((await session.initialize()).ok, true);
    // Confirma o Bárbaro só com as perícias: sem `equipamento-inicial`, o
    // próprio passo `classe` já recusa avançar.
    assert.equal(
      (await confirmar(session, 'classe', BARBARO, { classSkills: ESCOLHAS_BARBARO.classSkills })).ok,
      true,
    );
    assert.equal(session.getSnapshot().validation.valid, false);
    assert.equal((await session.next()).ok, false);
    session.dispose();
  });
});

describe('os três métodos ATIVOS de atributos, dentro da sessão', () => {
  test('conjunto padrão: sem reutilização e com o bônus de origem no derivado', async () => {
    const session = criarSessao();
    await ateAtributos(session);
    await distribuirConjuntoPadrao(session);

    const draft = session.getSnapshot().draft;
    assert.deepEqual(
      { ...draft.character.state.abilities },
      { forca: 15, destreza: 14, constituicao: 13, inteligencia: 12, sabedoria: 10, carisma: 8 },
    );
    // O Andarilho escolheu Destreza +2 / Sabedoria +1.
    assert.equal(draft.slices.derivedStats.abilities.destreza.total, 16);
    assert.equal(draft.slices.derivedStats.abilities.sabedoria.total, 11);
    assert.equal(draft.slices.derivedStats.backgroundBonusShape, '+2/+1');
    session.dispose();
  });

  test('compra de pontos: 27 pontos exatos tornam o passo válido', async () => {
    const session = criarSessao();
    await ateAtributos(session);
    assert.equal((await session.dispatch({ type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'pointbuy' })).ok, true);
    assert.equal(session.getSnapshot().validation.valid, false);

    for (const key of ['forca', 'destreza', 'constituicao']) {
      for (let passo = 0; passo < 7; passo += 1) {
        assert.equal((await session.dispatch({ type: ABILITIES_INTENT_TYPES.pointBuy, abilityKey: key, delta: 1 })).ok, true);
      }
    }
    assert.equal(session.getSnapshot().validation.valid, true);
    assert.equal(session.getSnapshot().draft.character.build.abilityGeneration.method, 'pointbuy');
    session.dispose();
  });

  test('rolagem 4d6: usa o RNG INJETADO na sessão, nunca Math.random()', async () => {
    const semRng = criarSessao();
    await ateAtributos(semRng);
    assert.equal((await semRng.dispatch({ type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'rolagem' })).ok, true);
    const recusado = await semRng.dispatch({ type: ABILITIES_INTENT_TYPES.roll, abilityKey: null });
    assert.equal(recusado.ok, false);
    assert.equal(recusado.error.code, 'CREATOR_ABILITIES_RNG_MISSING');
    semRng.dispose();

    // Faces 6, 1, 4, 5 -> descarta o 1, total 15, em todos os atributos.
    const rng = sequenceRng([5 / 6 + 0.01, 0.01, 3 / 6 + 0.01, 4 / 6 + 0.01]);
    const session = criarSessao({ rng });
    await ateAtributos(session);
    assert.equal((await session.dispatch({ type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'rolagem' })).ok, true);
    assert.equal((await session.dispatch({ type: ABILITIES_INTENT_TYPES.roll, abilityKey: null })).ok, true);

    const draft = session.getSnapshot().draft;
    assert.deepEqual({ ...draft.character.state.abilities }, Object.fromEntries(ABILITY_KEYS.map((key) => [key, 15])));
    assert.equal(draft.character.build.abilityGeneration.method, 'rolled');
    assert.equal(rng.calls(), 24, 'quatro dados por atributo, seis atributos');
    assert.equal(session.getSnapshot().validation.valid, true);
    session.dispose();
  });

  test('o modo MANUAL segue visível, desabilitado e não despachável', async () => {
    const session = criarSessao();
    await ateAtributos(session);
    const markup = fullStepRegistry().get('atributos').render(session.getStepContext('atributos'));
    assert.match(markup, /data-attr-mode="manual"[^>]*disabled/, 'o rádio manual continua no markup');

    const recusado = await session.dispatch({ type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'manual' });
    assert.equal(recusado.ok, false);
    assert.equal(recusado.error.code, 'CREATOR_ABILITIES_METHOD_DISABLED');
    assert.equal(session.getSnapshot().draft.slices.abilityScores, null, 'nada foi gravado pela tentativa');
    session.dispose();
  });

  test('mudar atributos NÃO invalida escolha nenhuma de outro passo', async () => {
    const session = criarSessao();
    await ateAtributos(session);
    const antes = session.getSnapshot().draft;
    await distribuirConjuntoPadrao(session);
    const depois = session.getSnapshot().draft;

    assert.deepEqual(depois.slices.classSkills, antes.slices.classSkills);
    assert.deepEqual(depois.slices.backgroundSkills, antes.slices.backgroundSkills);
    assert.deepEqual(depois.slices.classChoices, antes.slices.classChoices);
    assert.deepEqual(
      depois.character.state.inventory.map((item) => item.instanceId),
      antes.character.state.inventory.map((item) => item.instanceId),
      'o equipamento inicial não é tocado por uma distribuição de atributos',
    );
    session.dispose();
  });
});

describe('equipamento: o que é do JOGADOR sobrevive', () => {
  /**
   * Leva até o passo de equipamento, compra um item customizado e põe moedas.
   * @param {object} session
   * @returns {Promise<{manualId: string}>}
   */
  async function ateEquipamentoComCompras(session) {
    await ateAtributos(session);
    await distribuirConjuntoPadrao(session);
    assert.equal((await session.next()).ok, true);
    assert.equal(
      (
        await session.dispatch({
          type: EQUIPMENT_INTENT_TYPES.addCustomItem,
          name: 'Amuleto de Família',
          quantity: 1,
          costText: '25 PO',
        })
      ).ok,
      true,
    );
    assert.equal(
      (await session.dispatch({ type: EQUIPMENT_INTENT_TYPES.wallet, operation: 'add', denomination: 'po', quantity: 42 })).ok,
      true,
    );
    const manual = readManualInventory(session.getSnapshot().draft);
    assert.equal(manual.instanceIds.length, 1);
    assert.equal(readWalletChanges(session.getSnapshot().draft).copper, 4200);
    return { manualId: manual.instanceIds[0] };
  }

  test('trocar a OPÇÃO inicial dentro da mesma classe preserva item e moedas do jogador', async () => {
    const session = criarSessao();
    const { manualId } = await ateEquipamentoComCompras(session);
    const itensIniciais = session
      .getSnapshot()
      .draft.character.state.inventory.filter((item) => item.sourceInstanceId === FONTE_BARBARO).length;
    assert.ok(itensIniciais > 0);

    assert.equal(
      (
        await session.dispatch({
          type: EQUIPMENT_INTENT_TYPES.startingOption,
          sourceInstanceId: FONTE_BARBARO,
          optionId: 'opcao-b',
        })
      ).ok,
      true,
    );

    const draft = session.getSnapshot().draft;
    assert.equal(
      draft.character.state.inventory.filter((item) => item.sourceInstanceId === FONTE_BARBARO).length,
      0,
      'a opção B do Bárbaro não concede item',
    );
    assert.ok(draft.character.state.inventory.some((item) => item.instanceId === manualId), 'o item do jogador fica');
    assert.equal(readWalletChanges(draft).copper, 4200);
    // E as PERÍCIAS da classe continuam lá: reconfirmar a opção da MESMA fonte
    // não pode revogar a fonte que acabou de escrever.
    const pericias = draft.character.state.activeEffects
      .filter((e) => e.sourceInstanceId === FONTE_BARBARO && e.data?.kind === 'proficiency' && String(e.data.id).startsWith('dnd2024:skill:'))
      .map((e) => e.data.id)
      .sort();
    assert.deepEqual(pericias, ['dnd2024:skill:atletismo', 'dnd2024:skill:intimidacao']);
    session.dispose();
  });

  test('TROCAR DE CLASSE INTEIRA preserva `manualInventoryChanges` e `walletChanges`', async () => {
    const session = criarSessao();
    const { manualId } = await ateEquipamentoComCompras(session);
    const manualAntes = readManualInventory(session.getSnapshot().draft);
    const carteiraAntes = readWalletChanges(session.getSnapshot().draft);
    assert.notEqual(session.getSnapshot().draft.slices.startingEquipmentSelection, null);

    // Volta ao primeiro passo e troca de classe DE VERDADE.
    assert.equal(session.dispatch === undefined, false);
    assert.equal((await session.dispatch({ type: CREATOR_INTENT_TYPES.goToVisited, stepId: 'classe' })).ok, true);
    assert.equal(session.getSnapshot().currentStepId, 'classe');
    assert.equal((await confirmar(session, 'classe', MAGO, ESCOLHAS_MAGO)).ok, true);

    const draft = session.getSnapshot().draft;
    // (1) As fatias do JOGADOR sobrevivem intactas.
    assert.deepEqual(readManualInventory(draft), manualAntes);
    assert.deepEqual(readWalletChanges(draft), carteiraAntes);
    assert.ok(draft.character.state.inventory.some((item) => item.instanceId === manualId), 'o item customizado fica');
    // (2) Só as fatias do PASSO de equipamento foram limpas.
    assert.equal(draft.slices.startingEquipmentSelection, null);
    assert.equal(draft.slices.startingCurrencyGrant, null);
    // (3) Nenhuma concessão do Bárbaro sobrou; as do Mago entraram.
    const fontes = [...new Set(draft.character.state.inventory.map((item) => item.sourceInstanceId).filter(Boolean))];
    assert.ok(!fontes.includes(FONTE_BARBARO), 'nada do Bárbaro sobrevive');
    assert.ok(fontes.includes(FONTE_MAGO), 'o Mago concedeu o equipamento da opção A');
    // (4) A carteira do personagem continua com o dinheiro do jogador.
    assert.equal(draft.character.state.wallet.pl * 1000 + draft.character.state.wallet.po * 100, 4200);
    session.dispose();
  });

  test('a matriz recusa, na raiz, qualquer patch que tentasse limpar fatia do jogador', async () => {
    const session = criarSessao();
    await ateEquipamentoComCompras(session);
    const passo = fullStepRegistry().get('equipamento');
    const patch = passo.invalidate(session.getStepContext('equipamento'));
    assert.equal(patch.ok, true);
    for (const slice of PLAYER_OWNED_SLICES) {
      assert.ok(patch.value.preservedSlices.includes(slice), `${slice} precisa estar preservada`);
    }
    session.dispose();
  });

  test('VOLTAR do passo de equipamento não revoga as concessões da classe', async () => {
    const session = criarSessao();
    const { manualId } = await ateEquipamentoComCompras(session);
    const inventarioAntes = session.getSnapshot().draft.character.state.inventory.map((item) => item.instanceId);

    assert.equal(session.previous().ok, true);
    assert.equal(session.getSnapshot().currentStepId, 'atributos');

    const draft = session.getSnapshot().draft;
    assert.deepEqual(
      draft.character.state.inventory.map((item) => item.instanceId),
      inventarioAntes,
      'voltar não pode tirar o equipamento inicial nem o item do jogador',
    );
    assert.ok(draft.character.state.inventory.some((item) => item.instanceId === manualId));
    const pericias = draft.character.state.activeEffects
      .filter((e) => e.sourceInstanceId === FONTE_BARBARO && e.data?.kind === 'proficiency' && String(e.data.id).startsWith('dnd2024:skill:'))
      .map((e) => e.data.id)
      .sort();
    assert.deepEqual(pericias, ['dnd2024:skill:atletismo', 'dnd2024:skill:intimidacao'], 'as perícias de classe ficam');
    // A fatia de REGISTRO é limpa (é do passo), mas o que ela registrava não.
    assert.equal(draft.slices.startingEquipmentSelection, null);
    assert.deepEqual(readManualInventory(draft).instanceIds.length, 1);
    session.dispose();
  });
});

describe('equipamento: o inventário e a carga usam o domínio da Task 19', () => {
  test('adicionar item de catálogo, mudar quantidade, equipar e reordenar', async () => {
    const session = criarSessao();
    await ateAtributos(session);
    await distribuirConjuntoPadrao(session);
    assert.equal((await session.next()).ok, true);

    assert.equal(
      (await session.dispatch({ type: EQUIPMENT_INTENT_TYPES.addCatalogItem, contentId: 'dnd2024:weapon:adaga', quantity: 2 })).ok,
      true,
    );
    const manualId = readManualInventory(session.getSnapshot().draft).instanceIds[0];
    const entrada = () => session.getSnapshot().draft.character.state.inventory.find((item) => item.instanceId === manualId);
    assert.equal(entrada().quantity, 2);
    assert.equal(entrada().itemRef.id, 'dnd2024:weapon:adaga');
    assert.equal(entrada().sourceInstanceId, null);

    assert.equal((await session.dispatch({ type: EQUIPMENT_INTENT_TYPES.changeQuantity, instanceId: manualId, delta: 3 })).ok, true);
    assert.equal(entrada().quantity, 5);
    assert.equal((await session.dispatch({ type: EQUIPMENT_INTENT_TYPES.equip, instanceId: manualId, equipped: true })).ok, true);
    assert.equal(entrada().equipped, true);

    const ordemAntes = session.getSnapshot().draft.character.state.inventory.map((item) => item.instanceId);
    assert.equal((await session.dispatch({ type: EQUIPMENT_INTENT_TYPES.move, instanceId: manualId, direction: 'up' })).ok, true);
    const ordemDepois = session.getSnapshot().draft.character.state.inventory.map((item) => item.instanceId);
    assert.deepEqual([...ordemDepois].sort(), [...ordemAntes].sort(), 'reordenar é uma PERMUTAÇÃO exata');
    assert.notDeepEqual(ordemDepois, ordemAntes);
    session.dispose();
  });

  test('remover o item do jogador o tira do inventário e do ledger manual', async () => {
    const session = criarSessao();
    await ateAtributos(session);
    await distribuirConjuntoPadrao(session);
    assert.equal((await session.next()).ok, true);
    assert.equal((await session.dispatch({ type: EQUIPMENT_INTENT_TYPES.addCustomItem, name: 'Corda de Seda' })).ok, true);
    const manualId = readManualInventory(session.getSnapshot().draft).instanceIds[0];

    assert.equal((await session.dispatch({ type: EQUIPMENT_INTENT_TYPES.remove, instanceId: manualId })).ok, true);
    const draft = session.getSnapshot().draft;
    assert.equal(draft.character.state.inventory.some((item) => item.instanceId === manualId), false);
    assert.deepEqual([...readManualInventory(draft).instanceIds], []);
    session.dispose();
  });
});
