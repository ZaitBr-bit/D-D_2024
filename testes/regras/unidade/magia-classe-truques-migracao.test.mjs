// ============================================================
// Issues #105 e #61: migrarMagiaClasse passa a carimbar TRUQUES e
// magias CONCEDIDAS por classe, com a mesma regra "sem chute".
// Nomes medidos em dados/ (2026-09-22): Domínio da Vida nível 3 concede
// Auxílio, Bênção, Curar Ferimentos, Restauração Menor.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

test('obterConcessoesPorClasse: domínio do Clérigo fica só no Clérigo', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 3 }, { classe: 'Clérigo', subclasse: 'Domínio da Vida', nivel: 3 }]);
  const mapa = await levelup.obterConcessoesPorClasse(p);
  assert.equal(mapa.get('Clérigo').has('Bênção'), true);
  assert.equal(mapa.get('Mago').has('Bênção'), false);
});

test('classe única: truques de classe são carimbados; espécie não', async () => {
  const { sheetEstado, sheetMigracoes } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 3 }]);
  p.magias_conhecidas = [
    { nome: 'Raio de Fogo', circulo: 0 },
    { nome: 'Luz', circulo: 0 },
    { nome: 'Prestidigitação Arcana', circulo: 0, origem: 'especie' },
  ];
  sheetEstado.definirChar(p);
  assert.equal(await sheetMigracoes.migrarMagiaClasse(), true);
  assert.equal(p.magias_conhecidas[0].classe, 'Mago');
  assert.equal(p.magias_conhecidas[1].classe, 'Mago');
  assert.equal('classe' in p.magias_conhecidas[2], false);
});

test('Mago/Clérigo: truque de lista única carimba, compartilhado fica sem classe, domínio vai ao Clérigo, talento fica sem classe', async () => {
  const { sheetEstado, sheetMigracoes } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 3 }, { classe: 'Clérigo', subclasse: 'Domínio da Vida', nivel: 3 }]);
  p.magias_conhecidas = [
    { nome: 'Raio de Fogo', circulo: 0 },
    { nome: 'Chama Sagrada', circulo: 0 },
    { nome: 'Luz', circulo: 0 },
  ];
  p.magias_preparadas = [
    { nome: 'Bênção', circulo: 1, origem: 'dominio' },
    { nome: 'Enfeitiçar Pessoa', circulo: 1, origem: 'iniciado_em_magia' },
  ];
  sheetEstado.definirChar(p);
  await sheetMigracoes.migrarMagiaClasse();
  const truque = (n) => p.magias_conhecidas.find((m) => m.nome === n);
  const prep = (n) => p.magias_preparadas.find((m) => m.nome === n);
  assert.equal(truque('Raio de Fogo').classe, 'Mago');
  assert.equal(truque('Chama Sagrada').classe, 'Clérigo');
  assert.equal('classe' in truque('Luz'), false, 'Luz está nas duas listas');
  assert.equal(prep('Bênção').classe, 'Clérigo');
  assert.equal('classe' in prep('Enfeitiçar Pessoa'), false);
});

test('idempotente e não sobrescreve (inclusive a resposta do jogador)', async () => {
  const { sheetEstado, sheetMigracoes } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 3 }, { classe: 'Clérigo', nivel: 3 }]);
  p.magias_conhecidas = [{ nome: 'Luz', circulo: 0, classe: 'Clérigo' }, { nome: 'Raio de Fogo', circulo: 0 }];
  sheetEstado.definirChar(p);
  assert.equal(await sheetMigracoes.migrarMagiaClasse(), true);
  assert.equal(p.magias_conhecidas[0].classe, 'Clérigo');
  assert.equal(await sheetMigracoes.migrarMagiaClasse(), false, 'segunda passagem não altera nada');
});

test('truque fixo de subclasse (Trapaceiro Arcano) vai para o Ladino, não para o Mago', async () => {
  const { sheetEstado, sheetMigracoes } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 1 }, { classe: 'Ladino', subclasse: 'Trapaceiro Arcano', nivel: 3 }]);
  p.magias_conhecidas = [{ nome: 'Mãos Mágicas', circulo: 0, origem: 'subclasse_fixa' }];
  sheetEstado.definirChar(p);
  await sheetMigracoes.migrarMagiaClasse();
  assert.equal(p.magias_conhecidas[0].classe, 'Ladino');
});
