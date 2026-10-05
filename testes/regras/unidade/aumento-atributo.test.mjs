// ============================================================
// Aumento permanente de atributo por item (Manual, Tomo, Livro):
// site/js/regras-aumento-atributo.js. Grava o valor-base, respeita o teto
// e marca o item como consumido.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

// O módulo importa levelup.js (PV retroativo), que precisa dos stubs de navegador do harness.
const { levelup } = await modulosApp();
const { aumentoPermanenteDoItem, aplicarAumentoPermanente } = await import('../../../site/js/regras-aumento-atributo.js');
const sincronizarBonusPvNivel = levelup.sincronizarBonusPvNivel;

/** Personagem mínimo com os seis atributos e sem edições. */
function pers(atributos) {
  return { atributos: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10, ...atributos }, inventario: [] };
}
const manual = () => ({ nome: 'Manual do Exercício Proveitoso', dados: { aumento_permanente: { atributo: 'forca', valor: 2, maximo: 30 } } });
const livroVil = () => ({ nome: 'Livro da Escuridão Vil', dados: { aumento_permanente: { atributo: 'escolha', valor: 2, maximo: 24, reducao: { valor: 2, minimo: 3 } } } });

test('aplica +2 no atributo fixo, marca o item e não repete', () => {
  const p = pers({ forca: 16 }); const m = manual();
  assert.deepEqual(aplicarAumentoPermanente(p, m), { ok: true, aumento: { atributo: 'forca', aplicado: 2 } });
  assert.equal(p.atributos.forca, 18);
  assert.equal(m.aumento_aplicado, true);
  assert.equal(aumentoPermanenteDoItem(m), null);
  assert.equal(aplicarAumentoPermanente(p, m).ok, false);
  assert.equal(p.atributos.forca, 18);
});

test('limita ao teto; já no teto não aplica nem marca', () => {
  const p = pers({ forca: 29 }); const m = manual();
  assert.equal(aplicarAumentoPermanente(p, m).aumento.aplicado, 1);
  assert.equal(p.atributos.forca, 30);
  const p2 = pers({ forca: 30 }); const m2 = manual();
  const r = aplicarAumentoPermanente(p2, m2);
  assert.equal(r.ok, false);
  assert.match(r.erro, /máximo/);
  assert.equal(m2.aumento_aplicado, undefined);
});

test('escolha e redução: atributo escolhido +2, outro −2 sem passar de 3', () => {
  const p = pers({ carisma: 15, forca: 4 }); const l = livroVil();
  assert.deepEqual(aplicarAumentoPermanente(p, l, { atributo: 'carisma', reduzir: 'forca' }),
    { ok: true, aumento: { atributo: 'carisma', aplicado: 2 }, reducao: { atributo: 'forca', aplicado: -1 } });
  assert.equal(p.atributos.carisma, 17);
  assert.equal(p.atributos.forca, 3);
});

test('escolha inválida: sem atributo, atributo inexistente, redução igual ao aumento, sem redução quando exigida', () => {
  for (const op of [{}, { atributo: 'vigor', reduzir: 'forca' }, { atributo: 'carisma', reduzir: 'carisma' }, { atributo: 'carisma' }]) {
    const p = pers({}); const l = livroVil();
    assert.equal(aplicarAumentoPermanente(p, l, op).ok, false, JSON.stringify(op));
    assert.equal(l.aumento_aplicado, undefined);
  }
});

// ---------- PV retroativo por Constituição-base (fix round 1) ----------

const manualSaude = () => ({ nome: 'Manual da Saúde Corporal', dados: { aumento_permanente: { atributo: 'constituicao', valor: 2, maximo: 30 } } });
const amuleto = () => ({ nome: 'Amuleto da Saúde', tipo: 'magico', equipado: true, sintonizado: true,
  dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'constituicao', minimo: 19 }] } });
/** Guerreiro nível 5 com PV 44 e a Constituição dada. */
const guerreiro5 = (con, inventario = []) => ({ ...pers({ constituicao: con }), nivel: 5, pv_max: 44, pv_atual: 44, inventario });

test('Constituição 14 → 16: PV máximo e atual sobem 5 (mod +2 → +3, nível 5)', () => {
  const p = guerreiro5(14);
  assert.equal(aplicarAumentoPermanente(p, manualSaude()).ok, true);
  assert.equal(p.atributos.constituicao, 16);
  assert.equal(p.pv_max, 49);
  assert.equal(p.pv_atual, 49);
});

test('Constituição 15 → 13 pela redução do Livro: PV máximo cai 5', () => {
  const p = guerreiro5(15); p.atributos.carisma = 10;
  assert.equal(aplicarAumentoPermanente(p, livroVil(), { atributo: 'carisma', reduzir: 'constituicao' }).ok, true);
  assert.equal(p.atributos.constituicao, 13);
  assert.equal(p.pv_max, 39);
});

test('com Amuleto da Saúde ativo: o PV máximo não cai e o bônus do Amuleto fica coerente', () => {
  const p = guerreiro5(14, [amuleto()]);
  sincronizarBonusPvNivel(p);
  assert.equal(p.pv_max, 54);
  assert.equal(aplicarAumentoPermanente(p, manualSaude()).ok, true);
  sincronizarBonusPvNivel(p);
  assert.equal(p.pv_max, 54, 'Con em jogo continua 19: sem ganho nem perda');
  assert.equal(p.bonus_pv_itens_con_aplicado, 5, 'Amuleto: mod 4 contra base 3, 5 níveis');
  p.inventario[0].equipado = false;
  sincronizarBonusPvNivel(p);
  assert.equal(p.pv_max, 49, 'sem o Amuleto resta o ganho da Con-base 16');
});

test('Manual da Saúde com o Amuleto e PV não cheio: o PV atual não sobe (47/54 continua 47)', () => {
  const p = guerreiro5(14, [amuleto()]);
  sincronizarBonusPvNivel(p);
  p.pv_atual = 47;
  assert.equal(aplicarAumentoPermanente(p, manualSaude()).ok, true);
  sincronizarBonusPvNivel(p);
  assert.equal(p.pv_max, 54);
  assert.equal(p.pv_atual, 47);
});

test('Manual da Saúde sem o Amuleto: o PV atual continua subindo com o máximo', () => {
  const p = guerreiro5(14); p.pv_atual = 30;
  assert.equal(aplicarAumentoPermanente(p, manualSaude()).ok, true);
  assert.equal(p.pv_atual, 35);
});

test('aumento em atributo que não é a Constituição não mexe no PV', () => {
  const p = guerreiro5(14);
  p.pv_atual = 30;
  assert.equal(aplicarAumentoPermanente(p, manual()).ok, true);
  assert.equal(p.pv_max, 44);
  assert.equal(p.pv_atual, 30);
});

test('item destruído não oferece nem aplica o aumento', () => {
  const m = { ...manual(), destruido: true };
  assert.equal(aumentoPermanenteDoItem(m), null);
  const p = pers({ forca: 10 });
  assert.equal(aplicarAumentoPermanente(p, m).ok, false);
  assert.equal(p.atributos.forca, 10);
  assert.equal(m.aumento_aplicado, undefined);
});

test('redução já no mínimo aplica 0 e o aumento é consumido mesmo assim', () => {
  const p = pers({ carisma: 15, forca: 3 }); const l = livroVil();
  assert.deepEqual(aplicarAumentoPermanente(p, l, { atributo: 'carisma', reduzir: 'forca' }),
    { ok: true, aumento: { atributo: 'carisma', aplicado: 2 }, reducao: { atributo: 'forca', aplicado: 0 } });
  assert.equal(p.atributos.forca, 3);
  assert.equal(p.atributos.carisma, 17);
  assert.equal(l.aumento_aplicado, true);
});

test('valor do aumento ausente ou não numérico dá erro específico, não "já está no máximo"', () => {
  for (const valor of [undefined, null, 'abc', NaN, 0, -2]) {
    const p = pers({ forca: 10 });
    const item = { nome: 'Manual quebrado', dados: { aumento_permanente: { atributo: 'forca', valor, maximo: 30 } } };
    const r = aplicarAumentoPermanente(p, item);
    assert.equal(r.ok, false, String(valor));
    assert.match(r.erro, /valor válido/, String(valor));
    assert.equal(p.atributos.forca, 10);
    assert.equal(item.aumento_aplicado, undefined);
  }
});

test('aplicarDeltaSistema atualiza o original em edicoes; escrita direta deixaria a edição reverter o ganho', () => {
  const p = pers({ forca: 16 });
  p.edicoes = { campos: { atributos: { original: { ...p.atributos } } } };
  aplicarAumentoPermanente(p, manual());
  assert.equal(p.atributos.forca, 18);
  assert.equal(p.edicoes.campos.atributos.original.forca, 18, 'o original acompanha o ganho do item');
  // Contraste: escrita direta no valor-base não toca o original.
  const q = pers({ forca: 16 });
  q.edicoes = { campos: { atributos: { original: { ...q.atributos } } } };
  q.atributos.forca += 2;
  assert.equal(q.edicoes.campos.atributos.original.forca, 16);
});
