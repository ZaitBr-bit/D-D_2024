// Helper de teste `memory-storage`: implementação mínima do contrato Web
// Storage (`getItem`/`setItem`/`removeItem`) em memória, usada por todos os
// testes de repositório/preferências para não depender de `localStorage`
// real (indisponível em `node --test`). Suporta simular estouro de quota
// (`setQuotaExceeded(true)`) e corrupção direta de uma chave
// (`corrupt(key, text)`) sem passar pelo contrato normal.

/**
 * Cria um storage em memória.
 * @param {Record<string, string>} [initial] - pares chave/valor iniciais.
 * @returns {object}
 */
export function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  let quotaExceeded = false;

  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      if (quotaExceeded) {
        const error = new Error('QuotaExceededError (simulado)');
        error.name = 'QuotaExceededError';
        error.code = 22;
        throw error;
      }
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    /** Liga/desliga simulação de quota excedida em toda chamada de setItem. */
    setQuotaExceeded(value) {
      quotaExceeded = Boolean(value);
    },
    /** Escreve `text` diretamente em `key`, ignorando a simulação de quota (para preparar cenários de corrupção). */
    corrupt(key, text) {
      map.set(key, text);
    },
    /** Snapshot de depuração de todas as chaves atuais. */
    dump() {
      return Object.fromEntries(map.entries());
    },
  };
}
