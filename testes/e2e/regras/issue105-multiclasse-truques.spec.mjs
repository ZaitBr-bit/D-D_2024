// ============================================================
// Issue #105, o fluxo do relato: Mago com truques gravados SEM classe (o
// criador não carimbava) abre a ficha, sobe um nível entrando no Clérigo,
// escolhe os 3 truques do Clérigo, e o "Preparar Magias" que abre sozinho
// mostra 3/3 -- não 0/3. Depois, na superfície do Mago, também 3/3.
// Fluxo do assistente copiado de multiclasse-ordem-classe.spec.mjs (#59).
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const CARD_CLASSE = '#levelup-escolha-classe';
const CONFIRMAR = '#btn-confirmar-levelup';
const STEP_ATIVO = '.levelup-step-ativo .levelup-step-label';

/** Radio de uma classe no step de escolha de classe do assistente. */
function radioClasse(page, nome) {
  return page.locator(`${CARD_CLASSE} input[name="classe-que-sobe"][data-classe="${nome}"]`);
}

/** Vai direto a um step pela barra de progresso do assistente. */
async function irParaStep(page, rotulo) {
  await page.locator('.levelup-progress .levelup-step', { hasText: rotulo }).click();
  await assentar(page).catch(() => {});
  await expect(page.locator(STEP_ATIVO)).toHaveText(rotulo);
}

/** Abre a grade de truques do assistente e marca os N primeiros disponíveis. */
async function escolherTruquesQuaisquer(page, quantidade) {
  await page.locator('#btn-lvlup-truques').click();
  await page.waitForSelector('#modal-overlay', { state: 'visible' });
  const checks = page.locator('[data-grid-check]');
  for (let i = 0; i < quantidade; i++) await checks.nth(i).click();
  await page.locator('.modal-acoes button', { hasText: 'Confirmar Seleção' }).click();
  await assentar(page).catch(() => {});
}

test('#105: Mago com truques sem classe entra no Clérigo -- Preparar Magias mostra 3/3 nas duas classes', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', subclasse: '', nivel: 3, xp: 900,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS, pericias_proficientes: ['Arcanismo', 'História'],
    magias_conhecidas: [
      { nome: 'Raio de Fogo', circulo: 0 }, { nome: 'Toque Chocante', circulo: 0 }, { nome: 'Reparar', circulo: 0 },
    ],
  }, 'regras-105-fluxo');

  // A migração da abertura (classe única) carimba os três no Mago.
  await expect.poll(async () => (await personagemSalvo(page))?.magias_conhecidas?.every((m) => m.classe === 'Mago'),
    { message: 'os truques do Mago tinham de ser carimbados na abertura, ainda como classe única' }).toBe(true);

  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false })).toBe(true);
  await radioClasse(page, 'Clérigo').click();
  await expect(page.locator(CARD_CLASSE)).toHaveAttribute('data-classe-ctx', 'Clérigo');
  await assentar(page).catch(() => {});

  // Protetor não soma truque (Taumaturgo somaria +1).
  await irParaStep(page, 'Ordem Divina/Primal');
  await page.locator('#select-ordem-classe-nova').selectOption('Protetor');
  await assentar(page).catch(() => {});
  await irParaStep(page, 'Seleção de Magias');
  await escolherTruquesQuaisquer(page, 3);
  await irParaStep(page, 'Revisão e Confirmação');
  await page.locator(CONFIRMAR).click();
  await assentar(page).catch(() => {});

  await expect.poll(async () => (await personagemSalvo(page))?.magias_conhecidas
    ?.filter((m) => m.classe === 'Clérigo').length, { message: 'os 3 truques escolhidos saem carimbados Clérigo' }).toBe(3);

  await expect(page.locator('text=Subida de Nível Concluída!')).toBeVisible();
  await page.locator('.modal-container button', { hasText: 'OK' }).click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#modal-titulo')).toHaveText('Preparar Magias');
  await expect(page.locator('#gm-contador-truques'), 'o relato via 0/3 aqui').toHaveText(/Truques: 3\/3/);
  await page.evaluate(() => window.fecharModal());
  await assentar(page).catch(() => {});

  await clicarSeletorFicha(page, '[data-tab-superficie="Mago"]', { esperar: '[data-tab-superficie="Mago"].active' });
  await page.click('#btn-add-magia');
  await page.waitForSelector('#resultado-magias', { state: 'visible', timeout: 20_000 });
  await expect(page.locator('#gm-contador-truques'), 'o Mago continua com os próprios 3').toHaveText(/Truques: 3\/3/);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
