// ============================================================
// O modal de Maestria em Arma do Ladino abre.
//
// Prova de navegador porque o defeito era de execução, não de regra: a
// tela lia `arma.propriedades` como lista (o dado é string) e lançava
// `TypeError: (a.propriedades || []).map is not a function` antes de
// renderizar qualquer coisa -- o botão "Definir Maestrias" e o "Trocar
// Maestrias" do Descanso Longo não faziam nada, e o erro só aparecia no
// console. Um teste de unidade da regra (unidade/maestria-armas.test.mjs)
// não pegaria isso sozinho: o que quebrava era o consumo do dado real
// pela tela.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha } from './helpers-regras.mjs';

const LADINO = {
  classe: 'Ladino', nivel: 3, xp: 355000, atributos: ATRIBUTOS_REGRAS,
  subclasse: 'Trapaceiro Arcano',
  pericias_proficientes: ['Atletismo', 'História'],
};

test('ficha: o Ladino abre o modal de maestrias e vê armas Simples e Marciais com Acuidade/Leve', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, LADINO, 'regras-maestria-ladino');

  // Clique por script (com espera/retentativa): o botão vive dentro do
  // bloco recolhível de Características de Classe, que pode estar fechado.
  await clicarSeletorFicha(page, '[data-config-maestrias]', { esperar: '#maestria-lista' });
  await assentar(page).catch(() => {});

  const lista = page.locator('#maestria-lista');
  await expect(lista).toBeVisible();
  await expect(lista.locator('[data-maestria-nome="Adaga"]')).toHaveCount(1);
  await expect(lista.locator('[data-maestria-nome="Rapieira"]')).toHaveCount(1);
  // Marcial de propriedade Leve: o Ladino tem proficiência (Classes.md:4152).
  await expect(lista.locator('[data-maestria-nome="Besta de Mão"]')).toHaveCount(1);
  await expect(lista.locator('[data-maestria-nome="Espada Longa"]')).toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
