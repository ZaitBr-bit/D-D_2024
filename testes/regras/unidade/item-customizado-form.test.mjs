// ============================================================
// Issue #57 -- o formulario do item customizado vira modulo proprio.
//
// O formulario existia duas vezes (criar e editar) com a validacao
// copiada. Este oraculo mede a parte PURA, que e a que os dois modais
// passam a compartilhar.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { itemCustomForm } = await modulosApp();

test('item sem nome e recusado', () => {
  const erros = itemCustomForm.validarItemCustomizado({ nome: '', dano: '' });
  assert.equal(erros.length, 1);
  assert.match(erros[0], /nome/i);
});

test('item com nome e sem dano passa', () => {
  assert.deepEqual(itemCustomForm.validarItemCustomizado({ nome: 'Amuleto', dano: '' }), []);
});

test('dano no formato de dados passa', () => {
  for (const dano of ['1d8', '2d6 Cortante', '1d4+2 Perfurante', '1d4 + 2 Perfurante']) {
    assert.deepEqual(itemCustomForm.validarItemCustomizado({ nome: 'Espada', dano }), [],
      `"${dano}" deveria ser aceito`);
  }
});

test('dano fora do formato e recusado', () => {
  for (const dano of ['muito', '6', 'd6', '1x8']) {
    const erros = itemCustomForm.validarItemCustomizado({ nome: 'Espada', dano });
    assert.equal(erros.length, 1, `"${dano}" deveria ser recusado`);
    assert.match(erros[0], /formato de dados/i);
  }
});

test('nome e dano invalidos juntos acusam os dois', () => {
  assert.equal(itemCustomForm.validarItemCustomizado({ nome: '', dano: 'xis' }).length, 2);
});

test('o HTML do formulario traz os ids que a leitura procura', () => {
  const html = itemCustomForm.htmlFormularioItemCustomizado();
  for (const id of ['ic-nome', 'ic-desc', 'ic-ca', 'ic-ca-base', 'ic-dano', 'ic-atq', 'ic-peso', 'ic-erros']) {
    assert.ok(html.includes(`id="${id}"`), `falta o campo ${id}`);
  }
});

test('o HTML preenchido devolve os valores do item recebido', () => {
  const html = itemCustomForm.htmlFormularioItemCustomizado({
    nome: 'Escudo do Zait', descricao: 'brilha',
    dados: { bonus_ca: '2', ca_base: '', dano: '', bonus_ataque: '0', peso: '3 kg' },
  });
  assert.ok(html.includes('Escudo do Zait'), 'o nome tem de vir preenchido');
  assert.ok(html.includes('brilha'), 'a descricao tem de vir preenchida');
});

test('as raridades sao as seis do livro, na ordem', () => {
  assert.deepEqual(itemCustomForm.RARIDADES,
    ['Comum', 'Incomum', 'Rara', 'Muito Rara', 'Lendária', 'Artefato']);
});

test('o formulario tem os campos de raridade, preco e sintonizacao', () => {
  const html = itemCustomForm.htmlFormularioItemCustomizado();
  for (const id of ['ic-raridade', 'ic-preco', 'ic-sintonizacao']) {
    assert.ok(html.includes(`id="${id}"`), `falta o campo ${id}`);
  }
  // O seletor de raridade abre com a opcao vazia: item nao magico e o padrao.
  assert.ok(html.includes('<option value=""'), 'a raridade tem de aceitar "nao informada"');
});

test('o formulario preenchido reflete raridade, preco e sintonizacao do item', () => {
  const html = itemCustomForm.htmlFormularioItemCustomizado({
    nome: 'Anel de Proteção', descricao: '',
    dados: { raridade: 'Rara', preco: '3500 PO', requer_sintonizacao: true },
  });
  assert.ok(/<option value="Rara" selected/.test(html), 'a raridade tem de vir selecionada');
  assert.ok(html.includes('3500 PO'), 'o preco tem de vir preenchido');
  assert.ok(/id="ic-sintonizacao"[^>]*checked/.test(html), 'a sintonizacao tem de vir marcada');
});
