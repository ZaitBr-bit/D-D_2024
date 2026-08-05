// Utilitário vendorizado a partir de `fast-deep-equal` (dependência
// transitiva do Ajv, usada por `ajv/dist/runtime/equal.js`), reescrito como
// ESM puro sem dependências. Faz igualdade profunda estrutural, usada pelos
// validadores gerados para `const`/`enum` com valores não primitivos e para
// `uniqueItems`. Mantido aqui (em vez de importar o pacote `ajv`) para que o
// navegador nunca precise carregar o motor de validação Ajv, só esta função
// pura de baixo nível.

/**
 * Compara `a` e `b` por igualdade estrutural profunda.
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export default function equal(a, b) {
  if (a === b) return true;

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (a.constructor !== b.constructor) return false;

    let length;
    let i;
    let keys;
    if (Array.isArray(a)) {
      length = a.length;
      if (length !== b.length) return false;
      for (i = length; i-- !== 0; ) {
        if (!equal(a[i], b[i])) return false;
      }
      return true;
    }

    if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
    if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
    if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();

    keys = Object.keys(a);
    length = keys.length;
    if (length !== Object.keys(b).length) return false;

    for (i = length; i-- !== 0; ) {
      if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
    }

    for (i = length; i-- !== 0; ) {
      const key = keys[i];
      if (!equal(a[key], b[key])) return false;
    }

    return true;
  }

  // true se ambos forem NaN, false caso contrário.
  return a !== a && b !== b;
}
