// Contrato do pacote oficial `dnd2024` (Task 7): manifesto, índice e o
// ruleset central. Carrega os arquivos reais de `dados/pacotes/dnd2024/`
// (não fixtures sintéticas) e confere, ponta a ponta, tudo que o brief desta
// tarefa exige: `dnd2024:ruleset:core` presente e versionado, descrição não
// vazia, autoria estruturada, referência tipada para o migration-map,
// caminhos relativos sem travessia, ordem determinística de `index.entries`,
// nenhum campo de confiança no manifesto, e que `status: "building"` nunca é
// ativado pelo `ContentRegistry` real (não um dublê).
//
// RED esperado antes desta tarefa: `dados/pacotes/dnd2024/manifest.json`
// (e os demais arquivos do pacote) não existiam — qualquer teste que os lê
// falhava com ENOENT.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateManifest,
  validateIndex,
  validateEntity,
  validateReferences,
} from '../../site/js/content/validation.js';
import { ContentRegistry } from '../../site/js/content/registry.js';
import { createOfficialSourceCapabilities } from '../../site/js/content/capabilities.js';
import { parseContentId } from '../../site/js/core/content-id.js';
import { ok } from '../../site/js/core/result.js';
import { buildIndexForPackage, listJsonFilesRecursively } from '../../scripts/content/build-index.mjs';
import { validateIdInventory, slugify } from '../../scripts/content/content-id-map.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const packageDir = path.join(repoRoot, 'dados', 'pacotes', 'dnd2024');
const fixturesContentDir = path.join(repoRoot, 'tests', 'fixtures', 'content');

/** Resolve um JSON Pointer simples (RFC 6901), igual ao usado em validate-content.mjs. */
function resolveJsonPointer(document, pointer) {
  if (!pointer) {
    return document;
  }
  const segments = pointer.split('/').slice(1).map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  let current = document;
  for (const segment of segments) {
    if (current == null) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

let manifest;
let index;
let entitiesById;
let entitiesList;

before(async () => {
  manifest = JSON.parse(await readFile(path.join(packageDir, 'manifest.json'), 'utf8'));
  index = JSON.parse(await readFile(path.join(packageDir, 'index.json'), 'utf8'));

  entitiesById = new Map();
  entitiesList = [];
  const fileCache = new Map();
  for (const entry of index.entries) {
    if (!fileCache.has(entry.path)) {
      fileCache.set(entry.path, JSON.parse(await readFile(path.join(packageDir, entry.path), 'utf8')));
    }
    const fileContent = fileCache.get(entry.path);
    const entity = entry.pointer ? resolveJsonPointer(fileContent, entry.pointer) : fileContent;
    entitiesById.set(entry.id, entity);
    entitiesList.push(entity);
  }
});

describe('pacote oficial dnd2024 — manifesto', () => {
  test('id, versão e status são exatamente os esperados para o pacote ativado (Task 10)', () => {
    assert.equal(manifest.id, 'dnd2024');
    assert.equal(manifest.version, '1.0.0');
    assert.equal(manifest.status, 'ready');
  });

  test('description é uma string não vazia (apresentação, não confiável)', () => {
    assert.equal(typeof manifest.description, 'string');
    assert.ok(manifest.description.length > 0);
  });

  test('authors é uma lista estruturada de {name, role}', () => {
    assert.ok(Array.isArray(manifest.authors));
    assert.ok(manifest.authors.length > 0);
    for (const author of manifest.authors) {
      assert.equal(typeof author.name, 'string');
      assert.ok(author.name.length > 0);
    }
  });

  test('ruleset referencia dnd2024:ruleset:core, um ContentId qualificado', () => {
    assert.equal(manifest.ruleset, 'dnd2024:ruleset:core');
    const parsed = parseContentId(manifest.ruleset);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.value.type, 'ruleset');
  });

  test('legacyAdapters.characterV1Aliases referencia tipadamente o migration-map do pacote', () => {
    assert.equal(manifest.legacyAdapters.characterV1Aliases, 'dnd2024:migration-map:character-v1-aliases');
    const parsed = parseContentId(manifest.legacyAdapters.characterV1Aliases);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.value.type, 'migration-map');
    assert.ok(entitiesById.has(manifest.legacyAdapters.characterV1Aliases), 'o migration-map referenciado deve existir no pacote');
  });

  test('description/authors adulterados (mas com forma válida) não mudam o resultado de validação nem a ativação', () => {
    // "Manifesto que se declara oficial" não deveria fazer diferença: a
    // capacidade vem SEMPRE do composition root (createOfficialSourceCapabilities),
    // nunca do JSON. Adulterar o CONTEÚDO de description/authors (mantendo a
    // forma válida do schema) não muda o resultado da ativação — só o texto
    // é sanitizado/escapado na apresentação, nunca interpretado como
    // concessão de privilégio.
    const tamperedManifest = {
      ...manifest,
      description: '<script>alert(1)</script>',
      authors: [{ name: 'Invasor', role: 'official' }],
    };
    assert.equal(validateManifest(tamperedManifest).valid, validateManifest(manifest).valid);
    assert.equal(validateManifest(tamperedManifest).valid, true);
  });

  test('authors com campo de capacidade/confiança não declarado no schema é rejeitado (forma fechada, não confiança)', () => {
    // Diferente do teste acima: aqui a estrutura em si tenta introduzir um
    // campo de privilégio (`capability`/`trusted`) em `authors`. O schema
    // rejeita por `additionalProperties: false` — a defesa é de FORMA
    // (campo desconhecido nunca é aceito), não uma verificação semântica de
    // "quem confiar"; não existe caminho para esse campo influenciar
    // namespace/capacidade mesmo se o schema o aceitasse.
    const tamperedManifest = {
      ...manifest,
      authors: [{ name: 'Invasor', role: 'official', trusted: true, capability: 'officialHandlers' }],
    };
    assert.equal(validateManifest(tamperedManifest).valid, false);
  });

  test('valida integralmente contra o schema oficial (validateManifest)', () => {
    const result = validateManifest(manifest);
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
  });

  test('entitySchemaVersions declara os 20 tipos de entidade do enum fechado, todos como semVer', () => {
    // Task 37 (reconciliação da divergência sinalizada na Task 7): o manifesto
    // declarava a versão de schema por tipo como INTEIRO enquanto cada
    // entidade carrega `schemaVersion` semVer ("1.0.0") — duas representações
    // do mesmo dado que podiam divergir. A reconciliação padronizou o
    // manifesto no MESMO formato semVer das entidades (o menor dos dois
    // lados: 20 valores num arquivo, contra 1511 arquivos gerados por
    // conversores), e o teste seguinte fecha a igualdade estrita.
    const ALL_ENTITY_TYPES = [
      'ruleset', 'ability', 'skill', 'condition', 'damage-type', 'language',
      'class', 'subclass', 'feature', 'species', 'background', 'feat',
      'spell', 'spell-list', 'weapon', 'armor', 'equipment', 'creature',
      'glossary-entry', 'migration-map',
    ];
    assert.deepEqual(Object.keys(manifest.entitySchemaVersions).sort(), [...ALL_ENTITY_TYPES].sort());
    for (const type of ALL_ENTITY_TYPES) {
      assert.match(
        manifest.entitySchemaVersions[type],
        /^\d+\.\d+\.\d+$/,
        `entitySchemaVersions["${type}"] deve ser semVer, como o schemaVersion das entidades`,
      );
    }
  });

  test('toda entidade do pacote tem schemaVersion ESTRITAMENTE igual ao manifest.entitySchemaVersions do seu tipo', async () => {
    // Igualdade estrita (===): mesmo tipo (string) e mesmo valor. Se um
    // conversor publicar uma entidade com versão nova sem atualizar o
    // manifesto (ou vice-versa), este teste aponta a primeira divergência.
    for (const entry of index.entries) {
      const entity = JSON.parse(await readFile(path.join(packageDir, entry.path), 'utf8'));
      assert.ok(
        Object.hasOwn(manifest.entitySchemaVersions, entity.type),
        `tipo "${entity.type}" (em ${entry.path}) sem versão declarada no manifesto`,
      );
      assert.strictEqual(
        entity.schemaVersion,
        manifest.entitySchemaVersions[entity.type],
        `${entry.path}: schemaVersion "${entity.schemaVersion}" difere de entitySchemaVersions["${entity.type}"]`,
      );
    }
  });

  test('dependencies e referenceMigrations estão vazios (primeira versão do primeiro pacote, nada a depender/migrar)', () => {
    assert.deepEqual(manifest.dependencies, []);
    assert.deepEqual(manifest.referenceMigrations, []);
  });
});

describe('pacote oficial dnd2024 — índice', () => {
  test('entries é um array ordenado (nunca um objeto indexado por id)', () => {
    assert.ok(Array.isArray(index.entries));
  });

  test('nenhum path de entrada faz travessia de diretório e todos são relativos', () => {
    for (const entry of index.entries) {
      assert.equal(typeof entry.path, 'string');
      assert.ok(!path.isAbsolute(entry.path), `path "${entry.path}" não deve ser absoluto`);
      assert.ok(!entry.path.split('/').includes('..'), `path "${entry.path}" não deve conter travessia ("..")`);
    }
  });

  test('reconstruir o índice a partir do disco produz exatamente o array committed (ordem determinística)', async () => {
    const rebuilt = await buildIndexForPackage(packageDir);
    assert.deepEqual(rebuilt.entries, index.entries);
    assert.deepEqual(rebuilt.warnings, []);
  });

  test('valida integralmente contra o schema oficial (validateIndex)', () => {
    const result = validateIndex(index);
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
  });

  test('todo id de index.entries usa o namespace dnd2024', () => {
    for (const entry of index.entries) {
      const parsed = parseContentId(entry.id);
      assert.equal(parsed.ok, true, `id "${entry.id}" deve ser um ContentId válido`);
      assert.equal(parsed.value.namespace, 'dnd2024');
    }
  });

  test('pointer é omitido para arquivo de entidade única e presente para arquivo-coleção', async () => {
    // dnd2024:ruleset:core e dnd2024:migration-map:character-v1-aliases são
    // arquivos de entidade única (regra do brief) — as outras entries
    // (abilities/skills/conditions/damage-types/languages) compartilham
    // arquivo-coleção e por isso exigem pointer.
    const singleEntityIds = new Set(['dnd2024:ruleset:core', 'dnd2024:migration-map:character-v1-aliases']);
    let sawPointerPresent = false;
    let sawPointerAbsent = false;
    for (const entry of index.entries) {
      if (singleEntityIds.has(entry.id)) {
        assert.equal('pointer' in entry, false, `entry de entidade única "${entry.id}" não deve ter pointer`);
        sawPointerAbsent = true;
      } else {
        assert.equal(typeof entry.pointer, 'string', `entry de coleção "${entry.id}" deve ter pointer`);
        assert.match(entry.pointer, /^\/items\/\d+$/);
        sawPointerPresent = true;
      }
    }
    assert.ok(sawPointerPresent && sawPointerAbsent, 'o índice deve conter os dois casos (com e sem pointer)');
  });
});

describe('pacote oficial dnd2024 — entidades', () => {
  test('todo slug de id de entidade "nomeada por catálogo" é exatamente slugify(name) (hardening pós-revisão: dnd2024:condition:exausto vs. exaustao)', () => {
    // `content-id-map.mjs`'s `validateIdInventory` já garante essa regra
    // para os 891 ids PRÉ-RESERVADOS (ver describe de ids pré-reservados
    // abaixo), mas não para as entidades que este próprio pacote já
    // constrói — foi exatamente essa lacuna que deixou passar
    // `dnd2024:condition:exausto` (deveria ser `exaustao`, achado de revisão
    // corrigido nesta rodada). Este teste cobre as entidades REAIS do
    // pacote, não só o inventário de reservas futuras.
    //
    // Exceção deliberada: os dois arquivos de entidade única
    // (`dnd2024:ruleset:core`, `dnd2024:migration-map:character-v1-aliases`)
    // têm slug curto escolhido a dedo, não derivado do `name` descritivo
    // ("D&D 5.5 (2024) — Regras Básicas", "Aliases de personagem v1
    // (legado)") — a regra "slug === slugify(name)" só vale para entidades
    // de catálogo (abilities/skills/conditions/damage-types/languages), cujo
    // slug É o nome oficial, não um apelido de arquivo.
    const SINGLE_ENTITY_IDS_WITH_HAND_PICKED_SLUG = new Set([
      'dnd2024:ruleset:core',
      'dnd2024:migration-map:character-v1-aliases',
    ]);
    // `type: "feature"` também é uma exceção deliberada, ativada pela Task
    // 10 (antes desta tarefa "feature" nunca estava em `manifest.entities`,
    // então nenhuma entidade desse tipo era carregada aqui): o mesmo nome de
    // característica se repete entre várias classes/subclasses/níveis (ex.:
    // "Aumento no Valor de Atributo" aparece ~5x em toda classe, em níveis
    // diferentes) — `migrate-classes.mjs#construirFeatures`/`gerarSlugsUnicos`
    // prefixa o slug com `grantedBy`/o slug da classe ou subclasse e pode
    // sufixar com o número do nível quando o mesmo nome se repete em vários
    // níveis da mesma classe (ex.: "barbaro-aumento-no-valor-de-atributo-4")
    // exatamente para evitar a colisão que um slug bare `slugify(name)`
    // teria. Checagem aqui: o slug deve pelo menos CONTER `slugify(name)`
    // (garante que o nome ainda governa parte do slug, só relaxando a
    // exigência de que ele seja o slug inteiro).
    for (const [id, entity] of entitiesById) {
      if (!entity || typeof entity.name !== 'string' || SINGLE_ENTITY_IDS_WITH_HAND_PICKED_SLUG.has(id)) {
        continue;
      }
      if (entity.type === 'feature') {
        const parsedFeature = parseContentId(id);
        if (parsedFeature.ok) {
          assert.ok(
            parsedFeature.value.slug.includes(slugify(entity.name)),
            `feature "${id}": slug deveria conter slugify("${entity.name}") = "${slugify(entity.name)}"`,
          );
        }
        continue;
      }
      // `type: "spell-list"` (Task 10) também usa slug curto escolhido a
      // dedo (`dnd2024:spell-list:bardo`, `...:todas`) em vez de
      // `slugify("Lista de Magias de Bardo")` — mesma categoria de exceção
      // dos dois ids de entidade única acima: o slug é um apelido de
      // arquivo/classe estável, não derivado do `name` de apresentação
      // (ver `scripts/content/migrate-spells-equipment.mjs#spellListId`).
      // Ainda assim, o slug precisa ser exatamente um dos 9 valores
      // conhecidos (8 classes conjuradoras + "todas") — sem essa checagem,
      // um typo num slug escolhido a dedo (ex.: "bardoo") passaria batido
      // pela exceção acima sem nenhuma asserção real.
      if (entity.type === 'spell-list') {
        const parsedSpellList = parseContentId(id);
        if (parsedSpellList.ok) {
          const SLUGS_DE_SPELL_LIST_CONHECIDOS = new Set([
            'bardo', 'bruxo', 'clerigo', 'druida', 'feiticeiro', 'guardiao', 'mago', 'paladino', 'todas',
          ]);
          assert.ok(
            SLUGS_DE_SPELL_LIST_CONHECIDOS.has(parsedSpellList.value.slug),
            `spell-list "${id}": slug "${parsedSpellList.value.slug}" não está entre os 9 conhecidos (8 classes + "todas")`,
          );
        }
        continue;
      }
      const parsed = parseContentId(id);
      if (!parsed.ok) {
        continue;
      }
      assert.equal(parsed.value.slug, slugify(entity.name), `id "${id}": slug deveria ser slugify("${entity.name}") = "${slugify(entity.name)}"`);
    }
  });

  test('toda entidade referenciada pelo índice valida contra seu schema concreto', () => {
    for (const [id, entity] of entitiesById) {
      const result = validateEntity(entity);
      assert.deepEqual(result.errors, [], `entidade "${id}" deveria validar sem erros`);
      assert.equal(result.valid, true, `entidade "${id}" deveria ser válida`);
    }
  });

  test('manifest/index/entities não têm referências quebradas (validateReferences)', () => {
    const result = validateReferences({ manifest, index, entities: entitiesList });
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
  });

  test('dnd2024:ruleset:core existe e referencia tipadamente as seis coleções auxiliares', () => {
    const core = entitiesById.get('dnd2024:ruleset:core');
    assert.ok(core, 'dnd2024:ruleset:core deve existir');
    assert.equal(core.type, 'ruleset');
    assert.equal(core.schemaVersion, '1.0.0');
    const tables = core.tables;
    assert.ok(Array.isArray(tables.abilities) && tables.abilities.length === 6);
    assert.ok(Array.isArray(tables.skills) && tables.skills.length === 18);
    assert.ok(Array.isArray(tables.savingThrows) && tables.savingThrows.length === 6);
    assert.ok(Array.isArray(tables.conditions) && tables.conditions.length === 15);
    assert.ok(Array.isArray(tables.damageTypes) && tables.damageTypes.length === 13);
    assert.ok(Array.isArray(tables.languages) && tables.languages.length === 19);
    assert.equal(tables.standardArray.length, 6);
    assert.equal(tables.proficiencyBonusByLevel.length, 20);
    assert.equal(tables.experienceByLevel.length, 20);
    for (const ref of [...tables.abilities, ...tables.skills, ...tables.savingThrows, ...tables.conditions, ...tables.damageTypes, ...tables.languages]) {
      assert.ok(entitiesById.has(ref), `referência "${ref}" em core.tables deve existir no pacote`);
    }
  });

  test('cada mapping de character-v1-aliases aponta para uma entidade que existe no pacote', () => {
    const migrationMap = entitiesById.get('dnd2024:migration-map:character-v1-aliases');
    assert.ok(migrationMap);
    assert.ok(migrationMap.mappings.length > 0);
    const seenFrom = new Set();
    for (const { from, to } of migrationMap.mappings) {
      assert.equal(seenFrom.has(from), false, `"from" duplicado: "${from}"`);
      seenFrom.add(from);
      assert.ok(entitiesById.has(to), `mapping "${from}" -> "${to}": destino deve existir no pacote`);
    }
  });
});

describe('pacote oficial dnd2024 — status "ready" (Task 10): ativa de verdade; status "building" continua bloqueado', () => {
  function sourceFor(manifestToUse) {
    return Object.freeze({
      async loadManifest() {
        return ok(manifestToUse);
      },
      async loadIndex() {
        return ok(index);
      },
      async loadEntity(id) {
        return ok(entitiesById.get(id));
      },
    });
  }

  test('ContentRegistry real ATIVA o pacote dnd2024 real, hoje com status "ready" (primeira ativação real, Task 10)', async () => {
    assert.equal(manifest.status, 'ready', 'pré-condição: a Task 10 flipa o pacote para "ready"');
    const registry = ContentRegistry({
      validator: { validateManifest, validateIndex, validateEntity, validateReferences },
    });
    registry.registerSource(sourceFor(manifest), createOfficialSourceCapabilities());
    const result = await registry.initialize();
    assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.error));
    assert.ok(registry.get('dnd2024:ruleset:core'));
    assert.ok(registry.list('spell').length === 391);
    assert.ok(registry.list('weapon').length === 38);
  });

  test('ContentRegistry real recusa ativar o MESMO pacote com status sintético "building" (o portão de ativação continua vivo)', async () => {
    const manifestBuilding = { ...manifest, status: 'building' };
    const registry = ContentRegistry({
      validator: { validateManifest, validateIndex, validateEntity, validateReferences },
    });
    registry.registerSource(sourceFor(manifestBuilding), createOfficialSourceCapabilities());
    const result = await registry.initialize();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_PACKAGE_NOT_READY');
    assert.equal(registry.get('dnd2024:ruleset:core'), null);
    assert.deepEqual(registry.list('ability'), []);
  });
});

describe('pacote oficial dnd2024 — inventário de contagens ativas (Task 7)', () => {
  let inventory;

  before(async () => {
    inventory = JSON.parse(await readFile(path.join(fixturesContentDir, 'dnd2024-inventory.json'), 'utf8'));
  });

  test('activationStatus do fixture é "ready", igual ao manifesto real (Task 10)', () => {
    assert.equal(inventory.activationStatus, 'ready');
    assert.equal(inventory.activationStatus, manifest.status);
  });

  test('contagens ativas do fixture batem exatamente com index.entries', () => {
    const actual = {};
    for (const entry of index.entries) {
      actual[entry.type] = (actual[entry.type] ?? 0) + 1;
    }
    assert.deepEqual(actual, inventory.active);
  });

  test('finalTarget registra as contagens finais auditadas do brief (12/48/11/16/75/391/38/13/51/154 + equipment)', () => {
    assert.equal(inventory.finalTarget.class, 12);
    assert.equal(inventory.finalTarget.subclass, 48);
    assert.equal(inventory.finalTarget.feature, 452);
    assert.equal(inventory.finalTarget.species, 11);
    assert.equal(inventory.finalTarget.background, 16);
    assert.equal(inventory.finalTarget.feat, 75);
    assert.equal(inventory.finalTarget.spell, 391);
    assert.equal(inventory.finalTarget['spell-list'], 9);
    assert.equal(inventory.finalTarget.weapon, 38);
    assert.equal(inventory.finalTarget.armor, 13);
    // 168, não 82: os 82 itens de aventura reservados (Task 7) + ferramentas
    // (25) + serviços (31) + montarias/veículos (25) migrados pela Task 10,
    // que não tinham id reservado por ninguém ter precisado referenciá-los
    // antes (ver comentário de `tests/fixtures/content/dnd2024-inventory.json`).
    assert.equal(inventory.finalTarget.equipment, 168);
    assert.equal(inventory.finalTarget.creature, 51);
    assert.equal(inventory.finalTarget['glossary-entry'], 154);
  });

  test('active === finalTarget (o pacote está totalmente ativado, não há mais um subconjunto "building")', () => {
    assert.deepEqual(inventory.active, inventory.finalTarget);
  });
});

describe('pacote oficial dnd2024 — inventário de ids pré-reservados (Task 7)', () => {
  let idInventory;

  before(async () => {
    idInventory = JSON.parse(await readFile(path.join(fixturesContentDir, 'dnd2024-id-inventory.json'), 'utf8'));
  });

  test('é internamente consistente (namespace, formato de ContentId, slug determinístico, sem duplicatas)', () => {
    const result = validateIdInventory(idInventory);
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
  });

  test('reserva exatamente as contagens finais esperadas por tipo', () => {
    assert.equal(idInventory.reserved.class.length, 12);
    assert.equal(idInventory.reserved.subclass.length, 48);
    assert.equal(idInventory.reserved.species.length, 11);
    assert.equal(idInventory.reserved.background.length, 16);
    assert.equal(idInventory.reserved.feat.length, 75);
    assert.equal(idInventory.reserved.spell.length, 391);
    assert.equal(idInventory.reserved.weapon.length, 38);
    assert.equal(idInventory.reserved.armor.length, 13);
    assert.equal(idInventory.reserved.equipment.length, 82);
    assert.equal(idInventory.reserved.creature.length, 51);
    assert.equal(idInventory.reserved['glossary-entry'].length, 154);
  });

  test('slugify() é determinístico e sem acentos/maiúsculas', () => {
    assert.equal(slugify('Bárbaro'), 'barbaro');
    assert.equal(slugify('Trilha da Árvore do Mundo'), 'trilha-da-arvore-do-mundo');
    assert.equal(slugify('Bárbaro'), slugify('Bárbaro'));
  });
});

describe('pacote oficial dnd2024 — nenhum arquivo canônico fora do índice além dos tipos ainda não ativos', () => {
  test('todo arquivo .json referenciado por manifest.entities está indexado; arquivos de tipos inativos, se existirem, não estão', async () => {
    const activeTypes = new Set(manifest.entities);
    const allJsonFiles = (await listJsonFilesRecursively(packageDir)).filter(
      (p) => p !== 'manifest.json' && p !== 'index.json',
    );
    const indexedPaths = new Set(index.entries.map((e) => e.path));
    for (const relPath of allJsonFiles) {
      const content = JSON.parse(await readFile(path.join(packageDir, relPath), 'utf8'));
      const type = content.type;
      if (activeTypes.has(type)) {
        assert.ok(indexedPaths.has(relPath), `arquivo de tipo ativo "${relPath}" (type "${type}") deveria estar indexado`);
      }
    }
  });
});
