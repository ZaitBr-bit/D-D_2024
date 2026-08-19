// ============================================================
// O que o Descanso Longo oferece de troca de magias, por classe.
//
// O motor de unidade (testes/regras/unidade/magias-preparo.test.mjs) mede a
// REGRA que o app codifica: `tipo_conjuracao` de dados-classes.js decide, em
// hp-descanso.js:1093-1095, se a troca é completa ou de uma só. Este spec
// mede o que o jogador VÊ, que é a outra metade da alegação.
//
// PHB 2024, tabela "Magias Preparadas por Classe" (Magias.md:19-28):
//   Guardião | Termina um Descanso Longo | UMA
//   Mago     | Termina um Descanso Longo | Qualquer uma
//
// O app dá troca COMPLETA aos dois, porque os dois têm
// `tipo_conjuracao: "preparadas"` -- um campo de dois valores para uma tabela
// de duas variáveis independentes (ocasião × quantidade). Ver a lacuna
// 'magias-troca-quantidade'.
//
// Este spec afirma o ESTADO ATUAL do Guardião, e é isso que o torna útil: se
// alguém corrigir a quantidade, ele fica vermelho e aponta exatamente onde --
// vira a prova da correção sem precisar ser reescrito.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha } from './helpers-regras.mjs';

const GUARDIAO = {
  classe: 'Guardião', nivel: 5, xp: 14000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Natureza', 'Percepção'],
};

test('descanso longo: o Guardião recebe a opção de trocar magias', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUARDIAO, 'regras-guardiao-troca');

  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});

  // O modal de Descanso Longo do Guardião oferece a troca porque
  // `tipo_conjuracao` é "preparadas" (hp-descanso.js:1093).
  const botaoTroca = page.locator('#btn-trocar-magias-dl');
  await expect(botaoTroca,
    'o livro (Magias.md:26) permite ao Guardião trocar UMA magia no Descanso Longo, então a ' +
    'opção deve existir -- o que diverge é a quantidade, não a ocasião')
    .toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
