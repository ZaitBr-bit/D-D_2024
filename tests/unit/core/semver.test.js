import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseSemVer, compareSemVer } from '../../../site/js/core/semver.js';

function parseOk(value) {
  const result = parseSemVer(value);
  assert.equal(result.ok, true, `esperava parse válido para "${value}"`);
  return result.value;
}

describe('core/semver', () => {
  test('parseSemVer() aceita uma versão simples major.minor.patch', () => {
    const version = parseOk('1.2.3');
    assert.deepEqual(version, { major: 1, minor: 2, patch: 3, prerelease: [], build: [] });
  });

  test('parseSemVer() aceita pré-release e build metadata', () => {
    const version = parseOk('1.2.3-alpha.1+build.5');
    assert.deepEqual(version.prerelease, ['alpha', '1']);
    assert.deepEqual(version.build, ['build', '5']);
  });

  test('resultado de parseSemVer() é congelado (imutável)', () => {
    const version = parseOk('1.0.0');
    assert.equal(Object.isFrozen(version), true);
    assert.equal(Object.isFrozen(version.prerelease), true);
  });

  test('parseSemVer() rejeita valores que não são string', () => {
    const result = parseSemVer(1.0);
    assert.equal(result.ok, false);
  });

  test('parseSemVer() rejeita formatos não estritos', () => {
    for (const invalid of ['1', '1.2', '1.2.3.4', 'v1.2.3', '01.2.3', '1.2.3-', '1.2.03']) {
      const result = parseSemVer(invalid);
      assert.equal(result.ok, false, `esperava rejeição para "${invalid}"`);
      assert.equal(result.error.name, 'AppError');
    }
  });

  test('compareSemVer() ordena por major, minor, patch', () => {
    assert.equal(compareSemVer(parseOk('1.0.0'), parseOk('2.0.0')), -1);
    assert.equal(compareSemVer(parseOk('2.1.0'), parseOk('2.0.0')), 1);
    assert.equal(compareSemVer(parseOk('1.2.3'), parseOk('1.2.3')), 0);
    assert.equal(compareSemVer(parseOk('1.2.3'), parseOk('1.2.4')), -1);
  });

  test('compareSemVer() trata versão sem pré-release como maior que com pré-release', () => {
    assert.equal(compareSemVer(parseOk('1.0.0'), parseOk('1.0.0-alpha')), 1);
    assert.equal(compareSemVer(parseOk('1.0.0-alpha'), parseOk('1.0.0')), -1);
  });

  test('compareSemVer() compara identificadores de pré-release em ordem', () => {
    assert.equal(compareSemVer(parseOk('1.0.0-alpha'), parseOk('1.0.0-alpha.1')), -1);
    assert.equal(compareSemVer(parseOk('1.0.0-alpha.1'), parseOk('1.0.0-alpha.beta')), -1);
    assert.equal(compareSemVer(parseOk('1.0.0-alpha.beta'), parseOk('1.0.0-beta')), -1);
  });

  test('compareSemVer() ignora build metadata na comparação', () => {
    assert.equal(compareSemVer(parseOk('1.0.0+build1'), parseOk('1.0.0+build2')), 0);
  });
});
