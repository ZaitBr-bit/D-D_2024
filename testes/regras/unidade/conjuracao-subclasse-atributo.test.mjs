// ============================================================
// CD e ataque de magia de quem conjura pela SUBCLASSE.
//
// Cavaleiro Místico (Guerreiro) e Trapaceiro Arcano (Ladino) conjuram por
// tabela própria, e o livro dá o atributo com a mesma frase nas duas
// ("Atributo de Conjuração. Inteligência é seu atributo de conjuração para
// suas magias de Mago." -- Classes.md:3968 e :4473).
//
// CLASSES_INFO não tem `atributo_conjuracao` para Guerreiro nem Ladino --
// são classes não-conjuradoras --, então calcCDMagia devolvia 0 para eles.
// Este motor cobra que a conta saia certa ANTES de a ficha passar a exibir
// a caixa (Tarefa 3): exibir "CD Magia 0" seria pior que não exibir.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { utils, regrasConjuracaoSubclasse } = await modulosApp();

// Int 16 (+3) no nível 3 (bônus de proficiência +2): CD 8+2+3 = 13, ataque +5.
function personagem(classe, subclasse, nivel = 3) {
  return {
    classe, subclasse, nivel,
    atributos: { forca: 10, destreza: 14, constituicao: 12,
                 inteligencia: 16, sabedoria: 10, carisma: 10 },
  };
}

const SUBCLASSES = [
  { classe: 'Guerreiro', subclasse: 'Cavaleiro Místico', livro: 'Classes.md:3968' },
  { classe: 'Ladino',    subclasse: 'Trapaceiro Arcano', livro: 'Classes.md:4473' },
];

for (const s of SUBCLASSES) {
  test(`${s.subclasse}: atributo de conjuração é Inteligência (${s.livro})`, () => {
    assert.equal(
      regrasConjuracaoSubclasse.getAtributoConjuracaoSubclasse(s.classe, s.subclasse),
      'Inteligência');
  });

  test(`${s.subclasse} nv3: CD de magia usa Inteligência`, () => {
    assert.equal(utils.calcCDMagia(personagem(s.classe, s.subclasse)), 13,
      '8 + proficiência 2 + mod. Inteligência 3');
  });

  test(`${s.subclasse} nv3: ataque de magia usa Inteligência`, () => {
    assert.equal(utils.calcAtaqueMagia(personagem(s.classe, s.subclasse)), 5,
      'proficiência 2 + mod. Inteligência 3');
  });

  test(`${s.subclasse} nv2 ainda não conjura: CD continua 0`, () => {
    // A conjuração da subclasse começa no nível 3 (getConjuracaoSubclasse
    // devolve null abaixo disso). Antes disso não há CD nenhuma a mostrar.
    assert.equal(utils.calcCDMagia(personagem(s.classe, s.subclasse, 2)), 0);
    assert.equal(utils.calcAtaqueMagia(personagem(s.classe, s.subclasse, 2)), 0);
  });
}

test('subclasse não conjuradora da mesma classe continua sem CD', () => {
  // O contrapeso: se a correção olhasse só a classe, todo Guerreiro
  // passaria a ter CD de magia.
  assert.equal(utils.calcCDMagia(personagem('Guerreiro', 'Campeão')), 0);
  assert.equal(utils.calcAtaqueMagia(personagem('Ladino', 'Ladrão')), 0);
});

test('classe conjuradora não é afetada pela mudança', () => {
  // Mago nível 3, Inteligência 16: CD 13, ataque +5 -- pelo caminho de
  // sempre (CLASSES_INFO.atributo_conjuracao), não pelo ramo novo.
  const mago = personagem('Mago', 'Ilusionista');
  assert.equal(utils.calcCDMagia(mago), 13);
  assert.equal(utils.calcAtaqueMagia(mago), 5);
});

test('cruzamento inválido de classe e subclasse não conjura', () => {
  // Trapaceiro Arcano é subclasse de Ladino; num Guerreiro não vale nada.
  assert.equal(
    regrasConjuracaoSubclasse.getAtributoConjuracaoSubclasse('Guerreiro', 'Trapaceiro Arcano'),
    null);
});
