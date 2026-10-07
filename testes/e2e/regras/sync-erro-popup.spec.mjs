// ============================================================
// "! Erro ao salvar" do indicador de sync vira um toque que abre o detalhe da falha
// num campo copiável (no celular não dava para saber o motivo).
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha } from './helpers-regras.mjs';

/** Simula a falha de sync como o próprio módulo registra (código, mensagem e documento pesado). */
async function simularFalha(page) {
  await page.evaluate(async () => {
    const sync = await import('/site/js/sync.js');
    const err = Object.assign(new Error('Document exceeds the maximum size'), { name: 'FirebaseError', code: 'invalid-argument' });
    sync.reportarFalhaSync(err, { id: 'abc', acao: 'salvar', tentativas: 2, dados: { nome: 'Vorak', imagem: 'x'.repeat(6000), notas: 'ok' } });
  });
}

test('erro de sync: o texto fica clicável e o popup mostra o detalhe e copia', async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { page, erros } = await abrirFicha(context, { classe: 'Guerreiro', nivel: 1 }, 'sync-erro-popup');
  await expect(page.locator('[data-sync-erro]'), 'sem falha o texto não é um toque').toHaveCount(0);

  await simularFalha(page);
  const alvo = page.locator('[data-sync-erro]');
  await expect(alvo).toContainText('Erro ao salvar');
  await alvo.click();

  const campo = page.locator('#texto-erro-sync');
  await expect(campo).toBeVisible();
  const texto = await campo.inputValue();
  expect(texto).toContain('invalid-argument');
  expect(texto).toContain('Document exceeds the maximum size');
  expect(texto).toContain('Vorak');
  expect(texto, 'o campo que mais pesa aparece').toMatch(/Maiores campos: imagem/);
  expect(texto).toContain('Versão do app');
  await expect(campo, 'o campo é só de leitura, mas selecionável').toHaveAttribute('readonly', '');

  await page.locator('#btn-copiar-erro-sync').click();
  await expect(page.locator('#toast-container')).toContainText('Erro copiado');
  const copiado = await page.evaluate(() => navigator.clipboard.readText());
  const limpo = (s) => s.split(/\r?\n/).map((l) => l.trimEnd()).join('\n');
  expect(limpo(copiado), 'a área de transferência recebe o mesmo texto do campo').toBe(limpo(texto));
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
