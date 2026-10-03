// ============================================================
// Issue #118 -- o detalhe da magia mostra as classes com acesso a ela,
// como o livro.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { utils } = await modulosApp();

test('classesDaMagiaHtml lista as classes, escapa e ignora vazio/inválido', () => {
  assert.match(utils.classesDaMagiaHtml(['Guardião', 'Mago']), /Classes: Guardião, Mago/);
  assert.doesNotMatch(utils.classesDaMagiaHtml(['<b>x</b>']), /<b>/);
  assert.equal(utils.classesDaMagiaHtml([]), '');
  assert.equal(utils.classesDaMagiaHtml(undefined), '');
  assert.equal(utils.classesDaMagiaHtml('Mago'), '');
});
