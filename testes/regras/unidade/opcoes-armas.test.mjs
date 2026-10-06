// Cards de propriedade e maestria do item personalizado: cada opção traz a descrição do livro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { modulosApp, RAIZ } from './harness.mjs';

const { itemCustomForm } = await modulosApp();
const { opcoesPropriedadesArma, opcoesMaestriaArma } = await import('../../../site/js/opcoes-armas.js');
const glossario = JSON.parse(readFileSync(`${RAIZ}/dados/equipamento/armas.json`, 'utf-8')).propriedades;

test('propriedades: 10 do livro com resumo e detalhe, mais o card Personalizada', () => {
  const ops = opcoesPropriedadesArma(glossario);
  assert.equal(ops.length, itemCustomForm.PROPRIEDADES_ARMA.length + 1);
  assert.deepEqual(ops.slice(0, -1).map(o => o.id), itemCustomForm.PROPRIEDADES_ARMA);
  for (const o of ops.slice(0, -1)) {
    assert.ok(o.resumo && o.resumo.length > 10, `${o.id} sem resumo`);
    assert.ok(o.detalhe, `${o.id} sem detalhe`);
  }
  assert.equal(ops.at(-1).id, '__personalizada__');
});

test('maestria: card Nenhuma primeiro, depois as 8 do livro com descrição', () => {
  const ops = opcoesMaestriaArma(glossario);
  assert.equal(ops[0].id, '__nenhuma__');
  assert.deepEqual(ops.slice(1).map(o => o.id), itemCustomForm.MAESTRIAS_ARMA);
  for (const o of ops.slice(1)) assert.ok(o.resumo, `${o.id} sem resumo`);
});

test('item que não é arma: só o card Personalizada nas propriedades', () => {
  const ops = opcoesPropriedadesArma(glossario, { ehArma: false });
  assert.deepEqual(ops.map(o => o.id), ['__personalizada__']);
});

test('sem glossário os cards saem só com o nome, sem quebrar', () => {
  assert.equal(opcoesPropriedadesArma().length, 11);
  assert.equal(opcoesMaestriaArma([]).length, 9);
});

test('texto do glossário é escapado no detalhe', () => {
  const ops = opcoesPropriedadesArma([{ nome: 'Acuidade', descricao: '<b>x</b> & y' }]);
  assert.ok(!ops[0].detalhe.includes('<b>'));
});

test('o formulário mantém os ids de propriedade e maestria como campos ocultos e abre os cards por botão', () => {
  const html = itemCustomForm.htmlFormularioItemCustomizado();
  assert.match(html, /<input type="hidden" id="ic-prop-select"/);
  assert.match(html, /<input type="hidden" id="ic-maestria"/);
  assert.match(html, /<button[^>]*id="ic-prop-add"/);
  assert.match(html, /<button[^>]*id="ic-maestria-btn"[^>]*>Selecionar maestria/);
  assert.match(html, /id="ic-maestria-atual">Nenhuma</);
  // Os cards só nascem dentro do popup, aberto pelo clique no botão.
  assert.doesNotMatch(html, /id="ic-prop-cards"/);
  assert.doesNotMatch(html, /id="ic-maestria-cards"/);
});
