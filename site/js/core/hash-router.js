// ============================================================
// Módulo `core/hash-router`: router baseado em hash, PURO e injetável.
//
// Task 34 — as três rotas públicas (`home`, `criar`, `ficha/<id>`) deixam de
// ser importadas estaticamente por `app.js` e passam a ser carregadas sob
// demanda (`import()` dinâmico), uma por navegação. Este módulo não conhece
// `window`, `location` nem `history`: todo acesso ao navegador entra por
// portas injetadas (`getHash`, `setHash`, `subscribeHashChange`), o que
// permite testar o parsing, o generation-guard e o descarte de rota em
// Node puro (`tests/unit/core/hash-router.test.js`), sem jsdom/Playwright.
//
// ## Contrato de retorno das rotas
//
// Todo módulo de rota exporta uma função `(container, param) => Result<() =>
// void, AppError>` — nunca `undefined`/`void` implícito. Em sucesso, o
// `value` é o DISPOSER da rota (`() => {}` quando não há nada para limpar);
// em falha, o `error` é um `AppError` que o router repassa a `renderError`
// SEM criar handler inline nenhum (a própria rota já cuidou de mostrar o
// aviso na tela, quando aplicável — ver `pages/sheet.js`/`pages/creator.js`).
//
// ## Generation guard
//
// Cada chamada a `process()` incrementa uma geração. Se o usuário navegar de
// novo enquanto uma rota anterior ainda está importando/montando, a geração
// antiga perde a corrida: seu disposer (se ela chegou a produzir um) é
// chamado na hora, e ela nunca é registrada como "a rota atual" nem escreve
// no `contentRoot`. Isso é o que garante que "apenas a última geração pode
// renderizar" mesmo com import lento e cliques rápidos.
// ============================================================
import { ok, err } from './result.js';
import { createAppError } from './errors.js';

/**
 * Interpreta o hash bruto (`#ficha/abc123`, `#criar`, `''`, etc.) em
 * `{ pagina, param }`. Hash vazio ou ausente vira a rota `home`.
 *
 * Exportado (Task 34, fix round 1) para que o composition root (`app.js`)
 * NUNCA precise reimplementar este parsing à mão — antes desta exportação,
 * o adapter `getHash` de `app.js` fazia sua própria divisão de
 * `window.location.hash` para decidir o redirecionamento de
 * `criar`/`ficha` -> `home`, duplicando esta mesma regra em dois lugares.
 * @param {string} hashBruto - valor devolvido por `getHash()`.
 * @returns {{pagina: string, param: string}}
 */
export function parseHash(hashBruto) {
  const semPrefixo = typeof hashBruto === 'string' ? hashBruto.replace(/^#/, '') : '';
  const semHash = semPrefixo.length === 0 ? 'home' : semPrefixo;
  const partes = semHash.split('/');
  const pagina = partes[0] || 'home';
  const param = partes.slice(1).join('/');
  return { pagina, param };
}

/**
 * Cria um router de hash injetável. Nenhuma porta é opcional: um router sem
 * `getHash`/`setHash`/`subscribeHashChange` não tem como operar, e um router
 * sem `contentRoot` não tem onde montar as rotas.
 *
 * @param {object} deps
 * @param {Record<string, {load: () => Promise<object>, exportName: string}>} deps.routes
 * @param {() => string} deps.getHash - lê o hash atual (com ou sem `#`).
 * @param {(rota: string) => void} deps.setHash - navega para `rota` (sem `#`).
 * @param {(handler: () => void) => (() => void)} deps.subscribeHashChange -
 *   assina mudanças de hash; devolve a função de cancelamento da assinatura.
 * @param {object} deps.contentRoot - nó onde as rotas montam.
 * @param {(estado: {pagina: string, param: string, status: string}) => void} [deps.onRouteState] -
 *   notificado no início de cada navegação (`status: 'start'`), ao montar
 *   com sucesso (`'mounted'`), ao falhar (`'error'`) ou ao não achar rota
 *   (`'not-found'`).
 * @param {(contentRoot: object, error: object, meta: {pagina: string, param: string}) => void} [deps.renderError] -
 *   desenha o aviso de erro/rota-não-encontrada no `contentRoot`.
 * @returns {{start: () => (() => void), navigate: (rota: string) => void, process: () => Promise<object>}}
 */
export function createHashRouter({ routes, getHash, setHash, subscribeHashChange, contentRoot, onRouteState, renderError }) {
  if (!routes || typeof routes !== 'object') {
    throw new TypeError('createHashRouter: "routes" deve ser um objeto.');
  }
  if (typeof getHash !== 'function' || typeof setHash !== 'function' || typeof subscribeHashChange !== 'function') {
    throw new TypeError('createHashRouter: "getHash", "setHash" e "subscribeHashChange" são obrigatórios.');
  }

  /** @type {(() => void) | null} disposer da rota montada no momento. */
  let disposerAtual = null;
  // Geração da navegação: só a mais recente pode registrar disposer/montar.
  let geracao = 0;
  let unsubscribe = null;

  /**
   * Descarta a rota montada anteriormente, se houver. Idempotente por
   * construção: a referência é limpa ANTES da chamada, então uma segunda
   * chamada (ex.: `stop()` depois de já ter descartado) é um no-op seguro.
   * @returns {void}
   */
  function descartarRotaAnterior() {
    const descartar = disposerAtual;
    disposerAtual = null;
    if (typeof descartar !== 'function') return;
    try {
      descartar();
    } catch (cause) {
      console.error('hash-router: o disposer da rota anterior lançou uma exceção:', cause);
    }
  }

  /**
   * Descarta o disposer de uma geração que perdeu a corrida (navegação mais
   * nova chegou antes dela terminar de montar). Nunca vira "a rota atual".
   * @param {*} resultado - o Result devolvido pela rota.
   * @returns {void}
   */
  function descartarResultadoObsoleto(resultado) {
    if (resultado && resultado.ok === true && typeof resultado.value === 'function') {
      try {
        resultado.value();
      } catch (cause) {
        console.error('hash-router: o disposer de uma navegação obsoleta lançou uma exceção:', cause);
      }
    }
  }

  /**
   * Processa a rota atual (lida via `getHash()`), aplicando o
   * generation-guard e chamando `onRouteState`/`renderError` conforme o
   * resultado. Sempre resolve — nunca rejeita — devolvendo um `Result`.
   * @returns {Promise<{ok: true, value: undefined} | {ok: false, error: object}>}
   */
  async function process() {
    geracao += 1;
    const minhaGeracao = geracao;
    const { pagina, param } = parseHash(getHash());

    // A rota anterior é descartada ANTES de qualquer conteúdo novo (mesmo o
    // aviso de "não encontrada") ser escrito em `contentRoot` — um listener
    // delegado da montagem antiga não pode sobreviver ao nó que observava.
    descartarRotaAnterior();

    if (typeof onRouteState === 'function') {
      onRouteState({ pagina, param, status: 'start' });
    }

    const entry = routes[pagina];
    if (!entry) {
      const error = createAppError({
        code: 'ROUTE_NOT_FOUND',
        scope: 'hash-router',
        message: `Rota "${pagina}" não encontrada.`,
        context: { pagina },
      });
      if (typeof onRouteState === 'function') onRouteState({ pagina, param, status: 'not-found' });
      if (typeof renderError === 'function') renderError(contentRoot, error, { pagina, param });
      return err(error);
    }

    // AbortController por navegação: sinaliza abandono para quem quiser
    // observá-lo (ex.: uma futura rota que aceite `{ signal }`); o
    // generation-guard abaixo é a garantia de verdade, este sinal é
    // complementar.
    const controller = new AbortController();

    let mod;
    try {
      mod = await entry.load();
    } catch (cause) {
      if (minhaGeracao !== geracao) return ok(undefined);
      controller.abort();
      const error = createAppError({
        code: 'ROUTE_IMPORT_FAILED',
        scope: 'hash-router',
        message: 'Não foi possível carregar o módulo desta tela.',
        context: { pagina },
        cause,
      });
      if (typeof onRouteState === 'function') onRouteState({ pagina, param, status: 'error' });
      if (typeof renderError === 'function') renderError(contentRoot, error, { pagina, param });
      return err(error);
    }

    // Geração já obsoleta assim que o import termina: NÃO chama `render()`
    // — uma rota obsoleta que chegasse a montar escreveria (mesmo que por um
    // instante) em `contentRoot`, que já pertence à navegação mais nova.
    if (minhaGeracao !== geracao) return ok(undefined);

    const render = mod ? mod[entry.exportName] : undefined;
    if (typeof render !== 'function') {
      if (minhaGeracao !== geracao) return ok(undefined);
      const error = createAppError({
        code: 'ROUTE_EXPORT_MISSING',
        scope: 'hash-router',
        message: 'O módulo desta tela não expõe a função esperada.',
        context: { pagina, exportName: entry.exportName },
      });
      if (typeof onRouteState === 'function') onRouteState({ pagina, param, status: 'error' });
      if (typeof renderError === 'function') renderError(contentRoot, error, { pagina, param });
      return err(error);
    }

    let resultado;
    try {
      resultado = await render(contentRoot, param, { signal: controller.signal });
    } catch (cause) {
      if (minhaGeracao !== geracao) return ok(undefined);
      const error = createAppError({
        code: 'ROUTE_RENDER_THREW',
        scope: 'hash-router',
        message: 'Esta tela falhou ao montar.',
        context: { pagina },
        cause,
      });
      if (typeof onRouteState === 'function') onRouteState({ pagina, param, status: 'error' });
      if (typeof renderError === 'function') renderError(contentRoot, error, { pagina, param });
      return err(error);
    }

    if (minhaGeracao !== geracao) {
      // Uma navegação mais nova já começou: esta geração nunca chega a ser
      // "a rota atual" — se ela produziu um disposer, descarta na hora.
      descartarResultadoObsoleto(resultado);
      return ok(undefined);
    }

    if (!resultado || resultado.ok !== true) {
      const error =
        resultado && resultado.error
          ? resultado.error
          : createAppError({
              code: 'ROUTE_RESULT_INVALID',
              scope: 'hash-router',
              message: 'Esta tela não devolveu um resultado válido.',
              context: { pagina },
            });
      if (typeof onRouteState === 'function') onRouteState({ pagina, param, status: 'error' });
      // Nenhum handler inline aqui: a própria rota (pages/sheet.js,
      // pages/creator.js) já mostrou seu próprio aviso recuperável antes de
      // devolver `err(...)`; `renderError` só entra para erros do PRÓPRIO
      // router (import falho, export ausente, resultado malformado).
      return err(error);
    }

    disposerAtual = typeof resultado.value === 'function' ? resultado.value : () => {};
    if (typeof onRouteState === 'function') onRouteState({ pagina, param, status: 'mounted' });
    return ok(undefined);
  }

  /**
   * Navega para `rota` escrevendo o novo hash pela porta `setHash`. Não
   * processa a rota diretamente — quem dispara `process()` é o assinante de
   * `subscribeHashChange` registrado por `start()`.
   * @param {string} rota - ex.: `'home'`, `'ficha/abc123'`.
   * @returns {void}
   */
  function navigate(rota) {
    setHash(rota);
  }

  /**
   * Assina mudanças de hash e processa a rota inicial. Devolve uma função
   * `stop()` que cancela a assinatura e descarta a rota montada — usada
   * sobretudo em testes, para não vazar listeners entre casos.
   * @returns {() => void}
   */
  function start() {
    unsubscribe = subscribeHashChange(() => {
      process();
    });
    process();
    return function stop() {
      if (typeof unsubscribe === 'function') unsubscribe();
      unsubscribe = null;
      descartarRotaAnterior();
    };
  }

  return { start, navigate, process };
}
