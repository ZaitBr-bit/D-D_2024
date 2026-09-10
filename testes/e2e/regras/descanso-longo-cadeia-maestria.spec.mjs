// ============================================================
// Issue #51 -- "Trocar Maestrias" no Descanso Longo abria a troca de
// MAGIA por cima da de maestria.
//
// abrirModalMaestrias so monta o modal; o `await` resolvia na hora e o
// proximo passo da cadeia disparava em seguida. O jogador (Paladina,
// classe de troca TOTAL) via "Trocar Magia Conhecida" sobre
// "Maestrias em Arma".
//
// Um botao novo so esta entregue com um spec que clica nele -- por isso os
// dois botoes "Cancelar" novos (btn-cancelar-maestrias, do modal completo, e
// btn-cancelar-troca-maestria, do modal 1-por-1) tambem tem teste proprio
// abaixo: cancelar tem de manter a cadeia do Descanso Longo tanto quanto
// salvar.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, clicarBotaoFicha, personagemSalvo, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

// Guerreiro 3/Cavaleiro Místico: cai no ramo Bárbaro/Guerreiro de
// abrirModalTrocaMaestriaDescanso, mas SEM nenhuma maestria definida ainda
// -- exercita o ramo `atuais.length === 0`, que abre o modal COMPLETO em
// vez do de troca 1-por-1 e (Achado 6 da rodada final) não tinha teste
// nenhum provando que a cadeia continua depois dele. Cavaleiro Místico
// conjura por tabela própria a partir do nível 3 (Classes.md), o que dá a
// este Guerreiro uma magia preparada para trocar depois da maestria.
const GUERREIRO_3_SEM_MAESTRIA = {
  nome: 'Aldo', especie: 'Humano', classe: 'Guerreiro', subclasse: 'Cavaleiro Místico',
  nivel: 3, xp: 900,
  atributos: { forca: 16, destreza: 14, constituicao: 14, inteligencia: 16, sabedoria: 10, carisma: 8 },
  maestrias_arma: [],
  magias_preparadas: [{ nome: 'Escudo Arcano', circulo: 1, classe: 'Guerreiro' }],
  classes: [{ classe: 'Guerreiro', subclasse: 'Cavaleiro Místico', nivel: 3, ordem: 0 }],
  schema_versao: 2,
};

// Bárbaro 3: troca 1-por-1 de maestria (Bárbaro cai no ramo Bárbaro/
// Guerreiro de abrirModalTrocaMaestriaDescanso) com uma maestria ja
// definida, para exercitar o modal de troca (nao o completo). Bárbaro nao
// conjura -- nao ha passo de magia ou truque depois, entao cancelar tem de
// simplesmente fechar o modal sem travar em nada.
const BARBARO_3 = {
  nome: 'Grunk', especie: 'Meio-Orc', classe: 'Bárbaro', subclasse: 'Trilha do Fanático',
  nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
  maestrias_arma: ['Espada Longa'],
  classes: [{ classe: 'Bárbaro', subclasse: 'Trilha do Fanático', nivel: 3, ordem: 0 }],
  schema_versao: 2,
};

// Paladina 5: troca TOTAL de maestria (Paladino esta em CLASSES_TROCA_TOTAL)
// E uma troca de magia preparada por Descanso Longo -- as duas condicoes que
// o defeito precisa para se manifestar.
const PALADINA_5 = {
  nome: 'Melissa Laladrin', especie: 'Humano', classe: 'Paladino', subclasse: 'Juramento de Devoção',
  nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  maestrias_arma: ['Espada Longa'],
  magias_preparadas: [{ nome: 'Favor Divino', circulo: 1, classe: 'Paladino' }],
  classes: [{ classe: 'Paladino', subclasse: 'Juramento de Devoção', nivel: 5, ordem: 0 }],
  schema_versao: 2,
};

/** Abre a ficha, faz o Descanso Longo e devolve a page com o modal aberto. */
async function descansarLongo(context) {
  const { page } = await abrirFicha(context, PALADINA_5, 'regras-issue-51');
  await assentar(page).catch(() => {});
  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  return page;
}

test('o modal do Descanso Longo oferece "Trocar Maestrias"', async ({ context }) => {
  const page = await descansarLongo(context);
  await expect(page.locator('#btn-trocar-maestrias-dl')).toBeVisible();
});

test('clicar em "Trocar Maestrias" abre SO o modal de maestria', async ({ context }) => {
  const page = await descansarLongo(context);
  await page.locator('#btn-trocar-maestrias-dl').click();
  await assentar(page).catch(() => {});

  // O titulo visivel tem de ser o de maestria, nao o de troca de magia.
  const titulo = page.locator('#modal-titulo');
  await expect(titulo).toContainText(/Maestria/i);
  await expect(titulo).not.toContainText(/Magia/i);
});

test('a cadeia segue para a troca de magia DEPOIS de salvar a maestria', async ({ context }) => {
  const page = await descansarLongo(context);
  await page.locator('#btn-trocar-maestrias-dl').click();
  await assentar(page).catch(() => {});

  await page.locator('#btn-salvar-maestrias').click();
  await assentar(page).catch(() => {});

  await expect(page.locator('#modal-titulo')).toContainText(/Magia/i);
});

test('cancelar a troca de maestria (modal completo) também segue a cadeia até a troca de magia', async ({ context }) => {
  const page = await descansarLongo(context);
  await page.locator('#btn-trocar-maestrias-dl').click();
  await assentar(page).catch(() => {});

  await page.locator('#btn-cancelar-maestrias').click();
  await assentar(page).catch(() => {});

  // Quem desiste da maestria continua tendo direito a troca de magia --
  // sem isso o "Cancelar" engoliria os passos seguintes em silencio.
  await expect(page.locator('#modal-titulo')).toContainText(/Magia/i);
});

test('confirmar a troca de maestria (1-por-1) grava a arma nova e fecha o modal', async ({ context }) => {
  const { page } = await abrirFicha(context, BARBARO_3, 'regras-issue-51-barbaro-trocar');
  await assentar(page).catch(() => {});
  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});

  await page.locator('#btn-trocar-maestrias-dl').click();
  await assentar(page).catch(() => {});

  // Passo 1 (sai): só há UMA maestria hoje ("Espada Longa"), então o
  // componente é o card de apresentação com "Trocar este" -- não um
  // seletor clicável (ver montarTroca, ui-opcoes.js).
  await page.locator('[data-troca-um]').click();
  await assentar(page).catch(() => {});

  // Passo 2 (entra): escolhe "Machado de Batalha", elegível para Bárbaro
  // (arma marcial corpo a corpo).
  await page.locator('#troca-passo-entra .opcao-card[data-opcao="Machado de Batalha"]').click();
  await assentar(page).catch(() => {});

  await page.locator('#btn-confirmar-troca-maestria').click();
  await assentar(page).catch(() => {});

  // Bárbaro nao conjura: sem passo seguinte, confirmar tambem so fecha o
  // modal -- o mesmo efeito de "Cancelar" no teste ao lado, so que com a
  // troca de verdade gravada.
  await expect(page.locator('#modal-titulo')).toBeHidden();

  const salvo = await personagemSalvo(page);
  expect(salvo.maestrias_arma, 'a troca de maestria não foi gravada').toContain('Machado de Batalha');
  expect(salvo.maestrias_arma, 'a maestria antiga continuou na ficha').not.toContain('Espada Longa');
});

test('cancelar a troca de maestria (1-por-1) fecha o modal sem travar a cadeia', async ({ context }) => {
  const { page } = await abrirFicha(context, BARBARO_3, 'regras-issue-51-barbaro');
  await assentar(page).catch(() => {});
  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});

  await page.locator('#btn-trocar-maestrias-dl').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-confirmar-troca-maestria')).toBeVisible();

  await page.locator('#btn-cancelar-troca-maestria').click();
  await assentar(page).catch(() => {});

  // Bárbaro nao conjura: sem passo seguinte na cadeia, cancelar so fecha o
  // modal -- nenhum erro, nenhum modal preso aberto.
  await expect(page.locator('#modal-titulo')).toBeHidden();
});

test('sem maestria nenhuma definida, salvar o modal completo segue a cadeia até a troca de magia', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO_3_SEM_MAESTRIA, 'regras-issue-51-guerreiro-sem-maestria');
  await assentar(page).catch(() => {});
  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});

  await page.locator('#btn-trocar-maestrias-dl').click();
  await assentar(page).catch(() => {});

  // Sem maestria definida, cai no modal COMPLETO (mesmo de abrirModalMaestrias),
  // não no de troca 1-por-1 -- o título é "Maestrias em Arma", não "Trocar Maestria".
  const titulo = page.locator('#modal-titulo');
  await expect(titulo).toContainText('Maestrias em Arma');

  await page.locator('#btn-salvar-maestrias').click();
  await assentar(page).catch(() => {});

  // A cadeia do Descanso Longo continua: sem isso, quem sai do modal
  // completo pelo Salvar perderia em silêncio a troca de magia seguinte
  // (Achado 6 da rodada final de revisão da issue #51).
  await expect(titulo).toContainText(/Magia/i);
});
