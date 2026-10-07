// ============================================================
// db.js com conteúdo de expansão (dados/tasha): caminho por fonte e mescla
// idempotente das magias e itens no acervo do Livro do Jogador/Mestre.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { db } = await modulosApp();

test('getClasse("Artífice") lê dados/tasha/artifice/classe.json', async () => {
  const c = await db.getClasse('Artífice');
  assert.equal(c?.nome, 'Artífice');
  assert.equal(c.fonte, 'tasha');
  assert.equal(c.subclasses.length, 5);
});

test('getMagiasClasse e getMagiasPorClasseLista do Artífice', async () => {
  const m = await db.getMagiasClasse('Artífice');
  assert.ok(m.lista_magias.Truques.some((x) => x.nome === 'Bolha Ácida'));
  const l = await db.getMagiasPorClasseLista('Artífice');
  // 80 do Tasha's + Lanterna Espiritual (Arcana Unleashed, lista inclui o Artífice)
  assert.equal(l.total_magias, 81);
  assert.ok(l.magias.some((x) => x.nome === 'Servo Homúnculo' && x.circulo === 2));
});

test('índice e círculo 2 incluem Servo Homúnculo; mescla é idempotente', async () => {
  await db.getIndiceMagias();
  const idx = await db.getIndiceMagias();
  const servo = idx.magias.filter((m) => m.nome === 'Servo Homúnculo');
  assert.equal(servo.length, 1);
  assert.deepEqual(servo[0].classes, ['Artífice']);
  const bolha = idx.magias.find((m) => m.nome === 'Bolha Ácida');
  assert.equal(bolha.classes.filter((c) => c === 'Artífice').length, 1);
  const c2 = await db.getMagiasPorCirculo(2);
  assert.equal(c2.magias.filter((m) => m.nome === 'Servo Homúnculo').length, 1);
});

test('magia fora da lista do Artífice não ganha a classe', async () => {
  const idx = await db.getIndiceMagias();
  const bola = idx.magias.find((m) => m.nome === 'Bola de Fogo');
  assert.ok(!bola.classes.includes('Artífice'));
});

test('getItensMagicos inclui os 9 itens do Apêndice sem duplicar', async () => {
  await db.getItensMagicos();
  const d = await db.getItensMagicos();
  const tasha = d.itens.filter((i) => i.fonte === 'tasha');
  assert.equal(tasha.length, 9);
  assert.equal(d.total_itens, d.itens.length);
});

test('planos e criaturas do Artífice', async () => {
  assert.equal((await db.getPlanosArtifice()).planos.length, 56);
  assert.equal((await db.getCriaturasArtifice()).criaturas.length, 3);
});

// Módulo db.js novo (cache zerado) por query-string única.
async function dbFresco(sufixo) {
  const url = new URL(`../../../site/js/db.js?${sufixo}`, import.meta.url);
  return import(url.href);
}

test('chamadas sobrepostas a getIndiceMagias/getMagiasPorCirculo recebem dados mesclados', async () => {
  const fresco = await dbFresco('sobreposto');
  const [a, b] = await Promise.all([fresco.getIndiceMagias(), fresco.getIndiceMagias()]);
  assert.ok(a.magias.some((m) => m.nome === 'Servo Homúnculo'));
  assert.ok(b.magias.some((m) => m.nome === 'Servo Homúnculo'));
  const depois = await fresco.getIndiceMagias();
  assert.ok(depois.magias.some((m) => m.nome === 'Servo Homúnculo'));
  assert.equal(depois.total_magias, depois.magias.length);
  const [c1, c2] = await Promise.all([fresco.getMagiasPorCirculo(2), fresco.getMagiasPorCirculo(2)]);
  assert.equal(c1.magias.filter((m) => m.nome === 'Servo Homúnculo').length, 1);
  assert.equal(c2.magias.filter((m) => m.nome === 'Servo Homúnculo').length, 1);
  assert.equal(c1.total_magias, c1.magias.length);
});

test('falha em arquivo da expansão não congela: a chamada seguinte mescla', async () => {
  const fresco = await dbFresco('falha');
  const fetchOriginal = globalThis.fetch;
  const erro = console.error;
  console.error = () => {};
  globalThis.fetch = async (url) => {
    if (String(url).includes('tasha/artifice/magias.json')) return { ok: false, status: 500, json: async () => null };
    return fetchOriginal(url);
  };
  try {
    const sem = await fresco.getIndiceMagias();
    assert.ok(!sem.magias.some((m) => m.nome === 'Servo Homúnculo'));
    const itensSem = await fresco.getItensMagicos();
    assert.ok(itensSem.itens.some((i) => i.fonte === 'tasha'), 'itens usam outro arquivo, não afetado');
  } finally {
    globalThis.fetch = fetchOriginal;
    console.error = erro;
  }
  const com = await fresco.getIndiceMagias();
  assert.ok(com.magias.some((m) => m.nome === 'Servo Homúnculo'));
});
