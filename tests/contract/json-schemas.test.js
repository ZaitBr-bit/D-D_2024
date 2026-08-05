// Contrato dos JSON Schemas de dados/schemas/v1: para cada schema, pelo
// menos um caso Ajv-válido e um Ajv-inválido, carregando os arquivos-fonte
// diretamente (Ajv "cru", 2020-12 + ajv-formats) — não os validadores
// gerados/standalone (esses têm seu próprio teste de paridade em
// tests/unit/content/runtime-validation.test.js). Cobre explicitamente os
// três casos exigidos pelo brief: `type: "manual"` aceito em effect,
// tipo de efeito desconhecido rejeitado, e uma entrada de índice
// integralmente repetida rejeitada por `uniqueItems`.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const schemasDir = path.join(repoRoot, 'dados', 'schemas', 'v1');
const SCHEMA_BASE_URL = 'https://schemas.fichas-de-nimb.dev/v1/';

let ajv;
let schemaFileNames;

before(async () => {
  ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  schemaFileNames = (await readdir(schemasDir)).filter((name) => name.endsWith('.schema.json')).sort();
  for (const fileName of schemaFileNames) {
    const schema = JSON.parse(await readFile(path.join(schemasDir, fileName), 'utf8'));
    ajv.addSchema(schema, schema.$id);
  }
});

const VALID_ABILITY = {
  id: 'phb2024:ability:strength',
  type: 'ability',
  schemaVersion: '1.0.0',
  name: 'Força',
  abbreviation: 'STR',
};

// Personagem canônico v2 mínimo e VÁLIDO, usado como base dos casos do
// `character-canonical-v2.schema.json`. Existe como constante (e não inline)
// porque a Task 23 acrescentou `state.hitPointRolls` e precisa de vários casos
// que só diferem nesse campo — duplicar o personagem inteiro por caso
// esconderia qual campo cada caso está realmente exercitando.
const CANONICAL_V2_BASE = {
  schemaVersion: 2,
  identity: {
    id: 'char-1',
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
  metadata: { createdAt: '2026-07-28T12:00:00.000Z', updatedAt: '2026-07-28T12:00:00.000Z', creationConfig: {} },
};

/**
 * Monta um personagem canônico v2 com o `state` da base sobrescrito pelos
 * campos informados — usado pelos casos de `state.hitPointRolls`.
 * @param {object} statePatch
 * @returns {object}
 */
function canonicalV2WithState(statePatch) {
  return { ...CANONICAL_V2_BASE, state: { ...CANONICAL_V2_BASE.state, ...statePatch } };
}

// Casos de teste por arquivo de schema. `common.schema.json` fica de fora:
// só contém `$defs` reutilizáveis, sem forma própria no nível raiz (o
// schema raiz aceita qualquer valor) — é exercitado indiretamente por todos
// os outros.
const CASES = {
  'manifest.schema.json': {
    valid: [
      {
        schemaVersion: '1.0.0',
        id: 'phb2024',
        name: 'Player’s Handbook 2024',
        version: '1.0.0',
        ruleset: 'phb2024:ruleset:phb2024',
        entities: ['ability', 'spell'],
        legacyAdapters: [{ type: 'legacy-json-bridge', path: 'legacy/spells.json' }],
      },
    ],
    invalid: [
      {},
      // legacyAdapters deliberadamente sem capacidade/confiança (brief).
      {
        schemaVersion: '1.0.0',
        id: 'phb2024',
        name: 'PHB',
        version: '1.0.0',
        ruleset: 'phb2024:ruleset:phb2024',
        entities: ['ability'],
        legacyAdapters: [{ type: 'x', path: 'y.json', capability: 'read', trust: 'high' }],
      },
    ],
  },
  'index.schema.json': {
    valid: [
      {
        schemaVersion: '1.0.0',
        entries: [{ id: 'phb2024:ability:strength', type: 'ability', path: 'abilities.json' }],
      },
    ],
    invalid: [
      // entries como objeto indexado por id — explicitamente proibido pelo brief.
      {
        schemaVersion: '1.0.0',
        entries: { 'phb2024:ability:strength': { type: 'ability', path: 'abilities.json' } },
      },
      // entrada integralmente repetida — deve ser rejeitada por uniqueItems.
      {
        schemaVersion: '1.0.0',
        entries: [
          { id: 'phb2024:ability:strength', type: 'ability', path: 'abilities.json' },
          { id: 'phb2024:ability:strength', type: 'ability', path: 'abilities.json' },
        ],
      },
    ],
  },
  'collection.schema.json': {
    valid: [{ schemaVersion: '1.0.0', type: 'ability', items: [VALID_ABILITY] }],
    invalid: [{ schemaVersion: '1.0.0', type: 'ability', items: [] }],
  },
  'choice.schema.json': {
    valid: [
      {
        id: 'skill-choice',
        prompt: 'Escolha uma perícia',
        min: 1,
        max: 1,
        options: [{ id: 'stealth', label: 'Furtividade' }],
      },
    ],
    invalid: [{ id: 'skill-choice', prompt: 'Escolha uma perícia', min: 1, max: 1, options: [] }],
  },
  'effect.schema.json': {
    valid: [
      { type: 'modifier', target: 'ability.strength.score', operation: 'add', value: 2 },
      // type:"manual" explicitamente exigido pelo brief como aceito.
      { type: 'manual', text: 'Consulte o mestre.' },
      { type: 'proficiency', target: 'phb2024:skill:stealth', level: 'expertise' },
      { type: 'language', language: 'phb2024:language:common' },
      { type: 'defense', damageType: 'phb2024:damage-type:fire', mode: 'resistance' },
      { type: 'grant-spell', spell: 'phb2024:spell:fireball' },
      { type: 'grant-item', item: 'phb2024:equipment:torch', quantity: 2 },
      { type: 'resource', resource: 'ki-points', max: 5, recovery: 'short-rest' },
      {
        type: 'choice',
        choice: { id: 'c1', prompt: 'Escolha', min: 1, max: 1, options: [{ id: 'a', label: 'A' }] },
      },
      { type: 'condition', condition: 'phb2024:condition:prone' },
      { type: 'official-handler', handlerId: 'rage', params: { bonusDamage: 2 } },
    ],
    invalid: [
      // tipo de efeito desconhecido — explicitamente exigido pelo brief como rejeitado.
      { type: 'teleport' },
      { type: 'modifier', target: 'ability.strength.score', operation: 'increment', value: 1 },
      { type: 'grant-spell' },
      // path de prototype pollution — regressão do achado Critical de review.
      { type: 'modifier', target: 'constructor.prototype.pwned', operation: 'set', value: 1 },
      // referência tipada errada: id de equipment no lugar de id de spell.
      { type: 'grant-spell', spell: 'phb2024:equipment:torch' },
    ],
  },
  'ruleset.schema.json': {
    valid: [
      { id: 'phb2024:ruleset:phb2024', type: 'ruleset', schemaVersion: '1.0.0', name: 'PHB 2024', edition: '2024' },
      // Task 23b: glossário de propriedades de arma, tabela de vocabulário
      // que vale para todas as armas em vez de para uma.
      {
        id: 'phb2024:ruleset:phb2024',
        type: 'ruleset',
        schemaVersion: '1.0.0',
        name: 'PHB 2024',
        edition: '2024',
        tables: { weaponProperties: [{ name: 'Acuidade', description: 'Use For ou Des nas jogadas.' }] },
      },
    ],
    invalid: [
      { id: 'phb2024:ruleset:phb2024', type: 'ruleset', schemaVersion: '1.0.0', name: 'PHB 2024' },
      // Task 23b: entrada de `weaponProperties` sem descrição — um glossário
      // com verbete vazio não é glossário.
      {
        id: 'phb2024:ruleset:phb2024',
        type: 'ruleset',
        schemaVersion: '1.0.0',
        name: 'PHB 2024',
        edition: '2024',
        tables: { weaponProperties: [{ name: 'Acuidade' }] },
      },
    ],
  },
  'ability.schema.json': {
    valid: [VALID_ABILITY],
    invalid: [{ id: 'phb2024:ability:strength', type: 'ability', schemaVersion: '1.0.0', name: 'Força' }],
  },
  'skill.schema.json': {
    valid: [
      {
        id: 'phb2024:skill:stealth',
        type: 'skill',
        schemaVersion: '1.0.0',
        name: 'Furtividade',
        ability: 'phb2024:ability:dexterity',
      },
    ],
    invalid: [
      {
        id: 'phb2024:skill:stealth',
        type: 'skill',
        schemaVersion: '1.0.0',
        name: 'Furtividade',
        ability: 'Destreza',
      },
      // ContentId bem formado, mas com o segmento de tipo errado (referência
      // tipada — "phb2024:spell:fireball" não é uma "ability").
      {
        id: 'phb2024:skill:stealth',
        type: 'skill',
        schemaVersion: '1.0.0',
        name: 'Furtividade',
        ability: 'phb2024:spell:fireball',
      },
    ],
  },
  'condition.schema.json': {
    valid: [{ id: 'phb2024:condition:prone', type: 'condition', schemaVersion: '1.0.0', name: 'Caído' }],
    invalid: [{ id: 'phb2024:condition:prone', type: 'ability', schemaVersion: '1.0.0', name: 'Caído' }],
  },
  'damage-type.schema.json': {
    valid: [{ id: 'phb2024:damage-type:fire', type: 'damage-type', schemaVersion: '1.0.0', name: 'Fogo' }],
    invalid: [{ id: 'phb2024:damage-type:fire', type: 'damage-type', schemaVersion: '1.0.0' }],
  },
  'language.schema.json': {
    valid: [{ id: 'phb2024:language:common', type: 'language', schemaVersion: '1.0.0', name: 'Comum' }],
    invalid: [{ id: 'phb2024:language:common', type: 'language', schemaVersion: '1.0.0', name: 'Comum', script: 5 }],
  },
  'class.schema.json': {
    valid: [
      {
        id: 'phb2024:class:fighter',
        type: 'class',
        schemaVersion: '1.0.0',
        name: 'Guerreiro',
        hitDie: 'd10',
        primaryAbility: ['phb2024:ability:strength'],
        savingThrowProficiencies: ['phb2024:ability:strength', 'phb2024:ability:constitution'],
      },
      // Task 23b: `legacyPresentation` — DÍVIDA TEMPORÁRIA, cópia verbatim do
      // arquivo legado de classe (ver a `description` do campo no schema).
      // Aceito, mas com forma FECHADA: campo novo aqui dentro tem de ser
      // deliberado, não um despejo livre de JSON legado.
      {
        id: 'phb2024:class:fighter',
        type: 'class',
        schemaVersion: '1.0.0',
        name: 'Guerreiro',
        hitDie: 'd10',
        primaryAbility: ['phb2024:ability:strength'],
        savingThrowProficiencies: ['phb2024:ability:strength', 'phb2024:ability:constitution'],
        legacyPresentation: {
          nome: 'Guerreiro',
          tracos_basicos: { dado_vida: 'd10' },
          tabela_caracteristicas: [{ nivel: 1 }],
          caracteristicas: [{ nivel: 1, nome: 'Estilo de Luta', descricao: '...' }],
          subclasses: [{ nome: 'Campeão', caracteristicas: [] }],
          lista_magias: {},
          texto_completo: '## Guerreiro',
        },
      },
    ],
    invalid: [
      {
        id: 'phb2024:class:fighter',
        type: 'class',
        schemaVersion: '1.0.0',
        name: 'Guerreiro',
        primaryAbility: ['phb2024:ability:strength'],
        savingThrowProficiencies: ['phb2024:ability:strength'],
      },
      {
        id: 'phb2024:class:fighter',
        type: 'class',
        schemaVersion: '1.0.0',
        name: 'Guerreiro',
        hitDie: 'd10',
        primaryAbility: ['phb2024:ability:strength'],
        savingThrowProficiencies: ['phb2024:ability:strength'],
        legacyPresentation: { nome: 'Guerreiro' },
      },
      {
        id: 'phb2024:class:fighter',
        type: 'class',
        schemaVersion: '1.0.0',
        name: 'Guerreiro',
        hitDie: 'd10',
        primaryAbility: ['phb2024:ability:strength'],
        savingThrowProficiencies: ['phb2024:ability:strength'],
        legacyPresentation: {
          nome: 'Guerreiro',
          tracos_basicos: {},
          tabela_caracteristicas: [],
          caracteristicas: [],
          subclasses: [],
          lista_magias: {},
          campo_novo_nao_declarado: 1,
        },
      },
    ],
  },
  'subclass.schema.json': {
    valid: [
      {
        id: 'phb2024:subclass:champion',
        type: 'subclass',
        schemaVersion: '1.0.0',
        name: 'Campeão',
        class: 'phb2024:class:fighter',
      },
    ],
    invalid: [
      { id: 'phb2024:subclass:champion', type: 'subclass', schemaVersion: '1.0.0', name: 'Campeão' },
      // referência tipada errada: id de species no lugar de id de class.
      {
        id: 'phb2024:subclass:champion',
        type: 'subclass',
        schemaVersion: '1.0.0',
        name: 'Campeão',
        class: 'phb2024:species:human',
      },
    ],
  },
  'feature.schema.json': {
    valid: [
      {
        id: 'phb2024:feature:extra-attack',
        type: 'feature',
        schemaVersion: '1.0.0',
        name: 'Ataque Extra',
        grantedBy: 'phb2024:class:fighter',
        level: 5,
      },
    ],
    invalid: [
      {
        id: 'phb2024:feature:extra-attack',
        type: 'feature',
        schemaVersion: '1.0.0',
        name: 'Ataque Extra',
        level: 25,
      },
    ],
  },
  'species.schema.json': {
    valid: [
      { id: 'phb2024:species:human', type: 'species', schemaVersion: '1.0.0', name: 'Humano', size: 'medium', speed: 9 },
      // Task 23b: `legacyPresentation` (dívida temporária) — `tracos` é
      // obrigatório dentro do bloco, `texto_completo` é opcional.
      {
        id: 'phb2024:species:human',
        type: 'species',
        schemaVersion: '1.0.0',
        name: 'Humano',
        size: 'medium',
        speed: 9,
        legacyPresentation: { tracos: [{ nome: 'Versátil', descricao: '...' }], texto_completo: '## Humano' },
      },
    ],
    invalid: [
      { id: 'phb2024:species:human', type: 'species', schemaVersion: '1.0.0', name: 'Humano', size: 'medium' },
      // Task 23b: bloco de apresentação sem `tracos` não serve para nada —
      // era exatamente o campo ausente que bloqueava `getEspecies`.
      {
        id: 'phb2024:species:human',
        type: 'species',
        schemaVersion: '1.0.0',
        name: 'Humano',
        size: 'medium',
        speed: 9,
        legacyPresentation: { texto_completo: '## Humano' },
      },
    ],
  },
  'background.schema.json': {
    valid: [
      {
        id: 'phb2024:background:hermit',
        type: 'background',
        schemaVersion: '1.0.0',
        name: 'Eremita',
        abilityScoreOptions: ['phb2024:ability:wisdom'],
      },
      // Task 23b: `legacyPresentation` do antecedente carrega SÓ os dois
      // campos que o catálogo não modela (ver a `description` no schema).
      {
        id: 'phb2024:background:hermit',
        type: 'background',
        schemaVersion: '1.0.0',
        name: 'Eremita',
        abilityScoreOptions: ['phb2024:ability:wisdom'],
        legacyPresentation: { ferramentas: 'Kit de Herborismo', talento: 'Curandeiro (veja o capítulo 5)' },
      },
    ],
    invalid: [
      {
        id: 'phb2024:background:hermit',
        type: 'background',
        schemaVersion: '1.0.0',
        name: 'Eremita',
        abilityScoreOptions: ['Sabedoria'],
      },
      // Task 23b: perícias/idiomas/equipamento são DERIVADOS dos efeitos e
      // não podem entrar no bloco de apresentação por uma porta lateral.
      {
        id: 'phb2024:background:hermit',
        type: 'background',
        schemaVersion: '1.0.0',
        name: 'Eremita',
        legacyPresentation: { ferramentas: 'Kit de Herborismo', talento: 'Curandeiro', pericias: 'Medicina, Religião' },
      },
    ],
  },
  'feat.schema.json': {
    valid: [
      { id: 'phb2024:feat:tough', type: 'feat', schemaVersion: '1.0.0', name: 'Resistente', category: 'general' },
      // Task 23b: `legacyPresentation` do talento — os dois campos são
      // obrigatórios dentro do bloco (o legado sempre os escreve, mesmo
      // vazios), para que "sem pré-requisito" seja um fato copiado do legado
      // e não um default do conversor.
      {
        id: 'phb2024:feat:tough',
        type: 'feat',
        schemaVersion: '1.0.0',
        name: 'Resistente',
        category: 'general',
        legacyPresentation: { prerequisito: '', beneficios: [{ nome: 'Vigor', descricao: '...' }] },
      },
    ],
    invalid: [
      { id: 'phb2024:feat:tough', type: 'feat', schemaVersion: '1.0.0', name: 'Resistente', category: 'lendário' },
      {
        id: 'phb2024:feat:tough',
        type: 'feat',
        schemaVersion: '1.0.0',
        name: 'Resistente',
        category: 'general',
        legacyPresentation: { beneficios: [] },
      },
    ],
  },
  'spell.schema.json': {
    valid: [
      {
        id: 'phb2024:spell:fireball',
        type: 'spell',
        schemaVersion: '1.0.0',
        name: 'Bola de Fogo',
        level: 3,
        school: 'evocation',
        castingTime: '1 ação',
        range: '45 metros',
        components: { verbal: true, somatic: true, material: false },
        duration: 'Instantânea',
        concentration: false,
        ritual: false,
        classes: ['phb2024:class:wizard'],
      },
      // Task 23b: `components.materialCostOrConsumed` — a distinção que a
      // coluna `especial` das listas por classe marca com "M".
      {
        id: 'phb2024:spell:identify',
        type: 'spell',
        schemaVersion: '1.0.0',
        name: 'Identificação',
        level: 1,
        school: 'divination',
        castingTime: '1 minuto',
        range: 'Toque',
        components: {
          verbal: true,
          somatic: true,
          material: true,
          materialDescription: 'uma pérola no valor de 100 ou mais PO',
          materialCostOrConsumed: true,
        },
        duration: 'Instantânea',
        concentration: false,
        ritual: true,
        classes: ['phb2024:class:wizard'],
      },
    ],
    invalid: [
      {
        id: 'phb2024:spell:fireball',
        type: 'spell',
        schemaVersion: '1.0.0',
        name: 'Bola de Fogo',
        level: 3,
        school: 'pyromancy',
        castingTime: '1 ação',
        range: '45 metros',
        components: { verbal: true, somatic: true, material: false },
        duration: 'Instantânea',
        concentration: false,
        ritual: false,
        classes: ['phb2024:class:wizard'],
      },
    ],
  },
  'spell-list.schema.json': {
    valid: [
      {
        id: 'phb2024:spell-list:wizard',
        type: 'spell-list',
        schemaVersion: '1.0.0',
        name: 'Lista de Mago',
        spells: ['phb2024:spell:fireball'],
      },
    ],
    invalid: [
      {
        id: 'phb2024:spell-list:wizard',
        type: 'spell-list',
        schemaVersion: '1.0.0',
        name: 'Lista de Mago',
        spells: 'phb2024:spell:fireball',
      },
    ],
  },
  'weapon.schema.json': {
    valid: [
      {
        id: 'phb2024:weapon:longsword',
        type: 'weapon',
        schemaVersion: '1.0.0',
        name: 'Espada Longa',
        weaponCategory: 'martial',
        rangeCategory: 'melee',
        damage: { dice: '1d8', type: 'phb2024:damage-type:slashing' },
        properties: ['versatile'],
        versatileDamage: '1d10',
        mastery: 'sap',
        weight: 1.5,
        cost: { amount: 15, currency: 'gp' },
      },
      // Zarabatana (Task 10): dano fixo "1 Perfurante", sem dado — o
      // padrão de `dice` aceita um inteiro sem "d" para esse caso legado.
      {
        id: 'phb2024:weapon:blowgun',
        type: 'weapon',
        schemaVersion: '1.0.0',
        name: 'Zarabatana',
        weaponCategory: 'martial',
        rangeCategory: 'ranged',
        damage: { dice: '1', type: 'phb2024:damage-type:piercing' },
      },
      // Task 23b: alcance + tipo de munição + ressalva de propriedade, os
      // campos que sustentam a coluna `propriedades` do legado sem parsing de
      // prosa no runtime.
      {
        id: 'phb2024:weapon:longbow',
        type: 'weapon',
        schemaVersion: '1.0.0',
        name: 'Arco Longo',
        weaponCategory: 'martial',
        rangeCategory: 'ranged',
        damage: { dice: '1d8', type: 'phb2024:damage-type:piercing' },
        properties: ['two-handed', 'ammunition', 'heavy'],
        range: { normal: '45', long: '180' },
        ammunitionType: 'Flecha',
        propertyNotes: { 'two-handed': 'a menos que montado' },
      },
    ],
    invalid: [
      {
        id: 'phb2024:weapon:longsword',
        type: 'weapon',
        schemaVersion: '1.0.0',
        name: 'Espada Longa',
        weaponCategory: 'martial',
        rangeCategory: 'melee',
        damage: { dice: '1d8-slashing', type: 'phb2024:damage-type:slashing' },
      },
      // Enum fechado de maestria (Task 10): valor fora das 8 maestrias
      // oficiais é inválido.
      {
        id: 'phb2024:weapon:longsword',
        type: 'weapon',
        schemaVersion: '1.0.0',
        name: 'Espada Longa',
        weaponCategory: 'martial',
        rangeCategory: 'melee',
        damage: { dice: '1d8', type: 'phb2024:damage-type:slashing' },
        mastery: 'stun',
      },
      // Task 23b: `rangeCategory` é obrigatório — sem ele a projeção não
      // saberia separar "Corpo a Corpo" de "à Distância" e voltaria a inferir
      // pela propriedade `ammunition` (o bug do Dardo).
      {
        id: 'phb2024:weapon:longsword',
        type: 'weapon',
        schemaVersion: '1.0.0',
        name: 'Espada Longa',
        weaponCategory: 'martial',
        damage: { dice: '1d8', type: 'phb2024:damage-type:slashing' },
      },
      // Task 23b: `rangeCategory` é enum fechado.
      {
        id: 'phb2024:weapon:longsword',
        type: 'weapon',
        schemaVersion: '1.0.0',
        name: 'Espada Longa',
        weaponCategory: 'martial',
        rangeCategory: 'corpo-a-corpo',
        damage: { dice: '1d8', type: 'phb2024:damage-type:slashing' },
      },
      // Task 23b: chave de `propertyNotes` fora do enum de `properties`.
      {
        id: 'phb2024:weapon:longsword',
        type: 'weapon',
        schemaVersion: '1.0.0',
        name: 'Espada Longa',
        weaponCategory: 'martial',
        rangeCategory: 'melee',
        damage: { dice: '1d8', type: 'phb2024:damage-type:slashing' },
        propertyNotes: { montaria: 'a menos que montado' },
      },
    ],
  },
  'armor.schema.json': {
    valid: [
      {
        id: 'phb2024:armor:chain-mail',
        type: 'armor',
        schemaVersion: '1.0.0',
        name: 'Cota de Malha',
        armorCategory: 'heavy',
        baseArmorClass: 16,
        addDexModifier: false,
      },
      // Escudo: bônus de CA (`armorClassBonus`), NUNCA `baseArmorClass` —
      // um escudo não tem CA base própria, só soma a uma CA já calculada de
      // outra forma (Task 10: `dados/equipamento/armaduras.json`, "Escudo",
      // "+2").
      {
        id: 'phb2024:armor:shield',
        type: 'armor',
        schemaVersion: '1.0.0',
        name: 'Escudo',
        armorCategory: 'shield',
        armorClassBonus: 2,
        addDexModifier: false,
      },
    ],
    invalid: [
      // `addDexModifier` continua obrigatório mesmo sem `baseArmorClass`
      // (que a Task 10 tornou opcional, para acomodar o caso "Escudo"
      // acima) — omiti-lo deve continuar inválido.
      {
        id: 'phb2024:armor:chain-mail',
        type: 'armor',
        schemaVersion: '1.0.0',
        name: 'Cota de Malha',
        armorCategory: 'heavy',
        baseArmorClass: 16,
      },
    ],
  },
  'equipment.schema.json': {
    valid: [
      { id: 'phb2024:equipment:torch', type: 'equipment', schemaVersion: '1.0.0', name: 'Tocha', category: 'adventuring-gear' },
      // Task 23b: munição vendida em conjunto (quantidade + recipiente) e os
      // textos de peso/custo que o legado escreve fora do formato numérico.
      {
        id: 'phb2024:equipment:arrows',
        type: 'equipment',
        schemaVersion: '1.0.0',
        name: 'Flechas',
        category: 'Munição',
        weight: 0.5,
        cost: { amount: 1, currency: 'gp' },
        ammunition: { quantity: '20', storage: 'Aljava' },
      },
      {
        id: 'phb2024:equipment:arcane-focus',
        type: 'equipment',
        schemaVersion: '1.0.0',
        name: 'Foco Arcano',
        category: 'Equipamento',
        weightDisplay: 'Varia',
        costDisplay: 'Varia',
        legacySections: [{ title: 'Um Bruxo canaliza magia através de um Foco Arcano', text: '' }],
      },
    ],
    invalid: [
      { id: 'phb2024:equipment:torch', type: 'equipment', schemaVersion: '1.0.0', name: 'Tocha' },
      // Task 23b: `ammunition` sem `storage` — a coluna `armazenamento` do
      // legado é parte do par, não um extra opcional.
      {
        id: 'phb2024:equipment:arrows',
        type: 'equipment',
        schemaVersion: '1.0.0',
        name: 'Flechas',
        category: 'Munição',
        ammunition: { quantity: '20' },
      },
      // Task 23b: `weightDisplay` vazio seria um "—" inventado disfarçado; a
      // ausência tem de continuar ausência.
      {
        id: 'phb2024:equipment:arcane-focus',
        type: 'equipment',
        schemaVersion: '1.0.0',
        name: 'Foco Arcano',
        category: 'Equipamento',
        weightDisplay: '',
      },
    ],
  },
  'creature.schema.json': {
    valid: [
      {
        id: 'phb2024:creature:goblin',
        type: 'creature',
        schemaVersion: '1.0.0',
        name: 'Goblin',
        size: 'small',
        creatureType: 'humanoid',
        challengeRating: 0.25,
        armorClass: 15,
        hitPoints: 7,
      },
    ],
    invalid: [
      {
        id: 'phb2024:creature:goblin',
        type: 'creature',
        schemaVersion: '1.0.0',
        name: 'Goblin',
        size: 'small',
        creatureType: 'humanoid',
        challengeRating: 0.25,
        armorClass: 15,
      },
    ],
  },
  'glossary-entry.schema.json': {
    valid: [
      {
        id: 'phb2024:glossary-entry:advantage',
        type: 'glossary-entry',
        schemaVersion: '1.0.0',
        name: 'Vantagem',
        term: 'Vantagem',
        definition: 'Role dois d20 e use o maior resultado.',
      },
    ],
    invalid: [
      {
        id: 'phb2024:glossary-entry:advantage',
        type: 'glossary-entry',
        schemaVersion: '1.0.0',
        name: 'Vantagem',
        term: 'Vantagem',
      },
    ],
  },
  'migration-map.schema.json': {
    valid: [
      {
        id: 'phb2024:migration-map:v1-to-v2',
        type: 'migration-map',
        schemaVersion: '1.0.0',
        name: 'Migração v1 -> v2',
        mappings: [{ from: 'forca', to: 'phb2024:ability:strength' }],
      },
    ],
    invalid: [
      {
        id: 'phb2024:migration-map:v1-to-v2',
        type: 'migration-map',
        schemaVersion: '1.0.0',
        name: 'Migração v1 -> v2',
        mappings: [{ from: 'forca', to: 'strength' }],
      },
    ],
  },
  'character-canonical-v2.schema.json': {
    valid: [
      // Sem `state.hitPointRolls`: o campo é OPCIONAL por extensão incremental
      // (Task 23). Um registro migrado de v1 não tem histórico de rolagens, e o
      // schema não pode exigir que a migração invente um.
      CANONICAL_V2_BASE,
      // Com histórico completo, um dos três métodos por entrada.
      canonicalV2WithState({
        level: 3,
        hitPointRolls: [
          { level: 1, rolled: 10, method: 'fixed' },
          { level: 2, rolled: 6, method: 'roll' },
          { level: 3, rolled: 6, method: 'average' },
        ],
      }),
      // `rolled: null` é válido: histórico importado em que o número da rolagem
      // não é conhecido. Preencher com a média "plausível" seria exatamente o
      // default de migração proibido pelas Global Constraints.
      canonicalV2WithState({
        level: 2,
        hitPointRolls: [
          { level: 1, rolled: 10, method: 'fixed' },
          { level: 2, rolled: null, method: 'roll' },
        ],
      }),
      // Histórico vazio é distinto de ausente e continua válido.
      canonicalV2WithState({ hitPointRolls: [] }),
    ],
    invalid: [
      { schemaVersion: 2, identity: { id: 'char-1', name: 'Aria' } },
      // `method` fora do vocabulário fechado roll/average/fixed.
      canonicalV2WithState({ hitPointRolls: [{ level: 1, rolled: 10, method: 'chute' }] }),
      // `rolled` é obrigatório: omiti-lo deixaria "não rolado" e "rolou zero"
      // indistinguíveis, e é `null` que expressa ausência.
      canonicalV2WithState({ hitPointRolls: [{ level: 1, method: 'roll' }] }),
      // `level` fora de 1..20.
      canonicalV2WithState({ hitPointRolls: [{ level: 21, rolled: 5, method: 'roll' }] }),
      // Campo extra numa entrada (additionalProperties: false).
      canonicalV2WithState({ hitPointRolls: [{ level: 1, rolled: 5, method: 'roll', classe: 'Mago' }] }),
      // `hitPointRolls` precisa ser array, não objeto indexado por nível.
      canonicalV2WithState({ hitPointRolls: { 1: { rolled: 5, method: 'roll' } } }),
    ],
  },
  'character-record-v2.schema.json': {
    valid: [
      {
        _schema: { version: 2 },
        id: 'char-1',
        nome: 'Aria',
        criado_em: '2026-07-28T12:00:00.000Z',
        atualizado_em: '2026-07-28T12:00:00.000Z',
        content_refs: { 'build.classRef': { id: 'phb2024:class:fighter', packageVersion: '1.0.0' } },
        choice_refs: {},
        overrides: {},
      },
    ],
    invalid: [
      { id: 'char-1', nome: 'Aria', atualizado_em: '2026-07-28T12:00:00.000Z' },
      // format:"date-time" deve rejeitar timestamps calendarmente
      // impossíveis (regressão do achado Important #2 de review — a
      // implementação vendorizada de date-time deve se comportar como o
      // ajv-formats real, não como um regex superficial).
      {
        _schema: { version: 2 },
        id: 'char-1',
        nome: 'Aria',
        atualizado_em: '2026-02-30T99:00:00+25:00',
      },
    ],
  },
};

describe('contract/json-schemas — todos os arquivos em dados/schemas/v1 têm casos válidos/inválidos', () => {
  test('CASES cobre todo schema com forma própria (exceto common.schema.json)', () => {
    const expected = schemaFileNames.filter((name) => name !== 'common.schema.json');
    assert.deepEqual(Object.keys(CASES).sort(), expected.sort());
  });

  for (const [fileName, { valid, invalid }] of Object.entries(CASES)) {
    describe(fileName, () => {
      const schemaId = SCHEMA_BASE_URL + fileName;

      valid.forEach((value, i) => {
        test(`caso válido #${i + 1} é aceito pelo Ajv`, () => {
          const validate = ajv.getSchema(schemaId);
          const ok = validate(value);
          assert.equal(ok, true, JSON.stringify(validate.errors));
        });
      });

      invalid.forEach((value, i) => {
        test(`caso inválido #${i + 1} é rejeitado pelo Ajv`, () => {
          const validate = ajv.getSchema(schemaId);
          const ok = validate(value);
          assert.equal(ok, false);
        });
      });
    });
  }
});
