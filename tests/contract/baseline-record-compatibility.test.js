// Contrato: o codec/migração v1->v2 (Task 12) deve continuar compatível
// com os fixtures caracterizados na Task 2 a partir do comportamento real
// do monólito no commit `COMPATIBILITY_BASELINE`. Este teste não repete a
// suíte inteira de tests/unit/character — foca no que é especificamente
// "contrato com o baseline": todo campo do template é conhecido por algum
// lado do codec, o id v1 nunca é trocado por outro esquema, e a versão de
// baseline referenciada pelo código bate com a dos fixtures.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMPATIBILITY_BASELINE } from '../../site/js/domain/character/model.js';
import { createLegacyAliasResolver } from '../../site/js/infra/character/legacy-alias-resolver.js';
import { decodeCharacterRecord, encodeCharacterRecord } from '../../site/js/infra/character/character-codec.js';
import { STRUCTURED_V1_FIELDS } from '../../site/js/infra/character/migrations/v1-to-v2.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const fixturesDir = path.join(repoRoot, 'tests/fixtures/characters');
const NOW = '2026-07-30T00:00:00.000Z';

let resolver;
let ctx;
let fixtureFileNames;
let baselineInventory;
let allFieldsRaw;

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  resolver = createLegacyAliasResolver(aliases);
  ctx = { aliasResolver: resolver, now: NOW };
  fixtureFileNames = (await readdir(fixturesDir)).filter((name) => name.endsWith('.json'));
  baselineInventory = JSON.parse(
    await readFile(path.join(fixturesDir, 'baseline-field-inventory.json'), 'utf8'),
  );
  const allFields = JSON.parse(await readFile(path.join(fixturesDir, 'legacy-all-fields.json'), 'utf8'));
  // "Cavaleiro Arcano" não tem alias exato (ver migration-v1-v2.test.js) —
  // zerado aqui só para que ESTE fixture, usado como amostra de "todos os
  // campos presentes", decodifique com sucesso e permita inspecionar o
  // personagem canônico real produzido.
  allFieldsRaw = { ...allFields.cases[0].personagem, subclasse: '' };
});

describe('contract/baseline-record-compatibility — versão do baseline', () => {
  test('COMPATIBILITY_BASELINE bate com o commit referenciado por todos os fixtures da Task 2', async () => {
    for (const fileName of fixtureFileNames) {
      const content = JSON.parse(await readFile(path.join(fixturesDir, fileName), 'utf8'));
      assert.equal(
        content.compatibilityBaseline,
        COMPATIBILITY_BASELINE,
        `${fileName} referencia um baseline diferente de COMPATIBILITY_BASELINE`,
      );
    }
  });
});

describe('contract/baseline-record-compatibility — cobertura de campo (baseline-field-inventory)', () => {
  test('todo campo do inventário presente no fixture rico é modelado estruturalmente OU aparece em extensions.legacyPassthrough do personagem REAL decodificado', () => {
    // Corrige um achado do review independente: a versão anterior deste
    // teste checava `entry.classificacao !== undefined`, que é verdade
    // para as 89 entradas do inventário — a asserção nunca podia falhar.
    // Esta versão decodifica de verdade um registro com quase todos os
    // campos preenchidos e inspeciona o resultado real.
    const decoded = decodeCharacterRecord(allFieldsRaw, ctx);
    assert.equal(decoded.ok, true);
    const passthroughKeys = new Set(Object.keys(decoded.value.character.extensions.legacyPassthrough));
    const structured = new Set(STRUCTURED_V1_FIELDS);

    const uncovered = [];
    for (const entry of baselineInventory.cases) {
      if (!Object.hasOwn(allFieldsRaw, entry.campo)) {
        continue; // campo não presente neste fixture específico (ex.: "po", campo pré-migração).
      }
      const isCovered = structured.has(entry.campo) || passthroughKeys.has(entry.campo);
      if (!isCovered) {
        uncovered.push(entry.campo);
      }
    }
    assert.deepEqual(uncovered, []);
  });

  test('campos classificados "compatibilityProjection" (ex.: pv_temp) não são gerados pelo encoder (nunca escritos, só lidos por impressão legada)', () => {
    const projectionFields = baselineInventory.cases
      .filter((c) => c.classificacao === 'compatibilityProjection')
      .map((c) => c.campo);
    assert.deepEqual(projectionFields, ['pv_temp']);
    assert.equal(STRUCTURED_V1_FIELDS.includes('pv_temp'), false);
  });
});

describe('contract/baseline-record-compatibility — identidade estável (v2-identity-conflict fixture)', () => {
  test('o id v1 nunca é trocado por outro esquema (ex.: UUID) durante a migração', async () => {
    const fixture = JSON.parse(await readFile(path.join(fixturesDir, 'v2-identity-conflict.json'), 'utf8'));
    const raw = fixture.cases[0].personagemV1Original;
    const decoded = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded.ok, true);
    assert.equal(decoded.value.character.identity.id, raw.id);
    assert.notEqual(decoded.value.character.identity.id, fixture.cases[0].personagemV2ConflitanteProposto.identity.id);
  });
});

// Resultado ESPERADO para cada caso de fixture com um registro completo
// (id + demais campos do template) — corrige um achado do review
// independente: a versão anterior deste teste aceitava tanto sucesso
// quanto qualquer erro com "code" como passagem, o que não prova que
// nenhum fixture da Task 2 de fato decodifica com sucesso. `'ok'` exige
// `decoded.ok === true`; qualquer outra string exige exatamente esse
// AppError.code.
const EXPECTED_OUTCOMES = {
  'legacy-all-classes.json': {
    'classe-barbaro': 'ok',
    'classe-bardo': 'ok',
    'classe-bruxo': 'ok',
    'classe-clerigo': 'ok',
    'classe-druida': 'ok',
    'classe-feiticeiro': 'ok',
    'classe-guardiao': 'ok',
    'classe-guerreiro': 'ok',
    'classe-ladino': 'ok',
    'classe-mago': 'ok',
    'classe-monge': 'ok',
    'classe-paladino': 'ok',
  },
  'legacy-all-fields.json': {
    // "Cavaleiro Arcano" não existe nem no monólito legado nem no pacote
    // dnd2024 (ver migration-v1-v2.test.js) — comportamento esperado, não bug.
    'all-fields-01': 'CHARACTER_LEGACY_ALIAS_NOT_FOUND',
  },
  'legacy-custom-spells-items.json': {
    'itens-customizados-basico': 'ok',
    'magias-customizadas-basico': 'ok',
  },
  'legacy-edicoes.json': {
    'edicao-campo-simples-aplicar': 'ok',
    'edicao-reverter': 'ok',
    'edicao-consolidar-atributos': 'ok',
    'edicao-delta-sistema': 'ok',
  },
  'legacy-known-casters.json': {
    // Ao menos um caster deste fixture referencia uma subclasse/magia sem
    // alias exato — mesma categoria do achado de legacy-all-fields.
    'conhecidas-bardo': 'CHARACTER_LEGACY_ALIAS_NOT_FOUND',
    'conhecidas-feiticeiro': 'ok',
  },
  'legacy-minimal.json': { 'minimal-vazio': 'ok' },
  'legacy-po.json': {
    'po-legado-sem-moedas': 'ok',
    'po-legado-com-moedas-parcial': 'ok',
    'po-migracao-idempotente': 'ok',
  },
  'legacy-prepared-casters.json': {
    'preparadas-clerigo': 'ok',
    'preparadas-mago-com-grimorio': 'ok',
  },
  'legacy-resources-edits.json': {
    'recursos-talentos-descanso-longo': 'ok',
    'recursos-com-edicao-manual': 'ok',
  },
  'legacy-unknown-fields.json': { 'campos-desconhecidos-preservados': 'ok' },
};

describe('contract/baseline-record-compatibility — fixtures de personagem migram (ou falham) exatamente como esperado', () => {
  test('CASOS_ESPERADOS cobre todo fixture legacy-*.json com registro completo (nenhum fixture novo passa despercebido)', async () => {
    const legacyFixtureFiles = fixtureFileNames.filter((name) => name.startsWith('legacy-') && name !== 'legacy-migration-stages.json');
    assert.ok(legacyFixtureFiles.length > 0);
    assert.deepEqual(Object.keys(EXPECTED_OUTCOMES).sort(), legacyFixtureFiles.sort());
  });

  test('cada caso produz exatamente o resultado esperado (sucesso real ou o AppError.code exato)', async () => {
    for (const [fileName, expectedByCaseId] of Object.entries(EXPECTED_OUTCOMES)) {
      const content = JSON.parse(await readFile(path.join(fixturesDir, fileName), 'utf8'));
      for (const [caseId, expected] of Object.entries(expectedByCaseId)) {
        const testCase = content.cases.find((c) => c.id === caseId);
        assert.ok(testCase, `${fileName}: caso "${caseId}" não encontrado no fixture`);
        const raw = testCase.personagem ?? testCase.personagemDepois ?? testCase.personagemAntes;

        let decoded;
        assert.doesNotThrow(() => {
          decoded = decodeCharacterRecord(raw, ctx);
        }, `${fileName}#${caseId} lançou exceção em vez de devolver Result`);

        if (expected === 'ok') {
          assert.equal(decoded.ok, true, `${fileName}#${caseId}: esperava sucesso, obteve ${JSON.stringify(decoded.ok ? null : decoded.error)}`);
          assert.equal(decoded.value.mode, 'editable');
          const encoded = encodeCharacterRecord(decoded.value.character, ctx);
          assert.equal(encoded.ok, true, `${fileName}#${caseId}: encode falhou após decode bem-sucedido`);
        } else {
          assert.equal(decoded.ok, false, `${fileName}#${caseId}: esperava falha "${expected}", obteve sucesso`);
          assert.equal(decoded.error.code, expected, `${fileName}#${caseId}: código de erro inesperado`);
        }
      }
    }
  });
});

describe('contract/baseline-record-compatibility — round-trip determinístico (minimal fixture)', () => {
  test('executar a migração duas vezes produz deep equality', async () => {
    const content = JSON.parse(await readFile(path.join(fixturesDir, 'legacy-minimal.json'), 'utf8'));
    const raw = content.cases[0].personagem;
    const first = decodeCharacterRecord(raw, ctx);
    const second = decodeCharacterRecord(raw, ctx);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.deepEqual(first.value.character, second.value.character);
  });
});

// ---------------------------------------------------------------------------
// `pv_rolagens` — canal reservado do codec v2 para `state.hitPointRolls`
// (Task 23, Decisão A)
// ---------------------------------------------------------------------------
//
// Antes desta task o histórico de PV por nível só existia em memória: o
// `encodeCharacterRecord` não tinha canal para ele, e um personagem que subisse
// de nível pelo domínio PERDIA o histórico ao ser salvo (o
// `getMaximumHitPoints` seguinte falhava com
// PROGRESSION_HIT_POINT_ROLLS_MISSING). Estes casos travam o round-trip real.

describe('contract/baseline-record-compatibility — pv_rolagens (Task 23)', () => {
  test('"pv_rolagens" é chave RESERVADA: legacyPassthrough não pode sobrescrevê-la', async () => {
    const content = JSON.parse(await readFile(path.join(fixturesDir, 'legacy-minimal.json'), 'utf8'));
    const decoded = decodeCharacterRecord(content.cases[0].personagem, ctx);
    assert.equal(decoded.ok, true);
    const comColisao = {
      ...decoded.value.character,
      extensions: {
        ...decoded.value.character.extensions,
        legacyPassthrough: {
          ...(decoded.value.character.extensions?.legacyPassthrough ?? {}),
          pv_rolagens: [{ level: 1, rolled: 99, method: 'roll' }],
        },
      },
    };
    const encoded = encodeCharacterRecord(comColisao, ctx);
    assert.equal(encoded.ok, false);
    assert.equal(encoded.error.code, 'CHARACTER_ENCODE_RESERVED_FIELD_COLLISION');
    assert.equal(encoded.error.context.key, 'pv_rolagens');
  });

  test('registro v1 (sem histórico) NÃO ganha um pv_rolagens inventado', async () => {
    const content = JSON.parse(await readFile(path.join(fixturesDir, 'legacy-minimal.json'), 'utf8'));
    const decoded = decodeCharacterRecord(content.cases[0].personagem, ctx);
    assert.equal(decoded.ok, true);
    // Ausência preservada: nem `[]` (que significaria "zero PV rolado"), nem
    // uma reconstrução plausível a partir de `pv_max`.
    assert.equal(Object.hasOwn(decoded.value.character.state, 'hitPointRolls'), false);
    const encoded = encodeCharacterRecord(decoded.value.character, ctx);
    assert.equal(encoded.ok, true);
    assert.equal(Object.hasOwn(encoded.value, 'pv_rolagens'), false);
  });

  test('histórico presente sobrevive a encode -> decode, entrada por entrada', async () => {
    const content = JSON.parse(await readFile(path.join(fixturesDir, 'legacy-minimal.json'), 'utf8'));
    const decoded = decodeCharacterRecord(content.cases[0].personagem, ctx);
    const historico = [
      { level: 1, rolled: 8, method: 'fixed' },
      { level: 2, rolled: 5, method: 'average' },
      { level: 3, rolled: 7, method: 'roll' },
    ];
    const comHistorico = {
      ...decoded.value.character,
      state: { ...decoded.value.character.state, level: 3, hitPointRolls: historico },
    };
    const encoded = encodeCharacterRecord(comHistorico, ctx);
    assert.equal(encoded.ok, true, JSON.stringify(encoded.error ?? null));
    assert.deepEqual(encoded.value.pv_rolagens, historico);

    const redecoded = decodeCharacterRecord(encoded.value, ctx);
    assert.equal(redecoded.ok, true, JSON.stringify(redecoded.error ?? null));
    assert.deepEqual(redecoded.value.character.state.hitPointRolls, historico);
  });

  test('"rolled: null" (histórico importado incompleto) sobrevive como null, não vira número', async () => {
    const content = JSON.parse(await readFile(path.join(fixturesDir, 'legacy-minimal.json'), 'utf8'));
    const decoded = decodeCharacterRecord(content.cases[0].personagem, ctx);
    const comNull = {
      ...decoded.value.character,
      state: {
        ...decoded.value.character.state,
        hitPointRolls: [{ level: 1, rolled: null, method: 'roll' }],
      },
    };
    const encoded = encodeCharacterRecord(comNull, ctx);
    assert.equal(encoded.ok, true);
    const redecoded = decodeCharacterRecord(encoded.value, ctx);
    assert.equal(redecoded.value.character.state.hitPointRolls[0].rolled, null);
  });
});
