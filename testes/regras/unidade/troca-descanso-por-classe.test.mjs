// ============================================================
// Oraculos de trocasDoDescansoLongo (Tarefa 1 do sub-projeto
// 2026-08-29-troca-por-classe-descanso) -- a peca pura "quais trocas de
// magia e de truque este personagem tem DIREITO a fazer ao terminar um
// Descanso Longo?", uma entrada por SUPERFICIE DE CONJURACAO.
//
// O defeito que a funcao conserta: hp-descanso.js:1447 decide a troca com
// trocaNoDescansoLongo(char.classe) -- o ESPELHO da classe INICIAL, que nao
// muda quando o personagem multiclassa. Um Clerigo 5/Druida 5 tem direito a
// DUAS trocas e o codigo hoje so oferece uma, da classe que veio primeiro.
//
// Todos os oraculos rodam sobre `superficiesDeConjuracao` REAL (nao um
// objeto de superficie inventado a mao), para o teste tambem provar que as
// duas funcoes se encaixam -- e nao so que trocasDoDescansoLongo se
// comporta bem sobre uma entrada fabricada que ninguem confirma existir.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

// ORACULO 1 -- classe unica devolve exatamente UMA entrada, com a classe
// certa. E o oraculo da nao-regressao da maioria: todo personagem hoje na
// ficha e de classe unica.
test('ORACULO 1 -- classe unica (Clerigo 5) devolve exatamente uma entrada', async () => {
  const { regrasPreparoMagias: rpm, multiclasseConjuracao: mc } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }]);
  const sup = mc.superficiesDeConjuracao(p);
  const trocas = rpm.trocasDoDescansoLongo(p, sup);
  assert.equal(trocas.length, 1,
    'Clerigo 5 puro tem UMA superficie de conjuracao -- deveria ter UMA entrada de troca');
  assert.equal(trocas[0].classe, 'Clérigo');
  assert.equal(trocas[0].podeTrocarMagia, true);
  assert.equal(trocas[0].podeTrocarTruque, true);
});

// ORACULO 2 -- o defeito do sub-projeto: Clerigo 5/Druida 5 tem direito a
// DUAS trocas, uma por classe. Se alguem ler o espelho char.classe (a
// classe INICIAL) em vez de percorrer as superficies recebidas, vem uma so.
test('ORACULO 2 -- Clerigo 5/Druida 5 devolve DUAS entradas, uma por classe', async () => {
  const { regrasPreparoMagias: rpm, multiclasseConjuracao: mc } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 },
    { classe: 'Druida', nivel: 5 },
  ]);
  const sup = mc.superficiesDeConjuracao(p);
  assert.equal(sup.length, 2, 'fixture: Clerigo e Druida sao as duas classes conjuradoras plenas');
  const trocas = rpm.trocasDoDescansoLongo(p, sup);
  assert.equal(trocas.length, 2,
    'Clerigo 5/Druida 5 tem DUAS classes conjuradoras -- devem existir DUAS entradas de troca, ' +
    'uma por classe. Se vier uma so, a funcao nao esta percorrendo todas as superficies recebidas');
  assert.deepEqual(trocas.map((t) => t.classe), ['Clérigo', 'Druida']);
  assert.ok(trocas.every((t) => t.podeTrocarMagia && t.podeTrocarTruque),
    'as duas classes sao conjuradoras plenas -- as duas tem direito a trocar magia e truque');
});

// ORACULO 3 -- a ordem das entradas segue `ordem` (classe inicial
// primeiro), nao a ordem alfabetica (Druida < Mago) nem a de insercao do
// objeto de superficie.
test('ORACULO 3 -- a ordem das entradas segue `ordem`, nao a ordem alfabetica', async () => {
  const { regrasPreparoMagias: rpm, multiclasseConjuracao: mc } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Mago', nivel: 5 },
    { classe: 'Druida', nivel: 5 },
  ]);
  const sup = mc.superficiesDeConjuracao(p);
  const trocas = rpm.trocasDoDescansoLongo(p, sup);
  assert.deepEqual(trocas.map((t) => t.classe), ['Mago', 'Druida'],
    'Mago veio primeiro no roteiro (ordem 0) -- a ordem alfabetica colocaria Druida primeiro; ' +
    'a resposta tem de seguir `ordem`, nao o alfabeto');
});

// ORACULO 4 -- rotuloMagia acompanha o `tipo` da superficie: um Bardo
// (conhecidas) e um Clerigo (preparadas) no mesmo personagem devolvem
// rotulos diferentes. E o que impede os dois modais (Tarefa 2) de dizerem a
// mesma coisa para classes que preparam e classes que sabem magias.
test('ORACULO 4 -- rotuloMagia acompanha o tipo: Bardo (conhecida) x Clerigo (preparada)', async () => {
  const { regrasPreparoMagias: rpm, multiclasseConjuracao: mc } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Bardo', nivel: 5 },
    { classe: 'Clérigo', nivel: 5 },
  ]);
  const sup = mc.superficiesDeConjuracao(p);
  const trocas = rpm.trocasDoDescansoLongo(p, sup);
  const bardo = trocas.find((t) => t.classe === 'Bardo');
  const clerigo = trocas.find((t) => t.classe === 'Clérigo');
  assert.equal(bardo.tipo, 'conhecidas', 'fixture: Bardo tem magias conhecidas, nao preparadas');
  assert.equal(clerigo.tipo, 'preparadas', 'fixture: Clerigo tem magias preparadas, nao conhecidas');
  assert.equal(bardo.rotuloMagia, 'conhecida',
    'Bardo tem magias CONHECIDAS -- o rotulo tem que dizer "conhecida", nao "preparada"');
  assert.equal(clerigo.rotuloMagia, 'preparada',
    'Clerigo tem magias PREPARADAS -- o rotulo tem que dizer "preparada", nao "conhecida"');
});

// ORACULO 5 -- uma classe que nao conjura nao gera entrada: Barbaro 5/Mago 1
// devolve uma entrada so, do Mago.
test('ORACULO 5 -- classe que nao conjura nao gera entrada: Barbaro 5/Mago 1', async () => {
  const { regrasPreparoMagias: rpm, multiclasseConjuracao: mc } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Bárbaro', nivel: 5 },
    { classe: 'Mago', nivel: 1 },
  ]);
  const sup = mc.superficiesDeConjuracao(p);
  const trocas = rpm.trocasDoDescansoLongo(p, sup);
  assert.equal(trocas.length, 1,
    'Barbaro nao conjura -- so o Mago deveria gerar entrada de troca');
  assert.equal(trocas[0].classe, 'Mago');
});

// ORACULO 6 -- subclasse conjuradora gera entrada mesmo com
// trocaNoDescansoLongo devolvendo null para a classe: um Ladino (Trapaceiro
// Arcano) de nivel suficiente tem direito a troca. O nivel em que a
// subclasse passa a conjurar e o 3, MEDIDO em
// regras-conjuracao-subclasse.js (getConjuracaoSubclasse: "if (nivelAtual <
// 3) return null"), nao chutado.
test('ORACULO 6 -- subclasse conjuradora (Trapaceiro Arcano) tem direito mesmo sem a classe conjurar', async () => {
  const { regrasPreparoMagias: rpm, multiclasseConjuracao: mc } = await modulosApp();
  assert.equal(rpm.trocaNoDescansoLongo('Ladino'), null,
    'fixture: Ladino puro nao e classe conjuradora -- se isto mudar, o oraculo perde o sentido');
  const p = await personagemMulticlasse([
    { classe: 'Ladino', nivel: 3, subclasse: 'Trapaceiro Arcano' },
  ]);
  const sup = mc.superficiesDeConjuracao(p);
  assert.equal(sup.length, 1, 'fixture: Trapaceiro Arcano nivel 3 ja e superficie de conjuracao');
  const trocas = rpm.trocasDoDescansoLongo(p, sup);
  assert.equal(trocas.length, 1,
    'Trapaceiro Arcano nivel 3 ja conjura pela tabela da subclasse -- tem de gerar UMA entrada');
  assert.equal(trocas[0].classe, 'Ladino');
  assert.equal(trocas[0].subclasse, 'Trapaceiro Arcano');
  assert.equal(trocas[0].podeTrocarMagia, true,
    'a classe Ladino nao conjura (trocaNoDescansoLongo devolve null), mas a SUBCLASSE conjura -- ' +
    'o direito tem que vir dela, nao da classe');
  assert.equal(trocas[0].podeTrocarTruque, true,
    'mesma elegibilidade da troca de magia: toda classe/subclasse conjuradora troca truque tambem');
});

// ORACULO 7 -- entradas degeneradas: `superficies` null, undefined,
// nao-array, e personagem vazio -- tudo devolve array vazio, sem lancar.
test('ORACULO 7 -- superficies null/undefined/nao-array devolve array vazio, sem lancar', async () => {
  const { regrasPreparoMagias: rpm } = await modulosApp();
  assert.deepEqual(rpm.trocasDoDescansoLongo({}, null), []);
  assert.deepEqual(rpm.trocasDoDescansoLongo({}, undefined), []);
  assert.deepEqual(rpm.trocasDoDescansoLongo({}, 'nao e array'), []);
  assert.deepEqual(rpm.trocasDoDescansoLongo(null, []), [],
    'personagem null com superficies vazio ainda tem que devolver array vazio, sem lancar');
});

test('ORACULO 7b -- personagem sem nenhuma superficie de conjuracao (Barbaro 5 puro) devolve array vazio', async () => {
  const { regrasPreparoMagias: rpm, multiclasseConjuracao: mc } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 5 }]);
  const sup = mc.superficiesDeConjuracao(p);
  assert.deepEqual(sup, [], 'fixture: Barbaro puro nao tem superficie nenhuma');
  assert.deepEqual(rpm.trocasDoDescansoLongo(p, sup), []);
});
