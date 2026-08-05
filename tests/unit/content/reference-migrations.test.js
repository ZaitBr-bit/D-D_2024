import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  findReferenceMigrationPath,
  migrateContentReference,
} from '../../../site/js/content/reference-migrations.js';

/**
 * Monta um manifesto mínimo contendo apenas a lista de migrações de
 * referência usada por `findReferenceMigrationPath`.
 * @param {ReadonlyArray<object>} referenceMigrations
 */
function manifestWith(referenceMigrations) {
  return {
    schemaVersion: '1.0.0',
    id: 'custom-pack',
    name: 'Pacote',
    version: '2.0.0',
    status: 'ready',
    ruleset: 'custom-pack:ruleset:core',
    entities: ['spell'],
    referenceMigrations,
  };
}

/** Extrai `from -> to` de cada migração para comparar a ordem da cadeia. */
function chainOf(path) {
  return path.map((migration) => `${migration.from}->${migration.to}`);
}

describe('findReferenceMigrationPath: identidade', () => {
  test('mesma versão devolve cadeia vazia', () => {
    const result = findReferenceMigrationPath(manifestWith([]), '1.0.0', '1.0.0');
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, []);
    assert.equal(Object.isFrozen(result.value), true);
  });

  test('mesma versão devolve cadeia vazia mesmo com migrações declaradas', () => {
    const manifest = manifestWith([{ from: '1.0.0', to: '2.0.0', entities: {} }]);
    const result = findReferenceMigrationPath(manifest, '2.0.0', '2.0.0');
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, []);
  });
});

describe('findReferenceMigrationPath: cadeia e ordem', () => {
  const manifest = manifestWith([
    { from: '1.1.0', to: '1.2.0', entities: { 'custom-pack:spell:b': 'custom-pack:spell:c' } },
    { from: '1.0.0', to: '1.1.0', entities: { 'custom-pack:spell:a': 'custom-pack:spell:b' } },
  ]);

  test('devolve a cadeia na ordem de aplicação, não na ordem de declaração', () => {
    const result = findReferenceMigrationPath(manifest, '1.0.0', '1.2.0');
    assert.equal(result.ok, true);
    assert.deepEqual(chainOf(result.value), ['1.0.0->1.1.0', '1.1.0->1.2.0']);
  });

  test('cada migração da cadeia é congelada', () => {
    const [primeira] = findReferenceMigrationPath(manifest, '1.0.0', '1.2.0').value;
    assert.equal(Object.isFrozen(primeira), true);
    assert.throws(() => {
      primeira.to = '9.9.9';
    }, TypeError);
  });

  test('salto de um único passo continua funcionando', () => {
    const result = findReferenceMigrationPath(manifest, '1.1.0', '1.2.0');
    assert.equal(result.ok, true);
    assert.deepEqual(chainOf(result.value), ['1.1.0->1.2.0']);
  });

  test('prefere a cadeia mais curta quando há um atalho declarado', () => {
    const comAtalho = manifestWith([
      { from: '1.0.0', to: '1.1.0', entities: {} },
      { from: '1.1.0', to: '2.0.0', entities: {} },
      { from: '1.0.0', to: '2.0.0', entities: {} },
    ]);
    const result = findReferenceMigrationPath(comAtalho, '1.0.0', '2.0.0');
    assert.equal(result.ok, true);
    assert.deepEqual(chainOf(result.value), ['1.0.0->2.0.0']);
  });
});

describe('findReferenceMigrationPath: lacuna, ciclo e ambiguidade', () => {
  test('lacuna na cadeia devolve CONTENT_VERSION_MIGRATION_REQUIRED', () => {
    const manifest = manifestWith([
      { from: '1.0.0', to: '1.1.0', entities: {} },
      { from: '1.2.0', to: '1.3.0', entities: {} },
    ]);
    const result = findReferenceMigrationPath(manifest, '1.0.0', '1.3.0');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_VERSION_MIGRATION_REQUIRED');
    assert.equal(result.error.context.reason, 'no-path');
  });

  test('nenhuma migração declarada devolve CONTENT_VERSION_MIGRATION_REQUIRED', () => {
    const result = findReferenceMigrationPath(manifestWith([]), '1.0.0', '2.0.0');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_VERSION_MIGRATION_REQUIRED');
  });

  test('manifesto sem referenceMigrations é tratado como sem migrações', () => {
    const manifest = manifestWith([]);
    delete manifest.referenceMigrations;
    const result = findReferenceMigrationPath(manifest, '1.0.0', '2.0.0');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_VERSION_MIGRATION_REQUIRED');
  });

  test('ciclo não trava e continua devolvendo erro quando o alvo é inalcançável', () => {
    const manifest = manifestWith([
      { from: '1.0.0', to: '1.1.0', entities: {} },
      { from: '1.1.0', to: '1.0.0', entities: {} },
      { from: '1.1.0', to: '1.2.0', entities: {} },
      { from: '1.2.0', to: '1.1.0', entities: {} },
    ]);
    const result = findReferenceMigrationPath(manifest, '1.0.0', '9.9.9');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_VERSION_MIGRATION_REQUIRED');
  });

  test('ciclo não impede encontrar um alvo alcançável', () => {
    const manifest = manifestWith([
      { from: '1.0.0', to: '1.1.0', entities: {} },
      { from: '1.1.0', to: '1.0.0', entities: {} },
      { from: '1.1.0', to: '2.0.0', entities: {} },
    ]);
    const result = findReferenceMigrationPath(manifest, '1.0.0', '2.0.0');
    assert.equal(result.ok, true);
    assert.deepEqual(chainOf(result.value), ['1.0.0->1.1.0', '1.1.0->2.0.0']);
  });

  test('duas cadeias mínimas distintas são ambíguas e recusadas', () => {
    const manifest = manifestWith([
      { from: '1.0.0', to: '1.5.0', entities: {} },
      { from: '1.0.0', to: '1.6.0', entities: {} },
      { from: '1.5.0', to: '2.0.0', entities: {} },
      { from: '1.6.0', to: '2.0.0', entities: {} },
    ]);
    const result = findReferenceMigrationPath(manifest, '1.0.0', '2.0.0');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_VERSION_MIGRATION_REQUIRED');
    assert.equal(result.error.context.reason, 'ambiguous-path');
  });

  test('aresta declarada duas vezes invalida o manifesto', () => {
    const manifest = manifestWith([
      { from: '1.0.0', to: '2.0.0', entities: {} },
      { from: '1.0.0', to: '2.0.0', entities: { 'custom-pack:spell:a': 'custom-pack:spell:b' } },
    ]);
    const result = findReferenceMigrationPath(manifest, '1.0.0', '2.0.0');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_MIGRATION_MANIFEST_INVALID');
  });

  test('migração malformada invalida o manifesto', () => {
    for (const migration of [
      { from: 'x', to: '2.0.0' },
      { from: '1.0.0', to: '1.0.0' },
      { from: '1.0.0' },
      null,
      { from: '1.0.0', to: '2.0.0', entities: { 'não é id': 'custom-pack:spell:b' } },
      { from: '1.0.0', to: '2.0.0', entities: { 'custom-pack:spell:a': 'não é id' } },
    ]) {
      const result = findReferenceMigrationPath(manifestWith([migration]), '1.0.0', '2.0.0');
      assert.equal(result.ok, false, `migração inválida aceita: ${JSON.stringify(migration)}`);
      assert.equal(result.error.code, 'CONTENT_MIGRATION_MANIFEST_INVALID');
    }
  });

  test('REGRESSÃO: DAG completo de 20 versões resolve rápido, sem estourar a pilha', () => {
    // Repro exato da revisão: com enumeração de caminhos simples, n=16 levava
    // ~7ms e n=20 lançava RangeError NÃO CAPTURADO, escapando do contrato
    // Result. Com BFS, é O(V+E).
    const migrations = [];
    const versao = (i) => `1.${i}.0`;
    for (let i = 0; i < 20; i += 1) {
      for (let j = i + 1; j < 20; j += 1) {
        migrations.push({ from: versao(i), to: versao(j), entities: {} });
      }
    }
    const inicio = Date.now();
    const result = findReferenceMigrationPath(manifestWith(migrations), versao(0), versao(19));
    assert.equal(Date.now() - inicio < 1000, true, 'a busca deve ser praticamente instantânea');
    // Há a aresta direta 1.0.0 -> 1.19.0 e ela é a única cadeia de tamanho 1.
    assert.equal(result.ok, true, JSON.stringify(result.error ?? null));
    assert.deepEqual(chainOf(result.value), ['1.0.0->1.19.0']);
  });

  test('REGRESSÃO: DAG completo grande com alvo inalcançável devolve erro em vez de estourar', () => {
    const migrations = [];
    for (let i = 0; i < 40; i += 1) {
      for (let j = i + 1; j < 40; j += 1) {
        migrations.push({ from: `1.${i}.0`, to: `1.${j}.0`, entities: {} });
      }
    }
    const result = findReferenceMigrationPath(manifestWith(migrations), '1.0.0', '9.9.9');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_VERSION_MIGRATION_REQUIRED');
    assert.equal(result.error.context.reason, 'no-path');
  });

  test('REGRESSÃO: ambiguidade continua detectada em grafo denso', () => {
    // 1.0.0 -> {1.5.0, 1.6.0} -> 2.0.0: duas cadeias mínimas de tamanho 2.
    const manifest = manifestWith([
      { from: '1.0.0', to: '1.5.0', entities: {} },
      { from: '1.0.0', to: '1.6.0', entities: {} },
      { from: '1.5.0', to: '2.0.0', entities: {} },
      { from: '1.6.0', to: '2.0.0', entities: {} },
      { from: '1.5.0', to: '1.6.0', entities: {} },
    ]);
    const result = findReferenceMigrationPath(manifest, '1.0.0', '2.0.0');
    assert.equal(result.ok, false);
    assert.equal(result.error.context.reason, 'ambiguous-path');
  });

  test('manifesto com número absurdo de migrações é recusado', () => {
    const migrations = [];
    for (let i = 0; i < 1001; i += 1) {
      migrations.push({ from: '1.0.0', to: `2.${i}.0`, entities: {} });
    }
    const result = findReferenceMigrationPath(manifestWith(migrations), '1.0.0', '2.0.0');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_MIGRATION_MANIFEST_INVALID');
  });

  test('versões de entrada inválidas são recusadas', () => {
    assert.equal(findReferenceMigrationPath(manifestWith([]), '1.0', '2.0.0').error.code, 'CONTENT_VERSION_INVALID');
    assert.equal(findReferenceMigrationPath(manifestWith([]), '1.0.0', null).error.code, 'CONTENT_VERSION_INVALID');
    assert.equal(findReferenceMigrationPath(null, '1.0.0', '2.0.0').error.code, 'CONTENT_MIGRATION_MANIFEST_INVALID');
  });
});

describe('migrateContentReference', () => {
  const manifest = manifestWith([
    {
      from: '1.0.0',
      to: '1.1.0',
      entities: { 'custom-pack:spell:antigo': 'custom-pack:spell:intermediario' },
      choices: { 'opcao-antiga': 'opcao-intermediaria' },
    },
    {
      from: '1.1.0',
      to: '1.2.0',
      entities: { 'custom-pack:spell:intermediario': 'custom-pack:spell:novo' },
      choices: { 'opcao-intermediaria': 'opcao-nova' },
    },
  ]);

  /** Cadeia 1.0.0 -> 1.2.0 já resolvida. */
  function chain() {
    const result = findReferenceMigrationPath(manifest, '1.0.0', '1.2.0');
    assert.equal(result.ok, true);
    return result.value;
  }

  test('aplica a cadeia inteira, na ordem, ao id e às escolhas', () => {
    const result = migrateContentReference('custom-pack:spell:antigo', ['opcao-antiga'], chain());
    assert.equal(result.ok, true);
    assert.equal(result.value.id, 'custom-pack:spell:novo');
    assert.deepEqual(result.value.choiceRefs, ['opcao-nova']);
    assert.equal(result.value.packageVersion, '1.2.0');
    assert.equal(result.value.changed, true);
  });

  test('a ordem importa: uma cadeia invertida/descontínua é recusada', () => {
    // A cadeia correta é 1.0.0 -> 1.1.0 -> 1.2.0. Invertida, o `to` de um passo
    // deixa de casar com o `from` do seguinte, o que seria aplicado
    // silenciosamente em ordem errada (produzindo "intermediario" em vez de
    // "novo") se não houvesse a checagem de contiguidade.
    const invertida = [...chain()].reverse();
    const result = migrateContentReference('custom-pack:spell:antigo', [], invertida);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_MIGRATION_PATH_INVALID');
  });

  test('cadeia identidade (vazia) devolve a referência intacta', () => {
    const result = migrateContentReference('custom-pack:spell:antigo', ['opcao-antiga'], []);
    assert.equal(result.ok, true);
    assert.equal(result.value.id, 'custom-pack:spell:antigo');
    assert.deepEqual(result.value.choiceRefs, ['opcao-antiga']);
    assert.equal(result.value.changed, false);
  });

  test('referência não renomeada atravessa a cadeia inalterada', () => {
    const result = migrateContentReference('custom-pack:spell:estavel', [], chain());
    assert.equal(result.ok, true);
    assert.equal(result.value.id, 'custom-pack:spell:estavel');
    assert.equal(result.value.changed, false);
  });

  test('escolhas que são ContentId usam o mapa de entidades', () => {
    const result = migrateContentReference(
      'custom-pack:spell:estavel',
      ['custom-pack:spell:antigo'],
      chain(),
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.choiceRefs, ['custom-pack:spell:novo']);
  });

  test('aceita ContentRef com packageVersion e devolve a versão final', () => {
    const result = migrateContentReference(
      { id: 'custom-pack:spell:antigo', packageVersion: '1.0.0' },
      [],
      chain(),
    );
    assert.equal(result.ok, true);
    assert.equal(result.value.id, 'custom-pack:spell:novo');
    assert.equal(result.value.packageVersion, '1.2.0');
  });

  test('referência removida pela migração devolve CONTENT_VERSION_MIGRATION_REQUIRED', () => {
    const comRemocao = manifestWith([
      { from: '1.0.0', to: '2.0.0', entities: {}, removed: ['custom-pack:spell:antigo'] },
    ]);
    const caminho = findReferenceMigrationPath(comRemocao, '1.0.0', '2.0.0');
    assert.equal(caminho.ok, true);
    const result = migrateContentReference('custom-pack:spell:antigo', [], caminho.value);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_VERSION_MIGRATION_REQUIRED');
    assert.equal(result.error.context.reason, 'reference-removed');
  });

  test('colisão entre escolhas migradas é recusada em vez de sobrescrever', () => {
    const comColisao = manifestWith([
      {
        from: '1.0.0',
        to: '2.0.0',
        entities: {},
        choices: { 'opcao-a': 'opcao-unica', 'opcao-b': 'opcao-unica' },
      },
    ]);
    const caminho = findReferenceMigrationPath(comColisao, '1.0.0', '2.0.0');
    const result = migrateContentReference('custom-pack:spell:x', ['opcao-a', 'opcao-b'], caminho.value);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_REFERENCE_MIGRATION_COLLISION');
  });

  test('o resultado é congelado', () => {
    const result = migrateContentReference('custom-pack:spell:antigo', ['opcao-antiga'], chain());
    assert.equal(Object.isFrozen(result.value), true);
    assert.equal(Object.isFrozen(result.value.choiceRefs), true);
  });

  test('entradas inválidas são recusadas', () => {
    assert.equal(migrateContentReference('não é id', [], []).error.code, 'CONTENT_REFERENCE_INVALID');
    assert.equal(migrateContentReference(null, [], []).error.code, 'CONTENT_REFERENCE_INVALID');
    assert.equal(migrateContentReference({ packageVersion: '1.0.0' }, [], []).error.code, 'CONTENT_REFERENCE_INVALID');
    assert.equal(
      migrateContentReference('custom-pack:spell:a', ['ok', 42], []).error.code,
      'CONTENT_REFERENCE_INVALID',
    );
    assert.equal(
      migrateContentReference('custom-pack:spell:a', [], 'não é cadeia').error.code,
      'CONTENT_MIGRATION_PATH_INVALID',
    );
    assert.equal(
      migrateContentReference('custom-pack:spell:a', [], [{ from: '1.0.0' }]).error.code,
      'CONTENT_MIGRATION_PATH_INVALID',
    );
  });
});
