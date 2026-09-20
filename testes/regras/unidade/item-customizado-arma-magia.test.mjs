// ============================================================
// Issues #82/#37 -- item customizado com bonus mecanico: campos de
// categoria/propriedades/maestria de arma (para entrar no MESMO calculo
// de proficiencia/ataque que uma arma de catalogo) e bonus de
// ataque/CD de magia (para itens tipo varinha/cajado customizados).
// O formulario ja tinha raridade/preco/sintonizacao; nada disso plugava
// no motor de calculo -- este oraculo mede exatamente esse elo.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

const { itemCustomForm, utils } = await modulosApp();

test('o HTML do formulario traz os campos novos de arma e de bonus de magia', () => {
  const html = itemCustomForm.htmlFormularioItemCustomizado();
  for (const id of ['ic-categoria', 'ic-propriedades', 'ic-maestria', 'ic-atq-magia', 'ic-cd-magia']) {
    assert.ok(html.includes(`id="${id}"`), `falta o campo ${id}`);
  }
});

test('categoria de arma some vazia por padrao -- item customizado nao vira arma sem escolha', () => {
  const html = itemCustomForm.htmlFormularioItemCustomizado();
  assert.ok(html.includes('<option value=""'), 'a categoria tem de aceitar "nao e arma"');
});

test('as categorias de arma sao as quatro do catalogo', () => {
  assert.deepEqual(itemCustomForm.CATEGORIAS_ARMA, [
    'Armas Simples Corpo a Corpo', 'Armas Simples à Distância',
    'Armas Marciais Corpo a Corpo', 'Armas Marciais à Distância',
  ]);
});

test('o formulario preenchido reflete categoria, propriedades e maestria do item', () => {
  const html = itemCustomForm.htmlFormularioItemCustomizado({
    nome: 'Espada Ancestral', descricao: '',
    dados: { categoria: 'Armas Marciais Corpo a Corpo', propriedades: 'Acuidade, Leve', maestria: 'Trespassar' },
  });
  assert.ok(/<option value="Armas Marciais Corpo a Corpo" selected/.test(html), 'a categoria tem de vir selecionada');
  assert.ok(html.includes('Acuidade, Leve'), 'as propriedades tem de vir preenchidas');
  assert.ok(/<option value="Trespassar" selected/.test(html), 'a maestria tem de vir selecionada');
});

// bonusMagiaDeItens nao e exportado (funcao interna de utils.js) -- medido
// atraves de calcCDMagia/calcAtaqueMagia/conjuracoesPorClasse, que sao a
// API publica que a ficha realmente le.
test('bonus de ataque/CD de magia de item customizado EQUIPADO entra na conta', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  p.atributos.inteligencia = 16; // mod +3
  const cdSemItem = utils.calcCDMagia(p);
  const atqSemItem = utils.calcAtaqueMagia(p);

  p.inventario = [{
    nome: 'Cajado do Zait', tipo: 'customizado', equipado: true,
    dados: { bonus_ataque_magia: '2', bonus_cd_magia: '1' },
  }];

  assert.equal(utils.calcCDMagia(p), cdSemItem + 1, 'a CD de magia tem de somar o bonus do item equipado');
  assert.equal(utils.calcAtaqueMagia(p), atqSemItem + 2, 'o ataque de magia tem de somar o bonus do item equipado');
});

test('bonus de item customizado NAO equipado nao entra na conta', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const cdSemItem = utils.calcCDMagia(p);
  p.inventario = [{
    nome: 'Cajado do Zait', tipo: 'customizado', equipado: false,
    dados: { bonus_ataque_magia: '2', bonus_cd_magia: '1' },
  }];
  assert.equal(utils.calcCDMagia(p), cdSemItem, 'item na mochila (nao equipado) nao pode somar bonus nenhum');
});

test('item customizado que EXIGE sintonizacao so soma bonus se estiver sintonizado', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const cdSemItem = utils.calcCDMagia(p);
  p.inventario = [{
    nome: 'Anel Arcano', tipo: 'customizado', equipado: true, sintonizado: false,
    dados: { bonus_cd_magia: '1', requer_sintonizacao: true },
  }];
  assert.equal(utils.calcCDMagia(p), cdSemItem,
    'equipado mas nao sintonizado, com sintonizacao exigida, nao pode somar o bonus');

  p.inventario[0].sintonizado = true;
  assert.equal(utils.calcCDMagia(p), cdSemItem + 1, 'sintonizado, o bonus passa a valer');
});

test('conjuracoesPorClasse (multiclasse) tambem soma o bonus de item por classe conjuradora', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Mago', nivel: 5 },
    { classe: 'Clérigo', nivel: 3 },
  ]);
  const antes = utils.conjuracoesPorClasse(p);
  p.inventario = [{
    nome: 'Amuleto do Zait', tipo: 'customizado', equipado: true,
    dados: { bonus_ataque_magia: '1', bonus_cd_magia: '1' },
  }];
  const depois = utils.conjuracoesPorClasse(p);
  assert.equal(depois.length, antes.length, 'sanity: mesmo numero de classes conjuradoras');
  for (let i = 0; i < antes.length; i++) {
    assert.equal(depois[i].cd, antes[i].cd + 1, `CD de ${antes[i].classe} tem de somar o bonus do item`);
    assert.equal(depois[i].ataque, antes[i].ataque + 1, `ataque de ${antes[i].classe} tem de somar o bonus do item`);
  }
});
