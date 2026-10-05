// ============================================================
// medirTeclado (site/js/modal-teclado.js): decide se o teclado virtual está
// aberto a partir de window.visualViewport e da altura da janela.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { RAIZ } from './harness.mjs';

const { medirTeclado } = await import(pathToFileURL(resolve(RAIZ, 'site', 'js', 'modal-teclado.js')).href);

test('medirTeclado: sem visualViewport conta como teclado fechado, com a altura da janela', () => {
  assert.deepEqual(medirTeclado(null, 700), { aberto: false, topo: 0, altura: 700 });
  assert.deepEqual(medirTeclado(undefined, 700), { aberto: false, topo: 0, altura: 700 });
});

test('medirTeclado: área visível igual à janela = fechado', () => {
  assert.equal(medirTeclado({ height: 700, offsetTop: 0 }, 700).aberto, false);
});

test('medirTeclado: barra de endereço encolhendo poucos pixels não conta como teclado', () => {
  assert.equal(medirTeclado({ height: 650, offsetTop: 0 }, 700).aberto, false);
});

test('medirTeclado: área visível bem menor que a janela = aberto, com topo e altura da área visível', () => {
  assert.deepEqual(medirTeclado({ height: 380, offsetTop: 24 }, 700), { aberto: true, topo: 24, altura: 380 });
});

test('medirTeclado: offsetTop ausente vira 0', () => {
  assert.equal(medirTeclado({ height: 380 }, 700).topo, 0);
});
