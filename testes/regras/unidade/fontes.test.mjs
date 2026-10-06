// ============================================================
// Tag de origem (site/js/fontes.js): o chip só existe para registro com
// fonte, mostra a sigla e escapa o id desconhecido.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { modulosApp, RAIZ } from './harness.mjs';

await modulosApp();
const fontes = await import(pathToFileURL(resolve(RAIZ, 'site/js/fontes.js')).href);

test('sem fonte não há chip (conteúdo do Livro do Jogador)', () => {
  assert.equal(fontes.seloFonte(undefined), '');
  assert.equal(fontes.seloFonte(''), '');
});

test('chip mostra a sigla e carrega o id', () => {
  fontes.definirFontes([{ id: 'tasha', nome: "Tasha's Cauldron of Everything", sigla: "Tasha's" }]);
  const html = fontes.seloFonte('tasha');
  assert.match(html, /class="selo-fonte"/);
  assert.match(html, /data-fonte="tasha"/);
  assert.match(html, /Tasha&#39;s/);
  assert.equal(fontes.nomeDaFonte('tasha'), "Tasha's Cauldron of Everything");
});

test('id desconhecido vira chip com o próprio id, escapado', () => {
  fontes.definirFontes([]);
  const html = fontes.seloFonte('<x>');
  assert.match(html, /&lt;x&gt;/);
  assert.doesNotMatch(html, /<x>/);
});

test('carregarFontes tenta de novo depois de uma falha', async () => {
  const fetchOriginal = globalThis.fetch;
  let chamadas = 0;
  globalThis.fetch = async (...args) => {
    chamadas += 1;
    if (chamadas === 1) throw new Error('falha de rede simulada');
    return fetchOriginal(...args);
  };
  const log = console.error;
  console.error = () => {};
  try {
    await assert.rejects(fontes.carregarFontes());
    const mapa = await fontes.carregarFontes();
    assert.equal(mapa.get('tasha')?.sigla, "Tasha's");
  } finally {
    globalThis.fetch = fetchOriginal;
    console.error = log;
  }
});

test('carregarFontes lê dados/fontes.json', async () => {
  const mapa = await fontes.carregarFontes();
  assert.equal(mapa.get('tasha')?.sigla, "Tasha's");
});
