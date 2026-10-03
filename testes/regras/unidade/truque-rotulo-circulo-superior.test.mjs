// ============================================================
// Issue #97 -- a descrição de "Aprimoramento de Truque" ganhava o rótulo
// fixo "Em círculos superiores" na frente, o mesmo que a magia de círculo
// 1+ usa pra descrever upcast -- truque não tem círculo pra upar, e o
// texto do campo `circulo_superior` de um truque (dados/magias/
// truques.json) já começa com "Aprimoramento de Truque.", então o rótulo
// ficava contraditório. Issue #102: o rótulo passou a ser o do PHB 2024
// ("Usando um Espaço de Magia de Círculo Superior.", em negrito) e
// `circuloSuperiorHtml` monta o bloco inteiro (rótulo + descrição).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { utils } = await modulosApp();

test('truque: sem rótulo extra, só o texto do catálogo', () => {
  const h = utils.circuloSuperiorHtml('Aprimoramento de Truque. O dano aumenta em 1d6.', 0);
  assert.doesNotMatch(h, /Usando um Espaço/);
  assert.match(h, /Aprimoramento de Truque/);
});

test('magia do catálogo: a frase do livro vira negrito e não duplica', () => {
  const h = utils.circuloSuperiorHtml('Usando um Espaço de Magia de Círculo Superior. O dano aumenta em 1d6.', 3);
  assert.match(h, /<strong>Usando um Espaço de Magia de Círculo Superior\.<\/strong>/);
  assert.equal((h.match(/Usando um Espaço de Magia/g) || []).length, 1);
  assert.doesNotMatch(h, /Em círculos superiores/i);
});

test('magia personalizada sem a frase: o rótulo do livro é acrescentado em negrito', () => {
  const h = utils.circuloSuperiorHtml('Mais 1d6 de dano por círculo.', 2);
  assert.match(h, /^(<p>)?<strong>Usando um Espaço de Magia de Círculo Superior\.<\/strong> /);
  assert.match(h, /Mais .*1d6/);
});

test('texto vazio ou ausente devolve vazio; HTML no texto é escapado', () => {
  assert.equal(utils.circuloSuperiorHtml('', 2), '');
  assert.equal(utils.circuloSuperiorHtml(undefined, 2), '');
  assert.doesNotMatch(utils.circuloSuperiorHtml('<img src=x onerror=1>', 2), /<img/);
});
