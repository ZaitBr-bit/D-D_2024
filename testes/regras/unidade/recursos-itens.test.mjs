// ============================================================
// Cargas e usos de itens (site/js/regras-recursos-itens.js): gasto,
// descansos, recuperação informada, última carga, destruído e o
// preenchimento de item adicionado antes da 4A.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAIZ } from './harness.mjs';
import * as R from '../../../site/js/regras-recursos-itens.js';
import { efeitosAtivos, efeitosDaArma } from '../../../site/js/regras-itens-magicos.js';
import { montarItemInventario } from '../../../site/js/itens-magicos-catalogo.js';

const ACERVO = JSON.parse(readFileSync(resolve(RAIZ, 'dados/livro-do-mestre/capitulo7/itens_magicos.json'), 'utf-8'));
const porId = (id) => ACERVO.itens.find((i) => i.id === id);

/** Varinha de Bolas de Fogo montada do acervo real. */
const varinha = () => montarItemInventario({ item: porId('varinha-de-bolas-de-fogo'), equipamentoPHB: [] });

test('montarItemInventario copia recursos e nasce cheio', () => {
  const v = varinha();
  assert.deepEqual(v.dados.recursos.cargas, { max: 7, recupera: '1d6+1', ultima_carga: { efeito_com_1: 'destroi' } });
  assert.equal(v.estado_recursos.cargas, 7);
});

test('item sem recursos: dados.recursos é null e não há estado', () => {
  const anel = montarItemInventario({ item: porId('anel-de-protecao'), equipamentoPHB: [] });
  assert.equal(anel.dados.recursos, null);
  assert.equal(R.garantirEstadoRecursos(anel), null);
});

test('gastar até 0 dispara a regra da última carga só na passagem de 1 para 0', () => {
  const v = varinha();
  for (let n = 0; n < 6; n++) assert.equal(R.gastarCarga(v).ultimaCarga, null);
  const r = R.gastarCarga(v);
  assert.equal(r.cargas, 0);
  assert.deepEqual(r.ultimaCarga, { efeito_com_1: 'destroi' });
  assert.equal(R.gastarCarga(v).cargas, 0, 'não fica negativo');
});

test('ajustarCarga respeita 0 e o máximo', () => {
  const v = varinha();
  assert.equal(R.ajustarCarga(v, +5), 7);
  assert.equal(R.ajustarCarga(v, -10), 0);
});

test('duas varinhas iguais têm contadores independentes', () => {
  const a = varinha(); const b = varinha();
  R.gastarCarga(a);
  assert.equal(a.estado_recursos.cargas, 6);
  assert.equal(b.estado_recursos.cargas, 7);
});

test('Descanso Longo: recuperação em dado fica pendente; recuperação informada limita ao máximo', () => {
  const v = varinha();
  R.ajustarCarga(v, -7);
  const p = { inventario: [v] };
  const pend = R.aplicarDescansoRecursos(p, 'longo');
  assert.deepEqual(pend.map((x) => [x.idx, x.recupera, x.atual, x.max]), [[0, '1d6+1', 0, 7]]);
  assert.equal(R.itensComRecuperacaoPendente(p).length, 1);
  assert.equal(R.aplicarRecuperacaoInformada(v, 5), true);
  assert.equal(v.estado_recursos.cargas, 5);
  assert.equal(R.itensComRecuperacaoPendente(p).length, 0);
  R.aplicarDescansoRecursos(p, 'longo');
  R.aplicarRecuperacaoInformada(v, 99);
  assert.equal(v.estado_recursos.cargas, 7, 'limitado ao máximo');
});

test('recuperação informada inválida não aplica e mantém a pendência', () => {
  const v = varinha(); R.ajustarCarga(v, -3);
  const p = { inventario: [v] };
  R.aplicarDescansoRecursos(p, 'longo');
  for (const ruim of [-1, NaN, '', 'abc']) assert.equal(R.aplicarRecuperacaoInformada(v, ruim), false);
  assert.equal(v.estado_recursos.cargas, 4);
  assert.equal(R.itensComRecuperacaoPendente(p).length, 1);
});

test('recupera "todas" e inteiro aplicam sozinhos no longo; usos por tipo de descanso', () => {
  const item = { nome: 'X', tipo: 'magico', dados: { recursos: { cargas: { max: 5, recupera: 'todas', ultima_carga: null },
    usos: [{ nome: 'Dia', max: 1, recupera: 'amanhecer' }, { nome: 'Curto', max: 2, recupera: 'descanso_curto' }] } } };
  R.garantirEstadoRecursos(item);
  R.ajustarCarga(item, -5); R.alternarUso(item, 'Dia'); R.alternarUso(item, 'Curto');
  const p = { inventario: [item] };
  assert.deepEqual(R.aplicarDescansoRecursos(p, 'curto'), []);
  assert.equal(item.estado_recursos.usos.Curto, 0, 'curto volta no curto');
  assert.equal(item.estado_recursos.usos.Dia, 1, 'diário não volta no curto');
  assert.equal(item.estado_recursos.cargas, 0, 'cargas não voltam no curto');
  R.aplicarDescansoRecursos(p, 'longo');
  assert.equal(item.estado_recursos.usos.Dia, 0);
  assert.equal(item.estado_recursos.cargas, 5);
});

test('recupera null: não volta em descanso nenhum', () => {
  const esc = montarItemInventario({ item: porId('escaravelho-de-protecao'), equipamentoPHB: [] });
  R.ajustarCarga(esc, -2);
  assert.deepEqual(R.aplicarDescansoRecursos({ inventario: [esc] }, 'longo'), []);
  assert.equal(esc.estado_recursos.cargas, 10);
});

test('destruído: sai dos efeitos, da sintonização e do descanso; restaurar só limpa a marca', () => {
  const item = { nome: 'Anel', tipo: 'magico', equipado: true, sintonizado: true,
    dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'ca', valor: 1 }], recursos: { cargas: { max: 3, recupera: 'todas', ultima_carga: null } } } };
  R.garantirEstadoRecursos(item);
  R.ajustarCarga(item, -3);
  R.marcarDestruido(item);
  assert.equal(item.destruido, true);
  assert.equal(item.equipado, false);
  assert.equal(item.sintonizado, false);
  assert.deepEqual(efeitosAtivos({ inventario: [item] }), []);
  R.aplicarDescansoRecursos({ inventario: [item] }, 'longo');
  assert.equal(item.estado_recursos.cargas, 0, 'destruído não recupera');
  R.restaurarItem(item);
  assert.equal(item.destruido, false);
  assert.equal(item.estado_recursos.cargas, 0);
});

test('preenche item antigo uma vez só; reabrir não reenche contador gasto', () => {
  const antigo = { nome: 'Varinha de Bolas de Fogo', tipo: 'magico', dados: { magico_id: 'varinha-de-bolas-de-fogo', efeitos: [] } };
  const semRecurso = { nome: 'Anel de Proteção', tipo: 'magico', dados: { magico_id: 'anel-de-protecao', efeitos: [] } };
  const p = { inventario: [antigo, semRecurso] };
  assert.equal(R.preencherRecursosDoAcervo(p, ACERVO), 2);
  assert.equal(antigo.estado_recursos.cargas, 7);
  assert.equal(semRecurso.dados.recursos, null);
  R.gastarCarga(antigo);
  assert.equal(R.preencherRecursosDoAcervo(p, ACERVO), 0);
  assert.equal(antigo.estado_recursos.cargas, 6);
});

test('variante herda recursos do pai', () => {
  const pai = porId('anel-de-comando-elemental');
  assert.ok(pai?.recursos?.cargas, 'o pai existe e tem cargas');
  const variante = pai.variantes.find((v) => !v.recursos);
  assert.ok(variante, 'há variante sem recursos próprios');
  const inv = montarItemInventario({ item: pai, variante, base: null, equipamentoPHB: [] });
  assert.deepEqual(inv.dados.recursos, pai.recursos);
  assert.equal(inv.estado_recursos.cargas, pai.recursos.cargas.max);
});

test('efeitosDaArma de item destruído é {0,0}', () => {
  const arma = { equipado: true, destruido: true, dados: { efeitos: [{ alvo: 'ataque_arma', valor: 1 }, { alvo: 'dano_arma', valor: 1 }] } };
  assert.deepEqual(efeitosDaArma(arma), { ataque: 0, dano: 0 });
  arma.destruido = false;
  assert.deepEqual(efeitosDaArma(arma), { ataque: 1, dano: 1 });
});

/** Item sintético com cargas e um uso de 2 por descanso curto. */
const sintetico = (cargas = { max: 3, recupera: '1d4', ultima_carga: null }, usos = [{ nome: 'U', max: 2, recupera: 'descanso_curto' }]) =>
  ({ nome: 'S', tipo: 'magico', dados: { recursos: { cargas, usos } } });

test('alternarUso cicla até o máximo e volta a 0', () => {
  const it = sintetico();
  R.garantirEstadoRecursos(it);
  assert.deepEqual([1, 2, 3].map(() => R.alternarUso(it, 'U')), [1, 2, 0]);
  assert.equal(R.alternarUso(it, 'inexistente'), 0);
});

test('recuperação informada rejeita true/null/float/NaN/vazio e limita 1e21 ao máximo', () => {
  const v = varinha(); R.ajustarCarga(v, -5);
  for (const ruim of [true, null, undefined, 1.5, NaN, '', '  ']) assert.equal(R.aplicarRecuperacaoInformada(v, ruim), false, String(ruim));
  assert.equal(v.estado_recursos.cargas, 2);
  assert.equal(R.aplicarRecuperacaoInformada(v, 1e21), true);
  assert.equal(v.estado_recursos.cargas, 7);
  assert.equal(R.aplicarRecuperacaoInformada({ nome: 'sem', dados: {} }, 3), false, 'item sem recursos não lança');
});

test('descanso longo duas vezes mantém uma pendência com idx estável', () => {
  const v = varinha(); R.ajustarCarga(v, -7);
  const p = { inventario: [{ nome: 'x', dados: {} }, v] };
  R.aplicarDescansoRecursos(p, 'longo');
  const segunda = R.aplicarDescansoRecursos(p, 'longo');
  assert.deepEqual(segunda.map((x) => x.idx), [1]);
  assert.deepEqual(R.itensComRecuperacaoPendente(p).map((x) => x.idx), [1]);
});

test('preenche item antigo por id de VARIANTE herdando as cargas do pai', () => {
  const pai = porId('anel-de-comando-elemental');
  const variante = pai.variantes.find((v) => !v.recursos);
  const antigo = { nome: 'Anel', tipo: 'magico', dados: { magico_id: variante.id, efeitos: [] } };
  assert.equal(R.preencherRecursosDoAcervo({ inventario: [antigo] }, ACERVO), 1);
  assert.equal(antigo.dados.recursos.cargas.max, pai.recursos.cargas.max);
  assert.equal(antigo.estado_recursos.cargas, pai.recursos.cargas.max);
});

test('ajustarCarga com delta NaN não altera o contador', () => {
  const v = varinha(); R.ajustarCarga(v, -2);
  assert.equal(R.ajustarCarga(v, NaN), 5);
  assert.equal(R.ajustarCarga(v, Infinity), 5);
  assert.equal(v.estado_recursos.cargas, 5);
});

test('estado legado sem cargas: gastar a última de item max 1 dispara a última carga', () => {
  const it = sintetico({ max: 1, recupera: null, ultima_carga: { efeito_com_1: 'destroi' } }, []);
  it.estado_recursos = { usos: {} };
  const r = R.gastarCarga(it);
  assert.equal(r.cargas, 0);
  assert.deepEqual(r.ultimaCarga, { efeito_com_1: 'destroi' });
});

test('pendência obsoleta some quando as cargas já estão no máximo', () => {
  const v = varinha(); R.ajustarCarga(v, -3);
  const p = { inventario: [v] };
  R.aplicarDescansoRecursos(p, 'longo');
  R.ajustarCarga(v, +3);
  assert.equal(R.itensComRecuperacaoPendente(p).length, 0);
  // A consulta é pura: a marca obsoleta só some em limparPendenciasObsoletas.
  assert.equal(v.estado_recursos.recuperacao_pendente, '1d6+1');
  assert.equal(R.limparPendenciasObsoletas(p), 1);
  assert.equal(v.estado_recursos.recuperacao_pendente, undefined);
  assert.equal(R.limparPendenciasObsoletas(p), 0);
  R.ajustarCarga(v, -1);
  R.aplicarDescansoRecursos(p, 'longo');
  R.ajustarCarga(v, +1);
  R.aplicarDescansoRecursos(p, 'longo');
  assert.equal(v.estado_recursos.recuperacao_pendente, undefined);
});

test('herança sintética: variante sem recursos usa os do pai', () => {
  const pai = { id: 'p', nome: 'P', tipo: 'Varinha', raridade: 'Varia', requer_sintonizacao: false, linha_tipo: '', descricao: '', tabelas: [], efeitos: [],
    recursos: { cargas: { max: 3, recupera: 'todas', ultima_carga: null } }, dados_ficha: { tipo_item: 'Item Mágico' },
    variantes: [{ id: 'p-1', nome: 'P +1', raridade: 'Rara', efeitos: [], recursos: null }] };
  const inv = montarItemInventario({ item: pai, variante: pai.variantes[0], equipamentoPHB: [] });
  assert.equal(inv.estado_recursos.cargas, 3);
});

/** Item sintético com um único uso nomeado, para os testes de gastarUso. */
const itemComUso = (nome, max) => ({ nome: 'U', tipo: 'magico', dados: { recursos: { usos: [{ nome, max, recupera: 'amanhecer' }] } } });

test('gastarCargas desconta n, limita a 0 e devolve a última carga só na passagem para 0', () => {
  const v = varinha();
  assert.deepEqual(R.gastarCargas(v, 3), { cargas: 4, ultimaCarga: null });
  assert.deepEqual(R.gastarCargas(v, 4), { cargas: 0, ultimaCarga: { efeito_com_1: 'destroi' } });
  assert.deepEqual(R.gastarCargas(v, 1), { cargas: 0, ultimaCarga: null });
});

test('gastarCargas com 0 não mexe nem dispara última carga', () => {
  const v = varinha();
  R.gastarCargas(v, 7);
  assert.deepEqual(R.gastarCargas(v, 0), { cargas: 0, ultimaCarga: null });
});

test('gastarUso gasta até o máximo e depois recusa', () => {
  const m = itemComUso('Teia', 1);
  assert.equal(R.gastarUso(m, 'Teia'), true);
  assert.equal(R.gastarUso(m, 'Teia'), false);
  assert.equal(m.estado_recursos.usos.Teia, 1);
});

test('preencherRecursosDoAcervo preenche magias de item da 4A sem tocar no contador', () => {
  const acervo = { itens: [{ id: 'varinha-x', recursos: { cargas: { max: 7, recupera: '1d6+1', ultima_carga: null } }, magias: [{ nome: 'Bola de Fogo', custo: { cargas: 1 }, conjuracao: null, circulo_base: 3 }], variantes: [] }] };
  const item = { nome: 'Varinha X', dados: { magico_id: 'varinha-x', recursos: acervo.itens[0].recursos }, estado_recursos: { cargas: 2, usos: {} } };
  const p = { inventario: [item] };
  assert.equal(R.preencherRecursosDoAcervo(p, acervo), 1);
  assert.equal(item.dados.magias[0].nome, 'Bola de Fogo');
  assert.equal(item.estado_recursos.cargas, 2);
  assert.equal(R.preencherRecursosDoAcervo(p, acervo), 0);
});

// Os testes de preenchimento abaixo afirmam a migração para a versão 4 (literal de propósito: a versão corrente é PASSIVOS_VERSAO).
test('preencherRecursosDoAcervo: item com passivos_versao 1 recebe atributo_bonus, vira 4 e não duplica', () => {
  const bonus = { alvo: 'atributo_bonus', atributo: 'constituicao', valor: 2, maximo: 20 };
  const acervo = { itens: [{ id: 'pedra', efeitos: [bonus], requisito_sintonizacao: 'por um Mago', aumento_permanente: null, recursos: null, magias: null, variantes: [] }] };
  const item = { nome: 'Pedra', dados: { magico_id: 'pedra', efeitos: [], recursos: null, magias: null, passivos_versao: 1 } };
  const p = { inventario: [item] };
  assert.equal(R.preencherRecursosDoAcervo(p, acervo), 1);
  assert.deepEqual(item.dados.efeitos, [bonus]);
  assert.equal(item.dados.passivos_versao, 4);
  assert.equal(R.preencherRecursosDoAcervo(p, acervo), 0);
  assert.equal(item.dados.efeitos.length, 1);
});

test('preencherRecursosDoAcervo: Martelo dos Trovões v1 recebe atributo_minimo_bonus, mantém os efeitos de arma e não duplica', () => {
  const arma = [{ alvo: 'ataque_arma', valor: 1 }, { alvo: 'dano_arma', valor: 1 }];
  const minimoBonus = { alvo: 'atributo_minimo_bonus', atributo: 'forca', valor: 4, maximo: 30 };
  const acervo = { itens: [{ id: 'martelo', efeitos: [...arma, minimoBonus], recursos: null, magias: null, variantes: [] }] };
  const item = { nome: 'Martelo dos Trovões', dados: { magico_id: 'martelo', efeitos: structuredClone(arma), recursos: null, magias: null, passivos_versao: 1 } };
  const p = { inventario: [item] };
  assert.equal(R.preencherRecursosDoAcervo(p, acervo), 1);
  assert.deepEqual(item.dados.efeitos, [...arma, minimoBonus]);
  assert.equal(item.dados.passivos_versao, 4);
  assert.equal(R.preencherRecursosDoAcervo(p, acervo), 0);
  assert.equal(item.dados.efeitos.length, 3);
});

test('preencherRecursosDoAcervo: item sem requisito_sintonizacao/aumento_permanente recebe do acervo', () => {
  const aum = { atributo: 'forca', valor: 2, maximo: 30 };
  const acervo = { itens: [
    { id: 'manual', efeitos: [], requisito_sintonizacao: 'por um Mago', aumento_permanente: aum, recursos: null, magias: null, variantes: [] },
    { id: 'pai', efeitos: [], requisito_sintonizacao: 'por um Bardo', recursos: null, magias: null, variantes: [{ id: 'filho', aumento_permanente: aum }] },
  ] };
  const item = { nome: 'Manual', dados: { magico_id: 'manual', efeitos: [], recursos: null, magias: null, passivos_versao: 2 } };
  assert.equal(R.preencherRecursosDoAcervo({ inventario: [item] }, acervo), 1);
  assert.equal(item.dados.requisito_sintonizacao, 'por um Mago');
  assert.deepEqual(item.dados.aumento_permanente, aum);
  // Variante herda o requisito do pai (campo da variante só no que ela define).
  const filho = { nome: 'Filho', dados: { magico_id: 'filho', efeitos: [], recursos: null, magias: null, passivos_versao: 2 } };
  R.preencherRecursosDoAcervo({ inventario: [filho] }, acervo);
  assert.equal(filho.dados.requisito_sintonizacao, 'por um Bardo');
  assert.deepEqual(filho.dados.aumento_permanente, aum);
  // Aumento já consumido (aumento_aplicado no item) não é tocado: a chave existe e não é preenchida de novo.
  assert.equal(R.preencherRecursosDoAcervo({ inventario: [item, filho] }, acervo), 0);
});

test('preencherRecursosDoAcervo traz os passivos do acervo sem duplicar e marca a versão', () => {
  const res = { alvo: 'resistencia', tipo_dano: 'Ígneo' };
  const acervo = { itens: [
    { id: 'anel-fogo', efeitos: [{ alvo: 'ca', valor: 1 }, res], recursos: null, magias: null, variantes: [] },
    { id: 'pai', efeitos: [{ alvo: 'imunidade', tipo_dano: 'Psíquico' }], recursos: null, magias: null, variantes: [{ id: 'filho', efeitos: null }] },
  ] };
  const antigo = { nome: 'Anel', dados: { magico_id: 'anel-fogo', efeitos: [{ alvo: 'ca', valor: 1 }], recursos: null, magias: null } };
  const p = { inventario: [antigo] };
  assert.equal(R.preencherRecursosDoAcervo(p, acervo), 1);
  assert.deepEqual(antigo.dados.efeitos, [{ alvo: 'ca', valor: 1 }, res]);
  assert.equal(antigo.dados.passivos_versao, 4);
  assert.equal(R.preencherRecursosDoAcervo(p, acervo), 0);
  assert.equal(antigo.dados.efeitos.length, 2);
  // Já tem o efeito: não duplica, mas recebe a marca.
  const completo = { nome: 'Anel', dados: { magico_id: 'anel-fogo', efeitos: [res, { alvo: 'ca', valor: 1 }], recursos: null, magias: null } };
  assert.equal(R.preencherRecursosDoAcervo({ inventario: [completo] }, acervo), 1);
  assert.equal(completo.dados.efeitos.length, 2);
  assert.equal(completo.dados.passivos_versao, 4);
  // Item com recursos/magias ausentes e passivos: conta uma vez só.
  const tudo = { nome: 'Anel', dados: { magico_id: 'anel-fogo', efeitos: [] } };
  assert.equal(R.preencherRecursosDoAcervo({ inventario: [tudo] }, acervo), 1);
  // Variante sem efeitos próprios herda do pai.
  const filho = { nome: 'Filho', dados: { magico_id: 'filho', efeitos: [], recursos: null, magias: null } };
  R.preencherRecursosDoAcervo({ inventario: [filho] }, acervo);
  assert.deepEqual(filho.dados.efeitos, [{ alvo: 'imunidade', tipo_dano: 'Psíquico' }]);
});

test('montagem: item do acervo leva as magias; variante com magias próprias usa as dela', () => {
  const v = varinha();
  assert.deepEqual(v.dados.magias, porId('varinha-de-bolas-de-fogo').magias);
  assert.ok(v.dados.magias.length > 0);
  const pai = porId('anel-de-comando-elemental');
  const variante = pai.variantes.find((x) => x.magias);
  const inv = montarItemInventario({ item: pai, variante, base: null, equipamentoPHB: [] });
  assert.deepEqual(inv.dados.magias, variante.magias);
  assert.equal(montarItemInventario({ item: porId('anel-de-protecao'), equipamentoPHB: [] }).dados.magias, null);
});

test('montagem: variante sem magias próprias herda as do pai', () => {
  const pai = { id: 'p', nome: 'P', tipo: 'Varinha', raridade: 'Varia', requer_sintonizacao: false, linha_tipo: '', descricao: '', tabelas: [], efeitos: [],
    magias: [{ nome: 'Teia', custo: { cargas: 1 }, conjuracao: null, circulo_base: 2 }], dados_ficha: { tipo_item: 'Item Mágico' },
    variantes: [{ id: 'p-1', nome: 'P +1', raridade: 'Rara', efeitos: [] }] };
  const inv = montarItemInventario({ item: pai, variante: pai.variantes[0], equipamentoPHB: [] });
  assert.deepEqual(inv.dados.magias, pai.magias);
});

test('itensComRecuperacaoPendente não muta o personagem (marca obsoleta e pendência real)', () => {
  const v = varinha(); R.ajustarCarga(v, -2);
  const obsoleto = varinha(); R.ajustarCarga(obsoleto, -1);
  const p = { inventario: [v, obsoleto] };
  R.aplicarDescansoRecursos(p, 'longo');
  R.ajustarCarga(obsoleto, +1);
  const antes = JSON.stringify(p);
  const lista = R.itensComRecuperacaoPendente(p);
  assert.deepEqual(lista.map((x) => x.idx), [0]);
  assert.equal(JSON.stringify(p), antes);
});

test('estado sem a chave cargas (legado) conta como cheio e não cria pendência no longo', () => {
  const v = varinha();
  v.estado_recursos = { usos: {} };
  const p = { inventario: [v] };
  assert.deepEqual(R.aplicarDescansoRecursos(p, 'longo'), []);
  assert.equal(v.estado_recursos.cargas, 7);
  assert.equal(v.estado_recursos.recuperacao_pendente, undefined);
  const w = varinha();
  w.estado_recursos = {};
  R.garantirEstadoRecursos(w);
  assert.equal(w.estado_recursos.cargas, 7);
  assert.deepEqual(w.estado_recursos.usos, {});
});

test('preencherRecursosDoAcervo: variante sem magias próprias herda as magias do pai', () => {
  const pai = { id: 'p', nome: 'P', magias: [{ nome: 'Teia', custo: { cargas: 1 }, conjuracao: null, circulo_base: 2 }],
    recursos: { cargas: { max: 3, recupera: 'todas', ultima_carga: null } }, variantes: [{ id: 'p-1', nome: 'P +1' }] };
  const antigo = { nome: 'P +1', tipo: 'magico', dados: { magico_id: 'p-1' } };
  assert.equal(R.preencherRecursosDoAcervo({ inventario: [antigo] }, { itens: [pai] }), 1);
  assert.deepEqual(antigo.dados.magias, pai.magias);
  assert.notEqual(antigo.dados.magias, pai.magias);
  assert.equal(antigo.estado_recursos.cargas, 3);
});

test('aplicarContadorManual: editar preserva a pendência enquanto as cargas estão abaixo do máximo', () => {
  const item = { nome: 'Corda', tipo: 'equipamento', dados: {} };
  const cargas = (max, recupera) => ({ cargas: { max, recupera, ultima_carga: null } });
  R.aplicarContadorManual(item, cargas(5, '1d4'));
  R.ajustarCarga(item, -3);
  const p = { inventario: [item] };
  R.aplicarDescansoRecursos(p, 'longo');
  assert.equal(item.estado_recursos.recuperacao_pendente, '1d4');
  // Novo máximo maior: cargas (2) continuam abaixo do máximo, pendência mantida.
  R.aplicarContadorManual(item, cargas(8, '1d4'), true);
  assert.equal(item.estado_recursos.cargas, 2);
  assert.equal(item.estado_recursos.recuperacao_pendente, '1d4');
  assert.equal(R.itensComRecuperacaoPendente(p).length, 1);
  // Novo máximo igual às cargas: sai da pendência.
  R.aplicarContadorManual(item, cargas(2, '1d4'), true);
  assert.equal(item.estado_recursos.recuperacao_pendente, undefined);
  // Recuperação trocada para "todas": não há dado a informar.
  R.ajustarCarga(item, -1);
  item.estado_recursos.recuperacao_pendente = '1d4';
  R.aplicarContadorManual(item, cargas(2, 'todas'), true);
  assert.equal(item.estado_recursos.recuperacao_pendente, undefined);
  // Criação (edicao false) nasce cheio e sem pendência.
  R.aplicarContadorManual(item, cargas(4, '1d4'));
  assert.equal(item.estado_recursos.cargas, 4);
  assert.equal(item.estado_recursos.recuperacao_pendente, undefined);
});

// ---- Contador manual: recursosDoFormulario ----

test('recursosDoFormulario: cargas com dado de recuperação', () => {
  const r = R.recursosDoFormulario({ tipo: 'cargas', nome: '', max: '5', recupera: 'amanhecer', dado: '1d6+1' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.recursos, { cargas: { max: 5, recupera: '1d6+1', ultima_carga: null } });
});

test('recursosDoFormulario: cargas "todas" e "não recupera"', () => {
  assert.equal(R.recursosDoFormulario({ tipo: 'cargas', max: 3, recupera: 'todas' }).recursos.cargas.recupera, 'todas');
  assert.equal(R.recursosDoFormulario({ tipo: 'cargas', max: 3, recupera: 'nenhum' }).recursos.cargas.recupera, null);
});

test('recursosDoFormulario: uso com nome e recuperação', () => {
  const r = R.recursosDoFormulario({ tipo: 'uso', nome: ' Relâmpago ', max: 2, recupera: 'descanso_curto', dado: '' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.recursos, { usos: [{ nome: 'Relâmpago', max: 2, recupera: 'descanso_curto' }] });
});

test('recursosDoFormulario: max 0, não inteiro ou vazio é erro', () => {
  for (const max of [0, '0', '', 'abc', 1.5, -2]) {
    const r = R.recursosDoFormulario({ tipo: 'cargas', max, recupera: 'todas' });
    assert.equal(r.ok, false, `max=${max}`);
    assert.ok(r.erro);
  }
});

test('recursosDoFormulario: dado "1d6 + 1" é erro', () => {
  const r = R.recursosDoFormulario({ tipo: 'cargas', max: 3, recupera: 'amanhecer', dado: '1d6 + 1' });
  assert.equal(r.ok, false);
});

test('recursosDoFormulario: cargas ao amanhecer sem dado é erro; uso sem nome é erro', () => {
  assert.equal(R.recursosDoFormulario({ tipo: 'cargas', max: 3, recupera: 'amanhecer', dado: '' }).ok, false);
  assert.equal(R.recursosDoFormulario({ tipo: 'uso', nome: '  ', max: 1, recupera: 'amanhecer' }).ok, false);
});

test('recursosDoFormulario: cargas + descanso_curto é erro', () => {
  const r = R.recursosDoFormulario({ tipo: 'cargas', max: 3, recupera: 'descanso_curto', dado: '' });
  assert.equal(r.ok, false);
  assert.match(r.erro, /Todas|dado/);
});

test('recursosDoFormulario: "nenhum" ou "todas" com dado é erro', () => {
  assert.equal(R.recursosDoFormulario({ tipo: 'cargas', max: 3, recupera: 'nenhum', dado: '1d6' }).ok, false);
  assert.equal(R.recursosDoFormulario({ tipo: 'cargas', max: 3, recupera: 'todas', dado: '1d6' }).ok, false);
});

test('recursosDoFormulario: uso aceita só amanhecer/descanso_longo/descanso_curto', () => {
  for (const rec of ['amanhecer', 'descanso_longo', 'descanso_curto']) {
    assert.equal(R.recursosDoFormulario({ tipo: 'uso', nome: 'X', max: 1, recupera: rec }).recursos.usos[0].recupera, rec);
  }
  for (const rec of ['nenhum', 'todas', '', undefined]) {
    assert.equal(R.recursosDoFormulario({ tipo: 'uso', nome: 'X', max: 1, recupera: rec }).ok, false, String(rec));
  }
});

test('recursosDoFormulario: dado em maiúsculas é normalizado', () => {
  const r = R.recursosDoFormulario({ tipo: 'cargas', max: 3, recupera: 'amanhecer', dado: '1D6+1' });
  assert.equal(r.recursos.cargas.recupera, '1d6+1');
});
