// ============================================================
// Itens mágicos de mão (varinha, bastão, cajado e itens do livro "enquanto o segura"):
// comprados pela loja, equipam como item de mão, aparecem em Ataques com 1 mão, entram
// no botão Mãos e, sem mão livre, equipam e avisam em vez de recusar.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha, personagemSalvo } from './helpers-regras.mjs';

const ESPADA = { nome: 'Espada Curta', tipo: 'arma', quantidade: 1, equipado: false, dados: { dano: '1d6 Perfurante', categoria: 'Marcial Corpo a Corpo', propriedades: 'Acuidade, Leve', custo: '10 PO', peso: '1 kg' } };
const ESCUDO = { nome: 'Escudo', tipo: 'escudo', quantidade: 1, equipado: false, dados: { categoria: 'Escudo', ca: '+2' } };
const BASE = { classe: 'Mago', nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS, inventario: [ESPADA, ESCUDO] };

/** Adiciona um item mágico do acervo pela loja, pelo nome. */
async function comprarMagico(page, nome) {
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption('magicos');
  await page.locator('#busca-inv-cat').fill(nome);
  await page.locator('[data-item-magico]', { hasText: nome }).first().click();
  await page.locator('#btn-confirmar-item-magico').click();
  await assentar(page).catch(() => {});
  await page.evaluate(() => window.fecharModalTodos?.());
}

test('Varinha e Orbe do Tempo da loja viram itens de mão: 1 mão cada, em Ataques e no botão Mãos', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BASE, 'itens-de-mao-loja');
  await assentar(page).catch(() => {});
  await comprarMagico(page, 'Varinha de Mísseis Mágicos');
  await comprarMagico(page, 'Orbe do Tempo');
  const salvo = await personagemSalvo(page);
  for (const nome of ['Varinha de Mísseis Mágicos', 'Orbe do Tempo']) {
    const item = salvo.inventario.find((i) => i.nome === nome);
    expect(item, `${nome} no inventário`).toBeTruthy();
  }

  await abrirTudo(page);
  const varinha = page.locator('.inv-item', { hasText: 'Varinha de Mísseis Mágicos' });
  await varinha.locator('[data-sheet-equip]').check();
  await assentar(page).catch(() => {});
  const secao = page.locator('#secao-ataques');
  await expect(secao).toContainText('Varinha de Mísseis Mágicos');
  await expect(secao).toContainText('1 mão');
  await expect(page.locator('#btn-ataques-maos')).toContainText('(1/2)');

  await page.locator('.inv-item', { hasText: 'Orbe do Tempo' }).locator('[data-sheet-equip]').check();
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-ataques-maos')).toContainText('(2/2)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('sem mão livre o item de mão equipa e mostra o aviso de mãos excedidas; arma continua recusada', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...BASE,
    inventario: [{ ...ESPADA, equipado: true }, { ...ESCUDO, equipado: true },
      { nome: 'Varinha de Teste', tipo: 'magico', quantidade: 1, equipado: false, dados: { linha_tipo: 'Varinha, Incomum', magico_id: 'varinha-teste' } },
      { nome: 'Adaga', tipo: 'arma', quantidade: 1, equipado: false, dados: { dano: '1d4 Perfurante', categoria: 'Simples Corpo a Corpo', propriedades: 'Acuidade, Leve' } }],
  }, 'itens-de-mao-aviso');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  await page.locator('.inv-item', { hasText: 'Varinha de Teste' }).locator('[data-sheet-equip]').check();
  await expect(page.locator('#toast-container')).toContainText('Mãos excedidas (3 de 2)');
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).inventario.find((i) => i.nome === 'Varinha de Teste').equipado, 'equipou mesmo assim').toBe(true);
  await expect(page.locator('#secao-ataques')).toContainText('Mãos excedidas');

  await page.locator('.inv-item', { hasText: 'Adaga' }).locator('[data-sheet-equip]').click();
  await expect(page.locator('#toast-container')).toContainText('Sem mãos livres');
  expect((await personagemSalvo(page)).inventario.find((i) => i.nome === 'Adaga').equipado, 'arma continua recusada').toBe(false);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('cajado: botão Empunhar com duas mãos passa de 1 para 2 mãos; varinha não tem o botão', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...BASE,
    inventario: [
      { nome: 'Cajado da Serpente', tipo: 'magico', quantidade: 1, equipado: true, dados: { linha_tipo: 'Cajado, Incomum', magico_id: 'cajado-teste' } },
      { nome: 'Varinha de Teste', tipo: 'magico', quantidade: 1, equipado: true, dados: { linha_tipo: 'Varinha, Incomum', magico_id: 'varinha-teste' } },
    ],
  }, 'itens-de-mao-versatil');
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-ataques-maos')).toContainText('(2/2)');
  const botoes = page.locator('#secao-ataques [data-ataque-empunhar]');
  await expect(botoes, 'só o cajado é versátil').toHaveCount(1);
  await expect(botoes.first()).toHaveText('Empunhar com duas mãos');

  await botoes.first().click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#toast-container')).toContainText('Mãos excedidas (3 de 2)');
  await expect(page.locator('#btn-ataques-maos')).toContainText('(3/2)');
  expect((await personagemSalvo(page)).inventario[0].dados.empunhadura).toBe('duas');
  await expect(page.locator('#secao-ataques [data-ataque-empunhar]')).toHaveText('Empunhar com uma mão');

  await page.locator('#secao-ataques [data-ataque-empunhar]').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-ataques-maos')).toContainText('(2/2)');
  expect((await personagemSalvo(page)).inventario[0].dados.empunhadura).toBeUndefined();
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

/** Abre todos os <details> (a ficha nasce com os blocos recolhidos). */
async function abrirTudo(page) {
  await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); });
}
