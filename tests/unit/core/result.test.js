import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ok, err, isResult } from '../../../site/js/core/result.js';

describe('core/result', () => {
  test('ok() cria um Result de sucesso com o valor informado', () => {
    const result = ok(42);
    assert.equal(result.ok, true);
    assert.equal(result.value, 42);
  });

  test('err() cria um Result de falha com o erro informado', () => {
    const error = { code: 'X', message: 'falhou' };
    const result = err(error);
    assert.equal(result.ok, false);
    assert.equal(result.error, error);
  });

  test('Result de sucesso é congelado (imutável)', () => {
    const result = ok({ a: 1 });
    assert.equal(Object.isFrozen(result), true);
    assert.throws(() => {
      result.ok = false;
    });
  });

  test('Result de falha é congelado (imutável)', () => {
    const result = err(new Error('boom'));
    assert.equal(Object.isFrozen(result), true);
    assert.throws(() => {
      result.error = null;
    });
  });

  test('isResult() reconhece Results válidos de sucesso e falha', () => {
    assert.equal(isResult(ok(1)), true);
    assert.equal(isResult(err('e')), true);
  });

  test('isResult() rejeita valores que não são Results', () => {
    assert.equal(isResult(null), false);
    assert.equal(isResult(undefined), false);
    assert.equal(isResult(42), false);
    assert.equal(isResult({ ok: true }), false);
    assert.equal(isResult({ ok: 'true', value: 1 }), false);
    assert.equal(isResult({ ok: false }), false);
  });
});
