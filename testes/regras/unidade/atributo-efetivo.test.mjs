// ============================================================
// Atributo efetivo (site/js/regras-atributos.js): o valor que um item
// define vale quando é maior que o valor-base da ficha; nunca é gravado
// em personagem.atributos.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAIZ } from './harness.mjs';
import * as A from '../../../site/js/regras-atributos.js';

const ACERVO = JSON.parse(readFileSync(resolve(RAIZ, 'dados/livro-do-mestre/capitulo7/itens_magicos.json'), 'utf-8')).itens;
const variante = (idPai, idVar) => ACERVO.find((i) => i.id === idPai).variantes.find((v) => v.id === idVar);

/** Cinturão das colinas (Força 21) no inventário, equipado e sintonizado por padrão. */
function cinturao(extra = {}) {
  return { nome: 'Cinturão de Força do Gigante (das colinas)', tipo: 'magico', equipado: true, sintonizado: true,
    dados: { requer_sintonizacao: true, efeitos: structuredClone(variante('cinturao-de-forca-do-gigante', 'cinturao-de-forca-do-gigante-das-colinas').efeitos) }, ...extra };
}
/** Personagem mínimo com Força `forca` e o inventário dado. */
const p = (forca, ...inventario) => ({ atributos: { forca, destreza: 12, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 8 }, inventario });

test('Cinturão (21) com Força 10: efetiva 21', () => {
  assert.equal(A.atributoEfetivo(p(10, cinturao()), 'forca'), 21);
});

test('Cinturão (21) com Força 21: efetiva 21, e o item não "define" nada', () => {
  assert.equal(A.atributoEfetivo(p(21, cinturao()), 'forca'), 21);
  assert.equal(A.atributoDefinidoPorItem(p(21, cinturao()), 'forca'), null);
});

test('Cinturão (21) com Força 23: efetiva 23 (o maior vale)', () => {
  assert.equal(A.atributoEfetivo(p(23, cinturao()), 'forca'), 23);
});

test('sem sintonizar ou sem equipar: vale o base', () => {
  assert.equal(A.atributoEfetivo(p(10, cinturao({ sintonizado: false })), 'forca'), 10);
  assert.equal(A.atributoEfetivo(p(10, cinturao({ equipado: false })), 'forca'), 10);
});

test('dois itens no mesmo atributo: vale o maior mínimo', () => {
  const manoplas = { nome: 'Manoplas de Poder do Ogro', tipo: 'magico', equipado: true, sintonizado: true,
    dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'forca', minimo: 19 }] } };
  assert.deepEqual(A.fonteAtributoItem(p(10, manoplas, cinturao()), 'forca'), { minimo: 21, origem: 'Cinturão de Força do Gigante (das colinas)' });
});

test('outros atributos não mudam; atributosEfetivos devolve os seis', () => {
  const ef = A.atributosEfetivos(p(10, cinturao()));
  assert.deepEqual(ef, { forca: 21, destreza: 12, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 8 });
});

test('atributoDefinidoPorItem: valor, base e origem quando o item muda o valor', () => {
  assert.deepEqual(A.atributoDefinidoPorItem(p(15, cinturao()), 'forca'), { valor: 21, base: 15, origem: 'Cinturão de Força do Gigante (das colinas)' });
});

test('nunca grava em personagem.atributos', () => {
  const per = p(10, cinturao());
  A.atributosEfetivos(per);
  assert.equal(per.atributos.forca, 10);
});

test('Poção de Força do Gigante não tem efeito automático: não muda a Força', () => {
  const pocao = ACERVO.find((i) => i.id === 'pocao-de-forca-do-gigante');
  assert.ok(pocao, 'Poção de Força do Gigante existe no acervo');
  for (const v of pocao.variantes) assert.deepEqual(v.efeitos, [], `${v.id} não deveria ter efeito`);
  const item = { nome: 'Poção', tipo: 'magico', equipado: true, dados: { efeitos: [] } };
  assert.equal(A.atributoEfetivo(p(10, item), 'forca'), 10);
});

test('sem atributos gravados e sem item: undefined (o chamador mantém o próprio padrão)', () => {
  assert.equal(A.atributoEfetivo({ inventario: [] }, 'forca'), undefined);
});

/** Pedra Ioun de Fortitude ativa (Constituição +2 até 20). */
const PEDRA_CON = { nome: 'Pedra Ioun de Fortitude', tipo: 'magico', equipado: true, sintonizado: true,
  dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo_bonus', atributo: 'constituicao', valor: 2, maximo: 20 }] } };
const CINTURAO_21 = { nome: 'Cinturão de Força do Gigante da Colina', tipo: 'magico', equipado: true, sintonizado: true,
  dados: { magico_id: 'cinturao-de-forca-do-gigante-das-colinas', requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'forca', minimo: 21 }] } };
const MARTELO = { nome: 'Martelo dos Trovões', tipo: 'magico', equipado: true, sintonizado: true,
  dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo_minimo_bonus', atributo: 'forca', valor: 4, maximo: 30 }] } };

test('aumento passivo: soma até o teto, não passa nem reduz', () => {
  const per = (con, inv = [PEDRA_CON]) => ({ atributos: { constituicao: con }, inventario: inv });
  assert.equal(A.atributoEfetivo(per(14), 'constituicao'), 16);
  assert.equal(A.atributoEfetivo(per(19), 'constituicao'), 20);
  assert.equal(A.atributoEfetivo(per(20), 'constituicao'), 20);
  assert.equal(A.atributoEfetivo(per(21), 'constituicao'), 21);
  assert.equal(A.atributoEfetivo(per(14, [{ ...PEDRA_CON, equipado: false }]), 'constituicao'), 14);
});

test('Martelo dos Trovões soma 4 ao mínimo do Cinturão até 30; sem Cinturão não faz nada', () => {
  assert.equal(A.atributoEfetivo({ atributos: { forca: 10 }, inventario: [CINTURAO_21, MARTELO] }, 'forca'), 25);
  assert.equal(A.atributoEfetivo({ atributos: { forca: 28 }, inventario: [CINTURAO_21, MARTELO] }, 'forca'), 28);
  assert.equal(A.atributoEfetivo({ atributos: { forca: 10 }, inventario: [MARTELO] }, 'forca'), 10);
  const cinturao29 = { ...CINTURAO_21, dados: { ...CINTURAO_21.dados, magico_id: 'cinturao-de-forca-do-gigante-das-tempestades', efeitos: [{ alvo: 'atributo', atributo: 'forca', minimo: 29 }] } };
  assert.equal(A.atributoEfetivo({ atributos: { forca: 10 }, inventario: [cinturao29, MARTELO] }, 'forca'), 30);
});

test('atributoDefinidoPorItem informa o aumento passivo com a origem', () => {
  assert.deepEqual(A.atributoDefinidoPorItem({ atributos: { constituicao: 14 }, inventario: [PEDRA_CON] }, 'constituicao'), { valor: 16, base: 14, origem: 'Pedra Ioun de Fortitude', aumento: true });
  assert.equal(A.atributoDefinidoPorItem({ atributos: { constituicao: 21 }, inventario: [PEDRA_CON] }, 'constituicao'), null);
});

/** Item de Força do acervo (`magico_id`) com mínimo `minimo`. */
const itemForca = (nome, magicoId, minimo) => ({ nome, tipo: 'magico', equipado: true, sintonizado: true,
  dados: { magico_id: magicoId, requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'forca', minimo }] } });
const CLAVA = itemForca('Clava Grande Trovejante', 'clava-grande-trovejante', 20);
const MAO_VECNA = itemForca('Mão de Vecna', 'mao-de-vecna', 20);
const MANOPLAS = itemForca('Manoplas de Poder do Ogro', 'manoplas-de-poder-do-ogro', 19);
const forcaDe = (base, ...inv) => A.atributoEfetivo({ atributos: { forca: base }, inventario: inv }, 'forca');

test('Martelo dos Trovões só soma ao Cinturão e às Manoplas: Clava Grande e Mão de Vecna ficam em 20', () => {
  assert.equal(forcaDe(10, CLAVA, MARTELO), 20);
  assert.equal(forcaDe(10, MAO_VECNA, MARTELO), 20);
  assert.equal(forcaDe(10, MANOPLAS, MARTELO), 23);
  assert.equal(forcaDe(10, CINTURAO_21, MARTELO), 25);
});

test('Martelo com Cinturão e Clava Grande: vale o Cinturão com o bônus (25), não a Clava', () => {
  assert.equal(forcaDe(10, CLAVA, CINTURAO_21, MARTELO), 25);
  assert.deepEqual(A.fonteAtributoItem({ atributos: { forca: 10 }, inventario: [CLAVA, CINTURAO_21, MARTELO] }, 'forca'),
    { minimo: 25, origem: 'Cinturão de Força do Gigante da Colina' });
});

test('os ids que aceitam o Martelo cobrem o pai e as cinco variantes do Cinturão e as Manoplas', () => {
  const ids = ACERVO.find((i) => i.id === 'cinturao-de-forca-do-gigante').variantes.map((v) => v.id);
  for (const id of [...ids, 'cinturao-de-forca-do-gigante', 'manoplas-de-poder-do-ogro']) {
    assert.ok(A.MAGICO_IDS_BASE_DO_MARTELO.includes(id), id);
  }
  assert.ok(!A.MAGICO_IDS_BASE_DO_MARTELO.includes('clava-grande-trovejante'));
  assert.ok(!A.MAGICO_IDS_BASE_DO_MARTELO.includes('mao-de-vecna'));
});

test('dois Martelos: somam os valores e vale o maior teto', () => {
  const martelo = (maximo) => ({ ...MARTELO, dados: { ...MARTELO.dados, efeitos: [{ alvo: 'atributo_minimo_bonus', atributo: 'forca', valor: 4, maximo }] } });
  // 21 + 4 + 4 = 29, dentro do maior teto (30)
  assert.equal(forcaDe(10, CINTURAO_21, martelo(28), martelo(30)), 29);
  // 29 + 8 passa de 30: o maior teto (30) limita
  const cinturao29 = { ...CINTURAO_21, dados: { ...CINTURAO_21.dados, magico_id: 'cinturao-de-forca-do-gigante-das-tempestades', efeitos: [{ alvo: 'atributo', atributo: 'forca', minimo: 29 }] } };
  assert.equal(forcaDe(10, cinturao29, martelo(28), martelo(30)), 30);
});

test('duas Pedras Ioun no mesmo atributo: aplicadas do menor teto para o maior', () => {
  const pedra = (maximo, nome) => ({ ...PEDRA_CON, nome, dados: { ...PEDRA_CON.dados, efeitos: [{ alvo: 'atributo_bonus', atributo: 'constituicao', valor: 2, maximo }] } });
  const con = (base, ...inv) => A.atributoEfetivo({ atributos: { constituicao: base }, inventario: inv }, 'constituicao');
  assert.equal(con(14, PEDRA_CON, { ...PEDRA_CON }), 18, 'duas iguais somam 4');
  assert.equal(con(17, PEDRA_CON, { ...PEDRA_CON }), 20, 'a segunda para no teto 20');
  // tetos diferentes, em qualquer ordem no inventário: 19 -> 20 (teto 20) -> 22 (teto 22)
  assert.equal(con(19, pedra(22, 'B'), pedra(20, 'A')), 22);
  assert.equal(con(19, pedra(20, 'A'), pedra(22, 'B')), 22);
});

test('atributoDefinidoPorItem: base igual ao mínimo não é definido; base 0, nula, ausente ou NaN perde para o item', () => {
  assert.equal(A.atributoDefinidoPorItem(p(21, CINTURAO_21), 'forca'), null);
  for (const base of [0, null, undefined, NaN, 'abc']) {
    const r = A.atributoDefinidoPorItem(p(base, CINTURAO_21), 'forca');
    assert.equal(r.valor, 21, String(base));
    assert.equal(r.origem, CINTURAO_21.nome);
  }
  assert.equal(A.atributoEfetivo(p(NaN, CINTURAO_21), 'forca'), 21);
});

test('atributoDefinidoPorItem: "aumento" só quando o valor mudou apenas por aumento passivo', () => {
  assert.equal(A.atributoDefinidoPorItem(p(10, CINTURAO_21), 'forca').aumento, undefined);
  assert.equal(A.atributoDefinidoPorItem({ atributos: { constituicao: 14 }, inventario: [PEDRA_CON] }, 'constituicao').aumento, true);
});

test('Cinturão fixa e Pedra aumenta: "Definido por Cinturão e aumentado por Pedra"; a origem é a do item que fixa', () => {
  const pedraForca = { ...PEDRA_CON, nome: 'Pedra Ioun de Força', dados: { ...PEDRA_CON.dados, efeitos: [{ alvo: 'atributo_bonus', atributo: 'forca', valor: 2, maximo: 30 }] } };
  const r = A.atributoDefinidoPorItem(p(10, CINTURAO_21, pedraForca), 'forca');
  assert.deepEqual(r, { valor: 23, base: 10, origem: CINTURAO_21.nome, origemAumento: 'Pedra Ioun de Força' });
  assert.equal(A.textosAtributoPorItem(r).titulo, `Definido por ${CINTURAO_21.nome} e aumentado por Pedra Ioun de Força; valor-base 10`);
  // Só aumento: "Aumentado por"; só fixação: "Definido por".
  assert.match(A.textosAtributoPorItem(A.atributoDefinidoPorItem(p(10, pedraForca), 'forca')).titulo, /^Aumentado por Pedra Ioun de Força; valor-base 10$/);
  assert.match(A.textosAtributoPorItem(A.atributoDefinidoPorItem(p(10, CINTURAO_21), 'forca')).titulo, /^Definido por /);
});

test('textosAtributoPorItem: base ausente ou NaN não aparece como "valor-base NaN"', () => {
  for (const base of [NaN, undefined, null, 'abc']) {
    const t = A.textosAtributoPorItem(A.atributoDefinidoPorItem({ atributos: { forca: base }, inventario: [CINTURAO_21] }, 'forca') || { base, origem: 'X' });
    if (base === null) continue; // null vira 0 (Number(null)) e tem base numérica
    assert.ok(!/NaN|undefined|valor-base/.test(t.titulo), `${base}: ${t.titulo}`);
    assert.equal(t.rotulo, '');
  }
});

test('o módulo é puro: sem DOM, sem import de utils/sheet/creator', () => {
  const fonte = readFileSync(resolve(RAIZ, 'site/js/regras-atributos.js'), 'utf-8');
  assert.ok(!/document\.|window\./.test(fonte));
  assert.ok(!/from '\.\/(utils|sheet\/|creator\/)/.test(fonte));
});
