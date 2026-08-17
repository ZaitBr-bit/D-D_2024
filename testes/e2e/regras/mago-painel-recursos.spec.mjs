// ============================================================
// O painel "Recursos do Mago" (topo da ficha, sempre aberto) mostra as
// magias escolhidas de Maestria de Magias e Assinatura Mágica, e deixa
// conjurá-las dali.
//
// Motivo (2026-08-17): as duas características ganharam tela de escolha na
// v2.2.1, mas o botão de escolher vive no card de Características de
// Classe, que vem RECOLHIDO -- medido: `definir-maestria-magias` existia no
// DOM e `isVisible()` era `false`. O painel do topo, esse sim visível,
// continuava com os rótulos genéricos "Assinatura 1"/"Assinatura 2" e uma
// frase solta sobre a Maestria, sem botão e sem dizer QUAIS magias eram.
// Duas fontes para a mesma informação, e a segunda não acompanhou.
//
// Por isso este spec afirma `toBeVisible()`, e não `toHaveCount(1)`: foi
// exatamente a diferença entre "existe no DOM" e "o jogador enxerga" que
// deixou o problema passar pelos testes anteriores.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const GRIMORIO = [
  { nome: 'Mísseis Mágicos', circulo: 1 },
  { nome: 'Despedaçar', circulo: 2 },
  { nome: 'Bola de Fogo', circulo: 3 },
  { nome: 'Contramagia', circulo: 3 },
];

const MAGO_ESCOLHIDO = {
  classe: 'Mago', nivel: 20, xp: 355000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
  grimorio: GRIMORIO,
  recursos: {
    mago: {
      maestria_magias: { c1: 'Mísseis Mágicos', c2: 'Despedaçar' },
      assinaturas: { m1: 'Bola de Fogo', m2: 'Contramagia' },
    },
  },
};

const MAGO_SEM_ESCOLHA = {
  classe: 'Mago', nivel: 20, xp: 355000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
  grimorio: GRIMORIO,
};

test('painel: as magias escolhidas aparecem nos botões, sem precisar expandir nada', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_ESCOLHIDO, 'regras-mago-painel');
  await assentar(page).catch(() => {});

  const painel = page.locator('#painel-recursos-mago');
  await expect(painel).toBeVisible();

  // Assinaturas: o botão leva o nome da magia, não "Assinatura 1".
  await expect(painel.locator('[data-mago-acao="assinatura-1"]')).toBeVisible();
  await expect(painel.locator('[data-mago-acao="assinatura-1"]')).toContainText('Bola de Fogo');
  await expect(painel.locator('[data-mago-acao="assinatura-2"]')).toContainText('Contramagia');

  // Maestria: conjuração à vontade, que antes não tinha botão nenhum.
  await expect(painel.locator('[data-mago-acao="maestria-1"]')).toBeVisible();
  await expect(painel.locator('[data-mago-acao="maestria-1"]')).toContainText('Mísseis Mágicos');
  await expect(painel.locator('[data-mago-acao="maestria-2"]')).toContainText('Despedaçar');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('painel: conjurar pela Maestria não gasta espaço de magia', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_ESCOLHIDO, 'regras-mago-painel-uso');
  await assentar(page).catch(() => {});

  const antes = await personagemSalvo(page);
  const usadosAntes = Object.values(antes.espacos_magia || {}).reduce((s, e) => s + (e.usados || 0), 0);

  await clicarSeletorFicha(page, '#painel-recursos-mago [data-mago-acao="maestria-1"]');
  await assentar(page).catch(() => {});
  // À vontade: pode de novo, sem limite de usos.
  await clicarSeletorFicha(page, '#painel-recursos-mago [data-mago-acao="maestria-1"]');
  await assentar(page).catch(() => {});

  const depois = await personagemSalvo(page);
  const usadosDepois = Object.values(depois.espacos_magia || {}).reduce((s, e) => s + (e.usados || 0), 0);
  expect(usadosDepois, 'a Maestria de Magias não pode consumir espaço de magia').toBe(usadosAntes);
  await expect(page.locator('#painel-recursos-mago [data-mago-acao="maestria-1"]')).toBeEnabled();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('painel: sem escolha feita, o atalho para escolher fica à vista', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_SEM_ESCOLHA, 'regras-mago-painel-vazio');
  await assentar(page).catch(() => {});

  const painel = page.locator('#painel-recursos-mago');
  // Sem magia escolhida não há o que conjurar -- o painel oferece a escolha
  // em vez de deixar o jogador procurar o card recolhido.
  await expect(painel.locator('[data-mago-acao="definir-maestria-magias"]')).toBeVisible();
  await expect(painel.locator('[data-mago-acao="definir-assinaturas"]')).toBeVisible();
  await expect(painel.locator('[data-mago-acao="maestria-1"]')).toHaveCount(0);
  await expect(painel.locator('[data-mago-acao="assinatura-1"]')).toHaveCount(0);

  // E o atalho abre a mesma tela de escolha do card.
  await clicarSeletorFicha(page, '#painel-recursos-mago [data-mago-acao="definir-assinaturas"]',
    { esperar: '#btn-salvar-magias-fixas' });
  await expect(page.locator('#magia-fixa-m1')).toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
