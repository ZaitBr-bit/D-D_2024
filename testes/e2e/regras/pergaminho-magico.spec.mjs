// ============================================================
// Issue #103 (b) -- Pergaminho Mágico só em Itens Mágicos; variante +
// grade de magias com "Em branco" fixo e padrão; troca depois de
// adicionado; conjuração consome o pergaminho.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, abrirSite, irAtePassoEquipamento, personagemSalvo, clicarBotaoFicha, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const MAGO_5 = {
  nome: 'Aluno', especie: 'Humano', classe: 'Mago', subclasse: '', nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  classes: [{ classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 }], schema_versao: 2,
};

/** Fecha todos os modais abertos e espera o overlay principal sumir. */
async function fecharTudo(page) {
  await page.evaluate(() => window.fecharModalTodos());
  await expect(page.locator('#modal-overlay')).toBeHidden();
}

/** Abre o Adicionar Item e busca o texto na categoria dada (ex.: 'equipamento', 'magicos'). */
async function buscarNaCategoria(page, categoria, texto) {
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption(categoria);
  await page.locator('#busca-inv-cat').fill(texto);
}

/** Abre o modal do Pergaminho Mágico em Itens Mágicos e marca a variante pelo texto. */
async function abrirPergaminho(page, variante) {
  await buscarNaCategoria(page, 'magicos', 'Pergaminho Mágico');
  await page.locator('[data-item-magico]', { hasText: 'Pergaminho Mágico' }).first().click();
  await page.locator('label', { hasText: variante }).locator('input').check();
}

/** Localiza o card de uma magia na grade do pergaminho pelo nome. */
const card = (page, magia) => page.locator(`#pergaminho-cards .opcao-card[data-magia-pergaminho="${magia}"]`);

/** Seleciona a magia clicando no círculo (.opcao-check) do card; '' = "Em branco". */
const marcar = (page, magia) => card(page, magia).locator('.opcao-check').click();

/** Sub-modal de detalhes da magia (empilhado sobre o seletor; identificado pelo bloco de metadados). */
const popupDetalhes = (page) => page.locator('.sub-modal-overlay:has(.magia-meta)');

/** Adiciona um pergaminho em branco de 3º círculo e abre a troca de magia pelo detalhe do item. */
async function abrirTrocaDoPergaminho(page) {
  await abrirPergaminho(page, 'Pergaminho Mágico (3º Círculo)');
  await page.click('#btn-confirmar-item-magico');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  await page.click('[data-info-inv-sheet="0"]');
  await page.click('#btn-pergaminho-magia');
}

test('adicionando: clicar no corpo do card abre os detalhes e não muda a seleção', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-103-detalhe-a');
  await abrirPergaminho(page, 'Pergaminho Mágico (3º Círculo)');
  await card(page, 'Bola de Fogo').locator('.opcao-nome').click();
  await expect(popupDetalhes(page)).toBeVisible();
  await expect(popupDetalhes(page)).toContainText('Bola de Fogo');
  await expect(popupDetalhes(page)).toContainText('Evocação');
  await expect(card(page, '')).toHaveClass(/selecionada/);
  await expect(card(page, 'Bola de Fogo')).not.toHaveClass(/selecionada/);
});

test('adicionando: clicar no círculo seleciona sem abrir popup; fechar o popup mantém o seletor e a seleção', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-103-detalhe-b');
  await abrirPergaminho(page, 'Pergaminho Mágico (3º Círculo)');
  await marcar(page, 'Bola de Fogo');
  await expect(popupDetalhes(page)).toHaveCount(0);
  await expect(card(page, 'Bola de Fogo')).toHaveClass(/selecionada/);
  await expect(card(page, '')).not.toHaveClass(/selecionada/);

  await card(page, 'Relâmpago').locator('.opcao-nome').click();
  await expect(popupDetalhes(page)).toBeVisible();
  await popupDetalhes(page).locator('button', { hasText: 'Fechar' }).click();
  await expect(popupDetalhes(page)).toHaveCount(0);
  await expect(page.locator('#pergaminho-cards')).toBeVisible();
  await expect(card(page, 'Bola de Fogo')).toHaveClass(/selecionada/);
  await expect(card(page, 'Relâmpago')).not.toHaveClass(/selecionada/);
  await page.click('#btn-confirmar-item-magico');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).inventario[0].nome).toBe('Pergaminho Mágico (3º Círculo): Bola de Fogo');
});

test('"Em branco": o corpo do card também seleciona, sem popup', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-103-detalhe-c');
  await abrirPergaminho(page, 'Pergaminho Mágico (3º Círculo)');
  await marcar(page, 'Bola de Fogo');
  await card(page, '').locator('.opcao-nome').click();
  await expect(popupDetalhes(page)).toHaveCount(0);
  await expect(card(page, '')).toHaveClass(/selecionada/);
  await expect(card(page, 'Bola de Fogo')).not.toHaveClass(/selecionada/);
  await marcar(page, 'Bola de Fogo');
  await marcar(page, '');
  await expect(card(page, '')).toHaveClass(/selecionada/);
});

test('troca pelo detalhe do item: corpo abre detalhes, círculo seleciona, fechar o popup mantém a seleção', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-103-detalhe-d');
  await abrirTrocaDoPergaminho(page);
  await card(page, 'Bola de Fogo').locator('.opcao-nome').click();
  await expect(popupDetalhes(page)).toContainText('Bola de Fogo');
  await expect(card(page, '')).toHaveClass(/selecionada/);
  await popupDetalhes(page).locator('button', { hasText: 'Fechar' }).click();
  await expect(popupDetalhes(page)).toHaveCount(0);
  await expect(page.locator('#btn-confirmar-pergaminho-magia')).toBeVisible();
  await marcar(page, 'Relâmpago');
  await expect(popupDetalhes(page)).toHaveCount(0);
  await page.click('#btn-confirmar-pergaminho-magia');
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).inventario[0].dados.magias[0].nome).toBe('Relâmpago');
});

test('clique duplo síncrono em "Trocar magia" abre um só seletor e troca uma só unidade', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    ...MAGO_5,
    inventario: [{ nome: 'Pergaminho Mágico (1º Círculo)', tipo: 'equipamento', quantidade: 2, equipado: false, descricao: '', dados: {} }],
  }, 'regras-103-duplo');
  await page.click('[data-info-inv-sheet="0"]');
  await page.locator('#btn-pergaminho-magia').evaluate(el => { el.click(); el.click(); });
  await expect(page.locator('#btn-confirmar-pergaminho-magia').first()).toBeVisible();
  expect(await page.locator('#btn-confirmar-pergaminho-magia').count()).toBe(1);
  expect(await page.locator('.sub-modal-overlay').count()).toBe(1);
  await marcar(page, 'Mísseis Mágicos');
  await page.click('#btn-confirmar-pergaminho-magia');
  await assentar(page).catch(() => {});
  const inv = (await personagemSalvo(page)).inventario;
  expect(inv.map(i => [i.nome, i.quantidade])).toEqual([
    ['Pergaminho Mágico (1º Círculo)', 1],
    ['Pergaminho Mágico (1º Círculo): Mísseis Mágicos', 1],
  ]);
});

test('falha ao carregar o índice de magias: avisa e o modal continua com só "Em branco"', async ({ context }) => {
  await context.route('**/magias/_indice.json*', rota => rota.abort());
  const { page } = await abrirFicha(context, MAGO_5, 'regras-103-indice');
  await abrirPergaminho(page, 'Pergaminho Mágico (3º Círculo)');
  await expect(page.locator('#toast-container')).toContainText('Não foi possível carregar as magias.');
  await expect(card(page, '')).toHaveClass(/selecionada/);
  await expect(page.locator('#pergaminho-cards .opcao-card[data-circulo]')).toHaveCount(0);
  await page.click('#btn-confirmar-item-magico');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).inventario[0].nome).toBe('Pergaminho Mágico (3º Círculo)');
});

test('conjuração cancelada (recusa trocar a concentração) mantém o pergaminho no inventário', async ({ context }) => {
  const efeitos = [{ nome: 'Bênção', tipo: 'concentracao_generica', concentracao: true, circulo: 1, rotulo: 'Concentrando em Bênção' }];
  const { page } = await abrirFicha(context, {
    ...MAGO_5,
    efeitos_magicos: efeitos,
    inventario: [{ nome: 'Pergaminho Mágico (1º Círculo): Heroísmo', tipo: 'equipamento', quantidade: 1, equipado: false, descricao: '',
      dados: { pergaminho: { circulo: 1, nome_base: 'Pergaminho Mágico (1º Círculo)' }, magias: [{ nome: 'Heroísmo', custo: 'consome', conjuracao: { cd: 13, ataque: 5 }, circulo_base: 1 }] } }],
  }, 'regras-103-cancela');
  await page.locator('.magias-de-itens [data-conjurar-item="0"]').click();
  await expect(page.locator('#modal-overlay')).toContainText('Substituir Concentração');
  await page.click('#conc-cancelar');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await assentar(page).catch(() => {});
  const salvo = await personagemSalvo(page);
  expect(salvo.inventario).toHaveLength(1);
  expect(salvo.efeitos_magicos.filter(e => e.concentracao).map(e => e.nome)).toEqual(['Bênção']);
});

test('pergaminho removido enquanto a confirmação da concentração está aberta: avisa, não conjura e mantém a concentração antiga', async ({ context }) => {
  const efeitos = [{ nome: 'Bênção', tipo: 'concentracao_generica', concentracao: true, circulo: 1, rotulo: 'Concentrando em Bênção' }];
  const { page } = await abrirFicha(context, {
    ...MAGO_5,
    efeitos_magicos: efeitos,
    inventario: [{ nome: 'Pergaminho Mágico (1º Círculo): Heroísmo', tipo: 'equipamento', quantidade: 1, equipado: false, descricao: '',
      dados: { pergaminho: { circulo: 1, nome_base: 'Pergaminho Mágico (1º Círculo)' }, magias: [{ nome: 'Heroísmo', custo: 'consome', conjuracao: { cd: 13, ataque: 5 }, circulo_base: 1 }] } }],
  }, 'regras-103-removido');
  await page.locator('.magias-de-itens [data-conjurar-item="0"]').click();
  await expect(page.locator('#conc-confirmar')).toBeVisible();
  await page.evaluate(async () => {
    const est = await import(new URL('./js/sheet/estado.js', location.href).href);
    est.char.inventario.length = 0;
  });
  await page.click('#conc-confirmar');
  // Heroísmo aceita outra criatura: o modal de alvo vem depois da confirmação.
  await page.locator('#alvo-self').click();
  await expect(page.locator('#toast-container')).toContainText('Não foi possível gastar o custo de');
  await assentar(page).catch(() => {});
  const salvo = await personagemSalvo(page);
  expect(salvo.efeitos_magicos.filter(e => e.concentracao).map(e => e.nome)).toEqual(['Bênção']);
});

test('pergaminho antigo (Equipamento, sem dados.pergaminho) e novo em branco com o mesmo nome: documenta o agrupamento', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    ...MAGO_5,
    inventario: [{ nome: 'Pergaminho Mágico (1º Círculo)', tipo: 'equipamento', quantidade: 1, equipado: false, descricao: '', dados: { custo: '50 PO' } }],
  }, 'regras-103-antigo-novo');
  await abrirPergaminho(page, 'Pergaminho Mágico (1º Círculo)');
  await page.click('#btn-confirmar-item-magico');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  const inv = (await personagemSalvo(page)).inventario;
  // adicionarAoInventario agrupa por nome + tipo: o novo em branco soma na linha antiga.
  expect(inv.map(i => [i.nome, i.tipo, i.quantidade])).toEqual([['Pergaminho Mágico (1º Círculo)', 'equipamento', 2]]);
});

test('Equipamento não lista mais o Pergaminho Mágico; Itens Mágicos lista', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-issue-103-a');
  await buscarNaCategoria(page, 'equipamento', 'perga');
  await expect(page.locator('#lista-inv-cat')).toContainText('Pergaminho');
  await expect(page.locator('#lista-inv-cat')).not.toContainText('Pergaminho Mágico');
  await page.locator('#sel-inv-cat').selectOption('magicos');
  await page.locator('#busca-inv-cat').fill('Pergaminho Mágico');
  await expect(page.locator('[data-item-magico]', { hasText: 'Pergaminho Mágico' }).first()).toBeVisible();
});

test('categoria Todos: o Pergaminho Mágico não vem pelas linhas de Equipamento (só pelas de Itens Mágicos)', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-issue-103-todos');
  await buscarNaCategoria(page, 'todos', 'Pergaminho Mágico');
  await expect(page.locator('[data-item-magico]', { hasText: 'Pergaminho Mágico' }).first()).toBeVisible();
  const linhasEquip = page.locator('#lista-inv-cat .inv-item:not([data-item-magico])', { hasText: 'Pergaminho Mágico' });
  await expect(linhasEquip).toHaveCount(0);
});

test('a grade de magias só aparece depois da variante e abre com "Em branco" selecionado', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-issue-103-b');
  await buscarNaCategoria(page, 'magicos', 'Pergaminho Mágico');
  await page.locator('[data-item-magico]', { hasText: 'Pergaminho Mágico' }).first().click();
  await expect(page.locator('#pergaminho-cards')).toBeHidden();
  await page.locator('label', { hasText: 'Pergaminho Mágico (3º Círculo)' }).locator('input').check();
  await expect(page.locator('#pergaminho-cards')).toBeVisible();
  await expect(card(page, '')).toContainText('Em branco');
  await expect(card(page, '')).toHaveClass(/selecionada/);
});

test('só magias do círculo da variante; "Em branco" continua visível com a busca ativa', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-issue-103-c');
  await abrirPergaminho(page, 'Pergaminho Mágico (3º Círculo)');
  const circulos = await page.locator('#pergaminho-cards .opcao-card[data-circulo]').evaluateAll(cs => cs.map(c => c.dataset.circulo));
  expect(circulos.length).toBeGreaterThan(5);
  expect(new Set(circulos)).toEqual(new Set(['3']));
  await page.fill('#pergaminho-busca', 'Bola de Fogo');
  await expect(card(page, 'Bola de Fogo')).toBeVisible();
  await expect(card(page, 'Relâmpago')).toBeHidden();
  await expect(card(page, '')).toBeVisible();

  await page.locator('label', { hasText: 'Pergaminho Mágico (Truque)' }).locator('input').check();
  const truques = await page.locator('#pergaminho-cards .opcao-card[data-circulo]').evaluateAll(cs => cs.map(c => c.dataset.circulo));
  expect(new Set(truques)).toEqual(new Set(['0']));
});

test('adicionar sem escolher magia grava o pergaminho em branco (nome base, sem magias, selo Em branco)', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-issue-103-d');
  await abrirPergaminho(page, 'Pergaminho Mágico (3º Círculo)');
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('adicionado');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  const item = (await personagemSalvo(page)).inventario[0];
  expect(item.nome).toBe('Pergaminho Mágico (3º Círculo)');
  expect(item.dados.magias).toEqual([]);
  await expect(page.locator('.inv-item[data-idx]', { hasText: 'Pergaminho Mágico' })).toContainText('Em branco');
  await expect(page.locator('.magias-de-itens')).toHaveCount(0);
});

test('sem marcar a variante o botão recusa e não grava', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-issue-103-e');
  await buscarNaCategoria(page, 'magicos', 'Pergaminho Mágico');
  await page.locator('[data-item-magico]', { hasText: 'Pergaminho Mágico' }).first().click();
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('Escolha a variante');
  expect((await personagemSalvo(page)).inventario || []).toHaveLength(0);
});

test('3º círculo com Bola de Fogo: o item entra com a magia e aparece em Magias de Itens', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-issue-103-f');
  await abrirPergaminho(page, 'Pergaminho Mágico (3º Círculo)');
  await marcar(page, 'Bola de Fogo');
  await expect(card(page, 'Bola de Fogo')).toHaveClass(/selecionada/);
  await expect(card(page, '')).not.toHaveClass(/selecionada/);
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('adicionado');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
  const item = (await personagemSalvo(page)).inventario[0];
  expect(item.nome).toBe('Pergaminho Mágico (3º Círculo): Bola de Fogo');
  expect(item.dados.magias[0]).toMatchObject({ nome: 'Bola de Fogo', custo: 'consome', circulo_base: 3 });
  await expect(page.locator('.magias-de-itens')).toContainText('Bola de Fogo');
  await expect(page.locator('.magias-de-itens')).toContainText('consome o pergaminho');
  await expect(page.locator('.magias-de-itens')).toContainText('CD 15');
});

test('depois de adicionado: escolher, trocar e voltar a Em branco pelo detalhe do item', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-issue-103-g');
  await abrirPergaminho(page, 'Pergaminho Mágico (3º Círculo)');
  await page.click('#btn-confirmar-item-magico');
  await fecharTudo(page);
  await assentar(page).catch(() => {});

  const abrirTroca = async () => {
    await page.click('[data-info-inv-sheet="0"]');
    await page.click('#btn-pergaminho-magia');
  };
  await abrirTroca();
  await expect(card(page, '')).toHaveClass(/selecionada/);
  await marcar(page, 'Bola de Fogo');
  await page.click('#btn-confirmar-pergaminho-magia');
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).inventario[0].nome).toBe('Pergaminho Mágico (3º Círculo): Bola de Fogo');

  await abrirTroca();
  await expect(card(page, 'Bola de Fogo')).toHaveClass(/selecionada/);
  await marcar(page, 'Relâmpago');
  await page.click('#btn-confirmar-pergaminho-magia');
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).inventario[0].dados.magias[0].nome).toBe('Relâmpago');

  await abrirTroca();
  await marcar(page, '');
  await page.click('#btn-confirmar-pergaminho-magia');
  await assentar(page).catch(() => {});
  const item = (await personagemSalvo(page)).inventario[0];
  expect(item.nome).toBe('Pergaminho Mágico (3º Círculo)');
  expect(item.dados.magias).toEqual([]);
});

test('pergaminho antigo (comprado como Equipamento) também ganha o botão de escolher a magia', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    ...MAGO_5,
    inventario: [{ nome: 'Pergaminho Mágico (1º Círculo)', tipo: 'equipamento', quantidade: 1, equipado: false, descricao: '', dados: { custo: '50 PO' } }],
  }, 'regras-issue-103-h');
  await page.click('[data-info-inv-sheet="0"]');
  await page.click('#btn-pergaminho-magia');
  await marcar(page, 'Mísseis Mágicos');
  await page.click('#btn-confirmar-pergaminho-magia');
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).inventario[0].nome).toBe('Pergaminho Mágico (1º Círculo): Mísseis Mágicos');
});

test('quantidade 2: trocar a magia separa uma unidade e a outra continua em branco', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    ...MAGO_5,
    inventario: [{ nome: 'Pergaminho Mágico (1º Círculo)', tipo: 'equipamento', quantidade: 2, equipado: false, descricao: '', dados: {} }],
  }, 'regras-issue-103-i');
  await page.click('[data-info-inv-sheet="0"]');
  await page.click('#btn-pergaminho-magia');
  await marcar(page, 'Mísseis Mágicos');
  await page.click('#btn-confirmar-pergaminho-magia');
  await assentar(page).catch(() => {});
  const inv = (await personagemSalvo(page)).inventario;
  expect(inv).toHaveLength(2);
  expect(inv.map(i => [i.nome, i.quantidade])).toEqual([
    ['Pergaminho Mágico (1º Círculo)', 1],
    ['Pergaminho Mágico (1º Círculo): Mísseis Mágicos', 1],
  ]);
});

test('conjurar sem equipar consome o pergaminho e não gasta espaço de magia', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    ...MAGO_5,
    inventario: [{ nome: 'Pergaminho Mágico (1º Círculo): Mísseis Mágicos', tipo: 'equipamento', quantidade: 1, equipado: false, descricao: '',
      dados: { pergaminho: { circulo: 1, nome_base: 'Pergaminho Mágico (1º Círculo)' }, magias: [{ nome: 'Mísseis Mágicos', custo: 'consome', conjuracao: { cd: 13, ataque: 5 }, circulo_base: 1 }] } }],
  }, 'regras-issue-103-j');
  await assentar(page).catch(() => {});
  const antes = JSON.stringify((await personagemSalvo(page)).espacos_magia ?? null);
  const botao = page.locator('.magias-de-itens [data-conjurar-item="0"]');
  await expect(botao).toBeEnabled();
  await botao.click();
  await assentar(page).catch(() => {});
  const salvo = await personagemSalvo(page);
  expect(salvo.inventario).toHaveLength(0);
  expect(JSON.stringify(salvo.espacos_magia ?? null)).toEqual(antes);
  await expect(page.locator('.magias-de-itens')).toHaveCount(0);
});

test('quantidade 2: conjurar consome só um pergaminho', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    ...MAGO_5,
    inventario: [{ nome: 'Pergaminho Mágico (1º Círculo): Mísseis Mágicos', tipo: 'equipamento', quantidade: 2, equipado: false, descricao: '',
      dados: { pergaminho: { circulo: 1, nome_base: 'Pergaminho Mágico (1º Círculo)' }, magias: [{ nome: 'Mísseis Mágicos', custo: 'consome', conjuracao: { cd: 13, ataque: 5 }, circulo_base: 1 }] } }],
  }, 'regras-issue-103-k');
  await page.locator('.magias-de-itens [data-conjurar-item="0"]').click();
  await assentar(page).catch(() => {});
  const salvo = await personagemSalvo(page);
  expect(salvo.inventario).toHaveLength(1);
  expect(salvo.inventario[0].quantidade).toBe(1);
});

test('criador (sem Itens Mágicos): Equipamento ainda lista o Pergaminho Mágico', async ({ context }) => {
  const { page } = await abrirSite(context, '#criar');
  expect(await irAtePassoEquipamento(page, 'Guardião'), 'não chegou ao passo de equipamento').toBe(true);
  await clicarBotaoFicha(page, 'btn-add-item', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption('equipamento');
  await page.locator('#busca-inv-cat').fill('Pergaminho Mágico');
  await expect(page.locator('#lista-inv-cat')).toContainText('Pergaminho Mágico (Truque)');
  await expect(page.locator('#lista-inv-cat')).toContainText('Pergaminho Mágico (1º Círculo)');
});
