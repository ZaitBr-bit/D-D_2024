// ============================================================
// Issue #91 -- Revelação Celestial do Aasimar (nível 3) concede UMA
// transformação por Descanso Longo, à escolha entre 3 formas: Asas
// Celestiais, Manto Necrótico, Transfiguração Radiante. Cada forma é um
// traço PRÓPRIO no catálogo (dados/origens/especies.json), e o app já
// sabia disso -- `TRACOS_REVELACAO_CELESTIAL` (sheet/caracteristicas.js)
// marca as 3 como "Ativa" de propósito -- mas nunca implementou o
// seletor no card do PAI: caía no toggle genérico (booleano), sem onde
// guardar QUAL forma foi escolhida, e o efeito mecânico de nenhuma das
// três (ex.: deslocamento de voo de Asas Celestiais) tinha como ser
// aplicado em lugar nenhum.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

async function personagemAasimar(nivel = 3) {
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel }]);
  p.especie = 'Aasimar';
  p.tracos_escolhidos = [];
  return p;
}

test('Revelação Celestial: card mostra o seletor de forma (não o toggle genérico) quando disponível', async () => {
  const { sheetEstado, sheetCaracteristicas, db } = await modulosApp();
  const p = await personagemAasimar();
  sheetEstado.definirChar(p);
  sheetEstado.definirEspecies(await db.getEspecies());

  const html = sheetCaracteristicas.renderSecaoTracosEspecie();
  assert.ok(html.includes('Revelação Celestial'), 'sanity: o card precisa existir na seção renderizada');
  assert.ok(html.includes('revelacao-celestial-escolha') && html.includes('data-revelacao-transformar'),
    'o card de Revelação Celestial precisa mostrar o seletor de forma, não o toggle genérico');
  assert.ok(!html.match(/data-toggle-uso="especie_Revela/),
    'Revelação Celestial não pode mais cair no toggle genérico (booleano sem onde guardar a forma escolhida)');
});

test('Asas Celestiais ativa: deslocamento de voo aparece igual ao deslocamento base', async () => {
  const { sheetEstado, sheetCombate } = await modulosApp();
  const p = await personagemAasimar();
  p.recursos = { aasimar_revelacao_ativa: 'asas' };
  sheetEstado.definirChar(p);

  const texto = sheetCombate.getDeslocamentoFinal('9 metros');
  assert.match(texto, /Voo 9m/,
    `"${texto}" -- Asas Celestiais concede "Deslocamento de Voo igual ao seu Deslocamento" (Espécies.md)`);
});

test('sem transformação ativa: nenhum Voo aparece no deslocamento', async () => {
  const { sheetEstado, sheetCombate } = await modulosApp();
  const p = await personagemAasimar();
  p.recursos = {};
  sheetEstado.definirChar(p);

  const texto = sheetCombate.getDeslocamentoFinal('9 metros');
  assert.doesNotMatch(texto, /Voo/, `"${texto}" -- sem transformar, não há voo nenhum`);
});

// DISCRIMINADOR: Manto Necrótico ativo NÃO concede voo -- só Asas
// Celestiais tem efeito de deslocamento; as outras duas formas (Manto
// Necrótico, Transfiguração Radiante) não mexem em deslocamento nenhum
// (Espécies.md). Sem este teste, uma implementação que checasse só
// "existe uma transformação ativa" (em vez de qual) passaria por engano.
test('Manto Necrótico ativo: NÃO concede voo (só Asas Celestiais mexe em deslocamento)', async () => {
  const { sheetEstado, sheetCombate } = await modulosApp();
  const p = await personagemAasimar();
  p.recursos = { aasimar_revelacao_ativa: 'manto' };
  sheetEstado.definirChar(p);

  const texto = sheetCombate.getDeslocamentoFinal('9 metros');
  assert.doesNotMatch(texto, /Voo/, `"${texto}" -- Manto Necrótico não concede voo`);
});

// DISCRIMINADOR: um personagem de OUTRA espécie com o mesmo campo por
// acidente (ex.: dado importado/editado à mão) não pode ganhar voo -- a
// checagem tem de exigir `especie === 'Aasimar'` também, não só o campo.
test('mesmo campo em personagem NÃO-Aasimar não concede voo', async () => {
  const { sheetEstado, sheetCombate } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 3 }]);
  p.especie = 'Humano';
  p.recursos = { aasimar_revelacao_ativa: 'asas' };
  sheetEstado.definirChar(p);

  const texto = sheetCombate.getDeslocamentoFinal('9 metros');
  assert.doesNotMatch(texto, /Voo/, `"${texto}" -- o campo sozinho, sem ser Aasimar, não pode conceder nada`);
});
