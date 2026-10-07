// ============================================================
// Mago multiclasse com Bruxo (Magia de Pacto não soma ao nível de conjurador):
// o grimório da subida de nível oferece os círculos que os espaços do MAGO
// alcançam -- 2º até o nível 4 de Mago, 3º a partir do nível 5.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar } from './helpers-regras.mjs';

const XP = { 4: 6500, 5: 14000, 6: 23000 };

/** Mago `nivelMago` com 1 nível de Bruxo, pronto para subir o Mago. */
const MAGO_BRUXO = (nivelMago) => ({
  classe: 'Mago', subclasse: '', nivel: nivelMago + 1, xp: XP[nivelMago + 1], especie: 'Humano',
  atributos: { ...ATRIBUTOS_REGRAS, carisma: 14 },
  pericias_proficientes: ['Arcanismo', 'História'],
  classes: [
    { classe: 'Mago', subclasse: nivelMago >= 3 ? 'Abjurador' : '', nivel: nivelMago, ordem: 0 },
    { classe: 'Bruxo', subclasse: '', nivel: 1, ordem: 1 },
  ],
  schema_versao: 2,
});

/** Sobe o Mago e abre o grid do grimório; devolve os rótulos dos grupos de círculo. */
async function gruposDoGrimorio(context, nivelMago, id) {
  const { page } = await abrirFicha(context, MAGO_BRUXO(nivelMago), id);
  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false })).toBe(true);
  await page.locator('#levelup-escolha-classe input[name="classe-que-sobe"][data-classe="Mago"]').check();
  await assentar(page).catch(() => {});
  for (let i = 0; i < 6 && !(await page.locator('#btn-lvlup-grimorio').count()); i++) {
    if (!await page.locator('#btn-step-proximo').isEnabled().catch(() => false)) break;
    await page.locator('#btn-step-proximo').click();
    await assentar(page).catch(() => {});
  }
  await page.locator('#btn-lvlup-grimorio').click();
  await assentar(page).catch(() => {});
  return page.locator('#grid-magias details[data-grid-circulo] summary').allTextContents();
}

test('Mago 3 / Bruxo 1 subindo o Mago para 4: grimório só até o 2º círculo', async ({ context }) => {
  const grupos = await gruposDoGrimorio(context, 3, 'grim-circulos-mago4');
  expect(grupos.join('|')).toMatch(/2º/);
  expect(grupos.join('|')).not.toMatch(/3º/);
});

test('Mago 4 / Bruxo 1 subindo o Mago para 5: grimório oferece o 3º círculo', async ({ context }) => {
  const grupos = await gruposDoGrimorio(context, 4, 'grim-circulos-mago5');
  expect(grupos.join('|')).toMatch(/3º/);
});
