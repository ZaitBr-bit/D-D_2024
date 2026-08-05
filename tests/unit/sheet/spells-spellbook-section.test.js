// Teste focal de `features/sheet/sections/spells-spellbook-section.js`
// (Task 31) — a parte mais arriscada do brief.
//
// As garantias, cada uma com um defeito concreto por trás:
//
//  1. TRANSAÇÃO DE MODAL. Cancelar o modal de conjuração e o de concentração
//     não emite comando NENHUM (a intenção não carrega `command`), e confirmar
//     a substituição de concentração emite EXATAMENTE UM comando — nunca dois
//     (um para encerrar a antiga, outro para começar a nova), porque essa
//     sequência pode parar no meio e deixar o personagem sem concentração
//     nenhuma. A atomicidade é conferida no DOMÍNIO, não só na forma da intent.
//  2. REABERTURA DE MODAL (semântica que a Task 30 introduziu em
//     `sheet-controller.js#openModal`): esta seção é o segundo produtor de
//     modal da ficha e o primeiro com formulário. Reabrir o mesmo `modalId`
//     para OUTRA magia não pode vazar a escolha de espaço da anterior.
//  3. OS DOIS POOLS DE ESPAÇO SÃO SEPARADOS. `spell-slot` e `pact-slot` são
//     opções distintas e nunca somadas — é o erro que `cast-spell.js` documenta
//     no seu cabeçalho, e um Bruxo tem os dois ao mesmo tempo.
//  4. NADA VEM DE PROSA. O fonte é varrido atrás de `MAGIAS_EFEITO`, de regex
//     sobre descrição e de comparação por nome de exibição.
//  5. MARKDOWN SEGURO. A descrição de uma magia customizada passa por
//     `ui/markdown.js` (Task 24) — nenhum parsing novo —, e uma descrição
//     hostil sobrevive como TEXTO.
//  6. ANTI-BYPASS + MÚLTIPLOS CONJURADORES (padrão de bug (d)): as fixtures de
//     conjurador conhecido E preparado, não só uma.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ok } from '../../../site/js/core/result.js';
import { createTestDom } from '../../helpers/test-dom.js';
import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import { createLegacyAliasResolver } from '../../../site/js/infra/character/legacy-alias-resolver.js';
import { decodeCharacterRecord, encodeCharacterRecord } from '../../../site/js/infra/character/character-codec.js';
import { projectLegacyCharacterForQueries, deriveLegacyQueryHints } from '../../../site/js/infra/character/legacy-query-adapter.js';
import { buildSheetViewModel } from '../../../site/js/features/sheet/sheet-view-model.js';
import { executeCharacterCommand } from '../../../site/js/domain/commands/command-dispatcher.js';
import { SHEET_INTENT_TYPES } from '../../../site/js/features/sheet/sheet-state.js';
import {
  CONCENTRATION_MODAL_ID,
  METAMAGIC_UNAVAILABLE_REASON,
  CATALOG_PICKER_UNAVAILABLE_REASON,
  SPELLS_COMMAND_TYPES,
  SPELLS_SPELLBOOK_SECTION_ID,
  SPELL_CAST_MODAL_ID,
  SPELL_DETAIL_MODAL_ID,
  SPELL_DETAIL_UNAVAILABLE_REASON,
  SPELL_FLOW_ACTIONS,
  createSpellsSpellbookSection,
  renderSpellsSpellbook,
  selectSpellsSpellbook,
  spellsSpellbookToIntent,
} from '../../../site/js/features/sheet/sections/spells-spellbook-section.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const NOW = '2026-08-04T00:00:00.000Z';
const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });
const SKILL_IDS = Object.freeze(['dnd2024:skill:percepcao', 'dnd2024:skill:intuicao']);

const MISSEIS = 'dnd2024:spell:misseis-magicos';
const TEIA = 'dnd2024:spell:teia';
const ENFEITICAR = 'dnd2024:spell:enfeiticar';

// `classes` preenchido (correção C1): `prepare-spell`/`add-spellbook-spell`
// validam pertencimento à lista da classe via `validateSpellSelection`, e uma
// lista vazia recusaria TUDO — o que mascararia o fluxo de preparo em teste.
const SPELL_CLASSES = Object.freeze(['dnd2024:class:mago', 'dnd2024:class:clerigo', 'dnd2024:class:bruxo']);
const SPELL_ENTITIES = Object.freeze({
  [MISSEIS]: Object.freeze({ id: MISSEIS, type: 'spell', level: 1, school: 'evocacao', ritual: false, concentration: false, classes: SPELL_CLASSES }),
  [TEIA]: Object.freeze({ id: TEIA, type: 'spell', level: 2, school: 'conjuracao', ritual: false, concentration: true, classes: SPELL_CLASSES }),
  [ENFEITICAR]: Object.freeze({ id: ENFEITICAR, type: 'spell', level: 1, school: 'encantamento', ritual: false, concentration: true, classes: SPELL_CLASSES }),
});

const KNOWN_ENTITIES = Object.freeze({
  ...SPELL_ENTITIES,
  'dnd2024:class:mago': Object.freeze({
    id: 'dnd2024:class:mago',
    type: 'class',
    effects: Object.freeze([]),
    spellcasting: Object.freeze({ ability: 'dnd2024:ability:inteligencia', progression: 'full' }),
  }),
  'dnd2024:class:clerigo': Object.freeze({
    id: 'dnd2024:class:clerigo',
    type: 'class',
    effects: Object.freeze([]),
    spellcasting: Object.freeze({ ability: 'dnd2024:ability:sabedoria', progression: 'full' }),
  }),
  'dnd2024:class:bruxo': Object.freeze({
    id: 'dnd2024:class:bruxo',
    type: 'class',
    effects: Object.freeze([]),
    spellcasting: Object.freeze({ ability: 'dnd2024:ability:carisma', progression: 'pact' }),
  }),
  'dnd2024:species:humano': Object.freeze({ id: 'dnd2024:species:humano', type: 'species', effects: Object.freeze([]), size: 'medium', speed: 9 }),
});

/**
 * Catálogo mínimo.
 * @returns {Readonly<object>}
 */
function fakeRegistry() {
  return Object.freeze({
    get: (id) => KNOWN_ENTITIES[id] ?? null,
    resolve: (reference) => {
      const id = typeof reference === 'string' ? reference : reference?.id;
      return ok(KNOWN_ENTITIES[id] ?? Object.freeze({ id, type: 'stub', effects: Object.freeze([]) }));
    },
    list: (type) => (type === 'skill' ? Object.freeze(SKILL_IDS.map((id) => Object.freeze({ id, type: 'skill' }))) : Object.freeze([])),
  });
}

/** @type {Array<{fixture: string, caseId: string, character: object, context: object}>} */
const personagens = [];
/** @type {Array<{fixture: string, caseId: string, character: object, context: object}>} */
const conjuradores = [];
/** Contexto do codec (aliasResolver real) para os testes de persistência da correção C1. */
let codecCtx = null;

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  const ctx = { aliasResolver: createLegacyAliasResolver(aliases), now: NOW };
  codecCtx = ctx;

  const dir = path.join(repoRoot, 'tests/fixtures/characters');
  for (const name of await readdir(dir)) {
    if (!name.startsWith('legacy-') && !name.startsWith('near-') && !name.startsWith('v2-')) {
      continue;
    }
    const parsed = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
    for (const entry of parsed.cases ?? []) {
      if (entry.personagem === null || typeof entry.personagem !== 'object') {
        continue;
      }
      const projected = projectLegacyCharacterForQueries(entry.personagem, ctx);
      if (projected.ok !== true) {
        continue;
      }
      const hints = deriveLegacyQueryHints(entry.personagem);
      if (!Number.isFinite(hints?.maximumHitPoints)) {
        continue;
      }
      const registro = {
        fixture: name,
        caseId: entry.id,
        character: projected.value,
        context: { registry: fakeRegistry(), ...hints },
      };
      personagens.push(registro);
      const spells = projected.value.state?.spells ?? {};
      const total = (spells.known?.length ?? 0) + (spells.prepared?.length ?? 0) + (spells.spellbook?.length ?? 0);
      if (total > 0) {
        conjuradores.push(registro);
      }
    }
  }
  assert.ok(personagens.length >= 10, `apenas ${personagens.length} fixtures decodificáveis`);
  // Padrão de bug recorrente (d): paridade com fixture única. Precisam ser
  // conjuradores DE FIXTURES DIFERENTES (conhecidas, preparadas, customizadas),
  // não três casos do mesmo arquivo.
  const arquivos = new Set(conjuradores.map((registro) => registro.fixture));
  assert.ok(arquivos.size >= 3, `conjuradores vindos de apenas ${arquivos.size} fixture(s): ${[...arquivos].join(', ')}`);
});

/**
 * ViewModel de um registro carregado.
 * @param {object} registro
 * @returns {object}
 */
function viewModelDe(registro) {
  const built = buildSheetViewModel(registro.character, registro.context);
  assert.equal(built.ok, true, `ViewModel falhou: ${built.error?.code}`);
  return built.value;
}

/**
 * Renderiza a seção dentro do contêiner de seção real.
 * @param {object} dom
 * @param {object} viewModel
 * @returns {object}
 */
function montar(dom, viewModel) {
  const raiz = dom.document.createElement('div');
  raiz.setAttribute('data-sheet-section', SPELLS_SPELLBOOK_SECTION_ID);
  raiz.innerHTML = renderSpellsSpellbook(selectSpellsSpellbook(viewModel));
  dom.document.body.appendChild(raiz);
  return raiz;
}

/**
 * Materializa o `content`/`actions` de um modal DESCRITO por `toIntent`, do
 * mesmo jeito que `sheet-controller.js#toModalNodes` faz — inclusive o
 * `parentElement`, que é o que a leitura do formulário usa como escopo.
 * @param {object} dom
 * @param {object} intent
 * @returns {object} a raiz do modal
 */
function materializarModal(dom, intent) {
  const overlay = dom.document.createElement('div');
  overlay.setAttribute('data-modal-overlay', 'true');
  const corpo = dom.document.createElement('div');
  corpo.innerHTML = intent.content;
  const acoes = dom.document.createElement('div');
  acoes.innerHTML = intent.actions;
  overlay.appendChild(corpo);
  overlay.appendChild(acoes);
  dom.document.body.appendChild(overlay);
  return overlay;
}

/**
 * Marca uma fonte de espaço no formulário do modal, como o jogador faria.
 * @param {object} modal
 * @param {string} valor
 * @returns {void}
 */
function escolherFonte(modal, valor) {
  let achou = false;
  for (const radio of modal.querySelectorAll('[data-sheet-cast-slot-source]')) {
    const marcar = radio.getAttribute('value') === valor;
    radio.checked = marcar;
    achou = achou || marcar;
  }
  assert.equal(achou, true, `a opção "${valor}" não existe no formulário`);
}

/**
 * Personagem canônico sintético de conjurador, com espaços materializados.
 * @param {{classId?: string, slots?: object, pactUsed?: number|null, concentration?: string|null, known?: Array<object>}} params
 * @returns {object}
 */
function conjuradorSintetico({ classId = 'dnd2024:class:mago', slots = { 1: { used: 0, extra: 0 }, 2: { used: 0, extra: 0 } }, pactUsed = null, concentration = null, known = null } = {}) {
  const entradas = known ?? [
    { instanceId: 'sp-1', spellRef: { id: MISSEIS, packageVersion: '1.0.0' }, customDefinition: null, sourceInstanceId: null },
    { instanceId: 'sp-2', spellRef: { id: TEIA, packageVersion: '1.0.0' }, customDefinition: null, sourceInstanceId: null },
    { instanceId: 'sp-3', spellRef: { id: ENFEITICAR, packageVersion: '1.0.0' }, customDefinition: null, sourceInstanceId: 'talento-iniciado-1' },
  ];
  const base = createEmptyCharacter({ id: 'mag0-mag0-mag0', now: NOW, rulesetRef: RULESET_REF });
  return Object.freeze({
    ...base,
    identity: Object.freeze({ ...base.identity, name: 'Conjurador' }),
    build: Object.freeze({ ...base.build, classRef: Object.freeze({ id: classId, packageVersion: '1.0.0' }) }),
    state: Object.freeze({
      ...base.state,
      level: 5,
      spells: Object.freeze({
        ...base.state.spells,
        known: Object.freeze(entradas),
        prepared: Object.freeze([]),
        spellbook: Object.freeze([]),
        slots: Object.freeze(slots),
        pactSlots: Object.freeze({ used: pactUsed ?? 0 }),
        concentration,
      }),
    }),
    metadata: Object.freeze({ ...base.metadata, createdAt: NOW, updatedAt: NOW }),
  });
}

/**
 * Contexto de comando/consulta com a tabela de progressão informada — o canal
 * `context.spellcasting` que `domain/spells` exige (ver `spellcasting-queries.js`).
 * @param {object} [extras]
 * @returns {object}
 */
function contextoDeConjuracao(extras = {}) {
  return {
    registry: fakeRegistry(),
    maximumHitPoints: 30,
    now: NOW,
    spellcasting: { slotMaximums: { 1: 4, 2: 3 }, pactSlots: { maximum: 2, level: 3 }, cantripsKnown: 4, preparedLimit: 6 },
    ...extras,
  };
}

/**
 * ViewModel de um personagem sintético.
 * @param {object} character
 * @param {object} [contexto]
 * @returns {object}
 */
function vmSintetico(character, contexto = contextoDeConjuracao()) {
  const built = buildSheetViewModel(character, contexto);
  assert.equal(built.ok, true, `ViewModel falhou: ${built.error?.code}`);
  return built.value;
}

describe('unit/sheet/spells-spellbook — registro e delegação', () => {
  test('a seção é aceita pelo registro com o id canônico', () => {
    const criada = createSpellsSpellbookSection();
    assert.equal(criada.ok, true, criada.error?.code);
    assert.equal(criada.value.id, SPELLS_SPELLBOOK_SECTION_ID);
  });

  test('`select` não calcula: espaços e tetos são o eco de `derived`', () => {
    const vm = vmSintetico(conjuradorSintetico());
    const projection = selectSpellsSpellbook(vm);
    assert.deepEqual(
      projection.slots.map((slot) => slot.level),
      Object.values(vm.derived.spellSlots.byLevel).map((slot) => slot.level).sort((a, b) => a - b),
    );
    assert.equal(projection.cantripsKnown, vm.derived.spellSlots.cantripsKnown);
    assert.equal(projection.preparedLimit, vm.derived.spellSlots.preparedLimit);
    assert.equal(projection.saveDC, vm.derived.defenses.spellSaveDC);
    assert.equal(projection.attackBonus, vm.derived.defenses.spellAttackBonus);
    assert.equal(Object.isFrozen(projection), true);
  });

  test('ViewModel ausente vira estado declarado, nunca uma seção em branco', () => {
    assert.match(renderSpellsSpellbook(selectSpellsSpellbook(null)), /data-sheet-spells-unavailable/);
  });

  test('`toIntent` não toca no evento: só DESCREVE', () => {
    const dom = createTestDom();
    try {
      const raiz = montar(dom, vmSintetico(conjuradorSintetico()));
      let tocou = false;
      spellsSpellbookToIntent(
        {
          type: 'click',
          target: raiz.querySelector('[data-action]'),
          preventDefault: () => {
            tocou = true;
          },
          stopPropagation: () => {
            tocou = true;
          },
        },
        { root: raiz, projection: selectSpellsSpellbook(vmSintetico(conjuradorSintetico())), uiState: {} },
      );
      assert.equal(tocou, false);
    } finally {
      dom.restore();
    }
  });

  test('o markup não registra handler inline', () => {
    const dom = createTestDom();
    try {
      const raiz = montar(dom, vmSintetico(conjuradorSintetico()));
      assert.equal(/\son[a-z]+=/i.test(raiz.innerHTML), false);
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/spells-spellbook — nada vem de prosa', () => {
  test('o FONTE da seção não tem MAGIAS_EFEITO, regex de descrição nem nome de exibição', async () => {
    const fonte = await readFile(path.join(repoRoot, 'site/js/features/sheet/sections/spells-spellbook-section.js'), 'utf8');
    const codigo = fonte
      .split('\n')
      .filter((linha) => !linha.trimStart().startsWith('//'))
      .join('\n');

    assert.equal(codigo.includes('MAGIAS_EFEITO'), false);
    for (const proibido of ['.match(', '.test(', 'RegExp(', 'toLowerCase()']) {
      assert.equal(codigo.includes(proibido), false, `padrão de leitura de prosa proibido: ${proibido}`);
    }
    for (const nome of ['Mísseis Mágicos', 'Teia', 'Enfeitiçar', 'Mago', 'Bruxo', 'Feiticeiro']) {
      assert.equal(codigo.includes(nome), false, `comparação por nome de exibição: ${nome}`);
    }
  });
});

describe('unit/sheet/spells-spellbook — anti-bypass e múltiplos conjuradores', () => {
  test('os comandos declarados existem no dispatcher canônico', () => {
    const character = conjuradorSintetico();
    const desconhecidos = SPELLS_COMMAND_TYPES.filter((type) => {
      const resultado = executeCharacterCommand(character, { type }, contextoDeConjuracao());
      return resultado.ok !== true && resultado.error?.code === 'COMMAND_TYPE_UNKNOWN';
    });
    assert.deepEqual(desconhecidos, []);
  });

  test('todo `data-action` de COMANDO do markup é conhecido pelo dispatcher', () => {
    // Os `data-action` de FLUXO (abrir/fechar modal) não são comandos e são
    // excluídos explicitamente — não silenciosamente.
    const fluxo = new Set(Object.values(SPELL_FLOW_ACTIONS));
    const dom = createTestDom();
    const falhas = [];
    try {
      for (const registro of [...conjuradores, { character: conjuradorSintetico(), context: contextoDeConjuracao(), caseId: 'sintetico' }]) {
        const vm = registro.caseId === 'sintetico' ? vmSintetico(registro.character) : viewModelDe(registro);
        const raiz = montar(dom, vm);
        for (const elemento of raiz.querySelectorAll('[data-action]')) {
          const type = elemento.getAttribute('data-action');
          if (fluxo.has(type)) {
            continue;
          }
          const resultado = executeCharacterCommand(registro.character, { type }, registro.context);
          if (resultado.ok !== true && resultado.error?.code === 'COMMAND_TYPE_UNKNOWN') {
            falhas.push(`${registro.caseId}: ${type}`);
          }
        }
        raiz.remove();
      }
    } finally {
      dom.restore();
    }
    assert.deepEqual(falhas, []);
  });

  test('`data-action` inventado é recusado com COMMAND_TYPE_UNKNOWN', () => {
    const dom = createTestDom();
    try {
      const raiz = dom.document.createElement('div');
      raiz.innerHTML = '<button data-action="magia-inexistente">x</button>';
      dom.document.body.appendChild(raiz);
      const decision = spellsSpellbookToIntent(
        { type: 'click', target: raiz.querySelector('[data-action]') },
        { root: raiz, projection: {}, uiState: {} },
      );
      const resultado = executeCharacterCommand(conjuradorSintetico(), decision.intent.command, contextoDeConjuracao());
      assert.equal(resultado.ok, false);
      assert.equal(resultado.error.code, 'COMMAND_TYPE_UNKNOWN');
    } finally {
      dom.restore();
    }
  });

  test('toda magia de toda fixture de conjurador aparece na sua coleção', () => {
    const dom = createTestDom();
    const falhas = [];
    let cobertas = 0;
    try {
      for (const registro of conjuradores) {
        const vm = viewModelDe(registro);
        const raiz = montar(dom, vm);
        for (const collection of ['known', 'prepared', 'spellbook']) {
          for (const entry of vm.data.state.spells?.[collection] ?? []) {
            const alvo = entry?.spellRef?.id ?? entry?.instanceId ?? '';
            cobertas += 1;
            if (raiz.querySelector(`[data-sheet-spell="${alvo}"][data-collection="${collection}"]`) === null) {
              falhas.push(`${registro.caseId}/${collection}/${alvo}`);
            }
          }
        }
        raiz.remove();
      }
    } finally {
      dom.restore();
    }
    assert.deepEqual(falhas, []);
    assert.ok(cobertas > 0, 'nenhuma magia coberta — a paridade seria vazia');
  });
});

describe('unit/sheet/spells-spellbook — conjuração: os dois pools e a transação de modal', () => {
  test('cancelar o modal de conjuração NÃO emite comando nenhum', () => {
    const dom = createTestDom();
    try {
      const projection = selectSpellsSpellbook(vmSintetico(conjuradorSintetico()));
      const raiz = montar(dom, vmSintetico(conjuradorSintetico()));
      const abrir = raiz.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.castOpen}"][data-spell-id="${MISSEIS}"]`);
      const decisionAbrir = spellsSpellbookToIntent({ type: 'click', target: abrir }, { root: raiz, projection, uiState: {} });
      assert.equal(decisionAbrir.intent.type, SHEET_INTENT_TYPES.modalOpen);
      assert.equal(decisionAbrir.intent.modalId, SPELL_CAST_MODAL_ID);

      const modal = materializarModal(dom, decisionAbrir.intent);
      const cancelar = modal.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.castClose}"]`);
      const decisionCancelar = spellsSpellbookToIntent({ type: 'click', target: cancelar }, { root: modal, projection, uiState: {} });
      assert.equal(decisionCancelar.intent.type, SHEET_INTENT_TYPES.modalClose);
      assert.equal(Object.hasOwn(decisionCancelar.intent, 'command'), false, 'cancelar não pode carregar comando');
      assert.equal(decisionCancelar.intent.modalId, SPELL_CAST_MODAL_ID);
    } finally {
      dom.restore();
    }
  });

  test('conjurar por espaço comum gasta SÓ `state.spells.slots`, e por pacto SÓ `pactSlots`', () => {
    // É o erro que `cast-spell.js` documenta: um número de círculo sozinho é
    // ambíguo entre os dois pools de um Bruxo. Aqui os dois caminhos saem do
    // MESMO formulário e são conferidos no personagem resultante.
    const dom = createTestDom();
    try {
      const character = conjuradorSintetico({ classId: 'dnd2024:class:bruxo', pactUsed: 0 });
      const projection = selectSpellsSpellbook(vmSintetico(character));
      const raiz = montar(dom, vmSintetico(character));
      const abrir = raiz.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.castOpen}"][data-spell-id="${MISSEIS}"]`);
      const modal = materializarModal(
        dom,
        spellsSpellbookToIntent({ type: 'click', target: abrir }, { root: raiz, projection, uiState: {} }).intent,
      );

      // As duas opções coexistem no formulário — nunca uma soma das duas.
      const valores = [...modal.querySelectorAll('[data-sheet-cast-slot-source]')].map((no) => no.getAttribute('value'));
      assert.ok(valores.includes('pact-slot'), 'faltou a opção de espaço de pacto');
      assert.ok(valores.includes('spell-slot:1'), 'faltou a opção de espaço comum de 1º');
      assert.ok(valores.includes('at-will'), 'faltou a opção "à vontade"');

      const confirmar = modal.querySelector('[data-action="cast-spell"]');

      escolherFonte(modal, 'spell-slot:1');
      const porEspaco = spellsSpellbookToIntent({ type: 'click', target: confirmar }, { root: modal, projection, uiState: {} });
      assert.deepEqual(porEspaco.intent.command.slotSource, { kind: 'spell-slot', level: 1 });
      const resultadoEspaco = executeCharacterCommand(character, porEspaco.intent.command, contextoDeConjuracao());
      assert.equal(resultadoEspaco.ok, true, resultadoEspaco.error?.code);
      assert.equal(resultadoEspaco.character.state.spells.slots['1'].used, 1);
      assert.equal(resultadoEspaco.character.state.spells.pactSlots.used, 0, 'o pool de pacto foi tocado por engano');
      assert.deepEqual([...resultadoEspaco.affected], ['state.spells.slots']);

      escolherFonte(modal, 'pact-slot');
      const porPacto = spellsSpellbookToIntent({ type: 'click', target: confirmar }, { root: modal, projection, uiState: {} });
      assert.deepEqual(porPacto.intent.command.slotSource, { kind: 'pact-slot' });
      const resultadoPacto = executeCharacterCommand(character, porPacto.intent.command, contextoDeConjuracao());
      assert.equal(resultadoPacto.ok, true, resultadoPacto.error?.code);
      assert.equal(resultadoPacto.character.state.spells.pactSlots.used, 1);
      assert.equal(resultadoPacto.character.state.spells.slots['1'].used, 0, 'o pool comum foi tocado por engano');
      assert.deepEqual([...resultadoPacto.affected], ['state.spells.pactSlots']);
    } finally {
      dom.restore();
    }
  });

  test('a proveniência (`sourceInstanceId`) viaja SEMPRE, inclusive como `null`', () => {
    // `castSpell` exige a chave PRESENTE: `undefined` implícito viraria "fonte
    // base/classe" por acidente de digitação, e é a proveniência que separa
    // duas instâncias de "Iniciado em Magia".
    const dom = createTestDom();
    try {
      const character = conjuradorSintetico();
      const projection = selectSpellsSpellbook(vmSintetico(character));
      const raiz = montar(dom, vmSintetico(character));

      for (const [spellId, esperado] of [
        [MISSEIS, null],
        [ENFEITICAR, 'talento-iniciado-1'],
      ]) {
        const abrir = raiz.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.castOpen}"][data-spell-id="${spellId}"]`);
        const modal = materializarModal(
          dom,
          spellsSpellbookToIntent({ type: 'click', target: abrir }, { root: raiz, projection, uiState: {} }).intent,
        );
        escolherFonte(modal, 'at-will');
        const decision = spellsSpellbookToIntent(
          { type: 'click', target: modal.querySelector('[data-action="cast-spell"]') },
          { root: modal, projection, uiState: {} },
        );
        assert.equal(Object.hasOwn(decision.intent.command, 'sourceInstanceId'), true);
        assert.equal(decision.intent.command.sourceInstanceId, esperado);
        const resultado = executeCharacterCommand(character, decision.intent.command, contextoDeConjuracao());
        assert.equal(resultado.ok, true, `${spellId}: ${resultado.error?.code}`);
        modal.remove();
      }
    } finally {
      dom.restore();
    }
  });

  test('espaço esgotado é recusado com erro NOMEADO, e nada é decrementado', () => {
    const dom = createTestDom();
    try {
      const character = conjuradorSintetico({ slots: { 1: { used: 4, extra: 0 } } });
      const projection = selectSpellsSpellbook(vmSintetico(character));
      const raiz = montar(dom, vmSintetico(character));
      const abrir = raiz.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.castOpen}"][data-spell-id="${MISSEIS}"]`);
      const modal = materializarModal(
        dom,
        spellsSpellbookToIntent({ type: 'click', target: abrir }, { root: raiz, projection, uiState: {} }).intent,
      );
      escolherFonte(modal, 'spell-slot:1');
      const decision = spellsSpellbookToIntent(
        { type: 'click', target: modal.querySelector('[data-action="cast-spell"]') },
        { root: modal, projection, uiState: {} },
      );
      const resultado = executeCharacterCommand(character, decision.intent.command, contextoDeConjuracao());
      assert.equal(resultado.ok, false);
      assert.equal(resultado.error.code, 'CAST_SPELL_SLOT_EXHAUSTED');
      assert.deepEqual([...resultado.affected], []);
      assert.equal(resultado.character.state.spells.slots['1'].used, 4);
    } finally {
      dom.restore();
    }
  });

  test('REABRIR o mesmo modal para outra magia não vaza o formulário anterior', () => {
    // Cenário previsto pela revisão da Task 30: `openModal` passou a REABRIR
    // (fecha e redesenha) em vez de ignorar. Esta seção é o primeiro produtor de
    // modal com formulário; o conteúdo é descrito do zero a cada abertura, então
    // a escolha de espaço da magia anterior não pode sobreviver.
    const dom = createTestDom();
    try {
      const character = conjuradorSintetico();
      const projection = selectSpellsSpellbook(vmSintetico(character));
      const raiz = montar(dom, vmSintetico(character));

      const primeiro = materializarModal(
        dom,
        spellsSpellbookToIntent(
          { type: 'click', target: raiz.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.castOpen}"][data-spell-id="${MISSEIS}"]`) },
          { root: raiz, projection, uiState: {} },
        ).intent,
      );
      escolherFonte(primeiro, 'spell-slot:2');
      assert.equal(primeiro.querySelector('[data-sheet-cast-form]').getAttribute('data-spell-id'), MISSEIS);
      // O controller FECHA o anterior antes de abrir o novo (mesmo `modalId`).
      primeiro.remove();

      const segundoIntent = spellsSpellbookToIntent(
        { type: 'click', target: raiz.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.castOpen}"][data-spell-id="${TEIA}"]`) },
        { root: raiz, projection, uiState: {} },
      ).intent;
      assert.equal(segundoIntent.modalId, SPELL_CAST_MODAL_ID, 'a reabertura precisa usar o MESMO modalId');
      const segundo = materializarModal(dom, segundoIntent);

      // 1) O formulário fala da magia NOVA.
      assert.equal(segundo.querySelector('[data-sheet-cast-form]').getAttribute('data-spell-id'), TEIA);
      // 2) O formulário reaberto está VIRGEM: nenhuma opção marcada. Não é só
      // que a escolha anterior não vazou — é que a vista não escolhe espaço
      // nenhum no lugar do jogador.
      const marcados = [...segundo.querySelectorAll('[data-sheet-cast-slot-source]')].filter(
        (no) => no.checked === true || no.hasAttribute('checked'),
      );
      assert.equal(marcados.length, 0, 'o formulário não pode nascer com nenhuma opção de espaço marcada');
      // 3) E o comando resultante é da magia nova, SEM fonte de espaço — o
      // domínio recusa, em vez de conjurar de graça.
      const decision = spellsSpellbookToIntent(
        { type: 'click', target: segundo.querySelector('[data-action="cast-spell"]') },
        { root: segundo, projection, uiState: {} },
      );
      assert.equal(decision.intent.command.spellId, TEIA);
      assert.equal(
        Object.hasOwn(decision.intent.command, 'slotSource'),
        false,
        'confirmar sem tocar nos rádios não pode inventar uma fonte de espaço',
      );
      const recusa = executeCharacterCommand(conjuradorSintetico(), decision.intent.command, contextoDeConjuracao());
      assert.equal(recusa.ok, false);
      assert.equal(recusa.error.code, 'CAST_SPELL_SLOT_SOURCE_INVALID');
    } finally {
      dom.restore();
    }
  });

  test('o formulário de conjuração nasce SEM opção marcada, e confirmar sem escolher não conjura de graça', () => {
    // Regressão: "à vontade" nascia pré-marcado. Como `castSpell` aceita
    // `{kind:'at-will'}` sem conferir se a magia é truque, abrir "Conjurar"
    // numa magia de CÍRCULO e confirmar sem tocar em nada conjurava de graça,
    // sem gastar espaço e sem erro. A ausência de escolha tem de permanecer
    // ausência.
    const dom = createTestDom();
    try {
      const character = conjuradorSintetico();
      const projection = selectSpellsSpellbook(vmSintetico(character));
      const raiz = montar(dom, vmSintetico(character));
      // TEIA é magia de círculo (não é truque) — o caso exato do defeito.
      const abrir = raiz.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.castOpen}"][data-spell-id="${TEIA}"]`);
      const modal = materializarModal(
        dom,
        spellsSpellbookToIntent({ type: 'click', target: abrir }, { root: raiz, projection, uiState: {} }).intent,
      );

      const marcados = [...modal.querySelectorAll('[data-sheet-cast-slot-source]')].filter(
        (no) => no.checked === true || no.hasAttribute('checked'),
      );
      assert.equal(marcados.length, 0, 'nenhuma fonte de espaço pode vir pré-escolhida pela vista');

      const decision = spellsSpellbookToIntent(
        { type: 'click', target: modal.querySelector('[data-action="cast-spell"]') },
        { root: modal, projection, uiState: {} },
      );
      assert.equal(Object.hasOwn(decision.intent.command, 'slotSource'), false);
      const resultado = executeCharacterCommand(character, decision.intent.command, contextoDeConjuracao());
      assert.equal(resultado.ok, false, 'conjurar sem escolher fonte não pode dar certo');
      assert.equal(resultado.error.code, 'CAST_SPELL_SLOT_SOURCE_INVALID');
      assert.deepEqual([...resultado.affected], []);
    } finally {
      dom.restore();
    }
  });

  test('formulário sem fonte de espaço reconhecível sai SEM `slotSource`, recusado pelo domínio', () => {
    const dom = createTestDom();
    try {
      const raiz = dom.document.createElement('div');
      raiz.innerHTML =
        '<div data-sheet-modal-owner="x"><div data-sheet-cast-form data-spell-id="' +
        MISSEIS +
        '" data-source-instance-id=""><input type="radio" data-sheet-cast-slot-source value="ruim" checked></div>' +
        '<button data-action="cast-spell">c</button></div>';
      dom.document.body.appendChild(raiz);
      const decision = spellsSpellbookToIntent(
        { type: 'click', target: raiz.querySelector('[data-action="cast-spell"]') },
        { root: raiz, projection: {}, uiState: {} },
      );
      assert.equal(Object.hasOwn(decision.intent.command, 'slotSource'), false);
      const resultado = executeCharacterCommand(conjuradorSintetico(), decision.intent.command, contextoDeConjuracao());
      assert.equal(resultado.ok, false);
      assert.equal(resultado.error.code, 'CAST_SPELL_SLOT_SOURCE_INVALID');
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/spells-spellbook — CONCENTRAÇÃO: cancelar não muda nada, confirmar é UM comando', () => {
  test('sem concentração ativa, "Concentrar" é um comando direto (sem modal)', () => {
    const dom = createTestDom();
    try {
      const character = conjuradorSintetico({ concentration: null });
      const projection = selectSpellsSpellbook(vmSintetico(character));
      const raiz = montar(dom, vmSintetico(character));
      const botao = raiz.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.concentrationOpen}"][data-spell-id="${TEIA}"]`);
      const decision = spellsSpellbookToIntent({ type: 'click', target: botao }, { root: raiz, projection, uiState: {} });
      assert.equal(decision.intent.type, SHEET_INTENT_TYPES.command);
      assert.deepEqual(decision.intent.command, { type: 'set-concentration', spellId: TEIA });
      const resultado = executeCharacterCommand(character, decision.intent.command, contextoDeConjuracao());
      assert.equal(resultado.ok, true, resultado.error?.code);
      assert.equal(resultado.character.state.spells.concentration, TEIA);
    } finally {
      dom.restore();
    }
  });

  test('CANCELAR a substituição não muda absolutamente nada', () => {
    const dom = createTestDom();
    try {
      const character = conjuradorSintetico({ concentration: ENFEITICAR });
      const projection = selectSpellsSpellbook(vmSintetico(character));
      const raiz = montar(dom, vmSintetico(character));
      const abrir = raiz.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.concentrationOpen}"][data-spell-id="${TEIA}"]`);
      const intentAbrir = spellsSpellbookToIntent({ type: 'click', target: abrir }, { root: raiz, projection, uiState: {} }).intent;
      assert.equal(intentAbrir.type, SHEET_INTENT_TYPES.modalOpen);
      assert.equal(intentAbrir.modalId, CONCENTRATION_MODAL_ID);

      const modal = materializarModal(dom, intentAbrir);
      const decisionCancelar = spellsSpellbookToIntent(
        { type: 'click', target: modal.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.concentrationClose}"]`) },
        { root: modal, projection, uiState: {} },
      );
      assert.equal(decisionCancelar.intent.type, SHEET_INTENT_TYPES.modalClose);
      assert.equal(Object.hasOwn(decisionCancelar.intent, 'command'), false);
      // O personagem continua concentrado no que estava — nenhum resíduo.
      assert.equal(character.state.spells.concentration, ENFEITICAR);
    } finally {
      dom.restore();
    }
  });

  test('CONFIRMAR a substituição envia EXATAMENTE UM comando, e a troca é atômica', () => {
    // O ponto do brief. Dois comandos (encerrar + começar) poderiam parar no
    // meio e deixar o personagem sem concentração nenhuma;
    // `setConcentration` com `replaceConcentration: true` já derruba os efeitos
    // da anterior e grava a nova no MESMO CommandResult.
    const dom = createTestDom();
    try {
      const character = Object.freeze({
        ...conjuradorSintetico({ concentration: ENFEITICAR }),
        state: Object.freeze({
          ...conjuradorSintetico({ concentration: ENFEITICAR }).state,
          activeEffects: Object.freeze([
            Object.freeze({ effectInstanceId: 'ef-conc', sourceId: ENFEITICAR, data: Object.freeze({ concentration: true }) }),
            Object.freeze({ effectInstanceId: 'ef-livre', sourceId: 'outro', data: Object.freeze({ concentration: false }) }),
          ]),
        }),
      });
      const projection = selectSpellsSpellbook(vmSintetico(character));
      const raiz = montar(dom, vmSintetico(character));
      const abrir = raiz.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.concentrationOpen}"][data-spell-id="${TEIA}"]`);
      const modal = materializarModal(
        dom,
        spellsSpellbookToIntent({ type: 'click', target: abrir }, { root: raiz, projection, uiState: {} }).intent,
      );

      const confirmar = modal.querySelector('[data-action="set-concentration"]');
      const decision = spellsSpellbookToIntent({ type: 'click', target: confirmar }, { root: modal, projection, uiState: {} });

      // (1) UM comando — a intenção é UMA, e é de comando.
      assert.equal(decision.intent.type, SHEET_INTENT_TYPES.command);
      assert.deepEqual(decision.intent.command, { type: 'set-concentration', spellId: TEIA, replaceConcentration: true });
      // (2) e NÃO é `end-concentration` seguido de outra coisa.
      assert.notEqual(decision.intent.command.type, 'end-concentration');

      // (3) o comando único faz a troca COMPLETA: alvo novo e efeito de
      // concentração antigo derrubado, preservando o que não é de concentração.
      const resultado = executeCharacterCommand(character, decision.intent.command, contextoDeConjuracao());
      assert.equal(resultado.ok, true, resultado.error?.code);
      assert.equal(resultado.character.state.spells.concentration, TEIA);
      assert.deepEqual(
        resultado.character.state.activeEffects.map((efeito) => efeito.effectInstanceId),
        ['ef-livre'],
      );
      assert.deepEqual([...resultado.affected].sort(), ['state.activeEffects', 'state.spells.concentration']);
    } finally {
      dom.restore();
    }
  });

  test('sem a confirmação, o domínio recusa com CONCENTRATION_REPLACEMENT_REQUIRED', () => {
    // É o que torna o modal necessário: a regra não está na vista.
    const character = conjuradorSintetico({ concentration: ENFEITICAR });
    const resultado = executeCharacterCommand(character, { type: 'set-concentration', spellId: TEIA }, contextoDeConjuracao());
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CONCENTRATION_REPLACEMENT_REQUIRED');
  });

  test('conjurar com "substituir" marcado leva a confirmação no MESMO comando de conjuração', () => {
    const dom = createTestDom();
    try {
      const character = conjuradorSintetico({ concentration: ENFEITICAR });
      const projection = selectSpellsSpellbook(vmSintetico(character));
      const raiz = montar(dom, vmSintetico(character));
      const abrir = raiz.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.castOpen}"][data-spell-id="${TEIA}"]`);
      const modal = materializarModal(
        dom,
        spellsSpellbookToIntent({ type: 'click', target: abrir }, { root: raiz, projection, uiState: {} }).intent,
      );
      escolherFonte(modal, 'spell-slot:2');

      // Sem marcar: o domínio exige a confirmação.
      const semMarcar = spellsSpellbookToIntent(
        { type: 'click', target: modal.querySelector('[data-action="cast-spell"]') },
        { root: modal, projection, uiState: {} },
      );
      assert.equal(semMarcar.intent.command.replaceConcentration, false);
      const recusado = executeCharacterCommand(character, semMarcar.intent.command, contextoDeConjuracao());
      assert.equal(recusado.ok, false);
      assert.equal(recusado.error.code, 'CONCENTRATION_REPLACEMENT_REQUIRED');

      // Marcando: UM comando resolve conjuração E substituição.
      modal.querySelector('[data-sheet-cast-replace]').checked = true;
      const marcado = spellsSpellbookToIntent(
        { type: 'click', target: modal.querySelector('[data-action="cast-spell"]') },
        { root: modal, projection, uiState: {} },
      );
      assert.equal(marcado.intent.command.replaceConcentration, true);
      const aceito = executeCharacterCommand(character, marcado.intent.command, contextoDeConjuracao());
      assert.equal(aceito.ok, true, aceito.error?.code);
      assert.equal(aceito.character.state.spells.concentration, TEIA);
      assert.equal(aceito.character.state.spells.slots['2'].used, 1);
    } finally {
      dom.restore();
    }
  });

  test('sem concentração ativa não existe caixa de substituição no formulário', () => {
    const dom = createTestDom();
    try {
      const character = conjuradorSintetico({ concentration: null });
      const projection = selectSpellsSpellbook(vmSintetico(character));
      const raiz = montar(dom, vmSintetico(character));
      const modal = materializarModal(
        dom,
        spellsSpellbookToIntent(
          { type: 'click', target: raiz.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.castOpen}"][data-spell-id="${TEIA}"]`) },
          { root: raiz, projection, uiState: {} },
        ).intent,
      );
      assert.equal(modal.querySelector('[data-sheet-cast-replace]'), null);
    } finally {
      dom.restore();
    }
  });

  test('encerrar a concentração é o comando canônico, e sem concentração ele é recusado', () => {
    const dom = createTestDom();
    try {
      const comConcentracao = conjuradorSintetico({ concentration: TEIA });
      const raiz = montar(dom, vmSintetico(comConcentracao));
      const botao = raiz.querySelector('[data-action="end-concentration"]');
      assert.ok(botao, 'faltou o botão de encerrar concentração');
      const decision = spellsSpellbookToIntent(
        { type: 'click', target: botao },
        { root: raiz, projection: selectSpellsSpellbook(vmSintetico(comConcentracao)), uiState: {} },
      );
      assert.deepEqual(decision.intent.command, { type: 'end-concentration' });
      const encerrado = executeCharacterCommand(comConcentracao, decision.intent.command, contextoDeConjuracao());
      assert.equal(encerrado.ok, true);
      assert.equal(encerrado.character.state.spells.concentration, null);

      // Simetria: sem concentração, não há botão e o comando é recusado.
      const semConcentracao = conjuradorSintetico({ concentration: null });
      const raiz2 = montar(dom, vmSintetico(semConcentracao));
      assert.equal(raiz2.querySelector('[data-action="end-concentration"]'), null);
      assert.ok(raiz2.querySelector('[data-sheet-concentration-empty]'), 'faltou o estado vazio de concentração');
      const recusado = executeCharacterCommand(semConcentracao, { type: 'end-concentration' }, contextoDeConjuracao());
      assert.equal(recusado.ok, false);
      assert.equal(recusado.error.code, 'CONCENTRATION_NOT_ACTIVE');
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/spells-spellbook — detalhe da magia e Markdown seguro', () => {
  test('a descrição de uma magia CUSTOMIZADA é renderizada pelo Markdown seguro', () => {
    const dom = createTestDom();
    try {
      const character = conjuradorSintetico({
        known: [
          {
            instanceId: 'sp-custom',
            spellRef: null,
            customDefinition: { nome: 'Explosão Caseira', circulo: 1, escola: 'Evocação', descricao: 'Dano **2d6** ígneo.' },
            sourceInstanceId: null,
          },
        ],
      });
      const projection = selectSpellsSpellbook(vmSintetico(character));
      const raiz = montar(dom, vmSintetico(character));
      const botao = raiz.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.detailOpen}"]`);
      const intent = spellsSpellbookToIntent({ type: 'click', target: botao }, { root: raiz, projection, uiState: {} }).intent;
      assert.equal(intent.modalId, SPELL_DETAIL_MODAL_ID);
      const modal = materializarModal(dom, intent);
      const corpo = modal.querySelector('[data-sheet-spell-description]');
      assert.ok(corpo, 'faltou o corpo da descrição');
      // O Markdown da Task 24 transforma `**...**` em `<strong>` — a prova de
      // que a infraestrutura existente foi usada, e não um parser novo.
      assert.ok(corpo.querySelector('strong'), 'a ênfase do Markdown não foi aplicada');
      assert.match(corpo.textContent, /2d6/);
      assert.equal(modal.querySelector('[data-sheet-spell-detail-name]').textContent, 'Explosão Caseira');
    } finally {
      dom.restore();
    }
  });

  test('descrição HOSTIL sobrevive como TEXTO, nunca como markup', () => {
    const dom = createTestDom();
    try {
      const character = conjuradorSintetico({
        known: [
          {
            instanceId: 'sp-mau',
            spellRef: null,
            customDefinition: { nome: '<b>x</b>', circulo: 1, escola: '', descricao: '<script>alert(1)</script><img src=x onerror="alert(2)">' },
            sourceInstanceId: null,
          },
        ],
      });
      const projection = selectSpellsSpellbook(vmSintetico(character));
      const raiz = montar(dom, vmSintetico(character));
      const modal = materializarModal(
        dom,
        spellsSpellbookToIntent(
          { type: 'click', target: raiz.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.detailOpen}"]`) },
          { root: raiz, projection, uiState: {} },
        ).intent,
      );
      assert.equal(modal.querySelector('script'), null);
      assert.equal(modal.querySelector('img'), null);
      assert.equal(modal.querySelector('b'), null, 'o nome hostil virou markup');
      assert.match(modal.querySelector('[data-sheet-spell-description]').textContent, /alert\(1\)/);
    } finally {
      dom.restore();
    }
  });

  test('magia do CATÁLOGO declara o motivo da ausência de descrição', () => {
    // Lacuna 3 do cabeçalho da seção: a descrição de catálogo não está no
    // ViewModel. O modal DIZ isso, em vez de mostrar um corpo vazio que
    // pareceria "esta magia não tem descrição".
    const dom = createTestDom();
    try {
      const character = conjuradorSintetico();
      const projection = selectSpellsSpellbook(vmSintetico(character));
      const raiz = montar(dom, vmSintetico(character));
      const modal = materializarModal(
        dom,
        spellsSpellbookToIntent(
          { type: 'click', target: raiz.querySelector(`[data-action="${SPELL_FLOW_ACTIONS.detailOpen}"][data-spell-id="${MISSEIS}"]`) },
          { root: raiz, projection, uiState: {} },
        ).intent,
      );
      assert.ok(modal.querySelector(`[data-sheet-spell-detail-unavailable="${SPELL_DETAIL_UNAVAILABLE_REASON}"]`));
      assert.equal(modal.querySelector('[data-sheet-spell-description]'), null);
    } finally {
      dom.restore();
    }
  });

  test('fechar o detalhe não emite comando', () => {
    const dom = createTestDom();
    try {
      const raiz = dom.document.createElement('div');
      raiz.innerHTML = `<button data-action="${SPELL_FLOW_ACTIONS.detailClose}">x</button>`;
      dom.document.body.appendChild(raiz);
      const decision = spellsSpellbookToIntent(
        { type: 'click', target: raiz.querySelector('[data-action]') },
        { root: raiz, projection: {}, uiState: {} },
      );
      assert.equal(decision.intent.type, SHEET_INTENT_TYPES.modalClose);
      assert.equal(Object.hasOwn(decision.intent, 'command'), false);
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/spells-spellbook — estados vazios e lacunas declaradas', () => {
  test('sem espaços e sem magias, cada bloco tem o seu estado vazio DECLARADO', () => {
    const dom = createTestDom();
    try {
      const raiz = dom.document.createElement('div');
      raiz.innerHTML = renderSpellsSpellbook(
        selectSpellsSpellbook({ derived: { spellSlots: {}, defenses: {} }, data: { state: { spells: {} } } }),
      );
      dom.document.body.appendChild(raiz);
      assert.ok(raiz.querySelector('[data-sheet-slots-empty]'));
      assert.ok(raiz.querySelector('[data-sheet-concentration-empty]'));
      for (const collection of ['known', 'prepared', 'spellbook']) {
        assert.ok(raiz.querySelector(`[data-sheet-collection-empty="${collection}"]`), `faltou o vazio de ${collection}`);
      }
      // Ausência ≠ zero, também nos contadores.
      assert.equal(raiz.querySelector('[data-sheet-cantrips-known]').textContent, '—');
      assert.equal(raiz.querySelector('[data-sheet-prepared-limit]').textContent, '—');
      assert.equal(raiz.querySelector('[data-sheet-pact-maximum]').textContent, '—');
    } finally {
      dom.restore();
    }
  });

  // ATUALIZAÇÃO CONSCIENTE (correção C1 da revisão final): o teste que aqui
  // travava a AUSÊNCIA de botões de preparo (e a nota
  // `SHEET_SPELL_SELECTION_NO_CANONICAL_COMMAND`) foi INVERTIDO — os comandos
  // canônicos existem agora (`domain/spells/spell-preparation.js`) e a seção
  // os emite. O que fica declarado é a lacuna REMANESCENTE: o picker de
  // catálogo (adicionar magia nova via busca).
  test('as lacunas remanescentes são DECLARADAS, e os controles de preparo têm comando por trás', () => {
    const markup = renderSpellsSpellbook(selectSpellsSpellbook(vmSintetico(conjuradorSintetico())));
    assert.match(markup, new RegExp(`data-sheet-spell-catalog-picker-unavailable="${CATALOG_PICKER_UNAVAILABLE_REASON}"`));
    assert.match(markup, new RegExp(`data-sheet-metamagic-unavailable="${METAMAGIC_UNAVAILABLE_REASON}"`));
    // A nota antiga saiu junto com a lacuna que a justificava.
    assert.equal(markup.includes('SHEET_SPELL_SELECTION_NO_CANONICAL_COMMAND'), false);
    // Magias conhecidas do catálogo ganham "Preparar" (o dispatcher conhece o
    // tipo — conferido pelo teste de anti-bypass acima).
    assert.match(markup, /data-action="prepare-spell"/);
  });

  test('os contadores do baseline (truques/preparadas) estão presentes com o valor derivado', () => {
    const dom = createTestDom();
    try {
      const raiz = montar(dom, vmSintetico(conjuradorSintetico()));
      assert.equal(raiz.querySelector('[data-sheet-cantrips-known]').textContent, '4');
      assert.equal(raiz.querySelector('[data-sheet-prepared-limit]').textContent, '6');
    } finally {
      dom.restore();
    }
  });
});

// ============================================================
// Correção C1 da revisão final: preparar/despreparar e grimório — da SEÇÃO ao
// EFEITO persistido, nunca só a intenção (2 bugs já foram congelados neste
// projeto por testes que paravam na intenção).
// ============================================================

/**
 * Entrada canônica de magia para as fixtures de preparo.
 * @param {string} spellId
 * @param {{source?: string|null, instanceId?: string}} [opts]
 * @returns {object}
 */
function entradaDeMagia(spellId, { source = null, instanceId = null } = {}) {
  return Object.freeze({
    instanceId: instanceId ?? `fx:${spellId}`,
    spellRef: Object.freeze({ id: spellId, packageVersion: '1.0.0' }),
    customDefinition: null,
    sourceInstanceId: source,
  });
}

/**
 * Substitui coleções de `state.spells` num personagem sintético (imutável).
 * @param {object} character
 * @param {object} colecoes
 * @returns {object}
 */
function comColecoes(character, colecoes) {
  return Object.freeze({
    ...character,
    state: Object.freeze({
      ...character.state,
      spells: Object.freeze({ ...character.state.spells, ...colecoes }),
    }),
  });
}

describe('unit/sheet/spells-spellbook — preparo e grimório (C1): seção -> comando -> efeito -> persistência', () => {
  test('PREPARAR uma conhecida: o clique atravessa até o efeito e sobrevive a salvar -> recarregar', () => {
    const dom = createTestDom();
    try {
      const character = conjuradorSintetico();
      const raiz = montar(dom, vmSintetico(character));
      const botao = raiz.querySelector(`[data-action="prepare-spell"][data-spell-id="${MISSEIS}"]`);
      assert.ok(botao, 'a conhecida do catálogo deveria ter o botão Preparar');
      const decision = spellsSpellbookToIntent(
        { type: 'click', target: botao },
        { root: raiz, projection: selectSpellsSpellbook(vmSintetico(character)), uiState: {} },
      );
      // A intenção só DESCREVE; a chave `sourceInstanceId` viaja presente
      // mesmo `null` (disciplina de `cast-spell`).
      assert.deepEqual(decision.intent.command, { type: 'prepare-spell', spellId: MISSEIS, sourceInstanceId: null });

      // EFEITO no dispatcher REAL, com o contexto de produção (registry +
      // tabela de conjuração).
      const resultado = executeCharacterCommand(character, decision.intent.command, contextoDeConjuracao());
      assert.equal(resultado.ok, true, resultado.error?.code);
      assert.deepEqual(resultado.affected, ['state.spells.prepared']);
      const preparadas = resultado.character.state.spells.prepared;
      assert.equal(preparadas.length, 1);
      assert.equal(preparadas[0].spellRef.id, MISSEIS);
      // Imutabilidade: o personagem de entrada não mudou.
      assert.equal(character.state.spells.prepared.length, 0);

      // PERSISTÊNCIA: preparar -> salvar (encode) -> recarregar (decode)
      // preserva a preparada — o codec já faz round-trip de `state.spells`
      // (grimório incluído desde a Task 28b).
      const encoded = encodeCharacterRecord(resultado.character, codecCtx);
      assert.equal(encoded.ok, true, encoded.error?.message);
      assert.equal(encoded.value.magias_preparadas.length, 1);
      const decoded = decodeCharacterRecord(encoded.value, codecCtx);
      assert.equal(decoded.ok, true);
      assert.equal(decoded.value.mode, 'editable');
      const recarregadas = decoded.value.character.state.spells.prepared;
      assert.equal(recarregadas.length, 1);
      assert.equal(recarregadas[0].spellRef?.id, MISSEIS);
    } finally {
      dom.restore();
    }
  });

  test('GRIMÓRIO: Preparar viaja com preparedFrom="spellbook" e o domínio exige a magia no grimório', () => {
    const dom = createTestDom();
    try {
      const character = comColecoes(conjuradorSintetico(), {
        known: Object.freeze([]),
        spellbook: Object.freeze([entradaDeMagia(TEIA)]),
      });
      const raiz = montar(dom, vmSintetico(character));
      const botao = raiz.querySelector(
        `[data-sheet-collection-list="spellbook"] [data-action="prepare-spell"][data-spell-id="${TEIA}"]`,
      );
      assert.ok(botao, 'a entrada do grimório deveria ter o botão Preparar');
      const decision = spellsSpellbookToIntent(
        { type: 'click', target: botao },
        { root: raiz, projection: selectSpellsSpellbook(vmSintetico(character)), uiState: {} },
      );
      assert.deepEqual(decision.intent.command, {
        type: 'prepare-spell',
        spellId: TEIA,
        sourceInstanceId: null,
        preparedFrom: 'spellbook',
      });
      const resultado = executeCharacterCommand(character, decision.intent.command, contextoDeConjuracao());
      assert.equal(resultado.ok, true, resultado.error?.code);
      assert.equal(resultado.character.state.spells.prepared[0].spellRef.id, TEIA);

      // Fora do grimório, o MESMO comando é recusado com o erro NOMEADO da
      // Task 18 — prova de que a regra reusada é `validateSpellSelection`.
      const recusa = executeCharacterCommand(
        character,
        { type: 'prepare-spell', spellId: MISSEIS, sourceInstanceId: null, preparedFrom: 'spellbook' },
        contextoDeConjuracao(),
      );
      assert.equal(recusa.ok, false);
      assert.equal(recusa.error.code, 'SPELL_SELECTION_NOT_IN_SPELLBOOK');
      assert.deepEqual(recusa.affected, []);
      assert.equal(recusa.character, character);
    } finally {
      dom.restore();
    }
  });

  test('DESPREPARAR remove só de preparadas; REMOVER do grimório também derruba a preparada', () => {
    const dom = createTestDom();
    try {
      const character = comColecoes(conjuradorSintetico(), {
        known: Object.freeze([]),
        prepared: Object.freeze([entradaDeMagia(TEIA, { instanceId: 'fx:prep:teia' })]),
        spellbook: Object.freeze([entradaDeMagia(TEIA, { instanceId: 'fx:grim:teia' })]),
      });
      const raiz = montar(dom, vmSintetico(character));
      // Preparada ganha Despreparar; a entrada do grimório (mesma magia)
      // também mostra Despreparar em vez de Preparar.
      const despreparar = raiz.querySelector(
        `[data-sheet-collection-list="prepared"] [data-action="unprepare-spell"][data-spell-id="${TEIA}"]`,
      );
      assert.ok(despreparar);
      assert.ok(
        raiz.querySelector(`[data-sheet-collection-list="spellbook"] [data-action="unprepare-spell"][data-spell-id="${TEIA}"]`),
      );
      const decisao = spellsSpellbookToIntent(
        { type: 'click', target: despreparar },
        { root: raiz, projection: selectSpellsSpellbook(vmSintetico(character)), uiState: {} },
      );
      const despreparado = executeCharacterCommand(character, decisao.intent.command, contextoDeConjuracao());
      assert.equal(despreparado.ok, true, despreparado.error?.code);
      assert.equal(despreparado.character.state.spells.prepared.length, 0);
      // "permanece no grimório" (baseline linha 13672).
      assert.equal(despreparado.character.state.spells.spellbook.length, 1);

      // REMOVER do grimório: derruba grimório E preparada (baseline 13686-13688).
      const remover = raiz.querySelector(`[data-action="remove-spellbook-spell"][data-spell-id="${TEIA}"]`);
      assert.ok(remover);
      const decisaoRemover = spellsSpellbookToIntent(
        { type: 'click', target: remover },
        { root: raiz, projection: selectSpellsSpellbook(vmSintetico(character)), uiState: {} },
      );
      const removido = executeCharacterCommand(character, decisaoRemover.intent.command, contextoDeConjuracao());
      assert.equal(removido.ok, true, removido.error?.code);
      assert.equal(removido.character.state.spells.spellbook.length, 0);
      assert.equal(removido.character.state.spells.prepared.length, 0);
      assert.deepEqual(removido.affected, ['state.spells.spellbook', 'state.spells.prepared']);
    } finally {
      dom.restore();
    }
  });

  test('LIMITE de preparadas excedido é recusa NOMEADA sem mutação (limite da tabela, nunca inventado)', () => {
    const character = conjuradorSintetico();
    const contexto = contextoDeConjuracao({
      spellcasting: { slotMaximums: { 1: 4, 2: 3 }, preparedLimit: 0 },
    });
    const resultado = executeCharacterCommand(
      character,
      { type: 'prepare-spell', spellId: MISSEIS, sourceInstanceId: null },
      contexto,
    );
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'SPELL_SELECTION_LIMIT_EXCEEDED');
    assert.deepEqual(resultado.affected, []);
    assert.equal(resultado.character, character);
  });

  test('magia SEMPRE PREPARADA (grant ":prepared") não é despreparável — recusa nomeada', () => {
    const character = comColecoes(conjuradorSintetico(), {
      prepared: Object.freeze([
        entradaDeMagia(MISSEIS, { source: 'especie-aasimar-1', instanceId: 'especie-aasimar-1:luz:prepared' }),
      ]),
    });
    const resultado = executeCharacterCommand(
      character,
      { type: 'unprepare-spell', spellId: MISSEIS, sourceInstanceId: 'especie-aasimar-1' },
      contextoDeConjuracao(),
    );
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'UNPREPARE_SPELL_ALWAYS_PREPARED');
    assert.equal(resultado.character, character);
  });

  test('add-spellbook-spell existe no vocabulário (o picker é a lacuna, não o comando)', () => {
    const character = comColecoes(conjuradorSintetico(), { known: Object.freeze([]), spellbook: Object.freeze([]) });
    const resultado = executeCharacterCommand(
      character,
      { type: 'add-spellbook-spell', spellId: TEIA, sourceInstanceId: null },
      contextoDeConjuracao(),
    );
    assert.equal(resultado.ok, true, resultado.error?.code);
    assert.equal(resultado.character.state.spells.spellbook[0].spellRef.id, TEIA);
    assert.deepEqual(resultado.affected, ['state.spells.spellbook']);
  });
});
