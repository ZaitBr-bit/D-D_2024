// ============================================================
// Amuleto da Saúde (Constituição 19): o PV máximo sobe pela diferença de
// modificador × nível enquanto o item vale, e volta ao tirar.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse, subirAteNivel } from './harness.mjs';

const { levelup } = await modulosApp();const AMULETO = { nome: 'Amuleto da Saúde', tipo: 'magico', equipado: true, sintonizado: true,
  dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'constituicao', minimo: 19 }] } };

/** Guerreiro 5 com Constituição 14 (mod +2), PV cheio. */
async function guerreiro5() {
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  p.atributos.constituicao = 14;
  p.inventario = [];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_atual = p.pv_max;
  return p;
}

test('equipar e sintonizar o Amuleto: PV máximo +2 por nível (mod +2 → +4)', async () => {
  const p = await guerreiro5();
  const max = p.pv_max;
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  assert.equal(p.pv_max, max + 2 * 5);
  assert.equal(p.bonus_pv_itens_con_aplicado, 10);
});

test('tirar o Amuleto: PV máximo volta, PV atual não passa do máximo', async () => {
  const p = await guerreiro5();
  const max = p.pv_max;
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_atual = p.pv_max;
  p.inventario[0].equipado = false;
  levelup.sincronizarBonusPvNivel(p);
  assert.equal(p.pv_max, max);
  assert.ok(p.pv_atual <= p.pv_max);
  assert.equal(p.bonus_pv_itens_con_aplicado, 0);
});

test('Constituição 19 ou mais: o Amuleto não muda o PV', async () => {
  const p = await guerreiro5();
  p.atributos.constituicao = 20;
  levelup.sincronizarBonusPvNivel(p);
  const max = p.pv_max;
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  assert.equal(p.pv_max, max);
});

/** Alterna o Amuleto equipado e sincroniza o PV. */
function alternarAmuleto(p, equipado) {
  p.inventario[0].equipado = equipado;
  levelup.sincronizarBonusPvNivel(p);
}

test('Amuleto equipado mas não sintonizado: PV máximo não muda e o marcador fica 0', async () => {
  const p = await guerreiro5();
  const max = p.pv_max;
  p.inventario = [{ ...structuredClone(AMULETO), sintonizado: false }];
  levelup.sincronizarBonusPvNivel(p);
  assert.equal(p.pv_max, max);
  assert.equal(p.bonus_pv_itens_con_aplicado || 0, 0);
});

test('equipar com PV cheio: pv_max sobe, pv_atual não muda', async () => {
  const p = await guerreiro5();
  const atual = p.pv_atual;
  const max = p.pv_max;
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  assert.equal(p.pv_max, max + 10);
  assert.equal(p.pv_atual, atual);
});

test('tirar e recolocar o Amuleto com 2 PV: continua com 2 PV', async () => {
  const p = await guerreiro5();
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_atual = 2;
  alternarAmuleto(p, false);
  assert.equal(p.pv_atual, 2);
  alternarAmuleto(p, true);
  assert.equal(p.pv_atual, 2);
});

test('tirar e recolocar o Amuleto com 0 PV: não revive', async () => {
  const p = await guerreiro5();
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_atual = 0;
  alternarAmuleto(p, false);
  alternarAmuleto(p, true);
  assert.equal(p.pv_atual, 0);
});

test('PV cheio com o Amuleto: ao tirar, pv_atual é limitado ao novo máximo', async () => {
  const p = await guerreiro5();
  const max = p.pv_max;
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_atual = p.pv_max;
  alternarAmuleto(p, false);
  assert.equal(p.pv_max, max);
  assert.equal(p.pv_atual, max);
});

test('PV máximo temporário (Ajuda) acompanha o delta do Amuleto', async () => {
  const p = await guerreiro5();
  const base = p.pv_max;
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_max_override = p.pv_max + 5; // Ajuda: +5
  alternarAmuleto(p, false);
  assert.equal(p.pv_max, base);
  assert.equal(p.pv_max_override, base + 5, 'override desce junto');
  // Fim da magia: o override cai 5 (como em hp-descanso.js) e some.
  p.pv_max_override -= 5;
  if (p.pv_max_override <= p.pv_max) delete p.pv_max_override;
  assert.equal(p.pv_max, base);
  assert.equal(p.pv_max_override, undefined);
  // Equipar com override ativo: sobem pv_max e override.
  p.pv_max_override = p.pv_max + 5;
  alternarAmuleto(p, true);
  assert.equal(p.pv_max, base + 10);
  assert.equal(p.pv_max_override, base + 15);
});

test('Amuleto que cai com override: override que não supera o máximo é removido', async () => {
  const p = await guerreiro5();
  const base = p.pv_max;
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_max_override = p.pv_max; // não supera o máximo; ao descer o delta, fica abaixo dele
  alternarAmuleto(p, false);
  assert.equal(p.pv_max, base);
  assert.equal(p.pv_max_override, undefined);
});

test('editar a Constituição-base com o Amuleto: PV máximo líquido não muda e o atual também não (47/54 fica 47)', async () => {
  const p = await guerreiro5();
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_atual = 47;
  const max = p.pv_max;
  // Constituição-base 14 -> 16 (mod +2 -> +3); em jogo continua 19 (mod +4).
  const jogoAntes = levelup.modConEmJogo(p);
  p.atributos.constituicao = 16;
  levelup.aplicarPvRetroativoPorCon(p, 2, 3, { antes: jogoAntes, depois: levelup.modConEmJogo(p) });
  levelup.sincronizarBonusPvNivel(p);
  assert.equal(p.pv_max, max);
  assert.equal(p.pv_atual, 47);
});

test('editar a Constituição-base de 14 para 20 com o Amuleto: o atual sobe só o ganho em jogo (mod 4 -> 5)', async () => {
  const p = await guerreiro5();
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_atual = 47;
  const max = p.pv_max;
  const jogoAntes = levelup.modConEmJogo(p);
  p.atributos.constituicao = 20;
  levelup.aplicarPvRetroativoPorCon(p, 2, 5, { antes: jogoAntes, depois: levelup.modConEmJogo(p) });
  levelup.sincronizarBonusPvNivel(p);
  assert.equal(p.pv_max, max + 5, '+1 de modificador em jogo x 5 níveis');
  assert.equal(p.pv_atual, 52);
});

test('sem item de Constituição: o PV atual continua acompanhando o máximo (sem o 4º argumento)', async () => {
  const p = await guerreiro5();
  p.pv_atual = 30;
  p.atributos.constituicao = 16;
  levelup.aplicarPvRetroativoPorCon(p, 2, 3);
  assert.equal(p.pv_atual, 35);
});

/** Guerreiro 5 com Constituição-base `con`, o Amuleto equipado e PV cheio. */
async function guerreiro5ComAmuleto(con) {
  const p = await guerreiro5();
  p.atributos.constituicao = con;
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_atual = p.pv_max;
  return p;
}

/** Muda a Constituição-base como a edição manual da ficha (retroativo com o modificador em jogo) e sincroniza. */
function editarCon(p, para) {
  const modAntes = Math.floor((p.atributos.constituicao - 10) / 2);
  const jogoAntes = levelup.modConEmJogo(p);
  p.atributos.constituicao = para;
  levelup.aplicarPvRetroativoPorCon(p, modAntes, Math.floor((para - 10) / 2), { antes: jogoAntes, depois: levelup.modConEmJogo(p) });
  levelup.sincronizarBonusPvNivel(p);
}

test('Amuleto: editar a Con-base para cima e reverter devolve o mesmo PV (cheio fica cheio)', async () => {
  const p = await guerreiro5ComAmuleto(14);
  const { pv_max: max, pv_atual: atual } = p;
  editarCon(p, 16);
  assert.deepEqual([p.pv_atual, p.pv_max], [atual, max]);
  editarCon(p, 14);
  assert.deepEqual([p.pv_atual, p.pv_max], [atual, max], 'reverter não tira PV');
});

test('Amuleto: Con-base 14 → 18 → 12 não muda PV atual nem máximo (a Con em jogo é sempre 19)', async () => {
  const p = await guerreiro5ComAmuleto(14);
  const { pv_max: max, pv_atual: atual } = p;
  editarCon(p, 18);
  editarCon(p, 12);
  assert.deepEqual([p.pv_atual, p.pv_max], [atual, max]);
});

test('Amuleto: Con-base 16 → 14 com PV parcial mantém o atual', async () => {
  const p = await guerreiro5ComAmuleto(16);
  p.pv_atual = p.pv_max - 7;
  const { pv_max: max, pv_atual: atual } = p;
  editarCon(p, 14);
  assert.deepEqual([p.pv_atual, p.pv_max], [atual, max]);
});

test('Amuleto: Con-base 20 → 14 com PV cheio cai só o que o modificador em jogo caiu (20 → 19: -1 por nível)', async () => {
  const p = await guerreiro5ComAmuleto(20);
  const max = p.pv_max;
  editarCon(p, 14);
  assert.equal(p.pv_max, max - 5);
  assert.equal(p.pv_atual, max - 5, 'cheio continua cheio');
});

test('Amuleto: redução da Con-base por item (16 → 14) com PV cheio não tira PV', async () => {
  const { aplicarAumentoPermanente } = await import('../../../site/js/regras-aumento-atributo.js');
  const p = await guerreiro5ComAmuleto(16);
  const { pv_max: max, pv_atual: atual } = p;
  const livro = { nome: 'Livro da Escuridão Vil', dados: { aumento_permanente: { atributo: 'escolha', valor: 2, maximo: 24, reducao: { valor: 2, minimo: 3 } } } };
  assert.equal(aplicarAumentoPermanente(p, livro, { atributo: 'carisma', reduzir: 'constituicao' }).ok, true);
  levelup.sincronizarBonusPvNivel(p);
  assert.equal(p.atributos.constituicao, 14);
  assert.deepEqual([p.pv_atual, p.pv_max], [atual, max]);
});

/** Bárbaro 11 com Con 17 e o Amuleto equipado, PV atual abaixo do máximo, pronto para o ASI do nível 12. */
async function barbaro11ComAmuleto() {
  const p = await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 1 }]);
  p.talentos = [];
  await subirAteNivel(p, 'Bárbaro', 11);
  p.atributos.constituicao = 17;
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_atual = Math.floor(p.pv_max / 2);
  return p;
}

test('ASI de Constituição com o Amuleto: o PV atual fica igual ao de um ASI em outro atributo', async () => {
  const p = await barbaro11ComAmuleto();
  const ref = await barbaro11ComAmuleto();
  const r = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Bárbaro', talento: 'Aumento no Valor de Atributo', aumentos_atributo: { constituicao: 1, forca: 1 } });
  const rRef = await levelup.subirDeNivel(ref, { ignorar_xp: true, classe: 'Bárbaro', talento: 'Aumento no Valor de Atributo', aumentos_atributo: { destreza: 1, forca: 1 } });
  assert.ok(r.sucesso && rRef.sucesso);
  assert.equal(p.atributos.constituicao, 18);
  assert.equal(p.pv_max, ref.pv_max, 'o máximo líquido é o mesmo: Con em jogo continua 19');
  assert.equal(p.pv_atual, ref.pv_atual, 'o ASI na base não cura com o Amuleto');
});

test('talento com +1 de Constituição (Resistente) com o Amuleto: o PV atual fica igual ao de outro talento', async () => {
  const p = await barbaro11ComAmuleto();
  const ref = await barbaro11ComAmuleto();
  const r = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Bárbaro', talento: 'Resistente', talento_asi: 'constituicao' });
  const rRef = await levelup.subirDeNivel(ref, { ignorar_xp: true, classe: 'Bárbaro', talento: 'Sentinela', talento_asi: 'forca' });
  assert.ok(r.sucesso && rRef.sucesso, r.erro || rRef.erro);
  assert.equal(p.atributos.constituicao, 18);
  assert.equal(p.pv_max, ref.pv_max);
  assert.equal(p.pv_atual, ref.pv_atual, 'o +1 de Con do talento na base não cura com o Amuleto');
});

test('capstone do Bárbaro com o Amuleto: o PV atual não ganha o retroativo da Constituição-base', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 1 }]);
  p.talentos = [];
  await subirAteNivel(p, 'Bárbaro', 19);
  p.atributos.constituicao = 17;
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_atual = 100;
  const max = p.pv_max;
  const r = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Bárbaro' });
  assert.ok(r.sucesso, r.erro);
  assert.equal(p.atributos.constituicao, 21);
  // Em jogo a Constituição vai de 19 (mod +4) a 21 (mod +5): +1 por nível (20), não os +2 por nível da base (17 -> 21).
  assert.equal(p.pv_atual - 100, r.hp_ganho + 20, 'ganho do nível + só a variação do modificador em jogo');
  assert.ok(p.pv_max > max);
});

test('prévia de PV da subida usa a Constituição em jogo: com o Amuleto anuncia o que o máximo realmente sobe', async () => {
  const { levelupFlow, db } = await modulosApp();
  const p = await guerreiro5();
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  const maxAntes = p.pv_max;
  const classeData = await db.getClasse('Guerreiro');
  const ctx = await levelupFlow.buildLevelUpContext(p, classeData, {}, 'Guerreiro');
  assert.equal(ctx.modCon, 4, 'Con 19 em jogo: modificador +4, não o +2 da base 14');
  assert.equal(ctx.hpGanhoFixo, 10, 'd10: 6 (média) + 4');
  const r = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Guerreiro', talento: 'Aumento no Valor de Atributo', aumentos_atributo: { forca: 1, destreza: 1 } });
  assert.ok(r.sucesso, r.erro || r.tipo_pendencia);
  assert.equal(p.pv_max - maxAntes, ctx.hpGanhoFixo, 'o máximo sobe exatamente o que a prévia anunciou');
  assert.equal(r.hp_ganho, 8, 'o PV atual sobe só o ganho da base');
  assert.equal(r.hp_ganho_item_con, 2, 'o resto do máximo vem do item');
  assert.equal(r.hp_ganho + r.hp_ganho_item_con, ctx.hpGanhoFixo, 'a tela de resultado soma os dois: o mesmo número da prévia');
});

test('resultado da subida com ASI de Constituição e Amuleto: a tela mostra máximo +10 e PV atual +8', async () => {
  const p = await guerreiro5();
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_atual = p.pv_max - 7;
  const [maxAntes, atualAntes] = [p.pv_max, p.pv_atual];
  const r = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Guerreiro', talento: 'Aumento no Valor de Atributo', aumentos_atributo: { constituicao: 2 } });
  assert.ok(r.sucesso, r.erro || r.tipo_pendencia);
  assert.equal(p.atributos.constituicao, 16);
  // Valores esperados à mão: nível 6, Con em jogo 19 (mod +4) antes e depois; bônus do item cai de (4-2)*5=10 para (4-3)*6=6.
  assert.equal(p.pv_max - maxAntes, 10, 'o máximo sobe 10 (8 do nível + 6 retroativo - 4 do bônus do item)');
  assert.equal(p.pv_atual - atualAntes, 8, 'o PV atual sobe só o ganho do nível');
  assert.equal(r.hp_ganho_item_con, -4);
  assert.deepEqual(levelup.ganhoPvDoResultado(r), { maximo: 10, atual: 8, porItem: true });
});

test('ganhoPvDoResultado: sem item vale o ganho do nível; com item usa as variações medidas', () => {
  assert.deepEqual(levelup.ganhoPvDoResultado({ hp_ganho: 8, hp_ganho_item_con: 0, pv_max_delta: 14, pv_atual_delta: 14 }), { maximo: 8, atual: 8, porItem: false });
  assert.deepEqual(levelup.ganhoPvDoResultado({ hp_ganho: 8, hp_ganho_item_con: -4, pv_max_delta: 10, pv_atual_delta: 8 }), { maximo: 10, atual: 8, porItem: true });
  // Sem as variações medidas: ganho + retroativo + item.
  assert.deepEqual(levelup.ganhoPvDoResultado({ hp_ganho: 8, hp_ganho_item_con: -4, bonus_con_retroativo: 6 }), { maximo: 10, atual: 8, porItem: true });
});

test('sincronizar duas vezes não soma duas vezes', async () => {
  const p = await guerreiro5();
  p.inventario = [structuredClone(AMULETO)];
  levelup.sincronizarBonusPvNivel(p);
  const max = p.pv_max;
  levelup.sincronizarBonusPvNivel(p);
  assert.equal(p.pv_max, max);
});
