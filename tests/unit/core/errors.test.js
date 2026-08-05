import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAppError,
  createAppWarning,
  serializeAppError,
  serializeAppWarning,
} from '../../../site/js/core/errors.js';

describe('core/errors', () => {
  test('createAppError() monta um AppError com os campos informados', () => {
    const error = createAppError({
      code: 'CORE_X',
      scope: 'core.test',
      message: 'algo falhou',
      context: { campo: 'nome' },
    });
    assert.equal(error.name, 'AppError');
    assert.equal(error.code, 'CORE_X');
    assert.equal(error.scope, 'core.test');
    assert.equal(error.message, 'algo falhou');
    assert.deepEqual(error.context, { campo: 'nome' });
  });

  test('createAppWarning() monta um AppWarning com os campos informados', () => {
    const warning = createAppWarning({
      code: 'CORE_W',
      scope: 'core.test',
      message: 'atenção',
    });
    assert.equal(warning.name, 'AppWarning');
    assert.equal(warning.code, 'CORE_W');
  });

  test('AppError é congelado (imutável), incluindo o context', () => {
    const error = createAppError({
      code: 'CORE_X',
      scope: 'core.test',
      message: 'm',
      context: { a: 1 },
    });
    assert.equal(Object.isFrozen(error), true);
    assert.equal(Object.isFrozen(error.context), true);
    assert.throws(() => {
      error.code = 'OUTRO';
    });
  });

  test('congelamento profundo alcança filhos não congelados mesmo quando o objeto raiz do context já veio congelado', () => {
    const preFrozenContext = Object.freeze({ nested: { a: 1 } });
    const error = createAppError({
      code: 'CORE_X',
      scope: 'core.test',
      message: 'm',
      context: preFrozenContext,
    });
    assert.equal(Object.isFrozen(error.context.nested), true);
    assert.throws(() => {
      error.context.nested.a = 999;
    });
  });

  test('createAppError() não congela nem muta o objeto de context do chamador (copia antes de congelar)', () => {
    const caller = { a: 1 };
    createAppError({ code: 'CORE_X', scope: 'core.test', message: 'm', context: caller });
    assert.equal(Object.isFrozen(caller), false);
    caller.a = 2;
    assert.equal(caller.a, 2);
  });

  test('AppWarning é congelado (imutável)', () => {
    const warning = createAppWarning({ code: 'W', scope: 's', message: 'm' });
    assert.equal(Object.isFrozen(warning), true);
  });

  test('createAppError() exige code, scope e message não vazios', () => {
    assert.throws(() => createAppError({ scope: 's', message: 'm' }), TypeError);
    assert.throws(() => createAppError({ code: 'C', message: 'm' }), TypeError);
    assert.throws(() => createAppError({ code: 'C', scope: 's' }), TypeError);
  });

  test('serializeAppError() nunca inclui a chave "cause"', () => {
    const cause = new Error('causa raiz sensível');
    const error = createAppError({
      code: 'CORE_X',
      scope: 'core.test',
      message: 'm',
      context: { campo: 'valor' },
      cause,
    });
    const serialized = serializeAppError(error);
    assert.equal('cause' in serialized, false);
    assert.deepEqual(serialized, {
      name: 'AppError',
      code: 'CORE_X',
      scope: 'core.test',
      message: 'm',
      context: { campo: 'valor' },
    });
  });

  test('serializeAppWarning() nunca inclui a chave "cause"', () => {
    const warning = createAppWarning({
      code: 'W',
      scope: 's',
      message: 'm',
      cause: new Error('interno'),
    });
    const serialized = serializeAppWarning(warning);
    assert.equal('cause' in serialized, false);
  });

  test('serialização não assume nem exige um formato de "personagem completo" no context', () => {
    const error = createAppError({
      code: 'CORE_X',
      scope: 'core.test',
      message: 'm',
      context: { qualquerCoisa: [1, 2, { aninhado: true }] },
    });
    const serialized = serializeAppError(error);
    assert.deepEqual(serialized.context, { qualquerCoisa: [1, 2, { aninhado: true }] });
  });

  test('serializeAppError() produz um objeto serializável em JSON', () => {
    const error = createAppError({ code: 'C', scope: 's', message: 'm', context: { x: 1 } });
    const serialized = serializeAppError(error);
    assert.doesNotThrow(() => JSON.stringify(serialized));
  });

  test('context ausente é serializado como null', () => {
    const error = createAppError({ code: 'C', scope: 's', message: 'm' });
    const serialized = serializeAppError(error);
    assert.equal(serialized.context, null);
  });
});
