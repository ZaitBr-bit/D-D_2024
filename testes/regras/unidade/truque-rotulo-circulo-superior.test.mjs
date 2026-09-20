// ============================================================
// Issue #97 -- a descrição de "Aprimoramento de Truque" ganhava o rótulo
// fixo "Em círculos superiores" na frente, o mesmo que a magia de círculo
// 1+ usa pra descrever upcast -- truque não tem círculo pra upar, e o
// texto do campo `circulo_superior` de um truque (dados/magias/
// truques.json) já começa com "Aprimoramento de Truque.", então o rótulo
// ficava contraditório. `rotuloCirculoSuperiorHtml` decide o rótulo certo
// pelo círculo (0 = truque = sem rótulo).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { utils } = await modulosApp();

test('truque (círculo 0) não recebe rótulo nenhum -- só o texto do campo já basta', () => {
  assert.equal(utils.rotuloCirculoSuperiorHtml(0), '');
});

test('magia de círculo 1+ recebe o rótulo "Em círculos superiores"', () => {
  for (const circulo of [1, 2, 3, 9]) {
    assert.match(utils.rotuloCirculoSuperiorHtml(circulo), /Em círculos superiores/,
      `círculo ${circulo} deveria ganhar o rótulo`);
  }
});
