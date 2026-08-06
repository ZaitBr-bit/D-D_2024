// Paridade entre o site ORIGINAL (D-D_2024) e o REFATORADO (DeD_2024).
//
// A pergunta que estes testes respondem nao e "a tela esta bonita", e sim
// "a tela refatorada e a mesma da original". Por isso quase toda asserta e
// uma comparacao entre os dois lados, e nao um valor escrito a mao.
import { test, expect } from '@playwright/test';
import {
  abrirParelha, irPara, assentar, instantaneo, classesUsadas, geometria,
  nosDois, relatorioErros, confirmarModal,
} from './helpers.mjs';

test.describe('paridade original x refatorado', () => {
  test('home carrega nos dois sem erro e com o mesmo DOM', async ({ context }) => {
    const lados = await abrirParelha(context, '');

    expect(relatorioErros(lados), 'erros de console/carregamento').toBe('');

    const [a, b] = await Promise.all(lados.map((l) => instantaneo(l.page)));
    expect(b, 'DOM da home difere do original').toBe(a);
  });

  test('criador passo 1 carrega nos dois sem erro e com o mesmo DOM', async ({ context }) => {
    const lados = await abrirParelha(context, '#criar');

    expect(relatorioErros(lados), 'erros de console/carregamento').toBe('');

    const [a, b] = await Promise.all(lados.map((l) => instantaneo(l.page)));
    expect(b, 'DOM do passo 1 difere do original').toBe(a);
  });

  test('criador usa as mesmas classes CSS que o original', async ({ context }) => {
    const lados = await abrirParelha(context, '#criar');
    const [a, b] = await Promise.all(lados.map((l) => classesUsadas(l.page)));
    expect(b, 'conjunto de classes CSS difere').toEqual(a);

    // As quatro que a tentativa anterior trocou, explicitamente.
    for (const classe of ['wizard-steps-sticky', 'wizard-content-area',
                          'wizard-nav-fixed', 'wizard-nav-inner']) {
      expect(b, `classe ${classe} ausente no refatorado`).toContain(classe);
    }
  });

  test('barra de navegacao do criador continua fixa no rodape', async ({ context }) => {
    const lados = await abrirParelha(context, '#criar');
    const sels = ['.wizard-steps-sticky', '.wizard-content-area',
                  '.wizard-nav-fixed', '.wizard-nav-inner', '#btn-next', '#btn-prev'];
    const [a, b] = await Promise.all(lados.map((l) => geometria(l.page, sels)));

    expect(b, 'geometria/estilos computados diferem do original').toEqual(a);
    // E o valor absoluto que importa: se isto virar 'static', os botoes caem
    // no meio do conteudo -- exatamente o bug do print do usuario.
    expect(b['.wizard-nav-fixed']?.position).toBe('fixed');
  });

  test('rotulos dos botoes do criador nao mudaram', async ({ context }) => {
    const lados = await abrirParelha(context, '#criar');
    for (const l of lados) {
      await expect(l.page.locator('#btn-prev'), l.nome).toHaveText(/Anterior/);
      await expect(l.page.locator('#btn-next'), l.nome).toHaveText(/Próximo/);
    }
  });

  test('fluxo do criador em lockstep: classe, especie, antecedente', async ({ context }) => {
    const lados = await abrirParelha(context, '#criar');

    // Passo 1: Classe. O card abre um modal; Guerreiro exige Estilo de Luta,
    // entao confirmarModal faz as escolhas obrigatorias antes de confirmar.
    await nosDois(lados, async (page) => {
      await page.click('[data-classe="Guerreiro"]');
      await confirmarModal(page, 'popup-confirmar-classe');
    });
    let [a, b] = await Promise.all(lados.map((l) => instantaneo(l.page)));
    expect(b, 'DOM apos escolher Guerreiro difere').toBe(a);

    // Passo 2: Especie.
    await nosDois(lados, async (page) => {
      await page.click('#btn-next');
      await page.waitForFunction(
        () => document.querySelector('.wizard-step.active')?.dataset.step === '1');
      await assentar(page);
    });
    [a, b] = await Promise.all(lados.map((l) => instantaneo(l.page)));
    expect(b, 'DOM do passo 2 (Especie) difere').toBe(a);

    await nosDois(lados, async (page) => {
      await page.click('[data-especie="Humano"]');
      await confirmarModal(page, 'popup-confirmar-especie');
    });
    [a, b] = await Promise.all(lados.map((l) => instantaneo(l.page)));
    expect(b, 'DOM apos escolher Humano difere').toBe(a);

    // Passo 3: Antecedente.
    await nosDois(lados, async (page) => {
      await page.click('#btn-next');
      await page.waitForFunction(
        () => document.querySelector('.wizard-step.active')?.dataset.step === '2');
      await assentar(page);
    });
    [a, b] = await Promise.all(lados.map((l) => instantaneo(l.page)));
    expect(b, 'DOM do passo 3 (Antecedente) difere').toBe(a);

    expect(relatorioErros(lados), 'erros durante o fluxo').toBe('');
  });
});
