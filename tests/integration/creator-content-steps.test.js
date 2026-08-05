// ============================================================
// Integração dos passos de conteúdo do criador (Task 26): classe, espécie e
// antecedente, sobre o catálogo OFICIAL e uma `CreatorSession` de verdade.
//
// O que estes casos provam, e que nenhum teste de unidade isolada prova:
//
//  1. FIDELIDADE: o markup dos três passos tem a mesma estrutura semântica,
//     os mesmos textos, as mesmas classes e a mesma ordem do baseline
//     congelado na Task 3 (`tests/fixtures/dom-baseline/creator-steps.json`),
//     sem nenhum wrapper visual novo.
//  2. TRANSAÇÃO: escolher dentro do modal não muda nada; cancelar não muda
//     nada; só confirmar muda — e confirmar aplica as concessões.
//  3. SIMETRIA: trocar de seleção revoga EXATAMENTE as concessões da seleção
//     substituída — nem as de outra fonte, nem o que o jogador acrescentou à
//     mão.
//  4. PRESERVAÇÃO: `manualInventoryChanges` e `walletChanges` sobrevivem a uma
//     troca COMPLETA de classe.
//  5. SEGURANÇA: conteúdo hostil de catálogo passando pelo `render` dos três
//     passos nunca sai cru.
// ============================================================
import { test, describe, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTestDom } from '../helpers/test-dom.js';
import { createCreatorSession } from '../../site/js/features/creator/creator-session.js';
import { CREATOR_INTENT_TYPES } from '../../site/js/features/creator/creator-intents.js';
import { createCreatorDraft, PLAYER_OWNED_SLICES } from '../../site/js/features/creator/creator-state.js';
import { createClassStep } from '../../site/js/features/creator/steps/class-step.js';
import { createSpeciesStep } from '../../site/js/features/creator/steps/species-step.js';
import { createBackgroundStep } from '../../site/js/features/creator/steps/background-step.js';
import { selectionTransactionId } from '../../site/js/features/creator/steps/catalog-selection-step.js';
import {
  officialRegistry,
  emptyCharacter,
  fullStepRegistry,
  stepContext,
  loadStepData,
  qualifiedPicks,
  sourceIdOf,
} from '../helpers/creator-steps.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const BASELINE = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests/fixtures/dom-baseline/creator-steps.json'), 'utf8'));

const BARBARO = 'dnd2024:class:barbaro';
const MAGO = 'dnd2024:class:mago';
const FONTE_BARBARO = 'source:class:0000:dnd2024-class-barbaro';
const FONTE_MAGO = 'source:class:0000:dnd2024-class-mago';

let registry;
let dom;

before(async () => {
  registry = await officialRegistry();
});

beforeEach(() => {
  dom = createTestDom();
});

afterEach(() => {
  dom.restore();
});

// --- Normalização para comparar com o oráculo de DOM ----------------------

/**
 * Reduz um nó a `{tag, classes, text, children}` — exatamente os eixos que o
 * checklist manda comparar (HTML semântico, textos, classes e ordem). Os
 * ATRIBUTOS ficam de fora desta comparação porque o passo novo acrescenta
 * `data-content-id` (a identidade mecânica que o legado não tinha); o atributo
 * do baseline é conferido à parte, em teste próprio.
 * @param {object} node
 * @returns {object|null}
 */
function normalizar(node) {
  if (node.nodeType === 3) {
    const texto = node.textContent.replace(/\s+/g, ' ').trim();
    return texto ? { text: texto } : null;
  }
  if (node.nodeType !== 1) {
    return null;
  }
  return {
    tag: node.tagName.toLowerCase(),
    classes: [...node.classList].sort(),
    children: [...node.childNodes].map(normalizar).filter(Boolean),
  };
}

/**
 * Mesma redução, aplicada a um nó do oráculo gravado.
 * @param {object} node
 * @returns {object}
 */
function normalizarOraculo(node) {
  if (node.text !== undefined) {
    return { text: node.text };
  }
  return {
    tag: node.tag,
    classes: [...node.classes].sort(),
    children: node.children.map(normalizarOraculo),
  };
}

/**
 * Renderiza um passo num container e devolve o elemento raiz.
 * @param {object} step
 * @param {object} data
 * @param {object} draft
 * @returns {object}
 */
function renderizar(step, data, draft) {
  const container = dom.document.createElement('div');
  container.className = 'wizard-content-area';
  container.id = 'wizard-content';
  container.innerHTML = step.render(stepContext({ stepId: step.id, draft, data, registry, root: container }));
  dom.document.body.appendChild(container);
  return container;
}

describe('fidelidade de DOM dos três passos contra o baseline da Task 3', () => {
  for (const [stepId, criar, atributoLegado] of [
    ['classe', createClassStep, 'data-classe'],
    ['especie', createSpeciesStep, 'data-especie'],
    ['antecedente', createBackgroundStep, 'data-antecedente'],
  ]) {
    test(`o passo "${stepId}" tem a mesma estrutura, textos, classes e ordem do oráculo`, async () => {
      const step = criar().value;
      const draft = createCreatorDraft({ character: emptyCharacter() }).value;
      const loaded = await step.load(stepContext({ stepId, draft, registry }));
      assert.equal(loaded.ok, true, loaded.ok ? '' : loaded.error.code);
      const container = renderizar(step, loaded.value, draft);

      const obtido = normalizar(container).children;
      const esperado = BASELINE[stepId].children.map(normalizarOraculo);
      assert.deepEqual(obtido, esperado);
    });

    test(`o passo "${stepId}" preserva o atributo "${atributoLegado}" do baseline, com o mesmo valor e ordem`, async () => {
      const step = criar().value;
      const draft = createCreatorDraft({ character: emptyCharacter() }).value;
      const loaded = await step.load(stepContext({ stepId, draft, registry }));
      const container = renderizar(step, loaded.value, draft);

      const obtidos = [...container.querySelectorAll(`[${atributoLegado}]`)].map((card) => card.getAttribute(atributoLegado));
      const esperados = [];
      /** Percorre o oráculo colhendo os valores do atributo legado. */
      const colher = (node) => {
        if (node.text !== undefined) {
          return;
        }
        if (node.attrs?.[atributoLegado] !== undefined) {
          esperados.push(node.attrs[atributoLegado]);
        }
        node.children.forEach(colher);
      };
      colher(BASELINE[stepId]);
      assert.deepEqual(obtidos, esperados);
    });
  }

  test('nenhum dos três passos acrescenta wrapper visual ao redor do conteúdo', async () => {
    for (const [stepId, criar] of [['classe', createClassStep], ['especie', createSpeciesStep], ['antecedente', createBackgroundStep]]) {
      const step = criar().value;
      const draft = createCreatorDraft({ character: emptyCharacter() }).value;
      const loaded = await step.load(stepContext({ stepId, draft, registry }));
      const container = renderizar(step, loaded.value, draft);
      assert.equal(
        container.children.length,
        BASELINE[stepId].children.filter((filho) => filho.text === undefined).length,
        `o passo "${stepId}" tem o mesmo número de filhos de primeiro nível do oráculo`,
      );
    }
  });
});

// --- Sessão de verdade ----------------------------------------------------

/**
 * Cria uma sessão com os três passos reais e os quatro placeholders.
 * @param {{slices?: object, provenance?: object, character?: object}} [params]
 * @returns {object}
 */
function criarSessao({ slices = {}, provenance = {}, character = emptyCharacter() } = {}) {
  const draft = createCreatorDraft({ character, slices, provenance });
  assert.equal(draft.ok, true, draft.ok ? '' : draft.error.code);
  return createCreatorSession({ draft: draft.value, registry, stepRegistry: fullStepRegistry() });
}

/**
 * Confirma uma seleção de classe do começo ao fim (abrir, encenar, confirmar).
 * @param {object} session
 * @param {string} contentId
 * @param {object} escolhas - `{slice: {choiceId: [optionId]}}`
 * @returns {Promise<object>} Result do commit
 */
async function confirmarClasse(session, contentId, escolhas) {
  const transactionId = selectionTransactionId('classe', contentId);
  assert.equal((await session.dispatch({ type: CREATOR_INTENT_TYPES.modalBegin, transactionId })).ok, true);
  for (const [slice, valor] of Object.entries(escolhas)) {
    assert.equal((await session.dispatch({ type: CREATOR_INTENT_TYPES.modalUpdate, transactionId, slices: { [slice]: valor } })).ok, true);
  }
  return session.dispatch({ type: CREATOR_INTENT_TYPES.modalCommit, transactionId });
}

/** Escolhas mínimas do Bárbaro, segundo o catálogo (chaves QUALIFICADAS). */
const ESCOLHAS_BARBARO = Object.freeze({
  classSkills: qualifiedPicks('class', BARBARO, { 'pericias-de-classe': ['atletismo', 'intimidacao'] }),
  classChoices: qualifiedPicks('class', BARBARO, { 'equipamento-inicial': ['opcao-a'] }),
});

/** Escolhas mínimas do Mago, segundo o catálogo (chaves QUALIFICADAS). */
const ESCOLHAS_MAGO = Object.freeze({
  classSkills: qualifiedPicks('class', MAGO, { 'pericias-de-classe': ['arcanismo', 'historia'] }),
  classChoices: qualifiedPicks('class', MAGO, { 'equipamento-inicial': ['opcao-a'] }),
});

/**
 * Ids de proveniência presentes no personagem (efeitos ativos + inventário +
 * magias), para provar simetria de aplicação/revogação.
 * @param {object} character
 * @returns {Array<string>}
 */
function fontesMaterializadas(character) {
  const state = character.state;
  const entradas = [...state.activeEffects, ...state.inventory, ...state.spells.known, ...state.spells.prepared];
  return [...new Set(entradas.map((entrada) => entrada.sourceInstanceId).filter((id) => typeof id === 'string'))].sort();
}

describe('confirmar o modal é o único ponto que aplica a seleção', () => {
  test('abrir e encenar NÃO tocam o rascunho; só o commit grava', async () => {
    const session = criarSessao();
    assert.equal((await session.initialize()).ok, true);
    const transactionId = selectionTransactionId('classe', BARBARO);

    await session.dispatch({ type: CREATOR_INTENT_TYPES.modalBegin, transactionId });
    await session.dispatch({ type: CREATOR_INTENT_TYPES.modalUpdate, transactionId, slices: ESCOLHAS_BARBARO });
    let snapshot = session.getSnapshot();
    assert.equal(snapshot.draft.slices.classSelection, null, 'nada gravado antes do commit');
    assert.equal(snapshot.draft.slices.classSkills, null);
    assert.deepEqual([...snapshot.pendingTransactionIds], [transactionId]);

    assert.equal((await session.dispatch({ type: CREATOR_INTENT_TYPES.modalCommit, transactionId })).ok, true);
    snapshot = session.getSnapshot();
    assert.equal(snapshot.draft.slices.classSelection.contentId, BARBARO);
    assert.deepEqual([...snapshot.pendingTransactionIds], []);
    session.dispose();
  });

  test('cancelar descarta tudo: nem escolha, nem concessão, nem `reduce`', async () => {
    const session = criarSessao();
    assert.equal((await session.initialize()).ok, true);
    const transactionId = selectionTransactionId('classe', BARBARO);
    const antes = session.getSnapshot().draft;

    await session.dispatch({ type: CREATOR_INTENT_TYPES.modalBegin, transactionId });
    await session.dispatch({ type: CREATOR_INTENT_TYPES.modalUpdate, transactionId, slices: ESCOLHAS_BARBARO });
    assert.equal((await session.dispatch({ type: CREATOR_INTENT_TYPES.modalCancel, transactionId })).ok, true);

    const depois = session.getSnapshot().draft;
    assert.equal(depois.slices.classSelection, null);
    assert.equal(depois.slices.classSkills, null);
    assert.equal(depois.character, antes.character, 'o personagem é o MESMO objeto: nada foi aplicado');
    assert.deepEqual(fontesMaterializadas(depois.character), []);
    session.dispose();
  });

  test('confirmar materializa as concessões da classe escolhida e valida o passo', async () => {
    const session = criarSessao();
    assert.equal((await session.initialize()).ok, true);
    const commit = await confirmarClasse(session, BARBARO, ESCOLHAS_BARBARO);
    assert.equal(commit.ok, true, commit.ok ? '' : commit.error.code);

    const snapshot = session.getSnapshot();
    assert.deepEqual([...snapshot.draft.provenance.classSelection], [FONTE_BARBARO]);
    assert.deepEqual(fontesMaterializadas(snapshot.draft.character), [FONTE_BARBARO]);
    // As perícias escolhidas viraram proficiência de verdade.
    const proficiencias = snapshot.draft.character.state.activeEffects
      .filter((entrada) => entrada.data?.kind === 'proficiency')
      .map((entrada) => entrada.data.id);
    assert.ok(proficiencias.includes('dnd2024:skill:atletismo'));
    assert.ok(proficiencias.includes('dnd2024:skill:intimidacao'));
    // E o equipamento da opção A entrou no inventário.
    assert.ok(snapshot.draft.character.state.inventory.length > 0);
    assert.equal(snapshot.validation.valid, true);
    session.dispose();
  });
});

describe('trocar de seleção revoga exatamente a proveniência substituída', () => {
  test('trocar Bárbaro por Mago remove só as concessões do Bárbaro', async () => {
    const session = criarSessao();
    assert.equal((await session.initialize()).ok, true);
    assert.equal((await confirmarClasse(session, BARBARO, ESCOLHAS_BARBARO)).ok, true);
    const comBarbaro = session.getSnapshot().draft.character;
    assert.deepEqual(fontesMaterializadas(comBarbaro), [FONTE_BARBARO]);

    assert.equal((await confirmarClasse(session, MAGO, ESCOLHAS_MAGO)).ok, true);
    const comMago = session.getSnapshot().draft;

    assert.deepEqual(fontesMaterializadas(comMago.character), [FONTE_MAGO], 'nenhuma concessão do Bárbaro sobreviveu, e nenhuma a mais foi criada');
    assert.equal(comMago.slices.classSelection.contentId, MAGO);
    assert.deepEqual([...comMago.provenance.classSelection], [FONTE_MAGO]);
    assert.deepEqual(comMago.slices.classSkills, qualifiedPicks('class', MAGO, { 'pericias-de-classe': ['arcanismo', 'historia'] }));
    assert.equal(comMago.character.build.classRef.id, MAGO);
    // E NENHUMA chave do Bárbaro sobreviveu — nem na fatia, nem em
    // `build.choices` (que `revokeGrantEffects` sozinho não limpa).
    const chaves = [...Object.keys(comMago.slices.classSkills), ...Object.keys(comMago.character.build.choices)];
    assert.equal(
      chaves.some((chave) => chave.startsWith(`${FONTE_BARBARO}:`)),
      false,
      `resíduo da proveniência substituída: ${chaves.join(', ')}`,
    );
    session.dispose();
  });

  test('trocar de entidade SEM reabrir o modal não herda escolha nenhuma da anterior', async () => {
    // O caminho que a suíte não cobria: confirmar uma classe e depois confirmar
    // OUTRA sem reencenar. Como `pericias-de-classe`/`equipamento-inicial` são
    // declarados pelas 12 classes com os mesmos ids de opção, a escolha antiga
    // chegava a ser aplicada por coincidência de id.
    const session = criarSessao();
    assert.equal((await session.initialize()).ok, true);
    assert.equal((await confirmarClasse(session, BARBARO, ESCOLHAS_BARBARO)).ok, true);

    // Confirma o Mago sem NENHUM `modal-update`.
    const transactionId = selectionTransactionId('classe', MAGO);
    assert.equal((await session.dispatch({ type: CREATOR_INTENT_TYPES.modalBegin, transactionId })).ok, true);
    assert.equal((await session.dispatch({ type: CREATOR_INTENT_TYPES.modalCommit, transactionId })).ok, true);

    const snapshot = session.getSnapshot();
    assert.equal(snapshot.draft.slices.classSelection.contentId, MAGO);
    assert.deepEqual(snapshot.draft.slices.classSkills, {}, 'nenhuma perícia herdada do Bárbaro');
    assert.deepEqual(snapshot.draft.slices.classChoices, {}, 'nenhum equipamento herdado do Bárbaro');
    assert.deepEqual(snapshot.draft.character.build.choices, {}, 'nenhuma escolha antiga sobrevive em build.choices');

    // As concessões FIXAS do Mago (proficiências de arma/armadura, declaradas
    // sem escolha) existem — elas não dependem de escolha nenhuma. O que NÃO
    // pode existir é qualquer coisa vinda das escolhas do Bárbaro: nenhuma
    // perícia e nenhum item de equipamento inicial.
    assert.deepEqual(fontesMaterializadas(snapshot.draft.character), [FONTE_MAGO]);
    const pericias = snapshot.draft.character.state.activeEffects
      .filter((entrada) => entrada.data?.kind === 'proficiency' && String(entrada.data.id).startsWith('dnd2024:skill:'))
      .map((entrada) => entrada.data.id);
    assert.deepEqual(pericias, [], 'nenhuma perícia foi concedida por escolha herdada');
    assert.deepEqual(snapshot.draft.character.state.inventory, [], 'nenhum item de equipamento inicial herdado');

    // E o passo DIZ que está incompleto, em vez de contar as escolhas da classe
    // anterior e se declarar válido.
    assert.equal(snapshot.validation.valid, false);
    assert.deepEqual(
      snapshot.validation.errors.map((erro) => erro.choiceId).sort(),
      ['equipamento-inicial', 'pericias-de-classe'],
    );
    session.dispose();
  });

  test('antecedente: trocar sem reabrir o modal não entrega o equipamento do antecedente anterior', async () => {
    // `equipamento-inicial` existe nos 16 antecedentes com `opcao-a`/`opcao-b`:
    // era o caso em que a escolha herdada não só passava por válida como
    // CONCEDIA um item que o jogador nunca escolheu para aquele antecedente.
    const ACOLITO = 'dnd2024:background:acolito';
    const ANDARILHO = 'dnd2024:background:andarilho';
    const session = criarSessao({
      slices: {
        backgroundSelection: { contentId: ACOLITO, packageVersion: '1.0.0' },
        backgroundEquipmentSelection: qualifiedPicks('background', ACOLITO, { 'equipamento-inicial': ['opcao-a'] }),
      },
      provenance: {
        backgroundSelection: [sourceIdOf('background', ACOLITO)],
        backgroundEquipmentSelection: [sourceIdOf('background', ACOLITO)],
      },
    });
    assert.equal((await session.initialize()).ok, true);
    assert.equal((await session.goToVisited('classe')).ok, true);

    const step = fullStepRegistry().get('antecedente');
    const contexto = stepContext({ stepId: 'antecedente', draft: session.getSnapshot().draft, registry });
    const reduzido = step.reduce(contexto, {
      type: 'creator/transaction-committed',
      transactionId: selectionTransactionId('antecedente', ANDARILHO),
    });
    assert.equal(reduzido.ok, true, reduzido.ok ? '' : reduzido.error.code);
    assert.deepEqual(reduzido.value.draft.slices.backgroundEquipmentSelection, {}, 'o equipamento do Acólito não segue para o Andarilho');
    assert.equal(reduzido.value.draft.character.state.inventory.length, 0, 'nenhum item concedido por escolha herdada');
    session.dispose();
  });

  test('itens e moedas acrescentados À MÃO sobrevivem a uma troca COMPLETA de classe', async () => {
    const base = emptyCharacter();
    const manual = {
      ...base,
      state: {
        ...base.state,
        inventory: [{ instanceId: 'manual-0001', itemRef: { id: 'dnd2024:equipment:corda-de-canhamo' }, quantity: 1, equipped: false }],
      },
    };
    const session = criarSessao({
      character: manual,
      slices: { manualInventoryChanges: [{ id: 'manual-0001' }], walletChanges: { po: 42 } },
    });
    assert.equal((await session.initialize()).ok, true);
    assert.equal((await confirmarClasse(session, BARBARO, ESCOLHAS_BARBARO)).ok, true);
    assert.equal((await confirmarClasse(session, MAGO, ESCOLHAS_MAGO)).ok, true);

    const draft = session.getSnapshot().draft;
    for (const slice of PLAYER_OWNED_SLICES) {
      assert.notEqual(draft.slices[slice], null, `a fatia "${slice}" do jogador foi apagada`);
    }
    assert.deepEqual(draft.slices.walletChanges, { po: 42 });
    assert.deepEqual(draft.slices.manualInventoryChanges, [{ id: 'manual-0001' }]);
    // E o item sem proveniência de concessão continua no inventário.
    assert.ok(draft.character.state.inventory.some((entrada) => entrada.instanceId === 'manual-0001'));
    session.dispose();
  });

  test('trocar de classe descarta o step data dos passos dependentes, mas não os atributos do jogador', async () => {
    const session = criarSessao({ slices: { abilityScores: { forca: 15 } } });
    assert.equal((await session.initialize()).ok, true);
    assert.equal((await confirmarClasse(session, BARBARO, ESCOLHAS_BARBARO)).ok, true);
    assert.equal((await confirmarClasse(session, MAGO, ESCOLHAS_MAGO)).ok, true);

    const snapshot = session.getSnapshot();
    assert.deepEqual(snapshot.draft.slices.abilityScores, { forca: 15 }, 'trocar de classe não redistribui atributos');
    assert.equal(snapshot.stepData.atributos, undefined, 'o step data de `atributos` foi descartado');
    session.dispose();
  });
});

describe('troca depois de visitar os passos seguintes', () => {
  test('voltar de `especie` para `classe` invalida a espécie e revoga só as concessões dela', async () => {
    const session = criarSessao();
    assert.equal((await session.initialize()).ok, true);
    assert.equal((await confirmarClasse(session, BARBARO, ESCOLHAS_BARBARO)).ok, true);
    assert.equal((await session.next()).ok, true);
    assert.equal(session.getSnapshot().currentStepId, 'especie');

    const transactionId = selectionTransactionId('especie', 'dnd2024:species:draconato');
    await session.dispatch({ type: CREATOR_INTENT_TYPES.modalBegin, transactionId });
    await session.dispatch({
      type: CREATOR_INTENT_TYPES.modalUpdate,
      transactionId,
      slices: { speciesChoices: qualifiedPicks('species', 'dnd2024:species:draconato', { 'heranca-draconica': ['ouro'] }) },
    });
    assert.equal((await session.dispatch({ type: CREATOR_INTENT_TYPES.modalCommit, transactionId })).ok, true);

    const comEspecie = session.getSnapshot().draft;
    assert.deepEqual(fontesMaterializadas(comEspecie.character), [FONTE_BARBARO, 'source:species:0000:dnd2024-species-draconato'].sort());
    // A escolha de linhagem concedeu resistência a fogo (opção "ouro").
    const defesas = comEspecie.character.state.activeEffects.filter((entrada) => entrada.data?.kind === 'defense');
    assert.deepEqual(defesas.map((entrada) => entrada.data.id), ['dnd2024:damage-type:fogo']);

    const voltou = session.previous();
    assert.equal(voltou.ok, true, voltou.ok ? '' : voltou.error.code);
    const depois = session.getSnapshot().draft;
    assert.equal(depois.slices.speciesSelection, null, 'a espécie abandonada foi invalidada');
    assert.equal(depois.slices.classSelection.contentId, BARBARO, 'a classe do passo de destino sobrevive');
    assert.deepEqual(fontesMaterializadas(depois.character), [FONTE_BARBARO], 'só as concessões da espécie foram revogadas');
    session.dispose();
  });
});

describe('conteúdo hostil de catálogo pelo `render` dos três passos', () => {
  const PAYLOADS = Object.freeze([
    '<script>window.__xss="nome"</script>',
    '"><img src=x onerror="window.__xss=\'atributo\'">',
    '<svg/onload=window.__xss="descricao">',
    '</title><script>window.__xss="titulo"</script>',
    'javascript:window.__xss="url"',
  ]);

  /**
   * Catálogo FALSO com nomes hostis, no formato que cada passo espera.
   * @param {string} type
   * @returns {object}
   */
  function registryHostil(type) {
    const entidades = PAYLOADS.map((payload, indice) => ({
      id: `dnd2024:${type}:hostil-${indice}`,
      type,
      name: payload,
      description: payload,
      hitDie: payload,
      primaryAbility: [],
      legacyPresentation: { tracos: [{ nome: payload }], ferramentas: payload, tracos_basicos: { 'Atributo Primário': payload } },
      effects: [{ id: 'talento-de-origem', type: 'official-handler', handlerId: 'grant-feat', params: { featId: 'dnd2024:feat:hostil' } }],
    }));
    return {
      /** @returns {ReadonlyArray<object>} */
      list: () => entidades,
      /** @returns {object} */
      resolve: () => ({ ok: true, value: { id: 'dnd2024:feat:hostil', type: 'feat', name: PAYLOADS[0] } }),
    };
  }

  for (const [stepId, criar, type] of [
    ['classe', createClassStep, 'class'],
    ['especie', createSpeciesStep, 'species'],
    ['antecedente', createBackgroundStep, 'background'],
  ]) {
    test(`nenhum payload sai cru pelo render do passo "${stepId}"`, async () => {
      const hostil = registryHostil(type);
      const step = criar().value;
      const draft = createCreatorDraft({ character: emptyCharacter() }).value;
      const loaded = await step.load(stepContext({ stepId, draft, registry: hostil }));
      assert.equal(loaded.ok, true, loaded.ok ? '' : loaded.error.code);
      const markup = step.render(stepContext({ stepId, draft, data: loaded.value, registry: hostil }));

      for (const payload of PAYLOADS) {
        assert.equal(markup.includes(payload), false, `o payload cru vazou no markup de "${stepId}": ${payload}`);
      }

      const container = dom.document.createElement('div');
      container.innerHTML = markup;
      dom.document.body.appendChild(container);
      for (const elemento of container.querySelectorAll('*')) {
        assert.equal(['SCRIPT', 'IMG', 'SVG', 'IFRAME'].includes(elemento.tagName), false, `tag criada: ${elemento.tagName}`);
        for (const atributo of elemento.attributes) {
          assert.equal(/^on/i.test(atributo.name), false, `handler criado: ${atributo.name}`);
        }
      }
      // E o texto continua VISÍVEL: escapar não pode virar "sumir".
      assert.ok(container.textContent.includes(PAYLOADS[0]));
    });
  }
});

describe('o step data é exigido, não presumido', () => {
  test('validate sem step data carregado recusa em vez de aprovar no escuro', async () => {
    const step = createClassStep().value;
    const draft = createCreatorDraft({
      character: emptyCharacter(),
      slices: { classSelection: { contentId: BARBARO, packageVersion: '1.0.0' } },
    }).value;
    const resultado = step.validate(stepContext({ stepId: 'classe', draft, data: null, registry }));
    assert.equal(resultado.valid, false);
    assert.equal(resultado.errors[0].code, 'CREATOR_SELECTION_ENTITY_UNKNOWN');
  });

  test('o registro completo tem os três passos reais e os quatro placeholders restantes', async () => {
    const stepRegistry = fullStepRegistry();
    assert.deepEqual([...stepRegistry.stepIds()], ['classe', 'especie', 'antecedente', 'atributos', 'equipamento', 'magias', 'detalhes']);
    const { data } = await loadStepData(stepRegistry, 'classe', createCreatorDraft({ character: emptyCharacter() }).value, registry);
    assert.equal(data.cards.length, 12);
  });
});

describe('reconfirmar a MESMA entidade não destrói o que ela concede', () => {
  // A reconfirmação (botão "Alterar", ou reabrir o mesmo card) usa o MESMO
  // `sourceInstanceId` da confirmação anterior — ele é derivado do id de
  // conteúdo. Sem tratamento, esse id aparecia ao mesmo tempo como "a
  // proveniência a revogar" e como "a proveniência recém-escrita", e o patch
  // apagava tudo o que o passo acabara de aplicar: personagem sem concessão
  // nenhuma, `build.choices` vazio — e `validate` ainda dizendo `valid: true`,
  // porque as FATIAS continuavam preenchidas.

  /**
   * Confirma uma entidade qualquer, encenando as escolhas informadas.
   * @param {object} session
   * @param {string} stepId
   * @param {string} contentId
   * @param {object} escolhas - `{slice: {chaveQualificada: [optionId]}}`
   * @returns {Promise<object>}
   */
  async function confirmar(session, stepId, contentId, escolhas) {
    const transactionId = selectionTransactionId(stepId, contentId);
    assert.equal((await session.dispatch({ type: CREATOR_INTENT_TYPES.modalBegin, transactionId })).ok, true);
    for (const [slice, valor] of Object.entries(escolhas)) {
      assert.equal(
        (await session.dispatch({ type: CREATOR_INTENT_TYPES.modalUpdate, transactionId, slices: { [slice]: valor } })).ok,
        true,
      );
    }
    return session.dispatch({ type: CREATOR_INTENT_TYPES.modalCommit, transactionId });
  }

  test('classe: reconfirmar o Mago trocando só a opção de equipamento mantém as perícias e troca o item', async () => {
    const session = criarSessao();
    assert.equal((await session.initialize()).ok, true);
    assert.equal((await confirmar(session, 'classe', MAGO, ESCOLHAS_MAGO)).ok, true);

    const antes = session.getSnapshot();
    const periciasAntes = antes.draft.character.state.activeEffects
      .filter((e) => e.data?.kind === 'proficiency' && String(e.data.id).startsWith('dnd2024:skill:'))
      .map((e) => e.data.id)
      .sort();
    assert.deepEqual(periciasAntes, ['dnd2024:skill:arcanismo', 'dnd2024:skill:historia']);
    assert.ok(antes.draft.character.state.inventory.length > 0, 'a opção A concede itens');
    assert.equal(antes.validation.valid, true);

    // Reconfirma o MESMO Mago, mudando só o equipamento para a opção B.
    assert.equal(
      (
        await confirmar(session, 'classe', MAGO, {
          classChoices: qualifiedPicks('class', MAGO, { 'equipamento-inicial': ['opcao-b'] }),
        })
      ).ok,
      true,
    );

    const depois = session.getSnapshot();
    // (1) as concessões da classe CONTINUAM lá.
    const periciasDepois = depois.draft.character.state.activeEffects
      .filter((e) => e.data?.kind === 'proficiency' && String(e.data.id).startsWith('dnd2024:skill:'))
      .map((e) => e.data.id)
      .sort();
    assert.deepEqual(periciasDepois, periciasAntes, 'as perícias da classe não podem sumir na reconfirmação');
    assert.deepEqual(fontesMaterializadas(depois.draft.character), [FONTE_MAGO]);
    // (2) SÓ o que mudou mudou: a opção B do Mago não concede item nenhum, e o
    // item da opção A foi retirado — não ficou dos dois lados.
    assert.deepEqual(depois.draft.character.state.inventory, [], 'o item da opção antiga precisa sair');
    // (3) a escolha nova está em `build.choices`, e só ela.
    assert.deepEqual(depois.draft.character.build.choices, {
      [`${FONTE_MAGO}:pericias-de-classe`]: ['arcanismo', 'historia'],
      [`${FONTE_MAGO}:equipamento-inicial`]: ['opcao-b'],
    });
    // (4) e a validação reflete o estado REAL.
    assert.equal(depois.validation.valid, true);
    assert.equal(depois.draft.slices.classSelection.contentId, MAGO);
    session.dispose();
  });

  test('espécie: reconfirmar o Draconato trocando a linhagem troca a resistência, sem perder a espécie', async () => {
    const DRACONATO = 'dnd2024:species:draconato';
    const session = criarSessao();
    assert.equal((await session.initialize()).ok, true);
    assert.equal((await confirmar(session, 'classe', MAGO, ESCOLHAS_MAGO)).ok, true);
    assert.equal((await session.next()).ok, true);

    assert.equal(
      (
        await confirmar(session, 'especie', DRACONATO, {
          speciesChoices: qualifiedPicks('species', DRACONATO, { 'heranca-draconica': ['ouro'] }),
        })
      ).ok,
      true,
    );
    const defesasAntes = session
      .getSnapshot()
      .draft.character.state.activeEffects.filter((e) => e.data?.kind === 'defense')
      .map((e) => e.data.id);
    assert.deepEqual(defesasAntes, ['dnd2024:damage-type:fogo']);

    assert.equal(
      (
        await confirmar(session, 'especie', DRACONATO, {
          speciesChoices: qualifiedPicks('species', DRACONATO, { 'heranca-draconica': ['branco'] }),
        })
      ).ok,
      true,
    );

    const depois = session.getSnapshot();
    const defesas = depois.draft.character.state.activeEffects.filter((e) => e.data?.kind === 'defense').map((e) => e.data.id);
    assert.deepEqual(defesas, ['dnd2024:damage-type:frio'], 'a resistência da linhagem antiga sai, a nova entra');
    // A espécie continua selecionada e suas outras concessões (visão no escuro,
    // recursos) continuam materializadas.
    assert.equal(depois.draft.slices.speciesSelection.contentId, DRACONATO);
    assert.ok(
      fontesMaterializadas(depois.draft.character).includes('source:species:0000:dnd2024-species-draconato'),
      'a espécie não pode ficar sem concessão nenhuma',
    );
    assert.equal(depois.validation.valid, true);
    session.dispose();
  });

  test('antecedente: reconfirmar o mesmo antecedente trocando o bônus de atributo preserva perícias e talento', async () => {
    const ANDARILHO = 'dnd2024:background:andarilho';
    /**
     * @param {string} bonus
     * @returns {object}
     */
    const escolhas = (bonus) => ({
      backgroundAbilityBonus: qualifiedPicks('background', ANDARILHO, { 'bonus-de-atributo': [bonus] }),
      backgroundEquipmentSelection: qualifiedPicks('background', ANDARILHO, { 'equipamento-inicial': ['opcao-a'] }),
      backgroundSkills: qualifiedPicks('background', ANDARILHO, { 'idiomas-adicionais': ['anao', 'elfico'] }),
    });

    const session = criarSessao();
    assert.equal((await session.initialize()).ok, true);
    assert.equal((await confirmar(session, 'classe', MAGO, ESCOLHAS_MAGO)).ok, true);
    assert.equal((await session.next()).ok, true);
    assert.equal((await confirmar(session, 'especie', 'dnd2024:species:anao', {})).ok, true);
    assert.equal((await session.next()).ok, true);

    assert.equal((await confirmar(session, 'antecedente', ANDARILHO, escolhas('destreza-mais2-sabedoria-mais1'))).ok, true);
    const fonte = 'source:background:0000:dnd2024-background-andarilho';
    const periciasAntes = session
      .getSnapshot()
      .draft.character.state.activeEffects.filter((e) => e.sourceInstanceId === fonte && e.data?.kind === 'proficiency')
      .map((e) => e.data.id)
      .sort();
    assert.deepEqual(periciasAntes, ['dnd2024:skill:furtividade', 'dnd2024:skill:intuicao']);

    assert.equal((await confirmar(session, 'antecedente', ANDARILHO, escolhas('destreza-mais2-carisma-mais1'))).ok, true);

    const depois = session.getSnapshot();
    const periciasDepois = depois.draft.character.state.activeEffects
      .filter((e) => e.sourceInstanceId === fonte && e.data?.kind === 'proficiency')
      .map((e) => e.data.id)
      .sort();
    assert.deepEqual(periciasDepois, periciasAntes, 'as perícias fixas do antecedente não podem sumir');
    assert.equal(depois.draft.slices.backgroundSelection.contentId, ANDARILHO);
    assert.equal(depois.draft.slices.backgroundFeat, 'dnd2024:feat:sortudo', 'o talento de origem continua registrado');
    assert.deepEqual(depois.draft.slices.backgroundAbilityBonus, escolhas('destreza-mais2-carisma-mais1').backgroundAbilityBonus);
    assert.equal(depois.validation.valid, true);
    session.dispose();
  });

  test('reconfirmar NÃO duplica concessão: aplicar a mesma escolha duas vezes é idempotente', async () => {
    const session = criarSessao();
    assert.equal((await session.initialize()).ok, true);
    assert.equal((await confirmar(session, 'classe', MAGO, ESCOLHAS_MAGO)).ok, true);
    const primeiro = session.getSnapshot().draft.character.state;
    assert.equal((await confirmar(session, 'classe', MAGO, ESCOLHAS_MAGO)).ok, true);
    const segundo = session.getSnapshot().draft.character.state;

    assert.equal(segundo.activeEffects.length, primeiro.activeEffects.length, 'nenhum efeito duplicado');
    assert.equal(segundo.inventory.length, primeiro.inventory.length, 'nenhum item duplicado');
    assert.equal(session.getSnapshot().validation.valid, true);
    session.dispose();
  });
});
