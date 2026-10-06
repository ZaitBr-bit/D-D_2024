// ============================================================
// Issue #128 -- o modal do Descanso Longo e o modal "Trocar Truque" avisam
// que, pelo livro, só o Mago e o Artífice trocam truque no Descanso Longo.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, clicarBotaoFicha, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const CLERIGO_3 = {
  classe: 'Clérigo', nivel: 3, xp: 355000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['História', 'Religião'],
  magias_conhecidas: [{ nome: 'Chama Sagrada', circulo: 0 }],
  magias_preparadas: [{ nome: 'Curar Ferimentos', circulo: 1 }, { nome: 'Bênção', circulo: 1 }],
};

const MAGO_3 = {
  classe: 'Mago', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
  magias_conhecidas: [{ nome: 'Raio de Fogo', circulo: 0 }],
  grimorio: [{ nome: 'Mísseis Mágicos', circulo: 1 }],
  magias_preparadas: [{ nome: 'Mísseis Mágicos', circulo: 1, classe: 'Mago' }],
};

test('Clérigo: o modal do Descanso Longo e o de Trocar Truque trazem o aviso', async ({ context }) => {
  const { page } = await abrirFicha(context, CLERIGO_3, 'regras-issue-128-a');
  await clicarBotaoFicha(page, 'btn-descanso-longo', { esperar: '#modal-overlay' });
  await assentar(page);
  await expect(page.locator('#modal-corpo')).toContainText('só o Mago e o Artífice trocam truque no Descanso Longo');

  await page.locator('#btn-trocar-truque-dl').click();
  await assentar(page);
  await expect(page.locator('#modal-corpo').last()).toContainText('só o Mago e o Artífice trocam truque no Descanso Longo');
});

test('Mago: nenhum dos dois modais traz o aviso (contraste)', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_3, 'regras-issue-128-b');
  await clicarBotaoFicha(page, 'btn-descanso-longo', { esperar: '#modal-overlay' });
  await assentar(page);
  await expect(page.locator('#btn-trocar-truque-dl')).toBeVisible();
  await expect(page.locator('#modal-corpo')).not.toContainText('só o Mago e o Artífice trocam truque');

  await page.locator('#btn-trocar-truque-dl').click();
  await assentar(page);
  await expect(page.locator('#modal-corpo').last()).not.toContainText('só o Mago e o Artífice trocam truque');
});

test('Clérigo 3/Mago 3: aviso só na troca feita pela superfície do Clérigo', async ({ context }) => {
  const MULTI = {
    classe: 'Clérigo', nivel: 6, xp: 14000, atributos: ATRIBUTOS_REGRAS,
    classes: [{ classe: 'Clérigo', subclasse: '', nivel: 3, ordem: 0 }, { classe: 'Mago', subclasse: '', nivel: 3, ordem: 1 }],
    magias_conhecidas: [{ nome: 'Chama Sagrada', circulo: 0, classe: 'Clérigo' }, { nome: 'Raio de Fogo', circulo: 0, classe: 'Mago' }],
    schema_versao: 2,
  };
  const { page } = await abrirFicha(context, MULTI, 'regras-issue-128-c');
  await clicarBotaoFicha(page, 'btn-descanso-longo', { esperar: '#modal-overlay' });
  await assentar(page);
  // A superfície ativa por padrão é a primeira (Clérigo): o parágrafo do modal nomeia a Clérigo e traz o aviso.
  await expect(page.locator('#modal-corpo')).toContainText('lista de Clérigo');
  await expect(page.locator('#modal-corpo')).toContainText('só o Mago e o Artífice trocam truque no Descanso Longo');
});
