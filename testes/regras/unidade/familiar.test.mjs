// ============================================================
// Regras do familiar (Convocar Familiar, PHB 2024): formas elegíveis, PV,
// um só familiar, desaparecimento a 0 PV, descartar e reaparecer.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RAIZ } from './harness.mjs';

const F = await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-familiar.js')).href);
const criaturas = JSON.parse(readFileSync(resolve(RAIZ, 'dados/apendices/criaturas.json'), 'utf-8')).criaturas;
const por = (nome) => criaturas.find((c) => c.nome === nome);

test('formas comuns: toda Fera de ND 0 do apêndice, e nada acima', () => {
  const nomes = F.formasComuns(criaturas).map((c) => c.nome);
  // A lista do livro, com Falcão e Sapo sob os nomes do apêndice (Gavião, Rã).
  for (const n of ['Aranha', 'Coruja', 'Corvo', 'Doninha', 'Gavião', 'Gato', 'Lagarto', 'Morcego', 'Polvo', 'Rato', 'Rã']) {
    assert.ok(nomes.includes(n), `${n} é forma comum do livro`);
  }
  assert.ok(!nomes.includes('Lobo'), 'ND 1/4 não entra');
  assert.ok(!nomes.includes('Diabrete'), 'forma do Pacto não é comum');
  assert.ok(F.formasComuns(criaturas).every((c) => /^0(\s|$)/.test(c.nd)), 'só ND 0');
});

test('formas especiais do Pacto da Corrente: as oito, todas no apêndice', () => {
  const nomes = F.formasEspeciais(criaturas).map((c) => c.nome);
  assert.deepEqual(nomes, F.FORMAS_ESPECIAIS_PACTO);
  assert.equal(nomes.length, 8);
});

test('PV, tamanho e tipo exibido', () => {
  assert.equal(F.pvDaForma(por('Gato')), 2);
  assert.equal(F.tamanhoDaForma(por('Gato')), 'Minúscula');
  assert.match(F.tipoExibido(por('Gato'), 'Feérico', false), /^Feérico Minúscula/, 'a forma comum troca Fera pelo tipo');
  assert.match(F.tipoExibido(por('Quasit'), 'Celestial', true), /^Ínfero/, 'a forma especial mantém o próprio tipo');
});

test('registrar: PV cheios, tipo válido, e só um familiar', () => {
  const p = { recursos: {} };
  const f = F.registrarFamiliar(p, por('Gato'), { tipo: 'Celestial' });
  assert.deepEqual([f.forma, f.tipo, f.pv_atual, f.pv_max, f.situacao], ['Gato', 'Celestial', 2, 2, 'ativo']);
  F.registrarFamiliar(p, por('Coruja'), { tipo: 'Inválido' });
  assert.equal(F.estadoFamiliar(p).forma, 'Coruja', 'conjurar de novo troca a forma');
  assert.equal(F.estadoFamiliar(p).tipo, 'Feérico', 'tipo inválido cai no padrão');
  F.registrarFamiliar(p, por('Diabrete'), { especial: true });
  assert.equal(F.estadoFamiliar(p).tipo, '', 'forma especial não tem tipo escolhido');
});

test('PV: dano limita em 0 e faz o familiar desaparecer; cura limita no máximo', () => {
  const p = { recursos: {} };
  F.registrarFamiliar(p, por('Diabrete'), { especial: true });
  const max = F.estadoFamiliar(p).pv_max;
  F.ajustarPVFamiliar(p, -3);
  assert.equal(F.estadoFamiliar(p).pv_atual, max - 3);
  F.ajustarPVFamiliar(p, 99);
  assert.equal(F.estadoFamiliar(p).pv_atual, max, 'cura não passa do máximo');
  F.ajustarPVFamiliar(p, -999);
  assert.equal(F.estadoFamiliar(p).pv_atual, 0);
  assert.equal(F.estadoFamiliar(p).situacao, 'desaparecido');
  assert.equal(F.ajustarPVFamiliar(p, 5), null, 'desaparecido não recebe PV até a magia ser conjurada de novo');
});

test('descartar, reaparecer e dispensar', () => {
  const p = { recursos: {} };
  assert.equal(F.descartarFamiliar(p), false, 'sem familiar não há o que descartar');
  F.registrarFamiliar(p, por('Gato'));
  F.ajustarPVFamiliar(p, -1);
  assert.equal(F.descartarFamiliar(p), true);
  assert.equal(F.estadoFamiliar(p).situacao, 'descartado');
  assert.equal(F.ajustarPVFamiliar(p, -1), null, 'descartado está na mini dimensão: não leva dano');
  assert.equal(F.reaparecerFamiliar(p), true);
  assert.equal(F.estadoFamiliar(p).pv_atual, 1, 'os PV se mantêm ao reaparecer');
  assert.equal(F.dispensarFamiliar(p), true);
  assert.equal(F.estadoFamiliar(p), null);
});

test('origem: o familiar do Companheiro Selvagem carrega a marca e o tipo Feérico', () => {
  const p = { recursos: {} };
  const f = F.registrarFamiliar(p, por('Gato'), { tipo: 'Feérico', origem: 'companheiro_selvagem' });
  assert.equal(f.origem, 'companheiro_selvagem');
  F.registrarFamiliar(p, por('Gato'));
  assert.equal(F.estadoFamiliar(p).origem, undefined, 'a magia comum não tem origem especial');
});
