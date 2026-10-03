// ============================================================
// Issue #120 -- itens do Equipamento de Aventura sem descricao e
// ferramentas sem Usar Objeto/Fabricacao. Mede os DADOS contra o livro.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RAIZ, modulosApp } from './harness.mjs';

const lerJson = (rel) => JSON.parse(readFileSync(resolve(RAIZ, rel), 'utf-8'));
const tabelaFerramentas = () => lerJson('dados/equipamento/ferramentas.json').tabelas
  .find(t => (t.cabecalhos || []).includes('Ferramenta')).dados;

test('todo item de equipamento de aventura tem descricao', () => {
  const sem = lerJson('dados/equipamento/equipamento_aventura.json').itens
    .filter(i => !String(i.descricao || '').trim()).map(i => i.nome);
  assert.deepEqual(sem, [], 'itens sem descricao');
});

test('toda ferramenta da tabela tem detalhes com Usar Objeto', () => {
  const sem = tabelaFerramentas().filter(f => !String(f.detalhes?.usar_objeto || '').trim()).map(f => f.Ferramenta);
  assert.deepEqual(sem, [], 'ferramentas sem Usar Objeto');
});

test('instrumento musical e kit de jogos trazem as variantes do livro', () => {
  const por = (n) => tabelaFerramentas().find(f => f.Ferramenta === n);
  assert.match(por('Instrumento Musical').detalhes.variantes, /Alaúde \(35 PO, 1 kg\)/);
  assert.match(por('Kit de Jogos').detalhes.variantes, /Baralho \(5 PP\)/);
});

test('descricoes ja existentes nao foram alteradas (Acido)', () => {
  const acido = lerJson('dados/equipamento/equipamento_aventura.json').itens.find(i => i.nome === 'Ácido');
  assert.match(acido.descricao, /2d6 pontos de dano Ácido/);
});

// --- Task 2: montagem da lista de ferramentas da loja ---
await modulosApp(); // instala os stubs de navegador antes de importar o seletor
const { montarFerramentasLoja } = await import(pathToFileURL(resolve(RAIZ, 'site/js/itens-seletor.js')).href);

test('montarFerramentasLoja: ferramenta comum, variantes expandidas, sem genericas "Varia"', () => {
  const loja = montarFerramentasLoja(tabelaFerramentas());
  const nomes = loja.map(f => f.nome);
  assert.ok(nomes.includes('Ferramentas de Ladrão'));
  assert.ok(nomes.includes('Instrumento Musical (Alaúde)'));
  assert.ok(nomes.includes('Kit de Jogos (Baralho)'));
  assert.ok(!nomes.includes('Instrumento Musical'), 'a generica "Varia" nao entra');
  const alaude = loja.find(f => f.nome === 'Instrumento Musical (Alaúde)');
  assert.equal(alaude.custo, '35 PO');
  assert.equal(alaude.peso, '1 kg');
  const ladrao = loja.find(f => f.nome === 'Ferramentas de Ladrão');
  assert.match(ladrao.descricao, /Usar Objeto/);
  assert.match(ladrao.descricao, /Abrir uma fechadura/);
});
