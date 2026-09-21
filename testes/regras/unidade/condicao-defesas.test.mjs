// ============================================================
// Issue #94, Fase 3 -- Petrificado dá Resistência a todo dano e Imunidade
// a Envenenado (glossário de condições, condicoes.js). Mesmo padrão de
// "resistência temporária por flag ativa" que a Fúria (Bárbaro) já usava
// em renderSecaoDefesas -- ver resistenciasFuriaAtivas no próprio arquivo.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

await modulosApp();
const sheetCondicoes = await import('../../../site/js/sheet/condicoes.js');
const GUERREIRO_1 = [{ classe: 'Guerreiro', nivel: 1 }];

async function defesasComCondicoes(condicoes) {
  const { sheetEstado } = await modulosApp();
  const p = await personagemMulticlasse(GUERREIRO_1);
  p.condicoes = condicoes;
  sheetEstado.definirChar(p);
  return sheetCondicoes.renderSecaoDefesas();
}

test('Petrificado dá Resistência aos 13 tipos de dano', async () => {
  const html = await defesasComCondicoes(['Petrificado']);
  for (const tipo of ['Ácido', 'Contundente', 'Cortante', 'Elétrico', 'Energético',
    'Gélido', 'Ígneo', 'Necrótico', 'Perfurante', 'Psíquico', 'Radiante', 'Trovejante', 'Venenoso']) {
    assert.ok(html.includes(tipo), `Petrificado tem de dar resistência a "${tipo}"`);
  }
  assert.ok(html.includes('(Petrificado)'), 'a origem da resistência temporária tem de aparecer marcada');
});

test('Petrificado dá Imunidade a Envenenado', async () => {
  const html = await defesasComCondicoes(['Petrificado']);
  assert.match(html, /Envenenado \(Petrificado\)/);
});

test('Contraste: sem Petrificado, nenhuma resistência/imunidade temporária aparece', async () => {
  const html = await defesasComCondicoes([]);
  assert.ok(html.includes('Nenhuma defesa configurada'));
});

test('Contraste: Paralisado (não dá defesa nenhuma) não aciona a resistência de Petrificado', async () => {
  const html = await defesasComCondicoes(['Paralisado']);
  assert.ok(html.includes('Nenhuma defesa configurada'),
    'Paralisado não é Petrificado -- não pode dar resistência a dano nenhuma');
});
