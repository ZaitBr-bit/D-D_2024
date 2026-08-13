// ============================================================
// Conjurador Ritualista: a lista de magias rituais precisa aparecer e a
// escolha precisa chegar no personagem -- nas DUAS telas que montam o
// talento (subida de nível e "+ Talento" da ficha).
//
// Bug relatado: o rótulo "Selecione 2 magias rituais de 1º círculo"
// aparecia com NADA abaixo dele, e confirmar batia em "Escolha exatamente 2
// magias rituais distintas de 1º círculo" -- sem haver o que escolher.
//
// Causa: o código varria `magias/circulo_N.json` procurando `m.ritual ||
// m.especial === 'R'`. Nenhum dos dois campos existe naquele acervo: o
// marcador Ritual vive em `tempo_conjuracao` ("1 minuto ou Ritual"). O
// filtro nunca casava, e `rituais` saía vazio. Corrigido com
// `getMagiasRituais` (db.js), o mesmo critério que o Pacto do Tomo do Bruxo
// já usava. São 11 magias rituais de 1º círculo.
//
// O teste fixa o número (11) de propósito: uma lista que volte a esvaziar,
// ou um filtro frouxo que passe a aceitar magias não-rituais, falha aqui.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, irAteEscolhaDeTalento, personagemSalvo } from './helpers-regras.mjs';

const ATRIBUTOS = { forca: 12, destreza: 14, constituicao: 14,
                    inteligencia: 15, sabedoria: 13, carisma: 13 };

// As 11 magias rituais de 1º círculo do acervo, conferidas contra as DUAS
// fontes independentes de marcador Ritual (`tempo_conjuracao` em
// magias/circulo_1.json e `especial` em classes/magias_<classe>.json).
const RITUAIS_1O_CIRCULO = 11;

test('subida de nível: Conjurador Ritualista lista as magias rituais e grava a escolha', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', nivel: 3, xp: 2700, atributos: ATRIBUTOS, talentos: [],
  }, 'regras-ritualista-lvlup');

  expect(await irAteEscolhaDeTalento(page), 'não chegou à tela de ASI/talento').toBe(true);
  await page.check('input[name="levelup-asi-modo"][value="talento"]', { timeout: 1500 }).catch(() => {});
  await page.waitForSelector('#levelup-talento-lista .opcao-card', { state: 'visible', timeout: 10_000 });

  await page.locator('#levelup-talento-lista .opcao-card[data-opcao="Conjurador Ritualista"]').click();
  await page.waitForSelector('#levelup-rituais-lista .opcao-card', { state: 'visible', timeout: 10_000 });

  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('#levelup-rituais-lista .opcao-card')].map(c => c.dataset.opcao));
  expect(cards.length, 'a lista de magias rituais nasceu vazia -- é o bug original')
    .toBe(RITUAIS_1O_CIRCULO);
  expect(cards, 'Identificar é ritual de 1º círculo e deveria estar na lista').toContain('Identificar');
  expect(cards, 'Mísseis Mágicos NÃO é ritual e não pode entrar na lista').not.toContain('Mísseis Mágicos');

  // Bônus de proficiência 2 no nível 3->4: exatamente 2 escolhas.
  await page.locator('#levelup-rituais-lista .opcao-card[data-opcao="Identificar"]').click();
  await page.locator('#levelup-rituais-lista .opcao-card[data-opcao="Alarme"]').click();
  // O talento tambem exige o atributo (+1); sem ele a subida e barrada por
  // outro motivo e o teste nao mediria as magias rituais.
  await page.selectOption('#levelup-talento-asi', 'inteligencia');
  await page.waitForTimeout(300);

  for (let i = 0; i < 6; i++) {
    if (await page.locator('#btn-confirmar-levelup').isVisible().catch(() => false)) break;
    await page.locator('#btn-step-proximo').click().catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.locator('#btn-confirmar-levelup').click();
  await page.waitForTimeout(900);

  const salvo = await personagemSalvo(page);
  expect(salvo?.talentos, 'o talento deveria ter sido gravado').toContain('Conjurador Ritualista');
  const gravadas = JSON.stringify(salvo || {});
  expect(gravadas, 'a magia ritual escolhida não chegou ao personagem').toContain('Identificar');
  expect(gravadas, 'a segunda magia ritual escolhida não chegou ao personagem').toContain('Alarme');

  expect(erros).toEqual([]);
});

test('ficha: "+ Talento" com Conjurador Ritualista lista as magias e grava a escolha', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', nivel: 4, xp: 2700, atributos: ATRIBUTOS, talentos: [],
  }, 'regras-ritualista-ficha');

  await page.locator('#btn-add-talento').click();
  await page.waitForSelector('#add-talento-lista .opcao-card', { state: 'visible', timeout: 10_000 });
  await page.locator('#add-talento-lista .opcao-card[data-opcao="Conjurador Ritualista"]').click();
  await page.locator('#btn-confirmar-add-talento').click();

  // Segundo modal ("Configurar Talento"), onde a lista de rituais mora.
  await page.waitForSelector('#levelup-rituais-lista .opcao-card', { state: 'visible', timeout: 10_000 });
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('#levelup-rituais-lista .opcao-card')].map(c => c.dataset.opcao));
  expect(cards.length, 'a lista de magias rituais nasceu vazia no "+ Talento" da ficha')
    .toBe(RITUAIS_1O_CIRCULO);

  await page.locator('#levelup-rituais-lista .opcao-card[data-opcao="Identificar"]').click();
  await page.locator('#levelup-rituais-lista .opcao-card[data-opcao="Alarme"]').click();
  await page.waitForTimeout(300);
  await page.selectOption('#levelup-talento-asi', 'inteligencia');
  await page.locator('#btn-confirmar-add-talento-asi').click();
  await page.waitForTimeout(900);

  const salvo = await personagemSalvo(page);
  expect(salvo?.talentos, 'o talento deveria ter sido gravado').toContain('Conjurador Ritualista');
  const gravadas = JSON.stringify(salvo || {});
  expect(gravadas, 'a magia ritual escolhida não chegou ao personagem').toContain('Identificar');
  expect(gravadas, 'a segunda magia ritual escolhida não chegou ao personagem').toContain('Alarme');

  expect(erros).toEqual([]);
});
