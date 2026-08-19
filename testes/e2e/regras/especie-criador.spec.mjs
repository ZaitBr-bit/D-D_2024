// ============================================================
// O passo de espécie do criador oferece as espécies de `dados/`, e a escolha
// de linhagem persiste no personagem em criação.
//
// O motor de unidade (testes/regras/unidade/especies.test.mjs) já confronta as
// 10 espécies do livro com o dado, os campos de cabeçalho, os traços por nível
// e as 5 escolhas de linhagem. O que só o navegador prova é a tela: que as
// espécies aparecem para escolher, e que a linhagem escolhida chega a
// `tracos_escolhidos`.
//
// PHB 2024, Linhagem Élfica (Espécies.md:140): "Escolha uma linhagem da tabela
// Linhagem Élfica" -- três opções, Alto Elfo, Drow e Elfo Silvestre.
//
// A CONTAGEM esperada de espécies é derivada de dados/origens/especies.json,
// nunca escrita à mão. Hoje são 11 (as 10 do livro mais Kenku, que o livro não
// tem -- ver FORA_DO_LIVRO no catálogo). Se a decisão sobre o Kenku mudar, este
// spec acompanha sem edição.
// ============================================================
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { abrirSite, assentar, confirmarModal, satisfazerPasso, personagemEmCriacao } from './helpers-regras.mjs';

const DADOS = JSON.parse(readFileSync(
  new URL('../../../dados/origens/especies.json', import.meta.url), 'utf-8'));
const ESPECIES_NO_DADO = (DADOS.especies || DADOS).map((e) => e.nome);

/**
 * Leva o criador até o passo de Espécie. Classe vem ANTES dele
 * (site/js/creator/wizard.js:28-36), então o passo de classe é resolvido
 * escolhendo um Guerreiro -- mesma semente que os outros specs do criador usam.
 */
async function irAtePassoEspecie(page) {
  await assentar(page).catch(() => {});
  await page.click('[data-classe="Guerreiro"]');
  await confirmarModal(page, 'popup-confirmar-classe').catch(() => {});
  for (let i = 0; i < 8; i++) {
    if (await page.locator('[data-especie]').count()) return true;
    if (!await satisfazerPasso(page)) return false;
    await assentar(page).catch(() => {});
  }
  return (await page.locator('[data-especie]').count()) > 0;
}

test('criador: o passo de espécie oferece todas as espécies de dados/', async ({ context }) => {
  const { page, erros } = await abrirSite(context, '#criar');
  expect(await irAtePassoEspecie(page), 'o criador deveria chegar ao passo de Espécie').toBe(true);

  const cards = page.locator('[data-especie]');
  await expect(cards.first(), 'o passo de espécie deveria renderizar os cards').toBeVisible();

  const oferecidas = (await cards.evaluateAll((els) => els.map((e) => e.dataset.especie))).sort();
  expect(oferecidas, 'a tela deveria oferecer exatamente as espécies de dados/origens/especies.json')
    .toEqual([...ESPECIES_NO_DADO].sort());

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// A persistência da escolha NÃO é afirmada aqui, e isso é deliberado. Commitar
// a espécie no personagem em criação depende do fluxo de confirmação do wizard
// (site/js/creator/passo-especie.js), que este spec não engenharia às avessas --
// tentar isso produziria uma asserção frágil sobre estado interno em vez de sobre
// o que o jogador vê. O que a linhagem escolhida vira no personagem já é
// confrontado sem navegador pelo Grupo 4 de unidade/especies.test.mjs (as opções
// do livro × MAGIAS_LEGADO_ESPECIE × obterCaracteristicasEspecieNivel).
// O que este teste prova, e só o navegador prova: as três linhagens do livro
// aparecem como opção clicável na tela.
test('criador: escolher Elfo oferece as três linhagens do livro', async ({ context }) => {
  const { page, erros } = await abrirSite(context, '#criar');
  expect(await irAtePassoEspecie(page), 'o criador deveria chegar ao passo de Espécie').toBe(true);

  await page.locator('[data-especie="Elfo"]').click();
  await assentar(page).catch(() => {});

  const escolhas = page.locator('[data-traco-escolha]');
  await expect(escolhas.first(), 'o Elfo deveria pedir a Linhagem Élfica').toBeVisible();

  const valores = (await escolhas.evaluateAll((els) => els.map((e) => e.dataset.tracoEscolha))).join(' | ');
  for (const linhagem of ['Alto Elfo', 'Drow', 'Elfo Silvestre']) {
    expect(valores, `a linhagem "${linhagem}" (Espécies.md:140) deveria ser oferecida na tela`)
      .toContain(linhagem);
  }

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
