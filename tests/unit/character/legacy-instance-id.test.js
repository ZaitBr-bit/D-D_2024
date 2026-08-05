import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deriveLegacyInstanceId } from '../../../site/js/infra/character/legacy-instance-id.js';

describe('infra/character/legacy-instance-id', () => {
  test('produz o formato legacy:<collection>:<originalIndex-padded>:<normalized-slug>', () => {
    const id = deriveLegacyInstanceId({ collection: 'inventory', originalIndex: 0, normalizedName: 'Espada Longa' });
    assert.equal(id, 'legacy:inventory:0000:espada-longa');
  });

  test('é idempotente: mesmos parâmetros produzem sempre o mesmo id', () => {
    const params = { collection: 'spells', originalIndex: 7, normalizedName: 'Míssil Mágico' };
    assert.equal(deriveLegacyInstanceId(params), deriveLegacyInstanceId(params));
  });

  test('duplicatas com o mesmo nome são desambiguadas pelo índice, não pelo nome', () => {
    const a = deriveLegacyInstanceId({ collection: 'inventory', originalIndex: 0, normalizedName: 'Adaga' });
    const b = deriveLegacyInstanceId({ collection: 'inventory', originalIndex: 1, normalizedName: 'Adaga' });
    assert.notEqual(a, b);
    assert.equal(a, 'legacy:inventory:0000:adaga');
    assert.equal(b, 'legacy:inventory:0001:adaga');
  });

  test('remove acentos e caracteres não alfanuméricos do slug', () => {
    assert.equal(
      deriveLegacyInstanceId({ collection: 'spells', originalIndex: 3, normalizedName: 'Bênção!!' }),
      'legacy:spells:0003:bencao',
    );
  });

  test('nome vazio/normalizado para nada vira o slug "item" (nunca segmento vazio)', () => {
    assert.equal(
      deriveLegacyInstanceId({ collection: 'inventory', originalIndex: 5, normalizedName: '' }),
      'legacy:inventory:0005:item',
    );
  });

  test('preenche o índice com zeros à esquerda até 4 dígitos', () => {
    assert.equal(
      deriveLegacyInstanceId({ collection: 'inventory', originalIndex: 12345, normalizedName: 'X' }),
      'legacy:inventory:12345:x',
    );
  });

  test('lança TypeError para "collection" ausente/vazio', () => {
    assert.throws(() => deriveLegacyInstanceId({ originalIndex: 0, normalizedName: 'X' }), TypeError);
    assert.throws(() => deriveLegacyInstanceId({ collection: '', originalIndex: 0, normalizedName: 'X' }), TypeError);
  });

  test('lança TypeError para "originalIndex" não inteiro ou negativo', () => {
    assert.throws(() => deriveLegacyInstanceId({ collection: 'inventory', originalIndex: -1, normalizedName: 'X' }), TypeError);
    assert.throws(() => deriveLegacyInstanceId({ collection: 'inventory', originalIndex: 1.5, normalizedName: 'X' }), TypeError);
  });
});
