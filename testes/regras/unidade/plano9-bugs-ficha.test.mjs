// ============================================================
// Plano 9, Task 1 -- quatro bugs de ficha:
//  1.1 rótulo "(Rolado: N)" do resumo do level-up (hp_modo);
//  1.2 aumento de Constituição por talento/dádiva ajusta o PV;
//  1.3 Exaustão reduz as velocidades extras fixas;
//  1.4 Visão às Cegas do Guardião em multiclasse.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { lerTalentosDados, modulosApp, personagemMulticlasse } from './harness.mjs';

const mods = await modulosApp();
const { levelup, sheetEstado } = mods;
const combate = await import('../../../site/js/sheet/combate.js');
const condicoes = await import('../../../site/js/sheet/condicoes.js');
const levelupUi = await import('../../../site/js/levelup-ui.js');
const sheetTalentos = await import('../../../site/js/sheet/talentos.js');
const talentoDados = (nome) => lerTalentosDados().find(x => x.nome === nome);

/** Item mágico equipado e sintonizado com os efeitos dados. */
function item(nome, efeitos) {
  return { nome, tipo: 'magico', equipado: true, sintonizado: true, dados: { magico_id: nome.toLowerCase(), requer_sintonizacao: true, efeitos } };
}
const AMULETO = () => item('Amuleto da Saúde', [{ alvo: 'atributo', atributo: 'constituicao', minimo: 19 }]);

/** Define o personagem do estado da ficha e devolve-o. */
async function usar(roteiro, ajustar) {
  const p = await personagemMulticlasse(roteiro);
  if (ajustar) ajustar(p);
  sheetEstado.definirChar(p);
  return p;
}

// ------------------------------------------------------------ 1.1

test('1.1 resumo do level-up: HP rolado mostra "(Rolado: N)" e HP fixo mostra "(Valor Fixo)"', async () => {
  assert.equal(levelupUi.rotuloModoHp({ hp_modo: 'rolado', hp_rolado: 7 }), '(Rolado: 7)');
  assert.equal(levelupUi.rotuloModoHp({ hp_modo: 'fixo', hp_rolado: null }), '(Valor Fixo)');
  // Resultado real do motor: o rótulo vem do objeto que subirDeNivel devolve.
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 1 }]);
  const r = await levelup.subirDeNivel(p, { ignorar_xp: true, hp_modo: 'rolado', hp_rolado: 7 });
  assert.equal(r.sucesso, true, JSON.stringify(r));
  assert.equal(levelupUi.rotuloModoHp(r), '(Rolado: 7)');
  const p2 = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 1 }]);
  const r2 = await levelup.subirDeNivel(p2, { ignorar_xp: true });
  assert.equal(levelupUi.rotuloModoHp(r2), '(Valor Fixo)');
});

// ------------------------------------------------------------ 1.2

/** Guerreiro 5 com Constituição 14 (mod +2), PV cheio. */
async function guerreiro5() {
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  p.atributos.constituicao = 14;
  p.inventario = [];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_atual = p.pv_max;
  return p;
}

test('1.2 comAjustePvPorCon: Con 14 para 16 sem item sobe máximo e atual em 1 por nível', async () => {
  const p = await guerreiro5();
  const max = p.pv_max;
  p.pv_atual = max - 3;
  levelup.comAjustePvPorCon(p, () => { p.atributos.constituicao = 16; });
  assert.equal(p.pv_max, max + 5);
  assert.equal(p.pv_atual, max - 3 + 5);
});

test('1.2 comAjustePvPorCon: Con sem mudança de modificador (14 para 15) não mexe no PV', async () => {
  const p = await guerreiro5();
  const max = p.pv_max;
  levelup.comAjustePvPorCon(p, () => { p.atributos.constituicao = 15; });
  assert.equal(p.pv_max, max);
  assert.equal(p.pv_atual, max);
});

test('1.2 comAjustePvPorCon: com Amuleto da Saúde o PV atual não muda, e o máximo acompanha a base', async () => {
  const p = await guerreiro5();
  p.inventario = [AMULETO()];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_atual = p.pv_max - 4;
  const atual = p.pv_atual;
  const max = p.pv_max;
  levelup.comAjustePvPorCon(p, () => { p.atributos.constituicao = 16; });
  assert.equal(p.pv_atual, atual, 'Constituição em jogo continua 19: PV atual intacto');
  assert.equal(p.pv_max, max + 5, 'máximo acompanha a base; o bônus do item é reacertado pela sincronização');
  levelup.sincronizarBonusPvNivel(p);
  assert.equal(p.pv_atual, atual);
});

test('1.2 dádiva "Aumento no Valor de Atributo" (nível 20) em Con 14 para 16: PV sobe 1 por nível', async () => {
  const dadosTalentos = await mods.db.getTalentos();
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 20 }]);
  p.atributos.constituicao = 14;
  levelup.sincronizarBonusPvNivel(p);
  p.pv_atual = p.pv_max;
  const max = p.pv_max;
  const r = levelup.registrarDadivaEpicaLegada(
    p, { talento: 'Aumento no Valor de Atributo', aumentos_atributo: { constituicao: 2 } }, dadosTalentos);
  assert.equal(r.sucesso, true, JSON.stringify(r));
  assert.equal(p.atributos.constituicao, 16);
  assert.equal(p.pv_max, max + 20);
  assert.equal(p.pv_atual, max + 20);
});

test('1.2 dádiva com Amuleto da Saúde: PV atual não muda', async () => {
  const dadosTalentos = await mods.db.getTalentos();
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 20 }]);
  p.atributos.constituicao = 14;
  p.inventario = [AMULETO()];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_atual = p.pv_max - 10;
  const atual = p.pv_atual;
  const r = levelup.registrarDadivaEpicaLegada(
    p, { talento: 'Aumento no Valor de Atributo', aumentos_atributo: { constituicao: 2 } }, dadosTalentos);
  assert.equal(r.sucesso, true, JSON.stringify(r));
  assert.equal(p.pv_atual, atual);
});

// ------------------------------------------------------------ 1.3

const ANEL_NATACAO = () => item('Anel de Natação', [{ alvo: 'deslocamento', modo: 'natacao', metros: 12 }]);

test('1.3 Exaustão 2 reduz a Natação fixa de item em 3 m (12 para 9) junto do Deslocamento', async () => {
  await usar([{ classe: 'Guerreiro', nivel: 1 }], (p) => { p.exaustao = 2; p.inventario = [ANEL_NATACAO()]; });
  assert.equal(combate.getDeslocamentoFinal('9 metros'), '6 metros (Natação 9m)');
});

test('1.3 Exaustão 2 reduz Voo e Levitação fixos de efeito mágico', async () => {
  await usar([{ classe: 'Guerreiro', nivel: 1 }], (p) => {
    p.exaustao = 2;
    p.efeitos_magicos = [
      { tipo: 'deslocamento', tipo_velocidade: 'voo', valor_metros: 18 },
      { tipo: 'deslocamento', tipo_velocidade: 'levitacao', valor_metros: 6 }
    ];
  });
  assert.equal(combate.getDeslocamentoFinal('9 metros'), '6 metros (Voo 15m, Levitação 3m)');
});

test('1.3 velocidade fixa que chega a 0 some; Exaustão 4 com Natação 6 m deixa só o Deslocamento', async () => {
  await usar([{ classe: 'Guerreiro', nivel: 1 }], (p) => {
    p.exaustao = 4;
    p.inventario = [item('Anel de Natação', [{ alvo: 'deslocamento', modo: 'natacao', metros: 6 }])];
  });
  assert.equal(combate.getDeslocamentoFinal('9 metros'), '3 metros');
});

test('1.3 Exaustão 6: Deslocamento 0 e nenhuma velocidade extra', async () => {
  await usar([{ classe: 'Guerreiro', nivel: 1 }], (p) => { p.exaustao = 6; p.inventario = [ANEL_NATACAO()]; });
  assert.equal(combate.getDeslocamentoFinal('9 metros'), '0 metros');
});

test('1.3 contraste: sem Exaustão a Natação fixa continua 12 m', async () => {
  await usar([{ classe: 'Guerreiro', nivel: 1 }], (p) => { p.inventario = [ANEL_NATACAO()]; });
  assert.equal(combate.getDeslocamentoFinal('9 metros'), '9 metros (Natação 12m)');
});

// ------------------------------------------------------------ 1.4

test('1.4 Ladino 1 / Guardião 18 com Sentidos Selvagens mostra Visão às Cegas 9 m', async () => {
  await usar([{ classe: 'Ladino', nivel: 1 }, { classe: 'Guardião', nivel: 18 }]);
  const html = condicoes.renderSecaoSentidos();
  assert.match(html, /<span class="pericia-bonus">9 m<\/span>\s*<span class="pericia-nome">Visão às Cegas<\/span>/);
});

test('1.4 Guardião puro 18 mostra Visão às Cegas 9 m', async () => {
  await usar([{ classe: 'Guardião', nivel: 18 }]);
  assert.match(condicoes.renderSecaoSentidos(), /Visão às Cegas/);
});

test('1.4 Ladino 1 / Guardião 17 não mostra Visão às Cegas', async () => {
  await usar([{ classe: 'Ladino', nivel: 1 }, { classe: 'Guardião', nivel: 17 }]);
  assert.doesNotMatch(condicoes.renderSecaoSentidos(), /Visão às Cegas/);
});

// ------------------------------------------------------------ 1.2 talento com ASI de Constituição (caminho de persistirTalento)

/** Ladino 5 com Constituição 15 (mod +2) e PV cheio; sem Resiliente de Con ainda. */
async function ladino5Con15(comAmuleto) {
  const p = await personagemMulticlasse([{ classe: 'Ladino', nivel: 5 }]);
  p.atributos.constituicao = 15;
  p.inventario = comAmuleto ? [AMULETO()] : [];
  p.talentos = [];
  levelup.sincronizarBonusPvNivel(p);
  p.pv_atual = p.pv_max;
  return p;
}
const ESC_RESILIENTE = { atributo: 'constituicao', talento_asi: 'constituicao' };
const aplicarResiliente = (p) => sheetTalentos.aplicarTalentoNaFicha(p, {
  nome: 'Resiliente', talento: talentoDados('Resiliente'), atributoASI: 'constituicao', escolhas: ESC_RESILIENTE });

test('1.2 talento Resiliente (Con 15 para 16) sem item: PV máximo e atual +5 e salvaguarda de Con', async () => {
  const p = await ladino5Con15(false);
  const max = p.pv_max;
  const r = aplicarResiliente(p);
  assert.equal(r.sucesso, true, JSON.stringify(r));
  assert.equal(p.atributos.constituicao, 16);
  assert.equal(p.pv_max, max + 5);
  assert.equal(p.pv_atual, max + 5);
  assert.ok(p.salvaguardas_proficientes.includes('Constituição'));
  assert.ok(p.talentos.includes('Resiliente'));
});

test('1.2 talento Resiliente (Con 15 para 16) com Amuleto da Saúde: PV atual e máximo não mudam', async () => {
  const p = await ladino5Con15(true);
  const max = p.pv_max;
  const atual = p.pv_atual;
  const r = aplicarResiliente(p);
  assert.equal(r.sucesso, true, JSON.stringify(r));
  levelup.sincronizarBonusPvNivel(p);
  assert.equal(p.pv_atual, atual);
  assert.equal(p.pv_max, max);
});

test('1.2 rollback: efeito do talento que falha depois do aumento restaura atributos, PV e talentos', async () => {
  const p = await ladino5Con15(false);
  const antes = structuredClone({ a: p.atributos, max: p.pv_max, atual: p.pv_atual, ed: p.edicoes, t: p.talentos });
  // Habilidoso sem escolhas: o efeito recusa, depois do ASI de Constituição já aplicado.
  const r = sheetTalentos.aplicarTalentoNaFicha(p, {
    nome: 'Habilidoso', talento: talentoDados('Resiliente'), atributoASI: 'constituicao', escolhas: {} });
  assert.equal(r.sucesso, false);
  assert.deepEqual(p.atributos, antes.a);
  assert.equal(p.pv_max, antes.max);
  assert.equal(p.pv_atual, antes.atual);
  assert.deepEqual(p.edicoes, antes.ed);
  assert.deepEqual(p.talentos, antes.t);
});

// ------------------------------------------------------------ 1.3 (I2 e M1)

test('1.3 item com velocidade igual ao Deslocamento não é reduzido em dobro pela Exaustão', async () => {
  await usar([{ classe: 'Guerreiro', nivel: 1 }], (p) => {
    p.exaustao = 2;
    p.inventario = [item('Botas de Escalada', [{ alvo: 'deslocamento', modo: 'escalada', igual_deslocamento: true }])];
  });
  assert.equal(combate.getDeslocamentoFinal('9 metros'), '6 metros (Escalada 6m)');
});

test('1.3 Natação fixa de efeito mágico com Exaustão 2: 12 m para 9 m', async () => {
  await usar([{ classe: 'Guerreiro', nivel: 1 }], (p) => {
    p.exaustao = 2;
    p.efeitos_magicos = [{ tipo: 'deslocamento', tipo_velocidade: 'natacao', valor_metros: 12 }];
  });
  assert.equal(combate.getDeslocamentoFinal('9 metros'), '6 metros (Natação 9m)');
});
