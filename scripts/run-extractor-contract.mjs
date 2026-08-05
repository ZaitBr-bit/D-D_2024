#!/usr/bin/env node
// `npm run test:extractor`: localiza um CPython >=3.12.0 <4.0.0 compatível
// no host (nunca assume um caminho fixo — o app, o servidor local e o build
// Pages não dependem de Python; só este teste de contrato do extrator
// precisa dele) e roda `tests/contract/extractor-safety.test.js` com o
// executável resolvido exposto via variável de ambiente
// `EXTRACTOR_PYTHON_EXECUTABLE`.
//
// Ordem de busca (primeiro candidato que responder com uma versão válida
// vence):
//   1. `py -3.12` (Windows, launcher oficial) / `python3.12` (demais SOs) —
//      a versão PREFERIDA, fixada em `.python-version`.
//   2. `py -3` (Windows) / `python3` (demais SOs) — qualquer Python 3 do
//      launcher/PATH.
//   3. `python` — último recurso, comum em instalações Windows sem o alias
//      `python3`.
// Cada candidato é executado com `--version` (nunca só "existe no PATH":
// alguns launchers respondem a `--version` mesmo sem o interpretador
// pedido estar instalado, daí conferir a STRING de versão devolvida, não
// só o código de saída) e o resultado é aceito se for um CPython cuja
// versão reportada satisfaça `>=3.12.0 <4.0.0` — não é uma comparação de
// string exata com "3.12", para que um Python 3.12.x ou 3.13.x (como o do
// host de CI atual) passem igualmente.

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/**
 * Candidatos de comando Python, na ordem de preferência descrita no
 * comentário de topo. Cada candidato é `{command, args}` — o launcher do
 * Windows (`py`) recebe a versão como argumento posicional (`-3.12`/`-3`),
 * enquanto os demais binários já têm a versão no próprio nome do comando.
 * @returns {Array<{label: string, command: string, args: string[]}>}
 */
function candidatosPython() {
  const noWindows = process.platform === 'win32';
  if (noWindows) {
    return [
      { label: 'py -3.12', command: 'py', args: ['-3.12'] },
      { label: 'py -3', command: 'py', args: ['-3'] },
      { label: 'python', command: 'python', args: [] },
    ];
  }
  return [
    { label: 'python3.12', command: 'python3.12', args: [] },
    { label: 'python3', command: 'python3', args: [] },
    { label: 'python', command: 'python', args: [] },
  ];
}

/**
 * Faz o parse de uma string de versão do CPython ("Python 3.13.9\n") em
 * `{major, minor, patch}`, ou devolve `null` se a string não bater com o
 * formato esperado (candidato rejeitado, nunca lançado como erro fatal —
 * só descartado da busca).
 * @param {string} texto
 * @returns {{major:number, minor:number, patch:number}|null}
 */
export function parseVersaoPython(texto) {
  const match = /^Python\s+(\d+)\.(\d+)\.(\d+)/.exec(texto.trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

/**
 * `>=3.12.0 <4.0.0` — aceita qualquer patch/minor de CPython 3.12+, rejeita
 * 3.11 ou anterior e qualquer major 4+ futuro (o brief pede uma faixa, não
 * um match exato com "3.12").
 * @param {{major:number, minor:number, patch:number}} versao
 * @returns {boolean}
 */
export function versaoCompativel(versao) {
  if (versao.major !== 3) return false;
  return versao.minor >= 12;
}

/**
 * Testa um único candidato (`--version`) e devolve `{command, args,
 * versionString, version}` se ele existir e reportar uma versão CPython
 * compatível, ou `null` caso contrário (comando ausente no PATH, versão
 * incompatível, ou saída não reconhecida). Nunca lança.
 * @param {{command: string, args: string[]}} candidato
 * @returns {{command: string, args: string[], versionString: string, version: object}|null}
 */
function testarCandidato(candidato) {
  let resultado;
  try {
    resultado = spawnSync(candidato.command, [...candidato.args, '--version'], { encoding: 'utf8' });
  } catch {
    return null;
  }
  if (resultado.error || resultado.status !== 0) return null;
  // CPython imprime a versão em stdout na maioria das plataformas, mas
  // versões antigas do Windows a imprimem em stderr — checa os dois.
  const saida = `${resultado.stdout ?? ''}${resultado.stderr ?? ''}`;
  const versao = parseVersaoPython(saida);
  if (!versao || !versaoCompativel(versao)) return null;
  return { command: candidato.command, args: candidato.args, versionString: saida.trim(), version: versao };
}

/**
 * Localiza o primeiro CPython >=3.12.0 <4.0.0 disponível, na ordem de
 * `candidatosPython()`. Devolve `null` se nenhum candidato compatível for
 * encontrado (nunca lança) — quem chama decide como reportar isso.
 * @returns {{label: string, command: string, args: string[], versionString: string, version: object}|null}
 */
export function localizarPython() {
  for (const candidato of candidatosPython()) {
    const encontrado = testarCandidato(candidato);
    if (encontrado) return { ...encontrado, label: candidato.label };
  }
  return null;
}

/**
 * Serializa `{command, args}` num único comando invocável por subprocesso
 * (ex.: `"py -3.12"`), formato exposto ao teste via
 * `EXTRACTOR_PYTHON_EXECUTABLE` — o teste faz o split por espaço para
 * reconstruir `command`+`args` (nenhum dos dois candidatos tem espaço no
 * próprio nome, então um split simples é seguro e determinístico).
 * @param {{command: string, args: string[]}} python
 * @returns {string}
 */
export function serializarExecutavel(python) {
  return [python.command, ...python.args].join(' ');
}

async function main() {
  const python = localizarPython();
  if (!python) {
    process.stderr.write(
      'run-extractor-contract: nenhum CPython >=3.12.0 <4.0.0 encontrado (tentado: py -3.12/python3.12, py -3/python3, python). ' +
        'Instale o Python 3.12+ (ver .python-version) para rodar este teste.\n',
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`run-extractor-contract: usando ${python.label} (${python.versionString}).\n`);

  const testFile = path.join(repoRoot, 'tests', 'contract', 'extractor-safety.test.js');
  const child = spawn(process.execPath, [path.join(repoRoot, 'scripts', 'run-node-tests.mjs'), testFile], {
    stdio: 'inherit',
    env: { ...process.env, EXTRACTOR_PYTHON_EXECUTABLE: serializarExecutavel(python) },
  });

  await new Promise((resolve) => {
    child.on('exit', (code) => {
      process.exitCode = code ?? 1;
      resolve();
    });
  });
}

const isDirectCliInvocation =
  typeof process.argv[1] === 'string' &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isDirectCliInvocation) {
  main().catch((error) => {
    process.stderr.write(`run-extractor-contract: erro fatal: ${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
