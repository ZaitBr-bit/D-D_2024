// ============================================================
// MODO SOMBRA da Task 22b — instrumentação de teste, nunca publicada.
//
// ## O que é
//
// Depois do cutover, `site/js/db.js` é uma fachada sobre o catálogo oficial.
// O modo sombra faz a página carregar, AO MESMO TEMPO, essa fachada e o
// carregador legado congelado (`tests/helpers/legacy-db-source.js`, que lê os
// JSON de `dados/**`), e comparar os dois resultados a CADA chamada que os
// fluxos reais do app fizerem — criação de personagem, abertura de ficha,
// level-up. Não é comparação contra fixture: é o app de verdade, no navegador,
// com o `fetch` de verdade.
//
// ## Como é instalado (e por que não há flag em produção)
//
// Nada em `site/**` sabe que o modo sombra existe. A instalação é uma rota do
// Playwright que intercepta o pedido de `/site/js/db.js` e responde com um
// MÓDULO ENVOLTÓRIO gerado aqui. Esse envoltório importa a fachada real por
// uma URL com query (`/site/js/db.js?shadow-passthrough=1`), que a rota
// deliberadamente NÃO intercepta — é o mesmo arquivo, servido de verdade pelo
// servidor estático, sem nenhuma alteração.
//
// Consequência importante: não existe nenhuma flag, nenhuma variável global e
// nenhum branch de teste dentro do código de produção. O envoltório só existe
// dentro do processo do Playwright, e some quando a rota é removida.
//
// ## O que é registrado
//
// Para cada chamada: a operação, os argumentos, o diff campo a campo
// (`diferencasPorCaminho`, o mesmo mecanismo — sem `ignoreKeys`, sem
// subconjunto — que `tests/contract/legacy-db-projection.test.js` usa) e o
// retrato de sentinelas vazias dos dois lados (`coletarSentinelas`).
// ============================================================
import { LEGACY_DB_OPERATIONS } from '../../../site/js/infra/content/legacy-db-projection.js';

/** URL (com query) pela qual o envoltório alcança a fachada real, sem interceptação. */
const PASSTHROUGH = '/site/js/db.js?shadow-passthrough=1';

/**
 * Fonte do módulo envoltório servido no lugar de `/site/js/db.js`.
 *
 * Os 17 exports são reexportados um a um porque `export` de ESM é estático:
 * não dá para gerar a superfície em runtime. A lista vem de
 * `LEGACY_DB_OPERATIONS` (a mesma fonte de verdade do contrato), então um
 * export novo em `db.js` que não estivesse lá apareceria como import faltando
 * nos consumidores — falha alta, não silenciosa.
 * @returns {string}
 */
function fonteDoEnvoltorio() {
  const declaracoes = LEGACY_DB_OPERATIONS.map(
    (nome) => `export const ${nome} = sombrear(${JSON.stringify(nome)});`,
  ).join('\n');

  return `// Módulo envoltório do MODO SOMBRA (tests/e2e/helpers/legacy-shadow.js).
// Gerado em tempo de teste; jamais existe em disco nem no deploy.
import * as fachada from '${PASSTHROUGH}';
import * as oraculo from '/tests/helpers/legacy-db-source.js';
import { diferencasPorCaminho, ordenarContagens, coletarSentinelas } from '/tests/helpers/legacy-projection-diff.js';

const estado = { chamadas: [], erros: [] };
globalThis.__LEGACY_SHADOW__ = estado;

/** Serializa um argumento para o relatório (só strings/números são usados hoje). */
function rotularArg(valor) {
  return typeof valor === 'string' || typeof valor === 'number' ? valor : String(valor);
}

/**
 * Envolve um export: chama a fachada (valor REAL devolvido ao app) e o oráculo
 * legado, registra a comparação e devolve sempre o valor da fachada — o modo
 * sombra observa, nunca altera o comportamento do app.
 */
function sombrear(nome) {
  return async function sombra(...args) {
    const atual = await fachada[nome](...args);
    let esperado;
    try {
      esperado = await oraculo[nome](...args);
    } catch (causa) {
      estado.erros.push({ operacao: nome, args: args.map(rotularArg), mensagem: String(causa) });
      return atual;
    }
    estado.chamadas.push({
      operacao: nome,
      args: args.map(rotularArg),
      esperadoNulo: esperado === null,
      atualNulo: atual === null,
      diff: ordenarContagens(diferencasPorCaminho(esperado, atual)),
      sentinelasLegado: coletarSentinelas(esperado),
      sentinelasProjecao: coletarSentinelas(atual),
    });
    return atual;
  };
}

${declaracoes}
`;
}

/**
 * Instala o modo sombra na página. Precisa ser chamado ANTES da primeira
 * navegação que carregue `site/js/db.js`.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
export async function installShadowMode(page) {
  const fonte = fonteDoEnvoltorio();
  await page.route(
    (url) => url.pathname.endsWith('/site/js/db.js') && !url.searchParams.has('shadow-passthrough'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/javascript; charset=utf-8',
        headers: { 'cache-control': 'no-store' },
        body: fonte,
      });
    },
  );
}

/**
 * Lê o registro acumulado pelo modo sombra na página atual.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{chamadas: Array<object>, erros: Array<object>}>}
 */
export async function lerRegistroSombra(page) {
  return page.evaluate(() => globalThis.__LEGACY_SHADOW__ ?? { chamadas: [], erros: [] });
}
