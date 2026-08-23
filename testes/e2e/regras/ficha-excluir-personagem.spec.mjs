// ============================================================
// Excluir Personagem, na ficha: o botão de confirmação apaga de verdade.
//
// `#btn-excluir-char` (site/js/sheet/ficha.js) só abre um modal; quem
// chama `removerPersonagem` e volta para a home é `#btn-confirmar-del`
// (site/js/sheet/hp-descanso.js). Nenhum spec clicava nesse segundo botão
// -- afirmar que o modal APARECE é exatamente a cobertura de fachada que o
// guarda de gatilhos existe para proibir.
//
// Exclusão é destrutiva e sem desfazer ("Excluir <nome> permanentemente?"),
// então o teste semeia DOIS personagens: assim ele prova não só que o alvo
// sumiu, mas que o outro continuou lá -- um `localStorage.clear()`
// disfarçado passaria na primeira asserção e falharia na segunda.
// ============================================================
import { expect, test } from '@playwright/test';
import { ATRIBUTOS_REGRAS, NOVO, abrirSite, assentar, clicarBotaoFicha } from './helpers-regras.mjs';
import { semearPersonagem } from '../helpers.mjs';

const ALVO = 'regras-del-alvo';
const VIZINHO = 'regras-del-vizinho';

const BASE = {
  classe: 'Guerreiro', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'Percepção'],
  pv_max: 30, pv_atual: 30,
};

/** Ids dos personagens hoje no armazenamento local, na ordem da lista. */
async function idsSalvos(page) {
  return page.evaluate(async () => {
    const store = await import(new URL('./js/store.js', location.href).href);
    return store.listarPersonagens().map((p) => p.id);
  });
}

test('excluir personagem: o confirmar apaga da lista e do armazenamento', async ({ context }) => {
  const { page, erros } = await abrirSite(context);

  await semearPersonagem(page, { ...BASE, nome: 'Vítima de Teste' }, ALVO);
  await semearPersonagem(page, { ...BASE, nome: 'Sobrevivente de Teste' }, VIZINHO);
  expect(await idsSalvos(page), 'a fixture precisa começar com os dois personagens')
    .toEqual([ALVO, VIZINHO]);

  await page.goto(`${NOVO}#ficha/${ALVO}`, { waitUntil: 'domcontentloaded' });
  await assentar(page);

  await clicarBotaoFicha(page, 'btn-excluir-char', { esperar: '#btn-confirmar-del' });
  await expect(page.locator('#modal-corpo'),
    'o modal deveria nomear quem vai ser excluído').toContainText('Vítima de Teste');

  await page.locator('#btn-confirmar-del').click();
  await assentar(page).catch(() => {});

  expect(await idsSalvos(page), 'só o personagem excluído deveria ter saído do armazenamento')
    .toEqual([VIZINHO]);

  // O handler volta para a home; a lista de lá tem de refletir a exclusão.
  await expect(page.locator('.char-card'),
    'a home deveria listar apenas o personagem restante').toHaveCount(1);
  await expect(page.locator('.char-card').first(),
    'o card que sobrou deveria ser o do sobrevivente').toContainText('Sobrevivente de Teste');
  expect(await page.locator('.char-card').first().getAttribute('data-id'),
    'o card restante deveria ser o do outro id').toBe(VIZINHO);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
