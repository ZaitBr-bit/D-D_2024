// ============================================================
// Quais armas podem receber Maestria em Arma.
//
// O texto do livro difere por classe (dados/classes/*.json,
// característica "Maestria em Arma" de nível 1):
//   Bárbaro   -- "dois tipos de armas Corpo a Corpo Simples ou Marciais"
//   Guerreiro -- "três tipos de armas Simples ou Marciais"
//   Guardião, Paladino, Ladino -- "armas à sua escolha com as quais você
//                                  tem proficiência"
//
// O motor roda contra o arquivo de armas REAL (dados/equipamento/armas.json),
// e não contra armas inventadas aqui, porque o bug que originou este
// arquivo era de FORMATO do dado: `propriedades` é uma string
// ("Acuidade, Arremesso (Alcance 6/18), Leve"), e a tela de maestrias
// tratava como lista -- `(a.propriedades || []).map` lançava TypeError e o
// modal do Ladino não abria, nem pelo botão "Definir Maestrias" nem pelo
// "Trocar Maestrias" do Descanso Longo.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modulosApp, RAIZ } from './harness.mjs';

const { equip } = await modulosApp();

const ARMAS = JSON.parse(readFileSync(
  resolve(RAIZ, 'dados/equipamento/armas.json'), 'utf-8')).armas;

/** Nomes das armas elegíveis para maestria, para a classe informada. */
function elegiveis(classe) {
  return equip.armasElegiveisMaestria({ classe }, ARMAS).map(a => a.nome);
}

test('o arquivo de armas guarda `propriedades` como string -- quem consumir tem de tratar assim', () => {
  const forasDeFormato = ARMAS.filter(a => a.propriedades != null && typeof a.propriedades !== 'string');
  assert.deepEqual(forasDeFormato.map(a => a.nome), [],
    'alguma arma passou a ter `propriedades` fora de string: os consumidores fazem .toLowerCase() nela');
});

test('Maestria em Arma: a lista não lança e não vem vazia para nenhuma das cinco classes', () => {
  for (const classe of ['Bárbaro', 'Guerreiro', 'Guardião', 'Paladino', 'Ladino']) {
    const lista = elegiveis(classe);
    assert.ok(lista.length > 0, `${classe} ficou sem nenhuma arma elegível para maestria`);
  }
});

test('Ladino: maestria só nas armas com que tem proficiência -- Simples, e Marciais com Acuidade ou Leve', () => {
  const lista = elegiveis('Ladino');

  assert.ok(lista.includes('Adaga'), 'Simples deveria entrar');
  assert.ok(lista.includes('Arco Curto'), 'o próprio livro cita Arcos Curtos como exemplo do Ladino');
  assert.ok(lista.includes('Rapieira'), 'Marcial com Acuidade deveria entrar');
  // Classes.md:4152 dá as DUAS propriedades ao Ladino (Acuidade ou Leve);
  // a tela de maestrias conferia só Acuidade.
  assert.ok(lista.includes('Besta de Mão'), 'Marcial com Leve deveria entrar');
  assert.ok(!lista.includes('Espada Longa'), 'Marcial sem Acuidade nem Leve não deveria entrar');
});

test('Bárbaro: maestria só em armas Corpo a Corpo', () => {
  const lista = elegiveis('Bárbaro');
  assert.ok(lista.includes('Machado Grande'), 'o livro cita Machados Grandes como exemplo do Bárbaro');
  assert.ok(!lista.includes('Arco Longo'), 'arma à distância não entra na maestria do Bárbaro');
});

test('Guerreiro: maestria em qualquer Simples ou Marcial, inclusive à distância', () => {
  const lista = elegiveis('Guerreiro');
  assert.ok(lista.includes('Espada Longa'));
  assert.ok(lista.includes('Arco Longo'));
});

test('Maestria em Arma: proficiência extra de subclasse entra na lista', () => {
  // Clérigo Protetor recebe "Armas Marciais"; o mesmo campo que a
  // proficiência usa vale para a maestria (mesma função).
  const semExtra = equip.armasElegiveisMaestria({ classe: 'Ladino' }, ARMAS).map(a => a.nome);
  const comExtra = equip.armasElegiveisMaestria(
    { classe: 'Ladino', proficiencias_extra: ['Armas Marciais'] }, ARMAS).map(a => a.nome);
  assert.ok(!semExtra.includes('Espada Longa'));
  assert.ok(comExtra.includes('Espada Longa'),
    'a proficiência extra não chegou à lista de maestrias');
});
