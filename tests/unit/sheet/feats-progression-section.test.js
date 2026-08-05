// Teste focal de `features/sheet/sections/feats-progression-section.js` (Task 30).
//
// O que este arquivo prova:
//
//  1. a seção é registrável, pura e sem estado próprio;
//  2. os DOIS modos do fluxo de level-up são alcançáveis a partir do MESMO
//     clique, e a flag `feature.levelup.flow.v2` (via `uiState`) é o único
//     interruptor — a seção não escolhe um modo por omissão;
//  3. CANCELAR não muta nada: produz `sheet/modal-close` e mais nada. Confirmar
//     produz o comando canônico `level-up`, o mesmo nos dois modos;
//  4. anti-bypass: qualquer `data-action` fora do vocabulário vira comando
//     recusado pelo dispatcher, nunca um clique inerte.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createTestDom } from '../../helpers/test-dom.js';
import { executeCharacterCommand } from '../../../site/js/domain/commands/command-dispatcher.js';
import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import { SHEET_INTENT_TYPES } from '../../../site/js/features/sheet/sheet-state.js';
import { LEVEL_UP_FLOW_ACTIONS, LEVEL_UP_MODAL_ID } from '../../../site/js/features/sheet/sections/level-up-flow-view.js';
import {
  FEATS_PROGRESSION_COMMAND_TYPES,
  FEATS_PROGRESSION_SECTION_ID,
  OPEN_LEVEL_UP_ACTION,
  createFeatsProgressionSection,
  featsProgressionToIntent,
  renderFeatsProgression,
  selectFeatsProgression,
} from '../../../site/js/features/sheet/sections/feats-progression-section.js';

const NOW = '2026-08-03T00:00:00.000Z';
const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

/**
 * ViewModel mínimo desta seção (a seção só lê `data`/`derived`, nunca o
 * personagem canônico).
 * @param {object} [overrides]
 * @returns {object}
 */
function viewModel(overrides = {}) {
  return {
    derived: { proficiencyBonus: 3, ...(overrides.derived ?? {}) },
    data: {
      state: { level: 5, xp: 6500, hitPointRolls: [8, 5, 6, 4], ...(overrides.state ?? {}) },
      build: {
        featRefs: [{ id: 'dnd2024:feat:combatente-habil', name: 'Combatente Hábil' }],
        subclassRef: { id: 'dnd2024:subclass:dominio-da-vida', name: 'Domínio da Vida' },
        choices: {},
        ...(overrides.build ?? {}),
      },
    },
  };
}

/**
 * Monta o markup dado dentro do contêiner de seção real.
 * @param {object} dom
 * @param {string} markup
 * @returns {object}
 */
function montar(dom, markup) {
  const raiz = dom.document.createElement('div');
  raiz.setAttribute('data-sheet-section', FEATS_PROGRESSION_SECTION_ID);
  raiz.innerHTML = markup;
  dom.document.body.appendChild(raiz);
  return raiz;
}

describe('unit/sheet/feats-progression-section — registro, projeção e render', () => {
  test('a seção é aceita pelo registro com o id canônico', () => {
    const criada = createFeatsProgressionSection();
    assert.equal(criada.ok, true, criada.error?.code);
    assert.equal(criada.value.id, FEATS_PROGRESSION_SECTION_ID);
  });

  test('`select` é eco, não conta: nível, XP, talentos e rolagens vêm crus do ViewModel', () => {
    const vm = viewModel();
    const projection = selectFeatsProgression(vm);
    assert.equal(projection.level, 5);
    assert.equal(projection.xp, 6500);
    assert.deepEqual([...projection.hitPointRolls], [8, 5, 6, 4]);
    assert.equal(projection.featRefs.length, 1);
    assert.equal(Object.isFrozen(projection), true);
  });

  test('ViewModel ausente vira estado DECLARADO, nunca uma seção vazia', () => {
    const markup = renderFeatsProgression(selectFeatsProgression(null));
    assert.match(markup, /data-sheet-progression-unavailable/);
  });

  test('o markup traz nível, XP, talentos, rolagens e o botão de subir de nível', () => {
    const markup = renderFeatsProgression(selectFeatsProgression(viewModel()));
    for (const marcador of [
      'data-sheet-level',
      'data-sheet-xp',
      'data-sheet-feats',
      'data-sheet-hit-point-rolls',
      `data-action="${OPEN_LEVEL_UP_ACTION}"`,
    ]) {
      assert.ok(markup.includes(marcador), `faltou "${marcador}"`);
    }
    assert.match(markup, /Combatente Hábil/);
    assert.equal(/\son[a-z]+\s*=/i.test(markup), false, 'handler inline no markup');
  });

  test('personagem sem talento mostra a ausência explicitamente', () => {
    const markup = renderFeatsProgression(selectFeatsProgression(viewModel({ build: { featRefs: [] } })));
    assert.match(markup, /data-sheet-feats-empty/);
  });

  test('nome de talento hostil vira TEXTO, nunca markup', () => {
    const markup = renderFeatsProgression(
      selectFeatsProgression(viewModel({ build: { featRefs: [{ id: 'x', name: '<img src=x onerror="window.__xss=1">' }] } })),
    );
    assert.equal(markup.includes('<img'), false);
    assert.match(markup, /&lt;img/);
  });
});

describe('unit/sheet/feats-progression-section — os dois modos do fluxo de level-up', () => {
  test('a flag `false` abre o modo LEGADO; a flag `true` abre o fluxo em cards', () => {
    const dom = createTestDom();
    try {
      const raiz = montar(dom, renderFeatsProgression(selectFeatsProgression(viewModel())));
      const botao = raiz.querySelector(`[data-action="${OPEN_LEVEL_UP_ACTION}"]`);
      const projection = selectFeatsProgression(viewModel());

      const legado = featsProgressionToIntent({ type: 'click', target: botao }, { root: raiz, projection, uiState: { levelUpFlowV2: false } });
      assert.equal(legado.intent.type, SHEET_INTENT_TYPES.modalOpen);
      assert.equal(legado.intent.modalId, LEVEL_UP_MODAL_ID);
      assert.equal(legado.intent.mode, 'legacy');
      assert.match(legado.intent.content, /feature\.levelup\.flow\.v2/);
      assert.match(legado.intent.actions, /id="btn-enable-levelup-v2"/);

      const v2 = featsProgressionToIntent({ type: 'click', target: botao }, { root: raiz, projection, uiState: { levelUpFlowV2: true } });
      assert.equal(v2.intent.mode, 'v2');
      // Sem `derived.levelUp` a projeção do nível não existe: o modo v2 mostra
      // o ERRO DECLARADO, e não um conjunto de cartões vazio (que diria, de
      // forma falsa, "este nível não pede nada").
      assert.match(v2.intent.content, /data-levelup-error=/);

      // MESMO modal nos dois modos: são vistas de um fluxo só.
      assert.equal(v2.intent.modalId, legado.intent.modalId);
    } finally {
      dom.restore();
    }
  });

  test('"Ativar V2 e continuar" reabre o MESMO modal já no modo v2', () => {
    const dom = createTestDom();
    try {
      const raiz = montar(dom, `<button data-action="${LEVEL_UP_FLOW_ACTIONS.enableV2}">x</button>`);
      const botao = raiz.querySelector('[data-action]');
      const decision = featsProgressionToIntent(
        { type: 'click', target: botao },
        { root: raiz, projection: selectFeatsProgression(viewModel()), uiState: { levelUpFlowV2: false } },
      );
      assert.equal(decision.intent.type, SHEET_INTENT_TYPES.modalOpen);
      assert.equal(decision.intent.mode, 'v2');
      assert.equal(decision.intent.levelUpFlowV2, true);
    } finally {
      dom.restore();
    }
  });

  test('CANCELAR fecha o modal e não emite comando nenhum (nenhuma alteração parcial)', () => {
    const dom = createTestDom();
    try {
      const raiz = montar(dom, `<button data-action="${LEVEL_UP_FLOW_ACTIONS.close}">Cancelar</button>`);
      const botao = raiz.querySelector('[data-action]');
      const decision = featsProgressionToIntent({ type: 'click', target: botao }, { root: raiz, projection: {}, uiState: {} });
      assert.equal(decision.intent.type, SHEET_INTENT_TYPES.modalClose);
      assert.equal(decision.intent.modalId, LEVEL_UP_MODAL_ID);
      // A intenção de fechar NÃO carrega comando: não há caminho de mutação
      // saindo de um cancelamento.
      assert.equal(Object.hasOwn(decision.intent, 'command'), false);
    } finally {
      dom.restore();
    }
  });

  test('CONFIRMAR emite o comando canônico `level-up` com a seleção lida dos campos', () => {
    const dom = createTestDom();
    try {
      const raiz = montar(
        dom,
        `<div data-sheet-modal-owner="${FEATS_PROGRESSION_SECTION_ID}">` +
          '<input data-levelup-hit-points value="6">' +
          '<input data-levelup-subclass value="dnd2024:subclass:dominio-da-vida">' +
          `<button data-action="${LEVEL_UP_FLOW_ACTIONS.confirm}">Confirmar</button>` +
          '</div>',
      );
      const botao = raiz.querySelector('[data-action]');
      const decision = featsProgressionToIntent({ type: 'click', target: botao }, { root: raiz, projection: {}, uiState: {} });
      assert.equal(decision.intent.type, SHEET_INTENT_TYPES.command);
      assert.equal(decision.intent.command.type, 'level-up');
      assert.deepEqual(decision.intent.command.selection.hitPoints, { rolled: 6 });
      assert.equal(decision.intent.command.selection.subclassRef, 'dnd2024:subclass:dominio-da-vida');
    } finally {
      dom.restore();
    }
  });

  test('campo vazio NÃO vira valor plausível: a seleção sai incompleta e o domínio recusa', () => {
    const dom = createTestDom();
    try {
      const raiz = montar(
        dom,
        `<div data-sheet-modal-owner="${FEATS_PROGRESSION_SECTION_ID}">` +
          '<input data-levelup-hit-points value="">' +
          `<button data-action="${LEVEL_UP_FLOW_ACTIONS.confirm}">Confirmar</button>` +
          '</div>',
      );
      const botao = raiz.querySelector('[data-action]');
      const decision = featsProgressionToIntent({ type: 'click', target: botao }, { root: raiz, projection: {}, uiState: {} });
      assert.equal(Object.hasOwn(decision.intent.command.selection, 'hitPoints'), false);

      const personagem = createEmptyCharacter({ id: 'prog-0001-0001', now: NOW, rulesetRef: RULESET_REF });
      const resultado = executeCharacterCommand(personagem, decision.intent.command, { now: NOW });
      assert.equal(resultado.ok, false);
      // Erro NOMEADO do domínio de progressão — nunca um level-up "quase certo".
      assert.ok(typeof resultado.error.code === 'string' && resultado.error.code.startsWith('LEVEL_UP_'));
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/feats-progression-section — anti-bypass', () => {
  test('os comandos declarados existem no dispatcher canônico', () => {
    const personagem = createEmptyCharacter({ id: 'prog-0001-0002', now: NOW, rulesetRef: RULESET_REF });
    const desconhecidos = FEATS_PROGRESSION_COMMAND_TYPES.filter((type) => {
      const resultado = executeCharacterCommand(personagem, { type }, { now: NOW });
      return resultado.ok !== true && resultado.error?.code === 'COMMAND_TYPE_UNKNOWN';
    });
    assert.deepEqual(desconhecidos, []);
  });

  test('`data-action` desconhecido vira erro DECLARADO, nunca no-op', () => {
    const dom = createTestDom();
    try {
      const raiz = montar(dom, '<button data-action="acao-inexistente">x</button>');
      const botao = raiz.querySelector('[data-action]');
      const decision = featsProgressionToIntent({ type: 'click', target: botao }, { root: raiz, projection: {}, uiState: {} });
      assert.equal(decision.intent.type, SHEET_INTENT_TYPES.command);

      const personagem = createEmptyCharacter({ id: 'prog-0001-0003', now: NOW, rulesetRef: RULESET_REF });
      const resultado = executeCharacterCommand(personagem, decision.intent.command, { now: NOW });
      assert.equal(resultado.ok, false);
      assert.equal(resultado.error.code, 'COMMAND_TYPE_UNKNOWN');
    } finally {
      dom.restore();
    }
  });

  test('a seção não toca no evento nem registra listener', () => {
    const dom = createTestDom();
    try {
      const raiz = montar(dom, `<button data-action="${OPEN_LEVEL_UP_ACTION}">x</button>`);
      let tocou = false;
      featsProgressionToIntent(
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
        { root: raiz, projection: {}, uiState: {} },
      );
      assert.equal(tocou, false);
    } finally {
      dom.restore();
    }
  });
});
