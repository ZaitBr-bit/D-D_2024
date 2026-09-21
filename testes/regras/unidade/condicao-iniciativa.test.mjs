// ============================================================
// Issue #94, Fase 5 -- Invisível dá Vantagem na Iniciativa (glossário de
// condições, condicoes.js). Mesmo campo booleano que Instintos Primitivos
// (Bárbaro 7+) e Atleta Extraordinário (Guerreiro/Campeão 3+) já usavam.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

await modulosApp();
const sheetCombate = await import('../../../site/js/sheet/combate.js');
const GUERREIRO_1 = [{ classe: 'Guerreiro', nivel: 1 }];

async function iniciativaComCondicoes(condicoes) {
  const { sheetEstado } = await modulosApp();
  const p = await personagemMulticlasse(GUERREIRO_1);
  p.condicoes = condicoes;
  sheetEstado.definirChar(p);
  return sheetCombate.getModIniciativa();
}

test('Invisível dá Vantagem na Iniciativa', async () => {
  const ini = await iniciativaComCondicoes(['Invisível']);
  assert.equal(ini.vantagem, true);
});

test('Contraste: sem Invisível (Guerreiro 1, sem Campeão), Iniciativa não tem Vantagem', async () => {
  const ini = await iniciativaComCondicoes([]);
  assert.equal(ini.vantagem, false);
});

test('Contraste: Amedrontado não dá Vantagem na Iniciativa', async () => {
  const ini = await iniciativaComCondicoes(['Amedrontado']);
  assert.equal(ini.vantagem, false);
});
