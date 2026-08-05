import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLegacyAliasResolver } from '../../../site/js/infra/character/legacy-alias-resolver.js';
import { migrateV1ToV2 } from '../../../site/js/infra/character/migrations/v1-to-v2.js';
import { detectCharacterRecordVersion, migrateCharacterRecord } from '../../../site/js/infra/character/migration-runner.js';
import { validateCanonicalCharacter } from '../../../site/js/domain/character/validation.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const fixturesDir = path.join(repoRoot, 'tests/fixtures/characters');
const NOW = '2026-07-30T00:00:00.000Z';

let resolver;
let fixtures = {};

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  resolver = createLegacyAliasResolver(aliases);

  for (const name of [
    'legacy-minimal',
    'legacy-all-fields',
    'legacy-po',
    'legacy-edicoes',
    'future-v3',
    'baseline-field-inventory',
    'legacy-migration-stages',
  ]) {
    fixtures[name] = JSON.parse(await readFile(path.join(fixturesDir, `${name}.json`), 'utf8'));
  }
});

/**
 * @param {string} id
 * @returns {object} personagemAntes do caso `legacy-migration-stages.json#id`.
 */
function migrationStageBefore(id) {
  const testCase = fixtures['legacy-migration-stages'].cases.find((c) => c.id === id);
  if (!testCase) {
    throw new Error(`Caso "${id}" não encontrado em legacy-migration-stages.json`);
  }
  return { id: 'char-1', nome: 'Teste', atualizado_em: NOW, ...testCase.personagemAntes };
}

describe('infra/character/migration-runner — detectCharacterRecordVersion', () => {
  test('registro sem "_schema" é detectado como legado (v1)', () => {
    const result = detectCharacterRecordVersion(fixtures['legacy-minimal'].cases[0].personagem);
    assert.deepEqual(result, { ok: true, value: { kind: 'legacy', version: 1 } });
  });

  test('registro com "_schema.version": 2 é detectado como atual', () => {
    const result = detectCharacterRecordVersion({ _schema: { version: 2 }, id: 'x', nome: 'x', atualizado_em: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.value.kind, 'current');
  });

  test('schema futuro (fixture da Task 2) é detectado como "future"', () => {
    const doc = fixtures['future-v3'].cases[0].documento;
    const result = detectCharacterRecordVersion({ _schema: { version: doc.schemaVersion } });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, { kind: 'future', version: 3 });
  });

  test('objeto inválido (não-objeto) devolve erro', () => {
    assert.equal(detectCharacterRecordVersion(null).ok, false);
    assert.equal(detectCharacterRecordVersion('x').ok, false);
    assert.equal(detectCharacterRecordVersion(42).ok, false);
  });

  test('_schema presente mas malformado devolve erro', () => {
    assert.equal(detectCharacterRecordVersion({ _schema: 'nope' }).ok, false);
    assert.equal(detectCharacterRecordVersion({ _schema: {} }).ok, false);
  });
});

describe('infra/character/migrations/v1-to-v2 — migração pura e idempotente', () => {
  test('migra o fixture mínimo (personagem recém-criado) para um canônico válido', () => {
    const raw = fixtures['legacy-minimal'].cases[0].personagem;
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    const validation = validateCanonicalCharacter(result.value.character);
    assert.deepEqual(validation.errors, []);
  });

  test('é pura: não muta o registro bruto recebido', () => {
    const raw = JSON.parse(JSON.stringify(fixtures['legacy-minimal'].cases[0].personagem));
    const snapshot = JSON.parse(JSON.stringify(raw));
    migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.deepEqual(raw, snapshot);
  });

  test('é determinística: migrar duas vezes o mesmo registro produz personagens deep-equal (exceto identidade de objeto)', () => {
    const raw = fixtures['legacy-minimal'].cases[0].personagem;
    const first = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    const second = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.deepEqual(first.value.character, second.value.character);
  });

  test('não altera "atualizado_em": metadata.updatedAt reflete o timestamp original do registro', () => {
    const raw = fixtures['legacy-all-fields'].cases[0].personagem;
    const result = migrateV1ToV2({ ...raw, subclasse: '' }, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.value.character.metadata.updatedAt, raw.atualizado_em);
  });

  test('classe/subclasse/espécie/antecedente com alias exato resolvem para ContentRef com id estável', () => {
    const raw = { ...fixtures['legacy-all-fields'].cases[0].personagem, subclasse: '' };
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.character.build.classRef, { id: 'dnd2024:class:guerreiro', packageVersion: '1.0.0' });
    assert.deepEqual(result.value.character.build.speciesRef, { id: 'dnd2024:species:humano', packageVersion: '1.0.0' });
    assert.deepEqual(result.value.character.build.backgroundRef, { id: 'dnd2024:background:soldado', packageVersion: '1.0.0' });
  });

  test('nome legado sem alias exato devolve CHARACTER_LEGACY_ALIAS_NOT_FOUND (nunca escolhe silenciosamente)', () => {
    // "Cavaleiro Arcano" não existe nem no monólito legado (grep em
    // site/js/dados-classes.js não encontra a string) nem no pacote
    // dnd2024 (a subclasse de Guerreiro equivalente é "Cavaleiro
    // Místico") — é um caso genuinamente sem alias, não um bug do
    // resolver.
    const raw = fixtures['legacy-all-fields'].cases[0].personagem;
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_LEGACY_ALIAS_NOT_FOUND');
    assert.equal(result.error.context.issues[0].field, 'subclasse');
  });

  test('classe/espécie/antecedente vazios ("" — nenhuma escolha feita) viram null, não erro', () => {
    const raw = fixtures['legacy-minimal'].cases[0].personagem;
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.value.character.build.classRef, null);
    assert.equal(result.value.character.build.speciesRef, null);
    assert.equal(result.value.character.build.backgroundRef, null);
  });
});

describe('infra/character/migrations/v1-to-v2 — normalização de moedas (legacy-po fixture)', () => {
  test('registro só com "po" (sem "moedas") normaliza para carteira completa', () => {
    const raw = fixtures['legacy-po'].cases[0].personagemAntes;
    const result = migrateV1ToV2({ ...requiredMinimalFields(raw), po: raw.po }, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.character.state.wallet, { pc: 0, pp: 0, pe: 0, po: 120, pl: 0 });
  });

  test('registro com "moedas" parcial (strings numéricas) normaliza e ignora "po" residual', () => {
    const raw = fixtures['legacy-po'].cases[1].personagemAntes;
    const result = migrateV1ToV2(
      { ...requiredMinimalFields(raw), moedas: raw.moedas, po: raw.po },
      { aliasResolver: resolver, now: NOW },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.character.state.wallet, { pc: 0, pp: 3, pe: 0, po: 10, pl: 0 });
  });

  test('migração da carteira é idempotente (já migrado não muda)', () => {
    const raw = fixtures['legacy-po'].cases[2].personagemAntes;
    const result = migrateV1ToV2({ ...requiredMinimalFields(raw), moedas: raw.moedas }, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.character.state.wallet, raw.moedas);
  });
});

describe('infra/character/migrations/v1-to-v2 — edições (edicoes) viram override de PV máximo', () => {
  test('edicoes.campos.pv_max vira override hp.maximum preservando original/data', () => {
    const raw = fixtures['legacy-edicoes'].cases[0].personagemDepois;
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    const override = result.value.character.overrides['hp.maximum'];
    assert.equal(override.value, 25);
    assert.equal(override.original, 20);
    assert.equal(override.editedAt, '2026-07-15T10:00:00.000Z');
    assert.equal(override.source, 'manual');
  });

  test('edicoes sem entrada de pv_max não produz override', () => {
    const raw = fixtures['legacy-edicoes'].cases[0].personagemAntes;
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.character.overrides, {});
  });
});

describe('infra/character/migration-runner — schema futuro fica somente leitura', () => {
  test('migrateCharacterRecord devolve {mode:"read-only", rawRecord, detectedVersion} para schema > 2, sem normalizar', () => {
    const rawRecord = { _schema: { version: 3 }, algumCampoNovo: true };
    const result = migrateCharacterRecord(rawRecord, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, { mode: 'read-only', rawRecord, detectedVersion: 3 });
  });
});

// Achado do review independente: build.choices, build.maneuverRefs,
// state.resources, state.spells.spellbook, state.spells.slots e
// state.usageFlags estavam hardcoded vazios — corrigido em
// migrations/v1-to-v2.js e coberto abaixo contra os casos REAIS de
// legacy-migration-stages.json (cada um documenta uma sub-migração
// específica do monólito, extraída do código real de site/js/pages/sheet.js).
describe('infra/character/migrations/v1-to-v2 — campos antes hardcoded vazios (legacy-migration-stages fixture)', () => {
  test('Adestrar Animais (regra 2014) resolve para o mesmo ContentId que Lidar com Animais (2024), via alias já existente', () => {
    const raw = migrationStageBefore('migracao-nome-pericia-lidar-animais');
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.character.build.legacyGrants.skillProficiencyIds.sort(), [
      'dnd2024:skill:lidar-com-animais',
      'dnd2024:skill:percepcao',
    ]);
    assert.deepEqual(result.value.character.build.legacyGrants.skillExpertiseIds, ['dnd2024:skill:lidar-com-animais']);
  });

  test('talento_versatil (Humano) é incluído em build.featRefs mesmo quando "talentos" ainda não o contém', () => {
    const raw = migrationStageBefore('migracao-talento-versatil-humano');
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual(
      result.value.character.build.featRefs.map((r) => r.id),
      ['dnd2024:feat:sortudo'],
    );
  });

  test('pericia_especie (formato legado, string única) é incluída em legacyGrants.skillProficiencyIds', () => {
    const raw = migrationStageBefore('migracao-pericia-especie');
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.character.build.legacyGrants.skillProficiencyIds, ['dnd2024:skill:percepcao']);
  });

  test('pericias_especie (formato array, ex.: Kenku) é mesclado em legacyGrants.skillProficiencyIds', () => {
    const raw = migrationStageBefore('migracao-pericias-especie-array');
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.character.build.legacyGrants.skillProficiencyIds.sort(), [
      'dnd2024:skill:enganacao',
      'dnd2024:skill:intuicao',
    ]);
  });

  test('escolhas_talento (perícias filtradas da lista fixa) são mescladas em legacyGrants.skillProficiencyIds', () => {
    const raw = migrationStageBefore('migracao-pericias-talentos');
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    // "Kit de Ferreiro" não é nome de perícia — filtrado, só "Percepção" entra.
    assert.deepEqual(result.value.character.build.legacyGrants.skillProficiencyIds, ['dnd2024:skill:percepcao']);
  });

  test('escolhas_classe.especialista/academico viram legacyGrants.skillExpertiseIds (build.choices)', () => {
    const raw = migrationStageBefore('migracao-escolhas-classe-legadas');
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.character.build.legacyGrants.skillExpertiseIds, ['dnd2024:skill:furtividade']);
  });

  test('adepto_elemental_tipo (legado, string única) vira build.choices["talento:adepto-elemental"]', () => {
    const raw = migrationStageBefore('migracao-adepto-elemental-tipos');
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.character.build.choices['talento:adepto-elemental'], ['dnd2024:damage-type:fogo']);
  });

  test('origem de magia (site/js/regras-cobertura.js) vira sourceInstanceId determinístico — truque de espécie', () => {
    // migrarTruquesEspecie (função privada não executável isoladamente) é
    // o que ADICIONA o campo `origem` — usamos o estado "depois" documentado
    // pelo fixture (personagemDepoisParcial) como a entrada real, e provamos
    // que ESTA migração (v1->v2) preserva esse `origem` como sourceInstanceId
    // corretamente, sem precisar reimplementar a lógica de concessão.
    const testCase = fixtures['legacy-migration-stages'].cases.find((c) => c.id === 'migracao-truques-especie');
    const raw = { id: 'char-1', nome: 'x', atualizado_em: NOW, magias_conhecidas: testCase.personagemDepoisParcial.magias_conhecidas };
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    const [truque] = result.value.character.state.spells.known;
    assert.equal(truque.sourceInstanceId, 'legacy:spell-origin:especie');
  });

  test('origem de magia — magia de domínio de subclasse', () => {
    const testCase = fixtures['legacy-migration-stages'].cases.find((c) => c.id === 'migracao-magias-dominio');
    const raw = { id: 'char-1', nome: 'x', atualizado_em: NOW, magias_preparadas: testCase.personagemDepoisParcial.magias_preparadas };
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    const dominio = result.value.character.state.spells.prepared.find((s) => s.customDefinition?.nome === 'Abençoar');
    assert.equal(dominio.sourceInstanceId, 'legacy:spell-origin:dominio');
    const semOrigem = result.value.character.state.spells.prepared.find((s) => s.customDefinition?.nome === 'Chama Sagrada');
    assert.equal(semOrigem.sourceInstanceId, null);
  });

  test('magias_preparadas vazio (estado "antes" de migracao-magias-legado-especie) migra para array vazio, sem erro', () => {
    // migrarMagiasLegadoEspecie (função privada, não executável isoladamente
    // — ver descrição do fixture) é o que POPULARIA a magia de legado; esta
    // migração só precisa não quebrar/perder dado no estado "antes" dela.
    const raw = migrationStageBefore('migracao-magias-legado-especie');
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.character.state.spells.prepared, []);
  });

  test('grimório (raw.grimorio) é mapeado para state.spells.spellbook', () => {
    const raw = { id: 'char-1', nome: 'x', atualizado_em: NOW, grimorio: [{ nome: 'Mísseis Mágicos', circulo: 1 }] };
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.value.character.state.spells.spellbook.length, 1);
    assert.equal(result.value.character.state.spells.spellbook[0].spellRef?.id, 'dnd2024:spell:misseis-magicos');
  });

  test('espacos_magia (usados/total) é mapeado para state.spells.slots (só "used", "total" é derivado)', () => {
    const raw = { id: 'char-1', nome: 'x', atualizado_em: NOW, espacos_magia: { 1: { usados: 2, total: 4 } } };
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.character.state.spells.slots, { 1: { used: 2, extra: 0 } });
  });

  test('espacos_magia_extras (slots extras concedidos, ex.: Fonte de Magia) vira slots[circulo].extra', () => {
    // Achado do 2º review independente: campo antes só sobrevivia via
    // extensions.legacyPassthrough, sem estrutura canônica — corrigido.
    const raw = {
      id: 'char-1',
      nome: 'x',
      atualizado_em: NOW,
      espacos_magia: { 1: { usados: 2, total: 4 } },
      espacos_magia_extras: { 1: 1, 2: 2 },
    };
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.character.state.spells.slots, {
      1: { used: 2, extra: 1 },
      2: { used: 0, extra: 2 }, // círculo só com extra, sem entrada em espacos_magia, ainda ganha slot.
    });
  });

  test('_slots_magia_livre (vagas de magia conhecida liberadas) vira state.spells.freeKnownSlots', () => {
    const raw = { id: 'char-1', nome: 'x', atualizado_em: NOW, _slots_magia_livre: 3 };
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.value.character.state.spells.freeKnownSlots, 3);
  });

  test('recursos.talentos.<nome> de forma {usado:boolean} vira state.resources com current 0/1', () => {
    const raw = {
      id: 'char-1',
      nome: 'x',
      atualizado_em: NOW,
      recursos: { talentos: { dadiva_destino: { usado: false } } },
    };
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.character.state.resources, {
      'dnd2024:resource:dadiva-destino': { current: 1, sourceInstanceId: 'legacy:resources:talentos:dadiva-destino' },
    });
  });

  test('talentos_flags (mapa nome->boolean) é copiado diretamente para state.usageFlags', () => {
    const raw = { id: 'char-1', nome: 'x', atualizado_em: NOW, talentos_flags: { versatil_escolhido: true } };
    const result = migrateV1ToV2(raw, { aliasResolver: resolver, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.character.state.usageFlags, { versatil_escolhido: true });
  });
});

/**
 * Extrai um subconjunto mínimo de campos v1 válidos (identity/build
 * básicos) de um fixture de edição pontual da Task 2 (que só popula os
 * campos relevantes ao cenário testado), para poder rodar migrateV1ToV2
 * sem exigir presença de todo o template.
 * @param {object} raw
 * @returns {object}
 */
function requiredMinimalFields(raw) {
  return { id: raw.id, nome: raw.nome, atualizado_em: raw.atualizado_em ?? NOW };
}
