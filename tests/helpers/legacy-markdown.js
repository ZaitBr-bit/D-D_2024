// ============================================================
// Carrega o `mdParaHtml` do COMMIT-BASELINE (e43c5ea) — a implementação de
// Markdown que estava em produção antes da Task 24 — para servir de oráculo
// de fidelidade ao novo `site/js/ui/markdown.js`.
//
// Por que ler do git em vez de manter uma cópia neste diretório: a partir da
// Task 24, `site/js/utils.js#mdParaHtml` passa a ser uma FACHADA que delega
// para o renderizador novo. Comparar o novo renderizador com a fachada
// provaria apenas que a fachada delega — não que o resultado continua igual
// ao que o usuário via antes. Uma cópia manual, por sua vez, poderia divergir
// do baseline sem ninguém perceber. Extrair o texto original do commit
// congelado elimina os dois problemas.
//
// Se o git não estiver disponível, esta função LANÇA. Um oráculo de
// fidelidade que "passa" porque não conseguiu carregar o baseline seria pior
// do que não existir.
// ============================================================
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/** Commit congelado pela Task 2 como baseline de compatibilidade. */
export const BASELINE_COMMIT = 'e43c5ea';

const BASELINE_FILE = 'site/js/utils.js';
const FUNCTION_HEADER = 'export function mdParaHtml(texto) {';

/**
 * Recorta o corpo de uma função a partir do seu cabeçalho, equilibrando
 * chaves. Não é um parser de JS completo, mas é suficiente e determinístico
 * para esta função específica — e falha alto se o recorte não fechar.
 * @param {string} source - código-fonte completo do arquivo.
 * @param {string} header - primeira linha da função (inclusive `{`).
 * @returns {string} o texto da função, do cabeçalho até a chave final.
 */
function sliceFunction(source, header) {
  const start = source.indexOf(header);
  if (start === -1) {
    throw new Error(`legacy-markdown: "${header}" não encontrado em ${BASELINE_FILE}@${BASELINE_COMMIT}.`);
  }
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  throw new Error('legacy-markdown: não foi possível fechar o corpo da função do baseline.');
}

/**
 * Lê `site/js/utils.js` no commit-baseline e devolve o `mdParaHtml` original
 * como função executável.
 * @returns {(texto: string) => string}
 */
export function loadBaselineMdParaHtml() {
  const result = spawnSync('git', ['show', `${BASELINE_COMMIT}:${BASELINE_FILE}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`legacy-markdown: git indisponível (${result.error.message}).`);
  }
  if (result.status !== 0) {
    throw new Error(`legacy-markdown: git show falhou (${(result.stderr || '').trim()}).`);
  }

  const baselineSource = result.stdout;
  const functionSource = sliceFunction(baselineSource, FUNCTION_HEADER).replace(/^export\s+/, '');
  // O corpo do baseline não referencia nada além de seus próprios argumentos
  // e de globais padrão de JS; por isso pode ser avaliado isoladamente.
  // eslint-disable-next-line no-new-func
  const factory = new Function(`${functionSource}\nreturn mdParaHtml;`);
  return factory();
}

/**
 * Caminho absoluto do repositório (útil para os testes que varrem `dados/`).
 * @returns {string}
 */
export function getRepoRoot() {
  return path.resolve(repoRoot);
}
