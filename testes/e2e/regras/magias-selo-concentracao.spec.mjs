// ============================================================
// O selo "Conc." do seletor de magias do criador.
//
// O motor de unidade (unidade/magias-por-classe.test.mjs) confronta o marcador
// `especial` contra a `duracao` da magia. O que só o navegador prova é que o
// selo CHEGA à tela -- e a travessia não era inócua: `passo-magias.js`
// comparava `m.especial === 'C'` por igualdade EXATA, e Detectar Magia tem
// marcador combinado `"C, R"`. O selo nunca aparecia.
//
// Era o mesmo defeito que levelup-ui.js:1004-1012 registra como já corrigido
// em outro lugar (a lista do Conjurador Ritualista nascia vazia por comparar
// `=== 'R'`). Nenhuma lacuna cobria este ponto: ele só apareceu ao desenhar o
// conserto da lacuna 'magias-marcador-concentracao'.
//
// O PAR é o que dá valor ao spec. Só afirmar que Detectar Magia tem o selo
// passaria se a tela carimbasse "Conc." em TODA magia -- por isso Curar
// Ferimentos ("Instantânea") entra junto, afirmando o contrário. As duas são
// de 1º círculo do Bardo, aparecem na mesma grade, e a expectativa de cada uma
// vem da `duracao` em dados/magias/, não do marcador que a tela lê.
// ============================================================
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { abrirSite, assentar, confirmarModal, satisfazerPasso } from './helpers-regras.mjs';

/** Lê a duração de uma magia na fonte PRIMÁRIA (dados/magias/circulo_1.json). */
function duracaoNoAcervo(nome) {
  const j = JSON.parse(readFileSync(
    new URL('../../../dados/magias/circulo_1.json', import.meta.url), 'utf-8'));
  const m = (j.magias || j).find((x) => x.nome === nome);
  return m?.duracao || '';
}

const COM_CONCENTRACAO = 'Detectar Magia';
const SEM_CONCENTRACAO = 'Curar Ferimentos';

/**
 * Leva o criador até o passo de Magias com um Bardo e abre a aba do 1º
 * Círculo -- o passo nasce na aba "Truques" (passo-magias.js:132), e as duas
 * magias do par são de 1º círculo. Usa `satisfazerPasso` -- o helper que os
 * outros specs do criador usam -- em vez de navegação artesanal, que já causou
 * flake real neste repositório.
 */
async function irAtePassoMagias(page) {
  await assentar(page).catch(() => {});
  await page.click('[data-classe="Bardo"]');
  await confirmarModal(page, 'popup-confirmar-classe').catch(() => {});
  for (let i = 0; i < 12; i++) {
    if (await page.locator('[data-tab-circ="1"]').count()) {
      // O clique na aba é parte do que este spec prova: o selo é montado em
      // `renderMagiasCirculo`, que só roda quando a aba do círculo é aberta.
      await page.click('[data-tab-circ="1"]');
      await assentar(page).catch(() => {});
      return (await page.locator(`[data-magia-nome="${COM_CONCENTRACAO}"]`).count()) > 0;
    }
    if (!await satisfazerPasso(page)) return false;
    await assentar(page).catch(() => {});
  }
  return false;
}

test('criador: o selo Conc. segue a duração da magia, não a igualdade exata do marcador', async ({ context }) => {
  // O oráculo vem do acervo, e é conferido aqui: se alguém editar a duração
  // destas magias, o spec para de valer em silêncio -- e esta guarda avisa.
  expect(duracaoNoAcervo(COM_CONCENTRACAO),
    `${COM_CONCENTRACAO} precisa exigir Concentração em dados/magias/ para este spec fazer sentido`)
    .toMatch(/concentra/i);
  expect(duracaoNoAcervo(SEM_CONCENTRACAO),
    `${SEM_CONCENTRACAO} precisa NÃO exigir Concentração -- é o contraexemplo do par`)
    .not.toMatch(/concentra/i);

  const { page, erros } = await abrirSite(context, '#criar');
  expect(await irAtePassoMagias(page), 'o criador deveria chegar ao passo de Magias').toBe(true);

  // GUARDA CONTRA VACUIDADE: os dois cartões têm de estar na tela antes de
  // qualquer afirmação sobre o que eles mostram.
  const comConc = page.locator(`[data-magia-nome="${COM_CONCENTRACAO}"]`);
  const semConc = page.locator(`[data-magia-nome="${SEM_CONCENTRACAO}"]`);
  await expect(comConc, `${COM_CONCENTRACAO} deveria estar entre as opções de 1º círculo do Bardo`)
    .toHaveCount(1);
  await expect(semConc, `${SEM_CONCENTRACAO} deveria estar entre as opções de 1º círculo do Bardo`)
    .toHaveCount(1);

  await expect(comConc.locator('.opcao-resumo'),
    `${COM_CONCENTRACAO} tem duracao "${duracaoNoAcervo(COM_CONCENTRACAO)}" e marcador combinado ` +
    `"C, R" -- o selo Conc. só falta se a tela voltou a comparar \`especial === 'C'\` por ` +
    `igualdade exata`)
    .toContainText('Conc.');

  await expect(semConc.locator('.opcao-resumo'),
    `${SEM_CONCENTRACAO} tem duracao "${duracaoNoAcervo(SEM_CONCENTRACAO)}" e não exige ` +
    `Concentração -- se o selo aparece aqui, a derivação vazou e está carimbando toda magia`)
    .not.toContainText('Conc.');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
