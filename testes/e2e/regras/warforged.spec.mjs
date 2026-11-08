// ============================================================
// Espécie Warforged (Eberron: Forge of the Artificer): chip de origem no
// passo de espécie e escolhas de perícia e ferramenta de Projeto Especializado.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirSite, abrirFicha, abrirIdentidade, marcarCondicao, assentar, confirmarModal, satisfazerPasso, personagemEmCriacao } from './helpers-regras.mjs';

/** Leva o criador até o passo de Espécie escolhendo Guerreiro (mesma semente de renascido.spec.mjs). */
async function irAtePassoEspecie(page) {
  await assentar(page).catch(() => {});
  await page.click('[data-classe="Guerreiro"]');
  await confirmarModal(page, 'popup-confirmar-classe').catch(() => {});
  for (let i = 0; i < 8; i++) {
    if (await page.locator('[data-especie]').count()) return true;
    if (!await satisfazerPasso(page)) return false;
    await assentar(page).catch(() => {});
  }
  return (await page.locator('[data-especie]').count()) > 0;
}

test('criador: Warforged tem chip Eberron, exige perícia e ferramenta e grava as escolhas', async ({ context }) => {
  const { page, erros } = await abrirSite(context, '#criar');
  expect(await irAtePassoEspecie(page), 'o criador deveria chegar ao passo de Espécie').toBe(true);

  const card = page.locator('[data-especie="Warforged"]');
  await expect(card).toBeVisible();
  const chip = card.locator('.selo-fonte[data-fonte="eberron"]');
  await expect(chip).toBeVisible();
  await chip.click();
  const pop = page.locator('.popover-fonte[data-popover-fonte="eberron"]');
  await expect(pop).toContainText('Suplemento 5');
  await page.keyboard.press('Escape');

  await card.locator('.opcao-resumo').click();
  await expect(page.locator('#modal-overlay')).toBeVisible();

  // Sem perícia nem ferramenta a confirmação recusa.
  await page.click('#popup-confirmar-especie');
  await expect(page.locator('#modal-overlay')).toBeVisible();

  // Só a perícia: ainda recusa.
  await page.selectOption('#select-pericia-especie', 'História');
  await page.click('#popup-confirmar-especie');
  await expect(page.locator('#modal-overlay')).toBeVisible();

  await page.selectOption('#select-ferramenta-especie', 'Ferramentas de Ladrão');
  await page.click('#popup-confirmar-especie');
  await assentar(page).catch(() => {});

  const p = await personagemEmCriacao(page);
  expect(p.especie).toBe('Warforged');
  expect(p.pericia_especie).toBe('História');
  expect(p.ferramenta_especie).toBe('Ferramentas de Ladrão');

  // Trocar para espécie sem essa escolha descarta a ferramenta e a perícia.
  await page.locator('[data-especie="Anão"] .opcao-resumo').click();
  await page.click('#popup-confirmar-especie');
  await assentar(page).catch(() => {});
  const q = await personagemEmCriacao(page);
  expect(q.especie).toBe('Anão');
  expect(q.ferramenta_especie).toBeUndefined();
  expect(q.pericia_especie).toBeUndefined();
  expect(erros, erros.join('; ')).toEqual([]);
});

/** Lê o número da CA exibido na ficha. */
async function lerCA(page) {
  const txt = await page.locator('.stat-box:has(.stat-label:text-is("CA")) .stat-value').first().innerText();
  return parseInt(txt, 10);
}

test('ficha: Warforged mostra chip, escolhas, CA +1, resistência a Venenoso e Vantagem contra Envenenado', async ({ context }) => {
  const base = {
    classe: 'Guerreiro', nivel: 1, atributos: ATRIBUTOS_REGRAS, schema_versao: 2,
    pericias_proficientes: ['Atletismo', 'Percepção', 'História'],
  };
  const humano = await abrirFicha(context, { ...base, especie: 'Humano' }, 'regras-warforged-humano');
  const caHumano = await lerCA(humano.page);
  await humano.page.close();

  const { page, erros } = await abrirFicha(context, {
    ...base, especie: 'Warforged', pericia_especie: 'História', ferramenta_especie: 'Ferramentas de Ladrão',
    resistencias: ['Venenoso'],
  }, 'regras-warforged-ficha');
  await assentar(page).catch(() => {});
  await abrirIdentidade(page);

  await expect(page.locator('#app-content .selo-fonte[data-fonte="eberron"]').first()).toBeVisible();

  await page.locator('summary', { hasText: 'Projeto Especializado' }).click();
  await expect(page.locator('text=Perícia escolhida: História')).toBeVisible();
  await expect(page.locator('text=Ferramenta escolhida: Ferramentas de Ladrão')).toBeVisible();

  expect(await lerCA(page)).toBe(caHumano + 1);
  await expect(page.locator('#app-content')).toContainText(/Resistencias:\s*Venenoso/);

  await marcarCondicao(page, 'Envenenado');
  const selo = page.locator('.salva-item', { hasText: 'Constituição' }).locator('.pericia-vd-badge.vantagem');
  await expect(selo).toHaveText('V');
  await expect(selo).toHaveAttribute('data-vd-info', /Resiliência de Construto/);
  expect(erros, erros.join('; ')).toEqual([]);
});
