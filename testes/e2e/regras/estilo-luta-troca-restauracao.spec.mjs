// ============================================================
// Regressão permanente do achado C1 da revisão final da correção
// "Cards de escolha" (2026-08-12): das cinco chamadas de `montarTroca` no
// app, a Troca de Estilo de Luta do Guerreiro (levelup-ui.js,
// bindEventosTrocasOpcionais) era a única que não passava
// `sai.selecionado`/`entra.selecionado` -- os outros quatro pontos
// (troca de magia, troca de truque, troca de manobra, troca de maestria em
// sheet/maestrias.js) já tinham essa restauração desde a Task 12.
//
// O modo de falha era sutil e pior que o das outras trocas: como o lado
// "sai" aqui tem um item só, montarTroca usa o card de APRESENTAÇÃO (ver
// ui-opcoes.js:347-377), que não dispara `aoMudar` na montagem -- só o
// clique em "Trocar este" dispara. Então, sem a restauração:
//   - `state.estiloLutaTrocarDe`/`Para` sobreviviam à remontagem (nada os
//     zerava, ao contrário do caso com N>1 opções que a Task 12 corrigiu);
//   - mas a TELA voltava a mostrar "Trocar este", como se nada tivesse
//     sido escolhido, e o passo 2 (grade do novo estilo) ficava escondido.
// Resultado: a tela dizia uma coisa (nada escolhido) e o estado dizia outra
// (troca pendente) -- o resumo da revisão continuava listando a troca e
// `bindEventosStep`/confirmar aplicava normalmente. Um jogador que
// navegasse "Anterior" e "Próximo" via uma tela aparentemente vazia,
// confirmava sem querer a troca que já tinha feito antes (ou, pior, achava
// que precisava escolher de novo e podia escolher OUTRO estilo, perdendo a
// noção de qual ia valer).
//
// Falha concreta reproduzida pela revisão: Guerreiro com Defensivo escolhe
// Duelismo, clica Anterior e depois Próximo -- a tela volta a mostrar
// "Trocar este" (como se nada tivesse sido escolhido) mesmo com a troca
// para Duelismo ainda pendente no estado.
//
// Escapou da revisão de tarefa (Task 10) e só apareceu na revisão final --
// exatamente o tipo de regressão que só um spec permanente trava. O que
// este teste prova: escolher a troca, navegar Anterior e Próximo, e a TELA
// continuar mostrando o que o ESTADO tem (não regredir para "nada
// escolhido"), e o resultado final salvo bater com a escolha feita antes
// da navegação.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, abrirModalLevelUp } from './helpers-regras.mjs';

const XP_MAXIMO = 355000;

/**
 * Abre o level-up e avança até a Revisão. Mesma semente/trajeto de
 * `classes-trocas-ui.spec.mjs` (Guerreiro nível 9->10: nenhum step
 * intermediário fica visível, um único "Próximo" a partir de "Ganhos do
 * Nível" já chega na Revisão) -- ver o comentário lá para a justificativa
 * completa da escolha de nível.
 */
async function abrirLevelUpEIrParaRevisao(page) {
  const abriu = await abrirModalLevelUp(page);
  expect(abriu, 'modal de level-up não abriu (mesmo com retentativa de clique)').toBe(true);
  await page.waitForSelector('#btn-step-proximo', { state: 'visible', timeout: 20_000 });
  await page.locator('#btn-step-proximo').click();
  await page.waitForSelector('#btn-confirmar-levelup', { state: 'visible', timeout: 20_000 });
}

test('level-up: troca de Estilo de Luta sobrevive a Anterior/Próximo sem esconder a escolha', async ({ context }) => {
  const semente = {
    classe: 'Guerreiro',
    nivel: 9,
    xp: XP_MAXIMO,
    atributos: { forca: 16, destreza: 14, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 10 },
    pericias_proficientes: ['Atletismo', 'Percepção'],
    escolhas_classe: { estilo_luta: ['Defensivo'] },
  };
  const { page, erros } = await abrirFicha(context, semente);
  await abrirLevelUpEIrParaRevisao(page);

  const trocaContainer = page.locator('#lvlup-estilo-luta-troca');
  await expect(trocaContainer, 'card de troca de Estilo de Luta não apareceu na Revisão').toHaveCount(1);

  // Escolhe a troca: "Trocar este" abre o passo 2, marca Duelismo.
  await trocaContainer.locator('[data-troca-um]').click();
  const passoEntra = trocaContainer.locator('#troca-passo-entra');
  await expect(passoEntra, 'passo 2 (novo estilo) deveria aparecer depois de "Trocar este"').toBeVisible();
  await passoEntra.locator('.opcao-card[data-opcao="Duelismo"]').click();
  await expect(passoEntra.locator('.opcao-card[data-opcao="Duelismo"]'),
    'Duelismo deveria estar marcado antes de navegar').toHaveClass(/selecionada/);

  // Navega Anterior e depois Próximo, de volta ao mesmo passo -- o fluxo
  // normal que remonta `montarTroca` do zero (não um caso extremo).
  await page.locator('#btn-step-anterior').click();
  await page.waitForSelector('#btn-step-proximo', { state: 'visible', timeout: 20_000 });
  await page.locator('#btn-step-proximo').click();
  await page.waitForSelector('#btn-confirmar-levelup', { state: 'visible', timeout: 20_000 });

  const trocaContainerDepois = page.locator('#lvlup-estilo-luta-troca');
  await expect(trocaContainerDepois, 'card de troca de Estilo de Luta deveria continuar presente após navegar').toHaveCount(1);

  // A TELA precisa continuar mostrando o que o ESTADO tem: passo 1
  // "resolvido" (não o botão "Trocar este" de novo) -- "sai" é sempre o
  // estilo ATUAL (Defensivo, o único item do lado "sai"; é "Duelismo" que
  // fica marcado no passo 2, "entra", verificado logo abaixo) -- e o passo
  // 2 visível com Duelismo ainda marcado -- é a prova do achado C1 (sem a
  // correção, o passo 1 voltava a mostrar "Trocar este" como se nada
  // tivesse sido escolhido, escondendo tanto o "sai" quanto o "entra").
  await expect(trocaContainerDepois.locator('[data-troca-um]'),
    'passo 1 voltou a mostrar "Trocar este" depois de Anterior/Próximo -- ' +
    'a tela esqueceu a escolha que o ESTADO ainda tem (achado C1 da revisão final)').toHaveCount(0);
  await expect(trocaContainerDepois.locator('#troca-passo-sai'),
    'passo 1 deveria estar "resolvido" (não mais mostrando o botão "Trocar este"), ' +
    'com Defensivo como o estilo que está saindo')
    .toContainText('Defensivo');
  const passoEntraDepois = trocaContainerDepois.locator('#troca-passo-entra');
  await expect(passoEntraDepois, 'passo 2 deveria continuar visível depois de Anterior/Próximo').toBeVisible();
  await expect(passoEntraDepois.locator('.opcao-card[data-opcao="Duelismo"]'),
    'Duelismo deveria continuar marcado no passo 2 depois de Anterior/Próximo').toHaveClass(/selecionada/);

  await page.locator('#btn-confirmar-levelup').click();
  await page.waitForTimeout(600);

  expect(await page.locator('#btn-confirmar-levelup').count(),
    'a subida de nível deveria ter concluído (troca de Estilo de Luta é opcional, nunca bloqueia)').toBe(0);

  const salvo = await personagemSalvo(page);
  expect(salvo?.nivel, 'personagem deveria estar no nível 10 depois da subida').toBe(10);
  expect(salvo?.escolhas_classe?.estilo_luta,
    'a troca escolhida antes de navegar Anterior/Próximo deveria ter sido preservada: ' +
    'Defensivo -> Duelismo. Se continuar ["Defensivo"], a escolha se perdeu na remontagem da tela')
    .toEqual(['Duelismo']);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
