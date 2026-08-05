// Fixtures compartilhadas dos testes de magia (Task 18): catálogo falso
// mínimo (spell/class/spell-list) e construtores de personagem canônico.
// Fica em `tests/helpers/` — e não dentro de um dos arquivos de teste — para
// que importá-las não execute a suíte do outro arquivo.

import { createEmptyCharacter } from '../../site/js/domain/character/model.js';
import { ok } from '../../site/js/core/result.js';

const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

export const SPELL_ENTITIES = Object.freeze({
  'dnd2024:spell:luz': {
    id: 'dnd2024:spell:luz',
    type: 'spell',
    name: 'Luz',
    level: 0,
    school: 'transmutation',
    castingTime: 'Ação',
    range: 'Toque',
    components: { verbal: true, somatic: false, material: true },
    duration: '1 hora',
    concentration: false,
    ritual: false,
    classes: ['dnd2024:class:mago', 'dnd2024:class:clerigo'],
    effects: [{ id: 'descricao', type: 'manual', text: 'Uma luz.' }],
  },
  'dnd2024:spell:alarme': {
    id: 'dnd2024:spell:alarme',
    type: 'spell',
    name: 'Alarme',
    level: 1,
    school: 'abjuration',
    castingTime: '1 minuto ou Ritual',
    range: '9 metros',
    components: { verbal: true, somatic: true, material: true },
    duration: '8 horas',
    concentration: false,
    ritual: true,
    classes: ['dnd2024:class:mago'],
    effects: [{ id: 'descricao', type: 'manual', text: 'Um alarme.' }],
  },
  'dnd2024:spell:enfeiticar-pessoa': {
    id: 'dnd2024:spell:enfeiticar-pessoa',
    type: 'spell',
    name: 'Enfeitiçar Pessoa',
    level: 1,
    school: 'enchantment',
    castingTime: 'Ação',
    range: '9 metros',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Concentração, até 1 hora',
    concentration: true,
    ritual: false,
    classes: ['dnd2024:class:mago', 'dnd2024:class:bruxo'],
    effects: [{ id: 'descricao', type: 'manual', text: 'Enfeitiça.' }],
  },
  'dnd2024:spell:bola-de-fogo': {
    id: 'dnd2024:spell:bola-de-fogo',
    type: 'spell',
    name: 'Bola de Fogo',
    level: 3,
    school: 'evocation',
    castingTime: 'Ação',
    range: '45 metros',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Instantânea',
    concentration: false,
    ritual: false,
    classes: ['dnd2024:class:mago', 'dnd2024:class:feiticeiro'],
    effects: [{ id: 'descricao', type: 'manual', text: 'Explode.' }],
  },
});

const CLASS_ENTITIES = Object.freeze({
  'dnd2024:class:mago': {
    id: 'dnd2024:class:mago',
    type: 'class',
    name: 'Mago',
    hitDie: 'd6',
    spellcasting: { ability: 'dnd2024:ability:inteligencia', progression: 'full' },
    effects: [],
  },
  'dnd2024:class:bruxo': {
    id: 'dnd2024:class:bruxo',
    type: 'class',
    name: 'Bruxo',
    hitDie: 'd8',
    spellcasting: { ability: 'dnd2024:ability:carisma', progression: 'pact' },
    effects: [],
  },
});

const LIST_ENTITIES = Object.freeze({
  'dnd2024:spell-list:mago': {
    id: 'dnd2024:spell-list:mago',
    type: 'spell-list',
    name: 'Lista de Magias de Mago',
    spells: ['dnd2024:spell:luz', 'dnd2024:spell:alarme', 'dnd2024:spell:enfeiticar-pessoa', 'dnd2024:spell:bola-de-fogo'],
  },
  'dnd2024:spell-list:clerigo': {
    id: 'dnd2024:spell-list:clerigo',
    type: 'spell-list',
    name: 'Lista de Magias de Clérigo',
    spells: ['dnd2024:spell:luz'],
  },
});

const ALL_ENTITIES = Object.freeze({ ...SPELL_ENTITIES, ...CLASS_ENTITIES, ...LIST_ENTITIES });

/**
 * Catálogo falso mínimo com a superfície que o domínio usa
 * (`get`/`resolve`/`list`). `resolve` devolve um stub sem efeitos para
 * referências desconhecidas, para que `collectCharacterEffects` (Task 15) rode
 * sem falhar por causa de conteúdo não modelado nestes testes.
 * @param {object} [entities]
 * @returns {object}
 */
export function makeRegistry(entities = ALL_ENTITIES) {
  return {
    get(id) {
      return Object.hasOwn(entities, id) ? entities[id] : null;
    },
    resolve(reference) {
      const id = typeof reference === 'string' ? reference : reference?.id;
      if (typeof id === 'string' && Object.hasOwn(entities, id)) {
        return ok(entities[id]);
      }
      return ok({ id: typeof id === 'string' ? id : 'stub', type: 'stub', effects: [] });
    },
    list() {
      return [];
    },
  };
}

/**
 * Cria uma entrada de `state.spells.*`.
 * @param {string} instanceId
 * @param {string} spellId
 * @param {string|null} sourceInstanceId
 * @returns {object}
 */
export function spellEntry(instanceId, spellId, sourceInstanceId = null) {
  return { instanceId, spellRef: { id: spellId, packageVersion: '1.0.0' }, customDefinition: null, sourceInstanceId };
}

/**
 * Congela `value` recursivamente, para que qualquer mutação acidental de um
 * comando (que deve ser puro) estoure em modo estrito, em vez de passar
 * despercebida.
 * @param {*} value
 * @param {WeakSet<object>} [seen]
 * @returns {*}
 */
export function deepFreeze(value, seen = new WeakSet()) {
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
 * Personagem canônico de teste, com sobreposição de `state`/`build`/
 * `extensions`. O resultado é congelado em profundidade.
 * @param {{state?: object, build?: object, extensions?: object}} [overrides]
 * @returns {object}
 */
export function makeCharacter({ state = {}, build = {}, extensions } = {}) {
  const base = createEmptyCharacter({ id: 'char-1', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
  return deepFreeze({
    ...base,
    build: { ...base.build, ...build },
    state: { ...base.state, ...state, spells: { ...base.state.spells, ...(state.spells ?? {}) } },
    ...(extensions ? { extensions } : {}),
  });
}
