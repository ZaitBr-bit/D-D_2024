// ============================================================
// Item CUSTOMIZADO: o peso gravado na criação tem de poder ser EDITADO
// (issue #43, causa raiz C).
//
// O formulário de CRIAÇÃO tem o campo `ic-peso` e grava `dados.peso` como
// "0,5 kg". O de EDIÇÃO foi escrito sem ele -- nem no HTML do modal, nem
// no handler de Salvar. Resultado exato do relato: "itens customizados
// depois de adicionar o peso, voce nao consegue mais alterar o peso do
// item mesmo clicando em editar". O peso ficava intocável, e como a carga
// do personagem sai de `getPesoTotalInventario`, corrigir um peso errado
// era impossível sem apagar e recriar o item.
//
// O spec CLICA no caminho do jogador (item do inventário -> popup de
// detalhe -> botão Editar) e mede depois de um RECARREGAMENTO da página:
// medir logo após Salvar leria o objeto em memória, que a tela mutou de
// qualquer jeito; o que o jogador perde é o que não sobrevive ao store.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

const ITEM = 'Amuleto de Chumbo';
const PESO_INICIAL = '0,5 kg';
const PESO_NOVO_DIGITADO = '2.5';   // input type=number fala com ponto
const PESO_NOVO_GRAVADO = '2,5 kg'; // fmtPeso grava com vírgula, como na criação

const GUERREIRO = {
  classe: 'Guerreiro', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
  inventario: [{
    nome: ITEM, tipo: 'customizado', quantidade: 1, equipado: false,
    descricao: 'Pesado que só ele',
    dados: { bonus_ca: '0', ca_base: '', dano: '', bonus_ataque: '0', peso: PESO_INICIAL },
  }],
};

/** Abre o popup de detalhe do item e clica em Editar. */
async function abrirEdicaoDoItem(page) {
  await page.click('[data-info-inv-sheet="0"]');
  await page.waitForSelector('#btn-editar-item-custom', { state: 'visible', timeout: 20_000 });
  await page.click('#btn-editar-item-custom');
  await page.waitForSelector('#ic-nome', { state: 'visible', timeout: 20_000 });
}

/** Peso total exibido na barra "Peso: X / Y kg" da ficha. */
async function pesoExibido(page) {
  return page.evaluate(() =>
    document.getElementById('sheet-peso-valor')?.querySelector('strong')?.textContent?.trim() ?? null);
}

test('item customizado: o modal de Editar traz o peso gravado', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-item-custom-peso-abre');
  await assentar(page).catch(() => {});

  await abrirEdicaoDoItem(page);

  await expect(page.locator('#ic-peso'),
    'o formulário de edição precisa ter o campo de peso -- sem ele o peso gravado '
    + 'na criação fica intocável').toBeVisible();
  expect(await page.inputValue('#ic-peso'),
    `o campo tem de vir preenchido com o peso gravado (${PESO_INICIAL})`).toBe('0.5');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('item customizado: o peso alterado no Editar sobrevive ao recarregamento', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-item-custom-peso-salva');
  await assentar(page).catch(() => {});

  expect(await pesoExibido(page),
    'a ficha começa com o peso do item semeado').toBe('0,5');

  await abrirEdicaoDoItem(page);
  await page.fill('#ic-peso', PESO_NOVO_DIGITADO);
  await page.click('#btn-salvar-ic');

  // GUARDA CONTRA VACUIDADE: se a validação recusou, nada foi gravado e o
  // resto do teste mediria o estado inicial achando que mediu o novo.
  await expect(page.locator('#toast-container'),
    'o item precisa ter sido atualizado; se a validação barrou, nada foi gravado')
    .toContainText('atualizado');

  // O que importa é o que sobrevive ao store, não o objeto em memória.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar(page);

  const salvo = await personagemSalvo(page);
  const item = (salvo?.inventario || []).find(i => i.nome === ITEM);
  expect(item, 'o item customizado precisa continuar no personagem salvo').toBeTruthy();
  expect(item.dados?.peso,
    'o peso digitado no Editar tem de ser gravado no mesmo formato da criação')
    .toBe(PESO_NOVO_GRAVADO);

  expect(await pesoExibido(page),
    'a barra "Peso: X / Y kg" tem de refletir o peso novo').toBe('2,5');

  // E o formulário tem de reler o que gravou: sem isso, reabrir o Editar
  // mostraria o peso antigo e a próxima gravação o restauraria.
  await abrirEdicaoDoItem(page);
  expect(await page.inputValue('#ic-peso'),
    'ao reabrir, o campo tem de trazer o peso NOVO').toBe('2.5');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('item customizado: apagar o peso no Editar zera a carga -- o contraste', async ({ context }) => {
  // Sem este contraste, "o peso mudou" passaria num handler que só soubesse
  // escrever um número e nunca soubesse limpar o campo.
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-item-custom-peso-limpa');
  await assentar(page).catch(() => {});

  await abrirEdicaoDoItem(page);
  await page.fill('#ic-peso', '');
  await page.click('#btn-salvar-ic');
  await expect(page.locator('#toast-container')).toContainText('atualizado');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar(page);

  const salvo = await personagemSalvo(page);
  const item = (salvo?.inventario || []).find(i => i.nome === ITEM);
  expect(item.dados?.peso,
    'campo vazio grava peso vazio, como na criação').toBe('');
  expect(await pesoExibido(page),
    'sem peso, o item não pesa nada na carga').toBe('0');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
