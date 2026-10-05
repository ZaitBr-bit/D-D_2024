// ============================================================
// Pérola do Poder (Plano 9, Task 2): espaços de magia recuperáveis por item
// (site/js/regras-espacos-itens.js) e o preenchimento do `efeito` do uso em
// itens antigos (regras-recursos-itens.js).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAIZ, modulosApp, personagemMulticlasse, lerClassesDados } from './harness.mjs';
import { espacosRecuperaveis, mensagemSemEspaco, restaurarEspacoPorItem } from '../../../site/js/regras-espacos-itens.js';
import { PASSIVOS_VERSAO, preencherRecursosDoAcervo, recursosDoItem } from '../../../site/js/regras-recursos-itens.js';
import { montarItemInventario } from '../../../site/js/itens-magicos-catalogo.js';

// reservas-espacos.js importa utils.js (toca `window`): o await de modulosApp instala os stubs antes.
const { sheetEstado } = await modulosApp();
const { montarReservasDeEspacos, gastarEspaco, recuperarUmEspaco } = await import('../../../site/js/sheet/reservas-espacos.js');
const mapaDados = lerClassesDados();
sheetEstado.definirClassesData(mapaDados);

const ACERVO = JSON.parse(readFileSync(resolve(RAIZ, 'dados/livro-do-mestre/capitulo7/itens_magicos.json'), 'utf-8'));
const NOME_USO = 'Recuperar espaço de magia';

/** Pérola do Poder montada do acervo real, equipada e sintonizada. */
function perola({ equipado = true, sintonizado = true } = {}) {
  const item = montarItemInventario({ item: ACERVO.itens.find((i) => i.id === 'perola-do-poder'), equipamentoPHB: [] });
  item.equipado = equipado;
  item.sintonizado = sintonizado;
  return item;
}

/** Opções reais do chamador: reservas calculadas do personagem e o escritor autorizado. */
const reservasDe = (p) => montarReservasDeEspacos(p, mapaDados);
const opcoesReais = (p) => ({ reservas: reservasDe(p), recuperar: recuperarUmEspaco });

/** Mago nível 5 (4/3/2 espaços de 1º/2º/3º) com os gastos dados como [círculo, vezes]. */
async function magoComGastos(gastos) {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  for (const [circulo, vezes] of gastos) for (let i = 0; i < vezes; i++) assert.equal(gastarEspaco(p, 'conjuracao', circulo), true);
  return p;
}

test('o acervo traz efeito e circulo_max no uso da Pérola do Poder', () => {
  const uso = recursosDoItem(perola()).usos[0];
  assert.equal(uso.nome, NOME_USO);
  assert.equal(uso.efeito, 'recuperar_espaco_magia');
  assert.equal(uso.circulo_max, 3);
});

test('nenhum espaço gasto: lista vazia e restaurar falha sem gastar o uso', async () => {
  const p = await magoComGastos([]);
  const item = perola();
  assert.deepEqual(espacosRecuperaveis(reservasDe(p), 3), []);
  const r = restaurarEspacoPorItem(p, item, NOME_USO, { fonte: 'conjuracao', circulo: 1 }, opcoesReais(p));
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'Nenhum espaço de magia gasto de 3º círculo ou inferior.');
  assert.equal(item.estado_recursos?.usos?.[NOME_USO] || 0, 0);
});

test('só espaço de 4º círculo gasto: acima do teto, lista vazia e erro', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 9 }]);
  assert.equal(gastarEspaco(p, 'conjuracao', 4), true);
  const item = perola();
  assert.deepEqual(espacosRecuperaveis(reservasDe(p), 3), []);
  const r = restaurarEspacoPorItem(p, item, NOME_USO, { fonte: 'conjuracao', circulo: 4 }, opcoesReais(p));
  assert.equal(r.ok, false);
  assert.equal(item.estado_recursos?.usos?.[NOME_USO] || 0, 0);
  assert.equal(reservasDe(p).find((x) => x.circulo === 4).usados, 1);
});

test('espaços de 1º e 2º gastos: lista os dois, ordenados e com rótulo', async () => {
  const p = await magoComGastos([[2, 1], [1, 2]]);
  const lista = espacosRecuperaveis(reservasDe(p), 3);
  assert.deepEqual(lista.map((o) => [o.fonte, o.circulo, o.usados, o.total]), [['conjuracao', 1, 2, 4], ['conjuracao', 2, 1, 3]]);
  assert.equal(lista[0].rotulo, '1º círculo (gasto 2 de 4)');
  assert.equal(lista[1].rotulo, '2º círculo (gasto 1 de 3)');
});

test('escolha fora da lista: erro e nada muda', async () => {
  const p = await magoComGastos([[1, 1]]);
  const item = perola();
  const r = restaurarEspacoPorItem(p, item, NOME_USO, { fonte: 'conjuracao', circulo: 2 }, opcoesReais(p));
  assert.equal(r.ok, false);
  assert.match(r.erro, /fora das opções/);
  assert.equal(reservasDe(p).find((x) => x.circulo === 1).usados, 1);
  assert.equal(item.estado_recursos?.usos?.[NOME_USO] || 0, 0);
});

test('item não sintonizado ou não equipado: erro e nada muda', async () => {
  for (const estado of [{ sintonizado: false }, { equipado: false }]) {
    const p = await magoComGastos([[1, 1]]);
    const item = perola(estado);
    const r = restaurarEspacoPorItem(p, item, NOME_USO, { fonte: 'conjuracao', circulo: 1 }, opcoesReais(p));
    assert.equal(r.ok, false, JSON.stringify(estado));
    assert.equal(reservasDe(p).find((x) => x.circulo === 1).usados, 1);
    assert.equal(item.estado_recursos?.usos?.[NOME_USO] || 0, 0);
  }
});

test('uso já gasto: erro e o espaço continua gasto', async () => {
  const p = await magoComGastos([[1, 1]]);
  const item = perola();
  item.estado_recursos = { usos: { [NOME_USO]: 1 } };
  const r = restaurarEspacoPorItem(p, item, NOME_USO, { fonte: 'conjuracao', circulo: 1 }, opcoesReais(p));
  assert.equal(r.ok, false);
  assert.equal(reservasDe(p).find((x) => x.circulo === 1).usados, 1);
  assert.equal(item.estado_recursos.usos[NOME_USO], 1);
});

test('uso inexistente ou sem efeito: erro', async () => {
  const p = await magoComGastos([[1, 1]]);
  assert.equal(restaurarEspacoPorItem(p, perola(), 'Outro uso', { fonte: 'conjuracao', circulo: 1 }, opcoesReais(p)).ok, false);
  const semEfeito = perola();
  delete semEfeito.dados.recursos.usos[0].efeito;
  assert.equal(restaurarEspacoPorItem(p, semEfeito, NOME_USO, { fonte: 'conjuracao', circulo: 1 }, opcoesReais(p)).ok, false);
  assert.equal(reservasDe(p).find((x) => x.circulo === 1).usados, 1);
});

test('sucesso restaura exatamente um espaço do círculo escolhido e gasta o uso', async () => {
  const p = await magoComGastos([[1, 1], [3, 1]]);
  const item = perola();
  const r = restaurarEspacoPorItem(p, item, NOME_USO, { fonte: 'conjuracao', circulo: 3 }, opcoesReais(p));
  assert.deepEqual(r, { ok: true, circulo: 3, fonte: 'conjuracao' });
  const reservas = reservasDe(p);
  assert.equal(reservas.find((x) => x.circulo === 3).usados, 0);
  assert.equal(reservas.find((x) => x.circulo === 1).usados, 1);
  assert.equal(item.estado_recursos.usos[NOME_USO], 1);
});

test('falha da função de recuperação não gasta o uso (atômico)', async () => {
  const p = await magoComGastos([[1, 1]]);
  const item = perola();
  const r = restaurarEspacoPorItem(p, item, NOME_USO, { fonte: 'conjuracao', circulo: 1 }, { reservas: reservasDe(p), recuperar: () => false });
  assert.equal(r.ok, false);
  assert.equal(item.estado_recursos?.usos?.[NOME_USO] || 0, 0);
});

test('Bruxo: espaço de Pacto gasto aparece rotulado e é restaurado', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 3 }]);
  const pacto = reservasDe(p).find((r) => r.fonte === 'pacto');
  assert.ok(pacto, 'Bruxo 3 tem reserva de Pacto');
  assert.equal(gastarEspaco(p, 'pacto', pacto.circulo), true);
  const lista = espacosRecuperaveis(reservasDe(p), 3);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].fonte, 'pacto');
  // Um único par de parênteses: "Nº círculo, Pacto (gasto X de Y)".
  assert.equal(lista[0].rotulo, `${pacto.circulo}º círculo, Pacto (gasto 1 de ${pacto.total})`);
  const item = perola();
  const r = restaurarEspacoPorItem(p, item, NOME_USO, { fonte: 'pacto', circulo: pacto.circulo }, opcoesReais(p));
  assert.equal(r.ok, true);
  assert.equal(reservasDe(p).find((x) => x.fonte === 'pacto').usados, 0);
});

test('mesmo círculo: conjuração vem antes de pacto', () => {
  const reservas = [
    { fonte: 'pacto', circulo: 2, total: 2, usados: 1, disponiveis: 1 },
    { fonte: 'conjuracao', circulo: 2, total: 3, usados: 1, disponiveis: 2 },
    { fonte: 'conjuracao', circulo: 1, total: 4, usados: 0, disponiveis: 4 },
  ];
  assert.deepEqual(espacosRecuperaveis(reservas, 3).map((o) => o.fonte), ['conjuracao', 'pacto']);
});

// ---- Preenchimento do efeito em itens antigos (passivos_versao < 4) ----

const acervoPerola = () => ({ itens: [ACERVO.itens.find((i) => i.id === 'perola-do-poder')] });

test('montarItemInventario grava a versão corrente dos passivos e o efeito do uso', () => {
  const item = perola();
  assert.equal(item.dados.passivos_versao, PASSIVOS_VERSAO);
  assert.equal(item.dados.recursos.usos[0].efeito, 'recuperar_espaco_magia');
});

test('item antigo (versão 2, uso sem efeito) recebe efeito e círculo, sem mexer no estado; segunda chamada não muda', () => {
  const antigo = perola();
  delete antigo.dados.recursos.usos[0].efeito;
  delete antigo.dados.recursos.usos[0].circulo_max;
  antigo.dados.passivos_versao = 2;
  antigo.estado_recursos = { usos: { [NOME_USO]: 1 } };
  const p = { inventario: [antigo] };
  assert.equal(preencherRecursosDoAcervo(p, acervoPerola()), 1);
  assert.equal(antigo.dados.recursos.usos[0].efeito, 'recuperar_espaco_magia');
  assert.equal(antigo.dados.recursos.usos[0].circulo_max, 3);
  // Migração: a ficha antiga passa a ser marcada com a versão 4 (literal de propósito).
  assert.equal(antigo.dados.passivos_versao, 4);
  assert.deepEqual(antigo.estado_recursos, { usos: { [NOME_USO]: 1 } });
  assert.equal(preencherRecursosDoAcervo(p, acervoPerola()), 0);
});

test('preenchimento não toca em contador manual nem em uso de outro nome', () => {
  const manual = perola();
  // Mesmo nome do uso do acervo: só a marca de contador manual impede o preenchimento.
  manual.dados.recursos = { usos: [{ nome: NOME_USO, max: 1, recupera: 'amanhecer' }] };
  manual.dados.recursos_manual = true;
  manual.dados.passivos_versao = 2;
  const outroNome = perola();
  outroNome.dados.recursos = { usos: [{ nome: 'Outro nome', max: 1, recupera: 'amanhecer' }] };
  outroNome.dados.passivos_versao = 2;
  preencherRecursosDoAcervo({ inventario: [manual, outroNome] }, acervoPerola());
  assert.equal(manual.dados.recursos.usos[0].efeito, undefined);
  assert.equal(outroNome.dados.recursos.usos[0].efeito, undefined);
  // Migração: mesmo sem preencher o uso, a ficha antiga recebe a versão 4 (literal de propósito).
  assert.equal(manual.dados.passivos_versao, 4);
});

// ---- Bastão do Guardião do Pacto: mesmo fluxo, sem limite de círculo (Plano 10) ----

/** Bastão do Guardião do Pacto (variante +1 por padrão; o pai exige variante) montado do acervo real, equipado e sintonizado. */
function bastao(variante = 'bastao-do-guardiao-do-pacto-mais-1') {
  const pai = ACERVO.itens.find((i) => i.id === 'bastao-do-guardiao-do-pacto');
  const item = montarItemInventario({ item: pai, variante: pai.variantes.find((v) => v.id === variante), equipamentoPHB: [] });
  item.equipado = true;
  item.sintonizado = true;
  return item;
}

test('o acervo traz efeito sem circulo_max no Bastão e nas variantes; a Pérola segue com circulo_max 3', () => {
  const pai = ACERVO.itens.find((i) => i.id === 'bastao-do-guardiao-do-pacto');
  assert.equal(pai.recursos.usos[0].efeito, 'recuperar_espaco_magia');
  assert.equal(Object.hasOwn(pai.recursos.usos[0], 'circulo_max'), false);
  for (const v of ['bastao-do-guardiao-do-pacto-mais-1', 'bastao-do-guardiao-do-pacto-mais-2', 'bastao-do-guardiao-do-pacto-mais-3']) {
    const uso = recursosDoItem(bastao(v)).usos[0];
    assert.equal(uso.nome, NOME_USO, v);
    assert.equal(uso.efeito, 'recuperar_espaco_magia', v);
    assert.equal(Object.hasOwn(uso, 'circulo_max'), false, v);
  }
  assert.equal(recursosDoItem(perola()).usos[0].circulo_max, 3);
});

test('sem teto: valores ausentes, null e undefined listam todos os círculos gastos', () => {
  const reservas = [
    { fonte: 'conjuracao', circulo: 1, total: 4, usados: 1, disponiveis: 3 },
    { fonte: 'conjuracao', circulo: 4, total: 3, usados: 2, disponiveis: 1 },
    { fonte: 'pacto', circulo: 5, total: 2, usados: 1, disponiveis: 1 },
    { fonte: 'conjuracao', circulo: 9, total: 1, usados: 1, disponiveis: 0 },
    { fonte: 'conjuracao', circulo: 2, total: 3, usados: 0, disponiveis: 3 },
  ];
  for (const teto of [undefined, null]) {
    assert.deepEqual(espacosRecuperaveis(reservas, teto).map((o) => [o.fonte, o.circulo]), [['conjuracao', 1], ['conjuracao', 4], ['pacto', 5], ['conjuracao', 9]], String(teto));
  }
  assert.deepEqual(espacosRecuperaveis(reservas).map((o) => o.circulo), [1, 4, 5, 9]);
  // Com teto, o mesmo conjunto de reservas continua cortado.
  assert.deepEqual(espacosRecuperaveis(reservas, 3).map((o) => o.circulo), [1]);
});

test('Bastão: espaços de 1º, 4º e 9º gastos aparecem e o de 4º é restaurado; a Pérola recusa o de 4º', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 17 }]);
  for (const c of [1, 4, 9]) assert.equal(gastarEspaco(p, 'conjuracao', c), true);
  const uso = recursosDoItem(bastao()).usos[0];
  assert.deepEqual(espacosRecuperaveis(reservasDe(p), uso.circulo_max).map((o) => o.circulo), [1, 4, 9]);
  const item = bastao('bastao-do-guardiao-do-pacto-mais-1');
  const r = restaurarEspacoPorItem(p, item, NOME_USO, { fonte: 'conjuracao', circulo: 4 }, opcoesReais(p));
  assert.deepEqual(r, { ok: true, circulo: 4, fonte: 'conjuracao' });
  assert.equal(reservasDe(p).find((x) => x.circulo === 4).usados, 0);
  assert.equal(reservasDe(p).find((x) => x.circulo === 9).usados, 1);
  assert.equal(item.estado_recursos.usos[NOME_USO], 1);
  // Regressão do teto: a Pérola não restaura o espaço de 9º círculo.
  const rp = restaurarEspacoPorItem(p, perola(), NOME_USO, { fonte: 'conjuracao', circulo: 9 }, opcoesReais(p));
  assert.equal(rp.ok, false);
  assert.match(rp.erro, /fora das opções/);
});

test('Bastão: espaço de Pacto de 5º círculo entra na lista e é restaurado', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 9 }]);
  const pacto = reservasDe(p).find((r) => r.fonte === 'pacto');
  assert.equal(pacto.circulo, 5);
  assert.equal(gastarEspaco(p, 'pacto', 5), true);
  const lista = espacosRecuperaveis(reservasDe(p), undefined);
  assert.deepEqual(lista.map((o) => [o.fonte, o.circulo]), [['pacto', 5]]);
  const item = bastao();
  assert.equal(restaurarEspacoPorItem(p, item, NOME_USO, { fonte: 'pacto', circulo: 5 }, opcoesReais(p)).ok, true);
  assert.equal(reservasDe(p).find((x) => x.fonte === 'pacto').usados, 0);
});

test('Bastão sem espaço gasto: erro sem citar círculo e uso intacto', async () => {
  const p = await magoComGastos([]);
  const item = bastao();
  const r = restaurarEspacoPorItem(p, item, NOME_USO, { fonte: 'conjuracao', circulo: 1 }, opcoesReais(p));
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'Nenhum espaço de magia gasto.');
  assert.equal(item.estado_recursos?.usos?.[NOME_USO] || 0, 0);
});

test('mensagemSemEspaco cita o círculo só quando há teto', () => {
  assert.equal(mensagemSemEspaco(3), 'Nenhum espaço de magia gasto de 3º círculo ou inferior');
  assert.equal(mensagemSemEspaco(undefined), 'Nenhum espaço de magia gasto');
  assert.equal(mensagemSemEspaco(null), 'Nenhum espaço de magia gasto');
});

// ---- Preenchimento do efeito do Bastão em fichas antigas (passivos_versao 3) ----

const acervoBastao = () => ({ itens: [ACERVO.itens.find((i) => i.id === 'bastao-do-guardiao-do-pacto'), ACERVO.itens.find((i) => i.id === 'perola-do-poder')] });

test('Bastão e variante de ficha antiga (versão 3) recebem o efeito sem circulo_max, sem tocar o estado; segunda chamada devolve 0', () => {
  for (const variante of ['bastao-do-guardiao-do-pacto-mais-1', 'bastao-do-guardiao-do-pacto-mais-2']) {
    const antigo = bastao(variante);
    delete antigo.dados.recursos.usos[0].efeito;
    antigo.dados.passivos_versao = 3;
    antigo.estado_recursos = { usos: { [NOME_USO]: 1 } };
    const p = { inventario: [antigo] };
    assert.equal(preencherRecursosDoAcervo(p, acervoBastao()), 1, String(variante));
    const uso = antigo.dados.recursos.usos[0];
    assert.equal(uso.efeito, 'recuperar_espaco_magia', String(variante));
    assert.equal(Object.hasOwn(uso, 'circulo_max'), false, String(variante));
    // Migração 3 -> 4 (literal de propósito).
    assert.equal(antigo.dados.passivos_versao, 4);
    assert.deepEqual(antigo.estado_recursos, { usos: { [NOME_USO]: 1 } });
    assert.equal(preencherRecursosDoAcervo(p, acervoBastao()), 0, String(variante));
  }
});

test('o uso homônimo casa pelo magico_id: a Pérola de ficha antiga continua com circulo_max 3 e o Bastão sem', () => {
  const pe = perola();
  delete pe.dados.recursos.usos[0].efeito;
  delete pe.dados.recursos.usos[0].circulo_max;
  pe.dados.passivos_versao = 3;
  const ba = bastao();
  delete ba.dados.recursos.usos[0].efeito;
  ba.dados.passivos_versao = 3;
  assert.equal(preencherRecursosDoAcervo({ inventario: [pe, ba] }, acervoBastao()), 2);
  assert.equal(pe.dados.recursos.usos[0].circulo_max, 3);
  assert.equal(Object.hasOwn(ba.dados.recursos.usos[0], 'circulo_max'), false);
});
