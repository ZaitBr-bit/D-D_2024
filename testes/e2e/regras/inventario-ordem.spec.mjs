// Ordem: item da loja e personalizado entram no topo; equipar leva ao topo de Equipados.
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const P = {
  classe: 'Guerreiro', nivel: 3, xp: 900, atributos: { ...ATRIBUTOS_REGRAS },
  inventario: [
    { nome: 'Corda', tipo: 'generico', quantidade: 1, equipado: false, descricao: '', dados: { peso: '5 kg' } },
    { nome: 'Tocha', tipo: 'generico', quantidade: 1, equipado: false, descricao: '', dados: { peso: '1 kg' } },
    { nome: 'Adaga', tipo: 'arma', quantidade: 1, equipado: false, descricao: '', dados: { categoria: 'Armas Simples Corpo a Corpo', dano: '1d4 Perfurante', propriedades: 'Acuidade, Leve', peso: '0,5 kg' } },
  ],
};

// Adiciona um item personalizado pelo formulário e aguarda o modal fechar.
async function adicionarPersonalizado(page, nome) {
  await clicarSeletorFicha(page, '#btn-add-inv-custom', { esperar: '#btn-add-ic' });
  await page.fill('#ic-nome', nome);
  await page.click('#btn-add-ic');
  await expect(page.locator('#toast-container')).toContainText('adicionado');
}

test('equipar leva o item ao início do inventário', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-ordem-a');
  // click() e não check(): a ficha re-renderiza e o índice 2 passa a ser outro item, o que faria check() clicar de novo.
  await page.locator('[data-sheet-equip="2"]').click();
  await expect.poll(async () => (await personagemSalvo(page)).inventario[0].nome).toBe('Adaga');
  const salvo = await personagemSalvo(page);
  expect(salvo.inventario[0].equipado).toBe(true);
  expect(salvo.inventario.map(i => i.nome)).toEqual(['Adaga', 'Corda', 'Tocha']);
});

test('item personalizado novo entra no início da bolsa', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-ordem-b');
  await adicionarPersonalizado(page, 'Amuleto Novo');
  await expect.poll(async () => (await personagemSalvo(page)).inventario[0]?.nome).toBe('Amuleto Novo');
});

test('com espaço criado, o item novo também fica antes dos demais', async ({ context }) => {
  const comLocal = {
    ...P,
    inventario_locais: [{ id: 'loc-a', nome: 'Mochila Extra', conta_peso: true }],
    inventario: P.inventario.map((i, n) => (n === 0 ? { ...i, local: 'loc-a' } : i)),
  };
  const { page } = await abrirFicha(context, comLocal, 'regras-ordem-c');
  await adicionarPersonalizado(page, 'Amuleto Novo');
  await expect.poll(async () => (await personagemSalvo(page)).inventario[0]?.nome).toBe('Amuleto Novo');
  const salvo = await personagemSalvo(page);
  expect(salvo.inventario.map(i => i.nome)).toEqual(['Amuleto Novo', 'Corda', 'Tocha', 'Adaga']);
});
