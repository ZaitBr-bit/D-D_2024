// ============================================================
// Prova por navegador (não por teste de unidade) de que os dois cards
// opcionais do step "Revisão e Confirmação" -- Troca de Estilo de Luta do
// Guerreiro (Classes.md:3812) e Especialização adicional do Ladino nível 6
// (Classes.md:4188) -- são de fato UTILIZÁVEIS pelo jogador, não só
// renderizados.
//
// Achado da revisão final da Task 8: os dois cards viviam dentro de
// renderCardRevisao (levelup-cards.js), no step 'revisao_confirmacao', mas
// nem bindEventosStep nem salvarStateDoDOM (levelup-ui.js) tinham um `case
// 'revisao_confirmacao'` -- então o listener que habilita o <select> "para"
// nunca ligava (ele nascia `disabled` e continuava `disabled` para sempre) e
// os checkboxes de Especialização do Ladino nunca eram lidos do DOM antes de
// confirmar. O motor de unidade (subirDeNivel chamado direto, sem UI) não
// tem como ver esse tipo de bug -- só um teste que dirige o DOM de verdade
// prova que o jogador consegue de fato usar os dois cards. Corrigido em
// levelup-ui.js (bindEventosTrocasOpcionais + case 'revisao_confirmacao' em
// salvarStateDoDOM); este spec é a prova exigida.
//
// Achado N3 (re-revisão): a primeira versão deste arquivo reimplementava o
// clique em `#btn-levelup` com sua PRÓPRIA cópia (sem retentativa), embora
// `helpers-regras.mjs` já tivesse `irAteEscolhaDeTalento`, endurecida com
// segunda tentativa de clique exatamente por causa de um flake real
// anterior neste projeto (ver o comentário de `abrirModalLevelUp`,
// `helpers-regras.mjs`). A cópia fraca falhava sob carga (3 execuções da
// suíte completa, uma delas com TimeoutError esperando `#modal-overlay`) --
// isolada, 12/12 com `--repeat-each=6`, porque só sob concorrência real o
// clique pode chegar antes do listener estar pronto. Corrigido importando
// `abrirModalLevelUp` (o helper COMPARTILHADO, endurecido) em vez de uma
// terceira cópia.
//
// Task 10 (2026-08-12): a Troca de Estilo de Luta trocou os dois <select>
// "de"/"para" por montarTroca (ui-opcoes.js/opcoes-dominio.js) -- o teste de
// troca abaixo foi reescrito para dirigir os cards novos (#lvlup-estilo-
// luta-troca, botão [data-troca-um], grade .opcao-card[data-opcao]) em vez
// de .selectOption() nos selects antigos, que não existem mais.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, abrirModalLevelUp } from './helpers-regras.mjs';

// XP alto o bastante para qualquer nível (mesmo valor usado por
// SEMENTES_REGRAS em helpers-regras.mjs) -- não precisa da tabela exata,
// só precisa satisfazer podeSubirDeNivel para o nível seguinte.
const XP_MAXIMO = 355000;

/**
 * Abre o level-up (via `abrirModalLevelUp`, com retentativa de clique --
 * ver achado N3 acima) e avança até a Revisão. Para as duas sementes
 * usadas neste spec (Guerreiro nível 9->10, Ladino nível 5->6) nenhum dos
 * steps intermediários (subclasse/ASI/escolhas de classe obrigatórias/
 * magias/manobras) fica visível -- um único "Próximo" a partir de "Ganhos
 * do Nível" já chega na Revisão. Confirmado ao vivo, driblando o navegador
 * (não suposto): concedeAumentoAtributo do Guerreiro é
 * [4,6,8,12,14,16,19] -- nível 6 ESTÁ nessa lista (achado ao vivo: a
 * primeira versão deste spec usava nível 5->6 e caiu no step de ASI/
 * Talento sem querer); nível 10 não está. concedeAumentoAtributo do
 * Ladino é [4,8,10,12,16,19] -- nível 6 não está, então nível 5->6
 * funciona sem esse step extra.
 */
async function abrirLevelUpEIrParaRevisao(page) {
  const abriu = await abrirModalLevelUp(page);
  expect(abriu, 'modal de level-up não abriu (mesmo com retentativa de clique)').toBe(true);
  await page.waitForSelector('#btn-step-proximo', { state: 'visible', timeout: 20_000 });
  await page.locator('#btn-step-proximo').click();
  await page.waitForSelector('#btn-confirmar-levelup', { state: 'visible', timeout: 20_000 });
}

test('level-up: troca de Estilo de Luta do Guerreiro funciona de ponta a ponta no navegador', async ({ context }) => {
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

  // O card "Trocar Estilo de Luta (opcional)" precisa estar presente --
  // se não estiver, o resto do teste não prova nada. Desde a Task 10, é
  // montado por montarTroca (ui-opcoes.js): passo 1 mostra o estilo atual
  // como card de apresentação (item único, "sai" tem 1 opção só) com o
  // botão "Trocar este"; passo 2 só aparece depois do clique.
  const trocaContainer = page.locator('#lvlup-estilo-luta-troca');
  await expect(trocaContainer, 'card de troca de Estilo de Luta não apareceu na Revisão').toHaveCount(1);

  const cardAtual = trocaContainer.locator('.opcao-card', { hasText: 'Defensivo' });
  await expect(cardAtual, 'card de apresentação do estilo atual (Defensivo) não apareceu').toHaveCount(1);

  const passoEntra = trocaContainer.locator('#troca-passo-entra');
  await expect(passoEntra, 'passo 2 (novo estilo) não deveria estar visível antes de "Trocar este"').toBeHidden();

  // Clica em "Trocar este" -- isso deve REVELAR o passo 2 com a grade dos
  // outros estilos.
  await trocaContainer.locator('[data-troca-um]').click();
  await expect(passoEntra, 'passo 2 (novo estilo) deveria aparecer depois de "Trocar este" -- ' +
    'se continuar oculto, o listener de montarTroca não ligou').toBeVisible();

  // Escolhe "Duelismo" na grade do passo 2.
  await passoEntra.locator('.opcao-card[data-opcao="Duelismo"]').click();

  await page.locator('#btn-confirmar-levelup').click();
  await page.waitForTimeout(600);

  // Ao concluir, o app fecha o modal do assistente e abre "Subida de Nível
  // Concluída!" -- #btn-confirmar-levelup deixa de existir (mesmo sinal
  // usado por talentos-levelup.spec.mjs).
  expect(await page.locator('#btn-confirmar-levelup').count(),
    'a subida de nível deveria ter concluído (troca de Estilo de Luta é opcional, nunca bloqueia)').toBe(0);

  const salvo = await personagemSalvo(page);
  expect(salvo?.nivel, 'personagem deveria estar no nível 10 depois da subida').toBe(10);
  expect(salvo?.escolhas_classe?.estilo_luta,
    'a troca deveria ter substituído Defensivo por Duelismo em escolhas_classe.estilo_luta -- ' +
    'se continuar ["Defensivo"], a escolha do jogador se perdeu (não chegou a opcoes.* no confirmar)')
    .toEqual(['Duelismo']);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('level-up: Especialização do Ladino nível 6 respeita a escolha do jogador no navegador', async ({ context }) => {
  const semente = {
    classe: 'Ladino',
    nivel: 5,
    xp: XP_MAXIMO,
    atributos: { forca: 10, destreza: 16, constituicao: 14, inteligencia: 12, sabedoria: 10, carisma: 10 },
    // 4 perícias proficientes, nenhuma com Especialização ainda -- o app
    // precisa escolher 2 no total; o jogador vai marcar só 1 (Intuição) e
    // o app completa a outra automaticamente.
    pericias_proficientes: ['Furtividade', 'Percepção', 'Intuição', 'Enganação'],
    pericias_expertise: [],
  };
  const { page, erros } = await abrirFicha(context, semente);
  await abrirLevelUpEIrParaRevisao(page);

  const checkboxes = page.locator('[data-ladino-expertise]');
  await expect(checkboxes, 'checkboxes de Especialização do Ladino não apareceram na Revisão')
    .toHaveCount(4);

  const contador = page.locator('#levelup-ladino-expertise-count');
  await expect(contador, 'contador deveria começar em 0').toHaveText('0');

  // Acha e marca o checkbox de "Intuição" -- a única escolha ATIVA do
  // jogador neste teste.
  const checkboxIntuicao = page.locator('[data-ladino-expertise="Intuição"]');
  await checkboxIntuicao.check();

  // Se o listener (limitarCheckboxes) não estiver ligado -- o bug da
  // revisão final --, o contador nunca sai de "0". Esta é a asserção que
  // prova o bind, não só a leitura final do personagem.
  await expect(contador, 'contador não atualizou ao marcar o checkbox -- limitarCheckboxes não ligou ' +
    '(o bug da revisão final: bindEventosStep sem case "revisao_confirmacao")').toHaveText('1');

  await page.locator('#btn-confirmar-levelup').click();
  await page.waitForTimeout(600);

  expect(await page.locator('#btn-confirmar-levelup').count(),
    'a subida de nível deveria ter concluído (Especialização do Ladino nível 6 nunca bloqueia)').toBe(0);

  const salvo = await personagemSalvo(page);
  expect(salvo?.nivel, 'personagem deveria estar no nível 6 depois da subida').toBe(6);
  const expertiseFinal = salvo?.pericias_expertise || [];
  expect(expertiseFinal.length, `pericias_expertise deveria ganhar exatamente 2 entradas novas -- valor final: ${JSON.stringify(expertiseFinal)}`)
    .toBe(2);
  expect(expertiseFinal, 'a perícia que o jogador marcou (Intuição) precisa estar entre as escolhidas -- ' +
    'se não estiver, a escolha do jogador foi descartada em silêncio e substituída só pelo preenchimento ' +
    `automático (o bug relatado pela revisão final). Valor final: ${JSON.stringify(expertiseFinal)}`)
    .toContain('Intuição');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
