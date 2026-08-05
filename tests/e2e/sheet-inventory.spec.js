// ============================================================
// Caracterização de inventário/moedas na ficha PÚBLICA: adicionar item
// customizado, ajustar quantidade, equipar/desequipar, remover, peso/carga e a
// carteira de moedas.
//
// ## Task 33 — CUTOVER: divergências, uma a uma
//
// | # | Legado | Novo | Por quê |
// |---|---|---|---|
// | 1 | `[data-qty-plus="0"]` (ÍNDICE no array) | `[data-instance-id="..."][data-delta="1"]` | posição no array jamais pode ser endereço de mutação: reordenar o inventário mudava o alvo do botão. A identidade é o `instanceId` |
// | 2 | `#btn-add-inv-custom` -> `#ic-nome` -> `#btn-add-ic` | `[data-action="sheet-inventory-custom-open"]` -> `[data-sheet-custom-name]` -> `[data-action="add-inventory-item"][data-origin="custom"]` | o modal é DESCRITO pela seção e aberto pelo controller (Task 24/32); nenhum id global |
// | 3 | `input[data-sheet-equip="0"]` (checkbox) | `[data-action="equip-item"][data-instance-id]` | idem #1, e equipar virou comando canônico |
// | 4 | `[data-sheet-rem-inv="0"]` + modal de confirmação | `[data-action="remove-inventory-item"][data-instance-id]` | **divergência funcional declarada**: não há mais confirmação. Ver nota abaixo |
// | 5 | `#sheet-peso-valor` (texto "28 / 84 kg") | `[data-sheet-load-total]` + `[data-sheet-load-capacity]` | dois valores derivados distintos, cada um no seu nó |
// | 6 | `#btn-edit-po` -> `#edit-moeda-po` -> `[data-moeda-add="po"]` | `[data-sheet-wallet-quantity="po"]` + `[data-action="change-wallet"][data-wallet-operation="add"]` | a carteira virou comando canônico `change-wallet` (Task 32) |
// | 7 | catálogo de loja com `[data-add-cat]` e dedução automática do custo | `[data-sheet-purchase-item-id]` (ContentId digitado) + `[data-sheet-item-catalog-unavailable]` | **lacuna declarada**: o catálogo de itens ainda não é projetado pelo modelo canônico, e a compra NÃO é atômica (`data-sheet-purchase-not-atomic`) — o item é adicionado e o pagamento é feito na carteira |
//
// **Divergência #4 (remoção sem confirmação)** é regressão de UX, não de dado:
// o comando é canônico, entra na fila durável e é auditável; o que se perdeu é
// o "tem certeza?". Registrada aqui como asserção para não envelhecer calada.
// ============================================================
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetApp, goFicha } from './helpers/app.js';
import { readCharacters } from './helpers/storage.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const derivedValues = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'tests/fixtures/expected/derived-values.json'), 'utf8')
);
const PERSONAGEM_BASE = derivedValues.cases.find((c) => c.id === 'pv-convergente').personagem;

/** Linha do inventário cujo NOME é `nome` (identidade estável, nunca índice). */
function itemPorNome(page, nome) {
  return page.locator('[data-sheet-item]').filter({ has: page.locator('[data-sheet-item-name]', { hasText: nome }) });
}

test.describe('Ficha — inventário e moedas', () => {
  test('adicionar item customizado aparece na lista e persiste', async ({ page }) => {
    await resetApp(page, { characters: [{ ...PERSONAGEM_BASE, inventario: [] }] });
    await goFicha(page, PERSONAGEM_BASE.id);

    await page.locator('[data-action="sheet-inventory-custom-open"]').click();
    await expect(page.locator('#modal-overlay')).toHaveCSS('display', 'flex');

    await page.locator('[data-sheet-custom-name]').fill('Amuleto Estranho');
    await page.locator('[data-sheet-custom-weight]').fill('0,5 kg');
    await page.locator('[data-sheet-custom-quantity]').fill('1');
    await page.locator('[data-action="add-inventory-item"][data-origin="custom"]').click();

    await expect(itemPorNome(page, 'Amuleto Estranho')).toHaveCount(1);
    const [salvo] = await readCharacters(page);
    expect(salvo.inventario.some((i) => i.nome === 'Amuleto Estranho')).toBe(true);
  });

  test('ajustar quantidade com +/- persiste o novo valor', async ({ page }) => {
    const comItem = {
      ...PERSONAGEM_BASE,
      inventario: [{ nome: 'Ração de Viagem', tipo: 'equipamento', equipado: false, quantidade: 2, dados: { peso: '1 kg' } }]
    };
    await resetApp(page, { characters: [comItem] });
    await goFicha(page, comItem.id);

    const linha = itemPorNome(page, 'Ração de Viagem');
    await linha.locator('[data-action="change-item-quantity"][data-delta="1"]').click();
    await expect(linha.locator('[data-sheet-item-quantity]')).toHaveText('3');

    await linha.locator('[data-action="change-item-quantity"][data-delta="-1"]').click();
    await linha.locator('[data-action="change-item-quantity"][data-delta="-1"]').click();
    await expect(linha.locator('[data-sheet-item-quantity]')).toHaveText('1');

    const [salvo] = await readCharacters(page);
    expect(salvo.inventario[0].quantidade).toBe(1);
  });

  test('equipar um item move-o de grupo e persiste', async ({ page }) => {
    const comEscudo = {
      ...PERSONAGEM_BASE,
      inventario: [{ nome: 'Escudo Extra', tipo: 'escudo', equipado: false, quantidade: 1, dados: { ca: '2', peso: '3 kg' } }]
    };
    await resetApp(page, { characters: [comEscudo] });
    await goFicha(page, comEscudo.id);

    // Começa na mochila...
    await expect(page.locator('[data-sheet-item-group-list="backpack"] [data-sheet-item]')).toHaveCount(1);
    await itemPorNome(page, 'Escudo Extra').locator('[data-action="equip-item"]').click();
    // ...e passa para os equipados. A PARTIÇÃO é o que o jogador vê mudar.
    await expect(page.locator('[data-sheet-item-group-list="equipped"] [data-sheet-item]')).toHaveCount(1);

    const [salvo] = await readCharacters(page);
    expect(salvo.inventario[0].equipado).toBe(true);
  });

  test('remover item some da lista e do registro (sem confirmação — divergência #4)', async ({ page }) => {
    const comItem = {
      ...PERSONAGEM_BASE,
      inventario: [{ nome: 'Corda de Cânhamo', tipo: 'equipamento', equipado: false, quantidade: 1, dados: { peso: '5 kg' } }]
    };
    await resetApp(page, { characters: [comItem] });
    await goFicha(page, comItem.id);

    await itemPorNome(page, 'Corda de Cânhamo').locator('[data-action="remove-inventory-item"]').click();

    await expect(itemPorNome(page, 'Corda de Cânhamo')).toHaveCount(0);
    const [salvo] = await readCharacters(page);
    expect(salvo.inventario).toHaveLength(0);
  });

  test('peso total e capacidade de carga batem com o oráculo de Task 2 (carga-somente-na-tela)', async ({ page }) => {
    const expectedCarga = derivedValues.cases.find((c) => c.id === 'carga-somente-na-tela').expectedUnified;
    await resetApp(page, { characters: [PERSONAGEM_BASE] });
    await goFicha(page, PERSONAGEM_BASE.id);

    // `expectedUnified` do caso é a CAPACIDADE (o campo do oráculo é
    // "Capacidade de Carga / Peso Total do Inventário").
    await expect(page.locator('[data-sheet-load-capacity]')).toHaveText(String(expectedCarga));
    await expect(page.locator('[data-sheet-load-total]')).not.toHaveText('');
  });

  test('LACUNA DECLARADA: a compra não é atômica e o catálogo de itens ainda não é projetado', async ({ page }) => {
    // Substitui o caso legado "comprar um item da loja deduz o custo". A
    // capacidade existe (adicionar item do catálogo por ContentId + mexer na
    // carteira), mas a ATOMICIDADE não — e a seção DIZ isso na tela, em vez de
    // deixar o jogador achar que pagou.
    await resetApp(page, { characters: [{ ...PERSONAGEM_BASE, inventario: [] }] });
    await goFicha(page, PERSONAGEM_BASE.id);

    await page.locator('[data-action="sheet-inventory-purchase-open"]').click();
    await expect(page.locator('#modal-overlay')).toHaveCSS('display', 'flex');
    // As duas notas aparecem no MODAL e também na própria seção (a lacuna é
    // declarada nos dois lugares, para o jogador não descobri-la só ao abrir o
    // formulário); o escopo é o corpo do modal.
    await expect(page.locator('#modal-corpo [data-sheet-item-catalog-unavailable]')).toBeVisible();
    await expect(page.locator('#modal-corpo [data-sheet-purchase-not-atomic]')).toBeVisible();

    await page.locator('#modal-corpo [data-sheet-purchase-item-id]').fill('dnd2024:weapon:adaga');
    // A VERSÃO DO PACOTE é pedida no formulário: `contentRef` exige `id` E
    // `packageVersion`, e o `ContentRegistry` não expõe a versão de uma
    // entidade resolvida. Sem ela, a versão anterior desta seção produzia um
    // personagem INVÁLIDO e o item digitado sumia ao salvar (achado do
    // cutover, reproduzido em navegador).
    await page.locator('#modal-corpo [data-sheet-purchase-item-version]').fill('1.0.0');
    await page.locator('#modal-corpo [data-sheet-purchase-quantity]').fill('1');
    await page.locator('[data-action="add-inventory-item"][data-origin="purchase"]').click();

    const [salvo] = await readCharacters(page);
    expect(salvo.inventario).toHaveLength(1);
    // A carteira NÃO foi debitada — é a lacuna declarada.
    expect(salvo.moedas).toEqual(PERSONAGEM_BASE.moedas);
  });

  test('editar carteira de moedas: adicionar peças de ouro persiste', async ({ page }) => {
    await resetApp(page, { characters: [{ ...PERSONAGEM_BASE, moedas: { pc: 0, pp: 0, pe: 0, po: 10, pl: 0 } }] });
    await goFicha(page, PERSONAGEM_BASE.id);

    const ouro = page.locator('[data-sheet-wallet-denomination="po"]');
    await expect(ouro.locator('[data-sheet-wallet-value]')).toHaveText('10');

    await ouro.locator('[data-sheet-wallet-quantity="po"]').fill('5');
    await ouro.locator('[data-action="change-wallet"][data-wallet-operation="add"]').click();

    await expect(ouro.locator('[data-sheet-wallet-value]')).toHaveText('15');
    const [salvo] = await readCharacters(page);
    expect(salvo.moedas.po).toBe(15);
  });
});
