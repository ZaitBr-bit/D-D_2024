// Utilitário vendorizado a partir de `ajv/dist/runtime/ucs2length.js` (Ajv
// 8.20.0, MIT), reescrito como ESM puro sem dependências. Conta o
// comprimento de uma string em unidades de código Unicode (não em unidades
// UTF-16), igual ao que os validadores gerados por
// `scripts/generate-schema-validators.mjs` esperam para `minLength`/
// `maxLength`. Mantido aqui (em vez de importar o pacote `ajv`) para que o
// navegador nunca precise carregar o motor de validação Ajv, só esta função
// pura de baixo nível.
// Fonte: https://mathiasbynens.be/notes/javascript-encoding

/**
 * Calcula o comprimento de `str` em unidades de código Unicode (UCS-2),
 * tratando pares substitutos (surrogate pairs) como um único caractere.
 * @param {string} str
 * @returns {number}
 */
export default function ucs2length(str) {
  const len = str.length;
  let length = 0;
  let pos = 0;
  let value;
  while (pos < len) {
    length++;
    value = str.charCodeAt(pos++);
    if (value >= 0xd800 && value <= 0xdbff && pos < len) {
      // high surrogate, e há um próximo caractere
      value = str.charCodeAt(pos);
      if ((value & 0xfc00) === 0xdc00) {
        pos++; // low surrogate
      }
    }
  }
  return length;
}
