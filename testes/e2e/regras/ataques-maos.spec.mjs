// Limite de mãos ao equipar: 2 armas de uma mão, terceira recusada, arma de duas mãos recusada, mão nova libera.
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

const arma = (nome, dano, props, equipado = false) => ({
  nome, tipo: 'arma', quantidade: 1, equipado, descricao: '',
  dados: { categoria: 'Armas Marciais Corpo a Corpo', dano, propriedades: props, peso: '1 kg' },
});
const P = {
  classe: 'Guerreiro', nivel: 3, xp: 900, atributos: { ...ATRIBUTOS_REGRAS },
  inventario: [
    arma('Espada Curta', '1d6 Perfurante', 'Acuidade, Leve'),
    arma('Adaga', '1d4 Perfurante', 'Acuidade, Leve'),
    arma('Maça', '1d6 Contundente', ''),
    arma('Espada Grande', '2d6 Cortante', 'Pesada, Duas Mãos'),
  ],
};

/** Clica no Equipar do item pelo nome (a ficha redesenha após equipar) e devolve o personagem salvo. */
async function equipar(page, nome) {
  await page.locator('.inv-item', { hasText: nome }).first().locator('[data-sheet-equip]').click({ force: true });
  await assentar(page).catch(() => {});
  return personagemSalvo(page);
}

test('duas armas de uma mão equipam; a terceira é recusada com aviso e nada muda', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-maos-a');
  await assentar(page).catch(() => {});
  await equipar(page, 'Espada Curta');
  await equipar(page, 'Adaga');
  const salvo = await equipar(page, 'Maça');
  const por = Object.fromEntries(salvo.inventario.map(i => [i.nome, i.equipado]));
  expect(por).toMatchObject({ 'Espada Curta': true, 'Adaga': true, 'Maça': false });
  await expect(page.locator('#toast-container .toast').last()).toContainText('Sem mãos livres');
});

test('arma de duas mãos recusada com uma arma equipada', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-maos-b');
  await assentar(page).catch(() => {});
  const antes = await equipar(page, 'Espada Curta');
  expect(antes.inventario.find(i => i.nome === 'Espada Curta').equipado).toBe(true);
  const salvo = await equipar(page, 'Espada Grande');
  expect(salvo.inventario.find(i => i.nome === 'Espada Grande').equipado).toBe(false);
});

test('uma mão cadastrada libera a terceira arma', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-maos-c');
  await assentar(page).catch(() => {});
  await equipar(page, 'Espada Curta');
  await equipar(page, 'Adaga');
  await page.evaluate(() => document.getElementById('btn-ataques-maos')?.click());
  await page.waitForSelector('#btn-mao-adicionar', { timeout: 10_000 });
  await page.click('#btn-mao-adicionar');
  await page.click('#btn-mao-fechar');
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).maos).toHaveLength(3);
  const salvo = await equipar(page, 'Maça');
  expect(salvo.inventario.find(i => i.nome === 'Maça').equipado).toBe(true);
});

test('a seção Ataques só existe com arma equipada, entre Magias e Inventário, com Atq e Dano', async ({ context }) => {
  const { page } = await abrirFicha(context, P, 'regras-ataques-a');
  await assentar(page).catch(() => {});
  await expect(page.locator('#secao-ataques')).toHaveCount(0);
  await equipar(page, 'Espada Curta');
  const secao = page.locator('#secao-ataques');
  await expect(secao).toContainText('Ataques');
  await expect(secao).toContainText('Espada Curta');
  await expect(secao).toContainText('Atq');
  await expect(secao).toContainText('Dano');
  // A seção precede o cartão do Inventário na ficha.
  const ordem = await page.evaluate(() => [...document.querySelectorAll('#secao-ataques, #secao-inventario')].map(e => e.id));
  expect(ordem).toEqual(['secao-ataques', 'secao-inventario']);
  await equipar(page, 'Espada Curta'); // desmarca
  await expect(page.locator('#secao-ataques')).toHaveCount(0);
});

test('versátil: "Empunhar com duas mãos" sobe o dado e ocupa 2 mãos', async ({ context }) => {
  const longa = { nome: 'Espada Longa', tipo: 'arma', quantidade: 1, equipado: true, descricao: '',
    dados: { categoria: 'Armas Marciais Corpo a Corpo', dano: '1d8 Cortante', propriedades: 'Versátil (1d10)', peso: '1,5 kg' } };
  const { page } = await abrirFicha(context, { ...P, inventario: [longa] }, 'regras-ataques-b');
  await assentar(page).catch(() => {});
  await expect(page.locator('#secao-ataques')).toContainText('1d8');
  await page.locator('[data-ataque-empunhar]').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#secao-ataques')).toContainText('1d10');
  expect((await personagemSalvo(page)).inventario[0].dados.empunhadura).toBe('duas');
  // Volta para uma mão: devolve o dado 1d8 e apaga a empunhadura gravada.
  await page.locator('[data-ataque-empunhar]').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#secao-ataques')).toContainText('1d8');
  expect((await personagemSalvo(page)).inventario[0].dados).not.toHaveProperty('empunhadura');
});

test('save antigo com 3 armas equipadas mostra "Mãos excedidas" e não desequipa', async ({ context }) => {
  const inv = [arma('Espada Curta', '1d6 Perfurante', 'Leve', true), arma('Adaga', '1d4 Perfurante', 'Leve', true), arma('Maça', '1d6 Contundente', '', true)];
  const { page } = await abrirFicha(context, { ...P, inventario: inv }, 'regras-ataques-c');
  await assentar(page).catch(() => {});
  await expect(page.locator('#secao-ataques')).toContainText('Mãos excedidas');
  expect((await personagemSalvo(page)).inventario.every(i => i.equipado)).toBe(true);
});

test('fechar o modal de Mãos pelo X redesenha a ficha com o novo total de mãos', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...P, inventario: [arma('Espada Curta', '1d6 Perfurante', 'Leve', true)] }, 'regras-ataques-d');
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-ataques-maos')).toContainText('1/2');
  await page.evaluate(() => document.getElementById('btn-ataques-maos')?.click());
  await page.waitForSelector('#btn-mao-adicionar', { timeout: 10_000 });
  await page.click('#btn-mao-adicionar');
  await page.waitForSelector('#btn-mao-adicionar', { timeout: 10_000 });
  await page.locator('#modal-overlay .modal-fechar').click();
  await expect(page.locator('#btn-ataques-maos')).toContainText('1/3');
});

test('empunhar com duas mãos é recusado com a Adaga equipada: toast, sem empunhadura gravada', async ({ context }) => {
  const longa = { nome: 'Espada Longa', tipo: 'arma', quantidade: 1, equipado: true, descricao: '',
    dados: { categoria: 'Armas Marciais Corpo a Corpo', dano: '1d8 Cortante', propriedades: 'Versátil (1d10)', peso: '1,5 kg' } };
  const { page } = await abrirFicha(context, { ...P, inventario: [longa, arma('Adaga', '1d4 Perfurante', 'Acuidade, Leve', true)] }, 'regras-ataques-e');
  await assentar(page).catch(() => {});
  await page.locator('[data-ataque-empunhar]').click();
  await expect(page.locator('#toast-container .toast').last()).toContainText('Sem mãos livres');
  expect((await personagemSalvo(page)).inventario[0].dados).not.toHaveProperty('empunhadura');
  await expect(page.locator('#secao-ataques')).toContainText('1d8');
});

/** Abre o modal de Mãos pela seção Ataques. */
async function abrirModalMaosPelaSecao(page) {
  await page.locator('#btn-ataques-maos').click();
  await page.waitForSelector('#btn-mao-adicionar', { timeout: 10_000 });
}

test('remover mão: recusada quando as mãos em uso não cabem; liberada quando sobra mão livre', async ({ context }) => {
  const inv = [arma('Espada Curta', '1d6 Perfurante', 'Leve', true), arma('Adaga', '1d4 Perfurante', 'Leve', true)];
  const { page } = await abrirFicha(context, { ...P, inventario: inv }, 'regras-ataques-f');
  await assentar(page).catch(() => {});
  await abrirModalMaosPelaSecao(page);
  // 2 em uso de 2: remover uma mão é recusado e a lista segue com 2 mãos.
  await page.locator('[data-mao-remover]').first().click();
  await expect(page.locator('#toast-container .toast').last()).toContainText('Desequipe um item');
  await expect(page.locator('[data-mao-remover]')).toHaveCount(2);
  // Com uma mão a mais, sobra mão livre e a remoção é aceita.
  await page.click('#btn-mao-adicionar');
  await expect(page.locator('[data-mao-remover]')).toHaveCount(3);
  await page.locator('[data-mao-remover]').last().click();
  await expect(page.locator('[data-mao-remover]')).toHaveCount(2);
  await page.click('#btn-mao-fechar');
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).maos).toHaveLength(2);
});

test('renomear mão grava o nome no personagem', async ({ context }) => {
  const { page } = await abrirFicha(context, { ...P, inventario: [arma('Espada Curta', '1d6 Perfurante', 'Leve', true)] }, 'regras-ataques-g');
  await assentar(page).catch(() => {});
  await abrirModalMaosPelaSecao(page);
  await page.locator('[data-mao-nome="0"]').fill('Mão Direita');
  await page.locator('[data-mao-nome="0"]').blur();
  await page.click('#btn-mao-fechar');
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).maos[0].nome).toBe('Mão Direita');
});

test('linha da seção Ataques: selo de proficiência e o nome abre o detalhe do item', async ({ context }) => {
  const longa = { nome: 'Espada Longa', tipo: 'arma', quantidade: 1, equipado: true, descricao: '',
    dados: { categoria: 'Armas Marciais Corpo a Corpo', dano: '1d8 Cortante', propriedades: 'Versátil (1d10)', peso: '1,5 kg', magico_id: 'espada-teste', raridade: 'Incomum', requer_sintonizacao: true } };
  const { page } = await abrirFicha(context, { ...P, inventario: [longa] }, 'regras-ataques-h');
  await assentar(page).catch(() => {});
  const linha = page.locator('#secao-ataques .ataque-item', { hasText: 'Espada Longa' });
  await expect(linha.locator('.badge', { hasText: /Prof/i }).first()).toBeVisible();
  await expect(linha).toContainText('Incomum');
  await expect(linha).toContainText('Sintonização');
  await linha.locator('[data-ataque-info]').click();
  await expect(page.locator('#modal-overlay')).toBeVisible();
  await expect(page.locator('#modal-titulo')).toContainText('Espada Longa');
});

test('equipar o Escudo com a Espada Longa em duas mãos: a longa volta para uma mão (1d8) e o escudo equipa', async ({ context }) => {
  const longa = { nome: 'Espada Longa', tipo: 'arma', quantidade: 1, equipado: true, descricao: '',
    dados: { categoria: 'Armas Marciais Corpo a Corpo', dano: '1d8 Cortante', propriedades: 'Versátil (1d10)', peso: '1,5 kg', empunhadura: 'duas' } };
  const sh = { nome: 'Escudo', tipo: 'escudo', quantidade: 1, equipado: false, descricao: '', dados: { categoria: 'Escudo', ca: '+2', peso: '3 kg' } };
  const { page } = await abrirFicha(context, { ...P, inventario: [longa, sh] }, 'regras-ataques-i');
  await assentar(page).catch(() => {});
  await expect(page.locator('#secao-ataques')).toContainText('1d10');
  const salvo = await equipar(page, 'Escudo');
  const porNome = Object.fromEntries(salvo.inventario.map(i => [i.nome, i]));
  expect(porNome['Escudo'].equipado).toBe(true);
  expect(porNome['Espada Longa'].equipado).toBe(true);
  expect(porNome['Espada Longa'].dados).not.toHaveProperty('empunhadura');
  await expect(page.locator('#secao-ataques')).toContainText('1d8');
  await expect(page.locator('#secao-ataques')).toContainText('Dano 1d8');
  const aviso = page.locator('#toast-container .toast').last();
  await expect(aviso).toContainText('Espada Longa');
  await expect(aviso).not.toHaveClass(/error/);
});

test('Empunhar com duas mãos segue recusado com o Escudo equipado e nada é desequipado', async ({ context }) => {
  const longa = { nome: 'Espada Longa', tipo: 'arma', quantidade: 1, equipado: true, descricao: '',
    dados: { categoria: 'Armas Marciais Corpo a Corpo', dano: '1d8 Cortante', propriedades: 'Versátil (1d10)', peso: '1,5 kg' } };
  const sh = { nome: 'Escudo', tipo: 'escudo', quantidade: 1, equipado: true, descricao: '', dados: { categoria: 'Escudo', ca: '+2', peso: '3 kg' } };
  const { page } = await abrirFicha(context, { ...P, inventario: [longa, sh] }, 'regras-ataques-j');
  await assentar(page).catch(() => {});
  await page.locator('[data-ataque-empunhar]').click();
  await expect(page.locator('#toast-container .toast').last()).toContainText('Sem mãos livres');
  const salvo = await personagemSalvo(page);
  expect(salvo.inventario.every(i => i.equipado)).toBe(true);
  expect(salvo.inventario[0].dados).not.toHaveProperty('empunhadura');
});
