#!/usr/bin/env node
// Verifica regras de arquitetura em `site/js`: a direção das dependências
// entre camadas (core -> content -> domain -> infra/features/ui -> pages);
// que `domain/**` nunca importe de `infra`, `ui`, `features` ou `pages`, nem
// referencie os globais de navegador `window`, `document`, `localStorage`,
// `fetch` ou `firebase`; e que as duas fábricas de capacidade oficial
// (`createOfficialSourceCapabilities` e
// `createOfficialHandlerAuthorizationChannel`) só sejam importadas/chamadas
// pelo composition root `site/js/app-context.js`.
//
// Funciona mesmo quando só parte das camadas existe (hoje só `core/`
// existe; as demais são criadas por tarefas futuras): apenas os
// subdiretórios de camada realmente presentes são considerados, e arquivos
// que não estão sob nenhuma camada conhecida (o monólito plano em
// `site/js/*.js`, ou `site/js/vendor/**`) não são avaliados por estas
// regras.
//
// Limitações conhecidas (detecção por regex, não por AST — não há parser
// JS disponível como dependência do projeto):
//   - `require()` não é escaneado (baixo risco: o projeto é 100% ESM, ver
//     `"type": "module"` em package.json).
//   - `stripComments` não é ciente de string literais: um `//` ou `/*`
//     dentro de uma string poderia, em teoria, truncar o trecho escaneado.
//     Não é explorável para burlar a detecção de import hoje (imports são
//     sempre no nível de statement, fora de strings), mas vale registrar.
//   - A regra de capacidade oficial casa o IDENTIFICADOR das fábricas. Um
//     acesso construído dinamicamente (`caps['createOfficial' + 'Source...']`)
//     escaparia da regex. O caminho mais óbvio para chegar até aí —
//     `import * as caps from './capabilities.js'` — é bloqueado pela regra
//     `official-capability-restricted-namespace-import`, mas concatenação de
//     string sobre um import nomeado legítimo não é detectável por regex.
//     Isso não é um bypass do modelo de segurança em si (o token continua
//     inalcançável em tempo de execução e `hasOfficialHandlersCapability`
//     continua exigindo identidade de objeto), é um limite do scanner
//     estático; um trecho assim é gritante em revisão de código.
//   - A allowlist (`site/js/app-context.js`) pode, em tese, "lavar" a fábrica
//     sob outro nome (`export const mint = createOfficialSourceCapabilities;`)
//     e outros módulos importarem `mint` sem serem detectados. Reexport do
//     nome original É detectado; a lavagem sob apelido não é. O risco é
//     baixo por construção: quem lava já precisa SER o composition root
//     confiável. Fica registrado para não se presumir a regra hermética.
//   - Não foi possível isolar `createOfficialSourceCapabilities` num módulo
//     próprio (que entraria em RESTRICTED_MODULES) porque o token e o WeakSet
//     de identidade teriam de atravessar a fronteira de módulo por um export,
//     justamente o que hoje os mantém inalcançáveis. Manter tudo num só
//     fechamento é a opção mais forte em runtime; o custo é este limite do
//     scanner.

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// Ordem das camadas e, para cada uma, o conjunto de camadas de onde ela tem
// permissão de importar (sempre incluindo a si mesma). Camadas ausentes no
// disco são simplesmente ignoradas — a regra só é aplicada a quem existe.
//
// `features -> ui` foi liberado na Task 25, quando a camada `features` passou
// a existir de fato. Um controller de feature (`features/creator/**`) É código
// de apresentação: ele precisa das PRIMITIVAS SEGURAS de `ui/**` —
// `escapeHtml`/`escapeHtmlAttribute` (Task 24), `delegate`/
// `applyUiEventDecision` e o `ModalService`. Proibir o import não tornaria a
// camada mais pura; tornaria mais provável que um passo montasse markup por
// interpolação crua ou chamasse `addEventListener` direto, que é exatamente o
// que a Task 24 acabou de eliminar.
//
// A direção essencial continua intacta e é o que importa: `ui` NÃO pode
// importar `features` (nem `pages`), então não há ciclo; `domain` continua
// sem enxergar `ui`, `infra` ou `features`; e ninguém importa `pages`.
const ALLOWED_IMPORTS_BY_LAYER = {
  core: ['core'],
  content: ['core', 'content'],
  domain: ['core', 'content', 'domain'],
  infra: ['core', 'content', 'domain', 'infra'],
  features: ['core', 'content', 'domain', 'infra', 'features', 'ui'],
  ui: ['core', 'content', 'domain', 'infra', 'ui'],
  pages: ['core', 'content', 'domain', 'infra', 'features', 'ui', 'pages'],
};
const KNOWN_LAYERS = new Set(Object.keys(ALLOWED_IMPORTS_BY_LAYER));

// Globais de navegador proibidos dentro de `domain/**` — código de domínio
// deve ser puro e testável sem DOM/rede/storage/SDKs externos.
const FORBIDDEN_DOMAIN_GLOBALS = ['window', 'document', 'localStorage', 'fetch', 'firebase'];
const FORBIDDEN_GLOBAL_PATTERN = new RegExp(`\\b(${FORBIDDEN_DOMAIN_GLOBALS.join('|')})\\b`, 'g');

const JS_EXTENSION_PATTERN = /\.(mjs|js)$/;

// --- Regra de capacidade oficial (Task 6) ---------------------------------
//
// `createOfficialSourceCapabilities()` cria o token opaco `officialHandlers`
// e `createOfficialHandlerAuthorizationChannel()` cria o par `issue`/`verify`
// que autoriza a execução de handlers oficiais. Ambas são a fronteira entre
// "conteúdo do nosso pacote oficial" e "conteúdo qualquer vindo de JSON":
// quem consegue chamá-las consegue fabricar privilégio. Por isso o único
// módulo de produção autorizado é o composition root; os testes de segurança
// ficam fora de `site/js` e, portanto, fora deste scanner.
//
// A regra é aplicada a TODOS os arquivos sob `site/js`, inclusive os que não
// estão em nenhuma camada conhecida (monólito plano em `site/js/*.js`), e é
// fechada por padrão: allowlist explícita, nunca blocklist.

// Caminho (relativo a `site/js`, POSIX) de cada módulo que DEFINE uma das
// fábricas restritas — só ele pode mencionar o próprio identificador.
const RESTRICTED_FACTORY_DEFINITIONS = Object.freeze({
  createOfficialSourceCapabilities: 'content/capabilities.js',
  createOfficialHandlerAuthorizationChannel: 'content/official-handler-authorization.js',
});

// Módulos cujo import é restrito por inteiro (todo o conteúdo exportado é
// privilegiado). `content/capabilities.js` fica de fora porque também exporta
// `hasOfficialHandlersCapability`/`createSourceCapabilities`, que qualquer
// módulo pode usar sem ganhar privilégio.
const RESTRICTED_MODULES = Object.freeze(['content/official-handler-authorization.js']);

// Únicos arquivos de produção autorizados a importar/chamar as fábricas.
const OFFICIAL_CAPABILITY_ALLOWLIST = Object.freeze(['app-context.js']);

// Reexport (`export ... from '...'`) é detectado à parte porque `export * from`
// republica a fábrica sem jamais escrever o nome dela.
const REEXPORT_PATTERN = /\bexport\s+(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*(['"`])([^'"`]+)\1/g;

// Import de namespace (`import * as caps from '...'`): dá acesso a todos os
// exports do módulo sem escrever o nome de nenhum deles.
const NAMESPACE_IMPORT_PATTERN = /\bimport\s+\*\s+as\s+([\w$]+)\s+from\s*(['"`])([^'"`]+)\2/g;

/**
 * Lista recursivamente todos os arquivos `.js`/`.mjs` sob `dir`.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function walkDirectory(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const found = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await walkDirectory(fullPath)));
    } else if (entry.isFile() && JS_EXTENSION_PATTERN.test(entry.name)) {
      found.push(fullPath);
    }
  }
  return found;
}

/**
 * Remove comentários de linha (`//...`) e de bloco (`/*...*\/`) do código
 * fonte antes da análise por regex, para reduzir falsos positivos ao
 * procurar por globais proibidos em comentários (ex.: um comentário em
 * português mencionando a palavra "window" na prosa).
 * @param {string} source
 * @returns {string}
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// Aceitam aspas simples, duplas ou crase (template literal) como
// delimitador do specifier — embora specifiers estáticos só sejam válidos
// em JS com aspas simples/duplas, aceitamos crase aqui também por
// tolerância/consistência com o padrão dinâmico abaixo.
const FROM_IMPORT_PATTERN = /\bfrom\s+['"`]([^'"`]+)['"`]/g;
const BARE_IMPORT_PATTERN = /\bimport\s+['"`]([^'"`]+)['"`]/g;
// Captura o tipo de aspas usado (grupo 1) e o conteúdo (grupo 2), para que
// `import(\`...${x}...\`)` com interpolação possa ser distinguido de um
// specifier literal resolvível.
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*(['"`])([\s\S]*?)\1\s*\)/g;

/**
 * Extrai todos os specifiers importados (estáticos `import`/`export ... from`
 * e dinâmicos `import(...)`) de um trecho de código já sem comentários.
 * Specifiers dinâmicos com template literal contendo interpolação
 * (`` `${x}` ``) não têm como ser resolvidos estaticamente, então são
 * retornados separadamente em `unresolvableDynamic` em vez de tratados como
 * um specifier normal — quem chamar deve tratá-los como violação (força
 * revisão humana) em vez de silenciosamente ignorá-los.
 * @param {string} source
 * @returns {{specifiers: string[], unresolvableDynamic: string[]}}
 */
function extractImportSpecifiers(source) {
  const specifiers = [];
  const unresolvableDynamic = [];

  for (const pattern of [FROM_IMPORT_PATTERN, BARE_IMPORT_PATTERN]) {
    pattern.lastIndex = 0;
    let match = pattern.exec(source);
    while (match) {
      specifiers.push(match[1]);
      match = pattern.exec(source);
    }
  }

  DYNAMIC_IMPORT_PATTERN.lastIndex = 0;
  let dynamicMatch = DYNAMIC_IMPORT_PATTERN.exec(source);
  while (dynamicMatch) {
    const [, quote, content] = dynamicMatch;
    if (quote === '`' && content.includes('${')) {
      unresolvableDynamic.push(content);
    } else {
      specifiers.push(content);
    }
    dynamicMatch = DYNAMIC_IMPORT_PATTERN.exec(source);
  }

  return { specifiers, unresolvableDynamic };
}

/**
 * Dado um caminho absoluto de arquivo dentro de `siteJsDir`, retorna o nome
 * da camada (primeiro segmento do caminho relativo) se for uma camada
 * conhecida, ou `null` caso contrário (arquivo fora de qualquer camada,
 * como o monólito plano ou `vendor/`).
 * @param {string} siteJsDir
 * @param {string} absoluteFilePath
 * @returns {string | null}
 */
function layerOf(siteJsDir, absoluteFilePath) {
  const relative = path.relative(siteJsDir, absoluteFilePath);
  const [first] = relative.split(path.sep);
  return KNOWN_LAYERS.has(first) ? first : null;
}

/**
 * Resolve um specifier relativo (`./x`, `../y`) para um caminho absoluto de
 * arquivo existente sob `siteJsDir`, tentando `.js` e `/index.js` quando o
 * caminho exato não tem extensão. Retorna `null` se não resolver para um
 * arquivo dentro de `siteJsDir` (specifier externo/pacote, ou arquivo não
 * encontrado — não é papel desta checagem validar resolução de módulos).
 * @param {string} siteJsDir
 * @param {string} fromFile
 * @param {string} specifier
 * @returns {Promise<string | null>}
 */
async function resolveRelativeSpecifier(siteJsDir, fromFile, specifier) {
  if (!specifier.startsWith('.')) {
    return null;
  }
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, `${base}.js`, `${base}.mjs`, path.join(base, 'index.js')];
  for (const candidate of candidates) {
    try {
      const stats = await stat(candidate);
      if (stats.isFile()) {
        return candidate;
      }
    } catch {
      // tenta o próximo candidato
    }
  }
  // Não encontrado no disco: ainda assim, se estiver sob siteJsDir, resolve
  // "melhor esforço" para o candidato com `.js`, para não perder violações
  // de arquivos referenciados que ainda serão criados por tarefas futuras.
  const bestEffort = `${base}.js`;
  return bestEffort.startsWith(siteJsDir + path.sep) ? bestEffort : null;
}

/**
 * Aplica a regra de capacidade oficial a um único arquivo.
 *
 * São três checagens complementares, todas fechadas por padrão:
 *   1. `official-capability-restricted-reference`: o identificador de uma das
 *      fábricas aparece no código (import nomeado, chamada, reexport
 *      nomeado). Só o módulo que a define e a allowlist escapam.
 *   2. `official-capability-restricted-reexport`: o arquivo republica um dos
 *      módulos restritos (`export * from ...`), o que lavaria a origem do
 *      import sem nunca escrever o nome da fábrica.
 *   3. `official-capability-restricted-module-import`: o arquivo importa
 *      (estática ou dinamicamente) um módulo cujo conteúdo é integralmente
 *      privilegiado.
 *
 * @param {{siteJsDir: string, file: string, source: string, relativeFile: string, siteRelativeFile: string, specifiers: ReadonlyArray<string>, unresolvableDynamic: ReadonlyArray<string>}} params
 * @returns {Promise<Array<{file: string, rule: string, detail: string}>>}
 */
async function analyzeOfficialCapabilityRule({
  siteJsDir,
  file,
  source,
  relativeFile,
  siteRelativeFile,
  specifiers,
  unresolvableDynamic,
}) {
  if (OFFICIAL_CAPABILITY_ALLOWLIST.includes(siteRelativeFile)) {
    return [];
  }

  const violations = [];

  // 1. Menção ao identificador de uma fábrica restrita.
  for (const [factory, definingModule] of Object.entries(RESTRICTED_FACTORY_DEFINITIONS)) {
    if (siteRelativeFile === definingModule) {
      continue;
    }
    if (new RegExp(`\\b${factory}\\b`).test(source)) {
      violations.push({
        file: relativeFile,
        rule: 'official-capability-restricted-reference',
        detail: `referência a "${factory}" só é permitida em ${OFFICIAL_CAPABILITY_ALLOWLIST.join(', ')} (definida em site/js/${definingModule})`,
      });
    }
  }

  // 2/3. Imports e reexports resolvidos para os módulos restritos.
  const restrictedTargets = new Set(RESTRICTED_MODULES.map((module) => module));

  REEXPORT_PATTERN.lastIndex = 0;
  let reexportMatch = REEXPORT_PATTERN.exec(source);
  while (reexportMatch) {
    const specifier = reexportMatch[2];
    const resolved = await resolveRelativeSpecifier(siteJsDir, file, specifier);
    const target = resolved ? path.relative(siteJsDir, resolved).split(path.sep).join('/') : null;
    if (
      target !== null &&
      target !== siteRelativeFile &&
      (restrictedTargets.has(target) || Object.values(RESTRICTED_FACTORY_DEFINITIONS).includes(target))
    ) {
      violations.push({
        file: relativeFile,
        rule: 'official-capability-restricted-reexport',
        detail: `reexportar "${specifier}" republicaria uma fábrica de capacidade oficial fora de ${OFFICIAL_CAPABILITY_ALLOWLIST.join(', ')}`,
      });
    }
    reexportMatch = REEXPORT_PATTERN.exec(source);
  }

  for (const specifier of specifiers) {
    const resolved = await resolveRelativeSpecifier(siteJsDir, file, specifier);
    const target = resolved ? path.relative(siteJsDir, resolved).split(path.sep).join('/') : null;
    if (target !== null && target !== siteRelativeFile && restrictedTargets.has(target)) {
      violations.push({
        file: relativeFile,
        rule: 'official-capability-restricted-module-import',
        detail: `import de "${specifier}" (módulo restrito site/js/${target}) só é permitido em ${OFFICIAL_CAPABILITY_ALLOWLIST.join(', ')}`,
      });
    }
  }

  // 4. Import dinâmico cujo alvo não pode ser resolvido estaticamente. Um
  // `import(\`./content/official-handler-${'authorization'}.js\`)` poderia
  // apontar para um módulo restrito sem que a resolução textual perceba, e
  // como esta regra é fechada por padrão, o não resolvível conta como
  // violação também aqui — não só na regra genérica de camadas, que não
  // alcança arquivos fora de camada.
  for (const raw of unresolvableDynamic) {
    violations.push({
      file: relativeFile,
      rule: 'official-capability-restricted-dynamic-import',
      detail: `import(\`${raw}\`) usa interpolação de template literal: o alvo não é resolvível estaticamente e pode ser um módulo de capacidade restrito; só ${OFFICIAL_CAPABILITY_ALLOWLIST.join(', ')} poderia importá-lo`,
    });
  }

  // 5. Import de namespace (`import * as caps from './capabilities.js'`) de um
  // módulo que define fábrica restrita: o objeto de namespace dá acesso à
  // fábrica sem nunca escrever o identificador dela (`Object.values(caps)[0]()`).
  // Imports NOMEADOS de `capabilities.js` continuam permitidos — é assim que
  // `hasOfficialHandlersCapability`/`createSourceCapabilities` são usados.
  NAMESPACE_IMPORT_PATTERN.lastIndex = 0;
  let namespaceMatch = NAMESPACE_IMPORT_PATTERN.exec(source);
  while (namespaceMatch) {
    const specifier = namespaceMatch[3];
    const resolved = await resolveRelativeSpecifier(siteJsDir, file, specifier);
    const target = resolved ? path.relative(siteJsDir, resolved).split(path.sep).join('/') : null;
    if (
      target !== null &&
      target !== siteRelativeFile &&
      (restrictedTargets.has(target) || Object.values(RESTRICTED_FACTORY_DEFINITIONS).includes(target))
    ) {
      violations.push({
        file: relativeFile,
        rule: 'official-capability-restricted-namespace-import',
        detail: `import de namespace ("import * as ${namespaceMatch[1]}") de "${specifier}" daria acesso à fábrica de capacidade oficial sem nomeá-la; use imports nomeados`,
      });
    }
    namespaceMatch = NAMESPACE_IMPORT_PATTERN.exec(source);
  }

  return violations;
}

/**
 * Analisa uma árvore `site/js` (ou uma árvore equivalente usada em testes)
 * e retorna a lista de violações de arquitetura encontradas. Cada violação
 * tem `{file, rule, detail}` — arquivo, regra violada e o import/global
 * proibido específico que a causou.
 * @param {string} siteJsDir - caminho absoluto para o diretório `site/js`.
 * @returns {Promise<ReadonlyArray<{file: string, rule: string, detail: string}>>}
 */
export async function analyzeDirectory(siteJsDir) {
  const files = await walkDirectory(siteJsDir);
  const violations = [];

  for (const file of files) {
    const layer = layerOf(siteJsDir, file);

    const rawSource = await readFile(file, 'utf8');
    const source = stripComments(rawSource);
    const relativeFile = path.relative(repoRoot, file).split(path.sep).join('/');
    const siteRelativeFile = path.relative(siteJsDir, file).split(path.sep).join('/');

    const { specifiers, unresolvableDynamic } = extractImportSpecifiers(source);

    // Regra 0: import dinâmico com interpolação (`import(\`...${x}...\`)`) não
    // pode ter seu alvo resolvido estaticamente. É reportado para TODO arquivo
    // sob `site/js`, esteja ou não em uma camada conhecida — antes esta
    // emissão ficava depois do `continue` de "arquivo fora de camada", o que
    // deixava os 18 arquivos do monólito plano e `vendor/**` sem cobertura.
    for (const raw of unresolvableDynamic) {
      violations.push({
        file: relativeFile,
        rule: 'dynamic-import-unresolvable',
        detail: `import(\`${raw}\`) usa interpolação de template literal; o alvo não pode ser resolvido estaticamente e requer revisão humana`,
      });
    }

    // Regra 3: fábricas de capacidade oficial restritas ao composition root.
    // Aplicada a todo arquivo sob `site/js`, esteja ou não em uma camada.
    violations.push(
      ...(await analyzeOfficialCapabilityRule({
        siteJsDir,
        file,
        source,
        relativeFile,
        siteRelativeFile,
        specifiers,
        unresolvableDynamic,
      })),
    );

    if (layer === null) {
      continue;
    }

    // Regra 1: direção de dependências entre camadas.
    const allowedLayers = ALLOWED_IMPORTS_BY_LAYER[layer];

    for (const specifier of specifiers) {
      let targetLayer = null;

      if (specifier.startsWith('.')) {
        const resolved = await resolveRelativeSpecifier(siteJsDir, file, specifier);
        if (resolved) {
          targetLayer = layerOf(siteJsDir, resolved);
        }
      } else if (layer === 'domain' && (specifier === 'firebase' || specifier.startsWith('firebase/'))) {
        // Pacote externo `firebase`: para `domain`, tratamos como camada
        // proibida mesmo sem existir um diretório `infra`/`ui` no import.
        targetLayer = 'infra';
      }

      if (targetLayer !== null && !allowedLayers.includes(targetLayer)) {
        violations.push({
          file: relativeFile,
          rule: layer === 'domain' ? 'domain-forbidden-layer-import' : 'layer-forbidden-import',
          detail: `import "${specifier}" (camada "${targetLayer}") não é permitido a partir da camada "${layer}"`,
        });
      }
    }

    // Regra 2: globais de navegador proibidos em domain/**.
    if (layer === 'domain') {
      FORBIDDEN_GLOBAL_PATTERN.lastIndex = 0;
      const seenGlobals = new Set();
      let match = FORBIDDEN_GLOBAL_PATTERN.exec(source);
      while (match) {
        const globalName = match[1];
        if (!seenGlobals.has(globalName)) {
          seenGlobals.add(globalName);
          violations.push({
            file: relativeFile,
            rule: 'domain-forbidden-global',
            detail: `referência ao global "${globalName}" não é permitida em código de domain`,
          });
        }
        match = FORBIDDEN_GLOBAL_PATTERN.exec(source);
      }
    }
  }

  return Object.freeze(violations);
}

/**
 * Ponto de entrada de linha de comando: analisa `site/js` do repositório,
 * imprime cada violação (arquivo, import/global proibido e regra violada) e
 * sai com código 1 se houver alguma, ou 0 em caso de sucesso.
 * @returns {Promise<number>}
 */
async function main() {
  const siteJsDir = path.join(repoRoot, 'site', 'js');
  const violations = await analyzeDirectory(siteJsDir);

  if (violations.length === 0) {
    console.log('check:architecture: nenhuma violação encontrada.');
    return 0;
  }

  console.error(`check:architecture: ${violations.length} violação(ões) encontrada(s):\n`);
  for (const violation of violations) {
    console.error(`  - arquivo: ${violation.file}`);
    console.error(`    regra violada: ${violation.rule}`);
    console.error(`    detalhe: ${violation.detail}\n`);
  }
  return 1;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error('check:architecture: falha inesperada.', error);
      process.exit(1);
    },
  );
}
