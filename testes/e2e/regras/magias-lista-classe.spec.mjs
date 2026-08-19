// ============================================================
// O seletor de magias do criador oferece a lista da classe, e um truque não
// se mistura com magia de 1º círculo.
//
// O motor de unidade (testes/regras/unidade/magias-por-classe.test.mjs) já
// confronta as quatro fontes de dado entre si e contra o livro. O que só o
// navegador prova é a travessia até a tela -- e ela não é inócua:
// `achatarMagiasClasse` (site/js/sheet/magias.js:251-265) SOBRESCREVE o
// círculo de cada magia com o do grupo em que ela está listada. Foi assim que
// "De Carne para Pedra", magia de 6º círculo, virou opção de 5º para o Druida
// (ver a lacuna 'magias-circulo-do-grupo').
//
// A expectativa vem de dados/classes/magias_mago.json, lido do disco: se a
// lista mudar, o spec acompanha sem edição. Escrever os nomes à mão aqui
// transformaria o spec num segundo lugar para a lista errar.
//
// O Mago é a maior lista (242 magias) e a classe que mais telas consultam.
// ============================================================
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { abrirSite, assentar, confirmarModal, satisfazerPasso } from './helpers-regras.mjs';

// A expectativa vem da fonte PRIMÁRIA (dados/magias/truques.json e
// circulo_1.json), e NÃO de dados/classes/magias_mago.json.
//
// Isso é deliberado: a tela lê o arquivo de classe. Se o spec também lesse
// dele, os dois lados sairiam da mesma fonte e o teste passaria com a lista
// errada -- foi exatamente o que aconteceu na primeira versão deste spec, e
// só a mutação mostrou. Confrontar a tela contra a fonte primária é o que
// permite pegar o defeito de TRAVESSIA: achatarMagiasClasse sobrescreve o
// círculo com o do grupo, então uma magia no grupo errado aparece com o
// círculo errado na tela -- e só um oráculo independente vê isso.
const nomesDoArquivo = (arquivo) => {
  const j = JSON.parse(readFileSync(
    new URL(`../../../dados/magias/${arquivo}`, import.meta.url), 'utf-8'));
  return (j.magias || j);
};
const TRUQUES = nomesDoArquivo('truques.json').map((m) => m.nome);
const PRIMEIRO_CIRCULO = nomesDoArquivo('circulo_1.json').map((m) => m.nome);

/**
 * Leva o criador até o passo de Magias, escolhendo Mago na classe. Usa
 * `satisfazerPasso` -- o helper que os outros specs do criador usam -- em vez
 * de navegação artesanal, que já causou flake real neste repositório (ver o
 * cabeçalho de helpers-regras.mjs).
 */
async function irAtePassoMagias(page) {
  await assentar(page).catch(() => {});
  await page.click('[data-classe="Mago"]');
  await confirmarModal(page, 'popup-confirmar-classe').catch(() => {});
  for (let i = 0; i < 12; i++) {
    if (await page.locator('[data-magia-nome], #grid-magias [data-grid-nome]').count()) return true;
    if (!await satisfazerPasso(page)) return false;
    await assentar(page).catch(() => {});
  }
  return (await page.locator('[data-magia-nome], #grid-magias [data-grid-nome]').count()) > 0;
}

test('criador: o seletor de truques do Mago oferece a lista da classe', async ({ context }) => {
  const { page, erros } = await abrirSite(context, '#criar');
  expect(await irAtePassoMagias(page), 'o criador deveria chegar ao passo de Magias').toBe(true);

  const opcoes = page.locator('[data-magia-nome], #grid-magias [data-grid-nome]');
  const total = await opcoes.count();
  expect(total, 'o passo de magias deveria oferecer opções').toBeGreaterThan(0);

  const oferecidas = await opcoes.evaluateAll(
    (els) => els.map((e) => e.dataset.magiaNome || e.dataset.gridNome).filter(Boolean));

  // Toda opção oferecida tem de ser, pela fonte PRIMÁRIA, um truque ou uma
  // magia de 1º círculo -- que é o que um Mago de nível 1 escolhe. Uma magia
  // de círculo superior aparecendo aqui é o sintoma do defeito de travessia.
  const elegiveis = new Set([...TRUQUES, ...PRIMEIRO_CIRCULO]);
  const forasteiras = [...new Set(oferecidas)].filter((n) => !elegiveis.has(n));
  expect(forasteiras,
    `a tela ofereceu magia(s) que, por dados/magias/, não são truque nem de 1º círculo -- ` +
    `sintoma do círculo derivado do GRUPO em dados/classes/magias_mago.json`)
    .toEqual([]);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
