// ============================================================
// Issue #122 -- salvar sem mudanca real nao pode carimbar atualizado_em
// (o merge da home escolhe por recencia: carimbo falso apaga o que o outro
// aparelho editou).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { store } = await modulosApp();

/** Espera o relogio andar, para o carimbo novo ser distinguivel do antigo. */
function esperarRelogio() {
  const t0 = Date.now();
  while (Date.now() - t0 < 5) { /* relogio */ }
}

function personagemBase() {
  const p = store.criarPersonagemVazio();
  p.id = 'p-122'; p.nome = 'Teste'; p.classe = 'Guerreiro'; p.nivel = 1;
  return p;
}

test('salvar sem mudanca real mantem atualizado_em', () => {
  localStorage.clear();
  store.salvarPersonagem(personagemBase());
  const lido = store.getPersonagem('p-122');
  const carimboGuardado = lido.atualizado_em;
  esperarRelogio();
  store.salvarPersonagem(lido);
  assert.equal(store.getPersonagem('p-122').atualizado_em, carimboGuardado);
  assert.equal(lido.atualizado_em, carimboGuardado);
});

test('salvar com mudanca real carimba', () => {
  localStorage.clear();
  store.salvarPersonagem(personagemBase());
  const lido = store.getPersonagem('p-122');
  const antigo = lido.atualizado_em;
  esperarRelogio();
  lido.nome = 'Outro';
  store.salvarPersonagem(lido);
  assert.notEqual(store.getPersonagem('p-122').atualizado_em, antigo);
});

test('preservarCarimbo grava a mudanca mas mantem o carimbo guardado', () => {
  localStorage.clear();
  store.salvarPersonagem(personagemBase());
  const lido = store.getPersonagem('p-122');
  const antigo = lido.atualizado_em;
  esperarRelogio();
  lido.notas = 'migrado';
  store.salvarPersonagem(lido, { preservarCarimbo: true });
  const depois = store.getPersonagem('p-122');
  assert.equal(depois.notas, 'migrado');
  assert.equal(depois.atualizado_em, antigo);
});
