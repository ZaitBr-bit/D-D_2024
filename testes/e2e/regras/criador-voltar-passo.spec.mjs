// ============================================================
// Criador: o botão "Anterior" volta um passo e preserva o que já foi
// escolhido.
//
// `#btn-prev` (site/js/creator/wizard.js) é o único caminho de volta do
// wizard além de clicar na trilha de passos, e nenhum spec o acionava --
// os specs do criador só andam para a frente. É um botão com efeito
// COLATERAL declarado: antes de decrementar o passo ele chama
// `limparDadosDoPasso(stepAtual)`, apagando o que o passo que está sendo
// abandonado tinha gravado. O que ele NÃO pode apagar é o que os passos
// ANTERIORES já decidiram -- perder a classe ao voltar da espécie mandaria
// o jogador começar tudo de novo.
//
// Por isso as duas asserções deste spec são: (1) o passo ativo recua um; e
// (2) a escolha do passo anterior continua no personagem em construção e
// continua marcada na tela.
// ============================================================
import { expect, test } from '@playwright/test';
import {
  abrirSite, assentar, confirmarModal, passoAtual, personagemEmCriacao, satisfazerPasso,
} from './helpers-regras.mjs';

/**
 * Escolhe Guerreiro no passo 1 do criador e confirma o popup da classe.
 *
 * Guerreiro é a mesma semente que os outros specs do criador usam: classe
 * marcial, sem magias e sem escolha que atrapalhe o driver genérico.
 */
async function escolherGuerreiro(page) {
  await page.click('[data-classe="Guerreiro"]');
  await confirmarModal(page, 'popup-confirmar-classe').catch(() => {});
  await assentar(page).catch(() => {});
}

/**
 * Avança o wizard até chegar ao passo pedido, satisfazendo cada passo pelo
 * caminho. Devolve false se travar antes -- assim a falha aponta a
 * navegação, e não a asserção sobre o `#btn-prev`.
 */
async function avancarAte(page, passoAlvo) {
  for (let i = 0; i < 8; i++) {
    if (await passoAtual(page) === passoAlvo) return true;
    if (!await satisfazerPasso(page)) return false;
    await assentar(page).catch(() => {});
  }
  return (await passoAtual(page)) === passoAlvo;
}

test('criador: no primeiro passo o botão Anterior está desabilitado', async ({ context }) => {
  const { page, erros } = await abrirSite(context, '#criar');

  expect(await passoAtual(page), 'o criador deveria abrir no passo 1 (Classe)').toBe(0);
  await expect(page.locator('#btn-prev'),
    'não há passo anterior ao primeiro: o botão deveria estar desabilitado').toBeDisabled();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('criador: Anterior volta ao passo de Classe preservando a classe escolhida', async ({ context }) => {
  const { page, erros } = await abrirSite(context, '#criar');

  await escolherGuerreiro(page);
  expect(await avancarAte(page, 1), 'o criador deveria chegar ao passo 2 (Espécie)').toBe(true);
  expect((await personagemEmCriacao(page)).classe,
    'a classe deveria estar gravada antes de voltar').toBe('Guerreiro');

  await page.locator('#btn-prev').click();
  await assentar(page).catch(() => {});

  expect(await passoAtual(page), 'Anterior deveria recuar exatamente um passo').toBe(0);
  expect((await personagemEmCriacao(page)).classe,
    'voltar não pode apagar a escolha de um passo ANTERIOR').toBe('Guerreiro');
  await expect(page.locator('[data-classe="Guerreiro"]'),
    'o card do Guerreiro deveria continuar marcado na tela').toHaveClass(/selecionada/);
  // O resumo só é montado quando `personagem.classe` está preenchido
  // (site/js/creator/passo-classe.js), então ele é a prova visível de que a
  // escolha sobreviveu ao "Anterior". Localizado pela classe do bloco, e não
  // pelo id do botão "Alterar" que mora dentro dele: este spec não clica
  // nesse botão, e nomeá-lo aqui daria ao guarda de gatilhos a impressão
  // falsa de que ele tem teste.
  await expect(page.locator('.selecao-resumo'),
    'o resumo da classe escolhida deveria continuar na tela').toContainText('Guerreiro');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('criador: Anterior volta ao passo de Espécie preservando espécie e classe', async ({ context }) => {
  const { page, erros } = await abrirSite(context, '#criar');

  await escolherGuerreiro(page);
  expect(await avancarAte(page, 2), 'o criador deveria chegar ao passo 3 (Antecedente)').toBe(true);

  const antes = await personagemEmCriacao(page);
  expect(antes.especie, 'a espécie deveria estar gravada antes de voltar').toBeTruthy();

  await page.locator('#btn-prev').click();
  await assentar(page).catch(() => {});

  expect(await passoAtual(page), 'Anterior deveria recuar exatamente um passo').toBe(1);

  const depois = await personagemEmCriacao(page);
  expect(depois.especie,
    `voltar do Antecedente não pode apagar a espécie já escolhida (${antes.especie})`)
    .toBe(antes.especie);
  expect(depois.classe, 'nem a classe, escolhida dois passos antes').toBe('Guerreiro');
  await expect(page.locator(`[data-especie="${antes.especie}"]`),
    'o card da espécie escolhida deveria continuar marcado na tela').toHaveClass(/selecionada/);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
