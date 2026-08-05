// Teste focal da migração de VERSÃO DE PACOTE por escopo de namespace
// (site/js/infra/character/migration-runner.js#migrateContentVersions),
// separado de migration-v1-v2.test.js porque é uma dimensão de migração
// diferente (versão de conteúdo, não versão de schema de personagem).
// Achado do review independente da Task 12: esta lógica (a de maior risco
// do módulo, ~120 linhas) não tinha nenhum teste focal — corrigido aqui.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import { migrateContentVersions, migrateCharacterRecord } from '../../../site/js/infra/character/migration-runner.js';
import { createLegacyAliasResolver } from '../../../site/js/infra/character/legacy-alias-resolver.js';

const NOW = '2026-07-30T00:00:00.000Z';

/**
 * Manifesto fake com uma única migração declarada (1.0.0 -> 1.1.0) que
 * renomeia uma entidade e um slug de escolha — o suficiente para exercitar
 * findReferenceMigrationPath/migrateContentReference (Task 6) através da
 * Task 12 sem precisar de um pacote de conteúdo real.
 */
function fakeManifest(entities = {}, choices = {}) {
  return {
    version: '1.1.0',
    referenceMigrations: [{ from: '1.0.0', to: '1.1.0', entities, choices }],
  };
}

/** Personagem sentinela com pelo menos uma referência em cada campo tipado permitido pelo schema. */
function sentinelCharacter() {
  const base = createEmptyCharacter({
    id: 'char-1',
    now: NOW,
    rulesetRef: { id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' },
  });
  return {
    ...base,
    build: {
      ...base.build,
      classRef: { id: 'dnd2024:class:guerreiro', packageVersion: '1.0.0' },
      subclassRef: { id: 'dnd2024:subclass:cavaleiro-mistico', packageVersion: '1.0.0' },
      speciesRef: { id: 'dnd2024:species:humano', packageVersion: '1.0.0' },
      backgroundRef: { id: 'dnd2024:background:soldado', packageVersion: '1.0.0' },
      choices: { 'dnd2024:choice:estilo-luta': ['dnd2024:option:defensivo'] },
      featRefs: [{ id: 'dnd2024:feat:versatil', packageVersion: '1.0.0' }],
      weaponMasteryRefs: [{ id: 'dnd2024:weapon:espada-longa', packageVersion: '1.0.0' }],
      maneuverRefs: [{ id: 'dnd2024:feature:manobra-empurrao', packageVersion: '1.0.0' }],
      legacyGrants: {
        ...base.build.legacyGrants,
        skillProficiencyIds: ['dnd2024:skill:atletismo'],
        languageIds: ['dnd2024:language:anao'],
      },
    },
    state: {
      ...base.state,
      resources: { 'dnd2024:resource:segundo-folego': { current: 1 } },
      spells: {
        ...base.state.spells,
        known: [
          {
            instanceId: 'legacy:spells:0000:x',
            spellRef: { id: 'dnd2024:spell:missil-magico', packageVersion: '1.0.0' },
            customDefinition: null,
            sourceInstanceId: null,
          },
        ],
      },
      inventory: [
        {
          instanceId: 'legacy:inventory:0000:x',
          itemRef: { id: 'dnd2024:weapon:espada-longa', packageVersion: '1.0.0' },
          customDefinition: null,
          quantity: 1,
          equipped: true,
          expended: 0,
          sourceInstanceId: null,
        },
      ],
      conditions: ['dnd2024:condition:amedrontado'],
    },
  };
}

describe('infra/character/migration-runner — migrateContentVersions (por escopo)', () => {
  test('sem contentManifests, o personagem volta inalterado (nenhum escopo é considerado desatualizado)', () => {
    const character = sentinelCharacter();
    const result = migrateContentVersions(character, undefined);
    assert.equal(result.ok, true);
    assert.equal(result.value, character);
  });

  test('migra toda ocorrência do namespace (fixture sentinela) e atualiza contentScopes/packageVersion de cada ContentRef', () => {
    const character = sentinelCharacter();
    const manifest = fakeManifest({
      'dnd2024:class:guerreiro': 'dnd2024:class:guerreiro-2',
      'dnd2024:subclass:cavaleiro-mistico': 'dnd2024:subclass:cavaleiro-mistico-2',
      'dnd2024:species:humano': 'dnd2024:species:humano-2',
      'dnd2024:background:soldado': 'dnd2024:background:soldado-2',
      'dnd2024:feat:versatil': 'dnd2024:feat:versatil-2',
      'dnd2024:weapon:espada-longa': 'dnd2024:weapon:espada-longa-2',
      'dnd2024:feature:manobra-empurrao': 'dnd2024:feature:manobra-empurrao-2',
      'dnd2024:skill:atletismo': 'dnd2024:skill:atletismo-2',
      'dnd2024:language:anao': 'dnd2024:language:anao-2',
      'dnd2024:resource:segundo-folego': 'dnd2024:resource:segundo-folego-2',
      'dnd2024:spell:missil-magico': 'dnd2024:spell:missil-magico-2',
      'dnd2024:condition:amedrontado': 'dnd2024:condition:amedrontado-2',
      'dnd2024:ruleset:core': 'dnd2024:ruleset:core',
    });
    const result = migrateContentVersions(character, { dnd2024: { manifest } });
    assert.equal(result.ok, true);
    const migrated = result.value;

    assert.equal(migrated.build.contentScopes.dnd2024.packageVersion, '1.1.0');
    assert.equal(migrated.build.classRef.id, 'dnd2024:class:guerreiro-2');
    assert.equal(migrated.build.classRef.packageVersion, '1.1.0');
    assert.equal(migrated.build.subclassRef.id, 'dnd2024:subclass:cavaleiro-mistico-2');
    assert.equal(migrated.build.speciesRef.id, 'dnd2024:species:humano-2');
    assert.equal(migrated.build.backgroundRef.id, 'dnd2024:background:soldado-2');
    assert.equal(migrated.build.featRefs[0].id, 'dnd2024:feat:versatil-2');
    assert.equal(migrated.build.weaponMasteryRefs[0].id, 'dnd2024:weapon:espada-longa-2');
    assert.equal(migrated.build.maneuverRefs[0].id, 'dnd2024:feature:manobra-empurrao-2');
    assert.equal(migrated.build.legacyGrants.skillProficiencyIds[0], 'dnd2024:skill:atletismo-2');
    assert.equal(migrated.build.legacyGrants.languageIds[0], 'dnd2024:language:anao-2');
    assert.deepEqual(Object.keys(migrated.state.resources), ['dnd2024:resource:segundo-folego-2']);
    assert.equal(migrated.state.spells.known[0].spellRef.id, 'dnd2024:spell:missil-magico-2');
    assert.equal(migrated.state.inventory[0].itemRef.id, 'dnd2024:weapon:espada-longa-2');
    assert.equal(migrated.state.conditions[0], 'dnd2024:condition:amedrontado-2');
  });

  test('migra IDs nus/chaves de mapa (build.choices) de forma determinística', () => {
    const character = sentinelCharacter();
    // Chaves/valores de build.choices são ContentIds qualificados neste
    // modelo (não slugs locais), então migram pelo mapa "entities" — o
    // mesmo caminho de qualquer outro ContentId nu (ver
    // content/reference-migrations.js#applyStep: usa "choices" só para
    // itens de choiceRefs que NÃO são ContentId).
    const manifest = fakeManifest({
      'dnd2024:choice:estilo-luta': 'dnd2024:choice:estilo-luta-2',
      'dnd2024:option:defensivo': 'dnd2024:option:defensivo-2',
    });
    const result = migrateContentVersions(character, { dnd2024: { manifest } });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.build.choices, { 'dnd2024:choice:estilo-luta-2': ['dnd2024:option:defensivo-2'] });

    // Determinístico: rodar de novo sobre o personagem já migrado (agora em
    // 1.1.0) com o mesmo manifesto não migra nada (from===to na identidade).
    const second = migrateContentVersions(result.value, { dnd2024: { manifest } });
    assert.equal(second.ok, true);
    assert.deepEqual(second.value.build.choices, result.value.build.choices);
  });

  test('rejeita colisão pós-migração em build.choices em vez de sobrescrever uma entrada', () => {
    const character = sentinelCharacter();
    character.build.choices = {
      'dnd2024:choice:a': ['x'],
      'dnd2024:choice:b': ['y'],
    };
    const manifest = fakeManifest(
      { 'dnd2024:choice:a': 'dnd2024:choice:c', 'dnd2024:choice:b': 'dnd2024:choice:c' },
      {},
    );
    const result = migrateContentVersions(character, { dnd2024: { manifest } });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_CONTENT_REFERENCE_MIGRATION_COLLISION');
  });

  test('rejeita colisão pós-migração em state.resources em vez de sobrescrever uma entrada', () => {
    const character = sentinelCharacter();
    character.state.resources = {
      'dnd2024:resource:a': { current: 1 },
      'dnd2024:resource:b': { current: 2 },
    };
    const manifest = fakeManifest(
      { 'dnd2024:resource:a': 'dnd2024:resource:c', 'dnd2024:resource:b': 'dnd2024:resource:c' },
      {},
    );
    const result = migrateContentVersions(character, { dnd2024: { manifest } });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_CONTENT_REFERENCE_MIGRATION_COLLISION');
  });

  test('cadeia ausente/ambígua devolve erro (CONTENT_VERSION_MIGRATION_REQUIRED) sem tocar o personagem', () => {
    const character = sentinelCharacter();
    const manifest = { version: '1.1.0', referenceMigrations: [] }; // sem caminho de 1.0.0 a 1.1.0
    const result = migrateContentVersions(character, { dnd2024: { manifest } });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_VERSION_MIGRATION_REQUIRED');
  });

  test('migrar o namespace A nunca corrompe referências de um namespace B não migrado (regressão do achado do reviewer)', () => {
    // sentinelCharacter() vem de createEmptyCharacter(), congelado
    // recursivamente — clona antes de mutar para o cenário de 2 namespaces.
    const character = JSON.parse(JSON.stringify(sentinelCharacter()));
    // Personagem com um segundo namespace ("homebrew"), intocado pela
    // migração do namespace "dnd2024" abaixo.
    character.build.contentScopes.homebrew = { packageVersion: '2.0.0' };
    character.build.speciesRef = { id: 'homebrew:species:custom', packageVersion: '2.0.0' };
    const originalSpeciesRef = { ...character.build.speciesRef };

    const manifest = fakeManifest({ 'dnd2024:class:guerreiro': 'dnd2024:class:guerreiro-2' });
    const result = migrateContentVersions(character, { dnd2024: { manifest } });

    assert.equal(result.ok, true);
    // O escopo "dnd2024" migrou...
    assert.equal(result.value.build.classRef.id, 'dnd2024:class:guerreiro-2');
    // ...mas o escopo "homebrew" (fora do manifesto informado) continua
    // exatamente como estava — nunca um {id: undefined, packageVersion: ...}.
    assert.deepEqual(result.value.build.speciesRef, originalSpeciesRef);
    assert.deepEqual(result.value.build.contentScopes.homebrew, { packageVersion: '2.0.0' });
  });
});

describe('infra/character/migration-runner — migrateCharacterRecord com contentManifests (fim a fim)', () => {
  test('um registro v1 legado migra para v2 e já sai na versão de pacote alvo quando contentManifests é informado', async () => {
    const aliases = JSON.parse(
      await import('node:fs/promises').then((fs) =>
        fs.readFile(
          new URL('../../../dados/pacotes/dnd2024/migrations/character-v1-aliases.json', import.meta.url),
          'utf8',
        ),
      ),
    );
    const resolver = createLegacyAliasResolver(aliases);
    const manifest = fakeManifest({ 'dnd2024:class:guerreiro': 'dnd2024:class:guerreiro-2' });
    const raw = { id: 'char-1', nome: 'Teste', classe: 'Guerreiro', atualizado_em: NOW };
    const result = migrateCharacterRecord(raw, {
      aliasResolver: resolver,
      now: NOW,
      contentManifests: { dnd2024: { manifest } },
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.mode, 'migrated');
    assert.equal(result.value.character.build.classRef.id, 'dnd2024:class:guerreiro-2');
    assert.equal(result.value.character.build.contentScopes.dnd2024.packageVersion, '1.1.0');
  });
});
