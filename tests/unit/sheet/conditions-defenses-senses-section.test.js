// Teste focal de `features/sheet/sections/conditions-defenses-senses-section.js`
// (Task 31).
//
// As garantias, cada uma com um defeito concreto por trás:
//
//  1. NADA VEM DE PROSA. O fonte da seção é varrido atrás de `MAGIAS_EFEITO`,
//     de regex sobre descrição e de comparação por nome de exibição. É o item
//     literal do checklist do brief, e é verificado sobre o ARQUIVO, não
//     alegado no comentário.
//  2. SIMETRIA aplicar/revogar (padrão de bug recorrente (b)): para CADA
//     condição de CADA fixture, `add-condition` seguido de `remove-condition`
//     devolve o personagem ao estado anterior, pelo dispatcher REAL.
//  3. ANTI-BYPASS: todo `data-action` do markup é um `type` que o dispatcher
//     conhece; um `data-action` inventado volta com `COMMAND_TYPE_UNKNOWN`.
//  4. PARIDADE COM MÚLTIPLAS FIXTURES, não com uma amostra.
//  5. AUSÊNCIA ≠ ZERO: sentido desconhecido vira `—`, nunca `0`.
//  6. ESTADOS VAZIOS comparados com os textos do baseline
//     (`tests/fixtures/dom-baseline/sheet-sections.json`, cards `condicoes` e
//     `defesas`).

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
  ADVANTAGE_UNAVAILABLE_REASON,
  CONDITIONS_COMMAND_TYPES,
  CONDITIONS_DEFENSES_SENSES_SECTION_ID,
  DEFENSES_READONLY_REASON,
  conditionsDefensesSensesToIntent,
  createConditionsDefensesSensesSection,
  renderConditionsDefensesSenses,
  selectConditionsDefensesSenses,
} from '../../../site/js/features/sheet/sections/conditions-defenses-senses-section.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const NOW = '2026-08-04T00:00:00.000Z';
const SKILL_IDS = Object.freeze([
  'dnd2024:skill:percepcao',
  'dnd2024:skill:intuicao',
  'dnd2024:skill:investigacao',
]);

const KNOWN_ENTITIES = Object.freeze({
  'dnd2024:class:clerigo': Object.freeze({
    id: 'dnd2024:class:clerigo',
    type: 'class',
    effects: Object.freeze([]),
    spellcasting: Object.freeze({ ability: 'dnd2024:ability:sabedoria', progression: 'full' }),
  }),
  'dnd2024:species:humano': Object.freeze({
    id: 'dnd2024:species:humano',
    type: 'species',
    effects: Object.freeze([]),
    size: 'medium',
    speed: 9,
  }),
});

/**
 * Catálogo mínimo: o suficiente para o ViewModel projetar perícias passivas.
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
/** @type {object} */
let baseline;

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  const ctx = { aliasResolver: createLegacyAliasResolver(aliases), now: NOW };

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
      personagens.push({
        fixture: name,
        caseId: entry.id,
        character: projected.value,
        context: { registry: fakeRegistry(), ...hints },
      });
    }
  }
  assert.ok(personagens.length >= 10, `apenas ${personagens.length} fixtures decodificáveis — a paridade seria de amostra única`);

  baseline = JSON.parse(await readFile(path.join(repoRoot, 'tests/fixtures/dom-baseline/sheet-sections.json'), 'utf8'));
});

/**
 * ViewModel de uma das fixtures carregadas.
 * @param {number} indice
 * @returns {object}
 */
function viewModelDe(indice) {
  const { character, context } = personagens[indice];
  const built = buildSheetViewModel(character, context);
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
  raiz.setAttribute('data-sheet-section', CONDITIONS_DEFENSES_SENSES_SECTION_ID);
  raiz.innerHTML = renderConditionsDefensesSenses(selectConditionsDefensesSenses(viewModel));
  dom.document.body.appendChild(raiz);
  return raiz;
}

/**
 * Extrai todos os textos de uma árvore do oráculo de DOM.
 * @param {object} node
 * @param {Array<string>} destino
 * @returns {Array<string>}
 */
function textosDoOraculo(node, destino = []) {
  if (typeof node?.text === 'string') {
    destino.push(node.text);
  }
  for (const filho of node?.children ?? []) {
    textosDoOraculo(filho, destino);
  }
  return destino;
}

describe('unit/sheet/conditions-defenses-senses — registro e delegação', () => {
  test('a seção é aceita pelo registro com o id canônico', () => {
    const criada = createConditionsDefensesSensesSection();
    assert.equal(criada.ok, true, criada.error?.code);
    assert.equal(criada.value.id, CONDITIONS_DEFENSES_SENSES_SECTION_ID);
  });

  test('`select` não calcula: defesas e sentidos são o eco de `derived`', () => {
    const vm = viewModelDe(0);
    const projection = selectConditionsDefensesSenses(vm);
    assert.deepEqual(projection.defenses.resistances, [...vm.derived.defenses.resistances]);
    assert.deepEqual(projection.defenses.vulnerabilities, [...vm.derived.defenses.vulnerabilities]);
    assert.deepEqual(projection.defenses.immunities, [...vm.derived.defenses.immunities]);
    assert.equal(projection.senses.passivePerception, vm.derived.senses.passivePerception);
    assert.equal(projection.senses.darkvision, vm.derived.senses.darkvision);
    assert.equal(projection.exhaustionLevel, vm.derived.movement.exhaustionLevel);
    assert.equal(Object.isFrozen(projection), true);
  });

  test('ViewModel ausente vira estado declarado, nunca uma seção em branco', () => {
    assert.match(renderConditionsDefensesSenses(selectConditionsDefensesSenses(null)), /data-sheet-conditions-unavailable/);
  });

  test('`toIntent` não toca no evento: só DESCREVE', () => {
    const dom = createTestDom();
    try {
      const raiz = montar(dom, viewModelDe(0));
      let tocou = false;
      conditionsDefensesSensesToIntent(
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

  test('o markup não registra handler inline', () => {
    const dom = createTestDom();
    try {
      const raiz = montar(dom, viewModelDe(0));
      assert.equal(/\son[a-z]+=/i.test(raiz.innerHTML), false, 'a seção não pode emitir handler inline');
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/conditions-defenses-senses — nada vem de prosa', () => {
  test('o FONTE da seção não tem MAGIAS_EFEITO, regex de descrição nem nome de exibição', async () => {
    // Item literal do checklist do brief. Verificado sobre o arquivo, porque um
    // comentário afirmando isso não impede ninguém de reintroduzi-lo.
    const fonte = await readFile(
      path.join(repoRoot, 'site/js/features/sheet/sections/conditions-defenses-senses-section.js'),
      'utf8',
    );
    // Só o CÓDIGO (comentários explicam justamente por que estes padrões não
    // existem, e citá-los ali não é reintroduzi-los).
    const codigo = fonte
      .split('\n')
      .filter((linha) => !linha.trimStart().startsWith('//'))
      .join('\n');

    assert.equal(codigo.includes('MAGIAS_EFEITO'), false, 'tabela de efeitos por nome de magia');
    for (const proibido of ['.match(', '.test(', 'RegExp(', 'toLowerCase()', 'normalize(']) {
      assert.equal(codigo.includes(proibido), false, `padrão de leitura de prosa proibido: ${proibido}`);
    }
    // Nomes de exibição de condição/dano em português, comparados diretamente.
    for (const nome of ['Envenenado', 'Amedrontado', 'Atordoado', 'Fogo', 'Frio', 'Necrótico']) {
      assert.equal(codigo.includes(nome), false, `comparação por nome de exibição: ${nome}`);
    }
  });
});

describe('unit/sheet/conditions-defenses-senses — condições: simetria e anti-bypass', () => {
  test('os comandos declarados existem no dispatcher canônico', () => {
    const { character, context } = personagens[0];
    const desconhecidos = CONDITIONS_COMMAND_TYPES.filter((type) => {
      const resultado = executeCharacterCommand(character, { type }, context);
      return resultado.ok !== true && resultado.error?.code === 'COMMAND_TYPE_UNKNOWN';
    });
    assert.deepEqual(desconhecidos, []);
  });

  test('todo `data-action` do markup é conhecido pelo dispatcher — nenhum clique inerte', () => {
    const dom = createTestDom();
    const falhas = [];
    try {
      for (let indice = 0; indice < personagens.length; indice += 1) {
        const raiz = montar(dom, viewModelDe(indice));
        for (const elemento of raiz.querySelectorAll('[data-action]')) {
          const type = elemento.getAttribute('data-action');
          const resultado = executeCharacterCommand(personagens[indice].character, { type }, personagens[indice].context);
          if (resultado.ok !== true && resultado.error?.code === 'COMMAND_TYPE_UNKNOWN') {
            falhas.push(`${personagens[indice].caseId}: ${type}`);
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
      raiz.innerHTML = '<button data-action="condicao-inexistente">x</button>';
      dom.document.body.appendChild(raiz);
      const decision = conditionsDefensesSensesToIntent(
        { type: 'click', target: raiz.querySelector('[data-action]') },
        { root: raiz, projection: {}, uiState: {} },
      );
      assert.equal(decision.intent.type, SHEET_INTENT_TYPES.command);
      const resultado = executeCharacterCommand(personagens[0].character, decision.intent.command, personagens[0].context);
      assert.equal(resultado.ok, false);
      assert.equal(resultado.error.code, 'COMMAND_TYPE_UNKNOWN');
    } finally {
      dom.restore();
    }
  });

  test('adicionar e remover são EXATAMENTE inversos, para toda condição de toda fixture', () => {
    // Padrão de bug recorrente (b): assimetria aplicar/revogar. Aqui a ida e a
    // volta passam pelo dispatcher REAL, e o array final é comparado com o
    // inicial.
    const dom = createTestDom();
    let cobertas = 0;
    const falhas = [];
    try {
      for (let indice = 0; indice < personagens.length; indice += 1) {
        const { character, context, caseId } = personagens[indice];
        const raiz = montar(dom, viewModelDe(indice));

        // 1) REMOVER cada condição já ativa e reaplicá-la de volta.
        for (const botao of raiz.querySelectorAll('[data-action="remove-condition"]')) {
          const decision = conditionsDefensesSensesToIntent({ type: 'click', target: botao }, { root: raiz, projection: {}, uiState: {} });
          const removido = executeCharacterCommand(character, decision.intent.command, context);
          if (removido.ok !== true) {
            falhas.push(`${caseId}: remover "${botao.getAttribute('data-condition-id')}" falhou (${removido.error.code})`);
            continue;
          }
          const readicionado = executeCharacterCommand(
            removido.character,
            { type: 'add-condition', conditionId: botao.getAttribute('data-condition-id') },
            context,
          );
          if (readicionado.ok !== true) {
            falhas.push(`${caseId}: readicionar falhou (${readicionado.error.code})`);
            continue;
          }
          cobertas += 1;
          assert.deepEqual(
            [...readicionado.character.state.conditions].sort(),
            [...character.state.conditions].sort(),
            `${caseId}: remover+readicionar não é identidade`,
          );
        }

        // 2) ADICIONAR uma condição nova pelo campo de texto e removê-la.
        const campo = raiz.querySelector('[data-sheet-condition-input]');
        campo.value = 'condicao-de-teste-31';
        const botaoAdd = raiz.querySelector('[data-action="add-condition"]');
        const decisionAdd = conditionsDefensesSensesToIntent({ type: 'click', target: botaoAdd }, { root: raiz, projection: {}, uiState: {} });
        assert.equal(decisionAdd.intent.command.conditionId, 'condicao-de-teste-31');
        const adicionado = executeCharacterCommand(character, decisionAdd.intent.command, context);
        assert.equal(adicionado.ok, true, `${caseId}: ${adicionado.error?.code}`);
        assert.deepEqual([...adicionado.affected], ['state.conditions']);
        const revertido = executeCharacterCommand(
          adicionado.character,
          { type: 'remove-condition', conditionId: 'condicao-de-teste-31' },
          context,
        );
        assert.equal(revertido.ok, true);
        assert.deepEqual([...revertido.character.state.conditions], [...character.state.conditions]);
        cobertas += 1;

        raiz.remove();
      }
    } finally {
      dom.restore();
    }
    assert.deepEqual(falhas, []);
    assert.ok(cobertas >= personagens.length, `apenas ${cobertas} idas-e-voltas cobertas`);
  });

  test('campo vazio produz comando SEM conditionId, recusado com erro NOMEADO', () => {
    // A vista nunca preenche um valor plausível: ausência é ausência, e quem
    // recusa é o domínio.
    const dom = createTestDom();
    try {
      const raiz = montar(dom, viewModelDe(0));
      raiz.querySelector('[data-sheet-condition-input]').value = '   ';
      const decision = conditionsDefensesSensesToIntent(
        { type: 'click', target: raiz.querySelector('[data-action="add-condition"]') },
        { root: raiz, projection: {}, uiState: {} },
      );
      assert.equal(Object.hasOwn(decision.intent.command, 'conditionId'), false);
      const resultado = executeCharacterCommand(personagens[0].character, decision.intent.command, personagens[0].context);
      assert.equal(resultado.ok, false);
      assert.equal(resultado.error.code, 'COMMAND_CONDITION_ID_INVALID');
    } finally {
      dom.restore();
    }
  });

  test('condição hostil vira TEXTO, nunca markup', () => {
    const dom = createTestDom();
    try {
      const projection = selectConditionsDefensesSenses({
        derived: { defenses: {}, senses: {}, movement: {} },
        data: { state: { conditions: ['<img src=x onerror="alert(1)">'] } },
      });
      const raiz = dom.document.createElement('div');
      raiz.innerHTML = renderConditionsDefensesSenses(projection);
      dom.document.body.appendChild(raiz);
      assert.equal(raiz.querySelector('img'), null, 'a condição virou markup');
      assert.match(raiz.querySelector('[data-sheet-condition-label]').textContent, /onerror/);
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/conditions-defenses-senses — defesas, sentidos e lacunas declaradas', () => {
  test('as três famílias de defesa aparecem com os IDs de `derived.defenses`', () => {
    const dom = createTestDom();
    let comDefesa = 0;
    try {
      for (let indice = 0; indice < personagens.length; indice += 1) {
        const vm = viewModelDe(indice);
        const raiz = montar(dom, vm);
        for (const chave of ['resistances', 'vulnerabilities', 'immunities']) {
          const ids = [...vm.derived.defenses[chave]];
          const bloco = raiz.querySelector(`[data-sheet-defense-kind="${chave}"]`);
          assert.ok(bloco, `faltou o bloco de ${chave}`);
          const renderizados = [...bloco.querySelectorAll('[data-sheet-defense-id]')].map((no) => no.getAttribute('data-sheet-defense-id'));
          assert.deepEqual(renderizados, ids, `${chave} divergiu do ViewModel`);
          if (ids.length > 0) {
            comDefesa += 1;
          } else {
            assert.ok(bloco.querySelector(`[data-sheet-defense-empty="${chave}"]`), 'faltou o estado vazio declarado');
          }
        }
        raiz.remove();
      }
    } finally {
      dom.restore();
    }
    // NENHUMA das fixtures de personagem declara resistência, vulnerabilidade
    // ou imunidade (verificado por varredura de `resistencias`/
    // `vulnerabilidades`/`imunidades` nas 15 fixtures). Isso não é motivo para
    // afrouxar a paridade: o caso NÃO-vazio é coberto pelo teste seguinte, com
    // um personagem canônico montado para isso. Registrar o número aqui impede
    // que a asserção acima passe por vacuidade sem ninguém saber por quê.
    assert.equal(comDefesa, 0, 'alguma fixture passou a ter defesa — cubra-a na paridade acima');
  });

  test('com defesas declaradas, as três listas saem por ID e na ordem da projeção', () => {
    const dom = createTestDom();
    try {
      const projection = selectConditionsDefensesSenses({
        derived: {
          defenses: {
            resistances: ['dnd2024:damage-type:fogo', 'dnd2024:damage-type:acido'],
            vulnerabilities: ['dnd2024:damage-type:frio'],
            immunities: ['dnd2024:damage-type:veneno'],
          },
          senses: {},
          movement: {},
        },
        data: { state: {} },
      });
      const raiz = dom.document.createElement('div');
      raiz.innerHTML = renderConditionsDefensesSenses(projection);
      dom.document.body.appendChild(raiz);

      const idsDe = (chave) =>
        [...raiz.querySelectorAll(`[data-sheet-defense-kind="${chave}"] [data-sheet-defense-id]`)].map((no) =>
          no.getAttribute('data-sheet-defense-id'),
        );
      assert.deepEqual(idsDe('resistances'), ['dnd2024:damage-type:fogo', 'dnd2024:damage-type:acido']);
      assert.deepEqual(idsDe('vulnerabilities'), ['dnd2024:damage-type:frio']);
      assert.deepEqual(idsDe('immunities'), ['dnd2024:damage-type:veneno']);
      // Nenhum estado vazio onde há conteúdo.
      assert.equal(raiz.querySelector('[data-sheet-defense-empty="resistances"]'), null);
    } finally {
      dom.restore();
    }
  });

  test('sentido desconhecido vira "—", nunca 0', () => {
    const dom = createTestDom();
    try {
      const raiz = dom.document.createElement('div');
      raiz.innerHTML = renderConditionsDefensesSenses(
        selectConditionsDefensesSenses({ derived: { defenses: {}, senses: {}, movement: {} }, data: { state: {} } }),
      );
      dom.document.body.appendChild(raiz);
      for (const chave of ['passivePerception', 'passiveInsight', 'passiveInvestigation', 'darkvision']) {
        assert.equal(raiz.querySelector(`[data-sheet-sense="${chave}"] [data-sheet-sense-value]`).textContent, '—');
      }
    } finally {
      dom.restore();
    }
  });

  test('visão no escuro AUSENTE e visão no escuro PRESENTE são distinguíveis', () => {
    const dom = createTestDom();
    try {
      const raiz = dom.document.createElement('div');
      raiz.innerHTML = renderConditionsDefensesSenses(
        selectConditionsDefensesSenses({
          derived: { defenses: {}, senses: { passivePerception: 12, darkvision: 18 }, movement: {} },
          data: { state: {} },
        }),
      );
      dom.document.body.appendChild(raiz);
      assert.equal(raiz.querySelector('[data-sheet-sense="darkvision"] [data-sheet-sense-value]').textContent, '18');
      assert.equal(raiz.querySelector('[data-sheet-sense="passiveInsight"] [data-sheet-sense-value]').textContent, '—');
    } finally {
      dom.restore();
    }
  });

  test('as duas lacunas são DECLARADAS com motivo nomeado, não silenciadas', () => {
    const markup = renderConditionsDefensesSenses(selectConditionsDefensesSenses(viewModelDe(0)));
    assert.match(markup, new RegExp(`data-sheet-advantage-unavailable="${ADVANTAGE_UNAVAILABLE_REASON}"`));
    assert.match(markup, new RegExp(`data-sheet-defenses-readonly="${DEFENSES_READONLY_REASON}"`));
    // E não existe botão de "gerenciar defesas" sem comando por trás.
    assert.equal(/data-action="[^"]*defense[^"]*"/i.test(markup), false);
  });
});

describe('unit/sheet/conditions-defenses-senses — estados vazios contra o baseline', () => {
  test('os textos de estado vazio são os do card do baseline', () => {
    // Oráculo: `tests/fixtures/dom-baseline/sheet-sections.json`, capturado em
    // `e43c5ea`. Os textos são comparados literalmente para que a migração não
    // reescreva silenciosamente o que o jogador lê quando não há nada.
    const textosCondicoes = textosDoOraculo(baseline['condicoes']);
    const textosDefesas = textosDoOraculo(baseline['defesas']);
    assert.ok(textosCondicoes.includes('Nenhuma condicao ativa'), 'o oráculo mudou de forma');
    assert.ok(textosDefesas.includes('Nenhuma defesa configurada'), 'o oráculo mudou de forma');

    const dom = createTestDom();
    try {
      const raiz = dom.document.createElement('div');
      raiz.innerHTML = renderConditionsDefensesSenses(
        selectConditionsDefensesSenses({ derived: { defenses: {}, senses: {}, movement: {} }, data: { state: {} } }),
      );
      dom.document.body.appendChild(raiz);
      // O oráculo foi capturado de um DOM sem acento (o normalizador do
      // capturador remove diacríticos); a comparação é feita na mesma base.
      const semAcento = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
      assert.equal(semAcento(raiz.querySelector('[data-sheet-conditions-empty]').textContent), 'Nenhuma condicao ativa');
      assert.equal(
        semAcento(raiz.querySelector('[data-sheet-defense-empty="resistances"]').textContent),
        'Nenhuma defesa configurada',
      );
    } finally {
      dom.restore();
    }
  });
});
