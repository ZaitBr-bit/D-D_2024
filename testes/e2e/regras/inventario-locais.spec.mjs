// ============================================================
// Issue #80 -- locais customizados no inventario (ex.: Bolsa de
// Armazenamento): criar, mover item, peso, editar e remover. Clique real
// em cada controle novo.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const GUERREIRO = {
  classe: 'Guerreiro', nivel: 3, xp: 900, atributos: { ...ATRIBUTOS_REGRAS, forca: 18 },
  inventario: [
    { nome: 'Bolsa de Armazenamento', tipo: 'generico', quantidade: 1, equipado: false, descricao: '', dados: { peso: '2,3 kg' } },
    { nome: 'Corda de Seda', tipo: 'generico', quantidade: 1, equipado: false, descricao: '', dados: { peso: '5 kg' } },
  ],
};

/** Texto de peso exibido ("7,3") na barra de carga. */
async function pesoExibido(page) {
  return page.evaluate(() =>
    document.getElementById('sheet-peso-valor')?.querySelector('strong')?.textContent?.trim() ?? null);
}

/** Cria o local pelo modal. */
async function criarLocal(page, nome, contaPeso) {
  await clicarSeletorFicha(page, '#btn-add-inv-local', { esperar: '#il-nome' });
  await page.fill('#il-nome', nome);
  if (!contaPeso) await page.uncheck('#il-conta-peso');
  await page.click('#btn-salvar-inv-local');
  await assentar(page).catch(() => {});
}

test('sem locais não há seletor de mover (layout antigo intacto) e o peso é o de sempre', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-80-a');
  await assentar(page).catch(() => {});
  await expect(page.locator('[data-mover-inv]')).toHaveCount(0);
  expect(await pesoExibido(page)).toBe('7,3');
});

test('local "sem peso": a seção aparece, mover o item tira o peso, voltar devolve', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-80-b');
  await assentar(page).catch(() => {});
  await criarLocal(page, 'Dentro da Bolsa', false);

  const salvo = await personagemSalvo(page);
  expect(salvo.inventario_locais).toHaveLength(1);
  expect(salvo.inventario_locais[0]).toMatchObject({ nome: 'Dentro da Bolsa', conta_peso: false });
  const idLocal = salvo.inventario_locais[0].id;

  const secao = page.locator(`[data-inv-secao="local_${idLocal}"]`);
  await expect(secao).toContainText('Dentro da Bolsa (0)');
  await expect(secao).toContainText('não conta no peso');

  await page.selectOption('[data-mover-inv="1"]', idLocal);
  await assentar(page).catch(() => {});
  await expect(page.locator(`[data-inv-secao="local_${idLocal}"]`)).toContainText('Dentro da Bolsa (1)');
  expect(await pesoExibido(page), 'a Corda (5 kg) saiu da conta; a Bolsa (2,3 kg) continua').toBe('2,3');
  expect((await personagemSalvo(page)).inventario[1].local).toBe(idLocal);

  // O item está num espaço recolhido: expande para alcançar o seletor dele.
  await page.locator(`[data-inv-secao="local_${idLocal}"]`).click();
  await page.selectOption('[data-mover-inv="1"]', '');
  await assentar(page).catch(() => {});
  expect(await pesoExibido(page)).toBe('7,3');
  expect((await personagemSalvo(page)).inventario[1].local).toBeUndefined();
});

test('editar o local para "conta no peso" devolve o peso; mover equipado desequipa', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    ...GUERREIRO,
    inventario: [
      ...GUERREIRO.inventario,
      { nome: 'Adaga Reserva', tipo: 'generico', quantidade: 1, equipado: true, descricao: '', dados: { peso: '1 kg' } },
    ],
  }, 'regras-issue-80-c');
  await assentar(page).catch(() => {});
  await criarLocal(page, 'Bolsa', false);
  const idLocal = (await personagemSalvo(page)).inventario_locais[0].id;

  await page.selectOption('[data-mover-inv="1"]', idLocal);
  await assentar(page).catch(() => {});
  await page.selectOption('[data-mover-inv="2"]', idLocal);
  await assentar(page).catch(() => {});
  const salvo = await personagemSalvo(page);
  expect(salvo.inventario[2].local).toBe(idLocal);
  expect(salvo.inventario[2].equipado, 'mover para o local desequipa').toBe(false);
  expect(await pesoExibido(page)).toBe('2,3');

  await page.click(`[data-inv-local-editar="${idLocal}"]`);
  await page.waitForSelector('#il-nome', { state: 'visible' });
  await page.check('#il-conta-peso');
  await page.click('#btn-salvar-inv-local');
  await assentar(page).catch(() => {});
  expect(await pesoExibido(page)).toBe('8,3');
});

test('remover o local devolve os itens à Mochila sem apagar nenhum', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-80-d');
  await assentar(page).catch(() => {});
  await criarLocal(page, 'Bolsa', false);
  const idLocal = (await personagemSalvo(page)).inventario_locais[0].id;
  await page.selectOption('[data-mover-inv="1"]', idLocal);
  await assentar(page).catch(() => {});

  await page.click(`[data-inv-local-remover="${idLocal}"]`);
  await page.click('#btn-confirmar-remover-local');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo.inventario).toHaveLength(2);
  expect(salvo.inventario.every(i => !i.local)).toBe(true);
  expect(salvo.inventario_locais).toHaveLength(0);
  expect(await pesoExibido(page)).toBe('7,3');
});

test('local sem nome é recusado', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-issue-80-e');
  await assentar(page).catch(() => {});
  await clicarSeletorFicha(page, '#btn-add-inv-local', { esperar: '#il-nome' });
  await page.click('#btn-salvar-inv-local');
  await expect(page.locator('#il-erro')).toContainText('Informe um nome');
  expect((await personagemSalvo(page)).inventario_locais ?? []).toHaveLength(0);
});

test('espaço criado nasce recolhido e o expandir/recolher é lembrado ao recarregar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-inventario-local-recolhe');
  await assentar(page).catch(() => {});
  await criarLocal(page, 'Escrita', true);
  const idLocal = (await personagemSalvo(page)).inventario_locais[0].id;
  const titulo = page.locator(`[data-inv-secao="local_${idLocal}"]`);
  const corpo = page.locator(`[data-inv-secao-body="local_${idLocal}"]`);

  await expect(titulo, 'o espaço novo nasce recolhido').toHaveClass(/inv-secao-colapsada/);
  await expect(corpo).toHaveClass(/inv-secao-body-oculto/);

  await titulo.click();
  await expect(titulo).not.toHaveClass(/inv-secao-colapsada/);
  await page.reload();
  await assentar(page).catch(() => {});
  await expect(page.locator(`[data-inv-secao="local_${idLocal}"]`), 'expandido fica expandido depois do F5')
    .not.toHaveClass(/inv-secao-colapsada/);

  await page.locator(`[data-inv-secao="local_${idLocal}"]`).click();
  await page.reload();
  await assentar(page).catch(() => {});
  await expect(page.locator(`[data-inv-secao="local_${idLocal}"]`), 'recolhido fica recolhido depois do F5')
    .toHaveClass(/inv-secao-colapsada/);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
