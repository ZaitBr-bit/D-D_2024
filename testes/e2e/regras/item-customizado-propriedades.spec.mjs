// ============================================================
// Issue #104 -- propriedades do item personalizado por botao: lista
// padrao do livro, propriedade personalizada (nome + descricao) e remocao
// de chip. Clique real em cada controle novo.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo, abrirSecoesItemCustom } from './helpers-regras.mjs';

const GUERREIRO = { classe: 'Guerreiro', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS };

async function abrirFormulario(page) {
  await clicarSeletorFicha(page, '#btn-add-inv-custom', { esperar: '#ic-nome' });
  await abrirSecoesItemCustom(page);
}

test('adicionar propriedade padrão mostra o chip; duplicada é recusada; × remove', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-104-a');
  await abrirFormulario(page);
  await page.click('#ic-prop-add');
  await page.selectOption('#ic-prop-select', 'Versátil');
  await page.click('#ic-prop-confirmar');
  await expect(page.locator('#ic-props-lista [data-ic-prop][data-nome="Versátil"]')).toHaveCount(1);

  await page.click('#ic-prop-add');
  await page.selectOption('#ic-prop-select', 'Versátil');
  await page.click('#ic-prop-confirmar');
  await expect(page.locator('#ic-erros')).toContainText('já foi adicionada');
  await expect(page.locator('#ic-props-lista [data-ic-prop]')).toHaveCount(1);

  await page.click('#ic-props-lista [data-ic-prop-remover]');
  await expect(page.locator('#ic-props-lista [data-ic-prop]')).toHaveCount(0);
});

test('propriedade personalizada grava nome e descrição e a descrição aparece no detalhe do item', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-104-b');
  await abrirFormulario(page);
  await page.fill('#ic-nome', 'Lâmina de Vidro');
  await page.click('#ic-prop-add');
  await page.selectOption('#ic-prop-select', '__personalizada__');
  await page.fill('#ic-prop-nome', 'Quebradiço');
  await page.fill('#ic-prop-desc', 'Quebra com um 1 natural no ataque.');
  await page.click('#ic-prop-confirmar');
  await page.selectOption('#ic-categoria', 'Armas Simples Corpo a Corpo');
  await page.click('#btn-add-ic');
  await assentar(page).catch(() => {});

  const item = (await personagemSalvo(page)).inventario.find(i => i.nome === 'Lâmina de Vidro');
  expect(item.dados.propriedades).toBe('Quebradiço');
  expect(item.dados.propriedades_personalizadas).toEqual([{ nome: 'Quebradiço', descricao: 'Quebra com um 1 natural no ataque.' }]);

  await page.click('[data-info-inv-sheet="0"]');
  await expect(page.locator('#modal-corpo, .sub-modal-overlay').last()).toContainText('Quebradiço');
  await page.locator('summary', { hasText: 'Quebradiço' }).click();
  await expect(page.locator('#modal-corpo, .sub-modal-overlay').last()).toContainText('Quebra com um 1 natural');
});

test('personalizada sem nome é recusada', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-104-c');
  await abrirFormulario(page);
  await page.click('#ic-prop-add');
  await page.selectOption('#ic-prop-select', '__personalizada__');
  await page.click('#ic-prop-confirmar');
  await expect(page.locator('#ic-erros')).toContainText('Informe o nome');
  await expect(page.locator('#ic-props-lista [data-ic-prop]')).toHaveCount(0);
});

test('item antigo com propriedades em string abre a edição com os chips e remover grava a mudança', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    ...GUERREIRO,
    inventario: [{ nome: 'Espada Velha', tipo: 'customizado', quantidade: 1, equipado: false, descricao: '',
      dados: { categoria: 'Armas Marciais Corpo a Corpo', propriedades: 'Leve, Versátil', bonus_ca: '0', bonus_ataque: '0' } }],
  }, 'regras-issue-104-d');
  await assentar(page).catch(() => {});
  await page.click('[data-info-inv-sheet="0"]');
  await page.click('#btn-editar-item-custom');
  await page.waitForSelector('#ic-props-lista', { state: 'visible' });
  await expect(page.locator('#ic-props-lista [data-ic-prop]')).toHaveCount(2);
  await page.locator('#ic-props-lista [data-ic-prop][data-nome="Leve"] [data-ic-prop-remover]').click();
  await page.click('#btn-salvar-ic');
  await assentar(page).catch(() => {});
  const item = (await personagemSalvo(page)).inventario[0];
  expect(item.dados.propriedades).toBe('Versátil');
});
