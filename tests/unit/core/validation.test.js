import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createValidationResult, mergeValidationResults } from '../../../site/js/core/validation.js';
import { createAppError, createAppWarning } from '../../../site/js/core/errors.js';

describe('core/validation', () => {
  test('createValidationResult() sem erros é válido', () => {
    const result = createValidationResult({ errors: [], warnings: [] });
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
  });

  test('createValidationResult() com erros é inválido', () => {
    const error = createAppError({ code: 'E', scope: 's', message: 'm' });
    const result = createValidationResult({ errors: [error], warnings: [] });
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 1);
  });

  test('createValidationResult() com apenas warnings continua válido', () => {
    const warning = createAppWarning({ code: 'W', scope: 's', message: 'm' });
    const result = createValidationResult({ errors: [], warnings: [warning] });
    assert.equal(result.valid, true);
    assert.equal(result.warnings.length, 1);
  });

  test('ValidationResult é congelado (imutável), inclusive as listas', () => {
    const result = createValidationResult({ errors: [], warnings: [] });
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.errors), true);
    assert.equal(Object.isFrozen(result.warnings), true);
    assert.throws(() => result.errors.push('x'));
  });

  test('mergeValidationResults() agrega erros e warnings de forma determinística', () => {
    const e1 = createAppError({ code: 'E1', scope: 's', message: 'm1' });
    const e2 = createAppError({ code: 'E2', scope: 's', message: 'm2' });
    const w1 = createAppWarning({ code: 'W1', scope: 's', message: 'm1' });

    const r1 = createValidationResult({ errors: [e1], warnings: [] });
    const r2 = createValidationResult({ errors: [e2], warnings: [w1] });

    const merged = mergeValidationResults([r1, r2]);
    assert.equal(merged.valid, false);
    assert.deepEqual(merged.errors.map((e) => e.code), ['E1', 'E2']);
    assert.deepEqual(merged.warnings.map((w) => w.code), ['W1']);
  });

  test('mergeValidationResults() com lista vazia produz um resultado válido vazio', () => {
    const merged = mergeValidationResults([]);
    assert.equal(merged.valid, true);
    assert.deepEqual(merged.errors, []);
    assert.deepEqual(merged.warnings, []);
  });

  test('mergeValidationResults() preserva a ordem de entrada (determinismo)', () => {
    const a = createValidationResult({ errors: [createAppError({ code: 'A', scope: 's', message: 'm' })], warnings: [] });
    const b = createValidationResult({ errors: [createAppError({ code: 'B', scope: 's', message: 'm' })], warnings: [] });
    const mergedAB = mergeValidationResults([a, b]);
    const mergedBA = mergeValidationResults([b, a]);
    assert.deepEqual(mergedAB.errors.map((e) => e.code), ['A', 'B']);
    assert.deepEqual(mergedBA.errors.map((e) => e.code), ['B', 'A']);
  });
});
