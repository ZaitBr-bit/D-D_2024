// ============================================================
// Issue #48 -- Furia tem de marcar Vantagem nas pericias que o
// Conhecimento Primordial deixa testar como Forca.
//
// Livro (Classes.md): a Furia da "Vantagem em testes de Forca", e o
// Conhecimento Primordial (Barbaro 3) deixa realizar Acrobacia,
// Furtividade, Intimidacao, Percepcao e Sobrevivencia COMO teste de
// Forca. calcBonusPericia ja trocava o modificador; o selo V decidia
// pelo atributo estatico da tabela e nao aparecia.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { sheetCombate, sheetEstado, utils } = await modulosApp();

const PERICIAS_CP = ['Acrobacia', 'Furtividade', 'Intimidação', 'Percepção', 'Sobrevivência'];

/** Barbaro do nivel pedido, com a Furia no estado pedido. */
function barbaro(nivel, furiaAtiva) {
  return {
    nome: 'Grog', especie: 'Humano', classe: 'Bárbaro', subclasse: '',
    nivel, xp: 0,
    atributos: { forca: 18, destreza: 12, constituicao: 16, inteligencia: 8, sabedoria: 12, carisma: 10 },
    pericias_proficientes: ['Atletismo', 'Sobrevivência'],
    classes: [{ classe: 'Bárbaro', subclasse: '', nivel, ordem: 0 }],
    recursos: { furia_ativa: furiaAtiva, furia_usos_gastos: 0 },
    condicoes: [],
    schema_versao: 2,
  };
}

test('Barbaro 3 em Furia: as cinco pericias do Conhecimento Primordial tem Vantagem', () => {
  sheetEstado.definirChar(barbaro(3, true));
  for (const nome of PERICIAS_CP) {
    const vd = sheetCombate.calcVantagemDesvantagemPericia(nome);
    assert.ok(vd.vantagens.length > 0, `${nome} deveria ter Vantagem em Furia`);
  }
});

test('Barbaro 3 FORA de Furia: nenhuma das cinco tem Vantagem', () => {
  sheetEstado.definirChar(barbaro(3, false));
  for (const nome of PERICIAS_CP) {
    const vd = sheetCombate.calcVantagemDesvantagemPericia(nome);
    assert.equal(vd.vantagens.length, 0, `${nome} nao pode ter Vantagem fora da Furia`);
  }
});

test('Barbaro 2 em Furia: as cinco NAO tem Vantagem (Conhecimento Primordial e nv3)', () => {
  sheetEstado.definirChar(barbaro(2, true));
  for (const nome of PERICIAS_CP) {
    const vd = sheetCombate.calcVantagemDesvantagemPericia(nome);
    assert.equal(vd.vantagens.length, 0, `${nome} nao pode ter Vantagem antes do nivel 3`);
  }
});

test('Atletismo mantem a Vantagem da Furia (nao regride o que ja funcionava)', () => {
  sheetEstado.definirChar(barbaro(3, true));
  const vd = sheetCombate.calcVantagemDesvantagemPericia('Atletismo');
  assert.ok(vd.vantagens.includes('Fúria'), 'Atletismo e Forca de verdade');
});

test('a lista das cinco e a MESMA que calcBonusPericia usa', () => {
  assert.deepEqual([...utils.PERICIAS_CONHECIMENTO_PRIMORDIAL].sort(), [...PERICIAS_CP].sort());
});

test('Percepcao em Furia: o bonus ja vem de Forca e agora o selo acompanha', () => {
  const c = barbaro(3, true);
  sheetEstado.definirChar(c);
  // Forca 18 (+4) contra Sabedoria 12 (+1): o bonus prova a troca de atributo.
  const bonus = utils.calcBonusPericia(c, 'Percepção', { emFuria: true, forcaPrimordialAtiva: true });
  assert.equal(bonus, 4, 'Percepcao em Furia usa o modificador de Forca');
  const vd = sheetCombate.calcVantagemDesvantagemPericia('Percepção');
  assert.ok(vd.vantagens.length > 0, 'e o selo tem de concordar com o bonus');
});
