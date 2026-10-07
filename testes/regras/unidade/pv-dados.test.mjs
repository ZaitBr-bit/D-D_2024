// ============================================================
// PV de magia por dados (regras-pv-dados.js): média ou valor rolado.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RAIZ } from './harness.mjs';

const P = await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-pv-dados.js')).href);
const VITALIDADE = { quantidade: 2, faces: 4, fixo: 4, por_circulo: 5, base_circulo: 1 };
const BANQUETE = { quantidade: 2, faces: 10, fixo: 0 };

test('Vitalidade Vazia: média 9 no 1º círculo e +5 por círculo acima', () => {
  assert.equal(P.valorPelaMedia(VITALIDADE, 1), 9);
  assert.equal(P.valorPelaMedia(VITALIDADE, 2), 14);
  assert.equal(P.valorPelaMedia(VITALIDADE, 3), 19);
});

test('Banquete de Heróis: média 11 de 2d10', () => {
  assert.equal(P.valorPelaMedia(BANQUETE, 6), 11);
});

test('valor rolado soma a parte fixa e o bônus do círculo', () => {
  assert.equal(P.valorPelosDados(VITALIDADE, 1, 7), 11, '7 + 4');
  assert.equal(P.valorPelosDados(VITALIDADE, 3, 2), 16, '2 + 4 + 5 + 5');
  assert.equal(P.valorPelosDados(BANQUETE, 6, 15), 15);
});

test('soma fora dos dados ou não inteira é recusada', () => {
  assert.equal(P.valorPelosDados(VITALIDADE, 1, 1), null, 'abaixo do mínimo 2');
  assert.equal(P.valorPelosDados(VITALIDADE, 1, 9), null, 'acima do máximo 8');
  assert.equal(P.valorPelosDados(VITALIDADE, 1, '3,5'), null);
  assert.equal(P.valorPelosDados(VITALIDADE, 1, ''), null);
  assert.deepEqual(P.limitesDosDados(BANQUETE), { minimo: 2, maximo: 20 });
});
