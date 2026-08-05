import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CHARACTER_SCHEMA_VERSION,
  COMPATIBILITY_BASELINE,
  createEmptyCharacter,
  visitCharacterContentReferences,
} from '../../../site/js/domain/character/model.js';
import { validateCanonicalCharacter } from '../../../site/js/domain/character/validation.js';

const RULESET_REF = { id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' };

describe('domain/character/model — constantes', () => {
  test('CHARACTER_SCHEMA_VERSION é 2', () => {
    assert.equal(CHARACTER_SCHEMA_VERSION, 2);
  });

  test('COMPATIBILITY_BASELINE é o commit do baseline dos fixtures', () => {
    assert.equal(COMPATIBILITY_BASELINE, 'e43c5ea');
  });
});

describe('domain/character/model — createEmptyCharacter', () => {
  test('produz um personagem canônico v2 válido contra o schema', () => {
    const character = createEmptyCharacter({ id: 'char-1', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
    const result = validateCanonicalCharacter(character);
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
  });

  test('popula build.contentScopes a partir do namespace do rulesetRef', () => {
    const character = createEmptyCharacter({ id: 'char-1', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
    assert.deepEqual(character.build.contentScopes, { dnd2024: { packageVersion: '1.0.0' } });
  });

  test('classe/subclasse/espécie/antecedente começam nulas (nenhuma escolha feita)', () => {
    const character = createEmptyCharacter({ id: 'char-1', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
    assert.equal(character.build.classRef, null);
    assert.equal(character.build.subclassRef, null);
    assert.equal(character.build.speciesRef, null);
    assert.equal(character.build.backgroundRef, null);
  });

  test('createdAt e updatedAt usam o "now" recebido', () => {
    const now = '2026-07-30T12:34:56.000Z';
    const character = createEmptyCharacter({ id: 'char-1', now, rulesetRef: RULESET_REF });
    assert.equal(character.metadata.createdAt, now);
    assert.equal(character.metadata.updatedAt, now);
  });

  test('o resultado é congelado (imutável)', () => {
    const character = createEmptyCharacter({ id: 'char-1', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
    assert.throws(() => {
      character.identity.name = 'mutado';
    }, TypeError);
  });

  test('lança TypeError para parâmetros ausentes', () => {
    assert.throws(() => createEmptyCharacter({}), TypeError);
    assert.throws(() => createEmptyCharacter({ id: 'x' }), TypeError);
    assert.throws(() => createEmptyCharacter({ id: 'x', now: '2026-01-01T00:00:00.000Z' }), TypeError);
  });
});

describe('domain/character/model — visitCharacterContentReferences', () => {
  test('não omite nenhuma referência de um fixture sentinela com todos os campos', () => {
    const character = {
      schemaVersion: 2,
      identity: { id: 'char-1', name: 'Sentinela' },
      build: {
        contentScopes: { dnd2024: { packageVersion: '1.0.0' } },
        rulesetRef: { id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' },
        classRef: { id: 'dnd2024:class:guerreiro', packageVersion: '1.0.0' },
        subclassRef: { id: 'dnd2024:subclass:cavaleiro-mistico', packageVersion: '1.0.0' },
        speciesRef: { id: 'dnd2024:species:humano', packageVersion: '1.0.0' },
        backgroundRef: { id: 'dnd2024:background:soldado', packageVersion: '1.0.0' },
        choices: {
          'dnd2024:choice:estilo-luta': ['dnd2024:option:defensivo'],
        },
        featRefs: [{ id: 'dnd2024:feat:versatil', packageVersion: '1.0.0' }],
        weaponMasteryRefs: [{ id: 'dnd2024:weapon:espada-longa', packageVersion: '1.0.0' }],
        maneuverRefs: [{ id: 'dnd2024:feature:manobra-empurrao', packageVersion: '1.0.0' }],
        legacyGrants: {
          skillProficiencyIds: ['dnd2024:skill:atletismo'],
          skillExpertiseIds: ['dnd2024:skill:intimidacao'],
          savingThrowProficiencyIds: ['dnd2024:ability:forca'],
          languageIds: ['dnd2024:language:anao'],
          toolProficiencyIds: ['dnd2024:equipment:kit-de-ferreiro'],
          instrumentProficiencyIds: [],
          otherProficiencies: ['texto legado sem correspondência'],
          resistanceIds: ['dnd2024:damage-type:fogo'],
          vulnerabilityIds: [],
          immunityIds: [],
        },
      },
      state: {
        resources: { 'dnd2024:resource:segundo-folego': { current: 1 } },
        spells: {
          known: [{ instanceId: 'legacy:spells:0000:missil-magico', spellRef: { id: 'dnd2024:spell:missil-magico', packageVersion: '1.0.0' } }],
          prepared: [{ instanceId: 'legacy:spells:0001:cura', spellRef: { id: 'dnd2024:spell:curar-ferimentos', packageVersion: '1.0.0' } }],
          spellbook: [{ instanceId: 'legacy:spells:0002:bola-de-fogo', spellRef: { id: 'dnd2024:spell:bola-de-fogo', packageVersion: '1.0.0' } }],
        },
        inventory: [{ instanceId: 'legacy:inventory:0000:espada-longa', itemRef: { id: 'dnd2024:weapon:espada-longa', packageVersion: '1.0.0' } }],
        conditions: ['dnd2024:condition:amedrontado', 'Enjoo (leve)'],
      },
    };

    const refs = visitCharacterContentReferences(character);
    const pointers = refs.map((r) => r.pointer).sort();

    assert.deepEqual(pointers, [
      'build.backgroundRef',
      'build.choices{dnd2024:choice:estilo-luta}',
      'build.choices{dnd2024:choice:estilo-luta}[0]',
      'build.classRef',
      'build.featRefs[0]',
      'build.legacyGrants.languageIds[0]',
      'build.legacyGrants.resistanceIds[0]',
      'build.legacyGrants.savingThrowProficiencyIds[0]',
      'build.legacyGrants.skillExpertiseIds[0]',
      'build.legacyGrants.skillProficiencyIds[0]',
      'build.legacyGrants.toolProficiencyIds[0]',
      'build.maneuverRefs[0]',
      'build.rulesetRef',
      'build.speciesRef',
      'build.subclassRef',
      'build.weaponMasteryRefs[0]',
      'state.conditions[0]',
      'state.inventory[0].itemRef',
      'state.resources{dnd2024:resource:segundo-folego}',
      'state.spells.known[0].spellRef',
      'state.spells.prepared[0].spellRef',
      'state.spells.spellbook[0].spellRef',
    ]);

    // otherProficiencies com texto legado sem ContentId, e "Enjoo (leve)" em
    // conditions, não viram referência (não fazem parse de ContentId) — a
    // ausência delas na lista acima já prova isso; a asserção abaixo torna
    // a checagem explícita e resistente a falso-positivo por typo.
    assert.equal(refs.some((r) => r.id === 'texto legado sem correspondência'), false);
    assert.equal(refs.some((r) => r.id === 'Enjoo (leve)'), false);
  });

  test('personagem vazio (sem escolhas) não produz nenhuma referência além do ruleset', () => {
    const character = createEmptyCharacter({ id: 'char-1', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
    const refs = visitCharacterContentReferences(character);
    assert.deepEqual(
      refs.map((r) => r.pointer),
      ['build.rulesetRef'],
    );
  });
});
