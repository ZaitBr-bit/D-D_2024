// ============================================================
// Motor da edição manual de atributos (issue #13).
//
// A pergunta aqui é: o app consegue separar o que o JOGADOR ajustou à mão
// do que o SISTEMA concedeu? Sem essa separação, o "+1 manual" que a ficha
// promete mostrar seria indistinguível do +1 de um aumento de nível, e a
// primeira subida de nível apagaria a marca.
//
// O mecanismo é o de `site/js/ficha-edicoes.js`, que já guardava um
// `original` por caminho editado e já deslocava esse `original` quando o
// ganho vinha do sistema (`aplicarDeltaSistema`). O que falta, e o que este
// motor cobra, é o mapa `manual` -- o número do ajuste livre, acumulado.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { charBase, modulosApp } from './harness.mjs';

const { fichaEdicoes, fichaEdicaoValidacoes } = await modulosApp();

/** Personagem de nível 4 com Destreza 16 (base 16, sem bônus de antecedente). */
async function personagemDeTeste() {
  const p = await charBase();
  p.atributos_base = { forca: 10, destreza: 16, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 10 };
  p.atributos = { ...p.atributos_base };
  p.bonus_antecedente = {};
  p.pv_max = 30;
  p.pv_atual = 30;
  return p;
}

/** Aplica um ajuste livre de atributos como o modal fará, e devolve o personagem. */
function ajustarAMao(p, alvos) {
  const antes = { ...p.atributos };
  const proposta = { ...antes, ...alvos };
  const deltas = Object.fromEntries(Object.keys(proposta).map(k => [k, proposta[k] - antes[k]]));
  fichaEdicoes.consolidarEdicoesAtributos(p);
  fichaEdicoes.aplicarEdicao(p, 'atributos', proposta);
  fichaEdicoes.registrarAjusteManualAtributos(p, deltas);
  fichaEdicoes.consolidarEdicoesAtributos(p);
  return p;
}

test('ajuste livre grava o delta e não toca a base', async () => {
  const p = ajustarAMao(await personagemDeTeste(), { destreza: 17 });
  assert.equal(p.atributos.destreza, 17, 'o total deveria refletir o valor digitado');
  assert.equal(p.atributos_base.destreza, 16, 'a base NÃO deve mudar na edição livre');
  assert.deepEqual(fichaEdicoes.deltaManualAtributos(p), { destreza: 1 });
});

test('dois ajustes livres seguidos acumulam', async () => {
  const p = ajustarAMao(await personagemDeTeste(), { destreza: 17 });
  ajustarAMao(p, { destreza: 18 });
  assert.deepEqual(fichaEdicoes.deltaManualAtributos(p), { destreza: 2 });
});

test('voltar ao valor original limpa o rastro inteiro', async () => {
  const p = ajustarAMao(await personagemDeTeste(), { destreza: 18 });
  ajustarAMao(p, { destreza: 16 });
  assert.deepEqual(fichaEdicoes.deltaManualAtributos(p), {}, 'sem ajuste líquido, sem marca');
  assert.equal(p.edicoes.campos.atributos, undefined, 'a entrada de grupo deveria ter sido apagada');
});

test('redistribuição pelo método NÃO vira ajuste manual', async () => {
  const p = await personagemDeTeste();
  // O caminho do método (sheet/edicao.js) chama aplicarEdicao sem registrar
  // ajuste manual: troca 16 e 10 de lugar entre destreza e força.
  fichaEdicoes.aplicarEdicao(p, 'atributos_base', { ...p.atributos_base, forca: 16, destreza: 10 });
  fichaEdicoes.aplicarEdicao(p, 'atributos', { ...p.atributos, forca: 16, destreza: 10 });
  assert.deepEqual(fichaEdicoes.deltaManualAtributos(p), {}, 'redistribuir não é editar à mão');
});

test('ganho do sistema preserva o delta manual', async () => {
  const p = ajustarAMao(await personagemDeTeste(), { destreza: 17 });
  fichaEdicoes.aplicarDeltaSistema(p, 'atributos.destreza', 1, 20);
  assert.equal(p.atributos.destreza, 18, 'o aumento de nível soma ao total');
  assert.deepEqual(fichaEdicoes.deltaManualAtributos(p), { destreza: 1 },
    'o +1 do sistema não pode virar +2 manual');
  assert.equal(p.edicoes.campos.atributos.original.destreza, 17,
    'aplicarDeltaSistema deveria ter deslocado o original junto');
});

test('validação livre aceita 1 a 20 e recusa fora disso', () => {
  const seis = v => ({ forca: 10, destreza: v, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10 });
  assert.equal(fichaEdicaoValidacoes.validarAtributosManuais(seis(20)).ok, true);
  assert.equal(fichaEdicaoValidacoes.validarAtributosManuais(seis(1)).ok, true);
  assert.equal(fichaEdicaoValidacoes.validarAtributosManuais(seis(21)).ok, false);
  assert.equal(fichaEdicaoValidacoes.validarAtributosManuais(seis(0)).ok, false);
  assert.equal(fichaEdicaoValidacoes.validarAtributosManuais(seis(16.5)).ok, false);
  assert.equal(fichaEdicaoValidacoes.validarAtributosManuais({ forca: 10 }).ok, false,
    'menos de seis chaves deve ser recusado');
});

// ------------------------------------------------------------
// PV retroativo por Constituição.
//
// A regra do livro que o level-up já aplicava (levelup.js:1517-1524) só
// tratava AUMENTO, porque subir de nível nunca derruba Constituição. A
// edição manual derruba: sem o caminho de volta, subir CON à mão, ganhar PV e
// depois reverter deixaria o personagem com PV inflado para sempre -- um bug
// de moeda que só apareceria semanas depois, sem rastro de origem.
// ------------------------------------------------------------
const { levelup } = await modulosApp();

test('modificador de CON que sobe soma PV por nível', async () => {
  const p = await personagemDeTeste();   // nível 4, pv_max 30
  const aplicado = levelup.aplicarPvRetroativoPorCon(p, 2, 3);
  assert.equal(aplicado, 4, '+1 de modificador vale +1 PV por nível (4 níveis)');
  assert.equal(p.pv_max, 34);
  assert.equal(p.pv_atual, 34);
});

test('modificador de CON que cai devolve os mesmos PV', async () => {
  const p = await personagemDeTeste();
  levelup.aplicarPvRetroativoPorCon(p, 2, 3);
  levelup.aplicarPvRetroativoPorCon(p, 3, 2);
  assert.equal(p.pv_max, 30, 'ida e volta tem de fechar no valor original');
  assert.equal(p.pv_atual, 30);
});

test('PV máximo nunca cai abaixo de 1 e o atual nunca passa do teto', async () => {
  const p = await personagemDeTeste();
  p.pv_max = 3;
  p.pv_atual = 3;
  levelup.aplicarPvRetroativoPorCon(p, 3, -1);   // -4 de modificador x 4 níveis
  assert.equal(p.pv_max, 1, 'o piso de 1 PV máximo tem de segurar');
  assert.equal(p.pv_atual, 1);
});

test('modificador que não muda não mexe em nada', async () => {
  const p = await personagemDeTeste();
  assert.equal(levelup.aplicarPvRetroativoPorCon(p, 2, 2), 0);
  assert.equal(p.pv_max, 30);
});

// ------------------------------------------------------------
// Achado Important 2 da revisão de 2026-08-22: personagem a 0 PV está
// inconsciente/caindo -- um estado real do jogo, não um erro a corrigir. O
// piso antigo (Math.max(1, ...) sobre `pv_atual || 1`) lia um 0 como 1 e
// devolvia sempre pelo menos 1, "ressuscitando" em silêncio qualquer
// personagem a 0 PV cujo modificador de Constituição mudasse -- para CIMA
// ou para BAIXO, já que `0 || 1` já é 1 antes mesmo de somar o delta. Só
// cura de verdade pode tirar alguém de 0; um recálculo de atributo não
// pode. Estes testes IAM FALHAR (RED) contra o código antigo em ambas as
// direções -- ver evidência no relatório da fix wave.
// ------------------------------------------------------------

test('personagem a 0 PV continua a 0 quando o modificador de CON cai (achado Important 2)', async () => {
  const p = await personagemDeTeste();   // nível 4, pv_max 30
  p.pv_atual = 0;
  const aplicado = levelup.aplicarPvRetroativoPorCon(p, 2, 1);
  assert.equal(aplicado, -4, 'o PV máximo ainda se move normalmente');
  assert.equal(p.pv_max, 26);
  assert.equal(p.pv_atual, 0, 'o piso antigo de 1 ressuscitava o personagem aqui');
});

test('personagem a 0 PV continua a 0 quando o modificador de CON sobe (achado Important 2)', async () => {
  const p = await personagemDeTeste();   // nível 4, pv_max 30
  p.pv_atual = 0;
  const aplicado = levelup.aplicarPvRetroativoPorCon(p, 2, 3);
  assert.equal(aplicado, 4, 'o PV máximo ainda se move normalmente');
  assert.equal(p.pv_max, 34);
  assert.equal(p.pv_atual, 0,
    'um recálculo de atributo não é cura -- só um pv_atual explicitamente movido pode tirar alguém de 0');
});

test('PV atual maior que 0 nunca é empurrado abaixo de 0 (só personagens JÁ a 0 ficam presos em 0)', async () => {
  const p = await personagemDeTeste();
  p.pv_max = 10;
  p.pv_atual = 2;
  levelup.aplicarPvRetroativoPorCon(p, 3, -2);   // -5 de modificador x 4 níveis
  assert.equal(p.pv_max, 1, 'o piso de 1 PV máximo segura');
  assert.equal(p.pv_atual, 0, 'pv_atual não pode ficar negativo, mesmo partindo de um valor positivo');
});
