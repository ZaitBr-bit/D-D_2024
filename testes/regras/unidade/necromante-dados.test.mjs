// ============================================================
// Necromante (Arcana Unleashed): dados, fonte, junção em getClasse('Mago'),
// Versado em Necromancia, Animar Mortos grátis e concessões automáticas.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAIZ, modulosApp } from './harness.mjs';

const ler = (rel) => JSON.parse(readFileSync(resolve(RAIZ, rel), 'utf-8'));
const necro = ler('dados/arcana-unleashed/subclasses_mago.json').subclasses.find((s) => s.nome === 'Necromante');

test('a fonte "arcana-unleashed" está registrada e a subclasse a carrega', () => {
  assert.ok(ler('dados/fontes.json').fontes.some((f) => f.id === 'arcana-unleashed' && f.sigla));
  assert.equal(necro.fonte, 'arcana-unleashed');
});

test('as sete características do livro, nos níveis certos e em português', () => {
  assert.deepEqual(necro.caracteristicas.map((c) => [c.nivel, c.nome]), [
    [3, 'Versado em Necromancia'], [3, 'Livro de Magias Necromântico'],
    [6, 'Poder Sepulcral'], [6, 'Servos Mortos-Vivos'], [6, 'Servos Fortalecidos'],
    [10, 'Colher Mortos-Vivos'], [14, 'Mestre da Morte'],
  ]);
  const todo = necro.caracteristicas.map((c) => c.descricao).join(' ');
  assert.ok(!/\b(Hit Points|Reaction|Bonus Action|Long Rest|Necrotic)\b/.test(todo), 'texto em inglês sobrou');
  assert.ok(!/\b(feet|foot|ft)\b/.test(todo), 'medida em pés sobrou');
});

test('getClasse("Mago") junta a subclasse às quatro do Livro do Jogador, sem duplicar', async () => {
  const { db } = await modulosApp();
  const mago = await db.getClasse('Mago');
  assert.deepEqual(mago.subclasses.map((s) => s.nome),
    ['Abjurador', 'Adivinhador', 'Evocador', 'Ilusionista', 'Necromante']);
  assert.equal(mago.subclasses.at(-1).fonte, 'arcana-unleashed');
  const denovo = await db.getClasse('Mago');
  assert.equal(denovo.subclasses.length, 5);
});

test('Versado em Necromancia: a escola da subclasse é Necromancia, igual ao índice de magias', async () => {
  const { dadosClasses } = await modulosApp();
  assert.equal(dadosClasses.ESCOLAS_SUBCLASSE_MAGO['Necromante'], 'Necromancia');
  const escolas = new Set(ler('dados/magias/_indice.json').magias.map((m) => m.escola));
  assert.ok(escolas.has('Necromancia'));
});

test('Servos Mortos-Vivos: Animar Mortos vira sempre preparada com uso grátis; Servos Fortalecidos não', async () => {
  const { levelup } = await modulosApp();
  const c = (nome) => necro.caracteristicas.find((x) => x.nome === nome);
  assert.equal(levelup.featureConcedeUsoGratisSemEspaco(c('Servos Mortos-Vivos').descricao, 'Servos Mortos-Vivos'), true);
  assert.equal(levelup.featureConcedeUsoGratisSemEspaco(c('Servos Fortalecidos').descricao, 'Servos Fortalecidos'), false);
  const magias = await levelup.obterMagiasSemprePreparadasNivel('Mago', 'Necromante', 6, null);
  const animar = magias.find((m) => m.nome === 'Animar Mortos');
  assert.ok(animar, 'Animar Mortos é concedida no nível 6');
  assert.equal(animar.gratisSemEspaco, true);
});

test('concessão automática do Necromante: resistência necrótica e Convocar Familiar no livro, sem duplicar', async () => {
  const { regrasSubclasseEscolhas: escolhas } = await modulosApp();
  const linha = escolhas.linhasDaSubclasseNoNivel('Necromante', 3, new Set())
    .find((l) => l.caracteristica === 'Livro de Magias Necromântico');
  assert.ok(linha?.automatica, 'a linha automática existe no nível 3');
  const p = { resistencias: [], grimorio: [] };
  escolhas.aplicarConcessaoAutomatica(p, linha, { classe: 'Mago' });
  escolhas.aplicarConcessaoAutomatica(p, linha, { classe: 'Mago' });
  assert.deepEqual(p.resistencias, ['Necrótico']);
  assert.deepEqual(p.grimorio.map((m) => [m.nome, m.circulo, m.classe]), [['Convocar Familiar', 1, 'Mago']]);
});

test('migração: a ficha de Necromante 3+ recebe as concessões uma vez; Mago de outra subclasse não', async () => {
  const { sheetMigracoes, sheetEstado } = await modulosApp();
  const ficha = (sub, nivel) => ({
    classes: [{ classe: 'Mago', subclasse: sub, nivel, ordem: 0 }], classe: 'Mago', subclasse: sub, nivel,
    resistencias: [], grimorio: [], recursos: {},
  });
  sheetEstado.definirChar(ficha('Necromante', 3));
  sheetMigracoes.migrarConcessoesSubclasseMago();
  sheetMigracoes.migrarConcessoesSubclasseMago();
  assert.deepEqual(sheetEstado.char.resistencias, ['Necrótico']);
  assert.equal(sheetEstado.char.grimorio.filter((m) => m.nome === 'Convocar Familiar').length, 1);
  sheetEstado.definirChar(ficha('Abjurador', 5));
  sheetMigracoes.migrarConcessoesSubclasseMago();
  assert.deepEqual(sheetEstado.char.resistencias, []);
});

const NECROMANCIA_DO_LIVRO = ['Murchar e Florescer', 'Rajada Purulenta', 'Enervação', 'Terreno Sepulcral',
  'Torrente de Energia Negativa', 'Lanterna Espiritual', 'Ondas de Exaustão', 'Lamento da Banshee'];

test('magias de Necromancia do livro: dados em português, fonte e classes', () => {
  const magias = ler('dados/arcana-unleashed/magias.json').magias;
  assert.deepEqual(magias.map((m) => m.nome).sort(), [...NECROMANCIA_DO_LIVRO].sort());
  for (const m of magias) {
    assert.equal(m.escola, 'Necromancia', m.nome);
    assert.equal(m.fonte, 'arcana-unleashed', m.nome);
    assert.ok(m.classes.includes('Mago'), `${m.nome} é do Mago`);
    assert.ok(m.descricao && m.tempo_conjuracao && m.alcance && m.componentes && m.duracao, `${m.nome} completa`);
    assert.ok(!/\b(feet|foot|Hit Points|saving throw|Necrotic|spell slot)\b/i.test(m.descricao + (m.circulo_superior || '')), `${m.nome}: inglês sobrou`);
  }
});

test('as magias do livro entram no índice, no círculo e nas listas de classe, uma vez só', async () => {
  const { db } = await modulosApp();
  const indice = await db.getIndiceMagias();
  const noIndice = indice.magias.filter((m) => NECROMANCIA_DO_LIVRO.includes(m.nome));
  assert.equal(noIndice.length, 8);
  assert.ok(noIndice.every((m) => m.fonte === 'arcana-unleashed'));
  assert.equal((await db.getIndiceMagias()).magias.filter((m) => m.nome === 'Enervação').length, 1);

  const c5 = await db.getMagiasPorCirculo(5);
  assert.ok(c5.magias.some((m) => m.nome === 'Enervação' && m.descricao));

  const lista = await db.getMagiasClasse('Mago');
  const nomes = Object.values(lista.lista_magias).flat().map((m) => m.nome);
  for (const n of NECROMANCIA_DO_LIVRO) assert.equal(nomes.filter((x) => x === n).length, 1, `${n} na lista do Mago`);
  assert.ok(lista.lista_magias['5º Círculo'].find((m) => m.nome === 'Enervação').escola === 'Necromancia');
  const ord = lista.lista_magias['5º Círculo'].map((m) => m.nome);
  assert.deepEqual(ord, [...ord].sort((a, b) => a.localeCompare(b, 'pt-BR')), 'ordem alfabética mantida');

  const bruxo = Object.values((await db.getMagiasClasse('Bruxo')).lista_magias).flat().map((m) => m.nome);
  assert.ok(bruxo.includes('Rajada Purulenta'));
  const clerigo = Object.values((await db.getMagiasClasse('Clérigo')).lista_magias).flat().map((m) => m.nome);
  assert.ok(!clerigo.includes('Enervação'), 'o Clérigo não tem Enervação');
  assert.ok(clerigo.includes('Terreno Sepulcral'));

  const porClasse = await db.getMagiasPorClasseLista('Mago');
  assert.equal(porClasse.magias.filter((m) => m.nome === 'Lamento da Banshee').length, 1);
  assert.equal(porClasse.total_magias, porClasse.magias.length);
  const artifice = await db.getMagiasPorClasseLista('Artífice');
  assert.ok(artifice.magias.some((m) => m.nome === 'Lanterna Espiritual'));
});
