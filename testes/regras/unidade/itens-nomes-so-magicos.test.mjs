// ============================================================
// nomesReaproveitadosDoEquipamento: nomes que a ficha esconde de Equipamento.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAIZ } from './harness.mjs';
import { nomesReaproveitadosDoEquipamento } from '../../../site/js/itens-magicos-catalogo.js';

test('acervo real: só Pergaminho (Truque), Pergaminho (1º Círculo) e Poção de Cura', () => {
  const acervo = JSON.parse(readFileSync(resolve(RAIZ, 'dados/livro-do-mestre/capitulo7/itens_magicos.json'), 'utf-8'));
  assert.deepEqual([...nomesReaproveitadosDoEquipamento(acervo.itens)].sort(),
    ['Pergaminho Mágico (1º Círculo)', 'Pergaminho Mágico (Truque)', 'Poção de Cura']);
});

test('lê livro_jogador do item e das variantes; ignora outros arquivos e entrada vazia', () => {
  const nomes = nomesReaproveitadosDoEquipamento([
    { livro_jogador: { arquivo: 'equipamento_aventura', nome: 'A' } },
    { variantes: [{ livro_jogador: { arquivo: 'equipamento_aventura', nome: 'B' } }, { nome: 'sem ref' }] },
    { livro_jogador: { arquivo: 'armas', nome: 'C' } },
  ]);
  assert.deepEqual([...nomes].sort(), ['A', 'B']);
  assert.equal(nomesReaproveitadosDoEquipamento().size, 0);
});
