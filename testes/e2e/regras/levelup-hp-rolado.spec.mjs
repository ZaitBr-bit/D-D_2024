// ============================================================
// Ao rolar o PV na subida de nível, o campo aceita QUALQUER valor válido
// do dado -- issue #34: o relator só conseguia digitar "1" ou "10" porque
// o handler do evento `input` (bindEventosHP, levelup-ui.js) reescrevia o
// campo a cada tecla, inclusive no instante em que ele ficava vazio (ao
// apagar para digitar de novo).
//
// Este spec reproduz a sequência exata do bug: apagar o "1" inicial e
// digitar "7" tecla a tecla, a mesma forma que um jogador troca o valor na
// tela. Só marcar o modo "Rolagem" ou usar `fill()` direto não bastaria --
// é a REESCRITA DO CAMPO NO MEIO DA DIGITAÇÃO que causava o defeito, e só
// aparece simulando o apagar + digitar de verdade.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, ATRIBUTOS_REGRAS, assentar, abrirModalLevelUp } from './helpers-regras.mjs';

// Guerreiro nível 1 -> 2 de propósito: é a subida MAIS simples que existe --
// sem ASI (só a partir do nível 4, ver concedeAumentoAtributo em levelup.js),
// sem escolha de subclasse (só no nível 3, exigeSubclasse) e sem Estilo de
// Luta pendente (obrigatório só para Guardião/Paladino no nível 2; a troca
// do Guerreiro é OPCIONAL e não bloqueia o assistente, ver
// exigeTrocaEstiloLutaGuerreiro em levelup.js). O assistente vai direto de
// "Ganhos do Nível" para "Revisão e Confirmação" -- sem essa escolha de
// nível, o teste precisaria satisfazer pendências sem relação com o defeito.
const GUERREIRO = {
  classe: 'Guerreiro',
  nivel: 1,
  xp: 0,
  atributos: ATRIBUTOS_REGRAS, // constituição 14 -> mod +2
  pericias_proficientes: ['Atletismo', 'História'],
};

test('level-up: o campo de PV rolado aceita apagar e digitar outro valor', async ({ context }) => {
  const { page } = await abrirFicha(context, GUERREIRO, 'regras-guerreiro-hp-rolado');

  // Baseline ANTES da subida: a ficha recalcula pv_max sozinha ao renderizar
  // (fallback de sheet/ficha.js para pv_max <= 0), então o PV inicial não é
  // necessariamente 0 -- a asserção final mede o GANHO desta subida, não um
  // valor absoluto acoplado a essa fórmula.
  const antes = await personagemSalvo(page);

  await abrirModalLevelUp(page);

  await page.locator('input[name="levelup-hp-modo"][value="rolado"]').check();

  const hpInput = page.locator('#levelup-hp-rolado');
  await expect(hpInput, 'o campo de PV rolado deveria estar habilitado no modo Rolagem').toBeEnabled();

  // A sequência do relato: apagar o "1" inicial e digitar "7" -- tecla a
  // tecla, como um jogador faz de verdade. `fill()` sozinho não reproduz o
  // defeito: ele não passa pelo estado transitório "campo vazio" que
  // disparava a reescrita no meio da digitação.
  await hpInput.selectText();
  await hpInput.press('Backspace');
  await hpInput.press('7');

  // A PRÉVIA (que só existe para refletir o que o jogador está digitando)
  // tem de acompanhar em tempo real, sem esperar o campo perder o foco.
  await expect(page.locator('#levelup-hp-previa-rolado'),
    'a prévia deveria mostrar 7 (rolado) + 2 (mod. de CON) = 9 PV, refletindo o que foi digitado')
    .toHaveText('= +9 PV');

  await hpInput.blur();
  await expect(hpInput, 'o campo deveria manter o valor digitado (7) depois de perder o foco')
    .toHaveValue('7');

  // Conclui a subida de nível -- Guerreiro 1->2 não tem nenhuma outra
  // pendência, então um "Próximo" leva direto à Revisão/Confirmação.
  for (let i = 0; i < 6; i++) {
    const confirmar = page.locator('#btn-confirmar-levelup');
    if (await confirmar.count()) { await confirmar.click(); break; }
    const proximo = page.locator('#btn-step-proximo');
    if (!await proximo.count()) break;
    await proximo.click();
    await page.waitForTimeout(400);
  }
  await assentar(page).catch(() => {});

  const p = await personagemSalvo(page);
  // GUARDA: separa "a subida não aconteceu" de "o PV rolado não foi
  // gravado" -- sem ela, uma pendência bloqueando o assistente por outro
  // motivo qualquer viraria uma acusação falsa contra o campo de PV.
  expect(p?.nivel, 'a subida de nível não foi concluída -- as asserções de PV abaixo não mediriam nada')
    .toBe(2);

  const GANHO_ESPERADO = 9; // 7 (rolado, digitado) + 2 (mod. de CON)
  expect(p.pv_max - antes.pv_max,
    'o ganho de PV máximo deveria refletir o valor DIGITADO (7 + mod. CON = 9), não o clamp para 1 ou 10 do defeito')
    .toBe(GANHO_ESPERADO);
  expect(p.pv_atual - antes.pv_atual, 'o PV atual também deveria ter sido curado pelo mesmo ganho')
    .toBe(GANHO_ESPERADO);
});
