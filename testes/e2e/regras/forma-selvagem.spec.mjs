// ============================================================
// Druida: Companheiro Selvagem (conjura Convocar Familiar, familiar Feérico
// que some no Descanso Longo) e Forma Selvagem (formas conhecidas, escolha
// da forma em cards, PV temporários, sem conjuração e card de ATIVA).
//
// Todos CLICAM: o relato foi que o Companheiro "não invoca a magia" e que a
// Forma Selvagem não era funcional (só ligava um botão).
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirBlocosRecursos, abrirFicha, assentar, clicarBotaoFicha, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const DRUIDA = {
  classe: 'Druida', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Natureza', 'Sobrevivência'],
  magias_preparadas: [{ nome: 'Curar Ferimentos', circulo: 1, classe: 'Druida' }],
};

/** Abre a ficha do Druida com os blocos de recursos abertos. */
async function fichaDoDruida(context, id, extra = {}) {
  const lado = await abrirFicha(context, { ...DRUIDA, ...extra }, id);
  await assentar(lado.page).catch(() => {});
  await abrirBlocosRecursos(lado.page);
  return lado;
}

/** Usos de Forma Selvagem gastos e espaços de 1º círculo gastos. */
async function gastos(page) {
  const p = await personagemSalvo(page);
  return { usos: p.recursos?.druida?.forma_selvagem_usos_gastos || 0, espacos: Number(p.espacos_magia?.conjuracao?.[1] || 0) };
}

test('Companheiro Selvagem: conjura Convocar Familiar com tela de escolha, familiar Feérico, gasta um uso', async ({ context }) => {
  const { page, erros } = await fichaDoDruida(context, 'druida-companheiro-uso');
  const antes = await gastos(page);

  await clicarSeletorFicha(page, '[data-druida-companheiro-acao="toggle"]', { esperar: '#btn-confirmar-familiar' });
  await expect(page.locator('#modal-titulo')).toContainText('Convocar Familiar');
  await expect(page.locator('[data-familiar-custo="uso"]')).toBeVisible();
  await expect(page.locator('[data-familiar-custo="espaco"]')).toBeVisible();
  await expect(page.locator('[data-familiar-card="Gato"]')).toBeVisible();
  await page.locator('[data-familiar-toggle="Gato"]').click();
  await expect(page.locator('[data-familiar-tipo]'), 'o familiar do Companheiro é sempre Feérico').toHaveCount(0);
  await page.locator('#btn-confirmar-familiar').click();
  await assentar(page).catch(() => {});

  const card = page.locator('#card-familiar');
  await expect(card).toContainText('Gato');
  await expect(card).toContainText('Feérico');
  await expect(card).toContainText('Companheiro Selvagem');
  const depois = await gastos(page);
  expect(depois.usos, 'gasta um uso de Forma Selvagem').toBe(antes.usos + 1);
  expect(depois.espacos).toBe(antes.espacos);
  expect((await personagemSalvo(page)).recursos.familiar).toMatchObject({ forma: 'Gato', tipo: 'Feérico', origem: 'companheiro_selvagem' });
  await abrirBlocosRecursos(page);
  await expect(page.locator('[data-recurso-info="druida-companheiro-selvagem"]')).toContainText('Ativo: Gato');

  // O Descanso Longo faz o familiar do Companheiro desaparecer.
  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  if (await page.locator('#btn-pular-troca-dl').isVisible().catch(() => false)) await page.locator('#btn-pular-troca-dl').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#card-familiar')).toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Companheiro Selvagem: pode gastar um espaço de magia em vez do uso', async ({ context }) => {
  const { page, erros } = await fichaDoDruida(context, 'druida-companheiro-espaco');
  const antes = await gastos(page);

  await clicarSeletorFicha(page, '[data-druida-companheiro-acao="toggle"]', { esperar: '#btn-confirmar-familiar' });
  await page.locator('[data-familiar-custo="espaco"]').click();
  await page.locator('[data-familiar-toggle="Coruja"]').click();
  await page.locator('#btn-confirmar-familiar').click();
  await assentar(page).catch(() => {});

  await expect(page.locator('#card-familiar')).toContainText('Coruja');
  const depois = await gastos(page);
  expect(depois.espacos, 'gasta um espaço de magia').toBe(antes.espacos + 1);
  expect(depois.usos, 'e não o uso de Forma Selvagem').toBe(antes.usos);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Companheiro Selvagem: dispensar remove o familiar', async ({ context }) => {
  const { page, erros } = await fichaDoDruida(context, 'druida-companheiro-dispensar', {
    recursos: { familiar: { forma: 'Gato', tipo: 'Feérico', especial: false, pv_max: 2, pv_atual: 2, situacao: 'ativo', origem: 'companheiro_selvagem' } },
  });
  await expect(page.locator('#card-familiar')).toContainText('Gato');
  await clicarSeletorFicha(page, '[data-druida-companheiro-acao="toggle"]');
  await assentar(page).catch(() => {});
  await expect(page.locator('#card-familiar')).toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Forma Selvagem: formas conhecidas, escolha em cards, PV temporários, ATIVA, sem conjuração e sair', async ({ context }) => {
  const { page, erros } = await fichaDoDruida(context, 'druida-forma-selvagem');
  const antes = await gastos(page);

  // Sem formas conhecidas, ativar abre antes a tela de formas conhecidas (com as recomendadas).
  await clicarSeletorFicha(page, '[data-druida-forma-acao="ativar"]', { esperar: '#btn-salvar-formas-conhecidas' });
  await expect(page.locator('#modal-titulo')).toContainText('Formas conhecidas');
  await expect(page.locator('[data-familiar-card="Lobo"]')).toBeVisible();
  await expect(page.locator('[data-familiar-card="Coruja"]'), 'forma com voo não é elegível no nível 3').toHaveCount(0);
  await expect(page.locator('#forma-selvagem-selecao')).toContainText('Selecionadas: 4 / 4');
  await page.locator('#btn-salvar-formas-conhecidas').click();

  // Em seguida, a escolha entre as formas conhecidas.
  await page.waitForSelector('#btn-confirmar-forma-selvagem', { state: 'visible' });
  await expect(page.locator('[data-familiar-card]')).toHaveCount(4);
  await expect(page.locator('#forma-selvagem-selecao')).toContainText('PV temporários');
  await page.locator('[data-familiar-info="Lobo"]').click();
  await expect(page.locator('#familiar-popup-sobreposicao'), 'o nome abre a ficha técnica').toContainText('Lobo');
  await page.locator('#btn-fechar-familiar-popup').click();
  await page.locator('[data-familiar-toggle="Lobo"]').click();
  await page.locator('#btn-confirmar-forma-selvagem').click();
  await assentar(page).catch(() => {});

  const card = page.locator('#card-forma-selvagem');
  await expect(card, 'a forma ativa fica clara na ficha').toBeVisible();
  await expect(card, 'a tela é levada ao card da forma ativa').toBeInViewport();
  await expect(card).toContainText('ATIVA');
  await expect(card).toContainText('Lobo');
  await expect(card).toContainText('não conjura magias');
  const salvo = await personagemSalvo(page);
  expect(salvo.pv_temporario, 'PV temporários = nível de Druida').toBe(3);
  expect(salvo.recursos.druida.forma_selvagem_atual.forma).toBe('Lobo');
  expect((await gastos(page)).usos, 'gasta um uso').toBe(antes.usos + 1);

  // Em forma, não conjura (e não gasta espaço).
  await abrirBlocosRecursos(page);
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  const espacosAntes = (await gastos(page)).espacos;
  await clicarSeletorFicha(page, '[data-conjurar="Curar Ferimentos"]');
  await expect(page.locator('#toast-container')).toContainText('Forma Selvagem');
  expect((await gastos(page)).espacos).toBe(espacosAntes);

  // Sair da forma.
  await card.locator('[data-druida-forma-acao="encerrar"]').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#card-forma-selvagem')).toHaveCount(0);
  expect((await personagemSalvo(page)).recursos.druida.forma_selvagem_ativa).toBe(false);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Forma Selvagem: trocar de forma gasta outro uso e o Descanso Longo encerra a forma', async ({ context }) => {
  const { page, erros } = await fichaDoDruida(context, 'druida-forma-trocar', {
    recursos: { druida: { formas_conhecidas: ['Lobo', 'Rato', 'Aranha', 'Cavalo de Montaria'] } },
  });

  await clicarSeletorFicha(page, '[data-druida-forma-acao="ativar"]', { esperar: '#btn-confirmar-forma-selvagem' });
  await page.locator('[data-familiar-toggle="Lobo"]').click();
  await page.locator('#btn-confirmar-forma-selvagem').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#card-forma-selvagem')).toContainText('Lobo');

  await clicarSeletorFicha(page, '#card-forma-selvagem [data-druida-forma-acao="ativar"]', { esperar: '#btn-confirmar-forma-selvagem' });
  await expect(page.locator('#forma-selvagem-selecao')).toContainText('Você já está em Forma Selvagem (Lobo)');
  await page.locator('[data-familiar-toggle="Rato"]').click();
  await page.locator('#btn-confirmar-forma-selvagem').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#card-forma-selvagem')).toContainText('Rato');
  expect((await gastos(page)).usos, 'trocar gasta outro uso').toBe(2);

  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  if (await page.locator('#btn-pular-troca-dl').isVisible().catch(() => false)) await page.locator('#btn-pular-troca-dl').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#card-forma-selvagem')).toHaveCount(0);
  expect((await gastos(page)).usos, 'o Descanso Longo devolve os usos').toBe(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Formas conhecidas: abre pelo chip e pela tela de ativar, e salva a nova escolha', async ({ context }) => {
  const { page, erros } = await fichaDoDruida(context, 'druida-formas-gerenciar', {
    recursos: { druida: { formas_conhecidas: ['Lobo', 'Rato', 'Aranha', 'Cavalo de Montaria'] } },
  });

  // Pelo chip do bloco de recursos.
  await clicarSeletorFicha(page, '[data-druida-forma-acao="formas"]', { esperar: '#btn-salvar-formas-conhecidas' });
  await expect(page.locator('#forma-selvagem-selecao')).toContainText('Selecionadas: 4 / 4');
  await page.locator('[data-familiar-toggle="Rato"]').click();
  await expect(page.locator('#forma-selvagem-selecao')).toContainText('Selecionadas: 3 / 4');
  await page.locator('[data-familiar-toggle="Gato"]').click();
  await page.locator('#btn-salvar-formas-conhecidas').click();
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).recursos.druida.formas_conhecidas.sort()).toEqual(['Aranha', 'Cavalo de Montaria', 'Gato', 'Lobo']);

  // Pela tela de ativar a forma.
  await abrirBlocosRecursos(page);
  await clicarSeletorFicha(page, '[data-druida-forma-acao="ativar"]', { esperar: '#btn-gerenciar-formas' });
  await page.locator('#btn-gerenciar-formas').click();
  await expect(page.locator('#btn-salvar-formas-conhecidas')).toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Formas conhecidas: agrupadas por ND do maior para o menor, com selo de origem nas Feras do Manual dos Monstros', async ({ context }) => {
  const { page, erros } = await fichaDoDruida(context, 'druida-formas-nd', {
    nivel: 8, xp: 34000, recursos: { druida: { formas_conhecidas: ['Lobo', 'Rato', 'Aranha', 'Cavalo de Montaria'] } },
  });

  await clicarSeletorFicha(page, '[data-druida-forma-acao="formas"]', { esperar: '#btn-salvar-formas-conhecidas' });
  const grupos = await page.locator('[data-forma-grupo-nd]').evaluateAll((els) => els.map((e) => e.dataset.formaGrupoNd));
  expect(grupos.length, 'há mais de um grupo de ND').toBeGreaterThan(2);
  const valor = (nd) => (nd.includes('/') ? Number(nd.split('/')[0]) / Number(nd.split('/')[1]) : Number(nd));
  expect(grupos.map(valor), 'do maior ND para o menor').toEqual([...grupos.map(valor)].sort((a, b) => b - a));
  expect(grupos[0], 'o nível 8 vai até ND 1').toBe('1');

  // Fera nova do Manual dos Monstros: aparece com o selo de origem.
  const card = page.locator('[data-familiar-card="Sanguessuga Gigante"]');
  await expect(card).toBeVisible();
  await expect(card.locator('.selo-fonte')).toHaveText('Monstros');
  await expect(page.locator('[data-familiar-card="Hatori"]'), 'ND 6 passa do limite do nível 8').toHaveCount(0);

  // Escolhe a fera nova como forma conhecida e assume a forma.
  await page.locator('[data-familiar-toggle="Rato"]').click();
  await page.locator('[data-familiar-toggle="Sanguessuga Gigante"]').click();
  await page.locator('#btn-salvar-formas-conhecidas').click();
  await assentar(page).catch(() => {});
  await abrirBlocosRecursos(page);
  await clicarSeletorFicha(page, '[data-druida-forma-acao="ativar"]', { esperar: '#btn-confirmar-forma-selvagem' });
  await page.locator('[data-familiar-toggle="Sanguessuga Gigante"]').click();
  await page.locator('#btn-confirmar-forma-selvagem').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#card-forma-selvagem')).toContainText('Sanguessuga Gigante');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
