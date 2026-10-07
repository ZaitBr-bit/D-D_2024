// ============================================================
// Issue #122 -- reconciliacao nuvem x local com lapide de exclusao.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { RAIZ, modulosApp } from './harness.mjs';

const m = await import(pathToFileURL(resolve(RAIZ, 'site/js/sync-merge.js')).href);

const p = (id, t, extra = {}) => ({ id, nome: id, atualizado_em: t, ...extra });
const lapide = (id, t) => ({ id, removido: true, removido_em: t, atualizado_em: t });
const rec = (locais, nuvem, pend = []) =>
  m.reconciliar({ locais, nuvem, idsPendentesRemocao: new Set(pend) });

test('so local, sem lapide: mantem e envia (personagem novo neste aparelho)', () => {
  const r = rec([p('a', '2026-10-01T10:00:00Z')], []);
  assert.deepEqual(r.lista.map(x => x.id), ['a']);
  assert.deepEqual(r.paraEnviarCloud.map(x => x.id), ['a']);
});

test('excluido em outro aparelho: lapide mais nova remove a copia local, nao ressuscita', () => {
  const r = rec([p('a', '2026-10-01T10:00:00Z')], [lapide('a', '2026-10-02T10:00:00Z')]);
  assert.deepEqual(r.lista, []);
  assert.deepEqual(r.paraEnviarCloud, []);
  assert.deepEqual(r.idsRemovidosLocal, ['a']);
});

test('copia local editada DEPOIS da exclusao vence a lapide e e reenviada', () => {
  const local = p('a', '2026-10-03T10:00:00Z');
  const r = rec([local], [lapide('a', '2026-10-02T10:00:00Z')]);
  assert.deepEqual(r.lista, [local]);
  assert.deepEqual(r.paraEnviarCloud, [local]);
  assert.deepEqual(r.idsRemovidosLocal, []);
});

test('so na nuvem: entra na lista; com remocao pendente neste aparelho, nao volta', () => {
  assert.deepEqual(rec([], [p('a', '2026-10-01T10:00:00Z')]).lista.map(x => x.id), ['a']);
  assert.deepEqual(rec([], [p('a', '2026-10-01T10:00:00Z')], ['a']).lista, []);
});

test('lapide sem copia local: nada entra na lista', () => {
  assert.deepEqual(rec([], [lapide('a', '2026-10-02T10:00:00Z')]).lista, []);
});

test('ambos existem: vence o mais recente; empate fica com a nuvem', () => {
  const l = p('a', '2026-10-03T10:00:00Z', { nome: 'local' });
  const c = p('a', '2026-10-02T10:00:00Z', { nome: 'nuvem' });
  assert.equal(rec([l], [c]).lista[0].nome, 'local');
  assert.equal(rec([p('a', '2026-10-01T10:00:00Z', { nome: 'local' })], [c]).lista[0].nome, 'nuvem');
  const iguais = rec([p('a', '2026-10-02T10:00:00Z', { nome: 'local' })], [c]);
  assert.equal(iguais.lista[0].nome, 'nuvem');
  assert.deepEqual(iguais.paraEnviarCloud, []);
});

test('decidirAoAbrir cobre manter, usar-nuvem e remover', () => {
  const l = p('a', '2026-10-02T10:00:00Z');
  assert.equal(m.decidirAoAbrir(l, null), 'manter');
  assert.equal(m.decidirAoAbrir(l, p('a', '2026-10-03T10:00:00Z')), 'usar-nuvem');
  assert.equal(m.decidirAoAbrir(l, p('a', '2026-10-01T10:00:00Z')), 'manter');
  assert.equal(m.decidirAoAbrir(l, lapide('a', '2026-10-03T10:00:00Z')), 'remover');
  assert.equal(m.decidirAoAbrir(l, lapide('a', '2026-10-01T10:00:00Z')), 'manter');
});

const { store } = await modulosApp();

test('substituirPersonagemLocal troca a copia sem carimbar', () => {
  localStorage.clear();
  const velho = { ...store.criarPersonagemVazio(), id: 'x', nome: 'Velho', classe: 'Guerreiro', nivel: 1, atualizado_em: '2026-10-01T10:00:00Z' };
  store.atualizarListaLocal([velho]);
  const novo = { ...velho, nome: 'Novo', atualizado_em: '2026-10-02T10:00:00Z' };
  store.substituirPersonagemLocal(novo, 'x');
  const lido = store.getPersonagem('x');
  assert.equal(lido.nome, 'Novo');
  assert.equal(lido.atualizado_em, '2026-10-02T10:00:00Z');
});

test('substituirPersonagemLocal com null remove a copia local', () => {
  localStorage.clear();
  store.atualizarListaLocal([{ ...store.criarPersonagemVazio(), id: 'x', nome: 'A', classe: 'Guerreiro', nivel: 1 }]);
  store.substituirPersonagemLocal(null, 'x');
  assert.equal(store.getPersonagem('x'), null);
});

// ---- Gravação na nuvem: cópia velha (ex.: snapshot preso na fila desde a criação) não sobrescreve a mais nova ----
test('podeSobrescreverNuvem: só grava se a nuvem não tiver versão mais nova', () => {
  const local = p('a', '2026-10-01T10:00:00Z');
  assert.equal(m.podeSobrescreverNuvem(local, null), true, 'sem documento na nuvem, grava');
  assert.equal(m.podeSobrescreverNuvem(local, p('a', '2026-09-30T10:00:00Z')), true, 'nuvem mais velha, grava');
  assert.equal(m.podeSobrescreverNuvem(local, p('a', '2026-10-01T10:00:00Z')), true, 'mesma versão, grava (idempotente)');
  assert.equal(m.podeSobrescreverNuvem(local, p('a', '2026-10-05T10:00:00Z')), false,
    'snapshot da criação preso na fila não pode apagar dias de edição feitos em outro aparelho');
  assert.equal(m.podeSobrescreverNuvem(local, lapide('a', '2026-10-02T10:00:00Z')), false, 'não ressuscita personagem excluído depois');
  assert.equal(m.podeSobrescreverNuvem(p('a', '2026-10-03T10:00:00Z'), lapide('a', '2026-10-02T10:00:00Z')), true,
    'editado depois da exclusão vence a lápide (mesma regra do reconciliar)');
});
