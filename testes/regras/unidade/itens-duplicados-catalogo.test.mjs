// ============================================================
// Guarda: item mágico tem preferência sobre o comum. Nome exato presente
// no acervo mágico E nos catálogos comuns só pode existir na lista abaixo
// (os registros do livro que as variantes reaproveitam). A lista só encolhe.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAIZ } from './harness.mjs';

/** Lê e interpreta um JSON relativo à raiz do repositório. */
const ler = (rel) => JSON.parse(readFileSync(resolve(RAIZ, rel), 'utf-8'));
/** Normaliza o nome para comparação: sem acento, minúsculo e espaços colapsados. */
const norm =(t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Duplicatas conhecidas e aceitas: o item mágico reaproveita o registro do livro.
const DUPLICATAS_CONHECIDAS = ['Pergaminho Mágico (Truque)', 'Pergaminho Mágico (1º Círculo)', 'Poção de Cura'];

/** Todo objeto com `nome` (texto) dentro de um JSON. */
function registros(obj) {
  if (Array.isArray(obj)) return obj.flatMap(registros);
  if (obj && typeof obj === 'object') {
    return [...(typeof obj.nome === 'string' ? [obj] : []), ...Object.values(obj).flatMap(registros)];
  }
  return [];
}

test('nome exato em itens mágicos e em itens comuns só nas duplicatas conhecidas', () => {
  const comuns = new Set(['equipamento_aventura', 'armas', 'armaduras', 'ferramentas', 'montarias_veiculos']
    .flatMap((a) => registros(ler(`dados/equipamento/${a}.json`)).map((r) => norm(r.nome))));
  const acervo = ler('dados/livro-do-mestre/capitulo7/itens_magicos.json').itens;
  const nomesMagicos = acervo.flatMap((i) => [i.nome, ...(i.variantes || []).map((v) => v.nome)]);
  const duplicados = [...new Set(nomesMagicos.filter((n) => comuns.has(norm(n))))].sort();
  assert.deepEqual(duplicados, [...DUPLICATAS_CONHECIDAS].sort(),
    'item novo repetido entre o catálogo comum e o mágico: remova o comum (preferência do mágico) ou justifique na lista');
});

test('toda duplicata conhecida é uma variante que reaproveita o registro do livro (livro_jogador)', () => {
  const acervo = ler('dados/livro-do-mestre/capitulo7/itens_magicos.json').itens;
  const refs = acervo.flatMap((i) => [i, ...(i.variantes || [])]).filter((x) => x.livro_jogador).map((x) => x.livro_jogador.nome);
  for (const nome of DUPLICATAS_CONHECIDAS) assert.ok(refs.includes(nome), `${nome} não é reaproveitado por livro_jogador`);
});
