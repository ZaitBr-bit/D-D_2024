// ============================================================
// Truque concedido pela subclasse (Raio de Gelo do Círculo do Mar) gravado como magia preparada de
// 1º círculo: a busca da descrição olhava o 1º círculo e não achava. A ficha antiga passa a ter o
// truque em magias_conhecidas, círculo 0, e o popup mostra a descrição.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

test('ficha antiga: Raio de Gelo de domínio vira truque e abre o popup com a descrição', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Druida', subclasse: 'Círculo do Mar', nivel: 3, xp: 900,
    atributos: { forca: 10, destreza: 14, constituicao: 14, inteligencia: 10, sabedoria: 16, carisma: 10 },
    magias_preparadas: [{ nome: 'Raio de Gelo', circulo: 1, origem: 'dominio' }],
  }, 'regras-truque-dominio-descricao');

  await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); });
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect((salvo.magias_preparadas || []).some((m) => m.nome === 'Raio de Gelo'), 'saiu das preparadas').toBe(false);
  const truque = (salvo.magias_conhecidas || []).find((m) => m.nome === 'Raio de Gelo');
  expect(truque?.circulo, 'truque de círculo 0').toBe(0);
  expect(truque?.origem).toBe('dominio');

  const card = page.locator('.magia-item[data-magia-nome="Raio de Gelo"]').first();
  await expect(card).toHaveAttribute('data-magia-circ', '0');
  await card.locator('.magia-nome').click();
  await expect(card.locator('.magia-desc'), 'descrição carregada ao expandir').toContainText(/feixe congelante/);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
