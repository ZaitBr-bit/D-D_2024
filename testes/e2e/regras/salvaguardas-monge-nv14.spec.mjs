// ============================================================
// Monge de nível 14 é proficiente em TODAS as salvaguardas.
//
// "Sua disciplina física e mental lhe concede proficiência em todas as
// salvaguardas." (Sobrevivente Disciplinado, Classes.md:5266)
//
// Issue #21. A característica nunca foi implementada: ficha.js:480 imprime
// a frase do livro na caixa de recursos do Monge, e ficha.js:735 -- a linha
// que de fato marca cada salvaguarda -- lia só o array gravado no
// personagem, onde nada escreve por causa do nível 14. A ficha exibia a
// regra certa e não a executava.
//
// A asserção é sobre o DELTA entre 13 e 14, não sobre o número absoluto: a
// dupla base da classe (Força e Destreza, dados-classes.js:136) é semeada à
// mão nos dois personagens justamente para que a única diferença entre eles
// seja o nível.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

// Base do Monge, semeada à mão para o teste não depender do wizard.
const BASE_MONGE = ['Força', 'Destreza'];

/** Semente de Monge no nível pedido, mudando só o nível */
function monge(nivel) {
  return {
    classe: 'Monge',
    nivel,
    xp: 355000,
    subclasse: 'Combatente da Mão Espalmada',
    atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Acrobacia', 'História'],
    salvaguardas_proficientes: BASE_MONGE,
  };
}

/** A linha de salvaguarda cujo nome é exatamente `nome` */
function salvaguarda(page, nome) {
  return page.locator('.salva-item')
    .filter({ has: page.locator('.pericia-nome', { hasText: new RegExp(`^${nome}$`) }) });
}

test('ficha: Monge nv14 é proficiente nas seis salvaguardas', async ({ context }) => {
  const { page } = await abrirFicha(context, monge(14));

  await expect(page.locator('.salva-item.proficiente'),
    'Sobrevivente Disciplinado não marcou as seis salvaguardas').toHaveCount(6);

  // Constituição é a prova do delta: não está na base do Monge, então só
  // pode ter vindo da característica de nível 14.
  // CON 14 (+2) + proficiência de nível 14 (+5) = +7.
  await expect(salvaguarda(page, 'Constituição').locator('.pericia-bonus'),
    'o bônus não somou o de proficiência').toHaveText('+7');
});

test('ficha: Monge nv13 ainda tem só as duas salvaguardas da classe',
  async ({ context }) => {
    // O contrapeso do nível. Sem ele, uma correção que desse as seis a
    // qualquer Monge passaria no teste acima e ninguém notaria.
    const { page } = await abrirFicha(context, monge(13));

    await expect(page.locator('.salva-item.proficiente'),
      'Monge nv13 ganhou salvaguarda que o livro só dá no 14').toHaveCount(2);
    // CON 14 (+2), sem proficiência.
    await expect(salvaguarda(page, 'Constituição').locator('.pericia-bonus'))
      .toHaveText('+2');
  });

test('ficha: outra classe no nível 14 não ganha as seis', async ({ context }) => {
  // O contrapeso da classe. A característica é do Monge; se a correção
  // olhasse só o nível, todo personagem de nível 14 viraria proficiente
  // em tudo.
  const { page } = await abrirFicha(context, {
    classe: 'Guerreiro',
    nivel: 14,
    xp: 355000,
    subclasse: 'Campeão',
    atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Atletismo', 'História'],
    salvaguardas_proficientes: ['Força', 'Constituição'],
  });

  await expect(page.locator('.salva-item.proficiente'),
    'Guerreiro nv14 ganhou proficiência que é do Monge').toHaveCount(2);
});
