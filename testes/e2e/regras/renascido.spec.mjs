// ============================================================
// Espécie Renascido (Ravenloft: Horrors Within, p. 73): chip de origem no
// passo de espécie, escolhas de Resistência Estranha e da perícia de
// Conhecimento de uma Vida Passada, e na ficha o contador do 1d6, as
// escolhas e o lembrete de Vantagem nas Salvaguardas Contra a Morte.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirSite, abrirFicha, assentar, confirmarModal, satisfazerPasso, personagemEmCriacao, personagemSalvo } from './helpers-regras.mjs';

const NOME_LIVRO = 'Ravenloft: Horrors Within';
const CHAVE_VIDA_PASSADA = 'especie_Conhecimento de uma Vida Passada';

/** Clica no chip, confere o popover com o nome do livro e fecha com Esc. */
async function conferirChip(page, chip) {
  await expect(chip).toBeVisible();
  await chip.click();
  const pop = page.locator('.popover-fonte[data-popover-fonte="ravenloft"]');
  await expect(pop).toBeVisible();
  await expect(pop).toContainText(NOME_LIVRO);
  await page.keyboard.press('Escape');
  await expect(pop).toHaveCount(0);
}

/** Leva o criador até o passo de Espécie escolhendo Guerreiro (mesma semente de especie-criador.spec.mjs). */
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

test('criador: Renascido tem chip Ravenloft, pede resistência e perícia e grava as escolhas', async ({ context }) => {
  const { page, erros } = await abrirSite(context, '#criar');
  expect(await irAtePassoEspecie(page), 'o criador deveria chegar ao passo de Espécie').toBe(true);

  const card = page.locator('[data-especie="Renascido"]');
  await expect(card).toBeVisible();
  // O chip abre o popover sem abrir o popup da espécie.
  await conferirChip(page, card.locator('.selo-fonte[data-fonte="ravenloft"]'));
  await expect(page.locator('#modal-overlay')).not.toBeVisible();
  await expect(page.locator('[data-especie="Elfo"] .selo-fonte')).toHaveCount(0);

  await card.locator('.opcao-resumo').click();
  const corpo = page.locator('#modal-corpo');
  await conferirChip(page, corpo.locator('.selo-fonte[data-fonte="ravenloft"]'));

  const opcoes = await corpo.locator('[data-traco-escolha]').evaluateAll((els) => els.map((e) => e.dataset.tracoEscolha));
  expect(opcoes).toEqual(['Gélido', 'Necrótico', 'Venenoso']);

  // Sem as escolhas a confirmação recusa.
  await page.click('#popup-confirmar-especie');
  await expect(page.locator('#modal-overlay')).toBeVisible();

  await corpo.locator('[data-traco-escolha="Necrótico"]').click();
  await page.selectOption('#select-pericia-especie', 'História');
  await page.click('#popup-confirmar-especie');
  await assentar(page).catch(() => {});

  const p = await personagemEmCriacao(page);
  expect(p.especie).toBe('Renascido');
  expect(p.tracos_escolhidos).toEqual(['Necrótico']);
  expect(p.pericia_especie).toBe('História');
  await conferirChip(page, page.locator('.selecao-resumo .selo-fonte[data-fonte="ravenloft"]'));
  expect(erros, erros.join('; ')).toEqual([]);
});

test('ficha: chips, escolhas, contador do 1d6 e lembrete de Vantagem contra a morte', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', nivel: 5, xp: 6500, especie: 'Renascido',
    tracos_escolhidos: ['Necrótico'], pericia_especie: 'História', resistencias: ['Necrótico'],
    pericias_proficientes: ['Atletismo', 'Percepção', 'História'],
    atributos: ATRIBUTOS_REGRAS, pv_max: 40, pv_atual: 0, schema_versao: 2,
  }, 'regras-renascido-ficha');
  await assentar(page).catch(() => {});

  const chips = page.locator('#app-content .selo-fonte[data-fonte="ravenloft"]');
  await expect(chips).toHaveCount(2);
  await conferirChip(page, chips.nth(0));
  await conferirChip(page, chips.nth(1));

  await expect(page.locator('[data-lembrete-morte]')).toContainText('Vantagem (Renascido)');

  await page.locator('summary', { hasText: 'Resistência Estranha' }).click();
  await expect(page.locator('text=Resistência escolhida: Necrótico')).toBeVisible();

  const resumoVida = page.locator('summary', { hasText: 'Conhecimento de uma Vida Passada' });
  await expect(resumoVida).toContainText('3/3');
  await resumoVida.click();
  await expect(page.locator('text=Perícia escolhida: História')).toBeVisible();
  await page.click('[data-vida-passada]');
  await expect(page.locator('.toast').last()).toContainText('1d6');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo.usos_habilidades?.[CHAVE_VIDA_PASSADA]).toBe(1);
  await expect(page.locator('summary', { hasText: 'Conhecimento de uma Vida Passada' })).toContainText('2/3');
  expect(erros, erros.join('; ')).toEqual([]);
});
