// ============================================================
// Prova por navegador das magias de itens mágicos (4B): bloco "Magias de
// Itens" na seção Magias, item pronto/não pronto, faixa de cargas, uso diário
// com concentração, cancelar a troca de concentração, última carga pela
// conjuração, CD "sua" e detalhe da magia.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, clicarBotaoFicha, marcarCondicao, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const GUERREIRO = { classe: 'Guerreiro', nivel: 1, atributos: ATRIBUTOS_REGRAS };
const MONGE = { classe: 'Monge', nivel: 1, atributos: ATRIBUTOS_REGRAS };

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

/**
 * Sintoniza o item do inventário. Quando o personagem não atende o requisito
 * do item (4D: ex.: Guerreiro com item "por um Conjurador"), confirma o
 * modal "Sintonizar mesmo assim".
 */
async function sintonizar(page, trecho) {
  const caixa = linhaDe(page, trecho).locator('[data-sintonizar]');
  const mesmoAssim = page.locator('#btn-sintonizar-mesmo-assim');
  await caixa.click();
  await expect.poll(async () => (await mesmoAssim.isVisible()) || (await caixa.isChecked())).toBe(true);
  if (await mesmoAssim.isVisible()) await mesmoAssim.click();
  await expect(caixa).toBeChecked();
  await assentar(page).catch(() => {});
}

/** Equipa e sintoniza o item do inventário, esperando a ficha assentar a cada passo. */
async function equiparESintonizar(page, trecho) {
  await linhaDe(page, trecho).locator('[data-sheet-equip]').check();
  await assentar(page).catch(() => {});
  await sintonizar(page, trecho);
}

/** Linha do bloco "Magias de Itens" da magia com o nome dado. */
function linhaMagia(page, nome) {
  return page.locator('.magias-de-itens .magia-item', { hasText: nome });
}

/** Botão Conjurar da linha da magia no bloco "Magias de Itens". */
function botaoConjurar(page, nome) {
  return linhaMagia(page, nome).locator('[data-conjurar-item]');
}

test('Varinha de Bolas de Fogo: não pronta, pronta e faixa de cargas', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-magias-itens-1');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await expect(page.locator('.magias-de-itens')).toContainText('Magias de Itens');
  const botao = botaoConjurar(page, 'Bola de Fogo');
  await expect(botao).toBeDisabled();
  await expect(botao).toHaveAttribute('title', 'Equipe o item');

  await linhaDe(page, 'Varinha de Bolas de Fogo').locator('[data-sheet-equip]').check();
  await assentar(page).catch(() => {});
  await expect(botaoConjurar(page, 'Bola de Fogo')).toHaveAttribute('title', 'Sintonize o item');

  await sintonizar(page, 'Varinha de Bolas de Fogo');
  await expect(botaoConjurar(page, 'Bola de Fogo')).toBeEnabled();

  await botaoConjurar(page, 'Bola de Fogo').click();
  const opcoes = page.locator('#sel-custo-item-magia option');
  await expect(opcoes).toHaveText(['1 carga — 3º círculo', '2 cargas — 4º círculo', '3 cargas — 5º círculo']);
  await page.selectOption('#sel-custo-item-magia', '1');
  await page.click('#btn-conjurar-item-confirmar');
  await expect(page.locator('#toast-container')).toContainText('Bola de Fogo conjurada com Varinha de Bolas de Fogo');
  await expect.poll(() => cargas(page, 'Varinha de Bolas de Fogo')).toBe(5);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('faixa de cargas limitada pelas cargas atuais', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-magias-itens-2');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await equiparESintonizar(page, 'Varinha de Bolas de Fogo');
  await gastar(page, 'Varinha de Bolas de Fogo', 5);
  expect(await cargas(page, 'Varinha de Bolas de Fogo')).toBe(2);
  await botaoConjurar(page, 'Bola de Fogo').click();
  await expect(page.locator('#sel-custo-item-magia option').nth(0)).toBeEnabled();
  await expect(page.locator('#sel-custo-item-magia option').nth(1)).toBeEnabled();
  await expect(page.locator('#sel-custo-item-magia option').nth(2)).toBeDisabled();
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Manto Aracnídeo: uso diário, concentração e Descanso Longo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MONGE, 'regras-magias-itens-3');
  await adicionarItemMagico(page, 'Manto Aracnídeo', 'Manto Aracnídeo');
  await equiparESintonizar(page, 'Manto Aracnídeo');
  await botaoConjurar(page, 'Teia').click();
  await expect(page.locator('#toast-container')).toContainText('Teia conjurada com Manto Aracnídeo');
  await expect.poll(async () => (await itemSalvo(page, 'Manto Aracnídeo')).estado_recursos.usos.Teia).toBe(1);
  const efeitos = (await personagemSalvo(page)).efeitos_magicos || [];
  expect(efeitos.some((e) => e.concentracao === true && e.nome === 'Teia')).toBe(true);
  await expect(botaoConjurar(page, 'Teia')).toBeDisabled();
  await expect(botaoConjurar(page, 'Teia')).toHaveAttribute('title', 'Uso já gasto');

  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  await expect(botaoConjurar(page, 'Teia')).toBeEnabled();
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('cancelar a troca de concentração não paga o uso', async ({ context }) => {
  const efeitos = [{ nome: 'Bênção', tipo: 'concentracao_generica', concentracao: true, circulo: 1, rotulo: 'Concentrando em Bênção' }];
  const { page, erros } = await abrirFicha(context, { ...MONGE, efeitos_magicos: efeitos }, 'regras-magias-itens-4');
  await adicionarItemMagico(page, 'Manto Aracnídeo', 'Manto Aracnídeo');
  await equiparESintonizar(page, 'Manto Aracnídeo');
  await botaoConjurar(page, 'Teia').click();
  await expect(page.locator('#modal-overlay')).toContainText('Substituir Concentração');
  await page.click('#conc-cancelar');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await assentar(page).catch(() => {});
  expect((await itemSalvo(page, 'Manto Aracnídeo')).estado_recursos.usos.Teia || 0).toBe(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('última carga pela conjuração: modal, destruído e linha some do bloco', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-magias-itens-5');
  await adicionarItemMagico(page, 'Varinha da Teia', 'Varinha da Teia');
  await equiparESintonizar(page, 'Varinha da Teia');
  const max = (await itemSalvo(page, 'Varinha da Teia')).estado_recursos.cargas;
  await gastar(page, 'Varinha da Teia', max - 1);
  expect(await cargas(page, 'Varinha da Teia')).toBe(1);
  await botaoConjurar(page, 'Teia').click();
  await expect(page.locator('#modal-overlay')).toContainText('Última carga');
  await page.click('#btn-ultima-carga-sim');
  await assentar(page).catch(() => {});
  expect((await itemSalvo(page, 'Varinha da Teia')).destruido).toBe(true);
  await expect(page.locator('.magias-de-itens')).toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Cajado do Fogo: a CD "sua" é a CD de magia da ficha', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Mago', nivel: 1, atributos: ATRIBUTOS_REGRAS }, 'regras-magias-itens-6');
  await adicionarItemMagico(page, 'Cajado do Fogo', 'Cajado do Fogo');
  await equiparESintonizar(page, 'Cajado do Fogo');
  const cdFicha = await page.locator('.stat-box').filter({ has: page.locator('.stat-label', { hasText: /^CD Magia/ }) }).locator('.stat-value').first().innerText();
  await expect(linhaMagia(page, 'Mãos Flamejantes')).toContainText(new RegExp(`CD ${cdFicha.trim()} · \\+\\d+`));
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('clicar no nome da magia abre o detalhe', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-magias-itens-7');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await linhaMagia(page, 'Bola de Fogo').locator('strong').click();
  await expect(linhaMagia(page, 'Bola de Fogo').locator('.magia-desc')).toContainText('Esfera de 6 metros');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Restauração Menor pelo Cajado da Cura: pede a condição, remove e cobra 2 cargas; fechar sem escolher não cobra', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Druida', nivel: 1, atributos: ATRIBUTOS_REGRAS }, 'regras-magias-itens-8');
  await adicionarItemMagico(page, 'Cajado da Cura', 'Cajado da Cura');
  await equiparESintonizar(page, 'Cajado da Cura');
  await marcarCondicao(page, 'Envenenado');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  const antes = await cargas(page, 'Cajado da Cura');

  // Cancelar a escolha da condição: nada é pago.
  await botaoConjurar(page, 'Restauração Menor').click();
  await page.locator('#alvo-self').click();
  await expect(page.locator('#modal-overlay')).toContainText('Remover Condição');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await assentar(page).catch(() => {});
  expect(await cargas(page, 'Cajado da Cura')).toBe(antes);

  // Escolher a condição: removida e 2 cargas descontadas.
  await botaoConjurar(page, 'Restauração Menor').click();
  await page.locator('#alvo-self').click();
  await page.locator('[data-cura-idx]', { hasText: 'Envenenado' }).click();
  await expect(page.locator('#toast-container')).toContainText('Restauração Menor conjurada com Cajado da Cura');
  await expect.poll(() => cargas(page, 'Cajado da Cura')).toBe(antes - 2);
  expect((await personagemSalvo(page)).condicoes || []).not.toContain('Envenenado');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Proteção Contra Energia pelo Bandolim de Canaith: pede o tipo, registra a resistência e gasta o uso', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Bardo', nivel: 1, atributos: ATRIBUTOS_REGRAS }, 'regras-magias-itens-9');
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('.filtro-inv-cat[data-cat="magicos"]').click();
  await page.locator('#busca-inv-cat').fill('Instrumento dos Bardos');
  await page.locator('[data-item-magico]', { hasText: 'Instrumento dos Bardos' }).first().click();
  await page.locator('label:has-text("Canaith") input[name="variante-magica"]').check();
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('adicionado');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  await equiparESintonizar(page, 'Canaith');
  await botaoConjurar(page, 'Proteção Contra Energia').click();
  await page.locator('#alvo-self').click();
  await page.getByRole('button', { name: 'Elétrico' }).click();
  await expect(page.locator('#toast-container')).toContainText('Proteção Contra Energia conjurada com');
  const p = await personagemSalvo(page);
  const ef = (p.efeitos_magicos || []).find((e) => e.nome === 'Proteção Contra Energia');
  expect(ef?.tipos_dano).toEqual(['Elétrico']);
  const uso = Object.entries((await itemSalvo(page, 'Canaith')).estado_recursos.usos).find(([k]) => k.startsWith('Proteção Contra Energia'));
  expect(uso?.[1]).toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ---- Plano 8, Task 4: achados 4.8, 4.9, 4.11, 4.12 e 4.13 ----

test('nome de magia com & aparece uma vez só no título do modal de faixa de cargas', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-magias-itens-p8-1');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await equiparESintonizar(page, 'Varinha de Bolas de Fogo');
  // Renomeia a magia da varinha em memória (nome com &) e redesenha a ficha.
  await page.evaluate(async () => {
    const est = await import(new URL('./js/sheet/estado.js', location.href).href);
    const ficha = await import(new URL('./js/sheet/ficha.js', location.href).href);
    const v = est.char.inventario.find((i) => i.nome === 'Varinha de Bolas de Fogo');
    v.dados.magias[0].nome = 'Fogo & Gelo';
    ficha.renderFichaCompleta();
  });
  await botaoConjurar(page, 'Fogo & Gelo').click();
  await expect(page.locator('#modal-titulo')).toHaveText('Conjurar Fogo & Gelo');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Guerreiro só com Magias de Itens não vê Preparar Magias nem Magia Personalizada; o Mago vê', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-magias-itens-p8-2');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await expect(page.locator('.magias-de-itens')).toBeVisible();
  await expect(page.locator('#btn-add-magia')).toHaveCount(0);
  await expect(page.locator('#btn-add-magia-custom')).toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  const mago = await abrirFicha(context, { classe: 'Mago', nivel: 1, atributos: ATRIBUTOS_REGRAS }, 'regras-magias-itens-p8-3');
  await adicionarItemMagico(mago.page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await expect(mago.page.locator('#btn-add-magia')).toBeVisible();
  await expect(mago.page.locator('#btn-add-magia-custom')).toBeVisible();
  expect(mago.erros, `erros de console/página: ${mago.erros.join('; ')}`).toEqual([]);
});

test('uso diário mostra a frequência no rótulo do custo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MONGE, 'regras-magias-itens-p8-4');
  await adicionarItemMagico(page, 'Manto Aracnídeo', 'Manto Aracnídeo');
  await expect(linhaMagia(page, 'Teia')).toContainText('uso: Teia (1/amanhecer)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('confirmar a troca de concentração paga o uso uma vez e deixa só a nova magia', async ({ context }) => {
  const efeitos = [{ nome: 'Bênção', tipo: 'concentracao_generica', concentracao: true, circulo: 1, rotulo: 'Concentrando em Bênção' }];
  const { page, erros } = await abrirFicha(context, { ...MONGE, efeitos_magicos: efeitos }, 'regras-magias-itens-p8-5');
  await adicionarItemMagico(page, 'Manto Aracnídeo', 'Manto Aracnídeo');
  await equiparESintonizar(page, 'Manto Aracnídeo');
  await botaoConjurar(page, 'Teia').click();
  await expect(page.locator('#modal-overlay')).toContainText('Substituir Concentração');
  await page.click('#conc-confirmar');
  await expect(page.locator('#toast-container')).toContainText('Teia conjurada com Manto Aracnídeo');
  await expect.poll(async () => (await itemSalvo(page, 'Manto Aracnídeo')).estado_recursos.usos.Teia).toBe(1);
  const conc = ((await personagemSalvo(page)).efeitos_magicos || []).filter((e) => e.concentracao);
  expect(conc.map((e) => e.nome)).toEqual(['Teia']);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('uso gasto entre o clique e a confirmação da troca de concentração: avisa, não paga e mantém a concentração antiga', async ({ context }) => {
  const efeitos = [{ nome: 'Bênção', tipo: 'concentracao_generica', concentracao: true, circulo: 1, rotulo: 'Concentrando em Bênção' }];
  const { page, erros } = await abrirFicha(context, { ...MONGE, efeitos_magicos: efeitos }, 'regras-magias-itens-p8-6');
  await adicionarItemMagico(page, 'Manto Aracnídeo', 'Manto Aracnídeo');
  await equiparESintonizar(page, 'Manto Aracnídeo');
  await botaoConjurar(page, 'Teia').click();
  await expect(page.locator('#conc-confirmar')).toBeVisible();
  // O uso some enquanto o modal de confirmação está aberto.
  await page.evaluate(async () => {
    const est = await import(new URL('./js/sheet/estado.js', location.href).href);
    est.char.inventario.find((i) => i.nome === 'Manto Aracnídeo').estado_recursos.usos.Teia = 1;
  });
  await page.click('#conc-confirmar');
  await expect(page.locator('#toast-container')).toContainText('Não foi possível gastar o custo de Manto Aracnídeo');
  await assentar(page).catch(() => {});
  const conc = ((await personagemSalvo(page)).efeitos_magicos || []).filter((e) => e.concentracao);
  expect(conc.map((e) => e.nome)).toEqual(['Bênção']);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('fechar o modal de alvo pelo X não paga; sem condição na ficha a Restauração Menor avisa e não paga', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Druida', nivel: 1, atributos: ATRIBUTOS_REGRAS }, 'regras-magias-itens-p8-7');
  await adicionarItemMagico(page, 'Cajado da Cura', 'Cajado da Cura');
  await equiparESintonizar(page, 'Cajado da Cura');
  const antes = await cargas(page, 'Cajado da Cura');
  await botaoConjurar(page, 'Restauração Menor').click();
  await expect(page.locator('#alvo-self')).toBeVisible();
  await page.locator('#modal-header .modal-fechar').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await assentar(page).catch(() => {});
  expect(await cargas(page, 'Cajado da Cura')).toBe(antes);
  await botaoConjurar(page, 'Restauração Menor').click();
  await page.locator('#alvo-self').click();
  await expect(page.locator('#toast-container')).toContainText('Nenhuma condição removível encontrada');
  await assentar(page).catch(() => {});
  expect(await cargas(page, 'Cajado da Cura')).toBe(antes);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ---- Plano 8, Task 4, fix round 1 ----

/** Variações de personagem não-conjurador que continuam vendo os botões de preparo e de magia personalizada. */
const COM_MAGIA_PROPRIA = [
  ['Iniciado em Magia (truque de círculo 0)', { magias_conhecidas: [{ nome: 'Luz', circulo: 0, origem: 'iniciado_em_magia' }] }],
  ['magia conhecida de círculo 1 sem truque', { magias_conhecidas: [{ nome: 'Bênção', circulo: 1 }] }],
  ['magia personalizada', { magias_customizadas: [{ nome: 'Minha Magia', circulo: 1, escola: 'Evocação', tempo_conjuracao: '1 ação', alcance: '9 metros', componentes: 'V', duracao: 'Instantânea', descricao: 'Teste.' }] }],
];

for (const [rotulo, extra] of COM_MAGIA_PROPRIA) {
  test(`Guerreiro com ${rotulo} e item mágico continua vendo Preparar Magias e Magia Personalizada`, async ({ context }) => {
    const { page, erros } = await abrirFicha(context, { ...GUERREIRO, ...extra }, `regras-magias-itens-p8-${COM_MAGIA_PROPRIA.findIndex((c) => c[0] === rotulo) + 10}`);
    await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
    await expect(page.locator('.magias-de-itens')).toBeVisible();
    await expect(page.locator('#btn-add-magia')).toBeVisible();
    await expect(page.locator('#btn-add-magia-custom')).toBeVisible();
    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });
}

test('conjurar a magia de um item renderiza a ficha uma vez só', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MONGE, 'regras-magias-itens-p8-20');
  await adicionarItemMagico(page, 'Manto Aracnídeo', 'Manto Aracnídeo');
  await equiparESintonizar(page, 'Manto Aracnídeo');
  // Cada renderFichaCompleta troca o conteúdo do container da ficha: um registro com nós adicionados por render.
  await page.evaluate(async () => {
    const est = await import(new URL('./js/sheet/estado.js', location.href).href);
    window.__rendersFicha = 0;
    new MutationObserver((registros) => {
      window.__rendersFicha += registros.filter((r) => r.addedNodes.length > 0).length;
    }).observe(est.containerRef, { childList: true });
  });
  await botaoConjurar(page, 'Teia').click();
  await expect(page.locator('#toast-container')).toContainText('Teia conjurada com Manto Aracnídeo');
  await assentar(page).catch(() => {});
  expect(await page.evaluate(() => window.__rendersFicha)).toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('pagamento que falha depois do efeito: avisa, desfaz a concentração e não deixa o item pago', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MONGE, 'regras-magias-itens-p8-21');
  await adicionarItemMagico(page, 'Manto Aracnídeo', 'Manto Aracnídeo');
  await equiparESintonizar(page, 'Manto Aracnídeo');
  // Probe: o item só deixa de estar utilizável depois que o efeito (a concentração em Teia) foi aplicado.
  await page.evaluate(async () => {
    const est = await import(new URL('./js/sheet/estado.js', location.href).href);
    const manto = est.char.inventario.find((i) => i.nome === 'Manto Aracnídeo');
    Object.defineProperty(manto, 'destruido', { configurable: true, enumerable: true, get: () => (est.char.efeitos_magicos || []).some((e) => e.concentracao && e.nome === 'Teia'), set: () => {} });
  });
  await botaoConjurar(page, 'Teia').click();
  await expect(page.locator('#toast-container')).toContainText('Não foi possível gastar o custo de Manto Aracnídeo');
  await assentar(page).catch(() => {});
  const salvo = await personagemSalvo(page);
  expect((salvo.efeitos_magicos || []).filter((e) => e.concentracao)).toEqual([]);
  expect((await itemSalvo(page, 'Manto Aracnídeo')).estado_recursos.usos.Teia || 0).toBe(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Restauração Menor em outra criatura sem saldo: avisa, não conjura e não paga', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Druida', nivel: 1, atributos: ATRIBUTOS_REGRAS }, 'regras-magias-itens-p8-22');
  await adicionarItemMagico(page, 'Cajado da Cura', 'Cajado da Cura');
  await equiparESintonizar(page, 'Cajado da Cura');
  await botaoConjurar(page, 'Restauração Menor').click();
  await expect(page.locator('#alvo-outro')).toBeVisible();
  // O saldo some enquanto o modal de alvo está aberto.
  await page.evaluate(async () => {
    const est = await import(new URL('./js/sheet/estado.js', location.href).href);
    est.char.inventario.find((i) => i.nome === 'Cajado da Cura').estado_recursos.cargas = 1;
  });
  await page.locator('#alvo-outro').click();
  await expect(page.locator('#toast-container')).toContainText('Não foi possível gastar o custo de Cajado da Cura');
  await expect(page.locator('#toast-container')).not.toContainText('Restauração Menor conjurada');
  await assentar(page).catch(() => {});
  // A conjuração abortada não salva: lê o estado em memória (continua com o saldo forçado, sem desconto).
  expect(await page.evaluate(async () => {
    const est = await import(new URL('./js/sheet/estado.js', location.href).href);
    return est.char.inventario.find((i) => i.nome === 'Cajado da Cura').estado_recursos.cargas;
  })).toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('remover o item tira o bloco "Magias de Itens" sem recarregar a página', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-magias-itens-10');
  await adicionarItemMagico(page, 'Bolas de Fogo', 'Varinha de Bolas de Fogo');
  await expect(page.locator('.magias-de-itens')).toBeVisible();
  await linhaDe(page, 'Varinha de Bolas de Fogo').locator('[data-sheet-rem-inv]').click();
  await page.click('#btn-confirmar-rem-inv-sheet');
  await expect(page.locator('.magias-de-itens')).toHaveCount(0);
  expect((await personagemSalvo(page)).inventario.find((i) => i.nome.includes('Varinha de Bolas de Fogo'))).toBeUndefined();
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
