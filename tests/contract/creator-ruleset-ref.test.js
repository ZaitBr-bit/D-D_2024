// ============================================================
// Contrato: a referência de ruleset com que o criador cria personagens
// (`features/creator/creator-ruleset-ref.js`) precisa apontar para o pacote
// oficial REALMENTE publicado.
//
// Por que um contrato e não só uma constante: `createEmptyCharacter` exige
// `{id, packageVersion}` e o `ContentRegistry` não expõe a versão ativa do
// namespace (seus sete métodos aprovados não incluem um acessor). Então a
// versão é DECLARADA — e uma declaração que envelhece em silêncio produziria
// personagens presos a uma versão que não existe mais.
//
// Há duas linhas de defesa, e este teste é a primeira (falha no CI, cedo). A
// segunda é em runtime: `pages/creator.js` resolve esta referência no catálogo
// antes de montar e RECUSA abrir se ela não estiver ativa.
// ============================================================
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CREATOR_RULESET_REF } from '../../site/js/features/creator/creator-ruleset-ref.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

describe('CREATOR_RULESET_REF', () => {
  test('a versão declarada é a do manifesto do pacote oficial', async () => {
    const manifest = JSON.parse(await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/manifest.json'), 'utf8'));
    assert.equal(
      CREATOR_RULESET_REF.packageVersion,
      manifest.version,
      'a versão declarada no criador divergiu do manifesto publicado',
    );
  });

  test('o namespace declarado é o do pacote e a entidade de ruleset existe', async () => {
    const manifest = JSON.parse(await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/manifest.json'), 'utf8'));
    const [namespace] = CREATOR_RULESET_REF.id.split(':');
    assert.equal(namespace, manifest.namespace ?? manifest.id, 'o namespace do ruleset precisa ser o do pacote');

    const ruleset = JSON.parse(await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/rulesets/core.json'), 'utf8'));
    assert.equal(ruleset.id, CREATOR_RULESET_REF.id);
    assert.equal(ruleset.type, 'ruleset');
  });

  test('a referência é congelada (ninguém a remenda em runtime)', () => {
    assert.equal(Object.isFrozen(CREATOR_RULESET_REF), true);
  });
});
