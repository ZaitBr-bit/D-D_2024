// Paridade entre o site ORIGINAL (D-D_2024) e o REFATORADO (DeD_2024).
//
// A pergunta que estes testes respondem nao e "a tela esta bonita", e sim
// "a tela refatorada e a mesma da original". Por isso quase toda asserta e
// uma comparacao entre os dois lados, e nao um valor escrito a mao.
import { test, expect } from '@playwright/test';
import {
  abrirParelha, irPara, instantaneo, geometria, relatorioErros,
} from './helpers.mjs';

// ------------------------------------------------------------------------
// Os testes de comparação de DOM e de classes CSS do criador foram
// aposentados em 2026-08-12, junto da unificação dos vocabulários de card
// (docs/superpowers/specs/2026-08-12-cards-de-escolha-design.md, decisão D9).
//
// Eles comparavam o DOM deste repositório com o do original a cada passo do
// criador. Renomear `.selection-card` para `.opcao-card` quebra essa
// comparação de forma definitiva -- o repositório original não vai mudar.
//
// O README da suíte já registra que paridade não é mais restrição, e quem
// garante comportamento hoje é a suíte de regras: 126 testes e2e e 1225 de
// unidade. O que sobrou aqui são checagens que não dependem de DOM idêntico.
// ------------------------------------------------------------------------

test.describe('paridade original x refatorado', () => {
  test('home carrega nos dois sem erro e com o mesmo DOM', async ({ context }) => {
    const lados = await abrirParelha(context, '');

    expect(relatorioErros(lados), 'erros de console/carregamento').toBe('');

    const [a, b] = await Promise.all(lados.map((l) => instantaneo(l.page)));
    expect(b, 'DOM da home difere do original').toBe(a);
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
});
