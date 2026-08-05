import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import {
  validateManifest,
  validateIndex,
  validateEntity,
  validateEffect,
  validateCanonicalCharacterV2,
  validatePersistedCharacterRecordV2,
  validateReferences,
} from '../../../site/js/content/validation.js';
import { listAvailableSchemaNames, runGeneratedValidator } from '../../../site/js/content/schemas/runtime-validators.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const schemasDir = path.join(repoRoot, 'dados', 'schemas', 'v1');
const invalidFixturesPath = path.join(repoRoot, 'tests', 'fixtures', 'content', 'invalid-entities.json');
const SCHEMA_BASE_URL = 'https://schemas.fichas-de-nimb.dev/v1/';

let ajv;
let invalidFixtures;

// Constrói uma instância "viva" do Ajv (não standalone) a partir dos mesmos
// arquivos-fonte de dados/schemas/v1, para os testes de paridade: a mesma
// entrada deve ser aceita/rejeitada igualmente pelo Ajv "cru" e pelos
// validadores gerados/standalone usados em runtime pela aplicação.
before(async () => {
  ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  const fileNames = (await readdir(schemasDir)).filter((name) => name.endsWith('.schema.json'));
  for (const fileName of fileNames) {
    const schema = JSON.parse(await readFile(path.join(schemasDir, fileName), 'utf8'));
    ajv.addSchema(schema, schema.$id);
  }
  invalidFixtures = JSON.parse(await readFile(invalidFixturesPath, 'utf8'));
});

const VALID_ABILITY = {
  id: 'phb2024:ability:strength',
  type: 'ability',
  schemaVersion: '1.0.0',
  name: 'Força',
  abbreviation: 'STR',
};

const VALID_MANIFEST = {
  schemaVersion: '1.0.0',
  id: 'phb2024',
  name: 'Player’s Handbook 2024',
  version: '1.0.0',
  ruleset: 'phb2024:ruleset:phb2024',
  entities: ['ability', 'spell'],
  legacyAdapters: [{ type: 'legacy-json-bridge', path: 'legacy/spells.json' }],
};

const VALID_INDEX = {
  schemaVersion: '1.0.0',
  entries: [{ id: 'phb2024:ability:strength', type: 'ability', path: 'abilities.json', pointer: '/items/0' }],
};

const VALID_MODIFIER_EFFECT = {
  type: 'modifier',
  target: 'ability.strength.score',
  operation: 'add',
  value: 2,
};

const VALID_MANUAL_EFFECT = {
  type: 'manual',
  text: 'Consulte o mestre para efeitos manuais desta característica.',
};

const VALID_CANONICAL_CHARACTER = {
  schemaVersion: 2,
  identity: {
    id: 'char-local-1',
    name: 'Aria',
    image: '',
    alignment: '',
    size: 'medium',
    appearance: '',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
    backstory: '',
    notes: '',
  },
  build: {
    contentScopes: { phb2024: { packageVersion: '1.0.0' } },
    rulesetRef: { id: 'phb2024:ruleset:core', packageVersion: '1.0.0' },
    classRef: { id: 'phb2024:class:fighter', packageVersion: '1.0.0' },
    subclassRef: null,
    speciesRef: { id: 'phb2024:species:human', packageVersion: '1.0.0' },
    backgroundRef: { id: 'phb2024:background:soldier', packageVersion: '1.0.0' },
    choices: {},
    abilityGeneration: {
      method: 'standard',
      base: { forca: 15, destreza: 14, constituicao: 13, inteligencia: 12, sabedoria: 10, carisma: 8 },
      rolls: [],
    },
    featRefs: [],
    weaponMasteryRefs: [],
    maneuverRefs: [],
    legacyGrants: {
      skillProficiencyIds: [],
      skillExpertiseIds: [],
      savingThrowProficiencyIds: [],
      languageIds: [],
      toolProficiencyIds: [],
      instrumentProficiencyIds: [],
      otherProficiencies: [],
      resistanceIds: [],
      vulnerabilityIds: [],
      immunityIds: [],
    },
    options: { encumbranceAffectsMovement: false },
  },
  state: {
    level: 1,
    xp: 0,
    abilities: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10 },
    hitPoints: { current: 10, temporary: 0 },
    hitDice: { used: 0 },
    deathSaves: { successes: 0, failures: 0 },
    exhaustion: 0,
    heroicInspiration: false,
    resources: {},
    spells: {
      known: [],
      prepared: [],
      spellbook: [],
      slots: {},
      pactSlots: { used: 0 },
      concentration: null,
      freeKnownSlots: 0,
    },
    inventory: [],
    wallet: { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 },
    conditions: [],
    activeEffects: [],
    usageFlags: {},
  },
  overrides: {},
  extensions: { legacyPassthrough: {} },
  metadata: {
    createdAt: '2026-07-28T12:00:00.000Z',
    updatedAt: '2026-07-28T12:00:00.000Z',
    creationConfig: {},
  },
};

const VALID_RECORD_CHARACTER = {
  _schema: { version: 2 },
  id: 'char-local-1',
  nome: 'Aria',
  criado_em: '2026-07-28T12:00:00.000Z',
  atualizado_em: '2026-07-28T12:00:00.000Z',
  content_refs: {
    'build.classRef': { id: 'phb2024:class:fighter', packageVersion: '1.0.0' },
  },
  choice_refs: {},
  overrides: {},
};

describe('content/validation — forma do ValidationResult', () => {
  test('validateManifest() devolve exatamente {valid, errors, warnings}', () => {
    const result = validateManifest(VALID_MANIFEST);
    assert.deepEqual(Object.keys(result).sort(), ['errors', 'valid', 'warnings']);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
  });

  test('validateEntity() com entidade inválida devolve valid:false e erros não vazios', () => {
    const result = validateEntity({});
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.equal(result.errors[0].name, 'AppError');
  });
});

describe('content/validation — validateManifest', () => {
  test('aceita um manifesto válido, incluindo legacyAdapters tipados', () => {
    assert.equal(validateManifest(VALID_MANIFEST).valid, true);
  });

  test('rejeita manifesto sem campos obrigatórios', () => {
    const result = validateManifest({});
    assert.equal(result.valid, false);
  });

  test('rejeita legacyAdapters com campo de capacidade/confiança não declarado no schema', () => {
    const result = validateManifest({
      ...VALID_MANIFEST,
      legacyAdapters: [{ type: 'legacy-json-bridge', path: 'x.json', capability: 'read', trust: 'high' }],
    });
    assert.equal(result.valid, false);
  });

  test('rejeita manifest.ruleset que não é um ContentId qualificado', () => {
    const result = validateManifest({ ...VALID_MANIFEST, ruleset: 'phb2024' });
    assert.equal(result.valid, false);
  });
});

describe('content/validation — validateIndex', () => {
  test('aceita um índice válido', () => {
    assert.equal(validateIndex(VALID_INDEX).valid, true);
  });

  test('rejeita index.entries como objeto indexado por id em vez de array', () => {
    const result = validateIndex({
      schemaVersion: '1.0.0',
      entries: { 'phb2024:ability:strength': { type: 'ability', path: 'abilities.json' } },
    });
    assert.equal(result.valid, false);
  });

  test('rejeita uma entrada integralmente repetida via uniqueItems', () => {
    const entry = { id: 'phb2024:ability:strength', type: 'ability', path: 'abilities.json' };
    const result = validateIndex({ schemaVersion: '1.0.0', entries: [entry, { ...entry }] });
    assert.equal(result.valid, false);
  });
});

describe('content/validation — validateEntity', () => {
  test('aceita uma entidade válida', () => {
    assert.equal(validateEntity(VALID_ABILITY).valid, true);
  });

  test('rejeita entidade com type fora do enum fechado', () => {
    const result = validateEntity({ ...VALID_ABILITY, type: 'homebrew-thing' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === 'ENTITY_UNKNOWN_TYPE'));
  });

  test('rejeita valor que não é objeto', () => {
    const result = validateEntity(null);
    assert.equal(result.valid, false);
  });
});

describe('content/validation — validateEffect (vocabulário fechado)', () => {
  test('aceita um efeito modifier válido', () => {
    assert.equal(validateEffect(VALID_MODIFIER_EFFECT).valid, true);
  });

  test('aceita type:"manual" (exigência explícita do brief)', () => {
    assert.equal(validateEffect(VALID_MANUAL_EFFECT).valid, true);
  });

  test('rejeita um type de efeito desconhecido', () => {
    const result = validateEffect({ type: 'teleport' });
    assert.equal(result.valid, false);
  });

  test('modifier.target rejeita paths com formato de prototype pollution (regressão de review)', () => {
    for (const target of ['constructor.prototype.pwned', 'constructor', 'prototype', '__proto__', 'valueof']) {
      const result = validateEffect({ type: 'modifier', target, operation: 'set', value: 1 });
      assert.equal(result.valid, false, `target "${target}" deveria ser rejeitado`);
    }
  });

  test('modifier.target aceita namespaces conhecidos do vocabulário fechado', () => {
    for (const target of ['ability.strength.score', 'skill.stealth', 'ac.base', 'hp.max', 'speed.walk']) {
      assert.equal(
        validateEffect({ type: 'modifier', target, operation: 'add', value: 1 }).valid,
        true,
        `target "${target}" deveria ser aceito`,
      );
    }
  });

  test('modifier.operation aceita somente set/add/multiply/min/max', () => {
    for (const operation of ['set', 'add', 'multiply', 'min', 'max']) {
      assert.equal(
        validateEffect({ type: 'modifier', target: 'ability.strength.score', operation, value: 1 }).valid,
        true,
        `operation "${operation}" deveria ser aceita`,
      );
    }
    assert.equal(
      validateEffect({ type: 'modifier', target: 'ability.strength.score', operation: 'increment', value: 1 })
        .valid,
      false,
    );
  });

  test('when (gating) aceita somente level/choice/equipped/state-flag/all/any/not, sem path livre', () => {
    const base = { type: 'modifier', target: 'ability.strength.score', operation: 'add', value: 1 };
    assert.equal(validateEffect({ ...base, when: { kind: 'level', min: 5 } }).valid, true);
    assert.equal(validateEffect({ ...base, when: { path: 'character.level', min: 5 } }).valid, false);
  });
});

describe('content/validation — validateCanonicalCharacterV2 / validatePersistedCharacterRecordV2', () => {
  test('aceita um modelo canônico válido', () => {
    assert.equal(validateCanonicalCharacterV2(VALID_CANONICAL_CHARACTER).valid, true);
  });

  test('aceita um registro persistido válido', () => {
    assert.equal(validatePersistedCharacterRecordV2(VALID_RECORD_CHARACTER).valid, true);
  });

  test('registro persistido rejeita campos aninhados de modelo canônico (formatos são distintos)', () => {
    const result = validatePersistedCharacterRecordV2(VALID_CANONICAL_CHARACTER);
    assert.equal(result.valid, false);
  });

  test('atualizado_em (format:"date-time") rejeita timestamps calendarmente impossíveis (regressão de review)', () => {
    const impossibleTimestamps = [
      '2026-02-30T12:00:00Z', // 30 de fevereiro não existe
      '2026-13-01T12:00:00Z', // mês 13
      '2026-07-28T99:00:00Z', // hora 99
      '2026-02-28T12:00:00+25:00', // offset de fuso horário impossível
    ];
    for (const atualizado_em of impossibleTimestamps) {
      const result = validatePersistedCharacterRecordV2({ ...VALID_RECORD_CHARACTER, atualizado_em });
      assert.equal(result.valid, false, `atualizado_em "${atualizado_em}" deveria ser rejeitado`);
    }
  });

  test('atualizado_em (format:"date-time") aceita um timestamp RFC-3339 válido', () => {
    assert.equal(
      validatePersistedCharacterRecordV2({ ...VALID_RECORD_CHARACTER, atualizado_em: '2026-02-28T12:00:00+02:00' })
        .valid,
      true,
    );
  });
});

describe('content/validation — validateReferences (invariantes não expressáveis em JSON Schema puro)', () => {
  test('aceita manifest/index/entities consistentes', () => {
    const result = validateReferences({ manifest: VALID_MANIFEST, index: VALID_INDEX, entities: [VALID_ABILITY] });
    assert.equal(result.valid, true);
  });

  test('detecta o mesmo id em duas entries de index mesmo quando path/pointer diferem', () => {
    const index = {
      schemaVersion: '1.0.0',
      entries: [
        { id: 'phb2024:ability:strength', type: 'ability', path: 'a.json', pointer: '/items/0' },
        { id: 'phb2024:ability:strength', type: 'ability', path: 'b.json', pointer: '/items/9' },
      ],
    };
    // O schema puro aceita (as entries não são integralmente iguais).
    assert.equal(validateIndex(index).valid, true);
    // validateReferences detecta a duplicata semântica.
    const result = validateReferences({ manifest: VALID_MANIFEST, index, entities: [VALID_ABILITY] });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === 'REFERENCES_DUPLICATE_ENTRY_ID'));
  });

  test('detecta entrada de índice com type não declarado em manifest.entities', () => {
    const manifestWithoutSpell = { ...VALID_MANIFEST, entities: ['ability'] };
    const indexWithSpell = {
      schemaVersion: '1.0.0',
      entries: [{ id: 'phb2024:spell:fireball', type: 'spell', path: 'spells.json' }],
    };
    const result = validateReferences({ manifest: manifestWithoutSpell, index: indexWithSpell, entities: [] });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === 'REFERENCES_UNDECLARED_ENTITY_TYPE'));
  });

  test('detecta entidade carregada sem entrada correspondente no índice', () => {
    const result = validateReferences({
      manifest: VALID_MANIFEST,
      index: { schemaVersion: '1.0.0', entries: [] },
      entities: [VALID_ABILITY],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === 'REFERENCES_ENTITY_NOT_INDEXED'));
  });

  test('não lança para entrada malformada (manifest ausente)', () => {
    const result = validateReferences({ index: VALID_INDEX, entities: [] });
    assert.equal(result.valid, false);
  });
});

describe('content/validation — referências tipadas (rejeitam ContentId de tipo errado)', () => {
  test('skill.ability rejeita um id cujo segmento de tipo não é "ability"', () => {
    const result = validateEntity({
      id: 'phb2024:skill:stealth',
      type: 'skill',
      schemaVersion: '1.0.0',
      name: 'Furtividade',
      ability: 'phb2024:spell:fireball', // id de spell, não de ability
    });
    assert.equal(result.valid, false);
  });

  test('spell-list.spells rejeita um id de class no lugar de um id de spell', () => {
    const result = validateEntity({
      id: 'phb2024:spell-list:wizard',
      type: 'spell-list',
      schemaVersion: '1.0.0',
      name: 'Lista de Mago',
      spells: ['phb2024:class:fighter'], // id de class, não de spell
    });
    assert.equal(result.valid, false);
  });

  test('subclass.class rejeita um id de species no lugar de um id de class', () => {
    const result = validateEntity({
      id: 'phb2024:subclass:champion',
      type: 'subclass',
      schemaVersion: '1.0.0',
      name: 'Campeão',
      class: 'phb2024:species:human', // id de species, não de class
    });
    assert.equal(result.valid, false);
  });

  test('effect grant-spell.spell rejeita um id de equipment no lugar de um id de spell', () => {
    const result = validateEffect({ type: 'grant-spell', spell: 'phb2024:equipment:torch' });
    assert.equal(result.valid, false);
  });

  test('manifest.ruleset rejeita um id cujo segmento de tipo não é "ruleset"', () => {
    const result = validateManifest({ ...VALID_MANIFEST, ruleset: 'phb2024:class:fighter' });
    assert.equal(result.valid, false);
  });

  test('weapon.damage.type rejeita um id de weapon no lugar de um id de damage-type', () => {
    const result = validateEntity({
      id: 'phb2024:weapon:longsword',
      type: 'weapon',
      schemaVersion: '1.0.0',
      name: 'Espada Longa',
      weaponCategory: 'martial',
      damage: { dice: '1d8', type: 'phb2024:weapon:dagger' }, // id de weapon, não de damage-type
    });
    assert.equal(result.valid, false);
  });

  test('validateEntity() rejeita quando o segmento de tipo do próprio id não corresponde ao campo type', () => {
    const result = validateEntity({
      id: 'phb2024:spell:fireball', // id diz "spell"...
      type: 'ability', // ...mas type diz "ability"
      schemaVersion: '1.0.0',
      name: 'Força',
      abbreviation: 'STR',
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === 'CONTENT_ID_TYPE_SEGMENT_MISMATCH'));
  });

  test('validateIndex() rejeita quando o segmento de tipo do id de uma entry não corresponde ao campo type dela', () => {
    const result = validateIndex({
      schemaVersion: '1.0.0',
      entries: [{ id: 'phb2024:spell:fireball', type: 'ability', path: 'abilities.json' }],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === 'CONTENT_ID_TYPE_SEGMENT_MISMATCH'));
  });
});

describe('content/schemas/runtime-validators — determinismo', () => {
  test('a mesma entrada inválida produz sempre a mesma lista de erros, na mesma ordem', () => {
    const r1 = runGeneratedValidator('ability', {});
    const r2 = runGeneratedValidator('ability', {});
    assert.deepEqual(
      r1.errors.map((e) => e.code),
      r2.errors.map((e) => e.code),
    );
  });

  test('listAvailableSchemaNames() inclui todos os validadores usados pela API pública', () => {
    const names = listAvailableSchemaNames();
    for (const expected of ['manifest', 'index', 'effect', 'choice', 'ability', 'characterCanonicalV2', 'characterRecordV2']) {
      assert.ok(names.includes(expected), `esperava "${expected}" entre os schemas disponíveis`);
    }
  });
});

describe('content/validation — paridade Ajv vs validação runtime gerada', () => {
  test('cada fixture inválida é rejeitada igualmente pelo Ajv cru e pela validação runtime', () => {
    for (const fixture of invalidFixtures) {
      const schemaId =
        fixture.validator === 'effect' ? `${SCHEMA_BASE_URL}effect.schema.json` : schemaIdForEntity(fixture.value);
      const ajvValidate = ajv.getSchema(schemaId);
      const ajvValid = ajvValidate(fixture.value);

      const runtimeResult = fixture.validator === 'effect' ? validateEffect(fixture.value) : validateEntity(fixture.value);

      assert.equal(ajvValid, false, `fixture "${fixture.name}" deveria ser rejeitada pelo Ajv cru`);
      assert.equal(runtimeResult.valid, false, `fixture "${fixture.name}" deveria ser rejeitada pela validação runtime`);
    }
  });

  test('cada fixture válida é aceita igualmente pelo Ajv cru e pela validação runtime', () => {
    const validCases = [
      { schemaId: `${SCHEMA_BASE_URL}manifest.schema.json`, value: VALID_MANIFEST, runtime: validateManifest },
      { schemaId: `${SCHEMA_BASE_URL}index.schema.json`, value: VALID_INDEX, runtime: validateIndex },
      { schemaId: `${SCHEMA_BASE_URL}ability.schema.json`, value: VALID_ABILITY, runtime: validateEntity },
      { schemaId: `${SCHEMA_BASE_URL}effect.schema.json`, value: VALID_MODIFIER_EFFECT, runtime: validateEffect },
      { schemaId: `${SCHEMA_BASE_URL}effect.schema.json`, value: VALID_MANUAL_EFFECT, runtime: validateEffect },
      {
        schemaId: `${SCHEMA_BASE_URL}character-canonical-v2.schema.json`,
        value: VALID_CANONICAL_CHARACTER,
        runtime: validateCanonicalCharacterV2,
      },
      {
        schemaId: `${SCHEMA_BASE_URL}character-record-v2.schema.json`,
        value: VALID_RECORD_CHARACTER,
        runtime: validatePersistedCharacterRecordV2,
      },
    ];

    for (const { schemaId, value, runtime } of validCases) {
      const ajvValidate = ajv.getSchema(schemaId);
      assert.equal(ajvValidate(value), true, `Ajv cru deveria aceitar ${schemaId}`);
      assert.equal(runtime(value).valid, true, `validação runtime deveria aceitar ${schemaId}`);
    }
  });
});

/**
 * @param {*} value
 * @returns {string}
 */
function schemaIdForEntity(value) {
  const type = value && typeof value === 'object' ? value.type : undefined;
  const fileByType = {
    ruleset: 'ruleset.schema.json',
    ability: 'ability.schema.json',
    skill: 'skill.schema.json',
    condition: 'condition.schema.json',
    'damage-type': 'damage-type.schema.json',
    language: 'language.schema.json',
    class: 'class.schema.json',
    subclass: 'subclass.schema.json',
    feature: 'feature.schema.json',
    species: 'species.schema.json',
    background: 'background.schema.json',
    feat: 'feat.schema.json',
    spell: 'spell.schema.json',
    'spell-list': 'spell-list.schema.json',
    weapon: 'weapon.schema.json',
    armor: 'armor.schema.json',
    equipment: 'equipment.schema.json',
    creature: 'creature.schema.json',
    'glossary-entry': 'glossary-entry.schema.json',
    'migration-map': 'migration-map.schema.json',
  };
  // Quando o `type` é desconhecido/ausente, ainda assim precisamos de um
  // schema para exercitar o Ajv "cru" — usamos o próprio schema de `type`
  // mais provável pela forma do fixture, com fallback para "ability" (a
  // rejeição por type desconhecido é responsabilidade de validateEntity()
  // no lado runtime, não de um schema individual).
  return SCHEMA_BASE_URL + (fileByType[type] || 'ability.schema.json');
}
