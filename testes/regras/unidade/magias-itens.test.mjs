// ============================================================
// Magias de itens mágicos (site/js/regras-magias-itens.js): opções de custo,
// situação do botão Conjurar, pagamento em cargas/usos e rótulos da linha.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { magiasDoItem, opcoesDeCusto, situacaoConjuracao, pagarConjuracao, magiasDeItens, rotuloCusto, rotuloConjuracao } from '../../../site/js/regras-magias-itens.js';

const BOLA = { nome: 'Bola de Fogo', custo: { cargas: 1, cargas_max: 3 }, conjuracao: { cd: 15 }, circulo_base: 3 };
const TEIA = { nome: 'Teia', custo: { uso: 'Teia' }, conjuracao: { cd: 13 }, circulo_base: 2 };

/** Varinha de Bolas de Fogo montada, equipada e sintonizada, com `cargas` atuais. */
function varinha(cargas = 7, extra = {}) {
  return { nome: 'Varinha de Bolas de Fogo', tipo: 'magico', equipado: true, sintonizado: true,
    dados: { magico_id: 'varinha-de-bolas-de-fogo', requer_sintonizacao: true,
      recursos: { cargas: { max: 7, recupera: '1d6+1', ultima_carga: { efeito_com_1: 'destroi' } } }, magias: [BOLA] },
    estado_recursos: { cargas, usos: {} }, ...extra };
}

/** Manto Aracnídeo com o uso "Teia". */
function manto(gastos = 0) {
  return { nome: 'Manto Aracnídeo', tipo: 'magico', equipado: true, sintonizado: true,
    dados: { magico_id: 'manto-aracnideo', requer_sintonizacao: true, recursos: { usos: [{ nome: 'Teia', max: 1, recupera: 'amanhecer' }] }, magias: [TEIA] },
    estado_recursos: { usos: { Teia: gastos } } };
}

test('opcoesDeCusto: faixa sobe o círculo; fixa; círculo fixo; uso; livre', () => {
  assert.deepEqual(opcoesDeCusto(BOLA), [{ cargas: 1, circulo: 3 }, { cargas: 2, circulo: 4 }, { cargas: 3, circulo: 5 }]);
  assert.deepEqual(opcoesDeCusto({ ...BOLA, custo: { cargas: 5, circulo: 5 } }), [{ cargas: 5, circulo: 5 }]);
  assert.deepEqual(opcoesDeCusto({ ...BOLA, custo: { cargas: 3 } }), [{ cargas: 3, circulo: 3 }]);
  assert.deepEqual(opcoesDeCusto(TEIA), [{ uso: 'Teia', circulo: 2 }]);
  assert.deepEqual(opcoesDeCusto({ ...TEIA, custo: { uso: 'Teia', circulo: 9 } }), [{ uso: 'Teia', circulo: 9 }]);
  assert.deepEqual(opcoesDeCusto({ ...TEIA, custo: 'livre' }), [{ cargas: 0, circulo: 2 }]);
});

test('situacaoConjuracao: inativo, sem sintonização, cargas insuficientes, uso gasto, destruído', () => {
  assert.deepEqual(situacaoConjuracao(varinha(7, { equipado: false }), { cargas: 1, circulo: 3 }), { ok: false, motivo: 'Equipe o item' });
  assert.deepEqual(situacaoConjuracao(varinha(7, { sintonizado: false }), { cargas: 1, circulo: 3 }), { ok: false, motivo: 'Sintonize o item' });
  assert.deepEqual(situacaoConjuracao(varinha(2), { cargas: 3, circulo: 5 }), { ok: false, motivo: 'Cargas insuficientes' });
  assert.deepEqual(situacaoConjuracao(manto(1), { uso: 'Teia', circulo: 2 }), { ok: false, motivo: 'Uso já gasto' });
  assert.deepEqual(situacaoConjuracao(varinha(7, { destruido: true }), { cargas: 1, circulo: 3 }), { ok: false, motivo: 'Item destruído' });
  assert.deepEqual(situacaoConjuracao(varinha(2), { cargas: 2, circulo: 4 }), { ok: true, motivo: '' });
});

test('pagarConjuracao desconta cargas e devolve a última carga; gasta uso; recusa sem saldo', () => {
  const v = varinha(2);
  assert.deepEqual(pagarConjuracao(v, { cargas: 2, circulo: 4 }), { ok: true, ultimaCarga: { efeito_com_1: 'destroi' } });
  assert.equal(v.estado_recursos.cargas, 0);
  assert.deepEqual(pagarConjuracao(v, { cargas: 1, circulo: 3 }), { ok: false, ultimaCarga: null });
  const m = manto();
  assert.deepEqual(pagarConjuracao(m, { uso: 'Teia', circulo: 2 }), { ok: true, ultimaCarga: null });
  assert.equal(m.estado_recursos.usos.Teia, 1);
});

test('duas varinhas iguais: pagar numa não mexe na outra', () => {
  const a = varinha(); const b = varinha();
  pagarConjuracao(a, { cargas: 3, circulo: 5 });
  assert.equal(a.estado_recursos.cargas, 4);
  assert.equal(b.estado_recursos.cargas, 7);
});

test('magiasDeItens lista itens não destruídos com magias, na ordem do inventário', () => {
  const p = { inventario: [{ nome: 'Corda', dados: {} }, varinha(), varinha(7, { destruido: true }), manto(1)] };
  const l = magiasDeItens(p);
  assert.deepEqual(l.map((x) => [x.idx, x.k, x.magia.nome, x.situacao.ok]), [[1, 0, 'Bola de Fogo', true], [3, 0, 'Teia', false]]);
});

test('rótulos de custo e de conjuração', () => {
  assert.equal(rotuloCusto(BOLA), '1–3 cargas');
  assert.equal(rotuloCusto({ ...BOLA, custo: { cargas: 5, circulo: 5 } }), '5 cargas (5º círculo)');
  assert.equal(rotuloCusto({ ...BOLA, custo: { cargas: 1 } }), '1 carga');
  assert.equal(rotuloCusto(TEIA), 'uso: Teia');
  assert.equal(rotuloCusto({ ...TEIA, custo: { uso: 'Teia', circulo: 9 } }), 'uso: Teia (9º círculo)');
  // Item com cargas e magia sem custo (cargas 0) mostra "livre".
  assert.equal(rotuloCusto({ ...BOLA, custo: { cargas: 0 } }), 'livre');
  assert.equal(rotuloCusto({ ...TEIA, custo: 'livre' }), 'livre');
  // Nome do uso que já traz o círculo não repete o círculo.
  assert.equal(rotuloCusto({ ...TEIA, custo: { uso: 'Curar Ferimentos (5º círculo)', circulo: 5 } }), 'uso: Curar Ferimentos (5º círculo)');
  assert.deepEqual(rotuloConjuracao({ ...BOLA, conjuracao: { cd: 15, ataque: -1 } }, { cd: 0, ataque: 0 }), { texto: 'CD 15 · -1', title: '' });
  assert.deepEqual(rotuloConjuracao({ ...BOLA, conjuracao: 'sua' }, { cd: 14, ataque: -1 }), { texto: 'CD 14 · -1', title: 'CD e ataque de magia do personagem' });
  assert.deepEqual(rotuloConjuracao(BOLA, { cd: 14, ataque: 6 }), { texto: 'CD 15', title: '' });
  assert.deepEqual(rotuloConjuracao({ ...BOLA, conjuracao: { cd: 15, ataque: 7 } }, { cd: 0, ataque: 0 }), { texto: 'CD 15 · +7', title: '' });
  assert.deepEqual(rotuloConjuracao({ ...BOLA, conjuracao: 'sua' }, { cd: 14, ataque: 6 }), { texto: 'CD 14 · +6', title: 'CD e ataque de magia do personagem' });
  assert.deepEqual(rotuloConjuracao({ ...BOLA, conjuracao: 'sua' }, { cd: 0, ataque: 0 }), { texto: '—', title: 'sem atributo de conjuração' });
  assert.deepEqual(rotuloConjuracao({ ...BOLA, conjuracao: null }, { cd: 14, ataque: 6 }), { texto: '', title: '' });
});

test('rotuloCusto de uso mostra a frequência do uso quando o item é informado', () => {
  assert.equal(rotuloCusto(TEIA, manto()), 'uso: Teia (1/amanhecer)');
  assert.equal(rotuloCusto(TEIA), 'uso: Teia');
  const longo = manto(); longo.dados.recursos.usos[0] = { nome: 'Teia', max: 2, recupera: 'descanso_longo' };
  assert.equal(rotuloCusto(TEIA, longo), 'uso: Teia (2/descanso longo)');
  assert.equal(rotuloCusto({ ...TEIA, custo: { uso: 'Teia', circulo: 9 } }, manto()), 'uso: Teia (9º círculo, 1/amanhecer)');
});

test('item sem recursos.cargas com custo em cargas: Cargas insuficientes', () => {
  const sem = varinha(); sem.dados.recursos = null; delete sem.estado_recursos;
  assert.deepEqual(situacaoConjuracao(sem, { cargas: 1, circulo: 3 }), { ok: false, motivo: 'Cargas insuficientes' });
  assert.deepEqual(pagarConjuracao(sem, { cargas: 1, circulo: 3 }), { ok: false, ultimaCarga: null });
});

test('magiasDeItens: item com duas magias numera k e usa a opção mais barata na situação', () => {
  const dupla = varinha(2);
  dupla.dados.magias = [BOLA, { nome: 'Relâmpago', custo: { cargas: 3 }, conjuracao: { cd: 15 }, circulo_base: 3 }];
  const l = magiasDeItens({ inventario: [dupla] });
  assert.deepEqual(l.map((x) => [x.k, x.magia.nome]), [[0, 'Bola de Fogo'], [1, 'Relâmpago']]);
  // 2 cargas: a mais barata (1) cabe; a fixa em 3 não.
  assert.equal(l[0].situacao.ok, true);
  assert.equal(l[1].situacao.ok, false);
  const faixa = opcoesDeCusto(BOLA);
  assert.equal(situacaoConjuracao(dupla, faixa[0]).ok, true);
  assert.equal(situacaoConjuracao(dupla, faixa[2]).ok, false);
});

test('situacaoConjuracao não cria nem altera estado_recursos', () => {
  const v = varinha(); delete v.estado_recursos;
  assert.equal(situacaoConjuracao(v, { cargas: 1, circulo: 3 }).ok, true);
  assert.equal('estado_recursos' in v, false);
  const m = manto(); delete m.estado_recursos;
  assert.equal(situacaoConjuracao(m, { uso: 'Teia', circulo: 2 }).ok, true);
  assert.equal('estado_recursos' in m, false);
});

test('pagarConjuracao depois que o item perdeu a carga recusa e não gasta nada', () => {
  const v = varinha(1);
  const opcao = { cargas: 1, circulo: 3 };
  assert.equal(situacaoConjuracao(v, opcao).ok, true);
  v.estado_recursos.cargas = 0;
  assert.deepEqual(pagarConjuracao(v, opcao), { ok: false, ultimaCarga: null });
  assert.equal(v.estado_recursos.cargas, 0);
});

test('magiasDoItem: lista vazia sem magias', () => {
  assert.deepEqual(magiasDoItem({ dados: {} }), []);
  assert.deepEqual(magiasDoItem(null), []);
});
