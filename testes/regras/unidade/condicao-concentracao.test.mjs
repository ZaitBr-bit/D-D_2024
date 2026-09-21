// ============================================================
// Issue #94, Fase 4 -- quebrarConcentracaoAtiva (extraída do botão manual
// "Quebrar" em hp-descanso.js) reverte o bônus de PV máximo temporário e
// remove os efeitos concentrados. Usada tanto pelo botão manual quanto,
// automaticamente, ao marcar Incapacitado no gerenciador de condições
// ("Concentração interrompida", glossário de condições).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

await modulosApp();
const sheetHpDescanso = await import('../../../site/js/sheet/hp-descanso.js');
const GUERREIRO_1 = [{ classe: 'Guerreiro', nivel: 1 }];

async function personagemConcentrando(efeitoExtra = {}) {
  const { sheetEstado } = await modulosApp();
  const p = await personagemMulticlasse(GUERREIRO_1);
  p.condicoes = [];
  p.efeitos_magicos = [{ nome: 'Armadura Arcana', concentracao: true, tipo: 'buff_arma', ...efeitoExtra }];
  sheetEstado.definirChar(p);
  return p;
}

test('quebrarConcentracaoAtiva remove o efeito concentrado e devolve o nome', async () => {
  const p = await personagemConcentrando();
  const nome = sheetHpDescanso.quebrarConcentracaoAtiva();
  assert.equal(nome, 'Armadura Arcana');
  assert.equal((p.efeitos_magicos || []).length, 0);
});

test('quebrarConcentracaoAtiva sem concentração ativa devolve null e não mexe em nada', async () => {
  const { sheetEstado } = await modulosApp();
  const p = await personagemMulticlasse(GUERREIRO_1);
  p.condicoes = [];
  p.efeitos_magicos = [];
  sheetEstado.definirChar(p);
  const nome = sheetHpDescanso.quebrarConcentracaoAtiva();
  assert.equal(nome, null);
});

test('quebrarConcentracaoAtiva reverte o bônus de PV máximo temporário do efeito concentrado', async () => {
  const { sheetEstado } = await modulosApp();
  const p = await personagemMulticlasse(GUERREIRO_1);
  p.condicoes = [];
  p.pv_max = 10;
  p.pv_max_override = 15;
  p.pv_atual = 15;
  p.efeitos_magicos = [{ nome: 'Vigor Falso', concentracao: true, tipo: 'bonus_pv_max', valor: 5 }];
  sheetEstado.definirChar(p);

  sheetHpDescanso.quebrarConcentracaoAtiva();

  assert.ok(!('pv_max_override' in p), 'o override tem de sumir quando cai de volta ao pv_max normal');
  assert.equal(p.pv_atual, 10, 'o PV atual tem de ser recortado para o novo teto');
});
