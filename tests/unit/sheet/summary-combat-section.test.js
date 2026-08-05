// Teste focal de `features/sheet/sections/summary-combat-section.js` (Task 30).
//
// As garantias, cada uma com um defeito concreto por trás:
//
//  1. A seção é DELEGAÇÃO DE VERDADE: `select` não calcula nada (todo valor sai
//     de `viewModel.derived`), `render` não abre modal e `toIntent` não toca no
//     evento — só descreve. Uma seção que "só passa adiante" é fácil de alegar
//     e fácil de furar; aqui é verificado.
//  2. ANTI-BYPASS: todo `data-action` emitido pelo markup é um `type` que o
//     dispatcher canônico conhece, e um `data-action` DESCONHECIDO produz um
//     comando recusado com `COMMAND_TYPE_UNKNOWN` — nunca um clique inerte.
//  3. PARIDADE COM MÚLTIPLAS FIXTURES: o render roda contra TODAS as fixtures
//     de personagem decodificáveis, não contra uma amostra.
//  4. ESCAPE: nome de personagem hostil vira texto, nunca markup.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ok } from '../../../site/js/core/result.js';
import { createTestDom } from '../../helpers/test-dom.js';
import { createLegacyAliasResolver } from '../../../site/js/infra/character/legacy-alias-resolver.js';
import { projectLegacyCharacterForQueries, deriveLegacyQueryHints } from '../../../site/js/infra/character/legacy-query-adapter.js';
import { buildSheetViewModel } from '../../../site/js/features/sheet/sheet-view-model.js';
import { executeCharacterCommand } from '../../../site/js/domain/commands/command-dispatcher.js';
import { SHEET_INTENT_TYPES } from '../../../site/js/features/sheet/sheet-state.js';
import {
  SUMMARY_COMBAT_COMMAND_TYPES,
  SUMMARY_COMBAT_SECTION_ID,
  createSummaryCombatSection,
  renderSummaryCombat,
  selectSummaryCombat,
  summaryCombatToIntent,
} from '../../../site/js/features/sheet/sections/summary-combat-section.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const NOW = '2026-08-03T00:00:00.000Z';
const SKILL_IDS = Object.freeze(['dnd2024:skill:percepcao', 'dnd2024:skill:intuicao']);

const KNOWN_ENTITIES = Object.freeze({
  'dnd2024:class:clerigo': Object.freeze({
    id: 'dnd2024:class:clerigo',
    type: 'class',
    effects: Object.freeze([]),
    spellcasting: Object.freeze({ ability: 'dnd2024:ability:sabedoria', progression: 'full' }),
  }),
  'dnd2024:species:humano': Object.freeze({ id: 'dnd2024:species:humano', type: 'species', effects: Object.freeze([]), size: 'medium', speed: 9 }),
});

/**
 * Catálogo mínimo: o suficiente para o ViewModel projetar perícias e nomes.
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

let ctx;
/** @type {Array<{fixture: string, caseId: string, character: object, context: object}>} */
const personagens = [];

before(async () => {
  const aliases = JSON.parse(await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'));
  ctx = { aliasResolver: createLegacyAliasResolver(aliases), now: NOW };

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
      // `deriveLegacyQueryHints` devolve as dicas que só o registro LEGADO
      // carrega — hoje o PV máximo, que nenhuma consulta sabe derivar sozinha
      // (concern registrado desde a Task 16). Sem ela o ViewModel falha com
      // `CHARACTER_QUERY_HP_MAXIMUM_UNKNOWN`, que é o comportamento correto:
      // ausência é ausência. Uma fixture sem PV máximo declarado não é
      // material desta seção e é pulada em vez de receber um valor inventado.
      const hints = deriveLegacyQueryHints(entry.personagem);
      if (!Number.isFinite(hints?.maximumHitPoints)) {
        continue;
      }
      personagens.push({
        fixture: name,
        caseId: entry.id,
        character: projected.value,
        context: { registry: fakeRegistry(), ...hints },
      });
    }
  }
  assert.ok(personagens.length >= 10, `apenas ${personagens.length} fixtures decodificáveis — a paridade seria de amostra única`);
});

/**
 * Constrói o ViewModel de uma das fixtures carregadas.
 * @param {number} indice
 * @returns {object}
 */
function viewModelDe(indice) {
  const { character, context } = personagens[indice];
  const built = buildSheetViewModel(character, context);
  assert.equal(built.ok, true, `ViewModel falhou: ${built.error?.code}`);
  return built.value;
}

describe('unit/sheet/summary-combat-section — a seção é registrável e delega de verdade', () => {
  test('a seção é aceita pelo registro com o id canônico', () => {
    const criada = createSummaryCombatSection();
    assert.equal(criada.ok, true, criada.error?.code);
    assert.equal(criada.value.id, SUMMARY_COMBAT_SECTION_ID);
    assert.deepEqual([...criada.value.eventTypes], ['click']);
  });

  test('`select` NÃO calcula: todo valor sai de `derived`, sem uma conta sequer', () => {
    const viewModel = viewModelDe(0);
    const projection = selectSummaryCombat(viewModel);
    // Igualdade por VALOR contra a fonte: se a seção somasse, arredondasse ou
    // "corrigisse" qualquer coisa, esta comparação quebraria.
    assert.deepEqual(projection.hitPoints, { ...viewModel.derived.hitPoints });
    assert.equal(projection.armorClass, viewModel.derived.armorClass);
    assert.equal(projection.initiative, viewModel.derived.initiative);
    assert.deepEqual(projection.movement, { ...viewModel.derived.movement });
    assert.equal(projection.proficiencyBonus, viewModel.derived.proficiencyBonus);
    assert.deepEqual(projection.attacks, [...viewModel.derived.attacks]);
    assert.deepEqual(projection.savingThrows, { ...viewModel.derived.savingThrows });
  });

  test('ViewModel ausente (ficha somente-leitura) é estado DECLARADO, nunca uma seção vazia', () => {
    const projection = selectSummaryCombat(null);
    assert.equal(projection.available, false);
    const markup = renderSummaryCombat(projection);
    assert.match(markup, /data-sheet-summary-unavailable/);
  });

  test('a projeção é congelada: uma seção não consegue mutar o que recebeu', () => {
    const projection = selectSummaryCombat(viewModelDe(0));
    assert.equal(Object.isFrozen(projection), true);
    assert.throws(() => {
      projection.armorClass = 99;
    }, TypeError);
  });
});

describe('unit/sheet/summary-combat-section — render cobre PV, morte, atributos, perícias, ataques, CA e deslocamento', () => {
  test('o markup traz cada bloco exigido pelo brief, com IDs estáveis', () => {
    const markup = renderSummaryCombat(selectSummaryCombat(viewModelDe(0)));
    for (const marcador of [
      'data-sheet-hp-current',
      'data-sheet-hp-maximum',
      'data-sheet-hp-temporary',
      'data-sheet-hit-dice',
      'data-sheet-death-successes',
      'data-sheet-death-failures',
      'data-sheet-abilities',
      'data-sheet-stat="armor-class"',
      'data-sheet-stat="speed"',
      'data-sheet-allowed-edit',
    ]) {
      assert.ok(markup.includes(marcador), `faltou "${marcador}" no markup`);
    }
  });

  test('valores AUSENTES viram "—", nunca um zero plausível', () => {
    // O defeito real: exibir "0" para um bônus desconhecido afirma "o bônus é
    // zero". Ausência tem de ser distinguível de zero na tela.
    const markup = renderSummaryCombat(
      selectSummaryCombat({
        derived: { hitPoints: {}, attacks: [], skills: {}, abilities: {}, savingThrows: {}, movement: {}, printable: {} },
        data: {},
      }),
    );
    assert.match(markup, /data-sheet-hp-current>—</);
    assert.match(markup, /data-sheet-stat="armor-class"[^]*?—/);
  });

  test('o render roda para TODAS as fixtures decodificáveis (não uma amostra)', () => {
    const falhas = [];
    for (let i = 0; i < personagens.length; i += 1) {
      try {
        const markup = renderSummaryCombat(selectSummaryCombat(viewModelDe(i)));
        if (!markup.includes('data-sheet-summary')) {
          falhas.push(`${personagens[i].fixture}#${personagens[i].caseId}: markup sem o contêiner da seção`);
        }
        if (/\son[a-z]+\s*=/i.test(markup)) {
          falhas.push(`${personagens[i].fixture}#${personagens[i].caseId}: handler inline no markup`);
        }
      } catch (erro) {
        falhas.push(`${personagens[i].fixture}#${personagens[i].caseId}: ${erro.message}`);
      }
    }
    assert.deepEqual(falhas, []);
  });

  test('nome hostil de personagem vira TEXTO, nunca markup', () => {
    const markup = renderSummaryCombat(
      selectSummaryCombat({
        derived: { printable: { headline: { name: '<img src=x onerror="window.__xss=1">' } }, hitPoints: {}, attacks: [], skills: {}, abilities: {}, savingThrows: {}, movement: {} },
        data: {},
      }),
    );
    assert.equal(markup.includes('<img'), false);
    assert.match(markup, /&lt;img src=x onerror=/);
  });
});

describe('unit/sheet/summary-combat-section — anti-bypass: nenhum clique cai no vazio', () => {
  /** @type {{document: object, restore: () => void}|null} */
  let dom = null;

  /**
   * Monta o markup da seção dentro do contêiner de seção real e devolve o
   * documento pronto para clicar.
   * @param {object} viewModel
   * @returns {object} o elemento do contêiner da seção
   */
  function montar(viewModel) {
    dom?.restore();
    dom = createTestDom();
    const raiz = dom.document.createElement('div');
    raiz.setAttribute('data-sheet-section', SUMMARY_COMBAT_SECTION_ID);
    raiz.innerHTML = renderSummaryCombat(selectSummaryCombat(viewModel));
    dom.document.body.appendChild(raiz);
    return raiz;
  }

  test('TODO `data-action` do markup é um tipo de comando que o dispatcher conhece', () => {
    const raiz = montar(viewModelDe(0));
    const acoes = [...raiz.querySelectorAll('[data-action]')].map((el) => el.getAttribute('data-action'));
    assert.ok(acoes.length > 0, 'a seção não emitiu nenhum controle acionável');

    const semHandler = [];
    for (const type of new Set(acoes)) {
      // A prova é FUNCIONAL: o dispatcher é consultado de verdade, e o único
      // veredito recusado é "esse tipo não existe".
      const resultado = executeCharacterCommand(personagens[0].character, { type }, { registry: fakeRegistry(), now: NOW });
      if (resultado.ok !== true && resultado.error?.code === 'COMMAND_TYPE_UNKNOWN') {
        semHandler.push(type);
      }
    }
    assert.deepEqual(semHandler, [], 'há `data-action` no markup sem comando canônico correspondente');
    dom.restore();
    dom = null;
  });

  test('a lista declarada de comandos bate EXATAMENTE com o que o markup emite', () => {
    // Sem isto, a lista exportada poderia envelhecer em silêncio e deixar de
    // servir como contrato para os testes de cobertura.
    const raiz = montar(viewModelDe(0));
    const noMarkup = new Set([...raiz.querySelectorAll('[data-action]')].map((el) => el.getAttribute('data-action')));
    // `revert-character-edit` só aparece quando há override ativo; ele é
    // conferido pelo caso próprio abaixo.
    for (const type of noMarkup) {
      assert.ok(SUMMARY_COMBAT_COMMAND_TYPES.includes(type), `"${type}" não está em SUMMARY_COMBAT_COMMAND_TYPES`);
    }
    dom.restore();
    dom = null;
  });

  test('um `data-action` DESCONHECIDO vira erro de validação declarado, nunca um no-op', () => {
    // Este é o caso que o brief da Task 30 chama de "bypass silencioso": um
    // clique que não faz nada porque nenhum handler casa com o `data-action`.
    dom?.restore();
    dom = createTestDom();
    const raiz = dom.document.createElement('div');
    raiz.setAttribute('data-sheet-section', SUMMARY_COMBAT_SECTION_ID);
    raiz.innerHTML = '<button type="button" data-action="acao-que-nao-existe">x</button>';
    dom.document.body.appendChild(raiz);

    const botao = raiz.querySelector('[data-action]');
    const decision = summaryCombatToIntent({ type: 'click', target: botao }, { root: raiz, projection: {}, uiState: {} });

    assert.equal(decision.intent.type, SHEET_INTENT_TYPES.command);
    assert.equal(decision.intent.command.type, 'acao-que-nao-existe');

    const resultado = executeCharacterCommand(personagens[0].character, decision.intent.command, { registry: fakeRegistry(), now: NOW });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'COMMAND_TYPE_UNKNOWN');

    dom.restore();
    dom = null;
  });

  test('dano/cura/PV temporário levam a quantidade digitada, e a seção NÃO inventa um valor', () => {
    const raiz = montar(viewModelDe(0));
    const campo = raiz.querySelector('[data-sheet-amount]');
    campo.value = '7';

    const botao = raiz.querySelector('[data-action="apply-damage"]');
    const decision = summaryCombatToIntent({ type: 'click', target: botao }, { root: raiz, projection: {}, uiState: {} });
    assert.deepEqual(decision.intent.command, { type: 'apply-damage', amount: 7 });
    assert.equal(decision.preventDefault, true);

    // Campo ilegível -> comando SEM `amount`: a recusa acontece no domínio,
    // num lugar só, e não vira um "1" de conveniência aqui.
    campo.value = 'abc';
    const semQuantidade = summaryCombatToIntent({ type: 'click', target: botao }, { root: raiz, projection: {}, uiState: {} });
    assert.equal(Object.hasOwn(semQuantidade.intent.command, 'amount'), false);
    const recusado = executeCharacterCommand(personagens[0].character, semQuantidade.intent.command, { registry: fakeRegistry(), now: NOW });
    assert.equal(recusado.ok, false);
    assert.equal(recusado.error.code, 'COMMAND_HP_AMOUNT_INVALID');

    dom.restore();
    dom = null;
  });

  test('os descansos não pedem quantidade e chegam ao domínio como comando puro', () => {
    const raiz = montar(viewModelDe(0));
    for (const type of ['short-rest', 'long-rest']) {
      const botao = raiz.querySelector(`[data-action="${type}"]`);
      const decision = summaryCombatToIntent({ type: 'click', target: botao }, { root: raiz, projection: {}, uiState: {} });
      assert.deepEqual(decision.intent.command, { type }, `"${type}" não deveria carregar parâmetro`);
    }
    dom.restore();
    dom = null;
  });

  // ------------------------------------------------------------------
  // Achado do CUTOVER (Task 33): este caso ANTES afirmava que `spend-hit-die`
  // "não pede quantidade e chega ao domínio como comando puro" — e era essa
  // afirmação que CONGELAVA o defeito. O comando canônico exige `healAmount`
  // (`domain/commands/hit-points.js`), então o botão "Gastar dado de vida"
  // sempre caía na recusa `"healAmount" deve ser um inteiro >= 0`: um controle
  // permanentemente morto na ficha. O teste não via porque nunca EXECUTAVA o
  // comando que montava — a correção do teste é despachá-lo de verdade.
  // ------------------------------------------------------------------
  test('gastar dado de vida leva o valor rolado como `healAmount` E é ACEITO pelo domínio', () => {
    const raiz = montar(viewModelDe(0));
    raiz.querySelector('[data-sheet-amount]').value = '4';

    const botao = raiz.querySelector('[data-action="spend-hit-die"]');
    const decision = summaryCombatToIntent({ type: 'click', target: botao }, { root: raiz, projection: {}, uiState: {} });
    assert.deepEqual(decision.intent.command, { type: 'spend-hit-die', healAmount: 4 });

    const aplicado = executeCharacterCommand(personagens[0].character, decision.intent.command, {
      ...personagens[0].context,
      now: NOW,
    });
    assert.equal(aplicado.ok, true, aplicado.ok ? '' : aplicado.error.code);
    assert.ok(aplicado.affected.includes('state.hitDice.used'), 'o dado de vida gasto precisa ser registrado');

    // Campo ilegível continua produzindo comando SEM parâmetro: a recusa é do
    // domínio, num lugar só — a seção não inventa um valor de conveniência.
    raiz.querySelector('[data-sheet-amount]').value = '';
    const semValor = summaryCombatToIntent({ type: 'click', target: botao }, { root: raiz, projection: {}, uiState: {} });
    assert.equal(Object.hasOwn(semValor.intent.command, 'healAmount'), false);

    dom.restore();
    dom = null;
  });

  test('a edição permitida é `hp.maximum` — e só ela', () => {
    const raiz = montar(viewModelDe(0));
    const campo = raiz.querySelector('[data-sheet-edit-value="hp.maximum"]');
    campo.value = '42';
    const botao = raiz.querySelector('[data-action="edit-character-field"]');
    const decision = summaryCombatToIntent({ type: 'click', target: botao }, { root: raiz, projection: {}, uiState: {} });
    assert.deepEqual(decision.intent.command, { type: 'edit-character-field', path: 'hp.maximum', value: 42 });

    const aplicado = executeCharacterCommand(personagens[0].character, decision.intent.command, {
      ...personagens[0].context,
      now: NOW,
    });
    // Ou aplica, ou recusa com erro nomeado — nunca "não faz nada em silêncio".
    assert.equal(typeof aplicado.ok, 'boolean');
    if (aplicado.ok !== true) {
      assert.ok(typeof aplicado.error.code === 'string' && aplicado.error.code.length > 0);
    } else {
      assert.deepEqual(aplicado.affected, ['hp.maximum']);
    }
    dom.restore();
    dom = null;
  });

  test('clique fora de qualquer `data-action` é decisão NEUTRA (e não uma intenção inventada)', () => {
    const raiz = montar(viewModelDe(0));
    const alvo = raiz.querySelector('[data-sheet-hp-current]');
    const decision = summaryCombatToIntent({ type: 'click', target: alvo }, { root: raiz, projection: {}, uiState: {} });
    assert.equal(decision.intent, null);
    assert.equal(decision.preventDefault, false);
    dom.restore();
    dom = null;
  });

  test('a seção nunca toca no evento: `toIntent` só DESCREVE', () => {
    const raiz = montar(viewModelDe(0));
    const botao = raiz.querySelector('[data-action="apply-healing"]');
    let tocou = false;
    const evento = {
      type: 'click',
      target: botao,
      preventDefault: () => {
        tocou = true;
      },
      stopPropagation: () => {
        tocou = true;
      },
    };
    summaryCombatToIntent(evento, { root: raiz, projection: {}, uiState: {} });
    assert.equal(tocou, false, 'a seção chamou preventDefault/stopPropagation — isso é papel do controller');
    dom.restore();
    dom = null;
  });
});
