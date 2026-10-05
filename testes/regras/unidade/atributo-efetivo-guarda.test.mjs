// ============================================================
// Guarda das leituras de atributo: fora dos arquivos de CONSTRUÇÃO
// (criar, subir de nível, editar, pré-requisitos), toda leitura de atributo
// passa por atributoEfetivo (site/js/regras-atributos.js). Leitura direta
// fora da lista branca só é aceita com o marcador `atributo-base:` na
// linha ou na linha anterior, explicando por que ali vale o valor-base.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { RAIZ } from './harness.mjs';

// Arquivos inteiros de construção: leem e gravam o valor-base de propósito.
const LISTA_BRANCA = [
  /^site\/js\/creator\//,
  /^site\/js\/levelup(-ui|-cards|-flow|-validations)?\.js$/,
  /^site\/js\/sheet\/edicao\.js$/,
  /^site\/js\/sheet\/talentos\.js$/,
  /^site\/js\/ficha-edicoes\.js$/,
  /^site\/js\/ficha-edicao-validacoes\.js$/,
  /^site\/js\/regras-multiclasse-progressao\.js$/,
  /^site\/js\/opcoes-dominio\.js$/,
  /^site\/js\/store\.js$/,
  /^site\/js\/regras-atributos\.js$/,
  // Aumento permanente: lê e grava o valor-base (Manual, Tomo, Livro).
  /^site\/js\/regras-aumento-atributo\.js$/,
];
// Leitura direta: atributos.forca, atributos?.forca, atributos[...], atributos?.[...],
// e alias do objeto inteiro (`= personagem.atributos`, `= char?.atributos || {}`).
const RE_LEITURA = /\batributos\s*\??\.\s*(forca|destreza|constituicao|inteligencia|sabedoria|carisma)\b|\batributos\s*(\?\.)?\s*\[|=\s*[\w$.?]*\.atributos\b(?!_)|\.atributos\s*(\|\||\?\?)/;

/** Todos os .js de site/js (recursivo), como caminhos relativos à raiz com "/". */
function arquivosJs(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'vendor' ? [] : arquivosJs(p);
    return n.endsWith('.js') ? [relative(RAIZ, p).replace(/\\/g, '/')] : [];
  });
}

/** Leituras diretas não declaradas de um arquivo: [{linha, texto}]. */
function leiturasNaoDeclaradas(rel) {
  const linhas = readFileSync(resolve(RAIZ, rel), 'utf-8').split('\n');
  const out = [];
  linhas.forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    if (!RE_LEITURA.test(l)) return;
    if (/atributo-base:/.test(l) || /atributo-base:/.test(linhas[i - 1] || '')) return;
    out.push({ linha: i + 1, texto: t.slice(0, 120) });
  });
  return out;
}

test('toda leitura de atributo de jogo passa por atributoEfetivo', () => {
  const violacoes = arquivosJs(resolve(RAIZ, 'site/js'))
    .filter((rel) => !LISTA_BRANCA.some((re) => re.test(rel)))
    .flatMap((rel) => leiturasNaoDeclaradas(rel).map((v) => `${rel}:${v.linha} ${v.texto}`));
  assert.deepEqual(violacoes, []);
});

test('o guarda pega as formas de leitura que existem no código', () => {
  for (const exemplo of [
    'const m = calcMod(char.atributos.forca);',
    'const v = char?.atributos?.[atributo];',
    'const atributos = personagem.atributos || {};',
    'const x = personagem.atributos[key];',
    'return (x.atributos || {})[k];',
    'usar(x.atributos ?? {});',
  ]) assert.ok(RE_LEITURA.test(exemplo), exemplo);
  for (const ok of ['const b = personagem.atributos_base[key];', 'const e = atributoEfetivo(char, "forca");']) {
    assert.ok(!RE_LEITURA.test(ok), ok);
  }
});
