// ============================================================
// O modal de notas de versão renderiza TODA versão do histórico.
//
// Nasceu de um bug real (2026-08-17): a entrada 2.2.2 só tinha
// `correcoes` -- uma versão só de correções, perfeitamente legítima --, e
// `_versaoHtml` fazia `v.melhorias.map(...)` sem guarda. O modal inteiro
// parava de abrir, escondendo também as versões antigas, e o único sinal
// era um `TypeError` no console.
//
// O spec de navegador (`e2e/regras/notas-versao.spec.mjs`) pegou o bug, e é
// ele que prova o comportamento na tela. Este motor existe para dar o sinal
// BARATO: falha em milissegundos, sem subir navegador, apontando a versão
// exata que quebrou.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { notasVersao, versao } = await modulosApp();

test('toda versão do histórico gera HTML sem lançar', () => {
  for (const v of versao.NOTAS_VERSAO) {
    const html = notasVersao.montarNotasVersaoHtml
      ? notasVersao.montarNotasVersaoHtml([v])
      : null;
    assert.ok(html, `montarNotasVersaoHtml não exportada -- ajuste este motor`);
    assert.ok(html.includes(v.versao), `a versão ${v.versao} não apareceu no HTML gerado`);
  }
});

test('o histórico inteiro renderiza de uma vez', () => {
  const html = notasVersao.montarNotasVersaoHtml(versao.NOTAS_VERSAO);
  for (const v of versao.NOTAS_VERSAO) {
    assert.ok(html.includes(v.versao), `a versão ${v.versao} sumiu do modal`);
  }
});

test('a versão atual existe no histórico e é a primeira', () => {
  const primeira = versao.NOTAS_VERSAO[0];
  assert.equal(primeira.versao, versao.VERSAO_ATUAL,
    'VERSAO_ATUAL precisa ser a entrada do topo de NOTAS_VERSAO');
});

test('toda versão tem os campos que o modal exibe', () => {
  for (const v of versao.NOTAS_VERSAO) {
    assert.ok(v.data, `versão ${v.versao} sem data`);
    assert.ok(v.resumo, `versão ${v.versao} sem resumo`);
    // melhorias/correcoes são OPCIONAIS -- mas pelo menos um dos dois
    // precisa existir, senão a versão não diz o que mudou.
    const grupos = [...(v.melhorias || []), ...(v.correcoes || [])];
    assert.ok(grupos.length > 0, `versão ${v.versao} não lista nenhuma mudança`);
    for (const g of grupos) {
      assert.ok(g.grupo, `versão ${v.versao} tem grupo sem título`);
      assert.ok((g.itens || []).length > 0, `grupo "${g.grupo}" da ${v.versao} está vazio`);
    }
  }
});
