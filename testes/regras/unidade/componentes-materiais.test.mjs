// ============================================================
// dados/equipamento/componentes_materiais.json: cobre toda magia com material de custo
// em PO, sem nome repetido e com preço que a loja entende.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAIZ } from './harness.mjs';

const ler = (rel) => JSON.parse(readFileSync(resolve(RAIZ, rel), 'utf-8'));
const itens = ler('dados/equipamento/componentes_materiais.json').itens;
const magias = [...ler('dados/magias/_indice.json').magias, ...ler('dados/tasha/artifice/magias.json').magias, ...ler('dados/arcana-unleashed/magias.json').magias];

test('toda magia com componente de custo em PO aparece em algum material', () => {
  const comCusto = new Set(magias.filter((m) => /M \(.*PO/.test(m.componentes || '')).map((m) => m.nome));
  const cobertas = new Set(itens.flatMap((i) => i.usado_em.map((m) => m.nome)));
  assert.deepEqual([...comCusto].filter((n) => !cobertas.has(n)), [], 'magia com material de custo sem item na loja');
});

test('nomes únicos e custo com valor em PO', () => {
  const nomes = itens.map((i) => i.nome);
  assert.equal(new Set(nomes).size, nomes.length, 'nome repetido mistura itens de custos diferentes no inventário');
  for (const i of itens) assert.match(i.custo, /^[\d.]+ PO$/, `${i.nome}: custo "${i.custo}"`);
});

test('consumido reflete as magias e o Diamante tem um item por custo', () => {
  const rev = itens.find((i) => i.nome === 'Diamante (300 PO)');
  assert.ok(rev && rev.consumido && rev.usado_em.some((m) => m.nome === 'Revivificar' && m.consome));
  const orbe = itens.find((i) => i.nome === 'Diamante (50 PO)');
  assert.ok(orbe && !orbe.consumido, 'o Orbe Cromático não consome o diamante');
  assert.ok(itens.filter((i) => i.nome.startsWith('Diamante (')).length >= 5);
});
