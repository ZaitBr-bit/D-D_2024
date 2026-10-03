// ============================================================
// Issue #83 -- modificadores temporarios manuais (CA, iniciativa,
// deslocamento, CD de magia): o jogador cria pelo modal "Modificadores"
// do card de Condicoes e os numeros da ficha mudam; remover volta; o
// Descanso Longo limpa. Clique real em cada controle novo.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const CLERIGO = {
  classe: 'Clérigo', nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Religião', 'Medicina'],
};

/** Valor numérico exibido num stat-box pelo rótulo exato (ex.: "CA", "Iniciativa"). */
async function stat(page, rotulo) {
  return page.evaluate((r) => {
    const el = [...document.querySelectorAll('.stat-label')].find(e => e.textContent.trim().startsWith(r));
    const txt = el?.parentElement?.querySelector('.stat-value')?.textContent || '';
    const m = txt.replace(/\s+/g, ' ').match(/[+-]?\d+/);
    return m ? Number(m[0]) : null;
  }, rotulo);
}

async function abrirModal(page) {
  await clicarSeletorFicha(page, '#btn-modificadores', { esperar: '#mod-alvo' });
}

async function adicionar(page, alvo, valor, nome = '') {
  await page.selectOption('#mod-alvo', alvo);
  await page.fill('#mod-valor', String(valor));
  if (nome) await page.fill('#mod-nome', nome);
  await page.click('#btn-adicionar-modificador');
  await assentar(page).catch(() => {});
  await page.waitForSelector('#mod-alvo', { state: 'visible' });
}

test('CA, iniciativa, CD de magia e deslocamento sobem com os modificadores e voltam ao remover', async ({ context }) => {
  const { page } = await abrirFicha(context, CLERIGO, 'regras-issue-83-a');
  await assentar(page).catch(() => {});
  const antes = {
    ca: await stat(page, 'CA'), ini: await stat(page, 'Iniciativa'),
    cd: await stat(page, 'CD Magia'), desl: await stat(page, 'Deslocamento'),
  };
  expect(Object.values(antes).every(v => v !== null)).toBe(true);

  await abrirModal(page);
  await adicionar(page, 'ca', 3, 'Armadura Arcana (Aliado)');
  await adicionar(page, 'iniciativa', 2);
  await adicionar(page, 'cd_magia', 1, 'Pingente do Mago');
  await adicionar(page, 'deslocamento', 3, 'Passos Largos do aliado');
  await expect(page.locator('#modal-corpo, .modal-corpo').last()).toContainText('Armadura Arcana (Aliado)');
  await page.evaluate(() => window.fecharModal());
  await assentar(page).catch(() => {});

  expect(await stat(page, 'CA')).toBe(antes.ca + 3);
  expect(await stat(page, 'Iniciativa')).toBe(antes.ini + 2);
  expect(await stat(page, 'CD Magia')).toBe(antes.cd + 1);
  expect(await stat(page, 'Deslocamento')).toBe(antes.desl + 3);

  // Remover um por um pelo × do modal volta o valor.
  await abrirModal(page);
  while (await page.locator('[data-modificador-remover]').count() > 0) {
    await page.locator('[data-modificador-remover]').first().click();
    await assentar(page).catch(() => {});
    await page.waitForSelector('#mod-alvo', { state: 'visible' });
  }
  await page.evaluate(() => window.fecharModal());
  await assentar(page).catch(() => {});
  expect(await stat(page, 'CA')).toBe(antes.ca);
  expect(await stat(page, 'Iniciativa')).toBe(antes.ini);
  expect(await stat(page, 'CD Magia')).toBe(antes.cd);
  expect(await stat(page, 'Deslocamento')).toBe(antes.desl);
});

test('valor vazio ou zero é recusado e nada é gravado', async ({ context }) => {
  const { page } = await abrirFicha(context, CLERIGO, 'regras-issue-83-b');
  await assentar(page).catch(() => {});
  await abrirModal(page);
  await page.click('#btn-adicionar-modificador');
  await expect(page.locator('#mod-erro')).toContainText('inteiro diferente de zero');
  await page.fill('#mod-valor', '0');
  await page.click('#btn-adicionar-modificador');
  await expect(page.locator('#mod-erro')).toBeVisible();
  expect(((await personagemSalvo(page)).efeitos_magicos || []).filter(e => e.manual)).toHaveLength(0);
});

test('o Descanso Longo remove os modificadores manuais', async ({ context }) => {
  const { page } = await abrirFicha(context, CLERIGO, 'regras-issue-83-c');
  await assentar(page).catch(() => {});
  const caAntes = await stat(page, 'CA');
  await abrirModal(page);
  await adicionar(page, 'ca', 2, 'Escudo da Fé do aliado');
  await page.evaluate(() => window.fecharModal());
  await assentar(page).catch(() => {});
  expect(await stat(page, 'CA')).toBe(caAntes + 2);

  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  await page.evaluate(() => window.fecharModal());
  await assentar(page).catch(() => {});
  expect(((await personagemSalvo(page)).efeitos_magicos || []).filter(e => e.manual)).toHaveLength(0);
  expect(await stat(page, 'CA')).toBe(caAntes);
});
