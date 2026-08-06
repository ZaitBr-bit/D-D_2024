// Criacao de personagem alem do passo 3, em lockstep.
//
// O driver (`satisfazerPasso`) e generico: ele nao sabe o que cada passo pede,
// ele le a tela e escolhe a primeira opcao valida de cada grupo, repetindo ate
// o app aceitar. Duas virtudes: funciona para qualquer classe sem codigo
// especifico, e se empacar, empaca IGUAL nos dois lados -- o que por si so e
// informacao de paridade.
import { test, expect } from '@playwright/test';
import {
  abrirParelha, assentar, instantaneo, primeiraDivergencia, confirmarModal,
  nosDois, relatorioErros, satisfazerPasso, passoAtual, lerToastErro,
} from './helpers.mjs';
import { classes } from './dados.mjs';

/** Se um modal de passo estiver aberto, confirma-o resolvendo as escolhas. */
async function fecharModalDePasso(page) {
  if (!await page.locator('#modal-overlay').isVisible()) return;
  for (const id of ['popup-confirmar-especie', 'popup-confirmar-antecedente',
                    'popup-confirmar-classe']) {
    if (await page.locator('#' + id).count()) {
      await confirmarModal(page, id).catch(() => {});
      return;
    }
  }
  // Modal sem botao conhecido: fecha para nao travar o fluxo.
  await page.evaluate(() => window.fecharModal?.());
  await page.waitForTimeout(200);
}

test('o driver avanca a criacao no site ORIGINAL', async ({ context }) => {
  // Provar o mecanismo no site que sabidamente funciona ANTES de usa-lo em
  // paridade. Um driver quebrado empacaria nos dois lados e o teste de
  // paridade passaria medindo nada.
  const lados = await abrirParelha(context, '#criar');
  const page = lados[0].page;

  await page.click('[data-classe="Guerreiro"]');
  await confirmarModal(page, 'popup-confirmar-classe');

  for (let i = 0; i < 10; i++) {
    if (!await satisfazerPasso(page)) break;
    await assentar(page).catch(() => {});
    await fecharModalDePasso(page);
  }

  const passo = await passoAtual(page);
  const toast = await lerToastErro(page);
  expect(passo,
    `o driver empacou no passo ${passo}. Ultimo toast: ${JSON.stringify(toast)}`)
    .toBeGreaterThanOrEqual(3);
});

/** Roda a criacao nos dois lados em lockstep. Devolve o passo final. */
async function criarEmLockstep(lados, classe) {
  await nosDois(lados, async (page) => {
    await page.click(`[data-classe="${classe}"]`);
    await confirmarModal(page, 'popup-confirmar-classe');
  });

  for (let i = 0; i < 12; i++) {
    const antes = await Promise.all(lados.map((l) => passoAtual(l.page)));
    await nosDois(lados, async (page) => {
      await satisfazerPasso(page);
      await assentar(page).catch(() => {});
      await fecharModalDePasso(page);
    });
    const depois = await Promise.all(lados.map((l) => passoAtual(l.page)));

    // A afirmacao central: os dois lados estao SEMPRE no mesmo passo.
    expect(depois[1],
      `${classe}: passo divergiu (original ${depois[0]}, refatorado ${depois[1]})`)
      .toBe(depois[0]);

    const [a, b] = await Promise.all(lados.map((l) => instantaneo(l.page)));
    expect(primeiraDivergencia(a, b),
      `${classe}: DOM divergiu no passo ${depois[0]}`).toBeNull();

    if (depois[0] === antes[0]) return depois[0];  // empacou igual nos dois
  }
  return passoAtual(lados[0].page);
}

for (const classe of classes()) {
  test(`criacao em lockstep: ${classe}`, async ({ context }) => {
    const lados = await abrirParelha(context, '#criar');
    const passo = await criarEmLockstep(lados, classe);
    expect(passo, `${classe}: nem o original passou do passo 3`)
      .toBeGreaterThanOrEqual(3);
    expect(relatorioErros(lados), `erros criando ${classe}`).toBe('');
  });
}
