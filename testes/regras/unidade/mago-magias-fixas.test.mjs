// ============================================================
// Magias que o Mago "sempre tem preparadas" por característica de classe.
//
// PHB 2024 (dados/classes/mago.json):
//   Maestria de Magias (nível 18) -- "Escolha uma magia de 1º e uma de 2º
//     círculo em seu livro de magias que tenham um tempo de conjuração de
//     uma ação. Você sempre tem essas magias preparadas..."
//   Assinatura Mágica (nível 20) -- "Escolha duas magias de 3º círculo em
//     seu livro de magias como suas assinaturas mágicas. Você sempre tem
//     essas magias preparadas..."
//
// Antes deste motor as duas características existiam só como flag: a
// Assinatura Mágica oferecia botões "Assinatura 1/2" sem nunca perguntar
// QUAL magia era a assinatura, e a Maestria de Magias não pedia nada.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemSemente } from './harness.mjs';

const { sheetEstado, sheetMago, sheetMagias } = await modulosApp();

/** Mago no nível pedido, com um livro de magias plausível. */
async function magoComGrimorio(nivel) {
  const p = await personagemSemente('Mago');
  p.nivel = nivel;
  p.grimorio = [
    { nome: 'Mísseis Mágicos', circulo: 1 },
    { nome: 'Escudo Arcano', circulo: 1 },
    { nome: 'Despedaçar', circulo: 2 },
    { nome: 'Bola de Fogo', circulo: 3 },
    { nome: 'Contramagia', circulo: 3 },
  ];
  p.magias_preparadas = [];
  sheetEstado.definirChar(p);
  sheetMago.getEstadoRecursosMago(); // inicializa char.recursos.mago
  return p;
}

test('Maestria de Magias: a escolha fica gravada e a magia entra como sempre preparada', async () => {
  const p = await magoComGrimorio(18);

  sheetMago.definirMagiasFixasMago('maestria_magias',
    { c1: 'Mísseis Mágicos', c2: 'Despedaçar' });

  const estado = sheetMago.getEstadoRecursosMago();
  assert.equal(estado.maestriaMagia1, 'Mísseis Mágicos');
  assert.equal(estado.maestriaMagia2, 'Despedaçar');

  const preparadas = p.magias_preparadas.filter(m => m.origem === 'maestria_magias');
  assert.deepEqual(preparadas.map(m => `${m.nome}|${m.circulo}`),
    ['Mísseis Mágicos|1', 'Despedaçar|2']);
  // "Sempre preparadas" não podem ocupar vaga do limite de preparadas.
  assert.ok(preparadas.every(m => !sheetMagias.magiaContaNoLimite(m)),
    'a magia da Maestria está consumindo uma vaga do limite de preparadas');
});

test('Assinatura Mágica: as duas magias de 3º círculo ficam gravadas e sempre preparadas', async () => {
  const p = await magoComGrimorio(20);

  sheetMago.definirMagiasFixasMago('assinatura_magica',
    { m1: 'Bola de Fogo', m2: 'Contramagia' });

  const estado = sheetMago.getEstadoRecursosMago();
  assert.equal(estado.assinatura1, 'Bola de Fogo');
  assert.equal(estado.assinatura2, 'Contramagia');
  assert.deepEqual(
    p.magias_preparadas.filter(m => m.origem === 'assinatura_magica').map(m => m.nome),
    ['Bola de Fogo', 'Contramagia']);
});

test('Trocar a escolha tira a magia anterior da lista de preparadas', async () => {
  const p = await magoComGrimorio(20);
  sheetMago.definirMagiasFixasMago('assinatura_magica', { m1: 'Bola de Fogo', m2: 'Contramagia' });
  sheetMago.definirMagiasFixasMago('assinatura_magica', { m1: 'Contramagia', m2: '' });

  const assinaturas = p.magias_preparadas.filter(m => m.origem === 'assinatura_magica');
  assert.deepEqual(assinaturas.map(m => m.nome), ['Contramagia'],
    'a magia trocada continuou preparada como assinatura');
});

test('Abaixo do nível da característica, nenhuma magia fixa fica preparada', async () => {
  const p = await magoComGrimorio(20);
  sheetMago.definirMagiasFixasMago('maestria_magias', { c1: 'Mísseis Mágicos', c2: 'Despedaçar' });
  assert.equal(p.magias_preparadas.filter(m => m.origem === 'maestria_magias').length, 2);

  // O mesmo personagem visto no nível 17 (ex.: ficha antiga carregada):
  // a característica ainda não existe, e a magia não pode estar preparada
  // de graça.
  p.nivel = 17;
  sheetMago.sincronizarMagiasFixasMago();
  assert.equal(p.magias_preparadas.filter(m => m.origem === 'maestria_magias').length, 0);
  // A escolha em si é preservada, para voltar sozinha ao subir de novo.
  p.nivel = 18;
  sheetMago.sincronizarMagiasFixasMago();
  assert.equal(p.magias_preparadas.filter(m => m.origem === 'maestria_magias').length, 2);
});

test('Uma magia já preparada por escolha normal não duplica ao virar assinatura', async () => {
  const p = await magoComGrimorio(20);
  p.magias_preparadas.push({ nome: 'Bola de Fogo', circulo: 3 });

  sheetMago.definirMagiasFixasMago('assinatura_magica', { m1: 'Bola de Fogo', m2: '' });

  const ocorrencias = p.magias_preparadas.filter(m => m.nome === 'Bola de Fogo');
  assert.equal(ocorrencias.length, 1, 'a magia apareceu duas vezes na lista de preparadas');
  assert.equal(ocorrencias[0].origem, 'assinatura_magica',
    'a magia continuou ocupando vaga do limite mesmo virando assinatura');
});
