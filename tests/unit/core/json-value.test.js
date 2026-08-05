import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cloneJsonValue, isJsonValue } from '../../../site/js/core/json-value.js';

describe('core/json-value', () => {
  test('cloneJsonValue() clona valores primitivos', () => {
    assert.equal(cloneJsonValue(null).value, null);
    assert.equal(cloneJsonValue('texto').value, 'texto');
    assert.equal(cloneJsonValue(true).value, true);
    assert.equal(cloneJsonValue(42).value, 42);
  });

  test('cloneJsonValue() clona objetos e arrays aninhados profundamente', () => {
    const original = { a: [1, 2, { b: 'c' }] };
    const result = cloneJsonValue(original);
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, original);
    assert.notEqual(result.value, original);
    assert.notEqual(result.value.a, original.a);
    assert.notEqual(result.value.a[2], original.a[2]);
  });

  test('cloneJsonValue() retorna um valor congelado (imutável)', () => {
    const result = cloneJsonValue({ a: [1, 2] });
    assert.equal(Object.isFrozen(result.value), true);
    assert.equal(Object.isFrozen(result.value.a), true);
  });

  test('cloneJsonValue() rejeita undefined', () => {
    const result = cloneJsonValue(undefined);
    assert.equal(result.ok, false);
    assert.equal(result.error.name, 'AppError');
  });

  test('cloneJsonValue() rejeita funções', () => {
    const result = cloneJsonValue(() => {});
    assert.equal(result.ok, false);
  });

  test('cloneJsonValue() rejeita instâncias de Date', () => {
    const result = cloneJsonValue(new Date());
    assert.equal(result.ok, false);
  });

  test('cloneJsonValue() rejeita ciclos', () => {
    const cyclic = { a: 1 };
    cyclic.self = cyclic;
    const result = cloneJsonValue(cyclic);
    assert.equal(result.ok, false);
  });

  test('cloneJsonValue() rejeita números não finitos', () => {
    assert.equal(cloneJsonValue(NaN).ok, false);
    assert.equal(cloneJsonValue(Infinity).ok, false);
    assert.equal(cloneJsonValue(-Infinity).ok, false);
  });

  test('cloneJsonValue() rejeita undefined aninhado dentro de objetos', () => {
    const result = cloneJsonValue({ a: undefined });
    assert.equal(result.ok, false);
  });

  test('isJsonValue() aceita valores JSON válidos', () => {
    assert.equal(isJsonValue(null), true);
    assert.equal(isJsonValue({ a: [1, 'x', false, null] }), true);
  });

  test('isJsonValue() rejeita undefined, funções, Date, ciclos e números não finitos', () => {
    assert.equal(isJsonValue(undefined), false);
    assert.equal(isJsonValue(() => {}), false);
    assert.equal(isJsonValue(new Date()), false);
    const cyclic = {};
    cyclic.self = cyclic;
    assert.equal(isJsonValue(cyclic), false);
    assert.equal(isJsonValue(NaN), false);
  });
});
