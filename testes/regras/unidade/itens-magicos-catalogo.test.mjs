// ============================================================
// Itens mágicos do acervo -> item de inventário (site/js/itens-magicos-catalogo.js).
// Confronta o contrato do spec (efeitos da variante, base e sintonização do
// pai, tipo do inventário pela base, registro do Livro do Jogador
// reaproveitado) com o acervo REAL e o cálculo real da ficha.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modulosApp, personagemMulticlasse, RAIZ } from './harness.mjs';
import { PASSIVOS_VERSAO } from '../../../site/js/regras-recursos-itens.js';
import * as C from '../../../site/js/itens-magicos-catalogo.js';

const { utils } = await modulosApp();
const ler = (rel) => JSON.parse(readFileSync(resolve(RAIZ, rel), 'utf-8'));
const ACERVO = ler('dados/livro-do-mestre/capitulo7/itens_magicos.json').itens;
const CATALOGOS = { armas: ler('dados/equipamento/armas.json').armas, armaduras: ler('dados/equipamento/armaduras.json').armaduras };
const PHB = ler('dados/equipamento/equipamento_aventura.json').itens;
const porId = (id) => ACERVO.find((i) => i.id === id);
const variante = (item, id) => item.variantes.find((v) => v.id === id);

test('(f) item sem base entra como "magico" com efeitos, raridade e sintonização do acervo', () => {
  const anel = porId('anel-de-protecao');
  const inv = C.montarItemInventario({ item: anel, equipamentoPHB: PHB });
  assert.equal(inv.tipo, 'magico');
  assert.equal(inv.nome, 'Anel de Proteção');
  assert.equal(inv.dados.magico_id, 'anel-de-protecao');
  assert.equal(inv.dados.raridade, 'Rara');
  assert.equal(inv.dados.requer_sintonizacao, true);
  assert.deepEqual(inv.dados.efeitos, [{ alvo: 'ca', valor: 1 }, { alvo: 'salvaguarda', valor: 1 }]);
  assert.equal(inv.dados.descricao_magica, anel.descricao);
  assert.equal(inv.equipado, false);
  assert.equal(inv.quantidade, 1);
});

test('item novo copia requisito_sintonizacao e aumento_permanente do acervo', () => {
  const manual = C.montarItemInventario({ item: porId('manual-do-exercicio-proveitoso'), equipamentoPHB: PHB });
  assert.deepEqual(manual.dados.aumento_permanente, porId('manual-do-exercicio-proveitoso').aumento_permanente);
  assert.equal(manual.dados.requisito_sintonizacao, porId('manual-do-exercicio-proveitoso').requisito_sintonizacao || '');
  const anel = C.montarItemInventario({ item: porId('anel-de-protecao'), equipamentoPHB: PHB });
  assert.equal(anel.dados.aumento_permanente, null);
  assert.equal(anel.dados.requisito_sintonizacao, '');
  const mago = ACERVO.find((i) => i.requisito_sintonizacao === 'por um Mago' && !(i.variantes || []).length && !i.base);
  assert.equal(C.montarItemInventario({ item: mago, equipamentoPHB: PHB }).dados.requisito_sintonizacao, 'por um Mago');
});

test('item novo grava passivos_versao = PASSIVOS_VERSAO (sem preenchimento posterior do acervo)', () => {
  const sem = C.montarItemInventario({ item: porId('anel-de-protecao'), equipamentoPHB: PHB });
  assert.equal(sem.dados.passivos_versao, PASSIVOS_VERSAO);
  const pai = porId('escudo-mais-1-mais-2-ou-mais-3');
  const com = C.montarItemInventario({ item: pai, variante: variante(pai, 'escudo-mais-1'), base: C.opcoesDeBase(pai.base, CATALOGOS)[0], equipamentoPHB: PHB });
  assert.equal(com.dados.passivos_versao, PASSIVOS_VERSAO);
});

test('(a)(b)(d) Escudo +1: efeitos da variante, tipo "escudo", dados do Escudo do catálogo', () => {
  const pai = porId('escudo-mais-1-mais-2-ou-mais-3');
  const escudo = C.opcoesDeBase(pai.base, CATALOGOS);
  assert.deepEqual(escudo.map((a) => a.nome), ['Escudo']);
  const inv = C.montarItemInventario({ item: pai, variante: variante(pai, 'escudo-mais-1'), base: escudo[0], equipamentoPHB: PHB });
  assert.equal(inv.tipo, 'escudo');
  assert.equal(inv.nome, 'Escudo +1');
  assert.equal(inv.dados.nome_base, 'Escudo');
  assert.equal(inv.dados.categoria, 'Escudo');
  assert.equal(inv.dados.raridade, 'Incomum');
  assert.equal(inv.dados.requer_sintonizacao, false);
  assert.deepEqual(inv.dados.efeitos, [{ alvo: 'ca', valor: 1 }]);
});

test('Escudo +1 equipado: CA sobe 2 (escudo) + 1 (mágico)', async () => {
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 1 }]);
  p.inventario = [];
  const caSem = utils.calcCA(p);
  const pai = porId('escudo-mais-1-mais-2-ou-mais-3');
  const inv = C.montarItemInventario({ item: pai, variante: variante(pai, 'escudo-mais-1'), base: C.opcoesDeBase(pai.base, CATALOGOS)[0], equipamentoPHB: PHB });
  p.inventario = [{ ...inv, equipado: true }];
  assert.equal(utils.calcCA(p), caSem + 3);
});

test('(a)(d) Arma +2 com base Rapieira: tipo "arma", dados da Rapieira, efeitos +2/+2, nome com a base', () => {
  const pai = porId('arma-mais-1-mais-2-ou-mais-3');
  const opcoes = C.opcoesDeBase(pai.base, CATALOGOS);
  assert.equal(opcoes.length, CATALOGOS.armas.length, 'as 4 categorias cobrem todas as armas do catálogo');
  const rapieira = opcoes.find((a) => a.nome === 'Rapieira');
  const inv = C.montarItemInventario({ item: pai, variante: variante(pai, 'arma-mais-2'), base: rapieira, equipamentoPHB: PHB });
  assert.equal(inv.tipo, 'arma');
  assert.equal(inv.nome, 'Arma +2 (Rapieira)');
  assert.equal(inv.dados.nome_base, 'Rapieira');
  assert.equal(inv.dados.categoria, rapieira.categoria);
  assert.equal(inv.dados.dano, rapieira.dano);
  assert.equal(inv.dados.maestria, rapieira.maestria);
  assert.equal(inv.descricao, `${rapieira.dano} - ${rapieira.propriedades || ''}`);
  assert.deepEqual(inv.dados.efeitos, [{ alvo: 'ataque_arma', valor: 2 }, { alvo: 'dano_arma', valor: 2 }]);
});

test('(e) base.excluir: Armadura de Adamantina não oferece Gibão de Peles nem armadura Leve', () => {
  const opcoes = C.opcoesDeBase(porId('armadura-de-adamantina').base, CATALOGOS).map((a) => a.nome);
  assert.ok(!opcoes.includes('Gibão de Peles'));
  assert.ok(opcoes.includes('Cota de Malha Parcial'));
  assert.ok(opcoes.includes('Armadura de Placas'));
  assert.ok(!opcoes.includes('Couro'));
  assert.ok(!opcoes.includes('Escudo'));
});

test('(d) armadura com base: tipo "armadura" e descrição com a CA do catálogo', () => {
  const item = porId('armadura-de-adamantina');
  const placas = CATALOGOS.armaduras.find((a) => a.nome === 'Armadura de Placas');
  const inv = C.montarItemInventario({ item, base: placas, equipamentoPHB: PHB });
  assert.equal(inv.tipo, 'armadura');
  assert.equal(inv.nome, 'Armadura de Adamantina (Armadura de Placas)');
  assert.equal(inv.descricao, `CA: ${placas.ca}`);
  assert.equal(inv.dados.ca, placas.ca);
});

test('Armadura de Mitral zera Furtividade e requisito de Força da base; outra armadura mantém', () => {
  const placas = CATALOGOS.armaduras.find((a) => a.nome === 'Armadura de Placas');
  assert.equal(placas.furtividade, 'Desvantagem', 'a base de controle tem Desvantagem');
  assert.notEqual(placas.requisito_forca, '—', 'a base de controle tem requisito de Força');
  const mitral = C.montarItemInventario({ item: porId('armadura-de-mitral'), base: placas, equipamentoPHB: PHB });
  assert.equal(mitral.dados.furtividade, '—');
  assert.equal(mitral.dados.requisito_forca, '—');
  assert.equal(mitral.dados.ca, placas.ca);
  const adamantina = C.montarItemInventario({ item: porId('armadura-de-adamantina'), base: placas, equipamentoPHB: PHB });
  assert.equal(adamantina.dados.furtividade, placas.furtividade);
  assert.equal(adamantina.dados.requisito_forca, placas.requisito_forca);
});

test('(g) Poção de Cura comum e Pergaminho (Truque) reaproveitam o registro do Livro do Jogador', () => {
  const pocoes = porId('pocoes-de-cura');
  const p1 = C.montarItemInventario({ item: pocoes, variante: variante(pocoes, 'pocao-de-cura'), equipamentoPHB: PHB });
  assert.equal(p1.tipo, 'equipamento');
  assert.equal(p1.nome, 'Poção de Cura');
  assert.deepEqual(p1.dados, PHB.find((r) => r.nome === 'Poção de Cura'));
  const perg = porId('pergaminho-magico');
  const p2 = C.montarItemInventario({ item: perg, variante: variante(perg, 'pergaminho-magico-truque'), equipamentoPHB: PHB, magia: null });
  assert.equal(p2.tipo, 'equipamento');
  assert.equal(p2.nome, 'Pergaminho Mágico (Truque)');
});

test('Poção de Cura (maior) não está no Livro do Jogador: vira "magico" Consumível', () => {
  const pocoes = porId('pocoes-de-cura');
  const inv = C.montarItemInventario({ item: pocoes, variante: variante(pocoes, 'pocao-de-cura-maior'), equipamentoPHB: PHB });
  assert.equal(inv.tipo, 'magico');
  assert.equal(inv.dados.tipo_item, 'Consumível');
  assert.equal(inv.dados.raridade, 'Incomum');
});

test('escolha obrigatória: sem variante ou sem base devolve null', () => {
  const pai = porId('arma-mais-1-mais-2-ou-mais-3');
  assert.equal(C.montarItemInventario({ item: pai, base: CATALOGOS.armas[0], equipamentoPHB: PHB }), null);
  assert.equal(C.montarItemInventario({ item: pai, variante: variante(pai, 'arma-mais-1'), equipamentoPHB: PHB }), null);
});

test('(c) nenhum item de inventário montado usa o tipo do acervo', () => {
  const tiposInventario = new Set();
  for (const item of ACERVO) {
    const vars = item.variantes.length ? item.variantes : [null];
    const base = item.base ? C.opcoesDeBase(item.base, CATALOGOS)[0] : null;
    for (const v of vars) {
      // magia: null = Pergaminho Mágico "Em branco" (a etapa da magia é obrigatória nele); ignorado nos demais itens.
      const inv = C.montarItemInventario({ item, variante: v, base, equipamentoPHB: PHB, magia: null });
      assert.ok(inv, `${item.id}/${v?.id} não montou`);
      tiposInventario.add(inv.tipo);
    }
  }
  assert.deepEqual([...tiposInventario].sort(), ['arma', 'armadura', 'equipamento', 'escudo', 'magico']);
});

test('todo item com base tem ao menos uma opção no catálogo', () => {
  for (const item of ACERVO.filter((i) => i.base)) {
    assert.ok(C.opcoesDeBase(item.base, CATALOGOS).length > 0, `${item.id} sem opção de base`);
  }
});

test('filtrarAcervo: texto (sem acento) casa nome do item e da variante; raridade casa variantes; tipo do livro', () => {
  assert.ok(C.filtrarAcervo(ACERVO, { texto: 'protecao' }).some((i) => i.id === 'anel-de-protecao'));
  assert.ok(C.filtrarAcervo(ACERVO, { texto: 'pocao de cura (maior)' }).some((i) => i.id === 'pocoes-de-cura'));
  assert.ok(C.filtrarAcervo(ACERVO, { raridade: 'Muito Rara' }).some((i) => i.id === 'arma-mais-1-mais-2-ou-mais-3'));
  assert.ok(C.filtrarAcervo(ACERVO, { tipo: 'Anel' }).every((i) => i.tipo === 'Anel'));
  assert.equal(C.filtrarAcervo(ACERVO, {}).length, ACERVO.length);
});

test('raridadesDoItem: a própria, ou as das variantes quando "Varia"', () => {
  assert.deepEqual(C.raridadesDoItem(porId('anel-de-protecao')), ['Rara']);
  assert.deepEqual(C.raridadesDoItem(porId('arma-mais-1-mais-2-ou-mais-3')), ['Incomum', 'Rara', 'Muito Rara']);
});

test('nomeBaseDoItem: nome da arma do catálogo, ou o nome do item', () => {
  assert.equal(C.nomeBaseDoItem({ nome: 'Arma +1 (Rapieira)', dados: { nome_base: 'Rapieira' } }), 'Rapieira');
  assert.equal(C.nomeBaseDoItem({ nome: 'Adaga', dados: {} }), 'Adaga');
});

test('selosDeEfeitos: ativo, não equipado, sem sintonia, condição, atributo (ativo / sem efeito); arma sem selo', () => {
  const anel = { nome: 'Anel', tipo: 'magico', equipado: true, sintonizado: true, dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'ca', valor: 1 }, { alvo: 'salvaguarda', valor: 1 }] } };
  assert.deepEqual(C.selosDeEfeitos(anel, { inventario: [anel] }), [
    { texto: 'CA +1', ativo: true, motivo: '' }, { texto: 'Salv +1', ativo: true, motivo: '' },
  ]);
  assert.equal(C.selosDeEfeitos({ ...anel, equipado: false }, { inventario: [] })[0].motivo, 'não equipado');
  assert.equal(C.selosDeEfeitos({ ...anel, sintonizado: false }, { inventario: [] })[0].motivo, 'requer sintonização');
  const brac = { nome: 'B', tipo: 'magico', equipado: true, sintonizado: true, dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'ca', valor: 2, condicao: 'sem_armadura_nem_escudo' }] } };
  const couro = { nome: 'Couro', tipo: 'armadura', equipado: true, dados: { categoria: 'Leve' } };
  assert.deepEqual(C.selosDeEfeitos(brac, { inventario: [brac, couro] }), [{ texto: 'CA +2', ativo: false, motivo: 'só sem armadura nem escudo' }]);
  const cint = { nome: 'C', tipo: 'magico', equipado: true, sintonizado: true, dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'forca', minimo: 21 }] } };
  assert.deepEqual(C.selosDeEfeitos(cint, { atributos: { forca: 10 }, inventario: [cint] }), [{ texto: 'Força 21', ativo: true, motivo: '' }]);
  assert.deepEqual(C.selosDeEfeitos(cint, { atributos: { forca: 23 }, inventario: [cint] }), [{ texto: 'Força 21', ativo: false, motivo: 'sem efeito: seu valor já é 23' }]);
  const arma = { nome: 'A', tipo: 'arma', equipado: true, dados: { efeitos: [{ alvo: 'ataque_arma', valor: 1 }, { alvo: 'dano_arma', valor: 1 }] } };
  assert.deepEqual(C.selosDeEfeitos(arma, { inventario: [arma] }), []);
});

test('o módulo é puro: sem DOM, sem import de sheet/ nem creator/', () => {
  const fonte = readFileSync(resolve(RAIZ, 'site/js/itens-magicos-catalogo.js'), 'utf-8');
  assert.ok(!/document\.|window\./.test(fonte));
  assert.ok(!/from '\.\/(sheet|creator)\//.test(fonte));
});

test('(b) sintonização vem do item-pai mesmo quando a variante não tem o campo (pai sintético com base)', () => {
  const pai = {
    id: 'sintetico', nome: 'Sintético', raridade: 'Varia', requer_sintonizacao: true,
    base: { tipo: 'arma', opcoes: ['Adaga'] },
    variantes: [{ id: 'sintetico-1', nome: 'Sintético +1', raridade: 'Rara', efeitos: [{ alvo: 'ataque_arma', valor: 1 }] }],
  };
  const base = C.opcoesDeBase(pai.base, CATALOGOS)[0];
  const inv = C.montarItemInventario({ item: pai, variante: pai.variantes[0], base, equipamentoPHB: PHB });
  assert.equal(inv.dados.requer_sintonizacao, true);
  assert.deepEqual(inv.dados.efeitos, [{ alvo: 'ataque_arma', valor: 1 }]);
  assert.equal(inv.dados.nome_base, 'Adaga');
});

test('(b) Cinturão de Força do Gigante (variantes + sintonização, sem base) monta com sintonização verdadeira', () => {
  const pai = porId('cinturao-de-forca-do-gigante');
  const inv = C.montarItemInventario({ item: pai, variante: pai.variantes[0], equipamentoPHB: PHB });
  assert.equal(inv.tipo, 'magico');
  assert.equal(inv.dados.requer_sintonizacao, true);
  assert.deepEqual(inv.dados.efeitos, pai.variantes[0].efeitos);
});

test('selosDeEfeitos: ca_base gera "CA base N"', () => {
  const it = { nome: 'A', tipo: 'armadura', equipado: true, dados: { efeitos: [{ alvo: 'ca_base', valor: 13 }] } };
  assert.deepEqual(C.selosDeEfeitos(it, { inventario: [it] }), [{ texto: 'CA base 13', ativo: true, motivo: '' }]);
});

test('selosDeEfeitos: atributo_bonus e atributo_minimo_bonus, ativos e inativos no teto', () => {
  const pedra = { nome: 'P', tipo: 'magico', equipado: true, sintonizado: true, dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo_bonus', atributo: 'constituicao', valor: 2, maximo: 20 }] } };
  assert.deepEqual(C.selosDeEfeitos(pedra, { atributos: { constituicao: 14 }, inventario: [pedra] }), [{ texto: 'Constituição +2 (até 20)', ativo: true, motivo: '' }]);
  assert.deepEqual(C.selosDeEfeitos(pedra, { atributos: { constituicao: 20 }, inventario: [pedra] }), [{ texto: 'Constituição +2 (até 20)', ativo: false, motivo: 'sem efeito: já está em 20' }]);
  const martelo = { nome: 'M', tipo: 'magico', equipado: true, sintonizado: true, dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo_minimo_bonus', atributo: 'forca', valor: 4, maximo: 30 }] } };
  const cinturao = { nome: 'Cinturão de Força do Gigante', tipo: 'magico', equipado: true, sintonizado: true, dados: { magico_id: 'cinturao-de-forca-do-gigante-das-colinas', requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'forca', minimo: 21 }] } };
  assert.deepEqual(C.selosDeEfeitos(martelo, { atributos: { forca: 10 }, inventario: [martelo, cinturao] }), [{ texto: 'Força do Cinturão +4 (até 30)', ativo: true, motivo: '' }]);
  assert.deepEqual(C.selosDeEfeitos(martelo, { atributos: { forca: 30 }, inventario: [martelo, cinturao] }), [{ texto: 'Força do Cinturão +4 (até 30)', ativo: false, motivo: 'sem efeito: já está em 30' }]);
  assert.equal(C.selosDeEfeitos({ ...pedra, equipado: false }, { atributos: { constituicao: 20 }, inventario: [] })[0].motivo, 'não equipado');
});

test('selosDeEfeitos: Pedra com o valor já no teto por outro item e Martelo sem mínimo de item ficam inativos', () => {
  const pedraFor = { nome: 'Pedra Ioun de Força', tipo: 'magico', equipado: true, sintonizado: true, dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo_bonus', atributo: 'forca', valor: 2, maximo: 20 }] } };
  const cinturao = { nome: 'Cinturão de Força do Gigante', tipo: 'magico', equipado: true, sintonizado: true, dados: { magico_id: 'cinturao-de-forca-do-gigante-das-colinas', requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'forca', minimo: 21 }] } };
  const pers ={ atributos: { forca: 10 }, inventario: [cinturao, pedraFor] };
  assert.deepEqual(C.selosDeEfeitos(pedraFor, pers), [{ texto: 'Força +2 (até 20)', ativo: false, motivo: 'sem efeito: já está em 21' }]);
  // Sem o Cinturão, a Pedra volta a valer.
  assert.equal(C.selosDeEfeitos(pedraFor, { atributos: { forca: 10 }, inventario: [pedraFor] })[0].ativo, true);
  // Outro bônus que leva ao teto também anula.
  const outra = { ...pedraFor, nome: 'Outra' };
  assert.equal(C.selosDeEfeitos(pedraFor, { atributos: { forca: 17 }, inventario: [pedraFor, outra] })[0].ativo, true);
  assert.equal(C.selosDeEfeitos(pedraFor, { atributos: { forca: 18 }, inventario: [pedraFor, outra] })[0].ativo, false);
  const martelo = { nome: 'Martelo dos Trovões', tipo: 'magico', equipado: true, sintonizado: true, dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo_minimo_bonus', atributo: 'forca', valor: 4, maximo: 30 }] } };
  // M3: base 28 com Cinturão 21 já passa de 21 + 4 = 25, então o Martelo não muda nada.
  assert.deepEqual(C.selosDeEfeitos(martelo, { atributos: { forca: 28 }, inventario: [martelo, cinturao] }), [{ texto: 'Força do Cinturão +4 (até 30)', ativo: false, motivo: 'sem efeito: já está em 28' }]);
  assert.equal(C.selosDeEfeitos(martelo, { atributos: { forca: 24 }, inventario: [martelo, cinturao] })[0].ativo, true);
  assert.equal(C.selosDeEfeitos(martelo, { atributos: { forca: 10 }, inventario: [martelo] })[0].motivo, 'sem efeito: requer Cinturão de Força do Gigante ou Manoplas de Poder do Ogro');
});

/** Item de Força com `magico_id` e mínimo, equipado e sintonizado. */
const itemForca = (nome, magicoId, minimo) => ({ nome, tipo: 'magico', equipado: true, sintonizado: true,
  dados: { magico_id: magicoId, requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'forca', minimo }] } });
const MARTELO_SELO = { nome: 'Martelo dos Trovões', tipo: 'magico', equipado: true, sintonizado: true,
  dados: { magico_id: 'martelo-dos-trovoes', requer_sintonizacao: true, efeitos: [{ alvo: 'atributo_minimo_bonus', atributo: 'forca', valor: 4, maximo: 30 }] } };

test('selosDeEfeitos: dois itens no mesmo atributo, só o que vale em jogo fica ativo', () => {
  const cinturao = itemForca('Cinturão', 'cinturao-de-forca-do-gigante-das-colinas', 21);
  const manoplas = itemForca('Manoplas', 'manoplas-de-poder-do-ogro', 19);
  const pers = { atributos: { forca: 10 }, inventario: [manoplas, cinturao] };
  assert.deepEqual(C.selosDeEfeitos(cinturao, pers), [{ texto: 'Força 21', ativo: true, motivo: '' }]);
  assert.deepEqual(C.selosDeEfeitos(manoplas, pers), [{ texto: 'Força 19', ativo: false, motivo: 'sem efeito: Cinturão já dá 21' }]);
  // Mesmo mínimo: o primeiro do inventário vale, o outro não.
  const outro = itemForca('Outro', 'clava-grande-trovejante', 21);
  const empate = { atributos: { forca: 10 }, inventario: [cinturao, outro] };
  assert.equal(C.selosDeEfeitos(cinturao, empate)[0].ativo, true);
  assert.equal(C.selosDeEfeitos(outro, empate)[0].motivo, 'sem efeito: Cinturão já dá 21');
});

test('selosDeEfeitos: dois Cinturões iguais (mesmo nome e id): só o primeiro fica ativo', () => {
  const a = itemForca('Cinturão de Força do Gigante', 'cinturao-de-forca-do-gigante-das-colinas', 21);
  const b = structuredClone(a);
  const pers = { atributos: { forca: 10 }, inventario: [a, b] };
  assert.equal(C.selosDeEfeitos(a, pers)[0].ativo, true);
  assert.deepEqual(C.selosDeEfeitos(b, pers), [{ texto: 'Força 21', ativo: false, motivo: 'sem efeito: Cinturão de Força do Gigante já dá 21' }]);
});

test('selosDeEfeitos: Cinturão com base 24 e o Martelo vale 25 (não diz "seu valor já é 24"); sem o Martelo, diz', () => {
  const cinturao = itemForca('Cinturão', 'cinturao-de-forca-do-gigante-das-colinas', 21);
  assert.deepEqual(C.selosDeEfeitos(cinturao, { atributos: { forca: 24 }, inventario: [cinturao, MARTELO_SELO] }), [{ texto: 'Força 21', ativo: true, motivo: '' }]);
  assert.equal(C.selosDeEfeitos(cinturao, { atributos: { forca: 24 }, inventario: [cinturao] })[0].motivo, 'sem efeito: seu valor já é 24');
  assert.equal(C.selosDeEfeitos(cinturao, { atributos: { forca: 25 }, inventario: [cinturao, MARTELO_SELO] })[0].motivo, 'sem efeito: seu valor já é 25');
});

test('selosDeEfeitos: valor-base igual ao mínimo é sem efeito; base nula, 0 ou NaN deixa o item ativo', () => {
  const cinturao = itemForca('Cinturão', 'cinturao-de-forca-do-gigante-das-colinas', 21);
  assert.equal(C.selosDeEfeitos(cinturao, { atributos: { forca: 21 }, inventario: [cinturao] })[0].motivo, 'sem efeito: seu valor já é 21');
  for (const base of [0, null, NaN]) {
    assert.equal(C.selosDeEfeitos(cinturao, { atributos: { forca: base }, inventario: [cinturao] })[0].ativo, true, String(base));
  }
});

test('selosDeEfeitos: Martelo com Clava Grande ou Mão de Vecna (sem Cinturão/Manoplas) fica sem efeito', () => {
  const clava = itemForca('Clava Grande Trovejante', 'clava-grande-trovejante', 20);
  const sel = C.selosDeEfeitos(MARTELO_SELO, { atributos: { forca: 10 }, inventario: [clava, MARTELO_SELO] });
  assert.equal(sel[0].ativo, false);
  assert.match(sel[0].motivo, /requer Cinturão/);
});

test('selosDeEfeitos: precedência dos motivos (equipado > sintonização > condição > atributo)', () => {
  const ef = [{ alvo: 'atributo', atributo: 'forca', minimo: 21, condicao: 'sem_escudo' }];
  const escudo = { nome: 'E', tipo: 'escudo', equipado: true, dados: { categoria: 'Escudo' } };
  const base = { nome: 'X', tipo: 'magico', equipado: true, sintonizado: true, dados: { requer_sintonizacao: true, efeitos: ef } };
  const pers = { inventario: [base, escudo] };
  assert.equal(C.selosDeEfeitos({ ...base, equipado: false, sintonizado: false }, pers)[0].motivo, 'não equipado');
  assert.equal(C.selosDeEfeitos({ ...base, sintonizado: false }, pers)[0].motivo, 'requer sintonização');
  assert.equal(C.selosDeEfeitos(base, pers)[0].motivo, 'só sem escudo');
  assert.equal(C.selosDeEfeitos(base, { atributos: { forca: 23 }, inventario: [base] })[0].motivo, 'sem efeito: seu valor já é 23');
});

test('todo livro_jogador do acervo resolve em equipamento_aventura.json', () => {
  const nomes = new Set(PHB.map((r) => r.nome));
  for (const item of ACERVO) {
    for (const reg of [item, ...item.variantes]) {
      if (reg.livro_jogador) assert.ok(nomes.has(reg.livro_jogador.nome), `${reg.id}: ${reg.livro_jogador.nome} ausente`);
    }
  }
});

test('opcoesDeBase com `opcoes`: oferece apenas os nomes listados', () => {
  const item = porId('adaga-do-veneno');
  assert.deepEqual(C.opcoesDeBase(item.base, CATALOGOS).map((a) => a.nome), item.base.opcoes);
});

test('nome do item: mantém quando já contém o nome da base; acrescenta o sufixo quando não contém', () => {
  const item = porId('armadura-de-placas-ana');
  const porNome = (n) => CATALOGOS.armaduras.find((a) => a.nome === n);
  const igual = C.montarItemInventario({ item, base: porNome('Armadura de Placas'), equipamentoPHB: PHB });
  assert.equal(igual.nome, item.nome);
  const outra = C.montarItemInventario({ item, base: porNome('Armadura de Placas Parcial'), equipamentoPHB: PHB });
  assert.equal(outra.nome, `${item.nome} (Armadura de Placas Parcial)`);
});

// ---- Busca: palavras em qualquer ordem, sem "de/da/do", português antes do inglês ----
const nomesDe = (texto, extra = {}) => C.filtrarAcervo(ACERVO, { texto, ...extra }).map((i) => i.nome);

test('busca: palavras soltas, em qualquer ordem e sem preposição', () => {
  assert.ok(nomesDe('manto protecao').includes('Manto de Proteção'));
  assert.ok(nomesDe('protecao manto').includes('Manto de Proteção'));
  assert.ok(nomesDe('manto da protecao').includes('Manto de Proteção'), '"da" no lugar de "de" não pode esconder o item');
  assert.ok(nomesDe('anel protecao').includes('Anel de Proteção'));
  assert.deepEqual(C.termosDaBusca('Manto da'), ['manto']);
  assert.deepEqual(C.termosDaBusca('de da'), ['de', 'da'], 'só preposição: usa todas, não esvazia a busca');
});

test('busca: o nome em português vem antes do inglês, e o inglês só entra se o português não casa', () => {
  const resultado = C.filtrarAcervo(ACERVO, { texto: 'cloak' });
  assert.ok(resultado.length > 0, 'o nome em inglês acha o item');
  assert.ok(resultado.every((i) => !C.casaEmPortugues(i, 'cloak')), '"cloak" não existe em português');
  const misto = C.filtrarAcervo(ACERVO, { texto: 'ring' });
  const primeiroIngles = misto.findIndex((i) => !C.casaEmPortugues(i, 'ring'));
  if (primeiroIngles >= 0) {
    assert.ok(misto.slice(primeiroIngles).every((i) => !C.casaEmPortugues(i, 'ring')), 'os de português vêm todos antes');
  }
  assert.ok(nomesDe('cloak of protection').includes('Manto de Proteção'));
});

test('busca: a frase inteira no nome vem antes do casamento por palavras soltas', () => {
  const lista = nomesDe('anel protecao');
  assert.ok(lista.indexOf('Anel de Proteção') < lista.indexOf('Escaravelho de Proteção') || !lista.includes('Escaravelho de Proteção'));
  const pedra = nomesDe('protecao');
  assert.ok(pedra.indexOf('Anel de Proteção') < pedra.indexOf('Pedra Ioun'), 'item cujo nome casa vem antes da variante');
});

test('busca: Pedra Ioun por variante mostra só a(s) variante(s) que casaram', () => {
  const pedra = porId('pedra-ioun') || ACERVO.find((i) => i.nome === 'Pedra Ioun');
  const casadas = C.variantesQueCasam(pedra, 'protecao');
  assert.deepEqual(casadas.map((v) => v.nome), ['Pedra Ioun (proteção)']);
  assert.deepEqual(C.variantesQueCasam(pedra, 'pedra ioun'), [], 'o nome do próprio item casa: sem destaque de variante');
  assert.deepEqual(C.variantesQueCasam(ACERVO.find((i) => i.nome === 'Anel de Proteção'), 'protecao'), []);
});

test('busca: raridade e tipo continuam filtrando; texto vazio devolve tudo', () => {
  assert.equal(C.filtrarAcervo(ACERVO, { texto: '' }).length, ACERVO.length);
  assert.ok(nomesDe('protecao', { raridade: 'Rara' }).includes('Anel de Proteção'));
  assert.ok(!nomesDe('protecao', { raridade: 'Lendária' }).includes('Anel de Proteção'));
});
