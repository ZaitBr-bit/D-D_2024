// Contrato de segurança do extrator Python (`_extrair_json.py`, Task 10):
// (a) exige `--source`/`--output` explicitamente (sem default implícito
// que leia/escreva em caminhos fixos do repositório); (b) recusa qualquer
// `--output` que aponte para dentro de `dados/pacotes/dnd2024` (o pacote de
// conteúdo canônico, que só é escrito pelos conversores determinísticos de
// `scripts/content/migrate-*.mjs`); (c) só escreve em disco depois que TODA
// a fonte foi processada com sucesso — uma falha no meio da extração não
// pode deixar saída parcial.
//
// Este teste INVOCA o interpretador Python de verdade como subprocesso
// (nunca só lê o texto-fonte de `_extrair_json.py`) — por isso ele roda via
// `npm run test:extractor` (→ `node scripts/run-extractor-contract.mjs`),
// que localiza um CPython compatível e expõe o executável resolvido via
// `EXTRACTOR_PYTHON_EXECUTABLE`. Rodado diretamente via `node --test`
// (sem passar por `run-extractor-contract.mjs` primeiro), o teste localiza
// o Python sozinho, reaproveitando `localizarPython()`.
//
// Python é uma dependência EXCLUSIVA de `npm run test:extractor` (o brief
// escopa isso explicitamente: "o app, o servidor local e o build Pages não
// dependem de Python") — `npm run test:contract`/`test:node` rodam este
// arquivo também (ele mora em `tests/contract/`), então, num host sem
// nenhum CPython >=3.12 instalado, todo `test()` abaixo (exceto o próprio
// teste de pré-requisito) é registrado com `{ skip: !python }` em vez de
// falhar a suíte padrão — a resolução de `python` acontece de forma
// SÍNCRONA no topo do módulo (antes de qualquer `describe`/`test`), porque
// a opção `skip` precisa ser conhecida no momento do registro do teste, não
// depois via hook `before()` assíncrono.
//
// RED esperado antes desta tarefa: `_extrair_json.py` não aceitava
// `--source`/`--output` (lia/escrevia sempre nos mesmos caminhos fixos do
// repositório, incluindo `dados/`) — todo teste de recusa abaixo falharia
// porque o script simplesmente ignorava os argumentos e escrevia direto em
// `dados/`, sem nunca recusar nada.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { localizarPython } from '../../scripts/run-extractor-contract.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const extractorPath = path.join(repoRoot, '_extrair_json.py');
const realSourcePath = path.join(repoRoot, 'Informacoes Separadas', 'D&D 5.5 - Livro do Jogador (2024) 5.3.7.md');
const canonicalPackageDir = path.join(repoRoot, 'dados', 'pacotes', 'dnd2024');

/**
 * Resolvido de forma SÍNCRONA no carregamento do módulo (ver comentário de
 * topo) — via `EXTRACTOR_PYTHON_EXECUTABLE` quando rodado através de
 * `npm run test:extractor`, ou via `localizarPython()` quando rodado
 * diretamente (`node --test`/`test:contract`/`test:node`).
 * @type {{command: string, args: string[]}|null}
 */
const python = (() => {
  const envExecutable = process.env.EXTRACTOR_PYTHON_EXECUTABLE;
  if (envExecutable) {
    const [command, ...args] = envExecutable.split(' ');
    return { command, args };
  }
  return localizarPython();
})();

/** Opções de `test()` para pular todo teste que precise invocar Python quando nenhum CPython compatível foi encontrado. */
const semPythonSkip = { skip: python ? false : 'nenhum CPython >=3.12.0 <4.0.0 encontrado no host (ver .python-version); rode via `npm run test:extractor` ou instale Python 3.12+.' };

/**
 * Roda `_extrair_json.py` como subprocesso com os argumentos dados,
 * devolvendo `{status, stdout, stderr}`. Nunca lança — um `spawnSync` que
 * falhar por Python ausente é reportado via `status !== 0`/`error`.
 * @param {string[]} args
 * @returns {{status: number|null, stdout: string, stderr: string}}
 */
function rodarExtrator(args) {
  const resultado = spawnSync(python.command, [...python.args, extractorPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return { status: resultado.status, stdout: resultado.stdout ?? '', stderr: resultado.stderr ?? '' };
}

describe('extractor-safety — pré-requisito: CPython >=3.12 disponível no host', () => {
  // Este teste NUNCA é pulado — é o que documenta, num host sem Python, por
  // que todos os demais desta suíte aparecem como "skipped" em vez de
  // "passed" (não um falso positivo silencioso).
  test('localizarPython() encontra um interpretador (senão, todos os demais testes deste arquivo são pulados)', () => {
    if (!python) {
      // `test:contract`/`test:node` continuam verdes num host sem Python —
      // só documenta a ausência em stdout, nunca falha a suíte padrão por
      // uma dependência que o brief escopou só para `test:extractor`.
      console.log('extractor-safety: nenhum CPython >=3.12.0 <4.0.0 encontrado — os demais testes deste arquivo foram pulados.');
      return;
    }
    assert.ok(python);
  });
});

describe('extractor-safety — --source/--output são obrigatórios', () => {
  test('sem nenhum argumento: recusa (exit != 0), menciona --source e --output', semPythonSkip, () => {
    const r = rodarExtrator([]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /--source/);
    assert.match(r.stderr, /--output/);
  });

  test('só --source (sem --output): recusa (exit != 0)', semPythonSkip, () => {
    const r = rodarExtrator(['--source', realSourcePath]);
    assert.notEqual(r.status, 0);
  });

  test('só --output (sem --source): recusa (exit != 0)', semPythonSkip, () => {
    const r = rodarExtrator(['--output', path.join(repoRoot, '.tmp', 'content-staging', 'x')]);
    assert.notEqual(r.status, 0);
  });
});

describe('extractor-safety — recusa escrever dentro de dados/pacotes/dnd2024', () => {
  test('--output == dados/pacotes/dnd2024 exatamente: recusa, sem tocar no pacote', semPythonSkip, async () => {
    const antes = (await readdir(canonicalPackageDir)).sort();
    const r = rodarExtrator(['--source', realSourcePath, '--output', canonicalPackageDir]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /dnd2024/);
    const depois = (await readdir(canonicalPackageDir)).sort();
    assert.deepEqual(depois, antes, 'o pacote canônico não pode ser tocado pela extração recusada');
  });

  test('--output == subdiretório de dados/pacotes/dnd2024 (ex.: .../spells): recusa', semPythonSkip, async () => {
    const antes = (await readdir(canonicalPackageDir)).sort();
    const r = rodarExtrator(['--source', realSourcePath, '--output', path.join(canonicalPackageDir, 'spells')]);
    assert.notEqual(r.status, 0);
    const depois = (await readdir(canonicalPackageDir)).sort();
    assert.deepEqual(depois, antes);
  });

  test('--output com ".." que resolve para dentro do pacote: recusa (a checagem usa realpath, não string)', semPythonSkip, async () => {
    const antes = (await readdir(canonicalPackageDir)).sort();
    const disfarcado = path.join(repoRoot, 'dados', 'pacotes', 'outro-pacote', '..', 'dnd2024');
    const r = rodarExtrator(['--source', realSourcePath, '--output', disfarcado]);
    assert.notEqual(r.status, 0);
    const depois = (await readdir(canonicalPackageDir)).sort();
    assert.deepEqual(depois, antes);
  });
});

describe('extractor-safety — falha na extração não deixa saída parcial', () => {
  let dirTemp;
  before(async () => {
    if (!python) return;
    dirTemp = await mkdtemp(path.join(tmpdir(), 'extractor-safety-'));
  });

  test('--source vazio: recusa (exit != 0) e não cria o diretório de saída', semPythonSkip, async () => {
    const fonteVazia = path.join(dirTemp, 'vazio.md');
    await writeFile(fonteVazia, '', 'utf8');
    const destino = path.join(dirTemp, 'staging-vazio');

    const r = rodarExtrator(['--source', fonteVazia, '--output', destino]);
    assert.notEqual(r.status, 0);

    await assert.rejects(readdir(destino), /ENOENT/, 'o diretório de saída não deve existir após uma falha (nenhuma escrita parcial)');
  });

  test('--source inexistente: recusa (exit != 0)', semPythonSkip, () => {
    const r = rodarExtrator(['--source', path.join(dirTemp, 'nao-existe.md'), '--output', path.join(dirTemp, 'staging-inexistente')]);
    assert.notEqual(r.status, 0);
  });
});

describe('extractor-safety — extração completa e bem-sucedida escreve em .tmp/content-staging/', () => {
  let destino;
  before(() => {
    destino = path.join(repoRoot, '.tmp', 'content-staging', `contract-test-${process.pid}`);
  });

  test('fonte real completa: exit 0, produz os arquivos esperados de magias/equipamento/apêndices', semPythonSkip, async () => {
    const r = rodarExtrator(['--source', realSourcePath, '--output', destino]);
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);

    const magias = await readdir(path.join(destino, 'magias'));
    assert.ok(magias.includes('truques.json'));
    assert.ok(magias.includes('_indice.json'));
    const apendices = await readdir(path.join(destino, 'apendices'));
    assert.ok(apendices.includes('criaturas.json'));
    assert.ok(apendices.includes('glossario.json'));

    await rm(destino, { recursive: true, force: true });
  });
});
