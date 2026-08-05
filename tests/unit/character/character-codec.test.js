import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLegacyAliasResolver } from '../../../site/js/infra/character/legacy-alias-resolver.js';
import { decodeCharacterRecord, encodeCharacterRecord } from '../../../site/js/infra/character/character-codec.js';
import { validatePersistedCharacterRecordV2 } from '../../../site/js/content/validation.js';
import { executeCharacterCommand } from '../../../site/js/domain/commands/command-dispatcher.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const fixturesDir = path.join(repoRoot, 'tests/fixtures/characters');
const NOW = '2026-07-30T00:00:00.000Z';

let resolver;
let ctx;
let fixtures = {};

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  resolver = createLegacyAliasResolver(aliases);
  ctx = { aliasResolver: resolver, now: NOW };

  for (const name of ['legacy-minimal', 'legacy-all-fields']) {
    fixtures[name] = JSON.parse(await readFile(path.join(fixturesDir, `${name}.json`), 'utf8'));
  }
});

describe('infra/character/character-codec — round-trip', () => {
  test('decode -> encode -> decode produz o mesmo personagem canônico (fixture mínimo)', () => {
    const raw = fixtures['legacy-minimal'].cases[0].personagem;
    const decoded1 = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded1.ok, true);
    assert.equal(decoded1.value.mode, 'editable');

    const encoded = encodeCharacterRecord(decoded1.value.character, ctx);
    assert.equal(encoded.ok, true);

    const decoded2 = decodeCharacterRecord(encoded.value, ctx);
    assert.equal(decoded2.ok, true);
    assert.deepEqual(decoded1.value.character, decoded2.value.character);
  });

  test('encode -> decode -> encode produz o mesmo registro plano (fixture rico, exceto o campo com alias inexistente)', () => {
    const raw = { ...fixtures['legacy-all-fields'].cases[0].personagem, subclasse: '' };
    const decoded1 = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded1.ok, true);

    const encoded1 = encodeCharacterRecord(decoded1.value.character, ctx);
    assert.equal(encoded1.ok, true);

    const decoded2 = decodeCharacterRecord(encoded1.value, ctx);
    assert.equal(decoded2.ok, true);
    const encoded2 = encodeCharacterRecord(decoded2.value.character, ctx);
    assert.equal(encoded2.ok, true);

    assert.deepEqual(encoded1.value, encoded2.value);
  });

  test('todo campo conhecido do baseline sobrevive ao round-trip com o MESMO VALOR (fixture rico)', () => {
    // Reforça um teste que antes só checava Object.hasOwn (achado do review
    // independente: presença não prova fidelidade) — agora compara valor.
    // Exceção esperada: coleções de instância (inventário/magias) ganham a
    // chave `instanceId` no primeiro encode (checklist: "instanceId é
    // persistido no primeiro encode v2") — comparadas ignorando essa chave.
    const raw = { ...fixtures['legacy-all-fields'].cases[0].personagem, subclasse: '' };
    const decoded = decodeCharacterRecord(raw, ctx);
    const encoded = encodeCharacterRecord(decoded.value.character, ctx);
    const instanceCollectionFields = new Set(['inventario', 'magias_conhecidas', 'magias_preparadas']);
    for (const key of Object.keys(raw)) {
      if (key === '_slots_magia_livre' && raw[key] === 0) {
        // O baseline deleta este campo ao chegar a 0 em vez de manter `0`
        // (site/js/pages/sheet.js:14723) — replicado no encoder; ausência
        // aqui é o comportamento correto, não uma regressão.
        assert.equal(Object.hasOwn(encoded.value, key), false, 'campo "_slots_magia_livre"=0 deveria ser omitido, não reemitido como 0');
        continue;
      }
      assert.equal(Object.hasOwn(encoded.value, key), true, `campo "${key}" ausente do registro codificado`);
      if (instanceCollectionFields.has(key)) {
        const stripInstanceId = (list) => list.map(({ instanceId, ...rest }) => rest);
        assert.deepEqual(stripInstanceId(encoded.value[key]), stripInstanceId(raw[key]), `campo "${key}" mudou de valor (fora de instanceId) no round-trip`);
        assert.ok(
          encoded.value[key].every((item) => typeof item.instanceId === 'string'),
          `campo "${key}": todo item deveria ganhar instanceId no primeiro encode`,
        );
      } else {
        assert.deepEqual(encoded.value[key], raw[key], `campo "${key}" mudou de valor no round-trip`);
      }
    }
  });

  test('o registro codificado é válido contra o schema persistido v2', () => {
    const raw = fixtures['legacy-minimal'].cases[0].personagem;
    const decoded = decodeCharacterRecord(raw, ctx);
    const encoded = encodeCharacterRecord(decoded.value.character, ctx);
    const validation = validatePersistedCharacterRecordV2(encoded.value);
    assert.deepEqual(validation.errors, []);
    assert.equal(validation.valid, true);
  });

  test('arrays grandes (inventário) existem uma única vez no registro plano codificado (sem duplicação)', () => {
    const raw = { ...fixtures['legacy-all-fields'].cases[0].personagem, subclasse: '' };
    const decoded = decodeCharacterRecord(raw, ctx);
    const encoded = encodeCharacterRecord(decoded.value.character, ctx);
    assert.equal(encoded.value.inventario.length, raw.inventario.length);
    // instanceId determinístico e estável entre migrações repetidas.
    assert.equal(encoded.value.inventario[0].instanceId, 'legacy:inventory:0000:espada-longa');
  });
});

describe('infra/character/character-codec — extensions.legacyPassthrough', () => {
  test('campo desconhecido do baseline (não modelado) é preservado em extensions.legacyPassthrough e volta ao encode', () => {
    const raw = { ...fixtures['legacy-minimal'].cases[0].personagem, campo_legado_preservado: true };
    const decoded = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded.ok, true);
    assert.equal(decoded.value.character.extensions.legacyPassthrough.campo_legado_preservado, true);

    const encoded = encodeCharacterRecord(decoded.value.character, ctx);
    assert.equal(encoded.ok, true);
    assert.equal(encoded.value.campo_legado_preservado, true);
  });

  test('colisão entre passthrough e campo reservado v2 (ex.: "_schema" já presente no bruto) fica somente leitura', () => {
    const raw = { ...fixtures['legacy-minimal'].cases[0].personagem, _schema: 'valor-nao-nosso' };
    const decoded = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded.ok, true);
    assert.equal(decoded.value.mode, 'read-only');
    assert.deepEqual(decoded.value.rawRecord, raw);
  });
});

describe('infra/character/character-codec — _local_sync (fora do personagem canônico)', () => {
  test('_local_sync sobrevive ao round-trip decode -> encode sem tocar a validação canônica', () => {
    const raw = { ...fixtures['legacy-minimal'].cases[0].personagem, _schema: { version: 2 }, _local_sync: { lastMutationId: 'mut-1' } };
    const decoded = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded.ok, true);
    assert.equal(decoded.value.mode, 'editable');
    // Nunca vaza para dentro do personagem canônico (schema fechado na raiz).
    assert.equal(Object.hasOwn(decoded.value.character, '_local_sync'), false);
    assert.equal(Object.hasOwn(decoded.value.character, '__localSync'), false);
    assert.deepEqual(decoded.value.localSync, { lastMutationId: 'mut-1' });

    // encode só reemite _local_sync quando o CHAMADOR passa context.localSync
    // explicitamente (repositório reconciliando outbox) — nunca lido de
    // dentro do personagem.
    const encodedWithout = encodeCharacterRecord(decoded.value.character, ctx);
    assert.equal(encodedWithout.ok, true);
    assert.equal(Object.hasOwn(encodedWithout.value, '_local_sync'), false);

    const encodedWith = encodeCharacterRecord(decoded.value.character, { ...ctx, localSync: decoded.value.localSync });
    assert.equal(encodedWith.ok, true);
    assert.deepEqual(encodedWith.value._local_sync, { lastMutationId: 'mut-1' });
  });

  test('registro sem _local_sync decodifica com localSync: null, e encode não emite o campo', () => {
    const raw = fixtures['legacy-minimal'].cases[0].personagem;
    const decoded = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded.value.localSync, null);
    const encoded = encodeCharacterRecord(decoded.value.character, ctx);
    assert.equal(Object.hasOwn(encoded.value, '_local_sync'), false);
  });
});

describe('infra/character/character-codec — "edicoes" como projeção compatível de "overrides"', () => {
  test('um override de hp.maximum criado no lado canônico é projetado de volta para edicoes.campos.pv_max', () => {
    const raw = fixtures['legacy-minimal'].cases[0].personagem;
    const decoded = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded.ok, true);

    const editedAt = '2026-07-29T00:00:00.000Z';
    const characterWithOverride = {
      ...decoded.value.character,
      overrides: {
        'hp.maximum': { value: 30, original: 20, editedAt, source: 'manual' },
      },
    };
    const encoded = encodeCharacterRecord(characterWithOverride, ctx);
    assert.equal(encoded.ok, true);
    assert.deepEqual(encoded.value.edicoes.campos.pv_max, { original: 20, editadoEm: editedAt, origem: 'manual' });
    assert.equal(encoded.value.pv_max, 30);

    // E volta a decodificar reconhecendo o mesmo override (via o canal
    // reservado "overrides", que prevalece sobre a reconciliação de
    // edicoes/pv_max_override derivada dos campos planos).
    const redecoded = decodeCharacterRecord(encoded.value, ctx);
    assert.equal(redecoded.ok, true);
    assert.deepEqual(redecoded.value.character.overrides['hp.maximum'], {
      value: 30,
      original: 20,
      editedAt,
      source: 'manual',
    });
  });

  test('sem override, uma entrada pv_max pré-existente em edicoes.campos é removida (reflete reversão)', () => {
    const raw = {
      ...fixtures['legacy-minimal'].cases[0].personagem,
      edicoes: { versao: 1, campos: { pv_max: { original: 20, editadoEm: '2026-07-15T00:00:00.000Z', origem: 'manual' } } },
    };
    const decoded = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded.ok, true);
    // decode já reconcilia isso num override...
    assert.ok(decoded.value.character.overrides['hp.maximum']);

    const characterWithoutOverride = { ...decoded.value.character, overrides: {} };
    const encoded = encodeCharacterRecord(characterWithoutOverride, ctx);
    assert.equal(encoded.ok, true);
    assert.equal(Object.hasOwn(encoded.value.edicoes.campos, 'pv_max'), false);
  });
});

describe('infra/character/character-codec — schema futuro', () => {
  test('decodeCharacterRecord devolve somente leitura para schema > 2, sem normalizar/salvar', () => {
    const rawRecord = { _schema: { version: 5 }, campo: 'x' };
    const result = decodeCharacterRecord(rawRecord, ctx);
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, { mode: 'read-only', rawRecord, detectedVersion: 5 });
  });
});

describe('infra/character/character-codec — validação de entrada', () => {
  test('encodeCharacterRecord rejeita um personagem canônico inválido', () => {
    const result = encodeCharacterRecord({ schemaVersion: 2 }, ctx);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_ENCODE_INVALID_INPUT');
  });

  test('encodeCharacterRecord lança TypeError sem aliasResolver', () => {
    const raw = fixtures['legacy-minimal'].cases[0].personagem;
    const decoded = decodeCharacterRecord(raw, ctx);
    assert.throws(() => encodeCharacterRecord(decoded.value.character, {}), TypeError);
  });
});

// Achados do 3º review independente (2 rodadas anteriores de fix report já
// no arquivo). Os 3 testes abaixo cobrem exatamente os 3 achados "Important"
// reabertos: slots extras/vagas de magia livre sem estrutura canônica,
// build.choices write-only (edição do baseline revertida), e
// build.contentScopes nunca persistido (migração de versão de conteúdo
// revertida + ficha inutilizável depois de migrar).
describe('infra/character/character-codec — slots extras/vagas de magia livre (round-trip)', () => {
  test('espacos_magia_extras e _slots_magia_livre sobrevivem ao round-trip via estrutura canônica (não só passthrough)', () => {
    const raw = {
      id: 'char-1',
      nome: 'x',
      atualizado_em: NOW,
      espacos_magia: { 1: { usados: 2, total: 4 } },
      espacos_magia_extras: { 1: 1 },
      _slots_magia_livre: 2,
    };
    const decoded = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded.ok, true);
    assert.deepEqual(decoded.value.character.state.spells.slots, { 1: { used: 2, extra: 1 } });
    assert.equal(decoded.value.character.state.spells.freeKnownSlots, 2);

    const encoded = encodeCharacterRecord(decoded.value.character, ctx);
    assert.equal(encoded.ok, true);
    assert.deepEqual(encoded.value.espacos_magia_extras, { 1: 1 });
    assert.equal(encoded.value._slots_magia_livre, 2);

    // Uma edição no lado canônico (ex.: UI v2 concede mais uma vaga livre)
    // é refletida no encode — não a cópia obsoleta de legacyPassthrough.
    const edited = {
      ...decoded.value.character,
      state: { ...decoded.value.character.state, spells: { ...decoded.value.character.state.spells, freeKnownSlots: 5 } },
    };
    const encodedAfterEdit = encodeCharacterRecord(edited, ctx);
    assert.equal(encodedAfterEdit.value._slots_magia_livre, 5);
  });

  // ------------------------------------------------------------------
  // Achado do CUTOVER (Task 33): `espacos_magia[*].usados` era WRITE-ONLY na
  // direção errada — decodificado (migrations/v1-to-v2.js:588) e nunca
  // codificado de volta. `cast-spell` incrementa `slots[c].used`, e o valor se
  // perdia no reload; depois da correção do descanso longo, a RECUPERAÇÃO
  // também se perdia. Reproduzido em navegador antes da correção.
  // ------------------------------------------------------------------
  test('`usados` conjurado no lado canônico chega ao registro (não fica na cópia obsoleta do passthrough)', () => {
    const raw = { id: 'char-1', nome: 'x', atualizado_em: NOW, espacos_magia: { 1: { usados: 1, total: 4 } } };
    const decoded = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded.ok, true);

    const conjurou = {
      ...decoded.value.character,
      state: {
        ...decoded.value.character.state,
        spells: { ...decoded.value.character.state.spells, slots: { 1: { used: 3, extra: 0 } } },
      },
    };
    const encoded = encodeCharacterRecord(conjurou, ctx);
    assert.equal(encoded.ok, true);
    // `usados` acompanha o canônico; `total` (que é derivado do ruleset) é
    // PRESERVADO, nunca recalculado nem inventado aqui.
    assert.deepEqual(encoded.value.espacos_magia, { 1: { usados: 3, total: 4 } });

    // E o valor volta pelo decode: o round-trip fecha.
    const redecoded = decodeCharacterRecord(encoded.value, ctx);
    assert.equal(redecoded.value.character.state.spells.slots[1].used, 3);
  });

  test('um círculo que só existia por concessão extra e perdeu o extra NÃO vira `{total: 0}` no registro', () => {
    // É a divergência que o caso `descanso-longo-reseta-dados-de-vida-morte-e-pv`
    // do oráculo mede: o baseline não escreve círculo nenhum nessa situação.
    const raw = { id: 'char-1', nome: 'x', atualizado_em: NOW, espacos_magia: {}, espacos_magia_extras: { 1: 2 } };
    const decoded = decodeCharacterRecord(raw, ctx);
    const semExtra = {
      ...decoded.value.character,
      state: {
        ...decoded.value.character.state,
        spells: { ...decoded.value.character.state.spells, slots: { 1: { used: 0, extra: 0 } } },
      },
    };
    const encoded = encodeCharacterRecord(semExtra, ctx);
    assert.deepEqual(encoded.value.espacos_magia, {});
    assert.deepEqual(encoded.value.espacos_magia_extras, {});
  });
});

describe('infra/character/character-codec — build.choices round-trip (não é write-only)', () => {
  test('uma edição do baseline em escolhas_classe sobrevive ao próximo decode (choice_refs obsoleto não a reverte)', () => {
    const raw = {
      id: 'char-1',
      nome: 'x',
      atualizado_em: NOW,
      escolhas_classe: { especialista: ['Furtividade'] },
      escolhas_antecedente: { pericia_extra: 'Atletismo' },
    };
    const decoded1 = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded1.ok, true);
    assert.deepEqual(decoded1.value.character.build.choices, {
      'classe:especialista': ['Furtividade'],
      'antecedente:pericia_extra': ['Atletismo'],
    });

    const encoded1 = encodeCharacterRecord(decoded1.value.character, ctx);
    assert.equal(encoded1.ok, true);
    assert.deepEqual(encoded1.value.escolhas_classe, { especialista: ['Furtividade'] });
    assert.deepEqual(encoded1.value.escolhas_antecedente, { pericia_extra: 'Atletismo' });

    // O baseline (app legado, sem saber nada de choice_refs) edita o campo
    // plano diretamente — cenário real de "o baseline deve continuar
    // lendo/editando o registro".
    const editedByBaseline = {
      ...encoded1.value,
      escolhas_classe: { especialista: ['Furtividade'], academico: ['Arcanismo'] },
    };
    const decoded2 = decodeCharacterRecord(editedByBaseline, ctx);
    assert.equal(decoded2.ok, true);
    assert.deepEqual(decoded2.value.character.build.choices, {
      'classe:especialista': ['Furtividade'],
      'classe:academico': ['Arcanismo'],
      'antecedente:pericia_extra': ['Atletismo'],
    });
  });

  test('Adepto Elemental (build.choices["talento:adepto-elemental"]) projeta de volta para adepto_elemental_tipos', () => {
    const raw = { id: 'char-1', nome: 'x', atualizado_em: NOW, adepto_elemental_tipo: 'Ígneo' };
    const decoded = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded.ok, true);
    assert.deepEqual(decoded.value.character.build.choices['talento:adepto-elemental'], ['dnd2024:damage-type:fogo']);

    const encoded = encodeCharacterRecord(decoded.value.character, ctx);
    assert.equal(encoded.ok, true);
    assert.deepEqual(encoded.value.adepto_elemental_tipos, ['Ígneo']);
    // Campo legado singular não é reemitido (mesmo comportamento de
    // migrarAdeptoElementalTipos no monólito, que o remove).
    assert.equal(Object.hasOwn(encoded.value, 'adepto_elemental_tipo'), false);
  });
});

describe('infra/character/character-codec — build.contentScopes/content_refs sobrevivem a uma migração de versão de conteúdo', () => {
  test('um registro migrado para uma versão de pacote nova continua nessa versão (não reverte) e não fica travado por alias', () => {
    const raw = { id: 'char-1', nome: 'x', classe: 'Guerreiro', atualizado_em: NOW };
    const manifest = {
      version: '1.1.0',
      referenceMigrations: [
        { from: '1.0.0', to: '1.1.0', entities: { 'dnd2024:class:guerreiro': 'dnd2024:class:guerreiro-2' }, choices: {} },
      ],
    };
    const ctxWithManifest = { ...ctx, contentManifests: { dnd2024: { manifest } } };

    const decoded1 = decodeCharacterRecord(raw, ctxWithManifest);
    assert.equal(decoded1.ok, true);
    assert.deepEqual(decoded1.value.character.build.classRef, { id: 'dnd2024:class:guerreiro-2', packageVersion: '1.1.0' });
    assert.deepEqual(decoded1.value.character.build.contentScopes, { dnd2024: { packageVersion: '1.1.0' } });

    const encoded1 = encodeCharacterRecord(decoded1.value.character, ctx);
    assert.equal(encoded1.ok, true);
    assert.deepEqual(encoded1.value.content_scopes, { dnd2024: { packageVersion: '1.1.0' } });
    assert.deepEqual(encoded1.value.content_refs['build.classRef'], { id: 'dnd2024:class:guerreiro-2', packageVersion: '1.1.0' });

    // Próximo load normal, SEM contentManifests (o caso comum — só
    // recarregando a ficha, não migrando de novo) — antes deste fix isso
    // (a) revertia contentScopes para dnd2024@1.0.0 hardcoded e (b) tentava
    // re-resolver "classe" (que ficou "" — sem alias para o id migrado) e
    // acabava com classRef nulo, perdendo a classe da ficha silenciosamente.
    const decoded2 = decodeCharacterRecord(encoded1.value, ctx);
    assert.equal(decoded2.ok, true);
    assert.equal(decoded2.value.mode, 'editable');
    assert.deepEqual(decoded2.value.character.build.classRef, { id: 'dnd2024:class:guerreiro-2', packageVersion: '1.1.0' });
    assert.deepEqual(decoded2.value.character.build.contentScopes, { dnd2024: { packageVersion: '1.1.0' } });

    // E o round-trip continua estável depois disso (idempotente).
    const encoded2 = encodeCharacterRecord(decoded2.value.character, ctx);
    assert.equal(encoded2.ok, true);
    assert.deepEqual(encoded2.value.content_scopes, encoded1.value.content_scopes);
  });

  test('grimório (state.spells.spellbook) e manobras (build.maneuverRefs) também sobrevivem à migração — achado do 4º review (gap no encoder anterior)', () => {
    // Repro exato do achado: content_refs só cobria featRefs/inventory/
    // known/prepared, não spellbook/maneuverRefs — mesmo esses dois campos
    // sendo migrados de versão por migration-runner.js e visitados por
    // visitCharacterContentReferences. Uma ficha de conjurador com
    // grimório se tornava permanentemente ilegível depois de uma única
    // migração de conteúdo real (CHARACTER_CONTENT_REFERENCE_CONFLICT).
    const raw = {
      id: 'char-1',
      nome: 'x',
      atualizado_em: NOW,
      grimorio: [{ nome: 'Mísseis Mágicos', circulo: 1 }],
      manobras_conhecidas: ['Ataque Desarmante'],
    };
    const manifest = {
      version: '1.1.0',
      referenceMigrations: [
        {
          from: '1.0.0',
          to: '1.1.0',
          entities: { 'dnd2024:spell:misseis-magicos': 'dnd2024:spell:misseis-magicos-2' },
          choices: {},
        },
      ],
    };
    const ctxWithManifest = { ...ctx, contentManifests: { dnd2024: { manifest } } };

    const decoded1 = decodeCharacterRecord(raw, ctxWithManifest);
    assert.equal(decoded1.ok, true);
    assert.equal(decoded1.value.character.state.spells.spellbook[0].spellRef.id, 'dnd2024:spell:misseis-magicos-2');
    assert.deepEqual(decoded1.value.character.build.contentScopes, { dnd2024: { packageVersion: '1.1.0' } });

    const encoded1 = encodeCharacterRecord(decoded1.value.character, ctx);
    assert.equal(encoded1.ok, true);
    assert.deepEqual(encoded1.value.content_refs['state.spells.spellbook[0].spellRef'], {
      id: 'dnd2024:spell:misseis-magicos-2',
      packageVersion: '1.1.0',
    });

    // O load normal seguinte (sem contentManifests) não deve mais falhar
    // com CHARACTER_CONTENT_REFERENCE_CONFLICT.
    const decoded2 = decodeCharacterRecord(encoded1.value, ctx);
    assert.equal(decoded2.ok, true);
    assert.equal(decoded2.value.mode, 'editable');
    assert.equal(decoded2.value.character.state.spells.spellbook[0].spellRef.id, 'dnd2024:spell:misseis-magicos-2');
  });
});

describe('infra/character/character-codec — forma de escolhas_classe preservada (array vs. escalar)', () => {
  test('chaves conhecidas como array (especialista/estilo_luta) continuam array mesmo com 1 seleção; chave escalar (dadiva_epica_nivel_19) continua escalar', () => {
    // Achado "Minor" do 4º review: desembrulhar por comprimento (===1 ->
    // escalar) quebraria site/js/pages/creator.js/sheet.js, que sempre leem
    // "especialista"/"academico"/"estilo_luta"/"ordem_divina"/"ordem_primal"
    // com .forEach()/.length/[0] (nunca esperam escalar).
    const raw = {
      id: 'char-1',
      nome: 'x',
      atualizado_em: NOW,
      escolhas_classe: {
        especialista: ['Furtividade'], // 1 seleção — não pode virar escalar
        estilo_luta: ['Defensivo'],
        dadiva_epica_nivel_19: 'Alerta', // escalar de verdade (site/js/levelup.js:256,1406)
      },
    };
    const decoded = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded.ok, true);
    const encoded = encodeCharacterRecord(decoded.value.character, ctx);
    assert.equal(encoded.ok, true);
    assert.deepEqual(encoded.value.escolhas_classe, {
      especialista: ['Furtividade'],
      estilo_luta: ['Defensivo'],
      dadiva_epica_nivel_19: 'Alerta',
    });
  });
});

describe('infra/character/character-codec — magia do CATÁLOGO sem customDefinition (Task 28b)', () => {
  // Uma magia CONCEDIDA por efeito (`apply-grants.js#grant-spell`) nasce com
  // `customDefinition: null` — `apply-grants` é domínio puro e não conhece
  // catálogo. Enquanto todo personagem vinha do formato legado, isso não
  // aparecia: o objeto bruto da magia vinha em `customDefinition`. Com o
  // criador novo criando personagens direto no canônico, a magia chegava ao
  // registro como `{instanceId}` puro — e a ficha legada, que ordena por
  // `nome`, quebrava (`localeCompare` sobre `undefined`).

  /**
   * Personagem canônico mínimo com uma magia só referenciada.
   * @param {string} spellId
   * @returns {object}
   */
  function comMagiaReferenciada(spellId) {
    const base = decodeCharacterRecord(fixtures['legacy-minimal'].cases[0].personagem, ctx);
    assert.equal(base.ok, true);
    const character = base.value.character;
    const entrada = Object.freeze({
      instanceId: 'grant:especie:0000:magia',
      spellRef: Object.freeze({ id: spellId, packageVersion: '1.0.0' }),
      customDefinition: null,
      sourceInstanceId: 'source:species:0000:teste',
    });
    return {
      ...character,
      state: {
        ...character.state,
        spells: { ...character.state.spells, known: [entrada], prepared: [entrada], spellbook: [] },
      },
    };
  }

  test('o NOME é reconstruído pelo alias (mesmo canal de classe/espécie/talento)', () => {
    const encoded = encodeCharacterRecord(comMagiaReferenciada('dnd2024:spell:luz'), ctx);
    assert.equal(encoded.ok, true, encoded.ok ? '' : encoded.error.code);
    assert.equal(encoded.value.magias_conhecidas[0].nome, 'Luz');
    assert.equal(encoded.value.magias_preparadas[0].nome, 'Luz');
  });

  test('sem a porta `spellLevelOf`, o círculo fica AUSENTE — nunca chutado', () => {
    const encoded = encodeCharacterRecord(comMagiaReferenciada('dnd2024:spell:luz'), ctx);
    assert.equal(encoded.ok, true);
    assert.equal(Object.hasOwn(encoded.value.magias_conhecidas[0], 'circulo'), false);
  });

  test('com a porta, o círculo vem do catálogo', () => {
    const encoded = encodeCharacterRecord(comMagiaReferenciada('dnd2024:spell:luz'), {
      ...ctx,
      spellLevelOf: (id) => (id === 'dnd2024:spell:luz' ? 0 : null),
    });
    assert.equal(encoded.ok, true);
    assert.equal(encoded.value.magias_conhecidas[0].circulo, 0);
  });

  test('o que JÁ vem em customDefinition vence a reconstrução', () => {
    const character = comMagiaReferenciada('dnd2024:spell:luz');
    const entrada = { ...character.state.spells.known[0], customDefinition: { nome: 'Nome Guardado', circulo: 3 } };
    const encoded = encodeCharacterRecord(
      { ...character, state: { ...character.state, spells: { ...character.state.spells, known: [entrada], prepared: [] } } },
      { ...ctx, spellLevelOf: () => 0 },
    );
    assert.equal(encoded.ok, true);
    assert.equal(encoded.value.magias_conhecidas[0].nome, 'Nome Guardado');
    assert.equal(encoded.value.magias_conhecidas[0].circulo, 3);
  });

  test('o GRIMÓRIO também é projetado (era a única coleção sem escrita de volta)', () => {
    const character = comMagiaReferenciada('dnd2024:spell:luz');
    const entrada = character.state.spells.known[0];
    const encoded = encodeCharacterRecord(
      {
        ...character,
        state: { ...character.state, spells: { ...character.state.spells, known: [], prepared: [], spellbook: [entrada] } },
      },
      { ...ctx, spellLevelOf: () => 0 },
    );
    assert.equal(encoded.ok, true);
    assert.equal(encoded.value.grimorio.length, 1);
    assert.equal(encoded.value.grimorio[0].nome, 'Luz');
  });

  test('grant alwaysPrepared (marcador ":prepared") ganha origem "sempre" no registro — achado do round-trip da Task 37', () => {
    // Uma magia concedida com `alwaysPrepared: true` entra em
    // `state.spells.prepared` com `instanceId` terminado em ":prepared"
    // (apply-grants.js) e sem customDefinition. Sem `origem`, o baseline
    // contava essa magia no LIMITE de preparadas do jogador (magiaContaNoLimite
    // só exclui origens especiais) — "Luz" do Aasimar ocupava uma vaga de
    // Clérigo para sempre. O vocabulário legado exato é `origem: 'sempre'`.
    const character = comMagiaReferenciada('dnd2024:spell:luz');
    const grantPrepared = {
      ...character.state.spells.prepared[0],
      instanceId: 'effect:especie:luz:prepared',
    };
    const encoded = encodeCharacterRecord(
      {
        ...character,
        state: { ...character.state, spells: { ...character.state.spells, prepared: [grantPrepared] } },
      },
      ctx,
    );
    assert.equal(encoded.ok, true, encoded.ok ? '' : encoded.error.code);
    assert.equal(encoded.value.magias_preparadas[0].origem, 'sempre');
    // A coleção `known` NÃO ganha origem inventada.
    assert.equal(Object.hasOwn(encoded.value.magias_conhecidas[0], 'origem'), false);
  });

  test('entrada preparada COMUM (escolhida pelo jogador) continua sem origem', () => {
    const character = comMagiaReferenciada('dnd2024:spell:luz');
    const escolhida = {
      ...character.state.spells.prepared[0],
      instanceId: 'creator:src:prepared:dnd2024:spell:bencao',
    };
    const encoded = encodeCharacterRecord(
      {
        ...character,
        state: { ...character.state, spells: { ...character.state.spells, prepared: [escolhida] } },
      },
      ctx,
    );
    assert.equal(encoded.ok, true);
    assert.equal(Object.hasOwn(encoded.value.magias_preparadas[0], 'origem'), false);
  });

  test('origem vinda do legado em customDefinition NUNCA é sobrescrita', () => {
    const character = comMagiaReferenciada('dnd2024:spell:luz');
    const legada = {
      ...character.state.spells.prepared[0],
      instanceId: 'effect:talento:magia:prepared',
      customDefinition: { nome: 'Luz', circulo: 0, origem: 'iniciado_em_magia' },
    };
    const encoded = encodeCharacterRecord(
      {
        ...character,
        state: { ...character.state, spells: { ...character.state.spells, prepared: [legada] } },
      },
      ctx,
    );
    assert.equal(encoded.ok, true);
    assert.equal(encoded.value.magias_preparadas[0].origem, 'iniciado_em_magia');
  });
});

// ============================================================
// Task 37 (achado do round-trip contra o baseline e43c5ea): o canal
// reservado `overrides` NÃO pode reverter uma edição feita pelo baseline no
// campo plano `pv_max_override` — mesma classe de defeito já corrigida para
// `edicoes` (Addendum 2, achado #3) e `choice_refs`.
// ============================================================
describe('decode: mescla de overrides["hp.maximum"] com o campo plano (Task 37)', () => {
  /** Registro codificado pelo v2 com override de 21 espelhado no flat. */
  function registroComOverride() {
    const raw = { ...fixtures['legacy-minimal'].cases[0].personagem };
    const decoded = decodeCharacterRecord({ ...raw, pv_max_override: 21 }, ctx);
    assert.equal(decoded.ok, true);
    const encoded = encodeCharacterRecord(decoded.value.character, ctx);
    assert.equal(encoded.ok, true);
    assert.equal(encoded.value.pv_max_override, 21);
    assert.equal(encoded.value.overrides['hp.maximum'].value, 21);
    return encoded.value;
  }

  test('edição do BASELINE no flat vence o canal reservado obsoleto', () => {
    const registro = registroComOverride();
    // O baseline muda pv_max_override para 27 sem tocar em `overrides`.
    const editadoPeloBaseline = { ...registro, pv_max_override: 27 };
    const decoded = decodeCharacterRecord(editadoPeloBaseline, ctx);
    assert.equal(decoded.ok, true);
    assert.equal(decoded.value.character.overrides['hp.maximum'].value, 27);
    // E o próximo encode espelha o valor novo, fechando o ciclo.
    const reencoded = encodeCharacterRecord(decoded.value.character, ctx);
    assert.equal(reencoded.ok, true);
    assert.equal(reencoded.value.pv_max_override, 27);
    assert.equal(reencoded.value.overrides['hp.maximum'].value, 27);
  });

  test('"Resetar" do baseline (flat removido) NÃO ressuscita o override reservado', () => {
    const registro = registroComOverride();
    const { pv_max_override, edicoes, ...semFlat } = registro;
    void pv_max_override;
    void edicoes;
    const decoded = decodeCharacterRecord(semFlat, ctx);
    assert.equal(decoded.ok, true);
    assert.equal(decoded.value.character.overrides['hp.maximum'], undefined);
  });

  test('valores iguais: a entrada reservada (metadados da última edição v2) é mantida', () => {
    const registro = registroComOverride();
    const decoded = decodeCharacterRecord(registro, ctx);
    assert.equal(decoded.ok, true);
    assert.deepEqual(decoded.value.character.overrides['hp.maximum'], registro.overrides['hp.maximum']);
  });
});

// ============================================================
// Correção I1 da revisão final: `state.spells.concentration` sobrevive ao
// reload pela chave RESERVADA `concentracao_ativa` — mesma receita do
// write-back de `espacos_magia[*].usados` (Task 33) e de `pv_rolagens`
// (Task 23). Ausência preservada; a forma LEGADA (`concentracao: true` dentro
// de `efeitos_magicos`) NÃO é migrada (decisão registrada como fora de escopo).
// ============================================================
describe('infra/character/character-codec — concentração (correção I1)', () => {
  const ALVO = 'dnd2024:spell:teia';

  /** Personagem canônico decodificado do fixture mínimo, concentrado em ALVO. */
  function personagemConcentrado() {
    const raw = fixtures['legacy-minimal'].cases[0].personagem;
    const decoded = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded.ok, true);
    const character = decoded.value.character;
    return {
      ...character,
      state: { ...character.state, spells: { ...character.state.spells, concentration: ALVO } },
    };
  }

  test('concentrar -> salvar -> recarregar preserva o alvo de concentração', () => {
    const encoded = encodeCharacterRecord(personagemConcentrado(), ctx);
    assert.equal(encoded.ok, true, encoded.error?.message);
    assert.equal(encoded.value.concentracao_ativa, ALVO);

    const decoded = decodeCharacterRecord(encoded.value, ctx);
    assert.equal(decoded.ok, true);
    assert.equal(decoded.value.character.state.spells.concentration, ALVO);
  });

  test('sem concentração, a chave NÃO é emitida e o decode não inventa alvo (ausência preservada)', () => {
    const raw = fixtures['legacy-minimal'].cases[0].personagem;
    const decoded = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded.ok, true);
    assert.equal(decoded.value.character.state.spells.concentration, null);

    const encoded = encodeCharacterRecord(decoded.value.character, ctx);
    assert.equal(encoded.ok, true);
    assert.equal(Object.hasOwn(encoded.value, 'concentracao_ativa'), false);

    const reDecoded = decodeCharacterRecord(encoded.value, ctx);
    assert.equal(reDecoded.ok, true);
    assert.equal(reDecoded.value.character.state.spells.concentration, null);
  });

  test('end-concentration -> salvar -> recarregar NÃO ressuscita a concentração anterior', () => {
    const comConcentracao = personagemConcentrado();
    const encerrado = executeCharacterCommand(comConcentracao, { type: 'end-concentration' }, {});
    assert.equal(encerrado.ok, true, encerrado.error?.code);

    const encoded = encodeCharacterRecord(encerrado.character, ctx);
    assert.equal(encoded.ok, true);
    assert.equal(Object.hasOwn(encoded.value, 'concentracao_ativa'), false);

    const decoded = decodeCharacterRecord(encoded.value, ctx);
    assert.equal(decoded.ok, true);
    assert.equal(decoded.value.character.state.spells.concentration, null);
  });

  test('a forma LEGADA (flag em efeitos_magicos) NÃO vira concentração canônica (fora de escopo, deliberado)', () => {
    const raw = {
      ...fixtures['legacy-minimal'].cases[0].personagem,
      efeitos_magicos: [{ tipo: 'concentracao_generica', concentracao: true, rotulo: 'Concentrando em Teia' }],
    };
    const decoded = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded.ok, true);
    // O array legado é preservado no passthrough; o campo canônico fica null.
    assert.equal(decoded.value.character.state.spells.concentration, null);
    assert.equal(decoded.value.character.extensions.legacyPassthrough.efeitos_magicos.length, 1);
  });
});

// ============================================================
// Correção I2 da revisão final: write-back dos paths `identity.*` da
// allowlist de `edit-character-field` — editar -> salvar -> recarregar
// preserva o texto, e um override obsoleto (baseline editou o campo plano
// depois) é descartado no decode em vez de reverter a edição do baseline.
// ============================================================
describe('infra/character/character-codec — write-back de identity.* (correção I2)', () => {
  const CAMPOS = [
    ['identity.name', 'name', 'nome'],
    ['identity.alignment', 'alignment', 'alinhamento'],
    ['identity.size', 'size', 'tamanho'],
    ['identity.appearance', 'appearance', 'aparencia'],
    ['identity.personality', 'personality', 'personalidade'],
    ['identity.ideals', 'ideals', 'ideais'],
    ['identity.bonds', 'bonds', 'lacos'],
    ['identity.flaws', 'flaws', 'defeitos'],
    ['identity.backstory', 'backstory', 'historia_personagem'],
    ['identity.notes', 'notes', 'notas'],
  ];

  test('para CADA path da allowlist: editar -> salvar -> recarregar preserva valor e override', () => {
    const raw = fixtures['legacy-minimal'].cases[0].personagem;
    const decoded = decodeCharacterRecord(raw, ctx);
    assert.equal(decoded.ok, true);
    let character = decoded.value.character;

    for (const [path] of CAMPOS) {
      const resultado = executeCharacterCommand(character, { type: 'edit-character-field', path, value: `editado ${path}` }, { now: NOW });
      assert.equal(resultado.ok, true, `${path}: ${resultado.error?.code}`);
      character = resultado.character;
    }

    const encoded = encodeCharacterRecord(character, ctx);
    assert.equal(encoded.ok, true, encoded.error?.message);
    for (const [path, , flat] of CAMPOS) {
      assert.equal(encoded.value[flat], `editado ${path}`, `campo plano "${flat}" não recebeu o write-back`);
      assert.equal(encoded.value.overrides[path].value, `editado ${path}`);
    }

    const reloaded = decodeCharacterRecord(encoded.value, ctx);
    assert.equal(reloaded.ok, true);
    for (const [path, field] of CAMPOS) {
      assert.equal(reloaded.value.character.identity[field], `editado ${path}`, `${path} perdeu o valor no reload`);
      // O override sobrevive (value == flat), preservando o `original` para
      // um revert-character-edit futuro.
      assert.equal(reloaded.value.character.overrides[path].value, `editado ${path}`);
    }
  });

  test('override de identidade OBSOLETO (baseline editou o flat depois) é descartado no decode', () => {
    const raw = fixtures['legacy-minimal'].cases[0].personagem;
    const decoded = decodeCharacterRecord(raw, ctx);
    const editado = executeCharacterCommand(
      decoded.value.character,
      { type: 'edit-character-field', path: 'identity.name', value: 'Nome do v2' },
      { now: NOW },
    );
    assert.equal(editado.ok, true);
    const encoded = encodeCharacterRecord(editado.character, ctx);
    assert.equal(encoded.ok, true);

    // O app LEGADO edita `nome` sem conhecer o canal reservado `overrides`.
    const editadoPeloBaseline = { ...encoded.value, nome: 'Nome do baseline' };
    const reDecoded = decodeCharacterRecord(editadoPeloBaseline, ctx);
    assert.equal(reDecoded.ok, true);
    // O flat vence, e o override obsoleto some — um revert aqui restauraria
    // um original de ANTES da edição do baseline (reversão silenciosa).
    assert.equal(reDecoded.value.character.identity.name, 'Nome do baseline');
    assert.equal(Object.hasOwn(reDecoded.value.character.overrides, 'identity.name'), false);
  });
});
