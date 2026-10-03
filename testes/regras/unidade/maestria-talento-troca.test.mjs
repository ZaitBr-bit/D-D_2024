// ============================================================
// Issue #119 -- Mestre das Armas: a arma do talento e trocavel no Descanso
// Longo (Talentos.md, "Sempre que completar um Descanso Longo, voce pode
// trocar o tipo de arma por outro elegivel"). Hoje o passo de troca so
// existe para as cinco classes com Maestria em Arma.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

await modulosApp();
const maestrias = await import('../../../site/js/sheet/maestrias.js');
const cobertura = await import('../../../site/js/regras-cobertura.js');

const CLERIGO_5 = () => ({
  classe: 'Clérigo', subclasse: '', nivel: 5,
  classes: [{ classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 }],
  talentos: ['Mestre das Armas'], maestrias_arma: ['Maça'],
});

test('temMestreDasArmas: true com o talento (string ou objeto), false sem', () => {
  assert.equal(maestrias.temMestreDasArmas(CLERIGO_5()), true);
  assert.equal(maestrias.temMestreDasArmas({ ...CLERIGO_5(), talentos: [{ nome: 'Mestre das Armas' }] }), true);
  assert.equal(maestrias.temMestreDasArmas({ ...CLERIGO_5(), talentos: [] }), false);
});

test('aplicarEfeitoTalento grava a arma escolhida em maestria_talento', () => {
  const p = { ...CLERIGO_5(), talentos: [], maestrias_arma: [] };
  cobertura.aplicarEfeitoTalento(p, 'Mestre das Armas', { arma: 'Maça', atributo: 'forca' });
  assert.deepEqual(p.maestrias_arma, ['Maça']);
  assert.equal(p.maestria_talento, 'Maça');
});
