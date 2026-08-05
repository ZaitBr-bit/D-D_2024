// ============================================================
// `buildSheetViewModel` (Task 29) — a projeção ÚNICA que tela, impressão e PDF
// (Task 33) consomem.
//
// Três garantias, cada uma com um defeito concreto por trás:
//
//  1. CONTRATO DE CHAVES: o conjunto de chaves de `viewModel.derived` é
//     derivado de `tests/fixtures/expected/sheet-view-model-keys.json` (Task
//     16) e comparado por igualdade EXATA — nos dois sentidos. Falta uma chave
//     -> a Task 33 leria `undefined` e imprimiria vazio; sobra uma chave -> é
//     um valor derivado inventado nesta camada, exatamente o que a lista
//     existe para impedir.
//  2. PUREZA: entrada congelada em profundidade antes da chamada, e igualdade
//     profunda contra uma cópia tirada antes. Zero escrita, zero mutação.
//  3. PARIDADE COM MÚLTIPLAS FIXTURES: o ViewModel é construído para TODAS as
//     fixtures de personagem reais (não uma amostra), e os valores derivados
//     são conferidos contra `derived-values.json` — a fonte de verdade da Task
//     2 — inclusive PV temporário e Dados de Vida restantes, os dois casos em
//     que print/PDF legados divergiam da tela.
// ============================================================
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ok } from '../../../site/js/core/result.js';
import { createLegacyAliasResolver } from '../../../site/js/infra/character/legacy-alias-resolver.js';
import { projectLegacyCharacterForQueries, deriveLegacyQueryHints } from '../../../site/js/infra/character/legacy-query-adapter.js';
import { ABILITY_KEYS } from '../../../site/js/domain/character/queries/index.js';
import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import { buildSheetViewModel, DATA_KEYS, DERIVED_COLLECTIONS } from '../../../site/js/features/sheet/sheet-view-model.js';
import { deepFreeze } from '../../../site/js/features/sheet/sheet-state.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const NOW = '2026-08-03T00:00:00.000Z';

const SKILL_IDS = Object.freeze(['dnd2024:skill:percepcao', 'dnd2024:skill:intuicao', 'dnd2024:skill:investigacao']);

// Mesmo vocabulário mínimo de `tests/contract/derived-values-parity.test.js`:
// o suficiente para CD/Ataque de Magia (Clérigo) e Deslocamento (Humano). Toda
// outra referência cai num stub genérico — nunca uma falha por causa de uma
// entidade que este teste não precisa modelar.
const KNOWN_ENTITIES = Object.freeze({
  'dnd2024:class:clerigo': Object.freeze({
    id: 'dnd2024:class:clerigo',
    type: 'class',
    effects: Object.freeze([]),
    spellcasting: Object.freeze({ ability: 'dnd2024:ability:sabedoria', progression: 'full' }),
  }),
  'dnd2024:species:humano': Object.freeze({ id: 'dnd2024:species:humano', type: 'species', effects: Object.freeze([]), size: 'medium', speed: 9 }),
  // Task 33: um tipo de dano REAL do catálogo, para provar que
  // `derived.defenses.*Labels` resolve o nome de exibição em vez de expor o
  // ContentId. O nome é o mesmo de `dados/pacotes/dnd2024/rulesets/damage-types.json`.
  'dnd2024:damage-type:fogo': Object.freeze({ id: 'dnd2024:damage-type:fogo', type: 'damage-type', name: 'Fogo', effects: Object.freeze([]) }),
});

/**
 * Catálogo falso com `list('skill')` — é assim que o ViewModel descobre quais
 * perícias projetar sem carregar uma lista embutida no código.
 * @returns {Readonly<object>}
 */
function fakeRegistry() {
  return Object.freeze({
    /**
     * @param {string} id
     * @returns {object|null}
     */
    get(id) {
      return KNOWN_ENTITIES[id] ?? null;
    },
    /**
     * @param {*} reference
     * @returns {object}
     */
    resolve(reference) {
      const id = typeof reference === 'string' ? reference : reference?.id;
      return ok(KNOWN_ENTITIES[id] ?? Object.freeze({ id, type: 'stub', effects: Object.freeze([]) }));
    },
    /**
     * @param {string} type
     * @returns {ReadonlyArray<object>}
     */
    list(type) {
      if (type !== 'skill') {
        return Object.freeze([]);
      }
      return Object.freeze(SKILL_IDS.map((id) => Object.freeze({ id, type: 'skill' })));
    },
  });
}

let ctx;
let keysFixture;
let derivedValues;
/** @type {Array<{fixture: string, caseId: string, record: object}>} */
let legacyRecords = [];
/** @type {Array<string>} casos que nem chegam a ser CanonicalCharacter. */
let skippedRecords = [];

before(async () => {
  const aliases = JSON.parse(await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'));
  ctx = { aliasResolver: createLegacyAliasResolver(aliases), now: NOW };
  keysFixture = JSON.parse(await readFile(path.join(repoRoot, 'tests/fixtures/expected/sheet-view-model-keys.json'), 'utf8'));
  derivedValues = JSON.parse(await readFile(path.join(repoRoot, 'tests/fixtures/expected/derived-values.json'), 'utf8'));

  const dir = path.join(repoRoot, 'tests/fixtures/characters');
  for (const name of await readdir(dir)) {
    // `future-v3` é schema FUTURO (não decodifica para canônico — é o caso
    // read-only da SESSÃO, coberto lá) e `baseline-field-inventory` é
    // inventário de campos, não personagem.
    if (!name.startsWith('legacy-') && !name.startsWith('near-') && !name.startsWith('v2-')) {
      continue;
    }
    const parsed = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
    for (const entry of parsed.cases ?? []) {
      if (entry.personagem === null || typeof entry.personagem !== 'object') {
        continue;
      }
      // Alguns casos existem justamente para exercitar limites do ADAPTER
      // legado (alias inexistente, conflito de identidade). Eles não chegam a
      // ser um `CanonicalCharacter`, então não são material desta tarefa —
      // são anotados e pulados, nunca "adaptados" com um valor forçado.
      const projected = projectLegacyCharacterForQueries(entry.personagem, ctx);
      if (projected.ok !== true) {
        skippedRecords.push(`${name}#${entry.id}: ${projected.error.code}`);
        continue;
      }
      legacyRecords.push({ fixture: name, caseId: entry.id, record: entry.personagem });
    }
  }
  assert.ok(legacyRecords.length >= 10, `apenas ${legacyRecords.length} fixtures decodificáveis — a paridade seria de amostra única`);
});

/**
 * Conjunto ESPERADO de chaves ESTRUTURAIS de `derived` (tudo que NÃO é entrada
 * de coleção dinâmica), derivado da fixture da Task 16 — inclusive da extensão
 * `task29Extensions` (decisão registrada em `questions-for-review.txt` item 14).
 * @returns {Array<string>}
 */
function expectedStructuralKeys() {
  const projections = keysFixture.projections;
  const extensoes = keysFixture.task29Extensions;
  const keys = [];
  for (const abilityKey of ABILITY_KEYS) {
    keys.push(`abilities.${abilityKey}.modifier`);
  }
  keys.push('proficiencyBonus');
  for (const key of projections.HitPointProjection.keys) {
    keys.push(`hitPoints.${key}`);
  }
  keys.push('armorClass', 'initiative');
  for (const key of projections.MovementProjection.keys) {
    keys.push(`movement.${key}`);
  }
  for (const key of projections.DefenseProjection.keys) {
    keys.push(`defenses.${key}`);
  }
  // Extensão da Task 33 (`task33Extensions`): os RÓTULOS resolvidos das três
  // listas de defesa viajam ao lado dos ids, na mesma ordem. Sem eles a tela e
  // o PDF mostravam o ContentId (`dnd2024:damage-type:fogo`) ao jogador.
  for (const key of keysFixture.task33Extensions.DefenseLabelProjection.keys) {
    keys.push(`defenses.${key}`);
  }
  for (const key of projections.SensesProjection.keys) {
    keys.push(`senses.${key}`);
  }
  // Extensão da Task 29: os irmãos NÃO-coleção de `spellSlots` são declarados
  // pela própria fixture (`siblingKeys`), com o prefixo `derived.` que ela usa.
  for (const sibling of extensoes.SpellSlotProjection.siblingKeys) {
    keys.push(sibling.replace(/^derived\./, ''));
  }
  for (const key of extensoes.LoadProjection.keys) {
    keys.push(`load.${key}`);
  }
  for (const key of extensoes.PrintableProjection.keys) {
    keys.push(`printable.${key}`);
  }
  // Extensão da Task 30 (`task30Extensions`, decisão registrada em
  // `questions-for-review.txt` item 15): a projeção dos handlers de classe.
  // `handlers` é um ARRAY (leaf para o achatador), então as três chaves de
  // primeiro nível são o contrato estrutural; a forma de cada entrada é
  // verificada pelo teste focal da seção de recursos.
  for (const key of keysFixture.task30Extensions.ClassActionsProjection.keys) {
    keys.push(`classActions.${key}`);
  }
  for (const key of keysFixture.task30Extensions.LevelUpProjection.keys) {
    keys.push(`levelUp.${key}`);
  }
  // Extensão da Task 32 (`task32Extensions`): a CARTEIRA é estrutural (chaves
  // fixas); `derived.inventory` é coleção dinâmica e por isso entra na outra
  // metade do contrato (`collectionEntryKeys`), não aqui.
  for (const key of keysFixture.task32Extensions.WalletProjection.keys) {
    keys.push(`wallet.${key}`);
  }
  // Os IRMÃOS estruturais do envelope `derived.inventory` (`available`/
  // `reason`): a lista de itens é coleção dinâmica (`inventory.items`), mas o
  // marcador de disponibilidade é chave fixa e precisa estar no contrato — é
  // ele que distingue "sem registry" de "sem itens".
  for (const sibling of keysFixture.task32Extensions.InventoryItemProjection.siblingKeys) {
    keys.push(sibling.replace(/^derived\./, ''));
  }
  return keys.sort();
}

/**
 * Achata as chaves de `derived` IGNORANDO o miolo das coleções dinâmicas
 * (perícias, salvaguardas, espaços por nível, recursos, ataques).
 *
 * As coleções têm chave variável por personagem (um id de perícia, um id de
 * recurso, um índice de ataque), então o contrato delas não é "estas chaves
 * existem" e sim "toda entrada tem exatamente estas chaves" — verificado à
 * parte por `collectionEntryKeys`. Misturar os dois tornaria impossível exigir
 * igualdade exata, porque um personagem sem magias simplesmente não tem
 * espaços.
 * @param {object} value
 * @param {string} [prefix]
 * @returns {Array<string>}
 */
function flattenStructuralKeys(value, prefix = '') {
  const out = [];
  for (const [key, entry] of Object.entries(value)) {
    const full = prefix === '' ? key : `${prefix}.${key}`;
    if (Object.hasOwn(DERIVED_COLLECTIONS, full)) {
      continue;
    }
    if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
      out.push(...flattenStructuralKeys(entry, full));
    } else {
      out.push(full);
    }
  }
  return out.sort();
}

/**
 * Devolve, para cada coleção dinâmica, as chaves de CADA entrada.
 * @param {object} derived
 * @returns {Array<{path: string, entryKeys: Array<string>}>}
 */
function collectionEntryKeys(derived) {
  const out = [];
  for (const path of Object.keys(DERIVED_COLLECTIONS)) {
    const container = path.split('.').reduce((node, segment) => node?.[segment], derived);
    if (container === null || container === undefined) {
      continue;
    }
    const entries = Array.isArray(container) ? container : Object.values(container);
    for (const entry of entries) {
      out.push({ path, entryKeys: Object.keys(entry).sort() });
    }
  }
  return out;
}

/**
 * Constrói o ViewModel de um registro legado.
 * @param {object} record
 * @returns {object} Result
 */
function viewModelOf(record) {
  const character = projectLegacyCharacterForQueries(record, ctx);
  assert.equal(character.ok, true, character.ok ? '' : character.error.code);
  const hints = deriveLegacyQueryHints(record);
  return buildSheetViewModel(character.value, {
    registry: fakeRegistry(),
    maximumHitPoints: hints.maximumHitPoints,
    now: NOW,
  });
}

describe('unit/sheet/sheet-view-model — contrato de chaves contra a fixture da Task 16', () => {
  test('derived expõe EXATAMENTE as chaves estruturais de sheet-view-model-keys.json', () => {
    const built = viewModelOf(legacyRecords[0].record);
    assert.equal(built.ok, true, built.ok ? '' : JSON.stringify(built.error));
    assert.deepEqual(flattenStructuralKeys(built.value.derived), expectedStructuralKeys());
  });

  test('toda entrada de coleção tem EXATAMENTE as chaves declaradas na fixture', () => {
    // A outra metade do contrato: `skills`, `savingThrows`, `spellSlots.byLevel`,
    // `resources` e `attacks` têm chave dinâmica, então o que se exige delas é
    // que cada ENTRADA tenha o shape declarado — nem um campo a mais (valor
    // derivado inventado), nem um a menos (a Task 33 leria `undefined`).
    const declarado = {
      skills: keysFixture.projections.SkillProjection.keys,
      savingThrows: keysFixture.task29Extensions.SavingThrowProjection.keys,
      'spellSlots.byLevel': keysFixture.task29Extensions.SpellSlotProjection.keys,
      resources: keysFixture.task29Extensions.ResourceProjection.keys,
      attacks: keysFixture.task29Extensions.AttackProjection.keys,
      'inventory.items': keysFixture.task32Extensions.InventoryItemProjection.keys,
    };
    assert.deepEqual(Object.keys(declarado).sort(), Object.keys(DERIVED_COLLECTIONS).sort());

    let verificadas = 0;
    const falhas = [];
    for (const { fixture, caseId, record } of legacyRecords) {
      const built = viewModelOf(record);
      if (built.ok !== true) {
        falhas.push(`${fixture}#${caseId}: ${built.error.code}`);
        continue;
      }
      for (const { path, entryKeys } of collectionEntryKeys(built.value.derived)) {
        verificadas += 1;
        try {
          assert.deepEqual(entryKeys, [...declarado[path]].sort());
        } catch {
          falhas.push(`${fixture}#${caseId}: entrada de "${path}" com chaves ${entryKeys.join('|')}`);
        }
      }
    }
    assert.deepEqual(falhas, []);
    assert.ok(verificadas > 0, 'nenhuma entrada de coleção foi verificada — o teste passaria vazio');
  });

  test('o contrato de chaves vale para TODAS as fixtures, não para uma amostra', () => {
    const esperado = expectedStructuralKeys();
    const falhas = [];
    for (const { fixture, caseId, record } of legacyRecords) {
      const built = viewModelOf(record);
      if (built.ok !== true) {
        falhas.push(`${fixture}#${caseId}: ${built.error.code}`);
        continue;
      }
      try {
        assert.deepEqual(flattenStructuralKeys(built.value.derived), esperado);
      } catch {
        falhas.push(`${fixture}#${caseId}: conjunto de chaves divergente`);
      }
    }
    assert.deepEqual(falhas, []);
  });

  test('as seis extensões da Task 29 estão declaradas na fixture com origem e justificativa', () => {
    // A extensão de um artefato de task fechada só é aceitável documentada.
    // Se alguém apagar a justificativa ou a origem de uma entrada, este teste
    // cai junto — a lista não pode virar um depósito silencioso de campos.
    const extensoes = keysFixture.task29Extensions;
    assert.ok(typeof extensoes.rationale === 'string' && extensoes.rationale.length > 200);
    for (const nome of [
      'SavingThrowProjection',
      'SpellSlotProjection',
      'ResourceProjection',
      'AttackProjection',
      'LoadProjection',
      'PrintableProjection',
    ]) {
      const entrada = extensoes[nome];
      assert.ok(entrada, `extensão ausente: ${nome}`);
      assert.ok(typeof entrada.source === 'string' && entrada.source.length > 0, `${nome}: sem "source"`);
      assert.ok(Array.isArray(entrada.keys) && entrada.keys.length > 0, `${nome}: sem "keys"`);
      assert.ok(typeof entrada.note === 'string' && entrada.note.length > 0, `${nome}: sem "note"`);
    }
  });

  test('a extensão da Task 30 está declarada na fixture com origem e justificativa', () => {
    // Mesma disciplina da Task 29: estender um artefato de task fechada só é
    // aceitável documentado. Se alguém apagar a origem ou a justificativa,
    // este teste cai junto.
    const extensao = keysFixture.task30Extensions;
    assert.ok(typeof extensao.rationale === 'string' && extensao.rationale.length > 200);
    for (const nome of ['ClassActionsProjection', 'LevelUpProjection']) {
      const entrada = extensao[nome];
      assert.ok(entrada, `extensão ausente: ${nome}`);
      assert.ok(typeof entrada.source === 'string' && entrada.source.length > 0, `${nome}: sem "source"`);
      assert.ok(typeof entrada.note === 'string' && entrada.note.length > 0, `${nome}: sem "note"`);
    }
    assert.deepEqual([...extensao.ClassActionsProjection.keys].sort(), ['available', 'handlers', 'unavailableReason']);
    assert.deepEqual([...extensao.LevelUpProjection.keys].sort(), ['available', 'options', 'unavailableReason']);
  });

  test('a extensão da Task 33 está declarada na fixture com origem e justificativa', () => {
    const extensao = keysFixture.task33Extensions;
    assert.ok(typeof extensao.rationale === 'string' && extensao.rationale.length > 200);
    const entrada = extensao.DefenseLabelProjection;
    assert.ok(entrada, 'extensão ausente: DefenseLabelProjection');
    assert.ok(typeof entrada.source === 'string' && entrada.source.length > 0);
    assert.ok(typeof entrada.note === 'string' && entrada.note.length > 0);
    assert.deepEqual([...entrada.keys].sort(), ['immunityLabels', 'resistanceLabels', 'vulnerabilityLabels']);
    // Os ids NÃO podem ter sido substituídos: o rótulo é irmão, não sucessor.
    assert.deepEqual(
      [...entrada.siblingOf].sort(),
      ['derived.defenses.immunities', 'derived.defenses.resistances', 'derived.defenses.vulnerabilities'],
    );
  });

  test('as defesas carregam o NOME de exibição ao lado do ContentId (Task 33)', () => {
    // O defeito que este caso previne: a ficha mostrando
    // `dnd2024:damage-type:fogo` onde o jogador espera um nome de tipo de dano.
    const registry = fakeRegistry();
    const character = projectLegacyCharacterForQueries(legacyRecords[0].record, ctx);
    assert.equal(character.ok, true);
    const comResistencia = {
      ...character.value,
      build: {
        ...character.value.build,
        legacyGrants: {
          ...(character.value.build.legacyGrants ?? {}),
          resistanceIds: ['dnd2024:damage-type:fogo', 'dnd2024:damage-type:desconhecido'],
        },
      },
    };
    const built = buildSheetViewModel(comResistencia, { registry, maximumHitPoints: 10, now: NOW });
    assert.equal(built.ok, true, built.ok ? '' : JSON.stringify(built.error));
    const defesas = built.value.derived.defenses;
    // Os ids continuam intactos (é por eles que a mecânica compara). A ORDEM é
    // a que `getDefenses` produz — os rótulos acompanham posição a posição.
    assert.deepEqual([...defesas.resistances], ['dnd2024:damage-type:desconhecido', 'dnd2024:damage-type:fogo']);
    // O segundo resolve no catálogo; o primeiro NÃO — e mantém o próprio id,
    // em vez de sumir da lista ou virar um nome inventado.
    assert.deepEqual([...defesas.resistanceLabels], ['dnd2024:damage-type:desconhecido', 'Fogo']);
    assert.equal(defesas.resistanceLabels.length, defesas.resistances.length);
  });

  test('sem a porta de handlers, `classActions` declara a AUSÊNCIA em vez de sumir', () => {
    // O bug que este caso previne: devolver `handlers: []` sem motivo faria a
    // ficha de um Bárbaro mostrar zero ações e o jogador concluir que a Fúria
    // sumiu — sem erro, sem log, sem teste vermelho.
    const built = viewModelOf(legacyRecords[0].record);
    assert.equal(built.ok, true);
    assert.equal(built.value.derived.classActions.available, false);
    assert.equal(built.value.derived.classActions.unavailableReason, 'COMMAND_CLASS_HANDLER_INVOKER_REQUIRED');
    assert.deepEqual([...built.value.derived.classActions.handlers], []);
  });

  test('data é ECO do personagem canônico — nenhuma chave a mais, nenhuma conta', () => {
    const character = projectLegacyCharacterForQueries(legacyRecords[0].record, ctx);
    const built = viewModelOf(legacyRecords[0].record);
    assert.equal(built.ok, true);
    assert.deepEqual(Object.keys(built.value.data).sort(), [...DATA_KEYS].sort());
    for (const key of DATA_KEYS) {
      assert.deepEqual(built.value.data[key], character.value[key] ?? null, key);
    }
  });

  test('o único nome de PV temporário é derived.hitPoints.temporary', () => {
    const built = viewModelOf(legacyRecords[0].record);
    assert.equal(built.ok, true);
    const serializado = JSON.stringify(built.value.derived);
    assert.ok(!serializado.includes('pv_temp'), 'nome legado pv_temp vazou para o ViewModel');
    assert.ok(!serializado.includes('pv_temporario'), 'nome legado pv_temporario vazou para o ViewModel');
    assert.equal(typeof built.value.derived.hitPoints.temporary, 'number');
  });
});

describe('unit/sheet/sheet-view-model — pureza', () => {
  test('não muta a entrada (igualdade profunda contra cópia tirada antes)', () => {
    const character = projectLegacyCharacterForQueries(legacyRecords[0].record, ctx);
    assert.equal(character.ok, true);
    const antes = structuredClone(character.value);
    const built = buildSheetViewModel(character.value, {
      registry: fakeRegistry(),
      maximumHitPoints: deriveLegacyQueryHints(legacyRecords[0].record).maximumHitPoints,
      now: NOW,
    });
    assert.equal(built.ok, true, built.ok ? '' : JSON.stringify(built.error));
    assert.deepEqual(structuredClone(character.value), antes);
  });

  test('aceita entrada CONGELADA em profundidade sem lançar', () => {
    const character = projectLegacyCharacterForQueries(legacyRecords[0].record, ctx);
    deepFreeze(character.value);
    const built = buildSheetViewModel(character.value, {
      registry: fakeRegistry(),
      maximumHitPoints: deriveLegacyQueryHints(legacyRecords[0].record).maximumHitPoints,
      now: NOW,
    });
    assert.equal(built.ok, true, built.ok ? '' : JSON.stringify(built.error));
  });

  test('a SAÍDA é congelada em profundidade', () => {
    const built = viewModelOf(legacyRecords[0].record);
    assert.equal(built.ok, true);
    const vm = built.value;
    assert.ok(Object.isFrozen(vm));
    assert.ok(Object.isFrozen(vm.derived));
    assert.ok(Object.isFrozen(vm.derived.hitPoints));
    assert.ok(Object.isFrozen(vm.derived.abilities.forca));
    assert.ok(Object.isFrozen(vm.data.identity));
    assert.throws(() => {
      vm.derived.hitPoints.current = 999;
    }, TypeError);
  });

  test('duas construções seguidas produzem o MESMO resultado (sem estado escondido)', () => {
    const a = viewModelOf(legacyRecords[0].record);
    const b = viewModelOf(legacyRecords[0].record);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.deepEqual(a.value, b.value);
  });

  test('personagem inválido é erro estruturado, nunca um ViewModel parcial', () => {
    for (const entrada of [null, {}, { identity: {} }]) {
      const built = buildSheetViewModel(entrada, {});
      assert.equal(built.ok, false);
      assert.equal(built.error.code, 'SHEET_VIEW_MODEL_CHARACTER_INVALID');
    }
  });
});

describe('unit/sheet/sheet-view-model — paridade com derived-values.json', () => {
  /**
   * @param {string} id
   * @returns {object}
   */
  function caseById(id) {
    const found = derivedValues.cases.find((entry) => entry.id === id);
    assert.ok(found, `caso "${id}" não encontrado em derived-values.json`);
    return found;
  }

  /**
   * @param {string} id
   * @returns {object} viewModel
   */
  function vmForCase(id) {
    const built = viewModelOf(caseById(id).personagem);
    assert.equal(built.ok, true, built.ok ? '' : JSON.stringify(built.error));
    return built.value;
  }

  test('pv-convergente: current/maximum', () => {
    const vm = vmForCase('pv-convergente');
    assert.equal(`${vm.derived.hitPoints.current}/${vm.derived.hitPoints.maximum}`, caseById('pv-convergente').expectedUnified);
  });

  test('pv-temporario-divergente: temporary (o caso em que print/PDF legados divergiam)', () => {
    const vm = vmForCase('pv-temporario-divergente');
    assert.equal(vm.derived.hitPoints.temporary, caseById('pv-temporario-divergente').expectedUnified);
  });

  test('dados-de-vida-restantes-divergente: hitDiceRemaining', () => {
    const vm = vmForCase('dados-de-vida-restantes-divergente');
    assert.equal(vm.derived.hitPoints.hitDiceRemaining, caseById('dados-de-vida-restantes-divergente').expectedUnified);
  });

  test('ca-convergente: armorClass', () => {
    const vm = vmForCase('ca-convergente');
    assert.equal(vm.derived.armorClass, caseById('ca-convergente').expectedUnified);
  });

  test('iniciativa-convergente: initiative', () => {
    const vm = vmForCase('iniciativa-convergente');
    assert.equal(vm.derived.initiative, caseById('iniciativa-convergente').expectedUnified);
  });

  test('deslocamento-convergente: movement.effective', () => {
    const testCase = caseById('deslocamento-convergente');
    const vm = vmForCase('deslocamento-convergente');
    assert.equal(`${vm.derived.movement.effective} metros`, testCase.expectedUnified);
  });

  test('cd-magia / ataque-magia: defenses.spellSaveDC e defenses.spellAttackBonus', () => {
    const cd = caseById('cd-magia-convergente');
    const ataque = caseById('ataque-magia-convergente');
    assert.equal(vmForCase('cd-magia-convergente').derived.defenses.spellSaveDC, cd.expectedUnified);
    assert.equal(vmForCase('ataque-magia-convergente').derived.defenses.spellAttackBonus, Number(String(ataque.expectedUnified).replace('+', '')));
  });

  test('percepcao/intuicao passivas: senses e a projeção da perícia correspondente', () => {
    const percepcao = caseById('percepcao-passiva-convergente');
    const intuicao = caseById('intuicao-passiva-convergente');
    const vmP = vmForCase('percepcao-passiva-convergente');
    const vmI = vmForCase('intuicao-passiva-convergente');
    assert.equal(vmP.derived.senses.passivePerception, percepcao.expectedUnified);
    assert.equal(vmP.derived.skills['dnd2024:skill:percepcao'].passive, percepcao.expectedUnified);
    assert.equal(vmI.derived.senses.passiveInsight, intuicao.expectedUnified);
    assert.equal(vmI.derived.skills['dnd2024:skill:intuicao'].passive, intuicao.expectedUnified);
  });
});


// ============================================================
// Extensões da Task 29 à lista de chaves da Task 16
// (salvaguardas, espaços de magia, recursos, ataques, carga, impressão).
//
// As fixtures legadas não exercitam recursos nem ataques (nenhuma delas tem
// `state.resources` preenchido ou arma equipada resolvível pelo catálogo), e
// um contrato de shape que nunca vê uma entrada é um contrato que não prova
// nada. Por isso estes casos montam um personagem PRÓPRIO, com catálogo
// próprio, para que cada projeção nova seja verificada no VALOR e não só na
// forma.
// ============================================================

const ESPADA_LONGA = Object.freeze({
  id: 'dnd2024:weapon:espada-longa',
  type: 'weapon',
  name: 'Espada Longa',
  weaponCategory: 'martial',
  rangeCategory: 'melee',
  damage: Object.freeze({ dice: '1d8', type: 'dnd2024:damage-type:cortante' }),
  properties: Object.freeze(['versatile']),
  weight: 1.5,
  effects: Object.freeze([]),
});

const ADAGA = Object.freeze({
  id: 'dnd2024:weapon:adaga',
  type: 'weapon',
  name: 'Adaga',
  weaponCategory: 'simple',
  rangeCategory: 'melee',
  damage: Object.freeze({ dice: '1d4', type: 'dnd2024:damage-type:perfurante' }),
  properties: Object.freeze(['finesse', 'thrown', 'light']),
  weight: 0.5,
  effects: Object.freeze([]),
});

const ARCO_CURTO = Object.freeze({
  id: 'dnd2024:weapon:arco-curto',
  type: 'weapon',
  name: 'Arco Curto',
  weaponCategory: 'simple',
  rangeCategory: 'ranged',
  damage: Object.freeze({ dice: '1d6', type: 'dnd2024:damage-type:perfurante' }),
  properties: Object.freeze(['ammunition', 'two-handed']),
  weight: 1,
  effects: Object.freeze([]),
});

const CLASSE_COM_RECURSO = Object.freeze({
  id: 'dnd2024:class:barbaro',
  type: 'class',
  name: 'Bárbaro',
  effects: Object.freeze([
    Object.freeze({ type: 'resource', resource: 'furia', max: 3, recovery: 'long-rest' }),
  ]),
});

const ESPECIE_TESTE = Object.freeze({ id: 'dnd2024:species:humano', type: 'species', name: 'Humano', effects: Object.freeze([]), size: 'medium', speed: 9 });
const ANTECEDENTE_TESTE = Object.freeze({ id: 'dnd2024:background:andarilho', type: 'background', name: 'Andarilho', effects: Object.freeze([]) });

/**
 * Catálogo próprio destes casos.
 * @param {ReadonlyArray<object>} extras
 * @returns {Readonly<object>}
 */
function registryDe(extras = []) {
  const known = {};
  for (const entity of [ESPADA_LONGA, ADAGA, ARCO_CURTO, CLASSE_COM_RECURSO, ESPECIE_TESTE, ANTECEDENTE_TESTE, ...extras]) {
    known[entity.id] = entity;
  }
  return Object.freeze({
    /**
     * @param {string} id
     * @returns {object|null}
     */
    get(id) {
      return known[id] ?? null;
    },
    /**
     * @param {*} reference
     * @returns {object}
     */
    resolve(reference) {
      const id = typeof reference === 'string' ? reference : reference?.id;
      return ok(known[id] ?? Object.freeze({ id, type: 'stub', effects: Object.freeze([]) }));
    },
    /**
     * @param {string} type
     * @returns {ReadonlyArray<object>}
     */
    list(type) {
      return type === 'skill' ? Object.freeze(SKILL_IDS.map((id) => Object.freeze({ id, type: 'skill' }))) : Object.freeze([]);
    },
  });
}

/**
 * Personagem canônico montado à mão para os casos das extensões.
 * @param {object} [patch]
 * @returns {object}
 */
function personagemDeTeste(patch = {}) {
  const base = createEmptyCharacter({ id: 'ext-0001-0001', now: NOW, rulesetRef: { id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' } });
  return Object.freeze({
    ...base,
    identity: Object.freeze({ ...base.identity, name: 'Kael', alignment: 'Caótico e Bom' }),
    build: Object.freeze({
      ...base.build,
      classRef: Object.freeze({ id: 'dnd2024:class:barbaro' }),
      speciesRef: Object.freeze({ id: 'dnd2024:species:humano' }),
      backgroundRef: Object.freeze({ id: 'dnd2024:background:andarilho' }),
      legacyGrants: Object.freeze({
        ...base.build.legacyGrants,
        // A consulta casa por ContentId terminando em `:<chave>` — nunca a
        // chave crua (ver queries/proficiencies.js#isSavingThrowProficient).
        savingThrowProficiencyIds: Object.freeze(['dnd2024:ability:forca', 'dnd2024:ability:constituicao']),
      }),
      ...(patch.build ?? {}),
    }),
    state: Object.freeze({
      ...base.state,
      level: 5,
      abilities: Object.freeze({ forca: 16, destreza: 14, constituicao: 14, inteligencia: 10, sabedoria: 12, carisma: 8 }),
      hitPoints: Object.freeze({ current: 30, temporary: 0 }),
      ...(patch.state ?? {}),
    }),
    metadata: Object.freeze({ ...base.metadata, createdAt: NOW, updatedAt: NOW }),
  });
}

/**
 * Constrói o ViewModel do personagem de teste.
 * @param {object} character
 * @param {object} [extraContext]
 * @returns {object} viewModel
 */
function vmDeTeste(character, extraContext = {}) {
  const built = buildSheetViewModel(character, {
    registry: registryDe(extraContext.extras ?? []),
    maximumHitPoints: 45,
    now: NOW,
    ...extraContext,
  });
  assert.equal(built.ok, true, built.ok ? '' : JSON.stringify(built.error));
  return built.value;
}

describe('unit/sheet/sheet-view-model — salvaguardas', () => {
  test('proficiente soma o bônus de proficiência; não proficiente é só o modificador', () => {
    const vm = vmDeTeste(personagemDeTeste());
    // Nível 5 -> PB 3. Força 16 (+3), Destreza 14 (+2), Carisma 8 (-1).
    assert.equal(vm.derived.proficiencyBonus, 3);
    assert.deepEqual(vm.derived.savingThrows.forca, { abilityKey: 'forca', proficient: true, bonus: 6 });
    assert.deepEqual(vm.derived.savingThrows.constituicao, { abilityKey: 'constituicao', proficient: true, bonus: 5 });
    assert.deepEqual(vm.derived.savingThrows.destreza, { abilityKey: 'destreza', proficient: false, bonus: 2 });
    assert.deepEqual(vm.derived.savingThrows.carisma, { abilityKey: 'carisma', proficient: false, bonus: -1 });
  });

  test('efeitos declarados sobre save.<chave> ENTRAM no bônus', () => {
    // `save` é namespace de alvo de primeira classe no motor da Task 15. A
    // primeira versão parava em modificador + proficiência e ignorava os
    // efeitos em silêncio — um item mágico de "+2 em salvaguardas de Destreza"
    // simplesmente não apareceria.
    const amuleto = Object.freeze({
      id: 'dnd2024:class:barbaro',
      type: 'class',
      name: 'Bárbaro',
      effects: Object.freeze([
        Object.freeze({ type: 'modifier', target: 'save.destreza', operation: 'add', value: 2 }),
        Object.freeze({ type: 'resource', resource: 'furia', max: 3, recovery: 'long-rest' }),
      ]),
    });
    const built = buildSheetViewModel(personagemDeTeste(), { registry: registryDe([amuleto]), maximumHitPoints: 45, now: NOW });
    assert.equal(built.ok, true, built.ok ? '' : JSON.stringify(built.error));
    // Destreza 14 (+2), sem proficiência, mais o efeito de +2.
    assert.equal(built.value.derived.savingThrows.destreza.bonus, 4);
    // As demais continuam intactas.
    assert.equal(built.value.derived.savingThrows.forca.bonus, 6);
  });

  test('há uma salvaguarda para CADA habilidade canônica', () => {
    const vm = vmDeTeste(personagemDeTeste());
    assert.deepEqual(Object.keys(vm.derived.savingThrows).sort(), [...ABILITY_KEYS].sort());
  });
});

describe('unit/sheet/sheet-view-model — espaços de magia', () => {
  test('byLevel traz usado/extra/máximo/disponível da tabela de progressão', () => {
    const character = personagemDeTeste({
      state: { spells: { known: [], prepared: [], spellbook: [], slots: { 1: { used: 2 }, 2: { used: 0, extra: 1 } }, pactSlots: { used: 1 }, concentration: null, freeKnownSlots: 0 } },
    });
    const vm = vmDeTeste(character, {
      spellcasting: { slotMaximums: { 1: 4, 2: 3 }, pactSlots: { maximum: 2, level: 3 }, cantripsKnown: 4, preparedLimit: 6 },
    });
    assert.deepEqual(vm.derived.spellSlots.byLevel['1'], { level: 1, used: 2, extra: 0, maximum: 4, available: 2 });
    assert.deepEqual(vm.derived.spellSlots.byLevel['2'], { level: 2, used: 0, extra: 1, maximum: 4, available: 4 });
    assert.deepEqual(vm.derived.spellSlots.pact, { used: 1, maximum: 2, level: 3, available: 1 });
    assert.equal(vm.derived.spellSlots.cantripsKnown, 4);
    assert.equal(vm.derived.spellSlots.preparedLimit, 6);
  });

  test('sem tabela de progressão os tetos ficam null, nunca chutados', () => {
    const vm = vmDeTeste(personagemDeTeste());
    assert.deepEqual(vm.derived.spellSlots.byLevel, {});
    assert.equal(vm.derived.spellSlots.pact.maximum, null);
    assert.equal(vm.derived.spellSlots.cantripsKnown, null);
  });

  test('CD e ataque de magia NÃO são repetidos em spellSlots (fonte única em defenses)', () => {
    const vm = vmDeTeste(personagemDeTeste());
    assert.equal(Object.hasOwn(vm.derived.spellSlots, 'saveDC'), false);
    assert.equal(Object.hasOwn(vm.derived.spellSlots, 'attackBonus'), false);
    assert.ok(Object.hasOwn(vm.derived.defenses, 'spellSaveDC'));
  });
});

describe('unit/sheet/sheet-view-model — recursos', () => {
  // `state.resources[id].current` é USO RESTANTE, não uso gasto: o recurso
  // nasce com `current = max` (apply-grants), gastar DECREMENTA
  // (conditions#useResource) e descansar RESTAURA até o teto (rest.js).
  // A primeira versão desta projeção calculava `available = maximum - current`,
  // copiando o padrão de `spellSlots` (onde o campo se chama `used` e a
  // subtração está certa) — e invertia a contagem na tela: um bárbaro
  // descansado, com as 3 fúrias intactas, aparecia com "0 disponíveis".

  test('recurso INTACTO mostra todos os usos disponíveis e nada gasto', () => {
    const character = personagemDeTeste({ state: { resources: { 'dnd2024:resource:furia': { current: 3 } } } });
    const vm = vmDeTeste(character);
    assert.deepEqual(vm.derived.resources['dnd2024:resource:furia'], {
      current: 3,
      maximum: 3,
      available: 3,
      spent: 0,
      recovery: 'long-rest',
    });
  });

  test('gastar usos DERRUBA o disponível e sobe o gasto', () => {
    // O comando real é quem decrementa; aqui basta o estado que ele produz.
    const gastouDois = personagemDeTeste({ state: { resources: { 'dnd2024:resource:furia': { current: 1 } } } });
    const vm = vmDeTeste(gastouDois);
    assert.equal(vm.derived.resources['dnd2024:resource:furia'].available, 1, 'sobrou 1 uso');
    assert.equal(vm.derived.resources['dnd2024:resource:furia'].spent, 2, 'dois usos foram gastos');
  });

  test('o disponível cai a cada uso e VOLTA ao máximo depois do descanso longo', async () => {
    // Percorre o ciclo real com os COMANDOS de domínio, não com estados
    // digitados à mão: é a única forma de provar que a leitura da ficha
    // concorda com quem escreve o estado.
    const { executeCharacterCommand } = await import('../../../site/js/domain/commands/command-dispatcher.js');
    const registry = registryDe();
    const contexto = { registry, maximumHitPoints: 45, now: NOW };

    let character = personagemDeTeste({ state: { resources: { 'dnd2024:resource:furia': { current: 3 } } } });
    assert.equal(vmDeTeste(character).derived.resources['dnd2024:resource:furia'].available, 3);

    const gasto = executeCharacterCommand(character, { type: 'use-resource', resourceId: 'dnd2024:resource:furia', amount: 2 }, contexto);
    assert.equal(gasto.ok, true, gasto.ok ? '' : gasto.error.code);
    character = gasto.character;
    const depoisDoGasto = buildSheetViewModel(character, contexto);
    assert.equal(depoisDoGasto.ok, true, depoisDoGasto.ok ? '' : JSON.stringify(depoisDoGasto.error));
    assert.equal(depoisDoGasto.value.derived.resources['dnd2024:resource:furia'].available, 1);
    assert.equal(depoisDoGasto.value.derived.resources['dnd2024:resource:furia'].spent, 2);

    const descanso = executeCharacterCommand(character, { type: 'long-rest' }, contexto);
    assert.equal(descanso.ok, true, descanso.ok ? '' : descanso.error.code);
    const depoisDoDescanso = buildSheetViewModel(descanso.character, contexto);
    assert.equal(depoisDoDescanso.ok, true, depoisDoDescanso.ok ? '' : JSON.stringify(depoisDoDescanso.error));
    assert.equal(depoisDoDescanso.value.derived.resources['dnd2024:resource:furia'].available, 3, 'o descanso longo devolve todos os usos');
    assert.equal(depoisDoDescanso.value.derived.resources['dnd2024:resource:furia'].spent, 0);
  });

  test('recurso declarado pelo efeito aparece mesmo sem estado gravado', () => {
    const vm = vmDeTeste(personagemDeTeste());
    assert.deepEqual(vm.derived.resources['dnd2024:resource:furia'], {
      current: null,
      maximum: 3,
      available: null,
      spent: null,
      recovery: 'long-rest',
    });
  });

  test('"max" não resolvível vira maximum null — nunca um teto chutado', () => {
    const classeRuim = Object.freeze({
      id: 'dnd2024:class:barbaro',
      type: 'class',
      name: 'Bárbaro',
      effects: Object.freeze([Object.freeze({ type: 'resource', resource: 'furia', max: 'ilimitado', recovery: 'long-rest' })]),
    });
    const character = personagemDeTeste({ state: { resources: { 'dnd2024:resource:furia': { current: 2 } } } });
    const built = buildSheetViewModel(character, { registry: registryDe([classeRuim]), maximumHitPoints: 45, now: NOW });
    assert.equal(built.ok, true, built.ok ? '' : JSON.stringify(built.error));
    assert.deepEqual(built.value.derived.resources['dnd2024:resource:furia'], {
      current: 2,
      maximum: null,
      available: 2,
      spent: null,
      recovery: 'long-rest',
    });
  });

  test('a MESMA leitura serve a ficha e ao descanso, com reações documentadas', async () => {
    // `rest.js` e o ViewModel compartilham `collectDeclaredResourceMaxima`.
    // Sobre o MESMO `max` inválido, o descanso RECUSA (não pode restaurar até
    // um teto desconhecido) e a ficha EXIBE sem teto (não pode deixar de
    // abrir). São duas decisões sobre uma leitura só — não duas leituras.
    const { executeCharacterCommand } = await import('../../../site/js/domain/commands/command-dispatcher.js');
    const classeRuim = Object.freeze({
      id: 'dnd2024:class:barbaro',
      type: 'class',
      name: 'Bárbaro',
      effects: Object.freeze([Object.freeze({ type: 'resource', resource: 'furia', max: 'ilimitado', recovery: 'long-rest' })]),
    });
    const character = personagemDeTeste({ state: { resources: { 'dnd2024:resource:furia': { current: 2 } } } });
    const contexto = { registry: registryDe([classeRuim]), maximumHitPoints: 45, now: NOW };

    const descanso = executeCharacterCommand(character, { type: 'long-rest' }, contexto);
    assert.equal(descanso.ok, false);
    assert.equal(descanso.error.code, 'COMMAND_REST_RESOURCE_MAX_UNRESOLVED');

    const ficha = buildSheetViewModel(character, contexto);
    assert.equal(ficha.ok, true, 'a ficha precisa abrir mesmo com um teto irresolúvel');
    assert.equal(ficha.value.derived.resources['dnd2024:resource:furia'].maximum, null);
  });
});

describe('unit/sheet/sheet-view-model — ataques', () => {
  /**
   * @param {ReadonlyArray<object>} inventory
   * @returns {object}
   */
  function comInventario(inventory) {
    return personagemDeTeste({ state: { inventory: Object.freeze(inventory) } });
  }

  test('arma corpo a corpo comum usa Força; a distância usa Destreza; acuidade usa o maior', () => {
    const character = comInventario([
      { instanceId: 'i1', itemRef: { id: 'dnd2024:weapon:espada-longa' }, quantity: 1, equipped: true },
      { instanceId: 'i2', itemRef: { id: 'dnd2024:weapon:arco-curto' }, quantity: 1, equipped: true },
      { instanceId: 'i3', itemRef: { id: 'dnd2024:weapon:adaga' }, quantity: 1, equipped: true },
    ]);
    const vm = vmDeTeste(character);
    const porId = Object.fromEntries(vm.derived.attacks.map((a) => [a.instanceId, a]));
    // Força 16 (+3), Destreza 14 (+2). Sem weaponProficiencies declaradas, o
    // bônus de proficiência NÃO entra.
    assert.equal(porId.i1.abilityKey, 'forca');
    assert.equal(porId.i1.attackBonus, 3);
    assert.equal(porId.i1.damageDice, '1d8');
    assert.equal(porId.i2.abilityKey, 'destreza');
    assert.equal(porId.i2.attackBonus, 2);
    // Acuidade: Força (+3) >= Destreza (+2) -> Força, como no oráculo legado.
    assert.equal(porId.i3.abilityKey, 'forca');
    assert.equal(porId.i3.damageBonus, 3);
  });

  test('proficiência declarada soma o bônus de proficiência; ausente não soma', () => {
    const character = comInventario([{ instanceId: 'i1', itemRef: { id: 'dnd2024:weapon:espada-longa' }, quantity: 1, equipped: true }]);
    const semDeclaracao = vmDeTeste(character);
    assert.equal(semDeclaracao.derived.attacks[0].proficient, null);
    assert.equal(semDeclaracao.derived.attacks[0].attackBonus, 3);

    const comDeclaracao = vmDeTeste(character, { weaponProficiencies: ['martial'] });
    assert.equal(comDeclaracao.derived.attacks[0].proficient, true);
    assert.equal(comDeclaracao.derived.attacks[0].attackBonus, 6);

    const naoProficiente = vmDeTeste(character, { weaponProficiencies: ['simple'] });
    assert.equal(naoProficiente.derived.attacks[0].proficient, false);
    assert.equal(naoProficiente.derived.attacks[0].attackBonus, 3);
  });

  test('TODA arma do inventário vira ataque (equipada ou não), com a flag equipped', () => {
    // Paridade com o oráculo legado (`sheet.js` ~15540-15600), que calcula
    // Atq/Dano para todo item de tipo arma, esteja equipado ou não. A primeira
    // versão filtrava por equipado e fazia sumir da ficha o ataque de uma arma
    // guardada na mochila.
    const character = comInventario([
      { instanceId: 'i1', itemRef: { id: 'dnd2024:weapon:espada-longa' }, quantity: 1, equipped: false },
      { instanceId: 'i2', itemRef: { id: 'dnd2024:weapon:adaga' }, quantity: 1, equipped: true },
    ]);
    const vm = vmDeTeste(character);
    assert.deepEqual(
      vm.derived.attacks.map((a) => [a.instanceId, a.equipped]),
      [
        ['i1', false],
        ['i2', true],
      ],
    );
  });

  test('item que NÃO é arma nunca vira ataque', () => {
    const character = comInventario([{ instanceId: 'i1', itemRef: { id: 'dnd2024:species:humano' }, quantity: 1, equipped: true }]);
    assert.deepEqual(vmDeTeste(character).derived.attacks, []);
  });

  test('proficiência de arma é DERIVADA das proficiências extras do personagem', () => {
    // A fonte estruturada que sobreviveu à migração é
    // `build.legacyGrants.otherProficiencies` (o `proficiencias_extra` legado),
    // comparada por rótulo exato — nunca por busca em texto livre.
    const character = personagemDeTeste({
      build: {
        legacyGrants: Object.freeze({
          skillProficiencyIds: Object.freeze([]),
          skillExpertiseIds: Object.freeze([]),
          savingThrowProficiencyIds: Object.freeze([]),
          languageIds: Object.freeze([]),
          toolProficiencyIds: Object.freeze([]),
          instrumentProficiencyIds: Object.freeze([]),
          otherProficiencies: Object.freeze(['Armas Marciais']),
          resistanceIds: Object.freeze([]),
          vulnerabilityIds: Object.freeze([]),
          immunityIds: Object.freeze([]),
        }),
      },
      state: { inventory: Object.freeze([{ instanceId: 'i1', itemRef: { id: 'dnd2024:weapon:espada-longa' }, quantity: 1, equipped: true }]) },
    });
    const vm = vmDeTeste(character);
    assert.equal(vm.derived.attacks[0].proficient, true, 'a proficiência extra precisa ser derivada sem injeção');
    assert.equal(vm.derived.attacks[0].attackBonus, 6, 'Força +3 e bônus de proficiência +3');
  });

  test('sem NENHUMA fonte de proficiência, fica DESCONHECIDA (null), nunca falsa', () => {
    // Dívida de conteúdo registrada: a proficiência concedida pela CLASSE só
    // existe como prosa no pacote dnd2024. `null` diz "não sei"; `false` diria
    // "sabidamente não proficiente", o que seria falso para um Guerreiro.
    const character = comInventario([{ instanceId: 'i1', itemRef: { id: 'dnd2024:weapon:espada-longa' }, quantity: 1, equipped: true }]);
    const vm = vmDeTeste(character);
    assert.equal(vm.derived.attacks[0].proficient, null);
    assert.notEqual(vm.derived.attacks[0].proficient, false);
  });

  test('efeitos nos alvos attack/damage entram no bônus', () => {
    const classeComBonus = Object.freeze({
      id: 'dnd2024:class:barbaro',
      type: 'class',
      name: 'Bárbaro',
      effects: Object.freeze([
        Object.freeze({ type: 'modifier', target: 'attack', operation: 'add', value: 2 }),
        Object.freeze({ type: 'modifier', target: 'damage', operation: 'add', value: 1 }),
      ]),
    });
    const character = comInventario([{ instanceId: 'i1', itemRef: { id: 'dnd2024:weapon:espada-longa' }, quantity: 1, equipped: true }]);
    const built = buildSheetViewModel(character, { registry: registryDe([classeComBonus]), maximumHitPoints: 45, now: NOW });
    assert.equal(built.ok, true, built.ok ? '' : JSON.stringify(built.error));
    assert.equal(built.value.derived.attacks[0].attackBonus, 5);
    assert.equal(built.value.derived.attacks[0].damageBonus, 4);
  });
});

describe('unit/sheet/sheet-view-model — carga transportada', () => {
  test('peso total e sobrecarga são CALCULADOS, não ecoados do contexto', () => {
    const character = personagemDeTeste({
      state: {
        inventory: Object.freeze([
          { instanceId: 'i1', itemRef: { id: 'dnd2024:weapon:espada-longa' }, quantity: 2, equipped: true },
          { instanceId: 'i2', itemRef: { id: 'dnd2024:weapon:adaga' }, quantity: 4, equipped: false },
        ]),
      },
    });
    const vm = vmDeTeste(character);
    // 2 x 1,5kg + 4 x 0,5kg = 5kg.
    assert.equal(vm.derived.load.totalWeightKg, 5);
    assert.equal(vm.derived.load.overloaded, false);
    assert.equal(vm.derived.load.encumbranceLevel, 'none');
    assert.equal(vm.derived.load.carryingCapacityKg, vm.derived.movement.carryingCapacity);
  });

  test('acima da capacidade, sobrecarrega', () => {
    const pedra = Object.freeze({ id: 'dnd2024:equipment:pedra', type: 'equipment', name: 'Pedra', category: 'Aventura', weight: 500 });
    const character = personagemDeTeste({
      state: { inventory: Object.freeze([{ instanceId: 'i1', itemRef: { id: 'dnd2024:equipment:pedra' }, quantity: 1, equipped: false }]) },
    });
    const built = buildSheetViewModel(character, { registry: registryDe([pedra]), maximumHitPoints: 45, now: NOW });
    assert.equal(built.ok, true, built.ok ? '' : JSON.stringify(built.error));
    assert.equal(built.value.derived.load.overloaded, true);
    assert.equal(built.value.derived.load.encumbranceLevel, 'overloaded');
  });

  test('a sobrecarga CHEGA ao deslocamento: o ViewModel não se contradiz', () => {
    // O defeito que este caso prende: `load.overloaded: true` convivendo com
    // `movement.effective` sem penalidade nenhuma — e `printable.statBoxes.speed`
    // imprimindo esse valor errado no PDF. A composição obrigatória é passar o
    // `encumbranceLevel` calculado pelo inventário para `getMovement`.
    const pedra = Object.freeze({ id: 'dnd2024:equipment:pedra', type: 'equipment', name: 'Pedra', category: 'Aventura', weight: 500 });
    const inventario = Object.freeze([{ instanceId: 'i1', itemRef: { id: 'dnd2024:equipment:pedra' }, quantity: 1, equipped: false }]);
    const leve = personagemDeTeste();
    const pesado = personagemDeTeste({
      state: { inventory: inventario },
      build: { options: Object.freeze({ encumbranceAffectsMovement: true }) },
    });
    const registry = registryDe([pedra]);

    const semCarga = buildSheetViewModel(leve, { registry, maximumHitPoints: 45, now: NOW });
    const comCarga = buildSheetViewModel(pesado, { registry, maximumHitPoints: 45, now: NOW });
    assert.equal(semCarga.ok, true);
    assert.equal(comCarga.ok, true, comCarga.ok ? '' : JSON.stringify(comCarga.error));

    assert.equal(comCarga.value.derived.load.overloaded, true);
    assert.ok(
      comCarga.value.derived.movement.effective < semCarga.value.derived.movement.effective,
      'sobrecarregado precisa andar menos do que sem carga',
    );
    assert.equal(
      comCarga.value.derived.printable.statBoxes.speed,
      comCarga.value.derived.movement.effective,
      'o PDF imprime exatamente o deslocamento já penalizado',
    );
  });
});

describe('unit/sheet/sheet-view-model — dados imprimíveis', () => {
  test('o cabeçalho resolve os NOMES do catálogo a partir das referências', () => {
    const vm = vmDeTeste(personagemDeTeste());
    assert.deepEqual(vm.derived.printable.headline, {
      name: 'Kael',
      level: 5,
      className: 'Bárbaro',
      subclassName: null,
      speciesName: 'Humano',
      backgroundName: 'Andarilho',
      alignment: 'Caótico e Bom',
    });
  });

  test('as caixas de estatística REPETEM os valores de derived, sem recalcular', () => {
    const vm = vmDeTeste(personagemDeTeste());
    const caixas = vm.derived.printable.statBoxes;
    assert.equal(caixas.armorClass, vm.derived.armorClass);
    assert.equal(caixas.initiative, vm.derived.initiative);
    assert.equal(caixas.speed, vm.derived.movement.effective);
    assert.equal(caixas.hitPointsCurrent, vm.derived.hitPoints.current);
    assert.equal(caixas.hitPointsMaximum, vm.derived.hitPoints.maximum);
    assert.equal(caixas.hitPointsTemporary, vm.derived.hitPoints.temporary);
    assert.equal(caixas.proficiencyBonus, vm.derived.proficiencyBonus);
    assert.equal(caixas.spellSaveDC, vm.derived.defenses.spellSaveDC);
    assert.equal(caixas.spellAttackBonus, vm.derived.defenses.spellAttackBonus);
    assert.equal(caixas.passivePerception, vm.derived.senses.passivePerception);
  });

  test('sem catálogo os nomes ficam null, nunca o id cru nem um rótulo inventado', () => {
    const built = buildSheetViewModel(personagemDeTeste(), { maximumHitPoints: 45, now: NOW });
    assert.equal(built.ok, true, built.ok ? '' : JSON.stringify(built.error));
    assert.equal(built.value.derived.printable.headline.className, null);
    assert.equal(built.value.derived.printable.headline.speciesName, null);
  });
});
