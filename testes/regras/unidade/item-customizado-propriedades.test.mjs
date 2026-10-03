// ============================================================
// Issue #104 -- propriedades do item personalizado: lista padrao do livro
// + propriedade personalizada (nome e descricao), em vez de texto livre.
// `dados.propriedades` continua a string "A, B" (compatibilidade) e as
// personalizadas guardam a descricao em `dados.propriedades_personalizadas`.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { itemCustomForm } = await modulosApp();

test('PROPRIEDADES_ARMA tem as 10 do livro', () => {
  assert.equal(itemCustomForm.PROPRIEDADES_ARMA.length, 10);
  assert.ok(itemCustomForm.PROPRIEDADES_ARMA.includes('Duas Mãos'));
});

test('descricaoDePropriedade: personalizada primeiro, depois glossario, senao vazio', () => {
  const custom = [{ nome: 'Quebradiço', descricao: 'Quebra com 1 natural.' }];
  const glos = [{ nome: 'Leve', descricao: 'Fácil de manejar.' }];
  assert.equal(itemCustomForm.descricaoDePropriedade('Quebradiço', custom, glos), 'Quebra com 1 natural.');
  assert.equal(itemCustomForm.descricaoDePropriedade('Leve', custom, glos), 'Fácil de manejar.');
  assert.equal(itemCustomForm.descricaoDePropriedade('Inexistente', custom, glos), '');
  assert.equal(itemCustomForm.descricaoDePropriedade('Leve (alcance 6)', [], glos), 'Fácil de manejar.', 'ignora o parenteses');
});

test('o formulário renderiza chips para a string antiga e para as personalizadas', () => {
  const html = itemCustomForm.htmlFormularioItemCustomizado({ nome: 'x', dados: {
    propriedades: 'Leve, Quebradiço',
    propriedades_personalizadas: [{ nome: 'Quebradiço', descricao: 'Quebra com 1 natural.' }],
  } });
  assert.match(html, /data-ic-prop[^>]*data-nome="Leve"/);
  assert.match(html, /data-ic-prop[^>]*data-nome="Quebradiço"[^>]*data-desc="Quebra com 1 natural\."/);
  assert.match(html, /id="ic-prop-add"/);
  assert.match(html, /<input type="hidden" id="ic-propriedades"/);
});

test('chip com HTML no nome ou na descricao e escapado', () => {
  const html = itemCustomForm.htmlFormularioItemCustomizado({ nome: 'x', dados: {
    propriedades: '"><img src=x onerror=1>',
    propriedades_personalizadas: [{ nome: '"><img src=x onerror=1>', descricao: '"><script>1</script>' }],
  } });
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<script>1/);
});
