import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLegacyAliasResolver } from '../../../site/js/infra/character/legacy-alias-resolver.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const aliasesPath = path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json');

let aliases;
before(async () => {
  aliases = JSON.parse(await readFile(aliasesPath, 'utf8'));
});

describe('infra/character/legacy-alias-resolver', () => {
  test('resolve exatamente o mesmo destino que o JSON fonte, para todo mapeamento (teste de paridade)', () => {
    const resolver = createLegacyAliasResolver(aliases);
    for (const { from, to } of aliases.mappings) {
      const result = resolver.resolve(from);
      assert.equal(result.ok, true, `esperava resolver "${from}"`);
      assert.equal(result.value, to);
    }
    assert.equal(resolver.size, new Set(aliases.mappings.map((m) => m.from)).size);
  });

  test('nome sem alias exato devolve erro CHARACTER_LEGACY_ALIAS_NOT_FOUND (sem normalização aproximada)', () => {
    const resolver = createLegacyAliasResolver(aliases);
    const result = resolver.resolve('força'); // minúsculo — "Força" (maiúscula) é que está no mapa
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_LEGACY_ALIAS_NOT_FOUND');
  });

  test('has() reflete exatamente o que resolve() aceitaria', () => {
    const resolver = createLegacyAliasResolver(aliases);
    assert.equal(resolver.has('Força'), true);
    assert.equal(resolver.has('Não Existe De Jeito Nenhum'), false);
  });

  test('rejeita entrada vazia/não-string com erro estruturado, não exceção', () => {
    const resolver = createLegacyAliasResolver(aliases);
    assert.equal(resolver.resolve('').ok, false);
    assert.equal(resolver.resolve(undefined).ok, false);
  });

  test('lança TypeError ao ser construído sem um migration-map válido', () => {
    assert.throws(() => createLegacyAliasResolver(null), TypeError);
    assert.throws(() => createLegacyAliasResolver({}), TypeError);
    assert.throws(() => createLegacyAliasResolver({ mappings: [{ from: 'x' }] }), TypeError);
  });
});
