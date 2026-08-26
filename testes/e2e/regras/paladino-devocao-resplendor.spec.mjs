// ============================================================
// Resplendor Sagrado (Paladino, Juramento da Devoção, nível 20):
// o botão "restaurar" gasta UM espaço de magia de 5º círculo e
// devolve o uso da característica.
//
// Defeito que este spec mede (2026-08-22): o handler
// `devocao_resplendor_restaurar` (habilidades.js:1600) chamava
// `getEspacosMagia(char.classe, ...)` passando a STRING do nome da
// classe onde a função espera o ARRAY da tabela de características.
// A guarda de utils.js:394 não pega string não vazia, e a linha 395
// executa `'Paladino'.find(...)` -> TypeError. O clique não fazia
// nada, sem erro na tela.
//
// O spec afirma o EFEITO (um espaço de 5º gasto), não só a ausência
// de exceção: um handler que engolisse o erro em try/catch passaria
// num teste que só conferisse "não quebrou".
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar } from './helpers-regras.mjs';

test('Resplendor Sagrado: restaurar gasta um espaço de 5º círculo', async ({ context }) => {
  // Resplendor Sagrado só é concedido no nível 20 (dados/classes/paladino.json:357);
  // um Paladino de nível menor nem tem o card na ficha, e o botão nunca
  // aparece -- foi preciso subir de 17 para 20 depois que o spec falhou na
  // guarda de vacuidade em vez de no defeito medido (ver relatório da
  // Tarefa 1). Nível 20 também garante o espaço de 5º círculo (concedido
  // a partir do 17, meio conjurador).
  const { page, erros } = await abrirFicha(context, {
    classe: 'Paladino',
    subclasse: 'Juramento da Devoção',
    nivel: 20,
    xp: 355000,
    atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Atletismo', 'Persuasão'],
  }, 'regras-paladino-resplendor');
  await assentar(page).catch(() => {});

  // Marcar o Resplendor como já usado e garantir um espaço de 5º livre,
  // que é o estado em que o botão "restaurar" faz sentido.
  await page.evaluate(() => {
    const lista = JSON.parse(localStorage.getItem('dnd_personagens') || '[]');
    const p = lista.find((x) => x.id === 'regras-paladino-resplendor');
    p.recursos = p.recursos || {};
    p.recursos.paladino = p.recursos.paladino || {};
    p.recursos.paladino.subclasses = p.recursos.paladino.subclasses || {};
    p.recursos.paladino.subclasses.devocao = { resplendor_sagrado_usado: true };
    p.espacos_magia = p.espacos_magia || {};
    p.espacos_magia[5] = { total: 1, usados: 0 };
    localStorage.setItem('dnd_personagens', JSON.stringify(lista));
  });
  await page.reload();
  await assentar(page).catch(() => {});

  // GUARDA CONTRA VACUIDADE: o botão precisa existir antes de qualquer
  // afirmação sobre o que ele faz.
  const botao = page.locator('[data-paladino-subclasse-acao="devocao_resplendor_restaurar"]');
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  await expect(botao).toHaveCount(1, {
    message: 'o botão de restaurar Resplendor Sagrado precisa estar na ficha',
  });

  await botao.first().click();
  await assentar(page).catch(() => {});

  const estado = await page.evaluate(() => {
    const lista = JSON.parse(localStorage.getItem('dnd_personagens') || '[]');
    const p = lista.find((x) => x.id === 'regras-paladino-resplendor');
    return {
      // A forma armazenada virou por FONTE (Tarefa 4, sub-projeto 4):
      // `usados` mora em `espacos_magia.conjuracao[circulo]` (ou `.pacto`),
      // não mais em `espacos_magia[circulo].usados`. Paladino não tem
      // Magia de Pacto -- a fonte é sempre 'conjuracao' aqui. O seed
      // acima continua escrevendo a forma ANTIGA de propósito -- é
      // migrada de verdade pelo caminho real (migrarEspacosDeMagia,
      // chamado por gastarEspaco) quando o botão gasta o espaço.
      usados5: p.espacos_magia?.conjuracao?.[5] ?? null,
      chaveFantasma: p.espacos_magia?.['5_usado'] ?? null,
      resplendorUsado: p.recursos?.paladino?.subclasses?.devocao?.resplendor_sagrado_usado ?? null,
    };
  });

  expect(estado.usados5, 'o espaço de 5º círculo tem de ser debitado em espacos_magia.conjuracao[5]').toBe(1);
  expect(estado.chaveFantasma, "a chave '5_usado' não pertence ao modelo").toBeNull();
  expect(estado.resplendorUsado, 'o Resplendor Sagrado tem de voltar a estar disponível').toBe(false);
  expect(erros, 'nenhum erro de console durante o clique').toEqual([]);
});
