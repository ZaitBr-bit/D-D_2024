// ============================================================
// Issue #94, Fase 1 -- Deslocamento zerado por condição.
//
// Contido, Imobilizado, Paralisado, Petrificado e Inconsciente zeram o
// Deslocamento (glossário de condições, CONDICOES_DESCRICAO em
// condicoes.js). A checagem em getDeslocamentoFinal (combate.js) fica
// DEPOIS dos bônus de valor base e ANTES das velocidades derivadas
// (Voo/Escalada/Natação), para que nenhum bônus de classe/talento escape
// e para que as velocidades extras também zerem junto.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

await modulosApp();
const sheetCombate = await import('../../../site/js/sheet/combate.js');
const GUERREIRO_1 = [{ classe: 'Guerreiro', nivel: 1 }];

async function deslocamentoComCondicoes(condicoes, ajustar) {
  const { sheetEstado } = await modulosApp();
  const p = await personagemMulticlasse(GUERREIRO_1);
  p.condicoes = condicoes;
  if (ajustar) ajustar(p);
  sheetEstado.definirChar(p);
  return sheetCombate.getDeslocamentoFinal('9 metros');
}

for (const condicao of ['Contido', 'Imobilizado', 'Paralisado', 'Petrificado', 'Inconsciente']) {
  test(`${condicao} zera o Deslocamento (Guerreiro 1, base 9m)`, async () => {
    assert.equal(await deslocamentoComCondicoes([condicao]), '0 metros',
      `${condicao} tem de travar o Deslocamento em 0`);
  });
}

test('Contraste: sem nenhuma condição, o Deslocamento fica no valor base', async () => {
  assert.equal(await deslocamentoComCondicoes([]), '9 metros');
});

test('Contraste: Amedrontado (não zera Deslocamento) mantém o valor base', async () => {
  assert.equal(await deslocamentoComCondicoes(['Amedrontado']), '9 metros',
    'Amedrontado não está na lista do livro que zera Deslocamento');
});

test('Petrificado zera também a velocidade de Voo derivada (Aasimar, Asas Celestiais ativas)', async () => {
  const resultado = await deslocamentoComCondicoes(['Petrificado'], (p) => {
    p.especie = 'Aasimar';
    p.recursos = { ...(p.recursos || {}), aasimar_revelacao_ativa: 'asas' };
  });
  assert.equal(resultado, '0 metros (Voo 0m)',
    'a Fase 2 (velocidades derivadas) usa `final` já zerado pela condição -- Voo também tem de zerar');
});

test('Contraste: sem Petrificado, Asas Celestiais dão Voo igual ao Deslocamento (9m)', async () => {
  const resultado = await deslocamentoComCondicoes([], (p) => {
    p.especie = 'Aasimar';
    p.recursos = { ...(p.recursos || {}), aasimar_revelacao_ativa: 'asas' };
  });
  assert.equal(resultado, '9 metros (Voo 9m)');
});
