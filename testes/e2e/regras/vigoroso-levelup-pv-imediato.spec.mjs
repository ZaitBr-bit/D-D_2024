// ============================================================
// Issue #89 -- o bônus de PV do talento Vigoroso só convergia no próximo
// RENDER da ficha (sincronizarBonusPvVigoroso, chamada em sheet/ficha.js),
// nunca dentro do próprio motor de subida de nível. O relato mostrava a
// modal "Subida de Nível Concluída!" com um total (152) e o cabeçalho da
// ficha, ainda não re-renderizado, com outro (154) -- uma diferença de 2,
// exatamente o incremento por nível que o Vigoroso concede DEPOIS da
// aquisição.
//
// A aquisição em si (nível em que o talento é escolhido) já ficava certa
// mesmo com o bug -- o código antigo de levelup.js aplicava o "dobro do
// nível ao obter" uma vez, na hora. O sintoma só aparece na SUBIDA
// SEGUINTE: sem nada rodando a sincronização dentro do motor, o "+2 por
// nível depois" nunca chegava ao texto "Total: X PV" que a PRÓPRIA modal
// de conclusão mostra (levelup-ui.js:2373, lê `char.pv_max` direto) --
// esse texto é montado ANTES de qualquer render da ficha.
//
// Este spec pega Vigoroso no nível 4, sobe de novo para o nível 5 (sem
// escolha nenhuma nesse nível para o Guerreiro) e lê o texto "Total: X PV"
// DENTRO da segunda modal, antes de fechá-la -- exatamente o momento que
// o relato mostrava errado.
// ============================================================
import { test, expect } from '@playwright/test';
import {
  abrirFicha, abrirModalLevelUp, irAteEscolhaDeTalento, personagemSalvo, SEMENTES_REGRAS,
} from './helpers-regras.mjs';

test('level-up: o "Total: X PV" da modal de conclusão já inclui o incremento do Vigoroso na subida SEGUINTE à aquisição', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...SEMENTES_REGRAS.normal, pv_max: 34, pv_atual: 34, talentos: [],
  }, 'regras-vigoroso-levelup-imediato');

  // Nível 3 -> 4: adquire Vigoroso (2×4 = 8 de bônus -- já correto mesmo
  // no código antigo, não é o que este spec mede).
  expect(await irAteEscolhaDeTalento(page), 'não chegou à tela de ASI/talento').toBe(true);
  await page.check('input[name="levelup-asi-modo"][value="talento"]', { timeout: 1500 }).catch(() => {});
  const opcao = page.locator('#levelup-talento-lista .opcao-card[data-opcao="Vigoroso"]');
  await expect(opcao, 'Vigoroso (Talento de Origem, sem pré-requisito) precisa aparecer na lista').toBeVisible();
  await opcao.click();
  await page.waitForTimeout(400);
  await page.locator('#btn-step-proximo').click();
  await page.waitForTimeout(400);
  await page.locator('#btn-confirmar-levelup').click();
  await page.waitForTimeout(600);
  await page.click('.modal-acoes button:has-text("OK")');
  await page.waitForTimeout(400);

  const apos4 = await personagemSalvo(page);
  expect(apos4?.nivel).toBe(4);
  expect(apos4?.bonus_pv_vigoroso_aplicado, 'aquisição: 2×4 = 8').toBe(8);
  const pvMaxApos4 = apos4.pv_max;

  // Nível 4 -> 5: SEM escolha nenhuma (5 não é nível de ASI para o
  // Guerreiro) -- só "Próximo" até a Revisão e "Confirmar". O incremento
  // do Vigoroso (+2, de 8 para 10) tem de aparecer no "Total: X PV" desta
  // MODAL, antes de fechá-la.
  await abrirModalLevelUp(page);
  for (let i = 0; i < 6 && !(await page.locator('#btn-confirmar-levelup').count()); i++) {
    await page.locator('#btn-step-proximo').click();
    await page.waitForTimeout(300);
  }
  await page.locator('#btn-confirmar-levelup').click();
  await page.waitForTimeout(600);

  const totalNaModal = await page.locator('text=/Total: \\d+ PV/').first().innerText();
  const totalMostrado = Number(totalNaModal.match(/(\d+)/)[1]);
  const hpGanhoTexto = await page.locator('text=/\\+\\d+ HP/').first().innerText();
  const hpGanhoNormal = Number(hpGanhoTexto.match(/(\d+)/)[1]);

  // Total esperado = PV depois do nível 4 + ganho NORMAL do nível 5 (dado
  // de vida + CON, o que quer que seja) + o incremento do Vigoroso neste
  // nível (+2, de 8 para 10) -- este último é exatamente o que o bug
  // antigo deixava de fora do texto da MODAL (só chegava no próximo
  // render da ficha).
  expect(totalMostrado, `"${totalNaModal}" (ganho normal: ${hpGanhoTexto}) -- o incremento de +2 do ` +
    'Vigoroso no nível 5 já tem de estar somado ANTES de fechar a modal, sem depender de um render ' +
    'posterior da ficha')
    .toBe(pvMaxApos4 + hpGanhoNormal + 2);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
