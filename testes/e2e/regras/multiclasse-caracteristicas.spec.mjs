// ============================================================
// Caracteristicas de classe num personagem multiclasse.
//
// Defeito que este spec mede: a ficha filtrava as caracteristicas pelo
// nivel TOTAL do personagem, entao um Clerigo 5/Paladino 5 via
// Intervencao Divina -- caracteristica de Clerigo NIVEL 10 -- e nao via
// nenhuma caracteristica de Paladino.
//
// A ultima asercao e negativa e trava a armadilha oposta: converter
// demais. Tracos de especie escalam pelo nivel TOTAL, e continuam assim --
// medido com Maos Curativas (Aasimar), cujo numero de d4s e o Bonus de
// Proficiencia do nivel TOTAL (10 = +4), nao de nenhuma classe isolada
// (Clerigo 5 ou Paladino 5 dariam +3). Escolhido porque o numero aparece
// LITERALMENTE no texto do botao ("Curar (4d4)") -- verificavel na tela
// sem abrir o código, ao contrario de Ataque de Sopro/CD de Mimetismo, que
// exigem espécie Draconato/Kenku e uma escolha de sub-traço adicional.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar } from './helpers-regras.mjs';

test('Clerigo 5/Paladino 5: cada classe filtrada pelo seu proprio nivel', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo',
    subclasse: 'Domínio da Vida',
    nivel: 10,
    xp: 64000,
    especie: 'Aasimar',
    atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Medicina', 'Religião'],
    classes: [
      { classe: 'Clérigo', subclasse: 'Domínio da Vida', nivel: 5, ordem: 0 },
      { classe: 'Paladino', subclasse: 'Juramento da Devoção', nivel: 5, ordem: 1 },
    ],
    schema_versao: 2,
  }, 'regras-multiclasse-caracteristicas');
  await assentar(page).catch(() => {});

  const texto = () => page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
    return document.body.innerText;
  });

  // GUARDA CONTRA VACUIDADE: a secao tem de existir antes de qualquer
  // afirmacao sobre o que ela contem.
  await expect.poll(texto, {
    message: 'a secao de Caracteristicas de Classe precisa aparecer',
  }).toContain('Características de Classe');

  const conteudo = await texto();

  expect(conteudo, 'Intervencao Divina e do Clerigo nivel 10 -- o personagem tem Clerigo 5')
    .not.toContain('Intervenção Divina');
  expect(conteudo, 'as caracteristicas de Paladino tem de aparecer')
    .toContain('Mãos Consagradas');
  expect(conteudo, 'as caracteristicas de Clerigo tem de aparecer')
    .toContain('Canalizar Divindade');

  // Rodada 1 de correcao: `ctx.subclasse` trocado por `char.subclasse` nas
  // funcoes de render passa despercebido pelas quatro asercoes acima --
  // nenhuma delas olha para a secao de Subclasse. `char.subclasse` e o
  // espelho da PRIMEIRA classe (aqui, Clerigo/Dominio da Vida); usa-lo em
  // vez de `ctx.subclasse` faz a secao de Subclasse do Paladino
  // desaparecer INTEIRA -- nem o cabecalho, nem "Arma Sagrada" -- em
  // silencio, sem nenhum teste acusar. Duas classes, duas secoes: as duas
  // sao afirmadas para nao deixar ambiguo qual delas sumiu.
  expect(conteudo, 'a secao de Subclasse do Paladino (cabecalho) tem de aparecer')
    .toContain('Subclasse — Juramento da Devoção');
  expect(conteudo, 'a caracteristica da subclasse do Paladino tem de aparecer')
    .toContain('Arma Sagrada');
  expect(conteudo, 'a secao de Subclasse do Clerigo (cabecalho) tem de aparecer')
    .toContain('Subclasse — Domínio da Vida');
  expect(conteudo, 'a caracteristica da subclasse do Clerigo tem de aparecer')
    .toContain('Discípulo da Vida');

  // ASSERCAO DE ESPECIE (Item 3 da correcao final): Maos Curativas (Aasimar)
  // cura um numero de d4s igual ao Bonus de Proficiencia -- do nivel TOTAL
  // (10 = +4d4), nunca de uma classe isolada (Clerigo 5 ou Paladino 5 dariam
  // +3d4). `renderTracoEspecie` (sheet/caracteristicas.js) calcula
  // `pb = bonusProficiencia(char.nivel)` e escreve o numero LITERAL no botao
  // -- "Curar (4d4)" so aparece se a leitura continuar sendo o espelho
  // char.nivel, e nao `contextosDeClasse()[0]?.nivelClasse`.
  expect(conteudo, 'Maos Curativas tem de curar pelo Bonus de Proficiencia do NIVEL TOTAL (10 = +4d4)')
    .toContain('Curar (4d4)');
  expect(conteudo, 'Maos Curativas NAO pode usar o Bonus de Proficiencia de uma classe isolada (nivel 5 = +3d4) -- ' +
    'travaria a armadilha de converter leitura de especie para nivel de classe')
    .not.toContain('Curar (3d4)');

  expect(erros, 'nenhum erro de console').toEqual([]);
});
