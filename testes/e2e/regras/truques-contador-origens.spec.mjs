// ============================================================
// O contador "Truques N / M" da ficha só conta o que sai do orçamento
// da classe.
//
// O motor do critério é testes/regras/unidade/truques-limite-origem.test.mjs.
// Aqui o alvo é a TELA: um critério correto lido pelo render errado
// continua pintando o contador de vermelho, e é o vermelho que o jogador vê.
//
// Os personagens são semeados direto, sem percorrer a aquisição: os
// caminhos de aquisição já têm spec próprio (telecinetico-truque-ficha.spec.mjs
// para o talento, subclasse-escolha.spec.mjs para o Ilusionista). O que se
// afirma aqui é só a CONTAGEM.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

/** Texto do contador de truques ("2 / 2"), ou null se a caixa não existe */
async function contadorTruques(page) {
  const caixa = page.locator('.magia-contador').first();
  if (!await caixa.count()) return null;
  return (await caixa.locator('.contador-valor').innerText()).trim();
}

/** Classes CSS do contador de truques (para detectar 'contador-excedido') */
async function classesContador(page) {
  return (await page.locator('.magia-contador').first().getAttribute('class')) || '';
}

test('ficha: truque do talento Telecinético não conta no limite da classe',
  async ({ context }) => {
    // Bardo nível 4: a tabela dá 3 truques (dados/classes/bardo.json -- são 2
    // até o nível 3), e o nível 4 é o primeiro ASI, ou seja, o mais cedo que
    // o talento pode entrar. Com o orçamento da classe JÁ CHEIO, Mãos Mágicas
    // do talento entra como quarto truque: se ela contasse, o contador iria a
    // "4 / 3" e ficaria vermelho.
    const { page } = await abrirFicha(context, {
      classe: 'Bardo',
      nivel: 4,
      xp: 355000,
      atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Atuação', 'História'],
      talentos: ['Telecinético'],
      magias_conhecidas: [
        { nome: 'Luz', circulo: 0 },
        { nome: 'Prestidigitação', circulo: 0 },
        { nome: 'Mensagem', circulo: 0 },
        { nome: 'Mãos Mágicas', circulo: 0, origem: 'telecinetico' },
      ],
    });

    expect(await contadorTruques(page),
      'o truque do talento foi cobrado do orçamento da classe').toBe('3 / 3');
    expect(await classesContador(page),
      'o contador ficou marcado como excedido').not.toContain('contador-excedido');
  });

test('ficha: truque automático do Ilusionista não conta no limite',
  async ({ context }) => {
    // Mago nível 3: a tabela dá 3 truques. Ilusão Menor vem da subclasse e
    // o livro diz, literal, que ela "não conta para o seu número de truques
    // conhecidos" -- o contador tem de ficar "3 / 3".
    const { page } = await abrirFicha(context, {
      classe: 'Mago',
      nivel: 3,
      xp: 355000,
      subclasse: 'Ilusionista',
      atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Arcanismo', 'História'],
      magias_conhecidas: [
        { nome: 'Luz', circulo: 0 },
        { nome: 'Prestidigitação', circulo: 0 },
        { nome: 'Raio de Gelo', circulo: 0 },
        { nome: 'Ilusão Menor', circulo: 0, origem: 'subclasse_automatica' },
      ],
    });

    expect(await contadorTruques(page),
      'o truque automático da subclasse foi cobrado do orçamento').toBe('3 / 3');
    expect(await classesContador(page),
      'o contador ficou marcado como excedido').not.toContain('contador-excedido');
  });

test('ficha: Mãos Mágicas do Trapaceiro Arcano CONTINUA contando no limite',
  async ({ context }) => {
    // O contrapeso. O livro põe Mãos Mágicas DENTRO dos três truques do
    // Trapaceiro Arcano, então `subclasse_fixa` conta -- se a correção
    // excluir esta origem junto com as outras, o jogador ganha um truque
    // a mais de graça e ninguém percebe.
    const { page } = await abrirFicha(context, {
      classe: 'Ladino',
      nivel: 3,
      xp: 355000,
      subclasse: 'Trapaceiro Arcano',
      atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Furtividade', 'História'],
      magias_conhecidas: [
        { nome: 'Mãos Mágicas', circulo: 0, origem: 'subclasse_fixa' },
        { nome: 'Luz', circulo: 0 },
        { nome: 'Prestidigitação', circulo: 0 },
      ],
    });

    expect(await contadorTruques(page),
      'Mãos Mágicas do Trapaceiro Arcano saiu da conta dos três truques').toBe('3 / 3');
  });
