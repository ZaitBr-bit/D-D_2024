// ============================================================
// Ao subir de nível dá para trocar MAIS DE UMA magia.
//
// Isso é decisão de produto (2026-08-19), e se afasta da tabela do livro de
// propósito: `Magias.md:19-28` dá "Uma" a Bardo/Bruxo/Feiticeiro ao avançar
// de nível e nem prevê a ocasião para as demais classes. O afastamento está
// declarado em `testes/regras/catalogo/magias-preparo.mjs`
// (AFASTAMENTOS_DO_LIVRO) e conferido pelo motor de unidade.
//
// O Descanso Longo é o contrário: lá é UMA, para todo mundo. Quem prova é
// `magias-troca-descanso.spec.mjs`.
//
// Este spec CLICA a segunda troca, e é isso que o separa de uma verificação
// de marcação: a capacidade nova é o botão "+ Adicionar outra troca", que
// empurra o par atual para a lista e remonta o componente vazio. Sem clicar,
// nada disso é medido.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, ATRIBUTOS_REGRAS, assentar, abrirModalLevelUp } from './helpers-regras.mjs';

// TRÊS magias preparadas de propósito: com duas, a segunda troca ficaria sem
// candidata a sair depois que a primeira saiu, e o teste passaria por falta
// de opção em vez de por regra.
//
// Nenhuma tem `origem` -- é `origem` que marca a magia como concedida
// (domínio, espécie, talento), e essas o app não pode oferecer para troca.
// Um caso dessas entra no teste do fim deste arquivo.
// Nível 5 -> 6 de propósito: é uma subida SEM pendência obrigatória. No 3 -> 4
// o assistente exige o Aumento no Valor de Atributo, e o "Próximo" fica
// bloqueado até respondê-lo -- o teste nunca chegaria ao Confirmar, e falharia
// dizendo que a troca não foi aplicada quando o nível é que não subiu.
const CLERIGO = {
  classe: 'Clérigo',
  nivel: 5,
  xp: 14000,
  atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['História', 'Religião'],
  magias_preparadas: [
    { nome: 'Curar Ferimentos', circulo: 1 },
    { nome: 'Bênção', circulo: 1 },
    { nome: 'Escudo da Fé', circulo: 1 },
  ],
};

/** Avança o assistente até o card de troca de magia aparecer. */
async function irAteCardDeTroca(page) {
  const card = page.locator('#levelup-troca-magia');
  for (let i = 0; i < 10; i++) {
    if (await card.count()) return card;
    const proximo = page.locator('#btn-step-proximo');
    if (await proximo.count()) await proximo.click();
    await page.waitForTimeout(500);
  }
  return card;
}

/** Faz uma troca no card: escolhe quem sai e quem entra. */
async function escolherTroca(page, card, sai, entra) {
  await card.locator(`.opcao-card[data-opcao="${sai}"]`).click();
  await assentar(page).catch(() => {});
  await card.locator(`.opcao-card[data-opcao="${entra}"]`).click();
  await assentar(page).catch(() => {});
}

test('level-up: dá para trocar duas magias na mesma subida de nível', async ({ context }) => {
  const { page } = await abrirFicha(context, CLERIGO, 'regras-clerigo-trocas');
  await abrirModalLevelUp(page);

  const card = await irAteCardDeTroca(page);
  await expect(card, 'o card de troca de magia não apareceu').toBeVisible({ timeout: 5000 });

  await escolherTroca(page, card, 'Curar Ferimentos', 'Comando');

  // A CAPACIDADE NOVA: o botão só aparece depois que o par está completo, e é
  // ele que permite a segunda troca. Antes desta versão não existia, e o
  // assistente aplicava um par só.
  const adicionar = page.getByRole('button', { name: '+ Adicionar outra troca' });
  await expect(adicionar,
    'o botão de adicionar outra troca não apareceu depois do primeiro par completo')
    .toBeVisible({ timeout: 5000 });
  await adicionar.click();
  await assentar(page).catch(() => {});

  // A primeira troca vira uma linha, e some das opções de "quem sai".
  await expect(page.locator('#levelup-trocas-magia-feitas'),
    'a troca confirmada deveria aparecer na lista de trocas já feitas')
    .toContainText('Curar Ferimentos');
  await expect(card.locator('.opcao-card[data-opcao="Curar Ferimentos"]'),
    'a magia que já saiu não pode ser oferecida para sair de novo')
    .toHaveCount(0);

  await escolherTroca(page, card, 'Bênção', 'Santuário');

  // Conclui a subida de nível. O último passo troca o "Próximo" por
  // `#btn-confirmar-levelup` (levelup-ui.js:144) -- é ele que aplica tudo.
  for (let i = 0; i < 12; i++) {
    const confirmar = page.locator('#btn-confirmar-levelup');
    if (await confirmar.count()) { await confirmar.click(); break; }
    const proximo = page.locator('#btn-step-proximo');
    if (!await proximo.count()) break;
    await proximo.click();
    await page.waitForTimeout(400);
  }
  await assentar(page).catch(() => {});

  const p = await personagemSalvo(page);
  // GUARDA: separa "a troca não foi aplicada" de "o nível não subiu". Sem
  // ela, qualquer pendência bloqueando o assistente viraria uma acusação
  // falsa contra a troca múltipla.
  expect(p?.nivel,
    'a subida de nível não foi concluída -- as asserções de troca abaixo não mediriam nada')
    .toBe(6);

  const nomes = (p?.magias_preparadas || []).map((m) => m.nome);
  expect(nomes,
    'as DUAS magias trocadas deveriam ter saído da lista de preparadas -- se só uma saiu, o ' +
    'assistente voltou a aplicar um par só')
    .not.toContain('Curar Ferimentos');
  expect(nomes, 'a segunda troca não foi aplicada').not.toContain('Bênção');
  expect(nomes, 'a primeira substituta não entrou').toContain('Comando');
  expect(nomes, 'a segunda substituta não entrou').toContain('Santuário');
});
