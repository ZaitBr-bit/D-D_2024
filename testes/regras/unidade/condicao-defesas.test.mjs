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

test('efeito mágico com nome, condição e tipo de dano hostis não injeta HTML nas defesas', async () => {
  const { sheetEstado } = await modulosApp();
  const p = await personagemMulticlasse(GUERREIRO_1);
  p.efeitos_magicos = [
    { tipo: 'imunidade_condicao', condicao: 'Enfeitiçado', nome: '<img src=x onerror=alert(1)> (Magia)' },
    { tipo: 'imunidade_condicao', condicao: '<b id="hostil1">', nome: 'Calma' },
    { tipo: 'resistencia', tipos_dano: ['<i id="hostil2">'], nome: 'Proteção' },
  ];
  sheetEstado.definirChar(p);
  const html = sheetCondicoes.renderSecaoDefesas();
  assert.ok(!html.includes('<img src=x'), 'o nome do efeito não pode virar tag');
  assert.ok(!html.includes('<b id="hostil1">') && !html.includes('<i id="hostil2">'), 'condição e tipo de dano são escapados');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'o texto aparece escapado');
});
