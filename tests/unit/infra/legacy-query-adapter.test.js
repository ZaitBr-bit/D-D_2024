// Testes de `infra/character/legacy-query-adapter` (Task 16): o adapter
// projeta um registro legado bruto para o personagem canônico consumido
// pelas consultas de `domain/character/queries/*`, implementado POR CIMA de
// `decodeCharacterRecord` (Task 12) — nunca reimplementando normalização de
// campo legado. Por isso a checagem central é deep-equal contra
// `decodeCharacterRecord(...).character` para TODA fixture legada da Task 2
// (fix round 1, achado I2), incluindo `legacy-unknown-fields.json` (campos
// desconhecidos preservados) e a grafia real de PV temporário
// (`pv_temporario` — `pv_temp` nunca é um campo gravado por nenhuma versão
// do app, é só o nome do bug de LEITURA documentado em
// `tests/fixtures/expected/derived-values.json#pv-temporario-divergente`,
// corrigido por `getHitPointProjection`, não uma fixture de dado a
// decodificar).

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLegacyAliasResolver } from '../../../site/js/infra/character/legacy-alias-resolver.js';
import { decodeCharacterRecord } from '../../../site/js/infra/character/character-codec.js';
import {
  projectLegacyCharacterForQueries,
  deriveLegacyQueryHints,
} from '../../../site/js/infra/character/legacy-query-adapter.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const fixturesDir = path.join(repoRoot, 'tests/fixtures/characters');
const NOW = '2026-07-30T00:00:00.000Z';

let ctx;

// Todas as 13 fixtures legadas de `tests/fixtures/characters/*.json` (Task 2)
// que representam um REGISTRO DE PERSONAGEM (não um catálogo de campos como
// `baseline-field-inventory.json`, nem um registro de schema futuro como
// `future-v3.json`, nem um registro já v2 como `v2-*.json`). Cada uma expõe
// o registro bruto em `personagem` (fixtures "de valor") OU em
// `personagemAntes` (fixtures de migração — Task 12 — cujo "antes" também é
// um registro legado válido e igualmente sujeito à propriedade
// adapter === decodeCharacterRecord().character).
//
// EXCLUÍDA por motivo técnico real (não omissão): `legacy-migration-stages`
// — seus `personagemAntes` são recortes PARCIAIS propositais (sem `id` nem
// os demais campos obrigatórios do registro completo; ex.:
// `migracao-moedas-legado` só tem o campo `moedas`), desenhados para testar
// uma função de migração isolada com `executavelIsoladamente`, não um
// registro decodificável de ponta a ponta — `decodeCharacterRecord` rejeita
// todos eles com `SCHEMA_CHARACTERCANONICALV2_REQUIRED` (falta `id`), o que
// não é um bug do adapter, é a fixture cumprindo seu propósito de outro
// conjunto de testes (Task 12).
const FIXTURE_NAMES = [
  'legacy-minimal',
  'legacy-all-fields',
  'legacy-unknown-fields',
  'legacy-known-casters',
  'legacy-prepared-casters',
  'legacy-edicoes',
  'legacy-all-classes',
  'legacy-custom-spells-items',
  'legacy-po',
  'legacy-resources-edits',
];
let fixtures = {};

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  ctx = { aliasResolver: createLegacyAliasResolver(aliases), now: NOW };

  for (const name of FIXTURE_NAMES) {
    fixtures[name] = JSON.parse(await readFile(path.join(fixturesDir, `${name}.json`), 'utf8'));
  }
});

/**
 * Extrai o registro bruto de um caso de fixture — `personagem` (fixtures de
 * valor) ou `personagemAntes` (fixtures de migração, Task 12); ambos são
 * registros legados válidos para o propósito deste teste (comparar
 * adapter/codec sobre o MESMO registro bruto).
 * @param {object} testCase
 * @returns {object}
 */
function rawRecordOf(testCase) {
  return testCase.personagem ?? testCase.personagemAntes;
}

/**
 * `legacy-known-casters#conhecidas-bardo` tem uma subclasse ("Colégio do
 * Saber")/`legacy-all-fields` tem uma subclasse ("Cavaleiro Arcano") sem
 * alias exato no pacote dnd2024 atual — mesmo gap que
 * `tests/unit/character/character-codec.test.js` contorna zerando
 * `subclasse` antes de decodificar. O que está sob teste aqui é a
 * equivalência adapter/codec, não a cobertura de alias de subclasse (uma
 * responsabilidade da Task 2/12, já coberta pelos testes de contrato do
 * pacote de conteúdo).
 * @param {object} raw
 * @returns {{ok: true, value: object} | {ok: false, error: object}}
 */
function decodeWithSubclassAliasFallback(raw) {
  const first = decodeCharacterRecord(raw, ctx);
  if (first.ok) {
    return { raw, decoded: first };
  }
  if (first.error?.code === 'CHARACTER_LEGACY_ALIAS_NOT_FOUND') {
    const issues = first.error.context?.issues ?? [];
    if (issues.some((issue) => issue.field === 'subclasse')) {
      const fallbackRaw = { ...raw, subclasse: '' };
      return { raw: fallbackRaw, decoded: decodeCharacterRecord(fallbackRaw, ctx) };
    }
  }
  return { raw, decoded: first };
}

describe('infra/character/legacy-query-adapter — projectLegacyCharacterForQueries', () => {
  for (const name of FIXTURE_NAMES) {
    test(`é deep-equal a decodeCharacterRecord(...).character para cada caso de "${name}"`, () => {
      assert.ok(fixtures[name].cases.length > 0, `fixture "${name}" não tem casos`);
      for (const testCase of fixtures[name].cases) {
        const { raw, decoded } = decodeWithSubclassAliasFallback(rawRecordOf(testCase));
        assert.equal(decoded.ok, true, `decode falhou para "${name}#${testCase.id}": ${JSON.stringify(decoded.error ?? null)}`);
        assert.equal(decoded.value.mode, 'editable', `caso "${name}#${testCase.id}" não decodificou em modo editável`);

        const projected = projectLegacyCharacterForQueries(raw, ctx);
        assert.equal(projected.ok, true, `adapter falhou para "${name}#${testCase.id}": ${JSON.stringify(projected.error ?? null)}`);
        assert.deepStrictEqual(projected.value, decoded.value.character, `divergência para o caso "${name}#${testCase.id}"`);
      }
    });
  }

  test('não muta o registro bruto recebido', () => {
    const raw = { ...fixtures['legacy-all-fields'].cases[0].personagem, subclasse: '' };
    const snapshot = JSON.parse(JSON.stringify(raw));
    const result = projectLegacyCharacterForQueries(raw, ctx);
    assert.equal(result.ok, true);
    assert.deepStrictEqual(raw, snapshot, 'o adapter mutou o registro bruto de entrada');
  });

  test('rejeita registro de schema futuro (não tem personagem canônico consultável)', () => {
    const future = { id: 'future-1', _schema: { version: 999 } };
    const result = projectLegacyCharacterForQueries(future, ctx);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_LEGACY_QUERY_UNSUPPORTED_SCHEMA');
  });
});

describe('infra/character/legacy-query-adapter — deriveLegacyQueryHints', () => {
  test('lê pv_max diretamente do registro bruto quando presente e numérico', () => {
    const hints = deriveLegacyQueryHints({ pv_max: 38 });
    assert.deepStrictEqual(hints, { maximumHitPoints: 38 });
  });

  test('devolve null quando pv_max está ausente ou não é numérico', () => {
    assert.deepStrictEqual(deriveLegacyQueryHints({}), { maximumHitPoints: null });
    assert.deepStrictEqual(deriveLegacyQueryHints({ pv_max: '38' }), { maximumHitPoints: null });
    assert.deepStrictEqual(deriveLegacyQueryHints(null), { maximumHitPoints: null });
  });

  test('lê pv_temporario (grafia real usada por store.js) através do fluxo completo decode -> getHitPointProjection', async () => {
    const { getHitPointProjection } = await import('../../../site/js/domain/character/queries/index.js');
    const raw = { ...fixtures['legacy-minimal'].cases[0].personagem, pv_atual: 5, pv_temporario: 6, pv_max: 20 };
    const projected = projectLegacyCharacterForQueries(raw, ctx);
    assert.equal(projected.ok, true);
    const hints = deriveLegacyQueryHints(raw);
    const result = getHitPointProjection(projected.value, { maximumHitPoints: hints.maximumHitPoints });
    assert.equal(result.ok, true);
    assert.equal(result.value.temporary, 6);
  });

  test('não muta o registro bruto recebido', () => {
    const raw = { pv_max: 10, outro: 'x' };
    const snapshot = { ...raw };
    deriveLegacyQueryHints(raw);
    assert.deepStrictEqual(raw, snapshot);
  });
});
