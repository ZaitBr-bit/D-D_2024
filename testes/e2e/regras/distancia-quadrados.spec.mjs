// ============================================================
// Distâncias em quadrados do grid: Deslocamento e Visão no Escuro
// exibem "N m (X q)" sem alterar o valor em metros.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha, clicarSeletorFicha } from './helpers-regras.mjs';

test('Deslocamento da ficha mostra os quadrados e mantém os metros', async ({ context }) => {
  const { page, erros } = await abrirFicha(context,
    { classe: 'Guerreiro', especie: 'Humano', nivel: 1, atributos: { ...ATRIBUTOS_REGRAS } }, 'quadrados-desl');
  await assentar(page).catch(() => {});
  const caixa = page.locator('.stat-box', { has: page.locator('.stat-label', { hasText: 'Deslocamento' }) });
  await expect(caixa.locator('.stat-value')).toHaveText('9metros · 6 q');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Visão no Escuro de 18 m aparece como 18 m (12 q) em Sentidos Passivos', async ({ context }) => {
  const { page, erros } = await abrirFicha(context,
    { classe: 'Guerreiro', especie: 'Elfo', nivel: 1, atributos: { ...ATRIBUTOS_REGRAS } }, 'quadrados-visao');
  await assentar(page).catch(() => {});
  const item = page.locator('.salva-item', { hasText: 'Visão no Escuro' });
  await expect(item).toContainText('18 m (12 q)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ------------------------------------------------------------
// Alcance das magias: tag do card, detalhe expandido e magia personalizada.
// ------------------------------------------------------------
const MAGO_MAGIAS = {
  nome: 'Aluno', especie: 'Humano', classe: 'Mago', subclasse: '', nivel: 5, xp: 6500,
  atributos: { ...ATRIBUTOS_REGRAS },
  classes: [{ classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 }],
  magias_preparadas: [
    { nome: 'Bola de Fogo', circulo: 3, classe: 'Mago' },
    { nome: 'Curar Ferimentos', circulo: 1, classe: 'Mago' },
  ],
  magias_customizadas: [
    { nome: 'Raio Curto', circulo: 1, escola: 'Evocação', tempo_conjuracao: 'Ação', alcance: '9 metros', componentes: 'V', duracao: 'Instantânea' },
    { nome: 'Olhar Longo', circulo: 1, escola: 'Adivinhação', tempo_conjuracao: 'Ação', alcance: 'sem limite', componentes: 'V', duracao: 'Instantânea' },
  ],
  schema_versao: 2,
};

/** Abre os blocos recolhíveis de magias (nascem fechados) para as linhas ficarem clicáveis. */
const abrirBlocosMagias = (page) => page.evaluate(() => {
  document.querySelectorAll('details[data-details-id^="magias-"]').forEach((d) => { d.open = true; });
});

const linhaMagia = (page, nome) => page.locator(`.magia-item[data-magia-nome="${nome}"]`).first();
const linhaCustom = (page, nome) => page.locator('.magia-item[data-magia-custom-index]', { hasText: nome });

test('Alcance da magia no card mostra os quadrados; Toque fica como está', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_MAGIAS, 'quadrados-magia-card');
  await assentar(page).catch(() => {});
  await expect(linhaMagia(page, 'Bola de Fogo').locator('.tag-alcance')).toHaveText('45 m (30 q)');
  await expect(linhaMagia(page, 'Curar Ferimentos').locator('.tag-alcance')).toHaveText('Toque');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Detalhe da magia mostra o alcance em quadrados e a descrição não muda', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_MAGIAS, 'quadrados-magia-detalhe');
  await assentar(page).catch(() => {});
  await abrirBlocosMagias(page);
  const linha = linhaMagia(page, 'Bola de Fogo');
  await linha.locator('.magia-nome').first().click();
  await expect(linha.locator('.magia-desc .magia-meta')).toContainText('45 m (30 q)');
  const desc = linha.locator('.magia-desc');
  await expect(desc).toContainText('Esfera de 6 metros de raio');
  await expect(desc).not.toContainText('6 m (4 q)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Magia personalizada: alcance em metros ganha quadrados e texto livre passa intacto', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_MAGIAS, 'quadrados-magia-custom');
  await assentar(page).catch(() => {});
  await abrirBlocosMagias(page);
  const curta = linhaCustom(page, 'Raio Curto');
  await expect(curta.locator('.tag-alcance')).toHaveText('9 m (6 q)');
  await curta.locator('.magia-nome').first().click();
  await expect(curta.locator('.magia-desc .magia-meta')).toContainText('9 m (6 q)');
  const longa = linhaCustom(page, 'Olhar Longo');
  await expect(longa.locator('.tag-alcance')).toHaveText('sem limite');
  await longa.locator('.magia-nome').first().click();
  await expect(longa.locator('.magia-desc .magia-meta')).toContainText('sem limite');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Detalhe da magia no seletor do Pergaminho Mágico mostra o alcance em quadrados', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_MAGIAS, 'quadrados-magia-pergaminho');
  await assentar(page).catch(() => {});
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('#sel-inv-cat').selectOption('magicos');
  await page.locator('#busca-inv-cat').fill('Pergaminho Mágico');
  await page.locator('[data-item-magico]', { hasText: 'Pergaminho Mágico' }).first().click();
  await page.locator('label', { hasText: 'Pergaminho Mágico (3º Círculo)' }).locator('input').check();
  await page.locator('#pergaminho-cards .opcao-card[data-magia-pergaminho="Bola de Fogo"] .opcao-nome').click();
  const popup = page.locator('.sub-modal-overlay:has(.magia-meta)');
  await expect(popup).toContainText('45 m (30 q)');
  await expect(popup).toContainText('Esfera de 6 metros de raio');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ------------------------------------------------------------
// Invocações do Necromante: Espírito Morto-Vivo e mortos-vivos do apêndice.
// ------------------------------------------------------------
const NECRO_MORTOS = {
  nome: 'Necro', especie: 'Humano', classe: 'Mago', subclasse: 'Necromante', nivel: 6, xp: 14000,
  atributos: { ...ATRIBUTOS_REGRAS, inteligencia: 16 }, pericias_proficientes: ['Arcanismo', 'História'],
  recursos: { mago: { subclasses: { necromante: { mortos_vivos: [
    { id: 'e1', nome: 'Espírito Morto-Vivo (Esquelético)', pv_max: 20, pv_atual: 20, pv_temporarios: 0, espirito: { forma: 'Esquelético', circulo: 3 } },
    { id: 'e2', nome: 'Espírito Morto-Vivo (Fantasmagórico)', pv_max: 30, pv_atual: 30, pv_temporarios: 0, espirito: { forma: 'Fantasmagórico', circulo: 3 } },
    { id: 'z1', nome: 'Zumbi', pv_max: 15, pv_atual: 15, pv_temporarios: 0, dados_de_vida: 2 },
  ] } } } },
};

test('Espírito Esquelético: card e ficha mostram o deslocamento e o alcance do Raio da Cova em quadrados', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, NECRO_MORTOS, 'quadrados-espirito-esq');
  await assentar(page).catch(() => {});
  const card = page.locator('[data-morto-vivo="e1"]');
  await expect(card).toContainText('9 m (6 q)');
  await card.locator('strong').first().click();
  const popup = page.locator('#familiar-popup-sobreposicao');
  await expect(popup.locator('p', { hasText: 'Deslocamento' })).toContainText('9 m (6 q)');
  await expect(popup.locator('p', { hasText: 'Raio da Cova' })).toContainText('alcance 45 m (30 q)');
  await expect(popup.locator('p', { hasText: 'Imunidades' })).toContainText('Visão no Escuro 18 m (12 q)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Espírito Fantasmagórico: alcance corpo a corpo e Voo em quadrados', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, NECRO_MORTOS, 'quadrados-espirito-fan');
  await assentar(page).catch(() => {});
  const card = page.locator('[data-morto-vivo="e2"]');
  await expect(card).toContainText('9 m (6 q); Voo 12 m (8 q) (pairar)');
  await card.locator('strong').first().click();
  const popup = page.locator('#familiar-popup-sobreposicao');
  await expect(popup.locator('p', { hasText: 'Deslocamento' })).toContainText('9 m (6 q); Voo 12 m (8 q) (pairar)');
  await expect(popup.locator('p', { hasText: 'Toque Mortal' })).toContainText('alcance 1,5 m (1 q)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Morto-Vivo do apêndice (Zumbi): linha do card mostra o deslocamento em quadrados', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, NECRO_MORTOS, 'quadrados-zumbi');
  await assentar(page).catch(() => {});
  await expect(page.locator('[data-morto-vivo="z1"]')).toContainText('6 m (4 q)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Escolha da forma do Espírito mostra o deslocamento em quadrados', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...NECRO_MORTOS,
    grimorio: [{ nome: 'Invocar Morto-Vivo', circulo: 3 }],
    magias_preparadas: [{ nome: 'Invocar Morto-Vivo', circulo: 3, classe: 'Mago' }],
  }, 'quadrados-espirito-escolha');
  await assentar(page).catch(() => {});
  await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); });
  await clicarSeletorFicha(page, '[data-conjurar="Invocar Morto-Vivo"]', { esperar: '#btn-confirmar-espirito' });
  await expect(page.locator('[data-espirito-info="Esquelético"] .opcao-resumo').first()).toContainText('9 m (6 q)');
  await expect(page.locator('[data-espirito-info="Fantasmagórico"] .opcao-resumo').first()).toContainText('Voo 12 m (8 q) (pairar)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Forma Selvagem ativa: o deslocamento do card mostra os quadrados', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Druida', nivel: 3, xp: 900, atributos: { ...ATRIBUTOS_REGRAS },
    recursos: { druida: { forma_selvagem_atual: { forma: 'Lobo' } } },
  }, 'quadrados-forma-ativa');
  await assentar(page).catch(() => {});
  await expect(page.locator('#card-forma-selvagem')).toContainText('12 m (8 q)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Espectro da Lâmina Maldita: o deslocamento do card mostra os quadrados', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Bruxo', subclasse: 'Patrono Lâmina Maldita', nivel: 14, xp: 355000,
    atributos: { ...ATRIBUTOS_REGRAS, carisma: 16 },
    recursos: { lamina_maldita: { espectro_ativo: true, espectro_usado: true } },
  }, 'quadrados-espectro');
  await assentar(page).catch(() => {});
  await expect(page.locator('[data-lamina-maldita-espectro]')).toContainText('1,5 m (1 q), Voo 15 m (10 q) (pairar)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Impressão: Deslocamento e Visão no Escuro saem com quadrados', async ({ context }) => {
  const { page, erros } = await abrirFicha(context,
    { classe: 'Guerreiro', especie: 'Elfo', nivel: 1, atributos: { ...ATRIBUTOS_REGRAS } }, 'quadrados-impressao');
  await assentar(page).catch(() => {});
  const html = await page.evaluate(async () => {
    const mod = await import(new URL('./js/sheet/impressao.js', location.href).href);
    return mod.gerarHtmlImpressao();
  });
  expect(html).toContain('9 m (6 q)');
  expect(html).toContain('18 m (12 q)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Aura de Proteção do Paladino: raio estruturado sai em quadrados', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Paladino', nivel: 6, xp: 14000, atributos: { ...ATRIBUTOS_REGRAS, carisma: 16 },
  }, 'quadrados-aura-paladino');
  await assentar(page).catch(() => {});
  const corpo = page.locator('body');
  await expect(corpo).toContainText('Salvaguardas (3 m (2 q))');
  await expect(corpo).toContainText('aliados em 3 m (2 q).');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Sentidos Selvagens do Guardião: a nota do chip mostra os quadrados', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guardião', nivel: 18, xp: 85000, atributos: { ...ATRIBUTOS_REGRAS },
  }, 'quadrados-sentidos-selvagens');
  await assentar(page).catch(() => {});
  await expect(page.locator('body')).toContainText('Sentidos Selvagens: Visão às Cegas 9 m (6 q).');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Andarilho de Telhados: a Escalada igual ao Deslocamento mostra os quadrados', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    especie: 'Humano', classe: 'Ladino', subclasse: 'Ladrão', nivel: 3, xp: 900, atributos: { ...ATRIBUTOS_REGRAS },
  }, 'quadrados-andarilho');
  await assentar(page).catch(() => {});
  await expect(page.locator('body')).toContainText('Deslocamento de Escalada = Deslocamento normal (9 m (6 q)).');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
