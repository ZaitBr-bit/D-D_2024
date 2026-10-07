// ============================================================
// CA: efeito mágico de CA BASE (Armadura Arcana = 13 + Des) troca a base, e os bônus
// por cima (item mágico, escudo) continuam somando. O Manto de Proteção (+1 CA)
// sumia da conta quando a Armadura Arcana estava ativa.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { utils } = await modulosApp();

/** Mago de Destreza 14 (+2) com o Manto de Proteção equipado e sintonizado. */
function magoComManto(extra = {}) {
  return {
    classe: 'Mago', nivel: 3, classes: [{ classe: 'Mago', subclasse: '', nivel: 3, ordem: 0 }],
    atributos: { forca: 10, destreza: 14, constituicao: 12, inteligencia: 16, sabedoria: 10, carisma: 10 },
    inventario: [{
      nome: 'Manto de Proteção', tipo: 'magico', equipado: true, sintonizado: true, quantidade: 1,
      dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'ca', valor: 1 }, { alvo: 'salvaguarda', valor: 1 }] },
    }],
    efeitos_magicos: [], ...extra,
  };
}
const ARMADURA_ARCANA = { nome: 'Armadura Arcana', tipo_efeito: 'base', valor: 13, rotulo: 'CA = 13 + Des' };

test('Manto de Proteção sozinho soma +1 na CA sem armadura', () => {
  assert.equal(utils.calcCA(magoComManto()), 10 + 2 + 1);
});

test('Armadura Arcana + Manto de Proteção: 13 + Des + 1', () => {
  const p = magoComManto({ efeitos_magicos: [ARMADURA_ARCANA] });
  assert.equal(utils.calcCA(p), 13 + 2 + 1, 'o +1 do manto não pode sumir sob a Armadura Arcana');
});

test('Armadura Arcana sozinha continua 13 + Des', () => {
  const p = magoComManto({ inventario: [], efeitos_magicos: [ARMADURA_ARCANA] });
  assert.equal(utils.calcCA(p), 13 + 2);
});

test('Armadura Arcana + escudo: o +2 do escudo soma sobre a base nova', () => {
  const p = magoComManto({
    inventario: [{ nome: 'Escudo', tipo: 'armadura', equipado: true, quantidade: 1, dados: { categoria: 'Escudo', ca: '+2' } }],
    efeitos_magicos: [ARMADURA_ARCANA],
  });
  assert.equal(utils.calcCA(p), 13 + 2 + 2);
});

test('Pele-Casca continua sendo um mínimo: não soma, só garante 17', () => {
  const pele = { nome: 'Pele-Casca', tipo_efeito: 'minimo', valor: 17 };
  assert.equal(utils.calcCA(magoComManto({ efeitos_magicos: [pele] })), 17);
});
