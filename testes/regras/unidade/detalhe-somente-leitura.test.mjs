// htmlDetalheItem em modo somente leitura: sem botões de edição, com propriedades e maestria.
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

const { sheetEstado } = await modulosApp();
const { htmlDetalheItem } = await import('../../../site/js/sheet/inventario.js');
sheetEstado.definirChar(await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 1 }]));

const props = [{ nome: 'Acuidade', descricao: 'Use FOR ou DES.' }, { nome: 'Ágil', descricao: 'Ataque adicional como parte da ação Atacar.' }];
const adaga = { nome: 'Adaga', tipo: 'arma', dados: { categoria: 'Armas Simples Corpo a Corpo', dano: '1d4 Perfurante', maestria: 'Ágil', propriedades: 'Acuidade, Leve', peso: '0,5 kg', custo: '2 PO' } };

test('somenteLeitura mostra propriedades expansíveis e maestria, e omite contador e atributo', () => {
  const html = htmlDetalheItem(adaga, props, { somenteLeitura: true });
  assert.match(html, /<details/);
  assert.match(html, /Maestria: Ágil|MAESTRIA/i);
  assert.doesNotMatch(html, /btn-adicionar-contador/);
  assert.doesNotMatch(html, /sel-atributo-item/);
});
test('sem a opção o detalhe continua igual ao de hoje (contador e atributo presentes)', () => {
  const html = htmlDetalheItem(adaga, props);
  assert.match(html, /btn-adicionar-contador/);
  assert.match(html, /sel-atributo-item/);
});

// Arma personalizada mostra no detalhe as mesmas informações da arma de catálogo.
test('arma personalizada: Categoria/Dano, Maestria e sua descrição aparecem mesmo sem propriedades', () => {
  const clava = { nome: 'Clava X', tipo: 'customizado', descricao: '', dados: { categoria: 'Armas Simples Corpo a Corpo', dano: '1d8 Contundente', maestria: 'Ágil', preco: '2 PP', peso: '5 kg' } };
  const html = htmlDetalheItem(clava, props);
  assert.ok(html.includes('Categoria:</strong> Armas Simples Corpo a Corpo'));
  assert.ok(html.includes('Dano:</strong> 1d8 Contundente'));
  assert.ok(html.includes('Maestria:</strong> Ágil'));
  assert.ok(html.includes('<span>Maestria: Ágil</span>'));
  assert.match(html, /Ataque adicional/);
  assert.equal((html.match(/Dano:/g) || []).length, 1);
});
