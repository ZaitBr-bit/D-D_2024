// ============================================================
// Issues #105 e #61: os gravadores de truque e de magia concedida carimbam
// `classe`. Testes diretos onde a função é exportada e pura; guarda
// textual (mesmo padrão de magia-classe-gravacao.test.mjs) onde o gravador
// vive num handler de clique.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modulosApp, personagemMulticlasse, RAIZ } from './harness.mjs';

/** Lê um arquivo de site/js sem comentários de linha, para as guardas textuais. */
function fonte(rel) {
  return readFileSync(resolve(RAIZ, rel), 'utf-8').replace(/^\s*\/\/.*$/gm, '');
}

test('_concederMagiaAutomatica grava a classe dona; sem classe não cria a chave', async () => {
  const { levelup } = await modulosApp();
  const lista = [];
  levelup._concederMagiaAutomatica(lista, { nome: 'Bênção', circulo: 1 }, 'dominio', 'Clérigo');
  assert.equal(lista[0].classe, 'Clérigo');
  levelup._concederMagiaAutomatica(lista, { nome: 'Escuridão', circulo: 2 }, 'especie_legado');
  assert.equal('classe' in lista[1], false);
});

test('_concederMagiaAutomatica sobre entrada existente: preenche classe ausente, nunca sobrescreve', async () => {
  const { levelup } = await modulosApp();
  const lista = [{ nome: 'Bênção', circulo: 1 }, { nome: 'Auxílio', circulo: 2, classe: 'Paladino' }];
  levelup._concederMagiaAutomatica(lista, { nome: 'Bênção', circulo: 1 }, 'dominio', 'Clérigo');
  levelup._concederMagiaAutomatica(lista, { nome: 'Auxílio', circulo: 2 }, 'dominio', 'Clérigo');
  assert.equal(lista[0].classe, 'Clérigo');
  assert.equal(lista[1].classe, 'Paladino');
});

test('aplicarConcessaoAutomatica carimba o truque de subclasse com contexto.classe', async () => {
  const { regrasSubclasseEscolhas } = await modulosApp();
  const p = { magias_conhecidas: [] };
  regrasSubclasseEscolhas.aplicarConcessaoAutomatica(p, { automatica: { truques: ['Ilusão Menor'] } }, { classe: 'Mago' });
  assert.deepEqual(p.magias_conhecidas, [{ nome: 'Ilusão Menor', circulo: 0, origem: 'subclasse_automatica', classe: 'Mago' }]);
  const q = { magias_conhecidas: [] };
  regrasSubclasseEscolhas.aplicarConcessaoAutomatica(q, { automatica: { truques: ['Ilusão Menor'] } });
  assert.equal('classe' in q.magias_conhecidas[0], false);
});

test('migrarTruquesFixosSubclasse carimba Mãos Mágicas com a classe da subclasse', async () => {
  const { sheetEstado, sheetMigracoes } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 1 }, { classe: 'Ladino', subclasse: 'Trapaceiro Arcano', nivel: 3 }]);
  p.magias_conhecidas = [];
  sheetEstado.definirChar(p);
  sheetMigracoes.migrarTruquesFixosSubclasse();
  const maos = p.magias_conhecidas.find((m) => m.nome === 'Mãos Mágicas');
  assert.ok(maos, 'Mãos Mágicas tinha de ser concedida');
  assert.equal(maos.classe, 'Ladino');
});

test('guarda textual: confirmarLevelUp carimba os truques com ctx.classeQueSobe', () => {
  const src = fonte('site/js/levelup-ui.js');
  const inicio = src.indexOf('export async function confirmarLevelUp');
  const fim = src.indexOf('\nfunction montarResumoFinal(', inicio);
  assert.ok(inicio !== -1 && fim !== -1, 'recorte de confirmarLevelUp mudou de forma');
  const pushes = src.slice(inicio, fim).match(/char\.magias_conhecidas\.push\(\{[^;]*circulo: 0[^;]*\}\);/g) || [];
  assert.equal(pushes.length, 2, `esperava 2 pushes de truque em confirmarLevelUp, achei ${pushes.length}`);
  for (const push of pushes) assert.match(push, /classe: ctx\.classeQueSobe/, push);
});

test('guarda textual: criador e grimório carimbam truque; troca do Descanso carimba a classe DA TROCA', () => {
  assert.match(fonte('site/js/creator/passo-magias.js'),
    /personagem\.magias_conhecidas\.push\(\{ nome, circulo, \.\.\.\(personagem\.classe \? \{ classe: personagem\.classe \} : \{\}\) \}\)/);
  const grimorio = fonte('site/js/sheet/grimorio.js');
  assert.match(grimorio,
    /char\.magias_conhecidas\.push\(\{ nome: magiaSelecionada, circulo: 0, \.\.\.\(sup\?\.classe \? \{ classe: sup\.classe \} : \{\}\) \}\)/);
  // Achado Important 1 da revisão final #105/#61: o substituto da troca de
  // truque do Descanso Longo carimba `sup.classe` (a classe DA TROCA), não
  // mais a `classe` herdada do truque que saiu -- ver mostrarTrocaTruque.
  assert.match(grimorio, /if \(sup\?\.classe\) novo\.classe = sup\.classe;/);
});

test('guarda textual: subclasse_fixa e subclasse_escolha carimbam classe', () => {
  assert.match(fonte('site/js/levelup.js'),
    /push\(\{ nome, circulo: 0, origem: 'subclasse_fixa', classe: sub\.classe \}\)/);
  assert.match(fonte('site/js/regras-subclasse-escolhas.js'),
    /origem: 'subclasse_escolha', \.\.\.\(contexto\.classe \? \{ classe: contexto\.classe \} : \{\}\)/);
});
