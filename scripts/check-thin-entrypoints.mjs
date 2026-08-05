#!/usr/bin/env node
// ============================================================
// check:entrypoints (Task 37) — prova que os dois composition roots públicos
// (`site/js/pages/creator.js` e `site/js/pages/sheet.js`) continuam FINOS:
//
//   1. exportam APENAS a sua entrada pública (`renderCreator`/`renderSheet`);
//   2. compõem dependências (importam e ligam portas) em vez de implementar:
//      nada de markup (innerHTML/outerHTML/insertAdjacentHTML/createElement/
//      template literal com tag HTML);
//   3. não contêm regra de jogo nem NOME de conteúdo (nomes de exibição do
//      catálogo, ContentIds `dnd2024:`, tabelas/derivados do monólito);
//   4. não guardam estado de módulo mutável (`let`/`var` no escopo do módulo)
//      nem exportam singleton (`export default`, `export const` de objeto).
//
// As mesmas regras são afirmadas por
// `tests/unit/architecture/creator-composition-root.test.js` e
// `tests/unit/architecture/sheet-composition-root.test.js`; este script é o
// gate de linha de comando (`npm run check:entrypoints`) exigido pela Task 37
// para rodar também fora da suíte de testes (CI, verify).
// ============================================================

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// Nomes de exibição de conteúdo e símbolos de regra que denunciam que o
// composition root voltou a conhecer o jogo. A lista espelha os testes de
// arquitetura das Tasks 28b/33.
const CONTENT_NAMES = Object.freeze([
  'Mago', 'Guerreiro', 'Bárbaro', 'Ladino', 'Clérigo', 'Druida', 'Bardo',
  'Bruxo', 'Feiticeiro', 'Monge', 'Paladino', 'Patrulheiro',
  'Draconato', 'Elfo', 'Anão', 'Gnomo', 'Halfling', 'Tiefling',
]);
const RULE_SYMBOLS = Object.freeze([
  'STANDARD_ARRAY', 'POINT_BUY', 'CLASSES_INFO', 'CLASSES_ESCOLHAS',
  'NIVEL_SUBCLASSE', 'PERICIAS', 'calcMod', 'calcPVNivel1',
  'bonusProficiencia', 'getEspacosMagia', 'getTruquesConhecidos',
  'getMagiaPreparadas', 'getTamanho', 'getDeslocamento',
]);

// Entrypoints avaliados e a única exportação permitida em cada um.
export const THIN_ENTRYPOINTS = Object.freeze([
  { file: 'site/js/pages/creator.js', entry: 'renderCreator' },
  { file: 'site/js/pages/sheet.js', entry: 'renderSheet' },
]);

/**
 * Remove comentários de linha e de bloco do fonte, para as regras não
 * casarem com prosa explicativa (os cabeçalhos destes arquivos DOCUMENTAM
 * exatamente o que é proibido neles).
 * @param {string} source
 * @returns {string}
 */
function semComentarios(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Avalia o fonte de um entrypoint contra as regras de "fachada fina" e
 * devolve a lista de violações `{rule, detail}` (vazia quando o arquivo é
 * fino). Função pura sobre o texto, para ser testável sem tocar o disco.
 * @param {string} source - fonte completo do arquivo.
 * @param {{entry: string}} options - nome da única exportação permitida.
 * @returns {Array<{rule: string, detail: string}>}
 */
export function analyzeThinEntrypoint(source, { entry }) {
  const code = semComentarios(source);
  const violations = [];

  // 1. Exportações: apenas a entrada pública, como `export [async] function`.
  const exportedFunctions = [...code.matchAll(/^export\s+(?:async\s+)?function\s+([\w$]+)/gm)].map((m) => m[1]);
  if (exportedFunctions.length !== 1 || exportedFunctions[0] !== entry) {
    violations.push({
      rule: 'only-entry-export',
      detail: `exportações de função encontradas: [${exportedFunctions.join(', ')}]; a única permitida é "${entry}"`,
    });
  }
  for (const extra of code.matchAll(/^export\s+(default\b|const\b|let\b|var\b|class\b|\{)/gm)) {
    violations.push({
      rule: 'only-entry-export',
      detail: `forma de exportação proibida num entrypoint fino: "export ${extra[1]}" (singleton/estado/objeto)`,
    });
  }

  // 2. Markup: o composition root nunca escreve tela.
  for (const marcador of ['innerHTML', 'outerHTML', 'insertAdjacentHTML']) {
    if (code.includes(marcador)) {
      violations.push({ rule: 'no-template', detail: `uso de "${marcador}" — montar tela é da view, não do entrypoint` });
    }
  }
  if (/`[^`]*<\s*\/?[a-z]/i.test(code)) {
    violations.push({ rule: 'no-template', detail: 'template literal contendo tag HTML' });
  }
  if (/\bcreateElement\b/.test(code)) {
    violations.push({ rule: 'no-template', detail: 'construção de nós DOM (createElement) no entrypoint' });
  }

  // 3. Regra de jogo / nomes de conteúdo.
  for (const nome of CONTENT_NAMES) {
    if (code.includes(`'${nome}'`) || code.includes(`"${nome}"`) || code.includes(`\`${nome}\``)) {
      violations.push({ rule: 'no-content-names', detail: `nome de conteúdo "${nome}" no entrypoint` });
    }
  }
  for (const simbolo of RULE_SYMBOLS) {
    if (code.includes(simbolo)) {
      violations.push({ rule: 'no-game-rules', detail: `símbolo de regra/derivado "${simbolo}" no entrypoint` });
    }
  }
  if (/\bdnd2024:/.test(code)) {
    violations.push({ rule: 'no-content-names', detail: 'ContentId literal ("dnd2024:...") no entrypoint' });
  }

  // 4. Estado de módulo mutável: `let`/`var` na coluna 0 (indentado é local
  // de função, legítimo).
  if (/^(let|var)\s+/m.test(code)) {
    violations.push({ rule: 'no-module-state', detail: 'declaração `let`/`var` no escopo do módulo (estado mutável/singleton)' });
  }

  return violations;
}

/**
 * Ponto de entrada de linha de comando: avalia os dois entrypoints públicos
 * e sai com código 1 listando cada violação, ou 0 quando ambos são finos.
 * @returns {Promise<number>}
 */
async function main() {
  let total = 0;
  for (const { file, entry } of THIN_ENTRYPOINTS) {
    const absolute = path.join(repoRoot, file);
    let source;
    try {
      source = await readFile(absolute, 'utf8');
    } catch (error) {
      console.error(`check:entrypoints: não foi possível ler ${file}: ${error.message}`);
      return 1;
    }
    const violations = analyzeThinEntrypoint(source, { entry });
    for (const violation of violations) {
      total += 1;
      console.error(`  - ${file} [${violation.rule}] ${violation.detail}`);
    }
  }
  if (total > 0) {
    console.error(`check:entrypoints: ${total} violação(ões) — os entrypoints deixaram de ser finos.`);
    return 1;
  }
  console.log('check:entrypoints: OK — pages/creator.js e pages/sheet.js continuam finos.');
  return 0;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error('check:entrypoints: falha inesperada.', error);
      process.exit(1);
    },
  );
}
