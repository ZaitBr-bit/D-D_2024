// ============================================================
// Mago: as características que "sempre têm magias preparadas" pedem QUAIS
// magias são -- Maestria de Magias (nível 18) e Assinatura Mágica (nível
// 20) -- e Memorizar Magia (nível 5) aparece no Descanso Curto.
//
// Prova de navegador porque o defeito era de TELA: as regras existiam
// como flag ("ativa a partir do nível X") e a ficha oferecia botões de
// uso sem nunca perguntar a magia. O motor de unidade
// (unidade/mago-magias-fixas.test.mjs) cobre a gravação e a lista de
// preparadas; aqui o que se prova é que a escolha existe e chega lá.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const GRIMORIO = [
  { nome: 'Mísseis Mágicos', circulo: 1 },
  { nome: 'Despedaçar', circulo: 2 },
  { nome: 'Bola de Fogo', circulo: 3 },
  { nome: 'Contramagia', circulo: 3 },
];

const MAGO = (nivel) => ({
  classe: 'Mago', nivel, xp: 355000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
  grimorio: GRIMORIO,
});

test('ficha: Assinatura Mágica pede as duas magias de 3º círculo do livro', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO(20), 'regras-mago-assinatura');

  await clicarSeletorFicha(page, '[data-mago-acao="definir-assinaturas"]',
    { esperar: '#btn-salvar-magias-fixas' });
  await assentar(page).catch(() => {});

  // Só magias de 3º círculo do próprio livro podem ser assinatura.
  const opcoes = page.locator('#modal-overlay [data-opcao]');
  await expect(opcoes.first()).toBeVisible();
  const nomes = await opcoes.evaluateAll(els => els.map(e => e.dataset.opcao));
  expect(new Set(nomes)).toEqual(new Set(['Bola de Fogo', 'Contramagia']));

  await page.locator('#modal-overlay [data-opcao="Bola de Fogo"]').first().click();
  await page.click('#btn-salvar-magias-fixas');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo.recursos.mago.assinaturas.m1).toBe('Bola de Fogo');
  const preparada = salvo.magias_preparadas.find(m => m.nome === 'Bola de Fogo');
  expect(preparada?.origem).toBe('assinatura_magica');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: Maestria de Magias pede uma magia de 1º e uma de 2º círculo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO(18), 'regras-mago-maestria');

  await clicarSeletorFicha(page, '[data-mago-acao="definir-maestria-magias"]',
    { esperar: '#btn-salvar-magias-fixas' });
  await assentar(page).catch(() => {});

  // Uma vaga por círculo, cada uma com sua própria lista.
  await expect(page.locator('#magia-fixa-c1')).toBeVisible();
  await expect(page.locator('#magia-fixa-c2')).toBeVisible();
  await expect(page.locator('#magia-fixa-c1 [data-opcao="Mísseis Mágicos"]')).toHaveCount(1);
  await expect(page.locator('#magia-fixa-c2 [data-opcao="Despedaçar"]')).toHaveCount(1);
  // Magia de 3º círculo não pode entrar em nenhuma das duas vagas.
  await expect(page.locator('#modal-overlay [data-opcao="Bola de Fogo"]')).toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('descanso curto: Mago de nível 5 recebe a opção de Memorizar Magia', async ({ context }) => {
  const personagem = { ...MAGO(5), magias_preparadas: [{ nome: 'Mísseis Mágicos', circulo: 1 }] };
  const { page, erros } = await abrirFicha(context, personagem, 'regras-mago-memorizar');

  await clicarBotaoFicha(page, 'btn-descanso-curto', { esperar: '#btn-memorizar-magia-curto' });
  await assentar(page).catch(() => {});

  await expect(page.locator('#btn-memorizar-magia-curto')).toBeVisible();

  // Clicar de verdade: a versão anterior deste teste parava no "o botão
  // aparece", e um ReferenceError dentro de mostrarTrocaMagias
  // (getMagiaPreparadas sem import) passou batido justamente por isso --
  // o modal só quebrava no clique. Ver
  // unidade/imports-nao-resolvidos.test.mjs, o motor que nasceu do mesmo bug.
  await clicarBotaoFicha(page, 'btn-memorizar-magia-curto', { esperar: '#resultado-troca' });
  await assentar(page).catch(() => {});
  await expect(page.locator('#modal-titulo')).toContainText('Trocar Magias Preparadas');
  await expect(page.locator('#troca-contador')).toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
