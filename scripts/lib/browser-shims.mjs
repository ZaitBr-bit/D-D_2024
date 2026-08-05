// ============================================================
// Shims mínimos de ambiente de navegador, suficientes para importar
// site/js/store.js em Node (ele importa transitivamente site/js/sync.js
// -> site/js/auth.js, que referenciam `window`/`navigator` no escopo do
// módulo). Não simula um navegador de verdade — apenas o necessário para
// que módulos puros (migrações, cálculos) possam ser executados fora do
// browser para gerar/validar as fixtures a partir do código real.
// Também expõe um `Date` "congelável" para tornar timestamps determinísticos
// ao executar funções reais que chamam `new Date().toISOString()`.
// ============================================================

let _localStorageBacking = new Map();

export function installBrowserShims() {
  if (!globalThis.window) globalThis.window = globalThis;
  if (!globalThis.navigator) globalThis.navigator = { onLine: true };
  if (!globalThis.localStorage) {
    globalThis.localStorage = {
      getItem: (k) => (_localStorageBacking.has(k) ? _localStorageBacking.get(k) : null),
      setItem: (k, v) => { _localStorageBacking.set(k, String(v)); },
      removeItem: (k) => { _localStorageBacking.delete(k); },
      clear: () => { _localStorageBacking.clear(); }
    };
  }
}

/** Limpa o localStorage simulado entre gerações de fixture independentes. */
export function resetFakeLocalStorage() {
  _localStorageBacking = new Map();
  if (globalThis.localStorage) {
    globalThis.localStorage.clear();
  }
}

const RealDate = Date;

/**
 * Substitui globalThis.Date por uma subclasse cujo construtor sem argumentos
 * (e `Date.now()`) sempre retornam `isoString`, mas que delega para o Date
 * real em qualquer outro uso (new Date(ano,mes,...), parsing, etc). Retorna
 * uma função para restaurar o Date original.
 */
export function freezeClock(isoString) {
  class FrozenDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        return new RealDate(isoString);
      }
      // eslint-disable-next-line constructor-super
      return new RealDate(...args);
    }
    static now() {
      return new RealDate(isoString).getTime();
    }
  }
  globalThis.Date = FrozenDate;
  return () => { globalThis.Date = RealDate; };
}
