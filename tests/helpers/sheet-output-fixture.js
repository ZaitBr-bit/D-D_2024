// Helper de teste: constrói um `SheetViewModel` REAL a partir de um caso de
// `tests/fixtures/expected/derived-values.json` (o oráculo congelado da Task 2).
//
// É o mesmo caminho que `tests/contract/derived-values-parity.test.js` usa para
// as consultas isoladas — registro legado -> `projectLegacyCharacterForQueries`
// -> personagem canônico —, só que levado até a projeção completa da ficha.
// Usar o oráculo aqui é o que permite ao teste de paridade da Task 33 afirmar
// que tela, impressão e PDF convergem para `expectedUnified`, e não apenas
// entre si (três saídas erradas do mesmo jeito passariam num teste que só
// compara as três).
//
// O catálogo é um DUBLÊ mínimo, deliberadamente: este helper não é o lugar de
// exercitar o pacote oficial (isso é `tests/contract/dnd2024-*.test.js` e os
// specs de navegador). Ele modela só o que os casos precisam — habilidade de
// conjuração do Clérigo, velocidade/tamanho do Humano e a lista de perícias.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ok } from '../../site/js/core/result.js';
import { createLegacyAliasResolver } from '../../site/js/infra/character/legacy-alias-resolver.js';
import { projectLegacyCharacterForQueries, deriveLegacyQueryHints } from '../../site/js/infra/character/legacy-query-adapter.js';
import { buildSheetViewModel } from '../../site/js/features/sheet/sheet-view-model.js';
import { buildSpellcastingTable } from '../../site/js/features/sheet/spellcasting-table.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

/** Instante fixo: nenhuma saída desta fixture pode depender do relógio. */
export const FIXTURE_NOW = '2026-08-04T00:00:00.000Z';

/**
 * Efeitos `resource` de conjuração do Clérigo, COPIADOS LITERALMENTE de
 * `dados/pacotes/dnd2024/classes/clerigo.json` (só as linhas que valem no nível
 * 5, que é o nível do personagem do oráculo).
 *
 * Estão aqui porque a Task 33 passou a DERIVAR `context.spellcasting` da matriz
 * de progressão (`features/sheet/spellcasting-table.js`). Sem as linhas, o
 * dublê não teria progressão nenhuma e o teste de paridade continuaria medindo
 * a AUSÊNCIA do produtor em vez de medir o produtor. A paridade EXAUSTIVA
 * contra a tabela legada (8 classes × 20 níveis) vive em
 * `tests/unit/sheet/spellcasting-table.test.js`, sobre o catálogo REAL.
 * @type {ReadonlyArray<Readonly<object>>}
 */
const CLERIGO_SPELL_EFFECTS = Object.freeze([
  Object.freeze({ id: 'spell-slot-1-3', type: 'resource', when: Object.freeze({ kind: 'level', min: 3 }), resource: 'spell-slot-1', max: 4, recovery: 'long-rest', priority: 3, stackKey: 'spell-slot-1', stackable: false }),
  Object.freeze({ id: 'spell-slot-2-4', type: 'resource', when: Object.freeze({ kind: 'level', min: 4 }), resource: 'spell-slot-2', max: 3, recovery: 'long-rest', priority: 4, stackKey: 'spell-slot-2', stackable: false }),
  Object.freeze({ id: 'spell-slot-3-5', type: 'resource', when: Object.freeze({ kind: 'level', min: 5, max: 5 }), resource: 'spell-slot-3', max: 2, recovery: 'long-rest', priority: 5, stackKey: 'spell-slot-3', stackable: false }),
  Object.freeze({ id: 'truques-4', type: 'resource', when: Object.freeze({ kind: 'level', min: 4, max: 9 }), resource: 'truques', max: 4, priority: 4, stackKey: 'truques', stackable: false }),
  Object.freeze({ id: 'magias-preparadas-5', type: 'resource', when: Object.freeze({ kind: 'level', min: 5, max: 5 }), resource: 'magias-preparadas', max: 9, priority: 5, stackKey: 'magias-preparadas', stackable: false }),
]);

const CLERIGO = Object.freeze({
  id: 'dnd2024:class:clerigo',
  type: 'class',
  name: 'Clérigo',
  effects: CLERIGO_SPELL_EFFECTS,
  spellcasting: Object.freeze({ ability: 'dnd2024:ability:sabedoria', progression: 'full' }),
});

/**
 * Tipo de dano REAL do catálogo (`rulesets/damage-types.json`). Sem ele, a
 * resolução de nome do ViewModel não teria o que resolver e o teste de
 * paridade mediria de novo a ausência do mecanismo, não o mecanismo.
 * @type {Readonly<object>}
 */
const FOGO = Object.freeze({ id: 'dnd2024:damage-type:fogo', type: 'damage-type', name: 'Fogo', effects: Object.freeze([]) });
const HUMANO = Object.freeze({ id: 'dnd2024:species:humano', type: 'species', name: 'Humano', effects: Object.freeze([]), size: 'medium', speed: 9 });
const DOMINIO_VIDA = Object.freeze({ id: 'dnd2024:subclass:dominio-da-vida', type: 'subclass', name: 'Domínio da Vida', effects: Object.freeze([]) });

/**
 * Perícias do dublê de catálogo. São as três que o personagem do oráculo tem
 * proficiência mais uma sem proficiência (Investigação), para que a projeção
 * exercite os dois lados.
 * @type {ReadonlyArray<Readonly<object>>}
 */
const SKILLS = Object.freeze([
  Object.freeze({ id: 'dnd2024:skill:percepcao', type: 'skill', name: 'Percepção', ability: 'dnd2024:ability:sabedoria', effects: Object.freeze([]) }),
  Object.freeze({ id: 'dnd2024:skill:intuicao', type: 'skill', name: 'Intuição', ability: 'dnd2024:ability:sabedoria', effects: Object.freeze([]) }),
  Object.freeze({ id: 'dnd2024:skill:religiao', type: 'skill', name: 'Religião', ability: 'dnd2024:ability:inteligencia', effects: Object.freeze([]) }),
  Object.freeze({
    id: 'dnd2024:skill:investigacao',
    type: 'skill',
    name: 'Investigação',
    ability: 'dnd2024:ability:inteligencia',
    effects: Object.freeze([]),
  }),
]);

/**
 * Catálogo dublê. Uma referência não modelada cai num stub genérico sem
 * efeitos — nunca numa falha por algo que o caso não precisa modelar.
 * @returns {Readonly<object>}
 */
export function createFixtureRegistry() {
  const conhecidos = Object.freeze({
    [CLERIGO.id]: CLERIGO,
    [HUMANO.id]: HUMANO,
    [DOMINIO_VIDA.id]: DOMINIO_VIDA,
    [FOGO.id]: FOGO,
    ...Object.fromEntries(SKILLS.map((skill) => [skill.id, skill])),
  });
  return Object.freeze({
    /**
     * @param {string} id
     * @returns {object|null}
     */
    get(id) {
      return conhecidos[id] ?? null;
    },
    /**
     * @param {*} reference
     * @returns {object}
     */
    resolve(reference) {
      const id = typeof reference === 'string' ? reference : reference?.id;
      return ok(conhecidos[id] ?? Object.freeze({ id, type: 'stub', effects: Object.freeze([]) }));
    },
    /**
     * @param {string} type
     * @returns {ReadonlyArray<object>}
     */
    list(type) {
      return type === 'skill' ? SKILLS : Object.freeze([]);
    },
  });
}

/** @type {object|null} */
let aliasResolver = null;
/** @type {object|null} */
let derivedValues = null;

/**
 * Carrega (uma vez) o oráculo da Task 2 e o resolvedor de aliases.
 * @returns {Promise<object>} o conteúdo de `derived-values.json`.
 */
export async function loadDerivedValues() {
  if (derivedValues === null) {
    derivedValues = JSON.parse(await readFile(path.join(repoRoot, 'tests/fixtures/expected/derived-values.json'), 'utf8'));
  }
  if (aliasResolver === null) {
    const aliases = JSON.parse(await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'));
    aliasResolver = createLegacyAliasResolver(aliases);
  }
  return derivedValues;
}

/**
 * Constrói o `SheetViewModel` do caso indicado.
 *
 * @param {string} caseId - id de um caso de `derived-values.json`.
 * @returns {Promise<{testCase: object, character: object, viewModel: object}>}
 */
export async function buildFixtureViewModel(caseId) {
  const fixture = await loadDerivedValues();
  const testCase = fixture.cases.find((entrada) => entrada.id === caseId);
  if (testCase === undefined) {
    throw new Error(`sheet-output-fixture: caso "${caseId}" não existe em derived-values.json`);
  }
  const projetado = projectLegacyCharacterForQueries(testCase.personagem, { aliasResolver, now: FIXTURE_NOW });
  if (projetado.ok !== true) {
    throw new Error(`sheet-output-fixture: o caso "${caseId}" não decodifica: ${projetado.error.code}`);
  }
  const hints = deriveLegacyQueryHints(testCase.personagem);
  const registry = createFixtureRegistry();
  // O MESMO produtor que `pages/sheet.js` liga em produção (Task 33): a
  // fixture não pode injetar `spellcasting` à mão, senão voltaria a medir o
  // harness em vez do caminho real.
  const tabela = buildSpellcastingTable(projetado.value, { registry });
  if (tabela.ok !== true) {
    throw new Error(`sheet-output-fixture: a tabela de conjuração do caso "${caseId}" falhou: ${tabela.error.code}`);
  }
  const viewModel = buildSheetViewModel(projetado.value, {
    registry,
    maximumHitPoints: hints.maximumHitPoints,
    ...(tabela.value === null ? {} : { spellcasting: tabela.value }),
  });
  if (viewModel.ok !== true) {
    throw new Error(`sheet-output-fixture: a projeção do caso "${caseId}" falhou: ${viewModel.error.code}`);
  }
  return { testCase, character: projetado.value, viewModel: viewModel.value };
}
