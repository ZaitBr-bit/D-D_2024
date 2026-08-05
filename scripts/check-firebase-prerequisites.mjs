#!/usr/bin/env node
// Preflight EXTERNO da suíte de Firestore Emulator (`npm run test:firebase`).
//
// Ele roda ANTES do `firebase emulators:exec` e aborta com uma mensagem
// objetiva quando o ambiente não é exatamente o esperado. A motivação é
// concreta: com a versão errada de Java o Emulator falha de um jeito
// obscuro (ou pior, degrada silenciosamente), e um project id que não
// comece por `demo-` faria o SDK falar com um projeto Firebase REAL em vez
// do Emulator. Preferimos falhar cedo, alto e com instrução.
//
// Este preflight NÃO exige `FIRESTORE_EMULATOR_HOST`: essa variável é
// injetada pelo `emulators:exec` apenas no processo FILHO (os testes), não
// existe aqui, e exigi-la produziria uma falha falsa. O guard equivalente
// dentro dos testes (que rodam no filho) é responsabilidade deles.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export const REQUIRED_JAVA_MAJOR = 21;
export const REQUIRED_PROJECT_ID = 'demo-dnd-refactor';
export const REQUIRED_EMULATOR_HOST = '127.0.0.1';
export const REQUIRED_EMULATOR_PORT = 8085;
export const REQUIRED_RULES_PATH = 'tests/firebase/firestore.rules';

/**
 * Extrai a versão MAIOR do Java a partir da saída de `java -version`.
 * Cobre os dois formatos históricos: `"1.8.0_202"` (major 8, esquema
 * antigo) e `"21.0.2"` (major 21, esquema moderno). Devolve `null` quando
 * a saída não é reconhecível — nunca um número plausível chutado, porque
 * um palpite errado aqui deixaria passar exatamente o caso que este
 * preflight existe para barrar.
 * @param {string} versionOutput - stdout+stderr de `java -version`.
 * @returns {number|null}
 */
export function parseJavaMajorVersion(versionOutput) {
  if (typeof versionOutput !== 'string') {
    return null;
  }
  const match = /version\s+"(\d+)(?:\.(\d+))?[^"]*"/i.exec(versionOutput);
  if (match === null) {
    return null;
  }
  const first = Number(match[1]);
  if (first === 1) {
    const second = Number(match[2]);
    return Number.isInteger(second) ? second : null;
  }
  return Number.isInteger(first) ? first : null;
}

/**
 * Executa `java -version` e devolve a saída combinada. `java` escreve a
 * versão em stderr na maioria das distribuições, então as duas correntes
 * são concatenadas.
 * @returns {Promise<{available: boolean, output: string}>}
 */
function readJavaVersionOutput() {
  return new Promise((resolve) => {
    execFile('java', ['-version'], { timeout: 20000 }, (error, stdout, stderr) => {
      const output = `${stdout ?? ''}${stderr ?? ''}`;
      if (error && output.trim().length === 0) {
        resolve({ available: false, output: String(error.message ?? error) });
        return;
      }
      resolve({ available: true, output });
    });
  });
}

/**
 * Lê e faz o parse de um JSON do repositório, devolvendo `null` se ausente
 * ou inválido (o chamador transforma isso num problema descrito).
 * @param {string} relativePath
 * @returns {Promise<*|null>}
 */
async function readJsonOrNull(relativePath) {
  try {
    return JSON.parse(await readFile(path.join(repoRoot, relativePath), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Roda todas as verificações e devolve a lista de problemas encontrados
 * (vazia = ambiente pronto). Nenhuma verificação interrompe as outras: o
 * usuário vê de uma vez tudo o que precisa corrigir.
 * @returns {Promise<{ok: boolean, problems: ReadonlyArray<string>, javaMajor: number|null}>}
 */
export async function runPreflight() {
  const problems = [];

  // --- Java 21 -----------------------------------------------------------
  const java = await readJavaVersionOutput();
  let javaMajor = null;
  if (!java.available) {
    problems.push(
      `Java não foi encontrado no PATH. O Firestore Emulator exige Java ${REQUIRED_JAVA_MAJOR}.\n` +
        `  Instale o Temurin ${REQUIRED_JAVA_MAJOR} (https://adoptium.net) e garanta que "java -version" responda ${REQUIRED_JAVA_MAJOR}.x.\n` +
        `  Detalhe: ${java.output.trim()}`,
    );
  } else {
    javaMajor = parseJavaMajorVersion(java.output);
    if (javaMajor === null) {
      problems.push(
        `Não foi possível determinar a versão do Java a partir de "java -version".\n` +
          `  Saída recebida: ${java.output.trim()}\n` +
          `  Este preflight não adivinha: corrija o ambiente para que a versão seja legível.`,
      );
    } else if (javaMajor !== REQUIRED_JAVA_MAJOR) {
      problems.push(
        `Java ${javaMajor} está ativo, mas o Firestore Emulator exige Java ${REQUIRED_JAVA_MAJOR}.\n` +
          `  Instale o Temurin ${REQUIRED_JAVA_MAJOR} (https://adoptium.net) e aponte JAVA_HOME/PATH para ele antes de rodar "npm run test:firebase".\n` +
          `  O arquivo .java-version deste repositório fixa a versão esperada (${REQUIRED_JAVA_MAJOR}) para gerenciadores como jenv/asdf.\n` +
          `  Rodar com a versão errada NÃO é suportado: o Emulator falha de forma obscura, então este preflight barra antes.`,
      );
    }
  }

  // --- .java-version -----------------------------------------------------
  try {
    const pinned = (await readFile(path.join(repoRoot, '.java-version'), 'utf8')).trim();
    if (pinned !== String(REQUIRED_JAVA_MAJOR)) {
      problems.push(`.java-version deveria conter exatamente "${REQUIRED_JAVA_MAJOR}", mas contém "${pinned}".`);
    }
  } catch {
    problems.push('.java-version está ausente; ele fixa a versão de Java esperada para gerenciadores como jenv/asdf.');
  }

  // --- firebase.json -----------------------------------------------------
  const firebaseConfig = await readJsonOrNull('firebase.json');
  if (firebaseConfig === null) {
    problems.push('firebase.json está ausente ou não é JSON válido.');
  } else {
    const firestoreEmulator = firebaseConfig.emulators?.firestore;
    if (!firestoreEmulator) {
      problems.push('firebase.json não configura "emulators.firestore".');
    } else {
      if (firestoreEmulator.host !== REQUIRED_EMULATOR_HOST) {
        problems.push(
          `firebase.json: "emulators.firestore.host" deveria ser "${REQUIRED_EMULATOR_HOST}" (loopback explícito), mas é "${firestoreEmulator.host}".`,
        );
      }
      if (firestoreEmulator.port !== REQUIRED_EMULATOR_PORT) {
        problems.push(
          `firebase.json: "emulators.firestore.port" deveria ser ${REQUIRED_EMULATOR_PORT}, mas é ${firestoreEmulator.port}.`,
        );
      }
    }
    const rulesPath = firebaseConfig.firestore?.rules;
    if (rulesPath !== REQUIRED_RULES_PATH) {
      problems.push(
        `firebase.json: "firestore.rules" deveria apontar para "${REQUIRED_RULES_PATH}" (regras de TESTE, separadas das de produção), mas aponta para "${rulesPath}".`,
      );
    }
  }

  // --- Projeto obrigatoriamente `demo-` ----------------------------------
  const firebaserc = await readJsonOrNull('.firebaserc');
  const defaultProject = firebaserc?.projects?.default;
  if (typeof defaultProject !== 'string' || defaultProject.length === 0) {
    problems.push('.firebaserc não define "projects.default"; sem isso um comando do firebase-tools poderia cair num projeto real.');
  } else if (defaultProject !== REQUIRED_PROJECT_ID) {
    problems.push(
      `.firebaserc: o projeto padrão deveria ser "${REQUIRED_PROJECT_ID}", mas é "${defaultProject}".\n` +
        `  Um projeto que não começa por "demo-" faz o SDK falar com um Firebase REAL em vez do Emulator.`,
    );
  }

  const packageJson = await readJsonOrNull('package.json');
  const testFirebaseScript = packageJson?.scripts?.['test:firebase'];
  if (typeof testFirebaseScript !== 'string') {
    problems.push('package.json não define o script "test:firebase".');
  } else {
    if (!testFirebaseScript.includes(`--project ${REQUIRED_PROJECT_ID}`)) {
      problems.push(`package.json: o script "test:firebase" precisa passar "--project ${REQUIRED_PROJECT_ID}" explicitamente.`);
    }
    const projectMatch = /--project\s+(\S+)/.exec(testFirebaseScript);
    if (projectMatch !== null && !projectMatch[1].startsWith('demo-')) {
      problems.push(
        `package.json: o script "test:firebase" aponta para o projeto "${projectMatch[1]}", que não começa por "demo-". Isso falaria com um Firebase REAL.`,
      );
    }
  }

  return { ok: problems.length === 0, problems: Object.freeze(problems), javaMajor };
}

async function main() {
  const { ok, problems } = await runPreflight();
  if (ok) {
    console.log('[check-firebase-prerequisites] Ambiente pronto: Java 21, firebase.json e projeto demo-dnd-refactor conferidos.');
    return;
  }

  console.error('[check-firebase-prerequisites] Pré-requisitos do Firestore Emulator NÃO atendidos:\n');
  for (const [index, problem] of problems.entries()) {
    console.error(`  ${index + 1}. ${problem}\n`);
  }
  console.error(
    'A suíte "npm run test:firebase" foi ABORTADA de propósito. Alternativa sem Java 21 local:\n' +
      '  faça o push do workflow .github/workflows/firebase-emulator-check.yml (ou empurre uma tag\n' +
      '  "firebase-emulator-*") e use o resultado verde do GitHub Actions, que instala o Temurin 21.\n',
  );
  process.exitCode = 1;
}

const isMainModule =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  main();
}
