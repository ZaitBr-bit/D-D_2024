// ============================================================
// Issue #117 -- no Android o rodapé do modal "Descanso Longo Concluído"
// aparecia cortado: o botão "Manter Tudo" perdia a primeira letra.
//
// Causa: `.modal-acoes` é flex com `justify-content: flex-end` e os botões
// têm `flex-shrink: 0; white-space: nowrap`. Quando a soma dos botões passa
// da largura do modal (Mago com três opções: Manter Tudo, Trocar Magias,
// Trocar Truque), o excedente vaza pela ESQUERDA, área que o navegador não
// permite rolar -- o botão fica inalcançável.
//
// O spec mede em larguras de celular (360 e 384 px CSS; o print do autor tem
// 576 px físicos) que todos os botões do rodapé ficam dentro da janela e que
// o clique de verdade em "Manter Tudo" fecha o modal.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha } from './helpers-regras.mjs';

// Mago com grimório e magias preparadas: o Descanso Longo oferece troca de
// magia e de truque, ou seja, três botões no rodapé.
const MAGO = {
  nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS, classe: 'Mago',
  pericias_proficientes: ['Arcanismo', 'História'],
  grimorio: [{ nome: 'Mísseis Mágicos', circulo: 1 }, { nome: 'Detectar Magia', circulo: 1 }],
  magias_preparadas: [{ nome: 'Mísseis Mágicos', circulo: 1 }, { nome: 'Detectar Magia', circulo: 1 }],
  magias_conhecidas: [{ nome: 'Luz', circulo: 0 }, { nome: 'Mãos Mágicas', circulo: 0 }, { nome: 'Prestidigitação', circulo: 0 }],
};

const VIEWPORTS = [
  { largura: 360, altura: 640 },
  { largura: 360, altura: 740 },
  { largura: 384, altura: 832 },
];

for (const vp of VIEWPORTS) {
  test(`descanso longo ${vp.largura}x${vp.altura}: botões do rodapé ficam dentro da janela`, async ({ context }) => {
    const { page } = await abrirFicha(context, MAGO, `regras-modal-celular-${vp.largura}x${vp.altura}`);
    await page.setViewportSize({ width: vp.largura, height: vp.altura });

    await clicarBotaoFicha(page, 'btn-descanso-longo');
    await assentar(page).catch(() => {});

    const botoes = page.locator('#modal-acoes button');
    await expect(page.locator('#btn-pular-troca-dl')).toBeVisible();
    expect(await botoes.count()).toBeGreaterThanOrEqual(3);

    // Cada botão inteiro dentro da largura da janela.
    const caixas = await botoes.evaluateAll(els => els.map(e => {
      const r = e.getBoundingClientRect();
      return { id: e.id, esq: r.left, dir: r.right };
    }));
    for (const c of caixas) {
      expect(c.esq, `${c.id} vaza pela esquerda`).toBeGreaterThanOrEqual(0);
      expect(c.dir, `${c.id} vaza pela direita`).toBeLessThanOrEqual(vp.largura);
    }

    // Clique de verdade no primeiro botão fecha o modal.
    await page.locator('#btn-pular-troca-dl').click();
    await expect(page.locator('#modal-overlay')).toBeHidden();
  });
}
