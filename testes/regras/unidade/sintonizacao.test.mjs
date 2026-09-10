// ============================================================
// Issue #57 -- teto de tres itens sintonizados.
//
// Livro (Equipamento.md:1198): "Voce pode estar sintonizado com no maximo
// tres itens magicos ao mesmo tempo. Qualquer tentativa de sintonizar um
// quarto item falha".
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { sintonizacao } = await modulosApp();

/** Personagem com `quantos` itens que pedem sintonizacao, `marcados` deles ligados. */
function comItens(quantos, marcados) {
  return {
    nome: 'Teste', inventario: Array.from({ length: quantos }, (_, i) => ({
      nome: `Item ${i}`, tipo: 'customizado', quantidade: 1,
      dados: { requer_sintonizacao: true },
      sintonizado: i < marcados,
    })),
  };
}

test('o teto e tres', () => {
  assert.equal(sintonizacao.TETO_SINTONIZACAO, 3);
});

test('sem nenhum marcado, conta zero', () => {
  assert.equal(sintonizacao.itensSintonizados(comItens(5, 0)).length, 0);
});

test('conta so os marcados', () => {
  assert.equal(sintonizacao.itensSintonizados(comItens(5, 2)).length, 2);
});

test('com dois marcados, o terceiro ainda pode', () => {
  assert.equal(sintonizacao.podeSintonizar(comItens(5, 2), 4), true);
});

test('com tres marcados, o quarto nao pode', () => {
  assert.equal(sintonizacao.podeSintonizar(comItens(5, 3), 4), false);
});

test('com tres marcados, um dos JA marcados continua podendo (para desmarcar)', () => {
  assert.equal(sintonizacao.podeSintonizar(comItens(5, 3), 0), true);
});

test('item que nao pede sintonizacao nunca pode', () => {
  const p = comItens(1, 0);
  p.inventario[0].dados.requer_sintonizacao = false;
  assert.equal(sintonizacao.podeSintonizar(p, 0), false);
});

test('personagem sem inventario nao quebra', () => {
  assert.deepEqual(sintonizacao.itensSintonizados({}), []);
  assert.equal(sintonizacao.podeSintonizar({}, 0), false);
});

test('item antigo, sem a chave `sintonizado`, conta como nao sintonizado', () => {
  const p = comItens(3, 0);
  p.inventario.forEach(i => { delete i.sintonizado; });
  assert.equal(sintonizacao.itensSintonizados(p).length, 0);
});

// Item sintonizado orfao: o jogador sintonizou, depois editou o item e
// desmarcou "Requer Sintonizacao". A caixa some da tela mas `sintonizado:
// true` continua gravado -- sem o portao de `requer_sintonizacao` aqui, a
// vaga ficava presa e invisivel, sem controle nenhum na tela para liberar.
test('item que deixou de pedir sintonizacao nao ocupa mais vaga', () => {
  const p = comItens(3, 3);
  p.inventario[0].dados.requer_sintonizacao = false;
  assert.equal(sintonizacao.itensSintonizados(p).length, 2);
});

test('item orfao (sintonizado=true, requer_sintonizacao=false) libera a vaga para outro sintonizar', () => {
  const p = comItens(4, 3);
  p.inventario[0].dados.requer_sintonizacao = false;
  assert.equal(sintonizacao.podeSintonizar(p, 3), true);
});
