// ============================================================
// Issue #57 -- a caixa de sintonizacao na ficha, e o teto de tres.
//
// O teste de unidade irmao prova a regra. Este prova a outra metade: que
// a caixa aparece, que clicar grava, e que a quarta caixa fica
// desabilitada quando ja ha tres marcadas.
//
// Um gatilho de tela novo so esta entregue com um spec que clica nele.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

/** Personagem com quatro itens que pedem sintonizacao, `marcados` ja ligados. */
function comQuatroItens(marcados) {
  return {
    nome: 'Colecionadora', especie: 'Humano', classe: 'Guerreiro', subclasse: '',
    nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
    classes: [{ classe: 'Guerreiro', subclasse: '', nivel: 5, ordem: 0 }],
    inventario: ['Anel A', 'Anel B', 'Anel C', 'Anel D'].map((nome, i) => ({
      nome, tipo: 'customizado', quantidade: 1, equipado: false, descricao: '',
      dados: { bonus_ca: '0', ca_base: '', dano: '', bonus_ataque: '0', peso: '',
               raridade: 'Rara', preco: '', requer_sintonizacao: true },
      sintonizado: i < marcados,
    })),
    schema_versao: 2,
  };
}

test('item que pede sintonizacao mostra a caixa', async ({ context }) => {
  const { page } = await abrirFicha(context, comQuatroItens(0), 'regras-sint-0');
  await assentar(page).catch(() => {});
  await expect(page.locator('[data-sintonizar]').first()).toBeVisible();
});

test('clicar na caixa marca o item como sintonizado', async ({ context }) => {
  const { page } = await abrirFicha(context, comQuatroItens(0), 'regras-sint-1');
  await assentar(page).catch(() => {});
  await page.locator('[data-sintonizar]').first().click();
  await assentar(page).catch(() => {});
  await expect(page.locator('[data-sintonizar]').first()).toBeChecked();
});

test('com tres marcados, a quarta caixa fica desabilitada', async ({ context }) => {
  const { page } = await abrirFicha(context, comQuatroItens(3), 'regras-sint-3');
  await assentar(page).catch(() => {});
  const caixas = page.locator('[data-sintonizar]');
  await expect(caixas.nth(0)).toBeEnabled();
  await expect(caixas.nth(3)).toBeDisabled();
});

test('desmarcar um dos tres reabilita a quarta caixa', async ({ context }) => {
  const { page } = await abrirFicha(context, comQuatroItens(3), 'regras-sint-4');
  await assentar(page).catch(() => {});
  await page.locator('[data-sintonizar]').nth(0).click();
  await assentar(page).catch(() => {});
  await expect(page.locator('[data-sintonizar]').nth(3)).toBeEnabled();
});

// Issue #57, item orfao: editar um item sintonizado e desmarcar "Requer
// Sintonizacao" prendia a vaga -- a caixa sumia da tela mas `sintonizado:
// true` continuava gravado, sem controle nenhum para liberar.
test('desmarcar "Requer Sintonizacao" na edicao libera a vaga para a quarta caixa', async ({ context }) => {
  const { page } = await abrirFicha(context, comQuatroItens(3), 'regras-sint-orfao');
  await assentar(page).catch(() => {});

  // Abrir o item sintonizado, entrar na edicao e desmarcar a sintonizacao.
  await page.locator('[data-info-inv-sheet]').first().click();
  await page.locator('#btn-editar-item-custom').click();
  await page.waitForSelector('#ic-sintonizacao', { state: 'visible' });
  await page.locator('#ic-sintonizacao').uncheck();
  await page.locator('#btn-salvar-ic').click();
  await assentar(page).catch(() => {});

  // O item editado (Anel A, o primeiro) nao pede mais sintonizacao -- sua
  // caixa de "Sint." some, restando as dos outros tres itens.
  await expect(page.locator('[data-sintonizar]')).toHaveCount(3);
  // Marcados eram Anel A, B e C (teto cheio); com Anel A fora da conta,
  // sobram 2 marcados e a caixa do Anel D (a ultima restante) libera.
  await expect(page.locator('[data-sintonizar]').nth(2)).toBeEnabled();
});

// Issue #57, contador desatualizado: `reRenderSheetInv` remendava a barra
// de peso mas nao o "Sintonizados: X / 3" do cabecalho -- ele so
// atualizava numa proxima acao que disparasse renderFichaCompleta.
test('remover um item sintonizado atualiza o contador do cabecalho', async ({ context }) => {
  const { page } = await abrirFicha(context, comQuatroItens(3), 'regras-sint-contador');
  await assentar(page).catch(() => {});

  await expect(page.getByText('Sintonizados:')).toContainText('3');

  // Remover o primeiro item (sintonizado) do inventario.
  await page.locator('[data-sheet-rem-inv]').first().click();
  await page.locator('#btn-confirmar-rem-inv-sheet').click();
  await assentar(page).catch(() => {});

  await expect(page.getByText('Sintonizados:')).toContainText('2');
});
