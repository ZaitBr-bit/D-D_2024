// Teste de contrato (Task 16): compara a saída das novas consultas puras de
// `domain/character/queries/*` (via `infra/character/legacy-query-adapter`)
// contra `expectedUnified` de `tests/fixtures/expected/derived-values.json`
// (Task 2) — a fonte de verdade dos valores corretos, não `baselineObserved`
// (que só documenta o comportamento antigo, incluindo os bugs de divergência
// já corrigidos por esta tarefa: PV temporário e Dados de Vida restantes em
// print/PDF).
//
// Categorias fora do escopo das interfaces desta tarefa (espaços de magia —
// Task 19/depende de progressão; recursos de talento — não é uma das nove
// consultas do brief) são deliberadamente puladas aqui, não adaptadas com um
// valor forçado.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLegacyAliasResolver } from '../../site/js/infra/character/legacy-alias-resolver.js';
import { projectLegacyCharacterForQueries, deriveLegacyQueryHints } from '../../site/js/infra/character/legacy-query-adapter.js';
import { ok } from '../../site/js/core/result.js';
import {
  getHitPointProjection,
  getArmorClass,
  getInitiative,
  getMovement,
  getDefenses,
  getSkillProjection,
} from '../../site/js/domain/character/queries/index.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const NOW = '2026-07-30T00:00:00.000Z';

// Vocabulário mínimo de conteúdo dnd2024 necessário para os casos de CD de
// Magia/Ataque de Magia (habilidade de conjuração do Clérigo) e Deslocamento
// (velocidade base do Humano). Qualquer outra referência resolvida pelo
// motor de efeitos (Task 15) cai no stub genérico `{effects: []}` — nunca
// falha por causa de uma referência que este teste não precisa modelar.
const CLERIGO_ENTITY = Object.freeze({
  id: 'dnd2024:class:clerigo',
  type: 'class',
  effects: Object.freeze([]),
  spellcasting: Object.freeze({ ability: 'dnd2024:ability:sabedoria', progression: 'full' }),
});
const HUMANO_ENTITY = Object.freeze({ id: 'dnd2024:species:humano', type: 'species', effects: Object.freeze([]), size: 'medium', speed: 9 });
// Golias ("Golias" tem alias real em character-v1-aliases.json): 10,5m —
// usado só pelo teste de I3 (não-tautológico) abaixo. Humano (9m) coincide
// com `DEFAULT_SPEED_METERS` de `movement.js`: um teste que só usa Humano
// continuaria passando mesmo que o lookup de espécie via catálogo fosse
// deletado por engano. Lido diretamente do pacote real
// (`dados/pacotes/dnd2024/species/catalog.json`), não inventado.
const GOLIAS_ENTITY = Object.freeze({ id: 'dnd2024:species:golias', type: 'species', effects: Object.freeze([]), size: 'medium', speed: 10.5 });

function makeFakeRegistry() {
  const known = { 'dnd2024:class:clerigo': CLERIGO_ENTITY, 'dnd2024:species:humano': HUMANO_ENTITY, 'dnd2024:species:golias': GOLIAS_ENTITY };
  return Object.freeze({
    get(id) {
      return known[id] ?? null;
    },
    resolve(reference) {
      const id = typeof reference === 'string' ? reference : reference?.id;
      return ok(known[id] ?? Object.freeze({ id, type: 'stub', effects: Object.freeze([]) }));
    },
    list() {
      return Object.freeze([]);
    },
  });
}

let ctx;
let derivedValues;

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  ctx = { aliasResolver: createLegacyAliasResolver(aliases), now: NOW };
  derivedValues = JSON.parse(await readFile(path.join(repoRoot, 'tests/fixtures/expected/derived-values.json'), 'utf8'));
});

/**
 * Localiza um caso pelo id na fixture `derived-values.json`.
 * @param {string} id
 * @returns {object}
 */
function caseById(id) {
  const found = derivedValues.cases.find((entry) => entry.id === id);
  assert.ok(found, `caso "${id}" não encontrado em derived-values.json`);
  return found;
}

describe('contract/derived-values-parity — expectedUnified via domain/character/queries', () => {
  test('pv-convergente: PV atual/máximo via getHitPointProjection', () => {
    const testCase = caseById('pv-convergente');
    const character = projectLegacyCharacterForQueries(testCase.personagem, ctx);
    assert.equal(character.ok, true);
    const hints = deriveLegacyQueryHints(testCase.personagem);
    const result = getHitPointProjection(character.value, { maximumHitPoints: hints.maximumHitPoints });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.equal(`${result.value.current}/${result.value.maximum}`, testCase.expectedUnified);
  });

  test('ca-convergente: Classe de Armadura via getArmorClass', () => {
    const testCase = caseById('ca-convergente');
    const character = projectLegacyCharacterForQueries(testCase.personagem, ctx);
    assert.equal(character.ok, true);
    const result = getArmorClass(character.value);
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.equal(result.value, testCase.expectedUnified);
  });

  test('iniciativa-convergente: Iniciativa via getInitiative', () => {
    const testCase = caseById('iniciativa-convergente');
    const character = projectLegacyCharacterForQueries(testCase.personagem, ctx);
    assert.equal(character.ok, true);
    const result = getInitiative(character.value);
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.equal(result.value, testCase.expectedUnified);
  });

  test('pv-temporario-divergente: PV temporário via getHitPointProjection (corrige o bug de print/PDF)', () => {
    const testCase = caseById('pv-temporario-divergente');
    const character = projectLegacyCharacterForQueries(testCase.personagem, ctx);
    assert.equal(character.ok, true);
    const hints = deriveLegacyQueryHints(testCase.personagem);
    const result = getHitPointProjection(character.value, { maximumHitPoints: hints.maximumHitPoints });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.equal(result.value.temporary, testCase.expectedUnified);
  });

  test('dados-de-vida-restantes-divergente: hitDiceRemaining via getHitPointProjection (corrige o bug de print/PDF)', () => {
    const testCase = caseById('dados-de-vida-restantes-divergente');
    const character = projectLegacyCharacterForQueries(testCase.personagem, ctx);
    assert.equal(character.ok, true);
    const hints = deriveLegacyQueryHints(testCase.personagem);
    const result = getHitPointProjection(character.value, { maximumHitPoints: hints.maximumHitPoints });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.equal(result.value.hitDiceRemaining, testCase.expectedUnified);
    // fix round 1, achado I5: hitDiceTotal/hitDiceUsed são os operandos
    // brutos por trás de hitDiceRemaining (nivel=5, dados_vida_usados=2) —
    // confirmados diretamente contra os campos crus da fixture, não só o
    // resultado final da subtração.
    assert.equal(result.value.hitDiceTotal, testCase.personagem.nivel);
    assert.equal(result.value.hitDiceUsed, testCase.personagem.dados_vida_usados);
  });

  test('cd-magia-convergente: CD de Magia via getDefenses', () => {
    const testCase = caseById('cd-magia-convergente');
    const character = projectLegacyCharacterForQueries(testCase.personagem, ctx);
    assert.equal(character.ok, true);
    const result = getDefenses(character.value, { registry: makeFakeRegistry() });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.equal(result.value.spellSaveDC, testCase.expectedUnified);
  });

  test('ataque-magia-convergente: Bônus de Ataque de Magia via getDefenses', () => {
    const testCase = caseById('ataque-magia-convergente');
    const character = projectLegacyCharacterForQueries(testCase.personagem, ctx);
    assert.equal(character.ok, true);
    const result = getDefenses(character.value, { registry: makeFakeRegistry() });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.equal(result.value.spellAttackBonus, testCase.expectedUnified);
  });

  test('percepcao-passiva-convergente: via getSkillProjection', () => {
    const testCase = caseById('percepcao-passiva-convergente');
    const character = projectLegacyCharacterForQueries(testCase.personagem, ctx);
    assert.equal(character.ok, true);
    const result = getSkillProjection(character.value, 'dnd2024:skill:percepcao');
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.equal(result.value.passive, testCase.expectedUnified);
  });

  test('intuicao-passiva-convergente: via getSkillProjection', () => {
    const testCase = caseById('intuicao-passiva-convergente');
    const character = projectLegacyCharacterForQueries(testCase.personagem, ctx);
    assert.equal(character.ok, true);
    const result = getSkillProjection(character.value, 'dnd2024:skill:intuicao');
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.equal(result.value.passive, testCase.expectedUnified);
  });

  test('carga-somente-na-tela: capacidade de carga via getMovement (com registry real — fix round 1, I1/I3)', () => {
    const testCase = caseById('carga-somente-na-tela');
    const character = projectLegacyCharacterForQueries(testCase.personagem, ctx);
    assert.equal(character.ok, true);
    // Passa o registry real (não o modo "sem catálogo"): prova que a
    // capacidade de carga bate com o oráculo mesmo quando o lookup de
    // espécie/efeitos está ativo, não só no caminho de fallback.
    const result = getMovement(character.value, { registry: makeFakeRegistry() });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.equal(result.value.carryingCapacity, testCase.expectedUnified);
  });

  test('deslocamento-convergente: deslocamento base via getMovement', () => {
    const testCase = caseById('deslocamento-convergente');
    const character = projectLegacyCharacterForQueries(testCase.personagem, ctx);
    assert.equal(character.ok, true);
    const result = getMovement(character.value, { registry: makeFakeRegistry() });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    const expectedMeters = Number.parseFloat(String(testCase.expectedUnified).match(/[\d.,]+/)[0].replace(',', '.'));
    assert.equal(result.value.base, expectedMeters);
  });

  // fix round 1, achado I3: o teste acima usa Humano (9m), que COINCIDE com
  // o fallback padrão de `movement.js` — não prova que o lookup de espécie
  // via catálogo realmente roda. Este teste troca a espécie do MESMO
  // personagem oráculo para Golias (10,5m, sem correspondência com nenhum
  // fallback hardcoded) e confirma que o valor muda de acordo.
  test('deslocamento com espécie diferente (Golias, 10,5m) prova que o lookup do catálogo roda de verdade', () => {
    const testCase = caseById('deslocamento-convergente');
    const rawComGolias = { ...testCase.personagem, especie: 'Golias' };
    const character = projectLegacyCharacterForQueries(rawComGolias, ctx);
    assert.equal(character.ok, true);
    assert.equal(character.value.build.speciesRef?.id, 'dnd2024:species:golias');
    const result = getMovement(character.value, { registry: makeFakeRegistry() });
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.equal(result.value.base, 10.5);
  });

  // fix round 1, achado I5: `derived-values.json` não tinha nenhum caso de
  // resistências (o checklist do brief cita "resistências" explicitamente).
  // `expectedUnified` segue a convenção escalar do resto da fixture (nome de
  // exibição em português, igual ao que screen/print/pdf mostram — política
  // "bate com screen" imposta por tests/contract/baseline-fixtures.test.js);
  // este teste confere, à parte, que `getDefenses` resolve para o MESMO
  // dano representado como ContentId (`aliasResolver.reverseResolve` faz a
  // ponte de volta ao nome de exibição para a comparação final).
  test('resistencias-convergente: resistências a dano via getDefenses (mesmo dano que expectedUnified, como ContentId)', () => {
    const testCase = caseById('resistencias-convergente');
    const character = projectLegacyCharacterForQueries(testCase.personagem, ctx);
    assert.equal(character.ok, true);
    const result = getDefenses(character.value);
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.equal(result.value.resistances.length, 1);
    const [resistanceId] = result.value.resistances;
    assert.equal(ctx.aliasResolver.reverseResolve(resistanceId), testCase.expectedUnified);
  });
});
