// ============================================================
// Issues #105 e #61: classe dona de TRUQUES e de magias CONCEDIDAS.
// Oráculos das funções puras de site/js/regras-magia-classe.js:
// classeDoTruque, classeDaMagiaConcedida, classesCandidatas.
//
// Nomes de magia medidos em dados/classes/magias_mago.json e
// magias_clerigo.json (2026-09-22): truques nas DUAS listas = Badalar
// Fúnebre, Luz, Reparar; "Raio de Fogo" só no Mago; "Chama Sagrada" só no
// Clérigo.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

/** Monta o Map<nomeLista, Set<nome>> a partir dos JSON reais do disco. */
async function listasReais(nomes) {
  const { db, magiaClasse } = await modulosApp();
  const mapa = new Map();
  for (const nome of nomes) {
    mapa.set(nome, magiaClasse.nomesDaListaDeMagias(await db.getMagiasClasse(nome)));
  }
  return mapa;
}

test('classeDoTruque: classe única devolve a classe sem consultar lista (R-B)', async () => {
  const { magiaClasse } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 3 }]);
  assert.equal(magiaClasse.classeDoTruque(p, { nome: 'Luz', circulo: 0 }), 'Mago');
});

test('classeDoTruque: Mago/Clérigo carimba só o que está numa lista só', async () => {
  const { magiaClasse } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 3 }, { classe: 'Clérigo', nivel: 3 }]);
  const listasPorClasse = await listasReais(['Mago', 'Clérigo']);
  assert.equal(magiaClasse.classeDoTruque(p, { nome: 'Raio de Fogo', circulo: 0 }, { listasPorClasse }), 'Mago');
  assert.equal(magiaClasse.classeDoTruque(p, { nome: 'Chama Sagrada', circulo: 0 }, { listasPorClasse }), 'Clérigo');
  assert.equal(magiaClasse.classeDoTruque(p, { nome: 'Luz', circulo: 0 }, { listasPorClasse }), null,
    'Luz está nas duas listas -- sem chute');
  assert.equal(magiaClasse.classeDoTruque(p, { nome: 'Luz', circulo: 0 }), null,
    'sem listas, multiclasse não decide');
});

test('classeDoTruque: origem que não conta no limite e círculo 1+ ficam sem classe', async () => {
  const { magiaClasse } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 3 }]);
  assert.equal(magiaClasse.classeDoTruque(p, { nome: 'Luz', circulo: 0, origem: 'especie' }), null);
  assert.equal(magiaClasse.classeDoTruque(p, { nome: 'Luz', circulo: 0, origem: 'iniciado_em_magia' }), null);
  assert.equal(magiaClasse.classeDoTruque(p, { nome: 'Escudo Arcano', circulo: 1 }), null);
  assert.equal(magiaClasse.classeDoTruque(p, { nome: '', circulo: 0 }), null);
});

test('classeDaMagiaConcedida: domínio casa com a classe cuja concessão contém o nome', async () => {
  const { magiaClasse } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Mago', nivel: 3 }, { classe: 'Clérigo', subclasse: 'Domínio da Vida', nivel: 3 },
  ]);
  const concessoes = new Map([['Mago', new Set()], ['Clérigo', new Set(['Bênção', 'Curar Ferimentos'])]]);
  assert.equal(magiaClasse.classeDaMagiaConcedida(p, { nome: 'Bênção', circulo: 1, origem: 'dominio' }, concessoes), 'Clérigo');
  assert.equal(magiaClasse.classeDaMagiaConcedida(p, { nome: 'Bênção', circulo: 1, origem: 'dominio' }, null), null,
    'sem mapa de concessões não decide');
  const ambas = new Map([['Mago', new Set(['Bênção'])], ['Clérigo', new Set(['Bênção'])]]);
  assert.equal(magiaClasse.classeDaMagiaConcedida(p, { nome: 'Bênção', circulo: 1, origem: 'sempre' }, ambas), null,
    'concedida por duas classes -- sem chute');
});

test('classeDaMagiaConcedida: talento nunca tem classe; Maestria/Assinatura só do Mago', async () => {
  const { magiaClasse } = await modulosApp();
  const comMago = await personagemMulticlasse([{ classe: 'Mago', nivel: 18 }, { classe: 'Clérigo', nivel: 1 }]);
  const semMago = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 3 }]);
  const concessoes = new Map([['Mago', new Set(['Enfeitiçar Pessoa'])]]);
  assert.equal(magiaClasse.classeDaMagiaConcedida(comMago, { nome: 'Enfeitiçar Pessoa', circulo: 1, origem: 'iniciado_em_magia' }, concessoes), null);
  assert.equal(magiaClasse.classeDaMagiaConcedida(comMago, { nome: 'Escudo Arcano', circulo: 1, origem: 'maestria_magias' }, null), 'Mago');
  assert.equal(magiaClasse.classeDaMagiaConcedida(semMago, { nome: 'Escudo Arcano', circulo: 1, origem: 'maestria_magias' }, null), null);
});

test('classesCandidatas: interseção das listas; nenhuma lista casa = todas as classes conjuradoras', async () => {
  const { magiaClasse } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 3 }, { classe: 'Clérigo', nivel: 3 }]);
  const listasPorClasse = await listasReais(['Mago', 'Clérigo']);
  assert.deepEqual(magiaClasse.classesCandidatas(p, 'Luz', listasPorClasse), ['Mago', 'Clérigo']);
  assert.deepEqual(magiaClasse.classesCandidatas(p, 'Raio de Fogo', listasPorClasse), ['Mago']);
  assert.deepEqual(magiaClasse.classesCandidatas(p, 'Magia Que Não Existe', listasPorClasse), ['Mago', 'Clérigo']);
});

test('ehConcedidaDeClasse: só as origens de concessão de classe', async () => {
  const { magiaClasse } = await modulosApp();
  for (const origem of ['dominio', 'sempre', 'subclasse_fixa', 'maestria_magias', 'assinatura_magica']) {
    assert.equal(magiaClasse.ehConcedidaDeClasse({ nome: 'X', origem }), true, origem);
  }
  for (const origem of [undefined, 'especie', 'iniciado_em_magia', 'conjurador_ritualista', 'especie_legado']) {
    assert.equal(magiaClasse.ehConcedidaDeClasse({ nome: 'X', origem }), false, String(origem));
  }
});
