// Módulo `infra/random/crypto-rng`: o PROVEDOR DE ALEATORIEDADE de produção.
//
// ## Por que este módulo existe (achado da Task 27)
//
// O passo `atributos` (`features/creator/steps/abilities-step.js`) recusa a
// rolagem 4d6 quando `context.rng` está ausente, com o erro nomeado
// `CREATOR_ABILITIES_RNG_MISSING`. Até a Task 27 as ÚNICAS implementações de
// `rng` no repositório eram helpers de teste (`tests/helpers/creator-steps.js`)
// e do harness E2E — ou seja, não existia provedor de produção nenhum, e o
// primeiro clique real em "Rolar 4d6" no criador novo falharia.
//
// A interface é a MESMA que os testes já usam — `{ next(): number }` em
// `[0, 1)` — de propósito: o passo não distingue o provedor real do
// determinístico, e por isso o comportamento testado é o comportamento
// entregue.
//
// ## `crypto.getRandomValues`, com `Math.random` como último recurso
//
// `getRandomValues` está disponível em todo navegador que o app suporta e em
// Node >= 18. `Math.random` fica como fallback EXPLÍCITO (e sinalizado por
// `source`) em vez de silencioso: um ambiente sem `crypto` continua conseguindo
// rolar dados, mas quem inspeciona o provedor consegue ver qual fonte está em
// uso. Nenhum dos dois é adequado a criptografia — e não precisa ser: o
// consumidor é uma rolagem de dado de RPG.
//
// ## Uniformidade: por que dividir por 2^32
//
// `getRandomValues(Uint32Array)` devolve inteiros uniformes em
// `[0, 2^32 - 1]`. Dividir por `2^32` (e não por `2^32 - 1`) mantém o
// resultado em `[0, 1)` — meio aberto à direita, exatamente o contrato de
// `Math.random` e o que `roll4d6DropLowest` assume ao fazer
// `Math.floor(next() * 6) + 1`. Dividir por `2^32 - 1` deixaria `1.0`
// alcançável e produziria, raramente, uma face 7.

const UINT32_RANGE = 4294967296; // 2^32

/**
 * Fontes possíveis de aleatoriedade, em ordem de preferência.
 * @type {Readonly<Record<string, string>>}
 */
export const RNG_SOURCES = Object.freeze({
  crypto: 'crypto.getRandomValues',
  mathRandom: 'Math.random',
});

/**
 * Cria o provedor de aleatoriedade de produção.
 *
 * @param {{cryptoRef?: object|null}} [params] - `cryptoRef` existe só para
 *   teste (injetar um `crypto` falso ou ausente); em produção nada é passado e
 *   o `crypto` do ambiente é resolvido NA CHAMADA, nunca na carga do módulo.
 * @returns {Readonly<{next: () => number, source: string}>}
 */
export function createCryptoRng({ cryptoRef } = {}) {
  const resolved = cryptoRef === undefined ? (typeof globalThis !== 'undefined' ? globalThis.crypto : null) : cryptoRef;
  const temCrypto = resolved !== null && resolved !== undefined && typeof resolved.getRandomValues === 'function';

  // Um buffer de um elemento, reutilizado: `getRandomValues` preenche no
  // lugar, então alocar um `Uint32Array` por rolagem seria desperdício puro.
  const buffer = temCrypto ? new Uint32Array(1) : null;

  return Object.freeze({
    source: temCrypto ? RNG_SOURCES.crypto : RNG_SOURCES.mathRandom,
    /**
     * Um número em `[0, 1)` — o mesmo contrato de `Math.random`.
     * @returns {number}
     */
    next() {
      if (!temCrypto) {
        return Math.random();
      }
      resolved.getRandomValues(buffer);
      return buffer[0] / UINT32_RANGE;
    },
  });
}
