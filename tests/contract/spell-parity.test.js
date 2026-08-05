// Contrato (Task 18): as regras de magia do domínio novo contra o ORÁCULO do
// monólito no commit `COMPATIBILITY_BASELINE`.
//
// Três frentes:
//
//   1. **Automações de magia.** O baseline automatiza ~50 magias através do
//      mapa hardcoded `MAGIAS_EFEITO` (`tests/helpers/legacy-sheet-source.js`,
//      o `site/js/pages/sheet.js` congelado pelo cutover da Task 33). Este teste
//      lê essa lista DIRETO do arquivo legado (nunca de uma cópia colada, que
//      envelheceria em silêncio), resolve cada nome para ContentId pelo mapa
//      de aliases oficial e exige que a magia (a) exista no catálogo `dnd2024`
//      e (b) esteja EXPLICITAMENTE marcada como `manual` por
//      `domain/spells/spell-effects.js#describeSpellAutomation`. Uma automação
//      simplesmente ausente do catálogo seria indistinguível de esquecimento.
//
//   2. **Concentração.** O caso "concentracao-nova-magia-remove-efeitos-da-
//      anterior" de `tests/fixtures/expected/command-transitions.json`
//      (categoria `concentracao`, deixada de fora da Task 17 justamente para
//      esta task) é dirigido pelo ciclo completo `decodeCharacterRecord` ->
//      `executeCharacterCommand` -> `encodeCharacterRecord`, comparando o
//      registro plano resultante com `personagemDepois` — SEM `ignoreKeys`.
//
//   3. **Metamagia.** As dez opções de `OPCOES_METAMAGIA` só existem como
//      constante hardcoded no monólito; o pacote `dnd2024` não tem entidade de
//      opção de metamagia. O teste registra esse gap como asserção (não como
//      prosa num relatório), para que ele quebre no dia em que as entidades
//      forem adicionadas e o canal `context.metamagic` puder ser aposentado.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAppContext } from '../../site/js/app-context.js';
import { createLegacyAliasResolver } from '../../site/js/infra/character/legacy-alias-resolver.js';
import { decodeCharacterRecord, encodeCharacterRecord } from '../../site/js/infra/character/character-codec.js';
import { executeCharacterCommand } from '../../site/js/domain/commands/command-dispatcher.js';
import { describeSpellAutomation } from '../../site/js/domain/spells/index.js';
import { createDiskFetch } from '../helpers/disk-fetch.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

let registry;
let aliasResolver;
let legacySheetSource;
let commandTransitions;

/**
 * Extrai as chaves de um literal de objeto `const <name> = { ... };` do fonte
 * legado. Ler do arquivo real mantém o oráculo vivo: se o monólito ganhar ou
 * perder uma automação, este teste enxerga a mudança.
 * @param {string} source
 * @param {string} declaration - ex.: `const MAGIAS_EFEITO = {`.
 * @returns {string[]}
 */
function extractObjectKeys(source, declaration) {
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `Âncora não encontrada em sheet.js: ${declaration}`);
  const end = source.indexOf('\n};', start);
  assert.notEqual(end, -1, `Fim do literal não encontrado para: ${declaration}`);
  return [...source.slice(start, end).matchAll(/^\s{2}'([^']+)':/gm)].map((match) => match[1]);
}

/**
 * Extrai os nomes das opções de `OPCOES_METAMAGIA` (array de objetos com
 * `nome: '...'`).
 * @param {string} source
 * @returns {string[]}
 */
function extractMetamagicNames(source) {
  const start = source.indexOf('const OPCOES_METAMAGIA = [');
  assert.notEqual(start, -1, 'Âncora OPCOES_METAMAGIA não encontrada em sheet.js.');
  const end = source.indexOf('\n];', start);
  return [...source.slice(start, end).matchAll(/\{\s*nome:\s*'([^']+)'/g)].map((match) => match[1]);
}

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  aliasResolver = createLegacyAliasResolver(aliases);

  const { fetchFn } = createDiskFetch();
  const activation = await createAppContext({ fetchFn }).initializeContent();
  assert.equal(activation.ok, true, `ativação do catálogo dnd2024 falhou: ${JSON.stringify(activation.error ?? null)}`);
  registry = activation.value;

  // ORÁCULO CONGELADO. Até a Task 33 esta leitura apontava para
  // `site/js/pages/sheet.js`, que ERA o monólito. O cutover público substituiu
  // aquele arquivo pelo composition root fino e preservou o monólito em
  // `tests/helpers/legacy-sheet-source.js` — mesmo movimento (e mesmo motivo)
  // da Task 22b com `site/js/db.js`. O que este contrato mede continua sendo o
  // CÓDIGO REAL do baseline, nunca uma transcrição dele.
  legacySheetSource = await readFile(path.join(repoRoot, 'tests/helpers/legacy-sheet-source.js'), 'utf8');
  commandTransitions = JSON.parse(
    await readFile(path.join(repoRoot, 'tests/fixtures/expected/command-transitions.json'), 'utf8'),
  );
});

describe('contrato Task 18 — automações de magia contra o oráculo', () => {
  test('toda magia automatizada pelo baseline existe no catálogo e está explicitamente `manual`', () => {
    const legacyNames = extractObjectKeys(legacySheetSource, 'const MAGIAS_EFEITO = {');
    assert.ok(legacyNames.length >= 50, `Esperava >= 50 automações legadas, li ${legacyNames.length}.`);

    const semAlias = [];
    const semEntidade = [];
    const semManual = [];
    const automatizadasNoCatalogo = [];

    for (const name of legacyNames) {
      const resolved = aliasResolver.resolve(name);
      if (!resolved.ok) {
        semAlias.push(name);
        continue;
      }
      const entity = registry.get(resolved.value);
      if (entity === null || entity.type !== 'spell') {
        semEntidade.push(`${name} -> ${resolved.value}`);
        continue;
      }
      const described = describeSpellAutomation(entity);
      assert.equal(described.ok, true, `describeSpellAutomation falhou para ${resolved.value}`);
      if (described.value.automated) {
        // Uma magia que o catálogo automatiza precisa ser conferida contra o
        // comportamento legado antes de ser considerada paridade — não é o
        // caso hoje (nenhuma é), mas o teste não deve passar em silêncio.
        automatizadasNoCatalogo.push(resolved.value);
        continue;
      }
      if (described.value.manual.length === 0) {
        semManual.push(resolved.value);
      }
    }

    assert.deepEqual(semAlias, [], 'Automações legadas sem alias de conteúdo.');
    assert.deepEqual(semEntidade, [], 'Automações legadas sem entidade de magia no catálogo ativo.');
    assert.deepEqual(
      semManual,
      [],
      'Automações legadas cuja magia no catálogo não declara NENHUM efeito — nem automatizado nem `manual`.',
    );
    assert.deepEqual(
      automatizadasNoCatalogo,
      [],
      'Magias que o catálogo passou a automatizar: a paridade com MAGIAS_EFEITO precisa ser conferida caso a caso.',
    );
  });

  test('nenhuma magia do catálogo declara automação não conferida', () => {
    const automatizadas = registry
      .list('spell')
      .map((entity) => ({ id: entity.id, described: describeSpellAutomation(entity) }))
      .filter((item) => item.described.ok && item.described.value.automated)
      .map((item) => item.id);
    assert.deepEqual(
      automatizadas,
      [],
      'Task 18 caracteriza o catálogo dnd2024 como 100% `manual` para magias; qualquer automação nova precisa de um caso de paridade próprio.',
    );
  });
});

describe('contrato Task 18 — concentração pelo ciclo decode/comando/encode', () => {
  test('nova concentração remove os efeitos mágicos de concentração da anterior', () => {
    const fixture = commandTransitions.cases.find(
      (item) => item.id === 'concentracao-nova-magia-remove-efeitos-da-anterior',
    );
    assert.ok(fixture, 'Caso de concentração ausente em command-transitions.json.');

    const context = { aliasResolver, now: '2026-07-30T00:00:00.000Z' };
    const decoded = decodeCharacterRecord(fixture.personagemAntes, context);
    assert.equal(decoded.ok, true, JSON.stringify(decoded.error ?? null));

    // `operacao.novaMagia` é METADADO DESCRITIVO do oráculo (o nome exibido
    // pelo monólito), não a interface do comando — mesma leitura que a Task 17
    // fez de `operacao.talento`. "Palavra Sagrada de Cura" nem existe como
    // magia do PHB 2024 (o catálogo tem "Palavra Sagrada" e "Palavra
    // Curativa"), então o alias legitimamente não resolve. O comando recebe um
    // ContentId quando há alias e, quando não há, o próprio texto legado —
    // `state.spells.concentration` é `anyOf [string, null]` no schema
    // canônico, exatamente porque o baseline guarda concentração por nome.
    const resolved = aliasResolver.resolve(fixture.operacao.novaMagia);
    const spellId = resolved.ok ? resolved.value : fixture.operacao.novaMagia;

    const result = executeCharacterCommand(decoded.value.character, { type: 'set-concentration', spellId }, context);
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.equal(result.character.state.spells.concentration, spellId);

    const encoded = encodeCharacterRecord(result.character, context);
    assert.equal(encoded.ok, true, JSON.stringify(encoded.error ?? null));

    // Compara TODAS as chaves declaradas pelo fixture v1 — sem `ignoreKeys`.
    // O recorte por chave existe apenas porque o registro v2 carrega canais
    // que o vocabulário do app baseline não tem (`_schema`, `content_refs`,
    // `choice_refs`, ...), exatamente como em
    // `tests/contract/command-transition-parity.test.js`.
    const expected = fixture.personagemDepois;
    const actual = Object.fromEntries(Object.keys(expected).map((key) => [key, encoded.value[key]]));
    assert.deepEqual(actual, expected);
  });
});

describe('contrato Task 18 — conjuração de um personagem REALMENTE migrado', () => {
  test('magia comum de classe (sem `origem` legada) é conjurável pelo ciclo decode -> castSpell', () => {
    // Regressão do achado Important da revisão da Task 18:
    // `infra/character/migrations/v1-to-v2.js:505` grava
    // `sourceInstanceId: null` para TODA magia sem `origem` — a lista de
    // magias de classe inteira de qualquer personagem migrado. Este caso usa
    // o decoder REAL (nenhuma entrada é montada à mão) para provar que essa
    // forma dominante é conjurável, e que a magia concedida por talento
    // continua separada por fonte.
    const base = commandTransitions.cases.find(
      (item) => item.id === 'concentracao-nova-magia-remove-efeitos-da-anterior',
    ).personagemAntes;

    const record = {
      ...base,
      classe: 'Mago',
      // Sem `origem`: é assim que o monólito grava uma magia de classe.
      magias_preparadas: [
        { nome: 'Alarme', circulo: 1 },
        // Com `origem`: vira `legacy:spell-origin:iniciado-em-magia`.
        { nome: 'Enfeitiçar Pessoa', circulo: 1, origem: 'iniciado_em_magia' },
      ],
      espacos_magia: { 1: { total: 2, usados: 0 } },
    };

    const context = { aliasResolver, now: '2026-07-30T00:00:00.000Z' };
    const decoded = decodeCharacterRecord(record, context);
    assert.equal(decoded.ok, true, JSON.stringify(decoded.error ?? null));

    const [classSpell, featSpell] = decoded.value.character.state.spells.prepared;
    assert.equal(classSpell.sourceInstanceId, null, 'A magia de classe deveria ter fonte null após a migração.');
    assert.equal(featSpell.sourceInstanceId, 'legacy:spell-origin:iniciado-em-magia');

    const castContext = { ...context, registry, spellcasting: { slotMaximums: { 1: 2 } } };
    const cast = executeCharacterCommand(
      decoded.value.character,
      {
        type: 'cast-spell',
        spellId: classSpell.spellRef.id,
        sourceInstanceId: null,
        slotSource: { kind: 'spell-slot', level: 1 },
      },
      castContext,
    );
    assert.equal(cast.ok, true, JSON.stringify(cast.error ?? null));
    assert.equal(cast.character.state.spells.slots['1'].used, 1);

    // A separação por fonte continua valendo: pedir a magia do talento com
    // fonte base/classe não casa.
    const cruzado = executeCharacterCommand(
      decoded.value.character,
      {
        type: 'cast-spell',
        spellId: featSpell.spellRef.id,
        sourceInstanceId: null,
        slotSource: { kind: 'spell-slot', level: 1 },
      },
      castContext,
    );
    assert.equal(cruzado.ok, false);
    assert.equal(cruzado.error.code, 'CAST_SPELL_NOT_AVAILABLE');

    const comFonte = executeCharacterCommand(
      decoded.value.character,
      {
        type: 'cast-spell',
        spellId: featSpell.spellRef.id,
        sourceInstanceId: featSpell.sourceInstanceId,
        slotSource: { kind: 'spell-slot', level: 1 },
      },
      castContext,
    );
    assert.equal(comFonte.ok, true, JSON.stringify(comFonte.error ?? null));
  });
});

describe('contrato Task 18 — metamagia: gap de catálogo registrado como asserção', () => {
  test('as opções de metamagia do baseline ainda não têm entidade no pacote dnd2024', () => {
    const legacyNames = extractMetamagicNames(legacySheetSource);
    assert.equal(legacyNames.length, 10, `Esperava 10 opções de metamagia legadas, li ${legacyNames.length}.`);

    const jaNoCatalogo = legacyNames.filter((name) => {
      const resolved = aliasResolver.resolve(name);
      return resolved.ok && registry.get(resolved.value) !== null;
    });
    assert.deepEqual(
      jaNoCatalogo,
      [],
      'Opções de metamagia passaram a existir no catálogo: `domain/spells/metamagic.js` deve ler custo/compatibilidade delas, não mais de `context.metamagic`.',
    );
    assert.deepEqual(
      registry.list('metamagic-option').map((entity) => entity.id),
      [],
      'Surgiu o tipo de entidade `metamagic-option`: o canal `context.metamagic` pode ser aposentado.',
    );
  });
});
