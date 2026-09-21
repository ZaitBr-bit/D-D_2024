// ============================================================
// Issue #94, Fase 6 -- Desvantagem em jogadas de ataque do próprio
// personagem, por condição (glossário de condições, condicoes.js):
// Amedrontado, Envenenado, Caído, Contido, Imobilizado, Cego.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

await modulosApp();
const sheetCombate = await import('../../../site/js/sheet/combate.js');
const GUERREIRO_1 = [{ classe: 'Guerreiro', nivel: 1 }];

async function ataqueComCondicoes(condicoes) {
  const { sheetEstado } = await modulosApp();
  const p = await personagemMulticlasse(GUERREIRO_1);
  p.condicoes = condicoes;
  sheetEstado.definirChar(p);
  return sheetCombate.calcVantagemDesvantagemAtaque();
}

for (const condicao of ['Amedrontado', 'Envenenado', 'Caído', 'Contido', 'Imobilizado', 'Cego']) {
  test(`${condicao} dá Desvantagem no ataque do próprio personagem`, async () => {
    const vd = await ataqueComCondicoes([condicao]);
    assert.deepEqual(vd.desvantagens, [condicao]);
    assert.deepEqual(vd.vantagens, []);
  });
}

test('Contraste: sem nenhuma condição, ataque não tem Desvantagem', async () => {
  const vd = await ataqueComCondicoes([]);
  assert.deepEqual(vd.desvantagens, []);
});

test('Contraste: Petrificado (não dá desvantagem de ataque, é Incapacitado -- não ataca) não aparece aqui', async () => {
  const vd = await ataqueComCondicoes(['Petrificado']);
  assert.deepEqual(vd.desvantagens, []);
});

test('Duas condições de Desvantagem simultâneas listam as duas fontes', async () => {
  const vd = await ataqueComCondicoes(['Amedrontado', 'Cego']);
  assert.deepEqual(vd.desvantagens, ['Amedrontado', 'Cego']);
});
