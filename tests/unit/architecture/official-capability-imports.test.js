// Regra de arquitetura da Task 6: as duas fábricas que criam a capacidade
// oficial e o canal de autorização de handlers só podem ser importadas ou
// chamadas pelo composition root (`site/js/app-context.js`) e pelos testes
// de segurança (que ficam fora de `site/js` e, portanto, fora do escopo do
// scanner). Nenhum outro módulo de produção — `official-content-registry.js`,
// fontes HTTP, domínio, features, ui, pages — entra na allowlist.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { analyzeDirectory } from '../../../scripts/check-architecture.mjs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

// Stubs mínimos dos dois módulos restritos, para que a resolução de
// specifiers relativos encontre arquivos reais nas árvores temporárias.
const CAPABILITIES_STUB = 'export function createOfficialSourceCapabilities() { return {}; }\nexport function hasOfficialHandlersCapability() { return false; }\n';
const CHANNEL_STUB = 'export function createOfficialHandlerAuthorizationChannel() { return {}; }\n';

/** Cria um diretório temporário com a estrutura `site/js` fornecida. */
function makeFakeSiteJs(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-capability-'));
  const withStubs = {
    'content/capabilities.js': CAPABILITIES_STUB,
    'content/official-handler-authorization.js': CHANNEL_STUB,
    ...files,
  };
  for (const [relPath, content] of Object.entries(withStubs)) {
    const fullPath = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return dir;
}

/** Filtra apenas as violações da regra de capacidade oficial. */
function capabilityViolations(violations) {
  return violations.filter((violation) => violation.rule.startsWith('official-capability-'));
}

describe('regra de arquitetura: fábricas de capacidade oficial restritas', () => {
  const tempDirs = [];
  after(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  /** Analisa uma árvore temporária e devolve as violações da regra. */
  async function analyze(files) {
    const dir = makeFakeSiteJs(files);
    tempDirs.push(dir);
    return capabilityViolations(await analyzeDirectory(dir));
  }

  test('permite o composition root importar e chamar as duas fábricas', async () => {
    const violations = await analyze({
      'app-context.js':
        "import { createOfficialSourceCapabilities } from './content/capabilities.js';\n" +
        "import { createOfficialHandlerAuthorizationChannel } from './content/official-handler-authorization.js';\n" +
        'export const capabilities = createOfficialSourceCapabilities();\n' +
        'export const channel = createOfficialHandlerAuthorizationChannel();\n',
    });
    assert.deepEqual(violations, []);
  });

  test('permite que os módulos que definem as fábricas as declarem', async () => {
    const violations = await analyze({});
    assert.deepEqual(violations, []);
  });

  test('proíbe infra/content/official-content-registry.js de importar createOfficialSourceCapabilities', async () => {
    const violations = await analyze({
      'infra/content/official-content-registry.js':
        "import { createOfficialSourceCapabilities } from '../../content/capabilities.js';\n" +
        'export const c = createOfficialSourceCapabilities();\n',
    });
    assert.equal(violations.length >= 1, true);
    assert.equal(violations[0].rule, 'official-capability-restricted-reference');
    assert.match(violations[0].file, /official-content-registry\.js$/);
    assert.match(violations[0].detail, /createOfficialSourceCapabilities/);
  });

  test('proíbe uma fonte HTTP de importar o canal de autorização', async () => {
    const violations = await analyze({
      'infra/content/http-content-source.js':
        "import { createOfficialHandlerAuthorizationChannel } from '../../content/official-handler-authorization.js';\n" +
        'export const channel = createOfficialHandlerAuthorizationChannel();\n',
    });
    const rules = violations.map((violation) => violation.rule);
    assert.equal(rules.includes('official-capability-restricted-reference'), true);
    assert.equal(rules.includes('official-capability-restricted-module-import'), true);
  });

  test('proíbe o domínio de chamar a fábrica mesmo sem import (identificador global)', async () => {
    const violations = await analyze({
      'domain/regra.js': 'export function f() { return createOfficialSourceCapabilities(); }\n',
    });
    assert.equal(violations.length, 1);
    assert.equal(violations[0].rule, 'official-capability-restricted-reference');
  });

  test('proíbe reexportar as fábricas para lavar a origem do import', async () => {
    const violations = await analyze({
      'content/atalho.js': "export * from './capabilities.js';\n",
      'content/atalho2.js': "export { createOfficialSourceCapabilities as fabrica } from './capabilities.js';\n",
    });
    const arquivos = violations.map((violation) => violation.file);
    assert.equal(arquivos.some((file) => /atalho\.js$/.test(file)), true, 'export * não pode passar');
    assert.equal(arquivos.some((file) => /atalho2\.js$/.test(file)), true, 'export renomeado não pode passar');
    assert.equal(
      violations.some((violation) => violation.rule === 'official-capability-restricted-reexport'),
      true,
    );
  });

  test('proíbe qualquer import do módulo do canal fora do composition root', async () => {
    const violations = await analyze({
      'content/registry.js': "import './official-handler-authorization.js';\n",
      'infra/adaptador.js': "export const carregar = () => import('../content/official-handler-authorization.js');\n",
    });
    const arquivos = violations
      .filter((violation) => violation.rule === 'official-capability-restricted-module-import')
      .map((violation) => violation.file);
    assert.equal(arquivos.some((file) => /content[\\/]registry\.js$/.test(file)), true);
    assert.equal(arquivos.some((file) => /infra[\\/]adaptador\.js$/.test(file)), true);
  });

  test('REGRESSÃO: arquivo FORA de camada com import dinâmico interpolado para módulo restrito é pego', async () => {
    // Repro exato da revisão: `site/js/ficha.js` é um dos 18 arquivos do
    // monólito plano, fora de qualquer camada conhecida. Antes, a emissão de
    // `dynamic-import-unresolvable` ficava depois do `continue` de "arquivo
    // fora de camada", então este caso produzia ZERO violação.
    const violations = await analyze({
      // eslint-disable-next-line no-template-curly-in-string -- specifier de teste
      'ficha.js': "export const c = () => import(`./content/official-handler-${'authorization'}.js`);\n",
    });
    assert.equal(violations.length >= 1, true, 'arquivo fora de camada não pode escapar da regra');
    assert.equal(violations[0].rule, 'official-capability-restricted-dynamic-import');
    assert.match(violations[0].file, /ficha\.js$/);
  });

  test('REGRESSÃO: o mesmo import dinâmico interpolado dentro de uma camada continua pego', async () => {
    const violations = await analyze({
      // eslint-disable-next-line no-template-curly-in-string -- specifier de teste
      'infra/carregador.js': "export const c = () => import(`../content/official-handler-${'authorization'}.js`);\n",
    });
    assert.equal(
      violations.some((violation) => violation.rule === 'official-capability-restricted-dynamic-import'),
      true,
    );
  });

  test('REGRESSÃO: dynamic-import-unresolvable também é emitido para arquivo fora de camada', async () => {
    const dir = makeFakeSiteJs({
      // eslint-disable-next-line no-template-curly-in-string -- specifier de teste
      'vendor/qualquer.js': 'export const c = (n) => import(`./modulo-${n}.js`);\n',
    });
    tempDirs.push(dir);
    const violations = await analyzeDirectory(dir);
    assert.equal(
      violations.some((violation) => violation.rule === 'dynamic-import-unresolvable'),
      true,
    );
  });

  test('proíbe import de namespace de um módulo que define fábrica restrita', async () => {
    const violations = await analyze({
      'domain/regra.js': "import * as caps from '../content/capabilities.js';\nexport const c = Object.values(caps)[0]();\n",
    });
    assert.equal(
      violations.some((violation) => violation.rule === 'official-capability-restricted-namespace-import'),
      true,
    );
  });

  test('permite importar hasOfficialHandlersCapability de content/capabilities.js', async () => {
    const violations = await analyze({
      'content/registry.js': "import { hasOfficialHandlersCapability } from './capabilities.js';\nexport { hasOfficialHandlersCapability };\n",
    });
    assert.deepEqual(violations, []);
  });

  test('não confunde um identificador que apenas contém o nome como substring', async () => {
    const violations = await analyze({
      'domain/regra.js': 'export const createOfficialSourceCapabilitiesDocs = 1;\nexport const x = createOfficialSourceCapabilitiesDocs;\n',
    });
    assert.deepEqual(violations, []);
  });

  test('menção em comentário não conta como uso', async () => {
    const violations = await analyze({
      'domain/regra.js': '// Só o app-context chama createOfficialSourceCapabilities().\nexport const x = 1;\n',
    });
    assert.deepEqual(violations, []);
  });

  test('a violação relatada tem arquivo, regra e detalhe', async () => {
    const [violation] = await analyze({
      'ui/tela.js': 'export const c = createOfficialHandlerAuthorizationChannel();\n',
    });
    assert.ok(violation.file);
    assert.ok(violation.rule);
    assert.ok(violation.detail);
  });
});

describe('regra de arquitetura: repositório real', () => {
  test('o repositório atual não viola a regra de capacidade oficial', async () => {
    const violations = capabilityViolations(await analyzeDirectory(path.join(repoRoot, 'site', 'js')));
    assert.deepEqual(violations, []);
  });

  test('check:architecture continua passando no repositório real', () => {
    const result = spawnSync(process.execPath, ['scripts/check-architecture.mjs'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`);
  });
});
