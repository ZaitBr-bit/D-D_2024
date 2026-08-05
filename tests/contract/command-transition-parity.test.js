// Contrato (Task 17): os comandos de PV/descanso/condições/edição devem
// reproduzir as transições caracterizadas em
// `tests/fixtures/expected/command-transitions.json` (Task 2, contra o
// comportamento REAL do monólito no commit `COMPATIBILITY_BASELINE`), quando
// dirigidos através do ciclo completo `decodeCharacterRecord` ->
// `executeCharacterCommand` -> `encodeCharacterRecord`. Isto também exercita
// o requisito de WRITE-BACK do brief: um override criado/lido do lado
// canônico precisa sobreviver ao encode de volta para o registro plano
// (`pv_max`/`edicoes.campos.pv_max`).
//
// Cobre apenas as categorias do fixture que pertencem ao escopo desta task —
// "concentracao" (Task 18, adiada), "inventario"/"moedas"/"levelup" (fora do
// escopo do brief da Task 17) ficam para os contratos das tasks
// correspondentes.
//
// Fix round 1 (achados I1/I2 da revisão independente): o caso
// "recursos-talento-usado-e-restaurado" ENTROU na suíte — a chave real do
// recurso (`dadiva_proeza_combate`/`usado_no_turno`) já está no próprio
// fixture (`personagemAntes.recursos.talentos`); `operacao.talento` é
// metadado descritivo, não a interface do comando (`toggleLegacyTalentResource`
// já recebe slug/field explícitos). E o caso "descanso-curto-..." não ignora
// mais `recursos`: o pacote `dnd2024` real já declara `recovery` em 20+
// pontos, e o talento "Dádiva do Destino" ganhou o efeito `resource`/
// `recovery` correspondente em `dados/pacotes/dnd2024/feats/catalog.json`
// (ver relatório da Task 17, fix round 1). Por isso este arquivo carrega o
// REGISTRY REAL do pacote `dnd2024` (via `createAppContext` + `fetchFn` de
// disco, mesmo padrão de `tests/contract/legacy-db-projection.test.js`), não
// um fake.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAppContext } from '../../site/js/app-context.js';
import { createLegacyAliasResolver } from '../../site/js/infra/character/legacy-alias-resolver.js';
import { decodeCharacterRecord, encodeCharacterRecord } from '../../site/js/infra/character/character-codec.js';
import { executeCharacterCommand } from '../../site/js/domain/commands/command-dispatcher.js';
import { createDiskFetch } from '../helpers/disk-fetch.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

let ctx;
let registry;
let officialHandlerInvoker;
let cases;

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  const resolver = createLegacyAliasResolver(aliases);

  const { fetchFn } = createDiskFetch();
  const appContext = createAppContext({ fetchFn });
  const activation = await appContext.initializeContent();
  assert.equal(activation.ok, true, `ativação do catálogo dnd2024 falhou: ${JSON.stringify(activation.error ?? null)}`);
  registry = activation.value;
  // Task 30: `short-rest`/`long-rest` passaram a COMPOR o `onRest` dos
  // handlers de classe dentro do próprio comando (decisão registrada em
  // `questions-for-review.txt` item 15). Um personagem COM classe exige, a
  // partir daí, a porta de invocação — sem ela o descanso falha com erro
  // nomeado em vez de pular a recarga de classe em silêncio, que é justamente
  // como as recargas dos doze handlers ficaram invisíveis até agora.
  //
  // Passar a porta REAL aqui é o que torna esta parity um teste mais forte, e
  // não mais fraco: as transições do baseline continuam sendo reproduzidas
  // COM a composição ligada.
  officialHandlerInvoker = appContext.getOfficialHandlerInvoker();
  assert.ok(officialHandlerInvoker, 'o composition root deveria publicar o OfficialHandlerInvoker após a ativação');

  // `registry` NÃO entra no `ctx` base (usado por decode/encode e mesclado em
  // TODOS os casos via `runCase`) — só os testes de descanso/recursos que
  // precisam do motor de efeitos o recebem explicitamente, para não afetar
  // categorias que já passavam sem ele (dano/cura/pv_temporario/condicoes/
  // edicoes não devem ganhar efeitos de progressão implícitos por acidente).
  ctx = { aliasResolver: resolver, now: '2026-07-30T00:00:00.000Z' };
  const fixture = JSON.parse(
    await readFile(path.join(repoRoot, 'tests/fixtures/expected/command-transitions.json'), 'utf8'),
  );
  cases = Object.fromEntries(fixture.cases.map((c) => [c.id, c]));
});

/**
 * Decodifica `personagemAntes`, executa o comando mapeado de `operacao` e
 * codifica de volta, comparando com `personagemDepois` (exceto pelas chaves
 * em `ignoreKeys`, usadas só para os dois gaps documentados no topo do
 * arquivo). Falha se decode/comando/encode não forem todos bem-sucedidos.
 * @param {string} caseId
 * @param {{type: string, [key: string]: *}} command
 * @param {object} [context] - mesclado sobre `ctx`.
 * @param {ReadonlyArray<string>} [ignoreKeys]
 */
function runCase(caseId, command, context = {}, ignoreKeys = []) {
  const fixtureCase = cases[caseId];
  assert.ok(fixtureCase, `fixture "${caseId}" não encontrado`);

  const decoded = decodeCharacterRecord(fixtureCase.personagemAntes, ctx);
  assert.equal(decoded.ok, true, `decode falhou para "${caseId}": ${JSON.stringify(decoded.error)}`);
  assert.equal(decoded.value.mode, 'editable');

  const result = executeCharacterCommand(decoded.value.character, command, { ...ctx, ...context });
  assert.equal(result.ok, true, `comando falhou para "${caseId}": ${JSON.stringify(result.error)}`);

  const encoded = encodeCharacterRecord(result.character, ctx);
  assert.equal(encoded.ok, true, `encode falhou para "${caseId}": ${JSON.stringify(encoded.error)}`);

  // Compara só as chaves que o PRÓPRIO fixture do baseline v1 declara (o
  // registro v2 codificado tem canais adicionais — `_schema`, `overrides`,
  // `content_refs`, etc. — que não existem no vocabulário do app baseline e
  // não fazem parte do que este fixture caracteriza).
  const expected = { ...fixtureCase.personagemDepois };
  const actual = {};
  for (const key of Object.keys(expected)) {
    actual[key] = encoded.value[key];
  }
  for (const key of ignoreKeys) {
    delete actual[key];
    delete expected[key];
  }
  assert.deepEqual(actual, expected, `personagemDepois diverge para "${caseId}"`);
}

describe('contract/command-transition-parity — dano', () => {
  test('dano-absorvido-por-pv-temporario', () => {
    runCase('dano-absorvido-por-pv-temporario', { type: 'apply-damage', amount: 8 });
  });

  test('dano-ate-zero-nao-reseta-salvaguardas-morte', () => {
    runCase('dano-ate-zero-nao-reseta-salvaguardas-morte', { type: 'apply-damage', amount: 10 });
  });
});

describe('contract/command-transition-parity — cura', () => {
  test('cura-nao-ultrapassa-pv-max', () => {
    runCase(
      'cura-nao-ultrapassa-pv-max',
      { type: 'apply-healing', amount: 15 },
      { maximumHitPoints: cases['cura-nao-ultrapassa-pv-max'].personagemAntes.pv_max },
    );
  });

  test('cura-a-partir-de-zero-reseta-salvaguardas-morte', () => {
    runCase(
      'cura-a-partir-de-zero-reseta-salvaguardas-morte',
      { type: 'apply-healing', amount: 8 },
      { maximumHitPoints: cases['cura-a-partir-de-zero-reseta-salvaguardas-morte'].personagemAntes.pv_max },
    );
  });
});

describe('contract/command-transition-parity — pv_temporario', () => {
  test('pv-temporario-nao-acumula-usa-maior-valor', () => {
    runCase('pv-temporario-nao-acumula-usa-maior-valor', { type: 'grant-temporary-hp', amount: 5 });
  });
});

describe('contract/command-transition-parity — descansos', () => {
  test('descanso-curto-nao-reseta-dados-de-vida (inclui a restauração real de "Dádiva do Destino")', () => {
    // Fix round 1 (achado I2): o registry REAL resolve o efeito
    // `resource`/`recovery: "short-rest"` declarado para "Dádiva do Destino"
    // (dados/pacotes/dnd2024/feats/catalog.json), então a restauração do
    // recurso agora é comparada normalmente — sem `ignoreKeys`.
    runCase('descanso-curto-nao-reseta-dados-de-vida', { type: 'short-rest' }, { registry, officialHandlerInvoker });
  });

  test('descanso-longo-reseta-dados-de-vida-morte-e-pv', () => {
    const before = cases['descanso-longo-reseta-dados-de-vida-morte-e-pv'].personagemAntes;
    runCase(
      'descanso-longo-reseta-dados-de-vida-morte-e-pv',
      { type: 'long-rest' },
      { maximumHitPoints: before.pv_max, registry, officialHandlerInvoker },
    );
  });
});

describe('contract/command-transition-parity — condicoes', () => {
  test('condicao-adicionada-e-removida', () => {
    runCase('condicao-adicionada-e-removida', { type: 'add-condition', conditionId: 'Enjoo (leve)' });
  });
});

describe('contract/command-transition-parity — recursos', () => {
  test('recursos-talento-usado-e-restaurado (fix round 1, achado I1: chave do fixture, não nome de exibição)', () => {
    // `operacao.talento` ("Dádiva da Proeza em Combate") é metadado
    // descritivo do fixture; a chave real do recurso já está em
    // `personagemAntes.recursos.talentos` (`dadiva_proeza_combate`/
    // `usado_no_turno`) e é isso que `toggleLegacyTalentResource` recebe —
    // sem nenhuma derivação a partir do nome de exibição.
    runCase('recursos-talento-usado-e-restaurado', {
      type: 'toggle-legacy-talent-resource',
      talentSlug: 'dadiva_proeza_combate',
      field: 'usado_no_turno',
      used: true,
    });
  });
});

describe('contract/command-transition-parity — edicoes (write-back do override de hp.maximum)', () => {
  test('edicao-manual-de-pv-max-e-depois-cura-do-sistema', () => {
    // O personagem já chega com um override manual de pv_max (edicoes.campos.pv_max);
    // uma cura do SISTEMA não pode apagar esse registro de edição — é
    // exatamente o requisito de write-back do brief (o encode precisa
    // reprojetar o mesmo override, com a mesma autoria/data).
    runCase('edicao-manual-de-pv-max-e-depois-cura-do-sistema', { type: 'apply-healing', amount: 5 });
  });
});

describe('contract/command-transition-parity — edit-character (allowlist derivada de baseline-field-inventory.json)', () => {
  test('editar hp.maximum via edit-character-field produz o mesmo edicoes.campos.pv_max que uma edição manual do baseline', () => {
    const fixtureCase = cases['edicao-manual-de-pv-max-e-depois-cura-do-sistema'];
    // Usa o personagem SEM override ainda (antes de qualquer edição manual)
    // e aplica o comando `edit-character-field` para produzir o override do
    // zero, depois compara com o formato que o baseline gravaria em
    // `edicoes.campos.pv_max` para uma edição equivalente.
    const rawWithoutEdit = { ...fixtureCase.personagemAntes, edicoes: { versao: 1, campos: {} }, pv_max: 33 };
    const decoded = decodeCharacterRecord(rawWithoutEdit, ctx);
    assert.equal(decoded.ok, true);

    const editedAt = '2026-07-19T10:00:00.000Z';
    const result = executeCharacterCommand(
      decoded.value.character,
      { type: 'edit-character-field', path: 'hp.maximum', value: 38 },
      { ...ctx, maximumHitPoints: 33, now: editedAt },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.affected, ['hp.maximum']);

    const encoded = encodeCharacterRecord(result.character, ctx);
    assert.equal(encoded.ok, true);
    assert.deepEqual(encoded.value.edicoes.campos.pv_max, { original: 33, editadoEm: editedAt, origem: 'manual' });
    assert.equal(encoded.value.pv_max, 38);

    // E decodificar de novo preserva o mesmo override (write-back completo:
    // encode -> "leitura pelo app baseline" -> decode no app novo).
    const redecoded = decodeCharacterRecord(encoded.value, ctx);
    assert.equal(redecoded.ok, true);
    assert.deepEqual(redecoded.value.character.overrides['hp.maximum'], {
      value: 38,
      original: 33,
      editedAt,
      source: 'manual',
    });
  });
});
