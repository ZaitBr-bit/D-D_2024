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

// --- Issue #100: categorias que nao sao arma ---
test('separarCategoria: arma vai para categoria, tipo novo para tipo_item, resto vazio', () => {
  const { separarCategoria, TIPOS_ITEM } = itemCustomForm;
  assert.deepEqual(separarCategoria('Armas Marciais Corpo a Corpo'), { categoria: 'Armas Marciais Corpo a Corpo', tipo_item: '' });
  for (const t of TIPOS_ITEM) assert.deepEqual(separarCategoria(t), { categoria: '', tipo_item: t });
  assert.deepEqual(separarCategoria(''), { categoria: '', tipo_item: '' });
  assert.deepEqual(separarCategoria('Qualquer coisa'), { categoria: '', tipo_item: '' });
});

test('o formulário oferece os tipos novos e o rótulo "—" no lugar de "não é arma"', () => {
  const html = itemCustomForm.htmlFormularioItemCustomizado();
  for (const t of itemCustomForm.TIPOS_ITEM) assert.match(html, new RegExp(`<option value="${t}"`));
  assert.doesNotMatch(html, /não é arma/);
});

test('editar item com tipo_item seleciona o tipo; com categoria de arma seleciona a arma', () => {
  const html = (d) => itemCustomForm.htmlFormularioItemCustomizado({ nome: 'x', dados: d });
  assert.match(html({ tipo_item: 'Ferramenta' }), /<option value="Ferramenta" selected>/);
  assert.match(html({ categoria: 'Armas Simples à Distância' }), /<option value="Armas Simples à Distância" selected>/);
});

// --- Issue #101: formulario em secoes recolhiveis ---
test('secoesComValor: criação (item vazio) -> tudo recolhido; edição abre só a seção com dado', () => {
  const { secoesComValor } = itemCustomForm;
  assert.deepEqual(secoesComValor({}), { categoria: false, atributos: false, raridade: false });
  assert.deepEqual(secoesComValor({ tipo_item: 'Ferramenta' }), { categoria: true, atributos: false, raridade: false });
  assert.deepEqual(secoesComValor({ propriedades: 'Leve' }), { categoria: true, atributos: false, raridade: false });
  assert.deepEqual(secoesComValor({ bonus_ca: '2' }), { categoria: false, atributos: true, raridade: false });
  assert.deepEqual(secoesComValor({ bonus_ca: '0', bonus_ataque: '0', peso: '' }), { categoria: false, atributos: false, raridade: false });
  assert.deepEqual(secoesComValor({ peso: '2 kg' }), { categoria: false, atributos: true, raridade: false });
  assert.deepEqual(secoesComValor({ requer_sintonizacao: true }), { categoria: false, atributos: false, raridade: true });
  assert.deepEqual(secoesComValor({ raridade: 'Rara' }), { categoria: false, atributos: false, raridade: true });
});

test('o formulário vem em seções <details> e mantém todos os ids', () => {
  const html = itemCustomForm.htmlFormularioItemCustomizado();
  assert.equal((html.match(/<details class="ic-secao"/g) || []).length, 3);
  assert.doesNotMatch(html, /<details class="ic-secao"[^>]* open/, 'criação nasce recolhida');
  for (const id of ['ic-nome', 'ic-desc', 'ic-ca', 'ic-ca-base', 'ic-dano', 'ic-atq', 'ic-categoria', 'ic-propriedades',
    'ic-maestria', 'ic-atq-magia', 'ic-cd-magia', 'ic-peso', 'ic-raridade', 'ic-preco', 'ic-sintonizacao']) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} sumiu`);
  }
});

test('edição abre a seção que tem dado', () => {
  const html = itemCustomForm.htmlFormularioItemCustomizado({ nome: 'x', dados: { bonus_ca: '2' } });
  assert.match(html, /<details class="ic-secao" data-ic-secao="atributos" open>/);
  assert.match(html, /<details class="ic-secao" data-ic-secao="categoria">/);
});
