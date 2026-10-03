// ============================================================
// Issue #83 -- modificadores temporarios manuais (CA, iniciativa,
// deslocamento, ataque e CD de magia) para buffs de aliados e itens.
// Ficam em `char.efeitos_magicos`, o array que os calculos ja leem.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemSemente } from './harness.mjs';

const { utils, sheetEstado, sheetCombate } = await modulosApp();
const modificadores = await import('../../../site/js/sheet/modificadores.js');

test('criarModificadorManual valida e monta a entrada', () => {
  const ca = modificadores.criarModificadorManual({ nome: 'Armadura Arcana (Aliado)', alvo: 'ca', valor: 3 });
  assert.deepEqual(ca, { nome: 'Armadura Arcana (Aliado)', tipo: 'modificador_manual', alvo: 'ca', valor: 3, manual: true, temporario: true });
  const voo = modificadores.criarModificadorManual({ nome: 'Voo', alvo: 'voo', valor: 18 });
  assert.equal(voo.tipo, 'deslocamento');
  assert.equal(voo.tipo_velocidade, 'voo');
  assert.equal(voo.valor_metros, 18);
  const desloc = modificadores.criarModificadorManual({ nome: '', alvo: 'deslocamento', valor: 3 });
  assert.equal(desloc.tipo_velocidade, 'base_bonus');
  assert.equal(desloc.nome, 'Deslocamento', 'nome vazio vira o rótulo do alvo');
  assert.equal(modificadores.criarModificadorManual({ nome: 'x', alvo: 'ca', valor: 0 }), null);
  assert.equal(modificadores.criarModificadorManual({ nome: 'x', alvo: 'ca', valor: 'abc' }), null);
  assert.equal(modificadores.criarModificadorManual({ nome: 'x', alvo: 'inexistente', valor: 2 }), null);
});

test('somaModificadoresManuais soma só o alvo pedido', () => {
  const p = { efeitos_magicos: [
    { tipo: 'modificador_manual', alvo: 'ca', valor: 2 },
    { tipo: 'modificador_manual', alvo: 'ca', valor: -1 },
    { tipo: 'modificador_manual', alvo: 'cd_magia', valor: 1 },
    { tipo: 'bonus_pv_max', valor: 9 },
  ] };
  assert.equal(utils.somaModificadoresManuais(p, 'ca'), 1);
  assert.equal(utils.somaModificadoresManuais(p, 'cd_magia'), 1);
  assert.equal(utils.somaModificadoresManuais(p, 'iniciativa'), 0);
  assert.equal(utils.somaModificadoresManuais({}, 'ca'), 0);
});

test('a CA, a CD e o ataque de magia incluem os modificadores manuais', async () => {
  const p = await personagemSemente('Clérigo');
  const caAntes = utils.calcCA(p);
  const cdAntes = utils.calcCDMagia(p);
  const atqAntes = utils.calcAtaqueMagia(p);
  p.efeitos_magicos = [
    { nome: 'a', tipo: 'modificador_manual', alvo: 'ca', valor: 2, manual: true, temporario: true },
    { nome: 'b', tipo: 'modificador_manual', alvo: 'cd_magia', valor: 1, manual: true, temporario: true },
    { nome: 'c', tipo: 'modificador_manual', alvo: 'ataque_magia', valor: 1, manual: true, temporario: true },
  ];
  assert.equal(utils.calcCA(p), caAntes + 2);
  assert.equal(utils.calcCDMagia(p), cdAntes + 1);
  assert.equal(utils.calcAtaqueMagia(p), atqAntes + 1);
});

test('a iniciativa inclui o modificador manual', async () => {
  const p = await personagemSemente('Guerreiro');
  sheetEstado.definirChar(p);
  const antes = sheetCombate.getModIniciativa().valor;
  p.efeitos_magicos = [{ nome: 'i', tipo: 'modificador_manual', alvo: 'iniciativa', valor: 2, manual: true, temporario: true }];
  assert.equal(sheetCombate.getModIniciativa().valor, antes + 2);
});
