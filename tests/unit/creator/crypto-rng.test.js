// ============================================================
// Provedor de aleatoriedade de PRODUÇÃO (Task 28, fechando o achado
// "Important 4" da Task 27: não existia provedor de RNG em produção, só
// helpers de teste — e por isso a rolagem 4d6 do passo `atributos` falharia
// com `CREATOR_ABILITIES_RNG_MISSING` no primeiro clique real).
//
// Os dois pontos que precisam ficar presos:
//
//   - a INTERFACE é a mesma que os testes já usam (`{next(): number}` em
//     `[0, 1)`), para que o comportamento testado seja o entregue;
//   - o intervalo é meio aberto: `1.0` nunca sai. Um `1.0` produziria a face
//     7 em `roll4d6DropLowest` (`Math.floor(next() * 6) + 1`).
// ============================================================
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { RNG_SOURCES, createCryptoRng } from '../../../site/js/infra/random/crypto-rng.js';
import { roll4d6DropLowest } from '../../../site/js/features/creator/steps/abilities-step.js';

describe('createCryptoRng', () => {
  test('usa crypto.getRandomValues quando disponível e declara a fonte', () => {
    const rng = createCryptoRng();
    assert.equal(rng.source, RNG_SOURCES.crypto, 'o ambiente de teste tem crypto; a fonte precisa refleti-lo');
    assert.equal(typeof rng.next, 'function');
  });

  test('todo valor fica em [0, 1) — 1.0 nunca sai, nem no valor máximo de uint32', () => {
    // `crypto` falso que devolve SEMPRE o maior uint32 possível: é o caso de
    // borda que uma divisão por 2^32-1 quebraria.
    const cryptoMaximo = {
      /**
       * @param {Uint32Array} buffer
       * @returns {Uint32Array}
       */
      getRandomValues(buffer) {
        buffer[0] = 4294967295;
        return buffer;
      },
    };
    const rng = createCryptoRng({ cryptoRef: cryptoMaximo });
    const valor = rng.next();
    assert.ok(valor >= 0 && valor < 1, `valor fora de [0,1): ${valor}`);
    assert.notEqual(valor, 1);
    // E a face resultante continua sendo um d6 legítimo.
    assert.equal(Math.floor(valor * 6) + 1, 6);
  });

  test('cai para Math.random quando não há crypto — e diz que caiu', () => {
    const rng = createCryptoRng({ cryptoRef: null });
    assert.equal(rng.source, RNG_SOURCES.mathRandom);
    for (let i = 0; i < 50; i += 1) {
      const valor = rng.next();
      assert.ok(valor >= 0 && valor < 1);
    }
  });

  test('alimenta a rolagem 4d6 do passo de atributos com resultados válidos', () => {
    const rng = createCryptoRng();
    for (let i = 0; i < 300; i += 1) {
      const rolagem = roll4d6DropLowest(rng);
      // 4d6 descartando o menor: mínimo 3 (1,1,1,1 -> 1+1+1), máximo 18.
      assert.ok(rolagem.total >= 3 && rolagem.total <= 18, `total fora da faixa: ${rolagem.total}`);
      assert.equal(rolagem.dice.length, 4);
      for (const face of rolagem.dice) {
        assert.ok(Number.isInteger(face) && face >= 1 && face <= 6, `face inválida: ${face}`);
      }
    }
  });

  test('produz valores variados (não é uma constante disfarçada)', () => {
    const rng = createCryptoRng();
    const vistos = new Set();
    for (let i = 0; i < 200; i += 1) {
      vistos.add(rng.next());
    }
    assert.ok(vistos.size > 100, `o provedor devolveu poucos valores distintos: ${vistos.size}`);
  });
});
