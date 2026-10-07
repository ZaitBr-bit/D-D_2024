// ============================================================
// Ordem dos espaços do inventário (espacos-inventario.js).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RAIZ, modulosApp } from './harness.mjs';

await modulosApp();
const E = await import(pathToFileURL(resolve(RAIZ, 'site/js/espacos-inventario.js')).href);
const locais = [{ id: 'a' }, { id: 'b' }];

test('sem ordem salva: Mochila primeiro e os locais na ordem de criação', () => {
  assert.deepEqual(E.ordemDosEspacos(locais), ['mochila', 'a', 'b']);
  assert.deepEqual(E.ordemDosEspacos([]), ['mochila']);
});

test('ordem salva vale; local removido sai e local novo entra no fim', () => {
  assert.deepEqual(E.ordemDosEspacos(locais, ['b', 'mochila', 'a']), ['b', 'mochila', 'a']);
  assert.deepEqual(E.ordemDosEspacos(locais, ['x', 'b', 'mochila']), ['b', 'mochila', 'a']);
  assert.deepEqual(E.ordemDosEspacos(locais, 'lixo'), ['mochila', 'a', 'b']);
});

test('moverEspacoPara: o arrastado ocupa o lugar do alvo, nos dois sentidos', () => {
  assert.deepEqual(E.moverEspacoPara(['mochila', 'a', 'b'], 'b', 'mochila'), ['b', 'mochila', 'a']);
  assert.deepEqual(E.moverEspacoPara(['mochila', 'a', 'b'], 'mochila', 'b'), ['a', 'b', 'mochila']);
  assert.deepEqual(E.moverEspacoPara(['mochila', 'a'], 'z', 'a'), ['mochila', 'a'], 'chave inexistente não muda');
  assert.deepEqual(E.moverEspacoPara(['mochila', 'a'], 'a', 'a'), ['mochila', 'a']);
});

test('aplicarEspaco põe no local e desequipa; vazio deixa na Mochila', () => {
  assert.deepEqual(E.aplicarEspaco({ nome: 'X', equipado: true }, 'a'), { nome: 'X', equipado: false, local: 'a' });
  assert.deepEqual(E.aplicarEspaco({ nome: 'X', local: 'a' }, ''), { nome: 'X' });
});
