// ============================================================
// Prova por navegador: "Copiar Magia para o Grimório" (Mago) precisa
// oferecer TODO círculo que o personagem já pode preparar -- não só os
// primeiros que couberem num teto de itens.
//
// Achado do debug de 2026-08-08 (systematic-debugging): renderGrimorio()
// em site/js/sheet/grimorio.js ordenava a lista inteira por círculo e
// cortava em .slice(0, 50) ANTES de agrupar por círculo. Com o grimório
// vazio, só o 1º e o 2º círculo de Mago já somam mais de 50 magias no
// catálogo -- o corte esgotava o teto antes de chegar ao 3º círculo, que
// desaparecia da lista inteiro, mesmo com espaços de magia de 3º círculo
// disponíveis. Reproduzido com um Mago nível 5 limpo (sem grimório prévio):
// o modal mostrava só "1º Círculo (31)" e "2º Círculo (19)" -- 31+19=50,
// a assinatura exata do corte. Corrigido: o limite agora é por círculo.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha } from './helpers-regras.mjs';

const ATRIBUTOS_MAGO = {
  forca: 10, destreza: 14, constituicao: 14,
  inteligencia: 16, sabedoria: 10, carisma: 10,
};

test('Mago nível 5, grimório vazio: o modal de cópia oferece o 1º, o 2º E o 3º círculo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', nivel: 5, xp: 6500,
    atributos: ATRIBUTOS_MAGO,
    pericias_proficientes: ['Arcanismo', 'Investigação'],
  }, 'regras-mago-grimorio-1');

  await page.locator('#btn-add-grimorio').click();
  await page.waitForSelector('#modal-overlay', { state: 'visible' });

  // O personagem tem espaços de 1º, 2º e 3º círculo (tabela do Mago,
  // nível 5) -- os três precisam aparecer como grupo, cada um com a
  // contagem completa do catálogo (grimório vazio, nada descontado).
  const grupos = page.locator('[data-grimorio-circulo]');
  await expect(grupos, 'deveria haver um grupo para cada círculo que o personagem pode preparar (1º, 2º, 3º)')
    .toHaveCount(3);

  const grupo3 = page.locator('[data-grimorio-circulo="3"]');
  await expect(grupo3, 'o 3º círculo não deveria desaparecer da lista mesmo com o 1º e o 2º somando mais de 50 magias')
    .toHaveCount(1);
  await expect(grupo3.locator('summary')).toContainText('3º Círculo (32)');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Mago nível 5: uma magia de 3º círculo pode ser copiada de verdade para o grimório', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', nivel: 5, xp: 6500,
    atributos: ATRIBUTOS_MAGO,
    pericias_proficientes: ['Arcanismo', 'Investigação'],
    moedas: { pl: 0, po: 200, pe: 0, pp: 0, pc: 0 },
  }, 'regras-mago-grimorio-2');

  await page.locator('#btn-add-grimorio').click();
  await page.waitForSelector('#modal-overlay', { state: 'visible' });

  const grupo3 = page.locator('[data-grimorio-circulo="3"]');
  await grupo3.locator('summary').click();
  await grupo3.locator('[data-grim-nome="Bola de Fogo"]').click();

  await expect(page.locator('.toast, [class*="toast"]').last(), 'deveria confirmar a cópia por toast')
    .toContainText('Bola de Fogo');

  const grimorioAtualizado = await page.evaluate(async () => {
    const estado = await import(new URL('./js/sheet/estado.js', location.href).href);
    return (estado.char.grimorio || []).some((m) => m.nome === 'Bola de Fogo' && m.circulo === 3);
  });
  expect(grimorioAtualizado, 'Bola de Fogo (3º círculo) deveria ter sido registrada no grimório do personagem')
    .toBe(true);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
