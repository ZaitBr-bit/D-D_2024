// Helper de testes das Tasks 20 e 21: catálogo em memória construído a partir
// do conteúdo REAL (`dados/pacotes/dnd2024/classes/*.json`) e fábricas de
// personagem canônico v2 para as OITO classes com handler oficial (as quatro
// marciais da Task 20 e as quatro divinas/primitivas da Task 21).
//
// O nome do arquivo é o da Task 20 e foi mantido de propósito: renomeá-lo
// obrigaria a reescrever os imports dos quatro testes já revisados, sem ganho
// de comportamento. O escopo real está descrito aqui e em `CLASS_SLUGS`.
//
// Deliberadamente NÃO usa entidades fabricadas à mão para os máximos: os
// degraus de nível vêm dos mesmos arquivos que a aplicação carrega, para que
// um teste não possa passar contra um conteúdo "limpo" que a migração real
// nunca produz (lição das Tasks 18/19).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createEmptyCharacter } from '../../site/js/domain/character/model.js';
import { deriveSourceInstanceId } from '../../site/js/domain/effects/index.js';
import { usageFlagKey } from '../../site/js/domain/rulesets/dnd2024/handlers/class-handler.js';
import { withEffectContextVariables } from '../../site/js/domain/character/queries/context-variables.js';
import { migrateV1ToV2 } from '../../site/js/infra/character/migrations/v1-to-v2.js';
import { createLegacyAliasResolver } from '../../site/js/infra/character/legacy-alias-resolver.js';

const repoRoot = new URL('../../', import.meta.url);

export const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

// Slugs dos arquivos de classe realmente carregados pelo catálogo de teste.
const CLASS_SLUGS = Object.freeze([
  // Task 20
  'barbaro',
  'guerreiro',
  'ladino',
  'monge',
  // Task 21
  'clerigo',
  'druida',
  'guardiao',
  'paladino',
  // Task 22a
  'bardo',
  'bruxo',
  'feiticeiro',
  'mago',
]);

// Coleções extras carregadas para que um personagem VINDO DA MIGRAÇÃO REAL
// (que traz speciesRef/backgroundRef/featRefs) tenha todas as referências
// resolvíveis — sem isso o coletor de efeitos falharia com
// EFFECT_SOURCE_UNRESOLVED e o teste passaria a medir a fixture, não a regra.
const EXTRA_COLLECTIONS = Object.freeze([
  'species/catalog.json',
  'backgrounds/catalog.json',
  'feats/catalog.json',
]);

/**
 * Lê os arquivos de conteúdo reais e indexa todas as entidades por id.
 * @returns {Map<string, object>}
 */
function loadEntities() {
  const byId = new Map();
  const files = [
    ...CLASS_SLUGS.map((slug) => `classes/${slug}.json`),
    ...EXTRA_COLLECTIONS,
  ];
  for (const relative of files) {
    const path = fileURLToPath(new URL(`dados/pacotes/dnd2024/${relative}`, repoRoot));
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    for (const item of doc.items) {
      byId.set(item.id, Object.freeze(item));
    }
  }
  // Entidade mínima de ruleset: o coletor exige que `build.rulesetRef`
  // resolva, mas o ruleset em si não declara efeito nenhum relevante aqui.
  byId.set(RULESET_REF.id, Object.freeze({ id: RULESET_REF.id, type: 'ruleset', effects: [] }));
  return byId;
}

const ENTITIES = loadEntities();

/**
 * Catálogo em memória com a superfície mínima que `collectCharacterEffects`
 * exige (`resolve`/`list`) mais o `resolve` por id cru usado por
 * `verifyMartialHandlerDeclarations`.
 * @returns {Readonly<object>}
 */
export function createMartialContentRegistry() {
  return Object.freeze({
    resolve(reference) {
      const id = typeof reference === 'string' ? reference : reference?.id;
      const entity = typeof id === 'string' ? ENTITIES.get(id) : undefined;
      return entity === undefined
        ? { ok: false, error: { code: 'CONTENT_NOT_FOUND', context: { id: id ?? null } } }
        : { ok: true, value: entity };
    },
    list(type) {
      return [...ENTITIES.values()].filter((entity) => entity.type === type);
    },
    get(type, id) {
      const entity = ENTITIES.get(id);
      return entity !== undefined && entity.type === type ? entity : null;
    },
  });
}

/**
 * Congela profundamente um valor (para provar que nenhum comando muta o
 * personagem recebido).
 * @param {*} value
 * @param {WeakSet} [seen]
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
 * `sourceInstanceId` determinístico da classe de um personagem.
 * @param {string} classId
 * @returns {string}
 */
export function classSource(classId) {
  return deriveSourceInstanceId({ collection: 'class', index: 0, key: classId });
}

/**
 * `sourceInstanceId` determinístico da subclasse de um personagem.
 * @param {string} subclassId
 * @returns {string}
 */
export function subclassSource(subclassId) {
  return deriveSourceInstanceId({ collection: 'subclass', index: 0, key: subclassId });
}

/**
 * Chave de `state.usageFlags` possuída pela classe.
 * @param {string} classId
 * @param {string} flag
 * @returns {string}
 */
export function classFlag(classId, flag) {
  return usageFlagKey(classSource(classId), flag);
}

/**
 * Chave de `state.usageFlags` possuída pela subclasse.
 * @param {string} subclassId
 * @param {string} flag
 * @returns {string}
 */
export function subclassFlag(subclassId, flag) {
  return usageFlagKey(subclassSource(subclassId), flag);
}

// Recurso de OUTRA proveniência (talento), no formato EXATO que
// `infra/character/migrations/v1-to-v2.js` produz para
// `recursos.talentos.<chave> = {usado: boolean}` — inclusive o prefixo
// `legacy:resources:talentos:` do `sourceInstanceId`. Serve de canário nos
// testes de isolamento: precisa sobreviver byte-idêntico (e por REFERÊNCIA) a
// qualquer ação/descanso de um handler de classe.
export const FOREIGN_TALENT_RESOURCE_ID = 'dnd2024:resource:sortudo';
export const FOREIGN_TALENT_RESOURCE = Object.freeze({
  current: 0,
  sourceInstanceId: 'legacy:resources:talentos:sortudo',
});

// Flag de OUTRA proveniência, no formato cru que a migração copia de
// `talentos_flags` (nome legado, sem namespace de proveniência).
export const FOREIGN_USAGE_FLAG_KEY = 'versatil_escolhido';

/**
 * Constrói um personagem canônico v2 de uma das classes marciais.
 *
 * @param {{classId: string, subclassId?: string | null, level: number,
 *   resources?: object, usageFlags?: object, withForeignSlices?: boolean}} params
 * @returns {object} CanonicalCharacter congelado
 */
export function makeMartialCharacter({
  classId,
  subclassId = null,
  level,
  resources = {},
  usageFlags = {},
  abilities = {},
  withForeignSlices = true,
} = {}) {
  const base = createEmptyCharacter({
    id: 'char-martial',
    now: '2026-08-01T00:00:00.000Z',
    rulesetRef: RULESET_REF,
  });
  const character = {
    ...base,
    build: {
      ...base.build,
      classRef: { id: classId, packageVersion: RULESET_REF.packageVersion },
      subclassRef: subclassId === null ? null : { id: subclassId, packageVersion: RULESET_REF.packageVersion },
    },
    state: {
      ...base.state,
      level,
      // `abilities` só SOBREPÕE as pontuações informadas: o resto continua o
      // que `createEmptyCharacter` produz, para que nenhum teste dependa de um
      // valor de atributo inventado aqui.
      abilities: { ...base.state.abilities, ...abilities },
      resources: {
        ...(withForeignSlices ? { [FOREIGN_TALENT_RESOURCE_ID]: FOREIGN_TALENT_RESOURCE } : {}),
        ...resources,
      },
      usageFlags: {
        ...(withForeignSlices ? { [FOREIGN_USAGE_FLAG_KEY]: true } : {}),
        ...usageFlags,
      },
    },
  };
  return deepFreeze(character);
}

/**
 * Contexto de handler padrão dos testes: catálogo real, nada mais. Nenhum
 * handler desta tarefa lê relógio, `localStorage` ou aleatoriedade.
 * @param {object} [extra]
 * @returns {object}
 */
export function makeContext(extra = {}) {
  return { registry: createMartialContentRegistry(), ...extra };
}

/**
 * Contexto de handler COM `context.variables` resolvidas do personagem REAL
 * (Task 22a) — o mesmo caminho que `createHandlerAdapter` usa em produção.
 * Nada é mockado: os modificadores saem de `getAbilityModifier` sobre as
 * pontuações de `state.abilities` do personagem passado.
 * @param {object} character
 * @param {object} [extra]
 * @returns {object}
 */
export function makeContextFor(character, extra = {}) {
  const base = makeContext(extra);
  const enriched = withEffectContextVariables(character, base);
  if (enriched.ok !== true) {
    throw new Error(`makeContextFor: resolução de variáveis falhou (${enriched.error?.code}).`);
  }
  return enriched.value;
}

// --- Oráculo `tests/fixtures/expected/class-actions/martial.json` ----------

// Os dois oráculos de `tests/fixtures/expected/class-actions/` são lidos e
// CONCATENADOS: `projectionCasesFor`/`transitionCasesFor` filtram por
// `handlerId`, então não há colisão possível entre eles, e cada tarefa mantém
// o próprio arquivo de casos.
const FIXTURE_FILES = Object.freeze(['martial.json', 'divine-primal.json', 'arcane.json']);
const FIXTURE = FIXTURE_FILES.map((name) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`tests/fixtures/expected/class-actions/${name}`, repoRoot)), 'utf8'),
  ),
).reduce(
  (merged, doc) => ({
    projections: [...merged.projections, ...doc.projections],
    transitions: [...merged.transitions, ...doc.transitions],
  }),
  { projections: [], transitions: [] },
);

/**
 * Substitui os placeholders `@class`/`@subclass` de um valor do fixture pelo
 * `sourceInstanceId` determinístico correspondente. Também troca o prefixo em
 * chaves de `usageFlags` (`"@class:furia-ativa"`).
 * @param {*} value
 * @param {string} classId
 * @param {string | null} subclassId
 * @returns {*}
 */
function resolvePlaceholders(value, classId, subclassId) {
  const classId0 = classSource(classId);
  const subclassId0 = subclassId === null ? null : subclassSource(subclassId);
  const replace = (text) => {
    if (text === '@class') {
      return classId0;
    }
    if (text === '@subclass') {
      if (subclassId0 === null) {
        throw new Error('fixture usa @subclass num caso sem subclasse');
      }
      return subclassId0;
    }
    if (text.startsWith('@class:')) {
      return `${classId0}:${text.slice('@class:'.length)}`;
    }
    if (text.startsWith('@subclass:')) {
      if (subclassId0 === null) {
        throw new Error('fixture usa @subclass num caso sem subclasse');
      }
      return `${subclassId0}:${text.slice('@subclass:'.length)}`;
    }
    return text;
  };
  if (typeof value === 'string') {
    return replace(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => resolvePlaceholders(entry, classId, subclassId));
  }
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      out[replace(key)] = resolvePlaceholders(entry, classId, subclassId);
    }
    return out;
  }
  return value;
}

/**
 * Devolve os casos de projeção do fixture para um handler, com placeholders
 * já resolvidos.
 * @param {string} handlerId
 * @returns {Array<object>}
 */
export function projectionCasesFor(handlerId) {
  return FIXTURE.projections
    .filter((entry) => entry.handlerId === handlerId)
    .map((entry) => ({ ...entry, ...resolvePlaceholders({ before: entry.before, expected: entry.expected }, entry.classId, entry.subclassId) }));
}

/**
 * Devolve os casos de transição do fixture para um handler, com placeholders
 * já resolvidos.
 * @param {string} handlerId
 * @returns {Array<object>}
 */
export function transitionCasesFor(handlerId) {
  return FIXTURE.transitions
    .filter((entry) => entry.handlerId === handlerId)
    .map((entry) => ({ ...entry, ...resolvePlaceholders({ before: entry.before, expected: entry.expected }, entry.classId, entry.subclassId) }));
}

/**
 * Monta o personagem de um caso do fixture (sempre COM as fatias de outra
 * proveniência, para que todo caso também prove o isolamento).
 * @param {object} testCase
 * @returns {object}
 */
export function characterForCase(testCase) {
  return makeMartialCharacter({
    classId: testCase.classId,
    subclassId: testCase.subclassId,
    level: testCase.level,
    resources: testCase.before.resources,
    usageFlags: testCase.before.usageFlags,
    // Task 22a: casos cujo teto depende de modificador de atributo declaram as
    // pontuações no próprio fixture (`abilities`), e o valor esperado é o que
    // as consultas puras derivam delas — nada de número mockado.
    abilities: testCase.abilities ?? {},
  });
}

/**
 * Confere um caso de PROJEÇÃO contra o oráculo `martial.json`, incluindo o
 * isolamento das fatias de outra proveniência (que `project` nem deve
 * enxergar).
 * @param {object} handler
 * @param {object} testCase
 */
export function assertProjectionCase(handler, testCase) {
  const character = characterForCase(testCase);
  const result = handler.project(character, makeContextFor(character));
  assert.equal(result.ok, true, `${testCase.id}: project falhou (${result.error?.code})`);

  const projected = {};
  for (const [resourceId, entry] of Object.entries(result.value.resources)) {
    projected[resourceId] = { current: entry.current, missing: entry.missing, max: entry.max };
  }
  assert.deepEqual(projected, testCase.expected.resources, `${testCase.id}: recursos projetados`);

  for (const [actionId, expected] of Object.entries(testCase.expected.actions ?? {})) {
    const action = result.value.actions.find((candidate) => candidate.actionId === actionId);
    assert.ok(action !== undefined, `${testCase.id}: ação "${actionId}" ausente na projeção`);
    assert.deepEqual(
      { available: action.available, reason: action.reason },
      expected,
      `${testCase.id}: disponibilidade de "${actionId}"`,
    );
  }

  // A projeção NUNCA enxerga a fatia de outra proveniência.
  assert.equal(
    Object.hasOwn(result.value.resources, FOREIGN_TALENT_RESOURCE_ID),
    false,
    `${testCase.id}: projeção vazou recurso de outra proveniência`,
  );
  assert.equal(
    Object.hasOwn(result.value.flags, FOREIGN_USAGE_FLAG_KEY),
    false,
    `${testCase.id}: projeção vazou usageFlag de outra proveniência`,
  );
}

/**
 * Confere um caso de TRANSIÇÃO (`execute`/`onRest`) contra o oráculo, mais
 * três invariantes que valem para todos:
 *   1. o personagem de ENTRADA não é mutado;
 *   2. o recurso de outra proveniência sobrevive por REFERÊNCIA (não só
 *      igual — o mesmo objeto), provando que o mapa não foi reconstruído
 *      "por cima";
 *   3. a flag de outra proveniência sobrevive com o mesmo valor.
 * @param {object} handler
 * @param {object} testCase
 */
export function assertTransitionCase(handler, testCase) {
  const character = characterForCase(testCase);
  const snapshotBefore = JSON.stringify(character);
  const foreignBefore = character.state.resources[FOREIGN_TALENT_RESOURCE_ID];

  const result =
    testCase.op.kind === 'execute'
      ? handler.execute(character, { actionId: testCase.op.actionId, payload: testCase.op.payload }, makeContextFor(character))
      : handler.onRest(character, { kind: testCase.op.restKind }, makeContextFor(character));

  assert.equal(JSON.stringify(character), snapshotBefore, `${testCase.id}: o personagem de entrada foi mutado`);
  assert.ok(Array.isArray(result.affected), `${testCase.id}: "affected" deve ser sempre array`);
  assert.equal(result.ok, testCase.expected.ok, `${testCase.id}: ok esperado (erro: ${result.error?.code})`);

  if (testCase.expected.ok !== true) {
    assert.equal(result.error.code, testCase.expected.errorCode, `${testCase.id}: código de erro`);
    assert.equal(result.character, character, `${testCase.id}: falha deve devolver o personagem original`);
    assert.deepEqual(result.affected, [], `${testCase.id}: falha deve ter affected vazio`);
    return;
  }

  assert.deepEqual([...result.affected].sort(), [...testCase.expected.affected].sort(), `${testCase.id}: affected`);

  for (const [resourceId, expected] of Object.entries(testCase.expected.resources)) {
    assert.deepEqual(result.character.state.resources[resourceId], expected, `${testCase.id}: recurso ${resourceId}`);
  }
  for (const [flagKey, expected] of Object.entries(testCase.expected.usageFlags)) {
    assert.equal(result.character.state.usageFlags[flagKey], expected, `${testCase.id}: flag ${flagKey}`);
  }

  // Isolamento de proveniência: fatia alheia intacta e pela MESMA referência.
  assert.equal(
    result.character.state.resources[FOREIGN_TALENT_RESOURCE_ID],
    foreignBefore,
    `${testCase.id}: o recurso de outra proveniência não sobreviveu por referência`,
  );
  assert.equal(
    result.character.state.usageFlags[FOREIGN_USAGE_FLAG_KEY],
    true,
    `${testCase.id}: a usageFlag de outra proveniência foi alterada`,
  );
}

// --- Personagens vindos da MIGRAÇÃO REAL v1 -> v2 --------------------------
//
// Fixtures fabricadas à mão têm todo campo preenchido e escondem o que a
// migração de verdade produz (lição das Tasks 18/19: `sourceInstanceId: null`
// e tabelas incompletas só apareceram quando o teste usou o formato real).
// Aqui a entrada é o registro v1 REAL de `legacy-all-classes.json`, opcional-
// mente combinado com um estágio de `legacy-migration-stages.json`, e a saída
// passa por `migrateV1ToV2` de verdade.

const LEGACY_ALL_CLASSES = JSON.parse(
  readFileSync(fileURLToPath(new URL('tests/fixtures/characters/legacy-all-classes.json', repoRoot)), 'utf8'),
);
const LEGACY_MIGRATION_STAGES = JSON.parse(
  readFileSync(fileURLToPath(new URL('tests/fixtures/characters/legacy-migration-stages.json', repoRoot)), 'utf8'),
);
const LEGACY_ALIASES = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('dados/pacotes/dnd2024/migrations/character-v1-aliases.json', repoRoot)),
    'utf8',
  ),
);

/**
 * Devolve o `personagemAntes` de um caso de `legacy-migration-stages.json`.
 * @param {string} id
 * @returns {object}
 */
export function migrationStageBefore(id) {
  const testCase = LEGACY_MIGRATION_STAGES.cases.find((entry) => entry.id === id);
  if (testCase === undefined) {
    throw new Error(`Caso "${id}" não encontrado em legacy-migration-stages.json`);
  }
  return testCase.personagemAntes;
}

/**
 * Migra, pelo caminho REAL (`migrateV1ToV2` + o mapa de aliases oficial), o
 * personagem v1 de uma classe de `legacy-all-classes.json`, opcionalmente
 * mesclado com campos legados extras (ex.: `recursos`, `nivel`, `subclasse`,
 * ou o `personagemAntes` de um estágio de `legacy-migration-stages.json`).
 *
 * @param {string} caseId - id do caso em legacy-all-classes.json (ex.: 'classe-barbaro')
 * @param {object} [overrides] - campos v1 acrescentados/sobrepostos
 * @returns {{character: object, warnings: ReadonlyArray<*>, raw: object}}
 */
export function migrateLegacyClassCharacter(caseId, overrides = {}) {
  const testCase = LEGACY_ALL_CLASSES.cases.find((entry) => entry.id === caseId);
  if (testCase === undefined) {
    throw new Error(`Caso "${caseId}" não encontrado em legacy-all-classes.json`);
  }
  const raw = { ...testCase.personagem, ...overrides };
  const resolver = createLegacyAliasResolver(LEGACY_ALIASES);
  const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: '2026-08-01T00:00:00.000Z' });
  if (result.ok !== true) {
    throw new Error(`migrateV1ToV2 falhou para "${caseId}": ${result.error?.code}`);
  }
  return { character: result.value.character, warnings: result.value.warnings, raw };
}
