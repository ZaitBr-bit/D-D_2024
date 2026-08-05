// Testes das consultas puras de personagem (Task 16):
// `domain/character/queries/*`. Cobre armaduras, escudos, defesa sem
// armadura, exaustão, carga, sobrecarga, tamanhos, sentidos, resistências,
// perícias/expertise e overrides — e confirma que nenhuma das nove
// interfaces muta `character`/`context` (congelados profundamente, com
// `context` REALMENTE populado, antes de cada chamada — fix round 1,
// achado I7). Também cobre os achados C2 (canal `talentPassives`), C3
// (CA numérica não confiável), I1 (overrides sem registry), I4 (conformidade
// com `tests/fixtures/expected/sheet-view-model-keys.json`) e I6 (alvos de
// efeito `passive-perception`/`carrying-capacity`/`size`).

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import { ok } from '../../../site/js/core/result.js';
import {
  getAbilityModifier,
  getProficiencyBonus,
  getHitPointProjection,
  getArmorClass,
  getInitiative,
  getMovement,
  getDefenses,
  getSenses,
  getSkillProjection,
  isSkillProficient,
  isSkillExpert,
  isSavingThrowProficient,
  getSavingThrowProjection,
  collectDeclaredResourceMaxima,
  getResourceProjection,
} from '../../../site/js/domain/character/queries/index.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

let sheetViewModelKeys;
before(async () => {
  sheetViewModelKeys = JSON.parse(
    await readFile(path.join(repoRoot, 'tests/fixtures/expected/sheet-view-model-keys.json'), 'utf8'),
  );
});

/**
 * Congela `value` recursivamente (objetos simples e arrays), SEMPRE descendo
 * aos filhos mesmo que `value` já esteja congelado ao chegar aqui — um
 * objeto pai pode estar `Object.freeze`d sem que seus filhos estejam (fix
 * round 1, achado I7: a versão anterior curto-circuitava em
 * `Object.isFrozen(value)` e deixava sub-objetos de um pai já congelado
 * mutáveis). Proteção contra ciclos via `WeakSet` do caminho atual, mesmo
 * padrão de `site/js/core/errors.js#deepFreeze`.
 * @param {*} value
 * @param {WeakSet<object>} [seen]
 * @returns {*}
 */
function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return value;
  }
  seen.add(value);
  Object.freeze(value);
  for (const key of Object.keys(value)) {
    deepFreeze(value[key], seen);
  }
  return value;
}

/**
 * Monta um personagem canônico v2 de teste a partir de sobreposições rasas
 * em `build`/`state`/`identity`, com um inventário/atributos default
 * plausível. Sempre devolvido PROFUNDAMENTE congelado.
 * @param {object} [overrides]
 * @returns {object}
 */
function makeCharacter({ identity = {}, build = {}, state = {}, overrides } = {}) {
  const base = createEmptyCharacter({ id: 'char-1', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
  const character = {
    ...base,
    identity: { ...base.identity, ...identity },
    build: { ...base.build, ...build, legacyGrants: { ...base.build.legacyGrants, ...(build.legacyGrants ?? {}) } },
    state: { ...base.state, ...state, abilities: { ...base.state.abilities, ...(state.abilities ?? {}) } },
    ...(overrides ? { overrides } : {}),
  };
  return deepFreeze(character);
}

/** Registry mínimo/estável usado pelos testes que dependem de catálogo. */
function makeFakeRegistry(knownEntities = {}) {
  return Object.freeze({
    get(id) {
      return knownEntities[id] ?? null;
    },
    resolve(reference) {
      const id = typeof reference === 'string' ? reference : reference?.id;
      return ok(knownEntities[id] ?? Object.freeze({ id, type: 'stub', effects: Object.freeze([]) }));
    },
    list() {
      return Object.freeze([]);
    },
  });
}

const RULESET_ENTITY = Object.freeze({ id: 'dnd2024:ruleset:core', type: 'ruleset', effects: Object.freeze([]) });
const CLERIGO_ENTITY = Object.freeze({
  id: 'dnd2024:class:clerigo',
  type: 'class',
  effects: Object.freeze([]),
  spellcasting: Object.freeze({ ability: 'dnd2024:ability:sabedoria', progression: 'full' }),
});
const HUMANO_ENTITY = Object.freeze({ id: 'dnd2024:species:humano', type: 'species', effects: Object.freeze([]), size: 'medium', speed: 9 });
// Anão: velocidade 7,5m — DIFERENTE do fallback padrão de `movement.js`
// (`DEFAULT_SPEED_METERS = 9`), para que um teste que passa por este
// registry prove de verdade que o lookup de espécie roda (fix round 1,
// achado I3: usar Humano com 9m é tautológico, coincide com o fallback).
const ANAO_ENTITY = Object.freeze({ id: 'dnd2024:species:anao', type: 'species', effects: Object.freeze([]), size: 'medium', speed: 7.5 });

/** Registry "cheio" (ruleset + Clérigo + Anão) usado pelos testes de pureza (I7: context REALMENTE populado). */
function makeFullRegistry() {
  return makeFakeRegistry({
    'dnd2024:ruleset:core': RULESET_ENTITY,
    'dnd2024:class:clerigo': CLERIGO_ENTITY,
    'dnd2024:species:anao': ANAO_ENTITY,
  });
}

function inventoryEntry({ nome, tipo, equipped = true, dados = {} }) {
  return Object.freeze({
    instanceId: `inst-${nome}`,
    itemRef: null,
    customDefinition: Object.freeze({ nome, tipo, dados: Object.freeze({ ...dados }) }),
    quantity: 1,
    equipped,
    expended: 0,
    sourceInstanceId: null,
  });
}

describe('domain/character/queries — pureza (nunca muta character/context) — todas as 9 interfaces, context populado', () => {
  const clerigoCharacter = () =>
    makeCharacter({
      build: {
        classRef: Object.freeze({ id: 'dnd2024:class:clerigo', packageVersion: '1.0.0' }),
        speciesRef: Object.freeze({ id: 'dnd2024:species:anao', packageVersion: '1.0.0' }),
        legacyGrants: {
          skillProficiencyIds: Object.freeze(['dnd2024:skill:percepcao']),
          savingThrowProficiencyIds: Object.freeze(['dnd2024:ability:sabedoria']),
          resistanceIds: Object.freeze(['dnd2024:damage-type:fogo']),
        },
      },
      state: { level: 5, abilities: { destreza: 14, sabedoria: 16 }, exhaustion: 1 },
    });

  const populatedContext = () =>
    deepFreeze({
      registry: makeFullRegistry(),
      level: 5,
      choices: Object.freeze({}),
      equippedItemIds: Object.freeze([]),
      stateFlags: Object.freeze({ raging: false }),
      encumbranceLevel: 'encumbered',
      talentPassives: Object.freeze({ armorClassBonus: 1, initiativeBonus: 1, speedBonus: 1, mediumArmorMaxDexBonus: 3 }),
    });

  const cases = [
    ['getAbilityModifier', (c, ctx) => getAbilityModifier(c, 'sabedoria', ctx)],
    ['getProficiencyBonus', (c, ctx) => getProficiencyBonus(c, ctx)],
    ['getHitPointProjection', (c, ctx) => getHitPointProjection(c, { ...ctx, maximumHitPoints: 40 })],
    ['getArmorClass', (c, ctx) => getArmorClass(c, ctx)],
    ['getInitiative', (c, ctx) => getInitiative(c, ctx)],
    ['getMovement', (c, ctx) => getMovement(c, ctx)],
    ['getSkillProjection', (c, ctx) => getSkillProjection(c, 'dnd2024:skill:percepcao', ctx)],
    ['getDefenses', (c, ctx) => getDefenses(c, ctx)],
    ['getSenses', (c, ctx) => getSenses(c, ctx)],
  ];

  for (const [name, call] of cases) {
    test(`${name} não muta character nem context (ambos profundamente congelados e populados)`, () => {
      const character = clerigoCharacter();
      const context = populatedContext();
      const result = call(character, context);
      assert.equal(result.ok, true, `${name} falhou: ${JSON.stringify(result.error ?? null)}`);
      // Nenhuma asserção adicional necessária: se a consulta tivesse tentado
      // mutar `character`/`context` (ou qualquer sub-objeto), o `Object.freeze`
      // profundo acima teria lançado `TypeError` (modo estrito de ESM) antes
      // de chegarmos aqui — a ausência de exceção É a prova de pureza.
    });
  }
});

describe('domain/character/queries/abilities', () => {
  test('getAbilityModifier calcula o modificador padrão do 5e', () => {
    const character = makeCharacter({ state: { abilities: { forca: 16 } } });
    const result = getAbilityModifier(character, 'forca');
    assert.equal(result.ok, true);
    assert.equal(result.value, 3);
  });

  test('getAbilityModifier aceita ContentId de habilidade', () => {
    const character = makeCharacter({ state: { abilities: { destreza: 8 } } });
    const result = getAbilityModifier(character, 'dnd2024:ability:destreza');
    assert.equal(result.ok, true);
    assert.equal(result.value, -1);
  });

  test('getAbilityModifier rejeita id desconhecido', () => {
    const character = makeCharacter();
    const result = getAbilityModifier(character, 'nao-existe');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_QUERY_UNKNOWN_ABILITY_ID');
  });

  test('getProficiencyBonus segue a tabela padrão por nível', () => {
    for (const [level, expected] of [[1, 2], [4, 2], [5, 3], [8, 3], [9, 4], [17, 6], [20, 6]]) {
      const character = makeCharacter({ state: { level } });
      const result = getProficiencyBonus(character);
      assert.equal(result.ok, true, `nível ${level}`);
      assert.equal(result.value, expected, `nível ${level}`);
    }
  });
});

describe('domain/character/queries/hit-points', () => {
  test('usa context.maximumHitPoints quando não há override manual', () => {
    const character = makeCharacter({ state: { hitPoints: { current: 20, temporary: 6 }, hitDice: { used: 2 }, level: 5 } });
    const result = getHitPointProjection(character, { maximumHitPoints: 38 });
    assert.equal(result.ok, true);
    assert.deepStrictEqual(result.value, {
      current: 20,
      temporary: 6,
      maximum: 38,
      hitDiceTotal: 5,
      hitDiceUsed: 2,
      hitDiceRemaining: 3,
    });
  });

  test('override manual de PV máximo tem precedência sobre context.maximumHitPoints', () => {
    const character = makeCharacter({
      state: { hitPoints: { current: 10, temporary: 0 }, hitDice: { used: 0 }, level: 3 },
      overrides: { 'hp.maximum': { value: 99, source: 'manual' } },
    });
    const result = getHitPointProjection(character, { maximumHitPoints: 20 });
    assert.equal(result.ok, true);
    assert.equal(result.value.maximum, 99);
  });

  test('sem override e sem context.maximumHitPoints, devolve erro explícito (nunca inventa um valor)', () => {
    const character = makeCharacter();
    const result = getHitPointProjection(character, {});
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_QUERY_HP_MAXIMUM_UNKNOWN');
  });

  test('dados de vida restantes nunca fica negativo (usados > nível)', () => {
    const character = makeCharacter({ state: { hitDice: { used: 10 }, level: 3 } });
    const result = getHitPointProjection(character, { maximumHitPoints: 10 });
    assert.equal(result.ok, true);
    assert.equal(result.value.hitDiceRemaining, 0);
  });

  test('conformidade com sheet-view-model-keys.json (I4)', () => {
    const character = makeCharacter({ state: { hitPoints: { current: 1, temporary: 0 } } });
    const result = getHitPointProjection(character, { maximumHitPoints: 10 });
    assert.equal(result.ok, true);
    assert.deepStrictEqual(
      Object.keys(result.value).sort(),
      [...sheetViewModelKeys.projections.HitPointProjection.keys].sort(),
    );
  });
});

describe('domain/character/queries/combat — Classe de Armadura', () => {
  test('sem armadura equipada: 10 + mod Destreza', () => {
    const character = makeCharacter({ state: { abilities: { destreza: 14 } } });
    const result = getArmorClass(character);
    assert.equal(result.ok, true);
    assert.equal(result.value, 12);
  });

  test('armadura leve soma mod Destreza inteiro', () => {
    const character = makeCharacter({
      state: {
        abilities: { destreza: 16 },
        inventory: [inventoryEntry({ nome: 'Couro', tipo: 'armadura', dados: { ca: '11', categoria: 'Leve' } })],
      },
    });
    const result = getArmorClass(character);
    assert.equal(result.ok, true);
    assert.equal(result.value, 14); // 11 + 3
  });

  test('armadura média limita o bônus de Destreza a +2', () => {
    const character = makeCharacter({
      state: {
        abilities: { destreza: 18 },
        inventory: [inventoryEntry({ nome: 'Meia Armadura', tipo: 'armadura', dados: { ca: '13', categoria: 'Média' } })],
      },
    });
    const result = getArmorClass(character);
    assert.equal(result.ok, true);
    assert.equal(result.value, 15); // 13 + min(4,2)
  });

  test('armadura pesada ignora Destreza', () => {
    const character = makeCharacter({
      state: {
        abilities: { destreza: 18 },
        inventory: [inventoryEntry({ nome: 'Cota de Malha', tipo: 'armadura', dados: { ca: '16', categoria: 'Pesada' } })],
      },
    });
    const result = getArmorClass(character);
    assert.equal(result.ok, true);
    assert.equal(result.value, 16);
  });

  test('escudo soma +2 por cima da armadura', () => {
    const character = makeCharacter({
      state: {
        abilities: { destreza: 14 },
        inventory: [
          inventoryEntry({ nome: 'Cota de Malha', tipo: 'armadura', dados: { ca: '16', categoria: 'Pesada' } }),
          inventoryEntry({ nome: 'Escudo', tipo: 'escudo', dados: {} }),
        ],
      },
    });
    const result = getArmorClass(character);
    assert.equal(result.ok, true);
    assert.equal(result.value, 18);
  });

  test('escudo não equipado não conta', () => {
    const character = makeCharacter({
      state: {
        abilities: { destreza: 14 },
        inventory: [inventoryEntry({ nome: 'Escudo', tipo: 'escudo', dados: {}, equipped: false })],
      },
    });
    const result = getArmorClass(character);
    assert.equal(result.ok, true);
    assert.equal(result.value, 12); // 10 + mod Des, escudo ignorado
  });

  test('Defesa sem Armadura do Bárbaro (10 + Des + Con), por ID de classe estável', () => {
    const character = makeCharacter({
      build: { classRef: Object.freeze({ id: 'dnd2024:class:barbaro', packageVersion: '1.0.0' }) },
      state: { abilities: { destreza: 14, constituicao: 16 } },
    });
    const result = getArmorClass(character);
    assert.equal(result.ok, true);
    assert.equal(result.value, 15); // 10 + 2 + 3
  });

  test('Defesa sem Armadura do Bárbaro não se aplica com armadura equipada', () => {
    const character = makeCharacter({
      build: { classRef: Object.freeze({ id: 'dnd2024:class:barbaro', packageVersion: '1.0.0' }) },
      state: {
        abilities: { destreza: 14, constituicao: 16 },
        inventory: [inventoryEntry({ nome: 'Couro', tipo: 'armadura', dados: { ca: '11', categoria: 'Leve' } })],
      },
    });
    const result = getArmorClass(character);
    assert.equal(result.ok, true);
    assert.equal(result.value, 13); // 11 + mod Des (2), regra de Bárbaro ignorada
  });

  test('Defesa sem Armadura do Monge (10 + Des + Sab)', () => {
    const character = makeCharacter({
      build: { classRef: Object.freeze({ id: 'dnd2024:class:monge', packageVersion: '1.0.0' }) },
      state: { abilities: { destreza: 16, sabedoria: 14 } },
    });
    const result = getArmorClass(character);
    assert.equal(result.ok, true);
    assert.equal(result.value, 15); // 10 + 3 + 2
  });

  test('Estilo de Luta Defensivo soma +1 com armadura equipada', () => {
    const character = makeCharacter({
      build: { choices: Object.freeze({ 'classe:estilo_luta': Object.freeze(['Defensivo']) }) },
      state: {
        abilities: { destreza: 12 },
        inventory: [inventoryEntry({ nome: 'Couro', tipo: 'armadura', dados: { ca: '11', categoria: 'Leve' } })],
      },
    });
    const result = getArmorClass(character);
    assert.equal(result.ok, true);
    assert.equal(result.value, 13); // 11 + 1 (Des) + 1 (Defensivo)
  });

  // --- fix round 1, achado C3: dados.ca numérico não pode virar 0 em silêncio ---
  test('dados.ca NUMÉRICO (item vindo de JSON estruturado) é aceito, não tratado como ausente', () => {
    const character = makeCharacter({
      state: {
        abilities: { destreza: 14 },
        inventory: [inventoryEntry({ nome: 'Armadura JSON', tipo: 'armadura', dados: { ca: 16, categoria: 'Pesada' } })],
      },
    });
    const result = getArmorClass(character);
    assert.equal(result.ok, true);
    assert.equal(result.value, 16); // NÃO 2 (10 + mod Des com CA base zerada por engano)
  });

  test('dados.ca não coercível para número (ex.: objeto) é ERRO explícito, nunca 0 silencioso', () => {
    const character = makeCharacter({
      state: {
        abilities: { destreza: 14 },
        inventory: [inventoryEntry({ nome: 'Armadura Corrompida', tipo: 'armadura', dados: { ca: { nested: true }, categoria: 'Pesada' } })],
      },
    });
    const result = getArmorClass(character);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_QUERY_ARMOR_CA_INVALID');
  });

  test('dados.ca ausente (undefined) com categoria "Pesada" reconhecida continua tratado como 0, igual ao legado (bug-for-bug preservado)', () => {
    const character = makeCharacter({
      state: {
        abilities: { destreza: 14 },
        inventory: [inventoryEntry({ nome: 'Armadura Sem CA', tipo: 'armadura', dados: { categoria: 'Pesada' } })],
      },
    });
    const result = getArmorClass(character);
    assert.equal(result.ok, true);
    assert.equal(result.value, 0);
  });

  // --- fix round 2, achado NEW-2: armadura equipada sem dados.ca preenchido
  // E sem categoria reconhecida não pode zerar a CA — deve cair para a CA
  // desarmada (10 + mod Des), igual ao legado. ---
  test('dados.ca ausente E categoria NÃO reconhecida (item customizado incompleto): CA cai para 10 + mod Des, nunca 0', () => {
    const character = makeCharacter({
      state: {
        abilities: { destreza: 14 },
        inventory: [inventoryEntry({ nome: 'Armadura Incompleta', tipo: 'armadura', dados: {} })],
      },
    });
    const result = getArmorClass(character);
    assert.equal(result.ok, true);
    assert.equal(result.value, 12); // 10 + mod Des (+2), NÃO 0
  });

  test('dados.ca = "" (string vazia) com categoria não reconhecida: mesmo fallback de 10 + mod Des, sem erro', () => {
    const character = makeCharacter({
      state: {
        abilities: { destreza: 12 },
        inventory: [inventoryEntry({ nome: 'Armadura Vazia', tipo: 'armadura', dados: { ca: '' } })],
      },
    });
    const result = getArmorClass(character);
    assert.equal(result.ok, true);
    assert.equal(result.value, 11); // 10 + mod Des (+1)
  });

  test('armadura sem CA conhecida ainda soma escudo/talento por cima do fallback de 10 + mod Des', () => {
    const character = makeCharacter({
      state: {
        abilities: { destreza: 14 },
        inventory: [
          inventoryEntry({ nome: 'Armadura Incompleta', tipo: 'armadura', dados: {} }),
          inventoryEntry({ nome: 'Escudo', tipo: 'escudo', dados: {} }),
        ],
      },
    });
    const result = getArmorClass(character, { talentPassives: { armorClassBonus: 1 } });
    assert.equal(result.ok, true);
    assert.equal(result.value, 15); // (10 + 2) + 2 (escudo) + 1 (talento)
  });

  // --- fix round 1, achado C2: canal context.talentPassives ---
  test('talentPassives.mediumArmorMaxDexBonus (Mestre em Armaduras Médias) substitui o padrão +2', () => {
    const character = makeCharacter({
      state: {
        abilities: { destreza: 18 },
        inventory: [inventoryEntry({ nome: 'Meia Armadura', tipo: 'armadura', dados: { ca: '13', categoria: 'Média' } })],
      },
    });
    const result = getArmorClass(character, { talentPassives: { mediumArmorMaxDexBonus: 3 } });
    assert.equal(result.ok, true);
    assert.equal(result.value, 16); // 13 + min(4,3)
  });

  test('talentPassives.armorClassBonus soma um bônus genérico de talento', () => {
    const character = makeCharacter({ state: { abilities: { destreza: 12 } } });
    const result = getArmorClass(character, { talentPassives: { armorClassBonus: 2 } });
    assert.equal(result.ok, true);
    assert.equal(result.value, 13); // 10 + 1 (Des) + 2 (talento)
  });
});

describe('domain/character/queries/combat — Iniciativa', () => {
  test('igual ao modificador de Destreza', () => {
    const character = makeCharacter({ state: { abilities: { destreza: 14 } } });
    const result = getInitiative(character);
    assert.equal(result.ok, true);
    assert.equal(result.value, 2);
  });

  // fix round 1, achado C2: talentPassives.initiativeBonus (Alerta).
  test('talentPassives.initiativeBonus (Alerta) soma ao modificador de Destreza', () => {
    const character = makeCharacter({ state: { abilities: { destreza: 14 }, level: 5 } });
    const result = getInitiative(character, { talentPassives: { initiativeBonus: 3 } });
    assert.equal(result.ok, true);
    assert.equal(result.value, 5); // 2 (Des) + 3 (Alerta)
  });

  // fix round 1, achado I1: override aplicado mesmo sem context.registry.
  test('override manual de iniciativa é aplicado mesmo SEM context.registry', () => {
    const character = makeCharacter({
      state: { abilities: { destreza: 14 } },
      overrides: { initiative: { value: 20, source: 'manual' } },
    });
    const result = getInitiative(character);
    assert.equal(result.ok, true);
    assert.equal(result.value, 20);
  });
});

describe('domain/character/queries/movement — deslocamento, tamanho, carga, exaustão, sobrecarga', () => {
  test('sem registry, usa o padrão de 9 metros e tamanho Médio', () => {
    const character = makeCharacter({ state: { abilities: { forca: 12 } } });
    const result = getMovement(character);
    assert.equal(result.ok, true);
    assert.equal(result.value.base, 9);
    assert.equal(result.value.effective, 9);
    assert.equal(result.value.sizeSlug, 'medium');
    assert.equal(result.value.carryingCapacity, 84); // 12 * 7
  });

  // fix round 1, achado I3: Anão (7,5m) prova que o lookup REALMENTE roda —
  // Humano (9m) coincidiria com o fallback padrão mesmo se o lookup fosse
  // deletado por engano.
  test('deslocamento vem da espécie no catálogo (Anão, 7,5m != o padrão de 9m)', () => {
    const character = makeCharacter({ build: { speciesRef: Object.freeze({ id: 'dnd2024:species:anao', packageVersion: '1.0.0' }) } });
    const registry = makeFakeRegistry({ 'dnd2024:species:anao': ANAO_ENTITY, 'dnd2024:ruleset:core': RULESET_ENTITY });
    const result = getMovement(character, { registry });
    assert.equal(result.ok, true);
    assert.equal(result.value.base, 7.5);
  });

  test('capacidade de carga com registry real (Humano, medium) — I3/I1', () => {
    const character = makeCharacter({
      build: { speciesRef: Object.freeze({ id: 'dnd2024:species:humano', packageVersion: '1.0.0' }) },
      state: { abilities: { forca: 12 } },
    });
    const registry = makeFakeRegistry({ 'dnd2024:species:humano': HUMANO_ENTITY, 'dnd2024:ruleset:core': RULESET_ENTITY });
    const result = getMovement(character, { registry });
    assert.equal(result.ok, true);
    assert.equal(result.value.carryingCapacity, 84);
    assert.equal(result.value.sizeSlug, 'medium');
  });

  test('identity.size (edição manual, português) tem precedência sobre a espécie', () => {
    const character = makeCharacter({ identity: { size: 'Pequeno' }, state: { abilities: { forca: 12 } } });
    const result = getMovement(character);
    assert.equal(result.ok, true);
    assert.equal(result.value.sizeSlug, 'small');
    assert.equal(result.value.carryingCapacity, 84); // 12 * 7 (Pequeno também é 7)
  });

  test('tamanho Grande usa multiplicador 13.5', () => {
    const character = makeCharacter({ identity: { size: 'Grande' }, state: { abilities: { forca: 10 } } });
    const result = getMovement(character);
    assert.equal(result.ok, true);
    assert.equal(result.value.sizeSlug, 'large');
    assert.equal(result.value.carryingCapacity, 135);
  });

  test('exaustão reduz o deslocamento em 1,5m por nível, sem ficar negativo', () => {
    const character = makeCharacter({ state: { exhaustion: 6 } });
    const result = getMovement(character);
    assert.equal(result.ok, true);
    assert.equal(result.value.exhaustionLevel, 6);
    assert.equal(result.value.effective, 0); // 9 - 6*1.5 = 0
  });

  test('sobrecarga só reduz deslocamento quando build.options.encumbranceAffectsMovement é true', () => {
    const character = makeCharacter({ build: { options: Object.freeze({ encumbranceAffectsMovement: false }) } });
    const result = getMovement(character, { encumbranceLevel: 'overloaded' });
    assert.equal(result.ok, true);
    assert.equal(result.value.effective, 9); // flag desligada: sobrecarga não afeta
  });

  test('sobrecarga com a flag ligada reduz o deslocamento a 1,5m', () => {
    const character = makeCharacter({ build: { options: Object.freeze({ encumbranceAffectsMovement: true }) } });
    const result = getMovement(character, { encumbranceLevel: 'overloaded' });
    assert.equal(result.ok, true);
    assert.equal(result.value.effective, 1.5);
    assert.equal(result.value.encumbranceLevel, 'overloaded');
  });

  // fix round 1, achado C2: talentPassives.speedBonus (Velocista).
  test('talentPassives.speedBonus (Velocista) soma ao deslocamento base', () => {
    const character = makeCharacter();
    const result = getMovement(character, { talentPassives: { speedBonus: 3 } });
    assert.equal(result.ok, true);
    assert.equal(result.value.base, 12); // 9 + 3
  });

  // fix round 1, achado I1: override de deslocamento aplicado sem registry.
  test('override manual de deslocamento (speed) é aplicado mesmo SEM context.registry', () => {
    const character = makeCharacter({ overrides: { speed: { value: 30, source: 'manual' } } });
    const result = getMovement(character);
    assert.equal(result.ok, true);
    assert.equal(result.value.base, 30);
  });

  // --- fix round 1, achado I6: alvos `size`/`carrying-capacity` do motor de efeitos ---
  test('efeito de conteúdo no alvo "size" desloca a escala ordinal e recalcula capacidade de carga', () => {
    // `size`: 'set' com valor 3 (índice ordinal de "large") via override —
    // prova que o alvo realmente é consumido, não só aceito e descartado.
    const character = makeCharacter({
      state: { abilities: { forca: 10 } },
      overrides: { size: { value: 3, source: 'manual' } },
    });
    const result = getMovement(character);
    assert.equal(result.ok, true);
    assert.equal(result.value.sizeSlug, 'large');
    assert.equal(result.value.carryingCapacity, 135); // 10 * 13.5 (large)
  });

  test('efeito de conteúdo no alvo "carrying-capacity" soma por cima do cálculo de Força × tamanho', () => {
    const character = makeCharacter({
      state: { abilities: { forca: 10 } },
      overrides: { 'carrying-capacity': { value: 1000, source: 'manual' } },
    });
    const result = getMovement(character);
    assert.equal(result.ok, true);
    assert.equal(result.value.carryingCapacity, 1000); // 'set' vence a base de 70kg
  });

  test('conformidade com sheet-view-model-keys.json (I4)', () => {
    const character = makeCharacter();
    const result = getMovement(character);
    assert.equal(result.ok, true);
    assert.deepStrictEqual(
      Object.keys(result.value).sort(),
      [...sheetViewModelKeys.projections.MovementProjection.keys].sort(),
    );
  });
});

describe('domain/character/queries/defenses — resistências/imunidades e CD de magia', () => {
  test('resistências/vulnerabilidades/imunidades vêm de build.legacyGrants, ordenadas', () => {
    const character = makeCharacter({
      build: {
        legacyGrants: {
          resistanceIds: Object.freeze(['dnd2024:damage-type:fogo', 'dnd2024:damage-type:frio']),
          vulnerabilityIds: Object.freeze(['dnd2024:damage-type:radiante']),
          immunityIds: Object.freeze([]),
        },
      },
    });
    const result = getDefenses(character);
    assert.equal(result.ok, true);
    assert.deepStrictEqual([...result.value.resistances], ['dnd2024:damage-type:fogo', 'dnd2024:damage-type:frio'].sort());
    assert.deepStrictEqual([...result.value.vulnerabilities], ['dnd2024:damage-type:radiante']);
    assert.deepStrictEqual([...result.value.immunities], []);
  });

  test('sem registry, CD de Magia e Bônus de Ataque de Magia são null (nunca 0 mascarado)', () => {
    const character = makeCharacter({ build: { classRef: Object.freeze({ id: 'dnd2024:class:clerigo', packageVersion: '1.0.0' }) } });
    const result = getDefenses(character);
    assert.equal(result.ok, true);
    assert.equal(result.value.spellSaveDC, null);
    assert.equal(result.value.spellAttackBonus, null);
  });

  test('com registry, CD de Magia = 8 + prof + mod da habilidade de conjuração da classe', () => {
    const character = makeCharacter({
      build: { classRef: Object.freeze({ id: 'dnd2024:class:clerigo', packageVersion: '1.0.0' }) },
      state: { level: 5, abilities: { sabedoria: 16 } },
    });
    const registry = makeFakeRegistry({ 'dnd2024:class:clerigo': CLERIGO_ENTITY, 'dnd2024:ruleset:core': RULESET_ENTITY });
    const result = getDefenses(character, { registry });
    assert.equal(result.ok, true);
    assert.equal(result.value.spellSaveDC, 14); // 8 + 3 + 3
    assert.equal(result.value.spellAttackBonus, 6); // 3 + 3
  });

  test('personagem não conjurador (sem classRef): CD/ataque de magia null', () => {
    const character = makeCharacter();
    const result = getDefenses(character);
    assert.equal(result.ok, true);
    assert.equal(result.value.spellSaveDC, null);
  });

  test('conformidade com sheet-view-model-keys.json (I4)', () => {
    const character = makeCharacter();
    const result = getDefenses(character);
    assert.equal(result.ok, true);
    assert.deepStrictEqual(
      Object.keys(result.value).sort(),
      [...sheetViewModelKeys.projections.DefenseProjection.keys].sort(),
    );
  });
});

describe('domain/character/queries/senses', () => {
  test('percepção/intuição/investigação passivas somam 10 + bônus, com proficiência aplicada', () => {
    const character = makeCharacter({
      state: { level: 5, abilities: { sabedoria: 16 } },
      build: { legacyGrants: { skillProficiencyIds: Object.freeze(['dnd2024:skill:percepcao', 'dnd2024:skill:intuicao']) } },
    });
    const result = getSenses(character);
    assert.equal(result.ok, true);
    assert.equal(result.value.passivePerception, 16); // 10 + 3 (Sab) + 3 (prof nível 5)
    assert.equal(result.value.passiveInsight, 16);
    assert.equal(result.value.passiveInvestigation, 10); // sem proficiência, mod Int = 0
    assert.equal(result.value.darkvision, null);
  });

  test('visão no escuro concedida por efeito de conteúdo (Aasimar-like) é exposta em metros', () => {
    const registry = makeFakeRegistry({
      'dnd2024:ruleset:core': RULESET_ENTITY,
      'dnd2024:species:teste-visao': Object.freeze({
        id: 'dnd2024:species:teste-visao',
        type: 'species',
        effects: Object.freeze([
          Object.freeze({ id: 'visao-no-escuro', type: 'modifier', target: 'senses.darkvision', operation: 'set', value: 18 }),
        ]),
      }),
    });
    const character = makeCharacter({ build: { speciesRef: Object.freeze({ id: 'dnd2024:species:teste-visao', packageVersion: '1.0.0' }) } });
    const result = getSenses(character, { registry });
    assert.equal(result.ok, true);
    assert.equal(result.value.darkvision, 18);
  });

  // fix round 1, achado I6: alvo `passive-perception`.
  test('efeito de conteúdo no alvo "passive-perception" ajusta o valor passivo final', () => {
    const character = makeCharacter({
      state: { abilities: { sabedoria: 14 } },
      overrides: { 'passive-perception': { value: 25, source: 'manual' } },
    });
    const result = getSenses(character);
    assert.equal(result.ok, true);
    assert.equal(result.value.passivePerception, 25);
  });

  test('conformidade com sheet-view-model-keys.json (I4)', () => {
    const character = makeCharacter();
    const result = getSenses(character);
    assert.equal(result.ok, true);
    assert.deepStrictEqual(
      Object.keys(result.value).sort(),
      [...sheetViewModelKeys.projections.SensesProjection.keys].sort(),
    );
  });
});

describe('domain/character/queries/skills e proficiencies — proficiência/expertise/overrides', () => {
  test('perícia sem proficiência: bônus = só o modificador de habilidade', () => {
    const character = makeCharacter({ state: { abilities: { sabedoria: 14 } } });
    const result = getSkillProjection(character, 'dnd2024:skill:percepcao');
    assert.equal(result.ok, true);
    assert.equal(result.value.bonus, 2);
    assert.equal(result.value.proficient, false);
  });

  test('perícia com proficiência soma o bônus de proficiência', () => {
    const character = makeCharacter({
      state: { level: 5, abilities: { sabedoria: 14 } },
      build: { legacyGrants: { skillProficiencyIds: Object.freeze(['dnd2024:skill:percepcao']) } },
    });
    const result = getSkillProjection(character, 'dnd2024:skill:percepcao');
    assert.equal(result.ok, true);
    assert.equal(result.value.bonus, 5); // 2 + 3
  });

  test('expertise soma o bônus de proficiência em dobro', () => {
    const character = makeCharacter({
      state: { level: 5, abilities: { sabedoria: 14 } },
      build: {
        legacyGrants: {
          skillProficiencyIds: Object.freeze(['dnd2024:skill:percepcao']),
          skillExpertiseIds: Object.freeze(['dnd2024:skill:percepcao']),
        },
      },
    });
    const result = getSkillProjection(character, 'dnd2024:skill:percepcao');
    assert.equal(result.ok, true);
    assert.equal(result.value.bonus, 8); // 2 + 3 + 3
    assert.equal(result.value.expert, true);
  });

  test('habilidade da perícia resolvida via registry real (não só tabela de fallback)', () => {
    const registry = makeFakeRegistry({
      'dnd2024:ruleset:core': RULESET_ENTITY,
      'dnd2024:skill:percepcao': Object.freeze({ id: 'dnd2024:skill:percepcao', type: 'skill', ability: 'dnd2024:ability:sabedoria' }),
    });
    const character = makeCharacter({ state: { abilities: { sabedoria: 18 } } });
    const result = getSkillProjection(character, 'dnd2024:skill:percepcao', { registry });
    assert.equal(result.ok, true);
    assert.equal(result.value.abilityKey, 'sabedoria');
    assert.equal(result.value.bonus, 4);
  });

  test('isSkillProficient/isSkillExpert refletem build.legacyGrants', () => {
    const character = makeCharacter({
      build: {
        legacyGrants: {
          skillProficiencyIds: Object.freeze(['dnd2024:skill:atletismo']),
          skillExpertiseIds: Object.freeze([]),
        },
      },
    });
    assert.deepStrictEqual(isSkillProficient(character, 'dnd2024:skill:atletismo'), ok(true));
    assert.deepStrictEqual(isSkillProficient(character, 'dnd2024:skill:furtividade'), ok(false));
    assert.deepStrictEqual(isSkillExpert(character, 'dnd2024:skill:atletismo'), ok(false));
  });

  test('isSavingThrowProficient confere build.legacyGrants.savingThrowProficiencyIds', () => {
    const character = makeCharacter({
      build: { legacyGrants: { savingThrowProficiencyIds: Object.freeze(['dnd2024:ability:constituicao']) } },
    });
    assert.deepStrictEqual(isSavingThrowProficient(character, 'constituicao'), ok(true));
    assert.deepStrictEqual(isSavingThrowProficient(character, 'carisma'), ok(false));
  });

  test('override manual de habilidade (ex.: item que fixa Força) é aplicado quando há registry', () => {
    const character = makeCharacter({
      state: { abilities: { forca: 10 } },
      overrides: { 'ability.forca': { value: 19, source: 'manual' } },
    });
    const registry = makeFakeRegistry({ 'dnd2024:ruleset:core': RULESET_ENTITY });
    const result = getAbilityModifier(character, 'forca', { registry });
    assert.equal(result.ok, true);
    assert.equal(result.value, 4); // (19-10)/2 = 4.5 -> floor 4
  });

  // fix round 1, achado I1: o MESMO override, agora SEM context.registry.
  test('override manual de habilidade é aplicado mesmo SEM context.registry', () => {
    const character = makeCharacter({
      state: { abilities: { forca: 10 } },
      overrides: { 'ability.forca': { value: 19, source: 'manual' } },
    });
    const result = getAbilityModifier(character, 'forca');
    assert.equal(result.ok, true);
    assert.equal(result.value, 4);
  });

  test('conformidade com sheet-view-model-keys.json (I4)', () => {
    const character = makeCharacter();
    const result = getSkillProjection(character, 'dnd2024:skill:percepcao');
    assert.equal(result.ok, true);
    assert.deepStrictEqual(
      Object.keys(result.value).sort(),
      [...sheetViewModelKeys.projections.SkillProjection.keys].sort(),
    );
  });
});


// ============================================================
// Consultas extraídas na revisão da Task 29: salvaguardas (com efeitos) e a
// leitura ÚNICA do teto de recurso, compartilhada com `domain/commands/rest.js`.
// ============================================================
describe('domain/character/queries — salvaguardas e recursos (Task 29)', () => {
  /**
   * @param {ReadonlyArray<object>} effects
   * @returns {object}
   */
  function registryComEfeitos(effects) {
    const classe = Object.freeze({ id: 'dnd2024:class:barbaro', type: 'class', name: 'Bárbaro', effects: Object.freeze(effects) });
    const known = { 'dnd2024:class:barbaro': classe };
    return Object.freeze({
      get: (id) => known[id] ?? null,
      resolve: (reference) => {
        const id = typeof reference === 'string' ? reference : reference?.id;
        return { ok: true, value: known[id] ?? Object.freeze({ id, type: 'stub', effects: Object.freeze([]) }) };
      },
      list: () => Object.freeze([]),
    });
  }

  /**
   * @param {object} [patch]
   * @returns {object}
   */
  function personagem(patch = {}) {
    const base = createEmptyCharacter({
      id: 'sav-0001-0001',
      now: '2026-08-04T00:00:00.000Z',
      rulesetRef: { id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' },
    });
    return Object.freeze({
      ...base,
      build: Object.freeze({
        ...base.build,
        classRef: Object.freeze({ id: 'dnd2024:class:barbaro' }),
        legacyGrants: Object.freeze({ ...base.build.legacyGrants, savingThrowProficiencyIds: Object.freeze(['dnd2024:ability:forca']) }),
      }),
      state: Object.freeze({
        ...base.state,
        level: 5,
        abilities: Object.freeze({ forca: 16, destreza: 14, constituicao: 14, inteligencia: 10, sabedoria: 12, carisma: 8 }),
        ...(patch.state ?? {}),
      }),
    });
  }

  test('getSavingThrowProjection: modificador + proficiência + efeitos em save.<chave>', () => {
    const registry = registryComEfeitos([{ type: 'modifier', target: 'save.forca', operation: 'add', value: 2 }]);
    const comEfeito = getSavingThrowProjection(personagem(), 'forca', { registry });
    assert.equal(comEfeito.ok, true, comEfeito.ok ? '' : comEfeito.error.code);
    // Força 16 (+3) + proficiência (+3) + efeito (+2).
    assert.deepEqual(comEfeito.value, { abilityKey: 'forca', proficient: true, bonus: 8 });

    const semEfeito = getSavingThrowProjection(personagem(), 'destreza', { registry });
    assert.deepEqual(semEfeito.value, { abilityKey: 'destreza', proficient: false, bonus: 2 });
  });

  test('getSavingThrowProjection recusa habilidade fora do vocabulário', () => {
    const resultado = getSavingThrowProjection(personagem(), 'sorte', {});
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CHARACTER_QUERY_INVALID_ABILITY_ID');
  });

  test('collectDeclaredResourceMaxima separa os tetos irresolúveis em "unresolved"', () => {
    const registry = registryComEfeitos([
      { type: 'resource', resource: 'furia', max: 3, recovery: 'long-rest' },
      { type: 'resource', resource: 'sorte', max: 'muitas', recovery: 'short-rest' },
    ]);
    const lido = collectDeclaredResourceMaxima(personagem(), { registry });
    assert.equal(lido.ok, true, lido.ok ? '' : lido.error.code);
    assert.equal(lido.value.maxima.get('dnd2024:resource:furia').maximum, 3);
    assert.equal(lido.value.maxima.get('dnd2024:resource:sorte').maximum, null);
    assert.deepEqual(
      lido.value.unresolved.map((entrada) => entrada.resourceId),
      ['dnd2024:resource:sorte'],
    );
  });

  test('collectDeclaredResourceMaxima filtra por recuperação quando pedido', () => {
    const registry = registryComEfeitos([
      { type: 'resource', resource: 'furia', max: 3, recovery: 'long-rest' },
      { type: 'resource', resource: 'manobra', max: 4, recovery: 'short-rest' },
    ]);
    const curto = collectDeclaredResourceMaxima(personagem(), { registry }, { recoveries: ['short-rest'] });
    assert.deepEqual([...curto.value.maxima.keys()], ['dnd2024:resource:manobra']);
  });

  test('sem catálogo (null ou ausente) a leitura é vazia, nunca um erro de motor', () => {
    for (const contexto of [{}, { registry: null }, { registry: undefined }]) {
      const lido = collectDeclaredResourceMaxima(personagem(), contexto);
      assert.equal(lido.ok, true);
      assert.equal(lido.value.maxima.size, 0);
    }
  });

  test('getResourceProjection: "current" é uso RESTANTE (available = current, spent = maximum - current)', () => {
    const registry = registryComEfeitos([{ type: 'resource', resource: 'furia', max: 3, recovery: 'long-rest' }]);
    const gastouUm = personagem({ state: { resources: { 'dnd2024:resource:furia': { current: 2 } } } });
    const projetado = getResourceProjection(gastouUm, { registry });
    assert.equal(projetado.ok, true, projetado.ok ? '' : projetado.error.code);
    assert.deepEqual(projetado.value['dnd2024:resource:furia'], {
      current: 2,
      maximum: 3,
      available: 2,
      spent: 1,
      recovery: 'long-rest',
    });
  });
});
