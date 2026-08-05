// Módulo `domain/character/model`: forma canônica v2 de um personagem (ver
// dados/schemas/v1/character-canonical-v2.schema.json), a fábrica de um
// personagem "vazio" (recém-criado, nenhuma escolha de conteúdo feita
// ainda) e `visitCharacterContentReferences`, o único percurso autorizado
// pelos campos tipados do modelo em busca de referências de conteúdo (nunca
// busca genérica por string — cada campo visitado está listado
// explicitamente abaixo, na mesma ordem do schema). Módulo de domínio
// puro: não importa nada de `infra`/`ui` nem globais de navegador
// (site/js/domain/** é verificado por scripts/check-architecture.mjs).

import { parseContentId } from '../../core/content-id.js';

// Versão do schema canônico/persistido v2. Único inteiro aceito por
// `detectCharacterRecordVersion`/`migrateCharacterRecord` como "versão
// atual" — qualquer inteiro maior é tratado como schema futuro (somente
// leitura), qualquer registro sem `_schema`/`schemaVersion` reconhecível é
// tratado como v1 legado.
export const CHARACTER_SCHEMA_VERSION = 2;

// Commit do monólito legado usado como baseline de compatibilidade para os
// testes de contrato desta tarefa (mesmo commit referenciado pelos
// fixtures de tests/fixtures/characters/*.json, campo
// "compatibilityBaseline").
export const COMPATIBILITY_BASELINE = 'e43c5ea';

// As seis habilidades do D&D 5.5e, na ordem canônica usada em todo o
// modelo (build.abilityGeneration.base, state.abilities, etc.).
export const ABILITY_KEYS = Object.freeze([
  'forca',
  'destreza',
  'constituicao',
  'inteligencia',
  'sabedoria',
  'carisma',
]);

/**
 * Constrói o conjunto de seis habilidades com o mesmo valor em todas.
 * @param {number} value
 * @returns {Readonly<Record<string, number>>}
 */
function abilitySet(value) {
  const set = {};
  for (const key of ABILITY_KEYS) {
    set[key] = value;
  }
  return Object.freeze(set);
}

/**
 * Extrai o namespace (primeiro segmento) de um ContentId qualificado
 * (`"namespace:type:slug"`). Assume que `id` já é um ContentId
 * sintaticamente válido — validação de formato é responsabilidade de
 * `core/content-id.js`/dos schemas, não deste helper.
 * @param {string} id
 * @returns {string}
 */
function namespaceOf(id) {
  return id.split(':')[0];
}

/**
 * Cria um personagem canônico v2 "vazio": nenhuma escolha de classe,
 * subclasse, espécie ou antecedente feita ainda (todas nulas, como no
 * template v1 `criarPersonagemVazio`, que usa strings vazias para o mesmo
 * estado "ainda não escolhido"). `rulesetRef` é a única referência de
 * conteúdo obrigatória — sem ela não há como popular `build.contentScopes`
 * nem `build.rulesetRef`.
 * @param {{id: string, now: string, rulesetRef: {id: string, packageVersion: string}}} params
 * @returns {object} CanonicalCharacter (ver character-canonical-v2.schema.json)
 */
export function createEmptyCharacter({ id, now, rulesetRef } = {}) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new TypeError('createEmptyCharacter: "id" deve ser uma string não vazia.');
  }
  if (typeof now !== 'string' || now.length === 0) {
    throw new TypeError('createEmptyCharacter: "now" deve ser uma string de timestamp ISO não vazia.');
  }
  if (
    rulesetRef === null ||
    typeof rulesetRef !== 'object' ||
    typeof rulesetRef.id !== 'string' ||
    typeof rulesetRef.packageVersion !== 'string'
  ) {
    throw new TypeError('createEmptyCharacter: "rulesetRef" deve ser {id, packageVersion}.');
  }

  const namespace = namespaceOf(rulesetRef.id);

  return Object.freeze({
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    identity: Object.freeze({
      id,
      name: '',
      image: '',
      alignment: '',
      // AUSÊNCIA, nunca um tamanho plausível.
      //
      // Todo campo de identidade nasce vazio aqui, e `size` não é exceção — era
      // a única que existia, e ela custou caro. A Task 13 encontrou o mesmo
      // literal em `migrations/v1-to-v2.js`, materializando `tamanho` ausente
      // como `'medium'`; como `identity.size` NÃO é um enum canônico com
      // tradução reversa (ver `character-codec.js#encode`, que grava
      // `record.tamanho = character.identity.size` cru), o chute era regravado
      // no registro persistido a cada save e corrompia o tamanho de todo
      // personagem que passasse pelo codec. Aquela ocorrência foi corrigida
      // para `''`; esta ficou viva porque, na época, `createEmptyCharacter`
      // ainda não tinha consumidor de produção.
      //
      // Passou a ter na Task 28 (o criador novo monta o rascunho a partir
      // daqui). `finalizeCharacter` normaliza a SAÍDA, mas normalizar a saída
      // de um caminho não protege o próximo consumidor que pule por cima dela —
      // então a origem também deixa de mentir.
      //
      // O tamanho EXIBIDO é sempre derivado da espécie
      // (`queries/movement.js`, que lê `species.size` do catálogo); `''` é
      // exatamente o "não escolhido" que aquela projeção já sabe tratar, e é o
      // mesmo valor que o `criarPersonagemVazio()` do baseline usa.
      size: '',
      appearance: '',
      personality: '',
      ideals: '',
      bonds: '',
      flaws: '',
      backstory: '',
      notes: '',
    }),
    build: Object.freeze({
      contentScopes: Object.freeze({
        [namespace]: Object.freeze({ packageVersion: rulesetRef.packageVersion }),
      }),
      rulesetRef: Object.freeze({ id: rulesetRef.id, packageVersion: rulesetRef.packageVersion }),
      classRef: null,
      subclassRef: null,
      speciesRef: null,
      backgroundRef: null,
      choices: Object.freeze({}),
      abilityGeneration: Object.freeze({
        method: 'standard',
        base: abilitySet(10),
        rolls: Object.freeze([]),
      }),
      featRefs: Object.freeze([]),
      weaponMasteryRefs: Object.freeze([]),
      maneuverRefs: Object.freeze([]),
      legacyGrants: Object.freeze({
        skillProficiencyIds: Object.freeze([]),
        skillExpertiseIds: Object.freeze([]),
        savingThrowProficiencyIds: Object.freeze([]),
        languageIds: Object.freeze([]),
        toolProficiencyIds: Object.freeze([]),
        instrumentProficiencyIds: Object.freeze([]),
        otherProficiencies: Object.freeze([]),
        resistanceIds: Object.freeze([]),
        vulnerabilityIds: Object.freeze([]),
        immunityIds: Object.freeze([]),
      }),
      options: Object.freeze({ encumbranceAffectsMovement: false }),
    }),
    state: Object.freeze({
      level: 1,
      xp: 0,
      abilities: abilitySet(10),
      hitPoints: Object.freeze({ current: 1, temporary: 0 }),
      hitDice: Object.freeze({ used: 0 }),
      deathSaves: Object.freeze({ successes: 0, failures: 0 }),
      exhaustion: 0,
      heroicInspiration: false,
      resources: Object.freeze({}),
      spells: Object.freeze({
        known: Object.freeze([]),
        prepared: Object.freeze([]),
        spellbook: Object.freeze([]),
        slots: Object.freeze({}),
        pactSlots: Object.freeze({ used: 0 }),
        concentration: null,
        freeKnownSlots: 0,
      }),
      inventory: Object.freeze([]),
      wallet: Object.freeze({ pc: 0, pp: 0, pe: 0, po: 0, pl: 0 }),
      conditions: Object.freeze([]),
      activeEffects: Object.freeze([]),
      usageFlags: Object.freeze({}),
    }),
    overrides: Object.freeze({}),
    extensions: Object.freeze({ legacyPassthrough: Object.freeze({}) }),
    metadata: Object.freeze({
      createdAt: now,
      updatedAt: now,
      creationConfig: Object.freeze({}),
    }),
  });
}

/**
 * Adiciona ao acumulador `out` uma ocorrência de `ContentRef` explícito
 * (`{id, packageVersion}`), se presente (`ref` pode ser `null`/`undefined`
 * — campos opcionais como `build.subclassRef`/`state.inventory[i].itemRef`).
 * @param {Array<object>} out
 * @param {string} pointer
 * @param {*} ref
 */
function visitContentRef(out, pointer, ref) {
  if (ref === null || ref === undefined || typeof ref.id !== 'string') {
    return;
  }
  out.push({
    pointer,
    id: ref.id,
    packageVersion: typeof ref.packageVersion === 'string' ? ref.packageVersion : null,
  });
}

/**
 * Adiciona ao acumulador `out` uma ocorrência de ContentId "nu" (string,
 * sem packageVersion explícito — a versão é herdada do namespace via
 * `build.contentScopes`), somente quando `value` de fato faz parse como
 * ContentId válido (campos como `otherProficiencies`/`condicoes` podem
 * conter texto legado sem correspondência de conteúdo).
 * @param {Array<object>} out
 * @param {string} pointer
 * @param {*} value
 */
function visitBareContentId(out, pointer, value) {
  if (typeof value !== 'string' || !parseContentId(value).ok) {
    return;
  }
  out.push({ pointer, id: value, packageVersion: null });
}

// Campos de `build.legacyGrants` visitados como listas de ContentId nu.
const LEGACY_GRANT_FIELDS = Object.freeze([
  'skillProficiencyIds',
  'skillExpertiseIds',
  'savingThrowProficiencyIds',
  'languageIds',
  'toolProficiencyIds',
  'instrumentProficiencyIds',
  'otherProficiencies',
  'resistanceIds',
  'vulnerabilityIds',
  'immunityIds',
]);

// Coleções de `build.*Refs` visitadas como ContentRef explícitos. Exportado
// para que `infra/character/character-codec.js` derive a mesma lista de
// pointers ao emitir/sobrepor `content_refs`, em vez de manter uma segunda
// lista hardcoded que pode divergir silenciosamente desta (achado do 3º
// review independente da Task 12: `content_refs` não cobria
// `build.maneuverRefs`/`state.spells.spellbook`, exatamente porque a lista
// do codec tinha sido escrita à mão e ficou incompleta).
export const BUILD_REF_LIST_FIELDS = Object.freeze(['featRefs', 'weaponMasteryRefs', 'maneuverRefs']);

// Coleções de `state.spells.*` visitadas como entradas com `spellRef`
// opcional (ausente quando a magia é `customDefinition`). Exportado pelo
// mesmo motivo de BUILD_REF_LIST_FIELDS acima.
export const SPELL_COLLECTION_FIELDS = Object.freeze(['known', 'prepared', 'spellbook']);

/**
 * Percorre TODOS os campos tipados do schema canônico em busca de
 * referências de conteúdo, por contrato — cada campo abaixo corresponde a
 * um campo do schema que pode conter um ContentId/ContentRef; nenhuma
 * busca genérica por string é feita. Usado por
 * `domain/character/validation.js` (consistência de scope) e pela
 * migração de versão de conteúdo (Task 12 checklist: aplicar a cadeia de
 * migração de referência a cada ocorrência retornada aqui).
 * @param {object} character - CanonicalCharacter
 * @returns {ReadonlyArray<{pointer: string, id: string, packageVersion: string | null}>}
 */
export function visitCharacterContentReferences(character) {
  const out = [];
  const build = character?.build ?? {};
  const state = character?.state ?? {};

  visitContentRef(out, 'build.rulesetRef', build.rulesetRef);
  visitContentRef(out, 'build.classRef', build.classRef);
  visitContentRef(out, 'build.subclassRef', build.subclassRef);
  visitContentRef(out, 'build.speciesRef', build.speciesRef);
  visitContentRef(out, 'build.backgroundRef', build.backgroundRef);

  for (const field of BUILD_REF_LIST_FIELDS) {
    const list = Array.isArray(build[field]) ? build[field] : [];
    list.forEach((ref, index) => visitContentRef(out, `build.${field}[${index}]`, ref));
  }

  const choices = build.choices && typeof build.choices === 'object' ? build.choices : {};
  for (const [key, values] of Object.entries(choices)) {
    visitBareContentId(out, `build.choices{${key}}`, key);
    (Array.isArray(values) ? values : []).forEach((value, index) =>
      visitBareContentId(out, `build.choices{${key}}[${index}]`, value),
    );
  }

  const legacyGrants = build.legacyGrants && typeof build.legacyGrants === 'object' ? build.legacyGrants : {};
  for (const field of LEGACY_GRANT_FIELDS) {
    const list = Array.isArray(legacyGrants[field]) ? legacyGrants[field] : [];
    list.forEach((value, index) => visitBareContentId(out, `build.legacyGrants.${field}[${index}]`, value));
  }

  const resources = state.resources && typeof state.resources === 'object' ? state.resources : {};
  for (const key of Object.keys(resources)) {
    visitBareContentId(out, `state.resources{${key}}`, key);
  }

  const spells = state.spells && typeof state.spells === 'object' ? state.spells : {};
  for (const field of SPELL_COLLECTION_FIELDS) {
    const list = Array.isArray(spells[field]) ? spells[field] : [];
    list.forEach((entry, index) => visitContentRef(out, `state.spells.${field}[${index}].spellRef`, entry?.spellRef));
  }

  const inventory = Array.isArray(state.inventory) ? state.inventory : [];
  inventory.forEach((entry, index) => visitContentRef(out, `state.inventory[${index}].itemRef`, entry?.itemRef));

  const conditions = Array.isArray(state.conditions) ? state.conditions : [];
  conditions.forEach((value, index) => visitBareContentId(out, `state.conditions[${index}]`, value));

  return Object.freeze(out);
}
