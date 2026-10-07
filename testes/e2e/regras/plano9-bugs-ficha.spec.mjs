// ============================================================
// Plano 9, Task 1 -- bugs de ficha vistos na tela:
//  1.2 "+ Talento" com ASI de Constituição ajusta o PV (com e sem Amuleto);
//  1.3 Exaustão reduz também a velocidade extra fixa de item;
//  1.4 Guardião multiclasse mostra Visão às Cegas nos sentidos.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

const AMULETO = () => ({ nome: 'Amuleto da Saúde', tipo: 'magico', equipado: true, sintonizado: true,
  dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'constituicao', minimo: 19 }] } });

/** Abre "+ Talento", escolhe "Aumento no Valor de Atributo" com +2 em Constituição e confirma. */
async function adicionarAumentoCon(page) {
  await page.click('#btn-add-talento');
  await page.waitForSelector('#add-talento-lista', { state: 'visible', timeout: 5000 });
  const card = page.locator('#add-talento-lista .opcao-card[data-opcao="Aumento no Valor de Atributo"]');
  await card.waitFor({ state: 'visible', timeout: 5000 });
  await card.locator('.opcao-check').click();
  await page.click('#btn-confirmar-add-talento');
  await page.waitForSelector('#levelup-talento-attr-constituicao', { state: 'visible', timeout: 5000 });
  await page.selectOption('#levelup-talento-attr-constituicao', '2');
  await page.click('#btn-confirmar-add-talento-asi');
  await assentar(page).catch(() => {});
}

test('1.2 ficha: + Talento com +2 em Constituição (14 para 16) sobe PV máximo e atual em 4 (nível 4)', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', nivel: 4, xp: 2700, atributos: ATRIBUTOS_REGRAS, talentos: [],
  }, 'regras-plano9-talento-con-pv');
  await assentar(page).catch(() => {});
  const antes = await personagemSalvo(page);
  const pvTelaAntes = await page.locator('.hp-pv-value').innerText();
  expect(pvTelaAntes.replace(/\s+/g, '')).toBe(`${antes.pv_atual}/${antes.pv_max}`);

  await adicionarAumentoCon(page);

  const depois = await personagemSalvo(page);
  expect(depois.atributos.constituicao).toBe(16);
  expect(depois.pv_max - antes.pv_max).toBe(4);
  expect(depois.pv_atual - antes.pv_atual).toBe(4);
  await expect(page.locator('.hp-pv-value')).toHaveText(new RegExp(`${depois.pv_atual}\\s*/\\s*${depois.pv_max}`));
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('1.2 ficha: + Talento de Constituição com Amuleto da Saúde não muda o PV atual', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', nivel: 4, xp: 2700, atributos: ATRIBUTOS_REGRAS, talentos: [],
    inventario: [AMULETO()],
  }, 'regras-plano9-talento-con-pv-amuleto');
  await assentar(page).catch(() => {});
  const antes = await personagemSalvo(page);

  await adicionarAumentoCon(page);

  const depois = await personagemSalvo(page);
  expect(depois.atributos.constituicao).toBe(16);
  expect(depois.pv_atual).toBe(antes.pv_atual);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('1.3 ficha: Exaustão 2 com Anel de Natação (12 m) mostra Deslocamento 6 e Natação 9 m', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', subclasse: '', nivel: 5, xp: 6500, especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Atletismo', 'História'], exaustao: 2, condicoes: ['Exaustão'],
    inventario: [{ nome: 'Anel de Natação', tipo: 'magico', equipado: true, sintonizado: true,
      dados: { magico_id: 'anel de natacao', requer_sintonizacao: true, efeitos: [{ alvo: 'deslocamento', modo: 'natacao', metros: 12 }] } }],
  }, 'regras-plano9-exaustao-natacao');
  await assentar(page).catch(() => {});
  const box = page.locator('.stat-box', { hasText: 'Deslocamento' });
  await expect(box.locator('.stat-value')).toHaveText('6metros');
  await expect(box).toContainText('Natação 9m');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('1.4 ficha: Ladino 1 / Guardião 18 mostra Visão às Cegas 9 m em Sentidos Passivos', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    nome: 'LG', especie: 'Humano', classe: 'Ladino', subclasse: '', nivel: 19, xp: 305000, atributos: ATRIBUTOS_REGRAS,
    classes: [
      { classe: 'Ladino', subclasse: '', nivel: 1, ordem: 0 },
      { classe: 'Guardião', subclasse: '', nivel: 18, ordem: 1 },
    ],
    schema_versao: 2,
  }, 'regras-plano9-guardiao-multi-cegas');
  await assentar(page).catch(() => {});
  const card = page.locator('.card', { has: page.locator('h2', { hasText: 'Sentidos Passivos' }) });
  await expect(card.locator('.salva-item', { hasText: 'Visão às Cegas' })).toContainText('9 m');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
