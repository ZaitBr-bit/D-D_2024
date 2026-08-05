import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseContentId, formatContentId } from '../../../site/js/core/content-id.js';

describe('core/content-id', () => {
  test('parseContentId() aceita "namespace:type:slug" em ASCII minúsculo', () => {
    const result = parseContentId('phb2024:spell:fireball');
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, {
      namespace: 'phb2024',
      type: 'spell',
      slug: 'fireball',
    });
  });

  test('parseContentId() aceita segmentos com hífens', () => {
    const result = parseContentId('homebrew-user:feat:extra-attack-fix');
    assert.equal(result.ok, true);
    assert.equal(result.value.slug, 'extra-attack-fix');
  });

  test('resultado de parseContentId() é congelado (imutável)', () => {
    const result = parseContentId('a:b:c');
    assert.equal(Object.isFrozen(result.value), true);
  });

  test('parseContentId() rejeita valores que não são string', () => {
    const result = parseContentId(123);
    assert.equal(result.ok, false);
    assert.equal(result.error.name, 'AppError');
  });

  test('parseContentId() rejeita formato sem os três segmentos', () => {
    const result = parseContentId('so-namespace');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_ID_INVALID_FORMAT');
  });

  test('parseContentId() rejeita segmentos com maiúsculas', () => {
    const result = parseContentId('PHB:spell:fireball');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_ID_INVALID_SEGMENT');
  });

  test('parseContentId() rejeita segmentos com caracteres não ASCII', () => {
    const result = parseContentId('phb:spell:bolaí-de-fogo');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CONTENT_ID_INVALID_SEGMENT');
  });

  test('parseContentId() rejeita segmentos vazios', () => {
    const result = parseContentId('phb::fireball');
    assert.equal(result.ok, false);
  });

  test('formatContentId() monta a string "namespace:type:slug"', () => {
    const value = formatContentId({ namespace: 'phb2024', type: 'spell', slug: 'fireball' });
    assert.equal(value, 'phb2024:spell:fireball');
  });

  test('formatContentId() é o inverso de parseContentId() para entradas válidas', () => {
    const parsed = parseContentId('phb2024:spell:fireball');
    assert.equal(formatContentId(parsed.value), 'phb2024:spell:fireball');
  });

  test('formatContentId() lança (defeito de programação) para segmentos inválidos', () => {
    assert.throws(() => formatContentId({ namespace: 'PHB', type: 'spell', slug: 'x' }), TypeError);
  });
});
