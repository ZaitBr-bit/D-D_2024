// ============================================================
// Issue #96 (item b) -- a badge "Maestria: X" de uma arma customizada
// aparecia incondicionalmente, mesmo sem o personagem ter escolhido
// aquela maestria de verdade -- porque a arma customizada NUNCA entrava
// na lista de escolha do modal de maestria (só armas do catálogo,
// dados/equipamento/armas.json). `armasCustomizadasDoInventario` extrai
// as armas customizadas do inventário (issue #82, categoria preenchida)
// no formato que `armasElegiveisMaestria` já entende, pra elas entrarem
// de verdade na lista -- e o gate por `char.maestrias_arma` volta a
// fazer sentido pra elas também.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { equip } = await modulosApp();

function guerreiroCom(inventario) {
  return {
    classe: 'Guerreiro', subclasse: '', nivel: 5,
    classes: [{ classe: 'Guerreiro', subclasse: '', nivel: 5, ordem: 0 }],
    inventario,
  };
}

test('item customizado SEM categoria não entra na lista de armas customizadas', () => {
  const p = guerreiroCom([{ nome: 'Poção', tipo: 'customizado', dados: {} }]);
  assert.deepEqual(equip.armasCustomizadasDoInventario(p), []);
});

test('item customizado COM categoria entra, no formato {nome, categoria, propriedades, dano, maestria}', () => {
  const p = guerreiroCom([{
    nome: 'Espada Ancestral', tipo: 'customizado',
    dados: { categoria: 'Armas Marciais Corpo a Corpo', propriedades: 'Acuidade, Leve', dano: '1d8 Cortante', maestria: 'Trespassar' },
  }]);
  assert.deepEqual(equip.armasCustomizadasDoInventario(p), [{
    nome: 'Espada Ancestral', categoria: 'Armas Marciais Corpo a Corpo',
    propriedades: 'Acuidade, Leve', dano: '1d8 Cortante', maestria: 'Trespassar',
  }]);
});

test('item de catálogo (tipo "arma") NÃO entra -- essa lista é só das customizadas', () => {
  const p = guerreiroCom([{
    nome: 'Espada Longa', tipo: 'arma',
    dados: { categoria: 'Armas Marciais Corpo a Corpo', propriedades: 'Versátil', dano: '1d8' },
  }]);
  assert.deepEqual(equip.armasCustomizadasDoInventario(p), []);
});

test('Guerreiro (Simples ou Marciais): arma customizada Marcial entra em armasElegiveisMaestria', () => {
  const p = guerreiroCom([{
    nome: 'Espada Ancestral', tipo: 'customizado',
    dados: { categoria: 'Armas Marciais Corpo a Corpo', propriedades: '' },
  }]);
  const armas = equip.armasCustomizadasDoInventario(p);
  const elegiveis = equip.armasElegiveisMaestria(p, armas);
  assert.equal(elegiveis.length, 1, 'Guerreiro tem proficiência com Marcial -- a customizada entra');
  assert.equal(elegiveis[0].nome, 'Espada Ancestral');
});

test('classe sem proficiência com a categoria da arma customizada: ela NÃO entra (mesma regra da arma de catálogo)', () => {
  const magoSemProf = {
    classe: 'Mago', subclasse: '', nivel: 5,
    classes: [{ classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 }],
  };
  const armas = equip.armasCustomizadasDoInventario({
    ...magoSemProf,
    inventario: [{ nome: 'Espada Ancestral', tipo: 'customizado', dados: { categoria: 'Armas Marciais Corpo a Corpo' } }],
  });
  assert.deepEqual(equip.armasElegiveisMaestria(magoSemProf, armas), []);
});

test('Bárbaro: arma customizada À DISTÂNCIA não entra (só corpo a corpo, mesma regra da arma de catálogo)', () => {
  const barbaro = {
    classe: 'Bárbaro', subclasse: '', nivel: 5,
    classes: [{ classe: 'Bárbaro', subclasse: '', nivel: 5, ordem: 0 }],
    inventario: [{ nome: 'Besta Ancestral', tipo: 'customizado', dados: { categoria: 'Armas Marciais à Distância' } }],
  };
  const armas = equip.armasCustomizadasDoInventario(barbaro);
  assert.deepEqual(equip.armasElegiveisMaestria(barbaro, armas), []);
});
