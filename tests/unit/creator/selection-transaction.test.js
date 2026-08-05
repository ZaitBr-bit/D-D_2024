// Transação de seleção (Task 25): begin/update/commit/cancel.
//
// A regra que este arquivo existe para provar é uma só: SOMENTE `commit`
// altera o rascunho. Nos modais legados, cada clique já escrevia no
// personagem global e "Cancelar" apenas fechava a janela — o botão mentia.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createCreatorDraft } from '../../../site/js/features/creator/creator-state.js';
import { createSelectionTransaction } from '../../../site/js/features/creator/selection-transaction.js';

/**
 * Rascunho inicial de teste.
 * @returns {object}
 */
function rascunhoInicial() {
  const result = createCreatorDraft({ slices: { classSelection: 'inicial' } });
  assert.equal(result.ok, true);
  return result.value;
}

describe('transação de seleção', () => {
  test('begin não altera o rascunho', () => {
    const draft = rascunhoInicial();
    const tx = createSelectionTransaction({ draft });
    assert.equal(tx.begin('modal-1').ok, true);
    assert.equal(tx.getDraft(), draft, 'o rascunho commitado precisa ser o MESMO objeto');
    assert.deepEqual([...tx.getOpenTransactionIds()], ['modal-1']);
  });

  test('update acumula no estágio e NÃO altera o rascunho', () => {
    const draft = rascunhoInicial();
    const tx = createSelectionTransaction({ draft });
    tx.begin('modal-1');
    assert.equal(tx.update('modal-1', { slices: { classSelection: 'escolhido-no-modal' } }).ok, true);
    assert.equal(tx.update('modal-1', { slices: { classSkills: ['atletismo'] } }).ok, true);

    assert.equal(tx.getDraft().slices.classSelection, 'inicial', 'o rascunho não pode ver a escolha pendente');
    assert.equal(tx.getDraft().slices.classSkills, null);

    const staged = tx.getStaged('modal-1');
    assert.equal(staged.ok, true);
    assert.deepEqual(staged.value.slices, { classSelection: 'escolhido-no-modal', classSkills: ['atletismo'] });
  });

  test('commit é o ÚNICO ponto que altera o rascunho', () => {
    const tx = createSelectionTransaction({ draft: rascunhoInicial() });
    tx.begin('modal-1');
    tx.update('modal-1', { slices: { classSelection: 'mago' }, provenance: { classSelection: ['classe#mago'] } });
    const committed = tx.commit('modal-1');
    assert.equal(committed.ok, true);
    assert.equal(committed.value.slices.classSelection, 'mago');
    assert.deepEqual([...committed.value.provenance.classSelection], ['classe#mago']);
    assert.equal(tx.getDraft().slices.classSelection, 'mago');
    assert.deepEqual([...tx.getOpenTransactionIds()], []);
  });

  test('cancel descarta tudo e deixa o rascunho EXATAMENTE como estava', () => {
    const draft = rascunhoInicial();
    const tx = createSelectionTransaction({ draft });
    tx.begin('modal-1');
    tx.update('modal-1', { slices: { classSelection: 'nunca-confirmado', classSkills: ['furtividade'] } });
    const cancelled = tx.cancel('modal-1');
    assert.equal(cancelled.ok, true);
    assert.equal(tx.getDraft(), draft, 'cancelar não pode nem sequer criar um novo rascunho');
    assert.equal(tx.getDraft().slices.classSelection, 'inicial');
    assert.equal(tx.getDraft().slices.classSkills, null);
  });

  test('transações empilhadas são independentes; cancelar a de cima não desfaz a de baixo', () => {
    const tx = createSelectionTransaction({ draft: rascunhoInicial() });
    tx.begin('externo');
    tx.update('externo', { slices: { classSelection: 'clerigo' } });
    tx.begin('interno');
    tx.update('interno', { slices: { classSkills: ['medicina'] } });

    assert.equal(tx.cancel('interno').ok, true);
    assert.equal(tx.commit('externo').ok, true);
    assert.equal(tx.getDraft().slices.classSelection, 'clerigo');
    assert.equal(tx.getDraft().slices.classSkills, null, 'o estágio cancelado não pode vazar para o commit do pai');
  });

  test('commit parte do rascunho commitado ATUAL, sem descartar outro commit intermediário', () => {
    const tx = createSelectionTransaction({ draft: rascunhoInicial() });
    tx.begin('a');
    tx.update('a', { slices: { classSelection: 'druida' } });
    tx.begin('b');
    tx.update('b', { slices: { classSkills: ['natureza'] } });

    assert.equal(tx.commit('b').ok, true);
    assert.equal(tx.commit('a').ok, true);
    assert.deepEqual(tx.getDraft().slices.classSkills, ['natureza'], 'o commit de "a" não pode apagar o de "b"');
    assert.equal(tx.getDraft().slices.classSelection, 'druida');
  });

  test('operações sobre transação inexistente falham de forma estruturada', () => {
    const tx = createSelectionTransaction({ draft: rascunhoInicial() });
    for (const operation of [() => tx.update('x', {}), () => tx.commit('x'), () => tx.cancel('x'), () => tx.getStaged('x')]) {
      const result = operation();
      assert.equal(result.ok, false);
      assert.equal(result.error.code, 'CREATOR_TRANSACTION_NOT_OPEN');
    }
  });

  test('reabrir um id já aberto é erro, não um descarte silencioso do estágio', () => {
    const tx = createSelectionTransaction({ draft: rascunhoInicial() });
    tx.begin('modal-1');
    tx.update('modal-1', { slices: { classSelection: 'trabalho-em-andamento' } });
    const again = tx.begin('modal-1');
    assert.equal(again.ok, false);
    assert.equal(again.error.code, 'CREATOR_TRANSACTION_ALREADY_OPEN');
    assert.equal(tx.getStaged('modal-1').value.slices.classSelection, 'trabalho-em-andamento');
  });

  test('uma fatia desconhecida é recusada', () => {
    const tx = createSelectionTransaction({ draft: rascunhoInicial() });
    tx.begin('modal-1');
    const result = tx.update('modal-1', { slices: { fatiaInventada: 1 } });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CREATOR_TRANSACTION_SLICE_UNKNOWN');
  });

  test('cancelAll descarta todas as transações sem commitar nenhuma', () => {
    const draft = rascunhoInicial();
    const tx = createSelectionTransaction({ draft });
    tx.begin('a');
    tx.begin('b');
    tx.update('a', { slices: { classSelection: 'x' } });
    assert.equal(tx.cancelAll(), 2);
    assert.equal(tx.getDraft(), draft);
    assert.deepEqual([...tx.getOpenTransactionIds()], []);
  });

  test('duas instâncias de transação não compartilham estado', () => {
    const a = createSelectionTransaction({ draft: rascunhoInicial() });
    const b = createSelectionTransaction({ draft: rascunhoInicial() });
    a.begin('modal-1');
    a.update('modal-1', { slices: { classSelection: 'somente-a' } });
    a.commit('modal-1');
    assert.equal(a.getDraft().slices.classSelection, 'somente-a');
    assert.equal(b.getDraft().slices.classSelection, 'inicial');
    assert.deepEqual([...b.getOpenTransactionIds()], []);
  });
});
