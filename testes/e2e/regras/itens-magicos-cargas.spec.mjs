// ============================================================
// Prova por navegador das cargas e usos de itens (4A): gastar até 0,
// devolver carga, última carga (Não / Sim / Restaurar / regra "outro"),
// Descanso Longo com recuperação informada, uso diário, Descanso Curto,
// contador manual, item legado e pendência após fechar o modal.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, clicarBotaoFicha, assentar, ATRIBUTOS_REGRAS, NOVO } from './helpers-regras.mjs';

const GUERREIRO = { classe: 'Guerreiro', nivel: 1, atributos: ATRIBUTOS_REGRAS };

/** Fecha todos os modais abertos (principal e sub-modais) pela API da própria página. */
async function fecharTudo(page) {
  await page.evaluate(() => window.fecharModalTodos());
  await expect(page.locator('#modal-overlay')).toBeHidden();
}

/** Adiciona um item mágico pela categoria Itens Mágicos (com arma-base, se pedida) e fecha os modais. */
async function adicionarItemMagico(page, busca, linha, base) {
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('.filtro-inv-cat[data-cat="magicos"]').click();
  await page.locator('#busca-inv-cat').fill(busca);
  await page.locator('[data-item-magico]', { hasText: linha }).first().click();
  if (base) await page.selectOption('#base-item-magico', base);
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('adicionado');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
}

/** Item do personagem salvo cujo nome contém o trecho dado. */
async function itemSalvo(page, trecho) {
  return (await personagemSalvo(page)).inventario.find((i) => i.nome.includes(trecho));
}

/** Cargas atuais do item, lidas do personagem salvo. */
async function cargas(page, trecho) {
  return (await itemSalvo(page, trecho))?.estado_recursos?.cargas;
}

/** Linha do inventário do item com o trecho de nome dado. */
function linhaDe(page, trecho) {
  return page.locator('.inv-item[data-idx]', { hasText: trecho });
}

/** Clica − na linha do item `vezes` vezes. */
async function gastar(page, trecho, vezes) {
  for (let n = 0; n < vezes; n++) {
    await linhaDe(page, trecho).locator('[data-cargas-menos]').click();
    await assentar(page).catch(() => {});
  }
}

/** Executa o Descanso Longo (clique no botão da ficha) e espera a página assentar. */
async function descansoLongo(page) {
  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
}

/**
 * Depois do Descanso Longo de um personagem com trocas: fecha o modal de trocas
 * pelo X (o que abre o modal de recuperação) e dispensa este com "Depois",
 * deixando a pendência no botão do inventário.
 */
async function dispensarModaisDoDescanso(page) {
  await page.locator('#modal-header .modal-fechar').click();
  await expect(page.locator('#btn-aplicar-recuperacao')).toHaveCount(1);
  await page.getByRole('button', { name: 'Depois' }).click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await assentar(page).catch(() => {});
}

test('Varinha de Bolas de Fogo: gastar até 0, d20 "Não", Descanso Longo com 5 informados', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-1');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await expect(linhaDe(page, 'Varinha de Bolas de Fogo')).toContainText('⚡ 7/7');
  await gastar(page, 'Varinha de Bolas de Fogo', 7);
  await page.click('#btn-ultima-carga-nao');
  expect(await cargas(page, 'Varinha de Bolas de Fogo')).toBe(0);
  // O Guerreiro abre o modal de trocas de maestria: o modal de recuperação não
  // abre sozinho e o botão do inventário resolve a pendência.
  await descansoLongo(page);
  await dispensarModaisDoDescanso(page);
  await page.click('#btn-recuperar-itens');
  await expect(page.locator('[data-recuperacao-idx]')).toHaveCount(1);
  await page.locator('[data-recuperacao-idx]').fill('5');
  await page.click('#btn-aplicar-recuperacao');
  await expect.poll(() => cargas(page, 'Varinha de Bolas de Fogo')).toBe(5);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Descanso Longo com trocas: aviso no modal e "Manter Tudo" abre a recuperação', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-11');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await gastar(page, 'Varinha de Bolas de Fogo', 4);
  await descansoLongo(page);
  await expect(page.locator('#modal-overlay')).toContainText('1 item(ns) com recuperação de cargas pendente');
  await page.click('#btn-pular-troca-dl');
  await expect(page.locator('#btn-aplicar-recuperacao')).toHaveCount(1);
  await page.locator('[data-recuperacao-idx]').fill('3');
  await page.click('#btn-aplicar-recuperacao');
  await expect.poll(() => cargas(page, 'Varinha de Bolas de Fogo')).toBe(6);
  await expect(page.locator('#btn-recuperar-itens')).toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Descanso Longo com trocas: fechar pelo X abre a recuperação; "Depois" mantém a pendência', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-12');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await gastar(page, 'Varinha de Bolas de Fogo', 2);
  await descansoLongo(page);
  await expect(page.locator('#btn-pular-troca-dl')).toBeVisible();
  await page.locator('#modal-header .modal-fechar').click();
  await expect(page.locator('#btn-aplicar-recuperacao')).toHaveCount(1);
  await page.getByRole('button', { name: 'Depois' }).click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect(page.locator('#btn-recuperar-itens')).toContainText('(1)');
  expect(await cargas(page, 'Varinha de Bolas de Fogo')).toBe(5);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('valor inválido na recuperação avisa e mantém a pendência', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Monge', nivel: 1, atributos: ATRIBUTOS_REGRAS }, 'regras-cargas-13');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await gastar(page, 'Varinha de Bolas de Fogo', 3);
  await descansoLongo(page);
  await page.locator('[data-recuperacao-idx]').fill('-2');
  await page.click('#btn-aplicar-recuperacao');
  await expect(page.locator('#toast-container')).toContainText('Valor inválido em 1 item(ns): continua pendente');
  await expect(page.locator('#btn-recuperar-itens')).toContainText('(1)');
  expect(await cargas(page, 'Varinha de Bolas de Fogo')).toBe(4);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Descanso Longo sem trocas: o modal de recuperação abre sozinho', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Monge', nivel: 1, atributos: ATRIBUTOS_REGRAS }, 'regras-cargas-10');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await gastar(page, 'Varinha de Bolas de Fogo', 3);
  await descansoLongo(page);
  await expect(page.locator('#btn-aplicar-recuperacao')).toHaveCount(1);
  await expect(page.locator('.sub-modal-overlay')).toHaveCount(0);
  await page.locator('[data-recuperacao-idx]').fill('2');
  await page.click('#btn-aplicar-recuperacao');
  await expect.poll(() => cargas(page, 'Varinha de Bolas de Fogo')).toBe(6);
  await expect(page.locator('#btn-recuperar-itens')).toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('tocar + devolve uma carga', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-1b');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await gastar(page, 'Varinha de Bolas de Fogo', 3);
  expect(await cargas(page, 'Varinha de Bolas de Fogo')).toBe(4);
  await linhaDe(page, 'Varinha de Bolas de Fogo').locator('[data-cargas-mais]').click();
  await expect.poll(() => cargas(page, 'Varinha de Bolas de Fogo')).toBe(5);
  await expect(linhaDe(page, 'Varinha de Bolas de Fogo')).toContainText('⚡ 5/7');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('última carga "Sim": destruído e Restaurar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-2');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await gastar(page, 'Varinha de Bolas de Fogo', 7);
  await page.click('#btn-ultima-carga-sim');
  await assentar(page).catch(() => {});
  await expect(page.locator('.inv-item-destruido')).toContainText('Destruído');
  expect((await itemSalvo(page, 'Varinha de Bolas de Fogo')).destruido).toBe(true);
  await page.locator('[data-restaurar-item]').click();
  await assentar(page).catch(() => {});
  expect((await itemSalvo(page, 'Varinha de Bolas de Fogo')).destruido).toBe(false);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Cajado do Poder: a última carga mostra a regra do livro e "Entendi" fecha', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-5');
  await adicionarItemMagico(page, 'Cajado do Poder', 'Cajado do Poder', 'Cajado');
  await expect(linhaDe(page, 'Cajado do Poder')).toContainText('⚡ 20/20');
  await gastar(page, 'Cajado do Poder', 20);
  await expect(page.locator('#btn-ultima-carga-ok')).toBeVisible();
  await expect(page.locator('#modal-overlay')).toContainText('Com 1, o cajado mantém seu bônus de +2');
  await page.click('#btn-ultima-carga-ok');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  expect(await cargas(page, 'Cajado do Poder')).toBe(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('pendência sobrevive a fechar o modal: botão do amanhecer no inventário', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-3');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await gastar(page, 'Varinha de Bolas de Fogo', 2);
  await descansoLongo(page);
  await dispensarModaisDoDescanso(page);
  await page.click('#btn-recuperar-itens');
  await page.locator('[data-recuperacao-idx]').fill('9');
  await page.click('#btn-aplicar-recuperacao');
  await expect.poll(() => cargas(page, 'Varinha de Bolas de Fogo')).toBe(7);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('re-renders do inventário não empilham modais do botão do amanhecer', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-6');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await gastar(page, 'Varinha de Bolas de Fogo', 2);
  await descansoLongo(page);
  await dispensarModaisDoDescanso(page);
  const mais = linhaDe(page, 'Varinha de Bolas de Fogo').locator('[data-qty-plus]');
  for (let n = 0; n < 2; n++) {
    await mais.click();
    await assentar(page).catch(() => {});
  }
  await page.click('#btn-recuperar-itens');
  await expect(page.locator('#btn-aplicar-recuperacao')).toHaveCount(1);
  await expect(page.locator('.modal-overlay:visible')).toHaveCount(1);
  await expect(page.locator('.sub-modal-overlay')).toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('contador manual num item comum', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-4');
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('.filtro-inv-cat[data-cat="equipamento"]').click();
  await page.locator('#busca-inv-cat').fill('Corda');
  await page.locator('#lista-inv-cat .inv-item').first().click();
  await page.click('#btn-confirmar-add-item');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  await linhaDe(page, 'Corda').locator('[data-info-inv-sheet]').click();
  await page.click('#btn-adicionar-contador');
  await page.selectOption('#contador-tipo', 'cargas');
  await page.fill('#contador-max', '3');
  // A recuperação padrão (com dado) exige o dado; "todas" não.
  await page.selectOption('#contador-recupera', 'todas');
  await page.click('#btn-salvar-contador');
  await assentar(page).catch(() => {});
  await expect(linhaDe(page, 'Corda')).toContainText('⚡ 3/3');
  const corda = await itemSalvo(page, 'Corda');
  expect(corda.dados.recursos.cargas).toMatchObject({ max: 3, recupera: 'todas' });
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Azagaia do Relâmpago: chip não abre o detalhe, fica gasto e volta no Descanso Longo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-7');
  await adicionarItemMagico(page, 'Azagaia do Relâmpago', 'Azagaia do Relâmpago', 'Azagaia');
  const chip = linhaDe(page, 'Azagaia do Relâmpago').locator('[data-uso-item]');
  await expect(chip).toContainText('Relâmpago 1/1');
  await chip.click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect(chip).toContainText('Relâmpago 0/1');
  expect((await itemSalvo(page, 'Azagaia do Relâmpago')).estado_recursos.usos['Relâmpago']).toBe(1);
  await descansoLongo(page);
  await expect.poll(async () => (await itemSalvo(page, 'Azagaia do Relâmpago')).estado_recursos.usos['Relâmpago']).toBe(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Descanso Curto devolve o uso de descanso curto e não devolve cargas', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-8');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await adicionarItemMagico(page, 'Cajado do Acrobata', 'Cajado do Acrobata', 'Cajado');
  await gastar(page, 'Varinha de Bolas de Fogo', 2);
  await linhaDe(page, 'Cajado do Acrobata').locator('[data-uso-item]').click();
  await assentar(page).catch(() => {});
  expect((await itemSalvo(page, 'Cajado do Acrobata')).estado_recursos.usos['Deflexão de Ataques']).toBe(1);
  await clicarBotaoFicha(page, 'btn-descanso-curto');
  await assentar(page).catch(() => {});
  await expect.poll(async () => (await itemSalvo(page, 'Cajado do Acrobata')).estado_recursos.usos['Deflexão de Ataques']).toBe(0);
  expect(await cargas(page, 'Varinha de Bolas de Fogo')).toBe(5);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('item mágico legado ganha o contador uma vez e carga gasta não é reabastecida', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-9');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  // Simula o item gravado antes da 4A: sem a chave `recursos` e sem estado.
  await page.evaluate(async () => {
    const store = await import(new URL('./js/store.js', location.href).href);
    const p = store.listarPersonagens()[0];
    const it = p.inventario.find((i) => i.nome === 'Varinha de Bolas de Fogo');
    delete it.dados.recursos;
    delete it.estado_recursos;
    store.salvarPersonagem(p);
  });
  await page.goto(`${NOVO}#ficha/regras-cargas-9`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar(page).catch(() => {});
  await expect(linhaDe(page, 'Varinha de Bolas de Fogo')).toContainText('⚡ 7/7');
  await gastar(page, 'Varinha de Bolas de Fogo', 3);
  expect(await cargas(page, 'Varinha de Bolas de Fogo')).toBe(4);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar(page).catch(() => {});
  await expect(linhaDe(page, 'Varinha de Bolas de Fogo')).toContainText('⚡ 4/7');
  expect(await cargas(page, 'Varinha de Bolas de Fogo')).toBe(4);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ---- Plano 8, Task 4: achados 4.1, 4.2, 4.3 e 4.7 ----

const MAGO_TROCAS = {
  classe: 'Mago', nivel: 5, xp: 14000, atributos: ATRIBUTOS_REGRAS, pericias_proficientes: ['Arcanismo', 'História'],
  grimorio: [{ nome: 'Mísseis Mágicos', circulo: 1 }, { nome: 'Detectar Magia', circulo: 1 }],
  magias_preparadas: [{ nome: 'Mísseis Mágicos', circulo: 1 }, { nome: 'Detectar Magia', circulo: 1 }],
};

test('Mago com Varinha em 0: Trocar Magias -> Cancelar abre a recuperação uma vez só', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_TROCAS, 'regras-cargas-p8-1');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await gastar(page, 'Varinha de Bolas de Fogo', 7);
  await page.click('#btn-ultima-carga-nao');
  await descansoLongo(page);
  await expect(page.locator('#btn-trocar-magias-dl')).toBeVisible();
  await page.click('#btn-trocar-magias-dl');
  await expect(page.locator('#btn-confirmar-troca-conhecida')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('#btn-aplicar-recuperacao')).toBeVisible();
  await expect(page.locator('.modal-overlay:visible')).toHaveCount(1);
  await expect(page.locator('[data-recuperacao-idx]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Depois' }).click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect(page.locator('#btn-recuperar-itens')).toContainText('(1)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Mago com truque: X no modal de magia segue para o de truque e o Cancelar dele abre a recuperação', async ({ context }) => {
  const semente = { ...MAGO_TROCAS, magias_conhecidas: [{ nome: 'Raio de Fogo', circulo: 0 }, { nome: 'Mãos Mágicas', circulo: 0 }] };
  const { page, erros } = await abrirFicha(context, semente, 'regras-cargas-p8-2');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await gastar(page, 'Varinha de Bolas de Fogo', 3);
  await descansoLongo(page);
  await page.click('#btn-trocar-magias-dl');
  await expect(page.locator('#btn-confirmar-troca-conhecida')).toBeVisible();
  await page.locator('#modal-header .modal-fechar').click();
  await expect(page.locator('#btn-confirmar-troca-truque')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('#btn-aplicar-recuperacao')).toBeVisible();
  await expect(page.locator('.modal-overlay:visible')).toHaveCount(1);
  await page.getByRole('button', { name: 'Depois' }).click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect(page.locator('#btn-recuperar-itens')).toContainText('(1)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Escaravelho de Proteção: o detalhe oferece Marcar como destruído', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-p8-3');
  await adicionarItemMagico(page, 'Escaravelho de Proteção', 'Escaravelho de Proteção');
  await linhaDe(page, 'Escaravelho de Proteção').locator('[data-info-inv-sheet]').click();
  await expect(page.locator('#btn-marcar-destruido')).toBeVisible();
  await page.click('#btn-marcar-destruido');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await assentar(page).catch(() => {});
  await expect(page.locator('.inv-item-destruido')).toContainText('Destruído');
  expect((await itemSalvo(page, 'Escaravelho de Proteção')).destruido).toBe(true);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Escaravelho de Proteção: o aviso da última carga oferece Marcar como destruído', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-p8-4');
  await adicionarItemMagico(page, 'Escaravelho de Proteção', 'Escaravelho de Proteção');
  await gastar(page, 'Escaravelho de Proteção', 12);
  await expect(page.locator('#modal-overlay')).toContainText('é destruído quando sua última carga');
  await page.click('#btn-marcar-destruido');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await assentar(page).catch(() => {});
  expect((await itemSalvo(page, 'Escaravelho de Proteção')).destruido).toBe(true);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

/** Adiciona uma Corda e cria nela um contador manual de 3 cargas "todas no Descanso Longo". */
async function cordaComContador(page) {
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('.filtro-inv-cat[data-cat="equipamento"]').click();
  await page.locator('#busca-inv-cat').fill('Corda');
  await page.locator('#lista-inv-cat .inv-item').first().click();
  await page.click('#btn-confirmar-add-item');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  await linhaDe(page, 'Corda').locator('[data-info-inv-sheet]').click();
  await page.click('#btn-adicionar-contador');
  await page.fill('#contador-max', '3');
  await page.selectOption('#contador-recupera', 'todas');
  await page.click('#btn-salvar-contador');
  await assentar(page).catch(() => {});
  await expect(linhaDe(page, 'Corda')).toContainText('⚡ 3/3');
}

test('contador manual: Editar reabre preenchido e mantém o gasto; Remover apaga só o manual', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-p8-5');
  await cordaComContador(page);
  expect((await itemSalvo(page, 'Corda')).dados.recursos_manual).toBe(true);
  await gastar(page, 'Corda', 1);
  await linhaDe(page, 'Corda').locator('[data-info-inv-sheet]').click();
  await expect(page.locator('#btn-editar-contador')).toBeVisible();
  await page.click('#btn-editar-contador');
  await expect(page.locator('#contador-max')).toHaveValue('3');
  await expect(page.locator('#contador-recupera')).toHaveValue('todas');
  await page.fill('#contador-max', '5');
  await page.click('#btn-salvar-contador');
  await assentar(page).catch(() => {});
  await expect(linhaDe(page, 'Corda')).toContainText('⚡ 2/5');
  await linhaDe(page, 'Corda').locator('[data-info-inv-sheet]').click();
  await expect(page.locator('#btn-remover-contador')).toBeVisible();
  await page.click('#btn-remover-contador');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await assentar(page).catch(() => {});
  const corda = await itemSalvo(page, 'Corda');
  expect(corda.dados.recursos).toBeNull();
  expect(corda.estado_recursos).toBeUndefined();
  await expect(linhaDe(page, 'Corda')).not.toContainText('⚡');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('contador do acervo não tem Remover nem Editar contador', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-p8-6');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await linhaDe(page, 'Varinha de Bolas de Fogo').locator('[data-info-inv-sheet]').click();
  await expect(page.locator('#btn-marcar-destruido')).toBeVisible();
  await expect(page.locator('#btn-remover-contador')).toHaveCount(0);
  await expect(page.locator('#btn-editar-contador')).toHaveCount(0);
  await fecharTudo(page);
  expect((await itemSalvo(page, 'Varinha de Bolas de Fogo')).dados.recursos.cargas.max).toBe(7);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('reRenderSheetInv: gasto, quantidade e remoção atualizam botão e contadores sem empilhar listeners', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-p8-7');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await adicionarItemMagico(page, 'Cajado do Poder', 'Cajado do Poder', 'Cajado');
  await gastar(page, 'Varinha de Bolas de Fogo', 2);
  await descansoLongo(page);
  await dispensarModaisDoDescanso(page);
  await expect(page.locator('#btn-recuperar-itens')).toContainText('(1)');
  await linhaDe(page, 'Varinha de Bolas de Fogo').locator('[data-qty-plus]').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-recuperar-itens')).toContainText('(1)');
  // Segunda pendência: o contador do botão sobe depois do gasto e do novo descanso.
  await gastar(page, 'Cajado do Poder', 3);
  await descansoLongo(page);
  await dispensarModaisDoDescanso(page);
  await expect(page.locator('#btn-recuperar-itens')).toContainText('(2)');
  // Remover um dos itens derruba o contador do botão.
  await linhaDe(page, 'Cajado do Poder').locator('[data-sheet-rem-inv]').click();
  await page.click('#btn-confirmar-rem-inv-sheet');
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-recuperar-itens')).toContainText('(1)');
  await page.click('#btn-recuperar-itens');
  await expect(page.locator('.modal-overlay:visible')).toHaveCount(1);
  await expect(page.locator('[data-recuperacao-idx]')).toHaveCount(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ---- Plano 8, Task 4, fix round 1 ----

const MAGO_CADEIA = {
  ...MAGO_TROCAS,
  grimorio: [{ nome: 'Mísseis Mágicos', circulo: 1 }, { nome: 'Detectar Magia', circulo: 1 }, { nome: 'Escudo Arcano', circulo: 1 }],
  magias_conhecidas: [{ nome: 'Raio de Fogo', circulo: 0 }, { nome: 'Mãos Mágicas', circulo: 0 }],
};

/** Mago com Varinha gasta que entra no Descanso Longo e abre a troca de magias. */
async function magoNaTrocaDeMagias(page) {
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await gastar(page, 'Varinha de Bolas de Fogo', 3);
  await descansoLongo(page);
  await page.click('#btn-trocar-magias-dl');
  await expect(page.locator('#btn-confirmar-troca-conhecida')).toBeVisible();
}

/** Do modal de truque até o fim: Não Trocar e a recuperação abre uma vez só. */
async function terminarNoTruqueEAbrirRecuperacao(page) {
  await expect(page.locator('#btn-pular-troca-truque')).toHaveCount(1);
  await page.click('#btn-pular-troca-truque');
  await expect(page.locator('#btn-aplicar-recuperacao')).toBeVisible();
  await expect(page.locator('.modal-overlay:visible')).toHaveCount(1);
  await expect(page.locator('#btn-aplicar-recuperacao')).toHaveCount(1);
  await expect(page.locator('#btn-confirmar-troca-truque')).toHaveCount(0);
}

test('cadeia do Descanso Longo: Confirmar a troca de magia abre o truque uma vez e a recuperação uma vez', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_CADEIA, 'regras-cargas-p8-8');
  await magoNaTrocaDeMagias(page);
  await page.locator('#troca-conhecida-remover-lista .opcao-card[data-opcao="Mísseis Mágicos"]').click();
  await page.locator('[data-selecionar-troca]').first().click({ position: { x: 3, y: 3 } });
  await page.click('#btn-confirmar-troca-conhecida');
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-confirmar-troca-truque')).toHaveCount(1);
  await expect(page.locator('.modal-overlay:visible')).toHaveCount(1);
  await terminarNoTruqueEAbrirRecuperacao(page);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('cadeia do Descanso Longo: Não Trocar na magia abre o truque uma vez e a recuperação uma vez', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_CADEIA, 'regras-cargas-p8-9');
  await magoNaTrocaDeMagias(page);
  await page.click('#btn-pular-troca-conhecida');
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-confirmar-troca-truque')).toHaveCount(1);
  await expect(page.locator('.modal-overlay:visible')).toHaveCount(1);
  await terminarNoTruqueEAbrirRecuperacao(page);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Cajado do Poder: o aviso da última carga "outro" não oferece Marcar como destruído', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-p8-10');
  await adicionarItemMagico(page, 'Cajado do Poder', 'Cajado do Poder', 'Cajado');
  await gastar(page, 'Cajado do Poder', 20);
  await expect(page.locator('#btn-ultima-carga-ok')).toBeVisible();
  await expect(page.locator('#btn-marcar-destruido')).toHaveCount(0);
  await page.click('#btn-ultima-carga-ok');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Cajado da Cura: o aviso "outro" que fala em desaparecer oferece Marcar como destruído', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-p8-11');
  await adicionarItemMagico(page, 'Cajado da Cura', 'Cajado da Cura');
  await gastar(page, 'Cajado da Cura', 10);
  await expect(page.locator('#modal-overlay')).toContainText('desaparece');
  await page.click('#btn-marcar-destruido');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await assentar(page).catch(() => {});
  expect((await itemSalvo(page, 'Cajado da Cura')).destruido).toBe(true);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('o botão do amanhecer descarta a pendência obsoleta: gastar de novo não a ressuscita', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-p8-12');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await gastar(page, 'Varinha de Bolas de Fogo', 2);
  await descansoLongo(page);
  await dispensarModaisDoDescanso(page);
  await expect(page.locator('#btn-recuperar-itens')).toContainText('(1)');
  const mais = linhaDe(page, 'Varinha de Bolas de Fogo').locator('[data-cargas-mais]');
  for (let n = 0; n < 2; n++) { await mais.click(); await assentar(page).catch(() => {}); }
  await expect(linhaDe(page, 'Varinha de Bolas de Fogo')).toContainText('⚡ 7/7');
  await expect(page.locator('#btn-recuperar-itens')).toHaveCount(0);
  await gastar(page, 'Varinha de Bolas de Fogo', 1);
  await expect(linhaDe(page, 'Varinha de Bolas de Fogo')).toContainText('⚡ 6/7');
  await expect(page.locator('#btn-recuperar-itens')).toHaveCount(0);
  expect((await itemSalvo(page, 'Varinha de Bolas de Fogo')).estado_recursos.recuperacao_pendente).toBeUndefined();
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('editar o contador manual com pendência de recuperação a mantém enquanto as cargas estão abaixo do máximo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-cargas-p8-13');
  await cordaComContador(page);
  // Troca para recuperação em dado, gasta 2 e deixa a pendência do Descanso Longo.
  await linhaDe(page, 'Corda').locator('[data-info-inv-sheet]').click();
  await page.click('#btn-editar-contador');
  await page.selectOption('#contador-recupera', 'amanhecer');
  await page.fill('#contador-dado', '1d4');
  await page.click('#btn-salvar-contador');
  await assentar(page).catch(() => {});
  await gastar(page, 'Corda', 2);
  await descansoLongo(page);
  await dispensarModaisDoDescanso(page);
  await expect(page.locator('#btn-recuperar-itens')).toContainText('(1)');
  await linhaDe(page, 'Corda').locator('[data-info-inv-sheet]').click();
  await page.click('#btn-editar-contador');
  await page.fill('#contador-max', '6');
  await page.click('#btn-salvar-contador');
  await assentar(page).catch(() => {});
  await expect(linhaDe(page, 'Corda')).toContainText('⚡ 1/6');
  await expect(page.locator('#btn-recuperar-itens')).toContainText('(1)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
