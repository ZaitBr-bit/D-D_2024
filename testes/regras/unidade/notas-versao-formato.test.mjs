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
    // `rotulo` é o resumo de uma ou duas palavras que aparece no cabeçalho
    // RECOLHIDO, no lugar onde a data ficava. É obrigatório: sem ele, a
    // versão vira uma linha só com o número numa lista de dez, que é
    // exatamente o problema que o campo veio resolver. `_versaoHtml` usa
    // `v.rotulo || ''` para não quebrar o modal (mesma lição da 2.2.2), então
    // a falta passaria despercebida na tela -- este assert é o que a pega.
    assert.ok(v.rotulo, `versão ${v.versao} sem rotulo`);
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

test('o rótulo de cada versão aparece no cabeçalho recolhido, e a data sai dele', () => {
  for (const v of versao.NOTAS_VERSAO) {
    const html = notasVersao.montarNotasVersaoHtml([v]);
    const cabecalho = html.slice(html.indexOf('<summary'), html.indexOf('</summary>'));
    assert.ok(cabecalho.includes(v.rotulo),
      `o rótulo "${v.rotulo}" da versão ${v.versao} não apareceu no cabeçalho recolhido`);
    assert.ok(!cabecalho.includes(v.data),
      `a data ${v.data} continua no cabeçalho da versão ${v.versao} -- ela foi movida para dentro do corpo`);
    assert.ok(html.includes(v.data),
      `a data ${v.data} sumiu do modal da versão ${v.versao} -- ela sai do cabeçalho, não do card`);
  }
});

test('rótulo é curto o bastante para caber ao lado do número', () => {
  // Não é regra de estilo por capricho: o cabeçalho é um flex de uma linha
  // com o selo "atual" à direita, e um rótulo longo empurra ou trunca. O
  // teto de 3 palavras vem do pedido ("uma palavra, talvez duas") com uma
  // folga; o de caracteres é o que a coluna comporta em 375px.
  for (const v of versao.NOTAS_VERSAO) {
    const palavras = v.rotulo.trim().split(/\s+/).length;
    assert.ok(palavras <= 3,
      `rotulo da versão ${v.versao} tem ${palavras} palavras ("${v.rotulo}") -- o cabeçalho comporta até 3`);
    assert.ok(v.rotulo.length <= 28,
      `rotulo da versão ${v.versao} tem ${v.rotulo.length} caracteres ("${v.rotulo}") -- o teto é 28`);
  }
});
