// ============================================================
// Issue #122 -- abrir a ficha (que roda as migracoes) nao pode mudar
// atualizado_em; editar de verdade muda.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, abrirSite, assentar, personagemSalvo, ATRIBUTOS_REGRAS, NOVO } from './helpers-regras.mjs';
import { semearPersonagem } from '../helpers.mjs';

// Mago com magia preparada que nao esta no grimorio (ficha legada): a
// abertura da ficha move a magia para o grimorio e GRAVA (salvar()).
const MAGO_5_LEGADO = {
  nome: 'Aluno', especie: 'Humano', classe: 'Mago', subclasse: '',
  nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  magias_preparadas: [{ nome: 'Mísseis Mágicos', circulo: 1 }], grimorio: [],
  classes: [{ classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 }],
  schema_versao: 2
};

test('abrir a ficha mantém o atualizado_em; editar de verdade muda', async ({ context }) => {
  const { page } = await abrirSite(context);
  await semearPersonagem(page, MAGO_5_LEGADO, 'regras-issue-122-a');
  const semeado = (await personagemSalvo(page)).atualizado_em;
  await page.waitForTimeout(20);
  await page.goto(`${NOVO}#ficha/regras-issue-122-a`, { waitUntil: 'domcontentloaded' });
  await assentar(page).catch(() => {});
  // A abertura roda as migracoes e grava: o carimbo semeado tem de sobreviver.
  const b = (await personagemSalvo(page)).atualizado_em;
  expect(b, 'abrir sem editar não pode carimbar').toBe(semeado);

  await page.waitForTimeout(20);
  await page.evaluate(async () => {
    const e = await import(new URL('./js/sheet/estado.js', location.href).href);
    e.char.notas = 'editado';
    e.salvar();
  });
  const c = (await personagemSalvo(page)).atualizado_em;
  expect(c, 'edição real tem de carimbar').not.toBe(b);
});

test('a abertura realmente gravou a migração (a fixture exercita o salvar)', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5_LEGADO, 'regras-issue-122-b');
  await assentar(page).catch(() => {});
  const salvo = await personagemSalvo(page);
  expect(salvo.grimorio.some(m => m.nome === 'Mísseis Mágicos')).toBe(true);
});
