// Módulo `core/semver`: parse e comparação estrita de versões semânticas
// (SemVer 2.0.0), usado para versionar pacotes de conteúdo (fontes de
// regras, homebrew, etc.).

import { ok, err } from './result.js';
import { createAppError } from './errors.js';

// Regex de referência da especificação SemVer 2.0.0 (semver.org), adaptada
// para capturar major/minor/patch/prerelease/build separadamente.
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Faz o parse estrito de uma string SemVer. Retorna um Result — versões
 * malformadas são uma falha esperada, não um defeito.
 * @param {*} value
 * @returns {import('./result.js').Result}
 */
export function parseSemVer(value) {
  if (typeof value !== 'string') {
    return err(
      createAppError({
        code: 'SEMVER_INVALID_TYPE',
        scope: 'core.semver',
        message: 'Versão deve ser uma string.',
        context: { receivedType: typeof value },
      }),
    );
  }

  const match = SEMVER_PATTERN.exec(value);
  if (!match) {
    return err(
      createAppError({
        code: 'SEMVER_INVALID_FORMAT',
        scope: 'core.semver',
        message: 'Versão não segue o formato SemVer estrito (major.minor.patch[-prerelease][+build]).',
        context: { value },
      }),
    );
  }

  const [, major, minor, patch, prerelease, build] = match;
  return ok(
    Object.freeze({
      major: Number(major),
      minor: Number(minor),
      patch: Number(patch),
      prerelease: prerelease ? Object.freeze(prerelease.split('.')) : Object.freeze([]),
      build: build ? Object.freeze(build.split('.')) : Object.freeze([]),
    }),
  );
}

/**
 * Compara duas listas de identificadores de pré-release segundo as regras
 * de precedência do SemVer 2.0.0 (item 11): identificadores numéricos
 * comparam numericamente, alfanuméricos comparam lexicograficamente (ASCII),
 * campos numéricos sempre têm precedência menor que alfanuméricos, e um
 * conjunto maior de campos tem precedência maior quando os campos comuns são
 * iguais. Ausência de pré-release tem precedência maior que presença.
 * @param {ReadonlyArray<string>} a
 * @param {ReadonlyArray<string>} b
 * @returns {-1 | 0 | 1}
 */
function comparePrerelease(a, b) {
  if (a.length === 0 && b.length === 0) {
    return 0;
  }
  if (a.length === 0) {
    return 1;
  }
  if (b.length === 0) {
    return -1;
  }

  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    if (i >= a.length) {
      return -1;
    }
    if (i >= b.length) {
      return 1;
    }
    const identA = a[i];
    const identB = b[i];
    const numA = /^\d+$/.test(identA);
    const numB = /^\d+$/.test(identB);
    if (numA && numB) {
      const diff = Number(identA) - Number(identB);
      if (diff !== 0) {
        return diff < 0 ? -1 : 1;
      }
    } else if (numA !== numB) {
      return numA ? -1 : 1;
    } else if (identA !== identB) {
      return identA < identB ? -1 : 1;
    }
  }
  return 0;
}

/**
 * Compara duas SemVer já parseadas (retorno de `parseSemVer`), seguindo a
 * ordem de precedência do SemVer 2.0.0. Build metadata é ignorado, conforme
 * a especificação.
 * @param {{major: number, minor: number, patch: number, prerelease: ReadonlyArray<string>}} left
 * @param {{major: number, minor: number, patch: number, prerelease: ReadonlyArray<string>}} right
 * @returns {-1 | 0 | 1}
 */
export function compareSemVer(left, right) {
  if (left.major !== right.major) {
    return left.major < right.major ? -1 : 1;
  }
  if (left.minor !== right.minor) {
    return left.minor < right.minor ? -1 : 1;
  }
  if (left.patch !== right.patch) {
    return left.patch < right.patch ? -1 : 1;
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}
