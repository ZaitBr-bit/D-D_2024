// ============================================================
// Feras do Manual dos Monstros (2026, Apêndice A) em dados/monstros: integridade
// dos dados, tradução completa e encaixe nas regras da Forma Selvagem e do
// Convocar Familiar.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RAIZ } from './harness.mjs';

const ler = (rel) => JSON.parse(readFileSync(resolve(RAIZ, rel), 'utf-8'));
const novas = ler('dados/monstros/criaturas.json').criaturas;
const livro = ler('dados/apendices/criaturas.json').criaturas;
const fontes = ler('dados/fontes.json').fontes;
const FS = await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-forma-selvagem.js')).href);
const FAM = await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-familiar.js')).href);

const ESPERADAS = [
  'Urso das Cavernas', 'Urso Atroz', 'Rato Atroz', 'Formiga-Soldado Gigante', 'Percevejo-Assassino Gigante',
  'Sanguessuga Gigante', 'Mosca-Ladra Gigante', 'Besouro-Tigre Gigante', 'Sapo-Boi Gigante', 'Cecília Gigante',
  'Louva-a-Deus Gigante', 'Lesma Gigante', 'Naja-Cuspideira Gigante', 'Tarântula Gigante', 'Verme-Veludo Gigante',
  'Carcaju Gigante', 'Hatori', 'Polvo Monstruoso', 'Centopeia Monstruosa', 'Escorpião Monstruoso',
  'Aranha Monstruosa', 'Tarântula Monstruosa', 'Aranha-Espada',
];

test('as 23 Feras compatíveis com a Forma Selvagem estão em dados/monstros, sem repetir o apêndice', () => {
  assert.equal(novas.length, 23);
  assert.deepEqual(novas.map((c) => c.nome).sort(), [...ESPERADAS].sort());
  const nomesLivro = new Set(livro.map((c) => c.nome));
  for (const c of novas) assert.ok(!nomesLivro.has(c.nome), `${c.nome} já existe no apêndice do Livro do Jogador`);
  assert.equal(new Set(novas.map((c) => c.nome_en)).size, 23, 'nome em inglês único');
});

test('a fonte "monstros" está registrada e todas as criaturas a carregam', () => {
  assert.ok(fontes.some((f) => f.id === 'monstros' && f.sigla), 'dados/fontes.json declara a fonte');
  for (const c of novas) assert.equal(c.fonte, 'monstros', c.nome);
});

test('cada criatura tem bloco completo, em português, com medidas em metros', () => {
  for (const c of novas) {
    assert.match(c.tipo_tamanho, /^Fera (Pequena|Média|Grande|Enorme), Sem Alinhamento$/, c.nome);
    assert.match(c.pv, /^\d+ \(\d+d\d+ \+ \d+\)$/, `${c.nome}: PV`);
    assert.match(c.nd, /^(0|1\/4|1\/2|\d+) \(XP [\d.]+; BP \+\d\)$/, `${c.nome}: ND`);
    assert.deepEqual(Object.keys(c.atributos), ['For', 'Des', 'Con', 'Int', 'Sab', 'Car'], c.nome);
    assert.ok(c.acoes.length >= 1, `${c.nome}: tem ao menos uma ação`);
    assert.ok([...c.tracos, ...c.acoes, ...c.acoes_bonus, ...c.reacoes].every((x) => x.nome && x.descricao), `${c.nome}: entradas completas`);
    assert.ok(c.texto_completo.startsWith(`## ${c.nome}\n`), `${c.nome}: texto completo`);
    assert.match(c.texto_completo, /### Ações/, c.nome);
    const todo = `${c.deslocamento} ${c.sentidos} ${c.texto_completo}`;
    assert.ok(!/\b(ft|feet|foot)\b/.test(todo), `${c.nome}: medida em pés sobrou`);
    assert.ok(!/(Melee|Ranged|Hit:|Saving Throw|Recharge|Bonus Action|Multiattack|Piercing|Slashing|Bludgeoning)/.test(todo), `${c.nome}: texto em inglês sobrou`);
    assert.match(c.deslocamento, /\d+(,\d+)? m/, c.nome);
  }
});

test('todas as Feras novas têm ND de 1/4 a 6 e só duas voam', () => {
  const nds = novas.map((c) => FS.ndNumero(c.nd));
  assert.ok(Math.min(...nds) >= 0.25 && Math.max(...nds) <= 6);
  assert.deepEqual(novas.filter(FS.temVoo).map((c) => c.nome).sort(), ['Louva-a-Deus Gigante', 'Mosca-Ladra Gigante']);
});

test('encaixe na Forma Selvagem: ND e voo por nível, e o Círculo da Lua', () => {
  const todas = [...livro, ...novas];
  const nomes = (nivel, sub = '') => FS.formasElegiveis(todas, nivel, sub).map((c) => c.nome);
  assert.ok(nomes(2).includes('Rato Atroz') && nomes(2).includes('Formiga-Soldado Gigante'), 'nível 2: ND 1/4');
  assert.ok(!nomes(2).includes('Percevejo-Assassino Gigante'), 'ND 1/2 só no nível 4');
  assert.ok(nomes(4).includes('Percevejo-Assassino Gigante'));
  assert.ok(!nomes(4).includes('Sanguessuga Gigante'), 'ND 1 só no nível 8');
  for (const n of ['Sanguessuga Gigante', 'Besouro-Tigre Gigante', 'Mosca-Ladra Gigante']) assert.ok(nomes(8).includes(n), `${n} no nível 8`);
  assert.ok(!nomes(7).includes('Mosca-Ladra Gigante'), 'voo só a partir do nível 8');
  assert.ok(!nomes(20).includes('Hatori'), 'ND 6 passa do teto do druida comum');
  const lua = nomes(18, FS.SUBCLASSE_LUA);
  for (const n of ['Hatori', 'Escorpião Monstruoso', 'Tarântula Monstruosa', 'Aranha-Espada', 'Urso Atroz']) assert.ok(lua.includes(n), `${n} no Círculo da Lua nível 18`);
  assert.equal(FS.limitesFormas(18, FS.SUBCLASSE_LUA).nd, 6);
});

test('Convocar Familiar: nenhuma Fera nova é ND 0, então nenhuma entra como familiar', () => {
  const nomesComuns = FAM.formasComuns([...livro, ...novas]).map((c) => c.nome);
  for (const c of novas) assert.ok(!nomesComuns.includes(c.nome), `${c.nome} não pode ser familiar (ND ${c.nd})`);
});
