// ============================================================
// Issue #128 -- aviso de que, pelo livro, só o Mago (e o Artífice) troca truque no
// Descanso Longo. O app oferece a troca às outras classes por regra da casa.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { RAIZ } from './harness.mjs';

const { avisoTrocaTruqueForaDoLivro } = await import(
  pathToFileURL(resolve(RAIZ, 'site', 'js', 'regras-preparo-magias.js')).href
);

test('Mago e Artífice não recebem aviso: a troca é a regra do livro', () => {
  assert.equal(avisoTrocaTruqueForaDoLivro('Mago'), '');
  assert.equal(avisoTrocaTruqueForaDoLivro('Artífice'), '');
});

test('outras classes conjuradoras recebem o aviso com "só o Mago e o Artífice" e o nível', () => {
  for (const classe of ['Clérigo', 'Bardo', 'Bruxo', 'Druida', 'Feiticeiro', 'Paladino', 'Guardião']) {
    const texto = avisoTrocaTruqueForaDoLivro(classe);
    assert.match(texto, /só o Mago e o Artífice/, `${classe}: aviso sem "só o Mago e o Artífice"`);
    assert.match(texto, /subir de nível/, `${classe}: aviso sem a regra de subida de nível`);
    assert.doesNotMatch(texto, /[<>]/, `${classe}: aviso é texto puro`);
  }
});

test('classe vazia ou desconhecida também recebe o aviso (não é Mago)', () => {
  assert.match(avisoTrocaTruqueForaDoLivro(''), /só o Mago e o Artífice/);
  assert.match(avisoTrocaTruqueForaDoLivro(undefined), /só o Mago e o Artífice/);
});
